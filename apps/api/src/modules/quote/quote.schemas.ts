import { z } from 'zod';

export const quoteProjectParamsSchema = z.object({
  id: z.string().min(1),
});

export const quotePurchaseParamsSchema = z.object({
  id: z.string().min(1),
  purchaseId: z.string().min(1),
});

export const quotePurchaseSlotParamsSchema = z.object({
  id: z.string().min(1),
  purchaseId: z.string().min(1),
  slotNumber: z.coerce.number().int().min(1).max(3),
});

export const quotePurchaseItemParamsSchema = z.object({
  id: z.string().min(1),
  purchaseId: z.string().min(1),
  budgetItemId: z.string().min(1),
});

export const quotePurchaseSlotItemParamsSchema = z.object({
  id: z.string().min(1),
  purchaseId: z.string().min(1),
  slotNumber: z.coerce.number().int().min(1).max(3),
  budgetItemId: z.string().min(1),
});

export const quoteImportDocumentParamsSchema = z.object({
  id: z.string().min(1),
  purchaseId: z.string().min(1),
  slotNumber: z.coerce.number().int().min(1).max(3),
  documentId: z.string().min(1),
});

function optionalTrimmedString() {
  return z.preprocess((value) => (value === null ? undefined : value), z.string().trim().optional());
}

export const createQuotePurchaseSchema = z.object({
  title: z.string().trim().min(1),
  notes: optionalTrimmedString().nullable().optional(),
});

export const updateQuotePurchaseSchema = z.object({
  title: z.string().trim().min(1),
  notes: optionalTrimmedString().nullable().optional(),
});

export const updateQuotePurchaseItemsSchema = z.object({
  budgetItemIds: z.array(z.string().min(1)).min(1),
});

export const updateQuoteSupplierSchema = z.object({
  supplierId: z
    .union([z.string().min(1), z.null()])
    .optional()
    .transform((value) => value ?? null),
  confirmReset: z.boolean().optional().default(false),
});

export const updateQuoteItemSchema = z.object({
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
  notes: optionalTrimmedString().nullable().optional(),
});

export const applyQuoteWinnerSchema = z.object({
  mode: z.enum(['OVERALL', 'PER_ITEM']),
});

export const generateQuotePurchaseOrderSchema = z.object({
  glpiNumber: z.string().trim().min(1),
  internalReference: optionalTrimmedString().nullable().optional(),
  deliveryAddress: optionalTrimmedString().nullable().optional(),
  freightType: optionalTrimmedString().nullable().optional(),
  paymentTerms: optionalTrimmedString().nullable().optional(),
  responsibleName: optionalTrimmedString().nullable().optional(),
  responsiblePhone: optionalTrimmedString().nullable().optional(),
  expectedDeliveryDate: z.string().trim().optional().nullable(),
  notes: optionalTrimmedString().nullable().optional(),
});

export const applyQuoteImportSchema = z.object({
  confirmReplace: z.boolean().optional().default(false),
  rows: z
    .array(
      z.object({
        rowIndex: z.coerce.number().int().nonnegative(),
        action: z.enum(['APPLY', 'IGNORE', 'CREATE_EXTRA']),
        matchedBudgetItemId: z
          .union([z.string().min(1), z.null()])
          .optional()
          .transform((value) => value ?? null),
      }),
    )
    .min(1),
});

export type CreateQuotePurchaseInput = z.infer<typeof createQuotePurchaseSchema>;
export type UpdateQuotePurchaseInput = z.infer<typeof updateQuotePurchaseSchema>;
export type UpdateQuotePurchaseItemsInput = z.infer<typeof updateQuotePurchaseItemsSchema>;
export type UpdateQuoteSupplierInput = z.infer<typeof updateQuoteSupplierSchema>;
export type UpdateQuoteItemInput = z.infer<typeof updateQuoteItemSchema>;
export type ApplyQuoteWinnerInput = z.infer<typeof applyQuoteWinnerSchema>;
export type GenerateQuotePurchaseOrderInput = z.infer<typeof generateQuotePurchaseOrderSchema>;
export type ApplyQuoteImportInput = z.infer<typeof applyQuoteImportSchema>;
