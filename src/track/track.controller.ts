import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";
import { FunnelEventDto } from "./dto/funnel-event.dto";
import { BugReportDto } from "./dto/bug-report.dto";
import { FusionResultDto } from "./dto/fusion-result.dto";

/**
 * Tracking leger cote client (funnel de monetisation). Route publique (pas de
 * compte requis pour cliquer sur l'offre) mais protegee par le ThrottlerGuard
 * global et limitee aux pas non sensibles (voir FunnelEventDto).
 */
@Controller("track")
export class TrackController {
	constructor(private readonly prisma: PrismaService) {}

	@Post("funnel")
	async recordFunnelEvent(@Body() dto: FunnelEventDto) {
		await this.prisma.funnelEvent.create({
			data: { anonId: dto.anonId, kind: dto.kind, step: dto.step },
		});
		return { recorded: true };
	}

	// Limite serree : un joueur legitime n'envoie pas 10 signalements d'affilee,
	// et la table ne doit pas pouvoir etre inondee depuis un script.
	@Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
	@Post("bug-report")
	async recordBugReport(@Body() dto: BugReportDto) {
		await this.prisma.bugReport.create({
			data: {
				message: dto.message,
				pseudo: dto.pseudo,
				roomCode: dto.roomCode,
				gameId: dto.gameId,
				anonId: dto.anonId,
				page: dto.page,
			},
		});
		return { recorded: true };
	}

	/**
	 * Resultat d'une fusion devinee. Enregistre uniquement la PREMIERE exposition
	 * d'un joueur a une fusion (upsert sans update sur le couple anonId+fusionId),
	 * puis renvoie le "% de joueurs qui ont trouve" pour l'afficher a la revelation.
	 * `record: false` (appareil equipe) : ne compte pas mais renvoie quand meme le %.
	 */
	@Throttle({ default: { limit: 60, ttl: 60_000 } })
	@Post("fusion-result")
	async recordFusionResult(@Body() dto: FusionResultDto) {
		if (dto.record !== false) {
			await this.prisma.fusionResult.upsert({
				where: { anonId_fusionId: { anonId: dto.anonId, fusionId: dto.fusionId } },
				create: { anonId: dto.anonId, fusionId: dto.fusionId, found: dto.found },
				update: {}, // deja vu par ce joueur : on garde le resultat de la 1re fois
			});
		}
		const [total, found] = await Promise.all([
			this.prisma.fusionResult.count({ where: { fusionId: dto.fusionId } }),
			this.prisma.fusionResult.count({ where: { fusionId: dto.fusionId, found: true } }),
		]);
		return { foundPct: total ? found / total : null, total };
	}
}
