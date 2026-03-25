import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[color,box-shadow,transform,background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary px-5 py-2.5 text-primary-foreground shadow-md shadow-primary/10 hover:bg-primary/92 hover:shadow-lg hover:shadow-primary/15',
        secondary:
          'border border-border/90 bg-secondary px-5 py-2.5 text-secondary-foreground shadow-sm hover:bg-secondary/90 hover:shadow-md',
        outline:
          'border border-border bg-card px-5 py-2.5 text-card-foreground shadow-sm hover:border-primary/25 hover:bg-muted/50 hover:shadow',
        ghost: 'px-3.5 py-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground',
        destructive:
          'bg-destructive px-5 py-2.5 text-destructive-foreground shadow-sm hover:bg-destructive/92 hover:shadow-md',
      },
      size: {
        default: 'h-11 min-w-[2.75rem]',
        sm: 'h-9 min-w-[2.25rem] rounded-lg px-3 text-xs',
        lg: 'h-12 min-w-[3rem] rounded-xl px-6 text-[15px]',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = 'Button';
