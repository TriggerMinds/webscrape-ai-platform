import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'n8n',
  password: process.env.DB_PASSWORD || 'n8n_password',
  database: process.env.DB_NAME || 'n8n',
  max: 5,
});

export async function initDbSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key_value TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS scraped_pages (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        markdown TEXT,
        raw_html TEXT,
        summary TEXT,
        word_count INTEGER,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scraped_pages_user_id ON scraped_pages(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scraped_pages_url ON scraped_pages(url)
    `);
    console.log('DB schema initialized');
  } finally {
    client.release();
  }
}

export async function lookupApiKey(keyValue: string): Promise<{ userId: string; name: string } | null> {
  const result = await pool.query(
    'SELECT user_id, name FROM api_keys WHERE key_value = $1 AND is_active = true',
    [keyValue],
  );
  if (result.rows.length === 0) return null;
  return { userId: result.rows[0].user_id, name: result.rows[0].name };
}

export async function createApiKey(keyValue: string, userId: string, name: string): Promise<void> {
  await pool.query(
    'INSERT INTO api_keys (key_value, user_id, name) VALUES ($1, $2, $3) ON CONFLICT (key_value) DO NOTHING',
    [keyValue, userId, name],
  );
}

export async function getUserJobCount(userId: string, windowMs: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt FROM scraped_pages
     WHERE user_id = $1 AND processed_at > NOW() - make_interval(secs => $2)`,
    [userId, Math.floor(windowMs / 1000)],
  );
  return parseInt(result.rows[0].cnt, 10);
}

export { pool };
