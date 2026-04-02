import { z } from 'zod';

function emptyToUndefined(value: unknown) {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

const optionalTrim = z.preprocess(emptyToUndefined, z.string().trim().optional());

const supplierBaseSchema = z.object({
  legalName: z.string().trim().min(1),
  tradeName: optionalTrim,
  documentNumber: optionalTrim,
  contactName: optionalTrim,
  address: optionalTrim,
  phone: optionalTrim,
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
  cnd: optionalTrim,
  notes: optionalTrim,
});

export const createSupplierSchema = supplierBaseSchema;

export const supplierIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateSupplierSchema = supplierBaseSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
