(()=>{
  'use strict';

  // Let the browser perform a normal navigation for language links.
  // This listener runs on window capture before older document listeners.
  window.addEventListener('click',event=>{
    const link=event.target?.closest?.('a[data-lang-link]');
    if(!link)return;
    const href=link.getAttribute('href');
    if(!href)return;
    event.stopImmediatePropagation();
    const target=new URL(href,location.href);
    location.href=target.href;
  },true);
})();
