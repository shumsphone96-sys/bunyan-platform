import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 8080);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');

const adminPanelUrl = process.env.ADMIN_PANEL_URL || 'https://shumsphone96-sys.github.io/bunyan-platform/';
const notificationEmail = process.env.NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || '';

app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean), credentials: false }));
app.use(express.json({ limit: '1mb' }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sign = user => jwt.sign({ sub: user.id, role: user.role, name: user.name }, jwtSecret, { expiresIn: '8h' });

function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
  try { req.user = jwt.verify(token, jwtSecret); next(); }
  catch { return res.status(401).json({ error: 'جلسة غير صالحة أو منتهية' }); }
}

function allow(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'ليست لديك الصلاحية المطلوبة' });
}

async function audit(req, action, entityType, entityId = null, metadata = {}) {
  await pool.query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,$2,$3,$4,$5,$6)', [req.user?.sub || null, action, entityType, entityId, metadata, req.ip]);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

async function sendEmailAlert({ subject, title, fields }) {
  if (!process.env.RESEND_API_KEY || !notificationEmail) return { channel: 'email', sent: false, reason: 'not_configured' };

  const rows = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">${escapeHtml(label)}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(value)}</td></tr>`)
    .join('');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'BUNYAN <onboarding@resend.dev>',
      to: [notificationEmail],
      subject,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h2>${escapeHtml(title)}</h2><table style="width:100%;border-collapse:collapse">${rows}</table><p style="margin-top:24px"><a href="${escapeHtml(adminPanelUrl)}" style="background:#111;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px">فتح لوحة الإدارة</a></p></div>`
    })
  });

  if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
  return { channel: 'email', sent: true };
}

function phoneForWhatsApp(value = '') {
  let phone = String(value).replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 10) phone = `249${phone.slice(1)}`;
  return phone;
}

async function sendTelegramAlert({ title, fields }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { channel: 'telegram', sent: false, reason: 'not_configured' };

  const details = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<b>${escapeHtml(label)}:</b> ${escapeHtml(value)}`)
    .join('\n');

  const phoneValue = fields['الهاتف'] || '';
  const whatsappPhone = phoneForWhatsApp(phoneValue);
  const inlineKeyboard = [[{ text: '🌐 فتح لوحة الإدارة', url: adminPanelUrl }]];
  if (whatsappPhone) {
    inlineKeyboard.unshift([{ text: '💬 فتح واتساب', url: `https://wa.me/${whatsappPhone}` }]);
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `📥 <b>${escapeHtml(title)}</b>\n\n${details}`,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: inlineKeyboard }
    })
  });

  if (!response.ok) throw new Error(`Telegram error ${response.status}: ${await response.text()}`);
  return { channel: 'telegram', sent: true };
}

async function sendWhatsAppAlert({ title, fields }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = process.env.WHATSAPP_ADMIN_NUMBER;
  if (!token || !phoneNumberId || !recipient) return { channel: 'whatsapp', sent: false, reason: 'not_configured' };

  const details = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `*${label}:* ${value}`)
    .join('\n');
  const body = `${title}\n\n${details}\n\nلوحة الإدارة:\n${adminPanelUrl}`;

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient, type: 'text', text: { preview_url: true, body } })
  });

  if (!response.ok) throw new Error(`WhatsApp error ${response.status}: ${await response.text()}`);
  return { channel: 'whatsapp', sent: true };
}

function dispatchAlerts(payload) {
  Promise.allSettled([sendEmailAlert(payload), sendTelegramAlert(payload), sendWhatsAppAlert(payload)]).then(results => {
    results.forEach(result => {
      if (result.status === 'rejected') console.error('Notification failed:', result.reason);
      else if (!result.value.sent) console.log(`Notification skipped (${result.value.channel}): ${result.value.reason}`);
      else console.log(`Notification sent (${result.value.channel})`);
    });
  });
}

app.get('/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'bunyan-cloud-api', version: '5.1.0' });
}));

