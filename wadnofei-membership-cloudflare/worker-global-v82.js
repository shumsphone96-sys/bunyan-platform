import {verifyWebhook} from './webhook-security.js';
import app from './worker-global-v81.js';
import {getActor,protectedPath,authorize} from './auth.js';
import {ensureCore} from './core-schema.js';
import {approveMembership} from './membership-lifecycle.js';
import {afterStageChange} from './worker-global-v23.js';

const LEGACY_AUTH=new Set(['/login','/forgot-account','/change-password','/logout']);

function message(text,status){
  return new Response(text,{status,headers:{
    'content-type':'text/plain; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  }});
}

export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    const p=url.pathname.replace(/\/$/,'')||'/';
    const m=req.method.toUpperCase();
    const write=!['GET','HEAD'].includes(m);

    if(LEGACY_AUTH.has(p)) return app.fetch(req,env,ctx);
    if(p==='/webhooks/whatsapp'&&m==='POST'){
      const denied=await verifyWebhook(req,env);
      if(denied)return denied;
    }
    const secured=protectedPath(p,m);
    try{
      if(secured){
        if(!env.DB)return message('خدمة الإدارة غير متاحة مؤقتًا.',503);
        const actor=await getActor(req,env.DB);
        if(!actor){
          return new Response(null,{status:303,headers:{
            location:'/staff-login?next='+encodeURIComponent(p+url.search),
            'cache-control':'no-store'
          }});
        }
        if(actor.must_change&&!['/change-password','/logout'].includes(p)){
          return new Response(null,{status:303,headers:{location:'/change-password'}});
        }
        if(actor.kind==='staff'&&p==='/logout'){
          return new Response(null,{status:303,headers:{location:'/staff-logout'}});
        }
        if(!authorize(actor,p,m))return message('ليس لديك صلاحية تنفيذ هذه العملية.',403);
        if(write&&req.headers.get('origin')!==url.origin){
          return message('تعذر التحقق من مصدر الطلب. أعد فتح النموذج من الموقع.',403);
        }

        const approval=p.match(/^\/(?:applications\/(\d+)\/(?:stage\/)?approve|club-admin\/applications\/(\d+)\/issue-card)$/);
        if(approval&&m==='POST'){
          let note='';
          try{note=String((await req.formData()).get('admin_note')||'').trim().slice(0,2000)}catch{}
          const id=Number(approval[1]||approval[2]);
          const result=await approveMembership(env.DB,id,actor,note);
          if(result.error)return message(result.error,result.status);
          if(result.changed)ctx.waitUntil(afterStageChange(env,id,'approve'));
          const location=approval[2]?'/member-card/'+result.member.qr_token:'/applications';
          return new Response(null,{status:303,headers:{location,'cache-control':'no-store'}});
        }
      }

      const publicForm=new Set([
        '/staff-login','/staff-recover','/membership','/membership/join',
        '/membership/payment','/membership/track','/track-membership'
      ]);
      if(write&&publicForm.has(p)&&req.headers.get('origin')!==url.origin){
        return message('تعذر التحقق من مصدر النموذج.',403);
      }

      if(env.DB&&env.RUNTIME_SCHEMA_BOOTSTRAP!=='off'&&['/membership','/membership/join'].includes(p)){
        await ensureCore(env.DB);
      }

      const response=await app.fetch(req,env,ctx);
      if(response.status>=500){
        return message('تعذر إتمام الطلب حاليًا. لم يتم تأكيد العملية؛ يرجى المحاولة لاحقًا أو التواصل مع الإدارة.',response.status);
      }

      const headers=new Headers(response.headers);
      headers.set('x-wadnofei-release','v82-stability');
      if(secured||p.startsWith('/membership/')||p.startsWith('/member-card/')||p.startsWith('/verify/')){
        headers.set('cache-control','no-store');
        headers.set('referrer-policy','no-referrer');
      }
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }catch(error){
      console.error('WDN_REQUEST_FAILED',p,error?.name||'Error');
      return message('تعذر إتمام العملية بأمان. لم يتم تأكيد نجاحها؛ يرجى مراجعة الإدارة.',503);
    }
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};
