import type { RouteResult } from '@shared/api/osrm';
import type { SharedRoutePlace } from '@shared/lib/route-share';

export type NavigationStatus =
  | 'waiting-location'
  | 'building-route'
  | 'navigating'
  | 'paused'
  | 'arrived'
  | 'finished'
  | 'error';

export type NavigationUserLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

export type NavigationInstruction = {
  title: string;
  streetName: string | null;
};

export type NavigationDebugInfo = {
  accuracy: number | null;
  distanceToRoute: number | null;
  distanceToTarget: number | null;
  currentStep: string;
  offRouteUpdates: number;
};

export type NavigationState = {
  status: NavigationStatus;
  currentPlaceIndex: number;
  currentStepIndex: number;
  userLocation: NavigationUserLocation | null;
  route: RouteResult | null;
  error: string | null;
  message: string | null;
  debug: NavigationDebugInfo;
};

export type NavigationPlace = SharedRoutePlace & {
  order: number;
};
