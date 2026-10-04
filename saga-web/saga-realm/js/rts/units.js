/**
 * RTS 유닛 (W-0031, P3a) — 유닛 표·군영 생산 큐·A* 길찾기·이동 틱. 순수 함수(화면·저장과 무관), 난수 없음.
 *
 * 판 상태 `s` 에 더해지는 칸: s.units { id: {id,t,team,x,y,hp,path,goal} } · s.queues { 군영id: [{t,left}] } · s.nextUid
 * 좌표 x,y 는 타일 단위 실수(칸 중심 = +0.5). team 0 = 내 쪽(P3b 에서 1 = 적).
 * 가위바위보: 보병 > 기병 > 궁병 > 보병 (강한 쪽 피해 ×1.5 — P3b 가 쓴다).
 */
(function (global) {
  'use strict';

  var UDEF = {
    soldier: { name: '보병', hp: 60, atk: 8, range: 1.2, speed: 2.2, gold: 20, food: 10, train: 80, icon: '🗡️', color: '#e6dfc8', beats: 'cavalry' },
    archer:  { name: '궁병', hp: 40, atk: 7, range: 5.5, speed: 2.0, gold: 30, food: 10, train: 100, icon: '🏹', color: '#8fd16f', beats: 'soldier' },
    cavalry: { name: '기병', hp: 80, atk: 11, range: 1.2, speed: 3.4, gold: 50, food: 20, train: 140, icon: '🐎', color: '#e8a257', beats: 'archer' },
    /* 영웅(W-0035) — 이 표는 바탕값, 실제 능력은 유닛마다 u.st(heroes.statsOf) */
    hero:    { name: '영웅', hp: 100, atk: 10, range: 1.4, speed: 2.6, gold: 150, food: 50, train: 200, icon: '⭐', color: '#ffd36a', beats: null }
  };
  var UNIT_ORDER = ['soldier', 'archer', 'cavalry'];
  var QUEUE_MAX = 5, UPKEEP = 0.2, TICK_S = 0.1, MAX_EXPAND = 8000;
  var IMMEDIATE = 24, PATH_BUDGET = 12;   // 큰 무리에 명령해도 한 틱에 길찾기를 몰아 하지 않는다(앞 24기는 바로, 나머지는 틱마다 12기씩)

  function R() { return global.DG.rts; }

  /** 유닛의 전투 능력 — 영웅은 장수 능력(u.st), 나머지는 표 */
  function statOf(u) { return u.st || UDEF[u.t]; }

  /** 이 타일을 밟을 수 있나 — 물 불가·건물 불가(도로는 가능)·지도 밖 불가 */
  function walkable(s, x, y) {
    var g = R().grid;
    if (!g.inBounds(x, y) || s.tiles[g.idx(x, y)] === g.T.WATER) { return false; }
    var id = s.occ[g.idx(x, y)];
    if (!id) { return true; }
    var b = s.buildings[id];
    return !!(b && R().rules.DEFS[b.t].road);
  }

  /* ── 길찾기(A*) ───────────────────────────────────── */

  function heapPush(h, node) { h.push(node); var i = h.length - 1, p; while (i > 0) { p = (i - 1) >> 1; if (h[p].f <= h[i].f) { break; } var t = h[p]; h[p] = h[i]; h[i] = t; i = p; } }
  function heapPop(h) {
    var top = h[0], last = h.pop(), i = 0, n = h.length, l, r, m, t;
    if (n) { h[0] = last; for (;;) { l = 2 * i + 1; r = l + 1; m = i; if (l < n && h[l].f < h[m].f) { m = l; } if (r < n && h[r].f < h[m].f) { m = r; } if (m === i) { break; } t = h[m]; h[m] = h[i]; h[i] = t; i = m; } }
    return top;
  }

  var DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

  /** 시작 타일 → 목표 타일 길(타일 중심 좌표 배열). 못 가면 가장 가까이 간 칸까지. 시작=목표면 빈 배열 */
  function findPath(s, sx, sy, tx, ty) {
    var g = R().grid, W = g.W, goal, open = [], best = {}, closed = {}, startK = g.idx(sx, sy), expanded = 0, bestK = startK, bestH = 1e9;
    if (!g.inBounds(tx, ty)) { return []; }
    if (!walkable(s, tx, ty)) { goal = nearestWalkable(s, tx, ty); if (!goal) { return []; } tx = goal.x; ty = goal.y; }
    if (sx === tx && sy === ty) { return []; }
    function hOf(x, y) { var dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); }
    best[startK] = 0; heapPush(open, { k: startK, x: sx, y: sy, f: hOf(sx, sy), g: 0 });
    var came = {}, cur, i, d, nx, ny, nk, ng;
    while (open.length && expanded < MAX_EXPAND) {
      cur = heapPop(open);
      if (closed[cur.k]) { continue; }
      closed[cur.k] = true; expanded++;
      if (cur.x === tx && cur.y === ty) { bestK = cur.k; break; }
      var hh = hOf(cur.x, cur.y); if (hh < bestH) { bestH = hh; bestK = cur.k; }
      for (i = 0; i < 8; i++) {
        d = DIRS[i]; nx = cur.x + d[0]; ny = cur.y + d[1];
        if (!walkable(s, nx, ny)) { continue; }
        if (d[0] !== 0 && d[1] !== 0 && (!walkable(s, cur.x + d[0], cur.y) || !walkable(s, cur.x, cur.y + d[1]))) { continue; }   // 모서리 끼어들기 금지
        nk = g.idx(nx, ny); if (closed[nk]) { continue; }
        ng = cur.g + d[2];
        if (best[nk] === undefined || ng < best[nk]) { best[nk] = ng; came[nk] = cur.k; heapPush(open, { k: nk, x: nx, y: ny, f: ng + hOf(nx, ny), g: ng }); }
      }
    }
    var path = [], k = bestK;
    while (k !== startK && k !== undefined) { path.push({ x: (k % W) + 0.5, y: Math.floor(k / W) + 0.5 }); k = came[k]; }
    path.reverse();
    return path;
  }

  /** (x,y) 둘레 고리를 넓혀 가며 가장 가까운 밟을 수 있는 칸 — 없으면 null */
  function nearestWalkable(s, x, y) {
    var r, dx, dy;
    for (r = 1; r <= 8; r++) {
      for (dy = -r; dy <= r; dy++) { for (dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(s, x + dx, y + dy)) { return { x: x + dx, y: y + dy }; } } }
    }
    return null;
  }

  /* ── 생산 ─────────────────────────────────────────── */

  /** 군영 큐에 넣는다 — { ok, why }. 비용은 넣을 때 낸다 */
  function train(s, barracksId, type) {
    var b = s.buildings[barracksId], d = UDEF[type];
    if (!b || b.t !== 'barracks') { return { ok: false, why: '군영이 아니다' }; }
    if (!d) { return { ok: false, why: '알 수 없는 유닛' }; }
    if (!b.conn) { return { ok: false, why: '도로로 이어진 군영만 돈다' }; }
    var q = s.queues[barracksId] || (s.queues[barracksId] = []);
    if (q.length >= QUEUE_MAX) { return { ok: false, why: '큐가 가득 찼다' }; }
    if (s.res.gold < d.gold) { return { ok: false, why: '금이 모자란다' }; }
    if (s.res.food < d.food) { return { ok: false, why: '식량이 모자란다' }; }
    s.res.gold -= d.gold; s.res.food -= d.food;
    q.push({ t: type, left: d.train });
    return { ok: true, why: '' };
  }

  /** 군영 아래쪽에서 가장 가까운 빈 땅에 유닛을 낸다 */
  function spawn(s, type, team, x, y, hid) {
    var u = { id: s.nextUid++, t: type, team: team, x: x, y: y, hp: UDEF[type].hp, path: [], goal: null };
    if (type === 'hero' && hid && R().heroes) { u.hid = hid; u.st = R().heroes.statsOf(hid); u.hp = u.mhp = u.st.hp; }
    s.units[u.id] = u;
    return u;
  }
  function spawnNear(s, b, type, hid) {
    var D = R().rules.DEFS[b.t], p = nearestWalkable(s, b.x + Math.floor(D.w / 2), b.y + D.h) || { x: b.x, y: b.y + D.h };
    return spawn(s, type, 0, p.x + 0.5, p.y + 0.5, hid);
  }

  /* ── 이동 ─────────────────────────────────────────── */

  /** 유닛 하나에 목적지 타일을 준다 — 길을 다시 구한다 */
  function moveTo(s, u, tx, ty) {
    u.goal = { x: tx, y: ty };
    u.path = findPath(s, Math.floor(u.x), Math.floor(u.y), tx, ty);
    return u.path.length;
  }

  /** 무리 이동 — 목적지 둘레에 흩어 세운다(한 칸에 한 기씩 나선형으로) */
  function moveGroup(s, ids, tx, ty) {
    var spots = [{ x: tx, y: ty }], r = 1, dx, dy, i, u, n = 0;
    while (spots.length < ids.length && r < 12) {
      for (dy = -r; dy <= r; dy++) { for (dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(s, tx + dx, ty + dy)) { spots.push({ x: tx + dx, y: ty + dy }); } } }
      r++;
    }
    for (i = 0; i < ids.length; i++) {
      u = s.units[ids[i]]; if (!u) { continue; }
      var sp = spots[Math.min(i, spots.length - 1)];
      if (i < IMMEDIATE) { n += moveTo(s, u, sp.x, sp.y) ? 1 : 0; } else { u.goal = { x: sp.x, y: sp.y }; u.path = []; u.want = { x: sp.x, y: sp.y }; n++; }
    }
    return n;
  }

  /** 한 틱(0.1초) — 생산 큐 진행과 유닛 이동 */
  function tick(s) {
    var id, q, b, u, d, step, target, dx, dy, dist, budget = PATH_BUDGET;
    for (id in s.queues) {
      q = s.queues[id]; b = s.buildings[id];
      if (!b) { delete s.queues[id]; continue; }
      if (!q.length || !b.conn) { continue; }
      q[0].left -= 1;
      if (q[0].left <= 0) { spawnNear(s, b, q[0].t, q[0].hid); q.shift(); }
    }
    for (id in s.units) {
      u = s.units[id]; d = statOf(u);
      if (u.want && budget > 0) { moveTo(s, u, u.want.x, u.want.y); u.want = null; budget--; }
      if (!u.path || !u.path.length) { continue; }
      step = d.speed * TICK_S;
      while (step > 0 && u.path.length) {
        target = u.path[0]; dx = target.x - u.x; dy = target.y - u.y; dist = Math.hypot(dx, dy);
        if (dist <= step) { u.x = target.x; u.y = target.y; step -= dist; u.path.shift(); }
        else { u.x += dx / dist * step; u.y += dy / dist * step; step = 0; }
      }
    }
  }

  function count(s, team) { var n = 0, id; for (id in s.units) { if (s.units[id].team === team) { n++; } } return n; }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.units = { UDEF: UDEF, statOf: statOf, UNIT_ORDER: UNIT_ORDER, QUEUE_MAX: QUEUE_MAX, UPKEEP: UPKEEP, walkable: walkable, findPath: findPath, nearestWalkable: nearestWalkable,
    train: train, spawn: spawn, moveTo: moveTo, moveGroup: moveGroup, tick: tick, count: count };
})(typeof window !== 'undefined' ? window : this);
