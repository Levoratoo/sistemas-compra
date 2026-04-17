import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Express } from 'express';
import type { SupplierCndScope } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { documentService, removeStoredFile } from './document.service.js';
import { ensureCndSupplierFolder } from './supplier-cnd-folders.service.js';
import { ensureRelativeStoragePath, sanitizeFileName, toRelativeProjectPath } from '../utils/file.js';
import {
  extractSupplierCndMetadataFromFile,
  type SupplierCndParsedMetadata,
} from '../utils/supplier-cnd-parser.js';

export const SUPPLIER_CND_DOCUMENT_NOTES = 'CND (certidão negativa de débitos)';

export function cndDocumentNotesForScope(scope: SupplierCndScope): string {
  if (scope === 'STATE') {
    return 'CND estadual (certidão negativa de débitos)';
  }
  return 'CND federal (certidão negativa de débitos)';
}

function masterPathForNewFile(supplierId: string, originalFileName: string) {
  const safe = sanitizeFileName(originalFileName) || `cnd-${Date.now()}.bin`;
  const unique = `${Date.now()}-${randomBytes(4).toString('hex')}-${safe}`;
  return path.join(env.UPLOADS_DIR_ABSOLUTE, 'suppliers', supplierId, 'cnd', unique);
}

export async function persistSupplierCndMasterFile(
  supplierId: string,
  originalFileName: string,
  buffer: Buffer,
  mimeType: string | undefined,
  scope: SupplierCndScope,
  parsed: SupplierCndParsedMetadata | null,
  fileSizeBytes?: number,
) {
  const absolute = masterPathForNewFile(supplierId, originalFileName);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);
  const masterStoragePath = toRelativeProjectPath(absolute);

  return prisma.supplierCndAttachment.create({
    data: {
      supplierId,
      scope,
      originalFileName,
      masterStoragePath,
      mimeType: mimeType ?? null,
      fileSizeBytes: fileSizeBytes ?? buffer.length,
      parsedIssuedAt: parsed?.issuedAt ?? null,
      parsedValidUntil: parsed?.validUntil ?? null,
      parsedControlCode: parsed?.controlCode ?? null,
    },
  });
}

