export type GeoJsonPosition = [longitude: number, latitude: number];

export type GeoJsonLineString = {
  type: 'LineString';
  coordinates: GeoJsonPosition[];
};

export type GeoJsonFeature<TGeometry> = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: TGeometry;
};
