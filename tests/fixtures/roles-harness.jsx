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
import { addStudentOrderScenarios } from './student-order-scenarios.js';
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
const orderControl = { readMode: 'success', cancelMode: 'success', lookupMode: 'success', pending: [], requests: [], scenariosAdded: false };
const checkoutService = createDemoCheckoutService({ quoteLifetime: () => checkoutControl.quoteLifetime, before: async (operation, context) => {
  if (operation.startsWith('order-') || operation.startsWith('cancel-')) {
    const mode = operation.startsWith('order-') ? orderControl.readMode : operation === 'cancel-lookup' ? orderControl.lookupMode : orderControl.cancelMode;
    if (mode === 'deferred') await new Promise((resolve) => orderControl.pending.push(resolve));
    else await new Promise((resolve) => setTimeout(resolve, operation.startsWith('cancel') ? 350 : 150));
    if (mode === 'failure') {
      if (operation === 'cancel-before') return { outcome: 'rejected', code: 'FAILED' };
      throw new Error('Synthetic student order read failure');
    }
    if (mode === 'empty' && operation === 'order-list') return [];
    if (mode === 'malformed') return { malformed: true };
    if (mode === 'malformed-after' && operation === 'cancel-after') return { malformed: true };
    if (mode === 'uncertain-before' && operation === 'cancel-before') throw new Error('Synthetic cancellation outcome unknown before recording');
    if (mode === 'uncertain-after' && operation === 'cancel-after') throw new Error('Synthetic cancellation response lost after recording');
    if (mode === 'accept-first' && operation === 'cancel-before') {
      const latest = checkoutService.orders.find((order) => order.status === 'Pending' && order.reference === context.reference);
      if (latest) checkoutService.simulateOrderStatus(latest.reference, 'Accepted');
    }
    return;
  }
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
const student = (status, id = 'fixture-student') => ({ role: 'student', user: { id, name: id === 'fixture-student' ? 'Synthetic Student' : 'Other Synthetic Student', email: 'student@example.test', campusId: 'aau-4k' }, verification: { status, rejectionReason: status === 'rejected' ? 'Synthetic review reason: the sample enrollment date was unclear.' : '' } });
const records = {
  guest: { role: 'guest' },
  'not-submitted': student('not-submitted'), pending: student('pending'), verified: student('verified'), rejected: student('rejected'),
  'other-student': student('verified', 'other-fixture-student'),
  staff: { role: 'restaurant-staff', user: { id: 'fixture-staff', name: 'Synthetic Staff' }, restaurantId: 'fixture-restaurant-1', restaurantName: 'Fixture Merchant' },
  admin: { role: 'admin', user: { id: 'fixture-admin', name: 'Synthetic Admin' } },
  unknown: { role: 'unknown' },
};
orderControl.requests = checkoutService.requests;
orderControl.transition = (reference, status) => checkoutService.simulateOrderStatus(reference, status);
let scenarioTask;
orderControl.addScenarios = () => {
  if (scenarioTask) return scenarioTask;
  orderControl.scenariosAdded = true;
  scenarioTask = addStudentOrderScenarios(checkoutService, normalizeIdentity(records.verified), normalizeIdentity(records['other-student']));
  return scenarioTask;
};
fixture.studentOrders = orderControl;
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
  const [orderReference, setOrderReference] = useState('');
  const [creatingScenarios, setCreatingScenarios] = useState(false);
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
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <label htmlFor="fixture-order-reference">Order to simulate</label><input id="fixture-order-reference" value={orderReference} placeholder="DEMO-0001" onChange={(event) => setOrderReference(event.target.value)} style={{ width: '10rem', maxWidth: '100%' }} />
      {['Accepted', 'Ready', 'Delivered', 'Declined'].map((status) => <button key={status} onClick={() => { try { orderControl.transition(orderReference, status); setReviewHint(`Explicitly simulated ${status}. Use the application's read-only refresh to see it.`); } catch (error) { setReviewHint(error.message); } }}>{`Simulate ${status}`}</button>)}
      <button disabled={creatingScenarios || orderControl.scenariosAdded} onClick={async () => { setCreatingScenarios(true); try { await orderControl.addScenarios(); setReviewHint('Lifecycle examples created through the same checkout service. Open My demo orders; other-student sees only their own example.'); } catch (error) { setReviewHint(error.message); } finally { setCreatingScenarios(false); } }}>{creatingScenarios ? 'Creating lifecycle examples…' : 'Create lifecycle examples'}</button>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <label htmlFor="fixture-order-read">Order read fixture</label><select id="fixture-order-read" style={{ width: 'auto', maxWidth: '100%' }} defaultValue="success" onChange={(event) => { orderControl.readMode = event.target.value; }}>{['success', 'failure', 'empty', 'malformed', 'deferred'].map((mode) => <option key={mode}>{mode}</option>)}</select>
      <label htmlFor="fixture-cancel-mode">Cancellation fixture</label><select id="fixture-cancel-mode" style={{ width: 'auto', maxWidth: '100%' }} defaultValue="success" onChange={(event) => { orderControl.cancelMode = event.target.value; }}>{['success', 'failure', 'accept-first', 'uncertain-before', 'uncertain-after', 'malformed', 'malformed-after', 'deferred'].map((mode) => <option key={mode}>{mode}</option>)}</select>
      <label htmlFor="fixture-cancel-lookup">Cancellation lookup fixture</label><select id="fixture-cancel-lookup" style={{ width: 'auto', maxWidth: '100%' }} defaultValue="success" onChange={(event) => { orderControl.lookupMode = event.target.value; }}>{['success', 'failure', 'deferred'].map((mode) => <option key={mode}>{mode}</option>)}</select>
      <button onClick={() => { orderControl.pending.splice(0).forEach((resolve) => resolve()); setReviewHint('Released deferred order fixture work. No automatic status progression was added.'); }}>Release deferred order work</button>
    </div><p role="status" style={{ margin: '8px 0 0' }}>{reviewHint}</p>
  </aside>;
};
createRoot(document.getElementById('fixture-root')).render(<MemoryRouter initialEntries={['/browse?campus=aau-4k']}><IdentityProvider service={service} verificationService={verificationService}><CartProvider getStorage={getFixtureCartStorage} catalog={checkoutService.catalog}><Controls /><AppWorkspace AdminWorkspace={SyntheticAdminWorkspace} checkoutService={checkoutService} /></CartProvider></IdentityProvider></MemoryRouter>);
