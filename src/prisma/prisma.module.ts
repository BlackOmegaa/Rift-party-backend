import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Module global : PrismaService est injectable partout sans reimporter ce
 * module dans chaque feature module (meme convention que EventEmitterModule).
 */
@Global()
@Module({
	providers: [PrismaService],
	exports: [PrismaService],
})
export class PrismaModule {}
