import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import CountdownTimer from '../components/CountdownTimer';

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [recentProducts, setRecentProducts] = useState([]);
  const [nextMeeting, setNextMeeting] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const productsRes = await api.get('/products?page=1&limit=4');
        setTotalProducts(productsRes.data.totalProducts);
        setRecentProducts(productsRes.data.products);

        if (user?.role === 'admin') {
          const usersRes = await api.get('/auth/users');
          setTotalUsers(usersRes.data.users.length);

          const meetingsRes = await api.get('/meetings');
          const now = new Date();
          const upcoming = meetingsRes.data.meetings
            .filter((m) => new Date(`${m.date}T${m.time}`) >= now)
            .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
          setNextMeeting(upcoming[0] || null);
        }
      } catch (err) {
        console.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  if (loading) return <Layout><Spinner /></Layout>;

  return (
    <Layout>
      <div className="page-header">
        <h2>Welcome back, {user?.name} 👋</h2>
        <p className="page-subtitle">Here's what's happening in your store today.</p>
      </div>

      <div className="stats-row">
        <div className="stat-card stat-blue">
          <div className="stat-icon-wrap">📦</div>
          <div>
            <div className="stat-number">{totalProducts}</div>
            <div className="stat-label">Total Products</div>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="stat-card stat-purple">
            <div className="stat-icon-wrap">👥</div>
            <div>
              <div className="stat-number">{totalUsers}</div>
              <div className="stat-label">Total Users</div>
            </div>
          </div>
        )}
      </div>

      {user?.role === 'admin' && nextMeeting && (
        <div className="next-meeting-widget">
          <div className="next-meeting-label">📅 Next Meeting</div>
          <div className="next-meeting-title">{nextMeeting.title}</div>
          <div className="next-meeting-with">with {nextMeeting.attendee?.name}</div>
          <CountdownTimer date={nextMeeting.date} time={nextMeeting.time} />
        </div>
      )}

      <div className="quick-actions">
        <button className="btn-primary quick-btn" onClick={() => navigate('/products/add')}>
          + Add Product
        </button>
        {user?.role === 'admin' && (
          <button className="btn-quick-secondary" onClick={() => navigate('/users')}>
            Manage Users
          </button>
        )}
      </div>

      <div className="section-title-row">
        <h3 className="section-title">Recent Products</h3>
        <span className="view-all-link" onClick={() => navigate('/products')}>View all →</span>
      </div>

      {recentProducts.length === 0 ? (
        <p className="empty-text">No products yet. Add your first product to get started.</p>
      ) : (
        <div className="product-grid">
          {recentProducts.map((product) => (
            <div
              key={product._id}
              className="product-card clickable-area"
              onClick={() => navigate(`/products/view/${product._id}`)}
            >
              {product.images && product.images[0] && (
                <img src={`http://localhost:5000${product.images[0]}`} alt={product.name} />
              )}
              <span className="category-tag">{product.category}</span>
              <h4>{product.name}</h4>
              <p className="price">${product.price}</p>
              <p className="qty">Qty: {product.quantity}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;