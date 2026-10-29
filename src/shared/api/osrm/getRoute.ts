import type { OsrmRouteResponse, RoutePoint, RouteResult } from './types';
import type { RoutableTransportMode } from '@shared/lib/transport';

const OSRM_BASE_URLS: Record<RoutableTransportMode, string> = {
  walking: 'https://routing.openstreetmap.de/routed-foot',
  cycling: 'https://routing.openstreetmap.de/routed-bike',
  driving: 'https://routing.openstreetmap.de/routed-car',
};

const OSRM_PROFILES: Record<RoutableTransportMode, string> = {
  walking: 'foot',
  cycling: 'bike',
  driving: 'car',
};

const formatPoint = ({ latitude, longitude }: RoutePoint) => {
  return `${longitude},${latitude}`;
};

export const getRoute = async (
  points: RoutePoint[],
  mode: RoutableTransportMode,
): Promise<RouteResult> => {
  if (points.length < 2) {
    throw new Error('OSRM route requires at least two points');
  }

  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    alternatives: 'false',
  });
  const coordinates = points.map(formatPoint).join(';');
  const routeUrl = `${OSRM_BASE_URLS[mode]}/route/v1/${OSRM_PROFILES[mode]}`;

  const response = await fetch(`${routeUrl}/${coordinates}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`OSRM request failed with status ${response.status}`);
  }

  const data = (await response.json()) as OsrmRouteResponse;
  const route = data.routes?.[0];

  if (data.code !== 'Ok' || !route) {
    throw new Error(data.message || `OSRM returned ${data.code}`);
  }

  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    legs: route.legs.map((leg) => ({
      distance: leg.distance,
      duration: leg.duration,
    })),
    steps: route.legs.flatMap((leg) =>
      leg.steps.map((step) => ({
        distance: step.distance,
        duration: step.duration,
        name: step.name,
        maneuver: step.maneuver,
      })),
    ),
    mode,
  };
};

export const getWalkingRoute = async (points: RoutePoint[]): Promise<RouteResult> => {
  return getRoute(points, 'walking');
};
