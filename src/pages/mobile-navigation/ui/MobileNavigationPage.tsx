import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, List, Pause, Play, X } from 'lucide-react';

import {
  ArrivalSheet,
  formatNavigationDistance,
  getDistanceToPlace,
  NavigationBottomSheet,
  NavigationInstructionCard,
  useNavigation,
  type NavigationPlace,
} from '@features/navigation';
import { AiGuideSheet, useAiGuide } from '@features/ai-guide';
import { useJourney } from '@features/journey';
import { ApiError, rebuildAdventureRoute, type RouteAdventureResponse } from '@shared/api';
import type { PlaceCategory } from '@shared/api/overpass';
import { logRouteAction } from '@shared/api/routeDebug';
import { useIsMobile } from '@shared/lib/device';
import { decodeSharedRoute, type SharedRoute } from '@shared/lib/route-share';
import type { TransportMode } from '@shared/lib/transport';
import { buildYandexMapsRouteUrl } from '@shared/lib/yandex-maps';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Map } from '@shared/ui/map';
import { Textarea } from '@shared/ui/textarea';
import { useTranslation } from 'react-i18next';

const toNavigationPlaces = (sharedRoute: SharedRoute): NavigationPlace[] => {
  return sharedRoute.places.map((place, index) => ({
    ...place,
    order: index + 1,
  }));
};

const getMobilePosition = () => {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
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
        timeout: 12000,
      },
    );
  });
};

const getExternalModeHint = (mode: TransportMode, t: ReturnType<typeof useTranslation>['t']) => {
  if (mode === 'cycling') {
    return t('mobileNavigation.externalHints.cycling');
  }

  if (mode === 'transit') {
    return t('mobileNavigation.externalHints.transit');
  }

  return null;
};

const getCategoryFromApiType = (type: string): PlaceCategory => {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('музей')) {
    return 'museum';
  }

  if (normalizedType.includes('мечет') || normalizedType.includes('храм')) {
    return 'place_of_worship';
  }

  if (normalizedType.includes('театр')) {
    return 'theatre';
  }

  if (normalizedType.includes('кафе')) {
    return 'cafe';
  }

  if (normalizedType.includes('ресторан')) {
    return 'restaurant';
  }

  if (normalizedType.includes('парк') || normalizedType.includes('сад')) {
    return 'park';
  }

  return 'attraction';
};

const toSharedRouteFromRebuild = (
  response: RouteAdventureResponse,
  visitedPlaces: SharedRoute['places'],
): SharedRoute => {
  const nextPlaces = response.places.map((place) => ({
    id: place.id,
    osmId: 0,
    osmType: 'node' as const,
    name: place.name,
    latitude: place.lat,
    longitude: place.lon,
    category: getCategoryFromApiType(place.type),
    visitDurationMinutes: place.visitDurationMinutes,
  }));

  return {
    version: 1,
    transportMode: 'walking',
    segmentModes: [
      ...visitedPlaces.map(() => 'walking' as const),
      ...nextPlaces.map(() => 'walking' as const),
    ],
    places: [...visitedPlaces, ...nextPlaces],
  };
};

const getApiErrorMessage = (
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return error.retryAfterSeconds
        ? t('navigation.rebuild.rateLimitedWithRetry', { seconds: error.retryAfterSeconds })
        : t('navigation.rebuild.rateLimited');
    }

    if (error.status === 502 || error.status === 504) {
      return t('navigation.rebuild.temporarilyUnavailable');
    }

    return error.message;
  }

  return t('navigation.rebuild.network');
};

type JourneyRouteListProps = {
  open: boolean;
  route: SharedRoute;
  currentPlaceIndex: number;
  placeStatuses: Record<string, string>;
  onSkipPlace: (placeId: string, placeName: string) => void;
  onClose: () => void;
};

