// controllers/testReviewController.js — FIXED version
const { pool } = require('../config/pgDb');

async function getUserByEmail(req, res) {
  try {
    const { email } = req.query;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getUserByEmail };