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

	// Derriere le proxy Railway : sans ceci, req.ip = IP du proxy pour TOUT le
	// monde, donc un seul compteur de throttle partage (un attaquant epuiserait
	// la limite admin-login/register pour tous les joueurs, et des amis sur le
	// meme reseau se bloqueraient mutuellement). trust proxy=1 fait lire l'IP
	// reelle du client dans X-Forwarded-For -> throttle vraiment par-IP.
	app.getHttpAdapter().getInstance().set("trust proxy", 1);

	app.enableCors({
		origin: ALLOWED_ORIGINS,
		credentials: true,
	});

	const port = process.env.PORT ?? 3050;
	await app.listen(port);
	console.log(`Rift Party backend running on port ${port}`);
}

bootstrap();
