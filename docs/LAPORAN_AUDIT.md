# Laporan Audit - Finance Pay (v40.3 -> v41.0, versi GitHub Pages)

## Arsitektur
PWA vanilla JS di GitHub Pages memanggil Supabase langsung (tanpa backend). Backend tidak dibuat karena hosting statis; kompensasinya: RLS ketat, secret via GitHub Secrets, dan Actions untuk verifikasi.

## Temuan dan status
| # | Keparahan | Temuan | Status |
|---|---|---|---|
| 1 | Kritis | URL + anon key Supabase, ID EmailJS, kunci hardcoded di source | URL/key dikeluarkan dari repo -> GitHub Secrets -> `js/config.js` saat build; EmailJS dihapus |
| 2 | Kritis | Akses DB dari browser tanpa jaminan RLS; update/delete hanya filter `id` (IDOR) | `supabase/security.sql` (RLS per pengguna, cabut hak anon) **belum dijalankan - Anda yang menjalankan** |
| 3 | Kritis | OTP reset PIN dibuat & dicek di browser (`Math.random()`) | Diganti OTP Supabase Auth (`signInWithOtp`/`verifyOtp`), diverifikasi server Supabase |
| 4 | Kritis | Kunci AES hardcoded; PIN SHA-256 tanpa salt | PIN: PBKDF2+salt (PIN lama di-upgrade saat login). AES: kunci acak per-perangkat (kunci lama tersisa untuk migrasi, lihat risiko) |
| 5 | Tinggi | XSS via `innerHTML`/`onclick` | Diperbaiki (`Sec.esc`, `data-cat`, toast `textContent`) |
| 6 | Tinggi | Tanpa CSP; library CDN tanpa pin/SRI | CSP via `<meta>` dengan connect-src dikunci ke host project; library di-host sendiri versi pin |
| 7 | Sedang | CSV formula injection | Diperbaiki |
| 8 | Sedang | `target="_blank"` tanpa `rel` | Diperbaiki |
| 9 | Sedang | Ikon 1280px/1 MB dideklarasi 192 | Ikon persegi 192 & 512 |
| 10 | Rendah | Versi/cache tidak konsisten | Disatukan 41.0; SW tidak menyentuh request lintas origin |
| 11 | Tinggi | Tidak ada validasi server | Constraint database (`security.sql` bagian E) + RLS `with check` |

## Keamanan di GitHub (Secrets & Actions)
- Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (dimask di log). `js/config.js` & `dist/` di-`.gitignore`.
- Actions (`deploy.yml`): izin minimum (`contents: read`; `pages/id-token: write` hanya job deploy), `persist-credentials: false`, pindai secret (`scripts/check-secrets.js`: JWT, URL project, sb_secret, private key, token GitHub, hardcoded secret), uji, build, deploy. Build **menolak** key service_role/secret dan URL non-Supabase. CI untuk PR tidak mendapat secret.
- Dependabot untuk versi action. Rekomendasi manual: Secret scanning + Push protection, proteksi branch `main`.

## Kebocoran lama (nilai tidak ditampilkan)
Di `main.js` v40.3: URL project & anon key Supabase, EmailJS service/template/public key, kunci AES lokal. Riwayat Git tidak ada di ZIP -> periksa repo Anda: `git log -p -S"supabase.co"`. Rotasi (tidak saya lakukan tanpa persetujuan): EmailJS key -> buat baru/hapus (tidak dipakai lagi); anon key -> hanya perlu dirotasi bila RLS belum aktif saat key terpapar (dampak: semua sesi putus).

## Pengujian
**Sudah dijalankan:** `npm test` (13 uji: escape XSS dengan payload nyata, CSV injection, PBKDF2 + upgrade PIN lama, build menolak service_role/URL salah, CSP terkunci ke host project, pemindai secret mendeteksi JWT/URL/config.js, repo bersih); `node --check` semua file; build nyata dengan kunci uji; smoke test jsdom pada hasil build (modul termuat, payload XSS tampil sebagai teks); grep secret pada ZIP.
**Belum bisa diuji (perlu di GitHub/Supabase/perangkat Anda):** workflow Actions & deploy Pages, login Google, OTP email (template Supabase), unggah avatar, sinkronisasi nyata, CSP di browser sungguhan (cek Console), instal PWA di HP, `security.sql` pada database Anda.

## Perubahan perilaku
- Reset PIN kini memakai kode email dari Supabase (template email harus memuat `{{ .Token }}`; SMTP bawaan sangat terbatas).
- Pengguna perlu login ulang sekali setelah pindah ke versi ini bila domain/path berubah.

## Risiko yang belum terselesaikan
1. **Tanpa RLS aktif, data tidak aman sama sekali** (anon key publik). Prioritas #1: jalankan `security.sql` setelah bagian A.
2. Anon key/URL tetap terlihat di F12 (batas teknis situs statis).
3. Token sesi Supabase disimpan di localStorage (standar supabase-js): jika ada XSS, token bisa dicuri. CSP + escape mengurangi, tidak menghilangkan.
4. `LEGACY_KEY` (kunci AES lama) masih di `js/main.js` hanya untuk membaca data lokal lama; hapus di rilis berikutnya. Enkripsi localStorage hanyalah obfuskasi.
5. PIN adalah kunci UI di perangkat, bukan batas keamanan; hash PIN 4-6 digit tetap bisa ditebak offline bila bocor.
6. CSP lewat `<meta>` tidak mendukung `frame-ancestors`/header lain (GitHub Pages tak bisa set header), dan masih memakai `script-src-attr 'unsafe-inline'` karena `onclick=` inline.
7. Avatar bucket tetap publik-baca (nama file = user id); tulis dibatasi ke pemilik.
8. Tidak ada rate limiting sisi aplikasi; bergantung pada Supabase Auth rate limits.
9. Action memakai tag mayor (`@v4`), belum di-pin ke SHA commit; Dependabot membantu memperbarui.
10. Tidak ada aplikasi 100% kebal; backup dan pemantauan tetap perlu.
