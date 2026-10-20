/**
 * 아이콘 — UI 의 이모지를 **실제 아이콘 에셋**으로 갈아 끼운다
 * ---------------------------------------------------------------
 * 도구줄·독·지갑의 그림은 여태 **이모지**였다. 이모지는 폰트가 그리는 것이라
 * **기기마다 다르게 보인다** — 같은 화면이 아이폰·안드로이드·윈도우에서 셋으로
 * 갈린다. 사용자 방침("스크립트로 그리는 것은 다 에셋으로", 2026-08-28)에 따라
 * 여기만 실제 아이콘(자체 png — W-0321, 예전엔 Lucide SVG)으로 바꾼다.
 *
 * **인물·펫의 이모지는 안 바꾼다.** `data.js` 의 `emoji` 는 아이콘이 아니라
 * **그 인물의 상징**이다(관우의 칼, 장비의 술). 아이콘 세트에 대응하는 것이
 * 없고, 바꾸면 도감이 밋밋해진다 — 그 자리는 초상(`portrait3d`)이 맡는다.
 *
 * ── 어떻게 갈아 끼우나 ──────────────────────────────────
 *
 * HTML 은 여태처럼 이모지를 그대로 쓰고, 거기에 **이름표만** 붙인다:
 *
 *     <span data-icon="bot">🤖</span>
 *
 * 이 파일이 부팅 때 `[data-icon]` 을 훑어 안을 아이콘 그림으로 갈아 끼운다.
 * **손잡이 `icon.on` 을 0 으로 내리면 이모지가 그대로 남는다** — 되돌림이 공짜다.
 * 못 만든 이름은 건너뛰므로 표에 없는 것도 이모지로 남는다.
 *
 * **정본은 `saga-web/shared/js/icon.js`**(R-4 2026-10-08) — 사가만리·사가나락·사가종횡 세 벌이 코드는 같고 표만
 * 판마다 추려 있던 것을 합집합 표 하나로 합쳤다(어느 판도 표에 없어 이모지로 남던 이름은 그대로 남는다).
 * 고치는 곳은 shared 하나, `node tools/sync-shared.mjs` 가 세 판에 복사한다.
 *
 * 그림은 64px png 한 장씩(서비스 워커가 한 번 받으면 캐시).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }

  /** 아이콘으로 갈아 끼울까 — 0 이면 이모지 그대로 (되돌림용 손잡이) */
  function ON() { return core().tuned('icon.on', 1) ? true : false; }

  /* W-0321 — 자체 아이콘(K-0118 `shared/assets/icons/icon64/ui_<이름>_g0.png`, map.json `shared:ui:<이름>`). 예전 Lucide(ISC) SVG 표를 지웠다.
     이름은 그대로(lucide 이름의 - → _) — HTML 의 data-icon 은 안 바뀐다. 판 폴더 사본은 sync-shared(UI_ICON_GAMES) */
  var NAMES = ["award","backpack","book-open","bot","box","circle-question-mark","clipboard-list","coins","compass","ellipsis","flag","footprints","ham","hammer","mail","map","medal","palette","rotate-ccw","satellite-dish","scroll","scroll-text","sparkles","store","swords","user","wrench","x"];
  var BASE = 'assets/icons/icon64/ui_';
  function file(name) { return BASE + String(name).replace(/-/g, '_') + '_g0.png'; }

  /** 이 이름의 아이콘이 있나 — 순수 함수다(자가진단이 이것만 본다) */
  function has(name) { return NAMES.indexOf(name) >= 0; }

  /** 적힌 이름 전부 */
  function names() { return NAMES.slice(); }

  /**
   * 아이콘 한 덩이(`<img>`) — 이름은 옛 svg 그대로 두었다(부르는 쪽 안 고침). `size` 는 px, 안 주면 1em
   */
  function svg(name, size) {
    if (!has(name)) { return ''; }
    var s = size ? size + 'px' : '1em';
    return '<img class="ui-icon" src="' + file(name) + '" alt="" aria-hidden="true" draggable="false" style="width:' + s + ';height:' + s + ';vertical-align:-0.15em;object-fit:contain">';
  }

  /**
   * 화면에 붙은 `[data-icon]` 을 훑어 갈아 끼운다.
   * 이미 갈아 끼운 것은 건너뛰므로 여러 번 불러도 된다(시트를 다시 그릴 때마다 부른다).
   */
  function sweep(root) {
    if (!ON() || !global.document) { return 0; }
    var list = (root || document).querySelectorAll('[data-icon]');
    var n = 0, i;
    for (i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute('data-icon-done') === '1') { continue; }
      var got = svg(el.getAttribute('data-icon'), 0);
      if (!got) { continue; }                 // 표에 없으면 이모지로 남는다
      el.innerHTML = got;
      el.setAttribute('data-icon-done', '1');
      n++;
    }
    return n;
  }

  function stats() { return { on: ON(), count: names().length }; }

  global.DG = global.DG || {};
  global.DG.icon = {
    has: has, names: names, svg: svg, file: file, sweep: sweep, stats: stats
  };

  /* 부팅 때 한 번 훑는다 — 정적인 도구줄·독은 이 한 번으로 끝난다.
     나중에 그려지는 것은 부르는 쪽이 `sweep()` 을 한 번 더 부른다 */
  if (global.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { sweep(); });
    } else { sweep(); }
  }
})(window);
