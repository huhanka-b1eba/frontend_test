import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { Place } from '@shared/api/overpass';
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

const KAZAN_CENTER: maplibregl.LngLatLike = [49.1064, 55.7961];
const KAZAN_ZOOM = 13;
const ROUTE_SOURCE_ID = 'route';
const ROUTE_LAYER_ID = 'route-line';
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

type MapProps = {
  className?: string;
  destination?: MapDestination | null;
  places?: Place[];
  routePlaces?: RouteMapPlace[];
  route?: GeoJsonLineString | null;
  routeDirty?: boolean;
  selectedPlace?: Place | null;
  userLocation?: UserLocation | null;
  followUserLocation?: boolean;
  onUserMapInteraction?: () => void;
  onLocationChange?: (location: UserLocation) => void;
  onPlaceSelect?: (place: Place) => void;
};

type GeolocateControlOptionsWithHeading = ConstructorParameters<
  typeof maplibregl.GeolocateControl
>[0] & {
  showUserHeading?: boolean;
};

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

const getFeatureProperty = (feature: maplibregl.MapGeoJSONFeature | null, key: string) => {
  const properties = feature?.properties as unknown;

  if (!isRecord(properties)) {
    return null;
  }

  return properties[key] ?? null;
};

export const Map = ({
  className,
  destination,
  places = [],
  routePlaces = [],
  route,
  routeDirty = false,
  selectedPlace,
  userLocation,
  followUserLocation = false,
  onUserMapInteraction,
  onLocationChange,
  onPlaceSelect,
}: MapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationRef = useRef<MapProps['destination']>(destination);
  const placesRef = useRef<Place[]>(places);
  const routePlacesRef = useRef<RouteMapPlace[]>(routePlaces);
  const onLocationChangeRef = useRef<MapProps['onLocationChange']>(onLocationChange);
  const onPlaceSelectRef = useRef<MapProps['onPlaceSelect']>(onPlaceSelect);
  const onUserMapInteractionRef = useRef<MapProps['onUserMapInteraction']>(onUserMapInteraction);

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  useEffect(() => {
    routePlacesRef.current = routePlaces;
  }, [routePlaces]);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    onUserMapInteractionRef.current = onUserMapInteraction;
  }, [onUserMapInteraction]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const placesGeoJson = createPlacesFeatureCollection(places);

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
        void (source as maplibregl.GeoJSONSource).setData(placesGeoJson);
        updateSelectedPlacePaint();
        return;
      }

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
          'circle-opacity': 0.96,
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
        },
      });

      map.on('click', PLACES_CLUSTERS_LAYER_ID, (event) => {
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
        map.getCanvas().style.cursor = 'pointer';
      };

      const resetCursor = () => {
        map.getCanvas().style.cursor = '';
      };

      map.on('mouseenter', PLACES_CLUSTERS_LAYER_ID, setPointerCursor);
      map.on('mouseleave', PLACES_CLUSTERS_LAYER_ID, resetCursor);
      map.on('mouseenter', PLACES_UNCLUSTERED_LAYER_ID, setPointerCursor);
      map.on('mouseleave', PLACES_UNCLUSTERED_LAYER_ID, resetCursor);
    };

    if (map.loaded()) {
      updatePlacesSource();
      return;
    }

    map.once('load', updatePlacesSource);
  }, [places, selectedPlace]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const routePlacesGeoJson = createRoutePlacesFeatureCollection(routePlaces);

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
          'circle-opacity': 0.98,
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
        },
      });

      const handleRoutePlaceClick = (event: maplibregl.MapLayerMouseEvent) => {
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
        map.getCanvas().style.cursor = 'pointer';
      };

      const resetCursor = () => {
        map.getCanvas().style.cursor = '';
      };

      map.on('click', ROUTE_PLACES_CIRCLE_LAYER_ID, handleRoutePlaceClick);
      map.on('click', ROUTE_PLACES_LABEL_LAYER_ID, handleRoutePlaceClick);
      map.on('mouseenter', ROUTE_PLACES_CIRCLE_LAYER_ID, setPointerCursor);
      map.on('mouseleave', ROUTE_PLACES_CIRCLE_LAYER_ID, resetCursor);
      map.on('mouseenter', ROUTE_PLACES_LABEL_LAYER_ID, setPointerCursor);
      map.on('mouseleave', ROUTE_PLACES_LABEL_LAYER_ID, resetCursor);
    };

    if (map.loaded()) {
      updateRoutePlacesSource();
      return;
    }

    map.once('load', updateRoutePlacesSource);
  }, [routePlaces]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
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
        destinationMarkerRef.current = new maplibregl.Marker().setLngLat(lngLat).addTo(map);
        return;
      }

      destinationMarkerRef.current.setLngLat(lngLat);
    };

    if (map.isStyleLoaded()) {
      updateDestination();
      return;
    }

    map.once('load', updateDestination);
  }, [destination]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!route) {
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
      } else {
        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: routeFeature,
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
      }

      map.setPaintProperty(ROUTE_LAYER_ID, 'line-opacity', routeDirty ? 0.35 : 0.95);

      const bounds = new maplibregl.LngLatBounds();

      route.coordinates.forEach(([longitude, latitude]) => {
        bounds.extend([longitude, latitude]);
      });

      map.fitBounds(bounds, {
        padding: window.innerWidth < 640 ? 48 : 80,
        duration: 800,
      });
    };

    if (map.isStyleLoaded()) {
      updateRoute();
      return;
    }

    map.once('load', updateRoute);
  }, [route, routeDirty]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !userLocation) {
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

    if (map.loaded()) {
      updateUserLocation();
      return;
    }

    map.once('load', updateUserLocation);
  }, [followUserLocation, userLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

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
      destinationMarkerRef.current = new maplibregl.Marker()
        .setLngLat([destinationRef.current.longitude, destinationRef.current.latitude])
        .addTo(map);
    }

    map.on('load', () => {
      console.log('[MapLibre] map loaded');
    });

    map.on('error', (event: maplibregl.ErrorEvent) => {
      console.error('[MapLibre] map error', event.error);
    });

    map.on('dragstart', () => {
      onUserMapInteractionRef.current?.();
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
      resizeObserver.disconnect();
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={cn('h-screen w-full', className)} />;
};
