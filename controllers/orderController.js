const { pool } = require('../config/pgDb');
const { syncProductEmbedding } = require('../utils/embeddingSync');

// Naya order place karna
const createOrder = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'productId and a valid quantity are required' });
    }

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [productId]);
    const product = productResult.rows[0];
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingPending = await pool.query(
      `SELECT id FROM orders WHERE user_id = $1 AND product_id = $2 AND status = 'pending' AND deleted_at IS NULL`,
      [req.user.id, productId]
    );
    if (existingPending.rows.length > 0) {
      return res.status(409).json({ message: 'You already have a pending order for this product. Please wait for it to be processed or cancel it first.' });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ message: `Only ${product.quantity} item(s) left in stock` });
    }

    const total = product.price * quantity;

    const result = await pool.query(
      `INSERT INTO orders (user_id, product_id, quantity, price, total, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [req.user.id, productId, quantity, product.price, total]
    );

    const updatedProductResult = await pool.query(
      'UPDATE products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [quantity, productId]
    );
    syncProductEmbedding(updatedProductResult.rows[0]);

    res.status(201).json({ message: 'Order placed successfully', order: result.rows[0] });
  } catch (error) {
    console.error('Orders error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Apne khud ke orders — pagination ke sath
const getMyOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );
    const totalOrders = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalOrders / limit);

    const result = await pool.query(
      `SELECT o.*, p.name AS product_name
       FROM orders o JOIN products p ON p.id = o.product_id
       WHERE o.user_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.status(200).json({
      totalOrders,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      orders: result.rows,
    });
  } catch (error) {
    console.error('Orders error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin — saare orders — pagination ke sath
const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL');
    const totalOrders = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalOrders / limit);

    const result = await pool.query(
      `SELECT o.*, p.name AS product_name, u.name AS user_name, u.email AS user_email
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN users u ON u.id = o.user_id
       WHERE o.deleted_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      totalOrders,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      orders: result.rows,
    });
  } catch (error) {
    console.error('Orders error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// NAYA — Admin: ek specific product ke saare orders dekhna (kisne order kiya)
const getOrdersByProduct = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.name AS user_name, u.email AS user_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.product_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC`,
      [req.params.productId]
    );
    res.status(200).json({ orders: result.rows });
  } catch (error) {
    console.error('Orders error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*,
              p.name AS product_name, p.category AS product_category, p.images AS product_images,
              u.id AS buyer_id, u.name AS user_name, u.email AS user_email
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN users u ON u.id = o.user_id
       WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [req.params.id]
    );
    const order = result.rows[0];

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.status(200).json({ order });
  } catch (error) {
    console.error('Orders error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *',
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ message: 'Order status updated', order: result.rows[0] });
  } catch (error) {
    console.error('Orders error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Soft delete
const deleteOrder = async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM orders WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    const order = existing.rows[0];

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.query('UPDATE orders SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    res.status(200).json({ message: 'Order deleted' });
  } catch (error) {
    console.error('Orders error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrdersByProduct,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
};