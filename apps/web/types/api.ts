import type { FolderSurfaceStyle } from '@/lib/folder-appearance';

export type { FolderSurfaceStyle };

export type ProjectStatus = 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'CLOSED' | 'CANCELLED';
export type ImplementationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
export type DocumentType =
  | 'NOTICE'
  | 'TERMS_OF_REFERENCE'
  | 'IMPLEMENTATION_MAP'
  | 'COST_SPREADSHEET'
  | 'CONTROL_SPREADSHEET'
  | 'PURCHASE_ORDER_PDF'
  | 'SUPPLIER_QUOTE_PDF'
  | 'OTHER_ATTACHMENT';
export type DocumentProcessingStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
export type DocumentReviewStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'CONFLICT' | 'REJECTED';
export type ExtractedFieldReviewStatus =
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'CORRECTED'
  | 'REJECTED'
  | 'CONFLICT';
export type ExtractedTargetType = 'PROJECT' | 'PROJECT_ROLE' | 'BUDGET_ITEM';
export type DataOriginType = 'MANUAL' | 'DOCUMENT_EXTRACTED';
export type ItemCategory = 'UNIFORM' | 'EPI' | 'EQUIPMENT' | 'CONSUMABLE' | 'OTHER';

/** Tarefas de implantação (checklist) — distinto de `ImplementationStatus` do projeto */
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
export type TaskCategory =
  | 'DOCUMENTATION'
  | 'TEAM'
  | 'UNIFORMS'
  | 'EPI'
  | 'EQUIPMENT'
  | 'TRAINING'
  | 'TIME_TRACKING'
  | 'COMPLIANCE'
  | 'GENERAL';

export interface ImplementationTask extends EntityTimestamps {
  id: string;
  projectId: string;
  title: string;
  category: TaskCategory;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  sourceDocumentId: string | null;
  sourcePage: number | null;
  notes: string | null;
}

export interface MissingItemReportAttachment {
  id: string;
  missingItemReportId: string;
  originalFileName: string;
  storagePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string | null;
}

export interface MissingItemReport extends EntityTimestamps {
  id: string;
  projectId: string;
  requesterName: string;
  requestDate: string | null;
  itemToAcquire: string;
  estimatedQuantity: string;
  necessityReason: string;
  urgencyLevel: MissingItemUrgency;
  ownerApprovalStatus: OwnerApprovalStatus;
  ownerApprovedAt: string | null;
  /** Preenchido pelo aprovador ao rejeitar (motivo). */
  ownerRejectionNote: string | null;
  attachments: MissingItemReportAttachment[];
}

/** Solicitação na fila global de aprovação (GET pending-approval), com dados do contrato. */
export interface PendingMissingItemApproval extends MissingItemReport {
  project: { id: string; code: string; name: string };
}
export type PurchaseStatus =
  | 'TO_START'
  | 'QUOTING'
  | 'UNDER_REVIEW'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'PAYMENT_PENDING'
  | 'COMPLETED'
  | 'CANCELLED';
export type DeliveryStatus =
  | 'NOT_SCHEDULED'
  | 'SCHEDULED'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'DELAYED'
  | 'CANCELLED';
export type ReplenishmentTriggerType =
  | 'FROM_DELIVERY'
  | 'FROM_PROJECT_START'
  | 'FROM_LAST_REPLENISHMENT'
  | 'MANUAL';
export type IntervalUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type ReplenishmentDerivedStatus =
  | 'DISABLED'
  | 'PENDING_BASE_DATE'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'UPCOMING'
  | 'SCHEDULED';

export type MissingItemUrgency = 'HIGH' | 'MEDIUM' | 'LOW';
export type OwnerApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SupplierCndStatus = 'MISSING' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export interface EntityTimestamps {
  createdAt: string | null;
  updatedAt: string | null;
}

export type UserRole = 'ADMIN' | 'USER' | 'APPROVER' | 'SUPERVISOR';

export type NotificationType = 'REPLENISHMENT_DUE_SOON';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  projectId: string;
  budgetItemId: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ReleasedProjectSummary {
  id: string;
  code: string;
  name: string;
}

