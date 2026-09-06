import base from './worker-global-v3.js';
import { LOGO_B64 } from './logo.js';

function officialLogo(){
  const bin=atob(LOGO_B64);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return new Response(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=86400'}});
}

export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(url.pathname==='/logo.jpg') return officialLogo();
    return base.fetch(req,env,ctx);
  }
};
