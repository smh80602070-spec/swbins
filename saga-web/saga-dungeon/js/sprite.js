/**
 * 스프라이트 — 사람·적 그림(던전 뷰·초상)과 펫 그림
 * ---------------------------------------------------------------
 * 사람(NPC·동행·플레이어)과 적은 실제 그림(Kenney `human_*`·베이크한
 * `mon_*`, `mon-manifest.js` 60종)을 쓴다 — 절차적 human()/beast() 는
 * 2026-09-22 Phase 4 에서 지도·초상 두 경로 다 걷어 냈다.
 *
 * 펫 초상도 2026-09-23 에 끝났다 — 굽기가 14종에서 막혔던 원인(`portrait3d.js` PET_ASSET 표가 안 늘어난 것)을
 * 풀고 신수·오마주는 사가만리와 같은 대역 모델을 입혀(사용자 결정) **디스크 초상 105종 전부**가 구워졌다.
 * 그래서 펫 초상용으로 남겨 두던 `human()`/`beast()`·전용 헬퍼(약 1100줄)도 지웠다 — 펫 갈래는
 * 2D 그림(`petImgOf`)이 있으면 그것, 없으면 작은 자리표시(`loadingMark`, 디스크·3D 를 못 쓰는 드문 경우).
 *
 * 외형 파라미터는 인물마다 일일이 적지 않는다. 기질(무/지/덕)·세력·등급에서
 * 규칙으로 뽑고, 특징이 뚜렷한 인물만 예외 표에 적는다(LOOKS).
 */
