import { Button } from '@shared/ui/button';
import { CheckCircle2 } from 'lucide-react';

import type { NavigationPlace } from '../model';

type ArrivalSheetProps = {
  place: NavigationPlace;
  onContinue: () => void;
};

export const ArrivalSheet = ({ place, onContinue }: ArrivalSheetProps) => {
  return (
    <section className="bg-card text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-30 rounded-t-xl border-t px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex items-start gap-3">
        <div className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-xl">
          <CheckCircle2 className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-primary text-sm font-semibold">Вы пришли</p>
          <h2 className="mt-0.5 line-clamp-2 font-semibold">{place.name}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {place.visitDurationMinutes} мин на осмотр
          </p>
        </div>
      </div>

      <Button type="button" className="mt-4 w-full rounded-xl" onClick={onContinue}>
        Продолжить маршрут
      </Button>
    </section>
  );
};