async function readMasterBuffer(masterStoragePath: string): Promise<Buffer> {
  const relative = ensureRelativeStoragePath(masterStoragePath);
  const absolute = path.resolve(env.APP_ROOT, relative);
  return readFile(absolute);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

async function deleteSupplierCndAttachmentAndReplicas(attachmentId: string) {
  const docs = await prisma.projectDocument.findMany({
    where: { supplierCndAttachmentId: attachmentId },
    select: { id: true, storagePath: true },
  });

  for (const doc of docs) {
    await removeStoredFile(doc.storagePath);
    await prisma.projectDocument.delete({ where: { id: doc.id } });
  }

  const att = await prisma.supplierCndAttachment.findUnique({
    where: { id: attachmentId },
    select: { masterStoragePath: true },
  });

  if (att) {
    await removeStoredFile(att.masterStoragePath);
    await prisma.supplierCndAttachment.delete({ where: { id: attachmentId } });
  }
}

async function removeAllSupplierCndAttachmentsForScope(supplierId: string, scope: SupplierCndScope) {
  const existing = await prisma.supplierCndAttachment.findMany({
    where: { supplierId, scope },
    select: { id: true },
  });

  for (const row of existing) {
    await deleteSupplierCndAttachmentAndReplicas(row.id);
  }
}

export async function replicateSupplierCndAttachmentToProject(
  projectId: string,
  supplierLegalName: string,
  attachment: { id: string; originalFileName: string; mimeType: string | null; fileSizeBytes: number | null },
  scope: SupplierCndScope,
  fileBuffer: Buffer,
) {
  const existing = await prisma.projectDocument.findFirst({
    where: { projectId, supplierCndAttachmentId: attachment.id },
  });
  if (existing) {
    return;
  }

  const { supplierFolderId } = await ensureCndSupplierFolder(projectId, supplierLegalName);
  await documentService.createProjectDocument(projectId, {
    folderId: supplierFolderId,
    documentType: 'OTHER_ATTACHMENT',
    originalFileName: attachment.originalFileName,
    mimeType: attachment.mimeType ?? undefined,
    originalFileBuffer: fileBuffer,
    notes: cndDocumentNotesForScope(scope),
    supplierCndAttachmentId: attachment.id,
  });
}

/** Atualiza campos legados em Supplier a partir dos anexos atuais (data mais crítica = menor validade). */
export async function refreshSupplierCndAggregateFields(supplierId: string) {
  const attachments = await prisma.supplierCndAttachment.findMany({
    where: { supplierId },
    orderBy: { createdAt: 'desc' },
  });

  const federal = attachments.find((a) => a.scope === 'FEDERAL');
  const state = attachments.find((a) => a.scope === 'STATE');

  type Cand = { validUntil: Date; issuedAt: Date | null; controlCode: string | null; fileName: string };
  const candidates: Cand[] = [];
  if (federal?.parsedValidUntil) {
    candidates.push({
      validUntil: federal.parsedValidUntil,
      issuedAt: federal.parsedIssuedAt,
      controlCode: federal.parsedControlCode,
      fileName: federal.originalFileName,
    });
  }
  if (state?.parsedValidUntil) {
    candidates.push({
      validUntil: state.parsedValidUntil,
      issuedAt: state.parsedIssuedAt,
      controlCode: state.parsedControlCode,
      fileName: state.originalFileName,
    });
  }

  if (candidates.length === 0) {
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        cndIssuedAt: null,
        cndValidUntil: null,
        cndControlCode: null,
        cndSourceFileName: null,
      },
    });
    return;
  }

  const critical = candidates.reduce((best, cur) =>
    cur.validUntil.getTime() < best.validUntil.getTime() ? cur : best,
  );

  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      cndIssuedAt: critical.issuedAt,
      cndValidUntil: critical.validUntil,
      cndControlCode: critical.controlCode,
      cndSourceFileName: critical.fileName,
    },
  });
}

export type ScopedCndUpload = { file: Express.Multer.File; scope: SupplierCndScope };

export async function uploadSupplierScopedCndFilesAndReplicateToAllProjects(
  supplierId: string,
  supplierLegalName: string,
  items: ScopedCndUpload[],
) {
  if (items.length === 0) {
    return;
  }

  const projects = await prisma.project.findMany({ select: { id: true } });

  for (const { file, scope } of items) {
    await removeAllSupplierCndAttachmentsForScope(supplierId, scope);

    const buffer = file.buffer;
    const originalFileName = file.originalname || 'cnd-anexo';
    const parsed = await extractSupplierCndMetadataFromFile(buffer, originalFileName, file.mimetype);

    const attachment = await persistSupplierCndMasterFile(
      supplierId,
      originalFileName,
      buffer,
      file.mimetype,
      scope,
      parsed,
    );

    for (const { id: projectId } of projects) {
      await replicateSupplierCndAttachmentToProject(projectId, supplierLegalName, attachment, scope, buffer);
    }
  }

  await refreshSupplierCndAggregateFields(supplierId);
}

export async function syncAllSupplierCndAttachmentsToProject(projectId: string) {
  const attachments = await prisma.supplierCndAttachment.findMany({
    include: { supplier: true },
  });

  for (const att of attachments) {
    try {
      const buffer = await readMasterBuffer(att.masterStoragePath);
      await replicateSupplierCndAttachmentToProject(
        projectId,
        att.supplier.legalName,
        att,
        att.scope,
        buffer,
      );
    } catch (error) {
      if (isMissingFileError(error)) {
        logger.warn('Ignorando CND mestre ausente durante sincronizacao do projeto.', {
          projectId,
          supplierId: att.supplierId,
          supplierName: att.supplier.legalName,
          supplierCndAttachmentId: att.id,
          masterStoragePath: att.masterStoragePath,
        });
        continue;
      }

      throw error;
    }
  }
}
