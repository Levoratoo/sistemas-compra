import { MissingItemUrgency, OwnerApprovalStatus } from '@prisma/client';
import { z } from 'zod';

export const missingItemReportProjectParamsSchema = z.object({
  id: z.string().min(1),
});

export const missingItemReportIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const missingItemReportAttachmentIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const createMissingItemReportSchema = z.object({
  requesterName: z.string().trim().min(1),
  requestDate: z.string().min(1),
  itemToAcquire: z.string().trim().min(1),
  estimatedQuantity: z.string().trim().min(1),
  necessityReason: z.string().trim().min(1),
  urgencyLevel: z.nativeEnum(MissingItemUrgency),
});

export const updateMissingItemReportSchema = z
  .object({
    requesterName: z.string().trim().min(1).optional(),
    requestDate: z.string().min(1).optional(),
    itemToAcquire: z.string().trim().min(1).optional(),
    estimatedQuantity: z.string().trim().min(1).optional(),
    necessityReason: z.string().trim().min(1).optional(),
    urgencyLevel: z.nativeEnum(MissingItemUrgency).optional(),
    ownerApprovalStatus: z.nativeEnum(OwnerApprovalStatus).optional(),
    ownerRejectionNote: z.union([z.string().trim().max(4000), z.literal('')]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export type CreateMissingItemReportInput = z.infer<typeof createMissingItemReportSchema>;
export type UpdateMissingItemReportInput = z.infer<typeof updateMissingItemReportSchema>;
