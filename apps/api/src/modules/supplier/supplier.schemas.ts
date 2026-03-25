import { z } from 'zod';

const supplierBaseSchema = z.object({
  legalName: z.string().trim().min(1),
  documentNumber: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.email().optional(),
  notes: z.string().trim().optional(),
});

export const createSupplierSchema = supplierBaseSchema;

export const supplierIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateSupplierSchema = supplierBaseSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
