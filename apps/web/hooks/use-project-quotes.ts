'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  applyProjectQuoteWinner,
  generateProjectQuotePurchaseOrder,
  listProjectQuotes,
  selectProjectQuoteSlot,
  updateProjectQuoteItem,
  updateProjectQuoteSupplier,
  type GenerateQuotePurchaseOrderPayload,
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
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-document-folders', projectId] }),
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
    selectSlot: useMutation({
      mutationFn: (slotNumber: number) => selectProjectQuoteSlot(projectId, slotNumber),
      onSuccess: async (state) => {
        setQuotesState(state);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
        ]);
      },
    }),
    applyWinner: useMutation({
      mutationFn: (mode: QuoteApplyMode) => applyProjectQuoteWinner(projectId, mode),
      onSuccess: invalidateOperationalData,
    }),
    generatePurchaseOrder: useMutation({
      mutationFn: (payload: GenerateQuotePurchaseOrderPayload) =>
        generateProjectQuotePurchaseOrder(projectId, payload),
      onSuccess: async () => {
        await invalidateOperationalData();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'consolidated'] }),
        ]);
      },
    }),
  };
}
