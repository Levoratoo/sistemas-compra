import * as React from 'react';

import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b border-border/80 bg-muted/40 [&_tr]:border-b-0', className)}
      {...props}
    />
  );
}

type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement> & {
  /** Linhas alternadas para leitura longa */
  striped?: boolean;
};

export function TableBody({ className, striped = true, ...props }: TableBodyProps) {
  return (
    <tbody
      className={cn(
        striped && '[&_tr:nth-child(even)]:bg-muted/15',
        className,
      )}
      {...props}
    />
  );
}

type TableRowProps = React.HTMLAttributes<HTMLTableRowElement> & {
  /** Cabeçalho não usa zebra/hover de linha de dados */
  variant?: 'body' | 'header';
};

export function TableRow({ className, variant = 'body', ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'border-b border-border/50 transition-colors duration-150',
        variant === 'body' && 'hover:bg-muted/45',
        variant === 'header' && 'hover:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-12 px-5 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-5 py-3.5 align-middle text-card-foreground', className)} {...props} />
  );
}
