import * as React from 'react';

import { cn } from '@shared/lib/cn';

type TatarOrnamentProps = React.ComponentProps<'svg'> & {
  opacity?: number;
  variant?: 'crest' | 'border';
};

export const TatarOrnament = ({
  className,
  opacity = 0.08,
  variant = 'crest',
  ...props
}: TatarOrnamentProps) => {
  if (variant === 'border') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 360 72"
        fill="none"
        className={cn('text-primary pointer-events-none', className)}
        style={{ opacity, ...props.style }}
        {...props}
      >
        <path d="M16 36H344" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M180 8C190 20 203 27 220 28C204 33 191 43 180 60C169 43 156 33 140 28C157 27 170 20 180 8Z"
          fill="currentColor"
        />
        <path
          d="M180 20C185 27 193 31 202 32C193 35 185 40 180 50C175 40 167 35 158 32C167 31 175 27 180 20Z"
          fill="hsl(var(--accent))"
        />
        <path
          d="M118 22C132 25 142 32 148 43C134 42 123 36 114 26"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M242 22C228 25 218 32 212 43C226 42 237 36 246 26"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="180" cy="34" r="4" fill="hsl(var(--destructive))" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 220"
      fill="none"
      className={cn('text-primary pointer-events-none', className)}
      style={{ opacity, ...props.style }}
      {...props}
    >
      <path
        d="M120 20C142 43 168 58 202 61C170 73 143 96 120 136C97 96 70 73 38 61C72 58 98 43 120 20Z"
        fill="currentColor"
      />
      <path
        d="M120 48C132 63 148 72 168 76C149 84 133 99 120 122C107 99 91 84 72 76C92 72 108 63 120 48Z"
        fill="hsl(var(--accent))"
      />
      <path
        d="M64 104C88 107 106 120 118 144C91 145 70 133 52 112"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M176 104C152 107 134 120 122 144C149 145 170 133 188 112"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path d="M120 132V198" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <circle cx="120" cy="82" r="9" fill="hsl(var(--destructive))" />
      <path
        d="M94 184C106 174 134 174 146 184"
        stroke="hsl(var(--accent))"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
};
