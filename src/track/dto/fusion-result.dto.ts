import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class FusionResultDto {
	@IsString()
	@MaxLength(64)
	anonId!: string;

	@IsString()
	@MinLength(1)
	@MaxLength(64)
	fusionId!: string;

	@IsBoolean()
	found!: boolean;

	/** false = ne PAS enregistrer (appareil equipe exclu) mais renvoyer quand meme le %. Defaut : enregistrer. */
	@IsOptional()
	@IsBoolean()
	record?: boolean;
}
