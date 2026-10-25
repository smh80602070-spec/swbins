/**
 * 1만리 들판 수수께끼 (W-0426 · 젤다 야숨 코록 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 걷는 길에 3초짜리 작은 들를 거리. 구역(go.zoneM, 576m)마다 결정적 씨앗으로 셋:
 *   🪨 외딴 돌      다가가(STONE_R) 서면 들춰져 씨앗이 나온다
 *   🌸 꽃 고리      둘레 RING_R 에 둘러선 꽃 다섯 — 첫 꽃을 밟으면 RING_T 초 안에 차례로(다른 꽃을 먼저 밟으면 처음부터)
 *   🎐 바람개비     곁(PIN_R)에 PIN_T 초 가만히 서면 바람이 와 돈다
 * 반경은 2D 판정 배율(KDV)을 곱한다. 풀면 🌰 씨앗 +1. 씨앗 5·15·30·60 에서 행낭(bag) 상한 +BAG_ADD — 보상이 가방이라 전투 균형을 안 건드린다.
 * 푼 자리는 다시 안 선다(save.goRiddle.done[id]). 세이브 = { done: {id: 1}, seeds: n } 순수 추가. GPS 모드도 같은 자리(좌표로만 셈).
 * game.js 틱 줄(쉼터 곁)에서 tick(dt), world 2D 그리기 줄(바람 길잡이 곁)에서 draw2d. 그림은 코드 도형(K 그림 오면 바꿈). 손잡이 go.riddle(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var KINDS = ['stone', 'ring', 'pin'], STONE_R = 2.5, RING_R = 4, FLOWER_R = 1.6, RING_T = 8, PIN_R = 3, PIN_T = 2, STEPS = [5, 15, 30, 60], BAG_ADD = 10;
  var ring = null, pin = { id: null, t: 0, x: 0, y: 0 };

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('go.riddle', 1)); }
  /** 2D 판정 배율(field-combat KDV — 2D 는 몸 크기에 맞춰 거리를 늘린다, 3D 1) */
  function KD() { var FC = global.DG.fieldCombat; return FC && FC.KDVf ? FC.KDVf() || 1 : 1; }
  function ZM() { var C = core(), z = C && C.tuned ? +C.tuned('go.zoneM', 576) : 576; return z > 0 ? z : 576; }
  function st() { var s = core().save; if (!s.goRiddle || typeof s.goRiddle !== 'object') { s.goRiddle = { done: {}, seeds: 0 }; } if (!s.goRiddle.done) { s.goRiddle.done = {}; } return s.goRiddle; }
  function h01(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  /** 구역 (zx, zy) 의 수수께끼 셋(순수) */
  function inZone(zx, zy) {
    var zm = ZM(), out = [];
    for (var k = 0; k < KINDS.length; k++) {
      var id = zx + '_' + zy + '_' + k;
      out.push({ id: id, kind: KINDS[k], x: (zx + (h01('rx:' + id) - 0.5) * 0.8) * zm, y: (zy + (h01('ry:' + id) - 0.5) * 0.8) * zm });
    }
    return out;
  }
  /** 내 둘레 아홉 구역(안 푼 것만) */
  function near(x, y) {
    var zm = ZM(), cx = Math.floor(x / zm + 0.5), cy = Math.floor(y / zm + 0.5), out = [], d = st().done;
    for (var dx = -1; dx <= 1; dx++) { for (var dy = -1; dy <= 1; dy++) { inZone(cx + dx, cy + dy).forEach(function (r) { if (!d[r.id]) { out.push(r); } }); } }
    return out;
  }
  function flowers(r) { var out = []; for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * Math.PI * 2 / 5; out.push({ x: r.x + Math.cos(a) * RING_R * KD(), y: r.y + Math.sin(a) * RING_R * KD() }); } return out; }
  function bagAdd() { var n = st().seeds || 0, k = 0; STEPS.forEach(function (s) { if (n >= s) { k++; } }); return k * BAG_ADD; }
  function toast(m) { var U = global.DG.ui; if (U && U.toast) { U.toast(m); } }

  function solve(r) {
    var s = st(); if (s.done[r.id]) { return false; }
    var before = bagAdd();
    s.done[r.id] = 1; s.seeds = (s.seeds || 0) + 1;
    var nm = r.kind === 'stone' ? '돌 밑에서' : (r.kind === 'ring' ? '꽃 고리를 다 돌아' : '바람개비가 돌아');
    toast('🌰 ' + nm + ' 씨앗을 찾았다 (' + s.seeds + ')' + (bagAdd() > before ? ' — 🎒 행낭 상한 +' + BAG_ADD : ''));
    var c = core(); if (c && c.emit) { c.emit('riddle:solve', { id: r.id, kind: r.kind, seeds: s.seeds }); }
    return true;
  }

  function tick(dt) {
    var c = core(); if (!on() || !c || !c.save || !c.save.player) { return; }
    var p = c.save.player.pos; if (!p) { return; }
    var list = near(p.x, p.y), i, r, d;
    if (ring) { ring.t -= dt; if (ring.t <= 0) { toast('🌸 꽃 고리가 시들었다 — 처음부터'); ring = null; } }
    for (i = 0; i < list.length; i++) {
      r = list[i]; d = Math.hypot(p.x - r.x, p.y - r.y);
      if (r.kind === 'stone' && d <= STONE_R * KD()) { solve(r); }
      else if (r.kind === 'ring' && d <= (RING_R + FLOWER_R) * KD()) {
        var fl = flowers(r);
        for (var j = 0; j < fl.length; j++) {
          if (Math.hypot(p.x - fl[j].x, p.y - fl[j].y) > FLOWER_R * KD()) { continue; }
          var nx = ring && ring.id === r.id ? ring.n : 0;
          if (j === nx) {
            if (!ring || ring.id !== r.id) { ring = { id: r.id, n: 0, t: RING_T }; toast('🌸 꽃 고리 — ' + RING_T + '초 안에 차례로 밟자 (1/5)'); }
            ring.n = j + 1;
            if (ring.n >= 5) { ring = null; solve(r); }
          } else if (ring && ring.id === r.id && j !== nx - 1) { ring = null; toast('🌸 순서가 틀렸다 — 처음부터'); }
        }
      } else if (r.kind === 'pin') {
        if (d <= PIN_R * KD()) {
          if (pin.id !== r.id || Math.hypot(p.x - pin.x, p.y - pin.y) > 0.3 * KD()) { pin = { id: r.id, t: 0, x: p.x, y: p.y }; }
          pin.t += dt; if (pin.t >= PIN_T) { pin = { id: null, t: 0, x: 0, y: 0 }; solve(r); }
        } else if (pin.id === r.id) { pin = { id: null, t: 0, x: 0, y: 0 }; }
      }
    }
  }

  /** world 2D 그리기 — 안 푼 것만, 코드 도형 */
  function draw2d(ctx, pos, sc, project, now, items, bk) {
    if (!on() || !ctx) { return; }
    near(pos.x, pos.y).forEach(function (r) {
      if (Math.hypot(r.x - pos.x, r.y - pos.y) > 140 * KD()) { return; }
      var pts = r.kind === 'ring' ? flowers(r) : [r];
      pts.forEach(function (q, qi) {
        var u = (q.x - pos.x) * sc, v = (q.y - pos.y) * sc;
        items.push({ v: v, draw: function () {
          var pr = project(u, v); if (pr.s < 0.2) { return; }
          var z = Math.max(0.5, Math.min(1.8, pr.s)) * (bk || 1);
          ctx.save();
          if (r.kind === 'stone') {
            ctx.fillStyle = '#7d7568'; ctx.strokeStyle = '#3b352d'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(pr.x, pr.y - 8 * z, 20 * z, 14 * z, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(pr.x - 6 * z, pr.y - 14 * z, 8 * z, 4 * z, -0.4, 0, Math.PI * 2); ctx.fill();
          } else if (r.kind === 'ring') {
            var lit = ring && ring.id === r.id && qi < ring.n;
            for (var k = 0; k < 5; k++) { var a = k * Math.PI * 2 / 5 + now / 1600; ctx.fillStyle = lit ? '#ffe27a' : '#f2a7c8'; ctx.beginPath(); ctx.arc(pr.x + Math.cos(a) * 8 * z, pr.y - 8 * z + Math.sin(a) * 8 * z, 6 * z, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#ffd45e'; ctx.beginPath(); ctx.arc(pr.x, pr.y - 8 * z, 4.5 * z, 0, Math.PI * 2); ctx.fill();
          } else {
            var spin = (pin.id === r.id ? now / 60 : now / 900);
            ctx.strokeStyle = '#5b4a36'; ctx.lineWidth = 3 * z; ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x, pr.y - 44 * z); ctx.stroke();
            var col = ['#e8604c', '#4ca3e8', '#f2c94c', '#6cc56a'];
            for (var b = 0; b < 4; b++) { var aa = spin + b * Math.PI / 2; ctx.fillStyle = col[b]; ctx.beginPath(); ctx.moveTo(pr.x, pr.y - 44 * z); ctx.lineTo(pr.x + Math.cos(aa) * 18 * z, pr.y - 44 * z + Math.sin(aa) * 18 * z); ctx.lineTo(pr.x + Math.cos(aa + 0.6) * 12 * z, pr.y - 44 * z + Math.sin(aa + 0.6) * 12 * z); ctx.closePath(); ctx.fill(); }
          }
          ctx.restore();
        } });
      });
    });
  }

  global.DG = global.DG || {};
  global.DG.fieldRiddle = {
    KINDS: KINDS, STEPS: STEPS, BAG_ADD: BAG_ADD, RING_T: RING_T, PIN_T: PIN_T,
    inZone: inZone, near: near, flowers: flowers, bagAdd: bagAdd, solve: solve, tick: tick, draw2d: draw2d, seeds: function () { return st().seeds || 0; },
    _reset: function () { ring = null; pin = { id: null, t: 0, x: 0, y: 0 }; }
  };
})(window);
