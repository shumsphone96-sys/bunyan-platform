import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

try {
  const sql = await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('BUNYAN database schema is ready.');
} finally {
  await pool.end();
}
