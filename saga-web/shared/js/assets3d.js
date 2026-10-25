/**
 * 통일 3D 에셋 조회 한 곳 (W-0021) — 건물·지물·지형·탈것(`world3d/<id>.glb`)과 인물 몸(`characters3d/<영웅id>.glb`).
 *
 * **정본은 saga-web/shared/js/assets3d.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 파일은 자체툴(K-0017·K-0024)이 `saga-web/shared/assets/` 한 벌로 놓는다 — 판마다 복사하지 않는다(몸만 174MB).
 *   공개 페이지·`file:` 은 `../shared/assets/`, 로컬 서버(tools/serve-game.mjs)는 `_shared/assets/` — 둘을 차례로 시험해 되는 쪽을 쓴다.
 *   (`DG.cfg.assets3d.base` 로 고정할 수도 있다)
 *
 * **못 찾았거나 아직 시험 중이면 `url()` 은 null** — 부르는 쪽이 옛 모델 경로로 간다(오류 0·기존 동작 그대로).
 * 어느 영웅·지물에 GLB 가 있나는 `assets3d-ids.js`(tools/gen-assets3d-ids.mjs 가 폴더에서 생성) 표가 안다.
 * 끄는 손잡이: `core.tuned('assets3d.on', 1)` 이 0 이면 늘 null.
 */
