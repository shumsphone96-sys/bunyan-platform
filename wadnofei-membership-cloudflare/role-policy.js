export function normalizeRole(role){
  const r=String(role||'').toLowerCase();
  if(['owner','superadmin','admin','president'].includes(r))return'owner';
  if(['vice_president','vice-president'].includes(r))return'vice_president';
  if(['secretary','secretariat','scretary'].includes(r))return'secretary';
  if(['finance_manager','treasurer','finance','amin_mal'].includes(r))return'finance';
  return'limited';
}

export function classifyAdminPath(path){
  const p=String(path||'');
  if(/^\/club-admin\/(finance|payments|receipts|expenses|income|memberships|ledger|reports)(\/|$|\?)/.test(p))return'finance';
  if(/^\/club-admin\/(constitution|workqueue|applications|membership|members|documents|minutes|decisions)(\/|$|\?)/.test(p))return'secretary';
  if(/^\/club-admin\/(system-check|data-quality|service-level|users|settings|security-audit|security-center|backup|release-readiness)(\/|$|\?)/.test(p))return'owner';
  return'common';
}

export function isAllowed(role,area,method='GET'){
  const r=normalizeRole(role),m=String(method||'GET').toUpperCase();
  if(r==='owner')return true;
  if(area==='common')return true;
  if(r==='vice_president')return area==='finance'&&(m==='GET'||m==='HEAD');
  if(r==='secretary'){
    if(area==='secretary')return true;
    if(area==='finance')return m==='GET'||m==='HEAD';
    return false;
  }
  if(r==='finance')return area==='finance';
  return false;
}
