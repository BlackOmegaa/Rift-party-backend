import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

	app.enableCors({
		origin: [
			//"http://localhost:4200",
			"https://singular-crepe-1838cb.netlify.app",
		],
		credentials: true,
	});

	const port = process.env.PORT ?? 3050;
	await app.listen(port);
	console.log(
		`Rift Party backend running on https://singular-crepe-1838cb.netlify.app/:${port}`,
		//`Rift Party backend running on http://localhost:${port}`,
	);
}

bootstrap();
