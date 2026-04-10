import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { OwnerApprovalStatus, type UserRole } from '@prisma/client';

import { env } from '../config/env.js';
import { missingItemReportAttachmentRepository } from '../repositories/missing-item-report-attachment.repository.js';
import { missingItemReportRepository } from '../repositories/missing-item-report.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { notifyMissingItemReportCreated } from './emailjs.service.js';
import type {
  CreateMissingItemReportInput,
  UpdateMissingItemReportInput,
} from '../modules/missing-item-report/missing-item-report.schemas.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate } from '../utils/date.js';
import { ensureRelativeStoragePath, sanitizeFileName, toRelativeProjectPath } from '../utils/file.js';
import {
  serializeMissingItemReport,
  serializeMissingItemReportForProjectList,
  serializePendingMissingItemReport,
} from '../utils/serializers.js';

type ViewerAuth = {
  userId?: string;
  role?: UserRole;
};

async function ensureProjectExists(projectId: string) {
  const project = await projectRepository.exists(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }
}

async function assertSupervisorCanAccessProject(projectId: string, viewer?: ViewerAuth) {
  if (viewer?.role !== 'SUPERVISOR' || !viewer.userId) {
    return;
  }

  const hasAccess = await userRepository.hasReleasedProject(viewer.userId, projectId);
  if (!hasAccess) {
    throw new AppError('Sem permissao para este projeto.', 403);
  }
}

function assertApproverOrAdmin(viewer?: ViewerAuth) {
  const role = viewer?.role;
  if (role !== 'APPROVER' && role !== 'ADMIN') {
    throw new AppError('Apenas aprovadores ou administradores podem consultar a fila de aprovações.', 403);
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
  async create(projectId: string, input: CreateMissingItemReportInput, viewer?: ViewerAuth) {
    await ensureProjectExists(projectId);
    await assertSupervisorCanAccessProject(projectId, viewer);
    const requestDate = parseOptionalDate(input.requestDate);

    if (!requestDate) {
      throw new AppError('Invalid request date', 400);
    }

    const row = await missingItemReportRepository.create({
      projectId,
      requesterName: input.requesterName,
      requesterRole: input.requesterRole ?? null,
      requestDate,
      itemToAcquire: input.itemToAcquire,
      itemSizeDescription: input.itemSizeDescription ?? null,
      itemCategory: input.itemCategory ?? null,
      estimatedQuantity: input.estimatedQuantity,
      necessityReason: input.necessityReason,
      urgencyLevel: input.urgencyLevel,
    });

    const projectSummary = await projectRepository.findSummaryById(projectId);
    if (projectSummary) {
      void notifyMissingItemReportCreated({
        projectId,
        projectName: projectSummary.name,
        projectCode: projectSummary.code,
        reportId: row.id,
        requesterName: row.requesterName,
        itemToAcquire: row.itemToAcquire,
        estimatedQuantity: row.estimatedQuantity,
        necessityReason: row.necessityReason,
        urgencyLevel: row.urgencyLevel,
        requestDate: row.requestDate,
      }).catch((err) => {
        console.error('[missing-item-report] EmailJS notification failed', err);
      });
    }

    return serializeMissingItemReport(row);
  }

  async listByProject(projectId: string, viewer?: ViewerAuth) {
    await ensureProjectExists(projectId);
    await assertSupervisorCanAccessProject(projectId, viewer);
    const rows = await missingItemReportRepository.findByProject(projectId);
    return rows.map(serializeMissingItemReportForProjectList);
  }

  async listPendingApproval(viewer?: ViewerAuth) {
    assertApproverOrAdmin(viewer);
    const rows = await missingItemReportRepository.findPendingApprovalWithProject();
    return rows.map(serializePendingMissingItemReport);
  }

  async update(reportId: string, input: UpdateMissingItemReportInput, viewer?: ViewerAuth) {
    const existing = await missingItemReportRepository.findById(reportId);

    if (!existing) {
      throw new AppError('Missing item report not found', 404);
    }

    await assertSupervisorCanAccessProject(existing.projectId, viewer);

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
      ...(input.requesterRole !== undefined
        ? {
            requesterRole:
              input.requesterRole.trim() === '' ? null : input.requesterRole.trim(),
          }
        : {}),
      ...(nextRequestDate !== undefined ? { requestDate: nextRequestDate } : {}),
      ...(input.itemToAcquire !== undefined ? { itemToAcquire: input.itemToAcquire } : {}),
      ...(input.itemSizeDescription !== undefined
        ? {
            itemSizeDescription:
              input.itemSizeDescription.trim() === '' ? null : input.itemSizeDescription.trim(),
          }
        : {}),
      ...(input.itemCategory !== undefined
        ? { itemCategory: input.itemCategory.trim() === '' ? null : input.itemCategory.trim() }
        : {}),
      ...(input.estimatedQuantity !== undefined ? { estimatedQuantity: input.estimatedQuantity } : {}),
      ...(input.necessityReason !== undefined ? { necessityReason: input.necessityReason } : {}),
      ...(input.urgencyLevel !== undefined ? { urgencyLevel: input.urgencyLevel } : {}),
      ...(input.ownerApprovalStatus !== undefined
        ? {
            ownerApprovalStatus: input.ownerApprovalStatus,
            ownerApprovedAt,
            ...(input.ownerApprovalStatus === OwnerApprovalStatus.REJECTED
              ? {
                  ownerRejectionNote:
                    typeof input.ownerRejectionNote === 'string' && input.ownerRejectionNote.trim() !== ''
                      ? input.ownerRejectionNote.trim()
                      : null,
                }
              : { ownerRejectionNote: null }),
          }
        : {}),
    });

    return serializeMissingItemReport(row);
  }

  async delete(reportId: string, viewer?: ViewerAuth) {
    const existing = await missingItemReportRepository.findById(reportId);

    if (!existing) {
      throw new AppError('Missing item report not found', 404);
    }

    await assertSupervisorCanAccessProject(existing.projectId, viewer);

    for (const att of existing.attachments) {
      await unlinkStoredFile(att.storagePath);
    }

    await missingItemReportRepository.delete(reportId);
  }

  async addAttachment(
    reportId: string,
    file: { buffer: Buffer; originalname: string; mimetype?: string } | undefined,
    viewer?: ViewerAuth,
  ) {
    if (!file?.buffer?.length) {
      throw new AppError('Envie um arquivo no campo file.', 400);
    }

    const report = await missingItemReportRepository.findById(reportId);

    if (!report) {
      throw new AppError('Missing item report not found', 404);
    }

    await assertSupervisorCanAccessProject(report.projectId, viewer);

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

  async deleteAttachment(attachmentId: string, viewer?: ViewerAuth) {
    const att = await missingItemReportAttachmentRepository.findById(attachmentId);

    if (!att) {
      throw new AppError('Attachment not found', 404);
    }

    await assertSupervisorCanAccessProject(att.report.projectId, viewer);

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
