import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { Place } from '@shared/api/overpass';
import type { HistoricalPlace } from '@shared/api/historical-places';
import type { GeoJsonFeature, GeoJsonLineString } from '@shared/lib/geojson';
import { cn } from '@shared/lib/cn';
import {
  createPlacesFeatureCollection,
  createRoutePlacesFeatureCollection,
  type RouteMapPlace,
} from './placesGeoJson';

export type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
};

export type MapDestination = {
  latitude: number;
  longitude: number;
};

export type HistoricalViewport = {
  lat: number;
  lon: number;
  radiusMeters: number;
};

const KAZAN_CENTER: maplibregl.LngLatLike = [49.1064, 55.7961];
const KAZAN_ZOOM = 13;
const ROUTE_SOURCE_ID = 'route';
const ROUTE_LAYER_ID = 'route-line';
const HISTORICAL_PARCHMENT_SOURCE_ID = 'historical-parchment';
const HISTORICAL_PARCHMENT_LAYER_ID = 'historical-parchment-overlay';
const PLACES_SOURCE_ID = 'places';
const PLACES_CLUSTERS_LAYER_ID = 'places-clusters';
const PLACES_CLUSTER_COUNT_LAYER_ID = 'places-cluster-count';
const PLACES_UNCLUSTERED_LAYER_ID = 'places-unclustered';
const PLACES_UNCLUSTERED_LABEL_LAYER_ID = 'places-unclustered-labels';
const ROUTE_PLACES_SOURCE_ID = 'route-places';
const ROUTE_PLACES_CIRCLE_LAYER_ID = 'route-places-circles';
const ROUTE_PLACES_LABEL_LAYER_ID = 'route-places-labels';
const USER_LOCATION_SOURCE_ID = 'navigation-user-location';
const USER_ACCURACY_LAYER_ID = 'navigation-user-accuracy';
const USER_LOCATION_LAYER_ID = 'navigation-user-point';
const HISTORICAL_SOURCE_ID = 'historical-places';
const HISTORICAL_CLUSTERS_LAYER_ID = 'historical-places-clusters';
const HISTORICAL_CLUSTER_COUNT_LAYER_ID = 'historical-places-cluster-count';
const HISTORICAL_UNCLUSTERED_LAYER_ID = 'historical-places-unclustered';
const HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID = 'historical-places-unclustered-glyphs';
const HISTORICAL_MARKER_IMAGE_ID = 'historical-place-marker';
const HISTORY_RENDER_PREFIX = '[History]';
const HISTORY_DEBUG_PREFIX = '[HistoryDebug]';
const MAP_DATA_DEBUG_PREFIX = '[MapDataDebug]';
const ROUTE_DEBUG_PREFIX = '[ROUTE]';
const isHistoryDebugEnabled = import.meta.env.DEV;
const isMapDataDebugEnabled = import.meta.env.DEV;
const START_PICKING_CURSOR = 'none';
const MARKERS_MIN_ZOOM = 13;
const ROUTE_MARKERS_MIN_ZOOM = 13.6;
const CLOSE_MARKERS_ZOOM = 16;
const MAX_PHOTO_MARKERS = 5;
const PHOTO_MARKER_WIDTH = 116;
const PHOTO_MARKER_HEIGHT = 94;
const PHOTO_MARKER_COLLISION_GAP = 10;

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

const HISTORICAL_PARCHMENT_OVERLAY: GeoJsonFeature<{
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
}> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ],
    ],
  },
};

type MapProps = {
  className?: string;
  mapMode?: 'modern' | 'historical';
  destination?: MapDestination | null;
  places?: Place[];
  historicalPlaces?: HistoricalPlace[];
  historicalPlacesRequestId?: number | null;
  selectedHistoricalPlaceId?: string | null;
  routePlaces?: RouteMapPlace[];
  route?: GeoJsonLineString | null;
  routeDirty?: boolean;
  selectedPlace?: Place | null;
  userLocation?: UserLocation | null;
  isPickingStartPoint?: boolean;
  followUserLocation?: boolean;
  onUserMapInteraction?: () => void;
  onLocationChange?: (location: UserLocation) => void;
  onMapClick?: (destination: MapDestination) => void;
  onPlaceSelect?: (place: Place) => void;
  onHistoricalPlaceSelect?: (placeId: string) => void;
  onHistoricalViewportChange?: (viewport: HistoricalViewport) => void;
};

type GeolocateControlOptionsWithHeading = ConstructorParameters<
  typeof maplibregl.GeolocateControl
>[0] & {
  showUserHeading?: boolean;
};
type MarkerAnchor = NonNullable<ConstructorParameters<typeof maplibregl.Marker>[0]>['anchor'];

const getPlaceById = (places: Place[], placeId: string) => {
  return places.find((place) => place.id === placeId);
};

const getFirstFeature = (
  event: maplibregl.MapLayerMouseEvent,
): maplibregl.MapGeoJSONFeature | null => {
  return event.features?.[0] ?? null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isGeoJsonSource = (
  source: maplibregl.Source | undefined,
): source is maplibregl.GeoJSONSource => {
  const candidate = source as unknown;

  return isRecord(candidate) && typeof candidate.getClusterExpansionZoom === 'function';
};

const getPointCoordinates = (
  feature: maplibregl.MapGeoJSONFeature | null,
): [longitude: number, latitude: number] | null => {
  const geometry = feature?.geometry as unknown;

  if (!isRecord(geometry) || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  const coordinates = geometry.coordinates as unknown[];
  const longitude = coordinates[0];
  const latitude = coordinates[1];

  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return null;
  }

  return [longitude, latitude];
};

const getDistanceMeters = (
  first: { lat: number; lon: number },
  second: { lat: number; lon: number },
) => {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const firstLatitude = toRadians(first.lat);
  const secondLatitude = toRadians(second.lat);
  const latitudeDelta = toRadians(second.lat - first.lat);
  const longitudeDelta = toRadians(second.lon - first.lon);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const getHistoricalViewport = (map: maplibregl.Map): HistoricalViewport => {
  const center = map.getCenter();
  const bounds = map.getBounds();
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  const radiusMeters = Math.max(
    1000,
    Math.min(
      50000,
      Math.ceil(
        Math.max(
          getDistanceMeters(
            { lat: center.lat, lon: center.lng },
            { lat: northEast.lat, lon: northEast.lng },
          ),
          getDistanceMeters(
            { lat: center.lat, lon: center.lng },
            { lat: southWest.lat, lon: southWest.lng },
          ),
        ),
      ),
    ),
  );

  return {
    lat: Number(center.lat.toFixed(6)),
    lon: Number(center.lng.toFixed(6)),
    radiusMeters,
  };
};

const getFeatureProperty = (feature: maplibregl.MapGeoJSONFeature | null, key: string) => {
  const properties = feature?.properties as unknown;

  if (!isRecord(properties)) {
    return null;
  }

  return properties[key] ?? null;
};

const isValidHistoricalCoordinate = (place: HistoricalPlace) => {
  return (
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon) &&
    place.lat >= -90 &&
    place.lat <= 90 &&
    place.lon >= -180 &&
    place.lon <= 180
  );
};

const createHistoricalPlacesFeatureCollection = (places: HistoricalPlace[]) => ({
  type: 'FeatureCollection' as const,
  features: places.filter(isValidHistoricalCoordinate).map((place) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [place.lon, place.lat] as [number, number],
    },
    properties: {
      id: place.id,
    },
  })),
});

