import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AppWorkspace } from '../../src/App.jsx';
import IdentityProvider from '../../src/context/IdentityProvider.jsx';
import { useIdentity } from '../../src/context/IdentityContext.js';
import CartProvider from '../../src/context/CartProvider.jsx';
import { getFixtureCartStorage } from './cart-storage.js';
import { installRoleNetwork } from './role-network.js';
import AdminReviewDashboard from '../../src/components/admin/AdminReviewDashboard.jsx';
import { createDemoAdminReviewService } from './admin-review-service.js';
import { normalizeIdentity } from '../../src/utils/identity.js';
import { createDemoCheckoutService } from './checkout-service.js';
import '../../src/index.css';

// ISOLATED_ROLE_FIXTURE: no normal route imports this entry or its controls.
const fixture = { scenario: 'guest', outcome: 'success', verificationCalls: 0, pending: [], ...installRoleNetwork() };
window.__roleFixture = fixture;
const adminControl = { readMode: 'success', decisionMode: 'success', pending: [] };
const adminService = createDemoAdminReviewService({ before: async (operation) => {
  if (operation === 'list') {
    if (adminControl.readMode === 'failure') throw new Error('Synthetic review read failure');
    if (adminControl.readMode === 'deferred') await new Promise((resolve) => adminControl.pending.push(resolve));
    else await new Promise((resolve) => setTimeout(resolve, 100));
    if (adminControl.readMode === 'empty') return { students: [], restaurants: [], memberships: [], reviews: [] };
  } else {
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (adminControl.decisionMode === 'failure') throw new Error('Synthetic review decision failure');
  }
} });
const otherReviewer = normalizeIdentity({ role: 'admin', user: { id: 'other-fixture-admin', name: 'Synthetic Competing Reviewer' } });
adminControl.requests = adminService.requests;
adminControl.compete = async (id = 'attempt-b1') => {
  const snapshot = await adminService.list(otherReviewer);
  const target = snapshot.students.find((entry) => entry.id === id);
  return adminService.decide(otherReviewer, { kind: 'student', id, version: target.version, decision: 'approved' });
};
adminControl.resubmit = () => adminService.submitSyntheticAttempt(normalizeIdentity({ role: 'student', user: { id: 'review-student-a', campusId: 'aau-4k' }, verification: { status: 'rejected' } }), 'review-student-a');
fixture.admin = adminControl;
const checkoutControl = { readMode: 'success', quoteMode: 'success', submitMode: 'success', lookupMode: 'success', quoteLifetime: 60000, delay: 120, pending: [] };
const checkoutService = createDemoCheckoutService({ quoteLifetime: () => checkoutControl.quoteLifetime, before: async (operation) => {
  const mode = operation === 'dropoffs' || operation === 'catalog' ? checkoutControl.readMode : operation === 'quote' ? checkoutControl.quoteMode : operation === 'lookup' ? checkoutControl.lookupMode : checkoutControl.submitMode;
  if (mode === 'deferred') await new Promise((resolve) => checkoutControl.pending.push(resolve));
  else await new Promise((resolve) => setTimeout(resolve, operation.startsWith('submit') ? Math.max(350, checkoutControl.delay) : checkoutControl.delay));
  if (mode === 'failure') {
    if (operation === 'submit-before') return { outcome: 'rejected' };
    throw new Error('Synthetic checkout fixture failure');
  }
  if (mode === 'malformed') return { malformed: true };
  if (mode === 'empty' && operation === 'dropoffs') return [];
  if (mode === 'uncertain-before' && operation === 'submit-before') throw new Error('Synthetic uncertain request outcome');
  if (mode === 'uncertain-after' && operation === 'submit-after') throw new Error('Synthetic response lost after recording');
} });
checkoutControl.requests = checkoutService.requests;
checkoutControl.orders = checkoutService.orders;
checkoutControl.reprice = () => { checkoutService.catalog[0].items[0].price += 10; };
checkoutControl.unavailable = () => { checkoutService.catalog[0].items[0].available = false; };
fixture.checkout = checkoutControl;
export const SyntheticAdminWorkspace = () => <AdminReviewDashboard service={adminService} />;
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
  const [reviewHint, setReviewHint] = useState('');
  return <aside className="role-test-controls" style={{ background: '#24332f', color: 'white', padding: 16 }}>
    <strong>ISOLATED ROLE TEST — synthetic identities, verification and merchant data. No live requests.</strong>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <label htmlFor="fixture-role">Test identity</label><select id="fixture-role" style={{ width: 'auto', maxWidth: '100%' }} value={fixture.scenario} onChange={(event) => { fixture.scenario = event.target.value; reload(); }}>{[...Object.keys(records), 'loading', 'failure'].map((key) => <option key={key} value={key}>{key}</option>)}</select>
      <label htmlFor="fixture-path">Direct test URL</label><input ref={pathRef} id="fixture-path" defaultValue="/account" style={{ width: '14rem', maxWidth: '100%' }} /><button onClick={() => navigate(pathRef.current.value)}>Open test URL</button>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <label htmlFor="fixture-review-read">Admin read fixture</label><select id="fixture-review-read" style={{ width: 'auto', maxWidth: '100%' }} value={adminControl.readMode} onChange={(event) => { adminControl.readMode = event.target.value; setReviewHint('Read mode changed; use Refresh reviews.'); }}>{['success', 'empty', 'failure', 'deferred'].map((mode) => <option key={mode}>{mode}</option>)}</select>
      <label htmlFor="fixture-review-decision">Decision fixture</label><select id="fixture-review-decision" style={{ width: 'auto', maxWidth: '100%' }} value={adminControl.decisionMode} onChange={(event) => { adminControl.decisionMode = event.target.value; setReviewHint('Decision mode changed.'); }}>{['success', 'failure'].map((mode) => <option key={mode}>{mode}</option>)}</select>
      <button onClick={async () => { try { await adminControl.resubmit(); setReviewHint('New synthetic applicant attempt added. Refresh the review list.'); } catch (error) { setReviewHint(error.message); } }}>Add synthetic applicant resubmission</button>
      <button onClick={async () => { try { await adminControl.compete(); setReviewHint('Another synthetic reviewer decided Student B. Refresh the list.'); } catch (error) { setReviewHint(error.message); } }}>Simulate competing student review</button>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <label htmlFor="fixture-checkout-outcome">Checkout fixture</label><select id="fixture-checkout-outcome" style={{ width: 'auto', maxWidth: '100%' }} defaultValue="success" onChange={(event) => { checkoutControl.submitMode = event.target.value; }}>{['success', 'failure', 'uncertain-before', 'uncertain-after', 'malformed', 'deferred'].map((mode) => <option key={mode}>{mode}</option>)}</select>
      <button onClick={() => { checkoutControl.reprice(); setReviewHint('Synthetic shiro price changed. Checkout must recheck and require review.'); }}>Reprice synthetic shiro</button>
      <button onClick={() => { checkoutControl.unavailable(); setReviewHint('Synthetic shiro made unavailable. Checkout must recheck.'); }}>Make synthetic shiro unavailable</button>
    </div><p role="status" style={{ margin: '8px 0 0' }}>{reviewHint}</p>
  </aside>;
};
createRoot(document.getElementById('fixture-root')).render(<MemoryRouter initialEntries={['/browse?campus=aau-4k']}><IdentityProvider service={service} verificationService={verificationService}><CartProvider getStorage={getFixtureCartStorage} catalog={checkoutService.catalog}><Controls /><AppWorkspace AdminWorkspace={SyntheticAdminWorkspace} checkoutService={checkoutService} /></CartProvider></IdentityProvider></MemoryRouter>);
