import type { CompactSharedRoute, SharedRoute } from './types';

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

const toCompactRoute = (route: SharedRoute): CompactSharedRoute => ({
  v: 1,
  m: route.transportMode,
  p: route.places.map((place) => ({
    i: place.id,
    oi: place.osmId,
    ot: place.osmType,
    n: place.name,
    a: place.latitude,
    o: place.longitude,
    c: place.category,
    d: place.visitDurationMinutes,
  })),
});

export const encodeSharedRoute = (route: SharedRoute) => {
  const json = JSON.stringify(toCompactRoute(route));

  return bytesToBase64Url(new TextEncoder().encode(json));
};

export const createRouteShareUrl = (route: SharedRoute) => {
  const url = new URL('/route/mobile', window.location.origin);

  url.searchParams.set('data', encodeSharedRoute(route));

  return url.toString();
};
