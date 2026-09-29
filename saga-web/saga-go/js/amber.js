/**
 * 굳은 거리 — 여덟째 지역, 이야기 9부 무대 (PLAN §5 ⑲-57, saga-godot PLAN 106 53-1 `world/region8_amber.gd`)
 * ---------------------------------------------------------------
 *   땅      은하 나루(skyport.js) 북쪽 고개 너머 AMBER_OFF m — 가운데에서 가장 가까운 뭍 칸. 틈이 닫히던 날 통째로 호박빛으로 굳은 옛 도시 거리
 *   명소    여섯 — 네거리(신호등 넷·굳은 자리 셋)·초롱 시계방(괘종시계)·호박 속 장터(결정 돔)·짓다 만 부양탑(심 기둥 벽 타기)·
 *           고가 선로와 멈춘 전철(보기만)·신상(순간이동) + 북쪽 고개 결정 막(1차 결말 뒤 풀림). 30m 안 = 발견
 *   발견    작은 발견 열 — 14m(GPS 30m) 안. 여섯 + 열 = 열여섯
 *   이동    고개 어귀·신상·부양탑 — 찾으면 지도(M) 순간이동 지점(키보드 판만, 열쇠 `am:<id>`)
 *   고개 막 결정 막(벽) — 이야기 29장을 마치면 녹는다(`passOpen`). 열린 땅이라 땅 전체를 막진 않는다 — 9부로 드는 자리 표지
 *   이야기 자리 굳은 자리 셋은 30장 5·6·7단계부터 녹고(`crystalOff`), 장터 돔은 31장 2단계부터 깨지고(`domeBroken`),
 *           부양탑은 32장 3단계부터 녹고(`towerMelted`), 네거리 신호등은 32장을 마치면 초록(`lightsGreen`) — 그 장들은 다음 순서
 *   벽      결정 막·굳은 자리·시계방·장터 돔·부양탑 심·선로 기둥·신상은 world3d `houseRects` 로 막는다 · 부양탑 심은 landform 기둥 타기(`poles`)
 * 자리 잡기는 skyport.js 와 같은 규칙 — 가운데에서 off 만큼 간 곳에서 가장 가까운 뭍 칸(물·마을·길·산·강 아님), 서로 떨어짐.
 * 판정 층(`center`·`sites`·`rectsIn`·`passOpen`…)은 순수. 세이브 `save.amber = { found }`. 그림은 코드 도형(SAGA-DESIGN §7).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('amber.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function SP() { var s = global.DG.skyport; return s && s.on && s.on() && s.center ? s : null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var REGION = '굳은 거리', AMBER_OFF = [0, -1500];       // 은하 나루 가운데에서(m, +y 남쪽) 북쪽 고개 너머
  /* off = 가운데에서(m). way = 순간이동 지점 이름 */
  var LANDMARKS = [
    { id: 'pass',   name: '북쪽 고개 결정 막', era: '미래', off: [0, 460],    model: 'pass', way: '굳은 거리 어귀' },
    { id: 'cross',  name: '굳은 거리 네거리',   era: '현대', off: [0, 0],      model: 'cross' },
    { id: 'clock',  name: '초롱 시계방',        era: '현대', off: [-90, -40],  model: 'clock' },
    { id: 'market', name: '호박 속 장터',       era: '과거', off: [130, -150], model: 'market' },
    { id: 'tower',  name: '짓다 만 부양탑',     era: '미래', off: [-140, -300], model: 'tower', way: '부양탑' },
    { id: 'rail',   name: '고가 선로와 멈춘 전철', era: '현대', off: [210, 90], model: 'rail' },
    { id: 'statue', name: '거리의 신상',        era: '과거', off: [0, -120],   model: 'statue', way: '거리의 신상' }
  ];
  var SMALL = [
    { id: 'lamp',    name: '굳은 가로등',   era: '현대', off: [60, 40],    model: 'lamp' },
    { id: 'bench',   name: '호박 든 벤치',  era: '현대', off: [-50, 90],   model: 'bench' },
    { id: 'vend',    name: '멈춘 자판기',   era: '현대', off: [110, -30],  model: 'vend' },
    { id: 'mailbox', name: '굳은 우체통',   era: '현대', off: [-30, -80],  model: 'mailbox' },
    { id: 'cart',    name: '멈춘 손수레',   era: '과거', off: [170, -260], model: 'cart' },
    { id: 'jar',     name: '호박 속 옹기',  era: '과거', off: [90, -210],  model: 'jar' },
    { id: 'kite',    name: '허공에 굳은 연', era: '과거', off: [-200, 20], model: 'kite' },
    { id: 'drone',   name: '떨어진 배달 드론', era: '미래', off: [30, 300], model: 'drone' },
    { id: 'board',   name: '꺼진 안내판',   era: '미래', off: [-60, 220],  model: 'board' },
    { id: 'panel',   name: '금 간 태양 패널', era: '미래', off: [-230, -180], model: 'panel' }
  ];
  /** 네거리 굳은 자리 셋 — 네거리 가운데에서 m. 30장 5·6·7단계부터 녹는다 */
  var CRYSTALS = [{ name: '신호등 앞', off: [11, -9] }, { name: '버스 정류장', off: [-14, 7] }, { name: '우체통 곁', off: [6, 15] }];
  var LIGHTS = [[9, 9], [-9, 9], [9, -9], [-9, -9]];            // 네거리 신호등 넷
  var CH30 = 29, CH31 = 30, CH32 = 31, PASS_CH = 29;              // 0부터
  var CLOCK_WIND_STEP = 5, LIGHTS_GREEN_STEP = 5;            // 32장 다섯째 단계(거북을 쓰러뜨린 뒤)부터 신호등 초록
  var CRYSTAL_OFF_FROM = [5, 6, 7], DOME_FROM = [CH31, 2], TOWER_FROM = [CH32, 3];
  var LANDMARK_R = 30, SMALL_R = function (g) { return g ? 30 : 14; };
  var REWARD_BIG = { gold: 180, dust: 2, exp: 50 }, REWARD_SMALL = { gold: 70, exp: 24 };
  var SEARCH_STEP = 8, SEARCH_R = 400, SEP_BIG = 60, SEP_SMALL = 30;
  var TOWER_HALF = 3, TOWER_H = 12, TOWER_DRAIN = 0.7, DOME_R = 4.6, PASS_HALF = 9;
  var GRID = 48;

  /* ── 자리(순수 — 지형·해시만) ───────────────────────────── */
  var memo = null, centerMemo;
  function terr(x, y) { var W = global.DG.world; try { return W && W.terrainAt ? W.terrainAt(Math.floor(x / GRID), Math.floor(y / GRID)) : null; } catch (e) { return null; } }
  function okSpot(x, y, r) {
    var LF = global.DG.landform, pts = r ? [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] : [[0, 0]];
    for (var i = 0; i < pts.length; i++) {
      var px = x + pts[i][0], py = y + pts[i][1], k = terr(px, py);
      if (k !== 'grass' && k !== 'forest' && k !== 'farm') { return false; }
      if (LF && LF.on && LF.on() && LF.riverAt && LF.riverAt(px, py)) { return false; }
    }
    return true;
  }
  function nearLand(tx, ty, taken, sep, r, avoid) {
    for (var rr = 0; rr <= SEARCH_R; rr += SEARCH_STEP) {
      var n = rr ? Math.max(8, Math.round(2 * Math.PI * rr / SEARCH_STEP)) : 1;
      for (var k = 0; k < n; k++) {
        var a = 2 * Math.PI * k / n, x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr, clash = false;
        for (var t = 0; t < taken.length; t++) { if (Math.hypot(taken[t].x - x, taken[t].y - y) < sep + (taken[t].big ? SEP_BIG - sep : 0)) { clash = true; break; } }
        if (!clash && avoid && Math.hypot(avoid.x - x, avoid.y - y) < 20) { clash = true; }
        if (clash || !okSpot(x, y, r)) { continue; }
        return { x: x, y: y };
      }
    }
    return { x: tx, y: ty, forced: true };
  }
  /** 거리 가운데 — 은하 나루 북쪽 고개 너머 가장 가까운 뭍 { x, y } 또는 null(나루가 없으면) */
  function center() {
    if (centerMemo !== undefined) { return centerMemo; }
    var s = SP(), c = s ? s.center() : null;
    if (!c) { return null; }
    var p = nearLand(c.x + AMBER_OFF[0], c.y + AMBER_OFF[1], [], 0, 30);
    centerMemo = { x: p.x, y: p.y };
    return centerMemo;
  }
  /** 명소 일곱 + 작은 발견 열 — [{ id, name, era, model, big, x, y, way? }]. 세계가 같으면 늘 같다 */
  function sites() {
    if (memo) { return memo; }
    var c = center(), out = [];
    if (!c) { memo = []; return memo; }
    LANDMARKS.forEach(function (d) {
      var p = d.id === 'cross' ? { x: c.x, y: c.y } : nearLand(c.x + d.off[0], c.y + d.off[1], out, SEP_BIG, d.id === 'pass' ? 0 : 6);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: true, x: p.x, y: p.y, way: d.way || null, forced: !!p.forced });
    });
    SMALL.forEach(function (d) {
      var p = nearLand(c.x + d.off[0], c.y + d.off[1], out, SEP_SMALL, 0);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: false, x: p.x, y: p.y, forced: !!p.forced });
    });
    memo = out;
    return out;
  }
  function siteById(id) { var L = sites(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** 이야기 자리 — 'cross'·'clock'·… 명소 가운데 또는 'crystal0~2'(굳은 자리 셋)·'light0~3'(신호등) — 없으면 null */
  function spot(part) {
    var m = /^(crystal|light)(\d)$/.exec(part), c = siteById('cross');
    if (m) { var t = m[1] === 'crystal' ? CRYSTALS : LIGHTS, e = t[+m[2]], o = m[1] === 'crystal' ? (e && e.off) : e; return c && o ? { x: c.x + o[0], y: c.y + o[1] } : null; }
    var s = siteById(part);
    return s ? { x: s.x, y: s.y } : null;
  }
  function storyAt() { var s = core() && core().save ? core().save.story : null; return s || { ch: 0, step: 0 }; }
  function reached(ch, step) { var s = storyAt(); return s.ch > ch || (s.ch === ch && (s.step || 0) >= step); }
  /** 고개 결정 막이 풀렸나 — 1차 결말(29장)을 마친 뒤(손잡이 amber.pass 1 이면 늘 열림, 확인용) */
  function passOpen() { return K('pass', 0) ? true : storyAt().ch >= PASS_CH; }
  function crystalOff(i) { return reached(CH30, CRYSTAL_OFF_FROM[i]); }
  function domeBroken() { return reached(DOME_FROM[0], DOME_FROM[1]); }
  function towerMelted() { return reached(TOWER_FROM[0], TOWER_FROM[1]); }
  function lightsGreen() { return reached(CH32, LIGHTS_GREEN_STEP); }
  /** 괘종시계·처마 시계 바늘이 도나 — 31장 다섯째(5)단계(되감는 동안) */
  function clockWinding() { var s = storyAt(); return s.ch === CH31 && (s.step || 0) === CLOCK_WIND_STEP; }
  function inRegion(x, y) { var c = center(); return on() && !!c && Math.hypot(x - c.x, y - c.y) <= 620; }

  var poleMemo = null;
  /** landform 기둥 타기 — 부양탑 심 하나(6×6m·12m). 꼭대기는 네모 */
  function poles() {
    if (!on()) { return []; }
    if (poleMemo) { return poleMemo; }
    var p = siteById('tower');
    if (!p) { return []; }
    poleMemo = [{ id: 'am_tower', x: p.x, y: p.y, r: TOWER_HALF, top: TOWER_H, drain: TOWER_DRAIN, perch: { x: p.x, y: p.y },
      beam: { ax: p.x - 2.3, ay: p.y, bx: p.x + 2.3, by: p.y, w: 5.4 },   // 6m 네모 꼭대기 — 가장자리 0.3m 안쪽
      grab: '🧗 부양탑 심 기둥을 붙잡았다 — 계속 밀면 오른다 · 점프 = 도약 · 등지면 손을 놓는다',
      perchText: '🏗️ 부양탑 꼭대기 — 굳은 거리가 한눈에 보인다 · 뛰면 날개를 편다', edgeText: '🏗️ 탑 끝 — 뛰어내리면(점프) 날개를 편다' }];
    return poleMemo;
  }

  /* ── 벽(월드 좌표 사각형 — world3d houseRects 가 격자 칸마다 가져간다) ─ */
  var rectMemo = null;
  /** 명소 하나의 벽 사각형들 — 문(door)·상태 칸(when)은 rectsIn 이 그때그때 거른다 */
  function rectsOf(st) {
    var x = st.x, y = st.y, out = [], i;
    switch (st.model) {
      case 'pass': return [{ x: x, z: y, w: PASS_HALF * 2, d: 1.4, rot: 0, door: true }];
      case 'cross':
        CRYSTALS.forEach(function (c, k) { out.push({ x: x + c.off[0], z: y + c.off[1], w: 2.4, d: 2.4, rot: 0, crystal: k }); });
        LIGHTS.forEach(function (l) { out.push({ x: x + l[0], z: y + l[1], w: 0.5, d: 0.5, rot: 0 }); });
        return out;
      case 'clock': return [{ x: x, z: y, w: 10, d: 7, rot: 0 }];
      case 'market': return [{ x: x, z: y, w: DOME_R * 1.8, d: DOME_R * 1.8, rot: 0, dome: true }];
      case 'tower': return [{ x: x, z: y, w: TOWER_HALF * 2, d: TOWER_HALF * 2, rot: 0 }];
      case 'rail': for (i = -3; i <= 3; i++) { out.push({ x: x + i * 22, z: y, w: 1.6, d: 1.6, rot: 0 }); } return out;
      case 'statue': return [{ x: x, z: y, w: 3.2, d: 3.2, rot: 0 }];
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
    return (rectMemo[gx + ',' + gy] || []).filter(function (r) {
      if (r.door) { return !passOpen(); }
      if (r.dome) { return !domeBroken(); }
      if (r.crystal !== undefined) { return !crystalOff(r.crystal); }
      return true;
    });
  }

  /* ── 세이브·발견 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.amber || typeof s.amber !== 'object') { s.amber = {}; }
    if (!s.amber.found || typeof s.amber.found !== 'object') { s.amber.found = {}; }
    return s.amber;
  }
  function found(id) { var f = core().save.amber; return !!(f && f.found && f.found[id]); }
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
      toast((st.big ? '🟠 명소 발견 — ' : '✨ 작은 발견 — ') + st.name + ' (' + st.era + ') · 금 +' + r.gold + (st.way ? ' · 순간이동 지점' : ''));
      c.log('🟠 ' + REGION + ' — ' + st.name + ' 발견', 'discover');
      c.emit('amber:found', { id: st.id, big: st.big });
    });
    if (out.length) { sfx('discover'); core().persist(); }
    return out;
  }
  /** 순간이동 지점 — 찾은 고개 어귀·부양탑·신상 [{ key, x, y, name }] */
  function waypoints() {
    if (!on()) { return []; }
    return sites().filter(function (st) { return st.way && found(st.id); }).map(function (st) {
      return { key: 'am:' + st.id, x: st.x, y: st.y + 8, name: '🟠 ' + st.way };
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
    core().emit('region:teleport', { key: 'am:' + id });
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
    var tr = function (c, a) { return new T3.MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, side: T3.DoubleSide }); };
    mats = {
      amber: tr(0xf0a030, 0.55), amberD: tr(0xd07a18, 0.7), amberS: tr(0xffc860, 0.35),
      asphalt: new T3.MeshLambertMaterial({ color: 0x3a3c44 }), line: new T3.MeshLambertMaterial({ color: 0xe8e6da }),
      stone: new T3.MeshLambertMaterial({ color: 0x8d8a84 }), wall: new T3.MeshLambertMaterial({ color: 0xa89a82 }), roof: new T3.MeshLambertMaterial({ color: 0x5a3f34 }),
      wood: new T3.MeshLambertMaterial({ color: 0x6b4a2e }), alloy: new T3.MeshStandardMaterial({ color: 0xc4ccd6, metalness: 0.65, roughness: 0.35 }),
      dark: new T3.MeshLambertMaterial({ color: 0x2a2f38 }), rust: new T3.MeshLambertMaterial({ color: 0x8a4a2a }), bronze: new T3.MeshStandardMaterial({ color: 0x8c6a3a, metalness: 0.7, roughness: 0.4 }),
      red: new T3.MeshBasicMaterial({ color: 0xff4a30 }), green: new T3.MeshBasicMaterial({ color: 0x5cff7a }), off: new T3.MeshBasicMaterial({ color: 0x3a3a3a }),
      panel: new T3.MeshStandardMaterial({ color: 0x1f3a66, metalness: 0.4, roughness: 0.3 }), train: new T3.MeshLambertMaterial({ color: 0x6a7f96 })
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function cyl(T3, g, m, rt, rb, h, x, y, z, seg) { var o = new T3.Mesh(new T3.CylinderGeometry(rt, rb, h, seg || 12), m); o.position.set(x, y, z); g.add(o); return o; }
  function ball(T3, g, m, r, x, y, z) { var o = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; }
  function shards(T3, g, m, n, r, h, x, z) {                                                    // 호박 결정 무더기 — 뾰족한 뿔 여럿
    for (var i = 0; i < n; i++) {
      var a = i * 2.4, rr = r * (0.3 + (i % 3) * 0.3), s = new T3.Mesh(new T3.ConeGeometry(0.5 + (i % 3) * 0.25, h * (0.6 + (i % 4) * 0.15), 5), m);
      s.position.set(x + Math.cos(a) * rr, h * 0.3, z + Math.sin(a) * rr); s.rotation.z = (i % 3 - 1) * 0.25; g.add(s);
    }
  }
  function build(w, T3, st) {
    var m = M(T3), g = new T3.Group(), o = { root: g, lights: [], crystals: [], dome: null, shell: null, tower: null, pass: null }, i;
    switch (st.model) {
      case 'pass': {
        o.pass = new T3.Group(); g.add(o.pass);
        for (i = -3; i <= 3; i++) { shards(T3, o.pass, m.amber, 3, 1.6, 6 + Math.abs(3 - Math.abs(i)) * 0.4, i * 2.6, 0); }
        box(T3, o.pass, m.amberS, PASS_HALF * 2, 7, 1.2, 0, 3.5, 0);
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.stone, 1.2, 4, 1.2, i * (PASS_HALF + 1.6), 2, 0); }   // 고개 경계 돌기둥
        break;
      }
      case 'cross': {
        cyl(T3, g, m.asphalt, 22, 22, 0.12, 0, 0.06, 0, 32);
        box(T3, g, m.asphalt, 60, 0.12, 12, 0, 0.06, 0); box(T3, g, m.asphalt, 12, 0.12, 60, 0, 0.06, 0);
        for (i = -2; i <= 2; i++) { box(T3, g, m.line, 0.7, 0.05, 5, i * 1.6, 0.14, 12); box(T3, g, m.line, 0.7, 0.05, 5, i * 1.6, 0.14, -12); }
        LIGHTS.forEach(function (l) {
          cyl(T3, g, m.dark, 0.1, 0.12, 4.4, l[0], 2.2, l[1], 6);
          var lamp = new T3.Mesh(new T3.SphereGeometry(0.28, 8, 6), m.red); lamp.position.set(l[0], 4.5, l[1]); g.add(lamp); o.lights.push(lamp);
        });
        CRYSTALS.forEach(function (c) { var cg = new T3.Group(); cg.position.set(c.off[0], 0, c.off[1]); shards(T3, cg, m.amber, 5, 1.2, 3.2, 0, 0); g.add(cg); o.crystals.push(cg); });
        break;
      }
      case 'clock': {
        box(T3, g, m.wall, 10, 4.4, 7, 0, 2.2, 0); box(T3, g, m.roof, 10.6, 0.5, 7.6, 0, 4.7, 0);
        box(T3, g, m.dark, 1.4, 2.6, 0.2, 2.4, 1.3, 3.55);                                              // 문
        box(T3, g, m.alloy, 2.6, 1.6, 0.15, -2.2, 2.6, 3.55);                                            // 쇼윈도
        ball(T3, g, m.line, 0.9, 0, 5.6, 3.5).scale.z = 0.25;                                             // 처마 시계
        o.hands = new T3.Group(); o.hands.position.set(0, 5.6, 3.72); g.add(o.hands);                     // 바늘(되감는 동안 돈다, ⑲-59)
        box(T3, o.hands, m.dark, 0.08, 0.7, 0.04, 0, 0.3, 0); box(T3, o.hands, m.dark, 0.5, 0.06, 0.04, 0.2, 0, 0);
        box(T3, g, m.wood, 1.1, 3.2, 0.9, -6.4, 1.6, 0); ball(T3, g, m.bronze, 0.3, -6.4, 2.4, 0.5);      // 서쪽 괘종시계
        break;
      }
      case 'market': {
        for (i = 0; i < 4; i++) { var a = i * Math.PI / 2 + 0.4; box(T3, g, m.wood, 1.8, 1.2, 1.4, Math.cos(a) * 2.6, 0.6, Math.sin(a) * 2.6, a); box(T3, g, m.roof, 2.4, 0.2, 1.9, Math.cos(a) * 2.6, 1.4, Math.sin(a) * 2.6, a); }
        cyl(T3, g, m.stone, 0.8, 0.8, 0.8, 0, 0.4, 0, 8);
        var dome = new T3.Mesh(new T3.SphereGeometry(DOME_R, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.amber); g.add(dome); o.dome = dome;
        o.shell = new T3.Group(); shards(T3, o.shell, m.amberD, 8, DOME_R, 2.6, 0, 0); g.add(o.shell);
        for (i = 0; i < 6; i++) { var sa = i * 1.05; box(T3, g, m.stone, 0.5, 0.5, 0.5, Math.cos(sa) * 6, 0.25, Math.sin(sa) * 6); }   // 석등 고리(6m) 자리 표석
        break;
      }
      case 'tower': {
        o.tower = new T3.Group(); g.add(o.tower);
        box(T3, o.tower, m.alloy, TOWER_HALF * 2, TOWER_H, TOWER_HALF * 2, 0, TOWER_H / 2, 0);           // 심 기둥 6×12m
        for (i = 0; i < 4; i++) { var ta = i * Math.PI / 2; cyl(T3, g, m.rust, 0.14, 0.14, TOWER_H + 6, Math.cos(ta) * 5, (TOWER_H + 6) / 2, Math.sin(ta) * 5, 6); }
        box(T3, g, m.rust, 14, 0.4, 14, 0, 6, 0); box(T3, g, m.rust, 10, 0.4, 10, 0, 15, 0);            // 공중 층판 둘
        box(T3, g, m.rust, 16, 0.5, 0.5, 6, 18, 0); box(T3, g, m.dark, 0.6, 3, 0.6, 14, 16.5, 0);        // 크레인 팔
        ball(T3, o.tower, m.panel, 1.2, 0, TOWER_H + 1.6, 0);                                             // 태엽 심장(윗면)
        var wing = new T3.Mesh(new T3.TorusGeometry(2, 0.12, 4, 24), m.bronze); wing.rotation.x = Math.PI / 2; wing.position.y = TOWER_H + 1.6; g.add(wing);
        o.shell = new T3.Group(); shards(T3, o.shell, m.amber, 10, 4, 5, 0, 0); g.add(o.shell);
        break;
      }
      case 'rail': {
        box(T3, g, m.stone, 160, 0.8, 4, 0, 6, 0);                                                        // 고가 선로
        for (i = -3; i <= 3; i++) { box(T3, g, m.stone, 1.6, 6, 1.6, i * 22, 3, 0); }
        for (i = 0; i < 3; i++) { box(T3, g, m.train, 9, 3, 3, -20 + i * 10, 7.8, 0); box(T3, g, m.alloy, 8, 0.6, 3.1, -20 + i * 10, 8.4, 0); }   // 멈춘 전철 셋
        shards(T3, g, m.amberS, 6, 12, 3, -10, 0);
        break;
      }
      case 'statue': {
        box(T3, g, m.stone, 3.2, 1.2, 3.2, 0, 0.6, 0); cyl(T3, g, m.stone, 0.5, 0.7, 2.6, 0, 2.5, 0, 8); ball(T3, g, m.stone, 0.55, 0, 4.2, 0);
        box(T3, g, m.stone, 2.4, 0.3, 0.4, 0, 3.3, 0);
        var ring = new T3.Mesh(new T3.TorusGeometry(2.4, 0.08, 4, 32), m.amberS); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; g.add(ring);
        break;
      }
      case 'lamp': cyl(T3, g, m.dark, 0.08, 0.1, 3.4, 0, 1.7, 0, 6); ball(T3, g, m.amber, 0.5, 0, 3.6, 0); break;
      case 'bench': box(T3, g, m.wood, 2, 0.15, 0.6, 0, 0.5, 0); box(T3, g, m.wood, 2, 0.6, 0.12, 0, 0.9, -0.3); ball(T3, g, m.amber, 0.8, 0, 0.7, 0).scale.y = 0.7; break;
      case 'vend': box(T3, g, m.alloy, 0.9, 1.9, 0.8, 0, 0.95, 0); box(T3, g, m.panel, 0.7, 0.9, 0.05, 0, 1.2, 0.42); break;
      case 'mailbox': box(T3, g, m.red, 0.6, 1.1, 0.5, 0, 0.55, 0); shards(T3, g, m.amber, 3, 0.5, 1.2, 0, 0); break;
      case 'cart': box(T3, g, m.wood, 1.6, 0.3, 1, 0, 0.6, 0); cyl(T3, g, m.wood, 0.4, 0.4, 0.1, 0.9, 0.4, 0.5, 10).rotation.x = Math.PI / 2; ball(T3, g, m.amberS, 1, 0, 0.9, 0); break;
      case 'jar': cyl(T3, g, m.rust, 0.5, 0.35, 1.1, 0, 0.55, 0, 10); ball(T3, g, m.amber, 0.9, 0, 0.6, 0); break;
      case 'kite': box(T3, g, m.line, 1.2, 0.05, 1.2, 0, 3, 0, 0.7); ball(T3, g, m.amberS, 1.3, 0, 3, 0); break;
      case 'drone': ball(T3, g, m.dark, 0.5, 0, 0.6, 0); box(T3, g, m.alloy, 1.6, 0.06, 0.2, 0, 0.9, 0); shards(T3, g, m.amberS, 3, 0.7, 1, 0, 0); break;
      case 'board': box(T3, g, m.dark, 2, 1.2, 0.1, 0, 1.6, 0); cyl(T3, g, m.dark, 0.06, 0.06, 1.2, 0, 0.6, 0, 6); break;
      case 'panel': box(T3, g, m.panel, 2.4, 0.1, 1.4, 0, 1.2, 0, 0.3).rotation.x = -0.5; cyl(T3, g, m.alloy, 0.06, 0.06, 1.2, 0, 0.6, 0, 6); break;
    }
    g.position.set(st.x, gyAt(w, st.x, st.y), st.y);
    return o;
  }
  function dropAll(w) { for (var k in fx) { if (fx.hasOwnProperty(k)) { if (w) { w.removeFx(fx[k].root); } } } fx = {}; }
  function paint(dt) {
    clock += dt || 0;
    var w = W3(), c = center(), p = core().save.player.pos;
    if (!w || !on() || !c || Math.hypot(c.x - p.x, c.y - p.y) > 1400) { dropAll(w); return; }
    var T3 = w.three();
    if (!T3) { return; }
    sites().forEach(function (st) {
      if (Math.hypot(st.x - p.x, st.y - p.y) > (st.big ? 700 : 260)) { if (fx[st.id]) { w.removeFx(fx[st.id].root); delete fx[st.id]; } return; }
      var o = fx[st.id];
      if (!o) { o = fx[st.id] = build(w, T3, st); w.addFx(o.root); }
      /* 이야기 상태 — 결정 막·굳은 자리·돔·탑·신호등 */
      if (o.pass) { o.pass.visible = !passOpen(); }
      if (o.crystals.length) { o.crystals.forEach(function (cg, i) { cg.visible = !crystalOff(i); }); }
      if (o.lights.length) { var gr = lightsGreen(); o.lights.forEach(function (l, i) { l.material = gr ? mats.green : (crystalOff(2) ? (i % 2 ? mats.red : mats.off) : mats.red); }); }
      if (o.dome) { o.dome.visible = !domeBroken(); o.shell.visible = !domeBroken(); }
      if (o.hands) { o.hands.rotation.z = clockWinding() ? -clock * 4 : -0.6; }
      if (st.model === 'tower' && o.shell) { o.shell.visible = !towerMelted(); }
    });
  }
  var accT = 0;
  function tick(dt) {
    if (!core() || !core().save) { return; }
    accT += dt || 0;
    if (accT >= 0.25) {
      accT = 0;
      if (on()) { var p = core().save.player.pos; if (inRegion(p.x, p.y)) { discoverAt(p.x, p.y); } }
    }
    if (!global.DG_NO_DRAW) { paint(dt); } else { fx = {}; }
  }

  global.DG = global.DG || {};
  global.DG.amber = {
    REGION: REGION, LANDMARKS: LANDMARKS, SMALL: SMALL, CRYSTALS: CRYSTALS, LIGHTS: LIGHTS, AMBER_OFF: AMBER_OFF, PASS_CH: PASS_CH,
    CRYSTAL_OFF_FROM: CRYSTAL_OFF_FROM, DOME_FROM: DOME_FROM, TOWER_FROM: TOWER_FROM, LANDMARK_R: LANDMARK_R, TOWER_H: TOWER_H, TOWER_HALF: TOWER_HALF, DOME_R: DOME_R,
    on: on, center: center, sites: sites, siteById: siteById, spot: spot, poles: poles, rectsIn: rectsIn, inRegion: inRegion,
    passOpen: passOpen, crystalOff: crystalOff, domeBroken: domeBroken, towerMelted: towerMelted, lightsGreen: lightsGreen, clockWinding: clockWinding, CLOCK_WIND_STEP: CLOCK_WIND_STEP, LIGHTS_GREEN_STEP: LIGHTS_GREEN_STEP,
    found: found, discoverAt: discoverAt, waypoints: waypoints, teleport: teleport, marks: marks, tick: tick,
    _resetForTest: function () { memo = null; centerMemo = undefined; rectMemo = null; poleMemo = null; fx = {}; accT = 0; }
  };
})(window);
