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
  var HAS = {"alien_grunt":1,"apatosaurus":1,"boar":1,"boss_01":1,"boss_02":1,"boss_03":1,"boss_04":1,"boss_05":1,"boss_06":1,"boss_07":1,"boss_08":1,"boss_09":1,"boss_10":1,"boss_11":1,"boss_12":1,"cactus_imp":1,"crab_cute":1,"cyclops_cute":1,"demon_blue":1,"demon_red":1,"dino_pet":1,"dragon":1,"dragon_evolved":1,"elephant":1,"frog_brute":1,"ghost":1,"ghost_skull":1,"giant":1,"glub":1,"glub_evolved":1,"goblin_brute":1,"goleling":1,"goleling_evolved":1,"green_imp":1,"hat_wizard":1,"hywirl":1,"masked_tribal":1,"mon_cons_01":1,"mon_cons_02":1,"mon_cons_03":1,"mon_cons_04":1,"mon_quad_01":1,"mon_quad_02":1,"mon_quad_03":1,"mon_quad_04":1,"mon_serp_01":1,"mon_serp_02":1,"mon_serp_03":1,"mon_serp_04":1,"mon_spir_01":1,"mon_spir_02":1,"mon_spir_03":1,"mon_spir_04":1,"mon_wing_01":1,"mon_wing_02":1,"mon_wing_03":1,"mon_wing_04":1,"monkroose":1,"moss_blob":1,"mushnub":1,"mushroom_lord":1,"npc_bandit_01":1,"npc_bandit_04":1,"npc_bandit_05":1,"npc_bandit_06":1,"npc_bandit_08":1,"npc_bandit_09":1,"npc_bandit_10":1,"npc_bandit_11":1,"npc_bandit_12":1,"npc_soldier_03":1,"npc_soldier_06":1,"npc_soldier_07":1,"npc_soldier_08":1,"npc_soldier_14":1,"npc_soldier_16":1,"npc_soldier_18":1,"npc_soldier_21":1,"npc_soldier_23":1,"orc_warrior":1,"parasaurolophus":1,"pink_slime":1,"raptor":1,"rat":1,"shadow_ninja":1,"skeleton":1,"skeleton_mage":1,"skeleton_minion":1,"skeleton_rogue":1,"skeleton_warrior":1,"slime":1,"snake":1,"spider":1,"spike_blob":1,"spore_cap":1,"squidle":1,"stegosaurus":1,"swamp_toad":1,"tentacle_imp":1,"tiger":1,"tree_walker":1,"trex":1,"triceratops":1,"wasp":1,"yeti":1,"zombie":1}, HUMAN = {"황건적":"npc_bandit_01","산적":"npc_bandit_04","도적떼":"npc_bandit_08","떠돌이 병졸":"npc_soldier_16","왜구":"npc_bandit_12","마적":"npc_bandit_05","오랑캐 궁수":"npc_soldier_03","거란 기병":"npc_soldier_07","여진 궁수":"npc_soldier_18","몽골 기병":"npc_soldier_08","왜군 조총병":"npc_soldier_21","위군 창병":"npc_bandit_10","수군 척후선":"npc_soldier_14","철갑 중장병":"npc_soldier_06","근위 기병":"npc_bandit_06","연노 사수":"npc_bandit_09","수군 함대":"npc_bandit_11","흑기병":"npc_soldier_23"}, C2D = {"beast_Boar":1,"beast_Tiger":1,"blue_demon":1,"cactoro":1,"crab":1,"cthulhu":1,"cyclops":1,"demon_2":1,"demon_green":1,"dg_elephant":1,"dino":1,"dino_apato":1,"dino_para":1,"dino_raptor":1,"dino_stego":1,"dino_trex":1,"dino_tri":1,"dragon":1,"dragon_evolved":1,"frog":1,"frog_enemy":1,"ghost":1,"ghost_skull":1,"giant":1,"glub":1,"glub_evolved":1,"goleling":1,"goleling_evolved":1,"green_blob":1,"green_spiky_blob":1,"hywirl":1,"monkroose":1,"mushnub":1,"mushnub_evolved":1,"mushroom_king":1,"ninja_2":1,"orc":1,"orc_enemy":1,"pink_slime":1,"rat":1,"skeleton_mage":1,"skeleton_minion":1,"skeleton_rogue":1,"skeleton_solo":1,"skeleton_warrior":1,"slime_enemy":1,"snake":1,"spider":1,"squidle":1,"treant":1,"tribal":1,"wasp":1,"wizard":1,"yeti":1,"zombie":1}, SHEET_ALIAS = {"beast_big":"dg_elephant","beast_boar":"beast_Boar","beast_tiger":"beast_Tiger","cactoro_2":"cactoro","demon":"demon_2","ninja":"ninja_2","yeti_2":"yeti"};   /* gen:mp-ids — tools/gen-monster-portrait-ids.mjs 가 쓴다(W-0354) */
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

  /** W-0354 손잡이 monsterPortrait.byBody — 1(기본) = 종 몸·사람 짝 초상 먼저, 0 = 옛 계열만 */
  function byBody() { var C = global.DG.core; return !(C && C.tuned) || +C.tuned('monsterPortrait.byBody', 1) > 0; }
  /** 옛 계열 초상(보스 12·계열 20) — 없으면 null */
  function famId(ref, isBoss) { var fam = family(ref, isBoss), list = fam ? IDS[fam] : null; return list ? list[hash(ref.key || ref.id || ref.name) % list.length] : null; }
  /** 초상 id(확장자 없음) — 없으면 null. 보스 길은 그대로 · 종 몸(ref.body)에 초상이 있으면 그것(K-0121) · 사람 적은 자체 NPC 몸 짝 · 아니면 옛 계열 */
  function idOf(ref, isBoss) {
    if (!ref || !monsterPortrait.enabled) { return null; }
    if (!isBoss && byBody()) {
      if (ref.body && HAS[ref.body]) { return ref.body; }
      if ((ref.kind === 'human' || ref.look) && HUMAN[ref.name]) { return HUMAN[ref.name]; }
    }
    return famId(ref, isBoss);
  }
  /** 2D 몬스터 시트 id(creatures2d) — 종 몸 시트가 있으면 그것, 없으면 옛 계열 시트(K 가 종 시트를 더하면 생성 표가 넓어진다). 사람 적은 null */
  function sheetOf(ref, isBoss) {
    if (!ref || !monsterPortrait.enabled || (!isBoss && (ref.kind === 'human' || ref.look))) { return null; }
    var b2 = ref.body && (SHEET_ALIAS[ref.body] || ref.body);   // W-0392 2D 별명(공장 시트 폴더 이름 — 코끼리병 dg_elephant 등)
    return !isBoss && byBody() && b2 && C2D[b2] ? b2 : famId(ref, isBoss);
  }
  /** 3D 몸 id(crea:<id> 로 지을 것) — 보스는 보스 몸, 종 몸이 있는 적은 그 몸(초상 = 몸), 없을 때만 옛 계열 몸. 사람 적은 null(사람 창고 길) */
  function bodyOf(ref, isBoss) {
    if (!ref || !monsterPortrait.enabled) { return null; }
    if (isBoss) { return famId(ref, true); }
    if (ref.kind === 'human' || ref.look) { return null; }
    return byBody() && ref.body ? ref.body : famId(ref, false);
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

  var monsterPortrait = { enabled: true, IDS: IDS, BASE: BASE, family: family, idOf: idOf, bodyOf: bodyOf, famId: famId, sheetOf: sheetOf, SHEET_ALIAS: SHEET_ALIAS, src: src, html: html, has: function (id) { return !!HAS[id]; }, HUMAN: HUMAN };
  global.DG.monsterPortrait = monsterPortrait;
})(typeof window !== 'undefined' ? window : this);
