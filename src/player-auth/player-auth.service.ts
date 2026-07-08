import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementService } from "../entitlement/entitlement.service";
import { MailService } from "../mail/mail.service";
import { ALLOWED_ORIGINS } from "../common/constants/cors.constants";

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h : assez pour ouvrir sa boite mail, court en cas de fuite.
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
	private readonly frontendUrl: string;

	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
		private readonly entitlement: EntitlementService,
		private readonly mail: MailService,
		config: ConfigService,
	) {
		// Meme convention que BillingService : FRONTEND_URL sinon premiere origine CORS.
		this.frontendUrl = config.get<string>("FRONTEND_URL") ?? ALLOWED_ORIGINS[0];
	}

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

	/**
	 * Demande de reinitialisation : repond toujours pareil, que l'email existe
	 * ou non (anti-enumeration de comptes). Le token en clair ne vit que dans
	 * l'email envoye ; seul son hash SHA-256 est stocke en base.
	 */
	async forgotPassword(email: string): Promise<void> {
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user || user.role !== "PLAYER") return;

		const token = randomBytes(32).toString("hex");
		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				resetTokenHash: this.hashToken(token),
				resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
			},
		});

		const link = `${this.frontendUrl}/reset-password?token=${token}`;
		await this.mail.send(
			user.email,
			"Réinitialise ton mot de passe — Rift Party",
			this.resetEmailHtml(link),
			`Quelqu'un (sans doute toi) a demandé à réinitialiser le mot de passe de ton compte Rift Party.\n\n` +
				`Pour choisir un nouveau mot de passe, ouvre ce lien (valable 1 heure) :\n${link}\n\n` +
				`Si tu n'es pas à l'origine de cette demande, ignore simplement cet email : ton mot de passe reste inchangé.`,
		);
	}

	/** Valide le token recu par email, change le mot de passe et connecte directement. */
	async resetPassword(token: string, password: string): Promise<{ token: string }> {
		const user = await this.prisma.user.findUnique({
			where: { resetTokenHash: this.hashToken(token) },
		});
		if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
			throw new BadRequestException("Lien invalide ou expiré. Refais une demande de réinitialisation.");
		}

		const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				passwordHash,
				resetTokenHash: null,
				resetTokenExpiresAt: null,
				lastLoginAt: new Date(),
			},
		});

		return this.signToken(user.id, user.email);
	}

	private hashToken(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	}

	private resetEmailHtml(link: string): string {
		// Email volontairement sobre (tables/styles inline inutiles pour un
		// transactionnel court) : meilleure delivrabilite qu'un template charge.
		return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
	<h2 style="color: #0a1428;">Rift <span style="color: #c8aa6e;">Party</span></h2>
	<p>Quelqu'un (sans doute toi) a demandé à réinitialiser le mot de passe de ton compte Rift Party.</p>
	<p style="text-align: center; margin: 28px 0;">
		<a href="${link}" style="background: #c8aa6e; color: #0a1428; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
			Choisir un nouveau mot de passe
		</a>
	</p>
	<p style="font-size: 13px; color: #555;">Ce lien est valable 1 heure. Si le bouton ne fonctionne pas, copie cette adresse dans ton navigateur :<br/>
	<a href="${link}" style="color: #785a28; word-break: break-all;">${link}</a></p>
	<p style="font-size: 13px; color: #555;">Si tu n'es pas à l'origine de cette demande, ignore simplement cet email : ton mot de passe reste inchangé.</p>
</div>`;
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
