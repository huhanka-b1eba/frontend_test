import type { RouteResult } from '@shared/api/osrm';
import type { Place } from '@shared/api/overpass';
import { TRANSPORT_MODE_TRAVEL_LABELS, type TransportMode } from '@shared/lib/transport';
import { Button } from '@shared/ui/button';

import {
  formatDistanceMeters,
  formatDurationMinutes,
  getTotalRouteDurationMinutes,
  getTravelDurationMinutes,
  getVisitDurationMinutes,
} from '../model/routeDuration';
import type { RoutePlace } from '../model/routePlaces';
import { RoutePreviewPlace } from './RoutePreviewPlace';
import { TransportModeSelector } from './TransportModeSelector';

type RouteSidebarProps = {
  places: RoutePlace[];
  route: RouteResult | null;
  routeDirty: boolean;
  hasUserLocation: boolean;
  isRouteLoading: boolean;
  isOptimizing: boolean;
  isOptimized: boolean;
  routeError: string | null;
  optimizationError: string | null;
  transportMode: TransportMode;
  getCategoryTitle: (place: Place) => string;
  onTransportModeChange: (mode: TransportMode) => void;
  onBuildRoute: () => void;
  onOptimizeRoute: () => void;
  onStartNavigation: () => void;
  onClearRoute: () => void;
  onRemovePlace: (placeId: string) => void;
  onVisitDurationChange: (placeId: string, durationMinutes: number) => void;
};

export const RouteSidebar = ({
  places,
  route,
  routeDirty,
  hasUserLocation,
  isRouteLoading,
  isOptimizing,
  isOptimized,
  routeError,
  optimizationError,
  transportMode,
  getCategoryTitle,
  onTransportModeChange,
  onBuildRoute,
  onOptimizeRoute,
  onStartNavigation,
  onClearRoute,
  onRemovePlace,
  onVisitDurationChange,
}: RouteSidebarProps) => {
  const travelDurationMinutes = route && !routeDirty ? getTravelDurationMinutes(route) : null;
  const visitDurationMinutes = getVisitDurationMinutes(places);
  const totalDurationMinutes =
    route && !routeDirty ? getTotalRouteDurationMinutes(route, places) : null;
  const isActionDisabled =
    !hasUserLocation || places.length === 0 || isRouteLoading || isOptimizing;
  const isTransitMode = transportMode === 'transit';
  const buildRouteLabel = isTransitMode
    ? 'Открыть в Яндекс Картах'
    : isRouteLoading
      ? 'Строим маршрут...'
      : routeDirty
        ? 'Обновить маршрут'
        : route
          ? 'Перестроить маршрут'
          : 'Построить маршрут';
  const startNavigationLabel = transportMode === 'walking' ? 'Начать прогулку' : 'Открыть маршрут';

  return (
    <aside className="bg-card text-foreground flex h-dvh min-w-[360px] flex-col overflow-hidden border-r max-lg:order-2 max-lg:h-[55dvh] max-lg:w-full max-lg:min-w-0 max-lg:border-t max-lg:border-r-0 lg:w-[380px] xl:w-[400px]">
      <header className="bg-card shrink-0 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold tracking-normal">
              {routeDirty ? 'Маршрут изменён' : route ? 'Маршрут готов' : 'План маршрута'}
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold">
              {places.length} мест
              {route && !routeDirty && ` · ${formatDistanceMeters(route.distance)}`}
            </h1>
          </div>

          {places.length > 0 && (
            <Button type="button" variant="ghost" size="xs" onClick={onClearRoute}>
              Очистить
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="border-r pr-3">
            <p className="text-muted-foreground text-xs">Общее</p>
            <p className="mt-1 font-semibold">
              {totalDurationMinutes === null ? '—' : formatDurationMinutes(totalDurationMinutes)}
            </p>
          </div>
          <div className="border-r px-3">
            <p className="text-muted-foreground text-xs">
              {TRANSPORT_MODE_TRAVEL_LABELS[transportMode]}
            </p>
            <p className="mt-1 font-semibold">
              {travelDurationMinutes === null ? '—' : formatDurationMinutes(travelDurationMinutes)}
            </p>
          </div>
          <div className="pl-3">
            <p className="text-muted-foreground text-xs">На местах</p>
            <p className="mt-1 font-semibold">{formatDurationMinutes(visitDurationMinutes)}</p>
          </div>
        </div>

        {routeDirty && route && (
          <div className="border-primary bg-primary/8 mt-3 border-l-2 py-2 pl-3 text-sm">
            <p className="font-semibold">Маршрут требует обновления</p>
            <p className="text-muted-foreground mt-1">
              Добавлены или удалены места. Расстояние и время нужно пересчитать.
            </p>
          </div>
        )}

        {places.length >= 15 && (
          <p className="text-muted-foreground mt-3 text-sm">
            Большое количество мест может увеличить время построения маршрута.
          </p>
        )}

        <div className="mt-4">
          <TransportModeSelector value={transportMode} onChange={onTransportModeChange} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {places.length === 0 ? (
          <div className="py-4 text-sm">
            <p className="font-medium">Маршрут пока пуст</p>
            <p className="text-muted-foreground mt-1">
              Выберите места на карте и добавьте их в маршрут.
            </p>
          </div>
        ) : (
          <>
            <div className="py-3">
              <p className="text-sm font-semibold">Старт</p>
              <p className="text-muted-foreground text-sm">Ваше местоположение</p>
            </div>

            <ol className="flex flex-col gap-2">
              {places.map((place, index) => (
                <RoutePreviewPlace
                  key={place.id}
                  place={place}
                  leg={route?.legs[index]}
                  routeDirty={routeDirty || !route}
                  categoryTitle={getCategoryTitle(place)}
                  onVisitDurationChange={onVisitDurationChange}
                  onRemovePlace={onRemovePlace}
                />
              ))}
            </ol>
          </>
        )}
      </div>

      <footer className="bg-card shrink-0 border-t p-4">
        {routeError && <p className="text-destructive mb-3 text-sm font-medium">{routeError}</p>}
        {optimizationError && (
          <p className="text-destructive mb-3 text-sm font-medium">{optimizationError}</p>
        )}
        {isOptimized && !optimizationError && (
          <p className="text-primary mb-3 text-sm font-semibold">✓ Порядок оптимизирован</p>
        )}
        {!hasUserLocation && places.length > 0 && (
          <p className="text-muted-foreground mb-3 text-sm">
            Включите геолокацию, чтобы построить маршрут.
          </p>
        )}

        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isActionDisabled || isTransitMode}
            onClick={onOptimizeRoute}
          >
            {isOptimizing
              ? 'Оптимизируем маршрут...'
              : routeDirty
                ? 'Оптимизировать и обновить'
                : 'Оптимизировать маршрут'}
          </Button>
          <Button type="button" disabled={isActionDisabled} onClick={onBuildRoute}>
            {buildRouteLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!route || routeDirty || isRouteLoading || isOptimizing || isTransitMode}
            onClick={onStartNavigation}
          >
            {startNavigationLabel}
          </Button>
        </div>

        {routeDirty && route && (
          <p className="text-muted-foreground mt-2 text-center text-xs">Сначала обновите маршрут</p>
        )}
      </footer>
    </aside>
  );
};
