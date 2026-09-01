const multer = require('multer');
const path = require('path');
const fs = require('fs');

// KB documents alag folder mein rakhte hain (uploads/kb) taake product images
// wale uploads/ se mix na ho — aur ye files public /uploads route se serve nahi hoti.
const KB_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'kb');
fs.mkdirSync(KB_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, KB_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed for the knowledge base'));
  }
};

// Sir ne bola tha koi file-size limit nahi chahiye (200 page ka pdf ya usse zyada bhi
// chalna chahiye) — multer ko koi limit hard-code karna hi paDta hai, isliye ek bohot
// bara number (500MB) diya hai jo practically kabhi nahi tikrayega, formal restriction
// hatane jaisa hi hai.
const kbUpload = multer({ storage, fileFilter, limits: { fileSize: 500 * 1024 * 1024 } });

module.exports = kbUpload;
