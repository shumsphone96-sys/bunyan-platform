(()=>{
  'use strict';
  const requiredIds=['menu','nav','adminBtn','login','loginForm','dash','dashContent','dashTitle','projectGrid','newsGrid','joinForm','contactForm','donateForm'];
  const publicChecks=['/api/public/projects','/api/public/news'];
  const adminChecks=['/api/dashboard','/api/projects','/api/beneficiaries','/api/volunteers','/api/donations','/api/news','/api/requests'];
  const origins=window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN||'https://api.bunyan-sudan.org'];
  const token=()=>sessionStorage.getItem('bunyan_token')||'';
  const now=()=>new Date().toISOString();
  async function probe(path,auth=false){
    let last='';
    for(const origin of origins){
      try{
        const headers={Accept:'application/json'};
        if(auth&&token())headers.Authorization=`Bearer ${token()}`;
        const r=await fetch(origin+path,{headers,cache:'no-store'});
        if(r.ok)return {ok:true,path,status:r.status,origin};
        last=`HTTP ${r.status}`;
      }catch(e){last=e.message}
    }
    return {ok:false,path,error:last||'connection failed'};
  }
  function domAudit(){
    const missing=requiredIds.filter(id=>!document.getElementById(id));
    const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);
    const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
    return {ok:missing.length===0&&duplicates.length===0,missing,duplicates};
  }
  function languageAudit(){
    const lang=document.documentElement.lang||'ar';
    const dir=document.documentElement.dir||'rtl';
    return {ok:(lang==='ar'&&dir==='rtl')||(lang==='en'&&dir==='ltr'),lang,dir};
  }
  async function run(){
    const checks=[...await Promise.all(publicChecks.map(p=>probe(p))),domAudit(),languageAudit()];
    if(token())checks.push(...await Promise.all(adminChecks.map(p=>probe(p,true))));
    const report={release:window.BUNYAN_RELEASE||'unknown',time:now(),ok:checks.every(x=>x.ok),checks};
    sessionStorage.setItem('bunyan_stability_report',JSON.stringify(report));
    window.dispatchEvent(new CustomEvent('bunyan:stability',{detail:report}));
    return report;
  }
  function harden(){
    document.querySelectorAll('form').forEach(form=>{
      form.addEventListener('submit',()=>{
        const btn=form.querySelector('button[type="submit"],button:not([type])');
        if(btn){btn.dataset.originalText=btn.textContent;setTimeout(()=>{btn.disabled=false;if(btn.dataset.originalText)btn.textContent=btn.dataset.originalText},35000)}
      },true);
    });
    document.addEventListener('click',e=>{
      const link=e.target.closest('#nav a');
      if(link)document.getElementById('nav')?.classList.remove('open');
    },true);
  }
  window.BunyanStability={run,getReport:()=>{try{return JSON.parse(sessionStorage.getItem('bunyan_stability_report')||'null')}catch{return null}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{harden();setTimeout(run,1500)},{once:true});
  else {harden();setTimeout(run,1500)}
})();