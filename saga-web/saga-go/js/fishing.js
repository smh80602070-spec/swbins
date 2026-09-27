/**
 * 낚시 — 오픈월드 RPG의 낚시터·미끼·입질·줄다리기·낚시 조합 (PLAN §5 ⑲-24, saga-godot PLAN 106 ㊷)
 * ---------------------------------------------------------------
 *   낚시터 넷  은하강 여울목·청풍 나루(고향 동쪽 서쪽 둑 — 강 물고기) · 안개 선착장(갈대 나루)·갯벌 하구(소금 갯벌 — 갯물고기).
 *             자리는 씨앗 점에서 가장 가까운 물가 — 뭍이고 앞 4·9·14m 가 물인 곳(6m 격자, 360m 안). 해시·지형만 — 늘 같다.
 *             낚시터마다 물고기 다섯, 잡은 자리는 30분(실제 시각) 뒤 다시.
 *   흐름      둘레 3m(GPS 25m) F·🎣 → 고리(서는 자리에서 4~14m 물 위) · 1~3 미끼 → F 던지기 → 둘레 4m 의 그 미끼 물고기가
 *             다가와 1~3번 건드림(그때 당기면 달아나 8초 안 옴) → 입질 1초 안에 당기기 → 줄다리기(누르면 찌가 오르고 떼면 내려감,
 *             물고기 칸 안이면 막대 +, 밖이면 −, 1 = 잡음 · 0 = 놓침) · 15초 안 오면 "오지 않는다"
 *   미끼      요리 재료(cooking.js) 꿀꽃·산사과·짐승 고기 — 던질 때 하나. 물고기마다 좋아하는 미끼 하나
 *   조합      안개 선착장 뭍 쪽 게시판 — 물고기를 갯바람 작살(★4 창)·금·무예 쪽지·강화석·인연 매듭으로 바꾼다
 *
 * 규칙·물고기 표는 saga-godot `data/fishing.gd`, 작살 수치·조합 값은 이 판 것(§5 ⑳). 판정 층(`findShore`·`clampReticle`·`inZone`)은
 * 순수 함수, 흐름은 `step(dt)` 하나가 돌린다(진단이 시각 없이 돌린다). 난수는 mulberry32(판마다 씨앗 고정).
 * 세이브 `save.fish = { bag, log, gone }`(읽는 쪽 기본값). 물고기 자리·상태는 이번 판만.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('fishing.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function LFm() { var l = global.DG.landform; return l && l.on && l.on() ? l : null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var FISH = {
    crucian:       { name: '은비늘 붕어', era: '과거', star: 1, bait: 'honey_flower', zone: 0.28, move: [1.0, 1.6], gain: 0.34, loss: 0.16, len: 0.45, color: '#bfc7d1' },
    mandarin:      { name: '청하 쏘가리', era: '현대', star: 2, bait: 'meat',         zone: 0.22, move: [0.7, 1.2], gain: 0.28, loss: 0.2,  len: 0.6,  color: '#9e8c4d' },
    clockcarp:     { name: '태엽 잉어',   era: '미래', star: 3, bait: 'apple',        zone: 0.16, move: [0.45, 0.9], gain: 0.24, loss: 0.24, len: 0.7, color: '#d9b359' },
    gizzard:       { name: '갯바람 전어', era: '과거', star: 1, bait: 'honey_flower', zone: 0.28, move: [0.9, 1.5], gain: 0.34, loss: 0.16, len: 0.4,  color: '#99b8cc' },
    lanternpuffer: { name: '등불 복어',   era: '현대', star: 2, bait: 'apple',        zone: 0.22, move: [0.7, 1.2], gain: 0.28, loss: 0.2,  len: 0.45, color: '#ffcc66' },
    steelflounder: { name: '강철 넙치',   era: '미래', star: 2, bait: 'meat',         zone: 0.2,  move: [0.6, 1.1], gain: 0.27, loss: 0.21, len: 0.75, color: '#8c99b3' },
    neonhairtail:  { name: '네온 갈치',   era: '미래', star: 3, bait: 'meat',         zone: 0.15, move: [0.4, 0.8], gain: 0.24, loss: 0.25, len: 1.1,  color: '#66f2ff' },
    moonjelly:     { name: '옛 달 해파리', era: '과거', star: 3, bait: 'apple',       zone: 0.17, move: [0.5, 0.9], gain: 0.25, loss: 0.24, len: 0.5,  color: '#d9ccff' }
  };
  var FISH_ORDER = ['crucian', 'mandarin', 'clockcarp', 'gizzard', 'lanternpuffer', 'steelflounder', 'neonhairtail', 'moonjelly'];
  var BAITS = { honey_flower: '꿀꽃 미끼', apple: '산사과 미끼', meat: '고기 미끼' };
  var BAIT_ORDER = ['honey_flower', 'apple', 'meat'];
  /* seed = 고정 씨앗 점(m) 또는 zone = ⑮ 땅 앵커(story.anchorOf). board = 낚시 조합 게시판 */
  var SPOTS = {
    river_n:  { name: '여울목 낚시터',     seed: [1780, -600], fish: ['crucian', 'crucian', 'mandarin', 'mandarin', 'clockcarp'] },
    river_s:  { name: '청풍 나루 낚시터',  seed: [1820, 600],  fish: ['crucian', 'crucian', 'crucian', 'mandarin', 'clockcarp'] },
    galdae:   { name: '안개 선착장 낚시터', zone: 'galdae',    fish: ['gizzard', 'gizzard', 'lanternpuffer', 'steelflounder', 'neonhairtail'], board: true },
    saltflat: { name: '갯벌 하구 낚시터',  zone: 'saltflat',  fish: ['gizzard', 'lanternpuffer', 'lanternpuffer', 'steelflounder', 'moonjelly'] }
  };
  var SPOT_ORDER = ['river_n', 'river_s', 'galdae', 'saltflat'];
  var EXCHANGE = [
    { id: 'catch_spear', name: '갯바람 작살(★4 창)', cost: { gizzard: 6, lanternpuffer: 3, steelflounder: 2 }, weapon: 'w_polearm_catch' },
    { id: 'gold',        name: '금 800',            cost: { crucian: 3 }, gold: 800 },
    { id: 'gold_sea',    name: '금 800',            cost: { gizzard: 3 }, gold: 800 },
    { id: 'note',        name: '무예 쪽지 2',        cost: { mandarin: 2 }, mats: { note: 2 } },
    { id: 'ore',         name: '강화석 3',           cost: { clockcarp: 1 }, ore: 3 },
    { id: 'knot',        name: '인연 매듭 1',        cost: { neonhairtail: 1, moonjelly: 1 }, mats: { knot: 1 } }
  ];

  var FISH_PER_SPOT = 5, RESPAWN = 1800;                       // 초(실제 시각)
  var CAST_MIN = 4, CAST_MAX = 14, CAST_OFF = 9;               // 서는 자리에서(m)
  var BITE_R = 4, SWIM_R = 5.5, SWIM = 1.2, APPROACH = 1.6, ARRIVE = 0.45;
  var NIBBLE_MIN = 1, NIBBLE_MAX = 3, NIBBLE_GAP = [0.7, 1.3], BITE_WINDOW = 1.0, WAIT_MAX = 15, SCARE = 8;
  var PULL_ACCEL = 2.6, PULL_VMAX = 1.2, PROGRESS_START = 0.3, ZONE_SPEED = 0.45;
  var RETICLE_SPEED = 6, BOARD_OFF = 5, SHORE_STEP = 6, SHORE_R = 360, TOWER_CLEAR = 24;   // 땅 앵커(탑)에서 이만큼 떨어져 찾는다
  var CATCH_EXP = [0, 2, 4, 8];
  var STAND_R = function (g) { return g ? 25 : 3; };
  var TERR_TILE = 48;

  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(20260824);
  function rand(a, b) { return a + (b - a) * rng(); }
  var nowFn = function () { return Date.now(); };

  /* ── 판정(순수) ───────────────────────────────────────── */

  /** 물인가 — story.landAt 의 반대(노이즈 물 칸 · 여울 아닌 강·호수) */
  function wetAt(x, y) {
    var W = global.DG.world, k = null;
    if (W && W.terrainAt) { try { k = W.terrainAt(Math.floor(x / TERR_TILE), Math.floor(y / TERR_TILE)); } catch (e) { k = null; } }
    if (k === 'water') { return true; }
    var L = LFm(), rv = L && L.riverAt ? L.riverAt(x, y) : null;
    return !!(rv && !rv.ford);
  }
  var DIRS = [];
  (function () { for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4; DIRS.push([Math.round(Math.cos(a) * 1e6) / 1e6, Math.round(Math.sin(a) * 1e6) / 1e6]); } })();
  /**
   * 씨앗 점에서 가장 가까운 물가 — { x, y(서는 자리), dx, dy(물 쪽), cx, cy(던지는 물 가운데) } 또는 null.
   * 고리를 안에서 밖으로(SHORE_STEP 간격, rMin 부터) 돌며 뭍이면서 앞 CAST_MIN·CAST_OFF·CAST_MAX 가 다 물인 첫 자리. wet 을 주면 그것으로 판다
   */
  function findShore(sx, sy, R, wet, rMin) {
    wet = wet || wetAt;
    for (var r = rMin ? Math.ceil(rMin / SHORE_STEP) * SHORE_STEP : 0; r <= R; r += SHORE_STEP) {
      var n = r ? Math.max(8, Math.round(2 * Math.PI * r / SHORE_STEP)) : 1;
      for (var k = 0; k < n; k++) {
        var a = -Math.PI / 2 + 2 * Math.PI * k / n, px = sx + Math.cos(a) * r, py = sy + Math.sin(a) * r;
        if (wet(px, py)) { continue; }
        for (var d = 0; d < 8; d++) {
          var ux = DIRS[d][0], uy = DIRS[d][1];
          if (wet(px + ux * CAST_MIN, py + uy * CAST_MIN) && wet(px + ux * CAST_OFF, py + uy * CAST_OFF) && wet(px + ux * CAST_MAX, py + uy * CAST_MAX)) {
            return { x: px, y: py, dx: ux, dy: uy, cx: px + ux * CAST_OFF, cy: py + uy * CAST_OFF };
          }
        }
      }
    }
    return null;
  }
  /** 고리 자리를 서는 자리에서 CAST_MIN~CAST_MAX 로 조이고, 물이 아니면 prev 그대로 */
  function clampReticle(sp, x, y, prev, wet) {
    wet = wet || wetAt;
    var vx = x - sp.x, vy = y - sp.y, d = Math.hypot(vx, vy) || 1e-9;
    var k = Math.max(CAST_MIN, Math.min(CAST_MAX, d)) / d;
    var q = { x: sp.x + vx * k, y: sp.y + vy * k };
    return wet(q.x, q.y) ? q : prev;
  }
  function inZone(cursor, c, w) { return Math.abs(cursor - c) <= w * 0.5; }
  function stars(id) { return new Array((FISH[id] ? FISH[id].star : 1) + 1).join('★'); }

  /* ── 낚시터 ───────────────────────────────────────────── */
  var spotMemo = null;
  function seedOf(def) {
    if (def.seed) { return { x: def.seed[0], y: def.seed[1] }; }
    var ST = global.DG.story, a = ST && ST.anchorOf ? ST.anchorOf(def.zone) : null;
    return a ? { x: a.x, y: a.y } : null;
  }
  /** 낚시터 넷(찾지 못한 것은 빠진다) — 세계가 같으면 늘 같다 */
  function spots() {
    if (spotMemo) { return spotMemo; }
    var out = [];
    SPOT_ORDER.forEach(function (id) {
      var def = SPOTS[id], s = seedOf(def), sh = s ? findShore(s.x, s.y, SHORE_R, null, def.zone ? TOWER_CLEAR : 0) : null;
      if (!sh) { return; }
      var o = { id: id, name: def.name, x: sh.x, y: sh.y, dx: sh.dx, dy: sh.dy, cx: sh.cx, cy: sh.cy, fish: def.fish };
      if (def.board) {
        var bx = sh.x - sh.dx * BOARD_OFF, by = sh.y - sh.dy * BOARD_OFF;
        if (wetAt(bx, by)) { bx = sh.x - sh.dy * BOARD_OFF; by = sh.y + sh.dx * BOARD_OFF; }
        o.board = { x: bx, y: by };
      }
      out.push(o);
    });
    spotMemo = out;
    return out;
  }
  function spotById(id) { var L = spots(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  function standR() { return STAND_R(gps()); }
  /** 서는 자리 둘레 안의 낚시터(가장 가까운 것) */
  function nearSpot(px, py) {
    if (!on()) { return null; }
    var L = spots(), best = null, bd = standR();
    for (var i = 0; i < L.length; i++) { var d = Math.hypot(L[i].x - px, L[i].y - py); if (d <= bd) { bd = d; best = L[i]; } }
    return best;
  }
  function boardSpot() { var L = spots(); for (var i = 0; i < L.length; i++) { if (L[i].board) { return L[i]; } } return null; }
  function nearBoard(px, py) { var b = on() && boardSpot(); return !!b && Math.hypot(b.board.x - px, b.board.y - py) <= standR(); }
  /** 지도·미니맵 — 탑을 찾은 지역의 낚시터만 */
  function mapSpots() {
    if (!on()) { return []; }
    var B = global.DG.biome;
    return spots().filter(function (s) { return !B || !B.on || !B.on() || B.found(B.regionAt(s.x, s.y).cell.key); });
  }

  /* ── 세이브 ───────────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.fish || typeof s.fish !== 'object') { s.fish = {}; }
    if (!s.fish.bag) { s.fish.bag = {}; }
    if (!s.fish.log) { s.fish.log = {}; }
    if (!s.fish.gone) { s.fish.gone = {}; }
    return s.fish;
  }
  function count(id) { var f = core().save.fish; return (f && f.bag && f.bag[id]) || 0; }
  function caughtOf(id) { var f = core().save.fish; return (f && f.log && f.log[id]) || 0; }
  function present(spotId, idx) {
    var f = core().save.fish, t = f && f.gone && f.gone[spotId + '_' + idx];
    return !t || nowFn() - t >= RESPAWN * 1000;
  }
  function left(spotId) { var n = 0; for (var i = 0; i < FISH_PER_SPOT; i++) { if (present(spotId, i)) { n++; } } return n; }
  function CK() { return global.DG.cooking || null; }
  function baitCount(b) { var c = CK(); return c ? c.count(b) : 0; }

  /* ── 물고기(이번 판만) ─────────────────────────────────── */
  var school = {};           // 낚시터 id → [{ idx, id, x, y, tx, ty, scared, wig }]
  function wanderPoint(sp) {
    for (var k = 0; k < 8; k++) {
      var a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * SWIM_R, x = sp.cx + Math.cos(a) * r, y = sp.cy + Math.sin(a) * r;
      if (wetAt(x, y)) { return { x: x, y: y }; }
    }
    return { x: sp.cx, y: sp.cy };
  }
  function fishOf(sp) {
    if (school[sp.id]) { return school[sp.id]; }
    var L = [];
    for (var i = 0; i < FISH_PER_SPOT; i++) {
      var p = wanderPoint(sp), t = wanderPoint(sp);
      L.push({ idx: i, id: sp.fish[i], x: p.x, y: p.y, tx: t.x, ty: t.y, scared: 0 });
    }
    school[sp.id] = L;
    return L;
  }

  /* ── 흐름 ─────────────────────────────────────────────── */
  function fresh() {
    return { state: 'idle', spot: null, bait: 'honey_flower', rx: 0, ry: 0, fx: 0, fy: 0, hooked: -1, t: 0, gap: 1, nibbles: 0,
      zoneC: 0.5, zoneW: 0.2, zoneTarget: 0.5, zoneT: 0, cursor: 0.5, cursorV: 0, progress: PROGRESS_START, holding: false, last: '', clock: 0 };
  }
  var st = fresh();
  function setState(s) { st.state = s; st.t = 0; dirty = true; }
  function FCs() { var F = global.DG.fieldCombat; return F && F.state ? F.state() : null; }
  function fighting() {
    var F = global.DG.fieldCombat, S = FCs(), p = core().save.player.pos;
    return !!(F && S && F.inCombat && F.inCombat(S, p.x, p.y));
  }
  /** 할 수 있나 — { ok, why, spot } */
  function beginCheck(id) {
    if (!on()) { return { ok: false, why: '낚시를 쓸 수 없다' }; }
    if (st.state !== 'idle') { return { ok: false, why: '이미 낚시 중이다' }; }
    var p = core().save.player.pos, sp = id ? spotById(id) : nearSpot(p.x, p.y);
    if (!sp || Math.hypot(sp.x - p.x, sp.y - p.y) > standR()) { return { ok: false, why: '낚시터 곁에서만 낚시할 수 있다' }; }
    if (fighting()) { return { ok: false, why: '싸우는 중엔 낚시할 수 없다' }; }
    return { ok: true, spot: sp };
  }
  function begin(id) {
    var c = beginCheck(id);
    if (!c.ok) { toast('🎣 ' + c.why); return false; }
    var b = st.bait;
    st = fresh();
    st.bait = b;
    st.spot = c.spot;
    st.rx = c.spot.cx; st.ry = c.spot.cy;
    fishOf(c.spot);
    setState('aim');
    closeBoard();
    return true;
  }
  function end() {
    if (st.state === 'idle') { return false; }
    releaseHooked(false);
    var b = st.bait, last = st.last;
    st = fresh();
    st.bait = b; st.last = last;
    dirty = true;
    return true;
  }
  function setBait(b) { if (!BAITS[b] || st.state === 'reel' || st.state === 'bite' || st.state === 'nibble') { return false; } st.bait = b; dirty = true; return true; }
  function moveReticle(dx, dy, dt) {
    if (st.state !== 'aim' || !(dx || dy)) { return false; }
    var len = Math.hypot(dx, dy) || 1, q = clampReticle(st.spot, st.rx + dx / len * RETICLE_SPEED * dt, st.ry + dy / len * RETICLE_SPEED * dt, { x: st.rx, y: st.ry });
    st.rx = q.x; st.ry = q.y;
    return true;
  }
  /** 고리를 서는 자리 기준으로 옮긴다 — along(멀리 +) · side(오른쪽 +). 폰 단추 */
  function nudge(along, side, dt) {
    var sp = st.spot;
    if (!sp) { return false; }
    return moveReticle(sp.dx * along - sp.dy * side, sp.dy * along + sp.dx * side, dt);
  }
  function cast() {
    if (st.state !== 'aim') { return false; }
    var c = CK();
    if (!c || c.count(st.bait) <= 0) { toast('🎣 ' + BAITS[st.bait] + '가 없다 — 재료를 모아 오자'); st.last = 'no_bait'; return false; }
    if (!wetAt(st.rx, st.ry)) { toast('🎣 물 위에 던져야 한다'); return false; }
    c.spend(st.bait, 1);
    st.fx = st.rx; st.fy = st.ry;
    st.hooked = -1;
    setState('wait');
    sfx('ui');
    core().persist();
    return true;
  }
  function reelIn(reason) {
    releaseHooked(false);
    if (reason) { toast('🎣 ' + reason); }
    setState('aim');
  }
  function releaseHooked(scared) {
    if (st.hooked < 0 || !st.spot) { st.hooked = -1; return; }
    var f = fishOf(st.spot)[st.hooked];
    if (f && scared) {
      f.scared = SCARE;
      var ax = f.x - st.fx, ay = f.y - st.fy, al = Math.hypot(ax, ay);
      if (al < 0.1) { ax = st.spot.dx; ay = st.spot.dy; al = 1; }
      f.tx = st.spot.cx + ax / al * SWIM_R * 0.9; f.ty = st.spot.cy + ay / al * SWIM_R * 0.9;
    }
    st.hooked = -1;
  }
  function scare() { st.last = 'scared'; releaseHooked(true); reelIn('너무 일찍 당겼다 — 물고기가 달아났다'); }
  function escape() { st.last = 'escaped'; releaseHooked(true); reelIn('놓쳤다…'); }
  function startReel() {
    var f = fishOf(st.spot)[st.hooked], d = FISH[f.id];
    st.zoneW = d.zone; st.zoneC = 0.5; st.zoneTarget = 0.5; st.zoneT = 0;
    st.cursor = 0.5; st.cursorV = 0; st.progress = PROGRESS_START;
    setState('reel');
  }
  function doCatch() {
    var sp = st.spot, f = fishOf(sp)[st.hooked], id = f.id, d = FISH[id], s = sv();
    var first = !s.log[id];
    s.bag[id] = (s.bag[id] || 0) + 1;
    s.log[id] = (s.log[id] || 0) + 1;
    s.gone[sp.id + '_' + f.idx] = nowFn();
    st.hooked = -1;
    st.last = 'caught:' + id;
    var H = global.DG.hero;
    if (H && H.awardParty) { H.awardParty(CATCH_EXP[d.star]); }
    toast('🐟 잡았다! ' + d.name + ' ' + stars(id) + ' · ' + d.era + (first ? ' — 처음 잡은 물고기' : ''));
    sfx(d.star >= 3 ? 'reward' : 'discover');
    core().emit('fish:caught', { id: id, spot: sp.id });
    core().persist();
    setState('aim');
  }
  /** 누름(true)·뗌(false) — F·스페이스·큰 단추 */
  function press(down) {
    if (!down) { st.holding = false; return true; }
    switch (st.state) {
      case 'aim': return cast();
      case 'wait': if (st.hooked >= 0) { scare(); } else { st.last = 'reeled'; reelIn(''); } return true;
      case 'nibble': scare(); return true;
      case 'bite': startReel(); st.holding = true; return true;
      case 'reel': st.holding = true; return true;
    }
    return false;
  }
  function pickApproacher() {
    var L = fishOf(st.spot), best = -1, bd = BITE_R;
    for (var i = 0; i < L.length; i++) {
      var f = L[i];
      if (!present(st.spot.id, f.idx) || f.scared > 0 || FISH[f.id].bait !== st.bait) { continue; }
      var d = Math.hypot(f.x - st.fx, f.y - st.fy);
      if (d < bd) { bd = d; best = i; }
    }
    st.hooked = best;
  }
  function tickSchool(sp, dt) {
    var L = fishOf(sp), mine = st.spot && st.spot.id === sp.id;
    for (var i = 0; i < L.length; i++) {
      var f = L[i];
      if (!present(sp.id, f.idx)) { continue; }
      f.scared = Math.max(0, f.scared - dt);
      var hk = mine && i === st.hooked;
      if (hk && st.state === 'reel') { f.x = st.fx + Math.sin(st.clock * 9) * 0.3; f.y = st.fy + Math.cos(st.clock * 7) * 0.3; continue; }
      var gx = hk && st.state !== 'aim' ? st.fx : f.tx, gy = hk && st.state !== 'aim' ? st.fy : f.ty, sp2 = hk ? APPROACH : SWIM;
      var vx = gx - f.x, vy = gy - f.y, d = Math.hypot(vx, vy);
      if (d < ARRIVE) {
        if (hk && st.state === 'wait') {
          st.nibbles = NIBBLE_MIN + Math.floor(rng() * (NIBBLE_MAX - NIBBLE_MIN + 1));
          setState('nibble');
          st.gap = rand(NIBBLE_GAP[0], NIBBLE_GAP[1]);
        } else if (!hk) { var w = wanderPoint(sp); f.tx = w.x; f.ty = w.y; }
      } else {
        var s = Math.min(sp2 * dt, d);
        f.x += vx / d * s; f.y += vy / d * s;
      }
    }
  }
  function tickReel(dt) {
    var d = FISH[fishOf(st.spot)[st.hooked].id];
    st.zoneT -= dt;
    if (st.zoneT <= 0) {
      st.zoneT = rand(d.move[0], d.move[1]);
      st.zoneTarget = rand(st.zoneW * 0.5, 1 - st.zoneW * 0.5);
    }
    var zs = dt * ZONE_SPEED, dz = st.zoneTarget - st.zoneC;
    st.zoneC += Math.abs(dz) <= zs ? dz : (dz > 0 ? zs : -zs);
    st.cursorV = Math.max(-PULL_VMAX, Math.min(PULL_VMAX, st.cursorV + (st.holding ? PULL_ACCEL : -PULL_ACCEL) * dt));
    st.cursor += st.cursorV * dt;
    if (st.cursor <= 0 || st.cursor >= 1) { st.cursor = Math.max(0, Math.min(1, st.cursor)); st.cursorV = 0; }
    st.progress += (inZone(st.cursor, st.zoneC, st.zoneW) ? d.gain : -d.loss) * dt;
    if (st.progress >= 1) { st.progress = 1; doCatch(); }
    else if (st.progress <= 0) { st.progress = 0; escape(); }
  }
  /** 한 틱 — 물고기·입질·줄다리기. 화면 없이도 돈다 */
  function step(dt) {
    if (!on() || !(dt > 0)) { return; }
    st.clock += dt;
    var p = core().save.player.pos;
    /* 곁의 낚시터 물고기는 늘 헤엄친다(그림) — 낚시 중인 곳은 따로 */
    var L = spots();
    for (var i = 0; i < L.length; i++) {
      if (st.spot && L[i].id === st.spot.id) { continue; }
      if (Math.hypot(L[i].cx - p.x, L[i].cy - p.y) < 90) { tickSchool(L[i], dt); }
    }
    if (st.state === 'idle') { return; }
    if (fighting()) { toast('🎣 적이 다가온다 — 낚시를 멈춘다'); st.last = 'fight'; end(); return; }
    if (Math.hypot(st.spot.x - p.x, st.spot.y - p.y) > standR() * 2) { st.last = 'left'; end(); return; }
    st.t += dt;
    tickSchool(st.spot, dt);
    if (st.state === 'wait') {
      if (st.hooked < 0) { pickApproacher(); }
      if (st.hooked < 0 && st.t > WAIT_MAX) { st.last = 'no_fish'; reelIn('물고기가 오지 않는다 — 다른 미끼나 자리로'); }
    } else if (st.state === 'nibble') {
      if (st.t >= st.gap) {
        st.t = 0; st.gap = rand(NIBBLE_GAP[0], NIBBLE_GAP[1]);
        st.nibbles -= 1;
        if (st.nibbles <= 0) { setState('bite'); toast('❗ 입질! — 지금 당겨라'); sfx('ui'); }
      }
    } else if (st.state === 'bite') {
      if (st.t > BITE_WINDOW) { escape(); }
    } else if (st.state === 'reel') {
      tickReel(dt);
    }
  }

  /* ── 낚시 조합 ───────────────────────────────────────── */
  function canExchange(i) {
    var row = EXCHANGE[i], k;
    if (!row) { return false; }
    for (k in row.cost) { if (row.cost.hasOwnProperty(k) && count(k) < row.cost[k]) { return false; } }
    if (row.weapon) {
      var WP = global.DG.weapon, r = WP && WP.rec ? WP.rec(row.weapon) : null;
      if (!WP || (r && WP.owned(row.weapon) && (r.ref || 1) >= WP.REFINE_MAX)) { return false; }
    }
    return true;
  }
  /** 바꾸기 — 받은 것 글(못 바꾸면 '') */
  function exchange(i) {
    if (!canExchange(i)) { return ''; }
    var row = EXCHANGE[i], b = sv().bag, k, got = [];
    for (k in row.cost) { if (row.cost.hasOwnProperty(k)) { b[k] -= row.cost[k]; if (!b[k]) { delete b[k]; } } }
    if (row.weapon) { got.push(global.DG.weapon.give(row.weapon)); }
    if (row.gold) { var P = core().save.player; P.gold = (P.gold || 0) + row.gold; got.push('🪙 금 +' + row.gold); }
    if (row.ore) { global.DG.weapon.addOre(row.ore); got.push('🪨 강화석 +' + row.ore); }
    if (row.mats && global.DG.talent) { got.push(global.DG.talent.addMats(row.mats)); }
    var txt = got.join(' · ');
    core().emit('changed');
    core().persist();
    toast('📋 바꿨다 — ' + txt);
    sfx('reward');
    return txt;
  }

  /* ── 3D (낚시터 빛·물고기 그림자·찌·줄·고리·게시판) ─────── */
  var fx = {}, glowTex = null, gear = null;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function gy(w, x, y) { return w.groundY ? w.groundY(x, y) : 0; }
  function glowSprite(T3, color, size, op) {
    if (!glowTex) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 64;
      var g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      glowTex = new T3.CanvasTexture(cv);
    }
    var s = new T3.Sprite(new T3.SpriteMaterial({ map: glowTex, color: color, transparent: true, depthWrite: false, opacity: op, blending: T3.AdditiveBlending, fog: false }));
    s.scale.set(size, size, size);
    return s;
  }
  function surfY(w, sp) { return gy(w, sp.cx, sp.cy) + 0.3; }
  function buildSpot(w, T3, sp) {
    var o = { root: new T3.Group(), fish: [] };
    o.halo = glowSprite(T3, 0x6ec8ff, 2.2, 0.35);
    o.halo.position.set(sp.x, gy(w, sp.x, sp.y) + 0.8, sp.y);
    o.root.add(o.halo);
    var sy = surfY(w, sp);
    fishOf(sp).forEach(function (f) {
      var d = FISH[f.id], m = new T3.Mesh(new T3.CircleGeometry(0.5, 12),
        new T3.MeshBasicMaterial({ color: 0x0b1a22, transparent: true, opacity: 0.5, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.scale.set(d.len * 1.6, d.len * 0.6, 1);
      m.position.y = sy - 0.12;
      o.root.add(m);
      o.fish.push(m);
    });
    if (sp.board) {
      var wood = new T3.MeshLambertMaterial({ color: 0x7a5a3a }), paper = new T3.MeshLambertMaterial({ color: 0xe8dcc0 });
      var bx = sp.board.x, by = sp.board.y, bgy = gy(w, bx, by), yaw = Math.atan2(sp.dx, sp.dy);
      var bg = new T3.Group();
      [-0.7, 0.7].forEach(function (ox) { var post = new T3.Mesh(new T3.BoxGeometry(0.12, 1.8, 0.12), wood); post.position.set(ox, 0.9, 0); bg.add(post); });
      var plank = new T3.Mesh(new T3.BoxGeometry(1.7, 0.9, 0.08), wood); plank.position.set(0, 1.35, 0); bg.add(plank);
      var note = new T3.Mesh(new T3.BoxGeometry(1.3, 0.6, 0.02), paper); note.position.set(0, 1.35, 0.05); bg.add(note);
      bg.position.set(bx, bgy, by); bg.rotation.y = yaw;
      o.root.add(bg);
    }
    w.addFx(o.root);
    return o;
  }
  function buildGear(w, T3) {
    var g = { root: new T3.Group() };
    g.bob = new T3.Mesh(new T3.SphereGeometry(0.12, 10, 8), new T3.MeshLambertMaterial({ color: 0xff4a3a }));
    g.root.add(g.bob);
    g.ring = new T3.Mesh(new T3.RingGeometry(0.55, 0.75, 24), new T3.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8, side: T3.DoubleSide, depthWrite: false }));
    g.ring.rotation.x = -Math.PI / 2;
    g.root.add(g.ring);
    var geo = new T3.BufferGeometry();
    geo.setAttribute('position', new T3.BufferAttribute(new Float32Array(6), 3));
    g.line = new T3.Line(geo, new T3.LineBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.7 }));
    g.root.add(g.line);
    w.addFx(g.root);
    return g;
  }
  function clearFx() {
    var w = W3();
    for (var k in fx) { if (fx.hasOwnProperty(k) && w) { w.removeFx(fx[k].root); } }
    fx = {};
    if (gear && w) { w.removeFx(gear.root); }
    gear = null;
  }
  function paint() {
    var w = W3();
    if (!w) { if (Object.keys(fx).length || gear) { fx = {}; gear = null; } return; }
    var T3 = w.three();
    if (!T3) { return; }
    var p = core().save.player.pos, L = spots(), seen = {}, i;
    for (i = 0; i < L.length; i++) {
      var sp = L[i];
      if (Math.hypot(sp.cx - p.x, sp.cy - p.y) > 90) { continue; }
      seen[sp.id] = true;
      var o = fx[sp.id] || (fx[sp.id] = buildSpot(w, T3, sp)), F = fishOf(sp);
      o.halo.material.opacity = st.state === 'idle' ? 0.3 + Math.sin(st.clock * 2.4) * 0.1 : 0;
      for (var j = 0; j < F.length; j++) {
        var m = o.fish[j];
        m.visible = present(sp.id, F[j].idx);
        m.position.x = F[j].x; m.position.z = F[j].y;
        m.rotation.z = -Math.atan2(F[j].ty - F[j].y, F[j].tx - F[j].x);
      }
    }
    for (var k in fx) { if (fx.hasOwnProperty(k) && !seen[k]) { w.removeFx(fx[k].root); delete fx[k]; } }
    if (st.state === 'idle') { if (gear) { gear.root.visible = false; } return; }
    if (!gear) { gear = buildGear(w, T3); }
    gear.root.visible = true;
    var sy = surfY(w, st.spot), aim = st.state === 'aim';
    gear.ring.visible = aim;
    gear.ring.position.set(st.rx, sy + 0.02, st.ry);
    gear.bob.visible = !aim;
    gear.line.visible = !aim;
    var dip = st.state === 'bite' ? 0.25 : st.state === 'nibble' ? Math.max(0, Math.sin(st.t * 14)) * 0.1 : st.state === 'reel' ? Math.abs(Math.sin(st.clock * 11)) * 0.12 : 0;
    gear.bob.position.set(st.fx, sy + 0.06 - dip, st.fy);
    var arr = gear.line.geometry.attributes.position.array, ph = gy(w, p.x, p.y) + 1.7;
    arr[0] = p.x + st.spot.dx * 1.2; arr[1] = ph + 0.6; arr[2] = p.y + st.spot.dy * 1.2;
    arr[3] = st.fx; arr[4] = sy + 0.1 - dip; arr[5] = st.fy;
    gear.line.geometry.attributes.position.needsUpdate = true;
  }

  /* ── 화면(단추·낚시 칸·게시판) ─────────────────────────── */
  var ui = { btn: null, hud: null, board: null, boardOpen: false, bound: false, keys: {}, nudge: null };
  var dirty = true;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var STATE_TEXT = {
    aim: '고리를 물 위로 옮기고(이동 키) 미끼를 골라 던진다',
    wait: '찌를 지켜본다 — 물고기가 다가온다',
    nibble: '톡톡… 건드린다 — 아직 당기지 말 것',
    bite: '입질! — 지금 당겨라',
    reel: '길게 눌러 찌를 올려 물고기 칸 안에 붙잡는다'
  };
  var ACT_TEXT = { aim: '🎣 던지기 (F)', wait: '거두기 (F)', nibble: '기다려…', bite: '❗ 당겨! (F)', reel: '당기기 — 길게 (F)' };
  function talkNear() { var ST = global.DG.story; return !!(ST && ST.nearTalk && ST.nearTalk()); }
  function busySheet() { return !!(document.body && document.body.classList.contains('sheet-open')); }
  function bindKeys() {
    if (ui.bound || !global.addEventListener) { return; }
    ui.bound = true;
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !on()) { return; }
      var k = (e.key || '').toLowerCase();
      if (st.state !== 'idle') {
        if (k === 'f' || k === ' ') { e.preventDefault(); if (!e.repeat) { press(true); } }
        else if (k === '1' || k === '2' || k === '3') { e.preventDefault(); setBait(BAIT_ORDER[+k - 1]); }
        else if (k === 'escape') { e.preventDefault(); end(); }
        else { ui.keys[k] = true; }
        return;
      }
      if (ui.boardOpen && k === 'escape') { closeBoard(); return; }
      if (k === 'f' && !e.repeat && !talkNear() && !busySheet()) {
        var p = core().save.player.pos;
        if (nearBoard(p.x, p.y)) { e.preventDefault(); if (ui.boardOpen) { closeBoard(); } else { openBoard(); } }
        else if (nearSpot(p.x, p.y)) { e.preventDefault(); begin(); }
      }
    });
    global.addEventListener('keyup', function (e) {
      var k = (e.key || '').toLowerCase();
      if (k === 'f' || k === ' ') { press(false); }
      ui.keys[k] = false;
    });
    global.addEventListener('blur', function () { ui.keys = {}; press(false); });
  }
  function keyDir() {
    var W = global.DG.world, km = W && W.keymap ? W.keymap() : {}, kk = ui.keys, dx = 0, dy = 0;
    if (kk.w || kk.arrowup || kk[km.up]) { dy -= 1; }
    if (kk.s || kk.arrowdown || kk[km.down]) { dy += 1; }
    if (kk.a || kk.arrowleft || kk[km.left]) { dx -= 1; }
    if (kk.d || kk.arrowright || kk[km.right]) { dx += 1; }
    return { dx: dx, dy: dy };
  }
  function paintBtn() {
    if (!document.body) { return; }
    if (!ui.btn) {
      ui.btn = document.createElement('button');
      ui.btn.id = 'fs-btn'; ui.btn.type = 'button';
      ui.btn.setAttribute('aria-label', '낚시');
      ui.btn.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        var p = core().save.player.pos;
        if (nearBoard(p.x, p.y)) { if (ui.boardOpen) { closeBoard(); } else { openBoard(); } } else { begin(); }
      });
      document.body.appendChild(ui.btn);
    }
    var p = core().save.player.pos, bd = nearBoard(p.x, p.y), sp = !bd && nearSpot(p.x, p.y);
    var show = st.state === 'idle' && !busySheet() && (bd || !!sp);
    ui.btn.classList.toggle('show', show);
    var html = bd ? '<span>📋</span><em>조합</em>' : '<span>🎣</span><em>낚시</em>';
    if (ui.btn.innerHTML !== html) { ui.btn.innerHTML = html; }
  }
  function renderHud() {
    if (!document.body) { return; }
    if (!ui.hud) {
      ui.hud = document.createElement('div');
      ui.hud.id = 'fs-hud';
      ui.hud.addEventListener('pointerdown', onHudDown);
      global.addEventListener('pointerup', onHudUp);
      global.addEventListener('pointercancel', onHudUp);
      document.body.appendChild(ui.hud);
    }
    var on2 = st.state !== 'idle';
    ui.hud.classList.toggle('show', on2);
    document.body.classList.toggle('fs-on', on2);
    if (!on2) { ui.hud.innerHTML = ''; return; }
    var sp = st.spot, out = '<div class="fs-head"><b>🎣 ' + esc(sp.name) + '</b><span>물고기 ' + left(sp.id) + '/' + FISH_PER_SPOT + '</span>' +
      '<button class="fs-x" data-fs="end" aria-label="그만">그만 ✕</button></div>';
    out += '<div class="fs-state">' + esc(STATE_TEXT[st.state] || '') + '</div>';
    out += '<div class="fs-baits">' + BAIT_ORDER.map(function (b, i) {
      var c = CK(), it = c && c.ITEMS[b];
      return '<button class="btn sm' + (st.bait === b ? ' primary' : ' ghost') + '" data-fs-bait="' + b + '">' + (i + 1) + ' ' + (it ? it.icon : '') + ' ' + esc(BAITS[b]) + ' ×' + baitCount(b) + '</button>';
    }).join('') + '</div>';
    if (st.state === 'reel') {
      out += '<div class="fs-track"><i class="fs-zone"></i><b class="fs-cur"></b></div><div class="fs-prog"><i></i></div>';
    }
    if (st.state === 'aim') {
      out += '<div class="fs-pad"><button class="btn sm ghost" data-fs-nudge="0,-1">◀</button><button class="btn sm ghost" data-fs-nudge="-1,0">가까이</button>' +
        '<button class="btn sm ghost" data-fs-nudge="1,0">멀리</button><button class="btn sm ghost" data-fs-nudge="0,1">▶</button></div>';
    }
    out += '<button class="btn primary wide fs-act" data-fs="act">' + ACT_TEXT[st.state] + '</button>';
    ui.hud.innerHTML = out;
  }
  function paintReel() {
    if (!ui.hud || st.state !== 'reel') { return; }
    var z = ui.hud.querySelector('.fs-zone'), c = ui.hud.querySelector('.fs-cur'), pg = ui.hud.querySelector('.fs-prog i');
    if (z) { z.style.left = ((st.zoneC - st.zoneW / 2) * 100) + '%'; z.style.width = (st.zoneW * 100) + '%'; z.classList.toggle('in', inZone(st.cursor, st.zoneC, st.zoneW)); }
    if (c) { c.style.left = (st.cursor * 100) + '%'; }
    if (pg) { pg.style.width = (st.progress * 100) + '%'; }
  }
  function onHudDown(e) {
    var t = e.target.closest ? e.target.closest('[data-fs],[data-fs-bait],[data-fs-nudge]') : null;
    if (!t) { return; }
    e.preventDefault(); e.stopPropagation();
    if (t.hasAttribute('data-fs-bait')) { setBait(t.getAttribute('data-fs-bait')); return; }
    if (t.hasAttribute('data-fs-nudge')) { var v = t.getAttribute('data-fs-nudge').split(','); ui.nudge = { a: +v[0], s: +v[1] }; return; }
    var a = t.getAttribute('data-fs');
    if (a === 'end') { end(); } else if (a === 'act') { press(true); }
  }
  function onHudUp() { ui.nudge = null; if (st.state === 'reel' || st.state === 'bite') { press(false); } }

  function renderBoard() {
    if (!ui.board) { return; }
    var out = '<div class="ck-head"><b>📋 낚시 조합</b><span>물고기를 바꾼다</span><button class="ck-x" data-fb="close" aria-label="닫기">✕</button></div>';
    out += '<div class="ck-mats">' + FISH_ORDER.map(function (id) {
      return '<span' + (count(id) ? '' : ' class="dim"') + '>🐟 ' + esc(FISH[id].name) + ' ' + stars(id) + ' ' + count(id) + (caughtOf(id) ? '' : ' · 아직 못 잡음') + '</span>';
    }).join('') + '</div>';
    EXCHANGE.forEach(function (row, i) {
      var cost = Object.keys(row.cost).map(function (k) { return FISH[k].name + ' ' + count(k) + '/' + row.cost[k]; }).join(' · ');
      out += '<div class="ck-row"><div class="ck-name"><b>' + esc(row.name) + '</b><small class="muted">' + esc(cost) + '</small></div>' +
        '<div class="ck-acts"><button class="btn ' + (canExchange(i) ? 'primary' : 'ghost') + '"' + (canExchange(i) ? '' : ' disabled') + ' data-fb="x" data-i="' + i + '">바꾸기</button></div></div>';
    });
    ui.board.innerHTML = '<div class="ck-card">' + out + '</div>';
  }
  function openBoard() {
    if (!document.body || !on()) { return false; }
    if (!ui.board) {
      ui.board = document.createElement('div');
      ui.board.id = 'fs-board';
      ui.board.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-fb]') : null;
        if (!b) { if (e.target === ui.board) { closeBoard(); } return; }
        if (b.getAttribute('data-fb') === 'close') { closeBoard(); return; }
        exchange(+b.getAttribute('data-i'));
        renderBoard();
      });
      document.body.appendChild(ui.board);
    }
    ui.boardOpen = true;
    ui.board.classList.add('show');
    renderBoard();
    return true;
  }
  function closeBoard() { ui.boardOpen = false; if (ui.board) { ui.board.classList.remove('show'); } }

  var lastState = '';
  function tick(dt) {
    if (!core() || !core().save) { return; }
    if (!on()) { if (st.state !== 'idle') { end(); } clearFx(); return; }
    if (st.state === 'aim') {
      var kd = keyDir();
      if (kd.dx || kd.dy) { moveReticle(kd.dx, kd.dy, dt); }
      else if (ui.nudge) { nudge(ui.nudge.a, ui.nudge.s, dt); }
    }
    step(dt);
    if (global.DG_NO_DRAW) { return; }
    bindKeys();
    if (dirty || st.state !== lastState) { dirty = false; lastState = st.state; renderHud(); }
    paintReel();
    paintBtn();
    paint();
  }

  global.DG = global.DG || {};
  global.DG.fishing = {
    FISH: FISH, FISH_ORDER: FISH_ORDER, BAITS: BAITS, BAIT_ORDER: BAIT_ORDER, SPOTS: SPOTS, SPOT_ORDER: SPOT_ORDER, EXCHANGE: EXCHANGE,
    FISH_PER_SPOT: FISH_PER_SPOT, RESPAWN: RESPAWN, CAST_MIN: CAST_MIN, CAST_MAX: CAST_MAX, CAST_OFF: CAST_OFF, BITE_R: BITE_R, SWIM_R: SWIM_R,
    BITE_WINDOW: BITE_WINDOW, WAIT_MAX: WAIT_MAX, SCARE: SCARE, PROGRESS_START: PROGRESS_START, CATCH_EXP: CATCH_EXP, BOARD_OFF: BOARD_OFF, STAND_R: STAND_R, TOWER_CLEAR: TOWER_CLEAR,
    /* 판정 층(순수) */
    wetAt: wetAt, findShore: findShore, clampReticle: clampReticle, inZone: inZone, stars: stars,
    /* 낚시터·세이브 */
    spots: spots, spotById: spotById, nearSpot: nearSpot, nearBoard: nearBoard, mapSpots: mapSpots, count: count, caughtOf: caughtOf, present: present, left: left,
    school: function (id) { var sp = spotById(id); return sp ? fishOf(sp) : []; },
    /* 흐름 */
    beginCheck: beginCheck, begin: begin, end: end, setBait: setBait, moveReticle: moveReticle, nudge: nudge, cast: cast, press: press, step: step,
    canExchange: canExchange, exchange: exchange,
    state: function () { return st; },
    get active() { return st.state !== 'idle'; },
    /* 런타임 */
    tick: tick, openBoard: openBoard, closeBoard: closeBoard,
    _setNowForTest: function (fn) { nowFn = fn || function () { return Date.now(); }; },
    _resetForTest: function (keepSpots) { st = fresh(); school = {}; rng = mulberry32(20260824); dirty = true; if (!keepSpots) { spotMemo = null; } }
  };
})(window);
