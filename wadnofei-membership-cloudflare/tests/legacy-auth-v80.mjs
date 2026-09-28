import assert from 'node:assert/strict';
import app from '../worker-global-v80.js';

async function check(path,expected,method='GET'){
  const r=await app.fetch(new Request('https://members.shamsphone.net'+path,{method}),{}, {});
  assert.equal(r.status,303,path+' redirects');
  assert.equal(r.headers.get('location'),expected,path+' target');
  assert.equal(r.headers.get('cache-control'),'no-store',path+' no-store');
  assert.equal(r.headers.get('x-wadnofei-auth'),'v80-legacy-auth-closed',path+' marker');
}

await check('/login','/staff-login?next=%2Fclub-admin');
await check('/login?next=/club-admin/finance','/staff-login?next=%2Fclub-admin%2Ffinance');
await check('/login?next=https://evil.example','/staff-login?next=%2Fclub-admin');
await check('/login','/staff-login?next=%2Fclub-admin','POST');
await check('/forgot-account','/staff-recover');
await check('/forgot-account','/staff-recover','POST');
await check('/change-password','/staff-security');
await check('/logout','/staff-logout');

const current=await app.fetch(new Request('https://members.shamsphone.net/staff-login'),{}, {});
assert.equal(current.status,200,'new staff login remains available');
assert.match(await current.text(),/تفعيل أو استعادة الحساب/,'new recovery path remains visible');

console.log('V80 legacy auth closure passed.');
