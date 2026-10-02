import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from './fixture.mjs';

test('V83 exposes current discovery metadata and release markers',async t=>{
  const f=await fixture(t,{schema:true});
  let r=await f.call('/health');
  assert.equal(r.res.status,200);
  assert.equal(r.res.headers.get('x-wadnofei-release'),'v83-production-hardening');
  assert.equal(JSON.parse(r.text).release,'v83-production-hardening');

  r=await f.call('/sitemap.xml');
  assert.equal(r.res.status,200);
  for(const path of ['/news','/team','/board','/projects','/gallery','/constitution','/membership']){
    assert.ok(r.text.includes('https://members.shamsphone.net'+path),path);
  }
  assert.ok(!r.text.includes('/club-admin'));

  r=await f.call('/manifest.webmanifest');
  const manifest=JSON.parse(r.text);
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.scope,'/');
  assert.ok(manifest.icons?.[0]?.src.includes('wdn-logo-v42.jpg'));
});

test('V83 approval path is schema-read-only',async()=>{
  const lifecycle=await readFile(new URL('../membership-lifecycle.js',import.meta.url),'utf8');
  assert.doesNotMatch(lifecycle,/ALTER\s+TABLE/i);
  assert.doesNotMatch(lifecycle,/CREATE\s+(?:TABLE|INDEX)/i);
  const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
  for(const field of ['review_stage','member_id','reviewed_at','qr_token','membership_expires_at','provider_status','status_token_hash']){
    assert.ok(schema.includes(field),field);
  }
});
