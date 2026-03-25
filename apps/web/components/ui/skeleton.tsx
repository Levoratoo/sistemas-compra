import { cn } from '@/lib/utils';

/** Bloco de carregamento com pulso suave (evita “piscada” brusca em listas). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gradient-to-r from-muted via-muted/70 to-muted bg-[length:200%_100%]', className)} />;
}
