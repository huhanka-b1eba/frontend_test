import type { RouteLeg } from '@shared/api/osrm';
import { Button } from '@shared/ui/button';
import { List, LocateFixed, Pause, Play, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatNavigationDistance, type NavigationPlace, type NavigationStatus } from '../model';

type NavigationBottomSheetProps = {
  place: NavigationPlace | null;
  leg: RouteLeg | null;
  status: NavigationStatus;
  currentPlaceIndex: number;
  totalPlaces: number;
  onOpenList: () => void;
  onPause: () => void;
  onResume: () => void;
  onRecenter: () => void;
  onRebuild?: () => void;
};

export const NavigationBottomSheet = ({
  place,
  leg,
  status,
  currentPlaceIndex,
  totalPlaces,
  onOpenList,
  onPause,
  onResume,
  onRecenter,
  onRebuild,
}: NavigationBottomSheetProps) => {
  const { t } = useTranslation();
  const progressLabel =
    totalPlaces > 0 ? `${Math.min(currentPlaceIndex + 1, totalPlaces)} / ${totalPlaces}` : null;
  const legLabel = leg
    ? `${formatNavigationDistance(leg.distance)} · ${Math.round(leg.duration / 60)} мин`
    : 'Маршрут строится';

  return (
    <section className="bg-card/98 text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-20 rounded-t-xl border-t px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="bg-card/95 absolute -top-14 right-4 size-11 rounded-xl shadow-[0_10px_26px_-18px_rgba(0,0,0,0.55)] backdrop-blur"
        aria-label="Вернуться к текущему местоположению"
        onClick={onRecenter}
      >
        <LocateFixed className="size-5" />
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">Следующая точка</p>
          <h2 className="mt-0.5 line-clamp-1 text-base leading-tight font-semibold">
            {place?.name ?? 'Маршрут'}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{legLabel}</p>
        </div>

        {progressLabel && (
          <p className="text-muted-foreground shrink-0 pt-5 text-sm font-medium">{progressLabel}</p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-background/70 h-10 rounded-lg"
          onClick={onOpenList}
        >
          <List className="size-4" />
          Список
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-background/70 h-10 rounded-lg"
          onClick={onRebuild}
        >
          <RefreshCw className="size-4" />
          {t('navigation.rebuild.button')}
        </Button>
        {status === 'paused' ? (
          <Button type="button" size="sm" className="h-10 rounded-lg" onClick={onResume}>
            <Play className="size-4" />
            Продолжить
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-10 rounded-lg"
            onClick={onPause}
          >
            <Pause className="size-4" />
            Пауза
          </Button>
        )}
      </div>
    </section>
  );
};
