import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { PlayerAuthService } from "./player-auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { PlayerJwtGuard, PlayerJwtPayload } from "../common/guards/player-jwt.guard";

@Controller("player-auth")
export class PlayerAuthController {
	constructor(private readonly playerAuthService: PlayerAuthService) {}

	// Meme anti brute-force que /admin/login (voir app.module.ts pour la limite globale).
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@Post("register")
	register(@Body() dto: RegisterDto) {
		return this.playerAuthService.register(dto.email, dto.password);
	}

	@Throttle({ default: { limit: 5, ttl: 60_000 } })
	@Post("login")
	login(@Body() dto: LoginDto) {
		return this.playerAuthService.login(dto.email, dto.password);
	}

	// Limite stricte : chaque appel declenche potentiellement un envoi d'email
	// (spam + quota Resend). La reponse est toujours 200, email connu ou non.
	@Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
	@Post("forgot-password")
	async forgotPassword(@Body() dto: ForgotPasswordDto) {
		await this.playerAuthService.forgotPassword(dto.email);
		return { ok: true };
	}

	@Throttle({ default: { limit: 5, ttl: 60_000 } })
	@Post("reset-password")
	resetPassword(@Body() dto: ResetPasswordDto) {
		return this.playerAuthService.resetPassword(dto.token, dto.password);
	}

	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@Post("verify-email")
	async verifyEmail(@Body() dto: VerifyEmailDto) {
		await this.playerAuthService.verifyEmail(dto.token);
		return { ok: true };
	}

	// Meme limite stricte que forgot-password : chaque appel envoie un email.
	@Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
	@UseGuards(PlayerJwtGuard)
	@Post("resend-verification")
	async resendVerification(@Req() request: Request & { player?: PlayerJwtPayload }) {
		await this.playerAuthService.resendVerification(request.player!.sub);
		return { ok: true };
	}

	@UseGuards(PlayerJwtGuard)
	@Get("me")
	me(@Req() request: Request & { player?: PlayerJwtPayload }) {
		return this.playerAuthService.getProfile(request.player!.sub);
	}
}
