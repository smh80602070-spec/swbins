/**
 * 1만리 — 바람 길잡이 (W-0395 ① 웹 역이식 — 정본 고돗 G-0318 · 고스트 오브 쓰시마 구조만)
 * ---------------------------------------------------------------
 * 가만히 서면(STILL 초 넘게 자리 그대로) 지금 목표(autoQuestGo.goals()[0] 의 x·y) 쪽으로 바람이 흐른다 — 2D 지도 위 풀잎·먼지 줄
 * 몇 가닥이 플레이어 발밑에서 목표 쪽으로 미끄러진다. HUD 를 덜어 내려는 것이니 켜면 목표 기둥(beacon)을 끌 수 있다(손잡이 wind.beacon 0).
 *   손잡이 wind.on(1) · wind.still(1.2초) · wind.n(가닥 14) · wind.len(화면 px 48) · wind.beacon(1 = 기둥도 그대로)
 *   걸린 자리: world.js 2D 그리기(쉼터 뒤) draw2d(ctx, pos, sc, project, now, items) — items 에 맨 위 층으로 민다. 3D 는 배선만(안 함 — 10-19).
 *   세이브 없음. 순수 함수 dir(pos) → { dx, dy, dist, goal } 또는 null 은 진단이 쓴다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('wind.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }

  var lastX = null, lastY = null, stillT = 0, lastNow = 0, seeds = [];

  /** 목표 방향(세계 좌표 단위 벡터) — 목표가 없거나 자리 없는 목표(x null)면 null */
  function dir(pos) {
    var A = global.DG.autoQuestGo, gs = A && A.goals ? A.goals() : [], i;
    for (i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (g && typeof g.x === 'number' && typeof g.y === 'number') {
        var dx = g.x - pos.x, dy = g.y - pos.y, d = Math.hypot(dx, dy);
        if (d < 2) { return null; }
        return { dx: dx / d, dy: dy / d, dist: d, goal: g };
      }
    }
    return null;
  }

  /** 가만히 선 시간을 센다 — 매 그리기마다. 돌아온 값 = 0~1 세기(STILL 지나면 0.6초에 걸쳐 1 로) */
  function stillness(pos, now) {
    var dt = lastNow ? Math.min(0.2, (now - lastNow) / 1000) : 0; lastNow = now;
    var moved = lastX === null || Math.hypot(pos.x - lastX, pos.y - lastY) > 0.05;
    lastX = pos.x; lastY = pos.y;
    stillT = moved ? 0 : stillT + dt;
    var s = K('still', 1.2);
    return stillT <= s ? 0 : Math.min(1, (stillT - s) / 0.6);
  }

  function beaconOn() { return !on() || K('beacon', 1) ? true : false; }

  /** 2D — 발밑에서 목표 쪽으로 흐르는 가닥들. items 가 있으면 맨 위 층으로 민다 */
  function draw2d(ctx, pos, sc, project, now, items) {
    if (!on() || !pos) { return; }
    var k = stillness(pos, now);
    if (k <= 0) { return; }
    var d = dir(pos);
    if (!d) { return; }
    var paint = function () {
      var n = K('n', 14), len = K('len', 48), i, p0 = project(0, 0), ang = Math.atan2(d.dy, d.dx);
      if (!p0) { return; }
      if (!seeds.length) { for (i = 0; i < 40; i++) { seeds.push([Math.random(), Math.random(), Math.random()]); } }
      ctx.save(); ctx.lineCap = 'round';
      for (i = 0; i < n; i++) {
        var s = seeds[i % seeds.length], t = ((now / 1000) * (0.55 + s[2] * 0.5) + s[0] * 5) % 1;   // 0 → 1 흘러감
        var side = (s[1] - 0.5) * 36, off = 10 + t * len * 3, a = (1 - t) * 0.55 * k;
        var cx = p0.x + Math.cos(ang) * off - Math.sin(ang) * side, cy = p0.y + (Math.sin(ang) * off + Math.cos(ang) * side) * 0.55 - 8;
        ctx.strokeStyle = 'rgba(214,236,170,' + a.toFixed(3) + ')'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * 11, cy + Math.sin(ang) * 11 * 0.55); ctx.stroke();
      }
      ctx.restore();
    };
    if (items && items.push) { items.push({ v: 1e9, draw: paint }); } else { paint(); }
  }

  global.DG = global.DG || {};
  global.DG.windGuide = { on: on, dir: dir, stillness: stillness, draw2d: draw2d, beaconOn: beaconOn, _reset: function () { lastX = lastY = null; stillT = 0; lastNow = 0; } };
})(window);
