import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <section className="route-message" aria-labelledby="not-found-title">
    <p className="menu-helper">Page not found · 404</p>
    <h2 id="not-found-title">We couldn’t find that page</h2>
    <p>Check the address or return to your restaurant workspace.</p>
    <div className="container1">
      <Link className="button-link" to="/">Go to Menu</Link>
      <Link className="button-link button-secondary" to="/orders">View Orders</Link>
    </div>
  </section>
);

export default NotFoundPage;
