import type { ReactNode } from 'react';

import { Button } from '@shared/ui/button';

import {
  MAX_VISIT_DURATION_MINUTES,
  MIN_VISIT_DURATION_MINUTES,
  type RoutePlace,
  VISIT_DURATION_STEP_MINUTES,
} from '../model/routePlaces';

type RoutePreviewPlaceProps = {
  place: RoutePlace;
  segmentControl?: ReactNode;
  categoryTitle: string;
  onVisitDurationChange: (placeId: string, durationMinutes: number) => void;
  onRemovePlace?: (placeId: string) => void;
};

export const RoutePreviewPlace = ({
  place,
  segmentControl,
  categoryTitle,
  onVisitDurationChange,
  onRemovePlace,
}: RoutePreviewPlaceProps) => {
  const canDecrease = place.visitDurationMinutes > MIN_VISIT_DURATION_MINUTES;
  const canIncrease = place.visitDurationMinutes < MAX_VISIT_DURATION_MINUTES;

  return (
    <li className="bg-background/55 rounded-xl border p-3">
      {segmentControl && <div className="-mt-1 mb-2">{segmentControl}</div>}

      <div className="flex gap-3">
        <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold">
          {place.order}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-semibold">
              {place.name}
            </h3>
            {onRemovePlace && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="rounded-md"
                aria-label={`Удалить ${place.name}`}
                onClick={() => {
                  onRemovePlace(place.id);
                }}
              >
                ×
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{categoryTitle}</p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">На месте</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                className="rounded-md"
                disabled={!canDecrease}
                onClick={() => {
                  onVisitDurationChange(
                    place.id,
                    place.visitDurationMinutes - VISIT_DURATION_STEP_MINUTES,
                  );
                }}
              >
                −
              </Button>
              <span className="w-14 text-center text-sm font-medium">
                {place.visitDurationMinutes} мин
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                className="rounded-md"
                disabled={!canIncrease}
                onClick={() => {
                  onVisitDurationChange(
                    place.id,
                    place.visitDurationMinutes + VISIT_DURATION_STEP_MINUTES,
                  );
                }}
              >
                +
              </Button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};
