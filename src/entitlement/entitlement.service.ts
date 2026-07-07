import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Statut d'abonnement d'un joueur, derive de la derniere ligne Subscription
 * (une ligne par cycle de vie d'abonnement Stripe, voir schema.prisma).
 * Utilise par player-auth (endpoint /me) et billing (checkout/webhook) - ne
 * fait AUCUNE verification de contenu/perks ici, juste "actif ou pas".
 */
@Injectable()
export class EntitlementService {
	constructor(private readonly prisma: PrismaService) {}

	async isSubscriber(userId: string): Promise<boolean> {
		const latest = await this.prisma.subscription.findFirst({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});
		if (!latest) return false;
		if (!ACTIVE_STATUSES.has(latest.status)) return false;
		if (latest.currentPeriodEnd && latest.currentPeriodEnd.getTime() < Date.now()) return false;
		return true;
	}
}
