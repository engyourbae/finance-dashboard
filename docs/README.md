# Finance Pay v41.0 (GitHub Pages + Supabase)

PWA statis. Tanpa backend: hosting di GitHub Pages, data di Supabase (login Google, tabel `transactions` & `profiles`, storage `avatars`).
Keamanan data = **RLS di Supabase** (`supabase/security.sql`) + secret dikelola **GitHub Secrets** + pemeriksaan otomatis **GitHub Actions**.

## Apa yang "tersembunyi" dan apa yang tidak (jujur)
- Tidak ada URL/key/token di source, repo, atau riwayat Git baru. Nilainya hanya di GitHub Secrets dan disuntikkan saat build ke `js/config.js` (file ini tidak di-commit).
- Setelah deploy, **URL project dan anon key tetap terlihat di browser (F12)**. Itu tak terhindarkan untuk situs statis, dan anon key memang dirancang publik. Yang melindungi data adalah RLS, bukan kerahasiaan key.
- Yang TIDAK PERNAH boleh ada di sini: `service_role`/secret key, password database, connection string. Build otomatis menolak key service_role.

## Struktur
```
index.html, sw.js, manifest.json   (wajib di root)
css/style.css
js/main.js  js/security.js  js/supabase-client.js
js/vendor/        supabase-js 2.118.0, chart.js 4.4.1, crypto-js 4.1.1 (di-host sendiri, versi terkunci)
js/config.example.js   contoh; js/config.js dibuat saat build (di-.gitignore)
assets/icons/     ikon 192 & 512
scripts/build.js  scripts/check-secrets.js
supabase/security.sql   RLS + policy + constraint (BELUM dijalankan)
tests/            npm test
.github/workflows/deploy.yml  .github/dependabot.yml
```

## Setup GitHub (sekali saja)
1. **Secrets:** repo > Settings > Secrets and variables > Actions > *New repository secret*:
   - `SUPABASE_URL` = `https://<project>.supabase.co`
   - `SUPABASE_ANON_KEY` = anon / publishable key (bukan service_role)
2. **Pages:** Settings > Pages > Source = **GitHub Actions**.
3. (Disarankan) Settings > Branches: proteksi `main` (wajib PR + status check "Cek keamanan & test"). Settings > Code security: aktifkan Secret scanning + Push protection.
4. Push ke `main`. Workflow: pindai secret -> uji -> build (suntik Secrets) -> deploy.
5. **Supabase:** tambahkan `https://USER.github.io/REPO/` ke Site URL & Redirect URLs; lakukan pengaturan bagian F di `supabase/security.sql`.
6. Backup, cek bagian A, lalu jalankan `supabase/security.sql` secara manual.

> Menghapus kunci dari file tidak menghapusnya dari riwayat Git. Jika repo lama pernah berisi key, anggap sudah bocor dan rotasi (lihat laporan).

## Jalan/uji lokal
```
cp .env.example .env   # isi, jangan commit
set -a; . ./.env; set +a
npm test
npm run build          # hasil di dist/
python3 -m http.server -d dist 8080
```
Tambahkan `http://localhost:8080/` ke Redirect URLs Supabase bila ingin uji login lokal.

## Update versi
Samakan angka di tiga tempat: `APP_VERSION` di `js/main.js`, `APP_VERSION` di `sw.js`, dan `?v=` di `index.html`.

## Backup & pemulihan
- Sebelum SQL: Supabase > Database > Backups, dan ekspor tabel `transactions` & `profiles` ke CSV.
- Pulihkan lewat dashboard atau impor CSV. Rollback policy: bagian H `security.sql`.
