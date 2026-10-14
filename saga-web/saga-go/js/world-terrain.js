/**
 * 1만리 프로시저럴 폴백 지형 — 손그림 땅(land)·지형 설계(landform) 밖 칸의 땅 종류를 좌표 해시로 낸다(terrainAt).
 * world.js 에서 떼어 냄(R-4, 줄 수 상한). 순수 — 바깥에서 쓰는 것은 core.hash2·noise2 와 DG.land·biome·landform 뿐.
 * world.js 는 같은 이름 한 줄 넘김(DG.world.terrainAt 그대로).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var TERRAIN = {
    water: '#16324f', grass: '#243528', forest: '#1d2f22',
    road: '#3a3f4a', town: '#3a352e', mount: '#333039',
    /* 손으로 그린 땅이 들고 온 것 (`land.js`) — 논밭은 들보다 밝고 누르스름하다 */
    farm: '#2f3a26'
  };

  /** 2026-09-08 — 지형 노이즈: `core.hash2`를 그대로 쓰면 칸마다 완전히
   *  독립이라(소금·후추 노이즈) 숲 한 칸·산 한 칸이 뿔뿔이 흩어져 "바둑판
   *  같다"는 지적을 받았다(사용자, `saga-go/HANDOFF.md` 2026-09-07 큐 —
   *  세계 격자무늬 길·구역 이름과는 별개 원인이었다). `core.noise2()`로
   *  이웃 칸과 이어 붙인다 — 굵은 결(9칸≈432m 폭)에 가는 결(3칸≈144m 폭)을
   *  얹어(2옥타브 값 노이즈) 뭉치되 경계가 너무 매끈하지만은 않게 했다.
   *  두 번째 옥타브는 좌표를 +500 밀어 첫 옥타브와 우연히 겹치지 않게 한다. */
  function terrainNoise(tx, ty) {
    return core.noise2(tx, ty, 9) * 0.65 + core.noise2(tx + 500, ty + 500, 3) * 0.35;
  }
  /** 문턱값 — 예전에 `core.hash2`를 직접 문턱 매길 때와 **같은 비율**(물14%·
   *  산18%·숲36%·마을12%·들20%)이 나오도록 위 `terrainNoise`를 400만 표본
   *  뽑아 분위수로 다시 잰 값이다(옥타브를 섞으면 평균 쪽으로 쏠려 옛 문턱을
   *  그대로 쓰면 숲만 태반이고 물·들은 거의 안 나온다 — 실측 후 보정). 겉보기만
   *  자연스러워지고 종류별 넓이 비율은 그대로다. */
  var TERRAIN_BAND = {
    water: [0, 0.1614], mount: [0.1614, 0.2106],
    forest: [0.2106, 0.2905], town: [0.2905, 0.3211]
  };

  /** 2026-09-04 — 이 칸(또는 바로 옆 네 칸)에 마을이 있나. `terrainAt`의
   *  격자무늬 길이 "마을 근처에서만" 서게 가르는 문턱이다. 마을 판정은
   *  `terrainAt`이 쓰는 것과 **같은 노이즈·같은 문턱**(`TERRAIN_BAND.town`)을
   *  그대로 재사용한다 — 다른 기준을 새로 만들면 집이 실제로 서는 자리
   *  (`propPlan('town', gx, gy, ...)`가 `terrainAt(gx,gy)==='town'`인 칸에
   *  얹힌다)와 길이 어긋난다.
   *
   *  **넓이를 두 번 실측하고 골랐다** — 자가진단 없이는 안 보이는 자리라
   *  임시 헤드리스 표본 페이지로 -200..200 범위를 직접 세었다:
   *  자기 칸만(반경 0) 2.85%, **십자 다섯 칸(자기+상하좌우) 11.20%**,
   *  3x3(반경 1) 16.21%, 5x5(반경 2) 22.90%(옛 격자 23.8%와 거의 같다 —
   *  이 폭은 "거의 전부"라 마을 근처 제한이 사실상 무효화된다). 반경 0은
   *  마을 칸 자신이 격자선에 정확히 걸릴 때만 길이 서서 마을에도 길이
   *  거의 안 남았다. **십자 다섯 칸**을 골랐다 — 옛 값의 절반 아래로
   *  줄면서도 마을 안팎에 길이 끊기지 않을 만큼은 남는다. */
  function nearTown(tx, ty) {
    var pts = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], i, h, b;
    for (i = 0; i < pts.length; i++) {
      h = terrainNoise(tx + pts[i][0], ty + pts[i][1]);
      b = bandFor(tx + pts[i][0], ty + pts[i][1]);
      if (h >= b.forest && h < b.town) { return true; }
    }
    return false;
  }

  /** 2026-09-24 — 지역(biome.js, PLAN §5 ⑩)마다 노이즈 문턱이 다르다. 모듈이 없거나
   *  꺼져 있으면 옛 문턱 그대로(고향 지역은 켜져 있어도 옛 비율과 같다) */
  var LEGACY_BAND = { water: TERRAIN_BAND.water[1], mount: TERRAIN_BAND.mount[1],
    forest: TERRAIN_BAND.forest[1], town: TERRAIN_BAND.town[1], clear: false };
  var bandCache = {}, bandCount = 0;
  function bandFor(tx, ty) {
    var BM = global.DG.biome;
    if (!BM || !BM.on()) { return LEGACY_BAND; }
    /* 칸마다 한 번만 — 미니맵·기복·소품이 같은 칸을 수백 번 묻는다(아홉 지역 가중이 싸지 않다) */
    var k = tx + ',' + ty, b = bandCache[k];
    if (b) { return b; }
    if (bandCount > 30000) { bandCache = {}; bandCount = 0; }
    b = bandCache[k] = BM.bandAt((tx + 0.5) * 48, (ty + 0.5) * 48);
    bandCount++;
    return b;
  }

  /** 2026-09-04 — 마을 근처 길을 tx%7 과 ty%9 **둘 다** 세우니 십자로 겹쳐
   *  "바둑판 같다"는 지적이 반경을 좁힌 뒤에도(마을 안은 여전히 그대로라)
   *  남았다. 당시엔 town 판정이 칸마다 독립인 해시라(퍼진 소금·후추 무늬)
   *  실제 마을 하나를 묶어 줄 값이 없었다 — 대신 `ROAD_REGION` 칸짜리 성긴
   *  구역으로 세상을 나눠 구역마다 축(세로만 또는 가로만)을 하나씩 고정했다.
   *  (2026-09-08 갱신: `terrainAt`이 `terrainNoise`로 바뀌면서 town 판정도
   *  이제 이웃과 뭉친다 — 그래도 동네 하나가 몇 칸씩 걸치면 축이 안 맞을 수
   *  있어 이 구역별 고정은 그대로 둔다, 손해는 없다.)
   *  `core.hash2` 는 실측상 0~0.5 만 돌려주므로(다른 자리의 h1 참고) 문턱은
   *  그 절반인 0.25. 이 값도 그리는 데만 쓴다. */
  var ROAD_REGION = 16;
  function roadIsVertical(tx, ty) {
    var rx = Math.floor(tx / ROAD_REGION), ry = Math.floor(ty / ROAD_REGION);
    return core.hash2(rx * 8321 + 17, ry * 5023 + 41) < 0.25;
  }

  /**
   * 이 격자가 무슨 땅이냐. **그리는 데만 쓴다** — 스폰·거리·조우는 이 값을 안 본다.
   *
   * 원래는 좌표를 넣으면 답이 나오는 **무한한 해시**뿐이었다. 지금은 —
   * **손으로 그린 땅**(`land.js`, 원점 둘레 1km) → 지형 설계(`landform`)·좌표 해시.
   * (2026-09-05 에 넣었던 실제 지형 `geo.js`(OpenStreetMap Overpass)는 W-0208 에서 지웠다 —
   * 사용자 "에셋으로 다 할거임": 외부 지도 서비스 0) 아무 레이어도 없거나 다 꺼져 있으면 이 함수는
   * 예전과 한 글자도 다르지 않다.
   *
   * 2026-09-04 — 여태 길(`tx%7===0‖ty%9===0`)이 **세상 전체에 무조건** 섰다.
   * 실사 소재를 깔고 나니 이 완전한 격자가 "바둑판 같다"고 눈에 띄었다
   * (사용자 지적) — 실사 도로 텍스처(`road.webp`, 이미 사진이다) 자체는
   * 문제가 아니었다, 배치가 문제였다. **마을 근처(자기 칸+상하좌우)에서만** 서게
   * 가른다 — 마을 사이 빈 들판은 이제 격자 없이 해시가 그대로 답한다
   * (숲·산·물·들로 자연스럽게 갈린다). `nearTown()` 참고. 이 값은 그리는
   * 데만 쓰여 스폰·거리·조우·`land.js` 시험판(그쪽은 손으로 그린 별도
   * 지도라 안 건드림)에는 안 닿는다 — 회귀 위험이 낮다.
   *
   * 그런데도 마을 **안**에서는 여전히 두 축이 겹쳐 바둑판으로 보였다(같은
   * 지적, 반경을 좁힌 뒤 재확인). `roadIsVertical()` 로 동네(`ROAD_REGION`
   * 구역)마다 한 축만 서게 갈라 십자 교차를 없앤다 — 동네마다 세로길
   * 동네만 또는 가로길 동네만 되어 "마을마다 방향이 다르게" 보인다.
   *
   * 2026-09-08 — 그런데도 "바둑판 같다"는 지적이 다시 나왔다. 길이 아니라
   * **지형 종류 자체**가 원인이었다 — `core.hash2(tx,ty)`를 곧바로 문턱
   * 매기면 칸마다 완전히 독립이라 숲·산·물이 한 칸씩 흩어진다(위 `terrainNoise`
   * 주석 참고). `terrainNoise()`(이웃과 이어지는 값 노이즈)로 바꿔 숲은
   * 숲대로, 산은 산줄기로, 물은 호수·강으로 뭉치게 했다. */
  function terrainAt(tx, ty) {
    var R = global.DG.land;
    if (R) {
      var authored = R.terrainAt(tx, ty);
      if (authored) { return authored; }
    }
    var h = terrainNoise(tx, ty), band = bandFor(tx, ty);
    if (band.clear) { return 'grass'; }          // 지역 랜드마크 둘레는 비운다(§5 ⑩)
    /* §5 ⑰ 지형 설계 — 손으로 그은 강·호수·산맥(고향 1.3km 밖). 없으면 null 이라 노이즈가 답한다 */
    var LF = global.DG.landform;
    if (LF) {
      var shaped = LF.kindAt(tx, ty);
      if (shaped) { return shaped; }
    }
    var road = roadIsVertical(tx, ty) ? (tx % 7 === 0) : (ty % 9 === 0);
    if (road && nearTown(tx, ty)) { return 'road'; }
    if (h < band.water) { return 'water'; }
    if (h < band.mount) { return 'mount'; }
    if (h < band.forest) { return 'forest'; }
    if (h < band.town) { return 'town'; }
    return 'grass';
  }

  global.DG = global.DG || {};
  global.DG.worldTerrain = { TERRAIN: TERRAIN, terrainAt: terrainAt, roadIsVertical: roadIsVertical, terrainNoise: terrainNoise, bandFor: bandFor, nearTown: nearTown };
})(typeof window !== 'undefined' ? window : this);
