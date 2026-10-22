/**
 * 쉼터(W-0297, 장부 go.md 우선 2) — 들판 곳곳 모닥불 자리. 엘든 링 축복의 구조만(이름·수치·그림은 이 판 것).
 * ---------------------------------------------------------------
 *   자리     세계를 CELL(720) 칸으로 나눠 칸마다 하나 — 칸 안 해시 자리, 물·마을 칸이면 다른 해시로 네 번까지(못 찾으면 그 칸엔 없음). 순수
 *   불 지핌  처음 SIT_R 안에 들면 save.rest.lit 에 적는다(발견) — 지도·미니맵에 밝게
 *   쉬기     SIT_R 안에 들면(들판 싸움 중이 아니면) ① 동행 체력 가득·쓰러짐 풂 ② 부활 자리 save.rest.at = 이 쉼터 ③ 비운 잡몹 무리가 다시 선다
 *            (field-combat S.cleared 에서 'g:'(들판 보스 꽃) 아닌 것만 지움 — 보스·숨은 터는 그대로). LEAVE_R 밖으로 나가야 다시 쉰다
 *   부활     들판 전멸(field:wipe) 때 at 이 있으면 그 쉼터로 옮겨 일어난다(없으면 옛대로 그 자리)
 * 손잡이 go.rest(1, 0 = 끔) · 3D 표시는 없음(웹 3D 는 에셋 배선만 — 10-19 방향).
 */
