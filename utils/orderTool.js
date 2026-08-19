const { pool } = require('../config/pgDb');
const { syncProductEmbedding } = require('./embeddingSync');

// ---------------- Tool Schemas ----------------
const createOrderTool = {
  type: 'function',
  function: {
    name: 'create_order',
    description:
      'Places an order for a product on behalf of the current user. Use when the user clearly asks to order/buy a specific product and quantity.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'integer', description: 'The id of the product to order' },
        quantity: { type: 'integer', description: 'How many units to order, at least 1' },
      },
      required: ['product_id', 'quantity'],
      additionalProperties: false,
    },
  },
};

const cancelOrderTool = {
  type: 'function',
  function: {
    name: 'cancel_order',
    description: "Cancels (deletes) an order by its id. Users can only cancel their own orders; admins can cancel any order.",
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'integer', description: 'The id of the order to cancel' },
      },
      required: ['order_id'],
      additionalProperties: false,
    },
  },
};

const updateOrderStatusTool = {
  type: 'function',
  function: {
    name: 'update_order_status',
    description: 'Admin only. Updates an order\'s status (pending, confirmed, shipped, delivered, cancelled).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'integer', description: 'The id of the order to update' },
        status: { type: 'string', enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'], description: 'New status' },
      },
      required: ['order_id', 'status'],
      additionalProperties: false,
    },
  },
};

const tools = [createOrderTool, cancelOrderTool, updateOrderStatusTool];

// ---------------- Execution ----------------
async function executeCreateOrder(args, currentUser) {
  if (!Number.isInteger(args.product_id)) return { success: false, error: 'product_id must be a whole number' };
  if (!Number.isInteger(args.quantity) || args.quantity < 1) return { success: false, error: 'quantity must be a whole number >= 1' };

  const productResult = await pool.query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [args.product_id]);
  const product = productResult.rows[0];
  if (!product) return { success: false, error: `No active product found with id ${args.product_id}` };

  const existingPending = await pool.query(
    `SELECT id FROM orders WHERE user_id = $1 AND product_id = $2 AND status = 'pending' AND deleted_at IS NULL`,
    [currentUser.id, args.product_id]
  );
  if (existingPending.rows.length > 0) {
    return { success: false, error: 'You already have a pending order for this product. Wait for it to be processed or cancel it first.' };
  }

  if (product.quantity < args.quantity) {
    return { success: false, error: `Only ${product.quantity} item(s) left in stock for ${product.name}` };
  }

  const total = product.price * args.quantity;

  const result = await pool.query(
    `INSERT INTO orders (user_id, product_id, quantity, price, total, status)
     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id, quantity, price, total, status`,
    [currentUser.id, args.product_id, args.quantity, product.price, total]
  );

  const updatedProductResult = await pool.query(
    'UPDATE products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [args.quantity, args.product_id]
  );
  syncProductEmbedding(updatedProductResult.rows[0]);

  return {
    success: true,
    order: { id: result.rows[0].id, product: product.name, quantity: args.quantity, total: result.rows[0].total, status: 'pending' },
  };
}

async function executeCancelOrder(args, currentUser) {
  if (!Number.isInteger(args.order_id)) return { success: false, error: 'order_id must be a whole number' };

  const existing = await pool.query('SELECT * FROM orders WHERE id = $1 AND deleted_at IS NULL', [args.order_id]);
  const order = existing.rows[0];
  if (!order) return { success: false, error: `No active order found with id ${args.order_id}` };

  if (currentUser.role !== 'admin' && order.user_id !== currentUser.id) {
    return { success: false, error: 'You can only cancel your own orders.' };
  }

  await pool.query('UPDATE orders SET deleted_at = NOW() WHERE id = $1', [args.order_id]);
  return { success: true, cancelled: { id: order.id } };
}

async function executeUpdateOrderStatus(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can update order status.' };
  }
  if (!Number.isInteger(args.order_id)) return { success: false, error: 'order_id must be a whole number' };

  const allowed = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(args.status)) return { success: false, error: `Status must be one of: ${allowed.join(', ')}` };

  const result = await pool.query(
    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id, status',
    [args.status, args.order_id]
  );
  if (result.rowCount === 0) return { success: false, error: `No active order found with id ${args.order_id}` };

  return { success: true, order: result.rows[0] };
}

// ---------------- Tool Selection (dispatch) + Parameter Extraction ----------------
const toolExecutors = {
  create_order: executeCreateOrder,
  cancel_order: executeCancelOrder,
  update_order_status: executeUpdateOrderStatus,
};

async function runTool(toolCall, currentUser) {
  const executor = toolExecutors[toolCall.function.name];
  if (!executor) return { success: false, error: `Unknown tool: ${toolCall.function.name}` };

  let args;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    return { success: false, error: 'Could not parse tool arguments as JSON' };
  }

  console.log(`[function-calling] tool selected: ${toolCall.function.name} | args:`, args);
  return executor(args, currentUser);
}

module.exports = { tools, runTool };