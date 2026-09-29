// Real application chain + SQLite. Only QR rendering is stubbed here;
// runtime.e2e.mjs separately exercises the compiled worker and real QR package.
import {DatabaseSync} from 'node:sqlite';
import {SourceTextModule,SyntheticModule} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {pbkdf2Sync} from 'node:crypto';
export const ORIGIN='https://members.shamsphone.net';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modules=new Map();
async function load(file){
  file=path.resolve(file);
  if(!modules.has(file))modules.set(file,readFile(file,'utf8').then(s=>new SourceTextModule(s,{identifier:file})));
  return modules.get(file);
}
const qr=new SyntheticModule(['default'],function(){this.setExport('default',{toString:async url=>'<svg data-test-url="'+url+'"></svg>'});});
const main=await load(root+'/src/index.js');
await main.link(async(spec,ref)=>{
  if(spec==='qrcode')return qr;
  if(spec.startsWith('node:')){const builtin=await import(spec);return new SyntheticModule(Object.keys(builtin),function(){for(const k of Object.keys(builtin))this.setExport(k,builtin[k])});}
  return load(path.resolve(path.dirname(ref.identifier),spec));
});
await main.evaluate();
export const worker=main.namespace.default;
export async function fixture(t,{schema=false}={}){
  const sql=new DatabaseSync(':memory:');
  if(schema)sql.exec(await readFile(root+'/schema.sql','utf8'));
  const tasks=[],calls=[];
  function prepare(q,args=[]){return {q,args,bind(...a){return prepare(q,a)},
    async first(){calls.push(q);return sql.prepare(q).get(...args)||null},
    async all(){calls.push(q);return {results:sql.prepare(q).all(...args)}},
    async run(){calls.push(q);const r=sql.prepare(q).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}}}
  }}
  let tail=Promise.resolve();
  const db={prepare,async batch(statements){
    const previous=tail;let release;tail=new Promise(r=>release=r);await previous;
    sql.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}finally{release()}
  },async exec(q){sql.exec(q)}};
  const env={DB:db,APP_ORIGIN:ORIGIN,WHATSAPP_MODE:'disabled'};
  const ctx={waitUntil(task){tasks.push(task)}};
  async function drain(){while(tasks.length)await Promise.allSettled(tasks.splice(0));}
  async function call(p,{method='GET',body,cookie='',origin=ORIGIN}={}){
    const headers={cookie};if(origin!==null)headers.origin=origin;
    const res=await worker.fetch(new Request(ORIGIN+p,{method,headers,body:body?new URLSearchParams(body):undefined}),env,ctx);
    const text=await res.text();await drain();return {res,text};
  }
  t.after(async()=>{await drain();sql.close()});
  await call('/membership');await call('/staff-login');
  function staff(role='secretary',{active=1,expires=new Date(Date.now()+3600000).toISOString()}={}){
    const salt='00112233445566778899aabbccddeeff';
    const hash=pbkdf2Sync('FixtureOnly-2026',Buffer.from(salt,'hex'),150000,32,'sha256').toString('hex');
    const username=role+'-'+Math.random().toString(16).slice(2);
    const r=sql.prepare('INSERT INTO club_staff_users(username,full_name,role,password_hash,password_salt,is_active) VALUES(?,?,?,?,?,?)').run(username,'Fixture only',role,hash,salt,active);
    const token='fixture-'+r.lastInsertRowid;
    sql.prepare('INSERT INTO club_staff_sessions(token,user_id,expires_at) VALUES(?,?,?)').run(token,Number(r.lastInsertRowid),expires);
    return {cookie:'club_sid='+token,username,id:Number(r.lastInsertRowid)};
  }
  const join={full_name:'عضو اختبار غير حقيقي',phone:'249912000001',birth_date:'1990-01-01',address:'TEST ONLY',occupation:'TEST',membership_type:'عضو',consent:'1'};
  return {sql,db,calls,env,ctx,call,staff,join};
}
