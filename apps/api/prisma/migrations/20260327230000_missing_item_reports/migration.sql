-- CreateEnum
CREATE TYPE "MissingItemUrgency" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "OwnerApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MissingItemReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "itemToAcquire" TEXT NOT NULL,
    "estimatedQuantity" TEXT NOT NULL,
    "necessityReason" TEXT NOT NULL,
    "urgencyLevel" "MissingItemUrgency" NOT NULL,
    "ownerApprovalStatus" "OwnerApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "ownerApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissingItemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissingItemReport_projectId_idx" ON "MissingItemReport"("projectId");

-- CreateIndex
CREATE INDEX "MissingItemReport_projectId_requestDate_idx" ON "MissingItemReport"("projectId", "requestDate");

-- AddForeignKey
ALTER TABLE "MissingItemReport" ADD CONSTRAINT "MissingItemReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
