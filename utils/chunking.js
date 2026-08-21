// Text ko chote overlapping pieces (chunks) mein todta hai — RAG ke liye.
// Word-based splitting use karte hain (character-based se better hai kyunke
// word ke beech mein kabhi nahi katega, meaning preserve rehta hai).

const DEFAULT_CHUNK_SIZE = 60; // words per chunk
const DEFAULT_OVERLAP = 15; // words jo agle chunk ke start mein repeat hongi

/**
 * @param {string} text - poora text jo chunk karna hai
 * @param {object} options
 * @param {number} options.chunkSize - har chunk mein kitne words honge
 * @param {number} options.overlap - consecutive chunks ke beech kitne words overlap honge
 * @returns {string[]} - array of chunk strings, in order
 */
function chunkText(text, { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = {}) {
  if (!text || !text.trim()) return [];

  const words = text.trim().split(/\s+/);

  // Agar poora text ek chunk mein fit ho raha hai, chunking ki zarurat hi nahi —
  // seedha single chunk return karo (chota product description, jo yahan aksar hoga)
  if (words.length <= chunkSize) {
    return [text.trim()];
  }

  // overlap chunkSize se bara/barabar nahi ho sakta, warna infinite loop ban jayega
  const step = Math.max(chunkSize - overlap, 1);

  const chunks = [];
  for (let start = 0; start < words.length; start += step) {
    const chunkWords = words.slice(start, start + chunkSize);
    chunks.push(chunkWords.join(' '));

    // Last chunk poora cover ho chuka hai to loop rok do
    if (start + chunkSize >= words.length) break;
  }

  return chunks;
}

module.exports = { chunkText, DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP };
