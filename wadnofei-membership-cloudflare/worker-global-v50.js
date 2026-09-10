import app from './worker-global-v49.js';
import QRCode from 'qrcode';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const ORIGIN='https://members.shamsphone.net';
const LOGO='/assets/wdn-logo-v42.jpg?v=50';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();

    let x=p.match(/^\/member-card\/([A-Za-z0-9_-]+)$/);
    if(x&&m==='GET') return publicCard(env.DB,x[1]);

    x=p.match(/^\/verify\/([A-Za-z0-9_-]+)$/);
    if(x&&m==='GET') return verifyPage(env.DB,x[1]);

    if(p==='/club-admin/readiness'&&m==='GET'){
      const gate=await adminGate(req,env,ctx); if(gate)return gate;
      return readiness(env.DB);
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')){
      let html=await r.text();
      if(['/club-admin','/applications','/members','/club-admin/cards','/club-admin/membership','/club-admin/memberships'].includes(p)){
        const link='<a href="/club-admin/readiness" style="display:inline-block;margin:8px;padding:10px 14px;border-radius:12px;background:#fff;color:#061a43;border:1px solid #d5a928;font-weight:900;text-decoration:none">✅ فحص الجاهزية قبل الإعلان</a>';
        html=html.includes('</main>')?html.replace('</main>',link+'</main>'):html+link;
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v50-prelaunch-safe');
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
async function ensureSafe(db){
  if(!db)return;
  const mc=await cols(db,'members');
  for(const [n,t] of [['full_name','TEXT'],['member_no','TEXT'],['qr_token','TEXT'],['status','TEXT'],['membership_expires_at','TEXT']]) if(!mc.includes(n)){try{await db.prepare(`ALTER TABLE members ADD COLUMN ${n} ${t}`).run()}catch(_){}}
  const ac=await cols(db,'applications');
  for(const [n,t] of [['member_id','INTEGER'],['status','TEXT']]) if(!ac.includes(n)){try{await db.prepare(`ALTER TABLE applications ADD COLUMN ${n} ${t}`).run()}catch(_){}}
}

async function publicCard(db,token){
  if(!db)return H(page('بطاقة العضوية','<div class="alert bad">قاعدة البيانات غير متاحة.</div>',true),503,true);
  try{
    await ensureSafe(db);
    const m=await db.prepare('SELECT * FROM members WHERE qr_token=? LIMIT 1').bind(token).first();
    if(!m)return H(page('بطاقة العضوية','<div class="alert bad">البطاقة غير موجودة أو غير صالحة.</div>',true),404,true);
    const verify=`${ORIGIN}/verify/${encodeURIComponent(token)}`;
    const qr=await QRCode.toString(verify,{type:'svg',margin:1,errorCorrectionLevel:'M',width:300});
    const exp=m.membership_expires_at?new Date(m.membership_expires_at):null;
    const valid=(m.status||'active')==='active'&&(!exp||exp>new Date());
    const name=m.full_name||m.name||'عضو نادي ود نفيع';
    const no=m.member_no||m.membership_no||'—';
    const body=`<section class="official-card"><div class="card-head"><img src="${LOGO}" class="logo" alt="شعار نادي ود نفيع"><div><strong>${CLUB}</strong><small>تأسس عام 1964</small></div><span class="state ${valid?'ok':'bad'}">${valid?'عضوية سارية':'عضوية غير سارية'}</span></div><div class="hero"><div><span>بطاقة عضوية رسمية</span><h1>${esc(name)}</h1><div class="number">${esc(no)}</div></div><div class="qr">${qr}</div></div><div class="details"><div><span>نوع العضوية</span><b>${esc(m.member_type||'عضو')}</b></div><div><span>تاريخ الاعتماد</span><b>${date(m.approved_at||m.created_at)}</b></div><div><span>صالحة حتى</span><b>${exp?date(m.membership_expires_at):'غير محدد'}</b></div><div><span>التحقق</span><b>${valid?'معتمدة':'غير سارية'}</b></div></div><div class="verify">✓ امسح رمز QR للتحقق من صحة العضوية. لا يتم عرض رقم هاتف العضو للعامة.</div></section><div class="actions no-print"><button onclick="window.print()">🖨️ طباعة</button><button onclick="shareCard()">📤 مشاركة</button><a href="${verify}">🔎 تحقق</a></div><script>async function shareCard(){const d={title:'بطاقة عضوية نادي ود نفيع',text:${JSON.stringify('بطاقة العضوية: ')}+${JSON.stringify(no)},url:location.href};try{if(navigator.share)await navigator.share(d);else{await navigator.clipboard.writeText(location.href);alert('تم نسخ رابط البطاقة')}}catch(e){}}</script>`;
    return H(page('بطاقة العضوية',body,true),200,true);
  }catch(err){return H(page('بطاقة العضوية',`<div class="alert bad">تعذر فتح البطاقة: ${esc(err?.message||err)}</div>`,true),500,true)}
}

async function verifyPage(db,token){
  if(!db)return H(page('التحقق من العضوية','<div class="alert bad">قاعدة البيانات غير متاحة.</div>',true),503,true);
  try{
    await ensureSafe(db);
    const m=await db.prepare('SELECT * FROM members WHERE qr_token=? LIMIT 1').bind(token).first();
    if(!m)return H(page('التحقق من العضوية','<section class="verify-card badbox"><h2>غير معتمدة</h2><p>لم يتم العثور على عضوية مطابقة لهذا الرمز.</p></section>',true),404,true);
    const exp=m.membership_expires_at?new Date(m.membership_expires_at):null;
    const valid=(m.status||'active')==='active'&&(!exp||exp>new Date());
    const body=`<section class="verify-card"><img src="${LOGO}" class="verify-logo" alt="شعار النادي"><div class="verify-badge ${valid?'okbg':'badbg'}">${valid?'✓ عضوية صحيحة وسارية':'✕ العضوية غير سارية'}</div><h2>${esc(m.full_name||m.name||'')}</h2><div class="verify-no">${esc(m.member_no||m.membership_no||'—')}</div><p>نوع العضوية: <b>${esc(m.member_type||'عضو')}</b></p><p>صالحة حتى: <b>${exp?date(m.membership_expires_at):'غير محدد'}</b></p></section>`;
    return H(page('التحقق من العضوية',body,true),200,true);
  }catch(err){return H(page('التحقق من العضوية',`<div class="alert bad">تعذر التحقق: ${esc(err?.message||err)}</div>`,true),500,true)}
}

async function readiness(db){
  if(!db)return H(page('فحص الجاهزية','<div class="alert bad">قاعدة البيانات غير متاحة.</div>'),503);
  await ensureSafe(db);
  const checks=[];
  const mc=await cols(db,'members'),ac=await cols(db,'applications');
  checks.push(['جدول الأعضاء',mc.length>0]);
  checks.push(['رقم العضوية',mc.includes('member_no')||mc.includes('membership_no')]);
  checks.push(['رمز QR',mc.includes('qr_token')]);
  checks.push(['صلاحية العضوية',mc.includes('membership_expires_at')]);
  checks.push(['ربط الطلب بالعضو',ac.includes('member_id')]);
  let total=0,missingQr=0,missingNo=0,pending=0;
  try{total=Number((await db.prepare('SELECT COUNT(*) c FROM members').first())?.c||0)}catch(_){}
  try{missingQr=Number((await db.prepare("SELECT COUNT(*) c FROM members WHERE qr_token IS NULL OR trim(qr_token)='' ").first())?.c||0)}catch(_){}
  try{missingNo=Number((await db.prepare("SELECT COUNT(*) c FROM members WHERE member_no IS NULL OR trim(member_no)='' ").first())?.c||0)}catch(_){}
  try{pending=Number((await db.prepare("SELECT COUNT(*) c FROM applications WHERE COALESCE(member_id,0)=0").first())?.c||0)}catch(_){}
  checks.push(['كل الأعضاء لديهم QR',missingQr===0]);
  checks.push(['كل الأعضاء لديهم رقم عضوية',missingNo===0]);
  const passed=checks.filter(x=>x[1]).length;
  const body=`<div class="ready-score"><b>${passed}/${checks.length}</b><span>نتيجة الجاهزية</span></div><section class="checklist">${checks.map(([n,ok])=>`<div class="check ${ok?'pass':'fail'}"><b>${ok?'✓':'✕'}</b><span>${esc(n)}</span></div>`).join('')}</section><div class="stats"><div><b>${total}</b><span>أعضاء مسجلون</span></div><div><b>${pending}</b><span>طلبات تنتظر الاعتماد</span></div><div><b>${missingQr}</b><span>أعضاء بلا QR</span></div><div><b>${missingNo}</b><span>أعضاء بلا رقم</span></div></div><div class="launch ${passed===checks.length?'go':'hold'}">${passed===checks.length?'النظام جاهز تقنيًا للإعلان والتوزيع ✅':'توجد نقاط تحتاج معالجة قبل الإعلان الكامل'}</div><div class="actions"><a href="/membership">فتح صفحة التسجيل</a><a href="/club-admin/cards">إدارة البطاقات</a><a href="/club-admin/memberships">سجل العضوية</a></div>`;
  return H(page('فحص الجاهزية قبل الإعلان',body));
}

function page(t,b,noindex=false){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${noindex?'<meta name="robots" content="noindex,nofollow">':''}<meta name="theme-color" content="#061a43"><title>${esc(t)} · ${CLUB}</title><style>${css()}</style></head><body><header class="no-print"><b>${CLUB}</b><nav><a href="/membership">العضوية</a><a href="/club-admin">الإدارة</a></nav></header><main><h1 class="title no-print">${esc(t)}</h1>${b}</main><footer class="no-print">نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function css(){return `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial}header{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,.title{color:#d5a928}nav{display:flex;gap:12px}a{color:inherit}main{width:min(1050px,94%);margin:26px auto}.official-card,.verify-card,.checklist,.stats,.ready-score{max-width:780px;margin:16px auto}.official-card{background:linear-gradient(145deg,#082d70,#061a43);border:2px solid #d5a928;border-radius:30px;padding:24px;box-shadow:0 18px 60px #0005}.card-head{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;border-bottom:1px solid #d5a92855;padding-bottom:18px}.logo{width:86px;height:86px;object-fit:contain;background:#fff;border-radius:20px;padding:6px}.card-head strong{display:block;color:#f0c43c;font-size:22px}.card-head small{color:#eadba9}.state{font-weight:900;border:1px solid currentColor;border-radius:999px;padding:8px 12px}.ok{color:#72e6a0}.bad{color:#ff9999}.hero{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;padding:24px 0}.hero span{color:#f0c43c;font-weight:800}.hero h1{font-size:34px;margin:8px 0}.number,.verify-no{font-size:28px;font-weight:1000;color:#f0c43c;direction:ltr}.qr{width:210px;background:#fff;padding:10px;border-radius:20px}.qr svg{display:block;width:100%;height:auto}.details{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.details div{background:#03173bcc;border:1px solid #ffffff18;border-radius:16px;padding:14px}.details span{display:block;color:#cbd5ea;font-size:14px;margin-bottom:6px}.verify{margin-top:18px;padding-top:14px;border-top:1px solid #d5a92844;color:#d7dfef}.actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:16px auto;max-width:780px}.actions a,.actions button{border:0;border-radius:13px;background:#d5a928;color:#061a43;padding:12px 16px;font-weight:900;text-decoration:none}.verify-card{background:#08265dee;border:1px solid #d5a92888;border-radius:24px;padding:24px;text-align:center}.verify-logo{width:100px;height:100px;object-fit:contain;background:#fff;border-radius:20px;padding:6px}.verify-badge{display:inline-block;margin:16px 0;padding:9px 14px;border-radius:999px;font-weight:900}.okbg{background:#123e2b;color:#79e6a0}.badbg{background:#4a2020;color:#ff9d9d}.ready-score{text-align:center;background:#08265dee;border:1px solid #d5a92888;border-radius:22px;padding:20px}.ready-score b{display:block;color:#d5a928;font-size:40px}.ready-score span{opacity:.8}.checklist{display:grid;gap:10px}.check{display:flex;gap:12px;align-items:center;background:#08265dee;border-radius:14px;padding:13px 16px;border:1px solid #ffffff20}.check.pass b{color:#72e6a0}.check.fail b{color:#ff9999}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.stats div{background:#08265dee;border:1px solid #d5a92855;border-radius:16px;padding:14px;text-align:center}.stats b{display:block;color:#d5a928;font-size:26px}.stats span{font-size:13px;opacity:.8}.launch{max-width:780px;margin:18px auto;padding:16px;border-radius:16px;text-align:center;font-weight:900}.launch.go{background:#103c2d;color:#72e6a0}.launch.hold{background:#4a2020;color:#ffb0b0}.alert{max-width:780px;margin:16px auto;padding:14px;border-radius:14px;background:#ffffff16}.badbox{border-color:#ff9999!important}footer{text-align:center;padding:24px;color:#e4d5a7}@media(max-width:640px){.card-head{grid-template-columns:auto 1fr}.state{grid-column:1/-1;justify-self:start}.hero{grid-template-columns:1fr;text-align:center}.qr{margin:auto}.details,.stats{grid-template-columns:1fr 1fr}}@media(max-width:420px){.details,.stats{grid-template-columns:1fr}}@media print{body{background:#fff!important}.no-print{display:none!important}main{width:100%;margin:0}.official-card{box-shadow:none;margin:0 auto;max-width:100%;print-color-adjust:exact;-webkit-print-color-adjust:exact}}`}
function H(x,s=200,noindex=false){const h={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};if(noindex)h['x-robots-tag']='noindex, nofollow';return new Response(x,{status:s,headers:h})}
function red(x){return new Response(null,{status:303,headers:{location:x}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(v){if(!v)return'—';try{return new Intl.DateTimeFormat('ar-SD',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Africa/Khartoum'}).format(new Date(v))}catch(_){return esc(v)}}