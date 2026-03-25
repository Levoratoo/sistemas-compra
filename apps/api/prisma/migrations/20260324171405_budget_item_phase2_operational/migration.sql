-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN "actualUnitValue" DECIMAL;
ALTER TABLE "BudgetItem" ADD COLUMN "administrativeFeePercent" DECIMAL;
ALTER TABLE "BudgetItem" ADD COLUMN "approvedSupplierName" TEXT;
ALTER TABLE "BudgetItem" ADD COLUMN "competenceLabel" TEXT;
ALTER TABLE "BudgetItem" ADD COLUMN "editalDeliveryDeadlineDays" INTEGER;
ALTER TABLE "BudgetItem" ADD COLUMN "glpiTicketNumber" TEXT;
ALTER TABLE "BudgetItem" ADD COLUMN "nextReplenishmentExpectedAt" DATETIME;
ALTER TABLE "BudgetItem" ADD COLUMN "opDeliveredAt" DATETIME;
ALTER TABLE "BudgetItem" ADD COLUMN "opExpectedDeliveryAt" DATETIME;
ALTER TABLE "BudgetItem" ADD COLUMN "opPaymentSentAt" DATETIME;
ALTER TABLE "BudgetItem" ADD COLUMN "operationalPurchaseStatus" TEXT;
ALTER TABLE "BudgetItem" ADD COLUMN "operationalStagesStatus" TEXT;
ALTER TABLE "BudgetItem" ADD COLUMN "peopleCount" INTEGER;
ALTER TABLE "BudgetItem" ADD COLUMN "priority" TEXT;
ALTER TABLE "BudgetItem" ADD COLUMN "replenishmentPeriodDaysEdital" INTEGER;
ALTER TABLE "BudgetItem" ADD COLUMN "replenishmentStateLabel" TEXT;
