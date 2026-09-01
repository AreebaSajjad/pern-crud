const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');
const kbUpload = require('../middleware/kbUpload');
const { uploadDocument, getAllDocuments, getDocumentFile, deleteDocument } = require('../controllers/kbController');

// Upload/delete sirf admin (knowledge base manage karna admin ka kaam hai),
// list aur view sab logged-in users kar sakte hain. Sawal-jawab yahan nahi hota —
// wo /api/rag/chat (AI Assistant) se hota hai, jo kb_document chunks bhi retrieve karta hai.
router.post('/documents', protect, isAdmin, kbUpload.single('file'), uploadDocument);
router.get('/documents', protect, getAllDocuments);
router.get('/documents/:id/file', protect, getDocumentFile);
router.delete('/documents/:id', protect, isAdmin, deleteDocument);

module.exports = router;
