-- =====================================================================
-- Finance Pay (versi GitHub Pages) - Hardening database. BELUM DIJALANKAN - jalankan manual.
-- Supabase > SQL Editor. BACKUP DULU (lihat docs/README.md).
-- Karena tidak ada backend, RLS ini adalah SATU-SATUNYA pagar keamanan data:
-- anon key terlihat di browser (memang begitu desain Supabase), jadi yang mencegah orang
-- membaca/mengubah data pengguna lain hanyalah policy di bawah.
-- Asumsi (CEK DULU di bagian A): transactions.user_id dan profiles.id bertipe uuid = auth.users.id.
-- Skrip ini tidak menghapus/mengubah data dan tidak mengubah struktur tabel.
-- =====================================================================

-- ---------- A. PENGECEKAN SEBELUM (hanya SELECT, aman) ----------
-- A1. select table_name, column_name, data_type from information_schema.columns
--      where table_schema='public' and table_name in ('transactions','profiles') order by 1, ordinal_position;
-- A2. select relname, relrowsecurity from pg_class where relname in ('transactions','profiles');
--     select * from pg_policies where schemaname='public' and tablename in ('transactions','profiles');
-- A3. Baris tanpa pemilik valid (tidak akan terlihat siapa pun setelah RLS aktif):
--     select count(*) from public.transactions where user_id is null;
--     select count(*) from public.transactions t where not exists (select 1 from auth.users u where u.id = t.user_id);
-- A4. Data lama yang melanggar constraint bagian E (hanya perlu bila ingin VALIDATE):
--     select count(*) from public.transactions where wallet not in ('harian','tabungan') or type not in ('masuk','keluar') or amount < 0;

begin;

-- ---------- B. Row Level Security ----------
alter table public.transactions enable row level security;
alter table public.profiles     enable row level security;

drop policy if exists "tx_select_own" on public.transactions;
drop policy if exists "tx_insert_own" on public.transactions;
drop policy if exists "tx_update_own" on public.transactions;
drop policy if exists "tx_delete_own" on public.transactions;
create policy "tx_select_own" on public.transactions for select to authenticated using (user_id = auth.uid());
create policy "tx_insert_own" on public.transactions for insert to authenticated with check (user_id = auth.uid());
create policy "tx_update_own" on public.transactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tx_delete_own" on public.transactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "pf_select_own" on public.profiles;
drop policy if exists "pf_insert_own" on public.profiles;
drop policy if exists "pf_update_own" on public.profiles;
create policy "pf_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "pf_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "pf_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Tidak ada policy DELETE untuk profil (tidak dipakai aplikasi).

-- ---------- C. Cabut hak role anon (pengunjung tanpa login tidak boleh menyentuh data) ----------
revoke all on public.transactions from anon;
revoke all on public.profiles     from anon;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update          on public.profiles     to authenticated;

-- ---------- D. Storage bucket avatars ----------
-- Bucket tetap PUBLIK untuk dibaca (aplikasi memakai getPublicUrl); yang dibatasi adalah TULIS:
-- hanya pemilik, hanya file bernama <user_id>_profile.jpg, hanya JPEG, maks 400 KB.
-- (Menjadikan bucket privat butuh perubahan kode ke signed URL; belum dilakukan.)
drop policy if exists "avatar_insert_own" on storage.objects;
drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '_profile.jpg');
create policy "avatar_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '_profile.jpg')
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '_profile.jpg');
update storage.buckets set file_size_limit = 409600, allowed_mime_types = array['image/jpeg'] where id = 'avatars';
-- Jika sebelumnya ada policy lain yang mengizinkan semua orang menulis/menghapus di bucket ini, hapus lewat
-- Dashboard > Storage > Policies (lihat dengan: select policyname, cmd, roles from pg_policies where schemaname='storage' and tablename='objects';)

commit;

-- ---------- E. Validasi di database (karena tidak ada validasi server) ----------
-- NOT VALID: hanya memeriksa baris baru/diubah; data lama tidak diperiksa sehingga tidak gagal & tidak ada data dihapus.
alter table public.transactions add constraint tx_wallet_chk check (wallet in ('harian','tabungan')) not valid;
alter table public.transactions add constraint tx_type_chk   check (type in ('masuk','keluar')) not valid;
alter table public.transactions add constraint tx_amount_chk check (amount >= 0) not valid;
-- Jika salah satu error "already exists", constraint sudah ada: lewati.

-- ---------- F. PENGATURAN DI DASHBOARD (bukan SQL) ----------
-- Authentication > URL Configuration: Site URL & Redirect URLs = URL GitHub Pages Anda (https://USER.github.io/REPO/).
--   Jangan pakai wildcard terlalu luas.
-- Authentication > Email Templates > "Magic Link" (dipakai untuk kode reset PIN): tambahkan {{ .Token }} di isi email,
--   dan pastikan panjang OTP = 6 (Authentication > Sign In / Providers > Email).
-- Authentication > Rate Limits: biarkan ketat. SMTP bawaan Supabase sangat terbatas; untuk dipakai nyata pasang SMTP sendiri.
-- Project Settings > API: pastikan aplikasi hanya memakai anon key. service_role tidak boleh di GitHub Secrets untuk proyek ini.

-- ---------- G. PENGECEKAN SESUDAH ----------
-- select relname, relrowsecurity from pg_class where relname in ('transactions','profiles');   -- harus true
-- select tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in ('transactions','profiles');
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name in ('transactions','profiles') and grantee='anon';                            -- harus kosong
-- Uji manual: login akun A -> hanya data A. Di tab incognito tanpa login, buka aplikasi lalu di Console jalankan query
-- ke tabel transactions memakai anon key -> harus 0 baris / ditolak.

-- ---------- H. ROLLBACK ----------
-- alter table public.transactions drop constraint if exists tx_wallet_chk, drop constraint if exists tx_type_chk, drop constraint if exists tx_amount_chk;
-- alter table public.transactions disable row level security;
-- alter table public.profiles     disable row level security;
