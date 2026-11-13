import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthScreen from "../../src/components/AuthScreen.jsx";
import AppHeader from "../../src/components/AppHeader.jsx";
import CartProvider from "../../src/context/CartProvider.jsx";
import { getFixtureCartStorage } from './cart-storage.js';
import IdentityProvider from '../../src/context/IdentityProvider.jsx';
import "../../src/index.css";
import "../../src/App.css";
import "../../src/studentBrowsing.css";
import "../../src/cart.css";
import "../../src/identity.css";

// ISOLATED_AUTH_FIXTURE: this entry is not imported by the app or production build.
// Only synthetic test values belong here. There are no HTTP requests or sessions.
const fixture = { outcome: "success", delayMs: 500, calls: [] };
window.__authFixture = fixture;
const service = {
  available: true,
  async submit(mode, payload) {
    const outcome = fixture.outcome;
    // Record metadata only. Never record a password or the full payload.
    fixture.calls.push({ mode, keys: Object.keys(payload), campusId: payload.campusId, email: payload.email,
      hasPassword: typeof payload.password === "string" && payload.password.length > 0,
      confirmationIncluded: Object.hasOwn(payload, "confirmPassword") });
    await new Promise((resolve) => setTimeout(resolve, fixture.delayMs));
    if (outcome === "failure") throw new Error("Isolated fixture failure");
  },
};

createRoot(document.getElementById("fixture-root")).render(
  <MemoryRouter initialEntries={["/signup"]}>
    <IdentityProvider>
    <CartProvider getStorage={getFixtureCartStorage}>
    <p style={{ margin: 0, padding: "12px 16px", background: "#24332f", color: "white" }}>ISOLATED AUTH TEST: outcomes are simulated. No account or session is created.</p>
    <div className="app">
      <AppHeader />
      <main className="layout-container app-main">
        <Routes>
          <Route path="/signup" element={<AuthScreen key="signup" mode="signup" service={service} />} />
          <Route path="/login" element={<AuthScreen key="login" mode="login" service={service} />} />
        </Routes>
      </main>
    </div>
    </CartProvider>
    </IdentityProvider>
  </MemoryRouter>,
);
