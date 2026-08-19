const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');
const upload = require('../middleware/upload');
const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  patchProduct,
  deleteProduct,
} = require('../controllers/productController');

// Sab logged-in users add/dekh sakte hain
router.post('/', protect, upload.array('images', 5), createProduct);
router.get('/', protect, getAllProducts);
router.get('/:id', protect, getProductById);
router.put('/:id', protect, upload.array('images', 5), updateProduct);
router.patch('/:id', protect, patchProduct);

// Sirf admin delete kar sakta hai
router.delete('/:id', protect, isAdmin, deleteProduct);

module.exports = router;