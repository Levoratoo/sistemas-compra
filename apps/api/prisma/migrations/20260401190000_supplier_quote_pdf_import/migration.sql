ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SUPPLIER_QUOTE_PDF';

ALTER TABLE "ProjectDocument"
ADD COLUMN "previewJson" JSONB;

ALTER TABLE "BudgetItem"
ADD COLUMN "supplierQuoteExtraItem" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProjectQuote"
ADD COLUMN "latestImportedDocumentId" TEXT;

CREATE INDEX "ProjectQuote_latestImportedDocumentId_idx" ON "ProjectQuote"("latestImportedDocumentId");

ALTER TABLE "ProjectQuote"
ADD CONSTRAINT "ProjectQuote_latestImportedDocumentId_fkey"
FOREIGN KEY ("latestImportedDocumentId") REFERENCES "ProjectDocument"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
