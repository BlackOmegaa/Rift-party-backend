import { Module } from "@nestjs/common";
import { AdminMetricsController } from "./admin-metrics.controller";
import { AdminMetricsService } from "./admin-metrics.service";
import { RoomsModule } from "../rooms/rooms.module";
import { AdminAuthModule } from "../admin-auth/admin-auth.module";

@Module({
	imports: [RoomsModule, AdminAuthModule],
	controllers: [AdminMetricsController],
	providers: [AdminMetricsService],
})
export class AdminMetricsModule {}
