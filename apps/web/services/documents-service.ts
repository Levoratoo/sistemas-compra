import { apiGetBlob, apiRequest, getApiBaseUrl } from '@/services/api-client';
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
  options?: { folderScope?: ListProjectDocumentsFolderScope; search?: string | null },
) {
  const folderScope = options?.folderScope ?? 'all';
  const search = options?.search?.trim() || undefined;
  const query =
    folderScope === 'all'
      ? search
        ? { search }
        : undefined
      : {
          folderId: folderScope === 'root' ? 'root' : folderScope,
          ...(search ? { search } : {}),
        };
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
    colorHex2?: string;
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
    colorHex2?: string;
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
  const base = getApiBaseUrl().replace(/\/+$/, '');
  return `${base}/projects/${projectId}/documents/${documentId}/download`;
}

/**
 * Abre o PDF/arquivo numa nova aba com o token JWT (evita `window.open` direto na URL da API).
 * Se o bloqueador impedir nova aba, dispara download com o nome sugerido pelo servidor.
 */
export async function openProjectDocumentInNewTab(projectId: string, documentId: string) {
  const { blob, filename } = await apiGetBlob(`projects/${projectId}/documents/${documentId}/download`);
  const objectUrl = URL.createObjectURL(blob);
  const child = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!child) {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename ?? 'documento';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 600_000);
}

export function createProjectDocument(projectId: string, payload: DocumentPayload) {
  return apiRequest<ProjectDocument>(`projects/${projectId}/documents`, {
    method: 'POST',
    body: payload,
  });
}
