/**
 * 시나리오 표 — 사가국지 "천하와 균열" (정본 `../../../scenario/saga-realm.md`)
 * ---------------------------------------------------------------
 * 지금은 **1막 · 군웅(과거 중심) 사건 카드 셋**만 있다. 2막~은 이 표 끝에 카드를 덧붙이면 된다.
 * 사가국지의 이야기는 "줄로 가는 퀘스트"가 아니라 **때가 되면 터지는 사건 카드**다 — 그래서 사가스토리처럼 단계를 밟지 않고,
 * `event.js` 의 사연 카드(세 갈래 고르기)를 그대로 쓴다. 카드는 사람 세력에게만, 정해진 때에, 표 순서대로 하나씩 뜬다.
 *
 * 한 카드 = { id, no, act, title, emoji, when:{ minTurn, orCities? }, mix, text, choices }
 *   when   시작한 뒤 minTurn 달이 지났거나(또는 orCities 성 이상을 가졌으면) 뜬다
 *   mix    시대 섞기 — 과거·현대·미래가 **셋 다** 있어야 한다(시나리오 README §1-4, 진단이 지킨다)
 *   text   {책사}(수도의 지력 최고 장수)·{이웃}(다른 세력 군주) 칸이 있다 — 누가 뽑혀도 맞는 도감 가명
 *   choices 세 갈래 atk·def·util — { k, label, hint, cost?, fx:[{ t, n }], text }
 *     fx.t  gold(금) · food(수도 군량) · sec(수도 치안) · train(수도 훈련) · loyal(책사 충성) · rel(이웃과 우호)
 * 이미 있는 손잡이(금·성 값·충성·우호)만 만진다 — 새 판정을 만들지 않는다.
 */
(function (global) {
  'use strict';

  var TAG = '📖 1막 · 중원의 난';

  var CARDS = [
    { id: 'r1_start', no: 1, act: 1, title: '첫 성의 밤', emoji: '🗺️', tag: TAG, when: { minTurn: 0 },
      mix: { past: '{책사}·천하 지도', now: '지도 위에 떨어진 볼펜', future: '지도 가장자리의 빛 얼룩' },
      text: '{책사} 이(가) 천하 지도를 펴고 첫 목표를 묻는다. 지도 끝에는 어제까지 없던 땅이 희미하게 그려져 있다. 지도 위에는 이 시대 것이 아닌 볼펜 한 자루가 떨어져 있고, 가장자리로 빛 얼룩이 번져 간다.',
      choices: [
        { k: 'atk', label: '이웃 땅으로 넓히자', hint: '수도 군량 +1500 · 훈련 +5', fx: [{ t: 'food', n: 1500 }, { t: 'train', n: 5 }], text: '{책사} 이(가) 첫 출정 길을 그었다 — 곳간이 든든해졌다' },
        { k: 'def', label: '성부터 다지자', hint: '수도 치안 +8 · 책사 충성 +3', fx: [{ t: 'sec', n: 8 }, { t: 'loyal', n: 3 }], text: '성문과 곳간을 손보았다 — {책사} 이(가) 믿음을 얻었다' },
        { k: 'util', label: '빛 얼룩부터 살핀다', hint: '금 +500', fx: [{ t: 'gold', n: 500 }], text: '얼룩 근처에서 옛 주화 꾸러미가 나왔다' }
      ] },

    { id: 'r1_rift_sign', no: 2, act: 1, title: '균열의 울림', emoji: '🌌', tag: TAG, when: { minTurn: 12 },
      mix: { past: '봉화대', now: '금 아래 떨어진 자동차', future: '금에서 새는 빛' },
      text: '북쪽 하늘에 가느다란 금이 갔다. 봉화대 병사가 금 아래에서 낯선 수레를 보았다 — 쇠 껍질에 바퀴가 달렸고 안은 비어 있다. 금에서는 옅은 빛이 새어 나오며, 바람이 그쪽으로 빨려 든다.',
      choices: [
        { k: 'atk', label: '봉화를 올려 널리 알린다', hint: '수도 훈련 +8', fx: [{ t: 'train', n: 8 }], text: '봉화가 이어 오르자 군사의 기세가 올랐다' },
        { k: 'def', label: '성문을 닫고 살핀다', hint: '수도 치안 +8', fx: [{ t: 'sec', n: 8 }], text: '성문을 닫고 지켜보니 백성이 안심했다' },
        { k: 'util', label: '척후를 금 아래로 보낸다', hint: '금 +300 · 책사 충성 +3', fx: [{ t: 'gold', n: 300 }, { t: 'loyal', n: 3 }], text: '척후가 수레 안에서 쓸 만한 것을 가져왔다' }
      ] },

    { id: 'r1_first_ally', no: 3, act: 1, title: '첫 화친', emoji: '🕊️', tag: TAG, when: { minTurn: 24, orCities: 5 },
      mix: { past: '사신·예물', now: '재야 논객의 설전', future: '예물 속 빛 부적' },
      text: '{이웃} 의 사신이 예물을 들고 왔다. 예물 속에는 빛나는 부적이 섞여 있고, 재야의 한 논객이 끼어들어 "손잡는 편이 덜 잃는다" 며 설전을 청한다. 싸울지 손잡을지 정해야 한다.',
      choices: [
        { k: 'atk', label: '선전 포고로 답한다', hint: '이웃 우호 -20 · 수도 훈련 +8', fx: [{ t: 'rel', n: -20 }, { t: 'train', n: 8 }], text: '예물을 돌려보냈다 — 국경에 긴장이 돈다' },
        { k: 'def', label: '화친을 받아들인다', hint: '이웃 우호 +25', fx: [{ t: 'rel', n: 25 }], text: '설전 끝에 화친 조건을 더 얻어 냈다' },
        { k: 'util', label: '예물을 더해 우호를 산다', hint: '금 300 · 이웃 우호 +12', cost: 300, fx: [{ t: 'rel', n: 12 }], text: '예물을 더해 보내니 사신이 웃었다' }
      ] }
  ];

  function card(id) {
    for (var i = 0; i < CARDS.length; i++) { if (CARDS[i].id === id) { return CARDS[i]; } }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.scenarioData = { CARDS: CARDS, card: card };
})(window);
