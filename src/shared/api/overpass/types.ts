export type OverpassElement = {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  elements: OverpassElement[];
};

export type PlaceCategory =
  | 'attraction'
  | 'museum'
  | 'gallery'
  | 'artwork'
  | 'viewpoint'
  | 'historic'
  | 'place_of_worship'
  | 'theatre'
  | 'cafe'
  | 'restaurant'
  | 'arts_centre'
  | 'park'
  | 'garden'
  | 'unknown';

export type Place = {
  id: string;
  osmId: number;
  osmType: 'node' | 'way' | 'relation';
  name: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
  tags: Record<string, string>;
  categoryIconUrl?: string | null;
  imageUrl?: string | null;
  description?: string;
  rating?: number | null;
};

export type NearbyPlacesParams = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};
