import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

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

  const yandexUrl = useMemo(
    () =>
      buildYandexMapsRouteUrl(yandexRoutePoints, {
        transportMode: route.transportMode,
      }),
    [route.transportMode, yandexRoutePoints],
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
      setCopyStatus('Ссылка скопирована');
    } catch {
      setCopyStatus('Не удалось скопировать ссылку');
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Возьми маршрут с собой</DialogTitle>

        <DialogDescription>Маршрут готов. Открой его на телефоне.</DialogDescription>
      </DialogHeader>

      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList className="w-full">
          <TabsTrigger value="our">Наш навигатор</TabsTrigger>

          <TabsTrigger value="yandex">Яндекс Карты</TabsTrigger>
        </TabsList>

        <TabsContent value="our" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Навигация по маршруту, информация о местах и будущий AI-гид.
          </p>
        </TabsContent>

        <TabsContent value="yandex" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Открой маршрут в привычных Яндекс Картах. AI-гид и функции нашего навигатора будут
            недоступны.
          </p>

          {!userLocation && (
            <p className="text-destructive border-destructive bg-background/70 border-l-2 py-2 pl-3 text-sm font-medium">
              Не удалось определить ваше местоположение. Разрешите доступ к геопозиции.
            </p>
          )}

          {userLocation && !canUseYandex && (
            <p className="text-destructive border-destructive bg-background/70 border-l-2 py-2 pl-3 text-sm font-medium">
              Этот маршрут слишком большой для передачи в Яндекс Карты. Максимум:{' '}
              {YANDEX_MAPS_MAX_ROUTE_POINTS} точек. В вашем маршруте: {yandexRoutePoints.length}.
              Используйте наш навигатор или сократите количество точек.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {canShareCurrentMode && (
        <div className="bg-background/55 flex flex-col items-center gap-3 border-y py-4">
          <QRCodeSVG value={shareUrl} size={220} />

          <p className="text-muted-foreground text-center text-sm">Отсканируй QR-код телефоном</p>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="rounded-lg"
        disabled={!canShareCurrentMode}
        onClick={() => void handleCopy()}
      >
        Скопировать ссылку
      </Button>

      {copyStatus && <p className="text-muted-foreground text-center text-sm">{copyStatus}</p>}
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
