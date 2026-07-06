import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed idempotent du compte admin : ne fait rien si un User avec cet email
 * existe deja (ne reinitialise jamais un mot de passe deja change a la main).
 * Lance via `npx prisma db seed` (ou automatiquement par `prisma migrate dev`).
 */
async function main() {
	const email = process.env.ADMIN_SEED_EMAIL;
	const password = process.env.ADMIN_SEED_PASSWORD;
	if (!email || !password) {
		console.warn(
			"ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD non definis : seed du compte admin ignore.",
		);
		return;
	}

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		console.log(`Compte admin ${email} existe deja, rien a faire.`);
		return;
	}

	const passwordHash = await bcrypt.hash(password, 12);
	await prisma.user.create({
		data: { email, passwordHash, role: "ADMIN" },
	});
	console.log(`Compte admin ${email} cree.`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
