import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
const previousListen = express.application.listen;

function pool(){return new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false})}
function auth(req,res,next){const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({error:'يلزم تسجيل الدخول'});try{req.user=jwt.verify(token,process.env.JWT_SECRET);next()}catch{return res.status(401).json({error:'جلسة غير صالحة أو منتهية'})}}
function admin(req,res,next){return req.user?.role==='admin'?next():res.status(403).json({error:'هذه العملية للمدير فقط'})}

express.application.listen=function globalAdminListen(...args){
  const app=this;
  if(!app.locals.globalAdminInstalled){
    app.locals.globalAdminInstalled=true;
    const db=pool();

    app.get('/api/admin/system',auth,admin,async(req,res,next)=>{try{
      const started=Date.now();
      const {rows}=await db.query(`SELECT
        (SELECT count(*) FROM users)::int users,
        (SELECT count(*) FROM users WHERE is_active=true)::int active_users,
        (SELECT count(*) FROM projects)::int projects,
        (SELECT count(*) FROM participation_requests)::int requests,
        (SELECT count(*) FROM donations)::int donations,
        (SELECT count(*) FROM donation_attachments)::int donation_receipts,
        (SELECT count(*) FROM audit_logs WHERE created_at>now()-interval '24 hours')::int actions_24h,
        pg_database_size(current_database())::bigint database_bytes`);
      res.json({...rows[0],database_ms:Date.now()-started,api_version:'7.0.0',environment:process.env.NODE_ENV||'development',time:new Date().toISOString()});
    }catch(err){next(err)}});

    app.get('/api/admin/users',auth,admin,async(req,res,next)=>{try{
      const {rows}=await db.query('SELECT id,name,email,role,is_active,created_at,updated_at FROM users ORDER BY created_at DESC');res.json(rows)
    }catch(err){next(err)}});

    app.post('/api/admin/users',auth,admin,async(req,res,next)=>{try{
      const data=z.object({name:z.string().min(2).max(120),email:z.string().email(),password:z.string().min(10).max(128),role:z.enum(['admin','manager','staff','viewer'])}).parse(req.body);
      const hash=await bcrypt.hash(data.password,12);
      const {rows}=await db.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,is_active,created_at',[data.name,data.email.toLowerCase(),hash,data.role]);
      await db.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,'create_user','users',$2,$3,$4)",[req.user.sub,rows[0].id,JSON.stringify({role:data.role,email:data.email.toLowerCase()}),req.ip]);
      res.status(201).json(rows[0]);
    }catch(err){if(err instanceof z.ZodError)return res.status(400).json({error:'تحقق من بيانات المستخدم وكلمة السر'});if(err.code==='23505')return res.status(409).json({error:'البريد مستخدم مسبقاً'});next(err)}});

    app.patch('/api/admin/users/:id',auth,admin,async(req,res,next)=>{try{
      const data=z.object({name:z.string().min(2).max(120).optional(),role:z.enum(['admin','manager','staff','viewer']).optional(),isActive:z.boolean().optional()}).parse(req.body);
      if(req.params.id===req.user.sub&&data.isActive===false)return res.status(400).json({error:'لا يمكنك تعطيل حسابك الحالي'});
      const entries=[];const values=[];
      if(data.name!==undefined){entries.push(`name=$${values.length+1}`);values.push(data.name)}
      if(data.role!==undefined){entries.push(`role=$${values.length+1}`);values.push(data.role)}
      if(data.isActive!==undefined){entries.push(`is_active=$${values.length+1}`);values.push(data.isActive)}
      if(!entries.length)return res.status(400).json({error:'لا توجد تغييرات'});
      entries.push('updated_at=now()');values.push(req.params.id);
      const {rows}=await db.query(`UPDATE users SET ${entries.join(',')} WHERE id=$${values.length} RETURNING id,name,email,role,is_active,created_at,updated_at`,values);
      if(!rows[0])return res.status(404).json({error:'المستخدم غير موجود'});
      await db.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,'update_user','users',$2,$3,$4)",[req.user.sub,req.params.id,JSON.stringify(data),req.ip]);
      res.json(rows[0]);
    }catch(err){if(err instanceof z.ZodError)return res.status(400).json({error:'بيانات المستخدم غير صالحة'});next(err)}});

    app.post('/api/admin/users/:id/reset-password',auth,admin,async(req,res,next)=>{try{
      const {password}=z.object({password:z.string().min(10).max(128)}).parse(req.body);const hash=await bcrypt.hash(password,12);
      const result=await db.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,req.params.id]);if(!result.rowCount)return res.status(404).json({error:'المستخدم غير موجود'});
      await db.query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,'admin_reset_password','users',$2,'{}'::jsonb,$3)",[req.user.sub,req.params.id,req.ip]);res.json({ok:true})
    }catch(err){if(err instanceof z.ZodError)return res.status(400).json({error:'كلمة السر لا تقل عن 10 أحرف'});next(err)}});

    app.get('/api/admin/audit',auth,admin,async(req,res,next)=>{try{
      const limit=Math.min(200,Math.max(10,Number(req.query.limit)||100));
      const {rows}=await db.query(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.metadata,a.ip_address,a.created_at,u.name AS user_name,u.email AS user_email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT $1`,[limit]);res.json(rows)
    }catch(err){next(err)}});
  }
  return previousListen.apply(app,args)
};
