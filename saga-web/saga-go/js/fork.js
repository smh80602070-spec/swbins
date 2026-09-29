/**
 * 세갈래 고을 — 열째 지역, 이야기 11부 무대 (PLAN §5 ⑲-65, saga-godot PLAN 106 55-1 `world/region10_fork.gd`)
 * ---------------------------------------------------------------
 *   땅      서리봉 고원(frost.js) 가운데에서 북쪽 FORK_OFF m — 가장 가까운 뭍 칸. 틈이 처음 찢어진 순간째 갈무리가 "가장 깊은 진열장"에 붙잡아 둔 옛 고을
 *   명소    일곱 — 고을 성문(문루 둘·짧은 성벽)·세갈래 길목(이정표·머리 위 하늘 틈·멈춘 별까마귀)·대장간(멈춘 화덕 불)·선로 공사장(천막·측량 말뚝)·
 *           멈춘 증기 기관차(선로)·종루(10m 벽 타기)·고을 신상(순간이동) + 격자 말뚝 셋(두 곳은 땅, 하나는 종루 위 — 발견 아님, 이야기 자리)
 *           + 공중에 멈춘 호박 알갱이 48. 30m 안 = 발견
 *   발견    작은 발견 열 — 14m(GPS 30m) 안. 일곱 + 열 = 열일곱
 *   이동    고을 어귀·길목·신상 — 찾으면 지도(M) 순간이동 지점(키보드 판만, 열쇠 `fk:<id>`)
 *   장막    남쪽 고개(고원 쪽)에 호박 장막(벽) — 순간이 풀릴 때(11부 38장 4단계)까지 서 있다(`gateOpen`/`momentFree`). 그동안은 36장 금고 가장 깊은 진열장으로만 들어온다
 *   이야기 상태 격자 말뚝 셋은 37장 2·5·7단계부터 꺼지고(`latticeOff(k)`), 멈춘 별까마귀는 38장 1단계부터 사라지고(`crowFrozen`),
 *           하늘 틈·알갱이·고개 장막은 38장 4단계부터 걷힌다(`momentFree`) — 그 장들은 다음 순서
 *   벽      장막·문루·성벽·대장간·기관차·종루·격자 말뚝 밑동·신상은 world3d `houseRects` 로 막는다 · 종루는 landform 기둥 타기(`poles`)
 * 자리 잡기는 vault.js 와 같은 규칙 — 가운데에서 off 만큼 간 곳에서 가장 가까운 뭍 칸(물·마을·길·산·강 아님), 서로 떨어짐.
 * 판정 층(`center`·`sites`·`rectsIn`·`momentFree`…)은 순수. 세이브 `save.fork = { found }`. 그림은 코드 도형(SAGA-DESIGN §7).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('fork.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function FR() { var f = global.DG.frost; return f && f.on && f.on() && f.center ? f : null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var REGION = '세갈래 고을', FORK_OFF = [0, -1400];       // 서리봉 고원 가운데에서(m, +y 남쪽) 북쪽 고개 너머
  /* off = 가운데에서(m) — Godot 9×9 칸(48m)의 (칸 − 4) × 48. way = 순간이동 지점 이름 · wayDy = 그 지점이 자리에서 남쪽으로 얼마 떨어졌나 */
  var LANDMARKS = [
    { id: 'gate',     name: '세갈래 고을 성문',   era: '과거', off: [0, 110],    model: 'gate',     way: '고을 어귀', wayDy: 30 },
    { id: 'junction', name: '세갈래 길목',        era: '과거', off: [0, -24],    model: 'junction', way: '세갈래 길목', wayDy: 12 },
    { id: 'forge',    name: '대장간',             era: '과거', off: [-77, 58],   model: 'forge' },
    { id: 'works',    name: '선로 공사장',        era: '현대', off: [120, 43],   model: 'works' },
    { id: 'loco',     name: '멈춘 증기 기관차',   era: '현대', off: [106, -48],  model: 'loco' },
    { id: 'tower',    name: '종루',               era: '과거', off: [0, -134],   model: 'tower' },
    { id: 'statue',   name: '고을 신상',          era: '과거', off: [-58, 10],   model: 'statue',   way: '고을 신상' }
  ];
  /** 발견이 아닌 이야기·벽 자리 — 격자 말뚝 둘(땅)·남쪽 고개 장막. 셋째 말뚝은 종루 윗면(자리는 종루) */
  var FIXTURES = [
    { id: 'lat0', name: '역참길 격자 말뚝', model: 'lattice', off: [-134, -24] },
    { id: 'lat1', name: '선로 격자 말뚝',   model: 'lattice', off: [154, -48] },
    { id: 'pass', name: '호박 장막',        model: 'pass',    off: [0, 216] }
  ];
  var SMALL = [
    { id: 'well',    name: '고을 우물',         era: '과거', off: [-43, 34],   model: 'well' },
    { id: 'laundry', name: '멈춘 빨래',         era: '과거', off: [-101, 115], model: 'laundry' },
    { id: 'kite',    name: '공중에 멈춘 방패연', era: '과거', off: [58, 91],    model: 'kite' },
    { id: 'tripod',  name: '측량 삼각대',       era: '현대', off: [72, -14],   model: 'tripod' },
    { id: 'rails',   name: '깔다 만 레일 더미', era: '현대', off: [154, -19],  model: 'rails' },
    { id: 'flag',    name: '측량 깃발',         era: '현대', off: [91, -91],   model: 'flag' },
    { id: 'dronedn', name: '떨어진 보관 드론',  era: '미래', off: [110, -120], model: 'dronedn' },
    { id: 'shard',   name: '부러진 격자 조각',  era: '미래', off: [-72, -91],  model: 'shard' },
    { id: 'rain',    name: '떨어지다 멈춘 빗방울', era: '틈', off: [-34, -72], model: 'rain' },
    { id: 'birds',   name: '날아오르다 멈춘 새 떼', era: '틈', off: [38, 62],  model: 'birds' }
  ];
  var TOWER_W = 5, TOWER_H = 10, LATTICE_H = 6, CROW_Y = 20, RIFT_Y = 42, SPECKS = 48, GATE_HALF = 24, ARRIVE_OFF = [0, 151];
  var GATE_TOWERS = [-4, 4], GATE_WALLS = [-11.5, 11.5], FORGE_SIZE = [6, 4, 5], LOCO_SIZE = [8, 3.6, 3];
  /* 이야기 단계(0부터 장 번호) — 37·38장 = 36·37 */
  var CH37 = 36, CH38 = 37, LATTICE_OFF_FROM = [2, 5, 7], CROW_WAKE_STEP = 1, MOMENT_FREE_STEP = 4;
  var LANDMARK_R = 30, SMALL_R = function (g) { return g ? 30 : 14; };
  var REWARD_BIG = { gold: 220, dust: 2, exp: 62 }, REWARD_SMALL = { gold: 84, exp: 28 };
  var SEARCH_STEP = 8, SEARCH_R = 400, SEP_BIG = 60, SEP_SMALL = 30;
  var GRID = 48;

  /* ── 자리(순수 — 지형·해시만) ───────────────────────────── */
  var memo = null, allMemo = null, centerMemo;
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
  function nearLand(tx, ty, taken, sep, r) {
    for (var rr = 0; rr <= SEARCH_R; rr += SEARCH_STEP) {
      var n = rr ? Math.max(8, Math.round(2 * Math.PI * rr / SEARCH_STEP)) : 1;
      for (var k = 0; k < n; k++) {
        var a = 2 * Math.PI * k / n, x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr, clash = false;
        for (var t = 0; t < taken.length; t++) { if (Math.hypot(taken[t].x - x, taken[t].y - y) < sep + (taken[t].big ? SEP_BIG - sep : 0)) { clash = true; break; } }
        if (clash || !okSpot(x, y, r)) { continue; }
        return { x: x, y: y };
      }
    }
    return { x: tx, y: ty, forced: true };
  }
  /** 고을 가운데 — 서리봉 고원 가운데에서 북쪽 고개 너머 가장 가까운 뭍 { x, y } 또는 null(고원이 없으면) */
  function center() {
    if (centerMemo !== undefined) { return centerMemo; }
    var f = FR(), c = f ? f.center() : null;
    if (!c) { return null; }
    var p = nearLand(c.x + FORK_OFF[0], c.y + FORK_OFF[1], [], 0, 30);
    centerMemo = { x: p.x, y: p.y };
    return centerMemo;
  }
  /** 명소 일곱 + 이야기 자리(격자 말뚝 둘·장막) + 작은 발견 열 — 순서 고정. 세계가 같으면 늘 같다 */
  function allSites() {
    if (allMemo) { return allMemo; }
    var c = center(), out = [];
    if (!c) { allMemo = []; return allMemo; }
    LANDMARKS.forEach(function (d) {
      var p = nearLand(c.x + d.off[0], c.y + d.off[1], out, SEP_BIG, 8);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: true, x: p.x, y: p.y, way: d.way || null, wayDy: d.wayDy || 8, forced: !!p.forced });
    });
    FIXTURES.forEach(function (d) {
      var p = d.id === 'pass' ? { x: c.x + d.off[0], y: c.y + d.off[1] } : nearLand(c.x + d.off[0], c.y + d.off[1], out, SEP_BIG, 4);
      out.push({ id: d.id, name: d.name, model: d.model, big: true, fix: true, x: p.x, y: p.y, forced: !!p.forced });
    });
    SMALL.forEach(function (d) {
      var p = nearLand(c.x + d.off[0], c.y + d.off[1], out, SEP_SMALL, 0);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: false, x: p.x, y: p.y, forced: !!p.forced });
    });
    allMemo = out;
    return out;
  }
  /** 발견할 수 있는 곳 — 명소 일곱 + 작은 발견 열 = 열일곱 */
  function sites() { if (!memo) { memo = allSites().filter(function (s) { return !s.fix; }); } return memo; }
  function siteById(id) { var L = allSites(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** 이야기 자리 — 명소·이야기 자리 id 가운데('lat2' = 종루 윗면 = 종루 자리) 또는 'arrive'(36장 진열장에서 들어와 서는 성문 남쪽) — 없으면 null */
  function spot(part) {
    if (part === 'arrive') { var c = center(); return c ? { x: c.x + ARRIVE_OFF[0], y: c.y + ARRIVE_OFF[1] } : null; }
    if (part === 'lat2') { part = 'tower'; }
    var s = siteById(part);
    return s ? { x: s.x, y: s.y } : null;
  }
  function storyAt() { var s = core() && core().save ? core().save.story : null; return s || { ch: 0, step: 0 }; }
  function reached(ch, step) { var s = storyAt(); return s.ch > ch || (s.ch === ch && (s.step || 0) >= step); }
  /** 순간이 풀렸나 — 38장 갈무리 참몸을 쓰러뜨린 뒤. 고개 장막·하늘 틈·알갱이가 걷힌다(손잡이 fork.gate 1 이면 장막은 늘 열림, 확인용) */
  function momentFree() { return reached(CH38, MOMENT_FREE_STEP); }
  function gateOpen() { return K('gate', 0) ? true : momentFree(); }
  function latticeOff(k) { return reached(CH37, LATTICE_OFF_FROM[k]); }
  function crowFrozen() { return !reached(CH38, CROW_WAKE_STEP); }
  function inRegion(x, y) { var c = center(); return on() && !!c && Math.hypot(x - c.x, y - c.y) <= 620; }

  var poleMemo = null;
  /** landform 기둥 타기 — 종루 하나(5×5m·10m). 꼭대기는 네모 — 셋째 격자 말뚝이 그 위에 선다 */
  function poles() {
    if (!on()) { return []; }
    if (poleMemo) { return poleMemo; }
    var p = siteById('tower');
    if (!p) { return []; }
    poleMemo = [{ id: 'fk_tower', x: p.x, y: p.y, r: TOWER_W / 2, top: TOWER_H, drain: 0.7, perch: { x: p.x, y: p.y },
      beam: { ax: p.x - 1.8, ay: p.y, bx: p.x + 1.8, by: p.y, w: 4.4 },   // 5m 네모 꼭대기 — 가장자리 0.3m 안쪽
      grab: '🧗 종루 벽을 붙잡았다 — 계속 밀면 오른다 · 점프 = 도약 · 등지면 손을 놓는다',
      perchText: '🔔 종루 꼭대기 — 고을과 하늘 틈이 한눈에 보인다 · 뛰면 날개를 편다', edgeText: '🔔 종루 끝 — 뛰어내리면(점프) 날개를 편다' }];
    return poleMemo;
  }

  /* ── 벽(월드 좌표 사각형 — world3d houseRects 가 격자 칸마다 가져간다) ─ */
  var rectMemo = null;
  /** 명소 하나의 벽 사각형들 — 장막(gate)은 rectsIn 이 그때그때 거른다. rot 은 houseRects 규약(지역 x 축 = (cos rot, sin rot)) */
  function rectsOf(st) {
    var x = st.x, y = st.y, out = [];
    switch (st.model) {
      case 'pass': return [{ x: x, z: y, w: GATE_HALF * 2, d: 1.4, rot: 0, gate: true }];
      case 'gate':
        GATE_TOWERS.forEach(function (dx) { out.push({ x: x + dx, z: y, w: 3, d: 3, rot: 0 }); });
        GATE_WALLS.forEach(function (dx) { out.push({ x: x + dx, z: y, w: 12, d: 1.4, rot: 0 }); });      // 가운데 5m 는 열려 있다
        return out;
      case 'forge': return [{ x: x, z: y, w: FORGE_SIZE[0], d: FORGE_SIZE[2], rot: 0 }];
      case 'loco': return [{ x: x, z: y, w: LOCO_SIZE[0], d: LOCO_SIZE[2], rot: 0 }];
      case 'tower': return [{ x: x, z: y, w: TOWER_W, d: TOWER_W, rot: 0 }];
      case 'lattice': return [{ x: x, z: y, w: 1.4, d: 1.4, rot: 0 }];
      case 'statue': return [{ x: x, z: y, w: 3.2, d: 3.2, rot: 0 }];
    }
    return [];
  }
  function rectsIn(gx, gy) {
    if (!on()) { return []; }
    if (!rectMemo) {
      rectMemo = {};
      allSites().forEach(function (st) {
        rectsOf(st).forEach(function (r) {
          var k = Math.floor(r.x / GRID) + ',' + Math.floor(r.z / GRID);
          (rectMemo[k] || (rectMemo[k] = [])).push(r);
        });
      });
    }
    return (rectMemo[gx + ',' + gy] || []).filter(function (r) { return r.gate ? !gateOpen() : true; });
  }

  /* ── 세이브·발견 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.fork || typeof s.fork !== 'object') { s.fork = {}; }
    if (!s.fork.found || typeof s.fork.found !== 'object') { s.fork.found = {}; }
    return s.fork;
  }
  function found(id) { var f = core().save.fork; return !!(f && f.found && f.found[id]); }
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
      toast((st.big ? '🟪 명소 발견 — ' : '✨ 작은 발견 — ') + st.name + ' (' + st.era + ') · 금 +' + r.gold + (st.way ? ' · 순간이동 지점' : ''));
      c.log('🟪 ' + REGION + ' — ' + st.name + ' 발견', 'discover');
      c.emit('fork:found', { id: st.id, big: st.big });
    });
    if (out.length) { sfx('discover'); core().persist(); }
    return out;
  }
  /** 순간이동 지점 — 찾은 고을 어귀·세갈래 길목·고을 신상 [{ key, x, y, name }] */
  function waypoints() {
    if (!on()) { return []; }
    return sites().filter(function (st) { return st.way && found(st.id); }).map(function (st) {
      return { key: 'fk:' + st.id, x: st.x, y: st.y + st.wayDy, name: '🟪 ' + st.way };
    });
  }
  /** 순간이동 — 키보드 판만 · 찾은 곳만 */
  function teleport(id) {
    var W = global.DG.world, st = siteById(id);
    if (!on() || !W || W.mode !== 'keyboard' || !st || !st.way || !found(id)) { return false; }
    var pos = core().save.player.pos;
    pos.x = st.x; pos.y = st.y + st.wayDy;
    if (W.walkTo) { W.walkTo(pos.x, pos.y); }
    core().log('🌀 순간이동 — ' + st.way, 'move');
    core().emit('region:teleport', { key: 'fk:' + id });
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
  var fx = {}, clock = 0, mats = null, specks = null;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function gyAt(w, x, y) { return w.groundY ? w.groundY(x, y) : 0; }
  function M(T3) {
    if (mats) { return mats; }
    var tr = function (c, a) { return new T3.MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, side: T3.DoubleSide }); };
    var glow = function (c) { return new T3.MeshBasicMaterial({ color: c }); };
    mats = {
      veil: tr(0xffad38, 0.5), amberG: tr(0xffad38, 0.18), amberS: tr(0xffc860, 0.4), puff: tr(0xf2f2eb, 0.7), drop: tr(0xb3d9ff, 0.75),
      glow: glow(0x73d9ff), amber: glow(0xffad38), ember: glow(0xff7326), rift: glow(0xbf80ff), bolt: glow(0xffad38), red: glow(0xff382e), eye: glow(0x73d9ff),
      wood: new T3.MeshLambertMaterial({ color: 0x734d2e }), woodD: new T3.MeshLambertMaterial({ color: 0x4d3521 }), thatch: new T3.MeshLambertMaterial({ color: 0xb89957 }),
      tile: new T3.MeshLambertMaterial({ color: 0x474d57 }), stone: new T3.MeshLambertMaterial({ color: 0x8c857a }), stoneD: new T3.MeshLambertMaterial({ color: 0x4d5257 }),
      plaster: new T3.MeshLambertMaterial({ color: 0xdbd1b8 }), iron: new T3.MeshLambertMaterial({ color: 0x333338 }), ironL: new T3.MeshLambertMaterial({ color: 0x4d4d52 }),
      rail: new T3.MeshLambertMaterial({ color: 0x6b5c52 }), canvas: new T3.MeshLambertMaterial({ color: 0xd1bd8c }), alloy: new T3.MeshStandardMaterial({ color: 0xd6e0ee, metalness: 0.65, roughness: 0.35 }),
      redB: new T3.MeshLambertMaterial({ color: 0x992620 }), redW: new T3.MeshLambertMaterial({ color: 0xb3402e }), yellow: new T3.MeshLambertMaterial({ color: 0xd9b333 }),
      door: new T3.MeshLambertMaterial({ color: 0x1a120d }), tool: new T3.MeshLambertMaterial({ color: 0x596650 }), cloth0: new T3.MeshLambertMaterial({ color: 0xf2f2e6 }),
      cloth1: new T3.MeshLambertMaterial({ color: 0x8CA6CC }), cloth2: new T3.MeshLambertMaterial({ color: 0xd99a8c }), kite: new T3.MeshLambertMaterial({ color: 0xf2ebd9 }),
      string: new T3.MeshLambertMaterial({ color: 0xe6e6d9 }), flag: new T3.MeshLambertMaterial({ color: 0xf26626 }), pole: new T3.MeshLambertMaterial({ color: 0xe6e6e6 }),
      crow: new T3.MeshLambertMaterial({ color: 0x242138 }), crowW: new T3.MeshLambertMaterial({ color: 0x9e73ff }), crowB: new T3.MeshLambertMaterial({ color: 0xffd659 }),
      bird: new T3.MeshLambertMaterial({ color: 0x403830 }), lat: new T3.MeshLambertMaterial({ color: 0x4d525c })
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function cyl(T3, g, m, rt, rb, h, x, y, z, seg) { var o = new T3.Mesh(new T3.CylinderGeometry(rt, rb, h, seg || 12), m); o.position.set(x, y, z); g.add(o); return o; }
  function ball(T3, g, m, r, x, y, z) { var o = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; }
  /** 격자 말뚝 빛 틀 — 기둥 넷·가로대 셋·가운데 호박 심. 꺼지면 통째로 숨긴다 */
  function latticeFrame(T3, g, m, y0) {
    var fr = new T3.Group(); fr.position.y = y0 || 0; g.add(fr);
    for (var i = 0; i < 4; i++) { var a = i * Math.PI / 2 + Math.PI / 4; box(T3, fr, m.glow, 0.12, LATTICE_H, 0.12, Math.cos(a) * 0.6, LATTICE_H / 2 + 0.2, Math.sin(a) * 0.6); }
    [1.5, 3.5, 5.5].forEach(function (y) { box(T3, fr, m.glow, 1.3, 0.08, 1.3, 0, y, 0); });
    box(T3, fr, m.amber, 0.6, 0.6, 0.6, 0, LATTICE_H / 2, 0).rotation.set(0.6, 0.6, 0);
    return fr;
  }
  function build(w, T3, st) {
    var m = M(T3), g = new T3.Group(), o = { root: g, veil: null, frame: null, frame2: null, rift: null, crow: null, floaters: [] }, i, k;
    switch (st.model) {
      case 'pass': {
        o.veil = new T3.Group(); g.add(o.veil);
        var vp = new T3.Mesh(new T3.PlaneGeometry(GATE_HALF * 2, 14), m.veil); vp.position.y = 7; o.veil.add(vp);
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.alloy, 0.6, 14, 0.6, i * GATE_HALF, 7, 0); }
        break;
      }
      case 'gate': {
        GATE_TOWERS.forEach(function (dx) { box(T3, g, m.stone, 3, 6, 3, dx, 3, 0); box(T3, g, m.tile, 3.6, 0.5, 3.6, dx, 6.25, 0); });
        box(T3, g, m.wood, 11.5, 1, 3.2, 0, 6.6, 0); box(T3, g, m.tile, 12.5, 0.4, 4.2, 0, 7.4, 0).rotation.x = 0.05; box(T3, g, m.woodD, 4, 0.9, 0.2, 0, 5.6, 1.65);
        GATE_WALLS.forEach(function (dx) { box(T3, g, m.stone, 12, 4.5, 1.4, dx, 2.25, 0); });
        [-3.2, 3.2].forEach(function (dx) { box(T3, g, m.wood, 0.45, 2.6, 0.45, dx, 1.3, 3.2); box(T3, g, m.redW, 0.55, 0.6, 0.5, dx, 2.7, 3.2); });
        break;
      }
      case 'forge': {
        box(T3, g, m.plaster, FORGE_SIZE[0], FORGE_SIZE[1], FORGE_SIZE[2], 0, FORGE_SIZE[1] / 2, 0);
        box(T3, g, m.thatch, FORGE_SIZE[0] + 1, 0.4, FORGE_SIZE[2] + 1, 0, FORGE_SIZE[1] + 0.5, 0); box(T3, g, m.stone, 1, 3, 1, 2, FORGE_SIZE[1] + 1.5, -1.2);
        box(T3, g, m.door, 1.6, 2.2, 0.1, -1, 1.1, FORGE_SIZE[2] / 2 + 0.06);
        var hz = FORGE_SIZE[2] / 2 + 2.2;                                                            // 화덕 — 불꽃이 솟다 멈춘 모양
        box(T3, g, m.stone, 1.6, 1, 1.4, 1.8, 0.5, hz);
        for (k = 0; k < 3; k++) { box(T3, g, m.ember, 0.3 - k * 0.06, 0.8 + k * 0.3, 0.3 - k * 0.06, 1.8 - 0.3 + k * 0.3, 1.4 + k * 0.1, hz).rotation.z = 0.2 - k * 0.2; }
        box(T3, g, m.iron, 0.8, 0.7, 0.5, -1.4, 0.35, FORGE_SIZE[2] / 2 + 2.4); box(T3, g, m.iron, 1.2, 0.3, 0.4, -1.4, 0.85, FORGE_SIZE[2] / 2 + 2.4);
        break;
      }
      case 'junction': {
        box(T3, g, m.wood, 0.3, 3, 0.3, 0, 1.5, 0);
        for (k = 0; k < 3; k++) { var yaw = [Math.PI, 0, Math.PI / 2][k]; box(T3, g, m.wood, 1.6, 0.35, 0.08, -Math.cos(yaw) * 0.8, 2.4 - k * 0.4, Math.sin(yaw) * 0.8, yaw); }
        o.rift = new T3.Group(); o.rift.position.y = RIFT_Y; g.add(o.rift);                           // 하늘 틈 — 들쭉날쭉한 빛 금
        var pts = [[-14, 0, -2], [-8, 1.5, 1], [-3, -1, -1], [2, 1.2, 2], [7, -0.8, 0], [13, 1, -2]];
        for (i = 0; i < pts.length - 1; i++) {
          var a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[2] - a[2]);
          var seg = box(T3, o.rift, m.rift, len, 1.4 - Math.abs(i - 2.5) * 0.25, 0.3, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
          seg.rotation.y = -Math.atan2(b[2] - a[2], b[0] - a[0]); seg.rotation.z = Math.atan2(b[1] - a[1], len);
        }
        box(T3, o.rift, m.bolt, 0.25, RIFT_Y - CROW_Y - 3, 0.25, 0.4, -(RIFT_Y - CROW_Y) / 2 + 1.5, 0).rotation.z = 0.08;
        o.crow = new T3.Group(); o.crow.position.y = CROW_Y; o.crow.rotation.set(-0.5, 0.6, 0); g.add(o.crow);   // 멈춘 별까마귀 — 부리를 하늘 틈 쪽으로
        var cb = new T3.Mesh(new T3.SphereGeometry(1.3, 12, 8), m.crow); cb.scale.set(1, 0.8, 1.7); o.crow.add(cb);
        [-1, 1].forEach(function (s) { var wg = box(T3, o.crow, m.crowW, 3.6, 0.15, 1.4, s * 2.6, 0.4, -0.2); wg.rotation.z = s * 0.35; });
        cyl(T3, o.crow, m.crowB, 0.05, 0.3, 1.2, 0, 0.2, 2.2, 6).rotation.x = Math.PI / 2;
        box(T3, o.crow, m.crowW, 0.5, 0.15, 1.6, 0, 0.1, -2.2);
        var shell = new T3.Mesh(new T3.SphereGeometry(3.0, 14, 10), m.amberG); shell.position.y = 0.5; o.crow.add(shell);
        break;
      }
      case 'works': {
        for (k = 0; k < 2; k++) {
          var tent = new T3.Group(); tent.position.set(k * 7 - 3.5, 0, k * 1.5); g.add(tent);
          [-1, 1].forEach(function (s) { box(T3, tent, m.canvas, 4, 0.08, 2.4, 0, 1.1, s * 0.85).rotation.x = s * 0.9; });
          [-1.9, 1.9].forEach(function (dx) { box(T3, tent, m.wood, 0.08, 2, 0.08, dx, 1, 0); });
        }
        box(T3, g, m.tool, 2, 0.8, 1, 0.5, 0.4, 3);
        break;
      }
      case 'loco': {
        for (i = -17; i <= 17; i++) { box(T3, g, m.woodD, 0.4, 0.15, 2.6, i * 4, 0.08, 0); }         // 선로 — 침목 서른다섯·레일 둘
        [-0.75, 0.75].forEach(function (z) { box(T3, g, m.rail, 140, 0.14, 0.12, 0, 0.22, z); });
        box(T3, g, m.iron, LOCO_SIZE[0], LOCO_SIZE[1], LOCO_SIZE[2], 0, LOCO_SIZE[1] / 2 + 0.3, 0);
        box(T3, g, m.ironL, 2.6, 1.6, 3.1, -2.2, LOCO_SIZE[1] + 1.1, 0); box(T3, g, m.iron, 0.8, 1.6, 0.8, 2.6, LOCO_SIZE[1] + 1.1, 0); box(T3, g, m.redB, 8.1, 0.25, 3.1, 0, 0.9, 0);
        for (k = 0; k < 4; k++) { ball(T3, g, m.puff, 0.6 + k * 0.25, 2.6 - k * 0.9, LOCO_SIZE[1] + 2.4 + k * 0.9, 0); }   // 멈춘 김
        break;
      }
      case 'tower': {
        box(T3, g, m.stone, TOWER_W, TOWER_H, TOWER_W, 0, TOWER_H / 2, 0);
        [3, 6.5].forEach(function (y) { box(T3, g, m.wood, TOWER_W + 0.2, 0.3, TOWER_W + 0.2, 0, y, 0); });
        cyl(T3, g, m.stoneD, 0.5, 0.9, 1.5, 0, TOWER_H - 2.5, TOWER_W / 2 + 0.8, 10).rotation.x = 0.35;   // 울리다 멈춘 종
        box(T3, g, m.wood, 0.2, 0.2, 1.4, 0, TOWER_H - 1.6, TOWER_W / 2 + 0.5);
        o.frame2 = latticeFrame(T3, g, m, TOWER_H);                                                    // 셋째 격자 말뚝 — 종루 윗면
        break;
      }
      case 'lattice': {
        box(T3, g, m.lat, 1.4, 0.8, 1.4, 0, 0.4, 0);
        o.frame = latticeFrame(T3, g, m, 0);
        break;
      }
      case 'statue': {
        box(T3, g, m.stone, 3.2, 1.2, 3.2, 0, 0.6, 0); cyl(T3, g, m.stone, 0.5, 0.7, 2.6, 0, 2.5, 0, 8); ball(T3, g, m.stone, 0.55, 0, 4.2, 0); box(T3, g, m.stone, 2.4, 0.3, 0.4, 0, 3.3, 0);
        var sr = new T3.Mesh(new T3.TorusGeometry(2.4, 0.08, 4, 32), m.amberS); sr.rotation.x = Math.PI / 2; sr.position.y = 0.1; g.add(sr);
        break;
      }
      case 'well': {
        cyl(T3, g, m.stone, 1, 1.1, 0.9, 0, 0.45, 0, 14);
        [-0.9, 0.9].forEach(function (dx) { box(T3, g, m.wood, 0.15, 2.2, 0.15, dx, 1.1, 0); });
        box(T3, g, m.wood, 2, 0.15, 0.15, 0, 2.2, 0); box(T3, g, m.string, 0.04, 1, 0.04, 0, 1.7, 0); box(T3, g, m.woodD, 0.4, 0.35, 0.4, 0, 1.15, 0);
        break;
      }
      case 'laundry': {
        [-2, 2].forEach(function (dx) { box(T3, g, m.wood, 0.12, 2.2, 0.12, dx, 1.1, 0); });
        box(T3, g, m.string, 4, 0.03, 0.03, 0, 2.1, 0);
        for (k = 0; k < 3; k++) { box(T3, g, m['cloth' + k], 0.8, 0.9, 0.04, -1.2 + k * 1.2, 1.6, 0.25).rotation.x = -0.9; }
        break;
      }
      case 'kite': {
        var kg = new T3.Group(); kg.position.y = 9; kg.rotation.set(0.2, 0.4, 0.3); g.add(kg);
        box(T3, kg, m.kite, 1.2, 1.5, 0.04, 0, 0, 0); cyl(T3, kg, m.redB, 0.25, 0.25, 0.05, 0, 0, 0.03, 10).rotation.x = Math.PI / 2;
        box(T3, g, m.string, 0.02, 9, 0.02, 0.6, 4.5, 0);
        o.floaters.push({ node: kg, y: 9, ph: 0.3 });
        break;
      }
      case 'tripod': {
        for (k = 0; k < 3; k++) { var ta = k * Math.PI * 2 / 3, lg = box(T3, g, m.yellow, 0.06, 1.6, 0.06, Math.cos(ta) * 0.35, 0.75, Math.sin(ta) * 0.35); lg.rotation.set(Math.sin(ta) * 0.25, 0, -Math.cos(ta) * 0.25); }
        box(T3, g, m.iron, 0.4, 0.25, 0.25, 0, 1.65, 0);
        break;
      }
      case 'rails': {
        for (k = 0; k < 4; k++) { box(T3, g, m.rail, 5, 0.14, 0.14, 0, 0.1 + k * 0.15, k * 0.2 - 0.3); }
        for (k = 0; k < 3; k++) { box(T3, g, m.woodD, 0.3, 0.2, 2.4, -1.6 + k * 1.6, 0.1, 1.8); }
        break;
      }
      case 'flag': {
        box(T3, g, m.pole, 0.06, 2.4, 0.06, 0, 1.2, 0);
        var fl = box(T3, g, m.flag, 0.8, 0.5, 0.03, 0.43, 2.1, 0); fl.rotation.y = 0.3;
        o.floaters.push({ node: fl, y: 2.1, ph: 1.4 });
        break;
      }
      case 'dronedn': {
        var dg = new T3.Group(); dg.rotation.set(0.4, 0.3, 0.6); dg.position.y = 0.4; g.add(dg);
        box(T3, dg, m.alloy, 0.9, 0.3, 0.9, 0, 0, 0); for (i = 0; i < 3; i++) { box(T3, dg, m.iron, 0.6, 0.05, 0.14, Math.cos(i * 2) * 0.7, 0.2, Math.sin(i * 2) * 0.7); }
        box(T3, dg, m.eye, 0.3, 0.1, 0.1, 0, 0, 0.46);
        break;
      }
      case 'shard': {
        for (k = 0; k < 3; k++) { box(T3, g, m.glow, 0.12, 2.2 - k * 0.5, 0.12, k * 0.5 - 0.5, 0.4, (k % 2) * 0.4).rotation.set(1.2, k * 0.7, 0.2); }
        box(T3, g, m.amber, 0.35, 0.35, 0.35, 0.2, 0.25, 0.3);
        break;
      }
      case 'rain': {
        for (k = 0; k < 24; k++) { var rr = 0.5 + (k * 0.37) % 2.5; box(T3, g, m.drop, 0.05, 0.22, 0.05, Math.cos(k * 2.4) * rr, 1 + (k * 0.61) % 5, Math.sin(k * 2.4) * rr); }
        break;
      }
      case 'birds': {
        for (k = 0; k < 5; k++) {
          var bg = new T3.Group(); bg.position.set(Math.cos(k * 1.3) * 2, 3 + k * 0.7, Math.sin(k * 1.3) * 2); bg.rotation.y = k * 0.9; g.add(bg);
          box(T3, bg, m.bird, 0.25, 0.15, 0.4, 0, 0, 0);
          [-1, 1].forEach(function (s) { box(T3, bg, m.bird, 0.5, 0.04, 0.25, s * 0.35, 0.05, 0).rotation.z = s * 0.5; });
        }
        break;
      }
    }
    g.position.set(st.x, gyAt(w, st.x, st.y), st.y);
    return o;
  }
  /** 공중에 멈춘 호박 알갱이 마흔여덟 — 고을 안쪽 칸에 고르게(보기만). 순간이 풀리면 사라진다 */
  function buildSpecks(w, T3) {
    var m = M(T3), root = new T3.Group(), c = center(), i;
    for (i = 0; i < SPECKS; i++) {
      var cx = 1.2 + (i * 2.618) % 5.6, cy = 1.4 + (i * 1.733) % 5.4, x = c.x + (cx - 4) * GRID, z = c.y + (cy - 4) * GRID;
      var s = box(T3, root, m.amber, 0.18, 0.18, 0.18, x, gyAt(w, x, z) + 2 + (i * 3.7) % 12, z); s.rotation.set(i * 0.7, i * 1.3, 0);
    }
    return { root: root };
  }
  function dropAll(w) {
    for (var k in fx) { if (fx.hasOwnProperty(k)) { if (w) { w.removeFx(fx[k].root); } } }
    fx = {};
    if (specks) { if (w) { w.removeFx(specks.root); } specks = null; }
  }
  function paint(dt) {
    clock += dt || 0;
    var w = W3(), c = center(), p = core().save.player.pos;
    if (!w || !on() || !c || Math.hypot(c.x - p.x, c.y - p.y) > 1400) { dropAll(w); return; }
    var T3 = w.three();
    if (!T3) { return; }
    var free = momentFree();
    allSites().forEach(function (st) {
      if (Math.hypot(st.x - p.x, st.y - p.y) > (st.big ? 700 : 260)) { if (fx[st.id]) { w.removeFx(fx[st.id].root); delete fx[st.id]; } return; }
      var o = fx[st.id];
      if (!o) { o = fx[st.id] = build(w, T3, st); w.addFx(o.root); }
      /* 이야기 상태 — 장막·격자 말뚝·별까마귀·하늘 틈. 순간이 멈춰 있는 동안엔 아무것도 흔들리지 않고, 풀린 뒤에만 연·깃발이 논다 */
      if (o.veil) { o.veil.visible = !gateOpen(); }
      if (o.frame) { o.frame.visible = !latticeOff(st.id === 'lat1' ? 1 : 0); }
      if (o.frame2) { o.frame2.visible = !latticeOff(2); }
      if (o.rift) { o.rift.visible = !free; }
      if (o.crow) { o.crow.visible = crowFrozen(); }
      if (free && o.floaters.length) { o.floaters.forEach(function (f) { f.node.position.y = f.y + Math.sin(clock * 1.1 + f.ph) * 0.15; }); }
    });
    if (Math.hypot(c.x - p.x, c.y - p.y) < 700 && !free) {
      if (!specks) { specks = buildSpecks(w, T3); w.addFx(specks.root); }
    } else if (specks) { w.removeFx(specks.root); specks = null; }
  }
  var accT = 0;
  function tick(dt) {
    if (!core() || !core().save) { return; }
    accT += dt || 0;
    if (accT >= 0.25) {
      accT = 0;
      if (on()) { var p = core().save.player.pos; if (inRegion(p.x, p.y)) { discoverAt(p.x, p.y); } }
    }
    if (!global.DG_NO_DRAW) { paint(dt); } else { fx = {}; specks = null; }
  }

  global.DG = global.DG || {};
  global.DG.fork = {
    REGION: REGION, LANDMARKS: LANDMARKS, FIXTURES: FIXTURES, SMALL: SMALL, FORK_OFF: FORK_OFF, LANDMARK_R: LANDMARK_R, GATE_HALF: GATE_HALF, TOWER_H: TOWER_H, TOWER_W: TOWER_W, LATTICE_H: LATTICE_H,
    CROW_Y: CROW_Y, RIFT_Y: RIFT_Y, SPECKS: SPECKS, ARRIVE_OFF: ARRIVE_OFF, LATTICE_OFF_FROM: LATTICE_OFF_FROM, CROW_WAKE_STEP: CROW_WAKE_STEP, MOMENT_FREE_STEP: MOMENT_FREE_STEP,
    on: on, center: center, sites: sites, allSites: allSites, siteById: siteById, spot: spot, poles: poles, rectsIn: rectsIn, inRegion: inRegion,
    momentFree: momentFree, gateOpen: gateOpen, latticeOff: latticeOff, crowFrozen: crowFrozen,
    found: found, discoverAt: discoverAt, waypoints: waypoints, teleport: teleport, marks: marks, tick: tick,
    _resetForTest: function () { memo = null; allMemo = null; centerMemo = undefined; rectMemo = null; poleMemo = null; fx = {}; specks = null; accT = 0; }
  };
})(window);
