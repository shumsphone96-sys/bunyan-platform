import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_PATHS,publicSite,safeUrl} from '../public-site.js';
import {polishForms} from '../site-forms.js';
import {header,esc} from '../site-ui.js';
let checks=0;
function check(ok,label){assert.ok(ok,label);checks++}
function db(rows=[],fail=false){
 return {prepare(sql){
  check(/^SELECT\s/i.test(sql),'public SQL must be read-only');
  check(!/\b(members|applications|club_staff_users|sessions)\b/i.test(sql),'no private table reads');
  if(/\b(club_news|club_projects|club_events)\b/.test(sql))check(/is_published=1/.test(sql),'publication filter required');
  return {async all(){if(fail)throw Error('unavailable');return {results:rows}}};
 }};
}
const knownLinks=new Set([...PUBLIC_PATHS,'/constitution','/membership','/membership/track','/membership/payment','/staff-login']);
for(const path of PUBLIC_PATHS){
 const response=await publicSite(new Request('https://members.shamsphone.net'+path),{DB:db()});
 const html=await response.text();
 check(response.status===200,path+' renders');
 check((html.match(/<h1\b/g)||[]).length===1,path+' one main heading');
 check((html.match(/<header\b/g)||[]).length===1,path+' one header');
 check((html.match(/<footer\b/g)||[]).length===1,path+' one footer');
 check(html.includes('id="wdn-main"'),path+' skip target');
 check(html.includes('href="https://members.shamsphone.net'+path+'"'),path+' canonical');
 for(const match of html.matchAll(/href="(\/[^"]*)"/g))check(knownLinks.has(match[1]),path+' known navigation target '+match[1]);
}
check(await publicSite(new Request('https://members.shamsphone.net/membership'),{DB:db()})===null,'membership delegated');
check(await publicSite(new Request('https://members.shamsphone.net/',{method:'POST'}),{DB:db()})===null,'mutations delegated');
check(await publicSite(new Request('https://members.shamsphone.net/club-admin'),{DB:db()})===null,'admin delegated');
let response=await publicSite(new Request('https://members.shamsphone.net/news'),{DB:db([],true)});
check(response.status===503,'unavailable data is not shown as empty success');
check((await response.text()).includes('تعذر تحميل المحتوى'),'explicit data error');
response=await publicSite(new Request('https://members.shamsphone.net/'),{DB:db([],true)});
check((await response.text()).includes('تعذر تحميل بعض المستجدات'),'home partial failure visible');
const record={title:'<script>alert(1)</script>',body:'<img src=x onerror=alert(1)>',category:'عام',name:'<b>اسم</b>',url:'javascript:alert(1)',image_url:'data:text/html,boom',caption:'<x>'};
response=await publicSite(new Request('https://members.shamsphone.net/news'),{DB:db([record])});
let html=await response.text();
check(!html.includes('<script>alert(1)</script>'),'stored title escaped');
check(html.includes('&lt;script&gt;'),'escaped title remains readable');
response=await publicSite(new Request('https://members.shamsphone.net/sponsors'),{DB:db([record])});
check(!(await response.text()).includes('javascript:'),'unsafe sponsor URL excluded');
response=await publicSite(new Request('https://members.shamsphone.net/gallery'),{DB:db([record])});
check(!(await response.text()).includes('data:text/html'),'unsafe image URL excluded');
check(safeUrl('https://example.com/a')==='https://example.com/a','https link retained');
for(const value of ['javascript:alert(1)','data:text/html,<h1>x</h1>','file:///etc/passwd','not a url'])check(safeUrl(value)==='','unsafe URL rejected');
response=await publicSite(new Request('https://members.shamsphone.net/'),{DB:db([{title:'خبر اختبار',body:'نص',summary:'ملخص'}])});
html=await response.text();
check((html.match(/<h2>آخر الأخبار<\/h2>/g)||[]).length===1,'one news section');
check((html.match(/<h2>المشروعات والمبادرات<\/h2>/g)||[]).length===1,'one projects section');
const form='<form method="post" action="/membership" enctype="multipart/form-data"><input name="full_name"><input name="phone"><input name="proof" type="file"><button>إرسال</button></form>';
const fixture='<!doctype html><html><head><title>عضوية</title></head><body><header>old nav</header><main>'+form+'<section style="color:red"><h2>متابعة إجراءات العضوية</h2><form action="/member-status"></form></section><section class="wdn71-public"><p>duplicate</p></section></main><footer>old footer</footer></body></html>';
html=polishForms(fixture,'/membership');
check(html.includes(form),'original form, fields, action and upload contract preserved');
check(!html.includes('action="/member-status"'),'obsolete tracking removed');
check(!html.includes('wdn71-public'),'duplicate tracking removed');
check((html.match(/<header\b/g)||[]).length===1,'one form header');
check((html.match(/<footer\b/g)||[]).length===1,'one form footer');
check(html.includes('id="wdn-main"'),'form skip target');
html=polishForms('<html><head></head><body><main><p><a href="/staff-recover">استعادة</a></p><p><a href="/forgot-account">استعادة</a></p></main></body></html>','/login');
check(!html.includes('href="/forgot-account"'),'duplicate recovery removed');
check(html.includes('href="/staff-recover"'),'staff recovery retained');
check(header('/news').includes('href="/news" aria-current="page"'),'active page indicated');
check(esc('<>&"')==='&lt;&gt;&amp;&quot;','HTML escaping');
const worker=fs.readFileSync(new URL('../worker-global-v78.js',import.meta.url),'utf8');
check(worker.includes("app from './worker-global-v77.js'"),'existing authentication chain retained');
check(worker.includes('return app.scheduled(event,env,ctx)'),'scheduled notifications delegated');
console.log('Site review passed: '+checks+' assertions across '+PUBLIC_PATHS.length+' public routes.');
