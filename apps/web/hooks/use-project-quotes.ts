'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  applyProjectQuoteWinner,
  listProjectQuotes,
  updateProjectQuoteItem,
  updateProjectQuoteSupplier,
  type QuoteApplyMode,
  type UpdateQuoteItemPayload,
  type UpdateQuoteSupplierPayload,
} from '@/services/quotes-service';
import type { ProjectQuoteState } from '@/types/api';

export function useProjectQuotesQuery(projectId: string) {
  return useQuery({
    queryKey: ['project-quotes', projectId],
    queryFn: () => listProjectQuotes(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectQuotesMutations(projectId: string) {
  const queryClient = useQueryClient();

  const setQuotesState = (state: ProjectQuoteState) => {
    queryClient.setQueryData(['project-quotes', projectId], state);
  };

  const invalidateOperationalData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-quotes', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-replenishments', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['purchases', projectId] }),
    ]);
  };

  return {
    updateSupplier: useMutation({
      mutationFn: ({
        slotNumber,
        payload,
      }: {
        slotNumber: number;
        payload: UpdateQuoteSupplierPayload;
      }) => updateProjectQuoteSupplier(projectId, slotNumber, payload),
      onSuccess: setQuotesState,
    }),
    updateItem: useMutation({
      mutationFn: ({
        slotNumber,
        budgetItemId,
        payload,
      }: {
        slotNumber: number;
        budgetItemId: string;
        payload: UpdateQuoteItemPayload;
      }) => updateProjectQuoteItem(projectId, slotNumber, budgetItemId, payload),
      onSuccess: setQuotesState,
    }),
    applyWinner: useMutation({
      mutationFn: (mode: QuoteApplyMode) => applyProjectQuoteWinner(projectId, mode),
      onSuccess: invalidateOperationalData,
    }),
  };
}
