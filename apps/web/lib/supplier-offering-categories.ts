import type { SupplierOfferingCategorySlug } from '@/types/api';

export const SUPPLIER_OFFERING_CATEGORY_OPTIONS: ReadonlyArray<{
  value: SupplierOfferingCategorySlug;
  label: string;
}> = [
  { value: 'EPI', label: 'EPI' },
  { value: 'UNIFORMES', label: 'Uniformes' },
  { value: 'EQUIPAMENTOS', label: 'Equipamentos' },
  { value: 'MATERIAIS_ESCRITORIO', label: 'Materiais de escritório' },
  { value: 'SERVICOS', label: 'Serviços' },
  { value: 'OUTROS', label: 'Outros' },
];

export function labelForOfferingCategory(slug: SupplierOfferingCategorySlug): string {
  return SUPPLIER_OFFERING_CATEGORY_OPTIONS.find((o) => o.value === slug)?.label ?? slug;
}

/** Rótulo para chips e listagens; inclui a descrição quando o slug for `OUTROS`. */
export function displayOfferingCategoryLabel(
  slug: SupplierOfferingCategorySlug,
  otherDetail?: string | null,
): string {
  if (slug !== 'OUTROS') {
    return labelForOfferingCategory(slug);
  }
  const trimmed = otherDetail?.trim();
  return trimmed ? `Outros (${trimmed})` : 'Outros';
}
