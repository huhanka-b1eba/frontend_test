import { MobileNavigationPage } from '@pages/mobile-navigation';
import { MobileRoutePage } from '@pages/mobile-route';
import { WelcomePage } from '@pages/welcome';
import { MockModeIndicator } from '@shared/mocks/ui/MockModeIndicator';

export const App = () => {
  let page;
  if (window.location.pathname === '/route/mobile/navigation') {
    page = <MobileNavigationPage />;
  } else if (window.location.pathname === '/route/mobile') {
    page = <MobileRoutePage />;
  } else {
    page = <WelcomePage />;
  }
  return (
    <>
      {page}
      <MockModeIndicator />
    </>
  );
};
