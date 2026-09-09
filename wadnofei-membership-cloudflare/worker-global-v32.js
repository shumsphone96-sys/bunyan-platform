import app from './worker-global-v31.js';

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname.replace(/\/$/,'')||'/',m=req.method.toUpperCase();
    const response=await app.fetch(req,env,ctx);
    const ct=response.headers.get('content-type')||'';
    const isMembership=m==='GET'&&(p==='/membership'||p==='/membership/join'||p==='/join');

    if(isMembership&&ct.includes('text/html')){
      let html=await response.text();

      // Public registration should be self-contained: no WhatsApp action required from the member.
      html=html.replace(/<a\b[^>]*>\s*واتساب النادي\s*<\/a>/gi,'');
      html=html.replace(/<a\b[^>]*>\s*مراسلة النادي عبر واتساب\s*<\/a>/gi,'');
      html=html.replace(/<a\b[^>]*href=["'][^"']*wa\.me[^"']*["'][^>]*>\s*واتساب النادي\s*<\/a>/gi,'');

      // Remove the small low-resolution badge/logo inside the registration card only.
      html=html.replace(/<img\b(?=[^>]*(?:membership|member|logo|club|wdn))[^>]*style=["'][^"']*(?:width|height)[^"']*["'][^>]*>/gi,'');

      const polish=`<style id="wdn-v32-polish">
        html{scroll-behavior:smooth}body{overflow-x:hidden}
        input,select,textarea,button{font:inherit;max-width:100%}
        input:not([type=checkbox]):not([type=radio]),select,textarea{width:100%!important;border-radius:14px!important;box-sizing:border-box!important}
        input:not([type=checkbox]):not([type=radio]),select{min-height:56px!important;height:56px!important;padding:0 16px!important}
        input[type=date]{display:block!important;min-height:56px!important;height:56px!important;padding:0 14px!important;line-height:56px!important;-webkit-appearance:none!important;appearance:none!important}
        textarea{min-height:128px!important;padding:14px 16px!important;resize:vertical}
        label{display:block;line-height:1.6}
        form{max-width:100%}
        button[type=submit],form button.primary{min-height:54px;padding:12px 20px!important;border-radius:14px!important;font-weight:900!important}
        input[type=checkbox]{width:25px!important;height:25px!important;min-width:25px!important;vertical-align:middle;margin:0 0 0 10px!important;accent-color:#d5a928}
        @media(max-width:640px){
          main,.container,.wrap{width:min(94%,100%)!important;margin-left:auto!important;margin-right:auto!important}
          form{gap:16px!important}
          label{font-size:17px!important}
          input:not([type=checkbox]):not([type=radio]),select{font-size:16px!important}
          h1{line-height:1.35!important}
          .actions{grid-template-columns:1fr!important}
        }
      </style>`;
      html=html.includes('</head>')?html.replace('</head>',polish+'</head>'):polish+html;

      // Add a clear, non-technical promise instead of asking the applicant to contact WhatsApp first.
      const autoNote=`<div style="margin:14px 0;padding:12px 14px;border:1px solid #d5a92866;border-radius:14px;background:#061a4366;color:#fff;line-height:1.7;text-align:right"><b style="color:#ffd65b">إشعارات الطلب تلقائية</b><br><span>بعد إرسال الطلب، ستتابع الإدارة حالته وسيصل أي تحديث إلى رقم الهاتف المسجل دون أي خطوة إضافية منك.</span></div>`;
      if(!html.includes('إشعارات الطلب تلقائية')){
        html=html.replace(/(<form\b[^>]*[^>]*>)/i,`$1${autoNote}`);
      }

      const h=new Headers(response.headers);h.delete('content-length');h.set('cache-control','no-store, max-age=0');h.set('x-wadnofei-ui','v32-membership-polish');
      return new Response(html,{status:response.status,statusText:response.statusText,headers:h});
    }
    return response;
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
