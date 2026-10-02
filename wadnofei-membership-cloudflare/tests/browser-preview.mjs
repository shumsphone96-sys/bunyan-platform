import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import puppeteer from 'puppeteer-core';

const base=String(process.env.PREVIEW_BASE||'').replace(/\/$/,'');
assert.ok(/^https:\/\//.test(base)||/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(base),'PREVIEW_BASE must be https or loopback http');
const candidates=[
 process.env.CHROME_PATH,
 '/usr/bin/google-chrome',
 '/usr/bin/google-chrome-stable',
 '/usr/bin/chromium',
 '/usr/bin/chromium-browser'
].filter(Boolean);
const executablePath=candidates.find(existsSync);
assert.ok(executablePath,'Chrome/Chromium not found on runner');

const browser=await puppeteer.launch({
 executablePath,
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
});
const routes=['/','/about','/news','/membership','/membership/track','/membership/payment','/staff-login','/staff-recover'];
const profiles=[
 ['mobile',{width:390,height:844,isMobile:true,deviceScaleFactor:1}],
 ['desktop',{width:1440,height:900,isMobile:false,deviceScaleFactor:1}]
];
let checks=0;
try{
 for(const [profile,viewport] of profiles){
  const page=await browser.newPage();
  await page.setViewport(viewport);
  for(const route of routes){
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:45000});
   assert.ok(response,profile+' '+route+' has response'); checks++;
   assert.equal(response.status(),200,profile+' '+route+' HTTP 200'); checks++;
   await page.waitForSelector('body',{timeout:10000});
   const metrics=await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth;
    const main=document.querySelector('main');
    const header=document.querySelector('header');
    const footer=document.querySelector('footer');
    const fields=[...document.querySelectorAll('input,textarea,select,button')];
    const overflowFields=fields.filter(el=>{
     const r=el.getBoundingClientRect();
     return r.width>0&&(r.left < -2 || r.right > vw+2);
    }).length;
    const overflowElements=[...document.querySelectorAll('body *')].map(el=>{
     const r=el.getBoundingClientRect();
     return {
      tag:el.tagName.toLowerCase(),
      id:el.id||'',
      cls:String(el.className||'').slice(0,120),
      left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),
      text:String(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,90)
     };
    }).filter(x=>x.width>0&&(x.left < -2 || x.right > vw+2)).slice(0,12);
    return {
     html:document.documentElement.tagName==='HTML',
     rtl:document.documentElement.dir==='rtl'||getComputedStyle(document.body).direction==='rtl',
     main:!!main,
     header:!!header,
     footer:!!footer,
     mainIds:document.querySelectorAll('#wdn-main').length,
     overflow:document.documentElement.scrollWidth-vw,
     overflowFields,
     overflowElements
    };
   });
   assert.ok(metrics.html,profile+' '+route+' HTML document'); checks++;
   assert.ok(metrics.rtl,profile+' '+route+' RTL'); checks++;
   assert.ok(metrics.main,profile+' '+route+' main landmark'); checks++;
   assert.ok(metrics.header,profile+' '+route+' header'); checks++;
   assert.ok(metrics.footer,profile+' '+route+' footer'); checks++;
   assert.equal(metrics.mainIds,1,profile+' '+route+' one main id'); checks++;
   if(metrics.overflow>2)console.error('Overflow diagnostics',profile,route,JSON.stringify(metrics.overflowElements));
   assert.ok(metrics.overflow<=2,profile+' '+route+' no horizontal page overflow: '+metrics.overflow+'px'); checks++;
   assert.equal(metrics.overflowFields,0,profile+' '+route+' form controls stay inside viewport'); checks++;
  }
  await page.close();
 }
}finally{
 await browser.close();
}
console.log('Browser preview passed: '+checks+' responsive assertions across '+routes.length+' routes × '+profiles.length+' viewports.');
