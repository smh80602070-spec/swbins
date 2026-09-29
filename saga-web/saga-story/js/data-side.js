/**
 * 사냥터 데이터 — 스테이지 · 발판 · 스킬
 * ---------------------------------------------------------------
 * 원작식 2D 사이드스크롤 게임의 뼈대 데이터.
 * 스테이지를 하나 늘리려면 STAGES 에 한 줄만 넣으면 된다.
 *
 * 발판  plats   [x, y, w]        y 는 발판 윗면
 * 줄    ropes   [x, top, bottom, kind]   kind: 'rope'(밧줄) | 'ladder'(사다리)
 *               top 은 위쪽 끝(대개 발판 윗면) · bottom 은 아래 끝(대개 바닥)
 * 문    portals [x, toKey]       ↑ 를 누르면 그 사냥터로 걸어 넘어간다
 *               도착 자리는 방향에서 나온다 — 오른쪽 문으로 나가면 다음 맵의 왼쪽 끝
 *
 * **사냥터를 늘릴 때 같이 봐야 하는 것 둘.**
 *   1) `enemyLv` 가 `data-enemy.js` 의 `tierOf` 를 거쳐 적 풀을 고른다
 *      (~5: 잡졸 · ~12: 변방 · ~25: 정규군 · 26~: 정예). 보스도 같은 tier 에서 고른다
 *   2) `mood` 는 `side-view.js` 의 `drawBackdrop` 이 아는 이름이어야 한다
 *      ('sky'·'forest'·'cave'·'fire'). 모르는 이름을 주면 하늘만 있고 뒤가 빈다
 * 그 둘만 맞으면 나머지(사냥터 시트 · 미니맵 · 어드민 · 자동)는 표를 훑으므로 따라온다.
 */
