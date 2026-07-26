import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import pg from 'pg';
import crypto from 'node:crypto';
import { z } from 'zod';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 8080);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');

const defaultOrigins = [
  'https://bunyan-sudan.org',
  'https://www.bunyan-sudan.org',
  'https://shumsphone96-sys.github.io'
];
const configuredOrigins = String(process.env.CORS_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

app.set('trust proxy', 1);
app.use((req, res, next) => {
  req.requestId = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  const started = Date.now();
  res.on('finish', () => console.log(JSON.stringify({
    time: new Date().toISOString(), requestId: req.requestId, method: req.method,
    path: req.originalUrl, origin: req.get('origin') || null,
    contentType: req.get('content-type') || null, status: res.statusCode,
    durationMs: Date.now() - started
  })));
  next();
});
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: false,
  optionsSuccessStatus: 204
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sign = user => jwt.sign({ sub: user.id, role: user.role, name: user.name }, jwtSecret, { expiresIn: '8h' });
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));

function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
  try { req.user = jwt.verify(token, jwtSecret); return next(); }
  catch { return res.status(401).json({ error: 'جلسة غير صالحة أو منتهية' }); }
}
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'ليست لديك الصلاحية المطلوبة' });
async function audit(req, action, entityType, entityId = null, metadata = {}) {
  try { await pool.query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,$2,$3,$4,$5,$6)', [req.user?.sub || null, action, entityType, entityId, metadata, req.ip]); }
  catch (err) { console.error('audit failed', err.message); }
}

const adminPanelUrl = process.env.ADMIN_PANEL_URL || 'https://bunyan-sudan.org';
const notificationEmail = process.env.NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || '';
async function sendEmailAlert({ subject, title, fields, to = notificationEmail }) {
  if (!process.env.RESEND_API_KEY || !to) return { channel: 'email', sent: false, reason: 'not_configured' };
  const rows = Object.entries(fields).map(([k,v]) => `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:700">${esc(k)}</td><td style="padding:8px;border:1px solid #ddd">${esc(v)}</td></tr>`).join('');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'BUNYAN <onboarding@resend.dev>', to: [to], subject, html: `<div dir="rtl" style="font-family:Arial"><h2>${esc(title)}</h2><table style="border-collapse:collapse;width:100%">${rows}</table><p><a href="${esc(adminPanelUrl)}">فتح لوحة الإدارة</a></p></div>` })
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
  return { channel: 'email', sent: true };
}
async function sendTelegramAlert({ title, fields }) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { channel: 'telegram', sent: false, reason: 'not_configured' };
  const text = `📥 <b>${esc(title)}</b>\n\n${Object.entries(fields).map(([k,v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join('\n')}`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ chat_id:chatId, text, parse_mode:'HTML', disable_web_page_preview:true, reply_markup:{ inline_keyboard:[[{ text:'🌐 فتح لوحة الإدارة', url:adminPanelUrl }]] } }) });
  if (!response.ok) throw new Error(`Telegram ${response.status}: ${await response.text()}`);
  return { channel: 'telegram', sent: true };
}
function dispatchAlerts(payload) {
  Promise.allSettled([sendEmailAlert(payload), sendTelegramAlert(payload)]).then(results => results.forEach(r => {
    if (r.status === 'rejected') console.error('notification failed', r.reason?.message || r.reason);
  }));
}

const allowedMimeTypes = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => allowedMimeTypes.has(file.mimetype) ? cb(null, true) : cb(new Error('أرفق صورة JPG أو PNG أو WEBP أو ملف PDF فقط'))
}).single('receipt');
const receiptMiddleware = (req, res, next) => uploadReceipt(req, res, err => {
  if (!err) return next();
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'حجم إشعار التحويل يجب ألا يتجاوز 3 ميغابايت', requestId: req.requestId });
  return res.status(400).json({ error: err.message || 'تعذر قراءة إشعار التحويل', requestId: req.requestId });
});

app.get('/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok:true, service:'bunyan-cloud-api', version:'6.2.0', architecture:'unified', time:new Date().toISOString() });
}));

