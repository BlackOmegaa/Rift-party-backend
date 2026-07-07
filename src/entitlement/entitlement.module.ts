import { Global, Module } from "@nestjs/common";
import { EntitlementService } from "./entitlement.service";

/**
 * Module global (meme convention que PrismaModule) : EntitlementService est
 * injectable partout (player-auth, billing, futures verifications de perks
 * en jeu) sans reimporter ce module dans chaque feature module.
 */
@Global()
@Module({
	providers: [EntitlementService],
	exports: [EntitlementService],
})
export class EntitlementModule {}
