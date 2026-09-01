const { Pool } = require('pg');

// PG_PASSWORD missing/empty hone par turant clear error do (SASL ka confusing error nahi)
if (!process.env.PG_PASSWORD) {
  console.error('PG_PASSWORD is missing in your .env file — set your real Postgres password there.');
}

// Postgres connection pool — .env se config uthata hai
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: String(process.env.PG_PASSWORD || ''), // hamesha string bhejo, warna SASL error aata hai
  database: process.env.PG_DATABASE,
});

// Poori app ke saare tables yahan create hote hain (agar exist nahi karte to)
const initTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      images TEXT[] NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      date VARCHAR(20) NOT NULL,
      time VARCHAR(10) NOT NULL,
      duration INTEGER NOT NULL,
      mode VARCHAR(20) NOT NULL CHECK (mode IN ('online','physical')),
      location VARCHAR(255),
      link VARCHAR(500),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Meeting ke 2 participants — many-to-many table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_participants (
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (meeting_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL DEFAULT 'New Chat',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role VARCHAR(10) NOT NULL CHECK (role IN ('user','bot')),
      text TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Product ki vector embedding (AI search ke liye) — pgvector extension ki zaroorat nahi,
  // plain float array me store karke JS mein cosine similarity nikalte hain.
  // Ek source (jaise ek product) ke multiple chunks ho sakte hain, isliye chunk_index
  // se track karte hain kaunsa chunk kaunse number pe tha (order/debugging ke liye).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id SERIAL PRIMARY KEY,
      source_type VARCHAR(50) NOT NULL,
      source_id INTEGER,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      vector DOUBLE PRECISION[] NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  // Existing DB pe agar table pehle se bani hui hai to column add karo (data loss nahi hoga)
  await pool.query(`ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS chunk_index INTEGER NOT NULL DEFAULT 0;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      price NUMERIC(10,2) NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  // Soft delete columns — agar pehle se nahi hain to add karo
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
  // Google login — google_id unique hai, password ab optional (google users ke liye null)
  await pool.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;`);
  // Forgot password — code ka hash aur expiry store hota hai, plain code kabhi DB mein nahi jata
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_hash VARCHAR(255);`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP;`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);

  // ---------------- Knowledge Base module ----------------
  // Ek uploaded PDF ka record — status batata hai processing kahan tak pahunchi
  // (processing -> ready ya failed). Actual text chunks + vectors 'embeddings' table mein hi
  // jaate hain (source_type = 'kb_document', source_id = is table ki id), taake purana
  // similarity-search code reuse ho sake — koi naya vector-storage duplicate nahi karna paDa.
  // Sawal-jawab is module ka apna chat nahi hai — wo existing "AI Assistant" (ragController)
  // se hi hota hai, jo ab kb_document chunks bhi apni retrieval mein include karta hai.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kb_documents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size_bytes BIGINT,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      page_count INTEGER,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      summary TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','failed')),
      error_message TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMP
    );
  `);

  // Purani install mein table bina is column ke ban chuki ho to bhi add ho jaye
  await pool.query(`ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;`);
  // Purani install (jisme ye feature nahi thi) mein bhi summary column add ho jaye
  await pool.query(`ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS summary TEXT;`);
};

const connectPostgres = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('PostgreSQL Connected Successfully');
    await initTables();
    console.log('All tables ready (users, products, meetings, meeting_participants, conversations, messages, embeddings, orders, kb_documents)');
  } catch (error) {
    console.error('PostgreSQL Connection Failed:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, connectPostgres };
