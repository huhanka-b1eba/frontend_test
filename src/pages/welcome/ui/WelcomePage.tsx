import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftOpen } from 'lucide-react';

import { RouteHandoffModal } from '@features/start-walk';
import { getNearbyPlaces, type Place } from '@shared/api/overpass';
import { getRoute, getRouteMatrix, type RoutePoint, type RouteResult } from '@shared/api/osrm';
import { cn } from '@shared/lib/cn';
import { useIsMobile } from '@shared/lib/device';
import { createRouteShareUrl, type SharedRoute } from '@shared/lib/route-share';
import { isRoutableTransportMode, type TransportMode } from '@shared/lib/transport';
import { Button } from '@shared/ui/button';
import { Map } from '@shared/ui/map';
import type { UserLocation } from '@shared/ui/map';
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip';
import { filterPlaces, type PlaceFilter } from '../model/placeFilters';
import { optimizeRoutePlaces } from '../model/optimizeRoutePlaces';
import {
  addRoutePlace,
  removeRoutePlace,
  updateRoutePlaceVisitDuration,
  type RoutePlace,
} from '../model/routePlaces';
import {
  applyBuiltRouteSegment,
  areAllSegmentsWalking,
  createRouteSegments,
  getRouteSegmentPoints,
  getRouteSegmentsSummary,
  markRouteSegmentError,
  markRouteSegmentLoading,
  updateRouteSegmentMode,
  type BuiltRouteSegment,
  type RouteSegment,
} from '../model/routeSegments';
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
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const hasLoadedGpsPlacesRef = useRef(false);
  const placesRequestIdRef = useRef(0);

  const filteredPlaces = useMemo(() => {
    return filterPlaces(places, activeFilter);
  }, [activeFilter, places]);

  const routePlaceIds = useMemo(() => {
    return new Set(routePlaces.map((place) => place.id));
  }, [routePlaces]);

  const routeSegmentsSummary = useMemo(() => {
    return getRouteSegmentsSummary(routeSegments);
  }, [routeSegments]);

  const routeGeometry = routeSegmentsSummary?.geometry ?? null;
  const hasRouteGeometry = Boolean(routeGeometry);
  const isWalkingRoute = areAllSegmentsWalking(routeSegments);
  const isRoutePrepared =
    routeSegments.length === routePlaces.length &&
    routeSegments.length > 0 &&
    routeSegments.every(
      (segment) => segment.status === 'ready' || segment.status === 'unsupported',
    );
  const route = useMemo<RouteResult | null>(() => {
    if (!routeSegmentsSummary?.geometry) {
      return null;
    }

    return {
      geometry: routeSegmentsSummary.geometry,
      distance: routeSegmentsSummary.distance ?? 0,
      duration: routeSegmentsSummary.duration ?? 0,
      legs: routeSegments.map((segment) => ({
        distance: segment.distance ?? 0,
        duration: segment.duration ?? 0,
      })),
      steps: [],
      mode: 'walking',
    };
  }, [routeSegments, routeSegmentsSummary]);

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
      setRouteSegments((previousSegments) =>
        createRouteSegments({
          userLocation: location,
          places: routePlaces,
          previousSegments,
          defaultMode: transportMode,
        }),
      );

      if (!hasLoadedGpsPlacesRef.current) {
        hasLoadedGpsPlacesRef.current = true;
        void loadPlaces({
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    },
    [loadPlaces, routePlaces, transportMode],
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
      setRouteError(null);
      setOptimizationError(null);
    },
    [transportMode],
  );

  const handleAddRoutePlace = useCallback(
    (place: Place) => {
      if (routePlaces.some((routePlace) => routePlace.id === place.id)) {
        setRoutePlacesMessage(null);
        return;
      }

      const nextRoutePlaces = addRoutePlace(routePlaces, place);

      setRoutePlaces(nextRoutePlaces);
      setRouteSegments((previousSegments) =>
        createRouteSegments({
          userLocation,
          places: nextRoutePlaces,
          previousSegments,
          defaultMode: transportMode,
        }),
      );
      setRouteDirty(hasRouteGeometry || routeSegments.length > 0);
      setRouteError(null);
      setOptimizationError(null);
      setRoutePlacesMessage(null);
      setIsRouteOptimized(false);
      setSelectedPlace(null);
    },
    [hasRouteGeometry, routePlaces, routeSegments.length, transportMode, userLocation],
  );

  const handleRemoveRoutePlace = useCallback(
    (placeId: string) => {
      const nextRoutePlaces = removeRoutePlace(routePlaces, placeId);

      setRoutePlaces(nextRoutePlaces);
      setRouteSegments((previousSegments) =>
        createRouteSegments({
          userLocation,
          places: nextRoutePlaces,
          previousSegments,
          defaultMode: transportMode,
        }),
      );

      if (nextRoutePlaces.length === 0) {
        setRouteSegments([]);
        setRouteDirty(false);
      } else {
        setRouteDirty(hasRouteGeometry || routeSegments.length > 0);
      }

      setRouteError(null);
      setOptimizationError(null);
      setRoutePlacesMessage(null);
      setIsRouteOptimized(false);
    },
    [hasRouteGeometry, routePlaces, routeSegments.length, transportMode, userLocation],
  );

  const handleClearRoutePlaces = useCallback(() => {
    setRoutePlaces([]);
    setRouteSegments([]);
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

  const buildRouteSegment = useCallback(async (segment: RouteSegment) => {
    const points = getRouteSegmentPoints(segment);

    if (!points || !isRoutableTransportMode(segment.mode)) {
      return {
        ...segment,
        geometry: null,
        distance: null,
        duration: null,
        status: 'unsupported' as const,
      };
    }

    const nextRoute = await getRoute(points, segment.mode);

    return {
      ...segment,
      mode: segment.mode,
      geometry: nextRoute.geometry,
      distance: nextRoute.distance,
      duration: nextRoute.duration,
      status: 'ready' as const,
      error: undefined,
    } satisfies BuiltRouteSegment;
  }, []);

  const buildRouteSegments = useCallback(
    async (segmentsToBuild: RouteSegment[]) => {
      const routableSegmentIds = segmentsToBuild
        .filter((segment) => isRoutableTransportMode(segment.mode))
        .map((segment) => segment.id);

      setRouteSegments((previousSegments) =>
        routableSegmentIds.reduce(
          (nextSegments, segmentId) => markRouteSegmentLoading(nextSegments, segmentId),
          previousSegments,
        ),
      );

      const builtSegments = await Promise.all(
        segmentsToBuild.map((segment) => buildRouteSegment(segment)),
      );

      setRouteSegments(builtSegments);
      setRouteDirty(false);

      const summary = getRouteSegmentsSummary(builtSegments);

      console.log('[OSRM] route metrics', {
        distanceMeters: summary?.distance,
        durationSeconds: summary?.duration,
        durationMinutes: summary?.duration ? summary.duration / 60 : null,
      });

      return builtSegments;
    },
    [buildRouteSegment],
  );

  const handleBuildRoute = async () => {
    if (!userLocation || routePlaces.length === 0) {
      return;
    }

    setIsRouteLoading(true);
    setRouteError(null);

    try {
      const nextSegments = createRouteSegments({
        userLocation,
        places: routePlaces,
        previousSegments: routeSegments,
        defaultMode: transportMode,
      });

      await buildRouteSegments(nextSegments);
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
      const optimizedSegments = createRouteSegments({
        userLocation,
        places: optimizedPlaces,
        previousSegments: routeSegments,
        defaultMode: transportMode,
      });

      setRoutePlaces(optimizedPlaces);
      setRouteSegments(optimizedSegments);
      setRouteDirty(hasRouteGeometry || routeSegments.length > 0);
      setIsRouteOptimized(true);

      try {
        setIsRouteLoading(true);
        await buildRouteSegments(optimizedSegments);
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

  const handleSegmentModeChange = useCallback(
    (segmentId: string, nextMode: TransportMode) => {
      const currentSegment = routeSegments.find((segment) => segment.id === segmentId);

      if (!currentSegment || currentSegment.mode === nextMode) {
        return;
      }

      const nextSegments = updateRouteSegmentMode(routeSegments, segmentId, nextMode);

      setRouteSegments(nextSegments);
      setRouteError(null);

      const nextSegment = nextSegments.find((segment) => segment.id === segmentId);

      if (!nextSegment || !isRoutableTransportMode(nextSegment.mode)) {
        return;
      }

      setRouteSegments((previousSegments) => markRouteSegmentLoading(previousSegments, segmentId));

      void buildRouteSegment(nextSegment)
        .then((builtSegment) => {
          setRouteSegments((previousSegments) =>
            applyBuiltRouteSegment(previousSegments, segmentId, builtSegment),
          );
        })
        .catch((error: unknown) => {
          console.error('[OSRM] segment route request failed', error);
          setRouteSegments((previousSegments) =>
            markRouteSegmentError(previousSegments, segmentId, 'Не удалось построить участок'),
          );
          setRouteError('Не удалось построить выбранный участок');
        });
    },
    [buildRouteSegment, routeSegments],
  );

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
      segmentModes: routeSegments.map((segment) => segment.mode),
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
    [routePlaces, routeSegments, transportMode],
  );

  const handleStartWalk = useCallback(() => {
    if (routePlaces.length === 0 || routeDirty || !isRoutePrepared) {
      return;
    }

    if (isMobile) {
      window.location.href = createRouteShareUrl(sharedRoute);
      return;
    }

    setHandoffModalOpen(true);
  }, [isMobile, isRoutePrepared, routeDirty, routePlaces.length, sharedRoute]);

  return (
    <main
      className={cn(
        'bg-background grid h-dvh w-screen grid-rows-[45dvh_55dvh] overflow-hidden lg:grid-rows-none lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out motion-reduce:lg:transition-none',
        isSidebarOpen
          ? 'lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]'
          : 'lg:grid-cols-[0px_minmax(0,1fr)]',
      )}
    >
      <div
        className="min-w-0 overflow-hidden max-lg:order-2"
        aria-hidden={!isSidebarOpen && !isMobile}
        inert={!isSidebarOpen && !isMobile}
      >
        <RouteSidebar
          places={routePlaces}
          route={route}
          segments={routeSegments}
          routeDirty={routeDirty}
          isWalkingRoute={isWalkingRoute}
          isRoutePrepared={isRoutePrepared}
          hasUserLocation={Boolean(userLocation)}
          isRouteLoading={isRouteLoading}
          isOptimizing={isOptimizing}
          isOptimized={isRouteOptimized}
          routeError={routeError}
          optimizationError={optimizationError}
          transportMode={transportMode}
          getCategoryTitle={getCategoryTitle}
          onTransportModeChange={handleTransportModeChange}
          onSegmentModeChange={handleSegmentModeChange}
          onBuildRoute={() => {
            void handleBuildRoute();
          }}
          onOptimizeRoute={() => {
            void handleOptimizeRoute();
          }}
          onStartNavigation={() => {
            handleStartWalk();
          }}
          onSidebarClose={() => {
            setIsSidebarOpen(false);
          }}
          onClearRoute={handleClearRoutePlaces}
          onRemovePlace={handleRemoveRoutePlace}
          onVisitDurationChange={handleVisitDurationChange}
        />
      </div>

      {isRoutePrepared && !routeDirty && routePlaces.length > 0 && (
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
          route={routeGeometry}
          routeDirty={routeDirty}
          onLocationChange={handleLocationChange}
          onPlaceSelect={handlePlaceSelect}
        />

        <div className="absolute top-3 right-16 left-3 z-10 flex flex-col gap-2 lg:top-4 lg:right-20 lg:left-4">
          <div className="flex items-start gap-2">
            {!isSidebarOpen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="bg-card/95 shadow-soft hidden shrink-0 lg:inline-flex"
                    aria-label="Показать маршрут"
                    aria-expanded={false}
                    onClick={() => {
                      setIsSidebarOpen(true);
                    }}
                  >
                    <PanelLeftOpen className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Показать маршрут</TooltipContent>
              </Tooltip>
            )}

            <div className="min-w-0 flex-1">
              <PlaceFilters places={places} value={activeFilter} onChange={handleFilterChange} />
            </div>
          </div>

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
