import { apiRequest } from '@/services/api-client';
import type { DeliveryStatus, ItemCategory, PurchaseOrder, PurchaseStatus } from '@/types/api';

export type PurchaseOrderPayload = {
  supplierId?: string | null;
  purchaseStatus?: PurchaseStatus;
  purchaseDate?: string | null;
  internalReference?: string | null;
  glpiNumber?: string | null;
  paymentSentAt?: string | null;
  notes?: string | null;
};

export type PurchaseOrderItemPayload = {
  budgetItemId?: string | null;
  manualBudgetItem?: {
    itemCategory: ItemCategory;
    name: string;
    unit?: string | null;
    plannedQuantity?: number | null;
    hasBidReference?: boolean;
  };
  quantityPurchased: number;
  realUnitValue: number;
  expectedDeliveryDate?: string | null;
  deliveredAt?: string | null;
  deliveryStatus?: DeliveryStatus;
  notes?: string | null;
};

export function listProjectPurchases(projectId: string) {
  return apiRequest<PurchaseOrder[]>(`projects/${projectId}/purchases`);
}

export function createPurchaseOrder(projectId: string, payload: PurchaseOrderPayload) {
  return apiRequest<PurchaseOrder>(`projects/${projectId}/purchases`, {
    method: 'POST',
    body: payload,
  });
}

export function createPurchaseOrderItem(purchaseOrderId: string, payload: PurchaseOrderItemPayload) {
  return apiRequest(`purchases/${purchaseOrderId}/items`, {
    method: 'POST',
    body: payload,
  });
}
