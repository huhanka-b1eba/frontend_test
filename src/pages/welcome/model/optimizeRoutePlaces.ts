import type { RouteMatrix } from '@shared/api/osrm';

import { reorderRoutePlaces, type RoutePlace } from './routePlaces';

type OptimizeRoutePlacesParams = {
  places: RoutePlace[];
  matrix: RouteMatrix;
};

export const optimizeRoutePlaces = ({ places, matrix }: OptimizeRoutePlacesParams) => {
  const result: RoutePlace[] = [];
  const unvisited = places.map((place, index) => ({
    place,
    matrixIndex: index + 1,
  }));
  let currentMatrixIndex = 0;

  while (unvisited.length > 0) {
    let bestUnvisitedIndex = -1;
    let bestDuration = Number.POSITIVE_INFINITY;

    unvisited.forEach((candidate, index) => {
      const duration = matrix.durations[currentMatrixIndex]?.[candidate.matrixIndex];

      if (duration !== null && duration !== undefined && duration < bestDuration) {
        bestDuration = duration;
        bestUnvisitedIndex = index;
      }
    });

    if (bestUnvisitedIndex === -1) {
      result.push(...unvisited.map(({ place }) => place));
      break;
    }

    const [next] = unvisited.splice(bestUnvisitedIndex, 1);

    if (!next) {
      break;
    }

    result.push(next.place);
    currentMatrixIndex = next.matrixIndex;
  }

  return reorderRoutePlaces(result);
};
