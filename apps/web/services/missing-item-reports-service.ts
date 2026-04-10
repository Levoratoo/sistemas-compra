import { apiRequest, apiUploadJson } from '@/services/api-client';
import type {
  MissingItemReport,
  MissingItemUrgency,
  OwnerApprovalStatus,
  PendingMissingItemApproval,
} from '@/types/api';

export type MissingItemReportPayload = {
  requesterName: string;
  requestDate: string;
  itemToAcquire: string;
  estimatedQuantity: string;
  necessityReason: string;
  urgencyLevel: MissingItemUrgency;
};

export type MissingItemReportUpdatePayload = Partial<MissingItemReportPayload> & {
  ownerApprovalStatus?: OwnerApprovalStatus;
  /** Motivo da rejeição (ao definir status REJECTED). */
  ownerRejectionNote?: string | null;
};

export function listMissingItemReports(projectId: string) {
  return apiRequest<MissingItemReport[]>(`projects/${projectId}/missing-item-reports`);
}

export function listPendingMissingItemApprovals() {
  return apiRequest<PendingMissingItemApproval[]>('missing-item-reports/pending-approval');
}

export function createMissingItemReport(projectId: string, payload: MissingItemReportPayload) {
  return apiRequest<MissingItemReport>(`projects/${projectId}/missing-item-reports`, {
    method: 'POST',
    body: payload,
  });
}

export function updateMissingItemReport(reportId: string, payload: MissingItemReportUpdatePayload) {
  return apiRequest<MissingItemReport>(`missing-item-reports/${reportId}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteMissingItemReport(reportId: string) {
  return apiRequest<null>(`missing-item-reports/${reportId}`, {
    method: 'DELETE',
  });
}

export function uploadMissingItemReportAttachment(reportId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUploadJson<MissingItemReport>(`missing-item-reports/${reportId}/attachments`, formData);
}

export function deleteMissingItemReportAttachment(attachmentId: string) {
  return apiRequest<MissingItemReport>(`missing-item-report-attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}
