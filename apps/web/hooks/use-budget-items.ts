'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createBudgetItem,
  deleteBudgetItem,
  listBudgetItems,
  type BudgetItemPayload,
  updateBudgetItem,
} from '@/services/budget-items-service';

export function useBudgetItemsQuery(projectId: string) {
  return useQuery({
    queryKey: ['budget-items', projectId],
    queryFn: () => listBudgetItems(projectId),
    enabled: Boolean(projectId),
  });
}

export function useBudgetItemsMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-replenishments', projectId] }),
    ]);
  };

  return {
    createItem: useMutation({
      mutationFn: (payload: BudgetItemPayload) => createBudgetItem(projectId, payload),
      onSuccess: invalidate,
    }),
    updateItem: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<BudgetItemPayload> }) =>
        updateBudgetItem(id, payload),
      onSuccess: invalidate,
    }),
    deleteItem: useMutation({
      mutationFn: (id: string) => deleteBudgetItem(id),
      onSuccess: invalidate,
    }),
  };
}
