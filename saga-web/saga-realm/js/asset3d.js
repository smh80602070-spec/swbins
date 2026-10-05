/**
 * 3D 에셋 창고 — 사가국지 (PLAN 40절 PHASE 1~2)
 * ---------------------------------------------------------------
 * 지금 지도(`#realm`)는 svg 원·선으로 그린 평면 지도다. 언젠가 성 서른 곳을
 * 실제 3D 지형 위에 세우고 싶은데, saga-go·saga-dungeon·saga-forest 가 이미
 * 겪은 요령을 그대로 따른다 — **자리만 파 둔 창고 하나**를 두고, 부르는 화면
 * (`realm3d.js`)은 이 창고에서 이미 세운 사물을 받아 놓기만 한다.
 *
 * 이 판은 인물이 걸어 다니지 않는다(턴제 지도 화면) — 그래서 saga-go 의
 * `asset3d.js` 에 있던 인물 조립(몸+옷+머리)·몸짓 재타기팅은 이 창고에 없다.
 * 필요해지면(플레이어가 3D 로 걷는 화면이 생기면) 그때 그 요령을 옮겨 온다.
 *
 *   register()   표에 한 줄 적으면 그날부터 그 사물은 GLB 로 선다
 *   lookup()     표에서 첫 히트. three 없이도 도는 순수 함수
 *   build()      GLB 를 불러 세운다. 실패하면 조용히 도형(primitive)으로
 *                떨어진다 — **부르는 쪽은 실패를 몰라도 된다**(항상 뭔가는 온다)
 *
 * file://(PC 단독판)에서는 GLB 를 못 받는다(브라우저가 막는다) — 그때도
 * primitive 로 떨어지므로 단독판은 도형 지도로 그냥 돈다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  /** 2026-09-20 — VRM(`/people/anime/`) 몸은 남의 몸짓(UAL1)을 뼈 이름표로 다시 굽는 대신 `anim-own.js` 가 코드로 짠
   *  자체 몸짓을 입는다(Mixamo 는 약관상 공개 저장소에 못 올린다). 기본 켜짐, `world3d.ownAnim`=0 이면 예전 길(UAL1) */
  function wantsOwnAnim(url) {
    return !!(global.DG.ownAnim && typeof url === 'string' && (url.indexOf('/people/anime/') >= 0 || url.indexOf('characters3d/') >= 0) && core.tuned('world3d.ownAnim', 1));
  }

  var BLD = 'assets/models/buildings/';
  var NAT = 'assets/models/nature/';
  var PRP = 'assets/models/props/';
  var PEOPLE = 'assets/models/people/regular/';
  var ANIM_DIR = 'assets/models/anim/';

  /* 2026-09-03 — 다른 네 판과 같은 이유로 사람 기본을 갈아 끼운다. Quaternius
     "RPG Character Pack"(CC0, 전사·궁수·도적·성직자·마법사·수도승 6종)은 몸 파일
     하나에 걷기·공격·사망 클립이 다 들어 있어 옷·머리·ANIM_SRC 몸짓이 필요 없다 */
  var PEOPLE_QRPG = 'assets/models/people/quaternius_rpg/';
  var HERO_RECIPES = ['Warrior', 'Ranger', 'Rogue', 'Cleric', 'Wizard', 'Monk'].map(function (n) {
    var f = PEOPLE_QRPG + n + '.glb';
    return { key: 'qrpg_' + n.toLowerCase(), body: f, anim: f };
  });

  /* 2026-09-10 — 외형 다양화(saga-go 의 MPFB2 몸 20종을 그대로 복사, CC0,
   * 자세한 것은 assets/ASSET_LICENSES.md). **이 판은 인물이 안 걷는다** —
   * `buildHero()`를 부르는 곳이 `portrait3d.js`(도감 초상 굽기) 하나뿐이라
   * 몸짓(mixer) 없이 정지 자세로만 서도 된다. 그래서 `anim`을 saga-go처럼
   * `ANIM_SRC`(UAL1, Quaternius 뼈대)로 리타깃하지 않고, **몸 파일 자신을
   * anim으로 준다**(클립이 0개인 그 파일) — `buildHero()`의
   * `animC.clips.length` 검사가 그대로 걸러 mixer를 안 만들고 bind pose로
   * 멈춘다. UAL1을 그대로 물리면(리타깃 없이) saga-go가 이미 겪은 뼈대
   * 비례 뒤틀림 버그가 초상에 그대로 나온다 — 그래서 일부러 안 걸었다.
   * 걷는 화면이 생기면(이 판은 아직 없다) 그때 saga-go의 `retargetInto()`를
   * 옮겨 와야 한다. */
  var PEOPLE_MPFB = 'assets/models/people/mpfb_real/';
  var HERO_RECIPES_MPFB = ['female', 'male', 'v3', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12',
    'v13', 'v14', 'v15', 'v16', 'v17', 'v18', 'v19', 'v20', 'v21', 'v22', 'v23']
    .map(function (n) {
      var f = PEOPLE_MPFB + n + '.glb';
      return { key: 'mpfb_' + n, body: f, anim: f };
    });
  HERO_RECIPES = HERO_RECIPES.concat(HERO_RECIPES_MPFB);

  /* 옛 조합형 — 표 기본에서는 빠졌다. 지우지 않고 남겨 둔다(되돌림 자리).
   * 2026-09-02, 도감 초상을 굽으려고 처음 들였던 것(`js/portrait3d.js`) —
   * `saga-dungeon`과 같은 여섯 조합(몸+옷+머리). */
  var HERO_RECIPES_FALLBACK = [
    { key: 'male_peasant_buzzed', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Peasant.gltf', hair: PEOPLE + 'Hair_Buzzed.gltf' },
    { key: 'male_ranger_long', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Ranger.gltf', hair: PEOPLE + 'Hair_Long.gltf' },
    { key: 'male_peasant_beard', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Peasant.gltf', hair: PEOPLE + 'Hair_Beard.gltf' },
    { key: 'female_peasant_buns', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Peasant.gltf', hair: PEOPLE + 'Hair_Buns.gltf' },
    { key: 'female_ranger_simple', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Ranger.gltf', hair: PEOPLE + 'Hair_SimpleParted.gltf' },
    { key: 'female_peasant_buzzed', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Peasant.gltf', hair: PEOPLE + 'Hair_BuzzedFemale.gltf' }
  ];
  var ANIM_SRC = ANIM_DIR + 'UAL1_Standard.glb';

  /* 2026-09-20 — "고품질 셀 셰이딩급" VRM 애니메 아바타(사가의숲 asset3d.js에서 먼저 만든 것,
     경위는 saga-forest HANDOFF.md 2026-09-19 절)를 이 판에도 옮긴다. VRoid Studio
     공식 CC0 샘플 AvatarSample_A/B/C(github.com/madjin/vrm-samples) + 이 저장소가
     GUI 자동화로 새로 빚은 avatar_custom_01. **위 MPFB와 같은 이유로 리타깃을
     안 건다** — 이 판은 인물이 안 걷고 `portrait3d.js` 정지 초상뿐이라
     `anim`을 몸 파일 자신으로 준다(클립 0개 → `buildHero()`가 mixer 없이
     bind pose로 멈춘다). VRM 뼈 이름(`J_Bip_*`)을 UAL1로 리타깃 없이 그대로
     물리면 위 MPFB 주석이 겪은 뒤틀림 버그가 그대로 나서 일부러 이 길을
     피했다. **기본은 꺼짐**(0) — 손잡이를 켜기 전엔 기존 배정에 전혀 안
     끼어든다. */
  var PEOPLE_ANIME = 'assets/models/people/anime/';
  var HERO_RECIPES_ANIME = ['a', 'b', 'c'].map(function (n) {
    var f = PEOPLE_ANIME + 'avatar_sample_' + n + '.glb';
    /* 2026-09-23 — anim 을 몸 파일 자신으로 두면 자체 몸짓(anim-own) 길을 건너뛰고 클립 없는 몸 파일에서 몸짓을 찾아
       mixer 가 안 생겼다 → 초상·일기토의 VRoid 장수가 전부 T자세(스크린샷). 사가고처럼 anim 을 뺀다 */
    return { key: 'anime_avatar_' + n, body: f };
  }).concat([
    (function () {
      var f = PEOPLE_ANIME + 'avatar_custom_01.glb';
      return { key: 'anime_avatar_custom01', body: f };
    })()
  ]);
  /** 2026-09-20 — VRoid 몸이면 인물 id 로 머리·옷·눈 색을 바꾼다(vroid-variant.js, 다섯 판 공용). 다른 몸엔 안 건다 */
  function applyVroid(model, rec, id) {
    var V = global.DG && global.DG.vroidVariant;
    if (V && rec && V.isVroid(rec.body)) { V.faceFront(model, rec.body); V.apply(model, id); }   // 정면 -Z → +Z 로 돌려 세운 뒤 색 변형
  }
  function wantsAnimeAvatar() { return core.tuned('world3d.animeAvatar', 1) ? true : false; }

  /* ── 클립 이름 → 표준 슬롯(2026-09-10, 사가블로 asset3d.js 에서 그대로 옮김) ──
   * GLB 마다 클립 이름이 다 다르다("Attack1_swordShield" 같은 식) — 실제 이름을
   * 하나하나 맞추는 대신 낱말로 어림잡아 `idle`·`attack`·`hit` 같은 표준 슬롯에
   * 잇는다. 순수 함수라 사가블로에서 이미 검증된 로직을 한 글자도 안 고치고
   * 그대로 옮겼다 — 이 판 QRPG 몸도 같은 팩(Quaternius)이라 클립 이름 결이 같다 */
  var SLOTS = ['idle', 'walk', 'run', 'sprint', 'attack', 'hit', 'dodge', 'death', 'interaction', 'jump', 'land'];
  var WORDS = {
    idle: ['idle', 'stand', 'standing', 'breathe', 'rest', 'wait', 'loop', 'flying'],
    walk: ['walk', 'walking', 'locomotion', 'move'],
    run: ['run', 'running', 'jog'],
    sprint: ['sprint', 'runfast', 'fastrun', 'dash'],
    attack: ['attack', 'atk', 'slash', 'swing', 'strike', 'punch', 'shoot', 'cast',
      'headbutt', 'bite'],
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
  function clipScore(slot, name) {
    var ws = WORDS[slot] || [], i, w, best = 0, s;
    for (i = 0; i < ws.length; i++) {
      w = ws[i];
      if (name === w) { s = 100; } else if (name.indexOf(w) === 0) { s = 70; }
      else if (name.indexOf(w) >= 0) { s = 40; } else { continue; }
      s -= i;
      if (s > best) { best = s; }
    }
    return best;
  }
  var CLIP_FALLBACK = {
    run: ['walk', 'idle'], sprint: ['run', 'walk'], walk: ['run', 'idle'],
    hit: ['idle'], dodge: ['run', 'walk'], attack: ['interaction', 'idle'],
    death: ['hit', 'idle'], interaction: ['idle'], idle: ['walk'], jump: ['idle'], land: ['idle']
  };
  function mapClips(names) {
    var list = (names || []).map(function (n) { return { raw: n, n: normName(n) }; });
    var pairs = [], si, ci, sc;
    for (si = 0; si < SLOTS.length; si++) {
      for (ci = 0; ci < list.length; ci++) {
        sc = clipScore(SLOTS[si], list[ci].n);
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
      alt = CLIP_FALLBACK[SLOTS[i]] || [];
      for (j = 0; j < alt.length; j++) {
        if (out[alt[j]]) { out[SLOTS[i]] = out[alt[j]]; alias[SLOTS[i]] = alt[j]; break; }
      }
    }
    out.alias = alias;
    return out;
  }

  /** 표 — 성채는 **등급마다 다른 탑**이 선다(wall 값이 클수록 높은 탑).
   *  좁은 키(`city:t3`)부터 찾으므로 등급이 안 실려 와도 `city` 로 떨어진다 */
  var DEFAULTS = {
    'hero': HERO_RECIPES,
    'city:t1': BLD + 'Watchtower.glb',
    'city:t2': [BLD + 'Tower.glb', BLD + 'PointyTower.glb'],
    'city:t3': [BLD + 'LargeTower.glb', BLD + 'LargeSquareTowerBricks.glb'],
    'city': BLD + 'Tower.glb',

    'mount': [NAT + 'Mountain_1.glb', NAT + 'Mountain_2.glb'],
    'tree': [NAT + 'CommonTree_1.glb', NAT + 'CommonTree_2.glb', NAT + 'PineTree_1.glb'],
    'rock': [NAT + 'Rock_1.glb', NAT + 'Rock_2.glb'],

    /* 40절 PHASE 4 — 퀄리티 보강. 다섯 판 공통 방침("코드로 그리지 말고
     * 에셋으로")에 따라 saga-go/saga-forest 가 이미 확인해 둔 CC0 를 그대로 옮겼다 */
    'bush': [NAT + 'Bush_1.glb', NAT + 'Bush_2.glb'],
    'grass': NAT + 'Grass_2.glb',
    'flower': NAT + 'Flowers.glb',
    'wall': PRP + 'Wall.glb',
    'temple': PRP + 'Temple.glb',
    'torch': PRP + 'WoodenTorch.glb',
    'market': BLD + 'MarketStand_1.glb',
    'well': BLD + 'Well.glb',
    'house': [BLD + 'House_1.glb', BLD + 'House_2.glb', BLD + 'House_3.glb', BLD + 'House_4.glb'],
    'log': NAT + 'WoodLog.glb',
    'tent': PRP + 'Tent.glb',

    /* 2026-09-05 — 장수 3D 초상(`portrait3d.js`)에 무기·투구를 얹는다. 여태는
       QRPG 몸(전사·궁수·도적·성직자·마법사·수도승 6종 중 하나) 맨몸뿐이라,
       손으로 그린 캔버스 초상(`sprite.js`의 `LOOK`·`ruleLook()`—장수마다
       무기·투구·수염을 갖춘 표)보다 오히려 밋밋했다. **새로 받지 않고
       사가블로가 이미 갖춘 CC0/CC-BY 무기·장구를 그대로 복사해 왔다**
       (`saga-dungeon/assets/models/{weapons,gear}/`, 출처는 그쪽
       `ASSET_LICENSES.md`). `sprite.lookOf()`가 매기는 무기 열 가지 중
       실물이 있는 여덟만 걸고(halberd→spear, fan→brush 재사용은 사가블로와
       같은 판단), 투구는 helmet·crown·gapju(→바이킹 투구 대역, 역시 같은
       판단) 셋만 건다 — scholar·gat·hairpin·monk·braid 는 대응 CC0가 없어
       맨머리로 남는다(도형보다는 실제 무기를 든 실제 몸이 우선이라는 사용자
       지시, 아래 `attachAccessories()` 참고). */
    'wpn:sword': 'assets/models/weapons/sword.glb',
    'wpn:spear': 'assets/models/weapons/spear.glb',
    'wpn:axe': 'assets/models/weapons/axe.glb',
    'wpn:bow': 'assets/models/weapons/bow.glb',
    'wpn:club': 'assets/models/weapons/club.glb',
    'wpn:staff': 'assets/models/weapons/staff.glb',
    'wpn:scroll': 'assets/models/weapons/scroll.glb',
    'wpn:brush': 'assets/models/weapons/brush.glb',
    'gear:helmet': 'assets/models/gear/helmet.glb',
    'gear:crown': 'assets/models/gear/crown.glb',
    'gear:gapju': 'assets/models/gear/viking_helmet.glb'
  };

  var REG = {};
  function restore() {
    var k;
    REG = {};
    for (k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) { REG[k] = DEFAULTS[k]; } }
    return REG;
  }
  restore();

  /**
   * 동양풍 탑 — 2026-09-10 채택(README "다음 몫" 후속).
   * 지금 성채가 쓰는 Quaternius 탑(20~85KB)은 서양 판타지풍이라 결이 안
   * 맞는다는 문제가 있었는데, `assets/models/buildings/asian/BellStructure.glb`
   * (CC0, Polygonal Mind "lunar-year" 팩, ASSET_LICENSES.md 참고)로 1등급
   * 성채(`city:t1`)를 갈아 봤더니 붉은 기둥 종틀 형태로 서양풍과 뚜렷이
   * 다르게 서서 기본값으로 삼았다(예외적으로 허용된 헤드리스 스크린샷
   * 한 번으로 확인). `core.setTune('asset3d.asianTower', 0)` 으로 끄면
   * 서양풍 Watchtower로 되돌아간다(코드를 걷어낼 필요가 없다).
   *
   * 같은 팩의 `Portal.glb`·`MainAltar.glb`는 2·3등급용으로 더 받으려다
   * 썸네일을 확인해 보니 각각 **병풍(폴딩 스크린)·낮은 제단 상자**로
   * 탑이 아니었다 — 채택하지 않았다.
   *
   * **2·3등급 완료(2026-09-23)** — 같은 저장소의 다른 프로젝트
   * "tomb-chaser-2"(일본풍 탑 팩, CC0)에서 기둥(`TempleColumn`)·지붕
   * 귀퉁이(`TempleRoof01Corner`) 둘만 받아 `tools/asset-forge/kitbash.py`
   * (`city_t2_asian`·`city_t3_asian` 레시피)로 조립했다 — 2등급은 1층
   * (기둥 4+지붕), 3등급은 그 위에 작은 2층을 더 얹어 좁아지는 탑 실루엣
   * (부품끼리 상대 배치·비율은 오프라인 3뷰 실루엣 비교로 먼저 확인,
   * 실제 화면·헤드리스 크롬과는 무관 — palette.py `preview`와 같은 성격).
   * 원본 텍스처가 그 프로젝트 특유의 네온(보라·시안)이라 그대로 못 써
   * `palette.py`에 새 `realm_asian_tower`(나무·기와 톤) 팔레트를 추가해
   * `snap-glb`로 물들인 뒤 커밋했다. 출력은
   * `assets/generated/buildings/city_t{2,3}_asian.glb`.
   */
  if (core && core.tuned('asset3d.asianTower', 1)) {
    register('city:t1', BLD + 'asian/BellStructure.glb');
    register('city:t2', 'assets/generated/buildings/city_t2_asian.glb');
    register('city:t3', 'assets/generated/buildings/city_t3_asian.glb');
  }

  function register(key, url) {
    if (!key) { return REG; }
    if (url) { REG[key] = url; } else { delete REG[key]; }
    return REG;
  }

  /** 이 사물을 어떤 키들로 찾아볼까 — 좁은 것부터 넓은 것 순. 순수 함수 */
  function keysFor(kind, ref) {
    var r = ref || {};
    if (!kind) { return []; }
    return [r.id ? kind + ':' + r.id : null, kind].filter(Boolean);
  }

  function lookup(kind, ref) {
    var ks = keysFor(kind, ref), i;
    for (i = 0; i < ks.length; i++) {
      if (REG[ks[i]]) { return { key: ks[i], url: REG[ks[i]] }; }
    }
    return null;
  }

  function hashOf(s) {
    s = String(s || '');
    var h = 0, i;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return h;
  }

  /** 표의 한 줄이 여럿이면 그중 하나를 고른다 — ref.id 해시로 늘 같은 것을 고른다
   *  (성 하나가 매번 다른 탑으로 바뀌면 화면이 산만해진다) */
  function oneOf(list, ref) {
    if (!list) { return null; }
    if (!Array.isArray(list)) { return list; }
    if (!list.length) { return null; }
    var seed = (ref && (ref.id || ref.seed)) || '';
    return list[hashOf(seed) % list.length];
  }

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
  /* 압축(EXT_meshopt_compression) GLB 는 디코더 없이 조용히 실패한다 — 사가의숲 asset3d.js 와 같은 요령(2026-09-23 tools/asset-audit 가 찾음) */
  function gltfLoader() {
    var t = three();
    if (!t || !t.GLTFLoader) { return null; }
    if (!loaderInst) {
      loaderInst = new t.GLTFLoader();
      if (t.MeshoptDecoder) { loaderInst.setMeshoptDecoder(t.MeshoptDecoder); }
    }
    return loaderInst;
  }

  function cloneScene(gltf) {
    var t = three();
    if (t.SkeletonUtils && t.SkeletonUtils.clone) { return t.SkeletonUtils.clone(gltf.scene); }
    return gltf.scene.clone(true);
  }

  /** Quaternius 모델은 PBR(metallic) 재질을 지고 오는데, 이 판에 환경맵이
   *  없으면 거의 새까맣게 선다. 빛깔만 남기고 Lambert 로 바꾼다 */
  function delam(root) {
    var t = three();
    var TN = global.DG.toon3d;
    var toon = !!(TN && TN.TOON_ON());
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      /* 법선이 아예 없는 GLB(2026-09-23 — 킷배싱 탑 city_t2·t3_asian, 스크린샷으로 확인): GLTFLoader 는 이때 flatShading 을 켜
         주지만 toonify 가 만드는 MeshToonMaterial 은 flatShading 을 안 받아(r169) 법선 0 → 통째로 새까맣다.
         사가블로 delam 이 2026-09-04 에 먼저 밟은 함정과 같은 처방 — 지오메트리에서 계산해 채운다 */
      if (o.geometry && o.geometry.attributes.position && !o.geometry.attributes.normal) { o.geometry.computeVertexNormals(); }
      var one = Array.isArray(o.material) ? o.material : [o.material];
      var out = one.map(function (m) {
        if (!m || (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial)) { return m; }
        /* 2026-09-17 — SAGA-DESIGN §6.1: 손잡이가 켜져 있으면 툰으로, 꺼지면 예전 Lambert */
        var nm;
        if (toon) { nm = TN.toonify(m); } else {
          /* vertexColors 를 안 옮기면(정점빛깔로 색을 주고 baseColorFactor 는
             검게 비워 둔 옷감이 있다) 그 자리가 조명과 무관하게 통째로 새까맣게
             뜬다 — 2026-09-03, 무장 초상에서 후드가 늘 새까맣던 원인 */
          nm = new t.MeshLambertMaterial({
            color: m.color ? m.color.clone() : new t.Color(0xffffff),
            map: m.map || null, vertexColors: !!m.vertexColors,
            transparent: !!m.transparent, opacity: m.opacity,
            alphaTest: m.alphaTest || 0, side: m.side
          });
        }
        /* 2026-09-25 — 새 재질은 이름을 잃는다. 원래 이름을 남겨 둔다(병사 `tintNamed` 가 장식 천만 고른다) */
        if (nm !== m) { nm.userData.srcName = m.name || ''; }
        return nm;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    /* 2026-09-23 — 외곽선: 스킨 메시가 있는 GLB(사람·짐승)만. 모델 안에서는 가장 큰 부품 반지름 기준 한 폭,
       그 12% 보다 작은 부품(눈·이빨)은 안 두른다(검은 점). VRoid 는 vroid-variant 가 이미 둘러 `_toonOutline` 로 건너뛴다.
       traverse 도중 자식을 더하지 않으려고 모아서 붙인다(사가스토리 delam 과 같다) */
    if (toon && TN.OUTLINE_ON && TN.OUTLINE_ON() && TN.outline) {
      var ms = [], maxR = 0, skinned = false;
      root.traverse(function (o) {
        if (!o.isMesh || !o.geometry || (o.userData && o.userData._toonOutline)) { return; }
        if (o.isSkinnedMesh) { skinned = true; }
        var mm = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!mm || mm.transparent) { return; }
        if (!o.geometry.boundingSphere) { o.geometry.computeBoundingSphere(); }
        var r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : 0;
        ms.push({ m: o, r: r });
        if (r > maxR) { maxR = r; }
      });
      if (skinned && maxR > 0) {
        ms.forEach(function (x) { if (x.r >= maxR * TN.OUTLINE_MIN_PART) { TN.outline(x.m, maxR * TN.OUTLINE_K); } });
      }
    }
  }

  var cache = {};   // url → { state: 'load'|'ok'|'fail', gltf, waiting: [cb] }
  var built = 0, broke = '';

  function flush(c, arg) {
    var w = c.waiting; c.waiting = [];
    for (var i = 0; i < w.length; i++) { w[i](arg); }
  }

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
      /* 2026-09-10 — `c.clips`가 여태 안 채워져 있었다. QRPG 장수 몸 파일은
         걷기·공격·사망 클립을 제 안에 이미 담고 있는데(위 HERO_RECIPES 주석),
         이 줄이 없으면 `buildHero()`의 `animC.clips.length` 검사가 늘 undefined
         라 실패해 mixer 를 한 번도 못 만들었다 — 사가블로 asset3d.js 의
         `acquire()`와 같은 줄을 그대로 가져왔다(그쪽은 이미 실전 검증됨) */
      c.clips = gltf.animations || [];
      /* 2026-09-23 — VRoid(unlit → MeshBasic)는 delam 이 안 보는 재질이라 명암 없이 평면으로 떴다.
         먼저 툰 + 오픈월드 RPG식 얼굴 그림자로 바꾼다(다섯 판 공용 vroid-variant.js) */
      if (global.DG.vroidVariant && global.DG.vroidVariant.shade) { global.DG.vroidVariant.shade(gltf.scene, url); }
      delam(gltf.scene);
      flush(c, c);
    }, undefined, function () {
      c.state = 'fail';
      broke = url;
      flush(c, null);
    });
  }

  /** 키 1 로 눕혀 담는다 — 실제 높이는 부르는 쪽이 `wrap.scale.setScalar()` 로 정한다 */
  function normalize(obj) {
    var t = three();
    obj.updateMatrixWorld(true);
    var b = new t.Box3().setFromObject(obj);
    var f = fit({ minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y, minZ: b.min.z, maxZ: b.max.z });
    var wrap = new t.Group();
    obj.scale.setScalar(f.scale);
    obj.position.set(f.dx, f.dy, f.dz);
    wrap.userData.span = { w: (b.max.x - b.min.x) * f.scale, d: (b.max.z - b.min.z) * f.scale, h: 1 };
    wrap.add(obj);
    return wrap;
  }

  /** 마지막 되돌림 자리 — GLB 가 안 되거나 아직 안 왔을 때도 화면엔 무언가는 선다 */
  function primitive(kind, ref) {
    var t = three();
    if (!t) { return null; }
    var g = new t.Group();
    var col = (ref && (ref.tint || ref.color)) || '#8a94a6';
    var TN = global.DG.toon3d;
    var m = TN ? TN.lambertLike({ color: new t.Color(col) }) : new t.MeshLambertMaterial({ color: new t.Color(col) });
    var body;
    if (kind && kind.indexOf('city') === 0) {
      body = new t.Mesh(new t.ConeGeometry(0.32, 1, 4), m);
      body.position.y = 0.5;
    } else if (kind === 'mount') {
      body = new t.Mesh(new t.ConeGeometry(0.5, 1, 6), m);
      body.position.y = 0.5;
    } else {
      body = new t.Mesh(new t.BoxGeometry(0.5, 0.5, 0.5), m);
      body.position.y = 0.25;
    }
    g.add(body);
    g.userData.span = { w: 0.6, d: 0.6, h: 1 };
    g.userData.primitive = true;
    return g;
  }

  var tintCache = {};

  /** 복제한 모델의 재질을 물들인다 — 원본은 안 건드린다(다른 성이 같이 쓴다) */
  function applyTint(model, hex) {
    var t = three();
    if (!hex || !t) { return model; }
    var tc = new t.Color(hex), TNc = global.DG.toon3d;
    /* 2026-09-23 — VRoid 몸이면 **옷(_CLOTH)에만** 세력 색을 입힌다. 예전엔 피부·얼굴·눈·머리까지 통째로 곱해
       초상 얼굴이 세력 색으로 어둡게 물들었다(스크린샷). 외곽선(ShaderMaterial)은 건너뛰고, 복제는 cloneMat 으로 —
       기본 clone() 은 얼굴 그림자·림 셰이더를 떨군다 */
    var vroid = false;
    model.traverse(function (o) {
      var m0 = o.isMesh && o.material && (Array.isArray(o.material) ? o.material[0] : o.material);
      if (m0 && /_CLOTH|_SKIN|_HAIR/.test(m0.name || '')) { vroid = true; }
    });
    model.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      var src = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!src || !src.color || src.isShaderMaterial) { return; }
      if (vroid && !/_CLOTH/.test(src.name || '')) { return; }
      /* 2026-09-23 — 텍스처가 있는 **건물**(비스킨)은 세력 색을 절반만 섞는다. 통째로 곱하면 어두운 나무·기와 텍스처가
         남색·검붉은 덩어리가 되어 결이 사라졌다(국토 지도 스크린샷, 동양풍 탑). 인물 옷은 그대로(초상과 같게) */
      var soft = !!src.map && !o.isSkinnedMesh;
      var key = (src.uuid || '') + '|' + hex + (soft ? '|s' : '');
      if (!tintCache[key]) {
        var m = TNc && TNc.cloneMat ? TNc.cloneMat(src) : src.clone();
        var tk = soft ? new t.Color(0xffffff).lerp(tc, (core && core.tuned ? core.tuned('asset3d.texTint', 0.5) : 0.5)) : tc;
        m.color = new t.Color(src.color ? src.color.getHex() : 0xffffff).multiply(tk);
        tintCache[key] = m;
      }
      o.material = tintCache[key];
    });
    return model;
  }

  /** 세력 깃발 — 성채 옆에 배너를 꽂는다. `ref.flag` 가 있을 때만 */
  function addFlag(wrap, color) {
    var t = three();
    if (!t || !color || !wrap) { return wrap; }
    var span = (wrap.userData && wrap.userData.span) || { w: 1, d: 1, h: 1 };
    var h = span.h || 1;
    var x = span.w / 2 + h * 0.08, z = -(span.d / 2) - h * 0.06;
    var poleH = h * 1.08;
    var TN = global.DG.toon3d;
    var pole = new t.Mesh(
      new t.CylinderGeometry(h * 0.015, h * 0.015, poleH, 5),
      TN ? TN.lambertLike({ color: 0x6b5533 }) : new t.MeshLambertMaterial({ color: 0x6b5533 })
    );
    pole.position.set(x, poleH / 2, z);
    wrap.add(pole);
    var fw = h * 0.26, fh = h * 0.38;
    var cloth = new t.Mesh(
      new t.BoxGeometry(fw, fh, h * 0.01),
      TN ? TN.lambertLike({ color: new t.Color(color) }) : new t.MeshLambertMaterial({ color: new t.Color(color) })
    );
    cloth.position.set(x + fw / 2, poleH - fh * 0.6, z);
    wrap.add(cloth);
    return wrap;
  }

  /**
   * 이 인물의 몸·옷·머리 조합 — 표에 조합 객체가 있을 때만 준다.
   *
   * **2026-09-10 — `ref.monster`(무장 데이터의 실제 CC0 몬스터 GLB 경로,
   * `data-force.js` FUTURE_OFFICERS 참고)가 있으면 그 파일 하나를 몸이자
   * 몸짓(anim)으로 그대로 준다.** MPFB 초상 몸(위 `PEOPLE_MPFB` 머리말)이
   * 이미 "몸 파일 자신을 anim으로 준다" 요령을 쓰고 있어 그대로 옮겼다 —
   * 몬스터 GLB 는 이미 자기 스켈레톤에 idle·attack·death 등 클립이 다
   * 박혀 있어(그 팩 자체가 그렇게 만들어졌다) 옷·머리 조합이 필요 없다.
   * `assembleHero()`가 outfit·hair 없이도 몸 하나만으로 이미 잘 도는
   * 구조라 새 코드 없이 이 한 줄만으로 충분하다.
   */
  function heroRecipe(ref) {
    if (ref && ref.monster) { return { body: ref.monster, anim: ref.monster }; }
    /* 시간 틈 사람(§5-12) — 제 시대 옷 몸(`body`, 제 클립 내장). 애니메 몸으로 바꾸지 않는다 */
    /* W-0074 — 사람 몸(people/ 아래 folk 옷)은 시대 구분 없이 VRoid 통일 몸으로(빌린 몸) */
    var A3U = global.DG.assets3d, human = ref && ref.body && ref.body.indexOf('/people/') >= 0;
    if (ref && ref.body && !human) { return { body: ref.body, anim: ref.body }; }
    var urec = A3U && (A3U.heroRecipe(ref) || A3U.borrowRecipe(ref));   // 통일 GLB(W-0021), 제 몸 없으면 빌린 몸(W-0074)
    if (urec) { return urec; }
    if (human) { return { body: ref.body, anim: ref.body }; }
    if (wantsAnimeAvatar()) {
      var arec = oneOf(HERO_RECIPES_ANIME, ref);
      if (arec) { return arec; }
    }
    var h = lookup('hero', ref);
    if (!h) { return null; }
    var v = oneOf(h.url, ref);
    return (v && typeof v === 'object' && v.body) ? v : null;
  }

  /**
   * 몸+옷+머리 셋을 한 뼈대로 묶는다 — 넷(anim 포함)이 같은 뼈대(65뼈, 이름까지
   * 동일)라 옮겨 입히기(retarget)가 필요 없다(다른 네 판과 같은 규칙).
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

    return normalize(bodyScene);
  }

  /** 무기 look → REG 키. 실물이 없는 것은 가까운 것으로 재사용한다
   *  (사가블로 `dungeon3d.js` `attachWeapon()`과 같은 판단: halberd·guandao
   *  는 spear, fan 은 brush) */
  var WPN_ALIAS = { halberd: 'spear', guandao: 'spear', fan: 'brush' };
  /** 무기 길이 — 몸 키 1 기준 배율(사가블로 `WPN_MUL`을 이 판 단위계로 옮김) */
  var WPN_MUL = { club: 0.35, axe: 0.42, sword: 0.46, spear: 0.85, halberd: 0.85,
    guandao: 0.85, staff: 0.62, bow: 0.42, scroll: 0.28, fan: 0.28, brush: 0.28 };
  /** 투구 look → REG 키. plume(장식 깃)은 대응 CC0가 없어 helmet으로 대신한다 */
  var HELM_ALIAS = { plume: 'helmet' };
  var HELM_MUL = { helmet: 0.24, crown: 0.22, gapju: 0.26 };

  /**
   * 장수 3D 초상(`portrait3d.js`)에 무기·투구를 얹는다 — `sprite.lookOf()`가
   * 매기는 것과 같은 표를 쓴다. 2026-09-05, 사용자 지시("초상화를 더 가져올
   * 수 있나, 맞출 필요 없이 있으면 교체")에 따라 새로 받지 않고 사가블로가
   * 이미 갖춘 CC0/CC-BY 무기·장구(`assets/models/{weapons,gear}/`, 복사해
   * 왔다 — 출처는 `assets/ASSET_LICENSES.md`)를 그대로 붙인다.
   *
   * `body`는 이미 `normalize()`를 거친 wrap(키 1, 바닥 y=0, `userData.span`)
   * 이다 — 무기·투구도 각자 `normalize()`로 키 1로 맞춘 뒤 배율만 줄여
   * **바닥이 0** 규약(dungeon3d.js `wornGear`와 같다)으로 그 위에 얹는다.
   * scholar·gat·hairpin·monk·braid 등 대응 CC0가 없는 투구는 조용히
   * 건너뛴다 — 맨몸도 이미 실제 3D 모델이라 화면이 비지는 않는다.
   */
  function attachAccessories(body, ref, done) {
    /* 몬스터(ref.monster)는 사람 몸이 아니라 무기·투구를 얹을 자리(손·머리
       위치 가정)가 안 맞는다 — 애초에 자기 모습 그대로가 맞다 */
    if (ref && (ref.monster || ref.body)) { done(); return; }   // 시간 틈 사람(`body`)도 옷이 곧 그 사람이다
    var t = three();
    var S = global.DG.sprite;
    var look = (S && S.lookOf) ? S.lookOf(ref) : null;
    if (!t || !look) { done(); return; }
    var span = (body.userData && body.userData.span) || { w: 0.5, h: 1 };
    var jobs = 0, finished = false;
    function one() { jobs--; if (jobs <= 0 && !finished) { finished = true; done(); } }

    var wKey = WPN_ALIAS[look.weapon] || look.weapon;
    if (wKey && wKey !== 'none' && REG['wpn:' + wKey]) {
      jobs++;
      acquire(REG['wpn:' + wKey], function (c) {
        if (c && c.gltf) {
          try {
            var mul = WPN_MUL[look.weapon] || 0.5;
            var m = normalize(cloneScene(c.gltf));
            m.scale.setScalar(mul);
            m.position.set(span.w * 0.5 + 0.06, 0.5, 0.08);
            body.add(m);
          } catch (e) { /* 무기 하나 실패해도 몸은 그대로 나온다 */ }
        }
        one();
      });
    }

    var hKey = HELM_ALIAS[look.helm] || look.helm;
    /* 2026-09-23 — VRoid(애니) 몸엔 투구를 안 씌운다: QRPG 머리에 맞춘 투구가 애니 머리 위에선 얼굴까지 덮는
       회색·빨강 상자로 떴다(초상 스크린샷). 애니 인물은 머리 모양·색이 곧 얼굴이다 */
    var vroidBody = !!(body.userData && body.userData.vrmFront);
    if (!vroidBody && hKey && hKey !== 'none' && REG['gear:' + hKey]) {
      jobs++;
      acquire(REG['gear:' + hKey], function (c) {
        if (c && c.gltf) {
          try {
            var hmul = HELM_MUL[hKey] || 0.22;
            var hm = normalize(cloneScene(c.gltf));
            hm.scale.setScalar(hmul);
            hm.position.set(0, 0.86, 0);
            body.add(hm);
          } catch (e) { /* 투구 하나 실패해도 몸은 그대로 나온다 */ }
        }
        one();
      });
    }

    if (jobs === 0) { done(); }
  }

  /**
   * 사람 하나를 조합형으로 세운다(비동기, 콜백 방식) — 이 판은 인물이 걸어
   * 다니지 않아 여태 없었던 자리다. **지금은 `portrait3d.js`(도감 초상 굽기)
   * 만 이걸 부른다** — 언젠가 3D로 걷는 화면이 생기면 몸짓(mixer)도 그대로 쓴다.
   */
  function buildHero(ref, tintHex, cb) {
    var t = three();
    var rec = heroRecipe(ref);
    if (!rec || !t) { cb(null); return; }

    var parts = {}, pending = 4;
    var own = !rec.anim && wantsOwnAnim(rec.body);   // VRM 몸 → 자체 몸짓(UAL1 을 받으러 가지 않는다)
    function onOne() { pending--; if (pending === 0) { assemble(); } }
    acquire(rec.body, function (c) { parts.body = c; onOne(); });
    /* outfit·hair 는 조합형(옛 Quaternius) 레시피에만 있다 — QRPG 통짜 스킨은
       둘 다 없으니 헛수고로 받으러 가지 않고 바로 다음 칸으로 넘어간다 */
    if (rec.outfit) { acquire(rec.outfit, function (c) { parts.outfit = c; onOne(); }); } else { onOne(); }
    if (rec.hair) { acquire(rec.hair, function (c) { parts.hair = c; onOne(); }); } else { onOne(); }
    if (own) { onOne(); } else { acquire(rec.anim || ANIM_SRC, function (c) { parts.anim = c; onOne(); }); }

    function assemble() {
      if (!parts.body) { cb(null); return; }
      var model;
      try {
        model = assembleHero(parts);
        applyVroid(model, rec, ref && ref.id);
        if (tintHex) { applyTint(model, tintHex); }
      } catch (e) {
        broke = (e && e.message) ? e.message : 'hero assemble 실패';
        cb(null);
        return;
      }
      built++;
      var animC = parts.anim;
      if (own) {
        /* 몸이 조립된 장면에서 실제 뼈를 읽어 그 몸에 맞춰 굽는다 — 몸마다 한 번(캐시). 못 만들면 UAL1 길로 되돌아간다 */
        if (!parts.body.ownClips) { parts.body.ownClips = global.DG.ownAnim.clipsFor(model, t) || []; }
        if (parts.body.ownClips.length) {
          var oc = parts.body.ownClips, om = new t.AnimationMixer(model.children[0]), oa = {}, oi;
          for (oi = 0; oi < oc.length; oi++) { oa[oc[oi].name] = om.clipAction(oc[oi]); }
          model.userData.mixer = om;
          model.userData.actions = oa;
          model.userData.clipMap = mapClips(oc.map(function (a) { return a.name; }));
          model.userData.ownAnim = true;
          animC = null;                              // 아래 UAL1 길은 건너뛴다
        } else {
          own = false;
          acquire(ANIM_SRC, function (c) { parts.anim = c; assemble(); });
          return;
        }
      }
      if (animC && animC.clips && animC.clips.length) {
        var clips = animC.clips;
        var mx = new t.AnimationMixer(model.children[0]);
        var acts = {}, ci;
        for (ci = 0; ci < clips.length; ci++) { acts[clips[ci].name] = mx.clipAction(clips[ci]); }
        model.userData.mixer = mx;
        model.userData.actions = acts;
        model.userData.clipMap = mapClips(clips.map(function (c) { return c.name; }));
      }
      /* 무기·투구는 세력색을 입지 않는다(제 빛깔이 맞다) — tint 뒤에 붙인다 */
      attachAccessories(model, ref, function () { cb(model); });
    }
  }

  /* ── 병사(2026-09-25, `tools/asset-audit/CHARACTER_UNIQUENESS.md` ⑤ 빈칸) ────────────────────────
   * 지도 원정군(`realm3d.js`)·전투 무리(`battle3d.js`)의 병사가 원기둥·구·상자 도형이었다. Quaternius CC0 두 벌을
   * 사가블로에서 md5 그대로 복사해 쓴다 — 보병 = Ultimate Animated Character Pack `Knight_Male`(걷기·대기·치기·
   * 쓰러짐 클립 내장), 기병 = 같은 기사가 Farm Animal Pack `Horse_Farm`(걷기·대기) 위에 `SitDown` 끝 자세로 앉는다.
   * 세력 색은 기사 장식 천(`Red` 재질)에만 — 갑옷·피부는 제 빛깔. 창은 장수와 같은 `wpn:spear` 를 오른편에 세운다.
   * 병사는 이름 없는 무리라 한 벌을 나눠 입는다(인물이 아니다). 몸을 못 받으면 cb(null) — 부르는 쪽이 옛 도형을 둔다 */
  var TROOP_DIR = 'assets/models/troops/';
  var TROOPER = { body: TROOP_DIR + 'Knight_Male.glb', horse: TROOP_DIR + 'Horse_Farm.glb' };
  var TROOP_TINT = /^Red$/;
  var HORSE_H = 1.2;        // 말 키(머리 끝) — 사람 키 1 기준
  var SPEAR_H = 1.3;        // 창 길이 — 사람(머리 큰 저폴리, 키 1)보다 조금 길게, 땅에 짚는다

  /** 이름이 `re` 에 맞는 재질만 `hex` 로 바꾼다(곱하지 않는다 — 빨강 × 남색 = 검정). 원래 이름은 delam 이 남긴 `srcName` */
  function tintNamed(model, hex, re) {
    var t = three(), TNc = global.DG.toon3d, n = 0;
    model.traverse(function (o) {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) { return; }
      var src = o.material;
      var nm = (src.userData && src.userData.srcName !== undefined) ? src.userData.srcName : (src.name || '');
      if (!src.color || src.isShaderMaterial || !re.test(nm)) { return; }
      var key = (src.uuid || '') + '|' + hex + '|named';
      if (!tintCache[key]) {
        var m = TNc && TNc.cloneMat ? TNc.cloneMat(src) : src.clone();
        m.color = new t.Color(hex);
        tintCache[key] = m;
      }
      o.material = tintCache[key];
      n++;
    });
    return n;
  }
  /** 클립 목록으로 mixer·동작표를 단다(buildHero 와 같은 모양 — `play`·`step` 이 그대로 돈다) */
  function withMixer(model, clips) {
    var t = three();
    if (!clips || !clips.length) { return model; }
    var mx = new t.AnimationMixer(model.children[0]), acts = {}, i;
    for (i = 0; i < clips.length; i++) { acts[clips[i].name] = mx.clipAction(clips[i]); }
    model.userData.mixer = mx;
    model.userData.actions = acts;
    model.userData.clipMap = mapClips(clips.map(function (c) { return c.name; }));
    return model;
  }
  function boneOf(root, name) {
    var hit = null;
    root.traverse(function (o) { if (!hit && o.isBone && o.name === name) { hit = o; } });
    return hit;
  }
  /** 기수를 앉힌다 — SitDown 끝 자세로 멈추고, 엉덩이 뼈를 말 등(엉덩이·어깨 뼈 사이 55%, 몸통 반지름만큼 위)에 맞춘다 */
  function seatRider(g, horse, man) {
    var t = three(), u = man.userData;
    var sit = u.actions && u.clipMap && u.actions[findClip(u.actions, /sitdown/)];
    if (sit) {
      sit.setLoop(t.LoopOnce, 1);
      sit.clampWhenFinished = true;
      sit.reset().play();
      u.mixer.update(sit.getClip().duration + 0.01);
    }
    g.updateMatrixWorld(true);
    var hh = boneOf(horse, 'Hips'), hs = boneOf(horse, 'Shoulders'), mh = boneOf(man, 'Hips');
    if (!hh || !hs || !mh) { man.position.set(0, HORSE_H * 0.5, 0); return; }
    var a = hh.getWorldPosition(new t.Vector3()), b = hs.getWorldPosition(new t.Vector3());
    var seat = a.lerp(b, 0.55);
    seat.y += HORSE_H * 0.1;
    var hip = mh.getWorldPosition(new t.Vector3());
    man.position.add(seat.sub(hip));
    man.userData.seated = true;
  }
  function findClip(actions, re) {
    var k;
    for (k in actions) { if (actions.hasOwnProperty(k) && re.test(normName(k))) { return k; } }
    return null;
  }
  /**
   * 병사 한 명(비동기). kind 'inf'(보병) | 'cav'(기병). 돌려주는 그룹은 키 1(기병은 말 키 HORSE_H), 바닥 y=0,
   * 앞 = +z. `userData.mixer` 가 있어 `step(g, {anim:'walk'|'idle'|'attack'…})` 로 몸짓한다(기병은 말이 걷고 기수는 앉은 채)
   */
  function buildTrooper(kind, tintHex, cb) {
    var t = three();
    if (!t) { cb(null); return; }
    var got = {}, need = kind === 'cav' ? 3 : 2;
    function one() { need--; if (need === 0) { done(); } }
    acquire(TROOPER.body, function (c) { got.body = c; one(); });
    if (REG['wpn:spear']) { acquire(REG['wpn:spear'], function (c) { got.spear = c; one(); }); } else { one(); }
    if (kind === 'cav') { acquire(TROOPER.horse, function (c) { got.horse = c; one(); }); }
    function done() {
      var g;
      try { g = assembleTrooper(kind, got, tintHex); } catch (e) {
        broke = (e && e.message) ? e.message : 'trooper 실패';
        g = null;
      }
      if (g) { built++; }
      cb(g);
    }
  }
  /** 받아 둔 몸·말·창(`{body, horse, spear}` — acquire 캐시 원소, `{gltf, clips}`)을 병사 하나로 묶는다(동기, 진단이 가짜 뼈대로 부른다) */
  function assembleTrooper(kind, got, tintHex) {
    var t = three();
    if (!got || !got.body || !got.body.gltf) { return null; }
    var man = normalize(cloneScene(got.body.gltf)), g = man;
    if (tintHex) { tintNamed(man, tintHex, TROOP_TINT); }
    withMixer(man, got.body.clips);
    if (got.spear && got.spear.gltf) {
      /* 오른손(앞 +z 를 보므로 -x 쪽, 뼈 `FistR`) 자리에 세워 땅을 짚는다 — 걸을 때 팔 흔들림은 지도 거리에선 안 보인다 */
      var sp = normalize(cloneScene(got.spear.gltf)), fist = boneOf(man, 'FistR'), fp = null;
      if (fist) { man.updateMatrixWorld(true); fp = man.worldToLocal(fist.getWorldPosition(new t.Vector3())); }
      sp.scale.setScalar(SPEAR_H);
      sp.position.set(fp ? fp.x : -0.15, 0, fp ? fp.z : 0.05);
      man.add(sp);
    }
    if (kind === 'cav' && got.horse && got.horse.gltf) {
      var horse = withMixer(normalize(cloneScene(got.horse.gltf)), got.horse.clips);
      horse.scale.setScalar(HORSE_H);
      g = new t.Group();
      g.add(horse);
      g.add(man);
      seatRider(g, horse, man);
      /* 몸짓은 말이 한다 — 기수 mixer 는 앉은 자세로 한 번 굴리고 끝 */
      g.userData.mixer = horse.userData.mixer;
      g.userData.actions = horse.userData.actions;
      g.userData.clipMap = horse.userData.clipMap;
      g.userData.rider = man;
      g.userData.horse = horse;
    }
    g.userData.trooper = g !== man ? 'cav' : 'inf';
    return g;
  }

  /**
   * GLB 를 불러 세운다(비동기). 실패하거나 three/GLTFLoader 가 없으면
   * **조용히 도형으로 떨어진다** — 부르는 쪽은 항상 그룹 하나를 받는다.
   * `ref.tint` 를 주면 색을 입히고, `ref.flag` 를 주면 세력 깃발을 꽂는다.
   */
  function build(kind, ref, cb) {
    function finish(wrap) {
      if (!wrap) { cb(null); return; }
      if (ref && ref.tint) { applyTint(wrap, ref.tint); }
      if (ref && ref.flag) { addFlag(wrap, ref.flag); }
      cb(wrap);
    }
    function fallback() { finish(primitive(kind, ref)); }

    var hit = lookup(kind, ref);
    if (!hit) { fallback(); return; }
    var url = oneOf(hit.url, ref);
    if (!url || typeof url !== 'string') { fallback(); return; }
    acquire(url, function (c) {
      if (!c || !c.gltf) { fallback(); return; }
      built++;
      finish(normalize(cloneScene(c.gltf)));
    });
  }

  /** 한 프레임 재생 — `model`은 `buildHero()`가 돌려준 그 그룹(`userData.mixer`
   *  등을 직접 지고 있다, 사가블로처럼 따로 감싼 shell이 없다). mixer 가 없는
   *  모델(클립 0개, 또는 애초에 GLB 가 아니라 도형으로 떨어진 것)이면 아무
   *  것도 안 하고 false — 부르는 쪽이 실패를 몰라도 되게 한다 */
  /* 한 번만 재생하고 마지막 자세에서 멈추는 슬롯 — 기본 LoopRepeat 이면
     클립이 끝나자마자 처음부터 다시 돌아, 이를테면 죽은 장수가 잠깐 뒤
     되살아났다 다시 쓰러지는 것처럼 보인다(2026-09-10, "모션도 리얼해야"
     지적으로 드러난 것). idle·walk·run 등은 원래대로 반복해야 자연스러워
     그대로 둔다. */
  var ONE_SHOT = { attack: true, hit: true, death: true, interaction: true, dodge: true };
  /**
   * @param force  같은 슬롯을 다시 요청해도 처음부터 다시 튼다(2026-09-11).
   *   `u.anim === slot` 이면 원래 아무 것도 안 하는데, `attack`·`hit` 처럼
   *   **매 합(라운드)마다 반복돼야 하는 원샷 동작**은 그러면 안 된다 — 예를
   *   들어 일기토에서 같은 쪽이 두 합 연속 맞으면(hit→hit) 두 번째 합은
   *   `u.anim`이 이미 'hit'이라 재생을 걸지 않고 첫 합의 clamp된 정지
   *   자세 그대로 멈춰 있었다(위 "되살아나는" 버그를 고치며 생긴 부작용 —
   *   부르는 쪽(`battle3d.js`)이 "새 합이다"를 알 때만 `force`를 준다).
   */
  function play(model, slot, force) {
    var u = model && model.userData;
    if (!u || !u.mixer) { return false; }
    var name = u.clipMap && u.clipMap[slot];
    var next = name && u.actions[name];
    if (!next) { return false; }
    if (u.anim === slot && !force) { return true; }
    var prev = u.anim && u.clipMap[u.anim] && u.actions[u.clipMap[u.anim]];
    var t = three();
    if (ONE_SHOT[slot]) {
      next.setLoop(t.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(t.LoopRepeat);
      next.clampWhenFinished = false;
    }
    next.reset().play();
    if (prev && prev !== next) { prev.crossFadeTo(next, 0.15, false); }
    u.anim = slot;
    return true;
  }
  function step(model, o) {
    var u = model && model.userData;
    if (!u || !u.mixer) { return false; }
    var want = (o && o.anim) || 'idle';
    play(model, want, o && o.force);
    var t = (o && o.t) || 0;
    var dt = u.lastT === undefined ? 0 : Math.max(0, Math.min(0.25, t - u.lastT));
    u.lastT = t;
    u.mixer.update(dt);
    return true;
  }

  global.DG = global.DG || {};
  global.DG.asset3d = {
    register: register,
    restore: restore,
    lookup: lookup,
    keysFor: keysFor,
    oneOf: oneOf,
    build: build,
    heroRecipe: heroRecipe,
    buildHero: buildHero,
    buildTrooper: buildTrooper, assembleTrooper: assembleTrooper,
    TROOPER: TROOPER,
    mapClips: mapClips,
    play: play,
    step: step,
    ANIM_SRC: ANIM_SRC,
    /** 진단 전용 — VRM 애니메 아바타 손잡이·레시피 조회(2026-09-20) */
    wantsAnimeAvatar: wantsAnimeAvatar, wantsOwnAnim: wantsOwnAnim,
    heroRecipesAnime: function () { return HERO_RECIPES_ANIME; },
    primitive: primitive,
    three: three,
    REG: function () { return REG; },
    stats: function () { return { built: built, broke: broke }; }
  };
})(window);
