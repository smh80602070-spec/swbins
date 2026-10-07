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
      rift: riftSum, rank: global.DG.runRank ? global.DG.runRank.finish() : null   // W-0104 결과 등급
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