app.post('/api/setup', asyncRoute(async (req, res) => {
  const count = await pool.query('SELECT count(*)::int AS count FROM users');
  if (count.rows[0].count > 0) return res.status(409).json({ error: 'تم إعداد النظام مسبقاً' });
  const schema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(10) });
  const data = schema.parse(req.body);
  const hash = await bcrypt.hash(data.password, 12);
  const result = await pool.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role', [data.name, data.email.toLowerCase(), hash, 'admin']);
  res.status(201).json({ user: result.rows[0], token: sign(result.rows[0]) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const data = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const result = await pool.query('SELECT id,name,email,password_hash,role,is_active FROM users WHERE email=$1', [data.email.toLowerCase()]);
  const user = result.rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(data.password, user.password_hash))) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ user: safe, token: sign(safe) });
}));

app.get('/api/public/projects', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT id,name,summary,status,progress,beneficiaries_target,budget,currency,created_at FROM projects WHERE is_public=true ORDER BY created_at DESC');
  res.json(rows);
}));

app.get('/api/public/news', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT id,title,body,published_at,created_at FROM news WHERE is_public=true AND published_at IS NOT NULL ORDER BY published_at DESC');
  res.json(rows);
}));

app.post('/api/public/participation-requests', asyncRoute(async (req, res) => {
  const data = z.object({ name: z.string().min(2).max(120), phone: z.string().min(5).max(40), role: z.string().min(2).max(100), message: z.string().max(1000).optional() }).parse(req.body);
  const { rows } = await pool.query('INSERT INTO participation_requests(name,phone,role,message) VALUES($1,$2,$3,$4) RETURNING id,created_at', [data.name, data.phone, data.role, data.message || null]);
  dispatchAlerts({
    subject: `طلب مشاركة جديد من ${data.name}`,
    title: 'وصل طلب مشاركة جديد إلى منصة بُنْيَان',
    fields: { 'رقم الطلب': rows[0].id, 'الاسم': data.name, 'الهاتف': data.phone, 'نوع المشاركة': data.role, 'الرسالة': data.message || '—', 'وقت الإرسال': rows[0].created_at }
  });
  res.status(201).json({ ...rows[0], notificationQueued: true });
}));

app.post('/api/public/donations', asyncRoute(async (req, res) => {
  const data = z.object({ donor: z.string().min(2).max(120), phone: z.string().max(40).optional(), amount: z.coerce.number().positive(), currency: z.enum(['SDG','SAR','USD']), projectId: z.string().uuid().optional(), projectName: z.string().max(160).optional(), method: z.string().max(100).optional(), reference: z.string().max(160).optional() }).parse(req.body);
  const { rows } = await pool.query('INSERT INTO donations(donor,phone,amount,currency,project_id,project_name,method,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,created_at', [data.donor, data.phone || null, data.amount, data.currency, data.projectId || null, data.projectName || null, data.method || null, data.reference || null]);
  dispatchAlerts({
    subject: `تبرع جديد: ${data.amount} ${data.currency}`,
    title: 'وصل إشعار تبرع جديد إلى منصة بُنْيَان',
    fields: { 'رقم العملية': rows[0].id, 'اسم المتبرع': data.donor, 'الهاتف': data.phone || '—', 'المبلغ': `${data.amount} ${data.currency}`, 'المشروع': data.projectName || 'عام', 'طريقة الدفع': data.method || '—', 'المرجع': data.reference || '—', 'وقت الإرسال': rows[0].created_at }
  });
  res.status(201).json({ ...rows[0], notificationQueued: true });
}));

const resources = {
  projects: { table: 'projects', fields: ['name','summary','status','progress','beneficiaries_target','budget','currency','is_public'] },
  beneficiaries: { table: 'beneficiaries', fields: ['name','phone','service','status','project_id','notes'] },
  volunteers: { table: 'volunteers', fields: ['name','phone','email','skill','hours','status'] },
  news: { table: 'news', fields: ['title','body','published_at','is_public'] },
  requests: { table: 'participation_requests', fields: ['name','phone','role','message','status'] },
  donations: { table: 'donations', fields: ['donor','phone','amount','currency','project_id','project_name','method','reference','status'] }
};

