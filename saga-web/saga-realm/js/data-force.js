/**
 * 삼국지 — 세력(勢力)과 무장(武將)
 * ---------------------------------------------------------------
 * **`data.js` 를 건드리지 않는다.** 그 파일은 다섯 판이 나눠 가진 복사본이라
 * 여기서 한 줄만 늘려도 다섯 곳을 맞춰야 한다(인계 문서의 못이다).
 * 그래서 삼국지 무장은 이 파일이 따로 들고, `officer.js` 가 둘을 **합쳐서** 본다.
 *
 *   data.js 의 인물 105  — 삼국지 22 · 한국사 26 · 일본사 20 · 세계사 37
 *                        (2026-09-10 HEROES 가명화 후속으로 늘었다 — 더 늘 수 있으니
 *                        코드에서는 이 수를 못 박지 않는다)
 *   이 파일의 무장 54     — 삼국지 군주와 그 부하들
 *
 * 삼국지 사람이 아닌 인물(한국사·일본사·세계사, data.js 쪽 83)은 **재야(在野)** 다.
 * 도시에서 수색하면 나온다 — 이 판이 '역사 전체' 를 다루는 판이라는 뜻이기도 하다.
 *
 * 무장 기록은 data.js 의 인물과 **같은 모양**이어야 한다.
 * sprite.portrait('hero', ref) 가 rarity 를 읽고, hero.stats(id) 가 stats 를 읽는다.
 *
 *   stats  무력(전투) · 지력(내정·계략) · 통솔(치안·부대)
 *          이 판은 정치·매력을 따로 두지 않는다 — 세 자질로 태수 적성을 이미 가른다
 */