export interface AuthUser extends EntityTimestamps {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  releasedProjects: ReleasedProjectSummary[];
}

export interface Project extends EntityTimestamps {
  id: string;
  code: string;
  name: string;
  organizationName: string;
  procurementProcessNumber: string | null;
  bidNumber: string | null;
  contractNumber: string | null;
  city: string | null;
  state: string | null;
  objectSummary: string | null;
  projectStatus: ProjectStatus;
  implementationStatus: ImplementationStatus;
  plannedSignatureDate: string | null;
  plannedStartDate: string | null;
  actualStartDate: string | null;
  contractDurationMonths: number;
  monthlyContractValue: number | null;
  selectedQuoteSlotNumber: number | null;
  notes: string | null;
}

export interface ProjectListItem extends Project {
  counts: {
    documents: number;
    roles: number;
    budgetItems: number;
    purchaseOrders: number;
    implementationTasks: number;
  };
}

export interface ExtractedField extends EntityTimestamps {
  id: string;
  projectDocumentId: string;
  targetType: ExtractedTargetType;
  recordGroupKey: string | null;
  fieldKey: string;
  proposedValue: string;
  confirmedValue: string | null;
  sourcePage: number | null;
  sourceSheetName: string | null;
  sourceCellRef: string | null;
  sourceExcerpt: string | null;
  confidenceScore: number | null;
  reviewStatus: ExtractedFieldReviewStatus;
  reviewNote: string | null;
}

export interface ProjectDocumentFolder extends EntityTimestamps {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  /** Cor do destaque da pasta (#RRGGBB) */
  colorHex: string;
  /** Segunda cor para degradê / radial (#RRGGBB) */
  colorHex2?: string;
  /** Emoji opcional como ícone */
  iconEmoji: string | null;
  /** Aparência do cartão (sólido / degradê / radial) */
  surfaceStyle?: FolderSurfaceStyle;
}

export interface ProjectDocument extends EntityTimestamps {
  id: string;
  projectId: string;
  folderId: string | null;
  purchaseOrderId: string | null;
  documentType: DocumentType;
  originalFileName: string;
  storagePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  checksum: string | null;
  documentDate: string | null;
  searchText?: string | null;
  previewJson?: unknown | null;
  processingStatus: DocumentProcessingStatus;
  reviewStatus: DocumentReviewStatus;
  processingError: string | null;
  notes: string | null;
  folderPathLabel?: string | null;
  extractedFields: ExtractedField[];
}

export interface ProjectRole extends EntityTimestamps {
  id: string;
  projectId: string;
  roleName: string;
  cboCode: string | null;
  workRegime: string | null;
  workloadLabel: string | null;
  allocationSector: string | null;
  plannedPositions: number | null;
  employeesPerPosition: number | null;
  plannedHeadcount: number;
  sourceType: DataOriginType;
  sourceDocumentId: string | null;
  sourceSheetName: string | null;
  sourceCellRef: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  notes: string | null;
}

export interface Supplier extends EntityTimestamps {
  id: string;
  legalName: string;
  tradeName: string | null;
  documentNumber: string | null;
  contactName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  cnd: string | null;
  cndIssuedAt: string | null;
  cndValidUntil: string | null;
  cndControlCode: string | null;
  cndSourceFileName: string | null;
  cndStatus: SupplierCndStatus;
  cndDaysUntilExpiration: number | null;
  notes: string | null;
}

export type ProjectQuoteWinnerStatus = 'NONE' | 'UNIQUE' | 'TIE';

export interface ProjectQuoteRowValue {
  projectQuoteId: string;
  slotNumber: number;
  supplierId: string | null;
  supplierName: string | null;
  unitPrice: number | null;
  totalValue: number | null;
  notes: string | null;
  updatedAt: string | null;
}

export interface ProjectQuoteRow {
  budgetItemId: string;
  description: string;
  specification: string | null;
  quantity: number | null;
  unit: string | null;
  itemCategory: ItemCategory;
  supplierQuoteExtraItem: boolean;
  values: ProjectQuoteRowValue[];
  winner: {
    status: ProjectQuoteWinnerStatus;
    slotNumbers: number[];
    unitPrice: number | null;
    totalValue: number | null;
  };
}