const historyRenderDebug = (message: string, payload?: Record<string, unknown>) => {
  if (!isHistoryDebugEnabled) {
    return;
  }

  console.debug(`${HISTORY_RENDER_PREFIX} ${message}`, payload ?? {});
};

const historyRenderTable = (message: string, rows: Array<Record<string, unknown>>) => {
  if (!isHistoryDebugEnabled) {
    return;
  }

  console.groupCollapsed(`${HISTORY_RENDER_PREFIX} ${message}`);
  console.table(rows);
  console.groupEnd();
};

const historyDebug = (message: string, payload?: Record<string, unknown>) => {
  if (!isHistoryDebugEnabled) {
    return;
  }

  console.debug(`${HISTORY_DEBUG_PREFIX} ${message}`, payload ?? {});
};

const mapDataDebug = (message: string, payload?: Record<string, unknown>) => {
  if (!isMapDataDebugEnabled) {
    return;
  }

  console.debug(`${MAP_DATA_DEBUG_PREFIX} ${message}`, payload ?? {});
};

const routeDebug = (message: string, payload?: Record<string, unknown>) => {
  if (!import.meta.env.DEV) {
    return;
  }

  console.debug(`${ROUTE_DEBUG_PREFIX} ${message}`, payload ?? {});
};

const getLayerDebugState = (map: maplibregl.Map, layerId: string) => {
  const layer = map.getLayer(layerId);

  if (!layer) {
    return {
      exists: false,
      visibility: null,
    };
  }

  return {
    exists: true,
    visibility: map.getLayoutProperty(layerId, 'visibility') ?? 'visible',
  };
};

const addHistoricalMarkerImage = (map: maplibregl.Map) => {
  if (map.hasImage(HISTORICAL_MARKER_IMAGE_ID)) {
    return;
  }

  const size = 64;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;

  if (!context) {
    return;
  }

  context.scale(2, 2);
  context.shadowColor = 'rgba(21, 75, 57, 0.32)';
  context.shadowBlur = 4;
  context.shadowOffsetY = 2;
  context.fillStyle = '#154b39';
  context.strokeStyle = '#f6df9f';
  context.lineWidth = 1.6;

  context.beginPath();
  context.arc(16, 14, 11, Math.PI, 0);
  context.bezierCurveTo(27, 19, 23, 29, 16, 31);
  context.bezierCurveTo(9, 29, 5, 19, 5, 14);
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowColor = 'transparent';
  context.fillStyle = '#fffaf0';
  context.beginPath();
  context.moveTo(10, 14);
  context.lineTo(16, 9);
  context.lineTo(22, 14);
  context.closePath();
  context.fill();
  context.fillRect(11, 15, 10, 1.8);
  context.fillRect(12, 17, 2, 6);
  context.fillRect(15, 17, 2, 6);
  context.fillRect(18, 17, 2, 6);
  context.fillRect(11, 24, 10, 1.8);

  map.addImage(HISTORICAL_MARKER_IMAGE_ID, context.getImageData(0, 0, size, size), {
    pixelRatio: 2,
  });
};

const getPlaceImageUrl = (place: Place) => {
  const imageUrl = place.imageUrl ?? place.tags.imageUrl;

  return imageUrl?.trim() || null;
};

const getPlaceCategoryIconUrl = (place: Place) => {
  const categoryIconUrl = place.categoryIconUrl ?? place.tags.categoryIconUrl;

  return categoryIconUrl?.trim() || null;
};

const createCategoryFallbackGlyph = (place: Place) => {
  const fallback = document.createElement('span');

  fallback.className = 'pointer-events-none text-[0.7rem] font-bold text-[#154b39]';
  fallback.textContent = place.name.trim().charAt(0).toUpperCase() || '•';

  return fallback;
};

const getPlaceRating = (place: Place) => {
  if (typeof place.rating === 'number' && Number.isFinite(place.rating)) {
    return place.rating;
  }

  const tagRating = Number(place.tags.rating);

  return Number.isFinite(tagRating) ? tagRating : null;
};

const getPlacePriority = (place: Place) => {
  return getPlaceRating(place) ?? Number.POSITIVE_INFINITY;
};

const isPlaceInBounds = (place: Place, bounds: maplibregl.LngLatBounds) => {
  return bounds.contains([place.longitude, place.latitude]);
};

const doesRectOverlap = (
  rect: { left: number; right: number; top: number; bottom: number },
  other: { left: number; right: number; top: number; bottom: number },
  gap = PHOTO_MARKER_COLLISION_GAP,
) => {
  return !(
    rect.right + gap < other.left ||
    rect.left - gap > other.right ||
    rect.bottom + gap < other.top ||
    rect.top - gap > other.bottom
  );
};

const getPhotoMarkerRect = (map: maplibregl.Map, place: Place) => {
  const point = map.project([place.longitude, place.latitude]);

  return {
    left: point.x - PHOTO_MARKER_WIDTH / 2,
    right: point.x + PHOTO_MARKER_WIDTH / 2,
    top: point.y - PHOTO_MARKER_HEIGHT - 18,
    bottom: point.y - 18,
  };
};

const createCategoryMarkerElement = (place: Place) => {
  const button = document.createElement('button');
  const iconUrl = getPlaceCategoryIconUrl(place);

  button.type = 'button';
  button.className = 'group grid size-11 place-items-center bg-transparent p-0 outline-none';
  button.setAttribute('aria-label', place.name);

  if (iconUrl) {
    const visual = document.createElement('span');
    const image = document.createElement('img');

    visual.className =
      'pointer-events-none grid size-10 place-items-center rounded-full transition-[filter,transform] duration-150 ease-out group-hover:scale-[1.06]';
    visual.style.filter = 'drop-shadow(0 7px 12px rgba(23,36,32,0.18))';
    image.src = iconUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.className = 'pointer-events-none h-9 w-auto object-contain';
    image.onerror = () => {
      image.remove();
      visual.className =
        'pointer-events-none grid size-8 place-items-center rounded-full border-[2px] bg-[#fffefb] p-[5px] shadow-[0_7px_18px_rgba(23,36,32,0.18)] transition-transform duration-150 ease-out group-hover:scale-[1.06]';
      visual.style.borderColor = '#154b39';
      visual.appendChild(createCategoryFallbackGlyph(place));
    };
    visual.appendChild(image);
    button.appendChild(visual);
  } else {
    const visual = document.createElement('span');

    visual.className =
      'pointer-events-none grid size-8 place-items-center rounded-full border-[2px] bg-[#fffefb] p-[5px] shadow-[0_7px_18px_rgba(23,36,32,0.18)] transition-transform duration-150 ease-out group-hover:scale-[1.06]';
    visual.style.borderColor = '#154b39';
    visual.appendChild(createCategoryFallbackGlyph(place));
    button.appendChild(visual);
  }

  return button;
};

