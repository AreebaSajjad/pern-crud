const fs = require('fs');
const pdfParse = require('pdf-parse');

// Uploaded file (PDF ya .txt) se poora text nikalta hai, saath mein page_count bhi
// (txt files ke liye page_count null rehta hai — unka concept hi nahi hota).
// Returns: { text, pageCount }
const extractTextFromFile = async (filePath, mimetype) => {
  if (mimetype === 'application/pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return { text: data.text || '', pageCount: data.numpages || null };
  }

  if (mimetype === 'text/plain') {
    const text = fs.readFileSync(filePath, 'utf8');
    return { text, pageCount: null };
  }

  throw new Error(`Unsupported file type for text extraction: ${mimetype}`);
};

module.exports = { extractTextFromFile };