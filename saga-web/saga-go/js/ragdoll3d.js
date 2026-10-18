/**
 * ragdoll3d — 쓰러진 몸 래그돌 · 굴러가는 돌 · 풀 눕힘 (W-0310 ③ 물리) — 외부 물리 라이브러리 없이.
 *
 *   래그돌: 몸 하나를 알갱이 15(엉덩이·가슴·머리·어깨 둘·팔꿈치 둘·손 둘·고관절 둘·무릎 둘·발 둘)로 보고 버릿(Verlet)으로
 *   떨어뜨린다 — 몸통 여섯은 서로 거리 구속(강체처럼), 팔다리는 사슬, 겹침은 밀어내기 구속, 땅은 world3d.groundY 로 받는다.
 *   그린 건 군중(crowd3d)의 인스턴스가 맡는다: 뼈 텍스처 끝에 "살아 있는 줄"(live) 을 두고, 알갱이에서 **뼈 월드 행렬**을 만들어
 *   매 프레임 그 줄에 쓴다(crowd.setLive) — 래그돌 20 이 그리기 0 추가(군중과 같은 InstancedMesh). 뼈는 움직이는 열다섯
 *   (DRIVE)만 알갱이 틀(frame: 위·오른쪽 벡터)로 돌리고 나머지(손가락·머리카락·옷)는 가장 가까운 움직이는 조상에 **붙어 간다**:
 *   M_k = D_a × M0_k, D_a = T(p_a) R_a T(-p0_a) (쉬는 자세 M0 는 crowd3d.bake 가 'idle' 0 프레임에서 적어 둔다).
 *   쓰러짐 뒤 1.5초면 땅으로 가라앉아(0.6초) 자리를 비운다. 돌: 정십이면체 인스턴스 하나(그리기 1), 비탈 기울기로 굴러 내려오며
 *   굴림각 = 거리/반지름. 풀 눕힘: DG.press3d.arr(여덟 × x·y·z·r) 를 채우면 world3d 03-props 의 흔들림 셰이더가 그 둘레 풀을 눕힌다.
 *
 *   쓰는 법:  var rg = DG.ragdoll3d.make(three, crowd, { n: 20, groundY: W3.groundY });   매 프레임 rg.update(dt)
 *            rg.spawn(x, y, z, yaw, vx, vz)   var rk = DG.ragdoll3d.rocks(three, { n: 12, groundY, cx, cz }); scene.add(rk.group); rk.update(dt)
 *   순수 부분(rig·body·spawnAt·step·bones)은 three 없이 돈다 — 자가진단이 본다. 손잡이: ragdoll3d.on(본 게임 기본 0)·ragdoll3d.n(20)·ragdoll3d.rocks(12).
 */
