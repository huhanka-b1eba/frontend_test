import { Button } from '@shared/ui/button';
import { Check, X } from 'lucide-react';

import type { NavigationPlace } from '../model';

type NavigationRouteListProps = {
  open: boolean;
  places: NavigationPlace[];
  currentPlaceIndex: number;
  onClose: () => void;
};

export const NavigationRouteList = ({
  open,
  places,
  currentPlaceIndex,
  onClose,
}: NavigationRouteListProps) => {
  if (!open) {
    return null;
  }

  const remainingPlaces = Math.max(places.length - currentPlaceIndex, 0);

  return (
    <section className="bg-card text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-30 max-h-[72dvh] overflow-hidden rounded-t-xl border-t">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Маршрут</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">Осталось: {remainingPlaces} мест</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-lg"
          aria-label="Закрыть список маршрута"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <ol className="max-h-[calc(72dvh-4.5rem)] overflow-y-auto">
        {places.map((place, index) => (
          <li key={place.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold">
              {index < currentPlaceIndex ? <Check className="size-4" /> : place.order}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{place.name}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};
