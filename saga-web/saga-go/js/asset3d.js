/**
 * 3D 에셋 창고 — GLB 를 끼워 넣을 자리를 만든다 (3D 전환 PHASE 3)
 * ---------------------------------------------------------------
 * 지금 지도 위의 사람·짐승·건물은 `actor3d.js` 가 **도형을 조립해** 세운다.
 * 손으로 빚은 것이라 가볍고 어디서나 도는 대신, 아무리 다듬어도 손으로 빚은 티가 난다.
 * 언젠가 제대로 만든 모델(GLB)을 얹고 싶은데, 그때 가서 배우 세우는 코드를 뜯어고치면
 * 지금 서 있는 그림이 통째로 흔들린다. 그래서 **미리 자리만 파 둔다**.
 *
 *   REG           무엇을 무엇으로 세울지 적은 표. **인물 · 짐승 다섯 · 역참 · 성채가 차 있다**
 *   register()    표에 한 줄 적으면 그날부터 그 배우는 GLB 로 선다
 *   build()       GLB 를 받는 동안에도 화면은 안 빈다 — 도형을 먼저 세워 두고
 *                 다 받으면 그 자리에서 갈아 끼운다
 *   step()        GLB 는 뼈대 애니메이션(AnimationMixer), 도형은 `actor3d` 의 관절
 *
 * 되돌아가는 길 (PLAN 49절)
 *
 *   GLB ── 없거나 실패 ─→ actor3d 의 도형 ── 그것도 없으면 ─→ 캡슐·상자
 *
 * **한 줄도 판정에 닿지 않는다.** 여기서 만든 것은 전부 화면에만 쓴다.
 * 표를 읽는 함수(`lookup`·`chain`·`mapClips`·`fit`)는 **three 없이도 돈다** —
 * 자가진단이 그것만 따로 본다. 세우는 함수만 three 를 쓴다.
 *
 * **자리는 다 찼다.** 인물 여섯 벌 · 짐승 다섯 종 · 역참 · 성채 셋(등급마다 하나)이
 * 진짜 모델로 선다. 파 둔 자리가 옳았다는 증거는 **표에 줄만 늘었다는 것**이다 —
 * 세우는 코드는 그대로다.
 *
 * file:// (PC 단독판)에서는 GLB 를 못 받는다(브라우저가 막는다). 실패하면 조용히
 * 도형으로 남으므로 단독판도 그대로 돈다 — 그래서 실패를 시끄럽게 알리지 않는다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  /** 2026-09-20 — VRM(`/people/anime/`) 몸은 남의 몸짓(UAL1)을 뼈 이름표로 다시 굽는 대신 `anim-own.js` 가 코드로 짠
   *  자체 몸짓을 입는다(Mixamo 는 약관상 공개 저장소에 못 올린다). 기본 켜짐, `world3d.ownAnim`=0 이면 예전 길(UAL1) */
  function wantsOwnAnim(url) {
    return !!(global.DG.ownAnim && typeof url === 'string' && (url.indexOf('/people/anime/') >= 0 || url.indexOf('characters3d/') >= 0) && core().tuned('world3d.ownAnim', 1));
  }
  function core() { return global.DG.core; }

  /** GLB 를 쓸까 — 0 이면 표에 적혀 있어도 도형으로 간다 (되돌림용 손잡이) */
  function GLB_ON() { return core().tuned('world3d.glb', 1) ? true : false; }
  /** PLAN §10-Q1 — 사진측량 실사 인체(`realistic: true`)를 기본 뽑기에 섞을까.
   *  꺼져 있으면(기본) `heroPool` 이 걸러 QRPG 저폴리 여섯 벌만 남긴다 */
  function REALISTIC_ON() { return core().tuned('world3d.realisticPeople', 0) ? true : false; }
  /** 인물 표 한 줄(`hero*` 키)에서 실사 벌을 뺀다 — 손잡이가 켜져 있거나
   *  목록이 조합 객체가 아니면(테스트가 문자열 하나로 덮어썼을 때) 그대로 준다 */
  function heroPool(list) {
    if (!Array.isArray(list) || REALISTIC_ON()) { return list; }
    var f = list.filter(function (v) { return !(v && typeof v === 'object' && v.realistic); });
    return f.length ? f : list;
  }

  /* ── 표 ───────────────────────────────────────────────
   * 키는 **좁은 것부터** 찾는다. 청룡만 따로 모델을 주고 싶으면 `pet:pt_cheongryong`,
   * 용 종류를 한꺼번에 주고 싶으면 `pet:form:dragon`, 짐승 전부면 `pet` 이다.
   *
   *   asset3d.register('hero', 'assets/models/hero.glb');
   *   asset3d.register('pet:form:dragon', 'assets/models/dragon.glb');
   *
   * 오래 비어 있었다. **이제 다 찼다** — 인물 여섯 벌 · 짐승 다섯 종 ·
   * 역참 · 성채 셋이다(Quaternius CC0, 까치만 Poly by Google CC-BY.
   * 출처는 `assets/ASSET_LICENSES.md`). 2026-09-05 — 도감 펫(`pt_*`·`pk_*`)도
   * 이 다섯 종을 `pet:form:*`·`pet`(마지막 줄)로 돌려 쓴다(아래 주석 참고).
   */
  var PEOPLE = 'assets/models/people/';
  var BLD = 'assets/models/buildings/';
  var BLD_REAL = BLD + 'realistic/';
  /* 사람 몸(body)·옷(outfit)·머리(hair) 셋이 **뼈 이름까지 완전히 같은 한 뼈대**를
     쓰는 새 인물 창고(Quaternius `Universal Base Characters` + `Modular Character
     Outfits - Fantasy`, 2026-08-29 갈아 끼움). `assets/ASSET_LICENSES.md` 참고 */
  var REGULAR = PEOPLE + 'regular/';
  var ANIM_DIR = 'assets/models/anim/';

  /* 2026-09-03 — 사가마을과 같은 이유로 사람 기본을 갈아 끼운다: 위 조합형(몸+옷+머리)
     은 그림체가 밋밋하다는 지적("2D도 허접해서" 조사 끝에 그림체 우선으로 결정, 사가마을
     참고)에 Quaternius "RPG Character Pack"(CC0, 전사·궁수·도적·성직자·마법사·수도승
     6종)으로 바꾼다. 몸 파일 하나에 걷기·공격·사망 등 클립이 다 들어 있어 옷·머리도,
     ANIM_DIR 몸짓도 필요 없다 — `anim` 을 `body` 와 같은 파일로 주면 그 클립을 그대로 쓴다.
     `assets/ASSET_LICENSES.md` 참고. */
  var PEOPLE_QRPG = PEOPLE + 'quaternius_rpg/';
  var HERO_RECIPES = ['Warrior', 'Ranger', 'Rogue', 'Cleric', 'Wizard', 'Monk'].map(function (n) {
    var f = PEOPLE_QRPG + n + '.glb';
    return { key: 'qrpg_' + n.toLowerCase(), body: f, anim: f };
  });

  /* 2026-09-05 — MPFB2(makehumancommunity.org, CC0 도구로 직접 뽑음)로 만든 실사
     인물 두 벌을 QRPG 여섯 종에 **추가 변형으로** 얹는다(대체 아님 — QRPG의 직업별
     시각 다양성은 그대로 둔다). `anim` 필드가 없으니 `buildHero()`가 공용
     `ANIM_SRC`(UAL1)를 빌려 `retargetInto()`로 다시 굽는다 — 몸 뼈 길이가 UAL1과
     달라도 맞는 이유·이번에 고친 리타깃 버그 둘은 `retargetInto()`(위, 476행)의
     주석과 `assets/ASSET_LICENSES.md` 참고. 옷(`male_casualsuit01`/
     `female_casualsuit01`)이 걷는 동안 손·발에서 떨어지던 버그(MPFB가 옷에 뼈
     가중치를 아예 안 만들어 둔 것 — Blender `parent_set(ARMATURE_AUTO)`로 고침)도
     이 파일들부터는 잡혀 있다 */
  var PEOPLE_MPFB = PEOPLE + 'mpfb_real/';
  /* PLAN §10-Q1(2026-09-17 확정) — 이 사진측량 실사 인체는 §6.0-1 툰 저폴리와
     섞인다. `realistic: true` 로 표시해 두면 기본 인물 뽑기(`heroPool`)에서
     빠지고, `world3d.realisticPeople` 손잡이를 켠 사람만 다시 만난다 */
  HERO_RECIPES = HERO_RECIPES.concat([
    { key: 'mpfb_male', body: PEOPLE_MPFB + 'male.glb', realistic: true },
    { key: 'mpfb_female', body: PEOPLE_MPFB + 'female.glb', realistic: true }
  ]);

  /* 2026-09-05(이어서) — "마을 사람 다양성 늘리기"로 위 남/여 두 벌에 셋을
     더 얹는다. MPFB 옷 라이브러리엔 판타지 갑옷·로브가 없어(현대 정장류뿐)
     QRPG 직업 교체용은 아니다 — 그냥 실사 인물 표본을 넓히는 것. 같은
     파이프라인(피부→눈·눈썹·속눈썹·이·혀→머리(Head 뼈에 강체 고정, 열 확산이
     이 머리 에셋에서 늘 실패해서)→옷(Automatic Weights)→game_engine 리그→
     알파클립 노드)으로 뽑았다.

     **원래 넷을 뽑았는데 하나는 뺐다** — `young_caucasian_female`·
     `young_caucasian_female2`·`old_asian_male` 피부 셋 다(넷 중 셋) 눈가가
     빨갛게 깨지는 새 버그가 나왔다(얼굴이 아니라 안구 소켓 알파 자리 —
     기존 `young_asian_*`·`middleage_african_male` 피부에선 안 나던 문제,
     원인 미확인 — 아마 그 피부들의 눈 소켓 알파맵이 이번 알파클립 문턱
     0.5와 안 맞물리는 것으로 추정). **`old_african_male`·`young_african_female`
     피부는 멀쩡했다** — 이미 검증된 `young_asian_*`(male.glb·female.glb)
     까지 합쳐 **아시아·아프리카 피부 계열만 안전이 확인됐다**. 캐릭시안·
     `old_asian` 계열은 이 버그를 고치기 전엔 더 안 뽑는다. 자세한 내용은
     `assets/ASSET_LICENSES.md` 참고 */
  HERO_RECIPES = HERO_RECIPES.concat([
    { key: 'mpfb_v3', body: PEOPLE_MPFB + 'v3.glb', realistic: true },   // middleage_african_male + afro01 + male_worksuit01
    { key: 'mpfb_v7', body: PEOPLE_MPFB + 'v7.glb', realistic: true },   // young_african_female + braid01 + female_casualsuit02
    { key: 'mpfb_v8', body: PEOPLE_MPFB + 'v8.glb', realistic: true }    // old_african_male + short03 + male_casualsuit04
  ]);

  /* 2026-09-05(더 이어서) — 위에서 뺐던 캐릭시안·노년 아시아 스킨 셋을 마저 뽑는다.
     "눈가 빨갛게" 원인이 HANDOFF.md에서 확정됐다(코드 버그 아님 — MakeHuman
     스킨 사진 자체에 눈이 이미 그려져 있어 3D 눈알과 겹쳐 보이는 것) — 그
     스킨들의 diffuse 텍스처에서 눈 UV 영역만(눈썹 라인은 남기고) 주변 피부색으로
     페더링해 지우고 다시 export했다. 나머지 파이프라인(옷 Automatic Weights,
     머리·눈·이 Head 강체 고정, 알파클립 노드)은 위와 완전히 동일 — 원래
     처음 넷을 뽑을 때 정했던 조합 그대로다 */
  HERO_RECIPES = HERO_RECIPES.concat([
    { key: 'mpfb_v9', body: PEOPLE_MPFB + 'v9.glb', realistic: true },    // young_caucasian_female + ponytail01 + female_elegantsuit01
    { key: 'mpfb_v10', body: PEOPLE_MPFB + 'v10.glb', realistic: true },  // old_asian_male + short02 + male_casualsuit03
    { key: 'mpfb_v11', body: PEOPLE_MPFB + 'v11.glb', realistic: true }   // young_caucasian_female2 + bob01 + female_sportsuit01
  ]);

  /* 2026-09-05(또 이어서) — 눈 마스킹이 검증됐으니("이 현상은 사실 모든 스킨에
     다 있다") 남은 MPFB 스킨 열두 종을 마저 뽑는다. 이번엔 빨간기가 실제로
     보이든 안 보이든 열두 개 전부에 같은 마스킹(좌표 (1690,970)·(1690,1132),
     2048 기준)을 선적용했다 — 크롭으로 셋을 대표 확인해 UV 레이아웃이 스킨마다
     완전히 같다는 걸 재확인했다. `toon01`·`_special_suit` 두 벌은 뺐다
     (비실사·의상 특화라 다양성 목적에 안 맞음). 자세한 내용은
     `assets/ASSET_LICENSES.md` 참고 */
  /* 2026-09-06 — Mesh2Motion(mesh2motion.org, MIT+CC0) 으로 직접 리깅한 사진측량
     실사 인체(Vitruvian Project, CC0) 첫 벌을 넣는다. QRPG 와 같은 결(뼈대·클립이
     제 파일 안에 다 있다)이라 `anim` 을 `body` 와 같은 파일로 준다 — 클립 이름
     (Fighting_Idle·Walk·Run_Female·Sword_Attack·Hit_Chest·Death_A)이 `mapClips()`
     의 키워드(idle·walk·run·attack·hit·death)에 그대로 걸려 리타깃이 필요 없다.
     다리 피부(`Vitruvian_Legs_BaseColor_Utility`)가 얼굴·몸통·팔의 African 피부보다
     밝은 범용 텍스처였던 것은 2026-09-06에 텍스처 자체를 색 전이(평균 RGB를
     Torso·Arms에 맞춤)로 고쳤다 — 자세한 내용은 `assets/ASSET_LICENSES.md`.
     이 도구로 인물을 더 뽑으려면 관절
     맞추기(어깨·팔꿈치·손·엉덩이·무릎·발)를 매번 손으로 해야 한다 — 대량 생산용은
     아니다. 자세한 내용은 `assets/ASSET_LICENSES.md` 참고 */
  HERO_RECIPES = HERO_RECIPES.concat([
    { key: 'vitruvian_v1', body: PEOPLE + 'vitruvian/vitruvian_v1.glb', anim: PEOPLE + 'vitruvian/vitruvian_v1.glb', realistic: true }
  ]);

  HERO_RECIPES = HERO_RECIPES.concat([
    { key: 'mpfb_v12', body: PEOPLE_MPFB + 'v12.glb', realistic: true },  // middleage_african_female + bob02 + female_casualsuit01
    { key: 'mpfb_v13', body: PEOPLE_MPFB + 'v13.glb', realistic: true },  // middleage_asian_female + short04 + female_casualsuit02
    { key: 'mpfb_v14', body: PEOPLE_MPFB + 'v14.glb', realistic: true },  // middleage_asian_male + short01 + male_casualsuit02
    { key: 'mpfb_v15', body: PEOPLE_MPFB + 'v15.glb', realistic: true },  // middleage_caucasian_female + long01 + female_elegantsuit01
    { key: 'mpfb_v16', body: PEOPLE_MPFB + 'v16.glb', realistic: true },  // middleage_caucasian_male + short02 + male_casualsuit05
    { key: 'mpfb_v17', body: PEOPLE_MPFB + 'v17.glb', realistic: true },  // old_african_female + braid01 + female_sportsuit01
    { key: 'mpfb_v18', body: PEOPLE_MPFB + 'v18.glb', realistic: true },  // old_asian_female + bob01 + female_casualsuit01
    { key: 'mpfb_v19', body: PEOPLE_MPFB + 'v19.glb', realistic: true },  // old_caucasian_female + ponytail01 + female_casualsuit02
    { key: 'mpfb_v20', body: PEOPLE_MPFB + 'v20.glb', realistic: true },  // old_caucasian_male + short03 + male_casualsuit06
    { key: 'mpfb_v21', body: PEOPLE_MPFB + 'v21.glb', realistic: true },  // young_african_male + afro01 + male_worksuit01
    { key: 'mpfb_v22', body: PEOPLE_MPFB + 'v22.glb', realistic: true },  // young_caucasian_male + short04 + male_elegantsuit01
    { key: 'mpfb_v23', body: PEOPLE_MPFB + 'v23.glb', realistic: true }   // young_caucasian_male2 + long01 + male_casualsuit01
  ]);

  /* 2026-09-20 — "고품질 셀 셰이딩급" VRM 애니메 아바타(사가마을 asset3d.js에서 먼저 만든 것,
     경위는 saga-forest HANDOFF.md 2026-09-19 절)를 이 판에도 옮긴다. VRoid Studio
     공식 CC0 샘플 AvatarSample_A/B/C(github.com/madjin/vrm-samples) + 이 저장소가
     GUI 자동화로 새로 빚은 avatar_custom_01 — 넷 다 사가마을과 같은 파일(md5 동일,
     assets/ASSET_LICENSES.md 참고). VRM 뼈 이름(`J_Bip_*`)은 이 판의 QRPG/MPFB
     뼈와 안 맞아 아래 `boneNameMap()`에 VRM_TO_UAL1_BONES 보충표를 얹는다.
     **기본은 꺼짐**(0, 위 `realistic` 계열과 같은 결) — 손잡이를 켜기 전엔
     기존 QRPG 배정에 전혀 안 끼어든다. */
  var PEOPLE_ANIME = PEOPLE + 'anime/';
  var HERO_RECIPES_ANIME = ['a', 'b', 'c'].map(function (n) {
    return { key: 'anime_avatar_' + n, body: PEOPLE_ANIME + 'avatar_sample_' + n + '.glb' };
  }).concat([
    { key: 'anime_avatar_custom01', body: PEOPLE_ANIME + 'avatar_custom_01.glb' }
  ]);
  /** 2026-09-20 — VRoid 몸이면 인물 id 로 머리·옷·눈 색을 바꾼다(vroid-variant.js, 다섯 판 공용). 다른 몸엔 안 건다 */
  function applyVroid(model, rec, id) {
    var V = global.DG && global.DG.vroidVariant;
    if (V && rec && V.isVroid(rec.body)) { V.faceFront(model, rec.body); V.apply(model, id); }   // 정면 -Z → +Z 로 돌려 세운 뒤 색 변형
  }
  function wantsAnimeAvatar() { return core().tuned('world3d.animeAvatar', 1) ? true : false; }

  /**
   * 옛 인물 조합 — **몸 하나 + 옷 하나 + 머리 하나**가 한 벌이다. 셋 다 뼈 개수(65)와
   * 이름·순서가 파일 열둘(몸 둘·옷 넷·머리 여섯) 전부 한 글자도 안 다르다(직접
   * 대조했다) — 그래서 옷·머리를 몸의 뼈대에 그대로 `bind()` 해 얹으면 되고,
   * `Knight.glb` 를 빌려 옮겨 입히던 옛 리타기팅이 통째로 필요 없다.
   *
   * 지금은 표(`DEFAULTS.hero`)에서는 빠졌다 — 위 QRPG로 교체됐다. 지우지 않고
   * 남겨 둔다(되돌림 자리); `register('hero', HERO_RECIPES_FALLBACK)` 로 되돌릴 수 있다.
   */
  var HERO_RECIPES_FALLBACK = [
    { key: 'male_peasant_buzzed', body: REGULAR + 'Superhero_Male_FullBody.gltf',
      outfit: REGULAR + 'Male_Peasant.gltf', hair: REGULAR + 'Hair_Buzzed.gltf' },
    { key: 'male_ranger_long', body: REGULAR + 'Superhero_Male_FullBody.gltf',
      outfit: REGULAR + 'Male_Ranger.gltf', hair: REGULAR + 'Hair_Long.gltf' },
    { key: 'male_peasant_beard', body: REGULAR + 'Superhero_Male_FullBody.gltf',
      outfit: REGULAR + 'Male_Peasant.gltf', hair: REGULAR + 'Hair_Beard.gltf' },
    { key: 'female_peasant_buns', body: REGULAR + 'Superhero_Female_FullBody.gltf',
      outfit: REGULAR + 'Female_Peasant.gltf', hair: REGULAR + 'Hair_Buns.gltf' },
    { key: 'female_ranger_simple', body: REGULAR + 'Superhero_Female_FullBody.gltf',
      outfit: REGULAR + 'Female_Ranger.gltf', hair: REGULAR + 'Hair_SimpleParted.gltf' },
    { key: 'female_peasant_buzzed', body: REGULAR + 'Superhero_Female_FullBody.gltf',
      outfit: REGULAR + 'Female_Peasant.gltf', hair: REGULAR + 'Hair_BuzzedFemale.gltf' }
  ];

  /* 위 열둘(몸·옷·머리)은 이미 한 뼈대라 `dressUp`(Knight 몸짓 옮겨 입히기)을
     탈 필요가 없다 — 타면 파일마다 몸짓 마흔한 개를 헛되이 다시 굽는다. `acquire()`
     가 이 표에 있는 url 이면 자동 리타기팅을 건너뛴다. QRPG는 제 클립이 있어
     `needsRetarget()` 이 애초에 false 지만, 표에 같이 올려 뜻을 분명히 해 둔다 */
  /* 땅 사람 옷차림(§5 ⑱) — 제 클립이 든 파일이라 QRPG 처럼 body 와 anim 을 같은 파일로 준다 */
  var FOLK_DIR = PEOPLE + 'folk/', FOE_DIR = 'assets/models/foes/';
  function folkRecipe(n) { var f = FOLK_DIR + n + '.glb'; return { key: 'folk_' + n.toLowerCase(), body: f, anim: f }; }

  var SKIP_AUTORETARGET = {};
  HERO_RECIPES.concat(HERO_RECIPES_FALLBACK).forEach(function (r) {
    SKIP_AUTORETARGET[r.body] = true;
    if (r.outfit) { SKIP_AUTORETARGET[r.outfit] = true; }
    if (r.hair) { SKIP_AUTORETARGET[r.hair] = true; }
  });

  var DEFAULTS = {
    'hero': HERO_RECIPES,
    'pet:an_deer': 'assets/models/animals/Deer.glb',
    'pet:an_wolf': 'assets/models/animals/Wolf.glb',
    'pet:an_ox':   'assets/models/animals/Cow.glb',
    'pet:an_carp': 'assets/models/animals/Koi.glb',
    /* 까치 — 2026-09-07 까지는 Poly by Google `Crow`(CC-BY, 정지 모델)를 썼다.
       사용자가 "움직이는 걸로, 꼭 까치 모양일 필요 없다"고 정해 Quaternius
       `Pigeon`·`Birb`(CC0, poly.pizza)로 바꿨다 — 다른 배경 짐승(사슴·늑대·
       소·잉어)이 전부 애니메이션 있는데 까치만 정지였던 것도 이걸로 맞춰졌다 */
    'pet:an_magpie': ['assets/models/animals/Pigeon.glb', 'assets/models/animals/Birb.glb'],

    /* 2026-09-05 — 도감(잡는) 펫은 여태 위 다섯 줄(들짐승 `an_*`, `animal.js`의
       배경 생물 전용)에 하나도 안 걸렸다 — `pet:pt_*`도 `pet:form:*`도 표에
       없어 도감 초상은 계속 캔버스로 남아 있었다(portrait3d.js 는 이제 pet도
       굽지만, 구울 진짜 모델이 없으면 그대로 포기하고 캔버스로 되돌아간다).
       사용자 지시 — "초상화를 더 가져올 수 있나, 맞출 필요 없이 있으면
       교체" — 새로 받지 않고 **이미 있는 다섯 종을 형태(form)별로 돌려 쓴다**.
       한 마리가 다른 종 모델을 입어도(해태가 사슴 모습 등) 그림이 사람 손이
       아니라 실제 모델이라는 점이 우선이다(대장간=집 모델과 같은 판단).
       `quad`(네 발) 형태가 가장 많아 셋을 섞어 조금이라도 갈린다(같은 인물은
       `oneOf()`가 id 해시로 늘 같은 것을 고른다). `turtle`·`dragon`·`horse`·
       `toad`·`ogre` 형태는 대응 CC0 가 없어 마지막 `pet` 한 줄(같은 셋)로
       떨어진다 — 거북·용이 사슴 모습이어도 도형보다는 낫다는 판단.

       2026-09-07 — `github.com/trebeljahr/quaternius-showcase`(CC0, 위와 같은
       미러)에서 열여섯 종을 더 받아 `quad`·`horse`·`toad`·`dragon`·`fish` 다섯
       형태에 채웠다. 같은 날 조금 뒤 `ogre`(아래 표) · `turtle`(뱀으로 대신 —
       움직이는 CC0 거북을 못 찾았다) 까지 채워 **일곱 형태 전부** 실제
       모델이 서고, 정지 모델이던 까치(`pet:an_magpie`)도 움직이는 것으로
       바꿔 이 파일에 정지 모델이 하나도 안 남았다. */
    /* 2026-09-23 — **종마다 제 모델.** 여태 도감 펫 105종 중 64종이 형태 표(`sprite.js` BEAST_FORM)에 없어
       `quad` 로 떨어져 네발 열 벌 중 id 해시로 하나를 입었다(고래가 사슴·흰동가리가 소·호랑이가 사슴 — 펫 초상
       다시 굽다 발견). 사가나락가 2026-09-07 "펫 100개" 로 받아 둔 Quaternius CC0 모델(범·곰·판다 등 8 +
       `animals_extra/` 11 + `animals_extra2/` 38, 출처 `assets/ASSET_LICENSES.md`)을 옮겨 오고, 이미 있던 모델은
       그대로 이어 붙였다. 신수·창작 짐승(옛 오마주)·까치(사용자가 정한 비둘기)는 여전히 아래 형태 표로 간다 */
    'pet:pt_fox': 'assets/models/animals/Fox.glb',
    'pet:pt_bull': 'assets/models/animals/Bull.glb',
    'pet:pt_cow': 'assets/models/animals/Cow.glb',
    'pet:pt_stag': 'assets/models/animals/Stag.glb',
    'pet:pt_donkey': 'assets/models/animals/Donkey.glb',
    'pet:pt_alpaca': 'assets/models/animals/Alpaca.glb',
    'pet:pt_horse': 'assets/models/animals/Horse.glb',
    'pet:pt_white_horse': 'assets/models/animals/Horse_White.glb',
    'pet:pt_dolphin': 'assets/models/animals/Dolphin.glb',
    'pet:pt_shark': 'assets/models/animals/Shark.glb',
    'pet:pt_manta_ray': 'assets/models/animals/Manta_ray.glb',
    'pet:pt_t_rex': 'assets/models/animals/Trex.glb',
    'pet:pt_triceratops': 'assets/models/animals/Triceratops.glb',
    'pet:pt_stegosaurus': 'assets/models/animals/Stegosaurus.glb',
    'pet:pt_velociraptor': 'assets/models/animals/Velociraptor.glb',
    'pet:pt_carp': 'assets/models/animals/Koi.glb',
    'pet:pt_deer': 'assets/models/animals/Deer.glb',
    'pet:pt_jindo': 'assets/models/animals/ShibaInu.glb',
    'pet:pt_sapsal': 'assets/models/animals/Husky.glb',
    'pet:pt_toad': 'assets/models/animals/Frog.glb',
    'pet:pt_tiger': 'assets/models/animals/Tiger.glb',
    'pet:pt_bear': 'assets/models/animals/Bear.glb',
    'pet:pt_panda': 'assets/models/animals/Panda.glb',
    'pet:pt_monkey': 'assets/models/animals/Monkey.glb',
    'pet:pt_boar': 'assets/models/animals/Boar.glb',
    'pet:pt_owl': 'assets/models/animals/Owl.glb',
    'pet:pt_cat': 'assets/models/animals/Cat.glb',
    'pet:pt_crane': 'assets/models/animals/Crane.glb',
    'pet:pt_llama': 'assets/models/animals_extra/Llama.glb',
    'pet:pt_pig': 'assets/models/animals_extra/Pig.glb',
    'pet:pt_pug': 'assets/models/animals_extra/Pug.glb',
    'pet:pt_sheep': 'assets/models/animals_extra/Sheep.glb',
    'pet:pt_horse_farm': 'assets/models/animals_extra/Horse_Farm.glb',
    'pet:pt_cow_farm': 'assets/models/animals_extra/Cow_Farm.glb',
    'pet:pt_zebra': 'assets/models/animals_extra/Zebra.glb',
    'pet:pt_fish_1': 'assets/models/animals_extra/Fish1.glb',
    'pet:pt_fish_2': 'assets/models/animals_extra/Fish2.glb',
    'pet:pt_fish_3': 'assets/models/animals_extra/Fish3.glb',
    'pet:pt_whale': 'assets/models/animals_extra/Whale.glb',
    'pet:pt_anglerfish': 'assets/models/animals_extra2/Anglerfish.glb',
    'pet:pt_apatosaurus': 'assets/models/animals_extra2/Apatosaurus.glb',
    'pet:pt_armored_catfish': 'assets/models/animals_extra2/Armored_Catfish.glb',
    'pet:pt_betta': 'assets/models/animals_extra2/Betta.glb',
    'pet:pt_black_lion_fish': 'assets/models/animals_extra2/Black_Lion_Fish.glb',
    'pet:pt_blobfish': 'assets/models/animals_extra2/Blobfish.glb',
    'pet:pt_blue_goldfish': 'assets/models/animals_extra2/Blue_Goldfish.glb',
    'pet:pt_blue_tang': 'assets/models/animals_extra2/Blue_Tang.glb',
    'pet:pt_butterfly_fish': 'assets/models/animals_extra2/Butterfly_Fish.glb',
    'pet:pt_cardinal_fish': 'assets/models/animals_extra2/Cardinal_Fish.glb',
    'pet:pt_clownfish': 'assets/models/animals_extra2/Clownfish.glb',
    'pet:pt_coral_grouper': 'assets/models/animals_extra2/Coral_Grouper.glb',
    'pet:pt_cowfish': 'assets/models/animals_extra2/Cowfish.glb',
    'pet:pt_flatfish': 'assets/models/animals_extra2/Flatfish.glb',
    'pet:pt_flower_horn': 'assets/models/animals_extra2/Flower_Horn.glb',
    'pet:pt_goblin_shark': 'assets/models/animals_extra2/Goblin_Shark.glb',
    'pet:pt_goldfish': 'assets/models/animals_extra2/Goldfish.glb',
    'pet:pt_humphead': 'assets/models/animals_extra2/Humphead.glb',
    'pet:pt_koi_2': 'assets/models/animals_extra2/Koi.glb',
    'pet:pt_lionfish': 'assets/models/animals_extra2/Lionfish.glb',
    'pet:pt_mandarin_fish': 'assets/models/animals_extra2/Mandarin_Fish.glb',
    'pet:pt_moorish_idol': 'assets/models/animals_extra2/Moorish_Idol.glb',
    'pet:pt_parasaurolophus': 'assets/models/animals_extra2/Parasaurolophus.glb',
    'pet:pt_parrot_fish': 'assets/models/animals_extra2/Parrot_Fish.glb',
    'pet:pt_piranha': 'assets/models/animals_extra2/Piranha.glb',
    'pet:pt_puffer': 'assets/models/animals_extra2/Puffer.glb',
    'pet:pt_red_snapper': 'assets/models/animals_extra2/Red_Snapper.glb',
    'pet:pt_royal_gramma': 'assets/models/animals_extra2/Royal_Gramma.glb',
    'pet:pt_shark_2': 'assets/models/animals_extra2/Shark.glb',
    'pet:pt_sunfish': 'assets/models/animals_extra2/Sunfish.glb',
    'pet:pt_swordfish': 'assets/models/animals_extra2/Swordfish.glb',
    'pet:pt_tang': 'assets/models/animals_extra2/Tang.glb',
    'pet:pt_tetra': 'assets/models/animals_extra2/Tetra.glb',
    'pet:pt_tuna': 'assets/models/animals_extra2/Tuna.glb',
    'pet:pt_turbot': 'assets/models/animals_extra2/Turbot.glb',
    'pet:pt_worm': 'assets/models/animals_extra2/Worm.glb',
    'pet:pt_yellow_tang': 'assets/models/animals_extra2/Yellow_Tang.glb',
    'pet:pt_zebra_clown_fish': 'assets/models/animals_extra2/Zebra_Clown_Fish.glb',
    /* 2026-09-25 — **신수·오마주·까치도 종마다 제 모델**(tools/asset-audit/CHARACTER_UNIQUENESS.md ④). 여태 아래 형태 표로
       떨어져 id 해시로 공룡·뱀·오크를 나눠 입었다. 사가나락가 받아 둔 Quaternius "Ultimate Monsters"(CC0) 열여덟 벌 +
       코끼리(Poly by Google, CC-BY 3.0)를 `standin/` 으로 복사해 28종이 서로 안 겹친다. 범·여우·말·흰말은 같은 종이라
       그 모델(백호·구미호·홍염마·섬영마). 까치는 사용자가 정한 비둘기. 사가나락·사가마을·사가종횡와 같은 배정 */
    'pet:pt_samjogo': 'assets/models/animals/Birb.glb',
    'pet:pt_haetae': 'assets/models/standin/Goleling.glb',
    'pet:pt_cheongryong': 'assets/models/standin/Dragon_Evolved.glb',
    'pet:pt_baekho': 'assets/models/animals/Tiger.glb',
    'pet:pt_jujak': 'assets/models/standin/Hywirl.glb',
    'pet:pt_hyeonmu': 'assets/models/animals/Snake.glb',
    'pet:pt_gumiho': 'assets/models/animals/Fox.glb',
    'pet:pt_dokkaebi': 'assets/models/animals/Orc.gltf',
    'pet:pt_bulgasari': 'assets/models/standin/Elephant.glb',
    'pet:pt_jeoktoma': 'assets/models/animals/Horse.glb',
    'pet:pt_jeolyeong': 'assets/models/animals/Horse_White.glb',
    'pet:pt_magpie': 'assets/models/animals/Pigeon.glb',
    'pet:pk_bulbasaur': 'assets/models/standin/Mushnub.glb',
    'pet:pk_charmander': 'assets/models/standin/Dino.glb',
    'pet:pk_squirtle': 'assets/models/standin/Squidle.glb',
    'pet:pk_magikarp': 'assets/models/standin/Glub.glb',
    'pet:pk_pikachu': 'assets/models/standin/Bunny.glb',
    'pet:pk_eevee': 'assets/models/standin/Monkroose.glb',
    'pet:pk_slowbro': 'assets/models/standin/Pink_Slime.glb',
    'pet:pk_gengar': 'assets/models/standin/Ghost.glb',
    'pet:pk_snorlax': 'assets/models/standin/Yeti.glb',
    'pet:pk_lapras': 'assets/models/standin/Glub_Evolved.glb',
    'pet:pk_alakazam': 'assets/models/standin/Wizard.glb',
    'pet:pk_dragonite': 'assets/models/standin/Alpaking.glb',
    'pet:pk_charizard': 'assets/models/standin/Dragon.glb',
    'pet:pk_gyarados': 'assets/models/animals/Snake_angry.glb',
    'pet:pk_mewtwo': 'assets/models/standin/Alien_2.glb',
    'pet:pk_mew': 'assets/models/standin/Cat_Monster.glb',
    'pet:form:quad': ['assets/models/animals/Deer.glb', 'assets/models/animals/Wolf.glb',
      'assets/models/animals/Cow.glb', 'assets/models/animals/Alpaca.glb',
      'assets/models/animals/Bull.glb', 'assets/models/animals/Donkey.glb',
      'assets/models/animals/Fox.glb', 'assets/models/animals/Husky.glb',
      'assets/models/animals/ShibaInu.glb', 'assets/models/animals/Stag.glb'],
    'pet:form:bird': ['assets/models/animals/Pigeon.glb', 'assets/models/animals/Birb.glb'],
    'pet:form:fish': ['assets/models/animals/Koi.glb', 'assets/models/animals/Shark.glb',
      'assets/models/animals/Dolphin.glb', 'assets/models/animals/Manta_ray.glb'],
    /* 말 형태(적토마·절영) — animals_pack 의 백마 한 종을 더해 둘이 갈린다 */
    'pet:form:horse': ['assets/models/animals/Horse.glb', 'assets/models/animals/Horse_White.glb'],
    /* 두꺼비 — easy_enemies_pack 의 Frog */
    'pet:form:toad': 'assets/models/animals/Frog.glb',
    /* 용 형태(청룡·누렁날개·노을용·물이무기) — CC0 용 모델이 없어 파충류로 가장 가까운
       공룡 넷으로 돌려 쓴다(사슴보다 훨씬 낫다는 판단) */
    'pet:form:dragon': ['assets/models/animals/Trex.glb', 'assets/models/animals/Triceratops.glb',
      'assets/models/animals/Stegosaurus.glb', 'assets/models/animals/Velociraptor.glb'],
    /* 오우거 형태(도깨비·어둑귀·고깔도사·별손님) — Quaternius `Ultimate Monsters`
       팩(CC0, `github.com/511action/descent-3d-assets` 미러). 사람 모양
       악마·오크라 오우거·도깨비의 결에 사슴보다 훨씬 가깝다 */
    'pet:form:ogre': ['assets/models/animals/Orc.gltf', 'assets/models/animals/Demon.gltf',
      'assets/models/animals/BlueDemon.gltf'],
    /* 거북 형태(현무·뿔낙지·겹날주머니) — 2026-09-07, 리깅된 CC0 거북을 못 찾아
       한동안 정지 모델(Poly by Google → Polygonal Mind)을 거쳐 왔다. 사용자가
       "꼭 거북 모양일 필요 없다, 움직이는 걸로"로 정해 뱀(easy_enemies_pack,
       CC0)으로 바꿨다 — 현무가 애초에 "거북과 뱀"을 합친 신수(PLAN 원문)라
       뱀도 결이 안 어긋난다 */
    'pet:form:turtle': ['assets/models/animals/Snake.glb', 'assets/models/animals/Snake_angry.glb'],
    /* 2026-09-25 — 절차 펫(`ptgen*_`) 전용 풀: 땅짐승 스물셋(sprite.js BEAST_FORM_FILES.gen 과 같은 순서 — 지도 그림도 같은 동물) */
    'pet:form:gen': [
      'assets/models/animals/Deer.glb',
      'assets/models/animals/Wolf.glb',
      'assets/models/animals/Cow.glb',
      'assets/models/animals/Alpaca.glb',
      'assets/models/animals/Bull.glb',
      'assets/models/animals/Donkey.glb',
      'assets/models/animals/Fox.glb',
      'assets/models/animals/Husky.glb',
      'assets/models/animals/ShibaInu.glb',
      'assets/models/animals/Stag.glb',
      'assets/models/animals/Tiger.glb',
      'assets/models/animals/Bear.glb',
      'assets/models/animals/Boar.glb',
      'assets/models/animals/Panda.glb',
      'assets/models/animals/Monkey.glb',
      'assets/models/animals/Cat.glb',
      'assets/models/animals_extra/Llama.glb',
      'assets/models/animals_extra/Pig.glb',
      'assets/models/animals_extra/Pug.glb',
      'assets/models/animals_extra/Sheep.glb',
      'assets/models/animals_extra/Zebra.glb',
      'assets/models/animals_extra/Horse_Farm.glb',
      'assets/models/animals_extra/Cow_Farm.glb'],
    'pet': ['assets/models/animals/Deer.glb', 'assets/models/animals/Wolf.glb',
      'assets/models/animals/Cow.glb'],

    /* 역참 — **여관 한 벌**이다. 역참은 들러서 쉬고 보급받는 자리이니
       여관이 그 자체다. 여러 벌로 섞고 싶었지만 `Well`(우물 1.25m)·
       `MarketStand`(좌판 1.05m)는 **원본 키가 절반도 안 된다** — 이 창고는
       무엇이든 키 1 로 눕히므로(`normalize`) 섞으면 우물이 여관만 해진다.
       키가 비슷한 것끼리만 한 줄에 묶는다.
       2026-09-04 — 옛 Inn.glb(저다각형)를 실사 사진측량 스캔으로 갈아 끼웠다.
       사용자가 "여관처럼 안 생겨도 됨"으로 확정 — Sketchfab CC0 아일랜드 문화유산
       스캔(`Renvylle Castle`, 13~14세기 탑성 폐허)을 gltf-transform으로 다듬어
       옮겼다(1.68M버텍스→가벼운 한 덩이, 자세한 내용은 ASSET_LICENSES.md).
       옛 파일은 지우지 않았다 — `STATION_STYLIZED` 가 되돌림 자리로 들고 있다 */
    'station': BLD_REAL + 'tower_ruin.glb',

    /* 성채 — **등급마다 다른 탑이 선다.** `fort.js` 의 세 등급(보·진·웅진)은
       수비대의 세기가 다른데 여태 화면에서는 다 같은 성채였다. 멀리서 보고
       "저건 웅진이다" 를 알면 걸어갈지 말지가 눈으로 정해진다.
       좁은 키(`fort:t3`)부터 찾으므로 등급이 안 실려 와도 `fort` 로 떨어진다.
       2026-09-04 — 최고 등급(웅진)만 실사로. `tower_round.glb`(Poly Haven CC0
       성채 모듈, `prop3d.js`의 들판 장식 탑과 같은 파일)를 그대로 재사용한다 —
       진짜 실사 CC0 성곽 탑이 이거 하나뿐이라 세 등급을 다 못 채운다. 보·진은
       옛 저다각형 그대로 둔다(등급 간 크기 차이가 여전히 눈에 보이면 충분하다) */
    'fort:t1': BLD + 'Watchtower.glb',
    'fort:t2': [BLD + 'Tower.glb', BLD + 'PointyTower.glb'],
    'fort:t3': BLD_REAL + 'tower_round.glb',
    'fort': BLD + 'Tower.glb',

    /* 지역 랜드마크(biome.js, PLAN §5 ⑩) — 바이옴마다 다른 탑. 멀리서 "저기가
       어느 땅이다"를 알아보게 성채보다 두 배쯤 크게 세운다(heightMul) */
    'landmark:plain': BLD + 'Watchtower.glb',
    'landmark:bamboo': BLD + 'PointyTower.glb',
    'landmark:canyon': BLD + 'LargeTower.glb',
    'landmark:marsh': BLD + 'Tower.glb',
    'landmark:ruins': BLD + 'LargeSquareTowerBricks.glb',
    /* §5 ⑲-3 보물 상자(KayKit Dungeon Remastered CC0, 사가종횡와 같은 파일)·석등(Poly Haven 등롱 CC0, prop3d `lamp` 와 같은 파일) */
    'chest': 'assets/models/props/Chest.glb',
    'lantern': 'assets/models/props/realistic/wooden_lantern.glb',
    /* §5 ⑲-6 채집물(Quaternius CC0, 사가마을과 같은 파일)·솥(퓨전 소품 가마솥·모닥불) */
    'gather:mushroom': 'assets/models/nature/Mushroom_1.glb',
    'gather:flower': 'assets/models/nature/Flowers.glb',
    'gather:plant': 'assets/models/nature/Plant_1.glb',
    'gather:berry': 'assets/models/nature/BushBerries_1.glb',
    'gather:rock': 'assets/models/nature/Rock_1.glb',
    'cook:pot': 'assets/models/fusion/Cauldron.glb',
    'cook:fire': 'assets/models/fusion/Bonfire_Lit.glb',
    /* §5 ⑲-9 숨은 터 입구(아치)·주간 보스 제단(사당)·보상 나무(빛나무) — 이미 받아 둔 CC0 파일 */
    'domain:gate': 'assets/models/props/Arch.glb',
    'domain:altar': 'assets/models/props/Temple.glb',
    'domain:tree': 'assets/models/fusion/Tree_Light_1.glb',
    'landmark': BLD + 'LargeTower.glb',

    /* 세 시대 사람·적(PLAN §5 ⑱ · SAGA-DESIGN §13 전체 퓨전). 전부 Quaternius CC0 — 사가나락가 받아 둔 poly.pizza
       사람·몬스터를 옮겨 오고, 사이버펑크 로봇 셋은 미러에서 받아 Meshopt 로 쌌다(`assets/ASSET_LICENSES.md`).
       땅 사람(`folk.js`)은 ref.era 가 `folk_past`·`folk_modern`·`folk_future` 라 `hero:era:*` 에 걸린다 —
       도감 인물의 era('삼국지' 등)와는 겹치지 않는다. 과거는 이미 받는 인물 여섯 벌에 농부·무녀를 보탠다 */
    'hero:era:folk_past': HERO_RECIPES.concat(['m_Farmer', 'w_Witch'].map(folkRecipe)),
    'hero:era:folk_modern': ['m_BusinessMan', 'm_Worker', 'm_Hoodie', 'm_SWAT', 'w_Suit', 'w_Worker'].map(folkRecipe),
    'hero:era:folk_future': ['w_SciFi', 's_Astronaut1', 's_Astronaut2'].map(folkRecipe),
    /* 들판 적(field-combat.js FOES) — 도감에 없는 종은 ref.id 가 `fc_<종류>` 다 */
    'pet:fc_rat': FOE_DIR + 'Rat.glb',
    'pet:fc_wasp': FOE_DIR + 'Wasp.glb',
    'pet:fc_zombie': FOE_DIR + 'Zombie.glb',
    'pet:fc_drone': FOE_DIR + 'Robot_Drone.glb',
    'pet:fc_horse': 'assets/models/animals/Horse.glb',        // ⑲-36 이야기 인물 놀란 역마(story horse)
    'pet:fc_walker': FOE_DIR + 'Robot_Walker.glb',
    'pet:fc_alien': FOE_DIR + 'Alien.glb',
    'pet:fc_vault_queen': FOE_DIR + 'Robot_Drone.glb',           // ⑲-64 35장 금고 파수 드론 여왕(정찰 드론 몸을 크게)
    'pet:fc_hulk': FOE_DIR + 'Robot_Large.glb'
  };

  /** 되돌림 자리 — 실사로 갈아 끼우기 전 값. `register('station', STATION_STYLIZED)` ·
   *  `register('fort:t3', FORT_T3_STYLIZED)` 로 되돌릴 수 있다 */
  var STATION_STYLIZED = BLD + 'Inn.glb';
  var FORT_T3_STYLIZED = [BLD + 'LargeTower.glb', BLD + 'LargeSquareTowerBricks.glb'];

  var REG = {};
  /** 기본 표를 옮겨 담는다 — `clear()` 로 비운 뒤 되돌릴 때도 이 함수를 쓴다 */
  function restore() {
    var k;
    for (k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) { REG[k] = DEFAULTS[k]; } }
    return REG;
  }
  restore();

  function register(key, url) {
    if (!key) { return REG; }
    if (url) { REG[key] = url; } else { delete REG[key]; }
    return REG;
  }

  /** 이 배우를 어떤 키들로 찾아볼까 — 좁은 것부터 넓은 것 순 */
  function keysFor(kind, ref) {
    var r = ref || {};
    if (kind === 'hero') {
      return ['hero:' + r.id, 'hero:era:' + r.era, 'hero'].filter(Boolean);
    }
    if (kind === 'pet') {
      var form = r.form || (global.DG.sprite && global.DG.sprite.beastFormOf ?
        global.DG.sprite.beastFormOf(r) : null);
      return ['pet:' + r.id, form ? 'pet:form:' + form : null, 'pet'].filter(Boolean);
    }
    /* 성채는 **등급이 먼저다** — `fort:t3` 가 있으면 그것, 없으면 `fort`.
       등급이 안 실려 와도(옛 부름) 넓은 키로 떨어지므로 화면은 안 빈다 */
    if (kind === 'fort') {
      return [r.tier ? 'fort:t' + r.tier : null, 'fort'].filter(Boolean);
    }
    if (kind === 'station') { return [kind]; }
    if (kind === 'landmark') { return [r.biome ? 'landmark:' + r.biome : null, 'landmark'].filter(Boolean); }
    return kind ? [kind] : [];
  }

  /** 표에서 첫 히트 — 없으면 null. 순수 함수다 */
  function lookup(kind, ref) {   // W-0148 — 펫은 통일 world 표의 신수 몸(pet_<id>.glb)이 있으면 그것 먼저, 없으면 옛 표
    var ks = keysFor(kind, ref), i, A3 = global.DG.assets3d, pu = kind === 'pet' && ref && ref.id && A3 && A3.url ? A3.url('world', 'pet_' + ref.id) : null;
    if (pu) { return { key: 'pet:' + ref.id, url: pu }; }
    for (i = 0; i < ks.length; i++) { if (REG[ks[i]]) { return { key: ks[i], url: REG[ks[i]] }; } }
    return null;
  }

  /**
   * 표의 한 줄이 **여럿**이면 그중 하나를 고른다 — `ref.id` 해시로.
   * 같은 사람은 늘 같은 몸을 입는다(자리를 옮겨도, 창을 다시 열어도).
   * 한 줄짜리면 그대로 준다 — 옛 표기와 그대로 맞물린다.
   */
  function oneOf(list, ref) {
    if (!list) { return null; }
    if (typeof list === 'string') { return list; }
    if (!list.length) { return null; }
    var s = String((ref && (ref.id || ref.name)) || ''), i, h = 0;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return list[h % list.length];
  }

  /**
   * 표 한 줄이 URL 문자열이 아니라 **조합 객체**(`{key, body, outfit, hair}`,
   * 인물의 몸·옷·머리 조합)일 수 있다 — 그때는 `key` 만 문자열로 내준다.
   * `chain()`·진단·데모는 이 문자열 하나로 "몇 벌 중 어느 벌인지"만 가르면
   * 되고, 실제로 세울 때는 `heroRecipe()` 가 객체 그대로를 다시 돌려준다.
   */
  function urlOf(kind, ref) {
    var h = lookup(kind, ref);
    if (!h) { return null; }
    var pool = (kind === 'hero') ? heroPool(h.url) : h.url;
    var v = oneOf(pool, ref);
    if (v && typeof v === 'object') { return v.key || null; }
    return v;
  }

  /** 인물의 몸·옷·머리 조합 — 표에 적힌 것이 조합 객체일 때만 준다(테스트가
   *  `register('hero', 'a.glb')` 처럼 문자열 하나로 덮어써도 안 깨지게) */
  /* 2026-09-25 — "캐릭터 모두 다르게" ②: 주민 열(`npc.js`)은 VRoid 네 벌 해시 대신 **사람마다 제 몸** — 역할에 맞게 손으로
     짝지은 서로 다른 한 벌(사가나락 hero_light 창고의 Quaternius·poly.pizza CC0 를 `people/fixed/` 로 복사, 제 클립 내장).
     ⑱ 땅 사람이 쓰는 파일(회사원·농부·후드·특공대·작업복·마녀·우주복)은 피했다. 도감 인물·절차 인물은 VRoid 그대로.
     손잡이 `asset3d.fixedBody`(0 = 옛 해시) */
  var FIXED_HERO = {
    npc_elder: 'oga_ultimate_OldClassy_Male.glb',
    npc_merchant: 'oga_ultimate_Casual2_Male.glb',
    npc_old: 'oga_ultimate_Doctor_Male_Old.glb',
    npc_soldier: 'oga_ultimate_Soldier_Male.glb',
    npc_scholar: 'oga_ultimate_Kimono_Male.glb',
    npc_herb: 'oga_ultimate_Doctor_Female_Young.glb',
    npc_smith: 'oga_ultimate_Casual_Bald.glb',
    npc_ronin: 'oga_ultimate_Ninja_Sand.glb',
    npc_bandit: 'oga_ultimate_Viking_Male.glb',
    npc_stranger: 'polypizza_wide_Wizard.glb',
    /* ⑲-12 이야기 인물 셋(story.js) — QRPG 수도승·궁수·성직자(제 클립 내장). '/' 가 든 값은 people/ 기준 */
    story_elder: 'quaternius_rpg/Monk.glb',
    story_ferryman: 'quaternius_rpg/Ranger.glb',
    story_scholar: 'quaternius_rpg/Cleric.glb',
    story_wanderer: 'quaternius_rpg/Rogue.glb',     // ⑲-13 가면 쓴 나그네(흰 가면은 talkface.mask 가 얹는다)
    story_blackmask: 'quaternius_rpg/Warrior.glb',  // ⑲-14 이야기 보스 검은 가면(들판 적 b_mask 의 body)
    story_haesol: 'quaternius_rpg/Warrior.glb',     // ⑲-19 해솔(검은 가면의 참이름) — 보스와 같은 몸, 가면은 talkface 'crack'
    story_thief: 'oga_ultimate_Ninja_Sand.glb',     // ⑲-19 노 도둑
    /* ⑲-21 세계 임무 인물(worldquest.js) — 과거·현대·미래 옷. 둥실이는 들판 적 드론 몸(pet)이라 여기 없다 */
    wq_postmaster: 'quaternius_rpg/Wizard.glb',      // 역참지기 묵호(과거)
    wq_rider: 'folk/m_Hoodie.glb',                   // 배달꾼 다래(현대)
    wq_researcher: 'folk/w_Worker.glb',              // 바다 연구원 물결(현대)
    wq_hanbit: 'folk/w_SciFi.glb',                   // 등대 지기 한빛(미래 기계)
    wq_byeori: 'folk/s_Astronaut2.glb',              // 시간 탐사대원 별이(미래)
    wq_dolsoe: 'folk/m_Farmer.glb'                   // 옛 석공 돌쇠(과거)
  };
  function fixedRecipe(ref) {
    var id = ref && ref.id;
    if (!id || !Object.prototype.hasOwnProperty.call(FIXED_HERO, id)) { return null; }
    var C = global.DG.core;
    if (C && C.tuned && !C.tuned('asset3d.fixedBody', 1)) { return null; }
    var url = PEOPLE + (FIXED_HERO[id].indexOf('/') >= 0 ? '' : 'fixed/') + FIXED_HERO[id];
    return { key: 'fixed:' + id, body: url, anim: url };
  }

  function heroRecipe(ref) {
    var A3U = global.DG.assets3d, frec = (A3U && (A3U.heroRecipe(ref) || A3U.borrowRecipe(ref))) || fixedRecipe(ref);   // 통일 GLB(W-0021) 먼저, 제 몸 없으면 빌린 몸(W-0074)
    if (frec) { return frec; }
    /* ⑱ 땅 사람(`folk.js`)은 시대 옷이 곧 그 사람이라 애니메 몸으로 바꾸지 않는다 */
    if (wantsAnimeAvatar() && !(ref && /^folk_/.test(String(ref.era || '')))) {
      var arec = oneOf(HERO_RECIPES_ANIME, ref);
      if (arec) { return arec; }
    }
    var h = lookup('hero', ref);
    if (!h) { return null; }
    var v = oneOf(heroPool(h.url), ref);
    return (v && typeof v === 'object' && v.body) ? v : null;
  }
  function wants(kind, ref) { return GLB_ON() && !!urlOf(kind, ref); }

  /** 이 배우는 무엇으로 설까 — 'glb' · 'shape' · 'primitive'. 순수 함수다 */
  function chain(kind, ref) {
    if (wants(kind, ref)) {
      var c = cache[urlOf(kind, ref)];
      if (!c || c.state !== 'fail') { return 'glb'; }
    }
    var A = global.DG.actor3d;
    /* actor3d 가 아는 종류인지 — 도형 계획이 비어 있으면 캡슐로 간다 */
    if (A && A.plan && A.plan(kind, ref).length) { return 'shape'; }
    return 'primitive';
  }

  /* ── 애니메이션 이름 맞추기 (PLAN 8절) ─────────────────
   * 모델마다 클립 이름이 제각각이다. mixamo 는 `Armature|mixamo.com|Layer0`,
   * blender 는 `Walk.001`, 어떤 것은 `Anim_Run_F`. 그래서 이름을 씻어 놓고
   * **점수를 매겨** 가장 잘 맞는 것부터 자리를 채운다 — 한 클립이 두 자리를
   * 차지하지는 않는다.
   *
   * `hit`(맞는다)과 `attack`(친다)이 서로 먹히기 쉬운데, 점수제라 `hit` 라는
   * 클립은 hit 자리에서 정확히 맞아(100점) attack 의 부분일치(40점)를 이긴다.
   */
  var SLOTS = ['idle', 'walk', 'run', 'sprint', 'attack', 'hit', 'dodge', 'death', 'interaction', 'jump', 'land'];

  var WORDS = {
    idle: ['idle', 'stand', 'standing', 'breathe', 'rest', 'wait', 'loop'],
    walk: ['walk', 'walking', 'locomotion', 'move', 'swim', 'flying'],  // 'swim' — 물고기 클립(`Swim`) · 'flying' — 말벌(`Wasp_Flying`, 걷기 클립 없음)
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

  /** 이름을 씻는다 — `Armature|mixamo.com|Walk.001` → `walk` */
  function normName(s) {
    var n = String(s || '');
    if (n.indexOf('|') >= 0) { n = n.split('|').pop(); }   // 마지막 칸이 진짜 이름이다
    n = n.replace(/\.\d+$/, '');                            // blender 의 .001
    return n.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /** 한 자리와 한 이름이 얼마나 맞나 — 0 이면 안 맞는다 */
  function score(slot, name) {
    var ws = WORDS[slot] || [], i, w, best = 0, s;
    for (i = 0; i < ws.length; i++) {
      w = ws[i];
      if (name === w) { s = 100; }
      else if (name.indexOf(w) === 0) { s = 70; }
      else if (name.indexOf(w) >= 0) { s = 40; }
      else { continue; }
      s -= i;                       // 앞에 적은 후보가 조금 더 세다
      if (s > best) { best = s; }
    }
    return best;
  }

  /**
   * 클립 이름들 → 자리표. 순수 함수라 three 없이도 돈다.
   * 못 채운 자리는 대타로 메운다(`FALLBACK`) — 뛰는 그림이 없으면 걷는 그림이라도 쓴다.
   */
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
    /* 점수가 같으면 자리 순서 → 클립 순서. 돌릴 때마다 답이 달라지면 안 된다 */
    pairs.sort(function (a, b) { return (b.s - a.s) || (a.si - b.si) || (a.ci - b.ci); });
    var out = {}, taken = {}, i, p;
    for (i = 0; i < pairs.length; i++) {
      p = pairs[i];
      if (out[p.slot] || taken[p.raw]) { continue; }
      out[p.slot] = p.raw; taken[p.raw] = true;
    }
    /* 대타 — 원본으로 채운 자리와 구별되게 `alias` 에 적어 둔다 */
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

  /* ── 크기 맞추기 ──────────────────────────────────────
   * 이 판의 배우는 전부 **키 1** 로 만들어 두고 세우는 쪽에서 배율을 준다
   * (`actor3d.js` 의 규약). GLB 는 만든 사람마다 단위가 다르니 재서 맞춘다 —
   * 키를 1 로, 발을 y=0 으로.
   */
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

  /**
   * 키 1 위에 **얼마를 더 곱하나** — 순수 함수다.
   *
   * 배우는 전부 키 1 로 눕는데(`fit`), 도형으로 세우던 역참·성채는 그 규약을
   * 안 지키고 제 키로 서 있었다 — 역참 **1.73** · 성채 **2.64**(직접 재 봤다).
   * `world3d` 가 주는 배율은 그 키를 곱할 셈으로 잡힌 값이라, GLB 를 키 1 로
   * 그대로 세우면 **역참이 절반, 성채가 셋에 하나로 쪼그라든다.** 그만큼 보탠다.
   * (`prop3d.houseScale` 이 집에서 같은 함정을 밟고 남긴 자리와 같은 뜻이다)
   *
   * 성채는 여기에 **등급을 한 번 더 태운다.** 보(堡)는 작고 웅진(雄鎭)은 크다 —
   * 걸어가기 전에 멀리서 세기를 가늠하는 것이 이 판의 성채가 하는 일이다.
   */
  function heightMul(kind, ref) {
    var C = core();
    if (kind === 'station') { return C.tuned('asset3d.stationScale', 1.73); }
    if (kind === 'landmark') { return C.tuned('asset3d.landmarkScale', 5); }
    if (kind === 'fort') {
      var base = C.tuned('asset3d.fortScale', 2.64);
      var t = ref && ref.tier;
      return base * (t === 1 ? 0.78 : (t === 3 ? 1.24 : 1));
    }
    return 1;
  }

  /**
   * 이 건물에 **표식 깃발**을 세우나 — 세우면 규격, 아니면 null. 순수 함수다.
   *
   * 왜 필요한가. 도형 역참에는 노란 깃발이, 도형 성채에는 세력 빛깔 배너가
   * 달려 있었고 **그것이 멀리서 알아보는 유일한 표식**이었다. 받아 온 탑과
   * 여관에는 깃발이 없다 — 그대로 갈아 끼우면 성채가 어느 세력인지 화면에서
   * 사라진다. 모양을 얻고 뜻을 잃는 맞바꿈이 되므로, 깃발만 다시 얹는다.
   *
   * 값은 **키 1 기준의 비율**이다(`heightMul` 을 곱한 뒤의 단위계).
   */
  function markOf(kind, ref) {
    if (kind !== 'station' && kind !== 'fort') { return null; }
    if (!core().tuned('asset3d.mark', 1)) { return null; }
    var col = (ref && ref.color) || (kind === 'fort' ? '#8a5cc0' : '#e8c15a');
    /* 성채는 **세로로 긴 배너**, 역참은 **가로로 넓은 작은 깃발** — 도형이 그랬다 */
    if (kind === 'fort') { return { color: col, pole: 1.02, w: 0.22, flag: 0.34 }; }
    return { color: col, pole: 0.95, w: 0.30, flag: 0.18 };
  }

  /* ── 여기서부터 three 가 필요하다 ─────────────────────── */

  var cache = {};        // { url: {state:'load'|'ok'|'fail', gltf, clips, map, waiting:[]} }
  /* 몇 벌을 세웠고 몇 벌이 GLB 로 갈아 끼워졌나 — 진단·데모가 값으로 본다 */
  var built = 0, swapped = 0, broke = '';

  /* 압축(EXT_meshopt_compression) GLB 는 디코더 없이 조용히 실패한다 — 사가마을 asset3d.js 와 같은 요령(2026-09-23 tools/asset-audit 가 찾음) */
  function loader() {
    var t = three();
    if (!t || !t.GLTFLoader) { return null; }
    if (!loader.it) {
      loader.it = new t.GLTFLoader();
      if (t.MeshoptDecoder) { loader.it.setMeshoptDecoder(t.MeshoptDecoder); }
    }
    return loader.it;
  }

  /* ── 몸짓 옮겨 입히기 (retarget) ──────────────────────
   * Quaternius 의 사람 모델 스물한 벌에는 **몸짓이 하나도 없다**(직접 세었다).
   * 그대로 세우면 마을 사람이 T 자로 선다 — 도형만 못하다.
   *
   * 몸짓을 들고 있는 것은 `Knight.glb` 하나뿐이라(열둘), **그것을 옮겨 입힌다.**
   * 뼈 이름은 열여덟이 겹치는데(Hips·Torso·Chest·Neck·Head·팔·다리)
   * **쉬는 자세가 다르다** — 팔·다리가 최대 180° 어긋난다. 그래서 그냥 틀면
   * 사지가 뒤틀린다. 직접 재 보고 알았다.
   *
   * three 의 `SkeletonUtils.retargetClip` 이 그 일을 한다: 원본을 한 프레임씩
   * 굴리며 **뼈의 월드 자세**를 읽어 목표 뼈대에 다시 푼다. 쉬는 자세가 달라도
   * 결과가 맞는 까닭이 이것이다. 겹치지 않는 뼈(손가락·IK)는 그냥 빠진다.
   *
   * 한 몸에 **한 번만** 한다(모델마다 캐시). 배우마다 하면 스물이 설 때마다
   * 열두 클립을 다시 굽는 셈이라 화면이 멎는다.
   */
  /* 예전엔 `Knight.glb`(제 몸짓 열둘) 하나를 빌려 나머지에게 옮겨 입혔다.
     지금은 몸·옷·머리가 다 같은 뼈대를 쓰므로, **뼈대가 다른 옛 물건**
     대신 **이름까지 같은 뼈대의 몸짓 마흔한 벌**(Quaternius
     `Universal Animation Library`)을 원본으로 쓴다 — 옮겨 입힐 필요 없이
     그대로 물린다(아래 `buildHero`). */
  var ANIM_SRC = ANIM_DIR + 'UAL1_Standard.glb';

  /** 뼈대가 몇 벌인가 — 몸통·발·머리·다리가 **저마다 딴 뼈대**를 지고 오는
   *  모델이 있다(Quaternius 의 몇몇 인물 팩이 그렇다: Farmer·Worker·Lady 넷 다
   *  뼈대 넷). 옮겨 입히기는 그중 하나만(`firstSkinned` 가 찾는 것) 골라 돌리므로,
   *  그 하나만 움직이고 나머지 셋은 제자리에 남아 걷는 동안 몸이 갈라진다.
   *  (2026-08-29, 사용자가 실기기로 재확인 — 정지 화면에선 이어 보여도 걷기
   *  시작하면 떨어졌다) */
  function skeletonCount(obj) {
    var set = {};
    obj.traverse(function (o) { if (o.isSkinnedMesh && o.skeleton) { set[o.skeleton.uuid] = 1; } });
    return Object.keys(set).length;
  }

  /** 이 모델은 제 몸짓이 있나 — 없으면 옮겨 입혀야 한다. 뼈대가 하나뿐일 때만
   *  옮겨 입힌다 — 여럿이면 하나만 돌리다 몸이 갈라지느니 **가만히 서는 쪽**을
   *  택한다(움직이는 부서진 몸보다 낫다) */
  function needsRetarget(c) {
    return !!(c && c.gltf && (!c.clips || !c.clips.length) && skeletonCount(c.gltf.scene) === 1);
  }

  function firstSkinned(obj) {
    var found = null;
    obj.traverse(function (o) { if (!found && o.isSkinnedMesh) { found = o; } });
    return found;
  }

  /**
   * 원본의 클립들을 이 몸에 맞게 다시 굽는다. 못 하면 빈 배열 — 그러면
   * 이 몸은 **가만히 선다**(뒤틀리는 것보다는 낫다).
   */
  /** VRM Humanoid(VRoid, `J_Bip_C/L/R_*`) → 이 판 뼈 이름 표(2026-09-20, 사가마을
   *  asset3d.js에서 옮김). 손가락은 뺐다 — 이 판 로코모션 클립이 손가락을 안
   *  건드려 굳이 안 옮겨도 무방하다. 항등 매칭이 하나도 안 걸리는 VRM 몸에만
   *  덧붙는 보충표라, 기존 QRPG·MPFB(이미 이름이 같아 항등만으로 되던 몸)는 이
   *  표를 안 거친다 — 손 안 댐. */
  var VRM_TO_UAL1_BONES = {
    J_Bip_C_Hips: 'pelvis', J_Bip_C_Spine: 'spine_01', J_Bip_C_Chest: 'spine_02',
    J_Bip_C_UpperChest: 'spine_03', J_Bip_C_Neck: 'neck_01', J_Bip_C_Head: 'Head',
    J_Bip_L_Shoulder: 'clavicle_l', J_Bip_L_UpperArm: 'upperarm_l', J_Bip_L_LowerArm: 'lowerarm_l', J_Bip_L_Hand: 'hand_l',
    J_Bip_R_Shoulder: 'clavicle_r', J_Bip_R_UpperArm: 'upperarm_r', J_Bip_R_LowerArm: 'lowerarm_r', J_Bip_R_Hand: 'hand_r',
    J_Bip_L_UpperLeg: 'thigh_l', J_Bip_L_LowerLeg: 'calf_l', J_Bip_L_Foot: 'foot_l', J_Bip_L_ToeBase: 'ball_l',
    J_Bip_R_UpperLeg: 'thigh_r', J_Bip_R_LowerLeg: 'calf_r', J_Bip_R_Foot: 'foot_r', J_Bip_R_ToeBase: 'ball_r'
  };

  /**
   * 목표 뼈 이름 → 원본 뼈 이름 표. **이름이 같은 것만** 먼저 잇고(항등) —
   * 겹치지 않는 뼈(손가락 · IK · 이 몸에만 있는 `Root`·`Chest`)는 표에 안 넣는다 —
   * 표에 없으면 그 뼈는 건드리지 않고 제 자세로 남는다. 그 위에 VRM 표를
   * 덧붙인다(항등으로 이미 잡힌 이름은 건드리지 않는다).
   */
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

  /** 이 장면의 키(m) — 뼈대 크기를 견줄 때 쓴다 */
  function sceneHeight(obj) {
    var t = three();
    var b = new t.Box3().setFromObject(obj);
    return Math.max(1e-4, b.max.y - b.min.y);
  }

  function retargetInto(c, src) {
    var t = three();
    if (!t || !t.SkeletonUtils || !t.SkeletonUtils.retargetClip) { return []; }
    var tgt = firstSkinned(c.gltf.scene), s = firstSkinned(src.gltf.scene);
    if (!tgt || !s) { return []; }
    /* 옮기는 동안 뼈가 실제로 움직이므로 **사본**으로 굴린다 —
       원본을 굴리면 그 모델을 쓰는 다른 배우가 같이 뒤틀린다 */
    var tc = cloneScene(c.gltf), sc = cloneScene(src.gltf);
    var tm = firstSkinned(tc), sm = firstSkinned(sc);
    if (!tm || !sm) { return []; }
    tc.updateMatrixWorld(true); sc.updateMatrixWorld(true);

    /* **뼈대 크기를 맞춘다.** `retargetClip` 은 회전은 월드 자세로 풀어 주지만
       **엉덩이(hip)의 위치만은 원본 값을 그대로 옮긴다** — 되돌려 주는 것은
       hip 이 아닌 뼈뿐이다(`preserveBonePositions`). 그런데 몸짓 원본
       `Knight.glb` 는 키 5.60 으로 만들어져 있고 옮겨 입을 다섯 벌은 1.87 이라
       **세 배**다. 그대로 옮기면 엉덩이가 세 배 높이로 튀고 발은 땅에 붙은 채라
       몸이 늘어난다 — 재 보니 **폭이 키의 4.3 배**가 됐고, 그렇게 뭉개진 메시는
       화면에서 아예 사라졌다(2026-08-28 에 사용자가 발견했다).
       `options.scale` 이 정확히 이 자리에 곱해지는 값이다 */
    var mul = sceneHeight(tc) / sceneHeight(sc);

    /* **뼈 이름표를 손으로 만들어 준다.** 이것이 없으면 옮겨지지 않는다.
       번들된 `SkeletonUtils.retarget` 은 목표 뼈의 짝을 `options.names[뼈이름]`
       으로만 찾는다 — 세 군데 중 두 군데에 `|| bone.name` 되돌림이 **없어서**,
       표를 안 주면 `undefined` 로 찾다가 **한 뼈도 못 맞춘다**(직접 번들 소스를
       읽고 알았다). 이름이 같은 뼈끼리 항등으로 이어 준다 */
    var names = boneNameMap(tm, sm);
    if (!names.count) { return []; }

    var out = [], i, j, clip;
    for (i = 0; i < src.clips.length; i++) {
      try {
        clip = t.SkeletonUtils.retargetClip(tm, sm, src.clips[i],
          { hip: 'Hips', scale: mul, names: names.map });
        if (clip) {
          clip.name = src.clips[i].name;
          /* `retargetClip` 이 굽는 트랙 이름은 `.bones[뼈이름].quaternion` 식
             (스켈레톤 상대 주소)이다 — three 의 `PropertyBinding` 은 이 형식을
             `AnimationMixer` 의 **뿌리가 SkinnedMesh 자신일 때만** 푼다
             (`root.skeleton.getBoneByName()` 로 찾는다). 그런데 이 창고는
             어디서든 `new AnimationMixer(model)` 의 `model` 이 SkinnedMesh를
             감싼 Group(`normalize()`가 돌려주는 것)이라 뼈까지 못 내려가
             **조용히 아무것도 안 움직인다**(에러도 안 난다) — 2026-09-05
             "팔이 T자로 안 움직인다" 버그를 직접 재현해 찾았다. 뼈 이름은
             장면 전체에서 유일하므로 `뼈이름.quaternion` 평범한 이름으로
             바꾸면 `findNode` 가 Group 에서부터 재귀로 찾아 그대로 먹힌다 —
             가리키는 값(위치·회전)은 그대로고 **주소 형식만** 바꾼다 */
          for (j = 0; j < clip.tracks.length; j++) {
            clip.tracks[j].name = clip.tracks[j].name.replace(/^\.bones\[([^\]]+)\]/, '$1');
          }
          out.push(clip);
        }
      } catch (e) { /* 이 클립 하나만 건너뛴다 */ }
    }
    c.retargetScale = mul;
    return out;
  }

  /** 몸짓을 옮겨 입힐까 — 0 이면 안 입는다(클립 0 벌로 가만히 선다). 되돌림 손잡이 */
  function RETARGET_ON() { return core().tuned('asset3d.retarget', 1) ? true : false; }

  /** 몸짓 원본을 받아 두고, 그것을 이 몸에 입힌 뒤 기다리던 쪽에 넘긴다 */
  function dressUp(c, done) {
    if (!RETARGET_ON()) { done(); return; }
    acquire(ANIM_SRC, function (src) {
      if (src && src.clips && src.clips.length) {
        c.clips = retargetInto(c, src);
        c.map = mapClips(c.clips.map(function (a) { return a.name; }));
        c.dressed = true;
      }
      done();
    });
  }

  /**
   * **받은 그대로의 PBR 재질을 벗긴다.** Quaternius 인물·짐승 GLB 는 다 같은
   * `metallicFactor 0.4` 를 지고 온다 — 금속 반사는 환경맵(IBL)이 있어야
   * 밝게 보이는데 이 판은 방향광·반구광 둘뿐이라 환경맵이 없다. 그 결과
   * 배우가 화면에서 **거의 새까맣게** 선다(2026-08-29, 사용자가 발견했다 —
   * "캐릭터가 깨져 보인다"). 건물·나무는 `prop3d.js` 가 이미 빛깔만 뽑아 Lambert
   * 로 갈아 끼우고 있어 멀쩡했는데, 배우(`asset3d`)만 원본 재질을 그대로 뒀다.
   * **빛깔만 남기고 Lambert 로 바꾼다** — 스킨 메시도 그대로 움직인다(재질
   * 종류는 스키닝과 무관하다). 사본이 아니라 **원본을 바로 고친다** — 이
   * 모델을 처음 받은 그 순간(캐시에 한 번) 뿐이라 다른 배우와 부딪히지 않는다.
   */
  /** 2026-09-04 — `prop3d.js`와 같은 고침: `/realistic/` 밑은 벗기지 않는다.
   *  이 판(`fort:t3`·`station`)에 실사 사진측량 건물을 처음 얹으며 같이 옮겼다 */
  function looksRealistic(url) { return typeof url === 'string' && url.indexOf('/realistic/') >= 0; }

  /* 2026-09-17 — SAGA-DESIGN §6.1 "저비용 통일": Lambert 대신 3단 램프 툰 재질로
     벗기고(`toon3d.toonify`), 큰 덩이(사람·짐승)엔 뒤집힌 헐 외곽선도 얹는다.
     `world3d.toon`/`world3d.outline` 손잡이가 꺼지면 예전 Lambert 그대로다.
     실사(`/realistic/`) 는 이 함수에 아예 안 들어온다 — PLAN §10-Q1: 기본은 툰,
     실사는 (`world3d.realisticPeople`) 손잡이 뒤로. W-0140 — 배경(건물·지물 GLB)은 툰 띠 대신 부드러운 명암(Standard 거칠기 0.85·금속 0, 환경광을 받는다). 인물·짐승은 툰 그대로(DESIGN §6.0-1). 손잡이 world3d.softBackdrop 0 이면 예전 툰 */
  function isBackdrop(url) { return typeof url === 'string' && (url.indexOf(BLD) >= 0 || url.indexOf('/world3d/') >= 0); } function shadeOne(m, url, toon, TN) { if (isBackdrop(url) && core().tuned('world3d.softBackdrop', 1)) { var s = m.clone(); s.roughness = 0.85; s.metalness = 0; return s; } return toon ? TN.toonify(m) : null; }
  function delam(root, url) {
    if (looksRealistic(url)) { return; }
    var t = three();
    var TN = global.DG.toon3d;
    var toon = !!(TN && TN.TOON_ON());
    var wantOutline = !!(TN && TN.OUTLINE_ON());
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      /* 법선이 아예 없는 GLB(2026-09-23 예방 — 사가천하 킷배싱 탑이 이것으로 새까맸다): GLTFLoader 는 이때 flatShading 을 켜
         주지만 toonify 가 만드는 MeshToonMaterial 은 flatShading 을 안 받아(r169) 법선 0 → 통째로 새까맣다.
         사가나락 delam 이 2026-09-04 에 먼저 밟은 함정과 같은 처방 — 지오메트리에서 계산해 채운다 */
      if (o.geometry && o.geometry.attributes.position && !o.geometry.attributes.normal) { o.geometry.computeVertexNormals(); }
      var one = Array.isArray(o.material) ? o.material : [o.material];
      var out = one.map(function (m) {
        if (!m || (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial)) { return m; }
        var sh = (toon || isBackdrop(url)) ? shadeOne(m, url, toon, TN) : null; if (sh) { return sh; }
        /* vertexColors 를 안 옮기면(정점빛깔로 색을 주고 baseColorFactor 는
           검게 비워 둔 옷감이 있다) 그 자리가 조명과 무관하게 통째로 새까맣게
           뜬다 — 2026-09-03, 사가천하 무장 초상에서 처음 잡은 버그다 */
        return new t.MeshLambertMaterial({
          color: m.color ? m.color.clone() : new t.Color(0xffffff),
          map: m.map || null, vertexColors: !!m.vertexColors,
          transparent: !!m.transparent, opacity: m.opacity,
          alphaTest: m.alphaTest || 0, side: m.side
        });
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    /* 외곽선 — 모델 안에서는 **가장 큰 부품 반지름 × 2% 한 폭**, 그 12% 보다 작은 부품(눈·이빨·발굽)은 안 두른다(사가종횡 delam 과 같다).
       예전엔 부품마다 제 반지름 × 3%(최소 0.006)라 반지름 0.002~0.03 인 동물 GLB 에서 외곽선이 부품보다 두꺼워 검은 파편이 번졌다(2026-09-23).
       VRoid 는 vroid-variant 가 이미 둘러 `_toonOutline` 로 건너뛴다. traverse 도중 자식을 더하지 않으려고 모아서 붙인다 */
    if (toon && wantOutline) {
      var olMs = [], olMax = 0;
      root.traverse(function (o) {
        if (!o.isMesh || !o.geometry || (o.userData && o.userData._toonOutline) || /_outline$/.test(o.name || '')) { return; }
        if (!o.geometry.boundingSphere) { o.geometry.computeBoundingSphere(); }
        var r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : 0;
        olMs.push({ m: o, r: r });
        if (r > olMax) { olMax = r; }
      });
      olMs.forEach(function (x) { if (olMax > 0 && x.r >= olMax * 0.12) { TN.outline(x.m, olMax * 0.02); } });
    }
  }

  function acquire(url, done) {
    var c = cache[url];
    if (c && c.state === 'ok') { done(c); return; }
    if (c && c.state === 'fail') { done(null); return; }
    if (c) { c.waiting.push(done); return; }

    var ld = loader();
    if (!ld) { cache[url] = { state: 'fail', waiting: [] }; done(null); return; }
    c = cache[url] = { state: 'load', waiting: [done] };
    ld.load(url, function (gltf) {
      c.state = 'ok';
      c.gltf = gltf;
      /* 2026-09-23 — VRoid(unlit → MeshBasic)는 delam 이 안 보는 재질이라 명암 없이 평면으로 떴다.
         먼저 툰 + 오픈월드 RPG식 얼굴 그림자로 바꾼다(다섯 판 공용 vroid-variant.js). 외곽선은 아래 delam 이 그대로 두른다 */
      if (global.DG.vroidVariant && global.DG.vroidVariant.shade) { global.DG.vroidVariant.shade(gltf.scene, url); }
      delam(gltf.scene, url);
      c.clips = gltf.animations || [];
      c.map = mapClips(c.clips.map(function (a) { return a.name; }));
      /* 제 몸짓이 없으면 원본에서 옮겨 입힌다 (원본 자신은 빼고 — 무한 재귀,
         이미 같은 뼈대인 몸·옷·머리도 빼고 — `buildHero` 가 따로 물린다) */
      if (needsRetarget(c) && url !== ANIM_SRC && !SKIP_AUTORETARGET[url]) {
        dressUp(c, function () { flush(c, c); });
        return;
      }
      flush(c, c);
    }, null, function () {
      /* 없는 파일·file:// 막힘·깨진 모델 — 전부 같은 결말이다. 도형으로 남는다 */
      c.state = 'fail';
      flush(c, null);
    });
  }

  function flush(c, arg) {
    var w = c.waiting; c.waiting = [];
    for (var i = 0; i < w.length; i++) { w[i](arg); }
  }

  /**
   * 이 배우를 무슨 빛깔로 물들이나 — **순수 함수다**(자가진단이 따로 본다).
   *
   * 모델 한 벌을 일흔 명이 나눠 쓰면 다 같은 사람이 된다. 그래서 **세력 빛깔**로
   * 물들인다: 촉은 초록, 위는 파랑… 세력이 없으면 **id 해시로 색상환을 돈다** —
   * 아무 두 사람도 같은 빛깔이 되지 않게.
   *
   * 흰 옷(1,1,1)에 곱하는 값이라 **너무 어두우면 안 된다** — 0.55 아래로 안 간다.
   * 물들이지 않을 것은 null 을 준다(짐승은 제 털빛이 맞다).
   */
  function tintOf(kind, ref) {
    if (kind !== 'hero' || !ref) { return null; }
    var t = three();
    if (!t) { return null; }
    var D = global.DG.data;
    /* 바탕색 — 제 빛깔이 있으면 그것(주민 열 사람은 저마다 색을 갖고 있다),
       없으면 세력 빛깔(촉·위·오·고구려…), 그것도 없으면 잿빛 */
    var base = ref.color || null;
    if (!base && ref.faction && D && D.faction) { base = D.faction(ref.faction).color; }
    if (!base) { base = '#8a94a6'; }

    /* **같은 세력 안에서도 갈라야 한다.** 촉 사람 여럿이 다 같은 초록이면
       한 벌을 나눠 쓰는 티가 그대로 난다 — id 해시로 색상과 밝기를 조금씩 민다 */
    var s = String(ref.id || ref.name || ''), i, h = 0;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    var C = new t.Color(base);
    var hsl = { h: 0, s: 0, l: 0 };
    C.getHSL(hsl);
    var dh = ((h % 1000) / 1000 - 0.5) * 0.14;          // ±0.07 바퀴
    var dl = (((h >> 10) % 1000) / 1000 - 0.5) * 0.26;  // ±0.13
    /* 흰 옷에 곱하는 값이라 **너무 어두우면 안 된다** — 0.42 아래로 안 간다 */
    C.setHSL((hsl.h + dh + 1) % 1, Math.min(1, hsl.s * 0.9 + 0.12),
             Math.max(0.42, Math.min(0.82, hsl.l + dl)));
    return '#' + C.getHexString();
  }

  var tintCache = {};

  /** 복제한 모델의 재질을 물들인다 — 원본은 안 건드린다(다른 배우가 같이 쓴다) */
  function applyTint(model, hex) {
    var t = three();
    if (!hex || !t) { return model; }
    var tc = new t.Color(hex);
    model.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      var src = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!src || src.isShaderMaterial) { return; }   // 외곽선 재질은 물들이지 않는다(2026-09-23)
      var key = (src.uuid || '') + '|' + hex;
      if (!tintCache[key]) {
        var TNc = global.DG.toon3d;
        var m = TNc && TNc.cloneMat ? TNc.cloneMat(src) : src.clone();   // 림 셰이더까지 옮긴다
        m.color = new t.Color(src.color ? src.color.getHex() : 0xffffff).multiply(tc);
        tintCache[key] = m;
      }
      o.material = tintCache[key];
    });
    return model;
  }

  /** 뼈대가 있는 모델은 그냥 복제하면 뼈대를 나눠 쓴다 — 배우 스물이 같이 걷는다 */
  function cloneScene(gltf) {
    var t = three();
    if (t.SkeletonUtils && t.SkeletonUtils.clone) { return t.SkeletonUtils.clone(gltf.scene); }
    return gltf.scene.clone(true);
  }

  /**
   * **모듈형 모델은 부위 변형을 전부 켜 놓고 온다.**
   * `Farmer_Body_1..4` · `Farmer_Head_1..5` 처럼 고를 것들이 **동시에 겹쳐** 있어
   * 그대로 세우면 모자 다섯을 겹쳐 쓴 덩어리가 된다. 직접 열어 보고 알았다.
   *
   * 그래서 **무리마다 하나씩만 켠다.** 어느 것을 켜는지는 `ref.id` 해시가 정하므로
   * 같은 사람은 늘 같은 차림이고, 사람이 다르면 차림이 갈린다 —
   * 몸 한 벌에서 **스무 가지쯤**이 나온다(몸통 넷 × 머리 다섯).
   *
   * 무리 이름은 이름 끝의 `_숫자` 를 떼어 만든다. `_숫자` 가 없는 것(다리·발 하나뿐)은
   * 무리가 하나뿐이므로 그대로 켜 둔다.
   */
  var REGION = /_(body|head|legs?|feet|foot|hair|hat|arms?|torso|pants|shoes?|face|beard|helmet|cape|skirt|top|bottom|acc\w*)$/i;

  /** 무리 하나의 세로 범위 — 다리 위에 몸통이, 몸통 위에 머리가 이어지는지 잰다.
   *  잴 수 없으면(three 가 없거나, 자가진단의 가짜 traverse 뭉치) null 을 준다 —
   *  그러면 `pickPieces` 가 옛 방식(해시만으로 고르기)으로 물러난다. */
  function yRange(o) {
    var t = three();
    if (!t || !o.isMesh || !o.geometry) { return null; }
    try {
      var b = new t.Box3().setFromObject(o);
      if (!isFinite(b.min.y) || !isFinite(b.max.y)) { return null; }
      return { min: b.min.y, max: b.max.y };
    } catch (e) { return null; }
  }

  /* 무리끼리 몸이 이어지려면 이 정도 틈은 넘어가 준다(옷깃이 살짝 뜨는 정도) —
     실제로 벌어졌던 틈(0.3 안팎)에 비하면 훨씬 작다. 모델의 키를 1로 보는 단위다. */
  var JOIN_GAP = 0.05;

  function pickPieces(model, ref) {
    /* **가지런히 잰다.** 갓 복제한 장면은 뼈대 자세가 계층에 안 갱신돼 있을 수
       있다 — 안 갱신하고 재면 몸통이 스무 배로 잘못 잰다(normalize() 의 같은 함정) */
    if (typeof model.updateMatrixWorld === 'function') { model.updateMatrixWorld(true); }

    var groups = {}, base = null, measurable = true;
    model.traverse(function (o) {
      if (!o.isMesh) { return; }
      var m = /^(.*)_(\d+)$/.exec(o.name || '');
      /* **부위 이름이 붙은 것만 변형으로 본다.** `Knight_1·2·3` 은 변형이 아니라
         한 사람의 부품(몸·칼·방패)이라, 이름 끝의 숫자만 보고 고르면 둘이 꺼져
         칼만 남은 사람이 선다. 실제로 그렇게 됐다 */
      if (!m || !REGION.test(m[1])) {
        /* 무리가 아닌 것(다리 하나뿐인 몸통 등)은 항상 서 있다 — 그 꼭대기가
           첫 무리를 이을 발판이다 */
        var r = yRange(o);
        if (r) { base = base ? { min: Math.min(base.min, r.min), max: Math.max(base.max, r.max) } : r; }
        return;
      }
      (groups[m[1]] = groups[m[1]] || []).push(o);
    });
    var s = String((ref && (ref.id || ref.name)) || ''), i, h = 0;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }

    var names = [], g;
    for (g in groups) { if (groups.hasOwnProperty(g)) { names.push(g); } }

    /* **다리부터 머리 순서로 잇는다.** 무리 이름은 모델마다 다르므로(`Legs`·
       `Head`·`Body`…) 이름이 아니라 **잰 높이**로 순서를 정한다 — 낮은 무리부터
       하나씩 골라, 이미 고른 것들의 꼭대기에 잘 닿는 조각을 우선한다. 안 그러면
       해시가 몸통 없이 머리와 다리만 고를 수 있다(2026-08-29, 사용자가 실기기로
       발견 — 갓 하나가 허공에 떠 있었다). 잴 수 없으면(자가진단) 그냥 등장 순서로
       돈다 — 어차피 결과는 안 본다, 무리가 하나만 켜지는지만 본다. */
    var ranged = {}, gi;
    for (gi = 0; gi < names.length; gi++) {
      ranged[names[gi]] = groups[names[gi]].map(yRange);
      if (ranged[names[gi]].indexOf(null) >= 0) { measurable = false; }
    }
    if (measurable) {
      names.sort(function (ga, gb) {
        var ra = ranged[ga].reduce(function (a, r) { return Math.min(a, r.min); }, Infinity);
        var rb = ranged[gb].reduce(function (a, r) { return Math.min(a, r.min); }, Infinity);
        return ra - rb;
      });
    }

    var top = (measurable && base) ? base.max : -Infinity;
    var n = 0;
    for (gi = 0; gi < names.length; gi++) {
      var list = groups[names[gi]];
      if (list.length < 2) {
        if (measurable && list.length === 1) {
          var r1 = yRange(list[0]);
          if (r1) { top = Math.max(top, r1.max); }
        }
        continue;
      }
      /* 무리마다 다른 자릿수를 봐야 몸통과 머리가 같이 움직이지 않는다.
         **부호 없는 자리이동(`>>>`)이어야 한다** — `>>` 는 32비트 부호를 타서
         음수가 나오고, 그러면 무리 전체가 꺼져 몸통도 머리도 없는 사람이 선다.
         실제로 관우가 다리만 남았다 */
      var hashPick = (h >>> ((n * 3) % 29)) % list.length;
      n++;

      var keep = hashPick;
      if (measurable) {
        var ranges = ranged[names[gi]];
        if (top === -Infinity) { top = Math.min.apply(null, ranges.map(function (r) { return r.min; })); }
        var bestGap = Infinity;
        keep = -1;
        for (i = 0; i < ranges.length; i++) {
          var gap = ranges[i].min - top;
          if (gap <= JOIN_GAP && i === hashPick) { keep = i; break; }   // 이어지면 해시를 그대로 쓴다
          if (Math.abs(gap) < bestGap) { bestGap = Math.abs(gap); keep = i; }
        }
        top = Math.max(top, ranges[keep].max);
      }
      for (i = 0; i < list.length; i++) { list[i].visible = (i === keep); }
    }
    return model;
  }

  /**
   * 키 1 로 눕혀 담는다. `mul` 을 주면 그 키로 선다(`heightMul` 이 정한다).
   *
   * 눕힌 **뒤의 폭**을 껍데기에 적어 둔다 — 깃대를 건물 옆에 세우려면
   * 이 건물이 얼마나 넓은지를 알아야 하는데, 탑(폭비 0.28)과 여관(1.15)이
   * 네 배 넘게 차이 난다. 못박은 값을 쓰면 한쪽은 벽에 박히고 한쪽은 허공에 뜬다.
   */
  function normalize(obj, mul) {
    var t = three();
    /* **재기 전에 월드 행렬을 갱신한다.** 이 한 줄이 없으면 계층에 걸린 스케일이
       빠진 채로 재어, 키가 스무 배로 나오고 그만큼 잘게 줄여 놓는다 —
       **사람이 몸통만 옆으로 4배 넓은 조각**이 되어 화면에서 사라졌다.
       (`prop3d.partsOf` 는 이 줄이 있어서 나무·집은 멀쩡했다. 여기만 빠져 있었다) */
    obj.updateMatrixWorld(true);
    var b = new t.Box3().setFromObject(obj);
    var f = fit({
      minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y, minZ: b.min.z, maxZ: b.max.z
    });
    var m = mul || 1;
    var wrap = new t.Group();
    obj.scale.setScalar(f.scale * m);
    obj.position.set(f.dx * m, f.dy * m, f.dz * m);
    wrap.userData.span = {
      w: (b.max.x - b.min.x) * f.scale * m,
      d: (b.max.z - b.min.z) * f.scale * m,
      h: m
    };
    wrap.add(obj);
    return wrap;
  }

  /** 표식 깃발을 건물 옆에 세운다 — 규격은 `markOf` 가 정한다(순수) */
  function addMark(wrap, mark) {
    var t = three();
    if (!t || !mark || !wrap) { return wrap; }
    var span = (wrap.userData && wrap.userData.span) || { w: 1, d: 1, h: 1 };
    var h = span.h || 1;
    /* 앞을 가리지 않게 **옆 뒤쪽**에 세운다 — 도형 성채도 뒤 왼편에 꽂혀 있었다 */
    var x = span.w / 2 + h * 0.07;
    var z = -(span.d / 2) - h * 0.05;
    var poleH = h * mark.pole;
    var pole = new t.Mesh(
      new t.CylinderGeometry(h * 0.013, h * 0.013, poleH, 5),
      new t.MeshLambertMaterial({ color: 0x6b5533 })
    );
    pole.position.set(x, poleH / 2, z);
    wrap.add(pole);
    var fw = h * mark.w, fh = h * mark.flag;
    var cloth = new t.Mesh(
      new t.BoxGeometry(fw, fh, h * 0.008),
      new t.MeshLambertMaterial({ color: new t.Color(mark.color) })
    );
    cloth.position.set(x + fw / 2, poleH - fh * 0.62, z);
    wrap.add(cloth);
    return wrap;
  }

  /**
   * 캡슐·상자로 세운다 — 마지막 되돌림 자리 (PLAN 49절).
   * `actor3d` 가 모르는 종류가 들어와도 화면에 **무언가는** 선다.
   */
  function primitive(kind, ref) {
    var t = three();
    if (!t) { return null; }
    var g = new t.Group();
    var col = (ref && (ref.color || ref.tint)) || '#8a94a6';
    var m = new t.MeshLambertMaterial({ color: new t.Color(col) });
    var body;
    if (kind === 'station' || kind === 'fort' || kind === 'building') {
      body = new t.Mesh(new t.BoxGeometry(0.9, 1, 0.9), m);
      body.position.y = 0.5;
    } else {
      body = new t.Mesh(new t.CapsuleGeometry(0.22, 0.52, 4, 10), m);
      body.position.y = 0.5;
    }
    g.add(body);
    g.userData.primitive = true;
    return g;
  }

  /**
   * 인물 하나 — **몸 위에 옷·머리를 얹어 한 뼈대에 묶는다.**
   *
   * 셋 다 뼈 이름·순서가 완전히 같으므로(직접 대조했다) 옷·머리의 스킨 메시를
   * `mesh.bind(몸의 스켈레톤, mesh.bindMatrix)` 로 다시 물리기만 하면 된다 —
   * `pickPieces`(부위 변형 고르기)도 `retargetClip`(몸짓 옮겨 입히기)도 필요
   * 없다. 이게 옛 표(Farmer·Worker·Lady)가 걷다가 몸이 갈라지던 근본 원인
   * (뼈대가 부위마다 따로였다)을 애초에 없앤 자리다.
   *
   * 몸의 메시(머리·눈썹·눈 포함)는 옷에 안 가려지는 손·목·얼굴만 남기고 옷이
   * 그대로 덮는다 — Quaternius 가 옷 쪽에도 노출 피부(손·팔) 재질을 따로
   * 태워 보내는 것이 그 뜻이다.
   */
  function assembleHero(parts, ref, rec) {
    var bodyScene = cloneScene(parts.body.gltf);
    var master = firstSkinned(bodyScene);
    if (!master || !master.skeleton) { throw new Error('몸에 스켈레톤이 없다'); }
    var skeleton = master.skeleton;

    [parts.outfit, parts.hair].forEach(function (p) {
      if (!p || !p.gltf) { return; }
      var scene = cloneScene(p.gltf);
      var meshes = [];
      scene.traverse(function (o) { if (o.isSkinnedMesh) { meshes.push(o); } });
      meshes.forEach(function (m) {
        m.bind(skeleton, m.bindMatrix);
        bodyScene.add(m);
      });
    });

    var model = normalize(bodyScene, heightMul('hero', ref));
    /* 2026-09-05 — 세력색 물들이기는 QRPG **흰 옷**(1,1,1)에 곱해 다양화하려고
       만든 장치인데(위 tintOf 주석), MPFB 실사 몸(사진 그대로의 살결·옷)에도
       똑같이 곱혀지고 있었다 — 실제 크롬(헤드리스 아님)으로 초상을 직접 구워
       보고서야 얼굴이 초록·파랑으로 물드는 게 눈에 띄었다(Blender 렌더·기존
       진단은 이 경로를 안 타서 못 잡았다). `tintOf()` 자체는 안 건드린다 —
       그 색은 UI 쪽에서도 "이 인물의 빛깔"로 따로 쓰이는 순수 값이다(관련
       진단 참고). 3D 모델에 **실제로 곱히는 것만** QRPG로 좁힌다 */
    var isQrpg = rec && rec.key && rec.key.indexOf('qrpg_') === 0;
    applyTint(model, isQrpg ? tintOf('hero', ref) : null);
    return model;
  }

  /**
   * 인물 하나를 조합형(몸+옷+머리)으로 세운다 — `build()` 가 `kind==='hero'`
   * 일 때 이 앞에서 부른다. 넷(몸·옷·머리·몸짓 원본)을 한꺼번에 받아 오고
   * 넷 다 모이면 `assembleHero()` 로 묶는다.
   */
  function buildHero(ref, makeShape) {
    var t = three();
    var rec = heroRecipe(ref);
    if (!rec) { return null; }

    var shell = new t.Group();
    var shape = makeShape ? makeShape() : null;
    if (!shape) { shape = primitive('hero', ref); }
    if (shape) {
      shell.add(shape);
      shell.userData.rig = shape.userData && shape.userData.rig;
    }
    shell.userData.assetUrl = rec.body;
    shell.userData.assetState = 'shape';
    built++;

    var parts = {}, pending = 4;
    var own = !rec.anim && wantsOwnAnim(rec.body);   // VRM 몸 → 자체 몸짓(UAL1 을 받으러 가지 않는다)
    function onOne() { pending--; if (pending === 0) { assemble(); } }
    acquire(rec.body, function (c) { parts.body = c; onOne(); });
    /* outfit·hair 는 조합형(옛 Quaternius) 레시피에만 있다 — QRPG 몸(통짜 스킨)은
       둘 다 없으니 헛수고로 받으러 가지 않고 바로 다음 칸으로 넘어간다 */
    if (rec.outfit) { acquire(rec.outfit, function (c) { parts.outfit = c; onOne(); }); } else { onOne(); }
    if (rec.hair) { acquire(rec.hair, function (c) { parts.hair = c; onOne(); }); } else { onOne(); }
    /* QRPG는 몸 파일 자체에 클립이 있다 — `rec.anim` 이 `rec.body` 와 같은 파일이면
       같은 캐시를 다시 받아 그 클립을 그대로 쓴다. 옛 조합형은 `rec.anim` 이 없어
       공용 ANIM_SRC(UAL) 로 몸짓을 옮겨 입는다 */
    if (own) { onOne(); } else { acquire(rec.anim || ANIM_SRC, function (c) { parts.anim = c; onOne(); }); }

    function assemble() {
      if (!parts.body) { shell.userData.assetState = 'fail'; return; }
      var model;
      try {
        model = assembleHero(parts, ref, rec);
        applyVroid(model, rec, ref && ref.id);
      } catch (e) {
        shell.userData.assetState = 'fail';
        broke = (e && e.message) ? e.message : 'hero assemble 실패';
        return;
      }
      while (shell.children.length) { shell.remove(shell.children[0]); }
      shell.add(model);
      shell.userData.rig = null;
      shell.userData.assetState = 'glb';
      swapped++;

      var animC = parts.anim;
      if (own) {
        /* 몸이 조립된 장면에서 실제 뼈를 읽어 그 몸에 맞춰 굽는다 — 몸마다 한 번(캐시). 못 만들면 UAL1 길로 되돌아간다 */
        if (!parts.body.ownClips) { parts.body.ownRig = global.DG.ownAnim.restRig ? global.DG.ownAnim.restRig(model) : null; parts.body.ownClips = global.DG.ownAnim.clipsFor(model, t) || []; }   // W-0169 ownRig = 정지 자세 뼈대(무기 몸짓을 나중에 굽는다)
        if (parts.body.ownClips.length) {
          var oc = parts.body.ownClips, om = new t.AnimationMixer(model), oa = {}, oi;
          for (oi = 0; oi < oc.length; oi++) { oa[oc[oi].name] = om.clipAction(oc[oi]); }
          shell.userData.mixer = om;
          shell.userData.actions = oa;
          shell.userData.clipMap = mapClips(oc.map(function (a) { return a.name; }));
          shell.userData.ownAnim = true; shell.userData.ownBody = parts.body;   // W-0169 무기 몸짓 캐시 자리
          shell.userData.anim = null;
          animC = null;                              // 아래 UAL1 길은 건너뛴다
        } else {
          own = false;
          acquire(ANIM_SRC, function (c) { parts.anim = c; assemble(); });
          return;
        }
      }
      if (animC && animC.clips && animC.clips.length) {
        var clips = animC.clips;
        /* 몸이 제 클립이 없어(QRPG 는 있다, `rec.anim===rec.body`) ANIM_SRC(UAL1)
           를 빌려 왔다면(옛 조합형·MPFB 실사 몸 등) **그대로 물리면 안 된다** —
           ANIM_SRC 클립은 뼈마다 position·quaternion·scale 을 다 굽고 있어서
           (위치까지 매 프레임 덮어쓴다), 이 몸의 뼈 길이가 ANIM_SRC 와 한 치도
           안 다를 때만 우연히 맞는다. 뼈 이름은 같아도 실제 인체 비례로 뽑은
           몸(MPFB)은 뼈 길이가 다르므로 raw 로 물리면 팔다리가 ANIM_SRC 치수로
           튀거나(위치 덮어쓰기) 붙어 있던 부모 축과 안 맞아 뒤틀린다 — 2026-09-05
           "팔이 T자로 안 움직인다" 버그의 원인. `retargetInto`(위, 476행)로
           다시 구우면 위치는 이 몸의 것을 그대로 지키고(preserveBonePositions)
           회전만 세계 좌표로 옮겨 입으므로 뼈 길이가 달라도 맞는다. 몸마다
           한 번만 굽도록 `parts.body`(URL 로 캐싱되는 원본 캐시 칸)에 매달아 둔다 */
        if (rec.anim !== rec.body) {
          if (!parts.body.heroClips) {
            parts.body.heroClips = retargetInto({ gltf: { scene: model } }, animC) || [];
          }
          if (parts.body.heroClips.length) { clips = parts.body.heroClips; }
        }
        var mx = new t.AnimationMixer(model);
        var acts = {}, i;
        for (i = 0; i < clips.length; i++) { acts[clips[i].name] = mx.clipAction(clips[i]); }
        shell.userData.mixer = mx;
        shell.userData.actions = acts;
        shell.userData.clipMap = mapClips(clips.map(function (a) { return a.name; }));
        shell.userData.anim = null;
      }
    }
    return shell;
  }

  /**
   * 배우 하나를 GLB 로 세운다 — `actor3d.build` 가 이 앞에서 부른다.
   *
   * GLB 는 받아 오는 데 시간이 걸리는데 지도는 지금 그려야 한다. 그래서
   * **껍데기(Group)** 를 먼저 돌려주고 그 안에 도형을 넣어 둔다. 다 받으면
   * 안의 것만 갈아 끼운다 — 껍데기를 쥔 `world3d` 는 아무것도 모른 채 그대로 돈다.
   *
   * `kind === 'hero'` 는 파일 하나가 아니라 몸+옷+머리 셋을 묶는 조합형이라
   * `buildHero()` 에 넘긴다(아래) — 그 안에서 GLB_ON 손잡이도 따로 본다.
   *
   * @param makeShape 도형을 만드는 함수 (actor3d 가 자기 것을 건네준다)
   */
  function build(kind, ref, makeShape) {
    var t = three();
    if (!t) { return null; }
    if (kind === 'hero') {
      return GLB_ON() ? buildHero(ref, makeShape) : null;
    }
    var url = wants(kind, ref) ? urlOf(kind, ref) : null;
    if (!url) { return null; }

    var shell = new t.Group();
    var shape = makeShape ? makeShape() : null;
    if (!shape) { shape = primitive(kind, ref); }
    if (shape) {
      shell.add(shape);
      /* 도형으로 서 있는 동안은 `actor3d.step` 이 관절을 돌려야 한다 */
      shell.userData.rig = shape.userData && shape.userData.rig;
    }
    shell.userData.assetUrl = url;
    shell.userData.assetState = 'shape';
    built++;

    acquire(url, function (c) {
      if (!c) { shell.userData.assetState = 'fail'; return; }
      var model;
      try {
        model = cloneScene(c.gltf);
        pickPieces(model, ref);           // 부위 변형은 무리마다 하나씩만
        model = normalize(model, heightMul(kind, ref));
        applyTint(model, tintOf(kind, ref));
        /* 건물은 물들이지 않는다(제 빛깔이 맞다) — 대신 **표식 깃발**을 얹는다 */
        addMark(model, markOf(kind, ref));
      } catch (e) {
        shell.userData.assetState = 'fail';
        broke = (e && e.message) ? e.message : 'swap 실패';
        return;
      }
      while (shell.children.length) { shell.remove(shell.children[0]); }
      shell.add(model);
      shell.userData.rig = null;                 // 이제 관절은 mixer 가 돌린다
      shell.userData.assetState = 'glb';
      swapped++;
      if (c.clips && c.clips.length) {
        var mx = new t.AnimationMixer(model);
        var acts = {}, i;
        for (i = 0; i < c.clips.length; i++) { acts[c.clips[i].name] = mx.clipAction(c.clips[i]); }
        shell.userData.mixer = mx;
        shell.userData.actions = acts;
        shell.userData.clipMap = c.map;
        shell.userData.anim = null;
      }
    });
    return shell;
  }

  /**
   * 한 프레임 — GLB 면 여기서 처리하고 true 를, 아니면 false 를 준다.
   * false 면 `actor3d` 가 제 도형 관절을 돌린다.
   */
  function step(node, o) {
    if (!node || !node.userData || !node.userData.mixer) { return false; }
    var u = node.userData;
    var want = o && o.anim;
    if (!want) { want = (o && o.walking) ? ((o.speed || 0) > 1.6 ? 'run' : 'walk') : 'idle'; }
    play(node, want);
    var t = (o && o.t) || 0;
    var dt = u.lastT === undefined ? 0 : Math.max(0, Math.min(0.25, t - u.lastT));
    u.lastT = t;
    u.mixer.update(dt);
    return true;
  }

  /** 자리 이름(idle·walk…)으로 바꿔 튼다. 갑자기 끊기지 않게 0.2초 넘긴다 */
  function play(node, slot) {
    var u = node.userData;
    if (!u.mixer || u.anim === slot) { return false; }
    var OA = global.DG.ownAnim, name = (u.clipMap && u.clipMap[slot]) || (OA && OA.weaponAction && /^Wpn_/.test(slot) ? OA.weaponAction(u, slot, three()) || (u.clipMap && u.clipMap.attack) : null);   // W-0169 무기 몸짓
    var next = name && u.actions[name];
    if (!next) { return false; }
    var prev = u.curAct || (u.anim && u.clipMap[u.anim] && u.actions[u.clipMap[u.anim]]);   // W-0169 — 무기 몸짓 자리는 clipMap 에 없어 틀던 액션을 따로 든다
    next.reset().play();
    if (prev && prev !== next) { prev.crossFadeTo(next, slot.indexOf('Wpn_') === 0 ? 0.08 : 0.2, false); }
    u.anim = slot; u.curAct = next;
    return true;
  }

  /** 눈으로 확인할 때 — 표에 몇 줄이고 무엇이 서 있는지 */
  function stats() {
    var urls = Object.keys(cache), o = { registered: Object.keys(REG).length, loaded: 0, failed: 0 };
    for (var i = 0; i < urls.length; i++) {
      if (cache[urls[i]].state === 'ok') { o.loaded++; }
      if (cache[urls[i]].state === 'fail') { o.failed++; }
    }
    o.loader = !!loader();
    /* 옮겨 입힌 몸 수와 그 클립 수 — 리타기팅이 실제로 됐는지 값으로 본다 */
    o.dressed = 0; o.clips = 0; o.empty = 0;
    for (i = 0; i < urls.length; i++) {
      var c = cache[urls[i]];
      if (c.dressed) { o.dressed++; }
      if (c.state === 'ok') {
        o.clips += (c.clips ? c.clips.length : 0);
        if (!c.clips || !c.clips.length) { o.empty++; }
      }
    }
    o.built = built; o.swapped = swapped; o.broke = broke;
    return o;
  }

  global.DG = global.DG || {};
  global.DG.asset3d = {
    /* 표 — three 없이도 돈다 */
    REG: REG, register: register, keysFor: keysFor, lookup: lookup, urlOf: urlOf, isBackdrop: isBackdrop, shadeOne: shadeOne,
    wants: wants, chain: chain, SLOTS: SLOTS,
    /* 이름·크기 맞추기 — 순수 함수 */
    normName: normName, score: score, mapClips: mapClips, fit: fit,
    heightMul: heightMul, markOf: markOf,
    /* 세우기 — three 가 있어야 한다 */
    ready: function () { return !!three(); },
    hasLoader: function () { return !!loader(); },
    DEFAULTS: DEFAULTS, restore: restore, tintOf: tintOf, oneOf: oneOf,
    pickPieces: pickPieces,
    ANIM_SRC: ANIM_SRC, heroRecipe: heroRecipe, FIXED_HERO: FIXED_HERO, fixedRecipe: fixedRecipe,
    REALISTIC_ON: REALISTIC_ON, heroPool: heroPool,
    build: build, step: step, play: play, primitive: primitive, stats: stats,
    /** 진단 전용 — VRM 애니메 아바타 손잡이·레시피·뼈 매핑표 조회(2026-09-20) */
    wantsAnimeAvatar: wantsAnimeAvatar, wantsOwnAnim: wantsOwnAnim,
    heroRecipesAnime: function () { return HERO_RECIPES_ANIME; },
    vrmToUal1Bones: function () { return VRM_TO_UAL1_BONES; },
    boneNameMap: boneNameMap,
    /** 표를 비운다 (진단이 제 뒤를 치울 때) */
    clear: function () {
      var k; for (k in REG) { if (Object.prototype.hasOwnProperty.call(REG, k)) { delete REG[k]; } }
      cache = {};
      return REG;
    }
  };
})(window);
