'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  listProjectReplenishments,
  type ReplenishmentRulePayload,
  upsertReplenishmentRule,
} from '@/services/replenishments-service';

export function useReplenishmentsQuery(projectId: string) {
  return useQuery({
    queryKey: ['project-replenishments', projectId],
    queryFn: () => listProjectReplenishments(projectId),
    enabled: Boolean(projectId),
  });
}

export function useReplenishmentsMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-replenishments', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'consolidated'] }),
    ]);
  };

  return {
    upsertRule: useMutation({
      mutationFn: ({ budgetItemId, payload }: { budgetItemId: string; payload: ReplenishmentRulePayload }) =>
        upsertReplenishmentRule(budgetItemId, payload),
      onSuccess: invalidate,
    }),
  };
}
