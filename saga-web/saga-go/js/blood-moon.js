/**
 * 1만리 핏빛 달 밤 (W-0420 ③ · 정본 고돗 G-0379 · 젤다 야숨 블러드문 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 *   어느 밤   실제 시각 21~4시 중, 그 밤 날짜(새벽 4시 전이면 전날)의 해시가 CHANCE(다섯 밤에 하나 꼴) 밑이면 붉다 — 같은 밤은 늘 같다(순수)
 *   떠오름   붉어지는 순간 한 번 — 둘레(들판 활성 반경)의 토벌된 무리가 다시 선다(우두머리·수호자·결투·숨은 터·이야기는 그대로)
 *   덤       붉은 밤 동안 들판 전리품(처치 금·토벌 금·단사) ×LOOT_MUL — field-combat lootMul() 한 줄이 곱한다
 *   그림     화면 전체 붉은 막(코드 div 비네트 — 가운데 옅고 가장자리 짙게, 누름은 통과) + 토스트 한 줄
 * field-combat tick 의 respawnSweep 줄 끝에서 tick(S, fieldSave) 를 부른다(0.5초마다, 판정은 CHECK_SEC 마다). 세이브 없음.
 * 손잡이 go.bloodMoon: 1 날짜대로(기본) · 0 끔 · 2 밤이면 늘 붉음(촬영·점검). 시각은 _setNowForTest 로 붙든다.
 */
(function (global) {
  'use strict';

  var CHANCE = 0.2, LOOT_MUL = 2, CHECK_SEC = 2, NIGHT_FROM = 21, NIGHT_TO = 4, TINT = 'radial-gradient(ellipse at center, rgba(140,0,13,0.10) 35%, rgba(120,0,12,0.36) 100%)';
  var active = false, acc = CHECK_SEC, veil = null, nowFn = function () { return Date.now(); }, risen = 0;

  function core() { return global.DG.core; }
  function mode() { var C = core(); return C && C.tuned ? +C.tuned('go.bloodMoon', 1) : 1; }
  function isNight(at) { var h = new Date(at).getHours(); return h >= NIGHT_FROM || h < NIGHT_TO; }
  /** 그 밤의 날짜(1970-01-01 부터 며칠째, 그 고장 시각) — 새벽(4시 전)이면 전날 밤 */
  function nightDay(at) {
    var d = new Date(at), day = Math.floor((at - d.getTimezoneOffset() * 60000) / 86400000);
    return d.getHours() < NIGHT_TO ? day - 1 : day;
  }
  /** 그 밤이 붉은 밤인가(순수) — FNV-1a 32 */
  function isBloodNight(day) {
    if (mode() === 2) { return true; }
    var s = 'blood:' + day, h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
    return (h >>> 0) / 4294967296 < CHANCE;
  }
  function lootMul() { return active ? LOOT_MUL : 1; }

  function setVeil(on) {
    var doc = global.document; if (!doc || !doc.body) { return; }
    if (!veil) {
      veil = doc.createElement('div'); veil.id = 'blood-moon-veil';
      veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;background:' + TINT + ';display:none;';
      doc.body.appendChild(veil);
    }
    veil.style.display = on ? 'block' : 'none';
  }
  function toast(msg) { var U = global.DG.ui; if (U && U.toast) { U.toast(msg); } }

  /** 둘레 토벌된 무리를 다시 세운다 — 돌려준 수 = 다시 설 무리 수(다음 populate 가 세운다) */
  function rise(S, fs) {
    var n = 0;
    Object.keys(S.cleared || {}).forEach(function (k) {
      if (/^(g:|h:|dm:|sq:)/.test(k)) { return; }
      var cp = S.camps[k];
      if (!cp || cp.kind === 'boss') { return; }
      delete S.cleared[k]; if (fs && fs.camps) { delete fs.camps[k]; } delete S.camps[k];
      n++;
    });
    return n;
  }

  /** 붉은 밤 켜고 끔(점검도 부른다) — 켜지는 순간 무리를 되살린다 */
  function set(on, S, fs) {
    if (on === active) { return false; }
    active = on; setVeil(on);
    if (on) { risen = S ? rise(S, fs) : 0; toast('🌕 핏빛 달이 떴다 — 쓰러진 무리가 되살아난다 · 오늘 밤 전리품 ×' + LOOT_MUL); }
    else { toast('🌕 붉은 달이 졌다'); }
    return true;
  }

  function tick(S, fs, dt) {
    if (mode() === 0) { if (active) { set(false); } return; }
    acc += dt || 0.5; if (acc < CHECK_SEC) { return; } acc = 0;
    var t = nowFn();
    set(isNight(t) && isBloodNight(nightDay(t)), S, fs);
  }

  global.DG = global.DG || {};
  global.DG.bloodMoon = {
    CHANCE: CHANCE, LOOT_MUL: LOOT_MUL, isNight: isNight, nightDay: nightDay, isBloodNight: isBloodNight, lootMul: lootMul,
    tick: tick, set: set, active: function () { return active; }, risen: function () { return risen; },
    _setNowForTest: function (f) { nowFn = f || function () { return Date.now(); }; acc = CHECK_SEC; },
    _reset: function () { active = false; acc = CHECK_SEC; risen = 0; setVeil(false); nowFn = function () { return Date.now(); }; }
  };
})(window);
