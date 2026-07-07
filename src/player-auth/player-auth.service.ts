import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementService } from "../entitlement/entitlement.service";

const SALT_ROUNDS = 12;
/**
 * Date de lancement des avantages Supporter visibles en jeu (aura, entree,
 * contenu premium...). Les abonnes deja presents avant cette date obtiennent
 * le badge distinct "Day One Supporter" - constante fixe, jamais recalculee.
 */
const DAY_ONE_CUTOFF = new Date("2026-07-08T00:00:00.000Z");

export interface PlayerProfile {
	id: string;
	email: string;
	isSubscriber: boolean;
	/** Date du tout premier abonnement (MIN Subscription.createdAt), ISO 8601. Null si jamais abonne. */
	supporterSince: string | null;
	/** Vrai si le premier abonnement precede le lancement des avantages en jeu. */
	isDayOneSupporter: boolean;
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
		// Premier abonnement en date (pas le plus recent) : c'est l'anciennete
		// reelle du soutien, meme si l'abonnement a ete interrompu puis repris.
		const firstSubscription = await this.prisma.subscription.findFirst({
			where: { userId },
			orderBy: { createdAt: "asc" },
		});
		const supporterSince = firstSubscription?.createdAt ?? null;
		return {
			id: user.id,
			email: user.email,
			isSubscriber,
			supporterSince: supporterSince?.toISOString() ?? null,
			isDayOneSupporter: !!supporterSince && supporterSince < DAY_ONE_CUTOFF,
		};
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
