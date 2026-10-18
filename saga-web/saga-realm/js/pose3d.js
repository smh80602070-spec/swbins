/**
 * pose3d.js — 상황·전투·생활 몸짓 열 가지(W-0303 모션 묶음 1). anim-own.js 와 같은 방식(뼈 키를 코드로 굽기, 에셋 없음).
 *
 * 다섯 판 공용 복사본(sync-shared) — 고치는 곳은 shared/ 하나.
 *
 * 클립 이름 `Pose_<이름>` — asset3d.play()/stepActor()/playAction() 이 `DG.ownAnim.extraSlot()` 으로 알아보고
 * `weaponAction()`(무기 몸짓과 같은 길)으로 그 몸에 처음 한 번 굽는다. 기본 아홉 클립 굽기엔 안 든다(몸마다 늦게·캐시).
 *
 *   상황 넷   Pose_sit 앉기(반복) · Pose_warm 불 쬐기(쪼그려, 반복) · Pose_pick 줍기·채집(한 번) · Pose_lean 기대기(반복)
 *   전투 셋   Pose_heavy 강공격(두 손 크게 내려치기) · Pose_cast 시전(두 손 모았다 내뿜기) · Pose_block 막기(반복, 붙듦)
 *   생활 셋   Pose_wave 인사(손 흔들기) · Pose_fish 낚시 대기(반복) · idle 변주 셋(Pose_idle_look 둘러보기 · Pose_idle_scratch 머리 긁기 · Pose_idle_shift 체중 옮기기)
 *
 * 자연스러움 규칙(W-0303): 한 번 도는 클립은 들어가기·나오기 ≥ 0.3초(BASE 에서 시작해 BASE 로 끝) · 반복 클립은 숨쉬기·흔들림이 한 바퀴에 이어진다 ·
 * 전환 블렌드 `BLEND` 0.25초(play 가 blendOf 로 읽음) · idle 변주는 `idleVariant()` 가 3~5초마다 하나 · 시선 `look()` 은 목 ±60°·0.5초 따라감.
 *
 * 2D 대역(`frame2d`): 앉기·줍기 프레임(K 시트)이 없을 때 mode2d 가 몸을 기울이고 눌러서 흉내 낸다 — K 가 동작별 시트를 주면 그 프레임으로 갈아 끼운다.
 */
