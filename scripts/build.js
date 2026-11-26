'use strict';
// Membuat folder dist/ untuk GitHub Pages. Kunci dibaca dari environment (GitHub Secrets saat Actions;
// .env/ekspor shell saat lokal) dan disuntikkan ke dist/js/config.js. Tidak pernah ditulis ke repo.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const COPY = ['index.html', 'sw.js', 'manifest.json', 'css', 'js', 'assets'];

function jwtRole(key) {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role; } catch (_) { return null; }
}

function validate(env) {
  const url = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) throw new Error('SUPABASE_URL dan SUPABASE_ANON_KEY wajib diisi (GitHub > Settings > Secrets and variables > Actions).');
  let u; try { u = new URL(url); } catch (_) { throw new Error('SUPABASE_URL bukan URL yang valid.'); }
  if (u.protocol !== 'https:' || !/\.supabase\.(co|in)$/.test(u.hostname)) throw new Error('SUPABASE_URL harus https://<project>.supabase.co');
  if (u.pathname !== '/' && u.pathname !== '') throw new Error('SUPABASE_URL tidak boleh memuat path.');
  const role = key.startsWith('eyJ') ? jwtRole(key) : (key.startsWith('sb_publishable_') ? 'anon' : null);
  // Pengaman: key admin tidak boleh pernah masuk ke bundel yang dimuat browser.
  if (role === 'service_role' || key.startsWith('sb_secret_')) throw new Error('DITOLAK: ini key service_role/secret. Gunakan anon/publishable key.');
  if (role !== 'anon') throw new Error('SUPABASE_ANON_KEY tidak dikenali sebagai anon/publishable key.');
  return { origin: u.origin, host: u.host, key };
}

function build(env = process.env, out = OUT) {
  const v = validate(env);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of COPY) fs.cpSync(path.join(ROOT, f), path.join(out, f), { recursive: true });
  for (const f of ['js/config.js', 'js/config.example.js']) fs.rmSync(path.join(out, f), { force: true });
  fs.writeFileSync(path.join(out, 'js', 'config.js'),
    `window.APP_CONFIG=${JSON.stringify({ SUPABASE_URL: v.origin, SUPABASE_ANON_KEY: v.key })};\n`);
  const idx = path.join(out, 'index.html');
  let html = fs.readFileSync(idx, 'utf8');
  html = html.split('__SUPABASE_ORIGIN__').join(v.origin).split('__SUPABASE_WS__').join('wss://' + v.host);
  if (html.includes('__SUPABASE_')) throw new Error('Placeholder CSP tersisa.');
  fs.writeFileSync(idx, html);
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  return out;
}

if (require.main === module) {
  try { console.log('Build selesai:', build()); } catch (e) { console.error('BUILD GAGAL:', e.message); process.exit(1); }
}
module.exports = { build, validate };
