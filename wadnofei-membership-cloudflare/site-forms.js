import {header,footer,sharedCss} from './site-ui.js';
export const FORM_PATHS=new Set(['/membership','/membership/join','/membership/track','/membership/payment','/track-membership','/staff-login','/login','/staff-recover','/forgot-account']);
export function polishForms(html,path){
 html=html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/i,'').replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/i,'');
 html=html.replace(/<body([^>]*)>/i,'<body$1>'+header(path)).replace('</body>',footer()+'</body>');
 html=html.replace(/<main([^>]*)>/i,'<main id="wdn-main" tabindex="-1"$1>');
 if(['/membership','/membership/join'].includes(path)){
  html=html.replace(/<section\b[^>]*><h2[^>]*>متابعة إجراءات العضوية<\/h2>[\s\S]*?<\/section>/g,'');
  html=html.replace(/<section class="wdn71-public">[\s\S]*?<\/section>/g,'');
  html=html.replace('إشعارات الطلب تلقائية','احتفظ برقم طلبك').replace('بعد إرسال الطلب، ستتابع الإدارة حالته وسيصل أي تحديث إلى رقم الهاتف المسجل دون أي خطوة إضافية منك.','بعد إرسال الطلب، يمكنك متابعة حالته برقم الطلب والهاتف المسجل من صفحة المتابعة.');
 }
 if(['/login','/staff-login'].includes(path)){
  html=html.replace(/<p[^>]*>\s*<a href="\/forgot-account">[^<]*<\/a>\s*<\/p>/g,'');
  html=html.replace('<h2>حساب الصلاحيات</h2>','<h2>دخول المسؤولين</h2>');
 }
 html=html.replaceAll('href="/club"','href="/"');
 const css=sharedCss+'body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial;line-height:1.8}main{min-width:0}input:not([type=checkbox]):not([type=radio]),textarea,select{max-width:100%;min-width:0;font-size:16px}button{min-height:44px}.grid2>*{min-width:0}main img{max-width:100%}@media(max-width:620px){.grid2,.form .grid2{grid-template-columns:1fr!important}main{width:calc(100% - 28px)!important;margin:24px auto!important}.form-card{padding:20px!important}.hero.compact h1{font-size:29px}.sub-actions{display:flex;flex-wrap:wrap;gap:14px}}';
 return html.replace('</head>','<style id="wdn-site-ui">'+css+'</style></head>');
}
