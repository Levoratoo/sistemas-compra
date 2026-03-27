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

export interface EntityTimestamps {
  createdAt: string | null;
  updatedAt: string | null;
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
  documentType: DocumentType;
  originalFileName: string;
  storagePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  checksum: string | null;
  documentDate: string | null;
  processingStatus: DocumentProcessingStatus;
  reviewStatus: DocumentReviewStatus;
  processingError: string | null;
  notes: string | null;
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
  documentNumber: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
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
  paymentSentAt: string | null;
  notes: string | null;
  supplier: Supplier | null;
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
