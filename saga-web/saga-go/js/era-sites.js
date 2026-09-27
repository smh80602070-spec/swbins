/**
 * 3부 시대 명소 — 이야기 3부(13~15장) 무대 (PLAN §5 ⑲-34~, saga-godot PLAN 106 ㊼ `world/era_sites.gd`)
 * ---------------------------------------------------------------
 *   조선소  ⑲-34 13장 — 갈대 나루 물가의 녹슨 조선소(현대). 콘크리트 바닥·바다로 내려가는 선대·짓다 만 배 늑골·
 *           문형 기중기(다리 둘·들보 CRANE_TOP m)·창고·용접대. 기중기 다리는 **타고 오른다**(landform `poles` 오르기) —
 *           들보 위에 서면 이야기 climb 단계가 끝난다. 30m 안 = 명소 발견
 *
 * 자리는 갈대 나루 탑에서 둘레를 돌며 "바닥은 뭍 · 선대 끝은 물"인 첫 자리 — 해시·지형만이라 같은 세계면 늘 같다.
 * 조선소는 바다 쪽(sea)을 보고 선다: 모든 부품은 조선소 틀(가로 lx · 바다 쪽 lz) 좌표로 적고 `toWorld` 로 옮긴다.
 * 판정 층(`yard`·`spot`·`poles`·`onBeam`·`rectsIn`·`landDirs`)은 순수. 세이브 `save.era = { found }`(읽는 쪽 기본값).
 * 그림은 코드 도형(SAGA-DESIGN §7).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('era.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function ST() { return global.DG.story || null; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var YARD_ZONE = 'galdae', YARD_NAME = '녹슨 조선소', YARD_ERA = '현대';
  var SEARCH_R = [90, 120, 150, 180, 210, 240, 270, 300, 330, 360], SEARCH_N = 24, SEA_N = 16;
  var CLEAR = { tower: 60, cape: 70, isle: 60, dock: 50 };
  /* 조선소 틀 좌표(m) — lx 가로, lz 바다 쪽(+) */
  var PARTS = {
    slab: { lx: 0, lz: 0, w: 28, d: 22 },
    slip: { lx: 0, lz: 14, w: 8, d: 16 },
    legA: { lx: -7.5, lz: 12 }, legB: { lx: 7.5, lz: 12 },
    shed: { lx: -8, lz: -6, w: 9, d: 7, h: 5 },
    weld: { lx: 5, lz: -2 },
    daon: { lx: -8, lz: -1.5 },
    fight: { lx: 0, lz: -16 },
    bandi: { lx: 3, lz: 2 },
    frag: { lx: 0, lz: 12 }
  };
  var CRANE_TOP = 12.6, LEG_HALF = 0.55, BEAM_W = 1.2, BEAM_CLEAR = 1.4;   // 들보 위 걷는 길은 다리에서 BEAM_CLEAR m 안쪽부터
  var LAND_PTS = [[-14, -12], [-7, -12], [0, -12], [7, -12], [14, -12], [-14, -6], [0, -6], [14, -6], [-14, 0], [0, 0], [14, 0],
    [-14, 6], [-7, 6], [0, 6], [7, 6], [14, 6], [-7.5, 12], [7.5, 12]];
  var SEA_PTS = [[0, 28], [0, 34]];
  var FOUND_R = 30, REWARD = { gold: 150, dust: 2, exp: 40 };
  var GRID = 48;

  /* ── 자리(순수 — 지형·해시만) ───────────────────────────── */
  function landAt(x, y) { var S = ST(); return !!(S && S.landAt && S.landAt(x, y)); }
  function frame(x, y, sx, sy) {
    var rot = Math.atan2(-sx, sy);
    return { x: x, y: y, rot: rot, c: Math.cos(rot), s: Math.sin(rot), sea: { x: sx, y: sy } };
  }
  /** 조선소 틀 → 월드 */
  function toWorld(f, lx, lz) { return { x: f.x + lx * f.c - lz * f.s, y: f.y + lx * f.s + lz * f.c }; }
  function fits(f) {
    var i, q;
    for (i = 0; i < LAND_PTS.length; i++) { q = toWorld(f, LAND_PTS[i][0], LAND_PTS[i][1]); if (!landAt(q.x, q.y)) { return false; } }
    for (i = 0; i < SEA_PTS.length; i++) { q = toWorld(f, SEA_PTS[i][0], SEA_PTS[i][1]); if (!landAt(q.x, q.y)) { return true; } }
    return false;
  }
  function clearOf(x, y, a) {
    var S = ST(), cp = S && S.capeSpot ? S.capeSpot() : null, il = S && S.isleSpot ? S.isleSpot() : null;
    if (Math.hypot(x - a.x, y - a.y) < CLEAR.tower) { return false; }
    if (cp && Math.hypot(x - cp.x, y - cp.y) < CLEAR.cape) { return false; }
    if (il && Math.hypot(x - il.x, y - il.y) < CLEAR.isle) { return false; }
    if (Math.hypot(x - (a.x - 12), y - (a.y - 17)) < CLEAR.dock) { return false; }   // 나루(SPOTS dock)·사공 곁
    return true;
  }
  var yardMemo = null;
  /** 조선소 틀 { x, y, rot, c, s, sea, forced? } — 갈대 나루 탑 둘레 안쪽부터, 같은 세계면 늘 같다. 땅이 없으면 null */
  function yard() {
    if (yardMemo) { return yardMemo; }
    var S = ST(), a = S && S.anchorOf ? S.anchorOf(YARD_ZONE) : null;
    if (!a) { return null; }
    for (var ri = 0; ri < SEARCH_R.length; ri++) {
      for (var k = 0; k < SEARCH_N; k++) {
        var ang = k * Math.PI * 2 / SEARCH_N, x = a.x + Math.sin(ang) * SEARCH_R[ri], y = a.y - Math.cos(ang) * SEARCH_R[ri];
        if (!landAt(x, y) || !clearOf(x, y, a)) { continue; }
        for (var d = 0; d < SEA_N; d++) {
          var sa = d * Math.PI * 2 / SEA_N, f = frame(x, y, Math.sin(sa), -Math.cos(sa));
          if (fits(f)) { yardMemo = f; return f; }
        }
      }
    }
    yardMemo = frame(a.x, a.y + 120, 0, 1);            // 물가가 없는 세계 — 탑 남쪽에 억지로(진단이 forced 로 본다)
    yardMemo.forced = true;
    return yardMemo;
  }
  /** 이름 붙은 자리 — 'yard'(바닥 가운데)·'weld'·'daon'·'fight'·'bandi'·'crane'(들보 가운데 밑). 없으면 null */
  function spot(part) {
    if (!on()) { return null; }
    var f = yard();
    if (!f) { return null; }
    if (part === 'yard') { return { x: f.x, y: f.y }; }
    var P = part === 'crane' ? PARTS.frag : PARTS[part];
    return P ? toWorld(f, P.lx, P.lz) : null;
  }
  /** 용접대 지키기 무리가 오는 방향 — 바다 쪽을 뺀 뭍 다섯(북 0 시계 방향 도, 이야기 defend dirs) */
  function landDirs() {
    var f = yard();
    if (!f) { return [90, 135, 180, 225, 270]; }
    var b = Math.atan2(-f.sea.x, f.sea.y) * 180 / Math.PI;    // 뭍 쪽(바다 반대) 방위: sin(g) = -sea.x, -cos(g) = -sea.y
    return [-90, -45, 0, 45, 90].map(function (o) { return Math.round(((b + o) % 360 + 360) % 360); });
  }

  /* ── 기중기 다리(landform 오르기) ─────────────────────── */
  var poleMemo = null;
  /** 기중기 다리 둘 — [{ id, x, y, r, top, beam: { ax, ay, bx, by, w } }]. beam 은 **다리 둘 사이 걷는 길**(다리 위는 뺀다) */
  function poles() {
    if (!on()) { return []; }
    if (poleMemo) { return poleMemo; }
    var f = yard();
    if (!f) { return []; }
    var A = toWorld(f, PARTS.legA.lx, PARTS.legA.lz), B = toWorld(f, PARTS.legB.lx, PARTS.legB.lz);
    var dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    var beam = { ax: A.x + ux * BEAM_CLEAR, ay: A.y + uy * BEAM_CLEAR, bx: B.x - ux * BEAM_CLEAR, by: B.y - uy * BEAM_CLEAR, w: BEAM_W };
    poleMemo = [{ id: 'crane_a', x: A.x, y: A.y, r: LEG_HALF, top: CRANE_TOP, beam: beam },
                { id: 'crane_b', x: B.x, y: B.y, r: LEG_HALF, top: CRANE_TOP, beam: beam }];
    return poleMemo;
  }
  function poleById(id) { var L = poles(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** (x,y) 가 들보 걷는 길 위인가 — 들보 선분에서 폭 절반 안 */
  function onBeam(p, x, y) {
    var b = p && p.beam;
    if (!b) { return false; }
    var vx = b.bx - b.ax, vy = b.by - b.ay, L2 = vx * vx + vy * vy || 1;
    var t = ((x - b.ax) * vx + (y - b.ay) * vy) / L2;
    if (t < 0 || t > 1) { return false; }
    return Math.hypot(x - (b.ax + vx * t), y - (b.ay + vy * t)) <= b.w / 2;
  }
  /** 다리 꼭대기에 닿았을 때 설 자리 — 그 다리 쪽 걷는 길 끝 */
  function perchOf(p) { var b = p.beam; return p.id === 'crane_a' ? { x: b.ax, y: b.ay } : { x: b.bx, y: b.by }; }

  /* ── 벽(월드 좌표 사각형 — world3d houseRects 가 격자 칸마다 가져간다) ─ */
  var rectMemo = null;
  function rectsOfYard(f) {
    var rot = f.rot, out = [], sh = toWorld(f, PARTS.shed.lx, PARTS.shed.lz);
    out.push({ x: sh.x, z: sh.y, w: PARTS.shed.w, d: PARTS.shed.d, rot: rot, h: PARTS.shed.h });
    [PARTS.legA, PARTS.legB].forEach(function (lg) { var q = toWorld(f, lg.lx, lg.lz); out.push({ x: q.x, z: q.y, w: LEG_HALF * 2, d: LEG_HALF * 2, rot: rot, h: CRANE_TOP }); });
    return out;
  }
  function rectsIn(gx, gy) {
    if (!on()) { return []; }
    if (!rectMemo) {
      rectMemo = {};
      var f = yard();
      if (f) {
        rectsOfYard(f).forEach(function (r) {
          var k = Math.floor(r.x / GRID) + ',' + Math.floor(r.z / GRID);
          (rectMemo[k] || (rectMemo[k] = [])).push(r);
        });
      }
    }
    return rectMemo[gx + ',' + gy] || [];
  }

  /* ── 세이브·발견 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.era || typeof s.era !== 'object') { s.era = {}; }
    if (!s.era.found || typeof s.era.found !== 'object') { s.era.found = {}; }
    return s.era;
  }
  function found(id) { var e = core().save.era; return !!(e && e.found && e.found[id]); }
  function discoverAt(px, py) {
    if (!on() || found('shipyard')) { return false; }
    var c = spot('yard');
    if (!c || Math.hypot(c.x - px, c.y - py) > FOUND_R) { return false; }
    sv().found.shipyard = Date.now();
    var C = core(), P = C.save.player;
    P.gold = (P.gold || 0) + REWARD.gold;
    C.save.dust = (C.save.dust || 0) + REWARD.dust;
    if (C.gainExp) { C.gainExp(REWARD.exp); }
    toast('🏗️ 명소 발견 — ' + YARD_NAME + ' (' + YARD_ERA + ') · 금 +' + REWARD.gold);
    C.log('🏗️ 갈대 나루 — ' + YARD_NAME + ' 발견', 'discover');
    C.emit('era:found', { id: 'shipyard' });
    sfx('discover');
    C.persist();
    return true;
  }
  /** 지도·미니맵 — 조선소(안 찾으면 흐리게) */
  function marks() {
    var c = spot('yard');
    return c ? [{ id: 'shipyard', x: c.x, y: c.y, name: YARD_NAME, found: found('shipyard') }] : [];
  }
  /** 들보 위 날개 조각이 아직 있나 — 13장 기중기 단계(여섯째)를 지나면 없다 */
  var FRAG_CH = 'ch13', FRAG_STEP = 5;
  function fragmentThere() {
    var S = ST(), s = core() && core().save ? core().save.story : null;
    if (!S || !S.CHAPTERS || !s) { return true; }
    for (var i = 0; i < S.CHAPTERS.length; i++) {
      if (S.CHAPTERS[i].id === FRAG_CH) { return s.ch < i || (s.ch === i && (s.step || 0) <= FRAG_STEP); }
    }
    return true;
  }

  /* ── 3D ───────────────────────────────────────────────── */
  var fx = null, clock = 0, mats = null;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function M(T3) {
    if (mats) { return mats; }
    mats = {
      concrete: new T3.MeshLambertMaterial({ color: 0x8a8984 }), slip: new T3.MeshLambertMaterial({ color: 0x5f5d58 }),
      rust: new T3.MeshLambertMaterial({ color: 0x8a4a2a }), yellow: new T3.MeshLambertMaterial({ color: 0xd9a51f }),
      shed: new T3.MeshLambertMaterial({ color: 0x7c8a90 }), roof: new T3.MeshLambertMaterial({ color: 0x4d5a60 }),
      dark: new T3.MeshLambertMaterial({ color: 0x2a2f38 }), steel: new T3.MeshStandardMaterial({ color: 0xb4bcc4, metalness: 0.7, roughness: 0.4 }),
      glow: new T3.MeshBasicMaterial({ color: 0x9ff3ff }), spark: new T3.MeshBasicMaterial({ color: 0xffd27a })
    };
    return mats;
  }
  function box(T3, g, m, w, h, d, x, y, z, ry) { var o = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) { o.rotation.y = ry; } g.add(o); return o; }
  function build(w, T3, f) {
    var m = M(T3), g = new T3.Group(), o = { root: g }, i, P = PARTS;
    var y0 = w.groundY ? w.groundY(f.x, f.y) : 0;
    /* 틀 좌표 (lx, lz) → 그룹 안 (x, z) 는 그대로, 그룹을 -rot 로 돌린다(frost 비행선과 같은 규약) */
    box(T3, g, m.concrete, P.slab.w, 0.3, P.slab.d, 0, 0.15, 0);
    var sl = box(T3, g, m.slip, P.slip.w, 0.3, P.slip.d, 0, -0.6, P.slip.lz); sl.rotation.x = 0.12;          // 바다로 기운 선대
    for (i = 0; i < 5; i++) {                                                                                 // 짓다 만 배 늑골
      var rib = new T3.Mesh(new T3.TorusGeometry(3.1, 0.18, 6, 14, Math.PI), m.rust);
      rib.position.set(0, 0.2, 8 + i * 2.4); g.add(rib);
    }
    box(T3, g, m.rust, 0.4, 0.4, 11, 0, 0.3, 12.8);                                                          // 용골
    [P.legA, P.legB].forEach(function (lg) { box(T3, g, m.yellow, LEG_HALF * 2, CRANE_TOP, LEG_HALF * 2, lg.lx, CRANE_TOP / 2, lg.lz); });
    box(T3, g, m.yellow, 17, 0.6, BEAM_W, 0, CRANE_TOP - 0.3, P.legA.lz);                                     // 들보
    box(T3, g, m.dark, 1.4, 1.2, 1.6, 3.5, CRANE_TOP - 1.2, P.legA.lz);                                      // 도르래 수레
    box(T3, g, m.steel, 0.06, 6, 0.06, 3.5, CRANE_TOP - 4.6, P.legA.lz);                                     // 늘어진 줄
    for (i = 0; i < 6; i++) { box(T3, g, m.dark, 0.08, 0.08, LEG_HALF * 2 + 0.05, P.legA.lx + LEG_HALF + 0.02, 1.2 + i * 2, P.legA.lz); }   // 다리 바깥 디딤
    box(T3, g, m.shed, P.shed.w, P.shed.h, P.shed.d, P.shed.lx, P.shed.h / 2, P.shed.lz);
    box(T3, g, m.roof, P.shed.w + 0.6, 0.35, P.shed.d + 0.6, P.shed.lx, P.shed.h + 0.17, P.shed.lz);
    box(T3, g, m.dark, 3, 3.2, 0.1, P.shed.lx, 1.6, P.shed.lz + P.shed.d / 2 + 0.05);                         // 창고 문(바다 쪽)
    box(T3, g, m.steel, 1.8, 0.9, 1.1, P.weld.lx, 0.45, P.weld.lz);                                          // 용접대
    o.spark = box(T3, g, m.spark, 0.25, 0.25, 0.25, P.weld.lx, 1.05, P.weld.lz);
    o.frag = box(T3, g, m.glow, 1.6, 0.12, 0.9, P.frag.lx, CRANE_TOP + 0.1, P.frag.lz, 0.4);                 // 날개 조각
    g.rotation.y = -f.rot;
    g.position.set(f.x, y0, f.y);
    w.addFx(g);
    return o;
  }
  function paint(dt) {
    clock += dt || 0;
    var w = W3();
    if (!w) { fx = null; return; }
    var T3 = w.three(), f = yard();
    if (!T3 || !f) { return; }
    var p = core().save.player.pos, near = Math.hypot(f.x - p.x, f.y - p.y) <= 280;
    if (!near) { if (fx) { w.removeFx(fx.root); fx = null; } return; }
    if (!fx) { fx = build(w, T3, f); }
    fx.frag.visible = fragmentThere();
    fx.frag.position.y = CRANE_TOP + 0.1 + Math.sin(clock * 2.2) * 0.08;
    fx.spark.visible = Math.sin(clock * 17) > 0.2;
  }

  var acc = 0;
  function tick(dt) {
    if (!core() || !core().save || !on()) { return; }
    acc += dt || 0;
    if (acc >= 0.25) { acc = 0; var p = core().save.player.pos; discoverAt(p.x, p.y); }
    if (!global.DG_NO_DRAW) { paint(dt); }
  }

  global.DG = global.DG || {};
  global.DG.eraSites = {
    YARD_ZONE: YARD_ZONE, YARD_NAME: YARD_NAME, PARTS: PARTS, CRANE_TOP: CRANE_TOP, BEAM_W: BEAM_W, BEAM_CLEAR: BEAM_CLEAR, LEG_HALF: LEG_HALF,
    FOUND_R: FOUND_R, REWARD: REWARD, LAND_PTS: LAND_PTS, SEA_PTS: SEA_PTS, CLEAR: CLEAR,
    /* 판정 층(순수) */
    on: on, yard: yard, toWorld: toWorld, spot: spot, landDirs: landDirs, poles: poles, poleById: poleById, onBeam: onBeam, perchOf: perchOf, rectsIn: rectsIn,
    /* 세이브·상태 */
    found: found, discoverAt: discoverAt, marks: marks, fragmentThere: fragmentThere,
    tick: tick,
    _resetForTest: function () { yardMemo = null; poleMemo = null; rectMemo = null; }
  };
})(window);
