import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getWalkingRoute, type RoutePoint, type RouteStep } from '@shared/api/osrm';

import {
  ARRIVAL_CONFIRMATION_UPDATES,
  BAD_ACCURACY_METERS,
  BASE_ARRIVAL_DISTANCE_METERS,
  BASE_REROUTE_DISTANCE_METERS,
  REROUTE_CONFIRMATION_UPDATES,
  REROUTE_COOLDOWN_MS,
  STEP_SWITCH_DISTANCE_METERS,
} from './navigation.constants';
import { getDistanceToPlace } from './getDistanceToPlace';
import { getDistanceToRoute } from './getDistanceToRoute';
import type {
  NavigationDebugInfo,
  NavigationPlace,
  NavigationState,
  NavigationUserLocation,
} from './navigation.types';

const initialDebug: NavigationDebugInfo = {
  accuracy: null,
  distanceToRoute: null,
  distanceToTarget: null,
  currentStep: '0/0',
  offRouteUpdates: 0,
};

const toRoutePoint = (location: NavigationUserLocation): RoutePoint => ({
  latitude: location.latitude,
  longitude: location.longitude,
});

const toUserLocation = (position: GeolocationPosition): NavigationUserLocation => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
  heading: position.coords.heading ?? null,
  speed: position.coords.speed ?? null,
  timestamp: position.timestamp,
});

