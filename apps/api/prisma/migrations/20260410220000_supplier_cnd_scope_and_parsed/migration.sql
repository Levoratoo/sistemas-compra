-- CreateEnum
CREATE TYPE "SupplierCndScope" AS ENUM ('FEDERAL', 'STATE');

-- AlterTable
ALTER TABLE "SupplierCndAttachment" ADD COLUMN "scope" "SupplierCndScope" NOT NULL DEFAULT 'FEDERAL',
ADD COLUMN "parsedIssuedAt" TIMESTAMP(3),
ADD COLUMN "parsedValidUntil" TIMESTAMP(3),
ADD COLUMN "parsedControlCode" TEXT;

CREATE INDEX "SupplierCndAttachment_supplierId_scope_idx" ON "SupplierCndAttachment"("supplierId", "scope");
