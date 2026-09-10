import app from './worker-global-v48.js';
import QRCode from 'qrcode';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';
const ORIGIN='https://members.shamsphone.net';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    if(p==='/club-admin/memberships'&&m==='GET'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      return membershipAdmin(env.DB,u.searchParams);
    }

    let x=p.match(/^\/club-admin\/members\/(\d+)\/renew$/);
    if(x&&m==='POST'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      return renewMember(req,env.DB,Number(x[1]));
    }

    x=p.match(/^\/club-admin\/members\/(\d+)\/status$/);
    if(x&&m==='POST'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      return changeStatus(req,env.DB,Number(x[1]));
    }

    x=p.match(/^\/member-card\/([A-Za-z0-9_-]+)$/);
    if(x&&m==='GET') return officialCard(env.DB,x[1]);

    x=p.match(/^\/verify\/([A-Za-z0-9_-]+)$/);
    if(x&&m==='GET') return red('/member-card/'+encodeURIComponent(x[1]));

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await r.text();
      if(['/club-admin','/applications','/members','/club-admin/cards','/club-admin/membership'].includes(p)){
        const link='<a href="/club-admin/memberships" style="display:inline-block;margin:8px;padding:10px 14px;border-radius:12px;background:#0a347c;color:#fff;border:1px solid #d5a928;font-weight:900;text-decoration:none">🏅 سجل العضوية والتجديد</a>';
        html=html.includes('</main>')?html.replace('</main>',link+'</main>'):html+link;
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v49-membership-distribution-ready');
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

async function cols(db,t){try{const r=await db.prepare(`PRAGMA table_info(${t})`).all();return (r.results||[]).map(x=>x.name)}catch(_){return []}}
async function ensure(db){
  if(!db)return;
  const c=await cols(db,'members');
  for(const [n,t] of [['membership_expires_at','TEXT'],['card_issued_at','TEXT'],['status','TEXT'],['qr_token','TEXT'],['member_no','TEXT'],['full_name','TEXT']]){
    if(!c.includes(n)){try{await db.prepare(`ALTER TABLE members ADD COLUMN ${n} ${t}`).run()}catch(_){}}
  }
}

async function membershipAdmin(db,sp){
  if(!db)return H(page('سجل العضوية والتجديد','<div class="alert bad">قاعدة البيانات غير متاحة.</div>'),503);
  await ensure(db);
  let members=[];try{members=(await db.prepare('SELECT * FROM members ORDER BY id DESC LIMIT 500').all()).results||[]}catch(e){return H(page('سجل العضوية والتجديد',`<div class="alert bad">${esc(e?.message||e)}</div>`),500)}
  const q=(sp.get('q')||'').trim().toLowerCase();
  if(q)members=members.filter(x=>String(x.full_name||x.name||'').toLowerCase().includes(q)||String(x.member_no||x.membership_no||'').toLowerCase().includes(q)||String(x.phone||'').includes(q));
  const now=new Date();
  const active=members.filter(x=>(x.status||'active')==='active'&&(!x.membership_expires_at||new Date(x.membership_expires_at)>now)).length;
  const expired=members.filter(x=>x.membership_expires_at&&new Date(x.membership_expires_at)<=now).length;
  const body=`<div class="stats"><div><b>${members.length}</b><span>إجمالي الأعضاء</span></div><div><b>${active}</b><span>عضوية سارية</span></div><div><b>${expired}</b><span>منتهية</span></div></div>
  <form class="search" method="get"><input name="q" value="${esc(sp.get('q')||'')}" placeholder="بحث بالاسم أو رقم العضوية أو الهاتف"><button>بحث</button></form>
  <section class="panel">${members.length?members.map(memberRow).join(''):'<p>لا توجد نتائج.</p>'}</section>`;
  return H(page('سجل العضوية والتجديد',body));
}

function memberRow(m){
  const exp=m.membership_expires_at?new Date(m.membership_expires_at):null;
  const valid=(m.status||'active')==='active'&&(!exp||exp>new Date());
  return `<article class="member-row"><div class="member-info"><b>${esc(m.full_name||m.name||'بدون اسم')}</b><small>${esc(m.member_no||m.membership_no||'—')} · ${esc(m.phone||'—')}</small><span class="pill ${valid?'ok':'bad'}">${valid?'سارية':'غير سارية'}${exp?' · حتى '+date(m.membership_expires_at):''}</span></div><div class="row-actions">${m.qr_token?`<a href="/member-card/${encodeURIComponent(m.qr_token)}">فتح البطاقة</a>`:''}<form method="post" action="/club-admin/members/${Number(m.id)}/renew"><select name="months"><option value="1">شهر</option><option value="3">3 أشهر</option><option value="6">6 أشهر</option><option value="12" selected>سنة</option></select><button>تجديد</button></form><form method="post" action="/club-admin/members/${Number(m.id)}/status"><input type="hidden" name="status" value="${(m.status||'active')==='active'?'suspended':'active'}"><button class="secondary">${(m.status||'active')==='active'?'إيقاف':'تفعيل'}</button></form></div></article>`;
}

async function renewMember(req,db,id){
  if(!db)return red('/club-admin/memberships?msg=db');
  await ensure(db);
  const f=await req.formData();const months=Math.max(1,Math.min(24,Number(f.get('months')||12)));
  const m=await db.prepare('SELECT * FROM members WHERE id=?').bind(id).first();if(!m)return red('/club-admin/memberships');
  const now=new Date();let base=m.membership_expires_at?new Date(m.membership_expires_at):now;if(!(base>now))base=now;base.setMonth(base.getMonth()+months);
  await db.prepare("UPDATE members SET membership_expires_at=?,status='active' WHERE id=?").bind(base.toISOString(),id).run();
  return red('/club-admin/memberships');
}

async function changeStatus(req,db,id){
  if(!db)return red('/club-admin/memberships');
  const f=await req.formData();const status=f.get('status')==='suspended'?'suspended':'active';
  await db.prepare('UPDATE members SET status=? WHERE id=?').bind(status,id).run();
  return red('/club-admin/memberships');
}

async function officialCard(db,token){
  if(!db)return H(page('بطاقة العضوية','<div class="alert bad">قاعدة البيانات غير متاحة.</div>'),503);
  await ensure(db);
  try{
    const m=await db.prepare('SELECT * FROM members WHERE qr_token=? LIMIT 1').bind(token).first();
    if(!m)return H(page('بطاقة العضوية','<div class="alert bad">البطاقة غير موجودة أو غير صالحة.</div>'),404);
    const verify=`${ORIGIN}/member-card/${encodeURIComponent(token)}`;
    const qr=await QRCode.toString(verify,{type:'svg',margin:1,errorCorrectionLevel:'M',width:300});
    const exp=m.membership_expires_at?new Date(m.membership_expires_at):null;
    const valid=(m.status||'active')==='active'&&(!exp||exp>new Date());
    const name=m.full_name||m.name||'عضو نادي ود نفيع', no=m.member_no||m.membership_no||'—';
    const waText=encodeURIComponent(`بطاقة عضوية ${CLUB}\n${name}\nرقم العضوية: ${no}\nالتحقق: ${verify}`);
    const body=`<section class="official-card"><div class="card-head"><img src="${LOGO}" class="logo" alt="شعار نادي ود نفيع"><div><strong>${CLUB}</strong><small>تأسس عام 1964</small></div><span class="state ${valid?'ok':'bad'}">${valid?'عضوية سارية':'عضوية غير سارية'}</span></div><div class="hero"><div><span>بطاقة عضوية رسمية</span><h1>${esc(name)}</h1><div class="number">${esc(no)}</div></div><div class="qr">${qr}</div></div><div class="details"><div><span>نوع العضوية</span><b>${esc(m.member_type||'عضو')}</b></div><div><span>الهاتف</span><b dir="ltr">${esc(m.phone||'—')}</b></div><div><span>تاريخ الاعتماد</span><b>${date(m.approved_at||m.created_at)}</b></div><div><span>صالحة حتى</span><b>${exp?date(m.membership_expires_at):'غير محدد'}</b></div></div><div class="verify">✓ بطاقة قابلة للتحقق إلكترونيًا عبر رمز QR والموقع الرسمي للنادي</div></section><div class="actions no-print"><button onclick="window.print()">🖨️ طباعة</button><button onclick="navigator.share?navigator.share({title:'بطاقة عضوية',text:${JSON.stringify(name+' — '+no)},url:location.href}):navigator.clipboard.writeText(location.href)">📤 مشاركة</button><a target="_blank" rel="noopener" href="https://wa.me/?text=${waText}">واتساب</a><a href="/membership/payment?member_no=${encodeURIComponent(no)}">تجديد/إثبات دفع</a></div>`;
    return H(page('بطاقة العضوية',body));
  }catch(err){return H(page('بطاقة العضوية',`<div class="alert bad">تعذر فتح البطاقة: ${esc(err?.message||err)}</div>`),500)}
}

function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(t)} · ${CLUB}</title><style>${css()}</style></head><body><header class="no-print"><b>${CLUB}</b><nav><a href="/membership">العضوية</a><a href="/club-admin">الإدارة</a></nav></header><main><h1 class="title no-print">${esc(t)}</h1>${b}</main><footer class="no-print">نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function css(){return `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,.title{color:#d5a928}nav{display:flex;gap:12px}a{color:inherit}main{width:min(1050px,94%);margin:26px auto}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.stats div,.panel,.search{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:16px}.stats b{display:block;color:#d5a928;font-size:28px}.stats span{opacity:.82}.search{display:flex;gap:10px;margin:16px 0}.search input{flex:1;padding:12px;border-radius:12px;border:1px solid #ffffff33}.panel{padding:8px 18px}.member-row{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px 0;border-bottom:1px solid #ffffff20}.member-row:last-child{border:0}.member-info b{font-size:18px}.member-info small{display:block;opacity:.78;margin:5px 0}.pill{display:inline-block;padding:5px 9px;border-radius:999px;font-size:13px}.ok{color:#72e6a0}.bad{color:#ff9999}.pill.ok{background:#103c2d}.pill.bad{background:#4a2020}.row-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row-actions form{display:flex;gap:6px}.row-actions a,.row-actions button,.actions a,.actions button,.search button{border:0;border-radius:11px;background:#d5a928;color:#061a43;padding:10px 12px;font-weight:900;text-decoration:none}.row-actions select{border-radius:10px;padding:9px}.secondary{background:#fff!important}.official-card{max-width:780px;margin:16px auto;background:linear-gradient(145deg,#082d70,#061a43);border:2px solid #d5a928;border-radius:30px;padding:24px;box-shadow:0 18px 60px #0005}.card-head{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;border-bottom:1px solid #d5a92855;padding-bottom:18px}.logo{width:86px;height:86px;object-fit:contain;background:#fff;border-radius:20px;padding:6px}.card-head strong{display:block;color:#f0c43c;font-size:22px}.card-head small{color:#eadba9}.state{font-weight:900;border:1px solid currentColor;border-radius:999px;padding:8px 12px}.hero{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;padding:24px 0}.hero>div>span{color:#f0c43c;font-weight:800}.hero h1{font-size:34px;margin:8px 0}.number{font-size:30px;color:#f0c43c;font-weight:1000;direction:ltr;text-align:right}.qr{width:205px;background:#fff;padding:10px;border-radius:20px}.qr svg{display:block;width:100%;height:auto}.details{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.details div{background:#03173bcc;border-radius:16px;padding:14px;border:1px solid #ffffff16}.details span{display:block;color:#cad5ea;font-size:14px;margin-bottom:5px}.verify{margin-top:18px;padding-top:14px;border-top:1px solid #d5a92844;color:#d8e0ef}.actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;max-width:780px;margin:16px auto}.actions button,.actions a{cursor:pointer}.alert{padding:13px;border-radius:13px;background:#ffffff15}.alert.bad{border:1px solid #ff9999}footer{text-align:center;padding:24px;color:#e4d5a7}@media(max-width:680px){.stats{grid-template-columns:1fr}.member-row{align-items:flex-start;flex-direction:column}.card-head{grid-template-columns:auto 1fr}.state{grid-column:1/-1;justify-self:start}.hero{grid-template-columns:1fr;text-align:center}.number{text-align:center}.qr{margin:auto}.details{grid-template-columns:1fr 1fr}.logo{width:72px;height:72px}.hero h1{font-size:28px}}@media(max-width:430px){.details{grid-template-columns:1fr}.search{flex-direction:column}}@media print{body{background:#fff!important}.no-print{display:none!important}main{width:100%;margin:0}.official-card{box-shadow:none;margin:0 auto;max-width:100%;print-color-adjust:exact;-webkit-print-color-adjust:exact;break-inside:avoid}}`}
function H(x,s=200){return new Response(x,{status:s,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-wadnofei-ui':'v49-membership-distribution-ready'}})}
function red(x){return new Response(null,{status:303,headers:{location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(v){if(!v)return'—';try{return new Intl.DateTimeFormat('ar-SD',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Africa/Khartoum'}).format(new Date(v))}catch(_){return esc(v)}}
