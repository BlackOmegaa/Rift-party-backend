import { Body, Controller, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FunnelEventDto } from "./dto/funnel-event.dto";

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
}
