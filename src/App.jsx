import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import "./studentBrowsing.css";
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

const App = () => (
  <Router>
    <RouteFocus />
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AppHeader />
      <main id="main-content" className="layout-container app-main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/edit-menu" element={<EditMenuPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/browse" element={<StudentBrowsePage />} />
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
  </Router>
);

export default App;
