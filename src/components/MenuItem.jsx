import { Link } from "react-router-dom";
import FoodImage from "./FoodImage.jsx";
import { formatMenuPrice, hasUniqueMenuId, menuItemId } from "../utils/menu.js";

const MenuItem = ({ items, onRemoveFood }) => (
  <div className="menu-category">
    {items.map((item, index) => {
      const editable = hasUniqueMenuId(item, items);
      const name = item.name || "Unnamed item";
      const rating = Number.isFinite(Number(item.rating)) ? Math.max(0, Math.min(5, Math.floor(Number(item.rating)))) : 0;
      return (
        <article key={editable ? `id:${menuItemId(item)}` : `unidentified:${index}`} className="menu-item">
          <FoodImage src={item.image} name={name} />
          <div className="food-details">
            <h3>{name}</h3>
            {rating > 0 && <span className="rating" role="img" aria-label={`${rating} out of 5 stars`}>{"★".repeat(rating)}</span>}
            <p>{item.description || "No description provided."}</p>
            {!editable && <p className="menu-id-warning">This item needs a unique ID before it can be edited or removed.</p>}
          </div>
          <div className="menu-item-actions">
            <p className="price">{formatMenuPrice(item.price)}</p>
            <div className="menu-card-buttons">
              {editable && <Link to={`/edit-menu?item=${encodeURIComponent(menuItemId(item))}`} className="button-link button-secondary" aria-label={`Edit ${name}`}>Edit</Link>}
              <button className="removeFood" onClick={() => onRemoveFood(item)} disabled={!editable} aria-label={`Remove ${name}`}>Remove</button>
            </div>
          </div>
        </article>
      );
    })}
  </div>
);

MenuItem.propTypes = {
  items: (props) => !Array.isArray(props.items) ? new Error("MenuItem requires an items array.") : null,
  onRemoveFood: (props) => typeof props.onRemoveFood !== "function" ? new Error("MenuItem requires onRemoveFood.") : null,
};

export default MenuItem;
