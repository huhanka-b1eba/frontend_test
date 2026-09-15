import type { Place, PlaceCategory } from '@shared/api/overpass';

export type PlaceFilter =
  'all' | 'history' | 'culture' | 'food' | 'museums' | 'nature' | 'viewpoints';

export const PLACE_FILTER_LABELS: Record<PlaceFilter, string> = {
  all: 'Все',
  history: 'История',
  culture: 'Культура',
  food: 'Еда',
  museums: 'Музеи',
  nature: 'Парки',
  viewpoints: 'Смотровые',
};

const PLACE_FILTER_CATEGORIES: Record<Exclude<PlaceFilter, 'all'>, PlaceCategory[]> = {
  history: ['historic', 'attraction'],
  culture: ['place_of_worship', 'theatre', 'arts_centre', 'artwork'],
  food: ['cafe', 'restaurant'],
  museums: ['museum', 'gallery'],
  nature: ['park', 'garden'],
  viewpoints: ['viewpoint'],
};

export const PLACE_FILTERS = Object.keys(PLACE_FILTER_LABELS) as PlaceFilter[];

export const filterPlaces = (places: Place[], filter: PlaceFilter) => {
  if (filter === 'all') {
    return places;
  }

  const categories = PLACE_FILTER_CATEGORIES[filter];

  return places.filter((place) => categories.includes(place.category));
};

export const getPlaceFilterCount = (places: Place[], filter: PlaceFilter) => {
  return filterPlaces(places, filter).length;
};
