import { Link, useMatch } from "react-router-dom";

const AppHeader = () => {
  const home = useMatch("/");
  const editMenu = useMatch("/edit-menu");
  const restaurant = useMatch("/restaurant/:restaurantId");
  const orders = useMatch("/orders");
  const profile = useMatch("/profile");
  const login = useMatch("/login");
  const signup = useMatch("/signup");
  const navigation = [
    { to: "/", label: "Menu", active: home || editMenu || restaurant },
    { to: "/orders", label: "Orders", active: orders },
    { to: "/profile", label: "Profile", active: profile },
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
          <Link to="/login" className={`button-link button-secondary account-link${signup || login ? " is-current" : ""}`} aria-current={login ? "page" : undefined}>Log in</Link>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
