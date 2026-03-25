import * as React from 'react';

import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-sm font-semibold leading-none text-card-foreground peer-disabled:opacity-70', className)}
      {...props}
    />
  );
}
