/**
 * 2나락 UI 「乙 새긴 돌판」 — 창 글에서 이모지 걷기 (W-0469, css/stone-ui.css 짝)
 * ---------------------------------------------------------------
 * ui.js 곳곳의 문자열(제목·줄 머리, 이모지 ≈2,000자)을 하나씩 고치지 않고, 창이 그려질 때 **글자 노드만** 본다:
 *   #sheet(시트 창) · #encounter(결과·조우 카드) · #detail(인물 상세) 안 텍스트에서 그림 글자(Extended_Pictographic·변형 선택자·ZWJ)를 지우고,
 *   줄 머리였던 칸(div·li·제목 앞)에는 새긴 마름모(.st-li — CSS 도형)를 단다.
 * 데이터·세이브·자리는 안 건드린다(보이는 글자만). 아이템 그림(<img>)은 그대로. 손잡이 ui.stone(1, 0 = 끔 → body.stone-off).
 *
 *   DG.stoneUi.strip(text) · DG.stoneUi.clean(root) · DG.stoneUi.on()
 */
(function (global) {
  'use strict';
  var EMO = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}️‍⃣]/gu;
  var LEAD = /^[\s\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]+/u;
  function C() { return global.DG && global.DG.core; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('ui.stone', 1)); }
  function strip(t) { return String(t).replace(EMO, '').replace(/ {2,}/g, ' '); }
  /** root 안 글자 노드에서 그림 글자를 걷는다 — 바뀐 노드 수 */
  function clean(root) {
    if (!root || !global.document || !on()) { return 0; }
    var w = global.document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */), n, k = 0, lead = [];
    while ((n = w.nextNode())) {
      var t = n.nodeValue;
      if (!t || !EMO.test(t)) { EMO.lastIndex = 0; continue; }
      EMO.lastIndex = 0;
      var wasLead = LEAD.test(t) && n.parentNode && n === n.parentNode.firstChild;
      var nt = strip(t); if (wasLead) { nt = nt.replace(/^\s+/, ''); }
      if (nt !== t) { n.nodeValue = nt; k++; if (wasLead) { lead.push(n.parentNode); } }
    }
    lead.forEach(function (el) { var tg = el.tagName; if ((tg === 'DIV' || tg === 'LI' || tg === 'SPAN' || tg === 'P') && !el.classList.contains('st-li')) { el.classList.add('st-li'); } });
    return k;
  }
  var busy = false;
  function watch(id) {
    var el = global.document && global.document.getElementById(id);
    if (!el || !global.MutationObserver) { return; }
    var mo = new global.MutationObserver(function () { if (busy) { return; } busy = true; try { clean(el); } finally { busy = false; } });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    clean(el);
  }
  function boot() {
    var d = global.document;
    if (!d || !d.body) { return; }
    if (!on()) { d.body.classList.add('stone-off'); return; }
    ['sheet', 'encounter', 'detail'].forEach(watch);
  }
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', boot); } else { boot(); } }

  global.DG = global.DG || {};
  global.DG.stoneUi = { strip: strip, clean: clean, on: on };
})(typeof window !== 'undefined' ? window : this);
