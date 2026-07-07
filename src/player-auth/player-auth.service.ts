import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementService } from "../entitlement/entitlement.service";

const SALT_ROUNDS = 12;

export interface PlayerProfile {
	id: string;
	email: string;
	isSubscriber: boolean;
}

@Injectable()
export class PlayerAuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
		private readonly entitlement: EntitlementService,
	) {}

	async register(email: string, password: string): Promise<{ token: string }> {
		const existing = await this.prisma.user.findUnique({ where: { email } });
		if (existing) throw new ConflictException("Un compte existe deja avec cet email.");

		const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
		const user = await this.prisma.user.create({
			data: { email, passwordHash, role: "PLAYER" },
		});

		return this.signToken(user.id, user.email);
	}

	async login(email: string, password: string): Promise<{ token: string }> {
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user || user.role !== "PLAYER") throw new UnauthorizedException("Identifiants invalides.");

		const valid = await bcrypt.compare(password, user.passwordHash);
		if (!valid) throw new UnauthorizedException("Identifiants invalides.");

		await this.prisma.user.update({
			where: { id: user.id },
			data: { lastLoginAt: new Date() },
		});

		return this.signToken(user.id, user.email);
	}

	async getProfile(userId: string): Promise<PlayerProfile> {
		const user = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!user || user.role !== "PLAYER") throw new UnauthorizedException("Compte introuvable.");
		const isSubscriber = await this.entitlement.isSubscriber(user.id);
		return { id: user.id, email: user.email, isSubscriber };
	}

	private async signToken(userId: string, email: string): Promise<{ token: string }> {
		const token = await this.jwtService.signAsync({
			sub: userId,
			email,
			role: "PLAYER",
		});
		return { token };
	}
}