export const useNavigation = (places: NavigationPlace[], enabled: boolean) => {
  const [state, setState] = useState<NavigationState>({
    status: enabled ? 'waiting-location' : 'error',
    currentPlaceIndex: 0,
    currentStepIndex: 0,
    userLocation: null,
    route: null,
    error: enabled ? null : 'Навигатор доступен на телефоне',
    message: null,
    debug: initialDebug,
  });
  const stateRef = useRef(state);
  const targetId = places[0]?.id ?? null;
  const watchIdRef = useRef<number | null>(null);
  const arrivalUpdatesRef = useRef(0);
  const offRouteUpdatesRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const routeBuildInFlightRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const remainingPlaces = useMemo(
    () => places.slice(state.currentPlaceIndex),
    [places, state.currentPlaceIndex],
  );
  const currentPlace = places[state.currentPlaceIndex] ?? null;
  const currentLeg = state.route?.legs[0] ?? null;
  const currentSteps = state.route?.steps ?? [];
  const currentStep: RouteStep | undefined = currentSteps[state.currentStepIndex];

  const buildRoute = useCallback(
    async (location: NavigationUserLocation, placeIndex: number) => {
      const nextPlaces = places.slice(placeIndex, placeIndex + 1);

      if (nextPlaces.length === 0) {
        setState((previousState) => ({
          ...previousState,
          status: 'finished',
          route: null,
          currentStepIndex: 0,
          message: null,
        }));
        return;
      }

      if (routeBuildInFlightRef.current) {
        return;
      }

      routeBuildInFlightRef.current = true;
      setState((previousState) => ({
        ...previousState,
        status: 'building-route',
        message: 'Строим маршрут...',
        error: null,
      }));

      try {
        const nextRoute = await getWalkingRoute([
          toRoutePoint(location),
          ...nextPlaces.map((place) => ({
            latitude: place.latitude,
            longitude: place.longitude,
          })),
        ]);

        arrivalUpdatesRef.current = 0;
        offRouteUpdatesRef.current = 0;
        setState((previousState) => ({
          ...previousState,
          status: 'navigating',
          route: nextRoute,
          currentPlaceIndex: placeIndex,
          currentStepIndex: 0,
          message: 'Маршрут обновлён',
          error: null,
        }));
      } catch (error) {
        console.error('[Navigation] route build failed', error);
        setState((previousState) => ({
          ...previousState,
          status: 'error',
          error: 'Не удалось построить маршрут.',
          message: null,
        }));
      } finally {
        routeBuildInFlightRef.current = false;
      }
    },
    [places],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      arrivalUpdatesRef.current = 0;
      offRouteUpdatesRef.current = 0;
      setState((previousState) => ({
        ...previousState,
        status: 'waiting-location',
        currentPlaceIndex: 0,
        currentStepIndex: 0,
        route: null,
        error: null,
        message: null,
      }));

      const location = stateRef.current.userLocation;

      if (location) {
        void buildRoute(location, 0);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [buildRoute, enabled, targetId]);

  const processLocationUpdate = useCallback(
    (location: NavigationUserLocation) => {
      const currentState = stateRef.current;

      setState((previousState) => ({
        ...previousState,
        userLocation: location,
        debug: {
          ...previousState.debug,
          accuracy: location.accuracy,
        },
      }));

      if (currentState.status === 'waiting-location' || currentState.status === 'error') {
        void buildRoute(location, currentState.currentPlaceIndex);
        return;
      }

      if (currentState.status !== 'navigating') {
        return;
      }

      if (location.accuracy > BAD_ACCURACY_METERS) {
        setState((previousState) => ({
          ...previousState,
          message: 'Низкая точность GPS...',
        }));
        return;
      }

      const targetPlace = places[currentState.currentPlaceIndex];

      if (!targetPlace || !currentState.route) {
        return;
      }

      const distanceToTarget = getDistanceToPlace(location, targetPlace);
      const arrivalThreshold = Math.max(
        BASE_ARRIVAL_DISTANCE_METERS,
        Math.min(location.accuracy, 60),
      );

      if (distanceToTarget <= arrivalThreshold) {
        arrivalUpdatesRef.current += 1;
      } else {
        arrivalUpdatesRef.current = 0;
      }

      if (arrivalUpdatesRef.current >= ARRIVAL_CONFIRMATION_UPDATES) {
        setState((previousState) => ({
          ...previousState,
          status: 'arrived',
          message: null,
          debug: {
            ...previousState.debug,
            distanceToTarget,
          },
        }));
        return;
      }

      const currentStep = currentState.route.steps[currentState.currentStepIndex];

      if (currentStep) {
        const distanceToManeuver = getDistanceToPlace(location, {
          longitude: currentStep.maneuver.location[0],
          latitude: currentStep.maneuver.location[1],
        });

        if (
          distanceToManeuver <= STEP_SWITCH_DISTANCE_METERS &&
          currentState.currentStepIndex < currentState.route.steps.length - 1
        ) {
          setState((previousState) => ({
            ...previousState,
            currentStepIndex: previousState.currentStepIndex + 1,
          }));
        }
      }

      const distanceToRoute = getDistanceToRoute(location, currentState.route);
      const rerouteThreshold = Math.max(BASE_REROUTE_DISTANCE_METERS, location.accuracy * 1.5);

      if (distanceToRoute > rerouteThreshold) {
        offRouteUpdatesRef.current += 1;
      } else {
        offRouteUpdatesRef.current = 0;
      }

      setState((previousState) => ({
        ...previousState,
        debug: {
          accuracy: location.accuracy,
          distanceToRoute,
          distanceToTarget,
          currentStep: `${previousState.currentStepIndex + 1}/${currentState.route?.steps.length ?? 0}`,
          offRouteUpdates: offRouteUpdatesRef.current,
        },
      }));

      const now = Date.now();

      if (
        offRouteUpdatesRef.current >= REROUTE_CONFIRMATION_UPDATES &&
        now - lastRerouteAtRef.current >= REROUTE_COOLDOWN_MS
      ) {
        lastRerouteAtRef.current = now;
        offRouteUpdatesRef.current = 0;
        setState((previousState) => ({
          ...previousState,
          message: 'Перестраиваем маршрут...',
        }));
        void buildRoute(location, currentState.currentPlaceIndex);
      }
    },
    [buildRoute, places],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!navigator.geolocation) {
      const timeoutId = window.setTimeout(() => {
        setState((previousState) => ({
          ...previousState,
          status: 'error',
          error: 'Геопозиция недоступна в этом браузере.',
        }));
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        processLocationUpdate(toUserLocation(position));
      },
      (error) => {
        console.error('[Navigation] GPS error', error);
        setState((previousState) => ({
          ...previousState,
          status: 'error',
          error: 'Для навигации нужен доступ к геопозиции.',
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, processLocationUpdate]);

  const pause = useCallback(() => {
    setState((previousState) =>
      previousState.status === 'navigating'
        ? {
            ...previousState,
            status: 'paused',
          }
        : previousState,
    );
  }, []);

  const resume = useCallback(() => {
    setState((previousState) =>
      previousState.status === 'paused'
        ? {
            ...previousState,
            status: 'navigating',
          }
        : previousState,
    );
  }, []);

  const goToNextPlace = useCallback(() => {
    const currentState = stateRef.current;
    const nextPlaceIndex = currentState.currentPlaceIndex + 1;

    if (nextPlaceIndex >= places.length) {
      setState((previousState) => ({
        ...previousState,
        status: 'finished',
        route: null,
        currentPlaceIndex: nextPlaceIndex,
        currentStepIndex: 0,
      }));
      return;
    }

    if (currentState.userLocation) {
      void buildRoute(currentState.userLocation, nextPlaceIndex);
    }
  }, [buildRoute, places.length]);

  const retry = useCallback(() => {
    const currentState = stateRef.current;

    if (currentState.userLocation) {
      void buildRoute(currentState.userLocation, currentState.currentPlaceIndex);
      return;
    }

    setState((previousState) => ({
      ...previousState,
      status: 'waiting-location',
      error: null,
      message: null,
    }));
  }, [buildRoute]);

  return {
    state,
    currentPlace,
    remainingPlaces,
    currentLeg,
    currentStep,
    pause,
    resume,
    retry,
    goToNextPlace,
  };
};
