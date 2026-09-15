import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RouteHandoffModal } from '@features/start-walk';
import { getNearbyPlaces, type Place } from '@shared/api/overpass';
import { getRoute, getRouteMatrix, type RoutePoint, type RouteResult } from '@shared/api/osrm';
import { useIsMobile } from '@shared/lib/device';
import { createRouteShareUrl, type SharedRoute } from '@shared/lib/route-share';
import { isRoutableTransportMode, type TransportMode } from '@shared/lib/transport';
import { buildYandexMapsRouteUrl, canOpenRouteInYandexMaps } from '@shared/lib/yandex-maps';
import { Button } from '@shared/ui/button';
import { Map } from '@shared/ui/map';
import type { UserLocation } from '@shared/ui/map';
import { filterPlaces, type PlaceFilter } from '../model/placeFilters';
import { optimizeRoutePlaces } from '../model/optimizeRoutePlaces';
import {
  addRoutePlace,
  removeRoutePlace,
  updateRoutePlaceVisitDuration,
  type RoutePlace,
} from '../model/routePlaces';
import { PlaceFilters } from './PlaceFilters';
import { RouteSidebar } from './RouteSidebar';

const KAZAN_CENTER = {
  latitude: 55.7961,
  longitude: 49.1064,
};

const DEFAULT_RADIUS_METERS = 5000;

