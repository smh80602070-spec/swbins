/**
 * anim-own.js — 자체 제작 몸짓(VRM 휴머노이드 전용)
 *
 * 왜 있나: Mixamo 몸짓은 약관상 공개 저장소에 올릴 수 없고, 다른 CC0 몸짓(UAL1)을 VRM 뼈에
 * 다시 굽는(retarget) 길은 뼈 길이·축이 달라 손을 타야 했다. 그래서 **이 파일이 코드로 직접 짠다.**
 * 데이터도 남의 것이 아니고(전부 이 파일의 수식·키), 뼈대 이름(`J_Bip_*`)만 VRM 규격을 따른다.
 *
 * 다섯 판 공용 복사본(`saga-web/*` 마다 같은 파일) — 고치면 다섯 벌을 함께 고치고 md5 를 맞춘다.
 *
 * 방식
 *   1) 뼈대 정지 자세에서 **몸 기준 축**을 뽑는다 — 위(u: 엉덩이→머리)·앞(f: 발목→발끝)·왼(l = u × f).
 *      VRoid 는 정지 회전이 전부 항등에 정면이 -Z 이지만, 이 축을 그때그때 뽑으니 몸이 어느 쪽을 봐도 된다.
 *   2) 자세는 뼈마다 (r 롤·p 피치·y 요) 도(°) 로 적는다 — 전부 **정지 자세의 몸 축** 기준이다.
 *        r: f 축 회전   p: l 축 회전   y: u 축 회전   합성 순서는 y · p · r (r 이 먼저 먹는다)
 *      뼈 로컬 회전 = conj(부모 정지 월드) · R · (부모 정지 월드) · 정지 로컬. 부모가 움직이면 자식이 저절로 따라간다.
 *      부호 규약(오른손 법칙, l 은 몸의 왼쪽):
 *        p > 0 — 위로 뻗은 뼈(척추·머리)는 끝이 앞으로, **아래로 뻗은 뼈(다리·내려 둔 팔)는 끝이 뒤로**.
 *        r > 0 — 왼팔은 위로 들리고(오른팔은 내려가고), 아래로 뻗은 뼈는 왼쪽으로 벌어진다.
 *        y > 0 — 위에서 볼 때 왼쪽으로 돈다(앞이 왼쪽으로).
 *      좌우 한 쌍은 `S()` 가 거울로(r·y 부호 반전) 채운다.
 *   3) 30/60fps 로 촘촘히 표집해 쿼터니언 키로 굽는다. 발이 땅에 붙는 클립은 **FK 로 발바닥 높이를 재서**
 *      엉덩이 높이(hips.dy)를 자동으로 맞춘다 — 무릎을 얼마나 굽혀도 발이 뜨거나 박히지 않는다.
 *
 * 클립 아홉(이름은 `asset3d.mapClips()` 가 알아본다): Idle_Loop · Walk_Loop · Run_Loop · Jump · Land · Attack ·
 * Hit · Death · Dodge. 모든 클립이 **같은 뼈 전부**를 움직이는 트랙을 갖는다(빠뜨리면 크로스페이드 때 앞 클립의 자세가 남는다).
 *
 * three 없이도 도는 순수 함수(`clipData`)와, three 를 물려 `AnimationClip` 으로 바꾸는 `clipsFor()` 로 나뉜다 —
 * 진단은 앞쪽만으로 FK 를 재 본다.
 */
