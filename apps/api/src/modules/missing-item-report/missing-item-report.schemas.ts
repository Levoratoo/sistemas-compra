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

const optionalTrimmed = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal('')])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v));

export const createMissingItemReportSchema = z.object({
  requesterName: z.string().trim().min(1),
  requesterRole: optionalTrimmed(200),
  requestDate: z.string().min(1),
  itemToAcquire: z.string().trim().min(1),
  itemSizeDescription: optionalTrimmed(500),
  itemCategory: optionalTrimmed(200),
  estimatedQuantity: z.string().trim().min(1),
  necessityReason: z.string().trim().min(1),
  urgencyLevel: z.nativeEnum(MissingItemUrgency),
});

const optionalClearable = (max: number) =>
  z.union([z.string().trim().max(max), z.literal('')]).optional();

export const updateMissingItemReportSchema = z
  .object({
    requesterName: z.string().trim().min(1).optional(),
    requesterRole: optionalClearable(200),
    requestDate: z.string().min(1).optional(),
    itemToAcquire: z.string().trim().min(1).optional(),
    itemSizeDescription: optionalClearable(500),
    itemCategory: optionalClearable(200),
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
