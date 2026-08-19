const jwt = require('jsonwebtoken');
const { pool } = require('../config/pgDb');

const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer')) {
    try {
      token = authHeader.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Soft-deleted user ka purana token expire hone se pehle bhi reject ho —
      // warna delete hone ke baad bhi 1 din tak wo login rehta
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL', [decoded.id]);
      if (userCheck.rows.length === 0) {
        return res.status(401).json({ message: 'Not authorized, account not found' });
      }

      req.user = decoded;

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = protect;