(function (global) {
  'use strict';

  function tn(k, d) { var c = global.DG && global.DG.core; return c && c.tuned ? c.tuned(k, d) : d; }
  function ON() { return tn('ragdoll3d.on', 0) ? true : false; }
  function N() { return tn('ragdoll3d.n', 20); }
  function ROCKS() { return tn('ragdoll3d.rocks', 12); }

  var P = ['hips', 'chest', 'head', 'lsho', 'rsho', 'lelb', 'lhand', 'relb', 'rhand', 'lhip', 'rhip', 'lknee', 'lfoot', 'rknee', 'rfoot'];
  var PI = {}; P.forEach(function (k, i) { PI[k] = i; });
  /** 알갱이 → 쉬는 자리를 읽을 뼈(VRoid 이름, 뒤 것은 대안) */
  var PBONE = { hips: ['J_Bip_C_Hips'], chest: ['J_Bip_C_UpperChest', 'J_Bip_C_Chest'], head: ['J_Bip_C_Head'], lsho: ['J_Bip_L_UpperArm'], rsho: ['J_Bip_R_UpperArm'], lelb: ['J_Bip_L_LowerArm'], lhand: ['J_Bip_L_Hand'], relb: ['J_Bip_R_LowerArm'], rhand: ['J_Bip_R_Hand'], lhip: ['J_Bip_L_UpperLeg'], rhip: ['J_Bip_R_UpperLeg'], lknee: ['J_Bip_L_LowerLeg'], lfoot: ['J_Bip_L_Foot'], rknee: ['J_Bip_R_LowerLeg'], rfoot: ['J_Bip_R_Foot'] };
  var TORSO = ['hips', 'chest', 'lsho', 'rsho', 'lhip', 'rhip'];
  var CHAIN = [['chest', 'head'], ['lsho', 'head'], ['rsho', 'head'], ['lsho', 'lelb'], ['lelb', 'lhand'], ['rsho', 'relb'], ['relb', 'rhand'], ['lhip', 'lknee'], ['lknee', 'lfoot'], ['rhip', 'rknee'], ['rknee', 'rfoot']];
  var APART = [['lknee', 'rknee', 0.16], ['lfoot', 'rfoot', 0.16], ['lelb', 'chest', 0.16], ['relb', 'chest', 0.16], ['lhand', 'hips', 0.14], ['rhand', 'hips', 0.14], ['lknee', 'chest', 0.3], ['rknee', 'chest', 0.3], ['lhand', 'head', 0.12], ['rhand', 'head', 0.12]];
  /** 움직이는 뼈 → 틀(위 = b−a, 오른쪽 힌트 = r1−r0) */
  var DRIVE = {
    J_Bip_C_Hips: ['hips', 'chest', 'lhip', 'rhip'], J_Bip_C_Spine: ['hips', 'chest', 'lhip', 'rhip'],
    J_Bip_C_Chest: ['hips', 'chest', 'lsho', 'rsho'], J_Bip_C_UpperChest: ['hips', 'chest', 'lsho', 'rsho'],
    J_Bip_C_Neck: ['chest', 'head', 'lsho', 'rsho'], J_Bip_C_Head: ['chest', 'head', 'lsho', 'rsho'],
    J_Bip_L_UpperArm: ['lsho', 'lelb', 'lsho', 'rsho'], J_Bip_L_LowerArm: ['lelb', 'lhand', 'lsho', 'rsho'],
    J_Bip_R_UpperArm: ['rsho', 'relb', 'lsho', 'rsho'], J_Bip_R_LowerArm: ['relb', 'rhand', 'lsho', 'rsho'],
    J_Bip_L_UpperLeg: ['lhip', 'lknee', 'lhip', 'rhip'], J_Bip_L_LowerLeg: ['lknee', 'lfoot', 'lhip', 'rhip'],
    J_Bip_R_UpperLeg: ['rhip', 'rknee', 'lhip', 'rhip'], J_Bip_R_LowerLeg: ['rknee', 'rfoot', 'lhip', 'rhip']
  };
  var RAD = [0.11, 0.12, 0.10, 0.07, 0.07, 0.05, 0.04, 0.05, 0.04, 0.09, 0.09, 0.06, 0.05, 0.06, 0.05];   // 알갱이 반지름(키 1.65m 기준) — 몸 두께, 누워도 납작해지지 않게
  var GRAV = -9.8, SETTLE = 1.5, SINK = 0.6;

  /* ── 작은 행렬 수학(three 와 같은 열 우선 4×4) ── */
  function mul4(o, a, b) {
    for (var c = 0; c < 4; c++) { for (var r = 0; r < 4; r++) { o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; } }
    return o;
  }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  /** 위·오른쪽 힌트 → 정규직교 3×3(열: 오른쪽·위·앞) */
  function basis(up, rightHint) {
    var u = norm(up), f = norm(cross(rightHint, u)); if (!isFinite(f[0]) || (f[0] === 0 && f[1] === 0 && f[2] === 0)) { f = [0, 0, 1]; }
    var r = cross(u, f);
    return [r[0], r[1], r[2], u[0], u[1], u[2], f[0], f[1], f[2]];
  }
  function at(p, i) { return [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

  /** 뼈 이름·부모·쉬는 행렬(bones×16) → 틀. 알갱이 쉬는 자리·구속 길이·뼈마다 조상 */
  function rig(names, parents, rest) {
    var idx = {}, i, k; for (i = 0; i < names.length; i++) { idx[names[i]] = i; }
    var p0 = new Float32Array(P.length * 3), miss = [];
    for (i = 0; i < P.length; i++) {
      var cand = PBONE[P[i]], b = -1; for (k = 0; k < cand.length && b < 0; k++) { if (idx[cand[k]] !== undefined) { b = idx[cand[k]]; } }
      if (b < 0) { miss.push(P[i]); continue; }
      p0[i * 3] = rest[b * 16 + 12]; p0[i * 3 + 1] = rest[b * 16 + 13]; p0[i * 3 + 2] = rest[b * 16 + 14];
    }
    if (miss.length) { return null; }
    var cons = [], a, c;
    for (i = 0; i < TORSO.length; i++) { for (k = i + 1; k < TORSO.length; k++) { cons.push([PI[TORSO[i]], PI[TORSO[k]], 0, 1]); } }
    for (i = 0; i < CHAIN.length; i++) { cons.push([PI[CHAIN[i][0]], PI[CHAIN[i][1]], 0, 1]); }
    for (i = 0; i < cons.length; i++) { c = cons[i]; c[2] = Math.hypot(p0[c[0] * 3] - p0[c[1] * 3], p0[c[0] * 3 + 1] - p0[c[1] * 3 + 1], p0[c[0] * 3 + 2] - p0[c[1] * 3 + 2]); }
    for (i = 0; i < APART.length; i++) { a = APART[i]; cons.push([PI[a[0]], PI[a[1]], a[2], 0]); }   // 0 = 밀어내기만
    /* 뼈마다 가장 가까운 움직이는 조상(자기 포함) — 없으면 엉덩이 */
    var anc = new Int16Array(names.length), drv = [], dmap = {};
    for (i = 0; i < names.length; i++) { if (DRIVE[names[i]]) { dmap[i] = drv.length; drv.push({ bone: i, d: DRIVE[names[i]] }); } }
    for (i = 0; i < names.length; i++) {
      var w = i, found = -1;
      while (w >= 0) { if (dmap[w] !== undefined) { found = dmap[w]; break; } w = parents[w]; }
      anc[i] = found >= 0 ? found : (dmap[idx.J_Bip_C_Hips] !== undefined ? dmap[idx.J_Bip_C_Hips] : 0);
    }
    /* 움직이는 뼈마다 쉬는 틀 B0(전치해 두면 R = Bcur × B0ᵀ) */
    for (i = 0; i < drv.length; i++) {
      var d = drv[i].d, B0 = basis(sub(at(p0, PI[d[1]]), at(p0, PI[d[0]])), sub(at(p0, PI[d[3]]), at(p0, PI[d[2]])));
      drv[i].b0t = [B0[0], B0[3], B0[6], B0[1], B0[4], B0[7], B0[2], B0[5], B0[8]];
      drv[i].pivot = PI[d[0]];
    }
    var height = p0[PI.head * 3 + 1] - Math.min(p0[PI.lfoot * 3 + 1], p0[PI.rfoot * 3 + 1]), rad = new Float32Array(P.length);
    for (i = 0; i < P.length; i++) { rad[i] = RAD[i] * Math.max(0.5, height / 1.65); }
    return { p0: p0, cons: cons, drv: drv, anc: anc, rest: rest, nb: names.length, height: height, rad: rad };
  }

  function body(rg) { return { p: new Float32Array(rg.p0.length), q: new Float32Array(rg.p0.length), age: 0, still: 0, phase: 0, sink: 0, live: -1 }; }

  /** 쉬는 자세를 (x,y,z)·yaw 로 놓고 vx·vz 로 민다(위쪽일수록 세게 — 넘어진다). dt 는 첫 걸음 */
  function spawnAt(b, rg, x, y, z, yaw, vx, vz, dt) {
    var c = Math.cos(yaw), s = Math.sin(yaw), p0 = rg.p0, h = rg.height || 1.6; dt = dt || 1 / 60;
    for (var i = 0; i < P.length; i++) {
      var lx = p0[i * 3], ly = p0[i * 3 + 1], lz = p0[i * 3 + 2];
      var wx = x + lx * c + lz * s, wz = z - lx * s + lz * c, wy = y + ly;
      var k = 0.4 + 1.2 * (ly / h);   // 머리 쪽이 더 밀린다
      b.p[i * 3] = wx; b.p[i * 3 + 1] = wy; b.p[i * 3 + 2] = wz;
      b.q[i * 3] = wx - vx * k * dt; b.q[i * 3 + 1] = wy; b.q[i * 3 + 2] = wz - vz * k * dt;
    }
    b.age = 0; b.still = 0; b.phase = 1; b.sink = 0;
    return b;
  }

  /** 버릿 한 프레임(안에서 2 걸음) — groundY(x,z) 로 땅. 돌아오는 값: 가장 빠른 알갱이 빠르기(m/s) */
  function step(b, rg, dt, groundY) {
    var p = b.p, q = b.q, n = P.length, sub2 = 2, h = dt / sub2, i, k, it, vmax = 0;
    for (var s = 0; s < sub2; s++) {
      for (i = 0; i < n * 3; i += 3) {
        var vx = (p[i] - q[i]) * 0.985, vy = (p[i + 1] - q[i + 1]) * 0.985, vz = (p[i + 2] - q[i + 2]) * 0.985;
        q[i] = p[i]; q[i + 1] = p[i + 1]; q[i + 2] = p[i + 2];
        p[i] += vx; p[i + 1] += vy + GRAV * h * h; p[i + 2] += vz;
      }
      for (it = 0; it < 6; it++) {
        for (k = 0; k < rg.cons.length; k++) {
          var c = rg.cons[k], a = c[0] * 3, d = c[1] * 3, dx = p[d] - p[a], dy = p[d + 1] - p[a + 1], dz = p[d + 2] - p[a + 2];
          var L = Math.hypot(dx, dy, dz) || 1e-6; if (!c[3] && L >= c[2]) { continue; }
          var f = (L - c[2]) / L * 0.5; p[a] += dx * f; p[a + 1] += dy * f; p[a + 2] += dz * f; p[d] -= dx * f; p[d + 1] -= dy * f; p[d + 2] -= dz * f;
        }
        for (i = 0; i < n * 3; i += 3) {
          var gy = (groundY ? groundY(p[i], p[i + 2]) : 0) + rg.rad[i / 3];
          if (p[i + 1] < gy) { p[i + 1] = gy; p[i] -= (p[i] - q[i]) * 0.6; p[i + 2] -= (p[i + 2] - q[i + 2]) * 0.6; }   // 땅 + 마찰
        }
      }
    }
    for (i = 0; i < n * 3; i += 3) { var v = Math.hypot(p[i] - q[i], p[i + 1] - q[i + 1], p[i + 2] - q[i + 2]) / h; if (v > vmax) { vmax = v; } }
    b.age += dt; b.still = vmax < 0.05 ? b.still + dt : 0;
    if (b.phase === 1 && (b.age >= SETTLE || b.still > 0.4)) { b.phase = 2; }
    if (b.phase === 2) { b.sink += dt; if (b.sink >= SINK) { b.phase = 0; } }
    return vmax;
  }

  /** 알갱이 → 뼈 월드 행렬 전부(out: nb×16). 가라앉는 중이면 아래로 */
  function bones(b, rg, out) {
    var p = b.p, down = b.phase === 2 ? -0.7 * (b.sink / SINK) : 0, i, D = [], tmp = new Float32Array(16);
    for (i = 0; i < rg.drv.length; i++) {
      var dr = rg.drv[i], d = dr.d, up = sub(at(p, PI[d[1]]), at(p, PI[d[0]])), rh = sub(at(p, PI[d[3]]), at(p, PI[d[2]]));
      var B = basis(up, rh), T = dr.b0t, R = [
        B[0] * T[0] + B[3] * T[1] + B[6] * T[2], B[1] * T[0] + B[4] * T[1] + B[7] * T[2], B[2] * T[0] + B[5] * T[1] + B[8] * T[2],
        B[0] * T[3] + B[3] * T[4] + B[6] * T[5], B[1] * T[3] + B[4] * T[4] + B[7] * T[5], B[2] * T[3] + B[5] * T[4] + B[8] * T[5],
        B[0] * T[6] + B[3] * T[7] + B[6] * T[8], B[1] * T[6] + B[4] * T[7] + B[7] * T[8], B[2] * T[6] + B[5] * T[7] + B[8] * T[8]];
      var pa = at(p, dr.pivot), p0 = at(rg.p0, dr.pivot);
      var tx = pa[0] - (R[0] * p0[0] + R[3] * p0[1] + R[6] * p0[2]), ty = pa[1] + down - (R[1] * p0[0] + R[4] * p0[1] + R[7] * p0[2]), tz = pa[2] - (R[2] * p0[0] + R[5] * p0[1] + R[8] * p0[2]);
      D.push([R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, tx, ty, tz, 1]);
    }
    for (i = 0; i < rg.nb; i++) { mul4(tmp, D[rg.anc[i]], rg.rest.subarray(i * 16, i * 16 + 16)); out.set(tmp, i * 16); }
    return out;
  }

  /* ── 풀 눕힘 자리 여덟(x·y·z·r) — world3d 흔들림 셰이더가 읽는다 ── */
  var press = { arr: new Float32Array(32), n: 0, cap: 8, clear: function () { press.n = 0; press.arr.fill(0); }, add: function (x, y, z, r) { if (press.n >= press.cap) { return false; } var o = press.n * 4; press.arr[o] = x; press.arr[o + 1] = y; press.arr[o + 2] = z; press.arr[o + 3] = r; press.n++; return true; } };

  /** 래그돌 묶음 — crowd(crowd3d.make 결과, live 줄 있음)에 그린다 */
  function make(t, crowd, o) {
    o = o || {};
    var bk = crowd && crowd._baked, n = Math.min(o.n || N(), crowd ? crowd.live.n : 0);
    if (!bk || !bk.names || !n) { return null; }
    var rg = rig(bk.names, bk.parents, bk.rest); if (!rg) { return null; }
    var bodies = [], out = new Float32Array(rg.nb * 16), groundY = o.groundY || null, i, ms = 0;
    for (i = 0; i < n; i++) { var b = body(rg); b.live = i; bodies.push(b); }
    function free() { for (var k = 0; k < bodies.length; k++) { if (!bodies[k].phase) { return bodies[k]; } } return null; }
    function spawn(x, y, z, yaw, vx, vz) { var b = free(); if (!b) { return false; } spawnAt(b, rg, x, y, z, yaw, vx, vz); return true; }
    function update(dt) {
      var t0 = performance.now(), act = 0;
      for (var k = 0; k < bodies.length; k++) {
        var b = bodies[k]; if (!b.phase) { continue; }
        step(b, rg, dt, groundY);
        if (!b.phase) { crowd.freeLive(b.live); continue; }
        act++; crowd.setLive(b.live, bones(b, rg, out));
        if (b.phase === 1) { press.add(b.p[PI.hips * 3], b.p[PI.hips * 3 + 1], b.p[PI.hips * 3 + 2], 0.9); }
      }
      if (act) { crowd.flushLive(); }
      ms = ms * 0.9 + (performance.now() - t0) * 0.1;
      return act;
    }
    function active() { var a = 0; for (var k = 0; k < bodies.length; k++) { if (bodies[k].phase) { a++; } } return a; }
    return { spawn: spawn, update: update, active: active, free: function () { return !!free(); }, n: n, ms: function () { return +ms.toFixed(2); }, rig: rg, _bodies: bodies };
  }

  /** 굴러가는 돌 — 인스턴스 하나, 비탈 따라 굴러 내려오고 멈추면 둘레 바깥에서 다시 */
  function rocks(t, o) {
    o = o || {};
    var n = o.n || ROCKS(), r = o.r || 0.35, groundY = o.groundY || null, cx = o.cx || 0, cz = o.cz || 0, rnd = o.rnd || Math.random;
    var geo = new t.DodecahedronGeometry(r, 0), mat = new t.MeshStandardMaterial({ color: 0x5a544c, roughness: 0.95, metalness: 0 });
    var mesh = new t.InstancedMesh(geo, mat, n); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'ragdoll3d:rocks';
    var group = new t.Group(); group.name = 'ragdoll3d'; group.add(mesh);
    var st = [], dummy = new t.Object3D(), qa = new t.Quaternion(), ax = new t.Vector3(), i;
    function gy(x, z) { return groundY ? groundY(x, z) : 0; }
    function reset(s) {
      var a = rnd() * Math.PI * 2, d = 18 + rnd() * 22, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, sp = 3 + rnd() * 4;
      s.x = x; s.z = z; s.y = gy(x, z) + r + 0.5; s.vx = -Math.cos(a) * sp; s.vz = -Math.sin(a) * sp; s.vy = 0; s.still = 0; s.q.set(0, 0, 0, 1); s.age = 0;
    }
    for (i = 0; i < n; i++) { st.push({ q: new t.Quaternion() }); reset(st[i]); st[i].age = -rnd() * 4; }
    function update(dt) {
      dt = Math.min(dt, 0.05);
      for (var k = 0; k < n; k++) {
        var s = st[k]; s.age += dt; if (s.age < 0) { dummy.position.set(s.x, -999, s.z); dummy.scale.set(0, 0, 0); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix); continue; }
        var g0 = gy(s.x, s.z), gx = (gy(s.x + 0.5, s.z) - gy(s.x - 0.5, s.z)), gz = (gy(s.x, s.z + 0.5) - gy(s.x, s.z - 0.5));
        var on = s.y <= g0 + r + 0.02;
        if (on) { s.vx -= gx * 9.8 * dt; s.vz -= gz * 9.8 * dt; s.vx *= 0.992; s.vz *= 0.992; } else { s.vy += GRAV * dt; }
        s.x += s.vx * dt; s.z += s.vz * dt; s.y += s.vy * dt;
        var gn = gy(s.x, s.z); if (s.y < gn + r) { s.y = gn + r; s.vy = s.vy < -1 ? -s.vy * 0.25 : 0; }
        var sp = Math.hypot(s.vx, s.vz);
        if (sp > 0.01) { ax.set(s.vz, 0, -s.vx).normalize(); qa.setFromAxisAngle(ax, sp * dt / r); s.q.premultiply(qa); }
        s.still = sp < 0.15 ? s.still + dt : 0; if (s.still > 1.5 || Math.hypot(s.x - cx, s.z - cz) > 80) { reset(s); }
        dummy.position.set(s.x, s.y, s.z); dummy.quaternion.copy(s.q); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix);
        if (sp > 0.5) { press.add(s.x, s.y, s.z, 0.7); }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    function dispose() { group.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose(); }
    return { group: group, update: update, dispose: dispose, n: n, center: function (x, z) { cx = x; cz = z; }, _st: st };
  }

  global.DG = global.DG || {};
  global.DG.press3d = press;
  global.DG.ragdoll3d = { make: make, rocks: rocks, rig: rig, body: body, spawnAt: spawnAt, step: step, bones: bones, P: P, ON: ON, N: N, ROCKS: ROCKS };
})(window);
