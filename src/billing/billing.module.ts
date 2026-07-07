import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingWebhookController } from "./billing-webhook.controller";
import { BillingService } from "./billing.service";
import { PlayerAuthModule } from "../player-auth/player-auth.module";

@Module({
	// PlayerAuthModule exporte PlayerJwtGuard (et son JwtModule), utilise par
	// BillingController pour identifier le joueur qui demande un checkout/portal.
	imports: [PlayerAuthModule],
	controllers: [BillingController, BillingWebhookController],
	providers: [BillingService],
})
export class BillingModule {}
