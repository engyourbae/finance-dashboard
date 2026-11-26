/* Klien Supabase untuk GitHub Pages (tanpa backend).
 * URL & anon key TIDAK ada di repo: disuntikkan saat build oleh GitHub Actions (dari Secrets) ke js/config.js.
 * Anon key memang publik by design; keamanan data sepenuhnya bergantung pada RLS (supabase/security.sql). */
(function () {
  'use strict';
  function createClient() {
    const cfg = window.APP_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || typeof window.supabase === 'undefined') {
      throw new Error('Konfigurasi/klien Supabase tidak tersedia');
    }
    const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    // OTP reset PIN: dikirim & diverifikasi oleh Supabase Auth (bukan dibuat di browser).
    client.otp = {
      async send() {
        const { data } = await client.auth.getSession();
        const email = data && data.session && data.session.user && data.session.user.email;
        if (!email) return { error: { message: 'Sesi tidak valid' } };
        const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        return { error: error ? { message: 'Gagal mengirim kode. Coba lagi nanti.' } : null };
      },
      async verify(code) {
        const { data } = await client.auth.getSession();
        const email = data && data.session && data.session.user && data.session.user.email;
        if (!email) return { error: { message: 'Sesi tidak valid' } };
        const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
        return { error: error ? { message: 'Kode OTP salah atau kadaluarsa' } : null };
      },
    };
    return client;
  }
  window.FinanceAPI = { createClient };
})();