(function (global) {
  'use strict';

  /* 관문 대장(PLAN §5-4, 2026-09-19) — 마을 다섯 곳에 미사용 보스(`data-enemy.js`
     BOSSES 중 어느 사냥터에도 안 걸린 여섯) 를 주 1회 도전 상대로 배치한다.
     이름은 `bossByName()`으로 그 보스 정의만 빌려 쓴다(data-enemy.js 무수정, §2-2).
     여섯째 **관문 수호장**(tier4)은 PLAN이 "마을 5 + 비경 입구"라 적었는데 마을 사냥터
     항목이 아니라 비경(`rift.js`, §5-3)의 5층 수호장으로 세운다 — 이름 그대로도
     "관문을 지키는" 쪽이다. */
  var STAGES = [
    /* ── 오버월드 마을 (2026-09-02) ────────────────────────────
       삼국지 실제 지명을 딴 안전지대. `town:true` 만 붙인 사냥터 항목이다 —
       engine(옆으로 걷기·문·발판)은 그대로 쓰고 `spawn:0`·boss 없음으로 전투만 뺐다.
       배치: 신야성(시작) → 허도 → 허창 들판 → 강릉진 → 오림 숲 →
             남정성 → 한중 굴혈 → 기산채 → 호로곡.
       각 마을의 `need` 는 그 마을이 지키는 사냥터와 같다 — 레벨 문턱이 그대로 이어진다. */
    {
      key: 'sinya', name: '신야성', need: 1, sky: ['#f2d9a0', '#f7ecc9'], mood: 'sky',
      ground: '#8a6b3a', width: 1200, floor: 560, town: true,
      plats: [[520, 430, 240]], ropes: [[540, 430, 560, 'ladder']],
      portals: [[1130, 'heodo']],
      npcs: [[220, 'elder'], [620, 'guard'], [800, 'merchant'], [980, 'wanderer'], [420, 'courier'], [710, 'timetraveler']],
      enemyLv: 1, spawn: 0,
      gateBoss: { name: '몽골 만호장', hpMul: 40, dmgMul: 2.5 }
    },
    {
      key: 'heodo', name: '허도', need: 1, sky: ['#e8c15a', '#f5e2a0'], mood: 'sky',
      ground: '#7a5a30', width: 1400, floor: 560, town: true,
      plats: [[300, 430, 240], [900, 380, 260]],
      ropes: [[320, 430, 560, 'ladder'], [920, 380, 560, 'rope']],
      portals: [[70, 'sinya'], [1330, 'field']],
      npcs: [[220, 'merchant'], [620, 'healer'], [980, 'guard'], [1100, 'wanderer'], [420, 'tourist'], [800, 'explorer']],
      enemyLv: 1, spawn: 0,
      gateBoss: { name: '왜장', hpMul: 40, dmgMul: 2.5 }
    },
    {
      key: 'field', name: '허창 들판', need: 1, sky: ['#79c3e8', '#c6e6f2'], mood: 'sky',
      ground: '#6faf55', width: 2200, floor: 560,
      plats: [[320, 430, 260], [760, 350, 220], [1180, 440, 300], [1620, 340, 240], [1900, 450, 220]],
      ropes: [[340, 430, 560, 'rope'], [790, 350, 560, 'rope'], [1210, 440, 560, 'rope'],
              [1650, 340, 560, 'rope'], [1930, 450, 560, 'ladder']],
      portals: [[70, 'heodo'], [2130, 'gangneungjin']],
      gathers: [[480, 'herb'], [1050, 'herb'], [1750, 'herb']],
      enemyLv: 1, spawn: 7,
      /* 보스 — 사냥터 오른쪽 끝을 지킨다. cool 은 잡은 뒤 다시 나오기까지의 분(分).
         hpMul·dmgMul 은 그 사냥터 일반 적 기준의 배수다. */
      boss: { name: '황건 두목', cool: 15, hpMul: 12, dmgMul: 2.0 }
    },
    {
      key: 'gangneungjin', name: '강릉진', need: 5, sky: ['#4f8fa8', '#a8d8e0'], mood: 'sky',
      ground: '#33586a', width: 1300, floor: 560, town: true,
      plats: [[400, 420, 240], [820, 360, 220]],
      ropes: [[420, 420, 560, 'ladder'], [840, 360, 560, 'rope']],
      portals: [[70, 'field'], [1230, 'forest']],
      npcs: [[220, 'guard'], [620, 'elder'], [980, 'merchant'], [420, 'courier'], [800, 'explorer']],
      enemyLv: 5, spawn: 0,
      gateBoss: { name: '왜구 선장', hpMul: 40, dmgMul: 2.5 }
    },
    {
      key: 'forest', name: '오림 숲', need: 5, sky: ['#5fa06a', '#a8d49a'], mood: 'forest',
      ground: '#417a3f', width: 2600, floor: 560,
      plats: [[260, 450, 220], [620, 360, 200], [980, 280, 220], [1340, 380, 260],
              [1720, 300, 200], [2060, 430, 260]],
      ropes: [[285, 450, 560, 'rope'], [650, 360, 560, 'rope'], [1010, 280, 560, 'rope'],
              [1370, 380, 560, 'ladder'], [1750, 300, 560, 'rope'], [2090, 430, 560, 'ladder']],
      portals: [[70, 'gangneungjin'], [2530, 'namjeongseong']],
      gathers: [[420, 'berry'], [1080, 'berry'], [1780, 'berry'], [2340, 'berry']],
      enemyLv: 6, spawn: 9,
      boss: { name: '오랑캐 족장', cool: 20, hpMul: 14, dmgMul: 2.2 }
    },
    {
      key: 'namjeongseong', name: '남정성', need: 12, sky: ['#6b6b78', '#a9a9b8'], mood: 'sky',
      ground: '#4a4a56', width: 1300, floor: 560, town: true,
      plats: [[380, 420, 240], [860, 360, 220]],
      ropes: [[400, 420, 560, 'ladder'], [880, 360, 560, 'rope']],
      portals: [[70, 'forest'], [1230, 'cave']],
      npcs: [[220, 'guard'], [620, 'healer'], [800, 'merchant'], [980, 'wanderer'], [420, 'tourist'], [710, 'timetraveler']],
      enemyLv: 12, spawn: 0,
      gateBoss: { name: '거란 도통', hpMul: 40, dmgMul: 2.5 }
    },
    {
      key: 'cave', name: '한중 굴혈', need: 12, sky: ['#2b2436', '#4a3d58'], mood: 'cave',
      ground: '#3c3145', width: 3000, floor: 560,
      plats: [[300, 470, 240], [700, 390, 200], [1080, 300, 240], [1460, 400, 220],
              [1840, 320, 240], [2240, 440, 300]],
      ropes: [[325, 470, 560, 'ladder'], [730, 390, 560, 'ladder'], [1110, 300, 560, 'ladder'],
              [1490, 400, 560, 'rope'], [1870, 320, 560, 'ladder'], [2270, 440, 560, 'ladder']],
      portals: [[70, 'namjeongseong'], [2930, 'gisanchae']],
      gathers: [[500, 'ore'], [1500, 'ore'], [2500, 'ore']],
      enemyLv: 14, spawn: 11,
      boss: { name: '위군 도독', cool: 30, hpMul: 17, dmgMul: 2.5 }
    },
    {
      key: 'gisanchae', name: '기산채', need: 25, sky: ['#5a2c1e', '#a85c3a'], mood: 'sky',
      ground: '#3a2015', width: 1300, floor: 560, town: true,
      plats: [[380, 420, 240], [860, 360, 220]],
      ropes: [[400, 420, 560, 'ladder'], [880, 360, 560, 'rope']],
      portals: [[70, 'cave'], [1230, 'gorge']],
      npcs: [[220, 'wanderer'], [620, 'guard'], [980, 'merchant'], [420, 'courier'], [800, 'timetraveler']],
      enemyLv: 25, spawn: 0,
      gateBoss: { name: '산채 두령', hpMul: 40, dmgMul: 2.5 }
    },
    {
      /* 넷째 — **가장 깊은 곳**(2026-08-26). 3차 전직(Lv.45)이 설 자리가 없어 넣었다:
         마지막 사냥터가 Lv.12 에 열려 있었으니 무예를 스물 더 얹어 놓고 쓸 데가 없었다.
         2차 전직과 같은 Lv.25 에 열리고, **적은 처음으로 tier 4 정예**다
         (`enemyLv` 26 → `data-enemy.js` 의 tierOf 가 4를 준다 — 철갑 중장병 · 흑기병 ·
         연노 사수 · 근위 기병 · 수군 함대). 2차로 들어와 3차로 걸어 나가는 곳이다.

         지형도 가장 험하다 — 발판이 일곱이고 **바닥이 가장 좁다**. 불길이 오르는
         골짜기라 오래 서 있을 자리를 주지 않는 것이 이 사냥터의 성격이다. */
      key: 'gorge', name: '호로곡(葫蘆谷)', need: 25, sky: ['#3a1410', '#8f3a1c'], mood: 'fire',
      ground: '#4a2a20', width: 3400, floor: 560,
      plats: [[260, 480, 200], [600, 400, 180], [940, 310, 200], [1300, 420, 180],
              [1640, 330, 200], [2000, 250, 180], [2360, 400, 220], [2740, 320, 200]],
      ropes: [[285, 480, 560, 'rope'], [630, 400, 560, 'ladder'], [970, 310, 560, 'rope'],
              [1330, 420, 560, 'rope'], [1670, 330, 560, 'ladder'], [2030, 250, 560, 'rope'],
              [2390, 400, 560, 'ladder'], [2770, 320, 560, 'rope']],
      portals: [[70, 'gisanchae'], [3330, 'ruin']],
      gathers: [[700, 'cinder'], [1800, 'cinder'], [2900, 'cinder']],
      enemyLv: 26, spawn: 13,
      boss: { name: '적국 대장군', cool: 40, hpMul: 20, dmgMul: 2.8 }
    },
    {
      /* 다섯째·여섯째(원 지시서 잔여 "폐허·동굴 지역", 2026-09-23) — 3차(Lv.45)·4차(Lv.70)
         전직이 설 자리. 호로곡(Lv.25) 뒤로는 사냥터가 없어 3·4차 무예를 얹어 놓고
         쓸 데가 없었다(넷째를 넣던 2026-08-26 과 같은 까닭). 새 mood 를 만들지 않고
         불탄 옛 도읍은 'fire', 깊은 굴은 'cave' 를 그대로 쓴다 — 화면(2D·3D)이 이미 아는
         이름이라 그림 쪽은 한 줄도 안 바뀐다.

         `enemyLv` 는 30·34 로만 올렸다. 적 체력이 1.22^(lv-1) 로 불어나서
         호로곡(26) 대비 ×2.2·×4.9 — 3차 무예가 2차의 1.8배를 넘는다는 진단
         ('3차 무예라야 호로곡의 정예를 감당한다')과 같은 폭이다. 레벨 문턱만큼
         올리면(45·70) 수십~수천 배가 되어 아무도 못 잡는다. */
      key: 'ruin', name: '낙양 옛터(洛陽 舊址)', need: 45, sky: ['#2e2a28', '#6e5a4a'], mood: 'fire',
      ground: '#3a302a', width: 3600, floor: 560,
      plats: [[260, 470, 220], [620, 380, 200], [980, 300, 220], [1340, 410, 200], [1700, 320, 220],
              [2060, 240, 200], [2420, 380, 240], [2800, 300, 200], [3160, 440, 220]],
      ropes: [[285, 470, 560, 'ladder'], [645, 380, 560, 'rope'], [1005, 300, 560, 'ladder'],
              [1365, 410, 560, 'rope'], [1725, 320, 560, 'ladder'], [2085, 240, 560, 'rope'],
              [2445, 380, 560, 'ladder'], [2825, 300, 560, 'rope'], [3185, 440, 560, 'ladder']],
      portals: [[70, 'gorge'], [3530, 'deepcave']],
      gathers: [[800, 'cinder'], [1900, 'ore'], [3000, 'cinder']],
      enemyLv: 30, spawn: 14,
      boss: { name: '폐도 흉장', cool: 45, hpMul: 22, dmgMul: 3.0 }
    },
    {
      /* 여섯째 — 4차(Lv.70)가 들어서는 가장 깊은 굴. 발판이 가장 높이 쌓이고
         바닥 폭이 가장 넓다(오래 걸어 들어가는 곳). 캐는 것은 광물뿐 */
      key: 'deepcave', name: '검각 암굴(劍閣 巖窟)', need: 70, sky: ['#141220', '#2c2640'], mood: 'cave',
      ground: '#262036', width: 3800, floor: 560,
      plats: [[260, 480, 220], [620, 400, 200], [980, 310, 200], [1340, 230, 220], [1700, 330, 200],
              [2060, 440, 240], [2420, 350, 200], [2780, 260, 220], [3140, 380, 200], [3480, 470, 200]],
      ropes: [[285, 480, 560, 'ladder'], [645, 400, 560, 'ladder'], [1005, 310, 560, 'rope'],
              [1365, 230, 560, 'rope'], [1725, 330, 560, 'ladder'], [2085, 440, 560, 'ladder'],
              [2445, 350, 560, 'rope'], [2805, 260, 560, 'rope'], [3165, 380, 560, 'ladder'],
              [3505, 470, 560, 'ladder']],
      portals: [[70, 'ruin'], [3730, 'beyond_past']],
      gathers: [[700, 'ore'], [1600, 'ore'], [2600, 'ore'], [3400, 'ore']],
      enemyLv: 34, spawn: 15,
      boss: { name: '암굴 귀장', cool: 50, hpMul: 25, dmgMul: 3.2 }
    },
    /* ── 5부 · 문 너머 (2026-09-30, 정본 scenario/saga-story.md "5부") — 난세의 문 너머 시대 사냥터 셋.
       암굴 끝 오른쪽 문(deepcave)에서 옛 전장 → 무너진 도심 → 궤도 기지로 이어진다. 세 곳 다 4차(Lv.70) 뒤 — 문턱 72·74·76 — 적은 암굴보다 한 단 위(enemyLv 36·38·40,
       ×1.22^lv 라 암굴 34 대비 ×1.5~×2.2 — 4차 무예로 감당하는 폭). 새 필드는 없다: 옛 칸(sky·mood·ground·plats·ropes·portals·gathers·boss)만 */
    {
      key: 'beyond_past', name: '문 너머 · 옛 전장(門外 古戰場)', need: 72, sky: ['#3a2a1e', '#a8703a'], mood: 'fire',
      ground: '#4a3626', width: 3800, floor: 560,
      plats: [[260, 470, 220], [620, 380, 200], [980, 310, 220], [1340, 420, 200], [1700, 330, 220],
              [2060, 250, 200], [2420, 390, 240], [2780, 310, 200], [3140, 440, 220], [3480, 360, 200]],
      ropes: [[285, 470, 560, 'ladder'], [645, 380, 560, 'rope'], [1005, 310, 560, 'ladder'],
              [1365, 420, 560, 'rope'], [1725, 330, 560, 'ladder'], [2085, 250, 560, 'rope'],
              [2445, 390, 560, 'ladder'], [2805, 310, 560, 'rope'], [3165, 440, 560, 'ladder'], [3505, 360, 560, 'rope']],
      portals: [[70, 'deepcave'], [3730, 'beyond_now']],
      gathers: [[700, 'cinder'], [1700, 'ore'], [2700, 'cinder'], [3400, 'ore']],
      enemyLv: 36, spawn: 15,
      boss: { name: '전장 원혼 장수', cool: 52, hpMul: 27, dmgMul: 3.3 }
    },
    {
      key: 'beyond_now', name: '문 너머 · 무너진 도심(門外 廢都心)', need: 74, sky: ['#20262e', '#5a6672'], mood: 'sky',
      ground: '#3a3d42', width: 3900, floor: 560,
      plats: [[240, 480, 220], [600, 390, 200], [960, 300, 200], [1320, 230, 220], [1680, 340, 200],
              [2040, 430, 240], [2400, 340, 200], [2760, 260, 220], [3120, 380, 200], [3500, 470, 220]],
      ropes: [[265, 480, 560, 'ladder'], [625, 390, 560, 'ladder'], [985, 300, 560, 'rope'],
              [1345, 230, 560, 'rope'], [1705, 340, 560, 'ladder'], [2065, 430, 560, 'ladder'],
              [2425, 340, 560, 'rope'], [2785, 260, 560, 'rope'], [3145, 380, 560, 'ladder'], [3525, 470, 560, 'ladder']],
      portals: [[70, 'beyond_past'], [3830, 'beyond_future']],
      gathers: [[800, 'ore'], [1800, 'cinder'], [2800, 'ore'], [3500, 'cinder']],
      enemyLv: 38, spawn: 15,
      boss: { name: '폐허 도심 통제관', cool: 50, hpMul: 28, dmgMul: 3.4 }
    },
    {
      key: 'beyond_future', name: '문 너머 · 궤도 기지(門外 軌道基地)', need: 76, sky: ['#0a1226', '#1c2e5a'], mood: 'cave',
      ground: '#1e2a44', width: 4000, floor: 560,
      plats: [[260, 480, 220], [620, 400, 200], [980, 310, 200], [1340, 230, 220], [1700, 320, 200],
              [2060, 430, 240], [2420, 340, 200], [2780, 250, 220], [3140, 370, 200], [3520, 470, 220], [3800, 380, 160]],
      ropes: [[285, 480, 560, 'ladder'], [645, 400, 560, 'ladder'], [1005, 310, 560, 'rope'],
              [1365, 230, 560, 'rope'], [1725, 320, 560, 'ladder'], [2085, 430, 560, 'ladder'],
              [2445, 340, 560, 'rope'], [2805, 250, 560, 'rope'], [3165, 370, 560, 'ladder'], [3545, 470, 560, 'ladder'], [3825, 380, 560, 'rope']],
      portals: [[70, 'beyond_now']],
      gathers: [[700, 'ore'], [1600, 'ore'], [2600, 'ore'], [3400, 'ore']],
      enemyLv: 40, spawn: 16,
      boss: { name: '궤도 기지 감시관', cool: 50, hpMul: 30, dmgMul: 3.5 }
    }
  ];

  function stage(key) {
    for (var i = 0; i < STAGES.length; i++) { if (STAGES[i].key === key) { return STAGES[i]; } }
    return STAGES[0];
  }

  /** 스킬 — 기력을 쓰고 쿨다운을 기다린다 (던전 게임과 같은 감각) */
  var SKILLS = [
    { key: 'slash', name: '연참(連斬)', emoji: '⚔️', cost: 0,  cd: 0.36,
      desc: '앞을 벤다 (평타)' },
    { key: 'sweep', name: '횡소(橫掃)', emoji: '🌀', cost: 18, cd: 4,
      desc: '주위를 한 바퀴 벤다 · 공격력 180%' },
    { key: 'bolt',  name: '기탄(氣彈)', emoji: '💠', cost: 24, cd: 6,
      desc: '앞으로 기를 날린다 · 관통 · 공격력 210%' },
    { key: 'brace', name: '기합(氣合)', emoji: '🔥', cost: 30, cd: 14,
      desc: '8초간 공격력 +35% · 이동 속도 +20%' }
  ];

  /**
   * 멀리서 쏘는 적 — **무기로 가른다.**
   *
   * `data-enemy.js` 는 던전 게임과 나눠 든 같은 파일이라 여기에 `ranged` 같은 칸을
   * 새로 만들지 않는다(만들면 두 판의 적 데이터가 갈린다). 다행히 그 파일에는
   * 이미 활을 든 적(오랑캐 궁수·여진 궁수·연노 사수·수군 척후선)과 조총병이 있다 —
   * **든 무기가 곧 사거리다.**
   */
  var RANGED_WEAPON = { bow: { name: '화살', spd: 430, mul: 0.8, cd: 2.2, range: 360 },
                        staff: { name: '탄환', spd: 560, mul: 1.0, cd: 3.2, range: 420 } };

  function rangedOf(ref) {
    if (!ref || !ref.look) { return null; }
    return RANGED_WEAPON[ref.look.weapon] || null;
  }

  /** 떨어지는 것 — 밟으면 줍는다 */
  var DROPS = {
    gold:   { name: '금',     emoji: '🪙', color: '#e8c15a' },
    potion: { name: '탕약',   emoji: '🧪', color: '#d0596b' },
    gear:   { name: '장비',   emoji: '📦', color: '#8ab4e8' },
    scroll: { name: '주문서', emoji: '📜', color: '#d8cba0' }
  };

  /**
   * 필드에서 캐는 것(PLAN 10절) — 사냥터마다 고정 자리(`gathers`)에 서 있다가
   * 지나가면 줍고, 잠시 뒤 다시 돋는다. 몬스터 드랍과 달리 판정이 필요 없는
   * 정지 오브젝트라 별도 표(`GATHERS`)로 뺐다. `model` 은 `asset3d.js`가 이미
   * 갖고 있는 자연물 GLB 종류(부록 "코드로 그리지 말고 에셋으로") 중에서
   * 골랐다 — 새 GLB 를 받아 오는 대신 이미 있는 것으로 결을 맞췄다.
   */
  var GATHERS = {
    herb:   { name: '들꽃',       emoji: '🌼', model: 'flower' },     // 허창 들판
    berry:  { name: '덤불 열매',  emoji: '🍇', model: 'bush' },       // 오림 숲
    ore:    { name: '이끼 광물',  emoji: '⛏️', model: 'moss_rock' },  // 한중 굴혈
    cinder: { name: '그은 돌',    emoji: '🪨', model: 'rock' }        // 호로곡
  };

  /**
   * 캔 것으로 만들기(원 지시서 잔여 "채집→제작 연결", 2026-09-23) — 🏪 저자
   * 화면 아래에 붙는다. `need` 는 `GATHERS` 종류별 개수, `give` 는 탕약 개수
   * (`potion`) 또는 주문서 하나(`scroll`: `data-gear.js` SCROLLS 의 key).
   * 값은 저자 값의 대략 절반 어치 — 한 사냥터를 두어 번 돌면(자리 3~4, 45초에
   * 다시 돋는다) 하나 만들 만큼이라, 금 대신 **걸어 다닌 품**으로 사는 길이다.
   * 장비는 안 만든다(가방 칸·등급 체계를 건드리게 된다).
   */
  var RECIPES = [
    { key: 'potion2', name: '달인 탕약',     need: { herb: 3 },             give: { potion: 2 } },
    { key: 'potion4', name: '열매 탕약',     need: { berry: 3, herb: 1 },   give: { potion: 4 } },
    { key: 'def100',  name: '광물 판 부적',  need: { ore: 5 },              give: { scroll: 'def100' } },
    { key: 'atk100',  name: '벼린 돌 부적',  need: { ore: 4, cinder: 3 },   give: { scroll: 'atk100' } },
    { key: 'hp60',    name: '열매 기운 부적', need: { berry: 4, cinder: 4 }, give: { scroll: 'hp60' } }
  ];
  /**
   * 첫 발 장면(원 지시서 잔여 "스토리 연출", 2026-09-23) — 그 사냥터에 **처음** 들어설 때
   * 한 번만 띄운다(`story.js`). 한 줄 = [누가, 감정, 말].
   *   누가  'me' = 앞에 세운 인물(초상은 ui.js 의 pt() 그대로) · 그 밖은 `NPC_TALK` 의 키(직책)
   *   감정  `EMOTES` 의 키 — 초상 옆 표시와 흔들림 모양만 가른다
   * 인물 실명은 안 쓴다(이름 정책) — 'me' 의 이름은 도감의 가명이 들어간다.
   */
  var EMOTES = {
    calm:  { mark: '',   name: '담담' },
    fire:  { mark: '🔥', name: '결의' },
    shock: { mark: '❗', name: '놀람' },
    worry: { mark: '💧', name: '불안' },
    joy:   { mark: '✨', name: '기쁨' },
    anger: { mark: '💢', name: '분노' }
  };
  var STORY = {
    sinya: { title: '서막 — 신야성', lines: [
      ['elder', 'worry', '난리가 길어지니 성 밖엔 도적 떼뿐이라네.'],
      ['me', 'fire', '그럼 제가 길을 트겠습니다. 들판부터 가 보지요.'],
      ['elder', 'joy', '허도를 지나면 허창 들판일세. 몸조심하게.']
    ] },
    field: { title: '허창 들판', lines: [
      ['me', 'shock', '들판이 이렇게 어지러울 줄이야…'],
      ['me', 'fire', '하나씩 베어 나가면 길이 보이겠지.']
    ] },
    forest: { title: '오림 숲', lines: [
      ['wanderer', 'worry', '숲 그늘에선 발소리가 제 것만 들리지 않소.'],
      ['me', 'calm', '그림자가 짙을수록 눈을 크게 뜨면 됩니다.']
    ] },
    cave: { title: '한중 굴혈', lines: [
      ['guard', 'shock', '굴 안쪽에 위군 도독이 진을 쳤다는 소문이오!'],
      ['me', 'anger', '굴을 비우고 나오겠습니다. 기다리시오.']
    ] },
    gorge: { title: '호로곡', lines: [
      ['me', 'shock', '골짜기 전체가 타오른다…'],
      ['healer', 'worry', '불길 속에 오래 서 있지 마시오. 탕약을 넉넉히.'],
      ['me', 'fire', '이 불을 넘어야 다음 길이 열린다.']
    ] },
    ruin: { title: '낙양 옛터', lines: [
      ['me', 'worry', '한때 도읍이던 곳이 잿더미가 되었구나.'],
      ['wanderer', 'calm', '잿더미에도 주인은 있소. 흉장이 이곳을 쥐고 있다오.'],
      ['me', 'anger', '그 주인부터 바꾸겠소.']
    ] },
    deepcave: { title: '검각 암굴', lines: [
      ['me', 'shock', '빛이 닿지 않는 깊이다…'],
      ['me', 'fire', '여기까지 왔다. 끝을 보고 나가겠다.']
    ] },
    beyond_past: { title: '문 너머 · 옛 전장', lines: [
      ['me', 'shock', '깃발이 무덤처럼 꽂혀 있다… 어느 시대 것인지 알 수 없다.'],
      ['me', 'calm', '문 너머에도 싸움이 있었구나. 걸어서 확인하겠다.']
    ] },
    beyond_now: { title: '문 너머 · 무너진 도심', lines: [
      ['me', 'worry', '간판 글자가 거꾸로다. 신호등은 저 혼자 켜진다.'],
      ['me', 'fire', '이 도시가 왜 무너졌는지 끝까지 보겠다.']
    ] },
    beyond_future: { title: '문 너머 · 궤도 기지', lines: [
      ['me', 'shock', '하늘 위에 지은 성이라니… 등불이 아직 켜져 있다.'],
      ['me', 'fire', '문 너머의 끝이다. 여기서 세 시대를 다 보겠다.']
    ] }
  };

  function recipe(key) {
    for (var i = 0; i < RECIPES.length; i++) { if (RECIPES[i].key === key) { return RECIPES[i]; } }
    return null;
  }

  /**
   * 마을 사람 대화(PLAN 16절) — `town:true` 사냥터의 `npcs`([x, key])가
   * 가리키는 자리다. 이름은 인물이 아니라 **직책**이라 이름 정책(가명·오마주)에
   * 걸리지 않는다. `lines` 는 매번 아무거나 하나 뽑아 보여준다 — 순서를
   * 지키는 대사가 아니라 마을마다 도는 잡담이라 그걸로 충분하다.
   *
   * `shop: true`(2026-09-11) — 이 마을 사람과 말을 트면 대사 밑에 저자(🏪)를
   * 여는 단추가 하나 붙는다(`side.js`의 `talk()`·`ui.js`의 `renderTalkBox()`
   * 참고). 상점은 여전히 도구줄 🏪로 어디서든 연다(PLAN 11절 결정을 뒤집지
   * 않는다) — `merchant` 옆에 서면 **같은 상점을 여는 지름길**이 하나 더
   * 생기는 것뿐이다. 모든 마을에 `merchant`를 하나씩 세워 뒀다.
   */
  var NPC_TALK = {
    elder: { name: '촌로', emoji: '🧓', lines: [
      '난리 통에도 사람 사는 꼴은 여전하구먼.',
      '젊은이, 무예를 부지런히 닦게. 몸이 그 값을 한다네.',
      '이 근방 사냥터마다 우두머리가 하나씩 있다고 들었네 — 조심하시게.',
      '들판에 나가면 캐 갈 것이 제법 있을 걸세.'
    ] },
    merchant: { name: '장사치', emoji: '💰', shop: true, lines: [
      '저자에 들르시게 — 장비도 주문서도 다 있다네.',
      '요즘 금 귀한 줄 모르는 사람이 없어.',
      '주문서는 실패할 때도 있으니 마음 단단히 먹게.',
      '탕약은 늘 넉넉히 챙겨 두시게, 사냥터에서 아쉬운 게 그거라네.'
    ] },
    guard: { name: '파수병', emoji: '🛡️', lines: [
      '앞쪽 사냥터는 만만치 않네. 채비는 갖췄는가?',
      '두목급은 한동안 다시 안 나온다니, 잡았으면 다른 곳부터 도시게.',
      '이 성 안에서는 걱정 말게, 아무도 안 덤빈다네.',
      '전직할 뜻이 있으면 서두르게. 무예는 일찍 닦을수록 낫네.'
    ] },
    healer: { name: '의원', emoji: '⚕️', lines: [
      '체력이 다하기 전에 탕약부터 찾으시게.',
      '몸을 갖추는 것도 중요하지만 쉬어 가는 것도 중요하네.',
      '앉아 쉬면 체력과 기력이 차네 — 곁에 아무도 없을 때 말일세.',
      '다치는 건 순간이나 낫는 건 더디니 조심하시게.'
    ] },
    wanderer: { name: '나그네', emoji: '🥾', lines: [
      '이곳저곳 떠돌다 보니 별별 것을 다 보네.',
      '드물게 희귀한 것들이 나온다더군 — 운이 좋으면 마주칠 걸세.',
      '보물상자를 봤다는 소문이 있던데, 사실인지는 모르겠네.',
      '길을 넓히려면 여러 곳을 밟아 봐야 하는 법이지.'
    ] },
    /* 세 시대 마을 사람(PLAN §5-12 · SAGA-DESIGN §13) — 마을마다 현대 하나·미래 하나를 더 세운다.
       era 는 표시·진단용, model 은 `asset3d` 의 `folk:*`(제 옷 빛깔 그대로, 물들이지 않는다). 역할 이름뿐이라 실명 없음 */
    courier: { name: '택배 기사', emoji: '📦', era: 'modern', model: 'folk:worker', lines: [
      '받는 분이 갑옷 차림이던데… 서명은 붓으로 하시더라고요.',
      '성문 파수병이 제 수레를 세 번이나 뒤졌어요.',
      '사냥터 쪽 주소는 지도에 안 나와서 늘 헤매요.',
      '요즘 떼쥐가 짐을 뜯어요. 가시는 길에 좀 잡아 주세요.'
    ] },
    tourist: { name: '사진 찍는 여행자', emoji: '📷', era: 'modern', model: 'folk:hoodie', lines: [
      '이 성 사진 한 장만요! 기와 빛이 정말 좋네요.',
      '여기는 신호가 한 칸도 안 잡혀요.',
      '특공대 복장한 사람들이 사냥터에서 총을 쏘던데, 촬영인가요?',
      '옛날 옷 입은 분들이 다들 진짜처럼 연기를 잘하시네요.'
    ] },
    timetraveler: { name: '시간 여행자', emoji: '⌛', era: 'future', model: 'folk:scifi', lines: [
      '제가 온 해에는 이 마을이 유리 탑 숲이었어요.',
      '경비 보행기가 제 뒤를 따라 넘어왔나 봐요. 미안해요.',
      '촌로께 내일 비가 온다 했더니 놀라시더군요.',
      '여기 무예는 우리 시대 기록에도 전설로 남아 있어요.'
    ] },
    explorer: { name: '탐사 대원', emoji: '🧑‍🚀', era: 'future', model: 'folk:astronaut', lines: [
      '과거 신호가 겹쳐 잡히는 좌표예요. 흥미롭네요.',
      '정찰 드론이 길을 잃었어요. 보이면 떨어뜨려 주세요.',
      '강철 거신은 옛 전장 쇳물로 만든 거래요. 무섭죠?',
      '이 시대 햇빛은 약해서 충전이 더뎌요.'
    ] }
  };

  /* 세 시대 적(PLAN §5-12) — `data-enemy.js` 는 사가블로와 나눠 든 파일이라 칸을 안 늘리고(§2-2) 여기 둔다.
     모양은 ENEMIES 와 같다(+ era·model). 관문대(tier)마다 현대 하나 이상·미래 하나 이상.
     원거리·탱커는 기존 규칙 그대로 무기로 가른다(staff=탄환·halberd=탱커, `rangedOf`·`enemyRole`).
     2D 는 kind·form·look 으로 그린다(로봇은 새·도깨비 꼴) — 3D 는 model 몸 */
  var ERA_ENEMIES = [
    { name: '잿빛 떼쥐', emoji: '🐀', kind: 'beast', color: '#6a6a6a', form: 'quad', tier: 1, era: 'modern', model: 'foe:rat' },
    { name: '정찰 드론', emoji: '🛸', kind: 'beast', color: '#8a9aa8', form: 'bird', look: { weapon: 'staff' }, tier: 1, era: 'future', model: 'foe:drone' },
    { name: '벼락 말벌', emoji: '🐝', kind: 'beast', color: '#d8b030', form: 'bird', tier: 2, era: 'modern', model: 'foe:wasp' },
    { name: '경비 보행기', emoji: '🤖', kind: 'human', color: '#7a8a9a', look: { weapon: 'club', helm: 'helmet', armor: 'plate' }, tier: 2, era: 'future', model: 'foe:walker' },
    { name: '떠도는 망자', emoji: '🧟', kind: 'human', color: '#5a7a5a', look: { weapon: 'club', helm: 'none', armor: 'leather' }, tier: 3, era: 'modern', model: 'foe:zombie' },
    { name: '별바다 손님', emoji: '👽', kind: 'beast', color: '#6ac08a', form: 'ogre', tier: 3, era: 'future', model: 'foe:alien' },
    { name: '진압 특공대', emoji: '🔫', kind: 'human', color: '#3a3a44', look: { weapon: 'staff', helm: 'helmet', armor: 'plate' }, tier: 4, era: 'modern', model: 'foe:swat' },
    { name: '강철 거신', emoji: '🦾', kind: 'beast', color: '#9a6a4a', form: 'ogre', look: { weapon: 'halberd' }, tier: 4, era: 'future', model: 'foe:hulk' }
  ];
  /** 이 관문대(tier)의 시대 적 — 없으면 가까운 아래 tier */
  function eraPoolFor(tier) {
    for (var t = tier; t >= 1; t--) {
      var p = ERA_ENEMIES.filter(function (e) { return e.tier === t; });
      if (p.length) { return p; }
    }
    return [];
  }

  /**
   * 마을 사람끼리의 잡담 (2026-09-10) — 사가의숲 `js/folk.js`("주민끼리의 대화")의
   * 결을 옮긴 것이다. 다만 이 판의 마을 사람은 `NPC_TALK` 처럼 **제자리에 선 표지판**이라
   * (어슬렁거리지 않는다), 사가의숲처럼 둘이 마주 서서 말을 주고받는 장면을 그대로
   * 옮기지 않고 **마을에 머무는 동안 이따금 둘 사이에 오간 말 한 토막을 전해 듣는**
   * 것으로 옮겼다 — `side.js` 가 마을(`town:true`)에서 시간이 좀 지날 때마다 아무 둘이나
   * 골라 아무 화제나 하나 매긴다. 그래서 화제는 특정 인물 조합에 매이지 않고, 누가
   * 주고받아도 자연스럽게 읽히는 것만 골랐다. `{town}` 은 그 마을 이름으로 채운다.
   */
  var NPC_CHAT = [
    ['이 {town}도 오래 되었지 뭔가.', '그러게 말입니다, 별 탈 없이 지내는 게 어디요.'],
    ['젊은이들이 부쩍 강해졌더군.', '무예를 부지런히 닦은 덕이겠지요.'],
    ['앞쪽 사냥터에 우두머리가 또 나타났다던데.', '조심들 하라고 일러야겠구먼.'],
    ['장비 한 벌 새로 맞췄다지?', '주문서 운이 좋았나 보오.'],
    ['보물상자를 봤다는 소문이 돌던데.', '나도 들었네, 부럽구먼.'],
    ['드물게 희귀한 놈이 나온다더군.', '마주치면 한몫 잡을 텐데 말이오.'],
    ['전직했다는 이가 또 늘었소.', '이 근방이 다 무인이 되어 가는군.'],
    ['채집할 것이 요새 넉넉하더이다.', '부지런히 캐 두면 요긴하지요.'],
    ['{town} 을(를) 오가는 이가 늘었소.', '그만큼 길이 트였다는 뜻이겠지요.']
  ];

  global.DG = global.DG || {};
  global.DG.sideData = {
    STAGES: STAGES, SKILLS: SKILLS, DROPS: DROPS, GATHERS: GATHERS, NPC_TALK: NPC_TALK,
    RECIPES: RECIPES, recipe: recipe, STORY: STORY, EMOTES: EMOTES,
    NPC_CHAT: NPC_CHAT, RANGED_WEAPON: RANGED_WEAPON, ERA_ENEMIES: ERA_ENEMIES, eraPoolFor: eraPoolFor,
    stage: stage, rangedOf: rangedOf
  };
})(window);
