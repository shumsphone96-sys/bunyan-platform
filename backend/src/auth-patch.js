import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import crypto from 'node:crypto';
import { z } from 'zod';

const { Pool } = pg;
const originalListen = express.application.listen;

function makePool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة غير صالحة أو منتهية' });
  }
}

async function sendResetEmail(email, name, code) {
  if (!process.env.RESEND_API_KEY) throw new Error('خدمة البريد غير مضبوطة');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'BUNYAN <onboarding@resend.dev>',
      to: [email],
      subject: 'رمز إعادة تعيين كلمة سر بُنْيَان',
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><h2>إعادة تعيين كلمة السر</h2><p>مرحباً ${String(name || '').replace(/[<>&]/g, '')}،</p><p>رمز التحقق الخاص بك هو:</p><div style="font-size:34px;font-weight:700;letter-spacing:8px;background:#f5f2e9;padding:18px;text-align:center;border-radius:12px">${code}</div><p>ينتهي الرمز خلال 15 دقيقة، ويُستخدم مرة واحدة فقط.</p><p style="color:#687571">إن لم تطلب إعادة التعيين، تجاهل هذه الرسالة.</p></div>`
    })
  });
  if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
}

express.application.listen = function patchedListen(...args) {
  if (!this.locals.bunyanAuthRoutesInstalled) {
    this.locals.bunyanAuthRoutesInstalled = true;
    const pool = makePool();

    this.post('/api/auth/forgot-password', async (req, res, next) => {
      try {
        const { email } = z.object({ email: z.string().email() }).parse(req.body);
        const normalised = email.trim().toLowerCase();
        const generic = { ok: true, message: 'إذا كان البريد مسجلاً فسيصل رمز التحقق خلال دقائق.' };
        const userResult = await pool.query('SELECT id,name,email,is_active FROM users WHERE email=$1', [normalised]);
        const user = userResult.rows[0];
        if (!user || !user.is_active) return res.json(generic);

        const recent = await pool.query("SELECT count(*)::int AS count FROM password_reset_codes WHERE user_id=$1 AND created_at > now() - interval '15 minutes'", [user.id]);
        if (recent.rows[0].count >= 3) return res.status(429).json({ error: 'تم طلب عدة رموز. انتظر 15 دقيقة ثم حاول مجدداً.' });

        const code = String(crypto.randomInt(100000, 1000000));
        const codeHash = await bcrypt.hash(code, 10);
        await pool.query('UPDATE password_reset_codes SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [user.id]);
        await pool.query("INSERT INTO password_reset_codes(user_id,code_hash,expires_at) VALUES($1,$2,now() + interval '15 minutes')", [user.id, codeHash]);
        await sendResetEmail(user.email, user.name, code);
        await pool.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,'password_reset_requested','users',$2,$3,$4)", [user.id, user.id, JSON.stringify({ email: normalised }), req.ip]);
        res.json(generic);
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'اكتب بريداً إلكترونياً صحيحاً' });
        next(err);
      }
    });

    this.post('/api/auth/reset-password', async (req, res, next) => {
      try {
        const data = z.object({
          email: z.string().email(),
          code: z.string().regex(/^\d{6}$/),
          newPassword: z.string().min(10).max(128)
        }).parse(req.body);
        const userResult = await pool.query('SELECT id,password_hash,is_active FROM users WHERE email=$1', [data.email.trim().toLowerCase()]);
        const user = userResult.rows[0];
        if (!user || !user.is_active) return res.status(400).json({ error: 'الرمز غير صحيح أو منتهي' });

        const resetResult = await pool.query("SELECT id,code_hash,attempts FROM password_reset_codes WHERE user_id=$1 AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1", [user.id]);
        const reset = resetResult.rows[0];
        if (!reset || reset.attempts >= 5) return res.status(400).json({ error: 'الرمز غير صحيح أو منتهي' });

        const valid = await bcrypt.compare(data.code, reset.code_hash);
        if (!valid) {
          await pool.query('UPDATE password_reset_codes SET attempts=attempts+1 WHERE id=$1', [reset.id]);
          return res.status(400).json({ error: 'الرمز غير صحيح أو منتهي' });
        }
        if (await bcrypt.compare(data.newPassword, user.password_hash)) return res.status(400).json({ error: 'اختر كلمة سر مختلفة عن السابقة' });

        const hash = await bcrypt.hash(data.newPassword, 12);
        await pool.query('BEGIN');
        try {
          await pool.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2', [hash, user.id]);
          await pool.query('UPDATE password_reset_codes SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [user.id]);
          await pool.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,'password_reset_completed','users',$2,'{}'::jsonb,$3)", [user.id, user.id, req.ip]);
          await pool.query('COMMIT');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
        res.json({ ok: true, message: 'تم تعيين كلمة السر الجديدة. يمكنك تسجيل الدخول الآن.' });
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'تحقق من الرمز وكلمة السر الجديدة' });
        next(err);
      }
    });

    this.post('/api/auth/change-password', auth, async (req, res, next) => {
      try {
        const data = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(128) }).parse(req.body);
        const result = await pool.query('SELECT id,password_hash FROM users WHERE id=$1 AND is_active=true', [req.user.sub]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(data.currentPassword, user.password_hash))) return res.status(400).json({ error: 'كلمة السر الحالية غير صحيحة' });
        if (await bcrypt.compare(data.newPassword, user.password_hash)) return res.status(400).json({ error: 'كلمة السر الجديدة يجب أن تختلف عن الحالية' });
        const hash = await bcrypt.hash(data.newPassword, 12);
        await pool.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2', [hash, user.id]);
        await pool.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,'password_changed','users',$2,'{}'::jsonb,$3)", [user.id, user.id, req.ip]);
        res.json({ ok: true, message: 'تم تغيير كلمة السر بنجاح. سجّل الدخول من جديد.' });
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'كلمة السر الجديدة يجب ألا تقل عن 10 أحرف' });
        next(err);
      }
    });

    this.get('/api/auth/me', auth, async (req, res, next) => {
      try {
        const { rows } = await pool.query('SELECT id,name,email,role,created_at,updated_at FROM users WHERE id=$1 AND is_active=true', [req.user.sub]);
        if (!rows[0]) return res.status(404).json({ error: 'الحساب غير موجود' });
        res.json(rows[0]);
      } catch (err) {
        next(err);
      }
    });
  }
  return originalListen.apply(this, args);
};
