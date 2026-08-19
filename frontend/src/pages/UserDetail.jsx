import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get(`/auth/${id}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  if (loading) return <Layout><Spinner /></Layout>;
  if (!data) return <Layout><p className="empty-text">{error || 'User not found'}</p></Layout>;

  const { user: targetUser, orders, meetings } = data;

  return (
    <Layout>
      <div className="detail-container">
        <button className="btn-back" onClick={() => navigate('/users')}>← Back to Users</button>

        <div className="profile-header-card">
          <div className="profile-big-avatar">{targetUser.name?.charAt(0).toUpperCase()}</div>
          <div className="profile-header-info">
            <h3>{targetUser.name}</h3>
            <p>{targetUser.email}</p>
            <span className={`role-tag ${targetUser.role === 'admin' ? 'role-admin' : 'role-user'}`}>{targetUser.role}</span>
          </div>
          <p className="order-detail-date">Joined {new Date(targetUser.created_at).toLocaleDateString()}</p>
        </div>

        <div className="product-orders-section">
          <h3 className="section-title">Orders ({orders.length})</h3>
          {orders.length === 0 ? (
            <p className="empty-text">No orders placed yet.</p>
          ) : (
            <div className="table-wrapper">
              <table className="users-table">
                <thead>
                  <tr><th>Order #</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="clickable-area" onClick={() => navigate(`/orders/${o.id}`)}>
                      <td>#{o.id}</td>
                      <td>{o.product_name}</td>
                      <td>{o.quantity}</td>
                      <td>${o.total}</td>
                      <td><span className={`status-badge status-${o.status}`}>{o.status}</span></td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="product-orders-section">
          <h3 className="section-title">Meetings ({meetings.length})</h3>
          {meetings.length === 0 ? (
            <p className="empty-text">No meetings scheduled.</p>
          ) : (
            <div className="table-wrapper">
              <table className="users-table">
                <thead>
                  <tr><th>Title</th><th>Date</th><th>Time</th><th>Mode</th></tr>
                </thead>
                <tbody>
                  {meetings.map((m) => (
                    <tr key={m.id}>
                      <td>{m.title}</td>
                      <td>{m.date}</td>
                      <td>{m.time}</td>
                      <td style={{ textTransform: 'capitalize' }}>{m.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default UserDetail;