'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { formatInboxTime } from '@/lib/format';
import {
  formatInboxDayHeading,
  inboxDayKey,
  notificationActionHref,
  notificationContextLine,
  notificationSiteOrigin,
  sortDayKeysDescending,
} from '@/lib/notification-inbox';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types/api';

export function NotificationsInboxBody({
  items,
  isLoading,
  isError,
  onOpenItem,
}: {
  items: AppNotification[];
  isLoading: boolean;
  isError: boolean;
  onOpenItem: (notification: AppNotification) => void;
}) {
  const sections = useMemo(() => {
    const byDay = new Map<string, AppNotification[]>();

    for (const n of items) {
      const k = inboxDayKey(n.createdAt);
      const bucket = byDay.get(k) ?? [];
      bucket.push(n);
      byDay.set(k, bucket);
    }

    const keys = sortDayKeysDescending([...byDay.keys()]);

    return keys.map((dayKey) => ({ dayKey, dayItems: byDay.get(dayKey) ?? [] }));
  }, [items]);

  if (isLoading) {
    return <p className="px-3 py-10 text-center text-sm text-muted-foreground">A carregar…</p>;
  }

  if (isError) {
    return <p className="px-3 py-10 text-center text-sm text-destructive">Não foi possível carregar.</p>;
  }

  if (!items.length) {
    return (
      <p className="px-3 py-10 text-center text-sm text-muted-foreground">Sem notificações no histórico recente.</p>
    );
  }

  return (
    <div className="space-y-7 py-1">
      {sections.map(({ dayKey, dayItems }) => (
        <section className="space-y-0" key={dayKey}>
          <h2 className="sticky top-0 z-[1] border-b border-border/70 bg-background/95 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-sm">
            {formatInboxDayHeading(dayKey)}
          </h2>
          <ul className="divide-y divide-border/55">
            {dayItems.map((n) => {
              const origin = notificationSiteOrigin(n);
              const context = notificationContextLine(n);
              const href = notificationActionHref(n);

              return (
                <li key={n.id}>
                  <Link
                    className={cn(
                      'grid grid-cols-[3.25rem_1fr] gap-x-3 px-2 py-3.5 text-left transition hover:bg-muted/50',
                      !n.readAt && 'bg-primary/[0.055]',
                    )}
                    href={href}
                    onClick={() => {
                      onOpenItem(n);
                    }}
                  >
                    <span className="shrink-0 text-right text-[11px] font-medium tabular-nums text-muted-foreground">
                      {formatInboxTime(n.createdAt)}
                    </span>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[11px] leading-tight text-muted-foreground">{origin}</span>
                        {!n.readAt ? (
                          <Badge className="h-5 px-1.5 py-0 text-[10px] font-medium" variant="secondary">
                            Novo
                          </Badge>
                        ) : null}
                      </div>
                      {context ? <p className="text-xs font-medium text-primary/90">{context}</p> : null}
                      <p className="text-sm font-semibold leading-snug text-foreground">{n.title}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
