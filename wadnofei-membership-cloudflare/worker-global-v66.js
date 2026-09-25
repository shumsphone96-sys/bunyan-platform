import app from './worker-global-v65.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';
const DEFAULT_TITLE='النظام الأساسي لنادي ود نفيع الرياضي الثقافي الاجتماعي';
const DEFAULT_DESC='النظام الأساسي مجاز من الاتحاد المحلي لكرة القدم بالمناقل، وفي انتظار إجازة الجمعية العمومية.';
const DEFAULT_VERSION='2026.1';
const SEED_KEY_ENV='CONSTITUTION_SEED_KEY';
const MAX_PDF=20*1024*1024;
const CHUNK=128*1024;

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB) await ensure(env.DB);

    // One-time production seed. It permanently locks itself after first successful import.
    if(p==='/__wdn_constitution_seed_2026'&&m==='POST'&&env.DB){
      const s=await getSettings(env.DB);
      if(Number(s.seed_locked||0)===1 || Number(s.file_rev||0)>0) return new Response('Not found',{status:404});
      if(!env[SEED_KEY_ENV]||req.headers.get('x-seed-key')!==env[SEED_KEY_ENV]) return new Response('Forbidden',{status:403});
      const bytes=new Uint8Array(await req.arrayBuffer());
      if(!isPdf(bytes)||bytes.byteLength>MAX_PDF) return new Response('Invalid PDF',{status:400});
      await storePdf(env.DB,bytes,'constitution-2026.pdf',true);
      return json({ok:true,size:bytes.byteLength});
    }

    if(p==='/constitution'&&m==='GET'&&env.DB) return constitutionPage(env.DB);
    if(p==='/constitution/file'&&m==='GET'&&env.DB) return constitutionFile(env.DB,false);
    if(p==='/constitution/download'&&m==='GET'&&env.DB) return constitutionFile(env.DB,true);

    if(p.startsWith('/club-admin/constitution')&&env.DB){
      const admin=await adminSession(req,env.DB);
      if(!admin) return red('/staff-login?next=/club-admin/constitution');
      if(!canManageConstitution(admin)) return new Response('Forbidden',{status:403});
      if(p==='/club-admin/constitution'&&m==='GET') return constitutionAdmin(env.DB,admin);
      if(p==='/club-admin/constitution/settings'&&m==='POST'){
        if(!sameOrigin(req)) return new Response('Forbidden',{status:403});
        return saveSettings(req,env.DB,admin);
      }
      if(p==='/club-admin/constitution/upload'&&m==='POST'){
        if(!sameOrigin(req)) return new Response('Forbidden',{status:403});
        return uploadPdf(req,env.DB,admin);
      }
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';

    if(m==='GET'&&p==='/sitemap.xml'&&ct.includes('xml')){
      let xml=await r.text();
      if(!xml.includes('/constitution')) xml=xml.replace('</urlset>',`<url><loc>https://members.shamsphone.net/constitution</loc></url></urlset>`);
      const h=new Headers(r.headers);h.delete('content-length');
      return new Response(xml,{status:r.status,headers:h});
    }

    if(m==='GET'&&ct.includes('text/html')){
      let html=await r.text();
      const publicPaths=['/','/about','/activities','/contact','/news','/team','/board','/achievements','/projects','/events','/sponsors','/gallery','/history','/identity'];
      if(publicPaths.includes(p)&&!html.includes('href="/constitution"')){
        html=html.replace('</nav>','<a href="/constitution">📘 النظام الأساسي</a></nav>');
      }
      if(p==='/'){
        const s=await getSettings(env.DB);
        if(Number(s.published||0)===1){
          const block=`<section style="width:min(1100px,94%);margin:36px auto;background:linear-gradient(135deg,#061a43,#0a347c);color:#fff;border:2px solid #e0b326;border-radius:24px;padding:24px;display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center"><img src="${LOGO}" alt="شعار نادي ود نفيع" style="width:78px;height:78px;object-fit:contain;background:#fff;border-radius:18px;padding:6px"><div><span style="color:#f1c43d;font-weight:900">📘 وثيقة النادي</span><h2 style="margin:.25em 0;color:#f1c43d">النظام الأساسي</h2><p style="margin:0;opacity:.9">${esc(statusLabel(s))}</p></div><a href="/constitution" style="background:#f1c43d;color:#061a43;text-decoration:none;font-weight:900;padding:12px 18px;border-radius:14px;text-align:center">قراءة الكتاب</a></section>`;
          html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;
        }
      }
      if(p==='/club-admin'&&!html.includes('/club-admin/constitution')){
        const block='<section style="margin:18px 0;padding:16px;border:1px solid #d5a92888;border-radius:18px;background:#08265dcc"><h2 style="color:#d5a928;margin-top:0">📘 النظام الأساسي</h2><p>إدارة كتاب النظام الأساسي، النسخة، الحالة، النشر والتحميل.</p><a href="/club-admin/constitution" style="display:block;text-align:center;padding:12px;border-radius:12px;background:#d5a928;color:#061a43;text-decoration:none;font-weight:900">إدارة النظام الأساسي</a></section>';
        html=html.includes('</main>')?html.replace('</main>',block+'</main>'):html+block;
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('x-wadnofei-ui','v66-constitution');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  const qs=[
    `CREATE TABLE IF NOT EXISTS club_constitution(
      id INTEGER PRIMARY KEY CHECK(id=1),
      title TEXT NOT NULL,
      description TEXT,
      status_code TEXT NOT NULL DEFAULT 'review',
      approval_date TEXT,
      version_label TEXT NOT NULL DEFAULT '2026.1',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      download_enabled INTEGER NOT NULL DEFAULT 1,
      published INTEGER NOT NULL DEFAULT 0,
      file_rev INTEGER DEFAULT 0,
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      file_sha256 TEXT,
      seed_locked INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS club_constitution_chunks(
      file_rev INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      data_b64 TEXT NOT NULL,
      PRIMARY KEY(file_rev,seq)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_constitution_chunks_rev ON club_constitution_chunks(file_rev)`,
    `CREATE TABLE IF NOT EXISTS club_audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
  try{await db.prepare(`INSERT OR IGNORE INTO club_constitution(id,title,description,status_code,version_label,download_enabled,published) VALUES(1,?,?,?,?,1,0)`).bind(DEFAULT_TITLE,DEFAULT_DESC,'review',DEFAULT_VERSION).run()}catch(_){}
}

async function getSettings(db){
  try{return await db.prepare(`SELECT * FROM club_constitution WHERE id=1`).first()||defaults()}catch(_){return defaults()}
}
function defaults(){return {id:1,title:DEFAULT_TITLE,description:DEFAULT_DESC,status_code:'review',approval_date:'',version_label:DEFAULT_VERSION,updated_at:'',download_enabled:1,published:0,file_rev:0,file_name:'constitution-2026.pdf',file_size:0,file_sha256:'',seed_locked:0}}

async function storePdf(db,bytes,name,lockSeed=false){
  if(!isPdf(bytes)||bytes.byteLength>MAX_PDF) throw new Error('invalid_pdf');
  const old=await getSettings(db);
  const rev=Date.now();
  let seq=0;
  try{
    for(let i=0;i<bytes.length;i+=CHUNK){
      const part=bytes.subarray(i,Math.min(bytes.length,i+CHUNK));
      await db.prepare(`INSERT INTO club_constitution_chunks(file_rev,seq,data_b64) VALUES(?,?,?)`).bind(rev,seq++,toBase64(part)).run();
    }
    const hash=await sha256Hex(bytes);
    await db.prepare(`UPDATE club_constitution SET file_rev=?,file_name=?,file_size=?,file_sha256=?,updated_at=CURRENT_TIMESTAMP,seed_locked=CASE WHEN ?=1 THEN 1 ELSE seed_locked END WHERE id=1`).bind(rev,name||'constitution-2026.pdf',bytes.byteLength,hash,lockSeed?1:0).run();
    if(Number(old.file_rev||0)>0 && Number(old.file_rev)!==rev){
      try{await db.prepare(`DELETE FROM club_constitution_chunks WHERE file_rev=?`).bind(Number(old.file_rev)).run()}catch(_){}
    }
    return {rev,hash,size:bytes.byteLength};
  }catch(e){
    try{await db.prepare(`DELETE FROM club_constitution_chunks WHERE file_rev=?`).bind(rev).run()}catch(_){}
    throw e;
  }
}

async function loadPdf(db,rev){
  if(!Number(rev)) return null;
  const rows=(await db.prepare(`SELECT data_b64 FROM club_constitution_chunks WHERE file_rev=? ORDER BY seq ASC`).bind(Number(rev)).all()).results||[];
  if(!rows.length)return null;
  const parts=rows.map(x=>fromBase64(x.data_b64));
  const total=parts.reduce((n,x)=>n+x.length,0),out=new Uint8Array(total);let off=0;
  for(const p of parts){out.set(p,off);off+=p.length}
  return out;
}

async function constitutionFile(db,download){
  const s=await getSettings(db);
  if(Number(s.published||0)!==1)return new Response('Not found',{status:404});
  if(download&&Number(s.download_enabled||0)!==1)return new Response('التحميل غير متاح حاليًا',{status:403,headers:{'content-type':'text/plain; charset=utf-8'}});
  const bytes=await loadPdf(db,s.file_rev);
  if(!bytes)return new Response('ملف النظام الأساسي غير متاح بعد.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  const fn=safeFileName(s.file_name||'constitution-2026.pdf');
  const disp=download?`attachment; filename="${fn}"`:`inline; filename="${fn}"`;
  return new Response(bytes,{headers:{'content-type':'application/pdf','content-disposition':disp,'cache-control':'private, max-age=300','x-content-type-options':'nosniff'}});
}

async function constitutionPage(db){
  const s=await getSettings(db);
  if(Number(s.published||0)!==1)return new Response('Not found',{status:404});
  const hasFile=Number(s.file_rev||0)>0;
  const dl=Number(s.download_enabled||0)===1&&hasFile;
  const status=statusLabel(s);
  const updated=formatDate(s.updated_at);
  const approval=s.status_code==='approved'&&s.approval_date?`<span>تاريخ الاعتماد: ${esc(s.approval_date)}</span>`:'';
  const reader=hasFile?`<section id="reader" class="reader"><div class="readerTop"><b>قارئ النظام الأساسي</b><div><button type="button" onclick="zoomFrame(-1)">−</button><button type="button" onclick="zoomFrame(1)">+</button></div></div><div id="pdfBox" class="pdfBox"><iframe id="pdfFrame" title="النظام الأساسي لنادي ود نفيع" src="/constitution/file#toolbar=1&navpanes=0&view=FitH" loading="eager"></iframe></div><p class="readerHint">يمكنك استخدام أدوات قارئ PDF للتنقل بين الصفحات والتكبير والتصغير. على الهاتف استخدم زر ملء الشاشة لقراءة أوضح.</p></section>`:`<section class="empty">ملف PDF قيد التجهيز للنشر.</section>`;
  const body=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#061a43"><meta name="description" content="${escAttr(s.description||DEFAULT_DESC)}"><title>${esc(s.title)} · ${CLUB}</title><style>${constitutionCss()}</style></head><body><header><a href="/" class="brand"><img src="${LOGO}" alt="شعار نادي ود نفيع"><div><b>نادي ود نفيع</b><span>الرياضي الثقافي الاجتماعي</span></div></a><a href="/" class="back">الرئيسية</a></header><main><section class="bookHero"><img src="${LOGO}" alt="شعار نادي ود نفيع"><div><span class="tag">📘 وثيقة النادي</span><h1>${esc(s.title)}</h1><p>${esc(s.description||DEFAULT_DESC)}</p><div class="state">${esc(status)}</div><div class="meta"><span>الإصدار: ${esc(s.version_label||DEFAULT_VERSION)}</span><span>آخر تحديث: ${esc(updated||'2026م')}</span>${approval}</div><div class="actions">${hasFile?'<a class="primary" href="#reader">قراءة النظام الأساسي</a>':''}${hasFile?'<button type="button" class="secondary" onclick="fullReader()">فتح بملء الشاشة</button>':''}${dl?'<a class="secondary" href="/constitution/download">تحميل PDF</a>':''}</div></div></section>${reader}</main><footer>${CLUB}</footer><script>let z=1;function fullReader(){const e=document.getElementById('pdfBox');if(!e)return;if(e.requestFullscreen)e.requestFullscreen();else window.open('/constitution/file','_blank')}function zoomFrame(d){z=Math.max(.7,Math.min(1.8,z+d*.15));const f=document.getElementById('pdfFrame');if(f){f.style.width=(100/z)+'%';f.style.height=(100/z)+'%';f.style.transform='scale('+z+')';f.style.transformOrigin='top right'}}</script></body></html>`;
  return new Response(body,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','x-wadnofei-ui':'v66-constitution'}});
}

async function constitutionAdmin(db,admin){
  const s=await getSettings(db),hasFile=Number(s.file_rev||0)>0;
  const body=`<section class="notice"><b>الحالة الحالية:</b> ${esc(statusLabel(s))}<br><small>${hasFile?`PDF موجود · ${(Number(s.file_size||0)/1024/1024).toFixed(2)} MB`:'لم يتم رفع PDF بعد'}</small></section><section class="panel"><h2>بيانات النظام الأساسي</h2><form method="post" action="/club-admin/constitution/settings"><label>العنوان<input name="title" value="${escAttr(s.title||DEFAULT_TITLE)}" required></label><label>الوصف<textarea name="description">${esc(s.description||'')}</textarea></label><label>الحالة<select name="status_code"><option value="draft" ${s.status_code==='draft'?'selected':''}>مسودة</option><option value="review" ${s.status_code==='review'?'selected':''}>للمراجعة والإجازة</option><option value="approved" ${s.status_code==='approved'?'selected':''}>معتمد</option></select></label><label>رقم/إصدار النسخة<input name="version_label" value="${escAttr(s.version_label||DEFAULT_VERSION)}"></label><label>تاريخ الاعتماد<input type="date" name="approval_date" value="${escAttr(s.approval_date||'')}"></label><label class="check"><input type="checkbox" name="download_enabled" value="1" ${Number(s.download_enabled||0)===1?'checked':''}> إظهار زر تحميل PDF</label><label class="check"><input type="checkbox" name="published" value="1" ${Number(s.published||0)===1?'checked':''}> نشر الكتاب في الموقع العام</label><button>حفظ الإعدادات</button></form></section><section class="panel"><h2>نسخة PDF</h2><p>الملف الحالي: <b>${esc(s.file_name||'—')}</b></p><form method="post" action="/club-admin/constitution/upload" enctype="multipart/form-data"><label>رفع/استبدال PDF<input type="file" name="pdf" accept="application/pdf,.pdf" required></label><button>رفع النسخة الجديدة</button></form><small>الحد الأقصى 20MB. الاستبدال آمن: تظل النسخة السابقة حتى يكتمل رفع الجديدة.</small></section><section class="panel"><h2>معاينة</h2><div class="actions"><a href="/constitution" target="_blank">فتح صفحة الكتاب</a>${hasFile?'<a href="/constitution/file" target="_blank">فتح PDF</a>':''}${Number(s.download_enabled||0)===1&&hasFile?'<a href="/constitution/download">اختبار التحميل</a>':''}</div><p>SHA-256: <code>${esc(s.file_sha256||'—')}</code></p><p>آخر تحديث: ${esc(formatDate(s.updated_at)||'—')}</p></section>`;
  return adminPage('النظام الأساسي',body);
}

async function saveSettings(req,db,admin){
  const f=await req.formData();
  const title=String(f.get('title')||DEFAULT_TITLE).trim().slice(0,220)||DEFAULT_TITLE;
  const desc=String(f.get('description')||'').trim().slice(0,1500);
  const status=['draft','review','approved'].includes(String(f.get('status_code')))?String(f.get('status_code')):'review';
  const version=String(f.get('version_label')||DEFAULT_VERSION).trim().slice(0,80)||DEFAULT_VERSION;
  const approval=status==='approved'?String(f.get('approval_date')||'').trim().slice(0,20):'';
  const dl=f.get('download_enabled')==='1'?1:0,pub=f.get('published')==='1'?1:0;
  await db.prepare(`UPDATE club_constitution SET title=?,description=?,status_code=?,version_label=?,approval_date=?,download_enabled=?,published=?,updated_at=CURRENT_TIMESTAMP WHERE id=1`).bind(title,desc,status,version,approval,dl,pub).run();
  await audit(db,admin,'update','constitution','1',`status=${status}; version=${version}; published=${pub}; download=${dl}`);
  return red('/club-admin/constitution?ok=settings');
}

async function uploadPdf(req,db,admin){
  const f=await req.formData(),file=f.get('pdf');
  if(!file||typeof file.arrayBuffer!=='function')return red('/club-admin/constitution?error=file');
  if(file.size>MAX_PDF)return red('/club-admin/constitution?error=size');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!isPdf(bytes))return red('/club-admin/constitution?error=pdf');
  const r=await storePdf(db,bytes,file.name||'constitution-2026.pdf',false);
  await audit(db,admin,'replace_pdf','constitution','1',`${file.name||'constitution-2026.pdf'}; ${r.size} bytes; sha256=${r.hash}`);
  return red('/club-admin/constitution?ok=pdf');
}

async function adminSession(req,db){
  const c=req.headers.get('cookie')||'';
  const sid=pickCookie(c,'club_sid')||pickCookie(c,'staff_sid')||pickCookie(c,'sid')||pickCookie(c,'session');
  if(!sid)return null;
  const tries=[
    [`SELECT u.id,u.username,COALESCE(u.role,'staff') role FROM club_staff_sessions s JOIN club_staff_users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`,sid],
    [`SELECT u.id,u.username,COALESCE(u.role,'staff') role FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`,sid],
    [`SELECT a.id,a.username,'admin' role FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires_at>datetime('now')`,sid],
    [`SELECT u.id,u.username,COALESCE(u.role,'admin') role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')`,sid]
  ];
  for(const [q,t] of tries){try{const x=await db.prepare(q).bind(t).first();if(x)return x}catch(_){}}
  return null;
}

function canManageConstitution(a){const r=String(a?.role||'').toLowerCase();return ['president','secretary','admin','owner','superadmin'].includes(r)}
async function audit(db,a,action,type,id,details=''){try{await db.prepare(`INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)`).bind(a?.username||'admin',action,type,String(id||''),details).run()}catch(_){}}
function sameOrigin(req){const o=req.headers.get('origin');if(!o)return true;try{return o===new URL(req.url).origin}catch(_){return false}}
function pickCookie(c,n){const m=c.match(new RegExp('(?:^|;\\s*)'+n+'=([^;]+)'));return m?decodeURIComponent(m[1]):''}
function statusLabel(s){if(s.status_code==='approved')return s.approval_date?`معتمد – ${s.approval_date}`:'معتمد';if(s.status_code==='draft')return 'مسودة';return 'مجاز من الاتحاد المحلي لكرة القدم بالمناقل – في انتظار إجازة الجمعية العمومية'}
function formatDate(v){if(!v)return '';const s=String(v).replace('T',' ').replace('Z','');return s.slice(0,16)}
function isPdf(b){return b&&b.length>=5&&String.fromCharCode(...b.subarray(0,5))==='%PDF-'}
function toBase64(bytes){let s='';const step=0x8000;for(let i=0;i<bytes.length;i+=step)s+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+step)));return btoa(s)}
function fromBase64(s){const b=atob(String(s||'')),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
async function sha256Hex(bytes){const h=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return [...h].map(x=>x.toString(16).padStart(2,'0')).join('')}
function safeFileName(s){return String(s||'constitution-2026.pdf').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120)||'constitution-2026.pdf'}
function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function red(x){return new Response(null,{status:303,headers:{location:x,'cache-control':'no-store'}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escAttr(v){return esc(v)}

function constitutionCss(){return `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;line-height:1.75}header{position:sticky;top:0;z-index:20;background:#061a43;color:#fff;padding:10px max(3%,16px);display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #e0b326}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff}.brand img{width:54px;height:54px;object-fit:contain;background:#fff;border-radius:13px;padding:4px}.brand b{display:block;color:#f1c43d}.brand span{font-size:12px;opacity:.82}.back{color:#061a43;background:#f1c43d;text-decoration:none;padding:8px 12px;border-radius:11px;font-weight:900}main{width:min(1180px,94%);margin:26px auto}.bookHero{display:grid;grid-template-columns:150px 1fr;gap:24px;background:linear-gradient(145deg,#061a43,#0a347c);color:#fff;border:2px solid #e0b326;border-radius:28px;padding:28px;box-shadow:0 18px 55px #061a4325}.bookHero>img{width:140px;height:140px;object-fit:contain;background:#fff;border-radius:24px;padding:10px}.tag{color:#f1c43d;font-weight:900}.bookHero h1{color:#f1c43d;line-height:1.35;margin:.25em 0;font-size:clamp(26px,4vw,48px)}.bookHero p{max-width:850px}.state{display:inline-block;margin:8px 0;padding:8px 12px;border:1px solid #f1c43d;border-radius:999px;color:#f1c43d;font-weight:900}.meta{display:flex;gap:9px;flex-wrap:wrap;margin:10px 0}.meta span{background:#ffffff12;border:1px solid #ffffff22;padding:6px 10px;border-radius:10px}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.actions a,.actions button{border:0;text-decoration:none;padding:11px 15px;border-radius:12px;font-weight:900;cursor:pointer;font:inherit}.primary{background:#f1c43d;color:#061a43}.secondary{background:#fff;color:#061a43}.reader{margin:24px 0;background:#061a43;border:2px solid #e0b326;border-radius:24px;padding:14px}.readerTop{color:#f1c43d;display:flex;align-items:center;justify-content:space-between;padding:4px 4px 12px}.readerTop button{background:#f1c43d;color:#061a43;border:0;border-radius:9px;width:38px;height:34px;font-size:20px;font-weight:900;margin-inline-start:5px}.pdfBox{height:78vh;min-height:600px;background:#fff;border-radius:14px;overflow:hidden;position:relative}.pdfBox:fullscreen{height:100vh;border-radius:0}.pdfBox iframe{border:0;width:100%;height:100%;display:block}.readerHint{color:#fff;opacity:.8;font-size:13px;margin:.7em .2em 0}.empty{padding:30px;text-align:center;background:#fff;border:1px solid #e0b326;border-radius:18px}footer{background:#061a43;color:#f1c43d;text-align:center;padding:22px;margin-top:34px}@media(max-width:700px){header .brand span{display:none}.bookHero{grid-template-columns:1fr;padding:18px;text-align:center}.bookHero>img{width:100px;height:100px;margin:auto}.meta,.actions{justify-content:center}.actions a,.actions button{width:100%}.pdfBox{height:72vh;min-height:520px}.reader{padding:8px;border-radius:18px}.readerTop{padding:6px}.bookHero h1{font-size:27px}}`}
function adminPage(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${esc(title)} · ${CLUB}</title><style>${adminCss()}</style></head><body><header><b>${CLUB}</b><a href="/club-admin">لوحة الإدارة</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-wadnofei-ui':'v66-constitution-admin'}})}
function adminCss(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;line-height:1.7}header{display:flex;justify-content:space-between;align-items:center;padding:15px 5%;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(900px,94%);margin:24px auto}.panel,.notice{background:#08265dee;border:1px solid #d5a92866;border-radius:18px;padding:18px;margin:14px 0}.notice{border-color:#d5a928;color:#fff}.panel form{display:grid;gap:12px}.panel label{display:grid;gap:5px;font-weight:800}.panel input,.panel textarea,.panel select{width:100%;padding:12px;border-radius:11px;border:1px solid #ffffff33;background:#fff;color:#10203d;font:inherit}.panel textarea{min-height:110px}.panel button,.actions a{background:#d5a928;color:#061a43;border:0;border-radius:11px;padding:12px;text-decoration:none;font-weight:900;font:inherit;cursor:pointer}.check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;justify-content:flex-start}.check input{width:auto}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions a{display:inline-block}code{word-break:break-all;color:#f1c43d}@media(max-width:650px){.actions a{width:100%;text-align:center}}`}
