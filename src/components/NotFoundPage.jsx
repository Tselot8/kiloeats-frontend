import { Link } from "react-router-dom";
import { useIdentity } from '../context/IdentityContext.js';
import { accessDecision } from '../utils/identity.js';

const NotFoundPage = () => {
  const { identity } = useIdentity();
  const staff = accessDecision('merchant', identity) === 'allowed';
  return (
  <section className="route-message" aria-labelledby="not-found-title">
    <p className="menu-helper">Page not found · 404</p>
    <h2 id="not-found-title">We couldn’t find that page</h2>
    <p>Check the address or return to your restaurant workspace.</p>
    <div className="container1">
      <Link className="button-link" to={staff ? '/' : '/browse'}>{staff ? 'Go to Menu' : 'Browse restaurants'}</Link>
      <Link className="button-link button-secondary" to={staff ? '/orders' : '/cart'}>{staff ? 'View Orders' : 'View demo cart'}</Link>
    </div>
  </section>
);
};

export default NotFoundPage;
