-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUPPLIER_CND_ALERT';

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "offeringCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Notification: dedupeKey + optional project/budget/supplier for CND alerts
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

UPDATE "Notification" SET "dedupeKey" = "budgetItemId" WHERE "dedupeKey" IS NULL;

ALTER TABLE "Notification" ALTER COLUMN "dedupeKey" SET NOT NULL;

DROP INDEX "Notification_userId_type_budgetItemId_key";

CREATE UNIQUE INDEX "Notification_userId_type_dedupeKey_key" ON "Notification"("userId", "type", "dedupeKey");

ALTER TABLE "Notification" DROP CONSTRAINT "Notification_projectId_fkey";

ALTER TABLE "Notification" DROP CONSTRAINT "Notification_budgetItemId_fkey";

ALTER TABLE "Notification" ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "Notification" ALTER COLUMN "budgetItemId" DROP NOT NULL;

ALTER TABLE "Notification" ADD COLUMN "supplierId" TEXT;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_supplierId_idx" ON "Notification"("supplierId");
