const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');
const verifyGithubSignature = require('../middleware/verifyGithubSignature');
const { handleWebhook, getHistory } = require('../controllers/githubReviewController');

// GitHub se aata hai - iska apna signature-based verification hai, JWT ki zaroorat nahi
router.post('/webhook', verifyGithubSignature, handleWebhook);

// Sirf logged-in admin hi review history dekh sakta hai
router.get('/history', protect, isAdmin, getHistory);

module.exports = router;
