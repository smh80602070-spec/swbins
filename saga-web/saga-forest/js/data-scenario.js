/**
 * 시나리오 표 — 사가의숲 "하늘 금 우체통" (정본 `../../../scenario/saga-forest.md`)
 * ---------------------------------------------------------------
 * 지금은 **봄 · 옛 우체통(과거 중심) 네 장**만 있다. 여름~은 이 표 끝에 장을 덧붙이면 된다.
 * 싸움도 실패도 없다 — 장은 "하루에 조금씩" 크기고, 단계는 며칠에 걸쳐도 된다.
 * 인물은 전부 가상이다(이름 정책) — 'me' 는 마을 주인공(내 아바타 인물의 도감 가명).
 *
 * 한 장 = { id, no, season, title, stage, after, mix, steps, reward, blurb }
 *   mix   시대 섞기 — 과거·현대·미래가 **셋 다** 있어야 한다(시나리오 README §1-4, 진단이 지킨다)
 *   steps 차례대로 하나씩 — 아래 여덟 중 하나
 *     { t: 'talk',    scene: 장면 id }            대사 장면(글 상자) — 마을 어디서나
 *     { t: 'place',   n }                        집에 가구를 n 개 놓는다(가구는 처음 주는 기본 한 벌로 된다)
 *     { t: 'deliver', n }                        택배를 이 단계 시작 뒤 n 번 배달한다(접수대 ↔ 배달원)
 *     { t: 'forest',  key }                      그 이름 있는 숲에 든다
 *     { t: 'go',      spot }                     그 고정 자리(ruin 폐허)에 선다
 *     { t: 'gather',  cat, n }                   그 갈래(flower 꽃…)를 이 단계 시작 뒤 n 번 채집한다
 *     { t: 'fest',    key }                      그 행사 놀이를 올해 끝낸다 — 그날이 아니면 **기념 놀이**로 열어 준다(실제 달력을 기다리지 않는다)
 *     { t: 'heart',   n }                        주민·인물 누구든 하트 n 이상
 *     { t: 'donate',  cat, n }                   사고에 그 갈래(fossil 화석…)를 n 점 기증해 채운다
 *   reward { gold, exp, feat }
 *
 * 장면 \`choice: { id, prompt, options:[{ key, label }] }\` — 마지막 줄 뒤 고르기 단추. 답은 \`save.village.scenario.choices[id]\`.
 * 장면 한 줄 = [누가, 말] — 누가 = 'me' 또는 CAST 키.
 */
