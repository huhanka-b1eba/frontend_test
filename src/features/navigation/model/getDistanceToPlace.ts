import turfDistance from '@turf/distance';
import { point } from '@turf/helpers';

import type { NavigationUserLocation } from './navigation.types';

type NavigationTarget = {
  latitude: number;
  longitude: number;
};

export const getDistanceToPlace = (
  userLocation: NavigationUserLocation,
  place: NavigationTarget,
) => {
  return (
    turfDistance(
      point([userLocation.longitude, userLocation.latitude]),
      point([place.longitude, place.latitude]),
      { units: 'kilometers' },
    ) * 1000
  );
};
