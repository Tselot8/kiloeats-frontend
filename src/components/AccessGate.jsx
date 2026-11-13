import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIdentity } from '../context/IdentityContext.js';
import { accessDecision, safeReturnPath } from '../utils/identity.js';

const AccessGate = ({ area, children }) => {
  const { identity, reload } = useIdentity();
  const location = useLocation();
  const decision = accessDecision(area, identity);
  const wrapper = useRef(null);
  const hadFocus = useRef(false);
  useEffect(() => {
    const heading = wrapper.current?.querySelector('h2');
    if (heading) document.title = `${heading.textContent} | KiloEats`;
    if (decision !== 'loading' && hadFocus.current && document.activeElement === document.body) {
      heading?.setAttribute('tabindex', '-1'); heading?.focus();
    }
  }, [decision]);
  const returnTo = safeReturnPath(location.pathname + location.search);
  return <div ref={wrapper} onFocusCapture={() => { hadFocus.current = true; }}>
    {decision === 'allowed' ? children : <section className="route-message access-state" aria-labelledby="access-title">
      <h2 id="access-title">{decision === 'loading' ? 'Checking access' : decision === 'login-required' ? 'Log in required' : decision === 'unavailable' ? 'Identity unavailable' : 'Access denied'}</h2>
      {decision === 'loading' ? <p role="status">Checking the current identity…</p>
        : decision === 'unavailable' ? <><p role="alert">Your identity could not be determined. This workspace has not been opened.</p><button className="button-secondary" onClick={reload}>Retry identity check</button></>
          : decision === 'login-required' ? <><p>This area requires a {area === 'merchant' ? 'platform-provisioned restaurant staff' : area === 'admin' ? 'platform-provisioned admin' : 'student'} identity. Live sign-in is not connected yet.</p><p>You can continue browsing and preparing your demo cart.</p><Link className="button-link" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Go to shared login</Link></>
            : <p>This identity does not have access to the {area === 'merchant' ? 'restaurant workspace' : area === 'admin' ? 'admin area' : 'student account'}. Public signup cannot grant restaurant or admin access.</p>}
      {decision !== 'loading' && <div className="container1 access-recovery"><Link className="button-link button-secondary" to="/browse">Browse restaurants</Link><Link className="button-link button-secondary" to="/cart">View demo cart</Link>{identity.role === 'student' && <Link className="button-link button-secondary" to="/account">Student account</Link>}</div>}
    </section>}
  </div>;
};
AccessGate.propTypes = {
  area: (props) => typeof props.area !== 'string' ? new Error('AccessGate requires an area.') : null,
  children: (props) => props.children == null ? new Error('AccessGate requires content.') : null,
};
export default AccessGate;
