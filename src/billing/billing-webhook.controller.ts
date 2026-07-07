import { BadRequestException, Controller, Headers, Post, RawBodyRequest, Req } from "@nestjs/common";
import { Request } from "express";
import { BillingService } from "./billing.service";

/**
 * Endpoint appele directement par Stripe (pas par le frontend, pas de
 * PlayerJwtGuard ici). La verification de signature (constructEvent) exige le
 * BUFFER BRUT du body, pas le JSON deja parse par Nest - voir `rawBody: true`
 * dans main.ts (NestFactory.create), qui peuple `request.rawBody` en plus du
 * body normalement parse, sans desactiver le parsing JSON pour les autres routes.
 */
@Controller("billing/webhook")
export class BillingWebhookController {
	constructor(private readonly billingService: BillingService) {}

	@Post()
	async handleWebhook(
		@Req() request: RawBodyRequest<Request>,
		@Headers("stripe-signature") signature: string,
	) {
		if (!request.rawBody || !signature) {
			throw new BadRequestException("Signature ou body manquant.");
		}
		const event = this.billingService.verifyWebhookSignature(request.rawBody, signature);
		await this.billingService.handleWebhookEvent(event);
		return { received: true };
	}
}
