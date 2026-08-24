-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('bug', 'suggestion', 'question', 'other');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('open', 'triaged', 'in_progress', 'resolved', 'wont_fix', 'duplicate');

-- CreateTable
CREATE TABLE "FeedbackReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "type" "FeedbackType" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'open',
    "message" TEXT NOT NULL,
    "sentryEventId" TEXT,
    "requestId" TEXT,
    "pagePath" TEXT NOT NULL,
    "userAgent" TEXT,
    "appVersion" TEXT,
    "locale" TEXT NOT NULL,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackReport_tenantId_createdAt_idx" ON "FeedbackReport"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_status_createdAt_idx" ON "FeedbackReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_sentryEventId_idx" ON "FeedbackReport"("sentryEventId");

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
