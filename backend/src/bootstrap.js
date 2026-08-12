import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';

// Keep the strict login limiter. The broad API limiter must not consume the
// allowance of public forms; those routes have their own anti-spam limiter.
const sourceUrl=new URL('./server-v8.js',import.meta.url);
const runtimeUrl=new URL('./server-runtime.js',import.meta.url);
const source=await readFile(sourceUrl,'utf8');
let patched=source.replace(
  "app.use('/api/',rateLimit({windowMs:15*60*1000,limit:400,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'طلبات كثيرة. حاول لاحقاً.'}}));",
  "app.use('/api/',rateLimit({windowMs:15*60*1000,limit:5000,skip:req=>req.path.startsWith('/public/'),standardHeaders:'draft-7',legacyHeaders:false,message:{error:'طلبات كثيرة. حاول لاحقاً.'}}));"
);
patched=patched.replace(
  "const publicWriteLimit=rateLimit({windowMs:60*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'تم تجاوز الحد المسموح مؤقتاً.'}});",
  "const publicWriteLimit=rateLimit({windowMs:60*60*1000,limit:100,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'تم تجاوز الحد المسموح مؤقتاً. حاول بعد قليل.'}});"
);
if(patched===source)throw new Error('Rate-limit signatures were not found');
await writeFile(runtimeUrl,patched,'utf8');

let app;
const originalListen=express.application.listen;
express.application.listen=function(...args){app=this;return originalListen.apply(this,args)};
await import('./server-runtime.js');
express.application.listen=originalListen;
if(!app)throw new Error('BUNYAN Express application was not captured');

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
const secret=process.env.JWT_SECRET;
if(!secret)throw new Error('JWT_SECRET is required');
const publicWriteLimit=rateLimit({windowMs:60*60*1000,limit:100,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'تم تجاوز الحد المسموح مؤقتاً. حاول بعد قليل.'}});
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function auth(req,res,next){const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({error:'يلزم تسجيل الدخول'});try{req.user=jwt.verify(token,secret,{issuer:'bunyan-api',audience:'bunyan-admin'});next()}catch{return res.status(401).json({error:'جلسة غير صالحة أو منتهية'})}}
const allow=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'ليست لديك الصلاحية المطلوبة'});

await pool.query(`
CREATE TABLE IF NOT EXISTS financial_entries(
  id BIGSERIAL PRIMARY KEY,
  entry_type VARCHAR(20) NOT NULL CHECK(entry_type IN ('income','expense')),
  project_id BIGINT NULL,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(120),
  amount NUMERIC(18,2) NOT NULL CHECK(amount>0),
  currency VARCHAR(3) NOT NULL DEFAULT 'SDG' CHECK(currency IN ('SDG','SAR','USD')),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number VARCHAR(160),
  proof_url TEXT,
  notes TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_entries_project_idx ON financial_entries(project_id);
CREATE INDEX IF NOT EXISTS financial_entries_date_idx ON financial_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS financial_entries_public_idx ON financial_entries(is_public);
`);

app.post('/api/public/help-requests',publicWriteLimit,asyncRoute(async(req,res)=>{
  const d=z.object({fullName:z.string().min(2).max(160),phone:z.string().min(5).max(40),location:z.string().min(2).max(160),caseType:z.string().min(2).max(100),description:z.string().min(10).max(4000),requestedAmount:z.union([z.coerce.number().nonnegative(),z.literal(''),z.null()]).optional(),currency:z.enum(['SDG','SAR','USD']).default('SDG')}).parse(req.body);
  const sequence=(await pool.query("SELECT nextval('help_request_number_seq') AS n")).rows[0].n;
  const tracking='BN-'+new Date().getFullYear()+'-'+String(sequence).padStart(6,'0');
  const amount=d.requestedAmount===''||d.requestedAmount===null||d.requestedAmount===undefined?null:d.requestedAmount;
  const {rows}=await pool.query('INSERT INTO help_requests(tracking_number,full_name,phone,location,case_type,description,requested_amount,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,tracking_number,status,created_at',[tracking,d.fullName,d.phone,d.location,d.caseType,d.description,amount,d.currency]);
  res.status(201).json(rows[0]);
}));

app.get('/api/help/requests',auth,asyncRoute(async(_req,res)=>{const {rows}=await pool.query('SELECT * FROM help_requests ORDER BY created_at DESC LIMIT 500');res.json(rows)}));
app.patch('/api/help/requests/:id',auth,allow('admin','manager','staff'),asyncRoute(async(req,res)=>{
  const d=z.object({status:z.enum(['new','review','approved','rejected','completed']).optional(),adminNotes:z.string().max(4000).optional()}).parse(req.body);
  const sets=[],values=[];
  if(d.status){values.push(d.status);sets.push('status=$'+values.length)}
  if(Object.hasOwn(d,'adminNotes')){values.push(d.adminNotes||null);sets.push('admin_notes=$'+values.length)}
  if(!sets.length)return res.status(400).json({error:'لا توجد تغييرات صالحة'});
  values.push(req.params.id);
  const {rows}=await pool.query('UPDATE help_requests SET '+sets.join(',')+',updated_at=now() WHERE id=$'+values.length+' RETURNING *',values);
  if(!rows[0])return res.status(404).json({error:'الطلب غير موجود'});
  res.json(rows[0]);
}));

