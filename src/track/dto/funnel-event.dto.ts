import { IsIn, IsString, Length } from "class-validator";

/**
 * Pas de funnel enregistrables PAR LE CLIENT. CHECKOUT_STARTED et COMPLETED
 * sont volontairement absents : ils ne sont ecrits que cote serveur
 * (BillingService / webhook Stripe), sinon n'importe qui pourrait forger de
 * fausses conversions payees en POSTant sur cette route publique.
 */
export const CLIENT_FUNNEL_STEPS = ["OFFER_VIEWED", "CTA_CLICKED", "CHECKOUT_CANCELLED"] as const;
export const FUNNEL_KINDS = ["SUBSCRIPTION", "DONATION"] as const;

export class FunnelEventDto {
	@IsString()
	@Length(8, 64)
	anonId!: string;

	@IsIn(FUNNEL_KINDS)
	kind!: (typeof FUNNEL_KINDS)[number];

	@IsIn(CLIENT_FUNNEL_STEPS)
	step!: (typeof CLIENT_FUNNEL_STEPS)[number];
}
