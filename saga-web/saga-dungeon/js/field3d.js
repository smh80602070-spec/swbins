/**
 * 들판 — 방 밖으로 세상이 이어진다 (3D 전환 2단계)
 * ---------------------------------------------------------------
 * 1단계에서 방 하나를 입체로 세웠다. 그런데 그 방은 **허공에 뜬 상자**였다 —
 * 벽 너머는 새까맣고, 문을 나가도 또 같은 상자다. `PLAN.md` 10절이 바라는 것은
 * 그 반대다: 넓은 지형 · 숲 · 폐허 · 바위 · 절벽 · 길 · 강 · 동굴 입구 · 제단 · 캠프.
 *
 * 이 파일 자체는 여전히 **순수 값 생성기**다 — `chunkAt()` 이 돌려주는
 * `{t,x,z,s,rot,h}` 는 좌표·크기값일 뿐이고, 그걸 그림으로 쓸지(`dungeon3d.js`)
 * 충돌로 쓸지(`dungeon.js`)는 부르는 쪽이 정한다.
 *
 * **"걸어 나갈 수는 없다"는 옛 이야기다.** 처음엔(이 파일이 막 생겼을 때)
 * 방 둘레에 세상만 세워 두고 판정은 손대지 않았지만, 바로 다음 단계
 * (커밋 `4a67af2` "판정을 방에서 필드로 잇는다")에서 `dungeon.js` 의
 * `boundPlayer()` 가 이 파일의 `chunkAt()` 을 그대로 읽어 방 경계를
 * 필드 반경만큼 넓히고, 나무·바위·기둥·절벽 같은 "보이는 소품"에만 막히게
 * 됐다. 그 뒤 `f93f2e2`(필드 전투)·`51131b3`(마을에도 이식)·`ab560b1`
 * (반경 확대)까지 쌓여, 지금은 던전 방에서도 실제로 벽 밖으로 걸어나가
 * 들판의 로밍 몬스터와 싸운다. 회귀는 `_test.html` "필드 on/off" 두 항목이
 * 붙들고 있다.
 *
 * 5절이 못박은 **씨앗 기반**을 지킨다 — `chunkAt()` 은 순수 함수라 같은 씨앗이면
 * 늘 같은 세상이 나온다. 그래서 자가진단이 값으로 붙들고, 같은 방에 다시 들어가도
 * 풍경이 안 바뀐다.
 *
 * 6절의 **chunk** 도 그대로다. 200 크기 조각으로 나누고 **가까운 것만** 세운다.
 * 반경 3 이면 7×7 = 49 조각, 1400×1400 — 방(560×360)의 예닐곱 배다.
 */
