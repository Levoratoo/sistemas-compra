import { apiRequest, apiUploadJson } from '@/services/api-client';
import type {
  ProjectQuoteImportApplyPayload,
  ProjectQuoteImportPreview,
  ProjectQuotePurchaseOrderResult,
  ProjectQuotesState,
} from '@/types/api';

export type QuoteApplyMode = 'OVERALL' | 'PER_ITEM';

export type CreateQuotePurchasePayload = {
  title: string;
  notes?: string | null;
};

export type UpdateQuotePurchasePayload = {
  title: string;
  notes?: string | null;
};

export type AddQuotePurchaseItemsPayload = {
  budgetItemIds: string[];
};

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
  return apiRequest<ProjectQuotesState>(`projects/${projectId}/quotes`);
}

export function createProjectQuotePurchase(projectId: string, payload: CreateQuotePurchasePayload) {
  return apiRequest<ProjectQuotesState>(`projects/${projectId}/quotes/purchases`, {
    method: 'POST',
    body: payload,
  });
}

export function updateProjectQuotePurchase(projectId: string, purchaseId: string, payload: UpdateQuotePurchasePayload) {
  return apiRequest<ProjectQuotesState>(`projects/${projectId}/quotes/purchases/${purchaseId}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteProjectQuotePurchase(projectId: string, purchaseId: string) {
  return apiRequest<ProjectQuotesState>(`projects/${projectId}/quotes/purchases/${purchaseId}`, {
    method: 'DELETE',
  });
}

export function addProjectQuotePurchaseItems(
  projectId: string,
  purchaseId: string,
  payload: AddQuotePurchaseItemsPayload,
) {
  return apiRequest<ProjectQuotesState>(`projects/${projectId}/quotes/purchases/${purchaseId}/items`, {
    method: 'POST',
    body: payload,
  });
}

export function removeProjectQuotePurchaseItem(projectId: string, purchaseId: string, budgetItemId: string) {
  return apiRequest<ProjectQuotesState>(`projects/${projectId}/quotes/purchases/${purchaseId}/items/${budgetItemId}`, {
    method: 'DELETE',
  });
}

export function updateProjectQuoteSupplier(
  projectId: string,
  purchaseId: string,
  slotNumber: number,
  payload: UpdateQuoteSupplierPayload,
) {
  return apiRequest<ProjectQuotesState>(`projects/${projectId}/quotes/purchases/${purchaseId}/slots/${slotNumber}/supplier`, {
    method: 'PUT',
    body: payload,
  });
}

export function updateProjectQuoteItem(
  projectId: string,
  purchaseId: string,
  slotNumber: number,
  budgetItemId: string,
  payload: UpdateQuoteItemPayload,
) {
  return apiRequest<ProjectQuotesState>(
    `projects/${projectId}/quotes/purchases/${purchaseId}/slots/${slotNumber}/items/${budgetItemId}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
}

export function applyProjectQuoteWinner(projectId: string, purchaseId: string, mode: QuoteApplyMode) {
  return apiRequest<{ mode: QuoteApplyMode; updatedItems: number; skippedItems: number }>(
    `projects/${projectId}/quotes/purchases/${purchaseId}/apply-winner`,
    {
      method: 'POST',
      body: { mode },
    },
  );
}

export function generateProjectQuotePurchaseOrders(
  projectId: string,
  purchaseId: string,
  payload: GenerateQuotePurchaseOrderPayload,
) {
  return apiRequest<ProjectQuotePurchaseOrderResult>(
    `projects/${projectId}/quotes/purchases/${purchaseId}/generate-purchase-orders`,
    {
      method: 'POST',
      body: payload,
    },
  );
}

export function uploadProjectQuotePdfImport(projectId: string, purchaseId: string, slotNumber: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUploadJson<ProjectQuoteImportPreview>(
    `projects/${projectId}/quotes/purchases/${purchaseId}/slots/${slotNumber}/import-pdf`,
    formData,
  );
}

export function applyProjectQuotePdfImport(
  projectId: string,
  purchaseId: string,
  slotNumber: number,
  documentId: string,
  payload: ProjectQuoteImportApplyPayload,
) {
  return apiRequest<ProjectQuotesState>(
    `projects/${projectId}/quotes/purchases/${purchaseId}/slots/${slotNumber}/import-pdf/${documentId}/apply`,
    {
      method: 'POST',
      body: payload,
    },
  );
}
