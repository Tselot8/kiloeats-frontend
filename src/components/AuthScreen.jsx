import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AUTH_SERVICE, submitAuth, validateAuthFields } from "../utils/auth.js";

const AuthScreen = ({ mode, service = AUTH_SERVICE }) => {
  const signup = mode === "signup";
  const prefix = useId();
  const formRef = useRef(null);
  const feedbackRef = useRef(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [values, setValues] = useState({ name: "", email: "", phone: "", role: "Customer", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const available = service.available === true;
  const fields = signup ? [
    { name: "name", label: "Name", type: "text", autoComplete: "name" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
    { name: "role", label: "Account type", type: "select" },
    { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
  ] : [
    { name: "email", label: "Email", type: "email", autoComplete: "username" },
    { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
  ];

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (feedback) feedbackRef.current?.focus(); }, [feedback]);

  const change = (event) => {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "", ...(name === "password" ? { confirmPassword: "" } : {}) }));
    setFeedback(null);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const validation = validateAuthFields(mode, values);
    setErrors(validation);
    const invalid = Object.keys(validation)[0];
    if (invalid) { formRef.current.elements.namedItem(invalid)?.focus(); return; }
    inFlight.current = true;
    setSubmitting(true);
    setFeedback(null);
    // Keep secrets only in this attempt's ephemeral adapter call, never in storage.
    setValues((previous) => ({ ...previous, password: "", confirmPassword: "" }));
    try {
      const result = await submitAuth(mode, values, service);
      if (!mounted.current) return;
      const message = result.state === "success"
        ? `${signup ? "Signup" : "Login"} request completed. No session has been established.`
        : result.state === "unavailable"
          ? `${signup ? "Signup" : "Login"} is unavailable. No details were sent.`
          : signup
            ? "Signup could not be completed. Your other details are kept. Re-enter both passwords to try again."
            : "Login could not be completed. Your email is kept. Re-enter your password to try again.";
      setFeedback({ state: result.state, message });
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  return (
    <section className={`auth-page auth-page-${mode}`} aria-labelledby={`${prefix}-heading`}>
      <div className="auth-intro">
        <p className="auth-eyebrow">Your KiloEats account</p>
        <h2 id={`${prefix}-heading`}>{signup ? "Create your account" : "Welcome back"}</h2>
        <p>{signup ? "Choose how you plan to use KiloEats." : "Log in with your email and password when sign-in is available."}</p>
      </div>
      <div className="auth-card">
        {!available && <div className="auth-unavailable" id={`${prefix}-availability`}>
          <h3>{signup ? "Signup unavailable" : "Login unavailable"}</h3>
          <p>{signup ? "Account creation is not available yet. No registration request will be sent." : "Sign-in is not available yet. No credentials will be sent."}</p>
        </div>}
        <form ref={formRef} className="auth-form" onSubmit={submit} noValidate aria-describedby={!available ? `${prefix}-availability` : undefined}>
          {feedback && <div ref={feedbackRef} tabIndex={-1} className={`auth-feedback auth-feedback-${feedback.state}`} role={feedback.state === "error" ? "alert" : "status"}>{feedback.message}</div>}
          <p className="auth-required">All fields are required.</p>
          <fieldset disabled={submitting} className={signup ? "auth-fields auth-fields-signup" : "auth-fields"}>
            {fields.map(({ name, label, type, autoComplete }) => {
              const props = {
                id: `${prefix}-${name}`, name, value: values[name], onChange: change, required: true,
                "aria-invalid": Boolean(errors[name]),
                "aria-describedby": [errors[name] ? `${prefix}-${name}-error` : "", name === "role" ? `${prefix}-role-help` : ""].filter(Boolean).join(" ") || undefined,
              };
              return <div className="auth-field" key={name}>
                <label htmlFor={`${prefix}-${name}`}>{label}</label>
                {type === "select" ? <select {...props}><option value="Customer">Customer</option><option value="Restaurant Owner">Restaurant owner</option></select>
                  : <input {...props} type={type} autoComplete={autoComplete} inputMode={type === "email" ? "email" : type === "tel" ? "tel" : undefined} autoCapitalize={type === "email" ? "none" : undefined} spellCheck={type === "email" || type === "password" ? false : undefined} />}
                {name === "role" && <p className="auth-field-help" id={`${prefix}-role-help`}>Restaurant access needs separate authorization.</p>}
                {errors[name] && <p className="error-text" id={`${prefix}-${name}-error`} role="alert">{errors[name]}</p>}
              </div>;
            })}
          </fieldset>
          <button type="submit" className="auth-submit" disabled={!available || submitting}>{submitting ? "Submitting…" : !available ? signup ? "Signup unavailable" : "Login unavailable" : signup ? "Create account" : "Log in"}</button>
          <p className="auth-pending" role="status">{submitting ? "Submitting your request. Please wait." : ""}</p>
        </form>
        <p className="auth-switch">{signup ? "Already have an account? " : "New to KiloEats? "}<Link to={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Sign up"}</Link></p>
      </div>
    </section>
  );
};

AuthScreen.propTypes = {
  mode: (props) => !["signup", "login"].includes(props.mode) ? new Error("AuthScreen requires signup or login mode.") : null,
  service: (props) => props.service != null && (typeof props.service !== "object" || typeof props.service.available !== "boolean") ? new Error("AuthScreen service must declare its availability.") : null,
};

export default AuthScreen;
