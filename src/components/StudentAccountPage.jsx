import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIdentity } from '../context/IdentityContext.js';
import { orderEligibility, submitSyntheticVerification } from '../utils/identity.js';
import { findCampus } from '../utils/studentBrowsing.js';

const statusDetails = {
  'not-submitted': { label: 'Not submitted', description: 'No student verification has been submitted. The verification policy and live submission service are still being prepared.' },
  pending: { label: 'Pending', description: 'A verification submission is awaiting review in this view. No review timeframe is promised. You can keep browsing and preparing your cart.' },
  verified: { label: 'Verified', description: 'This identity is marked verified in this view. Verified students will be eligible to place orders once ordering is available; checkout remains unavailable.' },
  rejected: { label: 'Rejected', description: 'The previous submission was not accepted. Review the reason below before resubmitting when a supported verification service is available.' },
};

const StudentAccountPage = () => {
  const { identity, reload, verificationService } = useIdentity();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const feedbackRef = useRef(null);
  const headingRef = useRef(null);
  const submitted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (feedback) feedbackRef.current?.focus(); }, [feedback]);
  const status = identity.verification.status;
  useEffect(() => {
    if (submitted.current && status === 'pending') {
      submitted.current = false;
      if (document.activeElement === document.body) headingRef.current?.focus();
    }
  }, [status]);
  const detail = statusDetails[status];
  const canSubmit = ['not-submitted', 'rejected'].includes(status);
  const synthetic = verificationService.available === true && verificationService.synthetic === true;
  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setSubmitting(true); setFeedback('');
    try {
      const result = await submitSyntheticVerification(identity, verificationService);
      if (!mounted.current) return;
      if (result.state === 'success') { submitted.current = true; await reload(); }
      else setFeedback(result.state === 'unavailable' ? 'Live verification submission is unavailable. No evidence was sent.' : 'The synthetic example could not be submitted. No real document was sent; you can try again.');
    } finally { inFlight.current = false; if (mounted.current) setSubmitting(false); }
  };
  return <section className="identity-page" aria-labelledby="student-account-title">
    <div className="page-header"><div><p className="auth-eyebrow">Student workspace</p><h2 ref={headingRef} tabIndex={-1} id="student-account-title">Account & verification</h2></div><Link className="button-link button-secondary" to="/cart">View demo cart</Link></div>
    <div className="identity-account-card"><h3>{identity.user.name || 'Student account'}</h3><dl className="identity-account-details"><div><dt>Email</dt><dd>{identity.user.email || 'Not provided'}</dd></div><div><dt>Campus</dt><dd>{findCampus(identity.user.campusId).name}</dd></div></dl></div>
    <section className="verification-card" aria-labelledby="verification-heading"><div className="student-results-heading"><h3 id="verification-heading">Student verification</h3><span className={`verification-status verification-status-${status}`}>{detail.label}</span></div><p>{detail.description}</p>
      {status === 'rejected' && <div className="verification-rejection"><h4>Review reason</h4><p>{identity.verification.rejectionReason || 'No review reason was provided. A future support/review process will need to clarify what to correct.'}</p><p>Live resubmission is unavailable. Do not send ID documents through public email or this demo.</p></div>}
      <p className="verification-live-notice">Live verification is not connected. No real IDs or evidence are collected or uploaded on this page.</p>
      {canSubmit && <button className="verification-submit" type="button" onClick={submit} disabled={!synthetic || submitting}>{submitting ? 'Submitting synthetic example…' : synthetic ? status === 'rejected' ? 'Resubmit synthetic example' : 'Submit synthetic example' : status === 'rejected' ? 'Resubmission unavailable' : 'Verification submission unavailable'}</button>}
      <p role="status" className="verification-progress">{submitting ? 'Submitting a synthetic example only. Please wait.' : ''}</p>
      {feedback && <p ref={feedbackRef} tabIndex={-1} className="menu-feedback menu-feedback-error" role="alert">{feedback}</p>}
      <p className="menu-helper">{orderEligibility(identity) ? 'Verification status alone does not enable checkout in this milestone.' : 'You can browse and prepare a cart without verification. Ordering will require a verified student identity.'}</p>
    </section>
    <section className="verification-methods" aria-labelledby="verification-methods-title"><h3 id="verification-methods-title">Proposed verification methods</h3><div><article><h4>University email verification</h4><p>A future service could confirm control of a university email address. No approved domains or email-verification service are defined here. Email ownership alone does not prove current enrollment.</p></article><article><h4>Manual student-ID review</h4><p>A future private process could let authorized reviewers check student evidence. Live submission is unavailable; accepted documents, reviewer access, and retention/deletion rules still need agreement.</p></article></div></section>
  </section>;
};
export default StudentAccountPage;
