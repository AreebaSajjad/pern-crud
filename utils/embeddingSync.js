const { pool } = require('../config/pgDb');
const { getEmbedding } = require('./openaiClient');

const buildProductText = (p) =>
  `Product: ${p.name}\nCategory: ${p.category}\nPrice: $${p.price}\nQuantity in stock: ${p.quantity}\nDescription: ${p.description}`;

// Ek product ki embedding banao ya update karo (create/update hone par)
const syncProductEmbedding = async (product) => {
  try {
    const text = buildProductText(product);
    const vector = await getEmbedding(text);
    const productId = product._id || product.id;

    const existing = await pool.query(
      `SELECT id FROM embeddings WHERE source_type = 'product' AND source_id = $1`,
      [productId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE embeddings SET text = $1, vector = $2, updated_at = NOW() WHERE id = $3`,
        [text, vector, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO embeddings (source_type, source_id, text, vector) VALUES ('product', $1, $2, $3)`,
        [productId, text, vector]
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
