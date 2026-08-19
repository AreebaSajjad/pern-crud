import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

const EditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [existingImages, setExistingImages] = useState([]); // image paths already saved
  const [removedImages, setRemovedImages] = useState([]); // paths marked for removal
  const [newImages, setNewImages] = useState([]); // freshly picked File objects
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await api.get(`/products/${id}`);
        const product = response.data.product;
        setName(product.name);
        setCategory(product.category);
        setDescription(product.description);
        setQuantity(product.quantity);
        setPrice(product.price);
        setExistingImages(product.images || []);
      } catch (err) {
        setError('Failed to load product');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const remainingSlots = 5 - (existingImages.length - removedImages.length) - newImages.length;

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, Math.max(remainingSlots, 0));
    setNewImages(files);
    setNewImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const toggleRemoveExisting = (imgPath) => {
    setRemovedImages((prev) =>
      prev.includes(imgPath) ? prev.filter((p) => p !== imgPath) : [...prev, imgPath]
    );
  };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!category.trim()) errs.category = 'Category is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (quantity === '' || Number(quantity) < 0) errs.quantity = 'Quantity must be 0 or more';
    if (price === '' || Number(price) <= 0) errs.price = 'Price must be greater than 0';
    return errs;
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('description', description);
    formData.append('quantity', quantity);
    formData.append('price', price);
    if (removedImages.length) {
      formData.append('removeImages', JSON.stringify(removedImages));
    }
    newImages.forEach((file) => formData.append('images', file));

    try {
      await api.put(`/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Product updated successfully');
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update product');
    }
  };

  if (loading) return <Layout><Spinner /></Layout>;

  return (
    <Layout>
      <div className="page-header">
        <h2>Edit Product</h2>
      </div>
      {error && <p className="error-text">{error}</p>}

      <form onSubmit={handleUpdate} className="product-form edit-form">
        <div className="form-group">
          <label>Product Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </div>
        <div className="form-group">
          <label>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
          {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
        </div>
        <div className="form-group">
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
          {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
        </div>
        <div className="form-group">
          <label>Quantity</label>
          <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          {fieldErrors.quantity && <span className="field-error">{fieldErrors.quantity}</span>}
        </div>
        <div className="form-group">
          <label>Price ($)</label>
          <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} />
          {fieldErrors.price && <span className="field-error">{fieldErrors.price}</span>}
        </div>

        <div className="form-group">
          <label>Images</label>

          {existingImages.length > 0 && (
            <div className="image-preview-row">
              {existingImages.map((img) => (
                <div key={img} style={{ position: 'relative', opacity: removedImages.includes(img) ? 0.4 : 1 }}>
                  <img src={`http://localhost:5000${img}`} alt="product" className="preview-thumb" />
                  <button
                    type="button"
                    onClick={() => toggleRemoveExisting(img)}
                    title={removedImages.includes(img) ? 'Undo remove' : 'Remove image'}
                    style={{
                      position: 'absolute', top: -6, right: -6, borderRadius: '50%',
                      width: 20, height: 20, lineHeight: '20px', textAlign: 'center',
                      background: removedImages.includes(img) ? '#4caf50' : '#e53935',
                      color: '#fff', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    {removedImages.includes(img) ? '↺' : '×'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {remainingSlots > 0 ? (
            <input type="file" multiple accept="image/*" onChange={handleImageChange} />
          ) : (
            <p className="field-error">Max 5 images reached — remove one to add another.</p>
          )}

          {newImagePreviews.length > 0 && (
            <div className="image-preview-row">
              {newImagePreviews.map((src, i) => (
                <img key={i} src={src} alt="new preview" className="preview-thumb" />
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">Update Product</button>
          <button type="button" className="btn-cancel" onClick={() => navigate('/products')}>Cancel</button>
        </div>
      </form>
    </Layout>
  );
};

export default EditProduct;
