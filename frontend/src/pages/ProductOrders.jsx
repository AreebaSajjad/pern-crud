import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';

const ProductOrders = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const productRes = await api.get(`/products/${id}`);
        setProduct(productRes.data.product);

        const ordersRes = await api.get(`/orders/product/${id}`);
        setOrders(ordersRes.data.orders);
      } catch (err) {
        // ignore, empty state will show
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <Layout><Spinner /></Layout>;

  return (
    <Layout>
      <div className="detail-container">
        <button className="btn-back" onClick={() => navigate(`/products/view/${id}`)}>← Back to Product</button>

        <div className="page-header">
          <h2>Orders for {product?.name || 'this Product'}</h2>
        </div>

        {orders.length === 0 ? (
          <p className="empty-text">No orders placed for this product yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="clickable-area" onClick={() => navigate(`/users/${o.user_id}`)}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-small">{o.user_name?.charAt(0).toUpperCase()}</div>
                        {o.user_name}
                      </div>
                    </td>
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
    </Layout>
  );
};

export default ProductOrders;