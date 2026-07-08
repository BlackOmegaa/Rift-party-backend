-- Reinitialisation de mot de passe : hash SHA-256 du token envoye par email
-- (jamais le token en clair), un seul token actif a la fois par utilisateur.
ALTER TABLE "User" ADD COLUMN "resetTokenHash" TEXT,
ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");
