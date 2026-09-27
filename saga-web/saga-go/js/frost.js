/**
 * 서리봉 고원 — 넷째 지역, 이야기 2부 무대 (PLAN §5 ⑲-27, saga-godot PLAN 106 ㊺-1)
 * ---------------------------------------------------------------
 *   땅      ⑮ 북방 설산(바깥 고리 북쪽) — 고향에 가장 가까운 그 땅 칸(북풍 고개, 약 6km 북)이 고원 가운데
 *   눈      그 땅 전체가 눈밭(world3d `terrainTexture` 가 `snowCell` 을 묻는다 — 물·길 빼고) · 그 땅 안에서만 눈이 내린다
 *           (입자 SNOW_N — 이야기 12장을 마치면 SNOW_CALM, ⑲-30) · 그 땅 안이면 조명 천후가 `snow`(world3d `weatherKey` 가 `snowingHere` 를 묻는다)
 *   명소    다섯 — 옛 산성 터(과거)·기상 관측소(현대)·추락한 비행선(미래)·얼어붙은 호수·고개 경계비. 30m 안 = 발견
 *   발견    작은 발견 일곱(위성 조각·장수 석상·사냥꾼 오두막·눈사람·케이블카·얼음굴·봉화) — 14m(GPS 30m) 안
 *   이동    서리 고개(경계비)·기상 관측소 — 찾으면 지도(M) 순간이동 지점(키보드 판만)
 *   눈꽃    고원 특산물 채집 자리 셋(북서·가운데·동쪽, ⑲-32) — 자리만 여기서 잡고 채집은 cooking.js 가 한다
 *   눈 나무 고원 땅 나무는 위를 보는 잎·가지에 눈(⑲-33, `treeSnow` → world3d `instGlb` → prop3d `snowOf` 셰이더)
 *   벽      산성 담·관측소·비행선·오두막·석상·경계비는 world3d `houseRects` 로 막는다(산성은 남쪽 문으로 든다)
 *
 * 자리는 가운데에서 어긋난 곳(off)에서 가장 가까운 들·숲 칸(물·마을·길·산·강 아님, 같은 땅, 서로 떨어짐) — 해시·지형만, 늘 같다.
 * 판정 층(`center`·`sites`·`snowAt`·`rectsIn`)은 순수. 세이브 `save.frost = { found }`(읽는 쪽 기본값).
 * 그림은 코드 도형(SAGA-DESIGN §7) — 전용 에셋은 밖.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('frost.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var ZONE = 'snowfort';
  /* off = 가운데에서(m, +y 남쪽). way = 순간이동 지점 이름 */
  var LANDMARKS = [
    { id: 'fort',  name: '옛 산성 터',       era: '과거', off: [150, -250], model: 'fort' },
    { id: 'obs',   name: '기상 관측소',      era: '현대', off: [300, -120], model: 'obs', way: '기상 관측소' },
    { id: 'ship',  name: '추락한 비행선',    era: '미래', off: [220, 260],  model: 'ship' },
    { id: 'lake',  name: '얼어붙은 호수',    era: '과거', off: [0, 380],    model: 'lake' },
    { id: 'stele', name: '서리 고개 경계비', era: '과거', off: [-60, 520],  model: 'stele', way: '서리 고개' }
  ];
  var SMALL = [
    { id: 'sat',     name: '떨어진 위성 조각', era: '미래', off: [400, 350],   model: 'sat' },
    { id: 'statue',  name: '장수 석상',        era: '과거', off: [-200, 250],  model: 'statue' },
    { id: 'hut',     name: '사냥꾼 오두막',    era: '과거', off: [100, -400],  model: 'hut' },
    { id: 'snowman', name: '누가 만든 눈사람', era: '현대', off: [-80, 180],   model: 'snowman' },
    { id: 'cable',   name: '멈춘 케이블카',    era: '현대', off: [420, -300],  model: 'cable' },
    { id: 'cave',    name: '얼음굴 어귀',      era: '과거', off: [-280, -80],  model: 'cave' },
    { id: 'beacon',  name: '고원 봉화',        era: '과거', off: [250, 60],    model: 'beacon' }
  ];
  /* ⑲-32 눈꽃 자리 셋(saga-godot 106 ㊻-3 PATCHES — 북서·가운데·동쪽). 명소·발견과 SEP_SMALL 넘게 */
  var BLOOM_OFF = [[-340, -300], [120, 140], [460, 60]];
  var LANDMARK_R = 30, SMALL_R = function (g) { return g ? 30 : 14; };
  var REWARD_BIG = { gold: 150, dust: 2, exp: 40 }, REWARD_SMALL = { gold: 60, exp: 20 };
  var SEARCH_STEP = 8, SEARCH_R = 200, SEP_BIG = 60, SEP_SMALL = 30, TOWER_CLEAR = 40;
  var LAKE_R = 28, FORT_SIDE = 26, FORT_GATE = 5, WALL_T = 1.2;
  var SNOW_N = 260, SNOW_BOX = 22, SNOW_H = 14, SNOW_FALL = 1.3;
  var GRID = 48;

  /* ── 자리(순수 — 지형·해시만) ───────────────────────────── */
  var memo = null, snowMemo = {}, snowN = 0;
  function terr(x, y) { var W = global.DG.world; try { return W && W.terrainAt ? W.terrainAt(Math.floor(x / GRID), Math.floor(y / GRID)) : null; } catch (e) { return null; } }
  function zoneAt(x, y) { var B = BM(); return B ? B.regionAt(x, y).cell.zone : null; }
  /** 고원 가운데 — 고향에 가장 가까운 북방 설산 칸 { key, x, y, name } 또는 null */
  function center() {
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
  /** 가운데 c 에서 off 만큼 간 곳에서 가장 가까운 좋은 자리 — 이미 놓은 것(taken)과 sep 넘게 */
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
  /** 명소 다섯 + 작은 발견 일곱 — [{ id, name, era, model, big, x, y, way? }]. 세계가 같으면 늘 같다 */
  function sites() {
    if (memo) { return memo; }
    var c = center(), out = [];
    if (!c) { memo = []; return memo; }
    LANDMARKS.forEach(function (d) {
      var p = placeNear(c, d.off, out, SEP_BIG, d.model === 'lake' ? LAKE_R : (d.model === 'fort' ? FORT_SIDE / 2 : 0));
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: true, x: p.x, y: p.y, way: d.way || null, forced: !!p.forced });
    });
    SMALL.forEach(function (d) {
      var p = placeNear(c, d.off, out, SEP_SMALL, 0);
      out.push({ id: d.id, name: d.name, era: d.era, model: d.model, big: false, x: p.x, y: p.y, forced: !!p.forced });
    });
    memo = out;
    return out;
  }
  /** ⑲-32 눈꽃 자리 셋 — [{ x, y }]. 명소·발견·탑을 비켜 가장 가까운 좋은 자리, 세계가 같으면 늘 같다 */
  var bloomMemo = null;
  function bloomSpots() {
    if (bloomMemo) { return bloomMemo; }
    var c = center();
    if (!c) { return []; }
    var taken = sites().slice(), out = [];
    BLOOM_OFF.forEach(function (off) {
      var p = placeNear(c, off, taken, SEP_SMALL, 0), q = { x: p.x, y: p.y, big: false };
      taken.push(q); out.push({ x: p.x, y: p.y });
    });
    bloomMemo = out;
    return out;
  }
  function siteById(id) { var L = sites(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }

  /** 이 자리가 눈 땅(북방 설산)인가 */
  function snowAt(x, y) { return on() && zoneAt(x, y) === ZONE; }
  /** ⑲-33 이 자리 나무의 눈 양(0~1) — 고원 땅이면 손잡이 frost.treeSnow(기본 0.7, saga-godot 106 ㊻-4 REGION_TREE_SNOW), 아니면 0.
      화면에서 한 단계로만 쓰도록 소수 한 자리로 자른다(재질·덩이가 값마다 갈린다) */
  function treeSnow(x, y) {
    if (!snowAt(x, y)) { return 0; }
    var v = Math.max(0, Math.min(1, +K('treeSnow', 0.7) || 0));
    return Math.round(v * 10) / 10;
  }
  /** 땅빛 격자 한 칸(48m)이 눈밭인가 — world3d terrainTexture 가 칸마다 묻는다(캐시) */
  function snowCell(gx, gy) {
    var k = gx + ',' + gy;
    if (snowMemo.hasOwnProperty(k)) { return snowMemo[k]; }
    if (snowN > 20000) { snowMemo = {}; snowN = 0; }
    var v = snowAt((gx + 0.5) * GRID, (gy + 0.5) * GRID);
    snowMemo[k] = v; snowN++;
    return v;
  }
  var hereT = -1, hereV = false;
  /** 내가 눈 땅 안인가(0.5초 캐시) — 조명 천후·눈 입자 */
  function snowingHere() {
    if (!on() || !core() || !core().save) { return false; }
    var t = Date.now();
    if (t - hereT > 500 || hereT < 0) { var p = core().save.player.pos; hereV = snowAt(p.x, p.y); hereT = t; }
    return hereV;
  }
  /** ⑲-30 이야기 12장(별배 심장)을 마쳤으면 눈이 잦아든다 — 12장이 끝난 뒤(save.story.ch 가 그 장 다음) */
  var CALM_AFTER = 'ch12', SNOW_CALM = 60;
  function calm() {
    var ST = global.DG.story, s = core() && core().save ? core().save.story : null;
    if (!ST || !ST.CHAPTERS || !s) { return false; }
    for (var i = 0; i < ST.CHAPTERS.length; i++) { if (ST.CHAPTERS[i].id === CALM_AFTER) { return s.ch > i; } }
    return false;
  }
  /** ⑲-36 이야기 15장(날개 조각 셋)을 마쳤으면 별배가 떴다 — 선체가 FLY_H m 위로 수평으로, 선체 벽은 사라진다(파편은 땅에) */
  var FLY_AFTER = 'ch15', FLY_H = 9, FLY_T = 4;
  function flown() {
    var ST = global.DG.story, s = core() && core().save ? core().save.story : null;
    if (!ST || !ST.CHAPTERS || !s) { return false; }
    for (var i = 0; i < ST.CHAPTERS.length; i++) { if (ST.CHAPTERS[i].id === FLY_AFTER) { return s.ch > i; } }
    return false;
  }
  /** ⑲-38 별배가 은하 나루로 떠났나 — 16장 여섯째 단계부터(선체를 숨긴다, 파편은 남음) */
  function away() { var SP = global.DG.skyport; return !!(SP && SP.on && SP.on() && SP.docked && SP.docked()); }
  /** 지금 내리는 눈 입자 수 */
  function snowCount() { return calm() ? SNOW_CALM : SNOW_N; }

  /* ── 벽(월드 좌표 사각형 — world3d houseRects 가 격자 칸마다 가져간다) ─ */
  var rectMemo = null;
  function rotRect(cx, cy, lx, ly, w, d, rot) {
    var c = Math.cos(rot), s = Math.sin(rot);
    return { x: cx + lx * c - ly * s, z: cy + lx * s + ly * c, w: w, d: d, rot: rot };
  }
  /** 명소 하나의 벽 사각형들 */
  function rectsOf(st) {
    var x = st.x, y = st.y, h = FORT_SIDE / 2, g = FORT_GATE / 2, seg = (FORT_SIDE - FORT_GATE) / 2;
    switch (st.model) {
      case 'fort': return [
        { x: x, z: y - h, w: FORT_SIDE, d: WALL_T, rot: 0 },                                // 북
        { x: x - h, z: y, w: WALL_T, d: FORT_SIDE, rot: 0 },                                // 서
        { x: x + h, z: y, w: WALL_T, d: FORT_SIDE, rot: 0 },                                // 동
        { x: x - g - seg / 2, z: y + h, w: seg, d: WALL_T, rot: 0 },                        // 남(문 왼쪽)
        { x: x + g + seg / 2, z: y + h, w: seg, d: WALL_T, rot: 0 }                         // 남(문 오른쪽)
      ];
      case 'obs': return [{ x: x, z: y, w: 6.4, d: 6.4, rot: 0 }];
      case 'ship': { var sr = rotRect(x, y, 0, 0, 22, 5.2, 0.5); sr.hull = true; return [sr]; }   // ⑲-36 떠오르면 빠진다
      case 'stele': return [{ x: x, z: y, w: 1.6, d: 0.9, rot: 0 }];
      case 'hut': return [{ x: x, z: y, w: 4.4, d: 4.4, rot: 0.3 }];
      case 'statue': return [{ x: x, z: y, w: 1.6, d: 1.6, rot: 0 }];
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
    return L.some(function (r) { return r.hull; }) && flown() ? L.filter(function (r) { return !r.hull; }) : L;
  }

  /* ── 세이브·발견 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.frost || typeof s.frost !== 'object') { s.frost = {}; }
    if (!s.frost.found || typeof s.frost.found !== 'object') { s.frost.found = {}; }
    return s.frost;
  }
  function found(id) { var f = core().save.frost; return !!(f && f.found && f.found[id]); }
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
      toast((st.big ? '🏔️ 명소 발견 — ' : '❄️ 작은 발견 — ') + st.name + ' (' + st.era + ') · 금 +' + r.gold + (st.way ? ' · 순간이동 지점' : ''));
      c.log('🏔️ 서리봉 고원 — ' + st.name + ' 발견', 'discover');
      c.emit('frost:found', { id: st.id, big: st.big });
    });
    if (out.length) { sfx('discover'); core().persist(); }
    return out;
  }
  /** 순간이동 지점 — 찾은 경계비·관측소 [{ key, x, y, name }] */
  function waypoints() {
    if (!on()) { return []; }
    return sites().filter(function (st) { return st.way && found(st.id); }).map(function (st) {
      return { key: 'fr:' + st.id, x: st.x, y: st.y + 8, name: '🏔️ ' + st.way };
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
    core().emit('region:teleport', { key: 'fr:' + id });
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
  var fx = {}, snow = null, clock = 0;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function gyAt(w, x, y) { return w.groundY ? w.groundY(x, y) : 0; }
  var mats = null;
  function M(T3) {
    if (mats) { return mats; }
    mats = {
      stone: new T3.MeshLambertMaterial({ color: 0x8d8a84 }), stoneD: new T3.MeshLambertMaterial({ color: 0x6d6a66 }),
      wood: new T3.MeshLambertMaterial({ color: 0x6b4a2e }), roof: new T3.MeshLambertMaterial({ color: 0x3e4652 }),
      white: new T3.MeshLambertMaterial({ color: 0xe8edf2 }), steel: new T3.MeshStandardMaterial({ color: 0xc8d0d8, metalness: 0.7, roughness: 0.35 }),
      dark: new T3.MeshLambertMaterial({ color: 0x2a2f38 }), glow: new T3.MeshBasicMaterial({ color: 0x66f2ff }),
      panel: new T3.MeshStandardMaterial({ color: 0x1f3a66, metalness: 0.4, roughness: 0.3 }), red: new T3.MeshLambertMaterial({ color: 0xc8402e }),
      snow: new T3.MeshLambertMaterial({ color: 0xf4f8fb }), carrot: new T3.MeshLambertMaterial({ color: 0xf08a2a }),
      ice: new T3.MeshLambertMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.92, emissive: 0x16303c }),
      fire: new T3.MeshBasicMaterial({ color: 0xffa040 })
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function cyl(T3, g, m, r1, r2, h, x, y, z, seg) { var o = new T3.Mesh(new T3.CylinderGeometry(r1, r2, h, seg || 14), m); o.position.set(x, y, z); g.add(o); return o; }
  function ball(T3, g, m, r, x, y, z) { var o = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; }
  function build(w, T3, st) {
    var m = M(T3), g = new T3.Group(), o = { root: g, spin: null }, i;
    var y0 = gyAt(w, st.x, st.y);
    switch (st.model) {
      case 'fort': {
        var h = FORT_SIDE / 2, seg = (FORT_SIDE - FORT_GATE) / 2, gt = FORT_GATE / 2;
        box(T3, g, m.stone, FORT_SIDE, 3.2, WALL_T, 0, 1.6, -h);
        box(T3, g, m.stone, WALL_T, 3.2, FORT_SIDE, -h, 1.6, 0);
        box(T3, g, m.stone, WALL_T, 3.2, FORT_SIDE, h, 1.6, 0);
        box(T3, g, m.stone, seg, 3.2, WALL_T, -gt - seg / 2, 1.6, h);
        box(T3, g, m.stone, seg, 3.2, WALL_T, gt + seg / 2, 1.6, h);
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.stoneD, 1.4, 5.2, 1.4, i * (gt + 0.7), 2.6, h); }   // 문루 기둥
        box(T3, g, m.wood, FORT_GATE + 3, 0.5, 2.4, 0, 5.4, h);                                         // 문루 마루
        box(T3, g, m.roof, FORT_GATE + 4, 0.9, 3.2, 0, 6.1, h);
        box(T3, g, m.stoneD, 5, 2.2, 5, -h + 4, 1.1, -h + 4);                                            // 망루 돌단
        box(T3, g, m.snow, FORT_SIDE + 0.4, 0.25, WALL_T + 0.3, 0, 3.3, -h);
        break;
      }
      case 'obs': {
        cyl(T3, g, m.white, 3, 3.2, 5, 0, 2.5, 0, 20);
        var dome = new T3.Mesh(new T3.SphereGeometry(3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.steel); dome.position.set(0, 5, 0); g.add(dome);
        cyl(T3, g, m.steel, 0.12, 0.18, 12, 4.2, 6, 0, 6);                                               // 전파 탑
        for (i = 0; i < 4; i++) { cyl(T3, g, m.steel, 0.05, 0.05, 1.2, 4.2, 2 + i * 2.6, 0, 4).rotation.z = Math.PI / 2; }
        var spin = new T3.Group(); spin.position.set(4.2, 12.2, 0); g.add(spin);                     // 풍속계
        for (i = 0; i < 3; i++) {
          var arm = new T3.Mesh(new T3.BoxGeometry(1.1, 0.06, 0.06), m.steel); arm.position.set(Math.cos(i * 2.094) * 0.55, 0, Math.sin(i * 2.094) * 0.55); arm.rotation.y = -i * 2.094; spin.add(arm);
          var cup = new T3.Mesh(new T3.SphereGeometry(0.16, 8, 6), m.red); cup.position.set(Math.cos(i * 2.094) * 1.1, 0, Math.sin(i * 2.094) * 1.1); spin.add(cup);
        }
        o.spin = spin;
        var pn = box(T3, g, m.panel, 3.2, 0.12, 2, -4.6, 1.4, 0); pn.rotation.z = 0.5;
        box(T3, g, m.steel, 0.15, 1.2, 0.15, -4.6, 0.6, 0);
        box(T3, g, m.dark, 1.4, 2.2, 0.1, 0, 1.1, 3.15);                                                  // 문
        break;
      }
      case 'ship': {
        var hull = new T3.Group(); hull.rotation.y = -0.5; hull.rotation.z = 0.2; g.add(hull);
        var body = new T3.Mesh(new T3.CylinderGeometry(2.6, 2.2, 18, 20), m.steel); body.rotation.z = Math.PI / 2; body.position.set(0, 2.2, 0); hull.add(body);
        ball(T3, hull, m.steel, 2.6, 9, 2.2, 0);
        var strip = new T3.Mesh(new T3.BoxGeometry(17, 0.18, 0.2), m.glow); strip.position.set(0, 2.2, 2.62); hull.add(strip);
        var strip2 = strip.clone(); strip2.position.z = -2.62; hull.add(strip2);
        box(T3, hull, m.steel, 3, 3.4, 0.25, -9.5, 4.3, 0);                                               // 꼬리 날개
        box(T3, hull, m.steel, 3, 0.25, 6, -9.5, 2.4, 0);
        var wings = new T3.Group(); wings.visible = false; hull.add(wings);                              // ⑲-36 빛 날개 셋(뜬 뒤)
        for (i = 0; i < 3; i++) {
          var wg = new T3.Mesh(new T3.BoxGeometry(2.4, 0.08, 7 - i * 1.5), m.glow);
          wg.position.set(3 - i * 3.2, 2.4 + i * 0.3, 0); wg.rotation.x = i === 1 ? 0 : 0.05; wings.add(wg);
        }
        o.hull = hull; o.wings = wings; o.lift = flown() ? FLY_H : 0;
        for (i = 0; i < 6; i++) { box(T3, g, i % 2 ? m.steel : m.dark, 0.6 + (i % 3) * 0.5, 0.3, 0.8 + (i % 2) * 0.6, -6 + i * 3.1, 0.15, 5 + (i % 3) * 1.4, i); }   // 파편
        break;
      }
      case 'lake': {
        var geo = new T3.RingGeometry(0.01, LAKE_R, 36, 6), pa = geo.attributes.position;
        for (i = 0; i < pa.count; i++) { var lx = pa.getX(i), lz = -pa.getY(i); pa.setZ(i, gyAt(w, st.x + lx, st.y + lz) - y0 + 0.08); }
        pa.needsUpdate = true; geo.computeVertexNormals();
        var ice = new T3.Mesh(geo, m.ice); ice.rotation.x = -Math.PI / 2; g.add(ice);
        break;
      }
      case 'stele': {
        box(T3, g, m.stoneD, 1.8, 0.4, 1.1, 0, 0.2, 0);
        box(T3, g, m.stone, 1.2, 2.6, 0.5, 0, 1.7, 0);
        box(T3, g, m.snow, 1.3, 0.18, 0.6, 0, 3.05, 0);
        break;
      }
      case 'sat': {
        var dish = new T3.Mesh(new T3.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), m.steel); dish.rotation.x = 2.3; dish.position.set(0, 0.9, 0); g.add(dish);
        box(T3, g, m.panel, 3, 0.1, 1.2, 1.8, 0.3, 0.6, 0.4);
        box(T3, g, m.glow, 0.3, 0.3, 0.3, 0, 0.3, 0);
        break;
      }
      case 'statue': {
        box(T3, g, m.stoneD, 1.4, 0.5, 1.4, 0, 0.25, 0);
        box(T3, g, m.stone, 0.9, 1.6, 0.6, 0, 1.3, 0);
        ball(T3, g, m.stone, 0.35, 0, 2.4, 0);
        box(T3, g, m.stone, 0.12, 2.2, 0.12, 0.6, 1.5, 0.1);                                               // 창
        break;
      }
      case 'hut': {
        var hut = new T3.Group(); hut.rotation.y = 0.3; g.add(hut);
        box(T3, hut, m.wood, 4, 2.4, 4, 0, 1.2, 0);
        var rf = new T3.Mesh(new T3.ConeGeometry(3.4, 1.8, 4), m.snow); rf.position.set(0, 3.3, 0); rf.rotation.y = Math.PI / 4; hut.add(rf);
        box(T3, hut, m.dark, 1, 1.6, 0.1, 0, 0.8, 2.02);
        break;
      }
      case 'snowman': {
        ball(T3, g, m.snow, 0.7, 0, 0.6, 0); ball(T3, g, m.snow, 0.5, 0, 1.55, 0); ball(T3, g, m.snow, 0.35, 0, 2.25, 0);
        var nose = new T3.Mesh(new T3.ConeGeometry(0.07, 0.35, 8), m.carrot); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.25, 0.45); g.add(nose);
        box(T3, g, m.red, 0.9, 0.12, 0.12, 0, 1.95, 0);
        break;
      }
      case 'cable': {
        for (i = -1; i <= 1; i += 2) { box(T3, g, m.steel, 0.5, 9, 0.5, i * 7, 4.5, 0); box(T3, g, m.steel, 2, 0.3, 0.3, i * 7, 9, 0); }
        box(T3, g, m.dark, 14, 0.05, 0.05, 0, 8.7, 0);
        box(T3, g, m.red, 1.8, 1.5, 1.4, 1.5, 7, 0);
        box(T3, g, m.steel, 0.08, 1, 0.08, 1.5, 8.2, 0);
        break;
      }
      case 'cave': {
        var arch = new T3.Mesh(new T3.TorusGeometry(2.2, 0.9, 8, 14, Math.PI), m.stoneD); arch.position.set(0, 0, 0); g.add(arch);
        box(T3, g, m.dark, 3.2, 2, 0.2, 0, 1, -0.3);
        for (i = 0; i < 4; i++) { var ic = new T3.Mesh(new T3.ConeGeometry(0.15, 0.7, 6), m.ice); ic.rotation.x = Math.PI; ic.position.set(-1.2 + i * 0.8, 2.3, 0.2); g.add(ic); }
        break;
      }
      case 'beacon': {
        cyl(T3, g, m.stone, 1.2, 1.5, 2.2, 0, 1.1, 0, 10);
        var fl = new T3.Mesh(new T3.ConeGeometry(0.6, 1.2, 8), m.fire); fl.position.set(0, 2.8, 0); g.add(fl);
        o.flame = fl;
        break;
      }
    }
    g.position.set(st.x, y0, st.y);
    w.addFx(g);
    return o;
  }
  function buildSnow(w, T3) {
    var pos = new Float32Array(SNOW_N * 3);
    for (var i = 0; i < SNOW_N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SNOW_BOX * 2; pos[i * 3 + 1] = Math.random() * SNOW_H; pos[i * 3 + 2] = (Math.random() - 0.5) * SNOW_BOX * 2;
    }
    var geo = new T3.BufferGeometry();
    geo.setAttribute('position', new T3.BufferAttribute(pos, 3));
    var pts = new T3.Points(geo, new T3.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.85, depthWrite: false }));
    pts.frustumCulled = false;
    w.addFx(pts);
    return pts;
  }
  function paint(dt) {
    clock += dt || 0;
    var w = W3();
    if (!w) { fx = {}; snow = null; return; }
    var T3 = w.three();
    if (!T3) { return; }
    var p = core().save.player.pos, seen = {}, L = sites(), i;
    for (i = 0; i < L.length; i++) {
      var st = L[i];
      if (Math.hypot(st.x - p.x, st.y - p.y) > 260) { continue; }
      seen[st.id] = true;
      var o = fx[st.id] || (fx[st.id] = build(w, T3, st));
      if (o.spin) { o.spin.rotation.y += (dt || 0) * 3.2; }
      if (o.flame) { o.flame.scale.set(1, 0.85 + Math.sin(clock * 9) * 0.15, 1); }
      if (o.hull) {                                                                                       // ⑲-36 별배 — 지켜보면 FLY_T 초에 걸쳐 떠오른다
        var goal = flown() ? FLY_H : 0;
        o.lift = goal > o.lift ? Math.min(goal, o.lift + FLY_H / FLY_T * (dt || 0)) : goal;
        var k = o.lift / FLY_H;
        o.hull.position.y = o.lift + (k > 0 ? Math.sin(clock * 0.9) * 0.3 * k : 0);
        o.hull.rotation.z = 0.2 * (1 - k);
        o.wings.visible = k > 0;
        o.hull.visible = !away();
      }
    }
    for (var k in fx) { if (fx.hasOwnProperty(k) && !seen[k]) { w.removeFx(fx[k].root); delete fx[k]; } }
    var here = snowingHere();
    if (here && !snow) { snow = buildSnow(w, T3); }
    if (snow) {
      snow.visible = here;
      if (here) {
        var a = snow.geometry.attributes.position.array, sn = snowCount();
        if (snow.geometry.setDrawRange) { snow.geometry.setDrawRange(0, sn); }
        for (i = 0; i < sn; i++) {
          a[i * 3 + 1] -= SNOW_FALL * (dt || 0) * (0.7 + (i % 5) * 0.12);
          a[i * 3] += Math.sin(clock * 0.8 + i) * 0.3 * (dt || 0);
          if (a[i * 3 + 1] < 0) { a[i * 3 + 1] += SNOW_H; }
        }
        snow.geometry.attributes.position.needsUpdate = true;
        snow.position.set(p.x, gyAt(w, p.x, p.y), p.y);
      }
    }
  }

  var acc = 0;
  function tick(dt) {
    if (!core() || !core().save || !on()) { return; }
    acc += dt || 0;
    if (acc >= 0.25) { acc = 0; var p = core().save.player.pos; discoverAt(p.x, p.y); }
    if (!global.DG_NO_DRAW) { paint(dt); }
  }

  global.DG = global.DG || {};
  global.DG.frost = {
    ZONE: ZONE, LANDMARKS: LANDMARKS, SMALL: SMALL, LANDMARK_R: LANDMARK_R, SMALL_R: SMALL_R, REWARD_BIG: REWARD_BIG, REWARD_SMALL: REWARD_SMALL,
    SEP_BIG: SEP_BIG, SEP_SMALL: SEP_SMALL, TOWER_CLEAR: TOWER_CLEAR, LAKE_R: LAKE_R, FORT_SIDE: FORT_SIDE, FORT_GATE: FORT_GATE,
    /* 판정 층(순수) */
    on: on, center: center, sites: sites, bloomSpots: bloomSpots, treeSnow: treeSnow, siteById: siteById, snowAt: snowAt, snowCell: snowCell, rectsOf: rectsOf, rectsIn: rectsIn,
    /* 세이브·상태 */
    snowingHere: snowingHere, calm: calm, flown: flown, away: away, FLY_H: FLY_H, FLY_T: FLY_T, snowCount: snowCount, SNOW_N: SNOW_N, SNOW_CALM: SNOW_CALM, found: found, discoverAt: discoverAt, waypoints: waypoints, teleport: teleport, marks: marks,
    tick: tick,
    _resetForTest: function () { memo = null; bloomMemo = null; rectMemo = null; snowMemo = {}; snowN = 0; hereT = -1; }
  };
})(window);
