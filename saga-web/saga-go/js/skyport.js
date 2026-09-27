/**
 * 은하 나루 — 다섯째 지역, 이야기 4부 무대 (PLAN §5 ⑲-37, saga-godot PLAN 106 ㊽-1 `world/region5_skyport.gd`)
 * ---------------------------------------------------------------
 *   땅      ⑮ 태양 신도시(바깥 고리, 미래) — 고향에 가장 가까운 그 땅 칸이 가운데. 별배가 온 시대
 *   명소    다섯 — 별배 나루(미래)·옛 절터(과거)·은하역(현대)·태양광 밭(미래)·틈 고개 경계비. 30m 안 = 발견
 *   발견    작은 발견 열(배달 기계·절 종·공중전화·시간 캡슐·돌탑·이정표·화물 상자·정류장·옹기·안테나) — 14m(GPS 30m) 안
 *   이동    별배 나루·은하역·틈 고개 — 찾으면 지도(M) 순간이동 지점(키보드 판만, 열쇠 `sp:<id>`)
 *   틈 문   틈 고개 경계비 곁 보랏빛 막(+ 벽) — 이야기 15장을 마치면 사라지고 빛 기둥 둘은 남는다(`gateOpen`).
 *           열린 땅이라 땅 전체를 막진 않는다 — 4부로 드는 자리 표지
 *   벽      계류 탑·부스·돌탑·객차·문 기둥·(닫힌) 문·공중전화·안테나는 world3d `houseRects` 로 막는다
 *   계류 탑 ⑲-38 16장 — 옆면을 타고 오른다(landform 기둥 타기, `poles`) · 꼭대기 빛 공은 16장 탑 단계를 지나면 켜진다(`beaconLit`)
 *   매인 별배 ⑲-38 — 16장 여섯째 단계부터 착륙판 위 SHIP_UP m 에 수평으로 떠 있다(`docked`, 그림만 — 밑은 비어 지나간다).
 *           그때부터 고원 별배는 떠났다(frost `away`)
 *   종각    ⑲-39 17장 — 옛 절터 동쪽 BELFRY_OFF m(돌 기단 벽). 17장 여덟째 단계부터 종이 걸리고(`bellHung`) 작은 발견
 *           "떨어진 절 종"의 종 몸은 숨는다(나무 틀은 남음). `ringBell` = 3초 잦아드는 흔들림(그림만)
 *   막차    ⑲-40 18장 — 태양광 밭 동쪽 변전함(벽). 18장 다섯째 단계(변전함에 전기)부터 `trainPowered` — 표시등 빨강 → 초록,
 *           은하역 녹슨 객차의 전조등 둘·행선 표시판·창에 불(그림만, 막차는 아직 서 있다)
 *
 * 자리 잡기는 frost.js 와 같은 규칙 — 가운데에서 off 만큼 간 곳에서 가장 가까운 그 땅 들·숲 칸(물·마을·길·산·강 아님), 서로 떨어짐.
 * 판정 층(`center`·`sites`·`rectsIn`·`gateOpen`)은 순수. 세이브 `save.skyport = { found }`(읽는 쪽 기본값).
 * 그림은 코드 도형(SAGA-DESIGN §7). 별배 나루 둘레 금속 포장은 땅빛이 아니라 명소 도형 안 원판이다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('skyport.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var ZONE = 'solar', REGION = '은하 나루';
  /* off = 가운데에서(m, +y 남쪽). way = 순간이동 지점 이름 */
  var LANDMARKS = [
    { id: 'port',    name: '별배 나루',        era: '미래', off: [0, -220],   model: 'port', way: '별배 나루' },
    { id: 'temple',  name: '옛 절터',          era: '과거', off: [-280, 100], model: 'temple' },
    { id: 'station', name: '은하역',           era: '현대', off: [240, 180],  model: 'station', way: '은하역' },
    { id: 'farm',    name: '태양광 밭',        era: '미래', off: [-120, 360], model: 'farm' },
    { id: 'gate',    name: '틈 고개 경계비',   era: '미래', off: [60, 520],   model: 'gate', way: '틈 고개' }
  ];
  var SMALL = [
    { id: 'courier', name: '멈춘 배달 기계', era: '미래', off: [160, -120],  model: 'courier' },
    { id: 'bell',    name: '떨어진 절 종',   era: '과거', off: [-380, -40],  model: 'bell' },
    { id: 'phone',   name: '낡은 공중전화',  era: '현대', off: [320, 40],    model: 'phone' },
    { id: 'capsule', name: '묻힌 시간 캡슐', era: '미래', off: [-60, 120],   model: 'capsule' },
    { id: 'cairn',   name: '길가 돌탑',      era: '과거', off: [-220, -200], model: 'cairn' },
    { id: 'sign',    name: '갈림길 이정표',  era: '현대', off: [100, 320],   model: 'sign' },
    { id: 'crate',   name: '별배 화물 상자', era: '미래', off: [120, -300],  model: 'crate' },
    { id: 'busstop', name: '빈 정류장',      era: '현대', off: [380, 300],   model: 'busstop' },
    { id: 'jar',     name: '깨진 옹기',      era: '과거', off: [-340, 240],  model: 'jar' },
    { id: 'antenna', name: '녹슨 안테나',    era: '미래', off: [240, -260],  model: 'antenna' }
  ];
  var LANDMARK_R = 30, SMALL_R = function (g) { return g ? 30 : 14; };
  var REWARD_BIG = { gold: 150, dust: 2, exp: 40 }, REWARD_SMALL = { gold: 60, exp: 20 };
  var SEARCH_STEP = 8, SEARCH_R = 200, SEP_BIG = 60, SEP_SMALL = 30, TOWER_CLEAR = 40;
  var PAD_R = 9, PAVE_R = 14, TOWER_H = 18, GATE_HALF = 4, GATE_CH = 'ch15';
  /* ⑲-38 16장 — 나루 틀 안 자리(나루 가운데 = 계류 탑에서 m, +y 남쪽) · 탑 단계를 지나면 빛 공 · 여섯째 단계부터 별배가 매인다 */
  var TOWER_DRAIN = 0.75;   // 18m 를 꽉 찬 기력(100)으로 오를 수 있게 — 오르기 기력 ×0.75 ≈ 86
  var DOCK_CH = 'ch16', BEACON_AFTER = 5, DOCK_FROM = 6, SHIP_UP = 6, TOWER_HALF = 1.2;
  var PORT_PARTS = { ara: [PAD_R + 3, 5.5], bandi: [-5, 9], fight: [0, 6], altar: [0, 6] };
  /* ⑲-39·40 이야기 자리 [명소, m, m] — 17장 옛 절터(temple)·떨어진 종(작은 발견 bell): 종각 = 절터 동쪽, 한결은 그 남쪽 ·
     18장 은하역(station)·태양광 밭(farm): 도담 = 승강장 남쪽 끝 아래, 선로 끝 = 잔상 길 끝 곁, 막차 = 승강장 가운데(객차 남쪽) */
  var BELFRY_OFF = [10, 0], BELFRY_HALF = 2, BELL_CH = 'ch17', BELL_FROM = 8, RING_SEC = 3;
  var SUB_OFF = [10.5, 0], TRAIN_CH = 'ch18', TRAIN_FROM = 5;
  var SITE_PARTS = { belfry: ['temple', 10, 0], hangyeol: ['temple', 10, 3.6], tp_bandi: ['temple', 14.5, -1],
    bell_fight: ['bell', -4, 7], bell_duel: ['bell', 3, 6], hg_bell: ['bell', -3, 3], bell_bandi: ['bell', 4, -3],
    dodam: ['station', 9, 3.4], st_bandi: ['station', -6, 4.5], dodam_end: ['station', 4, 70], train: ['station', 0, 0.5],
    farm_fight: ['farm', 0, 12], substation: ['farm', SUB_OFF[0], SUB_OFF[1]] };
  var GRID = 48;

  /* ── 자리(순수 — 지형·해시만) ───────────────────────────── */
  var memo = null, centerMemo;
  function terr(x, y) { var W = global.DG.world; try { return W && W.terrainAt ? W.terrainAt(Math.floor(x / GRID), Math.floor(y / GRID)) : null; } catch (e) { return null; } }
  function zoneAt(x, y) { var B = BM(); return B ? B.regionAt(x, y).cell.zone : null; }
  /** 나루 가운데 — 고향에 가장 가까운 태양 신도시 칸 { key, x, y, name } 또는 null */
  function center() {
    if (centerMemo !== undefined) { return centerMemo; }
    var B = BM();
    if (!B) { return null; }
    var best = null, bd = Infinity;
    for (var j = -14; j <= 14; j++) {
      for (var i = -14; i <= 14; i++) {
        var c = B.cellAt(i, j);
        if (c.zone !== ZONE) { continue; }
        var d = Math.hypot(c.x, c.y);
        if (d < bd) { bd = d; best = { key: c.key, x: c.x, y: c.y, name: c.name }; }
      }
    }
    centerMemo = best;
    return best;
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
      var p = placeNear(c, d.off, out, SEP_BIG, d.model === 'port' ? PAVE_R : (d.model === 'station' ? 10 : 0));
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
  /** ⑲-38 나루 틀 자리 — 'ara'·'bandi'·'fight'·'altar'(계류대) · ⑲-39·40 절터·종·역·밭 곁(SITE_PARTS) — 그 명소가 없으면 null */
  function portSpot(part) {
    var tp = SITE_PARTS[part], p = siteById(tp ? tp[0] : 'port'), o = tp ? [tp[1], tp[2]] : PORT_PARTS[part];
    return p && o ? { x: p.x + o[0], y: p.y + o[1] } : null;
  }
  function storyAt() { var s = core() && core().save ? core().save.story : null; return s || { ch: 0, step: 0 }; }
  function chIndex(id) { var ST = global.DG.story; if (!ST || !ST.CHAPTERS) { return -1; } for (var i = 0; i < ST.CHAPTERS.length; i++) { if (ST.CHAPTERS[i].id === id) { return i; } } return -1; }
  function passed(id, step) { var i = chIndex(id), s = storyAt(); return i >= 0 && (s.ch > i || (s.ch === i && (s.step || 0) >= step)); }
  /** 계류 탑 꼭대기 빛 공이 켜졌나 — 16장 탑 단계(여섯째)를 지나면 */
  function beaconLit() { return passed(DOCK_CH, BEACON_AFTER + 1); }
  /** 별배가 나루에 매였나 — 16장 여섯째 단계부터 늘 */
  function docked() { return passed(DOCK_CH, DOCK_FROM); }
  /** ⑲-39 종이 종각에 걸렸나 — 17장 여덟째 단계(종 울리기)부터 늘 */
  function bellHung() { return passed(BELL_CH, BELL_FROM); }
  var ringT = 0;
  /** ⑲-39 종을 울린다(그림만 — RING_SEC 초 잦아드는 흔들림) */
  function ringBell() { ringT = RING_SEC; }
  /** ⑲-40 막차에 전기가 들었나 — 18장 다섯째 단계(변전함 뒤)부터 늘 */
  function trainPowered() { return passed(TRAIN_CH, TRAIN_FROM); }
  var poleMemo = null;
  /** landform 기둥 타기 — 계류 탑 하나. 꼭대기는 네모(길 = 가운데 가로 1.8m·폭 2.2m) */
  function poles() {
    if (!on()) { return []; }
    if (poleMemo) { return poleMemo; }
    var p = siteById('port');
    if (!p) { return []; }
    poleMemo = [{ id: 'sp_tower', x: p.x, y: p.y, r: TOWER_HALF, top: TOWER_H, drain: TOWER_DRAIN, perch: { x: p.x, y: p.y },
      beam: { ax: p.x - 0.9, ay: p.y, bx: p.x + 0.9, by: p.y, w: 2.2 },   // 2.4m 네모 꼭대기 — 가장자리 0.2m 안쪽
      grab: '🧗 계류 탑 옆면을 붙잡았다 — 계속 밀면 오른다 · 점프 = 도약 · 등지면 손을 놓는다',
      perchText: '🗼 계류 탑 꼭대기에 올라섰다 — 뛰면 날개를 편다', edgeText: '🗼 탑 끝 — 뛰어내리면(점프) 날개를 편다' }];
    return poleMemo;
  }
  /** 나루 땅 안인가 */
  function inRegion(x, y) { return on() && zoneAt(x, y) === ZONE; }

  /** 틈 문이 열렸나 — 이야기 15장(날개 조각 셋·별배 뜸)을 마친 뒤 */
  function gateOpen() {
    var ST = global.DG.story, s = core() && core().save ? core().save.story : null;
    if (!ST || !ST.CHAPTERS || !s) { return false; }
    for (var i = 0; i < ST.CHAPTERS.length; i++) { if (ST.CHAPTERS[i].id === GATE_CH) { return s.ch > i; } }
    return false;
  }

  /* ── 벽(월드 좌표 사각형 — world3d houseRects 가 격자 칸마다 가져간다) ─ */
  var rectMemo = null;
  /** 명소 하나의 벽 사각형들 — 문(door)은 닫혀 있을 때만 rectsIn 이 돌려준다 */
  function rectsOf(st) {
    var x = st.x, y = st.y;
    switch (st.model) {
      case 'port': return [{ x: x, z: y, w: TOWER_HALF * 2, d: TOWER_HALF * 2, rot: 0 }, { x: x + PAD_R + 3, z: y + 2, w: 2.2, d: 2.2, rot: 0 }];
      case 'temple': return [{ x: x, z: y - 4, w: 3.6, d: 3.6, rot: 0 },
        { x: x + BELFRY_OFF[0], z: y + BELFRY_OFF[1], w: BELFRY_HALF * 2, d: BELFRY_HALF * 2, rot: 0 }];   // ⑲-39 종각 기단
      case 'station': return [{ x: x, z: y - 3.4, w: 12, d: 2.8, rot: 0 }];
      case 'farm': return [{ x: x + SUB_OFF[0], z: y + SUB_OFF[1], w: 1.2, d: 1.0, rot: 0 }];   // ⑲-40 변전함
      case 'gate': return [{ x: x - GATE_HALF, z: y, w: 1, d: 1, rot: 0 }, { x: x + GATE_HALF, z: y, w: 1, d: 1, rot: 0 },
        { x: x, z: y, w: GATE_HALF * 2 - 1, d: 0.6, rot: 0, door: true }, { x: x + GATE_HALF + 3, z: y + 2, w: 1.2, d: 0.6, rot: 0 }];
      case 'phone': return [{ x: x, z: y, w: 1.1, d: 1.1, rot: 0 }];
      case 'antenna': return [{ x: x, z: y, w: 1.2, d: 1.2, rot: 0 }];
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
    if (!s.skyport || typeof s.skyport !== 'object') { s.skyport = {}; }
    if (!s.skyport.found || typeof s.skyport.found !== 'object') { s.skyport.found = {}; }
    return s.skyport;
  }
  function found(id) { var f = core().save.skyport; return !!(f && f.found && f.found[id]); }
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
      toast((st.big ? '🌌 명소 발견 — ' : '✨ 작은 발견 — ') + st.name + ' (' + st.era + ') · 금 +' + r.gold + (st.way ? ' · 순간이동 지점' : ''));
      c.log('🌌 ' + REGION + ' — ' + st.name + ' 발견', 'discover');
      c.emit('skyport:found', { id: st.id, big: st.big });
    });
    if (out.length) { sfx('discover'); core().persist(); }
    return out;
  }
  /** 순간이동 지점 — 찾은 나루·은하역·틈 고개 [{ key, x, y, name }] */
  function waypoints() {
    if (!on()) { return []; }
    return sites().filter(function (st) { return st.way && found(st.id); }).map(function (st) {
      return { key: 'sp:' + st.id, x: st.x, y: st.y + 8, name: '🌌 ' + st.way };
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
    core().emit('region:teleport', { key: 'sp:' + id });
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
      wood: new T3.MeshLambertMaterial({ color: 0x6b4a2e }), roof: new T3.MeshLambertMaterial({ color: 0x4a4f58 }),
      alloy: new T3.MeshStandardMaterial({ color: 0xc4ccd6, metalness: 0.65, roughness: 0.35 }), pave: new T3.MeshStandardMaterial({ color: 0x7d8691, metalness: 0.5, roughness: 0.6 }),
      dark: new T3.MeshLambertMaterial({ color: 0x2a2f38 }), rust: new T3.MeshLambertMaterial({ color: 0x8a4a2a }),
      panel: new T3.MeshStandardMaterial({ color: 0x1f3a66, metalness: 0.4, roughness: 0.3 }), red: new T3.MeshLambertMaterial({ color: 0xc8402e }),
      green: new T3.MeshLambertMaterial({ color: 0x3f7a4a }), clay: new T3.MeshLambertMaterial({ color: 0x6b3f26 }), bronze: new T3.MeshStandardMaterial({ color: 0x8c6a3a, metalness: 0.7, roughness: 0.4 }),
      glow: glow(0x66f2ff, 1), ring: glow(0x9fe8ff, 0.55), rift: glow(0xb880ff, 0.45), pillar: glow(0xd6c2ff, 0.35), lamp: glow(0xffe08a, 1),
      ledR: glow(0xff4a30, 1), ledG: glow(0x5cff7a, 1)
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function cyl(T3, g, m, rt, rb, h, x, y, z, seg) { var o = new T3.Mesh(new T3.CylinderGeometry(rt, rb, h, seg || 12), m); o.position.set(x, y, z); g.add(o); return o; }
  function ball(T3, g, m, r, x, y, z) { var o = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; }
  function build(w, T3, st) {
    var m = M(T3), g = new T3.Group(), o = { root: g, spin: [], blink: null, door: null }, i, j;
    var y0 = gyAt(w, st.x, st.y);
    switch (st.model) {
      case 'port': {
        cyl(T3, g, m.pave, PAVE_R, PAVE_R, 0.1, 0, 0.05, 0, 32);                                        // 금속 포장
        cyl(T3, g, m.alloy, PAD_R, PAD_R + 0.3, 0.35, 0, 0.18, 0, 32);                                  // 착륙판
        var edge = new T3.Mesh(new T3.TorusGeometry(PAD_R - 0.6, 0.12, 4, 48), m.glow); edge.rotation.x = Math.PI / 2; edge.position.y = 0.38; g.add(edge);
        box(T3, g, m.alloy, 2.4, TOWER_H, 2.4, 0, TOWER_H / 2, 0);                                      // 계류 탑
        o.beacon = ball(T3, g, m.dark, 1.1, 0, TOWER_H + 2.4, 0);                                   // 빛 공 — 꼭대기 서는 자리 위(⑲-38)
        for (i = 0; i < 3; i++) {                                                                        // 도는 빛 고리 셋
          var rg = new T3.Mesh(new T3.TorusGeometry(3 + i * 0.6, 0.08, 4, 40), m.ring);
          rg.position.y = 6 + i * 4.5; rg.rotation.x = Math.PI / 2 + 0.25 * (i - 1); g.add(rg); o.spin.push(rg);
        }
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.alloy, 7, 0.5, 0.6, i * 4.7, 12, 0); box(T3, g, m.dark, 0.6, 1.2, 0.6, i * 8, 11.4, 0); }   // 계류 팔 둘
        box(T3, g, m.alloy, 2.2, 2.6, 2.2, PAD_R + 3, 1.3, 2); box(T3, g, m.glow, 1.4, 0.5, 0.05, PAD_R + 3, 1.9, 3.12);   // 표지 부스
        break;
      }
      case 'temple': {
        for (i = 0; i < 3; i++) {                                                                        // 삼층 돌탑(돌계단 북쪽)
          var s = 3.4 - i * 0.8, yb = 0.5 + i * 1.9;
          box(T3, g, m.stone, s, 1.4, s, 0, yb + 0.7, -4);
          box(T3, g, m.stoneD, s + 0.9, 0.3, s + 0.9, 0, yb + 1.55, -4);
        }
        box(T3, g, m.stoneD, 4.2, 0.5, 4.2, 0, 0.25, -4);
        ball(T3, g, m.stone, 0.35, 0, 6.6, -4);
        for (j = 0; j < 2; j++) { for (i = 0; i < 4; i++) { cyl(T3, g, m.stoneD, 0.45, 0.55, 0.35, -4.5 + i * 3, 0.17, 2 + j * 4, 10); } }   // 주춧돌 줄
        for (i = 0; i < 3; i++) { box(T3, g, m.stone, 4, 0.3, 1, 0, 0.15 + i * 0.3, 8 + i * 1); }       // 돌계단
        /* ⑲-39 종각 — 돌 기단·기둥 넷·들보·기와 지붕 둘. 종(o.hung)은 들보에 매달려 17장 여덟째부터 보인다 */
        var bx = BELFRY_OFF[0], bz = BELFRY_OFF[1], bh = BELFRY_HALF;
        box(T3, g, m.stoneD, bh * 2, 0.6, bh * 2, bx, 0.3, bz);
        for (i = 0; i < 4; i++) { cyl(T3, g, m.wood, 0.16, 0.18, 4.4, bx + (i < 2 ? -1.5 : 1.5), 2.8, bz + (i % 2 ? 1.5 : -1.5), 8); }
        box(T3, g, m.wood, 3.4, 0.3, 0.3, bx, 4.9, bz - 1.5); box(T3, g, m.wood, 3.4, 0.3, 0.3, bx, 4.9, bz + 1.5); box(T3, g, m.wood, 0.3, 0.3, 3.4, bx, 4.9, bz);
        box(T3, g, m.roof, 5, 0.25, 5, bx, 5.2, bz); box(T3, g, m.roof, 3.4, 0.9, 3.4, bx, 5.7, bz, Math.PI / 4);
        o.hung = new T3.Group(); o.hung.position.set(bx, 4.75, bz); g.add(o.hung);
        cyl(T3, o.hung, m.dark, 0.06, 0.06, 0.5, 0, -0.25, 0, 6);                                        // 종고리(별배 쇠)
        cyl(T3, o.hung, m.bronze, 0.5, 0.85, 1.6, 0, -1.3, 0, 16); ball(T3, o.hung, m.bronze, 0.5, 0, -0.5, 0).scale.y = 0.5;
        break;
      }
      case 'station': {
        box(T3, g, m.stone, 20, 0.8, 4, 0, 0.4, 0);                                                     // 승강장
        box(T3, g, m.rust, 12, 3, 2.8, 0, 1.6, -3.4);                                                   // 녹슨 객차
        o.lit = [];                                                                                      // ⑲-40 창·전조등·행선판 — 전기가 들면 켜진다
        for (i = 0; i < 5; i++) { o.lit.push(box(T3, g, m.dark, 1.4, 0.9, 0.05, -4.8 + i * 2.4, 2.2, -1.98)); }
        for (i = -1; i <= 1; i += 2) { o.lit.push(cyl(T3, g, m.dark, 0.28, 0.28, 0.1, 6.05, 1.2, -3.4 + i * 0.8, 12)); o.lit[o.lit.length - 1].rotation.z = Math.PI / 2; }
        box(T3, g, m.dark, 0.12, 0.6, 1.8, 6.06, 2.7, -3.4); o.lit.push(box(T3, g, m.dark, 0.05, 0.4, 1.6, 6.13, 2.7, -3.4));
        box(T3, g, m.wood, 0.2, 3, 0.2, 7, 1.5, 1.4); box(T3, g, m.panel, 3, 0.9, 0.12, 7, 3.2, 1.4);   // 간판
        box(T3, g, m.glow, 2.6, 0.12, 0.13, 7, 3.2, 1.47);
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.dark, 0.15, 0.12, 40, i * 0.75 + 0, 0.06, 22); }    // 남쪽 철로
        for (i = 0; i < 14; i++) { box(T3, g, m.wood, 2.2, 0.1, 0.3, 0, 0.03, 4 + i * 2.8); }
        break;
      }
      case 'farm': {
        for (j = 0; j < 3; j++) {
          for (i = 0; i < 4; i++) {
            var px = -7.5 + i * 5, pz = -5 + j * 5;
            box(T3, g, m.dark, 0.15, 1.2, 0.15, px, 0.6, pz);
            var pn = box(T3, g, m.panel, 4, 0.08, 2.4, px, 1.3, pz); pn.rotation.x = -0.45;
          }
        }
        box(T3, g, m.alloy, 1.2, 1.6, 1.0, SUB_OFF[0], 0.8, SUB_OFF[1]);                                // ⑲-40 변전함·표시등
        box(T3, g, m.dark, 0.05, 0.9, 0.6, SUB_OFF[0] - 0.62, 0.9, SUB_OFF[1]);
        o.led = ball(T3, g, m.ledR, 0.14, SUB_OFF[0], 1.75, SUB_OFF[1]);
        break;
      }
      case 'gate': {
        box(T3, g, m.stoneD, 1.6, 0.4, 1, GATE_HALF + 3, 0.2, 2); box(T3, g, m.stone, 1.1, 2.6, 0.5, GATE_HALF + 3, 1.7, 2);   // 경계비
        for (i = -1; i <= 1; i += 2) {                                                                   // 빛 기둥 둘(문이 열려도 남는다)
          box(T3, g, m.alloy, 1, 5, 1, i * GATE_HALF, 2.5, 0);
          cyl(T3, g, m.pillar, 0.9, 0.9, 12, i * GATE_HALF, 6, 0, 12);
        }
        o.door = new T3.Mesh(new T3.PlaneGeometry(GATE_HALF * 2 - 1, 4.6), m.rift);                     // 보랏빛 막
        o.door.position.set(0, 2.3, 0); g.add(o.door);
        break;
      }
      case 'courier': box(T3, g, m.alloy, 1.2, 0.9, 0.9, 0, 0.75, 0); for (i = 0; i < 4; i++) { cyl(T3, g, m.dark, 0.2, 0.2, 0.15, i < 2 ? -0.45 : 0.45, 0.2, i % 2 ? 0.5 : -0.5, 8).rotation.x = Math.PI / 2; } box(T3, g, m.glow, 0.5, 0.2, 0.05, 0, 0.9, 0.47); break;
      case 'bell': {
        box(T3, g, m.wood, 0.25, 2.6, 0.25, -1.2, 1.3, 0); box(T3, g, m.wood, 0.25, 2.6, 0.25, 1.2, 1.3, 0); box(T3, g, m.wood, 2.8, 0.25, 0.3, 0, 2.6, 0);
        var bl = new T3.Mesh(new T3.CylinderGeometry(0.55, 0.8, 1.4, 14, 1, true), m.bronze); bl.position.set(0.3, 0.7, 0.6); bl.rotation.z = 1.2; g.add(bl); o.bellBody = bl;   // 떨어져 누운 종 — ⑲-39 종각에 걸리면 숨김
        break;
      }
      case 'phone': box(T3, g, m.red, 1, 2.2, 1, 0, 1.1, 0); box(T3, g, m.glow, 0.7, 1.2, 0.05, 0, 1.3, 0.51); break;
      case 'capsule': { var cp = cyl(T3, g, m.alloy, 0.45, 0.45, 1.6, 0, 0.4, 0, 12); cp.rotation.z = 0.5; o.blink = ball(T3, g, m.glow, 0.12, 0.35, 1, 0); break; }
      case 'cairn': for (i = 0; i < 5; i++) { var cs = ball(T3, g, m.stone, 0.55 - i * 0.08, 0, 0.35 + i * 0.5, 0); cs.scale.y = 0.6; } break;
      case 'sign': box(T3, g, m.wood, 0.18, 2.6, 0.18, 0, 1.3, 0); box(T3, g, m.wood, 1.6, 0.35, 0.08, 0.6, 2.2, 0); box(T3, g, m.wood, 1.6, 0.35, 0.08, -0.6, 1.7, 0, 0.3); break;
      case 'crate': box(T3, g, m.alloy, 1.2, 1, 1.2, 0, 0.5, 0, 0.3); box(T3, g, m.glow, 1.22, 0.08, 1.22, 0, 0.7, 0, 0.3); break;
      case 'busstop': box(T3, g, m.alloy, 0.1, 2.4, 0.1, -1.4, 1.2, 0); box(T3, g, m.alloy, 0.1, 2.4, 0.1, 1.4, 1.2, 0); box(T3, g, m.panel, 3.2, 0.12, 1.4, 0, 2.45, 0.3); box(T3, g, m.wood, 2.4, 0.1, 0.5, 0, 0.5, 0.3); break;
      case 'jar': { var jr = ball(T3, g, m.clay, 0.6, 0, 0.55, 0); jr.scale.y = 1.1; ball(T3, g, m.clay, 0.25, 0.9, 0.2, 0.3).scale.y = 0.4; break; }
      case 'antenna': {
        for (i = 0; i < 4; i++) { var lg = box(T3, g, m.rust, 0.12, 8, 0.12, (i < 2 ? -0.4 : 0.4), 4, (i % 2 ? 0.4 : -0.4)); lg.rotation.z = (i < 2 ? 0.05 : -0.05); }
        o.blink = ball(T3, g, m.red, 0.2, 0, 8.2, 0);
        break;
      }
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
    var p = core().save.player.pos, seen = {}, L = sites(), i, open = gateOpen(), hung = bellHung(), power = trainPowered();
    ringT = Math.max(0, ringT - (dt || 0));
    for (i = 0; i < L.length; i++) {
      var st = L[i];
      if (Math.hypot(st.x - p.x, st.y - p.y) > 280) { continue; }
      seen[st.id] = true;
      var o = fx[st.id] || (fx[st.id] = build(w, T3, st));
      for (var k = 0; k < o.spin.length; k++) { o.spin[k].rotation.z += (dt || 0) * (0.6 + k * 0.3) * (k % 2 ? -1 : 1); }
      if (o.blink) { o.blink.visible = Math.sin(clock * 3 + i) > 0; }
      if (o.door) { o.door.visible = !open; if (!open) { o.door.material.opacity = 0.35 + Math.sin(clock * 2) * 0.1; } }
      if (o.beacon) { o.beacon.material = beaconLit() ? M(T3).glow : M(T3).dark; }
      if (st.id === 'port') { paintShip(w, T3, st, o); }
      if (o.hung) { o.hung.visible = hung; o.hung.rotation.x = Math.sin(clock * 7) * 0.3 * (ringT / RING_SEC); }   // ⑲-39 울리면 잦아드는 흔들림
      if (o.bellBody) { o.bellBody.visible = !hung; }
      if (o.led) { o.led.material = power ? M(T3).ledG : M(T3).ledR; }                                                 // ⑲-40 막차 전기
      if (o.lit) { for (var q = 0; q < o.lit.length; q++) { o.lit[q].material = power ? M(T3).lamp : M(T3).dark; } }
    }
    for (var id in fx) { if (fx.hasOwnProperty(id) && !seen[id]) { w.removeFx(fx[id].root); delete fx[id]; } }
  }

  /* ⑲-38 매인 별배 — 착륙판 위 SHIP_UP m, 수평, 빛 날개 셋(frost 별배와 같은 꼴). 계류 팔 사이로 둥실 */
  function paintShip(w, T3, st, o) {
    var on2 = docked();
    if (!on2) { if (o.ship) { o.ship.visible = false; } return; }
    if (!o.ship) {
      var m = M(T3), s = new T3.Group();
      var body = new T3.Mesh(new T3.CylinderGeometry(2.6, 2.2, 18, 20), m.alloy); body.rotation.z = Math.PI / 2; s.add(body);
      ball(T3, s, m.alloy, 2.6, 9, 0, 0);
      box(T3, s, m.alloy, 3, 3.4, 0.25, -9.5, 2.1, 0); box(T3, s, m.alloy, 3, 0.25, 6, -9.5, 0.2, 0);
      for (var i = 0; i < 3; i++) { box(T3, s, m.glow, 2.4, 0.08, 7 - i * 1.5, 3 - i * 3.2, 0.2 + i * 0.3, 0); }
      box(T3, s, m.glow, 17, 0.18, 0.2, 0, 0, 2.62);
      s.position.set(0, SHIP_UP + 2.6, PAD_R * 0.55);   // 탑 남쪽 곁(선체 반지름 2.6 — 탑과 안 겹침) o.root.add(s); o.ship = s;
    }
    o.ship.visible = true;
    o.ship.position.y = SHIP_UP + 2.6 + Math.sin(clock * 0.9) * 0.25;
  }

  var acc = 0;
  function tick(dt) {
    if (!core() || !core().save || !on()) { return; }
    acc += dt || 0;
    if (acc >= 0.25) { acc = 0; var p = core().save.player.pos; discoverAt(p.x, p.y); }
    if (!global.DG_NO_DRAW) { paint(dt); }
  }

  global.DG = global.DG || {};
  global.DG.skyport = {
    ZONE: ZONE, REGION: REGION, LANDMARKS: LANDMARKS, SMALL: SMALL, LANDMARK_R: LANDMARK_R, SMALL_R: SMALL_R, REWARD_BIG: REWARD_BIG, REWARD_SMALL: REWARD_SMALL,
    SEP_BIG: SEP_BIG, SEP_SMALL: SEP_SMALL, TOWER_CLEAR: TOWER_CLEAR, PAD_R: PAD_R, PAVE_R: PAVE_R, TOWER_H: TOWER_H, GATE_HALF: GATE_HALF,
    on: on, center: center, sites: sites, siteById: siteById, inRegion: inRegion, gateOpen: gateOpen, rectsOf: rectsOf, rectsIn: rectsIn,
    PORT_PARTS: PORT_PARTS, SITE_PARTS: SITE_PARTS, SUB_OFF: SUB_OFF, TRAIN_FROM: TRAIN_FROM, trainPowered: trainPowered, BELFRY_OFF: BELFRY_OFF, BELFRY_HALF: BELFRY_HALF, BELL_FROM: BELL_FROM,
    bellHung: bellHung, ringBell: ringBell, ringing: function () { return ringT; }, TOWER_HALF: TOWER_HALF, TOWER_DRAIN: TOWER_DRAIN, SHIP_UP: SHIP_UP, DOCK_FROM: DOCK_FROM, portSpot: portSpot, beaconLit: beaconLit, docked: docked, poles: poles,
    found: found, discoverAt: discoverAt, waypoints: waypoints, teleport: teleport, marks: marks, tick: tick,
    _resetForTest: function () { memo = null; rectMemo = null; centerMemo = undefined; poleMemo = null; }
  };
})(window);
