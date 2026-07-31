(()=>{
  'use strict';
  const release='20260731-project-lifecycle-2';
  const addStyle=(href,key)=>{if(document.querySelector(`link[data-${key}]`))return;const style=document.createElement('link');style.rel='stylesheet';style.href=`./${href}?v=${release}`;style.setAttribute(`data-${key}`,'1');document.head.appendChild(style)};
  const addScript=(src,key,onload)=>{if(document.querySelector(`script[data-${key}]`)){onload?.();return}const script=document.createElement('script');script.src=`./${src}?v=${release}`;script.async=false;script.setAttribute(`data-${key}`,'1');if(onload)script.onload=onload;document.head.appendChild(script)};
  addStyle('project-v4.css','project-v4');
  addStyle('project-lifecycle.css','project-lifecycle');
  addScript('project-v4.js','project-v4',()=>addScript('project-lifecycle.js','project-lifecycle'));
})();