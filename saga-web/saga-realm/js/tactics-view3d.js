/**
 * 5천하 — 격자 전술판 3D (W-0159, 파이어 엠블렘 풍화설월 3D 문법)
 * ---------------------------------------------------------------
 * 2D 전술판(`tactics-view.js`, SVG 8×6)의 **그림만** 3D 로 바꾼다. 칸·이동·명중·적 AI·결과는 전부 `DG.tactics`,
 * 고르기·턴·결과 카드·글은 전부 `tactics-view.js` 그대로 — 이 파일은 그 `render()` 뒤에 불려 판 자리(.tv-board)의
 * SVG 를 숨기고 캔버스를 올린다. 칸을 누르면 `tacticsView.tap(x, y)` 를 부른다(2D 와 같은 입력).
 *
 *   땅     칸 하나 = 1 단위 상자. 지형 높이 plain 0 · forest 0.2 · river −0.3 · wall 0.8, 무늬는 2D 와 같은 타일 그림
 *          (숲은 원뿔 나무 둘, 성벽은 성가퀴) — 판 밑은 넓은 들 한 장
 *   칸     고른 장수가 갈 칸 = 2D 와 같은 하늘빛 판, 칠 수 있는 적 = 머리 위 명중 % 표
 *   몸     장수 = `asset3d.buildHero`(그 장수 몸), 부대 = `buildTrooper`(보병, 진영 색) — 못 받으면 진영 색 기둥
 *   연출   자리가 바뀌면 칸마다 0.25초 걷기(가로 먼저), 기록(log)에 새 줄이 생기면 차례로 휘두름 0.4초 → 맞은 쪽 피격·흔들림,
 *          쓰러지면 death 몸짓 뒤 사라짐. 적 턴은 모두 걸은 뒤 공격을 한 줄씩
 *   카메라 판 위 3/4(내려다보는 각 50°), 장수를 고르면 그쪽으로 살짝 당긴다. 좁은 화면(2D 가 눕히는 판)은 내 편이 아래로 오게 돈다
 *
 * 손잡이 `tactics3d`(1 기본, 0 = 2D 판). three·WebGL 이 없으면 2D 판 그대로. 그리기 배율은 지도 3D 품질 등급(realm3d)과 같다.
 * 순수 함수 `want()`·`cellCenter()`·`cellOf()` 는 three 없이 돈다 — 자가진단이 본다.
 */
