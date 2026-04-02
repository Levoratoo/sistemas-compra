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
      mutationFn: (input: {
        payload: SupplierPayload;
        cndFiles?: File[];
        projectId?: string | null;
      }) => createSupplier(input.payload, { cndFiles: input.cndFiles, projectId: input.projectId }),
      onSuccess: invalidate,
    }),
    updateSupplier: useMutation({
      mutationFn: (input: {
        id: string;
        payload: Partial<SupplierPayload>;
        cndFiles?: File[];
        projectId?: string | null;
      }) => updateSupplier(input.id, input.payload, { cndFiles: input.cndFiles, projectId: input.projectId }),
      onSuccess: invalidate,
    }),
    deleteSupplier: useMutation({
      mutationFn: (id: string) => deleteSupplier(id),
      onSuccess: invalidate,
    }),
  };
}
