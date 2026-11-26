'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { build, validate } = require('../scripts/build.js');
const { scan } = require('../scripts/check-secrets.js');

// Semua nilai uji dibuat saat runtime (tidak ada literal kunci di file ini).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.${'s'.repeat(30)}`;
const URL_OK = 'https://' + 'abcdefghijklmnopqrst' + '.supabase.co';

test('validate: anon key + URL benar diterima', () => {
  const v = validate({ SUPABASE_URL: URL_OK + '/', SUPABASE_ANON_KEY: jwt('anon') });
  assert.strictEqual(v.origin, URL_OK); assert.strictEqual(v.host, 'abcdefghijklmnopqrst.supabase.co');
});

test('validate: service_role/secret key DITOLAK (tidak boleh masuk bundel browser)', () => {
  assert.throws(() => validate({ SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: jwt('service_role') }), /service_role/);
  assert.throws(() => validate({ SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: 'sb_secret_' + 'x'.repeat(20) }), /secret/i);
});

test('validate: input rusak ditolak', () => {
  assert.throws(() => validate({}), /wajib/);
  assert.throws(() => validate({ SUPABASE_URL: 'http://a.supabase.co', SUPABASE_ANON_KEY: jwt('anon') }));
  assert.throws(() => validate({ SUPABASE_URL: 'https://evil.example.com', SUPABASE_ANON_KEY: jwt('anon') }));
  assert.throws(() => validate({ SUPABASE_URL: URL_OK + '/rest/v1', SUPABASE_ANON_KEY: jwt('anon') }));
  assert.throws(() => validate({ SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: 'bukan-jwt' }));
});

test('build: config.js dibuat, CSP dikunci ke host project, tanpa placeholder', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
  build({ SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: jwt('anon') }, out);
  const cfg = fs.readFileSync(path.join(out, 'js/config.js'), 'utf8');
  assert.ok(cfg.includes(URL_OK));
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.ok(!html.includes('__SUPABASE_'));
  assert.match(html, /connect-src 'self' https:\/\/abcdefghijklmnopqrst\.supabase\.co wss:\/\/abcdefghijklmnopqrst\.supabase\.co/);
  assert.ok(!/img-src[^;]*\*\.supabase/.test(html) && !/connect-src[^;]*\*/.test(html));
  assert.ok(fs.existsSync(path.join(out, 'sw.js')) && fs.existsSync(path.join(out, '.nojekyll')));
});

test('check-secrets: mendeteksi JWT, URL project, js/config.js; direktori bersih lolos', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
  fs.writeFileSync(path.join(d, 'ok.js'), 'const a = 1;\n');
  assert.strictEqual(scan(d).length, 0);
  fs.writeFileSync(path.join(d, 'bad.js'), `const k = "${jwt('anon')}";\nfetch("${URL_OK}");\n`);
  fs.mkdirSync(path.join(d, 'js')); fs.writeFileSync(path.join(d, 'js/config.js'), 'x');
  const kinds = scan(d).map((r) => r[2]).join('|');
  assert.match(kinds, /JWT/); assert.match(kinds, /URL project/); assert.match(kinds, /config\.js/);
});

test('repo sebenarnya bersih dari secret', () => {
  assert.deepStrictEqual(scan(), []);
});
