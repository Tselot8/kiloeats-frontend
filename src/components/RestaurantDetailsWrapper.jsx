import { useParams } from "react-router-dom";
import "../App.css";

const RestaurantDetailsWrapper = () => {
  const { restaurantId } = useParams();
  return <div>Restaurant Details for ID: {restaurantId}</div>;
};

export default RestaurantDetailsWrapper;
