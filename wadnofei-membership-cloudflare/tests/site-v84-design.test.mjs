import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSite} from '../public-site.js';
import {premiumCss} from '../site-v84-design.js';

const origin='https://members.shamsphone.net';
function mockDb({news=[],projects=[],gallery=[]}={}){
 return {
  prepare(sql){
   if(/^CREATE TABLE IF NOT EXISTS /i.test(sql))return {async run(){return {success:true}}};
   if(!/^\s*SELECT\s/i.test(sql))throw Error('Unexpected non-read public query: '+sql);
   let results=[];
   if(/FROM club_news\b/i.test(sql))results=news;
   else if(/FROM club_projects\b/i.test(sql))results=projects;
   else if(/FROM club_gallery\b/i.test(sql))results=gallery;
   return {async all(){return {results}}};
  }
 };
}
async function homepage(data){
 const r=await publicSite(new Request(origin+'/'),{DB:mockDb(data)});
 assert.equal(r.status,200);
 assert.equal(r.headers.get('x-wadnofei-ui'),'v78-organized-site');
 assert.equal(r.headers.get('x-wadnofei-visual'),'v84-club-blue-yellow');
 return r.text();
}
test('v84 has branded accessible responsive homepage and all its established routes',async()=>{
 const html=await homepage();
 assert.match(html,/نادي ودنفيع/);
 assert.match(html,/wdn-crest-frame/);
 assert.match(html,/aria-label="روابط سريعة للنادي"/);
 assert.match(html,/href="\/membership"/);
 assert.match(html,/href="\/history"/);
 assert.match(html,/href="\/team"/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.equal((html.match(/<header\b/g)||[]).length,1);
 assert.equal((html.match(/<footer\b/g)||[]).length,1);
 assert.ok(premiumCss.includes('--club-blue:#1048bb'));
 assert.ok(premiumCss.includes('--club-yellow:#ffde3b'));
 assert.ok(premiumCss.includes('@media(max-width:760px)'));
 assert.ok(premiumCss.includes('prefers-reduced-motion'));
 assert.ok(!/<script\b/i.test(html),'public homepage does not load external scripts');
});
test('v84 shows only published CMS-fed stories and valid gallery images',async()=>{
 const html=await homepage({
  news:[{title:'عودة النادي للمنافسة',body:'خبر منشور',category:'الرياضة',created_at:'2026-11-06'}],
  projects:[{title:'مبادرة خدمة المجتمع',summary:'مشاركة الأهالي',status:'مستمر'}],
  gallery:[
   {title:'صورة من الملعب',image_url:'https://example.org/sport.jpg',caption:'ملعب النادي'},
   {title:'لا تعرض',image_url:'javascript:alert(1)',caption:'رابط غير آمن'}
  ]
 });
 assert.match(html,/<h2>آخر الأخبار<\/h2>/);
 assert.match(html,/<h2>المشروعات والمبادرات<\/h2>/);
 assert.match(html,/عودة النادي للمنافسة/);
 assert.match(html,/مبادرة خدمة المجتمع/);
 assert.match(html,/https:\/\/example.org\/sport.jpg/);
 assert.equal((html.match(/<figure class="wdn-photo">/g)||[]).length,1);
 assert.ok(!html.includes('javascript:alert(1)'));
});
test('v84 escapes CMS content and does not manufacture empty galleries',async()=>{
 const html=await homepage({
  news:[{title:'<svg onload=alert(1)>',body:'<script>alert(1)</script>',category:'عام'}],
  gallery:[{title:'غير آمنة',image_url:'data:text/html,wrong'}]
 });
 assert.ok(!html.includes('<svg onload=alert(1)>'));
 assert.ok(!html.includes('<script>alert(1)</script>'));
 assert.match(html,/&lt;svg/);
 assert.equal((html.match(/<figure class="wdn-photo">/g)||[]).length,0);
});
