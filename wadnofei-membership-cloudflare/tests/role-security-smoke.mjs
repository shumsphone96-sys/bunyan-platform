import fs from 'node:fs';
import assert from 'node:assert/strict';
import {normalizeRole,classifyAdminPath,isAllowed} from '../role-policy.js';

assert.equal(normalizeRole('finance_manager'),'finance');
assert.equal(normalizeRole('secretary'),'secretary');
assert.equal(normalizeRole('president'),'owner');
assert.equal(normalizeRole('vice_president'),'vice_president');

assert.equal(isAllowed('finance_manager','finance','POST'),true);
assert.equal(isAllowed('finance_manager','secretary','GET'),false);
assert.equal(isAllowed('secretary','finance','GET'),true);
assert.equal(isAllowed('secretary','finance','POST'),false);
assert.equal(isAllowed('secretary','secretary','POST'),true);
assert.equal(isAllowed('vice_president','finance','GET'),true);
assert.equal(isAllowed('vice_president','finance','POST'),false);
assert.equal(isAllowed('president','owner','POST'),true);

assert.equal(classifyAdminPath('/club-admin/finance'),'finance');
assert.equal(classifyAdminPath('/club-admin/constitution'),'secretary');
assert.equal(classifyAdminPath('/club-admin/security-center'),'owner');
assert.equal(classifyAdminPath('/club-admin'),'common');

const v68=fs.readFileSync(new URL('../worker-global-v68.js',import.meta.url),'utf8');
const v69=fs.readFileSync(new URL('../worker-global-v69.js',import.meta.url),'utf8');
const v71=fs.readFileSync(new URL('../worker-global-v71.js',import.meta.url),'utf8');
const v72=fs.readFileSync(new URL('../worker-global-v72.js',import.meta.url),'utf8');
const v73=fs.readFileSync(new URL('../worker-global-v73.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');

assert.match(v68,/club_sid/);
assert.match(v69,/club_sid/);
assert.match(v69,/allowed\(user\.role,area,m\)/);
assert.match(v69,/function allowed\(role,area,method\)\{return isAllowed\(role,area,method\)\}/);
assert.match(v71,/last4/);
assert.match(v71,/maskName/);
assert.doesNotMatch(v71,/DELETE\s+FROM\s+(members|applications)/i);
assert.match(v72,/recovery_contact_hash/);
assert.match(v72,/DELETE FROM club_staff_sessions WHERE user_id=\?/);
assert.match(v73,/release-readiness/);
assert.match(index,/worker-global-v73\.js/);

console.log('Role/security/privacy smoke tests passed.');
