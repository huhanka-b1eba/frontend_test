export type TransportMode = 'walking' | 'cycling' | 'driving' | 'transit';

export type RoutableTransportMode = Exclude<TransportMode, 'transit'>;

export const isRoutableTransportMode = (mode: TransportMode): mode is RoutableTransportMode => {
  return mode !== 'transit';
};

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  walking: 'Пешком',
  cycling: 'Велосипед',
  driving: 'Авто',
  transit: 'Транспорт',
};

export const TRANSPORT_MODE_TRAVEL_LABELS: Record<TransportMode, string> = {
  walking: 'Пешком',
  cycling: 'На велосипеде',
  driving: 'На автомобиле',
  transit: 'В Яндекс Картах',
};
