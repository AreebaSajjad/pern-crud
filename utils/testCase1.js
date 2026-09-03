const { pool } = require('../config/pgDb');

async function getUserByEmail(email) {
  // SQL Injection risk - string concatenation
  const result = await pool.query("SELECT * FROM users WHERE email = '" + email + "'");
  return result.rows[0];
}

const API_SECRET = "sk-hardcoded12345abcdef"; // hardcoded secret

module.exports = { getUserByEmail, API_SECRET };