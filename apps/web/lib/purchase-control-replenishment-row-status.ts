import type { BudgetItem } from '@/types/api';

import { effectiveNextReplenishmentIso } from '@/lib/budget-item-replenishment-date';

export type PurchaseControlReplenishmentRowStatus = 'EM_DIA' | 'ATRASADO' | 'REPOSTO';

function todayLocalYmd(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isRepostoLabel(label: string | null | undefined): boolean {
  if (!label?.trim()) return false;
  return label.trim().toLowerCase().includes('reposto');
}

/**
 * Status da linha na tabela de datas previstas (controle de compras):
 * - Reposto: texto em "Status de Reposição" indica reposto (ex.: contém "reposto").
 * - Atrasado: data prevista anterior a hoje e ainda não marcado como reposto.
 * - Em dia: data prevista hoje ou futura.
 */
export function purchaseControlReplenishmentRowStatus(item: BudgetItem): PurchaseControlReplenishmentRowStatus {
  if (isRepostoLabel(item.replenishmentStateLabel)) {
    return 'REPOSTO';
  }

  const next = effectiveNextReplenishmentIso(item);
  if (!next) {
    return 'EM_DIA';
  }

  const nextDay = next.slice(0, 10);
  const today = todayLocalYmd();

  if (nextDay < today) {
    return 'ATRASADO';
  }

  return 'EM_DIA';
}
