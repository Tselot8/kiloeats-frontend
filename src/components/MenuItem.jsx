import React from "react";
import "../App.css";

const MenuItem = ({ items, onRemoveFood }) => (
  <div className="menu-category">
    {items.length === 0 ? (
      <p>No items available.</p>
    ) : (
      items.map((item, index) => (
        <div key={index} className="menu-item">
          <img src={item.image} alt={item.name} className="food-image" />
          <div className="food-details">
            <h3>
              {item.name} <span className="rating">{'⭐'.repeat(item.rating)}</span>
            </h3>
            <p>{item.description}</p>
          </div>
          <div className="food-price container">
            <div className="price">{item.price} Br.</div>
            <button
              className="removeFood"
              onClick={() => onRemoveFood(item.name)}
            >
              -
            </button>
          </div>
        </div>
      ))
    )}
  </div>
);

export default MenuItem;