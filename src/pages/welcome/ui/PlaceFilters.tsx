import { Button } from '@shared/ui/button';

import {
  getPlaceFilterCount,
  PLACE_FILTER_LABELS,
  PLACE_FILTERS,
  type PlaceFilter,
} from '../model/placeFilters';
import type { Place } from '@shared/api/overpass';

type PlaceFiltersProps = {
  places: Place[];
  value: PlaceFilter;
  onChange: (filter: PlaceFilter) => void;
};

export const PlaceFilters = ({ places, value, onChange }: PlaceFiltersProps) => {
  return (
    <div className="pointer-events-auto max-w-[calc(100vw-2rem)] overflow-x-auto rounded-md">
      <div className="flex w-max gap-2">
        {PLACE_FILTERS.map((filter) => {
          const isActive = filter === value;
          const count = getPlaceFilterCount(places, filter);

          return (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => {
                onChange(filter);
              }}
              className="h-8 rounded-md px-3 text-xs"
            >
              {PLACE_FILTER_LABELS[filter]}
              {count > 0 && <span className="text-xs opacity-75">{count}</span>}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
