import { Link, useLocation } from "react-router-dom";

const AppHeader = () => {
  const { pathname } = useLocation();
  const menuActive = pathname === "/" || pathname === "/edit-menu" || pathname.startsWith("/restaurant/");
  const navigation = [
    { to: "/", label: "Menu", active: menuActive },
    { to: "/orders", label: "Orders", active: pathname === "/orders" },
    { to: "/profile", label: "Profile", active: pathname === "/profile" },
  ];

  return (
    <header className="main-header">
      <div className="layout-container header-inner">
        <div className="brand-group">
          <h1 className="brand-title">
            <Link to="/" className="brand" aria-label="KiloEats menu">
              <span className="brand-mark" aria-hidden="true">K</span>
              <span>KiloEats</span>
            </Link>
          </h1>
          <p className="workspace-label">Restaurant workspace</p>
        </div>
        <div className="header-navigation">
          <nav className="primary-nav" aria-label="Main navigation">
            {navigation.map(({ to, label, active }) => (
              <Link key={to} to={to} className="nav-link" aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <Link to="/login" className={`button-link button-secondary account-link${["/signup", "/login"].includes(pathname) ? " is-current" : ""}`} aria-current={pathname === "/login" ? "page" : undefined}>Log in</Link>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
