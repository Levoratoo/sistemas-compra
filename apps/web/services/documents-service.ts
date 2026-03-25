import { apiRequest } from '@/services/api-client';
import type {
  DocumentType,
  ExtractedFieldReviewStatus,
  ExtractedTargetType,
  ProjectDocument,
} from '@/types/api';

export type DocumentPayload = {
  documentType: DocumentType;
  originalFileName: string;
  mimeType?: string | null;
  documentDate?: string | null;
  contentText?: string | null;
  notes?: string | null;
  extractedFields?: Array<{
    targetType: ExtractedTargetType;
    fieldKey: string;
    proposedValue: string;
    confirmedValue?: string | null;
    sourcePage?: number | null;
    reviewStatus?: ExtractedFieldReviewStatus;
  }>;
};

export function listProjectDocuments(projectId: string) {
  return apiRequest<ProjectDocument[]>(`projects/${projectId}/documents`);
}

export function createProjectDocument(projectId: string, payload: DocumentPayload) {
  return apiRequest<ProjectDocument>(`projects/${projectId}/documents`, {
    method: 'POST',
    body: payload,
  });
}
