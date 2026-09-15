import type { PlaceCategory } from '@shared/api/overpass';
import type { TransportMode } from '@shared/lib/transport';

import type { CompactSharedRoute, SharedRoute } from './types';

const VALID_CATEGORIES = new Set<PlaceCategory>([
  'attraction',
  'museum',
  'gallery',
  'artwork',
  'viewpoint',
  'historic',
  'place_of_worship',
  'theatre',
  'cafe',
  'restaurant',
  'arts_centre',
  'park',
  'garden',
  'unknown',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const base64UrlToBytes = (value: string) => {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = window.atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const isFiniteLatitude = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
};

const isFiniteLongitude = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
};

const isOsmType = (value: unknown): value is 'node' | 'way' | 'relation' => {
  return value === 'node' || value === 'way' || value === 'relation';
};

const isPlaceCategory = (value: unknown): value is PlaceCategory => {
  return typeof value === 'string' && VALID_CATEGORIES.has(value as PlaceCategory);
};

const isTransportMode = (value: unknown): value is TransportMode => {
  return value === 'walking' || value === 'cycling' || value === 'driving' || value === 'transit';
};

const normalizeCompactRoute = (compactRoute: CompactSharedRoute): SharedRoute | null => {
  if (compactRoute.v !== 1 || !Array.isArray(compactRoute.p) || compactRoute.p.length === 0) {
    return null;
  }

  if (compactRoute.p.length > 100) {
    return null;
  }

  const places = compactRoute.p.map((place) => {
    if (
      !isRecord(place) ||
      typeof place.i !== 'string' ||
      typeof place.oi !== 'number' ||
      !Number.isFinite(place.oi) ||
      !isOsmType(place.ot) ||
      typeof place.n !== 'string' ||
      !isFiniteLatitude(place.a) ||
      !isFiniteLongitude(place.o) ||
      !isPlaceCategory(place.c) ||
      typeof place.d !== 'number' ||
      !Number.isFinite(place.d) ||
      place.d <= 0
    ) {
      return null;
    }

    return {
      id: place.i,
      osmId: place.oi,
      osmType: place.ot,
      name: place.n,
      latitude: place.a,
      longitude: place.o,
      category: place.c,
      visitDurationMinutes: Math.round(place.d),
    };
  });

  if (places.some((place) => place === null)) {
    return null;
  }

  return {
    version: 1,
    transportMode: isTransportMode(compactRoute.m) ? compactRoute.m : 'walking',
    places: places.filter((place) => place !== null),
  };
};

export const decodeSharedRoute = (payload: string | null): SharedRoute | null => {
  if (!payload) {
    return null;
  }

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payload));
    const parsed = JSON.parse(json) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    return normalizeCompactRoute(parsed as CompactSharedRoute);
  } catch {
    return null;
  }
};
