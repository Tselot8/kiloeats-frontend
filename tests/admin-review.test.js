import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeIdentity, GUEST_IDENTITY } from '../src/utils/identity.js';
import { ADMIN_REVIEW_SERVICE, decideAdminReview, loadAdminReviews, validateDecision, validateReviewSnapshot } from '../src/utils/adminReview.js';
import { createDemoAdminReviewService, createReviewSeed } from './fixtures/admin-review-service.js';

const admin = normalizeIdentity({ role: 'admin', user: { id: 'fixture-admin', name: 'Synthetic Admin' } });
const other = normalizeIdentity({ role: 'admin', user: { id: 'other-admin', name: 'Other Synthetic Admin' } });
const student = normalizeIdentity({ role: 'student', user: { id: 'review-student-a', campusId: 'aau-4k' }, verification: { status: 'rejected' } });
const staff = normalizeIdentity({ role: 'restaurant-staff', user: { id: 'staff' }, restaurantId: 'application-alpha' });
const command = (overrides = {}) => ({ kind: 'student', id: 'attempt-a2', version: 1, decision: 'approved', ...overrides });

test('normal review service is inactive and non-admin reads/decisions never invoke an adapter', async () => {
  assert.equal(ADMIN_REVIEW_SERVICE.available, false);
  let calls = 0;
  const spy = { available: true, synthetic: true, list() { calls++; }, decide() { calls++; } };
  for (const identity of [GUEST_IDENTITY, student, staff, { status: 'loading' }, { status: 'unavailable' }]) {
    await assert.rejects(loadAdminReviews(spy, identity), /admin identity/);
    await assert.rejects(decideAdminReview(spy, identity, command()), /admin identity/);
  }
  assert.equal(calls, 0);
  await assert.rejects(loadAdminReviews(ADMIN_REVIEW_SERVICE, admin), /No active/);
  await assert.rejects(loadAdminReviews({ ...spy, synthetic: false }, admin), /No active/);
});

test('read snapshots distinguish empty data from failures and malformed responses', async () => {
  const empty = { students: [], restaurants: [], memberships: [], reviews: [] };
  assert.deepEqual(await loadAdminReviews(createDemoAdminReviewService({ seed: empty }), admin), empty);
  for (const value of [{}, [], { ...empty, students: [{}] }, { ...createReviewSeed(), reviews: [{}] }]) assert.throws(() => validateReviewSnapshot(value), /unreadable/);
  const failing = createDemoAdminReviewService({ before() { throw new Error('Synthetic failure'); } });
  await assert.rejects(loadAdminReviews(failing, admin), /Synthetic failure/);
});

test('rejection requires a useful description; decisions whitelist fields and require a version', () => {
  for (const reason of ['', ' ', 'no', '123456789']) assert.throws(() => validateDecision(command({ decision: 'rejected', reason })), /at least 10/);
  assert.equal(validateDecision(command({ decision: 'rejected', reason: '  Clarify this synthetic example.  ' })).reason, 'Clarify this synthetic example.');
  assert.equal(Object.hasOwn(validateDecision(command({ reviewerId: 'forged', status: 'approved' })), 'reviewerId'), false);
  assert.throws(() => validateDecision(command({ version: 0 })), /Reload/);
});

test('approval/rejection records the current synthetic reviewer and decision time without altering prior records', async () => {
  const service = createDemoAdminReviewService({ now: () => '2026-11-13T15:00:00Z' });
  const before = await service.list(admin);
  const after = await decideAdminReview(service, admin, command({ reviewerId: 'forged' }));
  assert.equal(after.students.find((entry) => entry.id === 'attempt-a2').status, 'approved');
  assert.equal(after.students.find((entry) => entry.id === 'attempt-a2').version, 2);
  assert.deepEqual(after.reviews.slice(0, before.reviews.length), before.reviews);
  assert.equal(after.reviews.at(-1).reviewerId, admin.user.id);
  assert.equal(after.reviews.at(-1).decidedAt, '2026-11-13T15:00:00Z');
  const rejected = await service.decide(admin, command({ id: 'attempt-b1', decision: 'rejected', reason: 'Explain the fictional example more clearly.' }));
  assert.match(rejected.reviews.at(-1).reason, /fictional example/);
});

