import { apiRequest } from '@/services/api-client';
import type {
  DocumentType,
  ExtractedFieldReviewStatus,
  ExtractedTargetType,
  FolderSurfaceStyle,
  ProjectDocument,
  ProjectDocumentFolder,
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

export type ListProjectDocumentsFolderScope = 'all' | 'root' | string;

export function listProjectDocuments(
  projectId: string,
  options?: { folderScope?: ListProjectDocumentsFolderScope },
) {
  const folderScope = options?.folderScope ?? 'all';
  const query =
    folderScope === 'all'
      ? undefined
      : { folderId: folderScope === 'root' ? 'root' : folderScope };
  return apiRequest<ProjectDocument[]>(`projects/${projectId}/documents`, { query });
}

export function listProjectDocumentFolders(projectId: string) {
  return apiRequest<ProjectDocumentFolder[]>(`projects/${projectId}/document-folders`);
}

export function createProjectDocumentFolder(
  projectId: string,
  payload: {
    name: string;
    parentId?: string | null;
    colorHex?: string;
    iconEmoji?: string | null;
    surfaceStyle?: FolderSurfaceStyle;
  },
) {
  return apiRequest<ProjectDocumentFolder>(`projects/${projectId}/document-folders`, {
    method: 'POST',
    body: payload,
  });
}

export function updateProjectDocumentFolder(
  projectId: string,
  folderId: string,
  payload: {
    name?: string;
    parentId?: string | null;
    colorHex?: string;
    iconEmoji?: string | null;
    surfaceStyle?: FolderSurfaceStyle;
  },
) {
  return apiRequest<ProjectDocumentFolder>(`projects/${projectId}/document-folders/${folderId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteProjectDocumentFolder(projectId: string, folderId: string) {
  return apiRequest<null>(`projects/${projectId}/document-folders/${folderId}`, {
    method: 'DELETE',
  });
}

export function moveProjectDocumentToFolder(
  projectId: string,
  documentId: string,
  folderId: string | null,
) {
  return apiRequest<ProjectDocument>(`projects/${projectId}/documents/${documentId}`, {
    method: 'PATCH',
    body: { folderId },
  });
}

/** URL da API para download do arquivo original (GET, `Content-Disposition: attachment`). */
export function getProjectDocumentDownloadUrl(projectId: string, documentId: string) {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '');
  return `${base}/projects/${projectId}/documents/${documentId}/download`;
}

export function createProjectDocument(projectId: string, payload: DocumentPayload) {
  return apiRequest<ProjectDocument>(`projects/${projectId}/documents`, {
    method: 'POST',
    body: payload,
  });
}
