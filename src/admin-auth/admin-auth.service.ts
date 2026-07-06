import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminAuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
	) {}

	async login(email: string, password: string): Promise<{ token: string }> {
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user || user.role !== "ADMIN") throw new UnauthorizedException("Identifiants invalides.");

		const valid = await bcrypt.compare(password, user.passwordHash);
		if (!valid) throw new UnauthorizedException("Identifiants invalides.");

		await this.prisma.user.update({
			where: { id: user.id },
			data: { lastLoginAt: new Date() },
		});

		const token = await this.jwtService.signAsync({
			sub: user.id,
			email: user.email,
			role: user.role,
		});
		return { token };
	}
}
