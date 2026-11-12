import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMenu } from "../hooks/useMenu.js";
import { addMenuItem, menuErrorMessage, removeMenuItem } from "../utils/api.js";
import MenuItem from "./MenuItem.jsx";
import MenuDialog from "./MenuDialog.jsx";
import MenuForm from "./MenuForm.jsx";

const MenuPage = () => {
  const { items, setItems, loading, loadError, reload } = useMenu();
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const inFlight = useRef(false);
  const open = (next) => { setSaveError(""); setSuccess(""); setDialog(next); };
  const dismiss = () => { if (!inFlight.current) { setDialog(null); setSaveError(""); } };
  const save = async (values) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const removing = dialog.type === "remove";
      const updated = await (removing ? removeMenuItem(dialog.item.id) : addMenuItem(values));
      setItems(updated);
      setSuccess(removing ? `Removed ${dialog.item.name || "the item"} from your menu.` : `Added ${values.name} to your menu.`);
      setDialog(null);
    } catch (error) {
      setSaveError(menuErrorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="menu-page" aria-labelledby="menu-title">
      <div className="page-header">
        <div>
          <h2 id="menu-title">Your Menu</h2>
          <p className="menu-helper">Keep your food details and prices up to date.</p>
        </div>
        <div className="container1">
          <Link to="/edit-menu" className="button-link button-secondary edit-menu">Edit Menu</Link>
          <button className="addFood" onClick={() => open({ type: "add" })} disabled={loading}>Add food</button>
        </div>
      </div>
      <p role="status" className="menu-success">{success}</p>
      {loading && <p className="menu-state" role="status">Loading your menu…</p>}
      {loadError && <div className="menu-feedback menu-feedback-error" role="alert"><p>{loadError}</p><button className="button-secondary" onClick={reload}>Retry loading menu</button></div>}
      {!loading && !loadError && items.length === 0 && <div className="menu-state"><h3>Your menu is empty</h3><p>Add your first food item to get started.</p></div>}
      {!loading && <MenuItem items={items} onRemoveFood={(item) => open({ type: "remove", item })} />}
      {dialog && (
        <MenuDialog title={dialog.type === "add" ? "Add food" : "Remove food?"} onDismiss={dismiss} busy={saving}>
          {dialog.type === "add" ? (
            <MenuForm onSave={save} saving={saving} error={saveError} onCancel={dismiss} />
          ) : (
            <div className="menu-remove-confirmation">
              <p>Remove <strong>{dialog.item.name || "this item"}</strong> from your menu? This action cannot be undone.</p>
              {saveError && <p className="menu-feedback menu-feedback-error" role="alert">{saveError}</p>}
              <div className="menu-form-actions">
                <button type="button" className="button-secondary" onClick={dismiss} disabled={saving} data-initial-focus>Keep item</button>
                <button type="button" className="button-danger" onClick={() => save()} disabled={saving}>{saving ? "Removing…" : "Remove item"}</button>
              </div>
              <p role="status" className="menu-saving-status">{saving ? "Removing this item. Please wait." : ""}</p>
            </div>
          )}
        </MenuDialog>
      )}
    </section>
  );
};

export default MenuPage;
