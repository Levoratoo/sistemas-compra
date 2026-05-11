import type { Supplier } from '@/types/api';

export function supplierCndBadgeVariant(supplier: Supplier) {
  if (supplier.cndStatus === 'EXPIRED') {
    return 'danger' as const;
  }

  if (supplier.cndStatus === 'EXPIRING_SOON') {
    return 'warning' as const;
  }

  if (supplier.cndStatus === 'VALID') {
    return 'success' as const;
  }

  return 'secondary' as const;
}

export function supplierCndMissingSummary(supplier: Supplier): string | null {
  const missFed = !supplier.cndFederalPresent;
  const missSt = !supplier.cndStatePresent;
  if (!missFed && !missSt) {
    return null;
  }
  if (missFed && missSt) {
    return 'Sem CND federal e sem CND estadual';
  }
  if (missFed) {
    return 'Sem CND federal';
  }
  return 'Sem CND estadual';
}

export function supplierCndStatusLabel(supplier: Supplier) {
  const missingSummary = supplierCndMissingSummary(supplier);

  if (supplier.cndStatus === 'EXPIRED') {
    return missingSummary ? `CND vencida — ${missingSummary.toLowerCase()}` : 'CND vencida';
  }

  if (supplier.cndStatus === 'EXPIRING_SOON') {
    if (supplier.cndDaysUntilExpiration === 0) {
      return missingSummary ? `${missingSummary}; vence hoje` : 'Vence hoje';
    }

    if (supplier.cndDaysUntilExpiration != null && supplier.cndDaysUntilExpiration > 0) {
      return missingSummary
        ? `${missingSummary}; válida até ${supplier.cndDaysUntilExpiration} dia(s)`
        : `Vence em ${supplier.cndDaysUntilExpiration} dia(s)`;
    }

    return missingSummary ? `${missingSummary}; próxima do vencimento` : 'CND próxima do vencimento';
  }

  if (supplier.cndStatus === 'VALID') {
    return 'CND válida';
  }

  if (missingSummary) {
    return missingSummary;
  }

  return 'Sem leitura de validade';
}

export function supplierCndStatusDescription(supplier: Supplier) {
  const missingSummary = supplierCndMissingSummary(supplier);

  if (supplier.cndStatus === 'EXPIRED') {
    return 'Suba uma nova certidão para atualizar a vigência.';
  }

  if (supplier.cndStatus === 'EXPIRING_SOON') {
    return 'Renove a certidão em breve para evitar bloqueio operacional.';
  }

  if (supplier.cndStatus === 'VALID') {
    return 'Validade detectada automaticamente nas CND federal e/ou estadual em PDF.';
  }

  if (missingSummary) {
    return 'Envie o PDF correspondente ou complete o par federal + estadual para conformidade.';
  }

  return supplier.cndSourceFileName
    ? 'O arquivo foi enviado, mas a validade não foi identificada automaticamente em uma ou nas duas certidões.'
    : 'Envie as CND federal e estadual em PDF para que o sistema leia as validades automaticamente.';
}
