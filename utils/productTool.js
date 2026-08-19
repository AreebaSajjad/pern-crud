const { pool } = require('../config/pgDb');
const { syncProductEmbedding, removeProductEmbedding } = require('./embeddingSync');
const { syncProductOkf, removeProductOkf } = require('./okfGenerator');
const { fetchStockImageForProduct } = require('./stockImage');

// ---------------- 1. Tool Schema / Definition ----------------
const createProductTool = {
  type: 'function',
  function: {
    name: 'create_product',
    description:
      'Creates a new product in the MyStore catalog. Use this ONLY when the (admin) user clearly asks to add/create a new product and has given at least a name, category, description, quantity and price.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name' },
        category: { type: 'string', description: 'Category, e.g. Electronics, Clothing, Grocery' },
        description: { type: 'string', description: 'Short 1-2 line product description' },
        quantity: { type: 'integer', description: 'Stock quantity, whole number, 0 or more' },
        price: { type: 'number', description: 'Price in USD, greater than 0' },
      },
      required: ['name', 'category', 'description', 'quantity', 'price'],
      additionalProperties: false,
    },
  },
};

const deleteProductTool = {
  type: 'function',
  function: {
    name: 'delete_product',
    description:
      'Soft-deletes an existing product from the MyStore catalog by its id. Use ONLY when the admin clearly asks to delete/remove a specific product and you know its product id (ask for it first if not given or not found by name in the context).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'integer', description: 'The numeric id of the product to delete' },
      },
      required: ['product_id'],
      additionalProperties: false,
    },
  },
};

const updateProductTool = {
  type: 'function',
  function: {
    name: 'update_product',
    description:
      'Updates fields of an existing product by its id. Only fields the admin actually wants to change should be non-empty — pass an empty string for text fields, or -1 for quantity/price to leave them unchanged.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'integer', description: 'The numeric id of the product to update' },
        name: { type: 'string', description: 'New name, or empty string to leave unchanged' },
        category: { type: 'string', description: 'New category, or empty string to leave unchanged' },
        description: { type: 'string', description: 'New description, or empty string to leave unchanged' },
        quantity: { type: 'integer', description: 'New quantity, or -1 to leave unchanged' },
        price: { type: 'number', description: 'New price, or -1 to leave unchanged' },
      },
      required: ['product_id', 'name', 'category', 'description', 'quantity', 'price'],
      additionalProperties: false,
    },
  },
};

const tools = [createProductTool, updateProductTool, deleteProductTool];

// ---------------- Validation Layer ----------------
function validateCreateProductArgs(args) {
  const errors = [];
  if (!args.name || typeof args.name !== 'string' || !args.name.trim()) errors.push('name is required');
  if (!args.category || typeof args.category !== 'string' || !args.category.trim()) errors.push('category is required');
  if (!args.description || typeof args.description !== 'string' || !args.description.trim()) errors.push('description is required');
  if (!Number.isInteger(args.quantity) || args.quantity < 0) errors.push('quantity must be a whole number >= 0');
  if (typeof args.price !== 'number' || Number.isNaN(args.price) || args.price <= 0) errors.push('price must be a number greater than 0');
  return errors;
}

