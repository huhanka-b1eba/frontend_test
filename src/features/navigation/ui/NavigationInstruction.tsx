import type { RouteStep } from '@shared/api/osrm';
import { ArrowUp, CornerUpLeft, CornerUpRight, MoveUpLeft, MoveUpRight } from 'lucide-react';

import { formatManeuver, formatNavigationDistance } from '../model';

type NavigationInstructionProps = {
  step?: RouteStep;
  distanceMeters: number | null;
};

const ManeuverGlyph = ({ modifier }: { modifier?: string }) => {
  if (modifier === 'left' || modifier === 'sharp left') {
    return <CornerUpLeft className="size-7" strokeWidth={2.4} />;
  }

  if (modifier === 'right' || modifier === 'sharp right') {
    return <CornerUpRight className="size-7" strokeWidth={2.4} />;
  }

  if (modifier === 'slight left') {
    return <MoveUpLeft className="size-7" strokeWidth={2.4} />;
  }

  if (modifier === 'slight right') {
    return <MoveUpRight className="size-7" strokeWidth={2.4} />;
  }

  return <ArrowUp className="size-7" strokeWidth={2.4} />;
};

export const NavigationInstructionCard = ({ step, distanceMeters }: NavigationInstructionProps) => {
  const instruction = formatManeuver(step);

  return (
    <section className="bg-primary text-primary-foreground absolute top-3 right-3 left-3 z-20 rounded-xl border border-white/10 px-4 py-3 shadow-[0_12px_28px_-22px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-white/12">
          <ManeuverGlyph modifier={step?.maneuver.modifier} />
        </div>

        <div className="min-w-0">
          <p className="text-3xl leading-none font-bold">
            {formatNavigationDistance(distanceMeters)}
          </p>
          <h1 className="mt-1 text-lg leading-tight font-semibold">{instruction.title}</h1>
          {instruction.streetName && (
            <p className="text-primary-foreground/75 mt-0.5 truncate text-sm">
              {instruction.streetName}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
