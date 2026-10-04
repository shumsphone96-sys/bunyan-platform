import app from './worker-global-v77.js';
import {publicSite} from './public-site.js';
import {page} from './site-ui.js';
import {FORM_PATHS,polishForms} from './site-forms.js';
import {CONSTITUTION_DRAFT_HTML} from './constitution-public.js';
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
    'مشروع النظام الأساسي',
    'مشروع النظام الأساسي لنادي ود نفيع للاطلاع والمراجعة قبل إجازة الجمعية العمومية.',
    CONSTITUTION_DRAFT_HTML,
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
