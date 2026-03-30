-- CreateTable
CREATE TABLE "MissingItemReportAttachment" (
    "id" TEXT NOT NULL,
    "missingItemReportId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissingItemReportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissingItemReportAttachment_storagePath_key" ON "MissingItemReportAttachment"("storagePath");

-- CreateIndex
CREATE INDEX "MissingItemReportAttachment_missingItemReportId_idx" ON "MissingItemReportAttachment"("missingItemReportId");

-- AddForeignKey
ALTER TABLE "MissingItemReportAttachment" ADD CONSTRAINT "MissingItemReportAttachment_missingItemReportId_fkey" FOREIGN KEY ("missingItemReportId") REFERENCES "MissingItemReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
