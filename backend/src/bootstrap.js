import fs from 'node:fs/promises';

const sourceUrl=new URL('./server-v8.js',import.meta.url);
let source=await fs.readFile(sourceUrl,'utf8');

const helpRoutes=String.raw`
app.post('/api/public/help-requests',publicWriteLimit,asyncRoute(async(req,res)=>{
  const d=z.object({
    fullName:z.string().min(2).max(160),
    phone:z.string().min(5).max(40),
    location:z.string().min(2).max(160),
    caseType:z.string().min(2).max(100),
    description:z.string().min(10).max(4000),
    requestedAmount:z.union([z.coerce.number().nonnegative(),z.literal(''),z.null()]).optional(),
    currency:z.enum(['SDG','SAR','USD']).default('SDG')
  }).parse(req.body);
  const sequenceResult=await pool.query("SELECT nextval('help_request_number_seq') AS n");
  const trackingNumber='BN-'+new Date().getFullYear()+'-'+String(sequenceResult.rows[0].n).padStart(6,'0');
  const amount=d.requestedAmount===''||d.requestedAmount===null||d.requestedAmount===undefined?null:d.requestedAmount;
  const result=await pool.query(
    'INSERT INTO help_requests(tracking_number,full_name,phone,location,case_type,description,requested_amount,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,tracking_number,status,created_at',
    [trackingNumber,d.fullName,d.phone,d.location,d.caseType,d.description,amount,d.currency]
  );
  res.status(201).json(result.rows[0]);
}));

app.get('/api/help-requests',auth,asyncRoute(async(_req,res)=>{
  const result=await pool.query('SELECT * FROM help_requests ORDER BY created_at DESC LIMIT 500');
  res.json(result.rows);
}));

app.patch('/api/help-requests/:id',auth,allow('admin','manager','staff'),asyncRoute(async(req,res)=>{
  const d=z.object({
    status:z.enum(['new','review','approved','rejected','completed']).optional(),
    adminNotes:z.string().max(4000).optional()
  }).parse(req.body);
  const sets=[];
  const values=[];
  if(d.status){values.push(d.status);sets.push('status=$'+values.length);}
  if(Object.hasOwn(d,'adminNotes')){values.push(d.adminNotes||null);sets.push('admin_notes=$'+values.length);}
  if(!sets.length)return res.status(400).json({error:'لا توجد تغييرات صالحة'});
  values.push(req.params.id);
  const result=await pool.query('UPDATE help_requests SET '+sets.join(',')+',updated_at=now() WHERE id=$'+values.length+' RETURNING *',values);
  if(!result.rows[0])return res.status(404).json({error:'الطلب غير موجود'});
  await audit(req,'update','help_requests',req.params.id,req.body);
  res.json(result.rows[0]);
}));
`;

const marker="app.get('/api/dashboard',auth";
if(!source.includes(marker))throw new Error('Help request route insertion point was not found');
source=source.replace(marker,helpRoutes+'\n'+marker);
source=source.replaceAll("version:'8.0.0'","version:'8.1.0'").replaceAll('BUNYAN Cloud API 8.0.0','BUNYAN Cloud API 8.1.0');

const runtimeUrl=new URL('./.server-v8-help-runtime.mjs',import.meta.url);
await fs.writeFile(runtimeUrl,source,'utf8');
await import(runtimeUrl.href+'?v='+Date.now());
