  /* ── 방 밖 들판으로 나간다 (PLAN 4·5·6절의 나머지 절반) ─────
   * `field3d.js` 가 방 둘레에 세워 둔 세상은 여태 **눈에만 보였다** — 판정은
   * 여전히 방 사각형 안에만 사람을 가뒀다. 여기서 그 절반을 마저 잇는다.
   *
   * 방 안(옛 사각형)에서는 **한 줄도 안 바뀐다** — 문 판정(`p.x > ROOM_W - WALL
   * - P_R - 4`)이 그 경계에 그대로 물려 있으므로, 방 안 동작을 건드리면 그 판정도
   * 같이 흔들린다. 대신 **방 밖으로는 더 나갈 수 있게** 사각형을 넓히고, 들판에
   * 실제로 서 있는 소품(나무·바위·기둥·무너진 벽·절벽·굴 입구)과는 부딪힌다 —
   * `dungeon3d.js` 가 그리는 것과 **같은 값**(`field3d.chunkAt`)을 그대로 읽으므로
   * 눈에 보이는 나무를 그대로 통과하는 일은 없다.
   *
   * 렌더러가 없어도(자가진단) 그대로 돈다 — `field3d` 는 순수 함수다.
   */
  function fieldOn() {
    var D3 = global.DG.dungeon3d;
    return !D3 || !D3.tuned || D3.tuned('dg3d.field', 1) ? true : false;
  }
  function fieldRadiusUnits() {
    var D3 = global.DG.dungeon3d;
    var F = global.DG.field3d;
    /* 2026-09-04 — 예전엔 `D3.tuned('dg3d.fieldR', 6)`로 읽어 손잡이가
       비어 있으면(AUTO, 보통 이 경우다) **하드코딩된 6(HIGH 등급)**으로
       떨어졌다. 그런데 실제로 세워지는 들판 반경(`dungeon3d.fieldR()`)은
       AUTO 등급표(`QUALITY_PRESET`)를 따라 low=2·medium=4·high=6 로 오간다
       — 이 둘이 갈라지면, 여기(마을 출구 팻말 같은 결정 지점 배치)가 늘
       "반경 6"으로 셈하는 사이 실제 땅은 실기기 성능에 따라 그보다 훨씬
       좁게 깔린다. 그 결과가 실기기 제보 "들판에 각진 새까만 사각형" —
       팻말은 (하드코딩된) 6 기준 자리에 섰는데 땅은 AUTO가 낮춘 반경까지만
       깔려, 팻말 둘레만 등등 떠 보이고 나머지는 배경(검정)이 그대로
       비친 것이었다. `D3.fieldR()`(공개 함수, `QUALITY_PRESET`을 그대로
       따른다)를 직접 불러 **실제로 깔리는 반경과 항상 같은 값**을 쓰게
       고쳤다 — 방향광 그림자를 플레이어에 따라가게 한 앞선 시도는 원인이
       아니었다(고립 렌더로 직접 검증, 지우지 않고 남겨 둔다 — 해는 없다). */
    var r = (D3 && D3.fieldR) ? D3.fieldR() : 6;
    return r * (F ? F.CHUNK : 200);
  }
  /**
   * @param ctx 방 치수가 던전과 다른 곳(마을 등)이 빌려 쓸 때만 넘긴다 —
   *            {roomW, roomH, wall, pr}. 없으면 이 방(던전)의 치수 그대로다.
   */
  /**
   * @param ctx.anchor {x,y} — 이 방의 로컬 원점(0,0)이 실제로 서 있는 세계
   *        좌표(PLAN §28-8, 사가블로 오픈월드). 없으면(0,0) — 예전과 완전히
   *        같다(던전 방은 늘 이 필드가 없다, 회귀 없음).
   */
  function inRoomRect(x, y, ctx) {
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL, pr = (ctx && ctx.pr) || P_R;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var lo = wl + pr;
    return x >= ax + lo - 0.01 && x <= ax + rw - wl - pr + 0.01 &&
           y >= ay + lo - 0.01 && y <= ay + rh - wl - pr + 0.01;
  }
  /* 들판 소품 중 **막는 것만** 고른다 — 길·이정표·연못가 갈대 같은 장식은
     지나갈 수 있어야 걷는 맛이 안 답답하다. */
  var FIELD_BLOCK = { tree: 1, rock: 1, pillar: 1, wall: 1, cavemouth: 1 };
  function pieceRadius(pc) {
    var s = pc.s || 1;
    if (pc.t === 'tree') { return 5 * s + 6; }
    if (pc.t === 'rock') { return pc.h * 0.55 * s; }
    if (pc.t === 'pillar') { return 12; }
    if (pc.t === 'wall') { return 46; }             // 길쭉해 원으로 뭉뚱그린다(넉넉하게)
    if (pc.t === 'cavemouth') { return pc.h * 0.6; }
    return 0;
  }
  /**
   * (x,y) 언저리 아홉 조각의 소품과 부딪히는지 — three 없이도 돈다.
   * @param ctx 마을처럼 방 치수·층·씨앗이 던전과 다른 곳이 빌려 쓸 때만 넘긴다 —
   *            {roomW, roomH, pr, floor, roomIdx, theme}.
   */
  function fieldBlockedAt(x, y, ctx) {
    var MTb = global.DG.mount;
    if (MTb && MTb.flying && MTb.flying() && ctx && ctx.town) { return false; }      // 학·용을 타고 뜨면 마을·들판 소품(나무·바위·건물)을 넘는다(mount.js)
    var F = global.DG.field3d;
    var floor = ctx ? ctx.floor : (run && run.floor);
    if (!F || floor === undefined || floor === null) { return false; }
    /* 고정 세계 지도(§5.12, world-map.js) — 마을·들판은 세계 칸 좌표 하나로 정해진
       소품만 본다. 서 있는 마을이 바뀌어도 발밑이 안 바뀌고, 그림(dungeon3d)과 같은 배열이다 */
    var WM = global.DG.worldMap;
    if (ctx && ctx.town && WM) {
      var wW = ctx.roomW || ROOM_W, wH = ctx.roomH || ROOM_H, wpr = ctx.pr || P_R;
      var wcx = Math.floor(x / F.CHUNK), wcz = Math.floor(y / F.CHUNK), qx, qz, qi, ql, qp, qr;
      for (qz = wcz - 1; qz <= wcz + 1; qz++) {
        for (qx = wcx - 1; qx <= wcx + 1; qx++) {
          ql = WM.pieces(qx, qz, wW, wH);
          for (qi = 0; qi < ql.length; qi++) {
            qp = ql[qi];
            if (!FIELD_BLOCK[qp.t]) { continue; }
            qr = pieceRadius(qp);
            if (qr > 0 && Math.hypot(x - qp.x, y - qp.z) < qr + wpr) { return true; }
          }
        }
      }
      return false;
    }
    var roomIdx = ctx ? ctx.roomIdx : (run && run.roomIdx);
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var pr = (ctx && ctx.pr) || P_R;
    var DDf = global.DG.dataDungeon;
    var th = (ctx && ctx.theme) || (run && run.theme) || (DDf ? DDf.themeOf(floor) : null);
    var seed = F.seedOf(floor, roomIdx, th && th.name);
    var corridors = ctx && ctx.corridors;
    /* 앵커(PLAN §28-8) — 이 방의 로컬 원점이 서 있는 세계 좌표. ring(방으로부터
       몇 칸 떨어졌나)은 로컬 기준으로 재야 하므로 칸 좌표에서 빼 준다. 다만
       chunkAt() 자체엔 절대 좌표(cx,cz)를 그대로 넘긴다 — 그래야 마을이든 들판
       이든 같은 칸이 늘 같은 지형을 낸다(이어진 세계의 핵심 불변식). */
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var acx = Math.floor(ax / F.CHUNK), acz = Math.floor(ay / F.CHUNK);
    var ccx = Math.floor(x / F.CHUNK), ccz = Math.floor(y / F.CHUNK), cx, cz, i, pc, r;
    for (cz = ccz - 1; cz <= ccz + 1; cz++) {
      for (cx = ccx - 1; cx <= ccx + 1; cx++) {
        var ring = F.ringOf(cx - acx, cz - acz, rw, rh);
        if (ring === 0) { continue; }              // 방이 걸친 조각엔 소품이 없다
        /* th.name 을 그대로 넘긴다 — dungeon3d.js 가 그리는 것과 같은 편향
           표를 써야 한다(2026-09-05, PLAN 9절 Biome). 안 넘기면 seed 는
           같아도 `kindOf()`가 다른 문턱으로 풀어 **그림과 부딪힘이 어긋난다**
           (보이는 건 나무인데 그 자리는 벽처럼 막힌, 또는 그 반대인 자리가
           생긴다는 뜻 — 실제로 걸어 보지 않으면 안 드러나는 종류의 버그라
           여기 적어 둔다). **통로(PLAN §28-2 Phase 3)도 같은 이유로 같은
           결 판정을 쓴다** — `corridorNameAt()`가 재는 자리가 dungeon3d.js
           의 그림 쪽과 정확히 같아야, 통로 안에서 "보이는 건 나루터 물길인데
           자리는 산길 바위로 막힌" 어긋남이 안 생긴다. 던전 방-방 통로
           (PLAN §28-4 Phase 3)도 같은 이유로 같다 — 계단문 통로만
           `통로:계단`으로 갈리고, 그 밖의 문은 층 테마를 그대로 쓴다. */
        var cTheme = (corridors && F.corridorNameAt) ? F.corridorNameAt(cx, cz, rw, rh, corridors) : null;
        /* th.biome(PLAN §28-8 Phase 3, 절차 생성 마을) — THEME_BIAS 표를
           찾는 이름만 th.biome로 바꾼다(없으면 th.name, 예전과 100% 같다).
           seed(위)는 여전히 th.name(마을마다 고유)로 재 — 같은 biome을
           공유하는 마을 여럿이 똑같은 지형 패턴을 복붙한 듯 반복하지
           않는다, 성격(가중치)만 같고 실제 배치는 마을마다 다르다. */
        /* §5.19 — 그림(dungeon3d `FIELD_D()`, 등급별 0.16~0.375)과 **같은 밀도**로 잰다. 여태 1 로 재서
           안 보이는 나무·바위의 절반 넘게가 길을 막았다. chunkAt 은 밀도가 낮으면 앞쪽 부분집합이라 어긋나지 않는다 */
        var D3f = global.DG.dungeon3d, fDens = D3f && D3f.fieldDens ? D3f.fieldDens() : 1;
        var list = F.chunkAt(cx, cz, seed, ring, fDens, cTheme || (th && (th.biome || th.name)));
        for (i = 0; i < list.length; i++) {
          pc = list[i];
          if (!FIELD_BLOCK[pc.t]) { continue; }
          r = pieceRadius(pc);
          if (r > 0 && Math.hypot(x - pc.x, y - pc.z) < r + pr) { return true; }
        }
      }
    }
    return false;
  }
  /**
   * 사각형 벽(방 안)은 그대로 지키고, 방 밖은 들판 반경까지 넓힌다.
   * 축을 나눠 시도해 **한쪽이 막혀도 다른 쪽은 미끄러진다**(대각선으로 나무에
   * 부딪혀도 그대로 안 멎는다 — 사가고 벽 충돌이 밟아 둔 요령과 같다).
   */
  /**
   * 통로(PLAN §28-2 Phase 2) — `ctx.corridors`의 `{dir,extra,lane,laneAt}` 항목
   * 중 방향이 맞는 것을 **전부** 돌려준다(배열). 마을은 방향(N/E/S/W)당 통로가
   * 하나뿐이라 옛날엔 첫 매치 하나면 됐지만, 던전 방은 **한 방향(E)에 문이
   * 여러 개**(PLAN §28-4 Phase 2) 있어 문마다 다른 결(lane)을 가진 통로가
   * 동시에 여러 개 존재한다 — 그래서 배열로 바꿨다. `ctx.corridors`가 없으면
   * (던전 층·마을이 corridors를 안 넘기면) `null` — 예전과 완전히 같다.
   */
  function corridorReach(ctx, dir) {
    if (!ctx || !ctx.corridors) { return null; }
    var out = null, i;
    for (i = 0; i < ctx.corridors.length; i++) {
      if (ctx.corridors[i].dir === dir) { (out = out || []).push(ctx.corridors[i]); }
    }
    return out;
  }
  /**
   * 방향 dir 로 뻗은 통로들 중 좌표(coord)가 그 결 안에 있는 것들의 `extra`
   * 최댓값(없으면 0) — `boundPlayer`가 그대로 클램프 확장분으로 쓴다.
   * `laneAt`이 없으면(마을 통로처럼 방향당 하나뿐이면) `dflt`(방 중심)와
   * 비교한다 — 옛 동작과 완전히 같다. `laneAt`이 있으면(던전 문마다 다른
   * y) 그 값과 비교해 **문별로 결을 가른다**.
   */
  function corridorExtra(ctx, dir, coord, dflt) {
    var list = corridorReach(ctx, dir), best = 0, i, co, laneAt;
    if (!list) { return 0; }
    for (i = 0; i < list.length; i++) {
      co = list[i];
      laneAt = (co.laneAt != null) ? co.laneAt : dflt;
      if (Math.abs(coord - laneAt) < (co.lane || 0)) { best = Math.max(best, co.extra || 0); }
    }
    return best;
  }
  /**
   * 문마다 통로 하나(PLAN §28-4 Phase 2) — 방향은 늘 'E'(문은 항상 동쪽
   * 벽에 있다), 결 중심(`laneAt`)은 그 문의 y. 마을 통로(4칸)보다 짧다
   * (방 하나 분량이면 충분하다). **방 치수(ROOM_W 등)는 그래픽 등급과
   * 무관한 상수라, 마을 통로가 겪은 AUTO 품질 클램프 함정(2026-09-06,
   * `town.js`의 `builtFieldR`)이 여기엔 없다** — `extra`는 처음부터
   * 고정값이고 매 프레임 다시 계산되는 값에 안 얹는다.
   */
  var DOOR_CORRIDOR_LEN = 1;              // CHUNK 칸 수
  var DOOR_LANE = 34;                     // 옛 문 터치 판정과 같은 반폭
  function doorCorridorUnits() {
    var F = global.DG.field3d;
    return DOOR_CORRIDOR_LEN * (F ? F.CHUNK : 200);
  }
  function doorCorridors(doors) {
    var len = doorCorridorUnits(), out = [], i;
    for (i = 0; i < doors.length; i++) {
      out.push({ dir: 'E', lane: DOOR_LANE, laneAt: doors[i].y, extra: len, kind: doors[i].kind });
    }
    return out;
  }
  /**
   * @param ctx 마을처럼 방 치수·씨앗이 던전과 다른 곳이 빌려 쓸 때만 넘긴다
   *            (inRoomRect·fieldBlockedAt 에 그대로 물려 준다).
   *            `ctx.corridors` — 마을의 들길 통로 예외(위 corridorReach 참고).
   */
  /** 세계 한계(PLAN §28-8) — noRoom(들판, 어느 마을 발판도 아닌 곳)에서
   *  좌표가 한없이 안 커지게만 잡아 두는 바깥 테두리. 지금 세워 둔 앵커
   *  (moru 원점, 위성 4800 안팎)보다 훨씬 넉넉해 실제로는 안 걸린다. */
  var WORLD_LIMIT = 60000;
  /**
   * @param ctx 방 치수·씨앗이 던전과 다른 곳(마을 등)이 빌려 쓸 때만 넘긴다 —
   *            {roomW, roomH, wall, pr}. 없으면 이 방(던전)의 치수 그대로다.
   *            `ctx.anchor` {x,y} — 이 방의 로컬 원점이 서 있는 세계 좌표
   *            (PLAN §28-8). 없으면(0,0) — 던전 방은 늘 없다, 회귀 없음.
   *            `ctx.noRoom` — 방 사각형 자체가 없는 열린 들판(마을 발판
   *            사이). 세계 한계만 두고 소품 충돌만 축분리로 본다.
   */
  function boundPlayer(p, px, py, ctx) {
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    /* 빠져나오기(§5.12) — 이미 소품 안에 서 있으면(무엇 때문이든) 소품 충돌은 안 본다.
       막힌 자리에서 막힌 자리로만 가려 해 영영 못 움직이던 "끼임"이 없어진다.
       벽(방 사각형)·세계 한계는 그대로 지킨다 */
    var stuck = fieldBlockedAt(px, py, ctx);
    if (ctx && ctx.noRoom) {
      var lim = WORLD_LIMIT;
      var wnx = core.clamp(p.x, -lim, lim);
      p.x = (stuck || !fieldBlockedAt(wnx, py, ctx)) ? wnx : px;
      var wny = core.clamp(p.y, -lim, lim);
      p.y = (stuck || !fieldBlockedAt(p.x, wny, ctx)) ? wny : py;
      return;
    }
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL, pr = (ctx && ctx.pr) || P_R;
    var lo = wl + pr, hiX = rw - wl - pr, hiY = rh - wl - pr;
    if (!fieldOn()) {
      p.x = core.clamp(p.x, ax + lo, ax + hiX);
      p.y = core.clamp(p.y, ay + lo, ay + hiY);
      return;
    }
    var R = fieldRadiusUnits(), cx = ax + rw / 2, cy = ay + rh / 2, ext;
    var loX = ax + lo - R, hiXe = ax + hiX + R;
    /* 2026-09-06 — 여기 아래 넷은 R(그때그때의 AUTO 등급 반경)에 더하지
       않고 **최댓값(최솟값)**으로 견준다. `corridorExtra()`가 주는 값은
       dungeon.js의 `doorCorridors()`(PLAN §28-4, 던전 방-방 문별 통로)에서
       애초에 등급과 무관한 고정 상수라, R이 나중에 줄어들어도 통로 결의
       도달 가능 거리는 안 줄어든다(R이 더 크면 그냥 그 값을 쓴다 — 정상적인
       AUTO 동작). `laneAt`이 있으면(던전 문마다 다른 y) 그 문의 결만
       넓힌다. **마을(town.js)은 §28-8(오픈월드 A안)부터 이 corridors
       메커니즘 자체를 안 쓴다** — 마을은 이제 늘 `ctx.corridors` 없이
       불리므로(마을 자체가 앵커+noRoom 으로 옮겨감) 여기선 늘 `laneAt`
       없는 옛 방식(방 중심 cx/cy)과 비교하는 자리가 없다, 오직 던전
       문 통로만 이 경로를 탄다. */
    ext = corridorExtra(ctx, 'E', py, cy);
    if (ext) { hiXe = Math.max(hiXe, ax + hiX + ext); }
    ext = corridorExtra(ctx, 'W', py, cy);
    if (ext) { loX = Math.min(loX, ax + lo - ext); }
    var nx = core.clamp(p.x, loX, hiXe);
    p.x = (stuck || inRoomRect(nx, py, ctx) || !fieldBlockedAt(nx, py, ctx)) ? nx : px;
    var loY = ay + lo - R, hiYe = ay + hiY + R;
    ext = corridorExtra(ctx, 'S', p.x, cx);
    if (ext) { hiYe = Math.max(hiYe, ay + hiY + ext); }
    ext = corridorExtra(ctx, 'N', p.x, cx);
    if (ext) { loY = Math.min(loY, ay + lo - ext); }
    var ny = core.clamp(p.y, loY, hiYe);
    p.y = (stuck || inRoomRect(p.x, ny, ctx) || !fieldBlockedAt(p.x, ny, ctx)) ? ny : py;
  }

  /* 2026-09-08 — "몬스터가 단조로워 원작처럼 몰이 사냥이 안 된다"(사용자
     제보). 무리(팩) 단위 스폰을 얹으며(아래 spawnFieldEncounters) 상한도
     같이 올린다 — 팩 하나(2~3마리)가 뜨자마자 예전 상한(4)에 거의 다 차면
     보충 트리클이 사실상 못 돌아 팩이 늘 하나뿐으로 보인다. */
  /* §5.19 — 6 → 18(손잡이 dg.fieldCap). 무리 2~3 → 4~6, 보충 4초 한 마리 → 3초 한 무리 */
  var FIELD_ENEMY_CAP = 6;                // 옛 값(손잡이를 0 으로 되돌릴 때의 기준 — 지금은 FIELD_CAP())

  /**
   * 필드 사냥(PLAN 10절) — 방을 다 안 치워도 방 밖 들판에서 바로 싸울 수 있게,
   * 로밍 몬스터를 들판에 흩어 둔다. **`room.enemies` 배열에 그대로 얹는다** —
   * 렌더링 · 기공파/돌진 충돌 · 미니맵 · 근접 자동 공격이 전부 이 배열을 이미
   * 순회하므로 여기 한 곳만 채우면 나머지는 공짜로 따라온다. `.field` 표시로
   * 방 몬스터와 가른다 — 방 정리(`alive`) 판정과 넉백 clamp가 이 표시를 본다.
   *
   * **자가진단(`DG_NO_DRAW`)에서는 켜지 않는다** — `_test.html`은 전체가 씨앗
   * 하나로 고정된 **하나로 이어진** Math.random() 수열을 쓴다(파일 앞머리 주석 —
   * "원소 피해 항목 하나가 그렇게 넘어갔다"). `spawnEnemy()`를 여기서 더 부르면
   * 그 수열이 밀려 뒤따르는 다른 항목의 기대값이 어긋난다 — three.js 때 밟았던
   * 것과 같은 함정이다. `game.js`가 이미 `minimap.tick()` 같은 비핵심 계는 이
   * 플래그로 끄고 있어(같은 자리), 새로 생긴 이 계도 같은 자리에 둔다. 실제 플레이
   * (`index.html`)에는 이 플래그가 없어 그대로 다 돈다.
   */
  /* 2026-09-07 — "마을은 원작 마을처럼, 몹은 마을 안이 아니라 다른
     마을 가는 길에"(사용자 요청). 마을 사각형(room rect) 안으로는 이미
     `inRoomRect` 판정이 로머를 못 들어오게 막아 왔지만, **스폰 자리**는
     그 담장 바로 밖까지도 허용돼 있어(§57 지형 창-추적으로 그 담장 밖
     원경까지 실제로 다니게 되면서) "작은 마을 바로 곁에 몹이 잔뜩"으로
     느껴졌다. 마을 anchor(중심)에서 이 반경 안쪽은 아예 스폰 후보에서
     뺀다 — 마을 자체(560×360 발판)보다 넉넉히 크고, 마을 사이 거리
     (ANCHOR_DIST=4800, town.js)의 절반보다는 한참 작아 "마을 바로 근처는
     안전, 그 밖 길은 위험"이 살아난다. */
  var TOWN_SAFE_R = 1300;

  /** 마을 anchor(발판 중심) 좌표 — spawnFieldEncounters·stepFieldCombat이 같이 쓴다. */
  function townSafeCenter(ctx) {
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    return { x: ax + rw * 0.5, y: ay + rh * 0.5 };
  }
  /* 2026-09-07 — "몹들이 마을로 침범한다"(사용자). 담장 안(`inRoomRect`)은
     이미 못 들어왔지만, 그건 "방 사각형" 판정이라 **담장 바로 밖**까지는
     플레이어를 쫓아 붙어 설 수 있었다 — 마을 코앞에 몹이 우글대는 것으로
     읽혔다. 스폰만 막던 안전지대(TOWN_SAFE_R)를 **로머의 추격 이동에도**
     그대로 적용한다 — 플레이어가 안전지대 안으로 들어가면 쫓던 로머는
     그 경계에서 멈춘다(원작 야영지가 안전한 것과 같은 규칙). */
  function inTownSafe(x, y, ctx) {
    if (!ctx || !ctx.town) { return false; }
    var c = townSafeCenter(ctx);
    return Math.hypot(x - c.x, y - c.y) < TOWN_SAFE_R;
  }

  /**
   * @param ctx 마을처럼 던전과 다른 방이 빌려 쓸 때만 넘긴다 —
   *            {roomW, roomH, wall, floor, room}. 없으면 이 방(던전)의 run 그대로다.
   */
  /* 2026-09-08 — "원작처럼 몰이 사냥이 안 된다"(사용자 제보) — 하나씩
     따로 흩뿌리면 자리도 종류도 매번 남남이라 "무리를 건드리면 떼로
     달려든다"는 손맛이 안 났다. 자리 하나·종류 하나를 무리(팩) 단위로
     고정하고 그 둘레(PACK_SPREAD)에 2~3마리를 심는다 — count가 1이면
     팩 크기도 1이 돼(아래 min) 기존 트리클 보충(spawnFieldEncounters(1))은
     그대로 단발이다, 회귀 없음. */
  var PACK_SPREAD = 70;
  function spawnFieldEncounters(count, ctx) {
    if (!fieldOn() || global.DG_NO_DRAW) { return; }
    if (!ctx && !run) { return; }
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var floor = ctx ? ctx.floor : run.floor;
    var enemies = ctx ? ctx.room.enemies : run.room.enemies;
    var isTown = !!(ctx && ctx.town);
    var cx0 = ax + rw * 0.5, cy0 = ay + rh * 0.5;
    /* 마을은 지금 플레이어가 있는 자리 둘레에 스폰한다(옛 코드는 늘
       anchor 둘레였다 — 플레이어가 anchor에서 멀리 나가 있으면 거기 있는
       몹이 아니라 엉뚱하게 마을 코앞에 계속 몹이 쌓였다). 던전 방은 옛
       그대로 anchor(=방 중심) 둘레를 쓴다. */
    var px0 = (isTown && ctx.player) ? ctx.player.x : cx0;
    var py0 = (isTown && ctx.player) ? ctx.player.y : cy0;
    var biome = biomeOf(ctx);
    var R = fieldRadiusUnits(), remain = count;
    while (remain > 0) {
      var packSize = Math.min(remain, 4 + Math.floor(Math.random() * 3));   // §5.19 4~6(남으면)
      /* 팩 중심 하나를 고른다 — 예전과 같은 각도·거리 뽑기 */
      var tries = 8, a0, d0, ax2 = 0, ay2 = 0, ok = false;
      while (tries-- && !ok) {
        a0 = Math.random() * Math.PI * 2;
        d0 = (wl + 60) + Math.random() * Math.max(40, R - wl - 60);
        ax2 = px0 + Math.cos(a0) * d0;
        ay2 = py0 + Math.sin(a0) * d0;
        if (isTown && Math.hypot(ax2 - cx0, ay2 - cy0) < TOWN_SAFE_R) { continue; }
        if (inRoomRect(ax2, ay2, ctx) || fieldBlockedAt(ax2, ay2, ctx)) { continue; }
        ok = true;
      }
      if (!ok) { remain -= packSize; continue; }   // 이번 팩은 자리를 못 찾았다 — 개수만 줄이고 다음 팩으로
      var ref = pickEnemyRef(floor, false, biome, regionOf(ctx)), k, tries2, x, y, en;
      for (k = 0; k < packSize; k++) {
        tries2 = 6;
        while (tries2--) {
          x = ax2 + (Math.random() - 0.5) * 2 * PACK_SPREAD;
          y = ay2 + (Math.random() - 0.5) * 2 * PACK_SPREAD;
          if (isTown && Math.hypot(x - cx0, y - cy0) < TOWN_SAFE_R) { continue; }
          if (inRoomRect(x, y, ctx) || fieldBlockedAt(x, y, ctx)) { continue; }
          en = spawnEnemy(floor, false, { x: x, y: y, ref: ref });
          en.field = true;
          enemies.push(en);
          break;
        }
      }
      remain -= packSize;
    }
  }

  /* 2026-09-09 — PLAN §60 "원작 4편식 자유도" 후보 1 "필드 위 특별 조우".
     그냥 지나가는 길이 "뭔가 나올 수도 있는 길"이 되도록, 아주 가끔 정예
     하나가 보물을 지키고 선 자리를 들판에 놓는다. `room.chest`처럼
     "다 치워야 연다" 게이트를 새로 만들지 않고 노획물(`dropItem`·`dropGold`·
     `dropMat`)을 그 자리에 바로 놓는다 — 정예를 무시하고 주우려 들면
     정예가 쫓아오니 그 자체가 위험 부담이다(우물・사당처럼 별도 상태
     플래그를 만들지 않고, "정예 표시가 붙은 살아 있는 필드 로머가
     있는가"만 보고 중복 스폰을 막는다). */
  var FIELD_TREASURE_CHANCE = 0.35;   // 쿨다운이 다 찼을 때 실제로 뜰 확률
  function hasActiveTreasureGuard(ctx) {
    var es = ctx ? ctx.room.enemies : (run && run.room.enemies), i;
    if (!es) { return false; }
    for (i = 0; i < es.length; i++) { if (es[i].treasureGuard && es[i].hp > 0) { return true; } }
    return false;
  }
  function spawnFieldTreasure(ctx) {
    if (!fieldOn() || global.DG_NO_DRAW) { return; }
    if (!ctx && !run) { return; }
    if (hasActiveTreasureGuard(ctx)) { return; }
    if (Math.random() >= FIELD_TREASURE_CHANCE) { return; }
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var floor = ctx ? ctx.floor : run.floor;
    var room = ctx ? ctx.room : run.room;
    var isTown = !!(ctx && ctx.town);
    var cx0 = ax + rw * 0.5, cy0 = ay + rh * 0.5;
    var px0 = (isTown && ctx.player) ? ctx.player.x : cx0;
    var py0 = (isTown && ctx.player) ? ctx.player.y : cy0;
    var R = fieldRadiusUnits(), tries = 8, x = 0, y = 0, ok = false, a0, d0;
    while (tries-- && !ok) {
      a0 = Math.random() * Math.PI * 2;
      d0 = (wl + 60) + Math.random() * Math.max(40, R - wl - 60);
      x = px0 + Math.cos(a0) * d0;
      y = py0 + Math.sin(a0) * d0;
      if (isTown && Math.hypot(x - cx0, y - cy0) < TOWN_SAFE_R) { continue; }
      if (inRoomRect(x, y, ctx) || fieldBlockedAt(x, y, ctx)) { continue; }
      ok = true;
    }
    if (!ok) { return; }
    var guardRef = pickEnemyRef(floor, false, biomeOf(ctx), regionOf(ctx));
    var guard = spawnEnemy(floor, false, { forceElite: true, x: x, y: y, ref: guardRef });
    guard.field = true;
    guard.treasureGuard = true;
    room.enemies.push(guard);
    /* dropItem·dropGold·dropMat 은 모듈의 `run`(클로저 변수)을 직접 읽는다 —
       마을(town.js)이 부를 때는 `run`이 비어 있을 수 있어 `withRun`으로
       잠깐 ctx를 끼운다(stepFieldCombat과 같은 요령). */
    withRun(ctx || run, null, function () {
      dropItem(room, x, y, 24);
      if (Math.random() < 0.4) { dropItem(room, x, y, 24); }
      dropGold(room, x, y, 4);
      if (Math.random() < 0.3) { dropMat(room, x, y, 20); }
    });
    core.log('💰 들판에 보물을 지키는 정예가 나타났다', 'good');
    core.emit('toast', '💰 보물을 지키는 정예!');
  }

  /* 2026-09-10 — PLAN §60 "원작 4편식 자유도" 후보 1 나머지 절반 "방랑 상인".
     던전 방 전용이던 행상 POI(위 rollMerchantStock·room.merchant)를 그대로
     빌려 쓴다 — 새 재고 규칙을 만들지 않고, "방 안에 박힌 좌판"이 아니라
     "들판을 걷다 마주치는 사람"으로만 자리를 바꾼다. `room.npcs`(town.js의
     그 배열, dungeon3d.js가 이미 'npc' 배우로 그려 준다)에 하나 얹으면
     그림도 공짜로 딸려 온다.
     2026-09-10(이어서) — 마을 들판까지 마저 넓힌다. `spawnFieldTreasure`와
     같은 결로 `ctx` 를 받게 고쳤다 — ctx 가 있으면 마을(town.js)이 빌려
     쓰는 것이고, 없으면 던전 자신의 `run` 그대로다. 재고 굴림(rollMerchantStock)·
     구매 처리(buyMerchant)는 `run.merchantChoice` 클로저에 그대로 묶여 있어
     마을 쪽까지는 못 쓴다 — town.js 는 이 NPC를 만나면 독자적인 재고 상태를
     들고 `js/ui.js`의 `#encounter` 창(마을 창과 같은 자리)으로 고르게 한다. */
  var FIELD_MERCHANT_CHANCE = 0.4;   // 쿨다운이 다 찼을 때 실제로 뜰 확률
  function hasActiveFieldMerchant(ctx) {
    var ns = ctx ? ctx.room.npcs : (run && run.room.npcs), i;
    if (!ns) { return false; }
    for (i = 0; i < ns.length; i++) { if (ns[i].fieldMerchant && !ns[i].used) { return true; } }
    return false;
  }
  function spawnFieldMerchant(ctx) {
    if (!fieldOn() || global.DG_NO_DRAW) { return; }
    if (!ctx && !run) { return; }
    if (hasActiveFieldMerchant(ctx)) { return; }
    if (Math.random() >= FIELD_MERCHANT_CHANCE) { return; }
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var room = ctx ? ctx.room : run.room;
    var isTown = !!(ctx && ctx.town);
    var cx0 = ax + rw * 0.5, cy0 = ay + rh * 0.5;
    var px0 = (isTown && ctx.player) ? ctx.player.x : cx0;
    var py0 = (isTown && ctx.player) ? ctx.player.y : cy0;
    var R = fieldRadiusUnits(), tries = 8, x = 0, y = 0, ok = false, a0, d0;
    while (tries-- && !ok) {
      a0 = Math.random() * Math.PI * 2;
      d0 = (wl + 60) + Math.random() * Math.max(40, R - wl - 60);
      x = px0 + Math.cos(a0) * d0;
      y = py0 + Math.sin(a0) * d0;
      if (isTown && Math.hypot(x - cx0, y - cy0) < TOWN_SAFE_R) { continue; }
      if (inRoomRect(x, y, ctx) || fieldBlockedAt(x, y, ctx)) { continue; }
      ok = true;
    }
    if (!ok) { return; }
    if (!room.npcs) { room.npcs = []; }
    room.npcs.push({
      key: 'fieldmerchant', name: '방물장수(方物匠手)', emoji: '🧺', color: '#6f5a8a',
      x: x, y: y, phase: 0, facing: 1,
      fieldMerchant: true, used: false
    });
    core.log('🧺 들판에서 방물장수를 만났다', 'good');
    core.emit('toast', '🧺 지나가던 방물장수!');
  }

  /**
   * 살아 있는 들판 로머 수
   * @param ctx spawnFieldEncounters 와 같은 뜻
   */
  function fieldEnemyCount(ctx) {
    var es = ctx ? ctx.room.enemies : (run && run.room.enemies);
    if (!es) { return 0; }
    var n = 0, i;
    for (i = 0; i < es.length; i++) { if (es[i].field && es[i].hp > 0) { n++; } }
    return n;
  }

  /* ── 월드 보스(§5.4) — 실시간 75초 전투 ──────────────────────────
   * 15분마다(실시간 슬롯, `Math.floor(now/900000)`) 마을 넷 중 하나의
   * 들판에 예고가 뜨고, 슬롯이 시작하면 보스가 나온다. 전투 자체는 새
   * 시스템이 아니다 — `room.enemies`에 `field:true`로 얹으면 위
   * `stepFieldCombat`(플레이어 자동공격·적 AI·`bossPattern`)이 이미
   * 처리한다. 이 절이 새로 다루는 건 (1) 슬롯 스케줄링 (2) 부위 3(무기·
   * 갑주·머리) HP 문턱 (3) 75초 제한 도주 (4) 참가 보상 넷뿐이다.
   *
   * `wbNow()` — Date.now() 를 직접 안 쓰고 이 함수를 거친다. 진단이
   * `_forceNow(v)`로 고정해 슬롯·창구를 결정적으로 재현한다(사가고
   * `weather.force()`와 같은 결, PLAN §9).
   */
  var WB_SLOT_MS = 900000, WB_NOTICE_MS = 180000, WB_FIGHT_MS = 75000;
  var WB_TOWN_IDS = ['moru', 'jajak', 'galdae', 'sogeum'];   // town.js TOWNS 키와 그대로 맞춘다
  var WB_PART_ORDER = ['weapon', 'armor', 'helm'];
  var WB_PART_HP_PCT = [0.8, 0.6, 0.4];   // 부위 HP 각 20% — 이 문턱을 지나면 그 부위가 부서진다
  var forcedNow = null;
  function wbNow() { return forcedNow !== null ? forcedNow : Date.now(); }

  /** 슬롯 → 마을 id. 순수 함수(같은 slot 이면 늘 같은 마을). */
  function wbPickTown(slot) {
    return WB_TOWN_IDS[Math.floor(core.hash2(slot, 0) * WB_TOWN_IDS.length)];
  }
  /** 슬롯 → 보스 정의(BOSSES 풀 전체에서, 층 tier 게이팅 없이). */
  function wbPickBossRef(slot) {
    var ed = global.DG.enemyData;
    var pool = ed && ed.bosses;
    if (!pool || !pool.length) { return null; }
    return pool[Math.floor(core.hash2(slot, 3) * pool.length)];
  }
  /** 슬롯 → 그 마을 들판의 자리. `ctx`는 그 마을이 활성일 때의 raw() —
   *  방 치수·anchor 가 마을마다 달라 ctx 로 받는다(spawnFieldTreasure와 같은 요령).
   *  hash2 로만 고르므로 같은 (slot,ctx) 조합이면 늘 같은 좌표가 나온다. */
  function wbPickPos(ctx, slot) {
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var cx0 = ax + rw * 0.5, cy0 = ay + rh * 0.5;
    var R = fieldRadiusUnits(), i, a0, d0, x, y;
    for (i = 0; i < 8; i++) {
      a0 = core.hash2(slot, 10 + i * 2) * Math.PI * 2;
      d0 = (wl + 120) + core.hash2(slot, 11 + i * 2) * Math.max(60, R - wl - 120);
      x = cx0 + Math.cos(a0) * d0;
      y = cy0 + Math.sin(a0) * d0;
      if (Math.hypot(x - cx0, y - cy0) < TOWN_SAFE_R) { continue; }
      if (inRoomRect(x, y, ctx) || fieldBlockedAt(x, y, ctx)) { continue; }
      return { x: x, y: y };
    }
    return { x: cx0 + wl + 140, y: cy0 };   // 8번 다 막혔으면 안전지대 바로 밖 고정점(드묾)
  }

  /** 지금 그 방에 살아 있는 월드 보스(있으면 하나뿐이다). */
  function wbFindBoss(room) {
    if (!room || !room.enemies) { return null; }
    for (var i = 0; i < room.enemies.length; i++) {
      if (room.enemies[i].worldBoss && room.enemies[i].hp > 0) { return room.enemies[i]; }
    }
    return null;
  }

  /** 예고 표식 하나를 켜고 끈다 — room.marks 에 얹으면 자동지도·3D 화면·
   *  touchCheck(town.js) 이 공짜로 그린다(road·relic 표식과 같은 요령). */
  function wbEnsureNoticeMark(ctx, on) {
    var room = ctx && ctx.room;
    if (!room || !room.marks) { return; }
    var idx = -1, i;
    for (i = 0; i < room.marks.length; i++) { if (room.marks[i].key === 'worldboss') { idx = i; break; } }
    if (on && idx < 0) {
      var pos = wbPickPos(ctx, dstate().world.slot);
      room.marks.push({ key: 'worldboss', name: '세계 보스 예고', emoji: '⚠️',
        x: pos.x, y: pos.y, worldBossNotice: true });
    } else if (!on && idx >= 0) {
      room.marks.splice(idx, 1);
    }
  }

  function wbSpawn(ctx, slot) {
    var ref = wbPickBossRef(slot);
    if (!ref) { return; }
    var pos = wbPickPos(ctx, slot);
    var best = dstate().best || 1;
    var hp = Math.round(enemyHp(best, false) * 8);      // PLAN 수치: 체력 8배
    var dmg = enemyDmg(best, true);
    var e = spawnEnemy(best, true, { x: pos.x, y: pos.y, ref: ref, hp: hp, dmg: dmg });
    e.field = true;
    e.worldBoss = true;
    e.wbSlot = slot;
    e.wbEndAt = slot * WB_SLOT_MS + WB_FIGHT_MS;
    e.wbPartsBroken = 0;
    ctx.room.enemies.push(e);
    core.log('⚔️ 세계 보스 — ' + ref.name + ' 출현! 75초', 'good');
    core.emit('toast', '⚔️ 세계 보스 출현! 75초 안에 처치하세요');
  }

  /** HP 문턱(80·60·40%)을 지날 때마다 부위 하나씩(무기→갑주→머리) 부순다.
   *  실제 효과는 bossPattern(무기)·resistOf(갑주)·strike 크리(머리) 세 곳에
   *  나뉘어 있다 — 이 함수는 플래그만 세운다. */
  function wbCheckParts(e, fxArr) {
    var pct = e.hp / e.hpMax;
    while (e.wbPartsBroken < WB_PART_HP_PCT.length && pct <= WB_PART_HP_PCT[e.wbPartsBroken]) {
      var part = WB_PART_ORDER[e.wbPartsBroken];
      e.wbPartsBroken++;
      if (part === 'weapon') { e.wbWeaponBroken = true; }
      else if (part === 'armor') { e.wbArmorBroken = true; }
      else { e.wbHelmBroken = true; }
      if (fxArr) { fxArr.push({ t: 'pop', x: e.x, y: e.y - e.r, life: 0.4, boss: true }); }
      core.log('💥 세계 보스 부위 파괴 — ' + (part === 'weapon' ? '무기' : part === 'armor' ? '갑주' : '머리'), 'good');
      core.emit('toast', '💥 부위 파괴!');
    }
  }

  /** 참가 보상 — 처치(fled=false)면 전액 + 부적 1 + 토벌첩, 도주(fled=true,
   *  75초 초과)면 30%만. `room`은 호출자가 명시로 준다(kill() 흐름은
   *  `run.room`이지만, 시간 초과 흐름은 run이 아예 없을 수 있어서다).
   *  `best`(현재 최고 층) 기준으로 굴린다 — 마을 필드는 floor 가 늘 0이라
   *  기존 dropItem/dropGold 그대로 부르면 보상이 하찮아진다. */
  function grantWorldBossReward(e, room, fled) {
    var W = dstate().world;
    if (W.bossDone[e.wbSlot]) { return; }
    W.bossDone[e.wbSlot] = true;
    var best = dstate().best || 1;
    var bossCtx = { floor: best, boons: {} };
    withRun(bossCtx, null, function () {
      dropGold(room, e.x, e.y, fled ? 1.8 : 6);
      if (!fled) {
        dropItem(room, e.x, e.y, 55);   // §9 dropItem 주석의 "1.5배≈+20" 어림으로 "전설 확률 ×3" 을 옮긴 값(이번 구현 판단)
        dropMat(room, e.x, e.y, 30);
      }
    });
    if (fled) {
      core.log('💨 세계 보스가 시간 안에 쓰러지지 않아 물러났다 · 보상 30%', 'bad');
      core.emit('toast', '💨 세계 보스가 물러났다 (보상 30%)');
      return;
    }
    var tier = core.clamp(Math.ceil(best / 3), 1, 10);
    var sig = global.DG.item && global.DG.item.addSigil ? global.DG.item.addSigil(tier) : null;
    if (!core.save.dex.worldBoss) { core.save.dex.worldBoss = {}; }
    var dex = core.save.dex.worldBoss;
    if (!dex[e.ref.id]) { dex[e.ref.id] = { count: 0, firstAt: Date.now() }; }
    dex[e.ref.id].count++;
    core.gainFeat(20 + best * 2, '세계 보스 토벌');
    core.emit('worldboss:kill', { id: e.ref.id });   // goals.js §5.6 주간 묶음이 듣는다
    core.log('🏆 세계 보스 처치 — ' + enemyName(e) + (sig && sig.ok ? ' · 부적(티어 ' + sig.sigil.tier + ') 획득' : ''), 'good');
    core.emit('toast', '🏆 세계 보스 격파!');
    core.emit('changed');
    core.persist();
  }

  /**
   * town.js update() 가 매 틱 부른다(다른 spawnField* 와 같은 자리).
   * @param ctx town.js raw() — `townId` 필드(2026-09-18 추가)로 지금 마을을 안다.
   * @param fxArr 부위 파괴 연출을 받을 배열(town.js 의 fx()).
   */
  function stepWorldBoss(ctx, fxArr) {
    if (!ctx || !ctx.town || ctx.wild) { return; }
    var now = wbNow();
    var slot = Math.floor(now / WB_SLOT_MS), slotStart = slot * WB_SLOT_MS;
    var W = dstate().world;
    if (W.slot !== slot) {
      W.slot = slot; W.townId = wbPickTown(slot); W.spawned = false;
      /* 지난 슬롯 done 기록은 굳이 안 지운다(하루 96개, 무한 누적 아님 —
         세이브를 좀먹을 만큼 크지 않다). */
    }
    var here = ctx.townId === W.townId;
    var notice = here && now >= slotStart - WB_NOTICE_MS && now < slotStart;
    var active = here && now >= slotStart && now < slotStart + WB_FIGHT_MS;
    wbEnsureNoticeMark(ctx, notice);
    if (!here) { return; }
    if (active) {
      if (W.bossDone[slot]) { return; }
      var b = wbFindBoss(ctx.room);
      if (b) {
        wbCheckParts(b, fxArr);
        if (now >= b.wbEndAt) { wbFlee(b, ctx); }
      } else if (!W.spawned) {
        W.spawned = true;
        wbSpawn(ctx, slot);
      }
      return;
    }
    if (!notice) {
      var stray = wbFindBoss(ctx.room);   // 창구가 끝났는데 아직 살아 있으면 정리
      if (stray) { wbFlee(stray, ctx); }
    }
  }

