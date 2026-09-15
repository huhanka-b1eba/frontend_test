import type { PropsWithChildren } from 'react';

import { QueryProvider } from './query';
import { TooltipProvider } from '@shared/ui/tooltip';

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <QueryProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryProvider>
  );
};
