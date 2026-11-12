import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMenu } from "../hooks/useMenu.js";
import { menuErrorMessage, updateMenuItem } from "../utils/api.js";
import { formatMenuPrice, hasUniqueMenuId, menuItemId } from "../utils/menu.js";
import MenuForm from "./MenuForm.jsx";
import FoodImage from "./FoodImage.jsx";

const EditMenuPage = () => {
  const { items, setItems, loading, loadError, reload } = useMenu();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("item") || "";
  const selectedItem = items.find((item) => menuItemId(item) === selectedId && hasUniqueMenuId(item, items));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const inFlight = useRef(false);
  const select = (event) => {
    setParams({ item: event.target.value });
    setSaveError("");
    setSuccess("");
  };
  const save = async (values) => {
    if (inFlight.current || !selectedItem) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    setSuccess("");
    try {
      const updated = await updateMenuItem(selectedItem.id, values);
      setItems(updated);
      setSuccess(`Saved changes to ${values.name}.`);
    } catch (error) {
      setSaveError(menuErrorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="edit-page" aria-labelledby="edit-menu-title">
      <div className="container">
        <div><h2 id="edit-menu-title">Edit Your Menu</h2><p className="menu-helper">Choose a food item, update its details, then save your changes.</p></div>
        <Link to="/" className="button-link button-secondary back-to-menu" onClick={(event) => { if (saving) event.preventDefault(); }} aria-disabled={saving}>Back to Menu</Link>
      </div>
      {loading && <p className="menu-state" role="status">Loading your menu…</p>}
      {loadError && <div className="menu-feedback menu-feedback-error" role="alert"><p>{loadError}</p><button className="button-secondary" onClick={reload} disabled={saving}>Retry loading menu</button></div>}
      <p role="status" className="menu-success">{success}</p>
      {!loading && !loadError && items.length === 0 && <div className="menu-state"><h3>No food to edit yet</h3><p>Return to your menu to add a food item.</p></div>}
      {!loading && items.length > 0 && (
        <div className="menu-editor-layout">
          <div className="form-section menu-selection">
            <h3>Select food to edit</h3>
            <label htmlFor="food-selection">Food item</label>
            <select id="food-selection" className="combo" onChange={select} value={selectedItem ? selectedId : ""} disabled={saving}>
              <option value="" disabled>Choose a food item</option>
              {items.map((item, index) => {
                const editable = hasUniqueMenuId(item, items);
                return <option key={editable ? `id:${menuItemId(item)}` : `unidentified:${index}`} value={editable ? menuItemId(item) : `unidentified:${index}`} disabled={!editable}>{item.name || "Unnamed item"} — {formatMenuPrice(item.price)}{editable ? ` · ID ${menuItemId(item)}` : " · ID needs attention"}</option>;
              })}
            </select>
            <p className="menu-helper">Items with missing or duplicate IDs cannot be changed safely.</p>
            {selectedId && !selectedItem && !loadError && <p className="error-text" role="alert">This item is no longer available for editing. Choose another food item.</p>}
          </div>
          {selectedItem ? (
            <section className="form-section menu-editor-fields" aria-label="Edit food details">
              <div className="menu-editor-summary"><FoodImage src={selectedItem.image} name={selectedItem.name || "Unnamed item"} /><div><h3>{selectedItem.name || "Unnamed item"}</h3><p className="price">{formatMenuPrice(selectedItem.price)}</p></div></div>
              <MenuForm key={selectedId} initialItem={selectedItem} onSave={save} saving={saving} error={saveError} />
            </section>
          ) : <div className="menu-state menu-selection-hint"><h3>Ready for an update?</h3><p>Select a food item to edit its name, description, price, or image.</p></div>}
        </div>
      )}
    </section>
  );
};

export default EditMenuPage;
