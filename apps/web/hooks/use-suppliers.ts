'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createSupplier,
  deleteSupplier,
  getSupplier,
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

export function useSupplierQuery(supplierId: string) {
  return useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => getSupplier(supplierId),
    enabled: Boolean(supplierId),
  });
}

export function useSuppliersMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  };

  return {
    createSupplier: useMutation({
      mutationFn: (input: { payload: SupplierPayload; cndFiles?: File[] }) =>
        createSupplier(input.payload, { cndFiles: input.cndFiles }),
      onSuccess: invalidate,
    }),
    updateSupplier: useMutation({
      mutationFn: (input: { id: string; payload: Partial<SupplierPayload>; cndFiles?: File[] }) =>
        updateSupplier(input.id, input.payload, { cndFiles: input.cndFiles }),
      onSuccess: async (_data, variables) => {
        await invalidate();
        await queryClient.invalidateQueries({ queryKey: ['supplier', variables.id] });
      },
    }),
    deleteSupplier: useMutation({
      mutationFn: (id: string) => deleteSupplier(id),
      onSuccess: async (_data, supplierId) => {
        await invalidate();
        await queryClient.removeQueries({ queryKey: ['supplier', supplierId] });
      },
    }),
  };
}
