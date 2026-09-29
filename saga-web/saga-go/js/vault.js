/**
 * 갈무리 벌 — 아홉째 지역, 이야기 10부 무대 (PLAN §5 ⑲-61, saga-godot PLAN 106 54-1 `world/region9_vault.gd`)
 * ---------------------------------------------------------------
 *   땅      서리봉 고원(frost.js) 가운데에서 동쪽 VAULT_OFF m — 가장 가까운 뭍 칸. 세 시대가 저마다 쌓아 두던 벌판이 한데 붙은 곳
 *   명소    일곱 — 고개 어귀(빛 울타리·장승)·시간 씨앗 금고(둥근 벽·남쪽 문·진열장 여섯·기록 기둥·갈무리의 핵)·동력 기둥 둘·
 *           곳간 마을(다락 곳간)·물류 야적장(창고·컨테이너·갠트리 크레인)·벌 신상(순간이동) + 운반 드론 셋(보기만). 30m 안 = 발견
 *   발견    작은 발견 열 — 14m(GPS 30m) 안. 일곱 + 열 = 열일곱
 *   이동    고개 어귀·금고 앞·벌 신상 — 찾으면 지도(M) 순간이동 지점(키보드 판만, 열쇠 `vt:<id>`)
 *   울타리  고개 어귀에 빛 울타리(벽) — 9부(32장)를 마치면 꺼진다(`gateOpen`). 열린 땅이라 땅 전체를 막진 않는다 — 10부로 드는 자리 표지
 *   이야기 자리 곳간 문은 34장 2단계부터 열리고(`granaryOpen`), 동력 기둥 둘은 34장 5·6단계부터 꺼지고(`pylonOff`), 금고 문은 34장 6단계부터 열리고
 *           (`doorOpen`), 갈무리의 핵은 35장 5단계부터 꺼지고(`coreDim`), 해미 진열장은 35장 6단계부터 깨진다(`haemiFree`) — 그 장들은 다음 순서.
 *           가장 깊은 진열장은 10부를 마치면(35장 뒤) 드러나고(`deepShown`), 11부 38장 4단계부터 유리가 깨진다(`momentFree`)
 *   벽      울타리·금고 둥근 벽(남쪽 문은 상태를 따름)·기록 기둥·동력 기둥·곳간·창고·컨테이너·신상은 world3d `houseRects` 로 막는다 ·
 *           기록 기둥은 landform 기둥 타기(`poles`) — 금고 안이라 문이 열려야 닿는다
 * 자리 잡기는 amber.js 와 같은 규칙 — 가운데에서 off 만큼 간 곳에서 가장 가까운 뭍 칸(물·마을·길·산·강 아님), 서로 떨어짐.
 * 판정 층(`center`·`sites`·`rectsIn`·`gateOpen`…)은 순수. 세이브 `save.vault = { found }`. 그림은 코드 도형(SAGA-DESIGN §7).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('vault.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function FR() { var f = global.DG.frost; return f && f.on && f.on() && f.center ? f : null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var REGION = '갈무리 벌', VAULT_OFF = [1400, 0];       // 서리봉 고원 가운데에서(m, +y 남쪽) 동쪽 절벽 너머
  /* off = 가운데에서(m) — Godot 9×9 칸(48m)의 (칸 − 4) × 48. way = 순간이동 지점 이름 · wayDy = 그 지점이 자리에서 남쪽으로 얼마 떨어졌나(금고는 문 밖) */
  var LANDMARKS = [
    { id: 'pass',    name: '갈무리 벌 어귀',     era: '과거', off: [-168, -48], model: 'pass',    way: '벌 어귀' },
    { id: 'vault',   name: '시간 씨앗 금고',     era: '미래', off: [0, -120],   model: 'vault',   way: '금고 앞', wayDy: 22 },
    { id: 'pylon0',  name: '서쪽 동력 기둥',     era: '미래', off: [-38, -67],  model: 'pylon' },
    { id: 'pylon1',  name: '동쪽 동력 기둥',     era: '미래', off: [38, -67],   model: 'pylon' },
    { id: 'granary', name: '곳간 마을',          era: '과거', off: [-125, 67],  model: 'granary' },
    { id: 'yard',    name: '갈무리 물류 야적장', era: '현대', off: [110, 38],   model: 'yard' },
    { id: 'statue',  name: '벌 신상',            era: '과거', off: [-67, 10],   model: 'statue',  way: '벌 신상' }
  ];
  var SMALL = [
    { id: 'haystack',  name: '볏가리',           era: '과거', off: [-86, 125],  model: 'haystack' },
    { id: 'jars',      name: '장독대',           era: '과거', off: [-149, 38],  model: 'jars' },
    { id: 'mortar',    name: '디딜방아',         era: '과거', off: [-144, 115], model: 'mortar' },
    { id: 'sotdae',    name: '솟대',             era: '과거', off: [-134, -19], model: 'sotdae' },
    { id: 'forklift',  name: '멈춘 지게차',      era: '현대', off: [67, 77],    model: 'forklift' },
    { id: 'parcels',   name: '택배 상자 더미',   era: '현대', off: [158, 38],   model: 'parcels' },
    { id: 'container', name: '문 열린 컨테이너', era: '현대', off: [77, -19],   model: 'container' },
    { id: 'seedpod',   name: '떨어진 씨앗 캡슐', era: '미래', off: [-58, -125], model: 'seedpod' },
    { id: 'dronedown', name: '떨어진 운반 드론', era: '미래', off: [115, -86],  model: 'dronedown' },
    { id: 'caseshard', name: '깨진 진열장 조각', era: '미래', off: [67, -134],  model: 'caseshard' }
  ];
  /* 금고 안 — 금고 가운데에서. 진열장 다섯은 남쪽 0°·시계 방향 각도(°)로 CASE_R, 해미 진열장은 HAEMI_DEG, 가장 깊은 진열장은 북쪽 DEEP_R */
  var CASES = [{ deg: 60, name: '청하 잔치', shape: 'feast' }, { deg: 120, name: '별배가 떨어지던 밤', shape: 'ship' }, { deg: 240, name: '막차가 떠나던 역', shape: 'train' },
    { deg: 300, name: '잠기던 궁궐', shape: 'palace' }, { deg: 210, name: '굳은 네거리', shape: 'signal' }];
  var HAEMI_DEG = 160, CASE_R = 6.5, DEEP_R = 9.5;
  var VAULT_R = 11, VAULT_H = 12, VAULT_SEGS = 16, DOOR_W = 4.6, PILLAR_W = 3, PILLAR_H = 9, PYLON_H = 10;
  var GRANARY_SIZE = [5, 4.2, 4], WAREHOUSE_SIZE = [12, 7, 8], GATE_HALF = 24;
  var CONTAINERS = [[-53, -43], [38, -38], [43, 43]], GANTRY = [0, -43];           // 야적장 가운데에서(m)
  /* 이야기 단계(0부터 장 번호) — 33·34·35장 = 32·33·34, 11부 38장 = 37 */
  var GATE_OPEN_CH = 32, CH34 = 33, CH35 = 34, CH38 = 37;
  var GRANARY_OPEN_STEP = 2, PYLON_OFF_FROM = [5, 6], DOOR_OPEN_STEP = 6, CORE_DIM_STEP = 5, HAEMI_FREE_STEP = 6, DEEP_CASE_CH = 35, MOMENT_FREE_STEP = 4;
  var LANDMARK_R = 30, SMALL_R = function (g) { return g ? 30 : 14; };
  var REWARD_BIG = { gold: 200, dust: 2, exp: 56 }, REWARD_SMALL = { gold: 76, exp: 26 };
  var SEARCH_STEP = 8, SEARCH_R = 400, SEP_BIG = 60, SEP_SMALL = 30;
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
  /** 벌 가운데 — 서리봉 고원 가운데에서 동쪽 고개 너머 가장 가까운 뭍 { x, y } 또는 null(고원이 없으면) */
  function center() {
    if (centerMemo !== undefined) { return centerMemo; }
    var f = FR(), c = f ? f.center() : null;
    if (!c) { return null; }
    var p = nearLand(c.x + VAULT_OFF[0], c.y + VAULT_OFF[1], [], 0, 30);
    centerMemo = { x: p.x, y: p.y };
    return centerMemo;
  }
  /** 명소 일곱 + 작은 발견 열 — [{ id, name, era, model, big, x, y, way?, wayDy? }]. 세계가 같으면 늘 같다 */
  function sites() {
    if (memo) { return memo; }
    var c = center(), out = [];
    if (!c) { memo = []; return memo; }
    LANDMARKS.forEach(function (d) {
      var p = nearLand(c.x + d.off[0], c.y + d.off[1], out, SEP_BIG, d.id === 'pass' ? 0 : 8);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: true, x: p.x, y: p.y, way: d.way || null, wayDy: d.wayDy || 8, forced: !!p.forced });
    });
    SMALL.forEach(function (d) {
      var p = nearLand(c.x + d.off[0], c.y + d.off[1], out, SEP_SMALL, 0);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: false, x: p.x, y: p.y, forced: !!p.forced });
    });
    memo = out;
    return out;
  }
  function siteById(id) { var L = sites(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** 금고 안 자리 — 금고 가운데에서 남쪽 0°·시계 방향 deg 로 r m */
  function ringPos(v, deg, r) { var a = deg * Math.PI / 180; return { x: v.x - Math.sin(a) * r, y: v.y + Math.cos(a) * r }; }
  /** 이야기 자리 — 명소 id 가운데, 또는 'case0~4'(굳은 순간 진열장)·'haemi'(해미 진열장)·'deep'(가장 깊은 진열장)·'core'(기록 기둥·핵 = 금고 가운데)·'door'(금고 문 앞) — 없으면 null */
  function spot(part) {
    var v = siteById('vault'), m = /^case(\d)$/.exec(part);
    if (m) { var e = CASES[+m[1]]; return v && e ? ringPos(v, e.deg, CASE_R) : null; }
    if (part === 'haemi') { return v ? ringPos(v, HAEMI_DEG, CASE_R) : null; }
    if (part === 'deep') { return v ? { x: v.x, y: v.y - DEEP_R } : null; }
    if (part === 'core') { return v ? { x: v.x, y: v.y } : null; }
    if (part === 'door') { return v ? { x: v.x, y: v.y + VAULT_R + 2 } : null; }
    var s = siteById(part);
    return s ? { x: s.x, y: s.y } : null;
  }
  function storyAt() { var s = core() && core().save ? core().save.story : null; return s || { ch: 0, step: 0 }; }
  function reached(ch, step) { var s = storyAt(); return s.ch > ch || (s.ch === ch && (s.step || 0) >= step); }
  /** 고개 빛 울타리가 꺼졌나 — 9부(32장)를 마친 뒤(손잡이 vault.gate 1 이면 늘 열림, 확인용) */
  function gateOpen() { return K('gate', 0) ? true : storyAt().ch >= GATE_OPEN_CH; }
  function granaryOpen() { return reached(CH34, GRANARY_OPEN_STEP); }
  function pylonOff(k) { return reached(CH34, PYLON_OFF_FROM[k]); }
  function doorOpen() { return reached(CH34, DOOR_OPEN_STEP); }
  function coreDim() { return reached(CH35, CORE_DIM_STEP); }
  function haemiFree() { return reached(CH35, HAEMI_FREE_STEP); }
  function deepShown() { return storyAt().ch >= DEEP_CASE_CH; }
  function momentFree() { return reached(CH38, MOMENT_FREE_STEP); }
  function inRegion(x, y) { var c = center(); return on() && !!c && Math.hypot(x - c.x, y - c.y) <= 620; }

  var poleMemo = null;
  /** landform 기둥 타기 — 기록 기둥 하나(3×3m·9m, 금고 가운데). 꼭대기는 작은 네모 — 금고 문이 열려야 닿는다 */
  function poles() {
    if (!on()) { return []; }
    if (poleMemo) { return poleMemo; }
    var p = siteById('vault');
    if (!p) { return []; }
    poleMemo = [{ id: 'vt_pillar', x: p.x, y: p.y, r: PILLAR_W / 2, top: PILLAR_H, drain: 0.7, perch: { x: p.x, y: p.y },
      beam: { ax: p.x - 0.5, ay: p.y, bx: p.x + 0.5, by: p.y, w: 1.4 },   // 3m 네모 꼭대기 — 가장자리 안쪽
      grab: '🧗 기록 기둥을 붙잡았다 — 계속 밀면 오른다 · 점프 = 도약 · 등지면 손을 놓는다',
      perchText: '🔷 기록 기둥 꼭대기 — 갈무리의 핵이 코앞이다 · 뛰면 날개를 편다', edgeText: '🔷 기둥 끝 — 뛰어내리면(점프) 날개를 편다' }];
    return poleMemo;
  }

  /* ── 벽(월드 좌표 사각형 — world3d houseRects 가 격자 칸마다 가져간다) ─ */
  var rectMemo = null;
  /** 명소 하나의 벽 사각형들 — 문(door)·상태 칸은 rectsIn 이 그때그때 거른다. rot 은 houseRects 규약(지역 x 축 = (cos rot, sin rot)) */
  function rectsOf(st) {
    var x = st.x, y = st.y, out = [], i;
    switch (st.model) {
      case 'pass': return [{ x: x, z: y, w: 1.4, d: GATE_HALF * 2, rot: 0, gate: true }];
      case 'vault': {
        var segW = 2 * VAULT_R * Math.sin(Math.PI / VAULT_SEGS) + 0.5;
        for (i = 0; i < VAULT_SEGS; i++) {
          var a = 2 * Math.PI * i / VAULT_SEGS;
          if (i === 0) { out.push({ x: x, z: y + VAULT_R, w: DOOR_W, d: 0.7, rot: 0, door: true }); continue; }
          out.push({ x: x - Math.sin(a) * VAULT_R, z: y + Math.cos(a) * VAULT_R, w: segW, d: 0.7, rot: a });
        }
        out.push({ x: x, z: y, w: PILLAR_W, d: PILLAR_W, rot: 0 });
        return out;
      }
      case 'pylon': return [{ x: x, z: y, w: 1.2, d: 1.2, rot: 0 }];
      case 'granary': return [{ x: x, z: y, w: GRANARY_SIZE[0], d: GRANARY_SIZE[2], rot: 0 }];
      case 'yard':
        out.push({ x: x, z: y, w: WAREHOUSE_SIZE[0], d: WAREHOUSE_SIZE[2], rot: 0 });
        CONTAINERS.forEach(function (c, k) { out.push({ x: x + c[0], z: y + c[1], w: 6, d: 2.4, rot: -0.3 * k }); });
        return out;
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
      if (r.gate) { return !gateOpen(); }
      if (r.door) { return !doorOpen(); }
      return true;
    });
  }

  /* ── 세이브·발견 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.vault || typeof s.vault !== 'object') { s.vault = {}; }
    if (!s.vault.found || typeof s.vault.found !== 'object') { s.vault.found = {}; }
    return s.vault;
  }
  function found(id) { var f = core().save.vault; return !!(f && f.found && f.found[id]); }
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
      toast((st.big ? '🟦 명소 발견 — ' : '✨ 작은 발견 — ') + st.name + ' (' + st.era + ') · 금 +' + r.gold + (st.way ? ' · 순간이동 지점' : ''));
      c.log('🟦 ' + REGION + ' — ' + st.name + ' 발견', 'discover');
      c.emit('vault:found', { id: st.id, big: st.big });
    });
    if (out.length) { sfx('discover'); core().persist(); }
    return out;
  }
  /** 순간이동 지점 — 찾은 고개 어귀·금고 앞·벌 신상 [{ key, x, y, name }] */
  function waypoints() {
    if (!on()) { return []; }
    return sites().filter(function (st) { return st.way && found(st.id); }).map(function (st) {
      return { key: 'vt:' + st.id, x: st.x, y: st.y + st.wayDy, name: '🟦 ' + st.way };
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
    core().emit('region:teleport', { key: 'vt:' + id });
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
  var fx = {}, clock = 0, mats = null, drones = null;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function gyAt(w, x, y) { return w.groundY ? w.groundY(x, y) : 0; }
  function M(T3) {
    if (mats) { return mats; }
    var tr = function (c, a) { return new T3.MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, side: T3.DoubleSide }); };
    var glow = function (c) { return new T3.MeshBasicMaterial({ color: c }); };
    mats = {
      glass: tr(0x73d9ff, 0.25), veil: tr(0x73d9ff, 0.42), amberG: tr(0xffad38, 0.26), amberS: tr(0xffc860, 0.4), water: tr(0x4d8ccc, 0.6),
      glow: glow(0x73d9ff), glowW: glow(0xcdf2ff), seed: glow(0x8cff99), ember: glow(0xff8050), red: glow(0xff382e), violet: glow(0xbf80ff), drop: tr(0xb3d9ff, 0.7),
      alloy: new T3.MeshStandardMaterial({ color: 0xd6e0ee, metalness: 0.65, roughness: 0.35 }), steel: new T3.MeshLambertMaterial({ color: 0x99a3ad }),
      steelD: new T3.MeshLambertMaterial({ color: 0x474d54 }), dim: new T3.MeshLambertMaterial({ color: 0x2e333d }),
      wood: new T3.MeshLambertMaterial({ color: 0x734d2e }), thatch: new T3.MeshLambertMaterial({ color: 0xb89957 }), stone: new T3.MeshLambertMaterial({ color: 0x858078 }),
      concrete: new T3.MeshLambertMaterial({ color: 0x9e9e99 }), rust: new T3.MeshLambertMaterial({ color: 0x9e5733 }), jar: new T3.MeshLambertMaterial({ color: 0x593824 }),
      yellow: new T3.MeshLambertMaterial({ color: 0xf2b826 }), parcel: new T3.MeshLambertMaterial({ color: 0xb88f5c }), redW: new T3.MeshLambertMaterial({ color: 0xb3402e }),
      cA: new T3.MeshLambertMaterial({ color: 0xbf4d33 }), cB: new T3.MeshLambertMaterial({ color: 0x3373a6 }), cC: new T3.MeshLambertMaterial({ color: 0x4d8c59 }),
      shutter: new T3.MeshLambertMaterial({ color: 0x8c949a }), office: new T3.MeshLambertMaterial({ color: 0x335c8c }), tile: new T3.MeshLambertMaterial({ color: 0x993f33 }),
      hull: new T3.MeshLambertMaterial({ color: 0x4d5c80 }), train: new T3.MeshLambertMaterial({ color: 0xd1d6db }), trainB: new T3.MeshLambertMaterial({ color: 0x3373b3 }), roofD: new T3.MeshLambertMaterial({ color: 0x40474f }),
      road: new T3.MeshLambertMaterial({ color: 0xb89957 }), shadow: new T3.MeshLambertMaterial({ color: 0x14100d })
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function cyl(T3, g, m, rt, rb, h, x, y, z, seg) { var o = new T3.Mesh(new T3.CylinderGeometry(rt, rb, h, seg || 12), m); o.position.set(x, y, z); g.add(o); return o; }
  function ball(T3, g, m, r, x, y, z) { var o = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; }
  /** 굳은 순간 진열장 하나 — 받침 + 호박 유리 + 속 모양(작은 모형) */
  function caseOf(T3, g, m, shape) {
    box(T3, g, m.steelD, 1.7, 0.4, 1.7, 0, 0.2, 0);
    box(T3, g, m.amberG, 1.6, 2.2, 1.6, 0, 1.5, 0);
    var s = new T3.Group(); s.position.y = 0.8; g.add(s);
    var i;
    switch (shape) {
      case 'feast': box(T3, s, m.wood, 1, 0.1, 0.6, 0, 0.3, 0); for (i = 0; i < 3; i++) { box(T3, s, m.ember, 0.18, 0.25, 0.18, -0.4 + i * 0.4, 0.9, 0); } break;
      case 'ship': box(T3, s, m.hull, 1, 0.25, 0.35, 0, 0.6, 0).rotation.z = -0.5; box(T3, s, m.alloy, 0.1, 0.5, 0.1, 0.1, 0.9, 0).rotation.z = -0.5; break;
      case 'train': box(T3, s, m.train, 1.1, 0.4, 0.4, 0, 0.3, 0); box(T3, s, m.trainB, 1.12, 0.1, 0.42, 0, 0.2, 0); break;
      case 'palace': box(T3, s, m.tile, 0.9, 0.35, 0.6, 0, 0.2, 0); box(T3, s, m.roofD, 1.2, 0.12, 0.8, 0, 0.5, 0); box(T3, s, m.water, 1.3, 0.05, 1.3, 0, 0.05, 0); break;
      case 'signal': box(T3, s, m.steelD, 0.08, 1, 0.08, 0, 0.5, 0); box(T3, s, m.red, 0.22, 0.22, 0.12, 0, 1, 0.05); break;
    }
  }
  function build(w, T3, st) {
    var m = M(T3), g = new T3.Group(), o = { root: g, gate: null, door: null, orb: null, core: null, haemi: null, deep: null, deepGlass: null, granaryDoor: null, floater: null }, i, k;
    switch (st.model) {
      case 'pass': {
        o.gate = new T3.Group(); g.add(o.gate);
        var veil = new T3.Mesh(new T3.PlaneGeometry(GATE_HALF * 2, 14), m.veil); veil.rotation.y = Math.PI / 2; veil.position.y = 7; o.gate.add(veil);
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.alloy, 0.6, 14, 0.6, 0, 7, i * GATE_HALF); }
        for (i = 0; i < 2; i++) {                                                                   // 고개 어귀 장승 둘
          box(T3, g, m.stone, 0.6, 0.4, 0.6, 6, 0.2, 3 - i * 5); box(T3, g, m.wood, 0.45, 2.6, 0.45, 6, 1.7, 3 - i * 5); box(T3, g, m.redW, 0.55, 0.6, 0.5, 6, 3.1, 3 - i * 5);
        }
        break;
      }
      case 'vault': {
        var segW = 2 * VAULT_R * Math.sin(Math.PI / VAULT_SEGS) + 0.5;
        for (i = 0; i < VAULT_SEGS; i++) {
          var a = 2 * Math.PI * i / VAULT_SEGS, sg = new T3.Group();
          sg.position.set(-Math.sin(a) * VAULT_R, 0, Math.cos(a) * VAULT_R); sg.rotation.y = -a; g.add(sg);
          if (i === 0) {                                                                              // 남쪽 — 문
            o.door = new T3.Group(); sg.add(o.door);
            box(T3, o.door, m.steel, DOOR_W, VAULT_H, 0.7, 0, VAULT_H / 2, 0); box(T3, o.door, m.glow, DOOR_W * 0.7, 0.2, 0.75, 0, 3.5, 0);
            continue;
          }
          box(T3, sg, m.alloy, segW, VAULT_H, 0.7, 0, VAULT_H / 2, 0); box(T3, sg, m.glow, segW, 0.25, 0.75, 0, VAULT_H - 1, 0);
        }
        cyl(T3, g, m.steelD, VAULT_R + 0.3, VAULT_R + 0.3, 0.5, 0, VAULT_H + 0.25, 0, 24);            // 지붕 판
        var dome = new T3.Mesh(new T3.SphereGeometry(VAULT_R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.glass); dome.scale.y = 0.45; dome.position.y = VAULT_H + 0.5; g.add(dome);
        var ring = new T3.Mesh(new T3.TorusGeometry(CASE_R, 0.15, 4, 40), m.glow); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; g.add(ring);
        CASES.forEach(function (c) { var cg = new T3.Group(), p = ringPos({ x: 0, y: 0 }, c.deg, CASE_R); cg.position.set(p.x, 0, p.y); g.add(cg); caseOf(T3, cg, m, c.shape); });
        o.haemi = new T3.Group(); var hp = ringPos({ x: 0, y: 0 }, HAEMI_DEG, CASE_R); o.haemi.position.set(hp.x, 0, hp.y); g.add(o.haemi);   // 해미 진열장 — 35장 6단계에 깨짐
        box(T3, o.haemi, m.glass, 1.9, 2.8, 1.9, 0, 1.5, 0); box(T3, g, m.steelD, 2, 0.15, 2, hp.x, 0.07, hp.y);
        o.deep = new T3.Group(); o.deep.position.set(0, 0, -DEEP_R); g.add(o.deep);                    // 가장 깊은 진열장 — 10부를 마치면 드러남
        box(T3, o.deep, m.steelD, 2.6, 0.4, 2.6, 0, 0.2, 0);
        o.deepGlass = new T3.Group(); o.deep.add(o.deepGlass); box(T3, o.deepGlass, m.amberG, 2.4, 3.4, 2.4, 0, 2.1, 0);
        for (k = 0; k < 3; k++) { var yaw = [Math.PI, 0, Math.PI / 2][k]; box(T3, o.deep, m.road, 0.9, 0.04, 0.18, -Math.cos(yaw) * 0.45, 0.45, Math.sin(yaw) * 0.45, yaw); }   // 세 갈래 길 모형
        box(T3, o.deep, m.violet, 1.6, 0.1, 0.05, 0, 3.2, 0).rotation.z = 0.25;                       // 하늘 틈 금
        box(T3, g, m.steel, PILLAR_W, PILLAR_H, PILLAR_W, 0, PILLAR_H / 2, 0);                         // 기록 기둥
        [2, 4.5, 7].forEach(function (y) { box(T3, g, m.glow, PILLAR_W + 0.1, 0.12, PILLAR_W + 0.1, 0, y, 0); });
        box(T3, g, m.dim, 1, 0.3, 1, 0, PILLAR_H + 0.15, 0);
        o.core = ball(T3, g, m.glowW, 0.7, 0, PILLAR_H + 1.4, 0); o.floater = o.core;
        break;
      }
      case 'pylon': {
        box(T3, g, m.steel, 1.2, PYLON_H, 1.2, 0, PYLON_H / 2, 0);
        [3, 6].forEach(function (y) { box(T3, g, m.steelD, 1.6, 0.3, 1.6, 0, y, 0); });
        o.orb = ball(T3, g, m.glow, 0.9, 0, PYLON_H + 1, 0); box(T3, g, m.dim, 1, 0.3, 1, 0, PYLON_H + 0.15, 0);
        break;
      }
      case 'granary': {
        for (i = 0; i < 4; i++) { box(T3, g, m.stone, 0.5, 1, 0.5, i % 2 ? 2 : -2, 0.5, i < 2 ? -1.6 : 1.6); }
        box(T3, g, m.wood, GRANARY_SIZE[0], GRANARY_SIZE[1], GRANARY_SIZE[2], 0, GRANARY_SIZE[1] / 2 + 0.2, 0);
        box(T3, g, m.thatch, GRANARY_SIZE[0] + 0.8, 0.3, GRANARY_SIZE[2] * 0.65, 0, GRANARY_SIZE[1] + 1, -1).rotation.x = 0.55;
        box(T3, g, m.thatch, GRANARY_SIZE[0] + 0.8, 0.3, GRANARY_SIZE[2] * 0.65, 0, GRANARY_SIZE[1] + 1, 1).rotation.x = -0.55;
        box(T3, g, m.shadow, 1.6, 2.2, 0.05, 0, 2, GRANARY_SIZE[2] / 2 + 0.03);                        // 문 뒤 어둠
        o.granaryDoor = new T3.Group(); g.add(o.granaryDoor);
        box(T3, o.granaryDoor, m.wood, 1.6, 2.2, 0.12, 0, 2, GRANARY_SIZE[2] / 2 + 0.08); box(T3, o.granaryDoor, m.steelD, 0.5, 0.2, 0.14, 0, 2, GRANARY_SIZE[2] / 2 + 0.12);   // 자물쇠
        break;
      }
      case 'yard': {
        box(T3, g, m.concrete, WAREHOUSE_SIZE[0], WAREHOUSE_SIZE[1], WAREHOUSE_SIZE[2], 0, WAREHOUSE_SIZE[1] / 2, 0);
        box(T3, g, m.steelD, WAREHOUSE_SIZE[0] + 0.4, 0.4, WAREHOUSE_SIZE[2] + 0.4, 0, WAREHOUSE_SIZE[1] + 0.2, 0);
        box(T3, g, m.shutter, 4, 4.5, 0.1, -2.5, 2.25, WAREHOUSE_SIZE[2] / 2 + 0.06); box(T3, g, m.office, 1, 2.2, 0.1, 3.5, 1.1, WAREHOUSE_SIZE[2] / 2 + 0.06);
        var cols = [m.cA, m.cB, m.cC];
        CONTAINERS.forEach(function (c, ci) {
          var cg = new T3.Group(); cg.position.set(c[0], 0, c[1]); cg.rotation.y = 0.3 * ci; g.add(cg);
          for (var lv = 0; lv < 2; lv++) { box(T3, cg, cols[(ci + lv) % 3], 6, 2.6, 2.4, 0, 1.3 + lv * 2.6, lv * 0.3); }
        });
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.yellow, 0.5, 11, 0.5, i * 6, 5.5, GANTRY[1]); }     // 갠트리 크레인
        box(T3, g, m.yellow, 12.5, 0.6, 0.6, 0, 11, GANTRY[1]); box(T3, g, m.steelD, 0.06, 4, 0.06, 1.5, 9, GANTRY[1]);
        break;
      }
      case 'statue': {
        box(T3, g, m.stone, 3.2, 1.2, 3.2, 0, 0.6, 0); cyl(T3, g, m.stone, 0.5, 0.7, 2.6, 0, 2.5, 0, 8); ball(T3, g, m.stone, 0.55, 0, 4.2, 0); box(T3, g, m.stone, 2.4, 0.3, 0.4, 0, 3.3, 0);
        var sr = new T3.Mesh(new T3.TorusGeometry(2.4, 0.08, 4, 32), m.amberS); sr.rotation.x = Math.PI / 2; sr.position.y = 0.1; g.add(sr);
        break;
      }
      case 'haystack': for (i = 0; i < 3; i++) { cyl(T3, g, m.thatch, 0.2, 1, 2, i * 2.2 - 2.2, 1, (i % 2) * 0.8, 10); } break;
      case 'jars':
        box(T3, g, m.stone, 3, 0.3, 1.6, 0, 0.15, 0);
        for (i = 0; i < 5; i++) { var jr = ball(T3, g, m.jar, 0.35 + (i % 2) * 0.1, -1.1 + i * 0.55, 0.7, (i % 2) * 0.4 - 0.2); jr.scale.y = 1.3; }
        break;
      case 'mortar': box(T3, g, m.wood, 0.3, 0.8, 0.3, 0, 0.4, 0); box(T3, g, m.wood, 3, 0.2, 0.25, 0.4, 0.85, 0).rotation.z = 0.12; box(T3, g, m.stone, 0.6, 0.4, 0.6, -1.1, 0.2, 0); break;
      case 'sotdae': box(T3, g, m.wood, 0.12, 5, 0.12, 0, 2.5, 0); box(T3, g, m.wood, 0.6, 0.15, 0.18, 0.1, 5.1, 0).rotation.z = 0.2; break;
      case 'forklift':
        box(T3, g, m.yellow, 1.4, 1, 2.2, 0, 0.8, 0); box(T3, g, m.steelD, 1.2, 1.4, 0.1, 0, 2, -0.4);
        box(T3, g, m.steelD, 0.12, 0.08, 1.4, -0.4, 0.2, 1.7); box(T3, g, m.steelD, 0.12, 0.08, 1.4, 0.4, 0.2, 1.7); box(T3, g, m.steelD, 0.1, 2.6, 0.1, 0, 1.4, 1.1);
        break;
      case 'parcels': for (i = 0; i < 6; i++) { box(T3, g, m.parcel, 0.7, 0.5, 0.6, (i % 3) * 0.75 - 0.75, 0.25 + Math.floor(i / 3) * 0.5, 0, i * 0.2); } break;
      case 'container':
        box(T3, g, m.rust, 6, 2.6, 0.1, 0, 1.3, -1.2); box(T3, g, m.rust, 6, 2.6, 0.1, 0, 1.3, 1.2); box(T3, g, m.rust, 6, 0.1, 2.4, 0, 2.6, 0);
        box(T3, g, m.rust, 0.1, 2.5, 1.2, 3.4, 1.25, 1.6, 0.9);
        break;
      case 'seedpod': {
        var pod = new T3.Mesh(new T3.CapsuleGeometry(0.5, 1.2, 4, 8), m.alloy); pod.rotation.z = 1.3; pod.position.y = 0.5; g.add(pod);
        o.floater = box(T3, g, m.seed, 0.3, 0.3, 0.3, 0.2, 0.9, 0); o.floaterY = 0.9;
        break;
      }
      case 'dronedown': {
        var dg = new T3.Group(); dg.rotation.set(0.4, 0.3, 0.6); dg.position.y = 0.4; g.add(dg);
        box(T3, dg, m.alloy, 0.9, 0.3, 0.9, 0, 0, 0);
        for (i = 0; i < 3; i++) { box(T3, dg, m.steelD, 0.6, 0.05, 0.14, Math.cos(i * 2) * 0.7, 0.2, Math.sin(i * 2) * 0.7); }
        break;
      }
      case 'caseshard':
        for (i = 0; i < 3; i++) { var sh = box(T3, g, m.amberS, 0.9 - i * 0.2, 1.4 - i * 0.3, 0.06, i * 0.6 - 0.6, 0.6, (i % 2) * 0.3); sh.rotation.set(0.3 * i, 0.8 * i, 0.4); }
        for (i = 0; i < 6; i++) { box(T3, g, m.drop, 0.05, 0.18, 0.05, Math.cos(i * 1.9) * 1.2, 1.2 + (i % 3) * 0.5, Math.sin(i * 1.9) * 1.2); }
        break;
    }
    g.position.set(st.x, gyAt(w, st.x, st.y), st.y);
    return o;
  }
  /** 운반 드론 셋 — 야적장과 금고 문 앞을 오간다(보기만, 굳은 조각 호박 알을 매달았다) */
  function buildDrones(w, T3) {
    var m = M(T3), root = new T3.Group(), list = [], k, j;
    for (k = 0; k < 3; k++) {
      var d = new T3.Group();
      box(T3, d, m.alloy, 0.9, 0.3, 0.9, 0, 0, 0);
      for (j = 0; j < 4; j++) { box(T3, d, m.steelD, 0.6, 0.05, 0.14, Math.cos(j * Math.PI / 2) * 0.7, 0.2, Math.sin(j * Math.PI / 2) * 0.7); }
      ball(T3, d, m.ember, 0.3, 0, -0.55, 0);
      root.add(d); list.push({ node: d, k: k });
    }
    return { root: root, list: list };
  }
  function dropAll(w) {
    for (var k in fx) { if (fx.hasOwnProperty(k)) { if (w) { w.removeFx(fx[k].root); } } }
    fx = {};
    if (drones) { if (w) { w.removeFx(drones.root); } drones = null; }
  }
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
      /* 이야기 상태 — 울타리·금고 문·핵·해미 진열장·깊은 진열장·곳간 문·동력 기둥 알 */
      if (o.gate) { o.gate.visible = !gateOpen(); }
      if (o.door) { o.door.visible = !doorOpen(); }
      if (o.core) { o.core.visible = !coreDim(); o.core.position.y = PILLAR_H + 1.4 + Math.sin(clock * 0.6) * 0.25; }
      if (o.haemi) { o.haemi.visible = !haemiFree(); }
      if (o.deep) { o.deep.visible = deepShown(); o.deepGlass.visible = !momentFree(); }
      if (o.granaryDoor) { o.granaryDoor.visible = !granaryOpen(); }
      if (o.orb) { o.orb.visible = !pylonOff(st.id === 'pylon1' ? 1 : 0); }
      if (o.floaterY) { o.floater.position.y = o.floaterY + Math.sin(clock * 0.6 + 1.1) * 0.25; }
    });
    /* 운반 드론 — 금고·야적장이 다 있고 가까울 때만 */
    var v = siteById('vault'), y = siteById('yard');
    if (v && y && Math.hypot(v.x - p.x, v.y - p.y) < 700) {
      if (!drones) { drones = buildDrones(w, T3); w.addFx(drones.root); }
      var fromX = y.x - 14, fromZ = y.y - 34, toX = v.x, toZ = v.y + VAULT_R * 0.5;
      drones.list.forEach(function (d) {
        var u = 0.5 - 0.5 * Math.cos(clock * 0.18 + d.k * 2.1), x0 = fromX + (d.k * 2 - 2), z0 = fromZ + d.k * 0.6, x1 = toX + (d.k * 2 - 2), z1 = toZ;
        var x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u;
        d.node.position.set(x, gyAt(w, x, z) + 5 + (VAULT_H + 3 - 5) * u + Math.sin(u * Math.PI) * 6, z);
      });
    } else if (drones) { w.removeFx(drones.root); drones = null; }
  }
  var accT = 0;
  function tick(dt) {
    if (!core() || !core().save) { return; }
    accT += dt || 0;
    if (accT >= 0.25) {
      accT = 0;
      if (on()) { var p = core().save.player.pos; if (inRegion(p.x, p.y)) { discoverAt(p.x, p.y); } }
    }
    if (!global.DG_NO_DRAW) { paint(dt); } else { fx = {}; drones = null; }
  }

  global.DG = global.DG || {};
  global.DG.vault = {
    REGION: REGION, LANDMARKS: LANDMARKS, SMALL: SMALL, CASES: CASES, VAULT_OFF: VAULT_OFF, GATE_OPEN_CH: GATE_OPEN_CH, VAULT_R: VAULT_R, VAULT_H: VAULT_H, PILLAR_H: PILLAR_H, PILLAR_W: PILLAR_W,
    CASE_R: CASE_R, HAEMI_DEG: HAEMI_DEG, DEEP_R: DEEP_R, LANDMARK_R: LANDMARK_R, GATE_HALF: GATE_HALF,
    GRANARY_OPEN_STEP: GRANARY_OPEN_STEP, PYLON_OFF_FROM: PYLON_OFF_FROM, DOOR_OPEN_STEP: DOOR_OPEN_STEP, CORE_DIM_STEP: CORE_DIM_STEP, HAEMI_FREE_STEP: HAEMI_FREE_STEP,
    DEEP_CASE_CH: DEEP_CASE_CH, MOMENT_FREE_STEP: MOMENT_FREE_STEP,
    on: on, center: center, sites: sites, siteById: siteById, spot: spot, poles: poles, rectsIn: rectsIn, inRegion: inRegion,
    gateOpen: gateOpen, granaryOpen: granaryOpen, pylonOff: pylonOff, doorOpen: doorOpen, coreDim: coreDim, haemiFree: haemiFree, deepShown: deepShown, momentFree: momentFree,
    found: found, discoverAt: discoverAt, waypoints: waypoints, teleport: teleport, marks: marks, tick: tick,
    _resetForTest: function () { memo = null; centerMemo = undefined; rectMemo = null; poleMemo = null; fx = {}; drones = null; accT = 0; }
  };
})(window);
