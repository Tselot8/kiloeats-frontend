import { Link, useMatch, useSearchParams } from "react-router-dom";
import { browsePath } from "../utils/studentBrowsing.js";
import { useCart } from "../context/CartContext.js";
import { useIdentity } from "../context/IdentityContext.js";
import { accessDecision } from "../utils/identity.js";

const AppHeader = () => {
  const home = useMatch("/");
  const editMenu = useMatch("/edit-menu");
  const restaurant = useMatch("/restaurant/:restaurantId");
  const orders = useMatch("/orders");
  const profile = useMatch("/profile");
  const login = useMatch("/login");
  const signup = useMatch("/signup");
  const browsing = useMatch("/browse");
  const cartRoute = useMatch("/cart");
  const accountRoute = useMatch("/account");
  const adminRoute = useMatch("/admin");
  const { identity } = useIdentity();
  const staff = accessDecision('merchant', identity) === 'allowed';
  const student = accessDecision('student', identity) === 'allowed';
  const admin = accessDecision('admin', identity) === 'allowed';
  const { cart, context, totals } = useCart();
  const [params] = useSearchParams();
  const campusId = cartRoute ? cart?.campusId || context?.campusId || params.get("campus") : params.get("campus");
  const browseLink = browsePath(campusId);
  const cartCampus = cart?.campusId || campusId;
  const cartLink = `/cart${browsePath(cartCampus).includes('?') ? `?campus=${encodeURIComponent(cartCampus)}` : ''}`;
  const navigation = [
    { to: browseLink, label: "Browse restaurants", active: browsing || restaurant },
    { to: cartLink, label: `Cart (${totals.quantity})`, active: cartRoute, isCart: true },
    ...(staff ? [{ to: "/", label: "Menu", active: home || editMenu }, { to: "/orders", label: "Orders", active: orders }, { to: "/profile", label: "Profile", active: profile }] : []),
    ...(student ? [{ to: '/account', label: 'Account & verification', active: accountRoute }] : []),
    ...(admin ? [{ to: '/admin', label: 'Admin', active: adminRoute }] : []),
    ...(identity.role === 'guest' ? [{ to: '/signup', label: 'Student signup', active: signup }] : []),
  ];

  return (
    <header className="main-header">
      <div className="layout-container header-inner">
        <div className="brand-group">
          <h1 className="brand-title">
            <Link to={staff ? '/' : admin ? '/admin' : browseLink} className="brand" aria-label={staff ? 'KiloEats menu' : admin ? 'KiloEats admin' : 'KiloEats restaurant browsing'}>
              <span className="brand-mark" aria-hidden="true">K</span>
              <span>KiloEats</span>
            </Link>
          </h1>
          <p className="workspace-label">{identity.status === 'loading' ? 'Checking identity…' : staff ? 'Restaurant workspace' : student ? 'Student workspace' : admin ? 'Admin workspace' : identity.status === 'unavailable' ? 'Identity unavailable' : 'Guest browsing'}</p>
          {staff && <p className="identity-assignment">Assigned: {identity.restaurantName || identity.restaurantId}</p>}
        </div>
        <div className="header-navigation">
          <nav className={`primary-nav identity-nav identity-nav-${staff ? 'staff' : 'other'}`} aria-label="Main navigation">
            {navigation.map(({ to, label, active, isCart }) => (
              <Link key={isCart ? 'cart' : to} to={to} className={`nav-link${isCart ? ' cart-link' : ''}`} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <Link to="/login" className={`button-link button-secondary account-link${signup || login ? " is-current" : ""}`} aria-current={login ? "page" : undefined}>{identity.role === 'guest' || identity.status !== 'ready' ? 'Log in' : 'Shared login'}</Link>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