(function (global) {
  'use strict';

  function O(id, name, hanja, rarity, trait, might, wisdom, command, emoji, quote) {
    return {
      id: id, name: name, hanja: hanja, era: '삼국지', faction: '삼국지',
      rarity: rarity, trait: trait, emoji: emoji, quote: quote,
      stats: { might: might, wisdom: wisdom, command: command }
    };
  }

  /* ── 무장 54 (data.js 에 없는 사람만) ───────────────────── */
  var OFFICERS = [
    /* 조조군 */
    O('rf_xiahouyuan', '표기',   '飇騎',   4, 'might',  91, 62, 86, '🏇', '사흘에 오백 리, 엿새에 천 리요.'),
    O('rf_caoren',     '철벽',   '鐵壁',   4, 'command',88, 68, 91, '🧱', '성을 지키는 일이라면 제게 맡기십시오.'),
    O('rf_caohong',    '충보',   '忠輔',   3, 'might',  82, 50, 74, '🐴', '천하에 저는 없어도 되나 공은 없어선 안 됩니다.'),
    O('rf_dianwei',    '호극',   '虎戟',   4, 'might',  96, 34, 70, '🪓', '주공 앞을 지나려면 저를 넘어야 하오.'),
    O('rf_xuchu',      '맹호',   '猛虎',   4, 'might',  96, 36, 72, '🐯', '싸움이라면 벗고도 하지요.'),
    O('rf_yujin',      '엄율',   '嚴律',   3, 'command',80, 66, 86, '🎌', '군령은 무겁고 사정은 가볍습니다.'),
    O('rf_yuejin',     '첨병',   '尖兵',   3, 'might',  85, 55, 78, '⚡', '선봉은 언제나 제 자리입니다.'),
    O('rf_lidian',     '공심',   '公心',   3, 'wisdom', 76, 78, 80, '📗', '사사로운 원한으로 나라 일을 그르치겠습니까.'),
    O('rf_chengyu',    '직언',   '直言',   3, 'wisdom', 48, 89, 74, '🕯️', '험한 말도 해야 할 때는 합니다.'),
    O('rf_guojia',     '십책',   '十策',   5, 'wisdom', 32, 98, 70, '🍷', '열 가지로 이기고 열 가지로 집니다 — 들어 보시겠습니까.'),

    /* 원소군 */
    O('rf_yuanshao',   '고문',   '高門',   4, 'command',73, 74, 88, '🏆', '사대(四代)에 삼공을 낸 집안이오.'),
    O('rf_yanliang',   '북창',   '北槍',   4, 'might',  92, 40, 76, '⚔️', '하북에 나만 한 창이 또 있겠는가.'),
    O('rf_wenchou',    '쌍극',   '雙戟',   4, 'might',  91, 38, 74, '🗡️', '북창의 원수를 갚겠다!'),
    O('rf_jushou',     '존왕',   '尊王',   4, 'wisdom', 40, 93, 82, '🧭', '천자를 받들면 명분이 우리에게 옵니다.'),
    O('rf_tianfeng',   '직간',   '直諫',   4, 'wisdom', 35, 94, 68, '⛓️', '옳은 말을 하고 옥에 갇히는 것이 신하의 팔자입니다.'),
    O('rf_shenpei',    '북향',   '北向',   3, 'command',62, 82, 84, '🏯', '성이 무너져도 북쪽을 보고 죽겠소.'),
    O('rf_zhanghe',    '산략',   '山略',   5, 'command',89, 82, 91, '🌀', '지형을 읽는 것이 곧 병법입니다.'),
    O('rf_gaolan',     '석주',   '石柱',   3, 'might',  84, 55, 76, '🛡️', '하북 사정주(四庭柱)의 하나요.'),

    /* 공손찬군 */
    O('rf_gongsunzan', '은기',   '銀騎',   3, 'might',  84, 60, 82, '🐎', '백마의천(白馬義從)을 아느냐.'),
    O('rf_yangang',    '백봉',   '白鋒',   2, 'might',  72, 42, 66, '🏳️', '선봉은 백마가 맡습니다.'),

    /* 공융군 */
    O('rf_kongrong',   '빈헌',   '賓軒',   3, 'wisdom', 24, 87, 58, '🍐', '자리에 손님이 늘 가득하고 잔이 비지 않으면 족하오.'),
    O('rf_wuanguo',    '철퇴',   '鐵槌',   2, 'might',  74, 38, 60, '🔨', '철퇴로 패창을 맞겠소!'),

    /* 유비군 */
    O('rf_mizhu',      '재헌',   '財獻',   3, 'wisdom', 26, 84, 62, '💰', '집안의 재물을 다 내어 군자금에 보태겠습니다.'),
    O('rf_jianyong',   '언변',   '言辯',   2, 'wisdom', 30, 80, 55, '🗣️', '말로 푸는 일이라면 제가 가지요.'),

    /* 여포군 */
    O('rf_chengong',   '현모',   '賢謀',   4, 'wisdom', 45, 92, 80, '🕳️', '제 계책을 들었다면 이리 되지 않았습니다.'),
    O('rf_gaoshun',    '철진',   '鐵陣',   4, 'command',87, 66, 90, '🪖', '함진영(陷陣營)은 물러선 적이 없습니다.'),

    /* 원술군 */
    O('rf_yuanshu',    '옥형',   '玉衡',   3, 'command',60, 58, 72, '🍯', '옥새가 내게 왔으니 하늘의 뜻이 아니겠는가.'),
    O('rf_jiling',     '중극',   '重戟',   3, 'might',  85, 52, 78, '🌙', '삼첨도(三尖刀)의 무게를 견뎌 보아라.'),
    O('rf_yanghong',   '개창',   '開倉',   2, 'wisdom', 30, 74, 58, '📜', '창고를 열어 인심을 사시지요.'),

    /* 손책군 */
    O('rf_sunce',      '강룡',   '江龍',   5, 'might',  93, 72, 92, '🐅', '강동은 젊은 손으로 여는 것이오.'),
    O('rf_chengpu',    '삼조',   '三朝',   4, 'command',84, 72, 88, '🔱', '삼대를 섬긴 늙은 신하올시다.'),
    O('rf_huanggai',   '화신',   '火身', 4, 'command', 85, 68, 86, '🔥', '이 늙은 몸을 태워서라도 이기겠소.'),
    O('rf_handang',    '조수',   '潮帥',   3, 'might',  83, 58, 80, '🏹', '활이든 창이든 배 위에서라면 지지 않소.'),
    O('rf_zhoutai',    '상흔',   '傷痕',   4, 'might',  89, 48, 78, '🩸', '이 흉터 하나하나가 주공을 지킨 자립니다.'),

    /* 유표군 */
    O('rf_liubiao',    '형수',   '荊守',   3, 'wisdom', 45, 80, 76, '🌾', '형주를 조용히 지키는 것도 공(功)이오.'),
    O('rf_caimao',     '수사',   '水師',   3, 'command',70, 72, 82, '⛵', '수군은 형주의 자랑입니다.'),
    O('rf_kuailiang',  '향로',   '鄕老',   3, 'wisdom', 28, 88, 70, '🪶', '형주의 호족을 달래는 일부터 하십시오.'),
    O('rf_huangzu',    '강수',   '江守',   2, 'command',70, 50, 72, '🏹', '강하는 내가 지킨다.'),
    O('rf_wenpin',     '북수',   '北戍',   3, 'command',82, 66, 85, '🚩', '북쪽 국경은 제가 맡겠습니다.'),

    /* 이각군 (동탁 잔당) */
    O('rf_lijue',      '철혼',   '鐵魂',   3, 'might',  84, 56, 76, '🔥', '장안은 우리 것이다.'),
    O('rf_guosi',      '낙하',   '洛下',   3, 'might',  82, 52, 74, '🐺', '천자를 끼고 있으면 누가 뭐라 하겠나.'),
    O('rf_zhangji',    '양도',   '糧道',   2, 'might',  76, 50, 70, '🛖', '군량만 있으면 어디든 갑니다.'),
    O('rf_jiaxu',      '생책',   '生策',   5, 'wisdom', 40, 99, 78, '🦊', '살아남는 계책만 말씀드립니다.'),

    /* 마등군 */
    O('rf_mateng',     '노기',   '老驥',   3, 'might',  86, 60, 82, '🐫', '서량의 말은 바람을 탄다.'),
    O('rf_pangde',     '관전',   '棺戰',   4, 'might',  92, 60, 84, '⚰️', '관을 지고 나왔으니 살아 돌아갈 뜻이 없소.'),
    O('rf_hansui',     '반맹',   '半盟',   3, 'command',74, 74, 84, '🤝', '동맹은 오래갈 때만 동맹이오.'),

    /* 장로군 */
    O('rf_zhanglu',    '선치',   '仙治',   3, 'wisdom', 50, 78, 74, '☯️', '오두미(五斗米)면 병도 고치고 나라도 다스리오.'),
    O('rf_yangren',    '산로',   '山路',   2, 'might',  76, 52, 70, '⛰️', '한중의 산길은 제가 압니다.'),
    O('rf_yangsong',   '탐금',   '貪金',   1, 'wisdom', 20, 62, 30, '🪙', '금이면 열리지 않는 문이 없지요.'),

    /* 유장군 */
    O('rf_liuzhang',   '인목',   '仁牧',   2, 'wisdom', 30, 62, 55, '🍚', '백성을 싸움에 몰아넣고 싶지 않소.'),
    O('rf_zhangren',   '충절',   '忠節',   4, 'command',87, 74, 88, '🏹', '충신은 두 주인을 섬기지 않소.'),
    O('rf_yanyan',     '노장',   '老將',   4, 'might',  86, 68, 84, '🧓', '목을 벨 장수는 있어도 항복할 장수는 없다.'),
    O('rf_fazheng',    '촉로',   '蜀路',   5, 'wisdom', 42, 95, 76, '🗺️', '촉으로 드는 길을 그려 드리지요.'),
    O('rf_wuyi',       '익병',   '益兵',   3, 'command',80, 66, 82, '🪧', '익주의 병사는 아직 쓸 만합니다.')
  ];

  /**
   * 한국 지역(2026-09-03 확장, `data-city.js` 참고) 수비 무장 9인.
   * **`OFFICERS`/`roster()`와 분리한다** — `roster(forceId)`는 `FORCES`에 실린
   * 사람만 돌려주므로 여기 있는 이름은 어느 중국 세력에도 자동 배분되지 않는다.
   * 세력 없이 `force:null`로 해당 성에 바로 서는 수비대다(재야처럼 수색해야
   * 보이는 게 아니라 처음부터 보인다 — `rtk.js`의 `seedNeutral()` 참고).
   *
   * 루트 `CLAUDE.md` 이름 정책(확장 지역 실존/역사 인물은 가명으로 임의
   * 정한다)에 따라 **실제 역사 인물이 아닌 지어낸 이름**을 쓴다 — 성 이름
   * (양평·국내성 등)은 실제 지명이라 정책 대상이 아니다.
   */
  var KOREA_OFFICERS = [
    { id: 'kr2_pasodan',   name: '파소단', hanja: '波蘇丹', era: '한국(가상)', faction: '양평',
      rarity: 4, trait: 'might', emoji: '⚔️', quote: '여기가 뚫리면 그다음은 없다.',
      stats: { might: 80, wisdom: 50, command: 75 } },
    { id: 'kr2_dokgaru',   name: '독가루', hanja: '禿加婁', era: '한국(가상)', faction: '국내성',
      rarity: 4, trait: 'might', emoji: '🛡️', quote: '산성은 무너지지 않는다. 오르는 자가 지칠 뿐이다.',
      stats: { might: 88, wisdom: 55, command: 82 } },
    { id: 'kr2_sogaram',   name: '소가람', hanja: '蘇加藍', era: '한국(가상)', faction: '국내성',
      rarity: 3, trait: 'wisdom', emoji: '📿', quote: '성 안에서는 곳간이 곧 무기다.',
      stats: { might: 40, wisdom: 90, command: 70 } },
    { id: 'kr2_mokrihae',  name: '목리해', hanja: '木利海', era: '한국(가상)', faction: '낙랑',
      rarity: 4, trait: 'command', emoji: '🏺', quote: '저자를 지키는 것도 싸움이다.',
      stats: { might: 60, wisdom: 65, command: 84 } },
    { id: 'kr2_ajinsa',    name: '아진사', hanja: '阿珍思', era: '한국(가상)', faction: '대방',
      rarity: 3, trait: 'wisdom', emoji: '🗺️', quote: '경계란 두려워할 것이 아니라 살필 것이다.',
      stats: { might: 45, wisdom: 85, command: 68 } },
    { id: 'kr2_yeonuru',   name: '연우루', hanja: '延于婁', era: '한국(가상)', faction: '위례성',
      rarity: 4, trait: 'wisdom', emoji: '📜', quote: '한강은 누구의 편도 아니다 — 다스리는 자의 편일 뿐.',
      stats: { might: 60, wisdom: 90, command: 78 } },
    { id: 'kr2_jimasol',   name: '지마솔', hanja: '支麻率', era: '한국(가상)', faction: '위례성',
      rarity: 4, trait: 'might', emoji: '🏹', quote: '강을 낀 성은 활로 지킨다.',
      stats: { might: 86, wisdom: 48, command: 80 } },
    { id: 'kr2_umorin',    name: '우모린', hanja: '于牟隣', era: '한국(가상)', faction: '금성',
      rarity: 4, trait: 'command', emoji: '🗻', quote: '산이 세 겹이면 군사는 반으로 줄어도 된다.',
      stats: { might: 82, wisdom: 58, command: 88 } },
    { id: 'kr2_seolharan', name: '설하란', hanja: '薛河蘭', era: '한국(가상)', faction: '김해',
      rarity: 3, trait: 'command', emoji: '⛵', quote: '바다는 넓어서 누구든 받아준다 — 지키는 자만 있다면.',
      stats: { might: 65, wisdom: 60, command: 80 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var KOREA_GARRISON = {
    yangping: ['kr2_pasodan'],
    guknae: ['kr2_dokgaru', 'kr2_sogaram'],
    nakrang: ['kr2_mokrihae'],
    daebang: ['kr2_ajinsa'],
    wirye: ['kr2_yeonuru', 'kr2_jimasol'],
    geumseong: ['kr2_umorin'],
    gimhae: ['kr2_seolharan']
  };

  /**
   * 시나리오 ④ 백지(白地)에서 양평 수령을 따라나선 무장 둘 — 이 판에서만 선다.
   * `FORCES_BLANK` 의 세력 표에만 실려 있고, 다른 시나리오에서는 그냥 재야로
   * 흩어진다(`scatterFree` — 어느 표에도 안 적힌 사람의 원칙). 이름 정책에
   * 따라 지어낸 이름이다.
   */
  var BLANK_OFFICERS = [
    { id: 'kr2_yeoyul',    name: '여율', hanja: '呂律', era: '한국(가상)', faction: '양평',
      rarity: 3, trait: 'wisdom', emoji: '📯', quote: '성문은 여닫는 사람이 정하는 겁니다.',
      stats: { might: 48, wisdom: 78, command: 64 } },
    { id: 'kr2_gokdol',    name: '곡돌', hanja: '曲突', era: '한국(가상)', faction: '양평',
      rarity: 3, trait: 'might', emoji: '🐎', quote: '길이 없으면 내가 지나간 자리가 길이오.',
      stats: { might: 78, wisdom: 44, command: 62 } }
  ];

  /**
   * 일본 지역(2026-09-09 확장, `data-city.js` 참고) 수비 무장 9인.
   * KOREA_OFFICERS 와 같은 결 — `FORCES`/`roster()` 에 안 실려 어느 세력에도
   * 자동 배분되지 않고, `force:null` 로 해당 성에 바로 선다.
   *
   * 루트 `CLAUDE.md` 이름 정책에 따라 **실제 역사·설화 인물이 아닌 지어낸
   * 이름**을 쓴다(히미코·도요타마 같은 실제 야마토·일본 신화·역사 속 이름을
   * 그대로/비슷하게 쓰지 않는다) — 성 이름(축자·야마토 등)은 실제 지명이라
   * 정책 대상이 아니다.
   */
  var JAPAN_OFFICERS = [
    { id: 'jp_umihiko',  name: '우미히코', hanja: '海彦', era: '일본(가상)', faction: '대마도',
      rarity: 3, trait: 'might', emoji: '🌊', quote: '섬은 작아도 물길을 아는 자가 지킨다.',
      stats: { might: 78, wisdom: 42, command: 70 } },
    { id: 'jp_shioji',   name: '시오지',   hanja: '潮路', era: '일본(가상)', faction: '일기도',
      rarity: 3, trait: 'wisdom', emoji: '🐚', quote: '다음 섬이 보이지 않아도 물때는 안다.',
      stats: { might: 40, wisdom: 80, command: 60 } },
    { id: 'jp_taketsumi',name: '다케쓰미', hanja: '武積', era: '일본(가상)', faction: '축자',
      rarity: 4, trait: 'command', emoji: '⚓', quote: '대륙에서 오는 것은 다 이 나루를 거친다.',
      stats: { might: 82, wisdom: 55, command: 88 } },
    { id: 'jp_himetsu',  name: '히메쓰',   hanja: '姫津', era: '일본(가상)', faction: '축자',
      rarity: 3, trait: 'wisdom', emoji: '📿', quote: '저자가 흔들리면 나루도 흔들립니다.',
      stats: { might: 38, wisdom: 84, command: 65 } },
    { id: 'jp_hikoyama', name: '히코야마', hanja: '彦山', era: '일본(가상)', faction: '일향',
      rarity: 4, trait: 'might', emoji: '🏹', quote: '산에서 나고 자란 활을 당해낼 자 없다.',
      stats: { might: 86, wisdom: 45, command: 74 } },
    { id: 'jp_kazenari', name: '가제나리', hanja: '風成', era: '일본(가상)', faction: '출운',
      rarity: 3, trait: 'wisdom', emoji: '⛩️', quote: '바람이 이는 쪽에 언제나 답이 있다.',
      stats: { might: 42, wisdom: 82, command: 68 } },
    { id: 'jp_asahime',  name: '아사히메', hanja: '旭姫', era: '일본(가상)', faction: '길비',
      rarity: 4, trait: 'command', emoji: '🌾', quote: '곡식이 마르지 않는 한 이 땅은 지지 않습니다.',
      stats: { might: 58, wisdom: 68, command: 84 } },
    { id: 'jp_wakahiko', name: '와카히코', hanja: '若彦', era: '일본(가상)', faction: '야마토',
      rarity: 4, trait: 'command', emoji: '🗡️', quote: '분지 안쪽까지 들어온 적은 아직 없다.',
      stats: { might: 84, wisdom: 58, command: 90 } },
    { id: 'jp_tamakiri', name: '다마키리', hanja: '玉切', era: '일본(가상)', faction: '야마토',
      rarity: 3, trait: 'wisdom', emoji: '🔮', quote: '중심을 지키는 것도 변경을 지키는 것만큼 무겁다.',
      stats: { might: 40, wisdom: 86, command: 70 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var JAPAN_GARRISON = {
    tsushima: ['jp_umihiko'],
    iki: ['jp_shioji'],
    chikushi: ['jp_taketsumi', 'jp_himetsu'],
    hyuga: ['jp_hikoyama'],
    izumo: ['jp_kazenari'],
    kibi: ['jp_asahime'],
    yamato: ['jp_wakahiko', 'jp_tamakiri']
  };

  /**
   * 교주(交州, 2026-09-09 확장 셋째, `data-city.js` 참고) 수비 무장 9인.
   * KOREA_OFFICERS·JAPAN_OFFICERS 와 같은 결 — `FORCES`/`roster()` 에 안 실려
   * 어느 세력에도 자동 배분되지 않고, `force:null` 로 해당 성에 바로 선다.
   *
   * 루트 `CLAUDE.md` 이름 정책에 따라 **실제 역사 인물이 아닌 지어낸 이름**을
   * 쓴다(이 시대 교주를 실제로 다스린 사군(士郡) 일가의 이름을 그대로/비슷하게
   * 쓰지 않는다) — 성 이름(교지·일남 등)은 실제 지명이라 정책 대상이 아니다.
   */
  var JIAOZHOU_OFFICERS = [
    { id: 'jiao_luyan',   name: '노언',   hanja: '盧彦', era: '교주(가상)', faction: '남해',
      rarity: 4, trait: 'command', emoji: '⚓', quote: '강남에서 온 배는 다 이 나루를 거칩니다.',
      stats: { might: 78, wisdom: 58, command: 86 } },
    { id: 'jiao_hoangmi', name: '황미',   hanja: '黃眉', era: '교주(가상)', faction: '남해',
      rarity: 3, trait: 'wisdom', emoji: '📜', quote: '영남의 물목은 제가 압니다.',
      stats: { might: 38, wisdom: 82, command: 62 } },
    { id: 'jiao_madang',  name: '마당',   hanja: '馬棠', era: '교주(가상)', faction: '창오',
      rarity: 3, trait: 'might', emoji: '🐘', quote: '코끼리가 지나가면 길이 저절로 열립니다.',
      stats: { might: 82, wisdom: 44, command: 72 } },
    { id: 'jiao_dinggo',  name: '정고',   hanja: '丁高', era: '교주(가상)', faction: '울림',
      rarity: 3, trait: 'might', emoji: '🏹', quote: '숲에서는 활을 쏘는 자가 임자입니다.',
      stats: { might: 80, wisdom: 40, command: 68 } },
    { id: 'jiao_botran',  name: '보진',   hanja: '寶陳', era: '교주(가상)', faction: '합포',
      rarity: 3, trait: 'wisdom', emoji: '🦪', quote: '진주보다 귀한 건 그걸 지킬 배입니다.',
      stats: { might: 42, wisdom: 80, command: 66 } },
    { id: 'jiao_riquan',  name: '이권',   hanja: '李權', era: '교주(가상)', faction: '교지',
      rarity: 4, trait: 'command', emoji: '🐉', quote: '삼각주를 쥔 자가 교주를 쥡니다.',
      stats: { might: 76, wisdom: 62, command: 88 } },
    { id: 'jiao_jinja',   name: '진자',   hanja: '陳梓', era: '교주(가상)', faction: '교지',
      rarity: 3, trait: 'wisdom', emoji: '🌾', quote: '벼가 두 번 여무는 땅은 굶지 않습니다.',
      stats: { might: 36, wisdom: 84, command: 64 } },
    { id: 'jiao_muya',    name: '무아',   hanja: '武牙', era: '교주(가상)', faction: '구진',
      rarity: 3, trait: 'might', emoji: '🗡️', quote: '남쪽 끝까지 밀려도 물러설 곳은 없습니다.',
      stats: { might: 79, wisdom: 42, command: 70 } },
    { id: 'jiao_banrok',  name: '반록',   hanja: '潘祿', era: '교주(가상)', faction: '일남',
      rarity: 2, trait: 'command', emoji: '🚩', quote: '한(漢)의 이름이 여기서 끝나지 않게 하겠습니다.',
      stats: { might: 62, wisdom: 50, command: 74 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var JIAOZHOU_GARRISON = {
    nanhai: ['jiao_luyan', 'jiao_hoangmi'],
    cangwu: ['jiao_madang'],
    yulin: ['jiao_dinggo'],
    hepu: ['jiao_botran'],
    jiaozhi: ['jiao_riquan', 'jiao_jinja'],
    jiuzhen: ['jiao_muya'],
    rinan: ['jiao_banrok']
  };

  /**
   * 서역(西域, 2026-09-09 확장 넷째, `data-city.js` 참고) 수비 무장 9인.
   * KOREA_OFFICERS·JAPAN_OFFICERS·JIAOZHOU_OFFICERS 와 같은 결 —
   * `FORCES`/`roster()` 에 안 실려 어느 세력에도 자동 배분되지 않고,
   * `force:null` 로 해당 성에 바로 선다.
   *
   * 루트 `CLAUDE.md` 이름 정책에 따라 **실제 역사 인물이 아닌 지어낸 이름**을
   * 쓴다(이 시대 오아시스 나라들을 실제로 다스린 왕들의 이름을 그대로/비슷하게
   * 쓰지 않는다) — 성 이름(구자·소륵 등)은 실제 지명이라 정책 대상이 아니다.
   */
  var XIYU_OFFICERS = [
    { id: 'xiyu_talban', name: '탈반', hanja: '脫槃', era: '서역(가상)', faction: '돈황',
      rarity: 3, trait: 'might', emoji: '🏜️', quote: '사막을 아는 자만이 사막에서 이깁니다.',
      stats: { might: 80, wisdom: 46, command: 72 } },
    { id: 'xiyu_yeoje',  name: '여저', hanja: '黎且', era: '서역(가상)', faction: '돈황',
      rarity: 3, trait: 'wisdom', emoji: '🐫', quote: '대상(隊商)의 길목을 쥔 자가 금을 쥡니다.',
      stats: { might: 40, wisdom: 80, command: 64 } },
    { id: 'xiyu_mokjil', name: '목질', hanja: '木質', era: '서역(가상)', faction: '누란',
      rarity: 3, trait: 'might', emoji: '🧂', quote: '소금 호수 곁에서는 물러설 곳이 없습니다.',
      stats: { might: 78, wisdom: 42, command: 68 } },
    { id: 'xiyu_dansu',  name: '단수', hanja: '檀須', era: '서역(가상)', faction: '언기',
      rarity: 3, trait: 'wisdom', emoji: '🎶', quote: '북쪽 길의 오아시스는 노래로 손님을 붙듭니다.',
      stats: { might: 38, wisdom: 82, command: 62 } },
    { id: 'xiyu_gumo',   name: '구모', hanja: '龜牟', era: '서역(가상)', faction: '구자',
      rarity: 4, trait: 'command', emoji: '🏺', quote: '악사도 상인도 다 이 나라를 거칩니다.',
      stats: { might: 74, wisdom: 60, command: 86 } },
    { id: 'xiyu_ochi',   name: '오지', hanja: '烏支', era: '서역(가상)', faction: '우전',
      rarity: 3, trait: 'wisdom', emoji: '💎', quote: '강바닥의 옥은 캐는 자가 임자입니다.',
      stats: { might: 42, wisdom: 84, command: 66 } },
    { id: 'xiyu_sarim',  name: '사림', hanja: '莎林', era: '서역(가상)', faction: '소륵',
      rarity: 4, trait: 'command', emoji: '🗺️', quote: '두 길이 다시 만나는 곳을 지키는 것이 제 일입니다.',
      stats: { might: 76, wisdom: 58, command: 88 } },
    { id: 'xiyu_banwol', name: '반월', hanja: '半月', era: '서역(가상)', faction: '소륵',
      rarity: 3, trait: 'wisdom', emoji: '🌙', quote: '파미르 너머 소식도 여기선 반나절이면 옵니다.',
      stats: { might: 36, wisdom: 80, command: 60 } },
    { id: 'xiyu_cheonma', name: '천마', hanja: '天馬', era: '서역(가상)', faction: '대완',
      rarity: 4, trait: 'might', emoji: '🐎', quote: '한혈마는 하루에 천 리를 달립니다.',
      stats: { might: 82, wisdom: 50, command: 70 } },
    /* 2026-09-23 서역 보강 — 차사·사차·정절 */
    { id: 'xiyu_gyoha',   name: '교하', hanja: '交河', era: '서역(가상)', faction: '차사',
      rarity: 3, trait: 'command', emoji: '🏯', quote: '두 물줄기 사이 벼랑 위 성이라, 올라오는 길은 하나뿐입니다.',
      stats: { might: 72, wisdom: 54, command: 80 } },
    { id: 'xiyu_chongryeong', name: '총령', hanja: '葱嶺', era: '서역(가상)', faction: '사차',
      rarity: 4, trait: 'wisdom', emoji: '🏔️', quote: '파미르를 넘는 고갯길은 제 발로 하나하나 다 세어 두었습니다.',
      stats: { might: 50, wisdom: 82, command: 72 } },
    { id: 'xiyu_jeongcheon', name: '정천', hanja: '井泉', era: '서역(가상)', faction: '정절',
      rarity: 3, trait: 'virtue', emoji: '💧', quote: '우물이 마르면 나라도 끝납니다 — 물부터 지킵니다.',
      stats: { might: 38, wisdom: 74, command: 58 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var XIYU_GARRISON = {
    dunhuang: ['xiyu_talban', 'xiyu_yeoje'],
    loulan: ['xiyu_mokjil'],
    yanqi: ['xiyu_dansu'],
    kucha: ['xiyu_gumo'],
    khotan: ['xiyu_ochi'],
    kashgar: ['xiyu_sarim', 'xiyu_banwol'],
    dayuan: ['xiyu_cheonma'],
    cheshi: ['xiyu_gyoha'],
    shache: ['xiyu_chongryeong'],
    jingjue: ['xiyu_jeongcheon']
  };

  /* ── 남중(南中) 지역 수비 무장 (2026-09-09, 다섯째 확장) — 앞 넷과 같은 결.
     era 는 전부 '남중(가상)' — 실존 인물이 아니다(루트 CLAUDE.md 이름 정책). */
  var NANZHONG_OFFICERS = [
    { id: 'nz_soman',     name: '소만', hanja: '蘇蠻', era: '남중(가상)', faction: '주제',
      rarity: 3, trait: 'might', emoji: '🗡️', quote: '산길을 막으면 코끼리도 못 지나갑니다.',
      stats: { might: 80, wisdom: 44, command: 70 } },
    { id: 'nz_ahyang',    name: '아향', hanja: '阿香', era: '남중(가상)', faction: '주제',
      rarity: 3, trait: 'wisdom', emoji: '🌿', quote: '독풀을 아는 자가 이 길의 주인입니다.',
      stats: { might: 40, wisdom: 82, command: 60 } },
    { id: 'nz_mokro',     name: '목로', hanja: '木老', era: '남중(가상)', faction: '건녕',
      rarity: 4, trait: 'command', emoji: '🐘', quote: '코끼리 부대는 산을 오르는 법을 압니다.',
      stats: { might: 76, wisdom: 58, command: 88 } },
    { id: 'nz_eunga',     name: '은가', hanja: '銀珂', era: '남중(가상)', faction: '건녕',
      rarity: 3, trait: 'wisdom', emoji: '🥁', quote: '북소리 하나로 부족 셋을 모읍니다.',
      stats: { might: 38, wisdom: 80, command: 64 } },
    { id: 'nz_jeokpyo',   name: '적표', hanja: '赤豹', era: '남중(가상)', faction: '월수',
      rarity: 3, trait: 'might', emoji: '🐆', quote: '표범처럼 능선을 타면 매복은 실패하지 않습니다.',
      stats: { might: 80, wisdom: 42, command: 68 } },
    { id: 'nz_hyeoncheon',name: '현천', hanja: '玄泉', era: '남중(가상)', faction: '장가',
      rarity: 3, trait: 'wisdom', emoji: '💧', quote: '협곡의 샘을 막으면 군대는 목이 마릅니다.',
      stats: { might: 42, wisdom: 78, command: 62 } },
    { id: 'nz_unhwa',     name: '운화', hanja: '雲花', era: '남중(가상)', faction: '운남',
      rarity: 3, trait: 'wisdom', emoji: '🌸', quote: '구름 남쪽 호수는 봄마다 꽃빛으로 물듭니다.',
      stats: { might: 36, wisdom: 80, command: 58 } },
    { id: 'nz_geumsang',  name: '금상', hanja: '金商', era: '남중(가상)', faction: '영창',
      rarity: 4, trait: 'command', emoji: '💰', quote: '천축(天竺)의 물건도 이 길을 거쳐 옵니다.',
      stats: { might: 70, wisdom: 62, command: 84 } },
    { id: 'nz_heukwol',   name: '흑월', hanja: '黑月', era: '남중(가상)', faction: '흥고',
      rarity: 3, trait: 'might', emoji: '🌑', quote: '가장 먼 변경일수록 밤이 깁니다.',
      stats: { might: 78, wisdom: 40, command: 66 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var NANZHONG_GARRISON = {
    zhuti: ['nz_soman', 'nz_ahyang'],
    jianning: ['nz_mokro', 'nz_eunga'],
    yuexi: ['nz_jeokpyo'],
    zangke: ['nz_hyeoncheon'],
    yunnan: ['nz_unhwa'],
    yongchang: ['nz_geumsang'],
    xinggu: ['nz_heukwol']
  };

  /* ── 천축(天竺) 지역 수비 무장 (2026-09-10, 여섯째 확장) — 앞 다섯과 같은 결.
     era 는 전부 '천축(가상)' — 실존 인물이 아니다(루트 CLAUDE.md 이름 정책).
     faction 은 지키는 성 이름(신독·건타라 등)을 그대로 쓴다(앞 지역과 같은 관례).
     `boss: true` — 2026-09-10 "보스전"(README 여덟 축) 표시. 지역 허브를 지키는
     가장 센 수비 무장 한 명에게만 붙였다. `war.js` `capture()`가 이 표시를 보고
     쓰러뜨렸을 때 보상을 더 준다 — 새 전투 판정이 아니라 기존 fight()/capture()
     결과에 얹는 보상일 뿐이다. */
  var TIANZHU_OFFICERS = [
    { id: 'tz_beonwang',  name: '번왕', hanja: '番王', era: '천축(가상)', faction: '신독',
      rarity: 4, trait: 'command', emoji: '🐘', quote: '코끼리 부대 앞에서는 어떤 성벽도 오래 못 버팁니다.',
      stats: { might: 74, wisdom: 60, command: 86 }, boss: true },
    { id: 'tz_hyanggae',  name: '향개', hanja: '香蓋', era: '천축(가상)', faction: '신독',
      rarity: 3, trait: 'wisdom', emoji: '🕉️', quote: '항하의 물은 마르지 않듯, 이 땅의 셈도 끝이 없습니다.',
      stats: { might: 40, wisdom: 82, command: 62 } },
    { id: 'tz_seoksang',  name: '석상', hanja: '石像', era: '천축(가상)', faction: '건타라',
      rarity: 3, trait: 'wisdom', emoji: '🗿', quote: '돌에 새긴 얼굴은 세월이 지나도 웃고 있습니다.',
      stats: { might: 38, wisdom: 80, command: 60 } },
    { id: 'tz_ganda',     name: '간다', hanja: '干陀', era: '천축(가상)', faction: '건타라',
      rarity: 3, trait: 'might', emoji: '⚔️', quote: '동서의 상단이 다 이 저자를 거쳐 갑니다.',
      stats: { might: 78, wisdom: 46, command: 68 } },
    { id: 'tz_seolsan',   name: '설산', hanja: '雪山', era: '천축(가상)', faction: '계빈',
      rarity: 4, trait: 'might', emoji: '🏔️', quote: '눈 덮인 고개를 넘어 본 자만이 이 땅을 지킬 자격이 있습니다.',
      stats: { might: 84, wisdom: 48, command: 74 } },
    { id: 'tz_daehacheon',name: '대하천', hanja: '大夏泉', era: '천축(가상)', faction: '대하',
      rarity: 3, trait: 'wisdom', emoji: '🐎', quote: '대월지가 남긴 말과 활은 아직 녹슬지 않았습니다.',
      stats: { might: 44, wisdom: 78, command: 66 } },
    { id: 'tz_sanri',     name: '산리', hanja: '山離', era: '천축(가상)', faction: '오익산리',
      rarity: 3, trait: 'wisdom', emoji: '🏛️', quote: '먼 서쪽 나라의 돌기둥을 본 적이 있습니다.',
      stats: { might: 36, wisdom: 76, command: 58 } },
    { id: 'tz_hangha',    name: '항하', hanja: '恒河', era: '천축(가상)', faction: '마게타',
      rarity: 4, trait: 'command', emoji: '🌊', quote: '강이 곧 길이고, 강이 곧 국경입니다.',
      stats: { might: 68, wisdom: 64, command: 84 } },
    { id: 'tz_sawi',      name: '사위', hanja: '舍衛', era: '천축(가상)', faction: '사위',
      rarity: 3, trait: 'virtue', emoji: '🪷', quote: '순례자를 막지 않는 것이 이 저자의 오랜 법입니다.',
      stats: { might: 42, wisdom: 74, command: 60 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var TIANZHU_GARRISON = {
    shendu: ['tz_beonwang', 'tz_hyanggae'],
    jiantuoluo: ['tz_seoksang', 'tz_ganda'],
    jibin: ['tz_seolsan'],
    daxia: ['tz_daehacheon'],
    wuyishanli: ['tz_sanri'],
    moqietuo: ['tz_hangha'],
    sheyi: ['tz_sawi']
  };

  /* ── 막북(漠北) 지역 수비 무장 (2026-09-10, 일곱째 확장) — 앞 여섯과 같은 결.
     era 는 전부 '막북(가상)' — 실존 인물이 아니다. faction 은 성 이름 그대로. */
  var MOBEI_OFFICERS = [
    { id: 'mb_cheolgak',  name: '철각', hanja: '鐵角', era: '막북(가상)', faction: '운중',
      rarity: 4, trait: 'might', emoji: '🐎', quote: '초원의 말은 지치는 법을 모릅니다.',
      stats: { might: 88, wisdom: 40, command: 76 } },
    { id: 'mb_hoja',      name: '호자', hanja: '胡刺', era: '막북(가상)', faction: '운중',
      rarity: 3, trait: 'might', emoji: '🏹', quote: '활은 말 위에서 쏘아야 제맛입니다.',
      stats: { might: 82, wisdom: 42, command: 68 } },
    { id: 'mb_baekwoon',  name: '백운', hanja: '白雲', era: '막북(가상)', faction: '안문',
      rarity: 3, trait: 'wisdom', emoji: '🪶', quote: '기러기 넘는 고개, 봉화가 늦으면 안 됩니다.',
      stats: { might: 44, wisdom: 78, command: 62 } },
    { id: 'mb_hanpung',   name: '한풍', hanja: '寒風', era: '막북(가상)', faction: '정양',
      rarity: 3, trait: 'might', emoji: '❄️', quote: '찬바람이 부는 쪽에서 적이 옵니다.',
      stats: { might: 80, wisdom: 38, command: 64 } },
    { id: 'mb_hwangto',   name: '황토', hanja: '黃土', era: '막북(가상)', faction: '상군',
      rarity: 4, trait: 'command', emoji: '🏜️', quote: '고원의 흙바람은 성벽보다 오래 버팁니다.',
      stats: { might: 72, wisdom: 58, command: 84 } },
    { id: 'mb_gangho',    name: '강호', hanja: '羌胡', era: '막북(가상)', faction: '북지',
      rarity: 3, trait: 'wisdom', emoji: '🐑', quote: '강족과 흉노가 뒤섞여도 셈은 하나입니다.',
      stats: { might: 46, wisdom: 76, command: 60 } },
    { id: 'mb_hanam',     name: '하남', hanja: '河南', era: '막북(가상)', faction: '삭방',
      rarity: 3, trait: 'wisdom', emoji: '🌊', quote: '황하가 크게 굽이치는 곳, 여기가 하남지입니다.',
      stats: { might: 40, wisdom: 74, command: 58 } },
    { id: 'mb_janggwang',name: '장광', hanja: '長光', era: '막북(가상)', faction: '오원',
      rarity: 3, trait: 'might', emoji: '🌌', quote: '가장 먼 북쪽, 겨울밤이 유난히 깁니다.',
      stats: { might: 76, wisdom: 40, command: 62 } },
    { id: 'mb_seonwoo',   name: '선우', hanja: '單于', era: '막북(가상)', faction: '운중',
      rarity: 4, trait: 'command', emoji: '👑', quote: '초원의 여러 부족이 제 깃발 아래 모입니다.',
      stats: { might: 78, wisdom: 56, command: 90 }, boss: true }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var MOBEI_GARRISON = {
    yunzhong: ['mb_cheolgak', 'mb_hoja', 'mb_seonwoo'],
    yanmen: ['mb_baekwoon'],
    dingxiang: ['mb_hanpung'],
    shangjun: ['mb_hwangto'],
    beidi: ['mb_gangho'],
    shuofang: ['mb_hanam'],
    wuyuan: ['mb_janggwang']
  };

  /* ── 임읍(林邑) 지역 수비 무장 (2026-09-10, 여덟째 확장) — 앞 일곱과 같은 결.
     era 는 전부 '임읍(가상)' — 실존 인물이 아니다. faction 은 성 이름 그대로. */
  var LINYI_OFFICERS = [
    { id: 'ly_sangnim',   name: '상님', hanja: '象林', era: '임읍(가상)', faction: '상림',
      rarity: 4, trait: 'might', emoji: '🐘', quote: '임읍이 일어난 땅, 이 현을 지키는 것이 곧 나라를 지키는 일입니다.',
      stats: { might: 82, wisdom: 48, command: 78 } },
    { id: 'ly_uhwa',      name: '우화', hanja: '雨花', era: '임읍(가상)', faction: '상림',
      rarity: 3, trait: 'wisdom', emoji: '🌧️', quote: '우기가 오면 벼가 두 번 여뭅니다.',
      stats: { might: 38, wisdom: 80, command: 60 } },
    { id: 'ly_nogyong',   name: '노경', hanja: '盧景', era: '임읍(가상)', faction: '노용',
      rarity: 3, trait: 'might', emoji: '🌾', quote: '들이 기름지면 지킬 값어치도 큽니다.',
      stats: { might: 76, wisdom: 44, command: 66 } },
    { id: 'ly_jinju',     name: '진주', hanja: '眞珠', era: '임읍(가상)', faction: '비경',
      rarity: 3, trait: 'wisdom', emoji: '🦪', quote: '바다가 내어 주는 것은 진주만이 아닙니다.',
      stats: { might: 40, wisdom: 78, command: 62 } },
    { id: 'ly_juoh',      name: '주오', hanja: '朱吾', era: '임읍(가상)', faction: '주오',
      rarity: 3, trait: 'virtue', emoji: '🌊', quote: '기록이 끝나는 곳에서도 사람은 삽니다.',
      stats: { might: 42, wisdom: 70, command: 58 } },
    { id: 'ly_sanga',     name: '산아', hanja: '山牙', era: '임읍(가상)', faction: '서권',
      rarity: 3, trait: 'might', emoji: '🐆', quote: '코끼리가 못 오르는 산도 사람은 오릅니다.',
      stats: { might: 78, wisdom: 42, command: 64 } },
    { id: 'ly_jeonchung', name: '전충', hanja: '典沖', era: '임읍(가상)', faction: '전충',
      rarity: 4, trait: 'command', emoji: '🏯', quote: '벽돌로 쌓은 성벽은 불에도 잘 안 무너집니다.',
      stats: { might: 74, wisdom: 60, command: 88 }, boss: true },
    { id: 'ly_byeokjeon', name: '벽전', hanja: '甓塼', era: '임읍(가상)', faction: '전충',
      rarity: 3, trait: 'wisdom', emoji: '🧱', quote: '벽돌 굽는 가마 불은 밤에도 꺼지지 않습니다.',
      stats: { might: 44, wisdom: 76, command: 64 } },
    { id: 'ly_heuksang',  name: '흑상', hanja: '黑象', era: '임읍(가상)', faction: '구속',
      rarity: 3, trait: 'might', emoji: '🌑', quote: '지도 위 가장 남쪽, 기록도 여기서 흐려집니다.',
      stats: { might: 76, wisdom: 38, command: 60 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var LINYI_GARRISON = {
    xianglin: ['ly_sangnim', 'ly_uhwa'],
    luorong: ['ly_nogyong'],
    bijing: ['ly_jinju'],
    zhuwu: ['ly_juoh'],
    xiquan: ['ly_sanga'],
    dianchong: ['ly_jeonchung', 'ly_byeokjeon'],
    quzu: ['ly_heuksang']
  };

  /* ── 균열(龜裂) 지역 수비 무장 (2026-09-10, 아홉째 확장) — 앞 여덟과
     자리·판정은 같은 결(force:null·GARRISON 표·9인)이지만 사람이 아니라
     **괴물**이다. era 는 전부 '균열(가상)' — 실존 인물도, 실존 지명도
     아니다. `monster` 필드는 asset3d.js `heroRecipe()`가 곧장 읽는 실제
     CC0 3D 모델 경로다(Quaternius "Ultimate Monsters Bundle", CC0 —
     `assets/ASSET_LICENSES.md` 참고, saga-dungeon 이 이미 검증해 둔
     자산을 그대로 복사해 왔다) — 표시 이름은 원작 몬스터 팩 이름(Alien·
     Demon 등)을 그대로 안 쓰고 이 판이 새로 지었다(내부 파일명은 화면에
     안 뜨니 이름 정책과 무관하다). */
  var FUTURE_OFFICERS = [
    { id: 'fu_seonghon',  name: '성혼', hanja: '星魂', era: '균열(가상)', faction: '천궤',
      rarity: 4, trait: 'wisdom', emoji: '👽', quote: '별 사이를 건너온 자리, 이 관문부터 지킵니다.',
      stats: { might: 50, wisdom: 88, command: 70 },
      monster: 'assets/models/monsters/quaternius/Alien_0bb74be9.glb' },
    { id: 'fu_yuseong',   name: '유성', hanja: '流星', era: '균열(가상)', faction: '천궤',
      rarity: 3, trait: 'wisdom', emoji: '☄️', quote: '떨어지는 것은 다 여기로 떨어집니다.',
      stats: { might: 46, wisdom: 80, command: 62 },
      monster: 'assets/models/monsters/quaternius/Alien_b048d82a.glb' },
    { id: 'fu_noejang',   name: '뇌장', hanja: '雷將', era: '균열(가상)', faction: '뇌성',
      rarity: 3, trait: 'might', emoji: '⚡', quote: '번개가 치기 전에 이미 우리가 먼저 움직입니다.',
      stats: { might: 78, wisdom: 44, command: 66 },
      monster: 'assets/models/monsters/quaternius/Blue_Demon_6fbb8914.glb' },
    { id: 'fu_gangma',    name: '강마', hanja: '鋼魔', era: '균열(가상)', faction: '강철',
      rarity: 3, trait: 'might', emoji: '🔩', quote: '쇠는 부러지지 않습니다, 휘어질 뿐입니다.',
      stats: { might: 80, wisdom: 40, command: 60 },
      monster: 'assets/models/monsters/quaternius/Demon_46b52ba4.glb' },
    { id: 'fu_yugwi',     name: '유귀', hanja: '琉鬼', era: '균열(가상)', faction: '유리',
      rarity: 3, trait: 'command', emoji: '💎', quote: '투명한 벽 안에서는 숨을 곳이 없습니다 — 지키는 저희도 마찬가지입니다.',
      stats: { might: 52, wisdom: 58, command: 82 },
      monster: 'assets/models/monsters/quaternius/Goleling_Evolved_d6308fbf.glb' },
    { id: 'fu_hwanryeong',name: '환령', hanja: '幻靈', era: '균열(가상)', faction: '환영',
      rarity: 3, trait: 'wisdom', emoji: '👻', quote: '보이는 것을 믿지 마십시오, 저부터가 그렇습니다.',
      stats: { might: 42, wisdom: 78, command: 56 },
      monster: 'assets/models/monsters/quaternius/Ghost_Skull_0716bf8e.glb' },
    { id: 'fu_janhon',    name: '잔혼', hanja: '殘魂', era: '균열(가상)', faction: '잔영',
      rarity: 3, trait: 'might', emoji: '❄️', quote: '허물어진 것도 끝까지 버티면 성벽입니다.',
      stats: { might: 76, wisdom: 40, command: 58 },
      monster: 'assets/models/monsters/quaternius/Yeti_40a831b3.glb' },
    { id: 'fu_jongwang',  name: '종왕', hanja: '終末王', era: '균열(가상)', faction: '종말',
      rarity: 4, trait: 'command', emoji: '🐲', quote: '이 자리가 끝이라면, 지키는 것도 제가 마지막입니다.',
      stats: { might: 80, wisdom: 70, command: 92 }, boss: true,
      monster: 'assets/models/monsters/quaternius/Dragon_Evolved_90ed3740.glb' },
    { id: 'fu_myeongje',  name: '명제', hanja: '冥帝', era: '균열(가상)', faction: '종말',
      rarity: 3, trait: 'might', emoji: '👹', quote: '겹친 시간 속에서는 죽는 것도 순서가 없습니다.',
      stats: { might: 82, wisdom: 42, command: 64 },
      monster: 'assets/models/monsters/quaternius/Orc_Enemy_3076c5f7.glb' }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var FUTURE_GARRISON = {
    cheongwe: ['fu_seonghon', 'fu_yuseong'],
    noeseong: ['fu_noejang'],
    gangcheol: ['fu_gangma'],
    yuri: ['fu_yugwi'],
    hwanyeong: ['fu_hwanryeong'],
    janyeong: ['fu_janhon'],
    jongmal: ['fu_jongwang', 'fu_myeongje']
  };

  /* ── 폐허(廢墟) 지역 수비 무장 (2026-09-11, 열째 확장) — 균열과 같은
     결(force:null·GARRISON 표·9인, 사람이 아니다)이지만 **다른 팩**을
     쓴다. era 는 전부 '폐허(가상)' — 균열의 외계·마수가 아니라 오염된
     짐승과 되살아난 주검이다. `monster` 필드는 asset3d.js
     `heroRecipe()`가 곧장 읽는 실제 CC0 3D 모델 경로다(Quaternius
     "Bandits & Zombies"·"Nature Enemies" 계열 + community Slime,
     `saga-dungeon`이 이미 검증해 둔 자산을 그대로 복사해 왔다 —
     `assets/ASSET_LICENSES.md` 참고). 표시 이름은 원작 파일명(Zombie·
     Giant 등)을 그대로 안 쓰고 이 판이 새로 지었다. */
  var RUIN_OFFICERS = [
    { id: 'ru_busaeng',   name: '부생', hanja: '腐生', era: '폐허(가상)', faction: '폐도',
      rarity: 3, trait: 'might', emoji: '🧟', quote: '죽어도 멈추지 않습니다.',
      stats: { might: 74, wisdom: 30, command: 52 },
      monster: 'assets/models/monsters/quaternius2/Zombie.glb' },
    { id: 'ru_geohae',    name: '거해', hanja: '巨骸', era: '폐허(가상)', faction: '폐도',
      rarity: 4, trait: 'might', emoji: '🗿', quote: '이 폐허에서 가장 큰 그림자는 저입니다.',
      stats: { might: 88, wisdom: 34, command: 66 }, boss: true,
      monster: 'assets/models/monsters/quaternius2/Giant.glb' },
    { id: 'ru_gogol',     name: '고골', hanja: '枯骨', era: '폐허(가상)', faction: '잔재',
      rarity: 3, trait: 'might', emoji: '💀', quote: '살은 다 떨어져 나갔지만, 자리는 지킵니다.',
      stats: { might: 70, wisdom: 42, command: 58 },
      monster: 'assets/models/monsters/quaternius2/SkeletonSolo.glb' },
    { id: 'ru_mangdok',   name: '망독', hanja: '網毒', era: '폐허(가상)', faction: '잔재',
      rarity: 3, trait: 'wisdom', emoji: '🕷️', quote: '걸리면 빠져나갈 길이 없습니다.',
      stats: { might: 48, wisdom: 76, command: 50 },
      monster: 'assets/models/monsters/quaternius2/Spider.glb' },
    { id: 'ru_sanaek',    name: '산액', hanja: '酸液', era: '폐허(가상)', faction: '오염',
      rarity: 3, trait: 'command', emoji: '🧪', quote: '베어도 갈라질 뿐, 죽지 않습니다.',
      stats: { might: 40, wisdom: 60, command: 78 },
      monster: 'assets/models/monsters/community/SlimeEnemy.glb' },
    { id: 'ru_sayeong',   name: '사영', hanja: '蛇影', era: '폐허(가상)', faction: '침묵',
      rarity: 3, trait: 'wisdom', emoji: '🐍', quote: '소리 없이 다가섭니다, 이 침묵과 같이.',
      stats: { might: 50, wisdom: 80, command: 48 },
      monster: 'assets/models/monsters/quaternius2/Snake.glb' },
    { id: 'ru_seogun',    name: '서군', hanja: '鼠群', era: '폐허(가상)', faction: '회곡',
      rarity: 3, trait: 'command', emoji: '🐀', quote: '하나씩은 약해도, 무리는 다릅니다.',
      stats: { might: 44, wisdom: 52, command: 74 },
      monster: 'assets/models/monsters/quaternius2/Rat.glb' },
    { id: 'ru_wadok',     name: '와독', hanja: '蛙毒', era: '폐허(가상)', faction: '역병',
      rarity: 3, trait: 'wisdom', emoji: '🐸', quote: '병이 지나간 자리에 저희가 남았습니다.',
      stats: { might: 46, wisdom: 72, command: 54 },
      monster: 'assets/models/monsters/quaternius2/FrogEnemy.glb' },
    { id: 'ru_doksi',     name: '독시', hanja: '毒翅', era: '폐허(가상)', faction: '잔향',
      rarity: 3, trait: 'command', emoji: '🐝', quote: '메아리처럼, 떼로 몰려옵니다.',
      stats: { might: 58, wisdom: 46, command: 72 },
      monster: 'assets/models/monsters/quaternius2/Wasp.glb' }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var RUIN_GARRISON = {
    pyedo: ['ru_busaeng', 'ru_geohae'],
    janjae: ['ru_gogol', 'ru_mangdok'],
    oyeom: ['ru_sanaek'],
    chimmuk: ['ru_sayeong'],
    hoegok: ['ru_seogun'],
    yeokbyeong: ['ru_wadok'],
    janhyang: ['ru_doksi']
  };

  /* ── 묘역(墓域) 지역 수비 무장 (2026-09-11, 열한째 확장) — 균열·폐허와
     같은 결(force:null·GARRISON 표·9인, 사람이 아니다)이지만 **셋째
     팩**을 쓴다. era 는 전부 '묘역(가상)' — 되살아난 해골 병사다.
     `monster` 필드는 asset3d.js `heroRecipe()`가 곧장 읽는 실제 CC0
     3D 모델 경로다(KayKit Skeletons 4종 — Mage·Minion·Rogue·Warrior,
     `saga-dungeon`이 이미 검증해 둔 자산을 그대로 복사해 왔다 —
     `assets/ASSET_LICENSES.md` 참고). **9인이 4종 모델을 나눠 쓴다**
     (균열·폐허처럼 1인 1모델이 아니다 — 이 팩은 한 벌이 2.5MB 안팎으로
     무거워, 9벌을 다 받으면 20MB를 넘는다. `asset3d.js`의 `acquire()`
     캐시가 URL 기준이라 같은 GLB 를 쓰는 인물끼리는 실제로 한 번만
     받는다 — tint(세력색)로만 서로 다르게 보인다). 표시 이름은 원작
     파일명을 그대로 안 쓰고 이 판이 새로 지었다. */
  var TOMB_OFFICERS = [
    { id: 'tb_baekgi',  name: '백기', hanja: '白騎', era: '묘역(가상)', faction: '묘문',
      rarity: 4, trait: 'might', emoji: '💀', quote: '이 무덤 앞에서는 산 것도 죽은 것도 다 같은 손님입니다.',
      stats: { might: 86, wisdom: 38, command: 70 }, boss: true,
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Warrior.glb' },
    { id: 'tb_ganghae', name: '강해', hanja: '强骸', era: '묘역(가상)', faction: '백골',
      rarity: 3, trait: 'might', emoji: '🦴', quote: '부러진 뼈로도 창은 들 수 있습니다.',
      stats: { might: 78, wisdom: 32, command: 56 },
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Warrior.glb' },
    { id: 'tb_gojeon',  name: '고전', hanja: '古戰', era: '묘역(가상)', faction: '침관',
      rarity: 3, trait: 'might', emoji: '⚔️', quote: '옛 싸움을 기억하는 건 이제 저희뿐입니다.',
      stats: { might: 74, wisdom: 36, command: 60 },
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Warrior.glb' },
    { id: 'tb_amseup',  name: '암습', hanja: '暗襲', era: '묘역(가상)', faction: '혼로',
      rarity: 3, trait: 'wisdom', emoji: '🗡️', quote: '그림자가 길어질 때, 저도 함께 깁니다.',
      stats: { might: 56, wisdom: 70, command: 52 },
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Rogue.glb' },
    { id: 'tb_jamhon',  name: '잠혼', hanja: '潛魂', era: '묘역(가상)', faction: '진혼',
      rarity: 3, trait: 'wisdom', emoji: '👤', quote: '혼은 몸이 없어도 숨을 곳을 압니다.',
      stats: { might: 52, wisdom: 74, command: 50 },
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Rogue.glb' },
    { id: 'tb_saryeong',name: '사령', hanja: '死靈', era: '묘역(가상)', faction: '유골',
      rarity: 3, trait: 'wisdom', emoji: '🔮', quote: '죽음을 부리는 건 죽은 자가 제일 잘합니다.',
      stats: { might: 38, wisdom: 84, command: 58 },
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Mage.glb' },
    { id: 'tb_heukju',  name: '흑주', hanja: '黑呪', era: '묘역(가상)', faction: '심연',
      rarity: 3, trait: 'wisdom', emoji: '🕯️', quote: '저주는 말보다 오래 남습니다.',
      stats: { might: 36, wisdom: 82, command: 62 },
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Mage.glb' },
    { id: 'tb_japgol',  name: '잡골', hanja: '雜骨', era: '묘역(가상)', faction: '백골',
      rarity: 3, trait: 'might', emoji: '🩻', quote: '이름은 잊었지만, 자리는 안 잊었습니다.',
      stats: { might: 60, wisdom: 34, command: 44 },
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Minion.glb' },
    { id: 'tb_jongja',  name: '종자', hanja: '從者', era: '묘역(가상)', faction: '침관',
      rarity: 3, trait: 'command', emoji: '⛓️', quote: '누군가는 앞에 서야 합니다, 저는 그게 익숙합니다.',
      stats: { might: 58, wisdom: 36, command: 46 },
      monster: 'assets/models/monsters/kaykit_skeletons/Skeleton_Minion.glb' }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var TOMB_GARRISON = {
    myomun: ['tb_baekgi', 'tb_ganghae'],
    baekgol: ['tb_japgol'],
    chimgwan: ['tb_gojeon', 'tb_jongja'],
    honro: ['tb_amseup'],
    jinhon: ['tb_jamhon'],
    yugol: ['tb_saryeong'],
    simyeon: ['tb_heukju']
  };

  /* ── 대진(大秦) 지역 수비 무장 (2026-09-22, 열두째 확장) — 앞 열하나와
     같은 결. era 는 전부 '대진(가상)' — 실존 인물이 아니다. faction 은
     지키는 성 이름 그대로. */
  var DAQIN_OFFICERS = [
    { id: 'dj_yuri',      name: '유리', hanja: '琉璃', era: '대진(가상)', faction: '조지',
      rarity: 3, trait: 'wisdom', emoji: '🏺', quote: '여기서 나는 유리그릇은 장안까지 가도 안 깨집니다.',
      stats: { might: 40, wisdom: 78, command: 60 } },
    { id: 'dj_hopak',     name: '호박', hanja: '琥珀', era: '대진(가상)', faction: '조지',
      rarity: 3, trait: 'command', emoji: '⚔️', quote: '장사꾼도 칼을 찰 줄 알아야 이 길을 지나갑니다.',
      stats: { might: 70, wisdom: 50, command: 76 } },
    { id: 'dj_seohae',    name: '서해', hanja: '西海', era: '대진(가상)', faction: '안식',
      rarity: 4, trait: 'wisdom', emoji: '🌊', quote: '바다가 이렇게 넓은 줄은 이 끝에 와서야 알았습니다.',
      stats: { might: 42, wisdom: 84, command: 66 } },
    { id: 'dj_seoncheok', name: '선척', hanja: '船隻', era: '대진(가상)', faction: '안식',
      rarity: 3, trait: 'command', emoji: '⛵', quote: '바람이 사나우면 두 해도 걸립니다 — 함부로 배를 내지 않습니다.',
      stats: { might: 56, wisdom: 60, command: 80 } },
    { id: 'dj_gapju',     name: '갑주', hanja: '甲胄', era: '대진(가상)', faction: '려건',
      rarity: 4, trait: 'might', emoji: '🛡️', quote: '먼 서쪽에서 갑옷째 흘러들어 온 자들이라 들었습니다.',
      stats: { might: 86, wisdom: 44, command: 70 } },
    { id: 'dj_doseo',     name: '도서', hanja: '島嶼', era: '대진(가상)', faction: '택산',
      rarity: 3, trait: 'wisdom', emoji: '🏝️', quote: '치소가 바다 한가운데 있으니, 여긴 성이 아니라 배와 같습니다.',
      stats: { might: 38, wisdom: 76, command: 58 } },
    { id: 'dj_gijang',    name: '기장', hanja: '記帳', era: '대진(가상)', faction: '사복',
      rarity: 3, trait: 'virtue', emoji: '📜', quote: '오간 물건은 다 장부에 남습니다 — 셈은 거짓말을 안 합니다.',
      stats: { might: 34, wisdom: 74, command: 56 } },
    { id: 'dj_haean',     name: '해안', hanja: '海岸', era: '대진(가상)', faction: '차란',
      rarity: 3, trait: 'might', emoji: '⚓', quote: '해안 평야를 지키는 데엔 배도 병사만큼 요긴합니다.',
      stats: { might: 72, wisdom: 46, command: 64 } },
    { id: 'dj_hwanggeum', name: '황금', hanja: '黃金', era: '대진(가상)', faction: '대진',
      rarity: 4, trait: 'command', emoji: '👑', quote: '감영이 못 밟은 땅에 그대가 먼저 서게 될 겁니다.',
      stats: { might: 68, wisdom: 62, command: 90 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var DAQIN_GARRISON = {
    tiaozhi: ['dj_yuri', 'dj_hopak'],
    anxi: ['dj_seohae', 'dj_seoncheok'],
    lijian: ['dj_gapju'],
    zesan: ['dj_doseo'],
    sifu: ['dj_gijang'],
    qielan: ['dj_haean'],
    daqin: ['dj_hwanggeum']
  };

  /* ── 선비(鮮卑) 지역 수비 무장 (2026-09-22, 열셋째 확장) — 앞 열둘과
     같은 결. era 는 전부 '선비(가상)' — 실존 인물이 아니다. faction 은
     지키는 성 이름 그대로. */
  var XIANBEI_OFFICERS = [
    { id: 'xb_gyeon',    name: '견마', hanja: '犬馬', era: '선비(가상)', faction: '고류',
      rarity: 3, trait: 'might', emoji: '🐎', quote: '말이 지치지 않으니 여기서부턴 걸음이 배로 빨라집니다.',
      stats: { might: 80, wisdom: 40, command: 66 } },
    { id: 'xb_bonghwa',  name: '봉화', hanja: '烽火', era: '선비(가상)', faction: '고류',
      rarity: 3, trait: 'wisdom', emoji: '🔥', quote: '연기 한 줄기로 삼백 리 너머까지 소식을 보냅니다.',
      stats: { might: 44, wisdom: 76, command: 62 } },
    { id: 'xb_daein',    name: '대인', hanja: '大人', era: '선비(가상)', faction: '탄한산',
      rarity: 4, trait: 'command', emoji: '👑', quote: '동서 두 부의 부족장이 다 이 왕정 아래 모입니다.',
      stats: { might: 74, wisdom: 58, command: 88 } },
    { id: 'xb_gaseul',   name: '가슬', hanja: '歠仇', era: '선비(가상)', faction: '탄한산',
      rarity: 3, trait: 'wisdom', emoji: '💧', quote: '왕정 곁을 흐르는 물줄기 이름을 딴 사람입니다.',
      stats: { might: 40, wisdom: 74, command: 60 } },
    { id: 'xb_hoja',     name: '호각', hanja: '胡角', era: '선비(가상)', faction: '선비산',
      rarity: 3, trait: 'might', emoji: '🏹', quote: '이름을 딴 산에서 나고 자랐으니 물러설 자리가 없습니다.',
      stats: { might: 78, wisdom: 42, command: 64 } },
    { id: 'xb_honin',    name: '혼인', hanja: '婚姻', era: '선비(가상)', faction: '요락수',
      rarity: 3, trait: 'virtue', emoji: '💞', quote: '해마다 이 강가에서 짝을 짓습니다 — 전쟁도 그날만은 쉽니다.',
      stats: { might: 38, wisdom: 70, command: 56 } },
    { id: 'xb_eoryang',  name: '어량', hanja: '漁梁', era: '선비(가상)', faction: '요락수',
      rarity: 3, trait: 'wisdom', emoji: '🐟', quote: '강이 주는 것을 나누는 법부터 배웁니다.',
      stats: { might: 36, wisdom: 72, command: 58 } },
    { id: 'xb_hondo',    name: '혼도', hanja: '魂導', era: '선비(가상)', faction: '적산',
      rarity: 3, trait: 'wisdom', emoji: '⛰️', quote: '여기서 넋을 돌려보내지 않으면 산 자가 앓습니다.',
      stats: { might: 42, wisdom: 78, command: 60 } },
    { id: 'xb_yong',     name: '용맹', hanja: '龍猛', era: '선비(가상)', faction: '용성',
      rarity: 4, trait: 'might', emoji: '🐉', quote: '흉노가 하늘에 빌던 자리, 이젠 우리가 지킵니다.',
      stats: { might: 84, wisdom: 46, command: 74 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var XIANBEI_GARRISON = {
    goryu: ['xb_gyeon', 'xb_bonghwa'],
    tanhansan: ['xb_daein', 'xb_gaseul'],
    seonbisan: ['xb_hoja'],
    yorak: ['xb_honin', 'xb_eoryang'],
    jeoksan: ['xb_hondo'],
    yongseong: ['xb_yong']
  };

  /* ── 남해(南海) 지역 수비 무장 (2026-09-22, 열넷째 확장) — 앞 열셋과
     같은 결. era 는 전부 '남해(가상)' — 실존 인물이 아니다. faction 은
     지키는 성 이름 그대로. */
  var NANHAI_OFFICERS = [
    { id: 'nh_jinju',    name: '진주', hanja: '眞珠', era: '남해(가상)', faction: '주애',
      rarity: 3, trait: 'wisdom', emoji: '🦪', quote: '바다가 캐 주는 것은 진주만이 아닙니다.',
      stats: { might: 40, wisdom: 76, command: 60 } },
    { id: 'nh_yeombun',  name: '염분', hanja: '鹽分', era: '남해(가상)', faction: '주애',
      rarity: 3, trait: 'might', emoji: '🌊', quote: '짠물을 마셔 가며 지킨 섬입니다.',
      stats: { might: 74, wisdom: 44, command: 64 } },
    { id: 'nh_daemo',    name: '대모', hanja: '玳瑁', era: '남해(가상)', faction: '담이',
      rarity: 3, trait: 'wisdom', emoji: '🐢', quote: '거북 등딱지가 이 섬 저자의 값나가는 물건입니다.',
      stats: { might: 38, wisdom: 74, command: 58 } },
    { id: 'nh_wion',     name: '위선', hanja: '衛船', era: '남해(가상)', faction: '이주',
      rarity: 4, trait: 'command', emoji: '⛵', quote: '군사를 싣고 왔으니, 다시 배를 낼 일도 있을 겁니다.',
      stats: { might: 68, wisdom: 56, command: 82 } },
    { id: 'nh_torak',    name: '토착', hanja: '土着', era: '남해(가상)', faction: '이주',
      rarity: 3, trait: 'might', emoji: '🏹', quote: '이 섬에서 나고 자란 사람이 이 섬을 제일 잘 압니다.',
      stats: { might: 76, wisdom: 42, command: 62 } },
    { id: 'nh_migyeon',  name: '미견', hanja: '未見', era: '남해(가상)', faction: '단주',
      rarity: 4, trait: 'wisdom', emoji: '🌫️', quote: '위온도 이 섬만은 끝내 보지 못했다고 들었습니다.',
      stats: { might: 44, wisdom: 82, command: 68 } },
    { id: 'nh_sasin',    name: '사신', hanja: '使臣', era: '남해(가상)', faction: '부남',
      rarity: 3, trait: 'virtue', emoji: '📜', quote: '먼 나라와도 예로써 오간 기록이 있습니다.',
      stats: { might: 42, wisdom: 78, command: 64 } },
    { id: 'nh_metong',   name: '메콩', hanja: '湄公', era: '남해(가상)', faction: '부남',
      rarity: 3, trait: 'wisdom', emoji: '🌾', quote: '강물이 기름진 들을 매년 새로 부려 놓습니다.',
      stats: { might: 40, wisdom: 76, command: 62 } },
    { id: 'nh_bandoja',  name: '반도자', hanja: '半島者', era: '남해(가상)', faction: '돈손',
      rarity: 3, trait: 'might', emoji: '⚓', quote: '반도 저자를 지나는 배는 다 여기 들릅니다.',
      stats: { might: 72, wisdom: 48, command: 66 } }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var NANHAI_GARRISON = {
    zhuya: ['nh_jinju', 'nh_yeombun'],
    daner: ['nh_daemo'],
    yizhou: ['nh_wion', 'nh_torak'],
    danzhou: ['nh_migyeon'],
    funan: ['nh_sasin', 'nh_metong'],
    dunsun: ['nh_bandoja']
  };

  /* ── 실크로드 지역 수비 무장 (2026-09-23, 열다섯째 확장) — 앞 열넷과
     같은 결. era 는 전부 '실크로드(가상)' — 실존 인물이 아니다. faction 은
     지키는 성 이름 그대로. 이름은 그 땅의 물건·풍습에서 딴 가명이다. */
  var SILK_OFFICERS = [
    { id: 'sl_cheonsan', name: '천산', hanja: '天山', era: '실크로드(가상)', faction: '오손',
      rarity: 4, trait: 'might', emoji: '🐎', quote: '초원의 말은 겨울에도 눈을 헤쳐 풀을 찾아냅니다.',
      stats: { might: 84, wisdom: 44, command: 72 } },
    { id: 'sl_hwachin',  name: '화친', hanja: '和親', era: '실크로드(가상)', faction: '오손',
      rarity: 3, trait: 'virtue', emoji: '🎎', quote: '먼 동쪽에서 시집온 이가 가져온 비단을 아직 간직합니다.',
      stats: { might: 36, wisdom: 76, command: 60 } },
    { id: 'sl_nakta',    name: '낙타', hanja: '駱駝', era: '실크로드(가상)', faction: '강거',
      rarity: 3, trait: 'wisdom', emoji: '🐫', quote: '낙타 한 마리 짐이면 장안 저자 한 칸을 채웁니다.',
      stats: { might: 44, wisdom: 78, command: 62 } },
    { id: 'sl_hosang',   name: '호상', hanja: '胡商', era: '실크로드(가상)', faction: '강거',
      rarity: 3, trait: 'command', emoji: '⚖️', quote: '장사꾼끼리의 약속은 칼보다 무겁습니다.',
      stats: { might: 58, wisdom: 66, command: 74 } },
    { id: 'sl_daetaek',  name: '대택', hanja: '大澤', era: '실크로드(가상)', faction: '엄채',
      rarity: 3, trait: 'might', emoji: '🏹', quote: '큰 호수까지 말을 달려도 초원은 끝나지 않습니다.',
      stats: { might: 80, wisdom: 40, command: 66 } },
    { id: 'sl_wangjeong', name: '왕정', hanja: '王庭', era: '실크로드(가상)', faction: '감씨',
      rarity: 4, trait: 'command', emoji: '⛺', quote: '강 남쪽의 옛 나라들도 이제 이 천막 아래 조아립니다.',
      stats: { might: 70, wisdom: 60, command: 86 } },
    { id: 'sl_heupu',    name: '흡후', hanja: '翕侯', era: '실크로드(가상)', faction: '휴밀',
      rarity: 3, trait: 'wisdom', emoji: '🏔️', quote: '다섯 흡후 가운데 가장 좁은 골짜기를 맡았습니다.',
      stats: { might: 46, wisdom: 76, command: 64 } },
    { id: 'sl_geumhwa',  name: '금화', hanja: '金貨', era: '실크로드(가상)', faction: '귀상',
      rarity: 4, trait: 'command', emoji: '🪙', quote: '동전 한 닢에 동쪽 신과 서쪽 신이 함께 새겨집니다.',
      stats: { might: 66, wisdom: 70, command: 90 } },
    { id: 'sl_josang',   name: '조상', hanja: '彫像', era: '실크로드(가상)', faction: '귀상',
      rarity: 4, trait: 'wisdom', emoji: '🗿', quote: '서쪽 조각가의 손으로 동쪽 성인의 얼굴을 빚습니다.',
      stats: { might: 40, wisdom: 88, command: 64 } }
  ];

  /* ── 시간 틈 사람 아홉 (PLAN §5-12 · SAGA-DESIGN §13 전체 퓨전, 2026-09-24) — 이계(균열·폐허·묘역)는 괴물이
     지키지만 본토엔 옛사람뿐이었다. 시간의 틈으로 떨어진 **현대 다섯·미래 넷**을 어느 표에도 안 싣는다 —
     그래서 어느 시나리오에서든 재야로 흩어지고(`scatterFree`), 수색으로 찾아 등용한다. `body` 는 사람 몸 CC0
     GLB(Quaternius — 사가만리 ⑱ 에서 복사, 제 클립 내장)라 `asset3d.heroRecipe()` 가 몸이자 몸짓으로 쓴다.
     `monster` 가 아니라서 괴물 딱지·후계 뒷순위는 안 붙는다. 이름·한자는 전부 지어낸 것 */
  var FOLK = 'assets/models/people/folk/';
  var TIME_OFFICERS = [
    { id: 'tm_gangseo',  name: '강서', hanja: '剛誓', era: '현대(가상)', faction: '시간 틈', rarity: 4, trait: 'might', emoji: '🛡️',
      quote: '방패 뒤로 서십시오. 이 성문은 제가 막습니다.', stats: { might: 84, wisdom: 42, command: 74 }, body: FOLK + 'm_SWAT.glb' },
    { id: 'tm_gongseok', name: '공석', hanja: '工石', era: '현대(가상)', faction: '시간 틈', rarity: 3, trait: 'virtue', emoji: '🦺',
      quote: '성벽이요? 사흘이면 두 겹으로 올립니다.', stats: { might: 68, wisdom: 58, command: 62 }, body: FOLK + 'm_Worker.glb' },
    { id: 'tm_geumdam',  name: '금담', hanja: '金談', era: '현대(가상)', faction: '시간 틈', rarity: 4, trait: 'wisdom', emoji: '💼',
      quote: '군자금은 모으는 게 아니라 굴리는 겁니다.', stats: { might: 40, wisdom: 86, command: 64 }, body: FOLK + 'm_BusinessMan.glb' },
    { id: 'tm_myeongbyeon', name: '명변', hanja: '明辯', era: '현대(가상)', faction: '시간 틈', rarity: 3, trait: 'wisdom', emoji: '⚖️',
      quote: '설전이라면 제 쪽이 이깁니다. 근거가 있으니까요.', stats: { might: 34, wisdom: 88, command: 56 }, body: FOLK + 'w_Suit.glb' },
    { id: 'tm_doha',     name: '도하', hanja: '道河', era: '현대(가상)', faction: '시간 틈', rarity: 3, trait: 'wisdom', emoji: '💻',
      quote: '봉화보다 빠른 소식길을 알고 있어요.', stats: { might: 46, wisdom: 82, command: 50 }, body: FOLK + 'm_Hoodie.glb' },
    { id: 'tm_seongyeon', name: '성연', hanja: '星緣', era: '미래(가상)', faction: '시간 틈', rarity: 4, trait: 'virtue', emoji: '🧭',
      quote: '별자리가 이 시대 것과 조금 달라요. 그래도 길은 찾습니다.', stats: { might: 50, wisdom: 86, command: 76 }, body: FOLK + 'w_SciFi.glb' },
    { id: 'tm_gwedo',    name: '궤도', hanja: '軌道', era: '미래(가상)', faction: '시간 틈', rarity: 4, trait: 'virtue', emoji: '🧑‍🚀',
      quote: '대원들은 제가 데려갑니다. 한 명도 두고 가지 않아요.', stats: { might: 66, wisdom: 70, command: 84 }, body: FOLK + 's_Astronaut1.glb' },
    { id: 'tm_eunha',    name: '은하', hanja: '銀河', era: '미래(가상)', faction: '시간 틈', rarity: 3, trait: 'might', emoji: '🚀',
      quote: '여기 중력은 가볍네요. 창도 가볍게 들립니다.', stats: { might: 76, wisdom: 58, command: 68 }, body: FOLK + 's_Astronaut2.glb' },
    { id: 'tm_yeongjeom', name: '영점', hanja: '零點', era: '미래(가상)', faction: '시간 틈', rarity: 4, trait: 'might', emoji: '🦾',
      quote: '의체 출력 백 퍼센트. 일기토, 받아 드리죠.', stats: { might: 88, wisdom: 50, command: 62 }, body: FOLK + 'f_Cyber.glb' }
  ];

  /** 성 id → 그 성의 수비 무장 id 목록 (rtk.js seedNeutral() 이 쓴다) */
  var SILK_GARRISON = {
    wusun: ['sl_cheonsan', 'sl_hwachin'],
    kangju: ['sl_nakta', 'sl_hosang'],
    yancai: ['sl_daetaek'],
    jianshi: ['sl_wangjeong'],
    xiumi: ['sl_heupu'],
    guishuang: ['sl_geumhwa', 'sl_josang']
  };

  /* ── 시나리오 ───────────────────────────────────────────
   * 표를 하나 더 두면 시나리오가 하나 는다. 그 밖에 고칠 곳이 없다.
   *
   *   lord     군주 무장 id
   *   cities   시작 시 가진 도시
   *   officers 군주를 뺀 소속 무장 (data.js 인물도 섞인다)
   *   color    지도에 칠하는 색
   *   creed    AI 성향 — 'aggressive' 치고 나간다 | 'balanced' | 'turtle' 지킨다
   *
   * **어느 표에도 안 적힌 무장은 저절로 재야가 된다**(rtk.scatterFree).
   * 그래서 200년 표에 여포·이각을 안 적으면 그들은 재야로 흩어진다 —
   * 죽은 사람을 지우는 대신 판에 남겨 두는 것이 이 판의 결이다.
   *
   * **성 서른 곳이 하나도 빠짐없이, 겹치지 않게** 나뉘어야 한다.
   * 진단이 그걸 시나리오마다 센다(빠뜨리면 주인 없는 성이 생겨 아무도 못 친다).
   */

  var FORCES_194 = [
    { id: 'cao', name: '패헌', color: '#5b8ff0', creed: 'aggressive',
      lord: 'sg_caocao', cities: ['chenliu', 'puyang', 'xuchang'],
      officers: ['sg_xiahoudun', 'sg_xunyu', 'rf_xiahouyuan', 'rf_caoren', 'rf_caohong',
                 'rf_dianwei', 'rf_xuchu', 'rf_yujin', 'rf_yuejin', 'rf_lidian',
                 'rf_chengyu', 'rf_guojia'] },
    { id: 'shao', name: '고문', color: '#c9a227', creed: 'balanced',
      lord: 'rf_yuanshao', cities: ['ye', 'nanpi', 'jinyang'],
      officers: ['rf_yanliang', 'rf_wenchou', 'rf_jushou', 'rf_tianfeng',
                 'rf_shenpei', 'rf_zhanghe', 'rf_gaolan'] },
    { id: 'zan', name: '은기', color: '#d8dee9', creed: 'aggressive',
      lord: 'rf_gongsunzan', cities: ['jixian', 'beiping'],
      officers: ['sg_zhaoyun', 'rf_yangang'] },
    { id: 'rong', name: '빈헌', color: '#8fbf8f', creed: 'turtle',
      lord: 'rf_kongrong', cities: ['beihai'],
      officers: ['sg_taishici', 'rf_wuanguo'] },
    { id: 'bei', name: '인형', color: '#4caf72', creed: 'balanced',
      lord: 'sg_liubei', cities: ['xiaopei'],
      officers: ['sg_guanyu', 'sg_zhangfei', 'rf_mizhu', 'rf_jianyong'] },
    { id: 'bu', name: '패창', color: '#b0524a', creed: 'aggressive',
      lord: 'sg_lubu', cities: ['xiapi'],
      officers: ['sg_zhangliao', 'sg_diaochan', 'rf_chengong', 'rf_gaoshun'] },
    { id: 'shu', name: '옥형', color: '#c98a3c', creed: 'aggressive',
      lord: 'rf_yuanshu', cities: ['shouchun', 'runan'],
      officers: ['rf_jiling', 'rf_yanghong'] },
    { id: 'ce', name: '강룡', color: '#e05c5c', creed: 'aggressive',
      lord: 'rf_sunce', cities: ['jianye', 'chaisang', 'kuaiji'],
      officers: ['sg_sunquan', 'sg_zhouyu', 'rf_chengpu', 'rf_huanggai',
                 'rf_handang', 'rf_zhoutai'] },
    { id: 'biao', name: '형수', color: '#7fb8d8', creed: 'turtle',
      lord: 'rf_liubiao', cities: ['xiangyang', 'xinye', 'jiangling', 'jiangxia', 'changsha', 'wan'],
      officers: ['sg_huangzhong', 'sg_ganning', 'rf_caimao', 'rf_kuailiang',
                 'rf_huangzu', 'rf_wenpin'] },
    { id: 'jue', name: '철혼', color: '#9a6b9a', creed: 'balanced',
      lord: 'rf_lijue', cities: ['luoyang', 'changan'],
      officers: ['rf_guosi', 'rf_zhangji', 'rf_jiaxu'] },
    { id: 'teng', name: '노기', color: '#c07b4a', creed: 'balanced',
      lord: 'rf_mateng', cities: ['tianshui', 'wuwei'],
      officers: ['sg_machao', 'rf_pangde', 'rf_hansui'] },
    { id: 'lu', name: '선치', color: '#a8a2c8', creed: 'turtle',
      lord: 'rf_zhanglu', cities: ['hanzhong'],
      officers: ['rf_yangren', 'rf_yangsong'] },
    { id: 'zhang', name: '인목', color: '#7ac0a8', creed: 'turtle',
      lord: 'rf_liuzhang', cities: ['chengdu', 'jiangzhou', 'yongan'],
      officers: ['rf_zhangren', 'rf_yanyan', 'rf_fazheng', 'rf_wuyi'] }
  ];

  /* ── 200년 관도(官渡) ────────────────────────────────────
   * 군웅이 정리되고 하북(원소)과 중원(조조)이 마주 선다.
   * 여포·원술·공손찬·공융·이각은 이미 없다 — 그 사람들은 재야로 흩어진다.
   */
  var FORCES_200 = [
    { id: 'shao', name: '고문', color: '#c9a227', creed: 'aggressive',
      lord: 'rf_yuanshao', cities: ['ye', 'nanpi', 'jixian', 'beiping', 'jinyang', 'beihai'],
      officers: ['rf_yanliang', 'rf_wenchou', 'rf_jushou', 'rf_tianfeng',
                 'rf_shenpei', 'rf_zhanghe', 'rf_gaolan'] },
    { id: 'cao', name: '패헌', color: '#5b8ff0', creed: 'aggressive',
      lord: 'sg_caocao',
      cities: ['xuchang', 'chenliu', 'puyang', 'luoyang', 'changan',
               'xiaopei', 'xiapi', 'shouchun'],
      officers: ['sg_xiahoudun', 'sg_xunyu', 'sg_zhangliao', 'rf_xiahouyuan', 'rf_caoren',
                 'rf_caohong', 'rf_xuchu', 'rf_yujin', 'rf_yuejin', 'rf_lidian',
                 'rf_chengyu', 'rf_guojia', 'rf_jiaxu'] },
    { id: 'bei', name: '인형', color: '#4caf72', creed: 'balanced',
      lord: 'sg_liubei', cities: ['runan'],
      officers: ['sg_guanyu', 'sg_zhangfei', 'sg_zhaoyun', 'rf_mizhu', 'rf_jianyong'] },
    { id: 'quan', name: '벽해', color: '#e05c5c', creed: 'balanced',
      lord: 'sg_sunquan', cities: ['jianye', 'chaisang', 'kuaiji'],
      officers: ['sg_zhouyu', 'sg_taishici', 'rf_chengpu', 'rf_huanggai',
                 'rf_handang', 'rf_zhoutai'] },
    { id: 'biao', name: '형수', color: '#7fb8d8', creed: 'turtle',
      lord: 'rf_liubiao',
      cities: ['xiangyang', 'wan', 'xinye', 'jiangling', 'jiangxia', 'changsha'],
      officers: ['sg_huangzhong', 'sg_ganning', 'rf_caimao', 'rf_kuailiang',
                 'rf_huangzu', 'rf_wenpin'] },
    { id: 'teng', name: '노기', color: '#c07b4a', creed: 'balanced',
      lord: 'rf_mateng', cities: ['tianshui', 'wuwei'],
      officers: ['sg_machao', 'rf_pangde', 'rf_hansui'] },
    { id: 'lu', name: '선치', color: '#a8a2c8', creed: 'turtle',
      lord: 'rf_zhanglu', cities: ['hanzhong'],
      officers: ['rf_yangren', 'rf_yangsong'] },
    /* 유비(초록)와 색이 붙어 지도에서 헷갈렸다 — 이각이 없는 판이니 그 보라를 쓴다 */
    { id: 'zhang', name: '인목', color: '#9a6b9a', creed: 'turtle',
      lord: 'rf_liuzhang', cities: ['chengdu', 'jiangzhou', 'yongan'],
      officers: ['rf_zhangren', 'rf_yanyan', 'rf_fazheng', 'rf_wuyi'] }
  ];

  /* ── 208년 적벽(赤壁) ────────────────────────────────────
   * 조조가 스물 가까운 성을 쥐고 강을 내려온다. **아주 기울어진 판이다** —
   * 조조를 잡으면 마무리, 손권이나 유비를 잡으면 이 판에서 가장 어려운 싸움이다.
   * 손권과 유비는 **동맹으로 시작한다**(SCENARIOS 의 pacts). 그것 없이는 적벽이 아니다.
   */
  var FORCES_208 = [
    { id: 'cao', name: '패헌', color: '#5b8ff0', creed: 'aggressive',
      lord: 'sg_caocao',
      cities: ['xuchang', 'chenliu', 'puyang', 'luoyang', 'changan', 'runan',
               'xiaopei', 'xiapi', 'shouchun', 'ye', 'nanpi', 'jixian', 'beiping',
               'jinyang', 'beihai', 'wan', 'xinye', 'xiangyang', 'jiangling'],
      officers: ['sg_xiahoudun', 'sg_xunyu', 'sg_zhangliao', 'sg_simayi',
                 'rf_xiahouyuan', 'rf_caoren', 'rf_caohong', 'rf_xuchu', 'rf_yujin',
                 'rf_yuejin', 'rf_lidian', 'rf_chengyu', 'rf_jiaxu', 'rf_zhanghe',
                 'rf_caimao', 'rf_wenpin', 'rf_kuailiang'] },
    { id: 'quan', name: '벽해', color: '#e05c5c', creed: 'balanced',
      lord: 'sg_sunquan', cities: ['jianye', 'chaisang', 'kuaiji'],
      officers: ['sg_zhouyu', 'sg_luxun', 'sg_ganning', 'sg_taishici', 'rf_chengpu',
                 'rf_huanggai', 'rf_handang', 'rf_zhoutai'] },
    { id: 'bei', name: '인형', color: '#4caf72', creed: 'balanced',
      lord: 'sg_liubei', cities: ['jiangxia', 'changsha'],
      officers: ['sg_guanyu', 'sg_zhangfei', 'sg_zhaoyun', 'sg_zhugeliang',
                 'sg_huangzhong', 'rf_mizhu', 'rf_jianyong'] },
    { id: 'chao', name: '서풍', color: '#c07b4a', creed: 'aggressive',
      lord: 'sg_machao', cities: ['tianshui', 'wuwei'],
      officers: ['rf_pangde', 'rf_hansui', 'rf_mateng'] },
    { id: 'lu', name: '선치', color: '#a8a2c8', creed: 'turtle',
      lord: 'rf_zhanglu', cities: ['hanzhong'],
      officers: ['rf_yangren', 'rf_yangsong'] },
    { id: 'zhang', name: '인목', color: '#9a6b9a', creed: 'turtle',
      lord: 'rf_liuzhang', cities: ['chengdu', 'jiangzhou', 'yongan'],
      officers: ['rf_zhangren', 'rf_yanyan', 'rf_fazheng', 'rf_wuyi', 'sg_pangtong'] }
  ];

  /* ── 시나리오 ④⑤ — 중국 밖에서 시작한다 (PLAN §5-4) ─────────────
   * 194년 표에 **깃발 하나를 더 꽂는다.** 중국 열세 세력은 그대로라 판이 얼지도
   * 쏠리지도 않고, 새 깃발만 확장 지역의 성에서 출발한다.
   *
   *   start     이 시나리오에서 **고를 수 있는** 깃발(나머지는 AI 몫)
   *   troops    시작 성의 병력 — 숫자면 그 값, 'garrison' 이면 `data-city.js` 수비병 그대로.
   *             없으면 다른 세력과 같다(3000 + 인구/90). 확장 지역 성은 원래 수비병이 있어서
   *             `rtk.seedNeutral()` 이 이 세력의 성은 건드리지 않는다.
   *   alien     이 era 가 아닌 무장은 "이질" — 등용해도 충성이 10 낮게 끌린다(`officer.baseLoyal`)
   */
  var FORCES_BLANK = FORCES_194.concat([
    { id: 'gwan', name: '관북', color: '#6fb7b0', creed: 'balanced', start: true,
      lord: 'kr2_pasodan', cities: ['yangping'], troops: 8000,
      officers: ['kr2_yeoyul', 'kr2_gokdol'] }
  ]);

  var FORCES_RIFT = FORCES_194.concat([
    { id: 'gyun', name: '균왕', color: '#b070e0', creed: 'aggressive', start: true,
      alien: '균열(가상)', troops: 'garrison',
      lord: 'fu_jongwang',
      cities: ['jongmal', 'cheongwe', 'noeseong', 'gangcheol', 'yuri', 'hwanyeong', 'janyeong'],
      officers: ['fu_myeongje', 'fu_seonghon', 'fu_yuseong', 'fu_noejang', 'fu_gangma',
                 'fu_yugwi', 'fu_hwanryeong', 'fu_janhon'] }
  ]);

  /* ── 시나리오 ⑦⑧⑨ — 폐허·묘역, 그리고 셋이 한꺼번에 (PLAN §5-9, 2026-09-24) ─────
   * 균열의 왕(⑤)과 같은 결: 194년 표에 이계 깃발을 꽂는다. 이계 무장은 era 가 달라
   * 사람을 거둬도 이질(alien)이라 충성이 낮게 끌린다. 폐허·묘역은 생존 승리를 겨룬다.
   * 셋째(삼계 균열)는 이계 셋이 다 선다 — 폐왕·명계는 죽음을 나눈 사이라 동맹으로 시작한다.
   */
  var PYE = { id: 'pye', name: '폐왕', color: '#8fa05a', creed: 'aggressive', start: true,
    alien: '폐허(가상)', troops: 'garrison', lord: 'ru_geohae',
    cities: ['pyedo', 'janjae', 'oyeom', 'hoegok', 'chimmuk', 'yeokbyeong', 'janhyang'],
    officers: ['ru_busaeng', 'ru_gogol', 'ru_mangdok', 'ru_sanaek', 'ru_sayeong', 'ru_seogun', 'ru_wadok', 'ru_doksi'] };
  var MYO = { id: 'myo', name: '명계', color: '#8a96b8', creed: 'turtle', start: true,
    alien: '묘역(가상)', troops: 'garrison', lord: 'tb_baekgi',
    cities: ['myomun', 'baekgol', 'chimgwan', 'honro', 'jinhon', 'yugol', 'simyeon'],
    officers: ['tb_ganghae', 'tb_gojeon', 'tb_amseup', 'tb_jamhon', 'tb_saryeong', 'tb_heukju', 'tb_japgol', 'tb_jongja'] };
  var FORCES_RUIN = FORCES_194.concat([PYE]);
  var FORCES_TOMB = FORCES_194.concat([MYO]);
  var FORCES_TRIAD = FORCES_RIFT.concat([PYE, MYO]);

  var SCENARIOS = [
    { id: '194', year: 194, name: '군웅할거', hanja: '群雄割據', stars: 1,
      desc: '열세 깃발이 한꺼번에 섰다. 누구를 잡아도 갈 길이 멀다.',
      forces: FORCES_194, pacts: [] },
    { id: '200', year: 200, name: '관도', hanja: '官渡', stars: 2,
      desc: '하북의 고문과 중원의 패헌이 마주 섰다. 패창도 옥형도 이미 없다.',
      forces: FORCES_200, pacts: [] },
    { id: '208', year: 208, name: '적벽', hanja: '赤壁', stars: 3,
      desc: '패헌이 스물 가까운 성을 쥐고 강을 내려온다. 벽해와 인형은 손을 잡았다.',
      forces: FORCES_208, pacts: [['quan', 'bei', 'ally', 24]] },
    { id: 'blank', year: 194, name: '백지', hanja: '白地', stars: 3,
      desc: '요동의 관문 하나, 무장 셋, 병 팔천. 중원은 열세 깃발이 싸우는 그대로다.',
      forces: FORCES_BLANK, pacts: [], playable: ['gwan'] },
    { id: 'rift', year: 194, name: '균열의 왕', hanja: '龜裂之王', stars: 3,
      desc: '바다 너머 균열의 일곱 성과 괴물 아홉. 사람을 거두려 해도 이질이라 마음이 안 붙는다.',
      forces: FORCES_RIFT, pacts: [], playable: ['gyun'], survival: true },
    { id: 'ruin', year: 194, name: '폐허의 역병', hanja: '廢墟疫病', stars: 3,
      desc: '무너진 문명의 일곱 성, 되살아난 주검과 오염된 짐승 아홉. 잿빛 안개를 몰고 산 자의 땅으로 내려간다.',
      forces: FORCES_RUIN, pacts: [], playable: ['pye'], survival: true },
    { id: 'tomb', year: 194, name: '묘역의 진혼', hanja: '墓域鎭魂', stars: 3,
      desc: '땅 밑 무덤의 일곱 성, 백골 병사 아홉. 성문은 굳고 맹세는 오래간다 — 버티며 천하를 기다린다.',
      forces: FORCES_TOMB, pacts: [], playable: ['myo'], survival: true },
    { id: 'triad', year: 194, name: '삼계 균열', hanja: '三界龜裂', stars: 4,
      desc: '균열·폐허·묘역이 한꺼번에 열렸다. 열세 깃발과 이계 셋 — 사람으로도, 이계로도 잡을 수 있다.',
      forces: FORCES_TRIAD, pacts: [['pye', 'myo', 'ally', 24]] },
    { id: 'chaos', year: 194, name: '군웅 무작위', hanja: '群雄亂數', stars: 2,
      desc: '같은 열세 깃발, 다른 지도. 성 배치를 주사위가 섞는다 — 판마다 처음 보는 천하다.',
      forces: FORCES_194, pacts: [], shuffle: true }
  ];

  function scenario(id) {
    for (var s = 0; s < SCENARIOS.length; s++) {
      if (SCENARIOS[s].id === id) { return SCENARIOS[s]; }
    }
    return SCENARIOS[0];
  }

  /**
   * 지금 쓰는 시나리오.
   * `FORCES` 는 **배열 그대로 갈아 끼운다**(새 배열로 바꾸지 않는다) —
   * 다른 파일이 `FD.FORCES` 를 이미 붙들고 있어서, 참조를 바꾸면 그쪽이 옛 표를 본다.
   */
  var FORCES = [];
  var current = null;

  var curSeed = 0;

  /** mulberry32 — 같은 씨앗이면 같은 수열. 시나리오 ⑥ 의 성 섞기 전용(공유 난수를 안 민다) */
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * ⑥ 군웅 무작위 — **표는 그대로, 성만 섞는다.** 세력마다 가진 성의 수(와 군주·무장)는
   * 194년 표와 같고, 서른 성을 씨앗으로 섞어 그 수만큼 나눠 준다. 세력의 첫 성이
   * 본거지(군주가 앉는 자리)라 본거지도 함께 바뀐다.
   */
  function shuffledForces(list, seed) {
    var pool = [], i, j, k;
    for (i = 0; i < list.length; i++) {
      for (j = 0; j < list[i].cities.length; j++) { pool.push(list[i].cities[j]); }
    }
    var rnd = mulberry(seed);
    for (i = pool.length - 1; i > 0; i--) {
      j = Math.floor(rnd() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var out = [], at = 0;
    for (i = 0; i < list.length; i++) {
      var nf = {};
      for (k in list[i]) { if (Object.prototype.hasOwnProperty.call(list[i], k)) { nf[k] = list[i][k]; } }
      nf.cities = pool.slice(at, at + list[i].cities.length);
      at += list[i].cities.length;
      out.push(nf);
    }
    return out;
  }

  /**
   * @param seed  섞는 시나리오(`shuffle:true`)만 쓴다. 세이브에 적어 두고 다시 세울 때 그대로 넣는다.
   */
  function use(id, seed) {
    var sc = scenario(id);
    current = sc;
    curSeed = (seed >>> 0) || 0;
    var list = sc.shuffle ? shuffledForces(sc.forces, curSeed) : sc.forces;
    FORCES.length = 0;
    for (var s = 0; s < list.length; s++) { FORCES.push(list[s]); }
    forceById = {};
    for (s = 0; s < FORCES.length; s++) { forceById[FORCES[s].id] = FORCES[s]; }
    return sc;
  }

  /* ── 수전(水戰)에 능한 사람 ─────────────────────────────
   * 이 판의 자질은 무력·지력·통솔 셋뿐이다 — `data.js` 의 인물과 **모양이 같아야**
   * 도감·초상·능력치가 그대로 돌기 때문이다. 그래서 "물에서 더 잘 싸운다" 는
   * 넷째 자질을 만드는 대신 **이 파일의 목록**으로 둔다.
   * 다섯 판이 나눠 가진 `data.js` 를 한 줄도 건드리지 않고 적벽이 선다.
   *
   * 값은 수전에서 부대 힘에 곱하는 배수다. 부대에서 **가장 나은 한 사람**만 센다.
   */
  var NAVY = {
    kr_yisunsin: 1.40,      // 재야에서 온 수군 — "아직 신에게는 열두 척이 남아 있사옵니다"
    sg_zhouyu:   1.35,      // 적벽
    rf_huanggai: 1.30,      // 이 늙은 몸을 태워서라도
    sg_ganning:  1.30,
    rf_caimao:   1.30,      // 수군은 형주의 자랑입니다
    rf_handang:  1.25,      // 배 위에서라면 지지 않소
    rf_chengpu:  1.25,
    sg_luxun:    1.25,
    rf_zhoutai:  1.20,
    sg_taishici: 1.20,
    rf_huangzu:  1.15,      // 강하는 내가 지킨다
    sg_sunquan:  1.15,
    rf_sunce:    1.15
  };

  /** 수전 배수 — 물에서만 쓴다 (뭍에서는 언제나 1) */
  function navyOf(id) { return NAVY[id] || 1; }

  var byId = {}, i;
  for (i = 0; i < OFFICERS.length; i++) { byId[OFFICERS[i].id] = OFFICERS[i]; }

  var forceById = {};
  use('194');                       // 기본은 194년 군웅할거

  /** 이 세력의 무장 전부 (군주 포함) */
  function roster(forceId) {
    var f = forceById[forceId];
    if (!f) { return []; }
    return [f.lord].concat(f.officers);
  }

  /* ── 이정표(MILESTONES) — PLAN §5-4 ───────────────────────
   * 시나리오마다 다섯 단. 이정표는 **조건 + 보상**이 든 표일 뿐 판정은 `rtk.checkMilestones()`
   * 한 곳이다(표를 하나 더 두면 시나리오가 하나 는다).
   *
   * 조건 `cond` (`rtk.condProgress`)
   *   { c:'cities', n }            내 성이 n 곳 이상
   *   { c:'core',   n }            중국 30성(`garrison` 없는 성) 중 n 곳 이상
   *   { c:'prov',   prov, all }    그 지역 성을 전부 / { any:true } 하나라도
   *   { c:'city',   id }           그 성을 쥔다
   *   { c:'rank',   n, min }       세력 순위가 n 위 안이고 성이 min 곳 이상
   * 보상: gold(500~2000)·reveal(재야 몇 명이 드러난다)·relic(보물 하나)
   *
   * 중국 판 셋과 ⑥ 은 **사다리**다 — 시작 성 수가 세력마다 3배씩 달라서 절대 성 수로 못 박으면
   * 큰 세력은 시작하자마자 다 깨고 작은 세력은 끝이 안 보인다. 남은 성(30 − 시작)의 몫으로 잡는다.
   */
  var CORE_TOTAL = 30;

  var LADDER = [
    { name: '첫 발걸음',     frac: 0.10, gold: 500 },
    { name: '뿌리내림',       frac: 0.25, gold: 800,  reveal: 1 },
    { name: '군웅의 한 축',   frac: 0.45, gold: 1200 },
    { name: '천하의 태반',    frac: 0.70, gold: 1600, reveal: 1 },
    { name: '중원 평정',      frac: 1.00, gold: 2000, relic: true }
  ];

  var MILESTONES_FIXED = {
    blank: [
      { name: '세 성',        desc: '성 세 곳을 쥔다',                     cond: { c: 'cities', n: 3 },  gold: 500 },
      { name: '반도 평정',    desc: '한국 지역 일곱 성을 모두 쥔다',       cond: { c: 'prov', prov: 'kr', all: true }, gold: 800, reveal: 1 },
      { name: '관문 밖으로',  desc: '중국 땅의 성 하나를 빼앗는다',        cond: { c: 'core', n: 1 },    gold: 1000 },
      { name: '열 성의 깃발', desc: '성 열 곳을 쥔다',                     cond: { c: 'cities', n: 10 }, gold: 1500, reveal: 1 },
      { name: '천하의 다섯째', desc: '성 열 곳 이상으로 세력 5위 안에 든다', cond: { c: 'rank', n: 5, min: 10 }, gold: 2000, relic: true }
    ],
    rift: [
      { name: '균열 너머',    desc: '야마토를 함락해 일본 땅에 발을 디딘다', cond: { c: 'city', id: 'yamato' }, gold: 600 },
      { name: '열도 평정',    desc: '일본 지역 일곱 성을 모두 쥔다',       cond: { c: 'prov', prov: 'jp', all: true }, gold: 900, reveal: 1 },
      { name: '반도 상륙',    desc: '한국 지역의 성 하나를 빼앗는다',      cond: { c: 'prov', prov: 'kr', any: true }, gold: 1200 },
      { name: '중원 진입',    desc: '중국 땅의 성 하나를 빼앗는다',        cond: { c: 'core', n: 1 },    gold: 1600, reveal: 1 },
      { name: '균열의 왕좌',  desc: '성 열다섯 곳 이상으로 세력 3위 안에 든다', cond: { c: 'rank', n: 3, min: 15 }, gold: 2000, relic: true }
    ],
    /* ⑦⑧(§5-9) — 이계 땅을 거쳐 산 자의 땅으로 내려가는 사다리 */
    ruin: [
      { name: '폐허 너머',    desc: '균열 지역의 성 하나를 빼앗는다',      cond: { c: 'prov', prov: 'fu', any: true }, gold: 600 },
      { name: '균열 평정',    desc: '균열 일곱 성을 모두 쥔다',            cond: { c: 'prov', prov: 'fu', all: true }, gold: 900, reveal: 1 },
      { name: '열도 상륙',    desc: '일본 지역의 성 하나를 빼앗는다',      cond: { c: 'prov', prov: 'jp', any: true }, gold: 1200 },
      { name: '중원 진입',    desc: '중국 땅의 성 하나를 빼앗는다',        cond: { c: 'core', n: 1 },    gold: 1600, reveal: 1 },
      { name: '역병의 왕좌',  desc: '성 열다섯 곳 이상으로 세력 3위 안에 든다', cond: { c: 'rank', n: 3, min: 15 }, gold: 2000, relic: true }
    ],
    tomb: [
      { name: '땅 위로',      desc: '폐허 지역의 성 하나를 빼앗는다',      cond: { c: 'prov', prov: 'pf', any: true }, gold: 600 },
      { name: '폐허 평정',    desc: '폐허 일곱 성을 모두 쥔다',            cond: { c: 'prov', prov: 'pf', all: true }, gold: 900, reveal: 1 },
      { name: '균열 너머',    desc: '균열 지역의 성 하나를 빼앗는다',      cond: { c: 'prov', prov: 'fu', any: true }, gold: 1200 },
      { name: '산 자의 땅',   desc: '일본 지역의 성 하나를 빼앗는다',      cond: { c: 'prov', prov: 'jp', any: true }, gold: 1600, reveal: 1 },
      { name: '진혼의 왕좌',  desc: '성 열다섯 곳 이상으로 세력 3위 안에 든다', cond: { c: 'rank', n: 3, min: 15 }, gold: 2000, relic: true }
    ]
  };

  /**
   * 이 시나리오의 이정표 다섯 단(조건이 풀려 있는 표). 사다리는 시작 시점의 중국 성 수(`baseCore`)로 푼다.
   * 항상 새 배열을 준다 — 호출한 쪽이 고쳐도 표가 안 상한다.
   */
  function milestonesFor(scenId, baseCore) {
    var fixed = MILESTONES_FIXED[scenId], out = [], i;
    if (fixed) {
      for (i = 0; i < fixed.length; i++) { out.push(JSON.parse(JSON.stringify(fixed[i]))); }
      return out;
    }
    var base = Math.max(0, Math.min(CORE_TOTAL - 1, baseCore || 0));
    var rest = CORE_TOTAL - base, prev = base;
    for (i = 0; i < LADDER.length; i++) {
      var need = Math.min(CORE_TOTAL, Math.max(prev + 1, base + Math.ceil(rest * LADDER[i].frac)));
      var m = { name: LADDER[i].name, cond: { c: 'core', n: need }, gold: LADDER[i].gold };
      m.desc = i === LADDER.length - 1 ? '중국 서른 성을 모두 쥔다' : '중국 땅의 성 ' + need + '곳을 쥔다';
      if (LADDER[i].reveal) { m.reveal = LADDER[i].reveal; }
      if (LADDER[i].relic) { m.relic = true; }
      out.push(m);
      prev = need;
    }
    return out;
  }

  global.DG = global.DG || {};
  global.DG.forceData = {
    OFFICERS: OFFICERS, FORCES: FORCES, NAVY: NAVY, navyOf: navyOf,
    CORE_TOTAL: CORE_TOTAL, milestonesFor: milestonesFor, seed: function () { return curSeed; },
    BLANK_OFFICERS: BLANK_OFFICERS,
    KOREA_OFFICERS: KOREA_OFFICERS, KOREA_GARRISON: KOREA_GARRISON,
    JAPAN_OFFICERS: JAPAN_OFFICERS, JAPAN_GARRISON: JAPAN_GARRISON,
    JIAOZHOU_OFFICERS: JIAOZHOU_OFFICERS, JIAOZHOU_GARRISON: JIAOZHOU_GARRISON,
    XIYU_OFFICERS: XIYU_OFFICERS, XIYU_GARRISON: XIYU_GARRISON,
    NANZHONG_OFFICERS: NANZHONG_OFFICERS, NANZHONG_GARRISON: NANZHONG_GARRISON,
    TIANZHU_OFFICERS: TIANZHU_OFFICERS, TIANZHU_GARRISON: TIANZHU_GARRISON,
    MOBEI_OFFICERS: MOBEI_OFFICERS, MOBEI_GARRISON: MOBEI_GARRISON,
    LINYI_OFFICERS: LINYI_OFFICERS, LINYI_GARRISON: LINYI_GARRISON,
    FUTURE_OFFICERS: FUTURE_OFFICERS, FUTURE_GARRISON: FUTURE_GARRISON,
    RUIN_OFFICERS: RUIN_OFFICERS, RUIN_GARRISON: RUIN_GARRISON,
    TOMB_OFFICERS: TOMB_OFFICERS, TOMB_GARRISON: TOMB_GARRISON,
    DAQIN_OFFICERS: DAQIN_OFFICERS, DAQIN_GARRISON: DAQIN_GARRISON,
    XIANBEI_OFFICERS: XIANBEI_OFFICERS, XIANBEI_GARRISON: XIANBEI_GARRISON,
    NANHAI_OFFICERS: NANHAI_OFFICERS, NANHAI_GARRISON: NANHAI_GARRISON,
    SILK_OFFICERS: SILK_OFFICERS, SILK_GARRISON: SILK_GARRISON,
    TIME_OFFICERS: TIME_OFFICERS,
    SCENARIOS: SCENARIOS, scenario: scenario, use: use,
    current: function () { return current; },
    find: function (id) { return byId[id] || null; },
    force: function (id) { return forceById[id] || null; },
    roster: roster
  };
})(window);
