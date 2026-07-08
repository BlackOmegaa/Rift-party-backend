import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

export interface PlayerJwtPayload {
	sub: string;
	email: string;
	role: "PLAYER";
}

/**
 * Protege les routes joueur (compte, billing). Meme pattern qu'AdminJwtGuard :
 * lit `Authorization: Bearer <token>`, verifie la signature JWT, attache
 * `request.player`. Distinct d'AdminJwtGuard car un token joueur (role PLAYER,
 * duree de vie 30j) n'a jamais acces aux routes admin et inversement.
 */
@Injectable()
export class PlayerJwtGuard implements CanActivate {
	constructor(private readonly jwtService: JwtService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request & { player?: PlayerJwtPayload }>();
		const header = request.headers.authorization;
		const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
		if (!token) throw new UnauthorizedException("Token manquant.");

		try {
			const payload = await this.jwtService.verifyAsync<PlayerJwtPayload>(token);
			// Symetrique d'AdminJwtGuard : meme JWT_SECRET pour les deux roles, donc
			// on refuse explicitement un token ADMIN sur une route joueur.
			if (payload.role !== "PLAYER") throw new UnauthorizedException("Token joueur requis.");
			request.player = payload;
			return true;
		} catch (err) {
			if (err instanceof UnauthorizedException) throw err;
			throw new UnauthorizedException("Token invalide ou expire.");
		}
	}
}