(function (global) {
  'use strict';

  var HGT = { plain: 0, forest: 0.2, river: -0.3, wall: 0.8 };
  var COL = { plain: 0xc8b47a, forest: 0x5f8446, river: 0x4f86b3, wall: 0x857563 };
  var SIDE = { me: 0x3d8bd9, foe: 0xd24b3c };
  var STEP_S = 0.25, SWING_S = 0.4, PITCH = 50 * Math.PI / 180, FOV = 40;

  function C() { return global.DG.core; }
  function T() { return global.DG.tactics; }
  function TV() { return global.DG.tacticsView; }
  function three() { return global.THREE || null; }
  function A3() { return global.DG.asset3d; }

  /* ══ 순수 층 ═══════════════════════════════════════════════ */

  var glOk = null;
  function webgl() {
    if (glOk !== null) { return glOk; }
    try { var c = global.document.createElement('canvas'); glOk = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { glOk = false; }
    return glOk;
  }
  /** 3D 판을 쓸까 — o 를 주면 그 값으로만 판단(진단) */
  function want(o) {
    o = o || { knob: C() && C().tuned ? C().tuned('tactics3d', 1) : 1, three: !!three(), gl: webgl() };
    return !!(o.knob && o.three && o.gl);
  }
  /** 칸 (x, y) → 판 가운데가 원점인 땅 자리(칸 = 1) */
  function cellCenter(x, y, cols, rows) { return { x: x - (cols - 1) / 2, z: y - (rows - 1) / 2 }; }
  /** 땅 자리 → 칸 (x, y) · 판 밖이면 null */
  function cellOf(px, pz, cols, rows) {
    var x = Math.round(px + (cols - 1) / 2), y = Math.round(pz + (rows - 1) / 2);
    return (x < 0 || y < 0 || x >= cols || y >= rows) ? null : { x: x, y: y };
  }

  /* ══ 그림 층 ═══════════════════════════════════════════════ */

  var R = null, scene = null, cam = null, cv = null, boardGrp = null, hiGrp = null, unitGrp = null;
  var builtFor = null, actors = {}, logSeen = 0, queue = [], loopOn = false, lastT = 0, view = null;
  var texCache = {}, ray = null, mouse = null, why = '-';

  function dprCap() {
    var M = global.DG.realm3d;
    try { var p = M.qualityPreset()[M.tier()]; return p ? p.dpr : 1.5; } catch (e) { return 1.5; }
  }

  function setup() {
    var t = three();
    if (R) { return true; }
    try {
      cv = global.document.createElement('canvas');
      cv.className = 'tv3d';
      R = new t.WebGLRenderer({ canvas: cv, antialias: true, alpha: false });
    } catch (e) { R = null; why = 'WebGL 실패'; return false; }
    R.setPixelRatio(Math.min(global.devicePixelRatio || 1, dprCap()));
    var TN = global.DG.toon3d;
    if (TN && TN.toneRenderer) { TN.toneRenderer(R); }
    var LG = TN && TN.lightGain ? TN.lightGain() : 1;
    scene = new t.Scene();
    scene.background = new t.Color(0x26303c);
    scene.add(new t.HemisphereLight(0xffffff, 0x4a5a3a, 0.95 * LG));
    var sun = new t.DirectionalLight(0xfff4e0, 1.0 * LG); sun.position.set(-4, 9, 6); scene.add(sun);
    var field = new t.Mesh(new t.PlaneGeometry(60, 60), new t.MeshLambertMaterial({ color: 0x5d6b42 }));
    field.rotation.x = -Math.PI / 2; field.position.y = -0.62; scene.add(field);
    cam = new t.PerspectiveCamera(FOV, 1, 0.1, 200);
    boardGrp = new t.Group(); hiGrp = new t.Group(); unitGrp = new t.Group();
    scene.add(boardGrp); scene.add(hiGrp); scene.add(unitGrp);
    ray = new t.Raycaster(); mouse = new t.Vector2();
    cv.addEventListener('click', onClick);
    why = 'ok';
    return true;
  }

  function tex(kind) {
    var t = three();
    if (texCache[kind] !== undefined) { return texCache[kind]; }
    var href = TV() && TV().tileHref ? TV().tileHref(kind) : '';
    texCache[kind] = null;
    if (!href) { return null; }
    texCache[kind] = new t.TextureLoader().load(href);
    if (t.SRGBColorSpace) { texCache[kind].colorSpace = t.SRGBColorSpace; }
    return texCache[kind];
  }

  function clear(g) { while (g.children.length) { g.remove(g.children[0]); } }

  /** 땅 — 판(board)이 바뀔 때 한 번 */
  function buildBoard(b) {
    var t = three(), x, y;
    clear(boardGrp); clear(unitGrp); actors = {}; queue = []; logSeen = b.log.length;
    var mats = {};
    for (y = 0; y < b.rows; y++) {
      for (x = 0; x < b.cols; x++) {
        var k = T().cellAt(b, x, y), h = HGT[k] || 0, p = cellCenter(x, y, b.cols, b.rows);
        if (!mats[k]) { mats[k] = new t.MeshLambertMaterial({ color: k === 'plain' ? 0xd8c48a : 0xffffff, map: tex(k) }); if (!mats[k].map) { mats[k].color.setHex(COL[k]); } }
        var m = new t.Mesh(new t.BoxGeometry(0.97, 0.6 + h, 0.97), mats[k]);
        m.position.set(p.x, (h - 0.6) / 2, p.z);
        m.userData.cell = { x: x, y: y };
        boardGrp.add(m);
        if (k === 'forest') { tree(p.x - 0.22, h, p.z - 0.18, 0.55); tree(p.x + 0.24, h, p.z + 0.16, 0.42); }
        if (k === 'wall') {
          for (var i = 0; i < 3; i++) { var c = new t.Mesh(new t.BoxGeometry(0.2, 0.18, 0.2), mats.wall); c.position.set(p.x - 0.33 + i * 0.33, h + 0.09, p.z - 0.38); boardGrp.add(c); }
        }
      }
    }
    var frame = new t.Mesh(new t.BoxGeometry(b.cols + 0.3, 0.5, b.rows + 0.3), new t.MeshLambertMaterial({ color: 0x3b3326 }));
    frame.position.y = -0.36; boardGrp.add(frame);
  }
  var treeMat = null, trunkMat = null;
  function tree(x, h, z, s) {
    var t = three();
    if (!treeMat) { treeMat = new t.MeshLambertMaterial({ color: 0x2f5a2c }); trunkMat = new t.MeshLambertMaterial({ color: 0x5a4127 }); }
    var tr = new t.Mesh(new t.CylinderGeometry(0.04 * s * 2, 0.05 * s * 2, 0.25 * s, 6), trunkMat); tr.position.set(x, h + 0.12 * s, z); boardGrp.add(tr);
    var cn = new t.Mesh(new t.ConeGeometry(0.28 * s, 0.75 * s, 7), treeMat); cn.position.set(x, h + 0.25 * s + 0.37 * s, z); boardGrp.add(cn);
  }

  /** W-0168 엄폐 방패(반 30·온 50) — 칸 위에 뜨는 표지판. 갈 칸은 하늘빛, 노릴 적은 붉은빛. 손잡이 realm.coverMark 0 = 없음 */
  var shieldTex = {};
  function shieldSprite(cov, foe) {
    var t = three(), key = cov + (foe ? 'f' : 'm');
    if (!shieldTex[key]) {
      var c = global.document.createElement('canvas'); c.width = 64; c.height = 64;
      var g = c.getContext('2d'), col = foe ? '#ff9a7a' : '#9fe3ff', full = cov >= 50;
      g.beginPath(); g.moveTo(32, 6); g.lineTo(54, 15); g.lineTo(51, 36); g.quadraticCurveTo(32, 60, 13, 36); g.lineTo(10, 15); g.closePath();
      g.fillStyle = full ? col : 'rgba(0,0,0,0.55)'; g.fill(); g.lineWidth = 5; g.strokeStyle = col; g.stroke();
      if (!full) { g.beginPath(); g.moveTo(32, 6); g.lineTo(54, 15); g.lineTo(51, 36); g.quadraticCurveTo(42, 49, 32, 52); g.closePath(); g.fillStyle = col; g.fill(); }
      shieldTex[key] = new t.CanvasTexture(c);
    }
    var sp = new t.Sprite(new t.SpriteMaterial({ map: shieldTex[key], depthTest: false, transparent: true }));
    sp.scale.set(0.42, 0.42, 1); sp.renderOrder = 11;
    return sp;
  }
  function coverOn() { var C = global.DG.core; return !(C && C.tuned && !C.tuned('realm.coverMark', 1)); }

  /** 고른 장수의 갈 칸·고른 칸 고리 — render 마다 */
  var hiMat = null, selMat = null;
  function buildHighlights(v) {
    var t = three(), b = v.b;
    clear(hiGrp);
    if (!hiMat) { hiMat = new t.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.38, depthWrite: false }); selMat = new t.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, depthWrite: false }); }
    var u = v.sel ? T().unit(b, v.sel) : null;
    if (!u || u.hp <= 0 || b.done) { return; }
    if (!u.moved) {
      T().moves(b, u.uid).forEach(function (m) {
        var p = cellCenter(m.x, m.y, b.cols, b.rows), h = HGT[T().cellAt(b, m.x, m.y)] || 0;
        var q = new t.Mesh(new t.PlaneGeometry(0.86, 0.86), hiMat); q.rotation.x = -Math.PI / 2; q.position.set(p.x, h + 0.02, p.z); hiGrp.add(q);
        var cv0 = T().coverAt(b, m.x, m.y); if (cv0 && coverOn()) { var sh0 = shieldSprite(cv0, false); sh0.position.set(p.x + 0.3, h + 0.35, p.z - 0.3); hiGrp.add(sh0); }   // W-0168
      });
    }
    if (!u.acted && coverOn()) {   // W-0168 — 노릴 수 있는 적이 엄폐에 섰으면 그 머리 위 옆에
      T().alive(b, 'foe').forEach(function (e) {
        var ce = T().coverAt(b, e.x, e.y);
        if (!ce || Math.abs(u.x - e.x) + Math.abs(u.y - e.y) > u.rng) { return; }
        var pe = cellCenter(e.x, e.y, b.cols, b.rows), he = HGT[T().cellAt(b, e.x, e.y)] || 0, se = shieldSprite(ce, true); se.position.set(pe.x + 0.34, he + 1.15, pe.z); hiGrp.add(se);
      });
    }
    var sp = cellCenter(u.x, u.y, b.cols, b.rows), sh = HGT[T().cellAt(b, u.x, u.y)] || 0;
    var ring = new t.Mesh(new t.RingGeometry(0.36, 0.46, 24), selMat); ring.rotation.x = -Math.PI / 2; ring.position.set(sp.x, sh + 0.03, sp.z); hiGrp.add(ring);
  }

  /* ── 표(hp 띠·명중 %) — 캔버스 스프라이트 ── */
  function tagSprite() {
    var t = three(), c = global.document.createElement('canvas'); c.width = 128; c.height = 48;
    var s = new t.Sprite(new t.SpriteMaterial({ map: new t.CanvasTexture(c), depthTest: false, transparent: true }));
    s.scale.set(0.9, 0.34, 1); s.renderOrder = 10; s.userData.cv = c; s.userData.key = '';
    return s;
  }
  function drawTag(s, f, hit) {
    var key = f.toFixed(3) + '|' + hit;
    if (s.userData.key === key) { return; }
    s.userData.key = key;
    var c = s.userData.cv, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (hit != null) { g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(34, 0, 60, 24); g.fillStyle = '#ffd75e'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.fillText(hit + '%', 64, 19); }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(14, 32, 100, 10);
    g.fillStyle = f > 0.5 ? '#5bd16a' : (f > 0.25 ? '#e3c33f' : '#e2553f'); g.fillRect(14, 32, 100 * Math.max(0, f), 10);
    s.material.map.needsUpdate = true;
  }

  /** 유닛 하나 — 몸은 비동기, 오기 전엔 진영 색 기둥 */
  function makeActor(u, b) {
    var t = three(), grp = new t.Group(), col = SIDE[u.side] || 0xffffff;
    var stub = new t.Mesh(new t.CylinderGeometry(0.2, 0.24, 0.7, 10), new t.MeshLambertMaterial({ color: col }));
    stub.position.y = 0.35; grp.add(stub);
    var base = new t.Mesh(new t.CircleGeometry(0.34, 20), new t.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false }));
    base.rotation.x = -Math.PI / 2; base.position.y = 0.025; grp.add(base);
    var tag = tagSprite(); tag.position.y = 1.15; grp.add(tag);
    var p = cellCenter(u.x, u.y, b.cols, b.rows);
    var a = { uid: u.uid, grp: grp, stub: stub, tag: tag, model: null, gx: u.x, gy: u.y, path: [], face: u.side === 'me' ? Math.PI / 2 : -Math.PI / 2,
      anim: 'idle', animUntil: 0, lunge: null, shake: 0, dying: 0, gone: false };
    grp.position.set(p.x, HGT[T().cellAt(b, u.x, u.y)] || 0, p.z);
    grp.rotation.y = a.face;
    unitGrp.add(grp);
    var A = A3(), O = global.DG.off;
    function put(m, sc) {
      if (!m || a.gone) { return; }
      m.scale.setScalar(sc); grp.remove(stub); grp.add(m); a.model = m;
    }
    if (A && u.kind === 'officer' && A.buildHero && O && O.find && O.find(u.id)) { A.buildHero(O.find(u.id), col, function (m) { put(m, 1.05); }); }
    else if (A && A.buildTrooper) { A.buildTrooper('inf', col, function (m) { put(m, 0.78); }); }
    actors[u.uid] = a;
    return a;
  }

  /** 판 자료 → 배우 목표(걷기 길·공격 차례) */
  function syncActors(v, nowS) {
    var b = v.b, rc = reachHits(v), walkEnd = nowS;
    b.units.forEach(function (u) {
      var a = actors[u.uid] || (u.hp > 0 ? makeActor(u, b) : null);
      if (!a) { return; }
      if (a.gx !== u.x || a.gy !== u.y) {
        var x = a.gx, y = a.gy, path = [];
        while (x !== u.x) { x += x < u.x ? 1 : -1; path.push({ x: x, y: y }); }
        while (y !== u.y) { y += y < u.y ? 1 : -1; path.push({ x: x, y: y }); }
        a.path = a.path.concat(path); a.gx = u.x; a.gy = u.y;
        walkEnd = Math.max(walkEnd, nowS + a.path.length * STEP_S);
      }
      drawTag(a.tag, Math.max(0, u.hp / u.max), rc[u.uid] != null ? rc[u.uid] : null);
      a.tag.material.opacity = u.side === 'me' && u.moved && u.acted ? 0.55 : 1;
    });
    /* 새 기록 줄 — 걸음이 끝난 뒤 한 줄씩 */
    var at = Math.max(walkEnd, queue.length ? queue[queue.length - 1].at + SWING_S + 0.15 : nowS);
    for (; logSeen < b.log.length; logSeen++) {
      var e = b.log[logSeen], tu = T().unit(b, e.to);
      queue.push({ at: at, a: e.a, to: e.to, hit: !!e.hit, dead: !!(e.hit && tu && tu.hp <= 0) });
      at += SWING_S + 0.15;
    }
  }
  function reachHits(v) {
    var b = v.b, u = v.sel ? T().unit(b, v.sel) : null, out = {};
    if (!u || u.hp <= 0 || b.done || u.acted) { return out; }
    T().alive(b, 'foe').forEach(function (t) {
      if (Math.abs(u.x - t.x) + Math.abs(u.y - t.y) <= u.rng) { out[t.uid] = T().hitChance(u, t, T().coverAt(b, t.x, t.y)); }
    });
    return out;
  }

  function play(a, slot, nowS, force) {
    a.anim = slot;
    if (a.model && A3() && A3().step) { A3().step(a.model, { anim: slot, t: nowS, force: force }); }
  }

  function frame(nowS) {
    var b = view && view.b;
    if (!b) { return; }
    var dt = Math.min(0.1, Math.max(0, nowS - lastT)); lastT = nowS;
    /* 공격 차례 */
    while (queue.length && queue[0].at <= nowS) {
      var q = queue.shift(), A = actors[q.a], D = actors[q.to];
      if (A) {
        A.lunge = { t0: nowS, to: D ? { x: D.grp.position.x, z: D.grp.position.z } : null };
        if (D) { A.grp.rotation.y = Math.atan2(D.grp.position.x - A.grp.position.x, D.grp.position.z - A.grp.position.z); }
        play(A, 'attack', nowS, true); A.animUntil = nowS + SWING_S + 0.2;
        var ua = T().unit(b, q.a), C0 = global.DG.core;   // W-0168 — 공격자 어깨 너머로 잠깐 당긴다(1.1초, 2D 컷과 같은 길이). 손잡이 tactics3d.cutCam 0 = 안 함
        if (D && ua && ua.side === 'me' && queue.length === 0 && !(C0 && C0.tuned && !C0.tuned('tactics3d.cutCam', 1))) {
          var ax = A.grp.position.x, az = A.grp.position.z, ddx = D.grp.position.x - ax, ddz = D.grp.position.z - az, dl = Math.hypot(ddx, ddz) || 1;
          ddx /= dl; ddz /= dl;
          view.cutCam = { until: nowS + 1.1, pos: { x: ax - ddx * 1.7 - ddz * 0.7, y: 1.7, z: az - ddz * 1.7 + ddx * 0.7 }, look: { x: ax + ddx * dl * 0.6, y: 0, z: az + ddz * dl * 0.6 } };
        }
      }
      if (D && q.hit) {
        D.shake = 0.35;
        if (q.dead) { D.dying = nowS + SWING_S * 0.6; } else { D.hitAt = nowS + SWING_S * 0.6; }
      }
    }
    Object.keys(actors).forEach(function (k) {
      var a = actors[k], g = a.grp;
      if (a.gone) { return; }
      /* 걷기 */
      if (a.path.length) {
        var nx = a.path[0], p = cellCenter(nx.x, nx.y, b.cols, b.rows), ty = HGT[T().cellAt(b, nx.x, nx.y)] || 0;
        var dx = p.x - g.position.x, dz = p.z - g.position.z, d = Math.hypot(dx, dz), spd = dt / STEP_S;
        g.rotation.y = Math.atan2(dx, dz);
        if (d <= spd) { g.position.set(p.x, ty, p.z); a.path.shift(); if (!a.path.length) { g.rotation.y = a.face; } }
        else { g.position.x += dx / d * spd; g.position.z += dz / d * spd; g.position.y += (ty - g.position.y) * Math.min(1, dt * 8); }
        if (a.anim !== 'walk') { play(a, 'walk', nowS); }
      } else if (a.anim === 'walk') { play(a, 'idle', nowS); }
      /* 휘두름 — 0.3 칸 나갔다 돌아온다 */
      if (a.lunge) {
        var f = (nowS - a.lunge.t0) / SWING_S;
        if (f >= 1) { a.lunge = null; if (a.model) { a.model.position.set(0, 0, 0); } g.rotation.y = a.face; }
        else if (a.model) { var s = Math.sin(f * Math.PI) * 0.3; a.model.position.set(0, 0, s); }
      }
      if (a.anim === 'attack' && nowS > a.animUntil && !a.dying) { play(a, 'idle', nowS); }
      if (a.hitAt && nowS >= a.hitAt) { a.hitAt = 0; play(a, 'hit', nowS, true); a.animUntil = nowS + 0.5; }
      if (a.anim === 'hit' && nowS > a.animUntil) { play(a, 'idle', nowS); }
      if (a.shake > 0) { a.shake = Math.max(0, a.shake - dt); var sh = Math.sin(nowS * 70) * 0.05 * (a.shake / 0.35); (a.model || a.stub).position.x = sh; }
      /* 쓰러짐 */
      if (a.dying && nowS >= a.dying) {
        if (a.anim !== 'death') { play(a, 'death', nowS, true); a.goneAt = nowS + 1.4; if (!a.model) { a.stub.rotation.z = Math.PI / 2; } a.tag.visible = false; }
        if (nowS >= a.goneAt) { a.gone = true; unitGrp.remove(g); }
      }
      if (a.model && A3() && A3().step) { A3().step(a.model, { anim: a.anim, t: nowS }); }
    });
  }

  function aimCamera(v) {
    var b = v.b, asp = cam.aspect || 1, half = Math.tan(FOV * Math.PI / 360);
    var vert = !!v.vert, w = (vert ? b.rows : b.cols) + 1.2, d = (vert ? b.cols : b.rows) + 1.2;
    var dist = Math.max(w / 2 / (half * asp), (d * Math.sin(PITCH) / 2 + 0.7) / half);   // 가로 폭 · 50° 로 눕힌 깊이(+몸 키) 둘 다 담는 가장 가까운 거리
    var tx = 0, tz = 0, u = v.sel ? T().unit(b, v.sel) : null;
    if (u && u.hp > 0) { var p = cellCenter(u.x, u.y, b.cols, b.rows); tx = p.x * 0.25; tz = p.z * 0.25; dist *= 0.9; }
    var yaw = vert ? -Math.PI / 2 : 0;   // 눕힌 판 — 내 편(왼쪽 x)이 카메라 쪽(아래)으로
    var want = { x: tx + Math.sin(yaw) * Math.cos(PITCH) * dist, y: Math.sin(PITCH) * dist, z: tz + Math.cos(yaw) * Math.cos(PITCH) * dist };
    view.camWant = { pos: want, look: { x: tx, y: 0, z: tz } };
  }

  function loop() {
    if (!loopOn) { return; }
    if (!view || !cv || !cv.isConnected) { loopOn = false; return; }
    var nowS = (global.performance ? global.performance.now() : Date.now()) / 1000;
    frame(nowS);
    var cw = (view.cutCam && nowS < view.cutCam.until) ? view.cutCam : view.camWant;   // W-0168 공격 컷이면 그쪽
    if (cw) {
      var cp = cam.position;
      cp.x += (cw.pos.x - cp.x) * 0.15; cp.y += (cw.pos.y - cp.y) * 0.15; cp.z += (cw.pos.z - cp.z) * 0.15;
      view.look = view.look || { x: cw.look.x, y: 0, z: cw.look.z };
      view.look.x += (cw.look.x - view.look.x) * 0.15; view.look.z += (cw.look.z - view.look.z) * 0.15;
      cam.lookAt(view.look.x, 0, view.look.z);
    }
    R.render(scene, cam);
    global.requestAnimationFrame(loop);
  }

  function size(host, v) {
    var w = Math.max(264, host.clientWidth || 0), h = Math.round(w * (v.vert ? 1.15 : 0.66));
    h = Math.min(h, Math.max(240, Math.round((global.innerHeight || 800) * 0.6)));
    R.setSize(w, h, true);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }

  /**
   * tactics-view 의 render() 뒤 — 판 자리(boardEl)의 SVG 를 숨기고 캔버스를 올린다.
   * @return 3D 를 붙였으면 true(아니면 2D 판 그대로)
   */
  function attach(v, boardEl) {
    if (!v || !boardEl || !want() || !setup()) { return false; }
    var svg = boardEl.querySelector('.tv-svg');
    if (svg) { svg.style.display = 'none'; }
    boardEl.insertBefore(cv, boardEl.firstChild);
    size(boardEl, v);
    var nowS = (global.performance ? global.performance.now() : Date.now()) / 1000;
    if (builtFor !== v.b) {
      builtFor = v.b; buildBoard(v.b);
      cam.position.set(0, 9, 9);
      view = v; view.look = null;
    }
    view = v;
    syncActors(v, nowS);
    buildHighlights(v);
    aimCamera(v);
    if (!view.look) { cam.position.set(view.camWant.pos.x, view.camWant.pos.y, view.camWant.pos.z); }
    if (!loopOn) { loopOn = true; lastT = nowS; global.requestAnimationFrame(loop); }
    return true;
  }

  function onClick(e) {
    if (!view || !TV()) { return; }
    var r = cv.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, cam);
    var b = view.b, hits = ray.intersectObjects(unitGrp.children, true), i, o;
    for (i = 0; i < hits.length; i++) {
      for (o = hits[i].object; o && o !== unitGrp; o = o.parent) {
        var k = Object.keys(actors).filter(function (id) { return actors[id].grp === o; })[0];
        if (k) { var u = T().unit(b, k); if (u && u.hp > 0) { TV().tap(u.x, u.y); return; } }
      }
    }
    hits = ray.intersectObjects(boardGrp.children, false);
    for (i = 0; i < hits.length; i++) {
      var c = hits[i].object.userData.cell || cellOf(hits[i].point.x, hits[i].point.z, b.cols, b.rows);
      if (c) { TV().tap(c.x, c.y); return; }
    }
    TV().tap(-1, -1);
  }

  global.DG = global.DG || {};
  global.DG.tacticsView3d = {
    want: want, cellCenter: cellCenter, cellOf: cellOf, HGT: HGT, attach: attach, _cutCam: function () { return view && view.cutCam ? view.cutCam : null; },   // W-0168 진단
    _actor: function (uid) { var a = actors[uid]; return a ? { x: a.grp.position.x, z: a.grp.position.z, path: a.path.length, anim: a.anim, body: !!a.model, gone: a.gone } : null; },   // 진단·점검
    stats: function () { return { why: why, on: !!R, actors: Object.keys(actors).length, bodies: Object.keys(actors).filter(function (k) { return !!actors[k].model; }).length, queue: queue.length, loop: loopOn }; }
  };
})(window);