export interface ProjectQuoteSlot extends EntityTimestamps {
  id: string;
  projectId: string;
  slotNumber: number;
  supplierId: string | null;
  supplier: Supplier | null;
  itemCount: number;
  filledItemCount: number;
  totalValue: number | null;
  isComplete: boolean;
  latestImportedDocument: ProjectDocument | null;
}

export interface ProjectQuoteComparison {
  slotTotals: Array<{
    slotNumber: number;
    supplierId: string | null;
    supplierName: string | null;
    totalValue: number | null;
    itemCount: number;
    filledItemCount: number;
    isComplete: boolean;
  }>;
  overallWinner: {
    status: ProjectQuoteWinnerStatus;
    slotNumbers: number[];
    totalValue: number | null;
  };
  resolvedRowCount: number;
  tieRowCount: number;
  unresolvedRowCount: number;
  analysis: {
    headline: string;
    summaryLines: string[];
    bestSlotNumbers: number[];
    bestSupplierNames: string[];
    bestTotalValue: number | null;
    secondBestTotalValue: number | null;
    savingsValue: number | null;
    savingsPercent: number | null;
    completeSlotCount: number;
    itemWinnerCounts: Array<{
      slotNumber: number;
      supplierId: string | null;
      supplierName: string | null;
      totalValue: number | null;
      itemCount: number;
      filledItemCount: number;
      isComplete: boolean;
      uniqueWinCount: number;
      tieCount: number;
    }>;
  };
}

export interface ProjectQuoteState extends EntityTimestamps {
  id: string;
  projectId: string;
  title: string;
  notes: string | null;
  slots: ProjectQuoteSlot[];
  rows: ProjectQuoteRow[];
  comparison: ProjectQuoteComparison;
}

export interface ProjectQuotesState {
  projectId: string;
  purchases: ProjectQuoteState[];
}

export type ProjectQuoteImportMatchConfidence = 'HIGH' | 'REVIEW' | 'UNMATCHED';
export type ProjectQuoteImportAction = 'APPLY' | 'IGNORE' | 'CREATE_EXTRA';
export type ProjectQuoteImportExtractionMode = 'DIRECT_TEXT' | 'OCR';

/** Coerência entre quantidade × unitário e total extraído (para filtro na revisão). */
export type ProjectQuoteImportPriceIntegrity = 'consistent' | 'inconsistent' | 'insufficient_data';

export interface ProjectQuoteImportExtractionDiagnostics {
  fullTextCharCount: number;
  nonEmptyLineCount: number;
  linesWithLetterAndDigitCount: number;
  parsedRowCount: number;
  unitBreakdown: Record<string, number>;
  rowsWithConsistentArithmetic: number;
  rowsWithInconsistentArithmetic: number;
  rowsWithInsufficientDataForArithmetic: number;
}

export interface ProjectQuoteImportCandidateMatch {
  budgetItemId: string;
  name: string;
  specification: string | null;
  score: number;
}

export interface ProjectQuoteImportRow {
  rowIndex: number;
  rawText: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalValue: number | null;
  priceIntegrity?: ProjectQuoteImportPriceIntegrity;
  confidence: ProjectQuoteImportMatchConfidence;
  quantityConflict: boolean;
  matchedBudgetItemId: string | null;
  matchedBudgetItemName: string | null;
  matchScore: number | null;
  suggestedAction: ProjectQuoteImportAction;
  requiresNameValidation: boolean;
  candidateMatches: ProjectQuoteImportCandidateMatch[];
}

export interface ProjectQuoteImportPreview {
  projectId: string;
  purchaseId: string;
  slotNumber: number;
  supplierId: string;
  supplierName: string;
  extractionMode: ProjectQuoteImportExtractionMode;
  quoteNumber: string | null;
  quoteDate: string | null;
  detectedSupplierName: string | null;
  document: ProjectDocument;
  rows: ProjectQuoteImportRow[];
  summary: {
    rowCount: number;
    highConfidenceCount: number;
    reviewCount: number;
    unmatchedCount: number;
    extraCandidateCount: number;
    hasExistingValues: boolean;
  };
  extractionDiagnostics?: ProjectQuoteImportExtractionDiagnostics;
}

