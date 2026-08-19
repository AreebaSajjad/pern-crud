import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../redux/authSlice';

const Navbar = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="navbar">
      <div className="navbar-brand">MyStore</div>
      <div className="navbar-links">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/products">Products</Link>
        {user?.role === 'admin' && <Link to="/users">Users</Link>}
      </div>
      <div className="navbar-right">
        <span className="navbar-user">{user?.name} ({user?.role})</span>
        <button className="btn-logout-small" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
};

export default Navbar;