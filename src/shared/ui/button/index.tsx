import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/cn';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl text-sm font-extrabold tracking-[0.01em] whitespace-nowrap outline-none transition-[background,color,border-color,transform,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/55 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'border-2 border-primary bg-primary text-primary-foreground shadow-[0_4px_0_var(--primary-dark)] hover:bg-[#61d80b] active:translate-y-1 active:shadow-none',
        destructive:
          'border-2 border-destructive bg-destructive text-destructive-foreground shadow-[0_4px_0_#d93636] hover:bg-[#ff5f5f] active:translate-y-1 active:shadow-none focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border-2 border-border bg-background text-foreground shadow-[0_4px_0_hsl(var(--border))] hover:bg-secondary active:translate-y-1 active:shadow-none dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'border-2 border-border bg-secondary text-secondary-foreground shadow-[0_4px_0_hsl(var(--border))] hover:bg-background active:translate-y-1 active:shadow-none',
        ghost:
          'rounded-xl border-2 border-transparent text-muted-foreground shadow-none hover:bg-secondary hover:text-foreground active:translate-y-0',
        navigation:
          'border-2 border-primary bg-primary text-primary-foreground shadow-[0_4px_0_var(--primary-dark)] hover:bg-[#61d80b] active:translate-y-1 active:shadow-none',
        link: 'rounded-xl text-primary shadow-none underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        default: 'h-12 px-5 py-2.5 has-[>svg]:px-4',
        xs: "h-7 gap-1 rounded-xl px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-10 gap-1.5 rounded-xl px-4 has-[>svg]:px-3.5',
        lg: 'h-14 px-7 text-base has-[>svg]:px-6',
        icon: 'size-12',
        'icon-xs': "size-7 rounded-xl [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-10 rounded-xl',
        'icon-lg': 'size-14',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
