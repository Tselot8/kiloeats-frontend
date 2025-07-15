import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import { BASE_URL } from "../utils/api";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${BASE_URL}/orders`);
        if (!response.ok) {
          throw new Error("Failed to fetch orders");
        }
        const data = await response.json();
        console.log("Fetched orders:", data);
        setOrders(data.orders || []);
      } catch (error) {
        console.error("Error fetching orders:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const updateOrderStatus = async (orderId, status) => {
    try {
      const response = await fetch(`${BASE_URL}/orders/${orderId.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status on the server");
      }

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status } : order
        )
      );
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  const deleteOrder = async (orderId) => {
    try {
      const response = await fetch(`${BASE_URL}/orders/${orderId.toString()}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete order from the server");
      }

      setOrders((prevOrders) =>
        prevOrders.filter((order) => order.id !== orderId)
      );
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  };

  return (
    <div className="orders-page">
      <header>
        <div className="container3">
          <h2 className="main-title">Orders</h2>
          <Link to="/">
            <button className="orders-back-to-menu">Back to Menu</button>
          </Link>
        </div>
      </header>
      <div>
        {loading ? (
          <p>Loading orders...</p>
        ) : orders.length > 0 ? (
          orders.map((order) => (
            <div key={order.id} className="order-card">
              <h3>Order {order.id}</h3>
              <p>Items: {order.items.join(", ")}</p>
              <p>Total Price: {order.totalPrice} Br.</p>
              <p>Status: {order.status}</p>
              <div className="order-buttons">
                {order.status === "Accepted" ? (
                  <>
                    <button
                      className="order-ready"
                      onClick={() => updateOrderStatus(order.id, "Done")}
                    >
                      Order Ready
                    </button>
                    <button
                      className="deny-order"
                      onClick={() => deleteOrder(order.id)}
                    >
                      Delete Order
                    </button>
                  </>
                ) : order.status === "Declined" ? (
                  <p className="declined-text">Declined</p>
                ) : order.status === "Done" ? (
                  <p>Order is Done</p>
                ) : (
                  <>
                    <button
                      className="accept-order"
                      onClick={() => updateOrderStatus(order.id, "Accepted")}
                    >
                      Accept Order
                    </button>
                    <button
                      className="deny-order"
                      onClick={() => updateOrderStatus(order.id, "Declined")}
                    >
                      Deny Order
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>No orders available at the moment.</p>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;