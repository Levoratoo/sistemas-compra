import type { BudgetItem } from '@/types/api';

/**
 * Métricas do acompanhamento de status (por projeto), alinhadas à planilha de controle:
 * itens não encerrados na unidade são contados em exatamente uma das três fases.
 */
export function computePurchasePipelineMetrics(budgetItems: BudgetItem[]) {
  const rows = budgetItems.filter((i) => !(i.contextOnly ?? false));

  let pendingCompra = 0;
  let pendingPagamento = 0;
  let posPagamentoNaoEntregue = 0;

  for (const it of rows) {
    if (it.opDeliveredAt) continue;

    if (it.purchasedValue == null) {
      pendingCompra += 1;
    } else if (!it.opPaymentSentAt) {
      pendingPagamento += 1;
    } else {
      posPagamentoNaoEntregue += 1;
    }
  }

  const pendenciasConduzidas = pendingCompra + pendingPagamento + posPagamentoNaoEntregue;

  return {
    pendingCompra,
    pendingPagamento,
    posPagamentoNaoEntregue,
    pendenciasConduzidas,
  };
}
