import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

try {
  await pool.query(`
    ALTER TABLE donations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  `);
  console.log('Database compatibility migration completed.');
} finally {
  await pool.end();
}