(function (global) {
  'use strict';

  /* ── 색 도구 ──────────────────────────────────────────── */

  /**
   * '#abc' · '#aabbcc' · 'rgb(1,2,3)' 을 모두 받는다.
   * shade() 의 반환값이 rgb() 문자열이라, 색을 두 번 겹쳐 어둡게 할 때 여기로 다시 들어온다.
   */
  function hex2rgb(h) {
    h = String(h);
    if (h.indexOf('rgb') === 0) {
      var m = h.replace(/[^0-9,.\-]/g, '').split(',');
      return [parseFloat(m[0]) || 0, parseFloat(m[1]) || 0, parseFloat(m[2]) || 0];
    }
    h = h.replace('#', '');
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(hexColor, amt) {
    var c = hex2rgb(hexColor);
    for (var i = 0; i < 3; i++) {
      c[i] = amt >= 0 ? Math.round(c[i] + (255 - c[i]) * amt) : Math.round(c[i] * (1 + amt));
      c[i] = Math.max(0, Math.min(255, c[i]));
    }
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  /* ── 몸 비례 ────────────────────────────────────────────
   * 사람 스프라이트의 비례. 값은 키(H)에 대한 비율이다.
   *   headR 머리 반지름 · headY 머리 중심 · shoY 어깨 · hipY 골반
   *   leg 다리 길이 · arm 팔 길이 · thick 팔다리 굵기 배율
   */
  var PROPS_NORMAL = { headR: 0.118, headY: 0.885, shoY: 0.760, hipY: 0.420, leg: 0.420, arm: 0.340, thick: 1.00 };

  /* ── 그림 양식 ────────────────────────────────────────────
   * 이 판(saga-dungeon)은 `diablo` 양식 하나로 고정돼 있다 — 낮은 채도 · 센 대비 ·
   * 왼쪽 위 횃불 테(아래 diabloize 참조). 2026-09-14에 classic·story·anime
   * 토글을 걷어내고 이 하나만 남겼다(README 참고).
   * **이 판(saga-dungeon)에만 있던 양식이다.** sprite.js 는 다섯 게임이 한 벌씩
   * 나눠 든 복사본인데, 다른 네 판의 sprite.js 에 이 양식을 옮겨 심지 말 것 —
   * 갈라 둔 것이 뜻이다.
   */

  /* ── 인물 외형 ────────────────────────────────────────── */

  /** 특징이 뚜렷한 인물만 지정한다. 나머지는 규칙으로 만들어진다. */
  var LOOKS = {
    sg_guanyu:     { weapon: 'guandao', helm: 'helmet', armor: 'plate', beard: true, cape: true },
    sg_zhangfei:   { weapon: 'spear', helm: 'helmet', armor: 'plate', beard: true },
    sg_zhaoyun:    { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true },
    sg_zhugeliang: { weapon: 'fan', helm: 'scholar', armor: 'robe' },
    sg_liubei:     { weapon: 'sword', helm: 'crown', armor: 'robe', cape: true },
    sg_machao:     { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true },
    sg_huangzhong: { weapon: 'bow', helm: 'helmet', armor: 'leather', beard: true },
    sg_caocao:     { weapon: 'sword', helm: 'crown', armor: 'plate', cape: true },
    sg_simayi:     { weapon: 'staff', helm: 'scholar', armor: 'robe', beard: true },
    sg_xiahoudun:  { weapon: 'sword', helm: 'helmet', armor: 'plate', eyepatch: true },
    sg_zhangliao:  { weapon: 'halberd', helm: 'helmet', armor: 'plate' },
    sg_xunyu:      { weapon: 'scroll', helm: 'scholar', armor: 'robe' },
    sg_sunquan:    { weapon: 'sword', helm: 'crown', armor: 'robe', cape: true },
    sg_zhouyu:     { weapon: 'sword', helm: 'scholar', armor: 'plate', cape: true },
    sg_luxun:      { weapon: 'fan', helm: 'scholar', armor: 'plate' },
    sg_taishici:   { weapon: 'bow', helm: 'helmet', armor: 'plate' },
    sg_ganning:    { weapon: 'sword', helm: 'none', armor: 'leather' },
    sg_lubu:       { weapon: 'halberd', helm: 'plume', armor: 'plate', cape: true },
    sg_diaochan:   { weapon: 'none', helm: 'hairpin', armor: 'dress', skirt: true },
    sg_pangtong:   { weapon: 'scroll', helm: 'scholar', armor: 'robe' },
    sg_huatuo:     { weapon: 'staff', helm: 'scholar', armor: 'robe', beard: true },
    sg_menghuo:    { weapon: 'club', helm: 'none', armor: 'leather', beard: true },

    kr_yisunsin:      { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true, beard: true },
    kr_euljimundeok:  { weapon: 'sword', helm: 'gapju', armor: 'plate', beard: true },
    kr_ganggamchan:   { weapon: 'staff', helm: 'gat', armor: 'robe', beard: true },
    kr_kimyusin:      { weapon: 'sword', helm: 'gapju', armor: 'plate' },
    kr_gyebaek:       { weapon: 'spear', helm: 'gapju', armor: 'plate' },
    kr_yeongaesomun:  { weapon: 'axe', helm: 'gapju', armor: 'plate', beard: true },
    kr_gwanggaeto:    { weapon: 'spear', helm: 'crown', armor: 'plate', cape: true },
    kr_sejong:        { weapon: 'scroll', helm: 'crown', armor: 'robe', beard: true },
    kr_jangyeongsil:  { weapon: 'staff', helm: 'gat', armor: 'robe' },
    kr_choemuseon:    { weapon: 'staff', helm: 'gat', armor: 'robe' },
    kr_daejoyeong:    { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true },
    kr_wanggeon:      { weapon: 'sword', helm: 'crown', armor: 'plate', cape: true, beard: true },
    kr_jeongyakyong:  { weapon: 'scroll', helm: 'gat', armor: 'robe' },
    kr_heojun:        { weapon: 'staff', helm: 'gat', armor: 'robe', beard: true },
    kr_sinsaimdang:   { weapon: 'brush', helm: 'hairpin', armor: 'dress', skirt: true },
    kr_ahnjunggeun:   { weapon: 'none', helm: 'none', armor: 'coat' },
    kr_yugwansun:     { weapon: 'none', helm: 'braid', armor: 'dress', skirt: true },
    kr_kimgu:         { weapon: 'none', helm: 'none', armor: 'coat', glasses: true },
    kr_wonhyo:        { weapon: 'staff', helm: 'monk', armor: 'robe' },
    kr_kimjeongho:    { weapon: 'scroll', helm: 'gat', armor: 'robe' },
    kr_gwakjaeu:      { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true },
    kr_nongae:        { weapon: 'none', helm: 'hairpin', armor: 'dress', skirt: true },
    kr_yihwang:       { weapon: 'scroll', helm: 'gat', armor: 'robe', beard: true },
    kr_yii:           { weapon: 'brush', helm: 'gat', armor: 'robe' },
    kr_hwanghui:      { weapon: 'scroll', helm: 'gat', armor: 'robe', beard: true },
    kr_jeongmongju:   { weapon: 'scroll', helm: 'gat', armor: 'robe', beard: true },

    /* 세계사(옛 유럽사) — 규칙(ruleLook)에 맡기면 갓·도포가 붙으므로 전원 지정한다.
       새 파츠를 만들지 않고 있는 것으로만 조합했다: 투구는 helmet, 장식 모자는 plume,
       왕관은 crown, 제복은 coat. */
    eu_caesar:        { weapon: 'sword', helm: 'crown', armor: 'plate', cape: true },
    eu_alexander:     { weapon: 'spear', helm: 'plume', armor: 'plate', cape: true },
    eu_hannibal:      { weapon: 'sword', helm: 'helmet', armor: 'plate', cape: true, beard: true },
    eu_charlemagne:   { weapon: 'sword', helm: 'crown', armor: 'plate', cape: true, beard: true },
    eu_joan:          { weapon: 'sword', helm: 'helmet', armor: 'plate', cape: true },
    eu_napoleon:      { weapon: 'sword', helm: 'plume', armor: 'coat', cape: true },
    eu_davinci:       { weapon: 'brush', helm: 'none', armor: 'robe', beard: true },
    eu_augustus:      { weapon: 'scroll', helm: 'crown', armor: 'robe', cape: true },
    eu_scipio:        { weapon: 'sword', helm: 'helmet', armor: 'plate', cape: true },
    eu_leonidas:      { weapon: 'spear', helm: 'plume', armor: 'plate', cape: true, beard: true },
    eu_aurelius:      { weapon: 'scroll', helm: 'crown', armor: 'robe', beard: true },
    eu_richard:       { weapon: 'sword', helm: 'helmet', armor: 'plate', cape: true },
    eu_william:       { weapon: 'sword', helm: 'helmet', armor: 'plate', cape: true },
    eu_harald:        { weapon: 'axe', helm: 'helmet', armor: 'plate', beard: true },
    eu_frederick:     { weapon: 'sword', helm: 'plume', armor: 'coat', cape: true },
    eu_peter:         { weapon: 'sword', helm: 'plume', armor: 'coat', beard: true },
    eu_elizabeth:     { weapon: 'none', helm: 'crown', armor: 'dress', skirt: true },
    eu_nelson:        { weapon: 'sword', helm: 'plume', armor: 'coat' },
    eu_machiavelli:   { weapon: 'brush', helm: 'none', armor: 'robe' },
    eu_newton:        { weapon: 'scroll', helm: 'scholar', armor: 'robe' },
    eu_michelangelo:  { weapon: 'brush', helm: 'none', armor: 'robe', beard: true },
    eu_eleanor:       { weapon: 'none', helm: 'crown', armor: 'dress', skirt: true },

    /* 일본사(2026-09-10) — 갑주 계열은 gapju(투구 대역)로 통일, 문인은 none+robe */
    jp_himiko:      { weapon: 'staff', helm: 'none', armor: 'dress', skirt: true },
    jp_taira:       { weapon: 'sword', helm: 'crown', armor: 'coat', cape: true },
    jp_yoritomo:    { weapon: 'sword', helm: 'helmet', armor: 'plate', cape: true },
    jp_yoshitsune:  { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true },
    jp_murasaki:    { weapon: 'brush', helm: 'none', armor: 'robe' },
    jp_seishonagon: { weapon: 'brush', helm: 'none', armor: 'robe' },
    jp_tomoegozen:  { weapon: 'guandao', helm: 'helmet', armor: 'plate', cape: true },
    jp_nobunaga:    { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true },
    jp_hideyoshi:   { weapon: 'fan', helm: 'gapju', armor: 'coat' },
    jp_ieyasu:      { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true },
    jp_shingen:     { weapon: 'guandao', helm: 'gapju', armor: 'plate', cape: true, beard: true },
    jp_kenshin:     { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true },
    jp_masamune:    { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true, beard: true },
    jp_yukimura:    { weapon: 'spear', helm: 'gapju', armor: 'plate', cape: true },
    jp_musashi:     { weapon: 'sword', helm: 'none', armor: 'leather' },
    jp_hanzo:       { weapon: 'club', helm: 'none', armor: 'leather' },
    jp_mitsukuni:   { weapon: 'scroll', helm: 'none', armor: 'robe', beard: true },
    jp_naosuke:     { weapon: 'scroll', helm: 'none', armor: 'coat', beard: true },
    jp_saigo:       { weapon: 'sword', helm: 'none', armor: 'coat', beard: true },
    jp_ryoma:       { weapon: 'sword', helm: 'none', armor: 'coat' },

    /* 세계사, 비유럽(2026-09-10) */
    wd_ashoka:      { weapon: 'staff', helm: 'crown', armor: 'robe' },
    wd_akbar:       { weapon: 'sword', helm: 'crown', armor: 'coat', cape: true },
    wd_saladin:     { weapon: 'sword', helm: 'helmet', armor: 'plate', cape: true, beard: true },
    wd_suleiman:    { weapon: 'sword', helm: 'crown', armor: 'coat', cape: true, beard: true },
    wd_ibnsina:     { weapon: 'scroll', helm: 'none', armor: 'robe', beard: true },
    wd_genghis:     { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true, beard: true },
    wd_khubilai:    { weapon: 'sword', helm: 'crown', armor: 'coat', cape: true, beard: true },
    wd_mansamusa:   { weapon: 'none', helm: 'crown', armor: 'robe', cape: true },
    wd_shaka:       { weapon: 'spear', helm: 'none', armor: 'leather' },
    wd_cleopatra:   { weapon: 'none', helm: 'crown', armor: 'dress', skirt: true },
    wd_pachacuti:   { weapon: 'staff', helm: 'crown', armor: 'robe' },
    wd_moctezuma:   { weapon: 'club', helm: 'crown', armor: 'leather' },
    wd_ibnbattuta:  { weapon: 'scroll', helm: 'none', armor: 'robe' },
    wd_hammurabi:   { weapon: 'scroll', helm: 'crown', armor: 'robe', beard: true },
    wd_attila:      { weapon: 'axe', helm: 'helmet', armor: 'plate', beard: true }
  };

  /** 표에 없는 인물은 기질·등급에서 규칙으로 만든다 */
  function ruleLook(hero) {
    if (hero.trait === 'might') {
      return { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: hero.rarity >= 5 };
    }
    if (hero.trait === 'wisdom') {
      return { weapon: 'scroll', helm: 'scholar', armor: 'robe' };
    }
    return { weapon: 'sword', helm: hero.rarity >= 5 ? 'crown' : 'gat', armor: 'robe', cape: hero.rarity >= 4 };
  }

  var lookCache = {};

  /**
   * 인물의 외형. LOOKS 에 적힌 것을 그대로 쓰고, 적지 않아도 되는 것(눈썹 모양처럼
   * 기질에서 바로 나오는 것)은 여기서 파생시킨다. LOOKS 원본은 건드리지 않는다.
   */
  function lookOf(hero) {
    if (!hero) { return { weapon: 'sword', helm: 'none', armor: 'leather', brow: 'flat' }; }
    if (lookCache[hero.id]) { return lookCache[hero.id]; }
    var base = LOOKS[hero.id] || ruleLook(hero);
    var out = {}, k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) { out[k] = base[k]; }
    }
    out.brow = hero.trait === 'might' ? 'sharp' : (hero.trait === 'virtue' ? 'soft' : 'flat');
    lookCache[hero.id] = out;
    return out;
  }

  /* ── 사람 ─────────────────────────────────────────────── */

  /* ── 짐승 ─────────────────────────────────────────────── */

  var BEAST_FORM = {
    pt_samjogo: 'bird', pt_haetae: 'quad', pt_cheongryong: 'dragon',
    pt_baekho: 'quad', pt_jujak: 'bird', pt_hyeonmu: 'turtle',
    pt_gumiho: 'quad', pt_dokkaebi: 'ogre', pt_bulgasari: 'quad',
    pt_jeoktoma: 'horse', pt_jeolyeong: 'horse',
    pt_jindo: 'quad', pt_sapsal: 'quad', pt_tiger: 'quad', pt_bear: 'quad',
    pt_magpie: 'bird', pt_crane: 'bird', pt_toad: 'toad', pt_carp: 'fish',
    pt_panda: 'quad', pt_monkey: 'quad', pt_deer: 'quad', pt_boar: 'quad',
    pt_owl: 'bird', pt_cat: 'quad',
    /* 창작 짐승 열여섯(2026-09-26, 옛 오마주 자리 — id 만 남았다). 모양은 입고 있는 CC0 모델(`asset3d` standin)을 따른다 */
    pk_bulbasaur: 'toad', pk_charmander: 'ogre', pk_squirtle: 'ogre', pk_magikarp: 'bird',
    pk_pikachu: 'quad', pk_eevee: 'ogre', pk_slowbro: 'toad', pk_gengar: 'ogre',
    pk_snorlax: 'ogre', pk_lapras: 'bird', pk_alakazam: 'ogre', pk_dragonite: 'bird',
    pk_charizard: 'dragon', pk_gyarados: 'dragon', pk_mewtwo: 'ogre', pk_mew: 'quad',

    /* REG 확장분 64종(2026-09-22, 펫 이미지 공백 처리) — 여긴 원래 form 이
       없어 전부 기본값(quad, 평범한 네발짐승)으로 뭉뚱그려 보였다(물고기도
       예외 없이 네발짐승 모양이었다). 물고기는 fish, 공룡은 dragon, 나머지
       뭍짐승은 quad/horse 로 갈랐다. */
    pt_fox: 'quad', pt_dolphin: 'fish', pt_shark: 'fish', pt_whale: 'fish',
    pt_manta_ray: 'fish', pt_fish_1: 'fish', pt_fish_2: 'fish', pt_fish_3: 'fish',
    pt_stag: 'quad', pt_white_horse: 'horse', pt_horse: 'horse', pt_llama: 'quad',
    pt_pig: 'quad', pt_pug: 'quad', pt_sheep: 'quad', pt_horse_farm: 'horse',
    pt_cow_farm: 'quad', pt_zebra: 'quad', pt_cow: 'quad', pt_donkey: 'quad',
    pt_alpaca: 'quad', pt_bull: 'quad',
    pt_anglerfish: 'fish', pt_apatosaurus: 'dragon', pt_armored_catfish: 'fish',
    pt_betta: 'fish', pt_black_lion_fish: 'fish', pt_blobfish: 'fish',
    pt_blue_goldfish: 'fish', pt_blue_tang: 'fish', pt_butterfly_fish: 'fish',
    pt_cardinal_fish: 'fish', pt_clownfish: 'fish', pt_coral_grouper: 'fish',
    pt_cowfish: 'fish', pt_flatfish: 'fish', pt_flower_horn: 'fish',
    pt_goblin_shark: 'fish', pt_goldfish: 'fish', pt_humphead: 'fish',
    pt_koi_2: 'fish', pt_lionfish: 'fish', pt_mandarin_fish: 'fish',
    pt_moorish_idol: 'fish', pt_parasaurolophus: 'dragon', pt_parrot_fish: 'fish',
    pt_piranha: 'fish', pt_puffer: 'fish', pt_red_snapper: 'fish',
    pt_royal_gramma: 'fish', pt_shark_2: 'fish', pt_stegosaurus: 'dragon',
    pt_sunfish: 'fish', pt_swordfish: 'fish', pt_t_rex: 'dragon',
    pt_tang: 'fish', pt_tetra: 'fish', pt_triceratops: 'dragon',
    pt_tuna: 'fish', pt_turbot: 'fish', pt_velociraptor: 'dragon',
    pt_worm: 'fish', pt_yellow_tang: 'fish', pt_zebra_clown_fish: 'fish'
  };

  var BEAST_COLOR = {
    pt_samjogo: '#3a3a48', pt_haetae: '#c98f3a', pt_cheongryong: '#3aa9c9',
    pt_baekho: '#e6e6ec', pt_jujak: '#d95a45', pt_hyeonmu: '#3f6a5a',
    pt_gumiho: '#d98a45', pt_dokkaebi: '#b2453f', pt_bulgasari: '#8a8a96',
    pt_jeoktoma: '#a04a3a', pt_jeolyeong: '#3a3a44',
    pt_jindo: '#d9b98a', pt_sapsal: '#b8a58c', pt_tiger: '#d99a3a', pt_bear: '#5a4436',
    pt_magpie: '#2f3340', pt_crane: '#eceff5', pt_toad: '#6a9a4a', pt_carp: '#d98a5a',
    pt_panda: '#e8e8ee', pt_monkey: '#a87c52', pt_deer: '#c39a6a', pt_boar: '#6b5544',
    pt_owl: '#8a7358', pt_cat: '#9a9aa6',
    pk_bulbasaur: '#1f7f99', pk_charmander: '#b0306e', pk_squirtle: '#b83a6e', pk_magikarp: '#2f2a78',
    pk_pikachu: '#ecebe6', pk_eevee: '#8ccf3a', pk_slowbro: '#a8285e', pk_gengar: '#3a1d52',
    pk_snorlax: '#2f9aa8', pk_lapras: '#2f2a78', pk_alakazam: '#43205e', pk_dragonite: '#e8b82a',
    pk_charizard: '#e0801f', pk_gyarados: '#3fa58a', pk_mewtwo: '#5e2a8c', pk_mew: '#e0901f',

    /* REG 확장분 64종(2026-09-22, 펫 이미지 공백 처리) — 위 BEAST_FORM 과 짝 */
    pt_fox: '#c9743a', pt_dolphin: '#7a96a8', pt_shark: '#7a828c', pt_whale: '#465562',
    pt_manta_ray: '#39434c', pt_fish_1: '#a88a4a', pt_fish_2: '#b6c0c9', pt_fish_3: '#584d43',
    pt_stag: '#ab7c4c', pt_white_horse: '#eceef2', pt_horse: '#8a6a49', pt_llama: '#d9c8a8',
    pt_pig: '#e8a9a9', pt_pug: '#c9a868', pt_sheep: '#e9e1d1', pt_horse_farm: '#7a5a3a',
    pt_cow_farm: '#2c2c2e', pt_zebra: '#2c2c2e', pt_cow: '#4a3a2a', pt_donkey: '#8a8078',
    pt_alpaca: '#d9c298', pt_bull: '#5a3a2a',
    pt_anglerfish: '#463530', pt_apatosaurus: '#6c8c6c', pt_armored_catfish: '#5a5040',
    pt_betta: '#c9394a', pt_black_lion_fish: '#2a2228', pt_blobfish: '#d9a8a0',
    pt_blue_goldfish: '#3a6ac9', pt_blue_tang: '#2a6ad9', pt_butterfly_fish: '#e8c93a',
    pt_cardinal_fish: '#c9453a', pt_clownfish: '#e8783a', pt_coral_grouper: '#c9503a',
    pt_cowfish: '#d9c93a', pt_flatfish: '#a88a5a', pt_flower_horn: '#d9455a',
    pt_goblin_shark: '#b8888a', pt_goldfish: '#e8983a', pt_humphead: '#3a8a8a',
    pt_koi_2: '#d9783a', pt_lionfish: '#c9453a', pt_mandarin_fish: '#e87a3a',
    pt_moorish_idol: '#2a2a30', pt_parasaurolophus: '#8a9a5a', pt_parrot_fish: '#3a9a7a',
    pt_piranha: '#8a9aa0', pt_puffer: '#c9a868', pt_red_snapper: '#c9453a',
    pt_royal_gramma: '#8a3ac9', pt_shark_2: '#6a7a88', pt_stegosaurus: '#5a7a4a',
    pt_sunfish: '#a8b0b8', pt_swordfish: '#2a4a68', pt_t_rex: '#8a4a3a',
    pt_tang: '#4a5ac9', pt_tetra: '#8aa8c9', pt_triceratops: '#7a6a5a',
    pt_tuna: '#3a5068', pt_turbot: '#8a7a5a', pt_velociraptor: '#6a7a4a',
    pt_worm: '#b8785a', pt_yellow_tang: '#e8c93a', pt_zebra_clown_fish: '#e8783a'
  };

  function beastFormOf(pet) { return (pet && BEAST_FORM[pet.id]) || 'quad'; }
  function beastColorOf(pet) { return (pet && BEAST_COLOR[pet.id]) || '#9a8f7a'; }

  /* ── 펫 초상 — 3D 굽기가 안 되는 종 일부를 실제 그림으로(2026-09-22) ──────
   * `assets/portraits/pet/`(14종)·3D 굽기 둘 다 안 되는 나머지 91종은 절차적
   * `beast()` 뿐이었다(ASSET_LICENSES.md 같은 날 절). 그중 **종이 실제로 겹치는
   * 16장**만 `saga-go/assets/sprites2d/beast_*.png`(CC0, md5 동일 복사)를 써서
   * 실제 그림으로 바꾼다 — 사가만리처럼 형태별 아무거나 고르지 않고, **이름이
   * 맞는 자리에만** 못 박는다(펫은 익명 배경 채움이 아니라 특정 종이라서).
   * 목록에 없거나(대다수 물고기·신수·창작 짐승(옛 오마주)) 그림이 아직 안 실렸으면
   * `false`/`null` — 부르는 쪽이 자리표시로 메운다(절차적 `beast()` 는 2026-09-23 삭제). */
  var PET_IMG = {
    pt_fox: 'Fox', pt_dolphin: 'Dolphin', pt_shark: 'Shark', pt_shark_2: 'Shark',
    pt_manta_ray: 'Manta_ray', pt_stag: 'Stag', pt_white_horse: 'Horse_White',
    pt_horse: 'Horse', pt_horse_farm: 'Horse', pt_donkey: 'Donkey',
    pt_cow: 'Cow', pt_cow_farm: 'Cow', pt_bull: 'Bull',
    pt_stegosaurus: 'Stegosaurus', pt_t_rex: 'Trex', pt_triceratops: 'Triceratops',
    pt_velociraptor: 'Velociraptor', pt_koi_2: 'Koi', pt_alpaca: 'Alpaca', pt_llama: 'Alpaca'
  };
  var petImgCache = {};
  function petImgFile(name) {
    var src = 'assets/sprites2d/beast_' + name + '.png';
    var im = petImgCache[src];
    if (!im) { im = new Image(); im.src = src; petImgCache[src] = im; }
    return im;
  }
  /** 다 실렸으면 <img>, 아니면(목록 밖 종·아직 로딩 중) null — 부르는 쪽이 자리표시로 메운다 */
  function petImgOf(pet) {
    var name = pet && PET_IMG[pet.id];
    if (!name) { return null; }
    var im = petImgFile(name);
    return (im.complete && im.naturalWidth) ? im : null;
  }

  /* ── 스탬프 캐시 ──────────────────────────────────────────
   * 매 프레임 수십 개의 path 를 다시 그리는 대신, 걸음 위상을 8단계로
   * 크기를 0.08 단위로 묶어 오프스크린에 한 번 굽고 drawImage 로 붙인다.
   * 좌우 방향은 붙일 때 뒤집으므로 캐시를 두 배로 쓰지 않는다.
   * 흔들림(bounce)만 캐시 밖에서 y 오프셋으로 준다 — 위상에서 바로 나오는 값이라
   * 캐시에 넣으면 단계 수만 늘어난다.
   */

  var TAU = Math.PI * 2;
  var PHASES = 8;                 // 걸음을 몇 컷으로 나눌지
  var SB = 0.08;                  // 크기 버킷 폭
  var stampCache = {};
  var stampOrder = [];
  var STAMP_MAX = 420;
  var stat = { hit: 0, miss: 0 };

  function bucketScale(s) {
    return Math.max(SB, Math.round(s / SB) * SB);
  }
  function bucketPhase(phase, walking) {
    if (!walking) { return PHASES; }          // 정지 자세는 한 컷
    var t = ((phase % TAU) + TAU) % TAU;
    return Math.floor(t / (TAU / PHASES)) % PHASES;
  }

  /** 2D 던전 뷰의 사람 그림 — Kenney Roguelike Characters(CC0)에서 오려 낸 열넷 중 인물 id 로
   *  하나를 정해 고른다(같은 인물은 늘 같은 얼굴). 사가만리·사가마을·사가종횡와 같은 그림이다.
   *  걷기 다리 애니메이션·개인별 색은 이 그림 하나로는 못 낸다 — 걸음 통통거림(stamp() 의 bounce)과
   *  좌우 뒤집기는 그대로 산다. 원작풍 후처리(diabloize)는 이 판의 양식이라 그림에도 그대로 건다.
   *  SAGA-DESIGN §11 Phase 2(2026-09-20, 사용자가 "사가나락 2D 살려서" 로 Q-2D-2 결정) */
  var HUMAN_SPRITE_N = 14;
  var humanImgCache = {};
  function humanImg(i) {
    var n = ((i - 1) % HUMAN_SPRITE_N + HUMAN_SPRITE_N) % HUMAN_SPRITE_N + 1;
    var src = 'assets/sprites2d/human_' + (n < 10 ? '0' + n : n) + '.png';
    var im = humanImgCache[src];
    if (!im) { im = new Image(); im.src = src; humanImgCache[src] = im; }
    return im;
  }
  function humanReady(ref) { var im = humanImg(humanIndexOf(ref)); return !!(im.complete && im.naturalWidth); }
  function humanIndexOf(ref) {
    var id = String((ref && (ref.id || ref.key || ref.name)) || 'anon');
    var h = 0;
    for (var i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) >>> 0; }
    return (h % HUMAN_SPRITE_N) + 1;
  }

  /** 2D 사람 인물별(2026-09-25, CHARACTER_UNIQUENESS ⑤) — Kenney 열넷을 해시로 나누면 한 장에 여남은 명이 겹친다.
   *  그래서 3D 몸을 옆모습 걷기 시트로 미리 구운 `assets/sprites2d/people/<줄기>.webp`(5컷 가로: 걷기 4 + 서기 1,
   *  앞이 오른쪽 — `tools/bake-portraits --sprites=people` 산출, `people-manifest.js` 에 적힌 것만)를 먼저 쓴다.
   *  몸은 3D 와 같은 씨앗 — 도감 인물 'hero:'+id(초상과 같은 몸), 마을 사람 'npc:'+키, 세 시대 손님 제 folk 몸,
   *  사람 적 이름. 줄기: h_<id> · n_<키> · f_<이름 FNV 16진>. 없으면(단독 빌드·안 구운 사람) 예전 Kenney 열넷 */
  var peopleSet = null, peopleFrom = null, personImgCache = {};
  function nameHash(s) {
    var h = 2166136261, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function personStem(ref) {
    if (!ref) { return null; }
    var id = String(ref.id || '');
    if (id.indexOf('town_') === 0) { return 'n_' + id.slice(5); }
    if (id && ref.faction !== undefined) { return 'h_' + id; }
    if (ref.tier && ref.name) { return 'f_' + nameHash(ref.name); }
    return null;
  }
  function personKeyOf(ref) {
    var M = global.DG.peopleSprites;
    if (!M || !M.keys) { return null; }
    if (peopleFrom !== M) { peopleSet = {}; peopleFrom = M; String(M.keys).split(',').forEach(function (k) { if (k) { peopleSet[k] = 1; } }); }
    var k = personStem(ref);
    return k && peopleSet[k] ? k : null;
  }
  function personImg(key) {
    var im = personImgCache[key];
    if (!im) { im = new Image(); im.src = 'assets/sprites2d/people/' + key + '.webp'; personImgCache[key] = im; }
    return im;
  }
  function personReady(ref) { var k = personKeyOf(ref); if (!k) { return false; } var im = personImg(k); return !!(im.complete && im.naturalWidth); }
  /** 굽기 도구가 부른다 — 구울 사람 목록 { stem, seed, tint, model } (3D 가 세우는 몸과 같은 씨앗·물빛) */
  function peopleList() {
    var out = [], seen = {}, D = global.DG.data, TW = global.DG.town, E = global.DG.enemyData;
    function add(stem, seed, tint, model) { if (!seen[stem]) { seen[stem] = 1; out.push({ stem: stem, seed: seed, tint: tint || null, model: model || null }); } }
    (D.heroes || []).forEach(function (h) { add('h_' + h.id, 'hero:' + h.id, D.faction(h.faction).color); });
    var nd = (TW && TW.npcDefs) || {}, k;
    for (k in nd) { if (nd.hasOwnProperty(k)) { add('n_' + k, 'npc:' + k, nd[k].color); } }
    var ef = (TW && TW.eraFolk) || {};
    for (k in ef) { if (ef.hasOwnProperty(k)) { add('n_' + k, 'npc:' + k, null, ef[k].model); } }
    ((E && E.enemies) || []).concat((E && E.bosses) || []).forEach(function (e) {
      if (e.kind === 'human') { add('f_' + nameHash(e.name), e.name, e.color); }
    });
    return out;
  }

  /** 2D 던전 뷰의 적 짐승 — 3D 몸(`data-enemy.js` 의 body, 없으면 'beast'=늑대)을 옆모습 걷기 시트로 미리 구운 그림
   *  (`tools/bake-portraits --sprites=monsters` → `assets/sprites2d/mon_<몸>.webp`, 5컷 가로: 걷기 4 + 서기 1, 컷 128px, 앞이 오른쪽).
   *  `mon-manifest.js` 에 적힌 몸만 쓰고 나머지·도감 펫·단독 빌드(파일 없음)는 자리표시(`loadingMark`)다(코드 그림은 2026-09-23 삭제).
   *  SAGA-DESIGN §11 Phase 3(2026-09-20). 도감 펫은 `tier` 가 없어 여기 안 탄다. */
  var monSet = null, monFrom = null, monImgCache = {};
  function monKeyOf(ref) {
    var M = global.DG.monsterSprites;
    if (!M || !M.keys || !ref) { return null; }
    if (monFrom !== M) { monSet = {}; monFrom = M; String(M.keys).split(',').forEach(function (k) { if (k) { monSet[k] = 1; } }); }
    var k = ref.body || (ref.tier ? 'beast' : null);
    return k && monSet[k] ? k : null;
  }
  function monImg(key) {
    var im = monImgCache[key];
    if (!im) { im = new Image(); im.src = 'assets/sprites2d/mon_' + key + '.webp'; monImgCache[key] = im; }
    return im;
  }
  function monReady(ref) { var k = monKeyOf(ref); if (!k) { return false; } var im = monImg(k); return !!(im.complete && im.naturalWidth); }

  /** 그림이 아직 안 실린 순간에만 잠깐 보이는 자리표시(머리 원 + 몸통 타원) —
   *  human() 절차적 그림을 대신한다(2026-09-22 Phase 4). 2D 던전 뷰의 사람·적은
   *  Kenney 열넷 / `mon-manifest.js` 60종이 늘 있어(비는 몸은 tier 만 있는 것도
   *  generic 'beast' 시트로 덮는다) 이 자리는 로컬 PNG 를 기다리는 찰나뿐이다 —
   *  실리면 stamp() 의 imgReady 재굽기가 곧바로 다시 굽는다 */
  function loadingMark(ctx, footX, footY, H, color) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color || '#8a8578';
    ctx.beginPath();
    ctx.ellipse(footX, footY - H * 0.86, H * 0.17, H * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(footX, footY - H * 0.42, H * 0.22, H * 0.40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 캐시에 한 컷을 굽는다 */
  function bake(kind, ref, sc, pb, o) {
    var base = kind === 'human' ? 40 : 30;
    var H = base * sc;
    var w = Math.ceil(H * (kind === 'human' ? 1.9 : 2.3));
    var h = Math.ceil(H * (kind === 'human' ? 1.75 : 1.6));
    var footX = w / 2, footY = h * 0.94;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);

    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr));
    cv.height = Math.max(1, Math.ceil(h * dpr));
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    var himg = kind === 'human' ? humanImg(humanIndexOf(o.ref)) : null;
    var useImg = !!(himg && himg.complete && himg.naturalWidth);   // 짐승은 아래에서 켠다
    var pk = kind === 'human' ? personKeyOf(o.ref) : null, pim = pk ? personImg(pk) : null, person = false;
    if (pim && pim.complete && pim.naturalWidth) {
      var pcell = pim.naturalHeight, pframe = pb === PHASES ? 4 : (pb >> 1) % 4, psq = H * 1.1;
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(pim, pframe * pcell, 0, pcell, pcell, footX - psq / 2, footY - psq * 0.97, psq, psq);
      useImg = true; person = true;
    } else if (kind === 'human') {
      if (useImg) {
        var hdw = H * 1.2, hdh = H * 1.2;
        c.imageSmoothingEnabled = false;
        c.drawImage(himg, footX - hdw / 2, footY - hdh, hdw, hdh);
      } else {
        loadingMark(c, footX, footY, H, o.color);
      }
    } else {
      var mk = monKeyOf(o.ref), mim = mk ? monImg(mk) : null;
      if (mim && mim.complete && mim.naturalWidth) {
        var cell = mim.naturalHeight, frame = pb === PHASES ? 4 : (pb >> 1) % 4, sq = H * 1.55;
        c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
        c.drawImage(mim, frame * cell, 0, cell, cell, footX - sq / 2, footY - sq * 0.97, sq, sq);
        useImg = true;
      } else {
        loadingMark(c, footX, footY, H, o.color);
      }
    }
    /* 원작풍 — 무대 위 인물은 커 봐야 40~60px 이라 **거의 모든 픽셀이 테**다.
       초상만큼 두르면 인물이 통째로 밝은 실루엣이 된다(그렇게 나왔다).
       그래서 스탬프는 늘 얇게, 위쪽 테만 두른다. 초상 쪽은 각자 세기를 준다. */
    diabloize(cv, H >= 64 ? { rimK: 0.30, dark: 0.88 }
                          : { rimK: 0.24, wide: false, dark: 0.88 });
    return { cv: cv, w: w, h: h, footX: footX, footY: footY, base: base, sc: sc, img: useImg, person: person };
  }

  /**
   * 캐시된 스프라이트를 (x, y)=발 위치에 붙인다.
   * @param o {kind, ref, x, y, s, facing, phase, walking, color, look, form, divine, skin, t}
   */
  function stamp(ctx, o) {
    var kind = o.kind === 'beast' ? 'beast' : 'human';
    var sc = bucketScale(o.s || 1);
    var pb = bucketPhase(o.phase || 0, !!o.walking);
    var id = (o.ref && (o.ref.id || o.ref.name)) || o.key || 'anon';
    var key = kind + '|' + id + '|' + sc.toFixed(2) + '|' + pb;

    var e = stampCache[key];
    if (e && !e.img && (kind === 'human' ? humanReady(o.ref) : monReady(o.ref))) { e = null; }   // 그림이 실리기 전에 구운 코드 그림 컷은 다시 굽는다
    if (e && !e.person && kind === 'human' && personReady(o.ref)) { e = null; }   // 인물 시트가 늦게 실리면 Kenney 컷을 갈아 끼운다
    if (e) { stat.hit++; }
    else {
      stat.miss++;
      e = bake(kind, o.ref, sc, pb, o);
      stampCache[key] = e;
      stampOrder.push(key);
      if (stampOrder.length > STAMP_MAX) {          // 오래된 것부터 버린다
        for (var i = 0; i < 60; i++) {
          var old = stampOrder.shift();
          if (old) { delete stampCache[old]; }
        }
      }
    }

    var H = e.base * e.sc;
    var bounce = o.walking
      ? (kind === 'human' ? Math.abs(Math.sin(o.phase)) * H * 0.035
                          : Math.abs(Math.sin(o.phase * 2)) * H * 0.05)
      : (kind === 'human' ? Math.sin((o.t || 0) / 640) * H * 0.008
                          : Math.sin((o.t || 0) / 700) * H * 0.02);

    ctx.save();
    ctx.translate(o.x, o.y - bounce);
    if ((o.facing || 1) < 0) { ctx.scale(-1, 1); }
    ctx.drawImage(e.cv, -e.footX, -e.footY, e.w, e.h);
    ctx.restore();
  }

  function stampStats() {
    return { hit: stat.hit, miss: stat.miss, size: stampOrder.length };
  }

  /* ── 원작 2편풍 후처리 ────────────────────────────────────
   * 다 그린 스프라이트를 픽셀에서 한 번 훑어 "어둠 + 금속 반사"로 만든다.
   *
   * 원작의 인물이 눈에 남기는 것 셋만 옮긴다.
   *   1) 채도가 낮고 어둡다 — 색이 아니라 **쇠와 가죽**으로 읽힌다
   *   2) 대비가 세다 — 중간톤이 없고 검은 그늘과 반사만 남는다
   *   3) 빛이 왼쪽 위에서 든다 — 실루엣 그쪽엔 따뜻한 테, 반대쪽은 어둠에 먹힌다
   * **선은 긋지 않는다.** 원작 스프라이트에 윤곽선은 없다 —
   *   선을 그으면 그 순간 만화가 되어 버린다.
   *
   * 도형 코드를 안 건드리므로 인물 70 · 짐승 41 · 건물이 한꺼번에 같은 양식이 된다.
   * 비용은 캐시 미스 때 한 번만 든다(스탬프·초상 모두 캐시된다).
   */
  var D2_TINT = [128, 108, 84];        // 갈색-강철. 어두운 쪽일수록 이리로 몰린다
  var D2_RIM_WARM = [236, 168, 86];    // 횃불이 닿는 테 (왼쪽 위)
  var D2_RIM_DARK = [10, 7, 5];        // 어둠에 먹히는 테 (오른쪽 아래)

  function diabloize(cv, opts) {
    opts = opts || {};
    var W = cv.width, H = cv.height;
    if (!W || !H) { return; }
    var c = cv.getContext('2d');
    var img;
    try { img = c.getImageData(0, 0, W, H); } catch (e) { return; }   // 오염된 캔버스면 그냥 둔다
    var d = img.data, n = W * H, i, q;

    var sat = opts.sat === undefined ? 0.34 : opts.sat;
    var dark = opts.dark === undefined ? 0.86 : opts.dark;   // 1 이면 안 어둡게
    var tone = opts.tone === undefined ? 0.20 : opts.tone;   // 갈색-강철로 몰아 가는 정도

    var alp = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      q = i * 4;
      var a = d[q + 3];
      alp[i] = a;
      if (!a) { continue; }
      var r = d[q], g = d[q + 1], b = d[q + 2];
      var y = 0.299 * r + 0.587 * g + 0.114 * b;

      /* 감마로 중간톤을 살짝 눌러 그늘을 판 뒤 대비를 세운다.
         **너무 세게 누르면 안 된다** — S자 곡선으로 한 번 해 봤더니 옷이 통째로
         새까매져서 인물이 검은 종잇조각이 됐다. 원작의 인물은 어둡지만
         무엇을 걸쳤는지는 보인다. */
      var t = y / 255;
      var y2 = 255 * Math.pow(t, 1.22);
      y2 = (y2 - 128) * 1.22 + 128;
      y2 *= dark;
      if (y2 < 0) { y2 = 0; } else if (y2 > 255) { y2 = 255; }

      /* 밝기를 갈아 끼우고 채도를 낮춘다 (원래 색상은 흔적만 남긴다) */
      var k = y > 4 ? y2 / y : 0;
      r = y2 + (r * k - y2) * sat;
      g = y2 + (g * k - y2) * sat;
      b = y2 + (b * k - y2) * sat;

      /* 어두운 쪽일수록 갈색-강철로 몰아 준다 — 검정이 새카맣게 죽지 않게 */
      var mix = tone + (1 - t) * 0.26;
      r = r + (D2_TINT[0] * (y2 / 255) - r) * mix;
      g = g + (D2_TINT[1] * (y2 / 255) - g) * mix;
      b = b + (D2_TINT[2] * (y2 / 255) - b) * mix;

      d[q] = r < 0 ? 0 : (r > 255 ? 255 : r);
      d[q + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
      d[q + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
    }

    /* 실루엣 테 — 빛은 왼쪽 위에서 든다.
       투명한 이웃이 위/왼쪽이면 따뜻한 테, 아래/오른쪽이면 어둠. */
    /* 작은 스프라이트(무대 위 인물은 20~30px)는 **거의 모든 픽셀이 테**다.
       큰 초상과 같은 세기로 두르면 인물이 통째로 밝은 실루엣이 되어 버린다
       (실제로 그렇게 나왔다). 그래서 작은 것은 **위쪽 테만** 얇게 두르고,
       왼쪽 테는 큰 그림에서만 쓴다. */
    var warm = opts.rimWarm || D2_RIM_WARM;
    var cold = opts.rimDark || D2_RIM_DARK;
    var wide = opts.wide !== false;                 // 왼쪽 테까지 두를지
    var wk = opts.rimK === undefined ? 0.5 : opts.rimK;
    var x, y3;
    for (y3 = 0; y3 < H; y3++) {
      for (x = 0; x < W; x++) {
        i = y3 * W + x;
        if (alp[i] <= 120) { continue; }
        var up = y3 > 0 && alp[i - W] < 60;
        var lf = wide && x > 0 && alp[i - 1] < 60;
        var dn = y3 + 1 < H && alp[i + W] < 60;
        var rt = wide && x + 1 < W && alp[i + 1] < 60;
        var col = null, kk = wk;
        if (up || lf) { col = warm; }
        else if (dn || rt) { col = cold; kk = wk * 1.05; }
        if (!col) { continue; }
        q = i * 4;
        d[q] = d[q] * (1 - kk) + col[0] * kk;
        d[q + 1] = d[q + 1] * (1 - kk) + col[1] * kk;
        d[q + 2] = d[q + 2] * (1 - kk) + col[2] * kk;
      }
    }
    c.putImageData(img, 0, 0);
  }

  /* ── 초상 캐시 (HTML 목록용) ──────────────────────────── */

  var cache = {};

  /**
   * 오프스크린으로 한 번 그려 data URL 로 캐시한다.
   * 도감처럼 수십 개를 나열할 때 <img> 로 쓰면 가볍다.
   */
  function portrait(kind, ref, size) {
    size = size || 56;
    var key = kind + '/' + (ref ? (ref.id || ref.key || ref.name || 'x') : 'x') + '/' + size;
    if (cache[key]) { return cache[key]; }

    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var cv = document.createElement('canvas');
    cv.width = Math.floor(size * dpr);
    cv.height = Math.floor(size * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* 어두운 돌 바탕 — 어두운 인물을 어두운 UI 에 그냥 얹으면 형태가 사라진다 */
    var bgg = c.createLinearGradient(0, 0, 0, size);
    bgg.addColorStop(0, '#2a2117');
    bgg.addColorStop(1, '#0c0906');
    c.fillStyle = bgg;
    c.fillRect(0, 0, size, size);

    if (kind === 'hero') {
      var f = global.DG.data.faction(ref.faction);
      var himg2 = humanImg(humanIndexOf(ref));
      if (himg2.complete && himg2.naturalWidth) {
        c.imageSmoothingEnabled = false;
        var hw2 = size * 0.78;
        c.drawImage(himg2, size * 0.5 - hw2 / 2, size * 0.94 - hw2, hw2, hw2);
      } else {
        loadingMark(c, size * 0.5, size * 0.94, size * 0.8, f.color);
      }
    } else if (kind === 'pet') {
      var pimg2 = petImgOf(ref);
      if (pimg2) {
        c.imageSmoothingEnabled = false;
        var pw2 = size * 0.78;
        c.drawImage(pimg2, size * 0.5 - pw2 / 2, size * 0.94 - pw2, pw2, pw2);
      } else {
        /* 디스크 초상 105종이 전부 구워져 있다(2026-09-23) — 여긴 3D·디스크를 못 쓰는 드문 경우만, 작은 자리표시 */
        loadingMark(c, size * 0.5, size * 0.9, size * 0.8, beastColorOf(ref));
      }
    }
    diabloize(cv, { rimK: 0.58 });
    cache[key] = cv.toDataURL();
    return cache[key];
  }

  /* ── 상세 화면용 큰 초상 ─────────────────────────────── */

  var cardCache = {};

  /**
   * 인물·펫 하나를 액자에 담아 그린다 (상세 화면용).
   * 배경은 세력색 그라디언트 + 큼직한 문양, 테두리는 등급색.
   * 목록용 portrait() 과 달리 가로세로 비율이 있고 배경까지 그린다.
   */
  function portraitCard(kind, ref, w, h) {
    w = w || 168; h = h || 190;
    var key = 'card/' + kind + '/' + (ref ? (ref.id || ref.name) : 'x') + '/' + w + 'x' + h;
    if (cardCache[key]) { return cardCache[key]; }

    var D = global.DG.data;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var cv = document.createElement('canvas');
    cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    var isHero = kind === 'hero';
    var fac = isHero ? D.faction(ref.faction) : { color: ref.kind === 'divine' ? '#8a5cc0' : '#5f7a4a', mark: ref.kind === 'divine' ? '神' : '獸' };
    var rar = D.rarity[ref.rarity] || D.rarity[3];

    /* 배경 — 위는 세력색, 아래는 어둡게 */
    var bg = c.createLinearGradient(0, 0, w * 0.4, h);
    bg.addColorStop(0, shade(fac.color, -0.10));
    bg.addColorStop(0.55, shade(fac.color, -0.52));
    bg.addColorStop(1, '#14161c');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    /* 문양 — 크게 깔아 두고 흐리게 */
    c.save();
    c.globalAlpha = 0.16;
    c.fillStyle = '#ffffff';
    c.font = '700 ' + Math.round(h * 0.62) + 'px "Malgun Gothic", serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(fac.mark, w * 0.5, h * 0.46);
    c.restore();

    /* 바닥 빛 */
    var floor = c.createRadialGradient(w * 0.5, h * 0.88, 2, w * 0.5, h * 0.88, w * 0.5);
    floor.addColorStop(0, 'rgba(255,255,255,0.20)');
    floor.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = floor;
    c.fillRect(0, h * 0.62, w, h * 0.38);

    /* 인물 · 펫 — **딴 캔버스에 그려 그것만** 후처리한 뒤 얹는다.
       (배경까지 같이 훑으면 문양의 윤곽이 인물을 가로지른다) */
    var figCv = document.createElement('canvas');
    figCv.width = cv.width; figCv.height = cv.height;
    var fig = figCv.getContext('2d');
    fig.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (isHero) {
      var himg3 = humanImg(humanIndexOf(ref));
      if (himg3.complete && himg3.naturalWidth) {
        fig.imageSmoothingEnabled = false;
        var hw3 = h * 0.62;
        fig.drawImage(himg3, w * 0.5 - hw3 / 2, h * 0.93 - hw3, hw3, hw3);
      } else {
        loadingMark(fig, w * 0.5, h * 0.93, h * 0.6, fac.color);
      }
    } else {
      var pimg3 = petImgOf(ref);
      if (pimg3) {
        fig.imageSmoothingEnabled = false;
        var pw3 = h * 0.62;
        fig.drawImage(pimg3, w * 0.5 - pw3 / 2, h * 0.93 - pw3, pw3, pw3);
      } else {
        /* 짐승은 가로로 긴 형태(용·물고기)가 있어 폭 기준으로 맞춘다 (bake 상자 = 2.3H) */
        loadingMark(fig, w * 0.5, h * 0.80, h * 0.6, fac.color);
      }
    }
    diabloize(figCv, { rimK: 0.5 });
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);      // 이미 배율이 반영된 캔버스라 그대로 얹는다
    c.drawImage(figCv, 0, 0);
    c.restore();

    /* 등급 테두리 */
    c.strokeStyle = rar.color;
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);
    c.strokeStyle = 'rgba(255,255,255,0.18)';
    c.lineWidth = 1;
    c.strokeRect(4.5, 4.5, w - 9, h - 9);

    cardCache[key] = cv.toDataURL();
    return cardCache[key];
  }

  global.DG = global.DG || {};
  global.DG.sprite = {
    portraitCard: portraitCard,
    stamp: stamp, stampStats: stampStats,
    lookOf: lookOf, beastFormOf: beastFormOf, beastColorOf: beastColorOf,
    peopleList: peopleList, personKeyOf: personKeyOf,
    portrait: portrait, shade: shade
  };
})(window);
