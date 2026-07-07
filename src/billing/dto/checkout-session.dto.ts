import { IsOptional, IsString, MaxLength } from "class-validator";

export class CheckoutSessionDto {
	/** Chemin d'origine (ex. "/room/ABCDE") pour ramener le joueur la ou il etait apres le paiement. */
	@IsOptional()
	@IsString()
	@MaxLength(200)
	returnPath?: string;

	/** anonId analytics du visiteur, pour relier le paiement a sa source d'acquisition dans le funnel (voir FunnelEvent). */
	@IsOptional()
	@IsString()
	@MaxLength(64)
	anonId?: string;
}
