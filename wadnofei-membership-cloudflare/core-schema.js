const checked = new WeakMap();
const statements = [
  "CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,password_hash TEXT,must_change INTEGER DEFAULT 1)",
  "CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,admin_id INTEGER,expires_at TEXT)",
  "CREATE TABLE IF NOT EXISTS applications(id INTEGER PRIMARY KEY AUTOINCREMENT,application_no TEXT UNIQUE,full_name TEXT,phone TEXT,birth_date TEXT,address TEXT,occupation TEXT,membership_type TEXT,notes TEXT,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,decided_at TEXT)",
  "CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY AUTOINCREMENT,member_no TEXT UNIQUE,full_name TEXT,phone TEXT,birth_date TEXT,address TEXT,occupation TEXT,membership_type TEXT,status TEXT DEFAULT 'active',joined_at TEXT DEFAULT CURRENT_TIMESTAMP,application_id INTEGER)",
  "CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER,amount REAL,payment_type TEXT,payment_method TEXT,receipt_no TEXT,notes TEXT,paid_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS activities(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,category TEXT,event_date TEXT,status TEXT DEFAULT 'مخطط',details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,doc_type TEXT,reference_no TEXT,doc_date TEXT,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS news(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER,action TEXT,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status)",
  "CREATE INDEX IF NOT EXISTS idx_members_no ON members(member_no)",
  "CREATE INDEX IF NOT EXISTS idx_pay_member ON payments(member_id)"
];
export async function ensureCore(db) {
  if (!checked.has(db)) checked.set(db, (async () => {
    await db.batch(statements.map(sql => db.prepare(sql)));
    for (const [table, required] of [['applications',['application_no','full_name']], ['members',['member_no','full_name','application_id']]]) {
      const cols=(await db.prepare(`PRAGMA table_info(${table})`).all()).results.map(x=>x.name);
      if(required.some(c=>!cols.includes(c))) throw new Error('Membership schema requires reviewed migration');
    }
  })().catch(error=>{checked.delete(db);throw error}));
  return checked.get(db);
}
