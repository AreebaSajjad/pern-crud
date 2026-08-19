const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/pgDb');
const { sendEmail } = require('./mailer');
const { resetPasswordEmail } = require('../templates/resetPasswordEmail');

// IMPORTANT: password change seedha chat se nahi lete — koi bhi tool "newPassword"
// jaisa parameter accept nahi karta. Iski jagah send_password_reset tool
// sirf email pe reset code bhejta hai — password kabhi chat mein nahi likhta.

const RESET_CODE_EXPIRY_MINUTES = 10;

// ---------------- Tool Schemas ----------------
const addUserTool = {
  type: 'function',
  function: {
    name: 'add_user',
    description:
      'Creates a new user account. Use only when the admin gives a name, email, and role. A random temporary password is generated automatically and returned — never accept a password as a parameter.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the new user' },
        email: { type: 'string', description: 'Email address, must be unique' },
        role: { type: 'string', enum: ['user', 'admin'], description: 'Account role' },
      },
      required: ['name', 'email', 'role'],
      additionalProperties: false,
    },
  },
};

const updateUserTool = {
  type: 'function',
  function: {
    name: 'update_user',
    description: "Updates an existing user's name and/or role by their id. Never used for passwords.",
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'integer', description: 'Id of the user to update' },
        name: { type: 'string', description: 'New name, or empty string to leave unchanged' },
        role: { type: 'string', enum: ['user', 'admin', ''], description: 'New role, or empty string to leave unchanged' },
      },
      required: ['user_id', 'name', 'role'],
      additionalProperties: false,
    },
  },
};

const deleteUserTool = {
  type: 'function',
  function: {
    name: 'delete_user',
    description: 'Soft-deletes a user account by id. An admin cannot delete their own account this way.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'integer', description: 'Id of the user to delete' },
      },
      required: ['user_id'],
      additionalProperties: false,
    },
  },
};

const sendPasswordResetTool = {
  type: 'function',
  function: {
    name: 'send_password_reset',
    description:
      'Sends a password reset code to a user\'s email so they can set a new password themselves. Use this whenever anyone asks to "change" or "reset" a password via chat — never ask for or accept an actual new password in the conversation.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: "Email of the account whose password should be reset. If not given, use the current user's own email." },
      },
      required: ['email'],
      additionalProperties: false,
    },
  },
};

const tools = [addUserTool, updateUserTool, deleteUserTool, sendPasswordResetTool];

// ---------------- Validation ----------------
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

function generateTempPassword() {
  return crypto.randomBytes(6).toString('base64url');
}

// ---------------- Execution ----------------
async function executeAddUser(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can create user accounts.' };
  }
  if (!args.name || !args.name.trim()) return { success: false, error: 'Name is required' };
  if (!isValidEmail(args.email)) return { success: false, error: 'A valid email is required' };
  if (!['user', 'admin'].includes(args.role)) return { success: false, error: 'Role must be user or admin' };

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [args.email]);
  if (existing.rowCount > 0) {
    return { success: false, error: 'A user with this email already exists.' };
  }

  const tempPassword = generateTempPassword();
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(tempPassword, salt);

  const result = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
    [args.name.trim(), args.email, hashed, args.role]
  );

  return {
    success: true,
    user: result.rows[0],
    temp_password: tempPassword,
    note: 'Share this temporary password with the user securely and ask them to change it after logging in.',
  };
}

async function executeUpdateUser(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can update users.' };
  }
  if (!Number.isInteger(args.user_id)) {
    return { success: false, error: 'user_id must be a whole number' };
  }

  const existing = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND deleted_at IS NULL', [args.user_id]);
  if (existing.rowCount === 0) {
    return { success: false, error: `No active user found with id ${args.user_id}` };
  }

  if (args.role && !['user', 'admin', ''].includes(args.role)) {
    return { success: false, error: 'Role must be user or admin' };
  }

  const newName = args.name && args.name.trim() ? args.name.trim() : existing.rows[0].name;
  const newRole = args.role && args.role.trim() ? args.role : existing.rows[0].role;

  const result = await pool.query(
    'UPDATE users SET name = $1, role = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, email, role',
    [newName, newRole, args.user_id]
  );

  return { success: true, user: result.rows[0] };
}

async function executeDeleteUser(args, currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { success: false, error: 'Only an admin can delete users.' };
  }
  if (!Number.isInteger(args.user_id)) {
    return { success: false, error: 'user_id must be a whole number' };
  }
  if (args.user_id === currentUser.id) {
    return { success: false, error: 'You cannot delete your own account via chat.' };
  }

  const result = await pool.query(
    'UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id, name, email',
    [args.user_id]
  );
  if (result.rowCount === 0) {
    return { success: false, error: `No active user found with id ${args.user_id}` };
  }

  return { success: true, deleted: result.rows[0] };
}

async function executeSendPasswordReset(args) {
  if (!isValidEmail(args.email)) {
    return { success: false, error: 'A valid email is required' };
  }

  const result = await pool.query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [args.email]);
  const user = result.rows[0];

  if (!user) {
    return { success: true, note: 'If this email exists, a reset code has been sent to it.' };
  }

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    'UPDATE users SET reset_code_hash = $1, reset_code_expires = $2 WHERE id = $3',
    [codeHash, expiresAt, user.id]
  );

  await sendEmail({
    to: user.email,
    subject: `Password Reset Code - ${process.env.COMPANY_NAME || 'Our App'}`,
    html: resetPasswordEmail({
      name: user.name,
      code,
      companyName: process.env.COMPANY_NAME || 'Our App',
      expiryMinutes: RESET_CODE_EXPIRY_MINUTES,
    }),
  });

  return { success: true, note: 'If this email exists, a reset code has been sent to it.' };
}

// ---------------- Tool Selection (dispatch) + Parameter Extraction ----------------
const toolExecutors = {
  add_user: executeAddUser,
  update_user: executeUpdateUser,
  delete_user: executeDeleteUser,
  send_password_reset: executeSendPasswordReset,
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