// ---------------- Execution ----------------
async function executeCreateProduct(args, currentUser, uploadedImages = []) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can create products. This user is not an admin.' };
  }

  const errors = validateCreateProductArgs(args);
  if (errors.length > 0) {
    return { success: false, error: `Invalid product data: ${errors.join(', ')}` };
  }

  let images = uploadedImages && uploadedImages.length ? uploadedImages : [];
  let autoFetched = false;

  // Admin ne koi image attach nahi ki — naam+category se ek matching photo
  // khud dhoond kar laga do (agar PEXELS_API_KEY set hai, warna chup chaap skip).
  if (images.length === 0) {
    const autoImage = await fetchStockImageForProduct(`${args.name} ${args.category}`);
    if (autoImage) {
      images = [autoImage];
      autoFetched = true;
    }
  }

  const result = await pool.query(
    `INSERT INTO products (name, category, description, quantity, price, images, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id AS "_id", name, category, description, quantity, price, images, created_at, updated_at, created_by`,
    [args.name.trim(), args.category.trim(), args.description.trim(), args.quantity, args.price, images, currentUser.id]
  );

  const product = result.rows[0];
  syncProductEmbedding(product);
  syncProductOkf(product);

  return {
    success: true,
    product: {
      id: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: product.quantity,
      images: product.images,
    },
    note: autoFetched
      ? `Product created with an auto-fetched image (no image was attached, so one matching "${args.name}" was picked automatically).`
      : images.length
      ? `Product created with ${images.length} image(s).`
      : 'Product created successfully but with no images yet — add images later from the Edit Product page.',
  };
}
async function executeUpdateProduct(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can update products. This user is not an admin.' };
  }
  if (!Number.isInteger(args.product_id)) {
    return { success: false, error: 'product_id must be a whole number' };
  }

  const existing = await pool.query(
    `SELECT id AS "_id", name, category, description, quantity, price FROM products WHERE id = $1 AND deleted_at IS NULL`,
    [args.product_id]
  );
  if (existing.rowCount === 0) {
    return { success: false, error: `No active product found with id ${args.product_id}` };
  }
  const current = existing.rows[0];

  const merged = {
    name: args.name && args.name.trim() ? args.name.trim() : current.name,
    category: args.category && args.category.trim() ? args.category.trim() : current.category,
    description: args.description && args.description.trim() ? args.description.trim() : current.description,
    quantity: args.quantity === -1 || args.quantity === undefined ? current.quantity : args.quantity,
    price: args.price === -1 || args.price === undefined ? current.price : args.price,
  };

  const errors = validateCreateProductArgs(merged);
  if (errors.length > 0) {
    return { success: false, error: `Invalid product data: ${errors.join(', ')}` };
  }

  const result = await pool.query(
    `UPDATE products SET name=$1, category=$2, description=$3, quantity=$4, price=$5, updated_at=NOW()
     WHERE id=$6
     RETURNING id AS "_id", name, category, description, quantity, price, images, created_at, updated_at, created_by`,
    [merged.name, merged.category, merged.description, merged.quantity, merged.price, args.product_id]
  );

  const product = result.rows[0];
  syncProductEmbedding(product);
  syncProductOkf(product);

  return {
    success: true,
    product: {
      id: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: product.quantity,
    },
  };
}

async function executeDeleteProduct(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can delete products. This user is not an admin.' };
  }

  if (!Number.isInteger(args.product_id)) {
    return { success: false, error: 'product_id must be a whole number' };
  }

  const existing = await pool.query(
    `SELECT id, name FROM products WHERE id = $1 AND deleted_at IS NULL`,
    [args.product_id]
  );

  if (existing.rowCount === 0) {
    return { success: false, error: `No active product found with id ${args.product_id}` };
  }

  await pool.query(`UPDATE products SET deleted_at = NOW() WHERE id = $1`, [args.product_id]);

  removeProductEmbedding(args.product_id);
  removeProductOkf(args.product_id);

  return {
    success: true,
    deleted: { id: existing.rows[0].id, name: existing.rows[0].name },
  };
}

// ---------------- 2. Tool Selection (dispatch table) ----------------
const toolExecutors = {
  create_product: executeCreateProduct,
  update_product: executeUpdateProduct,
  delete_product: executeDeleteProduct,
};

// ---------------- 3. Parameter Extraction + run ----------------
// ---------------- 3. Parameter Extraction + run ----------------
async function runTool(toolCall, currentUser, uploadedImages) {
  const executor = toolExecutors[toolCall.function.name];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${toolCall.function.name}` };
  }

  let args;
  try {
    args = JSON.parse(toolCall.function.arguments); // Parameter Extraction
  } catch (e) {
    return { success: false, error: 'Could not parse tool arguments as JSON' };
  }

  console.log(`[function-calling] tool selected: ${toolCall.function.name} | args:`, args);

  return executor(args, currentUser, uploadedImages);
}
module.exports = { tools, runTool };