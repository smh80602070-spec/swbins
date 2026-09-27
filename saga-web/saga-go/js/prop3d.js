/**
 * 소품 에셋 — 나무 · 바위 · 덤불을 **진짜 모델**로 세운다 (새 PLAN STEP 4~5)
 * ---------------------------------------------------------------
 * `asset3d.js` 는 **배우**(사람 · 짐승 · 건물)를 GLB 로 세우는 자리다.
 * 여기는 그 옆자리 — **소품**(나무 · 바위 · 풀 · 덤불)을 맡는다. 둘을 가른 까닭은
 * 세우는 방식이 아예 다르기 때문이다:
 *
 *   배우   한 판에 스물 남짓. 저마다 제 뼈대로 움직인다 → `SkeletonUtils.clone`
 *   소품   한 판에 수백. 하나도 안 움직인다 → **`InstancedMesh` 로 한 덩이**
 *
 * 그래서 이 파일이 하는 일은 딱 하나다 — GLB 를 받아서
 * **`{geometry, material}` 조각들로 펴 놓는 것**. 그러면 `world3d` 의
 * 인스턴싱 창고가 여태 하던 그대로 자리만 빌려 주면 된다.
 *
 * 조각이 여럿인 까닭: 나무 한 그루는 줄기와 잎이 **다른 재질**이라 GLB 안에서도
 * 프리미티브 둘이다. 한 덩이로 못 묶으므로 조각마다 덩이를 하나씩 두고
 * **같은 행렬을 둘 다에 적어** 넣는다. 화면에서는 한 그루로 보인다.
 *
 * ── 계절 ────────────────────────────────────────────────
 *
 * Quaternius 나무는 `CommonTree_1` · `CommonTree_Autumn_1` · `CommonTree_Snow_1`
 * 처럼 **철마다 한 벌씩** 있다. `season.js` 가 이미 잎 색을 바꾸고 있었으니
 * 여기서는 **모델 자체를 갈아 끼운다** — 가을이면 단풍든 나무가, 겨울이면 눈 얹힌
 * 나무가 선다. 소품 캐시 키에 계절이 들어 있어(`world3d`) 저절로 다시 세워진다.
 *
 * ── 늦게 오는 것 ─────────────────────────────────────────
 *
 * GLB 는 받는 데 시간이 걸린다. 그동안 화면은 **여태 쓰던 도형**으로 선다
 * (원뿔 나무 · 공 바위). 다 받으면 `world3d.refreshProps()` 를 한 번 불러
 * 세워 둔 것을 지우고 다시 세운다 — 그 한 번에 나무가 바뀐다.
 *
 * 못 받으면(파일 없음 · `file://` 단독판 · 구형 기기) **조용히 도형으로 남는다.**
 * 그래서 PC 단독판도 그대로 돈다 — 실패를 시끄럽게 알리지 않는다.
 *
 * 값을 내는 함수(`pick`·`urlOf`)는 **three 없이도 돈다** — 자가진단이 그것만 본다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  /** 소품을 GLB 로 세울까 — 0 이면 표에 적혀 있어도 도형으로 간다 (되돌림용) */
  function ON() {
    if (!core().tuned('prop3d.on', 1)) { return false; }
    /* **등급이 LOW 면 안 쓴다.** 진짜 나무는 도형 나무보다 삼각형이 백 배다 —
       느린 기기에서 가장 먼저 뺄 것이 이것이다 (물·그늘과 같은 규칙) */
    var P = global.DG.perf;
    var tier = P && P.tier ? P.tier().key : 'HIGH';
    return tier !== 'LOW';
  }

  /** 이 소품이 그림자를 지나 — 나무와 집만 진다. 풀·바위까지 지면 그림자 지도가 넘친다 */
  function casts(name) {
    return name === 'tree' || name === 'pine' || name === 'house' || name === 'tower' ||
      name === 'peak' || name === 'shrine' || name === 'ruin' || name === 'cave' ||
      name === 'bridge' || name === 'temple';
  }

  /**
   * 이 소품의 키를 얼마나 보태나.
   * 도형으로 세우던 때 `p.h` 는 **벽 높이**였고 지붕은 그 위에 따로 얹혔다.
   * GLB 는 지붕까지가 키 1 이라 그대로 곱하면 집이 납작해진다 — 그만큼 보탠다.
   */
  function heightMul(name) {
    /* 집은 한 번 더 키운다. 도형이던 때 집은 **넓적한 상자**(폭 14m 까지)였는데
       GLB 는 키만 보고 고르게 늘이므로, 같은 `p.h` 로 세우면 마을이 훌쩍 작아
       보인다 — 옛 화면과 나란히 찍어 보고 알았다 */
    if (name === 'house') { return core().tuned('prop3d.houseScale', 1.8); }
    /* 2026-09-04 — 실사 탑(tower_round.glb)으로 갈아 끼운 뒤 1.4 그대로 뒀더니
       "너무 크게 보인다"(사용자, 실기기). 원인은 셈이 아니라 **모양**이다 —
       옛 Watchtower 류는 키에 비해 홀쭉한 첨탑이라 컸어도 안 거슬렸는데,
       tower_round 는 정규화 키 1당 폭도 거의 1(원형 성곽 탑이라 굵다) —
       x·y·z 를 다 같은 `hh` 로 균일하게 늘이는 구조(`instGlb`)라 폭도 키만큼
       불어나 옛 값 그대로면 마을을 통째로 덮는 굴뚝처럼 선다. 굵어진 만큼
       내렸다(1.4→0.6, 사용자 실기기 확인 — "이제 딱 맞아") */
    if (name === 'tower') { return core().tuned('prop3d.towerScale', 0.6); }
    /* 손으로 그린 땅의 것들. 도형이던 때의 **덩치**를 잇는 값이다 —
       도형은 키(`p.h`)와 따로 폭을 넓게 잡고 있었기 때문에, 키만 맞추면
       굴도 폐허도 홀쭉해진다. 나란히 찍어 보고 정했다 */
    if (name === 'cave') { return core().tuned('prop3d.caveScale', 1.6); }
    if (name === 'ruin') { return core().tuned('prop3d.ruinScale', 1.8); }
    if (name === 'shrine') { return core().tuned('prop3d.shrineScale', 1.15); }
    return 1;
  }

  /** 집을 진짜 모델로 세울까 — 따로 뗀 손잡이다(마을 결이 바뀌므로 되돌리기 쉽게) */
  function houseOn() { return core().tuned('prop3d.house', 1) ? true : false; }
  /** 한 종류에 몇 가지 모양까지 섞나 (많을수록 덜 되풀이되지만 더 받는다) */
  function VARIANTS() { return Math.max(1, Math.round(core().tuned('prop3d.variants', 3))); }

  /* ── 표 ───────────────────────────────────────────────
   * 소품 이름 → 철마다의 파일 목록. 철이 없으면 `all` 을 쓴다.
   * 자리 하나에 여럿이면 **좌표 해시로 골라** 늘 같은 자리에 같은 모양이 선다.
   */
  var BASE = 'assets/models/nature/';
  var BLD = 'assets/models/buildings/';
  var PRP = 'assets/models/props/';
  var NAT_REAL = BASE + 'realistic/';
  var BLD_REAL = BLD + 'realistic/';
  var PRP_REAL = PRP + 'realistic/';

  /* 2026-09-04 — 사가의숲이 검증해 두고 사가블로가 그대로 옮겨 쓴 Poly Haven CC0
     사진측량 자연물을 이 판에도 옮긴다("사가블로는 했는데" — 사용자가 형평을
     요청). md5 동일로 확인한 원본 그대로 복사했다(새 코드 없이 이 표만 갈아
     끼운다). 옛 Quaternius 저다각형 셋은 지우지 않고 아래 *_STYLIZED 에
     되돌림 자리로 남긴다 — 라이선스·출처는 `assets/ASSET_LICENSES.md` 참고.
     **가을·눈은 그대로 저다각형이다** — 사가의숲도 "Poly Haven 전체를 뒤져도
     가을 단풍·눈 덮인 나무 CC0 모델이 없다"고 결론 낸 자리라 다시 찾지 않는다.
     사가의숲엔 있는 log·tree:dead 는 이 판엔 그 자리(REG 키)가 아예 없어서
     뺐다 — 안 쓰는 파일을 공개 저장소에 얹을 까닭이 없다. */
  var TREE_STYLIZED = [BASE + 'CommonTree_1.glb', BASE + 'CommonTree_2.glb', BASE + 'CommonTree_3.glb'];
  var PINE_STYLIZED = [BASE + 'PineTree_1.glb', BASE + 'PineTree_2.glb'];
  var ROCK_STYLIZED = [BASE + 'Rock_1.glb', BASE + 'Rock_2.glb', BASE + 'Rock_3.glb'];
  var BUSH_STYLIZED = [BASE + 'Bush_1.glb', BASE + 'Bush_2.glb'];
  /** 2026-09-04 — 가을·겨울 되돌림 자리. CC0 실사 가을·겨울 나무는 재차 찾아봐도
   *  없다(Poly Haven 전체·PolyScan·OpenGameArt·Sketchfab·itch.io·ambientCG·
   *  Poly Pizza·ToxSam 레지스트리 — 전부 저다각형이거나 라이선스가 안 맞음).
   *  대신 아래 `tintedOf()` 로 **같은 실사 나무를 색만 계절에 맞게 덧입힌다** */
  var TREE_AUTUMN_STYLIZED = [BASE + 'CommonTree_Autumn_1.glb', BASE + 'CommonTree_Autumn_2.glb'];
  var TREE_WINTER_STYLIZED = [BASE + 'CommonTree_Snow_1.glb', BASE + 'CommonTree_Snow_2.glb'];
  /** 2026-09-04 — 마을 집·탑도 실사로. 사가블로가 오늘 PolyScan(집 둘)·Poly Haven
   *  `modular_fort_01`(탑 하나)에서 CC0 사진측량/PBR 모델을 새로 구해 검증해
   *  뒀길래(사람 팩과 달리 이번엔 **막힌 길이 아니었다** — `assets/ASSET_LICENSES.md`
   *  참고) 그대로 옮겼다(md5 동일 확인). 옛 Kenney류 다섯 채·다섯 탑은 지우지
   *  않고 아래 *_STYLIZED 에 되돌림 자리로 남긴다. `asset3d.js`의 역참(`station`,
   *  Inn.glb 한 벌)·성채(`fort:t1~t3`, 등급마다 다른 탑)는 **손 안 댐** — 그쪽은
   *  등급별로 서로 다른 모양이어야 하는데(자가진단이 그걸 본다) 실사 탑은 한
   *  종류뿐이라 옮기면 세 등급이 다 같은 모양이 된다 */
  var HOUSE_STYLIZED = [BLD + 'House_1.glb', BLD + 'House_2.glb', BLD + 'House_3.glb',
                         BLD + 'House_4.glb', BLD + 'Blacksmith.glb'];
  var TOWER_STYLIZED = [BLD + 'Tower.glb', BLD + 'PointyTower.glb', BLD + 'LargeTower.glb',
                         BLD + 'Watchtower.glb', BLD + 'LargeSquareTowerBricks.glb'];
  /** 2026-09-04 — 산봉우리·등롱도 실사로. Poly Haven 전체 카탈로그(521개)를
   *  category='structures'/이름으로 다시 훑어 찾았다(역참·성채 때 쓴 것과
   *  같은 조사). `mountainside`(실사 절벽·산비탈 스캔) · `wooden_lantern_01`
   *  (smugglers_cove 컬렉션, 집·탑을 준 그 계열)를 gltf-transform으로 단일
   *  glb로 구웠다(Blender 없이 npm만으로 — 역참 때 처음 익힌 길을 그대로 씀).
   *  우물·장터·사당·굴·폐허·다리·벼는 이번에도 못 찾았다(Poly Haven에 그
   *  모양 자체가 없다) — 저다각형 그대로 둔다 */
  var PEAK_STYLIZED = [BASE + 'Mountain_1.glb', BASE + 'Mountain_2.glb'];
  var LAMP_STYLIZED = [PRP + 'WoodenTorch.glb'];
  /** 2026-09-04(이어서) — "마저 찾아봐줘"로 나머지 다섯도. Poly Haven엔 없어
   *  Sketchfab CC0 필터로 옮겨 갔다(역참 때 처음 쓴 길). 전부 아일랜드
   *  문화유산 사진측량이거나(우물·아치·한증막) 그 밖의 유럽 박물관 디지털화
   *  프로젝트다(길가 성상·시장 십자가). 진짜 그 물건은 아니지만(사당은
   *  가제보가 아니라 폴란드 길가 성상, 장터는 좌판이 아니라 아일랜드
   *  시장 십자가) 사용자가 "그거 아니여도 됨"으로 이미 승인한 범위다.
   *  다리·벼는 이번에도 못 찾았다 — 자세한 조사 이력은
   *  `assets/ASSET_LICENSES.md` 참고 */
  var SHRINE_STYLIZED = [PRP + 'Gazebo.glb'];
  var CAVE_STYLIZED = [PRP + 'Mine.glb'];
  var RUIN_STYLIZED = [PRP + 'Arch.glb'];
  var WELL_STYLIZED = [BLD + 'Well.glb'];
  var MARKET_STYLIZED = [BLD + 'MarketStand_1.glb'];
  var RICE_STYLIZED = [PRP + 'Rice_4.glb'];
  var BRIDGE_STYLIZED = [PRP + 'Bridge.glb'];

  var REG = {
    tree: {
      /* 가을·겨울도 **같은 실사 GLB**를 쓴다 — 다른 실사 모델이 없어서다.
         재질에 계절 색을 곱하는 건 `tintedOf()`(`season.js` 의 `leaf` 색과 맞춘다) */
      all:    [NAT_REAL + 'IslandTree_02.glb'],
      autumn: [NAT_REAL + 'IslandTree_02.glb'],
      winter: [NAT_REAL + 'IslandTree_02.glb']
    },
    pine: {
      all: [NAT_REAL + 'PineSapling.glb']
    },
    rock: {
      all: [NAT_REAL + 'Rock_07.glb', NAT_REAL + 'Stone_01.glb',
            NAT_REAL + 'MossRock_a.glb', NAT_REAL + 'MossRock_b.glb', NAT_REAL + 'MossRock_c.glb']
    },
    grass: {
      /* 수풀만 실사로 바꾼다(사가의숲과 같은 이유 — 풀잎 카드형은 세로로
         정규화하면 옆으로 부풀어 나가는 실사 후보뿐이었다). 풀은 그대로 둔다 */
      all: [BASE + 'Grass_2.glb', NAT_REAL + 'Shrub_04.glb']
    },
    /* 마을 — 유럽 중세풍이다. 이 판은 삼국지·한국사인데도 얹은 까닭은
       사용자가 **품질을 먼저** 골랐기 때문이다(2026-08-28). 되돌리려면
       손잡이 `prop3d.house` 를 0 으로 내리면 기와지붕 코드로 돌아간다 */
    house: {
      all: [BLD_REAL + 'house_stone.glb', BLD_REAL + 'house_wooden.glb']
    },
    /* 마을의 높은 집. **`Inn.glb` 를 여기서 뺐다** — 그 여관이 이제
       `asset3d` 의 **역참**이다(2026-08-28). 마을에도 같은 여관이 서면
       들판에서 여관 모양을 보고 역참인 줄 알고 걸어갔다가 그냥 남의 집이 된다.
       역참은 들판에 홀로 서고 깃발이 있다 — 그 규칙을 깨끗하게 두려고 뺐다.
       대신 남은 탑 하나(`LargeSquareTowerBricks`)를 넣어 가짓수를 지켰다 */
    tower: {
      all: [BLD_REAL + 'tower_round.glb']
    },

    /* ── 여기부터는 **손으로 그린 땅**(`land.js`)이 세우는 것들 ──────────
     * 여태 이 일곱은 코드가 상자·원뿔을 쌓아 만들고 있었다. 사용자 방침
     * ("스크립트로 그리는 것은 다 에셋으로")에 따라 실제 모델로 갈아 끼운다.
     * **되돌림 길은 그대로다** — 못 받으면 조용히 옛 도형으로 남는다.
     */
    /** 산봉우리 — 여태 원뿔 하나였다. 2026-09-04 실사(`mountainside.glb`, 절벽·
     *  산비탈 사진측량 스캔)로 갈아 끼움. 옛 값은 `PEAK_STYLIZED` */
    peak: { all: [NAT_REAL + 'mountainside.glb'] },
    /** 등롱 — 기둥에 빛나는 공 하나였다. **불은 코드가 그대로 얹는다**(밤에만 켠다).
     *  2026-09-04 실사(`wooden_lantern.glb`)로 갈아 끼움. 옛 값은 `LAMP_STYLIZED` */
    lamp: { all: [PRP_REAL + 'wooden_lantern.glb'] },
    /** 옛 사당 — 정자(Gazebo). 숲 속에서 이것만 사람 손인 자리다.
     *  2026-09-04 실사(`wayside_shrine.glb`, 폴란드 박물관 소장 길가 성상
     *  디지털화)로 갈아 끼움. 옛 값은 `SHRINE_STYLIZED` */
    shrine: { all: [PRP_REAL + 'wayside_shrine.glb'] },
    /** 굴 입구 — 광산 어귀(Mine). 바위 더미에 검은 반원을 박던 자리.
     *  2026-09-04 실사(`sweathouse.glb`, 아일랜드 돌무덤형 한증막 사진측량 —
     *  낮은 입구가 있는 작은 돌집이라 굴 입구 자리에 그럭저럭 맞는다)로 갈아
     *  끼움. 옛 값은 `CAVE_STYLIZED` */
    cave: { all: [PRP_REAL + 'sweathouse.glb'] },
    /** 폐허 — 무너진 아치. 부러진 기둥 넷을 세우던 자리.
     *  2026-09-04 실사(`roman_arch.glb`, 스페인 로마 시대 아치 유적)로 갈아
     *  끼움. 옛 값은 `RUIN_STYLIZED` */
    ruin: { all: [PRP_REAL + 'roman_arch.glb'] },
    /** 다리 — 짧은 한 칸을 **여러 개 이어** 강을 건넌다(`propPlan` 이 나눠 놓는다).
     *  2026-09-04 — 실사 CC0 다리는 끝내 못 찾았다(조사 이력은
     *  `assets/ASSET_LICENSES.md`). 사용자 승인("비슷한 거나 다른 걸로
     *  채워도 됨 · 콘셉트가 모두 허용")으로 **다리 대신 디딤돌**로 건넌다 —
     *  이미 받아 둔 실사 바위(`rock`과 같은 파일, `MossRock_a.glb`)를
     *  여러 개 이으면 "돌다리"처럼 자연스럽게 반복된다(건물과 달리 바위는
     *  여러 개 늘어서도 안 어색하다). 옛 값은 `BRIDGE_STYLIZED` */
    bridge: { all: [NAT_REAL + 'MossRock_a.glb'] },
    /** 벼 — 논바닥과 두렁은 코드가 그대로 깔고(물 댄 낯이라 모델보다 낫다),
     *  **그 위에 자란 것만** 모델로 얹는다.
     *
     *  **한 번 죽었다 살아났다.** 2026-08-28 에 "창고에는 78 포기가 들어가는데
     *  화면에 한 포기도 안 선다" 로 하루를 태웠다. 모델도 계획도 멀쩡했다 —
     *  범인은 `world3d.buildProp` 의 두렁이 `var ox` 로 **격자 원점을 덮어쓴 것**
     *  이었다(`var` 는 함수 범위다). 논 다음에 오는 벼가 전부 원점 근처로
     *  끌려가 땅 밑에 깔려 있었다. 2026-08-29 에 잡았다.
     *  · `Rice_Crop` 은 벼가 아니라 키 5cm 짜리 밭 바닥이다 — 다 자란 `Rice_4` 를 쓴다.
     *  2026-09-04 — 벼 자체는 CC0 실사(사진측량이든 저다각형이든)가 무료
     *  생태계 어디에도 없다(Poly Haven·PolyScan·Sketchfab·OpenGameArt·
     *  Poly Pizza 다 확인 — 조리된 쌀 소품만 있고 작물로서의 벼는 없다).
     *  사용자 승인("벼가 없으면 다른 거 해도 돼")으로, 이미 받아 둔 실사
     *  수풀(`grass`와 같은 파일, `Shrub_04.glb`)을 그대로 돌려 쓴다 — 새로
     *  받은 파일은 없다. 정확히 벼는 아니지만 "논에 자란 초록"이라는 뜻은
     *  살아 있다. 옛 값은 `RICE_STYLIZED` */
    rice: { all: [NAT_REAL + 'Shrub_04.glb'] },
    /** 숲 속 옛 사원 — 손으로 그린 땅에 **딱 한 자리**만 있는 특별 랜드마크다
     *  (2026-09-11, "건물 에셋 확충" 요청으로 새로 신설). 한옥 CC0 실사 스캔은
     *  이번에도 못 찾았다(Sketchfab·PolyHaven·PolyScan·itch.io 전부 재확인) —
     *  대신 청더(淸) 보타종승묘 완법귀의전(1932년 베이징에서 만든 1:10 축소
     *  모형, 스톡홀름 민족박물관 소장)을 사진측량한 CC0 모델을 받았다. 원본이
     *  283만 폴리곤·재질 70개짜리라(처음엔 42MB, 2026-09-23 사진측량 UV 조각이
     *  simplify 를 막던 것을 `tools/glb-compress/seam-simplify.mjs`로 풀어 4MB·
     *  8.3만 삼각형으로 줄였다) **마을에
     *  흔하게 세우는 다른 건물과 달리 이 한 자리에만** 쓴다(`land.js`의
     *  `temple` 자리, EAGER_KIND에도 안 넣는다 — shrine·cave·ruin과 같은 결로
     *  그 자리를 그릴 때만 받는다). 한옥은 아니지만(청 티베트 불교 양식) 지금
     *  마을의 유럽 중세풍보다는 동양풍에 가깝다. 자세한 라이선스·다운로드
     *  경위는 `assets/ASSET_LICENSES.md` 참고 */
    temple: { all: [BLD_REAL + 'chengde_temple.glb'] },
    /** 우물 — 마을의 제 자리(landmark). **`house` 표에 못 끼운다** — 집은
     *  키(`p.h`) 4~20m 짜리 상자로 정규화되는데, 우물은 원본 키가 그 셋에
     *  하나(1.25m)라 같은 줄에서 골라 쓰면 우물이 집만큼 부풀거나 집이
     *  우물만큼 쪼그라든다. **제 이름 · 제 작은 `h`** 로 따로 세운다.
     *  2026-09-04 실사(`well.glb`, 아일랜드 문화유산 사진측량 "Ballinsloe
     *  Well Low")로 갈아 끼움. 옛 값은 `WELL_STYLIZED` */
    well: { all: [BLD_REAL + 'well.glb'] },
    /** 장터 좌판 — 우물과 같은 까닭으로 따로 뗀다(원본 키 1.05m).
     *  2026-09-04 실사(`market_cross.glb`, 아일랜드 애슬렌리 시장 십자가
     *  — 좌판은 아니지만 "장터의 랜드마크"라는 뜻은 같다)로 갈아 끼움.
     *  옛 값은 `MARKET_STYLIZED` */
    market: { all: [BLD_REAL + 'market_cross.glb'] },
  };

  /* ── 땅 전용 퓨전 소품(PLAN §5 ⑰ 넷째 · SAGA-DESIGN §13 전체 퓨전) ───────────────
   * Quaternius CC0(저다각형) — `assets/models/fusion/`, 받은 곳·라이선스는 ASSET_LICENSES.md.
   * era: past·modern·future·myth(자연·신화). h = 세울 키(m, 모델은 키 1 로 정규화된다).
   * 땅(biome.js ZONES `props`)마다 제 시대를 중심으로 나머지 시대를 섞어 세운다 — 소품 이름은 'zp_' + 키 */
  var FUS = 'assets/models/fusion/';
  var FUSION = {
    windmill: { f: 'Windmill_FirstAge', h: 9, era: 'past' },      hay: { f: 'Hay', h: 1.3, era: 'past' },
    cart: { f: 'Cart', h: 2, era: 'past' },                       tent: { f: 'Tent', h: 2.6, era: 'past' },
    bonfire: { f: 'Bonfire_Lit', h: 1, era: 'past' },             cauldron: { f: 'Cauldron', h: 1.2, era: 'past' },
    wall: { f: 'Wall_FirstAge', h: 3, era: 'past' },              barrel: { f: 'Barrel', h: 1.2, era: 'past' },
    crate: { f: 'Crate_Stack1', h: 1.6, era: 'past' },
    streetlight: { f: 'Streetlight_Single', h: 6, era: 'modern' }, traffic: { f: 'TrafficLight', h: 4.5, era: 'modern' },
    stop: { f: 'Sign_Stop', h: 2.5, era: 'modern' },              ac: { f: 'AC_Stacked', h: 2.4, era: 'modern' },
    lamp2: { f: 'Light_Street_2', h: 5, era: 'modern' },          antenna: { f: 'Antenna_2', h: 7, era: 'modern' },
    propane: { f: 'PropaneTank', h: 1.5, era: 'modern' },
    solar: { f: 'SolarPanel_Structure', h: 3, era: 'future' },    solar_low: { f: 'SolarPanel_Ground', h: 1.2, era: 'future' },
    dome: { f: 'GeodesicDome', h: 7, era: 'future' },             capsule: { f: 'House_Cylinder', h: 5, era: 'future' },
    radar: { f: 'Roof_Radar', h: 3, era: 'future' },              rover: { f: 'Rover_1', h: 2.6, era: 'future' },
    tank: { f: 'Tank', h: 3, era: 'future' },                     turret: { f: 'Turret_Cannon', h: 3, era: 'future' },
    pylon: { f: 'Support_Long', h: 12, era: 'future' },
    tree_float: { f: 'Tree_Floating_1', h: 8, era: 'myth' },      tree_light: { f: 'Tree_Light_1', h: 6, era: 'myth' },
    tree_lava: { f: 'Tree_Lava_1', h: 6, era: 'myth' },           tree_spiral: { f: 'Tree_Spiral_1', h: 6, era: 'myth' },
    cactus: { f: 'Cactus_2', h: 3.5, era: 'myth' },               palm: { f: 'PalmTree_2', h: 9, era: 'myth' },
    pine_snow: { f: 'PineTree_Snow_2', h: 10, era: 'myth' },      rock_snow: { f: 'Rock_Snow_2', h: 2, era: 'myth' }
  };
  Object.keys(FUSION).forEach(function (k) { REG['zp_' + k] = { all: [FUS + FUSION[k].f + '.glb'] }; });

  function register(name, season, urls) {
    if (!name) { return REG; }
    if (!urls) { delete REG[name]; return REG; }
    REG[name] = REG[name] || {};
    REG[name][season || 'all'] = [].concat(urls);
    return REG;
  }

  /* ── 값을 내는 함수 — three 없이도 돈다 ───────────────── */

  /** 지금 철 — `season.js` 가 없으면 늘 `all` 로 간다 */
  function seasonKey() {
    var S = global.DG.season;
    if (!S || !S.now) { return 'all'; }
    try { return S.now().key || 'all'; } catch (e) { return 'all'; }
  }

  /** 가을·겨울에만 색을 곱할 16진. 가을은 `season.js` `SEASONS.autumn.leaf`
   *  값을 그대로 옮겨 적었다(따뜻한 황갈색이라 곱해도 또렷이 갈린다).
   *  **겨울은 그 규칙을 깼다** — `SEASONS.winter.leaf`(0x5f6a5c, 흐린 회녹색)를
   *  그대로 곱하니 가을과 실기기에서 거의 안 갈렸다(사용자 확인, 2026-09-04).
   *  `season.js` 의 그 값은 **손그린 단색 땅**을 물들이려고 고른 값이라 사진
   *  텍스처 위 곱색에는 안 맞았다 — 여기만 따로 **더 차갑고 진한 청회색**을
   *  쓴다(나무 전용, `season.js` 와 갈라짐을 감수한다). 봄·여름은 null —
   *  사진측량 텍스처를 그대로 둔다(곱하면 오히려 탁해진다). `S.now()` 대신
   *  `sk` 를 직접 봐서 다른 철을 미리 받을 때도 맞는 색을 낸다 */
  var SEASON_TINT_HEX = { autumn: 0xa87a2e, winter: 0x4d5b66 };
  function seasonTintHex(sk) {
    var key = sk || seasonKey();
    return SEASON_TINT_HEX[key] || null;
  }

  /**
   * 이 소품·이 자리에 어느 파일이 서나 — 없으면 null. **순수 함수다.**
   *
   * @param name 'tree' | 'pine' | 'rock' | 'grass'
   * @param gx   격자 x (같은 자리면 늘 같은 모양이 서게 하는 씨앗)
   * @param gy   격자 y
   * @param sk   철을 못박고 싶을 때 (안 주면 지금 철)
   */
  function pick(name, gx, gy, sk) {
    if (!ON()) { return null; }
    if ((name === 'house' || name === 'tower') && !houseOn()) { return null; }
    var e = REG[name];
    if (!e) { return null; }
    var key = sk || seasonKey();
    var list = e[key] && e[key].length ? e[key] : e.all;
    if (!list || !list.length) { return null; }
    var n = Math.min(list.length, VARIANTS());
    var h = core().hash2(gx * 17 + 5, gy * 29 + 3) * 2;   // hash2 는 0~0.5 라 두 배로
    var i = Math.min(n - 1, Math.floor(h * n));
    return list[i];
  }

  /** 이 소품이 GLB 로 설 수 있나 — 파일이 이미 와 있어야 참이다 */
  function ready(name, gx, gy, sk) {
    var url = pick(name, gx, gy, sk);
    if (!url) { return false; }
    var c = cache[url];
    return !!(c && c.state === 'ok');
  }

  /** 표에 적힌 파일을 전부 (순수 — 미리 받기와 진단이 쓴다) */
  function urls() {
    var out = [], k, s, i;
    for (k in REG) {
      if (!REG.hasOwnProperty(k)) { continue; }
      for (s in REG[k]) {
        if (!REG[k].hasOwnProperty(s)) { continue; }
        for (i = 0; i < REG[k][s].length; i++) {
          if (out.indexOf(REG[k][s][i]) < 0) { out.push(REG[k][s][i]); }
        }
      }
    }
    return out;
  }

  /* ── 여기서부터 three 가 필요하다 ─────────────────────── */

  var cache = {};        // { url: {state, parts:[{geometry, material}]} }
  var pending = 0, arrived = 0, refreshTimer = null;

  /* 압축(EXT_meshopt_compression) GLB 는 디코더 없이 조용히 실패한다 — 사가의숲 asset3d.js 와 같은 요령(2026-09-23 tools/asset-audit 가 찾음) */
  function loader() {
    var t = three();
    if (!t || !t.GLTFLoader) { return null; }
    if (!loader.it) {
      loader.it = new t.GLTFLoader();
      if (t.MeshoptDecoder) { loader.it.setMeshoptDecoder(t.MeshoptDecoder); }
    }
    return loader.it;
  }

  /**
   * GLB 한 덩이 → **키 1 로 눕힌 조각들**.
   *
   * 세 가지를 한꺼번에 한다:
   *   1 부모들의 변환을 도형에 **구워 넣는다**(`matrixWorld`) — 인스턴스는
   *     행렬을 하나만 받으므로 안에 계층이 남아 있으면 자리가 어긋난다
   *   2 **키가 1** 이 되게 줄이고 **밑동을 0** 에 맞춘다 — 부르는 쪽이 높이만
   *     곱하면 되게. `asset3d.fit` 이 배우에게 하는 것과 같은 규칙이다
   *   3 재질은 GLB 것을 그대로 쓴다. 다만 **그림자를 지게** 켠다
   */
  /** 2026-09-04 — 사가의숲과 같은 고침: `/realistic/` 경로 밑은 Lambert 로 안 벗긴다.
   *  `lambertOf` 는 빛깔 하나만 남기고 텍스처·거칠기 맵을 통째로 버리는데, 옛
   *  Quaternius 계열은 애초에 면마다 한 색이라 잃을 게 없었지만(아래 `lambertOf`
   *  주석) Poly Haven 사진측량 모델은 **그 텍스처가 실사화의 전부**라 벗기면
   *  나무가 밋밋한 회색 덩어리로 보인다 — "실사화 안 됐다"던 제보가 이거였다.
   *  IBL(`world3d.js`)이 이미 있어 PBR이 까맣게 뜨는 옛 문제도 없다 */
  function looksRealistic(url) { return typeof url === 'string' && url.indexOf('/realistic/') >= 0; }

  function partsOf(gltf, url) {
    var t = three();
    var raw = [];
    var real = looksRealistic(url);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(function (o) {
      if (o.isMesh && o.geometry) { raw.push(o); }
    });
    if (!raw.length) { return null; }

    var box = new t.Box3().setFromObject(gltf.scene);
    var hgt = Math.max(1e-4, box.max.y - box.min.y);
    var s = 1 / hgt;
    var cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;

    var m4 = new t.Matrix4();
    var out = [], i;
    for (i = 0; i < raw.length; i++) {
      var g = raw[i].geometry.clone();
      g.applyMatrix4(raw[i].matrixWorld);
      /* 키 1 · 밑동 0 · 가운데 정렬 */
      m4.makeTranslation(-cx, -box.min.y, -cz);
      g.applyMatrix4(m4);
      m4.makeScale(s, s, s);
      g.applyMatrix4(m4);
      g.computeBoundingSphere();
      var srcMat = Array.isArray(raw[i].material) ? raw[i].material[0] : raw[i].material;
      out.push({ geometry: g, material: real ? liftOf(srcMat) : lambertOf(srcMat) });
    }
    return out;
  }

  var matCache = {};

  /** 실사 재질 밑색 들기 배율 — 0 이면 끔 */
  function LIFT() { return core().tuned('prop3d.lift', 0.3); }
  var liftCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  /**
   * 실사(PBR) 재질의 **그늘을 받친다**(2026-09-27, 헤드리스로 직접 찍어 확인 — 실기 "전체적으로 너무 어두워").
   * 사진측량 집·나무는 무늬가 짙어 해를 등진 면이 거의 검게 나왔다. 무늬를 벗기지 않고, 같은 무늬를 약하게
   * 스스로 빛나게(emissiveMap = map) 해 밑색을 들고 주변광 반사(envMapIntensity)도 조금 올린다. 원본은 안 건드린다(복제)
   */
  function liftOf(src) {
    var k = LIFT();
    if (!src || !k || !src.isMeshStandardMaterial) { return src; }
    if (liftCache && liftCache.has(src)) { return liftCache.get(src); }
    var t = three(), m = src.clone();
    if (m.map) { m.emissive = new t.Color(0xffffff); m.emissiveMap = m.map; m.emissiveIntensity = k; }
    else { m.emissive = m.color.clone(); m.emissiveIntensity = k * 0.6; }
    m.envMapIntensity = (src.envMapIntensity || 1) * (1 + k);
    if (liftCache) { liftCache.set(src, m); }
    return m;
  }

  /**
   * GLB 재질 → **이 판이 쓰는 Lambert 로 갈아 끼운다.** 빛깔만 가져온다.
   *
   * 왜 그대로 안 쓰나. 두 가지다.
   *
   * 1. **셰이더가 너무 는다.** GLB 재질은 `MeshStandardMaterial`(PBR)이고
   *    모델마다 제 것을 들고 온다 — 나무 열다섯 벌이면 서른 벌이다. 서른 벌이
   *    저마다 프로그램을 컴파일하느라 화면이 통째로 멎었다. 실제로 밟았다.
   *    빛깔로 묶으면 예닐곱 벌로 준다(같은 초록·같은 갈색이 많다)
   * 2. **혼자 다른 빛을 받는다.** 옆의 집·바위는 Lambert 인데 나무만 PBR 이면
   *    같은 해 아래서 다른 밝기로 선다 — 물에서 밟은 것과 같은 자리다
   *
   * 그림이 눈에 띄게 나빠지지 않는다. 이 모델들은 텍스처가 없고 **면마다 한 색**이라
   * PBR 로 얻는 것이 거의 없다.
   */
  /* SAGA-DESIGN §6.1/§7.2 — 사가고 팔레트 24색(PLAN §6 "하북 들판·마을·강" 초안).
   * 소품은 배우와 달리 툰 재질·외곽선을 안 받는다(면색 하나짜리라 얻을 게 적다) —
   * 대신 이 24색으로 **색만 스냅**해 서로 다른 CC0 팩이 섞여도 한 그림으로 보이게 한다. */
  var PALETTE = [
    0x7FA650, 0xB58B5A, 0x4A4E57, 0xE8DCC3, 0x4F86A8, 0x3F6B45, 0x8A8F8B, 0xE39B5A,
    0xA3C46F, 0xD0A874, 0x6C717B, 0xF5EEDD, 0x7FB0CC, 0x5E8C62, 0xB0B4AF, 0xF2B98A,
    0x5C7D38, 0x8C6A42, 0x2F3238, 0xC9B99A, 0x355F7A, 0x26452C, 0x5F635F, 0xB56F3C
  ];
  function PALETTE_ON() { return core().tuned('world3d.palette', 1) ? true : false; }
  /** hex → 팔레트에서 RGB 로 가장 가까운 색. 순수 함수(자가진단이 값으로 본다) */
  function snapPalette(hex) {
    var r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    var best = PALETTE[0], bestD = Infinity;
    for (var i = 0; i < PALETTE.length; i++) {
      var p = PALETTE[i];
      var dr = r - ((p >> 16) & 255), dg = g - ((p >> 8) & 255), db = b - (p & 255);
      var d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function lambertOf(src) {
    var t = three();
    if (Array.isArray(src)) { src = src[0]; }
    var hex = src && src.color ? src.color.getHex() : 0x8a8a8a;
    if (PALETTE_ON()) { hex = snapPalette(hex); }
    var key = String(hex);
    if (matCache[key]) { return matCache[key]; }
    matCache[key] = new t.MeshLambertMaterial({ color: new t.Color(hex) });
    return matCache[key];
  }

  var tintCache = {};

  /** 실사 재질에 계절 색을 곱한 **복제본**을 준다(원본은 그대로 둔다 — 여러
   *  철·여러 자리가 같은 원본 재질을 나눠 쓰므로 손대면 전부 물든다).
   *  텍스처(`map`)는 그대로 물려받고 `color` 만 곱해 GPU 는 같은 그림을 쓰되
   *  픽셀셰이더 단계에서 색만 걸러진다 — 새 텍스처를 안 만드니 가볍다 */
  function tintedOf(mat, url, hex) {
    var key = url + ':' + hex;
    if (tintCache[key]) { return tintCache[key]; }
    var m = mat.clone();
    m.color = (mat.color ? mat.color.clone() : new (three()).Color(0xffffff)).multiply(new (three()).Color(hex));
    tintCache[key] = m;
    return m;
  }

  /**
   * ⑲-33 눈 나무 — 재질 사본에 **위를 보는 면일수록 눈빛**을 섞는다(saga-godot 106 ㊻-4 `snow_amount` 셰이더와 같은 뜻).
   * 새 GLB(겨울 저다각형)로 바꾸지 않는 까닭: 이 판 나무는 실사 GLB 라 모양이 튀고, 색만 바꾸면 "가지 위 눈"이 안 생긴다.
   * 면의 위쪽은 인스턴스 행렬까지 곱한 **월드 법선의 y** — 나무를 자리마다 돌려 세워도 눈은 늘 위에 앉는다.
   * 텍스처(map) 뒤에 섞으므로 실사 잎 결은 눈 밑으로 비친다. 사본마다 프로그램 캐시 키를 따로 둔다
   */
  var snowCache = {}, SNOW_RGB = '0.90, 0.94, 0.98';
  function snowOf(mat, key, amt) {
    var k = key + '|snow' + amt;
    if (snowCache[k]) { return snowCache[k]; }
    var m = mat.clone();
    m.onBeforeCompile = function (shader) {
      shader.uniforms.uSnow = { value: amt };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vSnowUp;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vec3 snN = objectNormal;\n#ifdef USE_INSTANCING\n  snN = mat3(instanceMatrix) * snN;\n#endif\n  vSnowUp = normalize(mat3(modelMatrix) * snN).y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying float vSnowUp;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(' + SNOW_RGB + '), uSnow * smoothstep(0.2, 0.75, vSnowUp));');
    };
    m.customProgramCacheKey = function () { return 'snow' + amt; };
    snowCache[k] = m;
    return m;
  }

  /** 다 받으면 세워 둔 소품을 한 번 갈아 준다 — 여러 개가 몰려 오므로 뭉쳐서 */
  function scheduleRefresh() {
    if (refreshTimer) { return; }
    refreshTimer = global.setTimeout(function () {
      refreshTimer = null;
      var W3 = global.DG.world3d;
      if (W3 && W3.refreshProps) { W3.refreshProps(); }
    }, 120);
  }

  function acquire(url) {
    if (cache[url]) { return cache[url]; }
    var ld = loader();
    if (!ld) { cache[url] = { state: 'fail' }; return cache[url]; }
    var c = cache[url] = { state: 'load' };
    pending++;
    ld.load(url, function (gltf) {
      pending--;
      try {
        var ps = partsOf(gltf, url);
        if (!ps) { c.state = 'fail'; return; }
        c.state = 'ok'; c.parts = ps; arrived++;
        scheduleRefresh();
      } catch (e) { c.state = 'fail'; }
    }, null, function () {
      /* 없는 파일 · file:// 막힘 · 깨진 모델 — 전부 같은 결말. 도형으로 남는다 */
      pending--;
      c.state = 'fail';
    });
    return c;
  }

  /**
   * 이 소품의 조각들 — 아직 안 왔으면 **받기 시작하고 null 을 준다**.
   * 부르는 쪽(`world3d`)은 null 을 받으면 그냥 여태 쓰던 도형으로 세운다.
   */
  function parts(name, gx, gy, sk, snow) {
    if (!three()) { return null; }
    var url = pick(name, gx, gy, sk);
    if (!url) { return null; }
    var c = acquire(url);
    if (c.state !== 'ok') { return null; }
    /* 나무만 — 가을·겨울에 같은 실사 GLB를 색만 물들여 낸다(REG.tree.autumn/
       winter 가 이제 `all` 과 같은 파일이다). 물들 텍스처가 없는 조각
       (lambertOf 를 거친 옛 저다각형·되돌림용)은 이미 그 재질 자체가 계절별
       파일에서 왔으므로 더 안 물들인다 — `material.map` 이 있는 것만 대상 */
    var hex = name === 'tree' ? seasonTintHex(sk) : null;
    var tinted = !hex ? c.parts : c.parts.map(function (p) {
      return p.material.map ? { geometry: p.geometry, material: tintedOf(p.material, url, hex) } : p;
    });
    /* ⑲-33 고원 나무 — 철 색 위에 눈(부르는 쪽이 snow 0~1 을 준다, 0 이면 그대로) */
    if (!(snow > 0) || name !== 'tree') { return { url: url, parts: tinted }; }
    return { url: url, snow: snow, parts: tinted.map(function (p, i) {
      return { geometry: p.geometry, material: snowOf(p.material, url + '#' + i + ':' + (hex || 0), snow) };
    }) };
  }

  /* 시작 자리(0,0)는 마을 한복판이라(`land.js`) 이 안은 늘 눈에 든다 — 그래서
     미리 받는다. **`peak`·`cave`·`ruin`·`shrine`·`bridge` 는 뺐다** — 굴·폐허·
     사당은 46절이 못박은 "숨은 곳"이고, 산봉우리·다리는 손그림 땅 가장자리다.
     처음 화면에 안 잡히므로 다가갈 때 `parts()` 가 그 자리에서 받는다
     (SAGA WEB.md 7절 "현재 지역 것만 로딩" — 새 창고를 만들지 않고 이미 있던
     지연 로딩 길을 그냥 막지 않기만 하면 됐다). */
  var EAGER_KIND = ['tree', 'pine', 'rock', 'grass', 'house', 'tower', 'lamp', 'rice', 'well', 'market'];

  /** 미리 받을 것만 — 지금 철이 아닌 나무 변종(가을·겨울)도 뺀다 */
  function eagerUrls() {
    var out = [], sk = seasonKey(), i, k, s, e, list, j;
    for (i = 0; i < EAGER_KIND.length; i++) {
      k = EAGER_KIND[i];
      e = REG[k];
      if (!e) { continue; }
      for (s in e) {
        if (!e.hasOwnProperty(s)) { continue; }
        if (s !== 'all' && s !== sk) { continue; }   // 다른 철은 다가갈 때 받는다
        list = e[s];
        for (j = 0; j < list.length; j++) { if (out.indexOf(list[j]) < 0) { out.push(list[j]); } }
      }
    }
    return out;
  }

  /** 첫 화면(마을 둘레)에 잡히는 것만 미리 받는다 — 나머지는 다가갈 때 */
  function preload() {
    if (!three() || !ON()) { return 0; }
    var list = eagerUrls(), i, n = 0;
    for (i = 0; i < list.length; i++) { acquire(list[i]); n++; }
    return n;
  }

  function stats() {
    var ok = 0, fail = 0, load = 0, k;
    for (k in cache) {
      if (!cache.hasOwnProperty(k)) { continue; }
      if (cache[k].state === 'ok') { ok++; }
      else if (cache[k].state === 'fail') { fail++; }
      else { load++; }
    }
    return {
      on: ON(), season: seasonKey(), listed: urls().length, eager: eagerUrls().length,
      ok: ok, fail: fail, loading: load, arrived: arrived,
      mats: Object.keys(matCache).length
    };
  }

  global.DG = global.DG || {};
  global.DG.prop3d = {
    REG: REG, register: register,
    /* 값을 내는 함수 — three 없이도 돈다 (자가진단이 이것만 따로 본다) */
    pick: pick, urls: urls, eagerUrls: eagerUrls, seasonKey: seasonKey, seasonTintHex: seasonTintHex,
    ready: ready, casts: casts, PALETTE: PALETTE, snapPalette: snapPalette,
    houseOn: houseOn, heightMul: heightMul, FUSION: FUSION,
    /* 그림 층 */
    parts: parts, snowOf: snowOf, preload: preload, stats: stats,
    /** 진단이 제 뒤를 치울 때 */
    reset: function () { cache = {}; matCache = {}; arrived = 0; pending = 0; }
  };
})(window);
