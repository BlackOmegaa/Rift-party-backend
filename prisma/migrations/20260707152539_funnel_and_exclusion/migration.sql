-- CreateEnum
CREATE TYPE "FunnelKind" AS ENUM ('SUBSCRIPTION', 'DONATION');

-- CreateEnum
CREATE TYPE "FunnelStep" AS ENUM ('OFFER_VIEWED', 'CTA_CLICKED', 'CHECKOUT_STARTED', 'CHECKOUT_CANCELLED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "excluded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "kind" "FunnelKind" NOT NULL,
    "step" "FunnelStep" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FunnelEvent_kind_step_createdAt_idx" ON "FunnelEvent"("kind", "step", "createdAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_anonId_idx" ON "FunnelEvent"("anonId");
