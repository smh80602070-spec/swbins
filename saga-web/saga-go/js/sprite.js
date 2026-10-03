/**
 * 스프라이트 — 인물·짐승 그림(초상·지도 스탬프)과 건물 그림
 * ---------------------------------------------------------------
 * 인물·짐승은 실제 그림(Kenney `assets/sprites2d/human_*`·베이크한 `beast_*`)을
 * 쓴다 — 옛 캔버스 절차적 그림(human()/beast())은 2026-09-22 Phase 4 에서
 * 지웠다(사용자 결정). 그림이 아직 안 실린 순간에만 `loadingMark()` 자리표시가
 * 잠깐 보인다. `storyize()` 가 실사/그림 구분 없이 종이·선화 톤으로 훑어
 * 인물·짐승·건물이 한 양식으로 보이게 한다.
 *
 *   building(ctx, o)  건물 — 한옥 기와 실루엣. world.js 의 역참 마커가 진입점.
 *                     `o.img` 가 있으면 절차적 도형 대신 구운 그림을 쓴다
 *
 * 외형 파라미터는 인물마다 일일이 적지 않는다. 기질(무/지/덕)·세력·등급에서
 * 규칙으로 뽑고, 특징이 뚜렷한 인물만 예외 표에 적는다(LOOKS) — `lookOf()` 는
 * 지금도 남아 있지만(다른 판·확장에서 참고), 지도·초상 그림엔 더는 안 쓰인다.
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
   * 그림책(도감)풍 하나로 고정이다 — 얇은 갈색 선화 + 낮은 채도의 플랫 채색.
   * 다 그린 다음 픽셀에서 한 번 훑어 만든다(storyize 참조) — 선화·플랫 채색은
   * 도형마다 손보는 게 아니라 화면 전체에 걸리는 성질이라 인물 48·짐승 25·
   * 장비까지 한 번에 맞추는 유일한 길이다.
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

  /** id 로 고정되는 정수 — 표에 없는 인물의 무기·투구를 다양하게 흩는 데 쓴다
   *  (2026-09-06, "주변 캐릭터들이 다양하지 않다" 개선) */
  function idSeed(id) {
    var h = 0, s = id || 'x';
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff; }
    return h;
  }

  /** 표에 없는 인물은 기질·등급에서 규칙으로 만든다.
   *
   * **2026-09-06 전까지는 기질 셋(might·wisdom·그 외)이 곧 옷 한 벌이었다** —
   * `LOOKS` 표에 없는 다수(수백 명)가 셋 중 하나로 완전히 똑같이 보였다
   * ("주변 캐릭터들도 다양하지 않네·색깔별로라도 넣어주고 옷은 더 없어?").
   * 이제 같은 기질 안에서도 `idSeed(hero.id)`로 무기·투구·망토·수염 유무를
   * 흩는다 — **무작위가 아니라 id 고정**이라 같은 인물은 오늘도 내일도
   * 같은 차림이다(그림책 캐릭터 디자인이 매번 바뀌면 안 된다). */
  function ruleLook(hero) {
    var seed = idSeed(hero.id);
    if (hero.trait === 'might') {
      var mWeapons = ['spear', 'halberd', 'guandao', 'axe', 'club'];
      return {
        weapon: mWeapons[seed % mWeapons.length],
        helm: (seed >> 3) % 5 === 0 ? 'gapju' : 'helmet',
        armor: 'plate',
        cape: hero.rarity >= 5 || (seed >> 5) % 4 === 0,
        beard: (seed >> 2) % 3 === 0
      };
    }
    if (hero.trait === 'wisdom') {
      var wWeapons = ['scroll', 'fan', 'staff', 'brush'];
      return {
        weapon: wWeapons[seed % wWeapons.length],
        helm: 'scholar',
        armor: (seed >> 3) % 3 === 0 ? 'coat' : 'robe',
        glasses: (seed >> 4) % 3 === 0,
        beard: (seed >> 2) % 4 === 0
      };
    }
    var vWeapons = ['sword', 'spear', 'axe', 'club'];
    return {
      weapon: vWeapons[seed % vWeapons.length],
      helm: hero.rarity >= 5 ? 'crown' : ((seed >> 3) % 3 === 0 ? 'none' : 'gat'),
      armor: (seed >> 4) % 4 === 0 ? 'dress' : ((seed >> 4) % 4 === 1 ? 'coat' : 'robe'),
      cape: hero.rarity >= 4 || (seed >> 5) % 5 === 0,
      skirt: (seed >> 6) % 4 === 0,
      beard: (seed >> 2) % 4 === 1
    };
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

  /**
   * @param o {x, y, s, facing, phase, walking, color, skin, look, t}
   *          (x, y) 는 발이 닿는 지점. s=1 이면 키 40px.
   */

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
    /* 2026-09-23 — "펫 100개"(2026-09-07) 로 늘어난 64종이 이 표에 없어 전부 `quad`(네발)로 그려졌다.
       물고기·말·공룡만 제 형태로(여덟 형태 그대로 — 진단 "짐승 여덟 형태"). 여우·양·지렁이 등은 네발 기본값 */
    pt_dolphin: 'fish', pt_shark: 'fish', pt_whale: 'fish', pt_manta_ray: 'fish', pt_fish_1: 'fish',
    pt_fish_2: 'fish', pt_fish_3: 'fish', pt_anglerfish: 'fish', pt_armored_catfish: 'fish', pt_betta: 'fish',
    pt_black_lion_fish: 'fish', pt_blobfish: 'fish', pt_blue_goldfish: 'fish', pt_blue_tang: 'fish',
    pt_butterfly_fish: 'fish', pt_cardinal_fish: 'fish', pt_clownfish: 'fish', pt_coral_grouper: 'fish',
    pt_cowfish: 'fish', pt_flatfish: 'fish', pt_flower_horn: 'fish', pt_goblin_shark: 'fish', pt_goldfish: 'fish',
    pt_humphead: 'fish', pt_koi_2: 'fish', pt_lionfish: 'fish', pt_mandarin_fish: 'fish', pt_moorish_idol: 'fish',
    pt_parrot_fish: 'fish', pt_piranha: 'fish', pt_puffer: 'fish', pt_red_snapper: 'fish', pt_royal_gramma: 'fish',
    pt_shark_2: 'fish', pt_sunfish: 'fish', pt_swordfish: 'fish', pt_tang: 'fish', pt_tetra: 'fish', pt_tuna: 'fish',
    pt_turbot: 'fish', pt_yellow_tang: 'fish', pt_zebra_clown_fish: 'fish',
    pt_horse: 'horse', pt_white_horse: 'horse', pt_horse_farm: 'horse', pt_zebra: 'horse', pt_donkey: 'horse',
    pt_t_rex: 'dragon', pt_triceratops: 'dragon', pt_stegosaurus: 'dragon', pt_velociraptor: 'dragon',
    pt_apatosaurus: 'dragon', pt_parasaurolophus: 'dragon'
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
    pk_charizard: '#e0801f', pk_gyarados: '#3fa58a', pk_mewtwo: '#5e2a8c', pk_mew: '#e0901f'
  };

  /**
   * 짐승의 무늬 — 형태(form)가 같아도 이것으로 구분이 된다.
   * 적지 않으면 무늬 없는 민무늬가 된다.
   */
  var BEAST_PATTERN = {
    pt_tiger: 'stripe', pt_baekho: 'stripe', pt_panda: 'patch', pt_deer: 'spot',
    pt_boar: 'tusk', pt_gumiho: 'ninetail', pt_haetae: 'mane', pt_bulgasari: 'mane',
    pt_bear: 'crescent', pt_sapsal: 'shaggy', pt_monkey: 'bareface',
    pk_eevee: 'patch', pk_snorlax: 'patch', pk_mew: 'stripe', pk_mewtwo: 'mane'
  };

  /**
   * 짐승 도감(펫) 지도 스탬프 — 2026-09-11, tools/bake-icons/bake.html로
   * 실제 CC0 GLB(asset3d.js의 pet:form:* 와 같은 목록)를 구워 얻은 PNG로
   * 바꾼다. 형태(form)별 파일 목록에서 `oneOf`(asset3d.js:337)와 **같은
   * 해시**로 하나를 고른다 — 그래야 같은 펫이 도감 3D 초상과 지도 스탬프에서
   * 같은 개체로 보인다. 배경 생물(animal.js, id `an_*`)도 2026-09-20 Phase 3 에서
   * `BG_BEAST_FILE`(아래)로 마저 채워 지금은 짐승 전부가 실제 그림을 쓴다.
   *
   * ogre 형태(도깨비·어둑귀·고깔도사·별손님)는 2026-09-11 첫 배치 굽기에선 셋
   * (Orc·Demon·BlueDemon, 큰 임베디드 .gltf)이 헤드리스 크롬에서 로더
   * 콜백이 영영 안 와 구워지지 않았었다 — 이후(같은 날 이어서) 다시 확인해
   * 보니 **간헐적**이었다(같은 파일을 격리된 새 브라우저 프로세스에서 다시
   * 열면 되기도 했다, 원인은 끝내 못 밝힘). 재시도 끝에 셋 다 구웠다.
   */
  var BEAST_FORM_FILES = {
    quad: ['Deer', 'Wolf', 'Cow', 'Alpaca', 'Bull', 'Donkey', 'Fox', 'Husky', 'ShibaInu', 'Stag'],
    bird: ['Pigeon', 'Birb'],
    fish: ['Koi', 'Shark', 'Dolphin', 'Manta_ray'],
    horse: ['Horse', 'Horse_White'],
    toad: ['Frog'],
    dragon: ['Trex', 'Triceratops', 'Stegosaurus', 'Velociraptor'],
    turtle: ['Snake', 'Snake_angry'],
    ogre: ['Orc', 'Demon', 'BlueDemon'],
    /* 2026-09-25 — 절차 펫(`ptgen*_`, genchar*.js) 전용 풀: 땅짐승 스물셋(네발 열 벌만 돌려 입던 것을 넓혔다). asset3d `pet:form:gen` 과 같은 순서 */
    gen: ['Deer', 'Wolf', 'Cow', 'Alpaca', 'Bull', 'Donkey', 'Fox', 'Husky', 'ShibaInu', 'Stag', 'Tiger', 'Bear', 'Boar', 'Panda', 'Monkey', 'Cat', 'Llama', 'Pig', 'Pug', 'Sheep', 'Zebra', 'Horse_Farm', 'Cow_Farm']
  };
  /* 2026-09-25 — 현대·미래 들판 적(field-combat FOES, id `fc_<종류>`, asset3d `pet:fc_*` 와 같은 모델). 여태 2D 그림이 없어 회색 로딩 표시였다 */
  var FC_BEAST_FILE = { fc_rat: 'Rat', fc_wasp: 'Wasp', fc_zombie: 'Zombie', fc_drone: 'Robot_Drone', fc_walker: 'Robot_Walker',
    fc_alien: 'Alien', fc_hulk: 'Robot_Large' };
  /* 도감 펫 중 **제 모델이 있는 종**(asset3d.js `pet:pt_*`, 2026-09-23)은 형태 해시가 아니라 그 모델을 구운 그림을 쓴다 —
     3D 초상과 지도 스탬프가 같은 동물이어야 한다(예전엔 고래가 초상은 사슴·지도도 사슴). `_x2` 는 animals_extra2 쪽 같은 이름 모델 */
  var PET_BEAST_FILE = {
    pt_alpaca: 'Alpaca', pt_anglerfish: 'Anglerfish', pt_apatosaurus: 'Apatosaurus',
    pt_armored_catfish: 'Armored_Catfish', pt_bear: 'Bear', pt_betta: 'Betta',
    pt_black_lion_fish: 'Black_Lion_Fish', pt_blobfish: 'Blobfish', pt_blue_goldfish: 'Blue_Goldfish',
    pt_blue_tang: 'Blue_Tang', pt_boar: 'Boar', pt_bull: 'Bull', pt_butterfly_fish: 'Butterfly_Fish',
    pt_cardinal_fish: 'Cardinal_Fish', pt_carp: 'Koi', pt_cat: 'Cat', pt_clownfish: 'Clownfish',
    pt_coral_grouper: 'Coral_Grouper', pt_cow: 'Cow', pt_cow_farm: 'Cow_Farm', pt_cowfish: 'Cowfish',
    pt_crane: 'Crane', pt_deer: 'Deer', pt_dolphin: 'Dolphin', pt_donkey: 'Donkey', pt_fish_1: 'Fish1',
    pt_fish_2: 'Fish2', pt_fish_3: 'Fish3', pt_flatfish: 'Flatfish', pt_flower_horn: 'Flower_Horn', pt_fox: 'Fox',
    pt_goblin_shark: 'Goblin_Shark', pt_goldfish: 'Goldfish', pt_horse: 'Horse', pt_horse_farm: 'Horse_Farm',
    pt_humphead: 'Humphead', pt_jindo: 'ShibaInu', pt_koi_2: 'Koi_x2', pt_lionfish: 'Lionfish', pt_llama: 'Llama',
    pt_mandarin_fish: 'Mandarin_Fish', pt_manta_ray: 'Manta_ray', pt_monkey: 'Monkey',
    pt_moorish_idol: 'Moorish_Idol', pt_owl: 'Owl', pt_panda: 'Panda', pt_parasaurolophus: 'Parasaurolophus',
    pt_parrot_fish: 'Parrot_Fish', pt_pig: 'Pig', pt_piranha: 'Piranha', pt_puffer: 'Puffer', pt_pug: 'Pug',
    pt_red_snapper: 'Red_Snapper', pt_royal_gramma: 'Royal_Gramma', pt_sapsal: 'Husky', pt_shark: 'Shark',
    pt_shark_2: 'Shark_x2', pt_sheep: 'Sheep', pt_stag: 'Stag', pt_stegosaurus: 'Stegosaurus',
    pt_sunfish: 'Sunfish', pt_swordfish: 'Swordfish', pt_t_rex: 'Trex', pt_tang: 'Tang', pt_tetra: 'Tetra',
    pt_tiger: 'Tiger', pt_toad: 'Frog', pt_triceratops: 'Triceratops', pt_tuna: 'Tuna', pt_turbot: 'Turbot',
    pt_velociraptor: 'Velociraptor', pt_whale: 'Whale', pt_white_horse: 'Horse_White', pt_worm: 'Worm',
    pt_yellow_tang: 'Yellow_Tang', pt_zebra: 'Zebra', pt_zebra_clown_fish: 'Zebra_Clown_Fish',
    /* 2026-09-25 — 신수·오마주·까치 28종도 제 모델(asset3d.js 같은 날 주석, `standin/`) — 지도 그림도 같은 동물 */
    pt_samjogo: 'Birb', pt_haetae: 'Goleling', pt_cheongryong: 'Dragon_Evolved', pt_baekho: 'Tiger', pt_jujak: 'Hywirl',
    pt_hyeonmu: 'Snake', pt_gumiho: 'Fox', pt_dokkaebi: 'Orc', pt_bulgasari: 'Elephant', pt_jeoktoma: 'Horse',
    pt_jeolyeong: 'Horse_White', pt_magpie: 'Pigeon',
    pk_bulbasaur: 'Mushnub', pk_charmander: 'Dino', pk_squirtle: 'Squidle', pk_magikarp: 'Glub', pk_pikachu: 'Bunny',
    pk_eevee: 'Monkroose', pk_slowbro: 'Pink_Slime', pk_gengar: 'Ghost', pk_snorlax: 'Yeti', pk_lapras: 'Glub_Evolved',
    pk_alakazam: 'Wizard', pk_dragonite: 'Alpaking', pk_charizard: 'Dragon', pk_gyarados: 'Snake_angry', pk_mewtwo: 'Alien_2',
    pk_mew: 'Cat_Monster'
  };
  var beastImgCache = {};
  function beastImgFile(name) {
    var src = 'assets/sprites2d/beast_' + name + '.png';
    var im = beastImgCache[src];
    if (!im) { im = new Image(); im.src = src; beastImgCache[src] = im; }
    return im;
  }
  /* 들·강의 배경 생물(`animal.js`, id `an_*`)은 도감 펫과 달리 형태당 여럿 중 해시로 고르지 않고
     닮은 모델 하나를 못 박는다 — 사슴은 언제나 사슴이어야 한다 */
  var BG_BEAST_FILE = {
    an_deer: 'Deer', an_wolf: 'Wolf', an_magpie: 'Pigeon', an_carp: 'Koi', an_ox: 'Cow'
  };
  /** 도감 펫(id가 pt_/pk_로 시작)과 배경 생물(`an_`, 표에 있는 것)에 적용한다 */
  function beastImgOf(pet) {
    if (!pet || !pet.id) { return null; }
    if (BG_BEAST_FILE[pet.id]) { return beastImgFile(BG_BEAST_FILE[pet.id]); }
    if (FC_BEAST_FILE[pet.id]) { return beastImgFile(FC_BEAST_FILE[pet.id]); }
    if (!/^(pt_|pk_|ptgen[a-z]*_)/.test(pet.id)) { return null; }   // 절차 펫(2026-09-25)도 — 3D 와 같은 해시·같은 풀
    if (PET_BEAST_FILE[pet.id]) { return beastImgFile(PET_BEAST_FILE[pet.id]); }
    var list = BEAST_FORM_FILES[beastFormOf(pet)];
    if (!list) { return null; }
    var s = String(pet.id || pet.name || ''), h = 0, i;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return beastImgFile(list[h % list.length]);
  }

  function beastPatternOf(pet) { return (pet && BEAST_PATTERN[pet.id]) || ''; }
  /* 도감에 없는 짐승(`animal.js`, 잡는 대상이 아니라 도감에 자리가 없다)은
     `form`·`color` 를 제가 직접 들고 온다 — 도감 펫엔 그 필드가 없다 */
  function beastFormOf(pet) {
    if (!pet) { return 'quad'; }
    return pet.form || BEAST_FORM[pet.id] || (/^ptgen[a-z]*_/.test(pet.id || '') ? 'gen' : 'quad');
  }
  function beastColorOf(pet) { return (pet && (pet.color || BEAST_COLOR[pet.id])) || '#9a8f7a'; }

  /**
   * @param o {x, y, s, facing, phase, walking, form, color, divine, t}
   */

  /* ── 건물 ─────────────────────────────────────────────── */

  /**
   * @param o {x, y, s, form, color, t, night}
   *          (x, y) 는 바닥 중앙. s=1 이면 높이 약 46px.
   */
  var ROOF = {
    hall: '#3f4a5c', barracks: '#5f3c3c', wall: '#6c6c76', market: '#7a4636',
    library: '#3c5450', stable: '#5a4530', farm: '#4a6b32', forge: '#4a4a54',
    beacon: '#6a6a74', shrine: '#8a3b32'
  };

  /** 성채·역참 지도 마커 — 2026-09-11, tools/bake-icons/bake.html로 구운
   *  실제 CC0 건물 GLB 스냅샷(assets/models/buildings/*.glb, asset3d.js의
   *  fort:t1/t2·station 표와 같은 파일). `o.img`에 로드된 Image를 넘기면
   *  절차적 도형 대신 이 그림을 쓴다 — world.js가 등급(fort tier)·종류에
   *  맞는 그림을 골라 넘긴다. 역참은 3D 와 같은 tower_ruin 을 구워 쓴다(2026-09-23, `_bake_one.html?...&fit=1.1`
   *  — 그전엔 굽기가 멎어 옛 여관 모델 Inn.glb 그림을 썼다, `building_Inn.png` 은 되돌림 자리로 남김). `o.img`를
   *  안 넘기거나 아직 안 실렸으면 여기 그대로 절차적 그림으로 떨어진다. */
  var buildingImgCache = {};
  function buildingImg(name) {
    var src = 'assets/sprites2d/building_' + name + '.png';
    var im = buildingImgCache[src];
    if (!im) { im = new Image(); im.src = src; buildingImgCache[src] = im; }
    return im;
  }

  function building(ctx, o) {
    if (o.kind2d && global.DG.mode2d && global.DG.mode2d.drawKind(ctx, o.kind2d, o.x, o.y, o.s || 1)) { return; }   // 2D 모드 통일 스프라이트(W-0022) — 없으면 아래 옛 그림
    if (o.img && o.img.complete && o.img.naturalWidth) {
      var H0 = 46 * (o.s || 1), bw = H0 * 1.3, bh = H0 * 1.3;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(o.img, o.x - bw / 2, o.y - bh, bw, bh);
      ctx.restore();
      return;
    }
    var H = 46 * (o.s || 1);
    var form = o.form || 'hall';
    var wood = '#7a5334', woodDark = '#5a3c26';
    var roof = o.color || ROOF[form] || '#3f4a5c', roofLite = shade(roof, 0.22), roofDark = shade(roof, -0.4);
    var wall = '#d9cdb4', wallDark = '#b8a98c';

    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.lineJoin = 'round';

    function tiledRoof(cx, cy, w, h) {          // 처마가 살짝 올라간 기와지붕
      ctx.beginPath();
      ctx.moveTo(cx - w, cy);
      ctx.quadraticCurveTo(cx - w * 0.55, cy + h * 0.14, cx - w * 0.30, cy - h * 0.62);
      ctx.lineTo(cx + w * 0.30, cy - h * 0.62);
      ctx.quadraticCurveTo(cx + w * 0.55, cy + h * 0.14, cx + w, cy);
      ctx.closePath();
      var g = ctx.createLinearGradient(0, cy - h, 0, cy);
      g.addColorStop(0, roofLite); g.addColorStop(1, roofDark);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = H * 0.02; ctx.stroke();
      // 기와 골
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = H * 0.012;
      for (var i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * w * 0.22, cy - h * 0.6);
        ctx.lineTo(cx + i * w * 0.30, cy - h * 0.02);
        ctx.stroke();
      }
      // 용마루 — 지붕 꼭대기의 밝은 선
      ctx.strokeStyle = shade(roof, 0.42); ctx.lineWidth = H * 0.026;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.30, cy - h * 0.62);
      ctx.lineTo(cx + w * 0.30, cy - h * 0.62);
      ctx.stroke();
      // 처마 밑 단청 — 붉은 띠에 푸른 점
      ctx.fillStyle = 'rgba(170,60,50,0.75)';
      ctx.fillRect(cx - w * 0.86, cy - h * 0.02, w * 1.72, H * 0.026);
      ctx.fillStyle = 'rgba(70,110,160,0.75)';
      for (var dc = -3; dc <= 3; dc++) {
        ctx.fillRect(cx + dc * w * 0.24 - H * 0.012, cy - h * 0.02, H * 0.024, H * 0.026);
      }
    }

    /** 기단 — 건물을 석축 위에 올려 놓으면 바닥에 박힌 느낌이 사라진다 */
    function stylobate(cx, cy, w) {
      ctx.beginPath();
      ctx.moveTo(cx - w * 1.10, cy);
      ctx.lineTo(cx + w * 1.10, cy);
      ctx.lineTo(cx + w * 1.00, cy - H * 0.075);
      ctx.lineTo(cx - w * 1.00, cy - H * 0.075);
      ctx.closePath();
      ctx.fillStyle = '#9b9689'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = H * 0.01;
      ctx.stroke();
      // 계단
      ctx.fillStyle = '#b3aea0';
      ctx.fillRect(cx - w * 0.20, cy - H * 0.055, w * 0.40, H * 0.055);
    }

    function body(cx, cy, w, h) {               // 벽 + 기둥 + 문
      ctx.fillStyle = wall;
      ctx.fillRect(cx - w, cy - h, w * 2, h);
      ctx.fillStyle = wallDark;
      ctx.fillRect(cx - w, cy - h * 0.16, w * 2, h * 0.16);
      ctx.fillStyle = woodDark;
      ctx.fillRect(cx - w, cy - h, w * 0.13, h);
      ctx.fillRect(cx + w - w * 0.13, cy - h, w * 0.13, h);
      ctx.fillStyle = wood;
      ctx.fillRect(cx - w * 0.26, cy - h * 0.78, w * 0.52, h * 0.78);
      ctx.fillStyle = 'rgba(255,214,120,0.5)';
      ctx.fillRect(cx - w * 0.18, cy - h * 0.66, w * 0.36, h * 0.42);
      // 창호 격자 — 문에 세로 두 줄, 가로 한 줄
      ctx.strokeStyle = woodDark; ctx.lineWidth = H * 0.012;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.78); ctx.lineTo(cx, cy);
      ctx.moveTo(cx - w * 0.26, cy - h * 0.40); ctx.lineTo(cx + w * 0.26, cy - h * 0.40);
      ctx.stroke();
      // 좌우 벽의 작은 창
      ctx.fillStyle = 'rgba(240,225,190,0.55)';
      ctx.fillRect(cx - w * 0.72, cy - h * 0.70, w * 0.24, h * 0.26);
      ctx.fillRect(cx + w * 0.48, cy - h * 0.70, w * 0.24, h * 0.26);
    }

    if (form === 'hall') {                       // 집무전 — 2층 기와 + 기단 + 현판
      stylobate(0, 0, H * 0.42);
      body(0, 0, H * 0.42, H * 0.42);
      // 현판 — 처마 아래 벽면에 걸린다
      ctx.fillStyle = '#2a2620';
      ctx.fillRect(-H * 0.13, -H * 0.37, H * 0.26, H * 0.075);
      ctx.fillStyle = '#d9b23c';
      ctx.fillRect(-H * 0.11, -H * 0.355, H * 0.22, H * 0.013);
      ctx.fillRect(-H * 0.11, -H * 0.322, H * 0.22, H * 0.013);
      tiledRoof(0, -H * 0.42, H * 0.56, H * 0.26);
      body(0, -H * 0.62, H * 0.30, H * 0.28);
      tiledRoof(0, -H * 0.90, H * 0.44, H * 0.24);
      ctx.fillStyle = '#d9b23c';
      ctx.fillRect(-H * 0.03, -H * 1.14, H * 0.06, H * 0.12);
    } else if (form === 'barracks') {            // 병영 — 낮은 건물 + 깃발
      body(0, 0, H * 0.44, H * 0.34);
      tiledRoof(0, -H * 0.34, H * 0.56, H * 0.22);
      flag(ctx, H * 0.34, -H * 0.52, H, o.t, '#c0453c');
      flag(ctx, -H * 0.34, -H * 0.52, H, (o.t || 0) + 400, '#c0453c');
    } else if (form === 'wall') {                // 성벽 — 톱니 성가퀴
      ctx.fillStyle = '#8f8f98';
      ctx.fillRect(-H * 0.52, -H * 0.46, H * 1.04, H * 0.46);
      ctx.fillStyle = '#a8a8b2';
      for (var w2 = -2; w2 <= 2; w2++) {
        ctx.fillRect(w2 * H * 0.22 - H * 0.08, -H * 0.60, H * 0.16, H * 0.16);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = H * 0.012;
      for (var r2 = 1; r2 <= 3; r2++) {
        ctx.beginPath();
        ctx.moveTo(-H * 0.52, -H * 0.46 + r2 * H * 0.11);
        ctx.lineTo(H * 0.52, -H * 0.46 + r2 * H * 0.11);
        ctx.stroke();
      }
    } else if (form === 'market') {              // 저잣거리 — 천막 + 좌판
      ctx.fillStyle = woodDark;
      ctx.fillRect(-H * 0.40, -H * 0.26, H * 0.80, H * 0.10);
      ctx.beginPath();
      ctx.moveTo(-H * 0.50, -H * 0.30);
      ctx.lineTo(H * 0.50, -H * 0.30);
      ctx.lineTo(H * 0.34, -H * 0.54);
      ctx.lineTo(-H * 0.34, -H * 0.54);
      ctx.closePath();
      ctx.fillStyle = '#c9563f'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = H * 0.02;
      ctx.beginPath();
      ctx.moveTo(-H * 0.12, -H * 0.30); ctx.lineTo(-H * 0.05, -H * 0.54);
      ctx.moveTo(H * 0.12, -H * 0.30); ctx.lineTo(H * 0.05, -H * 0.54);
      ctx.stroke();
      ctx.fillStyle = wood;
      ctx.fillRect(-H * 0.46, -H * 0.30, H * 0.05, H * 0.30);
      ctx.fillRect(H * 0.41, -H * 0.30, H * 0.05, H * 0.30);
    } else if (form === 'library') {             // 서고 — 낮고 긴 건물
      body(0, 0, H * 0.44, H * 0.30);
      tiledRoof(0, -H * 0.30, H * 0.54, H * 0.20);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-H * 0.36, -H * 0.24, H * 0.14, H * 0.12);
      ctx.fillRect(H * 0.22, -H * 0.24, H * 0.14, H * 0.12);
    } else if (form === 'stable') {              // 마구간 — 개방형
      ctx.fillStyle = woodDark;
      ctx.fillRect(-H * 0.42, -H * 0.34, H * 0.84, H * 0.34);
      ctx.fillStyle = '#3b2c1f';
      ctx.fillRect(-H * 0.30, -H * 0.30, H * 0.24, H * 0.30);
      ctx.fillRect(H * 0.06, -H * 0.30, H * 0.24, H * 0.30);
      ctx.beginPath();
      ctx.moveTo(-H * 0.50, -H * 0.34);
      ctx.lineTo(H * 0.50, -H * 0.34);
      ctx.lineTo(H * 0.36, -H * 0.56);
      ctx.lineTo(-H * 0.36, -H * 0.56);
      ctx.closePath();
      ctx.fillStyle = '#6b5030'; ctx.fill();
    } else if (form === 'farm') {                // 둔전 — 이랑 + 허수아비
      ctx.fillStyle = '#4a6b32';
      ctx.beginPath();
      ctx.ellipse(0, -H * 0.06, H * 0.52, H * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6f9147'; ctx.lineWidth = H * 0.03;
      for (var f = -2; f <= 2; f++) {
        ctx.beginPath();
        ctx.moveTo(f * H * 0.18 - H * 0.06, -H * 0.02);
        ctx.lineTo(f * H * 0.18 + H * 0.02, -H * 0.22);
        ctx.stroke();
      }
      ctx.strokeStyle = wood; ctx.lineWidth = H * 0.035;
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.10); ctx.lineTo(0, -H * 0.46);
      ctx.moveTo(-H * 0.14, -H * 0.34); ctx.lineTo(H * 0.14, -H * 0.34);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -H * 0.52, H * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = '#c9a24a'; ctx.fill();
    } else if (form === 'forge') {               // 대장간 — 화덕 + 연기
      body(0, 0, H * 0.34, H * 0.30);
      tiledRoof(0, -H * 0.30, H * 0.44, H * 0.18);
      ctx.fillStyle = '#5a5a64';
      ctx.fillRect(H * 0.20, -H * 0.62, H * 0.12, H * 0.32);
      var t = (o.t || 0) / 900;
      for (var sm = 0; sm < 3; sm++) {
        var k = (t + sm * 0.33) % 1;
        ctx.beginPath();
        ctx.arc(H * 0.26 + Math.sin(k * 6) * H * 0.05, -H * 0.66 - k * H * 0.34,
          H * (0.05 + k * 0.06), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,200,210,' + (0.28 * (1 - k)) + ')';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, -H * 0.12, H * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,150,60,0.85)'; ctx.fill();
    } else if (form === 'beacon') {              // 봉수대 — 돌탑 + 불
      ctx.fillStyle = '#8a8a94';
      ctx.beginPath();
      ctx.moveTo(-H * 0.26, 0);
      ctx.lineTo(H * 0.26, 0);
      ctx.lineTo(H * 0.17, -H * 0.62);
      ctx.lineTo(-H * 0.17, -H * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = H * 0.012;
      for (var b2 = 1; b2 <= 4; b2++) {
        ctx.beginPath();
        ctx.moveTo(-H * 0.26 + b2 * H * 0.02, -b2 * H * 0.14);
        ctx.lineTo(H * 0.26 - b2 * H * 0.02, -b2 * H * 0.14);
        ctx.stroke();
      }
      var fl = 1 + Math.sin((o.t || 0) / 130) * 0.18;
      ctx.beginPath();
      ctx.moveTo(-H * 0.13, -H * 0.62);
      ctx.quadraticCurveTo(-H * 0.05, -H * (0.62 + 0.30 * fl), 0, -H * (0.62 + 0.42 * fl));
      ctx.quadraticCurveTo(H * 0.05, -H * (0.62 + 0.30 * fl), H * 0.13, -H * 0.62);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,150,50,0.92)'; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-H * 0.06, -H * 0.62);
      ctx.quadraticCurveTo(0, -H * (0.62 + 0.26 * fl), H * 0.06, -H * 0.62);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,235,140,0.95)'; ctx.fill();
    } else if (form === 'shrine') {              // 사당 — 홍살문
      ctx.fillStyle = '#a33b32';
      ctx.fillRect(-H * 0.34, -H * 0.62, H * 0.08, H * 0.62);
      ctx.fillRect(H * 0.26, -H * 0.62, H * 0.08, H * 0.62);
      ctx.fillRect(-H * 0.44, -H * 0.70, H * 0.88, H * 0.08);
      ctx.fillRect(-H * 0.38, -H * 0.54, H * 0.76, H * 0.05);
      ctx.beginPath();
      ctx.moveTo(-H * 0.50, -H * 0.70);
      ctx.lineTo(H * 0.50, -H * 0.70);
      ctx.lineTo(H * 0.34, -H * 0.84);
      ctx.lineTo(-H * 0.34, -H * 0.84);
      ctx.closePath();
      ctx.fillStyle = '#2f3a4a'; ctx.fill();
    } else {
      body(0, 0, H * 0.38, H * 0.34);
      tiledRoof(0, -H * 0.34, H * 0.50, H * 0.20);
    }

    ctx.restore();
  }

  function flag(ctx, x, y, H, t, color) {
    ctx.strokeStyle = '#6b5030'; ctx.lineWidth = H * 0.02;
    ctx.beginPath();
    ctx.moveTo(x, y + H * 0.30); ctx.lineTo(x, y - H * 0.22);
    ctx.stroke();
    var wv = Math.sin((t || 0) / 240) * H * 0.03;
    ctx.beginPath();
    ctx.moveTo(x, y - H * 0.22);
    ctx.quadraticCurveTo(x + H * 0.10, y - H * 0.16 + wv, x + H * 0.20, y - H * 0.20);
    ctx.lineTo(x + H * 0.20, y - H * 0.05);
    ctx.quadraticCurveTo(x + H * 0.10, y - H * 0.02 + wv, x, y - H * 0.06);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
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

  /** 지도 위 사람 그림 — Kenney Roguelike Characters(CC0, saga-forest 2026-09-02
   *  선례와 같은 파일·같은 결)에서 오려 낸 열넷 중 인물 id 로 하나를 정해
   *  고른다(같은 인물은 늘 같은 얼굴). 등신·양식·개인별 색상·걷기 다리
   *  애니메이션은 이 그림 하나로는 못 낸다(고정 그림이라) — 그 대신 걸음
   *  통통거림(stamp() 의 bounce)과 좌우 뒤집기는 그대로 산다. 도감·상세 카드의
   *  인물 초상은 이 그림이 아니라 이미 3D(portrait3d.js)로 가 있어 영향이
   *  없다 — 지도 위에서 걸어 다니는 모습만 바뀐다. PLAN 부록("코드로 그리지
   *  말고 에셋으로") 방침 */
  var HUMAN_SPRITE_N = 14;
  var humanImgCache = {};
  function humanImg(i) {
    var n = ((i - 1) % HUMAN_SPRITE_N + HUMAN_SPRITE_N) % HUMAN_SPRITE_N + 1;
    var src = 'assets/sprites2d/human_' + (n < 10 ? '0' + n : n) + '.png';
    var im = humanImgCache[src];
    if (!im) { im = new Image(); im.src = src; humanImgCache[src] = im; }
    return im;
  }
  function humanIndexOf(ref) {
    var id = String((ref && (ref.id || ref.key || ref.name)) || 'anon');
    var h = 0;
    for (var i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) >>> 0; }
    return (h % HUMAN_SPRITE_N) + 1;
  }

  /** 그림이 아직 안 실린 순간에만 잠깐 보이는 자리표시(머리 원 + 몸통 타원) —
   *  human()/beast() 절차적 그림을 대신한다(2026-09-22 Phase 4, 되돌림 그림 제거).
   *  로컬 PNG 라 대개 한두 프레임 안에 실리고, 실리면 stamp() 의 imgReady
   *  검사가 이 컷을 곧바로 다시 굽는다(캐시에 박제되지 않는다) */
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

    var useImg = false;
    if (kind === 'human') {
      var himg = humanImg(humanIndexOf(o.ref));
      if (himg.complete && himg.naturalWidth) {
        useImg = true;
        var hdw = H * 1.2, hdh = H * 1.2;
        c.imageSmoothingEnabled = false;
        c.drawImage(himg, footX - hdw / 2, footY - hdh, hdw, hdh);
      } else {
        loadingMark(c, footX, footY, H, o.color);
      }
    } else {
      var bimg = beastImgOf(o.ref);
      if (bimg && bimg.complete && bimg.naturalWidth) {
        useImg = true;
        var bdw = H * 1.5, bdh = H * 1.5;
        c.imageSmoothingEnabled = false;
        c.drawImage(bimg, footX - bdw / 2, footY - bdh, bdw, bdh);
      } else {
        loadingMark(c, footX, footY, H, o.color);
      }
    }
    /* 여기서 한 번 훑는다 — 지도 위 스탬프는 어두운 배경에 서므로
       실루엣만 밝은 테를 둘러 형태가 묻히지 않게 한다 */
    storyize(cv, { rim: STORY_RIM_MAP, inner: H >= 40, thick: 1 });
    return { cv: cv, w: w, h: h, footX: footX, footY: footY, base: base, sc: sc, img: useImg };
  }

  /** 이 그림 파일이 이미 실렸는가 — 안 실린 채 구운 코드 그림 컷을 다시 굽는 기준 */
  function imgReady(kind, ref) {
    var im = kind === 'human' ? humanImg(humanIndexOf(ref)) : beastImgOf(ref);
    return !!(im && im.complete && im.naturalWidth);
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
    if (e && !e.img && imgReady(kind, o.ref)) { e = null; }   // 그림이 실리기 전에 구운 코드 그림 컷은 다시 굽는다
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

  /* ── 그림책풍 후처리 ────────────────────────────────────
   * 다 그린 스프라이트를 픽셀에서 한 번 훑는다.
   *   1) 채도를 낮추고 살짝 밝힌 뒤 색을 계단으로 끊는다 → 플랫 채색
   *   2) 밝기 단차·실루엣 경계를 찾아 얇은 선을 얹는다   → 선화
   *
   * 도형 코드를 건드리지 않으므로 인물·짐승·장비·건물이 한꺼번에 같은 양식이 된다.
   * 비용은 **캐시 미스 때 한 번**만 든다 (스탬프·초상 모두 캐시된다).
   *
   * 선 색을 두 가지로 쓴다:
   *   line 안쪽 경계 — 짙은 갈색 (종이 위 펜선)
   *   rim  실루엣    — 지도 스탬프는 어두운 지도 위에 서므로 밝은 테를 두른다.
   *                    (짙은 갈색으로 두르면 배경에 묻혀 형태가 사라진다)
   */
  var STORY_LINE = [78, 60, 46];
  var STORY_RIM_MAP = [242, 232, 208];
  var STORY_STEP = 24;              // 색 계단 폭 — 크면 더 플랫해진다
  var STORY_EDGE = 22;              // 색이 이만큼 꺾이면 선을 긋는다 (채널 최대 차)

  /** 선 굵기 — 화면 배율만큼 굽는데, 선은 **화면에서** 1px 로 보여야 한다 */
  function storyThick() {
    return Math.max(1, Math.round(Math.min(global.devicePixelRatio || 1, 2)));
  }

  function storyize(cv, opts) {
    opts = opts || {};
    var W = cv.width, H = cv.height;
    if (!W || !H) { return; }
    var c = cv.getContext('2d');
    var img;
    try { img = c.getImageData(0, 0, W, H); } catch (e) { return; }   // 오염된 캔버스면 그냥 둔다
    var d = img.data, n = W * H, i, q;

    var alp = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      q = i * 4;
      var a = d[q + 3];
      alp[i] = a;
      if (!a) { continue; }
      var r = d[q], g = d[q + 1], b = d[q + 2];
      var y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * 0.74;                    // 채도 낮추기
      g = y + (g - y) * 0.74;
      b = y + (b - y) * 0.74;
      r = r * 0.90 + 22; g = g * 0.90 + 20; b = b * 0.90 + 15;   // 종이 톤으로 살짝 들어올리기
      r = Math.round(r / STORY_STEP) * STORY_STEP;               // 계단
      g = Math.round(g / STORY_STEP) * STORY_STEP;
      b = Math.round(b / STORY_STEP) * STORY_STEP;
      d[q] = r < 0 ? 0 : (r > 255 ? 255 : r);
      d[q + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
      d[q + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
    }

    /* 경계 찾기 — 1 안쪽 선 · 2 실루엣.
       밝기만 보면 초록 옷과 초록 갑옷처럼 명도가 비슷한 경계를 놓친다.
       그래서 채널별 차이의 최댓값(색 차이)으로 본다. */
    function diff(i1, i2) {
      var a1 = i1 * 4, a2 = i2 * 4;
      var dr = d[a1] - d[a2], dg = d[a1 + 1] - d[a2 + 1], db = d[a1 + 2] - d[a2 + 2];
      dr = dr < 0 ? -dr : dr; dg = dg < 0 ? -dg : dg; db = db < 0 ? -db : db;
      return dr > dg ? (dr > db ? dr : db) : (dg > db ? dg : db);
    }

    /* 작은 스프라이트(지도 위 대상)는 안쪽 선을 빼고 실루엣만 두른다 —
       20~30px 안에 선을 다 그으면 형태가 뭉개져 뼈만 남은 것처럼 보인다. */
    var inner = opts.inner !== false;
    var edge = new Uint8Array(n), x, y2;
    for (y2 = 0; y2 < H; y2++) {
      for (x = 0; x < W; x++) {
        i = y2 * W + x;
        if (alp[i] <= 120) { continue; }
        if ((x + 1 < W && alp[i + 1] < 60) || (x > 0 && alp[i - 1] < 60) ||
            (y2 + 1 < H && alp[i + W] < 60) || (y2 > 0 && alp[i - W] < 60)) {
          edge[i] = 2;
        } else if (inner &&
                   ((x + 1 < W && alp[i + 1] > 120 && diff(i, i + 1) > STORY_EDGE) ||
                    (y2 + 1 < H && alp[i + W] > 120 && diff(i, i + W) > STORY_EDGE))) {
          edge[i] = 1;
        }
      }
    }

    /* 화면 배율이 2 면 1 device px 선은 화면에서 반 픽셀이라 보이지 않는다 —
       그만큼 오른쪽·아래로 한 번 불려 준다 (원본 표시를 따로 둬서 번지지 않게) */
    var thick = opts.thick || storyThick();
    if (thick > 1) {
      var base = edge.slice();
      for (y2 = 0; y2 < H; y2++) {
        for (x = 0; x < W; x++) {
          i = y2 * W + x;
          if (!base[i]) { continue; }
          if (x + 1 < W && !edge[i + 1] && alp[i + 1] > 120) { edge[i + 1] = base[i]; }
          if (y2 + 1 < H && !edge[i + W] && alp[i + W] > 120) { edge[i + W] = base[i]; }
        }
      }
    }

    var line = opts.line || STORY_LINE;
    var rim = opts.rim || line;
    for (i = 0; i < n; i++) {
      if (!edge[i]) { continue; }
      q = i * 4;
      var col = edge[i] === 2 ? rim : line;
      d[q] = d[q] * 0.12 + col[0] * 0.88;
      d[q + 1] = d[q + 1] * 0.12 + col[1] * 0.88;
      d[q + 2] = d[q + 2] * 0.12 + col[2] * 0.88;
      if (d[q + 3] < 240) { d[q + 3] = 240; }
    }
    c.putImageData(img, 0, 0);
  }

  /* ── 초상 캐시 (HTML 목록용) ──────────────────────────── */

  var cache = {};

  /**
   * 오프스크린으로 한 번 그려 data URL 로 캐시한다.
   * 도감처럼 수십 개를 나열할 때 <img> 로 쓰면 가볍다.
   */
  /**
   * @param flat 3D 빌보드용 — **종이 바탕을 깔지 않는다.**
   *   그림책풍(story)은 어두운 UI 에서 선화가 묻히지 않게 종이째 그리는데,
   *   3D 지도 위에 세우면 그 종이가 사각형으로 남아 사람이 액자처럼 떠 보인다.
   *   그래서 빌보드는 배경 없이(=알파) 굽는다.
   */
  function portrait(kind, ref, size, flat) {
    size = size || 56;
    var key = kind + '/' + (ref ? (ref.id || ref.key || ref.name || 'x') : 'x') + '/' + size +
      (flat ? '/flat' : '');
    if (cache[key]) { return cache[key]; }

    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var cv = document.createElement('canvas');
    cv.width = Math.floor(size * dpr);
    cv.height = Math.floor(size * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* 그림책풍은 종이 바탕을 깔고 그린다 — 갈색 선화를 어두운 UI 에 그대로 얹으면
       선이 배경에 묻혀 그림이 뭉개진다. 도감 카드처럼 보이는 효과도 같이 난다. */
    if (!flat) {
      c.fillStyle = '#f2e7cf';
      c.fillRect(0, 0, size, size);
    }

    if (kind === 'hero') {
      var f = global.DG.data.faction(ref.faction);
      var himg4 = humanImg(humanIndexOf(ref));
      if (himg4.complete && himg4.naturalWidth) {
        c.imageSmoothingEnabled = false;
        var hw4 = size * 0.78;
        c.drawImage(himg4, size * 0.5 - hw4 / 2, size * 0.94 - hw4, hw4, hw4);
      } else {
        loadingMark(c, size * 0.5, size * 0.94, size * 0.8, f.color);
      }
    } else if (kind === 'pet') {
      var bimg4 = beastImgOf(ref);
      if (bimg4 && bimg4.complete && bimg4.naturalWidth) {
        c.imageSmoothingEnabled = false;
        var bw4 = size * 0.9;
        c.drawImage(bimg4, size * 0.5 - bw4 / 2, size * 0.9 - bw4, bw4, bw4);
      } else {
        loadingMark(c, size * 0.5, size * 0.9, size * 0.8, beastColorOf(ref));
      }
    } else if (kind === 'building') {
      building(c, { x: size * 0.5, y: size * 0.95, s: size / 58, form: ref.key, color: ref.color, t: 0 });
    }
    if (!flat) { storyize(cv); }
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

    /* 그림책풍 — 종이 바탕에 옅은 배경(하늘·산·들·기와)을 깔고 인물을 세운다.
       배경 선은 **여기서 직접 긋는다**. 배경까지 storyize() 에 맡기면 세력 문양
       같은 큰 무늬의 윤곽까지 따라 그려서, 인물을 가로지르는 네모가 생긴다. */
    var ink = 'rgba(122,98,74,0.75)';
    c.fillStyle = '#eef0e2';                         // 하늘
    c.fillRect(0, 0, w, h);

    c.save();
    c.globalAlpha = 0.14;                            // 세력 문양 — 종이에 찍은 도장처럼
    c.fillStyle = '#6b533a';
    c.font = '700 ' + Math.round(h * 0.5) + 'px "Malgun Gothic", serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(fac.mark, w * 0.5, h * 0.5);
    c.restore();

    c.beginPath();                                   // 먼 산
    c.moveTo(-2, h * 0.62);
    c.quadraticCurveTo(w * 0.26, h * 0.36, w * 0.52, h * 0.60);
    c.quadraticCurveTo(w * 0.74, h * 0.42, w + 2, h * 0.58);
    c.lineTo(w + 2, h * 0.72); c.lineTo(-2, h * 0.72);
    c.closePath();
    c.fillStyle = '#cddcc4'; c.fill();
    c.strokeStyle = ink; c.lineWidth = 1; c.stroke();

    c.fillStyle = '#b9c9ae';                         // 가까운 들
    c.fillRect(0, h * 0.70, w, h * 0.30);
    c.beginPath();
    c.moveTo(0, h * 0.70); c.lineTo(w, h * 0.70);
    c.strokeStyle = ink; c.lineWidth = 1; c.stroke();

    /* 기와 처마 한 줄 — 배경이 '동아시아' 로 읽히게 하는 최소한의 장치.
       맨 위에 얇게 붙인다. 아래로 내리면 인물 얼굴을 가로질러 큰 삿갓처럼 보인다. */
    c.beginPath();
    c.moveTo(w * 0.02, h * 0.085);
    c.quadraticCurveTo(w * 0.5, h * 0.015, w * 0.98, h * 0.085);
    c.lineTo(w * 0.98, h * 0.125);
    c.quadraticCurveTo(w * 0.5, h * 0.055, w * 0.02, h * 0.125);
    c.closePath();
    c.fillStyle = '#9c8f79'; c.fill();
    c.strokeStyle = ink; c.lineWidth = 1; c.stroke();

    /* 인물 · 펫 — **딴 캔버스에 그려 그것만** 후처리한 뒤 얹는다.
       (배경까지 같이 훑으면 문양·산의 윤곽이 인물을 가로지른다) */
    var figCv = document.createElement('canvas');
    figCv.width = cv.width; figCv.height = cv.height;
    var fig = figCv.getContext('2d');
    fig.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (isHero) {
      var himg5 = humanImg(humanIndexOf(ref));
      if (himg5.complete && himg5.naturalWidth) {
        fig.imageSmoothingEnabled = false;
        var hw5 = h * 0.62;
        fig.drawImage(himg5, w * 0.5 - hw5 / 2, h * 0.93 - hw5, hw5, hw5);
      } else {
        loadingMark(fig, w * 0.5, h * 0.93, h * 0.6, fac.color);
      }
    } else {
      /* 짐승은 가로로 긴 형태(용·물고기)가 있어 이미지 상자를 넉넉히 잡는다 */
      var bimg5 = beastImgOf(ref);
      if (bimg5 && bimg5.complete && bimg5.naturalWidth) {
        fig.imageSmoothingEnabled = false;
        var bw5 = h * 0.75;
        fig.drawImage(bimg5, w * 0.5 - bw5 / 2, h * 0.80 - bw5, bw5, bw5);
      } else {
        loadingMark(fig, w * 0.5, h * 0.80, h * 0.6, ref.kind === 'divine' ? '#8a5cc0' : '#5f7a4a');
      }
    }
    storyize(figCv);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);      // 이미 배율이 반영된 캔버스라 그대로 얹는다
    c.drawImage(figCv, 0, 0);
    c.restore();

    /* 등급 테두리 */
    c.strokeStyle = rar.color;
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);
    c.strokeStyle = 'rgba(107,83,58,0.45)';
    c.lineWidth = 1;
    c.strokeRect(4.5, 4.5, w - 9, h - 9);

    cardCache[key] = cv.toDataURL();
    return cardCache[key];
  }

  global.DG = global.DG || {};
  global.DG.sprite = {
    building: building, buildingImg: buildingImg,
    portraitCard: portraitCard,
    stamp: stamp, stampStats: stampStats,
    lookOf: lookOf, idSeed: idSeed, beastFormOf: beastFormOf, beastColorOf: beastColorOf,
    beastPatternOf: beastPatternOf, beastImgOf: beastImgOf,
    portrait: portrait, shade: shade
  };
})(window);
