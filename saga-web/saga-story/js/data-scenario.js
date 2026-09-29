/**
 * 시나리오 표 — 사가스토리 "이름 없는 떠돌이" (정본 `../../../scenario/saga-story.md`)
 * ---------------------------------------------------------------
 * 지금은 **1부 · 무명(과거 중심, Lv 1~10) 네 장**만 있다. 2부~는 이 표 끝에 장을 덧붙이면 된다.
 * 인물은 전부 가상이다(이름 정책) — 'me' 는 앞에 세운 도감 인물, 'mentor' 는 그 갈래의 스승(도감 가명).
 *
 * 한 장 = { id, no, title, stage, need, after, mix, steps, reward, blurb }
 *   need   열리는 레벨 · after  먼저 끝나야 하는 장 id
 *   mix    시대 섞기 — 과거·현대·미래가 **셋 다** 있어야 한다(시나리오 README §1-4, 진단이 지킨다)
 *   steps  차례대로 하나씩 — 아래 넷 중 하나
 *     { t: 'stage',   stage: 사냥터 key }           그 사냥터에 들어선다
 *     { t: 'talk',    scene: 장면 id, at?: key }    대사 장면(at 이 있으면 그 사냥터 안에서만 뜬다)
 *     { t: 'mission', quest: 사명 key }             그 사명을 바친다(레벨이 되면 저절로 받는다)
 *     { t: 'job',     tier: 1 }                     n차 전직을 한다
 *   reward { exp, gold, potion, scroll, title }     title 'job' = "이름 없는 " + 방금 고른 직업 이름
 *
 * 장면 한 줄 = [누가, 감정, 말] — `data-side.js` 의 STORY 와 같은 틀(EMOTES 키).
 */
