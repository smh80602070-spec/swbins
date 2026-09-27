/**
 * 대화 연출 — 어깨 너머 카메라 · 입 모양 · 표정 · 깜박임 · 손짓 (PLAN §5 ⑲-13, saga-godot PLAN 106 ㉗㉙)
 * ---------------------------------------------------------------
 *   카메라   말하는 이 얼굴(키 × 0.85)을 가운데, 듣는 이 어깨 너머(옆 22°·위 9°, 팔 = 두 사람 거리 + 키 × 0.95).
 *            `talkAim` 은 순수 함수 — `world3d.camAim` 과 같은 꼴 {pos, look}(y 는 땅 위 높이)을 낸다
 *   입       한글 음절의 가운뎃소리 21 → VRoid 입 다섯(Fcl_MTH_A·I·U·E·O). 한글이 아니면 닫는다(`vowelOf`)
 *   표정     joy·angry·sorrow·surprised·fun → Fcl_ALL_* 0.7 · 깜박임 2.2~5초마다 0.14초(Fcl_EYE_Close)
 *   손짓     말하는 동안 오른팔을 앞으로(윗팔 38°·아랫팔 42°, 천천히 흔듦)·글자마다 끄덕임 —
 *            몸 방향의 오른쪽 축으로 도는 **세계 회전**을 믹서가 쓴 뼈 자세 위에 얹는다(뼈 축이 몸마다 달라도 된다)
 * 모프는 VRoid 몸(`/people/anime/`)에만 있다 — 없으면 손짓만 한다. 뼈는 QRPG(`UpperArm.R`)·VRoid(`J_Bip_R_UpperArm`) 이름을 둘 다 찾는다.
 * 세이브 없음. 화면 층만 — 판정은 `story.js` 가 한다.
 */
