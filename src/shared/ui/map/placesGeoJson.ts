import type { Place, PlaceCategory } from '@shared/api/overpass';

export type PlacesFeatureProperties = {
  id: string;
  name: string;
  category: PlaceCategory;
  markerLabel: string;
  categoryIconUrl: string;
  imageUrl: string;
  rating: number | null;
};

export type PlacesFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [longitude: number, latitude: number];
  };
  properties: PlacesFeatureProperties;
};

export type PlacesFeatureCollection = {
  type: 'FeatureCollection';
  features: PlacesFeature[];
};

export type RouteMapPlace = Place & {
  order: number;
};

export type RoutePlacesFeatureProperties = {
  id: string;
  name: string;
  order: number;
  category: PlaceCategory;
  categoryIconUrl: string;
  imageUrl: string;
};

export type RoutePlacesFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [longitude: number, latitude: number];
    };
    properties: RoutePlacesFeatureProperties;
  }>;
};

export const getPlaceMarkerLabel = (category: PlaceCategory) => {
  switch (category) {
    case 'cafe':
      return 'C';
    case 'restaurant':
      return 'R';
    case 'museum':
      return 'M';
    case 'gallery':
    case 'artwork':
    case 'arts_centre':
      return 'A';
    case 'park':
    case 'garden':
      return 'P';
    case 'place_of_worship':
      return 'W';
    case 'theatre':
      return 'T';
    case 'viewpoint':
      return 'V';
    case 'historic':
      return 'H';
    case 'attraction':
      return '!';
    default:
      return '•';
  }
};

export const createPlacesFeatureCollection = (places: Place[]): PlacesFeatureCollection => ({
  type: 'FeatureCollection',
  features: places.map((place) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [place.longitude, place.latitude],
    },
    properties: {
      id: place.id,
      name: place.name,
      category: place.category,
      markerLabel: getPlaceMarkerLabel(place.category),
      categoryIconUrl: place.categoryIconUrl ?? place.tags.categoryIconUrl ?? '',
      imageUrl: place.imageUrl ?? place.tags.imageUrl ?? '',
      rating: place.rating ?? null,
    },
  })),
});

export const createRoutePlacesFeatureCollection = (
  places: RouteMapPlace[],
): RoutePlacesFeatureCollection => ({
  type: 'FeatureCollection',
  features: places.map((place) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [place.longitude, place.latitude],
    },
    properties: {
      id: place.id,
      name: place.name,
      order: place.order,
      category: place.category,
      categoryIconUrl: place.categoryIconUrl ?? place.tags.categoryIconUrl ?? '',
      imageUrl: place.imageUrl ?? place.tags.imageUrl ?? '',
    },
  })),
});
