import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../services/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { setCredentials } from '../redux/authSlice';
import PasswordInput from '../components/PasswordInput';

const Profile = () => {
  const { user, token } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const initial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : '?';

  const resetForm = () => {
    setEditing(false);
    setName(user?.name || '');
    setError('');
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await api.put('/auth/profile', { name });

      dispatch(
        setCredentials({
          user: res.data.user,
          token,
        })
      );

      showToast('Profile updated successfully');
      resetForm();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to update profile'
      );
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError(
        'Please enter your current password'
      );
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(
        'New password must be at least 6 characters'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        'New password and confirm password do not match'
      );
      return;
    }

    setSavingPassword(true);

    try {
      const res = await api.put('/auth/profile', {
        name: user?.name,
        currentPassword,
        newPassword,
        confirmPassword,
      });

      dispatch(
        setCredentials({
          user: res.data.user,
          token,
        })
      );

      showToast('Password updated successfully');
      closePasswordModal();
    } catch (err) {
      setPasswordError(
        err.response?.data?.message ||
          'Failed to update password'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Layout>
      <div className="profile-page">

        {/* PAGE HEADER */}
        <div className="profile-page-header">
          <div>
            <h2>My Profile</h2>
            <p>
              Manage your personal information and account
              settings.
            </p>
          </div>
        </div>

        {/* PROFILE TOP CARD */}
        <div className="profile-main-card">

          <div className="profile-cover"></div>

          <div className="profile-card-content">

            {/* AVATAR */}
            <div className="profile-avatar-wrapper">
              <div className="profile-big-avatar">
                {user?.profileImage ||
                user?.profilePicture ||
                user?.avatar ||
                user?.image ? (
                  <img
                    src={
                      user?.profileImage ||
                      user?.profilePicture ||
                      user?.avatar ||
                      user?.image
                    }
                    alt={user?.name || 'Profile'}
                  />
                ) : (
                  initial
                )}
              </div>
            </div>

            {/* PROFILE INFO */}
            <div className="profile-user-info">
              <h3>{user?.name || 'User'}</h3>

              <span
                className={`role-tag ${
                  user?.role === 'admin'
                    ? 'role-admin'
                    : 'role-user'
                }`}
              >
                {user?.role || 'User'}
              </span>

              <p className="profile-description">
                Manage your account information and
                security settings.
              </p>
            </div>

            {!editing && (
              <button
                className="btn-edit profile-edit-btn"
                onClick={() => setEditing(true)}
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* CONTACT INFO */}
          <div className="profile-contact-info">

            <div className="profile-contact-item">
              <span className="contact-icon">✉</span>
              <div>
                <small>Email Address</small>
                <p>{user?.email || '—'}</p>
              </div>
            </div>

            <div className="profile-contact-item">
              <span className="contact-icon">☎</span>
              <div>
                <small>Phone Number</small>
                <p>
                  {user?.phone ||
                    user?.phoneNumber ||
                    '+92 300 1234567'}
                </p>
              </div>
            </div>

            <div className="profile-contact-item">
              <span className="contact-icon">◷</span>
              <div>
                <small>Account Role</small>
                <p>
                  {user?.role === 'admin'
                    ? 'Administrator'
                    : 'User'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* EDIT DETAILS */}
        {editing && (
          <div className="profile-section-card">

            <div className="profile-section-header">
              <div>
                <h3>Edit Details</h3>
                <p>
                  Update your account information.
                </p>
              </div>
            </div>

            {error && (
              <p className="error-text">{error}</p>
            )}

            <form
              onSubmit={handleUpdate}
              className="product-form edit-form"
            >

              <div className="form-group">
                <label>Name</label>

                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Email Address
                </label>

                <input
                  value={user?.email || ''}
                  disabled
                />

                <small className="input-help">
                  Email address cannot be changed.
                </small>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save Changes
                </button>

                <button
                  type="button"
                  className="btn-cancel"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* CHANGE PASSWORD */}
            <div className="password-section">
              <div>
                <h3>Security</h3>
                <p>
                  Manage your account password and
                  security.
                </p>
              </div>

              <button
                type="button"
                className="btn-edit"
                onClick={() =>
                  setShowPasswordModal(true)
                }
              >
                Change Password
              </button>
            </div>
          </div>
        )}

        {/* ACCOUNT DETAILS */}
        {!editing && (
          <div className="profile-details-grid">

            {/* ACCOUNT INFORMATION */}
            <div className="profile-section-card">

              <div className="profile-section-header">
                <div>
                  <h3>Account Information</h3>
                  <p>
                    Your account and personal
                    information.
                  </p>
                </div>

                <button
                  className="small-edit-btn"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
              </div>

              <div className="account-details-list">

                <div className="account-detail-row">
                  <div className="detail-label">
                    <span>👤</span>
                    <span>Full Name</span>
                  </div>

                  <strong>
                    {user?.name || '—'}
                  </strong>
                </div>

                <div className="account-detail-row">
                  <div className="detail-label">
                    <span>✉</span>
                    <span>Email Address</span>
                  </div>

                  <strong>
                    {user?.email || '—'}
                  </strong>
                </div>

                <div className="account-detail-row">
                  <div className="detail-label">
                    <span>☎</span>
                    <span>Phone Number</span>
                  </div>

                  <strong>
                    {user?.phone ||
                      user?.phoneNumber ||
                      '+92 300 1234567'}
                  </strong>
                </div>

                <div className="account-detail-row">
                  <div className="detail-label">
                    <span>🛡</span>
                    <span>Role</span>
                  </div>

                  <span className="role-tag role-admin">
                    {user?.role === 'admin'
                      ? 'Administrator'
                      : 'User'}
                  </span>
                </div>

                <div className="account-detail-row">
                  <div className="detail-label">
                    <span>●</span>
                    <span>Account Status</span>
                  </div>

                  <span className="status-active">
                    ● Active
                  </span>
                </div>

              </div>
            </div>

            {/* SECURITY */}
            <div className="profile-section-card">

              <div className="profile-section-header">
                <div>
                  <h3>Security</h3>
                  <p>
                    Manage your password and account
                    security.
                  </p>
                </div>

                <button
                  className="small-edit-btn"
                  onClick={() =>
                    setShowPasswordModal(true)
                  }
                >
                  Change Password
                </button>
              </div>

              <div className="security-row">
                <div className="detail-label">
                  <span>🔒</span>
                  <span>Password</span>
                </div>

                <strong>••••••••</strong>
              </div>

              <div className="security-row">
                <div className="detail-label">
                  <span>🛡</span>
                  <span>Account Security</span>
                </div>

                <span className="status-active">
                  ● Protected
                </span>
              </div>

            </div>
          </div>
        )}

        {/* PASSWORD MODAL */}
        {showPasswordModal && (
          <div className="confirm-overlay">

            <div className="confirm-box password-modal-box">

              <h3>Change Password</h3>

              {passwordError && (
                <p className="error-text">
                  {passwordError}
                </p>
              )}

              <form
                onSubmit={handlePasswordSave}
                className="product-form edit-form"
              >

                <div className="form-group">
                  <label>Current Password</label>

                  <PasswordInput
                    value={currentPassword}
                    onChange={(e) =>
                      setCurrentPassword(e.target.value)
                    }
                    placeholder="Enter your current password"
                  />
                </div>

                <div className="form-group">
                  <label>New Password</label>

                  <PasswordInput
                    value={newPassword}
                    onChange={(e) =>
                      setNewPassword(e.target.value)
                    }
                    placeholder="At least 6 characters"
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>

                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    placeholder="Re-enter new password"
                  />
                </div>

                <div className="confirm-actions">

                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={closePasswordModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingPassword}
                  >
                    {savingPassword
                      ? 'Saving...'
                      : 'Save Password'}
                  </button>

                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default Profile;