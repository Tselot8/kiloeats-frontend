import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import { BASE_URL } from "../utils/api";

const EditMenuPage = ({ onMenuUpdate }) => {
  const [foodItems, setFoodItems] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [editedFood, setEditedFood] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    rating: 4
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const getMenuData = async () => {
      try {
        const response = await fetch(`${BASE_URL}/item`);
        if (!response.ok) {
          throw new Error("Failed to fetch menu data");
        }
        const data = await response.json();
        setFoodItems(data.item?.menu?.menuItems || []);
      } catch (error) {
        console.error("Error fetching menu data:", error);
        setError("Failed to load menu items.");
      }
    };
    getMenuData();
  }, []);

  const handleFoodSelection = (e) => {
    const selected = foodItems.find((item) => item.name === e.target.value);
    setSelectedFood(selected);
    setEditedFood({ ...selected, rating: selected.rating || 4 });
    setError(null);
    setSuccess(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedFood((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditFood = async (e) => {
    e.preventDefault();
    try {
      if (!selectedFood) {
        setError("Please select a food item to edit.");
        return;
      }
      const response = await fetch(`${BASE_URL}/item`);
      if (!response.ok) {
        throw new Error("Failed to fetch restaurant data");
      }
      const restaurant = await response.json();
      const currentMenu = restaurant.item.menu.menuItems;

      const foodToEditIndex = currentMenu.findIndex(
        (item) => item.id === editedFood.id
      );
      if (foodToEditIndex === -1) {
        throw new Error("Food item not found");
      }

      const updatedFoodItem = { ...currentMenu[foodToEditIndex], ...editedFood };
      const updatedMenu = [
        ...currentMenu.slice(0, foodToEditIndex),
        updatedFoodItem,
        ...currentMenu.slice(foodToEditIndex + 1),
      ];

      const updateResponse = await fetch(`${BASE_URL}/item`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            menu: {
              menuItems: updatedMenu,
            },
          },
        }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update the restaurant menu on the server");
      }

      setFoodItems(updatedMenu);
      if (onMenuUpdate) {
        onMenuUpdate(updatedMenu); // Update App.jsx state
      }
      setSelectedFood(null);
      setEditedFood({ name: "", description: "", price: "", image: "", rating: 4 });
      setError(null);
      setSuccess("Menu item updated successfully!");
    } catch (error) {
      console.error("Error editing food item:", error);
      setError("Failed to update menu item. Please try again.");
    }
  };

  return (
    <div className="edit-page">
      <div className="container">
        <h2 className="edit-your-menu">Edit Your Menu</h2>
        <Link to="/">
          <button className="back-to-menu">
            <strong>Back to Menu</strong>
          </button>
        </Link>
      </div>
      <div>
        <section className="form-section">
          <h3>Select Food to Edit</h3>
          {error && <p className="declined-text">{error}</p>}
          {success && <p className="success-text">{success}</p>}
          <select
            className="combo"
            onChange={handleFoodSelection}
            value={selectedFood?.name || ""}
          >
            <option value="" disabled>
              Choose a food item
            </option>
            {foodItems.map((item, index) => (
              <option key={index} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {selectedFood && (
            <form onSubmit={handleEditFood}>
              <p>
                <input
                  type="text"
                  className="edit-form"
                  name="name"
                  placeholder="Food name"
                  value={editedFood.name}
                  onChange={handleInputChange}
                  required
                />
              </p>
              <p>
                <input
                  type="text"
                  className="edit-form"
                  name="description"
                  placeholder="Food description"
                  value={editedFood.description}
                  onChange={handleInputChange}
                  required
                />
              </p>
              <p>
                <input
                  type="text"
                  className="edit-form"
                  name="price"
                  placeholder="Food price"
                  value={editedFood.price}
                  onChange={handleInputChange}
                  required
                />
              </p>
              <p>
                <label htmlFor="image-url" className="upload-label">
                  Image URL
                </label>
                <input
                  type="url"
                  id="image-url"
                  className="edit-form"
                  name="image"
                  placeholder="Enter image URL"
                  value={editedFood.image}
                  onChange={handleInputChange}
                />
              </p>
              <button type="submit" className="form-button">
                Save Changes
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

EditMenuPage.propTypes = {
  onMenuUpdate({ onMenuUpdate }) {
    if (onMenuUpdate != null && typeof onMenuUpdate !== "function") {
      return new Error("EditMenuPage onMenuUpdate must be a function.");
    }
    return null;
  },
};

export default EditMenuPage;
