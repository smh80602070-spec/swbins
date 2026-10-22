/**
 * 인물 일러스트(W-0371, K-0163) — 전신 스탠딩 `assets/illust/<id>/stand.webp`(세로 1024 투명)·표정 반신 `neutral|happy|angry|sad.webp`(512 투명).
 * 어느 인물에 있나는 판 `assets/illust/manifest.js`(K 가 씀 — `SAGA.illust = { base, files, ids }`)만 본다(파일을 두드리지 않아 404 없음).
 * 없는 인물·매니페스트 없는 판은 has() 가 거짓 → 부른 쪽은 지금 초상 그대로. 손잡이 `illust.on`(1 기본 = 켬 — K-0178 같은 사람 다시 그림 뒤 W-0371, 0 = 끔).
 * 10-22 기본 끔: K-0163 첫 묶음 30명이 그 인물과 다른 사람(성별·시대·옷 — 장군이 하녀 옷 소녀 등, 초상과 나란히 대 봄) → 다시 그린 묶음이 오면 1 로.
 * 정본 saga-web/shared/js/illust.js — 판별 사본은 tools/sync-shared.mjs.
 */
(function (global) {
  'use strict';

  /* 대사 감정·말 → 표정 파일. 놀람(shock)은 표정 그림이 없어 평온 */
  var MOOD = { calm: 'neutral', neutral: 'neutral', joy: 'happy', happy: 'happy', anger: 'angry', fire: 'angry', angry: 'angry', worry: 'sad', sorrow: 'sad', sad: 'sad', shock: 'neutral', surprise: 'neutral' };
  var set = null, from = null;

  function man() { var S = global.SAGA; return S && S.illust && S.illust.ids ? S.illust : null; }
  function on() { var C = global.DG && global.DG.core; return !!(C && C.tuned && +C.tuned('illust.on', 1)); }
  function has(id) {
    var M = man();
    if (!M || !id || !on()) { return false; }
    if (from !== M) { set = {}; from = M; M.ids.forEach(function (k) { set[k] = 1; }); }
    return !!set[id];
  }
  /** 감정 이름 → 그 판의 표정 파일 이름(순수) — 모르는 감정·매니페스트에 없는 파일이면 neutral */
  function moodOf(emote, files) {
    var m = MOOD[emote] || 'neutral';
    return !files || files.indexOf(m) >= 0 ? m : 'neutral';
  }
  /** 표정 반신 주소 — 없는 인물이면 null */
  function url(id, emote) { var M = man(); return has(id) ? (M.base || 'assets/illust/') + id + '/' + moodOf(emote, M.files) + '.webp' : null; }
  /** 전신 스탠딩 주소 — 없는 인물이면 null */
  function stand(id) { var M = man(); return has(id) && (!M.files || M.files.indexOf('stand') >= 0) ? (M.base || 'assets/illust/') + id + '/stand.webp' : null; }
  function ids() { var M = man(); return M ? M.ids.slice() : []; }

  global.DG = global.DG || {};
  global.DG.illust = { has: has, url: url, stand: stand, moodOf: moodOf, ids: ids, MOOD: MOOD };
})(window);
