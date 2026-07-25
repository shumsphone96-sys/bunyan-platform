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
  const adminName = process.env.ADMIN_NAME?.trim() || 'شمس الأنبياء أحمد أبو عقلة';

  // ADMIN_EMAIL may remain permanently. A recovery runs only while
  // ADMIN_RESET_PASSWORD is present, so removing the password after a
  // successful reset will not break future deployments.
  if (resetPassword) {
    if (!resetEmail) {
      throw new Error('ADMIN_EMAIL must be set when ADMIN_RESET_PASSWORD is used');
    }
    if (resetPassword.length < 10) {
      throw new Error('ADMIN_RESET_PASSWORD must be at least 10 characters');
    }

    const passwordHash = await bcrypt.hash(resetPassword, 12);

    const existingAdmin = await pool.query(
      `SELECT id FROM users WHERE role='admin' ORDER BY created_at ASC LIMIT 1`
    );

    let result;
    if (existingAdmin.rowCount) {
      result = await pool.query(
        `UPDATE users
         SET name=$1,
             email=$2,
             password_hash=$3,
             role='admin',
             is_active=true,
             updated_at=now()
         WHERE id=$4
         RETURNING id,email`,
        [adminName, resetEmail, passwordHash, existingAdmin.rows[0].id]
      );
      console.log(`Admin account recovered for ${result.rows[0].email}.`);
    } else {
      result = await pool.query(
        `INSERT INTO users (name,email,password_hash,role,is_active)
         VALUES ($1,$2,$3,'admin',true)
         ON CONFLICT (email) DO UPDATE
         SET name=EXCLUDED.name,
             password_hash=EXCLUDED.password_hash,
             role='admin',
             is_active=true,
             updated_at=now()
         RETURNING id,email`,
        [adminName, resetEmail, passwordHash]
      );
      console.log(`Admin account created for ${result.rows[0].email}.`);
    }

    console.log('Remove ADMIN_RESET_PASSWORD after this successful deploy.');
  } else if (resetEmail) {
    console.log('ADMIN_EMAIL is set; no password reset requested.');
  }
} finally {
  await pool.end();
}
