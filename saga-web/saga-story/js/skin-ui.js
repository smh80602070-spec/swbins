/**
 * 다섯 판 UI 겉옷 — 창 글에서 이모지 걷기 (W-0470 — 2나락 W-0469 stone-ui.js 를 공용으로, 판 css/skin-ui.css 짝)
 * ---------------------------------------------------------------
 * ui.js 곳곳의 문자열(제목·줄 머리, 이모지 ≈2,000자)을 하나씩 고치지 않고, 창이 그려질 때 **글자 노드만** 본다:
 *   #sheet(시트 창) · #encounter(결과·조우 카드) · #detail(인물 상세) · #campaign(5천하 장 흐름) 안 텍스트에서 그림 글자(Extended_Pictographic·변형 선택자·ZWJ)를 지우고,
 *   줄 머리였던 칸(div·li·제목 앞)에는 새긴 마름모(.st-li — CSS 도형)를 단다.
 * 데이터·세이브·자리는 안 건드린다(보이는 글자만). 아이템 그림(<img>)은 그대로. 손잡이 ui.skin(1, 0 = 끔 → body.skin-off).
 *
 *   DG.skinUi.strip(text) · DG.skinUi.clean(root) · DG.skinUi.on()
 */
(function (global) {
  'use strict';
  /* 그림 글자로 뜨는 이모지만(기본 그림 표시 · FE0F 붙은 것) — ✕ 닫기·★ 등급·✦ 같은 글자 기호는 남긴다(W-0470 — 처음엔 범위로 걸러 ✕·★ 까지 지웠다) */
  var EMO = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|[\uFE0F\u200D\u20E3]/gu;
  var LEAD = /^\s*(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)[\uFE0F\u200D\s]*/u;
  function C() { return global.DG && global.DG.core; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('ui.skin', 1)); }
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
    if (!el || !global.MutationObserver) { return false; }
    var mo = new global.MutationObserver(function () { if (busy) { return; } busy = true; try { clean(el); } finally { busy = false; } });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    clean(el);
    return true;
  }
  function boot() {
    var d = global.document;
    if (!d || !d.body) { return; }
    if (!on()) { d.body.classList.add('skin-off'); return; }
    var wait = ['sheet', 'encounter', 'detail', 'campaign'].filter(function (id) { return !watch(id); });   // 나중에 생기는 자리(5천하 #campaign)는 생길 때 붙인다
    if (wait.length) { var tries = 0, t = global.setInterval(function () { wait = wait.filter(function (id) { return !watch(id); }); if (!wait.length || ++tries > 300) { global.clearInterval(t); } }, 1000); }   // 5분 넘게 안 생기면 그만
  }
  if (global.document) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', boot); } else { boot(); } }

  global.DG = global.DG || {};
  global.DG.skinUi = { strip: strip, clean: clean, on: on };
})(typeof window !== 'undefined' ? window : this);
