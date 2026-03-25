'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  type SupplierPayload,
  updateSupplier,
} from '@/services/suppliers-service';

export function useSuppliersQuery() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: listSuppliers,
  });
}

export function useSuppliersMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  };

  return {
    createSupplier: useMutation({
      mutationFn: (payload: SupplierPayload) => createSupplier(payload),
      onSuccess: invalidate,
    }),
    updateSupplier: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<SupplierPayload> }) =>
        updateSupplier(id, payload),
      onSuccess: invalidate,
    }),
    deleteSupplier: useMutation({
      mutationFn: (id: string) => deleteSupplier(id),
      onSuccess: invalidate,
    }),
  };
}
