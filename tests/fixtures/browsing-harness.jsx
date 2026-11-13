import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppHeader from '../../src/components/AppHeader.jsx';
import StudentBrowsePage from '../../src/components/StudentBrowsePage.jsx';
import RestaurantDetailsWrapper from '../../src/components/RestaurantDetailsWrapper.jsx';
import RouteFocus from '../../src/components/RouteFocus.jsx';
import CartProvider from '../../src/context/CartProvider.jsx';
import CartConfirmation from '../../src/components/CartConfirmation.jsx';
import CartFeedback from '../../src/components/CartFeedback.jsx';
import CartPage from '../../src/components/CartPage.jsx';
import { getFixtureCartStorage } from './cart-storage.js';
import IdentityProvider from '../../src/context/IdentityProvider.jsx';
import { createDemoBrowsingService, studentBrowsing } from '../../src/utils/studentBrowsing.js';
import '../../src/index.css';
import '../../src/App.css';
import '../../src/studentBrowsing.css';
import '../../src/cart.css';
import '../../src/identity.css';

// ISOLATED_BROWSING_FIXTURE: never imported by the app/production entry.
// Controls and deferred results exist only in this separate test document.
const fixture = { outcome: 'empty', pending: [] };
window.__browsingFixture = fixture;
const service = Object.fromEntries(['listRestaurants', 'getRestaurantMenu'].map((method) => [method, async (...args) => {
  const outcome = fixture.outcome;
  if (outcome === 'deferred') return new Promise((resolve, reject) => fixture.pending.push({ method, args, resolve, reject }));
  if (outcome === 'failure') throw new Error('Isolated browsing failure');
  if (outcome === 'empty' && method === 'listRestaurants') return createDemoBrowsingService([])[method](...args);
  return studentBrowsing[method](...args);
}]));

createRoot(document.getElementById('fixture-root')).render(
  <MemoryRouter initialEntries={['/browse?campus=aau-4k']}>
    <IdentityProvider>
    <CartProvider getStorage={getFixtureCartStorage}>
    <RouteFocus />
    <p style={{ padding: '12px 16px', background: '#24332f', color: 'white', margin: 0 }}>ISOLATED BROWSING TEST: empty, failure and delayed responses. No remote service.</p>
    <AppHeader />
    <main id="main-content" className="layout-container app-main" tabIndex={-1}>
      <CartFeedback />
      <Routes>
        <Route path="/browse" element={<StudentBrowsePage service={service} />} />
        <Route path="/restaurant/:restaurantId" element={<RestaurantDetailsWrapper service={service} />} />
        <Route path="/cart" element={<CartPage />} />
      </Routes>
    </main>
    <CartConfirmation />
    </CartProvider>
    </IdentityProvider>
  </MemoryRouter>,
);
