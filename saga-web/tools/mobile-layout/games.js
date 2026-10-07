/**
 * 폰 배치 점검 — 판별 설정. probe.js 가 읽는다.
 *   base    세이브 뿌리(core.js SAVE_BASE) — 연습용 프로필을 심는다
 *   pass    가입·첫 고르기 화면을 넘기는 함수(브라우저에서 돈다, 바깥 변수 금지). 여러 번 불린다
 *   ready   가입 화면이 걷힌 판정(식 문자열)
 *   onboard 첫 고르기 창(출사표·시나리오·첫 장면)을 넘기는 함수 — 넘기기 전에 'intro' 장면으로 잰다
 *   started 첫 창을 넘긴 판정(식 문자열)
 *   scenes  { 이름: { open, close, wait } } — 측정 전에 부를 몸통 문자열. main 은 첫 화면
 *   ignore  측정에서 뺄 요소 이름 정규식(판 안의 캔버스 위 이름표처럼 일부러 겹치는 것)
 *   modal   배경 없이 화면을 덮는 창 선택자(그 밑 단추가 가린 건 안 센다)
 */
'use strict';

/* 첫 화면(account.js) — 이어하기가 있으면 누르고, 가입 칸이면 이름 넣고 시작 */
function passGate() {
  function shown(e) { return e && e.offsetParent; }
  var c = document.getElementById('title-continue');
  if (shown(c)) { c.click(); return true; }
  var inp = document.getElementById('acc-name');
  if (shown(inp)) {
    inp.value = '배치점검';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    var go = document.getElementById('acc-go');
    if (shown(go)) { go.click(); }
  }
  return true;
}
/* 가입 화면이 걷혔는가 */
var GATE_GONE = "!(document.getElementById('acc-host') && document.getElementById('acc-host').offsetParent)";

/* 첫 화면 — 열린 시트를 닫아 둔다(첫 창 뒤에 판이 스스로 여는 퀘스트 시트 등) */
var MAIN = { open: "var x = document.getElementById('sheet-close'); if (x && x.offsetParent) { x.click(); }", repeat: 4, wait: 700 };

module.exports = {
  /* 지도 출처 표기(#map-attrib, W-0059 OSM 조건) — 누르는 단추가 아니라 의무 표기라 터치 40px 를 안 잰다. 키우면 지도 아래 가운데 끌기를 먹는다(W-0093) */
  'saga-go': { base: 'deungyong-go/save', pass: passGate, ready: GATE_GONE, ignore: 'map-attrib', scenes: { main: MAIN } },
  'saga-dungeon': {
    /* 들판 지도 시트가 전체 지도(#dg-automap, z 90)를 띄우고 둔다 — 시트 닫을 때 같이 닫는다 */
    closeExtra: "var a = document.getElementById('dg-automap'); if (a && a.checkVisibility()) { a.click(); }",
    skipSheets: ['overworld'],   /* 시트가 아니라 전체 지도를 여는 단추 */
    base: 'yeoksa-dungeon/save', pass: passGate, ready: GATE_GONE, scenes: { main: MAIN },
    /* 출사표 — 셋 고르고 올린다 */
    onboard: function () {
      var h = document.getElementById('starter-host');
      if (!h || !h.classList.contains('show')) { return true; }
      var cells = h.querySelectorAll('.stc-cell');
      for (var i = 0; i < cells.length && h.querySelectorAll('.stc-cell.picked').length < 3; i++) {
        if (!cells[i].classList.contains('picked')) { cells[i].click(); }
      }
      var b = h.querySelector('.stc-btn');
      if (b && !b.disabled) { b.click(); }
      return true;
    },
    started: "!(document.getElementById('starter-host') && document.getElementById('starter-host').classList.contains('show'))",
  },
  'saga-forest': { base: 'yeoksa-village/save', pass: passGate, ready: GATE_GONE, scenes: { main: MAIN } },
  'saga-story': {
    modal: '#storybox',
    base: 'yeoksa-side/save', pass: passGate, ready: GATE_GONE, scenes: { main: MAIN },
    /* 첫 발 장면 — 건너뛰기 */
    onboard: function () {
      var b = document.querySelector('#storybox [data-act="story-skip"]');
      if (b) { b.click(); }
      return true;
    },
    started: "!(document.getElementById('storybox') && document.getElementById('storybox').offsetParent)",
  },
  'saga-realm': {
    base: 'saga-realm/save', pass: passGate, ready: GATE_GONE, scenes: { main: MAIN },
    /* 시나리오 → 세력 — 맨 앞 것 */
    onboard: function () {
      var e = document.getElementById('encounter');
      if (!e) { return true; }
      var b = e.querySelector('[data-act="pick-scen"]') || e.querySelector('[data-act="pick-force"]');
      if (b) { b.click(); return true; }
      var ok = e.querySelector('button.primary, .btn.primary');
      if (ok) { ok.click(); }
      return true;
    },
    started: 'DG.rtk.state().started',
  },
};
