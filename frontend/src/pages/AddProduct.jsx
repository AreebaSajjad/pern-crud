import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const AddProduct = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(e.target.files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!category.trim()) errs.category = 'Category is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (quantity === '' || Number(quantity) < 0) errs.quantity = 'Quantity must be 0 or more';
    if (price === '' || Number(price) <= 0) errs.price = 'Price must be greater than 0';
    if (images.length < 1 || images.length > 5) errs.images = 'Select 1 to 5 images';
    return errs;
  };

  const handleCreate = async (e) => {
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
    for (let i = 0; i < images.length; i++) {
      formData.append('images', images[i]);
    }

    try {
      await api.post('/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Product added successfully');
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create product');
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Add Product</h2>
      </div>
      {error && <p className="error-text">{error}</p>}

      <form onSubmit={handleCreate} className="product-form edit-form">
        <div className="form-group">
          <label>Product Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wireless Headphones" />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </div>
        <div className="form-group">
          <label>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Electronics" />
          {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
        </div>
        <div className="form-group">
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
          {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
        </div>
        <div className="form-group">
          <label>Quantity</label>
          <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
          {fieldErrors.quantity && <span className="field-error">{fieldErrors.quantity}</span>}
        </div>
        <div className="form-group">
          <label>Price ($)</label>
          <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          {fieldErrors.price && <span className="field-error">{fieldErrors.price}</span>}
        </div>
        <div className="form-group">
          <label>Images (1 to 5)</label>
          <input type="file" multiple accept="image/*" onChange={handleImageChange} />
          {fieldErrors.images && <span className="field-error">{fieldErrors.images}</span>}
          {imagePreviews.length > 0 && (
            <div className="image-preview-row">
              {imagePreviews.map((src, i) => (
                <img key={i} src={src} alt="preview" className="preview-thumb" />
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">Add Product</button>
          <button type="button" className="btn-cancel" onClick={() => navigate('/products')}>Cancel</button>
        </div>
      </form>
    </Layout>
  );
};

export default AddProduct;