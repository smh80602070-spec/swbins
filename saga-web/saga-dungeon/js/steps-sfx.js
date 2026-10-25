/**
 * 발소리·탈것 소리 (W-0442 · 다섯 판 공용 — 유니티 U-0237 FootstepSfx 짝, 소리 파일은 K-0189·K-0045 shared/audio/sfx)
 * ---------------------------------------------------------------
 * 웹엔 발소리가 아예 없었다(걸음 파일은 있는데 부르는 곳 0). 판은 매 틱 tick(key, dt, o) 하나만 부른다:
 *   o.moving  움직이나 · o.sps 초당 발 디딤(걷기 2·달리기 3 안팎 — 판이 속도로 정함) · o.surface 땅 갈래(아래 SURF)
 *   o.mount   null(걸음) · 'ground'(말발굽 — 흙·풀·모래·눈 = soft, 돌·나무 = hard) · 'fly'(학 날갯짓) · 'flyHeavy'(용 날갯짓)
 *   o.flying  날고 있으면 발 대신 날갯짓(주기 WING_SPS)
 * 디딤 사이(1/sps)가 차면 한 번 — 같은 갈래 변형 둘·셋 중 제 난수(Math.random 안 씀). 재생은 판 모듈:
 *   DG.sfx.sx(id, vol)(2나락·4종횡·3마을) → 없으면 DG.audio.play('sx:' + id)(1만리). 자가진단(DG_NO_DRAW)은 재생 없이 셈만(last).
 * 손잡이 audio.steps(1, 0 = 끔) · audio.stepsVol(0.35).
 */
(function (global) {
  'use strict';

  var VAR = { step_dirt: 2, step_grass: 2, step_sand: 2, step_snow: 2, step_stone: 2, step_wood: 2, hoof_soft: 3, hoof_hard: 3, wing_flap: 3, wing_heavy: 2 };
  /** 판이 넘기는 땅 이름 → 걸음 갈래 */
  var SURF = { grass: 'grass', forest: 'grass', field: 'grass', meadow: 'grass', dirt: 'dirt', path: 'dirt', farm: 'dirt', mud: 'dirt',
    sand: 'sand', beach: 'sand', desert: 'sand', snow: 'snow', ice: 'snow', stone: 'stone', road: 'stone', town: 'stone', cave: 'stone', rock: 'stone', castle: 'stone',
    wood: 'wood', floor: 'wood', bridge: 'wood', deck: 'wood', house: 'wood' };
  var HARD = { stone: 1, wood: 1 }, WING_SPS = 1.4;
  var acc = {}, seq = 0, last = null, count = 0;

  function core() { return global.DG.core; }
  function K(k, d) { var c = core(); return c && c.tuned ? +c.tuned('audio.' + k, d) : d; }
  function on() { return !!K('steps', 1); }
  function rnd() { seq++; var h = Math.imul(seq ^ 0x2545f491, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  function surfOf(s) { s = String(s || '').toLowerCase(); return SURF[s] || SURF[s.split('_')[0]] || 'dirt'; }   // grass_meadow → grass
  /** 이번 디딤의 갈래(VAR 키) */
  function famOf(o) {
    var s = surfOf(o && o.surface);
    if (o && o.flying && (o.mount === 'fly' || o.mount === 'flyHeavy')) { return o.mount === 'flyHeavy' ? 'wing_heavy' : 'wing_flap'; }
    if (o && o.mount) { return HARD[s] ? 'hoof_hard' : 'hoof_soft'; }
    return 'step_' + s;
  }
  function idOf(fam) { var n = VAR[fam] || 1; return 'sfx_' + fam + '_' + (1 + Math.floor(rnd() * n) % n); }
  function play(id, vol) {
    last = id; count++;
    if (global.DG_NO_DRAW) { return false; }
    var S = global.DG.sfx, A = global.DG.audio;
    if (S && S.sx) { return S.sx(id, vol); }
    if (A && A.play) { return A.play('sx:' + id); }
    return false;
  }
  /** 매 틱 — 디딤이면 그 소리 id, 아니면 null */
  function tick(key, dt, o) {
    if (!on() || !o || !(o.moving || o.flying)) { acc[key] = 0; return null; }
    var fam = famOf(o), sps = fam.indexOf('wing_') === 0 ? WING_SPS : Math.max(0.5, o.sps || 2);
    acc[key] = (acc[key] || 0) + dt;
    if (acc[key] < 1 / sps) { return null; }
    acc[key] = 0;
    var id = idOf(fam); play(id, K('stepsVol', 0.35)); return id;
  }

  global.DG = global.DG || {};
  global.DG.stepsSfx = { VAR: VAR, SURF: SURF, WING_SPS: WING_SPS, surfOf: surfOf, famOf: famOf, tick: tick,
    last: function () { return last; }, count: function () { return count; }, _reset: function () { acc = {}; seq = 0; last = null; count = 0; } };
})(window);
