import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
const previousListen = express.application.listen;

express.application.listen = function donationReceiptListen(...args) {
  const app = this;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  const jwtSecret = process.env.JWT_SECRET;

  const auth = (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
    try {
      req.user = jwt.verify(token, jwtSecret);
      next();
    } catch {
      return res.status(401).json({ error: 'جلسة غير صالحة أو منتهية' });
    }
  };

  app.post('/api/public/donations/:id/receipt', async (req, res) => {
    try {
      const data = z.object({
        fileName: z.string().min(1).max(180),
        mimeType: z.enum(['application/pdf','image/jpeg','image/png','image/webp']),
        base64: z.string().min(8)
      }).parse(req.body);

      const donation = await pool.query('SELECT id FROM donations WHERE id=$1', [req.params.id]);
      if (!donation.rowCount) return res.status(404).json({ error: 'المساهمة غير موجودة' });

      const buffer = Buffer.from(data.base64, 'base64');
      if (!buffer.length || buffer.length > 3 * 1024 * 1024) {
        return res.status(400).json({ error: 'حجم إشعار التحويل يجب ألا يتجاوز 3 ميغابايت' });
      }

      await pool.query('DELETE FROM donation_attachments WHERE donation_id=$1', [req.params.id]);
      const { rows } = await pool.query(
        `INSERT INTO donation_attachments(donation_id,file_name,mime_type,size_bytes,file_data)
         VALUES($1,$2,$3,$4,$5)
         RETURNING id,file_name,mime_type,size_bytes,created_at`,
        [req.params.id, data.fileName, data.mimeType, buffer.length, buffer]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'أرفق صورة JPG أو PNG أو WEBP أو ملف PDF' });
      res.status(500).json({ error: 'تعذر رفع إشعار التحويل' });
    }
  });

  app.get('/api/donations/:id/receipt', auth, async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id,file_name,mime_type,size_bytes,created_at FROM donation_attachments WHERE donation_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );
    res.json(rows[0] || null);
  });

  app.get('/api/donation-receipts/:id/download', auth, async (req, res) => {
    const { rows } = await pool.query('SELECT file_name,mime_type,file_data FROM donation_attachments WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'إشعار التحويل غير موجود' });
    res.setHeader('Content-Type', rows[0].mime_type);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(rows[0].file_name)}`);
    res.send(rows[0].file_data);
  });

  return previousListen.apply(app, args);
};
