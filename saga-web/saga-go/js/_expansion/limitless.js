/**
 * limitless — "웹엔 한계가 없다" 시연 장면(W-0310) — `_demo.html#limitless` 에서만 켠다.
 *   ① 군중 300(crowd3d: 인스턴싱 + 뼈 행렬 텍스처) — 이 파일의 1단계. ②~⑤(날씨·래그돌·임포스터·WebGPU)는 뒤 체크포인트.
 *   본 게임은 손대지 않는다 — world3d 의 장면에 얹기만 하고, 손잡이 crowd3d.on 이 0 이면 아무것도 안 한다(기본).
 *   DG.limitless.start({ n }) → 몸 GLB 받기·굽기 뒤 scene 에 추가 · stats() → { n, meshes, bones, frames, texKB, ready, ms(업데이트 CPU) }
 */
(function (global) {
  'use strict';
  var state = { crowd: null, raf: 0, ready: false, err: null, ms: 0, shell: null, last: 0 };

  function three() { return global.THREE || null; }

  function pickHero() {
    var D = global.DG.data, ids = ['sg_guanyu', 'kr_yisunsin', 'sg_zhaoyun'];
    for (var i = 0; i < ids.length; i++) { var r = D && D.find && D.find(ids[i]); if (r) { return r; } }
    var all = D && D.HEROES ? D.HEROES : [];
    return all.length ? all[0] : null;
  }

  function start(o) {
    o = o || {};
    var t = three(), W3 = global.DG.world3d, A = global.DG.actor3d, C = global.DG.core;
    if (!t || !W3 || !A) { state.err = 'three/world3d/actor3d 없음'; return false; }
    if (C && C.setTune) { C.setTune('crowd3d.on', 1); if (o.n) { C.setTune('crowd3d.n', o.n); } }
    stop();
    var ref = pickHero(); if (!ref) { state.err = '인물 없음'; return false; }
    var shell = A.build('hero', ref); if (!shell) { state.err = 'GLB 손잡이 꺼짐'; return false; }
    if (shell.userData.wake) { shell.userData.wake(); }
    state.shell = shell; state.ready = false; state.err = null;
    var tries = 0;
    (function wait() {
      var scene = W3.sceneNode && W3.sceneNode();
      if (shell.userData.assetState === 'glb' && shell.userData.mixer && scene) {
        var pos = C.save.player.pos;
        var me = W3.actorPos && W3.actorPos('me');
        var cr = global.DG.crowd3d.make(t, shell, { n: o.n || global.DG.crowd3d.N(), radius: o.radius, cx: pos.x, cz: pos.y, scale: me && me.scale ? me.scale : 1 });
        if (!cr) { state.err = '굽기 실패(클립 없음)'; return; }
        scene.add(cr.group); state.crowd = cr; state.ready = true; state.last = performance.now();
        loop();
        return;
      }
      if (shell.userData.assetState === 'fail' || ++tries > 600) { state.err = 'GLB 받기 실패'; return; }
      setTimeout(wait, 100);
    })();
    return true;
  }

  function loop() {
    if (!state.crowd) { return; }
    var now = performance.now(), dt = Math.min(0.1, (now - state.last) / 1000); state.last = now;
    var W3 = global.DG.world3d, t0 = performance.now();
    state.crowd.update(dt, W3.groundY);
    state.ms = state.ms * 0.9 + (performance.now() - t0) * 0.1;
    state.raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
    if (state.crowd) { if (state.crowd.group.parent) { state.crowd.group.parent.remove(state.crowd.group); } state.crowd.dispose(); state.crowd = null; }
    state.ready = false;
  }

  function stats() {
    var c = state.crowd;
    return { ready: state.ready, err: state.err, n: c ? c.n : 0, meshes: c ? c.meshes : 0, bones: c ? c.bones : 0, frames: c ? c.frames : 0, texKB: c ? Math.round(c.texBytes / 1024) : 0, slots: c ? c.slots : [], ms: +state.ms.toFixed(2) };
  }

  global.DG = global.DG || {};
  global.DG.limitless = { start: start, stop: stop, stats: stats, _crowd: function () { return state.crowd; }, _shell: function () { return state.shell; } };
})(window);
