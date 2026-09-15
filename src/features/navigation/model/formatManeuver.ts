import type { RouteStep } from '@shared/api/osrm';

import type { NavigationInstruction } from './navigation.types';

const formatTurn = (modifier?: string) => {
  switch (modifier) {
    case 'left':
      return 'Поверните налево';
    case 'right':
      return 'Поверните направо';
    case 'slight left':
      return 'Держитесь левее';
    case 'slight right':
      return 'Держитесь правее';
    case 'sharp left':
      return 'Резко поверните налево';
    case 'sharp right':
      return 'Резко поверните направо';
    case 'straight':
      return 'Продолжайте прямо';
    default:
      return 'Продолжайте движение';
  }
};

export const formatManeuver = (step: RouteStep | undefined): NavigationInstruction => {
  if (!step) {
    return {
      title: 'Продолжайте движение',
      streetName: null,
    };
  }

  const { type, modifier } = step.maneuver;
  const title = (() => {
    switch (type) {
      case 'depart':
        return 'Начните движение';
      case 'turn':
        return formatTurn(modifier);
      case 'continue':
        return 'Продолжайте прямо';
      case 'fork':
        return modifier?.includes('left') ? 'Держитесь левее' : 'Держитесь правее';
      case 'arrive':
        return 'Вы прибыли';
      default:
        return formatTurn(modifier);
    }
  })();

  return {
    title,
    streetName: step.name.trim() ? step.name : null,
  };
};

export const formatNavigationDistance = (distanceMeters: number | null) => {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) {
    return '—';
  }

  if (distanceMeters > 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} км`;
  }

  if (distanceMeters >= 100) {
    return `${Math.round(distanceMeters / 10) * 10} м`;
  }

  return `${Math.round(distanceMeters / 5) * 5} м`;
};
