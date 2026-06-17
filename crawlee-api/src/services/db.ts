import { Pool } from 'pg';
import { hashApiKey } from './crypto';

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'n8n',
  password: process.env.DB_PASSWORD || 'n8n_password',
  database: process.env.DB_NAME || 'n8n',
  max: 5,
});

export async function lookupApiKey(rawKey: string): Promise<{ userId: string; name: string } | null> {
  const keyHash = hashApiKey(rawKey);
  const result = await pool.query(
    'SELECT user_id, name FROM api_keys WHERE key_hash = $1 AND is_active = true',
    [keyHash],
  );
  if (result.rows.length === 0) return null;
  return { userId: result.rows[0].user_id, name: result.rows[0].name };
}

export { pool };
