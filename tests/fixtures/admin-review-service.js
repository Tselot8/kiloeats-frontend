import { accessDecision } from '../../src/utils/identity.js';
import { requireAdmin, ReviewError, targetCollection, validateDecision, validateReviewSnapshot } from '../../src/utils/adminReview.js';

// SYNTHETIC_EVIDENCE_M11: this module is imported only by the isolated role
// harness and Node tests. No real people, partners, ID images or evidence.
const evidence = (description) => ({ title: 'FICTIONAL EVIDENCE — NOT A REAL STUDENT ID', description });
export const createReviewSeed = () => ({
  students: [
    { id: 'attempt-a1', studentId: 'review-student-a', studentName: 'Fictional Student A', campusId: 'aau-4k', submittedAt: '2026-11-01T09:00:00Z', status: 'rejected', version: 2, attempt: 1, evidence: evidence('First fictional example. No enrollment claim can be established from this placeholder.') },
    { id: 'attempt-a2', studentId: 'review-student-a', studentName: 'Fictional Student A', campusId: 'aau-4k', submittedAt: '2026-11-03T10:00:00Z', status: 'pending', version: 1, attempt: 2, previousAttemptId: 'attempt-a1', evidence: evidence('Revised fictional example for testing a new review attempt. There is no real document.') },
    { id: 'attempt-b1', studentId: 'review-student-b', studentName: 'Fictional Student B', campusId: 'yared-music-school', submittedAt: '2026-11-04T11:00:00Z', status: 'pending', version: 1, attempt: 1, evidence: evidence('A synthetic review scenario for the music-school campus.') },
    { id: 'attempt-c1', studentId: 'review-student-c', studentName: 'Fictional Student C', campusId: 'aau-6k', submittedAt: '2026-11-02T12:00:00Z', status: 'approved', version: 2, attempt: 1, evidence: evidence('A previously approved fictional example, retained for decision-history tests.') },
    { id: 'attempt-d1', studentId: 'review-student-d', studentName: 'Fictional Student D', campusId: 'aau-5k', submittedAt: '2026-11-05T13:00:00Z', status: 'pending', version: 1, attempt: 1, evidence: evidence('A synthetic application for the AAU 5K campus.') },
  ],
  restaurants: [
    { id: 'application-alpha', name: 'Fictional Alpha Kitchen', applicantId: 'applicant-alpha', campusIds: ['aau-4k', 'aau-5k'], submittedAt: '2026-11-03T08:00:00Z', status: 'pending', version: 1 },
    { id: 'application-beta', name: 'Fictional Beta Café', applicantId: 'applicant-beta', campusIds: ['aau-6k', 'yared-music-school'], submittedAt: '2026-11-01T08:00:00Z', status: 'approved', version: 2 },
  ],
  memberships: [
    { id: 'membership-alpha', staffId: 'staff-alpha', staffName: 'Fictional Staff Alpha', restaurantId: 'application-alpha', requestedBy: 'applicant-alpha', submittedAt: '2026-11-03T08:30:00Z', status: 'pending', version: 1 },
    { id: 'membership-beta', staffId: 'staff-beta', staffName: 'Fictional Staff Beta', restaurantId: 'application-beta', requestedBy: 'applicant-beta', submittedAt: '2026-11-03T09:00:00Z', status: 'pending', version: 1 },
    { id: 'membership-self', staffId: 'fixture-admin', staffName: 'Synthetic Admin (self-request example)', restaurantId: 'application-beta', requestedBy: 'fixture-admin', submittedAt: '2026-11-04T09:00:00Z', status: 'pending', version: 1 },
  ],
  reviews: [
    { id: 'seed-review-a1', kind: 'student', targetId: 'attempt-a1', decision: 'rejected', reason: 'Synthetic reason: clarify the fictional enrollment example.', reviewerId: 'past-synthetic-admin', reviewerName: 'Past Synthetic Reviewer', decidedAt: '2026-11-02T09:00:00Z' },
    { id: 'seed-review-c1', kind: 'student', targetId: 'attempt-c1', decision: 'approved', reason: '', reviewerId: 'past-synthetic-admin', reviewerName: 'Past Synthetic Reviewer', decidedAt: '2026-11-03T09:00:00Z' },
    { id: 'seed-review-beta', kind: 'restaurant', targetId: 'application-beta', decision: 'approved', reason: '', reviewerId: 'past-synthetic-admin', reviewerName: 'Past Synthetic Reviewer', decidedAt: '2026-11-02T08:00:00Z' },
  ],
});

