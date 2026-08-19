const fs = require('fs');
const path = require('path');
const { pool } = require('../config/pgDb');

// OKF (Open Knowledge Format) — Google ka open spec: har "concept" ek markdown
// file hoti hai jiske upar YAML frontmatter hota hai. Sirf `type` field required
// hai, baaki (title, description, resource, tags, timestamp) recommended hain.
// Reference: https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing

const OKF_ROOT = path.join(__dirname, '..', 'okf');
const PRODUCTS_DIR = path.join(OKF_ROOT, 'products');

const ensureDirs = () => {
  fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
};

// YAML mein value ko safely likhne ke liye — colons/quotes waali strings ko quote karo
const yamlString = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '\\"');
  return `"${escaped}"`;
};

// Ek product ka OKF concept-document (frontmatter + body) banata hai
const buildProductConcept = (product) => {
  const id = product._id || product.id;
  const tags = product.category ? [product.category] : [];
  const timestamp = product.updated_at
    ? new Date(product.updated_at).toISOString()
    : new Date().toISOString();

  const frontmatter = [
    '---',
    'type: product',
    `title: ${yamlString(product.name)}`,
    `description: ${yamlString((product.description || '').slice(0, 200))}`,
    `resource: ${yamlString(`/api/products/${id}`)}`,
    `tags: [${tags.map(yamlString).join(', ')}]`,
    `timestamp: ${timestamp}`,
    `price: ${product.price}`,
    `quantity: ${product.quantity}`,
    '---',
  ].join('\n');

  const body = [
    `# ${product.name}`,
    '',
    product.description || '',
    '',
    `- **Category:** ${product.category}`,
    `- **Price:** $${product.price}`,
    `- **Quantity in stock:** ${product.quantity}`,
  ].join('\n');

  return `${frontmatter}\n\n${body}\n`;
};

// Ek product ki concept file likhta/update karta hai
const syncProductOkf = (product) => {
  try {
    ensureDirs();
    const id = product._id || product.id;
    const filePath = path.join(PRODUCTS_DIR, `${id}.md`);
    fs.writeFileSync(filePath, buildProductConcept(product), 'utf8');
    regenerateIndex();
  } catch (err) {
    console.error('OKF sync failed for product', product._id || product.id, err.message);
  }
};

// Product delete hone par uski concept file bhi hata do
const removeProductOkf = (productId) => {
  try {
    const filePath = path.join(PRODUCTS_DIR, `${productId}.md`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    regenerateIndex();
  } catch (err) {
    console.error('OKF removal failed for product', productId, err.message);
  }
};

// index.md — OKF ka reserved "progressive disclosure" file: bundle ka table of contents
const regenerateIndex = () => {
  try {
    ensureDirs();
    const files = fs.existsSync(PRODUCTS_DIR)
      ? fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.md'))
      : [];

    const links = files
      .map((f) => `- [products/${f}](./products/${f})`)
      .join('\n');

    const indexContent = [
      '---',
      'type: index',
      `title: ${yamlString('Product Catalog')}`,
      `timestamp: ${new Date().toISOString()}`,
      '---',
      '',
      '# Product Catalog (OKF Bundle)',
      '',
      links || '_No products yet._',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(OKF_ROOT, 'index.md'), indexContent, 'utf8');
  } catch (err) {
    console.error('OKF index regeneration failed:', err.message);
  }
};

// Server start hote waqt: sab non-deleted products se poora bundle (re)build kar do
const rebuildFullOkfBundle = async () => {
  try {
    ensureDirs();
    const result = await pool.query('SELECT * FROM products WHERE deleted_at IS NULL');

    // Purani files clear karo taake soft-deleted products ki files na reh jayein
    if (fs.existsSync(PRODUCTS_DIR)) {
      for (const f of fs.readdirSync(PRODUCTS_DIR)) {
        fs.unlinkSync(path.join(PRODUCTS_DIR, f));
      }
    }

    for (const product of result.rows) {
      const filePath = path.join(PRODUCTS_DIR, `${product.id}.md`);
      fs.writeFileSync(filePath, buildProductConcept(product), 'utf8');
    }

    regenerateIndex();
    console.log(`OKF bundle ready: ${result.rows.length} product concept file(s) in /okf/products`);
  } catch (err) {
    console.error('OKF bundle rebuild failed:', err.message);
  }
};

module.exports = {
  syncProductOkf,
  removeProductOkf,
  rebuildFullOkfBundle,
  OKF_ROOT,
};
