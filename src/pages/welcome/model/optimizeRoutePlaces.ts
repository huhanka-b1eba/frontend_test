import { getWalkingMatrix, type RouteMatrix, type RoutePoint } from '@shared/api/osrm';
import type { ApiInterest } from '@shared/api/route-adventure';
import type { UserLocation } from '@shared/ui/map';

import { reorderRoutePlaces, type RoutePlace } from './routePlaces';

type OptimizeRoutePlacesParams = {
  places: RoutePlace[];
  startPoint: UserLocation;
  durationMinutes: number;
  interests: ApiInterest[];
  requiredPlacesText?: string;
  visitedPlacesText?: string;
};

type Candidate = {
  place: RoutePlace;
  matrixIndex: number;
  score: number;
  mandatory: boolean;
};

const MAX_MATRIX_PLACES = 22;
const WALKING_SPEED_METERS_PER_SECOND = 1.25;
const MANDATORY_BONUS = 1000;

const normalizeText = (value: string) => value.trim().toLowerCase();

const splitTerms = (value: string | undefined) => {
  return normalizeText(value ?? '')
    .split(/[,;\n]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
};

const getPlaceText = (place: RoutePlace) => {
  return normalizeText(
    [
      place.name,
      place.category,
      place.description,
      place.tags.type,
      place.tags.description,
      place.tags.address,
    ]
      .filter(Boolean)
      .join(' '),
  );
};

const getRatingScore = (place: RoutePlace) => {
  const rating =
    typeof place.rating === 'number' && Number.isFinite(place.rating)
      ? place.rating
      : Number(place.tags.rating);

  if (!Number.isFinite(rating)) {
    return 8;
  }

  return Math.max(0, 28 - Math.min(rating, 28));
};

const getInterestScore = (place: RoutePlace, interests: ApiInterest[]) => {
  const text = getPlaceText(place);

  return interests.reduce((score, interest) => {
    return text.includes(interest.toLowerCase()) ? score + 18 : score;
  }, 0);
};

const isTextMatched = (place: RoutePlace, terms: string[]) => {
  if (terms.length === 0) {
    return false;
  }

  const text = getPlaceText(place);

  return terms.some((term) => text.includes(term));
};

const getMatrixValue = (
  matrix: RouteMatrix,
  fromIndex: number,
  toIndex: number,
  kind: 'durations' | 'distances',
) => {
  return matrix[kind][fromIndex]?.[toIndex] ?? null;
};

const getLegDurationMinutes = (matrix: RouteMatrix, fromIndex: number, toIndex: number) => {
  const duration = getMatrixValue(matrix, fromIndex, toIndex, 'durations');

  if (duration !== null && Number.isFinite(duration)) {
    return duration / 60;
  }

  const distance = getMatrixValue(matrix, fromIndex, toIndex, 'distances');

  if (distance !== null && Number.isFinite(distance)) {
    return distance / WALKING_SPEED_METERS_PER_SECOND / 60;
  }

  return Number.POSITIVE_INFINITY;
};

const getRouteTotalMinutes = (route: Candidate[], matrix: RouteMatrix) => {
  let currentIndex = 0;
  let total = 0;

  route.forEach((candidate) => {
    total += getLegDurationMinutes(matrix, currentIndex, candidate.matrixIndex);
    total += candidate.place.visitDurationMinutes;
    currentIndex = candidate.matrixIndex;
  });

  return total;
};

const nearestNeighbourOrder = (candidates: Candidate[], matrix: RouteMatrix) => {
  const result: Candidate[] = [];
  const unvisited = [...candidates];
  let currentIndex = 0;

  while (unvisited.length > 0) {
    let bestIndex = 0;
    let bestDuration = Number.POSITIVE_INFINITY;

    unvisited.forEach((candidate, index) => {
      const duration = getLegDurationMinutes(matrix, currentIndex, candidate.matrixIndex);
      const weightedDuration = duration - candidate.score * 0.01;

      if (weightedDuration < bestDuration) {
        bestDuration = weightedDuration;
        bestIndex = index;
      }
    });

    const [next] = unvisited.splice(bestIndex, 1);

    if (!next) {
      break;
    }

    result.push(next);
    currentIndex = next.matrixIndex;
  }

  return result;
};

const getPathWalkingMinutes = (route: Candidate[], matrix: RouteMatrix) => {
  let total = 0;
  let currentIndex = 0;

  route.forEach((candidate) => {
    total += getLegDurationMinutes(matrix, currentIndex, candidate.matrixIndex);
    currentIndex = candidate.matrixIndex;
  });

  return total;
};

const twoOptOrder = (route: Candidate[], matrix: RouteMatrix) => {
  let best = [...route];
  let improved = true;
  let iteration = 0;

  while (improved && iteration < 60) {
    improved = false;
    iteration += 1;

    for (let start = 0; start < best.length - 2; start += 1) {
      for (let end = start + 2; end < best.length; end += 1) {
        const candidate = [
          ...best.slice(0, start),
          ...best.slice(start, end + 1).reverse(),
          ...best.slice(end + 1),
        ];

        if (getPathWalkingMinutes(candidate, matrix) + 0.1 < getPathWalkingMinutes(best, matrix)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }

  return best;
};

const orderCandidates = (candidates: Candidate[], matrix: RouteMatrix) => {
  return twoOptOrder(nearestNeighbourOrder(candidates, matrix), matrix);
};

const createFallbackMatrix = (points: RoutePoint[]): RouteMatrix => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const distanceBetween = (from: RoutePoint, to: RoutePoint) => {
    const earthRadiusMeters = 6371000;
    const deltaLat = toRadians(to.latitude - from.latitude);
    const deltaLon = toRadians(to.longitude - from.longitude);
    const lat1 = toRadians(from.latitude);
    const lat2 = toRadians(to.latitude);
    const a =
      Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const distances = points.map((from) => points.map((to) => distanceBetween(from, to) * 1.25));

  return {
    distances,
    durations: distances.map((row) =>
      row.map((distance) => distance / WALKING_SPEED_METERS_PER_SECOND),
    ),
  };
};

const getRouteMatrix = async (points: RoutePoint[]) => {
  try {
    return await getWalkingMatrix(points);
  } catch (error) {
    console.warn('[Route optimizer] walking matrix failed, falling back to geo heuristic', error);
    return createFallbackMatrix(points);
  }
};

export const optimizeRoutePlaces = async ({
  places,
  startPoint,
  durationMinutes,
  interests,
  requiredPlacesText,
  visitedPlacesText,
}: OptimizeRoutePlacesParams) => {
  const visitedTerms = splitTerms(visitedPlacesText);
  const requiredTerms = splitTerms(requiredPlacesText);
  const filteredPlaces = places.filter((place) => !isTextMatched(place, visitedTerms));

  if (filteredPlaces.length <= 1) {
    return reorderRoutePlaces(filteredPlaces);
  }

  const start: RoutePoint = {
    latitude: startPoint.latitude,
    longitude: startPoint.longitude,
  };
  const preliminaryPoints = [
    start,
    ...filteredPlaces.map((place) => ({
      latitude: place.latitude,
      longitude: place.longitude,
    })),
  ];
  const preliminaryMatrix = createFallbackMatrix(preliminaryPoints);
  const preliminaryCandidates = filteredPlaces.map((place, index) => {
    const matrixIndex = index + 1;
    const mandatory = isTextMatched(place, requiredTerms);
    const distance = getMatrixValue(preliminaryMatrix, 0, matrixIndex, 'distances') ?? 0;

    return {
      place,
      matrixIndex,
      mandatory,
      score:
        getInterestScore(place, interests) +
        getRatingScore(place) +
        (mandatory ? MANDATORY_BONUS : 0) -
        distance / 700,
    };
  });
  const matrixCandidates = preliminaryCandidates
    .sort((first, second) => second.score - first.score)
    .slice(0, MAX_MATRIX_PLACES);
  const points = [
    start,
    ...matrixCandidates.map(({ place }) => ({
      latitude: place.latitude,
      longitude: place.longitude,
    })),
  ];
  const matrix = await getRouteMatrix(points);
  const candidates = matrixCandidates.map((candidate, index) => ({
    ...candidate,
    matrixIndex: index + 1,
  }));
  const mandatoryCandidates = candidates.filter((candidate) => candidate.mandatory);
  const optionalCandidates = candidates.filter((candidate) => !candidate.mandatory);
  let selected: Candidate[] = orderCandidates(mandatoryCandidates, matrix);

  optionalCandidates
    .sort((first, second) => second.score - first.score)
    .forEach((candidate) => {
      const nextSelected = orderCandidates([...selected, candidate], matrix);

      if (getRouteTotalMinutes(nextSelected, matrix) <= durationMinutes) {
        selected = nextSelected;
      }
    });

  if (selected.length === 0) {
    const fallback = optionalCandidates
      .map((candidate) => ({
        candidate,
        totalMinutes: getRouteTotalMinutes([candidate], matrix),
      }))
      .filter(({ totalMinutes }) => totalMinutes <= durationMinutes)
      .sort(
        (first, second) =>
          second.candidate.score / Math.max(second.totalMinutes, 1) -
          first.candidate.score / Math.max(first.totalMinutes, 1),
      )[0];

    selected = fallback
      ? [fallback.candidate]
      : [optionalCandidates[0] ?? candidates[0]].filter(Boolean);
  }

  return reorderRoutePlaces(orderCandidates(selected, matrix).map(({ place }) => place));
};
