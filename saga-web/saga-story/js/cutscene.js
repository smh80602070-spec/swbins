/**
 * 이야기 장면 컷신 배경 (W-0048) — K-0044 가 만든 컷신 배경(`assets/cutscene/cut_<판>_NN_<이름>.webp`, 1920×1080, 사람·글씨 없음)을
 * 장(章) id 로 골라 준다. 장면 상자(#scnbox)가 뜰 때 뒤에 깔 그림 주소를 낸다. 표에 없는 장·그림이 없는 판이면 null — 부른 쪽은 지금 배경 그대로.
 * 정본 shared/js/cutscene.js → 판 복사(tools/sync-shared.mjs). 판별 표는 그 판의 장 id 와 눈으로 맞춘다.
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  /** 판 → { 장 id: 컷 id }  (컷 id = 파일 이름에서 확장자를 뗀 것) */
  var CUTS = {
    dungeon: {
      a1_moru: 'cut_dungeon_01_act1_plain', a1_blackflag: 'cut_dungeon_01_act1_plain', a1_tomb: 'cut_dungeon_02_act1_pit',
      a2_factory: 'cut_dungeon_03_act2_ruincity', a2_tideflat: 'cut_dungeon_04_act2_saltflat', a2_watchtower: 'cut_dungeon_02_act1_pit',
      a3_riftgate: 'cut_dungeon_05_act3_hellgate', a3_sunfurnace: 'cut_dungeon_06_act3_solarcity', a3_blackwind: 'cut_dungeon_02_act1_pit', a3_palace: 'cut_dungeon_04_act2_saltflat',
      a4_caravan: 'cut_dungeon_07_act4_desert', a4_snowfort: 'cut_dungeon_08_act4_snow', a4_scrap: 'cut_dungeon_09_act4_scrap', a4_hellgate: 'cut_dungeon_05_act3_hellgate',
      a5_heaven: 'cut_dungeon_11_boss_hall', a5_nameless: 'cut_dungeon_10_act5_nameless',
      a6_orphan: 'cut_dungeon_12_epilogue_gate', a6_ford: 'cut_dungeon_12_epilogue_gate', a6_beyond: 'cut_dungeon_12_epilogue_gate'
    },
    forest: {
      sp_move: 'cut_forest_02_spring_village', sp_postbox: 'cut_forest_01_spring_postbox', sp_fox: 'cut_forest_02_spring_village', sp_museum: 'cut_forest_05_autumn_records',
      su_sailor: 'cut_forest_03_summer_guests', su_photo: 'cut_forest_03_summer_guests', su_waterfall: 'cut_forest_11_giant_boulders', su_star: 'cut_forest_04_summer_modern',
      au_rumi: 'cut_forest_04_summer_modern', au_insect: 'cut_forest_10_firefly_oaks', au_harvest: 'cut_forest_06_autumn_harvest', au_cave: 'cut_forest_09_mushroom_valley',
      wi_letters: 'cut_forest_07_winter_linked', wi_dongji: 'cut_forest_08_winter_hearth', wi_newyear: 'cut_forest_08_winter_hearth', wi_moon: 'cut_forest_07_winter_linked',
      y2_reply: 'cut_forest_01_spring_postbox', y2_hoyeon: 'cut_forest_02_spring_village', y2_ruin: 'cut_forest_01_spring_postbox', y2_bloom: 'cut_forest_12_year_after',
      y2_album: 'cut_forest_03_summer_guests', y2_lens: 'cut_forest_03_summer_guests', y2_night: 'cut_forest_10_firefly_oaks', y2_star: 'cut_forest_04_summer_modern',
      y2_rumi: 'cut_forest_05_autumn_records', y2_record: 'cut_forest_05_autumn_records', y2_moon: 'cut_forest_06_autumn_harvest', y2_cavebox: 'cut_forest_09_mushroom_valley',
      y2_wletter: 'cut_forest_07_winter_linked', y2_wdongji: 'cut_forest_08_winter_hearth', y2_wyear: 'cut_forest_08_winter_hearth', y2_wmoon: 'cut_forest_12_year_after'
    },
    story: {
      p1_sinya: 'cut_story_01_part1_town', p1_heodo: 'cut_story_01_part1_town', p1_job: 'cut_story_01_part1_town', p1_field: 'cut_story_02_part1_forest', p2_forest: 'cut_story_02_part1_forest', p2_port: 'cut_story_03_part2_river', p2_namjeong: 'cut_story_04_part2_city', p5_now: 'cut_story_04_part2_city', p3_gorge: 'cut_story_05_part3_gorge', p3_job: 'cut_story_05_part3_gorge', p5_future: 'cut_story_06_part3_orbital', p4_gate: 'cut_story_07_part4_gates', p5_past: 'cut_story_08_part4_battlefield', p2_cave: 'cut_story_09_cave_crystal', p3_labyrinth: 'cut_story_09_cave_crystal', p3_gisan: 'cut_story_10_fortress_mountain', p4_depth: 'cut_story_10_fortress_mountain', p4_luoyang: 'cut_story_11_ruin_capital', p4_name: 'cut_story_12_epilogue_road'
    },
    realm: {
      r1_start: 'cut_realm_11_map_table', r7_gather: 'cut_realm_11_map_table', r7_after: 'cut_realm_11_map_table', r1_first_ally: 'cut_realm_02_act1_palace', r2_debate: 'cut_realm_02_act1_palace', r2_plains: 'cut_realm_03_act2_great_battle', r2_fallen: 'cut_realm_04_act2_modern', r3_river: 'cut_realm_05_act3_river', r3_duel: 'cut_realm_05_act3_river', r3_navigator: 'cut_realm_06_act3_future', r1_rift_sign: 'cut_realm_07_act4_rift', r4_rift: 'cut_realm_07_act4_rift', r4_plague: 'cut_realm_07_act4_rift', r4_tomb: 'cut_realm_07_act4_rift', lr_rift1: 'cut_realm_07_act4_rift', lr_ruin1: 'cut_realm_07_act4_rift', lr_tomb1: 'cut_realm_07_act4_rift', lr_rift2: 'cut_realm_07_act4_rift', lr_ruin2: 'cut_realm_07_act4_rift', lr_tomb2: 'cut_realm_07_act4_rift', lr_rift3: 'cut_realm_07_act4_rift', lr_ruin3: 'cut_realm_07_act4_rift', lr_tomb3: 'cut_realm_07_act4_rift', r5_silk: 'cut_realm_08_act5_silkroad', r5_west: 'cut_realm_08_act5_silkroad', r5_south: 'cut_realm_09_act5_sea', r6_end: 'cut_realm_10_act6_throne', r7_end: 'cut_realm_12_epilogue_peace',
      sd_tm_gangseo: 'cut_realm_03_act2_great_battle', sd_tm_gongseok: 'cut_realm_04_act2_modern', sd_tm_geumdam: 'cut_realm_08_act5_silkroad', sd_tm_myeongbyeon: 'cut_realm_02_act1_palace', sd_tm_doha: 'cut_realm_11_map_table',
      sd_tm_seongyeon: 'cut_realm_05_act3_river', sd_tm_gwedo: 'cut_realm_06_act3_future', sd_tm_eunha: 'cut_realm_01_act1_warlords', sd_tm_yeongjeom: 'cut_realm_03_act2_great_battle'
    }
  };

  function base() { var c = global.DG.cfg && global.DG.cfg.cutscene; return (c && c.base) || 'assets/cutscene/'; }

  /** 판·장 id → 컷 id (없으면 null) */
  function cutOf(game, chapterId) { var t = CUTS[game]; return (t && chapterId && t[chapterId]) || null; }

  /** 판·장 id → 그림 주소 (없으면 null) */
  function url(game, chapterId) { var id = cutOf(game, chapterId); return id ? base() + id + '.webp' : null; }

  /** 장면 상자 배경 CSS 값 — 그림 위에 어두운 막을 덮어 대사 카드가 읽히게. 그림이 없으면 '' */
  function css(game, chapterId) {
    var u = url(game, chapterId);
    return u ? 'linear-gradient(rgba(6,8,14,.30), rgba(6,8,14,.62)), url(' + u + ') center / cover no-repeat' : '';
  }

  /** 카드 머리용 가로 그림 <img> 한 조각(사가국지 사연 카드처럼 전체 화면 배경이 아닌 곳). 없으면 '' — 못 받으면 그림만 숨는다 */
  function banner(game, chapterId) {
    var u = url(game, chapterId);
    return u ? '<img alt="" src="' + u + '" onerror="this.hidden=true" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;margin:0 0 8px">' : '';
  }

  global.DG.cutscene = { cutOf: cutOf, url: url, css: css, banner: banner, CUTS: CUTS };
})(typeof window !== 'undefined' ? window : this);
