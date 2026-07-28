(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const origins=window.BUNYAN_API_ORIGINS||[window.BUNYAN_API_ORIGIN||'https://api.bunyan-sudan.org','https://bunyan-api-qhkf.onrender.com'];
  const money=(value,currency)=>`${Number(value||0).toLocaleString('en-GB')} ${esc(currency||'')}`;
  const dateText=value=>value?new Date(value).toLocaleString('ar-SD',{dateStyle:'medium',timeStyle:'short'}):'لم يُنشر بعد';

  async function publicApi(path){
    let last;
    for(const base of origins){
      try{
        const response=await fetch(base+path,{cache:'no-store',headers:{Accept:'application/json'}});
        const text=await response.text();
        let data={};
        try{data=text?JSON.parse(text):{}}catch{data={message:text}}
        if(!response.ok)throw new Error(data.error||data.message||`فشل الطلب (${response.status})`);
        return data;
      }catch(error){last=error}
    }
    throw last||new Error('تعذر الاتصال بالخادم');
  }

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
        <article class="impact-metric" data-mode="verified"><small>المساهمات المؤكدة</small><strong id="verifiedDonationCount">قيد التحميل</strong><span id="verifiedDonationHint">بعد مطابقة إشعارات الدفع</span></article>
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
        <p>تعرض هذه اللوحة المساهمات التي اعتمدتها الإدارة فقط، دون نشر أسماء أو أرقام هواتف المساهمين. المصروفات لا تُنشر إلا بعد إرفاق مستند واعتمادها.</p>
      </div>
      <div class="transparency-grid">
        <article class="transparency-card"><b>إجمالي المساهمات المؤكدة</b><strong id="publicVerifiedTotals">جاري التحميل…</strong><span id="publicVerifiedCount">مطابقة السجلات المالية</span></article>
        <article class="transparency-card"><b>إجمالي المصروفات الموثقة</b><strong>قيد إنشاء السجل</strong><span>لن تُعرض قيمة قبل اعتماد الفواتير</span></article>
        <article class="transparency-card"><b>الرصيد المتاح للمشروعات</b><strong>غير محسوب بعد</strong><span>يظهر بعد تفعيل سجل المصروفات</span></article>
        <article class="transparency-card"><b>آخر تحديث مالي</b><strong id="publicFinanceUpdated">جاري التحميل…</strong><span id="publicFinanceState">من السجلات المعتمدة</span></article>
      </div>
      <div class="transparency-note"><strong>قاعدة بُنْيَان:</strong> الهدف ليس رقمًا محققًا، والتعهد ليس مساهمة مؤكدة، والمصروف لا يُعتمد بلا مستند.</div>`;
    donate.before(section);
  };

  async function loadLiveTransparency(){
    const totalsNode=$('#publicVerifiedTotals');
    if(!totalsNode)return;
    try{
      const result=await publicApi('/api/donations');
      const rows=Array.isArray(result)?result:Array.isArray(result?.donations)?result.donations:[];
      const verified=rows.filter(item=>item&&item.status==='verified');
      const totals={};
      verified.forEach(item=>{
        const currency=String(item.currency||'SDG').toUpperCase();
        totals[currency]=(totals[currency]||0)+Number(item.amount||0);
      });
      const totalEntries=Object.entries(totals).filter(([,value])=>Number.isFinite(value));
      totalsNode.innerHTML=totalEntries.length?totalEntries.map(([currency,value])=>`<span class="public-money-line">${money(value,currency)}</span>`).join(''):'لا توجد مساهمات موثقة بعد';
      const countText=`${verified.length.toLocaleString('en-GB')} عملية موثقة`;
      $('#publicVerifiedCount').textContent=countText;
      $('#verifiedDonationCount').textContent=verified.length.toLocaleString('en-GB');
      $('#verifiedDonationHint').textContent=countText;
      const latest=verified.map(item=>item.updated_at||item.created_at).filter(Boolean).sort((a,b)=>new Date(b)-new Date(a))[0];
      $('#publicFinanceUpdated').textContent=dateText(latest);
      $('#publicFinanceState').textContent=verified.length?'آخر مساهمة معتمدة':'لا توجد بيانات مالية منشورة';
    }catch(error){
      totalsNode.textContent='تعذر جلب البيانات الآن';
      $('#publicVerifiedCount').textContent='سيُعاد الاتصال تلقائيًا عند تحديث الصفحة';
      $('#publicFinanceUpdated').textContent='غير متاح الآن';
      $('#publicFinanceState').textContent='لم تُعرض أرقام غير مؤكدة';
      $('#verifiedDonationCount').textContent='غير متاح';
      $('#verifiedDonationHint').textContent='تعذر الاتصال بالسجل المالي';
      console.warn('Bunyan public transparency:',error);
    }
  }

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

  const init=()=>{insertNavLinks();buildImpact();buildTransparency();enhanceProjects();improveAdminEntry();loadLiveTransparency()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();