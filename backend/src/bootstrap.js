import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';

// Keep the strict login limiter, but raise the general API allowance.
// The frontend loads several live modules, so the old global limit of 400
// could be exhausted and block a correct administrator login.
const sourceUrl=new URL('./server-v8.js',import.meta.url);
const runtimeUrl=new URL('./server-runtime.js',import.meta.url);
const source=await readFile(sourceUrl,'utf8');
const patched=source.replace(
  "app.use('/api/',rateLimit({windowMs:15*60*1000,limit:400,",
  "app.use('/api/',rateLimit({windowMs:15*60*1000,limit:5000,"
);
if(patched===source)throw new Error('Global API rate-limit signature was not found');
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
const publicWriteLimit=rateLimit({windowMs:60*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'تم تجاوز الحد المسموح مؤقتاً.'}});
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function auth(req,res,next){const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({error:'يلزم تسجيل الدخول'});try{req.user=jwt.verify(token,secret,{issuer:'bunyan-api',audience:'bunyan-admin'});next()}catch{return res.status(401).json({error:'جلسة غير صالحة أو منتهية'})}}
const allow=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'ليست لديك الصلاحية المطلوبة'});

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

app.use((err,req,res,_next)=>{console.error('[help-requests]',err);if(res.headersSent)return;if(err instanceof z.ZodError)return res.status(400).json({error:'بيانات غير صالحة',details:err.flatten()});res.status(500).json({error:process.env.NODE_ENV==='production'?'حدث خطأ داخلي':err.message})});