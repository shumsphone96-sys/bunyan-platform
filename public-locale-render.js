(()=>{
'use strict';
const lang=()=>window.BunyanI18n?.getLanguage?.()||'ar';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bi=(ar,en)=>lang()==='en'?en:ar;
const known=new Map([
 ['تجهيز المكتبات الرقمية المدرسية','Equipping School Digital Libraries'],['تزويد المدارس بمستلزمات الحوسبة والربط السحابي لضمان استمرار التعليم الرقمي للطلاب.','Providing schools with computing equipment and cloud connectivity to sustain digital learning for students.'],
 ['العيادات الوقائية والرعاية الأولية','Preventive Clinics and Primary Care'],['تقديم الرعاية الوقائية وصحة الأم والطفل عبر أطباء ومتطوعين ميدانيين في المناطق النامية.','Providing preventive, maternal and child healthcare through doctors and field volunteers in underserved areas.'],
 ['دعم المشاريع الإنتاجية الصغيرة','Supporting Small Productive Enterprises'],['تمويل وتدريب الأسر المنتجة على مهارات الإنتاج المحلي والتسويق لضمان الاستدامة.','Funding and training productive families in local production and marketing skills to ensure sustainability.'],
 ['إطلاق منصة بُنْيَان الرقمية للتنمية','Launch of the BUNYAN Digital Development Platform'],['تدشين النظام السحابي للحوكمة والشفافية لربط المساهمين والمتطوعين بالمشاريع الميدانية مباشرة.','Launching a cloud governance and transparency system connecting contributors and volunteers directly with field projects.'],
 ['بدء حصر المدارس المستهدفة للتطوير الرقمي','Survey of Schools Targeted for Digital Development Begins'],['انطلاق الفرق الميدانية لتقييم الاحتياجات التقنية وتوفير أجهزة الحوسبة التعليمية.','Field teams begin assessing technical needs and providing educational computing devices.'],
 ['التعليم والمعرفة','Education and Knowledge'],['الصحة والمجتمع','Health and Community'],['التمكين الاقتصادي','Economic Empowerment'],['التحول الرقمي','Digital Transformation'],['نشط','Active'],['مكتمل','Completed'],['قيد التخطيط','Planning'],['مبادرة','Initiative']
]);
const local=(row,base)=>{
 const value=lang()==='en'?(row[`${base}_en`]||row[base]):(row[`${base}_ar`]||row[base]);
 return lang()==='en'?(known.get(String(value||''))||value):value;
};
async function get(path){const origins=window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN];let error;for(const origin of origins){try{const r=await fetch(`${origin}${path}`,{cache:'no-store'});if(!r.ok)throw new Error(String(r.status));return await r.json();}catch(e){error=e;}}throw error;}
function projectMarkup(p){const name=local(p,'name')||local(p,'title');const summary=local(p,'summary')||local(p,'description')||'';const status=local(p,'status')||bi('مبادرة','Initiative');return `<article class="card" data-no-i18n="true"><span class="badge">${esc(status)}</span><h3>${esc(name)}</h3><p>${esc(summary)}</p><button class="primary" type="button" data-project-name="${esc(p.name||p.title||'')}">${bi('ساهم في المشروع','Support Project')}</button></article>`;}
function newsMarkup(n){const title=local(n,'title');const body=local(n,'body')||local(n,'content')||'';const dateValue=n.published_at||n.created_at;const locale=lang()==='en'?'en-GB':'ar-SD';const date=dateValue?new Date(dateValue).toLocaleDateString(locale,{year:'numeric',month:'long',day:'numeric'}):'';return `<article class="card" data-no-i18n="true"><h3>${esc(title)}</h3><p>${esc(body)}</p><small>${esc(date)}</small></article>`;}
async function render(){
 const projectGrid=document.getElementById('projectGrid');
 try{const projects=await get('/api/public/projects');if(projectGrid)projectGrid.innerHTML=projects.length?projects.map(projectMarkup).join(''):`<p data-no-i18n="true">${bi('لا توجد مشروعات منشورة حالياً.','No projects are currently published.')}</p>`;}catch{if(projectGrid)projectGrid.innerHTML=`<div class="error-msg" data-no-i18n="true">${bi('تعذر تحميل المشروعات.','Unable to load projects.')}</div>`;}
 projectGrid?.querySelectorAll('[data-project-name]').forEach(btn=>btn.addEventListener('click',()=>window.openDonateModal?.(btn.dataset.projectName)));
 const newsGrid=document.getElementById('newsGrid');
 try{const news=await get('/api/public/news');if(newsGrid)newsGrid.innerHTML=news.length?news.map(newsMarkup).join(''):`<p data-no-i18n="true">${bi('لا توجد أخبار منشورة حالياً.','No news is currently published.')}</p>`;}catch{if(newsGrid)newsGrid.innerHTML=`<div class="error-msg" data-no-i18n="true">${bi('تعذر تحميل الأخبار.','Unable to load news.')}</div>`;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,50),{once:true});else setTimeout(render,50);
window.addEventListener('bunyan:ready',()=>setTimeout(render,100));
window.BunyanPublicLocale={render};
})();