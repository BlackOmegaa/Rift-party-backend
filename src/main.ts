import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ALLOWED_ORIGINS } from "./common/constants/cors.constants";

async function bootstrap() {
	// rawBody: true peuple request.rawBody (Buffer) EN PLUS du body JSON
	// normalement parse, sans desactiver le parsing global - necessaire pour
	// verifier la signature du webhook Stripe (voir billing-webhook.controller.ts),
	// qui exige les octets bruts exacts, pas le JSON re-serialise.
	const app = await NestFactory.create(AppModule, { rawBody: true });
	app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

	app.enableCors({
		origin: ALLOWED_ORIGINS,
		credentials: true,
	});

	const port = process.env.PORT ?? 3050;
	await app.listen(port);
	console.log(`Rift Party backend running on port ${port}`);
}

bootstrap();
