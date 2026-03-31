-- CreateTable
CREATE TABLE "ProjectQuote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectQuoteItem" (
    "id" TEXT NOT NULL,
    "projectQuoteId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectQuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectQuote_projectId_slotNumber_key" ON "ProjectQuote"("projectId", "slotNumber");

-- CreateIndex
CREATE INDEX "ProjectQuote_projectId_idx" ON "ProjectQuote"("projectId");

-- CreateIndex
CREATE INDEX "ProjectQuote_supplierId_idx" ON "ProjectQuote"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectQuoteItem_projectQuoteId_budgetItemId_key" ON "ProjectQuoteItem"("projectQuoteId", "budgetItemId");

-- CreateIndex
CREATE INDEX "ProjectQuoteItem_budgetItemId_idx" ON "ProjectQuoteItem"("budgetItemId");

-- AddForeignKey
ALTER TABLE "ProjectQuote" ADD CONSTRAINT "ProjectQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuote" ADD CONSTRAINT "ProjectQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuoteItem" ADD CONSTRAINT "ProjectQuoteItem_projectQuoteId_fkey" FOREIGN KEY ("projectQuoteId") REFERENCES "ProjectQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuoteItem" ADD CONSTRAINT "ProjectQuoteItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
