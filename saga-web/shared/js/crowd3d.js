/**
 * crowd3d — 같은 몸 N 명을 **그리기 몇 번**으로(W-0310 ① 군중) — 인스턴싱 + 뼈 행렬 텍스처(VAT).
 *
 *   뼈 행렬 텍스처: 몸 하나의 클립(서기·걷기·달리기·앉기)을 프레임마다 뼈 행렬(bone.matrixWorld × boneInverse)로 구워
 *   폭 = 뼈 수 × 4 텍셀, 높이 = 전체 프레임 수 인 RGBA float 텍스처에 쌓는다. three 의 skinning 셰이더가
 *   boneTexture 를 texelFetch 하는 자리에서 **행(y)에 인스턴스별 프레임(instFrame)을 더하는 한 줄**만 바꾸면
 *   InstancedMesh 하나가 N 명을 제각각 다른 자세로 그린다 — CPU 는 프레임마다 숫자 N 개(instFrame)와
 *   자리 행렬만 쓴다. SkinnedMesh 가 아니라 three 가 bindMatrix·boneTexture 를 안 넣어 주므로 uniform 으로 직접 준다
 *   (bindMatrixInverse 는 단위행렬 — 구운 뼈 행렬이 이미 몸 원점 기준 월드값이라 인스턴스 행렬만 곱하면 된다).
 *   VRoid 몸은 스킨 메시 27개가 **제각각 Skeleton**(같은 Bone 마디를 다른 순서로)이라, 뼈를 uuid 로 합쳐 한 표로 굽고
 *   메시마다 skinIndex 를 합친 번호로 바꿔 끼운다(텍스처 하나 · 1.2MB).
 *
 *   쓰는 법:  var cr = DG.crowd3d.make(three, heroShell, { n: 300, fps: 30, slots: ['idle','walk','run','Pose_sit'] });
 *            scene.add(cr.group);   매 프레임 cr.update(dt, groundY)   끝나면 cr.dispose()
 *   heroShell = asset3d.build('hero', …) 가 GLB 를 다 받은 뒤(userData.assetState === 'glb', mixer·actions·clipMap 있음).
 *   손잡이: crowd3d.on(1) · crowd3d.n(300) · crowd3d.radius(60m) · crowd3d.outline(0) — 본 게임 기본은 **꺼짐**(시연 _demo.html#limitless 에서만 켠다).
 */
