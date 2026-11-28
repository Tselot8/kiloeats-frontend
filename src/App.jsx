import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import "./studentBrowsing.css";
import "./cart.css";
import "./identity.css";
import MenuPage from "./components/MenuPage.jsx";
import EditMenuPage from "./components/EditMenuPage.jsx";
import OrdersPage from "./components/OrdersPage.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import RestaurantDetailsWrapper from "./components/RestaurantDetailsWrapper.jsx";
import SignUpPage from "./components/SignUpPage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import AppHeader from "./components/AppHeader.jsx";
import NotFoundPage from "./components/NotFoundPage.jsx";
import RouteFocus from "./components/RouteFocus.jsx";
import StudentBrowsePage from "./components/StudentBrowsePage.jsx";
import CartProvider from "./context/CartProvider.jsx";
import CartPage from "./components/CartPage.jsx";
import CartFeedback from "./components/CartFeedback.jsx";
import CartConfirmation from "./components/CartConfirmation.jsx";
import IdentityProvider from "./context/IdentityProvider.jsx";
import AccessGate from "./components/AccessGate.jsx";
import StudentAccountPage from "./components/StudentAccountPage.jsx";
import AdminPage from "./components/AdminPage.jsx";
import CheckoutProvider from "./context/CheckoutProvider.jsx";
import CheckoutPage from "./components/CheckoutPage.jsx";
import StudentOrdersPage from "./components/StudentOrdersPage.jsx";
import { CHECKOUT_SERVICE } from "./utils/checkout.js";
import "./checkout.css";
import "./studentOrders.css";

export const AppWorkspace = ({ AdminWorkspace = AdminPage, checkoutService = CHECKOUT_SERVICE }) => (
  <CheckoutProvider service={checkoutService}>
    <RouteFocus />
    <div className="app">
      <div className="reference-backdrop" aria-hidden="true" />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AppHeader />
      <main id="main-content" className="layout-container app-main" tabIndex={-1}>
        <CartFeedback />
        <Routes>
          <Route path="/" element={<AccessGate area="merchant"><MenuPage /></AccessGate>} />
          <Route path="/edit-menu" element={<AccessGate area="merchant"><EditMenuPage /></AccessGate>} />
          <Route path="/orders" element={<AccessGate area="merchant"><OrdersPage /></AccessGate>} />
          <Route path="/profile" element={<AccessGate area="merchant"><ProfilePage /></AccessGate>} />
          <Route path="/account" element={<AccessGate area="student"><StudentAccountPage /></AccessGate>} />
          <Route path="/admin" element={<AccessGate area="admin"><AdminWorkspace /></AccessGate>} />
          <Route path="/browse" element={<StudentBrowsePage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<AccessGate area="checkout"><CheckoutPage /></AccessGate>} />
          <Route path="/student/orders" element={<AccessGate area="student"><StudentOrdersPage /></AccessGate>} />
          <Route path="/student/orders/:orderReference" element={<AccessGate area="student"><StudentOrdersPage /></AccessGate>} />
          <Route path="/restaurant/:restaurantId" element={<RestaurantDetailsWrapper />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="main-footer">
        <div className="layout-container footer-content">
          <div className="about-us">
            <h3>About Us</h3>
            <p>Discover the best meals with KiloEats</p>
            <p><a href="/food-photo-credits.html">Food photo credits and licenses</a></p>
          </div>
          <div className="contact-info">
            <p>Email: support@kiloeats.com</p>
            <p>Phone: +1-800-555-1234</p>
          </div>
          <div className="social-links">
            <a href="https://twitter.com">Twitter</a>
            <a href="https://instagram.com">Instagram</a>
            <a href="https://facebook.com">Facebook</a>
          </div>
        </div>
      </footer>
    </div>
    <CartConfirmation />
  </CheckoutProvider>
);

AppWorkspace.propTypes = {
  AdminWorkspace: (props) => props.AdminWorkspace != null && typeof props.AdminWorkspace !== 'function' ? new Error('Admin workspace must be a component.') : null,
  checkoutService: (props) => props.checkoutService != null && typeof props.checkoutService.available !== 'boolean' ? new Error('Checkout service must declare availability.') : null,
};

const App = () => <Router><IdentityProvider><CartProvider><AppWorkspace /></CartProvider></IdentityProvider></Router>;

export default App;
