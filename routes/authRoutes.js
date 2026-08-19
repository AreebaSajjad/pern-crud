const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');
const {
  signup,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  deleteUser,
  getAllUsers,
  updateProfile,
  getUserById,
} = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/users', protect, isAdmin, getAllUsers);
router.get('/:id', protect, isAdmin, getUserById);
router.delete('/:id', protect, isAdmin, deleteUser);
router.put('/profile', protect, updateProfile);

module.exports = router;