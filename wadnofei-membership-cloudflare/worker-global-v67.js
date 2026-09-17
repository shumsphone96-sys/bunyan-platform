import app from './worker-global-v66.js';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const LOGO='/assets/wdn-logo-v42.jpg?v=49';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    if(env.DB) await ensure(env.DB);

    if(p==='/member-status'&&m==='GET'&&env.DB){
      const no=normalizeNo(u.searchParams.get('member_no')||'');
      return memberStatusPage(env.DB,no);
    }
    if(p==='/member-status'&&m==='POST'&&env.DB){
      const f=await req.formData();
      const no=normalizeNo(f.get('member_no')||'');
      return new Response(null,{status:303,headers:{Location:'/member-status?member_no='+encodeURIComponent(no)}});
    }

    const r=await app.fetch(req,env,ctx);
    const ct=r.headers.get('content-type')||'';
    if(m==='GET'&&ct.includes('text/html')&&['/','/membership'].includes(p)){
      let html=await r.text();
      if(!html.includes('href="/member-status"')){
        html=html.replace('</nav>','<a href="/member-status">متابعة العضوية</a></nav>');
        const box='<section style="width:min(1100px,94%);margin:28px auto;background:#fff;border:1px solid #dbe4f4;border-radius:22px;padding:20px;box-shadow:0 12px 34px #12325d10"><h2 style="margin-top:0;color:#061a43">متابعة إجراءات العضوية</h2><p>إذا صدر لك رقم عضوية، أدخله لمشاهدة وضع عضويتك ومراحل الإجراءات حتى الاعتماد.</p><form method="post" action="/member-status" style="display:flex;gap:10px;flex-wrap:wrap"><input name="member_no" required autocomplete="off" placeholder="رقم العضوية مثل WN-2026-0001" style="flex:1;min-width:220px;padding:13px;border:1px solid #cbd6e7;border-radius:12px;font-size:16px"><button style="border:0;border-radius:12px;background:#f1c43d;color:#061a43;padding:13px 18px;font-weight:900">بحث</button></form></section>';
        html=html.includes('</main>')?html.replace('</main>',box+'</main>'):html+box;
      }
      const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');h.set('x-wadnofei-ui','v67-member-journey');
      return new Response(html,{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function ensure(db){
  const qs=[
    `CREATE TABLE IF NOT EXISTS club_membership_journey(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      stage_code TEXT NOT NULL,
      stage_label TEXT NOT NULL,
      note TEXT,
      is_public INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_journey_member ON club_membership_journey(member_id,created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_member_no_v67 ON members(member_no)`
  ];
  for(const q of qs){try{await db.prepare(q).run()}catch(_){}}
}

async function memberStatusPage(db,no){
  let body='';
  if(!no){body=searchForm('');}
  else{
    const member=await findMember(db,no);
    if(!member){body=searchForm('لم نعثر على عضوية بهذا الرقم. تأكد من الرقم وحاول مرة أخرى.');}
    else{
      const appRow=await relatedApplication(db,member);
      const events=await journey(db,member,appRow);
      body=`<section class="card identity"><img src="${LOGO}" alt="شعار نادي ود نفيع"><div><span>رقم العضوية</span><h1 dir="ltr">${esc(member.member_no||no)}</h1><p>${esc(member.name||member.full_name||'عضو النادي')}</p></div></section>${timeline(events)}<section class="card note"><b>حالة العضوية الحالية</b><p>${esc(memberStatus(member))}</p><small>هذه الصفحة للمتابعة فقط. رقم العضوية أو الإيصال وحده لا يغيّر أي قرار إداري أو قانوني مسجل بالنظام.</small></section>${searchForm('',true)}`;
    }
  }
  return page('متابعة إجراءات العضوية',body);
}

async function findMember(db,no){
  try{return await db.prepare(`SELECT * FROM members WHERE upper(trim(member_no))=upper(trim(?)) LIMIT 1`).bind(no).first()}catch(_){return null}
}
async function relatedApplication(db,m){
  try{const x=await db.prepare(`SELECT * FROM applications WHERE member_id=? ORDER BY id DESC LIMIT 1`).bind(m.id).first();if(x)return x}catch(_){}
  try{if(m.phone)return await db.prepare(`SELECT * FROM applications WHERE phone=? ORDER BY id DESC LIMIT 1`).bind(m.phone).first()}catch(_){}
  return null;
}
async function journey(db,m,a){
  let rows=[];
  try{rows=(await db.prepare(`SELECT stage_code,stage_label,note,created_at FROM club_membership_journey WHERE member_id=? AND is_public=1 ORDER BY datetime(created_at),id`).bind(m.id).all()).results||[]}catch(_){}
  if(rows.length)return rows;
  const out=[];
  if(a){out.push({stage_code:'submitted',stage_label:'استلام طلب العضوية',note:'تم تسجيل الطلب في النظام.',created_at:a.created_at||''});
    const st=String(a.status||'').toLowerCase();
    if(['review','needs-info','ready','approved','rejected'].includes(st)||a.reviewed_at)out.push({stage_code:'review',stage_label:'مراجعة الطلب',note:a.review_note||'تمت مراجعة بيانات الطلب.',created_at:a.reviewed_at||a.created_at||''});
    if(st==='needs-info')out.push({stage_code:'needs-info',stage_label:'استكمال بيانات',note:a.review_note||'الطلب يحتاج استكمال بيانات قبل القرار.',created_at:a.reviewed_at||''});
    if(st==='rejected')out.push({stage_code:'rejected',stage_label:'قرار الطلب',note:'تم تسجيل قرار بعدم اعتماد الطلب. راجع إدارة النادي للتفاصيل الرسمية.',created_at:a.reviewed_at||''});
  }
  out.push({stage_code:'member-number',stage_label:'إصدار رقم العضوية',note:'تم إنشاء رقم عضوية دائم في السجل الإلكتروني.',created_at:m.created_at||m.approved_at||''});
  if(String(m.status||'active').toLowerCase()==='active'||m.approved_at)out.push({stage_code:'approved',stage_label:'اعتماد العضوية',note:'العضوية مسجلة ومعتمدة بالنظام.',created_at:m.approved_at||m.created_at||''});
  return out;
}
function timeline(rows){return `<section class="card"><div class="head"><span>مسار المعاملة</span><h2>الإجراءات حتى الاعتماد</h2></div><div class="timeline">${rows.map((x,i)=>`<article class="step"><i>${i+1}</i><div><b>${esc(x.stage_label)}</b><p>${esc(x.note||'')}</p>${x.created_at?`<small>${esc(formatDate(x.created_at))}</small>`:''}</div></article>`).join('')}</div></section>`}
function memberStatus(m){const s=String(m.status||'active').toLowerCase();if(s==='active')return 'عضوية نشطة ومعتمدة في السجل الإلكتروني.';if(s==='inactive')return 'العضوية موجودة بالسجل وحالتها غير نشطة حاليًا.';if(s==='suspended')return 'العضوية موجودة بالسجل وحالتها موقوفة حاليًا.';return 'الحالة المسجلة: '+String(m.status||'—')}
function searchForm(error='',compact=false){return `<section class="card search ${compact?'compact':''}"><h2>${compact?'بحث عن رقم آخر':'ابحث برقم عضويتك'}</h2><p>أدخل رقم العضوية كما هو مسجل، مثال: <span dir="ltr">WN-2026-0001</span></p>${error?`<div class="err">${esc(error)}</div>`:''}<form method="post" action="/member-status"><input name="member_no" required autocomplete="off" placeholder="رقم العضوية"><button>عرض الإجراءات</button></form></section>`}
function page(title,body){return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><meta name="robots" content="noindex,follow"><title>${esc(title)} · ${CLUB}</title><style>${css()}</style></head><body><header><a href="/"><img src="${LOGO}" alt="شعار النادي"><b>نادي ود نفيع</b></a><a href="/membership">العضوية</a></header><main>${body}</main><footer>${CLUB}</footer></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','referrer-policy':'same-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','x-wadnofei-ui':'v67-member-journey'}})}
function css(){return `*{box-sizing:border-box}body{margin:0;background:#f5f8ff;color:#10203d;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;line-height:1.7}header{background:#061a43;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:11px 5%;gap:14px}header a{color:#fff;text-decoration:none;display:flex;align-items:center;gap:9px}header img{width:48px;height:48px;object-fit:contain;background:#fff;border-radius:12px;padding:3px}header b,h1,h2{color:#061a43}header b{color:#f1c43d}main{width:min(820px,94%);margin:28px auto}.card{background:#fff;border:1px solid #dbe4f4;border-radius:22px;padding:22px;margin:16px 0;box-shadow:0 12px 34px #12325d10}.identity{background:linear-gradient(135deg,#061a43,#0a347c);color:#fff;display:flex;align-items:center;gap:18px}.identity img{width:82px;height:82px;object-fit:contain;background:#fff;border-radius:18px;padding:5px}.identity span{color:#f1c43d;font-weight:900}.identity h1{color:#f1c43d;margin:2px 0;font-size:clamp(25px,6vw,38px)}.identity p{margin:0}.head span{color:#a87e0b;font-weight:900}.head h2{margin:3px 0 16px}.timeline{position:relative}.step{display:grid;grid-template-columns:42px 1fr;gap:12px;padding:10px 0}.step i{width:36px;height:36px;border-radius:50%;background:#f1c43d;color:#061a43;display:grid;place-items:center;font-style:normal;font-weight:900}.step b{color:#061a43}.step p{margin:2px 0;color:#52647e}.step small{color:#74849a}.search form{display:flex;gap:10px;flex-wrap:wrap}.search input{flex:1;min-width:220px;padding:13px;border:1px solid #cbd6e7;border-radius:12px;font-size:16px;direction:ltr;text-align:left}.search button{border:0;border-radius:12px;background:#f1c43d;color:#061a43;padding:13px 18px;font-weight:900}.err{background:#fff0f0;color:#8d1d1d;border:1px solid #ffc7c7;border-radius:12px;padding:11px;margin:10px 0}.note small{display:block;color:#68798f}.compact{margin-top:24px}footer{text-align:center;padding:28px;color:#65758b}@media(max-width:520px){.identity{align-items:flex-start}.identity img{width:65px;height:65px}.card{padding:17px}.search form{display:grid}.search input{min-width:0;width:100%}}`}
function normalizeNo(v){return String(v??'').trim().replace(/\s+/g,'').slice(0,40)}
function formatDate(v){const s=String(v||'');return s?s.replace('T',' ').replace(/\.\d+Z?$/,'').slice(0,16):''}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
