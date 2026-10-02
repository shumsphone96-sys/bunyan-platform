import app from './worker-global-v79.js';

const LEGACY_REDIRECTS=new Map([
  ['/forgot-account','/staff-recover'],
  ['/change-password','/staff-security'],
  ['/logout','/staff-logout']
]);

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    const path=u.pathname.replace(/\/$/,'')||'/';
    if(path==='/login'){
      const next=safeNext(u.searchParams.get('next')||'/club-admin');
      return redirect('/staff-login?next='+encodeURIComponent(next));
    }
    const target=LEGACY_REDIRECTS.get(path);
    if(target)return redirect(target);
    return app.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};

function safeNext(value){
  const x=String(value||'');
  return x.startsWith('/')&&!x.startsWith('//')?x:'/club-admin';
}
function redirect(location){
  return new Response(null,{status:303,headers:{Location:location,'cache-control':'no-store','x-content-type-options':'nosniff','x-wadnofei-auth':'v80-legacy-auth-closed'}});
}
