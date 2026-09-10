import app from './worker-global-v42.js';
import QRCode from 'qrcode';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const GOLD='#d5a928',BLUE='#0a347c',DARK='#061a43';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url), p=u.pathname.replace(/\/$/,'')||'/', m=req.method.toUpperCase();
    if(env.DB) await init(env.DB);

    if(p==='/club-admin/cards'){
      const a=env.DB?await admin(req,env.DB):null;
      if(!a) return red('/login');
      return cardsAdmin(env.DB,u.searchParams);
    }

    let x=p.match(/^\/club-admin\/applications\/(\d+)\/issue-card$/);
    if(x&&m==='POST'){
      const a=env.DB?await admin(req,env.DB):null;
      if(!a) return red('/login');
      return issueCard(env.DB,Number(x[1]),a);
    }

    x=p.match(/^\/member-card\/([A-Za-z0-9_-]+)$/);
    if(x&&m==='GET') return memberCard(env.DB,x[1]);

    let r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(req.method==='GET'&&ct.includes('text/html')){
      let h=await r.text();
      if(p==='/club-admin'||p==='/applications'||p==='/members'){
        const link='<a href="/club-admin/cards" style="display:inline-block;margin:8px;padding:10px 14px;border-radius:12px;background:#d5a928;color:#061a43;font-weight:900;text-decoration:none">🎫 اعتماد العضوية والبطاقات</a>';
        h=h.includes('</main>')?h.replace('</main>',link+'</main>'):h+link;
      }
      const hd=new Headers(r.headers);hd.delete('content-length');hd.set('cache-control','no-store');hd.set('x-wadnofei-ui','v43-digital-membership');
      return new Response(h,{status:r.status,statusText:r.statusText,headers:hd});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function init(db){
  for(const q of [
    `ALTER TABLE members ADD COLUMN membership_expires_at TEXT`,
    `ALTER TABLE members ADD COLUMN card_issued_at TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_members_qr_token ON members(qr_token)`
  ]){try{await db.prepare(q).run()}catch(_){}}
}

async function admin(req,db){
  const c=req.headers.get('cookie')||'',x=c.match(/(?:^|;\s*)sid=([^;]+)/);if(!x)return null;
  const t=decodeURIComponent(x[1]);
  try{const a=await db.prepare(`SELECT u.id,u.username,COALESCE(u.role,'admin') role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){ }
  try{const a=await db.prepare(`SELECT a.id,a.username,COALESCE(a.role,'owner') role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`).bind(t).first();if(a)return a}catch(_){ }
  return null;
}

async function issueCard(db,id,a){
  const ap=await db.prepare('SELECT * FROM applications WHERE id=?').bind(id).first();
  if(!ap)return H(page('غير موجود','<div class="note bad">طلب العضوية غير موجود.</div>'),404);
  if(ap.member_id){const m=await db.prepare('SELECT * FROM members WHERE id=?').bind(ap.member_id).first();return m?red('/member-card/'+encodeURIComponent(m.qr_token)):red('/club-admin/cards?msg='+encodeURIComponent('الطلب مرتبط بعضو غير موجود'))}
  const token=crypto.randomUUID().replace(/-/g,'');
  const tmp='TMP-'+token.slice(0,12);
  const exp=new Date();exp.setFullYear(exp.getFullYear()+1);
  const expIso=exp.toISOString();
  const r=await db.prepare(`INSERT INTO members(member_no,name,phone,address,dob,job,member_type,notes,photo_key,status,qr_token,approved_at,created_at,membership_expires_at,card_issued_at) VALUES(?,?,?,?,?,?,?,?,?,'active',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)`).bind(tmp,ap.name||'',ap.phone||'',ap.address||'',ap.dob||'',ap.job||'',ap.member_type||'',ap.notes||'',ap.photo_key||null,token,expIso).run();
  const memberId=Number(r.meta?.last_row_id||0);
  const no='WDN-'+String(memberId).padStart(5,'0');
  await db.prepare('UPDATE members SET member_no=? WHERE id=?').bind(no,memberId).run();
  await db.prepare(`UPDATE applications SET status='approved',reviewed_at=CURRENT_TIMESTAMP,member_id=? WHERE id=?`).bind(memberId,id).run();
  try{await db.prepare(`INSERT INTO audit_log(admin_id,username,role,action,target_type,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(a.id,a.username,a.role,'issue_membership_card','member:'+memberId).run()}catch(_){ }
  return red('/member-card/'+token);
}

async function cardsAdmin(db,sp){
  const apps=(await db.prepare(`SELECT * FROM applications WHERE COALESCE(member_id,0)=0 ORDER BY id DESC LIMIT 200`).all()).results||[];
  const members=(await db.prepare(`SELECT id,member_no,name,phone,status,qr_token,approved_at,membership_expires_at FROM members ORDER BY id DESC LIMIT 200`).all()).results||[];
  const msg=sp.get('msg');
  const body=`${msg?`<div class="note">${e(msg)}</div>`:''}<section class="panel"><h2>طلبات بانتظار إصدار العضوية</h2>${apps.length?apps.map(x=>`<article><div><b>${e(x.name)}</b><small>${e(x.app_no||'')} · ${e(x.phone||'')} · الحالة: ${e(x.status||'pending')}</small></div><form method="post" action="/club-admin/applications/${x.id}/issue-card"><button>اعتماد وإصدار البطاقة</button></form></article>`).join(''):'<p>لا توجد طلبات غير مرتبطة بعضوية.</p>'}</section><section class="panel"><h2>البطاقات الصادرة</h2>${members.length?members.map(x=>`<article><div><b>${e(x.member_no)} — ${e(x.name)}</b><small>${e(x.phone||'')} · ${e(x.status||'active')}</small></div><a class="btn" href="/member-card/${encodeURIComponent(x.qr_token)}">فتح البطاقة</a></article>`).join(''):'<p>لا توجد بطاقات بعد.</p>'}</section>`;
  return H(page('اعتماد العضوية والبطاقات',body));
}

async function memberCard(db,token){
  if(!db)return H(page('بطاقة العضوية','<div class="note bad">قاعدة البيانات غير متاحة.</div>'),503);
  const m=await db.prepare('SELECT * FROM members WHERE qr_token=? LIMIT 1').bind(token).first();
  if(!m)return H(page('بطاقة العضوية','<div class="note bad">البطاقة غير موجودة أو غير صالحة.</div>'),404);
  const verify=`https://members.shamsphone.net/member-card/${encodeURIComponent(token)}`;
  const qr=await QRCode.toDataURL(verify,{width:320,margin:1,errorCorrectionLevel:'M'});
  const exp=m.membership_expires_at?new Date(m.membership_expires_at):null;
  const valid=m.status==='active'&&(!exp||exp>new Date());
  const body=`<section class="card"><div class="seal">WDN</div><h2>بطاقة عضوية رقمية</h2><h1>${e(m.name)}</h1><div class="no">${e(m.member_no)}</div><div class="grid"><span>نوع العضوية<b>${e(m.member_type||'عضو')}</b></span><span>الحالة<b class="${valid?'ok':'bad'}">${valid?'سارية':'غير سارية'}</b></span><span>تاريخ الاعتماد<b>${date(m.approved_at)}</b></span><span>صالحة حتى<b>${exp?date(m.membership_expires_at):'غير محدد'}</b></span></div><img class="qr" src="${qr}" alt="QR"><p>امسح الرمز للتحقق من صحة العضوية.</p></section>`;
  return H(page('بطاقة العضوية',body));
}

function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(t)} · ${CLUB}</title><style>${css()}</style></head><body><header><b>${CLUB}</b><a href="/membership">العضوية</a></header><main><h1>${e(t)}</h1>${b}</main><footer>نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function css(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,${DARK},${BLUE});color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}header{padding:16px 5%;display:flex;justify-content:space-between;border-bottom:1px solid #d5a92866}header b,h1,h2{color:${GOLD}}header a{color:#fff}main{width:min(900px,92%);margin:28px auto}.panel,.card{background:#08265dee;border:1px solid #d5a92888;border-radius:22px;padding:20px;margin:18px 0}.panel article{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #ffffff20}.panel article:last-child{border:0}.panel small{display:block;opacity:.8;margin-top:5px}.btn,button{border:0;border-radius:12px;background:${GOLD};color:${DARK};padding:10px 14px;font-weight:900;text-decoration:none;cursor:pointer}.card{text-align:center;max-width:520px;margin:20px auto}.seal{width:76px;height:76px;margin:auto;border:3px solid ${GOLD};border-radius:50%;display:grid;place-items:center;color:${GOLD};font-weight:1000;font-size:22px}.no{font-size:25px;font-weight:1000;color:${GOLD};letter-spacing:1px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.grid span{background:#061a4388;padding:12px;border-radius:14px}.grid b{display:block;margin-top:5px}.ok{color:#72e6a0}.bad{color:#ff8d8d}.qr{width:220px;max-width:70%;background:#fff;padding:8px;border-radius:16px}.note{padding:12px;border-radius:12px;background:#ffffff16}.note.bad{border:1px solid #ff8d8d}footer{text-align:center;padding:24px;color:#e4d5a7}@media(max-width:600px){.panel article{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}}`}
function H(x,s=200){return new Response(x,{status:s,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function red(x){return new Response(null,{status:303,headers:{location:x}})}
function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(v){if(!v)return'—';try{return new Intl.DateTimeFormat('ar-SD',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Africa/Khartoum'}).format(new Date(v))}catch(_){return e(v)}}
