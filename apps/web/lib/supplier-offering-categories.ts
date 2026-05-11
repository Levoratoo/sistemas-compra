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
