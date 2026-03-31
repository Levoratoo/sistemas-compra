ALTER TYPE "DocumentType" ADD VALUE 'PURCHASE_ORDER_PDF';

ALTER TABLE "Project"
ADD COLUMN "selectedQuoteSlotNumber" INTEGER;

ALTER TABLE "ProjectDocument"
ADD COLUMN "purchaseOrderId" TEXT,
ADD COLUMN "searchText" TEXT;

ALTER TABLE "PurchaseOrder"
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "freightType" TEXT,
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "responsibleName" TEXT,
ADD COLUMN "responsiblePhone" TEXT,
ADD COLUMN "expectedDeliveryDate" TIMESTAMP(3),
ADD COLUMN "generatedDocumentId" TEXT;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_selectedQuoteSlotNumber_check"
CHECK ("selectedQuoteSlotNumber" IS NULL OR "selectedQuoteSlotNumber" BETWEEN 1 AND 3);

CREATE UNIQUE INDEX "PurchaseOrder_generatedDocumentId_key" ON "PurchaseOrder"("generatedDocumentId");
CREATE INDEX "ProjectDocument_purchaseOrderId_idx" ON "ProjectDocument"("purchaseOrderId");

ALTER TABLE "ProjectDocument"
ADD CONSTRAINT "ProjectDocument_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
ADD CONSTRAINT "PurchaseOrder_generatedDocumentId_fkey"
FOREIGN KEY ("generatedDocumentId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
