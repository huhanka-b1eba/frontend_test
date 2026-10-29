import type { OsrmTableResponse, RouteMatrix, RoutePoint } from './types';
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

export const getRouteMatrix = async (
  points: RoutePoint[],
  mode: RoutableTransportMode,
): Promise<RouteMatrix> => {
  if (points.length < 2) {
    throw new Error('OSRM matrix requires at least two points');
  }

  const params = new URLSearchParams({
    annotations: 'duration,distance',
  });
  const coordinates = points.map(formatPoint).join(';');
  const tableUrl = `${OSRM_BASE_URLS[mode]}/table/v1/${OSRM_PROFILES[mode]}`;
  const response = await fetch(`${tableUrl}/${coordinates}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`OSRM matrix request failed with status ${response.status}`);
  }

  const data = (await response.json()) as OsrmTableResponse;

  if (data.code !== 'Ok' || !data.durations || !data.distances) {
    throw new Error(data.message || `OSRM matrix returned ${data.code}`);
  }

  return {
    durations: data.durations,
    distances: data.distances,
  };
};

export const getWalkingMatrix = async (points: RoutePoint[]): Promise<RouteMatrix> => {
  return getRouteMatrix(points, 'walking');
};