const JourneyRouteList = ({
  open,
  route,
  currentPlaceIndex,
  placeStatuses,
  onSkipPlace,
  onClose,
}: JourneyRouteListProps) => {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  const remainingPlaces = route.places.filter(
    (place) => placeStatuses[place.id] === 'pending',
  ).length;

  return (
    <section className="bg-card text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-30 max-h-[72dvh] overflow-hidden rounded-t-xl border-t">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">{t('mobileNavigation.list.title')}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {t('mobileNavigation.list.remaining', { count: remainingPlaces })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-lg"
          aria-label={t('mobileNavigation.list.close')}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <ol className="max-h-[calc(72dvh-4.5rem)] overflow-y-auto">
        {route.places.map((place, index) => {
          const status = placeStatuses[place.id] ?? 'pending';
          const isCurrent = index === currentPlaceIndex && status === 'pending';
          const mode = route.segmentModes[index] ?? route.transportMode;

          return (
            <li key={place.id} className="border-b px-4 py-3 last:border-b-0">
              <div className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold">
                  {status === 'visited' ? (
                    <Check className="size-4" />
                  ) : status === 'skipped' ? (
                    '—'
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{place.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {isCurrent
                      ? t('mobileNavigation.list.current')
                      : status === 'visited'
                        ? t('mobileNavigation.list.visited')
                        : status === 'skipped'
                          ? t('mobileNavigation.list.skipped')
                          : t('mobileNavigation.list.pending')}{' '}
                    · {t(`app.transport.labels.${mode}`)}
                  </p>
                </div>
                {status === 'pending' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      onSkipPlace(place.id, place.name);
                    }}
                  >
                    {t('mobileNavigation.list.skip')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export const MobileNavigationPage = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const sharedRoute = useMemo(() => decodeSharedRoute(searchParams.get('data')), [searchParams]);

  if (!isMobile) {
    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card max-w-sm rounded-md border p-4 text-center">
          <h1 className="font-semibold">{t('mobileNavigation.states.desktopTitle')}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t('mobileNavigation.states.desktopDescription')}
          </p>
        </section>
      </main>
    );
  }

  if (!sharedRoute) {
    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card max-w-sm rounded-md border p-4 text-center">
          <h1 className="font-semibold">{t('mobileNavigation.states.invalidTitle')}</h1>
          <Button
            type="button"
            className="mt-4 w-full"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            {t('mobileNavigation.actions.home')}
          </Button>
        </section>
      </main>
    );
  }

  return <JourneyContent route={sharedRoute} />;
};

const JourneyContent = ({ route }: { route: SharedRoute }) => {
  const { t } = useTranslation();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [activeRoute, setActiveRoute] = useState(route);
  const [isRebuildOpen, setIsRebuildOpen] = useState(false);
  const [rebuildRequest, setRebuildRequest] = useState('');
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);
  const places = useMemo(() => toNavigationPlaces(activeRoute), [activeRoute]);
  const mapRoutePlaces = useMemo(
    () =>
      places.map((place) => ({
        ...place,
        tags: {},
      })),
    [places],
  );
  const journey = useJourney(activeRoute);
  const { progress, currentPlace, currentSegment, dispatch, clearProgress } = journey;
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [isRouteListOpen, setIsRouteListOpen] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [aiGuideMockLocation, setAiGuideMockLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    heading: number | null;
    speed: number | null;
    timestamp: number;
  } | null>(null);
  const arrivalHandledRef = useRef(false);
  const currentMode = currentSegment?.mode ?? activeRoute.transportMode;
  const isWalkingSegment = currentMode === 'walking';
  const currentNavigationPlace = currentPlace
    ? {
        ...currentPlace,
        order: progress.currentPlaceIndex + 1,
      }
    : null;
  const walkingPlaces = currentNavigationPlace ? [currentNavigationPlace] : [];
  const navigation = useNavigation(
    walkingPlaces,
    progress.status === 'in-progress' && currentMode === 'walking' && Boolean(currentPlace),
  );
  const { state, currentLeg, currentStep } = navigation;
  const distanceToTarget =
    state.userLocation && currentNavigationPlace
      ? getDistanceToPlace(state.userLocation, currentNavigationPlace)
      : null;
  const distanceToManeuver =
    state.userLocation && currentStep
      ? getDistanceToPlace(state.userLocation, {
          longitude: currentStep.maneuver.location[0],
          latitude: currentStep.maneuver.location[1],
        })
      : null;
  const aiGuide = useAiGuide({
    enabled:
      isWalkingSegment &&
      progress.status === 'in-progress' &&
      state.status === 'navigating' &&
      Boolean(aiGuideMockLocation ?? state.userLocation),
    sessionId: `${activeRoute.places.map((place) => place.id).join(':')}:${progress.startedAt}`,
    userLocation: aiGuideMockLocation ?? state.userLocation,
  });

  useEffect(() => {
    if (state.status !== 'arrived') {
      arrivalHandledRef.current = false;
      return;
    }

    if (!arrivalHandledRef.current) {
      arrivalHandledRef.current = true;
      dispatch({ type: 'arrive' });
    }
  }, [dispatch, state.status]);

  const handleSkipPlace = (placeId: string, placeName: string) => {
    if (!window.confirm(t('mobileNavigation.confirm.skip', { name: placeName }))) {
      return;
    }

    dispatch({ type: 'skip-place', route: activeRoute, placeId });
  };

  const handleRebuildRoute = async () => {
    if (isRebuilding) {
      return;
    }

    const normalizedRequest = rebuildRequest.trim();

    if (!normalizedRequest) {
      setRebuildError(t('navigation.rebuild.required'));
      return;
    }

    if (normalizedRequest.length > 1000) {
      setRebuildError(t('navigation.rebuild.tooLong'));
      return;
    }

    const remainingPlaces = activeRoute.places.filter(
      (place) => progress.placeStatuses[place.id] === 'pending',
    );

    if (remainingPlaces.length === 0) {
      setRebuildError(t('navigation.rebuild.emptyRemaining'));
      return;
    }

    const visitedPlaces = activeRoute.places.filter(
      (place) => progress.placeStatuses[place.id] === 'visited',
    );

    logRouteAction('REBUILD_CLICKED', {
      source: 'MobileNavigationPage',
      journeyStatus: progress.status,
      visitedCount: visitedPlaces.length,
      remainingCount: remainingPlaces.length,
      aiRequestLength: normalizedRequest.length,
      hasUserLocation: Boolean(state.userLocation),
    });

    setIsRebuilding(true);
    setRebuildError(null);
    setRebuildMessage(null);

    try {
      const location = state.userLocation ?? (await getMobilePosition());
      const response = await rebuildAdventureRoute({
        visitedPlaces: visitedPlaces.map((place) => ({
          lat: place.latitude,
          lon: place.longitude,
        })),
        remainingPlaces: remainingPlaces.map((place) => ({
          lat: place.latitude,
          lon: place.longitude,
        })),
        userLocation: {
          lat: location.latitude,
          lon: location.longitude,
        },
        currentAt: new Date().toISOString(),
        aiRequest: normalizedRequest,
      });
      const nextRoute = toSharedRouteFromRebuild(response, visitedPlaces);

      setActiveRoute(nextRoute);
      dispatch({
        type: 'replace-route',
        route: nextRoute,
        visitedPlaceIds: visitedPlaces.map((place) => place.id),
      });
      setRebuildRequest('');
      setIsRebuildOpen(false);
      setRebuildMessage(
        response.places.length === 0
          ? t('navigation.rebuild.emptyRoute')
          : t('navigation.rebuild.success'),
      );
    } catch (error) {
      console.error('[Route adventure] rebuild failed', error);
      setRebuildError(getApiErrorMessage(error, t));
    } finally {
      setIsRebuilding(false);
    }
  };

  const openExternalNavigation = async () => {
    if (!currentPlace || !currentSegment) {
      return;
    }

    setExternalError(null);

    try {
      const previousPlace = activeRoute.places[progress.currentPlaceIndex - 1];
      const canStartFromPreviousPlace =
        previousPlace && progress.placeStatuses[previousPlace.id] === 'visited';
      const from = !canStartFromPreviousPlace
        ? await getMobilePosition()
        : {
            latitude: previousPlace.latitude,
            longitude: previousPlace.longitude,
          };
      const url = buildYandexMapsRouteUrl(
        [
          from,
          {
            latitude: currentPlace.latitude,
            longitude: currentPlace.longitude,
          },
        ],
        {
          transportMode: currentMode === 'walking' ? 'walking' : undefined,
        },
      );

      dispatch({ type: 'external-navigation' });
      window.location.href = url;
    } catch {
      setExternalError(t('mobileNavigation.errors.externalGps'));
    }
  };

  if (progress.status === 'not-started') {
    const hasStartedBefore = progress.updatedAt > progress.startedAt;

    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card w-full max-w-sm rounded-xl border p-4">
          <p className="text-muted-foreground text-sm">
            {hasStartedBefore
              ? t('mobileNavigation.states.startedBefore')
              : t('mobileNavigation.states.yourRoute')}
          </p>
          <h1 className="mt-1 text-lg font-semibold">
            {t('mobileNavigation.states.places', { count: activeRoute.places.length })}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('mobileNavigation.states.mixedTransport')}
          </p>
          <ol className="mt-4 space-y-2 text-sm">
            {activeRoute.places.map((place, index) => (
              <li key={place.id} className="flex gap-2">
                <span className="text-muted-foreground w-5 shrink-0">{index + 1}.</span>
                <span className="line-clamp-1">{place.name}</span>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            className="mt-4 w-full rounded-lg"
            onClick={() => {
              dispatch({ type: 'start', route: activeRoute });
            }}
          >
            {hasStartedBefore
              ? t('mobileNavigation.actions.continue')
              : t('mobileNavigation.actions.start')}
          </Button>
          {hasStartedBefore && (
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full rounded-lg"
              onClick={() => {
                if (window.confirm(t('mobileNavigation.confirm.restart'))) {
                  clearProgress();
                  dispatch({ type: 'restart', routeId: progress.routeId, route: activeRoute });
                }
              }}
            >
              {t('mobileNavigation.actions.restart')}
            </Button>
          )}
        </section>
      </main>
    );
  }

  if (progress.status === 'finished') {
    const visitedCount = Object.values(progress.placeStatuses).filter(
      (status) => status === 'visited',
    ).length;
    const skippedCount = Object.values(progress.placeStatuses).filter(
      (status) => status === 'skipped',
    ).length;

    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card max-w-sm rounded-md border p-4 text-center">
          <h1 className="font-semibold">{t('mobileNavigation.states.finished')}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t('mobileNavigation.states.finishedStats', {
              visited: visitedCount,
              skipped: skippedCount,
            })}
          </p>
          <Button
            type="button"
            className="mt-4 w-full"
            onClick={() => {
              window.location.href = `/route/mobile?data=${encodeURIComponent(
                searchParams.get('data') ?? '',
              )}`;
            }}
          >
            {t('mobileNavigation.actions.backToMap')}
          </Button>
        </section>
      </main>
    );
  }

  const modeHint = getExternalModeHint(currentMode, t);

  return (
    <main className="bg-background relative h-dvh overflow-hidden">
      <Map
        className="h-full"
        routePlaces={mapRoutePlaces}
        route={state.route?.geometry ?? null}
        userLocation={state.userLocation}
        followUserLocation={isFollowingUser && isWalkingSegment && state.status === 'navigating'}
        onUserMapInteraction={() => {
          setIsFollowingUser(false);
        }}
      />

      <section className="bg-card/95 text-card-foreground absolute top-3 right-3 left-3 z-20 rounded-xl border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-semibold">{t('mobileNavigation.list.title')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('mobileNavigation.states.progress', {
              current: Math.min(progress.currentPlaceIndex + 1, activeRoute.places.length),
              total: activeRoute.places.length,
            })}
          </p>
        </div>
      </section>

      {isWalkingSegment && progress.status === 'in-progress' && (
        <NavigationInstructionCard step={currentStep} distanceMeters={distanceToManeuver} />
      )}

      {progress.status === 'at-place' && currentNavigationPlace && (
        <ArrivalSheet
          place={currentNavigationPlace}
          onContinue={() => {
            dispatch({ type: 'confirm-visit', route: activeRoute });
          }}
        />
      )}

      {progress.status === 'paused' && currentPlace && (
        <section className="bg-card text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-20 rounded-t-xl border-t px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <p className="text-muted-foreground text-sm">{t('mobileNavigation.states.paused')}</p>
          <h2 className="mt-1 font-semibold">{currentPlace.name}</h2>
          <Button
            type="button"
            className="mt-4 w-full rounded-lg"
            onClick={() => {
              dispatch({ type: 'resume' });
              navigation.resume();
            }}
          >
            <Play className="size-4" />
            {t('mobileNavigation.actions.continue')}
          </Button>
        </section>
      )}

      {progress.status === 'external-navigation' && currentPlace && (
        <section className="bg-card text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-20 rounded-t-xl border-t px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <p className="text-muted-foreground text-sm">{t('mobileNavigation.states.active')}</p>
          <h2 className="mt-1 font-semibold">{currentPlace.name}</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {t('mobileNavigation.states.arrivedQuestion')}
          </p>
          <div className="mt-4 grid gap-2">
            <Button
              type="button"
              className="rounded-lg"
              onClick={() => {
                dispatch({ type: 'arrive' });
              }}
            >
              {t('mobileNavigation.actions.arrived')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => void openExternalNavigation()}
            >
              {t('mobileNavigation.actions.continueNavigation')}
            </Button>
          </div>
        </section>
      )}

      {progress.status === 'in-progress' && currentPlace && !isWalkingSegment && (
        <section className="bg-card text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-20 rounded-t-xl border-t px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <p className="text-muted-foreground text-xs font-medium">
            {t('mobileNavigation.states.nextPlace')}
          </p>
          <h2 className="mt-1 line-clamp-2 font-semibold">{currentPlace.name}</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {t(`app.transport.labels.${currentMode}`)}
          </p>
          {modeHint && <p className="text-muted-foreground mt-1 text-xs">{modeHint}</p>}
          {externalError && <p className="text-destructive mt-2 text-sm">{externalError}</p>}
          <div className="mt-4 grid gap-2">
            <Button
              type="button"
              className="rounded-lg"
              onClick={() => void openExternalNavigation()}
            >
              {t('mobileNavigation.actions.openYandex')}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setIsRouteListOpen(true);
                }}
              >
                <List className="size-4" />
                {t('mobileNavigation.actions.list')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-lg"
                onClick={() => {
                  dispatch({ type: 'pause' });
                }}
              >
                <Pause className="size-4" />
                {t('mobileNavigation.actions.pause')}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="rounded-lg"
              onClick={() => handleSkipPlace(currentPlace.id, currentPlace.name)}
            >
              {t('mobileNavigation.actions.skipPlace')}
            </Button>
          </div>
        </section>
      )}

      {isWalkingSegment &&
        (state.status === 'navigating' ||
          state.status === 'paused' ||
          state.status === 'building-route') &&
        progress.status === 'in-progress' && (
          <NavigationBottomSheet
            place={currentNavigationPlace}
            leg={currentLeg}
            status={state.status}
            currentPlaceIndex={progress.currentPlaceIndex}
            totalPlaces={activeRoute.places.length}
            onOpenList={() => {
              setIsRouteListOpen(true);
            }}
            onPause={() => {
              dispatch({ type: 'pause' });
              navigation.pause();
            }}
            onResume={() => {
              dispatch({ type: 'resume' });
              navigation.resume();
            }}
            onRecenter={() => {
              setIsFollowingUser(true);
            }}
            onRebuild={() => {
              setIsRebuildOpen(true);
            }}
          />
        )}

      {import.meta.env.DEV && isWalkingSegment && (
        <div className="absolute top-24 left-3 z-20 rounded-lg bg-black/70 p-2 text-xs text-white">
          <p>accuracy: {state.debug.accuracy?.toFixed(0) ?? '—'}m</p>
          <p>route: {formatNavigationDistance(state.debug.distanceToRoute)}</p>
          <p>target: {formatNavigationDistance(distanceToTarget)}</p>
          <p>step: {state.debug.currentStep}</p>
          <p>off-route: {state.debug.offRouteUpdates}/3</p>
        </div>
      )}

      {import.meta.env.DEV && isWalkingSegment && aiGuide.state.queue.length > 0 && (
        <div className="absolute top-24 right-3 z-20 max-w-[150px] rounded-lg bg-[#154b39]/90 p-2 text-xs text-white">
          <p className="font-semibold">AI mock GPS</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {aiGuide.state.queue.slice(0, 3).map((place, index) => (
              <button
                key={place.id}
                type="button"
                className="rounded bg-white/15 px-2 py-1"
                onClick={() => {
                  setAiGuideMockLocation({
                    latitude: place.lat,
                    longitude: place.lon,
                    accuracy: 12,
                    heading: null,
                    speed: null,
                    timestamp: Date.now(),
                  });
                }}
              >
                near {index + 1}
              </button>
            ))}
            <button
              type="button"
              className="rounded bg-white/15 px-2 py-1"
              onClick={() => setAiGuideMockLocation(null)}
            >
              real
            </button>
          </div>
        </div>
      )}

      {isWalkingSegment && progress.status === 'in-progress' && (
        <AiGuideSheet
          state={aiGuide.state}
          onClose={aiGuide.close}
          onReopen={aiGuide.reopen}
          onNext={aiGuide.showNext}
          onMarkVisited={aiGuide.markVisitedAndNext}
          onRetry={aiGuide.retryActive}
        />
      )}

      <JourneyRouteList
        open={isRouteListOpen}
        route={activeRoute}
        currentPlaceIndex={progress.currentPlaceIndex}
        placeStatuses={progress.placeStatuses}
        onSkipPlace={handleSkipPlace}
        onClose={() => {
          setIsRouteListOpen(false);
        }}
      />

      {rebuildMessage && (
        <div className="bg-card text-primary absolute top-20 right-3 left-3 z-30 rounded-lg border px-3 py-2 text-sm font-medium">
          {rebuildMessage}
        </div>
      )}

      <Dialog open={isRebuildOpen} onOpenChange={setIsRebuildOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('navigation.rebuild.title')}</DialogTitle>
            <DialogDescription>{t('navigation.rebuild.description')}</DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-28"
            maxLength={1000}
            value={rebuildRequest}
            placeholder={t('navigation.rebuild.placeholder')}
            onChange={(event) => {
              setRebuildRequest(event.target.value);
              setRebuildError(null);
            }}
          />
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>{rebuildError ?? ''}</span>
            <span>{rebuildRequest.length}/1000</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRebuildOpen(false)}>
              {t('navigation.rebuild.cancel')}
            </Button>
            <Button
              type="button"
              disabled={isRebuilding}
              onClick={() => {
                void handleRebuildRoute();
              }}
            >
              {isRebuilding ? t('navigation.rebuild.loading') : t('navigation.rebuild.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};
