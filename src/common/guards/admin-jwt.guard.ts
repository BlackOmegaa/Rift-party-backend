import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

export interface AdminJwtPayload {
	sub: string;
	email: string;
	role: "ADMIN";
}

/**
 * Protege les routes admin (metriques, futures routes de gestion). Lit
 * `Authorization: Bearer <token>`, verifie la signature JWT, attache
 * `request.admin`. Premier guard du repo - place dans common/ pour etre
 * reutilisable par toute future route admin.
 */
@Injectable()
export class AdminJwtGuard implements CanActivate {
	constructor(private readonly jwtService: JwtService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request & { admin?: AdminJwtPayload }>();
		const header = request.headers.authorization;
		const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
		if (!token) throw new UnauthorizedException("Token manquant.");

		try {
			const payload = await this.jwtService.verifyAsync<AdminJwtPayload>(token);
			request.admin = payload;
			return true;
		} catch {
			throw new UnauthorizedException("Token invalide ou expire.");
		}
	}
}
