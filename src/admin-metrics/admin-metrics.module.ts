import { Module } from "@nestjs/common";
import { AdminMetricsController } from "./admin-metrics.controller";
import { AdminMetricsService } from "./admin-metrics.service";
import { RoomsModule } from "../rooms/rooms.module";
import { AdminAuthModule } from "../admin-auth/admin-auth.module";
import { BillingModule } from "../billing/billing.module";

@Module({
	// BillingModule : revenus du mois via l'API Stripe (getMonthRevenue).
	imports: [RoomsModule, AdminAuthModule, BillingModule],
	controllers: [AdminMetricsController],
	providers: [AdminMetricsService],
})
export class AdminMetricsModule {}
