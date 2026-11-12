import { useEffect, useState } from "react";
import { Route, BrowserRouter as Router, Routes, Link } from "react-router-dom";
import "./App.css";
import MenuItem from "./components/MenuItem.jsx";
import EditMenuPage from "./components/EditMenuPage.jsx";
import OrdersPage from "./components/OrdersPage.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import RestaurantDetailsWrapper from "./components/RestaurantDetailsWrapper.jsx";
import SignUpPage from "./components/SignUpPage.jsx";
import { fetchMenuData } from "./utils/api";
import { BASE_URL } from "./utils/api.js";
import AppHeader from "./components/AppHeader.jsx";

const App = () => {
  const [foodItems, setFoodItems] = useState([]);
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [newFood, setNewFood] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    rating: 4
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const getMenuData = async () => {
      try {
        const data = await fetchMenuData();
        console.log("Fetched menu data:", data);
        setFoodItems(data);
      } catch (error) {
        console.error("Error fetching menu data:", error);
        setError("Failed to load menu items.");
      }
    };
    getMenuData();
  }, []);

  const handleRemoveFood = async (foodName) => {
    try {
      const response = await fetch(`${BASE_URL}/item`);
      if (!response.ok) {
        throw new Error("Failed to fetch restaurant data");
      }
      const restaurant = await response.json();
      const updatedMenu = restaurant.item.menu.menuItems.filter(
        (item) => item.name !== foodName
      );

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
      setError(null);
    } catch (error) {
      console.error("Error removing food item:", error);
      setError("Failed to remove menu item.");
    }
  };

  const handleOpenModal = () => {
    setShowAddFoodModal(true);
    setError(null);
  };

  const handleCloseModal = () => {
    setShowAddFoodModal(false);
    setNewFood({ name: "", description: "", price: "", image: "", rating: 4 });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewFood((prevFood) => ({
      ...prevFood,
      [name]: value,
    }));
  };

  const handleAddFood = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${BASE_URL}/item`);
      if (!response.ok) {
        throw new Error("Failed to fetch restaurant data");
      }
      const restaurant = await response.json();
      const currentMenu = restaurant.item.menu.menuItems;
      const updatedMenu = currentMenu.filter((item) => item.name !== newFood.name);
      updatedMenu.push({ ...newFood, id: currentMenu.length + 1 });

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
      handleCloseModal();
      setError(null);
    } catch (error) {
      console.error("Error adding food item:", error);
      setError("Failed to add menu item.");
    }
  };

  const handleMenuUpdate = (updatedMenu) => {
    setFoodItems(updatedMenu);
    setError(null);
  };

  return (
    <Router>
      <div className="app">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <AppHeader />
        <main id="main-content" className="layout-container app-main" tabIndex={-1}>
          {error && <p className="declined-text">{error}</p>}
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <div className="page-header">
                    <h2 className="main-title">Your Menu</h2>
                    <div className="container1">
                      <Link to="/edit-menu" className="button-link button-secondary edit-menu">Edit Menu</Link>
                      <button className="addFood" onClick={handleOpenModal} aria-label="Add food">+</button>
                    </div>
                  </div>
                  <MenuItem items={foodItems} onRemoveFood={handleRemoveFood} />
                </>
              }
            />
            <Route
              path="/edit-menu"
              element={<EditMenuPage onMenuUpdate={handleMenuUpdate} />}
            />
            <Route
              path="/orders"
              element={<OrdersPage />}
            />
            <Route
              path="/profile"
              element={<ProfilePage />}
            />
            <Route
              path="/restaurant/:restaurantId"
              element={<RestaurantDetailsWrapper />}
            />
            <Route
              path="/signup"
              element={<SignUpPage />}
            />
          </Routes>
        </main>

        {showAddFoodModal && (
          <div className="modal">
            <div className="modal-content">
              <h3>Add New Food</h3>
              <form onSubmit={handleAddFood}>
                <input
                  type="text"
                  name="name"
                  placeholder="Food name"
                  value={newFood.name}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="description"
                  placeholder="Food description"
                  value={newFood.description}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="price"
                  placeholder="Food price"
                  value={newFood.price}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="image"
                  placeholder="Image URL"
                  value={newFood.image}
                  onChange={handleInputChange}
                />
                <button type="submit" className="form-button">Add Food</button>
              </form>
              <button className="close-modal" onClick={handleCloseModal}>Close</button>
            </div>
          </div>
        )}

        <footer className='main-footer'>
          <div className="layout-container footer-content">
            <div className="about-us">
              <h3>About Us</h3>
              <p>Discover the best meals with KiloEats</p>
            </div>
            <div className="contact-info">
              <p>Email: support@kiloeats.com</p>
              <p>Phone: +1-800-555-1234</p>
            </div>
            <div className="social-links">
              <a href="https://twitter.com">Twitter</a>
              <a href="https://instagram.com">Instagram</a>
              <a href="https://facebook.com">Facebook</a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
