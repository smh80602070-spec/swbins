/**
 * 사냥터 — 원작식 2D 사이드스크롤의 규칙
 * ---------------------------------------------------------------
 * 순환은 셋이다:
 *   뛴다   좌우로 달리고 점프해 발판을 오른다
 *   썬다   앞을 베고 스킬을 쓴다 — 잡으면 경험치·금·탕약이 떨어진다
 *   오른다 레벨이 오르면 다음 사냥터가 열린다
 *
 * 화면은 side-view.js 가, 규칙은 여기가 맡는다. 이 파일은 캔버스를 모른다.
 *
 * 내 힘은 **선두 인물의 능력치**에서 나온다(hero.stats). 그래서 도감에서 더 좋은
 * 인물로 갈아타거나 승급하면 사냥이 수월해진다 — 다른 게임들과 같은 원칙이다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var SD = global.DG.sideData;

  /* 규칙 값은 균형 손잡이(core.tuned)를 거친다 — 어드민(`_admin.html`)이 잡는다.
     **켜질 때 한 번** 읽으므로 손잡이를 바꾼 뒤에는 게임 창을 새로고침해야 듣는다.
     자가진단·데모는 읽지 않는다(`DG_NO_TUNE`) — 판정이 흔들리면 안 된다. */
  var GRAV = core.tuned('side.grav', 1900);     // 중력 (단위/초²)
  var JUMP = core.tuned('side.jump', 760);      // 점프 속도
  var SPEED = core.tuned('side.speed', 270);    // 달리기
  var P_W = 26, P_H = 54;       // 사람 크기 (충돌 상자)
  var REACH = 78;               // 평타 사거리
  var MP_MAX = 100, MP_REGEN = core.tuned('side.mpRegen', 8);
  var BRACE_SEC = 8;
  var HIT_COOL = 0.7;           // 맞고 나서 무적
  var CLIMB = core.tuned('side.climb', 168);    // 줄을 오르내리는 속도
  var GRAB = 18;                // 줄에 붙는 좌우 여유 (중심에서)
  var PORTAL_R = 46;            // 문 앞으로 치는 좌우 여유
  var TALK_R = 90;              // 마을 사람 앞으로 치는 좌우 여유 — 화면(side-view3d)에서
                                 // 앵커 둘레 ±55 로 서성이므로 그 폭을 감싸도록 넉넉히 잡았다
  var TALK_LEAVE_R = 160;       // 대화창을 연 채 이만큼 멀어지면 저절로 닫는다
  var DROP_THRU = 0.26;         // ↓+점프로 발판을 빠져나가는 동안

  var E_HP = core.tuned('enemy.hpMul', 1);      // 적 체력 배수 (보스도 같이 탄다)
  /* 2026-09-28 실기 Q10 "사가종횡 전투 손보기" — 적 체력은 Lv 마다 ×1.22 인데 내 공격력은 레벨로 안 오른다(인물 능력치 ~100 + 장비·직업).
     그래서 첫 세 사냥터(Lv 1~14)는 공격력 100 한 방에 체력 18~240 이 녹아 "스치면 사라지는" 전투였다(헤드리스 90초 33마리·Lv 7).
     초반에만 바닥 200 + 20×(Lv-1) 을 깐다 — 공격력 100 기본 공격 2~3대. Lv 18 쯤부터는 옛 곡선이 더 커서 그대로다.
     잡졸·보스·관문·비경 보스가 모두 이 한 곳을 탄다. 손잡이 enemy.hpFloor 0 이면 옛 곡선 */
  function baseHpOf(lv) {
    var curve = 18 * Math.pow(1.22, lv - 1);
    var floor = core.tuned('enemy.hpFloor', 1) ? 200 + 20 * Math.max(0, lv - 1) : 0;
    return Math.max(curve, floor);
  }
  var E_DMG = core.tuned('enemy.dmgMul', 1);    // 적 공격 배수
  /* 회귀(회차 — scenario.js roundFoe/roundGain) 배율. 이야기 모듈이 없거나 1회차면 1 */
  function RF() { var S = global.DG.scenario; return S && S.roundFoe ? S.roundFoe() : 1; }
  function RG() { var S = global.DG.scenario; return S && S.roundGain ? S.roundGain() : 1; }
  var GAIN_EXP = core.tuned('gain.expMul', 1);  // 경험치 배수
  var GAIN_GOLD = core.tuned('gain.goldMul', 1);// 금 배수
  var DROP_POTION = core.tuned('drop.potion', 0.14);  // 탕약이 떨어질 확률
  var BOSS_COOL = core.tuned('boss.coolMul', 1);// 보스가 다시 나오기까지 (배수)
  /* 전투 연출(2026-08-26) — 판정에 닿는 것은 이 셋뿐이다.
     화면 흔들림·먼지·죽는 모습은 side-view.js 에만 있고 여기서는 모른다.
     **이 셋만 때릴 때마다 손잡이를 읽는다.** 다른 규칙 값은 켜질 때 한 번 읽지만
     (그래야 한 판 안에서 물리가 안 흔들린다), 이 셋은 어드민에서 눌러 보며 맞추는
     수라 곧바로 들어야 값이 있다. 한 번 더 읽는 값이 그만큼 싸기도 하다. */
  function critRate() { return core.tuned('crit.rate', 0.15); }   // 급소가 터질 확률
  function critMul() { return core.tuned('crit.mul', 1.6); }      // 그때 곱하는 값
  function knockPow() { return core.tuned('hit.knock', 62); }     // 맞은 적이 밀리는 힘

  /* 손맛 표준(§5-7, SAGA-DESIGN §3-C) — hitstop 은 잡졸 70ms·보스 90ms·급소
     120ms(사가나락 dungeon.js 와 같은 3단, 이 판은 보스가 급소보다 덜 묵직하게
     잡았다 — 보스는 이미 12~17배 피해라 손맛보다 "밀리지 않는다"쪽이 더 크다).
     타격음은 같은 'hit' 계열 셋을 라운드로빈(피치 ±6%)으로 돌려 연타가 다
     같은 소리로 안 들리게 한다. */
  var HIT_CUES = ['hit', 'hit2', 'hit3'];
  var HITSTOP_NORMAL = 0.07, HITSTOP_CRIT = 0.12, HITSTOP_BOSS = 0.09;
  var HURT_FLASH = 0.08;   // 피격 플래시 — 급소든 아니든 한 값(표준 80ms)

  /** 소리 한 번 — sfx.js 가 없어도 규칙은 그대로 돈다(진단·데모가 그렇다) */
  function sfx(key) {
    var S = global.DG.sfx;
    if (S) { S.play(key); }
  }

  /** 세션 카드(§5-6)의 "도감 진척" 몫 — 업적만 반영한다. **인물 등용은 뺐다**:
     이 판엔 등용서를 써서 도감에 새 인물을 들이는 길이 아직 없어서(가방에
     '등용서' 재화만 있고 소비하는 자리가 없다), 재는 값 자체가 늘 0이라
     넣어 봐야 죽은 줄이다. 그 길이 생기면 여기 더한다. */
  function achieveDoneCount() {
    var A = global.DG.achieve;
    if (!A) { return 0; }
    var list = A.list(), n = 0;
    for (var i = 0; i < list.length; i++) { if (list[i].done) { n++; } }
    return n;
  }

  var run = null;               // 지금 사냥 중인 판
  var input = { left: false, right: false, jump: false, up: false, down: false };
  var fx = [];
  var deathUid = 0;             // run.dying 항목마다 붙는 값 — 화면(side-view3d)이
                                 // 배열 인덱스 대신 이 값으로 죽는 몸을 붙든다

  /* ── 세이브 ───────────────────────────────────────────── */

  function st() {
    var s = core.save;
    if (!s.side) {
      s.side = { stage: 'sinya', potions: 3, kills: 0, deaths: 0, best: 'field', bosses: 0 };
    }
    /* 빠진 칸을 채운다 — 보스가 없던 시절의 세이브에는 이 칸이 없다 */
    if (!s.side.bossAt) { s.side.bossAt = {}; }
    if (typeof s.side.bosses !== 'number') { s.side.bosses = 0; }
    if (!s.side.mats) { s.side.mats = {}; }   // 채집 재료(PLAN 10절) — { kind: 개수 }
    /* 관문 대장(§5-4) — gateWeek: 마지막으로 이긴 주(주간 잠금), gateDay: 마지막으로
       도전한 날(승패 무관, 일일 재도전 제한). gateUniq: 고유 보상이 부위를 순환하는 커서 */
    if (!s.side.gateWeek) { s.side.gateWeek = {}; }
    if (!s.side.gateDay) { s.side.gateDay = {}; }
    if (typeof s.side.gateUniq !== 'number') { s.side.gateUniq = 0; }
    return s.side;
  }

  /* ── 내 힘 ────────────────────────────────────────────── */

  /** 지금 몸을 빌려 주는 인물 — 동료 교대(§5-8) 중이면 나와 있는 사람, 아니면 편성 선두 */
  function meId() {
    if (run && run.pty) { return run.pty.ids[run.pty.i]; }
    return core.save.party[0] || null;
  }

  function meRef() {
    var id = meId();
    return id ? global.DG.data.find(id) : global.DG.data.heroes[0];
  }

  /** 낀 장비의 합 (gear.js 가 실려 있지 않아도 돌아야 한다) */
  function gearBonus() {
    var G = global.DG.gear;
    return G ? G.bonus() : { atk: 0, def: 0, hp: 0 };
  }

  /** 직업이 보태는 것 (job.js 가 없어도 돌아야 한다) */
  function jobGrow() {
    var J = global.DG.job;
    return J ? J.grow() : { hp: 0, atk: 0, mp: 0 };
  }

  /**
   * 선두 인물의 능력치에서 체력·공격력을 뽑고, **낀 장비를 그 위에 얹는다.**
   * 몸은 인물이 정하고 장비가 보태는 것 — 이 판의 두 성장축이 여기서 만난다.
   */
  function power() {
    var id = meId();
    var s = id ? global.DG.hero.stats(id) : { might: 20, wisdom: 10, command: 15 };
    var atk = s.might * 0.9 + s.wisdom * 0.3;
    var hp = 60 + s.command * 6 + core.save.player.level * 12;
    var g = gearBonus(), jb = jobGrow();
    var RM = global.DG.rift;   // 비경(§5-3) 기억 조각 강화 — 없으면 1배
    return {
      atk: Math.max(4, Math.round(atk) + g.atk + jb.atk),
      hp: Math.round((Math.round(hp) + g.hp + jb.hp) * (RM ? RM.memHpMul() : 1)),
      def: g.def,
      mp: MP_MAX + jb.mp,
      bare: { atk: Math.max(4, Math.round(atk)), hp: Math.round(hp) }
    };
  }

  /* ── 사냥터 열기 ──────────────────────────────────────── */

  function unlocked(key) {
    var stg = SD.stage(key);
    return core.save.player.level >= stg.need;
  }

  function stages() {
    var out = [], i;
    for (i = 0; i < SD.STAGES.length; i++) {
      var s = SD.STAGES[i];
      out.push({ ref: s, open: unlocked(s.key) });
    }
    return out;
  }

  var GATHER_R = 50;          // 캐는 데 필요한 거리 — 자동으로, 지나가기만 하면 된다
  var GATHER_RESPAWN = 45;    // 다시 돋기까지(초)
  var FADE_DUR = 0.4;         // 사냥터를 넘나들 때(PLAN 16절 "화면 전환") 검게 번쩍 잦아드는 시간
  var BOSS_INTRO_DUR = 1.8;   // 보스 등장 배너(PLAN 35절)가 뜬 채 머무는 시간
  var LEVELUP_DUR = 2.0;      // 레벨업 배너(PLAN 35절)가 뜬 채 머무는 시간
  var QUESTDONE_DUR = 2.0;    // 사명 완료 배너(PLAN 35절)가 뜬 채 머무는 시간
  var ITEMPOP_DUR = 0.9;      // 아이템 획득 팝업(PLAN 35절)이 위로 뜨며 사라지는 시간
  var TIER4_GHOST_INT = 0.09; // 전직 4차 상시 잔상(§6 "성장 가시화") — 이 터울마다 하나씩
  /* 회피(PLAN 12절 → §5-5 "대시로 재정의") — 스킬(mp·띠 자리)과는 별개로 늘 쓸
     수 있는 방어 동작이다. 로그라이트 액션식 대시처럼 **짧고 자주** 쓰게
     PLAN §5-5 수치로 맞췄다(예전엔 3.0s/0.35s 로 훨씬 무거웠다 — 회피가
     귀해서 전투 리듬에 잘 안 끼었었다). 공중에서도 그대로 쓸 수 있어
     "공중 1회 포함"을 따로 셀 필요가 없다(식는 시간 0.9s 가 사실상 그 역할). */
  var DODGE_COOL = 0.9;
  var DODGE_DIST = 140;
  var DODGE_INVULN = 0.12;
  /* 이동 손맛(§5-5) — 코요테 타임·점프 버퍼·벽 차기·착지 롤. 넷 다 판정을
     안 흔들고(방향·타이밍만 너그럽게 받아 준다) "손에 붙는" 감각만 더한다. */
  var COYOTE_TIME = 0.1;      // 발판을 막 떠난 뒤에도 이만큼은 점프를 받아 준다
  var JUMP_BUFFER = 0.12;     // 착지 직전 눌러 둔 점프를 이만큼 기억한다
  var WALL_TOL = 10;          // 발판 옆면 판정 여유(px) — 전용 walls 배열이 없어 발판 자체로 판정
  var WALL_KICK_VX = 320, WALL_KICK_VY = 620, WALL_KICK_DUR = 0.22;
  var ROLL_SPEED = 1200;      // 이 낙하 속도를 넘겨 착지하면 경직 대신 구른다
  var ROLL_DUR = 0.15, ROLL_MUL = 1.4;
  /* 고유 조작(§5-1) — 회피를 **길게 누르면** 나온다. 수치(창·배율·발수 등)는
     job.js signature()(직업 갈래 + 스승 보정)가 다 정해 준다 — 여기 값은
     side.js 쪽 판정에만 필요한 입력·상태 상수뿐이다. */
  var SIG_SHADOW_MUL = 1.6;      // 그림자 걷기(협객) 동안 이동 배율 — 대시와 다른 "미는" 느낌
  var SIG_SHADOW_HIT_GRACE = 1.2; // 그림자 걷기 뒤 "첫 타" 보너스가 살아 있는 여유 시간
  var SIG_CHAIN_R = 150;         // 전(電) 속성 사슬이 옆 몸을 찾는 반경
  /* 공격 몸짓(2026-09-10) — `asset3d.js`의 몸짓 표에는 이미 attack 자리가
     있었는데(saga-dungeon이 실제로 쓰고 있다) 이 판은 한 번도 부른 적이
     없었다. 판정은 그대로(때리는 순간 이미 strike()가 끝낸다) — 이건 그
     짧은 동안만 화면 층이 걷기/가만있기 대신 attack 몸짓을 고르게 하는
     타이머다 */
  var ATK_ANIM_DUR = 0.28;
  /* 회피·마심 몸짓(2026-09-10, 공격 몸짓과 같은 이유) — asset3d.js 몸짓 표의
     dodge·interaction 자리도 여태 안 부르고 있었다. 회피는 DODGE_INVULN과
     같은 길이로 두고(그 동안이 실제로 구르는 시간이다), 마심은 따로 짧게 */
  var DRINK_ANIM_DUR = 0.4;

  var RARE_CHANCE = 0.07, RARE_HP_MUL = 3.2, RARE_DMG_MUL = 1.35, RARE_GAIN_MUL = 4;
  /* 미니보스(PLAN 11절, 2026-09-10) — 희귀(3.2배)와 보스(12~17배) 사이. 새 종을
     만들지 않고 spawnEnemy() 의 boost 인자로 기존 적 하나를 크게 불린다.
     쿨타임 없이 매 입장 낮은 확률로 한 번, 정해진 자리 하나에서만 나온다 */
  var MINI_CHANCE = 0.09, MINI_R = 70, MINI_HP_MUL = 7, MINI_DMG_MUL = 1.7, MINI_GAIN_MUL = 8;
  /* 이동 상인(PLAN 11절, 2026-09-10) — 상점을 위치에 매는 구조로 바꾸지 않는다
     (이 판은 🏪 도구줄로 언제든 연다, 그 구조가 낫다고 이미 README에 적혀
     있다). 대신 마주치면 값에만 잠깐 얹는 버프를 준다(`gear.js`의 `priceMul()`) */
  var MERCHANT_CHANCE = 0.12, MERCHANT_R = 70, MERCHANT_DUR = 90;
  /* NPC 구조 이벤트(PLAN 11절, 2026-09-10) — §11이 적어 둔 예시 일곱 중
     마지막으로 남아 있던 것. 마을 사람(NPC_TALK)을 사냥터에 들여오지 않고
     (표지판처럼 선 존재라 어울리지 않는다), 붙잡힌 사람 하나를 지키는
     잡졸을 다 잡으면 사례금을 준다 — 몬스터 습격의 "역"에 가깝다 */
  var RESCUE_CHANCE = 0.10, RESCUE_R = 90, RESCUE_COUNT = 2;
  var CHEST_CHANCE = 0.22;    // 사냥터에 걸어 들어갈 때 보물상자가 있을 확률
  var CHEST_R = 46;
  var FORAGE_CHANCE = 0.18, FORAGE_HALF = 130, FORAGE_MUL = 2;   // 채집 보너스 지역(PLAN 11절)
  /* 몬스터 습격(PLAN 11절, 2026-09-10) — 이동 상인·미니보스와 함께 남아 있던
     예시 셋 중 하나. 새 종을 만들지 않고 잡졸을 한꺼번에 여럿(AMBUSH_COUNT)
     불러내는 것만 다르다 — 희귀 몬스터·보물상자와 같은 "기존 것을 재사용" 결 */
  var AMBUSH_CHANCE = 0.15, AMBUSH_R = 70, AMBUSH_COUNT = 3, AMBUSH_SPREAD = 110;
  /* 마을 사람끼리의 잡담(2026-09-10, `data-side.js` NPC_CHAT 참고) — 마을에서
     이만큼 시간이 지날 때마다 굴려 보고, 맞으면 화제를 하나 골라 전한다.
     사냥터엔 없다(싸우는 자리라 한가한 잡담이 어울리지 않는다) */
  var CHAT_EVERY = 16, CHAT_CHANCE = 0.4;

  /** 사냥터의 채집 자리를 살아있는 상태로 되돌린다(문 넘을 때·재입장 시) */
  function buildGathers(stg) {
    var list = stg.gathers || [], out = [];
    for (var i = 0; i < list.length; i++) {
      out.push({ x: list[i][0], kind: list[i][1], alive: true, respawnAt: 0 });
    }
    return out;
  }

  /** 마을 사람(PLAN 16절) — `stg.npcs`([x, key])를 말 걸 수 있는 자리로 편다.
   *  이름·대사는 `data-side.js`의 `NPC_TALK` 를 그대로 따른다 — 여기서는 자리만 잡는다 */
  function buildNpcs(stg) {
    var list = stg.npcs || [], out = [];
    for (var i = 0; i < list.length; i++) {
      var key = list[i][1], t = SD.NPC_TALK[key];
      if (!t) { continue; }
      out.push({ x: list[i][0], key: key, name: t.name });
    }
    return out;
  }

  /** 랜덤 이벤트(PLAN 11절) — 사냥터에 걸어 들어갈 때마다 낮은 확률로 상자가
   *  하나 생긴다. 마을엔 안 둔다(싸울 일이 없는 곳이라 어울리지 않는다) */
  function buildChest(stg) {
    if (stg.town || stg.rift || Math.random() >= CHEST_CHANCE) { return null; }
    return { x: 200 + Math.random() * (stg.width - 400), opened: false };
  }

  /** 랜덤 이벤트(PLAN 11절) "채집 보너스 지역" — 사냥터에 걸어 들어갈 때마다
   *  낮은 확률로 폭 `FORAGE_HALF*2`px 구간이 하나 생긴다. 새 오브젝트를 만들지
   *  않는다 — 이미 있는 `run.gathers`(§10)가 그 구간 안에서만 평소보다
   *  `FORAGE_MUL`배 더 나오게, 판정 하나만 덧붙인다(update() 참고).
   *  마을엔 안 둔다(채집 자리 자체가 없다) */
  function buildForageZone(stg) {
    if (stg.town || stg.rift || Math.random() >= FORAGE_CHANCE) { return null; }
    var cx = FORAGE_HALF + 40 + Math.random() * (stg.width - (FORAGE_HALF + 40) * 2);
    return { x1: cx - FORAGE_HALF, x2: cx + FORAGE_HALF, notified: false };
  }

  /** 랜덤 이벤트(PLAN 11절) "몬스터 습격" — 사냥터에 걸어 들어갈 때마다 낮은
   *  확률로 매복 지점이 하나 생긴다. 그 자리를 지나면 그 자리 근처에 잡졸
   *  `AMBUSH_COUNT`마리가 한꺼번에 나타난다(update() 참고) — 자리만 여기서 뽑는다.
   *  마을엔 안 둔다(싸울 일이 없는 곳) */
  function buildAmbush(stg) {
    if (stg.town || stg.rift || Math.random() >= AMBUSH_CHANCE) { return null; }
    return { x: 260 + Math.random() * (stg.width - 520), triggered: false };
  }

  /** 랜덤 이벤트(PLAN 11절) "미니보스" — 사냥터에 걸어 들어갈 때마다 낮은 확률로
   *  자리가 하나 생긴다. 지나면 잡졸 하나가 그 자리에서 크게 불려 나온다
   *  (update() 참고) — 진짜 보스(spawnBoss)와 달리 쿨타임·전용 UI가 없다 */
  function buildMiniboss(stg) {
    if (stg.town || stg.rift || Math.random() >= MINI_CHANCE) { return null; }
    return { x: 260 + Math.random() * (stg.width - 520), triggered: false };
  }

  /** 랜덤 이벤트(PLAN 11절) "이동 상인" — 사냥터에 걸어 들어갈 때마다 낮은
   *  확률로 마주치는 자리가 하나 생긴다. 지나면 `MERCHANT_DUR`초 동안 상점
   *  (🏪, 어디서든 연다)이 싸진다 — 자리를 옮기는 게 아니라 값에만 붙는다 */
  function buildMerchant(stg) {
    if (stg.town || stg.rift || Math.random() >= MERCHANT_CHANCE) { return null; }
    return { x: 260 + Math.random() * (stg.width - 520), triggered: false };
  }

  /** 랜덤 이벤트(PLAN 11절) "NPC 구조" — 걸어 들어갈 때 낮은 확률로 붙잡힌
   *  사람 자리가 하나 생긴다. 가까이 가면 지키던 잡졸이 나타나고(update()),
   *  그 잡졸을 다 잡으면 사례금을 받는다 */
  function buildRescue(stg) {
    if (stg.town || stg.rift || Math.random() >= RESCUE_CHANCE) { return null; }
    return { x: 260 + Math.random() * (stg.width - 520), spawned: false, done: false };
  }

  /** 사냥터에 들어간다. stgOverride 는 비경(§5-3)이 만든 임시 방을 직접 넘길 때만 쓴다 */
  function enter(key, stgOverride) {
    var stg = stgOverride || SD.stage(key);
    if (!stgOverride && !unlocked(stg.key)) {
      core.emit('toast', '⚠️ Lv.' + stg.need + ' 부터 들어갈 수 있습니다');
      return false;
    }
    /* 비경 도중에 다른 사냥터로 걸어 들어가면 비경은 접는다(조각은 이미 받은 만큼 남는다) */
    if (!stgOverride && run && run.rift && global.DG.rift) { global.DG.rift.onEnd('leave'); }
    if (!core.save.party.length) {
      core.emit('toast', '⚠️ 도감에서 인물을 하나 골라 앞에 세우세요');
      return false;
    }
    var pw = power();
    run = {
      stage: stg, hpMax: pw.hp, hp: pw.hp, mp: pw.mp, mpMax: pw.mp,
      player: { x: 80, y: stg.floor - P_H, vx: 0, vy: 0, facing: 1,
                onGround: true, phase: 0, atkCd: 0, hurt: 0, invuln: 0,
                cds: [0, 0, 0, 0, 0, 0], buff: null,
                climb: null, dropThru: 0, resting: 0, dodgeCd: 0,
                dodgeAnim: 0, drinkAnim: 0,
                coyoteT: 0, jumpBufferT: 0, rollT: 0, wallKickT: 0, wallKickDir: 0,
                /* 고유 조작(§5-1) — holding/holdT 는 "회피를 누르고 있다"는 입력
                   상태, 나머지는 갈래별로 하나씩만 쓴다(무사=parry, 궁수=archer,
                   협객=shadow, 방사=elem — 서로 겹쳐 켜질 일이 없다) */
                holding: false, holdT: 0, holdArmed: false, sigCd: 0, sigNone: false,
                parryT: 0, parryNextMul: 1, parryBonus: 1,
                shadowT: 0, shadowHitT: 0, shadowHitMul: 1,
                archerCharging: false, archerMoveMul: 1, archerBuff: null,
                elemLeft: 0, elemIdx: 0 },
      enemies: [], dying: [], drops: [], shots: [], eshots: [], gathers: buildGathers(stg),
      chest: buildChest(stg), forage: buildForageZone(stg), ambush: buildAmbush(stg),
      miniboss: buildMiniboss(stg), merchant: buildMerchant(stg), rescue: buildRescue(stg),
      npcs: buildNpcs(stg), talk: null,
      chatCd: CHAT_EVERY * (0.7 + Math.random() * 0.6),
      kills: 0, gold: 0, hitstopT: 0, hitSeq: 0,
      expGained: 0, gearFound: 0, feat0: achieveDoneCount()   // 세션 카드(§5-6) 몫 — 들어올 때 스냅
    };
    if (global.DG.party) { global.DG.party.attach(); }   // 동료 교대(§5-8) — 편성 앞 세 명의 체력을 따로 든다
    if (!stgOverride) { st().stage = stg.key; }
    for (var i = 0; i < stg.spawn; i++) { spawnEnemy(); }
    var b = spawnBoss();
    core.log('🏃 ' + stg.name + ' 에 들어섰다' +
      (b ? ' — 안쪽에 ' + b.ref.name + ' 이(가) 있다' : ''), 'info');
    if (b) { core.emit('toast', '👺 ' + b.ref.name + ' 이(가) 사냥터 안쪽을 지키고 있습니다'); }
    fx.push({ t: 'fade', life: FADE_DUR });   // 화면 전환(PLAN 16절) — 검게 번쩍 잦아든다
    core.emit('side:enter', run);
    core.emit('changed');
    return true;
  }

  function leave() {
    if (!run) { return null; }
    var Q = global.DG.quest;
    var riftSum = global.DG.rift ? global.DG.rift.onEnd('leave') : null;   // 비경(§5-3) — 진행을 지우고 요약만 받는다
    /* 세션 마무리 카드(§5-6) — got 를 ui.js 가 그대로 5초짜리 시트에 얹는다.
       run 을 지우기 전에 다 챙긴다(exp·gear·feat 는 run 에 쌓아 둔 값,
       feat 는 들어올 때 스냅과 지금의 차, next 는 quest.js 가 우선순위대로 고른다) */
    var got = {
      gold: Math.round(run.gold), kills: run.kills, stage: run.stage.name,
      exp: run.expGained, gear: run.gearFound,
      feat: achieveDoneCount() - run.feat0,
      next: Q ? Q.nextTodo() : null,
      rift: riftSum
    };
    core.save.player.gold += got.gold;
    core.log('🚪 ' + got.stage + ' 에서 나왔다 · 🪙 ' + core.fmt(got.gold) +
      ' · ' + got.kills + '마리', 'info');
    run = null;
    core.emit('side:end', got);
    core.emit('changed');
    core.persist();
    return got;
  }

  /** 쉬는 화면(선택 메뉴) 없이 곧장 사냥터로 — 오픈월드처럼, 마지막 있던 자리부터
   *  다시 걷는다. 게임 루프(game.js)가 **쉬는 순간마다**(나온다 · 쓰러짐 뒤) 매 프레임
   *  이걸 불러 준다 — 그래서 side.js 자체의 leave()/die() 는 손대지 않는다:
   *  자가진단이 'S.leave() 뒤 !S.active()' 를 그대로 기대하기 때문이다(게임 루프를
   *  안 돌리는 자가진단에서는 이 함수가 안 불려 그 가정이 깨지지 않는다). */
  function resume() {
    if (run || !core.save.party.length) { return false; }
    if (global.DG.rift && global.DG.rift.pending()) { return global.DG.rift.restore(); }
    return enter(st().stage || 'sinya');
  }

  function active() { return !!run; }

  /* ── 줄과 문 ──────────────────────────────────────────────
   * 원작의 세로 이동 둘이다. **밧줄·사다리는 ↑↓ 로 오르내리고**,
   * **문(포탈)은 ↑ 로 들어간다.** 발판 사이를 점프로만 오가던 것이
   * 이 판의 가장 큰 어색함이었다.
   *
   * 규칙은 여기(side.js)에만 있다 — 화면은 좌표를 읽어 그리기만 한다.
   */

  /** 이 자리에서 붙을 수 있는 줄 (없으면 null) */
  function ropeAt(cx, footY) {
    if (!run) { return null; }
    var list = run.stage.ropes || [], i;
    for (i = 0; i < list.length; i++) {
      var r = list[i];
      if (Math.abs(cx - r[0]) > GRAB) { continue; }
      /* 위쪽 끝보다 조금 높은 데까지 쳐 준다 — 발판 위에 서서 ↓ 로 타고 내려갈 수 있게 */
      if (footY < r[1] - 6 || footY > r[2] + 4) { continue; }
      return { x: r[0], top: r[1], bottom: r[2], kind: r[3] || 'rope' };
    }
    return null;
  }

  /** 이 자리에서 들어갈 수 있는 문 (없으면 null) */
  function portalAt(cx) {
    if (!run) { return null; }
    var list = run.stage.portals || [], i;
    for (i = 0; i < list.length; i++) {
      if (Math.abs(cx - list[i][0]) <= PORTAL_R) {
        return { x: list[i][0], to: list[i][1], ref: SD.stage(list[i][1]) };
      }
    }
    return null;
  }

  /** 이 자리에서 말을 걸 수 있는 마을 사람 (없으면 null) */
  function npcAt(cx) {
    if (!run) { return null; }
    var list = run.npcs || [], i, best = null, bd = TALK_R + 1;
    for (i = 0; i < list.length; i++) {
      var d = Math.abs(cx - list[i].x);
      if (d <= TALK_R && d < bd) { best = list[i]; bd = d; }
    }
    return best;
  }

  /** 말을 건다 — 아무 대사나 하나 뽑는다(순서를 지키는 사명 대화가 아니다) */
  function talk(npc) {
    var t = SD.NPC_TALK[npc.key];
    if (!t || !t.lines.length) { return false; }
    var text = t.lines[Math.floor(Math.random() * t.lines.length)];
    if (t.story && t.story.length) {                                  // 시대 손님 — 말 걸 때마다 사연 한 토막씩 끝까지(정본 side_guests)
      var gs = st();
      if (!gs.guestStory) { gs.guestStory = {}; }
      var gn = gs.guestStory[npc.key] || 0;
      if (gn < t.story.length) {
        text = t.story[gn] + ' (사연 ' + (gn + 1) + '/' + t.story.length + ')';
        gs.guestStory[npc.key] = gn + 1;
        if (gn + 1 === t.story.length) {
          core.save.player.gold = (core.save.player.gold || 0) + SD.GUEST_STORY_GOLD;
          text += ' — 🪙 +' + core.fmt(SD.GUEST_STORY_GOLD);
          core.emit('toast', t.emoji + ' ' + t.name + ' 의 사연을 끝까지 들었다 — 🪙 ' + core.fmt(SD.GUEST_STORY_GOLD));
          core.persist();
        }
      }
    }
    run.talk = { x: npc.x, key: npc.key, name: t.name, emoji: t.emoji || '💬', text: text, shop: !!t.shop };
    sfx('talk');
    core.emit('side:talk', { stage: run.stage.key, npc: npc.key });
    core.emit('changed');
    return true;
  }

  /** 대화창을 닫는다 */
  function closeTalk() {
    if (!run || !run.talk) { return false; }
    run.talk = null;
    core.emit('changed');
    return true;
  }

  /** 줄에 붙는다 */
  function grab(rope) {
    var p = run.player;
    sfx('grab');
    p.climb = rope;
    p.x = rope.x - P_W / 2;
    p.vx = 0; p.vy = 0;
    p.onGround = false;
    p.dropThru = 0;
    return true;
  }

  /** 줄에서 손을 뗀다 (kick 은 튀는 방향 — 좌우 속도는 다음 프레임에 입력이 다시 정한다) */
  function letGo(kick) {
    var p = run.player;
    if (!p.climb) { return false; }
    p.climb = null;
    if (kick) { p.vy = -JUMP * 0.72; p.vx = kick; p.facing = kick > 0 ? 1 : -1; }
    return true;
  }

  /** 줄에만 붙는다 — 자동이 쓴다. **문은 건드리지 않는다**(자동이 사냥터를 넘어가 버린다) */
  function grabRope() {
    if (!run) { return false; }
    var p = run.player;
    if (p.climb) { return true; }
    var r = ropeAt(p.x + P_W / 2, p.y + P_H);
    return r ? grab(r) : false;
  }

  /** ↑ 를 눌렀을 때 — 대화창이 열려 있으면 닫고, 아니면 줄 → 문 → 마을 사람 순.
   *  **문이 마을 사람보다 앞선다** — 사냥터를 넘나드는 길은 데이터를 어떻게
   *  두든 절대 막히면 안 되니, 둘이 겹치는 자리가 생겨도 문이 이긴다. */
  function useUp() {
    if (!run) { return false; }
    if (run.talk) { return closeTalk(); }
    var p = run.player;
    if (p.climb) { return true; }
    var r = ropeAt(p.x + P_W / 2, p.y + P_H);
    if (r) { return grab(r); }
    var g = portalAt(p.x + P_W / 2);
    if (g && p.onGround) { return travel(g.to); }
    var n = npcAt(p.x + P_W / 2);
    if (n && p.onGround) { return talk(n); }
    return false;
  }

  /** ↓ 를 눌렀을 때 — 발판 위에서 그 아래로 뻗은 줄이 있으면 타고 내려간다 */
  function useDown() {
    if (!run) { return false; }
    var p = run.player;
    if (p.climb) { return true; }
    if (!p.onGround) { return false; }
    var r = ropeAt(p.x + P_W / 2, p.y + P_H + 8);
    if (!r || p.y + P_H + 8 > r.bottom) { return false; }
    grab(r);
    p.y += 6;
    return true;
  }

  /** ↓ + 점프 — 밟고 선 발판을 빠져나간다 (바닥에서는 안 된다) */
  function dropThrough() {
    if (!run) { return false; }
    var p = run.player;
    if (!p.onGround || p.climb) { return false; }
    if (p.y + P_H >= run.stage.floor - 1) { return false; }
    p.dropThru = DROP_THRU;
    p.onGround = false;
    p.y += 3;
    p.vy = 30;
    return true;
  }

  /** 문으로 다음 사냥터에 걸어 넘어간다 — 몸(체력·기력)과 벌이(금·마릿수)는 그대로 이어진다 */
  function travel(key) {
    if (!run) { return false; }
    var from = run.stage, stg = SD.stage(key);
    if (stg.key === from.key) { return false; }
    if (!unlocked(stg.key)) {
      core.emit('toast', '⚠️ ' + stg.name + ' 은(는) Lv.' + stg.need + ' 부터입니다');
      return false;
    }
    /* 오른쪽 문으로 나갔으면 다음 맵의 왼쪽에서 나온다 (그 반대도) */
    var goingRight = run.player.x > from.width / 2;
    run.stage = stg;
    run.enemies = []; run.drops = []; run.shots = []; run.eshots = []; run.boss = null;
    run.gathers = buildGathers(stg);
    run.chest = buildChest(stg);
    run.forage = buildForageZone(stg);
    run.ambush = buildAmbush(stg);
    run.miniboss = buildMiniboss(stg);
    run.merchant = buildMerchant(stg);
    run.rescue = buildRescue(stg);
    run.npcs = buildNpcs(stg); run.talk = null;
    if (run.pty && stg.town && global.DG.party) { global.DG.party.restore(); }   // 마을 — 쓰러진 동료가 일어선다(§5-8)
    run.player.x = goingRight ? 130 : stg.width - 160;
    run.player.y = stg.floor - P_H;
    run.player.vx = 0; run.player.vy = 0; run.player.climb = null;
    run.player.onGround = true;
    run.player.facing = goingRight ? 1 : -1;
    st().stage = stg.key;
    for (var i = 0; i < stg.spawn; i++) { spawnEnemy(); }
    var b = spawnBoss();
    core.log('🚪 ' + from.name + ' → ' + stg.name + (b ? ' — ' + b.ref.name + ' 이(가) 지킨다' : ''), 'info');
    core.emit('toast', '🚪 ' + stg.name);
    fx.push({ t: 'fade', life: FADE_DUR });   // 화면 전환(PLAN 16절) — 검게 번쩍 잦아든다
    core.emit('side:travel', run);
    core.emit('changed');
    return true;
  }

  /** 비경(§5-3) — 문 없이 지금 무대를 다른 방으로 갈아 낀다(체력·기력·주운 금은 그대로).
   *  travel() 의 몸통에서 문·레벨 문턱·세이브 stage 기록만 뺐다 */
  function swapStage(stg) {
    if (!run) { return false; }
    run.stage = stg;
    run.enemies = []; run.dying = []; run.drops = []; run.shots = []; run.eshots = []; run.boss = null;
    run.gathers = buildGathers(stg);
    run.chest = buildChest(stg); run.forage = buildForageZone(stg); run.ambush = buildAmbush(stg);
    run.miniboss = buildMiniboss(stg); run.merchant = buildMerchant(stg); run.rescue = buildRescue(stg);
    run.npcs = buildNpcs(stg); run.talk = null;
    run.riftTick = false;
    run.player.x = 130; run.player.y = stg.floor - P_H;
    run.player.vx = 0; run.player.vy = 0; run.player.climb = null;
    run.player.onGround = true; run.player.facing = 1;
    fx.push({ t: 'fade', life: FADE_DUR });
    core.emit('side:travel', run);
    core.emit('changed');
    return true;
  }

  /** 지금 서 있는 곳이 어디든 그 방으로 — 사냥 중이 아니면 새로 들어간다 */
  function placeIn(stg) {
    return run ? swapStage(stg) : enter(null, stg);
  }

  /* ── 보스 ─────────────────────────────────────────────────
   * 사냥터마다 하나. **오른쪽 끝을 지킨다** — 원작에서 보스 맵 안쪽으로
   * 걸어 들어가는 그 감각이다. 잡으면 한동안 다시 나오지 않는다(리젠).
   */

  /** 이 사냥터의 보스가 지금 나와 있나 */
  function bossReady(key) {
    var stg = SD.stage(key);
    if (!stg.boss) { return false; }
    var at = st().bossAt[key] || 0;
    return Date.now() - at >= stg.boss.cool * 60000 * BOSS_COOL;
  }

  /** 다시 나오기까지 남은 밀리초 (0 이면 지금 나와 있다) */
  function bossLeft(key) {
    var stg = SD.stage(key);
    if (!stg.boss) { return 0; }
    var at = st().bossAt[key] || 0;
    return Math.max(0, stg.boss.cool * 60000 * BOSS_COOL - (Date.now() - at));
  }

  function spawnBoss() {
    if (!run) { return null; }
    var stg = run.stage;
    if (!stg.boss || !bossReady(stg.key)) { return null; }
    var ed = global.DG.enemyData;
    var ref = ed ? ed.bossByName(stg.boss.name) : { name: stg.boss.name, kind: 'human', color: '#7a3a3a' };
    var lv = stg.enemyLv;
    var baseHp = Math.round(baseHpOf(lv));
    var hp = Math.max(1, Math.round(baseHp * stg.boss.hpMul * E_HP * RF()));
    var e = {
      ref: ref, boss: true,
      x: stg.width - 220, y: stg.floor - 52, w: 52, h: 52,
      hp: hp, hpMax: hp,
      dmg: Math.round((4 + lv * 1.6) * stg.boss.dmgMul * E_DMG * RF()),
      dir: -1,
      spd: 38 + Math.min(40, lv * 2),
      phase: 0, hurt: 0, cd: 0, atkAnim: 0,
      chargeCd: 4 + Math.random() * 3, charge: 0
    };
    run.enemies.push(e);
    run.boss = e;
    fx.push({ t: 'bossintro', name: ref.name, life: BOSS_INTRO_DUR });   // 등장 연출(PLAN 35절)
    sfx('boss');
    return e;
  }

  /* ── 관문 대장(§5-4) ──────────────────────────────────────
   * 사냥터 보스(위)와 다른 리젠 규칙이다 — 시간이 아니라 **주** 단위로 잠기고,
   * 지면 그 주 안에 하루 한 번만 다시 붙을 수 있다. 마을(`town:true`)에서
   * 플레이어가 직접 도전을 눌러야 나온다(사냥터 보스처럼 저절로 나오지 않는다
   * — 마을은 안전지대라는 약속을 깨지 않는다). */
  var GATE_TIME = 180;          // 제한 시간(초) — 넘으면 광폭
  var GATE_ENRAGE_MUL = 1.5;
  var GATE_SHIELD_FRAC = 0.30;  // 방패 파괴 임계 — 최대 체력의 30%(등 뒤 피해 누적)
  var GATE_VULN_MUL = 1.5;
  var GATE_VULN_DUR = 10;
  var GATE_SLAM_R = 90;

  /** 주간 키 — 그 해 몇째 주인지(월요일 기준은 아니고 1/1부터 7일씩, 리셋 감만 맞으면 된다) */
  function gateWeekKey(t) {
    var d = new Date(t || Date.now());
    var jan1 = new Date(d.getFullYear(), 0, 1);
    var week = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
    return d.getFullYear() + '-w' + week;
  }
  /** 하루 키 — quest.js todayKey() 와 같은 규칙(로컬 달력의 '그 날') */
  function gateDayKey(t) {
    var d = new Date(t || Date.now());
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  /** 이 마을의 관문 대장에 도전할 수 있나 — 이번 주에 안 이겼고, 오늘 안 붙어 봤어야 한다 */
  function gateReady(key) {
    var stg = SD.stage(key);
    if (!stg.gateBoss) { return false; }
    var s = st();
    if (s.gateWeek[key] === gateWeekKey()) { return false; }
    if (s.gateDay[key] === gateDayKey()) { return false; }
    return true;
  }

  /** 마을 화면(§5-4 대장 문)이 읽는 요약 — 이름·이번 주 상태 */
  function gateInfo(key) {
    var stg = SD.stage(key);
    if (!stg.gateBoss) { return null; }
    var s = st();
    return {
      name: stg.gateBoss.name,
      ready: gateReady(key),
      wonThisWeek: s.gateWeek[key] === gateWeekKey(),
      triedToday: s.gateDay[key] === gateDayKey()
    };
  }

  /** 마을에서 관문 대장에게 도전한다 — HUD 의 "대장 문" 단추가 부른다 */
  function challengeGate(key) {
    if (!gateReady(key)) { return false; }
    /* 시트 목록(어디서든 접근)에서 눌러도 되게 — 그 마을에 없으면 먼저 들어간다.
       기존 field 보스가 enter() 끝에서 저절로 기다리는 것과 달리, 마을은
       spawn:0(안전지대)라 여기서 명시적으로 불러야만 나온다 */
    if (!run || run.stage.key !== key) { enter(key); }
    if (!run || run.stage.key !== key || run.boss) { return false; }
    var stg = run.stage;
    var ed = global.DG.enemyData;
    var ref = ed ? ed.bossByName(stg.gateBoss.name) : { name: stg.gateBoss.name, kind: 'human', color: '#7a3a3a' };
    var lv = stg.enemyLv;
    var baseHp = Math.round(baseHpOf(lv));
    var hp = Math.max(1, Math.round(baseHp * stg.gateBoss.hpMul * E_HP * RF()));
    var e = {
      ref: ref, boss: true, gate: true, gateKey: key,
      x: stg.width - 220, y: stg.floor - 52, w: 52, h: 52,
      hp: hp, hpMax: hp,
      dmg: Math.round((4 + lv * 1.6) * stg.gateBoss.dmgMul * E_DMG * RF()),
      dir: -1,
      spd: 38 + Math.min(40, lv * 2),
      phase: 0, hurt: 0, cd: 0, atkAnim: 0,
      chargeCd: 4 + Math.random() * 3, charge: 0,
      patternCd: 6 + Math.random() * 3, patternT: 0, patternKind: '',
      slamX: 0, slamY: 0,
      gateShieldHp: 0, gateShieldBroken: false, gateVulnT: 0,
      enraged: false
    };
    run.enemies.push(e);
    run.boss = e;
    run.gateT = GATE_TIME;
    st().gateDay[key] = gateDayKey();   // 오늘 도전을 썼다 — 이기든 지든 내일까지 못 연다
    fx.push({ t: 'bossintro', name: ref.name, life: BOSS_INTRO_DUR });
    sfx('boss');
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 관문 대장을 잡았을 때 확정 보상 — 고유 장비 1(부위 순환) + 주문서 60% 2 + 기억 조각 3 */
  function grantGateReward(e) {
    var GG = global.DG.gear, UD = global.DG.uniqueData, GD2 = global.DG.gearData;
    var s = st(), bits = [];
    if (GG && UD && UD.UNIQUES.length) {
      var uq = UD.UNIQUES[s.gateUniq % UD.UNIQUES.length];
      s.gateUniq += 1;
      var made = GG.make(uq.key);
      if (GG.put(made)) {
        bits.push('⭐ ' + GG.nameOf(made));
      } else {
        sfx('bagfull');   // 가방이 가득 차면 사냥터 드롭과 같은 답답함 — 못 받고 그대로 흘려보낸다
      }
    }
    if (GG && GD2) {
      var pool60 = GD2.SCROLLS.filter(function (sc) { return sc.rate === 0.6; });
      var picked = [];
      for (var i = 0; i < 2; i++) {
        var sc = core.pick(pool60.length ? pool60 : GD2.SCROLLS);
        GG.addScroll(sc.key, 1);
        picked.push(sc.name);
      }
      bits.push('📜 ' + picked.join(' · '));
    }
    core.save.player.memFrag = (core.save.player.memFrag || 0) + 3;
    bits.push('🧩 기억 조각 +3');
    core.log('🏯 ' + e.ref.name + '(관문 대장) 을(를) 꺾었다! — ' + bits.join(' · '), 'good');
    core.emit('toast', '🏯 관문 대장 토벌!');
    core.persist();
  }

  /* ── 적 ───────────────────────────────────────────────── */

  /** 적 정의 — 던전 게임과 같은 data-enemy.js 를 쓴다 (poolFor 는 관문 번호를 받는다) */
  function enemyRef(lv) {
    var ed = global.DG.enemyData;
    if (!ed) { return { name: '산적', kind: 'beast', color: '#8a5a44', form: 'quad' }; }
    var pool = ed.poolFor(lv, false);
    /* 세 시대 적(PLAN §5-12) — 사냥터 잡졸의 40% 는 현대·미래 적(비경·보스는 그대로) */
    var ep = SD.eraPoolFor ? SD.eraPoolFor(ed.tierOf(lv)) : [];
    if (ep.length && !(run && run.stage && run.stage.rift) && Math.random() < core.tuned('side.eraShare', 0.4)) { return core.pick(ep); }
    return core.pick(pool);
  }

  /**
   * 몬스터 타입(PLAN 13절) — `data-enemy.js`는 던전 게임과 나눠 든 같은
   * 파일이라 새 칸을 안 만든다(`SD.rangedOf()`와 같은 이유). 대신 이미 있는
   * 이름·무기로 가른다: **원거리형**은 활·조총(`rangedOf`, 기존) ·
   * **돌진형**은 이름에 "기병"(말을 탔다) · **탱커형**은 코끼리·미늘창(둔중한
   * 무기) · 나머지는 **근접형**(기본).
   */
  function enemyRole(ref) {
    if (SD.rangedOf(ref)) { return 'ranged'; }
    if (/기병/.test(ref.name)) { return 'dash'; }
    if (/코끼리/.test(ref.name) || (ref.look && ref.look.weapon === 'halberd')) { return 'tank'; }
    return 'melee';
  }

  var TANK_HP_MUL = 2.2, TANK_SPD_MUL = 0.6, TANK_DMG_MUL = 0.85;
  /* 마법형(PLAN 13절, 2026-09-10) — 근접형·원거리형·돌진형·탱커형에 이어
     마지막 유형. 새 종·새 데이터(공용 data-enemy.js는 안 건드린다) 없이
     근접형 잡졸 하나를 이 역으로 굴려 바꾼다(희귀·미니보스와 같은 "굴려서
     얹는" 결). **높이를 안 가리고**(flat 조건 없음) 서서히 따라오는
     구슬(homing)을 쏜다 — 활·조총이 "같은 높이라야 맞는" 것과 반대로
     다른 대처(움직여서 떼어내기)가 필요해 원거리형과는 다른 위협이 된다.
     대신 몸이 약하다(MAGIC_HP_MUL) */
  var MAGIC_CHANCE = 0.12, MAGIC_HP_MUL = 0.85, MAGIC_RANGE = 340;
  var MAGIC_CD = 2.2, MAGIC_SPD = 260, MAGIC_DMG_MUL = 1.15, MAGIC_HOME = 140;

  /** @param boost 미니보스(§11) 전용 — {hp, dmg} 배수를 얹는다. 있으면 희귀형
   *  굴림은 건너뛴다(두 배수가 겹쳐 값을 못 읽게 되는 것을 막는다) */
  function spawnEnemy(atX, boost) {
    if (!run) { return; }
    var stg = run.stage;
    var lv = stg.enemyLv;
    var ref = enemyRef(lv);
    var x = atX !== undefined ? atX : 200 + Math.random() * (stg.width - 300);
    /* 발판 위에 세우거나 바닥에 세운다 — atX 로 자리를 못박아 부른 경우(습격 등)에는
       건드리지 않는다. 안 그러면 45% 확률로 엉뚱한 발판에 떨어져 "그 자리 근처에
       나타난다" 는 약속이 깨진다 */
    var y = stg.floor;
    if (atX === undefined && Math.random() < 0.45 && stg.plats.length) {
      var pl = core.pick(stg.plats);
      x = pl[0] + Math.random() * pl[2];
      y = pl[1];
    }
    var hp = Math.max(1, Math.round(baseHpOf(lv) * E_HP * RF()));
    var rw = SD.rangedOf(ref);              // 활·조총을 들었으면 멀리서 쏜다
    var role = enemyRole(ref);
    /* 마법형 굴림 — 근접형만 대상(원거리·돌진·탱커는 이미 제 역이 있다).
       boost(미니보스)가 있으면 건너뛴다(수치 배율이 겹치는 걸 피한다) */
    if (role === 'melee' && !boost && Math.random() < MAGIC_CHANCE) { role = 'magic'; }
    var spd = 42 + Math.min(50, lv * 2);
    var dmgMul = 1;
    if (role === 'tank') { hp = Math.round(hp * TANK_HP_MUL); spd *= TANK_SPD_MUL; dmgMul = TANK_DMG_MUL; }
    if (role === 'magic') { hp = Math.round(hp * MAGIC_HP_MUL); }
    /* 희귀형(PLAN 11·13절, 2026-09-09) — 낮은 확률로 세다·많이 준다. 새 종을
       만들지 않고 기존 적 하나를 통째로 불려서 만든다(데이터 늘리지 않기).
       boost(미니보스)가 있으면 이 굴림은 건너뛴다 */
    var rare = !boost && Math.random() < RARE_CHANCE;
    if (rare) { hp = Math.round(hp * RARE_HP_MUL); dmgMul *= RARE_DMG_MUL; }
    if (boost) { hp = Math.round(hp * boost.hp); dmgMul *= boost.dmg; }
    var e = {
      ref: ref, x: x, y: y - 22, w: 34, h: 34,
      hp: hp, hpMax: hp, dmg: Math.round((4 + lv * 1.6) * dmgMul * E_DMG * RF()),
      dir: Math.random() < 0.5 ? -1 : 1,
      spd: spd, phase: Math.random() * 6.28, hurt: 0, cd: 0,
      ranged: rw, shotCd: rw ? rw.cd * (0.4 + Math.random() * 0.8) : 0,
      rare: rare, mini: !!boost, role: role, atkAnim: 0
    };
    /* 돌진형(PLAN 13절) — 보스의 "뜸을 들이다 달려든다" 패턴을 그대로 빌린다
       (update() 의 charge 분기가 `e.boss || e.role === 'dash'` 를 본다) */
    if (role === 'dash') { e.chargeCd = 3 + Math.random() * 2; e.charge = 0; }
    run.enemies.push(e);
    if (rare) { core.emit('toast', '✨ 희귀 ' + ref.name + ' 등장!'); }
    return e;
  }

  /* ── 입력 ─────────────────────────────────────────────── */

  function setInput(k, v) {
    if (k in input) { input[k] = !!v; }
    if (k === 'jump' && v) { jump(); }
    if (k === 'up' && v) { useUp(); }
    if (k === 'down' && v) { useDown(); }
  }

  /** 벽 차기(§5-5) 판정 — 공중에서 발판 옆면에 붙어 있으면 반대쪽으로 튈 방향을
   *  돌려준다(0 이면 벽이 아니다). 전용 `walls` 배열이 없어 발판(`stg.plats`)
   *  자체의 옆면(표면부터 바닥까지)을 벽으로 삼는다(PLAN §5-5 대안 그대로). */
  function wallSide(p) {
    var stg = run.stage;
    for (var i = 0; i < stg.plats.length; i++) {
      var pl = stg.plats[i], top = pl[1], left = pl[0], right = pl[0] + pl[2];
      if (p.y >= stg.floor || p.y + P_H <= top) { continue; }
      if (Math.abs((p.x + P_W) - left) < WALL_TOL) { return -1; }  // 발판 왼쪽 옆면 → 왼쪽으로 튄다
      if (Math.abs(p.x - right) < WALL_TOL) { return 1; }          // 발판 오른쪽 옆면 → 오른쪽으로 튄다
    }
    return 0;
  }

  /** 점프 — 줄에 매달렸으면 손을 떼고 튀고, ↓ 를 누른 채면 발판을 빠져나간다.
   *  땅이 아니어도 코요테 창(§5-5) 안이면 그대로 받고, 벽 옆이면 차고 튄다,
   *  둘 다 아니면 점프 버퍼(§5-5)에 담아 착지하는 순간 이어 쓴다. */
  function jump() {
    if (!run) { return false; }
    var p = run.player;
    if (p.climb) {
      /* 줄에서 손 떼며 점프 — 수평 가속 +30%(§5-5, 예전엔 그냥 0.8배였다) */
      letGo(input.left ? -SPEED * 0.8 * 1.3 : (input.right ? SPEED * 0.8 * 1.3 : 0));
      return true;
    }
    if (p.onGround || p.coyoteT > 0) {
      p.coyoteT = 0;
      if (input.down && dropThrough()) { return true; }
      p.vy = -JUMP * (global.DG.mount ? global.DG.mount.jumpMul() : 1);
      p.onGround = false;
      sfx('jump');
      return true;
    }
    var MTj = global.DG.mount;
    if (MTj && MTj.flying && MTj.flying()) { return MTj.flap(p, JUMP); }      // 날개 탈것 — 공중에서 점프 = 날갯짓
    var w = wallSide(p);
    if (w) {
      /* 좌우 이동은 매 프레임 입력으로 다시 정해지므로(아래 update()), 킥 방향은
         wallKickT 동안만 그 값을 강제로 덮어써 살려 둔다(착지 롤과 같은 요령) */
      p.wallKickT = WALL_KICK_DUR; p.wallKickDir = w;
      p.vy = -WALL_KICK_VY; p.facing = w;
      p.x += w * 2;   // 옆면에서 살짝 떼어 놓는다 — 안 그러면 같은 프레임에 다시 걸린다
      fx.push({ t: 'dust', x: p.x + (w > 0 ? 0 : P_W), y: p.y + P_H * 0.6, life: 0.28 });
      sfx('jump');
      return true;
    }
    p.jumpBufferT = JUMP_BUFFER;
    return false;
  }

  /** 회피(PLAN 12절) — 보고 있는 쪽(←→ 를 누르고 있으면 그쪽, 아니면 바라보는
   *  쪽)으로 짧게 미끄러지며 잠깐 무적이 된다. 줄에 매달렸을 때는 안 나간다
   *  (letGo() 몫과 겹친다 — 손을 뗀 채 미끄러지면 자리가 어긋난다). */
  function dodge() {
    if (!run) { return false; }
    var p = run.player;
    if (p.climb || p.dodgeCd > 0) { return false; }
    /* 유파(§5-2) — 띠에 dash 계열 유파 세트(2 이상)가 있으면 회피가 더 자주 돈다 */
    var J = global.DG.job;
    p.dodgeCd = DODGE_COOL * (J ? J.dodgeCdMul() : 1) * (run.rm ? 1 - run.rm.dodge : 1);
    var from = p.x, dir = input.left ? -1 : (input.right ? 1 : p.facing);
    p.x = core.clamp(p.x + DODGE_DIST * dir, 0, run.stage.width - P_W);
    p.dropThru = 0;
    p.invuln = Math.max(p.invuln, DODGE_INVULN);
    p.dodgeAnim = DODGE_INVULN;
    var lo = Math.min(from, p.x) - 10, hi = Math.max(from, p.x) + P_W + 10;
    fx.push({ t: 'dash', x: lo, y: p.y, w: hi - lo, h: P_H, life: 0.18 });
    sfx('dodge');
    return true;
  }

  /* ── 고유 조작(§5-1) ──────────────────────────────────────
   * 회피 버튼(키)을 **길게 누르면** 나온다 — 짧게 뗐으면 그냥 dodge().
   * 입력은 game.js(Shift keydown/keyup)·ui.js(회피 단추 pointerdown/up)
   * 둘 다 holdStart()/holdEnd() 만 부르면 되고, 판정은 여기 다 있다. */

  function holdStart() {
    if (!run) { return; }
    var p = run.player;
    if (p.climb || p.holding) { return; }
    p.holding = true; p.holdT = 0; p.holdArmed = false; p.sigNone = false;
  }

  /** 회피 임계(job.js `JD.SIGNATURE_HOLD`)를 넘는 순간 한 번만 불린다 —
   *  갈래별로 그 자리에서 바로 터지는 셋(무사·협객·방사)과, 놓는 순간에야
   *  힘이 정해지는 하나(궁수)로 나뉜다. */
  function armSignature() {
    var p = run.player, J = global.DG.job;
    p.holdArmed = true;
    var sig = J && J.signature ? J.signature() : null;
    if (!sig || p.sigCd > 0 || run.mp < sig.cost) {
      p.sigNone = true;
      if (sig) { core.emit('toast', '⚠️ 고유 조작을 쓸 수 없습니다'); }
      return;
    }
    run.mp -= sig.cost;
    p.sigCd = sig.cd;
    if (sig.job === 'warrior') {
      p.parryT = sig.window;
      p.parryNextMul = sig.nextMul;
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 44, life: sig.window });
      sfx('dodge');
    } else if (sig.job === 'rogue') {
      p.shadowT = sig.dur;
      p.invuln = Math.max(p.invuln, sig.dur);
      p.shadowHitMul = sig.firstHitMul;
      p.shadowHitT = SIG_SHADOW_HIT_GRACE;
      fx.push({ t: 'dash', x: p.x - 20, y: p.y, w: P_W + 40, h: P_H, life: sig.dur });
      sfx('dodge');
    } else if (sig.job === 'mage') {
      p.elemLeft = sig.shots;
      p.elemIdx = 0;
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 44, life: 0.3 });
      sfx('skill');
    } else if (sig.job === 'archer') {
      p.archerCharging = true;
      p.archerMoveMul = sig.moveMul;
      /* 힘은 놓는 순간(releaseSignature)에 눌린 시간으로 정해진다 */
    }
    core.emit('side:skill', 'sig:' + sig.key);
  }

  /** 궁수의 당기기 — 놓는 순간, 눌린 시간(0.4~1.2s)만큼 다음 화살·연사에 실을
   *  관통·위력을 정해 둔다. 다른 갈래는 armSignature() 에서 이미 다 끝났으므로
   *  여기서는 charging 표시만 끈다. */
  function releaseSignature() {
    var p = run.player, J = global.DG.job;
    p.archerCharging = false;
    if (p.sigNone) { return; }
    var sig = J && J.signature ? J.signature() : null;
    if (!sig || sig.job !== 'archer') { return; }
    var t = core.clamp(p.holdT, sig.minHold, sig.maxHold);
    var ratio = (t - sig.minHold) / (sig.maxHold - sig.minHold);
    p.archerBuff = { mul: sig.mulMin + (sig.mulMax - sig.mulMin) * ratio, pierce: sig.pierceAdd };
    fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 40, life: 0.3 });
    sfx('skill');
  }

  /** 회피 버튼(키)을 뗐다 — 임계를 못 넘겼으면 짧게 눌렀다 뗀 것이니
   *  그냥 회피, 넘겼으면 갈래에 맞게 고유 조작을 마무리한다. */
  function holdEnd() {
    if (!run) { return; }
    var p = run.player;
    if (!p.holding) { return; }
    p.holding = false;
    if (!p.holdArmed) { dodge(); return; }
    releaseSignature();
    p.holdT = 0;
  }

  /** 창(blur)에서 손 뗌 — 회피(짧게 뗀 것과 같은 판정)도, 고유 조작 마무리도
   *  안 부른다. 포커스를 잃는 순간까지 뗀 게 아니므로 그냥 손을 놓는다. */
  function cancelHold() {
    if (!run) { return; }
    var p = run.player;
    p.holding = false; p.holdT = 0; p.holdArmed = false;
    p.archerCharging = false;
  }

  /** 원소 전환(방사)이 실은 속성 — fire(지속)·ice(둔화)는 몸에 상태를 걸고,
   *  lightning(사슬)은 그 자리에서 옆 몸 하나를 더 때린다(재귀 없음 — 사슬의
   *  사슬은 안 만든다). 새 적 데이터 칸이 아니라 살아 있는 동안만의 런타임
   *  값이다(§2-2 — data-enemy.js 는 안 늘렸다). */
  function applyElem(e, elem, mul) {
    if (elem === 'fire') { e.burnT = Math.max(e.burnT || 0, 3); }
    else if (elem === 'ice') { e.slowT = Math.max(e.slowT || 0, 2); }
    else if (elem === 'lightning') {
      var best = null, bd = SIG_CHAIN_R;
      for (var i = 0; i < run.enemies.length; i++) {
        var o = run.enemies[i];
        if (o === e) { continue; }
        var dx = (o.x + o.w / 2) - (e.x + e.w / 2), dy = (o.y + o.h / 2) - (e.y + e.h / 2);
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) { strike(best, mul); }
    }
    fx.push({ t: 'impact', x: e.x + e.w / 2, y: e.y + e.h * 0.3, life: 0.3 });
  }

  var ELEM_CYCLE = ['fire', 'ice', 'lightning'];

  /** 원소 전환(§5-1) — 남은 발수만큼 화·빙·전을 돌려 가며 물린다(없으면 null,
   *  castSkill()의 bolt·volley·rain 세 자리에서만 부른다). */
  function takeElem(p) {
    if (!p.elemLeft || p.elemLeft <= 0) { return null; }
    var kind = ELEM_CYCLE[p.elemIdx % ELEM_CYCLE.length];
    p.elemIdx++; p.elemLeft--;
    return kind;
  }

  /* ── 판정 ─────────────────────────────────────────────── */

  /** 지금 걸려 있는 북돋움 (없으면 null) */
  function buffOn() {
    if (!run) { return null; }
    var b = run.player.buff;
    return (b && b.until > Date.now()) ? b : null;
  }

  function braceOn() { return !!buffOn(); }

  function atkOf() {
    var b = buffOn();
    return power().atk * (b ? b.atk : 1);
  }

  function hitBox() {
    var p = run.player;
    var w = REACH, h = 56;
    return {
      x: p.facing > 0 ? p.x + P_W : p.x - w,
      y: p.y - 4, w: w, h: h
    };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /**
   * 한 대 친다.
   * **급소(急所)** — 원작의 크리티컬이다. 같은 무예를 같은 적에게 써도 수치가 갈려야
   * 손이 계속 간다. 확률과 배수는 손잡이로 열려 있다(어드민 '균형 손잡이').
   * **넉백** — 맞은 적이 뒤로 밀린다. 위치만 바뀌고 피해는 그대로다 —
   * 판정을 흔들지 않으면서 "때렸다" 는 감각을 주는 가장 싼 값이다.
   * 다만 **보스는 밀리지 않는다**(밀리면 달려드는 패턴이 뜻을 잃는다).
   */
  function strike(e, mul, forceCrit, elem) {
    var p = run.player, m = mul || 1;
    /* 고유 조작(§5-1) — 받아치기·그림자 걷기가 예약해 둔 "다음 한 타" 보너스를
       여기 한 곳에서 꺼내 쓰고 곧바로 지운다(둘이 겹칠 일은 없다 — 갈래가
       다르면 둘 다 0/1이다). elem 은 castSkill() 이 쏠 때 실어 보낸 원소뿐이라
       melee·aoe·dash 등 나머지 효과에는 안 걸린다(§5-1 "다음 3발" 범위 그대로) */
    if (p.parryBonus !== 1) { m *= p.parryBonus; p.parryBonus = 1; }
    if (p.shadowHitT > 0) { m *= p.shadowHitMul; p.shadowHitT = 0; }
    var rm = run.rm;   // 비경 축복(§5-3) — 비경 밖에서는 null
    var crit = forceCrit || Math.random() < critRate() + (rm ? rm.crit : 0);
    var dmg = atkOf() * m * (0.88 + Math.random() * 0.24) * (crit ? critMul() + (rm ? rm.critMul : 0) : 1);
    if (rm) {
      dmg *= 1 + rm.dmg;
      if (e.boss || e.mini) { dmg *= 1 + rm.bossDmg; }
      if (rm.exec && e.hp <= e.hpMax * 0.3) { dmg *= 1 + rm.exec; }
    }
    /* 관문 대장(§5-4) 취약 — 방패가 깨진 10초 동안 받는 피해 ×1.5 */
    if (e.gate && e.gateVulnT > 0) { dmg *= GATE_VULN_MUL; }
    /* 사냥터 보스 그로기(§5-10) — 패턴 셋을 잇달아 피하면 5초 동안 ×1.5 */
    if (e.bp && e.bp.groggy > 0 && global.DG.bossPattern) { dmg *= global.DG.bossPattern.dmgTakenMul(e); }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    if (rm && rm.leech) { run.hp = Math.min(run.hpMax, run.hp + dmg * rm.leech); }
    e.hurt = HURT_FLASH;
    /* 관문 대장(§5-4) 방패 — **등 뒤**(e.dir 이 가리키는 반대쪽)에서 낸 피해만 쌓는다.
       e.dir 은 패턴 실행 중(update() 의 근접 판정, patternT>0)엔 얼어붙어 있어
       그 틈에 돌아가 때려야 뒤를 잡을 수 있다. 깨지면 10초 취약, 그 창이 끝나면
       다시 쌓을 수 있다(3분 싸움 동안 여러 번 깨질 수 있다). */
    if (e.gate && !e.gateShieldBroken) {
      var backSide = ((p.x + P_W / 2) - (e.x + e.w / 2) >= 0 ? 1 : -1);
      if (backSide !== e.dir) {
        e.gateShieldHp = (e.gateShieldHp || 0) + dmg;
        if (e.gateShieldHp >= e.hpMax * GATE_SHIELD_FRAC) {
          e.gateShieldBroken = true;
          e.gateVulnT = GATE_VULN_DUR;
          fx.push({ t: 'ring', x: e.x + e.w / 2, y: e.y + e.h / 2, r: 60, life: 0.5 });
          core.emit('toast', '🛡️💥 방패 파괴! 10초간 취약');
          sfx('crit');
        }
      }
    }
    /* 탱커형(PLAN 13절)은 보스처럼 밀리지 않는다 — 맷집이 그 컨셉이다 */
    if (!e.boss && e.role !== 'tank') {
      var away = (e.x + e.w / 2) - (run.player.x + P_W / 2) >= 0 ? 1 : -1;
      e.kx = (e.kx || 0) + away * knockPow() * (crit ? 1.5 : 1) * (m >= 2 ? 1.4 : 1);
    }
    fx.push({ t: 'hit', x: e.x + e.w / 2, y: e.y, v: dmg, life: 0.6, crit: crit });
    /* 손맛 표준(§5-7) — hitstop 은 한 대 맞을 때마다 걸린다(dt 를 낮춰 이
       프레임의 물리·쿨다운이 같이 늦춰진다, update() 머리 참고). 흔들림은
       이제 **모든 타격**에 걸린다(2px/80ms) — 급소·거함타(100 이상)는 그
       위에 더 크게(8px/220ms·3.6px/180ms, 예전 그대로). */
    run.hitstopT = Math.max(run.hitstopT || 0, e.boss ? HITSTOP_BOSS : (crit ? HITSTOP_CRIT : HITSTOP_NORMAL));
    var shAmt = crit ? 8 : (dmg >= 100 ? 3.6 : 2);
    var shSpan = crit ? 0.22 : (dmg >= 100 ? 0.18 : 0.08);
    fx.push({ t: 'shake', x: e.x, y: e.y, life: shSpan, span: shSpan, amt: shAmt, big: crit });
    if (crit) {
      sfx('crit');
    } else {
      run.hitSeq = ((run.hitSeq || 0) + 1) % HIT_CUES.length;
      sfx(HIT_CUES[run.hitSeq]);
    }
    if (elem) { applyElem(e, elem, m); }
    if (e.hp <= 0) { kill(e); }
  }

  function kill(e) {
    if (!run) { return; }
    run.kills += 1;
    st().kills = (st().kills || 0) + 1;
    var lv = run.stage.enemyLv;
    var mul = e.boss ? 12 : (e.rare ? RARE_GAIN_MUL : (e.mini ? MINI_GAIN_MUL : 1));
    var rmk = run.rm;   // 비경(§5-3) — 재물 축복·주간 변형자 보상 배수
    var gold = Math.round((6 + lv * 3) * (0.8 + Math.random() * 0.6) * mul * GAIN_GOLD * RG() *
      (rmk ? (1 + rmk.gold) * rmk.reward : 1));
    run.gold += gold;
    run.drops.push({ kind: 'gold', x: e.x + e.w / 2, y: e.y, vy: -180, n: gold });
    if (e.boss) {
      /* 보스는 탕약을 확정으로 떨군다 — 다음 판을 이어 갈 밑천이다 */
      run.drops.push({ kind: 'potion', x: e.x + e.w / 2 + 14, y: e.y, vy: -220, n: 3 });
    } else if (e.mini || Math.random() < DROP_POTION) {
      /* 미니보스도 확정으로 하나 떨군다 — 보스만큼은 아니어도 값진 싸움이다 */
      run.drops.push({ kind: 'potion', x: e.x + e.w / 2 + 10, y: e.y, vy: -200, n: e.mini ? 2 : 1 });
    }
    /* 장비·주문서 — 무엇이 나올지는 gear.js 가 정한다 (여기는 떨구기만 한다).
       미니보스는 보스와 같은 표를 쓴다(약한 싸움이 아니라는 보상 신호) */
    var G = global.DG.gear;
    if (G) {
      var got = G.rollDrop(lv, !!e.boss || !!e.mini);
      if (got) {
        run.drops.push({ kind: got.kind, key: got.key, uniq: !!got.uniq,
                         x: e.x + e.w / 2 - 12, y: e.y, vy: -240, n: 1 });
      }
    }
    var expAmt = Math.round((6 + lv * 4) * (e.boss ? 15 : (e.rare ? RARE_GAIN_MUL : (e.mini ? MINI_GAIN_MUL : 1))) * GAIN_EXP * RG() *
      (rmk ? rmk.reward : 1));
    core.gainExp(expAmt);
    run.expGained += expAmt;   // 세션 카드(§5-6) — 이 판에서 잡아 얻은 경험치만 잰다(사명 보상 등은 안 잡는다)
    /* 사명(quest.js)이 이 소식을 듣는다 — 규칙이 서로를 부르지 않게 알림으로만 잇는다 */
    core.emit('side:kill', { ref: e.ref, boss: !!e.boss, lv: lv, stage: run.stage.key });
    if (global.DG.hero.awardParty) { global.DG.hero.awardParty((2 + lv) * (e.boss ? 8 : 1)); }
    fx.push({ t: 'pop', x: e.x + e.w / 2, y: e.y, life: e.boss ? 0.9 : 0.5 });
    /* 뒤로 넘어가며 사라진다 — 원작에서 몹이 죽던 그 모습이다(화면 층이 그린다) */
    var deathDur = e.boss ? 1.1 : (e.mini ? 0.7 : 0.55);
    fx.push({ t: 'fall', x: e.x + e.w / 2, y: e.y, w: e.w, h: e.h,
              dir: (e.x + e.w / 2) - (run.player.x + P_W / 2) >= 0 ? 1 : -1,
              ref: e.ref, boss: !!e.boss, life: deathDur });
    if (e.boss) { fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.6, big: true }); }
    sfx((e.boss || e.mini) ? 'bosskill' : 'kill');

    /* 죽는 몸짓(2026-09-11) — `run.enemies`(판정)에서는 바로 빼지만, 화면(3D)이
       `run.dying`으로 잠깐 더 붙들어 death 몸짓이 다 돌 때까지 세워 둔다. uid를
       따로 매겨 배열 인덱스로 안 묶는다 — run.enemies 는 이 자리에서 바로
       splice 되어 뒤 원소가 인덱스 하나씩 당겨지는데, 화면 쪽 배우 풀이 인덱스로
       재활용하는 예전 방식이었다면 죽는 도중 다른 적의 모습으로 바뀌어 버렸을 것 */
    run.dying.push({
      uid: ++deathUid, ref: e.ref, x: e.x, y: e.y, w: e.w, h: e.h,
      dir: (e.x + e.w / 2) - (run.player.x + P_W / 2) >= 0 ? 1 : -1,
      boss: !!e.boss, mini: !!e.mini, rare: !!e.rare, role: e.role,
      t: 0, dur: deathDur
    });

    var idx = run.enemies.indexOf(e);
    if (idx >= 0) { run.enemies.splice(idx, 1); }

    /* 비경(§5-3) — 층이 끝났는지·잡졸을 채울지는 rift.js 가 정한다. 사냥터 보스·잡졸 리젠 분기를 건너뛴다 */
    if (run.rift && global.DG.rift) { global.DG.rift.onKill(e); return; }

    if (e.gate) {
      /* 관문 대장(§5-4) — 사냥터 보스와 리젠 규칙이 다르다(주간 잠금).
         run.stage 에는 `.boss` 가 없는 마을이라 위 분기와 반드시 갈라야 한다. */
      var sg = st();
      sg.bosses = (sg.bosses || 0) + 1;
      sg.gateWeek[e.gateKey] = gateWeekKey();     // 이겼다 — 이번 주는 다시 안 나온다
      run.boss = null;
      run.gateT = 0;
      core.gainFeat(30 + lv * 4, '관문 대장');
      grantGateReward(e);
      core.emit('changed');
      return;
    }
    if (e.boss) {
      var s = st();
      s.bosses = (s.bosses || 0) + 1;
      s.bossAt[run.stage.key] = Date.now();       // 여기서부터 다시 나오기까지를 센다
      run.boss = null;
      core.gainFeat(20 + lv * 3, '토벌');
      core.log('👺 ' + e.ref.name + ' 을(를) 잡았다! · 🪙 ' + core.fmt(gold) +
        ' · 🧪 +3 (' + run.stage.boss.cool + '분 뒤 다시 나온다)', 'good');
      core.emit('toast', '👺 ' + e.ref.name + ' 토벌!');
      core.emit('changed');
      return;                                     // 보스 자리는 다시 채우지 않는다
    }
    /* 잡은 자리 대신 다른 곳에서 하나가 더 나온다 (사냥터가 비지 않게) */
    spawnEnemy();
  }

  /** 맞을 때 — 낀 방어가 덜 맞게 해 준다 (아무리 높아도 6할까지) */
  function hurtMe(amount) {
    if (!run) { return; }
    var p = run.player;
    if (p.invuln > 0) { return; }
    /* 받아치기(§5-1, 무사 고유 조작) — 창 안에 맞으면 무효화하고, 그제서야
       "다음 한 타" 보너스가 켜진다(눌렀다고 바로 켜지지 않는다 — 실제로
       받아쳐야 한다). strike() 가 p.parryBonus 를 꺼내 쓰고 지운다. */
    if (p.parryT > 0) {
      p.parryT = 0;
      p.parryBonus = p.parryNextMul;
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 50, life: 0.3 });
      sfx('crit');
      core.emit('toast', '🛡️ 받아쳤다!');
      return;
    }
    /* 방패(§5-3) — 층마다 첫 피격 하나를 통째로 막는다 */
    if (run.rm && run.rm.shield && global.DG.rift.tryShield()) {
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 50, life: 0.3 });
      core.emit('toast', '🛡️ 방패가 막았다');
      p.invuln = HIT_COOL;
      return;
    }
    var G = global.DG.gear;
    var cut = G ? G.cut(power().def) : 0;
    var b = buffOn();
    if (b && b.guard) { cut = Math.min(0.85, cut + b.guard); }   // 철갑 같은 것
    if (run.rm && run.rm.guard) { cut = Math.min(0.85, cut + run.rm.guard); }   // 철벽(§5-3)
    run.hp -= Math.max(1, Math.round(amount * (1 - cut)));
    sfx('hurt');
    fx.push({ t: 'ouch', x: p.x, y: p.y, life: 0.45 });
    fx.push({ t: 'shake', x: p.x, y: p.y, life: 0.18, big: false });
    p.hurt = 0.3;
    if (global.DG.mount && global.DG.mount.onHurt) { global.DG.mount.onHurt(); }      // 맞으면 내린다
    p.invuln = HIT_COOL + (run.rm ? run.rm.invuln : 0);
    if (run.hp <= 0) {
      /* 불굴(§5-3) — 비경에서 한 번은 일어선다 */
      if (run.rm && run.rm.revive && global.DG.rift.tryRevive()) {
        p.invuln = 1.5;
        fx.push({ t: 'heal', x: p.x, y: p.y, life: 0.6 });
        core.emit('toast', '🔥 불굴 — 다시 일어선다!');
      } else if (!(run.pty && global.DG.party.onFall())) {
        die();   // 동료 교대(§5-8) — 남은 동료가 없을 때만 판이 끝난다
      }
    }
  }

  function die() {
    var stg = run.stage, Q = global.DG.quest;
    var riftSum = global.DG.rift ? global.DG.rift.onEnd('dead') : null;   // 비경(§5-3) — 진행은 지워지고 조각만 남는다
    st().deaths = (st().deaths || 0) + 1;
    var goldKept = Math.round(run.gold * 0.5);
    core.log('💀 ' + stg.name + ' 에서 쓰러졌다 — 주운 금은 절반만 남는다', 'bad');
    core.save.player.gold += goldKept;
    var got = {
      dead: true, stage: stg.name, gold: goldKept, kills: run.kills,
      exp: run.expGained, gear: run.gearFound,
      feat: achieveDoneCount() - run.feat0,
      next: Q ? Q.nextTodo() : null,
      rift: riftSum
    };
    run = null;
    core.emit('side:end', got);
    core.emit('toast', '💀 쓰러졌습니다');
    core.emit('changed');
    core.persist();
  }

  function drink() {
    var s = st();
    if (!run || s.potions <= 0) { return false; }
    if (run.hp >= run.hpMax) { return false; }
    if (run.rm && run.rm.noPotion) { core.emit('toast', '🏜️ 이번 주 비경에서는 탕약을 못 마십니다'); return false; }
    s.potions -= 1;
    run.hp = Math.min(run.hpMax, run.hp + Math.round(run.hpMax * (0.45 + (run.rm ? run.rm.potion : 0))));
    fx.push({ t: 'heal', x: run.player.x, y: run.player.y, life: 0.5 });
    run.player.drinkAnim = DRINK_ANIM_DUR;
    sfx('potion');
    core.emit('changed');
    return true;
  }

  /* ── 스킬 ─────────────────────────────────────────────── */

  /** 조작 띠에 놓인 무예들 (job.js 가 없으면 옛 네 가지로 돌아간다) */
  function barSkills() {
    var J = global.DG.job;
    return J ? J.bar() : SD.SKILLS;
  }

  /** "공격" 자리 — 쿨이 가장 짧은(=가장 자주 휘두르는) 무예를 손이 쥔다.
      나머지는 auto.js 가 조건대로 알아서 쓴다("스킬은 자동, 공격만 손으로") */
  function attackIndexOf(list) {
    var idx = 0, best = 1e9;
    for (var i = 0; i < list.length; i++) {
      if (list[i].cd < best) { best = list[i].cd; idx = i; }
    }
    return list.length ? idx : -1;
  }

  /** 그 무예의 지금 힘 — 찍은 레벨이 실려 있다 */
  function mulOf(sk) {
    var J = global.DG.job;
    if (J && J.mulOf) { return J.mulOf(sk); }
    return sk.mul ? sk.mul[0] : 1;
  }

  /**
   * 무예를 쓴다. `effect` 하나하나가 이 판이 아는 손잡이다 —
   * 데이터(`data-job.js`)는 무엇을 할지만 적고, **어떻게 하는지는 여기에만** 있다.
   */
  function castSkill(i) {
    if (!run) { return false; }
    var list = barSkills();
    var sk = list[i], p = run.player;
    if (!sk) { return false; }
    if (p.cds[i] > 0 || run.mp < sk.cost) { return false; }
    run.mp -= sk.cost;
    p.cds[i] = sk.cd;
    return castBody(sk, 0);
  }

  /** 무예 한 번의 효과. swapMul 이 있으면 교대 서명(§5-8) — 배율을 그 값으로 고정하고 유파 보정·무예 레벨은 안 탄다 */
  function castBody(sk, swapMul) {
    var p = run.player;
    if (global.DG.mount && global.DG.mount.onAttack) { global.DG.mount.onAttack(); }   // 탈것 위에선 못 싸운다 — 무예를 쓰면 내린다
    p.atkCd = ATK_ANIM_DUR;
    var S0 = global.DG.sfx;
    sfx(sk.cost === 0 ? 'swing' : (S0 ? S0.skillCue(sk.effect) : 'skill'));

    var j, e, dx, dy, mul = swapMul || mulOf(sk);
    var eff = sk.effect;
    /* 유파(§5-2) — 띠 조합에 따른 보정을 여기 한 곳에서 구해, 아래 갈래마다
       제 자리(mul·r·buff.sec·heal·shots)에 곱하거나 더하기만 한다. side.js 는
       유파가 뭔지 몰라도 된다(job.js schoolBonus() 가 다 정한다). */
    var JB = global.DG.job;
    var sb = (JB && !swapMul) ? JB.schoolBonus(sk) : null;
    mul *= sb ? sb.dmgMul : 1;

    /* 궁수 당기기(§5-1) — 화살·연사 한 번에만 실린다(다음 화살 하나뿐, 평타처럼
       계속 나가는 자리에 얹으면 힘이 안 보이게 흩어진다). 관통은 shots 의
       pierceLeft(§5-1) 로 남는다 — 원래 화살(pierce:false)은 첫 하나에서
       멈추던 것을, 이만큼 더 뚫고 지나가게 한다. */
    var pierceAdd = 0;
    if (p.archerBuff && (eff === 'arrow' || eff === 'volley')) {
      mul *= p.archerBuff.mul;
      pierceAdd = p.archerBuff.pierce;
      p.archerBuff = null;
    }

    if (eff === 'melee') {
      var hits = sk.hits || 1;
      var box = hitBox();
      fx.push({ t: 'slash', x: box.x, y: box.y, w: box.w, h: box.h, dir: p.facing, life: 0.16 });
      for (j = 0; j < run.enemies.length; j++) {
        if (overlap(box, run.enemies[j])) {
          for (var h = 0; h < hits; h++) { strike(run.enemies[j], mul); }
        }
      }
    } else if (eff === 'aoe') {
      var r = (sk.r || REACH * 1.5) * (sb ? sb.aoeMul : 1);
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: r, life: 0.28 });
      for (j = 0; j < run.enemies.length; j++) {
        e = run.enemies[j];
        dx = (e.x + e.w / 2) - (p.x + P_W / 2);
        dy = (e.y + e.h / 2) - (p.y + P_H / 2);
        if (Math.sqrt(dx * dx + dy * dy) < r) { strike(e, mul); }
      }
    } else if (eff === 'bolt' || eff === 'arrow') {
      /* 관통 표시선(§5-7 남은 조각) — ox 는 쏜 자리에 고정, 화면 층이 여기부터
         지금까지를 선으로 그어 "뚫고 지나간다"를 보여 준다(bolt 만, 화살은 점 하나로 족하다) */
      run.shots.push({ x: p.x + P_W / 2, y: p.y + P_H * 0.4, dir: p.facing,
                       spd: eff === 'arrow' ? 640 : 520, life: 1.2,
                       mul: mul, pierce: eff === 'bolt', pierceLeft: pierceAdd,
                       elem: takeElem(p), kind: sk.key, hit: {},
                       ox: p.x + P_W / 2 });
    } else if (eff === 'volley') {
      /* 여러 발 — 높이를 조금씩 달리해 한 줄로 겹치지 않게 한다.
         유파(§5-2) 연·화·탄 세트가 발수를 늘린다(2=+1·4=+2). 원소 전환(§5-1)은
         "발"이 곧 이 낱개 화살이라 — 여러 발 중 남는 만큼만 물든다. */
      var n = (sk.shots || 2) + (sb ? sb.shotsAdd : 0);
      for (j = 0; j < n; j++) {
        run.shots.push({ x: p.x + P_W / 2, y: p.y + P_H * (0.3 + 0.16 * j), dir: p.facing,
                         spd: 600 + j * 34, life: 1.1,
                         mul: mul, pierce: false, pierceLeft: pierceAdd,
                         elem: takeElem(p), kind: sk.key, hit: {} });
      }
    } else if (eff === 'dash') {
      /* 밀고 나간다 — 지나간 자리의 적을 벤다. 은신보는 잠깐 맞지 않는다 */
      var from = p.x, dist = (sk.dist || 200) * p.facing;
      p.x = core.clamp(p.x + dist, 0, run.stage.width - P_W);
      p.climb = null;
      if (sk.invuln) { p.invuln = Math.max(p.invuln, sk.invuln); }
      var lo = Math.min(from, p.x) - 10, hi = Math.max(from, p.x) + P_W + 10;
      fx.push({ t: 'dash', x: lo, y: p.y, w: hi - lo, h: P_H, life: 0.22 });
      /* 돌진 잔상(§5-7 남은 조각) — 밀고 나간 순간은 한 프레임뿐이라(순간이동에
         가깝다) 지나간 자리에 몸 그림자 여럿을 심어 "몸이 지나갔다"는 궤적을 남긴다.
         빛줄기 하나(위 'dash')만으로는 몸의 형체가 안 남아 허전했다 */
      var ghostN = 4;
      for (var gk = 1; gk <= ghostN; gk++) {
        fx.push({ t: 'ghost', x: from + P_W / 2 + (p.x - from) * (gk / (ghostN + 1)),
                  y: p.y + P_H, life: 0.16 - gk * 0.01 });
      }
      for (j = 0; j < run.enemies.length; j++) {
        e = run.enemies[j];
        if (e.x + e.w > lo && e.x < hi && Math.abs((e.y + e.h) - (p.y + P_H)) < 60) {
          /* 유파(§5-2) 질·퇴·보·축 4세트 — dash 무예로 때리면 급소가 확정된다 */
          strike(e, mul, sb && sb.critForce);
        }
      }
    } else if (eff === 'rain') {
      /* 앞쪽 넓은 자리에 쏟는다 — 서 있는 높이와 상관없이 위아래로 넓다 */
      var rx = p.facing > 0 ? p.x : p.x - 340;
      var band = { x: rx, y: p.y - 220, w: 340 + P_W, h: 300 };
      fx.push({ t: 'rain', x: band.x, y: band.y, w: band.w, h: band.h, life: 0.5 });
      for (j = 0; j < run.enemies.length; j++) {
        e = run.enemies[j];
        if (overlap(band, e)) {
          strike(e, mul, false, takeElem(p));
          /* 착탄 다발(§5-7 남은 조각) — 화살비는 한 몸에도 여러 점이 동시에
             꽂힌다. 겉을 씌우는 'rain' 하나만으로는 몸에 닿는 느낌이 없었다 */
          for (var rk = 0; rk < 3; rk++) {
            fx.push({ t: 'impact', x: e.x + Math.random() * e.w,
                      y: e.y + Math.random() * e.h * 0.6, life: 0.22 + Math.random() * 0.1 });
          }
        }
      }
    } else if (eff === 'heal') {
      var pct = (sk.heal ? (sk.heal[0] + sk.heal[1] * Math.max(0, (swapMul ? 1 : lvOf(sk)) - 1)) : 0.2) *
        (sb ? sb.healMul : 1);
      run.hp = Math.min(run.hpMax, run.hp + Math.round(run.hpMax * pct));
      fx.push({ t: 'heal', x: p.x, y: p.y, life: 0.5 });
    } else if (eff === 'buff') {
      var b = sk.buff || { sec: BRACE_SEC, atk: 1.35 };
      p.buff = {
        until: Date.now() + (b.sec || BRACE_SEC) * 1000 * (sb ? sb.buffMul : 1),
        atk: b.atk || 1, speed: b.speed || 1, guard: b.guard || 0, regen: b.regen || 1,
        name: sk.name
      };
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 60, life: 0.4 });
    }
    if (!swapMul) { core.emit('side:skill', sk.key); }
    return true;
  }

  /** 교대 서명 1발(§5-8) — party.js 가 부른다. 기력·쿨을 안 쓴다 */
  function castSwap(sk, mul) {
    return run ? castBody(sk, mul) : false;
  }

  function lvOf(sk) {
    var J = global.DG.job;
    return J ? J.levelOf(sk.key) : 1;
  }

  /* ── 매 프레임 ────────────────────────────────────────── */

  /** 보스 패턴(§5-9)이 바깥에 부탁하는 일 — 판정 모듈은 이것만 안다 */
  var bpA = null;
  function bpApi() {
    if (!bpA) {
      bpA = {
        fx: fx,
        hurt: function (n) { hurtMe(n); },
        spawn: function (x) { spawnEnemy(x); },
        sfx: sfx,
        toast: function (m) { core.emit('toast', m); },
        rand: Math.random,
        hpMax: function () { return run ? run.hpMax : 100; }
      };
    }
    bpA.p = run.player; bpA.stg = run.stage;
    return bpA;
  }

  function update(dt) {
    if (!run) { return; }
    dt = Math.min(dt, 0.05);
    var MTs = global.DG.mount; if (MTs && MTs.step) { MTs.step(dt); }         // 탈것 — 날갯짓 쉼·내림 판정(mount.js)
    /* 손맛 표준(§5-7) — 타격 정지(hitstop). 한 대 맞은 순간 몇 프레임만 확
       늦춘다(멈추지는 않는다 — dt=0 이면 몇몇 카운트다운이 얼어붙은 티가
       난다). 실제 경과 시간(줄지 않은 dt)으로 hitstopT 를 줄이고, 이
       프레임에 쓸 dt 만 낮춰 이동·물리·쿨다운이 같이 늦춰진다("화면
       전체"가 아니라 판정 dt 만 — 사가나락 dungeon.js `update()`와 같은
       요령). */
    if (run.hitstopT > 0) { run.hitstopT -= dt; dt *= 0.15; }
    /* 비경(§5-3) — 층이 끝났으면 타격 반복문 밖인 여기서 정리한다(무대를 갈아 끼우거나 나가기도 한다) */
    if (run.riftTick && global.DG.rift) {
      run.riftTick = false;
      global.DG.rift.tick();
      if (!run) { return; }
    }
    /* 동료 교대(§5-8) — 교대 쿨을 깎고, 막 나온 인물의 서명 1발을 여기서(타격 반복문 밖) 쏜다 */
    if (run.pty && global.DG.party) { global.DG.party.tick(dt); }
    var p = run.player, stg = run.stage, i;

    /* 관문 대장(§5-4) 제한 시간 — 넘기면 그 자리에서 광폭화(공격 ×1.5), 실패로 끝나진 않는다 */
    if (run.gateT > 0) {
      run.gateT -= dt;
      if (run.gateT <= 0 && run.boss && run.boss.gate && !run.boss.enraged) {
        run.boss.enraged = true;
        run.boss.dmg = Math.round(run.boss.dmg * GATE_ENRAGE_MUL);
        fx.push({ t: 'shake', x: run.boss.x, y: run.boss.y, life: 0.5, span: 0.5, amt: 8, big: true });
        core.emit('toast', '🔥 관문 대장이 광폭화했다! 공격 +50%');
      }
    }

    /* 대화창을 연 채 자리를 뜨면 저절로 닫는다 — 닫는 것을 잊고 걸어가도 막혀 있지 않게 */
    if (run.talk && Math.abs((p.x + P_W / 2) - run.talk.x) > TALK_LEAVE_R) { closeTalk(); }

    for (i = 0; i < p.cds.length; i++) { if (p.cds[i] > 0) { p.cds[i] -= dt; } }
    if (p.dodgeCd > 0) { p.dodgeCd -= dt; }
    if (p.atkCd > 0) { p.atkCd -= dt; }   // 공격 몸짓 타이머(판정과 무관, 화면 층만 본다)
    if (p.dodgeAnim > 0) { p.dodgeAnim -= dt; }
    if (p.drinkAnim > 0) { p.drinkAnim -= dt; }
    if (p.coyoteT > 0) { p.coyoteT -= dt; }
    if (p.jumpBufferT > 0) { p.jumpBufferT -= dt; }
    if (p.rollT > 0) { p.rollT -= dt; }
    if (p.wallKickT > 0) { p.wallKickT -= dt; }
    /* 고유 조작(§5-1) — 회피를 누르고 있는 동안만 holdT 가 쌓이고, 임계
       (job.js JD.SIGNATURE_HOLD)를 넘는 순간 딱 한 번 armSignature() 가 돈다.
       그 뒤(홀드 도중)에는 다시 안 불린다 — holdArmed 가 막는다. */
    if (p.holding) {
      p.holdT += dt;
      var J0 = global.DG.job, sig0 = J0 && J0.signature ? J0.signature() : null;
      if (!p.holdArmed && sig0 && p.holdT >= sig0.hold) { armSignature(); }
    }
    if (p.sigCd > 0) { p.sigCd -= dt; }
    if (p.parryT > 0) { p.parryT -= dt; }
    if (p.shadowHitT > 0) { p.shadowHitT -= dt; }
    if (p.shadowT > 0) {
      p.shadowT -= dt;
      p.invuln = Math.max(p.invuln, p.shadowT);   // 이동이 끝나는 순간과 무적이 함께 끝난다
    }
    var bf = buffOn();
    run.mp = Math.min(run.mpMax, run.mp + MP_REGEN * (bf ? bf.regen : 1) * (run.rm ? 1 + run.rm.mp : 1) * dt);
    if (run.rm && run.rm.regen) { run.hp = Math.min(run.hpMax, run.hp + run.hpMax * run.rm.regen * dt); }   // 회복 축복(§5-3)
    if (p.invuln > 0) { p.invuln -= dt; }
    if (p.hurt > 0) { p.hurt -= dt; }

    if (p.dropThru > 0) { p.dropThru -= dt; }

    /* 궁수 당기기(§5-1) — 힘을 모으는 동안 이동이 느려진다(누른 시간이 곧
       위력이니 "가만히 서서 당긴다"는 선택을 만든다) */
    var mul = (bf ? bf.speed : 1) * (p.archerCharging ? p.archerMoveMul : 1) * (MTs ? MTs.speedMul() : 1);   // 탈것 이동 배율(mount.js)

    if (p.climb) {
      /* 줄에 매달린 동안은 **중력도 좌우 이동도 없다** — ↑↓ 로만 오르내린다.
         원작의 밧줄·사다리가 그렇다. 뛰면(점프) 손을 떼고 그 방향으로 튄다. */
      p.vy = 0;
      var mv = input.up ? -CLIMB * dt : (input.down ? CLIMB * dt : 0);
      p.y += mv;
      if (mv) { p.phase += dt * 7; sfx('climb'); }
      p.x = p.climb.x - P_W / 2;
      var foot = p.y + P_H;
      /* **움직인 방향으로만** 끝을 판정한다 — 아래 끝(바닥)에서 막 잡은 줄이
         그 프레임에 곧바로 풀려 버리던 결함이 여기 있었다 */
      if (mv < 0 && foot <= p.climb.top) {    // 꼭대기를 넘어섰다 — 발판 위에 올라선다
        p.y = p.climb.top - P_H; p.climb = null; p.onGround = true;
      } else if (mv > 0 && foot >= p.climb.bottom) {   // 끝까지 내려왔다
        p.y = p.climb.bottom - P_H; p.climb = null; p.onGround = true;
      }
    } else {
      /* 좌우 — 착지 롤·벽 차기 동안은 입력과 무관하게 그 방향으로 밀린다
         (§5-5, 둘 다 "손 놓아도 몸이 이어서 움직인다"는 짧은 창) */
      var wasGround = p.onGround;
      if (p.rollT > 0) {
        p.vx = p.facing;
      } else if (p.wallKickT > 0) {
        p.vx = p.wallKickDir;
      } else if (p.shadowT > 0) {
        /* 그림자 걷기(협객, §5-1) — dash 처럼 한 프레임에 튀는 게 아니라
           밀고 가는 "이동"이라, 벽 차기·착지 롤과 같은 요령으로 입력을
           덮어쓴다(입력을 놓아도 이어진다). */
        p.vx = p.facing;
      } else {
        p.vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (p.vx) { p.facing = p.vx > 0 ? 1 : -1; }
      }
      var moveMul = p.rollT > 0 ? ROLL_MUL :
        (p.wallKickT > 0 ? (WALL_KICK_VX / SPEED) : (p.shadowT > 0 ? SIG_SHADOW_MUL : 1));
      p.x = core.clamp(p.x + p.vx * SPEED * mul * moveMul * (run.rm ? 1 + run.rm.speed : 1) * dt, 0, stg.width - P_W);
      if (p.vx) { p.phase += dt * 9; }

      /* 중력 · 발판 */
      var prevBottom = p.y + P_H;
      p.vyPrev = p.vy;                        // 착지 먼지가 읽는다 (닿는 순간엔 0 이 된다)
      p.vy += GRAV * (MTs ? MTs.gravMul() : 1) * dt;
      if (MTs && p.vy > MTs.fallCap()) { p.vy = MTs.fallCap(); }               // 날개 탈것 — 가볍게 가라앉는다
      p.y += p.vy * dt;
      if (MTs) { MTs.ceil(p); }
      var bottom = p.y + P_H;
      var wasFalling = p.vy > 0;
      p.onGround = false;

      if (bottom >= stg.floor) {
        p.y = stg.floor - P_H; p.vy = 0; p.onGround = true;
      } else if (p.vy > 0 && p.dropThru <= 0) {
        /* 위에서 내려올 때만 발판에 선다 (↓+점프로 빠져나가는 동안은 통과) */
        for (i = 0; i < stg.plats.length; i++) {
          var pl = stg.plats[i];
          if (p.x + P_W > pl[0] && p.x < pl[0] + pl[2] &&
              prevBottom <= pl[1] + 2 && bottom >= pl[1]) {
            p.y = pl[1] - P_H; p.vy = 0; p.onGround = true;
            break;
          }
        }
      }
      if (p.onGround && wasFalling) {
        sfx('land');
        if (p.vyPrev > ROLL_SPEED) {
          /* 착지 롤(§5-5) — 세게 떨어져도 굳어 서지 않고 보던 방향으로 구르며
             속도를 살린다. 이 판엔 원래 착지 경직이 없었으니 "경직 대신"이
             아니라 그 자리에 새로 얹는 보상 동작이다. */
          p.rollT = ROLL_DUR;
          fx.push({ t: 'dust', x: p.x + P_W / 2, y: p.y + P_H, life: 0.4 });
        } else if (p.vyPrev > 620) {
          /* 세게 떨어졌을 때만 먼지가 인다 — 계단을 걸어 내려갈 때마다 일면 어지럽다 */
          fx.push({ t: 'dust', x: p.x + P_W / 2, y: p.y + P_H, life: 0.32 });
        }
        if (p.jumpBufferT > 0) {
          /* 점프 버퍼(§5-5) — 착지 직전 눌러 둔 입력을 여기서 그대로 이어 쓴다 */
          p.jumpBufferT = 0; p.rollT = 0;
          p.vy = -JUMP * (MTs ? MTs.jumpMul() : 1); p.onGround = false;
          sfx('jump');
        }
      }
      if (wasGround && !p.onGround && p.vy >= 0) {
        /* 코요테 타임(§5-5) — 발판을 걸어서 막 떠난 직후에도 잠깐은 점프를 받아 준다.
           `jump()`가 직접 onGround 를 끈 경우(진짜 점프)는 vy 가 이미 음수라 안 걸린다 */
        p.coyoteT = COYOTE_TIME;
      }

      /* 떨어지다가 줄에 닿았을 때 ↑ 를 누르고 있으면 그대로 매달린다 */
      if (!p.onGround && input.up) {
        var rr = ropeAt(p.x + P_W / 2, p.y + P_H);
        if (rr) { grab(rr); }
      }
    }

    /* 앉아 쉰다 — 원작에서 의자에 앉아 체력·기력을 채우던 그 자리다.
       ↓ 를 누른 채 가만히 있으면 앉고, 곁에 적이 오거나 움직이면 곧 일어선다.
       (줄에 매달렸을 때는 ↓ 가 내려가기이므로 앉지 않는다) */
    var foeNear = false;
    for (i = 0; i < run.enemies.length; i++) {
      var fe = run.enemies[i];
      if (Math.abs((fe.x + fe.w / 2) - (p.x + P_W / 2)) < 190 &&
          Math.abs((fe.y + fe.h) - (p.y + P_H)) < 80) { foeNear = true; break; }
    }
    var canRest = input.down && p.onGround && !p.climb && !input.left && !input.right && !foeNear;
    if (canRest) {
      var wasUp = p.resting <= 0.4;
      p.resting += dt;
      if (p.resting > 0.4) {                    // 앉는 데 한 박자
        if (wasUp) { sfx('sit'); }
        run.hp = Math.min(run.hpMax, run.hp + run.hpMax * 0.020 * dt);
        run.mp = Math.min(run.mpMax, run.mp + run.mpMax * 0.055 * dt);
      }
    } else {
      p.resting = 0;
    }

    /* 내가 날린 것 — 꿰뚫는 것(pierce)은 계속 가고, 화살은 첫 하나에 걸린다 */
    for (i = run.shots.length - 1; i >= 0; i--) {
      var sh = run.shots[i];
      sh.x += sh.dir * sh.spd * dt;
      sh.life -= dt;
      var spent = false;
      for (var si = 0; si < run.enemies.length; si++) {
        var se = run.enemies[si];
        if (sh.hit[si]) { continue; }
        if (overlap({ x: sh.x - 10, y: sh.y - 10, w: 20, h: 20 }, se)) {
          sh.hit[si] = true;
          strike(se, sh.mul === undefined ? 2.1 : sh.mul, false, sh.elem);
          /* 관통 +1(§5-1, 궁수 당기기) — 원래 첫 하나에서 멈추던 화살·연사가
             pierceLeft 만큼 더 뚫고 지나간다(무제한 관통인 bolt 는 그대로). */
          if (sh.pierce === false) {
            if (sh.pierceLeft > 0) { sh.pierceLeft--; } else { spent = true; break; }
          }
        }
      }
      if (spent || sh.life <= 0 || sh.x < -20 || sh.x > stg.width + 20) { run.shots.splice(i, 1); }
    }

    /* 날아오는 것 — 화살·탄환. 맞으면 접촉과 같은 무적 시간이 걸린다 */
    for (i = run.eshots.length - 1; i >= 0; i--) {
      var es = run.eshots[i];
      es.x += es.dir * es.spd * dt;
      /* 마법형 구슬만 높이를 따라온다(homing) — 활·조총은 쏜 그대로 직선이다 */
      if (es.homing) {
        var targetY = p.y + P_H * 0.5, stepY = MAGIC_HOME * dt;
        es.y = es.y < targetY ? Math.min(targetY, es.y + stepY) : Math.max(targetY, es.y - stepY);
      }
      es.life -= dt;
      var gone = es.life <= 0 || es.x < -20 || es.x > stg.width + 20;
      if (!gone && overlap({ x: es.x - 7, y: es.y - 5, w: 14, h: 10 },
                           { x: p.x, y: p.y, w: P_W, h: P_H })) {
        gone = true;
        if (p.invuln <= 0) {
          hurtMe(es.dmg);
          if (!run) { return; }
        }
      }
      if (gone) { run.eshots.splice(i, 1); }
    }

    /* 적 — 순찰하다가 가까이 오면 쫓아온다 */
    for (i = 0; i < run.enemies.length; i++) {
      var e = run.enemies[i];
      if (e.hurt > 0) { e.hurt -= dt; }
      if (e.atkAnim > 0) { e.atkAnim -= dt; }
      /* 원소 전환(§5-1, 방사 고유 조작)의 화(火)·빙(氷) — 살아 있는 동안만의
         런타임 상태다(data-enemy.js 는 안 늘렸다, §2-2). 이 프레임에 죽으면
         이 루프 자리(i)가 바로 kill() 로 지워지므로 i-- 로 다음 원소를 안
         건너뛴다. */
      if (e.burnT > 0) {
        e.hp -= e.hpMax * 0.05 * dt;
        e.burnT -= dt;
        if (e.hp <= 0) { kill(e); i--; continue; }
      }
      if (e.slowT > 0) { e.slowT -= dt; }
      /* 관문 대장(§5-4) 취약 — 10초가 다 지나면 방패를 다시 채운다(재도전 가능) */
      if (e.gate && e.gateVulnT > 0) {
        e.gateVulnT -= dt;
        if (e.gateVulnT <= 0) { e.gateShieldBroken = false; e.gateShieldHp = 0; }
      }
      e.phase += dt * 6;
      var dx = (p.x + P_W / 2) - (e.x + e.w / 2);
      var near = Math.abs(dx) < (e.boss ? 420 : 260) && Math.abs((p.y + P_H) - (e.y + e.h)) < 70;
      /* 패턴(§5-4) 실행 중엔 등을 돌린 채 얼어붙는다 — 그 틈이 방패를 깨는 창이다 */
      if (near && !(e.gate && e.patternT > 0)) { e.dir = dx > 0 ? 1 : -1; }
      /* 보스의 한 가지 패턴 — 뜸을 들이다 달려든다. 서서 때리기만 하면 안 되게.
         돌진형 잡몹(PLAN 13절)도 같은 패턴을 쓴다 — `chargeCd` 가 있는지로 본다.
         관문 대장(§5-4)의 "달려들기"(패턴 1)는 이 자리를 그대로 쓴다 — e.boss 라
         따로 안 늘린다 */
      var chargeMul = 1;
      if (e.boss || e.role === 'dash') {
        if (e.charge > 0) {
          e.charge -= dt;
          chargeMul = 2.6;
        } else {
          e.chargeCd -= dt;
          if (e.chargeCd <= 0 && near) {
            e.charge = 1.1;
            e.chargeCd = 5 + Math.random() * 3;
            sfx('charge');
            fx.push({ t: 'ring', x: e.x + e.w / 2, y: e.y + e.h / 2, r: 46, life: 0.3 });
            /* 소리만으로는 못 듣는 사람이 있다 — 화면에도 한 박자 띄운다 */
            fx.push({ t: 'warn', x: e.x + e.w / 2, y: e.y, life: 0.9 });
          }
        }
      }
      /* 사냥터 보스 패턴전(§5-9, boss-pattern.js) — 체력 구간마다 늘어나는 장판·지진·휩쓸기.
         관문 대장은 아래 제 패턴이 있어 안 탄다 */
      var BPm = global.DG.bossPattern;
      if (e.boss && !e.gate && BPm && BPm.on()) {
        BPm.step(e, dt, bpApi(), near);
        if (!run) { return; }
        /* 그로기(§5-10) — 멈춰 선다: 걷기·박치기·돌진 없음 */
        if (e.bp && e.bp.groggy > 0) { continue; }
      } else if (e.gate && BPm && BPm.on() && BPm.sigOf(e)) {
        /* 관문 대장 고유 기술(§5-11) — 제 패턴 사이사이에 */
        BPm.stepSig(e, dt, bpApi(), near);
        if (!run) { return; }
        if (e.bp && e.bp.groggy > 0) { continue; }
      }
      /* 관문 대장(§5-4) 패턴 2·3 — 범위 표시 후 내려찍기 · 소환 2. 달려들기와
         겹치지 않게 e.charge<=0 일 때만 새로 문다(둘이 같이 터지면 정신없다) */
      if (e.gate) {
        if (e.patternT > 0) {
          e.patternT -= dt;
          if (e.patternT <= 0 && e.patternKind === 'slam') {
            var slamDx = Math.abs(e.slamX - (p.x + P_W / 2));
            var slamDy = Math.abs(e.slamY - (p.y + P_H));
            if (slamDx < GATE_SLAM_R && slamDy < GATE_SLAM_R && p.invuln <= 0) {
              hurtMe(Math.round(e.dmg * 1.3));
              if (!run) { return; }
            }
            fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.4, span: 0.4, amt: 6, big: true });
            sfx('charge');
            e.patternKind = '';
          }
        } else {
          e.patternCd -= dt;
          if (e.patternCd <= 0 && near && e.charge <= 0 && !(e.bp && e.bp.kind)) {
            e.patternCd = 7 + Math.random() * 4;
            if (Math.random() < 0.5) {
              e.patternKind = 'slam';
              e.slamX = p.x + P_W / 2; e.slamY = p.y + P_H;
              e.patternT = 1.0;
              fx.push({ t: 'zonewarn', x: e.slamX, y: e.slamY, r: GATE_SLAM_R, life: 1.0 });
              sfx('charge');
            } else {
              e.patternKind = 'summon';
              e.patternT = 0.4;
              spawnEnemy(Math.max(40, e.x - 90));
              spawnEnemy(Math.min(stg.width - 40, e.x + 90));
              core.emit('toast', '👥 관문 대장이 병력을 불렀다!');
              sfx('boss');
            }
          }
        }
      }
      /* 쏘는 적 — **사거리에 들면 멈춰서 쏜다.** 붙어서 때리는 적과 달리
         거리를 두고 버티므로, 이쪽이 다가가거나 기탄으로 받아쳐야 한다. */
      var holding = false;
      if (e.ranged && !e.boss) {
        e.shotCd -= dt;
        var flat = Math.abs((p.y + P_H) - (e.y + e.h)) < 64;
        var far = Math.abs(dx);
        if (flat && far < e.ranged.range) {
          e.dir = dx > 0 ? 1 : -1;
          if (far > REACH * 1.2) { holding = true; }     // 사거리 안이면 다가오지 않는다
          if (e.shotCd <= 0) {
            e.shotCd = e.ranged.cd * (0.8 + Math.random() * 0.4);
            e.atkAnim = ATK_ANIM_DUR;
            run.eshots.push({
              x: e.x + e.w / 2 + e.dir * 16, y: e.y + e.h * 0.42,
              dir: e.dir, spd: e.ranged.spd, dmg: Math.round(e.dmg * e.ranged.mul),
              kind: e.ref.look.weapon, life: 2.4
            });
            fx.push({ t: 'aim', x: e.x + e.w / 2, y: e.y, life: 0.22 });
            sfx('aim');
          }
        }
      } else if (e.role === 'magic' && !e.boss) {
        /* 마법형(PLAN 13절) — 원거리형과 달리 **높이(flat)를 안 가린다**.
           대신 구슬이 느리게 날며 쫓아온다(update() 아래 eshots 루프의
           homing) — 다가오지 못하게 막는 게 아니라 자리를 옮겨야 피한다 */
        e.shotCd -= dt;
        var farM = Math.abs(dx);
        if (farM < MAGIC_RANGE) {
          e.dir = dx > 0 ? 1 : -1;
          if (farM > REACH * 1.2) { holding = true; }
          if (e.shotCd <= 0) {
            e.shotCd = MAGIC_CD * (0.8 + Math.random() * 0.4);
            e.atkAnim = ATK_ANIM_DUR;
            run.eshots.push({
              x: e.x + e.w / 2 + e.dir * 16, y: e.y + e.h * 0.42,
              dir: e.dir, spd: MAGIC_SPD, dmg: Math.round(e.dmg * MAGIC_DMG_MUL),
              kind: 'magic', homing: true, life: 2.6
            });
            fx.push({ t: 'aim', x: e.x + e.w / 2, y: e.y, life: 0.22 });
            sfx('aim');
          }
        }
      }
      e.x += (holding ? 0 : e.dir * e.spd * (near ? 1.25 : 0.7) * chargeMul * (e.slowT > 0 ? 0.6 : 1)) * dt;
      /* 밀린 만큼 미끄러지고 곧 잦아든다 — 맞는 동안은 못 붙는다는 뜻이기도 하다 */
      if (e.kx) {
        e.x += e.kx * dt;
        e.kx *= Math.max(0, 1 - dt * 9);
        if (Math.abs(e.kx) < 4) { e.kx = 0; }
      }
      if (e.x < 20) { e.x = 20; e.dir = 1; e.kx = 0; }
      if (e.x > stg.width - 40) { e.x = stg.width - 40; e.dir = -1; e.kx = 0; }
      e.cd -= dt;
      if (overlap({ x: p.x, y: p.y, w: P_W, h: P_H }, e) && e.cd <= 0) {
        e.cd = 1.0;
        e.atkAnim = ATK_ANIM_DUR;
        hurtMe(e.dmg);
        if (!run) { return; }
      }
    }

    /* 떨어진 것 — 잠깐 튀었다가 내려앉고, 밟으면 줍는다 */
    for (i = run.drops.length - 1; i >= 0; i--) {
      var d = run.drops[i];
      d.vy += GRAV * 0.6 * dt;
      d.y += d.vy * dt;
      if (d.y > stg.floor - 12) { d.y = stg.floor - 12; d.vy = 0; }
      if (Math.abs((d.x) - (p.x + P_W / 2)) < 40 && Math.abs(d.y - (p.y + P_H)) < 60) {
        if (d.kind === 'potion') {
          st().potions += d.n;
          sfx('potion');
          core.emit('toast', '🧪 탕약 +' + d.n);
        } else if (d.kind === 'gear' || d.kind === 'scroll') {
          var GG = global.DG.gear;
          if (GG) {
            if (d.kind === 'gear') {
              var made = GG.make(d.key);
              /* 가방이 가득 차면 **줍지 못하고 그대로 남는다** — 원작의 그 답답함이다 */
              if (!GG.put(made)) { sfx('bagfull'); continue; }
              run.gearFound += 1;   // 세션 카드(§5-6) — 실제로 주운 것만(가방 가득 차 못 주우면 안 잰다)
              /* 고유(固有)는 소리부터 다르다 — 원작에서 유니크가 그렇다 */
              sfx(d.uniq ? 'uniq' : 'gear');
              core.emit('toast', (d.uniq ? '⭐ 고유 · ' : '📦 ') + GG.nameOf(made));
              if (d.uniq) { core.log('⭐ 고유 장비를 주웠다 — ' + GG.nameOf(made), 'good'); }
              fx.push({ t: 'itempop', x: p.x + P_W / 2, y: p.y, emoji: d.uniq ? '⭐' : '📦',
                        text: GG.nameOf(made), life: ITEMPOP_DUR });
            } else {
              GG.addScroll(d.key, 1);
              sfx('scroll');
              var scrollName = global.DG.gearData.scroll(d.key).name;
              core.emit('toast', '📜 ' + scrollName);
              fx.push({ t: 'itempop', x: p.x + P_W / 2, y: p.y, emoji: '📜', text: scrollName, life: ITEMPOP_DUR });
            }
          }
        }
        if (d.kind === 'gold') { sfx('gold'); }
        run.drops.splice(i, 1);
      }
    }

    /* 채집 보너스 지역(PLAN 11절) — 이 구간 안에서만 아래 채집이 FORAGE_MUL배
       나온다. 처음 들어선 순간에만 한 번 알린다(보물상자의 "opened"와 같은
       한 번뿐 패턴) */
    var px = p.x + P_W / 2;
    var inForage = !!(run.forage && px >= run.forage.x1 && px <= run.forage.x2);
    if (inForage && !run.forage.notified) {
      run.forage.notified = true;
      core.emit('toast', '🍀 채집이 넘치는 곳이다!');
    }

    /* 필드 채집(PLAN 10절) — 정지 오브젝트라 밟는 판정만 있으면 된다.
       가방과 달리 칸이 안 차므로(카운터라서) 늘 다 줍는다 */
    for (i = 0; i < run.gathers.length; i++) {
      var g = run.gathers[i];
      if (!g.alive) {
        if (Date.now() >= g.respawnAt) { g.alive = true; }
        continue;
      }
      if (Math.abs(g.x - px) < GATHER_R) {
        g.alive = false;
        g.respawnAt = Date.now() + GATHER_RESPAWN * 1000;
        var s = st();
        var gain = inForage ? FORAGE_MUL : 1;
        s.mats[g.kind] = (s.mats[g.kind] || 0) + gain;
        var GD = SD.GATHERS[g.kind];
        sfx('coin');
        core.emit('toast', GD.emoji + ' ' + GD.name + ' +' + gain + (inForage ? ' 🍀' : ''));
        core.emit('side:gather', { kind: g.kind, stage: run.stage.key, bonus: inForage });
      }
    }

    /* 보물상자(PLAN 11절) — 한 판에 하나뿐이라 열면 그걸로 끝, 다음 판에
       다시 뽑는다(buildChest). 드랍처럼 튀지 않고 제자리에 서 있다 */
    if (run.chest && !run.chest.opened && Math.abs(run.chest.x - (p.x + P_W / 2)) < CHEST_R) {
      run.chest.opened = true;
      var cgold = Math.round((40 + stg.enemyLv * 12) * (0.8 + Math.random() * 0.6) * GAIN_GOLD);
      run.gold += cgold;
      var GG2 = global.DG.gear, GD2 = global.DG.gearData, gotItem = null;
      if (GG2 && GD2) {
        var made = GG2.make(core.pick(GD2.poolFor(stg.enemyLv)).key);
        if (GG2.put(made)) { gotItem = made; } else { sfx('bagfull'); }
      }
      sfx('gear');
      core.emit('toast', '💰 보물상자! 🪙+' + cgold + (gotItem ? ' · 📦 ' + GG2.nameOf(gotItem) : ''));
      if (gotItem) {
        fx.push({ t: 'itempop', x: p.x + P_W / 2, y: p.y, emoji: '📦', text: GG2.nameOf(gotItem), life: ITEMPOP_DUR });
      }
    }

    /* 몬스터 습격(PLAN 11절) — 매복 지점을 지나면 그 자리 근처에 잡졸이
       한꺼번에 여럿 나타난다. 상자처럼 한 판에 한 번뿐이다(triggered) */
    if (run.ambush && !run.ambush.triggered && Math.abs(run.ambush.x - px) < AMBUSH_R) {
      run.ambush.triggered = true;
      for (var ai = 0; ai < AMBUSH_COUNT; ai++) {
        var aOff = (ai - (AMBUSH_COUNT - 1) / 2) * AMBUSH_SPREAD;
        var aX = Math.max(60, Math.min(stg.width - 60, run.ambush.x + aOff));
        spawnEnemy(aX);
      }
      sfx('boss');
      core.emit('toast', '🚨 몬스터 무리가 덮쳤다!');
    }

    /* 미니보스(PLAN 11절) — 그 자리를 지나면 잡졸 하나가 크게 불려 나온다.
       한 판에 한 번뿐이다(triggered) */
    if (run.miniboss && !run.miniboss.triggered && Math.abs(run.miniboss.x - px) < MINI_R) {
      run.miniboss.triggered = true;
      var mb = spawnEnemy(run.miniboss.x, { hp: MINI_HP_MUL, dmg: MINI_DMG_MUL });
      if (mb) {
        sfx('boss');
        core.emit('toast', '👹 미니보스 ' + mb.ref.name + ' 등장!');
      }
    }

    /* 이동 상인(PLAN 11절) — 마주치면 상점이 잠깐 싸진다. 자리를 옮기는 게
       아니라 core.save.player.merchantUntil 만 밀어 둔다(gear.js 가 읽는다) */
    if (run.merchant && !run.merchant.triggered && Math.abs(run.merchant.x - px) < MERCHANT_R) {
      run.merchant.triggered = true;
      core.save.player.merchantUntil = Date.now() + MERCHANT_DUR * 1000;
      sfx('gold');
      core.emit('toast', '🛒 지나가던 상인 — ' + MERCHANT_DUR + '초 동안 상점이 30% 싸집니다!');
    }

    /* NPC 구조(PLAN 11절) — 가까이 가면 지키던 잡졸이 나타나고, 다 잡으면
       사례금을 받는다. 잡는 것 자체는 보통 전투와 같아 별도 판정이 없다 —
       여기서는 "다 잡혔나"만 본다 */
    if (run.rescue && !run.rescue.spawned && Math.abs(run.rescue.x - px) < RESCUE_R) {
      run.rescue.spawned = true;
      for (var ri = 0; ri < RESCUE_COUNT; ri++) {
        var rOff = (ri - (RESCUE_COUNT - 1) / 2) * AMBUSH_SPREAD;
        var rX = Math.max(60, Math.min(stg.width - 60, run.rescue.x + rOff));
        var rg = spawnEnemy(rX);
        if (rg) { rg.guard = true; }
      }
      sfx('hurt');
      core.emit('toast', '😱 도적에게 붙잡힌 사람이 있다!');
    }
    if (run.rescue && run.rescue.spawned && !run.rescue.done) {
      var guardsLeft = run.enemies.filter(function (e) { return e.guard; }).length;
      if (guardsLeft === 0) {
        run.rescue.done = true;
        var rGold = Math.round((30 + stg.enemyLv * 10) * (0.8 + Math.random() * 0.4) * GAIN_GOLD);
        run.gold += rGold;
        sfx('gold');
        core.emit('toast', '🙏 구해줘서 고맙다며 사례금을 줬다 · 🪙+' + rGold);
      }
    }

    /* 마을 사람끼리의 잡담 — 사냥터엔 없고, 마을(town:true)에서만, 그것도
       대화창을 열어 놓은 동안엔 겹치지 않게 쉰다 */
    if (stg.town && run.npcs.length >= 2 && !run.talk) {
      run.chatCd -= dt;
      if (run.chatCd <= 0) {
        run.chatCd = CHAT_EVERY * (0.7 + Math.random() * 0.6);
        if (Math.random() < CHAT_CHANCE) {
          var a = core.pick(run.npcs), b;
          do { b = core.pick(run.npcs); } while (b === a);
          var topic = core.pick(SD.NPC_CHAT);
          var lineA = topic[0].replace('{town}', stg.name);
          var lineB = topic[1].replace('{town}', stg.name);
          sfx('talk');
          core.emit('toast', '💬 ' + a.name + ': "' + lineA + '"');
          core.log('💬 ' + a.name + ': "' + lineA + '" / ' + b.name + ': "' + lineB + '"', 'info');
        }
      }
    }

    /* 전직 4차 상시 잔상(§6 "성장 가시화") — §5-7 dash 잔상과 **같은 fx('ghost')
       를 그대로 재사용한다**(새 그림 없음, 화면 층 `side-view.js`가 2D·3D
       양쪽에 이미 그리는 오버레이라 여기선 fx만 심으면 된다). 걷거나 뛰는
       동안만(p.vx·p.onGround) 터울을 두고 심어 "따라오는 잔상"으로 보이게
       하고, 가만히 서 있을 땐 안 심는다(정지 중 겹쳐 보이면 잔상이 아니라 얼룩이다). */
    var J2 = global.DG.job, jobCur = J2 && J2.cur ? J2.cur() : null;
    if (jobCur && jobCur.tier >= 4 && p.vx && p.onGround) {
      p.tier4GhostT = (p.tier4GhostT || 0) - dt;
      if (p.tier4GhostT <= 0) {
        p.tier4GhostT = TIER4_GHOST_INT;
        fx.push({ t: 'ghost', x: p.x + P_W / 2, y: p.y + P_H, life: 0.22 });
      }
    }

    /* 연출 수명 */
    for (i = fx.length - 1; i >= 0; i--) {
      fx[i].life -= dt;
      if (fx[i].life <= 0) { fx.splice(i, 1); }
    }
    /* 죽는 몸짓 수명(위 kill() 참고) — death 몸짓이 다 돈 뒤에야 치운다 */
    for (i = run.dying.length - 1; i >= 0; i--) {
      run.dying[i].t += dt;
      if (run.dying[i].t >= run.dying[i].dur) { run.dying.splice(i, 1); }
    }
  }

  /* 화면이 읽는 요약.
     **사냥 중이든 쉬는 중이든 같은 칸을 준다** — 한쪽에만 있는 칸(stages 같은)을
     두면 시트를 사냥 중에 열었을 때 undefined 로 죽는다(실제로 그랬다). */
  function status() {
    var s = st();
    var base = {
      potions: s.potions, kills: s.kills || 0, deaths: s.deaths || 0,
      bosses: s.bosses || 0,
      stages: stages(), skills: [],
      /* 사냥 중이 아니어도 같은 칸을 준다 — 한쪽에만 있는 칸을 두면 시트가 죽는다 */
      boss: null, climbing: false, rope: false, gate: null, npc: null, talk: null,
      def: 0, resting: false
    };
    if (!run) {
      base.active = false;
      base.stage = SD.stage(s.stage);
      /* 쉬는 중은 실제로 다음 판을 pw.hp/pw.mp(가득 참)로 시작한다(enter() 참조) —
         그러니 여기서도 0/0 이 아니라 가득 찬 값을 준다. 캐릭 정보 카드가 이 값을
         상시 띠로 보여 준다(예전에는 사냥 중에만 뜨는 #hud 안에만 있어 쉬는 동안
         에너지(기력)를 볼 수가 없었다) */
      var pw = power();
      base.hp = pw.hp; base.hpMax = pw.hp; base.mp = pw.mp; base.mpMax = pw.mp;
      base.gold = 0; base.enemies = 0; base.brace = false;
      base.atk = pw.atk; base.def = pw.def;
      return base;
    }
    var skills = [], i, list = barSkills();
    for (i = 0; i < list.length; i++) {
      var sk = list[i];
      skills.push({
        key: sk.key, name: sk.name, emoji: sk.emoji, desc: sk.desc, cost: sk.cost,
        lv: lvOf(sk), max: sk.max || 0,
        cd: Math.max(0, run.player.cds[i] || 0), cdMax: sk.cd,
        ready: (run.player.cds[i] || 0) <= 0 && run.mp >= sk.cost
      });
    }
    base.attackIdx = attackIndexOf(list);
    base.active = true;
    base.stage = run.stage;
    base.hp = Math.max(0, Math.round(run.hp));
    base.hpMax = run.hpMax;
    base.mp = Math.round(run.mp);
    base.mpMax = run.mpMax;
    base.gold = Math.round(run.gold);
    base.kills = run.kills;                 // 이 판에서 잡은 수 (누적은 state().kills)
    base.skills = skills;
    base.brace = braceOn();
    base.enemies = run.enemies.length;
    base.atk = Math.round(atkOf());
    base.def = power().def;
    base.party = global.DG.party ? global.DG.party.brief() : null;   // 동료 교대(§5-8) HUD
    base.dodge = { cd: Math.max(0, run.player.dodgeCd), cdMax: DODGE_COOL,
      ready: run.player.dodgeCd <= 0 };
    /* 고유 조작(§5-1) — 회피 단추의 "길게 누름" 게이지가 이 값을 본다.
       job.js signature() 가 없으면(무명) hasSig 가 거짓이라 게이지가 안 뜬다. */
    var J1 = global.DG.job, sig1 = J1 && J1.signature ? J1.signature() : null;
    base.hold = {
      hasSig: !!sig1, holding: !!run.player.holding, t: run.player.holdT || 0,
      thresh: sig1 ? sig1.hold : 0.18, armed: !!run.player.holdArmed,
      sigCd: Math.max(0, run.player.sigCd || 0), sigCdMax: sig1 ? sig1.cd : 0,
      sigReady: (run.player.sigCd || 0) <= 0 && run.mp >= (sig1 ? sig1.cost : 1e9)
    };
    /* 줄·문·마을 사람 — 조작 띠가 '↑' 를 언제 띄울지 이 넷으로 정한다 */
    base.climbing = !!run.player.climb;
    base.resting = run.player.resting > 0.4;
    base.rope = !!ropeAt(run.player.x + P_W / 2, run.player.y + P_H);
    var g = portalAt(run.player.x + P_W / 2);
    base.gate = g ? { to: g.to, name: g.ref.name, open: unlocked(g.to), need: g.ref.need } : null;
    var n = npcAt(run.player.x + P_W / 2);
    base.npc = n ? { key: n.key, name: n.name } : null;
    base.talk = run.talk ?
      { name: run.talk.name, emoji: run.talk.emoji, text: run.talk.text, shop: !!run.talk.shop } : null;
    if (run.boss) {
      base.boss = {
        name: run.boss.ref.name,
        hp: Math.max(0, Math.round(run.boss.hp)), hpMax: run.boss.hpMax,
        charging: run.boss.charge > 0
      };
      if (run.boss.gate) {
        base.boss.gate = true;
        base.boss.timeLeft = Math.max(0, run.gateT || 0);
        base.boss.enraged = !!run.boss.enraged;
        base.boss.shieldBroken = !!run.boss.gateShieldBroken;
        base.boss.shieldPct = run.boss.gateShieldBroken ? 1 :
          Math.min(1, (run.boss.gateShieldHp || 0) / (run.boss.hpMax * GATE_SHIELD_FRAC));
        base.boss.vulnT = Math.max(0, run.boss.gateVulnT || 0);
      }
    }
    return base;
  }

  /* 레벨업·사명 완료 배너(PLAN 35절) — 둘 다 core 쪽(core.gainExp·quest.turnIn)에서
     쏘는 이벤트라 여기서 core.on 으로 받는다. 화면이 안 떠 있을 때(run 없음) 밀어
     넣으면 다음에 사냥터에 들어가서야 뒤늦게 뜨니, **지금 사냥 중일 때만** 받는다. */
  core.on('levelup', function (lv) {
    if (!run) { return; }
    fx.push({ t: 'levelup', lv: lv, life: LEVELUP_DUR });
  });
  core.on('questdone', function (name) {
    if (!run) { return; }
    fx.push({ t: 'questdone', name: name, life: QUESTDONE_DUR });
  });

  global.DG = global.DG || {};
  global.DG.side = {
    GRAV: GRAV, SPEED: SPEED, P_W: P_W, P_H: P_H, REACH: REACH, CLIMB: CLIMB,
    enter: enter, leave: leave, resume: resume, active: active, update: update,
    setInput: setInput, jump: jump, dodge: dodge, castSkill: castSkill, drink: drink,
    holdStart: holdStart, holdEnd: holdEnd, cancelHold: cancelHold,
    travel: travel, useUp: useUp, useDown: useDown, dropThrough: dropThrough,
    grabRope: grabRope,
    ropeAt: ropeAt, portalAt: portalAt, npcAt: npcAt, talk: talk, closeTalk: closeTalk, letGo: letGo,
    power: power, unlocked: unlocked, stages: stages, barSkills: barSkills,
    bossReady: bossReady, bossLeft: bossLeft,
    gateInfo: gateInfo, challengeGate: challengeGate,
    /* 비경(§5-3)이 쓰는 곳 — 임시 방 갈아 끼우기·잡졸 소환·주 키 */
    placeIn: placeIn, spawnEnemy: spawnEnemy, weekKey: gateWeekKey, castSwap: castSwap,
    status: status, state: st, meRef: meRef,
    /** 화면 전용 — 상태를 직접 읽는다 (쓰지는 말 것) */
    raw: function () { return run; },
    baseHpOf: baseHpOf,
    fx: function () { return fx; }
  };
})(window);
