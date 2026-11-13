import { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AppWorkspace } from '../../src/App.jsx';
import IdentityProvider from '../../src/context/IdentityProvider.jsx';
import { useIdentity } from '../../src/context/IdentityContext.js';
import CartProvider from '../../src/context/CartProvider.jsx';
import { getFixtureCartStorage } from './cart-storage.js';
import { installRoleNetwork } from './role-network.js';
import '../../src/index.css';

// ISOLATED_ROLE_FIXTURE: no normal route imports this entry or its controls.
const fixture = { scenario: 'guest', outcome: 'success', verificationCalls: 0, pending: [], ...installRoleNetwork() };
window.__roleFixture = fixture;
const student = (status) => ({ role: 'student', user: { id: 'fixture-student', name: 'Synthetic Student', email: 'student@example.test', campusId: 'aau-4k' }, verification: { status, rejectionReason: status === 'rejected' ? 'Synthetic review reason: the sample enrollment date was unclear.' : '' } });
const records = {
  guest: { role: 'guest' },
  'not-submitted': student('not-submitted'), pending: student('pending'), verified: student('verified'), rejected: student('rejected'),
  staff: { role: 'restaurant-staff', user: { id: 'fixture-staff', name: 'Synthetic Staff' }, restaurantId: 'fixture-restaurant-1', restaurantName: 'Fixture Merchant' },
  admin: { role: 'admin', user: { id: 'fixture-admin', name: 'Synthetic Admin' } },
  unknown: { role: 'unknown' },
};
const service = { async read() {
  if (fixture.scenario === 'loading') return new Promise((resolve) => fixture.pending.push(resolve));
  if (fixture.scenario === 'failure') throw new Error('Synthetic identity read failure');
  return structuredClone(records[fixture.scenario]);
} };
const verificationService = { available: true, synthetic: true, async submitExample() {
  fixture.verificationCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 350));
  if (fixture.outcome === 'failure') throw new Error('Synthetic verification failure');
  fixture.scenario = 'pending';
} };

export const Controls = () => {
  const { reload } = useIdentity();
  const navigate = useNavigate();
  const pathRef = useRef(null);
  return <aside className="role-test-controls" style={{ background: '#24332f', color: 'white', padding: 16 }}>
    <strong>ISOLATED ROLE TEST — synthetic identities, verification and merchant data. No live requests.</strong>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <label htmlFor="fixture-role">Test identity</label><select id="fixture-role" style={{ width: 'auto', maxWidth: '100%' }} value={fixture.scenario} onChange={(event) => { fixture.scenario = event.target.value; reload(); }}>{[...Object.keys(records), 'loading', 'failure'].map((key) => <option key={key} value={key}>{key}</option>)}</select>
      <label htmlFor="fixture-path">Direct test URL</label><input ref={pathRef} id="fixture-path" defaultValue="/account" style={{ width: '14rem', maxWidth: '100%' }} /><button onClick={() => navigate(pathRef.current.value)}>Open test URL</button>
    </div>
  </aside>;
};
createRoot(document.getElementById('fixture-root')).render(<MemoryRouter initialEntries={['/browse?campus=aau-4k']}><IdentityProvider service={service} verificationService={verificationService}><CartProvider getStorage={getFixtureCartStorage}><Controls /><AppWorkspace /></CartProvider></IdentityProvider></MemoryRouter>);
