/**
 * 먹구름 눈·여섯 매듭 — 이야기 8부 무대 (PLAN §5 ⑲-52, saga-godot PLAN 106 52-1 `world/storm_eye.gd`)
 * ---------------------------------------------------------------
 *   자리     새 고정 지역이 없다 — 첫 지역들로 돌아온다.
 *   여섯 매듭 1부 여섯 제단 자리(폐허 1장·서쪽 옛길 5장·봉우리 6장·곶 7장·바위섬 8장·구름섬 9장) 북쪽 KNOT_OFF m 에 선 금줄 감은 돌(보기만).
 *            27장(0부터 26)부터 보인다. 풀린 매듭은 먹구름 연기, 다시 묶이면(KNOTS 의 장·단계부터) 불 + 곧은 금빛 줄, 여섯이 다 묶이면
 *            줄이 먹구름 눈 가운데 매듭 등불 한 점으로 모이고, 29장 보스를 쓰러뜨린 뒤엔 줄을 거두고 불만 남는다
 *   먹구름 눈 구름섬(skyisle.js) 서쪽 EYE_WEST m·윗면 EYE_RISE m 위에 뜬 판(반지름 EYE_R, 난간 1m). 28장 아홉째 단계부터 서고 밟힌다(발판 목록).
 *            둘레 먹구름 소용돌이·가운데 매듭 등불. 구름섬 서쪽 가장자리 바람 기둥은 29장부터(활공). 29장 보스 뒤 소용돌이가 걷혀 맑은 하늘 뜰로 남는다
 *   몸       skyisle.js 가 발판(`pads`)·상승 기류(`drafts`)를 이 모듈에서도 받는다 — 오르기·활공·착지는 landform 그대로
 * 세이브 없음(이야기 진행만 읽는다). 그림은 코드 도형(SAGA-DESIGN §7). 판정 층(`knots`·`pads`·`drafts`·`spot`)은 순수.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('stormeye.' + key, def); }
  function SI() { var s = global.DG.skyIsle; return s && s.on && s.on() ? s : null; }
  function STm() { var s = global.DG.story; return s && s.on && s.on() ? s : null; }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }

  /* ── 표 ─────────────────────────────────────────────── */
  var CH27 = 26, CH28 = 27, CH29 = 28;                       // 0부터
  /** 여섯 매듭 — 이야기 제단 자리(story 이름 붙은 자리 + off) · 묶이는 장(0부터)·그 장 단계(이 단계부터 묶임). 제단 자리는 그 장 단계가 세우는 제단과 같다 */
  var KNOTS = [
    { name: '첫째 매듭',   zone: 'gojeong', off: [-30, 26], ch: CH27, step: 4 },
    { name: '둘째 매듭',   spot: 'altar2', ch: CH27, step: 5 },
    { name: '셋째 매듭',   spot: 'peak', off: [-7, -4], ch: CH27, step: 8 },
    { name: '넷째 매듭',   spot: 'cape', ch: CH28, step: 3 },
    { name: '다섯째 매듭', spot: 'isle', ch: CH28, step: 5 },
    { name: '여섯째 매듭', spot: 'sky', sky: true, ch: CH28, step: 8 }
  ];
  var KNOT_OFF = [0, -2.4];                                  // 제단(반지름 0.85)·석등 고리(6m)와 안 겹치게 북쪽으로(+y 남쪽)
  var BEAM_UP = 90;
  var EYE_FROM = [CH28, 9], EYE_CLEAR = [CH29, 6];           // 28장 아홉째 단계부터 보임 · 29장 여섯째 단계(보스 뒤)부터 걷힘
  var EYE_WEST = 36.5, EYE_RISE = 24, EYE_R = 18, EYE_SLAB = 4, LANTERN_H = 3.6, RIM_H = 1;
  var DRAFT_R = 3.5, DRAFT_IN = 3.5, DRAFT_OVER = 9, DRAFT_RISE = 9;

  /* ── 판정(순수) ─────────────────────────────────────── */
  function storyAt() { var s = core() && core().save ? core().save.story : null; return s || { ch: 0, step: 0 }; }
  /** (ch, step) 에 닿았거나 지났나 */
  function reached(ch, step) { var s = storyAt(); return s.ch > ch || (s.ch === ch && (s.step || 0) >= step); }
  function on() { return !!(K('on', 1) && STm()); }
  /** 매듭 돌이 보이나 — 27장부터 */
  function knotsShown() { return on() && storyAt().ch >= CH27; }
  function knotTied(k) { return reached(KNOTS[k].ch, KNOTS[k].step); }
  function allTied() { for (var k = 0; k < KNOTS.length; k++) { if (!knotTied(k)) { return false; } } return true; }
  function eyeShown() { return on() && !!SI() && reached(EYE_FROM[0], EYE_FROM[1]); }
  function eyeClear() { return reached(EYE_CLEAR[0], EYE_CLEAR[1]); }
  function draftOpen() { return K('drafts', 0) ? true : storyAt().ch >= CH29; }
  /** 매듭 k 금빛 줄 — '' 없음 · 'up' 곧게 위로 · 'eye' 매듭 등불로(여섯 다 묶인 뒤 29장 보스 전까지) */
  function beamMode(k) { if (!knotTied(k) || eyeClear()) { return ''; } return allTied() ? 'eye' : 'up'; }
  /** 매듭 k 돌 자리 — { x, y, sky } 또는 null(자리를 모르면) */
  function knotPos(k) {
    var d = KNOTS[k], S = STm(), b = null;
    if (!S) { return null; }
    if (d.zone) { b = S.anchorOf ? S.anchorOf(d.zone) : null; if (b) { b = { x: b.x + d.off[0], y: b.y + d.off[1] }; } }
    else { b = S.spotPos ? S.spotPos(d.spot, d.off) : null; }
    return b ? { x: b.x + KNOT_OFF[0], y: b.y + KNOT_OFF[1], sky: !!d.sky } : null;
  }
  function knots() { var out = []; for (var k = 0; k < KNOTS.length; k++) { var p = knotPos(k); if (p) { out.push({ k: k, name: KNOTS[k].name, x: p.x, y: p.y, sky: p.sky, tied: knotTied(k), beam: beamMode(k) }); } } return out; }
  /** 먹구름 눈 — 구름섬 서쪽. { x, y, r, top, slab } (섬이 안 섰으면 null) */
  function eyeSpot() {
    var S = SI(), c = S ? S.spot() : null;
    if (!c) { return null; }
    return { x: c.x - EYE_WEST, y: c.y, r: EYE_R, top: S.top() + EYE_RISE, slab: EYE_SLAB };
  }
  function lanternPos() { var e = eyeSpot(); return e ? { x: e.x, y: e.y, h: e.top + LANTERN_H } : null; }
  /** skyisle 발판 목록에 붙는다 — 28장 아홉째 단계부터 */
  function pads() {
    var e = eyeShown() ? eyeSpot() : null;
    return e ? [{ id: 'se_eye', name: '먹구름 눈', x: e.x, y: e.y, r: e.r, top: e.top, slab: e.slab }] : [];
  }
  /** skyisle 상승 기류 목록에 붙는다 — 구름섬 서쪽 가장자리 안, 29장부터 */
  function drafts() {
    var S = SI(), c = S ? S.spot() : null, e = eyeShown() ? eyeSpot() : null;
    if (!c || !e || !draftOpen()) { return []; }
    return [{ id: 'se_eye', x: c.x - S.ISLE_R + DRAFT_IN, y: c.y, r: DRAFT_R, top: e.top + DRAFT_OVER, rise: DRAFT_RISE }];
  }
  function spot(part) {
    var e = eyeSpot();
    if (part === 'eye') { return e ? { x: e.x, y: e.y } : null; }
    if (part === 'lantern') { var l = lanternPos(); return l ? { x: l.x, y: l.y } : null; }
    return null;
  }

  /* ── 3D(코드 도형) ───────────────────────────────────── */
  var fx = {}, clock = 0, mats = null;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function reliefH(x, y) { var R = global.DG.relief3d; return R && R.heightAt ? R.heightAt(x, y) : 0; }
  function M(T3) {
    if (mats) { return mats; }
    var add = function (c, a) { return new T3.MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, side: T3.DoubleSide, blending: T3.AdditiveBlending, fog: false }); };
    mats = {
      stone: new T3.MeshLambertMaterial({ color: 0x807d76 }), straw: new T3.MeshLambertMaterial({ color: 0xdcbd75 }), paper: new T3.MeshLambertMaterial({ color: 0xf5f2e6, side: T3.DoubleSide }),
      flame: new T3.MeshBasicMaterial({ color: 0xffb84d }), smoke: new T3.MeshBasicMaterial({ color: 0x33304a, transparent: true, opacity: 0.55, depthWrite: false }),
      slate: new T3.MeshLambertMaterial({ color: 0x4c4c5c }), slateDark: new T3.MeshLambertMaterial({ color: 0x333340 }), grass: new T3.MeshLambertMaterial({ color: 0x7fb866 }),
      gloom: new T3.MeshBasicMaterial({ color: 0x322d42, transparent: true, opacity: 0.7, depthWrite: false }), cloud: new T3.MeshBasicMaterial({ color: 0xeef2f8, transparent: true, opacity: 0.85, depthWrite: false }),
      storm: new T3.MeshBasicMaterial({ color: 0x9e6bf2 }), gold: new T3.MeshBasicMaterial({ color: 0xffd873 }),
      beam: add(0xffdc73, 0.5), draft: add(0xcff4ff, 0.14), ring: add(0xffffff, 0.5)
    };
    return mats;
  }
  function cyl(T3, g, mat, rt, rb, h, x, y, z, seg) {
    var m = new T3.Mesh(new T3.CylinderGeometry(rt, rb, h, seg || 12), mat); m.position.set(x, y, z); g.add(m); return m;
  }
  function buildKnot(T3) {
    var m = M(T3), g = new T3.Group(), o = { root: g, puffs: [], flame: null, beam: null };
    cyl(T3, g, m.stone, 0.5, 0.62, 1.2, 0, 0.6, 0, 10);
    var rope = new T3.Mesh(new T3.TorusGeometry(0.58, 0.07, 6, 16), m.straw); rope.rotation.x = Math.PI / 2; rope.position.y = 0.75; g.add(rope);
    for (var i = 0; i < 3; i++) { var a = i * 2.09; var p = new T3.Mesh(new T3.BoxGeometry(0.12, 0.34, 0.03), m.paper); p.position.set(Math.sin(a) * 0.6, 0.45, Math.cos(a) * 0.6); p.rotation.y = a; g.add(p); }
    for (var s = 0; s < 4; s++) { var puff = new T3.Mesh(new T3.SphereGeometry(0.45 + s * 0.08, 8, 6), m.smoke); puff.userData.k = s / 4; g.add(puff); o.puffs.push(puff); }
    o.flame = new T3.Mesh(new T3.ConeGeometry(0.34, 0.9, 8), m.flame); o.flame.position.y = 1.65; g.add(o.flame);
    o.beam = new T3.Mesh(new T3.CylinderGeometry(0.1, 0.1, 1, 6, 1, true), m.beam); g.add(o.beam);
    return o;
  }
  function buildEye(T3) {
    var m = M(T3), g = new T3.Group(), o = { root: g, vortex: null, calm: null, orb: null, ring: null, floaters: [] };
    cyl(T3, g, m.slate, EYE_R, EYE_R, 0.6, 0, -0.3, 0, 40);
    cyl(T3, g, m.slateDark, EYE_R, EYE_R - 2, EYE_SLAB, 0, -0.6 - EYE_SLAB / 2, 0, 40);
    var cone = new T3.Mesh(new T3.ConeGeometry(EYE_R - 2, 12, 20), m.slateDark); cone.rotation.x = Math.PI; cone.position.y = -0.6 - EYE_SLAB - 6; g.add(cone);
    var rail = new T3.Mesh(new T3.TorusGeometry(EYE_R - 0.4, 0.08, 4, 64), m.stone); rail.rotation.x = Math.PI / 2; rail.position.y = RIM_H; g.add(rail);
    for (var i = 0; i < 20; i++) { var a = i * Math.PI / 10; var post = cyl(T3, g, m.stone, 0.1, 0.1, RIM_H, Math.sin(a) * (EYE_R - 0.4), RIM_H / 2, Math.cos(a) * (EYE_R - 0.4), 5); post.userData.p = 1; }
    o.orb = new T3.Mesh(new T3.SphereGeometry(0.7, 14, 10), m.storm); o.orb.position.y = LANTERN_H; g.add(o.orb);
    var cage = new T3.Mesh(new T3.TorusGeometry(0.95, 0.05, 4, 20), m.stone); cage.position.y = LANTERN_H; g.add(cage);
    cyl(T3, g, m.stone, 0.15, 0.3, LANTERN_H - 0.6, 0, (LANTERN_H - 0.6) / 2, 0, 8);
    o.vortex = new T3.Group();                                                                                   // 둘레 먹구름 소용돌이 벽 — 세 겹 고리
    for (var r = 0; r < 3; r++) {
      for (var j = 0; j < 12; j++) {
        var an = j * Math.PI / 6 + r * 0.5, rad = EYE_R + 2.5 + r * 2.2, s = 3.4 + (j % 3) * 0.9 - r * 0.3;
        var pf = new T3.Mesh(new T3.SphereGeometry(s, 10, 7), m.gloom); pf.scale.y = 1.5;
        pf.position.set(Math.cos(an) * rad, 3 + r * 3.2 + (j % 2) * 1.4, Math.sin(an) * rad); o.vortex.add(pf);
      }
    }
    g.add(o.vortex);
    o.calm = new T3.Group();                                                                                     // 걷히면 맑은 하늘 뜰 — 풀밭·흰 구름 조각
    cyl(T3, o.calm, m.grass, EYE_R - 0.2, EYE_R - 0.2, 0.08, 0, 0.04, 0, 40);
    for (var q = 0; q < 6; q++) { var cp = new T3.Mesh(new T3.SphereGeometry(2 + (q % 3) * 0.6, 10, 7), m.cloud); cp.scale.y = 0.5; cp.position.set(Math.cos(q * 1.05) * (EYE_R + 4), -2 - (q % 2) * 1.5, Math.sin(q * 1.05) * (EYE_R + 4)); o.calm.add(cp); }
    g.add(o.calm);
    return o;
  }
  function buildDraft(T3, h) {
    var m = M(T3), g = new T3.Group();
    var col = new T3.Mesh(new T3.CylinderGeometry(DRAFT_R, DRAFT_R, h, 20, 1, true), m.draft); col.position.y = h / 2; g.add(col);
    for (var i = 0; i < 4; i++) { var ring = new T3.Mesh(new T3.TorusGeometry(DRAFT_R * 0.9, 0.08, 4, 32), m.ring); ring.rotation.x = Math.PI / 2; ring.userData.k = i / 4; g.add(ring); }
    g.userData.h = h;
    return g;
  }
  function near(p, x, y, d) { return Math.hypot(p.x - x, p.y - y) < d; }
  function paint(dt) {
    clock += dt || 0;
    var w = W3(), p = core().save.player.pos, id;
    if (!w || !on()) { if (w) { for (id in fx) { if (fx.hasOwnProperty(id)) { w.removeFx(fx[id].root); } } } fx = {}; return; }
    var T3 = w.three();
    if (!T3) { return; }
    var seen = {};
    if (knotsShown()) {
      knots().forEach(function (q) {
        var key = 'k' + q.k;
        if (!near(p, q.x, q.y, 500)) { return; }
        seen[key] = true;
        var o = fx[key] || (fx[key] = buildKnot(T3)); if (!o.added) { o.added = true; w.addFx(o.root); }
        var gy = w.standY ? w.standY(q.x, q.y, q.sky) : reliefH(q.x, q.y);
        o.root.position.set(q.x, gy, q.y);
        o.tied = q.tied; o.beamMode = q.beam; o.gy = gy;
        o.puffs.forEach(function (pf) { pf.visible = !q.tied; });
        o.flame.visible = q.tied;
      });
    }
    var e = eyeShown() ? eyeSpot() : null;
    if (e && near(p, e.x, e.y, 700)) {
      seen.eye = true;
      var eo = fx.eye || (fx.eye = buildEye(T3)); if (!eo.added) { eo.added = true; w.addFx(eo.root); }
      eo.root.position.set(e.x, e.top, e.y);
      var clr = eyeClear();
      eo.vortex.visible = !clr; eo.calm.visible = clr;
      eo.orb.material = allTied() ? mats.gold : mats.storm;
      var dr = drafts()[0];
      if (dr) {
        var h = dr.top - (SI() ? SI().top() : 0), k = 'd:eye';
        seen[k] = true;
        if (!fx[k] || Math.abs(fx[k].root.userData.h - h) > 0.5) { if (fx[k]) { w.removeFx(fx[k].root); } fx[k] = { root: w.addFx(buildDraft(T3, h)), added: true }; }
        fx[k].root.position.set(dr.x, SI().top(), dr.y);
        fx[k].root.children.forEach(function (mm, i) {
          if (!i) { mm.material.opacity = 0.12 + Math.sin(clock * 2.4) * 0.04; return; }
          var kk = (mm.userData.k + clock * 0.35) % 1; mm.position.y = kk * h;
        });
      }
    }
    for (id in fx) { if (fx.hasOwnProperty(id) && !seen[id]) { w.removeFx(fx[id].root); delete fx[id]; } }
    anim(dt);
  }
  /** 움직이는 조각 — 연기 오름·불꽃 일렁임·금빛 줄(곧게 또는 매듭 등불로)·소용돌이 돎·등불 떠오름 */
  function anim(dt) {
    var L = lanternPos();
    Object.keys(fx).forEach(function (id) {
      var o = fx[id];
      if (o.puffs) {
        o.puffs.forEach(function (pf) { var k = (pf.userData.k + clock * 0.18) % 1; pf.position.set(Math.sin(k * 6 + pf.userData.k * 9) * 0.35, 1.2 + k * 4.5, Math.cos(k * 6) * 0.35); pf.scale.setScalar(0.6 + k); });
        if (o.flame) { o.flame.scale.set(1, 0.8 + Math.sin(clock * 9 + id.length) * 0.2, 1); }
        if (o.beam) {
          var mode = o.beamMode, bm = o.beam;
          bm.visible = !!mode && o.tied;
          if (bm.visible) {
            bm.material.opacity = 0.35 + Math.sin(clock * 2.2) * 0.1;
            if (mode === 'eye' && L && o.root.position) {                                                 // 매듭 등불로 — 줄을 그 점으로 기울인다
              var dx = L.x - o.root.position.x, dy = L.h - (o.gy + 1.2), dz = L.y - o.root.position.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
              bm.scale.set(1, len, 1); bm.position.set(dx / 2, 1.2 + dy / 2, dz / 2);
              bm.rotation.set(Math.acos(dy / len), 0, 0); bm.rotation.order = 'YXZ'; bm.rotation.y = Math.atan2(dx, dz);
            } else { bm.scale.set(1, BEAM_UP, 1); bm.position.set(0, 1.2 + BEAM_UP / 2, 0); bm.rotation.set(0, 0, 0); }
          }
        }
      }
      if (o.vortex && o.vortex.visible) { o.vortex.rotation.y += (dt || 0) * 0.25; }
      if (o.orb) { o.orb.position.y = LANTERN_H + Math.sin(clock * 1.6) * 0.25; }
    });
  }
  function tick(dt) {
    if (!core() || !core().save) { return; }
    if (!global.DG_NO_DRAW) { paint(dt); } else { fx = {}; }
  }

  global.DG = global.DG || {};
  global.DG.stormEye = {
    KNOTS: KNOTS, KNOT_OFF: KNOT_OFF, EYE_FROM: EYE_FROM, EYE_CLEAR: EYE_CLEAR, EYE_WEST: EYE_WEST, EYE_RISE: EYE_RISE, EYE_R: EYE_R, LANTERN_H: LANTERN_H,
    DRAFT_R: DRAFT_R, DRAFT_IN: DRAFT_IN, DRAFT_OVER: DRAFT_OVER, DRAFT_RISE: DRAFT_RISE,
    on: on, knotsShown: knotsShown, knotTied: knotTied, allTied: allTied, beamMode: beamMode, knotPos: knotPos, knots: knots,
    eyeShown: eyeShown, eyeClear: eyeClear, draftOpen: draftOpen, eyeSpot: eyeSpot, lanternPos: lanternPos, pads: pads, drafts: drafts, spot: spot, tick: tick,
    _resetForTest: function () { fx = {}; }
  };
})(window);
