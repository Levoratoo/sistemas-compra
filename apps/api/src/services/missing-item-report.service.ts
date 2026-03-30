import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { OwnerApprovalStatus } from '@prisma/client';

import { env } from '../config/env.js';
import { missingItemReportAttachmentRepository } from '../repositories/missing-item-report-attachment.repository.js';
import { missingItemReportRepository } from '../repositories/missing-item-report.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import type {
  CreateMissingItemReportInput,
  UpdateMissingItemReportInput,
} from '../modules/missing-item-report/missing-item-report.schemas.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate } from '../utils/date.js';
import { ensureRelativeStoragePath, sanitizeFileName, toRelativeProjectPath } from '../utils/file.js';
import { serializeMissingItemReport } from '../utils/serializers.js';

async function ensureProjectExists(projectId: string) {
  const project = await projectRepository.exists(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }
}

function approvalTimestamp(status: OwnerApprovalStatus): Date | null {
  if (status === OwnerApprovalStatus.APPROVED || status === OwnerApprovalStatus.REJECTED) {
    return new Date();
  }

  return null;
}

async function storeAttachmentBuffer(
  projectId: string,
  reportId: string,
  buffer: Buffer,
  originalFileName: string,
): Promise<{ relativePath: string; fileSizeBytes: number }> {
  const safeName = sanitizeFileName(originalFileName) || `anexo-${Date.now()}.bin`;
  const fileName = `${Date.now()}-${randomBytes(4).toString('hex')}-${safeName}`;
  const absolutePath = path.join(
    env.UPLOADS_DIR_ABSOLUTE,
    'projects',
    projectId,
    'missing-items',
    reportId,
    fileName,
  );
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    relativePath: toRelativeProjectPath(absolutePath),
    fileSizeBytes: buffer.length,
  };
}

async function unlinkStoredFile(storagePath: string) {
  try {
    const relative = ensureRelativeStoragePath(storagePath);
    const absolute = path.resolve(env.APP_ROOT, relative);
    const uploadsRoot = path.resolve(env.UPLOADS_DIR_ABSOLUTE);
    const rel = path.relative(uploadsRoot, absolute);

    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return;
    }

    await unlink(absolute);
  } catch {
    // arquivo já removido ou inexistente
  }
}

class MissingItemReportService {
  async create(projectId: string, input: CreateMissingItemReportInput) {
    await ensureProjectExists(projectId);
    const requestDate = parseOptionalDate(input.requestDate);

    if (!requestDate) {
      throw new AppError('Invalid request date', 400);
    }

    const row = await missingItemReportRepository.create({
      projectId,
      requesterName: input.requesterName,
      requestDate,
      itemToAcquire: input.itemToAcquire,
      estimatedQuantity: input.estimatedQuantity,
      necessityReason: input.necessityReason,
      urgencyLevel: input.urgencyLevel,
    });

    return serializeMissingItemReport(row);
  }

  async listByProject(projectId: string) {
    await ensureProjectExists(projectId);
    const rows = await missingItemReportRepository.findByProject(projectId);
    return rows.map(serializeMissingItemReport);
  }

  async update(reportId: string, input: UpdateMissingItemReportInput) {
    const existing = await missingItemReportRepository.findById(reportId);

    if (!existing) {
      throw new AppError('Missing item report not found', 404);
    }

    let nextRequestDate: Date | undefined;

    if (input.requestDate !== undefined) {
      const parsed = parseOptionalDate(input.requestDate);

      if (!parsed) {
        throw new AppError('Invalid request date', 400);
      }

      nextRequestDate = parsed;
    }

    let ownerApprovedAt: Date | null | undefined;

    if (input.ownerApprovalStatus !== undefined) {
      ownerApprovedAt = approvalTimestamp(input.ownerApprovalStatus);
    }

    const row = await missingItemReportRepository.update(reportId, {
      ...(input.requesterName !== undefined ? { requesterName: input.requesterName } : {}),
      ...(nextRequestDate !== undefined ? { requestDate: nextRequestDate } : {}),
      ...(input.itemToAcquire !== undefined ? { itemToAcquire: input.itemToAcquire } : {}),
      ...(input.estimatedQuantity !== undefined ? { estimatedQuantity: input.estimatedQuantity } : {}),
      ...(input.necessityReason !== undefined ? { necessityReason: input.necessityReason } : {}),
      ...(input.urgencyLevel !== undefined ? { urgencyLevel: input.urgencyLevel } : {}),
      ...(input.ownerApprovalStatus !== undefined
        ? { ownerApprovalStatus: input.ownerApprovalStatus, ownerApprovedAt }
        : {}),
    });

    return serializeMissingItemReport(row);
  }

  async delete(reportId: string) {
    const existing = await missingItemReportRepository.findById(reportId);

    if (!existing) {
      throw new AppError('Missing item report not found', 404);
    }

    for (const att of existing.attachments) {
      await unlinkStoredFile(att.storagePath);
    }

    await missingItemReportRepository.delete(reportId);
  }

  async addAttachment(
    reportId: string,
    file: { buffer: Buffer; originalname: string; mimetype?: string } | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new AppError('Envie um arquivo no campo file.', 400);
    }

    const report = await missingItemReportRepository.findById(reportId);

    if (!report) {
      throw new AppError('Missing item report not found', 404);
    }

    const storage = await storeAttachmentBuffer(report.projectId, reportId, file.buffer, file.originalname);

    await missingItemReportAttachmentRepository.create({
      missingItemReportId: reportId,
      originalFileName: file.originalname,
      storagePath: storage.relativePath,
      mimeType: file.mimetype ?? null,
      fileSizeBytes: storage.fileSizeBytes,
    });

    const updated = await missingItemReportRepository.findById(reportId);

    if (!updated) {
      throw new AppError('Missing item report not found', 404);
    }

    return serializeMissingItemReport(updated);
  }

  async deleteAttachment(attachmentId: string) {
    const att = await missingItemReportAttachmentRepository.findById(attachmentId);

    if (!att) {
      throw new AppError('Attachment not found', 404);
    }

    await unlinkStoredFile(att.storagePath);
    await missingItemReportAttachmentRepository.delete(attachmentId);

    const report = await missingItemReportRepository.findById(att.missingItemReportId);

    if (!report) {
      throw new AppError('Missing item report not found', 404);
    }

    return serializeMissingItemReport(report);
  }
}

export const missingItemReportService = new MissingItemReportService();
