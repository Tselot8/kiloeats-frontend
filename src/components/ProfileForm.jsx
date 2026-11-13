import { useId, useRef, useState } from "react";
import { PROFILE_FIELDS, profileValues, validateProfileFields } from "../utils/profile.js";

const ProfileForm = ({ original, onSave, onCancel, saving, error }) => {
  const prefix = useId();
  const formRef = useRef(null);
  // Initialize once from the edit snapshot. Later reads never replace this draft.
  const [values, setValues] = useState(() => profileValues(original));
  const [errors, setErrors] = useState({});
  const change = (event) => {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
  };
  const submit = (event) => {
    event.preventDefault();
    if (saving) return;
    const validation = validateProfileFields(values);
    setErrors(validation);
    const invalid = Object.keys(validation)[0];
    if (invalid) { formRef.current.elements.namedItem(invalid)?.focus(); return; }
    onSave(profileValues(values));
  };

  return (
    <form ref={formRef} className="profile-form" onSubmit={submit} noValidate aria-busy={saving}>
      <p className="menu-helper">All five fields are required. Your changes appear after the service confirms the save.</p>
      {error && <p className="menu-feedback menu-feedback-error" role="alert">{error}</p>}
      <fieldset disabled={saving}>
        {PROFILE_FIELDS.map(({ key, label, type }) => (
          <div className="profile-field" key={key}>
            <label htmlFor={`${prefix}-${key}`}>{label} <span>(required)</span></label>
            <input id={`${prefix}-${key}`} name={key} type={type} value={values[key]} onChange={change} required
              data-initial-focus={key === "name" ? true : undefined}
              inputMode={type === "email" ? "email" : undefined}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={[errors[key] ? `${prefix}-${key}-error` : "", key === "openingHours" ? `${prefix}-hours-help` : ""].filter(Boolean).join(" ") || undefined} />
            {key === "openingHours" && <p id={`${prefix}-hours-help`} className="menu-helper">Keep opening hours in your usual text format.</p>}
            {errors[key] && <p id={`${prefix}-${key}-error`} className="error-text" role="alert">{errors[key]}</p>}
          </div>
        ))}
      </fieldset>
      <div className="menu-form-actions">
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
      <p className="profile-saving-status" role="status">{saving ? "Saving and checking your profile. Please wait before closing this form." : ""}</p>
    </form>
  );
};

ProfileForm.propTypes = {
  original: (props) => !props.original || typeof props.original !== "object" ? new Error("ProfileForm requires a profile snapshot.") : null,
  onSave: (props) => typeof props.onSave !== "function" ? new Error("ProfileForm requires onSave.") : null,
  onCancel: (props) => typeof props.onCancel !== "function" ? new Error("ProfileForm requires onCancel.") : null,
  saving: (props) => typeof props.saving !== "boolean" ? new Error("ProfileForm requires a saving state.") : null,
  error: (props) => typeof props.error !== "string" ? new Error("ProfileForm requires error text.") : null,
};

export default ProfileForm;
