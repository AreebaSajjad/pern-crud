import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';  
const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { showToast } = useToast();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [orderQty, setOrderQty] = useState(1);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const { askConfirm } = useConfirm(); 
  const [orderCount, setOrderCount] = useState(0);

 useEffect(() => {
  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      setProduct(response.data.product);

      if (user?.role === 'admin') {
        const ordersRes = await api.get(`/orders/product/${id}`);
        setOrderCount(ordersRes.data.orders.length);
      }
    } catch (err) {
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };
  fetchProduct();
}, [id, user]);

  const handleDelete = async () => {
     const ok = await askConfirm('Are you sure you want to delete this product? This action cannot be undone.'); if (!ok) return;
    try {
      await api.delete(`/products/${id}`);
      showToast('Product deleted successfully');
      navigate('/products');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete product', 'error');
    }
  };

  const handlePlaceOrder = async () => {
    if (placingOrder) return; // double-click guard — dobara click par kuch na ho

    if (orderQty < 1 || orderQty > product.quantity) {
      showToast(`Please enter a quantity between 1 and ${product.quantity}`, 'error');
      return;
    }

    const confirmed = await askConfirm(
      `Place order for ${orderQty} x ${product.name} — Total: $${(product.price * orderQty).toFixed(2)}?`,
      'Confirm Order'
    );
    if (!confirmed) return;

    setPlacingOrder(true);
    try {
      await api.post('/orders', { productId: product._id, quantity: orderQty });
      showToast('Order placed successfully');
      navigate('/orders');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to place order', 'error');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) return <Layout><Spinner /></Layout>;
  if (!product) return <Layout><p className="empty-text">{error || 'Product not found'}</p></Layout>;

  return (
    <Layout>
      <div className="detail-container">
        <button className="btn-back" onClick={() => navigate('/products')}>← Back to Products</button>

        <div className="detail-card">
          <div className="detail-images">
            <img
              src={`http://localhost:5000${product.images?.[activeImage]}`}
              alt={product.name}
              className="detail-image-main"
            />
            {product.images?.length > 1 && (
              <div className="detail-thumb-row">
                {product.images.map((img, index) => (
                  <img
                    key={index}
                    src={`http://localhost:5000${img}`}
                    alt={`${product.name}-${index}`}
                    className={`detail-thumb ${activeImage === index ? 'active' : ''}`}
                    onClick={() => setActiveImage(index)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="detail-info">
            <span className="category-tag">{product.category}</span>
            <h2>{product.name}</h2>
            <p className="detail-price">${product.price}</p>
            <p className="detail-qty">
              Quantity Available: {product.quantity}
              <span className={`stock-badge ${product.quantity > 0 ? 'stock-in' : 'stock-out'}`}>
                {product.quantity > 0 ? 'In Stock' : 'Out of Stock'}
              </span>
            </p>
            <p className="detail-description">{product.description}</p>
            {product.created_by_name && (
              <div className="seller-info-box">
                <span className="seller-info-label">Listed by</span>
                <div className="seller-info-row">
                  <div className="user-avatar-small">{product.created_by_name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="seller-name">{product.created_by_name}</p>
                    {user?.role === 'admin' && <p className="seller-email">{product.created_by_email}</p>}
                  </div>
                </div>
              </div>
            )}
            <div className="order-box">
              <label>
                Quantity:
                <input
                  type="number"
                  min="1"
                  max={product.quantity}
                  value={orderQty}
                  onChange={(e) => setOrderQty(Number(e.target.value))}
                  className="order-qty-input"
                />
              </label>
              <button
                className="btn-primary"
                onClick={handlePlaceOrder}
                disabled={placingOrder || product.quantity === 0}
              >
                {product.quantity === 0 ? 'Out of Stock' : placingOrder ? 'Placing...' : 'Place Order'}
              </button>
            </div>

            {user?.role === 'admin' && (
              <>
                <button className="total-orders-card" onClick={() => navigate(`/products/${id}/orders`)}>
  <span className="total-orders-icon">🧾</span>
  <span className="total-orders-text">
    <span className="total-orders-count">{orderCount}</span>
    <span className="total-orders-label">{orderCount === 1 ? 'Order Placed' : 'Orders Placed'}</span>
  </span>
  <span className="total-orders-arrow">→</span>
</button>

                <div className="detail-actions">
                  <button className="btn-edit" onClick={() => navigate(`/products/edit/${product._id}`)}>Edit</button>
                  <button className="btn-delete" onClick={handleDelete}>Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductDetail;