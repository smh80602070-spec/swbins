/**
 * 이야기 임무 1~14장 — 대화 창·금빛 기둥·목록(O)·단계 열여섯 가지 (PLAN §5 ⑲-12~20·28~30·34~35, saga-godot PLAN 106 ㉕㉗㉘㉙㉚㉜㉞㊲㊳㊺-2~4·㊼-1~2)
 * ---------------------------------------------------------------
 *   인물 넷    청하 촌장 누리(고향 마을) · 늙은 사공 버들(갈대 나루 탑) · 떠돌이 학자 은비(옛 성터 언덕 탑) —
 *              ⑮ 땅의 "고향에서 가장 가까운 탑" 곁에 늘 서 있다. 지금 단계가 아니면 혼잣말 한 줄.
 *              가면 쓴 나그네는 4장 둘째~여섯째 단계에만 고향 남쪽 다리목에 서고, 따라가기를 지나면 길 끝에 선다
 *   단계       talk(곁에서 💬/F → 대화) · go(그 자리 반경 안) · boss(그 탑 ⑪ 수호자 — 이미 쓰러져 꽃을 기다리면 바로 넘김) ·
 *              kill(임무 적 무리 `sq:` — 되살아나지 않고 전리품 없음) · light(옛 제단에 어느 원소든 스킬·해방) ·
 *              domain(먹구름 제단 또는 id 로 고른 숨은 터 깨기 — `domain:clear`) · gather(그 채집물 n 번 — `cook:gather`) ·
 *              cook(아무 요리 하나 — `cook:done`) · follow(인물이 길 점을 따라 걷는다 — 가까우면 걷고 멀면 선다) ·
 *              seal(제단 둘레 석등 해·달·별을 비문 차례대로 — 틀리면 다 꺼진다) · climb(⑰ 봉우리 꼭대기) ·
 *              duel(이야기 보스 검은 가면 — 들판 적 `b_mask`·`b_mask2`, 절반에서 원소 방패 + 졸개 둘) ·
 *              defend(제단 지키기 — 물결 셋이 제단으로 곧장, 제단이 무너지거나 전멸하면 4초 쉬고 처음부터) ·
 *              chase(노 도둑 쫓기 — 걸어선 못 잡는다) · sail(사공과 한 줄 → 배로 그 자리에, 키보드 판만 옮긴다) ·
 *              sky(바람 기둥을 타고 구름섬 윗면에 서기 — skyisle.js · landform.onSky. GPS 판은 기둥 곁에 닿으면.
 *              ⑲-35 pad: 'obs' 면 시간 기둥을 타고 관측대(era-sites)에 서기)
 *   자리       ⑮ 땅 탑 + off 또는 이름 붙은 자리(SPOTS — 옛길·둘째 제단·봉우리·곶·바위섬·나루·구름섬). 인물은 at·appear 칸으로 장마다 옮겨 선다.
 *              단계·인물 칸에 sky 면 구름섬 층(임무 적 f.sky · 인물은 섬 윗면에 선다 — ⑲-20). 인물 칸의 mask·name·idle 은 그 칸 동안만 덮는다
 *   장         여정 등급(플레이어 Lv) ar 에 열린다. 단계마다 부대 경험 10, 장 끝에 보상
 *   대화       글이 초당 30자로 흘러나온다 — F·Space·누르기 한 번이면 줄 전체, 한 번 더면 다음 줄. 고른 대답은 "나" 의 줄로
 *              한 번 나온다. 줄 셋째 칸은 표정(joy·angry·sorrow·surprised·fun). 카메라·입·손짓은 `talkShot()` 을 world3d 가
 *              읽어 `talkface.js` 로 그린다
 *   화면       목표에 금빛 기둥(3D) · 위쪽 추적 한 줄(장·목표·거리) · 미니맵 금빛 점 · O(📖 단추) 목록
 * 세계 임무(⑲-21) — 표는 worldquest.js. 같은 단계 엔진으로 돌고 **따라가는 줄**(이야기 또는 세계 임무 하나)만 목표·추적 글·
 *   임무 적이 선다. 맡길 사람 머리 위 푸른 ! · 곁에서 말을 걸면 그 줄로 넘어간다 · O 목록에서 따라가기를 바꾼다(바꾸면 그 단계 처음부터).
 *   세이브 `save.wq = { steps: {id: 단계}, done: [id…], track: id|null }`(읽는 쪽 기본값).
 * 세이브 `save.story = { ch, step }` 하나(읽는 쪽 기본값 — SAVE_VERSION 그대로). 임무 적·제단·채집 센 수·따라가기 길은
 * 저장하지 않는다(불러오면 그 단계 처음). 이름·대사는 saga-godot `data/story.gd`(가상 마을 사람)를 옮겼다.
 * 손잡이 `story.on` 0 이면 다 사라진다. 자리는 칸 좌표가 아니라 ⑮ 땅의 탑이라 GPS 판에서도 같은 곳이다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function FC() { return global.DG.fieldCombat || null; }
  function CK() { return global.DG.cooking || null; }
  function K(key, def) { return core().tuned('story.' + key, def); }
  function on() { return !!(K('on', 1) && BM()); }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function TALK_R() { return gps() ? 15 : 6; }
  function GO_R() { return gps() ? 60 : 30; }
  function LIGHT_R() { return 2.5; }               // 원소 신호 고리 반지름 + 이만큼 안에 제단이 들면 켜진다
  function FOLLOW_NEAR() { return gps() ? 25 : 12; } // 이 안이면 따라가는 인물이 걷는다
  function FOLLOW_LOST() { return gps() ? 60 : 30; } // 이보다 멀면 추적 글 "너무 멀다"
  function REVEAL_CPS() { return K('reveal', 30); }  // 초당 글자 — 0 이면 한 번에
  function CLIMB_R() { return gps() ? 40 : 20; }
  var POLE_GPS_R = 12;                               // ⑲-34 GPS 판 기중기 단계 — 들보 밑 이만큼 안     // ⑲-14 봉우리 오르기 — 정상 둘레(이 판은 땅 좌표가 둘이라 정상 곁 = 꼭대기)
  var STEP_EXP = 10, KILL_NEAR = 150, IDLE_R = 12, IDLE_GAP = 45000, FOLLOW_SPEED = 2.6, GATHER_R = 900, POT_R = 6000;
  /* ⑲-14 석등 차례 — 제단 둘레 SEAL_R m 에 셋, 놓인 자리는 북쪽부터 시계 방향 SEAL_LAYOUT(비문 차례와 다르다) */
  var SEAL_R = 6, SEAL_LAYOUT = ['moon', 'star', 'sun'], SEAL_ORDER = ['sun', 'moon', 'star'];
  var SEAL_MARKS = { sun: { name: '해', color: '#ff9e40' }, moon: { name: '달', color: '#b3ccff' }, star: { name: '별', color: '#f2e68c' } };
  /* ⑲-14 이야기 보스 — 체력 절반에서 뇌 방패(체력의 몫) + 졸개 둘 */
  var DUEL_P2_AT = 0.5, DUEL_P2_SHIELD = 0.12, DUEL_ADDS = ['imp', 'imp'];
  /* ⑲-14 이름 붙은 자리 — 옛길·둘째 제단은 솔숲 고개 탑 곁, 봉우리는 ⑰ 정상(peakSpot) */
  var SPOTS = { road: { zone: 'solryeong', off: [-26, -46] }, altar2: { zone: 'solryeong', off: [40, -70] }, peak: { peak: true }, cape: { cape: true },
    isle: { isle: true }, dock: { zone: 'galdae', off: [-12, -17] }, sky: { sky: true },
    /* ⑲-28 서리봉 고원 — frost.js 가운데(탑)·명소. 고원이 꺼져 있으면 자리 없음 */
    fr_center: { frost: 'center' }, fr_stele: { frost: 'stele' }, fr_obs: { frost: 'obs' }, fr_ship: { frost: 'ship' }, fr_fort: { frost: 'fort' },
    fr_lake: { frost: 'lake' }, fr_cave: { frost: 'cave' },
    /* ⑲-34 3부 시대 명소(era-sites.js) — 갈대 나루 물가 녹슨 조선소. 명소가 꺼져 있으면 자리 없음 */
    yard: { era: 'yard' }, yard_daon: { era: 'daon' }, yard_fight: { era: 'fight' }, yard_weld: { era: 'weld' }, yard_bandi: { era: 'bandi' }, crane: { era: 'crane' },
    /* ⑲-35 옛 성터 언덕 곁 시간 틈 관측소 — 땅 가운데·가온·시간 기둥·관측대 위(반디·가운데) */
    obs: { era: 'obs' }, obs_gaon: { era: 'gaon' }, obs_draft: { era: 'draft' }, obs_deck: { era: 'deck' }, obs_bandi: { era: 'obs_bandi' } };
  /* ⑲-28 하람이 서는 자리 — 관측소 곁(늘)·비행선 곁. 산성 안은 남쪽 문 안쪽(담 반 변 13m) */
  var HARAM_OBS = [-6, 10], HARAM_SHIP = [-6, 12], HARAM_FORT = [0, 4];
  /* ⑲-29 11장 자리(산성·호수 가운데에서) — 문루 = 남쪽 문(담 13m) · 바우는 문 안쪽 · 봉화 제단은 문 밖 20m ·
     석등은 호수(얼음 반지름 28m) 북쪽 물가 · 바우는 그 곁. 제단 무리는 담이 막는 북쪽 빼고 동~서 다섯 방향(도, 북 0 시계 방향) */
  var FORT_GATE = [0, 13], BAWOO_GATE = [3, 9], BEACON = [0, 20], LAKE_SEAL = [0, -36], BAWOO_LAKE = [-9, -40];
  var BEACON_DIRS = [90, 135, 180, 225, 270];
  /* ⑲-30 12장 자리 — 서리 무리·구미호는 얼음굴 어귀 남쪽 14m · 반디는 구미호 뒤 굴 앞 · 심장 받침은 비행선 곁(선체 밖) */
  var CAVE_FIGHT = [0, 14], BANDI_CAVE = [8, 6], HEART = [4, 7];
  /* ⑲-16 제단 지키기 — 물결은 제단 둘레 DEFEND_RING m 열두 자리에서 나온다(물결 n 은 4n 째 자리부터).
     제단 체력 = DEFEND_HITS × 그 자리 등급 공격(멧돼지 기준, 천하 등급 포함) */
  var DEFEND_RING = 15, DEFEND_WAVE_SEC = 28, DEFEND_REST = 4, DEFEND_HITS = 45, DEFEND_SLOTS = 12;
  var DEFEND_WAVES = [['imp', 'imp', 'toad'], ['imp', 'imp', 'toad', 'raptor'], ['imp', 'imp', 'rockbear', 'snowfox']];
  function DEFEND_START() { return gps() ? 50 : 25; }
  /* ⑲-16 곶(넷째 제단) — 갈대 나루 탑에서 반지름 CAPE_RADII × 여덟 방향 후보. 가운데·둘레 열두 자리가 다 뭍이고
     사공에게서 CAPE_CLEAR m 넘는 첫 자리 — 둘레 CAPE_SHORE m 에 물이 있는 후보를 먼저 */
  var CAPE_ZONE = 'galdae', CAPE_RADII = [50, 70, 90], CAPE_CLEAR = 30, CAPE_SHORE = 30, TERR_TILE = 48;   // TERR_TILE = world3d 지형 칸
  /* ⑲-19 바위섬 — 곶 둘레 ISLE_R 칸 안에서 이웃 여덟 중 물이 가장 많은 뭍 칸(같으면 곶에 가까운 것)의 가운데 */
  var ISLE_R = 10;
  /* ⑲-19 노 도둑 — 갈대 나루 탑에서 떨어진 길 점 일곱(+y 가 남쪽). CHASE_SPEED 로 달리고 점마다 CHASE_PAUSE 초 숨 고르기.
     걷기 8m/초·달리기 ×2.2(world.js) 사이 — 평균 약 11m/초. GPS 판은 걸어서 잡히게 느리다 */
  var THIEF_PATH = [[-10, -50], [-50, -70], [-90, -55], [-115, -20], [-110, 25], [-80, 55], [-40, 70]];
  function CHASE_SPEED() { return gps() ? 1.0 : 13; }
  function CHASE_PAUSE() { return gps() ? 3 : 0.5; }
  function CHASE_START() { return gps() ? 30 : 14; }
  function CHASE_CATCH() { return gps() ? 12 : 2.5; }

  /* 인물 — zone 은 ⑮ 땅 key(고향은 'home'), off 는 그 땅 탑에서 떨어진 자리(m).
     at 칸 [{ch(0부터), from, to, spot, off}] 이면 그 장 그 단계 동안 그 자리에 선다(⑲-14).
     appear 가 있으면 그 칸에만 선다(나그네 — 4장은 따라가는 길, 칸에 spot 이 없다) */
  var NPCS = {
    elder:    { id: 'story_elder',    name: '청하 촌장 누리', short: '누리', zone: 'home',    off: [-22, 16],  color: '#6b7f61', idle: '먹구름이 걷히면 마을 잔치를 열어야지.' },
    ferryman: { id: 'story_ferryman', name: '늙은 사공 버들', short: '버들', zone: 'galdae',  off: [-18, -24], color: '#4d6688', idle: '물 냄새가 요즘 영 비릿해.',
      at: [{ ch: 6, from: 8, to: 8, spot: 'cape', off: [-6, 6] }, { ch: 7, from: 5, to: 10, spot: 'isle', off: [-4, 18] }] },
    scholar:  { id: 'story_scholar',  name: '떠돌이 학자 은비', short: '은비', zone: 'gojeong', off: [-18, -24], color: '#8c6b99', idle: '이 비문, 읽을수록 이상하다니까.',
      at: [{ ch: 4, from: 0, to: 3, spot: 'road' }, { ch: 4, from: 4, to: 7, spot: 'altar2', off: [-5, 7] }, { ch: 5, from: 6, to: 6, spot: 'peak', off: [-5, 6] }] },
    wanderer: { id: 'story_wanderer', name: '가면 쓴 나그네', short: '나그네', zone: 'home',  off: [8, 70],    color: '#38384a', idle: '……',
      mask: true, appear: [{ ch: 3, from: 1, to: 5 }, { ch: 4, from: 6, to: 6, spot: 'altar2', off: [7, 5] }, { ch: 5, from: 2, to: 4, spot: 'peak', off: [5, 5] },
        { ch: 6, from: 3, to: 6, spot: 'cape', off: [6, 6] }, { ch: 7, from: 6, to: 9, spot: 'isle', off: [7, 8] },
        { ch: 8, from: 2, to: 2, spot: 'peak', off: [5, 5] }, { ch: 8, from: 3, to: 9, spot: 'sky', off: [5, 6], sky: true }] },
    /* ⑲-19 해솔(검은 가면의 참이름, 금 간 가면) · 노 도둑(쫓기 단계에만 — 자리는 달리는 곳).
       ⑲-20 9장엔 가면을 벗은 해솔이 구름섬에 선다(칸이 mask·name·idle 을 덮는다) */
    haesol:   { id: 'story_haesol',   name: '검은 가면 해솔', short: '해솔', zone: 'galdae', off: [0, 0], color: '#26222e', idle: '……',
      mask: 'crack', appear: [{ ch: 7, from: 8, to: 8, spot: 'isle', off: [0, -9] },
        { ch: 8, from: 6, to: 9, spot: 'sky', off: [-5, 5], sky: true, mask: false, name: '해솔', idle: '……고맙다. 노래를 다시 부를 수 있을 것 같아.' }] },
    thief:    { id: 'story_thief',    name: '노 도둑', short: '도둑', zone: 'galdae', off: [-10, -50], color: '#5a4a3a', idle: '헤헤, 못 잡지롱!',
      appear: [{ ch: 7, from: 2, to: 2 }], runPath: THIEF_PATH },
    /* ⑲-28 서리봉 고원 둘 — 자리가 ⑮ 땅 탑이 아니라 이름 붙은 자리(spot, 고원이 꺼지면 안 선다). 반디는 드론 몸(pet) */
    haram:    { id: 'story_haram',    name: '기상 관측원 하람', short: '하람', zone: 'snowfort', spot: 'fr_obs', off: HARAM_OBS, color: '#db7533',
      idle: '기압계 바늘이 또 얼었네… 사흘째 눈이 안 멎어요.',
      at: [{ ch: 9, from: 6, to: 6, spot: 'fr_ship', off: HARAM_SHIP }, { ch: 9, from: 7, to: 8, spot: 'fr_fort', off: HARAM_FORT },
        { ch: 10, from: 8, to: 8, spot: 'fr_ship', off: HARAM_SHIP }, { ch: 11, from: 6, to: 8, spot: 'fr_ship', off: HARAM_SHIP }] },
    bandi:    { id: 'story_bandi',    name: '조종 기계 반디', short: '반디', zone: 'snowfort', spot: 'fr_ship', off: [0, 12], color: '#8cd9f2', pet: 'drone',
      idle: '삐— 동력 3퍼센트. 추위 경고.', at: [{ ch: 11, from: 5, to: 5, spot: 'fr_cave', off: BANDI_CAVE }, { ch: 12, from: 6, to: 8, spot: 'yard_bandi' },
        { ch: 13, from: 9, to: 9, spot: 'obs_bandi', sky: true }] },
    /* ⑲-34 조선공 다온(현대) — 늘 조선소 창고 앞 */
    daon:     { id: 'story_daon',     name: '조선공 다온', short: '다온', zone: 'galdae', spot: 'yard_daon', off: [0, 0], color: '#335ea0',
      idle: '이 조선소 문 닫은 지 십 년인데… 요즘 밤마다 쇳소리가 나요.' },
    /* ⑲-35 시간 틈 관측사 가온(미래) — 늘 관측소 남서쪽 발치 */
    gaon:     { id: 'story_gaon',     name: '시간 틈 관측사 가온', short: '가온', zone: 'gojeong', spot: 'obs_gaon', off: [0, 0], color: '#dbe0eb',
      idle: '관측대가 또 한 뼘 기울었어요. 기록만 하고 있을 순 없는데…' },
    /* ⑲-29 산성지기 바우(과거의 넋) — 11장 셋째~여덟째 단계에만. 석등·파수·불씨 동안은 호숫가 */
    bawoo:    { id: 'story_bawoo',    name: '산성지기 바우', short: '바우', zone: 'snowfort', spot: 'fr_fort', off: BAWOO_GATE, color: '#7a3329',
      idle: '……불씨는 제가 갈 곳을 안다.',
      appear: [{ ch: 10, from: 2, to: 2, spot: 'fr_fort', off: BAWOO_GATE }, { ch: 10, from: 3, to: 5, spot: 'fr_lake', off: BAWOO_LAKE },
        { ch: 10, from: 6, to: 7, spot: 'fr_fort', off: BAWOO_GATE }] }
  };
  var NPC_KEYS = ['elder', 'ferryman', 'scholar', 'wanderer', 'haesol', 'thief', 'haram', 'bandi', 'bawoo', 'daon', 'gaon'];
  /* ⑲-21 세계 임무 인물 일곱(worldquest.js)을 같은 표에 — 대화·자리·혼잣말이 이야기 인물과 같은 길로 돈다 */
  var WQD = global.DG.worldQuests || null;
  if (WQD) { Object.keys(WQD.NPCS).forEach(function (k) { NPCS[k] = WQD.NPCS[k]; NPC_KEYS.push(k); }); }

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
      el: 'fire', weapon: 'bow', stats: { might: 62, wisdom: 84, command: 64 }, emoji: '📡', quote: '날씨도 시간도, 재야 아는 거니까.' }
  };
  function hookFind() {
    var D = global.DG.data;
    if (!D || !D.find || D.find._story) { return; }
    var base = D.find;
    D.find = function (id) { return (typeof id === 'string' && MEMBERS[id]) || base.apply(D, arguments); };
    D.find._story = true;
  }
  hookFind();
  /* 나그네가 걷는 길 — 고향 남쪽 다리목(첫 점 = 나그네 자리)에서 남쪽 들녘까지(+y 가 남쪽) */
  var WANDER_PATH = [[8, 70], [-4, 76], [-4, 104], [-4, 122], [20, 134], [38, 138]];

  /* 장 — 줄 = [말하는 이, 글, 표정?] · 고르는 줄 = ['?', [대답, 대답]](대답만 다르고 흐름은 같다) */
  var CHAPTERS = [
    { id: 'ch1', name: '제1장 · 먹구름이 오는 마을', ar: 1,
      reward: { knot: 2, gold: 500, guide: 2, party: 300 },
      steps: [
        { type: 'talk', npc: 'elder', text: '청하 촌장을 찾아가기',
          lines: [['누리', '왔구나. 요 며칠 대숲 쪽에서 바람이 울고, 하늘에 먹구름이 걷히질 않는단다.'],
            ['누리', '옛날부터 먹구름은 나쁜 기운이 깨어날 때 온다고 했지.'],
            ['?', ['제가 알아볼게요.', '바람이 운다고요?']],
            ['누리', '대숲 고을 탑에 가 보렴. 거기 사나운 것이 둥지를 틀었다는 소문이 있어.']] },
        { type: 'go', zone: 'jugeup', off: [0, 0], text: '대숲 고을 탑, 바람이 우는 곳으로' },
        { type: 'boss', zone: 'jugeup', text: '대숲 고을 수호자를 쓰러뜨리기' },
        { type: 'talk', npc: 'ferryman', text: '갈대 나루의 늙은 사공에게 먹구름을 묻기',
          lines: [['버들', '수호자를 쓰러뜨렸다고? 허, 그놈도 먹구름에 홀렸던 게야.', 'surprised'],
            ['버들', '먹구름은 이 나루 건너 제단에서 피어오르지. 거기 오래 잠든 이무기가 있다더군.'],
            ['?', ['이무기요?', '어떻게 막죠?']],
            ['버들', '옛 성터의 학자가 비문을 읽고 있다던데, 그 아이한테 가 봐. 요즘 성터 어귀에 졸개들이 들끓는다니 조심하고.']] },
        { type: 'kill', zone: 'gojeong', off: [40, -30], kinds: ['raptor', 'raptor', 'imp', 'imp'], text: '옛 성터 어귀의 먹구름 졸개 물리치기' },
        { type: 'talk', npc: 'scholar', text: '떠돌이 학자와 이야기하기',
          lines: [['은비', '살았다! 졸개들 때문에 비문 곁엔 가지도 못했어.', 'joy'],
            ['은비', '여길 봐. \'제단에 원소의 불을 밝히면 잠든 것의 이름이 드러난다\' — 네 힘이면 될지도 몰라.']] },
        { type: 'light', zone: 'gojeong', off: [-30, 26], text: '옛 제단에 원소 스킬로 불 밝히기' },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '먹구름 이무기라… 옛이야기인 줄로만 알았는데.', 'sorrow'],
            ['누리', '고맙다. 네 덕에 마을이 한시름 놓았구나. 이건 마을이 모은 작은 성의란다.', 'joy'],
            ['누리', '이무기를 상대하려면 더 강해져야 할 게다. 모험을 더 쌓고 오렴.']] }
      ] },
    { id: 'ch2', name: '제2장 · 먹구름 제단', ar: 5, join: 'story_scholar',
      reward: { knot: 3, gold: 1000, secret: 1, party: 500 },
      steps: [
        { type: 'talk', npc: 'scholar', text: '학자에게 제단 가는 길을 묻기',
          lines: [['은비', '비문을 다 읽었어. 이무기는 갈대 나루 건너, 먹구름 제단 안에 잠들어 있어.'],
            ['은비', '이무기는 번개를 두르면 불에 약해. 준비 단단히 해!']] },
        { type: 'go', altar: true, text: '갈대 나루 건너 먹구름 제단으로' },
        { type: 'domain', text: '먹구름 제단에서 먹구름 이무기를 쓰러뜨리기' },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '하늘이… 개었구나! 몇 해 만에 보는 맑은 하늘이냐.', 'joy'],
            ['누리', '이무기는 또 깨어날지 모르지만, 네가 있으니 든든하다. 잔치 준비를 해야겠구나!'],
            ['누리', '참, 은비가 너와 함께 다니고 싶다더구나. 비문 읽는 솜씨가 싸움에도 쓸모 있을 게다.', 'fun']] }
      ] },
    { id: 'ch3', name: '제3장 · 잔칫날의 불청객', ar: 7,
      reward: { knot: 3, gold: 1250, guide: 2, secret: 1, party: 600 },
      steps: [
        { type: 'talk', npc: 'elder', text: '촌장에게 잔치 일손을 돕겠다고 하기',
          lines: [['누리', '하늘이 갠 기념으로 잔치를 열기로 했단다. 그런데 일손이 모자라구나.'],
            ['누리', '들에 피는 청하란을 셋만 꺾어다 주렴. 잔칫상에 꽂을 꽃이란다.'],
            ['?', ['맡겨 주세요.', '음식은요?']],
            ['누리', '꽃을 꺾거든 역참 솥에서 요리도 하나 해 오렴. 사공 버들이 요즘 통 입맛이 없다더구나.']] },
        { type: 'gather', item: 'orchid', count: 3, text: '청하란 꺾기' },
        { type: 'cook', text: '역참 곁 솥에서 요리 하나 만들기' },
        { type: 'talk', npc: 'ferryman', text: '갈대 나루의 사공에게 요리 가져다주기',
          lines: [['버들', '오, 냄새 좋구나! 이 늙은이를 다 챙겨 주고.', 'joy'],
            ['버들', '그런데 말이다, 어젯밤 가마골 쪽 하늘이 벌겋더구나. 불도깨비 우두머리가 또 날뛰는 게야.'],
            ['?', ['제가 가 볼게요.', '잔치에 불똥이 튀면 큰일이네요.']],
            ['버들', '그놈 불씨가 바람을 타고 마을로 날아들면 잔치고 뭐고 다 타 버릴 게다. 조심하거라.', 'angry']] },
        { type: 'boss', zone: 'gamagol', text: '가마골 수호자를 쓰러뜨리기' },
        { type: 'talk', npc: 'scholar', text: '떠돌이 학자에게 가마골 소식 전하기',
          lines: [['은비', '가마골 수호자를 잡았다고? 마침 잘 왔어. 비문 둘째 조각을 찾았거든.'],
            ['은비', '\'가면 쓴 나그네가 제단을 두드려 잠든 것을 깨웠다\' — 이무기는 스스로 깨어난 게 아니었어.', 'surprised'],
            ['?', ['가면 쓴 나그네?', '누가 그런 짓을?']],
            ['은비', '가마골 잠든 무덤 안쪽에 그 나그네가 남긴 흔적이 있을지도 몰라. 가 보자.']] },
        { type: 'domain', did: 'd:gamagol', text: '가마골 잠든 무덤에서 나그네의 흔적 찾기' },
        { type: 'kill', zone: 'home', off: [-10, 26], kinds: ['imp', 'imp', 'imp', 'hawk'], text: '잔치 마당에 쳐들어온 불도깨비 졸개 물리치기' },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '휴, 네가 없었으면 잔치 마당이 잿더미가 될 뻔했구나.', 'sorrow'],
            ['누리', '가면 쓴 나그네라… 옛이야기에 그런 자가 있었지. 먹구름이 올 때마다 어딘가에 서 있었다던.'],
            ['누리', '오늘은 걱정 말고 실컷 먹고 즐기렴. 이건 잔치 손님께 드리는 선물이란다.', 'joy']] }
      ] },
    { id: 'ch4', name: '제4장 · 가면 쓴 나그네', ar: 10,
      reward: { knot: 3, gold: 1500, guide: 2, secret: 2, party: 650 },
      steps: [
        { type: 'talk', npc: 'elder', text: '촌장에게 새벽 소식 듣기',
          lines: [['누리', '잔치 이튿날 새벽이었단다. 남쪽 다리목에 웬 가면 쓴 나그네가 서 있더래.'],
            ['누리', '말을 걸어도 대꾸도 않고 강물만 보더라는구나. 옛이야기 속 그자일까…'],
            ['?', ['제가 만나 볼게요.', '위험한 사람일까요?']],
            ['누리', '조심하거라. 먹구름이 올 때마다 서 있었다던 자라면, 좋은 뜻인지 나쁜 뜻인지 아무도 모른단다.', 'sorrow']] },
        { type: 'talk', npc: 'wanderer', text: '남쪽 다리목의 가면 쓴 나그네에게 말 걸기',
          lines: [['나그네', '……먹구름을 걷어 낸 게 너로군.'],
            ['나그네', '여기선 귀가 많다. 할 말이 있으면 따라오게.'],
            ['?', ['따라가죠.', '당신은 누구죠?']],
            ['나그네', '걸으면서 생각해 보게. 너무 떨어지면 기다려 주지 않을 테니.']] },
        { type: 'follow', npc: 'wanderer', text: '가면 쓴 나그네를 놓치지 않고 따라가기' },
        { type: 'talk', npc: 'wanderer', text: '남쪽 들녘에서 나그네의 말 듣기',
          lines: [['나그네', '여기라면 듣는 이가 없겠지. 이무기를 깨운 건 내가 아니다.'],
            ['나그네', '나는 제단을 두드리고 다니는 자를 쫓고 있을 뿐이다. 그자도 가면을 쓰지 — 그래서 다들 나로 착각하더군.'],
            ['?', ['그럼 진짜는 따로 있다는 거예요?', '증거라도 있나요?']],
            ['나그네', '증거라… 마침 저기 풀숲이 수상하군. 너도 쫓기고 있었던 모양이다.']] },
        { type: 'kill', zone: 'home', off: [48, 146], kinds: ['imp', 'imp', 'snowfox', 'rockbear'], text: '들녘에 숨어 있던 가면 졸개 물리치기' },
        { type: 'talk', npc: 'wanderer', text: '나그네에게 돌아가기',
          lines: [['나그네', '제법이군. 이 졸개들이 쓴 가면을 보게 — 내 것과 무늬가 다르지.'],
            ['나그네', '이 조각을 옛 성터의 학자에게 보이게. 비문을 읽는 아이라면 알아볼 게다.'],
            ['나그네', '우린 또 만나겠지. 다음 먹구름이 오기 전에.']] },
        { type: 'talk', npc: 'scholar', text: '떠돌이 학자에게 가면 조각 보이기',
          lines: [['은비', '가면 조각? 어디 봐… 이 무늬, 비문 맨 아래 새겨진 거랑 똑같아!', 'surprised'],
            ['은비', '비문엔 제단이 다섯이라고 적혀 있어. 먹구름 제단은 그중 하나일 뿐이고.'],
            ['?', ['나머지 넷은 어디에?', '가면 쓴 자는 누구죠?']],
            ['은비', '아직은 몰라. 하지만 조각이 모이면 알 수 있을 거야. 서쪽 고개 너머 옛길을 먼저 뒤져 볼게.']] },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '나그네가 쫓는 가면 쓴 자라… 먹구름이 다섯 번이나 더 올 수 있다는 말이냐.', 'sorrow'],
            ['누리', '네가 있어 다행이구나. 마을 사람들 몫으로 모은 것이니 받아 두렴.']] }
      ] },
    { id: 'ch5', name: '제5장 · 솔숲 고개 옛길', ar: 12, join: 'story_wanderer',
      reward: { knot: 3, gold: 1750, guide: 3, secret: 2, party: 700 },
      steps: [
        { type: 'talk', npc: 'elder', text: '촌장에게 학자 소식 듣기',
          lines: [['누리', '은비가 솔숲 고개 옛길로 떠난 지 사흘째란다. 그 뒤로 소식이 뚝 끊겼어.', 'sorrow'],
            ['누리', '그 길은 사당보다도 오래된 길이야. 숲에 묻혀서 이제 아는 사람도 드물지.'],
            ['?', ['제가 찾아볼게요.', '혼자 간 거예요?']],
            ['누리', '솔숲 고개 탑 곁 숲으로 들어가면 옛길 어귀가 나온단다. 서두르렴.']] },
        { type: 'go', spot: 'road', off: [0, 40], text: '솔숲 고개 옛길 어귀로' },
        { type: 'kill', spot: 'road', off: [7, 5], kinds: ['imp', 'imp', 'vine', 'hawk'], text: '옛길에서 학자를 에워싼 가면 졸개 물리치기' },
        { type: 'talk', npc: 'scholar', text: '옛길에서 학자와 이야기하기',
          lines: [['은비', '휴, 살았다! 비문을 베끼다가 졸개들한테 딱 걸렸지 뭐야.', 'joy'],
            ['은비', '둘째 제단은 이 고개 너머 숲에 있어. 석등 셋이 제단을 둘러싸고 있지.'],
            ['은비', '비문엔 이렇게 적혀 있었어 — \'해가 뜨고, 달이 지고, 별이 남는다\'. 그 차례대로 불을 밝혀야 봉인이 풀려.'],
            ['?', ['차례가 틀리면요?', '먼저 가 볼게요.']],
            ['은비', '전부 꺼져 버리겠지. 해, 달, 별 — 잊으면 안 돼!']] },
        { type: 'seal', spot: 'altar2', order: ['sun', 'moon', 'star'], text: '둘째 제단 석등을 비문 차례대로 밝히기' },
        { type: 'kill', spot: 'altar2', off: [0, 10], kinds: ['imp', 'imp', 'raptor', 'snowfox', 'rockbear'], text: '제단에 몰려든 가면 무리 물리치기' },
        { type: 'talk', npc: 'wanderer', text: '제단 곁의 가면 쓴 나그네와 이야기하기',
          lines: [['나그네', '……한발 늦을 뻔했군. 그자가 이 제단을 두드리러 오던 참이었다.'],
            ['나그네', '네가 먼저 봉인을 밝혀 두었으니 깨우지는 못하고, 졸개만 풀어 놓고 달아났지.'],
            ['?', ['그자를 봤어요?', '어디로 갔죠?']],
            ['나그네', '봉우리 너머로. 그자가 떨군 비문 조각이다 — 학자에게 건네게.'],
            ['나그네', '……그자를 쫓는 길, 이제부턴 혼자보다 둘이 낫겠군. 촌장에게 인사를 마치면 네 곁에 서지.']] },
        { type: 'talk', npc: 'scholar', text: '학자에게 셋째 비문 조각 건네기',
          lines: [['은비', '셋째 조각…! \'다섯 제단이 모두 깨면 먹구름의 주인이 돌아온다\'.', 'surprised'],
            ['은비', '가면 쓴 자가 노리는 건 이무기가 아니었어. 그 \'주인\'이야.'],
            ['?', ['먹구름의 주인?', '남은 제단은 셋이네요.']],
            ['은비', '둘은 우리가 지켰어. 남은 셋은… 조각을 더 읽어 보고 알려 줄게.']] },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '은비가 무사하다니 다행이구나. 먹구름의 주인이라… 이름만 들어도 오싹하다.', 'sorrow'],
            ['누리', '잊혔던 옛길까지 되살려 준 셈이니 마을이 네게 진 빚이 크구나. 받아 두렴.', 'joy']] }
      ] },
    { id: 'ch6', name: '제6장 · 봉우리의 검은 가면', ar: 15, join: 'story_elder',
      reward: { knot: 4, gold: 2000, guide: 3, secret: 2, party: 750 },
      steps: [
        { type: 'talk', npc: 'scholar', text: '학자에게 셋째 제단 자리 듣기',
          lines: [['은비', '조각들을 맞춰 봤어. 셋째 제단은 봉우리 꼭대기야 — 길이 없어서 벽을 타고 올라가야 해.'],
            ['은비', '나그네는 벌써 올라갔대. 검은 가면이 그리로 가는 걸 봤다나.', 'surprised'],
            ['?', ['바로 갈게요.', '검은 가면?']],
            ['은비', '진짜 범인 말이야. 이번엔 도망치기 전에 붙잡아야 해! 기력 잘 보면서 올라가.']] },
        { type: 'climb', spot: 'peak', text: '봉우리 꼭대기로 올라가기(벽 타기·활공)' },
        { type: 'talk', npc: 'wanderer', text: '봉우리의 나그네와 이야기하기',
          lines: [['나그네', '제법 빨리 왔군. 그자가 곧 제단을 두드리러 올 게다.'],
            ['나그네', '그자는 그림자처럼 등 뒤로 붙는다. 붉은 원이 발밑에 생기면 곧장 몸을 빼게.'],
            ['?', ['같이 싸워요.', '왔다!']],
            ['나그네', '……왔군. 먹구름을 두르면 불로 깨라!', 'angry']] },
        { type: 'duel', spot: 'peak', off: [0, -8], kind: 'b_mask', text: '검은 가면과 맞서기' },
        { type: 'talk', npc: 'wanderer', text: '나그네와 검은 가면이 남긴 것 살피기',
          lines: [['나그네', '……먹구름 속으로 달아났군. 하지만 가면에 금이 갔다. 다음엔 못 숨는다.'],
            ['나그네', '그자가 떨군 비문 조각이다. 그리고 제단 — 두드린 자국이 있지만 아직 살아 있어.'],
            ['나그네', '원소의 불을 다시 밝히게. 학자도 곧 올라올 게다.']] },
        { type: 'light', spot: 'peak', off: [-7, -4], text: '셋째 제단에 원소 불 다시 밝히기' },
        { type: 'talk', npc: 'scholar', text: '봉우리에 올라온 학자에게 넷째 조각 보이기',
          lines: [['은비', '헉, 헉… 이 벽 누가 만든 거야. 조각 좀 보여 줘!', 'sorrow'],
            ['은비', '\'먹구름 임금은 다섯 제단에 나뉘어 잠들었다. 가면은 임금의 신하의 표식이다\'…', 'surprised'],
            ['?', ['신하라고요?', '검은 가면이 그 신하?']],
            ['은비', '응. 남은 제단은 둘. 그자도 급해졌을 거야 — 마을에 먼저 알리자.']] },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '먹구름 임금의 신하라… 옛날 할머니가 들려주던 자장가에 그런 말이 있었지.', 'sorrow'],
            ['누리', '봉우리까지 오르다니 장하구나. 다친 데는 없느냐? 이건 마을 사람들이 모은 거란다.', 'joy'],
            ['누리', '……이 늙은이도 더는 앉아만 있을 수 없구나. 다음 길엔 나도 함께 가마. 부채 바람쯤은 아직 일으킬 줄 안단다.']] }
      ] },
    { id: 'ch7', name: '제7장 · 물가 곶의 넷째 제단', ar: 18, join: 'story_ferryman',
      reward: { knot: 4, gold: 2250, guide: 3, secret: 2, party: 800 },
      steps: [
        { type: 'talk', npc: 'scholar', text: '학자에게 넷째 제단 자리 듣기',
          lines: [['은비', '넷째 조각 뒷면에 지도가 새겨져 있었어. 넷째 제단은 갈대 나루 곁, 물이 휘감아 도는 곶이야.'],
            ['은비', '근데 이상해. 곶 쪽에서 밤마다 불빛이 오락가락한대. 사공 할아버지가 제일 잘 알 거야.', 'surprised'],
            ['?', ['사공에게 가 볼게요.', '불빛이요?']],
            ['은비', '검은 가면이 이번엔 혼자 오지 않을지도 몰라. 조심해!']] },
        { type: 'talk', npc: 'ferryman', text: '갈대 나루의 사공에게 곶 소식 묻기',
          lines: [['버들', '곶 말이냐? 요 며칠 밤마다 가면 쓴 무리가 떼로 몰려가더구나.', 'sorrow'],
            ['버들', '제단 돌을 두드리는 소리가 여기까지 들려. 이 늙은이 배로는 어림도 없고.'],
            ['?', ['제가 지킬게요.', '몇이나 되던가요?']],
            ['버들', '셀 수가 없었다. 한 떼를 쫓으면 또 한 떼가 오더구나. 제단이 무너지기 전에 서두르거라.']] },
        { type: 'go', spot: 'cape', off: [0, 22], text: '갈대 나루 곁 곶, 넷째 제단으로' },
        { type: 'talk', npc: 'wanderer', text: '곶의 나그네와 이야기하기',
          lines: [['나그네', '왔군. 그자가 이번엔 제 손을 더럽히지 않을 셈이다 — 무리부터 보냈어.'],
            ['나그네', '제단이 무너지면 먹구름 임금의 넷째 조각이 풀려난다. 무리를 제단에 붙이지 마라.'],
            ['?', ['제단 곁을 지킬게요.', '그자는 어디 있죠?']],
            ['나그네', '물결 뒤에 숨어 보고 있겠지. 무리가 다 쓰러지면 제 발로 나올 게다.', 'angry']] },
        { type: 'defend', spot: 'cape', name: '넷째 제단', text: '넷째 제단을 가면 무리에게서 지키기' },
        { type: 'duel', spot: 'cape', off: [0, -8], kind: 'b_mask2', shield: 'water', adds: ['imp', 'toad'], text: '금 간 검은 가면과 맞서기',
          enter: '🎭 금 간 검은 가면이 물결을 가르고 곶에 올라섰다',
          p2: '🌊 금 간 검은 가면이 물 방패를 둘렀다 — 번개로 깨라! 졸개가 뛰어든다',
          win: '🎭 가면 반쪽이 떨어졌다 — 금 간 검은 가면이 물속으로 몸을 던졌다. 졸개도 흩어진다' },
        { type: 'talk', npc: 'wanderer', text: '나그네와 깨진 가면 반쪽 살피기',
          lines: [['나그네', '……물속으로 달아났군. 하지만 가면 반쪽을 두고 갔다.'],
            ['나그네', '방금 그 얼굴… 아니, 그럴 리가 없지.', 'surprised'],
            ['?', ['아는 얼굴이에요?', '괜찮아요?']],
            ['나그네', '아직은 말할 수 없다. 제단부터 다시 밝히게 — 그자가 두드린 자국이 깊다.']] },
        { type: 'light', spot: 'cape', text: '넷째 제단에 원소 불 다시 밝히기' },
        { type: 'talk', npc: 'ferryman', text: '곶에 온 사공과 물 건너 불빛 보기',
          lines: [['버들', '불이 켜졌구나! 멀리서 보고 노를 저어 왔지.', 'joy'],
            ['버들', '그런데 저기 보이느냐? 물 건너 바위섬에도 불빛 하나가 깜박이는구나.', 'surprised'],
            ['?', ['다섯째 제단?', '누가 켰을까요?']],
            ['버들', '바위섬은 뱃길이 험해 아무도 안 가는 곳이다. 촌장께 먼저 알리거라.'],
            ['버들', '……그리고 그 뱃길은 내가 안내하마. 이 늙은 노도 아직 쓸 만하단다. 촌장께 인사를 마치면 네 곁에 서지.']] },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '제단을 지켜 냈다니… 이제 남은 건 바위섬 하나로구나.', 'sorrow'],
            ['누리', '가면 반쪽이라. 나그네가 그렇게 놀라더란 말이지.'],
            ['누리', '고생 많았다. 마을 사람들이 곶의 불빛을 보고 모은 거란다.', 'joy']] }
      ] },
    { id: 'ch8', name: '제8장 · 바위섬의 다섯째 제단', ar: 20,
      reward: { knot: 4, gold: 2500, guide: 3, secret: 3, party: 850 },
      steps: [
        { type: 'talk', npc: 'elder', text: '촌장에게 바위섬 이야기 듣기',
          lines: [['누리', '사공이 본 바위섬 불빛 말이다, 오늘 새벽엔 더 밝아졌다는구나.', 'sorrow'],
            ['누리', '바위섬엔 뱃길 말고는 갈 길이 없단다. 사공 버들에게 배를 부탁해 보렴.'],
            ['?', ['나루로 갈게요.', '섬엔 뭐가 있죠?']],
            ['누리', '옛사람들은 거기를 "별이 쉬는 바위"라 불렀지. 다섯째 제단이 있다면 거기일 게다.']] },
        { type: 'talk', npc: 'ferryman', text: '갈대 나루의 사공에게 배를 부탁하기',
          lines: [['버들', '배? 태워 주고말고… 그런데 노가 없어졌다!', 'angry'],
            ['버들', '방금 웬 날랜 녀석이 노를 둘러메고 물가를 따라 내뺐어. 가면 무리 끄나풀인 게야.'],
            ['?', ['제가 잡아 올게요.', '어느 쪽으로요?']],
            ['버들', '걸어서는 어림없다, 그놈 발이 여간 빠른 게 아니야. 힘껏 달려야 잡는다!']] },
        { type: 'chase', npc: 'thief', text: '노 도둑을 쫓아가 붙잡기(달리기)' },
        { type: 'talk', npc: 'ferryman', text: '사공에게 노 돌려주기',
          lines: [['버들', '허허, 그 날랜 놈을 잡았다고? 네 발도 보통이 아니구나.', 'joy'],
            ['버들', '노만 있으면 바위섬쯤이야. 배에 오르거든 꽉 잡거라.']] },
        { type: 'sail', npc: 'ferryman', to: 'isle', toOff: [0, 14], text: '사공의 배를 타고 바위섬으로',
          lines: [['버들', '자, 간다! 물살이 세니 고개 숙이고 있거라.']] },
        { type: 'kill', spot: 'isle', off: [0, -4], kinds: ['imp', 'imp', 'toad', 'hawk'], text: '바위섬 꼭대기의 가면 무리 물리치기' },
        { type: 'talk', npc: 'wanderer', text: '섬의 나그네와 이야기하기',
          lines: [['나그네', '……먼저 와 있었다. 그자가 이 섬에 올 줄 알았지.'],
            ['나그네', '이제 말해야겠군. 검은 가면의 참이름은 해솔 — 나와 같은 마을에서 자란 옛 동무다.', 'sorrow'],
            ['?', ['옛 동무라고요?', '왜 이런 짓을?']],
            ['나그네', '석등을 켜 보게. 별, 달, 해 — 해솔이 어릴 때 부르던 노래 차례다. 그 녀석이라면 이 차례로 잠갔을 게다.']] },
        { type: 'seal', spot: 'isle', order: ['star', 'moon', 'sun'], text: '다섯째 제단 석등을 해솔의 노래 차례대로 밝히기' },
        { type: 'talk', npc: 'haesol', text: '석등 곁에 나타난 해솔과 이야기하기',
          lines: [['해솔', '……별, 달, 해. 그 노래를 아직 기억하는 사람이 있었나.'],
            ['해솔', '다섯 제단은 임금을 가둔 자물쇠다. 나는 그 자물쇠를 여는 열쇠고.', 'angry'],
            ['?', ['왜 임금을 깨우려는 거죠?', '나그네가 당신을 찾고 있어요.']],
            ['해솔', '알 것 없다. 먹구름 위 여섯째 자리에서 기다리마 — 거기서 끝을 보자.']] },
        { type: 'talk', npc: 'wanderer', text: '나그네와 해솔이 남긴 말 되새기기',
          lines: [['나그네', '……여전히 제멋대로군. 가면 반쪽이 깨진 채로 가다니.', 'sorrow'],
            ['나그네', '먹구름 위 여섯째 자리라… 하늘에 뜬 섬 이야기를 들어 본 적이 있다. 학자가 알 게다.'],
            ['나그네', '일단 뭍으로 돌아가세. 사공이 배를 대고 기다리고 있다.']] },
        { type: 'sail', npc: 'ferryman', to: 'dock', toOff: [0, 0], text: '사공의 배를 타고 갈대 나루로 돌아가기',
          lines: [['버들', '다 끝났느냐? 해 지기 전에 돌아가자꾸나.']] },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '해솔이라… 그 이름을 다시 듣게 될 줄이야. 어릴 적 나그네와 늘 붙어 다니던 아이였지.', 'surprised'],
            ['누리', '먹구름 위 여섯째 자리라니, 은비에게 물어보자꾸나. 오늘은 푹 쉬렴.'],
            ['누리', '바위섬까지 다녀온 수고비다. 마을 사람들이 조금씩 모았단다.', 'joy']] }
      ] },
    /* ⑲-20 이야기 1부 끝 — 봉우리 바람 기둥 → 구름섬(skyisle.js) → 해솔 → 먹구름 임금 → 활공으로 마을에 */
    { id: 'ch9', name: '제9장 · 먹구름 위 여섯째 자리', ar: 25, join: 'story_haesol',
      reward: { knot: 5, gold: 2750, guide: 3, secret: 4, party: 900 },
      steps: [
        { type: 'talk', npc: 'scholar', text: '떠돌이 학자에게 여섯째 자리 묻기',
          lines: [['은비', '다섯 조각을 다 맞췄어! 끝 구절은 이래 — \'다섯 불이 모이는 곳, 봉우리 위 하늘에 여섯째 자리\'.', 'joy'],
            ['은비', '그리고 어젯밤, 북쪽 봉우리 꼭대기에서 하늘로 바람 기둥이 솟는 걸 봤어. 다섯 제단 불빛이 거기로 모이더라.'],
            ['?', ['봉우리로 갈게요.', '하늘로 가는 길이라고요?']],
            ['은비', '바람을 타면 구름 위까지 오를 수 있을 거야. 나그네가 먼저 봉우리로 갔어 — 서둘러!']] },
        { type: 'climb', spot: 'peak', text: '북쪽 봉우리 꼭대기로 오르기' },
        { type: 'talk', npc: 'wanderer', text: '바람 기둥 곁의 나그네와 이야기하기',
          lines: [['나그네', '왔군. 보이나 — 저 바람 기둥. 다섯 제단의 불이 하늘에 길을 냈다.', 'surprised'],
            ['나그네', '기둥 안에서 뛰어오르게. 바람이 날개를 펴 주고, 구름섬 위까지 밀어 올려 줄 거다.'],
            ['?', ['같이 가요.', '해솔은 거기 있을까요?']],
            ['나그네', '…있을 거다. 이번엔 가면이 아니라 해솔을 데려온다. 먼저 올라가 있겠네.']] },
        { type: 'sky', text: '바람 기둥을 타고 구름섬에 오르기(기둥 안에서 점프)' },
        { type: 'kill', spot: 'sky', off: [0, 2], sky: true, kinds: ['hawk', 'raptor', 'raptor', 'imp'], text: '구름섬을 지키는 먹구름 무리 물리치기' },
        { type: 'duel', spot: 'sky', off: [0, -3], sky: true, kind: 'haesol_mask', shield: 'elec', adds: ['hawk', 'raptor'], text: '먹구름 가면을 쓴 해솔과 맞서기',
          enter: '🎭 먹구름을 두른 해솔이 여섯째 자리에서 내려섰다',
          p2: '⛈️ 해솔이 먹구름 방패를 둘렀다 — 불로 깨라! 회오리매와 번개날쌘용이 뛰어든다',
          win: '🎭 해솔의 가면이 마침내 두 쪽으로 갈라져 떨어졌다 — 해솔이 무릎을 꿇는다' },
        { type: 'talk', npc: 'haesol', text: '가면을 벗은 해솔과 이야기하기',
          lines: [['해솔', '……여기가, 어디지. 오래 꿈을 꾼 것 같아. 먹구름 속에서 누가 계속 노래를 부르라고…', 'sorrow'],
            ['해솔', '아니 — 늦었다! 내가 자물쇠를 두드려 낸 틈으로 임금의 꿈이 새어 나왔어. 그 꿈이 이 섬에서 몸을 얻는다!', 'surprised'],
            ['?', ['같이 막아요!', '해솔, 괜찮아요?']],
            ['해솔', '몸이 아직 말을 안 들어. 네가 먹구름 임금을 막아 줘. 난 곁에서 노래로 바람을 붙들고 있을게.', 'angry']] },
        { type: 'duel', spot: 'sky', off: [0, -3], sky: true, kind: 'storm_king', shield: 'elec', adds: ['imp', 'raptor'], text: '먹구름 임금 물리치기',
          enter: '👑 먹구름이 뭉쳐 왕관 쓴 거인이 되었다 — 먹구름 임금!',
          p2: '⛈️ 먹구름 임금이 번개 방패를 둘렀다 — 불로 깨라! 졸개 둘이 뛰어든다',
          win: '👑 먹구름 임금 — 꿈이 흩어지며 하늘의 먹구름이 걷혀 간다' },
        { type: 'talk', npc: 'wanderer', text: '나그네와 해솔 곁으로 가기',
          lines: [['나그네', '……해솔.', 'sorrow'],
            ['해솔', '여전하구나, 그 흰 가면. 날 찾겠다는 맹세였다고? 바보 같긴.', 'fun'],
            ['나그네', '이제 벗어도 되겠지.', 'joy'],
            ['?', ['다행이에요.', '두 분 다 돌아와서 기뻐요.']],
            ['해솔', '마을로 내려가자. 누리 할머니한테 혼나야겠지만 — 날개를 펴고 곧장.']] },
        { type: 'talk', npc: 'haesol', text: '해솔과 함께 내려갈 채비하기',
          lines: [['해솔', '난간을 뛰어넘으면 바람이 날개를 펴 줘. 마을 쪽으로 한달음이야. 먼저 가 있어, 곧 따라갈게.', 'joy']] },
        { type: 'go', zone: 'home', off: [-10, 10], text: '구름섬에서 뛰어내려 청하 마을로' },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '하늘이 이렇게 파란 건 몇 해 만인지…! 먹구름이 걷혔어.', 'joy'],
            ['누리', '해솔이 돌아왔다고? 그 녀석, 할머니 볼 낯도 없나 봐. 이따 잔칫상 앞에 끌고 오너라.', 'fun'],
            ['누리', '늘 노래를 흥얼거리던 착한 아이였지. 이제부턴 네 곁에 서겠다더구나.', 'sorrow'],
            ['누리', '약속대로 잔치를 열자꾸나. 이건 온 마을이 너를 위해 모은 거다. 고맙다, 정말로.', 'joy']] }
      ] },
    /* ⑲-28 이야기 2부 첫 장 — 무대는 서리봉 고원(frost.js ⑲-27). 자리는 그 명소(SPOTS fr_*) */
    { id: 'ch10', name: '제10장 · 서리 고개 너머', ar: 26,
      reward: { knot: 5, gold: 3000, guide: 3, secret: 4, party: 950 },
      steps: [
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 북쪽 소식 듣기',
          lines: [['누리', '잔치가 끝나자마자 북쪽 산길이 얼어붙었단다. 고개에서 찬바람이 내려와.', 'sorrow'],
            ['누리', '고개 너머 서리봉 고원엔 옛 산성 터가 있고, 요즘은 날씨를 재는 관측소도 있다지. 그 불빛이 사흘째 꺼져 있구나.'],
            ['?', ['가 볼게요.', '관측소요?']],
            ['누리', '해솔 말로는 그날 밤 불붙은 별 하나가 고원 쪽으로 떨어졌대. 두껍게 입고 가거라.', 'surprised']] },
        { type: 'go', spot: 'fr_stele', text: '마을 북쪽 산길을 지나 서리 고개 넘기' },
        { type: 'go', spot: 'fr_center', off: [0, 8], text: '고원 탑에 다가가 순간이동 지점 켜기' },
        { type: 'kill', spot: 'fr_obs', off: [0, 20], kinds: ['snowfox', 'snowfox', 'hawk', 'snowfox'], text: '기상 관측소를 에워싼 눈여우 무리 물리치기' },
        { type: 'talk', npc: 'haram', text: '기상 관측소 앞의 관측원과 이야기하기',
          lines: [['하람', '살았다…! 저 여우들, 사흘째 관측소를 에워싸고 있었어요.', 'surprised'],
            ['하람', '난 기상 관측원 하람이에요. 사흘 전 밤, 은빛 배가 하늘에서 떨어진 뒤로 눈이 한 번도 안 멎어요. 바늘도 다 얼었고.'],
            ['?', ['은빛 배요?', '같이 가 봐요.']],
            ['하람', '떨어진 자리는 알아요. 따라와요 — 여우가 또 올지 모르니까 가까이 붙어서!', 'joy']] },
        { type: 'follow', npc: 'haram', path: [['fr_obs', HARAM_OBS], ['fr_ship', HARAM_SHIP]], speed: 6, arrive: '👣 하람이 걸음을 멈췄다',
          text: '관측원 하람을 따라 추락한 비행선으로' },
        { type: 'talk', npc: 'bandi', text: '추락한 비행선 곁의 기계와 이야기하기',
          lines: [['반디', '삐— 생체 신호 둘. 구조대입니까?'],
            ['하람', '구조대는 아니고… 넌 누구니?', 'surprised'],
            ['반디', '조종 기계 반디. 이 배 「별배」는 먼 앞날에서 시간 틈을 지나다 떨어졌습니다. 심장이 식으면서 추위를 뿜고 있습니다.'],
            ['?', ['심장을 다시 켤 수 있어?', '앞날에서 왔다고?']],
            ['반디', '불씨가 필요합니다. 기록에 따르면 이 고원의 옛 산성에 꺼지지 않는 불씨가 지켜졌습니다.'],
            ['하람', '산성이라면 고원 북쪽 돌담이에요. 요즘 밤마다 거기서 등불이 떠다닌다던데…', 'sorrow']] },
        { type: 'go', spot: 'fr_fort', text: '옛 산성 터 둘러보기' },
        { type: 'talk', npc: 'haram', text: '산성 터에서 하람과 이야기하기',
          lines: [['하람', '봐요, 눈 위에 발자국 하나 없는데 등불 그을음만 남았어요.', 'surprised'],
            ['하람', '밤이 되면 산성지기가 나와 불씨를 지킨다는 옛이야기가 있어요. 그냥 이야기인 줄 알았는데…'],
            ['?', ['산성지기를 찾아봐요.', '불씨가 정말 있을까요?']],
            ['하람', '오늘은 관측소에서 몸 좀 녹여요. 기계가 풀리면 날씨 지도를 보여 줄게요. 다음엔 산성 안쪽으로!', 'joy']] }
      ] },
    /* ⑲-29 관측소 → 산성 문루(바우) → 호숫가 석등 → 얼음 밑 파수 → 불씨 → 문 밖 봉화 제단 지키기 → 비행선 */
    { id: 'ch11', name: '제11장 · 얼음 아래 산성', ar: 28,
      reward: { knot: 5, gold: 3250, guide: 3, secret: 4, party: 1000 },
      steps: [
        { type: 'talk', npc: 'haram', text: '기상 관측소의 하람에게 날씨 지도 보기',
          lines: [['하람', '기계가 풀렸어요! 이것 봐요 — 찬 기운이 두 군데서 뿜어 나와요. 하나는 비행선, 하나는… 호수 한가운데.', 'surprised'],
            ['하람', '호수 밑엔 아무것도 없을 텐데. 그리고 어젯밤, 산성 문루에 등불 하나가 또 떠 있었어요.'],
            ['?', ['산성으로 가 볼게요.', '등불이요?']],
            ['하람', '옛이야기의 산성지기라면, 호수 얘기도 알겠죠. 난 여기서 바늘을 지켜볼게요. 조심해요!']] },
        { type: 'go', spot: 'fr_fort', off: FORT_GATE, text: '옛 산성 문루로' },
        { type: 'talk', npc: 'bawoo', text: '문루에 나타난 산성지기와 이야기하기',
          lines: [['바우', '……또 누가 불씨를 찾아왔구나. 먹구름 졸개냐, 하늘에서 떨어진 쇳덩이의 심부름꾼이냐.', 'angry'],
            ['?', ['불씨를 빌리러 왔어요.', '당신이 산성지기?']],
            ['바우', '나는 바우. 이 산성이 무너지던 날까지 봉화 불씨를 지켰고, 그 뒤로도 떠나지 못했다.'],
            ['바우', '적이 산성을 넘던 밤, 불씨를 호수 얼음 밑 석빙고에 감췄지. 얼음 문은 호숫가 석등 셋으로만 열린다.'],
            ['바우', '옛 노랫말이다 — \'달이 얼음에 먼저 비치고, 해가 얼음을 녹이고, 별이 길을 연다\'. 차례를 어기면 문은 다시 얼어붙는다.', 'sorrow'],
            ['바우', '호숫가에서 기다리마. 네 불이 노랫말을 따르는지 보겠다.']] },
        { type: 'seal', spot: 'fr_lake', off: LAKE_SEAL, order: ['moon', 'sun', 'star'], text: '얼어붙은 호수 석등을 노랫말 차례대로 밝히기' },
        { type: 'kill', spot: 'fr_lake', kinds: ['rockbear', 'snowfox', 'snowfox', 'raptor'], text: '얼음 문이 열리며 깨어난 파수 짐승 물리치기' },
        { type: 'talk', npc: 'bawoo', text: '호숫가의 바우에게 불씨 받기',
          lines: [['바우', '석빙고 파수들이 백 년 만에 깼구나. 저놈들도 제 일을 했을 뿐이다.', 'sorrow'],
            ['바우', '보아라 — 꺼지지 않았다. 산성 봉화의 불씨다.', 'joy'],
            ['?', ['하늘 배의 심장을 켜야 해요.', '받아도 될까요?']],
            ['바우', '쇳덩이의 심장이라… 불씨는 제가 갈 곳을 안다. 헌데 불씨가 얼음 밖에 나오면 그 냄새를 맡고 서리 짐승들이 몰려온다.'],
            ['바우', '산성 문루 앞 봉화 제단에 불씨를 올려라. 불이 제 힘을 되찾을 때까지 지켜 내야 한다. 담이 뒤를 막아 줄 게다.', 'angry']] },
        { type: 'defend', spot: 'fr_fort', off: BEACON, name: '봉화 제단', who: '서리 짐승이', dirs: BEACON_DIRS,
          waves: [['snowfox', 'snowfox', 'hawk'], ['rockbear', 'snowfox', 'raptor', 'hawk'], ['rockbear', 'rockbear', 'snowfox', 'raptor', 'hawk']],
          text: '산성 문루 앞 봉화 제단을 서리 짐승에게서 지키기' },
        { type: 'talk', npc: 'bawoo', text: '문루의 바우와 이야기하기',
          lines: [['바우', '……버텼구나. 불씨가 제 빛을 찾았다. 이제 얼음 밖에서도 꺼지지 않을 게다.', 'joy'],
            ['바우', '백 년을 지켰으니, 이제 넘겨도 되겠지. 산성의 불씨를 네게 맡긴다.'],
            ['?', ['꼭 지킬게요.', '당신은요?']],
            ['바우', '나는 이 돌담에 남는다. 하늘 배가 다시 떠오르면, 봉화가 오른 것으로 알겠다.', 'sorrow']] },
        { type: 'talk', npc: 'bandi', text: '추락한 비행선의 반디에게 불씨 가져가기',
          lines: [['반디', '삐— 열원 감지. 온도… 상승. 이것이 기록 속의 불씨입니까?', 'surprised'],
            ['하람', '관측소 바늘이 움직였어요! 호수 쪽 찬 기운이 뚝 끊겼고요.', 'joy'],
            ['?', ['이제 심장을 켤 수 있어?', '바우가 맡긴 거야.']],
            ['반디', '불씨만으로는 부족합니다. 심장실 문이 안쪽에서 얼어붙었고, 시간 틈에서 무언가가 심장을 붙잡고 있습니다.'],
            ['하람', '무언가라니… 오늘은 여기까지. 내일 날이 개면, 셋이서 배 안으로 들어가요.', 'sorrow']] }
      ] },
    /* ⑲-30 관측소 → 비행선(심장이 없다) → 얼음굴 → 시간 틈 무리 → 틈새 서리 구미호 → 심장 → 심장 받침 → 하람 합류.
       장이 끝나면 고원 눈이 잦아든다(frost.js calm) */
    { id: 'ch12', name: '제12장 · 떨어진 별배', ar: 30, join: 'story_haram',
      reward: { knot: 6, gold: 3500, guide: 4, secret: 5, party: 1100 },
      steps: [
        { type: 'talk', npc: 'haram', text: '기상 관측소의 하람과 이야기하기',
          lines: [['하람', '왔어요? 바늘이 또 이상해요 — 비행선 쪽 온도가 뚝뚝 떨어지는데, 반디 신호는 끊겼다 이어졌다 해요.', 'surprised'],
            ['?', ['바로 가 볼게요.', '반디가 위험해요?']],
            ['하람', '불씨는 잘 갖고 있죠? 먼저 가요. 나도 기계만 챙겨서 곧 따라갈게요!']] },
        { type: 'talk', npc: 'bandi', text: '추락한 비행선의 반디에게 가기',
          lines: [['반디', '삐— 경고. 심장실 문을 열었습니다. 심장이… 없습니다.', 'surprised'],
            ['반디', '시간 틈에서 흰 짐승이 나와 심장을 물고 갔습니다. 꼬리가 아홉. 발자국은 얼음굴로.'],
            ['?', ['쫓아갈게.', '꼬리가 아홉?']],
            ['반디', '그 짐승은 이 시대 것이 아닙니다. 심장의 추위를 먹고 자랍니다. 서둘러 주십시오.']] },
        { type: 'go', spot: 'fr_cave', text: '흰 발자국을 따라 얼음굴 어귀로' },
        { type: 'kill', spot: 'fr_cave', off: CAVE_FIGHT, kinds: ['snowfox', 'snowfox', 'hawk', 'snowfox'], text: '시간 틈에서 새어 나온 서리 무리 물리치기' },
        { type: 'duel', spot: 'fr_cave', off: CAVE_FIGHT, kind: 'rift_fox', shield: 'ice', adds: ['snowfox', 'hawk'], text: '별배 심장을 문 틈새 서리 구미호와 맞서기',
          enter: '🦊 시간 틈이 찢어지며 꼬리 아홉 달린 흰 여우가 뛰어나왔다 — 틈새 서리 구미호!',
          p2: '❄️ 틈새 서리 구미호가 시간 틈의 서리를 둘렀다 — 불로 깨라! 여우와 매가 뛰어든다',
          win: '🦊 틈새 서리 구미호 — 별배 심장을 떨구고 시간 틈 속으로 사라졌다' },
        { type: 'talk', npc: 'bandi', text: '얼음굴 앞에 날아온 반디와 심장 살피기',
          lines: [['반디', '삐— 심장 회수. 금은 갔지만 멈추지 않았습니다.', 'joy'],
            ['반디', '그 짐승은 틈 너머로 달아났습니다. 틈은 아직 닫히지 않았습니다 — 기록해 두겠습니다.'],
            ['?', ['이제 불씨로 켜자.', '틈이 또 열릴까?']],
            ['반디', '비행선 곁 심장 받침으로. 불씨를 원소로 불어 넣어 주십시오.']] },
        { type: 'light', spot: 'fr_ship', off: HEART, text: '비행선 곁 심장 받침에 원소 스킬로 불씨 불어 넣기' },
        { type: 'talk', npc: 'bandi', text: '심장이 뛰는 비행선의 반디와 이야기하기',
          lines: [['반디', '심장 박동 확인. 선체 온도 상승. 추위 방출… 정지.', 'joy'],
            ['하람', '보여요? 눈이 잦아들어요! 사흘 만에 하늘이 보여요.', 'joy'],
            ['?', ['별배는 날 수 있어?', '이제 끝난 거야?']],
            ['반디', '아직입니다. 날개 조각 셋이 시간 틈 너머 여러 시대에 흩어졌습니다. 그리고 그 흰 짐승도.', 'sorrow']] },
        { type: 'talk', npc: 'haram', text: '하람과 이야기하기',
          lines: [['하람', '여러 시대라니… 관측원 인생에 이런 날이 올 줄이야.', 'surprised'],
            ['하람', '결정했어요. 관측소 기록은 기계한테 맡기고, 나도 같이 갈래요. 날씨도 시간도, 재야 아는 거니까.', 'joy'],
            ['?', ['같이 가요!', '위험할 텐데요?']],
            ['하람', '신호탄 활이면 여우쯤은 문제없어요. 잘 부탁해요!', 'fun']] }
      ] },
    /* ⑲-34 이야기 3부 첫 장 — 무대는 갈대 나루 물가 녹슨 조선소(era-sites.js). 비행선 반디 → 조선소 → 다온 → 시간 틈 무리 →
       다온 → 기중기 다리 타고 들보 위로(landform 기둥 타기, GPS 판은 기중기 곁) → 반디 → 용접대 지키기(바다 쪽 빼고 뭍 다섯 방향) → 다온 */
    { id: 'ch13', name: '제13장 · 녹슨 조선소의 날개', ar: 32,
      reward: { knot: 6, gold: 3750, guide: 4, secret: 5, party: 1150 },
      steps: [
        { type: 'talk', npc: 'bandi', text: '추락한 비행선의 반디와 이야기하기',
          lines: [['반디', '삐— 날개 조각 신호 하나 수신. 방향 남쪽, 바다 냄새. 시대 표지는… 지금과 가깝습니다.', 'surprised'],
            ['?', ['바다라면 갈대 나루?', '지금과 가깝다니?']],
            ['반디', '갈대 나루 물가, 문 닫은 조선소 좌표입니다. 조각이 쇠붙이 사이에 끼어 있을 확률 칠십 퍼센트.'],
            ['반디', '시간 틈 짐승들도 신호를 맡았을 겁니다. 서둘러 주십시오.']] },
        { type: 'go', spot: 'yard', text: '갈대 나루 물가의 녹슨 조선소로' },
        { type: 'talk', npc: 'daon', text: '조선소 창고 앞의 다온과 이야기하기',
          lines: [['다온', '누구세요? 여긴 문 닫은 지 오래인데… 설마 밤마다 쇳소리 내는 게 당신들이에요?', 'surprised'],
            ['?', ['하늘에서 떨어진 조각을 찾고 있어요.', '쇳소리요?']],
            ['다온', '사흘 전 밤에 번쩍하더니 기중기 꼭대기에 뭔가 박혔어요. 그 뒤로 이상한 짐승들이 조선소를 뒤져요.', 'sorrow'],
            ['다온', '저기 — 또 왔네요!', 'angry']] },
        { type: 'kill', spot: 'yard_fight', kinds: ['toad', 'raptor', 'hawk', 'toad'], text: '조선소를 뒤지는 시간 틈 무리 물리치기' },
        { type: 'talk', npc: 'daon', text: '다온과 이야기하기',
          lines: [['다온', '와… 고마워요. 저 짐승들, 기중기 꼭대기만 올려다보더라고요.', 'joy'],
            ['다온', '사다리는 녹슬어 다 떨어졌어요. 다리를 타고 오를 수 있으면 모를까…'],
            ['?', ['타고 올라가 볼게요.', '높네요…']],
            ['다온', '노란 다리 바깥쪽에 디딤이 남아 있어요. 기력 아껴서, 조심해요!']] },
        { type: 'climb', spot: 'crane', pole: true, text: '녹슨 기중기 다리를 타고 들보 위로 올라 날개 조각 꺼내기' },
        { type: 'talk', npc: 'bandi', text: '날아온 반디에게 조각 보여 주기',
          lines: [['반디', '삐— 날개 조각 하나 확인. 셋 가운데 하나입니다.', 'joy'],
            ['다온', '잠깐, 그 조각 끝이 휘었어요. 그대로 끼우면 별배 날개에서 떨어져 나갈걸요.', 'surprised'],
            ['다온', '이 조선소 용접대, 아직 살아 있어요. 제가 이음매를 펴 붙일게요. 그동안만 막아 줘요.'],
            ['?', ['맡겨 줘요.', '용접 할 줄 알아요?']],
            ['다온', '여기서 배만 이십 년 붙였거든요. 불꽃 튀면 짐승들이 또 몰려올 거예요!', 'fun']] },
        { type: 'defend', spot: 'yard_weld', name: '용접대', who: '시간 틈 짐승들이', dirs: 'land',
          waves: [['toad', 'raptor', 'hawk'], ['toad', 'toad', 'imp', 'raptor'], ['rockbear', 'toad', 'raptor', 'hawk', 'imp']],
          text: '다온이 조각을 붙이는 동안 용접대 지키기' },
        { type: 'talk', npc: 'daon', text: '다온과 이야기하기',
          lines: [['다온', '다 됐어요! 이음매 반듯하게 폈어요. 십 년 만에 제대로 된 일 한 기분이네요.', 'joy'],
            ['반디', '삐— 조각 상태 양호. 남은 둘은 더 먼 시대 신호입니다. 하나는 앞, 하나는 뒤.', 'surprised'],
            ['?', ['앞 시대와 뒤 시대…', '다온, 고마워요.']],
            ['다온', '별배가 날면 꼭 보여 줘요. 배 붙이는 사람은 뜨는 걸 봐야 끝이거든요.', 'fun']] }
      ] },
    /* ⑲-35 3부 둘째 장 — 무대는 옛 성터 언덕 곁 시간 틈 관측소(era-sites.js). 반디 → 관측소 → 가온 → 시간 틈 무리 → 가온 →
       틈 석등 별 → 해 → 달 → 가온 → 시간 기둥 타고 관측대로(sky pad, GPS 판은 기둥 곁) → 관측대 파수(섬 층과 같은 발판 층) → 반디(관측대 위) */
    { id: 'ch14', name: '제14장 · 시간 틈 관측소', ar: 34,
      reward: { knot: 6, gold: 4000, guide: 4, secret: 5, party: 1200 },
      steps: [
        { type: 'talk', npc: 'bandi', text: '추락한 비행선의 반디와 이야기하기',
          lines: [['반디', '삐— 둘째 조각 신호 수신. 시대 표지가 이상합니다. 지금보다 앞 — 아직 오지 않은 때.', 'surprised'],
            ['?', ['오지 않은 때라니?', '어디서 오는 신호야?']],
            ['반디', '좌표는 옛 성터 언덕 곁. 그런데 높이 값이 땅 위 이십사 미터입니다. 하늘에 뭔가 떠 있습니다.'],
            ['반디', '먼저 가 주십시오. 저는 동력을 모아 뒤따르겠습니다.']] },
        { type: 'go', spot: 'obs', text: '옛 성터 언덕 곁 시간 틈 관측소로' },
        { type: 'talk', npc: 'gaon', text: '관측소 발치의 가온과 이야기하기',
          lines: [['가온', '여기까지 걸어 들어온 사람은 처음이네요. 이 관측소, 원래는 이 시대에 없어야 하는 건물이에요.', 'surprised'],
            ['?', ['저 위에 뜬 게 관측소예요?', '없어야 한다고요?']],
            ['가온', '저 틈에서 흘러나왔어요. 저도 같이요. 틈 석등 셋이 받쳐 줄 땐 시간 기둥이 서서 오르내릴 수 있었는데…', 'sorrow'],
            ['가온', '며칠 전 하늘에서 빛나는 조각이 관측대에 박히더니 석등이 다 꺼졌어요. 그 뒤로 짐승들이 — 또 와요!', 'angry']] },
        { type: 'kill', spot: 'obs', kinds: ['raptor', 'rockbear', 'hawk', 'raptor'], text: '관측소를 둘러싼 시간 틈 무리 물리치기',
          enter: '⚔️ 틈에서 시간 틈 짐승들이 쏟아져 나왔다' },
        { type: 'talk', npc: 'gaon', text: '가온과 이야기하기',
          lines: [['가온', '고마워요. 석등을 다시 켜면 시간 기둥이 설 거예요. 그런데 차례가 있어요.', 'joy'],
            ['가온', '우리 시대 아이들이 부르는 노래가 있거든요 — "별이 먼저 깨우고, 해가 밝히고, 달이 닫는다."'],
            ['?', ['별, 해, 달 차례군요.', '노래가 열쇠예요?']],
            ['가온', '틀리면 다 꺼져요. 원소 힘을 석등에 대 주세요.']] },
        { type: 'seal', spot: 'obs', order: ['star', 'sun', 'moon'], text: '틈 석등을 노래 차례(별 → 해 → 달)로 밝히기' },
        { type: 'talk', npc: 'gaon', text: '가온과 이야기하기',
          lines: [['가온', '섰어요! 관측소 남쪽에 빛기둥 보이죠? 저게 시간 기둥이에요.', 'joy'],
            ['가온', '뛰어올라 몸을 맡기면 위로 솟아요. 꼭대기에서 날개를 펴고 관측대로 내려앉으면 돼요.'],
            ['?', ['다녀올게요.', '위에 뭐가 있어요?']],
            ['가온', '조각 빛에 이끌린 파수들이 관측대를 차지했어요. 조심해요!']] },
        { type: 'sky', pad: 'obs', text: '시간 기둥을 타고 떠 있는 관측대 위로' },
        { type: 'kill', spot: 'obs_deck', sky: true, kinds: ['hawk', 'raptor', 'snowfox'], text: '관측대를 차지한 틈새 파수 물리치기',
          enter: '⚔️ 관측대의 틈새 파수가 몸을 일으켰다' },
        { type: 'talk', npc: 'bandi', text: '관측대로 날아온 반디에게 조각 보여 주기',
          lines: [['반디', '삐— 둘째 날개 조각 확인. 관측경 틀에 끼어 있었군요.', 'joy'],
            ['가온', '(아래에서) 관측경에 남은 기록이 떴어요! 조각이 박히기 직전 — 꼬리 아홉 흰 짐승이 틈을 지나갔대요.', 'surprised'],
            ['?', ['그 구미호가…', '어느 쪽으로?']],
            ['반디', '마지막 조각은 뒤 시대 신호. 옛 역참 길 쪽입니다. 구미호도 같은 곳을 향했을 확률이 높습니다.', 'angry'],
            ['가온', '(아래에서) 시간 기둥은 켜 둘게요. 언제든 다시 올라와 하늘을 봐요!', 'fun']] }
      ] }
  ];

  /* ── 자리(순수) ───────────────────────────────────────── */

  var anchorMemo = {};
  /** ⑮ 땅 zk 의 "고향에서 가장 가까운 탑" — { key, x, y }. 고향은 마을 가운데(0,0). 같은 세계면 늘 같다 */
  function anchorOf(zk) {
    if (anchorMemo[zk]) { return anchorMemo[zk]; }
    var B = BM();
    if (!B) { return null; }
    if (zk === 'home') { anchorMemo[zk] = { key: '0_0', x: 0, y: 0 }; return anchorMemo[zk]; }
    var best = null, bd = Infinity, i, j;
    for (j = -4; j <= 4; j++) {
      for (i = -4; i <= 4; i++) {
        var c = B.cellAt(i, j);
        if (!c || c.zone !== zk) { continue; }
        var d = Math.hypot(c.x, c.y);
        if (d < bd - 1e-6) { bd = d; best = c; }
      }
    }
    if (best) { anchorMemo[zk] = { key: best.key, x: best.x, y: best.y }; }
    return anchorMemo[zk] || null;
  }
  function at(zk, off) {
    var a = anchorOf(zk);
    return a ? { x: a.x + (off ? off[0] : 0), y: a.y + (off ? off[1] : 0) } : null;
  }
  function followIdx() { var L = CHAPTERS[3].steps; for (var i = 0; i < L.length; i++) { if (L[i].type === 'follow') { return i; } } return -1; }
  /** 나그네 자리 — 4장 단계 si 기준: 따라가기 앞이면 다리목, 따라가는 중이면 걷는 자리, 지나면 길 끝 */
  function wandererAt(si) {
    var fi = followIdx();
    if (si === fi && fol) { return { x: fol.x, y: fol.y }; }
    return at('home', si > fi ? WANDER_PATH[WANDER_PATH.length - 1] : WANDER_PATH[0]);
  }
  var peakMemo = null;
  /** ⑲-14 봉우리 — ⑰ 정상 가운데 고향 북쪽(y<0)에서 가장 가까운 것(없으면 가장 가까운 것). 같은 세계면 늘 같다 */
  function peakSpot() {
    if (peakMemo) { return peakMemo; }
    var LF = global.DG.landform, L = LF && LF.on && LF.on() && LF.peaks ? LF.peaks(0, 0) : [], i;
    for (i = 0; i < L.length && !peakMemo; i++) { if (L[i].y < 0) { peakMemo = L[i]; } }
    if (!peakMemo && L.length) { peakMemo = L[0]; }
    return peakMemo;
  }
  /** ⑲-16 뭍인가 — 지형 칸이 물이 아니고 강(여울 빼고) 위가 아니다. 지형을 모르면 뭍 */
  function landAt(x, y) {
    var W = global.DG.world, LF = global.DG.landform, k = null;
    if (W && W.terrainAt) { try { k = W.terrainAt(Math.floor(x / TERR_TILE), Math.floor(y / TERR_TILE)); } catch (e) { k = null; } }
    if (k === 'water') { return false; }
    var rv = LF && LF.on && LF.on() && LF.riverAt ? LF.riverAt(x, y) : null;
    return !(rv && !rv.ford);
  }
  /** (x,y) 둘레 r m 에 n 자리(북쪽부터 시계 방향, +y 가 남쪽) */
  function ringAt(x, y, r, n) {
    var out = [];
    for (var i = 0; i < n; i++) { var a = i * Math.PI * 2 / n; out.push({ x: x + Math.sin(a) * r, y: y - Math.cos(a) * r }); }
    return out;
  }
  function allLand(L) { for (var i = 0; i < L.length; i++) { if (!landAt(L[i].x, L[i].y)) { return false; } } return true; }
  var capeMemo = null;
  /** ⑲-16 곶 — 넷째 제단 자리. 같은 세계면 늘 같다 */
  function capeSpot() {
    if (capeMemo) { return capeMemo; }
    var a = anchorOf(CAPE_ZONE), fm = at(NPCS.ferryman.zone, NPCS.ferryman.off), first = null, best = null, i, k;
    if (!a) { return null; }
    for (i = 0; i < CAPE_RADII.length && !best; i++) {
      for (k = 0; k < 8 && !best; k++) {
        var q = ringAt(a.x, a.y, CAPE_RADII[i], 8)[k];
        if (fm && Math.hypot(q.x - fm.x, q.y - fm.y) <= CAPE_CLEAR) { continue; }
        if (!landAt(q.x, q.y) || !allLand(ringAt(q.x, q.y, DEFEND_RING, DEFEND_SLOTS))) { continue; }
        if (!first) { first = q; }
        if (!allLand(ringAt(q.x, q.y, CAPE_SHORE, 8))) { best = q; }       // 둘레에 물 — 곶답다
      }
    }
    capeMemo = best || first || { x: a.x, y: a.y - CAPE_RADII[0] };
    return capeMemo;
  }
  var isleMemo = null;
  function terrAt(tx, ty) { var W = global.DG.world; try { return W && W.terrainAt ? W.terrainAt(tx, ty) : null; } catch (e) { return null; } }
  /** ⑲-19 칸 (tx,ty) 이웃 여덟 중 물 칸 수 */
  function wetNeighbors(tx, ty) {
    var n = 0;
    for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { if ((dx || dy) && terrAt(tx + dx, ty + dy) === 'water') { n++; } } }
    return n;
  }
  /** ⑲-19 바위섬 — 곶 둘레 ISLE_R 칸 안 뭍 칸 가운데 이웃 물이 가장 많은 것(같으면 곶에 가까운 것)의 가운데. 같은 세계면 늘 같다 */
  function isleSpot() {
    if (isleMemo) { return isleMemo; }
    var c = capeSpot();
    if (!c) { return null; }
    var cx = Math.floor(c.x / TERR_TILE), cy = Math.floor(c.y / TERR_TILE), best = null, tx, ty;
    for (ty = cy - ISLE_R; ty <= cy + ISLE_R; ty++) {
      for (tx = cx - ISLE_R; tx <= cx + ISLE_R; tx++) {
        var k = terrAt(tx, ty);
        if (k === 'water' || k === null) { continue; }
        var q = { x: (tx + 0.5) * TERR_TILE, y: (ty + 0.5) * TERR_TILE, wet: wetNeighbors(tx, ty) };
        q.d = Math.hypot(q.x - c.x, q.y - c.y);
        if (!landAt(q.x, q.y)) { continue; }
        if (!best || q.wet > best.wet || (q.wet === best.wet && q.d < best.d - 1e-6)) { best = q; }
      }
    }
    isleMemo = best ? { x: best.x, y: best.y, wet: best.wet } : { x: c.x, y: c.y, wet: 0 };
    return isleMemo;
  }
  /** 이름 붙은 자리 + off */
  function spotPos(name, off) {
    var SKI = global.DG.skyIsle;
    var ES = global.DG.eraSites;
    var sp = SPOTS[name], b = !sp ? null : sp.era ? (ES ? ES.spot(sp.era) : null) : (sp.frost ? frostSpot(sp.frost) : (sp.peak ? peakSpot() : (sp.cape ? capeSpot() : (sp.isle ? isleSpot() :
      (sp.sky ? (SKI ? SKI.spot() : null) : at(sp.zone, sp.off))))));
    return b ? { x: b.x + (off ? off[0] : 0), y: b.y + (off ? off[1] : 0) } : null;
  }
  /** ⑲-28 서리봉 고원 자리 — 'center'(가운데 탑) 또는 frost 명소 id. 고원이 꺼져 있으면 null */
  function frostSpot(id) {
    var FR = global.DG.frost;
    if (!FR || !FR.on()) { return null; }
    return id === 'center' ? FR.center() : FR.siteById(id);
  }
  /** 인물의 제자리 — 이름 붙은 자리(spot, ⑲-28) 또는 ⑮ 땅 탑 + off */
  function homeOf(n) { return n.spot ? spotPos(n.spot, n.off) : at(n.zone, n.off); }
  /** 단계의 자리 — 이름 붙은 자리(spot) 또는 ⑮ 땅 탑 + off */
  function posOf(st) { return st.spot ? spotPos(st.spot, st.off) : at(st.zone, st.off); }
  /** 인물 k 의 (ch, si) 칸 — appear·at 에서 그 장 그 단계를 덮는 것. ⑲-21 wq 칸은 그 세계 임무 단계(wq 를 주면 si, 아니면 지금) */
  function placeOf(k, ch, si, wq) {
    var n = NPCS[k], L = n ? (n.appear || n.at || []) : [];
    for (var i = 0; i < L.length; i++) {
      var e = L[i];
      if (e.wq) {
        var ws = wq === e.wq ? si : wqStepOf(e.wq);
        if (ws !== null && ws >= e.from && ws <= e.to) { return e; }
      } else if (e.ch === ch && si >= e.from && si <= e.to) { return e; }
    }
    return null;
  }
  /** 인물 k 의 지금(또는 그 장 그 단계) 이름·혼잣말·가면·층 — 칸이 덮으면 그것(⑲-20 가면 벗은 해솔) */
  function npcInfo(k, ch, si, wq) {
    var n = NPCS[k];
    if (typeof ch !== 'number') { ch = sv().ch; si = sv().step; }
    var pl = n ? placeOf(k, ch, si, wq) : null;
    return n ? { name: (pl && pl.name) || n.name, idle: (pl && pl.idle) || n.idle, mask: pl && pl.mask !== undefined ? pl.mask : (n.mask || false),
      sky: !!(pl && pl.sky) } : null;
  }
  /** 단계가 구름섬 층인가 — 단계 칸 sky 또는 대화 상대가 섬 위(⑲-20) */
  function skyOf(st) {
    if (!st) { return false; }
    if (st.sky) { return true; }
    if (!isTalk(st)) { return false; }
    var sa = stepAt(st), inf = npcInfo(st.npc, sa.c, sa.i, sa.wq);
    return !!(inf && inf.sky);
  }
  /** 인물 k 가 지금 서 있나 — appear 가 없으면 늘 */
  function visible(k) {
    var n = NPCS[k], s = sv();
    if (!n) { return false; }
    if (!n.appear) { return true; }
    var pl = placeOf(k, s.ch, s.step);
    return !!pl && (!!pl.wq || !locked());
  }
  /** 인물 자리 — (ch, si)를 주면 그 장 그 단계 기준(목표 계산용), 안 주면 지금 기준 */
  function npcPos(k, ch, si, wq) {
    var n = NPCS[k];
    if (!n) { return null; }
    if (typeof ch !== 'number') { ch = sv().ch; si = sv().step; }
    if (k === 'wanderer' && ch === 3) { return wandererAt(si); }
    if (n.runPath) { return thiefAt(k); }                           // ⑲-19·21 달리는 자리
    var fst = !wq && CHAPTERS[ch] ? CHAPTERS[ch].steps[si] : null;  // ⑲-28 길(path) 따라가기 — 걷는 자리, 아니면 길 첫 점
    if (fst && fst.type === 'follow' && fst.npc === k && fst.path) {
      if (fol && fol.key === 'sq:' + ch + '_' + si) { return { x: fol.x, y: fol.y }; }
      var fp = followPts(fst);
      return fp ? fp[0] : null;
    }
    var pl = placeOf(k, ch, si, wq);
    return pl && pl.spot ? spotPos(pl.spot, pl.off) : homeOf(n);
  }
  function altarPos() {
    var DM = global.DG.domain, L = DM && DM.list ? DM.list() : [];
    for (var i = 0; i < L.length; i++) { if (L[i].kind === 'weekly') { return { x: L[i].x, y: L[i].y, id: L[i].id }; } }
    return null;
  }
  function cellOf(zk) {
    var a = anchorOf(zk), B = BM();
    return a && B ? B.cellAt.apply(null, a.key.split('_').map(Number)) : null;
  }
  /** 단계가 몇째 장 몇째 단계인가 — { c, i } · ⑲-21 세계 임무 단계면 { c: -1, i, wq } */
  function stepAt(st) {
    for (var c = 0; c < CHAPTERS.length; c++) { var i = CHAPTERS[c].steps.indexOf(st); if (i >= 0) { return { c: c, i: i }; } }
    if (WQD) { for (var q in WQD.QUESTS) { var j = WQD.QUESTS[q].steps.indexOf(st); if (j >= 0) { return { c: -1, i: j, wq: q }; } } }
    return { c: -1, i: -1 };
  }
  /* gather·cook 목표는 둘레를 훑어야 해 칸(10m)·센 수가 같으면 다시 쓴다 */
  var aimMemo = { k: '', v: null };
  function gatherAim(st) {
    var p = pos(), C = CK(), mk = 'g' + st.item + ':' + Math.round(p.x / 10) + ',' + Math.round(p.y / 10) + ':' + (prog.n || 0);
    if (aimMemo.k === mk) { return aimMemo.v; }
    var best = null, bd = Infinity, L = C && C.near ? C.near(p.x, p.y, GATHER_R) : [], i;
    for (i = 0; i < L.length; i++) {
      if (L[i].item !== st.item || !C.available(L[i])) { continue; }
      var d = Math.hypot(L[i].x - p.x, L[i].y - p.y);
      if (d < bd) { bd = d; best = L[i]; }
    }
    aimMemo = { k: mk, v: best ? { x: best.x, y: best.y } : at('home', [0, 0]) };
    return aimMemo.v;
  }
  function potAim() {
    var p = pos(), C = CK(), mk = 'p:' + Math.round(p.x / 10) + ',' + Math.round(p.y / 10);
    if (aimMemo.k === mk) { return aimMemo.v; }
    var L = C && C.potsNear ? C.potsNear(p.x, p.y, POT_R) : [];
    aimMemo = { k: mk, v: L.length ? { x: L[0].x, y: L[0].y } : at('home', [0, 0]) };
    return aimMemo.v;
  }
  /** 대화로 끝나는 단계 — talk · sail(⑲-19, 대화 뒤 배) */
  function isTalk(st) { return !!st && (st.type === 'talk' || st.type === 'sail'); }
  /** 단계의 목표 자리 — { x, y, r?, label }. 세계 표·세이브만 읽는다 */
  function targetOf(st) {
    if (!st) { return null; }
    if (isTalk(st) || st.type === 'follow' || st.type === 'chase') {
      var sa = stepAt(st), p = npcPos(st.npc, sa.c, sa.i, sa.wq);
      return p ? { x: p.x, y: p.y, r: isTalk(st) ? TALK_R() : 0, label: isTalk(st) ? npcInfo(st.npc, sa.c, sa.i, sa.wq).name : st.text } : null;
    }
    if (st.type === 'sky' && st.pad) {                       // ⑲-35 시간 기둥(era-sites)
      var ESt = global.DG.eraSites, dg = ESt ? ESt.spot('draft') : null;
      return dg ? { x: dg.x, y: dg.y, r: ESt.DRAFT_R, label: st.text } : null;
    }
    if (st.type === 'sky') {                                 // ⑲-20 바람 기둥 = 봉우리 정상
      var SKt = global.DG.skyIsle, pk = SKt ? SKt.peak() : null;
      return pk ? { x: pk.x, y: pk.y, r: SKt.DRAFT_R, label: st.text } : null;
    }
    if (st.type === 'go' || st.type === 'climb') {
      var g = st.altar ? altarPos() : posOf(st);
      return g ? { x: g.x, y: g.y, r: st.type === 'climb' ? CLIMB_R() : GO_R(), label: st.text } : null;
    }
    if (st.type === 'boss') {
      var F = FC(), gd = F ? F.guardianAt(cellOf(st.zone)) : null;
      return gd ? { x: gd.x, y: gd.y, r: 0, label: st.text, rk: gd.region } : null;
    }
    if (st.type === 'domain') {
      var DM = global.DG.domain, al = st.did ? (DM && DM.byId ? DM.byId(st.did) : null) : altarPos();
      return al ? { x: al.x, y: al.y, r: 0, label: st.text } : null;
    }
    if (st.type === 'gather') { var ga = gatherAim(st); return ga ? { x: ga.x, y: ga.y, r: 0, label: st.text } : null; }
    if (st.type === 'cook') { var pa = potAim(); return pa ? { x: pa.x, y: pa.y, r: 0, label: st.text } : null; }
    var q = posOf(st);                                       // kill · light · seal · duel · defend
    return q ? { x: q.x, y: q.y, r: st.type === 'light' ? LIGHT_R() : (st.type === 'seal' ? SEAL_R : (st.type === 'defend' ? DEFEND_START() : 0)), label: st.text } : null;
  }
  /** ⑲-14 석등 셋의 자리 — [{k, x, y}], 북쪽부터 시계 방향 SEAL_LAYOUT(+y 가 남쪽) */
  function sealLamps(st) {
    var c = posOf(st);
    if (!c) { return []; }
    return SEAL_LAYOUT.map(function (k, i) { var a = i * Math.PI * 2 / 3; return { k: k, x: c.x + Math.sin(a) * SEAL_R, y: c.y - Math.cos(a) * SEAL_R }; });
  }
  /**
   * 석등 차례 판정(순수) — 켠 수 n, 이번에 닿은 석등 키들, 차례 → 새 n.
   * 다음 차례가 닿으면 그것 하나만 켜진다(해방이 셋에 다 닿아도). 다음 차례가 아닌 꺼진 것만 닿으면 다 꺼진다(0). 켜진 것만 닿으면 그대로
   */
  function sealHit(n, hits, order) {
    order = order || SEAL_ORDER;
    if (n >= order.length || !hits || !hits.length) { return n; }
    if (hits.indexOf(order[n]) >= 0) { return n + 1; }
    var lit = order.slice(0, n);
    for (var i = 0; i < hits.length; i++) { if (lit.indexOf(hits[i]) < 0) { return 0; } }
    return n;
  }

  /* ── 세이브 ───────────────────────────────────────────── */

  function sv() {
    var s = core().save;
    if (!s.story || typeof s.story !== 'object') { s.story = { ch: 0, step: 0 }; }
    if (typeof s.story.ch !== 'number') { s.story.ch = 0; }
    if (typeof s.story.step !== 'number') { s.story.step = 0; }
    return s.story;
  }
  function chapter() { var c = sv().ch; return c < CHAPTERS.length ? CHAPTERS[c] : null; }
  function locked() { var ch = chapter(); return !!ch && (core().save.player.level || 1) < ch.ar; }
  /** 이야기의 지금 단계 — 다 끝났거나 장이 잠겼으면 null */
  function storyStep() { var ch = chapter(); return ch && !locked() ? ch.steps[sv().step] || null : null; }
  /** 지금 단계 — **따라가는 줄**의 것(⑲-21 세계 임무를 따라가면 그 임무, 아니면 이야기) */
  function step() { var tq = tracking(); return tq ? wqDef(tq).steps[wqs().steps[tq]] || null : storyStep(); }
  function done() { return sv().ch >= CHAPTERS.length; }
  function pos() { return core().save.player.pos; }
  function keyOf() { var tq = tracking(); return tq ? 'wq:' + tq + '_' + wqs().steps[tq] : 'sq:' + sv().ch + '_' + sv().step; }

  /* ── 세계 임무(⑲-21) — 표는 worldquest.js ──────────────── */

  function wqs() {
    var s = core().save;
    if (!s.wq || typeof s.wq !== 'object') { s.wq = { steps: {}, done: [], track: null }; }
    if (!s.wq.steps || typeof s.wq.steps !== 'object') { s.wq.steps = {}; }
    if (!Array.isArray(s.wq.done)) { s.wq.done = []; }
    if (s.wq.track === undefined) { s.wq.track = null; }
    return s.wq;
  }
  function wqDef(id) { return (WQD && WQD.QUESTS[id]) || null; }
  function wqStepOf(id) { var w = wqs(); return typeof w.steps[id] === 'number' ? w.steps[id] : null; }
  /** 따라가는 세계 임무 id — 없으면(이야기를 따라간다) null */
  function tracking() { var w = wqs(), id = w.track; return id && wqDef(id) && typeof w.steps[id] === 'number' ? id : null; }
  /** 맡을 수 있나 — 안 맡았고·안 끝났고·여정 등급이 닿는다 */
  function wqAvail(id) {
    var q = wqDef(id), w = wqs();
    return !!q && w.done.indexOf(id) < 0 && typeof w.steps[id] !== 'number' && (core().save.player.level || 1) >= q.ar;
  }
  /** 따라가는 줄의 임무 적·제단 물결을 치운다(바꾸면 그 단계 처음부터) */
  function dropLine() { var k = keyOf(); dropCamp(k); dropCamp(k + ':add'); for (var n = 0; n < 3; n++) { dropCamp(k + ':w' + n); } }
  /** 따라갈 줄 — 맡은 세계 임무 id 또는 null(이야기). 바뀌면 true */
  function setTrack(id) {
    var w = wqs();
    id = id && wqDef(id) && typeof w.steps[id] === 'number' ? id : null;
    if ((w.track || null) === id) { return false; }
    dropLine();
    w.track = id;
    resetStep();
    toast(id ? '🔷 따라가는 임무 — ' + wqDef(id).name : '📖 이야기 임무를 따라간다');
    core().emit('story:step', { track: id });
    core().emit('changed');
    core().persist();
    return true;
  }
  /** 맡기 — 첫 단계부터, 곧 따라가는 임무가 된다 */
  function wqStart(id) {
    if (!wqAvail(id)) { return false; }
    wqs().steps[id] = 0;
    toast('🔷 세계 임무 — ' + wqDef(id).name + ' 을 맡았다');
    core().log('🔷 세계 임무 — ' + wqDef(id).name, 'good');
    if (!setTrack(id)) { core().persist(); }
    return true;
  }
  /** 세계 임무 한 단계 — 단계마다 부대 경험 STEP_EXP, 끝나면 보상·이야기로 돌아간다 */
  function wqAdvance(id) {
    var w = wqs(), q = wqDef(id), H = global.DG.hero;
    if (H && H.awardParty) { H.awardParty(WQD.STEP_EXP); }
    w.steps[id] += 1;
    resetStep();
    if (w.steps[id] >= q.steps.length) {
      var txt = award(q.reward);
      delete w.steps[id];
      if (w.done.indexOf(id) < 0) { w.done.push(id); }
      w.track = null;
      toast('🔷 ' + q.name + ' 끝 — ' + txt);
      core().log('🔷 ' + q.name + ' 끝 — ' + txt, 'good');
      sfx('reward');
    } else {
      toast('🔷 ' + q.steps[w.steps[id]].text);
    }
    core().emit('story:step', { wq: id, step: w.steps[id] === undefined ? -1 : w.steps[id] });
    core().emit('changed');
    core().persist();
    return true;
  }
  /** 머리 위 푸른 ! — 맡을 수 있는 임무의 맡길 사람 · 맡았지만 안 따라가는 임무의 다음 대화 상대. [{k, x, y, id, fresh}] */
  function wqMarks() {
    var out = [], w = wqs(), tq = tracking();
    if (!WQD) { return out; }
    WQD.ORDER.forEach(function (id) {
      var q = wqDef(id), st = null, fresh = wqAvail(id);
      if (fresh) { st = q.steps[0]; } else if (typeof w.steps[id] === 'number' && id !== tq) { st = q.steps[w.steps[id]]; }
      if (!isTalk(st) || !visible(st.npc)) { return; }
      var sa = stepAt(st), np = npcPos(st.npc, sa.c, sa.i, sa.wq);
      if (np) { out.push({ k: st.npc, x: np.x, y: np.y, id: id, fresh: fresh }); }
    });
    return out;
  }
  /** ⑲-23 탑을 찾은 지역인가 — 빈 마름모·! 는 찾은 지역에만(고향은 늘 찾음) */
  function revealed(x, y) { var B = BM(); return !B || B.found(B.regionAt(x, y).cell.key); }
  /**
   * ⑲-23 지도 임무 표식 — [{ kind, tone, id, x, y, name, text }]. 세이브·표만 읽는다.
   * kind 'track' 따라가는 임무(찬 마름모) · 'idle' 맡았지만 안 따라가는 임무(빈 마름모, 그 단계 자리) · 'avail' 맡을 수 있는 세계 임무(!)
   * tone 'story'(금빛) · 'wq'(푸른빛). id = 세계 임무 id, 이야기는 null. 따라가는 것 말고는 못 찾은 지역에 안 낸다
   */
  function mapMarks() {
    var out = [];
    if (!on()) { return out; }
    var tq = tracking(), w = wqs();
    function put(kind, tone, id, st, name) {
      var t = st ? targetOf(st) : null;
      if (!t || (kind !== 'track' && !revealed(t.x, t.y))) { return; }
      out.push({ kind: kind, tone: tone, id: id, x: t.x, y: t.y, name: name, text: st.text });
    }
    var ss = storyStep();
    if (ss) { put(tq ? 'idle' : 'track', 'story', null, ss, chapter().name); }
    if (WQD) {
      WQD.ORDER.forEach(function (id) {
        var q = wqDef(id);
        if (typeof w.steps[id] === 'number') { put(id === tq ? 'track' : 'idle', 'wq', id, q.steps[w.steps[id]], q.name); }
        else if (wqAvail(id)) { put('avail', 'wq', id, q.steps[0], q.name); }
      });
    }
    return out;
  }

  /* ── 나아가기 ─────────────────────────────────────────── */

  function toast(msg) { core().emit('toast', msg); }
  function sfx(n) { if (global.DG.audio) { try { global.DG.audio.play(n); } catch (e) { /* 소리는 없어도 된다 */ } } }
  function award(r) {
    var c = core(), TL = global.DG.talent, H = global.DG.hero, out = [];
    if (r.gold) { c.save.player.gold = (c.save.player.gold || 0) + r.gold; out.push('🪙 ' + r.gold); }
    if (TL && TL.mats) {
      var m = TL.mats();
      ['knot', 'guide', 'secret'].forEach(function (k) { if (r[k]) { m[k] = (m[k] || 0) + r[k]; out.push(TL.MATS[k].icon + ' ' + TL.MATS[k].name + ' ' + r[k]); } });
    }
    if (r.party && H && H.awardParty) { H.awardParty(r.party); out.push('부대 경험 ' + r.party); }
    return out.join(' · ');
  }
  /** 단계마다 저장 안 하는 것(센 수·따라가기·석등·보스·제단·쫓기)을 비운다 */
  function resetStep() { prog = { key: '', n: 0 }; fol = null; seal = { key: '', n: 0 }; duel = null; def = null; chase = null; }
  /** 지금 단계를 끝낸다 — 장 끝이면 보상과 함께 다음 장으로. ⑲-21 세계 임무를 따라가면 그 임무가 나아간다 */
  function advance() {
    var tq = tracking();
    if (tq) { return wqAdvance(tq); }
    var s = sv(), ch = chapter(), H = global.DG.hero;
    if (!ch) { return false; }
    if (H && H.awardParty) { H.awardParty(STEP_EXP); }
    s.step += 1;
    resetStep();
    if (s.step >= ch.steps.length) {
      var txt = award(ch.reward);
      s.ch += 1; s.step = 0;
      toast('📖 ' + ch.name + ' 끝 — ' + txt);
      core().log('📖 ' + ch.name + ' 끝 — ' + txt, 'good');
      sfx('reward');
      if (ch.join) { join(ch.join, false); }                          // ⑲-15 이야기 동료
    } else {
      var nx = ch.steps[s.step];
      toast('📖 ' + nx.text);
    }
    core().emit('story:step', { ch: s.ch, step: s.step });
    core().emit('changed');
    core().persist();
    return true;
  }

  /* ── 이야기 동료(⑲-15) ────────────────────────────────── */

  function hasMember(id) { var d = core().save.dex; return !!(d && d.heroes && d.heroes[id]); }
  /**
   * 동료가 된다 — 도감 기록·성장 기록, 동행에 빈자리가 있으면 채운다. 이미 있으면 아무것도 안 한다.
   * quiet 면 알림 없이(이 기능 전에 그 장을 끝낸 세이브) — 기록 한 줄만
   */
  function join(id, quiet) {
    var c = core(), m = MEMBERS[id];
    if (!m || hasMember(id)) { return false; }
    if (!c.save.dex) { c.save.dex = { heroes: {}, pets: {} }; }
    if (!c.save.dex.heroes) { c.save.dex.heroes = {}; }
    c.save.dex.heroes[id] = { count: 1, firstAt: Date.now() };
    if (global.DG.hero && global.DG.hero.ensure) { global.DG.hero.ensure(id); }
    if (!Array.isArray(c.save.party)) { c.save.party = []; }
    var FM = global.DG.formation, room = c.save.party.length < (FM ? FM.MAX : 5);
    if (room) { c.save.party.push(id); }
    var msg = '🤝 ' + m.name + ' — 이야기 동료가 됐다' + (room ? ' · 동행에 들어왔다' : ' · 동행이 꽉 찼다 — 도감 탭에서 편성');
    c.log(msg, 'good');
    if (!quiet) { toast(msg); }                                     // dex:new 는 안 쏜다 — '도감 신규 등록' 알림이 뜨면 도감 인물로 읽힌다
    c.emit('changed');
    return true;
  }
  /** 지난 장의 동료가 빠졌으면 조용히 들인다(두 번 불러도 한 명) */
  function catchUp() {
    var s = sv(), n = 0;
    for (var c = 0; c < Math.min(s.ch, CHAPTERS.length); c++) {
      if (CHAPTERS[c].join && join(CHAPTERS[c].join, true)) { n++; }
    }
    if (n) { core().persist(); }
    return n;
  }

  /* ── 신호로 끝나는 단계 ───────────────────────────────── */

  function onGuard(e) { var st = step(), t = st && st.type === 'boss' ? targetOf(st) : null; if (t && e && e.region === t.rk) { advance(); } }
  function onClear(e) {
    var st = step();
    if (st && st.type === 'defend' && e && typeof e.camp === 'string' && e.camp.indexOf(keyOf() + ':w') === 0) {
      defState().clr[+e.camp.slice(keyOf().length + 2)] = true;     // 마지막 물결까지 다 잡았는지는 stepDefend 가 본다
      return;
    }
    if (!st || (st.type !== 'kill' && st.type !== 'duel') || !e || e.camp !== keyOf()) { return; }
    if (st.type === 'duel') { dropAdds(); toast(st.win || '🎭 검은 가면이 먹구름 속으로 달아났다 — 졸개도 흩어진다'); }
    advance();
  }
  function onElement(e) {
    var st = step();
    if (!st || !e) { return; }
    if (st.type === 'seal') { onSeal(st, e); return; }
    if (st.type !== 'light') { return; }
    var t = targetOf(st);
    if (t && Math.hypot(e.x - t.x, e.y - t.y) <= (e.r || 3) + LIGHT_R()) { toast('🔥 옛 제단에 불이 붙었다 — 비문이 빛난다'); advance(); }
  }
  /* ⑲-14 석등 차례 — 켠 수는 저장 안 함 */
  var seal = { key: '', n: 0 };
  function sealLit() { return seal.key === keyOf() ? seal.n : 0; }
  function orderText(st) { return (st.order || SEAL_ORDER).map(function (k) { return SEAL_MARKS[k].name; }).join(' → '); }
  function onSeal(st, e) {
    var hits = sealLamps(st).filter(function (l) { return Math.hypot(e.x - l.x, e.y - l.y) <= (e.r || 3) + LIGHT_R(); }).map(function (l) { return l.k; });
    if (!hits.length) { return; }
    var order = st.order || SEAL_ORDER, was = sealLit(), n = sealHit(was, hits, order);
    seal = { key: keyOf(), n: n };
    if (n > was) {
      toast('🏮 ' + SEAL_MARKS[order[n - 1]].name + ' 석등이 켜졌다 (' + n + '/' + order.length + ')');
      if (n >= order.length) { toast('✨ 석등 셋이 다 켜졌다 — 봉인이 풀린다'); advance(); }
    } else if (n === 0 && was > 0) {
      toast('💨 차례가 틀렸다 — 석등이 모두 꺼졌다 (' + orderText(st) + ')');
    } else if (n === 0) {
      toast('💨 불이 붙지 않는다 — 비문 차례는 ' + orderText(st));
    }
  }
  /* ⑲-14 이야기 보스 — 2단계(방패·졸개) 여부. 저장 안 함 */
  var duel = null;          // { key, p2 }
  function addKey() { return keyOf() + ':add'; }
  /** 무리 하나를 통째로 치운다(흩어짐) */
  function dropCamp(key) {
    var F = FC(), S = F && F.state ? F.state() : null, cp = S ? S.camps[key] : null;
    if (!cp) { return; }
    cp.uids.forEach(function (u) { delete S.foes[u]; });
    delete S.camps[key];
    delete S.cleared[key];
  }
  function dropAdds() { dropCamp(addKey()); }
  /** 보스 한 박자 — 절반에서 뇌 방패 + 졸개 둘, 전멸해 되돌아가 다시 온전해지면 처음으로 */
  function duelBoss() {
    var F = FC(), S = F && F.state ? F.state() : null, cp = S ? S.camps[keyOf()] : null;
    return cp ? S.foes[cp.uids[0]] || null : null;
  }
  /** 2단계 방패 원소·졸개는 단계 칸(shield·adds, ⑲-16) — 없으면 6장 값 */
  function stepDuel() {
    var F = FC(), S = F && F.state ? F.state() : null, b = duelBoss(), st = step() || {};
    if (!b || b.dead) { return; }
    if (!duel || duel.key !== keyOf()) { duel = { key: keyOf(), p2: false }; }
    if (!duel.p2 && b.hp <= b.hpMax * DUEL_P2_AT) {
      var shEl = st.shield || 'elec';
      duel.p2 = true;
      b.layers = [shEl]; b.layer = 0; b.shEl = shEl;
      b.shieldMax = b.shield = Math.round(b.hpMax * DUEL_P2_SHIELD);
      F.spawnCamp(S, { key: addKey(), x: b.x, y: b.y, tier: b.tier, kind: 'story', sky: !!st.sky,
        foes: (st.adds || DUEL_ADDS).map(function (k, i) { return { kind: k, dx: i ? 3 : -3, dy: 2 }; }) });
      S.camps[addKey()].uids.forEach(function (u) { S.foes[u].st = 'chase'; });
      toast(st.p2 || '⛈️ 검은 가면이 먹구름을 둘렀다 — 불로 깨라! 가면 졸개가 뛰어든다');
    } else if (duel.p2 && b.st === 'idle' && b.hp >= b.hpMax) {
      duel.p2 = false;
      b.layers = []; b.layer = 0; b.shEl = null; b.shield = b.shieldMax = 0;
      dropAdds();
    }
  }
  /* ⑲-16 제단 지키기 — 제단 체력·물결은 저장 안 함(불러오면 그 단계 처음) */
  var def = null;           // { key, wave(-1 = 아직), t(이 물결 뒤 초), rest(쉬는 틈 초), hp, hpMax, warned, clr{물결: 다 잡음} }
  function defState() {
    if (!def || def.key !== keyOf()) { def = { key: keyOf(), wave: -1, t: 0, rest: 0, hp: 0, hpMax: 0, warned: false, clr: {} }; }
    return def;
  }
  function waveKey(n) { return keyOf() + ':w' + n; }
  function wavesOf(st) { return st.waves || DEFEND_WAVES; }
  /** 무리가 나오는 제단 기준 자리(dx, dy) — 단계 dirs(도, 북 0 시계 방향, ⑲-29)가 있으면 그 방향들만, 없으면 둘레 열두 자리 */
  function defendSlots(st) {
    if (!st.dirs) { return ringAt(0, 0, DEFEND_RING, DEFEND_SLOTS); }
    var ESd = global.DG.eraSites, dirs = st.dirs === 'land' ? (ESd ? ESd.landDirs() : [90, 135, 180, 225, 270]) : st.dirs;   // ⑲-34 바다 쪽 빼고
    return dirs.map(function (g) { var a = g * Math.PI / 180; return { x: Math.sin(a) * DEFEND_RING, y: -Math.cos(a) * DEFEND_RING }; });
  }
  function altarHpMax(c) { var F = FC(); return Math.round(DEFEND_HITS * (F && F.foeAtk ? F.foeAtk('boar', F.tierAt(c.x, c.y)) : 80)); }
  /** 물결 n — 둘레 열두 자리 중 4n 째부터, 처음부터 제단으로 곧장(siege) */
  function spawnWave(st, n) {
    var F = FC(), S = F && F.state ? F.state() : null, c = posOf(st), d = defState(), ks = wavesOf(st)[n];
    if (!S || !c || !ks) { return false; }
    var slots = defendSlots(st);
    F.spawnCamp(S, { key: waveKey(n), x: c.x, y: c.y, tier: F.tierAt(c.x, c.y), kind: 'story',
      foes: ks.map(function (k, i) { var q = slots[(n * 4 + i) % slots.length]; return { kind: k, dx: q.x, dy: q.y }; }) });
    S.camps[waveKey(n)].uids.forEach(function (u) { S.foes[u].siege = { x: c.x, y: c.y }; S.foes[u].st = 'chase'; });
    d.wave = n; d.t = 0;
    toast('🌊 물결 ' + (n + 1) + '/' + wavesOf(st).length + ' — ' + (st.who || '가면 무리가') + ' ' + (st.name || '제단') + '으로 몰려온다');
    return true;
  }
  /** 무너짐·전멸 — 무리가 흩어지고 DEFEND_REST 초 쉰 뒤 그 단계 처음부터 */
  function resetDefend(msg) {
    var st = step(), d = defState(), W = st ? wavesOf(st) : DEFEND_WAVES;
    for (var n = 0; n < W.length; n++) { dropCamp(waveKey(n)); }
    def = { key: keyOf(), wave: -1, t: 0, rest: DEFEND_REST, hp: d.hpMax, hpMax: d.hpMax, warned: false, clr: {} };
    toast(msg);
  }
  /** 한 박자 — 가까이 오면 첫 물결, 다 잡았거나 DEFEND_WAVE_SEC 초면 다음, 마지막까지 다 잡으면 다음 단계 */
  function stepDefend(dt) {
    var st = step();
    if (!st || st.type !== 'defend') { return null; }
    var F = FC(), S = F && F.state ? F.state() : null, c = posOf(st), d = defState(), W = wavesOf(st), p = pos();
    if (!S || !c) { return null; }
    if (!d.hpMax) { d.hpMax = d.hp = altarHpMax(c); }
    if (d.rest > 0) { d.rest = Math.max(0, d.rest - (dt || 0)); return d; }
    if (d.wave < 0) {
      if (Math.hypot(p.x - c.x, p.y - c.y) <= DEFEND_START()) { spawnWave(st, 0); }
      return d;
    }
    d.t += dt || 0;
    if (d.wave + 1 < W.length) {
      if (d.clr[d.wave] || d.t >= DEFEND_WAVE_SEC) { spawnWave(st, d.wave + 1); }
      return d;
    }
    for (var n = 0; n < W.length; n++) { if (!d.clr[n]) { return d; } }
    toast('🛡️ ' + (st.name || '제단') + '을 지켜 냈다 — 무리가 물러간다');
    advance();
    return null;
  }
  function onSiege(e) {
    var st = step();
    if (!st || st.type !== 'defend' || !e || typeof e.camp !== 'string' || e.camp.indexOf(keyOf() + ':w') !== 0) { return; }
    var d = defState(), nm = st.name || '제단';
    if (!d.hpMax || d.rest > 0) { return; }
    d.hp = Math.max(0, d.hp - (e.dmg || 0));
    if (d.hp <= 0) { resetDefend('💥 ' + nm + '이 무너졌다 — 무리가 흩어진다. ' + DEFEND_REST + '초 뒤 처음부터'); return; }
    if (!d.warned && d.hp <= d.hpMax / 2) { d.warned = true; toast('⚠️ ' + nm + '이 흔들린다 — 절반이 깎였다!'); }
  }
  function onWipe() {
    var st = step();
    if (st && st.type === 'defend' && def && def.key === keyOf() && def.wave >= 0) { resetDefend('🏳️ 물러난 사이 무리가 흩어졌다 — ' + DEFEND_REST + '초 뒤 처음부터'); }
  }
  function onDomain(e) {
    var st = step();
    if (!st || st.type !== 'domain' || !e) { return; }
    if (st.did ? e.id === st.did : e.kind === 'weekly') { advance(); }
  }
  /* 채집 센 수 — 단계 키가 바뀌면 0 부터(저장 안 함) */
  var prog = { key: '', n: 0 };
  function gathered() { return prog.key === keyOf() ? prog.n : 0; }
  function onGather(e) {
    var st = step();
    if (!st || st.type !== 'gather' || !e || e.item !== st.item) { return; }
    if (prog.key !== keyOf()) { prog = { key: keyOf(), n: 0 }; }
    prog.n += 1;
    if (prog.n >= st.count) { advance(); } else { toast('📖 ' + st.text + ' ' + prog.n + '/' + st.count); }
  }
  function onCook() { var st = step(); if (st && st.type === 'cook') { advance(); } }

  /* ── 따라가기 ─────────────────────────────────────────── */

  var fol = null;           // { key, i(지난 길 점), x, y, walking } — 저장 안 함
  /** 따라가는 길 점 — 단계 path([이름 붙은 자리, off]…, ⑲-28)가 있으면 그것, 없으면 4장 나그네 길. 자리를 모르면 null */
  function followPts(st) {
    var L = st.path ? st.path.map(function (e) { return spotPos(e[0], e[1]); }) : WANDER_PATH.map(function (o) { return at('home', o); });
    for (var i = 0; i < L.length; i++) { if (!L[i]) { return null; } }
    return L;
  }
  function followState() {
    var st = step();
    if (!st || st.type !== 'follow') { fol = null; return null; }
    if (!fol || fol.key !== keyOf()) {
      var pts = followPts(st);
      if (!pts) { fol = null; return null; }
      fol = { key: keyOf(), i: 0, x: pts[0].x, y: pts[0].y, walking: false };
    }
    return fol;
  }
  /** 한 박자 — 내가 가까우면 단계 speed(없으면 FOLLOW_SPEED)로 다음 길 점까지 걷고, 멀면 선다. 길 끝이면 단계를 끝낸다 */
  function stepFollow(dt) {
    var fs = followState();
    if (!fs) { return null; }
    var st = step(), pts = followPts(st), p = pos();
    if (Math.hypot(p.x - fs.x, p.y - fs.y) > FOLLOW_NEAR()) { fs.walking = false; return fs; }
    var left = ((!gps() && st.speed) || FOLLOW_SPEED) * (dt || 0);   // GPS 판은 실제 걸음이라 늘 FOLLOW_SPEED
    while (left > 0 && fs.i < pts.length - 1) {
      var nx = pts[fs.i + 1], d = Math.hypot(nx.x - fs.x, nx.y - fs.y);
      if (d <= left) { fs.x = nx.x; fs.y = nx.y; fs.i += 1; left -= d; }
      else { fs.x += (nx.x - fs.x) / d * left; fs.y += (nx.y - fs.y) / d * left; left = 0; }
    }
    fs.walking = true;
    if (fs.i >= pts.length - 1) { fol = null; toast(st.arrive || '🎭 나그네가 걸음을 멈췄다'); advance(); return null; }
    return fs;
  }

  /* ── 도둑 쫓기(⑲-19) ─────────────────────────────────── */

  var chase = null;         // { key, npc, i(지난 길 점), x, y, run(달아나는 중), pause } — 저장 안 함
  /** ⑲-21 달리는 인물 k 의 길 점 i — 그 인물 땅(zone) 탑 기준 runPath(도둑은 THIEF_PATH) */
  function runAt(k, i) { var n = NPCS[k] || NPCS.thief; return at(n.zone, (n.runPath || THIEF_PATH)[i]); }
  function runLen(k) { var n = NPCS[k] || NPCS.thief; return (n.runPath || THIEF_PATH).length; }
  function chaseState() {
    var st = step();
    if (!st || st.type !== 'chase') { chase = null; return null; }
    if (!chase || chase.key !== keyOf()) {
      var p0 = runAt(st.npc, 0);
      chase = p0 ? { key: keyOf(), npc: st.npc, i: 0, x: p0.x, y: p0.y, run: false, pause: 0 } : null;
    }
    return chase;
  }
  /** 달리는 인물 자리(기본 노 도둑) — 쫓는 중이면 달리는 곳, 아니면 길 첫 점 */
  function thiefAt(k) {
    k = k || 'thief';
    return chase && chase.key === keyOf() && chase.npc === k ? { x: chase.x, y: chase.y } : runAt(k, 0);
  }
  /**
   * 한 박자 — 잡혔나 먼저 보고(CHASE_CATCH), 서 있으면 CHASE_START 안에 들 때 달아난다. 달아나는 중엔 CHASE_SPEED 로
   * 다음 점까지, 점에 닿으면 CHASE_PAUSE 초 숨 고르기. 길 끝이면 놓친 것 — 처음 자리로
   */
  function stepChase(dt) {
    var cs = chaseState();
    if (!cs) { return null; }
    var p = pos(), d = Math.hypot(p.x - cs.x, p.y - cs.y);
    var cst = step() || {};
    if (d <= CHASE_CATCH()) { chase = null; toast(cst.caught || '🏃 노 도둑을 붙잡았다 — 노를 되찾았다'); advance(); return null; }
    if (!cs.run) {
      if (d <= CHASE_START()) { cs.run = true; cs.pause = 0; toast(cst.flee || '🏃 도둑이 노를 메고 달아난다 — 달려라!'); }
      return cs;
    }
    if (cs.pause > 0) { cs.pause = Math.max(0, cs.pause - (dt || 0)); return cs; }
    var left = CHASE_SPEED() * (dt || 0);
    while (left > 0 && cs.i < runLen(cs.npc) - 1) {
      var nx = runAt(cs.npc, cs.i + 1), nd = Math.hypot(nx.x - cs.x, nx.y - cs.y);
      if (nd <= left) { cs.x = nx.x; cs.y = nx.y; cs.i += 1; cs.pause = CHASE_PAUSE(); left = 0; }
      else { cs.x += (nx.x - cs.x) / nd * left; cs.y += (nx.y - cs.y) / nd * left; left = 0; }
    }
    if (cs.i >= runLen(cs.npc) - 1) {
      var p0 = runAt(cs.npc, 0);
      cs.i = 0; cs.x = p0.x; cs.y = p0.y; cs.run = false; cs.pause = 0;
      toast(cst.lost || '💨 놓쳤다 — 도둑이 처음 자리로 숨어들었다. 다시 가까이 가면 달아난다');
    }
    return cs;
  }

  /* ── 배(⑲-19) ───────────────────────────────────────── */

  /** sail 대화가 끝났을 때 — 키보드 판은 그 자리로 옮긴다(순간이동과 같은 길). GPS 판은 몸이 거기 있어 안 옮긴다 */
  function sail(st) {
    var W = global.DG.world, q = spotPos(st.to, st.toOff);
    if (!q) { return false; }
    if (W && W.mode === 'keyboard') {
      var p = pos();
      p.x = q.x; p.y = q.y;
      if (W.walkTo) { W.walkTo(p.x, p.y); }
      core().emit('region:teleport', { key: 'sail:' + st.to });
      toast(st.to === 'isle' ? '⛵ 사공의 배가 물살을 가른다 — 바위섬에 닿았다' : '⛵ 배가 갈대 나루에 닿았다');
      return true;
    }
    toast('⛵ 사공이 배를 띄웠다 — 물가를 따라 ' + (st.to === 'isle' ? '바위섬으로' : '나루로') + ' 걸어가자');
    return false;
  }

  /** 한 박자 — go 도착·boss 이미 쓰러짐·kill 무리 세우기·혼잣말 */
  var lastIdle = {};
  function check() {
    if (!on()) { return; }
    var st = step(), p = pos(), t;
    if (st && st.type === 'go') {
      t = targetOf(st);
      if (t && Math.hypot(p.x - t.x, p.y - t.y) <= t.r) { advance(); return; }
    } else if (st && st.type === 'boss') {
      t = targetOf(st);
      var FB = global.DG.fieldBoss;
      if (t && FB && FB.bloomAt && FB.bloomAt(t.rk) !== null) { advance(); return; }   // 이미 쓰러져 꽃을 기다린다
    } else if (st && st.type === 'climb' && st.pole) {
      /* ⑲-34 기중기 — 키보드 판은 들보 위에 서야(landform 기둥 타기), GPS 판은 기중기 곁에 닿으면 */
      var LFp = global.DG.landform;
      t = targetOf(st);
      if (!gps() && LFp && LFp.perched && LFp.perched()) { toast('✨ 들보 위 — 박혀 있던 날개 조각을 빼냈다'); advance(); return; }
      if (gps() && t && Math.hypot(p.x - t.x, p.y - t.y) <= POLE_GPS_R) { toast('✨ 기중기 밑 — 다온이 걸어 둔 줄로 날개 조각을 끌어내렸다'); advance(); return; }
    } else if (st && st.type === 'climb') {
      t = targetOf(st);
      if (t && Math.hypot(p.x - t.x, p.y - t.y) <= t.r) { toast('⛰️ 봉우리 꼭대기에 올랐다'); advance(); return; }
    } else if (st && st.type === 'sky' && st.pad) {
      /* ⑲-35 키보드 판은 그 발판(관측대)에 내려서야, GPS 판은 시간 기둥 곁에 닿으면 */
      var SKo = global.DG.skyIsle, LFo = global.DG.landform, pdo;
      if (SKo && SKo.layerOn()) {
        pdo = LFo.onSky() ? SKo.padAt(p.x, p.y) : null;
        if (pdo && pdo.id === st.pad) { toast('🔭 떠 있는 관측대에 내려섰다 — 틈새 파수가 지키고 있다'); advance(); return; }
      } else {
        t = targetOf(st);
        if (t && Math.hypot(p.x - t.x, p.y - t.y) <= CLIMB_R()) { toast('⏳ 시간 기둥 곁에 닿았다 — 관측대 이야기는 이 둘레에서 이어진다'); advance(); return; }
      }
    } else if (st && st.type === 'sky') {
      /* ⑲-20 키보드 판은 섬 윗면에 내려서야, GPS 판은 기둥 곁(봉우리 둘레)에 닿으면 */
      var SKc = global.DG.skyIsle, LFc = global.DG.landform;
      if (SKc && SKc.layerOn()) {
        if (LFc.onSky()) { toast('☁️ 구름섬에 올라섰다 — 먹구름 무리가 지키고 있다'); advance(); return; }
      } else {
        t = targetOf(st);
        if (t && Math.hypot(p.x - t.x, p.y - t.y) <= CLIMB_R()) { toast('🌬️ 바람 기둥 곁에 닿았다 — 구름섬 이야기는 이 둘레에서 이어진다'); advance(); return; }
      }
    } else if (st && (st.type === 'kill' || st.type === 'duel')) {
      t = targetOf(st);
      var F = FC(), S = F && F.state ? F.state() : null, key = keyOf();
      if (t && S && !S.camps[key] && Math.hypot(p.x - t.x, p.y - t.y) < KILL_NEAR) {
        var ks = st.type === 'duel' ? [st.kind] : st.kinds;
        F.spawnCamp(S, { key: key, x: t.x, y: t.y, tier: F.tierAt(t.x, t.y), kind: 'story', sky: !!st.sky,
          foes: ks.map(function (k, i) { var a = i * 1.571, rr = ks.length === 1 ? 0 : 3; return { kind: k, dx: Math.cos(a) * rr, dy: Math.sin(a) * rr }; }) });
        toast(st.enter || (st.type === 'duel' ? '🎭 검은 가면이 봉우리에 내려섰다' : '⚔️ 먹구름 졸개가 나타났다'));
      }
      if (st.type === 'duel') { stepDuel(); }
    }
    /* 지금 단계가 아닌 인물 곁 — 혼잣말 한 줄(45초에 한 번) */
    var now = Date.now();
    for (var i = 0; i < NPC_KEYS.length; i++) {
      var k = NPC_KEYS[i], np = visible(k) ? npcPos(k) : null;
      if (!np || (st && (isTalk(st) || st.type === 'follow' || st.type === 'chase') && st.npc === k)) { continue; }
      if (Math.hypot(p.x - np.x, p.y - np.y) <= IDLE_R && (!lastIdle[k] || now - lastIdle[k] > IDLE_GAP)) {
        lastIdle[k] = now;
        var inf = npcInfo(k);
        toast('💬 ' + inf.name + ' — ' + inf.idle);
      }
    }
  }

  /* ── 대화 ─────────────────────────────────────────────── */

  var talk = null;          // { st, i, shown(나온 글자 수), since(마지막 글자 뒤 초), reply(고른 대답|null) } — 창이 열려 있으면
  /** 말을 걸 수 있는 단계들 — 따라가는 줄 · (세계 임무를 따라가면) 이야기 · 맡은 세계 임무의 다음 · 맡을 수 있는 세계 임무 첫 대화 */
  function talkables() {
    var out = [step()], tq = tracking(), w = wqs();
    if (tq) { out.push(storyStep()); }
    if (WQD) {
      WQD.ORDER.forEach(function (id) {
        if (id === tq) { return; }
        if (typeof w.steps[id] === 'number') { out.push(wqDef(id).steps[w.steps[id]]); } else if (wqAvail(id)) { out.push(wqDef(id).steps[0]); }
      });
    }
    return out;
  }
  /** 곁(TALK_R)에서 말을 걸 수 있는 가장 가까운 대화 단계 — 같으면 따라가는 줄이 먼저 */
  function nearTalk() {
    var L = talkables(), p = pos(), best = null, bd = Infinity;
    for (var i = 0; i < L.length; i++) {
      var st = L[i];
      if (!isTalk(st) || !visible(st.npc)) { continue; }
      var sa = stepAt(st), np = npcPos(st.npc, sa.c, sa.i, sa.wq), d = np ? Math.hypot(p.x - np.x, p.y - np.y) : Infinity;
      if (d <= TALK_R() && d < bd - 1e-9) { bd = d; best = st; }
    }
    return best;
  }
  function busy() {
    var D = global.DG;
    return !!((D.encounter && D.encounter.active) || (D.duel && D.duel.active) || (D.domain && D.domain.active && D.domain.active()) ||
      (document.body && document.body.classList.contains('sheet-open')));
  }
  /** 지금 창에 나온 줄 — 고른 대답이 있으면 "나" 의 줄 */
  function curLine() { return !talk ? null : (talk.reply !== null ? ['나', talk.reply] : talk.st.lines[talk.i]); }
  function lineLen(line) { return line && line[0] !== '?' ? String(line[1]).length : 0; }
  function fresh() { talk.shown = REVEAL_CPS() > 0 ? 0 : lineLen(curLine()); talk.since = 0; }
  /** 곁이면 대화를 연다 */
  function talkStart() {
    var st = nearTalk();
    if (!st || talk || busy()) { return false; }
    /* ⑲-21 그 대화의 줄로 넘어간다 — 안 맡은 세계 임무면 맡는다 */
    var sa = stepAt(st);
    if (sa.wq) { if (wqStepOf(sa.wq) === null) { wqStart(sa.wq); } else { setTrack(sa.wq); } } else { setTrack(null); }
    if (step() !== st) { return false; }
    talk = { st: st, i: 0, shown: 0, since: 0, reply: null };
    fresh();
    paintTalk();
    return true;
  }
  function talking() { return !!talk; }
  /** 줄이 다 나왔나 */
  function lineFull() { var l = curLine(); return !l || l[0] === '?' || talk.shown >= lineLen(l); }
  /**
   * 누르기 한 번 — 글이 흘러나오는 중이면 줄 전체를 보이고, 다 나왔으면 다음 줄.
   * 고르는 줄이면 choice(0·1)로 대답을 고른다(대답이 "나" 의 줄로 한 번 나온다). 마지막 줄 뒤면 단계를 끝낸다
   */
  function next(choice) {
    if (!talk) { return false; }
    var line = curLine();
    if (line[0] === '?') {
      if (typeof choice !== 'number' || !line[1][choice]) { return false; }
      talk.reply = line[1][choice];
      fresh(); paintTalk();
      return true;
    }
    if (!lineFull()) { talk.shown = lineLen(line); talk.since = 0; paintTalk(); return true; }
    if (talk.reply !== null) { talk.reply = null; }
    talk.i += 1;
    if (talk.i >= talk.st.lines.length) {
      var done0 = talk.st;
      talk = null; paintTalk();
      if (done0.type === 'sail') { sail(done0); }                         // ⑲-19 배
      advance();
      return true;
    }
    fresh(); paintTalk();
    return true;
  }
  function speakerOf(name, fallback) {
    if (name === '?' || name === '나') { return 'me'; }
    for (var i = 0; i < NPC_KEYS.length; i++) { if (NPCS[NPC_KEYS[i]].short === name) { return NPC_KEYS[i]; } }
    return fallback;
  }
  /**
   * 대화 연출이 읽는 값(world3d → talkface) — 대화가 없으면 null.
   * { who('me'|인물 key), npc(대화 상대 key), spk·lst({x,y} 말하는 이·듣는 이), speaking, vowel, open(0~1), emo, line }
   */
  function talkShot() {
    if (!talk) { return null; }
    var TF = global.DG.talkface, k = talk.st.npc, np = npcPos(k), p = pos(), line = curLine();
    if (!np) { return null; }
    var who = speakerOf(line[0], k), me = who === 'me', n = Math.floor(talk.shown);
    var txt = line[0] === '?' ? '' : String(line[1]);
    var open = txt && n > 0 ? Math.max(0, 1 - talk.since / (TF ? TF.MOUTH_CLOSE : 0.14)) : 0;
    return {
      who: who, npc: k, spk: me ? { x: p.x, y: p.y } : np, lst: me ? np : { x: p.x, y: p.y },
      speaking: !!txt && (n < txt.length || talk.since < 0.4), vowel: TF && n > 0 ? TF.vowelOf(txt.charAt(n - 1)) : null,
      open: open, emo: line[2] || null, line: talk.i * 2 + (talk.reply !== null ? 1 : 0)
    };
  }

  /* ── 화면 ─────────────────────────────────────────────── */

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtDist(d) { return d >= 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm'; }
  /** 추적 한 줄 글 — 세이브·자리만 읽는다 */
  function trackText() {
    var tq = on() ? tracking() : null;
    if (!on() || (!tq && done())) { return ''; }
    var ch = chapter();
    if (!tq && locked()) { return '📖 ' + ch.name + ' — 여정 등급 ' + ch.ar + ' 에 열린다'; }
    var st = step(), t = targetOf(st), p = pos(), d = t ? Math.hypot(p.x - t.x, p.y - t.y) : 0;
    var what = st.text;
    if (st.type === 'gather') { what += ' ' + gathered() + '/' + st.count; }
    if (st.type === 'follow' && d > FOLLOW_LOST()) { what = '너무 멀다, 가까이!'; }
    if (st.type === 'chase') { what = chase && chase.key === keyOf() && chase.run ? NPCS[st.npc].name + ' ' + Math.round(d) + 'm — 달려라!' : st.text + ' (가까이 가면 달아난다)'; }   // ⑲-19
    if (st.type === 'seal') { what += ' ' + sealLit() + '/' + (st.order || SEAL_ORDER).length + ' (' + orderText(st) + ')'; }
    if (st.type === 'duel') {
      var b = duelBoss(), FF = FC() && FC().FOES[st.kind];
      if (b && !b.dead) {
        what = (FF ? FF.name : '검은 가면') + ' ' + Math.ceil(100 * b.hp / b.hpMax) + '%' +
          (b.shield > 0 ? ' · ' + ({ elec: '⚡', water: '💧' }[b.shEl] || '🛡️') + '방패 ' + b.shield : '');
      }
    }
    if (st.type === 'defend') {                                // ⑲-16
      var dd = def && def.key === keyOf() ? def : null;
      if (dd && dd.rest > 0) { what += ' · ' + Math.ceil(dd.rest) + '초 뒤 다시'; }
      else if (dd && dd.wave >= 0) { what = (st.name || '제단') + ' ' + Math.ceil(100 * dd.hp / dd.hpMax) + '% · 물결 ' + (dd.wave + 1) + '/' + wavesOf(st).length; }
      else { what += ' (가까이 가면 무리가 온다)'; }
    }
    return (tq ? '🔷 ' + wqDef(tq).name : '📖 ' + ch.name) + ' — ' + what + (t ? ' · ◆ ' + fmtDist(d) : '');
  }
  function el(id, cls) {
    var e = document.getElementById(id);
    if (!e && document.body) { e = document.createElement('div'); e.id = id; if (cls) { e.className = cls; } document.body.appendChild(e); }
    return e;
  }
  var lastTrack = '', lastBtn = '';
  function paintHud() {
    if (!document.body) { return; }
    var tr = el('story-track'), txt = trackText();
    if (txt !== lastTrack) { lastTrack = txt; tr.textContent = txt; tr.style.display = txt ? '' : 'none'; }
    var b = el('story-btn'), st = !talk && !busy() ? nearTalk() : null, bt = st ? '💬 ' + NPCS[st.npc].short + (NPCS[st.npc].era ? '(' + NPCS[st.npc].era + ')' : '') + '와 이야기 (F)' : '';
    if (bt !== lastBtn) { lastBtn = bt; b.textContent = bt; b.style.display = bt ? '' : 'none'; }
  }
  function shownText() { var l = curLine(); return String(l[1]).slice(0, Math.floor(talk.shown)); }
  function paintTalk() {
    var box = el('story-talk');
    if (!box) { return; }
    if (!talk) { box.classList.remove('show'); box.innerHTML = ''; return; }
    var line = curLine(), acts;
    if (line[0] === '?') {
      acts = line[1].map(function (a, i) { return '<button class="btn primary" data-st-pick="' + i + '">' + esc(a) + '</button>'; }).join('');
      box.innerHTML = '<div class="st-box"><b class="st-who">나</b><p class="st-line">……</p><div class="st-acts">' + acts + '</div></div>';
    } else {
      box.innerHTML = '<div class="st-box" data-st-next="1"><b class="st-who">' + esc(line[0]) + '</b><p class="st-line">' + esc(shownText()) + '</p>' +
        '<div class="st-acts"><small class="muted">' + (talk.i + 1) + '/' + talk.st.lines.length + '</small>' +
        '<button class="btn primary" data-st-next="1">' + (talk.i + 1 < talk.st.lines.length || talk.reply !== null ? '다음 ▸' : '끝') + '</button></div></div>';
    }
    box.classList.add('show');
  }
  /** 흘러나오는 동안은 글 한 줄만 바꾼다 — 창을 통째로 다시 쓰면 누르던 단추가 바뀌어 누름이 빠진다 */
  function paintLine() {
    var box = document.getElementById('story-talk'), p = box && box.querySelector('.st-line');
    if (p && talk && curLine()[0] !== '?') { p.textContent = shownText(); }
  }
  /** 글자 흘리기 한 박자 */
  function reveal(dt) {
    if (!talk) { return; }
    var line = curLine(), len = lineLen(line), cps = REVEAL_CPS();
    if (line[0] !== '?' && talk.shown < len && cps > 0) {
      var was = Math.floor(talk.shown);
      talk.shown = Math.min(len, talk.shown + cps * (dt || 0));
      if (Math.floor(talk.shown) !== was) { talk.since = 0; if (!global.DG_NO_DRAW) { paintLine(); } return; }
    }
    talk.since += dt || 0;
  }
  /** O 목록 — 장마다 끝남·지금(단계 ✓)·잠김 */
  function listHtml() {
    var s = sv(), out = '<div class="st-box"><b class="st-who">📖 이야기 임무</b>';
    for (var c = 0; c < CHAPTERS.length; c++) {
      var ch = CHAPTERS[c], state = c < s.ch ? '✅ 끝' : (c === s.ch ? ((core().save.player.level || 1) < ch.ar ? '🔒 여정 등급 ' + ch.ar : '▶ 진행 중') : '🔒 여정 등급 ' + ch.ar);
      out += '<div class="st-ch"><b>' + esc(ch.name) + '</b> <small>' + state + '</small>';
      if (c === s.ch && state === '▶ 진행 중') {
        for (var i = 0; i < ch.steps.length; i++) {
          out += '<small style="display:block" class="' + (i < s.step ? 'muted' : '') + '">' + (i < s.step ? '✓' : (i === s.step ? '◆' : '◇')) + ' ' + esc(ch.steps[i].text) + '</small>';
        }
      }
      out += '</div>';
    }
    /* ⑲-21 세계 임무 — 끝·따라가는 중·맡음(따라가기 단추)·맡을 수 있음(! 누구에게)·잠김 */
    if (WQD) {
      var w = wqs(), tq = tracking(), lv = core().save.player.level || 1;
      out += '<b class="st-who" style="display:block;margin-top:10px">🔷 세계 임무</b>';
      WQD.ORDER.forEach(function (id) {
        var q = wqDef(id), g = NPCS[q.giver], got = typeof w.steps[id] === 'number', fin = w.done.indexOf(id) >= 0;
        var state = fin ? '✅ 끝' : (id === tq ? '▶ 따라가는 중' : (got ? '◇ 맡음' : (lv >= q.ar ? '❗ ' + q.place + ' ' + g.short + '에게' : '🔒 여정 등급 ' + q.ar)));
        out += '<div class="st-ch"><b>' + esc(q.name) + '</b> <small>' + state + '</small>';
        if (got && id !== tq) { out += ' <button class="btn ghost" data-wq-track="' + id + '">따라가기</button>'; }
        if (id === tq) {
          for (var j = 0; j < q.steps.length; j++) {
            out += '<small style="display:block" class="' + (j < w.steps[id] ? 'muted' : '') + '">' + (j < w.steps[id] ? '✓' : (j === w.steps[id] ? '◆' : '◇')) + ' ' + esc(q.steps[j].text) + '</small>';
          }
        }
        out += '</div>';
      });
      if (tq && !done()) { out += '<div class="st-ch"><button class="btn ghost" data-wq-track="">📖 이야기 임무 따라가기</button></div>'; }
    }
    return out + '<div class="st-acts"><button class="btn ghost" data-st-close="1">닫기 (O)</button></div></div>';
  }
  var listOpen = false;
  function toggleList(v) {
    var box = el('story-list');
    listOpen = typeof v === 'boolean' ? v : !listOpen;
    if (!box) { return; }
    box.innerHTML = listOpen ? listHtml() : '';
    box.classList.toggle('show', listOpen);
  }

  /* 3D — 목표 금빛 기둥 · 옛 제단(light·defend 단계) */
  var fx = {}, clock = 0;
  /** ⑲-16 제단 체력 몫(0~1) → 기둥 빛깔(빨강 0xff4040 ↔ 초록 0x4cd964) */
  function pillarHex(k) {
    k = Math.max(0, Math.min(1, k));
    var r = Math.round(0xff + (0x4c - 0xff) * k), g = Math.round(0x40 + (0xd9 - 0x40) * k), b = Math.round(0x40 + (0x64 - 0x40) * k);
    return (r << 16) | (g << 8) | b;
  }
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function dropFx(k) { var w = W3(); if (w && fx[k]) { w.removeFx(fx[k]); } delete fx[k]; }
  function paint3d(dt) {
    clock += dt || 0;
    var w = W3(), st = step(), t = st && !talk ? targetOf(st) : null, p = pos();
    if (!w || !t || Math.hypot(t.x - p.x, t.y - p.y) > 900) { dropFx('pillar'); dropFx('altar'); dropFx('seal'); return; }
    var T3 = w.three();
    if (!T3) { return; }
    var gy = w.standY ? w.standY(t.x, t.y, skyOf(st)) : (w.groundY ? w.groundY(t.x, t.y) : 0);   // ⑲-20 섬 위 목표는 섬 윗면에
    if (!fx.pillar) {
      var g = new T3.Group();
      var mat = new T3.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, depthWrite: false, blending: T3.AdditiveBlending, fog: false });
      var cyl = new T3.Mesh(new T3.CylinderGeometry(0.9, 0.9, 60, 12, 1, true), mat);
      cyl.position.y = 30; g.add(cyl);
      w.addFx(g); fx.pillar = g;
    }
    fx.pillar.position.set(t.x, gy, t.y);
    fx.pillar.children[0].material.opacity = 0.28 + Math.sin(clock * 2.2) * 0.08;
    /* ⑲-16 지키는 동안은 기둥이 제단 체력 — 초록 → 빨강 */
    var dd = st.type === 'defend' && def && def.key === keyOf() && def.hpMax && def.wave >= 0 ? def : null;
    fx.pillar.children[0].material.color.setHex(dd ? pillarHex(dd.hp / dd.hpMax) : 0xffd24a);
    if (st.type === 'light' || st.type === 'defend') {
      if (!fx.altar) {
        var A = global.DG.asset3d, m = A && A.build ? A.build('lantern', { id: 'story_altar' }) : null, ag = new T3.Group();
        if (m) { m.scale.set(1.8, 1.8, 1.8); ag.add(m); }
        w.addFx(ag); fx.altar = ag;
      }
      fx.altar.position.set(t.x, gy, t.y);
    } else { dropFx('altar'); }
    /* ⑲-14 석등 셋 — 등롱 위에 빛깔 구슬, 켜지면 밝고 크게 */
    if (st.type === 'seal') {
      var L = sealLamps(st), order = st.order || SEAL_ORDER, lit = order.slice(0, sealLit());
      if (!fx.seal || fx.seal.userData.key !== keyOf()) {
        dropFx('seal');
        var sg = new T3.Group(), A3 = global.DG.asset3d;
        sg.userData.key = keyOf();
        L.forEach(function (l) {
          var lg = new T3.Group(), lm = A3 && A3.build ? A3.build('lantern', { id: 'story_seal_' + l.k }) : null;
          if (lm) { lm.scale.set(1.4, 1.4, 1.4); lg.add(lm); }
          var orb = new T3.Mesh(new T3.SphereGeometry(0.45, 14, 10),
            new T3.MeshBasicMaterial({ color: new T3.Color(SEAL_MARKS[l.k].color), transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
          orb.position.y = 3.2; lg.add(orb);
          lg.userData = { k: l.k, x: l.x, y: l.y, orb: orb };
          sg.add(lg);
        });
        w.addFx(sg); fx.seal = sg;
      }
      fx.seal.children.forEach(function (lg) {
        var on = lit.indexOf(lg.userData.k) >= 0, u = lg.userData;
        lg.position.set(u.x, w.groundY ? w.groundY(u.x, u.y) : gy, u.y);
        u.orb.material.opacity = on ? 0.95 : 0.25 + Math.sin(clock * 3) * 0.05;
        u.orb.scale.setScalar(on ? 1.35 : 1);
      });
    } else { dropFx('seal'); }
  }

  /** ⑲-22 활 조준에 잠길 것 — 따라가는 줄의 안 켠 석등(seal)·옛 제단(light) [{kind, x, y}]. 충전 화살이 멈추면 원소 신호 */
  function aimPoints() {
    var st = on() ? step() : null;
    if (!st) { return []; }
    if (st.type === 'seal') {
      var lit = (st.order || SEAL_ORDER).slice(0, sealLit());
      return sealLamps(st).filter(function (l) { return lit.indexOf(l.k) < 0; }).map(function (l) { return { kind: 'lamp', x: l.x, y: l.y }; });
    }
    if (st.type === 'light') { var t = targetOf(st); return t ? [{ kind: 'altar', x: t.x, y: t.y }] : []; }
    return [];
  }
  /** ⑲-21 맡을 사람 머리 위 푸른 ! (코드 그림 — 막대 + 점). 맡을 수 있는 것은 밝게, 이어 갈 것은 흐리게 */
  var markFx = {};
  function paintMarks3d() {
    var w = W3(), T3 = w && w.three(), seen = {}, k, p = pos();
    if (T3) {
      wqMarks().forEach(function (m) {
        if (Math.hypot(m.x - p.x, m.y - p.y) > 150) { return; }
        seen[m.k] = true;
        if (!markFx[m.k]) {
          var g = new T3.Group(), mat = new T3.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.95, fog: false });
          var bar = new T3.Mesh(new T3.BoxGeometry(0.16, 0.6, 0.16), mat); bar.position.y = 0.5; g.add(bar);
          var dot = new T3.Mesh(new T3.SphereGeometry(0.1, 10, 8), mat); g.add(dot);
          markFx[m.k] = w.addFx(g);
        }
        var gy = w.standY ? w.standY(m.x, m.y, false) : (w.groundY ? w.groundY(m.x, m.y) : 0);
        markFx[m.k].position.set(m.x, gy + 2.5 + Math.sin(clock * 2.5) * 0.12, m.y);
        markFx[m.k].rotation.y = clock * 1.4;
        markFx[m.k].children[0].material.opacity = m.fresh ? 0.95 : 0.55;
      });
    }
    for (k in markFx) { if (markFx.hasOwnProperty(k) && !seen[k]) { if (w) { w.removeFx(markFx[k]); } delete markFx[k]; } }
  }

  /** 지금 세울 이야기 인물 — folk.live 와 같은 모양 `{p, x, y, walking, phase, ang, dist}`. 대화 상대는 나를 본다 */
  function live(p0, tms) {
    if (!on() || !p0) { return []; }
    var out = [], i, pp = pos(), fs = fol && step() && step().type === 'follow' ? fol : null;
    for (i = 0; i < NPC_KEYS.length; i++) {
      var k = NPC_KEYS[i], n = NPCS[k], q = visible(k) ? npcPos(k) : null;
      if (!q) { continue; }
      var d = Math.hypot(q.x - p0.x, q.y - p0.y);
      if (d > 110) { continue; }
      var face = talk && talk.st.npc === k, inf = npcInfo(k), fw = !!(fs && fs.walking && step().npc === k);
      /* 바라보는 곳 — 대화 상대면 나 · 길(path)을 걷는 중이면 다음 길 점(⑲-28) · 아니면 제 땅 탑(spot 인물은 그 자리) */
      var a = fw && step().path ? followPts(step())[Math.min(fs.i + 1, step().path.length - 1)] : (n.spot ? spotPos(n.spot) : anchorOf(n.zone));
      out.push({ p: { id: n.id, name: inf.name, color: n.color, rarity: 3, trait: 'virtue', story: k, mask: inf.mask, pet: n.pet || null }, sky: inf.sky,
        x: q.x, y: q.y, walking: !!(fw || (n.runPath && chase && chase.npc === k && chase.run && !(chase.pause > 0))), phase: (tms || 0) / 480,
        ang: face ? Math.atan2(pp.y - q.y, pp.x - q.x) : (a ? Math.atan2(a.y - q.y, a.x - q.x) : 0), dist: d });
    }
    return out;
  }
  /** 미니맵 점 — 목표 하나(테두리에도) */
  function marker() {
    var st = step(), t = st ? targetOf(st) : null;
    return t ? { x: t.x, y: t.y, name: st.text } : null;
  }

  var acc = 0, bound = false;
  function tick(dt) {
    if (!on()) { return; }
    acc += dt || 0;
    if (acc > 0.5) { acc = 0; check(); }
    stepFollow(dt);
    stepChase(dt);
    stepDefend(dt);
    reveal(dt);
    if (!global.DG_NO_DRAW) { paintHud(); paint3d(dt); paintMarks3d(); }
  }
  function bind() {
    if (bound) { return; }
    bound = true;
    var c = core();
    c.on('field:guard', onGuard);
    c.on('field:clear', onClear);
    c.on('field:element', onElement);
    c.on('field:siege', onSiege);
    c.on('field:wipe', onWipe);
    c.on('domain:clear', onDomain);
    c.on('cook:gather', onGather);
    c.on('cook:done', onCook);
    if (!global.addEventListener || !document.body) { return; }
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) { return; }
      if (t.closest('#story-btn')) { talkStart(); }
      else if (t.closest('[data-st-pick]')) { next(+t.closest('[data-st-pick]').getAttribute('data-st-pick')); }
      else if (t.closest('[data-st-next]')) { next(); }
      else if (t.closest('[data-st-close]')) { toggleList(false); }
      else if (t.closest('[data-wq-track]')) { setTrack(t.closest('[data-wq-track]').getAttribute('data-wq-track') || null); toggleList(true); }
      else if (t.closest('#story-track')) { toggleList(); }
    });
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (!on() || e.repeat || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      if (global.DG.fishing && global.DG.fishing.active) { return; }       // ⑲-24 낚시 중 F 는 낚시 것
      var k = (e.key || '').toLowerCase();
      if (talk) {
        if (curLine()[0] === '?') { if (k === '1' || k === '2') { e.preventDefault(); next(+k - 1); } return; }
        if (k === 'f' || k === ' ' || k === 'enter') { e.preventDefault(); next(); }
        return;
      }
      if (k === 'f' && nearTalk()) { e.preventDefault(); talkStart(); }
      else if (k === 'o') { toggleList(); }
      else if (k === 'escape' && listOpen) { toggleList(false); }
    });
  }
  function init() { hookFind(); if (on()) { sv(); catchUp(); } bind(); }

  global.DG = global.DG || {};
  global.DG.story = {
    NPCS: NPCS, CHAPTERS: CHAPTERS, MEMBERS: MEMBERS, join: join, catchUp: catchUp, hasMember: hasMember, STEP_EXP: STEP_EXP, WANDER_PATH: WANDER_PATH, FOLLOW_SPEED: FOLLOW_SPEED,
    POLE_GPS_R: POLE_GPS_R, SEAL_R: SEAL_R, SEAL_LAYOUT: SEAL_LAYOUT, SEAL_ORDER: SEAL_ORDER, SEAL_MARKS: SEAL_MARKS, SPOTS: SPOTS, CLIMB_R: CLIMB_R,
    DUEL_P2_AT: DUEL_P2_AT, DUEL_P2_SHIELD: DUEL_P2_SHIELD, peakSpot: peakSpot, spotPos: spotPos, placeOf: placeOf,
    DEFEND_RING: DEFEND_RING, DEFEND_WAVE_SEC: DEFEND_WAVE_SEC, DEFEND_REST: DEFEND_REST, DEFEND_HITS: DEFEND_HITS, DEFEND_WAVES: DEFEND_WAVES, DEFEND_START: DEFEND_START,
    CAPE_CLEAR: CAPE_CLEAR, capeSpot: capeSpot, landAt: landAt, ringAt: ringAt, stepDefend: stepDefend, defState: function () { return def && def.key === keyOf() ? def : null; },
    waveKey: waveKey, pillarHex: pillarHex,
    THIEF_PATH: THIEF_PATH, CHASE_SPEED: CHASE_SPEED, CHASE_PAUSE: CHASE_PAUSE, CHASE_START: CHASE_START, CHASE_CATCH: CHASE_CATCH, ISLE_R: ISLE_R,
    isleSpot: isleSpot, wetNeighbors: wetNeighbors, stepChase: stepChase, thiefAt: thiefAt, chaseState: function () { return chase && chase.key === keyOf() ? chase : null; }, isTalk: isTalk,
    sealLamps: sealLamps, sealHit: sealHit, sealLit: sealLit, duelBoss: duelBoss, stepDuel: stepDuel, npcInfo: npcInfo, skyOf: skyOf,
    WQ: WQD, wqs: wqs, wqDef: wqDef, wqStepOf: wqStepOf, tracking: tracking, setTrack: setTrack, wqStart: wqStart, wqAvail: wqAvail, wqMarks: wqMarks, mapMarks: mapMarks, revealed: revealed,
    talkables: talkables, storyStep: storyStep, stepAt: stepAt, aimPoints: aimPoints,
    FOLLOW_NEAR: FOLLOW_NEAR, FOLLOW_LOST: FOLLOW_LOST,
    HARAM_OBS: HARAM_OBS, HARAM_SHIP: HARAM_SHIP, HARAM_FORT: HARAM_FORT, frostSpot: frostSpot, followPts: followPts,
    CAVE_FIGHT: CAVE_FIGHT, BANDI_CAVE: BANDI_CAVE, HEART: HEART, FORT_GATE: FORT_GATE, BAWOO_GATE: BAWOO_GATE, BEACON: BEACON, LAKE_SEAL: LAKE_SEAL, BAWOO_LAKE: BAWOO_LAKE, BEACON_DIRS: BEACON_DIRS, defendSlots: defendSlots,
    on: on, anchorOf: anchorOf, npcPos: npcPos, visible: visible, targetOf: targetOf, trackText: trackText, listHtml: listHtml,
    state: sv, chapter: chapter, step: step, locked: locked, done: done, keyOf: keyOf, gathered: gathered,
    advance: advance, check: check, stepFollow: stepFollow, nearTalk: nearTalk, talkStart: talkStart, talking: talking, next: next,
    lineFull: lineFull, curLine: curLine, reveal: reveal, talkShot: talkShot,
    live: live, marker: marker, toggleList: toggleList, init: init, tick: tick,
    _resetForTest: function () {
      talk = null; lastIdle = {}; anchorMemo = {}; lastTrack = ''; lastBtn = ''; listOpen = false;
      fol = null; prog = { key: '', n: 0 }; aimMemo = { k: '', v: null }; seal = { key: '', n: 0 }; duel = null; peakMemo = null;
      def = null; capeMemo = null; chase = null; isleMemo = null;
    }
  };
})(window);
