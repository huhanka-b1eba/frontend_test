import type { RouteResult } from '@shared/api/osrm';

import type { RoutePlace } from './routePlaces';

export const getTravelDurationMinutes = (route: RouteResult | null) => {
  return route ? Math.round(route.duration / 60) : 0;
};

export const getVisitDurationMinutes = (places: RoutePlace[]) => {
  return places.reduce((sum, place) => sum + place.visitDurationMinutes, 0);
};

export const getTotalRouteDurationMinutes = (route: RouteResult | null, places: RoutePlace[]) => {
  return getTravelDurationMinutes(route) + getVisitDurationMinutes(places);
};

export const formatDurationMinutes = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} мин`;
  }

  if (minutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${minutes} мин`;
};

export const formatDistanceMeters = (distance: number) => {
  if (distance < 1000) {
    return `${Math.round(distance)} м`;
  }

  return `${(distance / 1000).toFixed(1)} км`;
};
