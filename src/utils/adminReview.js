import { accessDecision } from './identity.js';
import { findCampus } from './studentBrowsing.js';

export const ADMIN_REVIEW_SERVICE = Object.freeze({ available: false });
export const REVIEW_KINDS = Object.freeze(['student', 'restaurant', 'membership']);
const statuses = ['pending', 'approved', 'rejected'];
const id = (value) => typeof value === 'string' && value.trim().length > 0;
const date = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));

export class ReviewError extends Error {
  constructor(code, message) { super(message); this.name = 'ReviewError'; this.code = code; }
}

export const requireAdmin = (identity) => {
  if (accessDecision('admin', identity) !== 'allowed') throw new ReviewError('FORBIDDEN', 'An admin identity is required for review operations.');
};

export const validateDecision = ({ kind, id: targetId, version, decision, reason = '', restaurantId }) => {
  if (!REVIEW_KINDS.includes(kind) || !id(targetId) || !Number.isSafeInteger(version) || version < 1) throw new ReviewError('INVALID', 'Reload this review request before deciding.');
  if (!['approved', 'rejected'].includes(decision)) throw new ReviewError('INVALID', 'Choose Approve or Reject.');
  if (decision === 'rejected' && (typeof reason !== 'string' || reason.trim().length < 10)) throw new ReviewError('REASON', 'Explain what needs to be corrected in at least 10 characters.');
  if (kind === 'membership' && decision === 'approved' && !id(restaurantId)) throw new ReviewError('ASSIGNMENT', 'Explicitly choose the requested approved restaurant for this staff account.');
  return { kind, id: targetId, version, decision, reason: decision === 'rejected' ? reason.trim() : '',
    ...(kind === 'membership' && decision === 'approved' ? { restaurantId } : {}) };
};

export const validateReviewSnapshot = (value) => {
  const invalid = () => { throw new ReviewError('MALFORMED', 'The review service returned unreadable data. Please refresh.'); };
  if (!value || typeof value !== 'object' || ['students', 'restaurants', 'memberships', 'reviews'].some((key) => !Array.isArray(value[key]))) invalid();
  for (const key of ['students', 'restaurants', 'memberships']) {
    if (new Set(value[key].map((entry) => entry?.id)).size !== value[key].length) invalid();
    for (const entry of value[key]) {
      if (!entry || !id(entry.id) || !statuses.includes(entry.status) || !Number.isSafeInteger(entry.version) || entry.version < 1 || !date(entry.submittedAt)) invalid();
      if (key === 'students' && (!id(entry.studentId) || !id(entry.studentName) || !findCampus(entry.campusId) || !Number.isSafeInteger(entry.attempt) || entry.attempt < 1
        || !id(entry.evidence?.title) || !id(entry.evidence?.description))) invalid();
      if (key === 'restaurants' && (!id(entry.name) || !id(entry.applicantId) || !Array.isArray(entry.campusIds) || !entry.campusIds.length || !entry.campusIds.every(findCampus))) invalid();
      if (key === 'memberships' && (!id(entry.staffId) || !id(entry.staffName) || !id(entry.restaurantId) || !id(entry.requestedBy))) invalid();
    }
  }
  if (new Set(value.reviews.map((entry) => entry?.id)).size !== value.reviews.length) invalid();
  for (const review of value.reviews) {
    if (!review || !id(review.id) || !REVIEW_KINDS.includes(review.kind) || !id(review.targetId) || !['approved', 'rejected'].includes(review.decision)
      || !id(review.reviewerId) || !id(review.reviewerName) || !date(review.decidedAt) || typeof review.reason !== 'string') invalid();
  }
  return value;
};

const requireService = (identity, service) => {
  requireAdmin(identity);
  if (service?.available !== true || service.synthetic !== true) throw new ReviewError('UNAVAILABLE', 'No active review service is connected.');
};
export const loadAdminReviews = async (service, identity, options = {}) => {
  requireService(identity, service);
  return validateReviewSnapshot(await service.list(identity, options));
};
export const decideAdminReview = async (service, identity, command) => {
  requireService(identity, service);
  const validated = validateDecision(command);
  return validateReviewSnapshot(await service.decide(identity, validated));
};
export const reviewErrorMessage = (error) => error instanceof ReviewError ? error.message : 'The review operation could not be confirmed. Your input is kept. Refresh before deciding whether to try again.';
export const reviewDate = (value) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const targetCollection = (kind) => ({ student: 'students', restaurant: 'restaurants', membership: 'memberships' })[kind];
