import { useTranslation } from 'react-i18next';
import { Bike, Bus, Car, Footprints } from 'lucide-react';

import type { TransportMode } from '@shared/lib/transport';
import { Button } from '@shared/ui/button';

const TRANSPORT_OPTIONS: Array<{
  mode: TransportMode;
  Icon: typeof Footprints;
}> = [
  { mode: 'walking', Icon: Footprints },
  { mode: 'cycling', Icon: Bike },
  { mode: 'driving', Icon: Car },
  { mode: 'transit', Icon: Bus },
];

type TransportModeSelectorProps = {
  value: TransportMode;
  onChange: (mode: TransportMode) => void;
};

export const TransportModeSelector = ({ value, onChange }: TransportModeSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium">{t('app.transport.title')}</p>
      <div className="bg-background/65 flex gap-1 overflow-x-auto rounded-lg border p-1">
        {TRANSPORT_OPTIONS.map(({ mode, Icon }) => {
          const isActive = mode === value;

          return (
            <Button
              key={mode}
              type="button"
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-md px-2.5 text-xs"
              onClick={() => {
                onChange(mode);
              }}
            >
              <Icon className="size-3.5" />
              {t(`app.transport.labels.${mode}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
