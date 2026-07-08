import { IsString, Length } from "class-validator";

export class VerifyEmailDto {
	// 64 hex chars (32 octets aleatoires) - meme format que le token de reset.
	@IsString()
	@Length(64, 64)
	token!: string;
}
