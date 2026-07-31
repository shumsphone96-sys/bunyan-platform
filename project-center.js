(()=>{
  'use strict';
  const release='20260731-project-v4-1';
  if(!document.querySelector('link[data-project-v4]')){
    const style=document.createElement('link');
    style.rel='stylesheet';
    style.href=`./project-v4.css?v=${release}`;
    style.dataset.projectV4='1';
    document.head.appendChild(style);
  }
  if(!document.querySelector('script[data-project-v4]')){
    const script=document.createElement('script');
    script.src=`./project-v4.js?v=${release}`;
    script.async=false;
    script.dataset.projectV4='1';
    document.head.appendChild(script);
  }
})();