import { config as loadDotenv } from "dotenv";

// Les decorateurs @WebSocketGateway sont evalues a l'import, AVANT que
// ConfigModule.forRoot() (dans app.module.ts) ne charge le .env pendant le
// bootstrap Nest. On charge donc le .env ici explicitement (idempotent, ne
// override pas des variables deja definies) pour que CORS_ORIGIN soit
// disponible au moment ou ce fichier est importe par les gateways.
loadDotenv();

/**
 * Origines autorisees, partagees entre le CORS HTTP (main.ts) et le CORS de
 * chaque @WebSocketGateway. Avant, les gateways socket.io avaient `cors: true`
 * (= toutes origines) alors que le CORS HTTP etait deja restreint a Netlify :
 * un site tiers pouvait ouvrir une connexion socket.io vers ce backend.
 * CORS_ORIGIN (.env) : liste separee par des virgules, ex.
 * "http://localhost:4200,https://mon-domaine.netlify.app".
 */
export const ALLOWED_ORIGINS: string[] = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
	: ["https://illustrious-kangaroo-b41e9d.netlify.app"];
