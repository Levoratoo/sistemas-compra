-- CreateTable
CREATE TABLE "ProjectDocumentFolder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocumentFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ProjectDocument" ADD COLUMN "folderId" TEXT;

-- CreateIndex
CREATE INDEX "ProjectDocumentFolder_projectId_idx" ON "ProjectDocumentFolder"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDocumentFolder_projectId_parentId_idx" ON "ProjectDocumentFolder"("projectId", "parentId");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_folderId_idx" ON "ProjectDocument"("projectId", "folderId");

-- AddForeignKey
ALTER TABLE "ProjectDocumentFolder" ADD CONSTRAINT "ProjectDocumentFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocumentFolder" ADD CONSTRAINT "ProjectDocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectDocumentFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ProjectDocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
