'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMissingItemReport,
  deleteMissingItemReport,
  deleteMissingItemReportAttachment,
  listMissingItemReports,
  listPendingMissingItemApprovals,
  type MissingItemReportPayload,
  type MissingItemReportUpdatePayload,
  updateMissingItemReport,
  uploadMissingItemReportAttachment,
} from '@/services/missing-item-reports-service';

export function useMissingItemReportsQuery(projectId: string) {
  return useQuery({
    queryKey: ['missing-item-reports', projectId],
    queryFn: () => listMissingItemReports(projectId),
    enabled: Boolean(projectId),
  });
}

export function usePendingMissingItemApprovalsQuery() {
  return useQuery({
    queryKey: ['missing-item-reports', 'pending-approval'],
    queryFn: () => listPendingMissingItemApprovals(),
  });
}

/** Aprovar/rejeitar na fila global: invalida a fila e quaisquer listagens por projeto. */
export function useMissingItemApprovalDecisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ownerApprovalStatus,
      ownerRejectionNote,
    }: {
      id: string;
      ownerApprovalStatus: 'APPROVED' | 'REJECTED';
      ownerRejectionNote?: string | null;
    }) =>
      updateMissingItemReport(id, {
        ownerApprovalStatus,
        ...(ownerApprovalStatus === 'REJECTED' ? { ownerRejectionNote: ownerRejectionNote ?? null } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['missing-item-reports'] });
    },
  });
}

export function useMissingItemReportsMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['missing-item-reports', projectId] });
  };

  return {
    createReport: useMutation({
      mutationFn: (payload: MissingItemReportPayload) => createMissingItemReport(projectId, payload),
      onSuccess: invalidate,
    }),
    updateReport: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: MissingItemReportUpdatePayload }) =>
        updateMissingItemReport(id, payload),
      onSuccess: invalidate,
    }),
    deleteReport: useMutation({
      mutationFn: (id: string) => deleteMissingItemReport(id),
      onSuccess: invalidate,
    }),
    uploadAttachment: useMutation({
      mutationFn: ({ reportId, file }: { reportId: string; file: File }) =>
        uploadMissingItemReportAttachment(reportId, file),
      onSuccess: invalidate,
    }),
    deleteAttachment: useMutation({
      mutationFn: (attachmentId: string) => deleteMissingItemReportAttachment(attachmentId),
      onSuccess: invalidate,
    }),
  };
}
