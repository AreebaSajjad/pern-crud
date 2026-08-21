const { pool } = require('../config/pgDb');
const { getEmbedding } = require('./openaiClient');
const { chunkText } = require('./chunking');

const buildProductText = (p) =>
  `Product: ${p.name}\nCategory: ${p.category}\nPrice: $${p.price}\nQuantity in stock: ${p.quantity}\nDescription: ${p.description}`;

// Ek product ki embedding(s) banao ya update karo (create/update hone par).
// Chunking: product text ko chunkText() se todte hain (chunkSize=60 words, overlap=15 words —
// defaults chunking.js mein hain). Chote products (jo yahan aksar honge) ek hi chunk mein reh jate
// hain, lekin agar kisi product ki description lambi ho to multiple chunks ban kar alag-alag
// embed honge — is se un lambe descriptions ka koi bhi hissa similarity search se miss nahi hota.
const syncProductEmbedding = async (product) => {
  try {
    const fullText = buildProductText(product);
    const productId = product._id || product.id;
    const chunks = chunkText(fullText); // default chunkSize/overlap use ho rahe hain

    // Har chunk ki embedding alag se banani parhti hai (embedding API ek text -> ek vector deta hai)
    const vectors = await Promise.all(chunks.map((chunk) => getEmbedding(chunk)));

    // Purane chunks (agar is product ke pehle se the) hata do, phir fresh set insert karo.
    // Ye "update single row" logic se simpler/safer hai kyunke ab chunks ki count
    // update pe badal sakti hai (jaise description lambi ho gayi to 1 se 3 chunks ban gaye).
    await pool.query(`DELETE FROM embeddings WHERE source_type = 'product' AND source_id = $1`, [productId]);

    for (let i = 0; i < chunks.length; i++) {
      await pool.query(
        `INSERT INTO embeddings (source_type, source_id, chunk_index, text, vector) VALUES ('product', $1, $2, $3, $4)`,
        [productId, i, chunks[i], vectors[i]]
      );
    }
  } catch (err) {
    console.error('Embedding sync failed for product', product._id || product.id, err.message);
  }
};

// Product delete hone par uski embedding bhi hata do
const removeProductEmbedding = async (productId) => {
  try {
    await pool.query(`DELETE FROM embeddings WHERE source_type = 'product' AND source_id = $1`, [productId]);
  } catch (err) {
    console.error('Embedding removal failed for product', productId, err.message);
  }
};

// Server start hote waqt: jin products ki embedding missing hai, unhe bana do
const backfillMissingEmbeddings = async () => {
  try {
    const productsResult = await pool.query('SELECT * FROM products');
    const embeddedIdsResult = await pool.query(`SELECT source_id FROM embeddings WHERE source_type = 'product'`);
    const existingIds = embeddedIdsResult.rows.map((r) => String(r.source_id));

    const missing = productsResult.rows.filter((p) => !existingIds.includes(String(p.id)));
    if (missing.length === 0) return;

    console.log(`Backfilling embeddings for ${missing.length} product(s)...`);
    for (const p of missing) {
      await syncProductEmbedding(p);
    }
    console.log('Embedding backfill complete.');
  } catch (err) {
    console.error('Embedding backfill failed:', err.message);
  }
};

module.exports = { syncProductEmbedding, removeProductEmbedding, backfillMissingEmbeddings };
