'use strict';
// Gagalkan CI bila ada kredensial di file yang akan di-commit/deploy. Hanya melaporkan file, baris, dan jenis (tanpa nilai).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'vendor']);
const SKIP_FILE = new Set(['.env.example', 'check-secrets.js', 'config.example.js', 'LAPORAN_AUDIT.md', 'README.md', 'security.sql']);
const RULES = [
  ['JWT (kemungkinan Supabase key)', /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['URL project Supabase', /https?:\/\/[a-z0-9]{15,}\.supabase\.(co|in)/i],
  ['Kunci sb_secret/sb_publishable', /sb_(secret|publishable)_[A-Za-z0-9_-]{10,}/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Token GitHub', /gh[pousr]_[A-Za-z0-9]{30,}/],
  ['Service/template EmailJS', /(service|template)_[a-z0-9]{7}\b/],
  ['Hardcoded secret/key/password', /(secret|passwd|password|api[_-]?key)\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
];
function* walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) yield* walk(path.join(d, e.name)); }
    else if (!SKIP_FILE.has(e.name) && !/\.(png|jpg|jpeg|gif|ico|zip)$/i.test(e.name)) yield path.join(d, e.name);
  }
}
function scan(root = ROOT) {
  const found = [];
  for (const f of walk(root)) {
    const rel = path.relative(root, f);
    if (rel === path.join('js', 'config.js')) { found.push([rel, 0, 'js/config.js tidak boleh ada di repo (dibuat saat build)']); continue; }
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const [name, re] of RULES) if (re.test(line)) found.push([rel, i + 1, name]);
    });
  }
  return found;
}
if (require.main === module) {
  const r = scan();
  if (r.length) { console.error('Ditemukan potensi kebocoran:'); r.forEach(([f, l, n]) => console.error(`  ${f}:${l}  ${n}`)); process.exit(1); }
  console.log('Tidak ada secret terdeteksi.');
}
module.exports = { scan };
