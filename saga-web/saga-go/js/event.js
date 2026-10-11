/**
 * 사건 — 걷다가 만나는 열 가지 (3D 전환 PHASE 8)
 * ---------------------------------------------------------------
 * `PLAN.md` 가 이 판의 차별점으로 못박아 둔 한 줄이 있다 —
 *
 *   > **"걷다가 사건을 만난다"**
 *
 * 여태 걸으면 만나는 것은 **잡을 것**(스폰)과 **들를 곳**(역참·성채)뿐이었다.
 * 여기 열 가지 사건을 들인다. 길에서 상인을 만나고, 도적에게 습격당하고,
 * 사당의 비문을 읽고, 폐허에서 지도 조각을 줍는다. 그리고 **고른다**(35절) —
 * 구할지 지나칠지, 맞설지 값을 치를지. 고른 것에 따라 결과가 다르다.
 *
 * **앞의 셋과 달리 이것은 판정에 닿는다.** 땅(`land.js`)·주민(`npc.js`)·짐승
 * (`animal.js`)은 화면 층이라 "세이브에 한 칸도 안 남는다" 를 지켰지만, 사건은
 * 금과 공적이 오가는 것이라 그럴 수가 없다. 대신 **닿는 자리를 한 군데로 좁혔다**:
 *
 *   contextAt · candidates · resolve   순수 함수. 세이브를 **읽기만** 한다
 *   apply                              여기서만 세이브가 바뀐다
 *   open · tick                        화면과 때를 맡는다
 *
 * 그래서 자가진단은 "도적에게 맞서 이기면 무엇을 얻나" 를 세이브를 건드리지 않고
 * 값으로 물어볼 수 있고, `apply` 는 전후를 견주어 한 칸씩 확인한다.
 *
 * **싸움은 아직 화면이 없다.** 이겼는지 졌는지만 이 자리에서 가른다 —
 * 제대로 된 전투는 PHASE 9 몫이다. 손잡이 `event.on` 을 0 으로 두면 통째로 잠든다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 사건을 들일까 — 0 이면 걸어도 아무 일도 안 생긴다 */
  function on() { return core.tuned('event.on', 1) ? true : false; }
  /** 몇 미터마다 한 번 주사위를 굴리나
   * (2026-09-06, 축1 "사건 빈도가 낮다" — 420 → 300, 아래 chance 도 같이 올려
   * 실제 평균 간격이 420÷0.55≈764m 에서 300÷0.62≈484m 로 준다) */
  function STEP() { return core.tuned('event.stepM', 180); }   // W-0174 300 → 180 — 평균 ≈290m 마다 사건
  /** 그 주사위에서 사건이 날 확률 */
  function CHANCE() { return core.tuned('event.chance', 0.62); }

  /* ── 적 셋 (PLAN 46절 "적 3종") ────────────────────────
   * 따로 세우지 않고 **사건 안에서** 만난다. 힘은 내 부대(`hero.partyPower`)와
   * 견주는 기준값이다 — 셋이 뚜렷이 다른 무게를 갖게 벌려 두었다.
   */
  var FOES = {
    /* vkind — 교전 무대에 세울 때 몸이 사람이냐(hero) 짐승이냐(pet) */
    bandit: { id: 'bandit', name: '산적', emoji: '🗡️', power: 120, note: '수는 많고 솜씨는 거칠다', vkind: 'hero' },
    wolfpack: { id: 'wolfpack', name: '늑대 무리', emoji: '🐺', power: 90, note: '무리로 에워싼다', vkind: 'pet' },
    scout: { id: 'scout', name: '적군 정찰병', emoji: '🏹', power: 170, note: '혼자지만 잘 벼려져 있다', vkind: 'hero' }
  };

  /**
   * 이 적을 3D 무대에 세우면 어떤 몸으로 서나 — **화면에만 쓴다**(판정에 안 닿는다).
   * 사람은 아무 인물도 아니라 임시 id(`foe_산적` 식)로 해시만 걸고, 짐승은
   * `animal.js` 가 들판에 세우는 그 늑대를 그대로 빌린다(따로 지을 필요가 없다).
   */
  function foeVisual(foe) {
    if (!foe) { return null; }
    if (foe.vkind === 'pet') {
      var AN = global.DG.animal;
      if (!AN || !AN.KINDS || !AN.KINDS.wolf) { return null; }
      return { kind: 'pet', ref: AN.refOf(AN.KINDS.wolf) };
    }
    return { kind: 'hero', ref: { id: 'foe_' + foe.id, name: foe.name, faction: '도적', rarity: 2 } };
  }

  /**
   * 싸움이 안 걸리는 사건(상인·부상병·아이 등)도 **누군가를 세운다**
   * (2026-09-06, "만나는 이벤트도 글로만 보이면 잼없지"). 지금까지는
   * 카드에 이모지 한 글자뿐이었다 — 실제 인물(`data.heroes`)을 하나 붙여
   * 3D 화면에도 세우고 카드에도 초상을 넣는다. **사건 id로 늘 같은 사람이
   * 나오게 고정한다**(무작위가 아니다 — 같은 사건은 늘 같은 얼굴이어야
   * "그 상인"·"그 노인"으로 기억에 남는다, 순수 함수라 자가진단도 값으로 본다).
   */
  function npcVisual(ev) {
    var H = global.DG.data && global.DG.data.heroes;
    if (!H || !H.length) { return null; }
    var seed = 0, s = ev.id;
    for (var i = 0; i < s.length; i++) { seed = (seed * 31 + s.charCodeAt(i)) >>> 0; }
    return { kind: 'hero', ref: H[seed % H.length] };
  }

  /**
   * 이 사건이 3D 무대에 무엇을 세우나 — **순수 함수**(화면 없이 값만 낸다,
   * 자가진단이 이걸 직접 물을 수 있다).
   *
   * `ev.prop`(비문·지도 조각·약초·여울)이 있으면 **사람이 아니라 그 자리·
   * 물건 자체**를 세운다 — 지금까지는 다른 사건과 똑같이 `npcVisual()`이
   * 아무 인물이나 하나 세웠는데, "묻힌 지도 조각을 캐는데 웬 사람이 옆에
   * 서 있나" 처럼 뜻이 안 맞았다(2026-09-06, "비전투 이벤트 3D 무대 연출").
   * `actor3d.js`의 `kind:'prop'`(비석·폐허·약초·여울 넷, 뼈대 없이 가만히
   * 선다)이 실제로 세운다. `mood`는 따로 남아 `battle3d.js`가 알갱이(먼지·
   * 금빛·바람)를 사건 성격에 맞게 고르는 데 쓴다 — 두 값이 지금은 늘 같이
   * 다니지만(발견물은 `prop`도 있고 `mood`도 있다) 뜻은 다르다: `prop`은
   * "무엇을 세울까", `mood`는 "무슨 알갱이를 터뜨릴까".
   */
  function stageOf(ev) {
    var foe = ev.foe ? FOES[ev.foe] : null;
    if (foe) { return foeVisual(foe); }
    if (ev.prop) { return { kind: 'prop', ref: { propType: ev.prop, id: ev.id } }; }
    return npcVisual(ev);
  }

  /* ── 열 가지 사건 ─────────────────────────────────────
   * `PLAN.md` 11절이 늘어놓은 예시에서 **이 땅에 걸 수 있는 것**으로 골랐다.
   *
   *   where   어떤 터에서 나나 (`land.js` 의 땅 종류) · `marks` 는 그 표식 위에서만
   *   when    'day' · 'night' · 'any'
   *   w       가중치. 조건에 맞는 것들 사이에서 이 비로 뽑힌다
   *   foe     싸움이 걸리는 사건이면 적 id
   *   choices 고르는 것들. **결과가 갈려야 고르는 뜻이 있다**(35절)
   *
   * 결과 `out(ctx, roll)` 는 **순수 함수**다 — 세이브를 안 만지고 무엇이 오갈지만
   * 적어 돌려준다. 실제로 주는 것은 `apply()` 한 군데다.
   */
  var EVENTS = [
    {
      id: 'road_merchant', name: '길 위의 상인', emoji: '🧺', w: 12, pose: 'greet',
      when: 'day', where: ['road', 'town'],
      quote: '"수레가 무거워 못 가겠소. 값은 후하게 쳐 드리리다."',
      choices: [
        { id: 'buy', label: '짐을 덜어 준다 (🪙 40)',
          out: function () {
            return { gold: -40, items: [{ key: 'scroll', n: 2 }, { key: 'feed', n: 3 }],
                     fame: 8, text: '상인이 등용서와 사료를 얹어 주었다.' };
          } },
        { id: 'pass', label: '지나간다',
          out: function () { return { text: '수레가 삐걱대는 소리가 뒤로 멀어졌다.' }; } }
      ]
    },
    {
      id: 'bandit_ambush', name: '도적의 습격', emoji: '🗡️', w: 10,
      when: 'any', nightW: 2, where: ['grass', 'road', 'farm'], marks: ['ruin'],
      foe: 'bandit',
      quote: '"길세를 내고 가라. 아니면 두고 가든지."',
      choices: [
        { id: 'fight', label: '맞선다', fight: true,
          out: function (ctx, roll) {
            var r = fightRoll('bandit', roll, undefined, ctx && ctx.win);
            return r.win
              ? { feat: 22, gold: 60, exp: 40, win: true,
                  text: '도적을 물리쳤다. 두고 간 전대가 남았다.' }
              : { gold: -70, win: false,
                  text: '밀렸다. 전대를 빼앗기고 물러났다.' };
          } },
        { id: 'pay', label: '값을 치른다 (🪙 45)',
          out: function () { return { gold: -45, text: '길세를 치르고 지나갔다.' }; } },
        { id: 'flee', label: '달아난다',
          out: function (ctx, roll) {
            return roll < 0.6
              ? { text: '어둠 속으로 달아났다.' }
              : { items: [{ key: 'feed', n: -2 }], text: '쫓기다 짐을 흘렸다.' };
          } }
      ]
    },
    {
      id: 'wolf_ring', name: '늑대 무리에 둘러싸이다', emoji: '🐺', w: 9, eerie: true,
      when: 'night', where: ['forest', 'mount', 'grass'],
      foe: 'wolfpack',
      quote: '풀숲에서 눈이 여럿 빛난다.',
      choices: [
        { id: 'fight', label: '맞선다', fight: true,
          out: function (ctx, roll) {
            var r = fightRoll('wolfpack', roll, undefined, ctx && ctx.win);
            return r.win
              ? { feat: 14, exp: 30, win: true, text: '무리를 흩었다.' }
              : { items: [{ key: 'feed', n: -3 }], win: false,
                  text: '사료를 던져 주고 겨우 빠져나왔다.' };
          } },
        { id: 'fire', label: '불을 피운다 (🕯️ 향 1)',
          out: function () {
            return { items: [{ key: 'incense', n: -1 }], exp: 12,
                     text: '불빛에 눈들이 물러났다.' };
          } },
        { id: 'back', label: '천천히 물러난다',
          out: function (ctx, roll) {
            return roll < 0.55
              ? { text: '등을 보이지 않고 물러났다.' }
              : { exp: 6, text: '한참을 물러선 끝에 길을 잃었다 되찾았다.' };
          } }
      ]
    },
    {
      id: 'hurt_soldier', name: '부상당한 병사', emoji: '🩹', w: 9, pose: 'hurt',
      when: 'any', where: ['road', 'mount', 'grass'],
      quote: '"물… 물 좀 주시오."',
      choices: [
        { id: 'help', label: '돌본다 (🍖 2)',
          out: function () {
            return { items: [{ key: 'feed', n: -2 }], feat: 18, fame: 12, exp: 20,
                     text: '병사가 제 부대의 표식을 쥐여 주었다.' };
          } },
        { id: 'pass', label: '지나간다',
          out: function () { return { fame: -4, text: '뒤에서 기침 소리가 들렸다.' }; } }
      ]
    },
    {
      id: 'village_ask', name: '마을의 부탁', emoji: '🙏', w: 8, pose: 'greet',
      when: 'day', where: ['town'],
      quote: '"보아하니 멀리서 오신 분 같은데, 청이 하나 있소."',
      choices: [
        { id: 'take', label: '맡는다', quest: true,
          out: function () { return { quest: true, fame: 6, text: '사명을 하나 맡았다.' }; } },
        { id: 'no', label: '사양한다',
          out: function () { return { text: '노인이 고개를 끄덕이고 돌아섰다.' }; } }
      ]
    },
    {
      id: 'lost_child', name: '사라진 아이', emoji: '🧒', w: 7, pose: 'greet',
      when: 'day', where: ['town', 'forest', 'farm'],
      quote: '"우리 아이를 못 보셨소? 아침부터 안 보이오."',
      choices: [
        { id: 'seek', label: '찾아 나선다',
          out: function (ctx, roll) {
            return roll < 0.62
              ? { feat: 20, fame: 15, gold: 30,
                  text: '숲 어귀에서 잠든 아이를 찾았다.' }
              : { exp: 10, text: '해가 질 때까지 찾았지만 못 찾았다. 마을 사람들이 나섰다.' };
          } },
        { id: 'tell', label: '촌장에게 알린다',
          out: function () { return { fame: 4, text: '촌장이 사람을 풀었다.' }; } }
      ]
    },
    {
      id: 'stone_text', name: '고대 비문', emoji: '🪨', w: 11, mood: 'discover', prop: 'shrine',
      when: 'any', where: [], marks: ['shrine'],
      quote: '이끼 아래로 글자가 반쯤 남아 있다.',
      record: '무너진 사당의 비문',
      choices: [
        { id: 'read', label: '읽어 본다',
          out: function () {
            return { exp: 35, fame: 10, record: true,
                     text: '옛 싸움의 날짜와 이름 셋을 읽어 냈다.' };
          } },
        { id: 'leave', label: '그냥 둔다',
          out: function () { return { text: '이끼를 도로 덮어 두었다.' }; } }
      ]
    },
    {
      id: 'map_scrap', name: '보물 지도 조각', emoji: '🗺️', w: 11, mood: 'discover', prop: 'ruin',
      when: 'any', where: [], marks: ['ruin'],
      quote: '무너진 기둥 틈에 기름 먹인 종이가 끼여 있다.',
      record: '강 건너 폐허의 지도 조각',
      choices: [
        { id: 'dig', label: '적힌 자리를 파 본다',
          out: function (ctx, roll) {
            return roll < 0.45
              ? { gold: 180, feat: 25, record: true,
                  text: '돌 아래에서 묻어 둔 전대가 나왔다.' }
              : { exp: 15, record: true, text: '흙만 나왔다. 종이는 챙겨 두었다.' };
          } },
        { id: 'sell', label: '상인에게 판다 (🪙 60)',
          out: function () { return { gold: 60, text: '조각을 넘기고 값을 받았다.' }; } }
      ]
    },
    {
      id: 'rare_herb', name: '희귀 약초', emoji: '🌿', w: 8, mood: 'discover', prop: 'herb',
      when: 'day', where: ['forest', 'mount'],
      quote: '바위 그늘에 보기 드문 잎이 돋아 있다.',
      choices: [
        { id: 'pick', label: '캔다',
          out: function () {
            return { items: [{ key: 'treat', n: 2 }], exp: 18,
                     text: '별미로 쓸 만한 것을 두 몫 캤다.' };
          } },
        { id: 'keep', label: '남겨 둔다',
          out: function () { return { fame: 3, text: '씨가 여물도록 두고 왔다.' }; } }
      ]
    },
    {
      /* **비에만 나는 사건**(PLAN 21절 "특정 이벤트 발생"). 물이 불면 여울이 잠긴다 —
         PHASE 10 에서 강물이 실제로 불어나는 것과 같은 자리를 가리킨다 */
      id: 'flood_ford', name: '불어난 여울', emoji: '🌊', w: 14, mood: 'water', prop: 'flood',
      when: 'any', where: ['water', 'road', 'farm'], marks: ['bridge'], wet: true,
      quote: '물이 부어 건널목이 잠겼다. 물살 소리가 크다.',
      choices: [
        { id: 'cross', label: '그대로 건넌다',
          out: function (ctx, roll) {
            return roll < 0.55
              ? { exp: 25, feat: 10, text: '허리께까지 잠기며 건넜다.' }
              : { items: [{ key: 'scroll', n: -1 }], exp: 8,
                  text: '물살에 밀려 등용서 한 장이 젖어 버렸다.' };
          } },
        { id: 'wait', label: '물이 빠지기를 기다린다',
          out: function () { return { fame: 3, text: '비가 잦아들 때까지 처마 밑에 섰다.' }; } },
        { id: 'around', label: '돌아간다',
          out: function () { return { text: '위쪽 여울로 크게 돌았다.' }; } }
      ]
    },
    {
      /* land.js 의 표식 다섯(다리·굴·폭포·사당·폐허) 중 굴·폭포만 오래
         전용 사건이 없었다 — 도착하면 codex.tick() 이 "발견" 점수는 이미
         줬지만(순찰형 발견 시스템), 사당·폐허처럼 고른 것에 따라 결과가
         갈리는 순간은 없었다(2026-09-07, "완성도"). 이 둘을 채운다. */
      id: 'cave_secret', name: '이름 없는 굴', emoji: '🕳️', w: 11, mood: 'discover', prop: 'cave',
      when: 'any', where: [], marks: ['cave'],
      quote: '어둠 속에서 찬 바람이 새어 나온다. 안쪽은 보이지 않는다.',
      record: '이름 없는 굴 안쪽',
      choices: [
        { id: 'enter', label: '안으로 들어가 본다',
          out: function (ctx, roll) {
            return roll < 0.5
              ? { gold: 140, feat: 20, record: true,
                  text: '박쥐 떼를 피해 들어가니 오래된 항아리가 있었다.' }
              : { exp: 22, record: true,
                  text: '안쪽은 막다른 굴이었다. 그래도 시원한 바람을 쐬었다.' };
          } },
        { id: 'leave', label: '그냥 지나친다',
          out: function () { return { text: '섬뜩한 기운에 발길을 돌렸다.' }; } }
      ]
    },
    {
      id: 'waterfall_falls', name: '산속 폭포', emoji: '💦', w: 11, mood: 'water', prop: 'falls',
      when: 'any', where: [], marks: ['waterfall'],
      quote: '물줄기가 바위를 타고 쏟아진다. 무지개가 잠깐 걸렸다 사라진다.',
      record: '산속 폭포',
      choices: [
        { id: 'rest', label: '물가에서 쉬어 간다',
          out: function () {
            return { fame: 5, feat: 8, record: true, text: '물소리를 들으며 잠시 숨을 돌렸다.' };
          } },
        { id: 'behind', label: '폭포 뒤를 살펴본다',
          out: function (ctx, roll) {
            return roll < 0.4
              ? { items: [{ key: 'scroll', n: 1 }], gold: 50, record: true,
                  text: '물이 가려 둔 바위틈에서 젖지 않은 두루마리를 찾았다.' }
              : { exp: 15, text: '물보라만 흠뻑 맞았다.' };
          } }
      ]
    },
    {
      id: 'enemy_scout', name: '적군 정찰병', emoji: '🏹', w: 8, eerie: true,
      when: 'night', where: ['mount', 'road', 'grass'],
      foe: 'scout',
      quote: '능선 위로 사람 그림자 하나가 지나간다.',
      choices: [
        { id: 'fight', label: '잡는다', fight: true,
          out: function (ctx, roll) {
            var r = fightRoll('scout', roll, undefined, ctx && ctx.win);
            return r.win
              ? { feat: 35, exp: 55, items: [{ key: 'scroll', n: 1 }], win: true,
                  text: '정찰병을 잡았다. 품에서 밀서가 나왔다.' }
              : { fame: -6, win: false, text: '놓쳤다. 이쪽이 먼저 들켰다.' };
          } },
        { id: 'hide', label: '숨는다',
          out: function () { return { exp: 12, text: '바위 뒤에서 지나가기를 기다렸다.' }; } },
        { id: 'let', label: '보낸다',
          out: function () { return { fame: -2, text: '가는 길을 막지 않았다.' }; } }
      ]
    }
  ];

  /* ── 싸움 ─────────────────────────────────────────────
   * 화면은 없다. 내 부대의 힘과 적의 힘을 견주어 **이길 확률**을 내고 주사위를 굴린다.
   * 두 배 세면 8할, 반이면 2할 — 어느 쪽도 확실하지 않게 0.12~0.88 로 눌러 둔다
   * (확실해지면 고를 뜻이 사라진다).
   */
  function myPower() {
    var H = global.DG.hero;
    var base = H && H.partyPower ? H.partyPower().total : 0;
    return base + core.save.player.level * 6;
  }

  function winChance(foeId, mine) {
    var f = FOES[foeId];
    if (!f) { return 1; }
    mine = mine === undefined ? myPower() : mine;
    var r = mine / (mine + f.power);
    return Math.max(0.12, Math.min(0.88, r));
  }

  /**
   * 승패를 가른다 — `roll` 을 밖에서 주면 순수 함수가 된다.
   *
   * **`forced` 가 참·거짓이면 그것이 그대로 답이다.** 교전 무대(`duel.js`)를 거쳐 온
   * 경우가 그렇다 — 그때는 주사위가 아니라 **실제로 기세를 다 깎았는지**가 승패다.
   * 무대를 안 거치면(손잡이를 껐거나 `duel` 이 없으면) 예전처럼 주사위로 간다.
   */
  function fightRoll(foeId, roll, mine, forced) {
    var c = winChance(foeId, mine);
    if (forced === true || forced === false) { return { win: forced, chance: c, foe: FOES[foeId], live: true }; }
    return { win: roll < c, chance: c, foe: FOES[foeId], live: false };
  }

  /* ── 지금 여기가 어디냐 ───────────────────────────────
   * 사건은 **아무 데서나** 나지 않는다. 비문은 사당에서, 지도 조각은 폐허에서,
   * 늑대는 밤 숲에서. 그 판단에 드는 것을 한 덩이로 모아 둔다(순수 함수).
   */
  function contextAt(pos, t, wx) {
    var L = global.DG.land;
    var tx = Math.floor(pos.x / 48), ty = Math.floor(pos.y / 48);
    var a = L ? L.at(tx, ty) : null;
    var W = global.DG.weather;
    var WD = global.DG.world;
    var h = new Date(t === undefined ? Date.now() : t).getHours();
    return {
      tx: tx, ty: ty,
      /* **2026-09-06, 축1 재확인 중 발견한 진짜 버그**: 여기가 늘 `land.js` 만
         물어 하북 마을(원점 둘레 ~500m) 밖에서는 `kind` 가 그냥 null 로 떨어졌다.
         `EVENTS` 는 하나만 빼고 다 `where`(땅 갈래)나 `marks`(하북 전용 표식)를
         요구하니, kind 가 null 이면 **후보가 통째로 0개** — 마을 밖에서는 사건이
         한 건도 안 났다는 뜻이다("이 땅 밖이면 null — 그래도 사건은 난다"던 옛
         주석은 틀렸다, 실측: `EV.stats({x:5000,y:5000}).here === 0`). `world.js`
         의 `terrainAt()` 은 이미 land→geo(실제 OSM 지형)→해시 순으로 답을
         내고 있어(3D·미니맵이 그걸로 돈다) 마을 밖도 늘 땅 갈래가 있다 — 그걸
         그대로 물어 온다. `mark`(사당·폐허 등 손으로 심은 표식)는 하북 전용이
         맞으므로 그대로 `land.js` 만 본다 */
      kind: a ? a.kind : (WD && WD.terrainAt ? WD.terrainAt(tx, ty) : null),
      mark: a ? a.mark : null,
      night: h >= 21 || h < 4,
      weather: wx || (W ? W.current().key : 'clear'),
      t: t === undefined ? Date.now() : t
    };
  }

  /** 이 자리·이 시각에 날 수 있는 사건들과 가중치 — 순수 함수 */
  function candidates(ctx) {
    var out = [], i, ev, w;
    for (i = 0; i < EVENTS.length; i++) {
      ev = EVENTS[i];
      /* 표식을 요구하는 사건은 **그 표식 위에서만** 난다 (비문·지도 조각) */
      if (ev.marks && ev.marks.length) {
        if (ev.marks.indexOf(ctx.mark) < 0) {
          /* 터 조건도 따로 있으면 그쪽으로 한 번 더 본다 */
          if (!ev.where || !ev.where.length || ev.where.indexOf(ctx.kind) < 0) { continue; }
        }
      } else if (ev.where && ev.where.length) {
        if (ev.where.indexOf(ctx.kind) < 0) { continue; }
      }
      if (ev.when === 'day' && ctx.night) { continue; }
      if (ev.when === 'night' && !ctx.night) { continue; }
      var wet = ctx.weather === 'rain' || ctx.weather === 'snow';
      /* 젖은 날에만 나는 것 — 마른 날에는 아예 안 난다 */
      if (ev.wet && !wet) { continue; }
      w = ev.w;
      /* 밤에 더 자주 나는 것 (도적) */
      if (ctx.night && ev.nightW) { w *= ev.nightW; }
      /* 비가 오면 길에서 사람을 덜 만난다 */
      if (wet && ev.when === 'day') { w *= 0.5; }
      /* **안개가 끼면 숨은 곳이 드러난다**(PLAN 21절 "희귀 장소 등장 확률 증가").
         표식 위에서만 나는 것들 — 사당의 비문, 폐허의 지도 조각이 그것이다 */
      if (ctx.weather === 'fog' && ev.marks && ev.marks.length &&
          ev.marks.indexOf(ctx.mark) >= 0) { w *= 2.4; }
      /* 계절 — 약초는 봄·여름에 잦고 겨울에는 드물다 (PLAN 37절) */
      var SE = global.DG.season;
      if (SE) { w *= SE.eventWeight(ev.id); }
      if (w > 0) { out.push({ ev: ev, w: w }); }
    }
    return out;
  }

  /** 가중치대로 하나 고른다 — `roll` 을 주면 순수 함수 */
  function pick(cands, roll) {
    if (!cands.length) { return null; }
    var sum = 0, i;
    for (i = 0; i < cands.length; i++) { sum += cands[i].w; }
    var x = roll * sum;
    for (i = 0; i < cands.length; i++) {
      x -= cands[i].w;
      if (x <= 0) { return cands[i].ev; }
    }
    return cands[cands.length - 1].ev;
  }

  function find(id) {
    for (var i = 0; i < EVENTS.length; i++) { if (EVENTS[i].id === id) { return EVENTS[i]; } }
    return null;
  }
  function choiceOf(ev, cid) {
    for (var i = 0; i < ev.choices.length; i++) { if (ev.choices[i].id === cid) { return ev.choices[i]; } }
    return null;
  }

  /**
   * 이 사건에서 이것을 고르면 무엇이 오가나 — **순수 함수다. 세이브를 안 만진다.**
   * `roll` 을 밖에서 주면 같은 값이 늘 같은 결과를 낸다(자가진단이 이걸 본다).
   */
  function resolve(ev, cid, ctx, roll) {
    if (typeof ev === 'string') { ev = find(ev); }
    if (!ev) { return null; }
    var c = choiceOf(ev, cid);
    if (!c) { return null; }
    roll = roll === undefined ? Math.random() : roll;
    var r = c.out(ctx || contextAt(core.save.player.pos), roll) || {};
    return {
      ev: ev, choice: c,
      gold: r.gold || 0, exp: r.exp || 0, fame: r.fame || 0, feat: r.feat || 0,
      items: r.items || [], quest: !!r.quest, record: !!r.record,
      win: r.win === undefined ? null : r.win,
      text: r.text || ''
    };
  }

  /**
   * 결과를 실제로 준다 — **이 파일에서 세이브가 바뀌는 곳은 여기뿐이다.**
   * 없는 것을 빼앗지 않는다(금이 모자라면 있는 만큼만).
   */
  function apply(res) {
    if (!res) { return null; }
    var p = core.save.player, B = global.DG.bag, i, it;
    var got = { gold: 0, items: [] };

    if (res.gold) {
      var g = res.gold < 0 ? -Math.min(p.gold, -res.gold) : res.gold;
      p.gold += g;
      got.gold = g;
    }
    for (i = 0; i < res.items.length; i++) {
      it = res.items[i];
      if (it.n > 0) {
        var added = B.add(it.key, it.n);
        if (added) { got.items.push({ key: it.key, n: added }); }
      } else {
        var lost = B.take ? B.take(it.key, -it.n) : 0;
        if (lost) { got.items.push({ key: it.key, n: -lost }); }
      }
    }
    if (res.fame) { p.fame = Math.max(0, p.fame + res.fame); }
    if (res.feat) { core.gainFeat(res.feat, res.ev.name); }
    if (res.exp) { core.gainExp(res.exp); }
    if (res.quest && global.DG.quest && !global.DG.quest.full()) {
      got.quest = global.DG.quest.take();
    }

    /* 기록 — PLAN 36절 "발견한 사건을 사관에 기록한다". 지금은 기록 줄로 남긴다
       (다시 펼쳐 보는 발견 목록은 PHASE 11 몫이다) */
    var bits = [];
    if (got.gold) { bits.push('🪙 ' + (got.gold > 0 ? '+' : '') + got.gold); }
    for (i = 0; i < got.items.length; i++) {
      var d = B.def(got.items[i].key);
      bits.push(d.emoji + ' ' + (got.items[i].n > 0 ? '+' : '') + got.items[i].n);
    }
    if (res.exp) { bits.push('경험치 +' + res.exp); }
    if (res.fame) { bits.push('🎖️ ' + (res.fame > 0 ? '+' : '') + res.fame); }
    core.log(res.ev.emoji + ' ' + res.ev.name + ' — ' + res.choice.label.replace(/ \(.*\)$/, '') +
      (bits.length ? ' · ' + bits.join(' · ') : ''),
      res.win === false ? 'bad' : (res.feat ? 'feat' : 'good'));
    /* 겪은 사건과 거기서 얻은 기록을 발견 목록에 남긴다(`codex.js`) —
       로그 줄은 밀려 사라지지만 목록은 남는다 */
    var CX = global.DG.codex;
    if (CX) {
      CX.discover('event', res.ev.id, { name: res.ev.name });
      if (res.record && res.ev.record) { CX.discover('record', res.ev.id, { name: res.ev.record }); }
    } else if (res.record && res.ev.record) {
      core.log('📖 [발견] ' + res.ev.record, 'feat');
    }
    core.emit('changed');
    return got;
  }

  /* ── 화면 ─────────────────────────────────────────────
   * 조우·역참·성채가 쓰는 **같은 `#encounter` 한 칸**을 쓴다. 새 창을 만들지 않는다 —
   * 하나만 열린다는 규칙이 그 한 칸으로 지켜지고 있다.
   */
  var live = null;          // 지금 열린 사건 {ev, ctx}

  function host() { return document.getElementById('encounter'); }
  function busy() {
    var el = host();
    return !!(el && el.classList.contains('show'));
  }

  function close() {
    live = null;
    var el = host();
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    /* 카드가 세운 3D 인물도 같이 내린다 — `duel.js`/`rogue-action.js`가
       전투 쪽에서 이미 내렸어도(`finish()`가 `duel:close`를 먼저 쏜다)
       `duelUnstage()`는 없는 액터를 지우려 해도 안전하다 */
    core.emit('duel:close', {});
    core.emit('changed');
  }

  function open(ev, ctx) {
    if (typeof ev === 'string') { ev = find(ev); }
    if (!ev || busy()) { return false; }
    ctx = ctx || contextAt(core.save.player.pos);
    var el = host();
    if (!el) { return false; }
    live = { ev: ev, ctx: ctx };
    /* 일과(daily.js) "사건을 만난다" — quest 표엔 없던 kind 라 여기서 직접 한 줄 */
    if (global.DG.quest) { global.DG.quest.progress('event', 1); }

    var foe = ev.foe ? FOES[ev.foe] : null;
    var odds = foe ? Math.round(winChance(ev.foe) * 100) : 0;
    /* 만나자마자 실제로 세운다 — 전투든 아니든(2026-09-06, "글로만 보이면
       잼없지"). `duel.js`/`rogue-action.js`가 나중에 진짜 전투를 열 때
       또 한 번 같은 신호를 쏘지만(`openDuel()`), `duelStage()`는 그저
       다시 세우는 것뿐이라 문제없다 */
    var stage3d = stageOf(ev);
    core.emit('duel:open', { title: ev.name, foeName: foe ? foe.name : ev.name, stage3d: stage3d,
      mood: ev.mood, pose: ev.pose, eerie: ev.eerie });
    var portraitImg = (stage3d && stage3d.kind === 'hero' && global.DG.portrait3d)
      ? global.DG.portrait3d.img('hero', stage3d.ref, 96) : null;
    var html =
      '<div class="enc-card pingnew">' +
        '<div class="enc-big">' +
          (portraitImg
            ? portraitImg
            : '<span style="font-size:56px">' + ev.emoji + '</span>') +
        '</div>' +
        '<h3>' + ev.name + '</h3>' +
        '<p class="quote">' + ev.quote + '</p>' +
        (foe
          ? '<div class="enc-reward">' + foe.emoji + ' ' + foe.name + ' — ' + foe.note +
            ' · 이길 가망 <b>' + odds + '%</b></div>'
          : '') +
        '<div class="enc-choices">';
    for (var i = 0; i < ev.choices.length; i++) {
      html += '<button class="btn wide' + (i === 0 ? ' primary' : ' ghost') +
        '" data-pick="' + ev.choices[i].id + '">' + ev.choices[i].label + '</button>';
    }
    html += '</div></div>';
    el.innerHTML = html;
    el.classList.add('show');
    /* 걸으며 스치는 다른 창들과 달리 **찾아낸 것**이라는 티를 낸다
       (축1, 2026-09-06 "알림이 약하다" — 테두리 섬광은 CSS, 진동은 손끝) */
    if (global.navigator && navigator.vibrate) {
      try { navigator.vibrate(foe ? [40, 40, 40] : 35); } catch (e) { /* 지원 안 하면 조용히 넘어간다 */ }
    }

    var btns = el.querySelectorAll('[data-pick]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function (e) {
        choose(e.currentTarget.getAttribute('data-pick'));
      });
    }
    return true;
  }

  /** 교전 무대를 거칠까 — 손잡이가 켜져 있고 `duel.js` 가 있을 때만 */
  function useDuel() {
    return core.tuned('event.duel', 1) && global.DG.duel && global.DG.hero ? true : false;
  }

  /**
   * 싸움을 **진짜 교전으로** 연다 (PLAN 22절 "기존 시스템을 최대한 재사용한다").
   * 지금까지는 주사위 하나였다 — 이제 치고 피하고 필살을 지른 결과가 승패가 된다.
   * 무대가 끝나면 그 승패를 들고 원래 자리로 돌아와 `resolve` → `apply` 로 흐른다.
   */
  function openDuel(ev, cid, ctx, after) {
    var D = global.DG.rogueAction || global.DG.duel;
    var foe = FOES[ev.foe];
    var pw = global.DG.hero.partyPower();
    /* 적의 기세 — 힘에 비례한다. 싸움 하나가 대략 20~40초에 끝나게 잡았다 */
    var hp = Math.max(1, Math.round(foe.power * core.tuned('event.foeHpMul', 7)));
    close();                                   // 사건 카드를 걷고 무대를 연다
    D.open({
      title: ev.emoji + ' ' + ev.name,
      foeName: foe.name,
      emoji: foe.emoji,
      foeHp: hp, myAtk: pw.atk, myDef: pw.def,
      stage3d: foeVisual(foe),
      onDone: function (p) {
        /* 한 대도 못 때리고 물러났으면 **싸움 자체가 없던 것**으로 둔다 —
           빈손으로 도망친 것에 패배의 벌까지 얹지 않는다 */
        if (p.fled && p.dealt <= 0) { return; }
        var c2 = { tx: ctx.tx, ty: ctx.ty, kind: ctx.kind, mark: ctx.mark,
                   night: ctx.night, weather: ctx.weather, t: ctx.t, win: !!p.cleared };
        after(resolve(ev, cid, c2, 0.5), p);
      }
    });
  }

  /** 골랐다 — 결과를 내고, 주고, 결과 화면으로 바꾼다 */
  function choose(cid) {
    if (!live) { return null; }
    var c0 = choiceOf(live.ev, cid);
    /* 싸움을 고르면 무대로 넘어간다. 결과 화면은 무대가 끝난 뒤에 뜬다 */
    if (c0 && c0.fight && live.ev.foe && useDuel()) {
      var ev0 = live.ev, ctx0 = live.ctx;
      live = null;
      openDuel(ev0, cid, ctx0, function (res2, p) {
        if (res2) { showResult(res2, apply(res2), p); }
      });
      return { staged: true, ev: ev0, choice: c0 };
    }
    var res = resolve(live.ev, cid, live.ctx);
    if (!res) { return null; }
    var got = apply(res);
    live = null;
    showResult(res, got, null);
    return res;
  }

  /** 결과 화면 — 곧바로 고른 경우와 교전을 거친 경우가 **같은 화면**을 쓴다 */
  function showResult(res, got, p) {
    var el = host();
    if (!el) { return res; }
    var B = global.DG.bag;
    var rows = [];
    if (got.gold) { rows.push('🪙 금 ' + (got.gold > 0 ? '+' : '') + got.gold); }
    for (var i = 0; i < got.items.length; i++) {
      var d = B.def(got.items[i].key);
      rows.push(d.emoji + ' ' + d.name + ' ' + (got.items[i].n > 0 ? '+' : '') + got.items[i].n);
    }
    if (res.exp) { rows.push('경험치 +' + res.exp); }
    if (res.feat) { rows.push('🏅 공적 +' + res.feat); }
    if (res.fame) { rows.push('🎖️ 명성 ' + (res.fame > 0 ? '+' : '') + res.fame); }
    if (got.quest) { rows.push('📋 사명 — ' + got.quest.emoji + ' ' + got.quest.name); }
    /* 교전을 거쳤으면 그 자리에서 무엇을 했는지도 한 줄 — 주사위가 아니라
       **내가 친 결과**라는 것이 보여야 무대를 연 뜻이 산다 */
    if (p) {
      rows.push('⚔️ ' + p.hits + '타 · 필살 ' + p.ults + ' · 회피 ' +
        p.dodgeOk + '/' + p.dodgeTry + ' · ' + p.timeUsed + '초');
    }

    el.innerHTML =
      '<div class="enc-card">' +
        '<div class="enc-big"><span style="font-size:56px">' +
          (res.win === false ? '💢' : res.ev.emoji) + '</span></div>' +
        '<h3>' + res.ev.name + '</h3>' +
        '<p class="quote">' + res.text + '</p>' +
        (rows.length ? '<div class="enc-reward">' + rows.join(' · ') + '</div>' : '') +
        (res.record && res.ev.record
          ? '<div class="enc-reward">📖 새로운 기록 — ' + res.ev.record + '</div>' : '') +
        '<button class="btn primary wide" data-act="ok">닫는다</button>' +
      '</div>';
    el.classList.add('show');
    var ok = el.querySelector('[data-act="ok"]');
    if (ok) { ok.addEventListener('click', close); }
    return res;
  }

  /* ── 때 ───────────────────────────────────────────────
   * 걸은 거리로 잰다 — 걷는 게임이라 시계보다 이쪽이 맞고, 가만히 서 있으면
   * 아무 일도 안 생긴다(보급이 250m 마다 오는 것과 같은 결이다).
   */
  function mark() {
    var p = core.save.player;
    if (p.eventMark === undefined || p.eventMark > p.distance) { p.eventMark = p.distance; }
    return p.eventMark;
  }

  function tick() {
    if (!on() || global.DG_NO_DRAW) { return; }
    var p = core.save.player;
    var step = STEP();
    mark();
    var gap = p.distance - p.eventMark;
    if (gap < step) { return; }
    /* 걸음이 크게 뛴 판은 **한 번에 삼킨다.** 보급(`game.js`)은 밀린 몫을 다 주지만
       사건은 그러면 안 된다 — 옛 세이브를 열거나 배속으로 걸으면 카드가 우수수 뜬다
       (데모에서 실제로 밟았다: 거리를 12,840m 로 세워 두자 곧바로 터졌다) */
    if (gap > step * 2) { p.eventMark = p.distance; return; }
    p.eventMark += step;
    if (busy()) { return; }               // 다른 창이 열려 있으면 이번 몫은 거른다
    if (Math.random() >= CHANCE()) { return; }
    var ctx = contextAt(p.pos);
    var cs = candidates(ctx);
    if (!cs.length) { return; }
    var ev = pick(cs, Math.random());
    if (ev) { open(ev, ctx); }
  }

  /** 진단·데모가 특정 사건을 열어 볼 때 */
  function force(id, ctx) { return open(id, ctx); }

  function stats(pos, t) {
    var ctx = contextAt(pos || core.save.player.pos, t);
    var cs = candidates(ctx);
    return {
      on: on(), all: EVENTS.length, here: cs.length,
      kind: ctx.kind, mark: ctx.mark, night: ctx.night,
      names: cs.map(function (c) { return c.ev.id; }),
      power: myPower()
    };
  }

  global.DG = global.DG || {};
  global.DG.event = {
    EVENTS: EVENTS, FOES: FOES,
    on: on, find: find, choiceOf: choiceOf,
    /* 값을 내는 함수 — 순수하다. 세이브를 읽기만 한다 */
    contextAt: contextAt, candidates: candidates, pick: pick, resolve: resolve,
    myPower: myPower, winChance: winChance, fightRoll: fightRoll, foeVisual: foeVisual, npcVisual: npcVisual,
    stageOf: stageOf,
    /* 세이브가 바뀌는 곳은 여기 하나 */
    apply: apply,
    /* 화면과 때 */
    open: open, close: close, choose: choose, tick: tick, force: force, stats: stats,
    useDuel: useDuel, showResult: showResult,
    get live() { return live; }
  };
})(window);
