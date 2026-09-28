/**
 * 전황 — 3D 전장 (README "Phase 7 전투")
 * ---------------------------------------------------------------
 * `war.js`의 `fight()`는 이미 다 계산해 둔다(병력 손실·성벽 파손·일기토 승패).
 * 이 파일은 그 결과를 작은 전장 디오라마로 다시 그릴 뿐이다 —
 * **판정은 한 줄도 없다.** `war.js`에 더한 것도 `atkStart`·`defStart`·`defForce`
 * 와 (2026-09-03) `frames`·`duel.hits` 뿐이다 — 전부 **이미 끝난 결과를
 * 되짚어 남긴 기록**이지 새 판정이 아니다(합마다 병력·성벽이 얼마였는지,
 * 일기토가 몇 합에 누가 맞았는지). 싸움 자체(무작위·승패)는 war.js 그대로다.
 *
 * **2026-09-03 — "실시간 전투" 요청**: 예전엔 이 리포트를 한 번에 최종
 * 상태로만 그렸다(병력도 성벽도 처음부터 다 깎인 채로 등장). 사용자가
 * "지금 결과를 실시간처럼 재생"을 골라, 같은 최종 결과를 **합 단위로
 * 시간차를 두고 재생**하도록만 바꿨다 — 일기토 합마다 깃발이 흔들리고,
 * 라운드마다 무리가 줄고 성벽이 깎이는 게 보인다. `playback()` 이 그
 * 순서를 맡고, `render()`(밖에서 부르는 자리)는 안 바뀌었다.
 *
 * 병력은 숫자를 그대로 세우지 않는다(장수는 30명 안팎 세우면 도리어 어수선하다) —
 * **깃발 다발**로 무리 크기만 어림잡아 세운다. 일기토는 이긴 쪽 금빛 깃발과
 * 진 쪽이 쓰러진 회색 깃발로만 표시한다(누구 편인지는 안 가린다 — 굳이
 * 편 색을 다시 가르는 것보다 승패 그 자체가 더 눈에 든다).
 */