const getCategoryTitle = (place: Place) => {
  switch (place.category) {
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

const getPlaceDetails = (place: Place) => {
  const details = [
    place.tags.cuisine,
    place.tags.opening_hours,
    place.tags.website ? 'Есть сайт' : null,
  ].filter(Boolean);

  return details.join(' · ');
};

export const WelcomePage = () => {
  const isMobile = useIsMobile();
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeFilter, setActiveFilter] = useState<PlaceFilter>('all');
  const [transportMode, setTransportMode] = useState<TransportMode>('walking');
  const [routePlaces, setRoutePlaces] = useState<RoutePlace[]>([]);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeDirty, setRouteDirty] = useState(false);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [routePlacesMessage, setRoutePlacesMessage] = useState<string | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isRouteOptimized, setIsRouteOptimized] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const hasLoadedGpsPlacesRef = useRef(false);
  const placesRequestIdRef = useRef(0);

  const filteredPlaces = useMemo(() => {
    return filterPlaces(places, activeFilter);
  }, [activeFilter, places]);

  const routePlaceIds = useMemo(() => {
    return new Set(routePlaces.map((place) => place.id));
  }, [routePlaces]);

  const loadPlaces = useCallback(async (center: typeof KAZAN_CENTER) => {
    const requestId = placesRequestIdRef.current + 1;

    placesRequestIdRef.current = requestId;
    setIsPlacesLoading(true);
    setPlacesError(null);

    try {
      const nextPlaces = await getNearbyPlaces({
        ...center,
        radiusMeters: DEFAULT_RADIUS_METERS,
      });

      if (placesRequestIdRef.current !== requestId) {
        return;
      }

      setPlaces(nextPlaces);
      setPlacesError(null);
    } catch (error) {
      if (placesRequestIdRef.current !== requestId) {
        return;
      }

      console.error('[Overpass] places request failed', error);
      setPlacesError('Не удалось загрузить места');
    } finally {
      if (placesRequestIdRef.current === requestId) {
        setIsPlacesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPlaces(KAZAN_CENTER);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadPlaces]);

  const handleLocationChange = useCallback(
    (location: UserLocation) => {
      setUserLocation(location);

      if (!hasLoadedGpsPlacesRef.current) {
        hasLoadedGpsPlacesRef.current = true;
        void loadPlaces({
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    },
    [loadPlaces],
  );

  const handlePlaceSelect = useCallback((place: Place) => {
    setSelectedPlace(place);
    setRouteError(null);
  }, []);

  const handleTransportModeChange = useCallback(
    (nextMode: TransportMode) => {
      if (nextMode === transportMode) {
        return;
      }

      setTransportMode(nextMode);
      setRouteDirty(Boolean(route));
      setRouteError(null);
      setOptimizationError(null);
      setIsRouteOptimized(false);
    },
    [route, transportMode],
  );

  const handleAddRoutePlace = useCallback(
    (place: Place) => {
      if (routePlaces.some((routePlace) => routePlace.id === place.id)) {
        setRoutePlacesMessage(null);
        return;
      }

      setRoutePlaces(addRoutePlace(routePlaces, place));
      setRouteDirty(Boolean(route));
      setRouteError(null);
      setOptimizationError(null);
      setRoutePlacesMessage(null);
      setIsRouteOptimized(false);
      setSelectedPlace(null);
    },
    [route, routePlaces],
  );

  const handleRemoveRoutePlace = useCallback(
    (placeId: string) => {
      const nextRoutePlaces = removeRoutePlace(routePlaces, placeId);

      setRoutePlaces(nextRoutePlaces);

      if (nextRoutePlaces.length === 0) {
        setRoute(null);
        setRouteDirty(false);
      } else {
        setRouteDirty(Boolean(route));
      }

      setRouteError(null);
      setOptimizationError(null);
      setRoutePlacesMessage(null);
      setIsRouteOptimized(false);
    },
    [route, routePlaces],
  );

  const handleClearRoutePlaces = useCallback(() => {
    setRoutePlaces([]);
    setRoute(null);
    setRouteDirty(false);
    setRouteError(null);
    setOptimizationError(null);
    setRoutePlacesMessage(null);
    setIsRouteOptimized(false);
  }, []);

  const handleFilterChange = useCallback(
    (filter: PlaceFilter) => {
      setActiveFilter(filter);

      if (!selectedPlace) {
        return;
      }

      const nextPlaces = filterPlaces(places, filter);
      const isSelectedPlaceVisible =
        nextPlaces.some((place) => place.id === selectedPlace.id) ||
        routePlaceIds.has(selectedPlace.id);

      if (!isSelectedPlaceVisible) {
        setSelectedPlace(null);
        setRouteError(null);
      }
    },
    [places, routePlaceIds, selectedPlace],
  );

  const getRoutePoints = useCallback((location: UserLocation, placesForRoute: RoutePlace[]) => {
    return [
      {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      ...placesForRoute.map((place): RoutePoint => ({
        latitude: place.latitude,
        longitude: place.longitude,
      })),
    ];
  }, []);

  const getYandexRoutePoints = useCallback(
    (location: UserLocation, placesForRoute: RoutePlace[]) => {
      return [
        {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        ...placesForRoute.map((place) => ({
          latitude: place.latitude,
          longitude: place.longitude,
        })),
      ];
    },
    [],
  );

  const buildRouteForPlaces = useCallback(
    async (placesForRoute: RoutePlace[]) => {
      if (!userLocation || placesForRoute.length === 0) {
        return null;
      }

      if (!isRoutableTransportMode(transportMode)) {
        return null;
      }

      const nextRoute = await getRoute(getRoutePoints(userLocation, placesForRoute), transportMode);

      console.log('[OSRM] route metrics', {
        distanceMeters: nextRoute.distance,
        durationSeconds: nextRoute.duration,
        durationMinutes: nextRoute.duration / 60,
      });

      setRoute(nextRoute);
      setRouteDirty(false);

      return nextRoute;
    },
    [getRoutePoints, transportMode, userLocation],
  );

  const handleBuildRoute = async () => {
    if (!userLocation || routePlaces.length === 0) {
      return;
    }

    if (transportMode === 'transit') {
      if (isMobile) {
        const yandexRoutePoints = getYandexRoutePoints(userLocation, routePlaces);

        if (!canOpenRouteInYandexMaps(yandexRoutePoints)) {
          setRouteError('Этот маршрут слишком большой для передачи в Яндекс Карты');
          return;
        }

        window.location.href = buildYandexMapsRouteUrl(yandexRoutePoints, { transportMode });
        return;
      }

      setHandoffModalOpen(true);
      return;
    }

    setIsRouteLoading(true);
    setRouteError(null);

    try {
      await buildRouteForPlaces(routePlaces);
    } catch (error) {
      console.error('[OSRM] route request failed', error);
      setRouteError('Не удалось построить маршрут через выбранные места');
    } finally {
      setIsRouteLoading(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (!userLocation || routePlaces.length === 0 || !isRoutableTransportMode(transportMode)) {
      return;
    }

    setIsOptimizing(true);
    setOptimizationError(null);
    setRouteError(null);

    try {
      const matrix = await getRouteMatrix(getRoutePoints(userLocation, routePlaces), transportMode);
      const optimizedPlaces = optimizeRoutePlaces({
        places: routePlaces,
        matrix,
      });

      setRoutePlaces(optimizedPlaces);
      setRouteDirty(Boolean(route));
      setIsRouteOptimized(true);

      try {
        setIsRouteLoading(true);
        await buildRouteForPlaces(optimizedPlaces);
      } catch (routeBuildError) {
        console.error('[OSRM] optimized route request failed', routeBuildError);
        setRouteError('Не удалось построить маршрут через выбранные места');
      }
    } catch (error) {
      console.error('[OSRM] route optimization failed', error);
      setOptimizationError('Не удалось оптимизировать порядок');
    } finally {
      setIsOptimizing(false);
      setIsRouteLoading(false);
    }
  };

  const handleVisitDurationChange = useCallback((placeId: string, durationMinutes: number) => {
    setRoutePlaces((previousPlaces) =>
      updateRoutePlaceVisitDuration(previousPlaces, placeId, durationMinutes),
    );
  }, []);

  const selectedPlaceDetails = selectedPlace ? getPlaceDetails(selectedPlace) : '';
  const selectedRoutePlace = selectedPlace
    ? routePlaces.find((place) => place.id === selectedPlace.id)
    : null;
  const isSelectedPlaceInRoute = selectedPlace ? routePlaceIds.has(selectedPlace.id) : false;
  const sharedRoute = useMemo<SharedRoute>(
    () => ({
      version: 1,
      transportMode,
      places: routePlaces.map((place) => ({
        id: place.id,
        osmId: place.osmId,
        osmType: place.osmType,
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        category: place.category,
        visitDurationMinutes: place.visitDurationMinutes,
      })),
    }),
    [routePlaces, transportMode],
  );

  const handleStartWalk = useCallback(() => {
    if (routePlaces.length === 0 || routeDirty) {
      return;
    }

    if (transportMode === 'transit') {
      if (isMobile && userLocation) {
        const yandexRoutePoints = getYandexRoutePoints(userLocation, routePlaces);

        if (!canOpenRouteInYandexMaps(yandexRoutePoints)) {
          setRouteError('Этот маршрут слишком большой для передачи в Яндекс Карты');
          return;
        }

        window.location.href = buildYandexMapsRouteUrl(yandexRoutePoints, { transportMode });
        return;
      }

      setHandoffModalOpen(true);
      return;
    }

    if (!route) {
      return;
    }

    if (isMobile) {
      window.location.href = createRouteShareUrl(sharedRoute);
      return;
    }

    setHandoffModalOpen(true);
  }, [
    getYandexRoutePoints,
    isMobile,
    route,
    routeDirty,
    routePlaces,
    sharedRoute,
    transportMode,
    userLocation,
  ]);

  return (
    <main className="bg-background grid h-dvh w-screen grid-rows-[45dvh_55dvh] overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows-none xl:grid-cols-[400px_minmax(0,1fr)]">
      <RouteSidebar
        places={routePlaces}
        route={route}
        routeDirty={routeDirty}
        hasUserLocation={Boolean(userLocation)}
        isRouteLoading={isRouteLoading}
        isOptimizing={isOptimizing}
        isOptimized={isRouteOptimized}
        routeError={routeError}
        optimizationError={optimizationError}
        transportMode={transportMode}
        getCategoryTitle={getCategoryTitle}
        onTransportModeChange={handleTransportModeChange}
        onBuildRoute={() => {
          void handleBuildRoute();
        }}
        onOptimizeRoute={() => {
          void handleOptimizeRoute();
        }}
        onStartNavigation={() => {
          handleStartWalk();
        }}
        onClearRoute={handleClearRoutePlaces}
        onRemovePlace={handleRemoveRoutePlace}
        onVisitDurationChange={handleVisitDurationChange}
      />

      {(route || transportMode === 'transit') && !routeDirty && routePlaces.length > 0 && (
        <RouteHandoffModal
          open={handoffModalOpen}
          route={sharedRoute}
          userLocation={userLocation}
          initialMode={transportMode === 'transit' ? 'yandex' : 'our'}
          onOpenChange={setHandoffModalOpen}
        />
      )}

      <section className="relative min-h-0 min-w-0 overflow-hidden max-lg:order-1 lg:h-dvh">
        <Map
          className="h-full"
          places={filteredPlaces}
          routePlaces={routePlaces}
          selectedPlace={selectedPlace}
          route={route?.geometry ?? null}
          routeDirty={routeDirty}
          onLocationChange={handleLocationChange}
          onPlaceSelect={handlePlaceSelect}
        />

        <div className="absolute top-3 right-16 left-3 z-10 flex flex-col gap-2 lg:top-4 lg:right-20 lg:left-4">
          <PlaceFilters places={places} value={activeFilter} onChange={handleFilterChange} />

          {isPlacesLoading && (
            <p className="bg-card text-muted-foreground shadow-soft w-fit rounded-lg border px-3 py-2 text-sm">
              Ищем интересные места...
            </p>
          )}

          {placesError && (
            <p className="bg-card text-destructive shadow-soft w-fit rounded-lg border px-3 py-2 text-sm font-medium">
              {placesError}
            </p>
          )}
        </div>

        {selectedPlace && (
          <section className="bg-card text-card-foreground shadow-soft absolute right-3 bottom-3 left-3 z-20 max-w-[420px] rounded-xl border p-4 lg:right-auto lg:bottom-4 lg:left-4 lg:w-[360px]">
            <p className="text-muted-foreground text-xs font-medium tracking-normal">
              {getCategoryTitle(selectedPlace)}
            </p>
            <h2 className="mt-1 line-clamp-2 font-semibold">{selectedPlace.name}</h2>

            {selectedPlaceDetails && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                {selectedPlaceDetails}
              </p>
            )}

            {isSelectedPlaceInRoute && selectedRoutePlace && (
              <p className="text-primary mt-3 text-sm font-semibold">
                ✓ В маршруте · точка {selectedRoutePlace.order}
              </p>
            )}

            {routePlacesMessage && (
              <p className="text-muted-foreground mt-3 text-sm">{routePlacesMessage}</p>
            )}

            <div className="mt-4 flex gap-2">
              {isSelectedPlaceInRoute ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleRemoveRoutePlace(selectedPlace.id);
                  }}
                  className="w-full rounded-lg"
                >
                  Удалить из маршрута
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    handleAddRoutePlace(selectedPlace);
                  }}
                  className="w-full rounded-lg"
                >
                  Добавить в маршрут
                </Button>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
};
