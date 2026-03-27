import { randomBytes } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Prisma } from '@prisma/client';

import { env } from '../config/env.js';
import { documentRepository } from '../repositories/document.repository.js';
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
      previewJson: input.previewJson ?? null,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  );
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
        documentType: input.documentType,
        originalFileName: input.originalFileName,
        storagePath: storage.relativePath,
        mimeType: input.mimeType ?? null,
        fileSizeBytes: storage.fileSizeBytes,
        checksum: input.checksum ?? null,
        documentDate: parseOptionalDate(input.documentDate),
        processingStatus: input.processingStatus ?? 'PROCESSED',
        reviewStatus:
          input.reviewStatus ??
          ((input.extractedFields?.length ?? 0) > 0 ? 'PENDING_REVIEW' : 'REVIEWED'),
        processingError: input.processingError ?? null,
        notes: input.notes ?? null,
      },
      extractedFields,
    );

    return {
      ...serializeProjectDocument(document),
      extractedFields: document.extractedFields.map(serializeExtractedField),
    };
  }

  async listProjectDocuments(
    projectId: string,
    options?: { folderScope?: 'all' | { folderId: string | null } },
  ) {
    await ensureProjectExists(projectId);

    const scope = options?.folderScope ?? 'all';
    const documents = await documentRepository.findByProject(
      projectId,
      scope === 'all' ? undefined : { mode: 'folder', folderId: scope.folderId },
    );

    return documents.map((document) => ({
      ...serializeProjectDocument(document),
      extractedFields: document.extractedFields.map(serializeExtractedField),
    }));
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

    return {
      ...serializeProjectDocument(updated),
      extractedFields: updated.extractedFields.map(serializeExtractedField),
    };
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
