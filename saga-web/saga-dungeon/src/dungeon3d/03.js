  /* ── 이름표 ─────────────────────────────────────────
   * 마을에서는 **누구인지가 곧 기능**이다 — 야장에게 가야 물건을 박고, 행상에게
   * 가야 산다. 2D 는 머리 위에 글자를 얹어 그것을 알렸다. 3D 에서 그 글자가
   * 사라지면 마당에 사람 여섯이 말없이 서 있는 그림이 된다.
   * 글자판은 이름마다 하나만 만들어 두고 돌려 쓴다(아홉 장이면 끝이다).
   */
  var labelTexCache = {};
  function labelTex(text) {
    if (labelTexCache[text]) { return labelTexCache[text]; }
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    var c = cv.getContext('2d');
    c.font = '600 27px "Malgun Gothic", system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    var w = Math.min(248, c.measureText(text).width + 22);
    c.fillStyle = 'rgba(6,7,10,0.62)';
    c.fillRect((256 - w) / 2, 13, w, 38);
    c.fillStyle = '#f2e4c2';
    c.fillText(text, 128, 33);
    var t = new T.CanvasTexture(cv);
    t.needsUpdate = true;
    labelTexCache[text] = t;
    return t;
  }

  /** 이름표 한 장 — 카메라를 늘 마주 본다. `depthTest` 를 끈 것은 기둥 뒤에
      선 사람도 누구인지 읽히게 하려는 것이다(마을이라 그래도 된다) */
  function labelNode(text, y, w) {
    var m = new T.SpriteMaterial({ map: labelTex(text), transparent: true, depthTest: false });
    var s = new T.Sprite(m);
    s.position.set(0, y, 0);
    s.scale.set(w, w / 4, 1);
    s.userData.w = w;
    return s;
  }
  /** 세로 폰 — 가로 시야가 좁아 이름표 한 장이 화면 폭 절반을 덮었다(2026-09-27 실기 신고
      "세로 화면에 뜨는 게 너무 많다"). 화면비만큼 줄이되 0.62배 밑으로는 안 내린다 */
  function labelK() {
    var asp = camera && camera.aspect || 1;
    return asp < 1 ? Math.max(0.62, asp * 1.35) : 1;
  }

  /**
   * 마을의 사람·표식 하나에 "말이 걸리나" 를 입힌다.
   * 이름표 아홉 장이 늘 같은 진하기로 떠 있으면 마당이 글자로 덮인다 —
   * **멀리 있는 것은 흐리게**, 말이 걸리는 거리에 들면 진하게 하고 발밑 고리를 켠다.
   */
  function townMark(node, dist, talkR) {
    var near = dist < talkR;
    if (node.userData.ring) { node.userData.ring.visible = near; }
    var lb = node.userData.label;
    if (lb && lb.material) {
      lb.material.opacity = near ? 1 : core.clamp(1 - (dist - talkR) / 260, 0.34, 0.9);
      var lw = (lb.userData.w || lb.scale.x) * labelK();
      if (lb.scale.x !== lw) { lb.scale.set(lw, lw / 4, 1); }
    }
  }

  function hexOf(css, def) {
    if (!css) { return def; }
    var n = parseInt(String(css).replace('#', ''), 16);
    return isNaN(n) ? def : n;
  }

  /** asset3d — 사가고와 같은 것을 쓴다(사가블로 4단계, `assets/ASSET_LICENSES.md`) */
  function AS() { return global.DG.asset3d; }
  /** 몸짓(§5.16, `gesture.js`) — 손잡이 dungeon.gesture 가 0 이면 plan 이 늘 base 를 돌려준다 */
  function GS() { return global.DG.gesture; }

  /** 몸짓 글자 풍선 — 머리 위로 살짝 떠오르며 처음·끝에 옅어진다. 글자가 바뀔 때만 새로 짓는다 */
  function gestureBubble(node, g, y) {
    var u = node.userData, text = g && g.text;
    if (!text) { if (u.bubble) { u.bubble.visible = false; } return; }
    if (!u.bubble || u.bubbleText !== text) {
      if (u.bubble) { node.remove(u.bubble); }
      u.bubble = labelNode(text, y, 60);
      u.bubbleText = text;
      node.add(u.bubble);
    }
    var k = g.k || 0;
    u.bubble.visible = true;
    u.bubble.position.y = y + k * 6;
    u.bubble.material.opacity = core.clamp(Math.min(k * 6, (1 - k) * 4), 0, 1);
  }

  /** 로딩 우선순위(PLAN 39절) — 마을 한 곳이 GLB 36개를 부른다(집·나무·바위…,
   *  buildRoom()·buildField() 가 곧 부른다). 그런데 정작 화면에서 가장 먼저
   *  눈에 들어와야 할 **나(플레이어)·마을 사람**은 그 뒤 actorOf() 루프에서
   *  제일 나중에 요청돼 늘 꼴찌로 밀렸다(CDP로 실측 — 당시 기본 시드가 여전히
   *  리터럴 'me'라 골랐던 v20.glb 가 39개 중 31번째였다). 버림받는 GLB 는
   *  없다 — 그냥 **네트워크 큐에 올리는 순서**만 사람이 먼저다.
   *  `rawScene()` 은 아무것도 세우지 않고 캐시에 굽기만 하므로(부작용 없음),
   *  잠시 뒤 buildRoom()/buildField() 가 배경 소품을 부르고 나서 actorOf() 가
   *  같은 url 을 또 부르면 이미 도착해 있거나 대기열 앞자리에 있다.
   *  **2026-09-07** — `touch('me')` 리터럴을 `meRenderParams().seed`로 바꿨다.
   *  실제로 몸을 지을 때(`actorOf('me', ...)`→`meRenderParams()`)는 이미
   *  QRPG_SEEDS 로 묶여 있는데, 여기 프리페치만 옛 리터럴 'me'를 그대로 써서
   *  실제로 안 쓸 무거운 MPFB 몸(+7.6MB 리타깃 원본)을 헛되이 큐에 올리고
   *  있었다 — 우선순위를 아무리 앞으로 당겨도 그 자체가 헛수고였다. */
  function prefetchActors(run) {
    var AS3 = AS();
    if (!AS3 || !AS3.heroRecipe || !AS3.rawScene) { return; }
    function touch(seed) {
      if (!AS3.wants('hero', seed)) { return; }
      var rec = AS3.heroRecipe(seed);
      if (!rec) { return; }
      var noop = function () {};
      AS3.rawScene(rec.body, noop);
      if (rec.outfit) { AS3.rawScene(rec.outfit, noop); }
      if (rec.hair) { AS3.rawScene(rec.hair, noop); }
      AS3.rawScene(rec.anim || AS3.ANIM_SRC, noop);
    }
    touch(meRenderParams().seed);
    var ns = (run.room && run.room.npcs) || [];
    for (var i = 0; i < ns.length; i++) { if (!ns[i].model) { touch('npc:' + (ns[i].key || '')); } }   // 제 몸 손님(§5.20)은 사람 창고를 안 당긴다
  }

  /** 지역 진입 전 미리 로드(PLAN 39절 나머지 절반) — 들길(exit_*) 표식에
   *  다가서면(도착보다 한참 전, `PREFETCH_EXIT_R`) 그 목적지 마을의 건물
   *  종류(house·well·inn 등, `town.js`의 decor)를 `prefetchActors()`와
   *  같은 요령(`rawScene()`, 세우지 않고 캐시에만 굽는다)으로 미리 당긴다.
   *  마을마다 딱 한 번만(`prefetchedTowns`) — 다시 다가서도 헛수고 안 한다.
   *  이미 방문한 마을의 건물 종류(house·well 등)는 어차피 URL 캐시에
   *  남아 있어 이 함수가 새로 할 일이 없다 — **처음 가 보는 위성 마을의
   *  전용 건물**(inn·stable·mill 등 아직 한 번도 안 부른 것)에만 실제 효과가 있다. */
  var prefetchedTowns = {};
  var PREFETCH_EXIT_R = 240;
  function prefetchTownDest(toId) {
    if (prefetchedTowns[toId]) { return; }
    var AS3 = AS(), TW = global.DG.town;
    if (!AS3 || !AS3.REG || !AS3.rawScene || !TW || !TW.decorTypesOf) { return; }
    prefetchedTowns[toId] = true;
    var types = TW.decorTypesOf(toId), noop = function () {};
    for (var i = 0; i < types.length; i++) {
      var reg = AS3.REG[types[i]];
      if (!reg) { continue; }
      var list = Array.isArray(reg) ? reg : [reg];
      for (var j = 0; j < list.length; j++) {
        if (typeof list[j] === 'string') { AS3.rawScene(list[j], noop); }
      }
    }
  }

  /** 로딩 이음매 없애기(PLAN §28-2 Phase 4, 던전 굴혈 입구 전용으로 남음) —
   *  §28-8(2026-09-06, 오픈월드 A안)부터 town.js는 마을↔마을 exit_* 표식을
   *  더는 안 세운다(걸어서 자연히 건너간다) — `run.corridors`도 늘 비어
   *  있다. 그래서 여기 아래 `run.corridors` 분기는 이제 **아무 마을
   *  exit_* 에도 안 걸린다**(그런 마크 자체가 없다) — 실제로 남는 건
   *  `exit_dungeon`(굴혈) 하나뿐이고, 그건 늘 표식 자체 거리 fallback으로
   *  간다. **"이웃 마을 자산을 미리 당긴다"는 몫은 아래 새 함수
   *  `maybePrefetchNearbyTowns()`가 이어받았다** — 표식이 아니라 마을
   *  발판 자체와의 거리(`town.js`의 `nearbyTownIds`)로 건다. 이 함수와
   *  `run.corridors` 분기는 안 지웠다(굴혈 fallback 경로는 여전히 쓰이고,
   *  corridors 분기도 언젠가 되살릴 수 있어 남겨 둔다). */
  function maybePrefetchCorridor(run, mo, p) {
    var toId = mo.key.slice(5), TW = global.DG.town;
    var list = run && run.corridors, cor = null, i;
    if (list) {
      for (i = 0; i < list.length; i++) { if (list[i].to === toId) { cor = list[i]; break; } }
    }
    if (cor && TW && TW.exitPointRaw) {
      var ep = TW.exitPointRaw(cor.dir);
      if (Math.hypot(ep.x - p.x, ep.y - p.y) < PREFETCH_EXIT_R) { prefetchTownDest(toId); }
      return;
    }
    if (Math.hypot(mo.x - p.x, mo.y - p.y) < PREFETCH_EXIT_R) { prefetchTownDest(toId); }
  }

  /** 이웃 마을 자산 프리페치(PLAN §28-8 후속, 2026-09-06) — 위 주석이
   *  적어 둔 "지금 아무도 안 부른다"를 실제로 고친다. 마을 발판 자체와의
   *  거리(`town.js`의 `nearbyTownIds` — 활성 반경보다 넉넉히(900) 여유를
   *  둬 도착보다 한참 전에 걸린다)로 아직 활성은 아니지만 곧 활성이 될
   *  이웃을 매 프레임 값싸게(마을 104개라 해 봤자 O(수백)) 걸러, 그
   *  마을들의 decor 자산만 `prefetchTownDest()`(마을당 한 번만 실제로
   *  일한다)로 미리 굽는다. 마을일 때만 뜻이 있다(`run.town`). */
  function maybePrefetchNearbyTowns(run, p) {
    var TW = global.DG.town, i;
    if (!run.town || !TW || !TW.nearbyTownIds) { return; }
    var ids = TW.nearbyTownIds(p.x, p.y);
    for (i = 0; i < ids.length; i++) { prefetchTownDest(ids[i]); }
  }

  /** 던전 로딩 이음매(PLAN §28-4 Phase 4) — "먼저 재본다"고 적어 둔 대로
   *  코드부터 확인했다: 방 소품(`dg:pillar`·`dg:torch`·`dg:door`·`dg:stairs`
   *  등)은 `asset3d.js`의 `REG` 표가 전부 **단일 문자열**이라 방마다 똑같은
   *  URL 하나뿐이다 — 첫 방에서 한 번 받으면 그 뒤로는 어느 방이든 캐시
   *  그대로 쓴다(마을처럼 방마다 다른 GLB 가 없다, 그래서 §28-2 Phase 4와
   *  달리 소품 프리페치는 필요 없다). 그런데 **바닥·벽 텍스처(`pickTex()`)는
   *  다르다** — `FLOOR_TEX`/`WALL_TEX` 각각 석 장 중`seedOf(floor,roomIdx,salt)`
   *  로 방마다 새로 고른다(2026-09-04, 나무·바위처럼 방 씨앗으로 고르게 늘린
   *  자리 — 위 주석 참고). 그래서 같은 층 안에서도 방을 넘어갈 때마다 다른
   *  석 장 중 하나가 걸릴 수 있고, 그 URL 이 처음 걸리는 자리면 `buildRoom()`
   *  이 부르는 순간에야 `TextureLoader`가 비동기로 받아 **도착 전까지 민무늬
   *  색으로 잠깐 보인다** — 이것이 진짜 이음매다. `goRoom()`은 RNG 없이
   *  `roomIdx += 1`(고정), `descend()`도 `floor += 1`·`roomIdx = 0`(고정)이라
   *  다음 방의 (floor,roomIdx)를 미리 안다 — §28-2 Phase 4와 같은 요령으로
   *  통로 초입(문 근처, `PREFETCH_DOOR_R`)에서 그 텍스처만 미리 당긴다. */
  var prefetchedRoomTex = {};
  var PREFETCH_DOOR_R = 160;      // 문 통로(1 CHUNK=200)보다 짧게 — 도착 전에 반드시 걸린다
  /** 이 문을 넘으면 도착할 (floor,roomIdx) — 순수 함수, RNG 없음.
   *  `goRoom()`(dungeon.js)의 `roomIdx += 1`, `descend()`의 `floor += 1`·
   *  `roomIdx = 0`과 **정확히 같은 산수**를 미리 계산한다(자가진단이 이 둘을
   *  나란히 대조한다). */
  function nextRoomFor(run, co) {
    return co.kind === 'stair' ? { floor: run.floor + 1, roomIdx: 0 }
                               : { floor: run.floor, roomIdx: run.roomIdx + 1 };
  }
  /** `run.corridors`의 문별 통로(PLAN §28-4 Phase 2, `{dir,lane,laneAt,extra,kind}`)
   *  중 플레이어가 지금 결 안에 든 것들의 다음 방을 돌려준다 — **순수 함수다**
   *  (T·rawTex 등 3D 부작용 없음, 자가진단이 T 없이도 이 함수만 직접 본다).
   *  마을 통로(`corridorsFor()`)는 `laneAt`이 없어 여기서 자연히 걸러진다
   *  (`corridorNameAt()`/`corridorExtra()`와 같은 구분법). */
  function doorPrefetchTargets(run, p) {
    var list = run && run.corridors, out = [], edgeX, i, co;
    if (!list) { return out; }
    edgeX = d().ROOM_W - d().WALL;
    for (i = 0; i < list.length; i++) {
      co = list[i];
      if (co.dir !== 'E' || co.laneAt == null) { continue; }
      if (Math.hypot(p.x - edgeX, p.y - co.laneAt) < PREFETCH_DOOR_R) { out.push(nextRoomFor(run, co)); }
    }
    return out;
  }
  function prefetchRoomTex(floor, roomIdx) {
    var key = floor + ':' + roomIdx;
    if (prefetchedRoomTex[key]) { return; }
    prefetchedRoomTex[key] = true;
    var fake = { floor: floor, roomIdx: roomIdx };
    rawTex(pickTex(FLOOR_TEX, fake, 'floortex'));
    rawTex(pickTex(WALL_TEX, fake, 'walltex'));
  }
  function maybePrefetchDoorTex(run, p) {
    var targets = doorPrefetchTargets(run, p), i;
    for (i = 0; i < targets.length; i++) { prefetchRoomTex(targets[i].floor, targets[i].roomIdx); }
  }

  /* 2026-09-05 — 플레이어가 실제로 장착한 무기의 `look`(sword·club·spear·
     bow·axe·staff·guandao·staff·scroll·fan·brush, `data-item.js` 참고).
     `js/skill.js`의 `classOf()`가 같은 자리를 읽지만 그 함수는 비공개
     (heroId 를 밖에서 이미 안다고 가정)라, 여기서는 `leadId()`가 하던 것
     (`core.save.party[0]`)을 그대로 다시 읽는다 — 새 export 를 안 늘리려는
     선택이다 */
  /** 그 인물이 실제로 장착한 무기의 look. id를 안 주면 선두(party[0]) —
   *  2026-09-06 동행(§51) 추가 전엔 늘 선두만 봤어서 id 인자가 없었다. */
  function weaponLookOf(id) {
    var core = global.DG.core, IT = global.DG.item;
    if (!core || !IT || !core.save || !core.save.party) { return 'sword'; }
    id = id || core.save.party[0];
    if (!id) { return 'sword'; }
    var w = IT.equipped(id).weapon;
    if (!w || IT.isBroken(w)) { return 'sword'; }
    var base = IT.baseOf(w);
    return (base && base.look) || 'sword';
  }
  /* 2026-09-06 — 투구·갑주도 weaponLookOf와 같은 요령으로 읽는다. 없거나
     부서졌으면 'none'(foeGear는 'none'이면 아무 것도 안 그린다). */
  function helmLookOf(id) {
    var core = global.DG.core, IT = global.DG.item;
    if (!core || !IT || !core.save || !core.save.party) { return 'none'; }
    id = id || core.save.party[0];
    if (!id) { return 'none'; }
    var h = IT.equipped(id).helm;
    if (!h || IT.isBroken(h)) { return 'none'; }
    var base = IT.baseOf(h);
    return (base && base.look) || 'none';
  }
  function armorLookOf(id) {
    var core = global.DG.core, IT = global.DG.item;
    if (!core || !IT || !core.save || !core.save.party) { return 'none'; }
    id = id || core.save.party[0];
    if (!id) { return 'none'; }
    var a = IT.equipped(id).armor;
    if (!a || IT.isBroken(a)) { return 'none'; }
    var base = IT.baseOf(a);
    return (base && base.look) || 'none';
  }
  /** 무기+투구+갑주를 한 번에 — foeGear(look) 한 번으로 셋 다 그리게 넘긴다 */
  function meLookOf(id) {
    return { weapon: weaponLookOf(id), helm: helmLookOf(id), armor: armorLookOf(id) };
  }
  /* 2026-09-06 — 외모 커스텀(`core.save.appearance = {styleSeed, tint}`).
     1 이상은 `'me:'+styleSeed`를 그대로 해시하지 않고 **미리 검증한 시드 표
     (QRPG_SEEDS)만 고른다** — `asset3d.js`의 `oneOf()`가 26종 레시피(QRPG 6·
     MPFB 실사 20종) 중 하나를 해시로 고르는데, 여기서 MPFB 쪽(`mpfb_female`
     등)이 걸리면 실기기 확인 중 CDP 헤드리스에서 렌더러가 그대로 죽는 게
     실제로 재현됐다(GPU 프로세스 강제 종료, `retargetInto()` 골격 재배치
     쪽 문제로 보이나 원인까지는 못 좁혔다). QRPG 6종은 이미 매 프레임
     안전하게 도는 몸(무기·투구·갑주 다 이 위에 얹는다)이고 tint 도 이쪽에만
     먹으므로("일부 스타일엔 색이 안 먹을 수 있음" 캐벗을 아예 없앤다),
     커스텀 화면은 이 여섯만 내준다.
     QRPG_SEEDS[i] 문자열은 `'me:'+i`가 아니라, `oneOf()`의 해시가 실제로
     QRPG 인덱스(0~5)에 떨어지는 걸 미리 찾아 둔 값이다(PowerShell로
     `h=(h*31+charCode)&0xFFFFFFFF; h%26`을 손으로 굴려 확인) — 문자열이
     안 예뻐 보여도 바꾸면 다른 레시피로 튄다, 손대지 말 것.
     **2026-09-07 되돌림 — styleSeed:0(기본값·옛 세이브)도 QRPG_SEEDS[0]으로
     묶는다.** 원래는 "리터럴 'me' 그대로 둬 회귀 없음"이었는데, 'me' 자체가
     해시로 `mpfb_v20`(3.5~4.3MB 몸 + 제 클립이 없어 7.6MB `ANIM_SRC` 리타깃
     까지 추가로 받는다)에 떨어진다 — 커스텀 화면에서 막 잡아낸 바로 그
     MPFB 위험군과 같은 갈래다. 모바일 LTE에서 "너무 느리다"(2026-09-07
     재신고) 원인이 이것으로 보인다 — 위 렌더러 크래시 위험까지 겹쳐 "회귀
     없음"보다 안전이 우선이라 판단했다. 대부분의 플레이어는 커스텀 화면을
     안 열어 봤을 default(styleSeed:0)가 곧 이 갈래라 영향이 가장 크다. */
  var QRPG_SEEDS = ['me:0', 'me:1', 'me:15', 'me:16', 'me:17', 'me:18'];
  function meRenderParams() {
    var core = global.DG.core;
    var ap = (core && core.save && core.save.appearance) || {};
    var n = ap.styleSeed || 0;
    var seed = (n >= 1 && n <= QRPG_SEEDS.length) ? QRPG_SEEDS[n - 1] : QRPG_SEEDS[0];
    return { seed: seed, tint: hexOf(ap.tint, null) };
  }
  function npcShape(nc) {
    var sg = new T.Group();
    box(sg, 0, 15, 0, 13, 20, 10, nc, 'flat', true);
    box(sg, 0, 30, 0, 11, 11, 11, 0xe8c9a4, 'flat', true);
    box(sg, 0, 38, 0, 14, 4, 14, 0x2f333c, 'flat', false);
    return sg;
  }
  function foeShape(r, hh, col) {
    var sg = new T.Group();
    box(sg, 0, hh / 2, 0, r * 1.5, hh, r * 1.2, col, 'flat', true);
    box(sg, 0, hh + r * 0.5, 0, r * 0.9, r * 0.9, r * 0.9, mix(col, 0xffffff, 0.2), 'flat', true);
    return sg;
  }

  /**
   * 몬스터 다양화(PLAN 14절) — 사람 형 적의 무기·투구·망토·수염을 `data-enemy.js`
   * 의 `look` 그대로 걸친다. 옛 도형 시절부터 있던 정보였는데(황건적은 몽둥이,
   * 왜장은 투구+망토…) 3D 화면엔 여태 하나도 안 실렸다 — 다들 같은 사람 모델에
   * 색만 다른 채로 섰다. GLB 갈아 끼우기와 별개로 **`g`(바깥 껍데기)에 얹는다** —
   * `foeBody` 안쪽은 GLB 가 늦게 와서 통째로 갈릴 수 있지만 이 장식은 그대로다.
   */
  /* 2026-09-05 — SAGA WEB.md "F. 소품" 목록의 "무기". 몸은 실사 GLB(QRPG
     창고)인데 무기만 도형(각목)이던 자리를 poly.pizza Quaternius CC0 무기로
     갈아 끼운다. 옛 도형은 fallback 으로 그대로 남긴다(`AS3.build`가 GLB
     실패 시 이 함수를 그대로 부른다) — 위치·자리는 옛 값과 같다.
     mul 은 옛 도형의 길이(r 배수)를 그대로 옮긴 값이다.
     2026-09-05(이어서) — `data-item.js`의 무기 `look` 열 가지를 다 받도록
     `guandao`(월도, spear 재사용)·`scroll`(병서)·`fan`·`brush`(선채·필묵,
     둘 다 붓 모델 하나 공유)를 더했다. 몬스터(`foeGear`)·플레이어 본인
     (`buildActor`의 `kind==='me'`) 둘 다 이 표 하나를 같이 쓴다 —
     `attachWeapon()`으로 뽑아냈다(전엔 `foeGear()` 안에만 있었다) */
  var WPN_MUL = {
    club: 1.3, axe: 1.7, sword: 1.8, spear: 2.6, halberd: 2.8, guandao: 2.8,
    staff: 2.3, bow: 1.7, scroll: 1.0, fan: 1.5, brush: 1.5,
    /* §5.7 시대 퓨전(2026-09-18) — 전자창은 halberd 급 길이, 동력장갑은
       자루 없이 손을 감싸는 상자라 club 보다도 짧다. */
    lance_e: 2.7, gauntlet: 1.2
  };
  function attachWeapon(g, weapon, handX, handZ, shoulderY, r) {
    var wcol = 0xb9c2cf, woodcol = 0x5a4a34;
    var AS3 = AS();
    if (weapon === 'club') {
      var clubShape = function () {
        var sg = new T.Group();
        box(sg, 0, r * 0.55, 0, r * 0.5, r * 1.1, r * 0.5, woodcol, 'flat', true);
        return sg;
      };
      var wnode = AS3 ? AS3.build('wpn:club', 'foe', r * WPN_MUL.club, null, clubShape) : clubShape();
      wnode.position.set(handX, shoulderY, handZ);
      g.add(wnode);
    } else if (weapon === 'axe') {
      var axeShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.2, r * 1.6, r * 0.2, woodcol, 'flat', true);
        box(sg, 0, r * 0.7, 0, r * 0.85, r * 0.5, r * 0.14, wcol, 'flat', true);
        return sg;
      };
      var anode = AS3 ? AS3.build('wpn:axe', 'foe', r * WPN_MUL.axe, null, axeShape) : axeShape();
      anode.position.set(handX, shoulderY, handZ);
      g.add(anode);
    } else if (weapon === 'sword') {
      var swordShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.15, r * 1.7, r * 0.15, wcol, 'flat', true);
        return sg;
      };
      var snode = AS3 ? AS3.build('wpn:sword', 'foe', r * WPN_MUL.sword, null, swordShape) : swordShape();
      snode.position.set(handX, shoulderY, handZ);
      g.add(snode);
    } else if (weapon === 'spear' || weapon === 'halberd' || weapon === 'guandao') {
      var isHalberd = weapon === 'halberd' || weapon === 'guandao';
      var poleShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * (isHalberd ? 2.8 : 2.6), r * 0.12, woodcol, 'flat', true);
        if (isHalberd) { box(sg, 0, r * 1.3, 0, r * 0.85, r * 0.6, r * 0.15, wcol, 'flat', true); }
        else { box(sg, 0, r * 1.2, 0, r * 0.13, r * 0.5, r * 0.13, wcol, 'flat', true); }
        return sg;
      };
      var pnode2 = AS3 ? AS3.build('wpn:' + weapon, 'foe', r * WPN_MUL[weapon], null, poleShape) : poleShape();
      pnode2.position.set(handX, shoulderY, handZ);
      g.add(pnode2);
    } else if (weapon === 'staff') {
      var staffShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * 2.2, r * 0.12, woodcol, 'flat', true);
        box(sg, 0, r * 1.1, 0, r * 0.4, r * 0.4, r * 0.4, 0x9fe8ff, 'glow', false);
        return sg;
      };
      var stnode = AS3 ? AS3.build('wpn:staff', 'foe', r * WPN_MUL.staff, null, staffShape) : staffShape();
      stnode.position.set(handX, shoulderY, handZ);
      g.add(stnode);
    } else if (weapon === 'bow') {
      /* 활은 칼·창과 달리 손 높이를 **가운데** 두고 위아래로 뻗는다. GLB 는
         `normalize()`가 바닥을 y=0 에 놓으므로(다른 무기와 같은 규약),
         도형(fallback)도 활을 그 규약에 맞춰 `bmul/2` 만큼 들어 그려 둔다 —
         그래야 GLB 든 도형이든 바깥 위치는 늘 같은 한 줄(`shoulderY - bmul/2`)로
         가운데를 맞춘다(비동기로 GLB 가 늦게 와도 위치가 안 흔들린다) */
      var bmul = r * WPN_MUL.bow;
      var bowShape = function () {
        var sg = new T.Group();
        var bow = new T.Mesh(geo('bowArc', function () { return new T.TorusGeometry(1, 0.09, 5, 10, Math.PI * 1.4); }),
          mat(woodcol, 'flat'));
        bow.scale.setScalar(r * 0.85);
        bow.position.y = bmul * 0.5;
        bow.rotation.z = Math.PI / 2;
        bow.castShadow = true;
        sg.add(bow);
        return sg;
      };
      var bnode = AS3 ? AS3.build('wpn:bow', 'foe', bmul, null, bowShape) : bowShape();
      bnode.position.set(handX, shoulderY - bmul * 0.5, handZ);
      g.add(bnode);
    } else if (weapon === 'scroll' || weapon === 'fan' || weapon === 'brush') {
      /* 병서(scroll)·선채(fan)·필묵(brush) — 다 가는 막대를 쥔 실루엣이라
         하나의 얇은 막대 fallback 을 같이 쓴다(fan·brush 는 실제 GLB 도
         하나를 공유한다, `asset3d.js` 참고) */
      var thinShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.1, r * WPN_MUL[weapon], r * 0.1, woodcol, 'flat', true);
        return sg;
      };
      var tnode = AS3 ? AS3.build('wpn:' + weapon, 'foe', r * WPN_MUL[weapon], null, thinShape) : thinShape();
      tnode.position.set(handX, shoulderY, handZ);
      g.add(tnode);
    } else if (weapon === 'lance_e') {
      /* §5.7 시대 퓨전(2026-09-18) — 전자창(電子槍). 자루 비례는 halberd와
         같지만 날 대신 발광 촉(staff의 파란 정육면체 결)을 얹어 "미래
         무기"임을 실루엣으로 알린다. 실제 GLB 는 없다 — 이 fallback 이 늘 쓰인다
         (AS3.build 는 'wpn:lance_e' 자산이 없으면 그대로 fallback 만 돌려준다). */
      var laceShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * 2.6, r * 0.12, wcol, 'flat', true);
        box(sg, 0, r * 1.25, 0, r * 0.22, r * 0.7, r * 0.22, 0x6fe0ff, 'glow', false);
        return sg;
      };
      var lnode = AS3 ? AS3.build('wpn:lance_e', 'foe', r * WPN_MUL.lance_e, null, laceShape) : laceShape();
      lnode.position.set(handX, shoulderY, handZ);
      g.add(lnode);
    } else if (weapon === 'gauntlet') {
      /* §5.7 시대 퓨전(2026-09-18) — 동력장갑(動力裝甲). 자루가 없는 첫
         무기라 다른 branches처럼 긴 막대를 안 세우고, 손 둘레를 감싸는
         짧고 두꺼운 상자 + 발광 너클로 그린다. */
      var gauShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.55, r * 0.55, r * 0.55, wcol, 'flat', true);
        box(sg, 0, r * 0.32, r * 0.3, r * 0.5, r * 0.16, r * 0.16, 0xff8c3c, 'glow', false);
        return sg;
      };
      var gnode = AS3 ? AS3.build('wpn:gauntlet', 'foe', r * WPN_MUL.gauntlet, null, gauShape) : gauShape();
      gnode.position.set(handX, shoulderY, handZ);
      g.add(gnode);
    }
  }
  function foeGear(g, look, hh, r, tint, humanGlb) {   // humanGlb: GLB 로 설 사람 몸(레시피 있고 GLB 켜짐)엔 갑주·투구를 안 씌운다(VRM 을 화분처럼 덮었다, W-0100) — 도형 몸은 상자 신호 그대로
    var handX = r * 1.05, handZ = r * 0.25, shoulderY = hh * 0.68;
    var woodcol = 0x5a4a34;
    var AS3 = AS();
    attachWeapon(g, look.weapon, handX, handZ, shoulderY, r);
    /* 2026-09-06 — 갑주(tier). data-item.js/data-enemy.js에 `look.armor`
       필드는 있었지만 여태 아무도 안 그렸다(적도 플레이어도) — 실제 갑주
       GLB가 없으니 몸통을 감싸는 색 다른 상자로 "가죽/판금" 실루엣 신호만
       준다. 나중에 진짜 갑주 GLB를 구하면 이 키(`gear:armor:*`)로 등록만
       하면 AS3.build가 자동으로 갈아 끼운다. */
    if (!humanGlb && (look.armor === 'leather' || look.armor === 'plate')) {
      var armMul = hh * 0.62;
      var armFallback = function () {
        var sg = new T.Group();
        var acol = look.armor === 'plate' ? 0x8a8f9a : 0x5a4632;
        box(sg, 0, armMul * 0.5, 0, r * 1.3, armMul, r * 1.15, acol, 'flat', true);
        return sg;
      };
      wornGear('gear:armor:' + look.armor, armMul, hh * 0.12, armFallback);
    }
    /* 2026-09-05 — 투구(`helmet`)·왕관(`crown`)을 실사화(poly.pizza). 모자·
       망토류는 칼·창과 달리 몸을 **가운데(또는 제자리)** 두고 걸치는
       물건이라(활과 같은 사정), `normalize()`가 바닥을 y=0 에 두는 규약과
       어긋난다 — fallback 도형도 그 규약(바닥이 0)에 맞춰 다시 그려서,
       도형이든 GLB든 이 한 줄(`bottomY, mul` 또는 `centerY - mul/2`)로
       늘 같은 자리를 잡는다. */
    function wornGear(kind, mul, bottomY, fallbackFn, tintHex) {
      var node = AS3 ? AS3.build(kind, 'foe', mul, tintHex || null, fallbackFn) : fallbackFn();
      node.position.y += bottomY;
      g.add(node);
    }
    function wornGearCentered(kind, mul, centerY, fallbackFn, tintHex) {
      wornGear(kind, mul, centerY - mul * 0.5, fallbackFn, tintHex);
    }
    if (look.cape) {
      /* 2026-09-05(이어서) — 사용자 지시로 CC-BY 완성 망토 모델로 갈아 끼웠다.
         이미 붉·금으로 칠해진 모델이라 tint 를 주면(곱연산) 세력색에 따라
         탁해진다 — 그래서 **GLB 는 tint 없이 제 색 그대로**, fallback 만
         옛 방식대로 세력색을 쓴다(둘의 표현이 달라도 "망토가 있다/없다"
         라는 실루엣 신호는 같다) */
      var capeMul = hh * 0.7, capeBottomY = hh * 0.07;
      var capeFallback = function () {
        var sg = new T.Group();
        box(sg, 0, capeMul * 0.5, 0, r * 1.25, capeMul, r * 0.13,
          mix(tint, 0x000000, 0.25), 'flat', true);
        return sg;
      };
      var capeNode = AS3 ? AS3.build('gear:cape', 'foe', capeMul, null, capeFallback) : capeFallback();
      capeNode.position.set(0, capeBottomY, -r * 0.85);
      capeNode.rotation.x = -0.1;
      g.add(capeNode);
    }
    var headY = hh + r * 0.5, helm = humanGlb ? 'none' : look.helm;
    if (helm === 'helmet' || helm === 'plume') {
      var helmMul = r * 0.7;
      var helmFallback = function () {
        var sg = new T.Group();
        box(sg, 0, helmMul * 0.5, 0, r * 1.0, helmMul, r * 1.0, 0x5a5a62, 'flat', true);
        return sg;
      };
      wornGearCentered('gear:helmet', helmMul, headY + r * 0.35, helmFallback);
      if (helm === 'plume') {
        box(g, 0, headY + r * 0.85, 0, r * 0.2, r * 0.85, r * 0.2, mix(tint, 0xff5a3a, 0.5), 'glow', false);
      }
    } else if (helm === 'gapju') {
      /* 2026-09-05(이어서) — "gapju"(원뿔형 동아시아 투구)란 이름의 CC0/CC-BY는
         끝까지 못 찾았다 — 대신 바이킹 투구(뿔 달림, CC-BY 3.0)를 쓴다.
         대장간=집 모델과 같은 판단: 모양이 정확히 안 맞아도 "이 적은 다른
         투구를 썼다"는 다양성 신호는 충분히 준다 */
      var gapjuMul = r * 0.8;
      var gapjuFallback = function () {
        var sg = new T.Group();
        var cone = new T.Mesh(geo('helmCone', function () { return new T.ConeGeometry(1, 1.3, 8); }),
          mat(woodcol, 'flat'));
        cone.scale.setScalar(r * 0.65);
        cone.position.y = gapjuMul * 0.5;
        cone.castShadow = true;
        sg.add(cone);
        return sg;
      };
      wornGearCentered('gear:gapju', gapjuMul, headY + r * 0.55, gapjuFallback);
    } else if (helm === 'crown') {
      var crownMul = r * 0.86;
      var crownFallback = function () {
        var sg = new T.Group();
        var ring = new T.Mesh(geo('crownRing', function () { return new T.TorusGeometry(1, 0.18, 6, 12); }),
          mat(0xe8c15a, 'glow'));
        ring.scale.setScalar(r * 0.55);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = crownMul * 0.5;
        sg.add(ring);
        return sg;
      };
      wornGearCentered('gear:crown', crownMul, headY + r * 0.5, crownFallback);
    }
    /* look.beard — 2026-09-05, 끝까지 찾아도 진짜 CC0 턱수염 낱개 모델이
       없었다(마스카·콧수염뿐). 실사화 원칙(사용자 지시: 개조·대체가 안
       되면 도형 대신 없는 채로 둔다)에 따라 이 분기를 지웠다 — 수염 있는
       적도 이제 수염 없이 나온다 */
  }

  /** 지금 보이는 것(도형이든 GLB 든) 위 모든 메시의 재질 사본 — 맞으면 이걸 번쩍인다.
   *  GLB 가 도형에서 갈아 끼워지는 순간 사본이 낡으므로, 그 전환(assetState)이
   *  바뀔 때만 다시 뜬다(매 프레임 새로 뜨면 낭비다). */
  function ensureFlash(node) {
    var AS3 = AS();
    var st = node.userData.assetState;
    if (node.userData.flash && node.userData.flashState === st) { return node.userData.flash; }
    var mats = AS3 ? AS3.ownAllMat(node.children[0]) : [];
    node.userData.flash = mats;
    node.userData.flashState = st;
    return mats;
  }

  /** 그림자(shade) 정예의 분신 — 판정엔 있어도 3D 는 여태 본체와 똑같이 서
   *  있었다(몬스터 다양화가 남긴 숙제). 지금 보이는 메시를 사본 떠서 반투명
   *  보랏빛으로 물들인다. `ensureFlash` 와 달리 **`mixerNode`(진짜 shell) 의
   *  `assetState`** 를 직접 본다 — 분신은 수명이 짧아 상자에서 GLB 로 갈아
   *  끼워지는 순간을 놓치면 그냥 평범한 적으로 보인다. */
  function ensureShade(node) {
    var body = node.userData.mixerNode;
    if (!body) { return; }
    var st = body.userData.assetState;
    if (node.userData.shadeState === st) { return; }
    var purple = new T.Color(0x9a7ad9);
    body.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      var srcM = Array.isArray(o.material) ? o.material[0] : o.material, TNc = global.DG.toon3d;
      var m = TNc && TNc.cloneMat ? TNc.cloneMat(srcM) : srcM.clone();   // 림·얼굴 셰이더까지 옮긴다(2026-09-23)
      m.transparent = true;
      m.opacity = 0.5;
      m.depthWrite = false;
      if (m.emissive) { m.emissive.copy(purple); m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.5); }
      else if (m.color) { m.color.lerp(purple, 0.4); }
      o.material = Array.isArray(o.material) ? [m] : m;
    });
    node.userData.shadeState = st;
  }

  function buildActor(kind, ref) {
    var g = new T.Group();
    var AS3 = AS();
    if (kind === 'npc') {
      /* 마을 사람 — 사가고와 같은 GLB(사람 창고)를 쓴다. 진영색 대신
         **이 사람 고유의 옷 빛깔**로 물들인다(town.js 의 뜻 그대로) */
      var nc = hexOf(ref && ref.color, 0x8a6f4e);
      /* 세 시대 손님(§5.20)은 제 몸(`folk:*`, 제 클립·제 옷) — 물들이지 않는다 */
      var body = AS3 && ref && ref.model ? AS3.build(ref.model, 'npc:' + ref.key, 40, null, function () { return npcShape(nc); }) :
        AS3 ? AS3.buildHero('npc:' + ((ref && ref.key) || ''), 40, ref && ref.color,
        function () { return npcShape(nc); }) : npcShape(nc);
      g.add(body);
      g.userData.mixerNode = body;
      /* 발밑 고리 — 말이 걸리는 거리에 들어서면 켜진다 */
      var nr = box(g, 0, 0.8, 0, 44, 1.6, 44, 0xffd489, 'glow', false);
      nr.visible = false;
      g.userData.ring = nr;
      g.userData.label = labelNode(((ref && ref.emoji) || '') + ' ' + ((ref && ref.name) || ''), 54, 72);
      g.add(g.userData.label);
      return g;
    }
    if (kind === 'mark') {
      /* 표식 — 사람이 아니라 **밟는 것**이다. 셋의 성격이 달라 빛깔로 가른다 */
      var mkey = (ref && ref.key) || '';
      /* PLAN §28-4 Phase 1 — 굴혈이 마을방 고정 표식(gate)에서 들길
         (exit_dungeon)로 옮겨졌지만, 초록 팻말(isExit)이 아니라 여전히
         굴혈다운 검은 구멍으로 보여야 한다 — isGate로 함께 묶는다. */
      var isGate = mkey === 'gate' || mkey === 'exit_dungeon';
      var isExit = mkey.indexOf('exit_') === 0 && !isGate;
      var glow = mkey === 'waypoint' ? 0x3aa9c9 : (mkey === 'vow' ? 0xe06565 :
        (isExit ? 0x7fd858 : 0xffb45a));
      var base = isGate ? 0x14161c : 0x4a4f5a;
      box(g, 0, 2.5, 0, 46, 5, 46, base, 'flat', false);         // 밟는 자리
      if (isGate) {
        /* 굴혈 — 내려가는 구멍이다. 기둥을 세우지 않고 **바닥을 뚫어** 보이게 한다 */
        box(g, 0, 4, 0, 30, 3, 30, 0x000000, 'flat', false);
        box(g, 0, 6, 0, 22, 1.5, 22, glow, 'glow', false);
      } else if (mkey === 'waypoint') {
        box(g, 0, 12, 0, 20, 20, 20, 0x2a3a4a, 'flat', true);
        box(g, 0, 25, 0, 26, 4, 26, glow, 'glow', false);
      } else if (isExit) {
        /* 들길(오버월드, PLAN 28-1절) — 비석이 아니라 **팻말**이다.
           장대 하나에 판을 얹어 "여기서 다른 마을로" 라는 느낌을 준다. */
        box(g, 0, 20, 0, 6, 40, 6, 0x5c4632, 'flat', true);
        box(g, 0, 34, 0, 26, 8, 3, glow, 'glow', false);
      } else {
        box(g, 0, 17, 0, 16, 34, 8, 0x6a6a75, 'flat', true);     // 비석
        box(g, 0, 36, 0, 12, 4, 10, glow, 'glow', false);
      }
      var mr = box(g, 0, 0.8, 0, 56, 1.6, 56, glow, 'glow', false);
      mr.visible = false;
      g.userData.ring = mr;
      g.userData.label = labelNode(((ref && ref.emoji) || '') + ' ' + ((ref && ref.name) || ''), 50, 82);
      g.add(g.userData.label);
      return g;
    }
    if (kind === 'me') {
      var meParams = meRenderParams();
      /* 2026-09-09 — GLB 도착 전 흰빛 도는 각목 도형(옛 meShape())이 실기기에서
         "저 하얀 캐릭터 없애는 게 낫겠다"는 신고를 받았다. 도형을 아예 안
         넘기면 `buildHero`가 GLB 다 실릴 때까지 shell을 비워 둔다 —
         빈 자리보다는 낫다던 placeholder를, 사용자가 빈 자리 쪽을 골랐다. */
      var meBody = AS3 ? AS3.buildHero(meParams.seed, 42, meParams.tint, null) : new T.Group();
      g.add(meBody);
      g.userData.mixerNode = meBody;
      /* 실제 장착 무기·투구·갑주는 GLB 진행 상태와 무관하게 `g`(바깥 껍데기)에
         따로 얹는다(`foeGear()`가 내부에서 `attachWeapon`을 부른다). */
      foeGear(g, meLookOf(), 31.2, 12, null, !!(AS3 && meBody.userData.body && AS3.tuned('asset3d.glb', 1)));
      return g;
    }
    if (kind === 'mount') {
      /* 탈것(mount.js) — 펫 몸(말·학·용)을 발밑에 세운다. GLB 가 오기 전엔 도형 */
      var mrf = ref || {};
      var mBody = AS3 ? AS3.build(mrf.model || 'pet:horse', 'mount:' + (mrf.id || ''), mrf.h || 46, null, function () { return foeShape(12, mrf.h || 46, 0x8a6a45); }) : new T.Group();
      g.add(mBody);
      g.userData.mixerNode = mBody;
      return g;
    }
    if (kind === 'ally') {
      /* 동행(同行, PLAN §51) — 부대 2번째 인물. 'me'와 같은 몸(buildHero) ·
         장비(foeGear) 조립이지만, seed를 그 인물 id로 박아 선두와
         다른 조합(생김새)이 나오게 한다 — `npc:'+key`와 같은 요령이다. */
      var allyId = (ref && ref.id) || 'ally';
      var allyBody = AS3 ? AS3.buildHero('ally:' + allyId, 42, null, null) : new T.Group();
      g.add(allyBody);
      g.userData.mixerNode = allyBody;
      foeGear(g, meLookOf(allyId), 31.2, 12, null, !!(AS3 && allyBody.userData.body && AS3.tuned('asset3d.glb', 1)));
      return g;
    }
    var r = (ref && ref.r) || 12;
    var enemyDef = ref && ref.ref;                    // data-enemy.js 의 그 줄(kind·color·look)
    /* 정예는 여덟 갈래(날쌘·완강한·사나운·되살아나는·가시 돋친·그림자·철갑·호신)
       마다 제 빛깔이 `ELITES` 표에 이미 있는데(`js/dungeon.js`), 3D 는 여태
       전부 같은 보랏빛으로 뭉뚱그렸다 — 그 표의 색을 그대로 쓴다 */
    var DGd = global.DG.dungeon;
    var eliteDef = ref && ref.elite && DGd ? DGd.eliteOf(ref.elite) : null;
    var col = ref && ref.boss ? 0x9a3a3a : (eliteDef ? hexOf(eliteDef.color, 0x8a5cc0) :
      hexOf(enemyDef && enemyDef.color, 0x6a6a75));
    var hh = r * (ref && ref.boss ? 2.6 : 1.9);
    var isBeast = !!(enemyDef && enemyDef.kind === 'beast');
    var foeBody;
    if (AS3 && isBeast) {
      /* 짐승 형 적 — data-enemy.js 의 `body` 필드로 실제 GLB 를 고른다(없으면
         기본 'beast'=늑대). 2026-09-05 — 몬스터 다양화 하면서 이름 정규식
         (`/코끼리/`으로 큰 놈만 가르던 것)을 표 필드로 뺐다 — 종류가 더 늘어도
         여기는 안 건드리고 data-enemy.js·asset3d.js REG 만 고치면 된다.
         세력색은 안 물들인다(짐승 제 털빛이 맞다) */
      foeBody = AS3.build((enemyDef && enemyDef.body) || 'beast',
        (ref && ref.ref && ref.ref.name) || 'beast',
        hh + r * 0.95, null, function () { return foeShape(r, hh, col); });
    } else if (AS3) {
      /* 사람 형 적(황건적·왜구…) — 사람 창고 GLB. 보스·정예가 아니면
         **이 적의 원래 빛깔**(data-enemy.js 의 color)로 물들인다 */
      var tint = ref && (ref.boss || ref.elite) ? col : (enemyDef && enemyDef.color) || null;
      foeBody = AS3.buildHero((enemyDef && enemyDef.name) || 'foe', hh + r * 0.95, tint,
        function () { return foeShape(r, hh, col); });
    } else {
      foeBody = foeShape(r, hh, col);
    }
    g.add(foeBody);
    g.userData.mixerNode = foeBody;
    /* 엘리트·보스는 눈이 빛난다 — 실루엣만으로 위험을 읽게 한다(GLB 위에도 그대로 얹는다) */
    if (ref && (ref.boss || ref.elite)) {
      box(g, 0, hh + r * 0.6, r * 0.5, r * 0.7, r * 0.2, r * 0.2, 0xff5a3a, 'glow', false);
    }
    /* 정예는 발밑에 제 빛깔 고리를 켠다 — 위 눈빛은 "정예다" 만 알리고,
       이 고리 색이 "무슨 정예인지" 를 멀리서도 가른다 */
    if (eliteDef) {
      box(g, 0, 1.2, 0, r * 2.3, 2, r * 2.3, hexOf(eliteDef.color, 0x8a5cc0), 'glow', false);
    }
    /* 몬스터 다양화 — 사람 형 적은 무기·투구·망토·수염을 `look` 데이터 그대로
       걸친다. 옛 도형 시절부터 있던 정보인데 여태 3D 화면엔 하나도 안 실렸다 */
    if (!isBeast && enemyDef && enemyDef.look) {
      /* 세계 보스(§5.4) 부위 파괴 — 부서진 조각만 'none'으로 덮어써서 넘긴다.
         enemyDef.look(=e.ref.look) 자체는 절대 안 건드린다 — 그 보스종의
         공용 정의라, 고치면 다음에 스폰되는 같은 보스까지 무기 없이 나온다. */
      var lk = enemyDef.look;
      if (ref && ref.worldBoss && (ref.wbWeaponBroken || ref.wbArmorBroken || ref.wbHelmBroken)) {
        lk = {
          weapon: ref.wbWeaponBroken ? 'none' : lk.weapon,
          helm: ref.wbHelmBroken ? 'none' : lk.helm,
          armor: ref.wbArmorBroken ? 'none' : lk.armor,
          beard: lk.beard, cape: lk.cape
        };
      }
      foeGear(g, lk, hh, r, col, !!(AS3 && !isBeast && foeBody.userData.body && AS3.tuned('asset3d.glb', 1)));
    }
    return g;
  }

  function actorOf(k, kind, ref) {
    var a = actors[k];
    if (a) { a.seen = frame; return a; }
    var node = buildActor(kind, ref);
    actorGroup.add(node);
    actors[k] = { node: node, seen: frame, ang: 0 };
    return actors[k];
  }

  function sweep() {
    for (var k in actors) {
      if (!Object.prototype.hasOwnProperty.call(actors, k)) { continue; }
      if (actors[k].seen === frame) { continue; }
      actorGroup.remove(actors[k].node);
      delete actors[k];
    }
  }

  /** 가림 페이드(§56, 실기기 제보 "큰 물체 때문에 캐릭터가 안 보여") —
   *  카메라에서 플레이어(대략 가슴 높이)로 광선을 쏴, 그 사이(끝은 살짝
   *  물려 플레이어 자신·발밑 땅은 빼고)에 낀 `wallGroup`·`fieldGroup`
   *  물체만 옅게 만든다. 일반 Mesh(건물·담장·`piece()` 소품)는 재질을
   *  복제해 투명(`opacity` 0.2)으로 — 다른 물체와 재질을 캐시로 나눠
   *  쓰므로(`mat()`) 복제 없이 opacity 를 바로 건드리면 같은 색 전부가
   *  같이 흐려진다. 나무·바위 같은 자연물은 `field-instance.js`가
   *  `InstancedMesh` 하나로 묶어(성능) 인스턴스 하나만 투명하게 못
   *  만드므로, 그 인스턴스만 행렬을 아주 작게 눌러 숨긴다(진짜 페이드는
   *  아니지만 "캐릭터가 안 보인다"는 문제는 그대로 없앤다) — 안 걸리게
   *  되면 원래 행렬로 되돌린다. 매 프레임 새로 걸린 것만 걸고, 이번에
   *  안 걸린 것은 전부 원상복구한다. */
  function updateOcclusion(fromPos, toX, toY, toZ) {
    if (!T || !wallGroup || !fieldGroup) { return; }
    var dx = toX - fromPos.x, dy = toY - fromPos.y, dz = toZ - fromPos.z;
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var k, key;
    if (dist < 30) {
      /* 너무 가까우면(방금 층 진입 등) 광선을 안 쏜다 — 남은 가림만 되돌린다 */
      for (k in occFade) { occFade[k].mesh.material = occFade[k].orig; delete occFade[k]; }
      for (key in occInst) { occInst[key].mesh.setMatrixAt(occInst[key].id, occInst[key].orig); occInst[key].mesh.instanceMatrix.needsUpdate = true; delete occInst[key]; }
      return;
    }
    if (!raycaster) { raycaster = new T.Raycaster(); }
    if (!occDirScratch) { occDirScratch = new T.Vector3(); }
    occDirScratch.set(dx / dist, dy / dist, dz / dist);
    raycaster.set(fromPos, occDirScratch);
    raycaster.near = Math.max(0, dist * 0.06);   // 카메라 렌즈 바로 앞은 뺀다
    raycaster.far = Math.max(0, dist - 26);       // 플레이어 자신·발밑은 뺀다
    var hits = raycaster.far > raycaster.near ? raycaster.intersectObjects([wallGroup, fieldGroup], true) : [];
    var hitMesh = {}, hitInst = {}, i, h;
    for (i = 0; i < hits.length; i++) {
      h = hits[i];
      if (h.object.isInstancedMesh) {
        key = h.object.uuid + ':' + h.instanceId;
        hitInst[key] = true;
        if (!occInst[key]) {
          var m4 = new T.Matrix4();
          h.object.getMatrixAt(h.instanceId, m4);
          if (!occScaleScratch) { occScaleScratch = new T.Vector3(0.001, 0.001, 0.001); }
          var hidden = m4.clone().scale(occScaleScratch);
          h.object.setMatrixAt(h.instanceId, hidden);
          h.object.instanceMatrix.needsUpdate = true;
          occInst[key] = { mesh: h.object, id: h.instanceId, orig: m4 };
        }
      } else if (h.object.isMesh && h.object.material) {
        var mesh = h.object;
        hitMesh[mesh.uuid] = true;
        if (!occFade[mesh.uuid]) {
          if (!mesh.userData.__fadeMat) {
            var fm = (global.DG.toon3d && global.DG.toon3d.cloneMat) ? global.DG.toon3d.cloneMat(mesh.material) : mesh.material.clone();
            fm.transparent = true; fm.depthWrite = false; fm.opacity = 0.2;
            mesh.userData.__fadeMat = fm;
          }
          occFade[mesh.uuid] = { mesh: mesh, orig: mesh.material };
          mesh.material = mesh.userData.__fadeMat;
        }
      }
    }
    for (k in occFade) {
      if (!hitMesh[k]) { occFade[k].mesh.material = occFade[k].orig; delete occFade[k]; }
    }
    for (key in occInst) {
      if (!hitInst[key]) {
        occInst[key].mesh.setMatrixAt(occInst[key].id, occInst[key].orig);
        occInst[key].mesh.instanceMatrix.needsUpdate = true;
        delete occInst[key];
      }
    }
  }

