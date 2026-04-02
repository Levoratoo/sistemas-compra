import { apiRequest, apiUploadJson } from '@/services/api-client';
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

function appendSupplierFormData(formData: FormData, payload: SupplierPayload | Partial<SupplierPayload>) {
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  }
}

export function listSuppliers() {
  return apiRequest<Supplier[]>('suppliers');
}

export function createSupplier(
  payload: SupplierPayload,
  options?: { cndFiles?: File[]; projectId?: string | null },
) {
  const files = options?.cndFiles?.filter(Boolean) ?? [];
  if (files.length > 0) {
    const formData = new FormData();
    appendSupplierFormData(formData, payload);
    const projectId = options?.projectId?.trim();
    if (projectId) {
      formData.append('projectId', projectId);
    }
    for (const file of files) {
      formData.append('cndFiles', file);
    }
    return apiUploadJson<Supplier>('suppliers', formData);
  }
  return apiRequest<Supplier>('suppliers', {
    method: 'POST',
    body: payload,
  });
}

export function updateSupplier(
  supplierId: string,
  payload: Partial<SupplierPayload>,
  options?: { cndFiles?: File[]; projectId?: string | null },
) {
  const files = options?.cndFiles?.filter(Boolean) ?? [];
  if (files.length > 0) {
    const formData = new FormData();
    appendSupplierFormData(formData, payload);
    const projectId = options?.projectId?.trim();
    if (projectId) {
      formData.append('projectId', projectId);
    }
    for (const file of files) {
      formData.append('cndFiles', file);
    }
    return apiUploadJson<Supplier>(`suppliers/${supplierId}`, formData, 'PUT');
  }
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