test('duplicate pending and stale/already-reviewed decisions cannot overwrite a decision', async () => {
  let release;
  const service = createDemoAdminReviewService({ before: (operation) => operation === 'decide' ? new Promise((resolve) => { release = resolve; }) : undefined });
  const first = service.decide(admin, command());
  await assert.rejects(service.decide(admin, command()), (error) => error.code === 'BUSY');
  release(); await first;
  await assert.rejects(service.decide(other, command()), (error) => error.code === 'STALE');
  const snapshot = await service.list(admin);
  assert.equal(snapshot.reviews.filter((review) => review.targetId === 'attempt-a2').length, 1);
});

test('an action failure keeps the pending request unchanged and does not automatically repeat it', async () => {
  let writes = 0;
  const service = createDemoAdminReviewService({ before: (operation) => { if (operation === 'decide') { writes++; throw new Error('Simulated failure'); } } });
  await assert.rejects(service.decide(admin, command()), /Simulated failure/);
  assert.equal(writes, 1);
  const snapshot = await service.list(admin);
  assert.equal(snapshot.students.find((entry) => entry.id === 'attempt-a2').status, 'pending');
  assert.equal(snapshot.reviews.filter((review) => review.targetId === 'attempt-a2').length, 0);
});

test('resubmission creates a new pending attempt and preserves prior rejection/decision history', async () => {
  const service = createDemoAdminReviewService();
  await service.decide(admin, command({ decision: 'rejected', reason: 'Clarify the fictional second attempt.' }));
  const before = await service.list(admin);
  const after = await service.submitSyntheticAttempt(student, student.user.id);
  const latest = after.students.at(-1);
  assert.equal(latest.attempt, 3); assert.equal(latest.previousAttemptId, 'attempt-a2'); assert.equal(latest.status, 'pending');
  assert.deepEqual(after.students.slice(0, before.students.length), before.students);
  assert.deepEqual(after.reviews, before.reviews);
  await assert.rejects(service.submitSyntheticAttempt(student, student.user.id), /new example requires/i);
  await assert.rejects(service.submitSyntheticAttempt(staff, student.user.id), /matching synthetic student/);
});

test('restaurant approval and staff assignment remain separate, restaurant-specific decisions', async () => {
  const service = createDemoAdminReviewService();
  const member = { kind: 'membership', id: 'membership-alpha', version: 1, decision: 'approved', restaurantId: 'application-alpha' };
  await assert.rejects(service.decide(admin, member), /Approve the restaurant application first/);
  await service.decide(admin, { kind: 'restaurant', id: 'application-alpha', version: 1, decision: 'approved' });
  assert.equal((await service.list(admin)).memberships[0].status, 'pending');
  await assert.rejects(service.decide(admin, { ...member, restaurantId: 'application-beta' }), /requested restaurant/);
  await assert.rejects(service.decide(admin, { ...member, restaurantId: '' }), /Explicitly choose/);
  const snapshot = await service.decide(admin, member);
  assert.equal(snapshot.memberships[0].assignedRestaurantId, 'application-alpha');
  assert.equal(snapshot.memberships[0].assignedStaffId, 'staff-alpha');
  assert.equal(snapshot.reviews.at(-1).restaurantId, 'application-alpha');
});

test('applicants cannot approve their own student submission, restaurant, or staff access even with admin-shaped identity', async () => {
  const service = createDemoAdminReviewService();
  for (const [userId, input] of [
    ['review-student-a', command()],
    ['applicant-alpha', { kind: 'restaurant', id: 'application-alpha', version: 1, decision: 'approved' }],
    ['fixture-admin', { kind: 'membership', id: 'membership-self', version: 1, decision: 'approved', restaurantId: 'application-beta' }],
  ]) {
    const actor = normalizeIdentity({ role: 'admin', user: { id: userId } });
    await assert.rejects(service.decide(actor, input), (error) => error.code === 'SELF_REVIEW');
  }
});

test('in-memory snapshots cannot be mutated by callers; reads honour cancellation', async () => {
  const service = createDemoAdminReviewService();
  const snapshot = await service.list(admin); snapshot.students[0].status = 'pending'; snapshot.reviews.length = 0;
  assert.equal((await service.list(admin)).students[0].status, 'rejected');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service.list(admin, { signal: controller.signal }), { name: 'AbortError' });
  assert.ok((await service.list(admin)).reviews.length > 0);
});
