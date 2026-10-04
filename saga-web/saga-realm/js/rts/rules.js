/**
 * RTS 건물 표·놓기·철거·도로 연결 (W-0029, P1) — 순수 함수.
 *
 * 판 상태 `s`(rts/state.js): { tiles, occ(Int32Array: 타일 → 건물 id, 0 없음), buildings: { id: {id,t,x,y,conn} }, res, ... }
 * 건물은 **도로로 거점에 이어져야** 돈다(`conn`). 거점(castle, id 1)은 부술 수 없는 뿌리.
 */
(function (global) {
  'use strict';

  var G = function () { return global.DG.rts.grid; };

  /** 건물 표 — w×h 칸, cost(금), jobs(일자리), cap(수용 인구), food/gold(하루 생산, 일자리 채움 비율 곱), upkeep(유지비), free(도로 불필요), radius·happy(닿는 주거의 행복 +), defense */
  var DEFS = {
    castle:   { name: '거점', w: 3, h: 3, cost: 0, cap: 16, icon: '🏯', color: '#c9a24a', fixed: true },
    road:     { name: '도로', w: 1, h: 1, cost: 2, icon: '', color: '#8b8579', road: true },
    house:    { name: '주거', w: 2, h: 2, cost: 30, cap: 8, icon: '🏠', color: '#b9825a' },
    farm:     { name: '농지', w: 3, h: 3, cost: 40, jobs: 6, food: 8, icon: '🌾', color: '#9db04f' },
    market:   { name: '시장', w: 2, h: 2, cost: 60, jobs: 4, gold: 5, icon: '🏪', color: '#cf8f3e' },
    workshop: { name: '공방', w: 3, h: 2, cost: 80, jobs: 6, gold: 6, icon: '🔨', color: '#7f93a8' },
    barracks: { name: '군영', w: 3, h: 2, cost: 100, jobs: 3, upkeep: 3, icon: '⚔️', color: '#a64b4b' },
    /* 시설 — 도로 없이도 선다(free). radius 안의 주거에 효과, 성벽은 지금은 방어 숫자만(전투 P3) */
    well:     { name: '우물', w: 1, h: 1, cost: 25, free: true, radius: 6, happy: 20, icon: '💧', color: '#5aa7d6' },
    tower:    { name: '망루', w: 1, h: 1, cost: 40, free: true, radius: 8, happy: 10, upkeep: 1, icon: '🗼', color: '#c9733a' },
    wall:     { name: '성벽', w: 1, h: 1, cost: 4, free: true, defense: 5, icon: '', color: '#9a9488' },
    /* 적 기지(W-0034) — 짓지도 부수지도(철거) 못 한다. 유닛이 쳐서 hp 를 깎는다. id 는 -1 */
    stronghold: { name: '적 기지', w: 3, h: 3, cost: 0, fixed: true, free: true, hp: 600, icon: '🏴', color: '#7a2e2e' }
  };
  var BUILD_ORDER = ['road', 'house', 'farm', 'market', 'workshop', 'barracks', 'well', 'tower', 'wall'];

  /** 놓을 수 있나 — { ok, why } */
  function canPlace(s, type, x, y) {
    var d = DEFS[type], g = G(), i, j;
    if (!d) { return { ok: false, why: '알 수 없는 건물' }; }
    if (d.fixed) { return { ok: false, why: '거점은 새로 못 짓는다' }; }
    for (j = 0; j < d.h; j++) {
      for (i = 0; i < d.w; i++) {
        if (!g.inBounds(x + i, y + j)) { return { ok: false, why: '지도 밖' }; }
        if (!g.buildable(s.tiles, x + i, y + j)) { return { ok: false, why: '풀밭에만 짓는다' }; }
        if (s.occ[g.idx(x + i, y + j)]) { return { ok: false, why: '이미 무언가 있다' }; }
      }
    }
    if (s.res.gold < d.cost) { return { ok: false, why: '금이 모자란다' }; }
    return { ok: true, why: '' };
  }

  function stamp(s, b, id) {
    var d = DEFS[b.t], g = G(), i, j;
    for (j = 0; j < d.h; j++) { for (i = 0; i < d.w; i++) { s.occ[g.idx(b.x + i, b.y + j)] = id; } }
  }

  /** 거점을 판에 올린다(새 판·복원 때) */
  function placeCastle(s) {
    var c = G().castleSite(), b = { id: 1, t: 'castle', x: c.x, y: c.y, conn: true };
    s.buildings[1] = b; stamp(s, b, 1);
    if (!s.nextId || s.nextId < 2) { s.nextId = 2; }
    return b;
  }

  /** 적 기지를 판에 올린다(새 판·복원 때) — id -1, 체력 가득 */
  function placeStronghold(s) {
    var c = G().enemySite(s.seed), b = { id: -1, t: 'stronghold', x: c.x, y: c.y, conn: true, hp: DEFS.stronghold.hp };
    s.buildings[-1] = b; stamp(s, b, -1);
    return b;
  }

  /** 놓는다 — 성공하면 건물, 아니면 null. 금을 낸다. 도로 연결은 다시 센다. forcedId 는 복원 때만(저장된 id 그대로) */
  function place(s, type, x, y, forcedId) {
    var c = canPlace(s, type, x, y);
    if (!c.ok) { return null; }
    var b = { id: forcedId || s.nextId++, t: type, x: x, y: y, conn: false };
    s.buildings[b.id] = b; stamp(s, b, b.id);
    s.res.gold -= DEFS[type].cost;
    recompute(s);
    return b;
  }

  /** 철거 — 비용의 절반을 돌려준다. 거점은 못 부순다 */
  function remove(s, id) {
    var b = s.buildings[id], d = b && DEFS[b.t], g = G(), i, j;
    if (!b || d.fixed) { return false; }
    for (j = 0; j < d.h; j++) { for (i = 0; i < d.w; i++) { s.occ[g.idx(b.x + i, b.y + j)] = 0; } }
    delete s.buildings[id];
    s.res.gold += Math.floor(d.cost / 2);
    recompute(s);
    return true;
  }

  function buildingAt(s, x, y) {
    if (!G().inBounds(x, y)) { return null; }
    var id = s.occ[G().idx(x, y)];
    return id ? s.buildings[id] : null;
  }

  /** 도로 연결 다시 세기 — 거점에서 도로를 따라 번지는 칸을 구하고, 그 칸에 변이 닿는 건물에 conn=true */
  function recompute(s) {
    var g = G(), W = g.W, H = g.H, reach = new Uint8Array(W * H), queue = [], k, id, b, d, i, j, nx, ny, q, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (id in s.buildings) { s.buildings[id].conn = false; }
    var c = s.buildings[1];
    if (!c) { return; }
    c.conn = true;
    // 거점 가장자리 밖 한 칸에서 시작 — 거점에 닿은 도로만 뿌리
    for (j = 0; j < DEFS.castle.h; j++) {
      for (i = 0; i < DEFS.castle.w; i++) {
        for (k = 0; k < 4; k++) {
          nx = c.x + i + dirs[k][0]; ny = c.y + j + dirs[k][1];
          if (g.inBounds(nx, ny) && !reach[g.idx(nx, ny)] && isRoad(s, nx, ny)) { reach[g.idx(nx, ny)] = 1; queue.push(g.idx(nx, ny)); }
        }
      }
    }
    for (q = 0; q < queue.length; q++) {
      var cx = queue[q] % W, cy = Math.floor(queue[q] / W);
      for (k = 0; k < 4; k++) {
        nx = cx + dirs[k][0]; ny = cy + dirs[k][1];
        if (g.inBounds(nx, ny) && !reach[g.idx(nx, ny)] && isRoad(s, nx, ny)) { reach[g.idx(nx, ny)] = 1; queue.push(g.idx(nx, ny)); }
      }
    }
    for (id in s.buildings) {
      b = s.buildings[id]; d = DEFS[b.t];
      if (b.t === 'castle') { continue; }
      if (d.road) { b.conn = !!reach[g.idx(b.x, b.y)]; continue; }
      if (d.free) { b.conn = true; continue; }   // 우물·망루·성벽은 도로가 필요 없다
      b.conn = touches(s, b, d, reach);
    }
  }

  function isRoad(s, x, y) { var b = buildingAt(s, x, y); return !!(b && DEFS[b.t].road); }

  /** 건물 둘레 한 겹에 이어진 도로 칸이 있나(거점에 바로 붙어도 된다) */
  function touches(s, b, d, reach) {
    var g = G(), i, j, x, y, nb;
    for (j = -1; j <= d.h; j++) {
      for (i = -1; i <= d.w; i++) {
        if ((i >= 0 && i < d.w) && (j >= 0 && j < d.h)) { continue; }   // 건물 안쪽
        if ((i === -1 || i === d.w) && (j === -1 || j === d.h)) { continue; }   // 모서리는 변이 아니다
        x = b.x + i; y = b.y + j;
        if (!g.inBounds(x, y)) { continue; }
        if (reach[g.idx(x, y)]) { return true; }
        nb = buildingAt(s, x, y);
        if (nb && nb.t === 'castle') { return true; }
      }
    }
    return false;
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.rules = { DEFS: DEFS, BUILD_ORDER: BUILD_ORDER, canPlace: canPlace, place: place, remove: remove, placeCastle: placeCastle, placeStronghold: placeStronghold, buildingAt: buildingAt, recompute: recompute };
})(typeof window !== 'undefined' ? window : this);
