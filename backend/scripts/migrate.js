import 'dotenv/config';
import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
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

  const resetEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const resetPassword = process.env.ADMIN_RESET_PASSWORD;

  if (resetEmail || resetPassword) {
    if (!resetEmail || !resetPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_RESET_PASSWORD must both be set');
    }
    if (resetPassword.length < 10) {
      throw new Error('ADMIN_RESET_PASSWORD must be at least 10 characters');
    }

    const passwordHash = await bcrypt.hash(resetPassword, 12);
    const result = await pool.query(
      `WITH target_admin AS (
         SELECT id
         FROM users
         WHERE role='admin'
         ORDER BY (lower(email)=lower($2)) DESC, created_at ASC
         LIMIT 1
       )
       UPDATE users
       SET email=$2,
           password_hash=$1,
           is_active=true,
           updated_at=now()
       WHERE id=(SELECT id FROM target_admin)
       RETURNING id,email`,
      [passwordHash, resetEmail]
    );

    if (!result.rowCount) {
      throw new Error('No admin account exists to reset');
    }

    console.log(`Admin account recovered for ${result.rows[0].email}. Remove ADMIN_RESET_PASSWORD after this deploy.`);
  }
} finally {
  await pool.end();
}
