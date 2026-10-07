/**
 * 3D 에셋 창고 — GLB 를 끼워 넣을 자리를 만든다 (PLAN 40절 PHASE 1~2)
 * ---------------------------------------------------------------
 * 지금 마을은 `village-view.js` 가 **2D 캔버스에 구면 투영**으로 그린다.
 * 나무·바위·사람은 도형(선·채움)이다. 언젠가 실제 3D 모델(GLB)을 얹고 싶은데,
 * 그때 가서 그리는 코드를 뜯어고치면 지금 서 있는 그림이 통째로 흔들린다.
 * 그래서 saga-go 의 `asset3d.js` 와 같은 요령으로 **미리 자리만 파 둔다**.
 *
 *   REG           무엇을 무엇으로 세울지 적은 표. PHASE 2 에서 채웠다 — 출처는
 *                 `assets/ASSET_LICENSES.md`(전부 Quaternius CC0)
 *   register()    표에 한 줄 적으면 그날부터 그 사물은 GLB 로 선다
 *   lookup()      표에서 첫 히트를 찾는다. three 없이도 도는 순수 함수 —
 *                 그래서 진단이 렌더러 없이도 표를 검사할 수 있다
 *   build()       GLB 를 실제로 불러 세운다 (three.GLTFLoader). `kind==='hero'`
 *                 는 몸+옷+머리+몸짓(UAL1) 넷을 한 뼈대로 묶는 조합형이고
 *                 (saga-go 의 `asset3d.js` 에서 옮겼다 — 넷이 같은 뼈대라
 *                 옮겨 입히기(retarget)가 필요 없다), 나머지는 표의 파일
 *                 하나를 그대로 받는다
 *
 * 되돌아가는 길 — GLB 가 없거나 실패하면 `build()` 가 cb(null) 로 부르고,
 * 부르는 쪽(앞으로 만들 `village-view3d.js`)은 지금처럼 도형을 그린다.
 * **한 줄도 판정에 닿지 않는다** — village.js 의 상태 계산은 이 파일을 모른다.
 *
 * file:// (PC 단독판)에서는 GLB 를 못 받는다(브라우저가 막는다). 실패해도
 * 조용히 넘어가므로 단독판은 그대로 돈다.
 *
 * **아직 이 표를 실제로 세우는 렌더러가 없다** — 나무·바위를 화면에 뿌리는
 * scatter 시스템(PLAN 9절 ForestDecorator)과 카메라·씬을 가진 진짜 Player 3D
 * 화면은 PHASE 2 나머지 몫이다. `build()` 는 이미 실제 GLB 를 실제로 세울 수
 * 있지만(헤드리스로 확인함), 부르는 씬이 없으니 화면엔 아직 아무 영향이 없다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  function core() { return global.DG.core; }

  var NAT = 'assets/models/nature/';
  var NAT_REAL = 'assets/models/nature/realistic/';
  var PROP = 'assets/models/props/';
  var BLD = 'assets/models/buildings/';
  var BLD_REAL = 'assets/models/buildings/realistic/';
  /* 2026-09-19 — Kenney Fantasy Town Kit(CC0) 부품을 tools/asset-forge/
     kitbash.py 로 조립하고 palette.py 로 §6.3 forest_green 팔레트에 스냅한
     결과물. `/realistic/` 경로가 아니라 `looksRealistic()`을 안 타고
     보통 건물처럼 toon3d.delam() 을 그대로 받는다 — 애초에 사진측량 PBR을
     팔레트로 우겨넣던 §6.2 계획을 접고 스타일 자체를 바꿨다(경위는
     HANDOFF.md 2026-09-19 절) */
  var BLD_GEN = 'assets/generated/buildings/';
  var ANI = 'assets/models/animals/';
  var ANI_EXTRA = 'assets/models/animals_extra/', ANI_EXTRA2 = 'assets/models/animals_extra2/';   // 2026-09-24 사가나락에서 복사(펫 초상)
  var STANDIN = 'assets/models/standin/';   // 신수·오마주 대역 — 사가만리에서 복사
  var MON = 'assets/models/monsters/';
  var PEOPLE = 'assets/models/people/regular/';
  /* 2026-09-19 — VRoid Studio 공식 CC0 샘플 아바타(AvatarSample_A/B/C,
     `github.com/madjin/vrm-samples`, 저작권 포기·상업 이용 무료·표시
     의무 없음 확인). 애니메 비례(§"고품질 셀 셰이딩급" 요청 ②) 시험용 — pygltflib 로
     텍스처만 512px 이하로 줄였다(정점·스킨은 그대로, ASSET_LICENSES.md
     참고). VRM 뼈 이름(`J_Bip_*`)은 UAL1 과 안 맞아 `boneNameMap()`의
     VRM_TO_UAL1_BONES 표를 거쳐야 걷는다(아래 `retargetInto` 앞 참고) */
  var PEOPLE_ANIME = 'assets/models/people/anime/';
  var ANIM_SRC = 'assets/models/anim/UAL1_Standard.glb';
  /* 2026-09-02 — 사용자가 "사람도 실사로" 요청, Mixamo(mixamo.com) 에서 직접 받아 온
     것을 fbx2gltf 로 변환해 넣었다. Quaternius 조합형(몸+옷+머리 따로)과 달리 이
     캐릭터는 통짜 스킨 메시 하나다 — outfit·hair 없이 body 하나로 선다.
     자세한 사정은 `assets/ASSET_LICENSES.md` 참고 */
  var PEOPLE_REAL = 'assets/models/people/realistic/';
  var ANIM_SRC_REAL = 'assets/models/anim/mixamo_realistic.glb';

  /* 2026-09-03 — Mixamo 실사(위 PEOPLE_REAL)는 재배포 금지라 .gitignore 돼 있어
     이 파일이 없는 기기(다른 clone·다른 세션, 즉 공개 저장소를 받은 모두)에서는
     캐릭터가 통째로 안 보였다. **공개판에서 그냥 볼 수 있는 것**으로 바꾸려고
     Quaternius "RPG Character Pack"(CC0, 리깅·애니메이션·텍스처 완비 6종,
     `assets/ASSET_LICENSES.md` 참고)으로 기본을 갈아 끼운다. 몸 파일 자체에
     걷기·공격·사망 등 클립이 다 들어 있어 outfit·hair 도, 별도 ANIM_SRC 도
     필요 없다 — `anim` 을 `body` 와 같은 파일로 주면 그 안의 클립을 그대로 쓴다. */
  var PEOPLE_QRPG = 'assets/models/people/quaternius_rpg/';
  var HERO_RECIPES = ['Warrior', 'Ranger', 'Rogue', 'Cleric', 'Wizard', 'Monk'].map(function (n) {
    var f = PEOPLE_QRPG + n + '.glb';
    return { key: 'qrpg_' + n.toLowerCase(), body: f, anim: f };
  });

  /* Mixamo 실사 — 재배포 금지라 기본에서는 뺐다. **로컬에 그 파일이 있고
     `world3d.mixamoReal` 손잡이를 켜면**(기본 0) 위 QRPG 대신 이걸 먼저
     써 본다(`buildHero()` 참고) — 지워서 되돌릴 길을 없애지 않는다. */
  var HERO_RECIPES_MIXAMO = [
    { key: 'mixamo_maria', body: PEOPLE_REAL + 'maria_body.glb', anim: ANIM_SRC_REAL }
  ];
  function wantsMixamoReal() { return core().tuned('world3d.mixamoReal', 0) ? true : false; }

  /* 2026-09-19 — 위 PEOPLE_ANIME 셋. `anim` 을 안 줘 기본 `ANIM_SRC`(UAL1)를
     빌린다 — rec.anim !== rec.body 라 `loadHeroRecipe().assemble()`이 자동으로
     `retargetInto()`를 태운다(몸마다 한 번만, `parts.body.heroClips`에 캐시).
     **기본은 꺼짐**(0, `HERO_RECIPES_MIXAMO`·`wantsMixamoReal()`과 같은 결) —
     렌더 확인이 안 되는 채로 만든 새 몸이라 손잡이를 켜기 전엔 기존 주민·
     NPC 배정에 전혀 안 끼어든다. */
  var HERO_RECIPES_ANIME = ['a', 'b', 'c'].map(function (n) {
    return { key: 'anime_avatar_' + n, body: PEOPLE_ANIME + 'avatar_sample_' + n + '.glb' };
  }).concat([
    /* 2026-09-19 — GUI 자동화(PowerShell, VRoid Studio 2.14.0 직접 조작)로
       처음부터 새로 빚은 커스텀 몸(여성, 하와이안 셔츠+데님 반바지 세트) —
       샘플 셋과 달리 캐릭터 자체가 이 세션에서 새로 만들어졌다. 경위·라이선스는
       assets/ASSET_LICENSES.md 참고 */
    { key: 'anime_avatar_custom01', body: PEOPLE_ANIME + 'avatar_custom_01.glb' }
  ]);
  /** 2026-09-20 — VRoid 몸이면 인물 id 로 머리·옷·눈 색을 바꾼다(vroid-variant.js, 다섯 판 공용). 다른 몸엔 안 건다 */
  function applyVroid(model, rec, id) {
    var V = global.DG && global.DG.vroidVariant;
    if (V && rec && V.isVroid(rec.body)) { V.apply(model, id); }
  }
  function wantsAnimeAvatar() { return core().tuned('world3d.animeAvatar', 1) ? true : false; }
  /** 2026-09-20 — VRM 몸은 남의 몸짓(UAL1)을 뼈 이름표로 다시 굽는 대신 `anim-own.js` 가 코드로 짠 자체 몸짓을 입는다
   *  (Mixamo 는 약관상 공개 저장소에 못 올리고, UAL1 은 VRM 뼈 길이·축이 달라 손이 갔다). 기본 켜짐,
   *  `world3d.ownAnim`=0 이면 예전 길(UAL1 retarget)로 되돌아간다 */
  function wantsOwnAnim(url) {
    return !!(global.DG.ownAnim && looksAnime(url) && core().tuned('world3d.ownAnim', 1));
  }

  /* 2026-09-19 — "마을 배경이랑 이질감 있는 게 제일 크다"는 제보로 §6.5
     "다음(실기 확인 뒤 결정)"의 방향이 정해졌다: 저폴리+절제된 팔레트인
     마을 안에 정교한 애니메 인물 하나가 서면(재질을 맞춰도) 디테일·채도
     자체가 튄다. 그래서 (1) **전체 주민이 아니라 이름 있는 숲 NPC 7명에만**
     적용하고 (2) 위 HERO_RECIPES_ANIME 몸의 옷(`_CLOTH` 재질만, 얼굴·피부·
     머리는 원본 그대로)을 `tools/asset-forge/palette.py tint-glb`로
     forest_green 팔레트 한 색씩 물들여 배경과 맞췄다(명도는 원본 유지 —
     최근접 스냅은 그라디언트가 얼룩덜룩 깨져 버려서 안 씀, palette.py
     주석 참고). 출력은 `assets/generated/people/anime/npc_<id>.glb`
     (§7.2 결 그대로 generated/ 에 커밋, 원본 models/ 는 안 건드림). 키는
     `data-village.js`의 `NPCS` id와 같다 — 늘어도 이 표만 늘리면 된다. */
  var HERO_RECIPES_ANIME_NPC = {
    keeper:    { key: 'anime_npc_keeper', body: 'assets/generated/people/anime/npc_keeper.glb' },
    angler:    { key: 'anime_npc_angler', body: 'assets/generated/people/anime/npc_angler.glb' },
    merchant:  { key: 'anime_npc_merchant', body: 'assets/generated/people/anime/npc_merchant.glb' },
    explorer:  { key: 'anime_npc_explorer', body: 'assets/generated/people/anime/npc_explorer.glb' },
    herbalist: { key: 'anime_npc_herbalist', body: 'assets/generated/people/anime/npc_herbalist.glb' },
    wanderer:  { key: 'anime_npc_wanderer', body: 'assets/generated/people/anime/npc_wanderer.glb' },
    courier:   { key: 'anime_npc_courier', body: 'assets/generated/people/anime/npc_courier.glb' }
  };

  /* 되돌림 자리 — 위 QRPG 조차 못 실리면(파일 손상 등) 이 옛 조합형으로 한 번 더
     갈아탄다. 2026-08-29 이전 기본값, 사람 비례는 QRPG보다 단순하지만 훨씬 가볍다 */
  var HERO_RECIPES_FALLBACK = [
    { key: 'male_peasant_buzzed', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Peasant.gltf', hair: PEOPLE + 'Hair_Buzzed.gltf' },
    { key: 'male_ranger_long', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Ranger.gltf', hair: PEOPLE + 'Hair_Long.gltf' },
    { key: 'female_peasant_buns', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Peasant.gltf', hair: PEOPLE + 'Hair_Buns.gltf' },
    { key: 'female_ranger_simple', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Ranger.gltf', hair: PEOPLE + 'Hair_SimpleParted.gltf' }
  ];

  /* 2026-09-10 — 외형 다양화(saga-go 의 MPFB2 몸 20종을 그대로 복사, CC0,
   * 자세한 것은 assets/ASSET_LICENSES.md). saga-go 의 MPFB 몸은 **제 클립이
   * 0개**라 `anim` 없이 공용 `ANIM_SRC`(UAL1)를 빌리는데, 뼈 길이가 UAL1과
   * 달라 raw 로 물리면 팔다리가 뒤틀린다(saga-go 가 겪은 "팔이 T자로 안
   * 움직인다" 버그) — **같은 날 뒤이어** saga-go 의 `retargetInto()` 계열
   * (`firstSkinned`·`boneNameMap`·`sceneHeight`·`retargetInto`, 아래
   * `assembleHero` 앞)을 옮겨 오고 `loadHeroRecipe()`의 `assemble()`에서
   * 몸마다 한 번만 다시 구워 입히도록 이어 붙였다 — 이제 `DEFAULTS.hero`에도
   * 실제로 걸린다(바로 아래 `.concat`). 이 파일 머리말대로 이 표를 실제로
   * 세우는 3D 화면(PLAN PHASE 2, world3d)이 아직 없어 지금은 화면에 아무
   * 영향이 없다 — 그 화면이 생기면 이 20종이 뒤틀리지 않고 걷는 인물로
   * 선다(사가종횡 `asset3d.js`에 같은 이식을 했으니 거기서 먼저 실기
   * 확인이 될 수도 있다). */
  var PEOPLE_MPFB = 'assets/models/people/mpfb_real/';
  var HERO_RECIPES_MPFB = ['female', 'male', 'v3', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12',
    'v13', 'v14', 'v15', 'v16', 'v17', 'v18', 'v19', 'v20', 'v21', 'v22', 'v23']
    .map(function (n) { return { key: 'mpfb_' + n, body: PEOPLE_MPFB + n + '.glb' }; });
  HERO_RECIPES = HERO_RECIPES.concat(HERO_RECIPES_MPFB);

  /* 2026-09-14 — PLAN §46 "다음에 이어갈 것" 셋째 항목: 배달원(courier)에게
   * 우주비행사 GLB를 입혀 다른 여섯 NPC와 다른 실루엣으로 보이게 한다. 새로
   * 받지 않고 `saga-dungeon`이 이미 CC0 확인해 둔 "Ultimate Space Kit"
   * Astronaut1.glb 를 그대로 복사했다(md5 동일, 출처는 `assets/ASSET_LICENSES.md`
   * "Quaternius Ultimate Space Kit — 배달원 우주복" 절). 이 GLB는 saga-dungeon
   * 쪽 asset3d.js 주석대로 `CharacterArmature|*` 제 클립을 갖고 있어(같은
   * Quaternius UAL 계열 뼈대) body/anim 을 같은 파일로 주면 retarget 없이 그대로
   * mapClips() 가 idle/walk 를 찾는다 — 다른 QRPG 레시피와 같은 결.
   * `village.js`의 `npcAt('courier', ...)` 가 `id: 'npc_courier'` 를 주므로
   * `keysFor('hero', {id:'npc_courier'})` 가 'hero:npc_courier' 를 먼저 찾는다
   * — 이 한 줄만으로 배달원만 이 몸을 입고 나머지 npc/주민은 그대로
   * HERO_RECIPES 해시를 탄다. 배열로 감싼 것은 `oneOf()`가 `.length` 없는
   * 객체를 바로 null 처리하기 때문(다른 단일 갈래도 다 배열로 감싼다). */
  var PEOPLE_SPACE = 'assets/models/people/space/';
  var HERO_RECIPE_COURIER = [
    { key: 'space_astronaut1', body: PEOPLE_SPACE + 'Astronaut1.glb', anim: PEOPLE_SPACE + 'Astronaut1.glb' }
  ];

  /* 2026-09-14 — PLAN §46-3 "다음에 이어갈 것" 둘째 항목: 우주기지(§45~46,
   * spaceBaseSpot) 를 지금까지는 다른 자리에서 빌려 온 fence·cart·crate·
   * lantern(전부 우주기지와 무관한 팩)로만 채웠었다. §46-2 가 "poly.pizza
   * 직접 다운로드는 이 환경에서 SSL 로 막혀 있다"고 적어 둔 것을 이번에
   * 다시 확인해 보니(GitHub `api.github.com`/`raw.githubusercontent.com`
   * 은 원래도 열려 있었다 — 다섯 판 CLAUDE.md), 실제로 이번 세션에선
   * `poly.pizza`/`static.poly.pizza` 도 직접 응답했다(막혔던 것이 상시가
   * 아니라 그때그때 환경 사정이었던 듯). 그래도 이 저장소가 이미
   * Frog.glb 등에 써 온 미러(`trebeljahr/quaternius-showcase`, saga-go·
   * saga-dungeon도 같은 미러를 쓴다)로 그대로 받았다 — 배달원 우주복과
   * **같은 Ultimate Space Kit 팩**(Quaternius, CC0)이라 출처가 이미 이
   * 판에 확인돼 있는 것과 같다. 새로 받은 여섯 — 본관(Base_Large)·
   * 오두막(House_Single)·측지돔(GeodesicDome)·로버(Rover_1)·태양광판
   * (SolarPanel_Ground)·메카(Mech_FinnTheFrog, 순전히 장식 — PLAN 45절
   * 표 "세워 두고 살펴보는 장식+상호작용 소품, 새 탈것 시스템 불필요"
   * 그대로) — 전부 deco:true 로만 놓는다(village.js), 새 상호작용은
   * 하나도 안 늘렸다. 출처·용량은 assets/ASSET_LICENSES.md 참고. */
  var BLD_SPACE = 'assets/models/buildings/space/';
  var PROP_SPACE = 'assets/models/props/space/';

  /** 되돌림 자리 — 실사 바위가 안 맞으면 이 값으로 register() 두 줄이면 돌아간다:
   *    asset3d.register('rock', ROCK_STYLIZED.rock);
   *    asset3d.register('rock:moss', ROCK_STYLIZED['rock:moss']);
   */
  var ROCK_STYLIZED = {
    'rock': [NAT + 'Rock_1.glb', NAT + 'Rock_2.glb', NAT + 'Rock_3.glb'],
    'rock:moss': NAT + 'Rock_Moss_1.glb'
  };

  /** 되돌림 자리 — 2026-09-03 자연물 실사화 둘째 항목(나무·수풀). 안 맞으면:
   *    asset3d.register('tree:common', TREE_STYLIZED['tree:common']);
   *    asset3d.register('bush', BUSH_STYLIZED.bush);
   */
  var TREE_STYLIZED = {
    'tree:common': [NAT + 'CommonTree_1.glb', NAT + 'CommonTree_2.glb', NAT + 'CommonTree_3.glb'],
    'tree:pine': [NAT + 'PineTree_1.glb', NAT + 'PineTree_2.glb'],
    'tree:dead': NAT + 'CommonTree_Dead_1.glb'
  };
  var BUSH_STYLIZED = {
    'bush': [NAT + 'Bush_1.glb', NAT + 'Bush_2.glb', NAT + 'BushBerries_1.glb']
  };
  var LOG_STYLIZED = {
    'log': [NAT + 'WoodLog.glb', NAT + 'WoodLog_Moss.glb']
  };

  /** 표 — 키는 좁은 것부터. PLAN 8절(숲 오브젝트)·16절(동물) 어휘를 그대로 썼다.
   *   asset3d.register('tree:pine', 'assets/models/nature/Pine.glb');
   *   asset3d.register('animal:an_deer', 'assets/models/animals/Deer.glb');
   */
  var DEFAULTS = {
    'hero': HERO_RECIPES,
    /* 배달원(courier) 전용 — npc.id === 'npc_courier' 일 때만 이 좁은 키가
       먼저 걸린다(keysFor() 순서, 위 주석 참고). 나머지 NPC·주민·플레이어는
       그대로 'hero' 로 떨어져 HERO_RECIPES 해시를 탄다. */
    'hero:npc_courier': HERO_RECIPE_COURIER,

    /* 나무 — 계절은 season.js 가 정한 값을 ref.season 으로 넘기는 쪽(부르는 쪽)이 맡는다.
       2026-09-03 에 tree:common(봄·여름) 을 먼저 실사로 갈아 끼웠고, **이어서**
       tree:pine·tree:dead 도 실사로 바꿨다. **가을·눈·자작은 여전히 저다각형이다
       — Poly Haven 전체를 뒤져도 가을 단풍·흰 자작나무·눈 덮인 나무 태그를 가진
       CC0 나무 모델이 없었다**(가문비·소나무·야자 계열 photogrammetry 뿐이다).
       조건이 아니라 소재 자체가 없는 경우라 이번엔 "안 되는 이유"만 적어 두고
       다음에 다른 CC0 출처가 나오면 그때 본다.
       Poly Haven `island_tree_02`(사진측량, 874,494 정점) 를 `gltf-transform weld` →
       `simplify --ratio 0.05 --error 0.02`(102,208 정점, 88% 감량, meshopt 기반이라
       나뭇잎 카드가 사라지지 않고 결만 성글어진다) → `resize`(768px) → `jpeg`(품질 85)
       로 4.86MB 까지 줄였다. 옛 Quaternius 셋은 `TREE_STYLIZED` 에 되돌림 자리로 남긴다 */
    'tree:common': NAT_REAL + 'IslandTree_02.glb',
    /* 2026-09-09 — 이 두 키는 예전부터 있었다(파일 CommonTree_Autumn/Snow_1·2.glb
       도 이미 저장소에 받아 둔 채였다 — "가을·눈 소재가 없다"던 README 는
       **실사(Poly Haven photogrammetry) 검색** 얘기였지, 이 저다각형(Quaternius)
       쪽엔 처음부터 있었다). 진짜 안 되고 있던 건 **부르는 쪽이 없던 것**이다 —
       `SCATTER_KIND`가 늘 `'tree:common'`만 가리켜서 이 두 키는 아무 코드도
       안 부르는 죽은 자리였다. 이제 `village-view3d.js`의 `seasonalTreeKey()`가
       봄·여름은 위 실사 하나 그대로 쓰고, **가을·겨울만** 이 표로 갈아 끼운다
       (원작처럼 계절이 나무 겉모습을 바꾼다). `_3` 파일과 자작나무 계절판
       (`BirchTree_Autumn/Snow_1·2.glb`, 새로 받음)을 여기 같이 섞었다 — 순수
       흰 자작보다 단풍·눈 옷 입은 쪽이 이 계절 팔레트와 더 붙는다. Quaternius
       `nature_pack`(CC0, 위 TREE_STYLIZED 와 같은 미러) 저다각형 — 실사가
       아니라 봄·여름과 결이 안 맞는 건 의도한 트레이드오프다 */
    'tree:common:autumn': [
      NAT + 'CommonTree_Autumn_1.glb', NAT + 'CommonTree_Autumn_2.glb', NAT + 'CommonTree_Autumn_3.glb',
      NAT + 'BirchTree_Autumn_1.glb', NAT + 'BirchTree_Autumn_2.glb'
    ],
    'tree:common:snow': [
      NAT + 'CommonTree_Snow_1.glb', NAT + 'CommonTree_Snow_2.glb', NAT + 'CommonTree_Snow_3.glb',
      NAT + 'BirchTree_Snow_1.glb', NAT + 'BirchTree_Snow_2.glb'
    ],
    /* 고목 — Poly Haven `dead_quiver_trunk`(가지 없이 선 마른 줄기, 33,706 폴리곤).
       "dead_tree_trunk"·"dead_tree_trunk_02" 이름의 모델은 둘 다 실제로는 **쓰러진
       통나무**라(원본 렌더로 직접 확인) tree:dead 자리엔 안 맞고, 대신 `log` 표에
       썼다(아래). 지오메트리가 가벼워 심플리파이 없이 resize+jpeg 만 했다 */
    'tree:dead': NAT_REAL + 'TreeDead.glb',
    /* 소나무 — Poly Haven `pine_sapling_small`. 어린 소나무라 원작 저다각형(굵고
       빽빽한 원뿔)보다 가늘고 성긴 모양이다 — 사실적인 대신 실루엣이 달라진다.
       원본 정점 406,356(폴리곤 수 398,144 와 안 맞는다 — 바늘잎이 낱장 지오메트리로
       펼쳐져 나온 탓, 나무 실사가 다 이렇다) 를 weld→simplify(ratio 0.08, 정점
       56,364 로 86% 감량)→resize→jpeg 로 21.9MB → 2.71MB */
    'tree:pine': NAT_REAL + 'PineSapling.glb',
    /* 침엽수는 계절이 지나도 잎이 안 지지만, 이 CC0 팩엔 가을 색·눈 쌓인
       버전이 따로 있어(`tree:common`과 같은 미러) 겨울 숲 전체가 한쪽만
       계절을 타면 오히려 어색해 보인다 — `tree:common` 과 같은 결로 맞췄다.
       가을 소나무는 잎보다는 아래 마른 낙엽·색 바랜 나무껍질 쪽 변화다 */
    'tree:pine:autumn': [NAT + 'PineTree_Autumn_1.glb', NAT + 'PineTree_Autumn_2.glb'],
    'tree:pine:snow': [NAT + 'PineTree_Snow_1.glb', NAT + 'PineTree_Snow_2.glb'],
    /* 봄·여름 흰 자작(초록잎) — 파일(`BirchTree_1/2.glb`)은 예전 32종 확보 때부터
       있었지만 이 키 자체는 `tree:common:autumn`처럼 아무 SCATTER_KIND 도
       안 부르는 죽은 자리였다. `ROCK_STYLIZED`·`TREE_STYLIZED`와 같은 결의
       **되돌림/확장 자리**로 그대로 둔다 — 봄·여름에도 자작 변종을 섞고
       싶어지면 `seasonalTreeKey()` 표에 'tree:common'(기본) 줄을 하나 늘리면
       된다 */
    'tree:birch': [NAT + 'BirchTree_1.glb', NAT + 'BirchTree_2.glb'],

    /* 식물·자연물 */
    /* 수풀 — 2026-09-03 실사화. Poly Haven `shrub_02`·`shrub_03`·`fern_02`·
       `shrub_sorrel_01`·`wild_rooibos_bush` 도 받아 봤지만 전부 옆으로 퍼지는
       바닥형(정점 y-폭이 작다) 이라 `normalize()` 가 키 1 로 맞추면 옆으로
       몇 배 늘어나 화면을 뚫고 나갔다 — **이 판의 정규화는 세로로 선 모양만
       받는다.** `shrub_04`(작은 나뭇가지 넷이 위로 선 다발) 만 세로 비율이 맞아
       썼다. 텍스처만 768px+jpeg85(지오메트리는 47,813 폴리곤으로 가벼워 심플리파이
       없이 그대로). 옛 Quaternius 둘 + 열매수풀은 `BUSH_STYLIZED` 에 남긴다 */
    'bush': NAT_REAL + 'Shrub_04.glb',
    /* 바위 — 2026-09-03, "자연물도 실사로" 첫 항목. Poly Haven CC0 사진측량 스캔.
       나무(780만 폴리곤·478MB)와 달리 바위는 지오메트리가 가벼워(.bin 0.5~1.5MB)
       그대로 썼다 — 줄일 필요가 없었다. 텍스처만 `gltf-transform resize`(768px)
       + `jpeg`(품질 85)로 줄였다.
       **함정 — `--virtual-time-budget` 헤드리스로 확인하면 이 GLB 들이 몇 분째
       안 뜬 것처럼 보인다.** GLTFLoader 파싱 자체는 실제 브라우저에서 30~40ms면
       끝나는데(puppeteer 로 실측), 헤드리스의 가상 시간이 진짜 텍스처 디코드
       같은 CPU 작업을 제대로 못 앞당겨서 생기는 착시였다 — **`EXT_texture_webp`
       확장은 진짜 문제였다**(이 판 three.js 번들엔 이름표만 있고 실제 파서가
       없어 `extensionsRequired`로 박히면 영영 안 뜬다, glTF 규격상 정상 동작).
       그래서 압축은 jpeg 까지만 하고 webp 는 안 쓴다. 나중에 또 GLB 를
       헤드리스로 확인할 때 안 뜬다고 코드를 의심하기 전에 **실제 브라우저(또는
       puppeteer)로 한 번 더 확인**할 것 — `--virtual-time-budget` 은 이미지가
       든 GLB 여럿을 한꺼번에 구울 때 특히 misleading 하다.
       옛 Quaternius 저다각형 셋은 지우지 않고 `ROCK_STYLIZED` 에 남겨 둔다
       (되돌림 자리) */
    'rock': [NAT_REAL + 'Rock_07.glb', NAT_REAL + 'Stone_01.glb'],
    'rock:moss': [NAT_REAL + 'MossRock_a.glb', NAT_REAL + 'MossRock_b.glb', NAT_REAL + 'MossRock_c.glb'],
    'grass': [NAT + 'Grass_2.glb', NAT + 'Grass_Short.glb'],
    'flower': NAT + 'Flowers.glb',
    'plant': [NAT + 'Plant_1.glb', NAT + 'Plant_2.glb'],
    'mushroom': [PROP + 'Mushroom_1.glb', PROP + 'Mushroom_2.glb'],
    'stump': [NAT + 'TreeStump.glb', NAT + 'TreeStump_Moss.glb'],
    /* 통나무 — tree:dead 를 찾다가 나온 부산물. Poly Haven `dead_tree_trunk`·
       `dead_tree_trunk_02` 는 이름과 달리 둘 다 쓰러진 통나무라(위 tree:dead
       주석 참고) 여기 자리가 원래 뜻에 더 맞는다. 지오메트리가 가벼워
       심플리파이 없이 resize+jpeg 만 했다. 옛 Quaternius 둘은 `LOG_STYLIZED` */
    'log': [NAT_REAL + 'Log_a.glb', NAT_REAL + 'Log_b.glb'],
    'mountain': [NAT + 'Mountain_1.glb', NAT + 'Mountain_2.glb'],

    /* 장식 (PLAN 8절) */
    'bench': PROP + 'Bench_1.glb',
    'fence': PROP + 'Fence.glb',
    'cart': PROP + 'Cart.glb',
    'campfire': PROP + 'Bonfire_Lit.glb',
    'tent': PROP + 'Tent.glb',
    'lantern': PROP + 'WoodenTorch.glb',
    'well': PROP + 'Well.glb',
    'bridge': PROP + 'Bridge.glb',
    'gazebo': PROP + 'Gazebo.glb',
    /* 우주기지(PLAN 45절, 2026-09-11) — 새 GLB를 안 받았다. 'crate'는
       'building:mail'(우편함)이 이미 쓰는 box_small.gltf.glb를 같은
       파일 그대로 새 kind로 한 줄 더 등록한 것뿐이다 */
    'crate': PROP + 'box_small.gltf.glb',
    /* 우주기지 확충(2026-09-14, PLAN 46-3절 "다음에 이어갈 것" — 위 BLD_SPACE
       주석 참고) — 이번엔 그 팩 자체(건물·로버·메카)를 처음 받았다 */
    'building:spaceBase': BLD_SPACE + 'Base_Large.glb',
    'building:spaceHouse': BLD_SPACE + 'House_Single.glb',
    'building:spaceDome': BLD_SPACE + 'GeodesicDome.glb',
    'rover': PROP_SPACE + 'Rover_1.glb',
    'solarPanel': PROP_SPACE + 'SolarPanel_Ground.glb',
    'mech': PROP_SPACE + 'Mech_FinnTheFrog.glb',
    /* 폐허(2026-09-10, 퓨전 방향 — PLAN 10절 "폐허") — saga-go·saga-dungeon
       이 이미 CC0 확인해 둔 Quaternius 무너진 아치(modular_dungeon_1 팩)를
       그대로 복사(md5 saga-go 쪽과 동일, ASSET_LICENSES.md 참고) */
    'ruin:arch': PROP + 'Arch.glb',
    /* 폐허 확장(2026-09-11, PLAN 46-2절 — §45가 제안한 "과거" 목적지를
       아치 하나뿐이던 폐허에 실제로 채웠다) — saga-go가 Sketchfab에서
       CC0로 받아 이미 다듬어 둔 **진짜 13~14세기 탑성(tower house) 폐허
       사진측량 스캔**(Renvylle Castle, 584.5KB로 정제됨)을 하드링크로
       옮겼다. 새로 안 받았다 — `BLD_REAL`(집 셋과 같은 실사 경로)이라
       `looksRealistic()`이 PBR을 안 벗긴다(house_wooden 등과 같은 결) */
    'building:ruinTower': BLD_REAL + 'tower_ruin.glb',

    /* 마을 3D 건물 (PLAN 6절 "작은 마을") — village.js 의 props 가 이미 갖고
       있던 shop·home·board·mail·tailor·pole·museum 을 처음으로 GLB 로 세운다.
       셋 다 정확히 하나뿐인 건물이라 나무·바위처럼 변종(oneOf) 배열을 안 쓰고
       kind 하나에 파일 하나씩 고정했다.
       **2026-09-19 — home·tailor·museum 교체**: PolyScan 사진측량
       house_wooden·house_cottage·house_stone(하드링크, 여전히 `saga-dungeon`
       등에서는 쓰는 중)은 §6.2 가 우려하던 대로 툰 셰이딩과 안 어울려
       Kenney Fantasy Town Kit(CC0) 모듈 조립으로 갈아 끼웠다 — 경위는
       `assets/ASSET_LICENSES.md` "Kenney Fantasy Town Kit" 절, 조립은
       `tools/asset-forge/kitbash.py`(RECIPES), 팔레트 스냅은 `palette.py
       forest_green`. `shop`(MarketStand_1, 이미 스타일라이즈드)은 그대로 */
    'building:home': BLD_GEN + 'house_wood_home.glb',
    'building:shop': BLD + 'MarketStand_1.glb',
    'building:tailor': BLD_GEN + 'house_wood_cottage.glb',
    'building:museum': BLD_GEN + 'house_stone_museum.glb',
    'building:board': PROP + 'signpost.glb',
    'building:mail': PROP + 'box_small.gltf.glb',
    'building:pole': PROP + 'banner_thin_red.gltf.glb',
    /* 캠프 오두막(2026-09-09) — House_1~4.glb 는 마을당 건물이 하나뿐이라
       그동안 되돌림 자리로만 받아 뒀던 것(ASSET_LICENSES.md "다음에 위성
       마을·다양화용")을 숲 고리의 캠프(hamletSpot)에서 처음 쓴다.
       **같은 날 이어서** — House_1 도 하나 더 얹어 "상인 혼자 사는 오두막
       하나"였던 캠프를 "여럿이 지내는 움집 여럿"으로 늘렸다. **또 이어서** —
       사용자가 "이 캠프에 더 얹어, House_3도 마저 써"로 지시해 House_3까지
       마저 태웠다. **또 이어서** — "두 번째 캠프 새로 열어"로 새 자리
       (hamlet2Spot)를 열며 마지막 House_4까지 썼다 — 이걸로 House_1~4 넷
       다 실제로 쓰인다 */
    /* 2026-09-19 — §6.4 "주민 집 외형 3종(집 GLB + 지붕 색)". 첫 캠프 세 채를
       Quaternius medieval_village_pack(House_1~3, 여전히 정지 도형 실루엣이라
       §6.2 가 우려하던 스타일 혼재는 아니지만 이 판만의 킷배싱 결과 아니었다)
       에서 이 판 자체 킷배싱 조립(`tools/asset-forge/kitbash.py` house_camp_a/b/c,
       벽 배치는 house_wood_home과 동일 + 지붕만 tint-glb로 미리 다르게 물들임)
       으로 갈아 끼웠다 — home·tailor·museum과 같은 자산 계열로 통일. House_4
       (hamlet2House, 두 번째 캠프)는 이번 범위 밖(PLAN §6.4, 3종만 지정)이라
       그대로 둔다 — House_1~3.glb 파일 자체는 안 지웠다(되돌림 자리) */
    'building:hamletHouse': BLD_GEN + 'house_camp_a.glb',
    'building:hamletHut': BLD_GEN + 'house_camp_b.glb',
    'building:hamletShed': BLD_GEN + 'house_camp_c.glb',
    'building:hamlet2House': BLD + 'House_4.glb',

    /* 동물 (PLAN 16절) — 사슴·여우·늑대(Quaternius). 2026-09-09, 토끼·다람쥐·
       오리·새도 poly.pizza(Poly by Google, CC-BY 3.0)에서 찾아 채웠다 —
       `assets/ASSET_LICENSES.md` 참고. 새로 받은 넷은 텍스처만 resize+jpeg
       로 줄였다(정지 모델, 애니메이션 없음 — deer·fox·wolf 와 같은 사정) */
    'animal:an_deer': ANI + 'Deer.glb',
    'animal:an_wolf': ANI + 'Wolf.glb',
    'animal:an_fox': ANI + 'Fox.glb',
    'animal:an_rabbit': ANI + 'Rabbit.glb',
    'animal:an_squirrel': ANI + 'Squirrel.glb',
    'animal:an_duck': ANI + 'Duck.glb',
    'animal:an_bird': ANI + 'Bird.glb',
    /* 개구리·뱀(2026-09-10, "동물들도 찾아봐") — saga-go 의 Quaternius 짐승
       팩(CC0)에서 그대로 옮겼다. 둘 다 원본에 Idle·Walk(개구리는 Jump) 클립이
       있어 `buildGeneric()`가 자동으로 걷는 몸짓을 태운다 */
    'animal:an_frog': ANI + 'Frog.glb',
    'animal:an_snake': ANI + 'Snake.glb',

    /* 몬스터(2026-09-10, "괴물이 나와도 되고" — 퓨전 방향으로 확장, PLAN 20절
       "몬스터 습격" 예시). saga-dungeon 이 이미 CC0 확인해 둔 Quaternius
       "Ultimate Monsters Bundle"에서 버섯숲(mushroom) 바이옴에 맞는
       Mushnub 하나만 옮겨 왔다(`ASSET_LICENSES.md` 참고) — 원본에
       Idle·Walk·Attack 클립이 있어 다른 짐승과 같은 결로 걷는 몸짓이 탄다 */
    'monster:mushnub': MON + 'Mushnub_55c64684.glb',
    /* 성간충(2026-09-14, PLAN 46-4 "다음에 이어갈 것" — Enemy_*). 배달원
       우주복(§46-3)·우주기지 건물(§46-4)과 같은 Ultimate Space Kit(Quaternius,
       CC0)의 Enemy_Small — 우주기지에만 아주 드물게 나타나는 몬스터다.
       원본에 Idle·Walk·Attack 클립이 있어 다른 짐승과 같은 결로 걷는
       몸짓이 탄다(`ASSET_LICENSES.md` 참고) */
    'monster:spacebug': MON + 'space/EnemySmall.glb',

    /* 2026-09-05 — 도감 펫(`pt_*`·`pk_*`) 초상을 굽는 자리(`portrait3d.js`).
       위 `animal:an_*` 는 숲의 **배경 짐승** 전용이라 도감 펫과 id 가 안
       겹친다. 사용자 지시("초상화를 더 가져올 수 있나, 맞출 필요 없이 있으면
       교체")에 따라 새로 받지 않고 **같은 세 모델을 형태(form)별로 돌려 쓴다**
       (`keysFor()`의 `pet:form:*` 참고). 이 판은 사족(quad) 셋(사슴·늑대·여우)
       뿐이라 bird·fish·turtle 등은 대응 CC0 가 아예 없다 — 그 형태들은 마지막
       `pet` 한 줄(같은 셋)로 떨어진다. **2026-09-09에 받은 `an_bird`는 배경
       짐승 전용이라 이 자리엔 안 얹었다** — 도감 펫 형태별 초상은 종별로
       결이 맞는 모델이 필요한데, 새 한 종만으로 bird·fish·turtle 여러 형태를
       다 대신하긴 안 맞다(사족 셋도 마찬가지 근사이긴 하나, 그때 이미 확정된
       결정이라 이번엔 건드리지 않는다). `assets/ASSET_LICENSES.md` 참고 */
    /* 2026-09-24 — **펫 105종 전부 제 모델(또는 대역).** 여태 이 판은 늑대·사슴·여우 셋을 105종이 id 해시로 돌려 입어
       고래도 범도 여우였다. 사가나락의 Quaternius CC0(실제 동물 78종)와 사가만리의 신수·오마주 대역(같은 모델, 사용자 결정
       "사가만리처럼 대역 입히기")을 복사해 사가종횡와 같은 짝으로 못 박는다. 형태 표(아래 두 줄)는 되돌림 자리로 남긴다.
       2026-09-25 — **대역도 종마다 한 벌**(tools/asset-audit/CHARACTER_UNIQUENESS.md ④): 신수·오마주·까치 28종이 서로 안 겹친다 —
       Quaternius "Ultimate Monsters"(CC0) 열여덟 벌(용·유령·예티·버섯이…) + 코끼리(불가사리) · 범·여우·말·흰말은 같은 종이라 그 모델.
       다섯 판 같은 배정(사가만리 asset3d.js 주석). */
    'pet:pk_alakazam': STANDIN + 'Wizard.glb',
    'pet:pk_bulbasaur': STANDIN + 'Mushnub.glb',
    'pet:pk_charizard': STANDIN + 'Dragon.glb',
    'pet:pk_charmander': STANDIN + 'Dino.glb',
    'pet:pk_dragonite': STANDIN + 'Alpaking.glb',
    'pet:pk_eevee': STANDIN + 'Monkroose.glb',
    'pet:pk_gengar': STANDIN + 'Ghost.glb',
    'pet:pk_gyarados': STANDIN + 'Snake_angry.glb',
    'pet:pk_lapras': STANDIN + 'Glub_Evolved.glb',
    'pet:pk_magikarp': STANDIN + 'Glub.glb',
    'pet:pk_mew': STANDIN + 'Cat_Monster.glb',
    'pet:pk_mewtwo': STANDIN + 'Alien_2.glb',
    'pet:pk_pikachu': STANDIN + 'Bunny.glb',
    'pet:pk_slowbro': STANDIN + 'Pink_Slime.glb',
    'pet:pk_snorlax': STANDIN + 'Yeti.glb',
    'pet:pk_squirtle': STANDIN + 'Squidle.glb',
    'pet:pt_alpaca': ANI_EXTRA + 'Alpaca.glb',
    'pet:pt_anglerfish': ANI_EXTRA2 + 'Anglerfish.glb',
    'pet:pt_apatosaurus': ANI_EXTRA2 + 'Apatosaurus.glb',
    'pet:pt_armored_catfish': ANI_EXTRA2 + 'Armored_Catfish.glb',
    'pet:pt_baekho': ANI + 'Tiger.glb',
    'pet:pt_bear': ANI + 'Bear.glb',
    'pet:pt_betta': ANI_EXTRA2 + 'Betta.glb',
    'pet:pt_black_lion_fish': ANI_EXTRA2 + 'Black_Lion_Fish.glb',
    'pet:pt_blobfish': ANI_EXTRA2 + 'Blobfish.glb',
    'pet:pt_blue_goldfish': ANI_EXTRA2 + 'Blue_Goldfish.glb',
    'pet:pt_blue_tang': ANI_EXTRA2 + 'Blue_Tang.glb',
    'pet:pt_boar': ANI + 'Boar.glb',
    'pet:pt_bulgasari': STANDIN + 'Elephant.glb',
    'pet:pt_bull': ANI_EXTRA + 'Bull.glb',
    'pet:pt_butterfly_fish': ANI_EXTRA2 + 'Butterfly_Fish.glb',
    'pet:pt_cardinal_fish': ANI_EXTRA2 + 'Cardinal_Fish.glb',
    'pet:pt_carp': ANI + 'Koi.glb',
    'pet:pt_cat': ANI + 'Cat.glb',
    'pet:pt_cheongryong': STANDIN + 'Dragon_Evolved.glb',
    'pet:pt_clownfish': ANI_EXTRA2 + 'Clownfish.glb',
    'pet:pt_coral_grouper': ANI_EXTRA2 + 'Coral_Grouper.glb',
    'pet:pt_cow': ANI_EXTRA + 'Cow.glb',
    'pet:pt_cow_farm': ANI_EXTRA + 'Cow_Farm.glb',
    'pet:pt_cowfish': ANI_EXTRA2 + 'Cowfish.glb',
    'pet:pt_crane': ANI + 'Crane.glb',
    'pet:pt_deer': ANI + 'Deer.glb',
    'pet:pt_dokkaebi': STANDIN + 'Orc.gltf',
    'pet:pt_dolphin': ANI_EXTRA + 'Dolphin.glb',
    'pet:pt_donkey': ANI_EXTRA + 'Donkey.glb',
    'pet:pt_fish_1': ANI_EXTRA + 'Fish1.glb',
    'pet:pt_fish_2': ANI_EXTRA + 'Fish2.glb',
    'pet:pt_fish_3': ANI_EXTRA + 'Fish3.glb',
    'pet:pt_flatfish': ANI_EXTRA2 + 'Flatfish.glb',
    'pet:pt_flower_horn': ANI_EXTRA2 + 'Flower_Horn.glb',
    'pet:pt_fox': ANI + 'Fox.glb',
    'pet:pt_goblin_shark': ANI_EXTRA2 + 'Goblin_Shark.glb',
    'pet:pt_goldfish': ANI_EXTRA2 + 'Goldfish.glb',
    'pet:pt_gumiho': ANI + 'Fox.glb',
    'pet:pt_haetae': STANDIN + 'Goleling.glb',
    'pet:pt_horse': ANI_EXTRA + 'Horse.glb',
    'pet:pt_horse_farm': ANI_EXTRA + 'Horse_Farm.glb',
    'pet:pt_humphead': ANI_EXTRA2 + 'Humphead.glb',
    'pet:pt_hyeonmu': ANI + 'Snake.glb',
    'pet:pt_jeoktoma': ANI_EXTRA + 'Horse.glb',
    'pet:pt_jeolyeong': ANI_EXTRA + 'White_Horse.glb',
    'pet:pt_jindo': ANI + 'ShibaInu.glb',
    'pet:pt_jujak': STANDIN + 'Hywirl.glb',
    'pet:pt_koi_2': ANI_EXTRA2 + 'Koi.glb',
    'pet:pt_lionfish': ANI_EXTRA2 + 'Lionfish.glb',
    'pet:pt_llama': ANI_EXTRA + 'Llama.glb',
    'pet:pt_magpie': STANDIN + 'Pigeon.glb',
    'pet:pt_mandarin_fish': ANI_EXTRA2 + 'Mandarin_Fish.glb',
    'pet:pt_manta_ray': ANI_EXTRA + 'MantaRay.glb',
    'pet:pt_monkey': ANI + 'Monkey.glb',
    'pet:pt_moorish_idol': ANI_EXTRA2 + 'Moorish_Idol.glb',
    'pet:pt_owl': ANI + 'Owl.glb',
    'pet:pt_panda': ANI + 'Panda.glb',
    'pet:pt_parasaurolophus': ANI_EXTRA2 + 'Parasaurolophus.glb',
    'pet:pt_parrot_fish': ANI_EXTRA2 + 'Parrot_Fish.glb',
    'pet:pt_pig': ANI_EXTRA + 'Pig.glb',
    'pet:pt_piranha': ANI_EXTRA2 + 'Piranha.glb',
    'pet:pt_puffer': ANI_EXTRA2 + 'Puffer.glb',
    'pet:pt_pug': ANI_EXTRA + 'Pug.glb',
    'pet:pt_red_snapper': ANI_EXTRA2 + 'Red_Snapper.glb',
    'pet:pt_royal_gramma': ANI_EXTRA2 + 'Royal_Gramma.glb',
    'pet:pt_samjogo': STANDIN + 'Birb.glb',
    'pet:pt_sapsal': ANI + 'Husky.glb',
    'pet:pt_shark': ANI_EXTRA + 'Shark.glb',
    'pet:pt_shark_2': ANI_EXTRA2 + 'Shark.glb',
    'pet:pt_sheep': ANI_EXTRA + 'Sheep.glb',
    'pet:pt_stag': ANI_EXTRA + 'Stag.glb',
    'pet:pt_stegosaurus': ANI_EXTRA2 + 'Stegosaurus.glb',
    'pet:pt_sunfish': ANI_EXTRA2 + 'Sunfish.glb',
    'pet:pt_swordfish': ANI_EXTRA2 + 'Swordfish.glb',
    'pet:pt_t_rex': ANI_EXTRA2 + 'T_Rex.glb',
    'pet:pt_tang': ANI_EXTRA2 + 'Tang.glb',
    'pet:pt_tetra': ANI_EXTRA2 + 'Tetra.glb',
    'pet:pt_tiger': ANI + 'Tiger.glb',
    'pet:pt_toad': ANI + 'Frog.glb',
    'pet:pt_triceratops': ANI_EXTRA2 + 'Triceratops.glb',
    'pet:pt_tuna': ANI_EXTRA2 + 'Tuna.glb',
    'pet:pt_turbot': ANI_EXTRA2 + 'Turbot.glb',
    'pet:pt_velociraptor': ANI_EXTRA2 + 'Velociraptor.glb',
    'pet:pt_whale': ANI_EXTRA + 'Whale.glb',
    'pet:pt_white_horse': ANI_EXTRA + 'White_Horse.glb',
    'pet:pt_worm': ANI_EXTRA2 + 'Worm.glb',
    'pet:pt_yellow_tang': ANI_EXTRA2 + 'Yellow_Tang.glb',
    'pet:pt_zebra': ANI_EXTRA + 'Zebra.glb',
    'pet:pt_zebra_clown_fish': ANI_EXTRA2 + 'Zebra_Clown_Fish.glb',
    'pet:form:quad': [ANI + 'Deer.glb', ANI + 'Wolf.glb', ANI + 'Fox.glb'],
    'pet': [ANI + 'Deer.glb', ANI + 'Wolf.glb', ANI + 'Fox.glb']
  };

  var REG = {};
  function restore() {
    var k;
    REG = {};
    for (k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) { REG[k] = DEFAULTS[k]; } }
    return REG;
  }
  restore();

  function register(key, url) {
    if (!key) { return REG; }
    if (url) { REG[key] = url; } else { delete REG[key]; }
    return REG;
  }

  function clear() { REG = {}; return REG; }

  /** 이 사물을 어떤 키들로 찾아볼까 — 좁은 것부터 넓은 것 순. 순수 함수
   *
   * `pet`(도감 펫, `pt_*`·`pk_*`)만 **형태(form)** 한 단계를 더 본다 —
   * saga-go 의 `asset3d.js` 에서 옮겼다(2026-09-05). 종 하나하나에 CC0 모델을
   * 못 대므로, `sprite.beastFormOf()` 가 매기는 quad·bird·fish·turtle·dragon·
   * horse·toad·ogre 여덟 형태 중 실제로 있는 것만 걸어 두고 나머지는 `pet`
   * 한 줄(마지막)로 다 받는다. 다른 kind(tree·rock 등)는 원래대로다. */
  function keysFor(kind, ref) {
    var r = ref || {};
    if (!kind) { return []; }
    if (kind === 'pet') {
      var form = r.form || (global.DG.sprite && global.DG.sprite.beastFormOf ?
        global.DG.sprite.beastFormOf(r) : null);
      return [r.id ? 'pet:' + r.id : null, form ? 'pet:form:' + form : null, 'pet'].filter(Boolean);
    }
    return [r.id ? kind + ':' + r.id : null, kind].filter(Boolean);
  }

  /** 표에서 첫 히트 — 없으면 null. three 없이도 돈다 */
  function lookup(kind, ref) {
    var ks = keysFor(kind, ref), i;
    for (i = 0; i < ks.length; i++) {
      if (REG[ks[i]]) { return { key: ks[i], url: REG[ks[i]] }; }
    }
    return null;
  }

  /** 표의 한 줄이 여럿이면 그중 하나를 고른다 — ref.id 해시로 늘 같은 것 */
  function oneOf(list, ref) {
    if (!list) { return null; }
    if (typeof list === 'string') { return list; }
    if (!list.length) { return null; }
    var s = String((ref && (ref.id || ref.name)) || ''), i, h = 0;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return list[h % list.length];
  }

  /* ── 애니메이션 이름 맞추기 (saga-go 의 asset3d.js 에서 그대로 옮겼다) ──
   * 모델마다 클립 이름이 제각각이다(mixamo·blender·수제). 이름을 씻어 놓고
   * **점수를 매겨** 가장 잘 맞는 것부터 자리를 채운다. three 없이도 도는
   * 순수 함수라 진단이 렌더러 없이 검사할 수 있다. */
  var SLOTS = ['idle', 'walk', 'run', 'sprint', 'attack', 'hit', 'dodge', 'death', 'interaction', 'jump', 'land'];
  var WORDS = {
    idle: ['idle', 'stand', 'standing', 'breathe', 'rest', 'wait', 'loop'],
    walk: ['walk', 'walking', 'locomotion', 'move'],
    run: ['run', 'running', 'jog'],
    sprint: ['sprint', 'runfast', 'fastrun', 'dash'],
    attack: ['attack', 'atk', 'slash', 'swing', 'strike', 'punch', 'shoot', 'cast'],
    hit: ['hit', 'hurt', 'damage', 'gethit', 'takedamage', 'impact', 'flinch'],
    dodge: ['dodge', 'roll', 'evade', 'sidestep'],
    death: ['death', 'die', 'dead', 'dying', 'defeat'],
    interaction: ['interact', 'interaction', 'use', 'pick', 'gather', 'talk', 'open', 'action'],
    jump: ['jump', 'leap', 'hop'],
    land: ['land', 'landing']
  };
  function normName(s) {
    var n = String(s || '');
    if (n.indexOf('|') >= 0) { n = n.split('|').pop(); }
    n = n.replace(/\.\d+$/, '');
    return n.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function score(slot, name) {
    var ws = WORDS[slot] || [], i, w, best = 0, s;
    for (i = 0; i < ws.length; i++) {
      w = ws[i];
      if (name === w) { s = 100; }
      else if (name.indexOf(w) === 0) { s = 70; }
      else if (name.indexOf(w) >= 0) { s = 40; }
      else { continue; }
      s -= i;
      if (s > best) { best = s; }
    }
    return best;
  }
  var FALLBACK = {
    run: ['walk', 'idle'], sprint: ['run', 'walk'], walk: ['run', 'idle'],
    hit: ['idle'], dodge: ['run', 'walk'], attack: ['interaction', 'idle'],
    death: ['hit', 'idle'], interaction: ['idle'], idle: ['walk'], jump: ['idle'], land: ['idle']
  };
  function mapClips(names) {
    var list = (names || []).map(function (n) { return { raw: n, n: normName(n) }; });
    var pairs = [], si, ci, sc;
    for (si = 0; si < SLOTS.length; si++) {
      for (ci = 0; ci < list.length; ci++) {
        sc = score(SLOTS[si], list[ci].n);
        if (sc > 0) { pairs.push({ slot: SLOTS[si], raw: list[ci].raw, s: sc, si: si, ci: ci }); }
      }
    }
    pairs.sort(function (a, b) { return (b.s - a.s) || (a.si - b.si) || (a.ci - b.ci); });
    var out = {}, taken = {}, i, p;
    for (i = 0; i < pairs.length; i++) {
      p = pairs[i];
      if (out[p.slot] || taken[p.raw]) { continue; }
      out[p.slot] = p.raw; taken[p.raw] = true;
    }
    var alias = {}, j, alt;
    for (i = 0; i < SLOTS.length; i++) {
      if (out[SLOTS[i]]) { continue; }
      alt = FALLBACK[SLOTS[i]] || [];
      for (j = 0; j < alt.length; j++) {
        if (out[alt[j]]) { out[SLOTS[i]] = out[alt[j]]; alias[SLOTS[i]] = alt[j]; break; }
      }
    }
    out.alias = alias;
    return out;
  }

  /** 키 1 로 눕히는 배율·이동값 — three 없이도 돈다 */
  function fit(box) {
    var h = (box.maxY - box.minY) || 1;
    var s = 1 / h;
    return {
      scale: s,
      dy: -box.minY * s,
      dx: -((box.minX + box.maxX) / 2) * s,
      dz: -((box.minZ + box.maxZ) / 2) * s
    };
  }

  /* ── 여기서부터 three 가 필요하다 ─────────────────────── */

  var loaderInst = null;
  /** 2026-09-09 — `build/three/entry.js`가 `MeshoptDecoder`를 내보내게 바뀌면서
   *  (사가나락가 2026-09-07에 이미 확인한 요령을 옮겼다) 여기서 GLTFLoader에
   *  한 번만 물려 둔다. 압축 안 된 옛 GLB는 이 디코더가 있어도 그냥 무시되니
   *  (`EXT_meshopt_compression` 확장이 없으면 안 탄다) 회귀 걱정 없다 —
   *  반대로 이걸 안 물리면 `extensionsRequired`로 박힌 압축 GLB(이 판이
   *  하드링크해 온 마을 3D 건물 일곱 종 전부 포함)가 **조용히 실패한다**
   *  (`acquire()`의 onError가 콘솔 로그 없이 그냥 넘어가서 화면만 비어
   *  보인다 — CDP 스크린샷으로 처음 잡아낸 버그, `_cdp_shot.py` 참고) */
  function gltfLoader() {
    var t = three();
    if (!t || !t.GLTFLoader) { return null; }
    if (!loaderInst) {
      loaderInst = new t.GLTFLoader();
      if (t.MeshoptDecoder) { loaderInst.setMeshoptDecoder(t.MeshoptDecoder); }
    }
    return loaderInst;
  }

  /** 뼈대가 있는 모델은 그냥 복제하면 뼈대를 나눠 쓴다 — 배우 여럿이 같이 걷는다 */
  function cloneScene(gltf) {
    var t = three();
    if (t.SkeletonUtils && t.SkeletonUtils.clone) { return t.SkeletonUtils.clone(gltf.scene); }
    return gltf.scene.clone(true);
  }

  /**
   * 받은 그대로의 PBR 재질을 벗긴다 — Quaternius 모델은 `metallicFactor 0.4` 를
   * 지고 오는데 이 판에 환경맵(IBL)이 없으면 배우가 거의 새까맣게 선다.
   * 빛깔만 남기고 Lambert 로 바꾼다(saga-go 에서 실제로 겪은 문제, 같은 고침).
   */
  /** 2026-09-02 — 이 경로(`/realistic/`) 밑은 PBR 재질을 안 벗긴다. 이제
   *  `village-view3d.js` 가 HDRI 환경광(`scene.environment`)을 물려서 PBR 이
   *  까맣게 뜨던 옛 문제(주석 위 설명)가 풀렸다 — 오히려 Lambert 로 벗기면
   *  실사 텍스처의 반사·거칠기가 다 죽는다. 옛 Quaternius 계열은 그대로 벗긴다
   *  (그쪽은 애초에 환경맵을 받게 만든 텍스처가 아니라 벗기는 쪽이 더 낫다) */
  function looksRealistic(url) { return typeof url === 'string' && url.indexOf('/realistic/') >= 0; }

  /** §10-Q3(2026-09-18 확정) — 사진측량 PBR(`/realistic/`)도 툰이 켜져 있으면
   *  같이 덮는다. 단, 꺼져 있을 때는 예전 그대로 PBR 을 지킨다(이 경로만
   *  Lambert 로 낮추지 않는다 — 원래 실사로 남기자고 따로 뺐던 자리라, 툰이
   *  꺼지면 그 취지를 그대로 존중한다). 물(`waterMaterial()`)은 이 GLB
   *  파이프라인을 안 타므로 안 건드린다. */
  function toonifyRealistic(root) {
    var t = three();
    var TN = global.DG.toon3d;
    if (!t || !TN || !TN.TOON_ON()) { return; }
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      var one = Array.isArray(o.material) ? o.material : [o.material];
      var out = one.map(function (m) {
        if (!m || (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial)) { return m; }
        return TN.toonify(m);
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
  }

  /** 2026-09-19 — VRoid CC0 샘플 아바타(§"고품질 셀 셰이딩급" 요청 ②인물 레버,
   *  `assets/models/people/anime/`). VRM 은 재질을 `KHR_materials_unlit`
   *  로 내보내 GLTFLoader 가 `MeshStandardMaterial`이 아니라
   *  `MeshBasicMaterial`로 읽는다 — 그래서 아래 `delam()`(Standard/Physical만
   *  본다)을 그냥 태우면 한 곳도 안 걸려 원본 재질 그대로 남는다. `delam()`
   *  자체를 고치지 않고 이 경로 전용 함수를 따로 둔 것은 `MeshBasicMaterial`
   *  이 이 프로젝트 다른 자리(외곽선 등)에서 "일부러 조명 무시" 용도로도
   *  쓰이기 때문 — 전역으로 바꾸면 그쪽까지 건드릴 위험이 있다. */
  function looksAnime(url) { return typeof url === 'string' && (url.indexOf('/people/anime/') >= 0 || url.indexOf('characters3d/') >= 0); }
  /* 2026-09-23 — 이 판 전용 몸통을 다섯 판 공용 `vroidVariant.shade()` 로 옮겼다: 옛 몸통은 새 재질에
     이름을 안 옮겨 인물 색 변형(`vroid-variant.js` apply — 재질 이름으로 머리·옷·눈을 고른다)이 한 칸도
     안 먹었다. 공용 쪽은 이름·깊이쓰기를 지키고 오픈월드 RPG식 얼굴 그림자까지 건다(툰이 꺼지면 예전처럼 Lambert) */
  function toonifyAnime(root, url) {
    var V = global.DG.vroidVariant;
    if (V && V.shade) { V.shade(root, url); }
  }

  function delam(root) {
    var t = three();
    var TN = global.DG.toon3d;
    var toon = !!(TN && TN.TOON_ON());
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      /* 법선이 아예 없는 GLB(2026-09-23 예방 — 사가천하 킷배싱 탑이 이것으로 새까맸다): GLTFLoader 는 이때 flatShading 을 켜
         주지만 toonify 가 만드는 MeshToonMaterial 은 flatShading 을 안 받아(r169) 법선 0 → 통째로 새까맣다.
         사가나락 delam 이 2026-09-04 에 먼저 밟은 함정과 같은 처방 — 지오메트리에서 계산해 채운다 */
      if (o.geometry && o.geometry.attributes.position && !o.geometry.attributes.normal) { o.geometry.computeVertexNormals(); }
      var one = Array.isArray(o.material) ? o.material : [o.material];
      var out = one.map(function (m) {
        if (!m || (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial)) { return m; }
        /* 2026-09-17 — SAGA-DESIGN §6.1: 손잡이가 켜져 있으면 툰으로, 꺼지면 예전 Lambert.
           realistic(위 looksRealistic) 경로는 애초에 이 함수를 안 탄다 */
        if (toon) { return TN.toonify(m); }
        /* vertexColors 를 안 옮기면(정점빛깔로 색을 주고 baseColorFactor 는
           검게 비워 둔 옷감이 있다) 그 자리가 조명과 무관하게 통째로 새까맣게
           뜬다 — saga-realm 에서 옮김(2026-09-03) */
        return new t.MeshLambertMaterial({
          color: m.color ? m.color.clone() : new t.Color(0xffffff),
          map: m.map || null, vertexColors: !!m.vertexColors,
          transparent: !!m.transparent, opacity: m.opacity,
          alphaTest: m.alphaTest || 0, side: m.side
        });
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
  }

  var cache = {};   // url → { state: 'load'|'ok'|'fail', gltf, clips, waiting: [cb] }
  var built = 0, swapped = 0, broke = '';

  function flush(c, arg) {
    var w = c.waiting; c.waiting = [];
    for (var i = 0; i < w.length; i++) { w[i](arg); }
  }

  /** GLB 하나를 받아 캐시한다 — 같은 url 을 몇이 동시에 물어도 한 번만 받는다 */
  function acquire(url, done) {
    var c = cache[url];
    if (c && c.state === 'ok') { done(c); return; }
    if (c && c.state === 'fail') { done(null); return; }
    if (c) { c.waiting.push(done); return; }

    var ld = gltfLoader();
    if (!ld) { cache[url] = { state: 'fail', waiting: [] }; done(null); return; }
    c = cache[url] = { state: 'load', waiting: [done] };
    ld.load(url, function (gltf) {
      c.state = 'ok';
      c.gltf = gltf;
      if (looksRealistic(url)) { toonifyRealistic(gltf.scene); }
      else if (looksAnime(url)) { toonifyAnime(gltf.scene, url); }
      else { delam(gltf.scene); }
      c.clips = gltf.animations || [];
      c.map = mapClips(c.clips.map(function (a) { return a.name; }));
      flush(c, c);
    }, undefined, function () {
      c.state = 'fail';
      flush(c, null);
    });
  }

  /**
   * 키 1 로 눕혀 담는다. `mul` 을 주면 그 키로 선다 — 지금은 전부 1(성채·역참처럼
   * 제 키로 서 있는 사물이 이 판엔 없다).
   */
  function normalize(obj, mul) {
    var t = three();
    /* 그림자 — HDRI·톤매핑과 같이 2026-09-02 에 얹었다. 세워지는 모든 사물에
       공통으로 건다(플레이어·나무·바위 다 포함) — 개별 kind 마다 따로 안 챙긴다 */
    obj.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    obj.updateMatrixWorld(true);
    var b = new t.Box3().setFromObject(obj);
    var f = fit({ minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y, minZ: b.min.z, maxZ: b.max.z });
    var m = mul || 1;
    var wrap = new t.Group();
    obj.scale.setScalar(f.scale * m);
    obj.position.set(f.dx * m, f.dy * m, f.dz * m);
    wrap.userData.span = {
      w: (b.max.x - b.min.x) * f.scale * m, d: (b.max.z - b.min.z) * f.scale * m, h: m
    };
    wrap.add(obj);
    return wrap;
  }

  /**
   * 2026-09-09 — PLAN 40절 PHASE 7 "Scatter를 진짜 InstancedMesh로"를 좁혀서
   * 되살렸다. 애니메이션·스켈레톤이 없는 작은 장식물(잔디·꽃·버섯·통나무 등)만
   * 대상이다 — 이런 종은 GLB 하나(변종)당 프리미티브(재질 단위) 1~5개뿐이고
   * 다들 `normalize()`가 매번 새로 계산하던 "키 1로 눕히는" 변환이 **url마다
   * 완전히 같은 값**이라, 그 변환을 지오메트리에 한 번만 구워 두면 인스턴스마다
   * clone·traverse·Box3 계산을 다시 할 필요가 없다 — `village-view3d.js`가 이
   * 프리미티브들을 재질별 InstancedMesh 하나씩에 나눠 담는다(자리는 다 같은
   * 행렬을 쓴다, 재질이 여러 개라도 자리는 하나뿐이니까).
   * **한 url당 딱 한 번만 계산해 `cache[url].parts`에 얹어 둔다** — 원본
   * `gltf.scene`은 절대 이동·확대하지 않는다(다른 코드가 `buildGeneric()`으로
   * 이 url을 또 쓸 수 있어 원본은 그대로 둬야 한다).
   */
  function extractParts(root) {
    var t = three();
    root.updateMatrixWorld(true);
    var b = new t.Box3().setFromObject(root);
    var f = fit({ minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y, minZ: b.min.z, maxZ: b.max.z });
    var bake = new t.Matrix4().compose(
      new t.Vector3(f.dx, f.dy, f.dz), new t.Quaternion(), new t.Vector3(f.scale, f.scale, f.scale)
    );
    var list = [];
    root.traverse(function (o) {
      if (!o.isMesh) { return; }
      var geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);   // 이 메시가 씬 안 어디 있었든 실제 자리부터 굽는다
      geo.applyMatrix4(bake);            // 그 위에 "키 1로 눕히는" 정규화까지 굽는다
      list.push({ geometry: geo, material: o.material });
    });
    return list;
  }
  var partsPending = {};   // url → true(이미 acquire() 걸어 둔 채 기다리는 중 — 중복 호출 방지)
  /**
   * kind+ref 에 맞는 변종(GLB) 하나를 **동기로** 캐시에서 찾아 프리미티브
   * 목록을 준다. 아직 안 실렸으면 로딩만 걸어 두고 null 을 돌려준다 — 부르는
   * 쪽(`village-view3d.js`)이 매 프레임 다시 물어보면 실린 다음 프레임부터는
   * 값이 온다(`build()`처럼 콜백을 안 쓰는 건, 프레임마다 이미 다 지어 둔
   * InstancedMesh 자리만 갱신하면 되는 구조라 콜백 예약이 필요 없어서다).
   */
  function partsFor(kind, ref) {
    var hit = lookup(kind, ref);
    if (!hit) { return null; }
    var url = oneOf(hit.url, ref);
    if (!url || typeof url !== 'string') { return null; }
    var c = cache[url];
    if (c && c.state === 'ok') {
      if (!c.parts) { c.parts = extractParts(c.gltf.scene); }
      return { url: url, parts: c.parts };
    }
    if (c && c.state === 'fail') { return null; }
    if (!partsPending[url]) {
      partsPending[url] = true;
      acquire(url, function () { delete partsPending[url]; });
    }
    return null;
  }

  /** 마지막 되돌림 자리 — GLB 가 안 되거나 아직 안 왔을 때 화면에 무언가는 선다 */
  function primitive(kind, ref) {
    var t = three();
    if (!t) { return null; }
    var g = new t.Group();
    var TN = global.DG.toon3d;
    var mOpts = { color: new t.Color((ref && ref.color) || '#8a94a6') };
    var m = TN ? TN.lambertLike(mOpts) : new t.MeshLambertMaterial(mOpts);
    var body = new t.Mesh(new t.CapsuleGeometry(0.22, 0.52, 4, 10), m);
    body.position.y = 0.5;
    g.add(body);
    g.userData.primitive = true;
    return g;
  }

  /** 이 장면의 키(m) — 뼈대 크기를 견줄 때 쓴다(saga-go `asset3d.js`에서 옮김) */
  function sceneHeight(obj) {
    var t = three();
    var b = new t.Box3().setFromObject(obj);
    return Math.max(1e-4, b.max.y - b.min.y);
  }

  function firstSkinned(obj) {
    var found = null;
    obj.traverse(function (o) { if (!found && o.isSkinnedMesh) { found = o; } });
    return found;
  }

  /** VRM Humanoid(VRoid, `J_Bip_C/L/R_*`) → UAL1/UE 마네킹 이름 표(2026-09-19,
   *  "고품질 셀 셰이딩급" 요청 ②인물 레버). 손가락은 뺐다 — UAL1 로코모션 클립이 손가락을
   *  안 건드려 굳이 안 옮겨도 무방하다(§PLAN 참고). `boneNameMap()`의 항등
   *  매칭이 하나도 안 걸리는 이 몸에만 덧붙는 보충표라, 기존 QRPG·MPFB(이미
   *  UAL1과 이름이 같아 항등만으로 되던 몸)는 이 표를 안 거친다 — 손 안 댐. */
  var VRM_TO_UAL1_BONES = {
    J_Bip_C_Hips: 'pelvis', J_Bip_C_Spine: 'spine_01', J_Bip_C_Chest: 'spine_02',
    J_Bip_C_UpperChest: 'spine_03', J_Bip_C_Neck: 'neck_01', J_Bip_C_Head: 'Head',
    J_Bip_L_Shoulder: 'clavicle_l', J_Bip_L_UpperArm: 'upperarm_l', J_Bip_L_LowerArm: 'lowerarm_l', J_Bip_L_Hand: 'hand_l',
    J_Bip_R_Shoulder: 'clavicle_r', J_Bip_R_UpperArm: 'upperarm_r', J_Bip_R_LowerArm: 'lowerarm_r', J_Bip_R_Hand: 'hand_r',
    J_Bip_L_UpperLeg: 'thigh_l', J_Bip_L_LowerLeg: 'calf_l', J_Bip_L_Foot: 'foot_l', J_Bip_L_ToeBase: 'ball_l',
    J_Bip_R_UpperLeg: 'thigh_r', J_Bip_R_LowerLeg: 'calf_r', J_Bip_R_Foot: 'foot_r', J_Bip_R_ToeBase: 'ball_r'
  };

  /** 목표 뼈 이름 → 원본 뼈 이름 표. 이름이 같은 것만 먼저 잇고(항등) —
   *  saga-go `asset3d.js`의 `boneNameMap()`과 동일 — 그 위에 VRM 표를
   *  덧붙인다(항등으로 이미 잡힌 이름은 건드리지 않는다). */
  function boneNameMap(tm, sm) {
    var map = {}, n = 0, i, vname;
    if (!tm.skeleton || !sm.skeleton) { return { map: map, count: 0 }; }
    var have = {}, sb = sm.skeleton.bones, tb = tm.skeleton.bones;
    for (i = 0; i < sb.length; i++) { have[sb[i].name] = 1; }
    for (i = 0; i < tb.length; i++) {
      if (have[tb[i].name]) { map[tb[i].name] = tb[i].name; n++; }
    }
    for (i = 0; i < tb.length; i++) {
      if (map[tb[i].name]) { continue; }
      vname = VRM_TO_UAL1_BONES[tb[i].name];
      if (vname && have[vname]) { map[tb[i].name] = vname; n++; }
    }
    return { map: map, count: n };
  }

  /**
   * 원본(src, 제 몸짓을 가진 모델)의 클립을 이 몸(c)에 맞게 다시 굽는다 —
   * saga-go 의 `retargetInto()`를 그대로 옮겼다. 뼈 길이가 달라도 맞는 이유,
   * "팔이 T자로 안 움직인다" 버그를 왜 이렇게 고쳤는지는 saga-go
   * `asset3d.js`의 같은 이름 함수 주석 참고. 못 하면 빈 배열 — 그러면 이 몸은
   * 가만히 선다(뒤틀리는 것보다 낫다).
   */
  function retargetInto(c, src) {
    var t = three();
    if (!t || !t.SkeletonUtils || !t.SkeletonUtils.retargetClip) { return []; }
    var tgt = firstSkinned(c.gltf.scene), s = firstSkinned(src.gltf.scene);
    if (!tgt || !s) { return []; }
    /* 옮기는 동안 뼈가 실제로 움직이므로 사본으로 굴린다 —
       원본을 굴리면 그 모델을 쓰는 다른 배우가 같이 뒤틀린다 */
    var tc = cloneScene(c.gltf), sc = cloneScene(src.gltf);
    var tm = firstSkinned(tc), sm = firstSkinned(sc);
    if (!tm || !sm) { return []; }
    tc.updateMatrixWorld(true); sc.updateMatrixWorld(true);

    var mul = sceneHeight(tc) / sceneHeight(sc);
    var names = boneNameMap(tm, sm);
    if (!names.count) { return []; }

    var out = [], i, j, clip;
    for (i = 0; i < src.clips.length; i++) {
      try {
        clip = t.SkeletonUtils.retargetClip(tm, sm, src.clips[i],
          { hip: 'Hips', scale: mul, names: names.map });
        if (clip) {
          clip.name = src.clips[i].name;
          for (j = 0; j < clip.tracks.length; j++) {
            clip.tracks[j].name = clip.tracks[j].name.replace(/^\.bones\[([^\]]+)\]/, '$1');
          }
          out.push(clip);
        }
      } catch (e) { /* 이 클립 하나만 건너뛴다 */ }
    }
    return out;
  }

  /**
   * 인물 하나 — **몸 위에 옷·머리를 얹어 한 뼈대에 묶는다.** 셋 다 뼈 이름·순서가
   * 완전히 같으므로(saga-go 에서 직접 대조했다) 스킨 메시를 몸의 스켈레톤에
   * 다시 물리기만 하면 된다.
   */
  function assembleHero(parts) {
    var bodyScene = cloneScene(parts.body.gltf);
    var master = null;
    bodyScene.traverse(function (o) { if (!master && o.isSkinnedMesh) { master = o; } });
    if (!master || !master.skeleton) { throw new Error('몸에 스켈레톤이 없다'); }
    var skeleton = master.skeleton;

    [parts.outfit, parts.hair].forEach(function (p) {
      if (!p || !p.gltf) { return; }
      var scene = cloneScene(p.gltf);
      var meshes = [];
      scene.traverse(function (o) { if (o.isSkinnedMesh) { meshes.push(o); } });
      meshes.forEach(function (m) { m.bind(skeleton, m.bindMatrix); bodyScene.add(m); });
    });

    return normalize(bodyScene, 1);
  }

  /**
   * 인물 하나를 몸+옷+머리+몸짓(UAL1) 넷을 받아 조합한다. **옮겨 입히기
   * (retarget) 가 필요 없다** — 넷 다 같은 뼈대(65뼈, 이름까지 동일)라
   * 몸짓 클립을 그대로 물릴 수 있다(saga-go 의 `HERO_RECIPES` 와 같은 규칙).
   *
   * @param cb  function(group|null) — group.userData 에 mixer·actions·clipMap 이 실린다
   */
  function buildHero(ref, cb) {
    /* §5.13 — 손님 제 몸(`ref.body`, 제 클립 든 CC0 GLB: 로봇·우주복·유령·도깨비·작업복). 몸이 곧 몸짓 파일이다.
       못 실리면 옛 길(애니메·QRPG)로 */
    /* W-0074 — 사람 손님 몸(people/ 아래: 우주복·작업복·후드)은 시대 구분 없이 VRoid 통일 몸으로(빌린 몸). 유령·로봇·도깨비는 제 몸 그대로 */
    var humanBody = ref && ref.body && ref.body.indexOf('/people/') >= 0 && global.DG.assets3d && global.DG.assets3d.borrowRecipe(borrowSeed(ref));
    if (ref && ref.body && !humanBody && three()) {
      loadHeroRecipe({ key: 'body:' + ref.body, body: ref.body, anim: ref.body }, function (model) {
        if (model) { cb(model); return; }
        buildHeroPlain(ref, cb);
      });
      return;
    }
    buildHeroPlain(ref, cb);
  }
  /** 빌린 몸 씨앗 — 손님은 날마다 id 가 visit_·settle_ 로 바뀌니 손님 키로 고정(꼬마는 제 id) */
  function borrowSeed(ref) { return ref && ref.visitor && !ref.kid ? 'visitor:' + ref.visitor : ref; }
  function buildHeroPlain(ref, cb, skipUni) {
    var t = three();
    if (!t) { cb(null); return; }
    /* 통일 3D 에셋(W-0021) — 영웅 id 로 shared/assets/characters3d 에 몸이 있으면 그것 먼저, 못 실리면 아래 옛 길 */
    var urec = !skipUni && global.DG.assets3d && global.DG.assets3d.heroRecipe(ref);
    if (urec) { loadHeroRecipe(urec, function (model) { if (model) { cb(model); return; } buildHeroPlain(ref, cb, true); }); return; }
    /* 제 몸 없는 사람(주민 NPC·손님·나)은 빌린 몸(W-0074) — 옛 VRoid 샘플·QRPG 대신 도감과 안 겹치는 VRoid 통일 몸 */
    var brec = !skipUni && global.DG.assets3d && global.DG.assets3d.borrowRecipe(borrowSeed(ref));
    if (brec) { loadHeroRecipe(brec, function (model) { if (model) { cb(model); return; } buildHeroPlain(ref, cb, true); }); return; }
    if (wantsMixamoReal()) {
      var mrec = oneOf(HERO_RECIPES_MIXAMO, ref);
      if (mrec) {
        loadHeroRecipe(mrec, function (model) {
          if (model) { cb(model); return; }
          buildHeroDefault(ref, cb);
        });
        return;
      }
    }
    if (wantsAnimeAvatar()) {
      /* 2026-09-19 — "이질감" 제보로 이름 있는 숲 NPC 7명(위 표, 옷을 숲 팔레트로 물들임)에만 걸었다.
         2026-09-20 — 사용자 "104명은 다 바꾸라고 했는데" → 나머지 주민도 VRoid 몸 넷에 id 해시로 나눠 입히고
         머리·옷·눈 색만 인물마다 바꾼다(vroid-variant.js). 마을 배경과 어울리는지는 실기 확인 몫 —
         튀면 이 줄의 oneOf(HERO_RECIPES_ANIME, ref) 만 지우면 NPC 7명만 남는다 */
      /* 2026-09-25 — 표 키는 `keeper` 인데 village.js npcAt 이 주는 id 는 `npc_keeper` 라 여태 한 번도 안 걸렸다
         (전원 해시 VRoid 로 섰다). 배달원은 제 몸(우주복 `hero:npc_courier`)이 따로 있어 그쪽으로 보낸다 */
      var nk = animeNpcKey(ref);
      if (nk === 'courier' && lookup('hero', ref) && lookup('hero', ref).key === 'hero:npc_courier') { buildHeroDefault(ref, cb); return; }
      var npcRec = nk ? HERO_RECIPES_ANIME_NPC[nk] : null;
      var arec = npcRec || oneOf(HERO_RECIPES_ANIME, ref);
      if (arec) {
        loadHeroRecipe(arec, function (model) {
          if (model) { cb(model); return; }
          buildHeroDefault(ref, cb);
        }, npcRec ? undefined : (ref && ref.id));
        return;
      }
    }
    buildHeroDefault(ref, cb);
  }

  /** 숲 NPC id(`npc_<kind>`) → 전용 몸 표 키. 주민·플레이어는 null */
  function animeNpcKey(ref) {
    var id = ref && typeof ref.id === 'string' ? ref.id : '';
    var k = id.indexOf('npc_') === 0 ? id.slice(4) : '';
    return k && Object.prototype.hasOwnProperty.call(HERO_RECIPES_ANIME_NPC, k) ? k : null;
  }

  /** 기본 경로 — QRPG(공개 기본), 그마저 못 실리면 옛 조합형으로 한 번 더 */
  function buildHeroDefault(ref, cb) {
    var rec = heroRecipe(ref);
    if (!rec) { cb(null); return; }
    loadHeroRecipe(rec, function (model) {
      if (model) { cb(model); return; }
      var fb = oneOf(HERO_RECIPES_FALLBACK, ref);
      if (fb) { loadHeroRecipe(fb, cb); return; }
      cb(null);
    });
  }

  function loadHeroRecipe(rec, cb, variantId) {
    var t = three(); // assemble() 아래서 AnimationMixer 를 만들 때 쓴다 — buildHero() 의 t 는 안 물려받는다
    built++;

    var parts = {}, pending = 4;
    var own = !rec.anim && wantsOwnAnim(rec.body);   // VRM 몸 → 자체 몸짓
    function onOne() { pending--; if (pending === 0) { assemble(); } }
    acquire(rec.body, function (c) { parts.body = c; onOne(); });
    /* outfit·hair 는 조합형(Quaternius) 레시피에만 있다 — 통짜 스킨(Mixamo·QRPG)은
       둘 다 없으니 헛수고로 받으러 가지 않고 바로 다음 칸으로 넘어간다 */
    if (rec.outfit) { acquire(rec.outfit, function (c) { parts.outfit = c; onOne(); }); } else { onOne(); }
    if (rec.hair) { acquire(rec.hair, function (c) { parts.hair = c; onOne(); }); } else { onOne(); }
    if (own) { onOne(); } else { acquire(rec.anim || ANIM_SRC, function (c) { parts.anim = c; onOne(); }); }

    function assemble() {
      if (!parts.body) { cb(null); return; }
      var model;
      try {
        model = assembleHero(parts);
        if (global.DG.vroidVariant) { global.DG.vroidVariant.faceFront(model, rec.body); }   // VRM 은 정면이 -Z — 다른 몸은 안 건드린다
        if (variantId !== undefined) { applyVroid(model, rec, variantId); }   // 색 변형은 주민(표 밖)만 — NPC 는 이미 팔레트로 물들였다
      } catch (e) {
        broke = (e && e.message) ? e.message : 'hero assemble 실패';
        cb(null);
        return;
      }
      swapped++;
      var animC = parts.anim;
      if (own) {
        /* 몸이 조립된 장면에서 실제 뼈를 읽어 그 몸에 맞춰 굽는다 — 몸마다 한 번(캐시), 못 하면 UAL1 로 되돌아간다 */
        if (!parts.body.ownClips) { parts.body.ownClips = global.DG.ownAnim.clipsFor(model, t) || []; }
        if (parts.body.ownClips.length) {
          var oc = parts.body.ownClips, om = new t.AnimationMixer(model.children[0]), oa = {}, oi;
          for (oi = 0; oi < oc.length; oi++) { oa[oc[oi].name] = om.clipAction(oc[oi]); }
          model.userData.mixer = om;
          model.userData.actions = oa;
          model.userData.clipMap = mapClips(oc.map(function (a) { return a.name; }));
          model.userData.ownAnim = true;
          if (global.DG.toon3d) { global.DG.toon3d.addOutline(model); global.DG.toon3d.rimActor && global.DG.toon3d.rimActor(model); }
          cb(model);
          return;
        }
        /* 자체 몸짓을 못 만들었다(뼈 이름이 다른 VRM 등) — 예전 길: UAL1 을 받아 와 다시 굽는다 */
        own = false; swapped--;
        acquire(ANIM_SRC, function (c) { parts.anim = c; assemble(); });
        return;
      }
      if (animC && animC.clips && animC.clips.length) {
        var clips = animC.clips;
        /* 몸에 제 몸짓이 없어(rec.anim 이 rec.body 와 다른 파일 — 즉 ANIM_SRC 를
           빌려 옴) MPFB 같은 실사 몸은 뼈 길이가 ANIM_SRC 와 달라 raw 로 물리면
           팔다리가 뒤틀린다(saga-go 가 겪은 버그, 위 `retargetInto` 주석 참고) —
           다시 구워 입힌다. 몸마다 한 번만 굽도록 parts.body(URL 로 캐싱되는
           원본 캐시 칸)에 매달아 둔다 */
        if (rec.anim !== rec.body) {
          if (!parts.body.heroClips) {
            parts.body.heroClips = retargetInto({ gltf: { scene: model } }, animC) || [];
          }
          if (parts.body.heroClips.length) { clips = parts.body.heroClips; }
        }
        var mx = new t.AnimationMixer(model.children[0]);
        var acts = {}, i;
        for (i = 0; i < clips.length; i++) { acts[clips[i].name] = mx.clipAction(clips[i]); }
        model.userData.mixer = mx;
        model.userData.actions = acts;
        model.userData.clipMap = mapClips(clips.map(function (a) { return a.name; }));
      }
      /* 외곽선(PLAN §6.1 "배우만 골라 붙이는 절충안") — 사람(주민·NPC)은
         전부 이 kind='hero' 길을 타므로 여기 한 곳에만 걸면 된다 */
      if (global.DG.toon3d) { global.DG.toon3d.addOutline(model); global.DG.toon3d.rimActor && global.DG.toon3d.rimActor(model); }
      cb(model);
    }
  }

  /** 인물이 아닌 사물 하나 — 표에서 골라 그대로 받아 눕힌다 */
  /**
   * 2026-09-10 "움직이는 모션을 더 자연스럽게" 뒤이어 — `acquire()`가 이미
   * GLB 마다 `clips`/`map`(몸짓 이름 매칭, `loadHeroRecipe()`와 같은 표)을
   * 캐시해 두는데 여기서는 여태 안 썼다(그냥 정지 모형으로 세웠다). **원본에
   * 클립이 있으면**(사슴 등 짐승 GLB는 보통 Idle·Walk 를 갖고 있다) 인물과
   * 같은 결로 mixer·actions·clipMap 을 실어 준다 — `village-view3d.js`의
   * `playAction()`이 NPC·인물과 똑같이 쓸 수 있다. 클립이 없는 나무·바위·
   * 건물류는 `c.clips.length === 0`이라 그냥 지금처럼 정지 모형으로 남는다
   * (동작 안 바뀜, 전부 하위호환).
   */
  function buildGeneric(kind, ref, cb) {
    var hit = lookup(kind, ref);
    if (!hit) { cb(null); return; }
    var url = oneOf(hit.url, ref);
    if (!url || typeof url !== 'string') { cb(null); return; }
    acquire(url, function (c) {
      if (!c || !c.gltf) { cb(null); return; }
      built++;
      var model = cloneScene(c.gltf);
      var wrapped = normalize(model, 1);
      if (c.clips && c.clips.length) {
        var t = three();
        var mx = new t.AnimationMixer(wrapped.children[0]);
        var acts = {}, i;
        for (i = 0; i < c.clips.length; i++) { acts[c.clips[i].name] = mx.clipAction(c.clips[i]); }
        wrapped.userData.mixer = mx;
        wrapped.userData.actions = acts;
        wrapped.userData.clipMap = c.map;
      }
      /* 외곽선 — 배우 중 사람이 아닌 나머지(짐승)만 여기서 건다. 나무·바위·
         건물 등 나머지 kind 는 그대로 둔다(§6.1 "땅·소품은 안 건다") */
      if (kind === 'animal' && global.DG.toon3d) { global.DG.toon3d.addOutline(wrapped); global.DG.toon3d.rimActor && global.DG.toon3d.rimActor(wrapped); }
      cb(wrapped);
    });
  }

  /**
   * GLB 를 실제로 불러 세운다 (비동기, 콜백 방식 — 화면은 안 기다린다).
   * `kind==='hero'` 는 몸+옷+머리+몸짓 넷을 묶는 조합형이라 `buildHero()` 로,
   * 나머지는 표의 파일 하나를 그대로 받는 `buildGeneric()` 으로 간다.
   * 실패하거나 three/GLTFLoader 가 없으면 cb(null) 로 부른다.
   */
  function build(kind, ref, cb) {
    if (kind === 'hero') { buildHero(ref, cb); return; }
    buildGeneric(kind, ref, cb);
  }

  /** 이 인물의 몸·옷·머리 조합 — 표에 조합 객체가 있을 때만 준다 */
  function heroRecipe(ref) {
    var h = lookup('hero', ref);
    if (!h) { return null; }
    var v = oneOf(h.url, ref);
    return (v && typeof v === 'object' && v.body) ? v : null;
  }

  global.DG = global.DG || {};
  global.DG.asset3d = {
    register: register,
    restore: restore,
    clear: clear,
    lookup: lookup,
    keysFor: keysFor,
    oneOf: oneOf,
    heroRecipe: heroRecipe,
    mapClips: mapClips,
    build: build,
    partsFor: partsFor,
    three: three,
    REG: function () { return REG; },
    ROCK_STYLIZED: ROCK_STYLIZED,
    TREE_STYLIZED: TREE_STYLIZED,
    BUSH_STYLIZED: BUSH_STYLIZED,
    LOG_STYLIZED: LOG_STYLIZED,
    stats: function () { return { built: built, swapped: swapped, broke: broke }; },
    /** 진단 전용 — VRM 애니메 아바타(§"고품질 셀 셰이딩급" 요청 ②) 손잡이·레시피·뼈 매핑표 조회 */
    wantsAnimeAvatar: wantsAnimeAvatar, wantsOwnAnim: wantsOwnAnim,
    heroRecipesAnime: function () { return HERO_RECIPES_ANIME; },
    heroRecipesAnimeNpc: function () { return HERO_RECIPES_ANIME_NPC; },
    animeNpcKey: animeNpcKey,
    vrmToUal1Bones: function () { return VRM_TO_UAL1_BONES; },
    boneNameMap: boneNameMap
  };
})(typeof window !== 'undefined' ? window : this);
