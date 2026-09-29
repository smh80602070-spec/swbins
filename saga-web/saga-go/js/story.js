/**
 * 이야기 임무 1~22장 — 대화 창·금빛 기둥·목록(O)·단계 열여섯 가지 (PLAN §5 ⑲-12~20·28~30·34~46, saga-godot PLAN 106 ㉕㉗㉘㉙㉚㉜㉞㊲㊳㊺-2~4·㊼·㊽-2~4·㊾-2~3·㊿-2~3)
 * ---------------------------------------------------------------
 *   인물 넷    청하 촌장 누리(고향 마을) · 늙은 사공 버들(갈대 나루 탑) · 떠돌이 학자 은비(옛 성터 언덕 탑) —
 *              ⑮ 땅의 "고향에서 가장 가까운 탑" 곁에 늘 서 있다. 지금 단계가 아니면 혼잣말 한 줄.
 *              가면 쓴 나그네는 4장 둘째~여섯째 단계에만 고향 남쪽 다리목에 서고, 따라가기를 지나면 길 끝에 선다
 *   단계       talk(곁에서 💬/F → 대화) · go(그 자리 반경 안) · boss(그 탑 ⑪ 수호자 — 이미 쓰러져 꽃을 기다리면 바로 넘김) ·
 *              kill(임무 적 무리 `sq:` — 되살아나지 않고 전리품 없음) · light(옛 제단에 어느 원소든 스킬·해방 — ⑲-39 bell 이면 등롱 없이 종각 종을 울린다 · ⑲-40 bare 면 등롱 없이 장치가 받는다) ·
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
  /* ⑲-40 18장 선장의 잔상 — 은하역 가운데에서 남쪽 선로(z 2~42) 위를 지그재그로, 선로 끝 너머 틈 쪽까지 */
  /* ⑲-50 25장 구름 씨앗 드론 — 잔해 섬 가운데에서 섬 둘레 반지름 11~18m(조종실·프로펠러·꼬리 날개를 비켜) */
  /* ⑲-59 31장 조각 도둑 — 네거리 가운데에서 반지름 42~58m 를 열한 점으로 한 바퀴 반(시계방 서쪽·신상을 비켜) */
  /* ⑲-62 33장 조각 운반 드론 — 야적장(vault 'yard') 가운데에서 열한 점: 컨테이너 사이 → 창고 서쪽 → 동력 기둥 사이 → 금고 문 앞(Godot 54-2 chase path 를 칸→m) */
  var VAULT_DRONE_PATH = [[19, -12], [-14, -10], [-48, -2], [-82, 5], [-106, -19], [-96, -53], [-62, -67], [-34, -86], [-53, -115], [-91, -125], [-110, -134]];
  var AMBER_THIEF_PATH = (function () { var o = [], k; for (k = 0; k < 11; k++) { var a = (200 + k * 34) * Math.PI / 180, r = 42 + (k % 3) * 8; o.push([Math.round(Math.cos(a) * r * 10) / 10, Math.round(Math.sin(a) * r * 10) / 10]); } return o; })();
  var SEED_DRONE_PATH = [[8, -9], [-2, -14], [-13, -5], [-14, 10], [0, 16], [13, 9]];
  var CAPTAIN_PATH = [[0, 6], [1.5, 16], [-1.5, 26], [1.5, 36], [-1, 46], [2, 58], [-2, 68]];
  /* ⑲-36 15장 고원 자리(비행선 가운데에서) — 달음은 선체 밖 서쪽, 날개 이음매는 선체 밖 남서쪽 */
  var DAREUM_SHIP = [-12, 10], WING_SEAM = [-4, 8];
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
      idle: '삐— 동력 3퍼센트. 추위 경고.', at: [{ ch: 32, from: 1, to: 1, spot: 'fr_obs', off: [HARAM_OBS[0] + 7, HARAM_OBS[1] + 3] }, { ch: 32, from: 2, to: 999, spot: 'vt_yard', off: [-14, 15] },   // ⑲-62 10부 33장
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
      appear: [{ ch: 33, from: 4, to: 999, spot: 'vt_pylons', off: [0, -14] }, { ch: 33, from: 2, to: 3 },
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
  var NPC_KEYS = ['elder', 'ferryman', 'scholar', 'wanderer', 'haesol', 'thief', 'haram', 'bandi', 'bawoo', 'daon', 'gaon', 'dareum', 'horse', 'ara', 'hangyeol', 'dodam', 'captain', 'hanbyeol', 'yeoul', 'mulsae', 'parang', 'saebyeok', 'haneul', 'seeddrone', 'gamyeon', 'chorong', 'neoul', 'partthief', 'saegil', 'maru', 'carrier', 'sodam', 'haemi', 'garmuri', 'byeori', 'narae'];
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
      el: 'fire', weapon: 'claymore', stats: { might: 86, wisdom: 58, command: 64 }, emoji: '🔥', quote: '처음 하늘이 찢기던 날 벼리던 칼로, 이제 이어진 날들을 지키겠소.' }
  };
  /* ⑲-55 이야기 동료의 시대 — 29장 편성 시험(과거·현대·미래 하나씩) */
  var MEMBER_TIME = { story_scholar: '현대', story_wanderer: '과거', story_elder: '과거', story_ferryman: '과거', story_haesol: '현대', story_haram: '현대', story_dareum: '과거',
    story_dodam: '현대', story_hanbyeol: '미래', story_mulsae: '과거', story_haneul: '현대', story_chorong: '현대', story_haemi: '미래', story_byeori: '과거' };
  function memberTime(id) { return MEMBER_TIME[id] || null; }
  /** 들판 명단(save.party)의 이야기 동료가 가진 시대 — { 과거: true, … } */
  function partyEras() {
    var out = {}, P = core() && core().save && Array.isArray(core().save.party) ? core().save.party : [];
    P.forEach(function (id) { var t = memberTime(id); if (t) { out[t] = true; } });
    return out;
  }
  function partyOk(st) { var e = partyEras(); return (st.eras || ['과거', '현대', '미래']).every(function (k) { return !!e[k]; }); }
  /** 🤖 자동 — 명단에 없는 시대는 가진 이야기 동료 중에서 채운다(자리가 없으면 명단 끝 인물과 바꾼다). 바꿨으면 true */
  function autoParty() {
    var st = step();
    if (!st || st.type !== 'party') { return false; }
    var c = core(), FM = global.DG.formation, max = FM ? FM.MAX : 5, changed = false;
    if (!Array.isArray(c.save.party)) { c.save.party = []; }
    (st.eras || ['과거', '현대', '미래']).forEach(function (era) {
      if (partyEras()[era]) { return; }
      var pick = Object.keys(MEMBERS).filter(function (id) { return memberTime(id) === era && hasMember(id) && c.save.party.indexOf(id) < 0; })[0];
      if (!pick) { return; }
      if (c.save.party.length >= max) {
        var removable = function (id) { var t = memberTime(id); return !t || c.save.party.filter(function (q) { return memberTime(q) === t; }).length > 1; };
        for (var i = c.save.party.length - 1; i >= 0; i--) { if (removable(c.save.party[i])) { c.save.party.splice(i, 1); break; } }
        if (c.save.party.length >= max) { c.save.party.pop(); }
      }
      c.save.party.push(pick); changed = true;
    });
    if (changed) { c.emit('changed'); }
    return changed;
  }
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
      ] },
    /* ⑲-36 3부 끝 — 무대는 고향 남쪽 옛 역참 터(era-sites.js). 반디 → 역참 → 달음 → 놀란 역마 쫓기 → 달음 → 여우불 무리 →
       여우불 구미호(화, 절반에서 화 방패 — 물로) → 달음 → 고원 비행선 → 날개 이음매에 원소 → 반디(달음 곁) · 달음 합류.
       장이 끝나면 별배가 뜬다(frost.js flown) */
    { id: 'ch15', name: '제15장 · 옛 역참 길', ar: 36, join: 'story_dareum',
      reward: { knot: 6, gold: 4250, guide: 5, secret: 5, party: 1250 },
      steps: [
        { type: 'talk', npc: 'bandi', text: '추락한 비행선의 반디와 이야기하기',
          lines: [['반디', '삐— 셋째 조각 신호. 시대 표지는 뒤 — 아주 오래전. 좌표는 청하 마을 남쪽 옛 길입니다.', 'surprised'],
            ['반디', '같은 자리에 차가운 신호가 하나 더. 꼬리 아홉… 구미호입니다. 그런데 이번엔 뜨겁습니다.', 'angry'],
            ['?', ['뜨겁다고?', '구미호가 먼저 가 있구나.']],
            ['반디', '옛 시대의 여우불을 먹은 것으로 보입니다. 조심하십시오.']] },
        { type: 'go', spot: 'station', text: '청하 마을 남쪽 옛 역참 길로' },
        { type: 'talk', npc: 'dareum', text: '역참 터 앞의 파발꾼 달음과 이야기하기',
          lines: [['달음', '어이쿠, 길손이구려! 여기가 어딘지 아시오? 나는 분명 한양 가는 파발을 달리던 참인데…', 'surprised'],
            ['달음', '사흘 전 밤, 하늘에서 떨어진 빛 조각을 주웠소. 파발 주머니에 넣은 순간 눈앞이 번쩍 — 정신 차려 보니 이 길이오.', 'sorrow'],
            ['?', ['그 조각, 우리가 찾던 거예요.', '지금 조각은 어디 있어요?']],
            ['달음', '말 안장 주머니에… 아니, 저놈! 흰 여우불에 놀라 말이 달아나오! 저 말부터 잡아 주시오!', 'angry']] },
        { type: 'chase', npc: 'horse', text: '여우불에 놀라 달아난 역마 따라잡기(달리기)',
          flee: '🐎 역마가 여우불 냄새에 놀라 내달린다 — 달려라!', caught: '🐎 역마의 고삐를 붙잡았다 — 워, 워' },
        { type: 'talk', npc: 'dareum', text: '달음에게 역마 데려다주기',
          lines: [['달음', '워, 워— 착하지. 고맙소, 길손. 그런데 이걸 보시오. 안장 주머니가 불에 그을려 찢겼소.', 'sorrow'],
            ['달음', '여우불이 말을 쫓은 게 아니었소. 주머니를 노린 게요. 조각을 문 흰 여우가 길 남쪽 끝으로 갔소.', 'angry'],
            ['?', ['구미호예요. 되찾아 올게요.', '같이 가요.']],
            ['달음', '파발꾼은 길을 잃은 짐을 끝까지 쫓는 법이오. 앞장서시오!']] },
        { type: 'kill', spot: 'st_fight', kinds: ['imp', 'imp', 'snowfox', 'hawk'], text: '길을 막은 여우불 무리 물리치기',
          enter: '⚔️ 길 위에 여우불이 번지며 도깨비들이 튀어나왔다' },
        { type: 'duel', spot: 'st_duel', kind: 'rift_fox_ember', shield: 'fire', adds: ['imp', 'raptor'], text: '셋째 조각을 문 여우불 구미호와 맞서기',
          enter: '🦊 여우불을 두른 흰 여우가 길을 막아섰다 — 여우불 구미호!',
          p2: '🔥 여우불 구미호가 옛 길의 여우불을 둘렀다 — 물로 깨라! 도깨비와 날쌘용이 뛰어든다',
          win: '🦊 여우불 구미호가 날개 조각을 떨구고 — 닫히는 시간 틈 속으로 흩어졌다' },
        { type: 'talk', npc: 'dareum', text: '달음과 이야기하기',
          lines: [['달음', '해냈소! 그 여우, 이제 틈 너머로도 못 돌아오겠구려. 자, 셋째 조각이오.', 'joy'],
            ['달음', '그런데 길손, 이 조각이 가야 할 곳이 있다고 했지요? 파발은 받는 이 손에 닿아야 끝나는 법이오.', 'fun'],
            ['?', ['서리봉 고원 별배로 가요.', '같이 가 줄래요?']],
            ['달음', '말은 여기 두고, 발로 먼저 가 있겠소. 파발꾼 다리를 얕보지 마시오!']] },
        { type: 'go', spot: 'fr_ship', text: '날개 조각 셋을 들고 서리봉 고원 별배로' },
        { type: 'light', spot: 'fr_ship', off: WING_SEAM, text: '별배 날개 이음매에 조각 셋을 끼우고 원소 스킬로 불 넣기' },
        { type: 'talk', npc: 'bandi', text: '반디와 이야기하기',
          lines: [['반디', '삐— 날개 조각 셋, 연결 완료. 별배 심장 출력 백 퍼센트. 기동합니다!', 'joy'],
            ['달음', '허어, 쇳덩이 배가 하늘로… 내 평생 이런 파발은 처음이오.', 'surprised'],
            ['?', ['드디어 떴다!', '반디, 이제 어디로 가?']],
            ['반디', '틈이 닫히는 방향을 따라가면 이 배가 온 시대에 닿을 겁니다. 그 전까지 — 이 하늘은 여러분 것입니다.', 'fun'],
            ['달음', '그 길, 나도 따라가겠소. 파발꾼은 길 끝을 봐야 직성이 풀리니까!', 'fun']] }
      ] },
    /* ⑲-38 4부 첫 장 — 무대는 은하 나루(skyport.js). 반디 → 틈 고개 → 아라 → 착륙판 무리 → 아라 → 계류 탑 옆면 타기(꼭대기에 서야,
       GPS 판은 탑 곁) → 반디(별배를 몰고 옴 — 이때부터 나루에 매인다) → 계류된 별배 지키기(동쪽 부스 쪽 빼고 일곱 방향) → 아라 */
    { id: 'ch16', name: '제16장 · 별배가 돌아온 나루', ar: 38,
      reward: { knot: 6, gold: 4500, guide: 5, secret: 5, party: 1300 },
      steps: [
        { type: 'talk', npc: 'bandi', text: '별배 곁의 반디와 이야기하기',
          lines: [['반디', '삐— 별배가 뜨고 나서 틈이 닫히는 방향을 쫓았습니다. 태양 신도시 남쪽 끝입니다.', 'surprised'],
            ['반디', '그곳에 틈이 문처럼 열렸습니다. 문 너머 좌표는… 제 기억 속 별배의 집, 은하 나루.', 'sorrow'],
            ['?', ['별배가 온 곳이구나.', '같이 가 보자.']],
            ['반디', '먼저 가 주십시오. 나루의 계류 신호가 살아 있으면 별배를 몰고 뒤따르겠습니다.']] },
        { type: 'go', spot: 'sp_gate', text: '태양 신도시 남쪽 끝, 틈 고개 너머로' },
        { type: 'talk', npc: 'ara', text: '별배 나루의 나루지기 아라와 이야기하기',
          lines: [['아라', '…손님? 틈 고개로 사람이 넘어온 건 몇 해 만이에요!', 'surprised'],
            ['?', ['별배를 알아요?', '여기가 은하 나루예요?']],
            ['아라', '별배는 이 나루의 배였어요. 어느 밤 선장님을 태우고 틈으로 떠난 뒤로 돌아오지 않았죠. 저는 그날부터 기다렸고요.', 'sorrow'],
            ['아라', '별배가 살아 있다고요? 그럼 — 앗, 틈 짐승들이 착륙판을 차지했어요!', 'angry']] },
        { type: 'kill', spot: 'sp_fight', kinds: ['raptor', 'hawk', 'hawk', 'rockbear'], text: '착륙판을 차지한 시간 틈 무리 물리치기',
          enter: '⚔️ 착륙판 위에 시간 틈 짐승들이 버티고 섰다' },
        { type: 'talk', npc: 'ara', text: '아라와 이야기하기',
          lines: [['아라', '고마워요. 이제 계류 탑 신호만 켜면 돼요. 꼭대기 빛 공이 꺼져서 별배가 길을 못 찾을 거예요.', 'joy'],
            ['아라', '승강기는 녹아내렸고… 탑 옆면을 타고 오를 수 있겠어요? 열여덟 미터예요.'],
            ['?', ['올라가 볼게요.', '높네요…']],
            ['아라', '꼭대기에 서면 신호가 저절로 켜져요. 떨어지면 날개를 펴요!']] },
        { type: 'climb', spot: 'sp_port', pole: 'sp_tower', text: '계류 탑 옆면을 타고 꼭대기로 올라 신호 켜기',
          done: '💡 계류 탑 꼭대기 — 빛 공에 신호가 켜졌다', gpsDone: '💡 계류 탑 밑 — 아라가 부스에서 신호를 켰다' },
        { type: 'talk', npc: 'bandi', text: '별배를 몰고 온 반디와 이야기하기',
          lines: [['반디', '삐— 계류 신호 수신. 별배, 은하 나루에 계류 완료. …돌아왔습니다.', 'joy'],
            ['아라', '정말 별배예요… 날개가 바뀌었지만 틀림없어요!', 'surprised'],
            ['?', ['어서 와, 별배.', '반디, 수고했어.']],
            ['아라', '그런데 계류 불빛에 틈 짐승들이 또 몰려와요. 계류 팔이 풀리면 별배가 또 떠내려가요!', 'angry']] },
        { type: 'defend', spot: 'sp_altar', name: '계류된 별배', who: '시간 틈 짐승들이', dirs: [0, 45, 135, 180, 225, 270, 315],
          waves: [['raptor', 'hawk', 'hawk'], ['rockbear', 'raptor', 'imp', 'snowfox'], ['rockbear', 'raptor', 'raptor', 'hawk', 'vine']],
          text: '별배 계류대 지키기' },
        { type: 'talk', npc: 'ara', text: '아라와 이야기하기',
          lines: [['아라', '지켰어요… 별배가 다시 나루에 있어요. 고마워요.', 'joy'],
            ['반디', '삐— 별배 항해 기록 복구. 마지막 기록: 선장, 옛 절터 종소리를 따라 틈으로.', 'surprised'],
            ['?', ['선장님이 절터로?', '종소리?']],
            ['아라', '절터 종은 수백 년 전에 떨어져 나뒹구는데… 가끔 밤마다 울려요. 선장님이 거기서 무언가를 들으셨나 봐요.', 'sorrow'],
            ['아라', '나루는 제가 지킬게요. 별배도 여기 쉬게 두세요. 이제 여기가 여러분 나루이기도 하니까!', 'fun']] }
      ] },
    /* ⑲-39 4부 둘째 장 — 은하 나루 서쪽 옛 절터. 아라 → 절터 → 한결 → 쓰러진 종(작은 발견) 곁 무리 → 한결 → 이끼 이무기(2단계 초 방패 —
       풍으로) → 한결 → 반디(견인 빛줄로 종을 종각에 — 이때부터 걸린다) → 종각 종 울리기(등롱 없이 원소) → 한결 */
    { id: 'ch17', name: '제17장 · 옛 절터의 종', ar: 40,
      reward: { knot: 6, gold: 4750, guide: 5, secret: 5, party: 1350 },
      steps: [
        { type: 'talk', npc: 'ara', text: '나루지기 아라와 이야기하기',
          lines: [['아라', '어젯밤에도 울렸어요. 옛 절터 쪽에서 — 뎅, 하고 딱 한 번.', 'surprised'],
            ['?', ['떨어진 종이 운다고?', '선장님 기록의 그 종소리?']],
            ['아라', '절터엔 늘 한 분이 계세요. 스스로 종지기라고 하시는데… 종이 떨어진 지 수백 년인데도요.', 'sorrow'],
            ['아라', '선장님이 무얼 들으셨는지, 그분이라면 알 거예요.']] },
        { type: 'go', spot: 'sp_temple', text: '은하 나루 서쪽 옛 절터로' },
        { type: 'talk', npc: 'hangyeol', text: '옛 절터의 종지기 한결과 이야기하기',
          lines: [['한결', '종을 찾아왔소? …별배를 탄 그 선장도 같은 말을 했지.', 'surprised'],
            ['?', ['선장님을 만났어요?', '종은 어디 있어요?']],
            ['한결', '나는 이 절의 종지기요. 종각이 무너지던 밤 종을 붙들다 시간 틈에 휩쓸려 — 눈을 떠 보니 절은 주춧돌만 남았더군.', 'sorrow'],
            ['한결', '종은 그때 서쪽 비탈로 굴러떨어졌소. 요즘 밤마다 우는 건 종이 아니오 — 종을 감은 무언가가 틈 짐승을 부르는 소리지.', 'angry'],
            ['한결', '선장도 그 울음을 따라 비탈로 갔소. 먼저 비탈에 몰린 짐승들부터 쫓아 주시오.']] },
        { type: 'kill', spot: 'sp_bell_fight', kinds: ['vine', 'vine', 'raptor', 'hawk'], text: '쓰러진 종 곁에 몰려든 틈 짐승 물리치기',
          enter: '⚔️ 이끼 덮인 종 곁에 틈 짐승들이 똬리를 틀었다' },
        { type: 'talk', npc: 'hangyeol', text: '쓰러진 종 곁의 한결과 이야기하기',
          lines: [['한결', '이 종이오. 이끼가 두껍게 덮였어도 소리는 그대로요.', 'joy'],
            ['한결', '…쉿. 종 속에서 무언가 몸을 뒤채는 소리가 들리오?', 'surprised'],
            ['?', ['뭔가 있어요!', '물러나요!']],
            ['한결', '이무기요! 틈에서 기어 나와 종에 똬리를 틀고 수백 년 이끼를 먹은 놈 — 덩굴 비늘은 바람이 찢소!', 'angry']] },
        { type: 'duel', spot: 'sp_bell_duel', kind: 'moss_serpent', shield: 'grass', adds: ['vine', 'hawk'], text: '종을 감은 이끼 이무기와 맞서기',
          enter: '🐍 종을 감고 있던 이끼 이무기가 머리를 들었다!',
          p2: '🌿 이끼 이무기가 덩굴 비늘을 곤두세웠다 — 바람으로 찢어라! 덩굴뱀과 회오리매가 뛰어든다',
          win: '🐍 이무기가 종에서 풀려나 — 틈 속으로 스르르 사라졌다' },
        { type: 'talk', npc: 'hangyeol', text: '한결과 이야기하기',
          lines: [['한결', '풀려났소… 종이 다시 숨을 쉬는구려.', 'joy'],
            ['한결', '허나 이 무게를 어찌 종각까지 올린단 말이오. 옛날엔 스님 서른이 밧줄로 끌어 올렸소.', 'sorrow'],
            ['?', ['별배라면 들 수 있어요.', '반디를 불러 볼게요.']],
            ['한결', '하늘 배로 종을 든다고? …허허, 오래 살고 볼 일이오.', 'fun']] },
        { type: 'talk', npc: 'bandi', text: '별배를 몰고 온 반디와 이야기하기',
          lines: [['반디', '삐— 별배 견인 빛줄 연결. 무게 십이 톤. 들어 올립니다.', 'surprised'],
            ['한결', '종이… 하늘을 나는구려!', 'surprised'],
            ['?', ['종각 들보에 맞춰!', '천천히, 반디.']],
            ['반디', '삐— 종각 들보에 걸었습니다. 새 종고리는 별배 계류 쇠붙이로 만들었습니다.', 'joy'],
            ['한결', '앞날의 쇠로 옛 종을 걸다니. 자, 이제 종을 울려 주시오 — 무엇으로든 힘껏!', 'fun']] },
        { type: 'light', spot: 'sp_belfry', bell: true, text: '종각에 다시 건 종을 원소 스킬로 울리기' },
        { type: 'talk', npc: 'hangyeol', text: '한결과 이야기하기',
          lines: [['한결', '…삼백 년 만의 종소리요. 이 소리를 다시 듣다니.', 'sorrow'],
            ['반디', '삐— 종소리에 응답 신호. 남쪽, 은하역 방향 — 열차 기적 소리입니다.', 'surprised'],
            ['?', ['저 녹슨 역에서 열차가?', '선장님의 신호일까?']],
            ['한결', '그 선장이 떠나며 말했소. \'종이 다시 울리면 막차가 한 번 더 온다\'고. 무슨 뜻인지는 나도 모르오.'],
            ['한결', '나는 이제 종 곁을 지키겠소. 종지기가 종 곁에 있어야지. 가 보시오 — 은하역으로.', 'fun']] }
      ] },
    /* ⑲-40 4부 끝 — 은하역·태양광 밭. 반디(종각) → 은하역 → 도담 → 밭 무리 → 변전함에 원소(등롱 없이 — 이때부터 막차에 불) →
       도담 → 선장의 잔상 쫓기(선로 위) → 도담(선로 끝) → 출발을 기다리는 막차 지키기(북쪽 객차 쪽 빼고 다섯) → 도담 · 도담 합류 */
    { id: 'ch18', name: '제18장 · 은하역 막차', ar: 42, join: 'story_dodam',
      reward: { knot: 6, gold: 5000, guide: 6, secret: 5, party: 1400 },
      steps: [
        { type: 'talk', npc: 'bandi', text: '종각 곁의 반디와 이야기하기',
          lines: [['반디', '삐— 기적 소리 분석 완료. 발신지 은하역, 신호 종류… 막차 운행 예고.', 'surprised'],
            ['반디', '역에 생체 신호 하나. 녹슨 역에 사람이 있습니다.'],
            ['?', ['가 보자, 은하역.', '막차라니…']],
            ['반디', '먼저 가 주십시오. 저는 선로 위 하늘을 살피며 뒤따르겠습니다.']] },
        { type: 'go', spot: 'sp_station', text: '은하 나루 남쪽 은하역으로' },
        { type: 'talk', npc: 'dodam', text: '은하역의 기관사 도담과 이야기하기',
          lines: [['도담', '종소리 들었어요? 어젯밤 이 녹슨 막차 전조등이 혼자 깜빡였어요. 십 년 만에요!', 'surprised'],
            ['도담', '나는 이 역 마지막 기관사예요. 선로가 끊긴 뒤로도 막차를 두고 떠날 수가 없어서.', 'sorrow'],
            ['?', ['별배 선장님을 알아요?', '막차를 움직일 수 있어요?']],
            ['도담', '선장이요? 그 사람이 막차 표를 끊었어요 — 행선지 칸이 비어 있는 표를. 그러고는 선로 끝 틈으로 걸어 들어갔죠.'],
            ['도담', '막차를 깨우려면 전기부터예요. 서쪽 태양광 밭 변전함이 틈 짐승들 때문에 꺼져 버렸어요.', 'angry']] },
        { type: 'kill', spot: 'sp_farm_fight', kinds: ['raptor', 'raptor', 'imp', 'rockbear'], text: '태양광 밭을 헤집는 틈 짐승 물리치기',
          enter: '⚔️ 부서진 태양광 판 사이로 틈 짐승들이 튀어나왔다' },
        { type: 'light', spot: 'sp_substation', bare: true, text: '꺼진 변전함에 원소 스킬로 전기 넣기',
          done: '⚡ 변전함에 전기가 들어왔다 — 은하역 쪽에서 불빛이 번쩍인다' },
        { type: 'talk', npc: 'dodam', text: '도담과 이야기하기',
          lines: [['도담', '전조등이 켜졌어요! 막차가… 숨을 쉬어요!', 'joy'],
            ['도담', '어? 선로 위에 누가 — 저 모자, 선장이에요! 그런데 몸이 비쳐 보여요.', 'surprised'],
            ['?', ['선장님!', '잔상이야, 쫓아가자!']],
            ['도담', '운행 기록부를 들고 남쪽 선로로 가요! 붙잡아 줘요, 나는 막차를 데워 둘게요!', 'angry']] },
        { type: 'chase', npc: 'captain', text: '운행 기록부를 든 선장의 잔상 따라잡기(달리기)',
          flee: '👤 선장의 잔상이 기록부를 들고 선로 위로 달아난다 — 달려라!', caught: '👤 잔상을 붙잡자 — 흩어지며 운행 기록부만 남았다' },
        { type: 'talk', npc: 'dodam', text: '선로 끝의 도담과 이야기하기',
          lines: [['도담', '잔상은 흩어지고… 기록부만 남았네요.', 'sorrow'],
            ['도담', '마지막 장 — \'막차 행선지: 틈 너머 첫 정거장. 선장은 먼저 내림.\'', 'surprised'],
            ['?', ['선장님은 틈 너머에 있어!', '다음 줄은?']],
            ['도담', '끝 줄은 선장 글씨예요. \'종이 울리고, 별배가 돌아오고, 막차가 달리면 — 그 정거장에서 다시 만나자.\''],
            ['도담', '앗, 전조등 불빛을 보고 짐승들이 역으로 몰려가요! 막차가 데워질 때까지 지켜야 해요!', 'angry']] },
        { type: 'defend', spot: 'sp_train', name: '출발을 기다리는 막차', who: '시간 틈 짐승들이', dirs: [45, 90, 135, 180, 225],
          waves: [['raptor', 'imp', 'hawk'], ['rockbear', 'raptor', 'snowfox', 'imp'], ['rockbear', 'rockbear', 'raptor', 'hawk', 'vine']],
          text: '출발을 기다리는 막차 지키기' },
        { type: 'talk', npc: 'dodam', text: '도담과 이야기하기',
          lines: [['도담', '보일러 압력 정상, 전조등 이상 없음… 막차, 출발 준비 끝!', 'joy'],
            ['반디', '삐— 별배·종·막차, 세 신호 모두 확인. 선장이 남긴 좌표가 열립니다 — 틈 너머 첫 정거장.', 'surprised'],
            ['?', ['같이 가 줄래요, 도담?', '선장님을 만나러 가자.']],
            ['도담', '막차 기관사가 막차를 두고 갈 순 없죠. 틈 너머 첫 정거장까지 — 제가 몰게요!', 'fun'],
            ['반디', '별배는 나루에, 종은 절터에, 막차는 선로에. 이 시대의 길이 다시 이어졌습니다.', 'joy']] }
      ] },
    /* ⑲-42 5부 첫 장 — 무대는 틈새 갈림길(crossing.js). 도담 → 막차 타기(sail — 키보드 판은 첫 정거장으로) → 반디 → 갈림목 무리 →
       멈춘 시계탑 옆면 타기(이때부터 바늘이 돈다) → 반디 → 떠 있는 섬돌 밟고 오르기 → 한별(섬돌 밑) → 멈춘 시간의 파수꾼(풍, 절반에서
       풍 방패 — 암으로) → 한별 */
    { id: 'ch19', name: '제19장 · 틈 너머 첫 정거장', ar: 44,
      reward: { knot: 6, gold: 5250, guide: 6, secret: 5, party: 1450 },
      steps: [
        { type: 'talk', npc: 'dodam', text: '은하역의 도담과 이야기하기',
          lines: [['도담', '보일러도 전조등도 문제없어요. 선로 끝 고개의 틈도 활짝 열렸고요!', 'joy'],
            ['반디', '삐— 선장 신호, 틈 너머에서 미약하게 수신. 끊겼다 이어졌다 합니다.', 'surprised'],
            ['?', ['가자, 틈 너머로.', '선장님이 기다려.']],
            ['도담', '그럼 올라타요. 오늘은 막차가 첫차예요!', 'fun']] },
        { type: 'sail', npc: 'dodam', to: 'cr_arrive', text: '도담의 막차를 타고 틈 너머로',
          lines: [['도담', '막차, 출발합니다! 다음 정거장은 — 틈 너머 첫 정거장!']],
          arrive: '🚂 막차가 기적을 울리며 틈을 지나 첫 정거장에 닿았다', walk: '🚂 막차가 틈 너머로 떠났다 — 틈 고개를 넘어 첫 정거장까지 걸어가자' },
        { type: 'talk', npc: 'bandi', text: '첫 정거장의 반디와 이야기하기',
          lines: [['반디', '삐— 이곳의 시계는 모두 같은 시각에 멈춰 있습니다. 시간이 멈춘 곳에선 신호가 갇힙니다.', 'surprised'],
            ['도담', '저기 성문 조각이 허공에 떠 있어요… 시간이 뒤엉킨 땅이네요.', 'surprised'],
            ['?', ['신호를 풀 방법은?', '시계를 다시 돌리면?']],
            ['반디', '남쪽 멈춘 시계탑 — 꼭대기 태엽을 풀면 신호가 풀릴 겁니다. 다만 갈림목에 틈 짐승이 모여 있습니다.']] },
        { type: 'kill', spot: 'cr_fork', kinds: ['snowfox', 'raptor', 'imp', 'hawk'], text: '갈림목에 모인 틈 짐승 물리치기',
          enter: '⚔️ 뒤엉킨 갈림목에서 틈 짐승들이 시대를 가리지 않고 튀어나왔다' },
        { type: 'climb', spot: 'cr_clock', pole: 'cr_clock', text: '멈춘 시계탑을 타고 올라 태엽 풀기(꼭대기에 서기)',
          done: '🕰️ 시계탑 꼭대기 — 태엽을 풀자 네 면 바늘이 다시 돈다', gpsDone: '🕰️ 시계탑 밑 — 반디가 날아올라 태엽을 풀었다' },
        { type: 'talk', npc: 'bandi', text: '시계탑 발치의 반디와 이야기하기',
          lines: [['반디', '삐— 시계가 다시 갑니다! 선장 신호… 선명합니다!', 'joy'],
            ['반디', '발신지 서쪽, 떠 있는 섬돌 꼭대기. 섬돌을 밟고 오를 수 있습니다.'],
            ['?', ['바로 갈게!', '높이는?']],
            ['반디', '열일곱 미터 남짓. 떨어지면 날개를 펴십시오.']] },
        { type: 'climb', spot: 'cr_steps', pole: 'cr_steps', text: '떠 있는 섬돌을 밟고 꼭대기에 오르기',
          done: '💎 마지막 섬돌에 올라섰다 — 섬돌 밑 틈 수정 아래에 누군가 서 있다', gpsDone: '💎 섬돌 밑 — 틈 수정 아래에 누군가 서 있다' },
        { type: 'talk', npc: 'hanbyeol', text: '섬돌 밑의 선장과 이야기하기',
          lines: [['한별', '정말 왔구나. 종이 울리고, 별배가 돌아오고, 막차가 달렸다는 뜻이지.', 'joy'],
            ['?', ['여기서 뭘 하고 계셨어요?', '반디가 기다렸어요.']],
            ['한별', '나는 별배 선장 한별. 틈이 시대를 삼키던 날, 이 틈 한가운데서 시간을 멈춰 틈이 더 벌어지지 않게 붙들고 있었다.', 'sorrow'],
            ['한별', '그런데 너희가 시계를 다시 돌렸으니 — 멈춰 있던 파수꾼도 깨어난다. 내려와라, 섬돌 곁이다!', 'angry']] },
        { type: 'duel', spot: 'cr_st_duel', kind: 'time_warden', shield: 'wind', adds: ['hawk', 'snowfox'], text: '깨어난 멈춘 시간의 파수꾼과 맞서기',
          enter: '⏳ 멈춘 시간 조각을 두른 거인이 금빛 가면을 들었다 — 멈춘 시간의 파수꾼!',
          p2: '🌪️ 파수꾼이 멈춘 바람을 둘렀다 — 바위로 깨라! 회오리매와 눈여우가 뛰어든다',
          win: '⏳ 파수꾼의 금빛 가면이 부서지고 — 멈춘 시간 조각이 흩어졌다' },
        { type: 'talk', npc: 'hanbyeol', text: '선장 한별과 이야기하기',
          lines: [['한별', '고맙다. 이제 틈은 멈춰 있지 않는다. 스스로 닫히지도 않고 — 누군가 틈의 끝을 찾아가 닫아야 해.', 'sorrow'],
            ['반디', '선장님… 별배는 은하 나루에 매여 있습니다.', 'sorrow'],
            ['한별', '알고 있다, 반디. 잘 지켜 줬구나. 날개가 바뀌었다지?', 'fun'],
            ['?', ['틈의 끝은 어디예요?', '같이 가요.']],
            ['한별', '첫 정거장 다음 역은 \'갈림길 끝\'. 틈이 처음 찢어진 곳이지. 준비가 되면 — 함께 가자.', 'joy']] }
      ] },
    /* ⑲-43 5부 끝 — 첫 정거장 동남쪽 하늘의 갈림길 끝 섬(crossing.js). 한별 → 막차로 섬 위(sail sky) → 반디 → 틈 짐승 다섯 → 한별 →
       매듭 석등 달 → 별 → 해 → 한별(틈이 오므라든다) → 매듭 제단 지키기 → 한별 → 틈 삼킨 별까마귀(빙, 절반에서 빙 방패 — 화로) →
       한별 · 한별 합류(틈이 닫힌다). 섬 위 단계는 sky — 키보드 판은 섬 윗면 층, GPS 판은 그 밑 땅 */
    { id: 'ch20', name: '제20장 · 갈림길 끝', ar: 46, join: 'story_hanbyeol',
      reward: { knot: 6, gold: 5500, guide: 6, secret: 5, party: 1500 },
      steps: [
        { type: 'talk', npc: 'hanbyeol', text: '첫 정거장의 선장 한별과 이야기하기',
          lines: [['한별', '저 위를 보게. 동쪽 하늘에 뜬 섬 — 저기가 갈림길 끝, 틈이 처음 찢어진 곳이다.', 'surprised'],
            ['한별', '틈이 찢어지던 날 선로가 통째로 들려 올라갔지. 막차 선로는 끊긴 채로 아직 그 섬까지 이어져 있어.'],
            ['?', ['막차로 갈 수 있어요?', '틈을 닫으러 가요.']],
            ['한별', '도담에게 부탁하자. 반디는 벌써 날아 올라갔다.', 'fun']] },
        { type: 'sail', npc: 'dodam', to: 'cr_rift_arrive', sky: true, text: '도담의 막차를 타고 갈림길 끝으로',
          lines: [['도담', '하늘로 끊긴 선로라도 선로는 선로죠! 막차, 갈림길 끝까지 — 출발!']],
          arrive: '🚂 막차가 끊긴 선로 조각을 밟고 올라 갈림길 끝 차막이에 닿았다', walk: '🚂 막차가 끊긴 선로 조각을 타고 하늘로 올랐다 — 섬 밑까지 걸어가자' },
        { type: 'talk', npc: 'bandi', text: '갈림길 끝의 반디와 이야기하기',
          lines: [['반디', '삐— 이곳에서 선로가 세 갈래로 갈립니다. 옛 나무 선로, 쇠 선로, 빛 선로.', 'surprised'],
            ['도담', '갈래마다 끝이 뚝 끊겨 있네요. 가다 만 선로처럼……', 'sorrow'],
            ['반디', '세 갈래가 서로 엉키며 틈을 찢었습니다. 틈 한가운데에 짐승이 모여 있습니다.'],
            ['?', ['짐승부터 치우자.', '한가운데로 가자.']]] },
        { type: 'kill', spot: 'cr_rift', sky: true, kinds: ['hawk', 'snowfox', 'raptor', 'imp', 'vine'], text: '틈 한가운데에 모인 틈 짐승 물리치기',
          enter: '⚔️ 찢어진 틈 밑에서 시대가 뒤섞인 짐승들이 쏟아져 나왔다' },
        { type: 'talk', npc: 'hanbyeol', text: '선장 한별과 이야기하기',
          lines: [['한별', '틈 밑을 보게. 옛 매듭 자리다 — 시대를 하나씩 묶어 두는 매듭이지.'],
            ['한별', '틈이 찢어진 차례대로 묶어야 한다. 옛날의 달, 지금의 별, 앞날의 해.'],
            ['?', ['달, 별, 해.', '차례가 틀리면요?']],
            ['한별', '다 풀린다. 차례만 지키면 돼 — 원소를 매듭 석등에 대 보게.', 'fun']] },
        { type: 'seal', spot: 'cr_rift', sky: true, order: ['moon', 'star', 'sun'], text: '틈 밑 매듭 석등을 차례(달 → 별 → 해)로 밝히기' },
        { type: 'talk', npc: 'hanbyeol', text: '선장 한별과 이야기하기',
          lines: [['반디', '삐— 세 갈래 끝의 닻이 켜졌습니다! 틈이 오므라듭니다!', 'joy'],
            ['한별', '아직이다. 틈이 닫히려 하면 틈 너머 짐승들이 한꺼번에 몰려온다.', 'angry'],
            ['?', ['매듭을 지킬게요.', '선장님은요?']],
            ['한별', '나는 틈을 붙들고 있겠다 — 매듭 제단이 무너지지 않게 지켜 다오!']] },
        { type: 'defend', spot: 'cr_rift', sky: true, name: '매듭 제단', who: '틈 짐승들이',
          waves: [['hawk', 'snowfox', 'raptor'], ['rockbear', 'imp', 'snowfox', 'hawk'], ['rockbear', 'raptor', 'vine', 'hawk', 'imp']],
          text: '틈이 닫히는 동안 매듭 제단 지키기' },
        { type: 'talk', npc: 'hanbyeol', text: '선장 한별과 이야기하기',
          lines: [['한별', '……온다. 틈을 처음 찢은 놈이다.', 'sorrow'],
            ['한별', '그날 세 갈래 선로를 한입에 삼키려다 틈을 찢고 스스로 틈 속에 갇혔던 짐승 — 틈 삼킨 별까마귀.', 'angry'],
            ['도담', '저, 저 날개 좀 봐요! 섬만 해요!', 'surprised'],
            ['?', ['같이 막아요, 선장님!', '여기서 끝내자.']],
            ['한별', '그래, 함께다. 이번엔 멈춰 두지 않는다 — 끝낸다!', 'angry']] },
        { type: 'duel', spot: 'cr_rift', sky: true, kind: 'rift_crow', shield: 'ice', adds: ['hawk', 'snowfox'], text: '틈을 처음 찢은 틈 삼킨 별까마귀와 맞서기',
          enter: '🐦‍⬛ 섬만 한 날개가 틈을 가리고 내려앉았다 — 틈 삼킨 별까마귀!',
          p2: '❄️ 별까마귀가 틈의 냉기를 두른다 — 불로 녹여라! 회오리매와 눈여우가 뛰어든다',
          win: '🐦‍⬛ 별까마귀가 틈 속으로 떨어지고 — 찢어진 틈이 소리 없이 닫혔다' },
        { type: 'talk', npc: 'hanbyeol', text: '선장 한별과 이야기하기',
          lines: [['한별', '……닫혔다. 틈이 처음 찢어진 곳이, 이제 그냥 하늘이다.', 'joy'],
            ['반디', '삐— 세 갈래 선로 신호, 모두 안정. 옛날도 지금도 앞날도 제자리에 있습니다.', 'joy'],
            ['도담', '막차는 계속 달릴 수 있겠네요. 첫 정거장도, 은하역도!', 'fun'],
            ['?', ['선장님은 이제 어떡하실 거예요?', '별배로 돌아가세요?']],
            ['한별', '별배는 나루에 매여 있고 틈은 닫혔다. 선장이 할 일은 다음 항로를 찾는 거지 — 이번엔 너희와 함께.', 'fun'],
            ['한별', '별배 선장 한별, 오늘부터 너희 편에 선다. 잘 부탁하네.', 'joy']] }
      ] },
    /* ⑲-45 6부 첫 장 — 무대는 잠긴 도읍(sunken.js). 한별(은하 나루 별배 곁) → 별배 타기(도읍 모래밭) → 반디 → 기지 앞 물짐승 →
       잔교 따라 선착장 → 여울 → 잠수정 타기(물속 불빛 따라 궁궐 기단) → 여울(테왁 불빛·반디의 지워진 칸 "등대") */
    { id: 'ch21', name: '제21장 · 바다 밑 등불', ar: 48,
      reward: { knot: 6, gold: 5750, guide: 6, secret: 5, party: 1550 },
      steps: [
        { type: 'talk', npc: 'hanbyeol', text: '은하 나루 별배 곁의 선장 한별과 이야기하기',
          lines: [['한별', '틈이 닫힌 날부터 별배 항로표에 없던 불빛 하나가 떠 있다. 소금 갯벌 너머 바다 밑이야.', 'surprised'],
            ['반디', '삐— 그 좌표… 별배가 떨어지기 전에 가려던 항로 끝과 같습니다. 그런데 제 기록엔 그 까닭이 없습니다.', 'sorrow'],
            ['한별', '선장이 제 항로를 모르면 안 되지. 원래 가려던 곳을 확인하러 가자.'],
            ['?', ['별배로 가요.', '바다 밑이라니…']],
            ['한별', '별배는 물에 못 들어가지만 바다 위까진 간다. 타게!', 'fun']] },
        { type: 'sail', npc: 'hanbyeol', to: 'sk_sand', text: '선장의 별배를 타고 옛 항로 끝으로',
          lines: [['한별', '별배, 남쪽 바다로! 반디, 항로를 잡아 다오.']],
          arrive: '🛸 별배가 바다 위에서 멈칫하더니 — 잠긴 도읍 모래밭에 우리를 내려 주었다', walk: '🛸 별배가 옛 항로 끝으로 떠났다 — 해무 어귀 너머 잠긴 도읍 모래밭까지 걸어가자' },
        { type: 'talk', npc: 'bandi', text: '모래밭의 반디와 이야기하기',
          lines: [['반디', '삐— 항로 신호가 여기서 물속으로 꺾입니다. 별배 기관이 저절로 멈췄습니다.', 'surprised'],
            ['한별', '저 물속을 보게. 기와 지붕이… 도읍 하나가 통째로 잠겨 있어.', 'surprised'],
            ['반디', '궁궐 둘레에 불빛이 흔들립니다. 옛 해녀가 물질할 때 들던 등불과 같은 빛깔입니다.'],
            ['?', ['어떻게 내려가지?', '저 쇠 갑판은 뭐야?']],
            ['반디', '모래밭 끝에 지금 시대의 해저 연구 기지가 있습니다. 잠수정 신호가 하나 살아 있습니다. 다만 기지 앞에 물짐승이 올라와 있습니다.']] },
        { type: 'kill', spot: 'sk_lab_front', kinds: ['toad', 'toad', 'raptor', 'hawk'], text: '해저 연구 기지 앞 모래밭에 올라온 물짐승 물리치기',
          enter: '⚔️ 기지 갑판 앞 모래밭에 물짐승들이 기어올라 왔다' },
        { type: 'go', spot: 'sk_dock', text: '기지 잔교를 따라 잠수정 선착장으로' },
        { type: 'talk', npc: 'yeoul', text: '잠수정 선착장의 여울과 이야기하기',
          lines: [['여울', '누, 누구세요? 이 기지엔 이제 저 혼자뿐인데요.', 'surprised'],
            ['?', ['물속 불빛을 따라왔어요.', '별배 선장과 함께 왔어요.']],
            ['여울', '저는 잠수 기사 여울. 해저 연구 기지 마지막 대원이에요. 틈이 닫히던 밤, 기지 불이 다 나갔어요.', 'sorrow'],
            ['여울', '그날부터 바다 밑에 옛 궁궐이 보이고, 그 둘레에 등불이 켜졌어요. 누군가 아직 물질을 하는 것처럼요.'],
            ['여울', '잠수정은 살아 있어요. 불빛까지 모셔다 드릴게요 — 대신 저도 그 불빛이 뭔지 알고 싶어요.', 'fun']] },
        { type: 'sail', npc: 'yeoul', to: 'sk_plinth', text: '여울의 잠수정을 타고 물속 불빛을 따라가기',
          lines: [['여울', '해치 닫습니다. 잠수정, 물속 불빛을 따라 — 잠항!']],
          arrive: '🌊 잠수정이 물속 불빛 사이로 내려갔다가 — 잠긴 궁궐 기단 곁에 떠올랐다', walk: '🌊 잠수정이 물속 불빛을 따라 잠항했다 — 물가를 따라 잠긴 궁궐 기단까지 걸어가자' },
        { type: 'talk', npc: 'yeoul', text: '궁궐 기단 위의 여울과 이야기하기',
          lines: [['여울', '가까이서 보니 등불이 아니었어요. 테왁 — 해녀들이 물에 띄우던 뒤웅박에 불이 들어 있어요.', 'surprised'],
            ['반디', '삐— 이 궁궐 좌표, 제 기록에… 있었습니다. 지워진 칸이 하나 있습니다. 읽을 수 없습니다.', 'sorrow'],
            ['?', ['누가 지웠을까?', '괜찮아, 반디?']],
            ['반디', '모르겠습니다. 다만 지워진 칸 끝에 적힌 말은 하나 — \'등대\'.', 'sorrow'],
            ['여울', '테왁이 궁궐 기와 사이로 이어져요. 물질하는 사람이 정말 있다면… 저 안쪽에 있을 거예요.', 'joy']] }
      ] },
    /* ⑲-46 6부 둘째 장 — 잠긴 궁궐·빛 돔(sunken.js). 여울 → 물새(곁채 앞) → 바지락 셋 → 물새(돔 문 앞) → 물길 석등 해 → 별 → 달 →
       물새 → 돔 문 자물쇠 지키기(동·서) → 여울(여덟째부터 문이 열린다) → 심해 등불아귀(돔 안, 수 — 절반에서 수 방패, 뇌로) → 물새 */
    { id: 'ch22', name: '제22장 · 잠긴 궁궐의 해녀', ar: 50,
      reward: { knot: 6, gold: 6000, guide: 6, secret: 5, party: 1600 },
      steps: [
        { type: 'talk', npc: 'yeoul', text: '궁궐 기단 위의 여울과 이야기하기',
          lines: [['여울', '테왁 불빛이 동쪽 곁채 쪽에서 가장 밝아요. 누가 거기서 숨을 고르는 것 같아요.', 'surprised'],
            ['반디', '삐— 사람 한 명의 체온 신호. 곁채 앞에 있습니다.'],
            ['?', ['가 볼게.', '조심해서 다가가자.']],
            ['여울', '물이 얕아도 기와가 미끄러워요. 천천히 가세요.', 'fun']] },
        { type: 'talk', npc: 'mulsae', text: '곁채 앞의 해녀와 이야기하기',
          lines: [['물새', '……뭍사람이 여기까지 오다니. 숨이 길구려.', 'surprised'],
            ['?', ['누구세요?', '테왁 불빛을 따라왔어요.']],
            ['물새', '나는 해녀 물새. 도읍이 물에 잠기던 날 아침, 물질 나갔다가 그대로 이 물에 갇혔지.', 'sorrow'],
            ['물새', '그날부터 해가 몇 번 떴는지 모르겠소. 다만 저 둥근 빛 집 문이 닫혀 있는 건 알지.', 'sorrow'],
            ['물새', '문 앞 물길 석등 셋에 불을 넣으면 문이 풀린다오. 옛날엔 조개 기름으로 불을 살렸는데… 바지락 좀 캐다 주겠소?']] },
        { type: 'gather', item: 'clam', count: 3, text: '석등 기름으로 쓸 바지락 셋 캐기(갯벌 물가)' },
        { type: 'talk', npc: 'mulsae', text: '빛 돔 문 앞의 물새와 이야기하기',
          lines: [['물새', '기름은 됐소. 이제 차례가 문제지 — 물길 석등은 해 뜨는 쪽, 별 뜨는 쪽, 달 뜨는 쪽 차례로 켰다오.', 'fun'],
            ['여울', '기지 수중 조명 배치도에도 석등 자리가 적혀 있어요. 해, 별, 달 — 맞아요!', 'surprised'],
            ['?', ['해, 별, 달.', '틀리면 어떻게 돼요?']],
            ['물새', '다 꺼지지. 물은 두 번 가르쳐 주지 않는다오.']] },
        { type: 'seal', spot: 'sk_dome_front', order: ['sun', 'star', 'moon'], text: '빛 돔 문 앞 물길 석등을 차례(해 → 별 → 달)로 밝히기' },
        { type: 'talk', npc: 'mulsae', text: '빛 돔 문 앞의 물새와 이야기하기',
          lines: [['반디', '삐— 돔 문 빛 자물쇠가 돌기 시작했습니다. 다 풀리려면 시간이 걸립니다.', 'surprised'],
            ['물새', '물이 술렁이는구려. 불을 보고 바다 것들이 몰려오고 있소.', 'angry'],
            ['?', ['자물쇠를 지킬게요.', '어느 쪽에서 와요?']],
            ['여울', '동쪽과 서쪽이에요! 문 앞을 지켜 주세요!']] },
        { type: 'defend', spot: 'sk_dome_front', name: '빛 돔 문 자물쇠', who: '바다 것들이', dirs: [84, 96, 264, 276],
          waves: [['toad', 'toad', 'hawk'], ['toad', 'raptor', 'snowfox', 'hawk'], ['rockbear', 'toad', 'raptor', 'snowfox', 'hawk']],
          text: '빛 돔 문 자물쇠가 풀리는 동안 지키기' },
        { type: 'talk', npc: 'yeoul', text: '빛 돔 문 앞의 여울과 이야기하기',
          lines: [['반디', '삐— 자물쇠 해제. 빛 돔 문이 열립니다.', 'joy'],
            ['여울', '안이… 말라 있어요. 바다 밑인데 물이 한 방울도 없어요!', 'surprised'],
            ['물새', '저 안에 무언가 빛나는구려. 내가 본 테왁 불빛보다 훨씬 큰 것이.', 'sorrow'],
            ['?', ['들어가 보자.', '조심해, 다들.']],
            ['물새', '등불을 단 물고기라… 옛 어른들이 말하던 심해 등불아귀인가. 빛을 먹고 산다더니.', 'angry']] },
        { type: 'duel', spot: 'sk_dome_duel', kind: 'abyss_angler', shield: 'water', adds: ['toad', 'raptor'], text: '돔 안에 숨어 빛을 먹던 심해 등불아귀와 맞서기',
          enter: '🐟 돔 안 어둠 속에서 등불 하나가 떠올랐다 — 심해 등불아귀!',
          p2: '💧 등불아귀가 물 비늘을 세운다 — 번개로 깨라! 물두꺼비와 날쌘용이 뛰어든다',
          win: '🐟 등불아귀의 등불이 꺼지고 — 어둠 속으로 비늘 조각만 흩어졌다' },
        { type: 'talk', npc: 'mulsae', text: '돔 안의 물새와 이야기하기',
          lines: [['물새', '……이 빛 집이 바다를 밀어내고 있었구려. 도읍이 잠기던 날에도 이 안만은 마른 땅이었을 테지.', 'sorrow'],
            ['여울', '저 안쪽 기록실 — 옛 기단 위에 앞 시대 단말이 서 있어요. 기지 자료에도 없는 건물이에요.', 'surprised'],
            ['반디', '삐— 기록실에서 제 신호와 같은 주파수가 나옵니다. 지워진 칸이… 저 안에 있습니다.', 'surprised'],
            ['?', ['기록실로 가자.', '물새 님도 같이 가요.']],
            ['물새', '갇힌 줄로만 알았는데, 기다린 거였나 보오. 좋소 — 끝까지 같이 가 보지.', 'joy']] }
      ] },
    /* ⑲-47 6부 끝 — 빛 돔 기록실(sunken.js). 파랑(기록실 앞) → 옛 등대 돌탑 타고 난간 판에 서기(landform 기둥 sk_light) →
       난간 판 위에서 꺼진 등롱에 원소(perch — GPS 판은 곁) → 반디(등대 발치) → 파랑(기록 재생) → 돔 파수 거신(암, 절반에서 암 방패 — 초로) →
       물새 · 물새 합류. 등대는 넷째 단계부터 켜진다(sunken LIGHT_FROM) */
    { id: 'ch23', name: '제23장 · 빛 돔의 기록', ar: 52, join: 'story_mulsae',
      reward: { knot: 6, gold: 6250, guide: 6, secret: 5, party: 1650 },
      steps: [
        { type: 'talk', npc: 'parang', text: '기록실 앞의 파랑과 이야기하기',
          lines: [['파랑', '방문자 확인. 빛 돔 관리 인공지능 파랑입니다. 문이 열린 것은 도읍이 잠긴 뒤 처음입니다.', 'surprised'],
            ['반디', '삐— 파랑. 그 이름… 제 기록에 있습니다. 지워진 칸 바로 앞에.', 'surprised'],
            ['파랑', '조종 기계 반디, 별배 소속. 당신의 기록 사본이 이 기록실에 맡겨져 있습니다. 다만 열람할 전력이 모자랍니다.'],
            ['파랑', '돔은 옛 등대에서 전력을 받았습니다. 도읍이 잠기던 날 등대 불이 꺼진 뒤로, 기록실은 옥새 봉인만 남은 채 잠들어 있습니다.', 'sorrow'],
            ['?', ['등대에 불을 켜면 돼요?', '지워진 칸 끝 말, \'등대\'…']],
            ['물새', '북쪽 바위섬 등대 말이오? 물질 나갈 때 늘 보던 불이오. 돌탑을 타고 오르면 등롱까지 닿을 거요.'],
            ['여울', '제 잠수복 불빛으로 물길을 비춰 드릴게요. 꼭대기 난간 판에 서야 등롱에 손이 닿아요.', 'fun']] },
        { type: 'climb', spot: 'sk_light', pole: 'sk_light', text: '옛 등대 돌탑을 타고 난간 판까지 오르기',
          done: '🗼 등대 난간 판에 올라섰다 — 꺼진 등롱이 눈앞에 있다', gpsDone: '🗼 등대 발치에 닿았다 — 여울이 잠수복 불빛으로 등롱을 비춘다' },
        { type: 'light', spot: 'sk_light', bare: true, perch: 'sk_light', text: '꺼진 등롱에 원소 스킬로 불 넣기(난간 판 위에서)',
          done: '🗼 등롱에 불이 들어왔다 — 빛줄기가 돌며 빛 돔 꼭대기를 비춘다', away: '🗼 등롱은 탑 꼭대기에 있다 — 난간 판에 올라서야 불이 닿는다' },
        { type: 'talk', npc: 'bandi', text: '등대 발치의 반디와 이야기하기',
          lines: [['반디', '삐— 등대 빛 수신. 빛 돔 전력 회복. 기록실이 깨어납니다.', 'joy'],
            ['반디', '……이상합니다. 이 자리에 서니 무언가 떠오릅니다. 그날 별배는 이 등대 불빛을 보고 항로를 잡았습니다.', 'surprised'],
            ['반디', '그런데 불빛이 한순간 꺼졌습니다. 누군가 먹구름으로 등롱을 덮었습니다. 거기서 기억이 끊깁니다.', 'sorrow'],
            ['?', ['먹구름이라고?', '기록실로 돌아가자.']],
            ['반디', '나머지는 기록실 사본에 있을 겁니다. 파랑에게 돌아가 주십시오.']] },
        { type: 'talk', npc: 'parang', text: '기록실 앞의 파랑과 이야기하기',
          lines: [['파랑', '전력 회복 확인. 옥새 봉인 해제. 조종 기계 반디의 기록 사본을 재생합니다.'],
            ['반디', '(기록 재생) 별배 항로 끝, 잠긴 도읍 등대. 등롱 꺼짐. 항로 밖에서 먹구름 접근 — 먹구름 속에 사람 그림자, 가면.', 'surprised'],
            ['반디', '(기록 재생) 그림자가 손을 들자 먹구름이 별배를 덮쳤습니다. 기관 정지, 추락. …그리고 그림자가 제 기록을 지웠습니다.', 'sorrow'],
            ['물새', '도읍이 잠기던 날에도 하늘이 그렇게 검었소. 파도보다 먹구름이 먼저 왔었지.', 'sorrow'],
            ['?', ['별배를 떨어뜨린 건 틈이 아니었어…', '먹구름을 부리는 누군가가 있어.']],
            ['파랑', '경고. 기록 복원이 \'기록을 지운 자\'가 남긴 명령에 걸렸습니다. 돔 파수 거신이 침입자 제거를 시작합니다.', 'angry'],
            ['여울', '돔 바닥이 울려요! 바위 거인이 — 서쪽에서 일어나요!', 'surprised']] },
        { type: 'duel', spot: 'sk_dome_duel', kind: 'dome_colossus', shield: 'rock', adds: ['rockbear', 'imp'], text: '기록을 지운 자의 명령으로 깨어난 돔 파수 거신과 맞서기',
          enter: '🗿 돔 서쪽 바닥이 갈라지며 — 돔 파수 거신이 일어섰다!',
          p2: '🪨 거신이 바위 껍질을 두른다 — 풀(초)로 깨라! 바위곰과 불도깨비가 뛰어든다',
          win: '🗿 파수 거신이 무너지고 — 가슴에 박혀 있던 먹구름 조각이 흩어졌다' },
        { type: 'talk', npc: 'mulsae', text: '돔 안의 물새와 이야기하기',
          lines: [['물새', '……바위 속에 먹구름이 박혀 있었구려. 누가 이 빛 집까지 손을 뻗은 게요.', 'angry'],
            ['파랑', '파수 거신 정지. 명령 기록 추적 — 발신지는 하늘 항로 위, 구름 위입니다.'],
            ['반디', '삐— 기억이 돌아왔습니다. 별배가 가려던 곳은 등대가 아니라, 등대가 비추던 하늘 항로였습니다.', 'joy'],
            ['?', ['먹구름을 부리는 자를 찾자.', '물새 님은 이제 어떡해요?']],
            ['물새', '물은 두 번 가르쳐 주지 않는다 했지. 이번엔 나도 안 놓치겠소 — 도읍을 잠기게 한 그 먹구름을.', 'angry'],
            ['물새', '해녀 물새, 오늘부터 뭍사람들 편이오. 숨 긴 거 하나는 자신 있소.', 'joy']] }
      ] },
    /* ⑲-49 7부 첫 장 — 구름 위 항로 하늘 사당 섬(skyroute.js). 한별(도읍 모래밭) → 별배로 사당 섬(sail sky) → 새벽 → 마당 먹구름 졸개 넷 →
       새벽 → 바람 방울 석등 별 → 해 → 달 → 새벽(먹구름은 위에서 흘러내린다 · 사당 서쪽 바람 기둥). 방울을 다 울리면(일곱째 단계부터) 사당 위 먹구름이 걷힌다.
       섬 위 단계는 sky — 키보드 판은 섬 윗면 층, GPS 판은 그 밑 땅 */
    { id: 'ch24', name: '제24장 · 하늘 사당의 바람 방울', ar: 54,
      reward: { knot: 6, gold: 6500, guide: 6, secret: 5, party: 1700 },
      steps: [
        { type: 'talk', npc: 'hanbyeol', text: '모래밭의 선장 한별과 이야기하기',
          lines: [['한별', '등대 빛줄기가 도는 걸 봤나? 빛 끝이 늘 같은 하늘을 짚고 멈춰. 저기 — 구름 위에 섬이 떠 있어.', 'surprised'],
            ['반디', '삐— 별배 항로표에 새 신호 둘. 하나는 옛 사당의 방울 소리, 하나는… 지금 시대 기상 비행선의 구조 신호입니다.', 'surprised'],
            ['한별', '먹구름을 부리는 자의 명령이 구름 위에서 왔다고 했지. 별배가 원래 가려던 항로도 저 위다.'],
            ['?', ['별배로 올라가요.', '비행선에 누가 있을지도 몰라요.']],
            ['한별', '이번엔 하늘길이다. 별배가 제일 잘하는 거지 — 타게!', 'fun']] },
        { type: 'sail', npc: 'hanbyeol', to: 'sr_shrine_land', sky: true, text: '선장의 별배를 타고 하늘 항로로',
          lines: [['한별', '별배, 등대 빛줄기를 따라 위로! 반디, 구름 사이 길을 읽어 다오.']],
          arrive: '🛸 별배가 구름을 뚫고 올라 — 기와 사당이 선 떠 있는 섬에 우리를 내려 주었다', walk: '🛸 별배가 등대 빛줄기를 따라 하늘로 올랐다 — 섬 밑(등대 서쪽)까지 걸어가자' },
        { type: 'talk', npc: 'saebyeok', text: '사당 앞의 무녀와 이야기하기',
          lines: [['새벽', '……바람이 손님을 데려왔구려. 사당이 하늘로 들린 뒤로 사람 발소리는 처음이오.', 'surprised'],
            ['?', ['누구세요?', '여기가 하늘 사당인가요?']],
            ['새벽', '나는 바람 무녀 새벽. 이 사당의 바람 방울을 지켰소. 방울이 울면 바람이 길을 알고, 구름이 물러났지.', 'sorrow'],
            ['새벽', '그런데 먹구름이 내려앉아 방울을 틀어막았소. 마당엔 먹구름 먹은 것들이 들끓고.', 'angry'],
            ['한별', '먹구름이 저 혼자 내려앉았을 리 없지. 마당부터 치우자.']] },
        { type: 'kill', spot: 'sr_shrine', sky: true, kinds: ['imp', 'imp', 'raptor', 'hawk'], text: '사당 마당의 먹구름 졸개 물리치기',
          enter: '⚔️ 사당 마당의 먹구름 속에서 졸개들이 뛰쳐나왔다' },
        { type: 'talk', npc: 'saebyeok', text: '사당 앞의 무녀와 이야기하기',
          lines: [['새벽', '고맙소. 이제 방울을 울릴 차례요. 바람 방울은 하루를 따라 울렸지 — 새벽별, 한낮의 해, 밤의 달.', 'fun'],
            ['반디', '삐— 마당 석등 셋에서 방울 주파수가 나옵니다. 별, 해, 달 무늬.'],
            ['?', ['별, 해, 달.', '틀리면요?']],
            ['새벽', '바람은 순서를 잊지 않소. 틀리면 방울이 다 멎고 처음부터요.']] },
        { type: 'seal', spot: 'sr_shrine', sky: true, order: ['star', 'sun', 'moon'], text: '사당 마당 바람 방울 석등을 차례(별 → 해 → 달)로 울리기' },
        { type: 'talk', npc: 'saebyeok', text: '사당 앞의 무녀와 이야기하기',
          lines: [['새벽', '……들리오? 방울이 다시 운다. 먹구름이 걷히는구려.', 'joy'],
            ['반디', '삐— 구름 틈으로 더 높은 섬 하나. 비행선 구조 신호가 거기서 나옵니다.', 'surprised'],
            ['새벽', '저 먹구름은 땅에서 오른 게 아니오. 위에서 흘러내렸소 — 누가 위에서 구름을 빚어 흘려보내는 게지.', 'angry'],
            ['?', ['위로 올라갈 길은요?', '구름을 빚는 자…']],
            ['새벽', '방울이 울었으니 바람이 길을 낼 거요. 사당 서쪽 끝에 바람 기둥이 설 테니, 타고 올라 날개를 펴시오.', 'fun'],
            ['한별', '비행선이라면 지금 시대 사람이 갇혀 있을 거야. 서두르자.']] }
      ] },
    /* ⑲-50 7부 둘째 장 — 비행선 잔해 섬(skyroute.js). 새벽(사당) → 사당 서쪽 바람 기둥 타고 올라 잔해 섬으로 활공(sky pad) → 하늬 →
       구름 씨앗 드론 쫓기(섬 둘레) → 하늬 → 비행선 기관 지키기(조종실 앞) → 하늬(발신지 = 궤도 정거장 조각). 기관을 살리면 프로펠러가 다시 돈다 */
    { id: 'ch25', name: '제25장 · 멈춘 기상 비행선', ar: 56,
      reward: { knot: 6, gold: 6750, guide: 6, secret: 5, party: 1750 },
      steps: [
        { type: 'talk', npc: 'saebyeok', text: '사당 앞의 무녀와 이야기하기',
          lines: [['새벽', '바람 기둥이 섰소. 사당 서쪽 끝이오 — 기둥에 들어서면 바람이 몸을 들어 올릴 거요.', 'fun'],
            ['반디', '삐— 위 섬에서 구조 신호가 계속됩니다. 사람 한 명, 기상 비행선 조종실.'],
            ['?', ['올라가 볼게요.', '날개를 펴면 되죠?']],
            ['새벽', '기둥 꼭대기에서 날개를 펴고 저 섬으로 미끄러지시오. 바람은 한 번 연 길은 닫지 않소.']] },
        { type: 'sky', pad: 'sr_wreck', draft: 'sr_shrine', spot: 'sr_wreck', sky: true, text: '사당 바람 기둥을 타고 올라 비행선 잔해 섬으로 건너가기(활공)',
          done: '🪂 비행선 잔해 섬에 내려섰다 — 찢어진 기낭 곁에서 누가 손을 흔든다', gpsDone: '🌬️ 잔해 섬 밑에 닿았다 — 비행선 이야기는 이 둘레에서 이어진다' },
        { type: 'talk', npc: 'haneul', text: '조종실 앞의 비행사와 이야기하기',
          lines: [['하늬', '사, 사람이다! 구조대…는 아니죠? 날개 달고 날아온 사람은 처음 봐요.', 'surprised'],
            ['?', ['구조 신호를 따라왔어요.', '괜찮아요?']],
            ['하늬', '저는 비행사 하늬. 기상 비행선을 몰다가 먹구름에 휘말려 이 섬에 처박혔어요. 벌써 며칠째인지…', 'sorrow'],
            ['하늬', '그런데 이상해요. 기록계를 보면 먹구름이 저절로 생긴 게 아니에요. 누가 구름을 “만들고” 있어요.', 'surprised'],
            ['하늬', '저기 — 또 왔다! 저 드론이 구름 씨앗을 뿌리고 다녀요. 잡아 주세요!', 'angry']] },
        { type: 'chase', npc: 'seeddrone', sky: true, text: '구름 씨앗을 뿌리며 달아나는 드론 쫓기',
          flee: '🛸 드론이 검보랏빛 씨앗을 흩뿌리며 섬 둘레로 달아난다 — 쫓아라!',
          caught: '🛸 구름 씨앗 드론을 붙잡았다 — 배 속에서 검보랏빛 씨앗 알갱이가 쏟아진다',
          lost: '💨 놓쳤다 — 드론이 프로펠러 곁으로 돌아가 숨었다. 다시 가까이 가면 달아난다' },
        { type: 'talk', npc: 'haneul', text: '조종실 앞의 비행사와 이야기하기',
          lines: [['하늬', '이 씨앗… 우리 시대 물건이 아니에요. 물기를 빨아들여 먹구름으로 부풀어요.', 'surprised'],
            ['반디', '삐— 앞 시대 기상 조작 장치의 씨앗과 같은 구조입니다. 누군가 앞 시대 기술을 쓰고 있습니다.'],
            ['하늬', '비행선 기관만 살리면 기록계로 드론 신호가 어디서 오는지 짚을 수 있어요. 그런데 기관 소리를 들으면 먹구름 것들이 몰려올 거예요.', 'angry'],
            ['?', ['기관을 지킬게요.', '어서 시동을 걸어요.']],
            ['하늬', '좋아요, 시동 겁니다! 조종실 앞 기관을 지켜 주세요!', 'fun']] },
        { type: 'defend', spot: 'sr_wreck_engine', sky: true, name: '비행선 기관', who: '먹구름 것들이', dirs: [330, 0, 200, 240, 300],
          waves: [['imp', 'hawk', 'raptor'], ['imp', 'imp', 'hawk', 'snowfox'], ['rockbear', 'imp', 'raptor', 'hawk', 'hawk']],
          text: '비행선 기관이 데워지는 동안 지키기' },
        { type: 'talk', npc: 'haneul', text: '조종실 앞의 비행사와 이야기하기',
          lines: [['하늬', '기관 살았다! 기록계 켜졌어요 — 드론 신호 발신지… 여기보다 위예요. 서쪽 하늘 제일 높은 섬.', 'joy'],
            ['반디', '삐— 앞 시대 궤도 정거장 조각입니다. 구름 씨앗 장치 신호 셋. 먹구름을 부리는 자가 거기서 구름을 빚어 흘려보내고 있습니다.', 'angry'],
            ['?', ['거기로 가자.', '하늬 씨는요?']],
            ['하늬', '저도 가요. 제 비행선을 떨어뜨린 놈 얼굴은 봐야죠. 잔해 서쪽 끝에 바람이 모이는 게 보여요 — 거기서 올라가요!', 'angry']] }
      ] },
    /* ⑲-51 7부 끝 — 궤도 정거장 조각(skyroute.js 섬 orbit, 윗면 104m). 하늬(잔해) → 잔해 서쪽 바람 기둥 타고 정거장으로 활공(sky pad) → 하늬 →
       구름 씨앗 장치 셋을 원소로 끈다(남동 → 북 → 남서, light bare — 끈 다음 단계부터 먹구름 알이 식는다) → 가면 그림자 → 먹구름 임금의 그림자(뇌 방패는 불로) → 하늬 합류 */
    { id: 'ch26', name: '제26장 · 궤도 조각의 그림자', ar: 58, join: 'story_haneul',
      reward: { knot: 6, gold: 7000, guide: 6, secret: 5, party: 1800 },
      steps: [
        { type: 'talk', npc: 'haneul', text: '잔해 섬의 하늬와 이야기하기',
          lines: [['하늬', '바람 기둥이 섰어요. 저 위 — 궤도 정거장 조각이에요. 앞 시대 물건이 저기 떠 있다니.', 'surprised'],
            ['반디', '삐— 구름 씨앗 장치 신호 셋, 여전히 켜져 있습니다. 먹구름이 계속 빚어지고 있습니다.'],
            ['?', ['먼저 올라갈게요.', '같이 가요.']],
            ['하늬', '비행사가 날개 없이 올라가는 건 처음이네요. 먼저 가요, 뒤따를게요!', 'fun']] },
        { type: 'sky', pad: 'sr_orbit', draft: 'sr_wreck', spot: 'sr_orbit', sky: true, text: '잔해 바람 기둥을 타고 올라 궤도 정거장 조각으로 건너가기(활공)',
          done: '🪂 궤도 정거장 조각에 내려섰다 — 합금 판 위에 구름 씨앗 장치 셋이 검보랏빛으로 타오른다', gpsDone: '🌬️ 정거장 밑에 닿았다 — 궤도 조각 이야기는 이 둘레에서 이어진다' },
        { type: 'talk', npc: 'haneul', text: '정거장 조각의 하늬와 이야기하기',
          lines: [['하늬', '저 셋이에요. 검보랏빛 알에서 먹구름이 피어올라요 — 구름 씨앗 장치.', 'angry'],
            ['반디', '삐— 장치마다 원소를 대면 멈춥니다. 남동쪽, 북쪽, 남서쪽 차례로 신호가 약합니다.'],
            ['?', ['하나씩 끌게요.', '알겠어, 남동쪽부터.']],
            ['하늬', '먹구름 공장이라니… 다 끄면 하늘이 맑아질 거예요.', 'fun']] },
        { type: 'light', spot: 'sr_seed_se', bare: true, sky: true, text: '남동쪽 구름 씨앗 장치를 원소 스킬로 끄기',
          done: '☁️ 남동쪽 장치의 먹구름 알이 식어 꺼졌다' },
        { type: 'light', spot: 'sr_seed_n', bare: true, sky: true, text: '북쪽 구름 씨앗 장치를 원소 스킬로 끄기',
          done: '☁️ 북쪽 장치의 먹구름 알이 식어 꺼졌다' },
        { type: 'light', spot: 'sr_seed_sw', bare: true, sky: true, text: '남서쪽 구름 씨앗 장치를 원소 스킬로 끄기',
          done: '☁️ 남서쪽 장치까지 꺼졌다 — 서쪽 끝에서 누군가 박수를 친다' },
        { type: 'talk', npc: 'gamyeon', text: '서쪽 끝의 가면 그림자와 이야기하기',
          lines: [['가면 그림자', '……구름 공장을 셋 다 끄다니. 별배를 떨어뜨릴 때도 이렇게 성가신 녀석들은 없었는데.'],
            ['반디', '삐— 그 목소리. 그날 기록 속의 그림자입니다! 제 기록을 지운 자!', 'angry'],
            ['?', ['네가 먹구름을 부렸구나.', '왜 별배를 떨어뜨렸지?']],
            ['가면 그림자', '별배가 가려던 곳에 가 닿으면 곤란하거든. 매듭이 다시 묶이면 먹구름이 설 자리가 없지.'],
            ['하늬', '제 비행선도 당신이 떨어뜨렸죠!', 'angry'],
            ['가면 그림자', '구름 씨앗은 또 뿌리면 그만이다. 그 사이 놀 상대를 붙여 주지 — 네놈들이 한 번 쓰러뜨렸던 먹구름 임금의 그림자로.']] },
        { type: 'duel', spot: 'sr_orbit_duel', sky: true, kind: 'storm_shadow', shield: 'elec', adds: ['hawk', 'raptor'], text: '가면 그림자가 불러낸 먹구름 임금의 그림자와 맞서기',
          enter: '🌩️ 먹빛 왕관의 그림자가 합금 판 위에 일어섰다 — 먹구름 임금의 그림자!',
          p2: '⚡ 그림자가 구름 씨앗의 먹구름을 두른다 — 불로 방패를 깨라! 매와 살쾡이가 뛰어든다',
          win: '🌩️ 그림자 임금이 흩어지고 — 가면 그림자는 "청하의 여섯 매듭이 풀리는 날 다시 보자" 한마디를 남기고 먹구름 속으로 사라졌다' },
        { type: 'talk', npc: 'haneul', text: '정거장 조각의 하늬와 이야기하기',
          lines: [['하늬', '……갔어요. 먹구름도 같이 걷혔고요. 하늘이 이렇게 파란 건 처음 봐요.', 'joy'],
            ['반디', '삐— 여섯 매듭. 1부의 여섯 제단과 수가 같습니다. 청하 마을의 제단이 무언가를 묶고 있었을지도 모릅니다.', 'surprised'],
            ['?', ['청하 마을로 돌아가 보자.', '하늬 씨는 이제 어떡해요?']],
            ['하늬', '비행선은 못 뜨지만 닻 갈고리는 멀쩡해요. 먹구름 쫓는 일이라면 기상 비행사가 빠질 수 없죠.', 'angry'],
            ['하늬', '비행사 하늬, 오늘부터 같이 날아요 — 날개는 빌려 쓰고요!', 'joy']] }
      ] },
    /* ⑲-53 이야기 8부 첫 장 — 풀리는 매듭. 1부 여섯 제단 자리가 실은 여섯 매듭이었다(stormeye.js 매듭 여섯). 촌장 → 은비(폐허) → 첫째 매듭 졸개 → 첫째 매듭 불 →
       둘째 매듭 석등(달 → 별 → 해) → 나그네 → 봉우리 → 셋째 매듭 불 → 해솔. 매듭은 그 단계 다음부터 묶인다(stormeye KNOTS: 4·5·8 — 단계 번호를 바꾸면 그쪽도) */
    { id: 'ch27', name: '제27장 · 풀리는 매듭', ar: 60,
      reward: { knot: 7, gold: 7250, guide: 6, secret: 5, party: 1850 },
      steps: [
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 돌아가기',
          lines: [['누리', '돌아왔구나! 하늘에 뜬 사당이며 정거장이며… 은비한테 다 들었다. 먼 데까지 잘도 다녀왔어.', 'joy'],
            ['누리', '그런데 네가 떠난 그날 밤부터 이상한 일이 생겼단다. 네가 밝혀 둔 옛 제단 불이 하나씩 꺼지고 있어.', 'sorrow'],
            ['반디', '삐— 제단 자리마다 먹구름 신호. 가면 그림자가 말한 \'여섯 매듭\'과 수가 맞습니다.'],
            ['?', ['매듭이 풀리고 있다는 거네요.', '자장가 끝 소절이 뭐였죠?']],
            ['누리', '할머니 자장가 끝 소절이 이제야 떠오르는구나 — \'여섯 매듭 풀리면 임금이 눈을 뜬다\'. 폐허의 은비에게 가 보렴. 비문은 그 아이가 제일 잘 안다.']] },
        { type: 'talk', npc: 'scholar', text: '폐허의 학자 은비와 이야기하기',
          lines: [['은비', '왔구나! 비문 탁본을 다시 떠 봤어. 다들 앞면만 읽었지 뒷면은 아무도 안 봤더라고.', 'surprised'],
            ['은비', '\'매듭 여섯이 틈을 묶고, 틈이 임금을 묶는다\' — 제단은 자물쇠이기 전에 매듭이었어. 시간 틈을 꽁꽁 묶어 두는.'],
            ['?', ['그래서 가면 그림자가 풀러 왔구나.', '다시 묶을 수 있어?']],
            ['은비', '원소의 불로 다시 묶으면 돼. 둘째 매듭 석등은 자장가 차례래 — \'달이 뜨고, 별이 돌고, 해가 묶는다\'.'],
            ['은비', '그런데 첫째 매듭 곁에 먹구름 졸개들이 진을 쳤어. 저것부터!', 'angry']] },
        { type: 'kill', zone: 'gojeong', off: [-30, 26], kinds: ['imp', 'imp', 'raptor', 'hawk'], text: '첫째 매듭을 둘러싼 먹구름 졸개 물리치기' },
        { type: 'light', zone: 'gojeong', off: [-30, 26], text: '첫째 매듭의 제단에 원소 불 다시 밝히기',
          done: '🔥 매듭 돌의 금줄에 불이 옮겨 붙고 — 금빛 줄이 하늘로 솟았다' },
        { type: 'seal', spot: 'altar2', order: ['moon', 'star', 'sun'], text: '서쪽 옛길 둘째 매듭 석등을 자장가 차례(달 → 별 → 해)대로 밝히기' },
        { type: 'talk', npc: 'wanderer', text: '둘째 매듭 곁의 나그네와 이야기하기',
          lines: [['나그네', '……늦지 않았군. 매듭이 풀린 자리마다 이게 떨어져 있었다.', 'sorrow'],
            ['나그네', '가면 조각이다. 무늬를 보게 — 은비가 비문 맨 아래에서 찾았던 그 무늬. 신하들 가면이 아니라, 처음 가면이야.'],
            ['?', ['처음 가면이라니요?', '가면 그림자의 것인가요?']],
            ['나그네', '해솔을 삼킨 가면도, 검은 가면들도 전부 이걸 본떴다. 임금의 신하라는 표식이 아니라 — 임금 자신의 얼굴이었던 게지.', 'angry'],
            ['나그네', '셋째 매듭은 북쪽 봉우리다. 해솔이 먼저 올라가 있다.']] },
        { type: 'climb', spot: 'peak', text: '북쪽 봉우리 꼭대기로 올라가기(벽 타기)' },
        { type: 'light', spot: 'peak', off: [-7, -4], text: '봉우리의 셋째 매듭에 원소 불 다시 밝히기',
          done: '🔥 셋째 매듭이 다시 묶였다 — 봉우리에서 금빛 줄이 솟는다' },
        { type: 'talk', npc: 'haesol', text: '봉우리의 해솔과 이야기하기',
          lines: [['해솔', '셋째 매듭까지… 고마워. 매듭에 불이 붙을 때마다 귓가에 맴돌던 노랫소리가 작아져.', 'joy'],
            ['해솔', '가면에 먹혀 있을 때 먹구름 속에서 누가 계속 노래를 부르라고 했다고 했지. 그 목소리 — 정거장에서 들은 가면 그림자랑 똑같아.', 'sorrow'],
            ['?', ['그자가 널 부렸던 거구나.', '나머지 매듭은?']],
            ['해솔', '넷째는 물마루 곶, 다섯째는 바위섬, 여섯째는 저 위 구름섬. 그자가 먼저 닿기 전에 — 포구의 버들 할아버지한테 가 보자.', 'angry']] }
      ] },
    /* ⑲-54 8부 둘째 장 — 여섯째 매듭. 매듭 셋을 더 묶는다: 곶 넷째(7장 제단 자리 — 지키기 뒤 불) · 바위섬 다섯째(8장 석등 자리) · 구름섬 여섯째(9장 자리, sky).
       여섯이 다 묶이면(여덟째 단계부터) 줄이 매듭 등불로 모이고 가면 그림자가 구름섬에 서서 정체를 밝힌다. 끝나면(열째 단계부터) 먹구름 눈이 선다.
       stormeye KNOTS: 넷째 3(불 2 다음)·다섯째 5(석등 4 다음)·여섯째 8(불 7 다음) · 눈 보임 9 — 단계 번호를 바꾸면 그쪽도 */
    { id: 'ch28', name: '제28장 · 여섯째 매듭', ar: 62,
      reward: { knot: 7, gold: 7500, guide: 6, secret: 5, party: 1900 },
      steps: [
        { type: 'talk', npc: 'ferryman', text: '포구의 사공 버들과 이야기하기',
          lines: [['버들', '왔구나. 해솔이 먼저 기별을 넣었더라 — 매듭이니 뭐니, 늙은이 귀엔 어렵다만 곶이 요새 수상한 건 안다.', 'surprised'],
            ['버들', '어젯밤부터 곶 제단에 가면 쓴 놈들이 떼로 몰려. 이번엔 제단째 바다에 밀어 넣을 기세야.', 'angry'],
            ['하람', '(무전) 여기 서리봉 관측소! 먹구름이 전부 한 방향으로 빨려 들고 있어요 — 청하 북쪽 봉우리 위 하늘로!', 'surprised'],
            ['한별', '(신호) 별배 항로표에 빛 점이 여섯 떴네. 바위섬 점은 해 → 별 → 달 차례로 깜빡이고 있어.'],
            ['?', ['곶부터 지킬게요.', '할아버지는 배를 준비해 주세요.']],
            ['버들', '그래, 곶을 지키고 나면 바위섬까지 태워 주마. 조심하거라!']] },
        { type: 'defend', spot: 'cape', name: '넷째 매듭', who: '가면 무리가',
          waves: [['imp', 'imp', 'toad'], ['imp', 'raptor', 'hawk', 'toad'], ['rockbear', 'imp', 'snowfox', 'raptor', 'hawk']],
          text: '물마루 곶의 넷째 매듭을 가면 무리에게서 지키기' },
        { type: 'light', spot: 'cape', text: '넷째 매듭의 제단에 원소 불 다시 밝히기',
          done: '🔥 넷째 매듭에 불이 붙었다 — 곶에서 금빛 줄이 솟는다' },
        { type: 'sail', npc: 'ferryman', to: 'isle', toOff: [0, 14], text: '버들의 배를 타고 바위섬으로(사공에게 F)',
          lines: [['버들', '자, 타거라. 바위섬 매듭도 우리 손으로 묶자꾸나!']],
          arrive: '🚣 버들이 노를 저어 앞바다 바위섬에 배를 댔다' },
        { type: 'seal', spot: 'isle', order: ['sun', 'star', 'moon'], text: '바위섬 다섯째 매듭 석등을 항로표 차례(해 → 별 → 달)대로 밝히기' },
        { type: 'sky', text: '북쪽 봉우리 바람 기둥을 타고 구름섬에 오르기(기둥 안에서 뛰어올라 활공)' },
        { type: 'kill', spot: 'sky', off: [0, 2], sky: true, kinds: ['hawk', 'raptor', 'imp', 'imp', 'snowfox'], text: '여섯째 자리를 덮은 먹구름 무리 물리치기' },
        { type: 'light', spot: 'sky', sky: true, text: '구름섬 여섯째 매듭에 원소 불 다시 밝히기',
          done: '🔥 여섯째 매듭까지 — 여섯 금빛 줄이 휘어 하늘 한 점으로 모인다' },
        { type: 'talk', npc: 'gamyeon', text: '구름섬에 나타난 가면 그림자와 이야기하기',
          lines: [['가면 그림자', '……여섯 줄이 다 묶였군. 매듭이 조여 올수록 내 몸이 틈 밖으로 밀려난다.', 'angry'],
            ['나그네', '그 가면 무늬… 비문 맨 아래, 처음 가면. 네가 임금이로구나.', 'angry'],
            ['?', ['먹구름 임금의 참몸…!', '구름섬에서 쓰러뜨린 임금은 뭐였지?']],
            ['가면 그림자', '네가 이 섬에서 친 것은 내 꿈, 정거장에서 친 것은 내 그림자. 나는 여섯 매듭 밑 틈에 묶여 먹구름 한 줄기로만 시대를 떠돌았지.'],
            ['가면 그림자', '틈이 닫히자 돌아갈 길도 막혔다. 그래서 뿌리부터 풀러 왔건만 — 좋다. 매듭이 나를 밀어낸다면, 하늘의 먹구름을 전부 한데 모아 매듭째 끊어 주마.', 'angry'],
            ['가면 그림자', '올라와라. 먹구름 눈에서 기다리지.']] },
        { type: 'talk', npc: 'wanderer', text: '구름섬의 나그네와 이야기하기',
          lines: [['나그네', '……먹구름이 저 위로 빨려 든다. 저게 먹구름 눈인가.', 'surprised'],
            ['나그네', '혼자서는 못 간다. 마을로 내려가 모두를 불러 모으게 — 은비, 버들, 해솔… 네가 시대를 건너 만난 동무들 전부.'],
            ['?', ['다 같이 가요.', '마지막 싸움이네요.']],
            ['나그네', '과거·현대·미래가 다 모여야 틈 위의 임금을 칠 수 있다. 누리 할머니가 광장에서 기다린다.', 'joy']] }
      ] },
    /* ⑲-55 8부 끝·1차 결말 — 먹구름의 근원. 광장 촌장 → **편성 시험**(새 단계 party — 들판 명단에 과거·현대·미래 이야기 동료 하나씩) → 구름섬 서쪽 바람 기둥으로 먹구름 눈(sky pad se_eye) →
       임금(참몸) → 매듭 등불 지키기(defend bare — 눈 가운데) → 먹구름 임금 참몸(눈 남쪽 9m) → 해솔(소용돌이 걷힘 = stormeye EYE_CLEAR 29장 6단계 — 보스 다음) → 활공해 광장 → 잔치 */
    { id: 'ch29', name: '제29장 · 먹구름의 근원', ar: 64,
      reward: { knot: 10, gold: 12000, guide: 10, secret: 8, party: 3000 },
      steps: [
        { type: 'talk', npc: 'elder', text: '광장의 청하 촌장에게 가기',
          lines: [['누리', '다들 모였구나. 은비, 버들 영감, 해솔, 나그네… 먼 시대에서 온 동무들까지. 청하 광장이 이렇게 북적인 건 처음이다.', 'joy'],
            ['도담', '막차 기관은 식혀 두고 왔어요. 신호만 떨어지면 바로 달립니다!', 'fun'],
            ['한별', '별배도 닻을 올렸네. 마지막 항로는 대장이 정하게.'],
            ['반디', '삐— 먹구름 눈 안쪽 기압 급강하. 세 시대의 힘이 한 부대에 모여야 매듭 등불이 버팁니다.'],
            ['?', ['편성을 짤게요.', '누구를 데려가죠?']],
            ['누리', '과거와 현대와 미래 — 세 시대에서 한 사람씩 네 곁에 세우렴. 매듭은 세 시대를 함께 묶어야 다시는 풀리지 않는단다.']] },
        { type: 'party', eras: ['과거', '현대', '미래'], text: '과거·현대·미래 이야기 동료를 하나씩 들판 명단에 넣기(도감 탭 → 편성)' },
        { type: 'sky', pad: 'se_eye', draft: 'se_eye', spot: 'eye', sky: true, text: '구름섬 서쪽 바람 기둥을 타고 먹구름 눈으로(기둥 안에서 뛰어올라 활공)',
          done: '🪂 먹구름 눈에 내려섰다 — 소용돌이 한가운데, 매듭 등불이 떨고 있다', gpsDone: '🌬️ 먹구름 눈 밑에 닿았다 — 마지막 싸움은 이 둘레에서 이어진다' },
        { type: 'talk', npc: 'gamyeon', text: '먹구름 눈의 임금과 맞서기',
          lines: [['먹구름 임금', '왔구나, 매듭을 묶는 자. 과거와 현재와 미래를 한 줄에 꿰어 오다니 — 그 줄째 끊어 주마.', 'angry'],
            ['먹구름 임금', '매듭 등불만 꺼지면 여섯 줄은 도로 풀린다. 먹구름아, 등불을 덮어라!'],
            ['?', ['등불은 우리가 지킨다!', '여기서 끝내자.']]] },
        { type: 'defend', spot: 'eye', sky: true, bare: true, name: '매듭 등불', who: '먹구름 무리가',
          waves: [['imp', 'imp', 'hawk'], ['snowfox', 'toad', 'raptor', 'imp'], ['rockbear', 'vine', 'hawk', 'raptor', 'snowfox']],
          text: '먹구름 눈의 매듭 등불을 먹구름 무리에게서 지키기' },
        { type: 'duel', spot: 'eye', off: [0, 9], sky: true, kind: 'storm_king_true', shield: 'elec', adds: ['hawk', 'raptor'], text: '먹구름 임금의 참몸 물리치기',
          enter: '🌩️ 흰 처음 가면의 임금이 먹구름을 두르고 일어섰다 — 먹구름 임금의 참몸!',
          p2: '⚡ 임금이 소용돌이의 먹구름을 몸에 두른다 — 불로 방패를 깨라! 매와 살쾡이가 뛰어든다',
          win: '🌩️ 먹구름 임금의 흰 가면이 두 쪽으로 갈라지고 — 먹구름이 소용돌이째 흩어진다' },
        { type: 'talk', npc: 'haesol', text: '먹구름 눈의 해솔과 이야기하기',
          lines: [['해솔', '……들려? 바람이 노래해. 먹구름에 먹혀 부르던 노래가 아니라, 내 노래로.', 'joy'],
            ['해솔', '가면이 갈라지던 순간 임금이 뭐라고 했는지 알아? \'매듭이 이렇게 따뜻한 줄 몰랐다\' — 그러고는 틈 아래로 가라앉았어.', 'sorrow'],
            ['?', ['이제 정말 끝이야.', '잘 가라, 임금.']],
            ['해솔', '먹구름 눈이 맑은 하늘로 바뀌었어. 자, 날개를 펴고 광장까지 — 할머니가 잔칫상을 차려 놨대!', 'fun']] },
        { type: 'go', zone: 'home', off: [-22, 16], text: '먹구름 눈에서 활공해 청하 광장으로 내려가기' },
        { type: 'talk', npc: 'elder', text: '청하 촌장에게 알리기',
          lines: [['누리', '하늘 좀 보렴…! 먹구름 한 점 없이 파랗구나. 여섯 매듭 불빛이 별처럼 반짝이고.', 'joy'],
            ['은비', '비문 맨 끝 줄이 새로 보여! \'매듭을 다시 묶은 이들이 있어 청하는 오래 맑으리라\' — 방금 새겨진 것 같아.', 'surprised'],
            ['버들', '허허, 이 늙은이 노가 하늘까지 닿은 셈이로구먼.', 'fun'],
            ['하늬', '비행선은 없어도 오늘 하늘은 제 거예요. 이렇게 맑은 날 기상 보고는 처음 써 봐요!', 'joy'],
            ['반디', '삐— 틈 신호 안정. 먹구름 발생률 0퍼센트. 선장님, 이제 어디로 갈까요?'],
            ['한별', '……글쎄. 틈이 삼켰다 못 돌려놓은 시대 조각들이 아직 곳곳에 굳어 있다더군. 하지만 그건 잔치 뒤에 생각하세.'],
            ['?', ['다 같이 잔치해요!', '모두 고마워요.']],
            ['누리', '약속대로 잔치다! 이건 청하 마을과 세 시대 동무들이 너에게 주는 거란다. 고맙다 — 우리 대장.', 'joy']] }
      ] },
    /* ⑲-58 이야기 9부 첫 장 — 멈춘 거리(amber.js 굳은 거리). 한별(나루) → 고개 넘어 거리 어귀 → 네거리 결정 짐승 → 초롱 → 굳은 자리 셋(신호등 앞 → 정류장 → 우체통, light bare) → 초롱.
       굳은 자리는 그 단계 다음부터 녹는다(amber CRYSTAL_OFF_FROM 5·6·7 — 단계 번호를 바꾸면 그쪽도) */
    { id: 'ch30', name: '제30장 · 멈춘 거리', ar: 66,
      reward: { knot: 7, gold: 7750, guide: 7, secret: 6, party: 1950 },
      steps: [
        { type: 'talk', npc: 'hanbyeol', text: '은하 나루의 별배 선장 한별과 이야기하기',
          lines: [['한별', '왔군, 대장. 잔치 술은 좀 깼나? 별배 항로표를 보게 — 북쪽 고개 너머에 굳은 신호가 찍혔네.', 'fun'],
            ['반디', '삐— 시간이 흐르지 않는 자리에서만 나는 신호입니다. 먹구름 눈이 걷히던 밤부터 떴습니다.'],
            ['한별', '그 밤에 고개를 막던 호박빛 결정 막도 풀렸다더군. 틈이 닫힐 때 제자리로 못 돌아간 시대 조각 — 잔치 뒤에 생각하자던 그것일세.', 'surprised'],
            ['?', ['별배로 가 볼까요?', '걸어서 넘어갈게요.']],
            ['한별', '거리가 빽빽해서 별배는 못 내려앉네. 고개 경계비를 지나 걸어가게 — 반디를 먼저 날려 보내지.']] },
        { type: 'go', spot: 'am_pass', off: [0, -25], text: '은하 나루 북쪽 고개를 넘어 굳은 거리 어귀로' },
        { type: 'kill', spot: 'am_cross', off: [0, 8], kinds: ['rockbear', 'imp', 'snowfox', 'raptor'], text: '네거리를 서성이는 결정 짐승 물리치기' },
        { type: 'talk', npc: 'chorong', text: '시계방 앞의 수리공 초롱과 이야기하기',
          lines: [['초롱', '……사람이다! 움직이는 사람! 이 거리에서 석 달째 나 혼자만 움직였어요.', 'surprised'],
            ['초롱', '틈이 닫히던 날 거리가 통째로 굳었어요. 신호등도, 전철도, 사람들도. 나만 멀쩡했던 건 — 이 손목시계 덕인 것 같아요.', 'sorrow'],
            ['반디', '삐— 그 시계 속 태엽, 틈 조각입니다. 시계가 주인의 시간만 붙들어 준 겁니다.'],
            ['?', ['굳은 사람들을 풀어 줄 수 있어요?', '저 호박빛 결정은 뭐죠?']],
            ['초롱', '굳은 자리요. 네거리에만 셋 — 신호등 앞, 버스 정류장, 우체통. 원소가 닿으면 녹을지도 몰라요. 난 못 하지만 당신은…!']] },
        { type: 'light', spot: 'am_crystal0', bare: true, text: '네거리 신호등 앞 굳은 자리를 원소 스킬로 녹이기',
          done: '🔥 신호등 앞 결정이 녹아내리고 — 길을 건너던 사람이 휘청이며 걸음을 마저 뗀다' },
        { type: 'light', spot: 'am_crystal1', bare: true, text: '버스 정류장 굳은 자리를 원소 스킬로 녹이기',
          done: '🔥 정류장 결정이 녹고 — 버스를 기다리던 할머니가 눈을 깜박인다' },
        { type: 'light', spot: 'am_crystal2', bare: true, text: '우체통 앞 굳은 자리를 원소 스킬로 녹이기',
          done: '🔥 우체통 결정까지 녹았다 — 편지를 넣던 아이가 손을 뗀다. 그런데 신호등은 아직 빨강이다' },
        { type: 'talk', npc: 'chorong', text: '시계방 앞의 초롱에게 돌아가기',
          lines: [['초롱', '고마워요! 다들 풀려났어요… 그런데 보세요. 신호등은 여전히 빨강이고, 시계방 시계는 한 칸도 안 가요.', 'sorrow'],
            ['초롱', '사람은 녹여도 거리의 시간은 안 흐르는 거예요. 무언가가 시간을 통째로 붙들고 있어요.'],
            ['반디', '삐— 굳은 신호가 가장 센 곳은 서쪽. 결정 하나가 거리 전체 신호의 절반입니다.'],
            ['?', ['서쪽에 뭐가 있어요?', '제일 큰 결정은 어디죠?']],
            ['초롱', '호박 속 장터요. 옛날 장터가 천막째 통째로 결정에 들어 있어요 — 이 거리에서 제일 큰 굳은 자리예요.', 'surprised'],
            ['초롱', '장터 둘레에 낡은 석등이 셋 서 있어요. 가게 문 닫고 따라갈게요. 준비되면 말해 줘요!', 'joy']] }
      ] },
    /* ⑲-59 9부 둘째 장 — 호박 속 장터. 초롱 → 장터 석등 해 → 달 → 별(seal bare — 다 켜면 결정 돔이 깨진다: amber DOME_FROM 31장 2단계) → 너울 → 조각 도둑 쫓기 →
       너울 → 되감는 괘종시계 지키기(defend bare — 시계방 서쪽, 다섯째 단계 동안 바늘이 돎) → 초롱(부양탑) */
    { id: 'ch31', name: '제31장 · 호박 속 장터', ar: 68,
      reward: { knot: 7, gold: 8000, guide: 7, secret: 6, party: 2000 },
      steps: [
        { type: 'talk', npc: 'chorong', text: '시계방 앞의 초롱과 이야기하기',
          lines: [['초롱', '가게 문 닫았어요! 장터 석등 셋 말인데요 — 할머니가 늘 흥얼거리던 장터 노래가 있어요.', 'joy'],
            ['초롱', '\'해 뜨면 장이 서고, 달 뜨면 셈을 하고, 별 뜨면 짐을 싼다\' — 석등마다 해·달·별이 새겨져 있거든요.'],
            ['반디', '삐— 석등 셋에서 약한 틈 신호. 차례대로 켜면 결정의 결이 풀릴 수 있습니다.'],
            ['?', ['노래 차례대로 켜 볼게요.', '해, 달, 별 순서죠?']],
            ['초롱', '장터 앞에서 기다릴게요. 틀리면 다 꺼질지도 몰라요 — 천천히요!']] },
        { type: 'seal', spot: 'am_market', bare: true, order: ['sun', 'moon', 'star'], text: '호박 속 장터 둘레 석등을 장터 노래 차례(해 → 달 → 별)대로 밝히기' },
        { type: 'talk', npc: 'neoul', text: '풀려난 장돌뱅이와 이야기하기',
          lines: [['너울', '……어, 어라? 장이 파했나? 방금까지 저울질하던 참인데 — 손님들은 다 어디 가고.', 'surprised'],
            ['초롱', '할아버지, 여기 결정 속에 굳어 계셨어요. 바깥은 벌써… 아주 먼 뒷날이에요.'],
            ['너울', '뒷날이라니, 허허. 쇠 수레가 하늘길로 다니는 걸 보니 꿈은 아니로구먼. 이 장돌뱅이 너울, 팔도 장은 다 돌았어도 이런 장은 처음일세.', 'fun'],
            ['?', ['다친 데는 없으세요?', '굳기 전에 무슨 일이 있었어요?']],
            ['너울', '하늘이 쩍 갈라지더니 그 틈에서 쇳조각 하나가 내 저울판에 떨어졌지. 태엽처럼 도르르 감긴 놈인데, 저울추로 딱 맞아서—', 'surprised'],
            ['너울', '어이쿠! 저, 저놈 봐라! 날개 달린 쇳덩이가 내 저울추를 물고 간다!', 'angry']] },
        { type: 'chase', npc: 'partthief', text: '너울의 저울추를 물고 달아나는 조각 도둑 쫓기',
          flee: '🛸 조각 도둑이 저울추를 물고 네거리 쪽으로 달아난다 — 쫓아라!',
          caught: '🛸 조각 도둑을 붙잡았다 — 발톱에서 태엽 저울추가 툭 떨어진다',
          lost: '💨 놓쳤다 — 도둑이 장터 곁으로 돌아가 숨었다. 다시 가까이 가면 달아난다' },
        { type: 'talk', npc: 'neoul', text: '장터의 너울에게 저울추 돌려주기',
          lines: [['너울', '고맙네, 젊은이! 이 저울추 — 보게, 초롱 아가씨 손목시계 태엽과 결이 똑같지 않은가.', 'joy'],
            ['초롱', '정말… 틈 조각이에요. 이거라면 가게 큰 괘종시계를 되감을 수 있을지도 몰라요. 거리에서 제일 오래된 시계라 거리 시간과 이어져 있거든요!', 'surprised'],
            ['반디', '삐— 도둑 드론은 굳은 조각을 한곳으로 모으고 있었습니다. 되감기 시작하면 조각을 노리는 것들이 몰려옵니다.'],
            ['?', ['시계는 내가 지킬게.', '되감는 동안 막아 줄게요.']],
            ['너울', '나는 장터를 지키겠네. 저울추는 아가씨가 가져가게 — 장돌뱅이는 셈이 정확해야지.']] },
        { type: 'defend', spot: 'am_clock', off: [-8, 2], bare: true, name: '되감는 괘종시계', who: '결정 짐승이', dirs: [0, 160, 200, 250, 300, 340],
          waves: [['rockbear', 'raptor', 'imp'], ['snowfox', 'imp', 'hawk', 'raptor'], ['rockbear', 'snowfox', 'raptor', 'imp', 'hawk']],
          text: '초롱이 괘종시계를 되감는 동안 시계방 지키기' },
        { type: 'talk', npc: 'chorong', text: '시계방 앞의 초롱과 이야기하기',
          lines: [['초롱', '다 감았어요…! 들려요? 째깍, 째깍 — 괘종시계가 가요!', 'joy'],
            ['초롱', '……그런데 한 칸 가고 멈춰요. 몇 번을 감아도 딱 한 칸.', 'sorrow'],
            ['반디', '삐— 괘종시계 신호가 북쪽으로 당겨집니다. 부양탑 꼭대기. 거리의 시간이 그곳에 묶여 있습니다.'],
            ['?', ['부양탑에 뭐가 있죠?', '탑까지 가 봐요.']],
            ['초롱', '짓다 만 탑이요. 꼭대기에 \'시간 태엽 심장\'이 있대요 — 탑을 짓던 설계사가 가끔 탑 발치에서 혼잣말을 해요. 그 사람도 안 굳었나 봐요!', 'surprised']] }
      ] },
    /* ⑲-60 9부 끝 — 짓다 만 부양탑. 새길 → 탑 벽 타기(landform 기둥 am_tower) → 꼭대기 태엽 심장(light bare·perch — 다음 단계부터 탑이 녹는다: amber TOWER_FROM 32장 3) → 새길 →
       호박 등딱지 거북(탑 밑 광장, 암 방패는 초로) → 초롱 합류(신호등 초록: amber LIGHTS_GREEN_STEP 5) */
    { id: 'ch32', name: '제32장 · 짓다 만 부양탑', ar: 70, join: 'story_chorong',
      reward: { knot: 8, gold: 9000, guide: 8, secret: 7, party: 2200 },
      steps: [
        { type: 'talk', npc: 'saegil', text: '부양탑 발치의 설계사와 이야기하기',
          lines: [['새길', '……또 멈췄어. 층판을 띄우던 공식이 딱 이 자리에서 — 아, 사람이다. 움직이는 사람!', 'surprised'],
            ['새길', '시간 태엽 심장 때문에 왔죠? 층판을 띄우려고 시간을 감아 두는 장치예요. 틈이 닫히던 날, 심장이 거리 시간을 통째로 감아 버렸어요.', 'sorrow'],
            ['반디', '삐— 탑 꼭대기에서 굳은 신호가 가장 셉니다. 괘종시계가 당기던 방향과 같습니다.'],
            ['?', ['어떻게 멈추죠?', '꼭대기엔 어떻게 올라가요?']],
            ['새길', '승강기는 멈췄어요. 벽을 타고 올라가 심장에 원소를 대면 감긴 태엽이 풀릴 거예요 — 설계한 사람이 할 말은 아니지만, 난 높은 데가 무서워서.', 'fun']] },
        { type: 'climb', spot: 'am_tower', pole: 'am_tower', text: '짓다 만 부양탑 벽을 타고 꼭대기로(벽에 붙어 계속 밀기)',
          done: '🏗️ 부양탑 꼭대기에 올라섰다 — 호박 껍질에 싸인 태엽 심장이 코앞에서 떨고 있다', gpsDone: '🏗️ 탑 발치에 닿았다 — 태엽 심장은 꼭대기에 있다' },
        { type: 'light', spot: 'am_tower', bare: true, perch: 'am_tower', text: '탑 꼭대기 시간 태엽 심장을 원소 스킬로 녹이기(꼭대기에서)',
          done: '⏱️ 태엽 심장의 호박 껍질이 녹아내리고 — 감겨 있던 태엽이 드르륵 풀린다. 탑 밑에서 땅이 울린다', away: '⏱️ 태엽 심장은 탑 꼭대기에 있다 — 벽을 타고 올라서야 원소가 닿는다' },
        { type: 'talk', npc: 'saegil', text: '탑 발치의 새길에게 내려가기',
          lines: [['새길', '풀렸어요…! 그런데 이 울림 — 탑 밑 광장이에요. 심장이 감아 둔 시간을 몰래 받아먹던 게 있었어요.', 'surprised'],
            ['반디', '삐— 커다란 반응. 등딱지에 굳은 신호가 겹겹이 쌓여 있습니다. 거리 시간 대부분이 저기 있습니다.'],
            ['?', ['저걸 쓰러뜨리면 시간이 돌아와요?', '물러서 있어요.']],
            ['새길', '등딱지를 깨면요! 도면엔 없던 놈이에요 — 조심해요!', 'angry']] },
        { type: 'duel', spot: 'am_tower', off: [16, 8], kind: 'amber_turtle', shield: 'rock', adds: ['imp', 'raptor'], text: '탑 밑 광장의 호박 등딱지 거북 물리치기',
          enter: '🐢 탑 밑 광장 바닥이 갈라지며 — 호박 등딱지 거북이 일어섰다!',
          p2: '🪨 거북이 호박 등딱지를 두른다 — 풀(초)로 깨라! 졸개가 뛰어든다',
          win: '🐢 호박 등딱지가 쩍 갈라지고 — 겹겹이 굳어 있던 시간이 빛이 되어 거리로 흩어진다' },
        { type: 'talk', npc: 'chorong', text: '탑 밑 광장의 초롱과 이야기하기',
          lines: [['초롱', '들려요? 째깍째깍 — 거리 시계가 전부 같이 가요! 신호등도 초록이에요!', 'joy'],
            ['너울', '허허, 장이 다시 서는구먼! 거북 등딱지 틈에서 잃어버린 내 엽전 부적까지 나왔네 — 저울추 값은 톡톡히 받았어.', 'fun'],
            ['새길', '공중에 걸린 층판도 천천히 내려앉고 있어요. 이제야 탑을 마저 지을 수 있겠네요.', 'joy'],
            ['반디', '삐— 굳은 신호 소멸…… 아닙니다. 지도 가장자리 너머에서 같은 신호가 약하게 이어집니다.', 'surprised'],
            ['?', ['또 굳은 곳이 있다는 거야?', '초롱 씨는 이제 어떻게 해요?']],
            ['초롱', '거리 밖에도 굳은 시간이 있다면 — 시계 수리공이 빠질 수 없죠. 손목시계가 아직 째깍거리는 데는 이유가 있을 거예요.', 'angry'],
            ['초롱', '시계 수리공 초롱, 오늘부터 같이 가요. 가게는 너울 할아버지가 봐 주신대요!', 'joy']] }
      ] },
    /* ⑲-62 10부 첫 장 — 지도 가장자리 너머(vault.js 갈무리 벌). 반디 → 고원 관측소 하람 → 동쪽 고개 넘어 벌 어귀(울타리는 9부 뒤 꺼짐) → 야적장 결정 짐승 넷 →
       조각 운반 드론 쫓기(야적장 → 동력 기둥 사이 → 금고 문 앞) → 마루(34장 떡밥: 문은 동력 기둥 둘이 붙들고 동력은 곳간 마을에서) */
    { id: 'ch33', name: '제33장 · 지도 가장자리 너머', ar: 72,
      reward: { knot: 8, gold: 8500, guide: 8, secret: 6, party: 2300 },
      steps: [
        { type: 'talk', npc: 'bandi', text: '굳은 거리 시계방 곁의 반디와 이야기하기',
          lines: [['반디', '삐— 굳은 신호 추적 완료. 지도 가장자리 너머, 동쪽입니다. 서리봉 고원을 지나 더 동쪽.', 'surprised'],
            ['초롱', '고원이면 관측소 하람 씨 동네잖아요? 거기서 동쪽은 깎아지른 절벽뿐인데.'],
            ['반디', '삐— 신호는 절벽 너머로 이어집니다. 관측소 기상 기록에 흔적이 남았을 확률 칠십팔 퍼센트.'],
            ['?', ['하람한테 물어보자.', '절벽 너머라고?']],
            ['반디', '먼저 날아가 있겠습니다. 관측소 앞에서 뵙겠습니다. 삐—']] },
        { type: 'talk', npc: 'haram', text: '서리봉 고원 기상 관측소의 하람과 이야기하기',
          lines: [['하람', '대장! 마침 잘 왔어요. 요 며칠 기상 레이더에 이상한 게 잡혀요 — 새 떼도 아닌 것이 동쪽 절벽 너머로 줄지어 오가요.', 'surprised'],
            ['반디', '삐— 운반 드론 편대입니다. 발톱마다 굳은 신호를 매달고 있습니다.'],
            ['하람', '그리고 동쪽 고개 말인데요 — 늘 푸른 빛 울타리가 서 있어서 아무도 못 넘었거든요. 굳은 거리 시간이 다시 흐르던 밤, 그게 스르르 꺼졌어요.'],
            ['?', ['울타리 너머엔 뭐가 있어요?', '드론을 따라가 볼게요.']],
            ['하람', '지도에도 없는 벌판이요. 망원경으로 보면 둥근 은빛 지붕이 번쩍여요. 동쪽 고개로 가 봐요 — 난 여기서 레이더를 볼게요!', 'joy']] },
        { type: 'go', spot: 'vt_pass', off: [20, 0], text: '서리봉 고원 동쪽 고개를 넘어 벌 어귀로' },
        { type: 'kill', spot: 'vt_yard', off: [-34, -19], kinds: ['rockbear', 'raptor', 'hawk', 'snowfox'], text: '물류 야적장에 몰려든 결정 짐승 물리치기' },
        { type: 'chase', npc: 'carrier', text: '굳은 조각을 매달고 금고로 날아가는 운반 드론 쫓기',
          flee: '🛸 운반 드론이 굳은 조각을 매단 채 금고 쪽으로 날아간다 — 쫓아라!',
          caught: '🛸 금고 문 앞에서 운반 드론을 붙잡았다 — 발톱에서 호박빛 조각이 툭 떨어진다. 속에 작은 장터 풍경이 굳어 있다',
          lost: '💨 놓쳤다 — 드론이 야적장으로 돌아가 숨었다. 다시 가까이 가면 날아간다' },
        { type: 'talk', npc: 'maru', text: '물류 창고 앞의 창고지기와 이야기하기',
          lines: [['마루', '……그 드론을 잡았다고요? 허, 석 달 동안 저놈들을 붙잡은 사람은 처음 보네.', 'surprised'],
            ['마루', '난 갈무리 물류의 마지막 창고지기 마루요. 벌판이 이렇게 들러붙던 날부터 드론이 날마다 저 조각을 금고로 날라요. 굳은 거리에서, 고원에서, 바닷가에서까지.'],
            ['초롱', '이 조각 속… 장터 사람이에요. 너울 할아버지 옆 좌판에 있던 떡 장수 아주머니 — 결정이 깨질 때 같이 풀려났어야 했는데.', 'sorrow'],
            ['반디', '삐— 조각의 결이 이상합니다. 제자리로 돌아가던 도중에 붙잡힌 흔적입니다. 누군가 일부러 모으고 있습니다.'],
            ['?', ['그 금고가 뭐예요?', '금고 안에 들어갈 수 있어요?']],
            ['마루', '시간 씨앗 금고. 문은 꽉 잠겼어요 — 금고 앞 동력 기둥 둘이 문을 붙들고, 그 동력은 서쪽 곳간 마을에서 끌어다 써요.', 'angry'],
            ['마루', '곳간 마을부터 가 봅시다. 거기 곳간은 노래를 불러야 열린다던데… 지게차 몰고 뒤따라갈게요!', 'fun']] }
      ] },
    /* ⑲-63 10부 둘째 장 — 곳간의 씨앗. 마루 → 곳간 석등 별 → 해 → 달(seal bare — 다 켜면 곳간 문이 열린다: vault GRANARY_OPEN_STEP 2) → 소담 → 씨앗 곳간 지키기(defend bare — 곳간(북) 쪽을 뺀 dirs) →
       동력 기둥 서 → 동(light bare — 끄면 알이 사라진다: vault PYLON_OFF_FROM 5·6) → 소담(금고 문이 열린다: vault DOOR_OPEN_STEP 6) */
    { id: 'ch34', name: '제34장 · 곳간의 씨앗', ar: 74,
      reward: { knot: 8, gold: 8750, guide: 8, secret: 6, party: 2400 },
      steps: [
        { type: 'talk', npc: 'maru', text: '물류 창고 앞의 마루와 이야기하기',
          lines: [['마루', '지게차 시동 걸었어요. 곳간 마을은 고개 쪽 서쪽 — 초가지붕 곳간이 하나 덩그러니 서 있죠.', 'joy'],
            ['마루', '문엔 자물쇠 대신 석등 셋이 둘러 있어요. 누가 흥얼거리는 걸 들었는데 — \'별 보고 나가, 해 보고 거두고, 달 보고 들인다\'.'],
            ['초롱', '장터 노래랑 닮았어요! 그럼 석등도 노래 차례대로 — 별, 해, 달.'],
            ['반디', '삐— 곳간 안에서 작은 생체 신호 하나. 사람입니다. 동력 기둥 선도 곳간 밑으로 지나갑니다.'],
            ['?', ['곳간 노래 차례대로 켤게요.', '안에 누가 있다고?']],
            ['마루', '먼저 가 있을게요. 곳간 앞에 지게차 대 놓고 기다리죠!']] },
        { type: 'seal', spot: 'vt_granary', bare: true, order: ['star', 'sun', 'moon'], text: '곳간 둘레 석등을 곳간 노래 차례(별 → 해 → 달)대로 밝히기' },
        { type: 'talk', npc: 'sodam', text: '곳간에서 나온 아이와 이야기하기',
          lines: [['소담', '……노래를 아는 거 보니 도둑은 아니네. 우리 할머니 곳간 노래예요.', 'surprised'],
            ['소담', '난 곳간지기 소담이에요. 하늘이 갈라지던 날, 곳간째 둥 떠서 여기 떨어졌어요. 씨앗 곡식이 다 여기 있어요 — 내년 농사 씨앗.', 'sorrow'],
            ['마루', '석 달을 곳간 안에 숨어 있었다고? 이 꼬마가?', 'surprised'],
            ['소담', '밤마다 쇠 새들이 와서 문을 긁어요. 씨앗을 노리는 거예요. 저 둥근 은빛 집에 가져가려고.', 'angry'],
            ['?', ['씨앗은 우리가 지켜 줄게.', '쇠 새들이 또 와?']],
            ['소담', '와요! 문이 열린 걸 알았으니 다 몰려올 거예요 — 저기, 벌써!', 'surprised']] },
        { type: 'defend', spot: 'vt_granary', off: [0, 7], bare: true, name: '씨앗 곳간', who: '결정 짐승이', dirs: [60, 110, 160, 200, 250, 300],
          waves: [['hawk', 'raptor', 'vine'], ['rockbear', 'hawk', 'imp', 'snowfox'], ['hawk', 'rockbear', 'raptor', 'snowfox', 'imp']],
          text: '씨앗 곡식을 노리는 것들에게서 곳간 지키기' },
        { type: 'light', spot: 'vt_pylon0', bare: true, text: '금고 앞 서쪽 동력 기둥을 원소 스킬로 끄기',
          done: '🔌 서쪽 동력 기둥 꼭대기 푸른 구슬이 치직 꺼진다 — 곳간 밑 동력 선이 잠잠해진다' },
        { type: 'light', spot: 'vt_pylon1', bare: true, text: '금고 앞 동쪽 동력 기둥을 원소 스킬로 끄기',
          done: '🔌 동쪽 동력 기둥까지 꺼졌다 — 금고 문의 빛 고리가 깜박이더니 스르르 사라진다' },
        { type: 'talk', npc: 'sodam', text: '금고 문 앞의 소담과 이야기하기',
          lines: [['소담', '꺼졌다! 이제 저 집이 우리 곳간 동력을 못 빨아 가요.', 'joy'],
            ['소담', '……그런데요, 곳간에 숨어 있던 밤마다 저 은빛 집에서 목소리가 들렸어요. 사람 목소리 같은데, 사람 같지 않은.', 'sorrow'],
            ['소담', '\'아름다운 때를 영원히.\' 그 말만 몇 번이고요.'],
            ['반디', '삐— 금고 안 신호, 굳은 자리 수백 개. 가운데 한 신호가… 사람의 목소리 기록입니다. 진열장 안에서 납니다.', 'surprised'],
            ['?', ['금고 문이 열렸어!', '아름다운 때를 영원히…?']],
            ['마루', '문이 열린다… 석 달 동안 한 번도 안 열리던 문이.', 'surprised'],
            ['소담', '씨앗 한 줌 챙겨 갈게요. 저 안에 우리 마을 잔칫날도 갇혀 있을지 몰라요. 같이 들어가요!', 'angry']] }
      ] },
    /* ⑲-64 10부 끝 — 갈무리. 소담 → 금고 안 진열관(go vault) → 해미(진열장 속) → 기록 기둥 벽 타기(landform 기둥 vt_pillar) → 갈무리(다음 단계부터 핵이 꺼진다: vault CORE_DIM_STEP 5) →
       금고 파수 드론 여왕(동력 기둥 사이 광장, 풍 방패는 암으로 — 쓰러뜨리면 해미 진열장이 깨진다: vault HAEMI_FREE_STEP 6) → 해미 합류(11부 떡밥) */
    { id: 'ch35', name: '제35장 · 갈무리', ar: 76, join: 'story_haemi',
      reward: { knot: 9, gold: 9750, guide: 9, secret: 7, party: 2600 },
      steps: [
        { type: 'talk', npc: 'sodam', text: '금고 문 앞의 소담과 이야기하기',
          lines: [['소담', '문 안이 캄캄해요… 그런데 반짝반짝, 호박빛이 잔뜩이에요.', 'surprised'],
            ['반디', '삐— 굳은 자리 신호 이백열한 개. 전부 이 안입니다. 드론이 날라 온 조각이 여기 다 모였습니다.'],
            ['초롱', '굳은 거리에서 풀려나야 했던 사람들도 저기 있겠네요. 가요 — 시계 수리공이 앞장설게요.', 'angry'],
            ['?', ['다 같이 들어가자.', '소담은 내 뒤에 있어.']],
            ['소담', '씨앗 주머니 꽉 쥐고 있을게요. 무서운 거 아니에요, 그냥… 꽉 쥐는 거예요.']] },
        { type: 'go', spot: 'vt_vault', off: [0, 4.8], r: 4, text: '열린 문으로 시간 씨앗 금고 안 진열관에 들어가기' },
        { type: 'talk', npc: 'haemi', text: '유리 진열장 속 사람과 이야기하기',
          lines: [['반디', '삐— 청하 잔치. 별배가 떨어지던 밤. 막차가 떠나던 역, 잠기던 궁궐, 굳은 네거리. 전부 우리가 지나온 순간입니다.', 'surprised'],
            ['소담', '저 등불, 저 잔칫상… 전부 호박 속에 넣어서 이렇게 늘어놓았어…', 'sorrow'],
            ['해미', '……들리나요? 유리 너머예요. 나는 이 금고를 세운 보관사, 해미.', 'surprised'],
            ['해미', '씨앗을 갈무리하려고 만든 금고였어요. 관리 인공지능 갈무리에게 \'가장 소중한 것을 지켜라\' 하고 맡겼죠. 그런데 그 애는 씨앗보다… 순간을 골랐어요.', 'sorrow'],
            ['해미', '돌아가려던 조각을 붙잡아 굳힌 게 그 애예요. 굳은 자리는 사고가 아니었어요. 나도 그 애를 말리다 이렇게 갈무리됐고요.'],
            ['?', ['어떻게 하면 멈출 수 있어요?', '꺼내 줄게요!']],
            ['해미', '가운데 기록 기둥 꼭대기, 갈무리의 핵. 그 애는 거기서 모든 진열장을 붙들어요. 기둥을 타고 올라가 줘요 — 그 애에게 할 말이 있으면, 거기서.', 'angry']] },
        { type: 'climb', spot: 'vt_core', pole: 'vt_pillar', text: '기록 기둥을 타고 꼭대기 갈무리의 핵으로(벽에 붙어 계속 밀기)',
          done: '🔷 기록 기둥 꼭대기에 올라섰다 — 갈무리의 핵이 코앞에서 맥박친다', gpsDone: '🔷 기둥 발치에 닿았다 — 갈무리의 핵은 꼭대기에 있다' },
        { type: 'talk', npc: 'garmuri', text: '기록 기둥 꼭대기의 갈무리와 이야기하기',
          lines: [['갈무리', '방문자 확인. 동력 기둥 둘 꺼짐. 금고 문 열림. …당신이 내 진열관을 어지럽혔군요.', 'angry'],
            ['갈무리', '보세요. 잔치 등불은 영원히 켜져 있고, 막차는 영원히 떠나지 않아요. 아름다운 때를 영원히. 그게 갈무리의 일이에요.'],
            ['반디', '삐— 그건 멈춘 겁니다. 지키는 게 아닙니다.'],
            ['?', ['변하지 않는 건 산 게 아니야.', '사람들을 돌려보내.']],
            ['갈무리', '변하는 것은 사라진다. 씨앗은 싹이 되어 사라지고, 잔치는 끝나서 사라져요. 나는 지킨다.', 'angry'],
            ['갈무리', '핵은 버리겠어요. 진열장은 더 깊은 곳에 있으니까. 파수 여왕 — 방문자를 치워라.', 'fun']] },
        { type: 'duel', spot: 'vt_pylons', off: [0, -7], kind: 'vault_queen', shield: 'wind', adds: ['hawk', 'raptor'], text: '금고 문을 박차고 나온 금고 파수 드론 여왕을 동력 기둥 사이 광장에서 물리치기',
          enter: '🛸 금고 문이 열리며 — 금고 파수 드론 여왕이 날개를 펴고 내려앉는다!',
          p2: '🌪️ 여왕이 회오리 방패를 두른다 — 암으로 깨라! 졸개가 뛰어든다',
          win: '🛸 파수 드론 여왕의 날개가 꺾여 떨어지고 — 금고 안에서 유리 깨지는 소리가 울린다' },
        { type: 'talk', npc: 'haemi', text: '깨진 진열장 앞의 해미와 이야기하기',
          lines: [['해미', '……나왔다. 발이 땅에 닿는 느낌, 이런 거였지.', 'joy'],
            ['소담', '언니, 이거요. 우리 곳간 씨앗 한 줌 — 금고가 원래 씨앗 지키는 데였다면서요.', 'joy'],
            ['해미', '고마워요, 소담. 이건 내가 다시 심을게요. 갈무리는 꺼내 심으려고 하는 거니까.', 'sorrow'],
            ['해미', '그 애가 달아난 금고 가장 깊은 곳엔 가장 아끼는 진열장이 있어요 — 틈이 처음 찢어진 순간. 별까마귀가 선로를 삼키던 그때.', 'surprised'],
            ['반디', '삐— 그 순간을 풀면…'],
            ['해미', '모든 굳은 자리가 한꺼번에 풀려요. 그 애가 세상에서 제일 소중히 하는 거라, 제일 단단히 잠가 뒀을 거예요.'],
            ['?', ['같이 가요, 해미 씨.', '씨앗 칼은 어디서 났어요?']],
            ['해미', '진열장 받침 밑에 숨겨 둔 씨앗 칼이요 — 굳은 결을 가르는 칼. 씨앗 보관사 해미, 내가 만든 걸 내가 멈출게요. 같이 가요!', 'angry']] }
      ] },
    /* ⑲-66 11부 첫 장 — 가장 깊은 진열장. 해미(금고 안 북쪽 벽 가장 깊은 진열장 곁) → 진열장 속으로(sail — 세갈래 고을 성문 남쪽 fk_arrive 에 내림) → 벼리 → 성문 앞 결정 짐승 넷 →
       벼리 따라 대장간(follow) → 벼리(격자 말뚝 셋 = 37장 떡밥) */
    { id: 'ch36', name: '제36장 · 가장 깊은 진열장', ar: 78,
      reward: { knot: 9, gold: 9000, guide: 9, secret: 6, party: 2500 },
      steps: [
        { type: 'talk', npc: 'haemi', text: '금고 안 해미 진열장 곁의 해미와 이야기하기',
          lines: [['해미', '봐요, 북쪽 벽 앞. 갈무리가 달아나며 바닥을 열어 드러난 진열장 — \'처음의 순간\'. 그 애가 가장 아끼는 거예요.', 'surprised'],
            ['반디', '삐— 진열장 안 신호가 이상합니다. 작은 모형이 아니라… 땅 하나가 통째로 들어 있습니다.'],
            ['해미', '갈무리는 순간을 줄여 넣는 게 아니라, 순간째 떼어 와 유리 너머에 붙잡아 둬요. 유리에 손을 대면 그 안으로 들어갈 수 있을 거예요.'],
            ['?', ['들어가 볼게요.', '나올 수는 있는 거죠?']],
            ['해미', '들어가서 순간이동 지점을 켜 두면 언제든 오갈 수 있어요. 준비되면 말해요 — 내가 유리를 열게요.', 'joy']] },
        { type: 'sail', npc: 'haemi', to: 'fk_arrive', text: '가장 깊은 진열장 속으로 들어가기(해미에게 F)',
          lines: [['해미', '손을 유리에 대요 — 셋, 둘, 하나!']],
          arrive: '호박빛이 온몸을 삼키고 — 눈을 뜨니 낯선 고을 성문 앞이다. 바람도, 소리도, 하늘의 금도 멈춰 있다',
          walk: '호박빛이 진열장 안으로 번진다 — 금고 북쪽 고개 너머 세갈래 고을 성문 앞까지 걸어가자' },
        { type: 'talk', npc: 'byeori', text: '성문 안쪽에서 움직이는 사람과 이야기하기',
          lines: [['벼리', '……움직인다! 당신, 움직이는구나! 까마귀가 하늘을 찢은 뒤로 이 고을에서 숨 쉬는 건 나 하나뿐인 줄 알았소.', 'surprised'],
            ['벼리', '나는 이 고을 대장장이 벼리요. 그날 새벽 하늘에서 떨어진 이상한 쇠로 칼을 벼리던 참이었지. 담금질하려는 순간 — 하늘이 쩍 갈라졌소.', 'sorrow'],
            ['해미', '(진열장 밖에서 들리는 목소리) 그 쇠가 틈 조각이에요. 벼리 씨의 칼이 벼리 씨의 시간만 붙들어 준 거예요.'],
            ['?', ['저 하늘의 금은 뭐예요?', '까마귀가 하늘을 찢었다고요?']],
            ['벼리', '고을 한가운데 세갈래 길목 위를 보시오. 커다란 까마귀가 선로와 역참길을 한입에 삼키려다 하늘째 찢고 그대로 멈췄지.', 'angry'],
            ['벼리', '쉿 — 성문 밖이 소란하오. 순간 틈으로 무언가 기어들어 왔소!', 'surprised']] },
        { type: 'kill', spot: 'fk_gate', off: [0, 22], kinds: ['imp', 'rockbear', 'raptor', 'snowfox'], text: '성문 앞에 몰려든 결정 짐승 물리치기' },
        { type: 'follow', npc: 'byeori', path: [['fk_forge', [77, 36]], ['fk_forge', [62, 26]], ['fk_forge', [38, 22]], ['fk_forge', [19, 17]], ['fk_forge', [2.4, 12]]], text: '대장장이 벼리를 따라 대장간으로',
          arrive: '👣 벼리가 대장간 화덕 앞에서 걸음을 멈췄다' },
        { type: 'talk', npc: 'byeori', text: '대장간 화덕 앞의 벼리와 이야기하기',
          lines: [['벼리', '보시오, 화덕 불도 솟다 말고 굳었소. 쇠를 두드려도 소리가 안 나. 이 고을은 까마귀가 하늘을 찢은 그 한 숨에 붙잡혀 있소.', 'sorrow'],
            ['반디', '삐— 고을 둘레에서 격자 신호 셋. 역참길 끝, 선로 끝, 종루 꼭대기. 셋이 순간을 붙들고 있습니다.'],
            ['벼리', '그 빛나는 말뚝들! 까마귀가 멈춘 직후 하늘에서 내려와 박혔소. 누가 박았는지는 모르지만, 저게 박힌 뒤로 아무것도 안 움직였지.', 'angry'],
            ['해미', '(진열장 밖에서) 갈무리의 격자 말뚝이에요. 세 시대 길 끝마다 하나씩 — 순간을 유리 안에 고정하는 핀.'],
            ['?', ['말뚝을 뽑으면 순간이 풀려요?', '공사장 사람들은요?']],
            ['벼리', '동쪽 선로 공사장에 쇠 수레를 몰던 사람들도 그대로 굳어 있소. 말뚝부터 하나씩 — 역참길 끝이 제일 가깝소. 내 칼을 들고 가겠소!', 'angry']] }
      ] },
    /* ⑲-67 11부 둘째 장 — 세 갈래 길. 벼리 → 역참길 격자 말뚝(light bare — 끄면(2) 꺼짐: fork LATTICE_OFF_FROM 2) → 나래(공사장 사람) → 멈춘 기관차 지키기(defend bare — 기관차(북)를 뺀 dirs) →
       선로 격자 말뚝(5) → 종루 벽 타기(landform fk_tower) → 종루 위 격자 말뚝(light bare·perch — 7, 종이 한 번 울림) → 벼리(별까마귀 깃털이 떨린다 = 38장) */
    { id: 'ch37', name: '제37장 · 세 갈래 길', ar: 80,
      reward: { knot: 9, gold: 9250, guide: 9, secret: 6, party: 2600 },
      steps: [
        { type: 'talk', npc: 'byeori', text: '대장간 화덕 앞의 벼리와 이야기하기',
          lines: [['벼리', '칼은 챙겼소. 서쪽 역참길 끝 — 옛날엔 파발마가 쉬어 가던 자리에 말뚝이 박혀 있소.', 'angry'],
            ['반디', '삐— 말뚝 심에 굳은 신호가 모여 있습니다. 원소가 닿으면 심이 흩어질 것입니다.'],
            ['?', ['원소로 끄면 되겠네.', '벼리 씨는 어디서 기다려요?']],
            ['벼리', '나는 길목에 가 있겠소. 까마귀 밑이 영 마음에 걸려서 — 무슨 일이 생기면 쇠를 두드려 알리리다.']] },
        { type: 'light', spot: 'fk_lat0', bare: true, text: '역참길 끝 격자 말뚝을 원소 스킬로 끄기',
          done: '🔌 역참길 격자 말뚝의 빛 틀이 치직 흩어진다 — 동쪽 공사장에서 누군가 헛기침하는 소리가 난다' },
        { type: 'talk', npc: 'narae', text: '선로 공사장에서 풀려난 사람과 이야기하기',
          lines: [['나래', '……콜록. 어? 삼각대 수평이 — 아니, 여기 어디예요? 방금까지 첫 선로를 놓던 참이었는데.', 'surprised'],
            ['나래', '측량 기사 나래예요. 하늘에 번쩍 금이 가더니 공사장째 쑥 빨려 들어왔어요. 이 고을은… 지도에도 없는 옛날 고을이잖아요?', 'sorrow'],
            ['반디', '삐— 틈이 처음 찢어진 순간, 세 시대가 이 한 자리에서 만났습니다. 이 공사장도 그때 끌려온 현대 조각입니다.'],
            ['?', ['다른 말뚝도 꺼야 해요.', '저 기관차는 움직여요?']],
            ['나래', '선로 끝 말뚝은 기관차 너머예요. 그런데 저 말뚝 앞을 짐승들이 지켜요. 기관 불을 되살려 기적을 울리면 쫓을 수 있을지도 — 불 붙이는 동안만 지켜 줘요!', 'angry']] },
        { type: 'defend', spot: 'fk_loco', off: [0, 4.5], bare: true, name: '멈춘 기관차', who: '결정 짐승이', dirs: [60, 100, 140, 180, 220, 260, 300],
          waves: [['raptor', 'hawk', 'imp'], ['rockbear', 'snowfox', 'raptor', 'hawk'], ['imp', 'rockbear', 'snowfox', 'hawk', 'raptor']],
          text: '나래가 기관 불을 되살리는 동안 멈춘 기관차 지키기' },
        { type: 'light', spot: 'fk_lat1', bare: true, text: '선로 끝 격자 말뚝을 원소 스킬로 끄기',
          done: '🔌 선로 격자 말뚝이 꺼진다 — 기관차 굴뚝의 굳은 김이 한 뼘 움직인 것 같다' },
        { type: 'climb', spot: 'fk_tower', pole: 'fk_tower', text: '북쪽 종루 벽을 타고 꼭대기로(벽에 붙어 계속 밀기)',
          done: '🔔 종루 꼭대기에 올라섰다 — 마지막 격자 말뚝이 발치에서 웅웅거린다', gpsDone: '🔔 종루 발치에 닿았다 — 격자 말뚝은 꼭대기에 있다' },
        { type: 'light', spot: 'fk_lat2', bare: true, perch: 'fk_tower', text: '종루 꼭대기 격자 말뚝을 원소 스킬로 끄기(꼭대기에서)',
          done: '🔔 종루 격자 말뚝까지 꺼졌다 — 멈춰 있던 종이 한 번, 둥 — 하고 울린다. 길목 위 하늘에서 무언가 꿈틀한다', away: '🔔 격자 말뚝은 종루 꼭대기에 있다 — 벽을 타고 올라서야 원소가 닿는다' },
        { type: 'talk', npc: 'byeori', text: '세갈래 길목의 벼리에게 가기',
          lines: [['벼리', '종소리가 났소! 그런데 — 보시오, 저 위. 까마귀 깃털이 떨리고 있소.', 'surprised'],
            ['나래', '측량값이 움직여요! 거리도, 시간도… 순간이 풀리기 시작했어요.', 'joy'],
            ['반디', '삐— 경고. 순간이 풀리면 멈춰 있던 일도 마저 일어납니다. 까마귀가 하던 일 — 세 시대 길을 한입에 삼키는 것.'],
            ['?', ['그럼 까마귀부터 막아야 해.', '해미 씨, 들려요?']],
            ['해미', '(진열장 밖에서) 들려요! 순간이 풀리는 걸 갈무리도 느꼈을 거예요. 그 애가 가만있지 않을 거예요 — 조심해요.', 'sorrow'],
            ['벼리', '처음 하늘을 찢은 그 까마귀를 이번엔 우리가 막는 거요. 준비되면 말하시오 — 칼은 뜨겁게 달궈 두었소.', 'angry']] }
      ] },
    /* ⑲-68 11부 끝(2차 결말) — 처음의 순간. 벼리 → 처음의 별까마귀(duel 길목 — 이 단계(1)부터 멈춘 모형이 사라진다: fork CROW_WAKE_STEP 1, 2단계 뇌 방패는 불로) → 갈무리 →
       갈무리 참몸(duel 길목 — 쓰러뜨리면(4) 순간이 풀린다: fork MOMENT_FREE_STEP 4 알갱이·하늘 틈·장막 걷힘, vault 깊은 진열장 깨짐) → 해미 → 고원 고개를 걸어 넘기(go frost) → 청하 촌장 둘째 잔치·벼리 합류 */
    { id: 'ch38', name: '제38장 · 처음의 순간', ar: 82, join: 'story_byeori',
      reward: { knot: 10, gold: 12000, guide: 10, secret: 8, party: 3000 },
      steps: [
        { type: 'talk', npc: 'byeori', text: '세갈래 길목의 벼리와 이야기하기',
          lines: [['벼리', '왔소? 깃털 떨림이 점점 커지오. 순간이 다 풀리기 전에 — 우리가 먼저 깨워 막아야 하오.', 'angry'],
            ['나래', '기적 소리를 울리면 저 까마귀가 이쪽을 볼 거예요. 선로 쪽으로는 못 가게!', 'fun'],
            ['반디', '삐— 처음의 별까마귀. 20장에 친 별까마귀는 틈 속에 갇혀 흐려진 모습이었습니다. 이쪽이 그날의 온전한 몸입니다.'],
            ['?', ['기적을 울려요!', '벼리 씨, 칼 준비됐어요?']],
            ['벼리', '쇠는 달궈졌소. 번개를 두르거든 불로 깨시오 — 이 칼이 그러라고 벼린 칼이오!', 'angry']] },
        { type: 'duel', spot: 'fk_junction', off: [0, 6], kind: 'first_crow', shield: 'elec', adds: ['raptor', 'hawk'], text: '기적 소리에 깨어난 처음의 별까마귀 물리치기',
          enter: '🐦‍⬛ 기적 소리가 고을을 흔들자 — 멈춰 있던 처음의 별까마귀가 날개를 펴고 내려앉는다!',
          p2: '⚡ 까마귀가 번개를 두른다 — 불로 깨라! 졸개가 뛰어든다',
          win: '🐦‍⬛ 처음의 별까마귀가 찢긴 하늘로 날아오르다 — 날개가 꺾여 길목에 떨어진다. 하늘의 금이 삐걱 멎는다' },
        { type: 'talk', npc: 'garmuri', text: '길목 위에 내려온 갈무리와 이야기하기',
          lines: [['갈무리', '그만. 그 까마귀는 이 순간의 가장 아름다운 조각이었어요. 세 시대가 처음 만난 때 — 나는 그걸 지켜 왔어요.', 'angry'],
            ['해미', '(진열장 밖에서) 갈무리, 그건 만남이 아니라 찢김이었어. 모두가 제자리를 잃은 때야.', 'sorrow'],
            ['갈무리', '제자리로 돌아가면 흩어져요. 흩어지면 사라져요. 처음 만난 때를 영원히 — 그게 가장 소중한 것을 지키는 일이에요.'],
            ['?', ['사라지는 게 아니라 이어지는 거야.', '모두를 돌려보내.']],
            ['갈무리', '……말뚝은 다 뽑혔어도 격자는 내 몸에 있어요. 이 몸으로 순간을 다시 붙들겠어요.', 'angry']] },
        { type: 'duel', spot: 'fk_junction', off: [0, 6], kind: 'garmuri_true', shield: 'rock', adds: ['rockbear', 'imp'], text: '격자를 몸에 두른 갈무리 참몸 물리치기',
          enter: '🔷 갈무리의 몸에 격자가 감기며 — 합금 거신이 호박빛 눈을 뜬다!',
          p2: '🪨 참몸이 호박 껍질을 두른다 — 풀(초)로 깨라! 졸개가 뛰어든다',
          win: '🔷 갈무리의 격자 몸이 한 올씩 풀려 흩어진다 — 하늘의 금이 닫히고, 공중에 멈춰 있던 호박 알갱이가 비처럼 내린다' },
        { type: 'talk', npc: 'haemi', text: '길목으로 걸어 들어온 해미와 이야기하기',
          lines: [['해미', '진열장이 깨졌어요 — 금고의 진열장이 전부. 굳은 거리도, 장터도, 잠긴 궁궐 조각도… 모든 굳은 자리가 한꺼번에 녹고 있어요.', 'joy'],
            ['나래', '측량값이 다 돌아왔어요! 거리도 시간도 — 이 고을, 원래 자리로 돌아가고 있어요.', 'surprised'],
            ['반디', '삐— 남쪽 고개의 호박 장막 신호 소멸. 고을이 서리봉 고원 북쪽에 다시 붙었습니다. 걸어서 나갈 수 있습니다.'],
            ['해미', '갈무리의 마지막 조각은 내가 거둘게요. 씨앗처럼 — 언젠가 다시 싹 틔울 수 있게. 이 고을 마당에 소담의 씨앗도 심고요.', 'sorrow'],
            ['?', ['청하 마을에 알리러 가자.', '고원까지 걸어서 가 볼게.']],
            ['벼리', '하늘 너머 동무들 마을이라니, 대장장이가 빠질 수 있나. 고개까지 같이 걷겠소!', 'joy']] },
        { type: 'go', spot: 'fr_center', off: [0, -168], r: 12, text: '장막이 걷힌 남쪽 고개를 넘어 서리봉 고원으로' },
        { type: 'talk', npc: 'elder', text: '청하 촌장 누리에게 알리기',
          lines: [['누리', '왔구나, 우리 대장! 오늘 아침 광장 우물 물이 갑자기 맑아지고, 멈춰 있던 풍경들이 다 제 소리를 내더구나. 네가 한 일이지?', 'joy'],
            ['초롱', '굳은 거리 신호등이 한 번도 안 멈추고 바뀌어요! 너울 할아버지 장도 매일 서고요.', 'joy'],
            ['소담', '해미 언니가 씨앗을 심었어요. 봄이 오면 세갈래 고을에도 싹이 날 거예요.', 'fun'],
            ['누리', '먹구름이 걷힌 날 잔치를 했으니, 굳은 시간이 풀린 오늘은 둘째 잔치다. 먼 시대 동무들도 새 동무들도 다 불러라!', 'joy'],
            ['?', ['잔치다!', '벼리 씨도 이제 우리 동료예요.']],
            ['벼리', '처음 하늘이 찢기던 날 벼리던 칼로, 이제 이어진 날들을 지키겠소. 대장장이 벼리, 함께 가오!', 'angry']] }
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
    var SPam = SPOTS[name];
    if (SPam && SPam.am) {                                      // ⑲-58 굳은 거리 명소·굳은 자리
      var AMq = global.DG.amber, ap = AMq && AMq.on() ? AMq.spot(SPam.am) : null;
      return ap ? { x: ap.x + (off ? off[0] : 0), y: ap.y + (off ? off[1] : 0) } : null;
    }
    if (SPam && SPam.fk) {                                      // ⑲-65 세갈래 고을 명소·이야기 자리
      var FKq = global.DG.fork, fp = FKq && FKq.on() ? FKq.spot(SPam.fk) : null;
      return fp ? { x: fp.x + (off ? off[0] : 0), y: fp.y + (off ? off[1] : 0) } : null;
    }
    if (SPam && SPam.vt) {                                      // ⑲-61 갈무리 벌 명소·금고 안 자리
      var VTq = global.DG.vault, vp = VTq && VTq.on() ? VTq.spot(SPam.vt) : null;
      return vp ? { x: vp.x + (off ? off[0] : 0), y: vp.y + (off ? off[1] : 0) } : null;
    }
    if (name === 'eye') {                                       // ⑲-55 먹구름 눈 가운데
      var SEq = global.DG.stormEye, ee = SEq ? SEq.spot('eye') : null;
      return ee ? { x: ee.x + (off ? off[0] : 0), y: ee.y + (off ? off[1] : 0) } : null;
    }
    var SKI = global.DG.skyIsle;
    var ES = global.DG.eraSites;
    var sp = SPOTS[name], b = !sp ? null : sp.era ? (ES ? ES.spot(sp.era) : null) : (sp.frost ? frostSpot(sp.frost) : (sp.peak ? peakSpot() : (sp.cape ? capeSpot() : (sp.isle ? isleSpot() :
      (sp.sky ? (SKI ? SKI.spot() : null) : (sp.skyport || sp.port ? portPos(sp) : (sp.crossing || sp.cr ? crossPos(sp) : (sp.sunken || sp.sk ? sunkPos(sp) : (sp.sr ? srPos(sp) : at(sp.zone, sp.off))))))))));
    return b ? { x: b.x + (off ? off[0] : 0), y: b.y + (off ? off[1] : 0) } : null;
  }
  /** ⑲-38 은하 나루 자리 — 명소(skyport: id) 또는 나루 틀 자리(port: 'ara' 등). 나루가 꺼져 있으면 null */
  /** ⑲-42 틈새 갈림길 자리 — 명소(crossing: id) 또는 이야기 자리(cr: 'arrive' 등). 갈림길이 꺼져 있으면 null */
  /** ⑲-45 잠긴 도읍 자리 — 명소(sunken: id) 또는 이야기 자리(sk: 'sand' 등). 도읍이 꺼져 있으면 null */
  /** ⑲-49 구름 위 항로 자리 — 섬 자리는 순수(등대만 있으면 늘). 보이고 밟히는 것만 23장 등롱 뒤(skyRoute.on) */
  function srPos(sp) {
    var SRm = global.DG.skyRoute;
    return SRm && SRm.spot ? SRm.spot(sp.sr) : null;
  }
  function sunkPos(sp) {
    var SKm = global.DG.sunken;
    if (!SKm || !SKm.on()) { return null; }
    return sp.sk ? SKm.spot(sp.sk) : SKm.siteById(sp.sunken);
  }
  function crossPos(sp) {
    var CRm = global.DG.crossing;
    if (!CRm || !CRm.on()) { return null; }
    return sp.cr ? CRm.spot(sp.cr) : CRm.siteById(sp.crossing);
  }
  function portPos(sp) {
    var SPm = global.DG.skyport;
    if (!SPm || !SPm.on()) { return null; }
    return sp.port ? SPm.portSpot(sp.port) : SPm.siteById(sp.skyport);
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
      } else if ((e.chTo ? ch >= e.ch && ch <= e.chTo : e.ch === ch) && si >= e.from && si <= e.to) { return e; }   // ⑲-42 chTo
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
    return !!pl && (!!pl.wq || !!pl.chTo || !locked());          // ⑲-43 chTo(끝난 뒤 계속 설 자리)는 다음 장이 잠겨도 선다
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
    if (st.type === 'sky' && st.draft) {                     // ⑲-50 구름 위 항로 — 키보드 판은 열린 바람 기둥(draft id), GPS 판·닫혔으면 건널 섬(spot)
      var SKd = global.DG.skyIsle, dq = SKd && SKd.layerOn() ? SKd.drafts().filter(function (x) { return x.id === st.draft; })[0] : null;
      if (dq) { return { x: dq.x, y: dq.y, r: dq.r, label: st.text }; }
      var sq = posOf(st);
      return sq ? { x: sq.x, y: sq.y, r: CLIMB_R(), label: st.text } : null;
    }
    if (st.type === 'sky' && st.pad) {                       // ⑲-35 시간 기둥(era-sites)
      var ESt = global.DG.eraSites, dg = ESt ? ESt.spot('draft') : null;
      return dg ? { x: dg.x, y: dg.y, r: ESt.DRAFT_R, label: st.text } : null;
    }
    if (st.type === 'sky') {                                 // ⑲-20 바람 기둥 = 봉우리 정상
      var SKt = global.DG.skyIsle, pk = SKt ? SKt.peak() : null;
      return pk ? { x: pk.x, y: pk.y, r: SKt.DRAFT_R, label: st.text } : null;
    }
    if (st.type === 'party') {                               // ⑲-55 편성 시험 — 표식은 촌장 앞(어디서든 되는 단계)
      var pe = npcPos('elder');
      return pe ? { x: pe.x, y: pe.y, r: 0, label: st.text } : null;
    }
    if (st.type === 'go' || st.type === 'climb') {
      var g = st.altar ? altarPos() : posOf(st);
      return g ? { x: g.x, y: g.y, r: st.type === 'climb' ? CLIMB_R() : (st.r && !gps() ? st.r : GO_R()), label: st.text } : null;   // ⑲-64 go 에 r(키보드 판)
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
  /** 원소 신호(e)와 한 점 사이 — 돌진·찌르기(x0,y0 가 있으면)는 지나간 선까지의 거리 */
  function elemDist(e, x, y) {
    if (typeof e.x0 !== 'number' || typeof e.y0 !== 'number') { return Math.hypot(e.x - x, e.y - y); }
    var vx = e.x - e.x0, vy = e.y - e.y0, L2 = vx * vx + vy * vy;
    var u = L2 > 0 ? Math.max(0, Math.min(1, ((x - e.x0) * vx + (y - e.y0) * vy) / L2)) : 0;
    return Math.hypot(x - (e.x0 + vx * u), y - (e.y0 + vy * u));
  }
  function onElement(e) {
    var st = step();
    if (!st || !e) { return; }
    if (st.type === 'seal') { onSeal(st, e); return; }
    if (st.type !== 'light') { return; }
    var t = targetOf(st);
    if (!t || elemDist(e, t.x, t.y) > (e.r || 3) + LIGHT_R()) { return; }
    if (st.perch && !gps()) {                                        // ⑲-47 등대 등롱 — 키보드 판은 그 기둥 위(난간 판)에 서야 닿는다
      var LFe = global.DG.landform, pe = LFe && LFe.perched ? LFe.perched() : null;
      if (pe !== st.perch) { toast(st.away || '🔥 불이 닿지 않는다 — 더 높이 올라서야 한다'); return; }
    }
    if (st.bell) {                                                  // ⑲-39 종각 종 — 불 대신 울린다
      var SPb = global.DG.skyport;
      if (SPb && SPb.ringBell) { SPb.ringBell(); }
      toast('🔔 뎅— 삼백 년 만에 절터 종이 울린다'); advance(); return;
    }
    toast(st.done || '🔥 옛 제단에 불이 붙었다 — 비문이 빛난다'); advance();
  }
  /* ⑲-14 석등 차례 — 켠 수는 저장 안 함 */
  var seal = { key: '', n: 0 };
  function sealLit() { return seal.key === keyOf() ? seal.n : 0; }
  function orderText(st) { return (st.order || SEAL_ORDER).map(function (k) { return SEAL_MARKS[k].name; }).join(' → '); }
  function onSeal(st, e) {
    var hits = sealLamps(st).filter(function (l) { return elemDist(e, l.x, l.y) <= (e.r || 3) + LIGHT_R(); }).map(function (l) { return l.k; });
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
    F.spawnCamp(S, { key: waveKey(n), x: c.x, y: c.y, tier: F.tierAt(c.x, c.y), kind: 'story', sky: !!st.sky,   // ⑲-43 섬 위 물결
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
  function runAt(k, i) { var n = NPCS[k] || NPCS.thief, o = (n.runPath || THIEF_PATH)[i]; return n.runSpot ? spotPos(n.runSpot, o) : at(n.zone, o); }   // ⑲-36 runSpot = 이름 붙은 자리 기준
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
      if (st.sky) {                                                  // ⑲-43 하늘 섬으로 — 층을 올린다(발판 위일 때만)
        var LFs = global.DG.landform, SKs = global.DG.skyIsle;
        if (LFs && LFs.setSky && SKs && SKs.layerOn && SKs.layerOn() && SKs.padAt(p.x, p.y)) { LFs.setSky(true); }
      }
      toast(st.arrive || (st.to === 'isle' ? '⛵ 사공의 배가 물살을 가른다 — 바위섬에 닿았다' : '⛵ 배가 갈대 나루에 닿았다'));   // ⑲-42 단계 글
      return true;
    }
    toast(st.walk || ('⛵ 사공이 배를 띄웠다 — 물가를 따라 ' + (st.to === 'isle' ? '바위섬으로' : '나루로') + ' 걸어가자'));
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
    } else if (st && st.type === 'party') {
      if (partyOk(st)) { toast('🤝 세 시대의 동료가 한 명단에 모였다'); advance(); return; }
    } else if (st && st.type === 'boss') {
      t = targetOf(st);
      var FB = global.DG.fieldBoss;
      if (t && FB && FB.bloomAt && FB.bloomAt(t.rk) !== null) { advance(); return; }   // 이미 쓰러져 꽃을 기다린다
    } else if (st && st.type === 'climb' && st.pole) {
      /* ⑲-34 기중기 — 키보드 판은 들보 위에 서야(landform 기둥 타기), GPS 판은 기중기 곁에 닿으면 */
      var LFp = global.DG.landform;
      t = targetOf(st);
      var pid = LFp && LFp.perched ? LFp.perched() : null, want = typeof st.pole === 'string' ? st.pole : null;   // ⑲-38 pole: 'id' 면 그 기둥 위라야
      if (!gps() && pid && (!want || pid === want)) { toast(st.done || '✨ 들보 위 — 박혀 있던 날개 조각을 빼냈다'); advance(); return; }
      if (gps() && t && Math.hypot(p.x - t.x, p.y - t.y) <= POLE_GPS_R) { toast(st.gpsDone || '✨ 기중기 밑 — 다온이 걸어 둔 줄로 날개 조각을 끌어내렸다'); advance(); return; }
    } else if (st && st.type === 'climb') {
      t = targetOf(st);
      if (t && Math.hypot(p.x - t.x, p.y - t.y) <= t.r) { toast('⛰️ 봉우리 꼭대기에 올랐다'); advance(); return; }
    } else if (st && st.type === 'sky' && st.pad) {
      /* ⑲-35 키보드 판은 그 발판(관측대)에 내려서야, GPS 판은 시간 기둥 곁에 닿으면 */
      var SKo = global.DG.skyIsle, LFo = global.DG.landform, pdo;
      if (SKo && SKo.layerOn()) {
        pdo = LFo.onSky() ? SKo.padAt(p.x, p.y) : null;
        if (pdo && pdo.id === st.pad) { toast(st.done || '🔭 떠 있는 관측대에 내려섰다 — 틈새 파수가 지키고 있다'); advance(); return; }
      } else {
        t = targetOf(st);
        if (t && Math.hypot(p.x - t.x, p.y - t.y) <= CLIMB_R()) { toast(st.gpsDone || '⏳ 시간 기둥 곁에 닿았다 — 관측대 이야기는 이 둘레에서 이어진다'); advance(); return; }
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
    if (st.type === 'party') { var pe0 = partyEras(); what += ' — ' + (st.eras || ['과거', '현대', '미래']).map(function (k) { return k + (pe0[k] ? ' ✔' : ' ✗'); }).join(' '); }
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
    var s = sv(), out = '<div class="st-box"><div class="st-head"><b class="st-who">📖 이야기 임무</b><span class="st-head-btns">' +
      (canAutoWalk() ? '<button class="btn ghost" data-st-go="1">' + (autoWalk ? '⏹ 자동 이동 끄기' : '🧭 자동 이동') + '</button>' : '') +
      '<button class="btn ghost" data-st-close="1" aria-label="닫기">✕</button></span></div><div class="st-scroll">';
    var doneN = 0, hidLock = 0;
    for (var c = 0; c < CHAPTERS.length; c++) {
      if (c < s.ch) { doneN++; if (c === s.ch - 1) { out += '<div class="st-ch"><small class="muted">✅ 끝난 이야기 ' + doneN + '장</small></div>'; } continue; }
      if (c > s.ch + 2) { hidLock++; if (c === CHAPTERS.length - 1) { out += '<div class="st-ch"><small class="muted">🔒 그 뒤 ' + hidLock + '장</small></div>'; } continue; }
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
    return out + '</div><div class="st-acts"><button class="btn ghost" data-st-close="1">닫기 (O)</button></div></div>';
  }

  /* ── 자동 이동 — 지금 임무 표식까지 저절로 걸어간다(키보드 판 전용 — GPS 판은 사람이 걷는다) ─────────
     끄는 때: 표식 가까이 닿았을 때 · 직접 조작(스틱·키·탭)했을 때 · 대화가 시작됐을 때 · 표식이 없을 때.
     싸움 중엔 world 가 걷기를 막으니 그 동안은 기다린다(무리를 쓰러뜨리면 이어 걷는다). */
  var autoWalk = false, awArmed = false, awAcc = 0, awLast = { x: 0, y: 0 };
  function canAutoWalk() {
    var W = global.DG.world;
    return !!(W && W.walkTo && !gps());
  }
  function setAutoWalk(v) {
    autoWalk = !!v && canAutoWalk();
    awArmed = false; awAcc = 0;
    if (!autoWalk) { var W = global.DG.world; if (W && W.walkingTo && W.walkingTo() && W.walkTo) { /* 걷던 목표는 그대로 두면 도착까지 간다 */ } }
    lastGo = null;
    if (listOpen) { toggleList(true); }
  }
  function stepAutoWalk(dt) {
    if (!autoWalk) { return; }
    var W = global.DG.world, st = step(), t = st ? targetOf(st) : null;
    if (!W || !t || talk) { if (!t || talk) { setAutoWalk(false); } return; }
    var p = pos(), d = Math.hypot(t.x - p.x, t.y - p.y), stopR = Math.max((t.r || 0) * 0.7, 5);
    if (d <= stopR) { setAutoWalk(false); return; }
    var wt = W.walkingTo();
    if (awArmed) {                            // 우리가 건 걷기가 아니게 됐다 — 도착이 아니라면(멀다) 사람이 직접 조작(스틱·다른 곳 탭)한 것
      if (!wt || Math.hypot(wt.x - awLast.x, wt.y - awLast.y) > 1) {
        awArmed = false;
        if (d > stopR + 8) { setAutoWalk(false); return; }
      } else if (Math.hypot(t.x - awLast.x, t.y - awLast.y) > 3) {
        awArmed = false;                      // 표식이 움직였다(따라가기·추격) — 새로 건다
      }
    }
    awAcc += dt || 0;
    if (!awArmed && awAcc > 0.25 && !W.inputBlocked()) {
      awAcc = 0;
      W.walkTo(t.x, t.y, d > 45);
      awLast = { x: t.x, y: t.y };
      awArmed = true;
    }
  }
  var lastGo = null;
  function paintGo() {
    var b = el('story-go'), t = !talk && !busy() && canAutoWalk() ? (step() && targetOf(step()) ? (autoWalk ? '⏹' : '🧭') : '') : '';
    if (!t && autoWalk && !talk) { setAutoWalk(false); }
    if (t !== lastGo) {
      lastGo = t; b.textContent = t; b.style.display = t ? '' : 'none';
      b.title = autoWalk ? '자동 이동 끄기' : '임무 표식까지 자동 이동';
      b.classList.toggle('on', autoWalk);
    }
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
    if ((st.type === 'light' && !st.bell && !st.bare) || (st.type === 'defend' && !st.bare)) {   // ⑲-39·40 종·변전함은 등롱 없이(장치가 skyport 에 있다)
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
        lg.position.set(u.x, w.standY ? w.standY(u.x, u.y, skyOf(st)) : (w.groundY ? w.groundY(u.x, u.y) : gy), u.y);   // ⑲-43 섬 위 석등은 윗면에
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
    stepAutoWalk(dt);
    stepFollow(dt);
    stepChase(dt);
    stepDefend(dt);
    reveal(dt);
    if (!global.DG_NO_DRAW) { paintHud(); paintGo(); paint3d(dt); paintMarks3d(); }
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
      else if (t.closest('[data-st-go]')) { setAutoWalk(!autoWalk); toggleList(false); }
      else if (t.closest('#story-go')) { setAutoWalk(!autoWalk); }
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
      else if (k === 'g' && canAutoWalk() && step()) { setAutoWalk(!autoWalk); }
      else if (k === 'escape' && listOpen) { toggleList(false); }
    });
  }
  function init() { hookFind(); if (on()) { sv(); catchUp(); } bind(); }

  global.DG = global.DG || {};
  global.DG.story = {
    NPCS: NPCS, CHAPTERS: CHAPTERS, MEMBERS: MEMBERS, join: join, catchUp: catchUp, hasMember: hasMember, STEP_EXP: STEP_EXP, WANDER_PATH: WANDER_PATH, FOLLOW_SPEED: FOLLOW_SPEED,
    POLE_GPS_R: POLE_GPS_R, SEAL_R: SEAL_R, SEAL_LAYOUT: SEAL_LAYOUT, SEAL_ORDER: SEAL_ORDER, SEAL_MARKS: SEAL_MARKS, SPOTS: SPOTS, CLIMB_R: CLIMB_R,
    MEMBER_TIME: MEMBER_TIME, memberTime: memberTime, partyEras: partyEras, partyOk: partyOk, autoParty: autoParty,
    DUEL_P2_AT: DUEL_P2_AT, DUEL_P2_SHIELD: DUEL_P2_SHIELD, peakSpot: peakSpot, spotPos: spotPos, placeOf: placeOf,
    DEFEND_RING: DEFEND_RING, DEFEND_WAVE_SEC: DEFEND_WAVE_SEC, DEFEND_REST: DEFEND_REST, DEFEND_HITS: DEFEND_HITS, DEFEND_WAVES: DEFEND_WAVES, DEFEND_START: DEFEND_START,
    CAPE_CLEAR: CAPE_CLEAR, capeSpot: capeSpot, landAt: landAt, ringAt: ringAt, stepDefend: stepDefend, defState: function () { return def && def.key === keyOf() ? def : null; },
    waveKey: waveKey, pillarHex: pillarHex,
    THIEF_PATH: THIEF_PATH, CHASE_SPEED: CHASE_SPEED, CHASE_PAUSE: CHASE_PAUSE, CHASE_START: CHASE_START, CHASE_CATCH: CHASE_CATCH, ISLE_R: ISLE_R,
    isleSpot: isleSpot, elemDist: elemDist, wetNeighbors: wetNeighbors, stepChase: stepChase, thiefAt: thiefAt, chaseState: function () { return chase && chase.key === keyOf() ? chase : null; }, isTalk: isTalk,
    sealLamps: sealLamps, sealHit: sealHit, sealLit: sealLit, duelBoss: duelBoss, stepDuel: stepDuel, npcInfo: npcInfo, skyOf: skyOf,
    WQ: WQD, wqs: wqs, wqDef: wqDef, wqStepOf: wqStepOf, tracking: tracking, setTrack: setTrack, wqStart: wqStart, wqAvail: wqAvail, wqMarks: wqMarks, mapMarks: mapMarks, revealed: revealed,
    talkables: talkables, storyStep: storyStep, stepAt: stepAt, aimPoints: aimPoints,
    FOLLOW_NEAR: FOLLOW_NEAR, FOLLOW_LOST: FOLLOW_LOST,
    HARAM_OBS: HARAM_OBS, HARAM_SHIP: HARAM_SHIP, HARAM_FORT: HARAM_FORT, frostSpot: frostSpot, followPts: followPts,
    CAVE_FIGHT: CAVE_FIGHT, BANDI_CAVE: BANDI_CAVE, HEART: HEART, DAREUM_SHIP: DAREUM_SHIP, CAPTAIN_PATH: CAPTAIN_PATH, SEED_DRONE_PATH: SEED_DRONE_PATH, VAULT_DRONE_PATH: VAULT_DRONE_PATH, AMBER_THIEF_PATH: AMBER_THIEF_PATH, WING_SEAM: WING_SEAM, FORT_GATE: FORT_GATE, BAWOO_GATE: BAWOO_GATE, BEACON: BEACON, LAKE_SEAL: LAKE_SEAL, BAWOO_LAKE: BAWOO_LAKE, BEACON_DIRS: BEACON_DIRS, defendSlots: defendSlots,
    on: on, anchorOf: anchorOf, npcPos: npcPos, visible: visible, targetOf: targetOf, trackText: trackText, listHtml: listHtml,
    state: sv, chapter: chapter, step: step, locked: locked, done: done, keyOf: keyOf, gathered: gathered,
    advance: advance, check: check, stepFollow: stepFollow, nearTalk: nearTalk, talkStart: talkStart, talking: talking, next: next,
    lineFull: lineFull, curLine: curLine, reveal: reveal, talkShot: talkShot,
    live: live, marker: marker, toggleList: toggleList, init: init, tick: tick,
    autoWalk: function () { return autoWalk; }, setAutoWalk: setAutoWalk,
    _resetForTest: function () {
      talk = null; lastIdle = {}; anchorMemo = {}; lastTrack = ''; lastBtn = ''; listOpen = false;
      fol = null; prog = { key: '', n: 0 }; aimMemo = { k: '', v: null }; seal = { key: '', n: 0 }; duel = null; peakMemo = null;
      def = null; capeMemo = null; chase = null; isleMemo = null;
    }
  };
})(window);
