-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REPLENISHMENT_DUE_SOON');

-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN "purchaseControlSortRank" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BudgetItem" ADD COLUMN "replenishmentCycleConfirmedAt" TIMESTAMP(3);
ALTER TABLE "BudgetItem" ADD COLUMN "replenishmentContinuesAsItemId" TEXT;

-- Backfill sort rank per project (preserve previous createdAt order)
WITH ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC) - 1) AS rn
  FROM "BudgetItem"
)
UPDATE "BudgetItem" bi
SET "purchaseControlSortRank" = ranked.rn * 10
FROM ranked
WHERE bi.id = ranked.id;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetItem_replenishmentContinuesAsItemId_key" ON "BudgetItem"("replenishmentContinuesAsItemId");

-- CreateIndex
CREATE INDEX "BudgetItem_projectId_purchaseControlSortRank_idx" ON "BudgetItem"("projectId", "purchaseControlSortRank");

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_replenishmentContinuesAsItemId_fkey" FOREIGN KEY ("replenishmentContinuesAsItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_type_budgetItemId_key" ON "Notification"("userId", "type", "budgetItemId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_projectId_idx" ON "Notification"("projectId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
