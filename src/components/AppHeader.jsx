import { Link, useMatch, useSearchParams } from "react-router-dom";
import { browsePath } from "../utils/studentBrowsing.js";

const AppHeader = () => {
  const home = useMatch("/");
  const editMenu = useMatch("/edit-menu");
  const restaurant = useMatch("/restaurant/:restaurantId");
  const orders = useMatch("/orders");
  const profile = useMatch("/profile");
  const login = useMatch("/login");
  const signup = useMatch("/signup");
  const browsing = useMatch("/browse");
  const [params] = useSearchParams();
  const studentView = Boolean(browsing || restaurant);
  const browseLink = browsePath(params.get("campus"));
  const navigation = [
    { to: browseLink, label: "Browse restaurants", active: studentView },
    { to: "/", label: "Menu", active: home || editMenu },
    { to: "/orders", label: "Orders", active: orders },
    { to: "/profile", label: "Profile", active: profile },
  ];

  return (
    <header className="main-header">
      <div className="layout-container header-inner">
        <div className="brand-group">
          <h1 className="brand-title">
            <Link to={studentView ? browseLink : "/"} className="brand" aria-label={studentView ? "KiloEats restaurant browsing" : "KiloEats menu"}>
              <span className="brand-mark" aria-hidden="true">K</span>
              <span>KiloEats</span>
            </Link>
          </h1>
          <p className="workspace-label">{studentView ? "Student browsing · Demo" : "Restaurant workspace"}</p>
        </div>
        <div className="header-navigation">
          <nav className="primary-nav" aria-label="Main navigation">
            {navigation.map(({ to, label, active }) => (
              <Link key={to} to={to} className="nav-link" aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <Link to="/login" className={`button-link button-secondary account-link${signup || login ? " is-current" : ""}`} aria-current={login ? "page" : undefined}>Log in</Link>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
