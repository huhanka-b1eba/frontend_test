import type { TransportMode } from '@shared/lib/transport';

export type YandexRoutePoint = {
  latitude: number;
  longitude: number;
};

type BuildYandexMapsRouteUrlOptions = {
  transportMode?: TransportMode;
};

export const YANDEX_MAPS_MAX_ROUTE_POINTS = 20;

const isValidYandexRoutePoint = ({ latitude, longitude }: YandexRoutePoint) => {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

export const canOpenRouteInYandexMaps = (points: YandexRoutePoint[]) => {
  return (
    points.length > 0 &&
    points.length <= YANDEX_MAPS_MAX_ROUTE_POINTS &&
    points.every(isValidYandexRoutePoint)
  );
};

export function buildYandexMapsRouteUrl(
  points: YandexRoutePoint[],
  options: BuildYandexMapsRouteUrlOptions = {},
): string {
  if (!canOpenRouteInYandexMaps(points)) {
    return 'https://yandex.ru/maps/';
  }

  const rtext = points.map(({ latitude, longitude }) => `${latitude},${longitude}`).join('~');
  const params = new URLSearchParams({
    mode: 'routes',
    rtext,
  });

  if (options.transportMode === 'walking') {
    params.set('rtt', 'pd');
  }

  return `https://yandex.ru/maps/?${params.toString()}`;
}
