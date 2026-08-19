import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

const Products = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const { askConfirm } = useConfirm();

  const fetchProducts = async (pageNum, searchVal, categoryVal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 5 });
      if (searchVal) params.append('search', searchVal);
      if (categoryVal) params.append('category', categoryVal);
      const response = await api.get(`/products?${params.toString()}`);
      setProducts(response.data.products);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      fetchProducts(1, search, category);
    }, 400);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  useEffect(() => {
    fetchProducts(page, search, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

const handleDelete = async (id) => {
  const confirmed = await askConfirm('Are you sure you want to delete this product? This action cannot be undone.', 'Delete Product');
  if (!confirmed) return;
  try {
    await api.delete(`/products/${id}`);
    showToast('Product deleted successfully');
    fetchProducts(page, search, category);
  } catch (err) {
    showToast(err.response?.data?.message || 'Failed to delete product', 'error');
  }
};

  return (
    <Layout>
      <div className="page-header products-header-row">
        <h2>Products</h2>
        <button className="btn-primary btn-add-new" onClick={() => navigate('/products/add')}>
          + Add Product
        </button>
      </div>

      <div className="filters-row">
        <input
          type="text"
          placeholder="🔍 Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <input
          type="text"
          placeholder="Filter by category..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="category-input"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : products.length === 0 ? (
        <p className="empty-text">No products found.</p>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <div key={product._id} className="product-card">
              <div className="clickable-area" onClick={() => navigate(`/products/view/${product._id}`)}>
                {product.images && product.images[0] && (
                  <img src={`http://localhost:5000${product.images[0]}`} alt={product.name} />
                )}
                <span className="category-tag">{product.category}</span>
                <h4>{product.name}</h4>
                <p className="price">${product.price}</p>
                <p className="qty">Qty: {product.quantity}</p>
              </div>
              {user?.role === 'admin' && (
                <div className="card-actions">
                  <button className="btn-edit" onClick={() => navigate(`/products/edit/${product._id}`)}>Edit</button>
                  <button className="btn-delete" onClick={() => handleDelete(product._id)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages || 1}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </Layout>
  );
};

export default Products;