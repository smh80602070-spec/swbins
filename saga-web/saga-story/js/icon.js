/**
 * 아이콘 — UI 의 이모지를 **실제 아이콘 에셋**으로 갈아 끼운다
 * ---------------------------------------------------------------
 * 사가만리(saga-go)의 `js/icon.js` 를 그대로 옮겼다(2026-09-08, "사가종횡
 * UI 가 사가만리랑 완전히 같지 않다" 제보) — 도구줄·독·지갑의 이모지는
 * 폰트가 그리는 것이라 기기마다 다르게 보인다. 사용자 방침("스크립트로
 * 그리는 것은 다 에셋으로", 2026-08-28)에 따라 실제 아이콘(Lucide, **ISC**)
 * 으로 바꾼다. 이 판에서 실제로 쓰는 이름만 추렸다 — 나머지는 사가만리 쪽
 * `icon.js`를 본다.
 *
 * **인물·펫의 이모지는 안 바꾼다.** 등장물의 상징(무기·표식)은 아이콘이
 * 아니다 — 이 파일은 도구줄·독·지갑 같은 **UI 그림**만 다룬다.
 *
 * ── 어떻게 갈아 끼우나 ──────────────────────────────────
 *
 * HTML 은 여태처럼 이모지를 그대로 쓰고, 거기에 **이름표만** 붙인다:
 *
 *     <span data-icon="bot">🤖</span>
 *
 * 이 파일이 부팅 때 `[data-icon]` 을 훑어 안을 SVG 로 갈아 끼운다.
 * **손잡이 `icon.on` 을 0 으로 내리면 이모지가 그대로 남는다** — 되돌림이 공짜다.
 * 못 만든 이름은 건너뛰므로 표에 없는 것도 이모지로 남는다.
 *
 * 소리(`btn-sound`) 버튼은 **일부러 안 건드렸다** —
 * 상태가 바뀔 때마다 `textContent` 를 통째로 다시 쓰는 자리라 data-icon 을
 * 달아도 다음 클릭에서 곧바로 지워진다(사가만리도 실은 이 버튼만 이 흠을
 * 그대로 갖고 있다 — 거기 맞춘 것이지 새 흠이 아니다).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }

  /** 아이콘으로 갈아 끼울까 — 0 이면 이모지 그대로 (되돌림용 손잡이) */
  function ON() { return core().tuned('icon.on', 1) ? true : false; }

  /* Lucide (https://lucide.dev) — **ISC**. 24×24 격자에 선 두께 2.
     `assets/ASSET_LICENSES.md` 에 출처를 적어 두었다 */
  var SVG = {
      "award": "<path d=\"m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526\" /> <circle cx=\"12\" cy=\"8\" r=\"6\" />",
      "backpack": "<path d=\"M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z\" /> <path d=\"M8 10h8\" /> <path d=\"M8 18h8\" /> <path d=\"M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6\" /> <path d=\"M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2\" />",
      "book-open": "<path d=\"M12 5v16\" /> <path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" />",
      "bot": "<path d=\"M12 8V4H8\" /> <rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\" /> <path d=\"M2 14h2\" /> <path d=\"M20 14h2\" /> <path d=\"M15 13v2\" /> <path d=\"M9 13v2\" />",
      "box": "<path d=\"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z\" /> <path d=\"m3.3 7 8.7 5 8.7-5\" /> <path d=\"M12 22V12\" />",
      "circle-question-mark": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /> <path d=\"M12 17h.01\" />",
      "coins": "<path d=\"M13.744 17.736a6 6 0 1 1-7.48-7.48\" /> <path d=\"M15 6h1v4\" /> <path d=\"m6.134 14.768.866-.5 2 3.464\" /> <circle cx=\"16\" cy=\"8\" r=\"6\" />",
      "ellipsis": "<circle cx=\"12\" cy=\"12\" r=\"1\" /> <circle cx=\"19\" cy=\"12\" r=\"1\" /> <circle cx=\"5\" cy=\"12\" r=\"1\" />",
      "footprints": "<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\" /> <path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\" /> <path d=\"M16 17h4\" /> <path d=\"M4 13h4\" />",
      "ham": "<path d=\"M13.144 21.144A7.274 10.445 45 1 0 2.856 10.856\" /> <path d=\"M13.144 21.144A7.274 4.365 45 0 0 2.856 10.856a7.274 4.365 45 0 0 10.288 10.288\" /> <path d=\"M16.565 10.435 18.6 8.4a2.501 2.501 0 1 0 1.65-4.65 2.5 2.5 0 1 0-4.66 1.66l-2.024 2.025\" /> <path d=\"m8.5 16.5-1-1\" />",
      "map": "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\" /> <path d=\"M15 5.764v15\" /> <path d=\"M9 3.236v15\" />",
      "medal": "<path d=\"M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15\" /> <path d=\"M11 12 5.12 2.2\" /> <path d=\"m13 12 5.88-9.8\" /> <path d=\"M8 7h8\" /> <circle cx=\"12\" cy=\"17\" r=\"5\" /> <path d=\"M12 18v-2h-.5\" />",
      "rotate-ccw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /> <path d=\"M3 3v5h5\" />",
      "scroll-text": "<path d=\"M15 12h-5\" /> <path d=\"M15 8h-5\" /> <path d=\"M19 17V5a2 2 0 0 0-2-2H4\" /> <path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\" />",
      "scroll": "<path d=\"M19 17V5a2 2 0 0 0-2-2H4\" /> <path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\" />",
      "store": "<path d=\"M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5\" /> <path d=\"M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244\" /> <path d=\"M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05\" />",
      "swords": "<path d=\"m13 19 6-6\" /> <path d=\"M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5\" /> <path d=\"m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586\" /> <path d=\"m16 16 4 4\" /> <path d=\"m19 21 2-2\" /> <path d=\"m5 14 4 4\" /> <path d=\"m5 21-2-2\" /> <path d=\"M7.5 16.5 4 20\" />",
      "wrench": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\" />",
      "x": "<path d=\"M18 6 6 18\" /> <path d=\"m6 6 12 12\" />"
  };

  /** 이 이름의 아이콘이 있나 — 순수 함수다(자가진단이 이것만 본다) */
  function has(name) { return !!SVG[name]; }

  /** 적힌 이름 전부 */
  function names() { return Object.keys(SVG); }

  /**
   * `<svg>` 한 덩이. `size` 는 px, 안 주면 1em 에 맞춘다.
   * **`currentColor`** 라 글자색을 그대로 따라간다.
   */
  function svg(name, size) {
    if (!SVG[name]) { return ''; }
    var s = size ? (' width="' + size + '" height="' + size + '"') : ' width="1em" height="1em"';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + s + '>' +
      SVG[name] + '</svg>';
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
    has: has, names: names, svg: svg, sweep: sweep, stats: stats
  };

  /* 부팅 때 한 번 훑는다 — 정적인 도구줄·독은 이 한 번으로 끝난다.
     나중에 그려지는 것은 부르는 쪽이 `sweep()` 을 한 번 더 부른다 */
  if (global.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { sweep(); });
    } else { sweep(); }
  }
})(window);