(function (global) {
  'use strict';

  var A3 = null;
  function asset3d() { if (!A3) { A3 = global.DG.asset3d; } return A3; }
  var FD = null;
  function forceData() { if (!FD) { FD = global.DG.forceData; } return FD; }
  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  function R() { return global.DG.rtk; }
  function off() { return global.DG.off; }
  var CO = null;
  function core() { if (!CO) { CO = global.DG.core; } return CO; }
  /** 성벽 붕괴 카메라 흔들림 켬/끔(⚙️ 설정 시트, 2026-09-10) — 흔들림에
   *  민감한 사람을 위해서다. 부드럽게 줄었다 늘었다 하는 것(라운드 충격의
   *  거리-당김, 일기토 근접 컷)은 안 가린다 — 진짜 화면이 떨리는 지터
   *  (`wallShake`)만 이 손잡이로 끈다 */
  function SHAKE_ON() { return core() ? (core().tuned('battle3d.shake', 1) ? true : false) : true; }
  /** 무리 병사 몸(2026-09-25) — 1 이면 깃발 다발 대신 CC0 기사·기병(`asset3d.buildTrooper`), 0 이면 옛 깃발 다발 */
  function TROOP_MODEL() { return core() ? (core().tuned('battle3d.troopModel', 1) ? true : false) : true; }

  var TIER_H = { t1: 6, t2: 8, t3: 11 };
  function tierOf(maxWall) {
    var w = maxWall || 0;
    if (w >= 5600) { return 't3'; }
    if (w >= 4600) { return 't2'; }
    return 't1';
  }

  function forceColor(id) {
    var f = forceData().force(id);
    return f ? f.color : '#5b6572';
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ring(n, r, startAng) {
    var pts = [], i;
    for (i = 0; i < n; i++) {
      var a = startAng + (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  var canvas = null, renderer = null, scene = null, camera = null, dyn = null;
  /** liveDyn — 합마다 다시 그리는 것만 담는다(성벽·무리·일기토 깃발).
   *  땅·성 소품(dyn 의 나머지)은 재생 내내 한 번만 짓는다 */
  var liveDyn = null, curGroup = null;
  var ready = false, failed = false, loopRunning = false;
  var rebuildSeq = 0, spin = 0;
  /* 일기토 실제 캐릭터(2026-09-10) — 예전엔 금색/회색 깃발 둘로만 승패를
     표시했다. `duelActors = {a,d}` 는 war.js `duel()`이 붙여 준 `rep.duel.a`
     (공격 쪽 장수)·`rep.duel.d`(수비 쪽 장수)를 실제 QRPG 모델로 세운 것 —
     `dyn`에 한 번만 얹혀 전투 재생 내내 산다(성벽·무리처럼 합마다 새로
     안 짓는다). `duelWant = {a,d}`는 tick()이 매 프레임 읽어 미는 애니메이션
     슬롯이고, `renderLive()`가 그 값만 갈아 끼운다 — 판정은 없다, war.js가
     이미 낸 `hits[].who`를 그대로 옮길 뿐이다 */
  var duelActors = null, duelWant = { a: 'idle', d: 'idle' };
  /* duelGen — 합이 새로 왔다는 표(2026-09-11). `renderLive()`가 새 합을
     그릴 때마다(duelHit·done) 하나씩 올린다. tick()이 이 값이 지난
     프레임과 달라졌을 때만 `asset3d.step()`에 force 를 실어 보낸다 —
     같은 슬롯(예: 두 합 연속으로 맞아 'hit'·'hit')이라도 매 합 처음부터
     다시 재생되게 하기 위해서다(안 그러면 asset3d.js `play()`가 "이미 그
     슬롯이다"로 보고 두 번째 합을 그냥 건너뛴다 — 첫 합의 정지 자세
     그대로 멈춰 있는 것처럼 보인다) */
  var duelGen = 0, tickDuelGen = -1;
  /* 맞았을 때 붉게 번쩍(2026-09-10, 사가블로 asset3d.js 의 ownAllMat·flashAllMat
     과 같은 요령) — 'hit' 를 재생하기 시작한 그 프레임에 1로 켜고 tick()마다
     0.82배씩 죽인다. 재질을 복제해 두는 건(setupDuel() 이 짓는 순간, `place()`)
     성끼리 서로 다른 세력색을 입은 재질을 공유해 버리면 한쪽이 번쩍일 때
     둘 다 번쩍이는 사고를 막기 위해서다 */
  var flashA = 0, flashD = 0;
  /* 일기토 카메라(2026-09-10) — 합을 주고받는 동안만 두 장수 가까이 붙는다
     (`duelCamActive`, playback()이 켜고 끈다). `camBlend`는 그 켬/끔을 매
     프레임 살살 뒤쫓아 넓은 그림 ↔ 근접 샷을 부드럽게 오간다(딱 끊기지
     않게). 개입형 실시간 전투(`beginLive`)는 이 값을 안 건드린다 — 아직
     라운드 결과가 안 정해진 채로 정지한 두 장수를 당겨 봐야 볼 게 없다 */
  var duelCamActive = false, camBlend = 0;
  /* 라운드 충격(2026-09-10) — 무리(atk/def 깃발 다발) 자체를 실제 장수로 안
     바꾸기로 한 원래 판단(장수 30명을 세우면 오히려 어수선하다)은 그대로
     두고(2026-09-25 부터 무리는 이름 없는 병사 몸 — 아래 `troopPool`), 대신 **부딪히는 순간**을 카메라·무리 밀림·소리 셋으로 더 또렷하게
     낸다. `roundPulse`는 라운드가 넘어갈 때마다 1로 켜졌다가 tick()마다
     0.85배씩 죽는다 — atk/defGroupRef(위 cluster()가 돌려준 그 그룹)를
     서로에게로 살짝 밀었다 당기고, 넓은 카메라도 살짝 훅 당긴다 */
  var atkGroupRef = null, defGroupRef = null, roundPulse = 0;
  var troopGen = 0, tickTroopGen = 0;    // 무리 병사 — 새 합마다 치기를 처음부터 다시 튼다(duelGen 과 같은 요령)
  var troopHitAt = -99, TROOP_HIT_S = 0.7;
  /* 성벽 붕괴 흔들림(2026-09-10) — lastWallN 은 "직전 프레임에 성벽이 몇
     칸이었나"만 기억하는 값(판정 아님, renderLive() 가 매 프레임 잰다).
     wallShake 는 roundPulse 와 같은 감쇠 방식이지만 더 크게 흔든다(성벽이
     무너지는 게 매 합 부딪히는 것보다 드물고 큰 사건이라서) */
  var lastWallN = null, wallShake = 0;
  var timers = [];   // playback() 이 건 setTimeout id들 — 새 전황이 오면 다 지운다
  /* 성벽 파편·불탄 자리(2026-09-23, PLAN §6 "전투 디오라마" 남은 항목) — `fx`는
     `dyn`과 별개 그룹이다. `dyn`은 합마다(`liveDyn`) 또는 새 전황마다(`buildBase`)
     통째로 비워지는데, 파편은 튀는 도중(수백 ms) 그 사이에 지워지면 뚝 끊겨
     보인다 — 그래서 tick()이 직접 수명을 관리하는 별도 그룹에 둔다. 불탄 자리는
     반대로 **오래 남아야** 자연스러워(성벽이 그 합 이후로도 계속 깨져 있으니)
     `buildBase()`가 새 전황을 지을 때만 지운다. `debris` 배열 항목은
     {mesh, vx,vy,vz, life, matOwn} — matOwn 재질은 파편마다 새로 만든다(드문
     사건이라 GPU 걱정 없음, `banner()`처럼 흔한 자리와는 다르다). */
  var fx = null, debris = [];

  function available() { return !!three() && !failed; }

  function active() {
    return !!(ready && document.getElementById('battle3d') === canvas &&
      canvas && canvas.isConnected);
  }

  /** 캔버스가 매번 새로 태어나므로(innerHTML 교체) 옛 렌더러를 명시적으로 버리고 다시 묻는다 */
  function ensureInit() {
    var t = three();
    var el = document.getElementById('battle3d');
    if (!t || !el) { failed = true; return false; }
    if (el === canvas && ready) { return true; }
    if (renderer) {
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* noop */ }
    }
    canvas = el; renderer = null; ready = false;
    try {
      renderer = new t.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (e) { failed = true; return false; }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    if (global.DG.toon3d && global.DG.toon3d.toneRenderer) { global.DG.toon3d.toneRenderer(renderer); }   // Neutral 톤매핑(2026-09-23)

    scene = new t.Scene();
    camera = new t.PerspectiveCamera(44, 1, 0.5, 300);
    var TNg = global.DG.toon3d, LG = TNg && TNg.lightGain ? TNg.lightGain() : 1;   // 톤매핑을 켜면 빛을 올린다(toon3d.toneRenderer)
    scene.add(new t.HemisphereLight(0xffffff, 0x4a5a3a, 1.0 * LG));
    var sun = new t.DirectionalLight(0xfff4e0, 1.05 * LG);
    sun.position.set(-12, 20, 9);
    scene.add(sun);
    dyn = new t.Group();
    scene.add(dyn);
    liveDyn = new t.Group();
    dyn.add(liveDyn);
    fx = new t.Group();
    scene.add(fx);
    debris = [];
    curGroup = dyn;

    ready = true;
    resize();
    return true;
  }

  function resize() {
    if (!renderer || !camera || !canvas) { return; }
    var w = canvas.clientWidth || 320, h = canvas.clientHeight || 190;
    if (!w || !h) { return; }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  var blobGeo = null, blobMat = null;
  function addShadow(x, z, r) {
    var t = three();
    if (!t || !curGroup) { return; }
    if (!blobGeo) {
      blobGeo = new t.CircleGeometry(1, 16);
      blobMat = new t.MeshBasicMaterial({ color: 0x14140c, transparent: true, opacity: 0.28, depthWrite: false });
    }
    var m = new t.Mesh(blobGeo, blobMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, z);
    m.scale.setScalar(Math.max(0.35, r));
    curGroup.add(m);
  }

  var scorchGeo = null, scorchMat = null;
  /** 불탄 자리 — 성벽 한 칸이 무너진 그 자리 바닥에 남는 어두운 자국(영구,
   *  `buildBase()`가 새 전황을 지을 때만 지운다). 재질·지오는 `addShadow`와
   *  같은 요령으로 하나만 만들어 재사용한다(색·모양이 항상 같아서 캐시해도 된다) */
  function spawnScorch(x, z) {
    var t = three();
    if (!t || !fx) { return; }
    if (!scorchGeo) {
      scorchGeo = new t.CircleGeometry(1, 12);
      scorchMat = new t.MeshBasicMaterial({ color: 0x211c14, transparent: true, opacity: 0.4, depthWrite: false });
    }
    var m = new t.Mesh(scorchGeo, scorchMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.017, z);
    m.scale.setScalar(0.8 + Math.random() * 0.3);
    fx.add(m);
  }

  var debrisGeo = null;
  /** 성벽 파편 — 무너지는 순간 돌 조각이 튀었다 떨어지며 사라진다(PLAN §6
   *  "성벽 붕괴 파편 파티클(≤40)"). 판정과 무관한 연출뿐이고, `tick()`이
   *  중력·수명을 관리해 다 떨어지면 스스로 지운다. 조각마다 재질을 새로
   *  만드는 건(캐시 안 함) 파편 자체가 드문 사건(전투당 성벽 최대 6칸)이라
   *  `banner()`처럼 매 프레임 도는 자리와 달리 GPU 누적 걱정이 없어서다 */
  function spawnDebris(x, z) {
    var t = three();
    if (!t || !fx) { return; }
    if (!debrisGeo) { debrisGeo = new t.BoxGeometry(0.12, 0.12, 0.12); }
    var n = 8, i;
    for (i = 0; i < n; i++) {
      if (debris.length >= 40) { break; }
      var mat = new t.MeshBasicMaterial({ color: 0x8a8378, transparent: true, opacity: 1 });
      var m = new t.Mesh(debrisGeo, mat);
      var ang = Math.random() * Math.PI * 2;
      var spd = 0.8 + Math.random() * 1.6;
      m.position.set(x, 0.3 + Math.random() * 0.4, z);
      m.scale.setScalar(0.6 + Math.random() * 0.8);
      fx.add(m);
      debris.push({
        mesh: m,
        vx: Math.cos(ang) * spd, vz: Math.sin(ang) * spd, vy: 2.2 + Math.random() * 1.4,
        life: 1
      });
    }
  }

  /** 파편 물리·수명 — tick() 이 매 프레임 부른다(중력 낙하 + 바닥 도달 후 빠르게
   *  바랜다). 순수 연출, dt 는 초 단위로 넉넉히(60fps 가정) 어림잡는다 */
  function stepDebris() {
    if (!debris.length) { return; }
    var dt = 1 / 60, i, d;
    for (i = debris.length - 1; i >= 0; i--) {
      d = debris[i];
      d.vy -= 9.8 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.rotation.x += d.vx * dt * 2;
      d.mesh.rotation.z += d.vz * dt * 2;
      if (d.mesh.position.y <= 0.06) {
        d.mesh.position.y = 0.06;
        d.life -= dt * 3.2;              // 바닥에 닿으면 빠르게 바래 사라진다
      } else {
        d.life -= dt * 0.6;
      }
      d.mesh.material.opacity = Math.max(0, d.life);
      if (d.life <= 0) {
        fx.remove(d.mesh);
        d.mesh.material.dispose();
        debris.splice(i, 1);
      }
    }
  }

  /** kind 별 소품 하나 — asset3d 캐시 덕에 같은 kind 를 여러 번(합마다 성벽을
   *  다시 그릴 때) 불러도 두 번째부터는 사실상 즉시 온다.
   *  `liveGate` 를 주면(합 단위 재생 중인 성벽) 그 합이 지난 뒤 늦게 돌아온
   *  응답은 버린다 — 안 그러면 두 합 전 성벽이 지금 화면에 끼어든다 */
  var liveSeq = 0;
  function addProp(kind, id, x, z, scaleH, rotY, seq, liveGate) {
    var g0 = curGroup;
    asset3d().build(kind, { id: id }, function (g) {
      if (seq !== rebuildSeq || (liveGate != null && liveGate !== liveSeq) || !g || !g0) { return; }
      g.position.set(x, 0, z);
      g.rotation.y = rotY || 0;
      g.scale.setScalar(scaleH);
      g0.add(g);
      var prevGroup = curGroup;
      curGroup = g0;
      addShadow(x, z, scaleH * 0.4);
      curGroup = prevGroup;
    });
  }

  /** 병력 한 무리를 어림잡아 세우는 깃발 — 실제 소품 GLB 대신 막대+천으로 직접 짓는다
   *  (이 무리는 "성 안"의 살림살이가 아니라 숫자를 어림잡는 표식일 뿐이다).
   *  전투 재생 한 판에 `renderLive()`가 수십 번(합마다) 이 함수를 무리당 최대
   *  14번 부르는데, 예전엔 매번 지오메트리·머티리얼을 새로 만들고
   *  `liveDyn.clear()`(dispose 안 함)로 버려서 GPU 자원이 계속 쌓였다.
   *  지오메트리는 딱 하나(깃발 모양은 다 같다), 천 머티리얼은 색상별로
   *  캐시해 재사용한다 — 그러면 `.clear()`가 참조만 끊어도 GPU 에는
   *  아무것도 안 남는다(감사, 2026-09-08) */
  var bannerPoleGeo = null, bannerPoleMat = null, bannerClothGeo = null, bannerClothMats = {};
  var cavAccentGeo = null, cavAccentMat = null, navyAccentGeo = null, navyAccentMat = null;
  /** @param kind 'cav'|'navy'|falsy(보병, 장식 없음) — PLAN §6 "무리 병종 기둥"
   *  나머지 조각(2026-09-23). war.js `troopMixOf()`가 비율만 정하고, 여기선
   *  깃발 밑에 작은 장식(기병=말 몸통 상자, 수군=뱃전 상자)만 얹어 가른다 —
   *  기존 깃발 지오메트리·자리(clusterLayout)는 그대로, 새 메시 하나만 더한다 */
  function banner(color, tipped, kind) {
    var t = three();
    var TN = global.DG.toon3d;
    if (!bannerPoleGeo) {
      bannerPoleGeo = new t.CylinderGeometry(0.035, 0.035, 1.5, 5);
      bannerPoleMat = TN ? TN.lambertLike({ color: 0x6b5533 }) : new t.MeshLambertMaterial({ color: 0x6b5533 });
      bannerClothGeo = new t.BoxGeometry(0.46, 0.62, 0.03);
      cavAccentGeo = new t.BoxGeometry(0.34, 0.22, 0.16);
      cavAccentMat = TN ? TN.lambertLike({ color: 0x5a4028 }) : new t.MeshLambertMaterial({ color: 0x5a4028 });
      navyAccentGeo = new t.BoxGeometry(0.5, 0.08, 0.22);
      navyAccentMat = TN ? TN.lambertLike({ color: 0x3f7fae }) : new t.MeshLambertMaterial({ color: 0x3f7fae });
    }
    var g = new t.Group();
    var pole = new t.Mesh(bannerPoleGeo, bannerPoleMat);
    pole.position.y = 0.75;
    g.add(pole);
    var hex = new t.Color(color).getHex();
    var clothMat = bannerClothMats[hex];
    if (!clothMat) { clothMat = bannerClothMats[hex] = TN ? TN.lambertLike({ color: hex }) : new t.MeshLambertMaterial({ color: hex }); }
    var cloth = new t.Mesh(bannerClothGeo, clothMat);
    cloth.position.set(0.26, 1.16, 0);
    g.add(cloth);
    if (kind === 'cav') {
      var horse = new t.Mesh(cavAccentGeo, cavAccentMat);
      horse.position.set(0, 0.11, 0.22);
      g.add(horse);
    } else if (kind === 'navy') {
      var hull = new t.Mesh(navyAccentGeo, navyAccentMat);
      hull.position.set(0, 0.04, 0.24);
      g.add(hull);
    }
    if (tipped) { g.rotation.z = 1.15; g.position.y = 0.05; }
    return g;
  }

  /** 무리 하나 — 예전엔 낱낱이 `curGroup`에 바로 얹어 놓는 자리(x,z)를 못
   *  옮겼다. 이제 한 그룹으로 묶어 그 그룹의 위치를 반환한다 — tick()이
   *  라운드가 부딪힐 때마다(`roundPulse`) 이 그룹째로 살짝 앞으로 밀었다
   *  당겨 "부딪힌다"는 걸 보여줄 수 있게(2026-09-10, 병력 무리도 실시간
   *  액션처럼 느껴지게 해 달라는 이어지는 요청) */
  /** 진형(war.js FORMATIONS)에 따라 무리 배치 모양을 바꾼다(2026-09-22, PLAN §6
   *  "무리 병종 기둥"의 첫 조각) — `war.js`의 `fightIntro()`가 이미 골라 둔
   *  진형 key(`rep.formA`/`formD`)만 읽는다, 새 판정은 없다. **병종 3분류
   *  (보·기·수)는 이 판에 실제 병종 비율 데이터가 없어 보류했다** — 지어낸
   *  숫자로 나누느니 진형(실재 데이터)만으로 배치 모양을 바꿨다. 진형이
   *  없거나(구원 등) 모르는 값이면 예전 grid 그대로(안전한 기본값). */
  function clusterLayout(n, formKey) {
    var i, pts = [];
    if (formKey === 'chukyi') {             // 추행진 — 앞이 뾰족한 쐐기꼴
      var row = 0, idx = 0, rowLen;
      while (idx < n) {
        rowLen = Math.min(row + 1, n - idx);
        for (i = 0; i < rowLen; i++) { pts.push({ x: (i - (rowLen - 1) / 2) * 0.55, z: row * 0.4 }); idx++; }
        row++;
      }
      return pts;
    }
    if (formKey === 'hakik') {              // 학익진 — 학이 날개를 편 듯 넓은 활
      for (i = 0; i < n; i++) {
        var a = n <= 1 ? 0 : (i / (n - 1) - 0.5) * Math.PI * 0.85;
        pts.push({ x: Math.sin(a) * (0.5 + n * 0.11), z: -Math.cos(a) * 0.4 });
      }
      return pts;
    }
    if (formKey === 'bangwon') {            // 방원진 — 둥글게 다진 원
      for (i = 0; i < n; i++) {
        var a2 = (i / n) * Math.PI * 2, r = 0.35 + n * 0.05;
        pts.push({ x: Math.cos(a2) * r, z: Math.sin(a2) * r });
      }
      return pts;
    }
    var cols = Math.min(5, Math.max(1, n));  // 예전 grid(기본값, 진형이 없을 때)
    for (i = 0; i < n; i++) {
      var rr = Math.floor(i / cols), cc = i % cols;
      pts.push({ x: (cc - (cols - 1) / 2) * 0.55, z: -rr * 0.55 });
    }
    return pts;
  }

  /** mix({inf,cav,navy} 비율) → 깃발 n개 각각의 병종 배열. 자리는 이미
   *  clusterLayout 이 정했으니 여기선 순서만 섞어 같은 병종이 한쪽에 뭉치지
   *  않게 한다(2026-09-23, PLAN §6). 2026-09-25 — 섞기는 n 으로 정한 씨앗(`jit`)을
   *  쓴다: 병사 몸이 서면서 합마다 Math.random 으로 자리·병종이 뒤바뀌면 병사가
   *  순간이동하는 것처럼 보였다(깃발일 땐 티가 덜 났다) */
  function jit(i, salt) {
    var x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  function troopTypes(n, mix) {
    var navyN = Math.min(n, Math.round(n * (mix.navy || 0)));
    var cavN = Math.min(n - navyN, Math.round(n * (mix.cav || 0)));
    var arr = [], i;
    for (i = 0; i < navyN; i++) { arr.push('navy'); }
    for (i = 0; i < cavN; i++) { arr.push('cav'); }
    while (arr.length < n) { arr.push('inf'); }
    for (i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(jit(i, n) * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* 무리 병사 몸(2026-09-25, `tools/asset-audit/CHARACTER_UNIQUENESS.md` ⑤) — 깃발 다발(코드 도형) 자리에
   * `asset3d.buildTrooper` 병사가 선다. 몸은 싸움 한 판 동안 **쪽·병종마다 모아 두고**(`troopPool`) 합마다
   * 새 무리 그룹에 옮겨 달기만 한다 — `renderLive()` 가 합마다 무리를 다시 짓는데 그때마다 스킨 모델을
   * 복제하면 무겁고 걷던 몸짓도 끊긴다. 새 싸움(`buildBase`)이면 비운다. 아직 안 온 자리는 옛 깃발로 채우고,
   * 셋에 하나는 깃발잡이로 깃발을 그대로 둔다(세력 색이 멀리서도 읽히게). 수군은 배 에셋이 없어 뱃전 상자 그대로 */
  var TROOP_H = 1.0, TROOP_H_CAV = 0.7;     // 병사 몸 키 1 → 일기토 장수(1.5)보다 작게, 기병은 말이 길어 작게(기수 머리가 보병과 비슷한 높이)
  var TROOP_SPREAD = 1.25;                  // 몸은 깃발보다 넓어 진형 자리 간격을 이만큼 벌린다
  var troopPool = null, troopSeq = 0;
  function resetTroopPool() { troopPool = { a: { inf: [], cav: [] }, d: { inf: [], cav: [] } }; troopSeq++; }
  function wantTroops(side, kind, n, color) {
    var A3x = asset3d();
    if (!TROOP_MODEL() || !A3x || !A3x.buildTrooper || !troopPool) { return; }
    var list = troopPool[side][kind], mySeq = troopSeq;
    while (list.length < n) {
      var slot = { model: null };
      list.push(slot);
      (function (sl) {
        A3x.buildTrooper(kind, color, function (m) { if (mySeq === troopSeq && m) { sl.model = m; } });
      })(slot);
    }
  }

  function cluster(n, cx, cz, color, formKey, mix, side) {
    var t = three();
    var i;
    var g = new t.Group();
    var prevGroup = curGroup;
    curGroup = g;
    var pts = clusterLayout(n, formKey);
    var types = mix ? troopTypes(n, mix) : null;
    var used = { inf: 0, cav: 0 }, face = side === 'a' ? Math.PI : 0;   // 공격군(+z)은 -z 를, 수비군은 +z 를 본다
    if (side && troopPool) {
      var needInf = 0, needCav = 0;
      for (i = 0; i < n; i++) { if (types && types[i] === 'cav') { needCav++; } else { needInf++; } }
      wantTroops(side, 'inf', needInf, color);
      wantTroops(side, 'cav', needCav, color);
    }
    var spread = (side && troopPool && TROOP_MODEL()) ? TROOP_SPREAD : 1;
    for (i = 0; i < n; i++) {
      var x = pts[i].x * spread + (jit(i, 3) - 0.5) * 0.12;
      var z = pts[i].z * spread + (jit(i, 7) - 0.5) * 0.12;
      var kind = types && types[i];
      var pk = kind === 'cav' ? 'cav' : 'inf';
      var slot = (side && troopPool) ? troopPool[side][pk][used[pk]++] : null;
      if (slot && slot.model) {
        var m = slot.model;
        m.scale.setScalar(pk === 'cav' ? TROOP_H_CAV : TROOP_H);
        m.position.set(x, 0, z);
        m.rotation.y = face;
        g.add(m);
        if (kind === 'navy') {
          var hull = banner(color, false, 'navy');
          hull.children[0].visible = false; hull.children[1].visible = false;   // 깃대·천은 빼고 뱃전만
          hull.position.set(x, 0, z);
          hull.scale.setScalar(1.6);
          g.add(hull);
        }
        if (i % 3 === 0) {                               // 깃발잡이 — 병사 등 뒤에 깃발
          var fb = banner(color, false, null);
          fb.position.set(x + 0.16, 0, z + (side === 'a' ? 0.18 : -0.18));
          g.add(fb);
        }
      } else {
        var b = banner(color, false, kind);
        b.position.set(x, 0, z);
        g.add(b);
      }
      addShadow(x, z, 0.22);
    }
    curGroup = prevGroup;
    g.position.set(cx, 0, cz);
    g.userData.troops = g.children.filter(function (o) { return o.userData && o.userData.trooper; });
    curGroup.add(g);
    return g;
  }

  /* ── 실시간 전장(2026-09-28, 실기 보고 Q9 "실시간 전투가 아님") ─────────────────
   * 개입형 전투(`beginLive`)에서만 쓴다. 예전엔 합마다 무리를 통째로 다시 지어 병사가 제자리에 서 있다
   * 합이 올 때만 한 번 휘둘렀다. 이제 병사 하나하나가 **매 프레임** 가장 가까운 적에게 달려가 붙어
   * 싸우고, 합이 끝나 병력이 줄면(war.js `frames` 값) 앞줄부터 쓰러진다. **판정은 여전히 한 줄도 없다** —
   * 누가 몇 명 남는지는 war.js 가 낸 병력 비율로만 정하고, 여기선 그 수에 맞춰 쓰러뜨릴 뿐이다.
   * 명령(돌격·수비)은 `setStance()` 로 받아 달리는 빠르기·버티는 자리만 바꾼다(그림뿐).
   * 손잡이: `battle3d.liveCap`(한쪽 최대 병사 수, 22) */
  function LIVE_CAP() { return core() ? Math.max(4, core().tuned('battle3d.liveCap', 22)) : 22; }
  var army = null;   // { g, a:[], d:[], sortie, water, stance, t, corpses, meet }
  var ARMY_REACH = 0.8, ARMY_SEP = 0.62;
  var vrS = 20260928;
  function vr() { vrS = (vrS * 1664525 + 1013904223) >>> 0; return vrS / 4294967296; }
  function armyCount(start) { return clamp(Math.round((start || 0) / 450), 4, LIVE_CAP()); }
  function soldierHolder(color, kind, flagBearer) {
    var t = three(), h = new t.Group();
    var ph = banner(color, false, kind);
    h.add(ph);
    h.userData.ph = ph;
    if (flagBearer) { h.userData.flagBearer = true; }
    return h;
  }
  function buildArmy(rep, h) {
    var t = three();
    /* wallZ — 성벽 고리(renderLive 의 ring(6, h×0.7))의 앞쪽 두 조각이 서는 줄. 공성이면 두 군이 이 줄을 사이에 두고 붙는다 */
    army = { g: new t.Group(), a: [], d: [], sortie: !!rep.sortie, water: !!rep.water, stance: null, t: 0,
      endT: 0, end: null, wallZ: -6.5 + Math.sin(Math.PI / 3) * h * 0.7, wallUp: !rep.water };
    dyn.add(army.g);
    [['a', rep.atkStart, rep.force, rep.formA, rep.mixA], ['d', rep.defStart, rep.defForce, rep.formD, rep.mixD]].forEach(function (S) {
      var side = S[0], n = armyCount(S[1]), color = forceColor(S[2]);
      var pts = clusterLayout(n, S[3]), types = S[4] ? troopTypes(n, S[4]) : null, i, needInf = 0, needCav = 0;
      for (i = 0; i < n; i++) { if (types && types[i] === 'cav') { needCav++; } else { needInf++; } }
      wantTroops(side, 'inf', needInf, color);
      wantTroops(side, 'cav', needCav, color);
      var used = { inf: 0, cav: 0 };
      /* 출발 자리 — 공격군은 싸움터 앞쪽 끝(+z)에서 걸어 들어오고, 수비군은 성문 앞(공성) 또는 조금 나와(야전) 선다 */
      var cz = side === 'a' ? 8.6 : (army.sortie || army.water ? -1.2 : army.wallZ - 0.45);
      for (i = 0; i < n; i++) {
        var kind = types && types[i], pk = kind === 'cav' ? 'cav' : 'inf';
        var s = { side: side, kind: pk, navy: kind === 'navy', slot: troopPool[side][pk][used[pk]++],
          hx: pts[i].x * 2.4 + (jit(i, side === 'a' ? 11 : 13) - 0.5) * 0.4,
          hz: (side === 'a' ? 1 : -1) * Math.abs(pts[i].z) * 1.7 + (jit(i, 17) - 0.5) * 0.3,
          alive: true, die: -1, swing: jit(i, 23) * 1.2, want: 'idle', speedK: 0.85 + jit(i, 29) * 0.3 };
        s.x = s.hx; s.z = cz + s.hz;
        s.obj = soldierHolder(color, kind, i % 4 === 0);
        s.obj.position.set(s.x, 0, s.z);
        s.obj.rotation.y = side === 'a' ? Math.PI : 0;
        army.g.add(s.obj);
        army[side].push(s);
      }
    });
    return army;
  }
  /** 병사 몸이 도착했으면 깃발 자리를 몸으로 바꾼다(깃발잡이는 등에 깃발을 남긴다) */
  function dressSoldier(s) {
    if (s.dressed || !s.slot || !s.slot.model) { return; }
    var m = s.slot.model, h = s.obj;
    if (h.userData.ph) {
      if (h.userData.flagBearer) { h.userData.ph.position.set(0.16, 0, -0.18); }
      else { h.remove(h.userData.ph); }
    }
    m.scale.setScalar(s.kind === 'cav' ? TROOP_H_CAV : TROOP_H);
    m.position.set(0, 0, 0);
    m.rotation.set(0, 0, 0);
    h.add(m);
    var cm = m.userData.clipMap;
    s.realDeath = !!(cm && cm.death && !(cm.alias && cm.alias.death));
    s.dressed = true;
  }
  /** war.js 가 낸 병력에 맞춰 산 병사 수를 맞춘다 — 줄면 적과 가장 가까운(맞붙은) 병사부터 쓰러진다 */
  function armySetAlive(side, troops, start) {
    if (!army) { return; }
    var list = army[side], n0 = list.length;
    var want = troops <= 0 ? 0 : Math.max(1, Math.round(n0 * clamp(troops / Math.max(1, start), 0, 1)));
    var alive = list.filter(function (s) { return s.alive; });
    if (alive.length <= want) { return; }
    var foes = army[side === 'a' ? 'd' : 'a'].filter(function (s) { return s.alive; });
    alive.forEach(function (s) { s.front = foes.length ? nearestDist(s, foes) : 0; });
    alive.sort(function (p, q) { return p.front - q.front; });
    for (var i = 0; i < alive.length - want; i++) {
      var s = alive[i];
      s.alive = false; s.die = 0;
      s.fall = (jit(i, army.t * 7 + 3) < 0.5 ? -1 : 1);
    }
  }
  function nearestDist(s, list) {
    var best = 1e9;
    for (var i = 0; i < list.length; i++) {
      var dx = list[i].x - s.x, dz = list[i].z - s.z, d = dx * dx + dz * dz;
      if (d < best) { best = d; }
    }
    return Math.sqrt(best);
  }
  /** 노릴 적 — 가까운 적이되 **제 줄(가로 자리 hx)** 에 있는 적을 먼저 본다. 가장 가까운 적만 쫓으면
   *  두 군이 한가운데 한 점으로 몰려 한 덩이가 됐다(헤드리스 사진) — 줄로 맞서야 전선이 보인다 */
  function nearestFoe(s, list) {
    var best = null, bc = 1e9, bd = 0;
    for (var i = 0; i < list.length; i++) {
      if (!list[i].alive) { continue; }
      var dx = list[i].x - s.x, dz = list[i].z - s.z, d = Math.sqrt(dx * dx + dz * dz);
      var cost = d + Math.abs(list[i].x - s.hx) * 0.7;
      if (cost < bc) { bc = cost; best = list[i]; bd = d; }
    }
    return best ? { s: best, d: bd } : null;
  }
  /** 합이 부딪힌 순간 — 맞붙은 병사가 한꺼번에 휘두른다(합의 박자가 보이게) */
  function armyClash() {
    if (!army) { return; }
    ['a', 'd'].forEach(function (side) {
      army[side].forEach(function (s) { if (s.alive && s.engaged) { s.swing = Math.min(s.swing, 0.05 + vr() * 0.15); } });
    });
  }
  /** 명령(그림뿐) — 'press' 돌격 · 'hold' 수비 · null 정공법 · 끝났을 때 'won'|'lost'|'routed'|'dusk' */
  function setStance(st) { if (army) { army.stance = st || null; } }
  function armyEnd(kind) { if (army) { army.end = kind; army.endT = 0; } }
  var army_sfxT = 0;
  function stepArmy(dt, tT) {
    if (!army) { return; }
    army.t += dt;
    var A3x = asset3d(), sides = ['a', 'd'], si, i;
    for (si = 0; si < 2; si++) {
      var side = sides[si], mine = army[side], foes = army[side === 'a' ? 'd' : 'a'];
      /* 이 쪽의 버티는 자리 — 공격군은 명령이 수비면 제 진영(z 3.4)에서, 수비군은 공성이면 성벽 뒤에서 버틴다 */
      var siege = !army.sortie && !army.water;
      var holdZ = side === 'a' ? (army.stance === 'hold' ? 3.4 : null) : (siege && army.wallUp ? army.wallZ - 0.45 : null);
      var run = side === 'a' ? (army.stance === 'press' ? 1.45 : (army.stance === 'hold' ? 0.8 : 1)) : 1;
      var end = army.end, flee = false, cheer = false;
      if (end) {
        var aWon = end === 'won';
        if (side === 'a') { flee = end === 'routed' || end === 'lost'; cheer = aWon; }
        else { flee = aWon; cheer = end === 'routed' || end === 'lost'; }
      }
      for (i = 0; i < mine.length; i++) {
        var s = mine[i];
        dressSoldier(s);
        var model = s.dressed ? s.slot.model : null;
        if (!s.alive) {
          /* 쓰러짐 — 죽음 몸짓이 있으면 그것, 없으면 몸째 옆으로 넘어진다. 4초 뒤 땅으로 가라앉아 사라진다 */
          if (s.die < 0) { continue; }
          s.die += dt;
          if (model && s.realDeath) { if (s.want !== 'death') { s.want = 'death'; A3x.play(model, 'death', true); } }
          else { s.obj.rotation.z = s.fall * Math.min(1, s.die / 0.45) * 1.45; }
          if (s.die > 4) { s.obj.position.y = -Math.min(1.2, (s.die - 4) * 0.8); }
          if (s.die > 5.6) { s.obj.visible = false; s.die = -1; }
          if (model) { A3x.step(model, { t: tT + i * 0.37, anim: s.want }); }
          continue;
        }
        var near = foes.length ? nearestFoe(s, foes) : null, tx = s.x, tz = s.z, want = 'idle', face = null;
        s.engaged = false;
        if (flee) {
          tx = s.x; tz = side === 'a' ? 14 : -9; want = 'run';
        } else if (cheer || !near) {
          want = 'idle';
          if (near) { face = near.s; }
        } else if (near.d <= ARMY_REACH + (s.kind === 'cav' ? 0.35 : 0)) {
          s.engaged = true; face = near.s;
          s.swing -= dt;
          if (s.swing <= 0) { s.swing = 0.9 + vr() * 0.8; want = 'attack'; }
          else { want = s.want === 'attack' && s.swing > 0.6 ? 'attack' : 'idle'; }
        } else {
          tx = near.s.x; tz = near.s.z; face = near.s;
          /* 버티는 쪽은 자리에서 기다리다 적이 3m 안에 들어오면 나선다 */
          if (holdZ != null && near.d > 3) {
            tx = s.hx; tz = holdZ + s.hz * 0.6; face = near.s;
          }
          want = 'run';
        }
        var dx = tx - s.x, dz = tz - s.z, dd = Math.sqrt(dx * dx + dz * dz);
        if (want === 'run' && dd > 0.15) {
          var sp = (s.kind === 'cav' ? 3.4 : 2.3) * run * s.speedK * (flee ? 1.2 : 1);
          if (dd < 1.2 && !flee) { sp *= 0.6; want = 'walk'; }
          var stepD = Math.min(dd, sp * dt);
          s.x += dx / dd * stepD; s.z += dz / dd * stepD;
          if (!face || flee) { s.obj.rotation.y = Math.atan2(dx, dz); }
        } else if (want === 'run') { want = 'idle'; }
        if (face) { s.obj.rotation.y = Math.atan2(face.x - s.x, face.z - s.z); }
        /* 제 편끼리 겹치지 않게 살짝 민다(한 점에 몰려 한 덩이가 되지 않게 — 사가고 Q6 ③ 과 같은 요령) */
        for (var j = 0; j < mine.length; j++) {
          var o = mine[j];
          if (o === s || !o.alive) { continue; }
          var ex = s.x - o.x, ez = s.z - o.z, e2 = ex * ex + ez * ez;
          if (e2 < ARMY_SEP * ARMY_SEP && e2 > 1e-6) {
            var e = Math.sqrt(e2), push = (ARMY_SEP - e) * 0.5;
            s.x += ex / e * push; s.z += ez / e * push;
          }
        }
        /* 싸움터 원판(반지름 11) 밖·성벽 안(공성 때 수비군 뒤)으로 새지 않게 */
        var rr = Math.sqrt(s.x * s.x + s.z * s.z);
        if (rr > 10.3 && !flee) { s.x *= 10.3 / rr; s.z *= 10.3 / rr; }
        /* 성벽이 서 있는 동안 공격군은 벽 앞에서, 수비군은 벽 뒤에서 — 벽이 다 무너지면 넘어 들어간다 */
        if (siege && army.wallUp && !flee) {
          if (side === 'a' && s.z < army.wallZ + 0.35) { s.z = army.wallZ + 0.35; }
          if (side === 'd' && s.z > army.wallZ - 0.4) { s.z = army.wallZ - 0.4; }
        }
        s.obj.position.set(s.x, 0, s.z);
        if (model) {
          var force = false;
          if (want === 'attack' && s.want !== 'attack') { force = true; }
          s.want = want;
          A3x.step(model, { t: tT + i * 0.37, anim: want, force: force });
        } else {
          s.want = want;
          /* 몸이 아직 안 온 깃발 — 뛰는 동안 깃대가 앞으로 기운다 */
          s.obj.rotation.x = want === 'run' ? 0.18 * Math.sin(tT * 9 + i) : 0;
        }
      }
    }
    if (army.end) { army.endT += dt; }
    /* 칼 부딪는 소리는 맞붙은 병사가 있을 때만, 1.1초에 한 번 */
    army_sfxT -= dt;
    if (army_sfxT <= 0) {
      army_sfxT = 1.1;
      var clashing = army.a.some(function (s) { return s.alive && s.engaged; });
      var SFX = global.DG.sfx;
      if (clashing && SFX && !army.end) { SFX.play('duel'); }
    }
  }
  /** 실시간 전장의 두 지휘관(일기토 장수 자리) — 제 군 가운데에서 1.8m 뒤를 걸어 따라간다. 일기토에서 쓰러졌으면 그 자리 */
  function leadFollow(dt) {
    ['a', 'd'].forEach(function (side) {
      var m = duelActors[side];
      if (!m || duelWant[side] === 'death') { return; }
      var c = sideCenter(side);
      if (!c) { return; }
      var tx = c.x * 0.5, tz = c.z + (side === 'a' ? 1.8 : -1.8);
      if (side === 'd' && army.wallUp && !army.sortie && !army.water) { tz = Math.min(tz, army.wallZ - 1.4); }
      if (!m.userData.liveSet) { m.userData.liveSet = true; m.position.set(tx, 0, tz); }
      var dx = tx - m.position.x, dz = tz - m.position.z, dd = Math.sqrt(dx * dx + dz * dz);
      if (dd > 0.3) {
        var st = Math.min(dd, 2.0 * dt);
        m.position.x += dx / dd * st; m.position.z += dz / dd * st;
      }
      var foe = sideCenter(side === 'a' ? 'd' : 'a');
      if (foe) { m.rotation.y = Math.atan2(foe.x - m.position.x, foe.z - m.position.z); }
      if (duelWant[side] === 'idle' && dd > 0.6) { duelWant[side] = 'walk'; duelGen++; }
      else if (duelWant[side] === 'walk' && dd <= 0.3) { duelWant[side] = 'idle'; duelGen++; }
    });
  }

  /** 두 군의 가운데(카메라가 본다) — 산 병사 평균, 없으면 0 */
  function armyCenter() {
    var sx = 0, sz = 0, n = 0;
    if (army) {
      army.a.concat(army.d).forEach(function (s) { if (s.alive) { sx += s.x; sz += s.z; n++; } });
    }
    return n ? { x: sx / n, z: sz / n } : { x: 0, z: 1 };
  }
  function sideCenter(side) {
    var sx = 0, sz = 0, n = 0;
    army[side].forEach(function (s) { if (s.alive) { sx += s.x; sz += s.z; n++; } });
    return n ? { x: sx / n, z: sz / n } : null;
  }

  /** 한 번만 짓는 것 — 땅·성. 성벽·무리·일기토 깃발은 `renderLive()` 몫이다
   *  (합마다 다시 그려야 하므로).
   *  @returns {seq,h,maxWall} — renderLive() 에 그대로 넘긴다. 성이 없으면 null */
  /* ── 싸움터 땅(SAGA-DESIGN §12 고정 특색 지역, 2026-09-24) ─────────────────
   * 예전엔 바닥이 물(rep.water)이냐 아니냐 두 가지뿐이었다 — 기주 평야든 촉의 산성이든 같은 풀빛 원판.
   * 이제 그 성의 땅(data-city `land`)과 주(`prov`)가 바닥빛·하늘·소품을 정한다. 무작위 없음 —
   * 같은 성은 언제 싸워도 같은 싸움터다. 소품은 가장자리(반지름 8~10)에만 세워 무리·성과 안 겹친다.
   * 표·순수 함수는 data-city.js `battleLook`(진단이 싣는 쪽), 여기는 그리기만. */
  var PROP_COLOR = { grass: 0x9dbb62, mound: 0x9ab872, reed: 0x7fa65a, peak: 0x8a8f86, dune: 0xd4b77a,
    crystal: 0xb89cff, rubble: 0x7a766c, grave: 0x9a9e94 };
  function battleLook(cityId, water) { return global.DG.cityData.battleLook(cityId, water); }
  function propMesh(t, P) {
    var col = PROP_COLOR[P.kind] || 0x8a8a80, TN = global.DG.toon3d;
    var mat = TN ? TN.lambertLike({ color: col }) : new t.MeshLambertMaterial({ color: col });
    var geo;
    if (P.kind === 'mound' || P.kind === 'dune') { geo = new t.SphereGeometry(1.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); }
    else if (P.kind === 'peak') { geo = new t.ConeGeometry(1.1, 2.6, 6); }
    else if (P.kind === 'crystal') { geo = new t.OctahedronGeometry(0.8, 0); }
    else if (P.kind === 'rubble') { geo = new t.BoxGeometry(1.2, 0.6, 0.9); }
    else if (P.kind === 'grave') { geo = new t.BoxGeometry(0.6, 1.0, 0.18); }
    else { geo = new t.ConeGeometry(0.35, 1.1, 5); }                  // grass·reed — 풀 포기
    var m = new t.Mesh(geo, mat);
    m.position.set(P.x, P.kind === 'peak' ? 1.3 : (P.kind === 'crystal' ? 0.9 : (P.kind === 'grave' ? 0.5 : (P.kind === 'rubble' ? 0.3 : 0))), P.z);
    if (P.kind === 'dune') { m.scale.set(P.s * 1.6, P.s * 0.5, P.s); } else { m.scale.setScalar(P.s); }
    m.rotation.y = P.x * 0.7;
    return m;
  }

  function buildBase(rep) {
    var t = three();
    dyn.clear();
    liveDyn = new t.Group();
    dyn.add(liveDyn);
    rebuildSeq++;
    var seq = rebuildSeq;
    curGroup = dyn;
    atkGroupRef = null; defGroupRef = null; roundPulse = 0;
    lastWallN = null; wallShake = 0;
    resetTroopPool();
    army = null;
    if (fx) { fx.clear(); }
    debris = [];
    var c = R().city(rep.to);
    if (!c) { return null; }
    var tier = tierOf(c.maxWall);
    var h = TIER_H[tier];
    var ownerCol = forceColor(c.force);

    var look = battleLook(rep.to, rep.water);   // 싸움터 땅(§12) — 성의 땅·주가 정한다
    scene.background = (global.DG.toon3d && global.DG.toon3d.skyBackground) ? global.DG.toon3d.skyBackground(look.sky) : new t.Color(look.sky);   // 하늘 그라디언트(2026-09-23)
    scene.fog = new t.Fog(look.sky, 20, 70);

    var groundTN = global.DG.toon3d;
    var ground = new t.Mesh(
      new t.CircleGeometry(11, 28),
      groundTN ? groundTN.lambertLike({ color: look.ground })
        : new t.MeshLambertMaterial({ color: look.ground })
    );
    ground.rotation.x = -Math.PI / 2;
    dyn.add(ground);
    if (look.stream) {
      /* 강가·해안 — 싸움터 앞쪽을 가로지르는 물줄기 */
      var sw = new t.Mesh(new t.PlaneGeometry(22, 1.6),
        groundTN ? groundTN.lambertLike({ color: 0x5aa9d8 }) : new t.MeshLambertMaterial({ color: 0x5aa9d8 }));
      sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.02, 7.6);
      dyn.add(sw);
    }
    look.props.forEach(function (P) { dyn.add(propMesh(t, P)); });

    asset3d().build('city:' + tier, { id: rep.to + ':battle', tint: ownerCol, flag: ownerCol }, function (g) {
      if (seq !== rebuildSeq || !g || !dyn) { return; }
      g.position.set(0, 0, -6.5);
      g.scale.setScalar(h);
      dyn.add(g);
      var prevGroup = curGroup;
      curGroup = dyn;
      addShadow(0, -6.5, h * 0.45);
      curGroup = prevGroup;
    });

    setupDuel(rep, seq);

    return { seq: seq, h: h, maxWall: c.maxWall || 1 };
  }

  /**
   * 실제 캐릭터 둘을 세운다(비동기, `dyn`에 한 번만 얹는다 — 성벽·무리처럼
   * 합마다 다시 짓지 않는다). `rep.duel.a`(공격 쪽 장수)·`rep.duel.d`
   * (수비 쪽 장수) 무장의 실제 QRPG 모델을 `off().find()`로 찾아 각 세력
   * 색으로 물들여 마주 세운다.
   *
   * **2026-09-10 — 일기토가 없는 싸움도 이제 지휘관 둘은 세운다("인물
   * 추가").** `war.js`의 `duel()`은 능력치 차가 크면 아예 안 뽑히고,
   * 뽑혀도 65%는 그냥 안 붙는다 — 그동안 그 나머지 싸움은 깃발 다발뿐이라
   * "인물"이 하나도 안 보였다. `rep.leadA`/`rep.leadD`(합을 안 주고받아도
   * `fightIntro()`가 늘 남겨 두는 두 세력의 우두머리 장수)로 같은 자리를
   * 채운다 — `duelWant`는 `rep.duel`이 없으면 늘 idle 로만 두므로(위
   * `updateDuel()` 참고) 공격·피격 동작은 절대 안 걸린다. **새 판정이
   * 아니다** — 이미 `armyPower`가 골라 둔 값을 그대로 세워 보여줄 뿐이다.
   */
  /** 재질을 복제해 떼어 온다(사가블로 asset3d.js `ownAllMat`과 같은 요령) —
   *  안 그러면 캐시된 재질을 여러 모델이 같이 쓰다 한쪽만 번쩍이려 해도
   *  같은 재질을 쓰는 다른 데까지 같이 번쩍인다. emissive 있는 것만 돌려준다 */
  function ownAllMat(root) {
    var out = [];
    if (!root) { return out; }
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      var srcM = Array.isArray(o.material) ? o.material[0] : o.material, TNc = global.DG.toon3d;
      var m = TNc && TNc.cloneMat ? TNc.cloneMat(srcM) : srcM.clone();   // 림·얼굴 셰이더까지 옮긴다(2026-09-23)
      o.material = m;
      if (m.emissive) { out.push(m); }
    });
    return out;
  }
  function setFlash(mats, k) {
    if (!mats || !mats.length) { return; }
    for (var i = 0; i < mats.length; i++) { mats[i].emissive.setRGB(k, k * 0.15, k * 0.1); }
  }

  function setupDuel(rep, seq) {
    duelActors = null;
    duelWant = { a: 'idle', d: 'idle' };
    duelGen = 0; tickDuelGen = -1;
    flashA = 0; flashD = 0;
    var aId = (rep.duel && rep.duel.a) || rep.leadA;
    var dId = (rep.duel && rep.duel.d) || rep.leadD;
    if (!aId || !dId) { return; }
    var OFF = off(), A3 = asset3d();
    if (!OFF || !A3 || !A3.buildHero) { return; }
    var oa = OFF.find(aId), od = OFF.find(dId);
    if (!oa || !od) { return; }
    var got = {};
    /* 마주 보고 서게 90도씩 돌린다 — QRPG 몸의 기본 정면이 어느 쪽인지는
       실기기로 확인 전이라, 반대로 등을 지고 서 보이면 이 두 rotation.y
       부호만 서로 바꾸면 된다(장수 위치·병력 무리 등 나머지는 안 건드려도 됨) */
    function place(slot, model) {
      if (seq !== rebuildSeq || !model || !dyn) { return; }
      model.scale.setScalar(1.5);
      model.position.set(slot === 'a' ? -0.6 : 0.6, 0, slot === 'a' ? 0.5 : -0.1);
      model.rotation.y = slot === 'a' ? Math.PI / 2 : -Math.PI / 2;
      model.userData.flashMats = ownAllMat(model);
      dyn.add(model);
      got[slot] = model;
      if (got.a && got.d) { duelActors = got; }
    }
    A3.buildHero(oa, forceColor(rep.force), function (m) { place('a', m); });
    A3.buildHero(od, forceColor(rep.defForce), function (m) { place('d', m); });
  }

  /**
   * 합 하나(또는 최종)를 그린다 — **성벽·무리 크기·일기토 깃발만** 다시 그린다.
   * `state = { atk, def, wall, duelPhase }` — atk/def 는 그 순간의 병력(절대
   * 값), wall 은 그 순간의 성벽 값. duelPhase: null(아직 안 붙었다) ·
   * 'progress'(맞붙는 중, 승패색을 안 가른다) · 'done'(끝났다, 금빛/회색).
   * war.js 의 `frames` 를 순서대로 이 함수에 먹이면 재생이 된다 — **여기서
   * 새 판정은 안 한다**, 이미 정해진 값을 그릴 뿐이다.
   */
  function renderLive(rep, base, state) {
    if (!base || base.seq !== rebuildSeq || !liveDyn) { return; }
    var seq = base.seq, h = base.h;
    liveDyn.clear();
    curGroup = liveDyn;
    liveSeq++;
    var myLiveSeq = liveSeq;

    if (!rep.water) {
      var wallRatio = clamp((state.wall || 0) / base.maxWall, 0, 1);
      var wallN = Math.round(wallRatio * 6);
      /* 성벽이 실제로 한 칸 무너지는 순간(2026-09-10) — 매 합 그려지는
         `wallN`이 직전 프레임보다 줄어든 그 프레임만 잡는다(공성 중이 아니면
         안 줄어드니 조용하다). `roundPulse`(매 합)보다 드물고 큰 충격이라
         카메라 흔들림(`wallShake`)·전용 소리(`wall_break`)를 따로 둔다 */
      if (lastWallN != null && wallN < lastWallN) {
        wallShake = 1;
        var SFX = global.DG.sfx;
        if (SFX) { SFX.play('wall_break'); }
        var brokenRing = ring(6, h * 0.7, 0), bi;
        for (bi = wallN; bi < lastWallN; bi++) {
          if (brokenRing[bi]) {
            spawnDebris(brokenRing[bi][0], brokenRing[bi][1] - 6.5);
            spawnScorch(brokenRing[bi][0], brokenRing[bi][1] - 6.5);
          }
        }
      }
      lastWallN = wallN;
      if (army) { army.wallUp = wallN > 0; }
      ring(6, h * 0.7, 0).slice(0, wallN).forEach(function (p, i) {
        addProp('wall', rep.to + ':bwall:' + i, p[0], p[1] - 6.5, h * 0.5,
          Math.atan2(p[0], p[1]) + Math.PI / 2, seq, myLiveSeq);
      });
    }

    var atkStart = rep.atkStart || 6000, defStart = rep.defStart || 6000;
    var atkSurvive = clamp((state.atk != null ? state.atk : atkStart) / Math.max(1, atkStart), 0, 1);
    var defSurvive = clamp((state.def != null ? state.def : defStart) / Math.max(1, defStart), 0, 1);
    var atkN = clamp(Math.round((atkStart / 1200) * atkSurvive), 1, 14);
    var defN = clamp(Math.round((defStart / 1200) * defSurvive), 1, 14);

    if (army) {
      armySetAlive('a', state.atk != null ? state.atk : atkStart, atkStart);
      armySetAlive('d', state.def != null ? state.def : defStart, defStart);
      if (state.roundTick) { roundPulse = 0.5; armyClash(); }
    } else {
      atkGroupRef = cluster(atkN, 0, 4.2, forceColor(rep.force), rep.formA, rep.mixA, 'a');
      defGroupRef = cluster(defN, 0, -3.0, forceColor(rep.defForce), rep.formD, rep.mixD, 'd');
      if (state.roundTick) { roundPulse = 1; troopGen++; }
    }

    /* 일기토 — 2026-09-10 부터는 깃발이 아니라 `duelActors`(setupDuel() 이
       세운 실제 장수 둘)를 실제로 움직인다. 여기선 "무슨 동작을 원하는지"
       (`duelWant`)만 갈아 끼우고, 실제 애니메이션 재생(mixer 갱신)은 매
       프레임 tick()이 한다 — 합마다 다시 그리는 다른 것들과 달리 캐릭터는
       끊김 없이 계속 움직여야 하기 때문이다 */
    if (rep.duel && state.duelPhase) {
      if (state.duelPhase === 'done') {
        var winA = rep.duel.winner === rep.duel.a;
        duelWant = winA
          ? { a: 'idle', d: rep.duel.hurt ? 'death' : 'idle' }
          : { d: 'idle', a: rep.duel.hurt ? 'death' : 'idle' };
        if (rep.duel.hurt) { if (winA) { flashD = 1; } else { flashA = 1; } }
        duelGen++;
      } else if (state.duelHit) {
        duelWant = state.duelHit.who === 'a' ? { a: 'attack', d: 'hit' } : { a: 'hit', d: 'attack' };
        if (state.duelHit.who === 'a') { flashD = 1; } else { flashA = 1; }
        duelGen++;
      } else {
        duelWant = { a: 'idle', d: 'idle' };
      }
    } else {
      duelWant = { a: 'idle', d: 'idle' };
    }
  }

  /** playback() 이 건 setTimeout 들 — 새 전황이 오거나 화면을 벗어나면 다 지운다 */
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) { clearTimeout(timers[i]); }
    timers = [];
  }
  function schedule(fn, delay) { timers.push(setTimeout(fn, delay)); }

  var ROUND_MS = 550, HIT_MS = 380, PAUSE_MS = 500;

  /**
   * **"실시간 전투" 재생** — `war.js` 가 이미 끝내 둔 결과(`rep`)를 합 단위로
   * 시간차를 두고 다시 그린다. 판정은 전혀 안 한다 — `rep.frames`(라운드별
   * 병력·성벽)와 `rep.duel.hits`(일기토 합별 승패)를 순서대로 `renderLive()`
   * 에 먹일 뿐이다. 둘 다 없는 옛 리포트(세이브에 남아 있던 것 등)라도
   * 최종 상태 하나는 그린다 — 안전망.
   */
  function playback(rep, onFrame) {
    clearTimers();
    var base = buildBase(rep);
    if (!base) { return; }
    var seq = base.seq;
    var atkStart = rep.atkStart || 6000, defStart = rep.defStart || 6000;
    var wallFrom = rep.wallFrom != null ? rep.wallFrom : base.maxWall;
    var guard = function (fn) { return function () { if (seq === rebuildSeq) { fn(); } }; };
    /* 화면(diorama)만 그리던 자리에 콜백을 하나 더한다(2026-09-10) — showBattle()
       의 HUD(.rstat 숫자)가 여태 시작 vs 끝만 보여주고 합·라운드 중간은 안 바뀌던
       것을, 개입형 실시간 전투처럼 실시간으로 갱신하기 위해서다. 판정은 없다,
       renderLive() 에 먹이는 값을 그대로 한 번 더 넘길 뿐이다 */
    function frame(state) { renderLive(rep, base, state); if (onFrame) { onFrame(state); } }

    /* 0) 붙기 전 — 온전한 두 진 */
    frame({ atk: atkStart, def: defStart, wall: wallFrom, duelPhase: null });
    var delay = PAUSE_MS;

    /* 1) 일기토 — 합마다 실제로 공격·피격 동작을 주고받다가 끝나면 승패 자세로
       (2026-09-10 전엔 깃발 색만 바뀌었다). 합마다 `hits[i]`를 클로저로 붙잡아
       `duelHit`로 넘긴다 — 어느 쪽이 그 합에 맞았는지(who) 그대로 옮길 뿐이다.
       카메라도 이 구간만 두 장수 가까이 붙었다가(`duelCamActive`, tick() 참고)
       라운드(무리) 전투가 시작하면 다시 넓은 그림으로 돌아간다 — 실제 판정과
       무관한 연출이다. 합마다 부딪히는 소리(`sfx.js`'duel'`)도 같이 낸다 */
    duelCamActive = !!rep.duel;
    if (rep.duel) {
      var hits = rep.duel.hits || [];
      for (var i = 0; i < hits.length; i++) {
        (function (hit) {
          schedule(guard(function () {
            frame({ atk: atkStart, def: defStart, wall: wallFrom,
              duelPhase: 'progress', duelHit: hit });
            var SFX = global.DG.sfx;
            if (SFX) { SFX.play('duel'); }
          }), delay);
        })(hits[i]);
        delay += HIT_MS;
      }
      schedule(guard(function () {
        frame({ atk: atkStart, def: defStart, wall: wallFrom, duelPhase: 'done' });
      }), delay);
      delay += PAUSE_MS;
      schedule(guard(function () { duelCamActive = false; }), delay);
    }

    /* 2) 라운드 — war.js 가 남긴 합별 스냅샷을 그대로 순서대로. 무리가
       실제로 부딪힌 순간이라 `roundTick`을 얹어 카메라 훅·무리 밀림·부딪히는
       소리(`round_clash`)를 같이 켠다(2026-09-10) */
    var frames = rep.frames || [];
    var duelDone = rep.duel ? 'done' : null;
    for (var fi = 0; fi < frames.length; fi++) {
      (function (f, r) {
        schedule(guard(function () {
          frame({ atk: f.atk, def: f.def, wall: f.wall, duelPhase: duelDone, roundTick: true, r: r });
          var SFX = global.DG.sfx;
          if (SFX) { SFX.play('round_clash'); }
        }), delay);
      })(frames[fi], fi + 1);
      delay += ROUND_MS;
    }

    /* 3) 마지막 — frames 가 없던 옛 리포트까지 포함해 최종 수치로 못박는다 */
    schedule(guard(function () {
      var finalAtk = atkStart - (rep.lossA || 0), finalDef = defStart - (rep.lossD || 0);
      frame({ atk: finalAtk, def: finalDef, wall: rep.wallTo, duelPhase: duelDone });
    }), delay);
  }

  /** 밖에서 부르는 단 하나의 입구 — `rtk:battle` 리포트 하나를 그대로 재생한다.
   *  `onFrame(state)`(선택) — ui-rtk.js 가 화면 밖 HUD(숫자)를 같은 박자로
   *  갈아 끼우고 싶을 때 넘긴다. 안 넘기면 예전과 똑같이 디오라마만 돈다 */
  function render(rep, onFrame) {
    if (!rep || !ensureInit()) { return; }
    playback(rep, onFrame);
    resize();
    startLoop();
  }

  /**
   * **개입형 실시간 전투** 용 — `war.marchInteractive()` 가 합마다 끊어 부르므로
   * 여기서도 미리 정해진 재생(`playback`)이 아니라 그때그때 `showState()` 로
   * 한 걸음씩 그린다. 땅·성은 한 번만 짓고(`buildBase`), 그 뒤로는 `showState()`
   * 만 호출한다 — `render()`(예전 요약 재생)와는 다른 입구다.
   * @param repStub {to,water,force,defForce,atkStart,defStart,duel,wallFrom}
   * @returns base — showState() 에 그대로 넘긴다. 실패하면 null
   */
  function beginLive(repStub) {
    if (!repStub || !ensureInit()) { return null; }
    duelCamActive = false;   // 이 경로는 근접 연출을 안 쓴다(위 duelCamActive 주석 참고)
    clearTimers();
    var base = buildBase(repStub);
    if (base) { buildArmy(repStub, base.h); }
    lastTickT = -1;
    resize();
    startLoop();
    return base;
  }

  /** beginLive() 로 세운 자리에 한 순간(state)을 그린다 — 새 판정은 안 한다 */
  function showState(repStub, base, state) {
    if (!base) { return; }
    renderLive(repStub, base, state);
  }

  function startLoop() {
    if (loopRunning) { return; }
    loopRunning = true;
    requestAnimationFrame(tick);
  }

  /** 카메라 손잡이를 새로 두지 않는다 — 천천히 저절로 돈다.
   *  일기토 장수(`duelActors`)가 서 있으면 매 프레임 실제로 움직인다
   *  (`duelWant`가 바뀔 때만 동작을 바꿔 타지만, mixer 는 계속 갱신해야
   *  끊기지 않고 부드럽게 이어진다 — 그래서 여기, 매 프레임에 있다) */
  var lastBattleT = 0, lastTickT = -1, camC = { x: 0, z: 1 };
  function tick(now) {
    if (!active()) { loopRunning = false; clearTimers(); return; }
    /* 화면에 보이는 채로 다른 창을 쓰는 중이면 렌더를 쉰다 — 안 그러면
       천천히 도는 카메라만으로도 계속 GPU 를 잡아먹는다(2026-09-08) */
    if (document.hidden || !document.hasFocus()) {
      global.setTimeout(function () { requestAnimationFrame(tick); }, 500);
      return;
    }
    /* 발열(2026-09-24) — 60 상한(손잡이 perf.fps). 120Hz 폰에서 초당 120번 그리던 헛그림만 막는다 */
    var bNow = performance.now(), bfps = global.DG.core && global.DG.core.tuned ? global.DG.core.tuned('perf.fps', 60) : 60;
    if (bfps > 0 && bNow - lastBattleT < 1000 / bfps - 2) { requestAnimationFrame(tick); return; }
    lastBattleT = bNow;
    spin += 0.004;
    var tNow = (now || 0) / 1000, dtA = lastTickT < 0 ? 0 : Math.min(0.1, Math.max(0, tNow - lastTickT));
    lastTickT = tNow;
    if (army) { stepArmy(dtA, tNow); }
    /* 라운드 충격 — 부딪힐 때마다 살짝 훅 당겼다가(dist 를 살짝 줄인다) 풀린다.
       tick() 는 렌더 직전에 한 번만 도니 여기서 감쇠도 같이 한다 */
    roundPulse *= 0.85;
    if (roundPulse < 0.01) { roundPulse = 0; }
    var lunge = roundPulse * 0.6;
    if (atkGroupRef) { atkGroupRef.position.z = 4.2 - lunge; }
    if (defGroupRef) { defGroupRef.position.z = -3.0 + lunge; }
    /* 무리 병사 몸짓 — 합이 부딪힌 뒤 TROOP_HIT_S 동안 치고, 나머지는 대기 */
    var A3t = asset3d(), tT = (now || 0) / 1000, freshRound = troopGen !== tickTroopGen;
    tickTroopGen = troopGen;
    if (freshRound) { troopHitAt = tT; }
    var troopAnim = (tT - troopHitAt) < TROOP_HIT_S ? 'attack' : 'idle';
    [atkGroupRef, defGroupRef].forEach(function (grp) {
      var ts = grp && grp.userData.troops, ti;
      if (!ts || !A3t || !A3t.step) { return; }
      for (ti = 0; ti < ts.length; ti++) {
        A3t.step(ts[ti], { t: tT + ti * 0.37, anim: troopAnim, force: freshRound });
      }
    });

    var dist = 13 - roundPulse * 1.2;
    var wideX = Math.sin(spin) * dist, wideY = 8.5, wideZ = Math.cos(spin) * dist - 1;
    var lookX = 0, lookY = 3, lookZ = -2;
    if (army) {
      /* 실시간 전장 — 맞붙은 자리를 따라가며 공격군 오른쪽 뒤에서 낮게 본다(천천히 좌우로 흔들린다).
         세로 화면(폰)이면 한 발 물러난다 — 양쪽 군이 다 들어오게 */
      var ac = armyCenter();
      camC.x += (ac.x - camC.x) * Math.min(1, dtA * 1.5);
      camC.z += (ac.z - camC.z) * Math.min(1, dtA * 1.5);
      var ang = 0.75 + Math.sin(tNow * 0.08) * 0.35, far = (camera.aspect < 1 ? 15 : 10.5) - roundPulse * 0.6;
      wideX = camC.x + Math.sin(ang) * far; wideY = camera.aspect < 1 ? 8 : 5.6; wideZ = camC.z + Math.cos(ang) * far;
      lookX = camC.x; lookY = 0.9; lookZ = camC.z - 0.8;
      if (duelActors) { leadFollow(dtA); }
    }

    /* 일기토 근접 샷 — 진짜 판정과 무관한 연출뿐이다. camBlend 를 목표값
       (0=넓은 그림·1=근접) 쪽으로 매 프레임 살살 당겨 뚝 끊기지 않게 한다 */
    var camTarget = (duelCamActive && duelActors) ? 1 : 0;
    camBlend += (camTarget - camBlend) * 0.12;
    if (camBlend > 0.01) {
      var closeX = 0.9, closeY = 1.35, closeZ = 1.9;
      var lookWx = lookX, lookWy = lookY, lookWz = lookZ;
      var lookCx = 0, lookCy = 0.85, lookCz = 0.2;
      camera.position.set(
        wideX + (closeX - wideX) * camBlend,
        wideY + (closeY - wideY) * camBlend,
        wideZ + (closeZ - wideZ) * camBlend
      );
      camera.lookAt(
        lookWx + (lookCx - lookWx) * camBlend,
        lookWy + (lookCy - lookWy) * camBlend,
        lookWz + (lookCz - lookWz) * camBlend
      );
    } else {
      camera.position.set(wideX, wideY, wideZ);
      camera.lookAt(lookX, lookY, lookZ);
    }

    /* 성벽 붕괴 흔들림 — 카메라를 한 번 더 흔든다(위 wide/근접 블렌드가 이미
       잡아 둔 자리 위에 얹는다). 라운드 충격(dist)보다 눈에 띄어야 하는
       드문 사건이라 실제로 흔든다(위치를 지터) */
    wallShake *= 0.80;
    if (wallShake < 0.01) { wallShake = 0; }
    if (wallShake > 0 && SHAKE_ON()) {
      camera.position.x += (Math.random() - 0.5) * wallShake * 0.5;
      camera.position.y += (Math.random() - 0.5) * wallShake * 0.3;
    }
    stepDebris();

    flashA *= 0.82; flashD *= 0.82;
    if (flashA < 0.01) { flashA = 0; }
    if (flashD < 0.01) { flashD = 0; }
    if (duelActors) {
      var nowT = (now || 0) / 1000;
      var A3 = asset3d();
      var freshHit = duelGen !== tickDuelGen;
      tickDuelGen = duelGen;
      A3.step(duelActors.a, { t: nowT, anim: duelWant.a, force: freshHit });
      A3.step(duelActors.d, { t: nowT, anim: duelWant.d, force: freshHit });
      if (duelActors.a) { setFlash(duelActors.a.userData.flashMats, flashA); }
      if (duelActors.d) { setFlash(duelActors.d.userData.flashMats, flashD); }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  global.DG = global.DG || {};
  global.DG.battle3d = {
    /** 싸움터 땅(§12) — 순수 함수, 진단이 값으로 본다 */
    battleLook: battleLook, available: available, render: render, beginLive: beginLive, showState: showState,
    /** 실시간 전장(Q9) — 명령·끝 자세(그림뿐)와 진단용 들여다보기 */
    setStance: setStance, armyEnd: armyEnd, armyCount: armyCount,
    armyView: function () {
      if (!army) { return null; }
      var v = function (l) { return { n: l.length, alive: l.filter(function (s) { return s.alive; }).length,
        engaged: l.filter(function (s) { return s.alive && s.engaged; }).length, bodies: l.filter(function (s) { return s.dressed; }).length }; };
      return { a: v(army.a), d: v(army.d), stance: army.stance, end: army.end, wallUp: army.wallUp, sortie: army.sortie, center: armyCenter() };
    },
    /** 확인용 — 그림 시뮬만 sec 초 앞당긴다(1/30초씩, 판정 없음). 헤드리스는 초당 한두 프레임이라 병사가 거의 안 걷는다 */
    simArmy: function (sec) { for (var k = 0; army && k < sec * 30; k++) { stepArmy(1 / 30, (lastTickT < 0 ? 0 : lastTickT) + k / 30); } } };
})(window);
