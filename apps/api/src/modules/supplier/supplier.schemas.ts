import { z } from 'zod';

export const SUPPLIER_OFFERING_CATEGORY_VALUES = [
  'EPI',
  'EQUIPAMENTOS',
  'UNIFORMES',
  'MATERIAIS_ESCRITORIO',
  'SERVICOS',
  'OUTROS',
] as const;

export type SupplierOfferingCategorySlug = (typeof SUPPLIER_OFFERING_CATEGORY_VALUES)[number];

const supplierOfferingCategorySchema = z.enum(SUPPLIER_OFFERING_CATEGORY_VALUES);

function emptyToUndefined(value: unknown) {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

const optionalTrim = z.preprocess(emptyToUndefined, z.string().trim().optional());

function parseOfferingCategoriesRaw(raw: unknown): string[] {
  if (raw == null || raw === '') {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  const s = String(raw).trim();
  if (!s) {
    return [];
  }
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

const offeringCategoriesField = z.preprocess(
  parseOfferingCategoriesRaw,
  z.array(supplierOfferingCategorySchema).default([]),
);

const offeringCategoriesOtherDetailSchema = z.preprocess(emptyToUndefined, z.string().trim().max(400).optional());

const supplierBaseSchema = z
  .object({
    legalName: z.string().trim().min(1),
    tradeName: optionalTrim,
    documentNumber: optionalTrim,
    contactName: optionalTrim,
    address: optionalTrim,
    phone: optionalTrim,
    email: z.preprocess(emptyToUndefined, z.string().email().optional()),
    cnd: optionalTrim,
    notes: optionalTrim,
    offeringCategories: offeringCategoriesField,
    offeringCategoriesOtherDetail: offeringCategoriesOtherDetailSchema,
  })
  .superRefine((data, ctx) => {
    const hasOutros = data.offeringCategories.includes('OUTROS');
    const detail = (data.offeringCategoriesOtherDetail ?? '').trim();
    if (hasOutros && !detail) {
      ctx.addIssue({
        code: 'custom',
        message: 'Descreva o que se enquadra em «Outros».',
        path: ['offeringCategoriesOtherDetail'],
      });
    }
  });

export const createSupplierSchema = supplierBaseSchema;

export const supplierIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateSupplierSchema = supplierBaseSchema.partial().superRefine((data, ctx) => {
  if (!data.offeringCategories?.includes('OUTROS')) {
    return;
  }
  if (data.offeringCategoriesOtherDetail === undefined) {
    return;
  }
  const detail = String(data.offeringCategoriesOtherDetail).trim();
  if (!detail) {
    ctx.addIssue({
      code: 'custom',
      message: 'Descreva o que se enquadra em «Outros».',
      path: ['offeringCategoriesOtherDetail'],
    });
  }
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
