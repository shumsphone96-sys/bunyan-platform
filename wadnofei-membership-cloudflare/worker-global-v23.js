import app from './worker-global-v21.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';

export default {
  async fetch(req, env, ctx) {
    if (env.DB) await ensureNotifications(env.DB);

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/,'') || '/';
    const method = req.method.toUpperCase();

    if (path === '/club-admin/notifications/history' && method === 'GET') {
      return notificationHistory(env);
    }

    const joinPost = method === 'POST' && (path === '/membership' || path === '/membership/join');
    let joinData = null;
    if (joinPost) {
      try {
        const f = await req.clone().formData();
        joinData = {
          full_name: String(f.get('full_name') || '').trim(),
          phone: normalizePhone(f.get('phone'))
        };
      } catch (_) {}
    }

    const stage = path.match(/^\/applications\/(\d+)\/stage\/(received|review|needs-info|ready|approve|reject)$/);
    const response = await app.fetch(req, env, ctx);

    if (joinPost && response.status === 201 && env.DB && joinData?.phone) {
      ctx.waitUntil(afterNewApplication(env, joinData));
    }

    if (stage && method === 'POST' && response.status < 400 && env.DB) {
      ctx.waitUntil(afterStageChange(env, Number(stage[1]), stage[2]));
    }

    if (path === '/club-admin/notifications' && method === 'GET' && response.headers.get('content-type')?.includes('text/html')) {
      let body = await response.text();
      body = body.replace('مركز الإشعارات · V21','مركز الإشعارات · V23');
      body = body.replace('المرحلة الحالية تجريبية عبر Meta. بعد تثبيت الرقم الإنتاجي واعتماد قوالب الرسائل، سيتم تحويل التنبيهات إلى تشغيل تلقائي للعضوية والدفع.','الإشعارات الآلية موجهة الآن إلى رقم صاحب الطلب المسجل في نموذج العضوية.');
      body = body.replace('</main>', `<div style="width:min(820px,92%);margin:0 auto 34px"><a href="/club-admin/notifications/history" style="display:block;text-align:center;background:#d5a928;color:#061a43;text-decoration:none;padding:13px 16px;border-radius:14px;font-weight:900">سجل الإشعارات الآلية</a></div></main>`);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.set('x-wadnofei-ui','v23-direct-applicant-whatsapp');
      return new Response(body,{status:response.status,statusText:response.statusText,headers});
    }

    return response;
  }
};

