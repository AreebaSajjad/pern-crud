const { pool } = require('../config/pgDb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { sendEmail } = require('../utils/mailer');
const { resetPasswordEmail } = require('../templates/resetPasswordEmail');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const RESET_CODE_EXPIRY_MINUTES = 10;

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google Sign-In. Please log in with Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GOOGLE LOGIN — frontend se Google ID token aata hai, verify karke
// user ko login ya (agar naya hai) signup kar dete hain
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body; // Google Identity Services se mila ID token
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: 'Google email not verified' });
    }

    // Pehle google_id se dhoondo, phir email se (purana account link karne ke liye)
    let result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1 AND deleted_at IS NULL',
      [googleId]
    );
    let user = result.rows[0];

    if (!user) {
      result = await pool.query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
      user = result.rows[0];

      if (user) {
        // Existing email/password account ko Google se link kar do
        const updated = await pool.query(
          'UPDATE users SET google_id = $1 WHERE id = $2 RETURNING *',
          [googleId, user.id]
        );
        user = updated.rows[0];
      } else {
        // Bilkul naya user — password NULL rehta hai (sirf Google se login hoga)
        const inserted = await pool.query(
          'INSERT INTO users (name, email, password, google_id) VALUES ($1, $2, NULL, $3) RETURNING *',
          [name || email.split('@')[0], email, googleId]
        );
        user = inserted.rows[0];
      }
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: 'Google login failed', error: error.message });
  }
};

// FORGOT PASSWORD — email par 6-digit code bhejta hai, DB mein sirf iska hash save hota hai
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    const user = result.rows[0];

    // User exist na kare tab bhi same success message — taake attacker ko pata na chale
    // ke konsa email registered hai (email enumeration se bachne ke liye)
    if (!user) {
      return res.status(200).json({ message: 'If this email exists, a reset code has been sent.' });
    }

    const code = String(crypto.randomInt(100000, 999999)); // 6-digit code
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      'UPDATE users SET reset_code_hash = $1, reset_code_expires = $2 WHERE id = $3',
      [codeHash, expiresAt, user.id]
    );

    await sendEmail({
      to: user.email,
      subject: `Password Reset Code - ${process.env.COMPANY_NAME || 'Our App'}`,
      html: resetPasswordEmail({
        name: user.name,
        code,
        companyName: process.env.COMPANY_NAME || 'Our App',
        expiryMinutes: RESET_CODE_EXPIRY_MINUTES,
      }),
    });

    res.status(200).json({ message: 'If this email exists, a reset code has been sent.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// RESET PASSWORD — code + new/confirm password verify karke password change karta hai
const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirm password do not match' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    const user = result.rows[0];

    if (!user || !user.reset_code_hash || !user.reset_code_expires) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }
    if (new Date(user.reset_code_expires) < new Date()) {
      return res.status(400).json({ message: 'Reset code has expired, please request a new one' });
    }

    const isCodeValid = await bcrypt.compare(code, user.reset_code_hash);
    if (!isCodeValid) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password = $1, reset_code_hash = NULL, reset_code_expires = NULL, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin kisi bhi user ko soft-delete kare
const deleteUser = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET ALL USERS — ab pagination ke sath
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL');
    const totalUsers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalUsers / limit);

    const result = await pool.query(
      `SELECT id AS "_id", name, email, role, created_at, updated_at
       FROM users WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      totalUsers,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      users: result.rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PROFILE UPDATE — ab current password verify hoti hai, aur confirm password backend pe bhi check hoti hai
const updateProfile = async (req, res) => {
  try {
    const { name, currentPassword, newPassword, confirmPassword } = req.body;

    const existing = await pool.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [req.user.id]);
    const user = existing.rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    let newName = user.name;
    let newHashedPassword = user.password;

    if (name) newName = name;

    // Agar password change karna hai, to teeno fields aani chahiye aur sahi honi chahiye
    if (newPassword || currentPassword || confirmPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirm password do not match' });
      }

      const salt = await bcrypt.genSalt(10);
      newHashedPassword = await bcrypt.hash(newPassword, salt);
    }

    const result = await pool.query(
      'UPDATE users SET name = $1, password = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, email, role',
      [newName, newHashedPassword, req.user.id]
    );

    res.status(200).json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Admin — kisi bhi user ki poori profile + uske orders + meetings dekhna
const getUserById = async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id AS "_id", name, email, role, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    const targetUser = userResult.rows[0];
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const ordersResult = await pool.query(
      `SELECT o.*, p.name AS product_name
       FROM orders o JOIN products p ON p.id = o.product_id
       WHERE o.user_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC`,
      [req.params.id]
    );

    const meetingsResult = await pool.query(
      `SELECT m.* FROM meetings m
       JOIN meeting_participants mp ON mp.meeting_id = m.id
       WHERE mp.user_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.date DESC, m.time DESC`,
      [req.params.id]
    );

    res.status(200).json({
      user: targetUser,
      orders: ordersResult.rows,
      meetings: meetingsResult.rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  signup,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  deleteUser,
  getAllUsers,
  updateProfile,
  getUserById,
};