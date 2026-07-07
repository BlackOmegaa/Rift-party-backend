import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { PlayerAuthService } from "./player-auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
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

	@UseGuards(PlayerJwtGuard)
	@Get("me")
	me(@Req() request: Request & { player?: PlayerJwtPayload }) {
		return this.playerAuthService.getProfile(request.player!.sub);
	}
}
