/**
 * 1만리 3D — 랜드마크 거리 이름표 · 멀리 보기(세로 끌기) (W-0162, 야숨 "저기 보이는 곳으로 간다")
 * ---------------------------------------------------------------
 * 지역 랜드마크는 이미 3D 로 선다 — 지역마다 다른 탑 GLB(asset3d `landmark:<biome>`, 멀수록 farBoost 로 커짐)와
 * 안개를 뚫는 빛기둥(biome.js paintBeams). 빠진 둘을 여기서 채운다.
 *
 *   이름표  1.35km 안 랜드마크마다 화면 크기 고정 빌보드(안개·깊이 무시) — 400m 밖이면 "이름 · 1.2km", 안이면 이름만.
 *           탑 꼭대기 위(멀수록 탑과 같은 배율로 올린다). 50m 단위로만 글을 다시 쓴다
 *   멀리 보기 한 손가락·마우스로 **세로로 끌면** 카메라가 내 둘레로 기운다 — 위로 끌면 지평선 쪽(멀리), 아래로 끌면 내려다봄.
 *           손잡이 `world3d.pitchMax`(0.55 rad) 안에서만, 손을 떼면 0.6초 남짓에 원작식 낮은 기본 각으로 돌아온다.
 *           기본 구도에서만 — 대화·조우 무대·활 조준·결투 구도는 안 건드린다(world3d 가 가려 부른다)
 *
 * 손잡이 `world3d.landmark`(1 기본, 0 = 이름표 없음). plan()·clampPitch()·pitchAim() 은 three 없이 돈다 — 자가진단이 본다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var R = 1350, FAR_NEAR = 45, FAR_MAX = 4, TOP = 30, NEAR_TXT = 400, PITCH_MIN = -0.25, BACK_S = 0.6;

  function on() { return !!core.tuned('world3d.landmark', 1); }
  function PITCH_MAX() { return core.tuned('world3d.pitchMax', 0.55); }

  /* ══ 값 층 ═══════════════════════════════════════════════ */

  function distText(d) { return d >= 1000 ? (Math.round(d / 100) / 10).toFixed(1) + 'km' : (Math.round(d / 50) * 50) + 'm'; }
  /** 내 자리 → 이름표 목록(가까운 순, biome.landmarks 그대로) */
  function plan(pos) {
    var B = global.DG.biome;
    if (!B || !B.landmarks || !pos) { return []; }
    return B.landmarks(pos.x, pos.y, R).map(function (l) {
      return { key: l.key, x: l.x, y: l.y, dist: l.dist, text: l.dist > NEAR_TXT ? l.name + ' · ' + distText(l.dist) : l.name,
        lift: TOP * (l.dist < FAR_NEAR ? 1 : Math.min(FAR_MAX, Math.pow(l.dist / FAR_NEAR, 0.85))) };
    });
  }
  function clampPitch(p) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX(), p)); }
  /** 카메라 구도(aim {pos, look})를 내 둘레로 p 만큼 기운다 — 양수 = 지평선 쪽. 내려다보는 각은 3.5°~83° 안 */
  function pitchAim(aim, p) {
    if (!aim || !p) { return aim; }
    var L = aim.look, P = aim.pos, dx = P.x - L.x, dy = P.y - L.y, dz = P.z - L.z, h = Math.hypot(dx, dz) || 1e-6;
    var len = Math.hypot(h, dy), e = Math.max(0.06, Math.min(1.45, Math.atan2(dy, h) - p));
    var k = len * Math.cos(e) / h;
    return { pos: { x: L.x + dx * k, y: L.y + len * Math.sin(e), z: L.z + dz * k }, look: L };
  }

  /* ══ 끌기 상태 ═══════════════════════════════════════════ */

  var pitch = 0, lastTilt = 0, lastT = 0, held = false, bound = false;
  /** 손을 떼면(마우스·손가락·창 밖) 되돌아가기 시작한다 */
  function release() { held = false; }
  function bindRelease() {
    if (bound || !global.addEventListener) { return; }
    bound = true;
    ['mouseup', 'touchend', 'touchcancel', 'pointerup', 'blur'].forEach(function (ev) { global.addEventListener(ev, release, true); });
  }
  function now() { return global.performance && global.performance.now ? global.performance.now() / 1000 : Date.now() / 1000; }
  /** 세로로 끈 만큼(px, 아래 +) — world.js 끌기가 부른다 */
  function tilt(dyPx, geomH) {
    pitch = clampPitch(pitch - dyPx / Math.max(240, geomH || 480) * 1.4);
    lastTilt = now(); held = true; bindRelease();
    return pitch;
  }
  /** 지금 기울기 — 끄는 동안은 그대로, 손을 떼면 0.6초 남짓에 기본 각(0)으로 되돌아간다 */
  function current() {
    var t = now(), dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    if (pitch && !held) { pitch *= Math.exp(-dt * 5 / BACK_S); if (Math.abs(pitch) < 0.004) { pitch = 0; } }
    return pitch;
  }
  /** world3d 카메라 줄이 부른다(기본 구도일 때만) */
  function apply(aim) { return pitchAim(aim, current()); }

  /* ══ 그림 층 — 이름표 ═════════════════════════════════════ */

  var tags = {};
  function tagSprite(T3) {
    var c = global.document.createElement('canvas'); c.width = 512; c.height = 96;
    var tx = new T3.CanvasTexture(c);
    if (T3.SRGBColorSpace) { tx.colorSpace = T3.SRGBColorSpace; }
    var s = new T3.Sprite(new T3.SpriteMaterial({ map: tx, depthTest: false, depthWrite: false, fog: false, transparent: true, sizeAttenuation: false }));
    s.scale.set(0.2, 0.0375, 1); s.renderOrder = 20; s.userData.cv = c; s.userData.text = '';
    return s;
  }
  function drawTag(s, text) {
    if (s.userData.text === text) { return; }
    s.userData.text = text;
    var c = s.userData.cv, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var w = Math.min(c.width - 8, g.measureText(text).width + 44);
    g.fillStyle = 'rgba(20,24,32,.72)'; g.beginPath();
    if (g.roundRect) { g.roundRect((c.width - w) / 2, 14, w, 68, 34); } else { g.rect((c.width - w) / 2, 14, w, 68); }
    g.fill();
    g.fillStyle = '#ffe9a8'; g.fillText('🗼 ' + text, c.width / 2, 50);
    s.material.map.needsUpdate = true;
  }
  /** 한 틱 — biome.js tick 이 빛기둥 옆에서 부른다 */
  function paint(pos) {
    var w = global.DG.world3d;
    if (!w || !w.active || !w.active()) { return; }
    var T3 = w.three(), list = on() ? plan(pos) : [], seen = {}, i;
    if (!T3) { return; }
    for (i = 0; i < list.length; i++) {
      var L = list[i], s = tags[L.key];
      seen[L.key] = true;
      if (!s) { s = tags[L.key] = tagSprite(T3); w.addFx(s); }
      drawTag(s, L.text);
      s.position.set(L.x, (w.groundY ? w.groundY(L.x, L.y) : 0) + L.lift, L.y);
    }
    for (var k in tags) {
      if (Object.prototype.hasOwnProperty.call(tags, k) && !seen[k]) {
        w.removeFx(tags[k]); tags[k].material.map.dispose(); tags[k].material.dispose(); delete tags[k];
      }
    }
  }

  global.DG = global.DG || {};
  global.DG.landmark3d = {
    plan: plan, distText: distText, clampPitch: clampPitch, pitchAim: pitchAim, PITCH_MIN: PITCH_MIN,
    tilt: tilt, current: current, apply: apply, paint: paint,
    stats: function () { return { on: on(), tags: Object.keys(tags).length, pitch: pitch }; },
    _reset: function () { pitch = 0; lastTilt = 0; held = false; }, _release: release
  };
})(window);
