import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
const originalListen = express.application.listen;

express.application.listen = function patchedListen(...args) {
  const app = this;
  const jwtSecret = process.env.JWT_SECRET;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

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

  app.post('/api/auth/change-password', auth, async (req, res) => {
    try {
      const data = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(10).max(128)
      }).parse(req.body);

      if (data.currentPassword === data.newPassword) {
        return res.status(400).json({ error: 'كلمة السر الجديدة يجب أن تختلف عن الحالية' });
      }

      const result = await pool.query(
        'SELECT id,password_hash,is_active FROM users WHERE id=$1',
        [req.user.sub]
      );
      const user = result.rows[0];

      if (!user || !user.is_active) {
        return res.status(404).json({ error: 'الحساب غير موجود أو غير نشط' });
      }

      const valid = await bcrypt.compare(data.currentPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'كلمة السر الحالية غير صحيحة' });
      }

      const passwordHash = await bcrypt.hash(data.newPassword, 12);
      await pool.query(
        'UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',
        [passwordHash, req.user.sub]
      );
      await pool.query(
        `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address)
         VALUES($1,'change_password','users',$2,$3,$4)`,
        [req.user.sub, req.user.sub, JSON.stringify({ changedAt: new Date().toISOString() }), req.ip]
      );

      res.json({ ok: true, message: 'تم تغيير كلمة السر بنجاح' });
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'كلمة السر الجديدة يجب ألا تقل عن 10 أحرف' });
      }
      res.status(500).json({ error: 'تعذر تغيير كلمة السر الآن' });
    }
  });

  return originalListen.apply(app, args);
};

await import('./server-v6.js');
