/**
 * 구름섬·바람 기둥 — 이야기 9장 "먹구름 위 여섯째 자리"의 무대 (PLAN §5 ⑲-20, saga-godot PLAN 106 ㊳)
 * ---------------------------------------------------------------
 *   자리     세상 밖이 아니라 **봉우리(story.peakSpot — ⑰ 정상) 북쪽 위 하늘**. 가운데 = 정상 + ISLE_OFF,
 *            윗면 = 정상 땅 높이 + ISLE_UP, 반지름 ISLE_R 평평한 풀밭 + 밑은 거꾸로 선 바위 뿔 + 둘레 낮은 돌 난간.
 *            마을 쪽에서 올려다보이는 표지다. 9장이 끝나기 전엔 위에 먹구름 덮개, 끝나면 걷힌다
 *   바람 기둥 정상 가운데 반지름 DRAFT_R, 섬 윗면 + DRAFT_OVER 까지. 9장이 열린 뒤부터 늘(끝나도 남는다).
 *            기둥 안 공중(뛰어올랐거나 발밑 DRAFT_MIN_AIR m 넘게)이면 저절로 활공하고 DRAFT_RISE m/초로 솟는다 —
 *            몸 판정은 landform.js(`onSky`·`stepGlide`)가 이 모듈을 물어 한다
 *   층       섬 위에 선 것(내 몸 `landform.onSky()`·임무 적 `f.sky`·인물 칸 `sky`)만 섬 윗면에 선다. 섬 밑 땅은
 *            그대로 걸어 지나간다(섬은 공중에 떠 있다). 층이 다르면 들판 전투가 서로를 못 본다(`apart`)
 *   키보드 판만 층이 있다(`layerOn`) — GPS 판은 몸이 땅을 걷으므로 섬 무리도 땅에 선다(그림은 떠 있다).
 *   발판 목록 §5 ⑲-35 — 층은 구름섬 하나가 아니라 **떠 있는 발판 여럿**(`pads`: 구름섬 + era-sites 관측대)과 상승 기류 여럿
 *            (`drafts`: 바람 기둥 + 시간 기둥 — ⑲-43 crossing 갈림길 끝 섬·바람 기둥도)이다. 몸·무리·인물의 `sky` 는 참/거짓 그대로 — 어느 발판인지는 선 자리(`padAt`)가 정한다
 *            (발판끼리는 수 km 떨어져 겹치지 않는다)
 * 세이브 없음 — 섬에 선 채 불러오면 9장 섬 단계일 때만 도로 섬 위에 세운다(`boot`). 손잡이 `skyisle.on` 0 이면 다 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('skyisle.' + key, def); }
  var ISLE_OFF = [0, -27], ISLE_R = 14, ISLE_UP = 40, RAIL_H = 1, SLAB = 4;
  var DRAFT_R = 3.5, DRAFT_OVER = 9, DRAFT_RISE = 9, DRAFT_MIN_AIR = 1;
  var SKY_CH = 8, SKY_STEPS = [4, 9];           // 9장(0부터 8) 섬 단계 — 불러오면 섬 위로(boot)

  function ST() { var s = global.DG.story; return s && s.on && s.on() ? s : null; }
  function LF() { var l = global.DG.landform; return l && l.on && l.on() ? l : null; }
  function reliefH(x, y) { var R = global.DG.relief3d; return R ? R.heightAt(x, y) : 0; }
  function on() { return !!(K('on', 1) && ST() && ST().peakSpot && ST().peakSpot()); }
  function keyMode() { var W = global.DG.world; return !!(W && W.mode === 'keyboard'); }
  /** 층이 있나 — 키보드 판에서만 섬 위·밑이 갈린다(⑲-35 발판이 하나라도 있으면) */
  function layerOn() { return keyMode() && !!LF() && pads().length > 0; }

  /** 바람 기둥 자리 = 봉우리 정상 */
  function peak() { var s = ST(); return s ? s.peakSpot() : null; }
  /** 섬 가운데 */
  function spot() { var p = peak(); return p ? { x: p.x + ISLE_OFF[0], y: p.y + ISLE_OFF[1] } : null; }
  function top() { var p = peak(); return p ? reliefH(p.x, p.y) + ISLE_UP : 0; }
  function draftTop() { return top() + DRAFT_OVER; }
  /** 섬 윗면 위 (x,y) 인가(난간 안) */
  function inside(x, y) { var c = spot(); return !!c && Math.hypot(x - c.x, y - c.y) <= ISLE_R; }
  /** 9장이 열렸나(그 뒤로 늘) · 9장을 끝냈나 */
  function progress() { var s = ST(); return s ? s.state() : { ch: 0, step: 0 }; }
  function open() { var s = ST(), v = progress(); return !!s && s.CHAPTERS.length > SKY_CH && (v.ch > SKY_CH || (v.ch === SKY_CH && !s.locked())); }
  function cleared() { return progress().ch > SKY_CH; }
  function inDraft(x, y) { var p = peak(); return open() && !!p && Math.hypot(x - p.x, y - p.y) <= DRAFT_R; }

  /* ── ⑲-35 발판·상승 기류 목록 ─────────────────────────── */
  function ES() { var e = global.DG.eraSites; return e && e.on && e.on() ? e : null; }
  function CR() { var c = global.DG.crossing; return c && c.on && c.on() && c.pads ? c : null; }   // ⑲-43 갈림길 끝 섬
  function SR() { var r = global.DG.skyRoute; return r && r.on && r.on() ? r : null; }                // ⑲-48 구름 위 항로 섬 셋
  function SE() { var e = global.DG.stormEye; return e && e.on && e.on() ? e : null; }                // ⑲-52 8부 먹구름 눈
  /** 떠 있는 발판 — [{ id, name, x, y, r, top, slab, boot? [ch, from, to] 또는 그 목록(⑲-50) }] */
  function pads() {
    var out = [], c = on() ? spot() : null, E = ES();
    if (c) { out.push({ id: 'isle', name: '구름섬', x: c.x, y: c.y, r: ISLE_R, top: top(), slab: SLAB, boot: [SKY_CH, SKY_STEPS[0], SKY_STEPS[1]] }); }
    if (E && E.pads) { out = out.concat(E.pads()); }
    if (CR()) { out = out.concat(CR().pads()); }
    if (SR()) { out = out.concat(SR().pads()); }
    if (SE()) { out = out.concat(SE().pads()); }
    return out;
  }
  /** (x,y) 위 발판(난간 안) — 없으면 null */
  function padAt(x, y) {
    var L = pads();
    for (var i = 0; i < L.length; i++) { if (Math.hypot(x - L[i].x, y - L[i].y) <= L[i].r) { return L[i]; } }
    return null;
  }
  function padById(id) { var L = pads(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** 가장 가까운 발판과 가장자리까지 거리 — { pad, d }(d 는 난간 밖이면 +) */
  function nearPad(x, y) {
    var L = pads(), best = null, bd = Infinity;
    for (var i = 0; i < L.length; i++) { var d = Math.hypot(x - L[i].x, y - L[i].y) - L[i].r; if (d < bd) { bd = d; best = L[i]; } }
    return best ? { pad: best, d: bd } : null;
  }
  /** 선 상승 기류 — [{ id, x, y, r, top, rise }] */
  function drafts() {
    var out = [], p = open() ? peak() : null, E = ES();
    if (p) { out.push({ id: 'isle', x: p.x, y: p.y, r: DRAFT_R, top: draftTop(), rise: DRAFT_RISE }); }
    if (E && E.drafts) { out = out.concat(E.drafts()); }
    if (CR()) { out = out.concat(CR().drafts()); }
    if (SR()) { out = out.concat(SR().drafts()); }
    if (SE()) { out = out.concat(SE().drafts()); }
    return out;
  }
  function draftAt(x, y) {
    var L = drafts();
    for (var i = 0; i < L.length; i++) { if (Math.hypot(x - L[i].x, y - L[i].y) <= L[i].r) { return L[i]; } }
    return null;
  }

  /** 내 몸이 섬 위인가 */
  function meOnSky() { var l = LF(); return !!(l && l.onSky && l.onSky()); }
  /** 들판 적 f 가 나와 다른 층인가 — 층이 없으면 늘 false */
  function apart(f) { return layerOn() && !!(f && f.sky) !== meOnSky(); }
  /** 발판 위 적은 난간을 못 넘는다 — 가장 가까운 발판 난간 안쪽 0.8m 로 되돌린다(떨어지지 않는다) */
  function clampIn(o) {
    var np = o ? nearPad(o.x, o.y) : null, c = np ? np.pad : null;
    if (!c) { return false; }
    var dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy), lim = c.r - 0.8;
    if (d <= lim) { return false; }
    o.x = c.x + dx / d * lim; o.y = c.y + dy / d * lim;
    return true;
  }

  /* 불러오기 — 발판 단계(발판의 boot 칸)인데 그 발판 위 자리면 몸을 올린다(몸 층은 저장 안 한다). 한 번만 */
  var booted = false;
  function boot() {
    if (booted || !layerOn()) { return; }
    booted = true;
    var v = progress(), p = core().save.player.pos, l = LF(), pd = padAt(p.x, p.y), B = pd && pd.boot ? (Array.isArray(pd.boot[0]) ? pd.boot : [pd.boot]) : [];
    var hit = B.some(function (b) { return v.ch === b[0] && v.step >= b[1] && v.step <= b[2]; });
    if (hit && l.setSky && !l.gliding()) { l.setSky(true); }
  }

  /* ── 화면: 섬·난간·돌 단·먹구름 덮개·바람 기둥 ──────────────── */
  /* 저장소에 CC0 하늘 섬 에셋이 없어 **코드로** 짓는다(SAGA-DESIGN §7 허용) — 원기둥·원뿔·고리만 */
  var fx = { isle: null, cover: null, draft: null }, clock = 0;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function drop(k) { var w = W3(); if (w && fx[k]) { w.removeFx(fx[k]); } fx[k] = null; }
  function buildIsle(T) {
    var g = new T.Group();
    var grass = new T.MeshLambertMaterial({ color: 0x6fa25a }), rock = new T.MeshLambertMaterial({ color: 0x7c7268 }),
      stone = new T.MeshLambertMaterial({ color: 0xb8b0a2 });
    var turf = new T.Mesh(new T.CylinderGeometry(ISLE_R + 0.6, ISLE_R + 0.2, 0.8, 40), grass);
    turf.position.y = -0.4; g.add(turf);
    var slab = new T.Mesh(new T.CylinderGeometry(ISLE_R + 0.2, ISLE_R * 0.8, SLAB - 0.8, 28), rock);
    slab.position.y = -0.8 - (SLAB - 0.8) / 2; g.add(slab);
    var horn = new T.Mesh(new T.ConeGeometry(ISLE_R * 0.8, 20, 18), rock);     // 거꾸로 선 바위 뿔
    horn.rotation.x = Math.PI; horn.position.y = -SLAB - 10; g.add(horn);
    var rail = new T.Mesh(new T.TorusGeometry(ISLE_R - 0.2, 0.14, 6, 64), stone);
    rail.rotation.x = Math.PI / 2; rail.position.y = RAIL_H * 0.85; g.add(rail);
    for (var i = 0; i < 20; i++) {
      var a = i * Math.PI * 2 / 20, post = new T.Mesh(new T.BoxGeometry(0.35, RAIL_H, 0.35), stone);
      post.position.set(Math.sin(a) * (ISLE_R - 0.2), RAIL_H / 2, -Math.cos(a) * (ISLE_R - 0.2)); g.add(post);
    }
    var dais = new T.Mesh(new T.CylinderGeometry(2.2, 2.7, 0.6, 8), stone);        // 북쪽 끝 여섯째 자리
    dais.position.set(0, 0.3, -(ISLE_R - 3.5)); g.add(dais);
    return g;
  }
  function buildCover(T) {
    var g = new T.Group(), mat = new T.MeshBasicMaterial({ color: 0x2b2a38, transparent: true, opacity: 0.62, depthWrite: false });
    for (var i = 0; i < 9; i++) {
      var a = i * 2.39996, r = i ? 5 + (i % 3) * 3 : 0, s = 4.5 + (i % 4) * 1.2;
      var puff = new T.Mesh(new T.SphereGeometry(s, 12, 8), mat);
      puff.scale.y = 0.55;
      puff.position.set(Math.cos(a) * r, 7 + (i % 3) * 1.6, Math.sin(a) * r); g.add(puff);
    }
    return g;
  }
  function buildDraft(T, h) {
    var g = new T.Group();
    var col = new T.Mesh(new T.CylinderGeometry(DRAFT_R, DRAFT_R, h, 20, 1, true),
      new T.MeshBasicMaterial({ color: 0xcff4ff, transparent: true, opacity: 0.14, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false }));
    col.position.y = h / 2; g.add(col);
    for (var i = 0; i < 4; i++) {
      var ring = new T.Mesh(new T.TorusGeometry(DRAFT_R * 0.9, 0.08, 4, 32),
        new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      ring.rotation.x = Math.PI / 2; ring.userData.k = i / 4; g.add(ring);
    }
    g.userData.h = h;
    return g;
  }
  function paint3d(dt) {
    clock += dt || 0;
    var w = W3(), c = on() ? spot() : null, p = c ? peak() : null, me = core().save.player.pos;
    if (!w || !c || Math.hypot(me.x - c.x, me.y - c.y) > 2200) { drop('isle'); drop('cover'); drop('draft'); return; }
    var T = w.three();
    if (!T) { return; }
    var ty = top();
    if (!fx.isle) { fx.isle = w.addFx(buildIsle(T)); }
    fx.isle.position.set(c.x, ty, c.y);
    if (!cleared()) {
      if (!fx.cover) { fx.cover = w.addFx(buildCover(T)); }
      fx.cover.position.set(c.x, ty, c.y);
      fx.cover.rotation.y = clock * 0.05;
    } else { drop('cover'); }
    if (open()) {
      var gy = reliefH(p.x, p.y), h = draftTop() - gy;
      if (!fx.draft || Math.abs(fx.draft.userData.h - h) > 0.5) { drop('draft'); fx.draft = w.addFx(buildDraft(T, h)); }
      fx.draft.position.set(p.x, gy, p.y);
      fx.draft.children.forEach(function (m, i) {
        if (!i) { m.material.opacity = 0.12 + Math.sin(clock * 2.4) * 0.04; return; }
        var k = (m.userData.k + clock * 0.35) % 1;
        m.position.y = k * h; m.material.opacity = 0.55 * (1 - k);
      });
    } else { drop('draft'); }
  }

  function tick(dt) {
    if (!core() || !core().save) { return; }
    boot();
    if (!global.DG_NO_DRAW) { paint3d(dt); }
  }

  global.DG = global.DG || {};
  global.DG.skyIsle = {
    ISLE_OFF: ISLE_OFF, ISLE_R: ISLE_R, ISLE_UP: ISLE_UP, RAIL_H: RAIL_H, SLAB: SLAB, SKY_CH: SKY_CH, SKY_STEPS: SKY_STEPS,
    DRAFT_R: DRAFT_R, DRAFT_OVER: DRAFT_OVER, DRAFT_RISE: DRAFT_RISE, DRAFT_MIN_AIR: DRAFT_MIN_AIR,
    on: on, layerOn: layerOn, peak: peak, spot: spot, top: top, draftTop: draftTop, inside: inside, open: open, cleared: cleared,
    inDraft: inDraft, meOnSky: meOnSky, pads: pads, padAt: padAt, padById: padById, nearPad: nearPad, drafts: drafts, draftAt: draftAt, apart: apart, clampIn: clampIn, tick: tick,
    _resetForTest: function () { booted = false; }
  };
})(window);