async function ensureNotifications(db){
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS club_notifications(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER,
      application_no TEXT,
      member_name TEXT,
      target_phone TEXT,
      actual_recipient TEXT,
      event_type TEXT,
      message TEXT,
      status TEXT DEFAULT 'queued',
      provider_message_id TEXT,
      error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT
    )`).run();
  } catch (_) {}
}

async function afterNewApplication(env, submitted){
  try {
    const row = await env.DB.prepare(`SELECT id,application_no,full_name,phone FROM applications WHERE phone=? AND status='pending' ORDER BY id DESC LIMIT 1`).bind(submitted.phone).first();
    if (!row) return;
    const msg = `مرحباً ${row.full_name || 'بك'}،\nتم استلام طلب عضويتك في ${CLUB} بنجاح.\nرقم الطلب: ${row.application_no}\nيمكنك متابعة حالة الطلب من: ${origin(env)}/membership/track`;
    await queueAndSend(env, row, 'application_received', msg);
  } catch (_) {}
}

async function afterStageChange(env, applicationId, action){
  try {
    const row = await env.DB.prepare(`SELECT id,application_no,full_name,phone,admin_note,status,review_stage FROM applications WHERE id=?`).bind(applicationId).first();
    if (!row) return;

    let event = action;
    let msg = '';
    if (action === 'review') {
      msg = `عزيزي ${row.full_name}،\nبدأت إدارة ${CLUB} مراجعة طلب العضوية رقم ${row.application_no}. سنخطرك بأي تحديث.`;
    } else if (action === 'needs-info') {
      msg = `عزيزي ${row.full_name}،\nطلب العضوية رقم ${row.application_no} يحتاج استكمال بيانات.${row.admin_note ? `\nالمطلوب: ${row.admin_note}` : ''}`;
    } else if (action === 'ready') {
      msg = `عزيزي ${row.full_name}،\nتمت مراجعة طلبك رقم ${row.application_no} وأصبح جاهزاً للاعتماد النهائي.`;
    } else if (action === 'approve') {
      const member = await env.DB.prepare(`SELECT member_no FROM members WHERE application_id=? ORDER BY id DESC LIMIT 1`).bind(applicationId).first();
      msg = `مبروك ${row.full_name} 🎉\nتم اعتماد عضويتك في ${CLUB}.\nرقم العضوية: ${member?.member_no || 'تم الإصدار'}\nنرحب بك عضواً في النادي.`;
      event = 'membership_approved';
    } else if (action === 'reject') {
      msg = `عزيزي ${row.full_name}،\nتم تحديث طلب العضوية رقم ${row.application_no} إلى: غير معتمد.${row.admin_note ? `\nملاحظة الإدارة: ${row.admin_note}` : ''}`;
      event = 'application_rejected';
    } else {
      return;
    }
    await queueAndSend(env, row, event, msg);
  } catch (_) {}
}

async function queueAndSend(env, row, eventType, message){
  const targetPhone = normalizePhone(row.phone);
  const actualRecipient = targetPhone;
  const finalMessage = message;

  let insertedId = null;
  try {
    const result = await env.DB.prepare(`INSERT INTO club_notifications(application_id,application_no,member_name,target_phone,actual_recipient,event_type,message,status) VALUES(?,?,?,?,?,?,?,'queued')`).bind(row.id,row.application_no,row.full_name,targetPhone,actualRecipient,eventType,finalMessage).run();
    insertedId = result?.meta?.last_row_id || null;
  } catch (_) {}

  const sent = await sendWhatsApp(env, actualRecipient, finalMessage);
  if (insertedId) {
    try {
      await env.DB.prepare(`UPDATE club_notifications SET status=?,provider_message_id=?,error=?,sent_at=CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id=?`)
        .bind(sent.ok?'sent':'failed',sent.id||null,sent.error||null,sent.ok?'sent':'failed',insertedId).run();
    } catch (_) {}
  }
}

async function sendWhatsApp(env,to,message){
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return {ok:false,error:'WhatsApp credentials incomplete'};
  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
      method:'POST',
      headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:message}})
    });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) return {ok:false,error:data?.error?.message || `HTTP ${r.status}`};
    return {ok:true,id:data?.messages?.[0]?.id || null};
  } catch (e) {
    return {ok:false,error:String(e?.message || e)};
  }
}

async function notificationHistory(env){
  if (!env.DB) return page('سجل الإشعارات','قاعدة البيانات غير متاحة.');
  let rows=[];
  try {
    const r=await env.DB.prepare(`SELECT * FROM club_notifications ORDER BY id DESC LIMIT 200`).all();
    rows=r.results||[];
  } catch (_) {}
  const cards = rows.length ? rows.map(x=>`<article><div><b>${esc(label(x.event_type))}</b><span class="status ${x.status==='sent'?'sent':x.status==='failed'?'failed':''}">${esc(x.status)}</span></div><h3>${esc(x.member_name||'—')}</h3><p>${esc(x.application_no||'')}</p><small>الرقم: <span dir="ltr">+${esc(x.actual_recipient||'')}</span> · ${esc(x.created_at||'')}</small>${x.error?`<pre>${esc(x.error)}</pre>`:''}</article>`).join('') : '<article>لا توجد إشعارات مسجلة حتى الآن.</article>';
  return page('سجل الإشعارات الآلية',cards);
}

function page(title,content){
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}main{width:min(900px,92%);margin:32px auto}header{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:18px}h1{color:#d5a928}a{background:#d5a928;color:#061a43;text-decoration:none;padding:11px 14px;border-radius:12px;font-weight:900}.list{display:grid;gap:12px}article{background:#08265dcc;border:1px solid #d5a92866;border-radius:18px;padding:16px}article>div{display:flex;justify-content:space-between;gap:10px}article b{color:#ffd65b}.status{background:#ffffff18;padding:5px 9px;border-radius:999px}.sent{color:#7CFF9B}.failed{color:#ff9b9b}h3{margin:10px 0 4px}p,small{opacity:.9}pre{white-space:pre-wrap;background:#0003;padding:10px;border-radius:10px;color:#ffd0d0}</style></head><body><main><header><h1>${esc(title)}</h1><a href="/club-admin/notifications">العودة</a></header><div class="list">${content}</div></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

function label(v){return ({application_received:'استلام طلب',review:'بدء المراجعة','needs-info':'طلب استكمال',ready:'جاهز للاعتماد',membership_approved:'اعتماد العضوية',application_rejected:'رفض الطلب'})[v]||v||'إشعار'}
function origin(env){return String(env.APP_ORIGIN || 'https://members.shamsphone.net').replace(/\/$/,'')}
function normalizePhone(v){let s=String(v||'').replace(/\D/g,'');if(s.startsWith('0'))s='249'+s.slice(1);if(!s.startsWith('249'))s='249'+s;return s}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
