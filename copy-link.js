(()=>{
  const BASE_URL='https://bunyan-sudan.org';
  const copiedTimers=new WeakMap();

  const projectUrl=id=>{
    const url=new URL(BASE_URL);
    if(id)url.searchParams.set('project',id);
    return url.toString();
  };

  async function copyText(text){
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return;
    }
    const area=document.createElement('textarea');
    area.value=text;
    area.setAttribute('readonly','');
    area.style.position='fixed';
    area.style.inset='-9999px auto auto -9999px';
    area.style.opacity='0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0,area.value.length);
    const ok=document.execCommand('copy');
    area.remove();
    if(!ok)throw new Error('تعذر نسخ الرابط');
  }

  function icon(){
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  }

  function makeButton(id,label='نسخ الرابط'){
    const button=document.createElement('button');
    button.type='button';
    button.className='copy-btn';
    button.dataset.copyProject=id||'';
    button.innerHTML=`${icon()}<span>${label}</span>`;
    button.addEventListener('click',async()=>{
      const text=button.querySelector('span');
      const original=text.textContent;
      try{
        button.disabled=true;
        await copyText(projectUrl(button.dataset.copyProject));
        text.textContent='تم النسخ ✓';
        button.classList.add('copied');
      }catch(error){
        text.textContent='تعذر النسخ';
        console.error('فشل نسخ رابط المشروع:',error);
      }finally{
        clearTimeout(copiedTimers.get(button));
        copiedTimers.set(button,setTimeout(()=>{
          text.textContent=original;
          button.classList.remove('copied');
          button.disabled=false;
        },2000));
      }
    });
    return button;
  }

  function enhanceCards(root=document){
    root.querySelectorAll('.pc-card').forEach(card=>{
      if(card.querySelector('.copy-btn'))return;
      const edit=card.querySelector('[data-edit]');
      const preview=card.querySelector('[data-preview]');
      const id=edit?.dataset.edit||preview?.dataset.preview;
      const actions=card.querySelector('.pc-actions');
      if(id&&actions)actions.insertBefore(makeButton(id),actions.firstChild);
    });
  }

  function enhancePreview(root=document){
    root.querySelectorAll('.pc-preview').forEach(preview=>{
      if(preview.querySelector('.copy-btn'))return;
      const projectId=document.querySelector('.pc-card [data-preview]')?.dataset.preview||'';
      const donate=preview.querySelector('#pcDonate');
      const button=makeButton(projectId,'نسخ رابط المشروع');
      button.classList.add('copy-btn-wide');
      if(donate)donate.insertAdjacentElement('afterend',button);
      else preview.appendChild(button);
    });
  }

  function enhance(){
    enhanceCards();
    enhancePreview();
  }

  const observer=new MutationObserver(enhance);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',enhance);
  enhance();
})();