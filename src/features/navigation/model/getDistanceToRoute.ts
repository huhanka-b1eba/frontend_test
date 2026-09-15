import nearestPointOnLine from '@turf/nearest-point-on-line';
import { lineString, point } from '@turf/helpers';

import type { RouteResult } from '@shared/api/osrm';

import type { NavigationUserLocation } from './navigation.types';

export const getDistanceToRoute = (userLocation: NavigationUserLocation, route: RouteResult) => {
  const nearestPoint = nearestPointOnLine(
    lineString(route.geometry.coordinates),
    point([userLocation.longitude, userLocation.latitude]),
    { units: 'kilometers' },
  );

  return (nearestPoint.properties.dist ?? 0) * 1000;
};
