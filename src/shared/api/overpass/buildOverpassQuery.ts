import type { NearbyPlacesParams } from './types';

export const buildOverpassQuery = ({ latitude, longitude, radiusMeters }: NearbyPlacesParams) => `
[out:json][timeout:25];
(
  nwr["name"]["tourism"~"attraction|museum|gallery|artwork|viewpoint"](around:${radiusMeters},${latitude},${longitude});
  nwr["name"]["historic"](around:${radiusMeters},${latitude},${longitude});
  nwr["name"]["amenity"~"museum|place_of_worship|theatre|cafe|restaurant|arts_centre"](around:${radiusMeters},${latitude},${longitude});
  nwr["name"]["leisure"~"park|garden"](around:${radiusMeters},${latitude},${longitude});
);
out center;
`;
