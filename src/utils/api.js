export const BASE_URL = 'https://kilo-eats-backend.onrender.com';

export const fetchMenuData = async () => {
  try {
    const response = await fetch(`${BASE_URL}/item`);
    if (!response.ok) {
      throw new Error("Failed to fetch menu data");
    }
    const data = await response.json();
    console.log("Raw menu data:", data); // Debug log
    return data.item?.menu?.menuItems || [];
  } catch (error) {
    console.error("Failed to fetch menu data:", error);
    return [];
  }
};

export const fetchRestaurantProfile = async () => {
  try {
    const response = await fetch(`${BASE_URL}/restaurant`);
    if (!response.ok) {
      throw new Error("Failed to fetch restaurant profile");
    }
    const data = await response.json();
    return data; // Return flat structure { id, name, email, location, openingHours, cuisineType }
  } catch (error) {
    console.error("Error fetching restaurant profile:", error);
    return {};
  }
};

export const fetchOrders = async () => {
  try {
    const response = await fetch(`${BASE_URL}/orders`);
    if (!response.ok) {
      throw new Error("Failed to fetch orders");
    }
    const data = await response.json();
    console.log("Raw orders data:", data); // Debug log
    return data.orders || [];
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
};