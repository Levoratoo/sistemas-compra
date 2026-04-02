import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Express } from 'express';

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { documentService } from './document.service.js';
import { ensureCndSupplierFolder } from './supplier-cnd-folders.service.js';
import { ensureRelativeStoragePath, sanitizeFileName, toRelativeProjectPath } from '../utils/file.js';

export const SUPPLIER_CND_DOCUMENT_NOTES = 'CND (certidão negativa de débitos)';

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
  fileSizeBytes?: number,
) {
  const absolute = masterPathForNewFile(supplierId, originalFileName);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);
  const masterStoragePath = toRelativeProjectPath(absolute);

  return prisma.supplierCndAttachment.create({
    data: {
      supplierId,
      originalFileName,
      masterStoragePath,
      mimeType: mimeType ?? null,
      fileSizeBytes: fileSizeBytes ?? buffer.length,
    },
  });
}

async function readMasterBuffer(masterStoragePath: string): Promise<Buffer> {
  const relative = ensureRelativeStoragePath(masterStoragePath);
  const absolute = path.resolve(env.APP_ROOT, relative);
  return readFile(absolute);
}

/**
 * Garante um `ProjectDocument` neste projeto para o anexo CND global (cópia do ficheiro no disco do projeto).
 */
export async function replicateSupplierCndAttachmentToProject(
  projectId: string,
  supplierLegalName: string,
  attachment: { id: string; originalFileName: string; mimeType: string | null; fileSizeBytes: number | null },
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
    notes: SUPPLIER_CND_DOCUMENT_NOTES,
    supplierCndAttachmentId: attachment.id,
  });
}

export async function uploadSupplierCndFilesAndReplicateToAllProjects(
  supplierId: string,
  supplierLegalName: string,
  files: Express.Multer.File[],
) {
  if (files.length === 0) {
    return;
  }

  const projects = await prisma.project.findMany({ select: { id: true } });

  for (const file of files) {
    const buffer = file.buffer;
    const originalFileName = file.originalname || 'cnd-anexo';
    const attachment = await persistSupplierCndMasterFile(supplierId, originalFileName, buffer, file.mimetype);

    for (const { id: projectId } of projects) {
      await replicateSupplierCndAttachmentToProject(projectId, supplierLegalName, attachment, buffer);
    }
  }
}

/**
 * Novo projeto: replica todos os anexos CND globais para a documentação deste projeto.
 */
export async function syncAllSupplierCndAttachmentsToProject(projectId: string) {
  const attachments = await prisma.supplierCndAttachment.findMany({
    include: { supplier: true },
  });

  for (const att of attachments) {
    const buffer = await readMasterBuffer(att.masterStoragePath);
    await replicateSupplierCndAttachmentToProject(projectId, att.supplier.legalName, att, buffer);
  }
}
