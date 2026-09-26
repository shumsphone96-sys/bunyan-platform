export function normalizeRole(role){
  const r=String(role||'').toLowerCase();
  // The president/legacy admin account is the supervisory manager account.
  if(['owner','superadmin','admin','president'].includes(r))return'owner';
  if(['secretary','secretariat','scretary'].includes(r))return'secretary';
  if(['finance_manager','treasurer','finance','amin_mal'].includes(r))return'finance';
  if(['vice_president','vice-president'].includes(r))return'limited';
  return'limited';
}

export function classifyAdminPath(path){
  const p=String(path||'').split('?')[0].replace(/\/$/,'')||'/';

  // Shared personal pages only.
  if(['/club-admin','/club-admin/my-workspace','/club-admin/security'].includes(p))return'common';

  // Finance owns financial work end-to-end.
  if(/^\/club-admin\/(finance|payments|receipts|expenses|income|memberships|ledger|reports)(\/|$)/.test(p))return'finance';

  // Secretariat owns correspondence, membership processing and club documents.
  if(/^\/club-admin\/(constitution|workqueue|applications|membership-center|membership|members|documents|minutes|decisions|content|public)(\/|$)/.test(p))return'secretary';

  // Oversight and system administration are manager-only. Unknown admin routes
  // also fail closed to the manager instead of leaking into another role.
  if(/^\/club-admin\/(access|backup|system-check|data-quality|service-level|users|settings|security-audit|security-center|command-center|release-readiness|overview|operations)(\/|$)/.test(p))return'owner';
  return'owner';
}

export function isAllowed(role,area,method='GET'){
  const r=normalizeRole(role);
  if(r==='owner')return true;
  if(area==='common')return true;
  if(r==='secretary')return area==='secretary';
  if(r==='finance')return area==='finance';
  return false;
}
