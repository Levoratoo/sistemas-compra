import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Ícone opcional para contextualizar (ex.: carrinho em compras). */
  icon?: LucideIcon;
}) {
  const hasPrimary = Boolean(actionLabel && onAction);
  const hasSecondary = Boolean(secondaryActionLabel && onSecondaryAction);

  return (
    <Card className="border-dashed border-border/80 bg-muted/20 shadow-none transition-shadow hover:shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center sm:px-10 sm:py-14">
        <div className="rounded-2xl bg-primary/10 p-4 text-primary ring-1 ring-primary/15">
          <Icon className="size-8" aria-hidden />
        </div>
        <div className="space-y-2">
          <h3 className="font-heading text-lg font-semibold tracking-tight text-card-foreground">{title}</h3>
          <p className="max-w-md text-sm font-medium leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {hasPrimary || hasSecondary ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {hasPrimary ? (
              <Button className="shadow-md shadow-primary/10" onClick={onAction} size="lg" type="button">
                {actionLabel}
              </Button>
            ) : null}
            {hasSecondary ? (
              <Button onClick={onSecondaryAction} size="lg" type="button" variant="secondary">
                {secondaryActionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
