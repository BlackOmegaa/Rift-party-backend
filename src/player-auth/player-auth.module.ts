import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PlayerAuthController } from "./player-auth.controller";
import { PlayerAuthService } from "./player-auth.service";
import { PlayerJwtGuard } from "../common/guards/player-jwt.guard";

@Module({
	imports: [
		// Module JWT independant de AdminAuthModule (meme JWT_SECRET, duree de
		// vie differente : 30j pour un compte joueur casual vs 12h pour l'admin).
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				secret: config.get<string>("JWT_SECRET"),
				signOptions: { expiresIn: "30d" },
			}),
		}),
	],
	controllers: [PlayerAuthController],
	providers: [PlayerAuthService, PlayerJwtGuard],
	exports: [PlayerJwtGuard, JwtModule, PlayerAuthService],
})
export class PlayerAuthModule {}
