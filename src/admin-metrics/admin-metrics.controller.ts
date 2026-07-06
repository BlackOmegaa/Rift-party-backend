import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminJwtGuard } from "../common/guards/admin-jwt.guard";
import { AdminMetricsService } from "./admin-metrics.service";

@UseGuards(AdminJwtGuard)
@Controller("admin/metrics")
export class AdminMetricsController {
	constructor(private readonly adminMetricsService: AdminMetricsService) {}

	@Get()
	getSummary(@Query("days") days?: string) {
		const parsed = days ? Number(days) : undefined;
		return this.adminMetricsService.getSummary(parsed && parsed > 0 ? parsed : undefined);
	}
}
