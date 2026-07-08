-- Resultats des fusions devinees (Fusion Champions), 1 ligne par (anonId, fusionId)
-- pour un "% de joueurs qui ont trouve" base sur la premiere exposition seulement.
CREATE TABLE "FusionResult" (
    "id" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "fusionId" TEXT NOT NULL,
    "found" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FusionResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FusionResult_anonId_fusionId_key" ON "FusionResult"("anonId", "fusionId");
CREATE INDEX "FusionResult_fusionId_idx" ON "FusionResult"("fusionId");
