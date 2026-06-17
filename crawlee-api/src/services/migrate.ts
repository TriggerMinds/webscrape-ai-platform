import { pool } from './db';
import { logger } from './logger';

const MIGRATIONS_TABLE = '_migrations';

const migrations: Array<{ name: string; sql: string }> = [
  {
    name: '001_init',
    sql: `
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key_hash TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

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
      );

      CREATE INDEX IF NOT EXISTS idx_scraped_pages_user_id ON scraped_pages(user_id);
      CREATE INDEX IF NOT EXISTS idx_scraped_pages_url ON scraped_pages(url);
    `,
  },
];

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    for (const migration of migrations) {
      const { rows } = await client.query(
        `SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE name = $1`,
        [migration.name],
      );
      if (rows.length > 0) {
        continue;
      }

      logger.info({ migration: migration.name }, 'Applying migration');
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`,
        [migration.name],
      );
      logger.info({ migration: migration.name }, 'Migration applied');
    }

    logger.info('All migrations up to date');
  } finally {
    client.release();
  }
}
