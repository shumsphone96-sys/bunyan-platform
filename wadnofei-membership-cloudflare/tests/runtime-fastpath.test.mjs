import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
async function text(name){return readFile(new URL(name,root),'utf8')}

test('production config disables legacy request-time schema bootstrap',async()=>{
  for(const name of ['wrangler.jsonc']){
    const s=await text(name);
    assert.match(s,/"RUNTIME_SCHEMA_BOOTSTRAP"\s*:\s*"off"/);
  }
});

test('legacy request bootstraps are guarded in production',async()=>{
  const checks={
    'worker-global-v3.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await init\(env\.DB\)/,
    'worker-global-v5.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensureV5\(env\.DB\)/,
    'worker-global-v7.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensureV7\(env\.DB\)/,
    'worker-global-v9.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await init\(env\.DB\)/,
    'worker-global-v12.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await init\(env\.DB\)/,
    'worker-global-v13.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await init\(env\.DB\)/,
    'worker-global-v14.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await init\(env\.DB\)/,
    'worker-global-v15.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await init\(env\.DB\)/,
    'worker-global-v22.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensureNotifications\(env\.DB\)/,
    'worker-global-v23.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensureNotifications\(env\.DB\)/,
    'worker-global-v43.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await init\(env\.DB\)/,
    'worker-global-v62.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v63.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v65.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v66.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v67.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v68.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v71.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v72.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v73.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensure\(env\.DB\)/,
    'worker-global-v74.js':/RUNTIME_SCHEMA_BOOTSTRAP!=='off'\) await ensureStaffReady\(env\.DB\)/,
    'worker-global-v82.js':/env\.RUNTIME_SCHEMA_BOOTSTRAP!=='off'.*\/membership/
  };
  for(const [name,re] of Object.entries(checks)){
    const s=await text(name);
    assert.match(s,re,name);
  }
});

test('V83 does not verify release schema on every normal request',async()=>{
  const s=await text('worker-global-v83.js');
  assert.doesNotMatch(s,/p!=='\/health'[\s\S]{0,220}ensureReleaseSchema\(env\.DB\)/);
  assert.match(s,/runtime_bootstrap:env\.RUNTIME_SCHEMA_BOOTSTRAP\|\|'on'/);
  assert.match(s,/x-wadnofei-runtime/);
});
