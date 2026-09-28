import assert from 'node:assert/strict';
import app from '../worker-global-v81.js';

async function call(path,cookie,method='GET'){
  const headers={}; if(cookie)headers.cookie=cookie;
  return app.fetch(new Request('https://members.shamsphone.net'+path,{method,headers}),{}, {});
}

for(const [path,cookie] of [
  ['/','club_sid=%'],
  ['/staff-login','club_sid=%'],
  ['/club-admin/cards','club_sid=%'],
  ['/club-admin/cards','sid=%'],
  ['/club-admin/backup.json','club_sid=%; sid=%E0%A4%A']
]){
  const r=await call(path,cookie);
  assert.ok(r.status>=200&&r.status<500,path+' fails closed without server error');
  assert.equal(r.headers.get('x-wadnofei-auth-sanitize'),'v81',path+' marks sanitization');
  const set=r.headers.get('set-cookie')||'';
  assert.match(set,/(club_sid|sid)=;/,path+' clears malformed auth cookie');
}

const normal=await call('/staff-login','theme=dark');
assert.equal(normal.status,200,'unrelated valid cookie remains unaffected');
assert.equal(normal.headers.get('x-wadnofei-auth-sanitize'),null,'no sanitize marker for valid cookies');

console.log('V81 malformed auth-cookie guard passed.');
