import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRestaurantProfile, profileErrorMessage, saveRestaurantProfile } from "../utils/api.js";
import { PROFILE_FIELDS } from "../utils/profile.js";
import MenuDialog from "./MenuDialog.jsx";
import ProfileForm from "./ProfileForm.jsx";

const ProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const request = useRef(null);
  const editing = useRef(false);
  const inFlight = useRef(false);

  const reload = useCallback(async () => {
    if (editing.current || inFlight.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setLoadError("");
    setSuccess("");
    try {
      const data = await fetchRestaurantProfile({ signal: controller.signal });
      if (!controller.signal.aborted && !editing.current) setProfile(data);
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(profileErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return () => request.current?.abort();
  }, [reload]);

  const open = () => {
    if (!profile || loading || inFlight.current || editing.current) return;
    request.current?.abort();
    editing.current = true;
    setEditSnapshot({ ...profile });
    setSaveError("");
    setSuccess("");
  };
  const dismiss = () => {
    if (inFlight.current) return;
    editing.current = false;
    setEditSnapshot(null);
    setSaveError("");
  };
  const save = async (values) => {
    if (inFlight.current || !editing.current || !editSnapshot) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    setSuccess("");
    try {
      const verified = await saveRestaurantProfile(editSnapshot, values);
      setProfile(verified);
      setLoadError("");
      setSuccess("Restaurant profile updated and confirmed.");
      editing.current = false;
      setEditSnapshot(null);
    } catch (error) {
      setSaveError(profileErrorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const initials = profile?.name
    ? profile.name.split(/\s+/).slice(0, 2).map((word) => [...word][0]).join("").toUpperCase()
    : "R";

  return (
    <section className="profile-page" aria-labelledby="profile-heading">
      <div className="page-header">
        <div><h2 id="profile-heading">Profile</h2><p className="menu-helper">Manage restaurant contact and service details.</p></div>
        <div className="profile-page-actions">
          <button id="profile-refresh" className="button-secondary" onClick={reload} disabled={loading || Boolean(editSnapshot) || saving}>{loading ? "Loading…" : "Refresh profile"}</button>
          {profile && <button id="profile-edit" className="edit-profile-button" onClick={open} disabled={loading || saving}>Edit profile</button>}
        </div>
      </div>
      <p role="status" className="profile-success">{success}</p>
      {loading && <p className="menu-state" role="status">{profile ? "Refreshing restaurant profile…" : "Loading restaurant profile…"}</p>}
      {loadError && <div className="menu-feedback menu-feedback-error" role="alert"><p>{loadError}</p>{profile && <p>Showing the last loaded profile.</p>}<button className="button-secondary" onClick={reload} disabled={loading || saving || Boolean(editSnapshot)}>Retry loading profile</button></div>}
      {!loading && !loadError && !profile && <div className="menu-state profile-unavailable"><h3>Restaurant profile unavailable</h3><p>No restaurant details were returned. Refresh the profile to check again.</p></div>}
      {profile && (
        <section className="profile-overview" aria-label="Restaurant details">
          <div className="profile-identity">
            <span className="profile-avatar" aria-hidden="true">{initials}</span>
            <div><p className="profile-eyebrow">Restaurant</p><h3>{profile.name || "Restaurant name not provided"}</h3></div>
          </div>
          <dl className="profile-details">
            {PROFILE_FIELDS.filter(({ key }) => key !== "name").map(({ key, label }) => <div className="profile-detail" key={key}><dt>{label}</dt><dd>{profile[key] || <span className="profile-missing">Not provided</span>}</dd></div>)}
          </dl>
        </section>
      )}
      {editSnapshot && <MenuDialog title="Edit restaurant profile" onDismiss={dismiss} busy={saving} fallbackFocusSelector="#profile-edit, #profile-refresh"><ProfileForm original={editSnapshot} onSave={save} onCancel={dismiss} saving={saving} error={saveError} /></MenuDialog>}
    </section>
  );
};

export default ProfilePage;