(function (global) {
  'use strict';

  function tn(k, d) { var c = global.DG && global.DG.core; return c && c.tuned ? c.tuned(k, d) : d; }
  function ON() { return tn('crowd3d.on', 0) ? true : false; }
  function N() { return tn('crowd3d.n', 300); }
  function RADIUS() { return tn('crowd3d.radius', 60); }
  function OUTLINE() { return tn('crowd3d.outline', 0) ? true : false; }   // 외곽선 껍데기 메시(*_outline)까지 세우면 그리기 수가 두 배
  function SHADOW() { return tn('crowd3d.shadow', 1) ? true : false; }   // 군중 그림자(스킨 메시 17 × 그림자 패스 = 그리기 +17) — 예산(W-0310 ⑥) 맞출 때 끈다

  /** 몸(shell)의 클립을 프레임으로 굽는다 → { tex, bones, frames: {slot: {start, n}}, total, skins, maps } */
  function bake(t, shell, slots, fps, withOutline, scale, live) {
    var u = shell.userData, mixer = u.mixer, acts = u.actions, map = u.clipMap || {};
    var skins = []; shell.traverse(function (m) { if (m.isSkinnedMesh && m.skeleton && (withOutline || !/_outline$/.test(m.name || ''))) { skins.push(m); } });
    if (!mixer || !skins.length) { return null; }
    /* 뼈 합치기 — 메시마다 Skeleton 이 달라도 Bone 마디는 같다. 처음 본 순서로 번호를 매기고 역바인드는 처음 것 */
    var idx = {}, bones = [], invs = [], maps = [], binds = [], i, k;
    for (i = 0; i < skins.length; i++) {
      var sk = skins[i].skeleton, local = new Float32Array(sk.bones.length);
      for (k = 0; k < sk.bones.length; k++) {
        var b = sk.bones[k];
        if (idx[b.uuid] === undefined) { idx[b.uuid] = bones.length; bones.push(b); invs.push(sk.boneInverses[k]); }
        local[k] = idx[b.uuid];
      }
      maps.push(local);
      /* VRoid 는 메시마다 기하가 제 상자로 정규화돼 역바인드가 "첫 메시 것 × X"(X 는 그 메시에서 일정한 크기·자리 행렬)다 —
         X 를 그 메시의 bindMatrix 로 넘기면 첫 메시 기준으로 구운 표 하나를 전부가 쓴다(10-18 측정: 17 메시 전부 X 가 뼈마다 같음) */
      binds.push(new t.Matrix4().copy(invs[idx[sk.bones[0].uuid]]).invert().multiply(sk.boneInverses[0]));
    }
    var use = [];
    for (i = 0; i < slots.length; i++) { var nm = map[slots[i]]; if (nm && acts[nm]) { use.push({ slot: slots[i], act: acts[nm], dur: acts[nm].getClip().duration }); } }
    if (!use.length) { return null; }
    var total = 0; for (i = 0; i < use.length; i++) { use[i].n = Math.max(2, Math.round(use[i].dur * fps)); use[i].start = total; total += use[i].n; }
    var liveRow = { start: total, n: live || 0 }; total += liveRow.n;   // W-0310 ③ 끝 줄 = 래그돌이 매 프레임 쓰는 "살아 있는" 뼈 행렬
    var width = bones.length * 4, data = new Float32Array(width * total * 4), frames = {}, tmp = new t.Matrix4();
    var rest = new Float32Array(bones.length * 16), names = bones.map(function (b) { return b.name || ''; }), parents = bones.map(function (b) { return b.parent && idx[b.parent.uuid] !== undefined ? idx[b.parent.uuid] : -1; });
    var save = { p: shell.position.clone(), q: shell.quaternion.clone(), s: shell.scale.clone() };
    var sc = scale || 1; shell.position.set(0, 0, 0); shell.quaternion.identity(); shell.scale.set(sc, sc, sc);   // 배우 키 배율(world3d 가 'me' 에 주는 scale)을 그대로
    mixer.stopAllAction();
    for (i = 0; i < use.length; i++) {
      var c = use[i]; c.act.reset().play(); c.act.setEffectiveWeight(1);
      for (var f = 0; f < c.n; f++) {
        mixer.setTime((f / c.n) * c.dur);
        shell.updateMatrixWorld(true);
        var row = (c.start + f) * width * 4;
        for (k = 0; k < bones.length; k++) { tmp.multiplyMatrices(bones[k].matrixWorld, invs[k]); tmp.toArray(data, row + k * 16); if (!i && !f) { bones[k].matrixWorld.toArray(rest, k * 16); } }   // 첫 클립 0 프레임 = 쉬는 자세(래그돌 틀)
      }
      c.act.stop();
      frames[c.slot] = { start: c.start, n: c.n };
    }
    mixer.stopAllAction();
    shell.position.copy(save.p); shell.quaternion.copy(save.q); shell.scale.copy(save.s);
    var tex = new t.DataTexture(data, width, total, t.RGBAFormat, t.FloatType);
    tex.needsUpdate = true; tex.minFilter = tex.magFilter = t.NearestFilter; tex.generateMipmaps = false;
    return { tex: tex, bones: bones.length, frames: frames, total: total, skins: skins, maps: maps, binds: binds, data: data, width: width, invs: invs, rest: rest, names: names, parents: parents, live: liveRow };
  }

  /** 재질에 "뼈 텍스처 + 인스턴스 프레임" 을 심는다 — 셰이더 치환 한 줄 */
  function patchMaterial(t, mat, baked, bindMatrix) {
    mat.defines = Object.assign({}, mat.defines || {}, { USE_SKINNING: '' });
    var prev = mat.onBeforeCompile;
    mat.onBeforeCompile = function (sh, r) {
      if (prev) { prev.call(this, sh, r); }
      sh.uniforms.bindMatrix = { value: bindMatrix };
      sh.uniforms.bindMatrixInverse = { value: new t.Matrix4() };
      sh.uniforms.boneTexture = { value: baked.tex };
      sh.vertexShader = sh.vertexShader
        .replace('#include <skinning_pars_vertex>', 'attribute float instFrame;\n' + t.ShaderChunk.skinning_pars_vertex.replace(/int\s+y\s*=\s*j\s*\/\s*size\s*;/, 'int y = j / size + int( instFrame );'));   // #include 는 이 뒤에 풀리므로 본문을 직접 넣는다
    };
    mat.customProgramCacheKey = function () { return 'crowd3d:' + baked.tex.uuid; };
    mat.needsUpdate = true;
    return mat;
  }

  function make(t, shell, o) {
    o = o || {};
    var n = o.n || N(), fps = o.fps || 30, radius = o.radius || RADIUS();
    var live = o.live || 0, total = n + live;   // 뒤 live 개 인스턴스 = 래그돌(ragdoll3d) 자리 — 자리 행렬은 단위(뼈 행렬이 이미 월드값), 빈 자리는 0 배율
    var baked = bake(t, shell, o.slots || ['idle', 'walk', 'run', 'Pose_sit'], fps, o.outline === undefined ? OUTLINE() : o.outline, o.scale, live);
    if (!baked) { return null; }
    var group = new t.Group(); group.name = 'crowd3d';
    var frameAttr = new t.InstancedBufferAttribute(new Float32Array(total), 1); frameAttr.setUsage(t.DynamicDrawUsage);
    var instMat = new t.InstancedBufferAttribute(new Float32Array(total * 16), 16); instMat.setUsage(t.DynamicDrawUsage);   // 자리 행렬 하나를 메시 전부가 나눠 쓴다
    for (i = 0; i < live; i++) { frameAttr.array[n + i] = baked.live.start + i; }
    var meshes = [], i, m;
    for (i = 0; i < baked.skins.length; i++) {
      var sk = baked.skins[i], geo = sk.geometry.clone(), src = sk.geometry.attributes.skinIndex, loc = baked.maps[i];
      geo.morphAttributes = {};   // 표정 모프는 버린다 — InstancedMesh 엔 morphTargetInfluences 가 없어 렌더가 죽는다
      var re = new Float32Array(src.count * src.itemSize);
      for (var v = 0; v < re.length; v++) { re[v] = loc[src.array[v]] || 0; }
      geo.setAttribute('skinIndex', new t.BufferAttribute(re, src.itemSize));   // 이 메시의 뼈 번호 → 합친 번호
      geo.setAttribute('instFrame', frameAttr);
      var mats = Array.isArray(sk.material) ? sk.material : [sk.material];
      var cl = mats.map(function (x) { return patchMaterial(t, x.clone(), baked, baked.binds[i]); });
      m = new t.InstancedMesh(geo, Array.isArray(sk.material) ? cl : cl[0], total);
      m.instanceMatrix = instMat;
      m.frustumCulled = false;
      m.castShadow = o.shadow === undefined ? SHADOW() : !!o.shadow; m.receiveShadow = false;
      var dm = new t.MeshDepthMaterial({ depthPacking: t.RGBADepthPacking, map: mats[0].map || null, alphaTest: mats[0].alphaTest || 0 });
      m.customDepthMaterial = patchMaterial(t, dm, baked, baked.binds[i]);
      group.add(m); meshes.push(m);
    }
    /* 사람마다: 자리·방향·빠르기·클립·프레임 어긋남. 걷는 사람은 둥글게 돈다, 앉은 사람은 제자리 */
    var slots = Object.keys(baked.frames), people = [], dummy = new t.Object3D(), rnd = o.rnd || Math.random;
    for (i = 0; i < n; i++) {
      var r = Math.sqrt(rnd()) * radius, a = rnd() * Math.PI * 2, slot = slots[Math.floor(rnd() * slots.length)];
      if (slot === 'run' && rnd() < 0.6) { slot = 'walk'; }
      people.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: rnd() * Math.PI * 2, slot: slot, off: rnd() * 1000, rate: 0.85 + rnd() * 0.3, turn: (rnd() - 0.5) * 0.4, spd: slot === 'walk' ? 1.3 : (slot === 'run' ? 3.2 : 0) });
    }
    var cx = o.cx || 0, cz = o.cz || 0, time = 0;
    function update(dt, groundY) {
      time += dt;
      for (var k = 0; k < n; k++) {
        var p = people[k], fr = baked.frames[p.slot];
        frameAttr.array[k] = fr.start + Math.floor((time * fps * p.rate + p.off) % fr.n);
        if (p.spd) {
          p.yaw += p.turn * dt;
          p.x += Math.sin(p.yaw) * p.spd * dt; p.z += Math.cos(p.yaw) * p.spd * dt;
          var dd = Math.hypot(p.x, p.z); if (dd > radius) { p.yaw += Math.PI; p.x *= 0.98; p.z *= 0.98; }
        }
        var wx = cx + p.x, wz = cz + p.z, hid = p.hide && p.hide > time;
        dummy.position.set(wx, groundY ? groundY(wx, wz) : 0, wz);
        dummy.rotation.set(0, p.yaw, 0); dummy.scale.set(hid ? 0 : 1, hid ? 0 : 1, hid ? 0 : 1); dummy.updateMatrix();
        dummy.matrix.toArray(instMat.array, k * 16);
      }
      frameAttr.needsUpdate = true; instMat.needsUpdate = true;
    }
    /* 살아 있는 줄(래그돌): i 번째 줄에 뼈 월드 행렬(bones×16)을 쓰고 인스턴스 자리는 단위 행렬. flushLive 가 텍스처를 한 번 올린다 */
    var tmpM = new t.Matrix4(), tmpW = new t.Matrix4(), ident = new t.Matrix4(), zero = new t.Matrix4().makeScale(0, 0, 0);
    function setLive(i, world) {
      if (i < 0 || i >= live) { return false; }
      var row = (baked.live.start + i) * baked.width * 4, nb = baked.bones;
      for (var k = 0; k < nb; k++) { tmpW.fromArray(world, k * 16); tmpM.multiplyMatrices(tmpW, baked.invs[k]); tmpM.toArray(baked.data, row + k * 16); }
      ident.toArray(instMat.array, (n + i) * 16); instMat.needsUpdate = true; return true;
    }
    function freeLive(i) { if (i >= 0 && i < live) { zero.toArray(instMat.array, (n + i) * 16); instMat.needsUpdate = true; } }
    function flushLive() { baked.tex.needsUpdate = true; }
    for (i = 0; i < live; i++) { freeLive(i); }
    function dispose() {
      for (var j = 0; j < meshes.length; j++) { group.remove(meshes[j]); meshes[j].geometry.dispose(); meshes[j].dispose(); }
      baked.tex.dispose();
    }
    return { group: group, update: update, dispose: dispose, n: n, meshes: meshes.length, bones: baked.bones, frames: baked.total, texBytes: baked.bones * 4 * baked.total * 16, slots: slots, _baked: baked, center: function (x, z) { cx = x; cz = z; },
      live: { n: live, start: baked.live.start }, setLive: setLive, freeLive: freeLive, flushLive: flushLive,
      person: function (k) { var p = people[k]; return p ? { x: cx + p.x, z: cz + p.z, yaw: p.yaw, slot: p.slot } : null; }, hide: function (k, secs) { if (people[k]) { people[k].hide = time + (secs || 2); } } };
  }

  global.DG = global.DG || {};
  global.DG.crowd3d = { make: make, bake: bake, ON: ON, N: N, RADIUS: RADIUS, OUTLINE: OUTLINE, SHADOW: SHADOW };
})(window);