(function (global) {
  'use strict';

  var state = 'init', root = null, sets = null;      // init → probing → ok | fail

  function cfg() { return (global.DG && global.DG.cfg && global.DG.cfg.assets3d) || {}; }
  function ids() { return (global.DG && global.DG.assets3dIds) || { hero: [], world: [] }; }
  function set(kind) {
    if (!sets) {
      sets = { hero: {}, world: {}, world2d: {}, creature: {} };   // creature — 자체 동물·탈것(K-0096, W-0163)   // world2d — GLB 짝 없는 2D 그림(W-0114)
      var t = ids(), k, i;
      for (k in sets) { for (i = 0; i < (t[k] || []).length; i++) { sets[k][t[k][i]] = 1; } }
    }
    return sets[kind] || {};
  }

  /** 시험할 기준 주소들 — 공개 페이지·file: 은 `../shared/` 를 먼저, 로컬 서버는 `_shared/` 를 먼저 */
  function bases() {
    var c = cfg(); if (c.base) { return [c.base]; }
    var L = global.location || {}, pub = L.protocol === 'file:' || /github\.io$/.test(L.hostname || '');
    var a = '../shared/assets/', b = '_shared/assets/';
    return pub ? [a, b] : [b, a];
  }

  /** 한 번만 — 기준 주소 후보를 차례로 두드려 되는 쪽을 정한다(작은 출처 파일 하나) */
  function probe() {
    if (state !== 'init') { return; }
    /* W-0074 — 동기 한 번으로 정한다. 비동기로 두면 시험이 끝나기 전에 세운 사람(부팅 직후 주민·주인공)이 url() null 을 받아
       옛 몸(VRoid 샘플·QRPG·mpfb)으로 서 버리고 다시 안 바뀌었다(사가마을 주민·주인공에서 확인). 작은 출처 파일 하나·부팅 때 한 번뿐 */
    if (global.XMLHttpRequest) {
      var sl = bases(), si;
      for (si = 0; si < sl.length; si++) {
        try {
          var x = new global.XMLHttpRequest();
          x.open('GET', sl[si] + 'world3d/altar_01.license.json', false); x.send();
          if (x.status >= 200 && x.status < 300) { root = sl[si]; state = 'ok'; whenLoaded(applyProps); return; }
        } catch (e) { /* file: 등 — 다음 후보 */ }
      }
      state = 'fail'; return;
    }
    if (!global.fetch) { state = 'fail'; return; }
    state = 'probing';
    var list = bases(), i = 0;
    (function next() {
      if (i >= list.length) { state = 'fail'; return; }
      var b = list[i++];
      global.fetch(b + 'world3d/altar_01.license.json').then(function (r) {
        if (r && r.ok) { root = b; state = 'ok'; whenLoaded(applyProps); } else { next(); }
      })['catch'](next);
    })();
  }

  function whenLoaded(f) {
    if (!global.document || global.document.readyState === 'complete') { setTimeout(f, 0); return; }
    /* W-0264 — load(그림까지 다 받은 뒤)만 기다리면 판 부팅(DOMContentLoaded)이 3D 지도·소품을 먼저 지어 옛 빌린 GLB 를 받았다(5천하 성벽·창).
       같은 DOMContentLoaded 에 먼저 걸어(등록 순서) 부팅 전에 얹고, 뒤 묶음을 async 로 싣는 판을 위해 load 에 한 번 더(다시 얹어도 같은 표) */
    if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', f); }
    global.addEventListener('load', f);
  }

  /**
   * 판별 소품 표(`DG.cfg.assets3d.prop` = { 소품이름: [world3d id…] })를 사가만리 `prop3d` 의 등록 표에 얹는다 — 있는 자리만 바꾼다
   * (집·등롱·우물…). 시험이 ok 일 때만, 표에 있는 id 가 실제 GLB 일 때만. 안 되면 옛 표 그대로. 얹은 뒤 미리 받기를 한 번 더 부른다.
   */
  function applyProps() {
    return applyProp3d() + applyReg();
  }

  /** 판별 배우·소품 표(`DG.cfg.assets3d.reg` = { asset3d 키: [world3d id…] })를 `asset3d.register` 로 얹는다(사가나락 — 키마다 한 줄 표). 같은 규칙: 되는 id 만 */
  function applyReg() {
    var A3 = global.DG && global.DG.asset3d, t = cfg().reg, key, list, i, urls, n = 0;
    if (!A3 || !A3.register || !t || !tunedOn()) { return 0; }
    for (key in t) {
      if (!t.hasOwnProperty(key)) { continue; }
      list = t[key]; urls = [];
      for (i = 0; i < list.length; i++) { var u = url('world', list[i]); if (u) { urls.push(u); } }
      if (urls.length) { A3.register(key, urls.length === 1 ? urls[0] : urls); n++; }   // 한 칸이면 문자열 그대로(옛 표기와 같은 꼴)
    }
    return n;
  }

  function applyProp3d() {
    var P3 = global.DG && global.DG.prop3d, t = cfg().prop, name, list, i, urls, n = 0;
    if (!P3 || !P3.register || !t || !tunedOn()) { return 0; }
    for (name in t) {
      if (!t.hasOwnProperty(name)) { continue; }
      list = t[name]; urls = [];
      for (i = 0; i < list.length; i++) { var u = url('world', list[i]); if (u) { urls.push(u); } }
      if (urls.length) {
        P3.register(name, 'all', urls); n++;
        /* W-0260 — 철마다 따로 든 칸(사가만리 나무 autumn·winter)도 같은 목록으로 — 'all' 만 바꾸면 가을·겨울에 옛 빌린 GLB 가 돌아온다 */
        var e = P3.register()[name];
        if (e) { ['spring', 'summer', 'autumn', 'winter'].forEach(function (sk) { if (e[sk]) { P3.register(name, sk, urls); } }); }
      }
    }
    if (n && P3.preload) { P3.preload(); }
    return n;
  }

  function tunedOn() {
    var C = global.DG && global.DG.core;
    return !(C && C.tuned && !C.tuned('assets3d.on', 1));
  }

  /** 통일 GLB 주소 — kind 'hero'(영웅 id) · 'world'(건물·지물·지형·탈것 id). 없으면 null */
  function url(kind, id) {
    if (state === 'init') { probe(); }
    if (state !== 'ok' || !id || !tunedOn() || !set(kind)[id]) { return null; }
    return root + (kind === 'hero' ? 'characters3d/' : kind === 'creature' ? 'creatures3d/' : 'world3d/') + id + '.glb';
  }

  /** W-0163 — 빌린 동물·탈것 GLB(Poly CC-BY·Quaternius·"Charlie" 슬라임) 경로 → 자체판 `creatures3d/<id>.glb`. 짝이 없거나 공용 주소를 못 잡으면 null(부르는 쪽이 옛 경로).
   *  짝 표는 tools/ai-art/remote3d/k96_targets.json `borrowed` 와 같다. 손잡이 `assets3d.creature` 0 = 옛 빌린 모델 */
  var CREATURE_OF = { Tiger: 'tiger', Bear: 'bear', Panda: 'panda', Monkey: 'monkey', Boar: 'boar', Owl: 'owl', Crane: 'crane', Elephant: 'elephant',
    Rabbit: 'rabbit', Squirrel: 'squirrel', Duck: 'duck', Bird: 'sparrow', SlimeEnemy: 'slime', Wizard: 'hat_wizard',   /* W-0441 standin/Wizard(Quaternius CC-BY, 고깔도사 대역) → 자체판 — 2나락 crea:hat_wizard 와 같은 몸 */
    Horse: 'horse', White_Horse: 'horse_white', Horse_White: 'horse_white', Horse_Farm: 'horse_farm', Donkey: 'donkey', Zebra: 'zebra',
    /* W-0178 — K-0096 ③ 들·집 짐승·공룡 26 · ④ 괴물(Ultimate Monsters·2nd pack·로봇·우주) 24(cat_monster ✗ 는 K 산출에 없음) */
    Fox: 'fox', Wolf: 'wolf', Deer: 'deer', Stag: 'stag', Cow: 'cow', Cow_Farm: 'cow_farm', Bull: 'bull', Sheep: 'sheep', Pig: 'pig', Llama: 'llama',
    Alpaca: 'alpaca', Cat: 'cat', ShibaInu: 'shiba', Husky: 'husky', Pug: 'pug', Frog: 'frog', Snake: 'snake', Snake_angry: 'snake', Worm: 'worm',
    Pigeon: 'pigeon', Birb: 'birb', Velociraptor: 'raptor', T_Rex: 'trex', Trex: 'trex', Triceratops: 'triceratops', Stegosaurus: 'stegosaurus',
    Parasaurolophus: 'parasaurolophus', Apatosaurus: 'apatosaurus',
    Mushnub: 'mushnub', Dino: 'dino_pet', Squidle: 'squidle', Glub: 'glub', Glub_Evolved: 'glub_evolved', Bunny: 'bunny', Monkroose: 'monkroose',
    Pink_Slime: 'pink_slime', Ghost: 'ghost', Alpaking: 'alpaking', Dragon: 'dragon', Dragon_Evolved: 'dragon_evolved', Goleling: 'goleling',
    Goleling_Evolved: 'goleling_evolved', Hywirl: 'hywirl', Ghost_Skull: 'ghost_skull', Rat: 'rat', Wasp: 'wasp', Spider: 'spider',
    FrogEnemy: 'frog_brute', Robot_Drone: 'robot_drone', Robot_Walker: 'robot_walker', Robot_Large: 'robot_large', EnemySmall: 'space_bug',
    /* W-0194 — K-0096 ⑤ 물고기 38(뼈 worm·동작 7). Koi 는 animals·animals_extra2 같은 몸, Shark 는 두 폴더 다른 몸이지만 둘 다 상어. ✗ 셋(Puffer·Whale·Fish1)은 K-0102 자체판(W-0206) */
    Anglerfish: 'anglerfish', Armored_Catfish: 'armored_catfish', Betta: 'betta', Black_Lion_Fish: 'black_lionfish', Blobfish: 'blobfish',
    Blue_Goldfish: 'blue_goldfish', Blue_Tang: 'blue_tang', Butterfly_Fish: 'butterflyfish', Cardinal_Fish: 'cardinalfish',
    Clownfish: 'clownfish', Coral_Grouper: 'coral_grouper', Cowfish: 'cowfish', Flatfish: 'flatfish', Flower_Horn: 'flowerhorn',
    Goblin_Shark: 'goblin_shark', Goldfish: 'goldfish', Humphead: 'humphead', Koi: 'koi', Lionfish: 'lionfish', Mandarin_Fish: 'mandarinfish',
    Moorish_Idol: 'moorish_idol', Parrot_Fish: 'parrotfish', Piranha: 'piranha', Red_Snapper: 'red_snapper', Royal_Gramma: 'royal_gramma',
    Shark: 'shark', Sunfish: 'sunfish', Swordfish: 'swordfish', Tang: 'tang', Tetra: 'tetra', Tuna: 'tuna', Turbot: 'turbot',
    Yellow_Tang: 'yellow_tang', Zebra_Clown_Fish: 'zebra_clownfish', Dolphin: 'dolphin', MantaRay: 'manta_ray', Fish2: 'fish_b', Fish3: 'fish_c', Whale: 'whale', Puffer: 'puffer', Fish1: 'fish_a' };
  /** 폴더마다 같은 이름이 다른 몸인 것 — 괴물 팩(quaternius)의 Cat·Frog 는 괴물 고양이(✗ 판정)·괴물 개구리, quaternius2 의 Snake 는 괴물 뱀이라 안 바꾼다 */
  var CREATURE_DIR_SKIP = { quaternius: { Cat: 1, Frog: 1 }, quaternius2: { Snake: 1 } };
  /** W-0216 — 폴더마다 같은 이름이 다른 짝인 것(CREATURE_OF 보다 먼저) — animals_extra2 의 Shark 는 백상아리(pt_shark_2, K-0109 great_white) */
  var CREATURE_DIR_OF = { animals_extra2: { Shark: 'great_white' } };
  /** 눈 판정(W-0178 3단계)에서 옛것보다 못한 id — 빌린 모델을 그대로 둔다(K 다시 굽기 수신함) */
  var CREATURE_SKIP = {};   // W-0206 — W-0194 의 fish_b·fish_c "빈 칸"은 CREATURE_DIRS 가 숫자 이름(Fish2·Fish3)을 못 읽어 새 쪽도 빌린 몸을 받은 것이었다(새 몸은 멀쩡)   // W-0194 — 새 몸이 three 에서 안 보임(빈 칸, 키 1.00) → Fish2·Fish3 빌린 것 유지, K 다시 굽기(수신함)
  var CREATURE_DIRS = /(?:^|\/)(animals|animals_extra|animals_extra2|standin|community|troops|monsters|quaternius|quaternius2|quaternius_dino|robots|space|foes)\/([A-Za-z_][A-Za-z0-9_]*?)(?:_[0-9a-f]{8})?\.glb$/;   // W-0206 이름에 숫자 허용(옛 [A-Za-z_] 라 Fish1·Fish2·Fish3 이 짝을 못 찾았다)
  /** W-0360 — 판 손 배치 모델 중 shared/assets/models 한 벌로 옮긴 단위(판 js/models-shared.js, tools/gen-models-shared.mjs) → 공용 주소. 단위 = models 아래 첫 폴더(+둘째 폴더) */
  function modelShared(path) {
    var ms = global.DG && global.DG.modelsShared, m = ms && ms.length ? /^(?:\.\/)?assets\/models\/(.+)$/.exec(String(path || '')) : null;
    if (!m) { return null; }
    var p = m[1].split('/'), u = p.length > 2 ? p[0] + '/' + p[1] : p[0];
    if (ms.indexOf(u) < 0) { return null; }
    if (state === 'init') { probe(); }
    return root ? root + 'models/' + m[1] : null;
  }
  /** GLB 받기 자리(판 asset3d acquire 등)가 부른다 — 자체 몸 짝(creatureOnly)이 먼저, 없으면 shared 로 옮긴 손 배치 모델 */
  function creatureFor(path) { return creatureOnly(path) || modelShared(path); }
  function creatureOnly(path) {
    var cm = /^crea:([a-z0-9_]+)$/.exec(String(path || ''));   // W-0356 — 'crea:<id>' 는 옛 빌린 경로가 없다: 손잡이와 무관하게 자체 몸
    if (cm) { return url('creature', cm[1]); }
    var C = global.DG && global.DG.core;
    if (C && C.tuned && !C.tuned('assets3d.creature', 1)) { return null; }
    var m = CREATURE_DIRS.exec(String(path || ''));   // 괴물 팩은 이름 끝에 해시(`Goleling_51bf31d7.glb`)가 붙어 있다 — 떼고 본다
    if (!m || (CREATURE_DIR_SKIP[m[1]] && CREATURE_DIR_SKIP[m[1]][m[2]])) { return null; }
    var id = (CREATURE_DIR_OF[m[1]] && CREATURE_DIR_OF[m[1]][m[2]]) || CREATURE_OF[m[2]];
    return id && !CREATURE_SKIP[id] ? url('creature', id) : null;
  }

  global.DG = global.DG || {};
  /** 통일 2D 스프라이트(`world2d/<id>.webp`, 256px 알파 한 장) 주소 — 3D 와 같은 id. 없으면 null */
  function spriteUrl(id) {
    if (state === 'init') { probe(); }
    if (state !== 'ok' || !id || !tunedOn() || !(set('world')[id] || set('world2d')[id])) { return null; }
    return root + 'world2d/' + id + '.webp';
  }

  /** 영웅 몸 레시피(asset3d `heroRecipe` 맨 앞) — 통일 GLB 가 있으면 `{key, body}`(몸짓은 몸에서 읽어 굽는다 = anim-own), 없으면 null */
  function heroRecipe(ref) {
    var id = refId(ref), u = url('hero', id);
    return u ? { key: 'uni:' + id, body: u } : null;
  }
  /** 씨앗 → 인물 id. 사가나락는 'hero:<id>'·동료는 'ally:<id>' 문자열 씨앗을 준다(동료도 제 몸을 입게 — W-0074) */
  function refId(ref) { return ref && typeof ref === 'object' ? ref.id : String(ref || '').replace(/^(hero|ally):/, ''); }

  /**
   * 빌린 몸(W-0074) — 통일 몸이 없는 사람(주민·이야기 NPC·사람 적·절차 인물)에게 **이 판 도감과 안 겹치는** 통일 몸을 입힌다.
   * 옛 몸(VRoid 샘플 넷·Quaternius·OGA·poly.pizza)을 대신한다. 설정 `DG.cfg.assets3d.borrow` 가 있는 판만 켜진다:
   *   named: [씨앗…]  이름 있는 사람 — 이 순서대로 서로 다른 몸을 하나씩(겹치지 않는다)
   *   skip:  [씨앗…]  빌리지 않는다(현대·미래 옷이 곧 그 사람인 경우 — 맞는 새 몸이 아직 없다)
   *   skipEra: [ref.era…]  같은 뜻을 시대로(사가만리 땅 사람 folk_modern·folk_future)
   *   same:  {씨앗: 씨앗}  같은 사람(가면 벗은 참이름 등)은 같은 몸
   *   exclude: [id…]  풀에서 더 뺄 몸(도감 105 는 늘 빠진다)
   *   pool: 'all'  도감 몸도 빌린다(사가천하 — 판 인물이 299 전부라 안 겹치는 몸이 없다. 얼굴이 장수와 겹친다)
   * 나머지(절차 인물·이름 없는 적)는 named 가 안 쓴 몸에서 씨앗 해시로 고른다. 손잡이 `assets3d.borrow` 0 이면 늘 null.
   */
  var borrowed = null;   // { named: {씨앗: 몸id}, rest: [몸id…] }
  function borrowTable() {
    if (borrowed) { return borrowed; }
    var c = cfg().borrow, D = global.DG && global.DG.data, own = {}, i;
    borrowed = { named: {}, rest: [] };
    if (!c) { return borrowed; }
    /* W-0121 — 도감 끝에 붙은 사가천하 장수 사본(`realm`)·새 가상 인물(`late`)은 빼지 않는다. W-0115 로 299 몸 전부가 도감에 들자
       빌릴 몸이 0 이 돼 주민·적이 3D 는 옛 몸, 2D 는 옛 한 장 그림(흰 도포 노인)으로 떨어졌다 — 빌리는 몸은 W-0115 전과 같은 194 */
    if (c.pool !== 'all') { ((D && D.heroes) || []).forEach(function (h) { if (!h.realm && !h.late) { own[h.id] = 1; } }); }
    (c.exclude || []).forEach(function (x) { own[x] = 1; });
    var pool = (ids().hero || []).filter(function (x) { return !own[x]; }).sort();
    var names = c.named || [], step = Math.max(1, Math.floor(pool.length / Math.max(1, names.length))), used = {};
    for (i = 0; i < names.length && i < pool.length; i++) {   // 고르게 띄엄띄엄 — 같은 갈래(서역·선비…) 몸이 한 마을에 몰리지 않게
      var k = (i * step) % pool.length;
      while (used[pool[k]]) { k = (k + 1) % pool.length; }
      used[pool[k]] = 1; borrowed.named[names[i]] = pool[k];
    }
    borrowed.rest = pool.filter(function (x) { return !used[x]; });
    /* W-0150 — 성별을 아는 사람(인물 표의 sex)은 같은 성별 몸에서 고른다(전엔 해시뿐이라 사가나락 확장 30 중 12 가 반대 성별 몸). 표는 여기서 한 번만 */
    var hs = ids().heroSex || {};
    borrowed.bySex = { f: borrowed.rest.filter(function (x) { return hs[x] === 'f'; }), m: borrowed.rest.filter(function (x) { return hs[x] === 'm'; }) };
    borrowed.sexOf = {}; ((D && D.heroes) || []).forEach(function (h) { if (h.sex === 'f' || h.sex === 'm') { borrowed.sexOf[h.id] = h.sex; } });
    return borrowed;
  }
  /** 빌릴 몸 id 고르기(주소 없이 — 진단이 센다) — { id, seed } 또는 null */
  function borrowPick(ref) {
    var c = cfg().borrow, C = global.DG && global.DG.core;
    if (!c || (C && C.tuned && !C.tuned('assets3d.borrow', 1))) { return null; }
    var seed = ref && typeof ref === 'object' ? ref.id : String(ref || ''), id = refId(ref);
    if (!seed || set('hero')[id] || (c.skip || []).indexOf(seed) >= 0) { return null; }
    if (ref && typeof ref === 'object' && (c.skipEra || []).indexOf(ref.era) >= 0) { return null; }
    if ((c.same || {})[seed]) { seed = c.same[seed]; }
    var t = borrowTable(), b = t.named[seed], i, h = 0, sx = (ref && typeof ref === 'object' && ref.sex) || (t.sexOf && t.sexOf[id]);
    var rest = sx && t.bySex && t.bySex[sx] && t.bySex[sx].length ? t.bySex[sx] : t.rest;   // W-0150 — 성별 아는 사람은 같은 성별 몸만
    if (!b && rest.length) {
      for (i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) >>> 0; }
      b = rest[h % rest.length];
    }
    return b ? { id: b, seed: seed } : null;
  }
  function borrowRecipe(ref) {
    var p = borrowPick(ref), u = p && url('hero', p.id);
    return u ? { key: 'uni:' + p.id, body: u, borrowedFor: p.seed } : null;
  }

  global.DG.assets3d = {
    url: url, spriteUrl: spriteUrl, creatureFor: creatureFor, modelShared: modelShared, CREATURE_OF: CREATURE_OF, CREATURE_DIR_OF: CREATURE_DIR_OF, CREATURE_SKIP: CREATURE_SKIP, CREATURE_DIR_SKIP: CREATURE_DIR_SKIP, probe: probe, heroRecipe: heroRecipe, borrowRecipe: borrowRecipe, borrowPick: borrowPick, borrowTable: borrowTable, applyProps: applyProps,
    has: function (kind, id) { return !!set(kind)[id]; },
    /** 진단·점검용 — 'init' | 'probing' | 'ok' | 'fail' */
    state: function () { return state; },
    root: function () { return root; },
    /** W-0359 — 다섯 판이 한 벌로 나눠 쓰는 shared/assets 아래 파일 주소(판 단독 서버는 /_shared, 공개 페이지는 ../shared). 못 찾으면 null */
    sharedUrl: function (rel) { if (state === 'init') { probe(); } return root ? root + rel : null; },
    /** 시험이 끝나면(되든 안 되든) 부른다 — 이미 끝났으면 바로 */
    whenSettled: function (cb) {
      probe();
      (function wait() { if (state === 'ok' || state === 'fail') { cb(state === 'ok'); } else { setTimeout(wait, 50); } })();
    },
    _reset: function () { state = 'init'; root = null; sets = null; borrowed = null; }
  };
  probe();
})(typeof window !== 'undefined' ? window : this);
