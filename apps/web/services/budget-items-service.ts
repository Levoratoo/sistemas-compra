import { apiRequest } from '@/services/api-client';
import type { BudgetItem, DataOriginType, ItemCategory } from '@/types/api';

export type BudgetItemPayload = {
  itemCategory: ItemCategory;
  subcategory?: string | null;
  name: string;
  description?: string | null;
  specification?: string | null;
  unit?: string | null;
  sizeLabel?: string | null;
  requiresCa?: boolean | null;
  roleReference?: string | null;
  allocationSector?: string | null;
  plannedQuantity?: number | null;
  bidUnitValue?: number | null;
  rubricMaxValue?: number | null;
  purchasedValue?: number | null;
  hasBidReference?: boolean;
  contextOnly?: boolean;
  sourceType?: DataOriginType;
  sourceDocumentId?: string | null;
  sourceSheetName?: string | null;
  sourceCellRef?: string | null;
  sourcePage?: number | null;
  sourceExcerpt?: string | null;
  notes?: string | null;
  priority?: string | null;
  peopleCount?: number | null;
  operationalPurchaseStatus?: string | null;
  editalDeliveryDeadlineDays?: number | null;
  replenishmentPeriodDaysEdital?: number | null;
  approvedSupplierName?: string | null;
  glpiTicketNumber?: string | null;
  opPaymentSentAt?: string | null;
  opExpectedDeliveryAt?: string | null;
  opDeliveredAt?: string | null;
  operationalStagesStatus?: string | null;
  nextReplenishmentExpectedAt?: string | null;
  replenishmentStateLabel?: string | null;
  competenceLabel?: string | null;
  administrativeFeePercent?: number | null;
  actualUnitValue?: number | null;
};

export function listBudgetItems(projectId: string) {
  return apiRequest<BudgetItem[]>(`projects/${projectId}/budget-items`);
}

export function createBudgetItem(projectId: string, payload: BudgetItemPayload) {
  return apiRequest<BudgetItem>(`projects/${projectId}/budget-items`, {
    method: 'POST',
    body: payload,
  });
}

export function updateBudgetItem(itemId: string, payload: Partial<BudgetItemPayload>) {
  return apiRequest<BudgetItem>(`budget-items/${itemId}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteBudgetItem(itemId: string) {
  return apiRequest<null>(`budget-items/${itemId}`, {
    method: 'DELETE',
  });
}
