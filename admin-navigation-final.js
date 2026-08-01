(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const origins=()=>window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN||'https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
const token=()=>sessionStorage.getItem('bunyan_token')||'';
async function api(path){let last;for(const base of origins()){try{const r=await fetch(base+path,{headers:{Authorization:`Bearer ${token()}`},cache:'no-store'});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}if(!r.ok)throw new Error(data.error||`فشل الطلب (${r.status})`);return data}catch(e){last=e}}throw last||new Error('تعذر الاتصال بالخادم')}
function dashOpen(){return $('#dash')?.classList.contains('open')||$('#dash')?.classList.contains('show')}
function closePublic(){document.getElementById('nav')?.classList.remove('open')}
function closeAdmin(){document.querySelector('#dash aside')?.classList.remove('admin-drawer-open');document.body.classList.remove('admin-drawer-visible')}
function closeMenus(){closePublic();closeAdmin()}
function openDash(){const dash=$('#dash');if(!dash)return;if(token()){dash.classList.add('open');$('#login')?.classList.remove('open');closePublic();setTimeout(()=>window.openExecutiveDashboard?.(),100)}else $('#login')?.classList.add('open')}
function card(title,rows,kind){const fields=kind==='help'?['tracking_number','full_name','phone','location','case_type','status','created_at']:['name','phone','role','message','status','created_at'];const labels={tracking_number:'رقم التتبع',full_name:'الاسم',name:'الاسم',phone:'الهاتف',location:'الموقع',case_type:'نوع الحالة',role:'نوع المشاركة',message:'الرسالة',status:'الحالة',created_at:'تاريخ الإرسال'};return `<section class="admin-final-requests"><header><div><small>بُنْيَان OS</small><h3>${title}</h3></div><button class="outline admin-refresh" data-final-refresh="${kind}">تحديث</button></header>${rows.length?`<div class="admin-final-list">${rows.map(r=>`<article>${fields.map(f=>`<div><span>${labels[f]}</span><strong>${esc(f==='created_at'&&r[f]?new Date(r[f]).toLocaleString('ar-SD'):r[f]||'—')}</strong></div>`).join('')}</article>`).join('')}</div>`:'<div class="empty">لا توجد طلبات حتى الآن.</div>'}</section>`}
async function render(kind){const content=$('#dashContent'),title=$('#dashTitle');if(!content)return;closeMenus();content.innerHTML='<div class="loading">جاري التحميل...</div>';try{const rows=await api(kind==='help'?'/api/help/requests':'/api/requests');if(title)title.textContent=kind==='help'?'طلبات المساعدة':'طلبات المشاركة';content.innerHTML=card(title.textContent,Array.isArray(rows)?rows:[],kind);content.querySelector('[data-final-refresh]')?.addEventListener('click',()=>render(kind))}catch(e){content.innerHTML=`<div class="error-msg">${esc(e.message)}</div>`}}
function bindAdminButtons(aside){
 let help=aside.querySelector('[data-final-view="help"]');if(!help){help=document.createElement('button');help.dataset.finalView='help';help.textContent='طلبات المساعدة';const requests=aside.querySelector('[data-view="requests"]');aside.insertBefore(help,requests||aside.querySelector('#backup'))}
 let participation=aside.querySelector('[data-final-view="participation"]');if(!participation){participation=document.createElement('button');participation.dataset.finalView='participation';participation.textContent='طلبات المشاركة';const old=aside.querySelector('[data-view="requests"]');if(old){old.style.display='none';old.insertAdjacentElement('afterend',participation)}else aside.insertBefore(participation,aside.querySelector('#backup'))}
 help.onclick=()=>render('help');participation.onclick=()=>render('participation');
 aside.querySelectorAll('button').forEach(button=>{if(button.dataset.drawerBound)return;button.dataset.drawerBound='1';button.addEventListener('click',()=>setTimeout(closeAdmin,60))});
}
function bindMenu(){const menu=$('#menu');if(!menu||menu.dataset.adminMenuBound)return;menu.dataset.adminMenuBound='1';menu.addEventListener('click',e=>{if(!dashOpen())return;e.preventDefault();e.stopImmediatePropagation();closePublic();const aside=$('#dash aside');if(!aside)return;const opening=!aside.classList.contains('admin-drawer-open');closeAdmin();if(opening){aside.classList.add('admin-drawer-open');document.body.classList.add('admin-drawer-visible')}},true)}
function install(){
 const admin=$('#adminBtn');if(admin){admin.onclick=e=>{e.preventDefault();openDash()}}
 const aside=$('#dash aside');if(aside)bindAdminButtons(aside);
 bindMenu();
 if(dashOpen())closePublic();
}
const style=document.createElement('style');style.textContent=`
.admin-final-requests{padding:16px}.admin-final-requests>header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.admin-final-requests h3{margin:4px 0;font-size:clamp(1.6rem,5vw,2.5rem)}.admin-refresh{color:#12231f;border-color:#d9dfdc}.admin-final-list{display:grid;gap:14px}.admin-final-list article{background:#fff;border:1px solid #d9dfdc;border-radius:20px;padding:16px;box-shadow:0 10px 30px #071a1710}.admin-final-list article div{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #eef1ef}.admin-final-list article div:last-child{border-bottom:0}.admin-final-list span{color:#68736f}.admin-final-list strong{text-align:end;overflow-wrap:anywhere}
@media(max-width:900px){#dash aside{position:fixed!important;top:0!important;right:0!important;bottom:0!important;width:min(82vw,330px)!important;z-index:120!important;display:flex!important;flex-direction:column!important;gap:8px!important;padding:24px 18px!important;overflow-y:auto!important;transform:translateX(105%)!important;transition:transform .25s ease!important;box-shadow:-20px 0 55px #0003!important}#dash aside.admin-drawer-open{transform:translateX(0)!important}#dash aside .brand{display:flex!important;margin-bottom:14px!important}body.admin-drawer-visible:after{content:'';position:fixed;inset:0;background:#0007;z-index:110}#dash aside button{width:100%!important;white-space:normal!important;text-align:right!important;padding:13px 14px!important}.admin-final-list article div{align-items:flex-start;flex-direction:column;gap:4px}}
`;document.head.appendChild(style);
document.addEventListener('click',e=>{if(!dashOpen())return;const aside=$('#dash aside');if(!aside?.classList.contains('admin-drawer-open'))return;if(e.target.closest('#dash aside')||e.target.closest('#menu'))return;closeAdmin()},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('bunyan:ready',install);setInterval(install,1200);
window.BunyanAdminFinal={openDash,render,closeAdmin};
})();