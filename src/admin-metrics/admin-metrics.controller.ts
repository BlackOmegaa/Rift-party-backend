import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminJwtGuard } from "../common/guards/admin-jwt.guard";
import { AdminMetricsService } from "./admin-metrics.service";

@UseGuards(AdminJwtGuard)
@Controller("admin/metrics")
export class AdminMetricsController {
	constructor(private readonly adminMetricsService: AdminMetricsService) {}

	/** `from`/`to` en ISO 8601 ; le frontend calcule les bornes exactes selon le preset choisi (Aujourd'hui/Hier/7j/30j/Personnalise). Sans parametres : 30 derniers jours. */
	@Get()
	getSummary(@Query("from") from?: string, @Query("to") to?: string) {
		const parsedFrom = from ? new Date(from) : undefined;
		const parsedTo = to ? new Date(to) : undefined;
		return this.adminMetricsService.getSummary(
			parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
			parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : undefined,
		);
	}
}
