import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useIdentity } from '../../context/IdentityContext.js';
import { accessDecision } from '../../utils/identity.js';
import { findCampus } from '../../utils/studentBrowsing.js';
import { ADMIN_REVIEW_SERVICE, decideAdminReview, loadAdminReviews, reviewDate, reviewErrorMessage, targetCollection, validateDecision } from '../../utils/adminReview.js';
import MenuDialog from '../MenuDialog.jsx';
import './adminReview.css';

const label = (status) => ({ pending: 'Pending', approved: 'Approved', rejected: 'Rejected' })[status];
const nameFor = (kind, target) => kind === 'student' ? target.studentName : kind === 'restaurant' ? target.name : target.staffName;

const DecisionRecord = ({ review }) => <div className="admin-decision-record"><strong>{label(review.decision)}</strong><p>Reviewer: {review.reviewerName} ({review.reviewerId})</p><p><time dateTime={review.decidedAt}>{reviewDate(review.decidedAt)}</time></p>{review.reason && <p>Reason: {review.reason}</p>}{review.restaurantId && <p>Assigned staff {review.staffId} to restaurant {review.restaurantId}.</p>}</div>;
DecisionRecord.propTypes = { review: (props) => !props.review ? new Error('Decision record required.') : null };

const ReviewDialog = ({ selection, model, identity, saving, loading, error, loadError, onDismiss, onSubmit, onRefresh }) => {
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [validation, setValidation] = useState('');
  const formRef = useRef(null);
  const panelRef = useRef(null);
  const prefix = useId();
  const kind = selection.kind;
  const target = model[targetCollection(kind)].find((entry) => entry.id === selection.id);
  const self = target && [target.studentId, target.applicantId, target.staffId, target.requestedBy].includes(identity.user.id);
  const restaurant = kind === 'membership' ? model.restaurants.find((entry) => entry.id === target?.restaurantId) : null;
  const canDecide = target?.status === 'pending' && !self;
  useEffect(() => { if (loading) panelRef.current?.focus(); }, [loading]);
  const submit = (event) => {
    event.preventDefault();
    if (saving || loading || loadError || error?.code === 'STALE') return;
    try {
      const command = validateDecision({ kind, id: selection.id, version: selection.version, decision, reason, restaurantId });
      setValidation(''); onSubmit(command);
    } catch (failure) {
      setValidation(failure.message);
      formRef.current?.querySelector(failure.code === 'REASON' ? 'textarea' : failure.code === 'ASSIGNMENT' ? 'select' : 'input')?.focus();
    }
  };
  return <MenuDialog title={target ? `${nameFor(kind, target)}${kind === 'student' ? ` · Attempt ${target.attempt}` : ''}` : 'Review request unavailable'} busy={saving} onDismiss={onDismiss} fallbackFocusSelector="#admin-review-title">
    <div className="admin-review-dialog" ref={panelRef} tabIndex={-1}>
      {!target ? <p>This request is no longer in the review list. Refresh to see the current records.</p> : <>
        <p><span className={`admin-review-status admin-review-status-${target.status}`}>{label(target.status)}</span> · Submitted <time dateTime={target.submittedAt}>{reviewDate(target.submittedAt)}</time></p>
        {kind === 'student' && <><p>Campus: {findCampus(target.campusId).name}</p><div className="admin-fictional-evidence"><strong>{target.evidence.title}</strong><p>{target.evidence.description}</p><p>This text is a synthetic placeholder, not proof of enrollment or a real ID image.</p></div></>}
        {kind === 'restaurant' && <><p>Applicant: {target.applicantId}</p><p>Requested campus coverage: {target.campusIds.map((id) => findCampus(id).name).join(', ')}</p><p>Restaurant approval does not assign staff or create a live partner.</p></>}
        {kind === 'membership' && <><p>Staff account: <strong>{target.staffName}</strong> ({target.staffId})</p><p>Requested restaurant: <strong>{restaurant?.name || target.restaurantId}</strong></p><p>Requested by: {target.requestedBy}</p>{restaurant?.status !== 'approved' && <p className="menu-feedback">Approve the restaurant application first. Staff membership is a separate decision; rejection is still available.</p>}</>}
        {self && <p className="menu-feedback menu-feedback-error">The synthetic reviewer cannot decide their own submission or grant themselves access.</p>}
        {canDecide && <form className="admin-decision-form" ref={formRef} onSubmit={submit} noValidate>
          <fieldset disabled={saving || loading || Boolean(loadError)} aria-describedby={validation ? `${prefix}-validation` : undefined}><legend>Decision (required)</legend><div className="admin-decision-options">{['approved', 'rejected'].map((value) => <label key={value}><input type="radio" name="decision" value={value} required checked={decision === value} onChange={() => { setDecision(value); setValidation(''); }} />{value === 'approved' ? 'Approve' : 'Reject'}</label>)}</div>
            {kind === 'membership' && decision === 'approved' && <div><label htmlFor={`${prefix}-restaurant`}>Assign staff to the requested restaurant</label><select id={`${prefix}-restaurant`} name="restaurantId" value={restaurantId} onChange={(event) => { setRestaurantId(event.target.value); setValidation(''); }} required><option value="">Choose approved restaurant</option>{restaurant?.status === 'approved' && <option value={restaurant.id}>{restaurant.name}</option>}</select><p className="menu-helper">This account can only be assigned to the restaurant named in this request.</p></div>}
            {decision === 'rejected' && <div><label htmlFor={`${prefix}-reason`}>Rejection reason (required)</label><textarea id={`${prefix}-reason`} name="reason" value={reason} onChange={(event) => { setReason(event.target.value); setValidation(''); }} required minLength={10} rows={4} aria-describedby={`${prefix}-reason-help${validation ? ` ${prefix}-validation` : ''}`} aria-invalid={Boolean(validation)} /><p id={`${prefix}-reason-help`} className="menu-helper">Explain what needs to be corrected, using at least 10 characters. No document or enrollment criteria are assumed by this demo.</p></div>}
          </fieldset>
          {validation && <p id={`${prefix}-validation`} className="error-text" role="alert">{validation}</p>}
          <div className="menu-form-actions"><button className="button-secondary" type="button" data-initial-focus onClick={onDismiss} disabled={saving}>Cancel review</button><button type="submit" disabled={saving || loading || Boolean(loadError) || error?.code === 'STALE'}>{saving ? 'Saving decision…' : decision === 'rejected' ? 'Reject request' : kind === 'membership' ? 'Assign staff' : 'Approve request'}</button></div>
        </form>}
        {!canDecide && <p className="menu-helper">{target.status !== 'pending' ? 'This attempt has a recorded decision and is read-only.' : 'Another reviewer must handle this self-request.'}</p>}
        {kind === 'student' && <section className="admin-attempt-history" aria-label="Student review attempts"><h3>Review attempts and history</h3>{model.students.filter((entry) => entry.studentId === target.studentId).sort((a, b) => a.attempt - b.attempt).map((attempt) => <div key={attempt.id}><h4>Attempt {attempt.attempt} · {label(attempt.status)}</h4><p><time dateTime={attempt.submittedAt}>{reviewDate(attempt.submittedAt)}</time>{attempt.previousAttemptId ? ` · Resubmission of ${attempt.previousAttemptId}` : ''}</p>{model.reviews.filter((review) => review.kind === 'student' && review.targetId === attempt.id).map((review) => <DecisionRecord key={review.id} review={review} />)}</div>)}</section>}
        {kind !== 'student' && model.reviews.filter((review) => review.kind === kind && review.targetId === target.id).map((review) => <DecisionRecord key={review.id} review={review} />)}
      </>}
      {error && <p className="menu-feedback menu-feedback-error" role="alert">{error.message}</p>}
      {loadError && <p className="menu-feedback menu-feedback-error" role="alert">{loadError}</p>}
      {(error || loadError || !target) && <button className="button-secondary" type="button" onClick={onRefresh} disabled={saving || loading}>Refresh review information</button>}
      <p role="status" className="admin-action-progress">{saving ? 'Saving the synthetic decision. No live access is being granted.' : loading ? 'Refreshing review information…' : ''}</p>
    </div>
  </MenuDialog>;
};
const requiredType = (type) => (props, name) => props[name] == null || typeof props[name] !== type ? new Error(`Review dialog requires ${name}.`) : null;
ReviewDialog.propTypes = {
  selection: requiredType('object'), model: requiredType('object'), identity: requiredType('object'),
  saving: requiredType('boolean'), loading: requiredType('boolean'), loadError: requiredType('string'),
  error: (props) => props.error != null && typeof props.error !== 'object' ? new Error('Review error must be an object.') : null,
  onDismiss: requiredType('function'), onSubmit: requiredType('function'), onRefresh: requiredType('function'),
};

