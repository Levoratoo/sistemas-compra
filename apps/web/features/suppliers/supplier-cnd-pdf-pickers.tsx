'use client';

import { FileUp, X } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  federalFile: File | null;
  estadualFile: File | null;
  onFederalFile: (file: File | null) => void;
  onEstadualFile: (file: File | null) => void;
  compact?: boolean;
};

export function SupplierCndPdfPickers({ federalFile, estadualFile, onFederalFile, onEstadualFile, compact }: Props) {
  const rid = useId().replace(/:/g, '');
  const fedId = `cnd-fed-${rid}`;
  const estId = `cnd-est-${rid}`;

  return (
    <div className={cn('grid gap-5', compact ? 'sm:grid-cols-1' : 'sm:grid-cols-2')}>
      <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
        <Label htmlFor={fedId} className="text-sm font-medium">
          CND federal
        </Label>
        <p className="text-[11px] leading-snug text-muted-foreground">
          PDF da Receita Federal (ou órgão federal competente).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/50"
            htmlFor={fedId}
          >
            <FileUp className="size-4 shrink-0 text-primary" aria-hidden />
            Escolher arquivo
          </label>
          <input
            className="sr-only"
            id={fedId}
            accept="application/pdf,.pdf"
            type="file"
            onChange={(event) => {
              const f = event.target.files?.[0] ?? null;
              onFederalFile(f);
              event.target.value = '';
            }}
          />
        </div>
        {federalFile ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 break-all text-foreground">{federalFile.name}</span>
            <Button className="shrink-0" size="sm" type="button" variant="ghost" onClick={() => onFederalFile(null)}>
              <X className="size-4" aria-hidden />
              <span className="sr-only">Remover</span>
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
        <Label htmlFor={estId} className="text-sm font-medium">
          CND estadual
        </Label>
        <p className="text-[11px] leading-snug text-muted-foreground">
          PDF da Fazenda estadual (UF) ou órgão estadual competente.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/50"
            htmlFor={estId}
          >
            <FileUp className="size-4 shrink-0 text-primary" aria-hidden />
            Escolher arquivo
          </label>
          <input
            className="sr-only"
            id={estId}
            accept="application/pdf,.pdf"
            type="file"
            onChange={(event) => {
              const f = event.target.files?.[0] ?? null;
              onEstadualFile(f);
              event.target.value = '';
            }}
          />
        </div>
        {estadualFile ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 break-all text-foreground">{estadualFile.name}</span>
            <Button className="shrink-0" size="sm" type="button" variant="ghost" onClick={() => onEstadualFile(null)}>
              <X className="size-4" aria-hidden />
              <span className="sr-only">Remover</span>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