(function (global) {
  'use strict';

  var CAST = {
    deokbo:  { name: '신야성 촌로 덕보', emoji: '🧓' },
    courier: { name: '택배 기사',        emoji: '📦' },
    sori:    { name: '척후병 소리',      emoji: '🐎' },
    mentor:  { name: '첫 스승',          emoji: '🥋' }
  };

  var SCENES = {
    sinya1: { title: '제1장 · 서막', lines: [
      ['deokbo', 'worry', '성 밖이 도적 천지라네. 그런데 자네, 이름이 어떻게 되나?'],
      ['me', 'shock', '…기억나지 않습니다. 서쪽에서 걸어왔다는 것밖에는.'],
      ['deokbo', 'calm', '이름 없는 떠돌이라. 요즘은 그런 사람이 많지. 성 밖에서 주운 건데, 이 네모난 판이 자네 것인가? 만지면 불이 들어와.'],
      ['me', 'shock', '처음 봅니다. 그런데… 손에 익습니다.'],
      ['deokbo', 'worry', '도적 하나는 칼 대신 푸른 빛이 나는 검을 들었다더군. 예삿놈들이 아닐세.'],
      ['me', 'fire', '그럼 길부터 트겠습니다. 들판에서 열을 베고 오지요.']
    ] },
    sinya2: { title: '제1장 · 서막', lines: [
      ['deokbo', 'joy', '벌써 열을 베고 왔나! 이름 없는 손이 제일 빠르다더니.'],
      ['deokbo', 'calm', '허도로 가게. 장터에 없는 것이 없어. 신야성 밖 소식도 그리로 모이지.']
    ] },
    heodo1: { title: '제2장 · 허도 가는 길', lines: [
      ['courier', 'shock', '저기요! 이 짐, 주소가 없어요. 받는 이 칸에 옛 땅 이름만 잔뜩이고…'],
      ['courier', 'worry', '상자를 흔들면 푸른 빛이 지도처럼 펼쳐져요. 이런 길은 어디에도 없는데.'],
      ['me', 'calm', '길이 없어도 짐은 어디론가 가려던 것이겠지요. 저도 몸부터 갖춰야겠습니다.']
    ] },
    heodo2: { title: '제2장 · 허도 가는 길', lines: [
      ['courier', 'joy', '든든해 보이시네요! 저자가 이 근방에서 제일 큽니다. 부족하면 언제든 들르세요.'],
      ['courier', 'calm', '짐은… 제가 좀 더 헤매 보겠습니다. 들판 소식이 궁금하시면 척후병을 찾으세요.']
    ] },
    field1: { title: '제3장 · 허창 들판의 두목', lines: [
      ['sori', 'worry', '황건 두목의 진에 요즘 못 보던 병기가 들어갔소. 잿빛 떼쥐가 뛰고, 하늘엔 작은 눈알 같은 것이 뜨오.'],
      ['me', 'shock', '눈알 같은 것이라니, 정찰 짐승입니까?'],
      ['sori', 'anger', '짐승이 아니라 날아다니는 쇠붙이요. 들판을 비우지 않고는 두목 근처에도 못 가오.'],
      ['me', 'fire', '먼저 들판을 비우고, 그다음에 두목의 목을 보겠습니다.']
    ] },
    field2: { title: '제3장 · 허창 들판의 두목', lines: [
      ['sori', 'joy', '두목이 쓰러졌소! 진 한복판에서 푸른 빛 조각이 나왔는데, 누가 남긴 건지 모르겠소.'],
      ['me', 'worry', '누가 대 주지 않고서야 도적이 저런 병기를 가질 수 없지요.'],
      ['sori', 'calm', '이제 허도의 스승을 찾아가 보시오. 열 번은 넘게 해가 진 자라면 배울 자격이 있소.']
    ] },
    job1: { title: '제4장 · 첫 스승', lines: [
      ['mentor', 'calm', '이름 없는 자가 제일 빨리 배운다. 이름에 매여 있지 않으니까.'],
      ['mentor', 'fire', '저 표적지를 보아라. 누가 세웠는지 모르나, 이 땅의 것이 아닌 나무로 만들었다. 내 무기도 그렇다. 어느 시대 것인지 나도 모른다.'],
      ['mentor', 'calm', '🥋 무예창을 열어 네 길을 골라라. 무사·궁수·협객·방사 — 고른 길이 네 첫 이름이 된다.']
    ] },
    job2: { title: '제4장 · 첫 스승', lines: [
      ['mentor', 'joy', '골랐구나. 이제 너는 이름 없는 채로 한 갈래를 얻었다.'],
      ['mentor', 'calm', '동쪽 강릉진 부두에 쇠로 된 배가 걸려 있다더라. 그 배의 사진을 찍는 여행자가 있다지 — 만나 보아라.'],
      ['me', 'fire', '가겠습니다. 이름은 가는 길에서 찾지요.']
    ] }
  };

  var CHAPTERS = [
    { id: 'p1_sinya', no: 1, title: '서막 · 신야성', stage: '신야성', need: 1, after: null,
      blurb: '이름을 묻는 촌로 앞에서 대답하지 못한다. 성 밖은 도적 천지다.',
      mix: { past: '성문·촌로', now: '성 밖에서 주운 휴대폰', future: '도적이 든 빛 칼' },
      steps: [
        { t: 'stage', stage: 'sinya' },
        { t: 'talk', scene: 'sinya1', at: 'sinya' },
        { t: 'mission', quest: 'q_first' },
        { t: 'talk', scene: 'sinya2' }
      ],
      reward: { exp: 80, gold: 300 } },

    { id: 'p1_heodo', no: 2, title: '허도 가는 길', stage: '허도', need: 1, after: 'p1_sinya',
      blurb: '허도 장터의 택배 기사가 주소 없는 짐을 들고 헤맨다.',
      mix: { past: '허도 장터', now: '택배 기사', future: '짐 속 빛 지도' },
      steps: [
        { t: 'stage', stage: 'heodo' },
        { t: 'talk', scene: 'heodo1', at: 'heodo' },
        { t: 'mission', quest: 'q_gear1' },
        { t: 'talk', scene: 'heodo2' }
      ],
      reward: { exp: 150, gold: 500, potion: 3 } },

    { id: 'p1_field', no: 3, title: '허창 들판의 두목', stage: '허창 들판', need: 1, after: 'p1_heodo',
      blurb: '척후병과 들판을 정찰한다. 황건 두목의 진에 다른 시대의 병기가 섞였다.',
      mix: { past: '황건적', now: '잿빛 떼쥐', future: '정찰 드론' },
      steps: [
        { t: 'stage', stage: 'field' },
        { t: 'talk', scene: 'field1', at: 'field' },
        { t: 'mission', quest: 'q_field' },
        { t: 'mission', quest: 'q_boss1' },
        { t: 'talk', scene: 'field2' }
      ],
      reward: { exp: 400, gold: 1200, scroll: 'def100' } },

    { id: 'p1_job', no: 4, title: '첫 스승', stage: '허도', need: 10, after: 'p1_field',
      blurb: '허도의 스승에게 첫 전직을 배운다. "이름 없는 자가 제일 빨리 배운다."',
      mix: { past: '스승 도장', now: '연습용 표적지', future: '스승이 가진 시대 모를 무기' },
      steps: [
        { t: 'talk', scene: 'job1', at: 'heodo' },
        { t: 'job', tier: 1 },
        { t: 'talk', scene: 'job2' }
      ],
      reward: { exp: 600, gold: 2000, title: 'job' } }
  ];

  function chapter(id) {
    for (var i = 0; i < CHAPTERS.length; i++) { if (CHAPTERS[i].id === id) { return CHAPTERS[i]; } }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.scenarioData = { CAST: CAST, SCENES: SCENES, CHAPTERS: CHAPTERS, chapter: chapter };
})(window);
