// Both approval buttons use this transaction. Existing member numbers are preserved.
export async function approveMembership(db, id, actor, note='') {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('INVALID_APPLICATION');
  const appCols = await columns(db,'applications');
  const memberCols = await columns(db,'members');
  for (const [name,type] of [['member_id','INTEGER'],['review_stage','TEXT'],['admin_note','TEXT'],['decided_at','TEXT'],['updated_at','TEXT'],['reviewed_at','TEXT']]) {
    if (!appCols.has(name)) await db.prepare(`ALTER TABLE applications ADD COLUMN ${name} ${type}`).run();
  }
  for (const name of ['qr_token','approved_at','created_at','membership_expires_at','card_issued_at']) {
    if (!memberCols.has(name)) { await db.prepare(`ALTER TABLE members ADD COLUMN ${name} TEXT`).run(); memberCols.add(name); }
  }
  await db.prepare(`CREATE TABLE IF NOT EXISTS club_audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  const ap = await db.prepare('SELECT * FROM applications WHERE id=?').bind(id).first();
  if (!ap) return {status:404, error:'طلب العضوية غير موجود.'};
  if (!['pending','approved'].includes(ap.status)) return {status:409,error:'لا يمكن اعتماد طلب مرفوض من مسار إصدار البطاقة.'};
  const linked = (await db.prepare('SELECT * FROM members WHERE application_id=? OR id=?').bind(id,Number(ap.member_id || 0)).all()).results;
  if (linked.length > 1 || (linked[0]?.application_id && Number(linked[0].application_id)!==id)) return {status:409,error:'توجد روابط عضوية متعارضة؛ يلزم مراجعتها دون حذف أي سجل.'};
  if (ap.status === 'approved' && !linked.length) return {status:409,error:'طلب معتمد دون سجل عضوية مرتبط؛ يلزم مراجعته قبل إصدار رقم آخر.'};
  // Existing duplicates stop approval. Never delete or merge personal data automatically.
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS wdn_one_member_per_application ON members(application_id) WHERE application_id IS NOT NULL').run();
  const token = crypto.randomUUID().replaceAll('-','');
  const temporary = 'WDN-TMP-' + token;
  const now = new Date().toISOString();
  const expiry = new Date(); expiry.setFullYear(expiry.getFullYear()+1);
  const values = {
    member_no:temporary, full_name:ap.full_name, phone:ap.phone || '',
    birth_date:ap.birth_date || ap.dob || '', address:ap.address || '',
    occupation:ap.occupation || ap.job || '', membership_type:ap.membership_type || ap.member_type || '',
    status:'active', joined_at:now, application_id:id, qr_token:token,
    approved_at:now, created_at:now, membership_expires_at:expiry.toISOString(), card_issued_at:now,
    name:ap.full_name, dob:ap.birth_date || ap.dob || '', job:ap.occupation || ap.job || '',
    member_type:ap.membership_type || ap.member_type || '', photo_key:ap.photo_key || null, notes:ap.notes || ''
  };
  const names = Object.keys(values).filter(name=>memberCols.has(name));
  const statements = [
    db.prepare(`UPDATE members SET application_id=? WHERE id=? AND (application_id IS NULL OR application_id=?)`).bind(id,Number(ap.member_id||0),id),
    db.prepare(`INSERT INTO members(${names.join(',')}) SELECT ${names.map(()=>'?').join(',')} FROM applications a WHERE a.id=? AND a.status='pending' AND NOT EXISTS(SELECT 1 FROM members WHERE application_id=a.id)`)
      .bind(...names.map(name=>values[name]),id),
    db.prepare(`UPDATE members SET member_no='WDN-'||printf('%05d',id) WHERE member_no=? AND application_id=?`).bind(temporary,id),
    db.prepare(`UPDATE members SET qr_token=COALESCE(NULLIF(qr_token,''),?),approved_at=COALESCE(approved_at,?),card_issued_at=COALESCE(card_issued_at,?) WHERE application_id=?`).bind(token,now,now,id),
    db.prepare(`UPDATE applications SET member_id=(SELECT id FROM members WHERE application_id=?),status='approved',review_stage='approved',admin_note=?,decided_at=COALESCE(decided_at,?),reviewed_at=COALESCE(reviewed_at,?),updated_at=? WHERE id=? AND status IN ('pending','approved') AND EXISTS(SELECT 1 FROM members WHERE application_id=?)`).bind(id,note,now,now,now,id,id),
    db.prepare(`INSERT INTO club_audit_log(actor,action,entity_type,entity_id,details) SELECT ?,'approve','application',?,'Membership linked; member number preserved' WHERE NOT EXISTS(SELECT 1 FROM club_audit_log WHERE action='approve' AND entity_type='application' AND entity_id=?)`).bind(actor.username,String(id),String(id))
  ];
  await db.batch(statements);
  const member = await db.prepare('SELECT id,member_no,qr_token,status,membership_expires_at FROM members WHERE application_id=?').bind(id).first();
  if (!member?.qr_token) throw new Error('APPROVAL_NOT_COMMITTED');
  return {status:200, member, changed:ap.status!=='approved'};
}
async function columns(db,table) {
  return new Set((await db.prepare(`PRAGMA table_info(${table})`).all()).results.map(x=>x.name));
}
