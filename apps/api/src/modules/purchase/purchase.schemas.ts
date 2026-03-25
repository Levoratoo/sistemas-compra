import { DeliveryStatus, PurchaseStatus } from '@prisma/client';
import { z } from 'zod';

import { manualBudgetItemSchema } from '../budget-item/budget-item.schemas.js';

export const projectPurchaseParamsSchema = z.object({
  id: z.string().min(1),
});

export const purchaseOrderParamsSchema = z.object({
  id: z.string().min(1),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().trim().optional(),
  purchaseStatus: z.nativeEnum(PurchaseStatus).optional(),
  purchaseDate: z.string().trim().optional().nullable(),
  internalReference: z.string().trim().optional(),
  glpiNumber: z.string().trim().optional(),
  paymentSentAt: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional(),
});

export const createPurchaseOrderItemSchema = z.object({
  budgetItemId: z.string().trim().optional(),
  manualBudgetItem: manualBudgetItemSchema.optional(),
  quantityPurchased: z.coerce.number().positive(),
  realUnitValue: z.coerce.number().nonnegative(),
  expectedDeliveryDate: z.string().trim().optional().nullable(),
  deliveredAt: z.string().trim().optional().nullable(),
  deliveryStatus: z.nativeEnum(DeliveryStatus).optional(),
  notes: z.string().trim().optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type CreatePurchaseOrderItemInput = z.infer<typeof createPurchaseOrderItemSchema>;
