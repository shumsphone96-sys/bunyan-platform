import app from './worker-global-v80.js';

const AUTH_COOKIES=new Set(['club_sid','sid']);

export default {
  async fetch(req,env,ctx){
    const cleaned=cleanAuthCookies(req.headers.get('cookie')||'');
    if(!cleaned.bad.length)return app.fetch(req,env,ctx);

    const headers=new Headers(req.headers);
    if(cleaned.value)headers.set('cookie',cleaned.value);
    else headers.delete('cookie');
    const safeReq=new Request(req,{headers});
    const res=await app.fetch(safeReq,env,ctx);
    const out=new Headers(res.headers);
    for(const name of cleaned.bad){
      out.append('Set-Cookie',name+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    }
    out.set('cache-control','no-store');
    out.set('x-wadnofei-auth-sanitize','v81');
    return new Response(res.body,{status:res.status,statusText:res.statusText,headers:out});
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};

function cleanAuthCookies(raw){
  const kept=[],bad=[];
  for(const part of String(raw||'').split(';')){
    const item=part.trim(); if(!item)continue;
    const eq=item.indexOf('=');
    const name=(eq<0?item:item.slice(0,eq)).trim();
    const value=eq<0?'':item.slice(eq+1);
    if(AUTH_COOKIES.has(name)){
      try{decodeURIComponent(value)}catch(_){bad.push(name);continue}
    }
    kept.push(item);
  }
  return {value:kept.join('; '),bad:[...new Set(bad)]};
}
