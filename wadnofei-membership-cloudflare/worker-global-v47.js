import app from './worker-global-v46.js';
import QRCode from 'qrcode';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    const cardMatch=p.match(/^\/member-card\/([A-Za-z0-9_-]+)$/);
    if(cardMatch&&m==='GET') return memberCard(env.DB,cardMatch[1]);
    const r=await app.fetch(req,env,ctx);
    if(r.headers.get('content-type')?.includes('text/html')){
      const h=new Headers(r.headers);h.set('x-wadnofei-ui','v47-svg-qr');
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
    const body=`<section class="card"><h2>بطاقة عضوية رقمية</h2><h1>${e(m.full_name||m.name||'')}</h1><div class="no">${e(m.member_no||m.membership_no||'')}</div><div class="grid"><span>نوع العضوية<b>${e(m.member_type||'عضو')}</b></span><span>الحالة<b class="${valid?'ok':'bad'}">${valid?'سارية':'غير سارية'}</b></span><span>تاريخ الاعتماد<b>${date(m.approved_at||m.created_at)}</b></span><span>صالحة حتى<b>${exp?date(m.membership_expires_at):'غير محدد'}</b></span></div><div class="qr">${qrSvg}</div><p>امسح الرمز للتحقق من صحة العضوية.</p></section>`;
    return H(page('بطاقة العضوية',body));
  }catch(err){return H(page('بطاقة العضوية',`<div class="note bad">تعذر فتح البطاقة: ${e(err?.message||err)}</div>`),500)}
}

function page(t,b){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(t)} · نادي ود نفيع الرياضي الثقافي الاجتماعي</title><style>${css()}</style></head><body><header><b>نادي ود نفيع الرياضي الثقافي الاجتماعي</b><a href="/club-admin/cards">البطاقات</a></header><main><h1>${e(t)}</h1>${b}</main><footer>نادي ود نفيع · تأسس عام 1964</footer></body></html>`}
function css(){return `*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#061a43,#0a347c);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;min-height:100vh}header{padding:16px 5%;display:flex;justify-content:space-between;border-bottom:1px solid #d5a92866}header b,h1,h2{color:#d5a928}header a{color:#fff}main{width:min(900px,92%);margin:28px auto}.card{background:#08265dee;border:1px solid #d5a92888;border-radius:22px;padding:20px;margin:20px auto;text-align:center;max-width:520px}.no{font-size:25px;font-weight:1000;color:#d5a928;letter-spacing:1px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.grid span{background:#061a4388;padding:12px;border-radius:14px}.grid b{display:block;margin-top:5px}.ok{color:#72e6a0}.bad{color:#ff8d8d}.qr{width:220px;max-width:70%;margin:18px auto;background:#fff;padding:8px;border-radius:16px}.qr svg{display:block;width:100%;height:auto}.note{padding:12px;border-radius:12px;background:#ffffff16;margin:10px 0}.note.bad{border:1px solid #ff8d8d}footer{text-align:center;padding:24px;color:#e4d5a7}@media(max-width:600px){.grid{grid-template-columns:1fr}}`}
function H(x,s=200){return new Response(x,{status:s,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(v){if(!v)return'—';try{return new Intl.DateTimeFormat('ar-SD',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Africa/Khartoum'}).format(new Date(v))}catch(_){return e(v)}}
