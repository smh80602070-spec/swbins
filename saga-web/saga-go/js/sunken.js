/**
 * 잠긴 도읍 — 일곱째 지역, 이야기 6부 무대 (PLAN §5 ⑲-44, saga-godot PLAN 106 ㊿-1 `world/region7_sunken.gd`)
 * ---------------------------------------------------------------
 *   땅      ⑮ 소금 갯벌(바깥 고리, 물 많은 늪 바이옴) — 고향에 가장 가까운 그 땅 칸이 가운데. 틈이 닫히자 드러난, 얕게 잠긴 옛 도읍
 *   명소    다섯 — 잠긴 궁궐(과거)·해저 연구 기지(현대)·빛 돔(미래)·옛 등대(과거·미래)·해무 어귀 경계비. 30m 안 = 발견.
 *           shore 명소(궁궐·기지·등대)는 둘레 SHORE_R m 에 물이 있는 뭍을 먼저 고른다(없으면 그냥 뭍 — `st.shore` 가 거짓)
 *   발견    작은 발견 열(테왁·잠수 투구·보급 상자·진주조개·신호 부표·돌거북 비석·편액·해태상·빛 해파리·수중 드론) — 14m(GPS 30m) 안
 *   이동    연구 기지·등대 섬·해무 어귀 — 찾으면 지도(M) 순간이동 지점(키보드 판만, 열쇠 `sk:<id>`)
 *   해무 문 해무 어귀(고향 쪽 GATE_DIST m) 곁 흰 막(+ 벽) — 이야기 20장(5부)을 마치면 걷히고 기둥 둘은 남는다
 *   빛 돔   받침 고리·유리 반구(반지름 DOME_R). 벽은 둘레 DOME_SEGS 조각 — 북쪽 한 조각이 문이고 22장 여덟째 단계(자물쇠를 지킨 뒤)부터 열린다(`domeOpen`)
 *   등대    15m 돌탑 옆면을 타고 오른다(landform 기둥 `sk_light` — 기력 ×LIGHT_DRAIN). 23장을 마치면 불이 켜지고 빛줄기가 돈다(`lighthouseLit`)
 *   잠수    없다(Godot 결정) — 21장 물속 이동은 잠수정(sail 틀)으로 옮긴다
 *   이야기  ⑲-45 자리 표(`spot` — 모래밭·기지 앞·선착장·궁궐 기단) · 20장을 마치면 궁궐 둘레에 불 켜진 테왁 여덟(`seaLightsOn`)
 *   벽      궁궐 정전·컨테이너·관제실·돔 둘레·등대·문 기둥·(닫힌) 문은 world3d `houseRects` 로 막는다
 *
 * 자리 잡기는 crossing.js 와 같은 규칙 + 물가 우선. 판정 층(`center`·`sites`·`rectsIn`·`gateOpen`·`domeOpen`·`poles`)은 순수.
 * 세이브 `save.sunken = { found }`(읽는 쪽 기본값). 그림은 코드 도형(SAGA-DESIGN §7).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('sunken.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var ZONE = 'saltflat', REGION = '잠긴 도읍';
  /* off = 가운데에서(m, +y 남쪽). toward = 고향 쪽으로 그만큼. shore = 물가 우선. way = 순간이동 지점 이름 */
  var GATE_DIST = 520;
  var LANDMARKS = [
    { id: 'palace',     name: '잠긴 궁궐',     era: '과거',      off: [-260, 60],  model: 'palace', shore: true },
    { id: 'lab',        name: '해저 연구 기지', era: '현대',     off: [220, -120], model: 'lab', shore: true, way: '연구 기지' },
    { id: 'dome',       name: '빛 돔',         era: '미래',      off: [60, 260],   model: 'dome' },
    { id: 'lighthouse', name: '옛 등대',       era: '과거·미래', off: [180, -440], model: 'lighthouse', shore: true, way: '등대 섬' },
    { id: 'gate',       name: '해무 어귀',     era: '현대',      toward: GATE_DIST, model: 'gate', way: '해무 어귀' }
  ];
  var SMALL = [
    { id: 'tewak',   name: '떠밀려 온 테왁', era: '과거', off: [-120, -60],  model: 'tewak' },
    { id: 'helmet',  name: '녹슨 잠수 투구', era: '현대', off: [140, 40],    model: 'helmet' },
    { id: 'supply',  name: '보급 상자',     era: '현대', off: [320, -240],  model: 'supply' },
    { id: 'pearl',   name: '진주조개',      era: '과거', off: [-360, 200],  model: 'pearl' },
    { id: 'buoy',    name: '신호 부표',     era: '현대', off: [60, -300],   model: 'buoy' },
    { id: 'turtle',  name: '돌거북 비석',   era: '과거', off: [-220, -200], model: 'turtle' },
    { id: 'plaque',  name: '떨어진 편액',   era: '과거', off: [-160, 180],  model: 'plaque' },
    { id: 'haetae',  name: '해태상',        era: '과거', off: [-60, 120],   model: 'haetae' },
    { id: 'jelly',   name: '빛 해파리',     era: '미래', off: [180, 380],   model: 'jelly' },
    { id: 'drone',   name: '수중 드론',     era: '미래', off: [360, 60],    model: 'drone' }
  ];
  var LANDMARK_R = 30, SMALL_R = function (g) { return g ? 30 : 14; };
  var REWARD_BIG = { gold: 150, dust: 2, exp: 40 }, REWARD_SMALL = { gold: 60, exp: 20 };
  var SEARCH_STEP = 8, SEARCH_R = 200, SEP_BIG = 60, SEP_SMALL = 30, TOWER_CLEAR = 40, SHORE_R = 30;
  var GATE_HALF = 4, GATE_CH = 'ch20', DOME_CH = 'ch22', DOME_FROM = 7, LIGHT_CH = 'ch23';
  var DOME_R = 11, DOME_SEGS = 12;
  var LIGHT_H = 15, LIGHT_HALF = 1.4, LIGHT_DRAIN = 0.8;
  /* ⑲-45 이야기 자리 [명소, m, m] — 별배는 해무 어귀 안쪽 모래밭에 내린다. 선착장 = 기지 잔교 머리. 기단 = 궁궐 앞마당(정전 밖) */
  var ANNEX_OFF = [9.5, 0];                                 // ⑲-46 궁궐 동쪽 곁채(기단 밖)
  var PARTS = { sand: ['gate', 6, 30], sand_hanbyeol: ['gate', 2, 36], sand_bandi: ['gate', 10, 34], lab_front: ['lab', 0, -14], dock: ['lab', 1, 6],
    yeoul: ['lab', -8, 4], plinth: ['palace', 0, 3.5], plinth_yeoul: ['palace', 2.5, 3.2], plinth_bandi: ['palace', -3, 3.2],
    /* ⑲-46 22장 — 곁채 앞(궁궐 동쪽) · 돔 문 앞(북쪽 19m — 석등 셋이 그 둘레 6m) · 돔 안 마른 바닥 */
    annex_mulsae: ['palace', ANNEX_OFF[0], ANNEX_OFF[1] + 3.2], dome_front: ['dome', 0, -19], front_mulsae: ['dome', -8, -20], front_yeoul: ['dome', 8, -20],
    front_bandi: ['dome', 0, -28], dome_duel: ['dome', -5, 0], in_mulsae: ['dome', 3, 3], in_yeoul: ['dome', 4, -2], in_bandi: ['dome', 0, 5] };
  var SEA_CH = 'ch20', SEA_LIGHTS = 8, SEA_R = 9;
  var GRID = 48;

  /* ── 자리(순수 — 지형·해시만) ───────────────────────────── */
  var memo = null, centerMemo;
  function terr(x, y) { var W = global.DG.world; try { return W && W.terrainAt ? W.terrainAt(Math.floor(x / GRID), Math.floor(y / GRID)) : null; } catch (e) { return null; } }
  function zoneAt(x, y) { var B = BM(); return B ? B.regionAt(x, y).cell.zone : null; }
  /** 도읍 가운데 — 고향에 가장 가까운 소금 갯벌 칸 { key, x, y, name } 또는 null */
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
  /** 명소의 off — toward 면 고향 쪽으로 */
  function offOf(d, c) {
    if (!d.toward) { return d.off; }
    var L = Math.hypot(c.x, c.y) || 1;
    return [-c.x / L * d.toward, -c.y / L * d.toward];
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
  /** 둘레 SHORE_R m 여덟 점 중 물이 있나 */
  function nearWater(x, y) {
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; if (terr(x + Math.sin(a) * SHORE_R, y - Math.cos(a) * SHORE_R) === 'water') { return true; } }
    return false;
  }
  function placeNear(c, off, taken, sep, r, shore) {
    var tx = c.x + off[0], ty = c.y + off[1], pass, found = null;
    for (pass = shore ? 0 : 1; pass < 2 && !found; pass++) {
      for (var rr = 0; rr <= SEARCH_R && !found; rr += SEARCH_STEP) {
        var n = rr ? Math.max(8, Math.round(2 * Math.PI * rr / SEARCH_STEP)) : 1;
        for (var k = 0; k < n; k++) {
          var a = 2 * Math.PI * k / n, x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr;
          if (Math.hypot(x - c.x, y - c.y) < TOWER_CLEAR) { continue; }
          var clash = false;
          for (var t = 0; t < taken.length; t++) { if (Math.hypot(taken[t].x - x, taken[t].y - y) < sep + (taken[t].big ? SEP_BIG - sep : 0)) { clash = true; break; } }
          if (clash || !okSpot(x, y, r) || (pass === 0 && !nearWater(x, y))) { continue; }
          found = { x: x, y: y, shore: pass === 0 };
          break;
        }
      }
    }
    return found || { x: tx, y: ty, forced: true };
  }
  /** 명소 다섯 + 작은 발견 열 — [{ id, name, era, model, big, x, y, way?, shore? }]. 세계가 같으면 늘 같다 */
  function sites() {
    if (memo) { return memo; }
    var c = center(), out = [];
    if (!c) { memo = []; return memo; }
    LANDMARKS.forEach(function (d) {
      var p = placeNear(c, offOf(d, c), out, SEP_BIG, d.model === 'dome' ? DOME_R + 1 : (d.model === 'lab' ? 8 : 0), !!d.shore);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: true, x: p.x, y: p.y, way: d.way || null, shore: !!p.shore, forced: !!p.forced });
    });
    SMALL.forEach(function (d) {
      var p = placeNear(c, d.off, out, SEP_SMALL, 0, false);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: false, x: p.x, y: p.y, forced: !!p.forced });
    });
    memo = out;
    return out;
  }
  function siteById(id) { var L = sites(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** ⑲-45 이야기 자리(PARTS) — 그 명소가 없으면 null */
  function spot(part) { var q = PARTS[part], p = q ? siteById(q[0]) : null; return p ? { x: p.x + q[1], y: p.y + q[2] } : null; }
  /** 도읍 땅 안인가 */
  function inRegion(x, y) { return on() && zoneAt(x, y) === ZONE; }
  function storyAt() { var s = core() && core().save ? core().save.story : null; return s || { ch: 0, step: 0 }; }
  function chIndex(id) { var ST = global.DG.story; if (!ST || !ST.CHAPTERS) { return -1; } for (var i = 0; i < ST.CHAPTERS.length; i++) { if (ST.CHAPTERS[i].id === id) { return i; } } return -1; }
  /** 그 장을 마쳤나 — 표에 아직 없는 장이면 거짓 */
  function done(id) { var i = chIndex(id); return i >= 0 && storyAt().ch > i; }
  /** 해무 문이 걷혔나 — 이야기 20장(5부 끝)을 마친 뒤 */
  function gateOpen() { return done(GATE_CH); }
  /** 빛 돔 문이 열렸나 — 22장을 마친 뒤 */
  function domeOpen() { var i = chIndex(DOME_CH), s = storyAt(); return i >= 0 && (s.ch > i || (s.ch === i && (s.step || 0) >= DOME_FROM)); }   // ⑲-46
  /** 옛 등대에 불이 켜졌나 — 23장을 마친 뒤 */
  function lighthouseLit() { return done(LIGHT_CH); }
  /** ⑲-45 궁궐 둘레 테왁 불 — 20장(틈이 닫힘)을 마친 뒤 */
  function seaLightsOn() { return done(SEA_CH); }
  var poleMemo = null;
  /** landform 기둥 타기 — 옛 등대 하나. 꼭대기는 네모(난간 판) */
  function poles() {
    if (!on()) { return []; }
    if (poleMemo) { return poleMemo; }
    var p = siteById('lighthouse');
    if (!p) { return []; }
    poleMemo = [{ id: 'sk_light', x: p.x, y: p.y, r: LIGHT_HALF, top: LIGHT_H, drain: LIGHT_DRAIN, perch: { x: p.x, y: p.y },
      beam: { ax: p.x - 1, ay: p.y, bx: p.x + 1, by: p.y, w: 2.4 },
      grab: '🧗 등대 돌벽을 붙잡았다 — 계속 밀면 오른다 · 점프 = 도약 · 등지면 손을 놓는다',
      perchText: '🗼 옛 등대 난간 판 — 잠긴 도읍이 물빛 아래로 비친다 · 뛰면 날개를 편다', edgeText: '🗼 난간 끝 — 뛰어내리면(점프) 날개를 편다' }];
    return poleMemo;
  }

  /* ── 벽(월드 좌표 사각형 — world3d houseRects 가 격자 칸마다 가져간다) ─ */
  var rectMemo = null;
  /** 명소 하나의 벽 사각형들 — door: 'gate'(해무 문)·'dome'(돔 문)은 닫혀 있을 때만 rectsIn 이 돌려준다 */
  function rectsOf(st) {
    var x = st.x, y = st.y, out = [], i;
    switch (st.model) {
      case 'palace': return [{ x: x, z: y - 1, w: 8, d: 5, rot: 0 }, { x: x + ANNEX_OFF[0], z: y + ANNEX_OFF[1], w: 4, d: 3, rot: 0 }];   // 정전(기단 앞마당은 트임)·⑲-46 곁채
      case 'lab': return [{ x: x - 3, z: y - 2, w: 2.4, d: 5.6, rot: 0 }, { x: x + 3.2, z: y - 2.5, w: 3.2, d: 3, rot: 0 }];   // 컨테이너·관제실
      case 'dome':
        for (i = 0; i < DOME_SEGS; i++) {                                                                        // 둘레 조각 — 0 번(북쪽)이 문
          var a = i * Math.PI * 2 / DOME_SEGS, seg = { x: x + Math.sin(a) * DOME_R, z: y - Math.cos(a) * DOME_R, w: 2 * Math.PI * DOME_R / DOME_SEGS + 0.2, d: 0.6, rot: a };   // 사각형 식의 가로축 = (cos rot, sin rot) = 접선
          if (i === 0) { seg.door = 'dome'; }
          out.push(seg);
        }
        return out;
      case 'lighthouse': return [{ x: x, z: y, w: LIGHT_HALF * 2, d: LIGHT_HALF * 2, rot: 0 }];
      case 'gate': return [{ x: x - GATE_HALF, z: y, w: 1, d: 1, rot: 0 }, { x: x + GATE_HALF, z: y, w: 1, d: 1, rot: 0 },
        { x: x, z: y, w: GATE_HALF * 2 - 1, d: 0.6, rot: 0, door: 'gate' }, { x: x + GATE_HALF + 3, z: y + 2, w: 1.2, d: 0.6, rot: 0 }];
      case 'supply': return [{ x: x, z: y, w: 1.4, d: 1.4, rot: 0 }];
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
    var L = rectMemo[gx + ',' + gy] || [], go = gateOpen(), dopen = domeOpen();
    return L.filter(function (r) { return !(r.door === 'gate' && go) && !(r.door === 'dome' && dopen); });
  }

  /* ── 세이브·발견 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.sunken || typeof s.sunken !== 'object') { s.sunken = {}; }
    if (!s.sunken.found || typeof s.sunken.found !== 'object') { s.sunken.found = {}; }
    return s.sunken;
  }
  function found(id) { var f = core().save.sunken; return !!(f && f.found && f.found[id]); }
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
      toast((st.big ? '🏯 명소 발견 — ' : '✨ 작은 발견 — ') + st.name + ' (' + st.era + ') · 금 +' + r.gold + (st.way ? ' · 순간이동 지점' : ''));
      c.log('🏯 ' + REGION + ' — ' + st.name + ' 발견', 'discover');
      c.emit('sunken:found', { id: st.id, big: st.big });
    });
    if (out.length) { sfx('discover'); core().persist(); }
    return out;
  }
  /** 순간이동 지점 — 찾은 연구 기지·등대 섬·해무 어귀 [{ key, x, y, name }] */
  function waypoints() {
    if (!on()) { return []; }
    return sites().filter(function (st) { return st.way && found(st.id); }).map(function (st) {
      return { key: 'sk:' + st.id, x: st.x, y: st.y + 8, name: '🏯 ' + st.way };
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
    core().emit('region:teleport', { key: 'sk:' + id });
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
      stone: new T3.MeshLambertMaterial({ color: 0x8a8f94 }), stoneD: new T3.MeshLambertMaterial({ color: 0x5f6b72 }), moss: new T3.MeshLambertMaterial({ color: 0x5d7f6a }),
      wood: new T3.MeshLambertMaterial({ color: 0x5e4630 }), roof: new T3.MeshLambertMaterial({ color: 0x3f4a55 }), red: new T3.MeshLambertMaterial({ color: 0x8f3a2c }),
      alloy: new T3.MeshStandardMaterial({ color: 0xbfc8d2, metalness: 0.6, roughness: 0.4 }), dark: new T3.MeshLambertMaterial({ color: 0x252a33 }),
      rust: new T3.MeshLambertMaterial({ color: 0x86492c }), yellow: new T3.MeshStandardMaterial({ color: 0xf2c230, metalness: 0.3, roughness: 0.5 }),
      orange: new T3.MeshLambertMaterial({ color: 0xe8752a }), sand: new T3.MeshLambertMaterial({ color: 0xb8ad94 }),
      glass: new T3.MeshStandardMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.28, metalness: 0.2, roughness: 0.1, side: T3.DoubleSide, depthWrite: false }),
      glow: glow(0x66f2ff, 1), mist: glow(0xf4f7fa, 0.55), pillar: glow(0xe6f2ff, 0.3), lamp: glow(0xffe08a, 1), beam: glow(0xfff1b8, 0.25), jelly: glow(0x8fd8ff, 0.7)
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function cyl(T3, g, m, rt, rb, h, x, y, z, seg) { var o = new T3.Mesh(new T3.CylinderGeometry(rt, rb, h, seg || 12), m); o.position.set(x, y, z); g.add(o); return o; }
  function ball(T3, g, m, r, x, y, z) { var o = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; }
  function build(w, T3, st) {
    var m = M(T3), g = new T3.Group(), o = { root: g, spin: [], bob: [], blink: null, door: null }, i;
    var y0 = gyAt(w, st.x, st.y);
    switch (st.model) {
      case 'palace': {
        box(T3, g, m.stone, 12, 0.25, 9, 0, 0.12, 0);                                                              // 낮은 기단
        for (i = 0; i < 3; i++) { box(T3, g, m.moss, 4, 0.25, 1, 0, -0.1 - i * 0.25, 5 + i); }                      // 물로 내려가는 돌계단(반쯤 잠김)
        var hall = new T3.Group(); hall.rotation.z = 0.08; hall.position.set(0, 0.25, -1); g.add(hall);            // 기운 정전
        for (i = 0; i < 4; i++) { box(T3, hall, m.red, 0.35, 3.2, 0.35, -3.3 + i * 2.2, 1.6, 2.2); }
        box(T3, hall, m.wood, 8, 3, 4.4, 0, 1.5, -0.3);
        var rf = box(T3, hall, m.roof, 9.6, 0.3, 3.4, 0, 3.6, -1.1); rf.rotation.x = 0.5;                             // 맞배 지붕 두 쪽
        var rb = box(T3, hall, m.roof, 9.6, 0.3, 3.4, 0, 3.6, 0.5); rb.rotation.x = -0.5;
        box(T3, g, m.stone, 5, 0.25, 4, ANNEX_OFF[0], 0.12, ANNEX_OFF[1]);                                         // ⑲-46 곁채 — 작은 기단·전각·지붕
        box(T3, g, m.wood, 4, 2.2, 3, ANNEX_OFF[0], 1.35, ANNEX_OFF[1]);
        var ar = box(T3, g, m.roof, 4.8, 0.25, 2.1, ANNEX_OFF[0], 2.75, ANNEX_OFF[1] - 0.8); ar.rotation.x = 0.5;
        var ar2 = box(T3, g, m.roof, 4.8, 0.25, 2.1, ANNEX_OFF[0], 2.75, ANNEX_OFF[1] + 0.8); ar2.rotation.x = -0.5;
        o.sea = [];                                                                                                // ⑲-45 불 켜진 테왁 여덟(20장 뒤)
        for (i = 0; i < SEA_LIGHTS; i++) {
          var sa = i * Math.PI * 2 / SEA_LIGHTS, tg = new T3.Group(); tg.position.set(Math.sin(sa) * SEA_R, 0.2, -Math.cos(sa) * SEA_R); g.add(tg);
          var tb = ball(T3, tg, m.orange, 0.35, 0, 0, 0); tb.scale.y = 0.75; ball(T3, tg, m.lamp, 0.16, 0, 0.3, 0);
          o.sea.push(tg); o.bob.push({ o: tg, y: 0.2, ph: i * 0.8 });
        }
        break;
      }
      case 'lab': {
        box(T3, g, m.alloy, 10, 0.5, 8, 0, 0.25, 0);                                                               // 갑판
        box(T3, g, m.orange, 2.4, 2.4, 5.6, -3, 1.7, -2); box(T3, g, m.rust, 2.4, 2.4, 5.6, -3, 4.1, -2);          // 컨테이너 둘(쌓음)
        box(T3, g, m.alloy, 3.2, 2.8, 3, 3.2, 1.9, -2.5); o.blink = box(T3, g, m.glow, 2.4, 0.6, 0.05, 3.2, 2.6, -0.98);   // 관제실
        box(T3, g, m.wood, 2, 0.2, 14, 0, 0.35, 11);                                                               // 잔교
        for (i = 0; i < 4; i++) { cyl(T3, g, m.wood, 0.15, 0.15, 1.6, i % 2 ? 0.9 : -0.9, -0.3, 6 + i * 3, 6); }
        var sub = new T3.Group(); sub.position.set(3, 0.6, 12); g.add(sub); o.bob.push({ o: sub, y: 0.6, ph: 0 });     // 노란 잠수정
        var hull = cyl(T3, sub, m.yellow, 1, 1, 5, 0, 0, 0, 16); hull.rotation.x = Math.PI / 2;
        ball(T3, sub, m.yellow, 1, 0, 0, 2.5); ball(T3, sub, m.yellow, 1, 0, 0, -2.5); box(T3, sub, m.yellow, 0.9, 1, 1.4, 0, 1.1, 0.3);
        ball(T3, sub, m.glass, 0.35, 0, 0.2, 3.3);
        break;
      }
      case 'dome': {
        var ring = new T3.Mesh(new T3.TorusGeometry(DOME_R + 1.5, 1.2, 6, 40), m.stoneD); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);   // 받침 고리
        var dm = new T3.Mesh(new T3.SphereGeometry(DOME_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.glass); dm.position.y = 0.5; g.add(dm);   // 유리 반구
        for (i = 0; i < 6; i++) { var ra = new T3.Mesh(new T3.TorusGeometry(DOME_R, 0.06, 4, 32, Math.PI), m.alloy); ra.rotation.y = i * Math.PI / 6; ra.position.y = 0.5; g.add(ra); }
        box(T3, g, m.alloy, 0.4, 3.4, 0.4, -1.8, 1.7, -DOME_R); box(T3, g, m.alloy, 0.4, 3.4, 0.4, 1.8, 1.7, -DOME_R);   // 북쪽 문틀
        o.door = box(T3, g, m.glow, 3.2, 3, 0.1, 0, 1.5, -DOME_R); o.door.material = m.glow;                        // 닫힌 빛 문
        o.domeDoor = true;
        break;
      }
      case 'lighthouse': {
        cyl(T3, g, m.stoneD, 3.2, 3.8, 1, 0, 0.5, 0, 16);                                                           // 바위 받침
        cyl(T3, g, m.stone, LIGHT_HALF, LIGHT_HALF + 0.3, LIGHT_H, 0, LIGHT_H / 2, 0, 12);                          // 15m 돌탑
        for (i = 0; i < 3; i++) { cyl(T3, g, m.red, LIGHT_HALF + 0.05, LIGHT_HALF + 0.12, 0.6, 0, 3 + i * 4.5, 0, 12); }
        cyl(T3, g, m.stoneD, 2, 2, 0.25, 0, LIGHT_H, 0, 16);                                                        // 난간 판
        o.lamp = ball(T3, g, m.dark, 0.6, 0, LIGHT_H + 1.2, 0);
        var cap = new T3.Mesh(new T3.ConeGeometry(1.2, 1.4, 10), m.roof); cap.position.y = LIGHT_H + 2.4; g.add(cap);
        o.beam = new T3.Group(); o.beam.position.y = LIGHT_H + 1.2; g.add(o.beam);                                 // 도는 빛줄기(켜지면)
        var bm = new T3.Mesh(new T3.CylinderGeometry(0.4, 3, 40, 12, 1, true), m.beam); bm.rotation.z = Math.PI / 2; bm.position.x = 20; o.beam.add(bm);
        break;
      }
      case 'gate': {
        box(T3, g, m.stoneD, 1.6, 0.4, 1, GATE_HALF + 3, 0.2, 2); box(T3, g, m.stone, 1.1, 2.6, 0.5, GATE_HALF + 3, 1.7, 2);   // 경계비
        for (i = -1; i <= 1; i += 2) {                                                                             // 기둥 둘(문이 걷혀도 남는다)
          box(T3, g, m.stone, 1, 5, 1, i * GATE_HALF, 2.5, 0);
          cyl(T3, g, m.pillar, 0.9, 0.9, 12, i * GATE_HALF, 6, 0, 12);
        }
        o.door = new T3.Mesh(new T3.PlaneGeometry(GATE_HALF * 2 - 1, 4.6), m.mist);                                // 흰 해무 막
        o.door.position.set(0, 2.3, 0); g.add(o.door);
        break;
      }
      case 'tewak': { var tw = ball(T3, g, m.orange, 0.45, 0, 0.35, 0); tw.scale.y = 0.8; box(T3, g, m.dark, 0.9, 0.05, 0.9, 0, 0.12, 0); break; }
      case 'helmet': ball(T3, g, m.rust, 0.45, 0, 0.45, 0); ball(T3, g, m.glass, 0.2, 0, 0.5, 0.38); break;
      case 'supply': box(T3, g, m.alloy, 1.2, 1, 1.2, 0, 0.5, 0, 0.4); box(T3, g, m.orange, 1.22, 0.15, 1.22, 0, 0.7, 0, 0.4); break;
      case 'pearl': { var sh = ball(T3, g, m.stone, 0.5, 0, 0.15, 0); sh.scale.y = 0.35; ball(T3, g, m.lamp, 0.12, 0, 0.3, 0.1); break; }
      case 'buoy': { var bu = cyl(T3, g, m.red, 0.4, 0.6, 1.4, 0, 0.7, 0, 10); o.bob.push({ o: bu, y: 0.7, ph: 1 }); o.blink = ball(T3, g, m.lamp, 0.14, 0, 1.6, 0); break; }
      case 'turtle': { var tb = ball(T3, g, m.stoneD, 0.9, 0, 0.35, 0); tb.scale.set(1, 0.45, 1.3); box(T3, g, m.stone, 1, 1.6, 0.25, 0, 1.2, 0); break; }
      case 'plaque': { var pq = box(T3, g, m.wood, 2, 0.8, 0.12, 0, 0.1, 0); pq.rotation.x = -1.4; box(T3, g, m.lamp, 1.6, 0.05, 0.5, 0, 0.18, 0); break; }
      case 'haetae': box(T3, g, m.stone, 1.2, 0.6, 0.8, 0, 0.3, 0); ball(T3, g, m.stone, 0.45, 0, 1, 0.2); box(T3, g, m.stone, 0.5, 0.6, 0.5, 0, 0.6, -0.1); break;
      case 'jelly': { var jl = ball(T3, g, m.jelly, 0.5, 0, 1.4, 0); jl.scale.y = 0.6; o.bob.push({ o: jl, y: 1.4, ph: 2 }); for (i = 0; i < 4; i++) { box(T3, g, m.jelly, 0.04, 0.8, 0.04, Math.cos(i * 1.6) * 0.25, 0.9, Math.sin(i * 1.6) * 0.25); } break; }
      case 'drone': { box(T3, g, m.alloy, 1, 0.4, 0.7, 0, 0.3, 0, 0.3); o.blink = ball(T3, g, m.glow, 0.1, 0.45, 0.4, 0); break; }
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
    var p = core().save.player.pos, seen = {}, L = sites(), i, open = gateOpen(), dopen = domeOpen(), lit = lighthouseLit(), sea = seaLightsOn();
    for (i = 0; i < L.length; i++) {
      var st = L[i];
      if (Math.hypot(st.x - p.x, st.y - p.y) > 280) { continue; }
      seen[st.id] = true;
      var o = fx[st.id] || (fx[st.id] = build(w, T3, st)), k;
      for (k = 0; k < o.bob.length; k++) { o.bob[k].o.position.y = o.bob[k].y + Math.sin(clock * 1.1 + o.bob[k].ph) * 0.12; }
      if (o.blink) { o.blink.visible = Math.sin(clock * 3 + i) > 0; }
      if (o.door) {
        var shut = o.domeDoor ? !dopen : !open;
        o.door.visible = shut;
        if (shut && !o.domeDoor) { o.door.material.opacity = 0.45 + Math.sin(clock * 1.5) * 0.1; }
      }
      if (o.sea) { for (k = 0; k < o.sea.length; k++) { o.sea[k].visible = sea; } }
      if (o.lamp) { o.lamp.material = lit ? M(T3).lamp : M(T3).dark; o.beam.visible = lit; if (lit) { o.beam.rotation.y += (dt || 0) * 0.6; } }
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
  global.DG.sunken = {
    ZONE: ZONE, REGION: REGION, LANDMARKS: LANDMARKS, SMALL: SMALL, LANDMARK_R: LANDMARK_R, SMALL_R: SMALL_R, REWARD_BIG: REWARD_BIG, REWARD_SMALL: REWARD_SMALL,
    SEP_BIG: SEP_BIG, SEP_SMALL: SEP_SMALL, TOWER_CLEAR: TOWER_CLEAR, SHORE_R: SHORE_R, GATE_HALF: GATE_HALF, GATE_DIST: GATE_DIST,
    DOME_R: DOME_R, DOME_SEGS: DOME_SEGS, LIGHT_H: LIGHT_H, LIGHT_HALF: LIGHT_HALF, LIGHT_DRAIN: LIGHT_DRAIN,
    on: on, center: center, sites: sites, siteById: siteById, inRegion: inRegion, nearWater: nearWater, gateOpen: gateOpen, domeOpen: domeOpen, lighthouseLit: lighthouseLit,
    PARTS: PARTS, SEA_LIGHTS: SEA_LIGHTS, ANNEX_OFF: ANNEX_OFF, DOME_FROM: DOME_FROM, spot: spot, seaLightsOn: seaLightsOn,
    rectsOf: rectsOf, rectsIn: rectsIn, poles: poles, found: found, discoverAt: discoverAt, waypoints: waypoints, teleport: teleport, marks: marks, tick: tick,
    _resetForTest: function () { memo = null; rectMemo = null; centerMemo = undefined; poleMemo = null; }
  };
})(window);
