import { buildOverpassQuery } from './buildOverpassQuery';
import { normalizePlace } from './normalizePlace';
import type { NearbyPlacesParams, OverpassResponse, Place } from './types';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const MAX_PLACES = 300;
const REQUEST_TIMEOUT_MS = 30000;

class OverpassRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const shouldTryNextEndpoint = (status: number) => {
  return status === 406 || status === 429 || status >= 500;
};

const fetchOverpass = async (endpoint: string, query: string): Promise<OverpassResponse> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        data: query,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OverpassRequestError(
        `Overpass request failed with status ${response.status}`,
        response.status,
      );
    }

    return (await response.json()) as OverpassResponse;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const getNearbyPlaces = async (params: NearbyPlacesParams): Promise<Place[]> => {
  const query = buildOverpassQuery(params);
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchOverpass(endpoint, query);
      const placesById = new Map<string, Place>();

      response.elements.forEach((element) => {
        const place = normalizePlace(element);

        if (place && !placesById.has(place.id)) {
          placesById.set(place.id, place);
        }
      });

      return Array.from(placesById.values()).slice(0, MAX_PLACES);
    } catch (error) {
      lastError = error;

      if (
        error instanceof OverpassRequestError &&
        error.status &&
        !shouldTryNextEndpoint(error.status)
      ) {
        break;
      }

      console.error(`[Overpass] ${endpoint} failed`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Overpass request failed');
};
