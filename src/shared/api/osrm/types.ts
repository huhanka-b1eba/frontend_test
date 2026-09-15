import type { GeoJsonLineString } from '@shared/lib/geojson';
import type { RoutableTransportMode } from '@shared/lib/transport';

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteStep = {
  distance: number;
  duration: number;
  name: string;
  maneuver: RouteStepManeuver;
};

export type RouteStepManeuver = {
  type: string;
  modifier?: string;
  location: [longitude: number, latitude: number];
};

export type RouteLeg = {
  distance: number;
  duration: number;
};

export type RouteResult = {
  geometry: GeoJsonLineString;
  distance: number;
  duration: number;
  legs: RouteLeg[];
  steps: RouteStep[];
  mode: RoutableTransportMode;
};

export type RouteMatrix = {
  durations: Array<Array<number | null>>;
  distances: Array<Array<number | null>>;
};

export type OsrmRouteResponse = {
  code: string;
  message?: string;
  routes?: OsrmRoute[];
};

type OsrmRoute = {
  geometry: GeoJsonLineString;
  distance: number;
  duration: number;
  legs: OsrmLeg[];
};

type OsrmLeg = {
  distance: number;
  duration: number;
  steps: OsrmStep[];
};

type OsrmStep = {
  distance: number;
  duration: number;
  name: string;
  maneuver: RouteStepManeuver;
};

export type OsrmTableResponse = {
  code: string;
  message?: string;
  durations?: Array<Array<number | null>>;
  distances?: Array<Array<number | null>>;
};
