import { documentFolderRepository } from '../repositories/document-folder.repository.js';
import { CND_ROOT_FOLDER_NAME } from '../constants/documentation-folders.js';

/** Nome exibido na árvore de pastas; evita caracteres problemáticos no Windows. */
export function buildSupplierCndFolderLabel(legalName: string) {
  const t = legalName.trim().slice(0, 180);
  if (!t) {
    return 'Fornecedor';
  }
  return t
    .replace(/[/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function ensureCndRootFolder(projectId: string) {
  const existing = await documentFolderRepository.findByProjectParentAndName(projectId, null, CND_ROOT_FOLDER_NAME);
  if (existing) {
    return existing;
  }
  return documentFolderRepository.create({
    projectId,
    parentId: null,
    name: CND_ROOT_FOLDER_NAME,
    sortOrder: -10,
  });
}

export async function ensureCndSupplierFolder(projectId: string, supplierLegalName: string) {
  const cndRoot = await ensureCndRootFolder(projectId);
  const label = buildSupplierCndFolderLabel(supplierLegalName);
  const existingChild = await documentFolderRepository.findByProjectParentAndName(projectId, cndRoot.id, label);
  if (existingChild) {
    return { cndRootFolderId: cndRoot.id, supplierFolderId: existingChild.id };
  }
  const created = await documentFolderRepository.create({
    projectId,
    parentId: cndRoot.id,
    name: label,
    sortOrder: 0,
  });
  return { cndRootFolderId: cndRoot.id, supplierFolderId: created.id };
}
