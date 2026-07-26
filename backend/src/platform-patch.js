import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import crypto from 'node:crypto';
import { z } from 'zod';

const { Pool } = pg;
const previousListen = express.application.listen;

function poolFactory(){
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

function auth(req,res,next){
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
  if(!token)return res.status(401).json({error:'يلزم تسجيل الدخول'});
  try{req.user=jwt.verify(token,process.env.JWT_SECRET);next()}catch{return res.status(401).json({error:'جلسة غير صالحة أو منتهية'})}
}

function allow(...roles){return(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'ليست لديك الصلاحية المطلوبة'})}
function safe(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

async function notifyDonationStatus(row,actor){
  const labels={pending:'قيد المراجعة',verified:'موثقة',rejected:'مرفوضة'};
  const fields={
    'رقم المساهمة':row.id,
    'اسم المساهم':row.donor,
    'الهاتف':row.phone||'—',
    'المبلغ':`${row.amount} ${row.currency}`,
    'الحالة الجديدة':labels[row.status]||row.status,
    'بواسطة':actor,
    'وقت التحديث':new Date().toISOString()
  };
  const title='تم تحديث حالة مساهمة في منصة بُنْيَان';
  const tasks=[];
  if(process.env.RESEND_API_KEY&&(process.env.NOTIFICATION_EMAIL||process.env.ADMIN_EMAIL)){
    const rows=Object.entries(fields).map(([k,v])=>`<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">${safe(k)}</td><td style="padding:8px;border:1px solid #ddd">${safe(v)}</td></tr>`).join('');
    tasks.push(fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM||'BUNYAN <onboarding@resend.dev>',to:[process.env.NOTIFICATION_EMAIL||process.env.ADMIN_EMAIL],subject:`تحديث مساهمة: ${row.donor}`,html:`<div dir="rtl" style="font-family:Arial"><h2>${safe(title)}</h2><table style="border-collapse:collapse;width:100%">${rows}</table></div>`})}));
  }
  if(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID){
    const text=`✅ <b>${safe(title)}</b>\n\n${Object.entries(fields).map(([k,v])=>`<b>${safe(k)}:</b> ${safe(v)}`).join('\n')}`;
    tasks.push(fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text,parse_mode:'HTML'})}));
  }
  await Promise.allSettled(tasks);
}

express.application.listen=function platformListen(...args){
  const app=this;
  if(!app.locals.bunyanPlatformRoutesInstalled){
    app.locals.bunyanPlatformRoutesInstalled=true;
    const pool=poolFactory();

    app.get('/api/system/status',auth,allow('admin','manager'),async(req,res,next)=>{
      const requestId=crypto.randomUUID();
      const started=Date.now();
      try{
        const dbStart=Date.now();
        await pool.query('SELECT 1');
        const dbLatencyMs=Date.now()-dbStart;
        res.setHeader('X-Request-Id',requestId);
        res.json({ok:true,service:'bunyan-cloud-api',version:'8.0.0',database:'connected',databaseLatencyMs:dbLatencyMs,totalLatencyMs:Date.now()-started,time:new Date().toISOString()});
      }catch(err){next(err)}
    });

    app.get('/api/reports/summary',auth,async(req,res,next)=>{
      try{
        const {rows}=await pool.query(`SELECT
          (SELECT count(*)::int FROM donations) donations_total,
          (SELECT count(*)::int FROM donations WHERE status='pending') donations_pending,
          (SELECT count(*)::int FROM donations WHERE status='verified') donations_verified,
          (SELECT count(*)::int FROM donations WHERE status='rejected') donations_rejected,
          (SELECT count(*)::int FROM donation_attachments) receipts_total,
          (SELECT count(*)::int FROM participation_requests) requests_total,
          (SELECT count(*)::int FROM participation_requests WHERE status='new') requests_new,
          (SELECT count(*)::int FROM projects) projects_total`);
        const currencies=await pool.query(`SELECT currency,status,count(*)::int count,coalesce(sum(amount),0) total FROM donations GROUP BY currency,status ORDER BY currency,status`);
        res.json({...rows[0],currencies:currencies.rows,generatedAt:new Date().toISOString()});
      }catch(err){next(err)}
    });

    app.patch('/api/donations/:id/status',auth,allow('admin','manager'),async(req,res,next)=>{
      try{
        const data=z.object({status:z.enum(['pending','verified','rejected'])}).parse(req.body);
        const {rows}=await pool.query(`UPDATE donations SET status=$1,verified_at=CASE WHEN $1='verified' THEN now() ELSE NULL END,verified_by=CASE WHEN $1='verified' THEN $2::uuid ELSE NULL END WHERE id=$3 RETURNING *`,[data.status,req.user.sub,req.params.id]);
        if(!rows[0])return res.status(404).json({error:'المساهمة غير موجودة'});
        await pool.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata,ip_address) VALUES($1,'donation_status_changed','donations',$2,$3,$4)`,[req.user.sub,req.params.id,JSON.stringify({status:data.status}),req.ip]);
        notifyDonationStatus(rows[0],req.user.name).catch(console.error);
        res.json(rows[0]);
      }catch(err){if(err instanceof z.ZodError)return res.status(400).json({error:'حالة المساهمة غير صالحة'});next(err)}
    });
  }
  return previousListen.apply(app,args);
};
