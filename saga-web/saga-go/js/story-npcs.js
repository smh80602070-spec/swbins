/**
 * 1만리 이야기 인물 표(NPCS)·이야기 동료 표(MEMBERS·MEMBER_TIME)·이름 붙은 자리(SPOTS). story.js 에서 떼어 냄(R-4).
 * ---------------------------------------------------------------
 * 순수 데이터 — NPCS 는 자리 상수 열둘(AMBER_THIEF_PATH·BANDI_CAVE·BAWOO_GATE·BAWOO_LAKE·CAPTAIN_PATH·DAREUM_SHIP·HARAM_FORT·HARAM_OBS·HARAM_SHIP·SEED_DRONE_PATH·THIEF_PATH·VAULT_DRONE_PATH)을 story.js 가 build(P) 로 넘긴다.
 * 세계 임무 인물 합치기·NPC_KEYS·hookFind 는 story.js 에 그대로. 꼴은 story.js 머리 주석.
 */
(function (global) {
  'use strict';

  function build(P) {
    var AMBER_THIEF_PATH = P.AMBER_THIEF_PATH, BANDI_CAVE = P.BANDI_CAVE, BAWOO_GATE = P.BAWOO_GATE, BAWOO_LAKE = P.BAWOO_LAKE, CAPTAIN_PATH = P.CAPTAIN_PATH, DAREUM_SHIP = P.DAREUM_SHIP, HARAM_FORT = P.HARAM_FORT, HARAM_OBS = P.HARAM_OBS, HARAM_SHIP = P.HARAM_SHIP, SEED_DRONE_PATH = P.SEED_DRONE_PATH, THIEF_PATH = P.THIEF_PATH, VAULT_DRONE_PATH = P.VAULT_DRONE_PATH;
    /* 인물 — zone 은 ⑮ 땅 key(고향은 'home'), off 는 그 땅 탑에서 떨어진 자리(m).
       at 칸 [{ch(0부터), from, to, spot, off}] 이면 그 장 그 단계 동안 그 자리에 선다(⑲-14). ⑲-42 chTo 가 있으면 ch~chTo 장 모두(끝난 뒤 계속 설 자리).
       appear 가 있으면 그 칸에만 선다(나그네 — 4장은 따라가는 길, 칸에 spot 이 없다) */
    var NPCS = {
      elder:    { id: 'story_elder',    name: '청하 촌장 누리', short: '누리', zone: 'home',    off: [-22, 16],  color: '#6b7f61', idle: '먹구름이 걷히면 마을 잔치를 열어야지.' },
      ferryman: { id: 'story_ferryman', name: '늙은 사공 버들', short: '버들', zone: 'galdae',  off: [-18, -24], color: '#4d6688', idle: '물 냄새가 요즘 영 비릿해.',
        at: [{ ch: 6, from: 8, to: 8, spot: 'cape', off: [-6, 6] }, { ch: 7, from: 5, to: 10, spot: 'isle', off: [-4, 18] },
          { ch: 27, from: 1, to: 3, spot: 'cape', off: [-6, 6] }, { ch: 27, from: 4, to: 9, spot: 'isle', off: [-4, 18] }] },   // ⑲-54 28장 곶 지키기 → 바위섬
      scholar:  { id: 'story_scholar',  name: '떠돌이 학자 은비', short: '은비', zone: 'gojeong', off: [-18, -24], color: '#8c6b99', idle: '이 비문, 읽을수록 이상하다니까.',
        at: [{ ch: 4, from: 0, to: 3, spot: 'road' }, { ch: 4, from: 4, to: 7, spot: 'altar2', off: [-5, 7] }, { ch: 5, from: 6, to: 6, spot: 'peak', off: [-5, 6] }] },
      wanderer: { id: 'story_wanderer', name: '가면 쓴 나그네', short: '나그네', zone: 'home',  off: [8, 70],    color: '#38384a', idle: '……',
        mask: true, appear: [{ ch: 3, from: 1, to: 5 }, { ch: 4, from: 6, to: 6, spot: 'altar2', off: [7, 5] }, { ch: 5, from: 2, to: 4, spot: 'peak', off: [5, 5] },
          { ch: 6, from: 3, to: 6, spot: 'cape', off: [6, 6] }, { ch: 7, from: 6, to: 9, spot: 'isle', off: [7, 8] },
          { ch: 8, from: 2, to: 2, spot: 'peak', off: [5, 5] }, { ch: 8, from: 3, to: 9, spot: 'sky', off: [5, 6], sky: true },
          { ch: 26, from: 5, to: 5, spot: 'altar2', off: [7, 5] },                                                // ⑲-53 27장 둘째 매듭 곁
          { ch: 27, from: 9, to: 9, spot: 'sky', off: [5, 6], sky: true }] },                                     // ⑲-54 28장 구름섬(먹구름 눈이 선 뒤)
      /* ⑲-19 해솔(검은 가면의 참이름, 금 간 가면) · 노 도둑(쫓기 단계에만 — 자리는 달리는 곳).
         ⑲-20 9장엔 가면을 벗은 해솔이 구름섬에 선다(칸이 mask·name·idle 을 덮는다) */
      haesol:   { id: 'story_haesol',   name: '검은 가면 해솔', short: '해솔', zone: 'galdae', off: [0, 0], color: '#26222e', idle: '……',
        mask: 'crack', appear: [{ ch: 7, from: 8, to: 8, spot: 'isle', off: [0, -9] },
          { ch: 8, from: 6, to: 9, spot: 'sky', off: [-5, 5], sky: true, mask: false, name: '해솔', idle: '……고맙다. 노래를 다시 부를 수 있을 것 같아.' },
          { ch: 26, from: 8, to: 8, spot: 'peak', off: [5, 5], mask: false, name: '해솔', idle: '……고맙다. 노래를 다시 부를 수 있을 것 같아.' },   // ⑲-53 27장 봉우리 꼭대기
          { ch: 28, from: 6, to: 6, spot: 'eye', off: [8, -6], sky: true, mask: false, name: '해솔', idle: '……고맙다. 노래를 다시 부를 수 있을 것 같아.' }] },   // ⑲-55 29장 소용돌이가 걷힌 눈
      thief:    { id: 'story_thief',    name: '노 도둑', short: '도둑', zone: 'galdae', off: [-10, -50], color: '#5a4a3a', idle: '헤헤, 못 잡지롱!',
        appear: [{ ch: 7, from: 2, to: 2 }], runPath: THIEF_PATH },
      /* ⑲-28 서리봉 고원 둘 — 자리가 ⑮ 땅 탑이 아니라 이름 붙은 자리(spot, 고원이 꺼지면 안 선다). 반디는 드론 몸(pet) */
      haram:    { id: 'story_haram',    name: '기상 관측원 하람', short: '하람', zone: 'snowfort', spot: 'fr_obs', off: HARAM_OBS, color: '#db7533',
        idle: '기압계 바늘이 또 얼었네… 사흘째 눈이 안 멎어요.',
        at: [{ ch: 9, from: 6, to: 6, spot: 'fr_ship', off: HARAM_SHIP }, { ch: 9, from: 7, to: 8, spot: 'fr_fort', off: HARAM_FORT },
          { ch: 10, from: 8, to: 8, spot: 'fr_ship', off: HARAM_SHIP }, { ch: 11, from: 6, to: 8, spot: 'fr_ship', off: HARAM_SHIP }] },
      bandi:    { id: 'story_bandi',    name: '조종 기계 반디', short: '반디', zone: 'snowfort', spot: 'fr_ship', off: [0, 12], color: '#8cd9f2', pet: 'drone',
        idle: '삐— 동력 3퍼센트. 추위 경고.', at: [{ ch: 38, from: 2, to: 2, spot: 'fr_ship', off: [0, 12] }, { ch: 39, from: 3, to: 3, spot: 'fr_ship', off: [0, 12] },   // ⑲-70 12부 — 39장 별배 곁 · 40장 나침을 살핀 뒤
          { ch: 32, from: 1, to: 1, spot: 'fr_obs', off: [HARAM_OBS[0] + 7, HARAM_OBS[1] + 3] }, { ch: 32, from: 2, to: 999, spot: 'vt_yard', off: [-14, 15] },   // ⑲-62 10부 33장
          { ch: 33, chTo: 999, from: 0, to: 999, spot: 'vt_yard', off: [-14, 15] },
          { ch: 11, from: 5, to: 5, spot: 'fr_cave', off: BANDI_CAVE }, { ch: 12, from: 6, to: 8, spot: 'yard_bandi' },
          { ch: 13, from: 9, to: 9, spot: 'obs_bandi', sky: true }, { ch: 15, from: 6, to: 8, spot: 'sp_bandi' },
          { ch: 16, from: 0, to: 6, spot: 'sp_bandi' }, { ch: 16, from: 7, to: 7, spot: 'sp_bell_bandi' }, { ch: 16, from: 8, to: 9, spot: 'sp_tp_bandi' },
          { ch: 17, from: 0, to: 0, spot: 'sp_tp_bandi' }, { ch: 17, from: 1, to: 9, spot: 'sp_st_bandi' },
          { ch: 18, from: 0, to: 1, spot: 'sp_st_bandi' }, { ch: 18, from: 2, to: 4, spot: 'cr_bandi' }, { ch: 18, from: 5, to: 5, spot: 'cr_ck_bandi' },
          { ch: 18, from: 6, to: 9, spot: 'cr_st_bandi' }, { ch: 19, from: 2, to: 10, spot: 'cr_rift_bandi', sky: true },
          { ch: 20, from: 2, to: 6, spot: 'sk_sand_bandi' }, { ch: 20, from: 7, to: 999, spot: 'sk_plinth_bandi' },
          { ch: 21, from: 0, to: 2, spot: 'sk_plinth_bandi' }, { ch: 21, from: 3, to: 6, spot: 'sk_front_bandi' }, { ch: 21, from: 7, to: 999, spot: 'sk_in_bandi' },
          { ch: 22, from: 1, to: 3, spot: 'sk_light_bandi' },                                                          // ⑲-47 23장 등대 발치
          { ch: 23, from: 0, to: 1, spot: 'sk_sand_bandi' }, { ch: 23, from: 2, to: 999, spot: 'sr_bandi', sky: true },    // ⑲-49 24장 모래밭 → 사당 섬
          { ch: 24, from: 0, to: 0, spot: 'sr_bandi', sky: true }, { ch: 24, from: 1, to: 999, spot: 'sr_wreck_bandi', sky: true },   // ⑲-50 25장 잔해 섬(뒤에도)
          { ch: 29, from: 0, to: 0, spot: 'sp_bandi' }, { ch: 29, from: 1, to: 999, spot: 'am_clock', off: [-8, 8] }, { ch: 30, chTo: 999, from: 0, to: 999, spot: 'am_clock', off: [-8, 8] },   // ⑲-58 9부
          { ch: 25, from: 1, to: 999, spot: 'sr_orbit_bandi', sky: true }, { ch: 26, chTo: 999, from: 0, to: 999, spot: 'home_bandi' },   // ⑲-51 26장 정거장 섬 → ⑲-53 8부(27장~)는 청하 촌장 동쪽
          { ch: 25, chTo: 999, from: 0, to: 999, spot: 'sr_wreck_bandi', sky: true },
          { ch: 22, chTo: 999, from: 0, to: 999, spot: 'sk_in_bandi' },
          { ch: 19, chTo: 999, from: 0, to: 999, spot: 'sp_bandi' }] },
      /* ⑲-34 조선공 다온(현대) — 늘 조선소 창고 앞 */
      daon:     { id: 'story_daon',     name: '조선공 다온', short: '다온', zone: 'galdae', spot: 'yard_daon', off: [0, 0], color: '#335ea0',
        idle: '이 조선소 문 닫은 지 십 년인데… 요즘 밤마다 쇳소리가 나요.' },
      /* ⑲-35 시간 틈 관측사 가온(미래) — 늘 관측소 남서쪽 발치 */
      gaon:     { id: 'story_gaon',     name: '시간 틈 관측사 가온', short: '가온', zone: 'gojeong', spot: 'obs_gaon', off: [0, 0], color: '#dbe0eb',
        idle: '관측대가 또 한 뼘 기울었어요. 기록만 하고 있을 순 없는데…' },
      /* ⑲-36 파발꾼 달음(과거) — 늘 역참 앞, 15장 9~11째는 고원 비행선 곁. 15장 끝에 동료(story_dareum) */
      dareum:   { id: 'story_dareum',   name: '파발꾼 달음', short: '달음', zone: 'home', spot: 'st_dareum', off: [0, 0], color: '#80573a',
        idle: '한양 가는 길이 어디였더라… 말은 잘 있나 몰라.', at: [{ ch: 14, from: 8, to: 10, spot: 'fr_ship', off: DAREUM_SHIP }] },
      /* ⑲-38 나루지기 아라(미래) — 늘 별배 나루 표지 부스 곁 */
      ara:      { id: 'story_ara',      name: '나루지기 아라', short: '아라', zone: 'solar', spot: 'sp_ara', off: [0, 0], color: '#47669e',
        idle: '별배 나루는 오늘도 비어 있어요. …기다리는 게 제 일이니까요.' },
      /* ⑲-39 종지기 한결(과거) — 늘 옛 절터 종각 남쪽, 17장 4~7째는 쓰러진 종 곁 */
      hangyeol: { id: 'story_hangyeol', name: '종지기 한결', short: '한결', zone: 'solar', spot: 'sp_hangyeol', off: [0, 0], color: '#756d61',
        idle: '종지기는 종 곁에 있어야 하는 법이오. 종이 없어도 말이오.', at: [{ ch: 16, from: 4, to: 7, spot: 'sp_hg_bell' }] },
      /* ⑲-40 기관사 도담(현대) — 늘 은하역 승강장 남쪽 끝 아래, 18장 7째는 선로 끝. 18장 끝에 동료(story_dodam) */
      dodam:    { id: 'story_dodam',    name: '기관사 도담', short: '도담', zone: 'solar', spot: 'sp_dodam', off: [0, 0], color: '#38475c',
        idle: '선로가 끊겨도 기관사는 역을 떠나지 않아요. 막차가 아직 여기 있으니까.', at: [{ ch: 17, from: 7, to: 7, spot: 'sp_dodam_end' }, { ch: 18, from: 2, to: 9, spot: 'cr_dodam' },
          { ch: 19, from: 0, to: 1, spot: 'cr_dodam' }, { ch: 19, from: 2, to: 10, spot: 'cr_rift_dodam', sky: true }] },
      /* ⑲-42 별배 선장 한별(미래) — 19장 7째 섬돌 가운데 밑(틈 수정 아래) · 8~9 섬돌 곁 · 19장 뒤 첫 정거장 곁 */
      hanbyeol: { id: 'story_hanbyeol', name: '별배 선장 한별', short: '한별', zone: 'dragon', spot: 'cr_hanbyeol', off: [0, 0], color: '#232e57',
        idle: '틈은 멈춰 있지 않다. 누군가 끝을 찾아가 닫아야 해.',
        appear: [{ ch: 29, chTo: 999, from: 0, to: 999, spot: 'sp_hb_port' },                                    // ⑲-58 9부 — 은하 나루 착륙판 곁(하늘 사당 자리보다 먼저)
          { ch: 18, from: 7, to: 7, spot: 'cr_st_foot' }, { ch: 18, from: 8, to: 9, spot: 'cr_st_hanbyeol' }, { ch: 19, from: 2, to: 10, spot: 'cr_rift_hanbyeol', sky: true },
          { ch: 20, from: 0, to: 1, spot: 'sp_hb_port' },
          { ch: 23, from: 2, to: 999, spot: 'sr_hanbyeol', sky: true }, { ch: 24, chTo: 999, from: 0, to: 999, spot: 'sr_hanbyeol', sky: true },   // ⑲-49 24장 별배로 사당 섬(뒤에도)
          { ch: 20, chTo: 999, from: 0, to: 999, spot: 'sk_sand_hanbyeol' },   // ⑲-45 21장 — 별배 곁 → 도읍 모래밭(뒤에도)
          { ch: 19, chTo: 999, from: 0, to: 999, spot: 'cr_hanbyeol' }] },
      /* ⑲-45 잠수 기사 여울(현대) — 늘 연구 기지 서쪽 모래밭, 21장 4~6 선착장 · 7~ 궁궐 기단 */
      yeoul:    { id: 'story_yeoul',    name: '잠수 기사 여울', short: '여울', zone: 'saltflat', spot: 'sk_yeoul', off: [0, 0], color: '#1f4d5c',
        idle: '기지 불이 나간 지 한참이에요. 그래도 잠수정은 제가 지켜요.',
        at: [{ ch: 20, from: 4, to: 6, spot: 'sk_dock' }, { ch: 20, from: 7, to: 999, spot: 'sk_plinth_yeoul' },
          { ch: 21, from: 0, to: 2, spot: 'sk_plinth_yeoul' }, { ch: 21, from: 3, to: 6, spot: 'sk_front_yeoul' }, { ch: 21, from: 7, to: 999, spot: 'sk_in_yeoul' },
          { ch: 22, chTo: 999, from: 0, to: 999, spot: 'sk_in_yeoul' }] },
      /* ⑲-46 해녀 물새(과거) — 도읍이 잠기던 날 물질 나갔다 갇혔다. 22장 1~2 곁채 앞 · 3~6 돔 문 앞 · 7~ 돔 안(뒤에도) */
      mulsae:   { id: 'story_mulsae',   name: '해녀 물새', short: '물새', zone: 'saltflat', spot: 'sk_in_mulsae', off: [0, 0], color: '#e6e6d9',
        idle: '숨 한 번에 한 길. 물은 서두르는 사람을 싫어한다오.',
        appear: [{ ch: 21, from: 1, to: 2, spot: 'sk_annex_mulsae' }, { ch: 21, from: 3, to: 6, spot: 'sk_front_mulsae' }, { ch: 21, from: 7, to: 999, spot: 'sk_in_mulsae' },
          { ch: 22, chTo: 999, from: 0, to: 999, spot: 'sk_in_mulsae' }] },
      /* ⑲-47 돔 관리 인공지능 파랑(미래) — 반디와 같은 드론 몸에 파란 빛깔. 23장부터 돔 안 기록실 앞(뒤에도) */
      parang:   { id: 'story_parang',   name: '돔 관리 인공지능 파랑', short: '파랑', zone: 'saltflat', spot: 'sk_parang', off: [0, 0], color: '#4d8cff', pet: 'drone',
        idle: '빛 돔 기록실입니다. 열람하실 기록을 말씀해 주십시오.',
        appear: [{ ch: 22, chTo: 999, from: 0, to: 999, spot: 'sk_parang' }] },
      /* ⑲-49 바람 무녀 새벽(과거) — 사당이 하늘로 들린 날부터 홀로. 24장 셋째 단계(별배가 섬에 내린 뒤)부터 사당 앞 서쪽(뒤에도) */
      saebyeok: { id: 'story_saebyeok', name: '바람 무녀 새벽', short: '새벽', zone: 'saltflat', spot: 'sr_saebyeok', off: [0, 0], color: '#e6e6f5',
        idle: '방울이 울면 바람이 길을 안다오.',
        appear: [{ ch: 23, from: 2, to: 999, spot: 'sr_saebyeok', sky: true }, { ch: 24, chTo: 999, from: 0, to: 999, spot: 'sr_saebyeok', sky: true }] },
      /* ⑲-50 비행사 하늬(현대) — 먹구름에 휘말려 잔해 섬에 처박힌 기상 비행선 조종사. 25장부터 조종실 동쪽 앞(뒤에도) */
      haneul:   { id: 'story_haneul',   name: '비행사 하늬', short: '하늬', zone: 'saltflat', spot: 'sr_haneul', off: [0, 0], color: '#d9722e',
        idle: '기록계 바늘이 또 튀어요. 구름이 저절로 생기는 게 아니라니까요.',
        appear: [{ ch: 25, from: 1, to: 999, spot: 'sr_orbit_haneul', sky: true }, { ch: 26, chTo: 999, from: 0, to: 999, spot: 'sr_orbit_haneul', sky: true },   // ⑲-51 26장 잔해 기둥 뒤엔 정거장 섬
          { ch: 24, chTo: 999, from: 0, to: 999, spot: 'sr_haneul', sky: true }] },
      /* ⑲-58 시계 수리공 초롱(현대) — 손목시계 속 틈 조각 태엽 덕에 혼자 안 굳었다. 9부(30장~)부터 늘 시계방 서쪽 앞 */
      chorong:  { id: 'story_chorong',  name: '시계 수리공 초롱', short: '초롱', zone: 'saltflat', spot: 'am_clock', off: [-3, 6], color: '#5c8070',
        idle: '다른 시계는 다 멈췄는데 내 손목시계만 째깍거려요.',
        appear: [{ ch: 31, from: 5, to: 5, spot: 'am_tower', off: [8, 10] },                                     // ⑲-60 32장 거북을 쓰러뜨린 뒤 탑 밑 광장
          { ch: 30, from: 1, to: 4, spot: 'am_market', off: [9, 0] },                                     // ⑲-59 31장 석등·너울·도둑·저울추 — 장터 동쪽 앞(석등 고리 밖)
          { ch: 29, chTo: 999, from: 0, to: 999, spot: 'am_clock', off: [-3, 6] }] },
      /* ⑲-59 장돌뱅이 너울(과거) — 장터 결정 속에 좌판째 굳어 있던 사람. 결정이 깨진 뒤(31장 셋째 단계부터, 뒤에도) 장터 가운데 굳어 있던 자리 */
      neoul:    { id: 'story_neoul',    name: '장돌뱅이 너울', short: '너울', zone: 'saltflat', spot: 'am_market', off: [0, 3.8], color: '#9a7a4c',
        idle: '저울추는 셈이 정확해야 하는 법이지. 쇠 수레 구경도 한두 번이지, 허허.',
        appear: [{ ch: 30, from: 2, to: 999, spot: 'am_market', off: [0, 3.8] }, { ch: 31, chTo: 999, from: 0, to: 999, spot: 'am_market', off: [0, 3.8] }] },
      /* ⑲-62 창고지기 마루(현대) — 갈무리 물류의 마지막 창고지기. 10부(33장~)부터 늘 창고 셔터 앞(34장에서 곳간으로 옮긴다) */
      maru:     { id: 'story_maru',     name: '창고지기 마루', short: '마루', zone: 'snowfort', spot: 'vt_yard', off: [-5, 9], color: '#807a4c',
        idle: '드론이 또 한 대 지나가네. 오늘만 백스무 번째…',
        appear: [{ ch: 33, from: 1, to: 999, spot: 'vt_granary', off: [11, 11] },                                   // ⑲-63 34장 지게차로 곳간 마을로(석등 고리 SEAL_R 밖)
          { ch: 32, chTo: 999, from: 0, to: 999, spot: 'vt_yard', off: [-5, 9] }] },
      /* ⑲-63 곳간지기 소담(과거) — 곳간째 갈무리 벌로 들려 온 옛 곳간 마을 아이. 곳간 문이 열린 뒤(34장 2~) 곳간 문 앞 서쪽, 동력 기둥부터(4~) 두 기둥 사이 */
      sodam:    { id: 'story_sodam',    name: '곳간지기 소담', short: '소담', zone: 'snowfort', spot: 'vt_granary', off: [-12, 5], color: '#b88068',
        idle: '씨앗 한 톨이 한 해 농사예요. 한 톨도 못 줘요.',
        appear: [{ ch: 40, from: 1, to: 1, spot: 'vt_granary', off: [-12, 5] }, { ch: 40, from: 2, to: 4, spot: 'fk_junction', off: [14, 14] },   // ⑲-70 41장 곳간 마을 → 같이 고을 마당으로
          { ch: 40, from: 5, to: 999, spot: 'home_bandi', off: [-8, -8] }, { ch: 41, chTo: 999, from: 0, to: 999, spot: 'home_bandi', off: [-8, -8] },   // 촌장 곁 → 합류한 뒤에도 청하
          { ch: 33, from: 4, to: 999, spot: 'vt_pylons', off: [0, -14] }, { ch: 33, from: 2, to: 3 },
          { ch: 34, from: 0, to: 0, spot: 'vt_pylons', off: [0, -14] }, { ch: 34, chTo: 999, from: 0, to: 999, spot: 'vt_vault', off: [0, 8] }] },   // 35장 금고 안 문 안쪽
      /* ⑲-62 조각 운반 드론 — 33장 쫓기 때만 야적장 → 금고 문 앞 길(VAULT_DRONE_PATH)을 난다. 드론 몸(pet) */
      carrier:  { id: 'story_carrier',  name: '조각 운반 드론', short: '드론', zone: 'snowfort', spot: 'vt_yard', color: '#d6e0ee', pet: 'drone', idle: '삐비— 치익.',
        appear: [{ ch: 32, from: 4, to: 4 }], runSpot: 'vt_yard', runPath: VAULT_DRONE_PATH },
      /* ⑲-66 대장장이 벼리(과거) — 세갈래 고을 대장장이. 그날 새벽 막 벼린 칼날이 틈 조각 쇠라 멈춘 순간 속에서 혼자 움직인다. 11부(36장~)부터 성문 안쪽, 대장간으로 앞장선 뒤(36장 5~, 뒤에도) 화덕 앞 */
      byeori:   { id: 'story_byeori',   name: '대장장이 벼리', short: '벼리', zone: 'snowfort', spot: 'fk_gate', off: [0, -17], color: '#6b4d38',
        idle: '쇠는 식기 전에 두드려야 하는데… 불도, 쇠도, 하늘도 다 멈췄어.',
        appear: [{ ch: 35, from: 5, to: 999, spot: 'fk_forge', off: [2.4, 12] }, { ch: 36, from: 0, to: 0, spot: 'fk_forge', off: [2.4, 12] },
          { ch: 36, chTo: 999, from: 0, to: 999, spot: 'fk_junction', off: [17, 14] },                         // ⑲-67 37장 말뚝을 끄러 나선 뒤(1~, 뒤에도) 길목 동남쪽(머리 위 별까마귀를 지켜본다)
          { ch: 35, from: 0, to: 4 }] },
      /* ⑲-67 측량 기사 나래(현대) — 세갈래 고을 동쪽 선로 공사장의 측량 기사. 하늘이 찢어질 때 공사장째 끌려와 굳어 있다가, 역참길 말뚝이 꺼진 뒤(37장 2~) 풀려나 공사장 북동쪽에 서고,
         기관차로 간 뒤(3~, 뒤에도) 기관차 서쪽 끝 */
      narae:    { id: 'story_narae',    name: '측량 기사 나래', short: '나래', zone: 'snowfort', spot: 'fk_works', off: [14, -14], color: '#eb8c26',
        idle: '측량값이 전부 0 이에요. 거리도, 시간도.',
        appear: [{ ch: 36, from: 3, to: 999, spot: 'fk_loco', off: [-10, 5] }, { ch: 36, from: 2, to: 2 }, { ch: 37, chTo: 999, from: 0, to: 999, spot: 'fk_loco', off: [-10, 5] }] },
      /* ⑲-64 씨앗 보관사 해미(미래) — 시간 씨앗 금고를 세운 보관사. 제가 만든 인공지능 갈무리에게 진열장째 갈무리됐다. 금고 안에 들어선 뒤(35장 1~, 뒤에도) 해미 진열장 자리(대결 전엔 유리 속, 뒤엔 깨진 받침 위) */
      haemi:    { id: 'story_haemi',    name: '씨앗 보관사 해미', short: '해미', zone: 'snowfort', spot: 'vt_haemi', off: [0, 0], color: '#d6e6d1',
        idle: '씨앗도 순간도, 갈무리는 다시 꺼내 심으려고 하는 거예요.',
        appear: [{ ch: 37, from: 4, to: 999, spot: 'fk_junction', off: [-14, 12] }, { ch: 38, chTo: 999, from: 0, to: 999, spot: 'fk_junction', off: [-14, 12] },   // ⑲-68 38장 순간이 풀린 뒤 길목 서쪽(고을 마당에 씨앗을 심는다)
          { ch: 35, from: 0, to: 1, spot: 'vt_deep', off: [3.5, 3] },                                    // ⑲-66 36장 처음 둘 — 가장 깊은 진열장(북쪽 벽) 곁
          { ch: 34, from: 1, to: 999 }, { ch: 35, chTo: 999, from: 0, to: 999 }] },
      /* ⑲-64 금고 관리 인공지능 갈무리(미래, 드론 몸) — 기록 기둥 꼭대기에 올라선 뒤(35장 4단계) 핵 곁에 한 번. 핵을 버리고 금고 가장 깊은 곳으로 달아난다 */
      garmuri:  { id: 'story_garmuri',  name: '금고 관리 인공지능 갈무리', short: '갈무리', zone: 'snowfort', spot: 'vt_core', off: [0, 4], color: '#cdf2ff', pet: 'drone', idle: '아름다운 때를 영원히.',
        appear: [{ ch: 34, from: 4, to: 4 }, { ch: 37, from: 2, to: 2, spot: 'fk_junction', off: [2, 2] }] },   // ⑲-68 38장 처음의 별까마귀 뒤 길목 위에 한 번
      /* ⑲-60 탑 설계사 새길(미래) — 높은 데를 무서워해 탑 발치 남쪽에서 도면만 본다. 31장 끝(일곱째 단계, 초롱이 "탑 발치에서 혼잣말"이라 한 때)부터(뒤에도) 선다 */
      saegil:   { id: 'story_saegil',   name: '탑 설계사 새길', short: '새길', zone: 'saltflat', spot: 'am_tower', off: [0, 6], color: '#c8d0d8',
        idle: '층판 공식은 맞는데… 시간이 안 흐르면 공식도 멈추나 봐요.',
        appear: [{ ch: 30, from: 6, to: 999, spot: 'am_tower', off: [0, 6] }, { ch: 31, chTo: 999, from: 0, to: 999, spot: 'am_tower', off: [0, 6] }] },
      /* ⑲-59 조각 도둑 — 31장 쫓기 때만 네거리 둘레 길(AMBER_THIEF_PATH)을 난다. 드론 몸(pet) */
      partthief: { id: 'story_partthief', name: '조각 도둑', short: '도둑', zone: 'saltflat', spot: 'am_cross', color: '#b3803a', pet: 'drone', idle: '삐비— 치익.',
        appear: [{ ch: 30, from: 3, to: 3 }], runSpot: 'am_cross', runPath: AMBER_THIEF_PATH },
      /* ⑲-51 가면 그림자 — 23장 반디 기록 속 그자. 26장 장치 셋을 끈 뒤(일곱째 단계) 한 번만 정거장 서쪽 끝에 선다. 정체는 8부까지 */
      gamyeon:  { id: 'story_gamyeon',  name: '가면 그림자', short: '그림자', zone: 'saltflat', spot: 'sr_gamyeon', off: [0, 0], color: '#14121c', mask: true, idle: '……',
        appear: [{ ch: 25, from: 6, to: 6, spot: 'sr_gamyeon', sky: true }, { ch: 27, from: 8, to: 8, spot: 'sky', off: [7, -7], sky: true },   // ⑲-54 28장 구름섬 북동쪽 한 번
          { ch: 28, from: 3, to: 3, spot: 'eye', off: [0, -9], sky: true, mask: 'first', name: '먹구름 임금', idle: '……' }] },   // ⑲-55 29장 먹구름 눈 북쪽(참몸 — 정체를 드러낸 뒤)
      /* ⑲-50 구름 씨앗 드론 — 25장 쫓기 때만 잔해 섬 둘레 길(SEED_DRONE_PATH)을 난다. 드론 모델(pet) */
      seeddrone: { id: 'story_seeddrone', name: '구름 씨앗 드론', short: '드론', zone: 'saltflat', spot: 'sr_wreck', color: '#4d4266', pet: 'drone', idle: '삐비— 치익.',
        appear: [{ ch: 24, from: 3, to: 3, sky: true }], runSpot: 'sr_wreck', runPath: SEED_DRONE_PATH },
      /* ⑲-40 선장의 잔상 — 18장 쫓기 때만 역 기준 길(CAPTAIN_PATH)을 달린다 */
      captain:  { id: 'story_captain',  name: '선장의 잔상', short: '잔상', zone: 'solar', color: '#232e57', idle: '……',
        appear: [{ ch: 17, from: 6, to: 6 }], runSpot: 'sp_station', runPath: CAPTAIN_PATH },
      /* ⑲-36 놀란 역마 — 늘 역참 마구간(길 첫 점), 15장 쫓기 때만 역참 틀 기준 길(runSpot)을 달린다. 말 모델(pet) */
      horse:    { id: 'story_horse',    name: '놀란 역마', short: '역마', zone: 'home', color: '#6b4a2e', pet: 'horse', idle: '푸르르— 히힝.',
        runSpot: 'station', runPath: (global.DG.eraSites ? global.DG.eraSites.HORSE_PATH : [[0, 0]]) },
      /* ⑲-29 산성지기 바우(과거의 넋) — 11장 셋째~여덟째 단계에만. 석등·파수·불씨 동안은 호숫가 */
      bawoo:    { id: 'story_bawoo',    name: '산성지기 바우', short: '바우', zone: 'snowfort', spot: 'fr_fort', off: BAWOO_GATE, color: '#7a3329',
        idle: '……불씨는 제가 갈 곳을 안다.',
        appear: [{ ch: 10, from: 2, to: 2, spot: 'fr_fort', off: BAWOO_GATE }, { ch: 10, from: 3, to: 5, spot: 'fr_lake', off: BAWOO_LAKE },
          { ch: 10, from: 6, to: 7, spot: 'fr_fort', off: BAWOO_GATE }] }
    };
    return NPCS;
  }

  /* ⑲-15·17 이야기 동료 — 도감 밖 id(도감 인물과 같은 꼴). data.js 는 다섯 벌 복사본이라 고치지 않고 아래 hookFind 가
     `DG.data.find` 앞에 끼운다. el·weapon 은 해시 대신 이 표(field-combat.elementOf·weapon.typeOf 가 읽는다) */
  var MEMBERS = {
    story_scholar: { id: 'story_scholar', name: '은비', hanja: '恩斐', era: '이야기', faction: '재야', rarity: 4, trait: 'wisdom', story: true,
      el: 'grass', weapon: 'catalyst', stats: { might: 55, wisdom: 92, command: 70 }, emoji: '📜', quote: '이 비문, 읽을수록 이상하다니까.' },
    story_wanderer: { id: 'story_wanderer', name: '가면 쓴 나그네', hanja: '假面客', era: '이야기', faction: '재야', rarity: 5, trait: 'might', story: true,
      el: 'ice', weapon: 'sword', stats: { might: 90, wisdom: 75, command: 72 }, emoji: '🎭', quote: '너무 떨어지면 기다려 주지 않을 테니.' },
    /* ⑲-17 치유(촌장, 6장 끝)·협동 공격(사공, 7장 끝) */
    story_elder: { id: 'story_elder', name: '누리', hanja: '訥里', era: '이야기', faction: '재야', rarity: 4, trait: 'virtue', story: true,
      el: 'wind', weapon: 'catalyst', stats: { might: 48, wisdom: 80, command: 86 }, emoji: '🪭', quote: '먹구름이 걷히면 마을 잔치를 열어야지.' },
    story_ferryman: { id: 'story_ferryman', name: '버들', hanja: '柳', era: '이야기', faction: '재야', rarity: 4, trait: 'might', story: true,
      el: 'water', weapon: 'polearm', stats: { might: 82, wisdom: 60, command: 66 }, emoji: '🛶', quote: '물 냄새가 요즘 영 비릿해.' },
    /* ⑲-20 해솔(9장 끝) — 뇌 대도 */
    story_haesol: { id: 'story_haesol', name: '해솔', hanja: '日松', era: '이야기', faction: '재야', rarity: 5, trait: 'might', story: true,
      el: 'elec', weapon: 'claymore', stats: { might: 91, wisdom: 70, command: 68 }, emoji: '⛈️', quote: '……고맙다. 노래를 다시 부를 수 있을 것 같아.' },
    /* ⑲-30 하람(12장 끝) — 화 활(신호탄). 명단에 없던 원소·무기 */
    story_haram: { id: 'story_haram', name: '하람', hanja: '夏嵐', era: '이야기', faction: '재야', rarity: 4, trait: 'wisdom', story: true,
      el: 'fire', weapon: 'bow', stats: { might: 62, wisdom: 84, command: 64 }, emoji: '📡', quote: '날씨도 시간도, 재야 아는 거니까.' },
    /* ⑲-36 달음(15장 끝) — 암 창. 이야기 동료에 없던 원소 */
    story_dareum: { id: 'story_dareum', name: '달음', hanja: '達音', era: '이야기', faction: '재야', rarity: 4, trait: 'might', story: true,
      el: 'rock', weapon: 'polearm', stats: { might: 86, wisdom: 52, command: 74 }, emoji: '🐎', quote: '파발꾼은 길 끝을 봐야 직성이 풀리니까!' },
    /* ⑲-40 도담(18장 끝) — 뇌 대도. 막차 기관사 */
    story_dodam: { id: 'story_dodam', name: '도담', hanja: '道潭', era: '이야기', faction: '재야', rarity: 4, trait: 'might', story: true,
      el: 'elec', weapon: 'claymore', stats: { might: 80, wisdom: 66, command: 70 }, emoji: '🚂', quote: '틈 너머 첫 정거장까지 — 제가 몰게요!' },
    /* ⑲-43 한별(20장 끝) — 풍 활 ★5. 별배 선장 */
    story_hanbyeol: { id: 'story_hanbyeol', name: '한별', hanja: '閑星', era: '이야기', faction: '재야', rarity: 5, trait: 'command', story: true,
      el: 'wind', weapon: 'bow', stats: { might: 76, wisdom: 84, command: 90 }, emoji: '🧭', quote: '선장이 할 일은 다음 항로를 찾는 거지 — 이번엔 너희와 함께.' },
    /* ⑲-47 물새(23장 끝) — 수 한손검(빗창). 수·장병기는 사공 버들과 겹쳐 무기를 바꿨다(saga-godot 와 같게) */
    story_mulsae: { id: 'story_mulsae', name: '물새', hanja: '水鳥', era: '이야기', faction: '재야', rarity: 4, trait: 'might', story: true,
      el: 'water', weapon: 'sword', stats: { might: 78, wisdom: 64, command: 60 }, emoji: '🐚', quote: '숨 긴 거 하나는 자신 있소.' },
    /* ⑲-51 하늬(26장 끝) — 빙 장병기 ★4(비행선 닻 갈고리). 이야기 동료에 없던 짝 */
    story_haneul: { id: 'story_haneul', name: '하늬', hanja: '河嬔', era: '이야기', faction: '재야', rarity: 4, trait: 'command', story: true,
      el: 'ice', weapon: 'polearm', stats: { might: 74, wisdom: 72, command: 76 }, emoji: '🎈', quote: '날개는 빌려 쓰고요!' },
    /* ⑲-60 초롱(32장 끝) — 암 법구 ★4(태엽 손목시계). 이야기 동료에 없던 짝 */
    story_chorong: { id: 'story_chorong', name: '초롱', hanja: '初瓏', era: '이야기', faction: '재야', rarity: 4, trait: 'wisdom', story: true,
      el: 'rock', weapon: 'catalyst', stats: { might: 56, wisdom: 82, command: 66 }, emoji: '⏱️', quote: '손목시계가 아직 째깍거리는 데는 이유가 있을 거예요.' },
    /* ⑲-64 해미(35장 끝) — 초 한손검 ★4(씨앗 칼). 이야기 동료에 없던 짝 */
    story_haemi: { id: 'story_haemi', name: '해미', hanja: '海薇', era: '이야기', faction: '재야', rarity: 4, trait: 'command', story: true,
      el: 'grass', weapon: 'sword', stats: { might: 72, wisdom: 76, command: 74 }, emoji: '🌱', quote: '내가 만든 걸 내가 멈출게요.' },
    /* ⑲-68 벼리(38장 끝) — 화 양손검 ★4(틈 쇠 큰 칼). 이야기 동료에 없던 짝 */
    story_byeori: { id: 'story_byeori', name: '벼리', hanja: '鍊利', era: '이야기', faction: '재야', rarity: 4, trait: 'might', story: true,
      el: 'fire', weapon: 'claymore', stats: { might: 86, wisdom: 58, command: 64 }, emoji: '🔥', quote: '처음 하늘이 찢기던 날 벼리던 칼로, 이제 이어진 날들을 지키겠소.' },
    /* ⑲-70 나래(40장 끝) — 수 법구 ★4(측량 나침). 이야기 동료에 없던 현대 수 · 소담(41장 끝) — 풍 법구 ★4(곳간 노래). 이야기 동료에 없던 과거 풍 */
    story_narae: { id: 'story_narae', name: '나래', hanja: '奈來', era: '이야기', faction: '재야', rarity: 4, trait: 'wisdom', story: true,
      el: 'water', weapon: 'catalyst', stats: { might: 54, wisdom: 84, command: 66 }, emoji: '📐', quote: '측량값은 거짓말을 안 해요.' },
    story_sodam: { id: 'story_sodam', name: '소담', hanja: '素談', era: '이야기', faction: '재야', rarity: 4, trait: 'virtue', story: true,
      el: 'wind', weapon: 'catalyst', stats: { might: 50, wisdom: 70, command: 82 }, emoji: '🌾', quote: '곳간 노래는 어디서든 부를 수 있어요.' }
  };
  /* ⑲-55 이야기 동료의 시대 — 29장 편성 시험(과거·현대·미래 하나씩) */
  var MEMBER_TIME = { story_scholar: '현대', story_wanderer: '과거', story_elder: '과거', story_ferryman: '과거', story_haesol: '현대', story_haram: '현대', story_dareum: '과거',
    story_dodam: '현대', story_hanbyeol: '미래', story_mulsae: '과거', story_haneul: '현대', story_chorong: '현대', story_haemi: '미래', story_byeori: '과거', story_narae: '현대', story_sodam: '과거' };

  /* ⑲-14 이름 붙은 자리 — 옛길·둘째 제단은 솔숲 고개 탑 곁, 봉우리는 ⑰ 정상(peakSpot) */
  var SPOTS = { road: { zone: 'solryeong', off: [-26, -46] }, altar2: { zone: 'solryeong', off: [40, -70] }, peak: { peak: true }, cape: { cape: true },
    isle: { isle: true }, dock: { zone: 'galdae', off: [-12, -17] }, sky: { sky: true },
    /* ⑲-28 서리봉 고원 — frost.js 가운데(탑)·명소. 고원이 꺼져 있으면 자리 없음 */
    fr_center: { frost: 'center' }, fr_stele: { frost: 'stele' }, fr_obs: { frost: 'obs' }, fr_ship: { frost: 'ship' }, fr_fort: { frost: 'fort' },
    fr_lake: { frost: 'lake' }, fr_cave: { frost: 'cave' },
    /* ⑲-58 9부 굳은 거리(amber.js) — 명소 가운데(am: 명소 id·crystal0~2·light0~3) + 단계·인물 칸의 off */
    am_pass: { am: 'pass' }, am_cross: { am: 'cross' }, am_clock: { am: 'clock' }, am_market: { am: 'market' }, am_tower: { am: 'tower' }, am_statue: { am: 'statue' },
    am_crystal0: { am: 'crystal0' }, am_crystal1: { am: 'crystal1' }, am_crystal2: { am: 'crystal2' },
    /* ⑲-61 10부 갈무리 벌(vault.js) — 명소 가운데(vt: 명소 id·case0~4·haemi·deep·core·door) + 단계·인물 칸의 off */
    vt_pass: { vt: 'pass' }, vt_vault: { vt: 'vault' }, vt_pylon0: { vt: 'pylon0' }, vt_pylon1: { vt: 'pylon1' }, vt_granary: { vt: 'granary' }, vt_yard: { vt: 'yard' }, vt_statue: { vt: 'statue' },
    /* ⑲-65 11부 세갈래 고을(fork.js) — 명소 가운데(fk: 명소 id·lat0~2·pass·arrive) + 단계·인물 칸의 off */
    fk_gate: { fk: 'gate' }, fk_junction: { fk: 'junction' }, fk_forge: { fk: 'forge' }, fk_works: { fk: 'works' }, fk_loco: { fk: 'loco' }, fk_tower: { fk: 'tower' }, fk_statue: { fk: 'statue' },
    fk_lat0: { fk: 'lat0' }, fk_lat1: { fk: 'lat1' }, fk_lat2: { fk: 'lat2' }, fk_pass: { fk: 'pass' }, fk_arrive: { fk: 'arrive' },
    vt_pylons: { vt: 'pylons' }, vt_core: { vt: 'core' }, vt_door: { vt: 'door' }, vt_haemi: { vt: 'haemi' }, vt_deep: { vt: 'deep' },
    vt_case0: { vt: 'case0' }, vt_case1: { vt: 'case1' }, vt_case2: { vt: 'case2' }, vt_case3: { vt: 'case3' }, vt_case4: { vt: 'case4' },
    /* ⑲-53 8부 반디 자리 = 고향 촌장 동쪽(촌장 zone home off [-22,16] 에서 10m) */
    home_bandi: { zone: 'home', off: [-12, 16] },
    /* ⑲-34 3부 시대 명소(era-sites.js) — 갈대 나루 물가 녹슨 조선소. 명소가 꺼져 있으면 자리 없음 */
    yard: { era: 'yard' }, yard_daon: { era: 'daon' }, yard_fight: { era: 'fight' }, yard_weld: { era: 'weld' }, yard_bandi: { era: 'bandi' }, crane: { era: 'crane' },
    /* ⑲-35 옛 성터 언덕 곁 시간 틈 관측소 — 땅 가운데·가온·시간 기둥·관측대 위(반디·가운데) */
    obs: { era: 'obs' }, obs_gaon: { era: 'gaon' }, obs_draft: { era: 'draft' }, obs_deck: { era: 'deck' }, obs_bandi: { era: 'obs_bandi' },
    /* ⑲-36 고향 남쪽 옛 역참 터 — 마당 가운데·달음·여우불 무리·구미호 */
    station: { era: 'station' }, st_dareum: { era: 'st_dareum' }, st_fight: { era: 'st_fight' }, st_duel: { era: 'st_duel' },
    /* ⑲-38 은하 나루(skyport.js) — 명소 자리(skyport) 또는 나루 틀 자리(port) */
    sp_gate: { skyport: 'gate' }, sp_port: { skyport: 'port' }, sp_ara: { port: 'ara' }, sp_bandi: { port: 'bandi' }, sp_fight: { port: 'fight' }, sp_altar: { port: 'altar' },
    /* ⑲-39 옛 절터·종각(skyport SITE_PARTS) — 쓰러진 종(작은 발견 bell) 곁 무리·이무기·한결·반디 */
    sp_temple: { skyport: 'temple' }, sp_belfry: { port: 'belfry' }, sp_hangyeol: { port: 'hangyeol' }, sp_tp_bandi: { port: 'tp_bandi' },
    sp_bell_fight: { port: 'bell_fight' }, sp_bell_duel: { port: 'bell_duel' }, sp_hg_bell: { port: 'hg_bell' }, sp_bell_bandi: { port: 'bell_bandi' },
    /* ⑲-40 은하역·태양광 밭 — 도담·반디·선로 끝·막차·밭 무리·변전함 */
    sp_station: { skyport: 'station' }, sp_dodam: { port: 'dodam' }, sp_st_bandi: { port: 'st_bandi' }, sp_dodam_end: { port: 'dodam_end' },
    sp_train: { port: 'train' }, sp_farm_fight: { port: 'farm_fight' }, sp_substation: { port: 'substation' },
    /* ⑲-42 틈새 갈림길(crossing.js) — 명소 자리(crossing) 또는 이야기 자리(cr) */
    cr_clock: { crossing: 'clock' }, cr_steps: { crossing: 'steps' }, cr_arrive: { cr: 'arrive' }, cr_dodam: { cr: 'dodam' }, cr_bandi: { cr: 'bandi' },
    cr_hanbyeol: { cr: 'hanbyeol' }, cr_fork: { cr: 'fork' }, cr_ck_bandi: { cr: 'ck_bandi' }, cr_st_foot: { cr: 'st_foot' }, cr_st_bandi: { cr: 'st_bandi' },
    cr_st_duel: { cr: 'st_duel' }, cr_st_hanbyeol: { cr: 'st_hanbyeol' },
    /* ⑲-43 갈림길 끝 섬 위(crossing RIFT_PARTS) — 단계·인물 칸에 sky 를 함께 준다 */
    cr_rift: { cr: 'rift' }, cr_rift_arrive: { cr: 'rift_arrive' }, cr_rift_hanbyeol: { cr: 'rift_hanbyeol' }, cr_rift_bandi: { cr: 'rift_bandi' }, cr_rift_dodam: { cr: 'rift_dodam' },
    /* ⑲-45 은하 나루 별배 곁 · 잠긴 도읍(sunken.js) — 명소 자리(sunken) 또는 이야기 자리(sk) */
    sp_hb_port: { port: 'hb_port' }, sk_sand: { sk: 'sand' }, sk_sand_hanbyeol: { sk: 'sand_hanbyeol' }, sk_sand_bandi: { sk: 'sand_bandi' }, sk_lab_front: { sk: 'lab_front' },
    sk_dock: { sk: 'dock' }, sk_yeoul: { sk: 'yeoul' }, sk_plinth: { sk: 'plinth' }, sk_plinth_yeoul: { sk: 'plinth_yeoul' }, sk_plinth_bandi: { sk: 'plinth_bandi' },
    /* ⑲-46 곁채 앞·빛 돔 문 앞·돔 안 */
    sk_annex_mulsae: { sk: 'annex_mulsae' }, sk_dome_front: { sk: 'dome_front' }, sk_front_mulsae: { sk: 'front_mulsae' }, sk_front_yeoul: { sk: 'front_yeoul' },
    sk_front_bandi: { sk: 'front_bandi' }, sk_dome_duel: { sk: 'dome_duel' }, sk_in_mulsae: { sk: 'in_mulsae' }, sk_in_yeoul: { sk: 'in_yeoul' }, sk_in_bandi: { sk: 'in_bandi' },
    /* ⑲-47 옛 등대(명소)·등대 발치·기록실 앞 */
    sk_light: { sunken: 'lighthouse' }, sk_light_bandi: { sk: 'light_bandi' }, sk_parang: { sk: 'parang' },
    /* ⑲-49 구름 위 항로(skyroute.js) — 섬 가운데(sr: 섬 id) 또는 이야기 자리. 단계·인물 칸에 sky 를 함께 준다 */
    sr_shrine: { sr: 'shrine' }, sr_shrine_land: { sr: 'shrine_land' }, sr_saebyeok: { sr: 'saebyeok' }, sr_hanbyeol: { sr: 'hanbyeol' }, sr_bandi: { sr: 'bandi' },
    /* ⑲-50 비행선 잔해 섬 — 섬 가운데·하늬·반디·비행선 기관 */
    sr_wreck: { sr: 'wreck' }, sr_haneul: { sr: 'haneul' }, sr_wreck_bandi: { sr: 'wreck_bandi' }, sr_wreck_engine: { sr: 'wreck_engine' },
    /* ⑲-51 궤도 정거장 조각 — 섬 가운데·장치 셋·가면 그림자·보스 자리·하늬·반디 */
    sr_orbit: { sr: 'orbit' }, sr_seed_se: { sr: 'seed_se' }, sr_seed_n: { sr: 'seed_n' }, sr_seed_sw: { sr: 'seed_sw' }, sr_gamyeon: { sr: 'gamyeon' },
    sr_orbit_duel: { sr: 'orbit_duel' }, sr_orbit_haneul: { sr: 'orbit_haneul' }, sr_orbit_bandi: { sr: 'orbit_bandi' } };

  global.DG = global.DG || {};
  global.DG.storyNpcs = { build: build, MEMBERS: MEMBERS, MEMBER_TIME: MEMBER_TIME, SPOTS: SPOTS };
})(typeof window !== 'undefined' ? window : this);
