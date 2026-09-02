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

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

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
      dispatch(setCredentials({ user: res.data.user, token }));
      showToast('Profile updated successfully');
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match');
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
      dispatch(setCredentials({ user: res.data.user, token }));
      showToast('Password updated successfully');
      closePasswordModal();
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>My Profile</h2>
      </div>

      <div className="profile-header-card">
        <div className="profile-big-avatar">{initial}</div>
        <div className="profile-header-info">
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
          <span className={`role-tag ${user?.role === 'admin' ? 'role-admin' : 'role-user'}`}>{user?.role}</span>
        </div>
        {!editing && (
          <button className="btn-edit profile-edit-btn" onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        )}
      </div>

      {editing && (
        <div className="profile-edit-section">
          <h3 className="section-title">Edit Details</h3>
          {error && <p className="error-text">{error}</p>}

          <form onSubmit={handleUpdate} className="product-form edit-form">
            <div className="form-group">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Email (cannot be changed)</label>
              <input value={user?.email || ''} disabled />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">Save Changes</button>
              <button type="button" className="btn-cancel" onClick={resetForm}>Cancel</button>
            </div>
          </form>

          <button
            type="button"
            className="btn-edit"
            style={{ marginTop: '20px' }}
            onClick={() => setShowPasswordModal(true)}
          >
            Change Password
          </button>
        </div>
      )}

      {showPasswordModal && (
        <div className="confirm-overlay">
          <div className="confirm-box password-modal-box">
            <h3>Change Password</h3>
            {passwordError && <p className="error-text">{passwordError}</p>}

            <form onSubmit={handlePasswordSave} className="product-form edit-form">
              <div className="form-group">
                <label>Current Password</label>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              <div className="confirm-actions">
                <button type="button" className="btn-cancel" onClick={closePasswordModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={savingPassword}>
                  {savingPassword ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Profile;