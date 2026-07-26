import express from 'express';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
const previousListen = express.application.listen;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function notifyEmail(data) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  if (!key || !to) return;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'BUNYAN <onboarding@resend.dev>',
      to: [to],
      reply_to: data.email || undefined,
      subject: `رسالة جديدة من موقع بُنْيَان: ${data.subject}`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h2>رسالة تواصل جديدة</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">الاسم</td><td style="padding:8px;border:1px solid #ddd">${esc(data.name)}</td></tr><tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">البريد</td><td style="padding:8px;border:1px solid #ddd">${esc(data.email || '—')}</td></tr><tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">الهاتف</td><td style="padding:8px;border:1px solid #ddd">${esc(data.phone || '—')}</td></tr><tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">الموضوع</td><td style="padding:8px;border:1px solid #ddd">${esc(data.subject)}</td></tr><tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">الرسالة</td><td style="padding:8px;border:1px solid #ddd;white-space:pre-wrap">${esc(data.message)}</td></tr></table></div>`
    })
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

async function notifyTelegram(data) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const phone = String(data.phone || '').replace(/\D/g, '').replace(/^0(?=\d{9}$)/, '249');
  const keyboard = [[{ text: '🌐 فتح الموقع', url: 'https://bunyan-sudan.org' }]];
  if (phone) keyboard.unshift([{ text: '💬 واتساب', url: `https://wa.me/${phone}` }]);
  const text = `📨 <b>رسالة تواصل جديدة</b>\n\n<b>الاسم:</b> ${esc(data.name)}\n<b>البريد:</b> ${esc(data.email || '—')}\n<b>الهاتف:</b> ${esc(data.phone || '—')}\n<b>الموضوع:</b> ${esc(data.subject)}\n<b>الرسالة:</b> ${esc(data.message)}`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } })
  });
  if (!response.ok) throw new Error(`Telegram ${response.status}: ${await response.text()}`);
}

express.application.listen = function contactPatchListen(...args) {
  const app = this;
  if (!app.locals.bunyanContactInstalled) {
    app.locals.bunyanContactInstalled = true;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

    pool.query(`CREATE TABLE IF NOT EXISTS contact_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(120) NOT NULL,
      email varchar(200),
      phone varchar(40),
      subject varchar(160) NOT NULL,
      message text NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'new',
      created_at timestamptz NOT NULL DEFAULT now()
    )`).catch(err => console.error('contact table init failed', err));

    app.post('/api/public/contact', async (req, res) => {
      try {
        const data = z.object({
          name: z.string().trim().min(2).max(120),
          email: z.string().trim().email().optional().or(z.literal('')),
          phone: z.string().trim().max(40).optional().or(z.literal('')),
          subject: z.string().trim().min(3).max(160),
          message: z.string().trim().min(10).max(3000),
          website: z.string().max(0).optional()
        }).parse(req.body);
        const { rows } = await pool.query(
          'INSERT INTO contact_messages(name,email,phone,subject,message) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',
          [data.name, data.email || null, data.phone || null, data.subject, data.message]
        );
        Promise.allSettled([notifyEmail(data), notifyTelegram(data)]).then(results => results.forEach(r => r.status === 'rejected' && console.error('contact notification failed', r.reason)));
        res.status(201).json({ ok: true, id: rows[0].id, createdAt: rows[0].created_at, message: 'وصلت رسالتك إلى فريق بُنْيَان بنجاح.' });
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'تحقق من الاسم والموضوع والرسالة، واكتب بريدًا صحيحًا إن أضفته.' });
        console.error(err);
        res.status(500).json({ error: 'تعذر إرسال الرسالة الآن. حاول مرة أخرى.' });
      }
    });
  }
  return previousListen.apply(app, args);
};
