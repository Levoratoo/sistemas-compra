import type { SupplierCndAttachment } from '@prisma/client';

import { deriveDualSupplierCndStatus } from './supplier-cnd-status.js';

function pickLatestScoped(
  attachments: SupplierCndAttachment[] | undefined,
  scope: 'FEDERAL' | 'STATE',
): SupplierCndAttachment | undefined {
  if (!attachments?.length) {
    return undefined;
  }
  let best: SupplierCndAttachment | undefined;
  for (const att of attachments) {
    if (att.scope !== scope) {
      continue;
    }
    if (!best || att.createdAt.getTime() > best.createdAt.getTime()) {
      best = att;
    }
  }
  return best;
}

export function buildSupplierCndAlertPayload(input: {
  legalName: string;
  attachments: SupplierCndAttachment[] | undefined;
  referenceDate?: Date;
}): { title: string; body: string } | null {
  const { legalName, attachments } = input;
  const federalAtt = pickLatestScoped(attachments, 'FEDERAL');
  const stateAtt = pickLatestScoped(attachments, 'STATE');
  const hasFederalFile = Boolean(federalAtt);
  const hasStateFile = Boolean(stateAtt);

  const missing: string[] = [];
  if (!hasFederalFile) {
    missing.push('CND federal');
  }
  if (!hasStateFile) {
    missing.push('CND estadual');
  }

  const derived = deriveDualSupplierCndStatus(
    federalAtt?.parsedValidUntil ?? null,
    stateAtt?.parsedValidUntil ?? null,
    input.referenceDate ?? new Date(),
  );

  if (derived.status === 'EXPIRED') {
    const extra = missing.length ? ` Falta também: ${missing.join(' e ')}.` : '';
    return {
      title: `CND vencida: ${legalName}`,
      body: `A validade consolidada está vencida. Renovar as certidões.${extra}`,
    };
  }

  if (derived.status === 'EXPIRING_SOON') {
    const dias =
      derived.daysUntilExpiration != null
        ? derived.daysUntilExpiration === 0
          ? 'vence hoje'
          : `vence em ${derived.daysUntilExpiration} dia(s)`
        : 'está próxima do vencimento';
    return {
      title: `CND a vencer: ${legalName}`,
      body: `Pelo menos uma certidão ${dias}. Providencie renovação.${missing.length ? ` Atenção: falta enviar ${missing.join(' e ')}.` : ''}`,
    };
  }

  if (missing.length > 0) {
    const who = missing.length === 2 ? 'federal e estadual' : missing[0]!.toLowerCase();
    return {
      title: `CND incompleta: ${legalName}`,
      body: `Este fornecedor não possui ${who}. Envie os PDFs para conformidade.`,
    };
  }

  return null;
}
