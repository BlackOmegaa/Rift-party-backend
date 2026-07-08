import { IsIn, IsString, Length } from "class-validator";

export const CLIENT_FUNNEL_STEPS = ["CTA_CLICKED"] as const;
export const FUNNEL_KINDS = ["DONATION"] as const;

export class FunnelEventDto {
	@IsString()
	@Length(8, 64)
	anonId!: string;

	@IsIn(FUNNEL_KINDS)
	kind!: (typeof FUNNEL_KINDS)[number];

	@IsIn(CLIENT_FUNNEL_STEPS)
	step!: (typeof CLIENT_FUNNEL_STEPS)[number];
}
