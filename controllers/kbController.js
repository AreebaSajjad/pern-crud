const fs = require('fs');
const path = require('path');
const { pool } = require('../config/pgDb');
const { processKbDocument, removeKbDocumentEmbeddings } = require('../utils/kbEmbeddingSync');

// ---------------- Documents: upload / list / delete / view ----------------

// POST /api/kb/documents (admin only) — PDF upload karo. Response TURANT chala jata hai
// (status 'processing' ke saath) — chunking + embeddings background mein chalti hain
// (await nahi kiya), taake 200+ page ka pdf upload karte waqt request hang na ho.
// Frontend "refresh" button dabaa kar list dobara fetch karke updated status (ready/failed)
// dekh sakta hai.
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required' });
    }

    const title = (req.body.title && req.body.title.trim()) || req.file.originalname;

    const insertResult = await pool.query(
      `INSERT INTO kb_documents (title, original_name, file_path, file_size_bytes, uploaded_by, status)
       VALUES ($1, $2, $3, $4, $5, 'processing') RETURNING *`,
      [title, req.file.originalname, req.file.path, req.file.size, req.user.id]
    );
    const kbDocument = insertResult.rows[0];

    // Background mein chalne do — request ko block nahi karna (fire-and-forget).
    // processKbDocument apni khud ki errors handle karta hai (document ko 'failed' mark
    // kar deta hai), isliye yahan .catch bas ek extra safety net hai.
    processKbDocument(kbDocument, req.file.path, req.file.mimetype).catch((err) =>
      console.error('KB background processing crashed:', err.message)
    );

    res.status(202).json({ message: 'Upload received — processing in the background', document: kbDocument });
  } catch (error) {
    console.error('KB upload error:', error.message);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};

// GET /api/kb/documents — sab logged-in users dekh sakte hain (upload/delete admin-only hai)
const getAllDocuments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.title, d.original_name, d.file_size_bytes, d.page_count, d.chunk_count,
             d.status, d.error_message, d.created_at, u.name AS uploaded_by_name
      FROM kb_documents d
      LEFT JOIN users u ON u.id = d.uploaded_by
      WHERE d.deleted_at IS NULL
      ORDER BY d.created_at DESC
    `);
    res.status(200).json({ documents: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/kb/documents/:id/file — original PDF ko naye tab mein khol/view karne ke liye
const getDocumentFile = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM kb_documents WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }
    const document = result.rows[0];
    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({ message: 'File missing on server' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(document.original_name)}"`);
    fs.createReadStream(document.file_path).pipe(res);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/kb/documents/:id (admin only) — soft delete + uski embeddings + file disk se hata do
const deleteDocument = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE kb_documents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const document = result.rows[0];
    await removeKbDocumentEmbeddings(document.id);

    fs.unlink(document.file_path, (err) => {
      if (err) console.error('Could not remove KB file from disk:', err.message);
    });

    res.status(200).json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { uploadDocument, getAllDocuments, getDocumentFile, deleteDocument };
