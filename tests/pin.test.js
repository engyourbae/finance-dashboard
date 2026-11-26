'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const vm = require('vm'); const nodeCrypto = require('crypto');

const src = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const a = src.indexOf('const PIN_ITER'); const b = src.indexOf('\n}\n', src.indexOf('async function upgradePin')) + 3;
const profile = { pin: '', txPin: '' };
const ctx = { crypto: nodeCrypto.webcrypto, TextEncoder, window: { crypto: nodeCrypto.webcrypto, isSecureContext: true }, profile, saveProfileLocal() {}, saveProfileToSupabase() {}, console };
vm.createContext(ctx); vm.runInContext(src.slice(a, b) + '\nthis.api={hashPIN,verifyPIN,upgradePin,legacySha256};', ctx);
const { hashPIN, verifyPIN, upgradePin, legacySha256 } = ctx.api;

test('PIN baru: format p2$ bertanda salt, benar lolos, salah gagal', async () => {
  const h = await hashPIN('1234'); const h2 = await hashPIN('1234');
  assert.match(h, /^p2\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.notStrictEqual(h, h2); // salt acak
  assert.ok(await verifyPIN('1234', h)); assert.ok(!(await verifyPIN('1235', h)));
});

test('PIN lama (SHA-256) tetap bisa login lalu otomatis di-upgrade', async () => {
  profile.pin = await legacySha256('4321');
  assert.ok(await verifyPIN('4321', profile.pin)); assert.ok(!(await verifyPIN('0000', profile.pin)));
  await upgradePin('pin', '4321');
  assert.ok(profile.pin.startsWith('p2$')); assert.ok(await verifyPIN('4321', profile.pin));
});

test('stored rusak / iterasi tak wajar ditolak', async () => {
  assert.ok(!(await verifyPIN('1234', 'p2$1$zz$yy')));
  assert.ok(!(await verifyPIN('1234', 'p2$99999999$' + '0'.repeat(32) + '$' + '0'.repeat(64))));
  assert.ok(!(await verifyPIN('', 'x')));
});
