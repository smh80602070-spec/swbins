/**
 * 삼국지 — 보물(寶物)
 * ---------------------------------------------------------------
 * 원작의 "보물"(무장이 지니면 능력치가 오르는 물건)을
 * 이 판의 결로 가볍게 옮겼다. 실존 인물과 얽힌 이름(예: 유명한 명마·보검의
 * 원래 주인)은 쓰지 않는다 — 전부 가상의 물건이다(루트 CLAUDE.md 이름 정책).
 *
 * v1 범위 — **장비창을 만들지 않는다.** 무장 하나가 한 번에 하나만 지니고,
 * `war.js`의 원정 사건("유물 발견")이 원정 간 장수 중 하나에게 곧바로
 * 씌운다(이미 지닌 게 있으면 갈아 끼운다). 시장에서 사고팔거나 장수끼리
 * 건네주는 것은 범위 밖 — 필요해지면 그때 얹는다.
 *
 * **`global.DG.item` 으로 등록한다 — 이름이 곧 계약이다.** `hero.js`(다섯
 * 판이 나눠 가진 공유 파일)는 이미 `gearOf()`가 `global.DG.item.statBonus(id)`
 * 를 불러 장비 보정을 계산에 넣도록 짜여 있다(장비 모듈이 없으면 0을 준다 —
 * 그래서 이 판은 지금까지 손 안 대고도 멀쩡히 돌았다). `saga-dungeon/js/item.js`
 * 가 `{flat, pct}` 모양으로 이미 그 계약을 지키고 있어, 여기서도 같은 모양만
 * 맞추면 hero.js 쪽은 한 글자도 안 건드리고 "화면과 판정이 갈라지지 않는다"
 * 원칙을 그대로 물려받는다.
 */
(function (global) {
  'use strict';

  var ITEMS = [
    { id: 'itm_ironblade', name: '무쇠검', emoji: '🗡️', stat: 'might',   bonus: 6,
      desc: '날이 벼려진 채로 전해 내려온 검.' },
    { id: 'itm_warhorse',  name: '준마',   emoji: '🐎', stat: 'might',   bonus: 10,
      desc: '하루에 천 리를 달린다는 말.' },
    { id: 'itm_armor',     name: '보갑',   emoji: '🛡️', stat: 'might',   bonus: 8,
      desc: '화살도 뚫지 못하는 갑옷.' },
    { id: 'itm_scroll',    name: '병서',   emoji: '📜', stat: 'wisdom',  bonus: 6,
      desc: '옛 병가의 계책이 적힌 두루마리.' },
    { id: 'itm_compass',   name: '나침반', emoji: '🧭', stat: 'wisdom',  bonus: 10,
      desc: '산길에서도 방향을 잃지 않게 해 준다.' },
    { id: 'itm_jade',      name: '옥패',   emoji: '💎', stat: 'wisdom',  bonus: 8,
      desc: '몸에 지니면 마음이 가라앉는다는 옥.' },
    { id: 'itm_seal',      name: '인수',   emoji: '🔶', stat: 'command', bonus: 6,
      desc: '위엄을 세우는 관인.' },
    { id: 'itm_drum',      name: '전고',   emoji: '🥁', stat: 'command', bonus: 10,
      desc: '북소리 하나로 군세를 다잡는다.' },
    /* 2026-09-11 — 균열·폐허·묘역(현대·미래·판타지 세 지역)을 만들고 나서
       "유물"도 그 세계관에 맞게 늘렸다. `randomItem()`이 배열 전체에서
       고르는 순수 확률표라 이 셋을 더해도 판정 코드는 한 글자도 안
       바뀐다 — hero.js 계약(`statBonus`)도 그대로다. */
    { id: 'itm_timeshard', name: '시간의 파편', emoji: '⏳', stat: 'wisdom', bonus: 9,
      desc: '균열에서 흘러나온 조각. 지니면 앞일이 어렴풋이 보인다.' },
    { id: 'itm_purifier',  name: '정화 장치',   emoji: '🧪', stat: 'might',  bonus: 9,
      desc: '오염을 씻어내는 장치. 몸에 지니면 숨쉬기가 한결 낫다.' },
    { id: 'itm_boneseal',  name: '해골의 인장', emoji: '💀', stat: 'command', bonus: 9,
      desc: '주인 없는 인장. 지니면 죽은 자도 따른다는 말이 있다.' }
  ];

  function itemById(id) {
    for (var i = 0; i < ITEMS.length; i++) { if (ITEMS[i].id === id) { return ITEMS[i]; } }
    return null;
  }

  function randomItem() { return ITEMS[Math.floor(Math.random() * ITEMS.length)]; }

  /**
   * hero.js `gearOf()` 가 부르는 계약대로 `{flat, pct}` 를 낸다.
   * `off.has(id)` 로 미리 걸러 — 세이브에 아직 없는(한 번도 못 만난) 무장의
   * 스탯을 조회했다고 `off.rec()` 이 빈 기록을 새로 만들어 버리면 안 된다.
   */
  function statBonus(heroId) {
    var out = { flat: { might: 0, wisdom: 0, command: 0 }, pct: { might: 0, wisdom: 0, command: 0 } };
    var off = global.DG.off;
    if (!off || !off.has(heroId)) { return out; }
    var it = itemById(off.rec(heroId).item);
    if (it) { out.flat[it.stat] += it.bonus; }
    if (global.DG.treasureSet) { global.DG.treasureSet.apply(heroId, out); }   // W-0440 같은 세력이 나눠 지닌 세트
    return out;
  }

  /**
   * 등급(아이템·장비 등급 체계 — 사용자 요청 2026-09-10, 이 판 적용 2026-09-20) — 보물은 굴리는 값이 없어 **보너스 크기에서 읽는다**:
   * +6 기본 · +8 상급 · +9 희귀 · +10 영웅(이 표에 전설은 없다 — 새 보물이 +12 이상이면 전설).
   * 이름·색·별은 무장 도감이 쓰는 `data.js` 의 `RARITY` 와 같다. 값·세이브에는 안 닿는다 — 보이는 이름표뿐이다.
   */
  function gradeOf(it) {
    var b = it ? it.bonus : 0;
    var r = b >= 12 ? 5 : b >= 10 ? 4 : b >= 9 ? 3 : b >= 8 ? 2 : 1;
    var R = global.DG && global.DG.data && global.DG.data.rarity && global.DG.data.rarity[r];
    return { rank: r, name: R ? R.name : '', color: R ? R.color : '#9aa4b2', label: R ? R.label : '' };
  }

  global.DG = global.DG || {};
  global.DG.item = { ITEMS: ITEMS, itemById: itemById, randomItem: randomItem, statBonus: statBonus, gradeOf: gradeOf };
})(window);
