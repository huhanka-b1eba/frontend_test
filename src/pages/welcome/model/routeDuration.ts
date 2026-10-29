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

type DurationLanguage = 'ru' | 'tt';

export const formatDurationMinutes = (totalMinutes: number, language: DurationLanguage = 'ru') => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourUnit = language === 'tt' ? 'сәг' : 'ч';
  const minuteUnit = language === 'tt' ? 'мин' : 'мин';

  if (hours === 0) {
    return `${minutes} ${minuteUnit}`;
  }

  if (minutes === 0) {
    return `${hours} ${hourUnit}`;
  }

  return `${hours} ${hourUnit} ${minutes} ${minuteUnit}`;
};

export const formatDistanceMeters = (distance: number, language: DurationLanguage = 'ru') => {
  if (distance < 1000) {
    return `${Math.round(distance)} м`;
  }

  const formattedDistance = (distance / 1000).toFixed(1);

  return `${formattedDistance} ${language === 'tt' ? 'км' : 'км'}`;
};
