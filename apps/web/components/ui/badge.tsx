import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-teal-800 ring-primary/20',
        secondary: 'bg-slate-100 text-slate-700 ring-slate-200/80',
        success: 'bg-emerald-50 text-emerald-900 ring-emerald-200/90',
        warning: 'bg-amber-50 text-amber-950 ring-amber-200/90',
        danger: 'bg-red-50 text-red-900 ring-red-200/90',
        neutral: 'bg-slate-100/90 text-slate-600 ring-slate-200/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Badge({
  className,
  variant,
  children,
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