(function (global) {
  'use strict';

  /** 조각 한 변 */
  var CHUNK = 200;

  /**
   * 두 수를 섞어 0~1 을 낸다.
   * **격자 좌표에 쓰는 흔한 해시를 쓰면 안 된다** — 큰 수를 넣으면 이웃한 입력이
   * 이웃한 답을 준다(사가만리에서 주민 둘이 같은 자리에 겹쳐 섰던 그 함정이다).
   */
  function mix(a, b) {
    var h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519);
    h ^= h >>> 13; h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** 이 방의 씨앗 — 층과 방 번호에서 뽑는다. 같은 방이면 늘 같은 풍경이다 */
  function seedOf(floor, roomIdx, theme) {
    return (Math.imul(floor | 0, 73856093) ^ Math.imul((roomIdx | 0) + 1, 19349663) ^
            Math.imul(hashStr(theme || ''), 83492791)) >>> 0;
  }
  function hashStr(s) {
    var n = 0, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) { n = (n * 31 + s.charCodeAt(i)) % 100000; }
    return n;
  }

  /**
   * 땅의 높이 — **순수 함수다.**
   *
   * 2026-09-08 — 사용자가 "필드가 평평하게 해줄 수 있어"로 명시적으로
   * 요청해, 옛 4절("단순 평면 하나가 아니라 높낮이가 있는 지형") 취지를
   * 뒤집었다. 방 안팎 가리지 않고 늘 0 — 굴곡 계산 자체를 없앴다(이 함수를
   * 부르는 쪽은 그대로 두어도 늘 평평한 값만 받는다). 판정은 원래도
   * 평면에서 돌았으니(방 안이 늘 0이던 이유) 이제 방 안팎이 같은 규칙이라
   * 오히려 "보이는 것과 걷는 것이 어긋난다"는 걱정이 완전히 없어졌다.
   */
  function heightAt() { return 0; }

  /* ── 무엇이 서나 ─────────────────────────────────────
   * 조각마다 성격을 하나 정하고 그 성격에 맞는 것을 세운다.
   * 5절 "완전 랜덤이 아니라 플레이 가능한 결과만" — 그래서 성격은 **거리로도** 갈린다:
   * 방 가까이는 길과 캠프, 멀리는 숲과 절벽.
   */
  /* 2026-09-08 — 사용자가 "절벽도 없애줘"로 명시 요청, cliff kind 자체를
     제거(평평화 요청의 연장 — 평평한 땅 위에 큰 산 덩어리 장식만 남아
     있던 것도 "안 평평해 보인다"는 지적). 선택 표(KINDS·FAR_BASE_W·
     ring≥3 order)에서 다 뺐다 — THEME_BIAS 의 cliff 항목은 안 쓰이는
     채로 남아 있어도 무해하지만(참조하는 order 배열에 없으면 그냥
     안 뽑힌다), 소품을 실제로 세우는 chunkAt()·piece() 의 cliff 분기는
     죽은 코드라 같이 지웠다(아래). */
  var KINDS = ['forest', 'rock', 'ruin', 'road', 'water', 'cave', 'altar', 'camp', 'swamp'];

  /* 2026-09-05 — PLAN 9절 "지역별 Biome... 색감·조명·오브젝트·적 종류가
     달라야 한다" 감사 결과: `data-dungeon.js`의 여섯 층 테마(고분·폐성·
     산채·수궁·지옥문·천계)는 **색감**(바닥·벽·색조)만 다르고 **오브젝트**는
     여태 전부 같은 확률로 섞여 나왔다 — 지옥문 밖에도 숲이 고분만큼
     흔했다. 원래 문턱(threshold) 표를 **가중치**로 바꿔 쓰면(기본 가중치가
     원래 문턱 폭과 정확히 같은 값이라 `theme` 을 안 주면 결과가 한 글자도
     안 바뀐다 — 자가진단이 이 함수를 늘 테마 없이 부른다) 테마마다 표를
     한 줄 더하는 것만으로 결이 갈린다. 새 kind 는 안 늘렸다(있는 것만
     섞는 비율을 바꿨다) — PLAN 44절 "필요 없는 것 추가 금지". */
  var FAR_BASE_W = { forest: 30, rock: 16, ruin: 12, water: 8, swamp: 6, road: 6, cave: 4, altar: 3, camp: 3 };
  var MID_BASE_W = { forest: 34, rock: 21, ruin: 15, road: 15, water: 15 };
  var THEME_BIAS = {
    '고분(古墳)': { ruin: 2.2, altar: 2.4, rock: 1.3, forest: 0.5, swamp: 0.5 },
    '폐성(廢城)': { ruin: 2.4, road: 1.5, rock: 1.2, forest: 0.5 },
    '산채(山寨)': { forest: 1.8, camp: 1.5, water: 0.5, ruin: 0.6 },
    '수궁(水宮)': { water: 3, swamp: 2.6, forest: 0.5, rock: 0.6 },
    '지옥문(地獄門)': { rock: 1.6, ruin: 1.6, forest: 0.3, water: 0.3 },
    '천계(天界)': { altar: 3, road: 1.6, forest: 1.3, swamp: 0.15, ruin: 0.4 },
    /* 2026-09-05 — PLAN §28-2 Phase 3(오픈월드 통로). 마을 사이 통로도
       "층 테마" 와 똑같은 자리(THEME_BIAS)를 빌려 쓴다 — 새 표를 안 만든다.
       이름은 목적지 마을 id(`통로:<id>`)로 갈라, 목적지의 성격(나루터·
       산길·염전)에 맞춰 자연스럽게 고른다. */
    '통로:galdae': { water: 2.8, road: 1.6, swamp: 0.6, forest: 0.5 },  // 나루터 — 물길
    '통로:jajak':  { rock: 1.7, forest: 1.1, road: 0.8, water: 0.3 },   // 산길 — 벼랑길
    '통로:sogeum': { road: 1.7, swamp: 1.5, water: 1.3, forest: 0.4 },  // 염전 — 개펄길
    /* 2026-09-05 — PLAN §28-4 Phase 1(던전도 "걸어서 이어지게"). 던전 입구
       통로(`통로:dungeon`)는 목적지가 마을이 아니라 굴혈이니 cave(동굴 입구,
       chunkAt의 kind==='cave' → cavemouth 소품)를 확 밀어 준다 — 새 소품
       없이 이미 있는 cavemouth를 재활용한다(위 주석과 같은 이유). */
    '통로:dungeon': { cave: 5, rock: 0.8, forest: 0.2, water: 0.15 },
    /* 2026-09-06 — PLAN §28-4 Phase 3(방-방 통로에 던전 테마 소품). 문마다
       통로(`doorCorridors()`, PLAN §28-4 Phase 2)엔 목적지 마을이 없어
       `co.to`가 없다 — 그래서 대부분은 지금 층 테마를 그대로 쓴다(문 종류별
       분위기까지는 안 늘린다, PLAN §44). 다만 **계단문(`stair`)만은** 층을
       내려가는 자리라 "동굴 입구"(cavemouth, dg:stairs와 같은 자리에 이미
       세워지는 그림)를 확 밀어 자연스러운 "내려가는 통로"로 잇는다 —
       `통로:dungeon`(Phase 1, 던전 입구)과 같은 이유·같은 가중치를 그대로
       재사용한다(새 표 아님). */
    '통로:계단': { cave: 5, rock: 0.8, cliff: 0.7, forest: 0.2, water: 0.15 },
    /* 2026-09-06 — PLAN §28-8 Phase 3(절차 생성 마을). 손으로 지은 넷은
       theme.name이 곧 표시 이름(모루골 등)이라 이 표에 안 걸려(테마 없이
       고른 것과 같다) — 절차 생성 마을은 대신 `theme.biome`("town:"+biome)
       를 따로 둬서 이 표를 참조한다("통로:*"·던전 여섯 층과 이름이 안
       겹치게 접두를 달았다). 다섯 성격(숲·폐허·늪·산·사당)마다 그 결에
       맞는 소품이 늘게만 갈랐다 — 새 kind는 안 늘렸다(PLAN §44). */
    'town:forest':   { forest: 2.2, camp: 1.4, road: 1.2, rock: 0.8, water: 0.6 },
    'town:ruins':    { ruin: 2.4, rock: 1.4, road: 1.3, forest: 0.5 },
    'town:swamp':    { swamp: 2.6, water: 2.0, road: 1.0, forest: 0.5, rock: 0.4 },
    'town:mountain': { rock: 1.8, forest: 0.8, road: 0.7, water: 0.3 },
    'town:shrine':   { altar: 2.6, road: 1.6, forest: 1.1, ruin: 0.6, swamp: 0.2 }
  };
  /** 가중치 표(order·baseW)에서 h(0~1) 하나로 kind 하나를 고른다 —
   *  theme 이 없으면(자가진단 등) 원래 고정 문턱과 정확히 같은 결과를 낸다 */
  function weightedKind(order, baseW, h, theme) {
    var bias = THEME_BIAS[theme], i, w, total = 0, acc = 0, roll;
    var ws = [];
    for (i = 0; i < order.length; i++) {
      w = baseW[order[i]] * ((bias && bias[order[i]]) || 1);
      ws.push(w); total += w;
    }
    roll = h * total;
    for (i = 0; i < order.length; i++) {
      acc += ws[i];
      if (roll < acc) { return order[i]; }
    }
    return order[order.length - 1];
  }

  /* 2026-09-07 — "다른 마을로 가는 길을 연결해줘"(사용자, town.js
     connectAndRoadTowns() 참고). town.js가 마을 쌍마다 잇는 선분을 여기서
     지연 조회한다(town.js는 field3d.js보다 먼저 실리므로, 로드 시점엔
     `global.DG.field3d`가 아직 없어 town.js 쪽에서 먼저 등록을 못 건다 —
     그래서 반대로 이쪽이 부를 때마다 `global.DG.town`을 찾는다). town.js가
     아직 안 실렸으면(순서가 안 맞거나 다른 판이 이 파일만 빌려 쓰면)
     조용히 없는 셈 친다 — 새 예외 자리를 만들지 않는다. */
  var TOWN_ROAD_BAND = 70;   // 선분에서 이 안쪽은 무조건 길 — CHUNK(200)의 1/3 남짓, 한 사람 폭
  function distToSeg(px, pz, ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az;
    var len2 = dx * dx + dz * dz;
    var t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  }
  /* `fieldBlockedAt`(dungeon.js)이 이동 판정으로 매 프레임 아홉 조각씩
     다시 묻는다 — 길 선분(최대 수백 개)을 매번 다 훑으면 이동 중 프레임
     비용이 늘어난다("이동할 때마다"류 문제를 하나 고치며 새로 하나
     만들면 안 된다). 길 판정은 세계가 고정된 뒤로는 절대 안 바뀌므로
     (town.js가 로드 시 한 번만 ROAD_SEGMENTS를 정한다) 칸 좌표로 그냥
     캐싱한다 — 같은 칸을 다시 물으면 공짜다. */
  var townRoadCache = {};
  /* 2026-09-24 §5.12 — 세계 지도 굽기(칸 23만)가 칸마다 선분 수백 개를 훑으면 몇 초가
     걸렸다. 선분마다 20 간격으로 짚어 가며 그 점 둘레 3×3 칸만 **같은 산식**(칸 중심과
     선분 거리 < 70)으로 재서 한 번에 굽는다 — 칸 중심에서 70 안의 선분 위 점은 가장
     가까운 짚은 점에서 10 안이라, 그 짚은 점은 늘 이 칸이나 이웃 칸(200) 안이다(빠짐 없음) */
  var townRoadRaster = null;
  function buildRoadRaster(segs) {
    var R = {}, i, s, n, k, px, pz, sx, sz, ox, oz, cx, cz, key;
    for (i = 0; i < segs.length; i++) {
      s = segs[i];
      n = Math.max(1, Math.ceil(Math.hypot(s.bx - s.ax, s.bz - s.az) / 20));
      for (k = 0; k <= n; k++) {
        px = s.ax + (s.bx - s.ax) * k / n; pz = s.az + (s.bz - s.az) * k / n;
        sx = Math.floor(px / CHUNK); sz = Math.floor(pz / CHUNK);
        for (oz = -1; oz <= 1; oz++) {
          for (ox = -1; ox <= 1; ox++) {
            cx = sx + ox; cz = sz + oz; key = cx + '_' + cz;
            if (R[key]) { continue; }
            if (distToSeg(cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2, s.ax, s.az, s.bx, s.bz) < TOWN_ROAD_BAND) { R[key] = true; }
          }
        }
      }
    }
    return R;
  }
  function onTownRoad(cx, cz) {
    var key = cx + '_' + cz;
    var cached = townRoadCache[key];
    if (cached !== undefined) { return cached; }
    if (!townRoadRaster) {
      var T0 = global.DG && global.DG.town, sg = T0 && T0.roadSegments ? T0.roadSegments() : null;
      if (sg && sg.length) { townRoadRaster = buildRoadRaster(sg); }
    }
    if (townRoadRaster) { return (townRoadCache[key] = !!townRoadRaster[key]); }
    var T = global.DG && global.DG.town, result = false, segs, i, s, wx, wz;
    if (T && T.roadSegments) {
      segs = T.roadSegments();
      if (segs && segs.length) {
        wx = cx * CHUNK + CHUNK / 2; wz = cz * CHUNK + CHUNK / 2;
        for (i = 0; i < segs.length; i++) {
          s = segs[i];
          if (distToSeg(wx, wz, s.ax, s.az, s.bx, s.bz) < TOWN_ROAD_BAND) { result = true; break; }
        }
      }
    }
    townRoadCache[key] = result;
    return result;
  }

  /** @param theme 층 테마 이름(`data-dungeon.js`의 `themeOf(floor).name`) —
   *  없으면(자가진단·옛 호출) 테마 편향 없이 예전과 완전히 같은 문턱을 쓴다 */
  function kindOf(cx, cz, seed, ring, theme) {
    var h = mix(cx * 31 + seed, cz * 57 - seed);
    /* 방 바로 곁(ring 1)은 사람이 지나간 자리 — 길·캠프·폐허(테마 편향 안 줌,
       방 코앞은 어느 층이든 "지나다닌 자리"로 남아야 읽기 쉽다) */
    if (ring <= 1) { return h < 0.42 ? 'road' : (h < 0.62 ? 'camp' : (h < 0.82 ? 'ruin' : 'rock')); }
    /* 마을 사이 길(위 onTownRoad) — ring 2 이상에서만 본다(ring 0·1은 이미
       위에서 갈렸다). 테마 편향보다 우선한다 — 길은 지나는 지역이 숲이든
       늪이든 그 자리만은 늘 길이어야 "이어진 길"로 읽힌다. */
    if (ring >= 2 && onTownRoad(cx, cz)) { return 'road'; }
    /* 2026-08-30 — 실기기(PC)에서 "제1층 시작하자마자 캐릭터를 가린다" 로
       잡힌 것: 큰 소품(동굴 입구·제단처럼 화면을 막을 만한 것)이 ring 2
       (방에서 chunk 하나 남짓, 카메라 거리 700 안쪽)에서도 날 수 있었다.
       카메라는 **회전이 없어 늘 같은 쪽을 본다**(17행) — 그 각도에 큰
       소품이 걸리면 매번 그 방을 볼 때마다 막힌다. ring 2는 숲·바위·폐허·
       길·물처럼 상대적으로 작은 것까지만 두고, 동굴 입구·제단처럼 큰 것은
       ring 3(그 다음 고리, 저 멀리)부터만 나오게 물렸다 — 이 다섯 안에서만
       테마가 비율을 바꾼다, cave·altar 는 여기 못 들어온다.
       (2026-09-08 — cliff 는 사용자 요청으로 아예 없앴다, 위 KINDS 주석 참고) */
    if (ring === 2) { return weightedKind(['forest', 'rock', 'ruin', 'road', 'water'], MID_BASE_W, h, theme); }
    /* ring 3 이상 — 저 멀리. 여기서만 동굴 입구·제단·늪처럼 큰(또는
       분위기가 센) 것이 난다(PLAN 9절 Biome 색). 늪도 물처럼 ring 2 에는
       안 둔다 — 썩은 나무가 방 코앞을 막으면 안 된다 */
    return weightedKind(
      ['forest', 'rock', 'ruin', 'water', 'swamp', 'road', 'cave', 'altar', 'camp'],
      FAR_BASE_W, h, theme);
  }

  /**
   * 통로(PLAN §28-2 Phase 3) — 이 조각이 마을 사이 통로의 좁은 결 안에 있으면
   * 그 통로의 결 이름(`통로:<목적지 마을id>`)을, 아니면 `null`을 준다.
   * **순수 함수다** — 좌표·방 치수·`corridors`(town.js `corridorsFor()`가 주는
   * `{dir,extra,lane,to}` 배열)만 보고 정한다. 새 판정 개념이 아니다 — 이미
   * `dungeon.js`의 `corridorReach()`가 클램프에 쓰는 것과 **같은 결(lane)
   * 판정**을 그림·충돌 양쪽에서 그대로 재사용한다(어긋나면 "보이는 건
   * 나무인데 자리는 뚫린" 자리가 생긴다 — 층 테마 감사 때 이미 겪은 함정).
   * `corridors`가 없으면(던전 층 전부, 통로 없는 자리) 늘 `null`이다.
   *
   * 2026-09-06 — PLAN §28-4 Phase 3. 문별 통로(`doorCorridors()`)는 `to`
   * 대신 `laneAt`(그 문의 y)로 결 중심을 잡는다 — 마을 통로는 늘 방 중심이
   * 결 중심이라 `laneAt`이 없다(undefined면 옛날처럼 중심을 쓴다, 회귀 없음).
   * `corridorExtra()`(dungeon.js)가 클램프에 쓰는 것과 **정확히 같은 결
   * 중심**을 여기서도 써야 한다 — 안 그러면 방 중심에서 먼 문(예: 위쪽 문)의
   * 통로가 "보이는 건 층 테마인데 자리는 계단 통로" 식으로 어긋난다.
   */
  function corridorNameAt(cx, cz, W, H, corridors) {
    if (!corridors || !corridors.length) { return null; }
    /* 결 폭(lane)은 월드 단위(`corridorReach()`의 `Math.abs(py-cy)<lane`과 같은
       단위)다 — 칸 좌표(cx,cz)를 그대로 나누면 단위가 어긋난다(칸 하나가
       CHUNK=200인데 lane은 90 안팎이라, 인덱스째로 비교하면 어느 줄도 안
       걸린다). 이 칸의 **월드 중심** 좌표로 바꿔서 비교한다. */
    var spanX = Math.floor(W / CHUNK), spanZ = Math.floor(H / CHUNK);
    var gx = cx * CHUNK + CHUNK / 2, gz = cz * CHUNK + CHUNK / 2;
    var cxW = W / 2, cyW = H / 2, i, co, laneAt, label;
    /* 2026-09-06 실기기 검증(다른 세션)에서 발견 — 칸 **중심 점**이 결 폭
       안에 드는지만 보면, 칸 중심이 늘 CHUNK/2 의 홀수배(100, 300, ...)로
       고정돼 있어 방 치수·문 좌표가 우연히 그 격자와 어긋나는 값이면
       (예: 결 중심이 칸 중심에서 정확히 90~110 떨어진 경우, `lane`이 그
       사이 어딘가면) **어느 칸도 안 걸리는 기하학적 실패**가 난다(마을
       동서 통로·던전 계단문 통로가 실제로 그랬다 — floor·seed와 무관하게
       100% 재현됐다). 칸은 CHUNK 폭을 가진 **구간**이지 점이 아니므로,
       "칸 구간이 결 구간과 조금이라도 겹치는가"로 바꾼다 — 겹침 조건은
       두 구간 중심 거리가 `(칸 반폭 + 결 반폭)`보다 작은가다. 예전
       조건(`< lane`)을 항상 포함하는 상위집합이라(칸 반폭만큼 관대해질
       뿐) 이미 걸리던 칸이 안 걸리게 되는 회귀는 없다. */
    var half = CHUNK / 2;
    for (i = 0; i < corridors.length; i++) {
      co = corridors[i];
      label = co.to ? ('통로:' + co.to) : (co.kind === 'stair' ? '통로:계단' : null);
      if (co.dir === 'E' && cx > spanX) {
        laneAt = (co.laneAt != null) ? co.laneAt : cyW;
        if (Math.abs(gz - laneAt) < half + (co.lane || 0)) { return label; }
      } else if (co.dir === 'W' && cx < 0) {
        laneAt = (co.laneAt != null) ? co.laneAt : cyW;
        if (Math.abs(gz - laneAt) < half + (co.lane || 0)) { return label; }
      } else if (co.dir === 'S' && cz > spanZ) {
        laneAt = (co.laneAt != null) ? co.laneAt : cxW;
        if (Math.abs(gx - laneAt) < half + (co.lane || 0)) { return label; }
      } else if (co.dir === 'N' && cz < 0) {
        laneAt = (co.laneAt != null) ? co.laneAt : cxW;
        if (Math.abs(gx - laneAt) < half + (co.lane || 0)) { return label; }
      }
    }
    return null;
  }

  /**
   * 이 조각에 무엇이 서나 — **순수 함수다.** 같은 씨앗·같은 자리면 늘 같다.
   * 돌려주는 것은 `{t, x, z, s, rot, h}` 의 목록(좌표는 월드).
   *
   *   t   tree · rock · pillar · cliff · path · pond · cavemouth · altar · tent · fire
   *   s   크기   rot 회전   h 높이(땅 높이는 부르는 쪽이 더한다)
   * @param theme 층 테마 이름 — `kindOf()`로 그대로 넘긴다(없으면 예전과 같다)
   */
  function chunkAt(cx, cz, seed, ring, dens, theme) {
    var out = [], i, n;
    var kind = kindOf(cx, cz, seed, ring, theme);
    var ox = cx * CHUNK, oz = cz * CHUNK;
    var d = dens === undefined ? 1 : dens;

    function spot(k) {
      return {
        x: ox + mix(cx * 13 + k * 7 + seed, cz * 29 + k * 3) * CHUNK,
        z: oz + mix(cz * 11 + k * 17 - seed, cx * 41 + k * 5) * CHUNK
      };
    }
    function rnd(k) { return mix(cx * 101 + k + seed, cz * 211 - k); }

    if (kind === 'forest') {
      n = Math.round((7 + rnd(0) * 7) * d);
      for (i = 0; i < n; i++) {
        var f = spot(i);
        out.push({ t: 'tree', x: f.x, z: f.z, s: 0.7 + rnd(i + 40) * 0.9,
                   rot: rnd(i + 60) * 6.28, h: 46 + rnd(i + 80) * 44 });
      }
    } else if (kind === 'rock') {
      n = Math.round((4 + rnd(1) * 5) * d);
      for (i = 0; i < n; i++) {
        var r = spot(i + 10);
        /* 2026-09-07 — 실기기 제보("큰 돌로 화면이 안 보인다") 이후 s 상한을
           2.4→1.6으로 낮췄다(§57 창-추적 이후로 이 자리를 실제로 밟는 일이
           늘어 눈에 띄게 됐다) */
        out.push({ t: 'rock', x: r.x, z: r.z, s: 0.7 + rnd(i + 90) * 0.9,
                   rot: rnd(i + 20) * 6.28, h: 16 + rnd(i + 30) * 24 });
      }
    } else if (kind === 'ruin') {
      /* 폐허 — 부러진 기둥 넷과 무너진 벽 하나. 높이를 서로 다르게 해야 폐허로 보인다
         (같으면 짓다 만 집이다 — 사가만리에서 배운 것) */
      var b = spot(3);
      for (i = 0; i < 4; i++) {
        out.push({ t: 'pillar', x: b.x + (i % 2 ? 34 : -34), z: b.z + (i < 2 ? -34 : 34),
                   s: 1, rot: 0, h: 30 + rnd(i + 50) * 66 });
      }
      out.push({ t: 'wall', x: b.x, z: b.z + 52, s: 1, rot: rnd(9) * 0.6 - 0.3, h: 26 });
    } else if (kind === 'road') {
      /* 길 — 조각을 가로지르는 흙바닥 띠. 옆에 이정표 하나 */
      out.push({ t: 'path', x: ox + CHUNK / 2, z: oz + CHUNK / 2, s: 1,
                 rot: rnd(4) < 0.5 ? 0 : Math.PI / 2, h: 1 });
      if (rnd(5) > 0.5) {
        var m = spot(7);
        out.push({ t: 'post', x: m.x, z: m.z, s: 1, rot: 0, h: 42 });
      }
    } else if (kind === 'water') {
      out.push({ t: 'pond', x: ox + CHUNK / 2, z: oz + CHUNK / 2,
                 s: 0.6 + rnd(6) * 0.5, rot: 0, h: 2 });
      n = Math.round(3 * d);
      for (i = 0; i < n; i++) {
        var w = spot(i + 30);
        out.push({ t: 'reed', x: w.x, z: w.z, s: 1, rot: 0, h: 16 + rnd(i) * 14 });
      }
    } else if (kind === 'cave') {
      var cv = spot(2);
      out.push({ t: 'cavemouth', x: cv.x, z: cv.z, s: 1, rot: rnd(8) * 6.28, h: 96 });
    } else if (kind === 'altar') {
      var al = spot(1);
      out.push({ t: 'altar', x: al.x, z: al.z, s: 1, rot: 0, h: 40 });
    } else if (kind === 'camp') {
      var cp = spot(0);
      out.push({ t: 'fire', x: cp.x, z: cp.z, s: 1, rot: 0, h: 12 });
      for (i = 0; i < 2; i++) {
        out.push({ t: 'tent', x: cp.x + (i ? 46 : -46), z: cp.z + (i ? 22 : -18),
                   s: 1, rot: rnd(i + 13) * 6.28, h: 34 });
      }
    } else if (kind === 'swamp') {
      /* 늪(PLAN 9절 Biome) — 웅덩이 하나 + 썩은 나무 여럿 + 갈대. `water`
         쪽의 pond·reed 를 그대로 재사용한다(같은 물건이라 새 도형이 필요 없다) */
      out.push({ t: 'pond', x: ox + CHUNK / 2, z: oz + CHUNK / 2,
                 s: 0.5 + rnd(6) * 0.4, rot: 0, h: 2 });
      n = Math.round((2 + rnd(0) * 3) * d);
      for (i = 0; i < n; i++) {
        var dt = spot(i + 50);
        out.push({ t: 'tree_dead', x: dt.x, z: dt.z, s: 0.7 + rnd(i + 55) * 0.6,
                   rot: rnd(i + 58) * 6.28, h: 40 + rnd(i + 59) * 40 });
      }
      n = Math.round(2 * d);
      for (i = 0; i < n; i++) {
        var rd = spot(i + 65);
        out.push({ t: 'reed', x: rd.x, z: rd.z, s: 1, rot: 0, h: 14 + rnd(i + 66) * 12 });
      }
    }
    out.kind = kind;
    return out;
  }

  /**
   * 땅바닥 잡초 — PLAN 7·11절 "풀·꽃·덤불·버섯·통나무". 2026-09-04, 다른 네 판은
   * 다 갖고 있는데 이 판에만 하나도 없던 것을 채운다.
   *
   * `chunkAt()` 과 일부러 갈라 둔 함수다 — `chunkAt()` 의 목록은 `dungeon.js` 의
   * `boundPlayer()` 가 **충돌로도** 읽고(나무·바위·기둥·절벽에 막힌다), 자가진단이
   * 그 목록의 길이·성격을 값으로 붙들고 있다. 순수 장식(잡초)까지 거기 섞으면
   * 걸음이 스치는 것마다 막히거나 기존 회귀를 건드릴 위험이 있다. 그래서 **읽기만
   * 하고**(`kindOf()`) 따로 돌려주는, 판정에 안 닿는 층 하나를 더 얹었다.
   *
   * 여전히 **순수 함수**다 — 같은 자리·같은 씨앗이면 늘 같다.
   * @param theme 층 테마 이름 — `kindOf()`로 그대로 넘긴다(없으면 예전과 같다)
   */
  function clutterAt(cx, cz, seed, ring, dens, theme) {
    var out = [], i, n;
    var kind = kindOf(cx, cz, seed, ring, theme);
    if (kind === 'water' || kind === 'cave') { return out; }   // 안 어울리는 자리엔 안 심는다
    var ox = cx * CHUNK, oz = cz * CHUNK;
    var d = dens === undefined ? 1 : dens;

    /* chunkAt() 의 spot()/rnd() 와 씨앗 자리가 겹치면 잡초가 나무·바위와
       같은 자리에 서서 서로 뚫고 지나간다(z-fighting) — 오프셋을 달리해 가른다 */
    function spot(k) {
      return {
        x: ox + mix(cx * 17 + k * 9 + seed + 500, cz * 23 + k * 5) * CHUNK,
        z: oz + mix(cz * 19 + k * 21 - seed - 500, cx * 37 + k * 3) * CHUNK
      };
    }
    function rnd(k) { return mix(cx * 131 + k + seed + 500, cz * 271 - k); }

    n = Math.round((3 + rnd(0) * 5) * d);
    for (i = 0; i < n; i++) {
      var f = spot(i);
      out.push({ t: rnd(i + 40) < 0.62 ? 'grass' : 'flower', x: f.x, z: f.z,
                 s: 0.7 + rnd(i + 60) * 0.7, rot: rnd(i + 80) * 6.28, h: 6 });
    }
    if (kind === 'forest') {
      /* 숲에만 덤불·버섯·통나무 — 그 밖의 성격(길·캠프·폐허…)엔 안 어울린다 */
      n = Math.round((1 + rnd(1) * 2) * d);
      for (i = 0; i < n; i++) {
        var b = spot(i + 100);
        out.push({ t: 'bush', x: b.x, z: b.z, s: 0.8 + rnd(i + 110) * 0.6,
                   rot: rnd(i + 120) * 6.28, h: 18 });
      }
      if (rnd(2) < 0.5) {
        var m = spot(130);
        out.push({ t: 'mushroom', x: m.x, z: m.z, s: 1, rot: 0, h: 8 });
      }
      if (rnd(3) < 0.35) {
        var l = spot(140);
        out.push({ t: 'log', x: l.x, z: l.z, s: 1, rot: rnd(141) * 6.28, h: 12 });
      }
    }
    /* §5.7 시대 퓨전 — 이 칸이 그 마을의 시대 층 자리면 얹는다(위 eraLayerAt) */
    var era = eraLayerAt(cx, cz, seed, theme);
    if (era) { out.push(era); }
    out.kind = kind;
    return out;
  }

  /* ── 시대 층(§5.7 시대 퓨전, 2026-09-18) ────────────────────────
   * "biome 별 decor 레시피에 시대 층 1개" — 손으로 지은 마을 넷(모루골 등)엔
   * biome 이 없어(§28-8 Phase 3 주석 참고) 안 뜨고, **절차 생성 마을**에서만
   * theme('town:ruins' 등 다섯 biome)로 켜진다.
   * `chunkAt()`처럼 확률로 스폰하지 않는다 — "마을당 1~2개"를 확률로
   * 흉내 내면 두 개가 가까이 붙어 나올 수 있어(§9 진단 "스폰 95 간격을
   * 지킨다") seed 하나당 **정해진 한두 칸**만 고른다(자리 자체가 결정적).
   * 실제 kind(위 kindOf())가 그 칸에서 물·동굴로 나오면(드묾) 안 세운다 —
   * clutterAt() 이 이미 그 둘을 걸러 준다.
   */
  var ERA_LAYER = {
    'town:ruins':    't_factory',     // 고분 옆 폐공장 굴뚝
    'town:forest':   't_solar',       // 기와집 옆 태양광 판
    'town:swamp':    't_tower',       // 늪 위 녹슨 관측탑
    'town:mountain': 't_pylon',       // 산채에 케이블카 기둥
    'town:shrine':   't_hologram'     // 사당에 홀로그램 비석
  };
  /** 이 seed·theme 조합이 세우는 시대 층 칸들 — 순수 함수, 자가진단이 그대로 부른다.
   *  둘째 자리는 seed 로 40% 만 켜진다("1~2개") — 첫째 자리와 X 축으로 반대쪽에
   *  둬 CHUNK(200) 여러 칸만큼 떨어뜨린다(95 간격 요구를 여유 있게 넘는다). */
  function eraLayerSlots(seed, theme) {
    var t = ERA_LAYER[theme];
    if (!t) { return []; }
    var out = [];
    var cx1 = 3 + Math.floor(mix(seed + 900, 1) * 2);        // 3~4
    var cz1 = Math.floor(mix(seed + 900, 2) * 5) - 2;        // -2~2
    out.push({ t: t, cx: cx1, cz: cz1 });
    if (mix(seed + 900, 5) < 0.4) {
      var cx2 = -4 - Math.floor(mix(seed + 900, 3) * 2);     // -5~-4
      var cz2 = Math.floor(mix(seed + 900, 4) * 5) - 2;      // -2~2
      out.push({ t: t, cx: cx2, cz: cz2 });
    }
    return out;
  }
  /** chunkAt()/clutterAt() 과 같은 프레임 좌표계로 낸다({t,x,z,s,rot,h}) —
   *  이 칸이 시대 층 자리가 아니면 null. */
  function eraLayerAt(cx, cz, seed, theme) {
    var slots = eraLayerSlots(seed, theme), i;
    for (i = 0; i < slots.length; i++) {
      if (slots[i].cx === cx && slots[i].cz === cz) {
        var ox = cx * CHUNK + CHUNK / 2, oz = cz * CHUNK + CHUNK / 2;
        return { t: slots[i].t, x: ox, z: oz, s: 1,
          rot: mix(cx * 71 + seed + 900, cz * 53 - seed) * 6.28, h: 90 };
      }
    }
    return null;
  }

  /** 어느 조각들을 세울까 — 반경 안의 것만(6절 "플레이어 주변 Chunk 만 활성화") */
  function ringOf(cx, cz, W, H) {
    /* 방이 걸친 조각을 0 으로 보고, 거기서 몇 칸 떨어졌는지 */
    var rx = Math.max(0, Math.max(-cx, cx - Math.floor(W / CHUNK)));
    var rz = Math.max(0, Math.max(-cz, cz - Math.floor(H / CHUNK)));
    return Math.max(rx, rz);
  }

  /** 눈으로 확인할 때 — 이 씨앗의 조각들이 어떤 성격인지 */
  function survey(seed, radius, W, H) {
    var by = {}, cx, cz, n = 0;
    var r = radius === undefined ? 3 : radius;
    for (cz = -r; cz <= r; cz++) {
      for (cx = -r; cx <= r; cx++) {
        var k = kindOf(cx, cz, seed, ringOf(cx, cz, W || 560, H || 360));
        by[k] = (by[k] || 0) + 1; n++;
      }
    }
    return { chunks: n, by: by, span: (r * 2 + 1) * CHUNK };
  }

  global.DG = global.DG || {};
  global.DG.field3d = {
    CHUNK: CHUNK, KINDS: KINDS,
    /* 전부 순수 함수다 — 자가진단이 값으로 본다 */
    mix: mix, seedOf: seedOf, heightAt: heightAt,
    kindOf: kindOf, chunkAt: chunkAt, clutterAt: clutterAt, ringOf: ringOf, survey: survey,
    corridorNameAt: corridorNameAt,
    /** 고정 세계 지도(world-map.js, §5.12) — 지역 가중치 표('region:<key>')를 얹는다 */
    setBias: function (name, table) { THEME_BIAS[name] = table; },
    /** §5.7 시대 퓨전 — 자가진단이 seed·theme 만으로 자리·간격을 확인한다 */
    eraLayerSlots: eraLayerSlots, eraLayerAt: eraLayerAt, ERA_LAYER: ERA_LAYER
  };
})(window);
