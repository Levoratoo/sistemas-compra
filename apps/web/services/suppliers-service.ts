import { apiRequest } from '@/services/api-client';
import type { Supplier } from '@/types/api';

export type SupplierPayload = {
  legalName: string;
  tradeName?: string | null;
  documentNumber?: string | null;
  contactName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  cnd?: string | null;
  notes?: string | null;
};

export function listSuppliers() {
  return apiRequest<Supplier[]>('suppliers');
}

export function createSupplier(payload: SupplierPayload) {
  return apiRequest<Supplier>('suppliers', {
    method: 'POST',
    body: payload,
  });
}

export function updateSupplier(supplierId: string, payload: Partial<SupplierPayload>) {
  return apiRequest<Supplier>(`suppliers/${supplierId}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteSupplier(supplierId: string) {
  return apiRequest<null>(`suppliers/${supplierId}`, {
    method: 'DELETE',
  });
}
