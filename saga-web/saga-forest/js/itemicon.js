/**
 * 아이템 아이콘 — 이모지 대신 K-0035 그림(64px, 등급 틀 포함)을 칸에 쓴다. (W-0025)
 *
 * **정본은 saga-web/shared/js/itemicon.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 이름 표 `DG.itemiconIds` 는 tools/gen-itemicon-ids.mjs 가 만든 생성물(`itemicon-ids.js`)이다:
 *   { '<판>': { '<종류>:<id>': '<그림 이름>' } }   그림 = `assets/icons/icon64/<이름>.png`(판 폴더로 복사는 sync-shared)
 *
 * **그림이 없으면 null** — 부르는 쪽이 `DG.itemicon.html(...) || 옛 이모지` 로 그 자리에서 기존 표시를 쓴다.
 * 표에는 있는데 파일이 안 받아졌으면(네트워크·빠진 복사) `<img>` 가 스스로 `fb`(이모지)로 바뀐다 — 오류 0.
 * 되돌림: `DG.itemicon.enabled = false` 면 늘 null.
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  var BASE = 'assets/icons/icon64/';

  function table(game) { return (global.DG.itemiconIds || {})[game] || null; }

  function attr(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** 그림 파일 경로 — 없으면 null */
  function src(game, kind, id) {
    var t = table(game), n;
    if (!itemicon.enabled || !t) { return null; }
    n = t[kind + ':' + id];
    return n ? BASE + n + '.png' : null;
  }

  /**
   * `<img>` 한 조각 — 없으면 null.
   *  size: 숫자(px) 또는 CSS 길이('90%') — 기본 28px.  fb: 파일이 안 열릴 때 바꿔 낼 글자(이모지).
   *  alt: 그림 설명(없으면 fb).
   */
  function html(game, kind, id, size, fb, alt) {
    var p = src(game, kind, id), sz;
    if (!p) { return null; }
    sz = size === undefined || size === null ? '28px' : (typeof size === 'number' ? size + 'px' : String(size));
    return '<img class="ico" src="' + p + '" alt="' + attr(alt === undefined ? fb : alt) + '"' +
      ' width="64" height="64" loading="lazy" decoding="async" draggable="false"' +
      ' style="width:' + attr(sz) + ';height:' + attr(sz) + ';object-fit:contain;vertical-align:middle"' +
      (fb ? ' data-fb="' + attr(fb) + '" onerror="this.outerHTML=this.getAttribute(\'data-fb\')"' : '') + '>';
  }

  /** 그림이 있으면 그것, 없으면 fb — 호출부 한 줄용 */
  function or(game, kind, id, size, fb, alt) {
    var h = html(game, kind, id, size, fb, alt);
    return h === null ? (fb || '') : h;
  }

  /** 판 호출부용 짧은 손잡이 — `var ico = DG.itemicon.fn('saga-go'); ico('equip', id, 24, '⚔️')` */
  function fn(game) { return function (kind, id, size, fb, alt) { return or(game, kind, id, size, fb, alt); }; }

  var itemicon = { enabled: true, fn: fn, base: BASE, src: src, html: html, or: or, has: function (g, k, i) { return src(g, k, i) !== null; } };
  global.DG.itemicon = itemicon;
})(typeof window !== 'undefined' ? window : this);