const createPhotoMarkerElement = (place: Place) => {
  const button = document.createElement('button');
  const imageUrl = getPlaceImageUrl(place);
  const iconUrl = getPlaceCategoryIconUrl(place);

  button.type = 'button';
  button.className = 'group grid justify-items-center bg-transparent p-0 text-left outline-none';
  button.style.width = `${PHOTO_MARKER_WIDTH}px`;
  button.style.height = `${PHOTO_MARKER_HEIGHT}px`;
  button.setAttribute('aria-label', place.name);

  const visual = document.createElement('span');

  visual.className =
    'pointer-events-none grid justify-items-center transition-[filter,transform] duration-150 ease-out group-hover:scale-[1.025]';

  const card = document.createElement('span');

  card.className =
    'pointer-events-none block h-[72px] w-[112px] overflow-hidden rounded-[0.85rem] border-[2px] bg-[#fffefb] shadow-[0_12px_30px_rgba(23,36,32,0.18)]';
  card.style.borderColor = '#fffaf0';

  if (imageUrl) {
    const image = document.createElement('img');

    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.className = 'pointer-events-none h-full w-full object-cover';
    card.appendChild(image);
  }

  const pin = document.createElement('span');

  pin.className =
    'pointer-events-none mt-[-1px] grid size-8 place-items-center rounded-full border-[2px] border-[#fffaf0] bg-[#154b39] shadow-[0_6px_16px_rgba(23,36,32,0.2)]';

  if (iconUrl) {
    const icon = document.createElement('img');

    icon.src = iconUrl;
    icon.alt = '';
    icon.loading = 'lazy';
    icon.className = 'pointer-events-none size-4 object-contain brightness-0 invert';
    icon.onerror = () => {
      icon.remove();

      if (pin.childElementCount === 0) {
        const dot = document.createElement('span');

        dot.className = 'pointer-events-none size-2 rounded-full bg-[#fffaf0]';
        pin.appendChild(dot);
      }
    };
    pin.appendChild(icon);
  } else {
    const dot = document.createElement('span');

    dot.className = 'pointer-events-none size-2 rounded-full bg-[#fffaf0]';
    pin.appendChild(dot);
  }

  visual.appendChild(card);
  visual.appendChild(pin);
  button.appendChild(visual);

  return button;
};

const createRouteMarkerElement = (place: RouteMapPlace, showPhoto: boolean) => {
  const button = document.createElement('button');
  const imageUrl = showPhoto ? getPlaceImageUrl(place) : null;

  button.type = 'button';
  button.className =
    'group relative grid place-items-center bg-transparent p-0 text-left outline-none';
  button.style.width = '44px';
  button.style.height = '44px';
  button.setAttribute('aria-label', place.name);

  const visual = document.createElement('span');

  visual.className =
    'pointer-events-none relative grid size-11 place-items-center transition-[filter,transform] duration-150 ease-out group-hover:scale-[1.025]';

  if (imageUrl) {
    const card = document.createElement('span');
    const image = document.createElement('img');

    card.className =
      'pointer-events-none absolute bottom-[44px] left-1/2 block h-[74px] w-[116px] -translate-x-1/2 overflow-hidden rounded-[0.85rem] border-[3px] border-[#fffaf0] bg-[#fffefb] shadow-[0_16px_38px_rgba(23,36,32,0.24)]';
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.className = 'pointer-events-none h-full w-full object-cover';
    card.appendChild(image);
    visual.appendChild(card);
  }

  const pin = document.createElement('span');

  pin.className =
    'pointer-events-none grid size-10 place-items-center rounded-full border-[3px] border-[#fffaf0] bg-[#154b39] text-[0.92rem] font-bold text-[#fffaf0] shadow-[0_8px_22px_rgba(23,36,32,0.28)]';

  pin.textContent = String(place.order);

  visual.appendChild(pin);
  button.appendChild(visual);

  return button;
};

const createStartMarkerElement = () => {
  const wrapper = document.createElement('div');

  wrapper.className = 'pointer-events-none grid justify-items-center';
  wrapper.style.width = '56px';
  wrapper.style.height = '54px';
  wrapper.innerHTML = `
    <span class="mb-1 rounded-full border border-[#d8d0c0] bg-[#fffefb]/95 px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.12em] text-[#154b39] shadow-[0_6px_16px_rgba(23,36,32,0.12)]">СТАРТ</span>
    <span class="grid size-9 place-items-center rounded-full border-[3px] border-[#fffaf0] bg-[#c9aa65] text-[#154b39] shadow-[0_8px_22px_rgba(23,36,32,0.22)]">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3L20 21L12 17L4 21L12 3Z" fill="currentColor"/>
      </svg>
    </span>
  `;

  return wrapper;
};

