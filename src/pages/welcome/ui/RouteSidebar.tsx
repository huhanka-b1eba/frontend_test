import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair, LocateFixed, PanelLeftClose, Settings2 } from 'lucide-react';

import type { RouteResult } from '@shared/api/osrm';
import type { ApiInterest, ApiPace } from '@shared/api/route-adventure';
import type { Place } from '@shared/api/overpass';
import { Button } from '@shared/ui/button';
import { Checkbox } from '@shared/ui/checkbox';
import { Input } from '@shared/ui/input';
import { Slider } from '@shared/ui/slider';
import { Textarea } from '@shared/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip';

import {
  formatDistanceMeters,
  formatDurationMinutes,
  getTravelDistanceMetersFromSegments,
} from '../model/routeDuration';
import {
  formatRouteDuration,
  ROUTE_BUILDER_INTERESTS,
  ROUTE_BUILDER_PACES,
  type RouteBuilderFormErrors,
  type RouteBuilderFormValues,
} from '../model/routeBuilderForm';
import type { RoutePlace } from '../model/routePlaces';
import type { RouteSegment } from '../model/routeSegments';
import { RoutePreviewPlace } from './RoutePreviewPlace';
import { VoiceRequestInput } from './VoiceRequestInput';

type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error' | 'out-of-bounds';

type RouteSidebarProps = {
  places: RoutePlace[];
  route: RouteResult | null;
  backendRoutePlan: {
    startedAt: string;
    finishedAt: string;
    totalDurationMinutes: number;
    totalTravelDurationMinutes: number;
    totalVisitDurationMinutes: number;
  } | null;
  segments: RouteSegment[];
  routeDirty: boolean;
  isRoutePrepared: boolean;
  hasUserLocation: boolean;
  locationStatus: LocationStatus;
  isStartPicking: boolean;
  formValues: RouteBuilderFormValues;
  formErrors: RouteBuilderFormErrors;
  isRouteLoading: boolean;
  routeError: string | null;
  getCategoryTitle: (place: Place) => string;
  onFormChange: (values: RouteBuilderFormValues) => void;
  onLocateUser: () => void;
  onToggleStartPicking: () => void;
  onBuildRoute: () => void;
  onRebuildRoute: () => void;
  onRefreshRoute: () => void;
  onStartNavigation: () => void;
  onSidebarClose: () => void;
  onClearRoute: () => void;
  onRemovePlace: (placeId: string) => void;
  onVisitDurationChange: (placeId: string, durationMinutes: number) => void;
};

const INTEREST_KEY: Record<ApiInterest, string> = {
  история: 'history',
  'татарская культура': 'tatarCulture',
  архитектура: 'architecture',
  музеи: 'museums',
  мечети: 'mosques',
  театры: 'theatres',
  кафе: 'cafes',
  рестораны: 'restaurants',
  парки: 'parks',
  'необычные места': 'unusual',
};

const PACE_KEY: Record<ApiPace, string> = {
  неспешный: 'slow',
  обычный: 'normal',
  быстрый: 'fast',
};

