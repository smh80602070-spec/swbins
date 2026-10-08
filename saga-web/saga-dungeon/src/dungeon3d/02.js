  /* ── 들판 (2단계) ────────────────────────────────────
   * `field3d.js` 가 **무엇이 어디 서는지**를 값으로 낸다. 여기서는 그 목록을 받아
   * 도형으로 세우기만 한다 — 판단과 그림을 갈라 둔 것이다(진단이 값만 본다).
   *
   * 나무·바위·덤불·풀·꽃·버섯·통나무·죽은나무(정적 자연물 여덟 가지)는 개별
   * `piece()` 대신 한꺼번에 모아 `field-instance.js`(InstancedMesh)로 세운다 —
   * 조각마다 개별 draw call 이 붙던 자리를 kind·GLB 파일당 몇 개로 줄인다.
   * 모듈이 없으면(방어적 기본값) 옛 방식(개별 piece())으로 그대로 돌아간다.
   */
  /* 2026-09-08 — "움직이면 끊긴다" 실기기 로그 실측(LOW 등급인데도
     ema=82ms). 범인은 이 함수 자신이었다 — 칸(최대 (2R+1)² 개)마다 땅 한
     장·초목·바위를 전부 **한 프레임에** 동기로 짓는다. 재구성 빈도를
     줄여도(위 fldStep) 재구성 자체의 무게는 그대로라 걸을 때마다 한 번씩
     그 무게가 통째로 튄다. 통짜 함수를 "시작"(창 정하고 짤 칸 목록만 세움)과
     "한 조각 짓기"로 쪼개, 매 프레임 예산(FIELD_BUILD_BUDGET_MS)만큼만
     짓고 나머지는 다음 프레임으로 넘긴다 — 총 짓는 시간은 같아도 한 프레임에
     몰리지 않아 히트(hitch)가 없다. */
  var fieldJob = null;
  var FIELD_BUILD_BUDGET_MS = 4;

  function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  /** 창을 정하고 지을 칸 목록만 세운다 — 무거운 건 하나도 안 짓는다(순간). */
  function buildField(run, cx0, cz0, keepOld) {
    var F = global.DG.field3d;
    if (!fieldGroup) { return; }
    /* 진행 중이던 뒷공사는 버린다(새 창이 이긴다) */
    if (fieldNext) { scene.remove(fieldNext); fieldNext = null; }
    var wm = worldFieldOn(run);
    if (keepOld && F && FIELD()) {
      /* 뒤에서 짓기 — 옛 들판은 끝날 때까지 그대로 보인다(fieldJobFinalize 가 갈아 끼운다) */
      fieldNext = new T.Group();
      fieldNext.visible = false;
      scene.add(fieldNext);
      fieldTarget = fieldNext;
      fieldJob = null;
      buildFieldJob(run, cx0 | 0, cz0 | 0, wm, F);
      return;
    }
    fieldTarget = fieldGroup;
    /* 걸어서 들판 창이 옮겨갈 때마다(fwRk 변경) 여기가 **동기로** 도는데,
       세운 반경이 넓을수록(natItems 인스턴싱 전이면 조각 하나하나가 개별
       Mesh라) fieldGroup 자식이 수백 개까지도 간다. 앞에서부터 지우면
       Object3D.remove() 의 indexOf+splice 가 매번 배열을 통째로 당겨
       O(n²)가 돼, 이 한 줄이 "걸으면 멈췄다가 다시 움직인다"는 제보의
       바로 그 순간(들판 창 재구성 프레임)에 정확히 걸린다 — buildRoom()
       에서 먼저 찾은 것과 같은 패턴(감사, 2026-09-08). 뒤에서부터
       지우면 O(n). */
    for (var fgi = fieldGroup.children.length - 1; fgi >= 0; fgi--) { fieldGroup.remove(fieldGroup.children[fgi]); }
    fieldJob = null;
    if (!F || !FIELD()) { fieldKey = null; return; }
    /* PLAN §57 — cx0,cz0(호출부가 플레이어 쪽으로 맞춰 준 창 중심, 없으면
       0=방 중심)만큼 통째로 밀어 짓는다. anc는 그대로라 seed 산식(cx,cz를
       그대로 먹는 heightAt/chunkAt/clutterAt)은 안 바뀐다 — 창이 옮겨가도
       "같은 자리는 늘 같은 지형"이 유지된다. */
    cx0 = cx0 | 0; cz0 = cz0 | 0;
    buildFieldJob(run, cx0, cz0, wm, F);
  }

  /** 지을 칸 목록과 공사 묶음(fieldTarget)을 정한다 — 무거운 건 하나도 안 짓는다 */
  function buildFieldJob(run, cx0, cz0, wm, F) {
    var W = d().ROOM_W, H = d().ROOM_H;
    var DD = global.DG.dataDungeon;
    var th = run.theme || (DD ? DD.themeOf(run.floor) : null);
    var seed = F.seedOf(run.floor, run.roomIdx, th && th.name);
    var R = fieldVisR(run), dens = FIELD_D();
    var stone = themeHex(run);
    /* 땅 밑색 — 원래 0.62 로 무조건 `0x141018`(거의 검정) 쪽에 바짝 붙여
       **실기기 "들판에 새까만 사각형"** 으로 이어졌다(2026-09-04, 세 번째
       재조사). 마을(town)의 조명(`lightPlan`의 ambient 0.86·key 1.15)은
       던전보다 훨씬 밝은데, 바탕색 자체가 이미 짙으면 Lambert 재질은
       빛을 아무리 받아도 그 짙기를 못 넘는다 — 길(0x4a3f30, 밝은 갈색)
       조각만 점점이 놓인 옆에서 나머지 땅이 통째로 새까맣게 도드라져
       보인 것이 이 값이었다(고립 시험 `_inspect_black_tmp.html`로 실측:
       0.62일 때 화면 RGB 20,12,7 — 사실상 검정, 0.15로는 35,24,13으로
       뚜렷이 갈색이 남는다). 마을만 옅게 — 던전 안(지하) 특유의 어두운
       분위기는 그대로 둔다(그쪽은 제보가 없었다, `lightPlan`도 원래 어둡게
       짠 자리라 손 안 댐). */
    var groundK = run.town ? -0.4 : 0.62;   // W-0111 — 마을은 음수 = 흰 쪽으로 섞는다(0.15 로 검정 쪽에 섞으니 3D 마을 평균 밝기 15/255)
    var FI = global.DG.fieldInstance;

    /* 2026-09-08 — "맵이 없는 데는 낭떨어지 같다" 제보. 세운 반경(R칸) 밖은
       지금까지 아무 것도 없어, 안개가 다 덮기 전까지는 배경색 허공이 그대로
       드러났다(LOW처럼 R이 작을수록 두드러진다 — 카메라 거리가 세운
       가장자리보다 멀 수 있어 아래 안개 클램프와 다투는 자리이기도 하다).
       세운 칸보다 한참 낮은 자리에 아주 큰 민무늬 판 하나(그림자 없음,
       draw call 1개뿐)를 깔아 "끊긴 낭떨어지" 대신 "저 멀리 낮은 벌판"으로
       보이게 한다 — 칸별 비용은 그대로다(buildField 한 번에 하나뿐). */
    var skirt = groundBox(fieldTarget, cx0 * F.CHUNK, -260, cz0 * F.CHUNK, 6000, 40, 6000,
      groundK < 0 ? mix(stone, 0xffffff, -groundK) : mix(stone, 0x141018, groundK), false);
    skirt.receiveShadow = false;

    var coords = [];
    for (var cz = cz0 - R; cz <= cz0 + R; cz++) {
      for (var cx = cx0 - R; cx <= cx0 + R; cx++) { coords.push(cx, cz); }
    }
    fieldJob = {
      F: F, coords: coords, idx: 0, W: W, H: H, seed: seed, R: R, dens: dens,
      stone: stone, groundK: groundK, th: th, FI: FI, natItems: FI ? [] : null,
      corridors: run.corridors, wm: wm, g: fieldTarget
    };
    lastFieldWm = wm;
  }

  /**
   * 고정 세계 지도 칸 하나(§5.12) — 세계 칸 좌표·세계 좌표 그대로 짓는다(fieldGroup 을
   * 앵커만큼 밀어 화면 로컬로 맞춘다, render 참고). 소품은 충돌(dungeon.fieldBlockedAt)이
   * 읽는 **같은 배열**이다 — 밀도(그래픽 등급)로 나무 수를 줄이지 않는다(줄이면 안 보이는 나무에 막힌다).
   * 마을 발판(ring 0)은 땅만 조금 낮게 깐다 — 지금 마을의 바닥이 그 위를 덮는다.
   */
  function fieldJobChunkWorld(J, cx, cz) {
    var WM = global.DG.worldMap, F = J.F, C = F.CHUNK, i;
    var inf = WM.info(cx, cz, J.W, J.H);
    if (!inf) { return; }
    var tile = fieldTileBox(J.g, cx * C + C / 2, inf.ring === 0 ? -7 : -6, cz * C + C / 2,
      C + 2, 12, C + 2, J.groundK < 0 ? mix(inf.region.ground, 0xffffff, -J.groundK) : mix(inf.region.ground, 0x141018, J.groundK), false);
    tile.receiveShadow = true;
    if (inf.ring === 0) { return; }
    var list = WM.pieces(cx, cz, J.W, J.H);
    for (i = 0; i < list.length; i++) {
      if (J.FI && NATURAL_KIND[list[i].t]) { J.natItems.push(natItem(F, list[i], inf.seed, J.W, J.H)); }
      else { piece(list[i], inf.seed, J.W, J.H, J.stone); }
    }
    var deco = WM.clutter(cx, cz, J.W, J.H, J.dens);
    for (i = 0; i < deco.length; i++) {
      if (J.FI && NATURAL_KIND[deco[i].t]) { J.natItems.push(natItem(F, deco[i], inf.seed, J.W, J.H)); }
      else { piece(deco[i], inf.seed, J.W, J.H, J.stone); }
    }
  }

  /** 칸 하나 — 옛 buildField() 이중 루프의 몸통 그대로(짓는 내용은 안 바뀜) */
  function fieldJobChunk(J, cx, cz) {
    if (J.wm) { fieldJobChunkWorld(J, cx, cz); return; }
    var F = J.F, W = J.W, H = J.H, seed = J.seed, dens = J.dens, stone = J.stone,
      groundK = J.groundK, th = J.th, FI = J.FI, natItems = J.natItems, i;
    var ring = F.ringOf(cx, cz, W, H);
    if (ring === 0) { return; }               // 방이 걸친 조각은 방 바닥이 맡는다
    var gx = cx * F.CHUNK, gz = cz * F.CHUNK;
    var hh = F.heightAt(gx + F.CHUNK / 2, gz + F.CHUNK / 2, seed, W, H);
    var tile = fieldTileBox(J.g, gx + F.CHUNK / 2, hh - 6, gz + F.CHUNK / 2,
      F.CHUNK + 2, 12, F.CHUNK + 2, groundK < 0 ? mix(stone, 0xffffff, -groundK) : mix(stone, 0x141018, groundK), false);
    tile.receiveShadow = true;

    /* 통로(PLAN §28-2 Phase 3, §28-4 Phase 2·3) — 이 조각이 마을 사이
       통로의 결 안이면 목적지 테마(`통로:<id>`)로, 던전 계단문 통로의
       결 안이면 `통로:계단`으로, 그 밖(방-방 통로 포함)은 지금 층/마을
       테마로. `run.corridors`가 없으면 늘 null — fieldBlockedAt()과
       정확히 같은 판정을 쓴다. */
    var cTheme = (J.corridors && F.corridorNameAt) ? F.corridorNameAt(cx, cz, W, H, J.corridors) : null;
    /* th.biome(PLAN §28-8 Phase 3) — dungeon.js의 fieldBlockedAt과
       같은 이유로 같은 자리에 같은 순서로 얹었다(그림 대 판정이
       어긋나면 안 된다). seed(위)는 그대로 th.name — 마을마다 고유한
       지형 패턴은 유지하고, 가중치 표만 biome으로 묶는다. */
    var list = F.chunkAt(cx, cz, seed, ring, dens, cTheme || (th && (th.biome || th.name)));
    for (i = 0; i < list.length; i++) {
      if (FI && NATURAL_KIND[list[i].t]) { natItems.push(natItem(F, list[i], seed, W, H)); }
      else { piece(list[i], seed, W, H, stone); }
    }
    /* 잡초 층 — 순수 장식(판정 안 닿음), field3d.js clutterAt() 참고.
       `th`(층 테마)를 같이 넘긴다 — PLAN 9절 Biome, 2026-09-05 field3d.js
       kindOf() 감사 참고: 색깔만 다르고 오브젝트 비율은 안 갈리던 것을 고쳤다 */
    if (F.clutterAt) {
      var deco = F.clutterAt(cx, cz, seed, ring, dens, cTheme || (th && (th.biome || th.name)));
      for (i = 0; i < deco.length; i++) {
        if (FI && NATURAL_KIND[deco[i].t]) { natItems.push(natItem(F, deco[i], seed, W, H)); }
        else { piece(deco[i], seed, W, H, stone); }
      }
    }
  }

  /** 목록을 다 돌면 인스턴싱 마무리 — 옛 buildField() 꼬리 그대로 */
  function fieldJobFinalize(J) {
    var natItems = J.natItems, FI = J.FI, i;
    if (FI && natItems && natItems.length) {
      var built = FI.build(natItems);
      if (built && built.children && built.children.length) { J.g.add(built); }
      else {
        /* 방어적 — 인스턴싱이 뭔가 잘못돼(폴백조차 못 세웠으면) 아무것도
           안 보이는 것보다는 옛 개별 piece() 방식으로 되돌아간다. */
        for (i = 0; i < natItems.length; i++) {
          var ni = natItems[i];
          piece({ t: ni.kind, x: ni.x, z: ni.z, s: ni.s, rot: ni.rot, h: ni.h }, J.seed, J.W, J.H, J.stone);
        }
      }
    }
    fieldKey = J.seed + ':' + J.R + ':' + Math.round(J.dens * 100);
    /* 뒤에서 지은 것이면 이제 옛 들판을 걷고 한 번에 갈아 끼운다(뒤에서부터 옮겨 O(n)) */
    if (J.g && J.g !== fieldGroup) {
      for (i = fieldGroup.children.length - 1; i >= 0; i--) { fieldGroup.remove(fieldGroup.children[i]); }
      while (J.g.children.length) { fieldGroup.add(J.g.children[J.g.children.length - 1]); }
      scene.remove(J.g);
      if (fieldNext === J.g) { fieldNext = null; }
    }
  }

  /** 매 프레임 부른다 — 진행 중인 들판 공사가 있으면 예산만큼만 이어 짓는다. */
  function fieldJobStep() {
    if (!fieldJob) { return; }
    lastFrameHadBuild = true;   // 조각 몇 개라도 지었으면 이 프레임 측정치도 평균에서 뺀다
    var J = fieldJob;
    fieldTarget = J.g || fieldGroup;
    var deadline = nowMs() + FIELD_BUILD_BUDGET_MS;
    while (J.idx < J.coords.length && nowMs() < deadline) {
      var cx = J.coords[J.idx], cz = J.coords[J.idx + 1];
      J.idx += 2;
      fieldJobChunk(J, cx, cz);
    }
    if (J.idx >= J.coords.length) {
      var finT0 = nowMs();
      fieldJobFinalize(J);
      lastFieldFinalizeMs = nowMs() - finT0;
      fieldJob = null;
      fieldTarget = null;
    }
  }

  /** 들판 조각 하나를 도형으로 세운다 — 나무·바위는 사가만리와 같은 GLB, 나머지는
   *  여전히 도형이다(PLAN 4절의 우선순위 ⑤나무 ⑥바위까지만 이번에 옮겼다) */
  function piece(p, seed, W, H, stone) {
    var F = global.DG.field3d;
    var g = fieldTarget || fieldGroup;
    var y = F.heightAt(p.x, p.z, seed, W, H);
    var s = p.s || 1;
    var AS3 = AS();
    if (p.t === 'tree') {
      var treeShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h * 0.22, 0, 9 * s, p.h * 0.44, 9 * s, 0x3a2c1e, 'flat', true);
        box(sg, 0, p.h * 0.68, 0, p.h * 0.62 * s, p.h * 0.7, p.h * 0.62 * s, 0x24361f, 'flat', true);
        return sg;
      };
      var tnode = AS3 ? AS3.build('tree', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.35 * s, null, treeShape) : treeShape();
      tnode.position.set(p.x, y, p.z);
      tnode.rotation.y = p.rot || 0;
      g.add(tnode);
    } else if (p.t === 'tree_dead') {
      /* 늪(swamp) 전용 — 잎이 없는 마른 줄기 하나만 남긴다(뭉치 없이) */
      var deadShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h * 0.5, 0, 7 * s, p.h, 7 * s, 0x2a2016, 'flat', true);
        return sg;
      };
      var dtnode = AS3 ? AS3.build('tree_dead', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.2 * s, null, deadShape) : deadShape();
      dtnode.position.set(p.x, y, p.z);
      dtnode.rotation.y = p.rot || 0;
      g.add(dtnode);
    } else if (p.t === 'rock') {
      var rockShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h * 0.4, 0, p.h * 1.3 * s, p.h * 0.9, p.h * 1.1 * s, mix(stone, 0x000000, 0.35), 'flat', true);
        return sg;
      };
      var rnode = AS3 ? AS3.build('rock', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 0.9 * s, null, rockShape) : rockShape();
      rnode.position.set(p.x, y, p.z);
      rnode.rotation.y = p.rot || 0;
      g.add(rnode);
    } else if (p.t === 'pillar') {
      /* 폐허의 부러진 기둥 — 꼭 맞는 낱개 기둥 에셋이 없어 무너진 아치(Arch)로
         대신한다(사가만리가 이미 "사당·폐허의 다른 후보"로 적어 둔 것) */
      var pillarShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h / 2, 0, 16, p.h, 16, mix(stone, 0xffffff, 0.12), 'flat', true);
        return sg;
      };
      var pnode = AS3 ? AS3.build('pillar', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h, null, pillarShape) : pillarShape();
      pnode.position.set(p.x, y, p.z);
      g.add(pnode);
    } else if (p.t === 'wall') {
      var wallShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h / 2, 0, 90, p.h, 14, mix(stone, 0x000000, 0.2), 'flat', true);
        return sg;
      };
      var wnode = AS3 ? AS3.build('wall', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h, null, wallShape) : wallShape();
      wnode.position.set(p.x, y, p.z);
      wnode.rotation.y = p.rot || 0;
      g.add(wnode);
    } else if (p.t === 'path') {
      var pt = box(g, p.x, y + 1, p.z, F.CHUNK + 2, 3, 46, 0x4a3f30, 'flat', false);
      pt.rotation.y = p.rot;
      pt.receiveShadow = true;
      /* PLAN §6.1 마지막 조각(길 데칼, road3d.js, 2026-09-19) — 단색 상자
         대신 흙 텍스처 + 가장자리 알파 페이드로 갈아 끼운다. 못 받으면
         (자가진단 등, three 없음) 위 단색 상자 그대로 남는다(fallback) */
      var RD = global.DG.road3d;
      var roadMat = RD ? RD.material((F.CHUNK + 2) / TILE) : null;
      if (roadMat) { pt.material = roadMat; }
    } else if (p.t === 'post') {
      /* 2026-09-05 — 표지판을 실사화(Kenney CC0 'signpost', asset3d.js 참고).
         못 받으면 옛 도형(기둥+판)으로 그대로 돌아간다 */
      var postShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h / 2, 0, 6, p.h, 6, 0x5a4a34, 'flat', true);
        box(sg, 0, p.h, 0, 30, 8, 4, 0x6b5a3f, 'flat', false);
        return sg;
      };
      var pnode = AS3 ? AS3.build('post', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.15, null, postShape) : postShape();
      pnode.position.set(p.x, y, p.z);
      pnode.rotation.y = p.rot || 0;
      g.add(pnode);
    } else if (p.t === 'pond') {
      /* 2026-09-05 — 단색 반투명 상자를 실제 에셋(바위 고리+연잎+물결 데칼,
         'pond' 키, `asset3d.js` 참고)으로 갈아 끼웠다. `normalize()`는
         세로(Y) 기준으로만 배율을 잡는데 이 에셋은 **가로로 넓은** 지형물이라,
         원본의 가로:세로 비(약 2.35:1)를 거꾸로 풀어 원하는 가로 폭에 맞는
         mul(세로)을 역산한다 — 그래야 결과 가로 폭이 옛 상자와 같은 자리에
         맞아떨어진다. 못 받으면(단독판 등) 옛 상자 그대로 돌아간다(fallback) */
      var pondW = F.CHUNK * 0.8 * s;
      var pondMul = pondW * 0.4247;
      var pondShape = function () {
        var sg = new T.Group();
        var pd = box(sg, 0, 2, 0, pondW, 3, F.CHUNK * 0.7 * s, 0x1f4a63, 'flat', false);
        pd.material = mat(0x1f4a63, 'water');
        return sg;
      };
      var pdnode = AS3 ? AS3.build('pond', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        pondMul, null, pondShape) : pondShape();
      pdnode.position.set(p.x, y, p.z);
      pdnode.rotation.y = ((Math.round(p.x) + Math.round(p.z)) % 360) * Math.PI / 180;
      g.add(pdnode);
    } else if (p.t === 'reed') {
      /* 갈대는 이 판에 GLB 가 없다(위 §6.4) — 도형 그대로, 그래서 늘 흔들린다 */
      box(g, p.x, y + p.h / 2, p.z, 3, p.h, 3, 0x3f5a34, 'sway', false);
    } else if (p.t === 'cavemouth') {
      /* 동굴 입구 — 사가만리가 이미 "광산 어귀"로 적어 둔 그 Mine 을 세운다 */
      var caveShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h * 0.45, 0, p.h * 1.5, p.h, p.h * 1.2, mix(stone, 0x000000, 0.5), 'flat', true);
        return sg;
      };
      var cvnode = AS3 ? AS3.build('cavemouth', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.3, null, caveShape) : caveShape();
      cvnode.position.set(p.x, y, p.z);
      cvnode.rotation.y = p.rot || 0;
      g.add(cvnode);
      /* 입구는 **새까맣다** — 빛이 안 닿는 자리가 있어야 굴로 보인다(GLB 위에도 그대로 얹는다) */
      box(g, p.x, y + p.h * 0.3, p.z + p.h * 0.6, p.h * 0.5, p.h * 0.55, 6,
        0x000000, '', false).rotation.y = p.rot;
    } else if (p.t === 'altar') {
      /* 제단 — 사가만리가 "사당" 후보로 적어 둔 Temple 을 세운다. 도형이 얹던
         떠 있는 보랏빛 구슬은 **표식이라 그대로 남긴다**(멀리서도 제단인 줄 안다) */
      var altarShape = function () {
        var sg = new T.Group();
        box(sg, 0, 6, 0, 60, 12, 60, mix(stone, 0xffffff, 0.2), 'flat', true);
        box(sg, 0, p.h * 0.6, 0, 20, p.h * 0.8, 20, 0x4a3f6b, 'flat', true);
        return sg;
      };
      var alnode = AS3 ? AS3.build('altar', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.1, null, altarShape) : altarShape();
      alnode.position.set(p.x, y, p.z);
      g.add(alnode);
      box(g, p.x, y + p.h + 6, p.z, 14, 14, 14, 0xc9a3ff, 'glow', false);
    } else if (p.t === 'tent') {
      /* 천막 — 2026-09-04, saga-forest 가 받아 둔 진짜 텐트(survival_pack,
         CC0)로 갈아 끼웠다. 옛 대역(MarketStand)은 행상 좌판만의 `stall`
         키로 옮겨 갔다(위 buildActor() 의 POI: Merchant 참고) */
      var tentShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h / 2, 0, 44, p.h, 40, 0x5a4a3a, 'flat', true);
        return sg;
      };
      var tenode = AS3 ? AS3.build('tent', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h, null, tentShape) : tentShape();
      tenode.position.set(p.x, y, p.z);
      tenode.rotation.y = p.rot || 0;
      g.add(tenode);
    } else if (p.t === 'fire') {
      /* 모닥불 — 2026-09-04, saga-forest 가 받아 둔 medieval_village_pack 의
         Bonfire_Lit(CC0)로 갈아 끼웠다. 잿더미+불씨 도형은 fallback 으로 남긴다 */
      var fireShape = function () {
        var sg = new T.Group();
        box(sg, 0, 4, 0, 26, 8, 26, 0x2f2a24, 'flat', false);
        box(sg, 0, p.h, 0, 14, 16, 14, 0xff7a2a, 'glow', false);
        return sg;
      };
      var finode = AS3 ? AS3.build('campfire', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.6, null, fireShape) : fireShape();
      finode.position.set(p.x, y, p.z);
      g.add(finode);
    } else if (p.t === 'grass' || p.t === 'flower' || p.t === 'bush' ||
               p.t === 'mushroom' || p.t === 'log') {
      /* 잡초 층(field3d.js clutterAt()) — 순수 장식. 종류마다 도형 fallback 을
         다르게 둬서 GLB 가 못 오는 자리(file:// 단독판 등)에서도 그 성격이 읽힌다 */
      var clutterCol = p.t === 'flower' ? 0xd88fc0 : (p.t === 'log' ? 0x4a3826 :
        (p.t === 'mushroom' ? 0xc94f4f : 0x3f5a34));
      /* 풀·꽃·덤불만 바람에 흔든다(PLAN §6.1-5 나머지 절반, sway3d.js) — 통나무·
         버섯은 뿌리·갓이 뻣뻣해 그대로 'flat' */
      var clutterOpt = (p.t === 'grass' || p.t === 'flower' || p.t === 'bush') ? 'sway' : 'flat';
      var clutterShape = function () {
        var sg = new T.Group();
        if (p.t === 'log') { box(sg, 0, p.h / 2, 0, p.h * 2.2, p.h, p.h * 0.9, clutterCol, clutterOpt, false); }
        else { box(sg, 0, p.h / 2, 0, p.h * 0.7, p.h, p.h * 0.7, clutterCol, clutterOpt, false); }
        return sg;
      };
      var clnode2 = AS3 ? AS3.build(p.t, seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * (p.t === 'log' ? 1 : 1.6) * s, null, clutterShape) : clutterShape();
      clnode2.position.set(p.x, y, p.z);
      clnode2.rotation.y = p.rot || 0;
      g.add(clnode2);
    } else if (p.t === 't_factory' || p.t === 't_solar' || p.t === 't_tower' ||
               p.t === 't_pylon' || p.t === 't_hologram') {
      /* §5.7 시대 퓨전(2026-09-18) — biome 마다 하나(field3d.js eraLayerAt()).
         전부 실제 GLB 가 없다(현대·미래 소품 팩을 아직 못 구했다) — PLAN
         원문이 "CC0 조합 또는 절차 생성" 둘 다 열어 둬 이번엔 절차 생성으로
         간다. 나중에 GLB 를 구하면 AS3.build 의 이 키로만 등록하면
         자동으로 갈아 끼워진다(다른 소품과 같은 결). */
      var eraShape = function () {
        var sg = new T.Group();
        if (p.t === 't_factory') {
          /* 고분 옆 폐공장 굴뚝 — 붉은 벽돌색 원통 모양(상자로 근사) + 검은 아가리 */
          box(sg, 0, p.h * 0.5, 0, 22, p.h, 22, 0x5a3a30, 'flat', true);
          box(sg, 0, p.h, 0, 14, 6, 14, 0x1a1a1a, 'flat', false);
        } else if (p.t === 't_solar') {
          /* 기와집 옆 태양광 판 — 기둥 하나 + 기울어진 짙은 남색 판 */
          box(sg, 0, p.h * 0.32, 0, 5, p.h * 0.64, 5, 0x5a5a5a, 'flat', true);
          var panel = box(sg, 0, p.h * 0.62, 0, 46, 4, 30, 0x1c3a5e, 'flat', true);
          panel.rotation.x = -0.4;
        } else if (p.t === 't_tower') {
          /* 늪 위 녹슨 관측탑 — 가는 기둥 넷 + 꼭대기 전망대(녹슨 주황) */
          var lp = 16;
          box(sg, lp, p.h * 0.5, lp, 6, p.h, 6, 0x6b4a34, 'flat', true);
          box(sg, -lp, p.h * 0.5, lp, 6, p.h, 6, 0x6b4a34, 'flat', true);
          box(sg, lp, p.h * 0.5, -lp, 6, p.h, 6, 0x6b4a34, 'flat', true);
          box(sg, -lp, p.h * 0.5, -lp, 6, p.h, 6, 0x6b4a34, 'flat', true);
          box(sg, 0, p.h, 0, 44, 10, 44, 0x9a5a2e, 'flat', true);
        } else if (p.t === 't_pylon') {
          /* 산채에 케이블카 기둥 — 회색 격자 기둥 + 가로 활대 */
          box(sg, 0, p.h * 0.5, 0, 14, p.h, 14, 0x7a7f88, 'flat', true);
          box(sg, 0, p.h * 0.96, 0, 64, 6, 10, 0x5a5f68, 'flat', true);
        } else {
          /* 사당에 홀로그램 비석 — 돌 받침(제단과 같은 재질) + 청록 발광 기둥 */
          box(sg, 0, 6, 0, 40, 12, 40, mix(stone, 0xffffff, 0.2), 'flat', true);
          box(sg, 0, p.h * 0.5, 0, 16, p.h * 0.9, 4, 0x5adfe8, 'glow', false);
        }
        return sg;
      };
      var eranode = AS3 ? AS3.build(p.t, seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.1, null, eraShape) : eraShape();
      eranode.position.set(p.x, y, p.z);
      eranode.rotation.y = p.rot || 0;
      g.add(eranode);
    }
  }

  function mix(a, b, k) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * k) << 16) |
           (Math.round(ag + (bg - ag) * k) << 8) |
            Math.round(ab + (bb - ab) * k);
  }

  /* ── 맞은 순간 번쩍인다 (3단계 · PLAN 51절 Hit Flash) ──────
   * 재질은 `mat()` 이 색마다 하나씩 만들어 모든 배우가 나눠 쓴다.
   * 그대로 만지면 적 하나가 맞을 때 방 전체가 번쩍인다 —
   * 그래서 **몸통만** 사본을 들려 준다.
   */
  function ownMat(m) { m.material = m.material.clone(); return m.material; }

  /* ── 배우 ───────────────────────────────────────────
   * 사람과 적을 도형으로 조립한다. 원작 에셋은 안 쓴다 —
   * 크기·색만 판정에서 읽어 온다(체력·등급이 그림에 드러나야 한다).
   */
