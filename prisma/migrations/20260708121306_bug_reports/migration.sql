-- Signalements de bugs envoyes par les joueurs (bouton "Signaler un bug"),
-- consultes depuis la console admin.
CREATE TYPE "BugReportStatus" AS ENUM ('OPEN', 'DONE');

CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "pseudo" TEXT,
    "roomCode" TEXT,
    "gameId" TEXT,
    "anonId" TEXT,
    "page" TEXT,
    "status" "BugReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");
