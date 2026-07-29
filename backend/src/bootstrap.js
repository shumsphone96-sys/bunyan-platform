import fs from 'node:fs/promises';

const sourceUrl=new URL('./server-v8.js',import.meta.url);
let source=await fs.readFile(sourceUrl,'utf8');

source=source.replaceAll("version:'8.0.0'","version:'10.3.1'").replaceAll('BUNYAN Cloud API 8.0.0','BUNYAN Cloud API 10.3.1');
source=source.replace(
  "app.use('/api/',rateLimit({windowMs:15*60*1000,limit:400,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'طلبات كثيرة. حاول لاحقاً.'}}));",
  "app.use('/api/',rateLimit({windowMs:15*60*1000,limit:1200,skip:req=>req.method==='GET'||req.method==='HEAD'||req.method==='OPTIONS',standardHeaders:'draft-7',legacyHeaders:false,message:{error:'طلبات كثيرة. حاول بعد دقائق.'}}));"
);
source=source.replace(
  "pool.query('SELECT id,title,amount,currency,spent_at,category,notes FROM project_expenses WHERE project_id=$1 AND is_public=true ORDER BY spent_at DESC',[id])",
  "pool.query(\"SELECT id,title,amount,currency,spent_at,category,notes,status,verified_at FROM project_expenses WHERE project_id=$1 AND is_public=true AND status='verified' ORDER BY spent_at DESC\",[id])"
);
source=source.replace(
  "expenses:{table:'project_expenses',fields:['project_id','title','amount','currency','spent_at','category','notes','is_public']}",
  "expenses:{table:'project_expenses',fields:['project_id','title','amount','currency','spent_at','category','notes','is_public','status']}"
);
source=source.replace("p.cover_image_url,p.created_at","p.cover_image_url,p.location,p.latitude,p.longitude,p.created_at");
source=source.replace("'start_date','end_date','is_public']}","'start_date','end_date','latitude','longitude','is_public']}");

const transparencyRoute=`
app.get('/api/public/transparency',asyncRoute(async(_req,res)=>{
  const [donations,expenses,lastDonation,lastExpense]=await Promise.all([
    pool.query("SELECT currency,coalesce(sum(amount),0) amount,count(*)::int count FROM donations WHERE status='verified' GROUP BY currency ORDER BY currency"),
    pool.query("SELECT currency,coalesce(sum(amount),0) amount,count(*)::int count FROM project_expenses WHERE status='verified' AND is_public=true GROUP BY currency ORDER BY currency"),
    pool.query("SELECT verified_at,created_at FROM donations WHERE status='verified' ORDER BY coalesce(verified_at,created_at) DESC LIMIT 1"),
    pool.query("SELECT verified_at,created_at FROM project_expenses WHERE status='verified' AND is_public=true ORDER BY coalesce(verified_at,created_at) DESC LIMIT 1")
  ]);
  const donationTotals=Object.fromEntries(donations.rows.map(x=>[x.currency,Number(x.amount)]));
  const expenseTotals=Object.fromEntries(expenses.rows.map(x=>[x.currency,Number(x.amount)]));
  const currencies=[...new Set([...Object.keys(donationTotals),...Object.keys(expenseTotals)])];
  const balances=Object.fromEntries(currencies.map(c=>[c,(donationTotals[c]||0)-(expenseTotals[c]||0)]));
  const dates=[lastDonation.rows[0]?.verified_at||lastDonation.rows[0]?.created_at,lastExpense.rows[0]?.verified_at||lastExpense.rows[0]?.created_at].filter(Boolean).sort((a,b)=>new Date(b)-new Date(a));
  res.json({donations:donationTotals,expenses:expenseTotals,balances,donationCount:donations.rows.reduce((s,x)=>s+x.count,0),expenseCount:expenses.rows.reduce((s,x)=>s+x.count,0),updatedAt:dates[0]||null});
}));
`;
source=source.replace("app.get('/api/public/receipts/verify/:token'",transparencyRoute+"\napp.get('/api/public/receipts/verify/:token'");

source=source.replace(
  "if(req.params.resource==='donations'&&req.body.status==='verified')await pool.query('UPDATE donations SET verified_at=now(),verified_by=$1 WHERE id=$2',[req.user.sub,req.params.id]);",
  "if(req.params.resource==='donations'&&req.body.status==='verified')await pool.query('UPDATE donations SET verified_at=now(),verified_by=$1 WHERE id=$2',[req.user.sub,req.params.id]);if(req.params.resource==='expenses'){if(req.body.status==='verified')await pool.query('UPDATE project_expenses SET verified_at=now(),verified_by=$1 WHERE id=$2',[req.user.sub,req.params.id]);if(req.body.status&&req.body.status!=='verified')await pool.query('UPDATE project_expenses SET verified_at=null,verified_by=null WHERE id=$1',[req.params.id]);}"
);

