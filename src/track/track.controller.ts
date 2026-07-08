import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";
import { FunnelEventDto } from "./dto/funnel-event.dto";
import { BugReportDto } from "./dto/bug-report.dto";

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
}
