import { IsString, Length, MinLength } from "class-validator";

export class ResetPasswordDto {
	// 64 hex chars (32 octets aleatoires) - toute autre longueur est invalide d'office.
	@IsString()
	@Length(64, 64)
	token!: string;

	// Meme regle que RegisterDto : 8 caracteres minimum.
	@IsString()
	@MinLength(8)
	password!: string;
}
