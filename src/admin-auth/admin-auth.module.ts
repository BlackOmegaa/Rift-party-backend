import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminJwtGuard } from "../common/guards/admin-jwt.guard";

@Module({
	imports: [
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				secret: config.get<string>("JWT_SECRET"),
				signOptions: { expiresIn: "12h" },
			}),
		}),
	],
	controllers: [AdminAuthController],
	providers: [AdminAuthService, AdminJwtGuard],
	exports: [AdminJwtGuard, JwtModule],
})
export class AdminAuthModule {}
