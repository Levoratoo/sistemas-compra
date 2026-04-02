import { DataOriginType, ItemCategory } from '@prisma/client';
import { z } from 'zod';

export const budgetItemProjectParamsSchema = z.object({
  id: z.string().min(1),
});

/** JSON costuma enviar `null`; `z.string().optional()` não aceita null — normalizamos para não bloquear o fluxo. */
function optionalTrimmedString() {
  return z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().trim().optional(),
  );
}

/** ISO datetime ou `null` para limpar; string vazia vira `undefined` (não altera). */
function optionalIsoDateTime() {
  return z.preprocess(
    (val) => {
      if (val === '' || val === undefined) return undefined;
      return val;
    },
    z.union([z.string(), z.null()]).optional(),
  );
}

const budgetItemBaseSchema = z.object({
  itemCategory: z.nativeEnum(ItemCategory),
  subcategory: optionalTrimmedString(),
  name: z.string().trim().min(1),
  description: optionalTrimmedString(),
  specification: optionalTrimmedString(),
  unit: optionalTrimmedString(),
  sizeLabel: optionalTrimmedString(),
  requiresCa: z.boolean().optional().nullable(),
  roleReference: optionalTrimmedString(),
  allocationSector: optionalTrimmedString(),
  plannedQuantity: z.coerce.number().nonnegative().optional().nullable(),
  bidUnitValue: z.coerce.number().nonnegative().optional().nullable(),
  rubricMaxValue: z.coerce.number().nonnegative().optional().nullable(),
  purchasedValue: z.coerce.number().nonnegative().optional().nullable(),
  hasBidReference: z.boolean().optional(),
  contextOnly: z.boolean().optional(),
  supplierQuoteExtraItem: z.boolean().optional(),
  sourceType: z.nativeEnum(DataOriginType).optional(),
  sourceDocumentId: optionalTrimmedString(),
  sourceSheetName: optionalTrimmedString(),
  sourceCellRef: optionalTrimmedString(),
  sourcePage: z.coerce.number().int().nonnegative().optional(),
  sourceExcerpt: optionalTrimmedString(),
  notes: optionalTrimmedString(),

  /** Fase 2 — controle operacional */
  priority: optionalTrimmedString(),
  peopleCount: z.coerce.number().int().nonnegative().optional().nullable(),
  operationalPurchaseStatus: optionalTrimmedString(),
  editalDeliveryDeadlineDays: z.coerce.number().int().nonnegative().optional().nullable(),
  replenishmentPeriodDaysEdital: z.coerce.number().int().nonnegative().optional().nullable(),
  approvedSupplierName: optionalTrimmedString(),
  glpiTicketNumber: optionalTrimmedString(),
  opPaymentSentAt: optionalIsoDateTime(),
  opExpectedDeliveryAt: optionalIsoDateTime(),
  opDeliveredAt: optionalIsoDateTime(),
  operationalStagesStatus: optionalTrimmedString(),
  nextReplenishmentExpectedAt: optionalIsoDateTime(),
  replenishmentStateLabel: optionalTrimmedString(),
  competenceLabel: optionalTrimmedString(),
  administrativeFeePercent: z.coerce.number().nonnegative().optional().nullable(),
  actualUnitValue: z.coerce.number().nonnegative().optional().nullable(),
});

export const createBudgetItemSchema = budgetItemBaseSchema;

export const budgetItemIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateBudgetItemSchema = budgetItemBaseSchema.partial();

export const manualBudgetItemSchema = budgetItemBaseSchema.extend({
  hasBidReference: z.boolean().optional().default(false),
  contextOnly: z.boolean().optional().default(false),
  sourceType: z.nativeEnum(DataOriginType).optional().default(DataOriginType.MANUAL),
});

export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;
export type ManualBudgetItemInput = z.infer<typeof manualBudgetItemSchema>;
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemSchema>;
