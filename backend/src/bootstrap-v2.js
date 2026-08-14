import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { z } from 'zod';

let app;
const outerListen=express.application.listen;
express.application.listen=function(...args){app=this;return outerListen.apply(this,args)};
await import('./bootstrap.js');
express.application.listen=outerListen;
if(!app)throw new Error('BUNYAN Express application was not captured by bootstrap-v2');

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
const secret=process.env.JWT_SECRET;
if(!secret)throw new Error('JWT_SECRET is required');
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function auth(req,res,next){const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({error:'يلزم تسجيل الدخول'});try{req.user=jwt.verify(token,secret,{issuer:'bunyan-api',audience:'bunyan-admin'});next()}catch{return res.status(401).json({error:'جلسة غير صالحة أو منتهية'})}}
const adminOnly=(req,res,next)=>req.user?.role==='admin'?next():res.status(403).json({error:'هذه العملية متاحة لمدير النظام فقط'});

const tables={
  projects:['id','slug','name','summary','description','status','progress','beneficiaries_target','budget','currency','cover_image_url','location','start_date','end_date','is_public','created_by','created_at','updated_at'],
  project_updates:['id','project_id','title','body','published_at','is_public','created_by','created_at','updated_at'],
  project_expenses:['id','project_id','title','amount','currency','spent_at','category','notes','is_public','created_by','created_at','updated_at'],
  beneficiaries:['id','name','phone','service','status','project_id','notes','created_at'],
  volunteers:['id','name','phone','email','skill','hours','status','created_at'],
  donations:['id','donor','phone','amount','currency','project_id','project_name','method','reference','receipt_number','status','created_at','verified_at','verified_by'],
  news:['id','title','body','published_at','is_public','created_by','created_at','updated_at'],
  participation_requests:['id','name','phone','role','message','status','created_at','updated_at'],
  help_requests:['id','tracking_number','full_name','phone','location','case_type','description','requested_amount','currency','status','admin_notes','created_at','updated_at'],
  financial_entries:['id','entry_type','project_id','title','category','amount','currency','entry_date','reference_number','proof_url','notes','is_public','created_by','created_at','updated_at'],
  audit_logs:['id','user_id','action','entity_type','entity_id','metadata','ip_address','created_at']
};
const restoreOrder=['projects','project_updates','project_expenses','beneficiaries','volunteers','donations','news','participation_requests','help_requests','financial_entries','audit_logs'];
const clearOrder=[...restoreOrder].reverse();
const backupSchema=z.object({version:z.string().min(1),createdAt:z.string().optional(),data:z.record(z.array(z.record(z.any())))});
async function counts(client=pool){const out={};for(const table of restoreOrder){const r=await client.query(`SELECT count(*)::int count FROM ${table}`);out[table]=r.rows[0].count}return out}
async function audit(req,action,metadata={}){try{await pool.query('INSERT INTO audit_logs(user_id,action,entity_type,metadata,ip_address) VALUES($1,$2,$3,$4,$5)',[req.user?.sub||null,action,'backup',metadata,req.ip||null])}catch{}}

await pool.query(`CREATE TABLE IF NOT EXISTS system_settings(
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),
  site_name VARCHAR(120) NOT NULL DEFAULT 'بُنْيَان',
  tagline VARCHAR(220) NOT NULL DEFAULT '',
  contact_email VARCHAR(320) NOT NULL DEFAULT '',
  contact_phone VARCHAR(60) NOT NULL DEFAULT '',
  default_currency VARCHAR(3) NOT NULL DEFAULT 'SDG' CHECK(default_currency IN ('SDG','SAR','USD')),
  public_finance BOOLEAN NOT NULL DEFAULT TRUE,
  accept_help_requests BOOLEAN NOT NULL DEFAULT TRUE,
  accept_donations BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO system_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;`);
const settingsSchema=z.object({site_name:z.string().trim().min(2).max(120),tagline:z.string().max(220).default(''),contact_email:z.union([z.string().email().max(320),z.literal('')]).default(''),contact_phone:z.string().max(60).default(''),default_currency:z.enum(['SDG','SAR','USD']).default('SDG'),public_finance:z.boolean(),accept_help_requests:z.boolean(),accept_donations:z.boolean()});
app.get('/api/admin/settings',auth,adminOnly,asyncRoute(async(_req,res)=>{const {rows}=await pool.query('SELECT site_name,tagline,contact_email,contact_phone,default_currency,public_finance,accept_help_requests,accept_donations,updated_at FROM system_settings WHERE id=1');res.json(rows[0])}));
app.patch('/api/admin/settings',auth,adminOnly,asyncRoute(async(req,res)=>{const d=settingsSchema.parse(req.body);const {rows}=await pool.query('UPDATE system_settings SET site_name=$1,tagline=$2,contact_email=$3,contact_phone=$4,default_currency=$5,public_finance=$6,accept_help_requests=$7,accept_donations=$8,updated_at=now() WHERE id=1 RETURNING site_name,tagline,contact_email,contact_phone,default_currency,public_finance,accept_help_requests,accept_donations,updated_at',[d.site_name,d.tagline,d.contact_email,d.contact_phone,d.default_currency,d.public_finance,d.accept_help_requests,d.accept_donations]);res.json(rows[0])}));

app.get('/api/admin/backup/status',auth,adminOnly,asyncRoute(async(_req,res)=>res.json({version:'9.0-backup',counts:await counts()})));
app.get('/api/admin/backup/export',auth,adminOnly,asyncRoute(async(req,res)=>{const data={};for(const table of restoreOrder)data[table]=(await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`)).rows;const backup={version:'9.0-backup',createdAt:new Date().toISOString(),data};await audit(req,'export',{tables:restoreOrder.length});res.setHeader('Content-Disposition',`attachment; filename="bunyan-backup-${new Date().toISOString().slice(0,10)}.json"`);res.json(backup)}));

app.post('/api/admin/backup/import',auth,adminOnly,express.json({limit:'25mb'}),asyncRoute(async(req,res)=>{
  if(req.body?.confirm!=='RESTORE_BUNYAN')return res.status(400).json({error:'تأكيد الاستعادة غير صحيح'});
  const backup=backupSchema.parse(req.body?.backup);
  for(const table of restoreOrder){if(!Array.isArray(backup.data[table]))return res.status(400).json({error:`النسخة لا تحتوي الجدول المطلوب: ${table}`})}
  const client=await pool.connect();let restored=0;
  try{
    await client.query('BEGIN');
    for(const table of clearOrder)await client.query(`DELETE FROM ${table}`);
    for(const table of restoreOrder){
      const allowed=tables[table];
      for(const row of backup.data[table]){
        const cols=allowed.filter(c=>Object.hasOwn(row,c));
        if(!cols.length)continue;
        const vals=cols.map(c=>row[c]);
        const marks=cols.map((_,i)=>`$${i+1}`).join(',');
        await client.query(`INSERT INTO ${table}(${cols.join(',')}) VALUES(${marks})`,vals);
        restored++;
      }
    }
    await client.query("SELECT setval('help_request_number_seq', GREATEST((SELECT coalesce(max((regexp_match(tracking_number,'([0-9]+)$'))[1]::bigint),0) FROM help_requests)+1,1), false)");
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  await audit(req,'restore',{restored,sourceVersion:backup.version});
  res.json({ok:true,restored,counts:await counts()});
}));
