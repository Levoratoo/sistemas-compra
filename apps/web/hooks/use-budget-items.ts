'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  confirmReplenishmentCycle,
  createBudgetItem,
  deleteBudgetItem,
  listBudgetItems,
  type BudgetItemPayload,
  unconfirmReplenishmentCycle,
  updateBudgetItem,
} from '@/services/budget-items-service';
import type { BudgetItem, ProjectDetail } from '@/types/api';

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
      queryClient.invalidateQueries({ queryKey: ['project-quotes', projectId] }),
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
      onMutate: async ({ id, payload }) => {
        await queryClient.cancelQueries({ queryKey: ['project', projectId] });
        await queryClient.cancelQueries({ queryKey: ['budget-items', projectId] });

        const previousProject = queryClient.getQueryData<ProjectDetail>(['project', projectId]);
        const previousBudgetItems = queryClient.getQueryData<BudgetItem[]>(['budget-items', projectId]);

        const patchList = (items: BudgetItem[]) =>
          items.map((it) => (it.id === id ? ({ ...it, ...payload } as BudgetItem) : it));

        if (previousProject) {
          queryClient.setQueryData<ProjectDetail>(['project', projectId], {
            ...previousProject,
            budgetItems: patchList(previousProject.budgetItems),
          });
        }
        if (previousBudgetItems) {
          queryClient.setQueryData<BudgetItem[]>(['budget-items', projectId], patchList(previousBudgetItems));
        }

        return { previousProject, previousBudgetItems };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previousProject) {
          queryClient.setQueryData(['project', projectId], ctx.previousProject);
        }
        if (ctx?.previousBudgetItems !== undefined) {
          queryClient.setQueryData(['budget-items', projectId], ctx.previousBudgetItems);
        }
      },
      onSuccess: (data, variables) => {
        queryClient.setQueryData<ProjectDetail>(['project', projectId], (old) => {
          if (!old) return old;
          return {
            ...old,
            budgetItems: old.budgetItems.map((it) =>
              it.id === variables.id ? ({ ...it, ...data } as BudgetItem) : it,
            ),
          };
        });
        queryClient.setQueryData<BudgetItem[]>(['budget-items', projectId], (old) =>
          old?.map((it) => (it.id === variables.id ? ({ ...it, ...data } as BudgetItem) : it)) ?? old,
        );
        void queryClient.invalidateQueries({ queryKey: ['dashboard', 'project', projectId] });
        void queryClient.invalidateQueries({ queryKey: ['project-replenishments', projectId] });
      },
    }),
    deleteItem: useMutation({
      mutationFn: (id: string) => deleteBudgetItem(id),
      onSuccess: invalidate,
    }),
    confirmReplenishmentCycle: useMutation({
      mutationFn: (itemId: string) => confirmReplenishmentCycle(itemId),
      onSuccess: async () => {
        await invalidate();
        await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      },
    }),
    unconfirmReplenishmentCycle: useMutation({
      mutationFn: (itemId: string) => unconfirmReplenishmentCycle(itemId),
      onSuccess: async () => {
        await invalidate();
        await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      },
    }),
  };
}
