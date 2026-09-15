import type { Place, PlaceCategory } from '@shared/api/overpass';

export const VISIT_DURATION_STEP_MINUTES = 5;
export const MIN_VISIT_DURATION_MINUTES = 5;
export const MAX_VISIT_DURATION_MINUTES = 180;

const DEFAULT_VISIT_DURATION: Record<PlaceCategory, number> = {
  attraction: 25,
  museum: 45,
  gallery: 35,
  artwork: 10,
  viewpoint: 15,
  historic: 20,
  place_of_worship: 20,
  theatre: 30,
  cafe: 30,
  restaurant: 45,
  arts_centre: 30,
  park: 30,
  garden: 25,
  unknown: 20,
};

export type RoutePlace = Place & {
  order: number;
  visitDurationMinutes: number;
};

export const reorderRoutePlaces = (places: Place[]): RoutePlace[] => {
  return places.map((place, index) => ({
    ...place,
    order: index + 1,
    visitDurationMinutes:
      'visitDurationMinutes' in place && typeof place.visitDurationMinutes === 'number'
        ? place.visitDurationMinutes
        : getDefaultVisitDuration(place.category),
  }));
};

export const getDefaultVisitDuration = (category: PlaceCategory): number => {
  return DEFAULT_VISIT_DURATION[category];
};

export const clampVisitDuration = (durationMinutes: number) => {
  return Math.min(
    MAX_VISIT_DURATION_MINUTES,
    Math.max(MIN_VISIT_DURATION_MINUTES, durationMinutes),
  );
};

export const addRoutePlace = (places: RoutePlace[], place: Place): RoutePlace[] => {
  if (places.some((routePlace) => routePlace.id === place.id)) {
    return places;
  }

  return [
    ...places,
    {
      ...place,
      order: places.length + 1,
      visitDurationMinutes: getDefaultVisitDuration(place.category),
    },
  ];
};

export const removeRoutePlace = (places: RoutePlace[], placeId: string): RoutePlace[] => {
  return reorderRoutePlaces(places.filter((place) => place.id !== placeId));
};

export const updateRoutePlaceVisitDuration = (
  places: RoutePlace[],
  placeId: string,
  durationMinutes: number,
): RoutePlace[] => {
  return places.map((place) =>
    place.id === placeId
      ? {
          ...place,
          visitDurationMinutes: clampVisitDuration(durationMinutes),
        }
      : place,
  );
};
