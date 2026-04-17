import { randomBytes } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Prisma, type ProjectDocumentFolder } from '@prisma/client';

import { env } from '../config/env.js';
import { documentRepository } from '../repositories/document.repository.js';
import { documentFolderRepository } from '../repositories/document-folder.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { validateFolderForProject } from './document-folder.service.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate } from '../utils/date.js';
import { ensureRelativeStoragePath, sanitizeFileName, toRelativeProjectPath } from '../utils/file.js';
import { serializeExtractedField, serializeProjectDocument } from '../utils/serializers.js';
import type { CreateProjectDocumentInput } from '../modules/document/document.schemas.js';

/** Inclusão opcional do binário original (upload); não vem do corpo JSON da API pública. */
export type CreateProjectDocumentServiceInput = CreateProjectDocumentInput & {
  originalFileBuffer?: Buffer;
  searchText?: string | null;
  purchaseOrderId?: string | null;
  supplierCndAttachmentId?: string | null;
};

async function ensureProjectExists(projectId: string) {
  const project = await projectRepository.exists(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }
}

function buildSimulatedDocumentContent(input: CreateProjectDocumentInput) {
  return JSON.stringify(
    {
      originalFileName: input.originalFileName,
      mimeType: input.mimeType ?? null,
      contentText: input.contentText ?? null,
      searchText: (input as CreateProjectDocumentServiceInput).searchText ?? null,
      previewJson: input.previewJson ?? null,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

function toNullableJsonInput(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.DbNull;
  }

  return value as Prisma.InputJsonValue;
}

async function resolveStoragePath(projectId: string, input: CreateProjectDocumentServiceInput) {
  if (input.originalFileBuffer && input.originalFileBuffer.length > 0) {
    const safeName = sanitizeFileName(input.originalFileName) || `document-${Date.now()}.bin`;
    const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}-${safeName}`;
    const absolutePath = path.join(env.UPLOADS_DIR_ABSOLUTE, 'projects', projectId, fileName);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.originalFileBuffer);

    return {
      relativePath: toRelativeProjectPath(absolutePath),
      fileSizeBytes: input.originalFileBuffer.length,
    };
  }

  const fileContents = buildSimulatedDocumentContent(input);

  if (input.storagePath) {
    const relativePath = ensureRelativeStoragePath(input.storagePath);
    const absolutePath = path.resolve(env.APP_ROOT, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, fileContents, 'utf8');

    return {
      relativePath,
      fileSizeBytes: Buffer.byteLength(fileContents, 'utf8'),
    };
  }

  const safeName = sanitizeFileName(input.originalFileName) || `document-${Date.now()}.txt`;
  const absolutePath = path.resolve(env.UPLOADS_DIR_ABSOLUTE, 'simulated', safeName);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, fileContents, 'utf8');

  return {
    relativePath: toRelativeProjectPath(absolutePath),
    fileSizeBytes: Buffer.byteLength(fileContents, 'utf8'),
  };
}

function buildFolderPathLabel(folders: ProjectDocumentFolder[], folderId: string | null | undefined) {
  if (!folderId) {
    return 'Raiz';
  }

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const labels: string[] = [];
  let currentId: string | null | undefined = folderId;

  while (currentId) {
    const folder = foldersById.get(currentId);
    if (!folder) {
      break;
    }

    labels.unshift(folder.name);
    currentId = folder.parentId;
  }

  return labels.length > 0 ? labels.join(' / ') : 'Raiz';
}

function serializeDocumentWithFolderPath(
  document: Awaited<ReturnType<typeof documentRepository.findById>> extends infer T ? NonNullable<T> : never,
  folders: ProjectDocumentFolder[],
) {
  return {
    ...serializeProjectDocument(document),
    folderPathLabel: buildFolderPathLabel(folders, document.folderId),
    extractedFields: document.extractedFields.map(serializeExtractedField),
  };
}

export async function removeStoredFile(storagePath: string | null | undefined) {
  if (!storagePath) {
    return;
  }

  try {
    const relativePath = ensureRelativeStoragePath(storagePath);
    const absolutePath = path.resolve(env.APP_ROOT, relativePath);
    await rm(absolutePath, { force: true });
  } catch {
    // Ignore file cleanup errors for regenerated documents.
  }
}

class DocumentService {
  async createProjectDocument(projectId: string, input: CreateProjectDocumentServiceInput) {
    await ensureProjectExists(projectId);
    await validateFolderForProject(projectId, input.folderId ?? null);

    const storage = await resolveStoragePath(projectId, input);

    const extractedFields: Prisma.ExtractedFieldUncheckedCreateWithoutProjectDocumentInput[] =
      (input.extractedFields ?? []).map((field) => ({
        targetType: field.targetType,
        recordGroupKey: field.recordGroupKey ?? null,
        fieldKey: field.fieldKey,
        proposedValue: field.proposedValue,
        confirmedValue: field.confirmedValue ?? null,
        sourcePage: field.sourcePage ?? null,
        sourceSheetName: field.sourceSheetName ?? null,
        sourceCellRef: field.sourceCellRef ?? null,
        sourceExcerpt: field.sourceExcerpt ?? null,
        confidenceScore: field.confidenceScore ?? null,
        reviewStatus: field.reviewStatus ?? 'PENDING_REVIEW',
        reviewNote: field.reviewNote ?? null,
      }));

    const document = await documentRepository.createWithExtractedFields(
      {
        projectId,
        folderId: input.folderId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        supplierCndAttachmentId: input.supplierCndAttachmentId ?? null,
        documentType: input.documentType,
        originalFileName: input.originalFileName,
        storagePath: storage.relativePath,
        mimeType: input.mimeType ?? null,
        fileSizeBytes: storage.fileSizeBytes,
        checksum: input.checksum ?? null,
        documentDate: parseOptionalDate(input.documentDate),
        searchText: input.searchText ?? input.contentText ?? null,
        previewJson: toNullableJsonInput(input.previewJson),
        processingStatus: input.processingStatus ?? 'PROCESSED',
        reviewStatus:
          input.reviewStatus ??
          ((input.extractedFields?.length ?? 0) > 0 ? 'PENDING_REVIEW' : 'REVIEWED'),
        processingError: input.processingError ?? null,
        notes: input.notes ?? null,
      },
      extractedFields,
    );
    const folders = await documentFolderRepository.listByProject(projectId);

    return serializeDocumentWithFolderPath(document, folders);
  }

  async replaceProjectDocument(
    projectId: string,
    documentId: string,
    input: CreateProjectDocumentServiceInput,
  ) {
    await ensureProjectExists(projectId);
    await validateFolderForProject(projectId, input.folderId ?? null);

    const existing = await documentRepository.findById(documentId);
    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Document not found', 404);
    }

    const storage = await resolveStoragePath(projectId, input);
    const updated = await documentRepository.updateById(documentId, {
      folderId: input.folderId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      documentType: input.documentType,
      originalFileName: input.originalFileName,
      storagePath: storage.relativePath,
      mimeType: input.mimeType ?? null,
      fileSizeBytes: storage.fileSizeBytes,
      checksum: input.checksum ?? null,
      documentDate: parseOptionalDate(input.documentDate),
      searchText: input.searchText ?? input.contentText ?? null,
      previewJson: toNullableJsonInput(input.previewJson),
      processingStatus: input.processingStatus ?? 'PROCESSED',
      reviewStatus: input.reviewStatus ?? 'REVIEWED',
      processingError: input.processingError ?? null,
      notes: input.notes ?? null,
    });

    if (existing.storagePath !== updated.storagePath) {
      await removeStoredFile(existing.storagePath);
    }

    const folders = await documentFolderRepository.listByProject(projectId);
    return serializeDocumentWithFolderPath(updated, folders);
  }

  async listProjectDocuments(
    projectId: string,
    options?: { folderScope?: 'all' | { folderId: string | null }; search?: string | null },
  ) {
    await ensureProjectExists(projectId);

    const scope = options?.folderScope ?? 'all';
    const documents = await documentRepository.findByProject(
      projectId,
      scope === 'all' ? undefined : { mode: 'folder', folderId: scope.folderId },
      options?.search ?? null,
    );
    const folders = await documentFolderRepository.listByProject(projectId);

    return documents.map((document) => serializeDocumentWithFolderPath(document, folders));
  }

  async moveProjectDocument(projectId: string, documentId: string, folderId: string | null) {
    await ensureProjectExists(projectId);
    await validateFolderForProject(projectId, folderId);

    const existing = await documentRepository.findById(documentId);
    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Document not found', 404);
    }

    await documentRepository.updateFolder(documentId, projectId, folderId);
    const updated = await documentRepository.findById(documentId);
    if (!updated) {
      throw new AppError('Document not found', 404);
    }

    return serializeDocumentWithFolderPath(
      updated,
      await documentFolderRepository.listByProject(projectId),
    );
  }

  /**
   * Resolve o arquivo no disco (somente sob o diretório de uploads) para download autenticado pelo vínculo projeto/documento.
   */
  async getDocumentFileForDownload(projectId: string, documentId: string) {
    await ensureProjectExists(projectId);
    const doc = await documentRepository.findById(documentId);
    if (!doc || doc.projectId !== projectId) {
      throw new AppError('Document not found', 404);
    }

    const relative = ensureRelativeStoragePath(doc.storagePath);
    const absolute = path.resolve(env.APP_ROOT, relative);
    const uploadsRoot = path.resolve(env.UPLOADS_DIR_ABSOLUTE);
    const rel = path.relative(uploadsRoot, absolute);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new AppError('Arquivo não disponível.', 404);
    }

    try {
      const st = await stat(absolute);
      if (!st.isFile()) {
        throw new AppError('Arquivo não encontrado no servidor.', 404);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('Arquivo não encontrado no servidor.', 404);
    }

    return {
      absolutePath: absolute,
      downloadName: doc.originalFileName,
    };
  }
}

export const documentService = new DocumentService();
