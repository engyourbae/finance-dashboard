'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { esc, csvCell } = require('../js/security.js');

const XSS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'); alert(document.cookie);//",
  '<svg/onload=alert(1)>',
  '`${alert(1)}`',
  'javascript:alert(1)',
];

test('esc: tidak ada karakter pemicu HTML/atribut yang lolos', () => {
  for (const p of XSS) {
    const o = esc(p);
    assert.ok(!/[<>"'`]/.test(o), 'lolos: ' + p);
  }
  assert.strictEqual(esc(null), '');
  assert.strictEqual(esc(5), '5');
});

test('esc: konteks atribut onclick tidak bisa ditutup', () => {
  const html = `<div data-cat="${esc("x' onmouseover='alert(1)")}"></div>`;
  assert.ok(!html.includes("' onmouseover"));
  assert.ok(!/data-cat="[^"]*"[^>]*onmouseover/.test(html));
});

test('csvCell: formula injection dinetralkan', () => {
  for (const p of ['=HYPERLINK("http://evil","x")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) {
    assert.ok(csvCell(p).startsWith('"\''), 'tidak dinetralkan: ' + JSON.stringify(p));
  }
});

test('csvCell: kutip digandakan & nilai normal tetap', () => {
  assert.strictEqual(csvCell('a"b'), '"a""b"');
  assert.strictEqual(csvCell('Makan siang'), '"Makan siang"');
  assert.strictEqual(csvCell(15000), '"15000"');
});
