import { useEffect, useState } from "react";
import { fetchRestaurantProfile } from "../utils/api";
import "../App.css";
import { BASE_URL } from "../utils/api";

const ProfilePage = () => {
  const [profile, setProfile] = useState({
    id: "",
    name: "",
    email: "",
    location: "",
    openingHours: "",
    cuisineType: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ ...profile });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const getProfileData = async () => {
      try {
        const data = await fetchRestaurantProfile();
        console.log("Profile data:", data);
        setProfile(data || {});
        setEditedProfile(data || {});
        setError(null);
      } catch (error) {
        console.error("Error fetching profile:", error);
        setError("Failed to load profile data.");
      }
    };
    getProfileData();
  }, []);

  const handleEditButtonClick = () => {
    setEditedProfile({ ...profile });
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${BASE_URL}/restaurant`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant: editedProfile }),
      });

      if (!response.ok) {
        throw new Error("Failed to update restaurant profile");
      }

      setProfile({ ...editedProfile });
      setShowEditModal(false);
      setSuccess("Profile updated successfully!");
      setError(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update profile. Please try again.");
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditedProfile({ ...profile });
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="profile-page">
      <h2 className="profile-title">Profile</h2>
      {error && <p className="declined-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}
      <div className="profile-edit">
        <p><strong>Restaurant Name:</strong> {profile.name || "N/A"}</p>
        <p><strong>Email:</strong> {profile.email || "N/A"}</p>
        <p><strong>Location:</strong> {profile.location || "N/A"}</p>
        <p><strong>Opening Hours:</strong> {profile.openingHours || "N/A"}</p>
        <p><strong>Cuisine Type:</strong> {profile.cuisineType || "N/A"}</p>
        <button className="edit-profile-button" onClick={handleEditButtonClick}>
          Edit Profile
        </button>
      </div>

      {showEditModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Edit Profile</h3>
            <form onSubmit={handleSaveChanges}>
              <p>
                <input
                  type="text"
                  name="name"
                  placeholder="Restaurant Name"
                  value={editedProfile.name || ""}
                  onChange={handleInputChange}
                  required
                />
              </p>
              <p>
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={editedProfile.email || ""}
                  onChange={handleInputChange}
                  required
                />
              </p>
              <p>
                <input
                  type="text"
                  name="location"
                  placeholder="Location"
                  value={editedProfile.location || ""}
                  onChange={handleInputChange}
                  required
                />
              </p>
              <p>
                <input
                  type="text"
                  name="openingHours"
                  placeholder="Opening Hours"
                  value={editedProfile.openingHours || ""}
                  onChange={handleInputChange}
                  required
                />
              </p>
              <p>
                <input
                  type="text"
                  name="cuisineType"
                  placeholder="Cuisine Type"
                  value={editedProfile.cuisineType || ""}
                  onChange={handleInputChange}
                  required
                />
              </p>
              <button type="submit" className="form-button">Save Changes</button><br></br>
              <button
                type="button"
                className="close-modal"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
