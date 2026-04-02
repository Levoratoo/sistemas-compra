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

export function supplierCndStatusLabel(supplier: Supplier) {
  if (supplier.cndStatus === 'EXPIRED') {
    return 'CND expirada';
  }

  if (supplier.cndStatus === 'EXPIRING_SOON') {
    if (supplier.cndDaysUntilExpiration === 0) {
      return 'Vence hoje';
    }

    if (supplier.cndDaysUntilExpiration != null && supplier.cndDaysUntilExpiration > 0) {
      return `Vence em ${supplier.cndDaysUntilExpiration} dia(s)`;
    }

    return 'CND proxima do vencimento';
  }

  if (supplier.cndStatus === 'VALID') {
    return 'CND valida';
  }

  return 'Sem leitura de validade';
}

export function supplierCndStatusDescription(supplier: Supplier) {
  if (supplier.cndStatus === 'EXPIRED') {
    return 'Suba uma nova certidao para atualizar a vigencia.';
  }

  if (supplier.cndStatus === 'EXPIRING_SOON') {
    return 'Renove a certidao em breve para evitar bloqueio operacional.';
  }

  if (supplier.cndStatus === 'VALID') {
    return 'Validade detectada automaticamente no PDF da CND.';
  }

  return supplier.cndSourceFileName
    ? 'O arquivo foi enviado, mas a validade nao foi identificada automaticamente.'
    : 'Envie a CND em PDF para que o sistema leia a validade automaticamente.';
}
