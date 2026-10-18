/**
 * limitless — "웹엔 한계가 없다" 시연 장면(W-0310) — `_demo.html#limitless` 에서만 켠다.
 *   ① 군중 300(crowd3d: 인스턴싱 + 뼈 행렬 텍스처) ② 날씨·빛(weather3d: GPU 비·눈 2만·번개·빛줄기) ③ 물리(ragdoll3d: 군중 중 하나가 0.45초마다
 *   떠밀려 래그돌로 쓰러지고(군중 인스턴스의 live 줄에 그려 그리기 +0) · 돌 12 가 비탈을 굴러 내려오고(그리기 +1) · 둘레 풀이 눕는다(press3d))
 *   ④ 지평선(farland3d: 타일 밖 2.2km 먼 땅 고리 + 숲 임포스터 8방향 빌보드 + 산 테 — 안개를 km 밖으로, ridge 실루엣은 끔)
 *   ⑤ WebGPU 길(renderer3d: `#limitless,webgpu=1` → 손잡이 go3d.webgpu=1 — 못 켜면 WebGL 로 자동 되돌리고 콘솔 한 줄, stats().renderer 에 종류·이유).
 *   본 게임은 손대지 않는다 — world3d 의 장면에 얹기만 하고, 손잡이 crowd3d.on·weather3d.on 이 0 이면 아무것도 안 한다(기본).
 *   ⑥ 자동 단계(perf.tier): HIGH 1 · MEDIUM 0.6 · LOW 0.33 을 군중·비 알갱이·래그돌·임포스터 수에 곱한다(auto=0 이면 안 곱함) — 폰은 LOW 로 내려 30fps 를 노린다.
 *   DG.limitless.start({ n, weather, physics, ragdoll, rocks, horizon, auto }) → 몸 GLB 받기·굽기 뒤 scene 에 추가 · weather(kind) → 날씨 바꿈('off' 면 끔) · physics(on) · horizon(on) · stats()
 */
