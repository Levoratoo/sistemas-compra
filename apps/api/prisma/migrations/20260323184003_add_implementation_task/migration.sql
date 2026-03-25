-- CreateTable
CREATE TABLE "ImplementationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "dueDate" DATETIME,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImplementationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImplementationTask_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ProjectDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImplementationTask_projectId_idx" ON "ImplementationTask"("projectId");

-- CreateIndex
CREATE INDEX "ImplementationTask_projectId_category_idx" ON "ImplementationTask"("projectId", "category");

-- CreateIndex
CREATE INDEX "ImplementationTask_status_idx" ON "ImplementationTask"("status");

-- CreateIndex
CREATE INDEX "ImplementationTask_sourceDocumentId_idx" ON "ImplementationTask"("sourceDocumentId");
