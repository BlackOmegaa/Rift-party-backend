-- CreateEnum
CREATE TYPE "GameSessionOutcome" AS ENUM ('COMPLETED', 'ABANDONED');

-- DropTable
DROP TABLE "SessionEvent";

-- DropEnum
DROP TYPE "SessionEventType";

-- CreateTable
CREATE TABLE "Visitor" (
    "anonId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    "acquisitionSource" TEXT,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("anonId")
);

-- CreateTable
CREATE TABLE "RoomJoin" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "viaInvite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomJoin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteGenerated" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteGenerated_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "outcome" "GameSessionOutcome",

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visitor_firstSeenAt_idx" ON "Visitor"("firstSeenAt");

-- CreateIndex
CREATE INDEX "Visitor_lastSeenAt_idx" ON "Visitor"("lastSeenAt");

-- CreateIndex
CREATE INDEX "RoomJoin_roomCode_idx" ON "RoomJoin"("roomCode");

-- CreateIndex
CREATE INDEX "RoomJoin_anonId_idx" ON "RoomJoin"("anonId");

-- CreateIndex
CREATE INDEX "RoomJoin_createdAt_idx" ON "RoomJoin"("createdAt");

-- CreateIndex
CREATE INDEX "InviteGenerated_roomCode_idx" ON "InviteGenerated"("roomCode");

-- CreateIndex
CREATE INDEX "InviteGenerated_createdAt_idx" ON "InviteGenerated"("createdAt");

-- CreateIndex
CREATE INDEX "GameSession_gameId_idx" ON "GameSession"("gameId");

-- CreateIndex
CREATE INDEX "GameSession_anonId_idx" ON "GameSession"("anonId");

-- CreateIndex
CREATE INDEX "GameSession_startedAt_idx" ON "GameSession"("startedAt");

-- CreateIndex
CREATE INDEX "GameSession_roomCode_idx" ON "GameSession"("roomCode");

-- CreateIndex
CREATE INDEX "ConnectionEvent_type_createdAt_idx" ON "ConnectionEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectionEvent_socketId_idx" ON "ConnectionEvent"("socketId");

