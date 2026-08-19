const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');
const {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrdersByProduct,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} = require('../controllers/orderController');

router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/', protect, isAdmin, getAllOrders);
router.get('/product/:productId', protect, isAdmin, getOrdersByProduct);
router.get('/:id', protect, getOrderById);
router.patch('/:id/status', protect, isAdmin, updateOrderStatus);
router.delete('/:id', protect, deleteOrder);

module.exports = router;