(function (global) {
  'use strict';

  var SIDE = 22 * Math.PI / 180, UP = 9 * Math.PI / 180, FACE = 0.85, ARM_PLUS = 0.95;
  var UPPER = 38 * Math.PI / 180, LOWER = 42 * Math.PI / 180, NOD = 5 * Math.PI / 180;
  var MOUTH_CLOSE = 0.14, EMO_W = 0.7, BLINK_MIN = 2.2, BLINK_MAX = 5, BLINK_LEN = 0.14, BLEND = 0.25;
  var EMO = { joy: 'Joy', angry: 'Angry', sorrow: 'Sorrow', surprised: 'Surprised', fun: 'Fun' };

  /* ── 순수 ─────────────────────────────────────────────── */

  /* 가운뎃소리 0~20(ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ) → 입 */
  var JUNG = ['A', 'E', 'A', 'E', 'O', 'E', 'O', 'E', 'O', 'A', 'E', 'E', 'O', 'U', 'O', 'E', 'I', 'U', 'U', 'I', 'I'];
  /** 한 글자의 입 모양 — 'A'·'I'·'U'·'E'·'O' 또는 null(한글 음절이 아님) */
  function vowelOf(ch) {
    var c = String(ch || '').charCodeAt(0);
    if (!(c >= 0xac00 && c <= 0xd7a3)) { return null; }
    return JUNG[Math.floor(((c - 0xac00) % 588) / 28)];
  }

  /**
   * 대화 카메라 — spk(말하는 이)·lst(듣는 이) = {x, y}(땅 좌표), h = 몸 키(m).
   * 듣는 이 뒤에서 말하는 이 얼굴을 본다. 둘이 겹쳐 서 있으면(거리 0) 남쪽에서 본다.
   */
  function talkAim(spk, lst, h) {
    var dx = lst.x - spk.x, dy = lst.y - spk.y, d = Math.hypot(dx, dy);
    var ux = d > 1e-6 ? dx / d : 0, uy = d > 1e-6 ? dy / d : 1;
    var cs = Math.cos(SIDE), sn = Math.sin(SIDE);
    var rx = ux * cs - uy * sn, ry = ux * sn + uy * cs;            // 말하는 이 → 듣는 이 방향을 옆으로 22°
    var arm = d + h * ARM_PLUS, face = h * FACE;
    return {
      pos: { x: spk.x + rx * arm * Math.cos(UP), y: face + arm * Math.sin(UP), z: spk.y + ry * arm * Math.cos(UP) },
      look: { x: spk.x, y: face, z: spk.y }
    };
  }

  /** 몸 방향 ang(three 규약 — 앞 = (sin ang, 0, cos ang))의 오른쪽 축. 이 축으로 + 돌리면 내린 팔 끝이 앞으로 든다 */
  function rightAxis(ang) { return [-Math.cos(ang), 0, Math.sin(ang)]; }
  /** 로드리게스 회전 — v 를 단위 축 k 둘레로 rad 만큼(순수, 진단용) */
  function rotate(v, k, rad) {
    var c = Math.cos(rad), s = Math.sin(rad), d = v[0] * k[0] + v[1] * k[1] + v[2] * k[2];
    var cx = k[1] * v[2] - k[2] * v[1], cy = k[2] * v[0] - k[0] * v[2], cz = k[0] * v[1] - k[1] * v[0];
    return [v[0] * c + cx * s + k[0] * d * (1 - c), v[1] * c + cy * s + k[1] * d * (1 - c), v[2] * c + cz * s + k[2] * d * (1 - c)];
  }
  /** 깜박임 — 씨앗(몸마다 다름)과 시각 t(초)로 지금 감았는지(0~1). 2.2~5초 간격, 0.14초 */
  function blinkAt(seed, t) {
    var per = BLINK_MIN + ((seed * 9301 + 49297) % 233280) / 233280 * (BLINK_MAX - BLINK_MIN);
    var ph = (t + seed * 0.37) % per;
    return ph < BLINK_LEN ? Math.sin(ph / BLINK_LEN * Math.PI) : 0;
  }

  /* ── three ────────────────────────────────────────────── */

  var BONES = {
    upper: ['UpperArm.R', 'UpperArmR', 'J_Bip_R_UpperArm', 'mixamorigRightArm', 'upperarm_r'],
    lower: ['LowerArm.R', 'LowerArmR', 'J_Bip_R_LowerArm', 'mixamorigRightForeArm', 'lowerarm_r'],
    head: ['Head', 'J_Bip_C_Head', 'mixamorigHead', 'head']
  };
  function rig(node) {
    var u = node.userData;
    if (u.tfRig && u.tfRig.mixer === u.mixer) { return u.tfRig; }        // GLB 가 늦게 들어와 몸이 바뀌면(믹서가 바뀜) 다시 찾는다
    var r = { upper: null, lower: null, head: null, morph: [], mixer: u.mixer }, want = {};
    Object.keys(BONES).forEach(function (k) { BONES[k].forEach(function (n) { want[n] = k; }); });
    node.traverse(function (o) {
      if (o.isBone && want[o.name] && !r[want[o.name]]) { r[want[o.name]] = o; }
      if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
        var map = {}, keys = Object.keys(o.morphTargetDictionary), i;
        for (i = 0; i < keys.length; i++) {
          var m = /Fcl_(MTH_[AIUEO]|ALL_(?:Joy|Angry|Sorrow|Surprised|Fun)|EYE_Close)$/.exec(keys[i]);
          if (m) { map[m[1]] = o.morphTargetDictionary[keys[i]]; }
        }
        if (Object.keys(map).length) { r.morph.push({ mesh: o, map: map }); }
      }
    });
    u.tfRig = r;
    return r;
  }
  function setMorph(r, name, w) {
    for (var i = 0; i < r.morph.length; i++) {
      var mi = r.morph[i].map[name];
      if (mi !== undefined) { r.morph[i].mesh.morphTargetInfluences[mi] = w; }
    }
  }
  var qa = null, qp = null, qt = null, va = null;
  /** 뼈에 세계 회전(축 k, rad)을 얹는다 — 로컬 = 부모⁻¹ · R · 부모 · 로컬 */
  function worldTurn(T, bone, k, rad) {
    if (!bone || !bone.parent || Math.abs(rad) < 1e-5) { return; }
    if (!qa) { qa = new T.Quaternion(); qp = new T.Quaternion(); qt = new T.Quaternion(); va = new T.Vector3(); }
    bone.parent.getWorldQuaternion(qp);
    qa.setFromAxisAngle(va.set(k[0], k[1], k[2]), rad);
    qt.copy(qp).invert().multiply(qa).multiply(qp);
    bone.quaternion.premultiply(qt);
    bone.updateMatrixWorld(true);
  }

  /**
   * 한 프레임 — 믹서가 뼈를 쓴 **뒤에** 부른다(`placeActor` 다음). o = {
   *   speaking(말하는 중) · vowel('A'…|null) · open(0~1 입 벌림) · emo(표정 키|null) · t(초) · dt · seed }
   * 믹서가 없는 몸(정지 모델·도형)은 손대지 않는다 — 얹은 회전이 프레임마다 쌓인다.
   */
  function pose(T, node, o) {
    if (!T || !node || !node.userData || !node.userData.mixer) { return false; }
    var u = node.userData, r = rig(node);
    var want = o.speaking ? 1 : 0;
    u.tfW = u.tfW === undefined ? 0 : u.tfW + (want - u.tfW) * Math.min(1, (o.dt || 0) / BLEND);
    var w = u.tfW;
    if (w > 0.002 && (r.upper || r.head)) {
      node.updateMatrixWorld(true);
      var k = rightAxis(node.rotation.y), sway = 1 + Math.sin((o.t || 0) * 2.1) * 0.12;
      worldTurn(T, r.upper, k, UPPER * w * sway);
      worldTurn(T, r.lower, k, LOWER * w * sway);
      worldTurn(T, r.head, [-k[0], 0, -k[2]], NOD * w * (o.open || 0));    // 왼쪽 축 + = 머리 끝이 앞으로 — 글자마다 살짝 숙인다
    }
    if (r.morph.length) {
      var open = o.speaking || o.open > 0 ? (o.open || 0) : 0, vs = ['A', 'I', 'U', 'E', 'O'], i;
      for (i = 0; i < vs.length; i++) { setMorph(r, 'MTH_' + vs[i], vs[i] === o.vowel ? open : 0); }
      var emo = EMO[o.emo] || null, es = Object.keys(EMO);
      for (i = 0; i < es.length; i++) { setMorph(r, 'ALL_' + EMO[es[i]], EMO[es[i]] === emo ? EMO_W : 0); }
      setMorph(r, 'EYE_Close', emo ? 0 : blinkAt(o.seed || 1, o.t || 0));
    }
    return true;
  }

  /**
   * 가면 — 머리 뼈 앞에 매 프레임 붙인다(몸 노드의 자식이라 몸과 함께 지워진다).
   * 몸 단위(키 1) 좌표라 크기는 몸 키를 따른다. 머리 뼈가 없으면 안 붙인다.
   */
  var vh = null;
  /* 가면 빛깔 — 흰 가면(나그네) · 검은 가면(이야기 보스, ⑲-14) · 금 간 검은 가면(⑲-16, 넷째 = 왼쪽 금) ·
     먹구름 임금(⑲-20, 다섯째 = 왕관 — 금빛 눈) = [얼굴, 눈, 줄, 금?, 왕관?] */
  var MASKS = { white: [0xf2efe6, 0x15151a, 0xc0282c], black: [0x1b1a21, 0x7a1822, 0x8a4fd0], crack: [0x1b1a21, 0x7a1822, 0x8a4fd0, 0xf4f1ea],
    storm: [0x100f18, 0xf2d24a, 0x5b46c8, 0, 0xe0b23a],
    gold: [0xe2b84a, 0x2a1d0a, 0x6fd6ff] };                 // ⑲-42 멈춘 시간의 파수꾼 — 금빛 가면·푸른 시간 줄
  function mask(T, node, kind) {
    if (!T || !node) { return false; }
    var u = node.userData, r = rig(node);
    if (!r.head) { return false; }
    var mc = MASKS[kind] || MASKS.white;
    if (!u.tfMask || u.tfMask.parent !== node) {
      var g = new T.Group();
      var white = new T.MeshBasicMaterial({ color: mc[0], side: T.DoubleSide });
      var dark = new T.MeshBasicMaterial({ color: mc[1], side: T.DoubleSide });
      var red = new T.MeshBasicMaterial({ color: mc[2], side: T.DoubleSide });
      var face = new T.Mesh(new T.CircleGeometry(0.052, 20), white);
      face.scale.set(0.9, 1.12, 1); g.add(face);
      [-1, 1].forEach(function (s) {
        var eye = new T.Mesh(new T.CircleGeometry(0.011, 10), dark);
        eye.position.set(s * 0.019, 0.012, 0.001); g.add(eye);
      });
      var stripe = new T.Mesh(new T.PlaneGeometry(0.008, 0.07), red);
      stripe.position.set(0.019, -0.012, 0.002); g.add(stripe);
      if (mc[3]) {                                  // 금 — 이마에서 왼뺨으로 꺾여 내려가는 흰 줄 둘
        var crack = new T.MeshBasicMaterial({ color: mc[3], side: T.DoubleSide });
        [[-0.014, 0.034, 0.5, 0.03], [-0.024, 0.006, -0.35, 0.034]].forEach(function (c) {
          var seg = new T.Mesh(new T.PlaneGeometry(0.004, c[3]), crack);
          seg.position.set(c[0], c[1], 0.003); seg.rotation.z = c[2]; g.add(seg);
        });
      }
      if (mc[4]) {                                  // ⑲-20 왕관 — 머리에 두른 금 테 + 뿔 다섯(코드 그림, SAGA-DESIGN §7)
        var gold = new T.MeshLambertMaterial({ color: mc[4] }), cr = new T.Group();
        var band = new T.Mesh(new T.CylinderGeometry(0.064, 0.06, 0.03, 20, 1, true), gold);
        band.material.side = T.DoubleSide; cr.add(band);
        for (var ci = 0; ci < 5; ci++) {
          var ca = ci * Math.PI * 2 / 5, spike = new T.Mesh(new T.ConeGeometry(0.012, 0.04, 6), gold);
          spike.position.set(Math.sin(ca) * 0.062, 0.034, Math.cos(ca) * 0.062); cr.add(spike);
        }
        cr.position.set(0, 0.07, -0.062);            // 가면(얼굴 앞)에서 머리 꼭대기 가운데로
        g.add(cr);
      }
      node.add(g); u.tfMask = g;
    }
    if (!vh) { vh = new T.Vector3(); }
    node.updateMatrixWorld(true);
    r.head.getWorldPosition(vh);
    node.worldToLocal(vh);
    u.tfMask.position.set(vh.x, vh.y + 0.05, vh.z + 0.062);
    return true;
  }

  global.DG = global.DG || {};
  global.DG.talkface = {
    SIDE: SIDE, UP: UP, FACE: FACE, ARM_PLUS: ARM_PLUS, UPPER: UPPER, LOWER: LOWER, MOUTH_CLOSE: MOUTH_CLOSE, EMO: EMO,
    MASKS: MASKS, vowelOf: vowelOf, talkAim: talkAim, rightAxis: rightAxis, rotate: rotate, blinkAt: blinkAt,
    pose: pose, mask: mask
  };
})(window);
