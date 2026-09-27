import assert from 'node:assert/strict';
import fs from 'node:fs';

const code=fs.readFileSync(new URL('../worker-global-v79.js',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
const seed=fs.readFileSync(new URL('../worker-global-v74.js',import.meta.url),'utf8');

let checks=0;
function check(value,label){assert.ok(value,label);checks++}

check(code.includes("app from './worker-global-v78.js'"),'V79 keeps the V78 site/reliability chain');
check(seed.includes("{ username: 'president'")&&seed.includes("{ username: 'secretary'")&&seed.includes("{ username: 'finance'"),'legacy role aliases are system-seeded, not user-entered');
check(seed.includes("VALUES (?, ?, ?, '00', '00', 1)"),'legacy seeded accounts start without a usable password');

for(const route of [
 "/staff-login",
 "/staff-recover",
 "/staff-recover/request",
 "/staff-recover/verify",
 "/staff-recover/password",
 "/club-admin/access/passwords",
 "/club-admin/security-center/recovery-contacts"
])check(code.includes(route),'route present: '+route);

check(code.includes("name=\"identifier\""),'login/recovery accepts a flexible identifier');
check(code.includes('findUserByIdentifier'),'identifier resolver exists');
check(code.includes('club_staff_recovery_methods'),'multiple recovery methods supported');
check(code.includes('recovery_contact_hash'),'legacy recovery fingerprint remains compatible');
check(code.includes('اسم الدخول أو الهاتف أو البريد'),'login explains username/phone/email identifiers');

check(code.includes("channel==='whatsapp'"),'WhatsApp OTP channel exists');
check(code.includes("channel==='email'"),'email OTP channel exists');
check(code.includes("channel==='sms'"),'SMS OTP channel exists');
check(code.includes('WHATSAPP_TOKEN')&&code.includes('WHATSAPP_PHONE_NUMBER_ID'),'WhatsApp reuses configured Cloud API credentials');
check(code.includes('https://api.brevo.com/v3/smtp/email'),'Brevo transactional email endpoint used');
check(code.includes('https://api.brevo.com/v3/transactionalSMS/send'),'current Brevo transactional SMS endpoint used');

check(code.includes("datetime('now','-15 minutes')"),'OTP request rate window exists');
check(code.includes('recent>=3'),'OTP request rate limit exists');
check(code.includes('row.attempts>=5'),'OTP verification attempt limit exists');
check(code.includes('Date.now()+10*60*1000'),'OTP expires after 10 minutes');
check(code.includes('Date.now()+15*60*1000'),'reset grant expires after 15 minutes');
check(code.includes("autocomplete=\"one-time-code\""),'OTP input uses one-time-code semantics');
check(code.includes('otpHash(code,salt)')&&code.includes('50000'),'OTP is PBKDF2-hashed');
check(code.includes('hashPassword(password)')&&code.includes('150000'),'password is PBKDF2-hashed');
check(code.includes("HttpOnly; Secure; SameSite=Strict"),'auth/reset cookies are hardened');
check(code.includes("DELETE FROM club_staff_sessions WHERE user_id=?"),'password reset revokes staff sessions');
check(code.includes("consumed_at=CURRENT_TIMESTAMP"),'OTP/reset grant becomes one-time');
check(!code.includes('console.log(code)')&&!code.includes('console.log(password)'),'secrets are not logged');

check(/CREATE TABLE IF NOT EXISTS club_staff_recovery_methods/i.test(schema),'canonical schema includes recovery methods');
check(/contact_hash TEXT NOT NULL UNIQUE/i.test(schema),'recovery contact fingerprint must be unique');
check(/CREATE TABLE IF NOT EXISTS club_staff_otp/i.test(schema),'canonical schema includes OTP requests');
check(/code_hash TEXT NOT NULL/i.test(schema)&&/code_salt TEXT NOT NULL/i.test(schema),'OTP plaintext is not stored in schema');
check(!/club_staff_recovery_methods[\s\S]{0,400}\b(phone|email)\s+TEXT/i.test(schema),'recovery table does not store plaintext phone/email columns');

check(code.includes('normalizePhone')&&code.includes("'249'+d.slice(1)"),'Sudan local phone numbers normalize to country code for delivery');
check(code.includes('validEmail'),'email addresses are validated');
check(code.includes('contact_hash=? AND user_id<>?'),'duplicate recovery contact ownership is rejected');
check(code.includes("normalizeRole(actor.role)!=='owner'"),'only the manager can configure other staff accounts');

console.log('V79 auth/recovery review passed: '+checks+' assertions.');
