import {verifyWebhook} from '../webhook-security.js';
import app from '../worker-global-v65.js';
import {getActor,protectedPath,authorize} from '../auth.js';
import {ensureCore} from '../core-schema.js';
import {approveMembership} from '../membership-lifecycle.js';
import {afterStageChange} from '../worker-global-v23.js';

function message(text,status) {
  return new Response(text,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
export default {
  async fetch(req,env,ctx) {
    const url=new URL(req.url), p=url.pathname.replace(/\/$/,'')||'/', m=req.method.toUpperCase();
    const write=!['GET','HEAD'].includes(m);
    const secured=protectedPath(p,m);
    try {
      if(p==='/webhooks/whatsapp' && m==='POST'){const denied=await verifyWebhook(req,env);if(denied)return denied;}
      if (secured) {
        if (!env.DB) return message('خدمة الإدارة غير متاحة مؤقتًا.',503);
        const actor=await getActor(req,env.DB);
        if (!actor) return new Response(null,{status:303,headers:{location:'/staff-login?next='+encodeURIComponent(p+url.search),'cache-control':'no-store'}});
        if (actor.must_change && !['/change-password','/logout'].includes(p)) return new Response(null,{status:303,headers:{location:'/change-password'}});
        if (actor.kind==='staff' && p==='/logout') return new Response(null,{status:303,headers:{location:'/staff-logout'}});
        if (!authorize(actor,p,m)) return message('ليس لديك صلاحية تنفيذ هذه العملية.',403);
        if (write && req.headers.get('origin')!==url.origin) return message('تعذر التحقق من مصدر الطلب. أعد فتح النموذج من الموقع.',403);
        const approval=p.match(/^\/(?:applications\/(\d+)\/(?:stage\/)?approve|club-admin\/applications\/(\d+)\/issue-card)$/);
        if (approval && m==='POST') {
          let note=''; try {note=String((await req.formData()).get('admin_note')||'').trim().slice(0,2000)} catch {}
          const id=Number(approval[1]||approval[2]);
          const result=await approveMembership(env.DB,id,actor,note);
          if(result.error) return message(result.error,result.status);
          if(result.changed) ctx.waitUntil(afterStageChange(env,id,'approve'));
          return new Response(null,{status:303,headers:{location:approval[2]?'/member-card/'+result.member.qr_token:'/applications','cache-control':'no-store'}});
        }
      }
      if (write && ['/login','/staff-login','/membership','/membership/join'].includes(p) && req.headers.get('origin')!==url.origin) return message('تعذر التحقق من مصدر النموذج.',403);
      if (env.DB && ['/login','/membership','/membership/join'].includes(p)) await ensureCore(env.DB);
      const response=await app.fetch(req,env,ctx);
      // Do not disclose SQL/internal exception details in HTML errors.
      if(response.status>=500) return message('تعذر إتمام الطلب حاليًا. لم يتم تأكيد العملية؛ يرجى المحاولة لاحقًا أو التواصل مع الإدارة.',response.status);
      const headers=new Headers(response.headers);
      headers.set('x-wadnofei-release','stability-20260921');
      if(secured || p.startsWith('/membership/') || p.startsWith('/member-card/') || p.startsWith('/verify/')) {
        headers.set('cache-control','no-store'); headers.set('referrer-policy','no-referrer');
      }
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    } catch(error) {
      console.error('WDN_REQUEST_FAILED',p,error?.name||'Error');
      return message('تعذر إتمام العملية بأمان. لم يتم تأكيد نجاحها؛ يرجى مراجعة الإدارة.',503);
    }
  },
  async scheduled(event,env,ctx) { if(app.scheduled) return app.scheduled(event,env,ctx); }
};