app.get('/api/dashboard', auth, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT
    (SELECT count(*) FROM projects)::int projects,
    (SELECT count(*) FROM beneficiaries)::int beneficiaries,
    (SELECT count(*) FROM volunteers)::int volunteers,
    (SELECT count(*) FROM participation_requests WHERE status='new')::int new_requests,
    (SELECT count(*) FROM donations)::int donations,
    (SELECT coalesce(sum(amount),0) FROM donations WHERE status='verified' AND currency='SDG') verified_sdg`);
  res.json(rows[0]);
}));

app.post('/api/notifications/test', auth, allow('admin'), asyncRoute(async (req, res) => {
  const payload = {
    subject: 'اختبار إشعارات منصة بُنْيَان',
    title: 'هذا اختبار ناجح لنظام إشعارات بُنْيَان',
    fields: { 'المدير': req.user.name, 'البريد': notificationEmail || 'غير مضبوط', 'الوقت': new Date().toISOString() }
  };
  const results = await Promise.allSettled([sendEmailAlert(payload), sendTelegramAlert(payload), sendWhatsAppAlert(payload)]);
  res.json(results.map(result => result.status === 'fulfilled' ? result.value : { sent: false, error: String(result.reason?.message || result.reason) }));
}));

app.get('/api/:resource', auth, asyncRoute(async (req, res) => {
  const config = resources[req.params.resource];
  if (!config) return res.status(404).json({ error: 'المورد غير موجود' });
  const { rows } = await pool.query(`SELECT * FROM ${config.table} ORDER BY created_at DESC LIMIT 500`);
  res.json(rows);
}));

app.post('/api/:resource', auth, allow('admin','manager','staff'), asyncRoute(async (req, res) => {
  const config = resources[req.params.resource];
  if (!config) return res.status(404).json({ error: 'المورد غير موجود' });
  const entries = config.fields.filter(k => Object.hasOwn(req.body, k)).map(k => [k, req.body[k]]);
  if (!entries.length) return res.status(400).json({ error: 'لا توجد بيانات صالحة' });
  const columns = entries.map(([k]) => k);
  const values = entries.map(([,v]) => v);
  const placeholders = values.map((_,i) => `$${i+1}`);
  const { rows } = await pool.query(`INSERT INTO ${config.table}(${columns.join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`, values);
  await audit(req, 'create', req.params.resource, rows[0].id);
  res.status(201).json(rows[0]);
}));

app.patch('/api/:resource/:id', auth, allow('admin','manager','staff'), asyncRoute(async (req, res) => {
  const config = resources[req.params.resource];
  if (!config) return res.status(404).json({ error: 'المورد غير موجود' });
  const entries = config.fields.filter(k => Object.hasOwn(req.body, k)).map(k => [k, req.body[k]]);
  if (!entries.length) return res.status(400).json({ error: 'لا توجد تغييرات صالحة' });
  const values = entries.map(([,v]) => v);
  const setSql = entries.map(([k],i) => `${k}=$${i+1}`).join(',');
  const { rows } = await pool.query(`UPDATE ${config.table} SET ${setSql} WHERE id=$${values.length+1} RETURNING *`, [...values, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'السجل غير موجود' });
  await audit(req, 'update', req.params.resource, req.params.id, req.body);
  res.json(rows[0]);
}));

app.delete('/api/:resource/:id', auth, allow('admin','manager'), asyncRoute(async (req, res) => {
  const config = resources[req.params.resource];
  if (!config) return res.status(404).json({ error: 'المورد غير موجود' });
  const result = await pool.query(`DELETE FROM ${config.table} WHERE id=$1`, [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'السجل غير موجود' });
  await audit(req, 'delete', req.params.resource, req.params.id);
  res.status(204).end();
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'بيانات غير صالحة', details: err.flatten() });
  res.status(500).json({ error: 'حدث خطأ داخلي في الخادم' });
});

app.listen(port, () => console.log(`BUNYAN Cloud API listening on ${port}`));
