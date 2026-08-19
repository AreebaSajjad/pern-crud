import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog'; 
import { useNavigate } from 'react-router-dom';   

const STATUS_OPTIONS = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
   const { askConfirm } = useConfirm();    
   const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const fetchOrders = async () => {
  setLoading(true);
  try {
    const endpoint = user?.role === 'admin' ? '/orders' : '/orders/my';
    const response = await api.get(`${endpoint}?page=${page}&limit=10`);
    setOrders(response.data.orders);
    setTotalPages(response.data.totalPages);
  } catch (err) {
    showToast('Failed to load orders', 'error');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [page]);
  const handleStatusChange = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      showToast('Order status updated');
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const handleCancel = async (orderId) => {
     const ok = await askConfirm('Cancel this order?'); if (!ok) return;
    
    try {
      await api.delete(`/orders/${orderId}`);
      showToast('Order cancelled');
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel order', 'error');
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>{user?.role === 'admin' ? 'All Orders' : 'My Orders'}</h2>
      </div>

      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <p className="empty-text">No orders found.</p>
      ) : (
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                {user?.role === 'admin' && <th>Ordered By</th>}
                <th>Status</th>
                <th>Placed On</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="clickable-area" onClick={() => navigate(`/orders/${order.id}`)}>
                  <td data-label="Order #">#{order.id}</td>
                  <td data-label="Product">{order.product_name}</td>
                  <td data-label="Qty">{order.quantity}</td>
                  <td data-label="Total">${order.total}</td>
                  {user?.role === 'admin' && <td data-label="Ordered By">{order.user_name || order.user_id}</td>}
                  <td data-label="Status" onClick={(e) => e.stopPropagation()}>
                    {user?.role === 'admin' ? (
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className="status-select"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`status-badge status-${order.status}`}>{order.status}</span>
                    )}
                  </td>
                  <td data-label="Placed On">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td data-label="" onClick={(e) => e.stopPropagation()}>
  {(user?.role === 'admin' || order.status === 'pending') && (
    <button className="btn-delete" onClick={() => handleCancel(order.id)}>
      {user?.role === 'admin' ? 'Delete' : 'Cancel'}
    </button>
  )}
</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
  <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
  <span>Page {page} of {totalPages || 1}</span>
  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
</div>
        </div>
      )}
    </Layout>
  );
};

export default Orders;
