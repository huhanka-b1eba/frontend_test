import { useMemo, useState } from 'react';

import {
  ArrivalSheet,
  formatNavigationDistance,
  getDistanceToPlace,
  NavigationBottomSheet,
  NavigationInstructionCard,
  NavigationRouteList,
  useNavigation,
  type NavigationPlace,
} from '@features/navigation';
import { useIsMobile } from '@shared/lib/device';
import { decodeSharedRoute } from '@shared/lib/route-share';
import { TRANSPORT_MODE_LABELS } from '@shared/lib/transport';
import { Button } from '@shared/ui/button';
import { Map } from '@shared/ui/map';

const toNavigationPlaces = (
  sharedRoute: ReturnType<typeof decodeSharedRoute>,
): NavigationPlace[] | null => {
  return sharedRoute
    ? sharedRoute.places.map((place, index) => ({
        ...place,
        order: index + 1,
      }))
    : null;
};

export const MobileNavigationPage = () => {
  const isMobile = useIsMobile();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const sharedRoute = useMemo(() => decodeSharedRoute(searchParams.get('data')), [searchParams]);
  const places = useMemo(() => toNavigationPlaces(sharedRoute), [sharedRoute]);
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [isRouteListOpen, setIsRouteListOpen] = useState(false);
  const isWalkingRoute = sharedRoute?.segmentModes.every((mode) => mode === 'walking') ?? false;
  const navigation = useNavigation(places ?? [], isMobile && Boolean(places) && isWalkingRoute);
  const { state, currentPlace, currentLeg, currentStep } = navigation;
  const mapRoutePlaces = useMemo(
    () =>
      places?.map((place) => ({
        ...place,
        tags: {},
      })) ?? [],
    [places],
  );
  const distanceToTarget =
    state.userLocation && currentPlace
      ? getDistanceToPlace(state.userLocation, currentPlace)
      : null;
  const distanceToManeuver =
    state.userLocation && currentStep
      ? getDistanceToPlace(state.userLocation, {
          longitude: currentStep.maneuver.location[0],
          latitude: currentStep.maneuver.location[1],
        })
      : null;

  if (!isMobile) {
    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card max-w-sm rounded-md border p-4 text-center">
          <h1 className="font-semibold">Навигатор доступен на телефоне</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Откройте маршрут на мобильном устройстве.
          </p>
        </section>
      </main>
    );
  }

  if (!sharedRoute || !places) {
    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card max-w-sm rounded-md border p-4 text-center">
          <h1 className="font-semibold">Не удалось открыть маршрут</h1>
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

  if (!isWalkingRoute) {
    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card max-w-sm rounded-md border p-4 text-center">
          <h1 className="font-semibold">Навигатор доступен только для пешего маршрута</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Текущий режим: {TRANSPORT_MODE_LABELS[sharedRoute.transportMode]}. Откройте маршрут на
            карте или в Яндекс Картах.
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
            Вернуться к маршруту
          </Button>
        </section>
      </main>
    );
  }

  if (state.status === 'finished') {
    return (
      <main className="bg-background grid min-h-dvh place-items-center p-4">
        <section className="bg-card max-w-sm rounded-md border p-4 text-center">
          <h1 className="font-semibold">Маршрут завершён</h1>
          <p className="text-muted-foreground mt-2 text-sm">Вы посетили {places.length} мест.</p>
          <Button
            type="button"
            className="mt-4 w-full"
            onClick={() => {
              window.location.href = `/route/mobile?data=${encodeURIComponent(
                searchParams.get('data') ?? '',
              )}`;
            }}
          >
            Вернуться к карте
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-background relative h-dvh overflow-hidden">
      <Map
        className="h-full"
        routePlaces={mapRoutePlaces}
        route={state.route?.geometry ?? null}
        userLocation={state.userLocation}
        followUserLocation={isFollowingUser && state.status === 'navigating'}
        onUserMapInteraction={() => {
          setIsFollowingUser(false);
        }}
      />

      {state.status === 'navigating' || state.status === 'paused' ? (
        <NavigationInstructionCard step={currentStep} distanceMeters={distanceToManeuver} />
      ) : (
        <section className="bg-card text-card-foreground absolute top-3 right-3 left-3 z-20 rounded-xl border px-4 py-3 shadow-[0_12px_28px_-24px_rgba(0,0,0,0.45)]">
          <p className="text-muted-foreground text-sm">{state.message ?? state.error}</p>
          {state.status === 'error' && (
            <Button type="button" className="mt-3 w-full rounded-xl" onClick={navigation.retry}>
              Повторить
            </Button>
          )}
        </section>
      )}

      {state.status === 'arrived' && currentPlace && (
        <ArrivalSheet place={currentPlace} onContinue={navigation.goToNextPlace} />
      )}

      {(state.status === 'navigating' ||
        state.status === 'paused' ||
        state.status === 'building-route') && (
        <NavigationBottomSheet
          place={currentPlace}
          leg={currentLeg}
          status={state.status}
          currentPlaceIndex={state.currentPlaceIndex}
          totalPlaces={places.length}
          onOpenList={() => {
            setIsRouteListOpen(true);
          }}
          onPause={navigation.pause}
          onResume={navigation.resume}
          onRecenter={() => {
            setIsFollowingUser(true);
          }}
        />
      )}

      {import.meta.env.DEV && (
        <div className="absolute top-24 left-3 z-20 rounded-lg bg-black/70 p-2 text-xs text-white">
          <p>accuracy: {state.debug.accuracy?.toFixed(0) ?? '—'}m</p>
          <p>route: {formatNavigationDistance(state.debug.distanceToRoute)}</p>
          <p>target: {formatNavigationDistance(distanceToTarget)}</p>
          <p>step: {state.debug.currentStep}</p>
          <p>off-route: {state.debug.offRouteUpdates}/3</p>
        </div>
      )}

      <NavigationRouteList
        open={isRouteListOpen}
        places={places}
        currentPlaceIndex={state.currentPlaceIndex}
        onClose={() => {
          setIsRouteListOpen(false);
        }}
      />
    </main>
  );
};
