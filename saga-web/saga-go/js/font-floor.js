/**
 * 폰 글자 바닥값 — 폰이면 실린 스타일시트의 12px 아래 글자 크기를 12px 로 올린다 (W-0341, W-0335 측정: 판마다 11px 글자 7~110 개)
 *
 * 다섯 판 style.css 에 12px 아래 font-size 규칙이 70~110 개씩 흩어져 있어(미디어 쿼리 안 포함) 선택자마다 덮어쓰는 대신
 * CSSOM 을 한 번 훑어 값만 바꾼다. 규칙·자리·PC 화면은 그대로 — 폰(DG.deviceMode.phone())에서만.
 *   px 값만 본다(em·rem·% 는 부모를 따라 이미 커진다). 뒤에 실리는 <style>(account.js 등)은 head 를 지켜보다 다시 훑는다.
 *   DG.fontFloor.run()   지금 실린 시트 다시 훑기(바뀐 규칙 수를 돌려준다) · DG.fontFloor.MIN = 12 · floorOf(px) 순수(진단용)
 * 정본은 saga-web/shared/js/font-floor.js — 판별 사본은 tools/sync-shared.mjs.
 */
(function (global) {
  'use strict';
  var MIN = 12, done = typeof WeakSet === 'function' ? new WeakSet() : null, total = 0;
  /** 순수 — 'NNpx' 이고 MIN 아래면 바꿀 값, 아니면 null */
  function floorOf(v) {
    var m = /^\s*([\d.]+)px\s*$/.exec(String(v || ''));
    if (!m) { return null; }
    var n = parseFloat(m[1]);
    return n > 0 && n < MIN ? MIN + 'px' : null;
  }
  function walk(rules) {
    var n = 0, i, r, f;
    for (i = 0; i < rules.length; i++) {
      r = rules[i];
      if (r.style && r.style.fontSize) { f = floorOf(r.style.fontSize); if (f) { r.style.setProperty('font-size', f, r.style.getPropertyPriority('font-size')); n++; } }
      if (r.cssRules) { try { n += walk(r.cssRules); } catch (e) { /* 막힌 시트 */ } }   // @media·@supports 안
    }
    return n;
  }
  function on() { return !!(global.DG && global.DG.deviceMode && global.DG.deviceMode.phone()); }
  function run() {
    if (!on() || !global.document) { return 0; }
    var sheets = global.document.styleSheets, n = 0, i, s;
    for (i = 0; i < sheets.length; i++) {
      s = sheets[i];
      if (done && done.has(s)) { continue; }
      try { n += walk(s.cssRules); if (done) { done.add(s); } } catch (e) { /* 다른 출처(글꼴 시트) — 건너뜀 */ }
    }
    total += n;
    return n;
  }
  function start() {
    run();
    if (!on() || !global.MutationObserver) { return; }
    var t = null;
    new global.MutationObserver(function () { if (t) { return; } t = global.setTimeout(function () { t = null; run(); }, 50); })
      .observe(global.document.head, { childList: true });
    global.addEventListener('load', run);
  }
  global.DG = global.DG || {};
  global.DG.fontFloor = { MIN: MIN, floorOf: floorOf, run: run, total: function () { return total; } };
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', start); } else { start(); } }
})(window);
