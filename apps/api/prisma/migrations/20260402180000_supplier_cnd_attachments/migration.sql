-- CreateTable
CREATE TABLE "SupplierCndAttachment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "masterStoragePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCndAttachment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ProjectDocument" ADD COLUMN "supplierCndAttachmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCndAttachment_masterStoragePath_key" ON "SupplierCndAttachment"("masterStoragePath");

-- CreateIndex
CREATE INDEX "SupplierCndAttachment_supplierId_idx" ON "SupplierCndAttachment"("supplierId");

-- CreateIndex
CREATE INDEX "ProjectDocument_supplierCndAttachmentId_idx" ON "ProjectDocument"("supplierCndAttachmentId");

-- AddForeignKey
ALTER TABLE "SupplierCndAttachment" ADD CONSTRAINT "SupplierCndAttachment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_supplierCndAttachmentId_fkey" FOREIGN KEY ("supplierCndAttachmentId") REFERENCES "SupplierCndAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
