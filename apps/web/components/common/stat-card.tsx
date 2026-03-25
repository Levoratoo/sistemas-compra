import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export function StatCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="group overflow-hidden border-border/80 bg-gradient-to-br from-card to-muted/25 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="relative p-6">
        <div className="absolute right-4 top-4 rounded-xl bg-primary/10 p-2.5 text-primary transition duration-200 group-hover:bg-primary/15">
          <Icon className="size-5" aria-hidden />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
        <p
          className={
            value.length > 42
              ? 'mt-4 break-words font-heading text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg'
              : 'mt-4 break-words font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl'
          }
        >
          {value}
        </p>
        {helper ? <p className="mt-2 text-sm font-medium leading-snug text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
