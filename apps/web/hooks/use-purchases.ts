'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createPurchaseOrder,
  createPurchaseOrderItem,
  listProjectPurchases,
  type PurchaseOrderItemPayload,
  type PurchaseOrderPayload,
} from '@/services/purchases-service';

export function usePurchasesQuery(projectId: string) {
  return useQuery({
    queryKey: ['purchases', projectId],
    queryFn: () => listProjectPurchases(projectId),
    enabled: Boolean(projectId),
  });
}

export function usePurchasesMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['purchases', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-replenishments', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'consolidated'] }),
    ]);
  };

  return {
    createOrder: useMutation({
      mutationFn: (payload: PurchaseOrderPayload) => createPurchaseOrder(projectId, payload),
      onSuccess: invalidate,
    }),
    createOrderItem: useMutation({
      mutationFn: ({
        purchaseOrderId,
        payload,
      }: {
        purchaseOrderId: string;
        payload: PurchaseOrderItemPayload;
      }) => createPurchaseOrderItem(purchaseOrderId, payload),
      onSuccess: invalidate,
    }),
  };
}