(function (global) {
  'use strict';
  var state = { crowd: null, weather: null, raf: 0, ready: false, err: null, ms: 0, shell: null, last: 0, wkind: 'off', rag: null, rocks: null, physOn: false, physMs: 0, spawnT: 0, ragN: 0, rockN: 0, horizonOn: false, ridge0: null };

  function three() { return global.THREE || null; }
  /** 자동 단계 밀도 — perf 가 고른 단계(HIGH/MEDIUM/LOW)에 따라 수를 줄인다 */
  function density() { var P = global.DG.perf, k = P && P.tier ? P.tier().key : 'HIGH'; return k === 'LOW' ? 0.33 : (k === 'MEDIUM' ? 0.6 : 1); }
  var autoOn = true;

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
    autoOn = o.auto !== undefined ? !!o.auto : true; var dn = autoOn ? density() : 1; state.dens = dn;
    if (o.n !== undefined) { o.n = Math.round(o.n * dn); }
    if (C && C.setTune) { C.setTune('crowd3d.on', 1); if (o.n) { C.setTune('crowd3d.n', o.n); } if (dn < 1) { C.setTune('weather3d.n', Math.round(global.DG.weather3d.N() * dn)); C.setTune('far3d.trees', Math.round(2500 * dn)); } }
    stop();
    state.ragN = Math.round((o.ragdoll !== undefined ? o.ragdoll : global.DG.ragdoll3d.N()) * dn); state.rockN = o.rocks !== undefined ? o.rocks : global.DG.ragdoll3d.ROCKS(); state.physOn = o.physics !== undefined ? !!o.physics : false;
    if (o.horizon !== undefined) { horizon(o.horizon); }
    if (o.weather) { weather(o.weather); }
    if (o.n === 0) { state.ready = true; loop(); return true; }
    var ref = pickHero(); if (!ref) { state.err = '인물 없음'; return false; }
    var shell = A.build('hero', ref); if (!shell) { state.err = 'GLB 손잡이 꺼짐'; return false; }
    if (shell.userData.wake) { shell.userData.wake(); }
    state.shell = shell; state.ready = false; state.err = null;
    var tries = 0;
    (function wait() {
      var scene = W3.sceneNode && W3.sceneNode();
      if (shell.userData.assetState === 'glb' && shell.userData.mixer && scene) {
        var pos = C.save.player.pos, me = W3.actorPos && W3.actorPos('me');
        var cr = global.DG.crowd3d.make(t, shell, { n: o.n || Math.round(global.DG.crowd3d.N() * dn), radius: o.radius, cx: pos.x, cz: pos.y, scale: me && me.scale ? me.scale : 1, live: state.ragN });
        if (!cr) { state.err = '굽기 실패(클립 없음)'; return; }
        scene.add(cr.group); state.crowd = cr; state.ready = true; state.last = performance.now();
        if (state.physOn) { physics(1); }
        if (!state.raf) { loop(); }
        return;
      }
      if (shell.userData.assetState === 'fail' || ++tries > 600) { state.err = 'GLB 받기 실패'; return; }
      setTimeout(wait, 100);
    })();
    return true;
  }

  /** 날씨 — kind: rain·snow·cloud·fog·wind·clear, 'off' 면 날씨 층을 치운다(판의 천후는 force 로 같이 맞춘다) */
  function weather(kind) {
    var t = three(), W3 = global.DG.world3d, C = global.DG.core;
    if (!t || !W3) { return false; }
    if (kind === 'off') {
      if (state.weather) { if (state.weather.group.parent) { state.weather.group.parent.remove(state.weather.group); } state.weather.dispose(); state.weather = null; }
      if (global.DG.weather) { global.DG.weather.force(null); }
      if (C && C.setTune) { C.setTune('weather3d.on', 0); }
      state.wkind = 'off'; return true;
    }
    if (C && C.setTune) { C.setTune('weather3d.on', 1); }
    if (!state.weather) { state.weather = global.DG.weather3d.make(t, {}); W3.addFx(state.weather.group); }
    if (global.DG.weather) { global.DG.weather.force(kind); }
    state.wkind = kind;
    if (!state.raf) { state.last = performance.now(); loop(); }
    return true;
  }

  /** ④ 지평선 켜기·끄기 — far3d.on 손잡이(world3d 05-render 가 매 프레임 farland3d.follow 를 부른다) + 산 실루엣 고리(sky3d.ridge)는 끈다(먼 땅이 대신) */
  function horizon(on) {
    var C = global.DG.core, F = global.DG.farland3d; if (!C || !C.setTune || !F) { return false; }
    if (on) { if (!state.horizonOn) { state.ridge0 = C.tuned('sky3d.ridge', 1); } C.setTune('far3d.on', 1); C.setTune('sky3d.ridge', 0); state.horizonOn = true; }
    else { C.setTune('far3d.on', 0); if (state.ridge0 !== null) { C.setTune('sky3d.ridge', state.ridge0); state.ridge0 = null; } F.off(); state.horizonOn = false; }
    return true;
  }

  /** ③ 물리 켜기·끄기 — 래그돌(군중 live 줄)·돌(인스턴스 하나)·풀 눕힘(press3d). 군중이 있어야 래그돌이 선다 */
  function physics(on) {
    var t = three(), W3 = global.DG.world3d, R = global.DG.ragdoll3d, C = global.DG.core;
    if (!t || !W3 || !R) { return false; }
    if (!on) {
      if (state.rocks) { if (state.rocks.group.parent) { state.rocks.group.parent.remove(state.rocks.group); } state.rocks.dispose(); state.rocks = null; }
      state.rag = null; state.physOn = false; global.DG.press3d.clear(); if (C && C.setTune) { C.setTune('ragdoll3d.on', 0); }
      return true;
    }
    if (C && C.setTune) { C.setTune('ragdoll3d.on', 1); }
    var pos = C.save.player.pos, scene = W3.sceneNode();
    if (state.crowd && !state.rag && state.ragN) { state.rag = R.make(t, state.crowd, { n: state.ragN, groundY: W3.groundY }); }
    if (!state.rocks && state.rockN) { state.rocks = R.rocks(t, { n: state.rockN, groundY: W3.groundY, cx: pos.x, cz: pos.y }); scene.add(state.rocks.group); }
    state.physOn = true; state.spawnT = 0;
    if (!state.raf) { state.last = performance.now(); loop(); }
    return true;
  }

  /** 군중 중 가까운 하나를 떠민다 — 그 사람은 2.3초 숨고 그 자리에 래그돌이 선다 */
  function shove(dt) {
    var cr = state.crowd, rg = state.rag, W3 = global.DG.world3d; if (!cr || !rg) { return; }
    state.spawnT += dt; if (state.spawnT < 0.45 || !rg.free()) { return; }
    state.spawnT = 0;
    var pos = global.DG.core.save.player.pos, best = -1, bd = 1e9;
    for (var tries = 0; tries < 24; tries++) { var k = Math.floor(Math.random() * cr.n), p = cr.person(k); if (!p) { continue; } var d = Math.hypot(p.x - pos.x, p.z - pos.y); if (d > 2.5 && d < 25 && d < bd) { bd = d; best = k; } }   // 가까운 사람부터(카메라 안에서 넘어지게)
    if (best < 0) { return; }
    var q = cr.person(best), a = Math.random() * Math.PI * 2, sp = 2.5 + Math.random() * 2.5;
    cr.hide(best, 2.3); rg.spawn(q.x, W3.groundY ? W3.groundY(q.x, q.z) : 0, q.z, q.yaw, Math.cos(a) * sp, Math.sin(a) * sp);
  }

  function loop() {
    var now = performance.now(), dt = Math.min(0.1, (now - state.last) / 1000); state.last = now;
    var W3 = global.DG.world3d, t0 = performance.now();
    if (state.crowd) { state.crowd.update(dt, W3.groundY); }
    if (state.physOn) { var tp = performance.now(); global.DG.press3d.clear(); shove(dt); if (state.rag) { state.rag.update(dt); } if (state.rocks) { state.rocks.update(dt); } state.physMs = state.physMs * 0.9 + (performance.now() - tp) * 0.1; }
    if (state.weather) { state.weather.update(dt, W3.camNode ? W3.camNode() : null, W3.light ? W3.light() : null, state.wkind); }
    state.ms = state.ms * 0.9 + (performance.now() - t0) * 0.1;
    state.raf = (state.crowd || state.weather) ? requestAnimationFrame(loop) : 0;
  }

  function stop() {
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
    physics(0); horizon(0);
    if (state.crowd) { if (state.crowd.group.parent) { state.crowd.group.parent.remove(state.crowd.group); } state.crowd.dispose(); state.crowd = null; }
    state.ready = false;
  }

  function stats() {
    var c = state.crowd;
    return { ready: state.ready, err: state.err, density: state.dens, tier: global.DG.perf && global.DG.perf.tier ? global.DG.perf.tier().key : null, n: c ? c.n : 0, meshes: c ? c.meshes : 0, bones: c ? c.bones : 0, frames: c ? c.frames : 0, texKB: c ? Math.round(c.texBytes / 1024) : 0, slots: c ? c.slots : [], ms: +state.ms.toFixed(2), weather: state.wkind, drops: state.weather ? state.weather.n : 0, physics: state.physOn, ragdolls: state.rag ? state.rag.active() : 0, ragN: state.rag ? state.rag.n : 0, rocks: state.rocks ? state.rocks.n : 0, physMs: +state.physMs.toFixed(2), press: global.DG.press3d ? global.DG.press3d.n : 0, horizon: state.horizonOn, far: global.DG.farland3d ? global.DG.farland3d.stats() : null, renderer: global.DG.renderer3d ? { kind: global.DG.renderer3d.kind(), why: global.DG.renderer3d.why(), knob: global.DG.renderer3d.KNOB(), gpu: global.DG.renderer3d.gpuAvailable() } : null };
  }

  global.DG = global.DG || {};
  global.DG.limitless = { start: start, stop: stop, weather: weather, physics: physics, horizon: horizon, stats: stats, _rag: function () { return state.rag; }, _crowd: function () { return state.crowd; }, _shell: function () { return state.shell; }, _weather: function () { return state.weather; } };
})(window);
