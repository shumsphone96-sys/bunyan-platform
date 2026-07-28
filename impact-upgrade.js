(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const insertNavLinks=()=>{
    const nav=$('#nav');
    if(!nav||nav.querySelector('[href="#transparency"]'))return;
    const admin=$('#adminBtn');
    const impact=document.createElement('a');
    impact.href='#impact'; impact.className='impact-nav-link'; impact.textContent='الأثر';
    const transparency=document.createElement('a');
    transparency.href='#transparency'; transparency.className='impact-nav-link'; transparency.textContent='الشفافية';
    nav.insertBefore(impact,admin||null);
    nav.insertBefore(transparency,admin||null);
  };

  const buildImpact=()=>{
    if($('#impact'))return;
    const projects=$('#projects');
    if(!projects)return;
    const section=document.createElement('section');
    section.id='impact';
    section.className='impact-summary';
    section.innerHTML=`
      <div class="impact-summary__head">
        <span class="tag">الأثر بالأرقام</span>
        <h2>نفصل بين الطموح والنتيجة</h2>
        <p>الأهداف المعلنة تعبّر عن خطتنا، أما النتائج المتحققة فلا تُعرض إلا بعد التوثيق والمراجعة.</p>
      </div>
      <div class="impact-tabs" role="tablist" aria-label="نوع مؤشرات الأثر">
        <button class="active" data-impact-tab="target" type="button">الأهداف المستهدفة</button>
        <button data-impact-tab="verified" type="button">النتائج الموثقة</button>
      </div>
      <div class="impact-grid">
        <article class="impact-metric" data-mode="target"><small>المجالات التنموية</small><strong>4</strong><span>تعليم، صحة، تمكين اقتصادي، تحول رقمي</span></article>
        <article class="impact-metric" data-mode="target"><small>المبادرات المستهدفة</small><strong>12+</strong><span>ضمن خطة التوسع المرحلية</span></article>
        <article class="impact-metric" data-mode="target"><small>المتطوعون المستهدفون</small><strong>250</strong><span>شبكة تطوع مجتمعية</span></article>
        <article class="impact-metric" data-mode="target"><small>المستفيدون المستهدفون</small><strong>1000+</strong><span>تقدير أولي للخطة</span></article>
        <article class="impact-metric" data-mode="verified"><small>المشروعات المكتملة</small><strong>قيد التوثيق</strong><span>لن يُنشر رقم قبل اعتماده</span></article>
        <article class="impact-metric" data-mode="verified"><small>المستفيدون الموثقون</small><strong>قيد التوثيق</strong><span>بحسب سجلات المشروعات</span></article>
        <article class="impact-metric" data-mode="verified"><small>المساهمات المؤكدة</small><strong>قيد التوثيق</strong><span>بعد مطابقة إشعارات الدفع</span></article>
        <article class="impact-metric" data-mode="verified"><small>ساعات التطوع</small><strong>قيد التوثيق</strong><span>بعد اعتماد تقارير الفرق</span></article>
      </div>`;
    projects.before(section);
    $$('.impact-tabs button',section).forEach(btn=>btn.addEventListener('click',()=>{
      $$('.impact-tabs button',section).forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      section.classList.toggle('show-verified',btn.dataset.impactTab==='verified');
    }));
  };

  const buildTransparency=()=>{
    if($('#transparency'))return;
    const donate=$('.donate-band');
    if(!donate)return;
    const section=document.createElement('section');
    section.id='transparency';
    section.className='transparency-section';
    section.innerHTML=`
      <div class="transparency-section__head">
        <div><span class="transparency-badge">الشفافية العامة</span><h2>أين يذهب الدعم؟</h2></div>
        <p>هذه اللوحة مخصصة لنشر المساهمات المؤكدة والمصروفات الموثقة وتقدم المشروعات. لا تُعرض أي قيمة مالية قبل مطابقتها واعتمادها.</p>
      </div>
      <div class="transparency-grid">
        <article class="transparency-card"><b>إجمالي المساهمات المؤكدة</b><strong>قيد المراجعة</strong><span>تُحدّث بعد المطابقة المالية</span></article>
        <article class="transparency-card"><b>إجمالي المصروفات الموثقة</b><strong>قيد المراجعة</strong><span>مرتبطة بالمستندات والفواتير</span></article>
        <article class="transparency-card"><b>الرصيد المتاح للمشروعات</b><strong>قيد المراجعة</strong><span>بعد خصم المصروفات المعتمدة</span></article>
        <article class="transparency-card"><b>آخر تحديث مالي</b><strong>لم يُنشر بعد</strong><span>سيظهر التاريخ عند أول اعتماد</span></article>
      </div>
      <div class="transparency-note"><strong>قاعدة بُنْيَان:</strong> الهدف ليس رقمًا محققًا، والتعهد ليس مساهمة مؤكدة، والمصروف لا يُعتمد بلا مستند.</div>`;
    donate.before(section);
  };

  const ensureModal=()=>{
    let modal=$('#impactProjectModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='impactProjectModal';
    modal.className='impact-modal';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML='<div class="impact-modal__panel" role="dialog" aria-modal="true" aria-labelledby="impactModalTitle"><button class="impact-modal__close" type="button" aria-label="إغلاق">×</button><div class="impact-modal__body"></div></div>';
    document.body.appendChild(modal);
    const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''};
    $('.impact-modal__close',modal).addEventListener('click',close);
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    return modal;
  };

  const enhanceProjects=()=>{
    const grid=$('#projectGrid');
    if(!grid)return;
    const modal=ensureModal();
    const enhance=()=>$$('article.card',grid).forEach((card,index)=>{
      if(card.dataset.impactEnhanced)return;
      card.dataset.impactEnhanced='1';
      const title=$('h3',card)?.textContent?.trim()||`مشروع ${index+1}`;
      const desc=$('p',card)?.textContent?.trim()||'تفاصيل المشروع قيد التحديث.';
      const category=$('.badge',card)?.textContent?.trim()||'مشروع تنموي';
      const meta=document.createElement('div');
      meta.className='project-impact-meta';
      meta.innerHTML='<div><small>الميزانية</small><strong>قيد النشر</strong></div><div><small>حالة التنفيذ</small><strong>في مرحلة الإعداد</strong></div>';
      const progress=document.createElement('div');
      progress.innerHTML='<div class="project-progress" aria-label="تقدم المشروع"><span style="width:0%"></span></div><div class="project-data-status"><span>0% موثق</span><span>آخر تحديث: لم يُنشر</span></div>';
      const btn=document.createElement('button');
      btn.type='button';btn.className='project-details-btn';btn.textContent='عرض تفاصيل المشروع';
      btn.addEventListener('click',()=>{
        $('.impact-modal__body',modal).innerHTML=`
          <span class="badge">${esc(category)}</span>
          <h3 id="impactModalTitle">${esc(title)}</h3>
          <p>${esc(desc)}</p>
          <div class="impact-modal__facts">
            <div><small>الموقع</small><strong>قيد التحديد</strong></div>
            <div><small>عدد المستفيدين</small><strong>قيد التوثيق</strong></div>
            <div><small>الميزانية</small><strong>قيد الاعتماد</strong></div>
          </div>
          <div class="transparency-note">سيُضاف هنا نطاق العمل، مراحل التنفيذ، الصور الميدانية، المستندات، المصروفات وآخر تحديث معتمد.</div>`;
        modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
      });
      const donate=$('.donate-trigger',card);
      if(donate){card.insertBefore(meta,donate);card.insertBefore(progress,donate);card.insertBefore(btn,donate)}
      else{card.append(meta,progress,btn)}
    });
    enhance();
    new MutationObserver(enhance).observe(grid,{childList:true,subtree:true});
  };

  const improveAdminEntry=()=>{
    const btn=$('#adminBtn');
    if(!btn)return;
    btn.title='دخول الإدارة المصرح فقط';
    btn.setAttribute('aria-label','دخول الإدارة المصرح فقط');
  };

  const init=()=>{insertNavLinks();buildImpact();buildTransparency();enhanceProjects();improveAdminEntry()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
