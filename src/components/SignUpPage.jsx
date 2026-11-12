import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

const SignUpPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "Customer",
  });
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState("");

  const validatePassword = (password) => {
    const minLength = 8;
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (password.length < minLength) {
      return `Password must be at least ${minLength} characters long`;
    }
    if (!specialCharRegex.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.phone) newErrors.phone = "Phone number is required";

    const passwordError = validatePassword(formData.password);
    if (passwordError) newErrors.password = passwordError;
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      let response;
      if (formData.role === "Restaurant Owner") {
        response = await fetch("http://localhost:3007/restaurant");
      } else {
        response = await fetch("http://localhost:3007/customers");
      }

      if (!response.ok) {
        throw new Error("Failed to check email availability.");
      }

      const data = await response.json();
      const emailExists = data.some((user) => user.email === formData.email);

      if (emailExists) {
        setNotification("Email is already in use. Please use a different email.");
        return;
      }

      const registerResponse = await fetch("http://localhost:3009/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!registerResponse.ok) {
        throw new Error("Failed to register. Please try again.");
      }

      setNotification("Registration successful!");

      if (formData.role === "Restaurant Owner") {
        navigate("/profile");
      } else {
        navigate("/");
      }
    } catch (error) {
      setNotification(error.message || "An unexpected error occurred.");
    }
  };

  return (
    <div className="signup-container">
      <form onSubmit={handleSubmit} className="signup-form">
        <h2>Sign Up</h2>
        <p>Create your account here</p>

        <label>
          Name
          <input
            className="signup-input"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Name"
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </label>

        <label>
          Email
          <input
            className="signup-input"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Email"
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </label>

        <label>
          Phone
          <input
            className="signup-input"
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Phone"
          />
          {errors.phone && <span className="error-text">{errors.phone}</span>}
        </label>

        <label>
          Password
          <input
            className="signup-input"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Password"
          />
          {errors.password && (
            <span className="error-text">{errors.password}</span>
          )}
        </label>

        <label>
          Sign up as:
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            className="signup-input"
          >
            <option value="Customer">Customer</option>
            <option value="Restaurant Owner">Restaurant Owner</option>
          </select>
          {errors.role && <span className="error-text">{errors.role}</span>}
        </label>

        <button type="submit" className="submit-button">
          Sign Up
        </button>

        {notification && <p className="notification">{notification}</p>}
      </form>
      <button>Login instead</button>
    </div>
  );
};

export default SignUpPage;
