const { pool } = require('../config/pgDb');

// BUG 1: SQL Injection
async function getUserByEmail(req, res) {
  const email = req.query.email;
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  const result = await pool.query(query);
  res.json(result.rows);
}

// BUG 2: Missing auth check
async function getAllUsersUnprotected(req, res) {
  const result = await pool.query('SELECT id, email, password FROM users');
  res.json(result.rows);
}

// BUG 3: Error handling missing
async function deleteUserById(req, res) {
  const { id } = req.params;
  await pool.query(`DELETE FROM users WHERE id = ${id}`);
  res.json({ message: 'Deleted' });
}

module.exports = {
  getUserByEmail,
  getAllUsersUnprotected,
  deleteUserById
};