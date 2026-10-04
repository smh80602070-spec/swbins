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

  global.DG.cutscene = { cutOf: cutOf, url: url, css: css, CUTS: CUTS };
})(typeof window !== 'undefined' ? window : this);
