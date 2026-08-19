const fs = require('fs');
const path = require('path');
const { getChatCompletion } = require('../utils/openaiClient');
const { OKF_ROOT } = require('../utils/okfGenerator');

const PRODUCTS_DIR = path.join(OKF_ROOT, 'products');

const GREETING_PATTERNS = /^(hi|hello|hey|salam|assalam|good morning|good evening|good afternoon|hola)[\s!.?]*$/i;
const isGreeting = (message) => GREETING_PATTERNS.test(message.trim());

const readOkfProductsContext = () => {
  if (!fs.existsSync(PRODUCTS_DIR)) return '';

  const files = fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.md'));
  const contents = files.map((f) => fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8'));

  return contents.join('\n\n---\n\n');
};

// POST /api/okf/query — OKF files se seedha (exact) data padh kar jawab deta hai
const queryOkf = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    if (isGreeting(message)) {
      return res.status(200).json({ reply: 'Hi! Ask me anything about our product catalog.' });
    }

    const context = readOkfProductsContext();
    if (!context) {
      return res.status(200).json({ reply: 'No product knowledge base found yet. Try adding a product first.' });
    }

    const systemPrompt = `You are a product-catalog assistant. Answer the user's question using ONLY the exact data in the OKF product files below — do not guess, estimate, or use outside knowledge. If the answer isn't in the files, say so clearly and keep it in your mind that your owner and the person who made you is Areeba Sajjad.

--- OKF PRODUCT KNOWLEDGE BASE (source of truth, read directly from disk) ---
${context}
--- END OF KNOWLEDGE BASE ---`;

    const reply = await getChatCompletion(systemPrompt, message);

    res.status(200).json({ reply, source: 'okf' });
  } catch (error) {
    res.status(500).json({ message: 'OKF query failed', error: error.message });
  }
};

module.exports = { queryOkf };
