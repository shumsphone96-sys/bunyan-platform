import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,ORIGIN} from './fixture.mjs';

for(const schema of [false,true])test(`registration > staff login > approval > card > verification (${schema?'checked-in schema':'empty database'})`,async t=>{
  const f=await fixture(t,{schema}),staff=f.staff();
  let r=await f.call('/membership',{method:'POST',body:f.join});assert.equal(r.res.status,201,r.text.slice(0,200));
  const ap=f.sql.prepare('SELECT * FROM applications').get();assert.match(ap.application_no,/^WDN-REQ-\d{5}$/);
  assert.equal((await f.call('/membership',{method:'POST',body:f.join})).res.status,200);
  assert.equal(f.sql.prepare('SELECT COUNT(*) c FROM applications').get().c,1);
  r=await f.call('/staff-login',{method:'POST',body:{username:staff.username,password:'FixtureOnly-2026',next:'/club-admin'}});
  assert.equal(r.res.status,303);const cookie=r.res.headers.get('set-cookie').split(';')[0];
  for(const route of ['/club-admin','/club-admin/content','/applications','/club-admin/finance','/club-admin/backup.json'])assert.equal((await f.call(route,{cookie})).res.status,200,route);
  for(const route of [`/applications/${ap.id}/stage/approve`,`/club-admin/applications/${ap.id}/issue-card`,`/applications/${ap.id}/approve`])assert.equal((await f.call(route,{method:'POST',body:{},cookie})).res.status,303,route);
  assert.equal(f.sql.prepare('SELECT COUNT(*) c FROM members').get().c,1);
  const member=f.sql.prepare('SELECT * FROM members').get();assert.equal(member.application_id,ap.id);assert.equal(f.sql.prepare('SELECT member_id FROM applications').get().member_id,member.id);
  assert.match(member.qr_token,/^[0-9a-f]{32}$/);
  r=await f.call('/member-card/'+member.qr_token);assert.equal(r.res.status,200);assert.ok(r.text.includes(member.member_no));assert.ok(!r.text.includes(f.join.phone));
  r=await f.call('/verify/'+member.qr_token);assert.equal(r.res.status,200);assert.ok(r.text.includes('صحيحة وسارية'));
  assert.equal(f.sql.prepare("SELECT COUNT(*) c FROM club_notifications WHERE event_type='membership_approved'").get().c,1);
  assert.equal(f.sql.prepare("SELECT COUNT(*) c FROM club_notifications WHERE status IN ('sent','delivered','read')").get().c,0);
});
for(const route of ['/club-admin/cards','/club-admin/notifications/history','/applications','/club-admin/backup.json'])for(const cookie of ['', 'sid=invalid','club_sid=%'])test(`deny unverified principal ${route} ${cookie}`,async t=>{
  const f=await fixture(t);const r=await f.call(route,{cookie});assert.equal(r.res.status,303);assert.ok(!r.text.includes('عضو اختبار'));
});
for(const role of ['president','secretary','vice_president','finance_manager'])test(`financial aliases preserve role separation: ${role}`,async t=>{
  const f=await fixture(t);const {cookie}=f.staff(role);
  for(const route of ['/payments','/club-admin/ledger','/club-admin/payments/987/status','/club-admin/members/987/renew']){
    const r=await f.call(route,{cookie,method:'POST',body:{}});
    if(role!=='finance_manager')assert.equal(r.res.status,403,route);
    else assert.notEqual(r.res.status,403,route);
  }
  const backup=await f.call('/club-admin/backup.json',{cookie});assert.equal(backup.res.status,['president','secretary'].includes(role)?200:403);
});
for(const origin of [null,'https://untrusted.invalid'])test(`authenticated writes reject absent or cross-site Origin: ${origin}`,async t=>{
  const f=await fixture(t),{cookie}=f.staff();const r=await f.call('/club-admin/content/news',{method:'POST',body:{title:'Not to be saved'},cookie,origin});assert.equal(r.res.status,403);
  assert.equal(f.sql.prepare('SELECT COUNT(*) c FROM club_news').get().c,0);
});
for(const args of [{active:0},{expires:'2026-01-01T00:00:00Z'}])test(`disabled/expired staff cannot issue cards ${JSON.stringify(args)}`,async t=>{
  const f=await fixture(t),{cookie}=f.staff('secretary',args);const r=await f.call('/club-admin/applications/1/issue-card',{method:'POST',body:{},cookie});assert.equal(r.res.status,303);assert.equal(f.sql.prepare('SELECT COUNT(*) c FROM members').get().c,0);
});
test('GET readiness preserves member numbers, QR, and empty status',async t=>{
  const f=await fixture(t),{cookie}=f.staff();f.sql.prepare('INSERT INTO members(full_name,status) VALUES(?,?)').run('Fixture only','');
  const before=f.sql.prepare('SELECT * FROM members').get();assert.equal((await f.call('/club-admin/readiness',{cookie})).res.status,200);
  const after=f.sql.prepare('SELECT * FROM members').get();for(const key of Object.keys(before))assert.equal(after[key],before[key],key);
});
test('new database never creates a known fallback administrator',async t=>{
  const f=await fixture(t);await f.call('/login');assert.equal(f.sql.prepare('SELECT COUNT(*) c FROM admins').get().c,0);
});
test('invalid registration or missing consent never stores an application',async t=>{
  const f=await fixture(t);for(const override of [{consent:''},{phone:'bad'},{full_name:'ab'}])assert.equal((await f.call('/membership',{method:'POST',body:{...f.join,...override}})).res.status,400);
  assert.equal(f.sql.prepare('SELECT COUNT(*) c FROM applications').get().c,0);
});
test('repeated no-op stage requests do not enqueue misleading notifications',async t=>{
  const f=await fixture(t),{cookie}=f.staff();await f.call('/membership',{method:'POST',body:f.join});
  for(let i=0;i<2;i++)assert.equal((await f.call('/applications/1/stage/review',{method:'POST',body:{},cookie})).res.status,200);
  assert.equal(f.sql.prepare("SELECT COUNT(*) c FROM club_notifications WHERE event_type='review'").get().c,1);
});
test('rejected application cannot acquire a member through issue-card',async t=>{
  const f=await fixture(t),{cookie}=f.staff();await f.call('/membership',{method:'POST',body:f.join});f.sql.exec("UPDATE applications SET status='rejected'");
  assert.equal((await f.call('/club-admin/applications/1/issue-card',{method:'POST',body:{},cookie})).res.status,409);assert.equal(f.sql.prepare('SELECT COUNT(*) c FROM members').get().c,0);
});
test('homepage omits duplicate and empty news/project sections',async t=>{
  const f=await fixture(t);let r=await f.call('/');assert.ok(!r.text.includes('قريبًا ننشر آخر'));assert.ok(!r.text.includes('مساحة للمبادرات'));
  f.sql.prepare('INSERT INTO club_news(title,body,is_published) VALUES(?,?,1)').run('Unique fixture news','Not real news');
  r=await f.call('/');assert.equal((r.text.match(/Unique fixture news/g)||[]).length,1);
});
test('draft news stays private while explicit published CMS content is shown',async t=>{
  const f=await fixture(t),{cookie}=f.staff();assert.equal((await f.call('/club-admin/news',{method:'POST',cookie,body:{title:'Hidden draft',body:'Fixture',status:'draft'}})).res.status,303);
  assert.ok(!(await f.call('/news')).text.includes('Hidden draft'));
  assert.equal((await f.call('/club-admin/news',{method:'POST',cookie,body:{title:'Published fixture',body:'Fixture',status:'published'}})).res.status,303);
  assert.ok((await f.call('/news')).text.includes('Published fixture'));
});
