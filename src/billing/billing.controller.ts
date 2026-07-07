import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { BillingService } from "./billing.service";
import { PlayerJwtGuard, PlayerJwtPayload } from "../common/guards/player-jwt.guard";
import { CheckoutSessionDto } from "./dto/checkout-session.dto";

@Controller("billing")
@UseGuards(PlayerJwtGuard)
export class BillingController {
	constructor(private readonly billingService: BillingService) {}

	@Post("checkout-session")
	createCheckoutSession(
		@Req() request: Request & { player?: PlayerJwtPayload },
		@Body() dto: CheckoutSessionDto,
	) {
		return this.billingService.createCheckoutSession(request.player!.sub, request.player!.email, dto.returnPath, dto.anonId);
	}

	@Post("portal-session")
	createPortalSession(@Req() request: Request & { player?: PlayerJwtPayload }) {
		return this.billingService.createPortalSession(request.player!.sub);
	}
}
