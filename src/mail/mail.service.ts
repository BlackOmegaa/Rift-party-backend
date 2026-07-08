import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Envoi d'emails transactionnels via l'API HTTP de Resend (resend.com) -
 * appel fetch direct, pas de SDK a maintenir. Deux variables d'env :
 *   RESEND_API_KEY  cle API Resend (re_...)
 *   MAIL_FROM       expediteur, ex. "Rift Party <support@riftparty.com>"
 *                   (le domaine doit etre verifie dans Resend : SPF + DKIM)
 * Sans RESEND_API_KEY (dev local), l'email est logge en console au lieu
 * d'etre envoye - le lien de reset reste testable sans compte Resend.
 */
@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private readonly apiKey?: string;
	private readonly from: string;

	constructor(config: ConfigService) {
		this.apiKey = config.get<string>("RESEND_API_KEY");
		this.from = config.get<string>("MAIL_FROM") ?? "Rift Party <support@riftparty.com>";
	}

	/**
	 * Envoie un email (HTML + texte brut). Ne jette jamais : un echec d'envoi
	 * est logge mais ne doit pas faire echouer la requete appelante (une 500
	 * sur /forgot-password revelerait aussi que l'email existe en base).
	 */
	async send(to: string, subject: string, html: string, text: string): Promise<void> {
		if (!this.apiKey) {
			this.logger.warn(`RESEND_API_KEY absent - email non envoye. Destinataire: ${to}, sujet: "${subject}"`);
			this.logger.warn(`Contenu (texte):\n${text}`);
			return;
		}
		try {
			const response = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ from: this.from, to: [to], subject, html, text }),
			});
			if (!response.ok) {
				const body = await response.text();
				this.logger.error(`Echec d'envoi Resend (${response.status}) vers ${to}: ${body}`);
			}
		} catch (err) {
			this.logger.error(`Echec d'envoi Resend vers ${to}`, err instanceof Error ? err.stack : String(err));
		}
	}
}
