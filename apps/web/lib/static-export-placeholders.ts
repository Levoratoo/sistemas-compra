/**
 * Rotas dinâmicas com `output: 'export'` precisam de pelo menos um path no build
 * (Next não aceita `generateStaticParams` que resulte em lista vazia).
 * IDs reais continuam a funcionar em navegação cliente (dynamicParams).
 */
export const STATIC_EXPORT_PROJECT_ID = '0';
export const STATIC_EXPORT_DOCUMENT_ID = '0';
export const STATIC_EXPORT_BUDGET_ITEM_ID = '0';
export const STATIC_EXPORT_SUPPLIER_ID = '0';