(function (global) {
  'use strict';

  var CAST = {
    keeper:  { name: '숲지기 솔바람',    emoji: '🌲' },
    dareum:  { name: '택배 기사 달음',   emoji: '📦' },
    hoyeon:  { name: '여우 화상 호연',   emoji: '🦊' },
    k7:      { name: '시간 여행자 K-7',  emoji: '⌛' }
  };

  var SCENES = {
    move1: { title: '봄 · 이사 오던 날', lines: [
      ['keeper', '이사 온 첫 밤이 저물었구려. 짐은 다 풀었소? 이 숲은 초가 지붕 사이로 별이 잘 들어오는 곳이라오.'],
      ['me', '짐을 풀다 보니 저 하늘에 가느다란 금이 하나 보입니다. 별똥별이 지나간 자국인가요?'],
      ['keeper', '금이라니… 이 늙은이는 처음 보오. 우선 집에 가구 하나라도 놓고 보시오. 집이 서야 마음이 놓이지.']
    ] },
    move2: { title: '봄 · 이사 오던 날', lines: [
      ['dareum', '으아아! 여기가 어디죠? 택배 기사 달음입니다! 금이 쫙 갈라지더니 이 소포와 함께 떨어졌어요.'],
      ['dareum', '받는 이가 "이 마을 새 이웃"인데, 보낸 날짜가 먼 앞날이에요. 상자 속에서 빛 편지가 새어 나오고요.'],
      ['keeper', '먼 앞날에서 온 소포라니. 접수대에 알려 배달 일부터 해 보시오. 그 길에 뭔가 보일 게요.']
    ] },
    post1: { title: '봄 · 폐허의 옛 우체통', lines: [
      ['keeper', '빛 편지가 가리키는 곳이 있소 — 탑성 폐허의 옛 우체통이오. 오래전 이곳을 오가던 편지가 지금도 쌓여 있다 하오.'],
      ['dareum', '억새 바람벌을 지나서 폐허까지 가면 된대요! 폐허 옆에는 오래된 공중전화가 서 있다던데, 우체통이 왜 전화 곁에 있을까요.']
    ] },
    post2: { title: '봄 · 폐허의 옛 우체통', lines: [
      ['me', '우체통이 정말 있었습니다. 안에는 붓글씨 편지, 택배 송장, 빛나는 홀로그램 도장이 찍힌 편지까지 섞여 있어요.'],
      ['keeper', '여러 시대의 편지가 한 통에 쌓였구려. 이 우체통이 버려진 채 오래 되어 시대 사이 우체통이 된 모양이오.'],
      ['dareum', '그럼 하늘의 금은 이 우체통이 부른 길이에요? 이 편지들을 마을로 배달해 봐요!']
    ] },
    fox1: { title: '봄 · 여우 화상의 봄 장터', lines: [
      ['hoyeon', '어이쿠, 금 사이로 넘어와 버렸군. 여우 화상 호연이오. 시대를 잃은 물건을 파는 장사꾼이지. 이 빛 부채는 앞날 것이고, 저 옛 방울은 이 땅 것이오.'],
      ['me', '삼짇날 꽃놀이를 연다는 소문이 있던데요, 장터를 그날 맞춰 열 수 있을까요?'],
      ['hoyeon', '꽃 다섯 송이만 모아 오시오. 꽃놀이에 쓸 꽃 좌판을 내가 펼치겠소.']
    ] },
    fox2: { title: '봄 · 여우 화상의 봄 장터', lines: [
      ['hoyeon', '꽃놀이 안내판 곁에 좌판을 폈소. 확성기가 딸린 장터라 소리가 멀리 가지. 꽃놀이를 마치면 이 마을에서 장사를 해도 되겠소?'],
      ['keeper', '이 마을에는 새 이웃이 반갑소. 호연 좌판은 마을 상점 칸에 내주지.']
    ] },
    fox3: { title: '봄 · 여우 화상의 봄 장터', lines: [
      ['hoyeon', '꽃놀이가 끝났구려. 빛 부채가 한 자루 남았소, 선물로 받아 두시오.'],
      ['me', '한 주민과 마음이 통했습니다. 이 마을이 좋아지고 있어요.']
    ] },
    mus1: { title: '봄 · 사고를 채우다', lines: [
      ['k7', '…착륙 성공. 시간 여행자 K-7, 기록원입니다. 저는 앞날의 기록을 들고 왔어요. 이 숲의 기록 칸은 "사라진 숲"입니다.'],
      ['me', '사라진 숲이라니요? 이 마을이 없어진다는 뜻입니까?'],
      ['k7', '잊힌 곳은 앞날에서 지워집니다. 사고에 화석을 채우면 그 줄이 흐려지는 걸 확인했어요. 화석 다섯 점만 넣어 보시겠습니까?']
    ] },
    mus2: { title: '봄 · 사고를 채우다', lines: [
      ['k7', '기록판의 "사라진 숲"이 한 줄 흐려졌습니다! 이 마을이 기억되기 시작했다는 뜻이에요. 그런데 부탁이 하나 있습니다.'],
      ['k7', '앞날 기록에 이 마을 이름을 적어 두고 싶습니다. 알려 주시겠어요?'],
      ['me', '마을 이름을 알려 주는 건 이 마을의 미래를 맡기는 일이지요. 정하겠습니다.']
    ], choice: { id: 'name', prompt: 'K-7 에게 마을 이름을 알려 줄까', options: [{ key: 'tell', label: '알려 준다' }, { key: 'secret', label: '비밀로 한다' }] } }
  };

  var CHAPTERS = [
    { id: 'sp_move', no: 1, season: 'spring', title: '이사 오던 날', stage: '마을 · 접수대', after: null,
      blurb: '짐을 풀던 밤, 하늘에 금이 가고 택배 기사 달음이 소포와 함께 떨어진다.',
      mix: { past: '초가·숲지기', now: '달음·택배 상자', future: '소포 속 빛 편지' },
      steps: [
        { t: 'talk', scene: 'move1' },
        { t: 'place', n: 1 },
        { t: 'talk', scene: 'move2' },
        { t: 'deliver', n: 1 }
      ],
      reward: { gold: 300, exp: 60 } },

    { id: 'sp_postbox', no: 2, season: 'spring', title: '폐허의 옛 우체통', stage: '억새 바람벌 → 탑성 폐허', after: 'sp_move',
      blurb: '빛 편지가 가리키는 곳 — 탑성 폐허의 옛 우체통. 안에 여러 시대 편지가 쌓여 있다.',
      mix: { past: '탑성 폐허·옛 우체통', now: '우체통 옆 공중전화', future: '편지 속 홀로그램 도장' },
      steps: [
        { t: 'talk', scene: 'post1' },
        { t: 'forest', key: 'eoksae' },
        { t: 'go', spot: 'ruin' },
        { t: 'talk', scene: 'post2' },
        { t: 'deliver', n: 1 }
      ],
      reward: { gold: 400, exp: 80 } },

    { id: 'sp_fox', no: 3, season: 'spring', title: '여우 화상의 봄 장터', stage: '꽃잎 언덕 · 마을 광장', after: 'sp_postbox',
      blurb: '호연이 금으로 넘어와 "시대를 잃은 물건"을 판다. 삼짇날 꽃놀이로 장터를 연다.',
      mix: { past: '여우 화상·꽃놀이', now: '장터 확성기', future: '호연 좌판의 빛 부채' },
      steps: [
        { t: 'talk', scene: 'fox1' },
        { t: 'gather', cat: 'flower', n: 5 },
        { t: 'talk', scene: 'fox2' },
        { t: 'fest', key: 'samjin' },
        { t: 'heart', n: 1 },
        { t: 'talk', scene: 'fox3' }
      ],
      reward: { gold: 500, exp: 100, feat: 10 } },

    { id: 'sp_museum', no: 4, season: 'spring', title: '사고를 채우다', stage: '사고 · 이끼 돌너덜', after: 'sp_fox',
      blurb: 'K-7 이 떨어져 "사라진 숲" 기록을 보인다. 사고에 화석을 채우면 기록 한 줄이 흐려진다.',
      mix: { past: '화석·석비', now: '사고 전시 조명', future: 'K-7 기록판' },
      steps: [
        { t: 'talk', scene: 'mus1' },
        { t: 'donate', cat: 'fossil', n: 5 },
        { t: 'talk', scene: 'mus2' }
      ],
      reward: { gold: 600, exp: 120, feat: 15 } }
  ];

  function chapter(id) {
    for (var i = 0; i < CHAPTERS.length; i++) { if (CHAPTERS[i].id === id) { return CHAPTERS[i]; } }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.scenarioData = { CAST: CAST, SCENES: SCENES, CHAPTERS: CHAPTERS, chapter: chapter };
})(window);
