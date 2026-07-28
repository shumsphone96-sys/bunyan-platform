import fs from 'node:fs/promises';

const sourceUrl=new URL('./server-v8.js',import.meta.url);
let source=await fs.readFile(sourceUrl,'utf8');

source=source.replaceAll("version:'8.0.0'","version:'9.0.0'").replaceAll('BUNYAN Cloud API 8.0.0','BUNYAN Cloud API 9.0.0');
source=source.replace(
  "SELECT id,title,amount,currency,spent_at,category,notes FROM project_expenses WHERE project_id=$1 AND is_public=true ORDER BY spent_at DESC",
  "SELECT id,title,amount,currency,spent_at,category,notes,status,verified_at FROM project_expenses WHERE project_id=$1 AND is_public=true AND status='verified' ORDER BY spent_at DESC"
);
source=source.replace(
  "expenses:{table:'project_expenses',fields:['project_id','title','amount','currency','spent_at','category','notes','is_public']}",
  "expenses:{table:'project_expenses',fields:['project_id','title','amount','currency','spent_at','category','notes','is_public','status']}"
);

const transparencyRoute=`\napp.get('/api/public/transparency',asyncRoute(async(_req,res)=>{\n  const [donations,expenses,lastDonation,lastExpense]=await Promise.all([\n    pool.query(\"SELECT currency,coalesce(sum(amount),0) amount,count(*)::int count FROM donations WHERE status='verified' GROUP BY currency ORDER BY currency\"),\n    pool.query(\"SELECT currency,coalesce(sum(amount),0) amount,count(*)::int count FROM project_expenses WHERE status='verified' AND is_public=true GROUP BY currency ORDER BY currency\"),\n    pool.query(\"SELECT verified_at,created_at FROM donations WHERE status='verified' ORDER BY coalesce(verified_at,created_at) DESC LIMIT 1\"),\n    pool.query(\"SELECT verified_at,created_at FROM project_expenses WHERE status='verified' AND is_public=true ORDER BY coalesce(verified_at,created_at) DESC LIMIT 1\")\n  ]);\n  const donationTotals=Object.fromEntries(donations.rows.map(x=>[x.currency,Number(x.amount)]));\n  const expenseTotals=Object.fromEntries(expenses.rows.map(x=>[x.currency,Number(x.amount)]));\n  const currencies=[...new Set([...Object.keys(donationTotals),...Object.keys(expenseTotals)])];\n  const balances=Object.fromEntries(currencies.map(c=>[c,(donationTotals[c]||0)-(expenseTotals[c]||0)]));\n  const dates=[lastDonation.rows[0]?.verified_at||lastDonation.rows[0]?.created_at,lastExpense.rows[0]?.verified_at||lastExpense.rows[0]?.created_at].filter(Boolean).sort((a,b)=>new Date(b)-new Date(a));\n  res.json({donations:donationTotals,expenses:expenseTotals,balances,donationCount:donations.rows.reduce((s,x)=>s+x.count,0),expenseCount:expenses.rows.reduce((s,x)=>s+x.count,0),updatedAt:dates[0]||null});\n}));\n`;
source=source.replace("app.get('/api/public/receipts/verify/:token'",transparencyRoute+"\napp.get('/api/public/receipts/verify/:token'");

source=source.replace(
  "if(req.params.resource==='donations'&&req.body.status==='verified')await pool.query('UPDATE donations SET verified_at=now(),verified_by=$1 WHERE id=$2',[req.user.sub,req.params.id]);",
  "if(req.params.resource==='donations'&&req.body.status==='verified')await pool.query('UPDATE donations SET verified_at=now(),verified_by=$1 WHERE id=$2',[req.user.sub,req.params.id]);if(req.params.resource==='expenses'){if(req.body.status==='verified')await pool.query('UPDATE project_expenses SET verified_at=now(),verified_by=$1 WHERE id=$2',[req.user.sub,req.params.id]);if(req.body.status&&req.body.status!=='verified')await pool.query('UPDATE project_expenses SET verified_at=null,verified_by=null WHERE id=$1',[req.params.id]);}"
);

const runtimeUrl=new URL('./.server-v9-runtime.mjs',import.meta.url);
await fs.writeFile(runtimeUrl,source,'utf8');
await import(runtimeUrl.href+`?v=${Date.now()}`);
