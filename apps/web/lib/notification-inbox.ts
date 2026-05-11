import type { AppNotification } from '@/types/api';

function localCalendarDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function inboxDayKey(iso?: string | null) {
  if (!iso) {
    return '__missing__';
  }

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) {
    return '__missing__';
  }

  return localCalendarDayKey(d);
}

function startOfCalendarDay(deltaDaysFromToday: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - deltaDaysFromToday);
  return localCalendarDayKey(d);
}

/** Título da seção agrupando notificações (Hoje / Ontem / data longa em pt-BR). */
export function formatInboxDayHeading(dayKey: string) {
  if (!dayKey || dayKey === '__missing__') {
    return 'Sem data';
  }

  const today = startOfCalendarDay(0);
  const yesterday = startOfCalendarDay(1);

  if (dayKey === today) {
    return 'Hoje';
  }

  if (dayKey === yesterday) {
    return 'Ontem';
  }

  const [yStr, mStr, dStr] = dayKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const day = Number(dStr);

  const dt = new Date(y, m - 1, day);

  if (Number.isNaN(dt.getTime())) {
    return 'Sem data';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

export function notificationActionHref(notification: AppNotification): string {
  if (notification.type === 'SUPPLIER_CND_ALERT' && notification.supplierId) {
    return `/suppliers/${notification.supplierId}`;
  }

  if (notification.projectId) {
    return `/projects/${notification.projectId}/purchase-control`;
  }

  return '/projects';
}

/**
 * Área funcional onde o usuário deve agir (“lugar no site”).
 * Preferimos breadcrumbs curtos compatíveis com o menu lateral.
 */
export function notificationSiteOrigin(notification: AppNotification): string {
  if (notification.type === 'SUPPLIER_CND_ALERT') {
    return 'Fornecedores · Cadastro · CND';
  }

  if (notification.type === 'REPLENISHMENT_DUE_SOON') {
    return notification.project ? 'Contratos · Controle de compras · Reposição' : 'Controle de compras · Reposição';
  }

  return 'Sistema';
}

/** Referência ao projeto (reposição). CND já traz o nome no título da notificação. */
export function notificationContextLine(notification: AppNotification): string | null {
  if (notification.type === 'REPLENISHMENT_DUE_SOON' && notification.project) {
    const { code, name } = notification.project;
    const shortName = name.length > 48 ? `${name.slice(0, 45)}…` : name;

    return `${code} · ${shortName}`;
  }

  return null;
}

export function sortDayKeysDescending(keys: string[]) {
  const unique = [...new Set(keys)];
  const missing = unique.includes('__missing__');
  const dated = unique.filter((k) => k && k !== '__missing__');

  dated.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  if (missing) {
    dated.push('__missing__');
  }

  return dated;
}

export function isMissingDayKey(dayKey: string) {
  return dayKey === '__missing__';
}