const financeSchema=z.object({
  entry_type:z.enum(['income','expense']),
  project_id:z.union([z.coerce.number().int().positive(),z.null(),z.literal('')]).optional(),
  title:z.string().min(3).max(200),
  category:z.string().max(120).nullable().optional(),
  amount:z.coerce.number().positive(),
  currency:z.enum(['SDG','SAR','USD']).default('SDG'),
  entry_date:z.coerce.date(),
  reference_number:z.string().max(160).nullable().optional(),
  proof_url:z.union([z.string().url().max(2000),z.literal(''),z.null()]).optional(),
  notes:z.string().max(3000).nullable().optional(),
  is_public:z.boolean().default(true)
});

app.get('/api/finance/entries',auth,asyncRoute(async(_req,res)=>{
  const {rows}=await pool.query('SELECT * FROM financial_entries ORDER BY entry_date DESC,created_at DESC LIMIT 2000');
  res.json(rows);
}));

app.get('/api/public/finance/report',asyncRoute(async(_req,res)=>{
  const {rows}=await pool.query("SELECT id,entry_type,project_id,title,category,amount,currency,entry_date,reference_number,proof_url,notes,created_at FROM financial_entries WHERE is_public=true ORDER BY entry_date DESC,created_at DESC LIMIT 2000");
  const totals=rows.reduce((a,x)=>{a[x.entry_type]+=Number(x.amount||0);return a},{income:0,expense:0});
  res.json({totals:{...totals,balance:totals.income-totals.expense},entries:rows,generated_at:new Date().toISOString()});
}));

