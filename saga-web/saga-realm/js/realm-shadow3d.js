/**
 * 5천하 3D 지도 — 해 그림자 (W-0293 그래픽 기준선)
 * ---------------------------------------------------------------
 * 지도 3D(`realm3d.js`)는 설계상 실제 그림자 대신 발밑 원 데칼(InstancedMesh, name 'blob')만
 * 깔았다 — 인물·성이 떠 보인다(1만리·2나락·3마을·4종횡은 해 그림자를 드리운다). 여기서
 * 해(DirectionalLight)에 그림자 지도를 걸고, 배우·성·길·진(dyn)만 드리우게 한다.
 *
 *   품질  LOW 0(끈다 — 폰을 지킨다) · MEDIUM 1024 · HIGH 2048. 손잡이 `realm3d.shadow`(픽셀 수, 0 = 끔)
 *   카메라 직교 ±260 — 초점(pivot)을 따라다닌다(국토 전체 1000+ 를 한 장에 담으면 계단만 남는다)
 *   해 자리 realm-sky3d 가 하늘 그림 속 해 방향을 원점 기준 d×300 으로 놓는다 → 매 틱 sky 뒤에
 *         같은 방향으로 초점 기준 d×300 에 다시 놓는다(방향은 sky 가 준 그대로)
 *   정적 소품(statGrp·scatter)은 안 드리운다 — 수천 개 InstancedMesh 가 그림자 패스에 통째로
 *         들어가 폰이 뜨겁다. 발밑 데칼은 그대로 둔다(name 'blob'·userData.noShadow 는 건너뜀)
 *
 * **판정에는 한 줄도 안 닿는다.** plan()·mark() 는 three 없이 돈다 — 자가진단이 그것만 본다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var SIZE = { low: 0, medium: 1024, high: 2048 };
  var SPAN = 260, NEAR = 1, FAR = 900, BIAS = -0.0015, DIST = 300;

  /** 품질 등급 → 그림자 계획(순수). 손잡이 realm3d.shadow 가 있으면 그 픽셀 수(0 = 끔) */
  function plan(tier) {
    var k = String(tier || 'high').toLowerCase();
    var base = SIZE[k] === undefined ? SIZE.high : SIZE[k];
    var size = core ? core.tuned('realm3d.shadow', base) : base;
    size = Math.max(0, Math.round(Number(size) || 0));
    return { tier: k, on: size > 0, size: size, span: SPAN, near: NEAR, far: FAR, bias: BIAS };
  }

  /** 메시에 드리우기·받기 표시. 'blob'(발밑 데칼)·userData.noShadow·툰 외곽선 사본은 건너뛴다.
   *  traverse 만 있으면 되므로 three 없이도 돈다(진단). 표시한 메시 수를 돌려준다 */
  var marked = 0;
  function mark(obj) {
    var n = 0;
    if (!obj || typeof obj.traverse !== 'function') { return 0; }
    obj.traverse(function (o) {
      if (!o || !o.isMesh) { return; }
      if (o.name === 'blob' || (o.userData && (o.userData.noShadow || o.userData._toonOutline))) { return; }
      if (o.castShadow && o.receiveShadow) { return; }
      o.castShadow = true; o.receiveShadow = true; n++;
    });
    marked += n;
    return n;
  }

  /* ── 그림 층 ── */
  var T = null, renderer = null, scene = null, sun = null, target = null, applied = null, dir = null;

  function apply(p) {
    if (!renderer || !sun) { return; }
    var key = p.on ? p.size : 0;
    if (applied === key) { return; }
    applied = key;
    renderer.shadowMap.enabled = p.on;
    if (T && renderer.shadowMap.type !== T.PCFSoftShadowMap) { renderer.shadowMap.type = T.PCFSoftShadowMap; }
    sun.castShadow = p.on;
    if (!p.on) { return; }
    if (sun.shadow.map && (sun.shadow.mapSize.x !== p.size)) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.mapSize.set(p.size, p.size);
    var c = sun.shadow.camera;
    c.left = -p.span; c.right = p.span; c.top = p.span; c.bottom = -p.span; c.near = p.near; c.far = p.far;
    c.updateProjectionMatrix();
    sun.shadow.bias = p.bias;
    sun.shadow.normalBias = 0.6;
    renderer.shadowMap.needsUpdate = true;
  }

  /** realm3d.init 이 해를 만들고 realmSky3d.attach 한 직후 한 번 */
  function attach(three, rdr, sc, sunLight, tier) {
    T = three; renderer = rdr; scene = sc; sun = sunLight; applied = null; marked = 0;
    if (!T || !renderer || !scene || !sun) { return null; }
    target = new T.Object3D();
    scene.add(target);
    sun.target = target;
    dir = new T.Vector3(-120, 200, 90).normalize();
    var p = plan(tier);
    apply(p);
    return p;
  }

  /** 매 틱 — sky 가 해 방향을 원점 기준으로 놓은 뒤, 초점 기준으로 옮긴다 */
  function follow(px, pz, tier) {
    if (!sun || !target) { return; }
    apply(plan(tier));
    var S = global.DG.realmSky3d, st = S && S.stats ? S.stats() : null;
    if (st && st.on && st.shown && S.sunDir) { var d = S.sunDir(st.shown); dir.set(d.x, d.y, d.z); }
    target.position.set(px || 0, 0, pz || 0);
    sun.position.set(target.position.x + dir.x * DIST, target.position.y + dir.y * DIST, target.position.z + dir.z * DIST);
  }

  function stats() {
    return { on: !!(renderer && renderer.shadowMap.enabled), size: applied || 0, marked: marked, dir: dir ? { x: dir.x, y: dir.y, z: dir.z } : null };
  }

  global.DG = global.DG || {};
  global.DG.realmShadow3d = { plan: plan, mark: mark, attach: attach, follow: follow, stats: stats, SIZE: SIZE };
})(window);