app.post('/api/setup', asyncRoute(async (req, res) => {
  const count = await pool.query('SELECT count(*)::int AS count FROM users');
  if (count.rows[0].count > 0) return res.status(409).json({ error: 'تم إعداد النظام مسبقاً' });
  const data = z.object({ name:z.string().min(2), email:z.string().email(), password:z.string().min(10) }).parse(req.body);
  const hash = await bcrypt.hash(data.password, 12);
  const { rows } = await pool.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role', [data.name,data.email.toLowerCase(),hash,'admin']);
  res.status(201).json({ user:rows[0], token:sign(rows[0]) });
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const data = z.object({ email:z.string().email(), password:z.string().min(1) }).parse(req.body);
  const { rows } = await pool.query('SELECT id,name,email,password_hash,role,is_active FROM users WHERE email=$1', [data.email.toLowerCase()]);
  const user = rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(data.password,user.password_hash))) return res.status(401).json({ error:'بيانات الدخول غير صحيحة' });
  const safe = { id:user.id,name:user.name,email:user.email,role:user.role };
  res.json({ user:safe, token:sign(safe) });
}));
app.get('/api/auth/me', auth, asyncRoute(async (req,res) => {
  const { rows } = await pool.query('SELECT id,name,email,role,created_at,updated_at FROM users WHERE id=$1 AND is_active=true', [req.user.sub]);
  if (!rows[0]) return res.status(404).json({ error:'الحساب غير موجود' });
  res.json(rows[0]);
}));
app.post('/api/auth/forgot-password', asyncRoute(async (req,res) => {
  const { email } = z.object({ email:z.string().email() }).parse(req.body);
  const generic = { ok:true, message:'إذا كان البريد مسجلاً فسيصل رمز التحقق خلال دقائق.' };
  const { rows } = await pool.query('SELECT id,name,email,is_active FROM users WHERE email=$1', [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !user.is_active) return res.json(generic);
  const code = String(crypto.randomInt(100000,1000000));
  const hash = await bcrypt.hash(code,10);
  await pool.query('UPDATE password_reset_codes SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[user.id]);
  await pool.query("INSERT INTO password_reset_codes(user_id,code_hash,expires_at) VALUES($1,$2,now()+interval '15 minutes')",[user.id,hash]);
  await sendEmailAlert({ to:user.email, subject:'رمز إعادة تعيين كلمة سر بُنْيَان', title:'إعادة تعيين كلمة السر', fields:{ 'رمز التحقق':code, 'الصلاحية':'15 دقيقة' } });
  res.json(generic);
}));
app.post('/api/auth/reset-password', asyncRoute(async (req,res) => {
  const data = z.object({ email:z.string().email(), code:z.string().regex(/^\d{6}$/), newPassword:z.string().min(10).max(128) }).parse(req.body);
  const userResult = await pool.query('SELECT id,password_hash,is_active FROM users WHERE email=$1',[data.email.toLowerCase()]);
  const user = userResult.rows[0];
  if (!user || !user.is_active) return res.status(400).json({ error:'الرمز غير صحيح أو منتهي' });
  const resetResult = await pool.query("SELECT id,code_hash,attempts FROM password_reset_codes WHERE user_id=$1 AND used_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1",[user.id]);
  const reset = resetResult.rows[0];
  if (!reset || reset.attempts>=5 || !(await bcrypt.compare(data.code,reset.code_hash))) {
    if (reset) await pool.query('UPDATE password_reset_codes SET attempts=attempts+1 WHERE id=$1',[reset.id]);
    return res.status(400).json({ error:'الرمز غير صحيح أو منتهي' });
  }
  const hash = await bcrypt.hash(data.newPassword,12);
  await pool.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,user.id]);
  await pool.query('UPDATE password_reset_codes SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[user.id]);
  res.json({ ok:true, message:'تم تعيين كلمة السر الجديدة. يمكنك تسجيل الدخول الآن.' });
}));

app.get(['/api/public/projects','/api/projects'], asyncRoute(async (_req,res) => {
  const { rows } = await pool.query('SELECT id,name,summary,status,progress,beneficiaries_target,budget,currency,created_at FROM projects WHERE is_public=true ORDER BY created_at DESC');
  res.json(rows);
}));
app.get(['/api/public/news','/api/news'], asyncRoute(async (_req,res) => {
  const { rows } = await pool.query('SELECT id,title,body,published_at,created_at FROM news WHERE is_public=true AND published_at IS NOT NULL ORDER BY created_at DESC');
  res.json(rows);
}));
app.post(['/api/public/participation-requests','/api/join'], asyncRoute(async (req,res) => {
  const data = z.object({ name:z.string().min(2).max(120), phone:z.string().min(5).max(40), role:z.string().min(2).max(100), message:z.string().max(1000).optional() }).parse(req.body);
  const { rows } = await pool.query('INSERT INTO participation_requests(name,phone,role,message) VALUES($1,$2,$3,$4) RETURNING id,created_at',[data.name,data.phone,data.role,data.message||null]);
  dispatchAlerts({ subject:`طلب مشاركة جديد من ${data.name}`, title:'وصل طلب مشاركة جديد إلى منصة بُنْيَان', fields:{ 'رقم الطلب':rows[0].id,'الاسم':data.name,'الهاتف':data.phone,'نوع المشاركة':data.role,'الرسالة':data.message||'—' } });
  res.status(201).json({ ...rows[0], notificationQueued:true });
}));
app.post(['/api/public/contact','/api/contact'], asyncRoute(async (req,res) => {
  const data = z.object({ name:z.string().trim().min(2).max(120), email:z.string().trim().email().optional().or(z.literal('')), phone:z.string().trim().max(40).optional().or(z.literal('')), subject:z.string().trim().min(3).max(160), message:z.string().trim().min(10).max(3000), website:z.string().max(0).optional() }).parse(req.body);
  await pool.query(`CREATE TABLE IF NOT EXISTS contact_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(120) NOT NULL,email varchar(200),phone varchar(40),subject varchar(160) NOT NULL,message text NOT NULL,status varchar(30) NOT NULL DEFAULT 'new',created_at timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await pool.query('INSERT INTO contact_messages(name,email,phone,subject,message) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[data.name,data.email||null,data.phone||null,data.subject,data.message]);
  dispatchAlerts({ subject:`رسالة جديدة: ${data.subject}`, title:'رسالة تواصل جديدة', fields:{ 'الاسم':data.name,'البريد':data.email||'—','الهاتف':data.phone||'—','الموضوع':data.subject,'الرسالة':data.message } });
  res.status(201).json({ ok:true,id:rows[0].id,createdAt:rows[0].created_at });
}));

app.post(['/api/public/donations','/api/donations'], receiptMiddleware, asyncRoute(async (req,res) => {
  const data = z.object({ donor:z.string().min(2).max(120), phone:z.string().max(40).optional().or(z.literal('')), amount:z.coerce.number().positive(), currency:z.enum(['SDG','SAR','USD']), projectId:z.string().uuid().optional().or(z.literal('')), projectName:z.string().max(160).optional().or(z.literal('')), method:z.string().max(100).optional().or(z.literal('')), reference:z.string().max(160).optional().or(z.literal('')) }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('INSERT INTO donations(donor,phone,amount,currency,project_id,project_name,method,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,created_at',[data.donor,data.phone||null,data.amount,data.currency,data.projectId||null,data.projectName||null,data.method||null,data.reference||null]);
    if (req.file) await client.query('INSERT INTO donation_attachments(donation_id,file_name,mime_type,size_bytes,file_data) VALUES($1,$2,$3,$4,$5)',[rows[0].id,req.file.originalname,req.file.mimetype,req.file.size,req.file.buffer]);
    await client.query('COMMIT');
    dispatchAlerts({ subject:`تبرع جديد: ${data.amount} ${data.currency}`, title:'وصل إشعار تبرع جديد إلى منصة بُنْيَان', fields:{ 'رقم العملية':rows[0].id,'اسم المتبرع':data.donor,'الهاتف':data.phone||'—','المبلغ':`${data.amount} ${data.currency}`,'المشروع':data.projectName||'عام','طريقة الدفع':data.method||'—','المرجع':data.reference||'—','الإيصال':req.file?'مرفق':'غير مرفق' } });
    res.status(201).json({ ok:true,...rows[0],receiptUploaded:Boolean(req.file),notificationQueued:true,requestId:req.requestId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}));

const resources = {
  projects:{ table:'projects',fields:['name','summary','status','progress','beneficiaries_target','budget','currency','is_public'] },
  beneficiaries:{ table:'beneficiaries',fields:['name','phone','service','status','project_id','notes'] },
  volunteers:{ table:'volunteers',fields:['name','phone','email','skill','hours','status'] },
  news:{ table:'news',fields:['title','body','published_at','is_public'] },
  requests:{ table:'participation_requests',fields:['name','phone','role','message','status'] },
  donations:{ table:'donations',fields:['donor','phone','amount','currency','project_id','project_name','method','reference','status'] }
};
app.get('/api/dashboard', auth, asyncRoute(async (_req,res) => {
  const { rows } = await pool.query(`SELECT (SELECT count(*) FROM projects)::int projects,(SELECT count(*) FROM beneficiaries)::int beneficiaries,(SELECT count(*) FROM volunteers)::int volunteers,(SELECT count(*) FROM participation_requests WHERE status='new')::int new_requests,(SELECT count(*) FROM donations)::int donations,(SELECT coalesce(sum(amount),0) FROM donations WHERE status='verified' AND currency='SDG') verified_sdg`);
  res.json(rows[0]);
}));
app.get('/api/:resource', auth, asyncRoute(async (req,res) => {
  const config = resources[req.params.resource];
  if (!config) return res.status(404).json({ error:'المورد غير موجود' });
  const { rows } = await pool.query(`SELECT * FROM ${config.table} ORDER BY created_at DESC LIMIT 500`);
  res.json(rows);
}));
app.post('/api/:resource', auth, allow('admin','manager','staff'), asyncRoute(async (req,res) => {
  const config = resources[req.params.resource]; if (!config) return res.status(404).json({ error:'المورد غير موجود' });
  const entries = config.fields.filter(k => Object.hasOwn(req.body,k)).map(k => [k,req.body[k]]);
  if (!entries.length) return res.status(400).json({ error:'لا توجد بيانات صالحة' });
  const cols=entries.map(([k])=>k), vals=entries.map(([,v])=>v), ph=vals.map((_,i)=>`$${i+1}`);
  const { rows } = await pool.query(`INSERT INTO ${config.table}(${cols.join(',')}) VALUES(${ph.join(',')}) RETURNING *`,vals);
  await audit(req,'create',req.params.resource,rows[0].id); res.status(201).json(rows[0]);
}));
app.patch('/api/:resource/:id', auth, allow('admin','manager','staff'), asyncRoute(async (req,res) => {
  const config = resources[req.params.resource]; if (!config) return res.status(404).json({ error:'المورد غير موجود' });
  const entries=config.fields.filter(k=>Object.hasOwn(req.body,k)).map(k=>[k,req.body[k]]); if(!entries.length)return res.status(400).json({error:'لا توجد تغييرات صالحة'});
  const vals=entries.map(([,v])=>v), setSql=entries.map(([k],i)=>`${k}=$${i+1}`).join(',');
  const { rows }=await pool.query(`UPDATE ${config.table} SET ${setSql} WHERE id=$${vals.length+1} RETURNING *`,[...vals,req.params.id]);
  if(!rows[0])return res.status(404).json({error:'السجل غير موجود'}); await audit(req,'update',req.params.resource,req.params.id,req.body); res.json(rows[0]);
}));
app.delete('/api/:resource/:id', auth, allow('admin','manager'), asyncRoute(async (req,res) => {
  const config=resources[req.params.resource]; if(!config)return res.status(404).json({error:'المورد غير موجود'});
  const result=await pool.query(`DELETE FROM ${config.table} WHERE id=$1`,[req.params.id]); if(!result.rowCount)return res.status(404).json({error:'السجل غير موجود'}); await audit(req,'delete',req.params.resource,req.params.id); res.status(204).end();
}));
app.get('/api/donations/:id/receipt', auth, asyncRoute(async (req,res) => {
  const { rows }=await pool.query('SELECT id,file_name,mime_type,size_bytes,created_at FROM donation_attachments WHERE donation_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.id]); res.json(rows[0]||null);
}));
app.get('/api/donation-receipts/:id/download', auth, asyncRoute(async (req,res) => {
  const { rows }=await pool.query('SELECT file_name,mime_type,file_data FROM donation_attachments WHERE id=$1',[req.params.id]);
  if(!rows[0])return res.status(404).json({error:'إشعار التحويل غير موجود'});
  res.setHeader('Content-Type',rows[0].mime_type); res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(rows[0].file_name)}`); res.send(rows[0].file_data);
}));

app.use((err, req, res, _next) => {
  console.error(`[${req.requestId}]`, err);
  if (res.headersSent) return;
  if (err instanceof z.ZodError) return res.status(400).json({ error:'بيانات غير صالحة', details:err.flatten(), requestId:req.requestId });
  if (err?.message === 'Not allowed by CORS') return res.status(403).json({ error:'المصدر غير مسموح', requestId:req.requestId });
  res.status(500).json({ error:err.message || 'حدث خطأ داخلي في الخادم', requestId:req.requestId });
});

app.listen(port, () => console.log(`BUNYAN Cloud API 6.2.0 listening on ${port}`));
