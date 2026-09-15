import { MobileNavigationPage } from '@pages/mobile-navigation';
import { MobileRoutePage } from '@pages/mobile-route';
import { WelcomePage } from '@pages/welcome';

export const App = () => {
  if (window.location.pathname === '/route/mobile/navigation') {
    return <MobileNavigationPage />;
  }

  if (window.location.pathname === '/route/mobile') {
    return <MobileRoutePage />;
  }

  return <WelcomePage />;
};
