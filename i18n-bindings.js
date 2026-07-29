(()=>{
'use strict';
const text=(selector,key,html=false)=>{const el=document.querySelector(selector);if(!el)return;el.dataset.i18n=key;if(html)el.dataset.i18nHtml='true';};
const all=(selector,keys)=>document.querySelectorAll(selector).forEach((el,i)=>{if(keys[i])el.dataset.i18n=keys[i];});
const ph=(selector,key)=>{const el=document.querySelector(selector);if(el)el.dataset.i18nPlaceholder=key;};
function bind(){
 text('header .brand strong','brand.name');text('header .brand small','brand.subtitle');
 all('#nav > a',['nav.about','nav.programs','nav.projects','nav.news','nav.join','nav.contact']);text('#adminBtn','nav.admin');
 text('#home .tag','hero.tag');text('#home h1','hero.title1',true);const h1=document.querySelector('#home h1');if(h1)h1.innerHTML='<span data-i18n="hero.title1"></span><br><em data-i18n="hero.title2"></em>';
 text('#home p','hero.body');all('#home .actions a',['hero.projects','hero.join']);text('#home .orb small','hero.orb');
 all('.stats article span',['stats.fields','stats.initiatives','stats.volunteers','stats.beneficiaries']);
 text('#about .tag','about.tag');text('#about h2','about.title',true);text('#about p','about.body');all('#about .chips span',['about.people','about.transparency','about.justice','about.sustainability']);
 text('#programs > .tag','programs.tag');text('#programs > h2','programs.title');all('#programs article h3',['programs.edu','programs.health','programs.econ','programs.digital']);all('#programs article p',['programs.eduBody','programs.healthBody','programs.econBody','programs.digitalBody']);
 text('#projects > .tag','projects.tag');text('#projects > h2','projects.title');document.querySelectorAll('#projects .donate-trigger').forEach(el=>el.dataset.i18n='projects.support');
 text('#news > .tag','news.tag');text('#news > h2','news.title');
 text('.donate-band .tag','donate.tag');text('.donate-band h2','donate.title');text('.donate-band p','donate.body');text('#donateBtn','donate.button');
 text('#join .tag','join.tag');text('#join h2','join.title');text('#join p','join.body');all('#join select option',['join.volunteer','join.partner','join.support']);text('#join button','join.send');ph('#join input[name="name"]','form.fullName');ph('#join input[name="phone"]','form.phone');
 text('#contact .tag','contact.tag');text('#contact h2','contact.title');text('#contact p','contact.body');text('#contact .contact-details span','contact.location');text('#contact button[type="submit"]','contact.send');ph('#contact input[name="name"]','form.fullName');ph('#contact input[name="email"]','form.emailOptional');ph('#contact input[name="phone"]','form.phoneOptional');ph('#contact input[name="subject"]','form.subject');ph('#contact textarea[name="message"]','form.message');
 text('footer .brand strong','brand.name');text('footer .brand small','brand.footer');text('footer > p','footer.copy');
 text('#login h2','login.title');ph('#login input[name="name"]','login.name');ph('#login input[name="email"]','login.email');ph('#login input[name="password"]','login.password');text('#loginForm button[type="submit"]','login.signin');text('#setupAdmin','login.setup');text('#loginForm small','login.note');
 all('#dash aside button[data-view]',['dash.overview','dash.projects','dash.beneficiaries','dash.volunteers','dash.donations','dash.news','dash.requests']);text('#backup','dash.backup');text('#logout','dash.logout');text('#dashTitle','dash.overview');text('#site','dash.site');
 text('#donateModal h2','donate.button');ph('#donateForm input[name="donor"]','form.donor');ph('#donateForm input[name="amount"]','form.amount');ph('#donateForm input[name="projectName"]','form.project');ph('#donateForm input[name="method"]','form.method');ph('#donateForm input[name="reference"]','form.reference');text('#donateForm .receipt-upload strong','receipt.title');text('#donateForm .receipt-upload span','receipt.note');text('#donateForm button[type="submit"]','form.saveDonation');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.BunyanI18nBindings={bind};
})();