const createStartFlagElement = () => {
  const wrapper = document.createElement('div');

  wrapper.className = 'pointer-events-none';
  wrapper.style.width = '34px';
  wrapper.style.height = '42px';
  wrapper.style.transform = 'translateY(1px)';
  wrapper.innerHTML = `
    <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17 40C17 40 29 25.47 29 13.4C29 6.55 23.63 1 17 1C10.37 1 5 6.55 5 13.4C5 25.47 17 40 17 40Z" fill="#154b39" stroke="#fffaf0" stroke-width="2"/>
      <path d="M14 9.5H22.4L20.9 12.25L22.4 15H14V9.5Z" fill="#fffaf0"/>
      <path d="M12.2 8.2V20.5" stroke="#fffaf0" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  return wrapper;
};

export const Map = ({
  className,
  mapMode = 'modern',
  destination,
  places = [],
  historicalPlaces = [],
  historicalPlacesRequestId = null,
  selectedHistoricalPlaceId = null,
  routePlaces = [],
  route,
  routeDirty = false,
  selectedPlace,
  userLocation,
  isPickingStartPoint = false,
  followUserLocation = false,
  onUserMapInteraction,
  onLocationChange,
  onMapClick,
  onPlaceSelect,
  onHistoricalPlaceSelect,
  onHistoricalViewportChange,
}: MapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const startPreviewMarkerRef = useRef<maplibregl.Marker | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const placeMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map<string, maplibregl.Marker>(),
  );
  const photoMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map<string, maplibregl.Marker>(),
  );
  const routeMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map<string, maplibregl.Marker>(),
  );
  const semanticMarkersUpdateTimeoutRef = useRef<number | null>(null);
  const destinationRef = useRef<MapProps['destination']>(destination);
  const placesRef = useRef<Place[]>(places);
  const routePlacesRef = useRef<RouteMapPlace[]>(routePlaces);
  const isPickingStartPointRef = useRef(isPickingStartPoint);
  const onLocationChangeRef = useRef<MapProps['onLocationChange']>(onLocationChange);
  const onMapClickRef = useRef<MapProps['onMapClick']>(onMapClick);
  const onPlaceSelectRef = useRef<MapProps['onPlaceSelect']>(onPlaceSelect);
  const onHistoricalPlaceSelectRef =
    useRef<MapProps['onHistoricalPlaceSelect']>(onHistoricalPlaceSelect);
  const onHistoricalViewportChangeRef = useRef<MapProps['onHistoricalViewportChange']>(
    onHistoricalViewportChange,
  );
  const onUserMapInteractionRef = useRef<MapProps['onUserMapInteraction']>(onUserMapInteraction);
  const historicalLayerHandlersBoundRef = useRef(false);

  useEffect(() => {
    placesRef.current = mapMode === 'historical' ? [] : places;
  }, [mapMode, places]);

  useEffect(() => {
    routePlacesRef.current = mapMode === 'historical' ? [] : routePlaces;
  }, [mapMode, routePlaces]);

  useEffect(() => {
    isPickingStartPointRef.current = isPickingStartPoint;

    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    map.getCanvas().style.cursor = isPickingStartPoint ? START_PICKING_CURSOR : '';

    if (!isPickingStartPoint) {
      startPreviewMarkerRef.current?.remove();
      startPreviewMarkerRef.current = null;
    }
  }, [isPickingStartPoint, mapReady]);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    onHistoricalPlaceSelectRef.current = onHistoricalPlaceSelect;
  }, [onHistoricalPlaceSelect]);

  useEffect(() => {
    onHistoricalViewportChangeRef.current = onHistoricalViewportChange;
  }, [onHistoricalViewportChange]);

  useEffect(() => {
    onUserMapInteractionRef.current = onUserMapInteraction;
  }, [onUserMapInteraction]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const updateRasterStyle = () => {
      if (!map.getLayer('osm')) {
        return;
      }

      if (!map.getSource(HISTORICAL_PARCHMENT_SOURCE_ID)) {
        map.addSource(HISTORICAL_PARCHMENT_SOURCE_ID, {
          type: 'geojson',
          data: HISTORICAL_PARCHMENT_OVERLAY,
        });
      }

      if (!map.getLayer(HISTORICAL_PARCHMENT_LAYER_ID)) {
        const beforeLayerId = [
          PLACES_CLUSTERS_LAYER_ID,
          HISTORICAL_CLUSTERS_LAYER_ID,
          ROUTE_LAYER_ID,
        ].find((layerId) => map.getLayer(layerId));

        map.addLayer(
          {
            id: HISTORICAL_PARCHMENT_LAYER_ID,
            type: 'fill',
            source: HISTORICAL_PARCHMENT_SOURCE_ID,
            paint: {
              'fill-color': '#b77a2b',
              'fill-opacity': 0,
            },
          },
          beforeLayerId,
        );
      }

      const isHistorical = mapMode === 'historical';

      map.setPaintProperty('osm', 'raster-hue-rotate', isHistorical ? -28 : 0);
      map.setPaintProperty('osm', 'raster-saturation', isHistorical ? -0.12 : 0);
      map.setPaintProperty('osm', 'raster-contrast', isHistorical ? -0.12 : 0);
      map.setPaintProperty('osm', 'raster-brightness-min', isHistorical ? 0.16 : 0);
      map.setPaintProperty('osm', 'raster-brightness-max', 1);
      map.setPaintProperty(HISTORICAL_PARCHMENT_LAYER_ID, 'fill-opacity', isHistorical ? 0.2 : 0);
      historyDebug('MAP MODE APPLIED', {
        mode: mapMode,
        historicalStateCount: historicalPlaces.length,
        appliedRequestId: historicalPlacesRequestId,
        sourceExists: Boolean(map.getSource(HISTORICAL_SOURCE_ID)),
        layers: {
          clusters: getLayerDebugState(map, HISTORICAL_CLUSTERS_LAYER_ID),
          clusterCount: getLayerDebugState(map, HISTORICAL_CLUSTER_COUNT_LAYER_ID),
          unclustered: getLayerDebugState(map, HISTORICAL_UNCLUSTERED_LAYER_ID),
          glyphs: getLayerDebugState(map, HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID),
        },
      });
    };

    const handleStyleLoad = () => {
      updateRasterStyle();
    };

    if (map.isStyleLoaded()) {
      updateRasterStyle();
    } else {
      map.once('style.load', handleStyleLoad);
    }

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [historicalPlaces.length, historicalPlacesRequestId, mapMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady || mapMode !== 'historical') {
      return;
    }

    const notifyHistoricalViewport = () => {
      onHistoricalViewportChangeRef.current?.(getHistoricalViewport(map));
    };

    notifyHistoricalViewport();

    map.on('moveend', notifyHistoricalViewport);
    map.on('zoomend', notifyHistoricalViewport);

    return () => {
      map.off('moveend', notifyHistoricalViewport);
      map.off('zoomend', notifyHistoricalViewport);
    };
  }, [mapMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const visibleHistoricalPlaces = mapMode === 'historical' ? historicalPlaces : [];
    const validHistoricalPlacesCount = visibleHistoricalPlaces.filter(
      isValidHistoricalCoordinate,
    ).length;
    const historicalGeoJson = createHistoricalPlacesFeatureCollection(visibleHistoricalPlaces);
    const debugRequestId = historicalPlacesRequestId;

    historyRenderDebug('API places', {
      requestId: debugRequestId,
      mode: mapMode,
      count: historicalPlaces.length,
    });
    historyRenderDebug('Valid coordinates', {
      requestId: debugRequestId,
      valid: validHistoricalPlacesCount,
      invalid: visibleHistoricalPlaces.length - validHistoricalPlacesCount,
      sample: historicalGeoJson.features.slice(0, 3).map((feature) => ({
        id: feature.properties.id,
        coordinates: feature.geometry.coordinates,
      })),
    });
    historyDebug(`GEOJSON #${debugRequestId ?? 'none'}`, {
      requestId: debugRequestId,
      mode: mapMode,
      inputCount: historicalPlaces.length,
      featureCount: historicalGeoJson.features.length,
    });
    historyRenderDebug('GeoJSON features', {
      requestId: debugRequestId,
      features: historicalGeoJson.features.length,
    });

    const updateSelectedHistoricalPlacePaint = () => {
      if (!map.getLayer(HISTORICAL_UNCLUSTERED_LAYER_ID)) {
        return;
      }

      const selectedPlaceId = selectedHistoricalPlaceId ?? '';

      map.setPaintProperty(HISTORICAL_UNCLUSTERED_LAYER_ID, 'circle-radius', [
        'case',
        ['==', ['get', 'id'], selectedPlaceId],
        17,
        14,
      ]);
      map.setPaintProperty(HISTORICAL_UNCLUSTERED_LAYER_ID, 'circle-stroke-width', [
        'case',
        ['==', ['get', 'id'], selectedPlaceId],
        3,
        0,
      ]);
      map.setPaintProperty(HISTORICAL_UNCLUSTERED_LAYER_ID, 'circle-stroke-color', [
        'case',
        ['==', ['get', 'id'], selectedPlaceId],
        '#ffffff',
        '#70491f',
      ]);
      map.setLayoutProperty(HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID, 'icon-size', [
        'case',
        ['==', ['get', 'id'], selectedPlaceId],
        1.12,
        1,
      ]);
    };

    const bindHistoricalLayerHandlers = () => {
      if (historicalLayerHandlersBoundRef.current) {
        return;
      }

      historicalLayerHandlersBoundRef.current = true;
      map.on('click', HISTORICAL_CLUSTERS_LAYER_ID, (event) => {
        const feature = getFirstFeature(event);
        const coordinates = getPointCoordinates(feature);
        const clusterId = getFeatureProperty(feature, 'cluster_id');
        const historicalSource = map.getSource(HISTORICAL_SOURCE_ID);

        if (!coordinates || typeof clusterId !== 'number' || !isGeoJsonSource(historicalSource)) {
          return;
        }

        void historicalSource.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({ center: coordinates, zoom });
        });
      });

      const handleHistoricalPlaceClick = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = getFirstFeature(event);
        const placeId = getFeatureProperty(feature, 'id');

        if (typeof placeId === 'string') {
          onHistoricalPlaceSelectRef.current?.(placeId);
        }
      };

      map.on('click', HISTORICAL_UNCLUSTERED_LAYER_ID, handleHistoricalPlaceClick);
      map.on('click', HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID, handleHistoricalPlaceClick);

      const setPointerCursor = () => {
        map.getCanvas().style.cursor = 'pointer';
      };
      const resetCursor = () => {
        map.getCanvas().style.cursor = isPickingStartPointRef.current ? START_PICKING_CURSOR : '';
      };

      map.on('mouseenter', HISTORICAL_CLUSTERS_LAYER_ID, setPointerCursor);
      map.on('mouseleave', HISTORICAL_CLUSTERS_LAYER_ID, resetCursor);
      map.on('mouseenter', HISTORICAL_UNCLUSTERED_LAYER_ID, setPointerCursor);
      map.on('mouseleave', HISTORICAL_UNCLUSTERED_LAYER_ID, resetCursor);
      map.on('mouseenter', HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID, setPointerCursor);
      map.on('mouseleave', HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID, resetCursor);
    };

    const ensureHistoricalLayers = () => {
      addHistoricalMarkerImage(map);

      if (!map.getLayer(HISTORICAL_CLUSTERS_LAYER_ID)) {
        map.addLayer({
          id: HISTORICAL_CLUSTERS_LAYER_ID,
          type: 'circle',
          source: HISTORICAL_SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#154b39',
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#f6df9f',
            'circle-opacity': 0.95,
          },
        });
      }

      if (!map.getLayer(HISTORICAL_CLUSTER_COUNT_LAYER_ID)) {
        map.addLayer({
          id: HISTORICAL_CLUSTER_COUNT_LAYER_ID,
          type: 'symbol',
          source: HISTORICAL_SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#fffaf0',
          },
        });
      }

      if (!map.getLayer(HISTORICAL_UNCLUSTERED_LAYER_ID)) {
        map.addLayer({
          id: HISTORICAL_UNCLUSTERED_LAYER_ID,
          type: 'circle',
          source: HISTORICAL_SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#154b39',
            'circle-radius': [
              'case',
              ['==', ['get', 'id'], selectedHistoricalPlaceId ?? ''],
              17,
              14,
            ],
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'id'], selectedHistoricalPlaceId ?? ''],
              3,
              0,
            ],
            'circle-stroke-color': [
              'case',
              ['==', ['get', 'id'], selectedHistoricalPlaceId ?? ''],
              '#fffaf0',
              '#f6df9f',
            ],
            'circle-opacity': 0.45,
          },
        });
      }

      if (!map.getLayer(HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID)) {
        map.addLayer({
          id: HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID,
          type: 'symbol',
          source: HISTORICAL_SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': HISTORICAL_MARKER_IMAGE_ID,
            'icon-size': ['case', ['==', ['get', 'id'], selectedHistoricalPlaceId ?? ''], 1.12, 1],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });
      }

      bindHistoricalLayerHandlers();
    };

    const updateHistoricalSource = () => {
      const source = map.getSource(HISTORICAL_SOURCE_ID);

      historyRenderDebug('Source exists', {
        requestId: debugRequestId,
        sourceId: HISTORICAL_SOURCE_ID,
        exists: Boolean(source),
      });

      if (source) {
        historyDebug(`MAP UPDATE #${debugRequestId ?? 'none'}`, {
          sourceId: HISTORICAL_SOURCE_ID,
          action: 'setData',
          featureCount: historicalGeoJson.features.length,
          requestId: debugRequestId,
          sourceExists: true,
          layers: {
            clusters: getLayerDebugState(map, HISTORICAL_CLUSTERS_LAYER_ID),
            clusterCount: getLayerDebugState(map, HISTORICAL_CLUSTER_COUNT_LAYER_ID),
            unclustered: getLayerDebugState(map, HISTORICAL_UNCLUSTERED_LAYER_ID),
            glyphs: getLayerDebugState(map, HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID),
          },
        });
        void (source as maplibregl.GeoJSONSource).setData(historicalGeoJson);
      } else {
        historyDebug(`MAP UPDATE #${debugRequestId ?? 'none'}`, {
          sourceId: HISTORICAL_SOURCE_ID,
          action: 'addSource',
          featureCount: historicalGeoJson.features.length,
          requestId: debugRequestId,
          sourceExists: false,
        });
        map.addSource(HISTORICAL_SOURCE_ID, {
          type: 'geojson',
          data: historicalGeoJson,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 52,
        });
      }

      ensureHistoricalLayers();
      updateSelectedHistoricalPlacePaint();

      const layerStates = {
        clusters: getLayerDebugState(map, HISTORICAL_CLUSTERS_LAYER_ID),
        clusterCount: getLayerDebugState(map, HISTORICAL_CLUSTER_COUNT_LAYER_ID),
        unclustered: getLayerDebugState(map, HISTORICAL_UNCLUSTERED_LAYER_ID),
        glyphs: getLayerDebugState(map, HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID),
      };

      historyRenderDebug('Layers exist', {
        requestId: debugRequestId,
        layers: layerStates,
      });
      historyRenderDebug('Layers visibility', {
        requestId: debugRequestId,
        visibility: layerStates,
      });
      historyRenderDebug('Source updated', {
        requestId: debugRequestId,
        sourceId: HISTORICAL_SOURCE_ID,
        features: historicalGeoJson.features.length,
      });
      mapDataDebug('SOURCE UPDATED historical places', {
        sourceId: HISTORICAL_SOURCE_ID,
        action: source ? 'setData' : 'addSource',
        features: historicalGeoJson.features.length,
        requestId: debugRequestId,
      });
      historyRenderTable(
        'Historical layers',
        [
          HISTORICAL_CLUSTERS_LAYER_ID,
          HISTORICAL_CLUSTER_COUNT_LAYER_ID,
          HISTORICAL_UNCLUSTERED_LAYER_ID,
          HISTORICAL_UNCLUSTERED_GLYPH_LAYER_ID,
        ].map((layerId) => ({
          id: layerId,
          exists: Boolean(map.getLayer(layerId)),
          visibility: map.getLayer(layerId)
            ? (map.getLayoutProperty(layerId, 'visibility') ?? 'visible')
            : null,
          filter: map.getLayer(layerId) ? JSON.stringify(map.getFilter(layerId) ?? null) : null,
        })),
      );
    };

    const handleStyleLoad = () => {
      updateHistoricalSource();
    };

    map.on('style.load', handleStyleLoad);

    if (map.isStyleLoaded()) {
      updateHistoricalSource();
    }

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [historicalPlaces, historicalPlacesRequestId, mapMode, selectedHistoricalPlaceId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const visiblePlaces = mapMode === 'historical' ? [] : places;
    const placesGeoJson = createPlacesFeatureCollection(visiblePlaces);

    const updateSelectedPlacePaint = () => {
      if (!map.getLayer(PLACES_UNCLUSTERED_LAYER_ID)) {
        return;
      }

      const selectedPlaceId = selectedPlace?.id ?? '';

      map.setPaintProperty(PLACES_UNCLUSTERED_LAYER_ID, 'circle-radius', [
        'case',
        ['==', ['get', 'id'], selectedPlaceId],
        15,
        12,
      ]);

      map.setPaintProperty(PLACES_UNCLUSTERED_LAYER_ID, 'circle-stroke-width', [
        'case',
        ['==', ['get', 'id'], selectedPlaceId],
        4,
        2,
      ]);
    };

    const updatePlacesSource = () => {
      const source = map.getSource(PLACES_SOURCE_ID);

      if (source) {
        mapDataDebug('SOURCE UPDATED modern places', {
          sourceId: PLACES_SOURCE_ID,
          action: 'setData',
          mode: mapMode,
          inputCount: places.length,
          visibleCount: visiblePlaces.length,
          features: placesGeoJson.features.length,
        });
        void (source as maplibregl.GeoJSONSource).setData(placesGeoJson);
        updateSelectedPlacePaint();
        return;
      }

      mapDataDebug('SOURCE UPDATED modern places', {
        sourceId: PLACES_SOURCE_ID,
        action: 'addSource',
        mode: mapMode,
        inputCount: places.length,
        visibleCount: visiblePlaces.length,
        features: placesGeoJson.features.length,
      });
      map.addSource(PLACES_SOURCE_ID, {
        type: 'geojson',
        data: placesGeoJson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: PLACES_CLUSTERS_LAYER_ID,
        type: 'circle',
        source: PLACES_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#176B4D',
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#F8F3E8',
          'circle-opacity': 0.96,
        },
      });

      map.addLayer({
        id: PLACES_CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: PLACES_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#F8F3E8',
        },
      });

      map.addLayer({
        id: PLACES_UNCLUSTERED_LAYER_ID,
        type: 'circle',
        source: PLACES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'category'],
            'historic',
            '#8F2F3F',
            'attraction',
            '#8F2F3F',
            'museum',
            '#315F72',
            'gallery',
            '#315F72',
            'arts_centre',
            '#315F72',
            'artwork',
            '#315F72',
            'cafe',
            '#B45309',
            'restaurant',
            '#B45309',
            'park',
            '#3F7D41',
            'garden',
            '#3F7D41',
            'place_of_worship',
            '#9A6A16',
            'theatre',
            '#695184',
            'viewpoint',
            '#176B4D',
            '#176B4D',
          ],
          'circle-radius': ['case', ['==', ['get', 'id'], selectedPlace?.id ?? ''], 15, 12],
          'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedPlace?.id ?? ''], 4, 2],
          'circle-stroke-color': '#F8F3E8',
          'circle-opacity': 0,
          'circle-stroke-opacity': 0,
        },
      });

      map.addLayer({
        id: PLACES_UNCLUSTERED_LABEL_LAYER_ID,
        type: 'symbol',
        source: PLACES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'markerLabel'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 10,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-opacity': 0,
        },
      });

      map.on('click', PLACES_CLUSTERS_LAYER_ID, (event) => {
        if (isPickingStartPointRef.current) {
          return;
        }

        const feature = getFirstFeature(event);
        const coordinates = getPointCoordinates(feature);
        const clusterId = getFeatureProperty(feature, 'cluster_id');

        if (!coordinates || typeof clusterId !== 'number') {
          return;
        }

        const source = map.getSource(PLACES_SOURCE_ID);

        if (!isGeoJsonSource(source)) {
          return;
        }

        void source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            map.easeTo({
              center: coordinates,
              zoom,
            });
          })
          .catch((error: unknown) => {
            console.error('[MapLibre] cluster expansion failed', error);
          });
      });

      map.on('click', PLACES_UNCLUSTERED_LAYER_ID, (event) => {
        if (isPickingStartPointRef.current) {
          return;
        }

        const feature = getFirstFeature(event);
        const placeId = getFeatureProperty(feature, 'id');

        if (typeof placeId !== 'string') {
          return;
        }

        const place = getPlaceById(placesRef.current, placeId);

        if (place) {
          onPlaceSelectRef.current?.(place);
        }
      });

      const setPointerCursor = () => {
        if (isPickingStartPointRef.current) {
          return;
        }

        map.getCanvas().style.cursor = 'pointer';
      };

      const resetCursor = () => {
        map.getCanvas().style.cursor = isPickingStartPointRef.current ? START_PICKING_CURSOR : '';
      };

      map.on('mouseenter', PLACES_CLUSTERS_LAYER_ID, setPointerCursor);
      map.on('mouseleave', PLACES_CLUSTERS_LAYER_ID, resetCursor);
      map.on('mouseenter', PLACES_UNCLUSTERED_LAYER_ID, setPointerCursor);
      map.on('mouseleave', PLACES_UNCLUSTERED_LAYER_ID, resetCursor);
    };

    const handleStyleLoad = () => {
      updatePlacesSource();
    };

    if (map.isStyleLoaded()) {
      updatePlacesSource();
    } else {
      map.once('style.load', handleStyleLoad);
    }

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [mapMode, places, selectedPlace, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const visibleRoutePlaces = mapMode === 'historical' ? [] : routePlaces;
    const routePlacesGeoJson = createRoutePlacesFeatureCollection(visibleRoutePlaces);

    const updateRoutePlacesSource = () => {
      const source = map.getSource(ROUTE_PLACES_SOURCE_ID);

      if (source) {
        void (source as maplibregl.GeoJSONSource).setData(routePlacesGeoJson);
        return;
      }

      map.addSource(ROUTE_PLACES_SOURCE_ID, {
        type: 'geojson',
        data: routePlacesGeoJson,
      });

      map.addLayer({
        id: ROUTE_PLACES_CIRCLE_LAYER_ID,
        type: 'circle',
        source: ROUTE_PLACES_SOURCE_ID,
        paint: {
          'circle-color': '#176B4D',
          'circle-radius': 15,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#F8F3E8',
          'circle-opacity': 0,
          'circle-stroke-opacity': 0,
        },
      });

      map.addLayer({
        id: ROUTE_PLACES_LABEL_LAYER_ID,
        type: 'symbol',
        source: ROUTE_PLACES_SOURCE_ID,
        layout: {
          'text-field': ['to-string', ['get', 'order']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-opacity': 0,
        },
      });

      const handleRoutePlaceClick = (event: maplibregl.MapLayerMouseEvent) => {
        if (isPickingStartPointRef.current) {
          return;
        }

        const feature = getFirstFeature(event);
        const placeId = getFeatureProperty(feature, 'id');

        if (typeof placeId !== 'string') {
          return;
        }

        const place = getPlaceById(routePlacesRef.current, placeId);

        if (place) {
          onPlaceSelectRef.current?.(place);
        }
      };

      const setPointerCursor = () => {
        if (isPickingStartPointRef.current) {
          return;
        }

        map.getCanvas().style.cursor = 'pointer';
      };

      const resetCursor = () => {
        map.getCanvas().style.cursor = isPickingStartPointRef.current ? START_PICKING_CURSOR : '';
      };

      map.on('click', ROUTE_PLACES_CIRCLE_LAYER_ID, handleRoutePlaceClick);
      map.on('click', ROUTE_PLACES_LABEL_LAYER_ID, handleRoutePlaceClick);
      map.on('mouseenter', ROUTE_PLACES_CIRCLE_LAYER_ID, setPointerCursor);
      map.on('mouseleave', ROUTE_PLACES_CIRCLE_LAYER_ID, resetCursor);
      map.on('mouseenter', ROUTE_PLACES_LABEL_LAYER_ID, setPointerCursor);
      map.on('mouseleave', ROUTE_PLACES_LABEL_LAYER_ID, resetCursor);
    };

    const handleStyleLoad = () => {
      updateRoutePlacesSource();
    };

    if (map.isStyleLoaded()) {
      updateRoutePlacesSource();
    } else {
      map.once('style.load', handleStyleLoad);
    }

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [mapMode, routePlaces, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const placeMarkers = placeMarkersRef.current;
    const photoMarkers = photoMarkersRef.current;
    const routeMarkers = routeMarkersRef.current;

    const clearMarkerMap = (markers: globalThis.Map<string, maplibregl.Marker>) => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
    };

    const addMarkerClick = (element: HTMLElement, place: Place) => {
      element.addEventListener('click', (event) => {
        event.stopPropagation();

        if (isPickingStartPointRef.current) {
          return;
        }

        onPlaceSelectRef.current?.(place);
      });
    };

    const updateMarkerMap = (
      markers: globalThis.Map<string, maplibregl.Marker>,
      desiredMarkers: Array<{
        id: string;
        place: Place;
        element: HTMLElement;
        longitude: number;
        latitude: number;
        zIndex: string;
        offset?: [number, number];
        anchor?: MarkerAnchor;
      }>,
    ) => {
      const desiredIds = new Set(desiredMarkers.map((marker) => marker.id));

      markers.forEach((marker, id) => {
        if (!desiredIds.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      });

      desiredMarkers.forEach(
        ({ id, place, element, longitude, latitude, zIndex, offset, anchor }) => {
          const existing = markers.get(id);

          if (existing) {
            existing.setLngLat([longitude, latitude]);
            if (offset) {
              existing.setOffset(offset);
            }
            existing.getElement().style.zIndex = zIndex;
            return;
          }

          addMarkerClick(element, place);
          element.style.zIndex = zIndex;

          markers.set(
            id,
            new maplibregl.Marker({
              element,
              anchor: anchor ?? 'bottom',
              offset: offset ?? [0, 0],
            })
              .setLngLat([longitude, latitude])
              .addTo(map),
          );
        },
      );
    };

    const visiblePlacesSource = mapMode === 'historical' ? [] : places;
    const visibleRoutePlacesSource = mapMode === 'historical' ? [] : routePlaces;

    const selectPhotoPlaces = (visiblePlaces: Place[]) => {
      if (map.getZoom() >= CLOSE_MARKERS_ZOOM || visibleRoutePlacesSource.length > 0) {
        return [];
      }

      const selectedRects: Array<ReturnType<typeof getPhotoMarkerRect>> = [];
      const sorted = visiblePlaces
        .filter((place) => getPlaceImageUrl(place))
        .sort((first, second) => getPlacePriority(first) - getPlacePriority(second));
      const selected: Place[] = [];

      sorted.forEach((place) => {
        if (selected.length >= MAX_PHOTO_MARKERS) {
          return;
        }

        const rect = getPhotoMarkerRect(map, place);

        if (selectedRects.some((selectedRect) => doesRectOverlap(rect, selectedRect))) {
          return;
        }

        selectedRects.push(rect);
        selected.push(place);
      });

      return selected;
    };

    const selectRoutePhotoPlaces = () => {
      if (map.getZoom() < ROUTE_MARKERS_MIN_ZOOM) {
        return new Set<string>();
      }

      return new Set(
        visibleRoutePlacesSource
          .filter((place) => getPlaceImageUrl(place))
          .map((place) => place.id),
      );
    };

    const updateSemanticMarkers = () => {
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      const routePlaceIds = new Set(visibleRoutePlacesSource.map((place) => place.id));
      const showOrdinaryMarkers = zoom >= MARKERS_MIN_ZOOM;
      const visiblePlaces = showOrdinaryMarkers
        ? visiblePlacesSource.filter(
            (place) => !routePlaceIds.has(place.id) && isPlaceInBounds(place, bounds),
          )
        : [];
      const photoPlaces = selectPhotoPlaces(visiblePlaces);
      const photoPlaceIds = new Set(photoPlaces.map((place) => place.id));
      const routePhotoPlaceIds = selectRoutePhotoPlaces();
      updateMarkerMap(
        placeMarkersRef.current,
        visiblePlaces
          .filter((place) => !photoPlaceIds.has(place.id))
          .map((place) => ({
            id: place.id,
            place,
            element: createCategoryMarkerElement(place),
            longitude: place.longitude,
            latitude: place.latitude,
            zIndex: '20',
          })),
      );

      updateMarkerMap(
        photoMarkersRef.current,
        photoPlaces.map((place) => ({
          id: place.id,
          place,
          element: createPhotoMarkerElement(place),
          longitude: place.longitude,
          latitude: place.latitude,
          zIndex: '30',
        })),
      );

      updateMarkerMap(
        routeMarkersRef.current,
        zoom >= ROUTE_MARKERS_MIN_ZOOM
          ? visibleRoutePlacesSource.map((place) => ({
              id: place.id,
              place,
              element: createRouteMarkerElement(place, routePhotoPlaceIds.has(place.id)),
              longitude: place.longitude,
              latitude: place.latitude,
              zIndex: '34',
              anchor: 'center',
            }))
          : [],
      );

      if (userLocation && visibleRoutePlacesSource.length > 0 && zoom >= ROUTE_MARKERS_MIN_ZOOM) {
        if (!startMarkerRef.current) {
          const element = createStartMarkerElement();

          element.style.zIndex = '36';
          startMarkerRef.current = new maplibregl.Marker({
            element,
            anchor: 'bottom',
            offset: [0, 0],
          })
            .setLngLat([userLocation.longitude, userLocation.latitude])
            .addTo(map);
        } else {
          startMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
        }
      } else {
        startMarkerRef.current?.remove();
        startMarkerRef.current = null;
      }
    };

    const scheduleSemanticMarkersUpdate = () => {
      if (semanticMarkersUpdateTimeoutRef.current !== null) {
        window.clearTimeout(semanticMarkersUpdateTimeoutRef.current);
      }

      semanticMarkersUpdateTimeoutRef.current = window.setTimeout(() => {
        semanticMarkersUpdateTimeoutRef.current = null;
        updateSemanticMarkers();
      }, 120);
    };

    updateSemanticMarkers();
    map.on('moveend', scheduleSemanticMarkersUpdate);
    map.on('zoomend', scheduleSemanticMarkersUpdate);

    return () => {
      map.off('moveend', scheduleSemanticMarkersUpdate);
      map.off('zoomend', scheduleSemanticMarkersUpdate);

      if (semanticMarkersUpdateTimeoutRef.current !== null) {
        window.clearTimeout(semanticMarkersUpdateTimeoutRef.current);
        semanticMarkersUpdateTimeoutRef.current = null;
      }

      clearMarkerMap(placeMarkers);
      clearMarkerMap(photoMarkers);
      clearMarkerMap(routeMarkers);
      startMarkerRef.current?.remove();
      startMarkerRef.current = null;
    };
  }, [mapMode, places, routePlaces, userLocation, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const updateDestination = () => {
      if (!destination) {
        destinationMarkerRef.current?.remove();
        destinationMarkerRef.current = null;
        return;
      }

      const lngLat: maplibregl.LngLatLike = [destination.longitude, destination.latitude];

      if (!destinationMarkerRef.current) {
        const element = createStartMarkerElement();

        element.style.zIndex = '36';
        destinationMarkerRef.current = new maplibregl.Marker({
          element,
          anchor: 'bottom',
          offset: [0, 0],
        })
          .setLngLat(lngLat)
          .addTo(map);
        return;
      }

      destinationMarkerRef.current.setLngLat(lngLat);
    };

    const handleStyleLoad = () => {
      updateDestination();
    };

    if (map.isStyleLoaded()) {
      updateDestination();
    } else {
      map.once('style.load', handleStyleLoad);
    }

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [destination, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const isRouteVisible = mapMode !== 'historical';
    const hasValidRoute = Boolean(route && route.coordinates.length >= 2);

    if (!route || !hasValidRoute) {
      routeDebug('Route layer cleared', {
        mapMode,
        hasRoute: Boolean(route),
        coordinates: route?.coordinates.length ?? 0,
        routeDirty,
      });
      if (map.getLayer(ROUTE_LAYER_ID)) {
        map.removeLayer(ROUTE_LAYER_ID);
      }

      if (map.getSource(ROUTE_SOURCE_ID)) {
        map.removeSource(ROUTE_SOURCE_ID);
      }

      return;
    }

    const routeFeature: GeoJsonFeature<GeoJsonLineString> = {
      type: 'Feature',
      properties: {},
      geometry: route,
    };

    const updateRoute = () => {
      const source = map.getSource(ROUTE_SOURCE_ID);

      if (source) {
        void (source as maplibregl.GeoJSONSource).setData(routeFeature);
        routeDebug('MapLibre source updated', {
          sourceId: ROUTE_SOURCE_ID,
          coordinates: route.coordinates.length,
        });
      } else {
        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: routeFeature,
        });
        routeDebug('MapLibre source added', {
          sourceId: ROUTE_SOURCE_ID,
          coordinates: route.coordinates.length,
        });
      }

      if (!map.getLayer(ROUTE_LAYER_ID)) {
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#176B4D',
            'line-width': 6,
            'line-opacity': routeDirty ? 0.35 : 0.95,
          },
        });
        routeDebug('MapLibre layer added', {
          layerId: ROUTE_LAYER_ID,
        });
      }

      map.setPaintProperty(ROUTE_LAYER_ID, 'line-opacity', routeDirty ? 0.35 : 0.95);
      map.setLayoutProperty(ROUTE_LAYER_ID, 'visibility', isRouteVisible ? 'visible' : 'none');
      routeDebug('Route layer visible', {
        layerId: ROUTE_LAYER_ID,
        opacity: routeDirty ? 0.35 : 0.95,
        mapMode,
        visibility: map.getLayoutProperty(ROUTE_LAYER_ID, 'visibility') ?? 'visible',
      });

      if (!isRouteVisible) {
        return;
      }

      const bounds = new maplibregl.LngLatBounds();

      route.coordinates.forEach(([longitude, latitude]) => {
        bounds.extend([longitude, latitude]);
      });

      map.fitBounds(bounds, {
        padding: window.innerWidth < 640 ? 48 : 80,
        duration: 800,
      });
    };

    const handleStyleLoad = () => {
      updateRoute();
    };

    if (map.isStyleLoaded()) {
      updateRoute();
    } else {
      map.once('style.load', handleStyleLoad);
    }

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [mapMode, route, routeDirty, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady || !userLocation) {
      return;
    }

    const accuracyFeature: GeoJsonFeature<{
      type: 'Point';
      coordinates: [number, number];
    }> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [userLocation.longitude, userLocation.latitude],
      },
    };

    const updateUserLocation = () => {
      const source = map.getSource(USER_LOCATION_SOURCE_ID);

      if (source) {
        void (source as maplibregl.GeoJSONSource).setData(accuracyFeature);
      } else {
        map.addSource(USER_LOCATION_SOURCE_ID, {
          type: 'geojson',
          data: accuracyFeature,
        });

        map.addLayer({
          id: USER_ACCURACY_LAYER_ID,
          type: 'circle',
          source: USER_LOCATION_SOURCE_ID,
          paint: {
            'circle-radius': Math.max(16, Math.min(userLocation.accuracy, 80)),
            'circle-color': '#176B4D',
            'circle-opacity': 0.14,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#176B4D',
            'circle-stroke-opacity': 0.22,
          },
        });

        map.addLayer({
          id: USER_LOCATION_LAYER_ID,
          type: 'circle',
          source: USER_LOCATION_SOURCE_ID,
          paint: {
            'circle-radius': 8,
            'circle-color': '#2563EB',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#FFFFFF',
          },
        });
      }

      if (map.getLayer(USER_ACCURACY_LAYER_ID)) {
        map.setPaintProperty(
          USER_ACCURACY_LAYER_ID,
          'circle-radius',
          Math.max(16, Math.min(userLocation.accuracy, 80)),
        );
      }

      if (followUserLocation) {
        map.easeTo({
          center: [userLocation.longitude, userLocation.latitude],
          zoom: 17,
          bearing: userLocation.heading ?? map.getBearing(),
          duration: 600,
        });
      }
    };

    const handleStyleLoad = () => {
      updateUserLocation();
    };

    if (map.isStyleLoaded()) {
      updateUserLocation();
    } else {
      map.once('style.load', handleStyleLoad);
    }

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [followUserLocation, userLocation, mapReady]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_RASTER_STYLE,
      center: KAZAN_CENTER,
      zoom: KAZAN_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const geolocateControlOptions: GeolocateControlOptionsWithHeading = {
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
      showUserHeading: true,
    };

    const geolocateControl = new maplibregl.GeolocateControl(geolocateControlOptions);

    map.addControl(geolocateControl, 'top-right');
    mapRef.current = map;

    if (destinationRef.current) {
      const element = createStartMarkerElement();

      element.style.zIndex = '36';
      destinationMarkerRef.current = new maplibregl.Marker({
        element,
        anchor: 'bottom',
        offset: [0, 0],
      })
        .setLngLat([destinationRef.current.longitude, destinationRef.current.latitude])
        .addTo(map);
    }

    const handleInitialLoad = () => {
      if (disposed || mapRef.current !== map) {
        return;
      }

      console.log('[MapLibre] map loaded');
      setMapReady(true);
    };

    map.once('load', handleInitialLoad);

    map.on('error', (event: maplibregl.ErrorEvent) => {
      console.error('[MapLibre] map error', event.error);
    });

    map.on('dragstart', () => {
      onUserMapInteractionRef.current?.();
    });

    const enforceStartPickingCursor = () => {
      if (!isPickingStartPointRef.current) {
        return;
      }

      map.getCanvas().style.cursor = START_PICKING_CURSOR;
    };

    const updateStartPreviewMarker = (event: maplibregl.MapMouseEvent) => {
      if (!isPickingStartPointRef.current) {
        return;
      }

      enforceStartPickingCursor();

      if (!startPreviewMarkerRef.current) {
        startPreviewMarkerRef.current = new maplibregl.Marker({
          element: createStartFlagElement(),
          anchor: 'bottom',
          offset: [0, 0],
        })
          .setLngLat(event.lngLat)
          .addTo(map);
        return;
      }

      startPreviewMarkerRef.current.setLngLat(event.lngLat);
    };

    const hideStartPreviewMarker = () => {
      if (!isPickingStartPointRef.current) {
        return;
      }

      startPreviewMarkerRef.current?.remove();
      startPreviewMarkerRef.current = null;
    };

    map.on('mousemove', updateStartPreviewMarker);
    map.on('mousedown', enforceStartPickingCursor);
    map.on('mouseup', enforceStartPickingCursor);
    map.on('dragstart', enforceStartPickingCursor);
    map.on('dragend', enforceStartPickingCursor);
    map.getCanvasContainer().addEventListener('mouseleave', hideStartPreviewMarker);

    map.on('click', (event) => {
      if (isPickingStartPointRef.current) {
        startPreviewMarkerRef.current?.remove();
        startPreviewMarkerRef.current = null;
      }

      onMapClickRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });

    geolocateControl.on('geolocate', (event: maplibregl.GeolocatePositionEvent) => {
      const location: UserLocation = {
        latitude: event.coords.latitude,
        longitude: event.coords.longitude,
        accuracy: event.coords.accuracy,
        heading: event.coords.heading ?? null,
        speed: event.coords.speed ?? null,
      };

      console.log('[GPS]', location);
      onLocationChangeRef.current?.(location);
    });

    geolocateControl.on('error', (event: maplibregl.GeolocateErrorEvent) => {
      console.error('[GPS]', event);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      map.off('load', handleInitialLoad);
      resizeObserver.disconnect();
      map.getCanvasContainer().removeEventListener('mouseleave', hideStartPreviewMarker);
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      startPreviewMarkerRef.current?.remove();
      startPreviewMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={cn('h-screen w-full', className)} />;
};
