import app from './worker-global-v47.js';
import QRCode from 'qrcode';

const CLUB='نادي ود نفيع الرياضي الثقافي الاجتماعي';
const LOGO='/assets/wdn-logo-v42.jpg?v=48';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    const cardMatch=p.match(/^\/member-card\/([A-Za-z0-9_-]+)$/);
    if(cardMatch&&m==='GET') return memberCard(env.DB,cardMatch[1]);
    const r=await app.fetch(req,env,ctx);
    if(r.headers.get('content-type')?.includes('text/html')){
      const h=new Headers(r.headers);h.set('x-wadnofei-ui','v48-official-membership-card');h.delete('content-length');
      return new Response(await r.text(),{status:r.status,statusText:r.statusText,headers:h});
    }
    return r;
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};

async function memberCard(db,token){
  if(!db)return H(page('بطاقة العضوية','<div class="note bad">قاعدة البيانات غير متاحة.</div>'),503);
  try{
    const m=await db.prepare('SELECT * FROM members WHERE qr_token=? LIMIT 1').bind(token).first();
    if(!m)return H(page('بطاقة العضوية','<div class="note bad">البطاقة غير موجودة أو غير صالحة.</div>'),404);
    const verify=`https://members.shamsphone.net/member-card/${encodeURIComponent(token)}`;
    const qrSvg=await QRCode.toString(verify,{type:'svg',margin:1,errorCorrectionLevel:'M',width:320});
    const exp=m.membership_expires_at?new Date(m.membership_expires_at):null;
    const valid=(m.status||'active')==='active'&&(!exp||exp>new Date());
    const name=m.full_name||m.name||'عضو نادي ود نفيع';
    const no=m.member_no||m.membership_no||'—';
    const body=`
      <section class="official-card" id="membershipCard">
        <div class="card-head">
          <img src="${LOGO}" class="club-logo" alt="شعار نادي ود نفيع">
          <div class="club-title"><strong>${CLUB}</strong><small>تأسس عام 1964</small></div>
          <span class="status ${valid?'active':'inactive'}">${valid?'سارية':'غير سارية'}</span>
        </div>
        <div class="member-main">
          <div class="identity">
            <span class="eyebrow">بطاقة عضوية رسمية</span>
            <h1>${e(name)}</h1>
            <div class="member-no">${e(no)}</div>
          </div>
          <div class="qr">${qrSvg}</div>
        </div>
        <div class="details">
          <div><span>نوع العضوية</span><b>${e(m.member_type||'عضو')}</b></div>
          <div><span>رقم الهاتف</span><b dir="ltr">${e(m.phone||'—')}</b></div>
          <div><span>تاريخ الاعتماد</span><b>${date(m.approved_at||m.created_at)}</b></div>
          <div><span>صالحة حتى</span><b>${exp?date(m.membership_expires_at):'غير محدد'}</b></div>
        </div>
        <div class="verify-line">هذا الرمز مخصص للتحقق الإلكتروني من صحة العضوية عبر الموقع الرسمي للنادي.</div>
      </section>
      <div class="actions no-print">
        <button type="button" onclick="window.print()">🖨️ طباعة البطاقة</button>
        <button type="button" onclick="shareCard()">📤 مشاركة البطاقة</button>
        <a href="/club-admin/cards">العودة للبطاقات</a>
      </div>
      <script>
        async function shareCard(){
          const data={title:'بطاقة عضوية نادي ود نفيع',text:${JSON.stringify('بطاقة العضوية: ')}+${JSON.stringify(no)},url:location.href};
          try{if(navigator.share){await navigator.share(data)}else{await navigator.clipboard.writeText(location.href);alert('تم نسخ رابط البطاقة')}}catch(e){}
        }
      </script>`;
    return H(page('بطاقة العضوية',body));
  }catch(err){return H(page('بطاقة العضوية',`<div class="note bad">تعذر فتح البطاقة: ${e(err?.message||err)}</div>`),500)}
}

function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061a43"><title>${e(t)} · ${CLUB}</title><style>${css()}</style></head><body><header class="no-print"><b>${CLUB}</b><a href="/club-admin/cards">البطاقات</a></header><main><h1 class="page-title no-print">${e(t)}</h1>${b}</main><footer class="no-print">نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function css(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}header{padding:16px 5%;display:flex;justify-content:space-between;border-bottom:1px solid #d5a92866}header b,.page-title{color:#d5a928}header a{color:#fff}main{width:min(980px,94%);margin:28px auto}.official-card{max-width:760px;margin:18px auto;background:linear-gradient(145deg,#082d70,#061a43);border:2px solid #d5a928;border-radius:30px;padding:24px;box-shadow:0 18px 60px #0005;overflow:hidden;position:relative}.official-card:before{content:'';position:absolute;inset:auto -90px -120px auto;width:300px;height:300px;border:36px solid #d5a92812;border-radius:50%}.card-head{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;padding-bottom:18px;border-bottom:1px solid #d5a92855}.club-logo{width:86px;height:86px;object-fit:contain;background:#fff;border-radius:20px;padding:6px}.club-title{display:grid;gap:4px}.club-title strong{color:#f0c43c;font-size:22px}.club-title small{color:#e8d7a2}.status{padding:8px 12px;border-radius:999px;font-weight:900}.status.active{background:#153f2d;color:#78e49e;border:1px solid #78e49e66}.status.inactive{background:#4b2020;color:#ff9d9d;border:1px solid #ff9d9d66}.member-main{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;padding:24px 0}.eyebrow{display:inline-block;color:#f0c43c;font-weight:800;margin-bottom:8px}.identity h1{margin:0 0 10px;font-size:34px;color:#fff}.member-no{font-size:30px;font-weight:1000;color:#f0c43c;letter-spacing:1.5px;direction:ltr;text-align:right}.qr{width:210px;background:#fff;padding:10px;border-radius:20px}.qr svg{display:block;width:100%;height:auto}.details{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.details div{background:#03173bcc;border:1px solid #ffffff18;border-radius:16px;padding:14px}.details span{display:block;color:#cbd5ea;font-size:14px;margin-bottom:6px}.details b{font-size:18px}.verify-line{margin-top:18px;padding-top:14px;border-top:1px solid #d5a92844;color:#d7dfef;font-size:14px}.actions{max-width:760px;margin:16px auto;display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.actions button,.actions a{border:0;border-radius:13px;background:#d5a928;color:#061a43;padding:12px 16px;font-weight:900;text-decoration:none;cursor:pointer}.actions a{background:#fff}.note{padding:12px;border-radius:12px;background:#ffffff16}.note.bad{border:1px solid #ff8d8d}footer{text-align:center;padding:24px;color:#e4d5a7}@media(max-width:640px){.official-card{padding:18px;border-radius:24px}.card-head{grid-template-columns:auto 1fr}.status{grid-column:1/-1;justify-self:start}.club-logo{width:70px;height:70px}.club-title strong{font-size:18px}.member-main{grid-template-columns:1fr;text-align:center}.member-no{text-align:center}.qr{margin:auto;width:200px}.details{grid-template-columns:1fr 1fr}.identity h1{font-size:28px}.page-title{font-size:30px}}@media(max-width:420px){.details{grid-template-columns:1fr}}@media print{body{background:#fff!important}.no-print{display:none!important}main{width:100%;margin:0}.official-card{box-shadow:none;margin:0 auto;color:#fff;max-width:100%;break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}}`}
function H(x,s=200){return new Response(x,{status:s,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(v){if(!v)return'—';try{return new Intl.DateTimeFormat('ar-SD',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Africa/Khartoum'}).format(new Date(v))}catch(_){return e(v)}}
