import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, MapPinned, Smartphone, TriangleAlert } from 'lucide-react';

import type { SharedRoute } from '@shared/lib/route-share';
import { createRouteShareUrl } from '@shared/lib/route-share';
import {
  buildYandexMapsRouteUrl,
  canOpenRouteInYandexMaps,
  YANDEX_MAPS_MAX_ROUTE_POINTS,
} from '@shared/lib/yandex-maps';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import type { UserLocation } from '@shared/ui/map';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';

type NavigationMode = 'our' | 'yandex';

type RouteHandoffModalProps = {
  open: boolean;
  route: SharedRoute;
  userLocation: UserLocation | null;
  initialMode?: NavigationMode;
  onOpenChange: (open: boolean) => void;
};

type RouteHandoffContentProps = {
  route: SharedRoute;
  userLocation: UserLocation | null;
  initialMode: NavigationMode;
};

const RouteHandoffContent = ({ route, userLocation, initialMode }: RouteHandoffContentProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<NavigationMode>(initialMode);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const ourUrl = useMemo(() => createRouteShareUrl(route), [route]);

  const yandexRoutePoints = useMemo(
    () => [
      ...(userLocation
        ? [
            {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            },
          ]
        : []),

      ...route.places.map((place) => ({
        latitude: place.latitude,
        longitude: place.longitude,
      })),
    ],
    [route.places, userLocation],
  );

  const yandexTransportMode = route.segmentModes.every((segmentMode) => segmentMode === 'walking')
    ? 'walking'
    : undefined;

  const yandexUrl = useMemo(
    () =>
      buildYandexMapsRouteUrl(yandexRoutePoints, {
        transportMode: yandexTransportMode,
      }),
    [yandexRoutePoints, yandexTransportMode],
  );

  const canUseYandex = Boolean(userLocation) && canOpenRouteInYandexMaps(yandexRoutePoints);

  const shareUrl = mode === 'our' ? ourUrl : yandexUrl;

  const canShareCurrentMode = mode === 'our' || canUseYandex;

  const handleModeChange = (value: string) => {
    setMode(value as NavigationMode);
    setCopyStatus(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus(t('routeHandoff.actions.copied'));
    } catch {
      setCopyStatus(t('routeHandoff.actions.copyError'));
    }
  };

  return (
    <DialogContent className="max-h-[calc(100dvh-1rem)] gap-0 overflow-y-auto rounded-[1.75rem] border-[#e6ddcf] bg-[#FFFEFB] p-0 text-[#172420] shadow-[0_24px_80px_rgba(23,36,32,0.18)] sm:max-w-[440px]">
      <div className="px-5 pt-5 pb-3 sm:px-6 sm:pt-5">
        <DialogHeader className="gap-1.5 pr-8 text-left">
          <DialogTitle className="font-serif text-[1.95rem] leading-[0.96] font-normal tracking-[-0.045em] text-[#172420] sm:text-[2.22rem]">
            {t('routeHandoff.title')}
          </DialogTitle>

          <DialogDescription className="max-w-[360px] text-[0.88rem] leading-5 font-medium text-[#66746c]">
            {t('routeHandoff.description')}
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="px-5 pb-4 sm:px-6 sm:pb-5">
        <Tabs value={mode} onValueChange={handleModeChange} className="gap-3">
          <TabsList className="grid min-h-12 w-full grid-cols-2 rounded-full border border-[#d8d0c0] bg-[#f7f2e9] p-1.5 text-[#66746c]">
            <TabsTrigger
              value="our"
              className="h-9 rounded-full text-[0.78rem] font-semibold data-[state=active]:bg-[#154b39] data-[state=active]:text-[#fffaf0] sm:text-[0.82rem]"
            >
              <Smartphone className="size-4" aria-hidden="true" />
              {t('routeHandoff.modes.our')}
            </TabsTrigger>

            <TabsTrigger
              value="yandex"
              className="h-9 rounded-full text-[0.78rem] font-semibold data-[state=active]:bg-[#154b39] data-[state=active]:text-[#fffaf0] sm:text-[0.82rem]"
            >
              <MapPinned className="size-4" aria-hidden="true" />
              {t('routeHandoff.modes.yandex')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="our">
            <p className="px-1 text-[0.84rem] leading-5 font-medium text-[#315746]">
              {t('routeHandoff.descriptions.our')}
            </p>
          </TabsContent>

          <TabsContent value="yandex" className="space-y-2.5">
            <p className="px-1 text-[0.84rem] leading-5 font-medium text-[#66746c]">
              {t('routeHandoff.descriptions.yandex')}
            </p>

            {!userLocation && (
              <p className="flex items-start gap-2 rounded-[1rem] border border-[#e8c4c4] bg-[#fff7f7] px-3 py-2.5 text-[0.8rem] leading-5 font-semibold text-[#8a3d3d]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t('routeHandoff.warnings.noLocation')}
              </p>
            )}

            {userLocation && !canUseYandex && (
              <p className="flex items-start gap-2 rounded-[1rem] border border-[#e8c4c4] bg-[#fff7f7] px-3 py-2.5 text-[0.8rem] leading-5 font-semibold text-[#8a3d3d]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t('routeHandoff.warnings.tooManyPoints', {
                  max: YANDEX_MAPS_MAX_ROUTE_POINTS,
                  count: yandexRoutePoints.length,
                })}
              </p>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-3">
          {canShareCurrentMode ? (
            <div className="grid place-items-center gap-2.5">
              <div className="p-1">
                <QRCodeSVG
                  value={shareUrl}
                  size={218}
                  bgColor="#ffffff"
                  fgColor="#154b39"
                  className="size-[194px] sm:size-[218px]"
                />
              </div>

              <div className="text-center">
                <p className="text-[0.86rem] font-semibold text-[#172420]">
                  {t('routeHandoff.qr.label')}
                </p>
                <p className="mt-0.5 text-xs leading-4 text-[#66746c]">
                  {t('routeHandoff.qr.hint')}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[156px] place-items-center rounded-[1.05rem] border border-dashed border-[#d8d0c0] px-4 text-center text-sm font-medium text-[#66746c]">
              {t('routeHandoff.warnings.noLocation')}
            </div>
          )}
        </div>

        <Button
          type="button"
          className="mt-3 min-h-10 w-full rounded-full border-0 bg-[#154b39] px-5 text-sm font-semibold text-[#fffaf0] shadow-none hover:bg-[#103c2e] active:translate-y-px disabled:opacity-45"
          disabled={!canShareCurrentMode}
          onClick={() => void handleCopy()}
        >
          {copyStatus === t('routeHandoff.actions.copied') ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {t('routeHandoff.actions.copy')}
        </Button>

        {copyStatus && (
          <p className="mt-2 text-center text-sm font-medium text-[#66746c]">{copyStatus}</p>
        )}
      </div>
    </DialogContent>
  );
};

export const RouteHandoffModal = ({
  open,
  route,
  userLocation,
  initialMode = 'our',
  onOpenChange,
}: RouteHandoffModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <RouteHandoffContent route={route} userLocation={userLocation} initialMode={initialMode} />
      )}
    </Dialog>
  );
};
