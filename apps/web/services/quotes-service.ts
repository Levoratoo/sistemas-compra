import { apiRequest } from '@/services/api-client';
import type { ProjectQuotePurchaseOrderResult, ProjectQuoteState } from '@/types/api';

export type QuoteApplyMode = 'OVERALL' | 'PER_ITEM';

export type UpdateQuoteSupplierPayload = {
  supplierId: string | null;
  confirmReset?: boolean;
};

export type UpdateQuoteItemPayload = {
  unitPrice?: number | null;
  notes?: string | null;
};

export type GenerateQuotePurchaseOrderPayload = {
  glpiNumber: string;
  internalReference?: string | null;
  deliveryAddress?: string | null;
  freightType?: string | null;
  paymentTerms?: string | null;
  responsibleName?: string | null;
  responsiblePhone?: string | null;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
};

export function listProjectQuotes(projectId: string) {
  return apiRequest<ProjectQuoteState>(`projects/${projectId}/quotes`);
}

export function updateProjectQuoteSupplier(
  projectId: string,
  slotNumber: number,
  payload: UpdateQuoteSupplierPayload,
) {
  return apiRequest<ProjectQuoteState>(`projects/${projectId}/quotes/${slotNumber}/supplier`, {
    method: 'PUT',
    body: payload,
  });
}

export function updateProjectQuoteItem(
  projectId: string,
  slotNumber: number,
  budgetItemId: string,
  payload: UpdateQuoteItemPayload,
) {
  return apiRequest<ProjectQuoteState>(`projects/${projectId}/quotes/${slotNumber}/items/${budgetItemId}`, {
    method: 'PUT',
    body: payload,
  });
}

export function selectProjectQuoteSlot(projectId: string, slotNumber: number) {
  return apiRequest<ProjectQuoteState>(`projects/${projectId}/quotes/${slotNumber}/select`, {
    method: 'PUT',
  });
}

export function applyProjectQuoteWinner(projectId: string, mode: QuoteApplyMode) {
  return apiRequest<{ mode: QuoteApplyMode; updatedItems: number; skippedItems: number }>(
    `projects/${projectId}/quotes/apply-winner`,
    {
      method: 'POST',
      body: { mode },
    },
  );
}

export function generateProjectQuotePurchaseOrder(
  projectId: string,
  payload: GenerateQuotePurchaseOrderPayload,
) {
  return apiRequest<ProjectQuotePurchaseOrderResult>(`projects/${projectId}/quotes/generate-purchase-order`, {
    method: 'POST',
    body: payload,
  });
}
