import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error('أرفق صورة JPG أو PNG أو WEBP أو ملف PDF فقط'));
    }
    callback(null, true);
  }
});

const previousPost = express.application.post;
const previousListen = express.application.listen;

function donationUpload(req, res, next) {
  upload.single('receipt')(req, res, err => {
    if (!err) return next();

    console.error('Donation receipt upload error:', err);
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'حجم إشعار التحويل يجب ألا يتجاوز 3 ميغابايت' });
    }
    return res.status(400).json({ error: err.message || 'تعذر قراءة إشعار التحويل' });
  });
}

// اعتراض مسار التبرعات الأصلي وإضافة دعم multipart/form-data مع alias للواجهة الحالية.
express.application.post = function patchedPost(path, ...handlers) {
  if (path === '/api/public/donations') {
    const saveReceiptAfterDonation = (req, res, next) => {
      const originalJson = res.json.bind(res);

      res.json = body => {
        if (!req.file || !body?.id) return originalJson(body);

        return pool.query(
          `INSERT INTO donation_attachments(donation_id,file_name,mime_type,size_bytes,file_data)
           VALUES($1,$2,$3,$4,$5)`,
          [body.id, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer]
        ).then(() => originalJson({ ...body, receiptUploaded: true }))
          .catch(err => {
            console.error('Donation receipt database error:', err);
            if (!res.headersSent) {
              return res.status(500).json({ error: err.message || 'تعذر حفظ إشعار التحويل' });
            }
          });
      };

      next();
    };

    return previousPost.call(
      this,
      ['/api/public/donations', '/api/donations'],
      donationUpload,
      saveReceiptAfterDonation,
      ...handlers
    );
  }

  return previousPost.call(this, path, ...handlers);
};

express.application.listen = function donationReceiptListen(...args) {
  const app = this;
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
        mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
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
      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Donation receipt endpoint error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'أرفق صورة JPG أو PNG أو WEBP أو ملف PDF' });
      }
      return res.status(500).json({ error: err.message || 'تعذر رفع إشعار التحويل' });
    }
  });

  app.get('/api/donations/:id/receipt', auth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id,file_name,mime_type,size_bytes,created_at FROM donation_attachments WHERE donation_id=$1 ORDER BY created_at DESC LIMIT 1',
        [req.params.id]
      );
      return res.json(rows[0] || null);
    } catch (err) {
      console.error('Read donation receipt error:', err);
      return res.status(500).json({ error: err.message || 'تعذر قراءة إشعار التحويل' });
    }
  });

  app.get('/api/donation-receipts/:id/download', auth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT file_name,mime_type,file_data FROM donation_attachments WHERE id=$1',
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'إشعار التحويل غير موجود' });
      res.setHeader('Content-Type', rows[0].mime_type);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(rows[0].file_name)}`);
      return res.send(rows[0].file_data);
    } catch (err) {
      console.error('Download donation receipt error:', err);
      return res.status(500).json({ error: err.message || 'تعذر تنزيل إشعار التحويل' });
    }
  });

  return previousListen.apply(app, args);
};
