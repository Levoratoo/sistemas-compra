'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addProjectQuotePurchaseItems,
  applyProjectQuotePdfImport,
  applyProjectQuoteWinner,
  createProjectQuotePurchase,
  deleteProjectQuotePurchase,
  generateProjectQuoteComparisonReport,
  generateProjectQuotePurchaseOrders,
  listProjectQuotes,
  removeProjectQuotePurchaseItem,
  updateProjectQuotePurchase,
  updateProjectQuoteItem,
  updateProjectQuoteSupplier,
  uploadProjectQuotePdfImport,
  type AddQuotePurchaseItemsPayload,
  type CreateQuotePurchasePayload,
  type GenerateQuotePurchaseOrderPayload,
  type QuoteApplyMode,
  type UpdateQuotePurchasePayload,
  type UpdateQuoteItemPayload,
  type UpdateQuoteSupplierPayload,
} from '@/services/quotes-service';
import type { ProjectQuoteImportApplyPayload, ProjectQuotesState } from '@/types/api';

function payloadIncludesQuantity(payload: UpdateQuoteItemPayload) {
  return payload.quantity !== undefined || payload.quantidade !== undefined;
}

export function useProjectQuotesQuery(projectId: string) {
  return useQuery({
    queryKey: ['project-quotes', projectId],
    queryFn: () => listProjectQuotes(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectQuotesMutations(projectId: string) {
  const queryClient = useQueryClient();

  const setQuotesState = (state: ProjectQuotesState) => {
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
    createPurchase: useMutation({
      mutationFn: (payload: CreateQuotePurchasePayload) => createProjectQuotePurchase(projectId, payload),
      onSuccess: setQuotesState,
    }),
    updatePurchase: useMutation({
      mutationFn: ({ purchaseId, payload }: { purchaseId: string; payload: UpdateQuotePurchasePayload }) =>
        updateProjectQuotePurchase(projectId, purchaseId, payload),
      onSuccess: setQuotesState,
    }),
    deletePurchase: useMutation({
      mutationFn: (purchaseId: string) => deleteProjectQuotePurchase(projectId, purchaseId),
      onSuccess: async (state) => {
        setQuotesState(state);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['purchases', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'project', projectId] }),
        ]);
      },
    }),
    addPurchaseItems: useMutation({
      mutationFn: ({ purchaseId, payload }: { purchaseId: string; payload: AddQuotePurchaseItemsPayload }) =>
        addProjectQuotePurchaseItems(projectId, purchaseId, payload),
      onSuccess: setQuotesState,
    }),
    removePurchaseItem: useMutation({
      mutationFn: ({ purchaseId, budgetItemId }: { purchaseId: string; budgetItemId: string }) =>
        removeProjectQuotePurchaseItem(projectId, purchaseId, budgetItemId),
      onSuccess: setQuotesState,
    }),
    updateSupplier: useMutation({
      mutationFn: ({
        purchaseId,
        slotNumber,
        payload,
      }: {
        purchaseId: string;
        slotNumber: number;
        payload: UpdateQuoteSupplierPayload;
      }) => updateProjectQuoteSupplier(projectId, purchaseId, slotNumber, payload),
      onSuccess: setQuotesState,
    }),
    updateItem: useMutation({
      mutationFn: ({
        purchaseId,
        slotNumber,
        budgetItemId,
        payload,
      }: {
        purchaseId: string;
        slotNumber: number;
        budgetItemId: string;
        payload: UpdateQuoteItemPayload;
      }) => updateProjectQuoteItem(projectId, purchaseId, slotNumber, budgetItemId, payload),
      onSuccess: async (state, variables) => {
        setQuotesState(state);
        if (payloadIncludesQuantity(variables.payload)) {
          await queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] });
          await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        }
      },
    }),
    applyWinner: useMutation({
      mutationFn: ({ purchaseId, mode }: { purchaseId: string; mode: QuoteApplyMode }) =>
        applyProjectQuoteWinner(projectId, purchaseId, mode),
      onSuccess: invalidateOperationalData,
    }),
    generateComparisonReport: useMutation({
      mutationFn: ({ purchaseId }: { purchaseId: string }) => generateProjectQuoteComparisonReport(projectId, purchaseId),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['project-document-folders', projectId] }),
        ]);
      },
    }),
    generatePurchaseOrders: useMutation({
      mutationFn: ({ purchaseId, payload }: { purchaseId: string; payload: GenerateQuotePurchaseOrderPayload }) =>
        generateProjectQuotePurchaseOrders(projectId, purchaseId, payload),
      onSuccess: async () => {
        await invalidateOperationalData();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'consolidated'] }),
        ]);
      },
    }),
    uploadImportPdf: useMutation({
      mutationFn: ({ purchaseId, slotNumber, file }: { purchaseId: string; slotNumber: number; file: File }) =>
        uploadProjectQuotePdfImport(projectId, purchaseId, slotNumber, file),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['project-quotes', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['project-document-folders', projectId] }),
        ]);
      },
    }),
    applyImportPdf: useMutation({
      mutationFn: ({
        purchaseId,
        slotNumber,
        documentId,
        payload,
      }: {
        purchaseId: string;
        slotNumber: number;
        documentId: string;
        payload: ProjectQuoteImportApplyPayload;
      }) => applyProjectQuotePdfImport(projectId, purchaseId, slotNumber, documentId, payload),
      onSuccess: async (state) => {
        setQuotesState(state);
        await invalidateOperationalData();
      },
    }),
  };
}