const helpRequestRoutes=`
app.post('/api/public/help-requests',publicWriteLimit,asyncRoute(async(req,res)=>{
  const d=z.object({
    fullName:z.string().min(2).max(160),
    phone:z.string().min(5).max(40),
    location:z.string().min(2).max(160),
    caseType:z.string().min(2).max(100),
    description:z.string().min(10).max(4000),
    requestedAmount:z.coerce.number().nonnegative().optional(),
    currency:z.enum(['SDG','SAR','USD']).default('SDG')
  }).parse(req.body);
  const seq=(await pool.query("SELECT nextval('help_request_number_seq') n")).rows[0].n;
  const tracking='BN-'+new Date().getFullYear()+'-'+String(seq).padStart(6,'0');
  const {rows}=await pool.query(
    'INSERT INTO help_requests(tracking_number,full_name,phone,location,case_type,description,requested_amount,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,tracking_number,status,created_at',
    [tracking,d.fullName,d.phone,d.location,d.caseType,d.description,d.requestedAmount||null,d.currency]
  );
  res.status(201).json(rows[0]);
}));

app.get('/api/help-requests',auth,asyncRoute(async(_req,res)=>{
  const {rows}=await pool.query('SELECT * FROM help_requests ORDER BY created_at DESC LIMIT 500');
  res.json(rows);
}));

app.patch('/api/help-requests/:id',auth,allow('admin','manager','staff'),asyncRoute(async(req,res)=>{
  const d=z.object({status:z.enum(['new','review','approved','rejected','completed']).optional(),adminNotes:z.string().max(4000).optional()}).parse(req.body);
  const sets=[],values=[];
  if(d.status){values.push(d.status);sets.push('status=$'+values.length)}
  if(Object.hasOwn(d,'adminNotes')){values.push(d.adminNotes||null);sets.push('admin_notes=$'+values.length)}
  if(!sets.length)return res.status(400).json({error:'لا توجد تغييرات صالحة'});
  values.push(req.params.id);
  const {rows}=await pool.query('UPDATE help_requests SET '+sets.join(',')+',updated_at=now() WHERE id=$'+values.length+' RETURNING *',values);
  if(!rows[0])return res.status(404).json({error:'الطلب غير موجود'});
  await audit(req,'update','help_requests',req.params.id,req.body);
  res.json(rows[0]);
}));
`;
source=source.replace("app.get('/api/dashboard',auth",helpRequestRoutes+"\napp.get('/api/dashboard',auth");

const adminBootstrap=`
async function ensureEnvironmentAdmin(){
  const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  const password=String(process.env.ADMIN_PASSWORD||'');
  const name=String(process.env.ADMIN_NAME||'مدير بُنْيَان').trim();
  if(!password){console.log('Permanent admin synchronization skipped; one-time reset remains available');return;}
  if(!email)throw new Error('ADMIN_EMAIL must be configured when ADMIN_PASSWORD is used');
  if(password.length<10)throw new Error('ADMIN_PASSWORD must contain at least 10 characters');
  const passwordHash=await bcrypt.hash(password,12);
  const existing=await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]);
  if(existing.rows[0]){
    await pool.query("UPDATE users SET name=$1,email=$2,password_hash=$3,role='admin',is_active=true,updated_at=now() WHERE id=$4",[name,email,passwordHash,existing.rows[0].id]);
    console.log('Environment admin account synchronized');
    return;
  }
  await pool.query("INSERT INTO users(name,email,password_hash,role,is_active) VALUES($1,$2,$3,'admin',true)",[name,email,passwordHash]);
  console.log('Environment admin account created');
}
await ensureEnvironmentAdmin();
`;
source=source.replace("app.listen(port,()=>console.log(`BUNYAN Cloud API 8.0.0 listening on ${port}`));",adminBootstrap+"\napp.listen(port,()=>console.log(`BUNYAN Cloud API 10.3.1 listening on ${port}`));");

const runtimeUrl=new URL('./.server-v10-runtime.mjs',import.meta.url);
await fs.writeFile(runtimeUrl,source,'utf8');
await import(runtimeUrl.href+`?v=${Date.now()}`);