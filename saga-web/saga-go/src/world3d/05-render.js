  /* ── 카메라 · 빛 ──────────────────────────────────────────
   * 시점 버튼(2D → 2.5D → 3D)이 **각도**를 정한다. 원작의 3D 는 카메라가 낮게
   * 깔려 건물 옆면이 보이는 각이라, 3D 모드에서 가장 눕는다.
   */
  var camPos = null, camLook = null;

  /**
   * 카메라가 어디서 무엇을 볼지 — 순수 계산이라 진단이 따로 굴려 본다.
   *
   * 거리는 **사람이 화면에서 차지하는 몫**으로 정했다. 원작에서 아바타는 화면 높이의
   * 1/8쯤이다 — 그보다 크면 인형놀이가 되고 작으면 누군지 안 보인다. 키 3.4m 를
   * 화각 52°로 담으려면 27m 쯤 물러나야 한다(처음엔 16m 라 얼굴이 화면을 채웠다).
   *   2D    거의 머리 위에서 (예전 탑다운과 같은 그림)
   *   2.5D  비스듬히 내려다본다
   *   3D    낮게 깔려 건물 옆면이 보인다 — 원작의 그 각
   */
  var CAM_HIGH_MUL = [2.27, 1.33, 0.80];    // 카메라 높이 배수
  var CAM_BACK_MUL = [0.05, 0.40, 0.60];    // 뒤로 물러나는 거리 배수
  var CAM_AHEAD = [0, 3, 5];                // 시선을 앞으로 던지는 거리(m)

  /** 조우 무대 — 대상 앞 몇 미터에 서서 눈높이로 본다 (원작의 포획 화면).
      거리는 **상대 키에 비례**한다: 사람과 뿔낙지를 같은 자리에서 보면
      하나는 얼굴이 화면을 채우고 하나는 발치에 놓인다 */
  function STAGE_DIST() { return core.tuned('world3d.stageDist', 10.5); }
  /** 교전 상대가 실제로 서 있을 때(`duelFoe`) 카메라가 다가서는 거리 —
      `stage` 보다 낮고 옆에서 본다(둘 다 한 화면에 담아야 한다) */
  function DUEL_DIST() { return core.tuned('world3d.duelDist', 9); }

  function camAim(pos, mode, focus, stage, zoom, battle, yaw, duel) {
    var z = (zoom === undefined || !isFinite(zoom) || zoom <= 0) ? 1 : zoom;
    var yw = yaw || 0;
    /* 교전이 열리면 **약간 줌인**한다(PLAN 23절). 무대(stage)처럼 자리를 통째로
       옮기지는 않는다 — 싸움은 내가 선 자리에서 벌어지고, 카메라만 다가선다 */
    if (battle) { z = z * 0.62; }
    if (!stage && duel) {
      /* 실제 상대가 3D 로 서 있으면(`world3d.duelStage()`) **둘을 옆에서 가까이**
         담는다 — 위에서 내려다보는 기본 구도로는 화면 한복판의 카드에 다 가려진다.
         무대(`stage`)의 "무릎께" 구도와 달리 상대가 아니라 **둘 사이**를 축으로 삼는다 */
      var mx = (pos.x + duel.x) / 2, my = (pos.y + duel.y) / 2;
      var ddx = duel.x - pos.x, ddy = duel.y - pos.y;
      var dlen = Math.max(0.5, Math.hypot(ddx, ddy));
      var px = -ddy / dlen, pz = ddx / dlen;   // 둘을 잇는 선에 수직 — 옆에서 본다
      var DD = DUEL_DIST();
      /* 마을 한복판에서 걸리면 이 낮고 가까운 자리가 **집 안**일 수 있다
         (2026-08-30, 실기기 대신 스크린샷으로 확인하다 발견 — 벽 속에서
         찍은 듯한 그림이 떴다). 반대편을 대신 써 보고, 그마저 막히면 낮게
         깔지 않고 기본 카메라처럼 높이 물러난다(막힌 벽보다 먼 그림이 낫다) */
      var CAM_MARGIN = 7;      // 카메라는 벽에서 이만큼은 떨어져야 근접 절단면이 안 보인다
                                // (지붕은 벽보다 넓게 튀어나오므로 바닥 사각형만으론 부족하다 — 넉넉히 잡는다)
      var side1 = { x: mx + px * DD, z: my + pz * DD };
      var side2 = { x: mx - px * DD, z: my - pz * DD };
      var pick = !duelSpotBlocked(side1.x, side1.z, CAM_MARGIN) ? side1 :
        (!duelSpotBlocked(side2.x, side2.z, CAM_MARGIN) ? side2 : null);
      if (pick) {
        return { pos: { x: pick.x, y: DD * 0.55, z: pick.z }, look: { x: mx, y: 2.2, z: my } };
      }
      /* 마을 한복판이 너무 빽빽해 양옆 다 막히면(2026-08-30, 실제로 찍어서
         걸린 자리를 재현했다 — 낮은 재시도까지 벽에 박혔다) **낮게 다가서는
         것 자체를 포기한다.** 아래 `focus` 구도(늘 안전하다고 확인된, 멀리서
         내려다보는 그림)를 그대로 따라 쓴다 — 상대(`duel`)를 `focus` 자리로
         그대로 꽂아 넣는다 */
      var dback = CAM_DIST() * CAM_BACK_MUL[mode] * z;
      var dhigh = CAM_HIGH() * CAM_HIGH_MUL[mode] * Math.pow(z, 1.12);
      var fdx = duel.x - pos.x, fdy = duel.y - pos.y;
      var flen = Math.max(1, Math.hypot(fdx, fdy));
      var fux = fdx / flen, fuy = fdy / flen;
      var fspan = Math.min(dback * 2.2, Math.max(dback, flen * 0.9));
      return {
        pos: { x: pos.x - fux * fspan * 0.7 - fuy * fspan * 0.45,
               y: dhigh * 0.72,
               z: pos.y - fuy * fspan * 0.7 + fux * fspan * 0.45 },
        look: { x: mx, y: 2.0, z: my }
      };
    }
    if (stage) {
      /* 나와 대상을 잇는 선 위에서, **대상 쪽에서 나를 향해** 물러선 자리다.
         무대에서는 시점 모드를 안 본다 — 조우는 어느 시점에서 열었든 같은 그림이어야 한다 */
      var sx = pos.x - stage.x, sy = pos.y - stage.y;
      var slen = Math.max(0.5, Math.hypot(sx, sy));
      var sh = stage.h || 3.2;
      var D = STAGE_DIST() * (sh / 3.2);
      return {
        pos: { x: stage.x + sx / slen * D, y: sh * 0.95, z: stage.y + sy / slen * D },
        /* 무릎께를 본다 — 상대가 화면 위쪽에 서고 아래는 조우 카드 자리가 된다 */
        look: { x: stage.x, y: sh * 0.45, z: stage.y }
      };
    }
    /* 멀리 물러날수록 **더 내려다본다** — 거리와 높이를 같은 비율로 늘리면
       지평선만 잔뜩 보이고 발밑이 안 보인다 */
    var back = CAM_DIST() * CAM_BACK_MUL[mode] * z;
    var high = CAM_HIGH() * CAM_HIGH_MUL[mode] * Math.pow(z, 1.12);
    if (focus) {
      /* 나와 대상 사이를 본다. 카메라는 **내 뒤 옆쪽**에 서서 둘을 한 화면에 담는다 */
      var dx = focus.x - pos.x, dy = focus.y - pos.y;
      var len = Math.max(1, Math.hypot(dx, dy));
      var ux = dx / len, uy = dy / len;
      /* 멀리 있는 대상이면 더 물러나되 **상한을 둔다** — 조우는 코앞에서만 열리지만
         (ENCOUNTER_RANGE) 데모처럼 먼 대상을 걸면 카메라가 200m 밖으로 날아간다 */
      var span = Math.min(back * 2.2, Math.max(back, len * 0.9));
      return {
        pos: { x: pos.x - ux * span * 0.7 - uy * span * 0.45,
               y: high * 0.72,
               z: pos.y - uy * span * 0.7 + ux * span * 0.45 },
        look: { x: (pos.x + focus.x) / 2, y: 2.0, z: (pos.y + focus.y) / 2 }
      };
    }
    /* **돌려 보기**(PLAN 7·26절 "마우스/터치 회전") — 카메라를 나를 축으로 돌린다.
       보는 곳은 그대로 내 앞이라, 돌려도 **내가 화면 한가운데** 남는다 */
    var cs = Math.cos(yw), sn = Math.sin(yw);
    var ax = 0, az = back;                       // 안 돌렸을 때 카메라가 서는 자리
    var ahead = CAM_AHEAD[mode];
    return {
      pos: { x: pos.x + ax * cs - az * sn, y: high, z: pos.y + ax * sn + az * cs },
      look: { x: pos.x + ahead * sn, y: mode === 0 ? 0.5 : 2.4, z: pos.y - ahead * cs }
    };
  }

  /**
   * 건물 가림 — 오픈월드 RPG처럼 **카메라가 벽 앞으로 당겨 온다**(PLAN §5 ⑯ 곁, 2026-09-24 사용자 "건물 근처로 가면
   * 캐릭터가 안 보여"). 집은 인스턴스로 그려 한 채만 반투명하게 할 수 없어서, 광선 대신 벽 충돌과 같은
   * 사각형(`houseRects`, 키 h 를 실었다)으로 잰다 — 머리(P)에서 카메라(C)로 가는 선이 집 몸통에
   * **지붕보다 낮게** 들어가면, 들어가는 자리 조금 앞(t)까지 당긴다. 순수 함수 — 진단이 값으로 붙든다.
   *   P·C = {x, y, z}(three 좌표, y 가 위) · rects = [{x, z, w, d, rot, h, base}] → t(0.2~1, 1 = 안 가림)
   * 보이는 GLB 는 키로 고르게 늘여 벽 사각형보다 넓다 — 반폭은 max(w/2, 키×0.45)로 넉넉히 잡는다.
   */
  function camOcclude(P, C, rects) {
    var best = 1, i;
    for (i = 0; i < rects.length; i++) {
      var r = rects[i];
      var c = Math.cos(r.rot || 0), sn = Math.sin(r.rot || 0);
      function loc(x, z) { var dx = x - r.x, dz = z - r.z; return [dx * c + dz * sn, -dx * sn + dz * c]; }
      var a = loc(P.x, P.z), b = loc(C.x, C.z);
      var hx = r.exact ? r.w / 2 : Math.max(r.w / 2, r.h * 0.45), hz = r.exact ? r.d / 2 : Math.max(r.d / 2, r.h * 0.45);   // exact = 산봉우리 원뿔(W-0113) — 폭 그대로
      var t0 = 0, t1 = 1, k, lo = [-hx, -hz], hi = [hx, hz], ok = true;
      for (k = 0; k < 2 && ok; k++) {
        var d = b[k] - a[k];
        if (Math.abs(d) < 1e-9) { if (a[k] < lo[k] || a[k] > hi[k]) { ok = false; } continue; }
        var u0 = (lo[k] - a[k]) / d, u1 = (hi[k] - a[k]) / d;
        if (u0 > u1) { var tmp = u0; u0 = u1; u1 = tmp; }
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
        if (t0 > t1) { ok = false; }
      }
      if (!ok || t0 <= 0 || t0 >= 1) { continue; }      // 안 지나거나, 머리가 이미 몸통 안(벽에 붙음)
      var y = P.y + (C.y - P.y) * t0, top = (r.base || 0) + r.h;
      if (y < top && t0 < best) { best = t0; }
    }
    return best >= 1 ? 1 : Math.max(0.2, best - 0.04);
  }
  function OCCLUDE_ON() { return core.tuned('world3d.camOcclude', 1) ? true : false; }
  /** 내 둘레 3×3 칸의 집 — 땅 높이(base)를 붙인다(산비탈 마을) */
  function rectsNear(x, y) {
    var gx0 = Math.floor(x / GRID), gy0 = Math.floor(y / GRID), gx, gy, rs, i, out = [];
    for (gy = gy0 - 1; gy <= gy0 + 1; gy++) {
      for (gx = gx0 - 1; gx <= gx0 + 1; gx++) {
        rs = houseRects(gx, gy); if (global.DG.world.terrainAt(gx, gy) === 'mount') { rs = rs.concat([{ x: gx * GRID + GRID / 2, z: gy * GRID + GRID / 2, w: GRID * 0.5, d: GRID * 0.5, rot: 0, h: (14 + h1(gx * 3 + 1, gy * 5 + 2) * 22) * 0.75, exact: true }]); }   // W-0113 산봉우리도 가린다
        for (i = 0; i < rs.length; i++) { if (rs[i].h) { rs[i].base = groundY(rs[i].x, rs[i].z); out.push(rs[i]); } }
      }
    }
    return out;
  }
  var occlT = 1, occlAcc = 9, occlRects = [], occlCell = null;

  function syncCamera(W, dt) {
    var pos = core.save.player.pos;
    /* ⑲-13 이야기 대화 — 듣는 이 어깨 너머에서 말하는 이 얼굴을 본다(talkface.talkAim). 끝나면 아래 보통 구도로 따라 돌아온다 */
    var TS = stageAt ? null : talkShot();
    /* 조우 무대에서는 줌을 무시한다 — 무대는 늘 같은 그림이어야 한다 */
    /* ⑲-22 활 조준 — 오른 어깨 너머에서 겨눈 쪽을 본다(대화·조우 무대가 먼저) */
    var FCv = global.DG.fieldCombat, AV = !TS && !stageAt && FCv && FCv.aimView ? FCv.aimView() : null;
    var aim = TS ? global.DG.talkface.talkAim(TS.spk, TS.lst, ACTOR_H()) : (AV ? aimCam(pos, AV, ACTOR_H()) : camAim(pos, W.tiltMode, focusLive(), stageAt,
      stageAt ? 1 : W.zoom3d, battleOn, stageAt ? 0 : yaw, duelFoe));
    /* **카메라와 시선도 땅을 따라 오른다.** 안 그러면 산에 오를 때 카메라가
       제자리에 남아 땅이 화면을 덮고, 골짜기에서는 하늘만 보인다.
       `camAim` 은 평면 기준으로 값을 내므로 여기서 땅 높이만 얹는다 —
       그쪽은 순수 함수로 남겨 둔다(자가진단이 값으로 붙들고 있다) */
    var camLift = groundY(aim.pos.x, aim.pos.z);
    var lookLift = groundY(aim.look.x, aim.look.z);
    /* 활공(§5 ⑰ 다음) — 몸이 땅 위 수십 m 를 나는 동안은 카메라·시선도 몸 높이를 따라간다 */
    var LFc = global.DG.landform;
    if (LFc && ((LFc.gliding && LFc.gliding()) || meSky() || (LFc.onPole && LFc.onPole()))) {     // ⑲-20 섬 위·⑲-34 기둥 위에서도 몸 높이를 따른다
      var bodyY = standY(pos.x, pos.y) + LFc.airH();
      camLift = Math.max(camLift, bodyY); lookLift = Math.max(lookLift, bodyY);
    }
    var want = new T.Vector3(aim.pos.x, aim.pos.y + camLift, aim.pos.z);
    var look = new T.Vector3(aim.look.x, aim.look.y + lookLift, aim.look.z);
    /* 건물 가림(camOcclude) — 2.5D·3D 에서만(2D 는 머리 위라 안 가린다). 칸이 바뀔 때만 집을 다시 모으고,
       판정은 0.1초마다(폰 발열). 당길 때는 빨리, 풀 때는 천천히 — 벽 너머가 비치는 순간이 없게 */
    var occl = 1;
    if (OCCLUDE_ON() && W.tiltMode >= 1 && !stageAt) {
      var cellK = Math.floor(pos.x / GRID) + ':' + Math.floor(pos.y / GRID);
      if (cellK !== occlCell) { occlCell = cellK; occlRects = rectsNear(pos.x, pos.y); }
      occlAcc += dt;
      /* 대화 중에는 내 머리 대신 말하는 이 얼굴(시선)에서 잰다 */
      var hx = TS ? look.x : pos.x, hz = TS ? look.z : pos.y, hy = TS ? look.y : standY(pos.x, pos.y) + 1.7;
      if (occlAcc > 0.1 && occlRects.length) {
        occlAcc = 0;
        occlT = camOcclude({ x: hx, y: hy, z: hz }, { x: want.x, y: want.y, z: want.z }, occlRects);
      } else if (!occlRects.length) { occlT = 1; }
      occl = occlT;
      if (occl < 1) {
        want.set(hx + (want.x - hx) * occl, hy + (want.y - hy) * occl, hz + (want.z - hz) * occl);
      }
    }
    if (!camPos) { camPos = want.clone(); camLook = look.clone(); }
    /* 카메라는 곧바로 붙지 않고 따라온다 — 원작의 그 미끄러지는 느낌이다.
       교전 중에는 조금 더 빨리 붙는다(줌인이 굼뜨면 때리는 맛이 죽는다) */
    var k = occl < 1 ? Math.min(1, dt * 14) : (TS ? 1 - Math.exp(-7 * dt) : Math.min(1, dt * (battleOn ? 9 : 6.5)));   // 대화는 지수 7/초
    camPos.lerp(want, k);
    camLook.lerp(look, k);
    camera.position.copy(camPos);
    /* 흔들림 — **따라온 자리에 얹기만** 한다. camPos 자체를 흔들면 흔들림이
       다음 프레임의 출발점이 되어 카메라가 조금씩 밀려난다 */
    if (shakeAmp > 0.001 && !TS) {             // 대화 중엔 흔들림을 안 받는다
      var ph = frame * 1.9;
      camera.position.x += Math.sin(ph) * shakeAmp;
      camera.position.y += Math.sin(ph * 1.7 + 1.1) * shakeAmp * 0.6;
      camera.position.z += Math.cos(ph * 1.3) * shakeAmp;
      shakeAmp *= Math.pow(0.02, dt);            // 초당 50분의 1로 잦아든다
    } else { shakeAmp = 0; }
    camera.lookAt(camLook);
  }

  /* 크게 당기면 절두체에 사물이 다 들어와 그림자 맵이 감당하지 못한다.
     그 높이에서는 그림자가 몇 픽셀도 안 되니 **끄는 편이 낫다.**
     경계에서 한 번만 갈아 끼운다 — 프레임마다 바꾸면 셰이더를 다시 컴파일한다 */
  var shadowOn = true;
  function syncShadow(zoom) {
    var P = global.DG.perf;
    var want = zoom < 4 && !(global.DG_3D_DEBUG || {}).noShadow && (!P || P.shadowOk());
    if (want === shadowOn) { return; }
    shadowOn = want;
    renderer.shadowMap.enabled = want;
    scene.traverse(function (o) {
      if (o.isMesh && o.material) { o.material.needsUpdate = true; }
    });
  }

  function syncLight(dt) {
    var L = lightingAt(forcedMs === null ? undefined : forcedMs, weatherKey());
    lightNow = L;
    var pos = core.save.player.pos;
    /* 해는 늘 플레이어 곁을 따라다닌다 — 그림자 상자를 좁게 유지하려고.
       높이·방위만 시각이 정한다 */
    sun.position.set(pos.x + L.sun.x, L.sun.y, pos.y + L.sun.z);
    sun.target.position.set(pos.x, 0, pos.y);
    sun.target.updateMatrixWorld();
    sun.color.setHex(L.sun.hex);
    sun.intensity = L.sun.intensity;
    sky.color.setHex(L.hemi.sky);
    sky.groundColor.setHex(L.hemi.ground);
    /* 사건이 조명을 죽인다 — 태양·하늘빛만 낮추고(색은 그대로 두어 "밤인데
       더 어두워짐"으로 보이게 한다) 안개는 좁혀 "가까이만 보인다"를 낸다 */
    var dk = eventDark;
    sun.intensity = L.sun.intensity * (1 - dk * 0.55);
    sky.intensity = L.hemi.intensity * (1 - dk * 0.45);
    /* IBL 세기도 같은 낮·밤·날씨 곡선을 탄다 — 위 loadEnvironment() 머리말 참고 */
    if (scene.environmentIntensity !== undefined) {
      scene.environmentIntensity = sky.intensity * IBL_SCALE();
    }
    if (scene.background && scene.background.setHex) { scene.background.setHex(L.bg); }
    renderer.setClearColor(L.bg, 1);
    if (scene.fog) {
      scene.fog.color.setHex(L.bg);
      scene.fog.near = L.fog.near * (1 - dk * 0.5);
      scene.fog.far = L.fog.far * (1 - dk * 0.4);
    }
  }

  /* ── 그린다 ───────────────────────────────────────────── */

  /**
   * 화면에 낸다 — 후처리를 거치거나(있고 켜져 있을 때) 곧바로 그린다.
   * **두 길 다 톤매핑은 한 번 걸린다**(`post3d.js` 머리 참고).
   * 그리는 자리가 두 군데(여기와 hit-stop)라 함수로 묶었다 — 한쪽만 고치면
   * 멎는 동안 후처리가 벗겨져 화면이 껌뻑인다.
   */
  /* §6.1-B ① 재기(`?perf`) — 한 프레임에 그린 호출·삼각형을 **후처리 여러 번을 합쳐** 센다(평소엔 마지막 한 번만 남는다) */
  var PERF_ON = /[?&]perf\b/.test((global.location && global.location.search) || '');
  var glFrame = { calls: 0, tris: 0 };
  function present() {
    if (PERF_ON) { renderer.info.autoReset = false; renderer.info.reset(); }
    presentDraw();
    if (PERF_ON) { glFrame.calls = renderer.info.render.calls; glFrame.tris = renderer.info.render.triangles; }
  }
  function presentDraw() {
    var P3 = global.DG.post3d;
    if (P3) {
      if (P3.draw(renderer, scene, camera, lightNow)) { return; }
      /* 후처리가 켜졌다 꺼졌을 수 있다(등급이 LOW 로 내려간 순간).
         마지막으로 쓰던 렌더 타깃이 물려 있으면 캔버스가 검게 남는다 */
      renderer.setRenderTarget(null);
    }
    renderer.render(scene, camera);
  }

  var last = 0;

  /* `game.js` 의 루프는 `world.draw()`(→ 여기)를 부른 **뒤에** requestAnimationFrame
   * 을 다시 잡는다 — 그래서 이 함수 안에서 예외가 하나라도 새면 다음 프레임 자체가
   * 안 잡혀 이동·그리기·전투 무대까지 전부 그 자리에서 멎는다(2026-08-31, 실기기
   * 신고로 찾음). 안에 있는 개별 sync 들은 저마다 제 몫만 어긋나면 스스로 꺼지게
   * 감쌌지만, **여기서 한 번 더 통째로 막는다** — three.js 자체(예: 셰이더 컴파일)
   * 가 던지는 것까지는 개별 감싸기로 못 잡기 때문이다. 잡았을 땐 그린 그림이라도
   * 있어야 검게 안 깜빡이니 `present()` 를 한 번 더 시도한다(그마저 던지면 조용히 넘어간다) */
  function render() {
    if (!active()) { return false; }
    try {
      var W = global.DG.world;
      var now = performance.now();
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
      last = now;
      frame++;

      /* hit-stop — 큰 것이 꽂힌 순간 화면이 아주 잠깐 멎는다(PLAN 23절).
         **그린 것을 그대로 한 번 더 낸다** — 아무것도 안 그리면 검게 깜빡인다 */
      if (now < holdUntil) { present(); return true; }

      syncLight(dt);
      syncShadow(W.zoom3d || 1);
      syncGround(W);
      syncProps(W);
      syncLamps();
      syncSway(dt);
      syncFlame(dt);
      syncSmoke(dt);
      syncActors(W, now);
      sweepActors(dt);
      if (global.DG.encounter3d) { global.DG.encounter3d.tick(dt); }
      if (global.DG.battle3d) { global.DG.battle3d.tick(dt); }
      if (global.DG.sky3d) { global.DG.sky3d.tick(dt, lightNow); }
      if (global.DG.water3d) { global.DG.water3d.tick(dt, lightNow); }
      syncBeams(dt);
      syncClickMark(dt);
      syncCamera(W, dt);
      instCull();

      present();
      return true;
    } catch (err) {
      if (global.console) { console.error('[world3d] render() 에서 멎을 뻔해 한 프레임 건너뛴다', err); }
      try { present(); } catch (err2) { /* 그마저 안 되면 이번 프레임은 포기한다 */ }
      return true;
    }
  }

  /**
   * 세워 둔 소품을 통째로 지운다 — 다음 프레임에 다시 선다.
   * `prop3d` 가 GLB 를 다 받은 뒤 한 번 부른다: 그 한 번에 원뿔 나무가
   * 진짜 나무로 바뀐다. 인스턴스 덩이도 같이 비운다(빈 자리를 돌려받아야
   * 새 덩이가 창고를 나눠 쓴다).
   */
  function refreshProps() {
    if (!propGroup) { return 0; }
    var n = 0, k;
    for (k in propMeshes) {
      if (!Object.prototype.hasOwnProperty.call(propMeshes, k)) { continue; }
      instDrop(k);
      propGroup.remove(propMeshes[k]);
      n++;
    }
    propMeshes = {};
    townDens = {};
    smokeByKey = {};          // 통째로 다시 지으니 연기 창고도 같이 비운다
    propScan = null;          // 다음 프레임에 다시 훑는다
    return n;
  }

  /**
   * 세워 둔 배우(사람·짐승)를 통째로 지운다 — `actorOf` 가 한 번 지은 3D 배우는
   * 그대로 붙들고 있으므로, 등신 비례가 바뀌어도 이미 선 배우는 옛 비례 그대로
   * 남는다. 다음 프레임에 지금 비례로 다시 짓도록 비운다(게임.js 의 등신 버튼이
   * 부른다). 2D 빌보드 텍스처는 캐시 키에 등신이 이미 들어 있어 그냥 둬도
   * 저절로 새 비례로 바뀐다.
   */
  function resetActors() {
    if (!actorGroup) { return 0; }
    var n = 0, k;
    for (k in actors) {
      if (!Object.prototype.hasOwnProperty.call(actors, k)) { continue; }
      actorGroup.remove(actors[k].node);
      actorGroup.remove(actors[k].shadow);
      n++;
    }
    actors = {};
    return n;
  }

  global.DG = global.DG || {};
  /**
   * 인스턴스 창고 속 — **어느 덩이에 몇이 서 있나.**
   * "계획은 나오는데 화면에 없다" 를 가를 때 이것 하나면 끝난다(벼에서 밟았다).
   */
  function instReport(filter) {
    var out = [], k;
    for (k in instKinds) {
      if (!Object.prototype.hasOwnProperty.call(instKinds, k)) { continue; }
      if (filter && k.indexOf(filter) < 0) { continue; }
      var K = instKinds[k], m = K.mesh;
      var det = '';
      if (filter) {
        /* 걸러 볼 때는 **속까지** 본다 — 창고에는 있는데 화면에 없을 때
           보이지 않는 이유는 결국 이 넷 중 하나다 */
        var g = m.geometry, pa = g && g.getAttribute('position');
        m.updateMatrixWorld(true);
        var e = m.matrixWorld.elements;
        var m0 = new T.Matrix4();
        if (m.count > 0) { m.getMatrixAt(0, m0); }
        var p0 = new T.Vector3(), q0 = new T.Quaternion(), s0 = new T.Vector3();
        m0.decompose(p0, q0, s0);
        det = ' [보임' + (m.visible ? 1 : 0) +
          ' 재질' + (m.material && m.material.visible ? 1 : 0) +
          ' 투명' + (m.material && m.material.opacity !== undefined ? m.material.opacity : '?') +
          ' 정점' + (pa ? pa.count : '?') +
          ' 부모' + (m.parent ? m.parent.name || 'group' : 'none') +
          ' 월드' + e[12].toFixed(0) + ',' + e[13].toFixed(0) + ',' + e[14].toFixed(0) +
          ' 첫자리' + p0.x.toFixed(0) + ',' + p0.y.toFixed(1) + ',' + p0.z.toFixed(0) +
          ' 배율' + s0.x.toFixed(2) + ']';
      }
      out.push(k.split('/').pop() + '=' + K.n + '/' + m.count + det);
    }
    return out;
  }

  global.DG.world3d = {
    init: init, resize: resize, render: render, refreshProps: refreshProps,
    swapMotion: swapMotion,
    resetActors: resetActors,
    /** 인스턴스 창고 속을 들여다본다(진단·데모용). 이름 조각으로 걸러 볼 수 있다 */
    instReport: instReport,
    /** 배우 한 명의 실제 위치·상태를 들여다본다(진단용) — `actors['me']`·
     *  `'ally'`·`'petbuddy'`·`'duelfoe'` 등 */
    actorPos: function (key) {
      var a = actors[key];
      if (!a) { return null; }
      return {
        x: a.node.position.x, y: a.node.position.y, z: a.node.position.z,
        scale: a.node.scale.x, mesh: a.mesh, visible: a.node.visible
      };
    },
    actorKeys: function () { return Object.keys(actors); }, actorNode: function (key) { return actors[key] ? actors[key].node : null; },   // ㉑ 배우 마디 — weapon.js 무기 빛이 선두 외곽선 색만 고친다
    available: available, active: active, wanted: wanted, _landTex: function () { return LAND_TEX_VARIANTS; }, _iblSrc: iblSrc,   // W-0139 진단용
    /* 값을 내는 함수 — three 없이도 돈다(자가진단이 이것만 따로 본다) */
    lightingAt: lightingAt, propPlan: propPlan, urbanity: urbanity, camAim: camAim,
    /** 짓는 반경(R)·부수는 반경(UR, PLAN 42절) — 손잡이로 잡는다 */
    propRadius: PROP_R, unloadRadius: function () { return PROP_UR(PROP_R()); },
    /** 잔 사물이 진짜 모델을 받는 거리(PLAN 36절 LOD) — 손잡이로 잡는다 */
    lodNear: LOD_NEAR,
    /** 잎·풀 흔들림 켬/폭(PLAN 44절) — 손잡이로 잡는다 */
    swayOn: SWAY_ON, swayAmt: SWAY_AMT,
    /** 등롱·사당 불꽃·연기 켬(PLAN 44절) — 손잡이로 잡는다 */
    flameOn: FLAME_ON, flameAmt: FLAME_AMT, smokeOn: SMOKE_ON,
    houseRects: houseRects,
    camOcclude: camOcclude,
    /** 땅 높이(m) — 들판 전투가 예고 원·숫자를 땅에 붙일 때 쓴다 */
    groundY: groundY,
    /** ⑲-20 층을 아는 발 높이 — sky 를 안 주면 내 층(구름섬 위면 섬 윗면) */
    standY: standY,
    aimCam: aimCam,
    /** 지금 쓰는 시야각(도) — 진단·데모가 세로 화면 보정을 값으로 본다 */
    fov: function () { return camera ? camera.fov : FOV(); },
    forceTime: forceTime,
    /* 조우 무대 — `encounter3d.js` 가 켜고 끈다. 여기 있는 것은 **카메라와 자리**뿐이고
       링·사료·빛 같은 소품은 그쪽이 만들어 `addFx` 로 얹는다 */
    stage: function (o) {
      stageAt = o ? { x: o.x, y: o.y, uid: o.uid, lift: 0, back: 0 } : null;
      return stageAt;
    },
    stageAt: function () { return stageAt; },
    three: function () { return T; },
    addFx: function (n) { if (fxGroup && n) { fxGroup.add(n); } return n; },
    removeFx: function (n) { if (fxGroup && n) { fxGroup.remove(n); } },
    /** 클릭(탭)한 자리를 3D 바닥에도 표시 — `world.js`의 `onClick()`이 부른다 */
    clickMark: clickMark,
    camNode: function () { return camera; }, pickGround: pickGround,
    /** 돌려 보기 — 드래그가 두드린다(`world.js`). 라디안을 더한다 */
    turn: function (d) {
      if (talkShot()) { return yaw; }            // ⑲-13 대화 중엔 끌어 돌리기를 안 받는다
      yaw += d || 0;
      while (yaw > Math.PI) { yaw -= Math.PI * 2; }
      while (yaw < -Math.PI) { yaw += Math.PI * 2; }
      return yaw;
    },
    yaw: function (v) { if (v !== undefined) { yaw = v; } return yaw; },
    /* 전투 연출 손잡이 — `battle3d.js` 가 두드린다 (PLAN 23절) */
    battle: function (on) { battleOn = !!on; if (!on) { shakeAmp = 0; } return battleOn; },
    inBattle: function () { return battleOn; },
    /* 교전 상대를 실제로 세운다 — `battle3d.js` 가 duel:open/close 때 두드린다 */
    duelStage: duelStage, duelUnstage: duelUnstage, playAnim: playAnim,
    duelFoe: function () { return duelFoe; },
    /** 사건이 조명을 얼마나 죽이나(0~1) — `battle3d.js`가 `duel:open`·
     *  `duel:close`에서 두드린다. 인자 없이 부르면 지금 값만 읽는다 */
    eventMood: function (v) { if (v !== undefined) { eventDark = Math.max(0, Math.min(1, v)); } return eventDark; },
    /** 카메라를 흔든다. 세기는 m — 여러 번 부르면 센 쪽이 남는다 */
    shake: function (amp) { shakeAmp = Math.max(shakeAmp, amp || 0); return shakeAmp; },
    shakeAmp: function () { return shakeAmp; },
    /** 잠깐 멎는다(ms). 너무 길면 끊긴 것으로 보이므로 상한을 둔다 */
    hold: function (ms) {
      var v = Math.min(180, Math.max(0, ms || 0));
      holdUntil = Math.max(holdUntil, (global.performance ? performance.now() : 0) + v);
      return v;
    },
    lum: lum, GRID: GRID,
    /** 인스턴스 덩이 현황 (PLAN 16절) — 진단·데모가 값으로 본다 */
    instStats: instStats,
    instCullStats: function () { return { live: cullStat.live, drawn: cullStat.drawn, frames: cullStat.frames }; },
    /** 지면에 칠하는 땅 색 — 진단이 빠진 갈래가 없는지 본다 */
    LAND_COLOR: LAND_COLOR,
    /** 지금 조명 (데모·어드민이 들여다본다) */
    light: function () { return lightNow || lightingAt(undefined, weatherKey()); },
    /** 조우 연출을 밖에서 걸어 볼 때 (데모가 쓴다) */
    focus: function (o) { focusAt = o ? { x: o.x, y: o.y } : null; return focusAt; },
    beam: beam,
    /* 눈으로 확인할 때 쓰는 값 */
    /** 지면 타일이 어떤 상태인지 — 색·텍스처·위치를 그대로 뽑는다 */
    tileProbe: function () {
      var ks = Object.keys(tileMeshes);
      if (!ks.length) { return 'none'; }
      var out = [], i;
      for (i = 0; i < Math.min(3, ks.length); i++) {
        var m = tileMeshes[ks[i]];
        out.push(ks[i] + ':col=' + m.material.color.getHexString() +
          ' map=' + (m.material.map ? (m.material.map.image && m.material.map.image.width ? 'img' + m.material.map.image.width : 'empty') : 'no') +
          ' at=' + Math.round(m.position.x) + ',' + Math.round(m.position.z));
      }
      var lights = [];
      scene.traverse(function (o) { if (o.isLight) { lights.push(o.type + ':' + o.intensity.toFixed(2)); } });
      out.push('lights=' + lights.join('/'));
      return out.join(' | ');
    },
    /** 화면 몇 군데의 색을 직접 읽는다 — "검게 나온다" 를 눈이 아니라 값으로 본다 */
    probe: function () {
      if (!available()) { return 'n/a'; }
      var gl = renderer.getContext();
      var w = canvas.width, h = canvas.height;
      function at(px, py) {
        var b = new Uint8Array(4);
        gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
        return b[0] + ',' + b[1] + ',' + b[2];
      }
      /* WebGL 은 왼쪽 **아래**가 원점이다 */
      var read = 'top=' + at(w >> 1, h - 8) + ' mid=' + at(w >> 1, h >> 1) +
        ' bot=' + at(w >> 1, 8) + ' size=' + w + 'x' + h;
      /* 버퍼 읽기 경로가 멀쩡한지 — 마젠타로 지우고 곧바로 읽어 본다 */
      gl.clearColor(1, 0, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      read += ' clearTest=' + at(w >> 1, h >> 1);
      /* 카메라가 무엇을 보고 있는지 */
      read += ' near/far=' + camera.near + '/' + camera.far +
        ' look=' + (camLook ? [camLook.x, camLook.y, camLook.z].map(Math.round).join(',') : '-') +
        ' children=' + scene.children.length;
      return read;
    },
    /** §6.1-B ① 재기(`?perf` 표시가 0.5초마다 읽는다) — 한 프레임 호출·삼각형(`?perf` 일 때만 합산)·GPU 도형·텍스처·셰이더·캔버스 */
    glInfo: function () {
      if (!renderer) { return null; }
      var I = renderer.info;
      return { calls: PERF_ON ? glFrame.calls : I.render.calls, tris: PERF_ON ? glFrame.tris : I.render.triangles,
        geos: I.memory.geometries, texs: I.memory.textures, progs: I.programs ? I.programs.length : 0,
        w: canvas ? canvas.width : 0, h: canvas ? canvas.height : 0, dpr: renderer.getPixelRatio() };
    },
    /** §6.1-B ① 재기 — 씬 최상위 묶음마다 보이는 삼각형·메시 수(그림자 드리우는 몫 따로). 화면 밖 걸러내기 전 값 */
    triBreakdown: function (topN) {
      if (!scene) { return null; }
      var out = {}, byGeo = {};
      if (topN) {
        propGroup.traverseVisible(function (o) {
          if (!o.isMesh || !o.geometry) { return; }
          var g = o.geometry, c = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0), per = Math.round(c / 3);
          var k = g.uuid, e = byGeo[k] || (byGeo[k] = { name: (o.name || (o.parent && o.parent.name) || g.type).slice(0, 60), per: per, n: 0, inst: !!o.isInstancedMesh, cast: !!o.castShadow });
          e.n += o.isInstancedMesh ? o.count : 1;
        });
        out.top = Object.keys(byGeo).map(function (k) { var e = byGeo[k]; e.total = e.per * e.n; return e; })
          .sort(function (a, b) { return b.total - a.total; }).slice(0, topN);
      }
      scene.children.forEach(function (ch, i) {
        var key = ch === groundGroup ? 'ground' : ch === propGroup ? 'prop' : ch === actorGroup ? 'actor' : ch === fxGroup ? 'fx' : (ch.type + i);
        var tris = 0, cast = 0, meshes = 0;
        ch.traverseVisible(function (o) {
          if (!o.isMesh || !o.geometry) { return; }
          var g = o.geometry, c = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
          var t = Math.round(c / 3) * (o.isInstancedMesh ? o.count : 1);
          tris += t; meshes++; if (o.castShadow) { cast += t; }
        });
        if (tris) { out[key] = { tris: tris, cast: cast, meshes: meshes }; }
      });
      return out;
    },
    /** §6.1-B ① 재기 — 배우마다 삼각형 수(큰 것부터 n 개). 어느 몸이 GPU 를 잡아먹는지 본다 */
    heavyActors: function (n) {
      var out = [], a;
      for (a in actors) {
        if (!Object.prototype.hasOwnProperty.call(actors, a) || !actors[a].node) { continue; }
        var tris = 0, meshes = 0;
        actors[a].node.traverse(function (o) {
          if (!o.isMesh || !o.geometry) { return; }
          var g = o.geometry, c = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
          tris += Math.round(c / 3) * (o.isInstancedMesh ? o.count : 1); meshes++;
        });
        var bb = new T.Box3().setFromObject(actors[a].node), sz = bb.getSize(new T.Vector3());
        out.push({ key: a, kind: actors[a].kind, tris: tris, meshes: meshes, vis: actors[a].node.visible, size: [sz.x, sz.y, sz.z].map(function (v) { return +v.toFixed(1); }) });
      }
      out.sort(function (x, y) { return y.tris - x.tris; });
      return out.slice(0, n || 10);
    },
    stats: function () {
      var meshes = 0, a;
      for (a in actors) {
        if (Object.prototype.hasOwnProperty.call(actors, a) && actors[a].mesh) { meshes++; }
      }
      var drawn = 0;
      if (scene) { scene.traverse(function (o) { if (o.isMesh || o.isSprite) { drawn++; } }); }
      var L = lightNow;
      return {
        tiles: Object.keys(tileMeshes).length,
        props: Object.keys(propMeshes).length,
        actors: Object.keys(actors).length,
        meshActors: meshes,
        drawn: drawn,
        frames: frame,
        light: L ? (L.phase + ' ' + L.weather + ' 해' + L.sun.intensity.toFixed(2)) : '-',
        zoom: '×' + (global.DG.world.zoom3d || 1).toFixed(1),
        focus: focusAt ? (Math.round(focusAt.x) + ',' + Math.round(focusAt.y)) : '-',
        stage: stageAt ? (Math.round(stageAt.x) + ',' + Math.round(stageAt.y) +
          ' h' + (stageAt.h || 0).toFixed(1)) : '-',
        enc: (function () {
          var e = global.DG.encounter3d, st = e && e.state();
          return st ? (st.kind + '/' + st.phase + '/t' + st.t + '/사료' + st.pellet) : '-';
        })(),
        size: canvas ? (canvas.width + 'x' + canvas.height) : '-',
        cam: camera ? ([camera.position.x, camera.position.y, camera.position.z]
          .map(function (v) { return Math.round(v); }).join(',')) : '-',
        /* §6.1-B ① 재기 — 그리기 호출·삼각형(마지막 render 한 번)·GPU 에 올린 도형·텍스처·셰이더 수 */
        gl: renderer ? { calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
          geos: renderer.info.memory.geometries, texs: renderer.info.memory.textures,
          progs: renderer.info.programs ? renderer.info.programs.length : 0 } : null,
        failed: failed, ready: ready, wanted: wanted(),
        ibl: scene ? ((scene.environment ? 'on×' + (scene.environmentIntensity || 0).toFixed(2) : 'off')) : '-'
      };
    }
  };
})(window);
