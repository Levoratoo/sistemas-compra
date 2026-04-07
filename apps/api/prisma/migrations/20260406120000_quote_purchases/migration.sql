-- DropIndex
DROP INDEX "ProjectQuote_projectId_slotNumber_key";

-- DropIndex
DROP INDEX "PurchaseOrder_projectId_glpiNumber_key";

-- AlterTable
ALTER TABLE "ProjectQuote" ADD COLUMN     "projectQuotePurchaseId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "sourceQuotePurchaseId" TEXT;

-- CreateTable
CREATE TABLE "ProjectQuotePurchase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectQuotePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectQuotePurchaseItem" (
    "id" TEXT NOT NULL,
    "projectQuotePurchaseId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectQuotePurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectQuotePurchase_projectId_idx" ON "ProjectQuotePurchase"("projectId");

-- CreateIndex
CREATE INDEX "ProjectQuotePurchase_projectId_createdAt_idx" ON "ProjectQuotePurchase"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectQuotePurchaseItem_budgetItemId_idx" ON "ProjectQuotePurchaseItem"("budgetItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectQuotePurchaseItem_projectQuotePurchaseId_budgetItemI_key" ON "ProjectQuotePurchaseItem"("projectQuotePurchaseId", "budgetItemId");

-- CreateIndex
CREATE INDEX "ProjectQuote_projectQuotePurchaseId_idx" ON "ProjectQuote"("projectQuotePurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectQuote_projectQuotePurchaseId_slotNumber_key" ON "ProjectQuote"("projectQuotePurchaseId", "slotNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_sourceQuotePurchaseId_idx" ON "PurchaseOrder"("sourceQuotePurchaseId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_projectId_glpiNumber_idx" ON "PurchaseOrder"("projectId", "glpiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_sourceQuotePurchaseId_supplierId_glpiNumber_key" ON "PurchaseOrder"("sourceQuotePurchaseId", "supplierId", "glpiNumber");

-- AddForeignKey
ALTER TABLE "ProjectQuote" ADD CONSTRAINT "ProjectQuote_projectQuotePurchaseId_fkey" FOREIGN KEY ("projectQuotePurchaseId") REFERENCES "ProjectQuotePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuotePurchase" ADD CONSTRAINT "ProjectQuotePurchase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuotePurchaseItem" ADD CONSTRAINT "ProjectQuotePurchaseItem_projectQuotePurchaseId_fkey" FOREIGN KEY ("projectQuotePurchaseId") REFERENCES "ProjectQuotePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuotePurchaseItem" ADD CONSTRAINT "ProjectQuotePurchaseItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_sourceQuotePurchaseId_fkey" FOREIGN KEY ("sourceQuotePurchaseId") REFERENCES "ProjectQuotePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
