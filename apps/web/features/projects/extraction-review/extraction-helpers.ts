import type { ItemCategory } from '@/types/api';

export type ParsedBudgetLineJson = {
  description?: string;
  quantity?: string;
  valueOrUnit?: string;
  monthlyOrTotal?: string;
  value?: string;
  totalOrUnit?: string;
  role?: string | null;
  /** Referência no edital (ex.: 8.3.1). */
  itemRef?: string;
  /** Origem da linha extraída (ex.: seção 7 do edital). */
  source?: string;
  sectionLabel?: string;
};

export function parseBudgetLineJson(proposedValue: string): ParsedBudgetLineJson | null {
  try {
    return JSON.parse(proposedValue) as ParsedBudgetLineJson;
  } catch {
    return null;
  }
}

/** Primeiro valor em R$ encontrado na string (formato BR). */
export function parseFirstBrlNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/);
  if (!m) return null;
  return Number(m[1].replace(/\./g, '').replace(',', '.'));
}

export function pickBidUnitValue(j: ParsedBudgetLineJson): number | null {
  const fromUnit = parseFirstBrlNumber(j.valueOrUnit ?? j.value);
  if (fromUnit != null) return fromUnit;
  return parseFirstBrlNumber(j.totalOrUnit ?? j.monthlyOrTotal);
}

/**
 * Quantidade no JSON pode ser número puro (edital CONSAMU) ou texto do TR ("02 unidades", "03 pares").
 */
export function parseQuantity(j: ParsedBudgetLineJson): number | null {
  const raw = j.quantity;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const unitMatch = s.match(/^(\d{1,6})\s*(?:unidades?|pares?|par)\b/i);
  if (unitMatch) {
    const n = Number.parseInt(unitMatch[1], 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  if (Number.isFinite(n) && n >= 0) return n;
  return null;
}

export function guessItemCategory(
  description: string,
  roleHint: string | null,
  sourceHint?: string,
): ItemCategory {
  if (sourceHint === 'edital_secao_8_epi_lista') return 'EPI';
  if (sourceHint === 'edital_secao_8_uniforme_epi') {
    const td = description.toLowerCase();
    if (/\bepi\b|capacete|luva|máscara|óculos|protetor|avental\b/.test(td)) return 'EPI';
    return 'UNIFORM';
  }
  const t = `${description} ${roleHint ?? ''}`.toLowerCase();
  if (/\buniforme|camisa|calça|blusa|calçado|tênis|bota|vestuário\b/.test(t)) return 'UNIFORM';
  if (/\bepi|luva|máscara|óculos|protetor|capacete|avental|respi\b/.test(t)) return 'EPI';
  if (/\bequipamento|máquina|ferramenta|notebook|computador|impressora\b/.test(t)) return 'EQUIPMENT';
  if (/\bconsumo|material de consumo|detergente|papel\b/.test(t)) return 'CONSUMABLE';
  return 'OTHER';
}

/**
 * Parágrafos normativos da seção 8.7 (referência 8.7.x, origem uniforme_epi).
 * Listas com traço sob 8.7 (epi_lista) são itens de compra.
 * Na revisão de extração, linhas com isto a true são omitidas da tabela (não viram item de compra).
 */
export function isEditalBudgetLineContextOnly(j: ParsedBudgetLineJson | null): boolean {
  if (!j?.source) return false;
  if (j.source === 'edital_secao_7') return false;
  if (j.source === 'edital_secao_8_epi_lista') return false;
  if (j.source === 'edital_secao_8_uniforme_epi') {
    const ref = j.itemRef ?? '';
    return /^8\.7\.\d+/.test(ref);
  }
  return false;
}

export function formatBudgetLinePreview(proposedValue: string) {
  const j = parseBudgetLineJson(proposedValue);
  if (!j?.description) return proposedValue.slice(0, 400);
  const parts = [
    j.itemRef ? `${j.itemRef} — ${j.description}` : j.description,
    j.quantity ? `Qtd ${j.quantity}` : null,
    j.valueOrUnit ?? j.value,
    j.monthlyOrTotal ?? j.totalOrUnit,
  ].filter(Boolean);
  return parts.join(' · ');
}
