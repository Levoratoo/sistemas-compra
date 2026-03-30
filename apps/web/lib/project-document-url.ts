import type { ProjectDocument } from '@/types/api';

import { getApiBaseUrl } from '@/services/api-client';

/** URL pública servida por `express.static` em `/uploads` (mesma origem da API, sem prefixo `/api`). */
export function projectDocumentPublicFileUrl(storagePath: string): string {
  const base = getApiBaseUrl();
  const origin = base.replace(/\/api\/?$/, '');
  const rel = storagePath.replace(/^uploads\//, '');
  return `${origin}/uploads/${rel.split('/').map(encodeURIComponent).join('/')}`;
}

/** Documento de edital cujo arquivo original foi persistido em `uploads/projects/...` (não simulado). */
export function pickPrimaryEditalDocument(documents: ProjectDocument[]): ProjectDocument | null {
  const candidates = documents.filter(
    (d) =>
      (d.documentType === 'NOTICE' || d.documentType === 'TERMS_OF_REFERENCE') &&
      d.storagePath.includes('/projects/'),
  );
  if (candidates.length === 0) {
    return null;
  }
  const notice = candidates.find((d) => d.documentType === 'NOTICE');
  return notice ?? candidates[0] ?? null;
}

export function isLikelyPdfDocument(doc: ProjectDocument): boolean {
  const mime = doc.mimeType?.toLowerCase() ?? '';
  if (mime.includes('pdf')) {
    return true;
  }
  return /\.pdf$/i.test(doc.originalFileName);
}
