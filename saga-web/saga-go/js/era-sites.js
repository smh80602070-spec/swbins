/**
 * 3부 시대 명소 — 이야기 3부(13~15장) 무대 (PLAN §5 ⑲-34~, saga-godot PLAN 106 ㊼ `world/era_sites.gd`)
 * ---------------------------------------------------------------
 *   조선소  ⑲-34 13장 — 갈대 나루 물가의 녹슨 조선소(현대). 콘크리트 바닥·바다로 내려가는 선대·짓다 만 배 늑골·
 *           문형 기중기(다리 둘·들보 CRANE_TOP m)·창고·용접대. 기중기 다리는 **타고 오른다**(landform `poles` 오르기) —
 *           들보 위에 서면 이야기 climb 단계가 끝난다. 30m 안 = 명소 발견
 *   관측소  ⑲-35 14장 — 옛 성터 언덕 곁 시간 틈 관측소(미래). 땅엔 육각 쇠 바닥·부서진 기둥 여섯(벽)·허공의 보랏빛 틈,
 *           OBS_RISE m 위에 **떠 있는 관측대**(반지름 OBS_R·난간·북쪽 관측경 돔), 남쪽 DRAFT_OFF m 에 **시간 기둥**(상승 기류 —
 *           14장 석등을 다 켠 뒤부터 늘). 관측대·기둥은 skyisle 발판 목록(`pads`·`drafts`)으로 내놓는다 — 몸·층 판정은 구름섬과 같은 길
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
  /* ⑲-35 시간 틈 관측소 — 옛 성터 언덕 탑 둘레(서쪽부터 시계 방향). 틀은 북쪽이 위(+x 동·+y 남) 그대로 */
  var OBS_ZONE = 'gojeong', OBS_NAME = '시간 틈 관측소', OBS_ERA = '미래';
  var OBS_SEARCH_R = [70, 90, 110, 130, 150, 180, 210, 240], OBS_SEARCH_N = 24, OBS_FLAT = 4;
  var OBS_CLEAR_TOWER = 50, OBS_CLEAR = 45;
  /* 그 땅 탑 기준 이미 쓰는 자리(은비·3장 무리·옛 제단·별이·돌쇠·틈 괴물·틈 제단) — 이만큼 비킨다 */
  var OBS_AVOID = [[-18, -24], [40, -30], [-30, 26], [26, 18], [-96, 16], [12, -96], [-90, 10]];
  var OBS_RISE = 24, OBS_R = 9, OBS_RIM_H = 1, OBS_SLAB = 1.5, PILLAR_R = 7.5, PILLAR_H = [3.8, 1.6, 2.9, 1.2, 4.4, 2.2];
  var DRAFT_OFF = [0, 13], DRAFT_R = 3, DRAFT_OVER = 8, DRAFT_RISE = 9;
  var OBS_PARTS = { obs: [0, 0], deck: [0, 0], gaon: [-10, 9], draft: DRAFT_OFF, obs_bandi: [3, -3], obs_frag: [0, -5] };
  var OBS_CH = 'ch14', DRAFT_FROM = 6, OBS_BOOT = [8, 9];      // 석등(5째)을 다 켠 뒤부터 기둥 · 관측대 위 단계(불러오기)

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
    if (OBS_PARTS[part]) { var o = obs(); return o ? { x: o.x + OBS_PARTS[part][0], y: o.y + OBS_PARTS[part][1] } : null; }
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

  /* ── ⑲-35 관측소 자리(순수) ─────────────────────────── */
  function reliefH(x, y) { var R = global.DG.relief3d; return R && R.heightAt ? R.heightAt(x, y) : 0; }
  /** 관측소가 설 땅인가 — 가운데·관측대 둘레 여덟·시간 기둥·가온이 뭍이고 높이 차 OBS_FLAT m 안 */
  function obsFits(x, y) {
    var pts = [[0, 0], DRAFT_OFF, OBS_PARTS.gaon], i, lo = Infinity, hi = -Infinity;
    for (i = 0; i < 8; i++) { var a = i * Math.PI / 4; pts.push([Math.sin(a) * OBS_R, -Math.cos(a) * OBS_R]); }
    for (i = 0; i < pts.length; i++) {
      var qx = x + pts[i][0], qy = y + pts[i][1], h;
      if (!landAt(qx, qy)) { return false; }
      h = reliefH(qx, qy); lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return hi - lo <= OBS_FLAT;
  }
  function obsClear(x, y, a) {
    if (Math.hypot(x - a.x, y - a.y) < OBS_CLEAR_TOWER) { return false; }
    for (var i = 0; i < OBS_AVOID.length; i++) { if (Math.hypot(x - (a.x + OBS_AVOID[i][0]), y - (a.y + OBS_AVOID[i][1])) < OBS_CLEAR) { return false; } }
    return true;
  }
  var obsMemo = null;
  /** 관측소 가운데(땅) { x, y, forced? } — 옛 성터 언덕 탑 둘레 안쪽부터, 같은 세계면 늘 같다. 땅이 없으면 null */
  function obs() {
    if (obsMemo) { return obsMemo; }
    var S = ST(), a = S && S.anchorOf ? S.anchorOf(OBS_ZONE) : null;
    if (!a) { return null; }
    for (var ri = 0; ri < OBS_SEARCH_R.length; ri++) {
      for (var k = 0; k < OBS_SEARCH_N; k++) {
        var ang = (k + OBS_SEARCH_N * 3 / 4) * Math.PI * 2 / OBS_SEARCH_N, x = a.x + Math.sin(ang) * OBS_SEARCH_R[ri], y = a.y - Math.cos(ang) * OBS_SEARCH_R[ri];
        if (obsClear(x, y, a) && obsFits(x, y)) { obsMemo = { x: x, y: y }; return obsMemo; }
      }
    }
    obsMemo = { x: a.x - OBS_SEARCH_R[0], y: a.y, forced: true };   // 뭍이 없는 세계 — 탑 서쪽에 억지로
    return obsMemo;
  }
  /** 14장 차례 — 이야기 표에서 ch14 가 몇째 장인가(없으면 -1) */
  function obsCh() {
    var S = ST();
    if (!S || !S.CHAPTERS) { return -1; }
    for (var i = 0; i < S.CHAPTERS.length; i++) { if (S.CHAPTERS[i].id === OBS_CH) { return i; } }
    return -1;
  }
  function storyAt() { var s = core() && core().save ? core().save.story : null; return s || { ch: 0, step: 0 }; }
  /** 시간 기둥이 섰나 — 14장 석등을 다 켠 뒤(여섯째 단계)부터, 장이 끝나도 남는다 */
  function draftOpen() {
    var i = obsCh(), s = storyAt();
    return i >= 0 && (s.ch > i || (s.ch === i && (s.step || 0) >= DRAFT_FROM));
  }
  /** 관측대 위 날개 조각 — 14장이 끝나기 전까지 */
  function obsFragThere() { var i = obsCh(); return i < 0 || storyAt().ch <= i; }
  function obsTop() { var o = obs(); return o ? reliefH(o.x, o.y) + OBS_RISE : 0; }
  /** skyisle 발판 — 떠 있는 관측대 */
  function pads() {
    if (!on()) { return []; }
    var o = obs();
    if (!o) { return []; }
    return [{ id: 'obs', name: '관측대', x: o.x, y: o.y, r: OBS_R, top: obsTop(), slab: OBS_SLAB, boot: [obsCh(), OBS_BOOT[0], OBS_BOOT[1]] }];
  }
  /** skyisle 상승 기류 — 시간 기둥(섰을 때만) */
  function drafts() {
    if (!on() || !draftOpen()) { return []; }
    var d = spot('draft');
    return d ? [{ id: 'obs', x: d.x, y: d.y, r: DRAFT_R, top: obsTop() + DRAFT_OVER, rise: DRAFT_RISE }] : [];
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
      var f = yard(), o = obs(), all = f ? rectsOfYard(f) : [];
      if (o) {                                                    // ⑲-35 부서진 기둥 여섯
        PILLAR_H.forEach(function (h, i) { var a = i * Math.PI / 3; all.push({ x: o.x + Math.cos(a) * PILLAR_R, z: o.y + Math.sin(a) * PILLAR_R, w: 0.9, d: 0.9, rot: 0, h: h }); });
      }
      if (all.length) {
        all.forEach(function (r) {
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
  /** 명소 표 — id · 가운데 자리 · 이름 · 시대 · 땅 이름 · 그림 글자 */
  function sites() {
    return [{ id: 'shipyard', part: 'yard', name: YARD_NAME, era: YARD_ERA, zone: '갈대 나루', emoji: '🏗️' },
            { id: 'observatory', part: 'obs', name: OBS_NAME, era: OBS_ERA, zone: '옛 성터 언덕', emoji: '🔭' }];
  }
  /** (px,py) 에서 FOUND_R 안 명소를 찾는다 — 한 번에 하나 */
  function discoverAt(px, py) {
    if (!on()) { return false; }
    var L = sites();
    for (var i = 0; i < L.length; i++) {
      var d = L[i], c = spot(d.part);
      if (found(d.id) || !c || Math.hypot(c.x - px, c.y - py) > FOUND_R) { continue; }
      sv().found[d.id] = Date.now();
      var C = core(), P = C.save.player;
      P.gold = (P.gold || 0) + REWARD.gold;
      C.save.dust = (C.save.dust || 0) + REWARD.dust;
      if (C.gainExp) { C.gainExp(REWARD.exp); }
      toast(d.emoji + ' 명소 발견 — ' + d.name + ' (' + d.era + ') · 금 +' + REWARD.gold);
      C.log(d.emoji + ' ' + d.zone + ' — ' + d.name + ' 발견', 'discover');
      C.emit('era:found', { id: d.id });
      sfx('discover');
      C.persist();
      return true;
    }
    return false;
  }
  /** 지도·미니맵 — 명소(안 찾으면 흐리게) */
  function marks() {
    return sites().map(function (d) { var c = spot(d.part); return c ? { id: d.id, x: c.x, y: c.y, name: d.name, emoji: d.emoji, found: found(d.id) } : null; })
      .filter(function (m) { return !!m; });
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

  /* ⑲-35 관측소 — 땅(쇠 바닥·부서진 기둥·틈·고리)은 땅 높이, 관측대는 obsTop()(발판 판정과 같은 높이)에 */
  var ofx = null, OM = null;
  function OMats(T3) {
    if (OM) { return OM; }
    var glow = function (c, a) { return new T3.MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, blending: T3.AdditiveBlending, fog: false }); };
    OM = {
      alloy: new T3.MeshStandardMaterial({ color: 0xbdc4d1, metalness: 0.6, roughness: 0.35 }), dark: new T3.MeshLambertMaterial({ color: 0x4d5466 }),
      white: new T3.MeshLambertMaterial({ color: 0xe6ebf2 }), band: new T3.MeshBasicMaterial({ color: 0x7a55b8 }),
      rift: glow(0xb880ff, 0.55), ring: glow(0xd0b0ff, 0.5), inlay: glow(0x99d9ff, 0.7), draft: glow(0x99d9ff, 0.14), draftRing: glow(0xffffff, 0.5)
    };
    OM.rift.side = T3.DoubleSide; OM.draft.side = T3.DoubleSide;
    return OM;
  }
  function buildObs(w, T3, o) {
    var m = OMats(T3), g = new T3.Group(), r = { root: g, rings: [] }, i;
    var y0 = w.groundY ? w.groundY(o.x, o.y) : 0, top = obsTop();
    var floor = new T3.Mesh(new T3.CylinderGeometry(PILLAR_R + 0.8, PILLAR_R + 0.8, 0.08, 6), m.dark);
    floor.position.y = 0.04; g.add(floor);
    PILLAR_H.forEach(function (h, k) {                                                                         // 부서진 기둥 여섯
      var a = k * Math.PI / 3, px = Math.cos(a) * PILLAR_R, pz = Math.sin(a) * PILLAR_R;
      box(T3, g, m.alloy, 0.9, h, 0.9, px, h / 2, pz);
      box(T3, g, m.band, 1.0, 0.1, 1.0, px, h * 0.6, pz);
    });
    var rift = new T3.Mesh(new T3.SphereGeometry(1.6, 16, 8), m.rift);                                          // 허공의 틈
    rift.scale.set(1, 1.9, 0.18); rift.position.y = 10; g.add(rift);
    for (i = 0; i < 2; i++) {
      var rg = new T3.Mesh(new T3.TorusGeometry(2.7, 0.1, 6, 40), m.ring);
      rg.position.y = 10; rg.rotation.set(1.22 + 0.7 * i, 0, 0.35 * i); g.add(rg); r.rings.push(rg);
    }
    var deck = new T3.Group();                                                                                   // 떠 있는 관측대
    deck.position.y = top - y0; g.add(deck);
    var plate = new T3.Mesh(new T3.CylinderGeometry(OBS_R, OBS_R - 0.6, 1, 24), m.alloy);
    plate.position.y = -0.5; deck.add(plate);
    var cone = new T3.Mesh(new T3.CylinderGeometry(OBS_R - 0.6, 0.8, 6, 12), m.dark);
    cone.position.y = -4; deck.add(cone);
    var inlay = new T3.Mesh(new T3.TorusGeometry(OBS_R - 1.5, 0.12, 4, 48), m.inlay);
    inlay.rotation.x = Math.PI / 2; inlay.position.y = 0.03; deck.add(inlay);
    var rim = new T3.Mesh(new T3.TorusGeometry(OBS_R - 0.42, 0.14, 6, 48), m.dark);
    rim.rotation.x = Math.PI / 2; rim.position.y = OBS_RIM_H * 0.85; deck.add(rim);
    for (i = 0; i < 8; i++) { var a2 = i * Math.PI / 4; box(T3, deck, m.alloy, 0.4, OBS_RIM_H + 0.4, 0.4, Math.cos(a2) * (OBS_R - 0.42), (OBS_RIM_H + 0.4) / 2, Math.sin(a2) * (OBS_R - 0.42)); }
    var dz = -(OBS_R - 2.7);                                                                                     // 북쪽 관측경 돔
    var drum = new T3.Mesh(new T3.CylinderGeometry(1.8, 1.8, 1.6, 16), m.alloy); drum.position.set(0, 0.8, dz); deck.add(drum);
    var cap = new T3.Mesh(new T3.SphereGeometry(1.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.white); cap.position.set(0, 1.6, dz); deck.add(cap);
    var scope = new T3.Mesh(new T3.CylinderGeometry(0.28, 0.4, 3, 10), m.dark); scope.position.set(0, 2.9, dz - 0.6); scope.rotation.x = -0.6; deck.add(scope);
    r.frag = box(T3, deck, M(T3).glow, 1.6, 0.12, 0.9, OBS_PARTS.obs_frag[0], 0.15, OBS_PARTS.obs_frag[1], 0.4);    // 날개 조각(관측경 틀 곁)
    r.deck = deck;
    g.position.set(o.x, y0, o.y);
    w.addFx(g);
    return r;
  }
  function buildDraft(T3, h) {
    var m = OMats(T3), g = new T3.Group();
    var col = new T3.Mesh(new T3.CylinderGeometry(DRAFT_R, DRAFT_R, h, 20, 1, true), m.draft);
    col.position.y = h / 2; g.add(col);
    for (var i = 0; i < 4; i++) {
      var ring = new T3.Mesh(new T3.TorusGeometry(DRAFT_R * 0.9, 0.08, 4, 32), m.draftRing.clone());
      ring.rotation.x = Math.PI / 2; ring.userData.k = i / 4; g.add(ring);
    }
    g.userData.h = h;
    return g;
  }
  function paintObs() {
    var w = W3();
    if (!w) { ofx = null; return; }
    var T3 = w.three(), o = obs();
    if (!T3 || !o) { return; }
    var p = core().save.player.pos;
    if (Math.hypot(o.x - p.x, o.y - p.y) > 600) { if (ofx) { w.removeFx(ofx.root); if (ofx.draft) { w.removeFx(ofx.draft); } ofx = null; } return; }
    if (!ofx) { ofx = buildObs(w, T3, o); }
    ofx.rings.forEach(function (rg, i) { rg.rotation.z = (i ? -1 : 1) * clock * 0.6; });
    ofx.frag.visible = obsFragThere();
    ofx.frag.position.y = 0.15 + Math.sin(clock * 2.2) * 0.08;
    var d = draftOpen() ? spot('draft') : null;
    if (d) {
      var gy = w.groundY ? w.groundY(d.x, d.y) : 0, h = obsTop() + DRAFT_OVER - gy;
      if (!ofx.draft || Math.abs(ofx.draft.userData.h - h) > 0.5) { if (ofx.draft) { w.removeFx(ofx.draft); } ofx.draft = buildDraft(T3, h); w.addFx(ofx.draft); }
      ofx.draft.position.set(d.x, gy, d.y);
      ofx.draft.children.forEach(function (c, i) {
        if (!i) { c.material.opacity = 0.12 + Math.sin(clock * 2.4) * 0.04; return; }
        var k = (c.userData.k + clock * 0.35) % 1;
        c.position.y = k * h; c.material.opacity = 0.55 * (1 - k);
      });
    } else if (ofx.draft) { w.removeFx(ofx.draft); ofx.draft = null; }
  }

  var acc = 0;
  function tick(dt) {
    if (!core() || !core().save || !on()) { return; }
    acc += dt || 0;
    if (acc >= 0.25) { acc = 0; var p = core().save.player.pos; discoverAt(p.x, p.y); }
    if (!global.DG_NO_DRAW) { paint(dt); paintObs(); }
  }

  global.DG = global.DG || {};
  global.DG.eraSites = {
    YARD_ZONE: YARD_ZONE, YARD_NAME: YARD_NAME, PARTS: PARTS, CRANE_TOP: CRANE_TOP, BEAM_W: BEAM_W, BEAM_CLEAR: BEAM_CLEAR, LEG_HALF: LEG_HALF,
    FOUND_R: FOUND_R, REWARD: REWARD, LAND_PTS: LAND_PTS, SEA_PTS: SEA_PTS, CLEAR: CLEAR,
    /* 판정 층(순수) */
    on: on, yard: yard, toWorld: toWorld, spot: spot, landDirs: landDirs, poles: poles, poleById: poleById, onBeam: onBeam, perchOf: perchOf, rectsIn: rectsIn,
    /* 세이브·상태 */
    found: found, discoverAt: discoverAt, marks: marks, fragmentThere: fragmentThere,
    /* ⑲-35 관측소 */
    OBS_ZONE: OBS_ZONE, OBS_NAME: OBS_NAME, OBS_RISE: OBS_RISE, OBS_R: OBS_R, OBS_FLAT: OBS_FLAT, OBS_AVOID: OBS_AVOID, OBS_CLEAR: OBS_CLEAR, OBS_CLEAR_TOWER: OBS_CLEAR_TOWER,
    OBS_PARTS: OBS_PARTS, PILLAR_R: PILLAR_R, DRAFT_OFF: DRAFT_OFF, DRAFT_R: DRAFT_R, DRAFT_OVER: DRAFT_OVER, DRAFT_RISE: DRAFT_RISE, DRAFT_FROM: DRAFT_FROM, OBS_BOOT: OBS_BOOT,
    obs: obs, obsFits: obsFits, obsTop: obsTop, draftOpen: draftOpen, obsFragThere: obsFragThere, pads: pads, drafts: drafts,
    tick: tick,
    _resetForTest: function () { yardMemo = null; poleMemo = null; rectMemo = null; obsMemo = null; }
  };
})(window);
