import { Link, useParams } from "react-router-dom";

const RestaurantDetailsWrapper = () => {
  const { restaurantId } = useParams();
  return (
    <section className="route-message" aria-labelledby="restaurant-placeholder-title">
      <p className="menu-helper">Not available yet</p>
      <h2 id="restaurant-placeholder-title">Restaurant details</h2>
      <p>This route is a placeholder. Restaurant browsing and public details have not been implemented.</p>
      <p>Restaurant ID: <strong>{restaurantId}</strong></p>
      <Link className="button-link button-secondary" to="/">Return to Menu</Link>
    </section>
  );
};

export default RestaurantDetailsWrapper;
