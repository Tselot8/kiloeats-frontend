import { useId, useRef, useState } from "react";
import { validateMenuFields } from "../utils/menu.js";

const MenuForm = ({ initialItem, onSave, saving, error, onCancel }) => {
  const prefix = useId();
  const formRef = useRef(null);
  const [values, setValues] = useState({
    name: initialItem?.name || "",
    description: initialItem?.description || "",
    price: initialItem?.price == null ? "" : String(initialItem.price),
    image: initialItem?.image || "",
  });
  const [errors, setErrors] = useState({});
  const change = (event) => {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
  };
  const submit = (event) => {
    event.preventDefault();
    if (saving) return;
    const validation = validateMenuFields(values);
    setErrors(validation);
    const invalid = Object.keys(validation)[0];
    if (invalid) { formRef.current.elements.namedItem(invalid)?.focus(); return; }
    onSave({ name: values.name.trim(), description: values.description.trim(), price: Number(values.price), image: values.image.trim() });
  };
  const fieldProps = (name) => ({
    id: `${prefix}-${name}`, name, value: values[name], onChange: change,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": [errors[name] ? `${prefix}-${name}-error` : "", name === "image" ? `${prefix}-image-help` : ""].filter(Boolean).join(" ") || undefined,
  });

  return (
    <form ref={formRef} className="menu-form" onSubmit={submit} noValidate aria-busy={saving}>
      <p className="menu-helper">Food name, description, and price are required.</p>
      {error && <p className="menu-feedback menu-feedback-error" role="alert">{error}</p>}
      <fieldset disabled={saving}>
        <div className="menu-field">
          <label htmlFor={`${prefix}-name`}>Food name <span>(required)</span></label>
          <input {...fieldProps("name")} type="text" required data-initial-focus />
          {errors.name && <p id={`${prefix}-name-error`} className="error-text" role="alert">{errors.name}</p>}
        </div>
        <div className="menu-field">
          <label htmlFor={`${prefix}-description`}>Description <span>(required)</span></label>
          <textarea {...fieldProps("description")} rows={3} required />
          {errors.description && <p id={`${prefix}-description-error`} className="error-text" role="alert">{errors.description}</p>}
        </div>
        <div className="menu-field">
          <label htmlFor={`${prefix}-price`}>Price in birr <span>(required)</span></label>
          <input {...fieldProps("price")} type="number" min="0" step="0.01" inputMode="decimal" required />
          {errors.price && <p id={`${prefix}-price-error`} className="error-text" role="alert">{errors.price}</p>}
        </div>
        <div className="menu-field">
          <label htmlFor={`${prefix}-image`}>Image URL <span>(optional)</span></label>
          <input {...fieldProps("image")} type="url" inputMode="url" />
          <p id={`${prefix}-image-help`} className="menu-helper">Use an http:// or https:// image link. Leave blank to show a placeholder.</p>
          {errors.image && <p id={`${prefix}-image-error`} className="error-text" role="alert">{errors.image}</p>}
        </div>
      </fieldset>
      <div className="menu-form-actions">
        <button type="submit" disabled={saving}>{saving ? "Saving…" : initialItem ? "Save changes" : "Add food"}</button>
        {onCancel && <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>Cancel</button>}
      </div>
      <p className="menu-saving-status" role="status">{saving ? "Saving your changes. Please wait before closing this form." : ""}</p>
    </form>
  );
};

MenuForm.propTypes = {
  initialItem: (props) => props.initialItem != null && typeof props.initialItem !== "object" ? new Error("MenuForm initialItem must be an object.") : null,
  onSave: (props) => typeof props.onSave !== "function" ? new Error("MenuForm requires onSave.") : null,
  saving: (props) => typeof props.saving !== "boolean" ? new Error("MenuForm requires saving.") : null,
  error: (props) => typeof props.error !== "string" ? new Error("MenuForm requires error text.") : null,
  onCancel: (props) => props.onCancel != null && typeof props.onCancel !== "function" ? new Error("MenuForm onCancel must be a function.") : null,
};

export default MenuForm;