export interface ProjectQuoteImportApplyRow {
  rowIndex: number;
  action: ProjectQuoteImportAction;
  matchedBudgetItemId?: string | null;
}

export interface ProjectQuoteImportApplyPayload {
  confirmReplace?: boolean;
  rows: ProjectQuoteImportApplyRow[];
}

export interface ProjectQuotePurchaseOrderResult {
  purchaseId: string;
  purchaseTitle: string;
  generatedOrders: Array<{
    supplierId: string;
    supplierName: string;
    itemCount: number;
    totalValue: number;
    purchaseOrderId: string;
    documentId: string;
    documentFileName: string;
    folderPathLabel: string | null;
  }>;
  skippedItems: number;
}

export interface ProjectQuoteComparisonReportResult {
  purchaseId: string;
  purchaseTitle: string;
  documentId: string;
  documentFileName: string;
  folderPathLabel: string | null;
  analysis: ProjectQuoteComparison['analysis'];
}

export interface PurchaseOrderItem extends EntityTimestamps {
  id: string;
  purchaseOrderId: string;
  budgetItemId: string;
  quantityPurchased: number;
  realUnitValue: number;
  expectedDeliveryDate: string | null;
  deliveredAt: string | null;
  deliveryStatus: DeliveryStatus;
  notes: string | null;
  realTotalValue?: number;
  budgetTotalValue?: number | null;
  savingsValue?: number | null;
  isAboveBudget?: boolean;
}

export interface ReplenishmentEvent extends EntityTimestamps {
  id: string;
  replenishmentRuleId: string;
  purchaseOrderItemId: string | null;
  baseDateUsed: string | null;
  plannedDate: string | null;
  completedDate: string | null;
  notes: string | null;
  purchaseOrderItem?: PurchaseOrderItem | null;
}

export interface BudgetItem extends EntityTimestamps {
  id: string;
  projectId: string;
  itemCategory: ItemCategory;
  subcategory: string | null;
  name: string;
  description: string | null;
  specification: string | null;
  unit: string | null;
  sizeLabel: string | null;
  requiresCa: boolean | null;
  roleReference: string | null;
  allocationSector: string | null;
  plannedQuantity: number | null;
  bidUnitValue: number | null;
  /** Teto da rubrica (valor máximo permitido para comprar o item). */
  rubricMaxValue: number | null;
  /** Valor efetivamente comprado / gasto. */
  purchasedValue: number | null;
  hasBidReference: boolean;
  /** Trecho do edital só para referência (sem compra/valores). */
  contextOnly?: boolean;
  supplierQuoteExtraItem: boolean;
  sourceType: DataOriginType;
  sourceDocumentId: string | null;
  sourceSheetName: string | null;
  sourceCellRef: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  notes: string | null;
  /** Fase 2 — controle operacional (planilha) */
  priority: string | null;
  peopleCount: number | null;
  operationalPurchaseStatus: string | null;
  editalDeliveryDeadlineDays: number | null;
  replenishmentPeriodDaysEdital: number | null;
  approvedSupplierName: string | null;
  glpiTicketNumber: string | null;
  opPaymentSentAt: string | null;
  opExpectedDeliveryAt: string | null;
  opDeliveredAt: string | null;
  operationalStagesStatus: string | null;
  nextReplenishmentExpectedAt: string | null;
  replenishmentStateLabel: string | null;
  competenceLabel: string | null;
  administrativeFeePercent: number | null;
  actualUnitValue: number | null;
  /** Ordenação na grelha de controle de compras (menor = mais acima). */
  purchaseControlSortRank?: number;
  replenishmentCycleConfirmedAt: string | null;
  replenishmentContinuesAsItemId: string | null;
  bidTotalValue: number | null;
  realTotalValue: number;
  savingsValue: number | null;
  sourceDocument: { id: string; originalFileName: string; documentType: DocumentType } | null;
  purchaseOrderItems: Array<
    PurchaseOrderItem & {
      purchaseOrder: {
        id: string;
        supplier: Supplier | null;
      };
    }
  >;
  replenishmentRule: {
    id: string;
    triggerType: ReplenishmentTriggerType;
    intervalUnit: IntervalUnit;
    intervalValue: number;
    warningDays: number;
    baseDate: string | null;
    isEnabled: boolean;
    notes: string | null;
    events: ReplenishmentEvent[];
  } | null;
}

