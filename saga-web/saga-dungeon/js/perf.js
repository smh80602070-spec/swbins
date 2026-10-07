/**
 * 재기 표시(`?perf`) — 폰에서 콘솔 없이 "끊김"을 숫자로 읽는다 (SAGA-DESIGN §6.1-B ①)
 * ---------------------------------------------------------------
 * 사가만리 `perf.js`(품질 자동조절 + 재기 표시)에서 **재기 표시만** 옮겨 온 네 판 공통 사본이다
 * (사가나락·사가마을·사가종횡·사가천하 — 네 벌이 같은 파일이다, 사가만리 것과는 다르다).
 *
 * 품질 자동조절은 옮기지 않았다. 사가나락·사가종횡는 `dungeon3d.js`·`side-view3d.js` 가
 * `global.DG.perf` 가 없을 때만 얇은 다리(`tier()`)를 놓고 `post3d.js` 가 그걸 읽는다 —
 * 여기서 `DG.perf` 를 만들면 다리가 안 놓여 후처리가 죽는다. 그래서 **`DG.perfHud` 에만** 둔다.
 *
 * 주소에 `?perf` 가 있을 때만 제 rAF 를 돌려 프레임 간격을 잰다. 없으면 이 파일은 아무 일도 안 한다
 * (손잡이·세이브·판정·화질 기본값 무관). 턴제인 사가천하도 같은 길로 잰다(가만히 있으면 60 이 나온다).
 */
(function (global) {
  'use strict';

  /** 프레임 간격(ms) 묶음 → 평균 fps · 99분위 ms · 긴 프레임(>50ms) 수. 순수 함수 */
  function summarize(gaps) {
    var n = gaps.length;
    if (!n) { return { fps: 0, p99: 0, long: 0, n: 0 }; }
    var a = gaps.slice().sort(function (x, y) { return x - y; }), sum = 0, lng = 0, i;
    for (i = 0; i < n; i++) { sum += a[i]; if (a[i] > 50) { lng++; } }
    return { fps: Math.round(1000 * n / sum), p99: Math.round(a[Math.min(n - 1, Math.floor(n * 0.99))]), long: lng, n: n };
  }

  function on() {
    return /[?&]perf\b/.test((global.location && global.location.search) || '') && !global.DG_NO_DRAW && !!global.document;
  }

  var box = null, gaps = [], last = 0, acc = 0;

  function frame(now) {
    if (last) { gaps.push(now - last); if (gaps.length > 600) { gaps.shift(); } }   // 60fps 로 10초
    acc += last ? now - last : 0;
    last = now;
    if (acc >= 500) {
      acc = 0;
      if (!box) {
        box = global.document.createElement('div');
        box.id = 'perf-hud';
        box.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:env(safe-area-inset-top,0);z-index:99999;' +
          'font:11px/1.35 monospace;color:#9f9;background:rgba(0,0,0,.66);padding:3px 8px;border-radius:0 0 6px 6px;' +
          'white-space:pre;pointer-events:none;';
        global.document.body.appendChild(box);
      }
      var s10 = summarize(gaps), s2 = summarize(gaps.slice(-120));
      var mem = global.performance && global.performance.memory;
      box.textContent = s2.fps + 'fps · 99% ' + s2.p99 + 'ms · 긴 프레임 ' + s10.long + '/10초' +
        (mem ? ' · 힙 ' + Math.round(mem.usedJSHeapSize / 1048576) + 'MB' : '');
    }
    global.requestAnimationFrame(frame);
  }

  global.DG = global.DG || {};
  global.DG.perfHud = { summarize: summarize, on: on };

  if (on() && global.requestAnimationFrame) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { global.requestAnimationFrame(frame); });
    } else {
      global.requestAnimationFrame(frame);
    }
  }
})(window);