export const createDemoAdminReviewService = ({ seed = createReviewSeed(), before = async () => {}, now = () => new Date().toISOString() } = {}) => {
  let model = structuredClone(validateReviewSnapshot(seed));
  let sequence = 0;
  const locks = new Set();
  const requests = [];
  const check = (identity, command) => {
    requireAdmin(identity);
    const target = model[targetCollection(command.kind)].find((entry) => entry.id === command.id);
    if (!target) throw new ReviewError('STALE', 'This request is no longer listed. Refresh the review data.');
    if (target.status !== 'pending' || target.version !== command.version) throw new ReviewError('STALE', 'This request has changed or already been reviewed. Refresh before making another decision.');
    if ([target.studentId, target.applicantId, target.staffId, target.requestedBy].includes(identity.user.id)) throw new ReviewError('SELF_REVIEW', 'An applicant cannot review their own submission or grant themselves restaurant access.');
    if (command.kind === 'membership' && command.decision === 'approved') {
      if (command.restaurantId !== target.restaurantId) throw new ReviewError('ASSIGNMENT', 'This membership can only be assigned to its requested restaurant.');
      if (model.restaurants.find((entry) => entry.id === target.restaurantId)?.status !== 'approved') throw new ReviewError('ASSIGNMENT', 'Approve the restaurant application first. Staff membership is a separate decision.');
    }
    return target;
  };
  return {
    available: true, synthetic: true, requests,
    async list(identity, { signal } = {}) {
      requireAdmin(identity); signal?.throwIfAborted(); requests.push({ operation: 'list', reviewerId: identity.user.id });
      const override = await before('list'); signal?.throwIfAborted();
      return structuredClone(override || model);
    },
    async decide(identity, input) {
      requireAdmin(identity);
      const command = validateDecision(input);
      check(identity, command);
      const key = `${command.kind}:${command.id}`;
      if (locks.has(key)) throw new ReviewError('BUSY', 'A decision for this request is already pending.');
      locks.add(key); requests.push({ operation: 'decide', kind: command.kind, id: command.id, reviewerId: identity.user.id });
      try {
        await before('decide');
        const target = check(identity, command);
        const decidedAt = now();
        const review = { id: `demo-review-${++sequence}`, kind: command.kind, targetId: target.id, decision: command.decision, reason: command.reason,
          reviewerId: identity.user.id, reviewerName: identity.user.name || 'Synthetic reviewer', decidedAt,
          ...(command.kind === 'membership' && command.decision === 'approved' ? { staffId: target.staffId, restaurantId: target.restaurantId } : {}) };
        const collection = targetCollection(command.kind);
        model = { ...model, [collection]: model[collection].map((entry) => entry.id === target.id ? { ...entry, status: command.decision, version: entry.version + 1,
          ...(command.kind === 'membership' && command.decision === 'approved' ? { assignedRestaurantId: target.restaurantId, assignedStaffId: target.staffId } : {}) } : entry), reviews: [...model.reviews, review] };
        return structuredClone(model);
      } finally { locks.delete(key); }
    },
    async submitSyntheticAttempt(identity, studentId) {
      if (accessDecision('student', identity) !== 'allowed' || identity.user.id !== studentId) throw new ReviewError('FORBIDDEN', 'Only the matching synthetic student can submit a new example.');
      const attempts = model.students.filter((entry) => entry.studentId === studentId).sort((a, b) => a.attempt - b.attempt);
      const previous = attempts.at(-1);
      if (!previous || previous.status !== 'rejected') throw new ReviewError('STALE', 'A new example requires a rejected prior attempt and no pending review.');
      const key = `submission:${studentId}`;
      if (locks.has(key)) throw new ReviewError('BUSY', 'A synthetic resubmission is already pending.');
      locks.add(key);
      try {
        await before('resubmit');
        const latest = model.students.filter((entry) => entry.studentId === studentId).at(-1);
        if (latest.id !== previous.id || latest.status !== 'rejected') throw new ReviewError('STALE', 'This student already has a newer review attempt.');
        const attempt = { ...previous, id: `demo-resubmission-${++sequence}`, attempt: previous.attempt + 1, previousAttemptId: previous.id,
          submittedAt: now(), status: 'pending', version: 1, evidence: evidence('A new fictional applicant example. Prior review attempts and decisions are retained unchanged.') };
        model = { ...model, students: [...model.students, attempt] };
        return structuredClone(model);
      } finally { locks.delete(key); }
    },
  };
};