export interface PurchaseOrder extends EntityTimestamps {
  id: string;
  projectId: string;
  supplierId: string | null;
  purchaseStatus: PurchaseStatus;
  purchaseDate: string | null;
  internalReference: string | null;
  glpiNumber: string | null;
  deliveryAddress: string | null;
  freightType: string | null;
  paymentTerms: string | null;
  responsibleName: string | null;
  responsiblePhone: string | null;
  expectedDeliveryDate: string | null;
  paymentSentAt: string | null;
  notes: string | null;
  supplier: Supplier | null;
  generatedDocument: {
    id: string;
    originalFileName: string;
  } | null;
  items: Array<
    PurchaseOrderItem & {
      budgetItem: Pick<BudgetItem, 'id' | 'name' | 'itemCategory' | 'bidUnitValue' | 'hasBidReference'>;
    }
  >;
  totalRealValue: number;
  totalBudgetValue: number;
}

export interface ReplenishmentRule extends EntityTimestamps {
  id: string;
  budgetItemId: string;
  triggerType: ReplenishmentTriggerType;
  intervalUnit: IntervalUnit;
  intervalValue: number;
  warningDays: number;
  baseDate: string | null;
  isEnabled: boolean;
  notes: string | null;
  status: ReplenishmentDerivedStatus;
  budgetItem: BudgetItem;
  nextEvent: ReplenishmentEvent | null;
  events: ReplenishmentEvent[];
}

export interface ProjectDetail extends Project {
  documents: ProjectDocument[];
  roles: ProjectRole[];
  budgetItems: BudgetItem[];
  purchaseOrders: PurchaseOrder[];
  implementationTasks: ImplementationTask[];
  counts: {
    documents: number;
    roles: number;
    budgetItems: number;
    purchaseOrders: number;
    implementationTasks: number;
  };
}

export interface ProjectDashboard {
  project: {
    id: string;
    code: string;
    name: string;
    organizationName: string;
    projectStatus: ProjectStatus;
    implementationStatus: ImplementationStatus;
  };
  totalPlanned: number;
  totalRealized: number;
  savings: number;
  itemsWithoutBidReference: Array<{
    id: string;
    name: string;
    itemCategory: ItemCategory;
  }>;
  upcomingEvents: Array<{
    budgetItemId: string;
    budgetItemName: string;
    plannedDate: string | null;
    warningDays: number;
  }>;
  alerts: Array<{
    type: 'ITEM_ABOVE_BID' | 'ITEM_WITHOUT_BID_REFERENCE' | 'REPLENISHMENT_OVERDUE' | 'REPLENISHMENT_UPCOMING';
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    message: string;
    projectId: string;
    budgetItemId?: string;
    purchaseOrderItemId?: string;
    plannedDate?: string | null;
  }>;
}

export interface ConsolidatedDashboard {
  totalProjects: number;
  totalActiveProjects: number;
  totalProjectsInImplementation: number;
  totalPlanned: number;
  totalRealized: number;
  totalSavings: number;
  totalItemsWithoutBidReference: number;
  totalUpcomingReplenishments: number;
  totalOverdueReplenishments: number;
  projects: Array<{
    id: string;
    code: string;
    name: string;
    organizationName: string;
    projectStatus: ProjectStatus;
    implementationStatus: ImplementationStatus;
    totalPlanned: number;
    totalRealized: number;
    savings: number;
    itemsWithoutBidReferenceCount: number;
    alertsCount: number;
  }>;
  upcomingEvents: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    budgetItemId: string;
    budgetItemName: string;
    plannedDate: string | null;
    warningDays: number;
  }>;
  alerts: ProjectDashboard['alerts'];
}

export interface ApiErrorPayload {
  message: string;
  details?: unknown;
}
