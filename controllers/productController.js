const { pool } = require('../config/pgDb');
const { syncProductEmbedding, removeProductEmbedding } = require('../utils/embeddingSync');
const { syncProductOkf, removeProductOkf } = require('../utils/okfGenerator');

// CREATE
const createProduct = async (req, res) => {
  try {
    const { name, category, description, quantity, price } = req.body;

    if (!name || !category || !description || !quantity || !price) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Please upload at least 1 image' });
    }

    if (req.files.length > 5) {
      return res.status(400).json({ message: 'You can upload maximum 5 images' });
    }

    const imagePaths = req.files.map((file) => `/uploads/${file.filename}`);

    const result = await pool.query(
     `INSERT INTO products (name, category, description, quantity, price, images, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id AS "_id", name, category, description, quantity, price, images, created_at, updated_at, created_by`,
      [name, category, description, quantity, price, imagePaths, req.user.id]
    );

    const product = result.rows[0];
    syncProductEmbedding(product);
    syncProductOkf(product);

    res.status(201).json({
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET ALL - with pagination + search + category filter (soft-deleted rows hidden)
const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search, category } = req.query;

    const conditions = ['deleted_at IS NULL'];
    const values = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }
    if (category) {
      values.push(`%${category}%`);
      conditions.push(`category ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${whereClause}`, values);
    const totalProducts = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalProducts / limit);

    values.push(limit, offset);
    const productsResult = await pool.query(
      `SELECT id AS "_id", name, category, description, quantity, price, images, created_at, updated_at
       FROM products ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.status(200).json({
      totalProducts,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      products: productsResult.rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET ONE
const getProductById = async (req, res) => {
  try {
    const result = await pool.query(
     `SELECT p.id AS "_id", p.name, p.category, p.description, p.quantity, p.price, p.images,
              p.created_at, p.updated_at, p.created_by, u.name AS created_by_name, u.email AS created_by_email
       FROM products p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({ product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// UPDATE (full - PUT)
const updateProduct = async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const current = existing.rows[0];

    const name = req.body.name ?? current.name;
    const category = req.body.category ?? current.category;
    const description = req.body.description ?? current.description;
    const quantity = req.body.quantity ?? current.quantity;
    const price = req.body.price ?? current.price;

    // Pehle se maujood images mein se jo hata deni thi wo nikaal do,
    // phir naye upload huye add kar do (max 5 total).
    let images = current.images || [];
    if (req.body.removeImages) {
      try {
        const toRemove = JSON.parse(req.body.removeImages);
        images = images.filter((img) => !toRemove.includes(img));
      } catch (e) {
        // invalid JSON — ignore, existing images ko chhed nahi karte
      }
    }
    if (req.files && req.files.length) {
      const newImages = req.files.map((file) => `/uploads/${file.filename}`);
      images = [...images, ...newImages].slice(0, 5);
    }

    const result = await pool.query(
      `UPDATE products SET name = $1, category = $2, description = $3, quantity = $4, price = $5, images = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING id AS "_id", name, category, description, quantity, price, images, created_at, updated_at`,
      [name, category, description, quantity, price, images, req.params.id]
    );

    const updatedProduct = result.rows[0];
    syncProductEmbedding(updatedProduct);
    syncProductOkf(updatedProduct);

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// UPDATE (single field - PATCH)
const patchProduct = async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const allowedFields = ['name', 'category', 'description', 'quantity', 'price'];
    const setClauses = [];
    const values = [];

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        values.push(req.body[key]);
        setClauses.push(`${key} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE products SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id AS "_id", name, category, description, quantity, price, images, created_at, updated_at`,
      values
    );

    const updatedProduct = result.rows[0];
    syncProductEmbedding(updatedProduct);
    syncProductOkf(updatedProduct);

    res.status(200).json({
      message: 'Product field updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE — ab SOFT delete hai (row nahi hatti, sirf deleted_at set hota hai)
const deleteProduct = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE products SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    removeProductEmbedding(req.params.id);
    removeProductOkf(req.params.id);

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  patchProduct,
  deleteProduct,
};