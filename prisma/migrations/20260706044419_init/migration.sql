-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "ConnectionEventType" AS ENUM ('CONNECT', 'DISCONNECT');

-- CreateEnum
CREATE TYPE "SessionEventType" AS ENUM ('GAME_STARTED', 'GAME_COMPLETED', 'GAME_ABANDONED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "hostPseudoInitial" TEXT NOT NULL,
    "maxPlayersReached" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playlist" TEXT[],
    "playerCount" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "scores" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiktokVote" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "matchId" TEXT,
    "question" TEXT NOT NULL,
    "pseudo" TEXT NOT NULL,
    "anonId" TEXT,
    "placement" JSONB NOT NULL,
    "fraudPenalty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TiktokVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiktokGlobalStats" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "champion" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TiktokGlobalStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionEvent" (
    "id" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "socketId" TEXT NOT NULL,
    "roomCode" TEXT,
    "type" "ConnectionEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "SessionEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_createdAt_idx" ON "Room"("createdAt");

-- CreateIndex
CREATE INDEX "Match_roomId_idx" ON "Match"("roomId");

-- CreateIndex
CREATE INDEX "Round_matchId_idx" ON "Round"("matchId");

-- CreateIndex
CREATE INDEX "Round_gameId_idx" ON "Round"("gameId");

-- CreateIndex
CREATE INDEX "TiktokVote_question_idx" ON "TiktokVote"("question");

-- CreateIndex
CREATE INDEX "TiktokVote_roomCode_idx" ON "TiktokVote"("roomCode");

-- CreateIndex
CREATE INDEX "TiktokGlobalStats_question_idx" ON "TiktokGlobalStats"("question");

-- CreateIndex
CREATE UNIQUE INDEX "TiktokGlobalStats_question_slot_champion_key" ON "TiktokGlobalStats"("question", "slot", "champion");

-- CreateIndex
CREATE INDEX "ConnectionEvent_anonId_idx" ON "ConnectionEvent"("anonId");

-- CreateIndex
CREATE INDEX "ConnectionEvent_createdAt_idx" ON "ConnectionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SessionEvent_gameId_idx" ON "SessionEvent"("gameId");

-- CreateIndex
CREATE INDEX "SessionEvent_anonId_idx" ON "SessionEvent"("anonId");

-- CreateIndex
CREATE INDEX "SessionEvent_createdAt_idx" ON "SessionEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
