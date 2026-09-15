import type { PlaceCategory } from '@shared/api/overpass';
import type { TransportMode } from '@shared/lib/transport';

export type SharedRoutePlace = {
  id: string;
  osmId: number;
  osmType: 'node' | 'way' | 'relation';
  name: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
  visitDurationMinutes: number;
};

export type SharedRoute = {
  version: 1;
  transportMode: TransportMode;
  places: SharedRoutePlace[];
};

export type CompactSharedRoute = {
  v: 1;
  m?: TransportMode;
  p: Array<{
    i: string;
    oi: number;
    ot: 'node' | 'way' | 'relation';
    n: string;
    a: number;
    o: number;
    c: PlaceCategory;
    d: number;
  }>;
};