app.post('/api/finance/entries',auth,allow('admin','manager','staff'),asyncRoute(async(req,res)=>{
  const d=financeSchema.parse(req.body);
  const projectId=d.project_id===''||d.project_id==null?null:d.project_id;
  const {rows}=await pool.query(`INSERT INTO financial_entries(entry_type,project_id,title,category,amount,currency,entry_date,reference_number,proof_url,notes,is_public,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[d.entry_type,projectId,d.title,d.category||null,d.amount,d.currency,d.entry_date,d.reference_number||null,d.proof_url||null,d.notes||null,d.is_public,req.user.email||req.user.sub||null]);
  res.status(201).json(rows[0]);
}));

app.patch('/api/finance/entries/:id',auth,allow('admin','manager','staff'),asyncRoute(async(req,res)=>{
  const d=financeSchema.partial().parse(req.body);
  const map={entry_type:'entry_type',project_id:'project_id',title:'title',category:'category',amount:'amount',currency:'currency',entry_date:'entry_date',reference_number:'reference_number',proof_url:'proof_url',notes:'notes',is_public:'is_public'};
  const sets=[],values=[];
  for(const [key,column] of Object.entries(map)){if(Object.hasOwn(d,key)){let value=d[key];if(key==='project_id'&&(value===''||value==null))value=null;if(['category','reference_number','proof_url','notes'].includes(key)&&value==='')value=null;values.push(value);sets.push(`${column}=$${values.length}`)}}
  if(!sets.length)return res.status(400).json({error:'لا توجد تغييرات صالحة'});
  values.push(req.params.id);
  const {rows}=await pool.query(`UPDATE financial_entries SET ${sets.join(',')},updated_at=now() WHERE id=$${values.length} RETURNING *`,values);
  if(!rows[0])return res.status(404).json({error:'الحركة المالية غير موجودة'});
  res.json(rows[0]);
}));

app.delete('/api/finance/entries/:id',auth,allow('admin','manager'),asyncRoute(async(req,res)=>{
  const result=await pool.query('DELETE FROM financial_entries WHERE id=$1',[req.params.id]);
  if(!result.rowCount)return res.status(404).json({error:'الحركة المالية غير موجودة'});
  res.status(204).end();
}));

const newsSchema=z.object({
  title:z.string().trim().min(2).max(220),
  body:z.string().trim().min(2).max(12000),
  published_at:z.union([z.coerce.date(),z.null()]).optional(),
  is_public:z.boolean().default(false)
});

app.get('/api/admin/news',auth,asyncRoute(async(_req,res)=>{
  const {rows}=await pool.query('SELECT id,title,body,published_at,is_public,created_at FROM news ORDER BY created_at DESC LIMIT 1000');
  res.json(rows);
}));

app.post('/api/admin/news',auth,allow('admin','manager','staff'),asyncRoute(async(req,res)=>{
  const d=newsSchema.parse(req.body);
  const {rows}=await pool.query('INSERT INTO news(title,body,published_at,is_public) VALUES($1,$2,$3,$4) RETURNING id,title,body,published_at,is_public,created_at',[d.title,d.body,d.published_at||null,d.is_public]);
  res.status(201).json(rows[0]);
}));

app.patch('/api/admin/news/:id',auth,allow('admin','manager','staff'),asyncRoute(async(req,res)=>{
  const d=newsSchema.partial().parse(req.body);
  const map={title:'title',body:'body',published_at:'published_at',is_public:'is_public'};
  const sets=[],values=[];
  for(const [key,column] of Object.entries(map)){if(Object.hasOwn(d,key)){values.push(d[key]??null);sets.push(`${column}=$${values.length}`)}}
  if(!sets.length)return res.status(400).json({error:'لا توجد تغييرات صالحة'});
  values.push(req.params.id);
  const {rows}=await pool.query(`UPDATE news SET ${sets.join(',')} WHERE id=$${values.length} RETURNING id,title,body,published_at,is_public,created_at`,values);
  if(!rows[0])return res.status(404).json({error:'الخبر غير موجود'});
  res.json(rows[0]);
}));

app.delete('/api/admin/news/:id',auth,allow('admin','manager'),asyncRoute(async(req,res)=>{
  const result=await pool.query('DELETE FROM news WHERE id=$1',[req.params.id]);
  if(!result.rowCount)return res.status(404).json({error:'الخبر غير موجود'});
  res.status(204).end();
}));

const userCreateSchema=z.object({
  name:z.string().trim().min(2).max(160),
  email:z.string().email().max(320),
  password:z.string().min(10).max(128),
  role:z.enum(['admin','manager','staff','viewer']).default('staff')
});
const userUpdateSchema=z.object({
  name:z.string().trim().min(2).max(160).optional(),
  email:z.string().email().max(320).optional(),
  password:z.string().min(10).max(128).optional(),
  role:z.enum(['admin','manager','staff','viewer']).optional(),
  is_active:z.boolean().optional()
});
async function userAudit(req,action,targetId,metadata={}){try{await pool.query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,$2,$3,$4,$5,$6)',[req.user.sub,action,'user',targetId,metadata,req.ip||null])}catch{}}

app.get('/api/admin/users',auth,allow('admin'),asyncRoute(async(_req,res)=>{
  const {rows}=await pool.query('SELECT id,name,email,role,is_active,created_at,updated_at FROM users ORDER BY created_at DESC');
  res.json(rows);
}));

app.post('/api/admin/users',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const d=userCreateSchema.parse(req.body);
  const email=d.email.toLowerCase();
  const exists=await pool.query('SELECT 1 FROM users WHERE email=$1',[email]);
  if(exists.rowCount)return res.status(409).json({error:'البريد الإلكتروني مستخدم بالفعل'});
  const hash=await bcrypt.hash(d.password,12);
  const {rows}=await pool.query('INSERT INTO users(name,email,password_hash,role,is_active) VALUES($1,$2,$3,$4,true) RETURNING id,name,email,role,is_active,created_at,updated_at',[d.name,email,hash,d.role]);
  await userAudit(req,'create',rows[0].id,{role:d.role});
  res.status(201).json(rows[0]);
}));

app.patch('/api/admin/users/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id);
  const d=userUpdateSchema.parse(req.body);
  const current=(await pool.query('SELECT id,name,email,role,is_active FROM users WHERE id=$1',[id])).rows[0];
  if(!current)return res.status(404).json({error:'المستخدم غير موجود'});
  if(id===req.user.sub){
    if(Object.hasOwn(d,'is_active')&&d.is_active===false)return res.status(400).json({error:'لا يمكنك تعطيل حسابك الحالي'});
    if(Object.hasOwn(d,'role')&&d.role!=='admin')return res.status(400).json({error:'لا يمكنك خفض صلاحية حسابك الحالي'});
  }
  if(d.email){const email=d.email.toLowerCase();const exists=await pool.query('SELECT 1 FROM users WHERE email=$1 AND id<>$2',[email,id]);if(exists.rowCount)return res.status(409).json({error:'البريد الإلكتروني مستخدم بالفعل'});d.email=email}
  const sets=[],values=[];
  for(const key of ['name','email','role','is_active'])if(Object.hasOwn(d,key)){values.push(d[key]);sets.push(`${key}=$${values.length}`)}
  if(d.password){values.push(await bcrypt.hash(d.password,12));sets.push(`password_hash=$${values.length}`)}
  if(!sets.length)return res.status(400).json({error:'لا توجد تغييرات صالحة'});
  values.push(id);
  const {rows}=await pool.query(`UPDATE users SET ${sets.join(',')},updated_at=now() WHERE id=$${values.length} RETURNING id,name,email,role,is_active,created_at,updated_at`,values);
  await userAudit(req,'update',id,{role:rows[0].role,is_active:rows[0].is_active,password_changed:Boolean(d.password)});
  res.json(rows[0]);
}));

app.use((err,req,res,_next)=>{console.error('[bunyan-bootstrap]',err);if(res.headersSent)return;if(err instanceof z.ZodError)return res.status(400).json({error:'بيانات غير صالحة',details:err.flatten()});res.status(500).json({error:process.env.NODE_ENV==='production'?'حدث خطأ داخلي':err.message})});