import app from './worker-global-v77.js';
import {publicSite} from './public-site.js';
import {page} from './site-ui.js';
import {FORM_PATHS,polishForms} from './site-forms.js';
export default {
 async fetch(req,env,ctx){
  const path=new URL(req.url).pathname.replace(/\/$/,'')||'/';
  if(req.method==='GET'&&path==='/club')return new Response(null,{status:302,headers:{location:'/', 'cache-control':'no-store'}});
  const response=await publicSite(req,env);
  if(response)return response;
  let delegated=req;
  if(path==='/membership/track'){
   const target=new URL(req.url);target.pathname='/track-membership';
   delegated=new Request(target.toString(),req);
  }
  const base=await app.fetch(delegated,env,ctx);
  if(req.method==='GET'&&path==='/constitution'&&base.status===404){
   return page(
    'النظام الأساسي',
    'حالة النظام الأساسي لنادي ود نفيع.',
    '<section class="wdn-pagehead"><div class="wdn-breadcrumb"><a href="/">الرئيسية</a> / النظام الأساسي</div><h1>النظام الأساسي</h1><p>الوثيقة مجازة من الاتحاد المحلي لكرة القدم بالمناقل، وهي في انتظار إجازة الجمعية العمومية. النسخة الكاملة غير منشورة للعامة حالياً.</p></section><div class="wdn-wrap"><div class="wdn-card wdn-reading"><span class="wdn-label">حالة الوثيقة</span><h2>غير منشورة للعامة بعد</h2><p>عند اعتماد النشر من إدارة النادي ستظهر الوثيقة هنا تلقائياً، مع القراءة أو التحميل وفق الإعدادات المعتمدة.</p></div></div>',
    '/constitution'
   );
  }
  if(!base.headers.get('content-type')?.includes('text/html')||(!FORM_PATHS.has(path)&&path!=='/constitution'))return base;
  const html=polishForms(await base.text(),path);
  const headers=new Headers(base.headers);headers.delete('content-length');headers.set('x-wadnofei-ui','v78-organized-site');headers.set('cache-control','no-store');headers.set('x-content-type-options','nosniff');headers.set('x-frame-options','DENY');headers.set('referrer-policy','strict-origin-when-cross-origin');headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  return new Response(html,{status:base.status,statusText:base.statusText,headers});
 },
 async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
