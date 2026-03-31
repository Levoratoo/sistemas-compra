import { apiRequest } from '@/services/api-client';
import type { ProjectQuoteState } from '@/types/api';

export type QuoteApplyMode = 'OVERALL' | 'PER_ITEM';

export type UpdateQuoteSupplierPayload = {
  supplierId: string | null;
  confirmReset?: boolean;
};

export type UpdateQuoteItemPayload = {
  unitPrice?: number | null;
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

export function applyProjectQuoteWinner(projectId: string, mode: QuoteApplyMode) {
  return apiRequest<{ mode: QuoteApplyMode; updatedItems: number; skippedItems: number }>(
    `projects/${projectId}/quotes/apply-winner`,
    {
      method: 'POST',
      body: { mode },
    },
  );
}
