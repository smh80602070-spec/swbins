/**
 * 1만리 3D 검기 띠 (W-0173) — 휘두를 때 칼끝이 지나간 자리에 잠깐 남는 빛 띠
 * ---------------------------------------------------------------
 * 무기 몸짓(W-0169)만으로는 "어디를 베었는지"가 화면에서 잘 안 읽혔다. 휘두름(swing)마다 내 앞에
 * 부채꼴 띠(가산, 0.22초)를 그린다 — 무기·연속 단마다 모양이 다르다:
 *   한손검 1타 가로(오른→왼) · 2타 비스듬히 아래→위 · 3타 세로 내려찍기(크게)
 *   큰날 넓고 두껍게 · 창 앞으로 곧은 찌르기 띠 · 서책·활은 띠 없음(쏘는 무기 — 기존 고리가 맡는다)
 * 판정(field-combat)은 한 자도 안 바꾼다 — 그쪽이 swing 이벤트를 낼 때 `slash3d.swing(w, step, x, y, ang)` 만 부른다.
 * 손잡이 `field.slashFx`(1, 0 = 없음). arcSpec() 은 three 없이 돈다 — 자가진단이 본다.
 */
(function (global) {
  'use strict';

  function C() { return global.DG && global.DG.core; }
  function tuned(k, d) { var c = C(); return c && c.tuned ? c.tuned(k, d) : d; }
  function W3() { return global.DG && global.DG.world3d; }

  /** 무기·단 → 띠 모양 { kind: 'arc'|'thrust'|null, r 반지름(m), w 두께, tilt 기울기(라디안), span 호 길이, dir +1 = 오른→왼, color, life } */
  function arcSpec(w, step) {
    var s = step | 0;
    if (w === 'catalyst' || w === 'bow') { return { kind: null }; }
    if (w === 'polearm') {
      return { kind: 'thrust', r: s === 2 ? 3.2 : 2.4, w: s === 2 ? 0.5 : 0.32, tilt: 0, span: 0, dir: 1, color: 0xdff4ff, life: s === 2 ? 0.26 : 0.18 };
    }
    var big = w === 'claymore';
    if (s === 2) { return { kind: 'arc', r: big ? 2.6 : 2.1, w: big ? 0.7 : 0.5, tilt: Math.PI / 2, span: Math.PI * 0.9, dir: 1, color: big ? 0xffe2a8 : 0xffffff, life: 0.28 }; }
    if (s === 1) { return { kind: 'arc', r: big ? 2.3 : 1.8, w: big ? 0.55 : 0.36, tilt: -0.7, span: Math.PI * 0.85, dir: -1, color: big ? 0xffe2a8 : 0xeaf6ff, life: 0.22 }; }
    return { kind: 'arc', r: big ? 2.3 : 1.8, w: big ? 0.55 : 0.36, tilt: 0.12, span: Math.PI * 0.95, dir: 1, color: big ? 0xffe2a8 : 0xeaf6ff, life: 0.22 };
  }

  var live = [], ticking = false;

  /** 휘두름 한 번 — x,y = 내 자리(세계), ang = 내가 보는 쪽(라디안, atan2(dx, dy) 규약) */
  function swing(w, step, x, y, ang) {
    if (!tuned('field.slashFx', 1) || global.DG_NO_DRAW) { return null; }
    var W = W3(), T = W && W.three ? W.three() : null, sp = arcSpec(w, step);
    if (!W || !T || !W.addFx || !sp.kind) { return null; }
    var gy = W.standY ? W.standY(x, y) : (W.groundY ? W.groundY(x, y) : 0), AH = tuned('world3d.actorH', 3.4), K = AH / 2.6, cy = AH * 0.55;   // 인물 키(3.4 단위)에 맞춘다 — 가슴 높이·반지름
    var mat = new T.MeshBasicMaterial({ color: sp.color, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    var mesh, grp = new T.Group();
    if (sp.kind === 'thrust') {
      mesh = new T.Mesh(new T.PlaneGeometry(sp.w * K, sp.r * K), mat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, cy, (sp.r / 2 + 0.3) * K);
    } else {
      /* 반지름 r 의 호 띠(가운데가 내 앞 +z) — RingGeometry 각은 +x 에서 시작해 반시계 */
      mesh = new T.Mesh(new T.RingGeometry((sp.r - sp.w) * K, sp.r * K, 32, 1, Math.PI / 2 - sp.span / 2, sp.span), mat);
      mesh.rotation.x = Math.PI / 2;   // +y(호 가운데) → +z(내 앞). −90° 면 등 뒤로 간다(10-11 실전 촬영에서 발견)
      var tiltG = new T.Group(); tiltG.add(mesh); tiltG.rotation.z = sp.tilt; tiltG.position.y = cy;
      if (sp.dir < 0) { tiltG.scale.x = -1; }
      grp.add(tiltG); mesh = null;
    }
    if (mesh) { grp.add(mesh); }
    grp.position.set(x, gy, y);
    grp.rotation.y = ang || 0;
    grp.renderOrder = 6;
    W.addFx(grp);
    live.push({ g: grp, mat: mat, t: 0, life: sp.life, sp: sp });
    if (!ticking) { ticking = true; global.requestAnimationFrame(tick); }
    return grp;
  }

  var lastT = 0;
  function tick(now) {
    var dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016; lastT = now;
    for (var i = live.length - 1; i >= 0; i--) {
      var L = live[i]; L.t += dt;
      var k = L.t / L.life;
      if (k >= 1) { if (L.g.parent) { L.g.parent.remove(L.g); } L.g.traverse(function (o) { if (o.geometry) { o.geometry.dispose(); } }); L.mat.dispose(); live.splice(i, 1); continue; }
      L.mat.opacity = 0.85 * (1 - k) * (1 - k);
      var s = 0.8 + 0.35 * k; L.g.scale.set(s, 1, s);   // 띠가 바깥으로 살짝 퍼지며 사라진다
    }
    if (live.length) { global.requestAnimationFrame(tick); } else { ticking = false; lastT = 0; }
  }

  global.DG = global.DG || {};
  global.DG.slash3d = { swing: swing, arcSpec: arcSpec, live: function () { return live.length; } };
})(window);
