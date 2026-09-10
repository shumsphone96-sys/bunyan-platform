import app from './worker-global-v42.js';
import QRCode from 'qrcode';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const GOLD='#d5a928',BLUE='#0a347c',DARK='#061a43';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p==='/club-admin/cards'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      return cardsPage(env.DB,u.searchParams);
    }

    let x=p.match(/^\/club-admin\/applications\/(\d+)\/issue-card$/);
    if(x&&m==='POST'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      return issueCard(env.DB,Number(x[1]));
    }

    x=p.match(/^\/member-card\/([A-Za-z0-9_-]+)$/);
    if(x&&m==='GET') return memberCard(env.DB,x[1]);

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(req.method==='GET'&&ct.includes('text/html')){
      let html=await r.text();
      if(p==='/club-admin'||p==='/applications'||p==='/members'){
        const link='<a href="/club-admin/cards" style="display:inline-block;margin:8px;padding:10px 14px;border-radius:12px;background:#d5a928;color:#061a43;font-weight:900;text-decoration:none">🎫 اعتماد العضوية والبطاقات</a>';
        html=html.includes('</main>')?html.replace('</main>',link+'</main>'):html+link;
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v46-self-healing-member-schema');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function adminGate(req,env,ctx){
  try{
    const u=new URL(req.url);u.pathname='/club-admin';u.search='';
    const probe=await app.fetch(new Request(u.toString(),req),env,ctx);
    if(probe.status>=300&&probe.status<400)return new Response(null,{status:303,headers:{location:probe.headers.get('location')||'/login'}});
  }catch(_){return red('/login')}
  return null;
}

async function cols(db,table){
  try{const r=await db.prepare(`PRAGMA table_info(${table})`).all();return (r.results||[]).map(x=>x.name)}catch(_){return []}
}

async function ensureColumn(db,table,name,type='TEXT'){
  const c=await cols(db,table); if(c.includes(name))return;
  try{await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run()}catch(_){ }
}

async function ensure(db){
  if(!db)return;
  const memberCols=[
    ['full_name','TEXT'],['member_no','TEXT'],['phone','TEXT'],['address','TEXT'],['dob','TEXT'],['job','TEXT'],
    ['member_type','TEXT'],['notes','TEXT'],['photo_key','TEXT'],['status','TEXT'],['qr_token','TEXT'],
    ['approved_at','TEXT'],['created_at','TEXT'],['membership_expires_at','TEXT'],['card_issued_at','TEXT']
  ];
  for(const [n,t] of memberCols) await ensureColumn(db,'members',n,t);
  for(const [n,t] of [['member_id','INTEGER'],['reviewed_at','TEXT']]) await ensureColumn(db,'applications',n,t);
  try{await db.prepare('CREATE INDEX IF NOT EXISTS idx_members_qr_token_v46 ON members(qr_token)').run()}catch(_){}
  try{await db.prepare('CREATE INDEX IF NOT EXISTS idx_members_member_no_v46 ON members(member_no)').run()}catch(_){}
}

async function cardsPage(db,sp){
  if(!db)return H(page('اعتماد العضوية والبطاقات','<div class="note bad">قاعدة البيانات غير متاحة.</div>'),503);
  try{await ensure(db)}catch(_){ }
  let apps=[],members=[],warn='';
  try{apps=(await db.prepare('SELECT * FROM applications ORDER BY id DESC LIMIT 200').all()).results||[]}catch(e){warn='تعذر قراءة طلبات العضوية: '+String(e?.message||e)}
  apps=apps.filter(x=>!Number(x.member_id||0));
  try{members=(await db.prepare('SELECT * FROM members ORDER BY id DESC LIMIT 200').all()).results||[]}catch(e){warn+=(warn?' — ':'')+'تعذر قراءة الأعضاء: '+String(e?.message||e)}
  const msg=sp.get('msg');
  const body=`${msg?`<div class="note">${e(msg)}</div>`:''}${warn?`<div class="note bad">${e(warn)}</div>`:''}<section class="panel"><h2>طلبات بانتظار إصدار العضوية</h2>${apps.length?apps.map(x=>`<article><div><b>${e(x.full_name||x.name||'بدون اسم')}</b><small>${e(x.application_no||x.app_no||'')} · ${e(x.phone||'')} · الحالة: ${e(x.status||'pending')}</small></div><form method="post" action="/club-admin/applications/${Number(x.id)}/issue-card"><button>اعتماد وإصدار البطاقة</button></form></article>`).join(''):'<p>لا توجد طلبات غير مرتبطة بعضوية.</p>'}</section><section class="panel"><h2>البطاقات الصادرة</h2>${members.length?members.map(x=>`<article><div><b>${e(x.member_no||x.membership_no||'—')} — ${e(x.full_name||x.name||'')}</b><small>${e(x.phone||'')} · ${e(x.status||'active')}</small></div>${x.qr_token?`<a class="btn" href="/member-card/${encodeURIComponent(x.qr_token)}">فتح البطاقة</a>`:''}</article>`).join(''):'<p>لا توجد بطاقات بعد.</p>'}</section>`;
  return H(page('اعتماد العضوية والبطاقات',body));
}

async function issueCard(db,id){
  if(!db)return H(page('إصدار البطاقة','<div class="note bad">قاعدة البيانات غير متاحة.</div>'),503);
  try{
    await ensure(db);
    const ap=await db.prepare('SELECT * FROM applications WHERE id=?').bind(id).first();
    if(!ap)return H(page('غير موجود','<div class="note bad">طلب العضوية غير موجود.</div>'),404);
    if(ap.member_id){
      const existing=await db.prepare('SELECT * FROM members WHERE id=?').bind(ap.member_id).first();
      if(existing?.qr_token)return red('/member-card/'+encodeURIComponent(existing.qr_token));
    }

    const token=crypto.randomUUID().replace(/-/g,'');
    const exp=new Date(); exp.setFullYear(exp.getFullYear()+1);
    const now=new Date().toISOString();
    const fullName=ap.full_name||ap.name||'';
    const tempNo='TMP-'+token.slice(0,12);

    const r=await db.prepare(`INSERT INTO members(
      full_name,member_no,phone,address,dob,job,member_type,notes,photo_key,status,qr_token,approved_at,created_at,membership_expires_at,card_issued_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      fullName,tempNo,ap.phone||'',ap.address||'',ap.dob||ap.birth_date||'',ap.job||ap.occupation||'',ap.member_type||'',ap.notes||'',ap.photo_key||null,
      'active',token,now,now,exp.toISOString(),now
    ).run();

    const memberId=Number(r.meta?.last_row_id||0); if(!memberId)throw new Error('تعذر إنشاء سجل العضو');
    const memberNo='WDN-'+String(memberId).padStart(5,'0');
    await db.prepare('UPDATE members SET member_no=? WHERE id=?').bind(memberNo,memberId).run();
    await db.prepare("UPDATE applications SET status='approved',reviewed_at=CURRENT_TIMESTAMP,member_id=? WHERE id=?").bind(memberId,id).run();
    return red('/member-card/'+token);
  }catch(err){
    return red('/club-admin/cards?msg='+encodeURIComponent('تعذر إصدار البطاقة الآن: '+String(err?.message||err)));
  }
}

async function memberCard(db,token){
  if(!db)return H(page('بطاقة العضوية','<div class="note bad">قاعدة البيانات غير متاحة.</div>'),503);
  try{
    await ensure(db);
    const m=await db.prepare('SELECT * FROM members WHERE qr_token=? LIMIT 1').bind(token).first();
    if(!m)return H(page('بطاقة العضوية','<div class="note bad">البطاقة غير موجودة أو غير صالحة.</div>'),404);
    const verify=`https://members.shamsphone.net/member-card/${encodeURIComponent(token)}`;
    const qr=await QRCode.toDataURL(verify,{width:320,margin:1,errorCorrectionLevel:'M'});
    const exp=m.membership_expires_at?new Date(m.membership_expires_at):null;
    const valid=(m.status||'active')==='active'&&(!exp||exp>new Date());
    const body=`<section class="card"><h2>بطاقة عضوية رقمية</h2><h1>${e(m.full_name||m.name||'')}</h1><div class="no">${e(m.member_no||m.membership_no||'')}</div><div class="grid"><span>نوع العضوية<b>${e(m.member_type||'عضو')}</b></span><span>الحالة<b class="${valid?'ok':'bad'}">${valid?'سارية':'غير سارية'}</b></span><span>تاريخ الاعتماد<b>${date(m.approved_at||m.created_at)}</b></span><span>صالحة حتى<b>${exp?date(m.membership_expires_at):'غير محدد'}</b></span></div><img class="qr" src="${qr}" alt="QR"><p>امسح الرمز للتحقق من صحة العضوية.</p></section>`;
    return H(page('بطاقة العضوية',body));
  }catch(err){return H(page('بطاقة العضوية',`<div class="note bad">تعذر فتح البطاقة: ${e(err?.message||err)}</div>`),500)}
}

function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(t)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">الإدارة</a></header><main><h1>${e(t)}</h1>${b}</main><footer>نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function css(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,${DARK},${BLUE});color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}header{padding:16px 5%;display:flex;justify-content:space-between;border-bottom:1px solid #d5a92866}header b,h1,h2{color:${GOLD}}header a{color:#fff}main{width:min(900px,92%);margin:28px auto}.panel,.card{background:#08265dee;border:1px solid #d5a92888;border-radius:22px;padding:20px;margin:18px 0}.panel article{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #ffffff20}.panel article:last-child{border:0}.panel small{display:block;opacity:.8;margin-top:5px}.btn,button{border:0;border-radius:12px;background:${GOLD};color:${DARK};padding:10px 14px;font-weight:900;text-decoration:none;cursor:pointer}.card{text-align:center;max-width:520px;margin:20px auto}.no{font-size:25px;font-weight:1000;color:${GOLD};letter-spacing:1px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.grid span{background:#061a4388;padding:12px;border-radius:14px}.grid b{display:block;margin-top:5px}.ok{color:#72e6a0}.bad{color:#ff8d8d}.qr{width:220px;max-width:70%;background:#fff;padding:8px;border-radius:16px}.note{padding:12px;border-radius:12px;background:#ffffff16;margin:10px 0}.note.bad{border:1px solid #ff8d8d}footer{text-align:center;padding:24px;color:#e4d5a7}@media(max-width:600px){.panel article{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}}`}
function H(x,s=200){return new Response(x,{status:s,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function red(x){return new Response(null,{status:303,headers:{location:x}})}
function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(v){if(!v)return'—';try{return new Intl.DateTimeFormat('ar-SD',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Africa/Khartoum'}).format(new Date(v))}catch(_){return e(v)}}
