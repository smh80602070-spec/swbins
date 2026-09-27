/**
 * 틈새 갈림길 — 여섯째 지역, 이야기 5부 무대 (PLAN §5 ⑲-41, saga-godot PLAN 106 ㊾-1 `world/region6_crossing.gd`)
 * ---------------------------------------------------------------
 *   땅      ⑮ 용의 협곡(바깥 고리) — 은하 나루 가운데에 가장 가까운 그 땅 칸이 가운데(Godot 이 나루 남쪽에 붙인 것.
 *           나루가 꺼져 있으면 고향에 가장 가까운 칸). 시간 틈 안쪽이라 시대가 가장 심하게 뒤엉킨 땅
 *   명소    다섯 — 첫 정거장(현대·미래)·뒤엉킨 성문(과거)·멈춘 시계탑(현대)·떠 있는 섬돌(미래)·틈 고개 경계비. 30m 안 = 발견
 *   발견    작은 발견 열(문자판·틈 등롱·경비 기계·기와 조각·신호기·틈 수정·수레·탈출 포드·표 기계·칼과 투구) — 14m(GPS 30m) 안
 *   이동    첫 정거장·시계탑·틈 고개 — 찾으면 지도(M) 순간이동 지점(키보드 판만, 열쇠 `cr:<id>`)
 *   틈 문   틈 고개 경계비(나루 쪽 GATE_DIST m) 곁 보랏빛 막(+ 벽) — 이야기 18장(4부)을 마치면 사라지고 빛 기둥 둘은 남는다
 *   시계탑  16m 옆면을 타고 오른다(landform 기둥 타기, `poles` — 오르기 기력 ×CLOCK_DRAIN). 네 면 빛 문자판
 *   섬돌    섬돌 열다섯이 1.1m 씩 나선으로 떠 있고 꼭대기에 틈 수정 — 그림만(밟고 오르기는 뒤 순서)
 *   벽      승강장 차막이·성문 기둥·시계탑·문 기둥·(닫힌) 문·경비 기계·신호기는 world3d `houseRects` 로 막는다
 *
 * 자리 잡기는 skyport.js 와 같은 규칙 — 가운데에서 off 만큼 간 곳에서 가장 가까운 그 땅 들·숲 칸(물·마을·길·산·강 아님), 서로 떨어짐.
 * 판정 층(`center`·`sites`·`rectsIn`·`gateOpen`·`poles`)은 순수. 세이브 `save.crossing = { found }`(읽는 쪽 기본값).
 * 그림은 코드 도형(SAGA-DESIGN §7).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('crossing.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var ZONE = 'dragon', REGION = '틈새 갈림길';
  /* off = 가운데에서(m, +y 남쪽). toward = 은하 나루 쪽으로 그만큼(나루가 없으면 북쪽). way = 순간이동 지점 이름 */
  var GATE_DIST = 520;
  var LANDMARKS = [
    { id: 'platform', name: '첫 정거장',     era: '현대·미래', off: [0, -200],  model: 'platform', way: '첫 정거장' },
    { id: 'tgate',    name: '뒤엉킨 성문',   era: '과거',      off: [-280, 80], model: 'tgate' },
    { id: 'clock',    name: '멈춘 시계탑',   era: '현대',      off: [240, 180], model: 'clock', way: '시계탑' },
    { id: 'steps',    name: '떠 있는 섬돌',  era: '미래',      off: [-60, 380], model: 'steps' },
    { id: 'gate',     name: '틈 고개 경계비', era: '미래',     toward: GATE_DIST, model: 'gate', way: '틈 고개' }
  ];
  var SMALL = [
    { id: 'dial',    name: '떨어진 문자판', era: '현대', off: [160, -80],   model: 'dial' },
    { id: 'lantern', name: '틈 등롱',       era: '과거', off: [-180, -120], model: 'lantern' },
    { id: 'guard',   name: '멈춘 경비 기계', era: '미래', off: [320, -20],  model: 'guard' },
    { id: 'tile',    name: '기와 조각',     era: '과거', off: [-360, 220],  model: 'tile' },
    { id: 'signal',  name: '녹슨 신호기',   era: '현대', off: [60, -320],   model: 'signal' },
    { id: 'crystal', name: '틈 수정',       era: '미래', off: [-220, 320],  model: 'crystal' },
    { id: 'cart',    name: '버려진 수레',   era: '과거', off: [-120, 160],  model: 'cart' },
    { id: 'pod',     name: '탈출 포드',     era: '미래', off: [300, 320],   model: 'pod' },
    { id: 'ticket',  name: '표 기계',       era: '현대', off: [120, -240],  model: 'ticket' },
    { id: 'helm',    name: '칼과 투구',     era: '과거', off: [-260, -200], model: 'helm' }
  ];
  var LANDMARK_R = 30, SMALL_R = function (g) { return g ? 30 : 14; };
  var REWARD_BIG = { gold: 150, dust: 2, exp: 40 }, REWARD_SMALL = { gold: 60, exp: 20 };
  var SEARCH_STEP = 8, SEARCH_R = 200, SEP_BIG = 60, SEP_SMALL = 30, TOWER_CLEAR = 40;
  var GATE_HALF = 4, GATE_CH = 'ch18';
  var CLOCK_H = 16, CLOCK_HALF = 1.5, CLOCK_DRAIN = 0.85;   // 16m 를 꽉 찬 기력으로 — 원래 배율이면 15.7m 에서 모자란다
  var STEP_N = 15, STEP_RISE = 1.1, STEP_R = 3.2;           // 섬돌 — 열다섯 × 1.1m = 16.5m, 틈 수정은 그 위
  var RAIL_LEN = 60, PLAT_OFF = 3.2;                        // 첫 정거장 — 선로 남북 60m, 승강장은 선로 동쪽
  var GRID = 48;

  /* ── 자리(순수 — 지형·해시만) ───────────────────────────── */
  var memo = null, centerMemo;
  function terr(x, y) { var W = global.DG.world; try { return W && W.terrainAt ? W.terrainAt(Math.floor(x / GRID), Math.floor(y / GRID)) : null; } catch (e) { return null; } }
  function zoneAt(x, y) { var B = BM(); return B ? B.regionAt(x, y).cell.zone : null; }
  /** 은하 나루 가운데(있으면) — 틈새 갈림길은 그 곁에 붙는다 */
  function portCenter() { var SP = global.DG.skyport; return SP && SP.on && SP.on() && SP.center ? SP.center() : null; }
  /** 갈림길 가운데 — 은하 나루 가운데(없으면 고향)에 가장 가까운 용의 협곡 칸 { key, x, y, name } 또는 null */
  function center() {
    if (centerMemo !== undefined) { return centerMemo; }
    var B = BM();
    if (!B) { return null; }
    var o = portCenter() || { x: 0, y: 0 }, best = null, bd = Infinity;
    for (var j = -14; j <= 14; j++) {
      for (var i = -14; i <= 14; i++) {
        var c = B.cellAt(i, j);
        if (c.zone !== ZONE) { continue; }
        var d = Math.hypot(c.x - o.x, c.y - o.y);
        if (d < bd) { bd = d; best = { key: c.key, x: c.x, y: c.y, name: c.name }; }
      }
    }
    centerMemo = best;
    return best;
  }
  /** 명소의 off — toward 면 은하 나루 쪽으로(없으면 북쪽) */
  function offOf(d, c) {
    if (!d.toward) { return d.off; }
    var p = portCenter(), dx = p ? p.x - c.x : 0, dy = p ? p.y - c.y : -1, L = Math.hypot(dx, dy) || 1;
    return [dx / L * d.toward, dy / L * d.toward];
  }
  function okSpot(x, y, r) {
    var LF = global.DG.landform, pts = r ? [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] : [[0, 0]];
    for (var i = 0; i < pts.length; i++) {
      var px = x + pts[i][0], py = y + pts[i][1], k = terr(px, py);
      if (k !== 'grass' && k !== 'forest' && k !== 'farm') { return false; }
      if (LF && LF.on && LF.on() && LF.riverAt && LF.riverAt(px, py)) { return false; }
      if (zoneAt(px, py) !== ZONE) { return false; }
    }
    return true;
  }
  function placeNear(c, off, taken, sep, r) {
    var tx = c.x + off[0], ty = c.y + off[1];
    for (var rr = 0; rr <= SEARCH_R; rr += SEARCH_STEP) {
      var n = rr ? Math.max(8, Math.round(2 * Math.PI * rr / SEARCH_STEP)) : 1;
      for (var k = 0; k < n; k++) {
        var a = 2 * Math.PI * k / n, x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr;
        if (Math.hypot(x - c.x, y - c.y) < TOWER_CLEAR) { continue; }
        var clash = false;
        for (var t = 0; t < taken.length; t++) { if (Math.hypot(taken[t].x - x, taken[t].y - y) < sep + (taken[t].big ? SEP_BIG - sep : 0)) { clash = true; break; } }
        if (clash || !okSpot(x, y, r)) { continue; }
        return { x: x, y: y };
      }
    }
    return { x: tx, y: ty, forced: true };
  }
  /** 명소 다섯 + 작은 발견 열 — [{ id, name, era, model, big, x, y, way? }]. 세계가 같으면 늘 같다 */
  function sites() {
    if (memo) { return memo; }
    var c = center(), out = [];
    if (!c) { memo = []; return memo; }
    LANDMARKS.forEach(function (d) {
      var p = placeNear(c, offOf(d, c), out, SEP_BIG, d.model === 'platform' ? 10 : (d.model === 'steps' ? STEP_R + 1 : 0));
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: true, x: p.x, y: p.y, way: d.way || null, forced: !!p.forced });
    });
    SMALL.forEach(function (d) {
      var p = placeNear(c, d.off, out, SEP_SMALL, 0);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: false, x: p.x, y: p.y, forced: !!p.forced });
    });
    memo = out;
    return out;
  }
  function siteById(id) { var L = sites(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** 갈림길 땅 안인가 */
  function inRegion(x, y) { return on() && zoneAt(x, y) === ZONE; }
  /** 틈 문이 열렸나 — 이야기 18장(4부 끝)을 마친 뒤 */
  function gateOpen() {
    var ST = global.DG.story, s = core() && core().save ? core().save.story : null;
    if (!ST || !ST.CHAPTERS || !s) { return false; }
    for (var i = 0; i < ST.CHAPTERS.length; i++) { if (ST.CHAPTERS[i].id === GATE_CH) { return s.ch > i; } }
    return false;
  }
  var poleMemo = null;
  /** landform 기둥 타기 — 멈춘 시계탑 하나. 꼭대기는 네모(길 = 가운데 가로 2.2m·폭 2.6m) */
  function poles() {
    if (!on()) { return []; }
    if (poleMemo) { return poleMemo; }
    var p = siteById('clock');
    if (!p) { return []; }
    poleMemo = [{ id: 'cr_clock', x: p.x, y: p.y, r: CLOCK_HALF, top: CLOCK_H, drain: CLOCK_DRAIN, perch: { x: p.x, y: p.y },
      beam: { ax: p.x - 1.1, ay: p.y, bx: p.x + 1.1, by: p.y, w: 2.6 },   // 3m 네모 꼭대기 — 가장자리 0.2m 안쪽
      grab: '🧗 시계탑 벽을 붙잡았다 — 계속 밀면 오른다 · 점프 = 도약 · 등지면 손을 놓는다',
      perchText: '🕰️ 멈춘 시계탑 꼭대기 — 뒤엉킨 시대가 한눈에 보인다 · 뛰면 날개를 편다', edgeText: '🕰️ 탑 끝 — 뛰어내리면(점프) 날개를 편다' }];
    return poleMemo;
  }

  /* ── 벽(월드 좌표 사각형 — world3d houseRects 가 격자 칸마다 가져간다) ─ */
  var rectMemo = null;
  /** 명소 하나의 벽 사각형들 — 문(door)은 닫혀 있을 때만 rectsIn 이 돌려준다 */
  function rectsOf(st) {
    var x = st.x, y = st.y;
    switch (st.model) {
      case 'platform': return [{ x: x, z: y + RAIL_LEN / 2, w: 3, d: 1, rot: 0 }];                                   // 차막이(선로 남쪽 끝)
      case 'tgate': return [{ x: x - 3, z: y, w: 2, d: 2.4, rot: 0 }, { x: x + 3, z: y, w: 2, d: 2.4, rot: 0 }];    // 성문 기둥 둘 — 가운데 문길은 트임
      case 'clock': return [{ x: x, z: y, w: CLOCK_HALF * 2, d: CLOCK_HALF * 2, rot: 0 }];
      case 'gate': return [{ x: x - GATE_HALF, z: y, w: 1, d: 1, rot: 0 }, { x: x + GATE_HALF, z: y, w: 1, d: 1, rot: 0 },
        { x: x, z: y, w: GATE_HALF * 2 - 1, d: 0.6, rot: 0, door: true }, { x: x + GATE_HALF + 3, z: y + 2, w: 1.2, d: 0.6, rot: 0 }];
      case 'guard': return [{ x: x, z: y, w: 1.4, d: 1.4, rot: 0 }];
      case 'signal': return [{ x: x, z: y, w: 0.8, d: 0.8, rot: 0 }];
    }
    return [];
  }
  function rectsIn(gx, gy) {
    if (!on()) { return []; }
    if (!rectMemo) {
      rectMemo = {};
      sites().forEach(function (st) {
        rectsOf(st).forEach(function (r) {
          var k = Math.floor(r.x / GRID) + ',' + Math.floor(r.z / GRID);
          (rectMemo[k] || (rectMemo[k] = [])).push(r);
        });
      });
    }
    var L = rectMemo[gx + ',' + gy] || [];
    return L.some(function (r) { return r.door; }) && gateOpen() ? L.filter(function (r) { return !r.door; }) : L;
  }

  /* ── 세이브·발견 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.crossing || typeof s.crossing !== 'object') { s.crossing = {}; }
    if (!s.crossing.found || typeof s.crossing.found !== 'object') { s.crossing.found = {}; }
    return s.crossing;
  }
  function found(id) { var f = core().save.crossing; return !!(f && f.found && f.found[id]); }
  function radiusOf(st) { return st.big ? LANDMARK_R : SMALL_R(gps()); }
  /** 둘레 안의 안 찾은 곳을 찾는다 — 찾은 것 목록 */
  function discoverAt(px, py) {
    var out = [];
    if (!on()) { return out; }
    sites().forEach(function (st) {
      if (found(st.id) || Math.hypot(st.x - px, st.y - py) > radiusOf(st)) { return; }
      sv().found[st.id] = Date.now();
      var r = st.big ? REWARD_BIG : REWARD_SMALL, c = core(), P = c.save.player;
      P.gold = (P.gold || 0) + r.gold;
      if (r.dust) { c.save.dust = (c.save.dust || 0) + r.dust; }
      if (c.gainExp) { c.gainExp(r.exp); }
      out.push(st);
      toast((st.big ? '🌀 명소 발견 — ' : '✨ 작은 발견 — ') + st.name + ' (' + st.era + ') · 금 +' + r.gold + (st.way ? ' · 순간이동 지점' : ''));
      c.log('🌀 ' + REGION + ' — ' + st.name + ' 발견', 'discover');
      c.emit('crossing:found', { id: st.id, big: st.big });
    });
    if (out.length) { sfx('discover'); core().persist(); }
    return out;
  }
  /** 순간이동 지점 — 찾은 첫 정거장·시계탑·틈 고개 [{ key, x, y, name }] */
  function waypoints() {
    if (!on()) { return []; }
    return sites().filter(function (st) { return st.way && found(st.id); }).map(function (st) {
      return { key: 'cr:' + st.id, x: st.x, y: st.y + 8, name: '🌀 ' + st.way };
    });
  }
  /** 순간이동 — 키보드 판만 · 찾은 곳만 */
  function teleport(id) {
    var W = global.DG.world, st = siteById(id);
    if (!on() || !W || W.mode !== 'keyboard' || !st || !st.way || !found(id)) { return false; }
    var pos = core().save.player.pos;
    pos.x = st.x; pos.y = st.y + 8;
    if (W.walkTo) { W.walkTo(pos.x, pos.y); }
    core().log('🌀 순간이동 — ' + st.way, 'move');
    core().emit('region:teleport', { key: 'cr:' + id });
    return true;
  }
  /** 지도·미니맵 — 명소는 늘(안 찾으면 흐리게), 작은 발견은 찾은 것만 */
  function marks() {
    if (!on()) { return []; }
    return sites().filter(function (st) { return st.big || found(st.id); }).map(function (st) {
      return { id: st.id, x: st.x, y: st.y, name: st.name, big: st.big, found: found(st.id) };
    });
  }

  /* ── 3D ───────────────────────────────────────────────── */
  var fx = {}, clock = 0, mats = null;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function gyAt(w, x, y) { return w.groundY ? w.groundY(x, y) : 0; }
  function M(T3) {
    if (mats) { return mats; }
    var glow = function (c, a) { return new T3.MeshBasicMaterial({ color: c, transparent: a < 1, opacity: a, depthWrite: a >= 1, side: T3.DoubleSide }); };
    mats = {
      stone: new T3.MeshLambertMaterial({ color: 0x8d8a84 }), stoneD: new T3.MeshLambertMaterial({ color: 0x6d6a66 }),
      wood: new T3.MeshLambertMaterial({ color: 0x6b4a2e }), roof: new T3.MeshLambertMaterial({ color: 0x4a4f58 }), red: new T3.MeshLambertMaterial({ color: 0xa8392a }),
      alloy: new T3.MeshStandardMaterial({ color: 0xc4ccd6, metalness: 0.65, roughness: 0.35 }), dark: new T3.MeshLambertMaterial({ color: 0x2a2f38 }),
      rust: new T3.MeshLambertMaterial({ color: 0x8a4a2a }), panel: new T3.MeshStandardMaterial({ color: 0x1f3a66, metalness: 0.4, roughness: 0.3 }),
      paper: new T3.MeshLambertMaterial({ color: 0xefe6cf }), bronze: new T3.MeshStandardMaterial({ color: 0x8c6a3a, metalness: 0.7, roughness: 0.4 }),
      glow: glow(0x66f2ff, 1), roofGlow: glow(0x9fe8ff, 0.4), rift: glow(0xb880ff, 0.45), pillar: glow(0xd6c2ff, 0.35), lamp: glow(0xffe08a, 1),
      dial: glow(0xfff2c4, 0.9), crystal: glow(0xc79bff, 0.8)
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function cyl(T3, g, m, rt, rb, h, x, y, z, seg) { var o = new T3.Mesh(new T3.CylinderGeometry(rt, rb, h, seg || 12), m); o.position.set(x, y, z); g.add(o); return o; }
  function ball(T3, g, m, r, x, y, z) { var o = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; }
  function gem(T3, g, m, r, x, y, z) { var o = new T3.Mesh(new T3.OctahedronGeometry(r), m); o.position.set(x, y, z); g.add(o); return o; }
  function build(w, T3, st) {
    var m = M(T3), g = new T3.Group(), o = { root: g, spin: [], bob: [], blink: null, door: null }, i;
    var y0 = gyAt(w, st.x, st.y);
    switch (st.model) {
      case 'platform': {
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.dark, 0.15, 0.12, RAIL_LEN, i * 0.75, 0.06, 0); }                // 선로(남북)
        for (i = 0; i < 20; i++) { box(T3, g, m.wood, 2.2, 0.1, 0.3, 0, 0.03, -RAIL_LEN / 2 + 1.5 + i * 3); }
        box(T3, g, m.stone, 3.4, 0.8, 18, PLAT_OFF, 0.4, 0);                                                       // 승강장(선로 동쪽)
        for (i = 0; i < 4; i++) { box(T3, g, m.alloy, 0.15, 3, 0.15, PLAT_OFF + 1.2, 2.3, -7 + i * 4.6); }
        box(T3, g, m.roofGlow, 2.8, 0.06, 16, PLAT_OFF + 0.4, 3.8, 0);                                              // 빛 지붕
        box(T3, g, m.wood, 0.12, 2.2, 0.12, PLAT_OFF + 1.4, 1.9, 5); box(T3, g, m.paper, 0.1, 0.7, 2.2, PLAT_OFF + 1.4, 3, 5);   // 한지 역명판
        box(T3, g, m.panel, 0.1, 1.1, 1.6, PLAT_OFF + 1.6, 1.8, -4); ball(T3, g, m.dial, 0.35, PLAT_OFF + 1.5, 2.1, -4).scale.x = 0.2;   // 바늘 없는 시간표
        box(T3, g, m.red, 3, 1, 0.6, 0, 0.5, RAIL_LEN / 2); box(T3, g, m.dark, 2.4, 0.3, 0.3, 0, 1.1, RAIL_LEN / 2 - 0.4);   // 차막이
        break;
      }
      case 'tgate': {
        var gg = new T3.Group(); gg.rotation.z = 0.21; g.add(gg);                                                 // 12° 기운 누각 성문
        box(T3, gg, m.stone, 2, 4, 2.4, -3, 2, 0); box(T3, gg, m.stone, 2, 4, 2.4, 3, 2, 0); box(T3, gg, m.stone, 8, 1.2, 2.4, 0, 4.6, 0);
        for (i = 0; i < 4; i++) { box(T3, gg, m.red, 0.25, 2, 0.25, -2.8 + i * 1.86, 6.2, 0); }
        box(T3, gg, m.roof, 9, 0.35, 3.6, 0, 7.3, 0); box(T3, gg, m.roof, 6.4, 0.9, 2.2, 0, 7.9, 0);
        for (i = 0; i < 4; i++) {                                                                                  // 허공에 멈춘 성벽 조각 넷
          var fr = box(T3, g, m.stoneD, 2.2, 1, 1.2, -6 + i * 4, 2.5 + i * 1.4, 4 + (i % 2) * 2); fr.rotation.set(0.2 * i, 0.5 * i, 0.15);
          o.bob.push({ o: fr, y: fr.position.y, ph: i * 1.3 });
        }
        break;
      }
      case 'clock': {
        box(T3, g, m.stone, CLOCK_HALF * 2, CLOCK_H, CLOCK_HALF * 2, 0, CLOCK_H / 2, 0);                           // 16m 탑
        box(T3, g, m.stoneD, CLOCK_HALF * 2 + 0.4, 0.3, CLOCK_HALF * 2 + 0.4, 0, CLOCK_H, 0);
        for (i = 0; i < 4; i++) {                                                                                  // 네 면 빛 문자판(바늘은 멈춤)
          var a = i * Math.PI / 2, dx = Math.sin(a) * (CLOCK_HALF + 0.03), dz = Math.cos(a) * (CLOCK_HALF + 0.03);
          var dl = new T3.Mesh(new T3.CircleGeometry(1.05, 24), m.dial); dl.position.set(dx, CLOCK_H - 3, dz); dl.rotation.y = a; g.add(dl);
          var hd = box(T3, g, m.dark, 0.08, 0.8, 0.04, dx * 1.01, CLOCK_H - 2.7, dz * 1.01, a); hd.rotation.z = 0.9;
        }
        var cap = new T3.Mesh(new T3.ConeGeometry(2.3, 2.4, 4), m.roof); cap.position.set(0, CLOCK_H + 1.5, 0); cap.rotation.y = Math.PI / 4; g.add(cap);
        break;
      }
      case 'steps': {
        for (i = 0; i < STEP_N; i++) {                                                                             // 섬돌 열다섯 — 1.1m 씩 나선
          var sa = i * 0.7, sb = box(T3, g, m.stone, 1.6, 0.4, 1.6, Math.cos(sa) * STEP_R, STEP_RISE * (i + 1), Math.sin(sa) * STEP_R, sa);
          o.bob.push({ o: sb, y: sb.position.y, ph: i * 0.6 });
        }
        var cr = gem(T3, g, m.crystal, 0.9, 0, STEP_RISE * STEP_N + 1.1, 0); o.spin.push(cr);                    // 꼭대기 틈 수정
        break;
      }
      case 'gate': {
        box(T3, g, m.stoneD, 1.6, 0.4, 1, GATE_HALF + 3, 0.2, 2); box(T3, g, m.stone, 1.1, 2.6, 0.5, GATE_HALF + 3, 1.7, 2);   // 경계비
        for (i = -1; i <= 1; i += 2) {                                                                             // 빛 기둥 둘(문이 열려도 남는다)
          box(T3, g, m.alloy, 1, 5, 1, i * GATE_HALF, 2.5, 0);
          cyl(T3, g, m.pillar, 0.9, 0.9, 12, i * GATE_HALF, 6, 0, 12);
        }
        o.door = new T3.Mesh(new T3.PlaneGeometry(GATE_HALF * 2 - 1, 4.6), m.rift);                               // 보랏빛 막
        o.door.position.set(0, 2.3, 0); g.add(o.door);
        break;
      }
      case 'dial': { var dd = new T3.Mesh(new T3.CircleGeometry(0.9, 20), m.dial); dd.rotation.x = -1.2; dd.position.y = 0.4; g.add(dd); box(T3, g, m.dark, 0.06, 0.02, 0.6, 0, 0.45, 0, 0.5); break; }
      case 'lantern': box(T3, g, m.stone, 0.5, 1.2, 0.5, 0, 0.6, 0); o.blink = box(T3, g, m.lamp, 0.6, 0.5, 0.6, 0, 1.45, 0); box(T3, g, m.stone, 0.9, 0.2, 0.9, 0, 1.8, 0); break;
      case 'guard': box(T3, g, m.alloy, 1.2, 1.4, 1.2, 0, 0.9, 0); ball(T3, g, m.alloy, 0.5, 0, 1.9, 0); o.blink = ball(T3, g, m.lamp, 0.12, 0, 1.95, 0.45); break;
      case 'tile': for (i = 0; i < 3; i++) { var tl = box(T3, g, m.roof, 0.6, 0.08, 0.4, i * 0.5 - 0.5, 0.05 + i * 0.05, (i % 2) * 0.3, i); tl.rotation.z = 0.2; } break;
      case 'signal': box(T3, g, m.rust, 0.2, 3.2, 0.2, 0, 1.6, 0); box(T3, g, m.dark, 0.6, 1.2, 0.3, 0, 3, 0); o.blink = ball(T3, g, m.lamp, 0.16, 0, 3.3, 0.18); break;
      case 'crystal': { var c1 = gem(T3, g, m.crystal, 0.6, 0, 0.9, 0); c1.scale.y = 1.6; o.spin.push(c1); break; }
      case 'cart': box(T3, g, m.wood, 1.6, 0.5, 1, 0, 0.7, 0, 0.3); for (i = -1; i <= 1; i += 2) { var wh = cyl(T3, g, m.wood, 0.45, 0.45, 0.12, 0, 0.45, i * 0.6, 12); wh.rotation.x = Math.PI / 2; } break;
      case 'pod': { var pd = ball(T3, g, m.alloy, 0.9, 0, 0.6, 0); pd.scale.set(1, 0.8, 1.4); pd.rotation.z = 0.4; o.blink = ball(T3, g, m.glow, 0.15, 0.5, 1.1, 0); break; }
      case 'ticket': box(T3, g, m.panel, 0.8, 1.6, 0.6, 0, 0.8, 0); box(T3, g, m.glow, 0.5, 0.3, 0.05, 0, 1.3, 0.31); break;
      case 'helm': { var sw = box(T3, g, m.alloy, 0.08, 1.4, 0.2, 0, 0.7, 0); sw.rotation.z = 0.15; ball(T3, g, m.bronze, 0.35, 0.5, 0.25, 0.2).scale.y = 0.7; break; }
    }
    g.position.set(st.x, y0, st.y);
    w.addFx(g);
    return o;
  }
  function paint(dt) {
    clock += dt || 0;
    var w = W3();
    if (!w) { fx = {}; return; }
    var T3 = w.three();
    if (!T3) { return; }
    var p = core().save.player.pos, seen = {}, L = sites(), i, open = gateOpen();
    for (i = 0; i < L.length; i++) {
      var st = L[i];
      if (Math.hypot(st.x - p.x, st.y - p.y) > 280) { continue; }
      seen[st.id] = true;
      var o = fx[st.id] || (fx[st.id] = build(w, T3, st));
      for (var k = 0; k < o.spin.length; k++) { o.spin[k].rotation.y += (dt || 0) * 0.8; }
      for (k = 0; k < o.bob.length; k++) { o.bob[k].o.position.y = o.bob[k].y + Math.sin(clock * 1.1 + o.bob[k].ph) * 0.15; }
      if (o.blink) { o.blink.visible = Math.sin(clock * 3 + i) > 0; }
      if (o.door) { o.door.visible = !open; if (!open) { o.door.material.opacity = 0.35 + Math.sin(clock * 2) * 0.1; } }
    }
    for (var id in fx) { if (fx.hasOwnProperty(id) && !seen[id]) { w.removeFx(fx[id].root); delete fx[id]; } }
  }

  var acc = 0;
  function tick(dt) {
    if (!core() || !core().save || !on()) { return; }
    acc += dt || 0;
    if (acc >= 0.25) { acc = 0; var p = core().save.player.pos; discoverAt(p.x, p.y); }
    if (!global.DG_NO_DRAW) { paint(dt); }
  }

  global.DG = global.DG || {};
  global.DG.crossing = {
    ZONE: ZONE, REGION: REGION, LANDMARKS: LANDMARKS, SMALL: SMALL, LANDMARK_R: LANDMARK_R, SMALL_R: SMALL_R, REWARD_BIG: REWARD_BIG, REWARD_SMALL: REWARD_SMALL,
    SEP_BIG: SEP_BIG, SEP_SMALL: SEP_SMALL, TOWER_CLEAR: TOWER_CLEAR, GATE_HALF: GATE_HALF, GATE_DIST: GATE_DIST, CLOCK_H: CLOCK_H, CLOCK_HALF: CLOCK_HALF, CLOCK_DRAIN: CLOCK_DRAIN,
    STEP_N: STEP_N, STEP_RISE: STEP_RISE, RAIL_LEN: RAIL_LEN,
    on: on, center: center, sites: sites, siteById: siteById, inRegion: inRegion, gateOpen: gateOpen, rectsOf: rectsOf, rectsIn: rectsIn, poles: poles,
    found: found, discoverAt: discoverAt, waypoints: waypoints, teleport: teleport, marks: marks, tick: tick,
    _resetForTest: function () { memo = null; rectMemo = null; centerMemo = undefined; poleMemo = null; }
  };
})(window);
