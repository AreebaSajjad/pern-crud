import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { logout } from '../redux/authSlice';
import { useConfirm } from '../components/ConfirmDialog';   

const Sidebar = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
   const { askConfirm } = useConfirm();

 const handleLogout = async () => {
    const ok = await askConfirm('Are you sure you want to logout?', 'Log out');
    if (ok) {
      dispatch(logout());
      navigate('/login', { replace: true });
    }
  };

  const isActive = (path) => location.pathname === path;
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <>
      <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : '☰'}
      </button>

      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>}

      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">🏬</span>
          MyStore
        </div>

        <nav className="sidebar-links">
          <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''} onClick={() => setIsOpen(false)}>
            <span className="icon">🏠</span> Dashboard
          </Link>
          <Link to="/products" className={isActive('/products') ? 'active' : ''} onClick={() => setIsOpen(false)}>
  <span className="icon">📦</span> Products
</Link>
{user?.role === 'admin' && (
  <Link to="/users" className={isActive('/users') ? 'active' : ''} onClick={() => setIsOpen(false)}>
    <span className="icon">👥</span> Users
  </Link>
)}
<Link to="/meetings" className={isActive('/meetings') ? 'active' : ''} onClick={() => setIsOpen(false)}>
  <span className="icon">📅</span> Meetings
</Link>
<Link to="/orders" className={isActive('/orders') ? 'active' : ''} onClick={() => setIsOpen(false)}>
  <span className="icon">🧾</span> Orders
</Link>
          <Link to="/chatbot" className={isActive('/chatbot') ? 'active' : ''} onClick={() => setIsOpen(false)}>
            <span className="icon">🤖</span> AI Assistant
          </Link>
          <Link to="/okf-query" className={isActive('/okf-query') ? 'active' : ''} onClick={() => setIsOpen(false)}>
            <span className="icon">📄</span> OKF Query
          </Link>
          <Link to="/knowledge-base" className={isActive('/knowledge-base') ? 'active' : ''} onClick={() => setIsOpen(false)}>
            <span className="icon">📚</span> Knowledge Base
          </Link>
          <Link to="/profile" className={isActive('/profile') ? 'active' : ''} onClick={() => setIsOpen(false)}>
            <span className="icon">⚙️</span> Profile
          </Link>
          
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initial}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-role">{user?.role}</span>
            </div>
          </div>
          <button className="btn-logout-small" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;