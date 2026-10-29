import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const canDecrease = place.visitDurationMinutes > MIN_VISIT_DURATION_MINUTES;
  const canIncrease = place.visitDurationMinutes < MAX_VISIT_DURATION_MINUTES;

  return (
    <li className="bg-background/55 min-w-0 rounded-xl border p-3">
      {segmentControl && <div className="-mt-1 mb-2">{segmentControl}</div>}

      <div className="flex min-w-0 gap-3">
        <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold">
          {place.order}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <h3 className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-semibold break-words">
              {place.name}
            </h3>
            {onRemovePlace && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="rounded-md"
                aria-label={t('routeBuilderV2.sidebar.removePlace', { name: place.name })}
                onClick={() => {
                  onRemovePlace(place.id);
                }}
              >
                ×
              </Button>
            )}
          </div>
          <p className="text-muted-foreground min-w-0 text-xs break-words">{categoryTitle}</p>

          <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground min-w-0 text-xs">
              {t('routeBuilderV2.sidebar.visitTime')}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
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
              <span className="w-12 text-center text-sm font-medium whitespace-nowrap">
                {t('routeBuilderV2.sidebar.inspect', {
                  minutes: place.visitDurationMinutes,
                }).replace(/^.*?·\s*/, '')}
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
