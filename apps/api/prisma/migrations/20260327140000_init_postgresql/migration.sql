-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PLANNED', 'ACTIVE', 'ON_HOLD', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImplementationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NOTICE', 'TERMS_OF_REFERENCE', 'IMPLEMENTATION_MAP', 'COST_SPREADSHEET', 'CONTROL_SPREADSHEET', 'OTHER_ATTACHMENT');

-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWED', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExtractedFieldReviewStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'CORRECTED', 'REJECTED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "ExtractedTargetType" AS ENUM ('PROJECT', 'PROJECT_ROLE', 'BUDGET_ITEM');

-- CreateEnum
CREATE TYPE "DataOriginType" AS ENUM ('MANUAL', 'DOCUMENT_EXTRACTED');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('UNIFORM', 'EPI', 'EQUIPMENT', 'CONSUMABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('TO_START', 'QUOTING', 'UNDER_REVIEW', 'APPROVAL_PENDING', 'APPROVED', 'PAYMENT_PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_SCHEDULED', 'SCHEDULED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReplenishmentTriggerType" AS ENUM ('FROM_DELIVERY', 'FROM_PROJECT_START', 'FROM_LAST_REPLENISHMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "IntervalUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('DOCUMENTATION', 'TEAM', 'UNIFORMS', 'EPI', 'EQUIPMENT', 'TRAINING', 'TIME_TRACKING', 'COMPLIANCE', 'GENERAL');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "procurementProcessNumber" TEXT,
    "bidNumber" TEXT,
    "contractNumber" TEXT,
    "city" TEXT,
    "state" TEXT,
    "objectSummary" TEXT,
    "projectStatus" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "implementationStatus" "ImplementationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "plannedSignatureDate" TIMESTAMP(3),
    "plannedStartDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "contractDurationMonths" INTEGER NOT NULL DEFAULT 12,
    "monthlyContractValue" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "checksum" TEXT,
    "documentDate" TIMESTAMP(3),
    "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "processingError" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "projectDocumentId" TEXT NOT NULL,
    "targetType" "ExtractedTargetType" NOT NULL,
    "recordGroupKey" TEXT,
    "fieldKey" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "confirmedValue" TEXT,
    "sourcePage" INTEGER,
    "sourceSheetName" TEXT,
    "sourceCellRef" TEXT,
    "sourceExcerpt" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "reviewStatus" "ExtractedFieldReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRole" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "cboCode" TEXT,
    "workRegime" TEXT,
    "workloadLabel" TEXT,
    "allocationSector" TEXT,
    "plannedPositions" INTEGER,
    "employeesPerPosition" INTEGER,
    "plannedHeadcount" INTEGER NOT NULL,
    "sourceType" "DataOriginType" NOT NULL DEFAULT 'MANUAL',
    "sourceDocumentId" TEXT,
    "sourceSheetName" TEXT,
    "sourceCellRef" TEXT,
    "sourcePage" INTEGER,
    "sourceExcerpt" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "itemCategory" "ItemCategory" NOT NULL,
    "subcategory" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "specification" TEXT,
    "unit" TEXT,
    "sizeLabel" TEXT,
    "requiresCa" BOOLEAN,
    "roleReference" TEXT,
    "allocationSector" TEXT,
    "plannedQuantity" DECIMAL(65,30),
    "bidUnitValue" DECIMAL(65,30),
    "rubricMaxValue" DECIMAL(65,30),
    "purchasedValue" DECIMAL(65,30),
    "hasBidReference" BOOLEAN NOT NULL DEFAULT true,
    "contextOnly" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" "DataOriginType" NOT NULL DEFAULT 'MANUAL',
    "sourceDocumentId" TEXT,
    "sourceSheetName" TEXT,
    "sourceCellRef" TEXT,
    "sourcePage" INTEGER,
    "sourceExcerpt" TEXT,
    "notes" TEXT,
    "priority" TEXT,
    "peopleCount" INTEGER,
    "operationalPurchaseStatus" TEXT,
    "editalDeliveryDeadlineDays" INTEGER,
    "replenishmentPeriodDaysEdital" INTEGER,
    "approvedSupplierName" TEXT,
    "glpiTicketNumber" TEXT,
    "opPaymentSentAt" TIMESTAMP(3),
    "opExpectedDeliveryAt" TIMESTAMP(3),
    "opDeliveredAt" TIMESTAMP(3),
    "operationalStagesStatus" TEXT,
    "nextReplenishmentExpectedAt" TIMESTAMP(3),
    "replenishmentStateLabel" TEXT,
    "competenceLabel" TEXT,
    "administrativeFeePercent" DECIMAL(65,30),
    "actualUnitValue" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplementationTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dueDate" TIMESTAMP(3),
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplementationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "documentNumber" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseStatus" "PurchaseStatus" NOT NULL DEFAULT 'TO_START',
    "purchaseDate" TIMESTAMP(3),
    "internalReference" TEXT,
    "glpiNumber" TEXT,
    "paymentSentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "quantityPurchased" DECIMAL(65,30) NOT NULL,
    "realUnitValue" DECIMAL(65,30) NOT NULL,
    "expectedDeliveryDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentRule" (
    "id" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "triggerType" "ReplenishmentTriggerType" NOT NULL,
    "intervalUnit" "IntervalUnit" NOT NULL,
    "intervalValue" INTEGER NOT NULL,
    "warningDays" INTEGER NOT NULL DEFAULT 30,
    "baseDate" TIMESTAMP(3),
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentEvent" (
    "id" TEXT NOT NULL,
    "replenishmentRuleId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "baseDateUsed" TIMESTAMP(3) NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_organizationName_idx" ON "Project"("organizationName");

-- CreateIndex
CREATE INDEX "Project_bidNumber_idx" ON "Project"("bidNumber");

-- CreateIndex
CREATE INDEX "Project_projectStatus_idx" ON "Project"("projectStatus");

-- CreateIndex
CREATE INDEX "Project_implementationStatus_idx" ON "Project"("implementationStatus");

-- CreateIndex
CREATE INDEX "Project_plannedStartDate_idx" ON "Project"("plannedStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationName_procurementProcessNumber_key" ON "Project"("organizationName", "procurementProcessNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationName_contractNumber_key" ON "Project"("organizationName", "contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocument_storagePath_key" ON "ProjectDocument"("storagePath");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_documentType_idx" ON "ProjectDocument"("projectId", "documentType");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_originalFileName_idx" ON "ProjectDocument"("projectId", "originalFileName");

-- CreateIndex
CREATE INDEX "ProjectDocument_processingStatus_idx" ON "ProjectDocument"("processingStatus");

-- CreateIndex
CREATE INDEX "ProjectDocument_reviewStatus_idx" ON "ProjectDocument"("reviewStatus");

-- CreateIndex
CREATE INDEX "ProjectDocument_checksum_idx" ON "ProjectDocument"("checksum");

-- CreateIndex
CREATE INDEX "ExtractedField_projectDocumentId_idx" ON "ExtractedField"("projectDocumentId");

-- CreateIndex
CREATE INDEX "ExtractedField_targetType_idx" ON "ExtractedField"("targetType");

-- CreateIndex
CREATE INDEX "ExtractedField_reviewStatus_idx" ON "ExtractedField"("reviewStatus");

-- CreateIndex
CREATE INDEX "ExtractedField_recordGroupKey_idx" ON "ExtractedField"("recordGroupKey");

-- CreateIndex
CREATE INDEX "ExtractedField_fieldKey_idx" ON "ExtractedField"("fieldKey");

-- CreateIndex
CREATE INDEX "ExtractedField_projectDocumentId_targetType_recordGroupKey_idx" ON "ExtractedField"("projectDocumentId", "targetType", "recordGroupKey");

-- CreateIndex
CREATE INDEX "ProjectRole_projectId_idx" ON "ProjectRole"("projectId");

-- CreateIndex
CREATE INDEX "ProjectRole_projectId_roleName_idx" ON "ProjectRole"("projectId", "roleName");

-- CreateIndex
CREATE INDEX "ProjectRole_sourceDocumentId_idx" ON "ProjectRole"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "BudgetItem_projectId_idx" ON "BudgetItem"("projectId");

-- CreateIndex
CREATE INDEX "BudgetItem_projectId_name_idx" ON "BudgetItem"("projectId", "name");

-- CreateIndex
CREATE INDEX "BudgetItem_projectId_itemCategory_idx" ON "BudgetItem"("projectId", "itemCategory");

-- CreateIndex
CREATE INDEX "BudgetItem_itemCategory_idx" ON "BudgetItem"("itemCategory");

-- CreateIndex
CREATE INDEX "BudgetItem_hasBidReference_idx" ON "BudgetItem"("hasBidReference");

-- CreateIndex
CREATE INDEX "BudgetItem_sourceDocumentId_idx" ON "BudgetItem"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "ImplementationTask_projectId_idx" ON "ImplementationTask"("projectId");

-- CreateIndex
CREATE INDEX "ImplementationTask_projectId_category_idx" ON "ImplementationTask"("projectId", "category");

-- CreateIndex
CREATE INDEX "ImplementationTask_status_idx" ON "ImplementationTask"("status");

-- CreateIndex
CREATE INDEX "ImplementationTask_sourceDocumentId_idx" ON "ImplementationTask"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_documentNumber_key" ON "Supplier"("documentNumber");

-- CreateIndex
CREATE INDEX "Supplier_legalName_idx" ON "Supplier"("legalName");

-- CreateIndex
CREATE INDEX "PurchaseOrder_projectId_idx" ON "PurchaseOrder"("projectId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_purchaseStatus_idx" ON "PurchaseOrder"("purchaseStatus");

-- CreateIndex
CREATE INDEX "PurchaseOrder_purchaseDate_idx" ON "PurchaseOrder"("purchaseDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_paymentSentAt_idx" ON "PurchaseOrder"("paymentSentAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_internalReference_idx" ON "PurchaseOrder"("internalReference");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_projectId_glpiNumber_key" ON "PurchaseOrder"("projectId", "glpiNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_budgetItemId_idx" ON "PurchaseOrderItem"("budgetItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_deliveryStatus_idx" ON "PurchaseOrderItem"("deliveryStatus");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_expectedDeliveryDate_idx" ON "PurchaseOrderItem"("expectedDeliveryDate");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_deliveredAt_idx" ON "PurchaseOrderItem"("deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentRule_budgetItemId_key" ON "ReplenishmentRule"("budgetItemId");

-- CreateIndex
CREATE INDEX "ReplenishmentRule_isEnabled_idx" ON "ReplenishmentRule"("isEnabled");

-- CreateIndex
CREATE INDEX "ReplenishmentEvent_plannedDate_idx" ON "ReplenishmentEvent"("plannedDate");

-- CreateIndex
CREATE INDEX "ReplenishmentEvent_completedDate_idx" ON "ReplenishmentEvent"("completedDate");

-- CreateIndex
CREATE INDEX "ReplenishmentEvent_purchaseOrderItemId_idx" ON "ReplenishmentEvent"("purchaseOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentEvent_replenishmentRuleId_plannedDate_key" ON "ReplenishmentEvent"("replenishmentRuleId", "plannedDate");

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_projectDocumentId_fkey" FOREIGN KEY ("projectDocumentId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRole" ADD CONSTRAINT "ProjectRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRole" ADD CONSTRAINT "ProjectRole_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationTask" ADD CONSTRAINT "ImplementationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationTask" ADD CONSTRAINT "ImplementationTask_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ProjectDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRule" ADD CONSTRAINT "ReplenishmentRule_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentEvent" ADD CONSTRAINT "ReplenishmentEvent_replenishmentRuleId_fkey" FOREIGN KEY ("replenishmentRuleId") REFERENCES "ReplenishmentRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentEvent" ADD CONSTRAINT "ReplenishmentEvent_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