const ReviewWorkspace = ({ service, identity }) => {
  const [params] = useSearchParams();
  const section = params.get('section') === 'restaurants' ? 'restaurants' : 'students';
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selection, setSelection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const inFlight = useRef(false);
  const request = useRef(null);
  const mounted = useRef(true);
  const reload = useCallback(async () => {
    if (inFlight.current) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setLoadError('');
    try {
      const snapshot = await loadAdminReviews(service, identity, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setModel(snapshot);
        setSelection((previous) => previous ? { ...previous, version: snapshot[targetCollection(previous.kind)].find((entry) => entry.id === previous.id)?.version || previous.version } : previous);
      }
    } catch (failure) { if (!controller.signal.aborted) setLoadError(reviewErrorMessage(failure)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [service, identity]);
  useEffect(() => { mounted.current = true; reload(); return () => { mounted.current = false; request.current?.abort(); }; }, [reload]);
  const open = (kind, target) => { if (loading || loadError || inFlight.current) return; setError(null); setSuccess(''); setSelection({ kind, id: target.id, version: target.version }); };
  const dismiss = () => { if (!inFlight.current) { setSelection(null); setError(null); } };
  const decide = async (command) => {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(null); setSuccess('');
    try {
      const snapshot = await decideAdminReview(service, identity, command);
      if (!mounted.current) return;
      setModel(snapshot); setSelection(null); setSuccess('Synthetic decision recorded in memory. No real account or access was changed.');
    } catch (failure) { if (mounted.current) setError({ code: failure.code, message: reviewErrorMessage(failure) }); }
    finally { inFlight.current = false; if (mounted.current) setSaving(false); }
  };
  const cards = (kind, entries) => entries.length === 0 ? <div className="menu-state"><p>{kind === 'student' ? 'No student submissions.' : kind === 'restaurant' ? 'No restaurant applications.' : 'No staff membership requests.'}</p></div> : <div className="admin-review-list">{entries.map((target) => <article key={target.id} className="admin-review-card" data-review-kind={kind} data-review-id={target.id}>
    <div><h4>{nameFor(kind, target)}</h4><p>{kind === 'student' ? `${findCampus(target.campusId).name} · Attempt ${target.attempt}` : kind === 'restaurant' ? target.campusIds.map((id) => findCampus(id).name).join(', ') : `Requested restaurant: ${model.restaurants.find((entry) => entry.id === target.restaurantId)?.name || target.restaurantId}`}</p><p>Submitted <time dateTime={target.submittedAt}>{reviewDate(target.submittedAt)}</time></p></div><div className="admin-review-card-actions"><span className={`admin-review-status admin-review-status-${target.status}`}>{label(target.status)}</span><button className="button-secondary" onClick={() => open(kind, target)} disabled={loading || Boolean(loadError) || saving} aria-label={`Open ${kind} review for ${nameFor(kind, target)}${kind === 'student' ? ` attempt ${target.attempt}` : ''}`}>{target.status === 'pending' ? 'Open review' : 'View decision'}</button></div>
  </article>)}</div>;
  return <section className="admin-review-page" aria-labelledby="admin-review-title">
    <div className="page-header"><div><p className="auth-eyebrow">Synthetic admin workspace</p><h2 id="admin-review-title" tabIndex={-1}>Admin reviews</h2></div><button className="button-secondary" id="admin-refresh" disabled={loading || saving || Boolean(selection)} onClick={async (event) => { const button = event.currentTarget; await reload(); if (button.isConnected && document.activeElement === document.body) button.focus(); }}>Refresh reviews</button></div>
    <aside className="admin-demo-notice"><strong>Isolated demo reviews</strong><p>All people, restaurants and evidence are fictional. Decisions stay in memory and reset when this harness reloads. No live account, enrollment or restaurant access is changed.</p></aside>
    <nav className="admin-section-nav" aria-label="Admin review sections"><Link to="/admin?section=students" aria-current={section === 'students' ? 'page' : undefined}>Student verification</Link><Link to="/admin?section=restaurants" aria-current={section === 'restaurants' ? 'page' : undefined}>Restaurant access</Link></nav>
    <p className="admin-review-success" role="status">{success}</p>
    {loading && <p className="menu-state" role="status">Loading review data…</p>}
    {loadError && <div className="menu-feedback menu-feedback-error" role="alert"><p>{loadError}</p>{model && <p>The previous list is shown. Refresh successfully before opening another decision.</p>}<button className="button-secondary" onClick={reload} disabled={saving || loading}>Retry loading reviews</button></div>}
    {model && (section === 'students' ? <section aria-labelledby="admin-students-heading"><h3 id="admin-students-heading">Student verification submissions</h3>{cards('student', model.students)}</section> : <><section aria-labelledby="admin-restaurants-heading"><h3 id="admin-restaurants-heading">Restaurant applications</h3><p className="menu-helper admin-section-help">Approval and staff membership are separate decisions.</p>{cards('restaurant', model.restaurants)}</section><section className="admin-memberships" aria-labelledby="admin-memberships-heading"><h3 id="admin-memberships-heading">Requested staff memberships</h3>{cards('membership', model.memberships)}</section></>)}
    {selection && model && <ReviewDialog key={`${selection.kind}:${selection.id}`} selection={selection} model={model} identity={identity} saving={saving} loading={loading} error={error} loadError={loadError} onDismiss={dismiss} onSubmit={decide} onRefresh={() => { setError(null); reload(); }} />}
  </section>;
};
ReviewWorkspace.propTypes = { service: (props) => !props.service ? new Error('Review service required.') : null, identity: (props) => !props.identity ? new Error('Reviewer required.') : null };

const AdminReviewDashboard = ({ service = ADMIN_REVIEW_SERVICE }) => {
  const { identity } = useIdentity();
  if (accessDecision('admin', identity) !== 'allowed' || service.available !== true || service.synthetic !== true) return <section className="route-message"><h2>Admin review unavailable</h2><p>No authorized synthetic review service is connected.</p></section>;
  return <ReviewWorkspace service={service} identity={identity} />;
};
AdminReviewDashboard.propTypes = { service: (props) => props.service != null && typeof props.service.available !== 'boolean' ? new Error('Review service must declare availability.') : null };
export default AdminReviewDashboard;