(function (global) {
  'use strict';
  var OA = global.DG && global.DG.ownAnim, L = OA && OA.lib;
  if (!L) { return; }
  var M = L.M, S = L.S, legs = L.legs, keyed = L.keyed, BASE = L.BASE, D2R = Math.PI / 180;
  function sw(t01, k) { return Math.sin(t01 * 2 * Math.PI + (k || 0)); }   // 반복 클립 한 바퀴에 이어지는 흔들림

  /* ── 상황 넷 ─────────────────────────────────────────── */
  /** 앉기 — 땅에 무릎 세워 앉기(판에 의자가 없다). 발목을 엉덩이 앞 0.36m·같은 높이에 두는 두 뼈 IK 로 다리 각을 풀고 발바닥은 평평(ft = a − k),
   *  접지 풀이가 발을 땅에 대면 엉덩이도 땅 가까이 온다. 두 손은 무릎 위, 몸은 조금 뒤로 */
  var SIT_L = L.legIK(0.36, -0.02), SIT_R = L.legIK(0.34, -0.02);
  var SIT = M(BASE, legs(SIT_L.a, SIT_L.k, SIT_L.a - SIT_L.k, SIT_R.a, SIT_R.k, SIT_R.a - SIT_R.k), S('ul', 8), S('ua', -64, -44), S('la', null, null, -36), S('hand', null, 6),
    { 'spine.p': -8, 'chest.p': 4, 'neck.p': 4, 'head.p': 4 });
  function sitPose(t) { return M(SIT, { 'chest.p': 2 + 1.2 * sw(t), 'head.p': 3 + 0.6 * sw(t, 0.8), 'hips.r': 0.6 * sw(t, 1.3) }); }

  /** 불 쬐기 — 쪼그려 앉아 두 손바닥을 앞(불)으로 */
  var WARM = M(BASE, legs(100, 128, -28, 100, 128, -28), S('ua', -58, -58), S('la', null, null, -36), S('hand', null, -25),
    { 'spine.p': 22, 'chest.p': 6, 'head.p': 6 });
  function warmPose(t) { return M(WARM, { 'chest.p': 6 + 1.0 * sw(t), 'hips.r': 1.5 * sw(t, 1.1), 'lua.p': -58 + 2 * sw(t, 0.4), 'rua.p': -58 + 2 * sw(t, 2.1) }); }

  /** 줍기·채집 — 허리를 굽혀 오른손을 땅에, 집어 가슴께로 올리며 선다 */
  var pickPose = (function () {
    var bend = M(BASE, legs(48, 84, -36, 42, 78, -36), {
      'spine.p': 48, 'chest.p': 18, 'neck.p': 6, 'head.p': -8,
      'rua.r': 70, 'rua.p': -76, 'rla.y': 6, 'rhand.p': 10, 'lua.r': -70, 'lua.p': -24, 'lla.y': -30
    });
    var grab = M(bend, { 'rhand.p': -18, 'fr.r': 14, 'tr.r': 6 });
    var rise = M(BASE, legs(8, 16, -8, 6, 14, -8), {
      'spine.p': 6, 'chest.p': 2, 'rua.r': 60, 'rua.p': -40, 'rla.y': 100, 'rhand.p': -10, 'fr.r': 14, 'tr.r': 6
    });
    return keyed([[0, BASE], [0.3, bend], [0.5, grab], [0.76, rise, 'out'], [1, BASE]]);
  })();

  /** 기대기 — 오른 다리에 체중, 왼 다리 꼬아 앞, 팔짱, 몸을 왼쪽(벽)으로 조금 */
  var LEAN = M(BASE, legs(6, 14, -26, 0, 2, -2), {
    'lul.r': -14, 'hips.dx': 0.05, 'hips.r': -4, 'spine.r': 5, 'chest.r': -2, 'head.r': -3,
    'lua.r': -62, 'lua.p': -14, 'lla.y': -100, 'rua.r': 62, 'rua.p': -18, 'rla.y': 100, 'lhand.p': 10, 'rhand.p': 10
  });
  function leanPose(t) { return M(LEAN, { 'chest.p': 1.2 * sw(t), 'head.y': 2 * sw(t, 0.7), 'hips.r': -4 + 0.5 * sw(t, 1.9) }); }

  /* ── 전투 셋 ─────────────────────────────────────────── */
  var DEEP_L = legs(42, 64, 8, -18, 36, 22);
  /** 강공격 — 두 손을 머리 위로 높이 들어 몸을 젖혔다가 크게 내딛어 내려찍는다 */
  var heavyPose = (function () {
    var wind = M(BASE, legs(-6, 18, -24, 14, 26, -12), S('ua', 118, -14, 0), S('la', null, null, -42), S('hand', null, -10),
      { 'spine.p': -10, 'chest.p': -8, 'head.p': -12, 'hips.dy': 0.02 });
    var strike = M(BASE, DEEP_L, S('ua', -30, -84, -30), S('la', null, null, -10),
      { 'spine.p': 28, 'chest.p': 14, 'head.p': -10, 'hips.dz': -0.12, 'hips.dy': -0.06 });
    var hold = M(strike, S('ua', -34, -80, -30), { 'spine.p': 29 });
    return keyed([[0, BASE], [0.3, wind], [0.5, strike, 'in'], [0.68, hold], [1, BASE]]);
  })();

  /** 시전 — 두 손을 가슴 앞에 모아 기운을 모았다가 앞으로 내뿜는다(2나락 무예·5천하 계략·1만리 원소) */
  var castPose = (function () {
    var gather = M(BASE, legs(6, 14, -8, 6, 14, -8), S('ua', -56, -30, -8), S('la', null, null, -96), S('hand', null, -16),
      { 'spine.p': 4, 'head.p': 6 });
    var charge = M(BASE, legs(10, 24, -14, 10, 24, -14), S('ua', -48, -38, -14), S('la', null, null, -104), S('hand', null, -20),
      { 'spine.p': -2, 'chest.p': -4, 'head.p': -3, 'hips.dy': -0.03 });
    var release = M(BASE, legs(22, 36, -14, -8, 24, -32), S('ua', -8, -86, -18), S('la', null, null, -10), S('hand', null, -52),
      { 'spine.p': 14, 'chest.p': 6, 'head.p': -2, 'hips.dz': -0.05 });
    return keyed([[0, BASE], [0.26, gather], [0.5, charge], [0.66, release, 'in'], [0.74, release], [1, BASE]]);
  })();

  /** 막기 — 왼 팔뚝을 얼굴 앞에 세우고 몸을 낮춰 붙든다(반복) */
  var BLOCK = M(BASE, legs(14, 30, -16, -8, 26, -34), {
    'lua.r': -42, 'lua.p': -48, 'lla.y': -118, 'lhand.p': -16, 'rua.r': 62, 'rua.p': 22, 'rla.y': 78,
    'spine.p': 10, 'chest.p': 4, 'head.p': -4, 'hips.dy': -0.04
  });
  function blockPose(t) { return M(BLOCK, { 'chest.p': 4 + 1.0 * sw(t), 'lua.p': -48 + 1.5 * sw(t, 0.6) }); }

  /* ── 생활 셋 ─────────────────────────────────────────── */
  /** 인사 — 오른손을 들어 두 번 흔든다 */
  var wavePose = (function () {
    /* 팔꿈치는 어깨 높이 옆, 아래팔은 위로 세운다(FK 로 찾은 각 — 손이 어깨 위 0.35m). 흔들기 = 아래팔을 좌우(r)로 */
    var up = M(BASE, { 'rua.r': -35, 'rua.y': 30, 'rla.r': -60, 'rla.y': 0, 'rhand.p': 0, 'chest.r': -2, 'head.y': -6, 'head.p': 3 });
    var w1 = M(up, { 'rla.r': -40 }), w2 = M(up, { 'rla.r': -78 }), w3 = M(up, { 'rla.r': -58 });
    return keyed([[0, BASE], [0.22, up], [0.36, w1], [0.5, w2], [0.64, w1], [0.76, w3], [1, BASE]]);
  })();

  /** 낚시 대기 — 두 손으로 낚싯대를 오른쪽 앞에 들고 물을 본다(반복, 낚싯대 끝이 조금씩 까딱) */
  var FISH = M(BASE, legs(2, 6, -4, 2, 6, -4), S('ul', 4), {
    'rua.r': 58, 'rua.p': -38, 'rla.y': 72, 'rhand.p': -6, 'lua.r': -56, 'lua.p': -46, 'lla.y': -78,
    'spine.p': 6, 'head.p': 10
  });
  function fishPose(t) { return M(FISH, { 'chest.p': 1.2 * sw(t), 'rla.y': 72 + 2.5 * sw(t, 0.9), 'hips.dx': 0.004 * sw(t, 1.3), 'head.y': 3 * sw(t, 2.2) }); }

  /** idle 변주 — 둘러보기 · 머리 긁기 · 체중 옮기기(한 번 돌고 BASE 로) */
  var lookPose = (function () {
    var l = M(BASE, { 'head.y': 34, 'neck.y': 6, 'chest.y': 8 }), r = M(BASE, { 'head.y': -28, 'neck.y': -5, 'chest.y': -6 });
    return keyed([[0, BASE], [0.25, l], [0.45, l], [0.62, r], [0.78, r], [1, BASE]]);
  })();
  var scratchPose = (function () {
    /* 팔꿈치를 옆으로 들고 손이 머리 오른쪽 위에(FK 로 찾은 각) — 긁기 = 손목·아래팔을 조금씩 */
    var up = M(BASE, { 'rua.r': -45, 'rua.y': 10, 'rla.r': -70, 'rla.y': 160, 'rhand.p': -10, 'head.p': 4, 'head.r': -6 });
    return keyed([[0, BASE], [0.25, up], [0.4, M(up, { 'rla.y': 150, 'rhand.p': -24 })], [0.55, M(up, { 'rla.y': 162 })], [0.7, M(up, { 'rla.y': 152, 'rhand.p': -24 })], [1, BASE]]);
  })();
  var shiftPose = (function () {
    var s = M(BASE, legs(6, 16, -10, 0, 2, -2), { 'hips.dx': -0.045, 'hips.r': -4, 'spine.r': 3, 'chest.r': 2, 'head.r': -1 });
    return keyed([[0, BASE], [0.25, s], [0.75, s], [1, BASE]]);
  })();

  /** 클립 표 — dur 초 · loop 반복(붙드는 자세) · 나머지는 anim-own register 기본(fps 30 · ground) */
  var DEFS = [
    { name: 'Pose_sit', dur: 4.0, loop: true, fn: sitPose, kind: 'situ' },
    { name: 'Pose_warm', dur: 4.0, loop: true, fn: warmPose, kind: 'situ' },
    { name: 'Pose_pick', dur: 1.3, loop: false, fn: pickPose, kind: 'situ' },
    { name: 'Pose_lean', dur: 4.0, loop: true, fn: leanPose, kind: 'situ' },
    { name: 'Pose_heavy', dur: 1.1, loop: false, fn: heavyPose, kind: 'combat', fps: 60 },
    { name: 'Pose_cast', dur: 1.2, loop: false, fn: castPose, kind: 'combat', fps: 60 },
    { name: 'Pose_block', dur: 1.5, loop: true, fn: blockPose, kind: 'combat' },
    { name: 'Pose_wave', dur: 1.6, loop: false, fn: wavePose, kind: 'life' },
    { name: 'Pose_fish', dur: 3.0, loop: true, fn: fishPose, kind: 'life' },
    { name: 'Pose_idle_look', dur: 2.6, loop: false, fn: lookPose, kind: 'idle' },
    { name: 'Pose_idle_scratch', dur: 2.4, loop: false, fn: scratchPose, kind: 'idle' },
    { name: 'Pose_idle_shift', dur: 3.0, loop: false, fn: shiftPose, kind: 'idle' }
  ];
  OA.register(DEFS);
  var IDLE = ['Pose_idle_look', 'Pose_idle_shift', 'Pose_idle_scratch'];

  /** 2D 대역 — 동작별 프레임(K 시트)이 없을 때 mode2d 가 쓰는 기울이기·누르기. rot 라디안(앞으로 +) · sx/sy 발 밑 기준 배율 */
  var FRAME2D = {
    Pose_sit: { sy: 0.58, sx: 1.1 }, Pose_warm: { sy: 0.76, sx: 1.08, rot: 0.08 }, Pose_pick: { rot: 0.34, sy: 0.9 }, Pose_lean: { rot: -0.14 },
    Pose_heavy: { rot: 0.24, sx: 1.08 }, Pose_cast: { sy: 1.03, rot: 0.05 }, Pose_block: { rot: -0.08, sy: 0.96 },
    Pose_wave: { rot: -0.05 }, Pose_fish: { rot: 0.12 }, Pose_idle_look: { rot: 0.02 }, Pose_idle_scratch: { rot: -0.03 }, Pose_idle_shift: { rot: 0.04 }
  };

  /* W-0316 몸짓 판정 — 자세마다 "손·엉덩이가 몸 어디 있어야 하나". 값은 선 몸의 머리 높이를 1 로 둔 비율(위 up 은 땅부터, 앞 fwd·옆 side 는 엉덩이부터,
     side 는 몸 왼쪽이 +). at = 판정·촬영 시점(클립 길이 비). 기준 뼈대(진단)와 실제 VRoid 몸(pose-shot 촬영) 둘 다 같은 check 를 탄다 — 빈틈 ⑥:
     예전 진단은 손 "높이" 만 봐서 인사 팔이 앞으로 뻗어도 통과했다. 기준 뼈대 측정값(10-18)에 여유를 두고 잡았다 */
  var EXPECT = {
    Pose_sit: { at: 0.5, t: [['엉덩이 낮음(<0.35)', function (r) { return r.hips.up < 0.35; }]] },
    Pose_warm: { at: 0.5, t: [['쪼그림(엉덩이<0.45)', function (r) { return r.hips.up < 0.45; }], ['두 손 앞(>0.18)', function (r) { return r.rhand.fwd > 0.18 && r.lhand.fwd > 0.18; }]] },
    Pose_pick: { at: 0.45, t: [['오른손 낮음(<0.5)', function (r) { return r.rhand.up < 0.5; }], ['오른손 앞(>0.12)', function (r) { return r.rhand.fwd > 0.12; }]] },
    Pose_lean: { at: 0.5, t: [['두 손 앞(>0.08)', function (r) { return r.rhand.fwd > 0.08 && r.lhand.fwd > 0.08; }]] },
    Pose_heavy: { at: 0.5, t: [['두 손 앞으로 내려침(>0.2)', function (r) { return r.rhand.fwd > 0.2 && r.lhand.fwd > 0.2; }]] },
    Pose_cast: { at: 0.62, t: [['두 손 앞(>0.15)', function (r) { return r.rhand.fwd > 0.15 && r.lhand.fwd > 0.15; }], ['가슴 높이 이상(>0.75)', function (r) { return r.rhand.up > 0.75 && r.lhand.up > 0.75; }]] },
    Pose_block: { at: 0.5, t: [['왼 팔뚝 앞·위(앞>0.1·위>0.8)', function (r) { return r.lhand.fwd > 0.1 && r.lhand.up > 0.8; }]] },
    Pose_wave: { at: 0.4, t: [['오른손 머리 위', function (r) { return r.rhand.up > r.head.up; }], ['앞으로 안 뻗음(|앞|<0.15)', function (r) { return Math.abs(r.rhand.fwd) < 0.15; }], ['몸 옆(오른쪽 <-0.1)', function (r) { return r.rhand.side < -0.1; }]] },
    Pose_fish: { at: 0.5, t: [['두 손 앞(>0.15)', function (r) { return r.rhand.fwd > 0.15 && r.lhand.fwd > 0.15; }]] },
    Pose_idle_scratch: { at: 0.45, t: [['오른손 머리에 닿음(<0.2)', function (r) { return r.dRH < 0.2; }], ['앞으로 안 뻗음(|앞|<0.12)', function (r) { return Math.abs(r.rhand.fwd) < 0.12; }]] },
    Pose_idle_look: { at: 0.5, t: [['손 내림(<0.75)', function (r) { return r.rhand.up < 0.75 && r.lhand.up < 0.75; }]] },
    Pose_idle_shift: { at: 0.5, t: [['손 내림(<0.75)', function (r) { return r.rhand.up < 0.75 && r.lhand.up < 0.75; }]] }
  };
  var MEASURE_BONES = ['hips', 'head', 'rhand', 'lhand'];
  function defOf(name) { var i; for (i = 0; i < DEFS.length; i++) { if (DEFS[i].name === name) { return DEFS[i]; } } return null; }
  function tn(k, d) { var C = global.DG.core, v = C && C.tuned ? +C.tuned(k, d) : d; return isFinite(v) ? v : d; }

  global.DG.pose3d = {
    NAMES: DEFS.map(function (d) { return d.name; }), DEFS: DEFS, IDLE: IDLE, BLEND: 0.25, FRAME2D: FRAME2D,
    durOf: function (name) { var d = defOf(name); return d ? d.dur : 0; },
    EXPECT: EXPECT,
    /** W-0316 — r = { hips, head, rhand, lhand: {up, fwd, side}, dRH } (선 머리 높이 1 비율) → { ok, bad: [못 맞춘 칸], at } · 기대 없는 이름은 null */
    check: function (name, r) { var e = EXPECT[name], bad = [], i; if (!e || !r) { return null; } for (i = 0; i < e.t.length; i++) { var ok = false; try { ok = !!e.t[i][1](r); } catch (x) { ok = false; } if (!ok) { bad.push(e.t[i][0]); } } return { ok: !bad.length, bad: bad, at: e.at }; },
    /** 실제 몸(three 마디) — 선 자세에서 한 번: 머리 높이 H·앞 방향 부호(발가락이 발목 앞인 쪽) */
    restOf: function (node) { var T = global.THREE, B = OA.BONES, v = {}; if (!T || !node) { return null; } node.updateMatrixWorld(true); ['head', 'lfoot', 'ltoe'].forEach(function (k) { var b = node.getObjectByName(B[k]); v[k] = b ? node.worldToLocal(b.getWorldPosition(new T.Vector3())) : null; }); if (!v.head || !v.lfoot || !v.ltoe) { return null; } return { H: v.head.y, fs: v.ltoe.z >= v.lfoot.z ? 1 : -1 }; },
    /** 지금 자세를 재 r 을 낸다(check 에 넣을 꼴). rest = restOf(node) */
    measure: function (node, rest) { var T = global.THREE, B = OA.BONES, p = {}, out = {}, k; if (!T || !node || !rest || !(rest.H > 0)) { return null; } node.updateMatrixWorld(true); for (k = 0; k < MEASURE_BONES.length; k++) { var b = node.getObjectByName(B[MEASURE_BONES[k]]); if (!b) { return null; } p[MEASURE_BONES[k]] = node.worldToLocal(b.getWorldPosition(new T.Vector3())); } for (k in p) { out[k] = { up: +(p[k].y / rest.H).toFixed(3), fwd: +((p[k].z - p.hips.z) * rest.fs / rest.H).toFixed(3), side: +((p[k].x - p.hips.x) * rest.fs / rest.H).toFixed(3) }; } out.dRH = +(p.rhand.distanceTo(p.head) / rest.H).toFixed(3); return out; },
    isLoop: function (name) { var d = defOf(name); return !!(d && d.loop); },
    /** 2D 대역 틀 — 모르는 이름이면 null */
    frame2d: function (name) { var f = FRAME2D[name]; return f ? { rot: f.rot || 0, sx: f.sx || 1, sy: f.sy || 1 } : null; },
    /** 한 번 도는 클립의 들어가기·나오기 초 — keyed 첫·끝 키 간격(진단용) */
    inOut: function (name) {
      var d = defOf(name), ks = d && d.fn && d.fn.keys;
      if (!ks || ks.length < 3) { return null; }
      return [ks[1][0] * d.dur, (1 - ks[ks.length - 2][0]) * d.dur];
    },
    /** `on` 이 false→true 되는 순간부터 그 클립 길이만큼 이름을 준다(대화 시작에 인사 한 번 따위). st 는 배우마다 둘 객체, nowS 초 */
    once: function (st, key, on, nowS, name) {
      var o = st._once || (st._once = {});
      if (!on) { delete o[key]; return null; }
      if (o[key] === undefined) { o[key] = nowS; }
      return nowS - o[key] < this.durOf(name) ? name : null;
    },
    /** 서 있는 동안 3~5초(pose3d.idleEvery ±1)마다 변주 하나를 돌리고 끝나면 null(쉬기). idle 이 아니면(걷기·전투) 되돌린다. gap 을 주면 그 초로(진단) */
    idleVariant: function (st, nowS, idle, gap) {
      var v = st._pv || (st._pv = { next: 0, cur: null, until: 0, i: 0 });
      if (idle === false) { v.next = 0; v.cur = null; return null; }
      var every = gap || (tn('pose3d.idleEvery', 4) + (Math.random() * 2 - 1));
      if (!v.next) { v.next = nowS + every; return null; }
      if (v.cur) { if (nowS < v.until) { return v.cur; } v.cur = null; v.next = nowS + every; return null; }
      if (nowS >= v.next) { v.cur = IDLE[v.i++ % IDLE.length]; v.until = nowS + this.durOf(v.cur); return v.cur; }
      return null;
    },
    /** 쉬는 몸 한 줄 — 서 있으면 idle 변주, pose3d.sitAfter(8)초 넘게 가만히 있으면 rest(기본 Pose_sit, 모닥불 곁이면 Pose_warm)로 앉아 쉰다.
     *  still=false(걷기)거나 0.5초 넘게 안 불렸으면(공격·대화 따위가 끼었으면) 처음부터 다시 센다. 쉴 몸짓이 없으면 null(부르는 쪽이 idle) */
    life: function (st, nowS, still, rest) {
      var l = st._lf || (st._lf = { since: nowS, last: nowS, dt: 0 }), gap = nowS - l.last;
      /* 끊김 = 평소 호출 간격(프레임)의 3배 넘게 안 불림(최소 0.5초) — 느린 기기(초당 2~5프레임)에서 매 프레임 끊김으로 보면 영영 못 앉는다 */
      if (!still || gap > Math.max(0.5, 3 * l.dt)) { l.since = nowS; }
      if (gap > 0 && gap < 2) { l.dt = l.dt ? l.dt + (gap - l.dt) * 0.2 : gap; }
      l.last = nowS;
      if (!still) { this.idleVariant(st, nowS, false); return null; }
      if (nowS - l.since >= tn('pose3d.sitAfter', 8)) { this.idleVariant(st, nowS, false); return rest || 'Pose_sit'; }
      return this.idleVariant(st, nowS, true);
    },
    /** 시선 — 믹서가 머리를 쓴 뒤(step 안 mixer.update 다음) 부른다. u.look = { x, y?, z } 월드 목표(y 없으면 눈높이).
     *  머리 뼈의 지금 얼굴 방향(-Z)에서 목표 방향으로 돌리되 ±60°(pose3d.lookMax) 안, 0.5초에 90% 따라간다. 목표가 없으면 되돌아온다 */
    look: function (node, u, dt) {
      var T = global.THREE, tg = u.look, st = u._lk || (u._lk = { q: null, f: 0 });
      if (!T) { return false; }
      var head = u._lkHead !== undefined ? u._lkHead : (u._lkHead = node.getObjectByName(OA.BONES.head) || null);
      if (!head) { return false; }
      if (!st.q) { st.q = new T.Quaternion(); }
      var k = 1 - Math.exp(-(dt || 0) / 0.17);
      if (!tg) {
        if (st.f <= 0.001) { return false; }
        st.f = Math.max(0, st.f - k * 1.5); st.q.slerp(new T.Quaternion(), k * 1.5);
      } else {
        var hw = head.getWorldQuaternion(new T.Quaternion()), hp = head.getWorldPosition(new T.Vector3());
        var face = new T.Vector3(0, 0, -1).applyQuaternion(hw).normalize();
        var d = new T.Vector3(tg.x - hp.x, (tg.y === undefined ? hp.y : tg.y) - hp.y, tg.z - hp.z);
        if (d.lengthSq() < 1e-6) { return false; }
        d.normalize();
        var ang = Math.acos(Math.max(-1, Math.min(1, face.dot(d)))), lim = tn('pose3d.lookMax', 60) * D2R;
        var want = new T.Quaternion().setFromUnitVectors(face, d);
        if (ang > lim) { want.slerp(new T.Quaternion(), 1 - lim / ang); }
        /* 월드 회전 → 머리 로컬: q_local = inv(hw) · want · hw */
        var inv = hw.clone().invert(), ql = inv.multiply(want).multiply(hw);
        st.q.slerp(ql, k); st.f = 1;
      }
      head.quaternion.multiply(st.q);
      return true;
    }
  };
})(window);
