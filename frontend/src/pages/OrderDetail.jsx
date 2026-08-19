import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data.order);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (loading) return <Layout><Spinner /></Layout>;
  if (!order) return <Layout><p className="empty-text">{error || 'Order not found'}</p></Layout>;

  return (
    <Layout>
      <div className="detail-container">
        <button className="btn-back" onClick={() => navigate('/orders')}>← Back to Orders</button>

        <div className="order-detail-card">
          <div className="order-detail-header">
            <div>
              <h2>Order #{order.id}</h2>
              <p className="order-detail-date">Placed on {new Date(order.created_at).toLocaleDateString()}</p>
            </div>
            <span className={`status-badge status-${order.status}`}>{order.status}</span>
          </div>

          <div className="order-detail-section">
            <h3 className="section-title">Product</h3>
            <div className="order-detail-product">
              {order.product_images?.[0] && (
                <img src={`http://localhost:5000${order.product_images[0]}`} alt={order.product_name} className="order-detail-thumb" />
              )}
              <div>
                <p className="order-detail-product-name">{order.product_name}</p>
                <span className="category-tag">{order.product_category}</span>
              </div>
            </div>
          </div>

          <div className="order-detail-grid">
            <div className="order-detail-item">
              <span className="order-detail-label">Quantity</span>
              <span className="order-detail-value">{order.quantity}</span>
            </div>
            <div className="order-detail-item">
              <span className="order-detail-label">Price (each)</span>
              <span className="order-detail-value">${order.price}</span>
            </div>
            <div className="order-detail-item">
              <span className="order-detail-label">Total</span>
              <span className="order-detail-value order-detail-total">${order.total}</span>
            </div>
          </div>

          {user?.role === 'admin' && (
            <div className="order-detail-section">
              <h3 className="section-title">Buyer</h3>
              <div
                className="order-detail-buyer clickable-area"
                onClick={() => navigate(`/users/${order.buyer_id}`)}
              >
                <div className="user-avatar-small">{order.user_name?.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="order-detail-product-name">{order.user_name}</p>
                  <p className="order-detail-date">{order.user_email}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default OrderDetail;