import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { AdminJwtGuard, AdminJwtPayload } from "../common/guards/admin-jwt.guard";

@Controller("admin")
export class AdminAuthController {
	constructor(private readonly adminAuthService: AdminAuthService) {}

	// Anti brute-force : 5 tentatives / minute / IP, bien plus strict que la
	// limite HTTP globale (voir ThrottlerModule dans app.module.ts).
	@Throttle({ default: { limit: 5, ttl: 60_000 } })
	@Post("login")
	login(@Body() dto: AdminLoginDto) {
		return this.adminAuthService.login(dto.email, dto.password);
	}

	/** Route protegee minimale : verifie qu'un token valide est bien exige (401 sans, 200 avec). */
	@UseGuards(AdminJwtGuard)
	@Get("me")
	me(@Req() request: Request & { admin?: AdminJwtPayload }) {
		return { email: request.admin?.email };
	}
}