(function (global) {
  'use strict';

  var CELL = 720, SIT_R = 30, LEAVE_R = 140, TICK = 0.4;
  var acc = 0, armed = {}, bound = false;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('go.rest', 1)); }
  function book() { var s = core().save; if (!s.rest || typeof s.rest !== 'object') { s.rest = { lit: [], at: null }; } if (!Array.isArray(s.rest.lit)) { s.rest.lit = []; } return s.rest; }
  function peek() { var s = core() && core().save; return (s && s.rest) || { lit: [], at: null }; }
  function h01(a, b) { return Math.min(0.999999, core().hash2(a, b)); }

  /** 칸 (cx, cy) 의 쉼터 — { id, x, y, cx, cy } 또는 null. terrainAt(tx, ty) 로 물·마을 칸은 피한다. 순수 */
  function siteAt(cx, cy, terrainAt) {
    for (var k = 0; k < 4; k++) {
      var x = (cx + 0.2 + 0.6 * h01(cx * 31 + k * 7, cy * 17 + 3)) * CELL, y = (cy + 0.2 + 0.6 * h01(cx * 13 + 5, cy * 29 + k * 11)) * CELL;
      var t = terrainAt ? terrainAt(Math.floor(x / 48), Math.floor(y / 48)) : 'grass';
      if (t !== 'water' && t !== 'town' && !nearHouse(x, y)) { return { id: 'r:' + cx + ':' + cy, x: x, y: y, cx: cx, cy: cy }; }
    }
    return null;
  }
  /** 집 몸통 둘레 40·역참 110·지역 탑 90 안인가 — 2D 에서 집 그림이 불을 덮었다(10-22 촬영). 집 표가 없으면 거짓 */
  function nearHouse(x, y) {
    var W3 = global.DG.world3d, gx0 = Math.floor(x / 48), gy0 = Math.floor(y / 48), gx, gy, rs, i;
    var W = global.DG.world, BM = global.DG.biome, R = W && W.REGION_SIZE, rx, ry, st, k;
    if (W && W.stationsIn && R) { for (ry = Math.floor(y / R) - 1; ry <= Math.floor(y / R) + 1; ry++) { for (rx = Math.floor(x / R) - 1; rx <= Math.floor(x / R) + 1; rx++) { st = W.stationsIn(rx, ry) || []; for (k = 0; k < st.length; k++) { if (Math.hypot(st[k].x - x, st[k].y - y) < 110) { return true; } } } } }   // 역참 건물
    if (BM && BM.on && BM.on() && BM.landmarks && BM.landmarks(x, y, 90).length) { return true; }   // 지역 탑
    if (!W3 || !W3.houseRects) { return false; }
    for (gy = gy0 - 2; gy <= gy0 + 2; gy++) { for (gx = gx0 - 2; gx <= gx0 + 2; gx++) { rs = W3.houseRects(gx, gy) || []; for (i = 0; i < rs.length; i++) { if (Math.hypot(rs[i].x - x, rs[i].z - y) < Math.max(rs[i].w || 0, rs[i].d || 0) / 2 + 40) { return true; } } } }
    return false;
  }
  function terr() { var W = global.DG.world; return W && W.terrainAt ? W.terrainAt : null; }
  /** (x, y) 반경 R 안 쉼터 [{ id, x, y, lit, at }] */
  function sitesNear(x, y, R, terrainAt) {
    var out = [], T = terrainAt || terr(), b = peek(), cx, cy, s;
    if (!on()) { return out; }
    for (cy = Math.floor((y - R) / CELL); cy <= Math.floor((y + R) / CELL); cy++) {
      for (cx = Math.floor((x - R) / CELL); cx <= Math.floor((x + R) / CELL); cx++) {
        s = siteAt(cx, cy, T);
        if (s && Math.hypot(s.x - x, s.y - y) <= R) { s.lit = b.lit.indexOf(s.id) >= 0; s.at = b.at === s.id; out.push(s); }
      }
    }
    return out;
  }
  function byId(id) {
    var m = /^r:(-?\d+):(-?\d+)$/.exec(id || '');
    return m ? siteAt(+m[1], +m[2], terr()) : null;
  }

  /** 쉬기 — 회복·부활 자리·잡몹 다시 섬. 고친 무리 수를 돌려준다 */
  function rest(site) {
    var b = book(), FC = global.DG.fieldCombat, S = FC && FC.state ? FC.state() : null, n = 0, i, c, fs = core().save.field;
    if (b.lit.indexOf(site.id) < 0) { b.lit.push(site.id); }
    b.at = site.id; b.atXY = [Math.round(site.x), Math.round(site.y)];   // 부활 때 지형 판정을 다시 안 하게 자리를 함께 적는다
    if (S && S.party) { for (i = 0; i < S.party.length; i++) { var p = S.party[i]; p.down = false; p.hp = p.hpMax; p.burn = null; } }
    if (S && S.cleared) {
      for (c in S.cleared) {
        if (!S.cleared.hasOwnProperty(c) || c.indexOf('g:') === 0) { continue; }
        delete S.cleared[c]; if (fs && fs.camps) { delete fs.camps[c]; } n++;
      }
    }
    core().emit('rest:sit', { id: site.id, respawned: n });
    if (core().persist) { core().persist(); }
    return n;
  }

  function busy() { var FC = global.DG.fieldCombat; try { return !!(FC && FC.engaged && FC.engaged()); } catch (e) { return false; } }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast(msg); } }

  function tick(dt) {
    if (!on() || !core() || !core().save) { return 0; }
    bind();
    acc += dt; if (acc < TICK) { return 0; }
    acc = 0;
    var pos = core().save.player.pos, near = sitesNear(pos.x, pos.y, LEAVE_R), i, s, d, done = 0;
    for (i = 0; i < near.length; i++) {
      s = near[i]; d = Math.hypot(s.x - pos.x, s.y - pos.y);
      if (d > SIT_R) { armed[s.id] = true; continue; }
      if (armed[s.id] === false || busy()) { continue; }
      var first = !s.lit, n = rest(s); armed[s.id] = false; done++;
      toast(first ? '🔥 쉼터에 불을 지폈다 — 기운을 되찾고, 쓰러지면 여기서 일어난다' : '🔥 쉼터에서 쉬었다 — 기운 회복' + (n ? ' · 들판 무리 ' + n + ' 이 다시 섰다' : ''));
    }
    for (var k in armed) { if (armed.hasOwnProperty(k) && !near.some(function (q) { return q.id === k; })) { delete armed[k]; } }   // 멀어지면 다시 쉴 수 있게
    return done;
  }

  /** 전멸하면 부활 자리 쉼터로 */
  function onWipe() {
    if (!on()) { return false; }
    var b = peek(), s = b.at ? (b.atXY ? { id: b.at, x: b.atXY[0], y: b.atXY[1] } : byId(b.at)) : null, pos = core().save.player.pos;
    if (!s) { return false; }
    pos.x = s.x; pos.y = s.y + 12; armed[s.id] = false;
    toast('🔥 쉼터에서 다시 일어났다');
    core().emit('changed');
    return true;
  }
  function bind() { if (bound || !core() || !core().on) { return; } bound = true; core().on('field:wipe', onWipe); }

  /** 2D 그리기 — 발 밑 가운데 (x, y), z 배율. 지핀 불은 흔들리는 불꽃, 안 지핀 자리는 재와 장작만 */
  function draw2d(ctx, x, y, z, lit, now) {
    var w = 18 * z, t = (now || 0) / 140, i;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, w * 1.1, w * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = Math.max(2, 4 * z); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - w * 0.8, y - w * 0.05); ctx.lineTo(x + w * 0.8, y - w * 0.35); ctx.moveTo(x - w * 0.8, y - w * 0.35); ctx.lineTo(x + w * 0.8, y - w * 0.05); ctx.stroke();
    for (i = 0; i < 6; i++) { ctx.fillStyle = '#8a8378'; ctx.beginPath(); ctx.arc(x + Math.cos(i * 1.05) * w, y + Math.sin(i * 1.05) * w * 0.35, 2.4 * z, 0, Math.PI * 2); ctx.fill(); }
    if (lit) {
      var fh = w * (1.5 + 0.18 * Math.sin(t) + 0.1 * Math.sin(t * 2.3)), g = ctx.createRadialGradient(x, y - fh * 0.35, 1, x, y - fh * 0.35, w * 2.4);
      g.addColorStop(0, 'rgba(255,190,90,0.35)'); g.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - fh * 0.35, w * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(x - w * 0.55, y - w * 0.2); ctx.quadraticCurveTo(x - w * 0.2 + Math.sin(t) * 2 * z, y - fh, x, y - fh * 1.05); ctx.quadraticCurveTo(x + w * 0.3, y - fh * 0.6, x + w * 0.55, y - w * 0.2); ctx.fill();
      ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.moveTo(x - w * 0.28, y - w * 0.22); ctx.quadraticCurveTo(x + Math.sin(t * 1.7) * 1.5 * z, y - fh * 0.75, x + w * 0.28, y - w * 0.22); ctx.fill();
    }
    ctx.restore();
  }

  global.DG = global.DG || {};
  global.DG.restSite = { CELL: CELL, SIT_R: SIT_R, LEAVE_R: LEAVE_R, siteAt: siteAt, sitesNear: sitesNear, byId: byId, rest: rest, tick: tick, onWipe: onWipe, draw2d: draw2d,
    _reset: function () { acc = 0; armed = {}; } };
})(window);
