/**
 * 몬스터 초상 — 대상 적 카드(`#d2-foe`)에 K-0032 정사각 초상(`assets/portraits-monster/<id>_c.webp`)을 붙인다. (W-0072)
 *
 * 초상 32장은 특정 몬스터가 아니라 **몸 계열**이다: 보스 12(boss_01~12) · 몬스터 20 = 기계(cons)·네발(quad)·뱀(serp)·넋(spir)·날개(wing) 각 4.
 * 그래서 적 하나하나가 아니라 `ref`(form·이름)로 계열을 고르고, 같은 적은 늘 같은 초상(키 해시)을 받는다.
 *   사람형(kind human)은 몸이 있어(`look`) 초상이 없다 → null(카드는 지금처럼 글자만).
 * 규칙은 이 표 한 곳이다 — 어울리지 않는 짝은 여기서 계열만 바꾸면 된다. `DG.monsterPortrait.enabled = false` 면 늘 null(되돌림).
 * **도감 id·세이브 키는 안 건드린다**(읽기만, 표시 글자 아님).
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  var BASE = 'assets/portraits-monster/';
  var IDS = {
    boss: ['boss_01', 'boss_02', 'boss_03', 'boss_04', 'boss_05', 'boss_06', 'boss_07', 'boss_08', 'boss_09', 'boss_10', 'boss_11', 'boss_12'],
    cons: ['mon_cons_01', 'mon_cons_02', 'mon_cons_03', 'mon_cons_04'],
    quad: ['mon_quad_01', 'mon_quad_02', 'mon_quad_03', 'mon_quad_04'],
    serp: ['mon_serp_01', 'mon_serp_02', 'mon_serp_03', 'mon_serp_04'],
    spir: ['mon_spir_01', 'mon_spir_02', 'mon_spir_03', 'mon_spir_04'],
    wing: ['mon_wing_01', 'mon_wing_02', 'mon_wing_03', 'mon_wing_04']
  };
  var ROBOT = /기계|강철|철갑|동력|동합|청동|드론|보행기|거신|특공대|장갑|판갑|폭주 청년/;
  var SLIME = /슬라임/;

  function hash(s) {
    var h = 2166136261, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  /** 몸 계열 — 'boss'|'cons'|'quad'|'serp'|'spir'|'wing'|null(초상 없음) */
  function family(ref, isBoss) {
    if (!ref) { return null; }
    if (isBoss) { return 'boss'; }
    if (ref.kind === 'human' || ref.look) { return null; }
    var f = ref.form, n = ref.name || '';
    if (SLIME.test(n)) { return 'spir'; }
    if (f === 'serpent' || f === 'dragon' || f === 'fish') { return 'serp'; }
    if (f === 'bird') { return 'wing'; }
    if (f === 'quad' || f === 'toad') { return ROBOT.test(n) ? 'cons' : 'quad'; }
    if (f === 'ogre') { return ROBOT.test(n) ? 'cons' : 'spir'; }
    return null;
  }

  /** 초상 id(확장자 없음) — 없으면 null */
  function idOf(ref, isBoss) {
    var fam = family(ref, isBoss), list = fam ? IDS[fam] : null;
    if (!list || !monsterPortrait.enabled) { return null; }
    return list[hash(ref.key || ref.id || ref.name) % list.length];
  }

  /** 초상 파일 경로 — 없으면 null */
  function src(ref, isBoss) {
    var id = idOf(ref, isBoss);
    return id ? BASE + id + '_c.webp' : null;
  }

  /** `<img>` 한 조각 — 없으면 ''. 파일이 안 받아지면 스스로 숨는다(오류 0) */
  function html(ref, isBoss, size) {
    var p = src(ref, isBoss);
    if (!p) { return ''; }
    var s = size || 40;
    return '<img class="d2-fport" alt="" src="' + p + '" width="' + s + '" height="' + s + '" onerror="this.hidden=true">';
  }

  var monsterPortrait = { enabled: true, IDS: IDS, BASE: BASE, family: family, idOf: idOf, src: src, html: html };
  global.DG.monsterPortrait = monsterPortrait;
})(typeof window !== 'undefined' ? window : this);
