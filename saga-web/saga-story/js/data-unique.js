/**
 * 고유(固有) — 이름이 있는 장비
 * ---------------------------------------------------------------
 * 사가나락(`saga-dungeon/js/data-unique.js`)의 패턴을 옮긴 것이다. 핵앤슬래시 원작의
 * 유니크처럼 "정해진 물건"을 두어, 같은 부위의 장비를 주워도 "이번엔 뭐가 나왔나"
 * 이상의 것 — **이름을 부르며 찾아다니는 물건**이 있게 한다.
 *
 * 이 판은 접사(옵션이 무작위로 붙는 것)가 없다 — 장비 값은 표에 적힌 그대로다
 * (`data-gear.js`). 그래서 고유도 같은 결로 둔다: **밑감(각 부위의 Lv.20 물건) 위에
 * 고정된 보너스를 얹은, 표에 적힌 값 그대로 나오는 물건**이다. 접사를 굴리지
 * 않는다는 점만 사가나락와 같고, 등급·소켓 같은 그 판만의 개념은 옮기지 않았다 —
 * 이 판에 그 개념 자체가 없다.
 *
 * 부위마다 **하나씩**, 열 개다(2026-09-11, 장신구 셋 추가로 일곱 → 열).
 * 늘릴 때는 UNIQUES 에 한 줄 (밑감 하나에 하나씩).
 *
 * 나올 때 — **보스만** 떨군다(그 확률은 `gear.js` 의 `rollDrop` 이 쥔다), 그리고
 * **밑감이 Lv.20(그 부위의 마지막 단)일 때만** 고유로 바뀔 수 있다. 낮은 단의
 * 물건이 고유가 되면 정작 표에서 가장 좋은 장비보다 세져 버려 어색해진다.
 */
(function (global) {
  'use strict';

  /**
   * key   세이브에 남는 물건 key (바꾸면 옛 세이브의 고유가 이름을 잃는다)
   * base  밑감 — `data-gear.js` GEAR 의 key. 이 밑감의 Lv.20 물건에서만 나온다
   * slot·need·up 은 밑감과 같은 자리를 그대로 물려받는다(부위·요구 레벨·업횟 상한)
   * atk·def·hp  밑감의 값 위에 얹는 것이 아니라 **이 물건의 최종 값**이다(사가나락처럼
   *             밑감+접사 합이 아니라, "정해진 물건"이니 표에 적힌 값 그대로 쓴다)
   */
  var UNIQUES = [
    { key: 'u_sword',  base: 'sword4', slot: 'weapon', need: 20, up: 9,
      name: '진룡도(震龍刀)', price: 42000, atk: 56, def: 2, hp: 0,
      desc: '용이 잠에서 깨어난다는 검. 휘두르면 울림이 남는다.' },
    { key: 'u_hat',    base: 'hat4',   slot: 'hat',    need: 20, up: 9,
      name: '봉황관(鳳凰冠)', price: 32000, atk: 2, def: 22, hp: 70,
      desc: '봉황 깃을 세운 투구. 쓰면 눈이 밝아진다.' },
    { key: 'u_top',    base: 'top4',   slot: 'top',    need: 20, up: 9,
      name: '현무갑(玄武甲)', price: 36000, atk: 2, def: 28, hp: 100,
      desc: '검은 거북 무늬를 두른 갑옷. 웬만한 타격은 튕겨 낸다.' },
    { key: 'u_bottom', base: 'bot4',   slot: 'bottom', need: 20, up: 8,
      name: '천리군(千里裙)', price: 30000, atk: 0, def: 20, hp: 75,
      desc: '천 리를 걸어도 해지지 않는다는 전군(戰裙).' },
    { key: 'u_shoes',  base: 'shoe4',  slot: 'shoes',  need: 20, up: 8,
      name: '분마화(奔馬靴)', price: 26000, atk: 2, def: 16, hp: 50,
      desc: '달리는 말처럼 가볍다는 신. 딛는 곳마다 먼지가 인다.' },
    { key: 'u_glove',  base: 'glv4',   slot: 'glove',  need: 20, up: 9,
      name: '호랑수갑(虎狼手甲)', price: 34000, atk: 18, def: 12, hp: 30,
      desc: '범과 이리를 맨손으로 잡았다는 수갑. 쥔 손에 힘이 붙는다.' },
    { key: 'u_cape',   base: 'cap4',   slot: 'cape',   need: 20, up: 9,
      name: '봉래포(蓬萊袍)', price: 28000, atk: 3, def: 16, hp: 80,
      desc: '봉래산 구름을 짜 넣었다는 망토. 걸치면 등이 든든하다.' },
    { key: 'u_ring',   base: 'ring4',  slot: 'ring',   need: 20, up: 8,
      name: '구룡지환(九龍指環)', price: 24000, atk: 26, def: 3, hp: 34,
      desc: '아홉 마리 용이 서로를 물고 도는 반지. 낀 손에 기운이 감돈다.' },
    { key: 'u_necklace', base: 'neck4', slot: 'necklace', need: 20, up: 8,
      name: '영롱주(玲瓏珠)', price: 22000, atk: 2, def: 10, hp: 78,
      desc: '속이 비칠 듯 맑은 구슬을 꿴 목걸이. 지니면 숨이 고르다.' },
    { key: 'u_earring', base: 'ear4', slot: 'earring', need: 20, up: 8,
      name: '월아환(月牙環)', price: 22000, atk: 13, def: 13, hp: 24,
      desc: '초승달 모양의 귀걸이. 걸치면 밤에도 눈이 밝다.' }
  ];

  function find(key) {
    for (var i = 0; i < UNIQUES.length; i++) { if (UNIQUES[i].key === key) { return UNIQUES[i]; } }
    return null;
  }

  /** 이 밑감(Lv.20 물건)이 고유로 바뀔 수 있다면 그 고유를 준다 */
  function forBase(baseKey) {
    for (var i = 0; i < UNIQUES.length; i++) { if (UNIQUES[i].base === baseKey) { return UNIQUES[i]; } }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.uniqueData = { UNIQUES: UNIQUES, find: find, forBase: forBase };
})(window);
