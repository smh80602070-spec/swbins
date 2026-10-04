/**
 * 지역 아이콘 (W-0046) — K-0042 가 만든 64px 지역 아이콘(`assets/map/icons/<판>_<지역키>.png`)을 글 앞에 붙이는 작은 도우미.
 * 사냥터 고르기 버튼처럼 지역 이름이 나오는 자리가 부른다. 파일이 없거나 못 받으면 그림만 숨기고 글은 그대로다.
 * ui.js 는 이미 큰 파일이라(tools/big-files.txt) 새 코드는 여기에 둔다.
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  var PREFIX = 'story';   // 이 판의 아이콘 접두어 — 정본 shared/assets/map/icons/story_*.png

  /** 지역 키 → 아이콘 <img> 한 조각(글 앞에 붙인다). 키가 비면 빈 문자열 */
  function html(key) {
    if (!key) { return ''; }
    return '<img class="ri" alt="" src="assets/map/icons/' + PREFIX + '_' + String(key).replace(/[^\w]/g, '') + '.png" onerror="this.hidden=true">';
  }

  global.DG.regionIcon = { html: html };
})(typeof window !== 'undefined' ? window : this);
