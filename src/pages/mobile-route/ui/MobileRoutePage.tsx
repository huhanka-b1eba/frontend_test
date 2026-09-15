import { useCallback, useEffect, useMemo, useState } from 'react';

import { getRoute, type RoutePoint, type RouteResult } from '@shared/api/osrm';
import type { PlaceCategory } from '@shared/api/overpass';
import { decodeSharedRoute, type SharedRoute } from '@shared/lib/route-share';
import { isRoutableTransportMode, TRANSPORT_MODE_LABELS } from '@shared/lib/transport';
import { Button } from '@shared/ui/button';
import { Map } from '@shared/ui/map';
import type { RouteMapPlace } from '@shared/ui/map/placesGeoJson';

type MobileRoutePlace = RouteMapPlace & {
  visitDurationMinutes: number;
};

const getCategoryTitle = (category: PlaceCategory) => {
  switch (category) {
    case 'attraction':
      return 'Достопримечательность';
    case 'museum':
      return 'Музей';
    case 'gallery':
      return 'Галерея';
    case 'artwork':
      return 'Арт-объект';
    case 'viewpoint':
      return 'Смотровая точка';
    case 'historic':
      return 'Историческое место';
    case 'place_of_worship':
      return 'Религия';
    case 'theatre':
      return 'Театр';
    case 'cafe':
      return 'Кафе';
    case 'restaurant':
      return 'Ресторан';
    case 'arts_centre':
      return 'Центр искусств';
    case 'park':
      return 'Парк';
    case 'garden':
      return 'Сад';
    default:
      return 'Место';
  }
};

const getMobilePosition = () => {
  return new Promise<RoutePoint>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: 15000,
      },
    );
  });
};

const toRouteMapPlaces = (route: SharedRoute): MobileRoutePlace[] => {
  return route.places.map((place, index) => ({
    ...place,
    order: index + 1,
    tags: {},
  }));
};

export const MobileRoutePage = () => {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const sharedRoute = useMemo(() => decodeSharedRoute(searchParams.get('data')), [searchParams]);
  const routePlaces = useMemo(
    () => (sharedRoute ? toRouteMapPlaces(sharedRoute) : []),
    [sharedRoute],
  );
  const [phoneLocation, setPhoneLocation] = useState<RoutePoint | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [status, setStatus] = useState('Разрешите доступ к геопозиции, чтобы начать прогулку.');
  const [error, setError] = useState<string | null>(null);

  const buildRouteFromPhone = useCallback(
    async (location: RoutePoint) => {
      if (!sharedRoute) {
        return;
      }

      if (!isRoutableTransportMode(sharedRoute.transportMode)) {
        setStatus('Время маршрута будет рассчитано в Яндекс Картах.');
        return;
      }

      const nextRoute = await getRoute(
        [
          location,
          ...sharedRoute.places.map((place) => ({
            latitude: place.latitude,
            longitude: place.longitude,
          })),
        ],
        sharedRoute.transportMode,
      );

      setRoute(nextRoute);
      setStatus('Маршрут построен от текущей геопозиции телефона.');
    },
    [sharedRoute],
  );

  useEffect(() => {
    if (!sharedRoute) {
      return;
    }

    let isActive = true;

    void getMobilePosition()
      .then(async (location) => {
        if (!isActive) {
          return;
        }

        setPhoneLocation(location);
        await buildRouteFromPhone(location);
      })
      .catch((gpsError: unknown) => {
        console.error('[Mobile route] GPS failed', gpsError);

        if (!isActive) {
          return;
        }

        setError('Геопозиция недоступна. Список мест сохранён, но маршрут пока не построен.');
      });

    return () => {
      isActive = false;
    };
  }, [buildRouteFromPhone, sharedRoute]);

  if (!sharedRoute) {
    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card w-full max-w-sm rounded-xl border p-4 text-center">
          <h1 className="font-semibold">Не удалось открыть маршрут</h1>
          <p className="text-muted-foreground mt-2 text-sm">Ссылка повреждена или устарела.</p>
          <Button
            type="button"
            className="mt-4 w-full"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Вернуться на главную
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-background relative h-dvh overflow-hidden">
      <Map className="h-full" routePlaces={routePlaces} route={route?.geometry ?? null} />

      <section className="bg-card text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-20 max-h-[55dvh] overflow-y-auto rounded-t-xl border-t px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <p className="text-muted-foreground text-xs font-medium tracking-normal">Наш навигатор</p>
        <h1 className="mt-1 font-semibold">{sharedRoute.places.length} мест в маршруте</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {TRANSPORT_MODE_LABELS[sharedRoute.transportMode]}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">{error ?? status}</p>

        {!phoneLocation && !error && (
          <p className="text-muted-foreground mt-3 text-sm">Запрашиваем GPS телефона...</p>
        )}

        {route && sharedRoute.transportMode === 'walking' && (
          <Button
            type="button"
            className="mt-4 w-full rounded-lg"
            onClick={() => {
              window.location.href = `/route/mobile/navigation?data=${encodeURIComponent(
                searchParams.get('data') ?? '',
              )}`;
            }}
          >
            Начать прогулку
          </Button>
        )}

        <ol className="mt-4 border-t">
          {routePlaces.map((place) => (
            <li key={place.id} className="border-b py-3 text-sm">
              <div className="flex gap-3">
                <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold">
                  {place.order}
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 font-medium">{place.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {getCategoryTitle(place.category)} · {place.visitDurationMinutes} мин
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
};
