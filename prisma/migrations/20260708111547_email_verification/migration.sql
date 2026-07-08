-- Verification d'email non bloquante : date de confirmation + token de
-- verification (hash SHA-256, meme mecanique que le reset de mot de passe).
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "verifyTokenHash" TEXT,
ADD COLUMN "verifyTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_verifyTokenHash_key" ON "User"("verifyTokenHash");
