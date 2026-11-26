(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sec = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '/': '&#47;' };
  // Escape untuk teks maupun nilai atribut HTML.
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"'`/]/g, (c) => MAP[c]); }

  // Sel CSV aman: netralkan formula injection (= + - @ tab CR) dan gandakan tanda kutip.
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return { esc, csvCell };
});
