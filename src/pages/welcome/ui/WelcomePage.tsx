import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppLayout } from '@shared/ui/app-layout';
import { LandingPage } from './LandingPage';
import { RouteBuilderPage } from './RouteBuilderPage';
import { RouteBuilderV2Page } from './RouteBuilderV2Page';
import { StubPage } from './StubPage';

const isPlannerUrl = () => {
  return window.location.pathname === '/map';
};

const normalizeBuilderPath = () => {
  const { hash, pathname, search } = window.location;
  const params = new URLSearchParams(search);

  if (
    pathname !== '/route-builder-v2' &&
    pathname !== '/planner' &&
    !(pathname !== '/map' && params.get('planner') === '1')
  ) {
    return pathname || '/';
  }

  const nextUrl = `/route-builder${search}${hash}`;

  window.history.replaceState(null, '', nextUrl);

  return '/route-builder';
};

const getCurrentPath = () => normalizeBuilderPath();

export const WelcomePage = () => {
  const { t } = useTranslation();
  const [showPlanner, setShowPlanner] = useState(isPlannerUrl);
  const [currentPath, setCurrentPath] = useState(getCurrentPath);

  useEffect(() => {
    const handlePopState = () => {
      setShowPlanner(isPlannerUrl());
      setCurrentPath(getCurrentPath());
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleStartRoute = useCallback((request?: string) => {
    const params = new URLSearchParams();

    if (request) {
      params.set('request', request);
    }

    const nextUrl = params.size > 0 ? `/route-builder?${params.toString()}` : '/route-builder';

    window.history.pushState(null, '', nextUrl);
    setShowPlanner(false);
    setCurrentPath(getCurrentPath());
  }, []);

  if (showPlanner) {
    return <RouteBuilderPage />;
  }

  if (currentPath === '/route-builder') {
    return <RouteBuilderV2Page />;
  }

  if (currentPath === '/events') {
    return (
      <AppLayout activePath={currentPath}>
        <StubPage
          kind="events"
          title={t('stubPages.events.title')}
          description={t('stubPages.events.description')}
        />
      </AppLayout>
    );
  }

  if (currentPath === '/excursions') {
    return (
      <AppLayout activePath={currentPath}>
        <StubPage
          kind="excursions"
          title={t('stubPages.excursions.title')}
          description={t('stubPages.excursions.description')}
        />
      </AppLayout>
    );
  }

  return <LandingPage onStartRoute={handleStartRoute} />;
};
