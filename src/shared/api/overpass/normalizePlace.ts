import type { OverpassElement, Place, PlaceCategory } from './types';

const TOURISM_CATEGORIES: Partial<Record<string, PlaceCategory>> = {
  attraction: 'attraction',
  museum: 'museum',
  gallery: 'gallery',
  artwork: 'artwork',
  viewpoint: 'viewpoint',
};

const AMENITY_CATEGORIES: Partial<Record<string, PlaceCategory>> = {
  museum: 'museum',
  place_of_worship: 'place_of_worship',
  theatre: 'theatre',
  cafe: 'cafe',
  restaurant: 'restaurant',
  arts_centre: 'arts_centre',
};

const LEISURE_CATEGORIES: Partial<Record<string, PlaceCategory>> = {
  park: 'park',
  garden: 'garden',
};

export const getPlaceCategory = (tags: Record<string, string>): PlaceCategory => {
  const tourismCategory = tags.tourism ? TOURISM_CATEGORIES[tags.tourism] : undefined;

  if (tourismCategory) {
    return tourismCategory;
  }

  if (tags.historic) {
    return 'historic';
  }

  const amenityCategory = tags.amenity ? AMENITY_CATEGORIES[tags.amenity] : undefined;

  if (amenityCategory) {
    return amenityCategory;
  }

  const leisureCategory = tags.leisure ? LEISURE_CATEGORIES[tags.leisure] : undefined;

  if (leisureCategory) {
    return leisureCategory;
  }

  return 'unknown';
};

export const normalizePlace = (element: OverpassElement): Place | null => {
  const tags = element.tags ?? {};
  const name = tags.name?.trim();
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (!name || latitude === undefined || longitude === undefined) {
    return null;
  }

  return {
    id: `${element.type}-${element.id}`,
    osmId: element.id,
    osmType: element.type,
    name,
    latitude,
    longitude,
    category: getPlaceCategory(tags),
    tags,
  };
};
