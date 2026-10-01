  /* ── 한 프레임 ───────────────────────────────────────── */

  function render() {
    if (!active()) { return false; }
    var run = d().raw();
    if (!run) { return false; }
    frame++;
    updatePerf();
    /* 렌더러가 이미 서 있을 때만 — init() 전에는 손댈 게 없다.
       `enabled` 만 바꾸면 되고, 매 프레임 대입해도 three.js 쪽에서 값이
       같으면 그냥 넘어가니 "등급이 바뀔 때만" 을 따로 가리지 않았다. */
    if (renderer) { renderer.shadowMap.enabled = SHADOW(); }

    /* PLAN §28-8(오픈월드 A안, 2026-09-06 Phase 4에서 찾음) — 마을은 이제
       `run.player`·`room.npcs`·`room.marks`·`shots`·`foeShots`가 전부
       **세계 좌표**(앵커 포함)다. 그런데 이 3D 장면(바닥·벽·들판 땅)은
       처음부터 **방 하나 로컬 좌표**(0..ROOM_W, 0..ROOM_H 안팎)로 지어
       왔고 바꾸지 않았다 — 그게 맞다, `buildRoom()`/`buildField()`를 24개
       마을마다 다른 좌표로 다시 짓는 것보다 훨씬 싸다(방 자체는 마을마다
       똑같이 생겼으니). 대신 **화면(이 파일)이 세계 좌표를 읽는 자리마다
       앵커를 빼 로컬로 되돌린다** — 카메라·빛·플레이어·NPC·표식·투사체
       전부. 앵커가 (0,0)인 모루골만 우연히 맞았고(로컬==세계), 나머지
       23개 마을은 카메라가 세계 좌표(예: 갈대나루 스폰 근방 5190,480)를
       그대로 보라고 지시받는데 바닥·벽은 로컬(560,380) 언저리에 그대로
       있어 화면 전체가 새까맣게 나오는 회귀였다(CDP로 실측 — 넓은 창에서
       갈대나루·절차 생성 마을 전부 재현, 모루골만 정상). 던전은 `run.anchor`
       가 없어(항상 undefined) `{0,0}`으로 떨어지므로 회귀 없음. */
    var anc = run.anchor || { x: 0, y: 0 };
    var p0 = run.player;
    var p0x = p0.x - anc.x, p0y = p0.y - anc.y;   // 세계 → 로컬(위 anc 주석)
    /* 고정 세계 지도(§5.12) — 마을·들판의 들판 묶음은 세계 좌표로 지어 두고 묶음째
       앵커만큼 민다. 앵커가 바뀌어도(마을 사이를 걸어도) 다시 지을 필요가 없다 */
    var wmNow = worldFieldOn(run);
    if (fieldGroup) { fieldGroup.position.set(wmNow ? -anc.x : 0, 0, wmNow ? -anc.y : 0); }

    var W = d().ROOM_W, H = d().ROOM_H;
    /* 지형 높낮이(2026-09-06 실기기 제보 — "바닥 높낮이 때문에 캐릭터가
       다 가려짐") — 나·적·마을 사람은 지금까지 늘 y=0 에 그려졌는데,
       `buildField()`가 세우는 방 밖 들판 땅은 `heightAt()`로 기복이 진다
       (언덕에 올라서면 땅이 캐릭터보다 위로 솟아 캐릭터가 파묻힌 것처럼
       가려졌다). **`buildField()`가 쓰는 것과 정확히 같은 seed 산식**이어야
       그림(땅)과 액터가 같은 높이를 본다 — 다르면 "보이는 땅과 선 높이가
       어긋나는" 새 버그가 생긴다. 방 안(늘 0)에서는 이 값이 늘 0이라
       회귀가 없다. */
    var terrF = global.DG.field3d;
    var terrDD = global.DG.dataDungeon;
    var terrTh = run.theme || (terrDD ? terrDD.themeOf(run.floor) : null);
    var terrSeed = terrF ? terrF.seedOf(run.floor, run.roomIdx, terrTh && terrTh.name) : 0;
    function groundYAt(gx, gz) { return terrF ? terrF.heightAt(gx, gz, terrSeed, W, H) : 0; }
    /* 퍼즐방은 제단이 켜질 때마다(맞게 밟을 때마다) 그림도 다시 세워야 한다 —
       `rk` 에 진행도를 안 넣으면 데이터는 바뀌어도 화면은 그대로 남는다 */
    var pzProg = (run.room && run.room.puzzle) ? ':pz' + run.room.puzzle.progress : '';
    /* 이벤트방(구출)도 같은 사정이다 — 풀려난 순간 갇힌 우리 그림을 갈아 끼운다 */
    var capProg = (run.room && run.room.captive) ? (':cap' + (run.room.captive.freed ? 1 : 0)) : '';
    /* 비밀(POI: Secret)도 마찬가지 — 찾은 순간 반짝임을 얹어야 한다 */
    var secFound = 0;
    if (run.room && run.room.decor) {
      for (var sdi = 0; sdi < run.room.decor.length; sdi++) {
        if (run.room.decor[sdi].secret && run.room.decor[sdi].found) { secFound = 1; break; }
      }
    }
    /* 채집·낚시방도 같은 사정 — 약초를 뜯거나 못에서 손맛을 보면 그림도
       다시 세워야 한다(안 그러면 뜯은 풀이 그대로 남아 보인다) */
    var forageProg = '';
    if (run.room && run.room.forage) {
      var fgp = run.room.forage, fgPicked = 0;
      for (var fgpi = 0; fgpi < fgp.herbs.length; fgpi++) { if (fgp.herbs[fgpi].picked) { fgPicked++; } }
      forageProg = ':fg' + fgPicked + (fgp.pond && fgp.pond.used ? 'p1' : 'p0');
    }
    /* PLAN §57 — 마을은 rk가 (town/roomIdx/cleared 등) 절대 안 바뀌는 값들
       뿐이라, buildField()가 스폰 근방(cx,cz -R..R, 늘 anc=0 중심)에 딱
       한 번만 세워졌다. 스폰에서 그 반경(R) 밖으로 걸어 나가면 애초에
       세운 적 없는 자리라 바닥이 통째로 빈다(실기기 재현: PLAN.md 참고).
       anc(마을 앵커)는 그대로 두고(바꾸면 heightAt/chunkAt의 seed 산식이
       전부 anc-상대 로컬 좌표를 먹어 "고쳐 지을 때마다 언덕이 들썩이는"
       새 버그가 난다 — PLAN §57이 이미 이 함정을 적어 뒀다) 대신 **buildField가
       짓는 창(-R..R)의 중심을 플레이어 쪽으로 옮겨 다시 짓는다.** 창 중심을
       fldStep(=R-2, 최소 1) 단위로 반올림해 rk에 실어 두면, 플레이어가 그
       버킷 절반(fldStep/2 ≤ R-2) 이상 벗어날 때만(=아직 이전 창 안에
       있을 때 미리) 다시 짓는다 — 매 프레임 다시 짓는 낭비도, 창 가장자리에
       닿고 나서야 뒤늦게 짓는 틈도 없다. */
    var fldR = (terrF && FIELD()) ? fieldVisR(run) : 0;
    /* 2026-09-08 — "움직이면 계속 끊긴다" 실기기 제보. LOW 등급(FIELD_R()=2)
       에서는 이 값이 max(1, 2-2)=1 칸(200유닛)뿐이라, 절반(100유닛)만
       걸어도 창을 벗어나 buildField()가 다시 걸린다 — 가벼우라고 낮춘 LOW가
       오히려 재구성을 가장 자주 부르는 역설이었다. 최소 2칸으로 넉넉히
       잡아 저사양일수록 더 자주 재구성하는 역전을 없앤다. */
    var fldStep = Math.max(2, fldR - 1);
    var fldCx0 = 0, fldCz0 = 0;
    if (terrF && FIELD()) {
      /* 세계 지도 판은 창 중심도 세계 칸으로 — 앵커가 바뀌어도 창이 안 튄다 */
      fldCx0 = Math.round(Math.round((wmNow ? p0.x : p0x) / terrF.CHUNK) / fldStep) * fldStep;
      fldCz0 = Math.round(Math.round((wmNow ? p0.y : p0y) / terrF.CHUNK) / fldStep) * fldStep;
    }
    /* 2026-09-08 — buildField() 자체는 위 프레임 예산제 커밋으로 가벼워졌는데도
       "이동하면 계속 끊긴다" 제보가 실기기(PC·폰 둘 다)에서 이어졌다. 범인은
       옆에서 같이 걸리던 **buildRoom()** — 옛 `rk` 하나에 방 정체성과 들판 창
       위치(`:fw...`)를 같이 실어 뒀던 탓에, **방을 나간 적도 없는데 걸어서
       들판 창만 옮겨도 벽·바닥 텍스처를 다시 잡고 상자/우물/사당 GLB 를
       다시 클론**했다(방마다 한 번이면 될 무거운 동기 작업이 한 칸 걸을
       때마다 반복). 방 정체성(roomKey)과 들판 창(fieldWinKey)을 갈라
       buildRoom()/prefetchActors() 는 **방이 실제로 바뀔 때만** 돈다. */
    var roomRk = (run.town ? 'town' : run.floor) + ':' + run.roomIdx + ':' +
             (run.room && run.room.cleared ? 'c' : 'o') + pzProg + capProg + ':sec' + secFound + forageProg;
    var fwRk = (wmNow ? 'w' : '') + fldCx0 + '_' + fldCz0;
    var roomChanged = (roomRk !== roomKey);
    if (roomChanged) {
      roomKey = roomRk;
      lastFrameHadBuild = true;
      var roomT0 = nowMs();
      try {
        prefetchActors(run); buildRoom(run);
      } catch (e) {
        if (global.console) { console.warn('[던전 3D] 방을 다시 짓다가 실패 — 이번 칸은 옛 그림 그대로 둔다', e); }
        try {
          var emsg2 = String((e && e.message) || e);
          if (core && core.emit && !fieldBuildErrShown[emsg2]) {
            fieldBuildErrShown[emsg2] = true;
            core.emit('toast', '⚠️ 방 재구성 실패: ' + emsg2.slice(0, 140));
          }
        } catch (e3) { /* 토스트 자체가 죽어도 렌더는 계속 이어간다 */ }
      }
      lastRoomBuildMs = nowMs() - roomT0;
    }
    /* 2026-09-07 — "이동할 때마다 화면이 갈색(배경)이 된다"(PC·모바일 둘 다)
       제보. 들판 창이 걸을 때마다(칸 경계를 넘을 때마다) 다시 걸리는데,
       여기가 던지면 **이번 칸은 옛 그림 그대로 두고 카메라·렌더는 그대로
       이어간다** — 그 프레임은 `renderer.render()`까지 항상 가게. 메시지별
       1회만 띄워 도배를 막는다. */
    /* 세계 지도 판끼리(마을→마을·마을→들판)는 방이 바뀌어도 들판은 같은 세계라
       창이 그대로면 다시 짓지 않는다 — 창이 옮겨가면 뒤에서 짓고 갈아 끼운다 */
    var wmStay = wmNow && lastFieldWm === true;
    if ((roomChanged && !wmStay) || fwRk !== fieldWinKey) {
      fieldWinKey = fwRk;
      lastFrameHadBuild = true;
      var fieldT0 = nowMs();
      try {
        buildField(run, fldCx0, fldCz0, wmStay || !roomChanged);
      } catch (e) {
        if (global.console) { console.warn('[던전 3D] 들판을 다시 짓다가 실패 — 이번 칸은 옛 그림 그대로 둔다', e); }
        try {
          var emsg3 = String((e && e.message) || e);
          if (core && core.emit && !fieldBuildErrShown[emsg3]) {
            fieldBuildErrShown[emsg3] = true;
            core.emit('toast', '⚠️ 지형 재구성 실패: ' + emsg3.slice(0, 140));
          }
        } catch (e4) { /* 토스트 자체가 죽어도 렌더는 계속 이어간다 */ }
      }
      lastFieldSetupMs = nowMs() - fieldT0;
    }
    /* buildField()는 이제 창만 정해 두고, 실제 짓기는 매 프레임 예산만큼만
       나눠 진행한다(위 fieldJobStep 주석) — 위 if가 안 돈 프레임에도 진행 중인
       공사가 있으면 계속 이어야 하므로 if 블록 밖, 매 프레임 부른다. */
    fieldJobStep();
    /* GLB 도착(네트워크 콜백, rAF 밖)이 몰아 놓은 buildHero() 조립(retarget
       포함, asset3d.js 참고)을 프레임당 하나씩만 흘려보낸다 — fieldJobStep과
       같은 예산제 요령. */
    if (AS()) { AS().tick(); }
    /* 잎·풀 흔들림 시계(PLAN §6.1-5 나머지 절반, sway3d.js) — 이 render()는
       dt 를 안 들고 있어(위 AS().tick()과 같은 사정) sway3d 가 스스로 잰다 */
    if (global.DG.sway3d) { global.DG.sway3d.tick(); }

    /* 조명 */
    var L = lightPlan(run.floor, run.room && run.room.kind, DARK());
    amb.intensity = L.ambient;
    amb.color.setHex(L.ambientHex);
    /* **다섯 번째 재조사(2026-09-04)의 진짜 원인** — `HemisphereLight`는
       하늘쪽(`.color`)·땅쪽(`.groundColor`) 색을 따로 갖는데, 바로 위 줄은
       하늘쪽만 매 프레임 방 밝기에 맞춰 갈아 끼우고 **땅쪽은 init()의
       `0x0a0a0c`(거의 검정)에 그대로 박혀 있었다.** 위를 보는 면(바닥)은
       하늘쪽 색을 거의 그대로 받아 밝지만, 옆·아래를 보는 면(벽·비탈진
       소품)은 그 짙게 박힌 땅쪽 색과 섞여 방향광이 안 닿는 쪽에서 거의
       새까매진다 — 카메라 거리·그림자맵·SSAO 어느 것과도 무관해서(순수
       반구광 계산 문제) 줌·그림자 끄기·SSAO 끄기 전부 안 먹혔던 것이다.
       마을처럼 하늘쪽이 밝은 방일수록 이 어긋남이 도드라진다(땅쪽만
       계속 어두우니까). 땅쪽도 하늘쪽 절반 밝기로 같이 따라가게 한다 —
       완전히 맞추면(둘 다 동일) 벽의 입체감(면마다 다른 밝기)이 사라져
       밋밋해지므로, 여전히 하늘보다는 어둡게 두어 방향성은 살린다. */
    /* 마을은 어둠 자체를 없앴으니(위 lightPlan town 가지) 땅쪽도 하늘쪽만큼
       그대로 밝게 — 여기서 절반을 검게 섞으면 그 결정이 도로 무효가 된다. */
    amb.groundColor.setHex(L.town ? L.ambientHex : mix(L.ambientHex, 0x000000, 0.5));
    key.intensity = L.keyIntensity;
    key.color.setHex(L.keyHex);
    /* 그림자 카메라(±520, 위 init 참고)는 방 크기에 맞춘 상자라 방 밖
       들판까지는 안 덮는다 — 그 상자 밖에 있는 조각은 그림자맵 텍스처를
       가장자리로 clamp해 읽어 "그림자 진 것"으로 잘못 판정된다(three.js의
       방향광 그림자 흔한 함정). 그 결과가 필드에서 본 "각진 새까만 사각형"
       버그였다(2026-09-04, 사용자 제보로 발견) — 방 중심에 고정해 두던
       빛의 위치·과녁을 **플레이어를 따라가게** 바꿔 상자 자체를 늘 플레이어
       둘레에 두면, 들판 어디를 걷든 그 자리는 늘 상자 안이라 이 문제가
       안 생긴다. 빛과 과녁 사이의 상대 위치(각도)는 그대로 유지한다. */
    key.target.position.set(p0x, 0, p0y);
    key.position.set(p0x + (W * 0.3 - W / 2), 260, p0y + (H * 0.1 - H / 2));
    key.target.updateMatrixWorld();
    /* 맞으면 · 위태로우면 바탕과 안개가 붉어진다 (3단계) */
    var FX = global.DG.fx3d;
    var lowHp = run.hpMax ? core.clamp((0.34 - run.hp / run.hpMax) / 0.34, 0, 1) : 0;
    var bgHex = FX ? FX.hurtTint(L.bgHex, p0.hurt, lowHp) : L.bgHex;
    if (FX) { amb.color.setHex(FX.hurtTint(L.ambientHex, p0.hurt, lowHp * 0.6)); }

    /* 안개 거리를 **실제로 세운 들판 반경**(`FIELD_R()`, 등급마다 다르다)을
       넘지 않게 누른다. `lightPlan()`이 못박은 안개값(마을 far 2100 등)이
       세운 땅의 가장자리보다 훨씬 멀면, 안개가 다 가리기도 전에 땅이 먼저
       끊겨 그 자리가 배경색 그대로 드러난다 — **네 번째 재조사(2026-09-04)
       진짜 원인**. 마을은 조명이 밝아(`lightPlan`의 town 가지) 안 가려진
       가장자리 땅이 거의 원래 밝기 그대로 보이다가 뚝 끊기니 "각진 새까만
       사각형"으로 도드라졌다 — LOW 등급(`FIELD_R()`=2, 가장자리 500)은
       안개 시작(near 620)보다도 세운 땅이 짧아 아예 안개를 한 번도 못
       거치고 끊겼다. 세운 가장자리에서 **정확히** 안개가 다 덮이게 맞춘다. */
    var fogNear = L.fog.near, fogFar = L.fog.far;
    if (FIELD()) {
      var F2 = global.DG.field3d;
      if (F2) {
        /* fieldVisR(run) 을 쓴다 — 통로 있는 마을은 buildField()가 이미 그만큼
           더 세우므로(PLAN §28-2 Phase 3), 안개도 같이 물려야 "세운 가장자리 =
           안개가 다 덮는 자리" 라는 위 대전제가 안 깨진다. 던전 층은 corridors가
           없어 fieldVisR(run) === FIELD_R() — 이 줄만으로는 회귀가 없다. */
        var builtEdge = (fieldVisR(run) + 0.5) * F2.CHUNK;
        fogFar = Math.min(fogFar, builtEdge);
        fogNear = Math.min(fogNear, builtEdge * 0.4);
        if (fogNear >= fogFar) { fogNear = fogFar * 0.4; }
      }
    }
    var p = run.player;
    var plx = p.x - anc.x, ply = p.y - anc.y;   // 세계 → 로컬(위 anc 주석)
    var meGroundY = groundYAt(plx, ply);
    torch.intensity = L.torchIntensity;
    torch.color.setHex(L.torchHex);
    torch.distance = L.torchRange;
    torch.position.set(plx, meGroundY + 46, ply);

    var moveTgt = d().moveTarget ? d().moveTarget() : null;
    if (moveTgt) {
      var mtx = moveTgt.x - anc.x, mty = moveTgt.y - anc.y;
      moveMark.position.set(mtx, groundYAt(mtx, mty) + 2, mty);
      moveMark.visible = true;
      var pulse = 1 + Math.sin(nowMs() / 140) * 0.14;
      moveMark.scale.set(pulse, pulse, pulse);
    } else {
      moveMark.visible = false;
    }

    var AS3 = AS();
    var nowT = Date.now() / 1000;

    var actorsT0 = nowMs();
    /* 나 */
    var me = actorOf('me', 'me', null);
    me.node.position.set(plx, meGroundY, ply);
    /* 걷는 방향을 그대로 돌린다 — 예전엔 `p.facing`(좌우 ±1)만 봐서 위·아래로
       걸어도 몸은 늘 옆(왼쪽/오른쪽)만 보고 있었다. `p.dirX`·`p.dirY`(마지막
       이동 방향, 스킬 방향과 같은 값)를 쓰면 적·NPC 가 나를 볼 때 쓰는
       `atan2(dx, dy)`와 같은 결로 앞·뒤·대각선까지 다 돈다. */
    if (p.walking) { me.ang = Math.atan2(p.dirX || (p.facing || 1), p.dirY || 0.001); }
    me.node.rotation.y = me.ang;
    /* 걸으면 위아래로 튄다 — 도형으로 남아 있을 때만 도드라진다(GLB 는 제 다리로 걷는다).
       땅 높이(meGroundY) 위에 얹는다 — 안 그러면 언덕에서 튈 때마다 땅 밑으로 파고든다 */
    me.node.position.y = meGroundY + (p.walking ? Math.abs(Math.sin(p.phase || 0)) * 2.2 : 0);
    /* 탈것(mount.js) — 말·학·용은 발밑에 서고 나는 그 등 높이에 앉는다. 뜬 탈것은 HOVER 만큼 띄워 출렁 */
    var MT3 = global.DG.mount, mtRef = MT3 && MT3.active && MT3.active() ? MT3.bodyRef() : null;
    if (mtRef) {
      var mtA = actorOf('mount', 'mount', mtRef), bob = MT3.flying() ? Math.sin(nowT * 3) * 1.6 : 0;
      mtA.node.position.set(plx, meGroundY + MT3.mountLift() + bob, ply);
      if (p.walking || MT3.flying()) { mtA.ang = me.ang; }
      mtA.node.rotation.y = mtA.ang;
      me.node.position.y = meGroundY + MT3.lift() + bob;
      if (AS3) { AS3.step(mtA.node.userData.mixerNode, { t: nowT, walking: !!p.walking || MT3.flying(), anim: 'idle' }); }
    }
    if (AS3) {
      AS3.step(me.node.userData.mixerNode, { t: nowT, walking: !!p.walking && !mtRef,
        anim: p.dodge ? 'dodge' : (p.atkAnim > 0 ? (p.castAnim ? 'interaction' : 'attack') : (p.walking && !mtRef ? 'walk' : 'idle')) });
      AS3.flashAllMat(ensureFlash(me.node), p.hurt, 0.28);
    }

    /* 동행(同行, PLAN §51) — 부대 2번째 인물. 'me'와 같은 요령(걷는 방향
       회전·걸음 튐·GLB 애니메이션)을 그대로 따라간다. dungeon.js의
       updateCompanion()이 매 틱 c.x·c.y·c.dirX·c.dirY·c.walking·c.atkAnim을
       이미 판정 층에서 굴려 두므로, 여기(화면 층)는 그 값을 그대로 읽기만
       한다 — 새 판정을 만들지 않는다. */
    var c = run.companion;
    if (c) {
      var allyGroundY = groundYAt(c.x, c.y);
      var ally = actorOf('ally', 'ally', c);
      ally.node.position.set(c.x, allyGroundY, c.y);
      if (c.walking) { ally.ang = Math.atan2(c.dirX || (c.facing || 1), c.dirY || 0.001); }
      ally.node.rotation.y = ally.ang;
      ally.node.position.y = allyGroundY + (c.walking ? Math.abs(Math.sin(c.phase || 0)) * 2.2 : 0);
      /* §5.16 몸짓 — 서명 무예에 호응(❗)·보스·레벨업에 환호(🎉, 통통 튄다). 걷거나 치는 중이면 글자만 */
      var allyBase = c.atkAnim > 0 ? 'attack' : (c.walking ? 'walk' : 'idle');
      var allyG = GS() ? GS().plan('ally', nowT, allyBase, false) : null;
      if (allyG && allyG.bob) { ally.node.position.y += allyG.bob * 7; }
      gestureBubble(ally.node, allyG, 62);
      if (AS3) {
        AS3.step(ally.node.userData.mixerNode, { t: nowT, walking: !!c.walking, anim: allyG ? allyG.slot : allyBase });
      }
    }
    /* c가 없으면(부대 2번째 인물이 없는 회차) 그냥 actorOf('ally',...)를 이번
       프레임에 안 부른다 — sweep()가 "이번 프레임에 안 쓰인 배우"를 알아서
       치운다(아래), 여기서 따로 지울 함수를 안 만들어도 된다. */

    /* 적 */
    var es = (run.room && run.room.enemies) || [], i;
    for (i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.hp <= 0) {
        /* §5.19 쓰러짐 — 사라지지 않고 맞은 쪽으로 날아가 뒤로 넘어진 뒤 가라앉는다(잡졸 0.7초·정예/보스 1초).
           방향은 판정 층 kill() 이 남긴 dieDx/dieDy. 그림만 — 판정은 이미 끝났다 */
        if (e.dieDx === undefined) { continue; }
        if (e._dieT0 === undefined) { e._dieT0 = nowT; }
        var DIE = e.dieBig ? 1.0 : 0.7, du = (nowT - e._dieT0) / DIE;
        if (du > 1) { continue; }
        /* §5.19 2차 흩어짐 — dieF(세게 맞을수록 멀리·높이)·dieSpin(공중에서 빙글) 은 판정 층 dieScatter() 가 남긴다 */
        var dF = e.dieF || 1;
        var fly = (e.dieBig ? 10 : 28) * dF * (1 - (1 - du) * (1 - du));
        var dxw = e.x + e.dieDx * fly, dyw = e.y + e.dieDy * fly;
        var da3 = actorOf('e' + i + ':' + (e.ref && e.ref.id), 'foe', e);
        da3.node.rotation.order = 'YXZ';
        da3.node.rotation.y = Math.atan2(-e.dieDx, -e.dieDy) + (e.dieSpin || 0) * Math.min(1, du * 1.6) * 4;
        da3.node.rotation.x = -Math.min(1, du * 1.8) * 1.35;
        da3.node.position.set(dxw, groundYAt(dxw, dyw) + Math.sin(Math.min(1, du * 1.6) * Math.PI) * (e.dieBig ? 3 : 10) * Math.min(1.6, dF) -
          (du > 0.72 ? (du - 0.72) / 0.28 * 8 : 0), dyw);
        if (AS3) { AS3.step(da3.node.userData.mixerNode, { t: nowT, walking: false, anim: 'death' }); }
        continue;
      }
      /* 세계 보스(§5.4) 부위 파괴 — 키에 부서진 부위를 섞어 넣으면 부서질
         때마다 actorOf 가 새 몸(새 look)을 짓는다. sweep() 이 옛 키를
         "이번 프레임에 안 보였다"로 알아서 치운다 — 수동 정리 필요 없다. */
      var wbk = e.worldBoss ? (':' + (e.wbWeaponBroken ? 1 : 0) + (e.wbArmorBroken ? 1 : 0) + (e.wbHelmBroken ? 1 : 0)) : '';
      var a = actorOf('e' + i + ':' + (e.ref && e.ref.id) + wbk, 'foe', e);
      a.node.position.set(e.x, groundYAt(e.x, e.y), e.y);
      a.node.rotation.y = Math.atan2(p.x - e.x, p.y - e.y);
      a.node.rotation.x = 0;
      /* 맞은 직후에는 흔들린다 · §5.19 움찔(hit 모션)은 0.28초 — 판정의 80ms 플래시로는 모션이 안 보였다 */
      if (e.hurt > 0) { a.node.position.x += (Math.random() - 0.5) * 3; e._hitUntil = nowT + 0.28; }
      if (AS3) {
        /* 어그로(2026-09-10) — 아직 못 알아챈 적은 사거리 판정과 무관하게
           'idle'(마을 NPC와 같은 이름, 아래 townMark 자리와 같은 결)이다.
           안 그러면 안 쫓아오는데 걷는 시늉만 제자리서 계속하는 것처럼 보인다. */
        var eWalking = e.aggro && Math.hypot(p.x - e.x, p.y - e.y) > (e.r || 12) + (d().P_R || 13) + 8;
        var eAnim = (e.hurt > 0 || nowT < (e._hitUntil || 0)) ? 'hit' : (!e.aggro ? 'idle' : (eWalking ? 'walk' : 'attack'));
        AS3.step(a.node.userData.mixerNode, { t: nowT, walking: eWalking, anim: eAnim });
        /* §5.8① 피격 플래시 80ms(2026-09-18) — span 을 e.hurt 초기값(dungeon.js
           strike() 의 0.08)과 맞춰야 최고 밝기(1.0)에 실제로 닿는다 */
        AS3.flashAllMat(ensureFlash(a.node), e.hurt, 0.08);
        if (e.shade) { ensureShade(a.node); }
      }
    }

    /* 마을 사람과 표식 — 던전 방에는 없는 것들이다(`room.npcs` · `room.marks`).
       판정은 이미 이 둘을 방 안에 놓아 두었다 — 여기서는 세우기만 한다. */
    var TW = global.DG.town;
    var talkR = (TW && TW.TALK_R) || 40;
    var ns = (run.room && run.room.npcs) || [];
    for (i = 0; i < ns.length; i++) {
      var np = ns[i];
      var na = actorOf('n' + np.key, 'npc', np);
      na.node.position.set(np.x - anc.x, 0, np.y - anc.y);
      na.node.rotation.y = Math.atan2(p.x - np.x, p.y - np.y);   // 다가서면 나를 본다(둘 다 세계 좌표라 차는 그대로)
      townMark(na.node, Math.hypot(np.x - p.x, np.y - p.y), talkR);
      /* §5.16 몸짓 — 닿으면 인사(👋), 연 시트에서 일을 보면 제 일 몸짓(🔨 벼림…), 틈틈이 혼자 일한다 */
      var npG = GS() ? GS().plan(np.key, nowT, 'idle', true) : null;
      gestureBubble(na.node, npG, 70);
      if (AS3) { AS3.step(na.node.userData.mixerNode, { t: nowT, walking: false, anim: npG ? npG.slot : 'idle' }); }
    }
    var mks = (run.room && run.room.marks) || [];
    for (i = 0; i < mks.length; i++) {
      var mo = mks[i];
      var ma = actorOf('m' + mo.key, 'mark', mo);
      ma.node.position.set(mo.x - anc.x, 0, mo.y - anc.y);
      var mDist = Math.hypot(mo.x - p.x, mo.y - p.y);
      townMark(ma.node, mDist, talkR);
      if (mo.key.indexOf('exit_') === 0) {
        maybePrefetchCorridor(run, mo, p);
      }
    }
    maybePrefetchDoorTex(run, p);   // PLAN §28-4 Phase 4 — 마을엔 run.corridors에 laneAt이 없어 그대로 넘어간다
    maybePrefetchNearbyTowns(run, p);   // PLAN §28-8 후속 — 표식이 아니라 마을 발판과의 거리로, 던전은 !run.town이라 안 걸림

    /* 바닥의 전리품 — 등급색으로 빛나는 낮은 조각 */
    var ds = (run.room && run.room.drops) || [];
    for (i = 0; i < ds.length; i++) {
      var dp = ds[i];
      var da = actorOf('d' + i, 'drop', null);
      /* 자리(i)는 같아도 떨어진 물건이 바뀌면 다시 짓는다 — 옛 색이 남던 것 */
      if (!da.node.userData.built || da.node.userData.ref !== dp) {
        while (da.node.children.length) { da.node.remove(da.node.children[0]); }
        box(da.node, 0, 3, 0, 12, 6, 12, dropHex(dp), 'glow', false);
        var bm = lootBeam(dp);
        if (bm) { da.node.add(bm); }
        da.node.userData.built = true;
        da.node.userData.ref = dp;
      }
      da.node.position.set(dp.x, 0, dp.y);
      da.node.rotation.y = frame * 0.02;
    }

    /* 기공파 — 판정이 굴리는 투사체를 그대로 세운다 */
    var ss = run.shots || [];
    for (i = 0; i < ss.length; i++) {
      var sh = ss[i];
      var sa = actorOf('s' + i, 'shot', null);
      if (!sa.node.userData.built) {
        while (sa.node.children.length) { sa.node.remove(sa.node.children[0]); }
        /* 알과 꼬리. 재질은 사본이다 — 원소마다 색이 다르다 */
        var sc0 = box(sa.node, 0, 0, 0, 10, 10, 10, 0x9fe8ff, 'glow', false);
        var st0 = box(sa.node, 0, 0, -9, 6, 6, 22, 0x9fe8ff, 'glow', false);
        sa.node.userData.shotMat = [ownMat(sc0), ownMat(st0)];
        sa.node.userData.shotMat[1].transparent = true;
        sa.node.userData.shotMat[1].opacity = 0.45;
        sa.node.userData.built = true;
      }
      /* 원소 색은 판정이 이미 들고 있다 (shots[].color) */
      var shex = FX ? FX.shotHex(sh) : 0x9fe8ff;
      var sm = sa.node.userData.shotMat, sj;
      for (sj = 0; sm && sj < sm.length; sj++) {
        sm[sj].color.setHex(shex);
        if (sm[sj].emissive) { sm[sj].emissive.setHex(shex); }
      }
      sa.node.position.set(sh.x - anc.x, 22, sh.y - anc.y);
      sa.node.rotation.y = Math.atan2(sh.dx || 0, sh.dy || 0);
    }

    /* 궁수·조총병이 쏜 것 — 판정이 굴리는 그대로, 색만 기본을 다르게 둔다
       (몬스터 다양화 — 나에게 오는 화살이라는 걸 한눈에 가른다) */
    var fss = run.foeShots || [];
    for (i = 0; i < fss.length; i++) {
      var fsh = fss[i];
      var fa = actorOf('f' + i, 'shot', null);
      if (!fa.node.userData.built) {
        while (fa.node.children.length) { fa.node.remove(fa.node.children[0]); }
        var fc0 = box(fa.node, 0, 0, 0, 8, 8, 8, 0xe08a5a, 'glow', false);
        var ft0 = box(fa.node, 0, 0, -8, 4, 4, 18, 0xe08a5a, 'glow', false);
        fa.node.userData.shotMat = [ownMat(fc0), ownMat(ft0)];
        fa.node.userData.shotMat[1].transparent = true;
        fa.node.userData.shotMat[1].opacity = 0.45;
        fa.node.userData.built = true;
      }
      var fhex = FX ? FX.shotHex({ color: fsh.color || '#e08a5a' }) : 0xe08a5a;
      var fm = fa.node.userData.shotMat, fj;
      for (fj = 0; fm && fj < fm.length; fj++) {
        fm[fj].color.setHex(fhex);
        if (fm[fj].emissive) { fm[fj].emissive.setHex(fhex); }
      }
      fa.node.position.set(fsh.x - anc.x, 20, fsh.y - anc.y);
      fa.node.rotation.y = Math.atan2(fsh.dx || 0, fsh.dy || 0);
    }

    sweep();
    lastActorsMs = nowMs() - actorsT0;

    /* 카메라 — 회전은 막는다(8절). 부드럽게 따라온다 */
    /* 마을은 세로 폰 화면에서 너무 멀리·작게 보인다는 실기기 지적(2026-09-01)에
       맞춰 물러나는 폭을 줄였다 — 예전엔 기본 1.15배 + 세로 화면에서 최대 1.5배
       까지 더 물러났는데(1.15×1.5=1.725배), 마당(560×380) 전체를 한눈에 담으려던
       뜻이 지나쳐 사람이 개미만 해졌다. 지금은 기본은 던전과 같게 두고 세로
       화면에서만 최대 1.2배로 줄여 잡는다 — 여전히 화면비 보정은 하되 덜 물러난다.
       던전 쪽 거리는 그대로다(연출·조작 감각이 거기 맞춰져 있다). */
    var zNow = ZOOM() / USERZOOM();
    if (run.town) {
      var asp = camera.aspect || 1;
      zNow *= (asp < 1 ? Math.min(1.2, 1 / Math.max(0.7, asp)) : 1);
    }
    var aim = camAim(plx, ply, W, H, zNow, TILT(), !!run.town, meGroundY);
    /* 2026-09-08 — 실기기 로그로 실측: 화질이 진짜로 low 로 떨어질 때(가끔
       실제로 무거운 프레임이 있어 정당하게 떨어진다) low 의 안개 거리(500)가
       사용자가 확대·축소로 물러난 실제 카메라 거리(`aim.dist`, 줌에 따라
       500 을 훌쩍 넘을 수 있다)보다 짧으면, 카메라 자신이 이미 안개 너머에
       있는 꼴이라 화면 대부분이 배경색으로 덮인다 — "갈색이 화면을 가린다"
       제보의 실제 원인. 등급과 무관하게 **카메라가 서 있는 자리까지는 항상
       안개 밖**이게 최소 거리를 보장한다. */
    /* 2026-09-10 — 사용자가 "안개는 다 제거해"·"화면이 안보여"로 안개 자체를
       없애 달라고 요청했다. 위 fogNear/fogFar 계산(들판 가장자리에 맞추기·
       카메라가 늘 안개 밖에 있게 하기)은 그동안 반복된 "화면이 갈색/안
       보인다" 제보의 근본 원인이 전부 안개-카메라 거리 상호작용이었다 —
       안개 자체를 끄면 그 버그 부류가 통째로 없어진다. `scene.background`
       (하늘·배경색)는 안개와 별개라 그대로 둔다. 대신 들판 가장자리(세운
       땅이 끊기는 자리)가 이제 안개로 안 가려지므로 그 각진 경계가 보일
       수 있다 — 다음에 "땅 끝이 각져 보인다"는 제보가 오면 이 트레이드오프
       때문이다(안개를 다시 켜는 대신 땅을 더 넓게 세우는 쪽으로 풀 것). */
    scene.fog = null;
    scene.background = new T.Color(bgHex);
    if (frame % 120 === 0) {
      var diagMsg = '📊 tier=' + effectiveLevel() + ' ema=' + perfEma.toFixed(1) +
        'ms fogFar=' + fogFar.toFixed(0) + ' fieldR=' + fldR + ' camDist=' + aim.dist.toFixed(0) +
        ' room=' + lastRoomBuildMs.toFixed(1) + 'ms field=' + lastFieldSetupMs.toFixed(1) +
        'ms finalize=' + lastFieldFinalizeMs.toFixed(1) + 'ms';
      if (global.console) { console.log('[던전 3D 진단]', diagMsg); }
      /* 2026-09-08 — 이 셋을 안 지우면 "몇 초 전에 딱 한 번 있었던 값"이
         다음 줄에도 그대로 찍혀 "매번 다시 짓는다"는 착시를 준다(실기기
         로그에서 room=3.2ms가 7줄 내내 똑같이 찍힌 게 그 증거 — 이번 로그
         구간엔 방을 한 번도 안 나갔다는 뜻이었다). 찍고 나면 0으로 되돌려,
         다음 2초 구간에 실제로 안 일어나면 0으로 보이게 한다. */
      lastRoomBuildMs = 0; lastFieldSetupMs = 0; lastFieldFinalizeMs = 0;
    }
    var want = new T.Vector3(aim.pos.x, aim.pos.y, aim.pos.z);
    var look = new T.Vector3(aim.look.x, aim.look.y, aim.look.z);
    if (!camPos) { camPos = want.clone(); camLook = look.clone(); }
    else { rebaseCam(camPos, camLook, camAnc, anc); }
    camAnc = { x: anc.x, y: anc.y };
    camPos.lerp(want, 0.14);
    camLook.lerp(look, 0.14);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    var occT0 = nowMs();
    /* 카메라-캐릭터 사이 가림은 시각 보정용이라 60fps 로 다시 쏠 필요가
       없다 — 격프레임(30fps)으로도 안 티 난다(감사로 찾은 raycast 비용
       절감, 2026-09-08). 건너뛴 프레임은 지난 결과를 그대로 둔다. */
    if (frame % 2 === 0) { updateOcclusion(camera.position, plx, meGroundY + 44, ply); }
    lastOcclusionMs = nowMs() - occT0;
    var fxT0 = nowMs();
    if (FX) {
      /* 화면 흔들림 — 상한은 fx3d 가 진다 (51절) */
      var sk = FX.shakeAmt();
      if (sk > 0) {
        camera.position.x += (Math.random() - 0.5) * sk * 0.9;
        camera.position.y += (Math.random() - 0.5) * sk * 0.6;
        camera.updateMatrixWorld();
      }
      /* 연출은 카메라가 정해진 뒤에 앉힌다 */
      FX.step(run, d().fx(), camera);
    }
    lastFxMs = nowMs() - fxT0;

    /* 후처리를 거치거나(있고 켜져 있을 때) 곧바로 그린다 — 사가고 `world3d.js`
       의 `present()` 와 같은 꼴이다. **두 길 다 톤매핑은 한 번 걸린다**
       (`post3d.js` 머리 참고) */
    var presentT0 = nowMs();
    if (global.DG.fieldInstance && global.DG.fieldInstance.cull) { global.DG.fieldInstance.cull(camera, scene); }
    var P3 = global.DG.post3d;
    if (P3) {
      if (P3.draw(renderer, scene, camera, { alt: postAlt(L), weather: 'clear' })) {
        lastPresentMs = nowMs() - presentT0;
        return true;
      }
      /* 후처리가 켜졌다 꺼졌을 수 있다(등급이 LOW 로 내려간 순간) — 마지막으로
         쓰던 렌더 타깃이 물려 있으면 캔버스가 검게 남는다 */
      renderer.setRenderTarget(null);
    }
    renderer.render(scene, camera);
    lastPresentMs = nowMs() - presentT0;
    return true;
  }

  /**
   * 전리품 빛기둥(§5.9) — 명품 이상은 떨어진 자리에서 등급색 기둥이 선다(원작 3편).
   * 명품 옅고 짧게 · 보물 · 전설/고유 굵고 높게. 안개를 뚫게 fog:false.
   */
  function lootBeam(dp) {
    var it = dp && dp.kind === 'item' ? dp.item : null;
    var tier = it ? (it.tier || 0) : 0;
    if (!it || (tier < 2 && !it.uniq)) { return null; }
    var IT = global.DG.itemData || null, col = '#ffff64';
    try { col = (IT && IT.TIERS && IT.TIERS[tier]) ? IT.TIERS[tier].color : (tier >= 4 ? '#c7a76c' : (tier === 3 ? '#00c000' : '#ffff64')); } catch (e) { /* 색은 없어도 선다 */ }
    if (it.uniq) { col = '#f0a53a'; }
    var big = tier >= 4 || !!it.uniq, h = big ? 260 : (tier === 3 ? 180 : 110);
    var m = new T.Mesh(new T.CylinderGeometry(big ? 5 : 3.5, big ? 5 : 3.5, h, 10, 1, true),
      new T.MeshBasicMaterial({ color: new T.Color(col), transparent: true, opacity: big ? 0.42 : 0.28,
        depthWrite: false, fog: false, side: T.DoubleSide }));
    m.position.y = h / 2;
    m.renderOrder = 4;
    return m;
  }

  function dropHex(dp) {
    var it = dp && (dp.item || dp);
    var g = it && it.grade;
    var D = global.DG.data;
    if (g && D && D.rarity && D.rarity[g]) {
      return parseInt(String(D.rarity[g].color).replace('#', ''), 16);
    }
    return 0xd9d9e0;
  }

  /** 눈으로 확인할 때 */
  function stats() {
    if (!available()) { return { none: true, failed: failed }; }
    var drawn = 0;
    scene.traverse(function (o) { if (o.isMesh) { drawn++; } });
    var run = d().raw();
    return {
      ready: ready, failed: failed, wanted: wanted(), town: isTown(),
      drawn: drawn, actors: Object.keys(actors).length,
      room: roomKey, floor: run ? run.floor : 0,
      cam: camPos ? [Math.round(camPos.x), Math.round(camPos.y), Math.round(camPos.z)].join(',') : '-',
      fx: global.DG.fx3d ? global.DG.fx3d.stats() : null,
      quality: effectiveLevel(), perfEma: Math.round(perfEma * 10) / 10,
      shadow: SHADOW()
    };
  }

  global.DG = global.DG || {};
  global.DG.dungeon3d = {
    init: init, resize: resize, render: render,
    available: available, active: active, wanted: wanted,
    /* 값을 내는 함수 — three 없이도 돈다(자가진단이 이것만 따로 본다) */
    camAim: camAim, userZoom: USERZOOM, lightPlan: lightPlan,
    /** PLAN §7.1-2 — 앵커가 바뀐 프레임의 카메라 옮기기(순수 함수, 진단용) */
    _rebaseCam: rebaseCam,
    /** PLAN 19절 — 그래픽 품질 AUTO. ms 평균 → 등급의 순수 매핑(진단용) */
    autoLevelFor: autoLevelFor, quality: effectiveLevel,
    /** 2026-09-07 — 켤 때 시작 등급을 고르는 기기 점수 매김(진단용, 순수 함수) */
    _deviceScore: deviceScore, _startLevelFor: startLevelFor,
    fieldR: FIELD_R, fieldDens: FIELD_D, shadow: SHADOW,
    /** 자가진단용 — 실제 프레임 없이 이동평균을 강제로 넣어 등급이 바뀌는지 본다 */
    _setPerfEma: function (ms) { perfEma = ms; autoLevel = autoLevelFor(ms); },
    /** 들판이 몇 조각인지 (2단계) */
    fieldKey: function () { return fieldKey; },
    three: function () { return T; },
    addFx: function (n) { if (fxGroup && n) { fxGroup.add(n); } return n; },
    camNode: function () { return camera; },
    /** 손잡이 — 이 판에는 어드민이 없어 콘솔·데모가 두드린다 */
    set: set, tuned: tuned,
    stats: stats,
    /** PLAN §28-4 Phase 4 — 순수 함수만 자가진단에 내준다(T 없이도 돈다) */
    _doorPrefetchTargets: doorPrefetchTargets, _nextRoomFor: nextRoomFor,
    _pickTex: pickTex, _FLOOR_TEX: FLOOR_TEX, _WALL_TEX: WALL_TEX,
    /** 실측용(init() 뒤에만 의미 있다) — 실제 텍스처 요청 횟수·캐시 존재 여부 */
    _texLoadCount: function () { return texLoadCount; },
    /** PLAN §28-8 후속 — render()가 실제로 프리페치를 걸었는지(단순 순수
     *  함수 계산이 아니라 render() 안에서 진짜 불렀는지) 자가진단이 본다 */
    _prefetchedTownIds: function () { return Object.keys(prefetchedTowns); },
    _texCached: function (url) { return !!rawTexCache[url]; },
    /** 자가진단용 — 장비→겉모습(look) 순수 함수 (PLAN §28-8 후속) */
    _weaponLookOf: weaponLookOf, _helmLookOf: helmLookOf, _armorLookOf: armorLookOf,
    _meLookOf: meLookOf, _meRenderParams: meRenderParams,
    /** 외모 커스텀 화면 전용 — 'me' 배우는 매 프레임 "이번에도 보였나"만
     *  체크하고(sweep()) 다시 안 지어지므로(장비 갈아입어도 같다, 알려진
     *  한계), 스타일/색을 고른 직후에만 이걸로 명시적으로 다시 짓는다. */
    refreshMe: function () { delete actors['me']; },
    /** 재기 — 지금 내 배우의 몸 파일·상태(사가블로 Q8 "던전에 들어가면 캐릭터가 바뀜") */
    meBody: function () { var a = actors['me'], m = a && a.node && a.node.userData.mixerNode; return m ? { body: m.userData.body, state: m.userData.assetState, seed: meRenderParams().seed } : null; },
    /** §56 가림 페이드 — 실측용(init() 뒤에만 의미 있다) */
    _occCounts: function () { return { fade: Object.keys(occFade).length, inst: Object.keys(occInst).length }; }
  };
})(window);
