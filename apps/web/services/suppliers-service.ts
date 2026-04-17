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

export function getSupplier(supplierId: string) {
  return apiRequest<Supplier>(`suppliers/${supplierId}`);
}

export type SupplierCndUploadOptions = {
  cndFederal?: File;
  cndEstadual?: File;
};

function hasCndUploads(options?: SupplierCndUploadOptions) {
  return Boolean(options?.cndFederal || options?.cndEstadual);
}

export function createSupplier(payload: SupplierPayload, options?: SupplierCndUploadOptions) {
  if (hasCndUploads(options)) {
    const formData = new FormData();
    appendSupplierFormData(formData, payload);
    if (options?.cndFederal) {
      formData.append('cndFederal', options.cndFederal);
    }
    if (options?.cndEstadual) {
      formData.append('cndEstadual', options.cndEstadual);
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
  options?: SupplierCndUploadOptions,
) {
  if (hasCndUploads(options)) {
    const formData = new FormData();
    appendSupplierFormData(formData, payload);
    if (options?.cndFederal) {
      formData.append('cndFederal', options.cndFederal);
    }
    if (options?.cndEstadual) {
      formData.append('cndEstadual', options.cndEstadual);
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
