-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "procurementProcessNumber" TEXT,
    "bidNumber" TEXT,
    "contractNumber" TEXT,
    "city" TEXT,
    "state" TEXT,
    "objectSummary" TEXT,
    "projectStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "implementationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "plannedSignatureDate" DATETIME,
    "plannedStartDate" DATETIME,
    "actualStartDate" DATETIME,
    "contractDurationMonths" INTEGER NOT NULL DEFAULT 12,
    "monthlyContractValue" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "checksum" TEXT,
    "documentDate" DATETIME,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "processingError" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectDocumentId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "recordGroupKey" TEXT,
    "fieldKey" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "confirmedValue" TEXT,
    "sourcePage" INTEGER,
    "sourceSheetName" TEXT,
    "sourceCellRef" TEXT,
    "sourceExcerpt" TEXT,
    "confidenceScore" REAL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtractedField_projectDocumentId_fkey" FOREIGN KEY ("projectDocumentId") REFERENCES "ProjectDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "cboCode" TEXT,
    "workRegime" TEXT,
    "workloadLabel" TEXT,
    "allocationSector" TEXT,
    "plannedPositions" INTEGER,
    "employeesPerPosition" INTEGER,
    "plannedHeadcount" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceDocumentId" TEXT,
    "sourceSheetName" TEXT,
    "sourceCellRef" TEXT,
    "sourcePage" INTEGER,
    "sourceExcerpt" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectRole_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ProjectDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "itemCategory" TEXT NOT NULL,
    "subcategory" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "specification" TEXT,
    "unit" TEXT,
    "sizeLabel" TEXT,
    "requiresCa" BOOLEAN,
    "roleReference" TEXT,
    "allocationSector" TEXT,
    "plannedQuantity" DECIMAL,
    "bidUnitValue" DECIMAL,
    "hasBidReference" BOOLEAN NOT NULL DEFAULT true,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceDocumentId" TEXT,
    "sourceSheetName" TEXT,
    "sourceCellRef" TEXT,
    "sourcePage" INTEGER,
    "sourceExcerpt" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetItem_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ProjectDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalName" TEXT NOT NULL,
    "documentNumber" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseStatus" TEXT NOT NULL DEFAULT 'TO_START',
    "purchaseDate" DATETIME,
    "internalReference" TEXT,
    "glpiNumber" TEXT,
    "paymentSentAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "quantityPurchased" DECIMAL NOT NULL,
    "realUnitValue" DECIMAL NOT NULL,
    "expectedDeliveryDate" DATETIME,
    "deliveredAt" DATETIME,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'NOT_SCHEDULED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReplenishmentRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetItemId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "intervalUnit" TEXT NOT NULL,
    "intervalValue" INTEGER NOT NULL,
    "warningDays" INTEGER NOT NULL DEFAULT 30,
    "baseDate" DATETIME,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReplenishmentRule_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReplenishmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "replenishmentRuleId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "baseDateUsed" DATETIME NOT NULL,
    "plannedDate" DATETIME NOT NULL,
    "completedDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReplenishmentEvent_replenishmentRuleId_fkey" FOREIGN KEY ("replenishmentRuleId") REFERENCES "ReplenishmentRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReplenishmentEvent_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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

