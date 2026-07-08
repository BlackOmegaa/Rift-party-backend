import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { ALLOWED_ORIGINS } from "../common/constants/cors.constants";

@Injectable()
export class BillingService {
	// Lazy et nullable expres : tant que STRIPE_SECRET_KEY n'est pas configure
	// (ex. avant que l'utilisateur ait cree son compte Stripe), le reste de
	// l'app (jeux, rooms, admin...) doit demarrer normalement. Seules les
	// routes billing renvoient une erreur explicite en attendant.
	private readonly stripe: Stripe | null;
	private readonly frontendUrl: string;
	private readonly priceId: string;

	constructor(
		private readonly config: ConfigService,
		private readonly prisma: PrismaService,
	) {
		const secretKey = this.config.get<string>("STRIPE_SECRET_KEY");
		this.stripe = secretKey ? new Stripe(secretKey) : null;
		this.frontendUrl = this.config.get<string>("FRONTEND_URL") ?? ALLOWED_ORIGINS[0];
		this.priceId = this.config.get<string>("STRIPE_PRICE_ID") ?? "";
	}

	private requireStripe(): Stripe {
		if (!this.stripe) throw new BadRequestException("Paiement pas encore configure (STRIPE_SECRET_KEY manquant).");
		return this.stripe;
	}

	/**
	 * Cree une session Stripe Checkout (mode abonnement) pour un joueur deja identifie.
	 * `returnPath` : chemin d'ou le joueur a lance le paiement (ex. "/room/ABCDE"),
	 * pour l'y ramener apres coup au lieu de le rediriger de force vers /account
	 * (sinon un joueur qui s'abonne en cours de partie se retrouve ejecte de sa room).
	 */
	async createCheckoutSession(
		userId: string,
		email: string,
		returnPath?: string,
		anonId?: string,
	): Promise<{ url: string }> {
		const stripe = this.requireStripe();
		if (!this.priceId) throw new BadRequestException("STRIPE_PRICE_ID non configure.");

		// Reutilise le stripeCustomerId d'un abonnement precedent (resub apres
		// annulation) plutot que de laisser Stripe recreer un customer a chaque fois.
		const existing = await this.prisma.subscription.findFirst({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});

		const safeReturnPath = returnPath?.startsWith("/") ? returnPath : "/account";

		const session = await stripe.checkout.sessions.create({
			mode: "subscription",
			line_items: [{ price: this.priceId, quantity: 1 }],
			customer: existing?.stripeCustomerId,
			customer_email: existing ? undefined : email,
			client_reference_id: userId,
			success_url: `${this.frontendUrl}${safeReturnPath}?checkout=success`,
			cancel_url: `${this.frontendUrl}${safeReturnPath}?checkout=cancelled`,
			// anonId dans les metadata de session : c'est le seul canal pour que le
			// webhook `checkout.session.completed` retrouve le visiteur analytics et
			// donc sa source d'acquisition (funnel de conversion du dashboard).
			metadata: { userId, anonId: anonId ?? "" },
			subscription_data: { metadata: { userId } },
		});

		if (!session.url) throw new BadRequestException("Stripe n'a pas renvoye d'URL de session.");

		// Pas fiable du funnel "parti vers Stripe" : enregistre serveur, jamais client.
		await this.prisma.funnelEvent.create({
			data: { kind: "SUBSCRIPTION", step: "CHECKOUT_STARTED", anonId: anonId ?? null, userId },
		});

		return { url: session.url };
	}

	/** Cree une session Stripe Customer Portal (gestion/annulation) pour un abonne existant. */
	async createPortalSession(userId: string): Promise<{ url: string }> {
		const stripe = this.requireStripe();
		const existing = await this.prisma.subscription.findFirst({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});
		if (!existing) throw new BadRequestException("Aucun abonnement associe a ce compte.");

		const session = await stripe.billingPortal.sessions.create({
			customer: existing.stripeCustomerId,
			return_url: `${this.frontendUrl}/account`,
		});
		return { url: session.url };
	}

	/**
	 * Argent reellement encaisse sur le mois calendaire en cours (nouveaux
	 * abonnements ET renouvellements) : somme des factures Stripe payees,
	 * source de verite plutot qu'une estimation "abonnes x 3EUR" depuis la BDD.
	 * Null tant que Stripe n'est pas configure (dev local sans cle).
	 */
	async getMonthRevenue(): Promise<{ amountCents: number; payments: number; currency: string } | null> {
		if (!this.stripe) return null;
		const now = new Date();
		const monthStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);

		let amountCents = 0;
		let payments = 0;
		let currency = "eur";
		// Pagination defensive (100 factures par page) : largement surdimensionne
		// aujourd'hui, mais evite un plafond silencieux si le volume decolle.
		for await (const invoice of this.stripe.invoices.list({
			status: "paid",
			created: { gte: monthStart },
			limit: 100,
		})) {
			if (!invoice.amount_paid) continue;
			amountCents += invoice.amount_paid;
			payments += 1;
			currency = invoice.currency ?? currency;
		}
		return { amountCents, payments, currency };
	}

	verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
		const stripe = this.requireStripe();
		const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
		if (!webhookSecret) throw new BadRequestException("STRIPE_WEBHOOK_SECRET non configure.");
		return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
	}

	/**
	 * Traite les events Stripe pertinents pour l'entitlement. `checkout.session.completed`
	 * cree la premiere ligne Subscription (le customer/subscription id n'existent qu'a
	 * partir de la, jamais avant). Les updates/deletes suivants ne font que
	 * mettre a jour cette meme ligne (retrouvee par stripeSubscriptionId).
	 */
	async handleWebhookEvent(event: Stripe.Event): Promise<void> {
		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object as Stripe.Checkout.Session;
				const userId = session.client_reference_id;
				if (!userId || !session.subscription || !session.customer) return;
				const subscriptionId =
					typeof session.subscription === "string" ? session.subscription : session.subscription.id;
				const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
				const subscription = await this.requireStripe().subscriptions.retrieve(subscriptionId);
				await this.upsertSubscription(userId, customerId, subscription);
				// Conversion confirmee par Stripe : derniere marche du funnel, avec
				// l'anonId passe dans les metadata a la creation de la session.
				await this.prisma.funnelEvent.create({
					data: {
						kind: "SUBSCRIPTION",
						step: "COMPLETED",
						anonId: session.metadata?.["anonId"] || null,
						userId,
					},
				});
				return;
			}
			case "customer.subscription.updated":
			case "customer.subscription.deleted": {
				const subscription = event.data.object as Stripe.Subscription;
				const userId = subscription.metadata?.["userId"];
				const customerId =
					typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
				if (!userId) return;
				await this.upsertSubscription(userId, customerId, subscription);
				return;
			}
			default:
				return;
		}
	}

	private async upsertSubscription(
		userId: string,
		stripeCustomerId: string,
		subscription: Stripe.Subscription,
	): Promise<void> {
		const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
		await this.prisma.subscription.upsert({
			where: { stripeSubscriptionId: subscription.id },
			create: {
				userId,
				stripeCustomerId,
				stripeSubscriptionId: subscription.id,
				status: subscription.status,
				currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
			},
			update: {
				status: subscription.status,
				currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
			},
		});
	}
}
