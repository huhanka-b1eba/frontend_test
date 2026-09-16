import type { RouteResult } from '@shared/api/osrm';

import type { RoutePlace } from './routePlaces';
import type { RouteSegment } from './routeSegments';

export const getTravelDurationMinutes = (route: RouteResult | null) => {
  return route ? Math.round(route.duration / 60) : 0;
};

export const getVisitDurationMinutes = (places: RoutePlace[]) => {
  return places.reduce((sum, place) => sum + place.visitDurationMinutes, 0);
};

export const getTravelDurationMinutesFromSegments = (segments: RouteSegment[]) => {
  if (segments.some((segment) => segment.duration === null)) {
    return null;
  }

  return Math.round(segments.reduce((sum, segment) => sum + (segment.duration ?? 0), 0) / 60);
};

export const getTravelDistanceMetersFromSegments = (segments: RouteSegment[]) => {
  if (segments.some((segment) => segment.distance === null)) {
    return null;
  }

  return segments.reduce((sum, segment) => sum + (segment.distance ?? 0), 0);
};

export const getTotalRouteDurationMinutes = (route: RouteResult | null, places: RoutePlace[]) => {
  return getTravelDurationMinutes(route) + getVisitDurationMinutes(places);
};

export const getTotalRouteDurationMinutesFromSegments = (
  segments: RouteSegment[],
  places: RoutePlace[],
) => {
  const travelDurationMinutes = getTravelDurationMinutesFromSegments(segments);

  return travelDurationMinutes === null
    ? null
    : travelDurationMinutes + getVisitDurationMinutes(places);
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