const formatDateTime = (value: string, locale: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const RouteSidebar = ({
  places,
  route,
  backendRoutePlan,
  segments,
  routeDirty,
  isRoutePrepared,
  hasUserLocation,
  locationStatus,
  isStartPicking,
  formValues,
  formErrors,
  isRouteLoading,
  routeError,
  getCategoryTitle,
  onFormChange,
  onLocateUser,
  onToggleStartPicking,
  onBuildRoute,
  onRebuildRoute,
  onRefreshRoute,
  onStartNavigation,
  onSidebarClose,
  onClearRoute,
  onRemovePlace,
  onVisitDurationChange,
}: RouteSidebarProps) => {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage === 'tt' ? 'tt' : 'ru';
  const locale = language === 'tt' ? 'tt-RU' : 'ru-RU';
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const travelDistanceMeters =
    route && !routeDirty ? getTravelDistanceMetersFromSegments(segments) : null;
  const isActionDisabled = isRouteLoading;
  const canOpenRoute = isRoutePrepared && !routeDirty;
  const primaryAction = route
    ? routeDirty
      ? ('refresh' as const)
      : ('rebuild' as const)
    : ('build' as const);
  const buildRouteLabel = isRouteLoading
    ? t('routeBuilder.actions.loading')
    : primaryAction === 'refresh'
      ? t('routeBuilder.actions.refresh')
      : primaryAction === 'rebuild'
        ? t('routeBuilder.actions.rebuild')
        : t('routeBuilder.actions.build');
  const locationMessage =
    locationStatus === 'loading'
      ? t('routeBuilder.location.loading')
      : locationStatus === 'ready'
        ? t('routeBuilder.location.ready')
        : locationStatus === 'denied'
          ? t('routeBuilder.location.denied')
          : locationStatus === 'out-of-bounds'
            ? t('routeBuilder.location.outOfBounds')
            : locationStatus === 'error'
              ? t('routeBuilder.location.error')
              : t('routeBuilder.location.empty');

  const updateInterests = (interest: ApiInterest, checked: boolean) => {
    onFormChange({
      ...formValues,
      interests: checked
        ? [...formValues.interests, interest]
        : formValues.interests.filter((value) => value !== interest),
    });
  };

  return (
    <aside className="bg-card text-foreground flex h-dvh w-full min-w-0 flex-col overflow-hidden border-r max-lg:order-2 max-lg:h-[58dvh] max-lg:border-t max-lg:border-r-0">
      <header className="bg-card w-full min-w-0 shrink-0 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-semibold tracking-normal">
              {route ? t('routeBuilder.header.ready') : t('routeBuilder.header.title')}
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold">
              {places.length > 0
                ? t('routeBuilder.header.places', { count: places.length })
                : t('routeBuilder.header.empty')}
              {travelDistanceMeters !== null &&
                ` · ${formatDistanceMeters(travelDistanceMeters, language)}`}
            </h1>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1">
            {places.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="max-w-24 whitespace-normal"
                onClick={onClearRoute}
              >
                {t('routeBuilder.actions.clear')}
              </Button>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="hidden lg:inline-flex"
                  aria-label={t('routeBuilder.actions.hidePanel')}
                  aria-expanded
                  onClick={onSidebarClose}
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('routeBuilder.actions.hidePanel')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {backendRoutePlan && (
          <div className="mt-4 grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-sm">
            <div className="min-w-0 border-r pr-3">
              <p className="text-muted-foreground text-xs">{t('routeBuilder.result.total')}</p>
              <p className="mt-1 truncate font-semibold">
                {formatDurationMinutes(backendRoutePlan.totalDurationMinutes, language)}
              </p>
            </div>
            <div className="min-w-0 border-r px-3">
              <p className="text-muted-foreground text-xs">{t('routeBuilder.result.travel')}</p>
              <p className="mt-1 truncate font-semibold">
                {formatDurationMinutes(backendRoutePlan.totalTravelDurationMinutes, language)}
              </p>
            </div>
            <div className="min-w-0 pl-3">
              <p className="text-muted-foreground text-xs">{t('routeBuilder.result.visit')}</p>
              <p className="mt-1 truncate font-semibold">
                {formatDurationMinutes(backendRoutePlan.totalVisitDurationMinutes, language)}
              </p>
            </div>
            <div className="text-muted-foreground col-span-3 mt-1 text-xs">
              {t('routeBuilder.result.schedule', {
                start: formatDateTime(backendRoutePlan.startedAt, locale),
                finish: formatDateTime(backendRoutePlan.finishedAt, locale),
              })}
            </div>
          </div>
        )}
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-6 max-lg:pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <section className="grid min-w-0 gap-5">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{t('routeBuilder.form.interestsTitle')}</h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('routeBuilder.form.interestsHint')}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formValues.interests.length}/{ROUTE_BUILDER_INTERESTS.length}
              </span>
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-2 max-[380px]:grid-cols-1">
              {ROUTE_BUILDER_INTERESTS.map((interest) => {
                const checked = formValues.interests.includes(interest);

                return (
                  <button
                    key={interest}
                    type="button"
                    className={`min-w-0 rounded-lg border px-3 py-2 text-left text-sm leading-snug break-words whitespace-normal transition-colors ${
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'bg-background/55 hover:border-primary/50'
                    }`}
                    aria-pressed={checked}
                    onClick={() => updateInterests(interest, !checked)}
                  >
                    {t(`routeBuilder.interests.${INTEREST_KEY[interest]}`)}
                  </button>
                );
              })}
            </div>
            {formErrors.interests && (
              <p className="text-destructive mt-2 text-sm">{formErrors.interests}</p>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <h2 className="min-w-0 text-sm font-semibold">
                {t('routeBuilder.form.durationTitle')}
              </h2>
              <span className="text-primary shrink-0 text-right text-sm font-semibold">
                {formatRouteDuration(formValues.durationMinutes, language)}
              </span>
            </div>
            <Slider
              className="mt-4"
              min={30}
              max={720}
              step={30}
              value={[formValues.durationMinutes]}
              onValueChange={([durationMinutes]) => {
                onFormChange({ ...formValues, durationMinutes: durationMinutes ?? 180 });
              }}
            />
            <div className="text-muted-foreground mt-2 flex min-w-0 justify-between gap-3 text-xs">
              <span>{formatRouteDuration(30, language)}</span>
              <span className="shrink-0 text-right">{formatRouteDuration(720, language)}</span>
            </div>
            {formErrors.durationMinutes && (
              <p className="text-destructive mt-2 text-sm">{formErrors.durationMinutes}</p>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('routeBuilder.form.paceTitle')}</h2>
            <div className="mt-3 grid min-w-0 gap-2">
              {ROUTE_BUILDER_PACES.map((pace) => {
                const selected = formValues.pace === pace;
                const key = PACE_KEY[pace];

                return (
                  <button
                    key={pace}
                    type="button"
                    className={`min-w-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'bg-background/55 hover:border-primary/50'
                    }`}
                    aria-pressed={selected}
                    onClick={() => {
                      onFormChange({ ...formValues, pace });
                    }}
                  >
                    <span className="block text-sm leading-snug font-semibold break-words">
                      {t(`routeBuilder.pace.${key}.title`)}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs leading-snug break-words whitespace-normal">
                      {t(`routeBuilder.pace.${key}.description`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{t('routeBuilder.location.title')}</h2>
                <p className="text-muted-foreground mt-1 text-xs">{locationMessage}</p>
              </div>
              {hasUserLocation && <Crosshair className="text-primary mt-0.5 size-4 shrink-0" />}
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 min-[390px]:grid-cols-[repeat(2,minmax(0,1fr))]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-9 min-w-0 rounded-lg px-2.5 whitespace-normal"
                disabled={locationStatus === 'loading'}
                onClick={onLocateUser}
              >
                <LocateFixed className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{t('routeBuilder.location.useGps')}</span>
              </Button>
              <Button
                type="button"
                variant={isStartPicking ? 'default' : 'outline'}
                size="sm"
                className="h-auto min-h-9 min-w-0 rounded-lg px-2.5 whitespace-normal"
                onClick={onToggleStartPicking}
              >
                <Crosshair className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{t('routeBuilder.location.pickOnMap')}</span>
              </Button>
            </div>
            {formErrors.userLocation && (
              <p className="text-destructive mt-2 text-sm">{formErrors.userLocation}</p>
            )}
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-semibold" htmlFor="route-ai-request">
              {t('routeBuilder.form.aiRequestTitle')}
            </label>
            <VoiceRequestInput
              id="route-ai-request"
              value={formValues.aiRequest}
              error={formErrors.aiRequest}
              placeholder={t('routeBuilder.form.aiRequestPlaceholder')}
              onChange={(value) => {
                onFormChange({ ...formValues, aiRequest: value });
              }}
            />
          </div>

          <details
            open={isAdvancedOpen}
            onToggle={(event) => {
              setIsAdvancedOpen(event.currentTarget.open);
            }}
            className="min-w-0 rounded-xl border p-3"
          >
            <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              <Settings2 className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{t('routeBuilder.form.advancedTitle')}</span>
            </summary>
            <div className="mt-3 grid min-w-0 gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-medium" htmlFor="route-start-at">
                  {t('routeBuilder.form.startAtTitle')}
                </label>
                <Input
                  id="route-start-at"
                  type="datetime-local"
                  className="mt-1 max-w-full"
                  value={formValues.startAt}
                  onChange={(event) => {
                    onFormChange({ ...formValues, startAt: event.target.value });
                  }}
                />
                {formErrors.startAt && (
                  <p className="text-destructive mt-1 text-xs">{formErrors.startAt}</p>
                )}
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-medium" htmlFor="route-visited-places">
                  {t('routeBuilder.form.visitedPlacesTitle')}
                </label>
                <Textarea
                  id="route-visited-places"
                  className="mt-1 min-h-20 max-w-full min-w-0 resize-y overflow-x-hidden text-sm"
                  maxLength={2000}
                  value={formValues.visitedPlaces}
                  placeholder={t('routeBuilder.form.visitedPlacesPlaceholder')}
                  onChange={(event) => {
                    onFormChange({ ...formValues, visitedPlaces: event.target.value });
                  }}
                />
              </div>
              <label className="flex min-w-0 items-start gap-2 text-sm leading-snug">
                <Checkbox
                  className="mt-0.5 shrink-0"
                  checked={formValues.optimizeVisitOrder}
                  onCheckedChange={(checked) => {
                    onFormChange({ ...formValues, optimizeVisitOrder: checked === true });
                  }}
                />
                <span className="min-w-0 break-words">
                  {t('routeBuilder.form.optimizeVisitOrder')}
                </span>
              </label>
            </div>
          </details>

          {places.length > 0 && !backendRoutePlan && (
            <div className="min-w-0">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h2 className="min-w-0 text-sm font-semibold">
                  {t('routeBuilder.required.title')}
                </h2>
                <span className="text-muted-foreground text-xs">{places.length}</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('routeBuilder.required.description')}
              </p>
            </div>
          )}
        </section>

        {places.length > 0 && (
          <section className="mt-5 min-w-0">
            <h2 className="text-sm font-semibold">
              {backendRoutePlan
                ? t('routeBuilder.result.listTitle')
                : t('routeBuilder.required.listTitle')}
            </h2>
            <ol className="mt-3 flex min-w-0 flex-col gap-2">
              {places.map((place) => (
                <RoutePreviewPlace
                  key={place.id}
                  place={place}
                  categoryTitle={getCategoryTitle(place)}
                  onVisitDurationChange={onVisitDurationChange}
                  onRemovePlace={onRemovePlace}
                />
              ))}
            </ol>
          </section>
        )}
      </div>

      <footer className="bg-card min-w-0 shrink-0 border-t p-4 max-lg:pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {routeError && (
          <p className="text-destructive mb-3 text-sm font-medium break-words">{routeError}</p>
        )}
        {routeDirty && route && (
          <p className="text-muted-foreground mb-3 text-sm break-words">
            {t('routeBuilder.result.routeDirty')}
          </p>
        )}

        <div className="grid min-w-0 gap-2">
          <Button
            type="button"
            className="h-auto min-h-10 w-full min-w-0 whitespace-normal"
            disabled={isActionDisabled}
            onClick={() => {
              if (primaryAction === 'refresh') {
                onRefreshRoute();
                return;
              }

              if (primaryAction === 'rebuild') {
                onRebuildRoute();
                return;
              }

              onBuildRoute();
            }}
          >
            <span className="min-w-0 break-words">{buildRouteLabel}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-auto min-h-10 w-full min-w-0 whitespace-normal"
            disabled={!canOpenRoute || isRouteLoading}
            onClick={onStartNavigation}
          >
            <span className="min-w-0 break-words">{t('routeBuilder.actions.startWalk')}</span>
          </Button>
        </div>
      </footer>
    </aside>
  );
};
