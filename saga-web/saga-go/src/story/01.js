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

  /* 인물 표 NPCS — js/story-npcs.js(R-4, 자리 상수만 넘긴다). zone·off·at·appear 꼴은 그 파일 머리 */
  var NPCS = global.DG.storyNpcs.build({ AMBER_THIEF_PATH: AMBER_THIEF_PATH, BANDI_CAVE: BANDI_CAVE, BAWOO_GATE: BAWOO_GATE, BAWOO_LAKE: BAWOO_LAKE, CAPTAIN_PATH: CAPTAIN_PATH, DAREUM_SHIP: DAREUM_SHIP, HARAM_FORT: HARAM_FORT, HARAM_OBS: HARAM_OBS, HARAM_SHIP: HARAM_SHIP, SEED_DRONE_PATH: SEED_DRONE_PATH, THIEF_PATH: THIEF_PATH, VAULT_DRONE_PATH: VAULT_DRONE_PATH });
  var NPC_KEYS = ['elder', 'ferryman', 'scholar', 'wanderer', 'haesol', 'thief', 'haram', 'bandi', 'bawoo', 'daon', 'gaon', 'dareum', 'horse', 'ara', 'hangyeol', 'dodam', 'captain', 'hanbyeol', 'yeoul', 'mulsae', 'parang', 'saebyeok', 'haneul', 'seeddrone', 'gamyeon', 'chorong', 'neoul', 'partthief', 'saegil', 'maru', 'carrier', 'sodam', 'haemi', 'garmuri', 'byeori', 'narae'];
  /* ⑲-21 세계 임무 인물 일곱(worldquest.js)을 같은 표에 — 대화·자리·혼잣말이 이야기 인물과 같은 길로 돈다 */
  var WQD = global.DG.worldQuests || null;
  if (WQD) { Object.keys(WQD.NPCS).forEach(function (k) { NPCS[k] = WQD.NPCS[k]; NPC_KEYS.push(k); }); }

  /* ⑲-15·17 이야기 동료(MEMBERS)·⑲-55 시대(MEMBER_TIME) — js/story-npcs.js. data.js 는 다섯 벌 복사본이라 아래 hookFind 가 `DG.data.find` 앞에 끼운다 */
  var MEMBERS = global.DG.storyNpcs.MEMBERS, MEMBER_TIME = global.DG.storyNpcs.MEMBER_TIME;
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

  /* 장 — 대사·단계 표는 js/story-chapters.js(R-4). 줄 = [말하는 이, 글, 표정?] · 고르는 줄 = ['?', [대답, 대답]] */
  var CHAPTERS = global.DG.storyChapters.build({ HARAM_OBS: HARAM_OBS, HARAM_SHIP: HARAM_SHIP, FORT_GATE: FORT_GATE, LAKE_SEAL: LAKE_SEAL, BEACON: BEACON, BEACON_DIRS: BEACON_DIRS, CAVE_FIGHT: CAVE_FIGHT, HEART: HEART, WING_SEAM: WING_SEAM });
