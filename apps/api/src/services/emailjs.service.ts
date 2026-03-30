import type { MissingItemUrgency } from '@prisma/client';

import { env, getPublicAppUrl, isEmailJsConfigured } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

const urgencyLabelPt: Record<MissingItemUrgency, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

function formatRequestDatePtBr(date: Date): string {
  try {
    return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return date.toISOString();
  }
}

async function resolveApproverEmail(): Promise<string | null> {
  const fromEnv = env.OWNER_APPROVAL_EMAIL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const approver = await userRepository.findFirstActiveByRole('APPROVER');
  return approver?.email?.trim() ?? null;
}

/**
 * Envia e-mail ao aprovador (EmailJS) após nova solicitação de item faltante.
 * Destinatário: `OWNER_APPROVAL_EMAIL` no Render ou, se vazio, o primeiro utilizador ativo com papel APPROVER.
 * Falhas são apenas logadas — não propagam erro para a API.
 */
export async function notifyMissingItemReportCreated(params: {
  projectId: string;
  projectName: string;
  projectCode: string;
  reportId: string;
  requesterName: string;
  itemToAcquire: string;
  estimatedQuantity: string;
  necessityReason: string;
  urgencyLevel: MissingItemUrgency;
  requestDate: Date;
}): Promise<void> {
  if (!isEmailJsConfigured()) {
    return;
  }

  const serviceId = env.EMAILJS_SERVICE_ID?.trim();
  const templateId = env.EMAILJS_TEMPLATE_ID?.trim();
  const publicKey = env.EMAILJS_PUBLIC_KEY?.trim();
  const ownerEmail = env.OWNER_APPROVAL_EMAIL?.trim();

  if (!serviceId || !templateId || !publicKey || !ownerEmail) {
    return;
  }

  const baseUrl = getPublicAppUrl();
  const approvalUrl = `${baseUrl}/projects/${encodeURIComponent(params.projectId)}/missing-items`;

  const template_params: Record<string, string> = {
    owner_email: ownerEmail,
    approver_email: ownerEmail,
    to_email: ownerEmail,
    project_name: params.projectName,
    project_code: params.projectCode,
    project_id: params.projectId,
    report_id: params.reportId,
    requester_name: params.requesterName,
    item_to_acquire: params.itemToAcquire,
    estimated_quantity: params.estimatedQuantity,
    necessity_reason: params.necessityReason,
    urgency_level: params.urgencyLevel,
    urgency_label: urgencyLabelPt[params.urgencyLevel] ?? params.urgencyLevel,
    request_date: formatRequestDatePtBr(params.requestDate),
    approval_url: approvalUrl,
    subject_line: `[Itens faltantes] ${params.projectCode} — ${params.itemToAcquire}`,
  };

  const body: Record<string, unknown> = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params,
  };

  const privateKey = env.EMAILJS_PRIVATE_KEY?.trim();
  if (privateKey) {
    body.accessToken = privateKey;
  }

  const res = await fetch(EMAILJS_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error('[emailjs] send failed', res.status, text.slice(0, 500));
  }
}