(function (global) {
  'use strict';

  var D2R = Math.PI / 180;

  /* ── 벡터·쿼터니언 (x, y, z, w 배열) ─────────────────── */
  function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vmul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function vlen(a) { return Math.sqrt(vdot(a, a)); }
  function vnorm(a) { var l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function qmul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
    ];
  }
  function qconj(a) { return [-a[0], -a[1], -a[2], a[3]]; }
  function qaxis(ax, rad) { var s = Math.sin(rad / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(rad / 2)]; }
  function qnorm(a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]) || 1; return [a[0] / l, a[1] / l, a[2] / l, a[3] / l]; }
  function qrot(q, v) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  }
  function qslerp(a, b, t) {
    var cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bb = b;
    if (cos < 0) { cos = -cos; bb = [-b[0], -b[1], -b[2], -b[3]]; }
    if (cos > 0.9995) {
      return qnorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
    }
    var th = Math.acos(cos), s = Math.sin(th), k0 = Math.sin((1 - t) * th) / s, k1 = Math.sin(t * th) / s;
    return [a[0] * k0 + bb[0] * k1, a[1] * k0 + bb[1] * k1, a[2] * k0 + bb[2] * k1, a[3] * k0 + bb[3] * k1];
  }

  /* ── 뼈 이름 ───────────────────────────────────────────── */
  var PAIRS = { sh: 'Shoulder', ua: 'UpperArm', la: 'LowerArm', hand: 'Hand', ul: 'UpperLeg', ll: 'LowerLeg', foot: 'Foot', toe: 'ToeBase' };
  var BONES = {
    hips: 'J_Bip_C_Hips', spine: 'J_Bip_C_Spine', chest: 'J_Bip_C_Chest', upper: 'J_Bip_C_UpperChest',
    neck: 'J_Bip_C_Neck', head: 'J_Bip_C_Head'
  };
  var FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
  var FINGER_BONES = { fl: [], fr: [], tl: [], tr: [] };
  (function () {
    var k, side, s, n, f;
    for (k in PAIRS) {
      BONES['l' + k] = 'J_Bip_L_' + PAIRS[k];
      BONES['r' + k] = 'J_Bip_R_' + PAIRS[k];
    }
    for (s = 0; s < 2; s++) {
      side = s ? 'R' : 'L';
      for (f = 0; f < FINGERS.length; f++) {
        for (n = 1; n <= 3; n++) { FINGER_BONES[s ? 'fr' : 'fl'].push('J_Bip_' + side + '_' + FINGERS[f] + n); }
      }
      for (n = 1; n <= 3; n++) { FINGER_BONES[s ? 'tr' : 'tl'].push('J_Bip_' + side + '_Thumb' + n); }
    }
  })();

  /** 자세 키 이름 → 그 키가 움직이는 뼈 이름들 */
  function bonesOfKey(key) {
    if (FINGER_BONES[key]) { return FINGER_BONES[key]; }
    return BONES[key] ? [BONES[key]] : [];
  }
  var POSE_KEYS = Object.keys(BONES).concat(Object.keys(FINGER_BONES));

  /* ── 뼈대(rig) ───────────────────────────────────────────
   * rig = { list:[{name, parent, q:[..], p:[..]}], by:{name→노드}, hipsName }
   * 정지 로컬만 받는다. 월드(몸 기준 좌표계 = 엉덩이 부모의 로컬)는 여기서 계산한다. */
  function makeRig(list) {
    var by = {}, i, n;
    for (i = 0; i < list.length; i++) {
      n = list[i];
      by[n.name] = { name: n.name, parent: n.parent || null, q: n.q || [0, 0, 0, 1], p: n.p || [0, 0, 0], kids: [], wq: null, wp: null };
    }
    for (i = 0; i < list.length; i++) {
      n = by[list[i].name];
      if (n.parent && by[n.parent]) { by[n.parent].kids.push(n.name); } else { n.parent = null; }
    }
    /* 부모가 먼저 오는 순서 */
    var order = [];
    (function walk(nm) { order.push(nm); by[nm].kids.forEach(walk); })(BONES.hips);
    for (i = 0; i < order.length; i++) {
      n = by[order[i]];
      var par = n.parent ? by[n.parent] : null;
      n.wq = par ? qmul(par.wq, n.q) : n.q.slice();
      n.wp = par ? vadd(par.wp, qrot(par.wq, n.p)) : n.p.slice();
    }
    var rig = { by: by, order: order, has: function (nm) { return !!by[nm]; } };
    rig.frame = frameOf(rig);
    rig.scale = rig.frame.hipsH / 0.896;       // 이 몸이 표준 VRoid 보다 얼마나 큰가(움직임 크기를 맞춘다)
    rig.rest = restContacts(rig);
    return rig;
  }

  /** 몸 기준 축 — 위·앞·왼 (정지 자세의 월드 위치에서 뽑는다) */
  function frameOf(rig) {
    var b = rig.by, hips = b[BONES.hips].wp, head = b[BONES.head] ? b[BONES.head].wp : vadd(hips, [0, 1, 0]);
    var u = vnorm(vsub(head, hips));
    var foot = b[BONES.lfoot].wp, toe = b[BONES.ltoe] ? b[BONES.ltoe].wp : vadd(foot, [0, 0, -0.1]);
    var f = vsub(toe, foot);
    f = vnorm(vsub(f, vmul(u, vdot(f, u))));                 // 위 성분을 뺀 앞
    var l = vcross(u, f);
    return { u: u, f: f, l: l, hipsH: vdot(hips, u) };
  }

  /** 접지 점 — 뒤꿈치(발목 아래·뒤)와 발볼(발끝 관절 아래). 뼈 축 기준 오프셋(표준 몸 크기) */
  var HEEL = { f: -0.045, l: 0, u: -0.088 };
  var BALL = { f: 0, l: 0, u: -0.037 };

  function contactOffset(rig, o) {
    var fr = rig.frame, s = rig.scale;
    return vadd(vadd(vmul(fr.f, o.f * s), vmul(fr.l, o.l * s)), vmul(fr.u, o.u * s));
  }

  function restContacts(rig) {
    var pts = groundPoints(rig, worldFrom(rig, {}), true), m = 1e9, i;
    for (i = 0; i < pts.length; i++) { m = Math.min(m, pts[i]); }
    return { minUp: m };
  }

  /** 발바닥 접지 점들의 위쪽 좌표 */
  function groundPoints(rig, W, rest) {
    var out = [], fr = rig.frame, sides = ['l', 'r'], i, foot, toe, off;
    for (i = 0; i < 2; i++) {
      foot = W[BONES[sides[i] + 'foot']]; toe = W[BONES[sides[i] + 'toe']];
      if (foot) {
        off = qrot(qmul(foot.q, qconj(rig.by[BONES[sides[i] + 'foot']].wq)), contactOffset(rig, HEEL));
        out.push(vdot(vadd(foot.p, off), fr.u));
      }
      if (toe) {
        off = qrot(qmul(toe.q, qconj(rig.by[BONES[sides[i] + 'toe']].wq)), contactOffset(rig, BALL));
        out.push(vdot(vadd(toe.p, off), fr.u));
      }
    }
    return out;
  }

  /* ── 자세 → 뼈 로컬 회전 ───────────────────────────────── */
  /** (r,p,y) 도 → 몸 축 월드 회전 R = Ry · Rp · Rr */
  function eulerWorld(fr, r, p, y) {
    var q = [0, 0, 0, 1];
    if (y) { q = qmul(q, qaxis(fr.u, y * D2R)); }
    if (p) { q = qmul(q, qaxis(fr.l, p * D2R)); }
    if (r) { q = qmul(q, qaxis(fr.f, r * D2R)); }
    return q;
  }

  /** 자세 pose(평평한 { 'lua.r': 도, ... }) → 뼈 이름 → 로컬 쿼터니언 */
  function localQuats(rig, pose) {
    var out = {}, fr = rig.frame, k, i, names, ax, ang, R, node, par, pw;
    for (i = 0; i < POSE_KEYS.length; i++) {
      k = POSE_KEYS[i];
      var r = pose[k + '.r'] || 0, p = pose[k + '.p'] || 0, y = pose[k + '.y'] || 0;
      names = bonesOfKey(k);
      R = eulerWorld(fr, r, p, y);
      for (var j = 0; j < names.length; j++) {
        node = rig.by[names[j]];
        if (!node) { continue; }
        par = node.parent ? rig.by[node.parent] : null;
        pw = par ? par.wq : [0, 0, 0, 1];
        out[names[j]] = qnorm(qmul(qmul(qmul(qconj(pw), R), pw), node.q));
      }
    }
    return out;
  }

  /** 로컬 회전(+ 엉덩이 위치 이동)으로 월드 위치·회전을 계산한다 (FK) */
  function worldFrom(rig, locals, hipsOffset) {
    var W = {}, i, n, par, q;
    for (i = 0; i < rig.order.length; i++) {
      n = rig.by[rig.order[i]];
      par = n.parent ? W[n.parent] : null;
      q = locals[n.name] || n.q;
      if (!par) {
        W[n.name] = { q: q.slice(), p: vadd(n.p, hipsOffset || [0, 0, 0]) };
      } else {
        W[n.name] = { q: qmul(par.q, q), p: vadd(par.p, qrot(par.q, n.p)) };
      }
    }
    return W;
  }

  /** 엉덩이 이동 (몸 축, 표준 크기 미터) → 몸 좌표계 벡터 */
  function hipsShift(rig, dx, dy, dz) {
    var fr = rig.frame, s = rig.scale;
    return vadd(vadd(vmul(fr.l, dx * s), vmul(fr.u, dy * s)), vmul(fr.f, dz * s));
  }

  /** 접지: 엉덩이가 이미 dy0 만큼 옮겨 있을 때, 가장 낮은 발바닥 점이 정지 높이가 되도록 **더** 옮길 dy(표준 미터) */
  function solveGround(rig, locals, dx, dz, dy0) {
    var W = worldFrom(rig, locals, hipsShift(rig, dx, dy0 || 0, dz)), pts = groundPoints(rig, W), m = 1e9, i;
    for (i = 0; i < pts.length; i++) { m = Math.min(m, pts[i]); }
    return (rig.rest.minUp - m) / rig.scale;
  }

  /* ── 자세 도구 ─────────────────────────────────────────── */
  function merge(a, b) { var o = {}, k; for (k in a) { o[k] = a[k]; } for (k in b) { o[k] = b[k]; } return o; }
  /** 좌우 한 쌍 — 왼쪽 값을 주면 오른쪽은 r·y 부호를 뒤집어 채운다 */
  function S(base, r, p, y) {
    var o = {}, lk = base === 'f' ? 'fl' : base === 't' ? 'tl' : 'l' + base, rk = base === 'f' ? 'fr' : base === 't' ? 'tr' : 'r' + base;
    if (r !== undefined && r !== null) { o[lk + '.r'] = r; o[rk + '.r'] = -r; }
    if (p !== undefined && p !== null) { o[lk + '.p'] = p; o[rk + '.p'] = p; }
    if (y !== undefined && y !== null) { o[lk + '.y'] = y; o[rk + '.y'] = -y; }
    return o;
  }
  function M() { var o = {}, i; for (i = 0; i < arguments.length; i++) { o = merge(o, arguments[i]); } return o; }

  /** 서 있는 편한 자세 — 팔을 내리고 손가락을 살짝 말고 팔꿈치를 조금 굽힌다 */
  var BASE = M(S('ua', -72), S('la', null, null, -12), S('sh', -4), S('f', -16), S('t', -6), { g: 1 });

  /* 부드러운 곡선 */
  function smooth(k) { return k * k * (3 - 2 * k); }
  function easeOut(k) { return 1 - (1 - k) * (1 - k); }
  function easeIn(k) { return k * k; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function wrap(a) { while (a > Math.PI) { a -= 2 * Math.PI; } while (a < -Math.PI) { a += 2 * Math.PI; } return a; }
  /** φ 가 c 근처 hw 안에 있을 때 0→1→0 종 모양 */
  function pulse(phi, c, hw) { var d = wrap(phi - c); return Math.abs(d) < hw ? 0.5 * (1 + Math.cos(Math.PI * d / hw)) : 0; }

  /** 키 자세 목록 [[u, pose, ease?], ...] → u(0~1) 로 자세를 보간하는 함수 */
  function keyed(keys) {
    return function (u) {
      var i, a, b, k, e, out = {}, n;
      if (u <= keys[0][0]) { return keys[0][1]; }
      for (i = 1; i < keys.length; i++) {
        if (u <= keys[i][0]) {
          a = keys[i - 1][1]; b = keys[i][1];
          k = (u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
          e = keys[i][2] === 'out' ? easeOut(k) : keys[i][2] === 'in' ? easeIn(k) : keys[i][2] === 'lin' ? k : smooth(k);
          for (n in b) { out[n] = lerp(a[n] || 0, b[n], e); }
          for (n in a) { if (!(n in b)) { out[n] = lerp(a[n], 0, e); } }
          return out;
        }
      }
      return keys[keys.length - 1][1];
    };
  }

  /* ── 클립 정의 ─────────────────────────────────────────── */

  /** 걷는 두 다리 — a: 앞으로 든 각(°), k: 무릎 굽힘, ft: 발목(발끝 내림 +) */
  function legs(aL, kL, ftL, aR, kR, ftR) {
    return {
      'lul.p': -aL, 'lll.p': kL, 'lfoot.p': ftL,
      'rul.p': -aR, 'rll.p': kR, 'rfoot.p': ftR
    };
  }

  function idlePose(t01) {
    var ph = t01 * 2 * Math.PI, s1 = Math.sin(ph), c1 = Math.cos(ph), s2 = Math.sin(2 * ph);
    return M(BASE, {
      'chest.p': 1.2 * s1, 'upper.p': 0.9 * Math.sin(ph + 0.5), 'neck.p': -0.7 * s1,
      'head.p': 1.0 * Math.sin(ph + 1.1), 'head.y': 2.2 * Math.sin(ph + 0.3),
      'hips.r': 1.3 * Math.sin(ph + 1.3), 'spine.r': -0.9 * Math.sin(ph + 1.3), 'hips.y': 1.2 * s2,
      'hips.dx': 0.004 * Math.sin(ph + 1.3)
    }, S('ua', null, 1.6 * Math.sin(ph + 0.8)), S('la', null, null, -12 - 2.5 * (1 + s1) / 2), S('sh', 1.2 * s1),
      S('ul', 1.5 * Math.sin(ph + 1.3)), S('foot', null, 0),
      { 'hips.dz': 0 });
  }

  function walkPose(t01) {
    var ph = t01 * 2 * Math.PI, s = Math.sin(ph);
    var aL = 26 * s, aR = -aL;
    var kL = 6 + 42 * pulse(ph, 0, 1.15) + 10 * pulse(ph, 1.9, 0.7);
    var kR = 6 + 42 * pulse(ph, Math.PI, 1.15) + 10 * pulse(ph, Math.PI + 1.9, 0.7);
    var ftL = (aL - kL) + 12 * pulse(ph, 4.5, 0.75) - 7 * pulse(ph, 1.25, 0.6);
    var ftR = (aR - kR) + 12 * pulse(ph, 4.5 - Math.PI, 0.75) - 7 * pulse(ph, 1.25 - Math.PI, 0.6);
    var afL = -20 * s, afR = 20 * s;                               // 팔은 반대쪽 다리와 함께 나간다
    return M(BASE, legs(aL, kL, ftL, aR, kR, ftR), {
      'lua.p': -afL, 'rua.p': -afR,
      'lla.y': -(16 + 16 * (afL + 20) / 40), 'rla.y': 16 + 16 * (afR + 20) / 40,
      'chest.y': 7 * s, 'upper.y': 3 * s, 'hips.y': -5 * s, 'head.y': -4 * s,
      'spine.p': 3, 'chest.p': 1.5, 'hips.dx': -0.01 * s,
      'hips.r': 1.6 * Math.cos(ph), 'chest.r': -1.2 * Math.cos(ph)
    });
  }

  function runPose(t01) {
    var ph = t01 * 2 * Math.PI, s = Math.sin(ph);
    var aL = 42 * s, aR = -aL;
    var kL = 16 + 92 * pulse(ph, -0.2, 1.3), kR = 16 + 92 * pulse(ph, Math.PI - 0.2, 1.3);
    var ftL = (aL - kL) * 0.8 + 16 * pulse(ph, 4.5, 0.8), ftR = (aR - kR) * 0.8 + 16 * pulse(ph, 4.5 - Math.PI, 0.8);
    var afL = -46 * s, afR = 46 * s;
    return M(BASE, legs(aL, kL, ftL, aR, kR, ftR), {
      'lua.p': -afL, 'rua.p': -afR,
      'lla.y': -(82 + 8 * s), 'rla.y': 82 - 8 * s,
      'lua.r': -66, 'rua.r': 66,
      'chest.y': 9 * s, 'upper.y': 4 * s, 'hips.y': -7 * s, 'head.y': -5 * s,
      'spine.p': 6, 'chest.p': 5, 'neck.p': -4, 'head.p': -3, 'hips.dx': -0.012 * s,
      'lift': 0.05 * s * s
    });
  }

  /** 서 있다 웅크렸다 도약 — 그 뒤 공중 자세를 붙든다 */
  var jumpPose = (function () {
    var crouch = M(BASE, legs(58, 100, 42, 58, 100, 42), S('ua', null, 38), S('la', null, null, -22),
      { 'spine.p': 24, 'chest.p': 10, 'head.p': -12, 'hips.dy': 0, 'g': 1 });
    var stretch = M(BASE, legs(-6, 4, 40, -6, 4, 40), S('ua', -62, -118), S('la', null, null, -8),
      { 'spine.p': -3, 'chest.p': -4, 'head.p': -6, 'g': 0.5 });
    var tuck = M(BASE, legs(34, 44, 24, 26, 60, 26), S('ua', -30, -100), S('la', null, null, -30),
      { 'spine.p': 8, 'chest.p': 3, 'g': 0 });
    var fall = M(BASE, legs(16, 20, 30, 8, 32, 32), S('ua', -18, -26), S('la', null, null, -16),
      { 'spine.p': 4, 'head.p': -4, 'g': 0 });
    return keyed([[0, BASE], [0.24, crouch], [0.42, stretch, 'out'], [0.7, tuck], [1, fall]]);
  })();

  /** 착지 — 공중 자세에서 받아 내렸다가 일어선다 */
  var landPose = (function () {
    var air = M(BASE, legs(16, 20, 30, 8, 32, 32), S('ua', -18, -26), S('la', null, null, -16),
      { 'spine.p': 4, 'head.p': -4, 'g': 0 });
    var hit = M(BASE, legs(52, 92, 40, 48, 88, 40), S('ua', null, -34), S('la', null, null, -24),
      { 'spine.p': 20, 'chest.p': 8, 'head.p': -10, 'g': 1 });
    var settle = M(BASE, legs(30, 52, 22, 28, 50, 22), S('ua', null, -12), { 'spine.p': 10, 'chest.p': 4, 'g': 1 });
    return keyed([[0, air], [0.2, hit, 'out'], [0.55, settle], [1, BASE]]);
  })();

  /** 오른손 내려치기 — 왼발을 내딛으며 몸을 감았다 푼다 */
  var attackPose = (function () {
    var wind = M(BASE, legs(-14, 22, -8, 26, 30, 8), {
      'rua.r': -102, 'rua.p': -46, 'rla.y': 62, 'rhand.p': -10,
      'lua.r': -48, 'lua.p': -32, 'lla.y': -38,
      'chest.y': -30, 'upper.y': -10, 'hips.y': -14, 'spine.p': -4, 'chest.p': -3, 'head.y': 12,
      'hips.dz': -0.02
    });
    var strike = M(BASE, legs(30, 44, 6, -12, 30, 18), {
      'rua.r': 34, 'rua.p': -72, 'rla.y': 14, 'rhand.p': 10,
      'lua.r': -66, 'lua.p': 28, 'lla.y': -60,
      'chest.y': 34, 'upper.y': 10, 'hips.y': 16, 'spine.p': 13, 'chest.p': 7, 'head.p': -6, 'head.y': -14,
      'hips.dz': -0.06
    });
    var follow = M(BASE, legs(26, 40, 4, -8, 26, 16), {
      'rua.r': 46, 'rua.p': -38, 'rla.y': 22,
      'lua.r': -64, 'lua.p': 20, 'lla.y': -50,
      'chest.y': 40, 'upper.y': 12, 'hips.y': 18, 'spine.p': 15, 'chest.p': 8, 'head.y': -16,
      'hips.dz': -0.07
    });
    return keyed([[0, BASE], [0.3, wind], [0.46, strike, 'in'], [0.62, follow, 'out'], [1, BASE]]);
  })();

  /** 맞고 움찔 — 뒤로 젖혔다 돌아온다 */
  var hitPose = (function () {
    var hit = M(BASE, legs(-10, 14, 6, 6, 22, 10), {
      'spine.p': -14, 'chest.p': -9, 'neck.p': -8, 'head.p': -16, 'hips.dz': 0.045, 'hips.y': 6,
      'lua.r': -42, 'rua.r': 42, 'lua.p': 18, 'rua.p': 18, 'lla.y': -30, 'rla.y': 30, 'fl.r': -4, 'fr.r': 4
    });
    var back = M(BASE, legs(6, 18, 4, 2, 16, 4), { 'spine.p': 5, 'chest.p': 2, 'head.p': 4, 'hips.dz': -0.008 });
    return keyed([[0, BASE], [0.22, hit, 'out'], [0.62, back], [1, BASE]]);
  })();

  /** 쓰러짐 — 움찔, 무릎이 꺾이고, 뒤로 넘어가 눕는다. 끝 자세를 붙든다 */
  var deathPose = (function () {
    var flinch = M(BASE, legs(-8, 14, 6, 8, 22, 10), {
      'spine.p': -12, 'chest.p': -8, 'head.p': -14, 'hips.dz': 0.04,
      'lua.r': -40, 'rua.r': 40, 'lua.p': 16, 'rua.p': 16
    });
    var buckle = M(BASE, legs(24, 74, 30, 12, 84, 34), {
      'spine.p': 8, 'chest.p': -6, 'head.p': -22, 'hips.dz': 0.05, 'g': 1,
      'lua.r': -50, 'rua.r': 50, 'lla.y': -30, 'rla.y': 30
    });
    var topple = M(BASE, legs(16, 30, 40, 20, 36, 42), {
      'hips.p': -55, 'spine.p': -8, 'head.p': -14, 'hips.dz': 0.22, 'g': 1,
      'lua.r': -30, 'rua.r': 30, 'lua.p': 30, 'rua.p': 30
    });
    var lie = M(BASE, legs(4, 16, 42, 10, 26, 44), {
      'hips.p': -90, 'spine.p': -4, 'head.p': -8, 'hips.dz': 0.05, 'g': 1,
      'lua.r': -20, 'rua.r': 24, 'lua.p': 12, 'rua.p': 4, 'lla.y': -18, 'rla.y': 26, 'fl.r': -10, 'fr.r': 10
    });
    return keyed([[0, BASE], [0.14, flinch, 'out'], [0.44, buckle], [0.72, topple, 'in'], [1, lie, 'out']]);
  })();

  /** 앞구르기 회피 — 웅크려 몸을 말고 한 바퀴 굴러 일어선다(제자리, 이동은 게임이 준다) */
  var dodgePose = (function () {
    var tuck = function (deg) {
      return M(BASE, legs(96, 126, 40, 96, 126, 40), S('ua', -30, -38), S('la', null, null, -70),
        { 'spine.p': 56, 'chest.p': 16, 'neck.p': 22, 'head.p': 14, 'hips.p': deg, 'hips.dy': -0.3, 'g': 0 });
    };
    var crouch = M(BASE, legs(62, 104, 44, 62, 104, 44), S('ua', null, -46), S('la', null, null, -40),
      { 'spine.p': 30, 'chest.p': 12, 'head.p': -6, 'hips.dy': -0.2, 'g': 1 });
    /* 한 바퀴를 돈 뒤의 자세는 hips.p 를 360 으로 이어 붙인다 — 0 으로 두면 각도 보간이 한 바퀴를 거꾸로 되감는다 */
    var land = M(BASE, legs(50, 88, 36, 44, 82, 36), S('ua', null, -10), { 'spine.p': 18, 'chest.p': 6, 'hips.p': 360, 'g': 1 });
    var stand = M(BASE, { 'hips.p': 360 });
    return keyed([[0, BASE], [0.14, crouch], [0.24, tuck(0), 'out'], [0.72, tuck(360), 'lin'], [0.84, land], [1, stand]]);
  })();

  /** 클립 표 — 이름은 asset3d.mapClips() 가 알아보는 낱말을 담는다 */
  var CLIPS = [
    { name: 'Idle_Loop', dur: 3.2, loop: true, fps: 30, fn: idlePose, ground: true },
    { name: 'Walk_Loop', dur: 1.0, loop: true, fps: 30, fn: walkPose, ground: true },
    { name: 'Run_Loop', dur: 0.66, loop: true, fps: 60, fn: runPose, ground: true },
    { name: 'Jump', dur: 0.75, loop: false, fps: 30, fn: jumpPose, ground: true },
    { name: 'Land', dur: 0.5, loop: false, fps: 60, fn: landPose, ground: true },
    { name: 'Attack', dur: 0.8, loop: false, fps: 60, fn: attackPose, ground: true },
    { name: 'Hit', dur: 0.5, loop: false, fps: 60, fn: hitPose, ground: true },
    { name: 'Death', dur: 1.6, loop: false, fps: 60, fn: deathPose, ground: true },
    { name: 'Dodge', dur: 0.7, loop: false, fps: 60, fn: dodgePose, ground: true }
  ];

  /* ── 굽기 ─────────────────────────────────────────────── */

  /**
   * 한 시각의 로컬 회전과 엉덩이 위치 이동.
   * 접지 클립(`ground`)은 자세의 `g`(0~1)만큼 FK 로 잰 발바닥 높이를 엉덩이 dy 에 더한다.
   */
  function frameAt(rig, def, t01) {
    var pose = def.fn(t01), locals = localQuats(rig, pose);
    var dx = pose['hips.dx'] || 0, dz = pose['hips.dz'] || 0, dy = pose['hips.dy'] || 0;
    if (def.ground) {
      var g = pose.g === undefined ? 1 : pose.g;
      /* 발이 땅 아래로 들어가면(solved > 0) g 와 상관없이 언제나 들어 올린다 — 공중 자세와 섞이는 중에도 안 박힌다 */
      var solved = solveGround(rig, locals, dx, dz, dy);
      dy += solved > 0 ? solved : g * solved;
    }
    dy += pose.lift || 0;                     // 달리기의 공중 뜸 — 접지를 푼 **뒤에** 얹는다
    return { locals: locals, shift: hipsShift(rig, dx, dy, dz) };
  }

  /**
   * 뼈 대 rig 위에서 아홉 클립 데이터를 굽는다(three 불필요).
   * @returns [{ name, duration, loop, fps, tracks:[{ bone, kind:'q'|'p', times:[..], values:[..] }] }]
   */
  function clipData(rig, only) {
    var out = [], ci, def, n, i, k, bone, names = {}, t, fr, tr, q;
    var animated = [], key;
    for (ci = 0; ci < POSE_KEYS.length; ci++) {
      bonesOfKey(POSE_KEYS[ci]).forEach(function (nm) { if (rig.by[nm]) { animated.push(nm); } });
    }
    for (ci = 0; ci < CLIPS.length; ci++) {
      def = CLIPS[ci];
      if (only && only.indexOf(def.name) < 0) { continue; }
      n = Math.round(def.dur * def.fps);
      var qtr = {}, times = [], ptimes = [], pvals = [];
      for (i = 0; i < animated.length; i++) { qtr[animated[i]] = []; }
      var prev = {};
      for (k = 0; k <= n; k++) {
        t = k / n;
        fr = frameAt(rig, def, t);
        times.push(t * def.dur);
        for (i = 0; i < animated.length; i++) {
          bone = animated[i];
          q = fr.locals[bone] || rig.by[bone].q;
          /* 같은 뼈의 이웃 키는 같은 반구로 — 슬러프가 먼 길로 돌지 않게 */
          if (prev[bone] && (prev[bone][0] * q[0] + prev[bone][1] * q[1] + prev[bone][2] * q[2] + prev[bone][3] * q[3]) < 0) {
            q = [-q[0], -q[1], -q[2], -q[3]];
          }
          prev[bone] = q;
          qtr[bone].push(q[0], q[1], q[2], q[3]);
        }
        var hp = vadd(rig.by[BONES.hips].p, fr.shift);
        pvals.push(hp[0], hp[1], hp[2]);
      }
      var tracks = [{ bone: BONES.hips, kind: 'p', times: times.slice(), values: pvals }];
      for (i = 0; i < animated.length; i++) { tracks.push({ bone: animated[i], kind: 'q', times: times.slice(), values: qtr[animated[i]] }); }
      out.push({ name: def.name, duration: def.dur, loop: def.loop, fps: def.fps, tracks: tracks });
    }
    return out;
  }

  /** 굽은 클립을 시각 t 로 재생한 월드 위치·회전 (진단용) */
  function fkAt(rig, clip, t) {
    var locals = {}, i, tr, idx, a, b, k, hp = null, n = clip.tracks[0].times.length;
    var tt = Math.max(0, Math.min(clip.duration, t));
    var dt = clip.duration / (n - 1);
    idx = Math.min(n - 2, Math.floor(tt / dt + 1e-9));
    k = (tt - idx * dt) / dt;
    for (i = 0; i < clip.tracks.length; i++) {
      tr = clip.tracks[i];
      if (tr.kind === 'q') {
        a = tr.values.slice(idx * 4, idx * 4 + 4); b = tr.values.slice(idx * 4 + 4, idx * 4 + 8);
        locals[tr.bone] = qslerp(a, b, k);
      } else {
        a = tr.values.slice(idx * 3, idx * 3 + 3); b = tr.values.slice(idx * 3 + 3, idx * 3 + 6);
        hp = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      }
    }
    var off = hp ? vsub(hp, rig.by[BONES.hips].p) : [0, 0, 0];
    return worldFrom(rig, locals, off);
  }

  /* ── 브라우저 쪽: 실제 몸에서 rig 을 읽고 three 클립으로 바꾼다 ───────────── */

  /** three Object3D(스킨 메시가 든 장면 또는 그 자식) 안의 VRM 휴머노이드 뼈로 rig 을 만든다. 못 찾으면 null */
  function rigFromObject3D(root) {
    var hips = null;
    root.traverse(function (o) { if (!hips && o.name === BONES.hips) { hips = o; } });
    if (!hips) { return null; }
    var list = [];
    (function walk(o, parent) {
      if (o !== hips && !/^J_Bip_/.test(o.name)) { return; }
      list.push({ name: o.name, parent: parent, q: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w], p: [o.position.x, o.position.y, o.position.z] });
      for (var i = 0; i < o.children.length; i++) { walk(o.children[i], o.name); }
    })(hips, null);
    list[0].parent = null;
    var need = [BONES.lfoot, BONES.rfoot, BONES.head, BONES.lul, BONES.rul, BONES.lua, BONES.rua];
    var have = {}, i;
    for (i = 0; i < list.length; i++) { have[list[i].name] = 1; }
    for (i = 0; i < need.length; i++) { if (!have[need[i]]) { return null; } }
    return makeRig(list);
  }

  /** 장면 root 의 VRM 몸에 맞춘 three AnimationClip 아홉. 못 만들면 빈 배열(그러면 호출한 쪽이 옛 길로 간다) */
  function clipsFor(root, THREE) {
    if (!THREE || !root) { return []; }
    var rig;
    try { rig = rigFromObject3D(root); } catch (e) { return []; }
    if (!rig) { return []; }
    return clipData(rig).map(function (c) {
      var tracks = c.tracks.map(function (tr) {
        return tr.kind === 'q'
          ? new THREE.QuaternionKeyframeTrack(tr.bone + '.quaternion', tr.times, tr.values)
          : new THREE.VectorKeyframeTrack(tr.bone + '.position', tr.times, tr.values);
      });
      var clip = new THREE.AnimationClip(c.name, c.duration, tracks);
      return clip;
    });
  }

  /** 표준 VRoid 뼈대(진단·three 없이 돌려 볼 때 쓰는 참조) — `[이름(J_Bip_ 뗀 것), 부모, x, y, z]`, 정지 회전은 전부 항등 */
  var REF_RIG_TABLE = /*REFRIG*/[
    ["C_Hips",null,0,0.8961,-0.0066],
    ["C_Spine","C_Hips",0,0.0579,-0.0101],
    ["C_Chest","C_Spine",0,0.1141,-0.0114],
    ["C_UpperChest","C_Chest",0,0.1113,0.0122],
    ["C_Neck","C_UpperChest",0,0.1028,0.0299],
    ["C_Head","C_Neck",0,0.0695,-0.009],
    ["L_Shoulder","C_UpperChest",-0.0201,0.0782,0.0246],
    ["L_UpperArm","L_Shoulder",-0.0622,-0.0107,-0.0039],
    ["L_LowerArm","L_UpperArm",-0.24,-0.0112,-0.002],
    ["L_Hand","L_LowerArm",-0.2334,-0.0005,-0.0193],
    ["L_Index1","L_Hand",-0.0542,0.0049,-0.0188],
    ["L_Index2","L_Index1",-0.0278,-0.0001,-0.0045],
    ["L_Index3","L_Index2",-0.0172,-0.0006,-0.002],
    ["L_Little1","L_Hand",-0.0538,0.0027,0.0238],
    ["L_Little2","L_Little1",-0.0266,-0.0002,0.0001],
    ["L_Little3","L_Little2",-0.0153,0.0006,0.0009],
    ["L_Middle1","L_Hand",-0.0561,0.0073,-0.004],
    ["L_Middle2","L_Middle1",-0.0313,-0.0012,-0.002],
    ["L_Middle3","L_Middle2",-0.0192,-0.0021,-0.0008],
    ["L_Ring1","L_Hand",-0.0566,0.0072,0.0098],
    ["L_Ring2","L_Ring1",-0.0291,-0.0005,-0.0001],
    ["L_Ring3","L_Ring2",-0.0168,0.0006,-0.0002],
    ["L_Thumb1","L_Hand",-0.0017,-0.006,-0.0156],
    ["L_Thumb2","L_Thumb1",-0.0273,-0.0023,-0.0294],
    ["L_Thumb3","L_Thumb2",-0.018,-0.0013,-0.0167],
    ["R_Shoulder","C_UpperChest",0.0201,0.0783,0.0246],
    ["R_UpperArm","R_Shoulder",0.0622,-0.0107,-0.0039],
    ["R_LowerArm","R_UpperArm",0.24,-0.0112,-0.0019],
    ["R_Hand","R_LowerArm",0.2334,-0.0005,-0.0193],
    ["R_Index1","R_Hand",0.0542,0.0049,-0.0188],
    ["R_Index2","R_Index1",0.0278,-0.0001,-0.0045],
    ["R_Index3","R_Index2",0.0172,-0.0006,-0.002],
    ["R_Little1","R_Hand",0.0538,0.0027,0.0238],
    ["R_Little2","R_Little1",0.0266,-0.0002,0.0001],
    ["R_Little3","R_Little2",0.0153,0.0006,0.0009],
    ["R_Middle1","R_Hand",0.0561,0.0073,-0.0041],
    ["R_Middle2","R_Middle1",0.0313,-0.0012,-0.0021],
    ["R_Middle3","R_Middle2",0.0192,-0.0021,-0.0008],
    ["R_Ring1","R_Hand",0.0566,0.0072,0.0098],
    ["R_Ring2","R_Ring1",0.0291,-0.0005,-0.0001],
    ["R_Ring3","R_Ring2",0.0168,0.0006,-0.0002],
    ["R_Thumb1","R_Hand",0.0017,-0.006,-0.0156],
    ["R_Thumb2","R_Thumb1",0.0273,-0.0023,-0.0294],
    ["R_Thumb3","R_Thumb2",0.018,-0.0013,-0.0167],
    ["L_UpperLeg","C_Hips",-0.0692,-0.0354,0.0054],
    ["L_LowerLeg","L_UpperLeg",0.0209,-0.3631,0.0065],
    ["L_Foot","L_LowerLeg",0.0103,-0.4056,0.0218],
    ["L_ToeBase","L_Foot",-0.0019,-0.0531,-0.0975],
    ["R_UpperLeg","C_Hips",0.0692,-0.0354,0.0054],
    ["R_LowerLeg","R_UpperLeg",-0.0209,-0.3631,0.0065],
    ["R_Foot","R_LowerLeg",-0.0103,-0.4056,0.0218],
    ["R_ToeBase","R_Foot",0.0019,-0.0531,-0.0975]
  ];
  function refRig() {
    return makeRig(REF_RIG_TABLE.map(function (r) {
      return { name: 'J_Bip_' + r[0], parent: r[1] ? 'J_Bip_' + r[1] : null, q: [0, 0, 0, 1], p: [r[2], r[3], r[4]] };
    }));
  }

  global.DG = global.DG || {};
  global.DG.ownAnim = {
    BONES: BONES, POSE_KEYS: POSE_KEYS, CLIP_NAMES: CLIPS.map(function (c) { return c.name; }),
    CLIPS: CLIPS, BASE: BASE,
    makeRig: makeRig, refRig: refRig, rigFromObject3D: rigFromObject3D,
    clipData: clipData, clipsFor: clipsFor, fkAt: fkAt, frameAt: frameAt, localQuats: localQuats, worldFrom: worldFrom,
    groundPoints: groundPoints,
    math: { qmul: qmul, qrot: qrot, qconj: qconj, qaxis: qaxis, qslerp: qslerp, vadd: vadd, vsub: vsub, vdot: vdot, vlen: vlen, vcross: vcross }
  };
})(window);
