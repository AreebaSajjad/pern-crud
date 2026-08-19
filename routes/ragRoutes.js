const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const {
  chatWithBot,
  getConversations,
  getConversationById,
  deleteConversation,
} = require('../controllers/ragController');

router.post('/chat', protect, upload.array('images', 5), chatWithBot);
router.get('/conversations', protect, getConversations);
router.get('/conversations/:id', protect, getConversationById);
router.delete('/conversations/:id', protect, deleteConversation);

module.exports = router;