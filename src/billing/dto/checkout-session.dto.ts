import { IsOptional, IsString, MaxLength } from "class-validator";

export class CheckoutSessionDto {
	/** Chemin d'origine (ex. "/room/ABCDE") pour ramener le joueur la ou il etait apres le paiement. */
	@IsOptional()
	@IsString()
	@MaxLength(200)
	returnPath?: string;
}
