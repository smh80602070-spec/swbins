/**
 * 던전 — 로그라이크 (방 단위 진행)
 * ---------------------------------------------------------------
 * 방치 전투(battle.js)와 완전히 별개의 축이다. 이쪽은 **직접 조작** 하고,
 * **죽으면 그 회차가 끝난다**. 그래서 두 축의 규칙을 섞지 않는다.
 *
 *   한 방       화면 하나. 적을 다 잡으면 문이 열린다
 *   문 선택     ⚔️전투 · 🎁보물 · 💧우물 · ⛩️사당 · 🪜계단 중에서 고른다
 *   층 클리어   계단으로 내려가면 은사(恩賜) 셋 중 하나를 고른다
 *   노획물      층을 내려갈 때 · 탈출할 때 확정된다. **죽으면 전부 잃는다**
 *
 * 부대의 힘을 그대로 쓴다 — 공격력은 battle.power().atk, 체력은 def 기반.
 * 그래서 인물을 키우고 장비를 맞추면 던전도 같이 깊어진다(계산이 두 갈래로 갈리지 않게).
 *
 * 화면(dungeon-view.js)은 이 상태를 **그리기만** 한다. 계산은 전부 여기서 한다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var DD = global.DG.dungeonData;

  /* §5.19 — 560×360(약 21×13m, 가로질러 3.4초)은 떼를 몰 자리가 없었다(사용자 "환경이 너무 좁아"). 700×440 — 넓이 1.5배.
     들판 진단("방보다 대여섯 배 넓다")이 700 까지 버틴다 */
  var ROOM_W = 700, ROOM_H = 440;       // 방의 논리 크기 (화면은 여기에 맞춰 늘린다)
  var WALL = 26;                        // 벽 두께
  var P_R = 13;                         // 플레이어 반지름
  var BASE_SPD = 148;                   // 이동 속도 (단위/초)
  var BASE_ATK_CD = 0.55;               // 공격 간격 (초)
  var BASE_REACH = 34;                  // 공격 사거리
  var ENEMY_CD = 1.15;                  // 적 공격 간격
  /* 몬스터 다양화(PLAN 14절) — 궁수·조총병(`look.weapon` bow·staff)은 붙지
     않고 거리를 두고 쏜다. 보스는 따로 텔레그래프가 있는 특수 공격을 쓴다 —
     2026-09-05까지는 무기와 무관하게 전부 같은 강타 하나였다(PLAN 15절
     "보스 패턴" 미달). `look.weapon`으로 넷을 가른다(`bossPattern()` 참고) */
  var RANGED_STOP = 150;                // 이 거리에서 더 안 다가온다
  var RANGED_MAX = 260;                 // 이보다 멀면 아예 안 쏜다
  /* 어그로(2026-09-10, 사용자 요청) — PLAN 15절 "필수" 목록의 마지막 둘
     (어그로·추적) 중 남아 있던 절반. 그 전까지는 방에 들어서는 순간 방 안
     전부가 한꺼번에 달려왔다 — 이 사거리 안에 들어야 비로소 알아챈다.
     궁수·조총병은 더 멀리서 보고, 정예는 좀 더 예민하다(*1.15). 맞으면
     거리와 상관없이 무조건 깬다(`wakeEnemy`, `strike()`가 부른다) — "몰래
     지나칠 수는 있어도 몰래 때릴 수는 없다". */
  var AGGRO_RANGE = 230;                // 잡졸이 알아채는 거리
  var AGGRO_RANGE_RANGED = 300;         // 활·조총은 더 멀리서 본다
  var AGGRO_PACK_R = 110;               // 하나가 깨면 이 거리 안의 동료도 같이 깬다
  var SLAM_WARN = 0.7;                  // club — 강타 예고 시간(초)
  var SLAM_RANGE = 110;                 // club — 강타 반경
  var SLAM_MUL = 1.8;                   // club — 강타 배율(평타 대비)
  var CHARGE_WARN = 0.55;               // axe — 돌진 예고 시간(초)
  var CHARGE_STEP = 90;                 // axe — 예고가 끝나면 이만큼 순간 다가선다
  var CHARGE_MUL = 1.6;                 // axe — 돌진 적중 배율
  var THRUST_WARN = 0.5;                // spear·halberd — 관통 예고 시간(초)
  var THRUST_RANGE = 170;               // spear·halberd — 정면으로 닿는 사거리(평타보다 훨씬 길다)
  var THRUST_HALF = 0.5;                // spear·halberd — 부채꼴 반각(라디안, 약 29도)
  var THRUST_MUL = 1.5;                 // spear·halberd — 관통 배율
  var FLURRY_WARN = 0.4;                // sword — 연환격 예고 시간(초)
  var FLURRY_HITS = 3;                  // sword — 예고 뒤 잇달아 베는 횟수
  var FLURRY_GAP = 0.22;                // sword — 매 베기 사이 간격(초)
  var FLURRY_MUL = 0.7;                 // sword — 베기 한 번당 배율(셋 합쳐 강타 급)
  /* §5.19 몰이 사냥(2026-09-24, 사용자 "몰이 사냥을 할 수가 없어 · 환경이 너무 좁아 · 오브젝트가 너무 많아 ·
     모션이 필요해 · 왜 하는지 모를 정도"). 넷 다 손잡이 — 0 이면 옛 동작 그대로 */
  function PACK_N() { return Math.max(0, Math.round(core.tuned('dg.pack', 2))); }     // 전투방 잡졸 하나마다 붙는 졸개 수
  var PACK_CAP = 30;                                                                  // 전투방 적 상한(무리 포함)
  function CLEAVE_ON() { return core.tuned('dg.cleave', 1) ? true : false; }         // 평타·강공격 휩쓸기
  var CLEAVE_HALF = Math.PI / 3;        // 평타 부채꼴 반각(120°)
  var CLEAVE_R = 1.35;                  // 평타 휩쓸기 반경 = 사거리 × 이것
  var CLEAVE_MUL = 0.6;                 // 곁에 맞은 적은 이만큼
  var HEAVY_HALF = Math.PI / 2;         // 강공격은 앞 반원(180°)
  var HEAVY_R = 1.8;
  var HEAVY_SIDE = 0.75;
  function STAGGER() { return core.tuned('dg.stagger', 0.25); }                      // 맞으면 적 공격이 이만큼 밀린다(초)
  function FIELD_CAP() { return Math.max(1, Math.round(core.tuned('dg.fieldCap', 18))); }
  /* §5.19 2차 — 원뿔 무예(swing 에 `arc`)·끌어당기기(nova·curse 에 `pull`)·쓰러짐 흩어짐. 셋 다 손잡이, 0 이면 옛 동작 */
  function CONE_ON() { return core.tuned('dg.cone', 1) ? true : false; }             // 0 이면 arc 무예도 옛 회전참(둘레 전부)
  function PULL_ON() { return core.tuned('dg.pull', 1) ? true : false; }
  var PULL_SEC = 0.3;                   // 끌려오는 시간(초)
  var PULL_SPD = 620;                   // 끌려오는 빠르기(단위/초) — 0.3초면 반경 150 을 다 당긴다
  function SCATTER() { return core.tuned('dg.scatter', 1); }                         // 쓰러짐 흩어짐 세기(0 = 1차의 곧은 날림)
  var MP_MAX = 100;                     // 기력 최대치
  var MP_REGEN = 7;                     // 기력 자연 회복 (초당)
  var MP_ON_KILL = 9;                   // 적을 잡으면 기력 회복

  /**
   * 스킬 — 원작식 4버튼. 기력(MP)을 쓰고 쿨다운을 기다린다.
   * 수치는 전부 atkOf()(한 타) 배율이라 부대가 강해지면 스킬도 같이 강해진다.
   */
  /* 스킬 넷을 여기 박아 두던 표는 **2026-08-26 에 무예(武藝)로 옮겼다** —
     직업마다 아홉씩 마흔다섯이 되었고, 어느 넷을 손에 드는지는 사람이 고른다
     (data-skill.js · skill.js). 이 상수는 "칸이 넷" 이라는 사실만 남긴다. */
  var SKILL_SLOTS = 4;
  var RALLY_SEC = 6;

  var run = null;                       // 진행 중인 회차 (없으면 null)
  var input = { dx: 0, dy: 0 };         // 키보드 입력
  var target = null;                    // 클릭 이동 목표 {x, y}
  var fx = [];                          // 연출용 (화면이 읽는다)

  /**
   * 소리 한 마디 (sfx.js). fx 와 같은 자리에서 부른다 —
   * **판정은 여기서 끝나고, 보이는 것과 들리는 것은 곁가지**라는 뜻이다.
   * 소리 모듈이 없어도 게임은 그대로 돈다.
   */
  function sfx(k, o) {
    var S = global.DG.sfx;
    if (S) { S.play(k, o); }
  }

  /* ── 손맛 2차(§5.8, 2026-09-18) — 설정 손잡이 ───────────────
   * PLAN §5.8 "UI·조작" 은 딱 둘만 준다 — 화면 흔들림 0~2, 타격 정지
   * on/off. 소리·플래시·숫자 팝은 이 손잡이의 대상이 아니다(소리는
   * 이미 자기 on/off 가 있다, snd-toggle). */
  function hitstopEnabled() {
    var s = core.save && core.save.settings;
    return !s || s.hitstop !== false;   // 기본 true
  }
  /* 화면 흔들림 배율(shakeMul)은 이 파일이 그림을 안 그려서 안 쓴다 —
     `dungeon-view.js`·`fx3d.js` 가 각자 렌더 자리에서 `core.save.settings.shake`
     를 직접 읽는다(같은 공식, 중복 정의). */

  /* ── 타격음 3종 라운드로빈 + 무기 look 결(§5.8①) ────────────
   * 콤보 수로 순서를 돌린다(같은 무기를 연달아 때려도 매번 같은 소리가
   * 안 나게) — `run.combo` 는 strike() 가 이미 매 타격마다 올린다.
   * 무기 look 은 sfx.js `play()` 의 opts.lpMul 로 저역통과 주파수만
   * 밀어 밝고 어두운 인상을 가른다 — 도검·활은 위로(더 쨍하게), 둔기는
   * 아래로(더 둔탁하게), 기공류(부채·지팡이·붓·병서)는 중간. */
  var HIT_CUES = ['hit1', 'hit2', 'hit3'];
  var WEAPON_LP_MUL = {
    sword: 1.3, guandao: 1.15, axe: 1.1, halberd: 1.15, spear: 1.2,
    club: 0.55,
    bow: 1.35,
    fan: 0.9, staff: 0.9, brush: 0.9, scroll: 0.9
  };
  function hitSfx() {
    var idx = (run.combo || 0) % HIT_CUES.length;
    var IT = global.DG.item, w = IT ? IT.equipped(leadId()).weapon : null;
    var look = (w && !IT.isBroken(w)) ? ((IT.baseOf(w) || {}).look) : null;
    sfx(HIT_CUES[idx], { lpMul: WEAPON_LP_MUL[look] || 1 });
  }

  /** §5.8③ 성장 가시화 — 지금 무기 등급(0~4, 없으면 -1). `data-item.js`
   *  `TIERS` 인덱스 그대로(3=보물·4=전설, §5.1 카드 테두리색과 같은 표). */
  function weaponTierOf() {
    var IT = global.DG.item, w = IT ? IT.equipped(leadId()).weapon : null;
    return (w && !IT.isBroken(w)) ? IT.tierOf(w).key : -1;
  }

  /* ── 은사 값 ─────────────────────────────────────────── */

  /**
   * 지금 회차의 은사 합 (없는 키는 0).
   * **선두의 상시 무예도 여기서 더한다** — dungeon.js 의 수치(공격력·체력·사거리·
   * 손 속도·받는 피해)가 전부 이 함수를 거치므로, 한 곳만 얹으면 다 따라온다.
   * 회차 밖에서도 물어볼 수 있게 run 이 없을 때는 무예만 돌려준다.
   */
  function boonVal(key) {
    var skl = global.DG.skill;
    var pass = skl ? skl.passive(leadId(), key) : 0;
    if (!run) { return pass; }
    var sum = pass, k;
    for (k in run.boons) {
      if (!Object.prototype.hasOwnProperty.call(run.boons, k)) { continue; }
      var b = DD.boonByKey(k);
      if (b && b.eff[key]) { sum += b.eff[key] * run.boons[k]; }
    }
    /* 잠깐 걸어 둔 무예(사기·광분·호신강기…) — 시간이 지나면 저절로 사라진다 */
    if (run.buffs && run.buffs[key] && run.buffs[key].t > 0) { sum += run.buffs[key].v; }
    return sum;
  }

  /** 잠깐짜리 버프를 건다 (같은 결이면 센 쪽이 남는다) */
  function addBuff(key, v, sec) {
    if (!run) { return; }
    if (!run.buffs) { run.buffs = {}; }
    var cur = run.buffs[key];
    if (!cur || cur.v <= v) { run.buffs[key] = { v: v, t: sec }; }
    else { cur.t = Math.max(cur.t, sec); }
  }

  /** core.effect() 훅 — 은사 중 '전역' 성격인 것만 내보낸다 */
  function boonEffect() {
    if (!run) { return {}; }
    var find = boonVal('worldFindPct');
    return find ? { findPct: find } : {};
  }

  /* ── 부대에서 끌어오는 수치 ───────────────────────────── */

  function partyPower() {
    return global.DG.hero.partyPower();
  }

  function hpMaxOf() {
    var p = partyPower();
    return Math.max(30, Math.round(p.def * 3 * (1 + boonVal('hpPct') / 100)));
  }

  function atkOf() {
    var p = partyPower();
    return Math.max(4, p.atk * (1 + boonVal('atkPct') / 100) / 6);   // 한 타 기준으로 나눈다
  }

  function reachOf() { return BASE_REACH * (1 + boonVal('reachPct') / 100); }
  function spdOf() { return BASE_SPD * (1 + boonVal('moveSpdPct') / 100); }
  function atkCdOf() { return BASE_ATK_CD / (1 + boonVal('atkSpdPct') / 100); }

  /* ── 적 ───────────────────────────────────────────────── */

  /* 회귀(회차 — scenario.js roundFoe/roundGain, PLAN §5.21) 배율 — 1회차·옛 세이브는 1 */
  function RF() { var S = global.DG.scenario; return S && S.roundFoe ? S.roundFoe() : 1; }
  function RG() { var S = global.DG.scenario; return S && S.roundGain ? S.roundGain() : 1; }

  function enemyHp(floor, boss) {
    return Math.round(24 * Math.pow(1.26, floor - 1) * (boss ? 7 : 1) * mode().hp * nmMul() * RF());
  }
  function enemyDmg(floor, boss) {
    return Math.round(5 * Math.pow(1.20, floor - 1) * (boss ? 2.2 : 1) * mode().dmg * nmMul() * RF());
  }

  /**
   * data-enemy.js 의 적을 층에 맞게 하나 고른다.
   * 관문(stage) 기준 풀을 그대로 재사용한다 — 던전 층 ≈ 관문 난이도로 본다.
   * @param biome PLAN §60 "지역마다 특색" — 마을 필드에서만 넘긴다(아래
   *   biomeOf 참고). 안 넘기면(던전 방 전부) 예전과 100% 같다.
   */
  function pickEnemyRef(floor, boss, biome, regionKey) {
    var ed = global.DG.enemyData;
    if (!ed) { return { name: '적', kind: 'beast', form: 'quad', color: '#8a7a6a' }; }
    /* 지역 명단(§5.13) — 들판 ctx.region 이 있으면 그 지역 몬스터만 */
    var WM = global.DG.worldMap, rg = regionKey && WM ? WM.byKey(regionKey) : null;
    var pool = ed.poolFor(floor, !!boss, biome, rg ? rg.roster : null);
    /* 세 시대(§5.20 · SAGA-DESIGN §13) — 들판 잡졸의 몫(`dg.eraMix`, 기본 0.4)은 그 지역 시대가 **아닌** 쪽에서.
       현대·미래는 제 몸 가진 시대 적(`eraPoolFor`), 과거는 중원 벌판 명단. 보스·던전 방은 그대로 */
    var mix = rg && !boss && ed.eraPoolFor ? ERA_MIX() : 0;
    if (mix > 0 && Math.random() < mix) {
      var alt = eraAltPool(floor, rg, WM, ed);
      if (alt.length) { return core.pick(alt); }
    }
    return core.pick(pool);
  }
  function ERA_MIX() { return Math.max(0, Math.min(1, core.tuned('dg.eraMix', 0.4))); }
  /** 이 지역 시대가 아닌 쪽의 풀 — 지역 era 에 없는 과거·현대·미래(신화 지역은 셋 다) */
  function eraAltPool(floor, rg, WM, ed) {
    var home = rg.era || [], other = ['past', 'modern', 'future'].filter(function (e) { return home.indexOf(e) < 0; });
    var alt = ed.eraPoolFor(floor, other);
    if (other.indexOf('past') >= 0) {
      var jw = WM.byKey('jungwon');
      if (jw && jw.key !== rg.key) { alt = alt.concat(ed.poolFor(floor, false, null, jw.roster)); }
    }
    return alt;
  }
  function regionOf(ctx) { return (ctx && ctx.region) || null; }
  /** 진단용 — 이 지역 들판에서 시대 몫으로 뽑힐 수 있는 풀 */
  function eraAltPoolFor(floor, regionKey) {
    var ed = global.DG.enemyData, WM = global.DG.worldMap, rg = WM && WM.byKey(regionKey);
    return ed && rg ? eraAltPool(floor, rg, WM, ed) : [];
  }

  /** ctx.theme.biome(`town:forest` 등)에서 `town:` 접두를 뗀다 — 던전
   *  방(ctx 없음)이면 null, poolFor가 그대로 예전 동작으로 되돌아간다. */
  function biomeOf(ctx) {
    var b = ctx && ctx.theme && ctx.theme.biome;
    if (!b) { return null; }
    var i = b.indexOf(':');
    return i >= 0 ? b.slice(i + 1) : b;
  }

  /* ── 정예(精銳) — 원작의 파란/노란 이름 몬스터 ───
   * 잡졸 중 일부가 접두(接頭)를 하나 달고 나온다. 색이 다르고, 이름 앞에 말이 붙고,
   * 규칙이 하나 달라진다. 잡으면 **장비가 확정으로 떨어진다**(원작과 같다).
   */
  var ELITES = [
    { key: 'swift', name: '날쌘', color: '#6ad9e0', spd: 1.9, cd: 0.55,
      desc: '움직임과 손이 빠르다' },
    { key: 'tough', name: '완강한', color: '#8a9ab2', hp: 2.6,
      desc: '좀처럼 쓰러지지 않는다' },
    { key: 'fierce', name: '사나운', color: '#e06565', dmg: 1.9,
      desc: '한 대가 아프다' },
    { key: 'regen', name: '되살아나는', color: '#7ec96a', regen: 0.035,
      desc: '피가 계속 아문다' },
    { key: 'thorn', name: '가시 돋친', color: '#c98ae0', thorn: 0.22,
      desc: '때리면 되받아친다' },
    { key: 'shade', name: '그림자', color: '#9a7ad9', split: 2,
      desc: '쓰러지면 분신 둘이 남는다' },
    /* 원작의 'Magic Resistant' 자리 — 결 하나가 잘 안 통한다 */
    { key: 'plated', name: '철갑 두른', color: '#9aa3b2', resist: { phys: 35 },
      desc: '칼이 잘 안 든다 (기공파를 쓴다)' },
    { key: 'warded', name: '호신 두른', color: '#6ad9e0', resist: { chi: 45 },
      desc: '기가 잘 안 통한다 (칼로 벤다)' }
  ];

  /* ── 저항(抵抗) ────────────────────────────────────────────
   * 원작에서 "이놈은 불이 안 통한다" 를 아는 순간 손이 바뀐다.
   * 이 판에는 원소가 없어 **때리는 두 결**로 갈랐다 —
   *   물리(物理) 평타·회전참·돌진 · 기(氣) 기공파.
   * 상한은 75% 다. **면역은 두지 않는다** — 원작의 면역은 스킬이 여덟일 때
   * 성립하는 장치인데, 이 판은 넷이고 기(氣)는 하나뿐이라 물리 면역이 뜨면
   * 재냉각만 기다리게 된다.
   */
  var RESIST_CAP = 75;

  /** 선두(부대 첫 인물) — 원작의 인물 하나에 해당하는 자리 */
  function leadId() { return core.save.party[0] || null; }

  /** 자가진단 전용(§5.1 세계 축 검증) — 실제 장비 세공과 무관하게 원소
   *  배합을 강제한다. `null`이면 해제(실제 장비 값으로 되돌아간다). 시각·
   *  장비 의존 값을 진단에서 붙드는 다른 판의 `weather.force()`와 같은 결. */
  var forcedElemDmg = null;
  /** 자가진단 전용(§5.8① hitstop 3단 검증, 2026-09-18) — 크리 여부를
   *  강제한다. `null`이면 해제(실제 확률로 되돌아간다). 위 `forcedElemDmg`
   *  와 같은 결 — 크리는 `Math.random()` 이라 결정적 진단이 안 됐다. */
  var forcedCrit = null;
  /** 지금 무기에 박힌 원소 피해 { fire: n, … } */
  function elemDmgOf() {
    if (forcedElemDmg) { return forcedElemDmg; }
    var id = leadId();
    return id ? global.DG.item.elemDamage(id) : {};
  }

  /** 지금 갑주에 박힌 원소 저항 (백분율, 상한 75) */
  function elemResOf(el) {
    var id = leadId();
    if (!id) { return 0; }
    var r = global.DG.item.elemResist(id);
    /* 기수련(氣修) 같은 상시 무예는 **모든 결**에 붙는다 */
    return core.clamp((r[el] || 0) + boonVal('allResPct'), 0, RESIST_CAP);
  }

  function resistOf(e, kind) {
    var n = 0;
    if (e.ref && e.ref.resist && e.ref.resist[kind]) { n += e.ref.resist[kind]; }
    var el = e.elite ? eliteOf(e.elite) : null;
    if (el && el.resist && el.resist[kind]) { n += el.resist[kind]; }
    /* 난도가 오르면 조금 더 버틴다 (원작에서 헬의 내성이 더 높은 그 감각) */
    n += (mode().resist || 0);
    /* 부적 '수호' 변형자(§5.3) — 부적이 지정한 결에만 +40(applyElem이
       kind 자리에 원소 키를 그대로 넘겨 온다, resistOf는 phys·chi 뿐
       아니라 원소 키도 이미 받아 왔다) */
    if (run && run.nightmare && run.nightmare.resistElem === kind) { n += 40; }
    /* 세계 보스(§5.4) 갑주 부위 파괴 — 칼이 잘 들게 된다 */
    if (e.wbArmorBroken) { n -= 25; }
    return core.clamp(n, 0, RESIST_CAP);
  }

  function eliteOf(key) {
    for (var i = 0; i < ELITES.length; i++) { if (ELITES[i].key === key) { return ELITES[i]; } }
    return null;
  }

  /** 이 층에서 정예가 나올 확률 — 깊을수록 잦다. 부적 '군단' 변형자는
   *  두 배(§5.3) — 마지막 방(정예 무리)은 forceElite 로 이 자리를 안 탄다. */
  function eliteChance(floor) {
    var base = Math.min(0.30, 0.06 + floor * 0.012);
    return nmHasMod('elite2x') ? Math.min(0.6, base * 2) : base;
  }

  function spawnEnemy(floor, boss, opts) {
    opts = opts || {};
    /* 2026-09-08 — 무리(팩) 스폰(spawnFieldEncounters)이 팩 전체에 같은
       종류를 쓰려고 한 번 고른 ref를 그대로 물려준다 — 안 주면(옛 호출
       전부) 예전처럼 이 자리에서 새로 고른다, 회귀 없음. */
    var ref = opts.ref || pickEnemyRef(floor, boss);
    /* opts.hp/opts.dmg(2026-09-18, §5.4 월드 보스) — 세계 보스는 일반 보스
       공식(층 기반)이 아니라 자기만의 배율(HP ×8)을 쓴다. 안 주면(기존
       호출 전부) 예전 그대로 enemyHp/enemyDmg 가 굴린다 — 회귀 없음. */
    var hp = opts.hp !== undefined ? opts.hp : enemyHp(floor, boss);
    var dmg = opts.dmg !== undefined ? opts.dmg : enemyDmg(floor, boss);
    var r = boss ? 22 : 13;

    /* 정예 — 보스는 이미 특별하므로 붙이지 않는다. 분신에도 안 붙는다.
       `opts.forceElite` 는 정예 소굴(POI)이 "반드시 하나는 정예" 를 보장할 때
       쓴다 — 안 쓰면 옛 확률 그대로다(값 규약을 안 깬다) */
    var elite = null;
    if (!boss && !opts.spawned && (opts.forceElite || Math.random() < eliteChance(floor))) {
      elite = core.pick(ELITES);
      hp = Math.round(hp * (elite.hp || 1.35));
      dmg = Math.round(dmg * (elite.dmg || 1.15));
      r = 16;
    }
    if (opts.shade) {                    // 그림자의 분신 — 작고 약하다
      hp = Math.max(1, Math.round(hp * 0.34));
      dmg = Math.round(dmg * 0.6);
      r = 10;
    }

    // 플레이어와 겹치지 않게 방 오른쪽 절반에 흩어 놓는다
    return {
      x: opts.x !== undefined ? opts.x : ROOM_W * (0.45 + Math.random() * 0.42),
      y: opts.y !== undefined ? opts.y : WALL + P_R + Math.random() * (ROOM_H - WALL * 2 - P_R * 2),
      r: r,
      hp: hp, hpMax: hp, boss: !!boss,
      elite: elite ? elite.key : null,
      shade: !!opts.shade,
      dmg: dmg,
      cd: 0.6 + Math.random() * 0.8,
      ref: ref,
      phase: Math.random() * 6.28,
      hurt: 0,
      /* 어그로 — 보스·미니보스만 처음부터 깨어 있다(보스방은 들어가는
         순간이 곧 교전이다). 나머지는 사거리 안에 들거나 맞아야 깬다
         (아래 wakeEnemy). */
      aggro: !!boss
    };
  }

  /**
   * §5.19 몰이 사냥 — 전투방 잡졸 하나하나를 **무리의 우두머리**로 삼아 둘레에 졸개를 붙인다.
   * 자리·쿨·자세는 `core.hash2`(고정 입력) 로만 정한다 — `Math.random()` 을 한 번도 안 불러
   * 방 만들기의 난수 순서가 그대로다(PLAN §2.3 RNG 순번 함정). 졸개는 작고(반지름 10) 약하다
   * (체력 55%·피해 70%) — 떼로 몰아 한 번에 쓸어버리는 맛이지, 버티는 맛이 아니다. 정예·보스는 안 붙인다
   */
  function addPacks(room, index) {
    var K = PACK_N();
    if (!K) { return; }
    var lead = room.enemies.slice(), i, k;
    for (i = 0; i < lead.length && room.enemies.length < PACK_CAP; i++) {
      var L = lead[i];
      if (L.boss || L.elite || L.shade) { continue; }
      for (k = 0; k < K && room.enemies.length < PACK_CAP; k++) {
        var h1 = core.hash2(index * 97 + i * 31 + k, 7 + i * 13), h2 = core.hash2(i * 17 + k * 5, index * 53 + 3);
        var a = (k / K + h1 * 0.4) * Math.PI * 2, rr = 24 + h2 * 20;
        room.enemies.push({
          x: core.clamp(L.x + Math.cos(a) * rr, WALL + 12, ROOM_W - WALL - 12),
          y: core.clamp(L.y + Math.sin(a) * rr, WALL + 12, ROOM_H - WALL - 12),
          r: 10, hp: Math.max(1, Math.round(L.hpMax * 0.55)), hpMax: Math.max(1, Math.round(L.hpMax * 0.55)),
          boss: false, elite: null, shade: false, minion: true,
          dmg: Math.max(1, Math.round(L.dmg * 0.7)), cd: 0.6 + h1 * 0.8, ref: L.ref, phase: h2 * 6.28,
          hurt: 0, aggro: false
        });
      }
    }
  }

  /** 적의 표시 이름 — 정예는 접두가 붙는다 */
  function enemyName(e) {
    var base = (e.ref && e.ref.name) || '적';
    var el = e.elite ? eliteOf(e.elite) : null;
    return el ? (el.name + ' ' + base) : base;
  }

  /* ── 방 생성 ─────────────────────────────────────────── */

  function pickRoomKind() {
    var total = 0, i;
    for (i = 0; i < DD.ROOMS.length; i++) { total += DD.ROOMS[i].weight; }
    var r = Math.random() * total;
    for (i = 0; i < DD.ROOMS.length; i++) {
      r -= DD.ROOMS[i].weight;
      if (r <= 0) { return DD.ROOMS[i].key; }
    }
    return 'fight';
  }

  /**
   * 방 하나를 만든다.
   * @param kind 'fight' | 'trove' | 'well' | 'shrine' | 'elite' | 'miniboss' | 'cave' | 'merchant' | 'puzzle' | 'event' | 'forage' | 'boss' | 'stair'
   */
  function makeRoom(kind, floor, index, total) {
    var room = {
      kind: kind, index: index, cleared: false,
      enemies: [], drops: [], doors: [], chest: null, well: null, shrine: null, vein: null,
      merchant: null, puzzle: null, captive: null, forage: null, grave: null
    };
    var n;
    if (kind === 'boss') {
      room.enemies.push(spawnEnemy(floor, true));
      n = Math.min(6, 2 + Math.floor(floor / 5));         // 보스도 부하를 몰고 온다
      for (var b = 0; b < n; b++) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'fight') {
      /* 원작처럼 몰려온다 — 4~7 + 층 보정, 상한 12 (성능·화면 밀도) */
      n = Math.min(12, 4 + Math.floor(Math.random() * 4) + Math.min(6, Math.floor(floor / 3)));
      for (var i = 0; i < n; i++) { room.enemies.push(spawnEnemy(floor, false)); }
      addPacks(room, index);
    } else if (kind === 'trove') {
      room.chest = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, taken: false };
      if (Math.random() < 0.5) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'well') {
      room.well = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, used: false };
    } else if (kind === 'shrine') {
      room.shrine = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, used: false };
    } else if (kind === 'elite') {
      /* 정예 소굴(POI: Elite) — 반드시 정예 하나를 낀 채로 나온다. 잡졸 수는
         전투방보다 적다(정예 하나가 이미 벅차다) */
      n = Math.min(8, 3 + Math.floor(Math.random() * 3) + Math.min(3, Math.floor(floor / 5)));
      room.enemies.push(spawnEnemy(floor, false, { forceElite: true }));
      for (var ei = 1; ei < n; ei++) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'miniboss') {
      /* 미니보스(POI: MiniBoss) — 층 끝 보스와 달리 부하 없이 혼자 나온다.
         `kill()` 이 `e.boss` 만 보고 이미 보스급 노획(확정 드랍·재료·단약·
         감정서)을 주므로 여기서 따로 더 챙길 것은 없다 */
      room.enemies.push(spawnEnemy(floor, true));
    } else if (kind === 'cave') {
      /* 채광방(POI: Cave) — PLAN 12절 "희귀 광석" 을 문 하나로 꺼낸다.
         광맥을 캐면(우물과 같은 손짓) 세공 재료가 확정으로 둘 나온다 —
         행상에서 사는 것보다 후하게(우물의 회복량 40% 만큼 후한 셈이다) */
      room.vein = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, used: false };
      if (Math.random() < 0.35) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'merchant') {
      /* 행상(POI: Merchant, PLAN 12절 "랜덤 상인") — 지나가는 길에 만난다.
         본영의 행상(vendor.js)과는 따로다 — 그쪽은 "회차가 끝나야 재고가
         새로 온다" 는 규칙이 있어 던전 안에서 함부로 같이 쓰면 그 규칙이
         깨진다. 대신 이 자리에서만 파는 재고를 셋 굴린다(한 번뿐이다). */
      room.merchant = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, used: false };
      if (Math.random() < 0.15) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'puzzle') {
      /* 퍼즐방(POI: Puzzle) — 제단 셋을 **맞는 순서**로 밟는다(원작에도 있는
         "손잡이 셋" 류 장치). 순서는 방마다 새로 섞는다 — 틀리면 처음부터
         (벌은 없다, 몸이 아니라 머리로 푸는 방이라 몸싸움을 안 섞었다) */
      var order = [0, 1, 2];
      for (var pi = order.length - 1; pi > 0; pi--) {
        var pj = Math.floor(Math.random() * (pi + 1));
        var tmp = order[pi]; order[pi] = order[pj]; order[pj] = tmp;
      }
      room.puzzle = {
        pods: [
          { x: ROOM_W * 0.55, y: ROOM_H * 0.28, idx: 0, lit: false },
          { x: ROOM_W * 0.72, y: ROOM_H * 0.5,  idx: 1, lit: false },
          { x: ROOM_W * 0.55, y: ROOM_H * 0.72, idx: 2, lit: false }
        ],
        order: order, progress: 0, solved: false
      };
    } else if (kind === 'event') {
      /* 이벤트방(POI: Event, PLAN 35절 "NPC Rescue") — 잡혀 있는 이를
         구한다. 지키는 잡졸을 다 치우면 풀려나 은사를 하나 갚는다(고르지
         않고 바로 얹는다 — 사당과 다르게 "받은 은혜" 라 고를 처지가
         아니다) + 노획물도 조금. Monster Ambush·Elite Monster·Merchant·
         Shrine·Mini Boss 는 PLAN 35절에도 같이 있지만 이미 다른 POI 로
         있으므로(elite·miniboss·merchant·shrine·fight) 여기서 새로 만든
         것은 이 구출뿐이다. */
      n = Math.min(6, 2 + Math.floor(Math.random() * 3) + Math.min(2, Math.floor(floor / 6)));
      for (var evi = 0; evi < n; evi++) { room.enemies.push(spawnEnemy(floor, false)); }
      room.captive = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, freed: false };
    } else if (kind === 'forage') {
      /* 채집·낚시방(POI: Forage, PLAN 12절 "채집"·"낚시 가능한 지역") —
         사용자가 2026-08-30에 직접 요청해 넣었다. 사가마을(생활 시뮬 모방)
         이 이미 낚시·채집을 담당하고 있어 처음엔 이 판(원작 모방)엔
         안 맞다고 봤는데, 뜻이 분명해 넣었다 — 대신 **이 판의 결로**
         옮긴다: 밭을 갈지 않고 낚싯대를 들지 않는다. 약초 셋은 **항아리와
         같은 손짓**(지나가며 스치면 단약이 뜬다 — `dropPotion` 을 그대로
         쓴다)이고, 못은 **우물·사당과 같은 손짓**(방을 다 치운 뒤 한 번,
         "손맛" 하나) 이다. 새 재료·인벤 칸을 만들지 않았다 — 이미 있는
         드랍 셋(potion·mat·gold·item)만 쓴다. */
      room.forage = {
        herbs: [
          { x: ROOM_W * 0.30, y: ROOM_H * 0.30, picked: false },
          { x: ROOM_W * 0.50, y: ROOM_H * 0.68, picked: false },
          { x: ROOM_W * 0.66, y: ROOM_H * 0.32, picked: false }
        ],
        pond: { x: ROOM_W * 0.80, y: ROOM_H * 0.62, used: false }
      };
      if (Math.random() < 0.25) { room.enemies.push(spawnEnemy(floor, false)); }
    }
    if (!room.enemies.length) { room.cleared = true; }
    room.last = index >= total - 1;
    room.decor = makeDecor(kind, floor, index);
    return room;
  }

  /**
   * 방 장식 — 기둥 · 횃불 · 균열. 통과에는 영향이 없고 눈으로만 쓴다
   * (충돌까지 넣으면 좁은 방에서 길이 막히는 사고가 난다).
   */
  function makeDecor(kind, floor, index) {
    var out = [], i;
    var cols = 2 + Math.floor(Math.random() * 3);
    for (i = 0; i < cols; i++) {
      out.push({
        t: 'pillar',
        x: ROOM_W * (0.22 + Math.random() * 0.6),
        y: ROOM_H * (0.18 + Math.random() * 0.64)
      });
    }
    var torches = kind === 'boss' ? 4 : 2;
    for (i = 0; i < torches; i++) {
      out.push({
        t: 'torch',
        x: WALL + 8 + (ROOM_W - WALL * 2 - 16) * ((i + 0.5) / torches),
        y: WALL - 4,
        seed: Math.random() * 6.28
      });
    }
    /* 항아리 — 원작에서 방마다 널려 있고, 부수면 뭔가 나온다.
       "지나가며 다 깨는" 그 손버릇이 원작의 리듬이다 */
    var jn = DD.JARS.min + Math.floor(Math.random() * (DD.JARS.max - DD.JARS.min + 1));
    for (i = 0; i < jn; i++) {
      out.push({
        t: 'jar', broken: false,
        x: WALL + 24 + Math.random() * (ROOM_W - WALL * 2 - 48),
        y: WALL + 24 + Math.random() * (ROOM_H - WALL * 2 - 48),
        seed: Math.random() * 6.28
      });
    }
    /* 함정(dg:spikes) — `dungeon3d.js`의 `buildClutter`가 방 네 귀퉁이에
       세우는 잡동사니 중 하나다(순수 장식으로 시작했다). 그림과 어긋나지
       않도록 **같은 계산을 그대로 되풀이**해 자리를 맞춘다(seed·귀퉁이
       좌표·해시 다 동일) — 여기서만 그중 '가시'를 판정으로 집어낸다.
       2026-09-04: 밟으면 실제로 아프게(사용자 결정) — 새 공식을 만들지
       않고 독(毒) dot 그대로(`applyElem`과 같은 패턴, update() 참고). */
    var F3 = global.DG.field3d;
    if (F3) {
      var clSeed = F3.seedOf(floor, index, 'clutter');
      var CLUTTER_KIND = ['dg:barrel', 'dg:crate', 'dg:crates', 'dg:chair', 'dg:shield', 'dg:spikes'];
      var corners = [[50, 50], [ROOM_W - 50, 50], [50, ROOM_H - 50], [ROOM_W - 50, ROOM_H - 50]];
      for (i = 0; i < corners.length; i++) {
        var ch = (clSeed + i * 2654435761) >>> 0;
        if (ch % 5 < 3) { continue; }               // 다섯 중 셋은 비워 둔다 — buildClutter와 동일
        if (CLUTTER_KIND[ch % CLUTTER_KIND.length] !== 'dg:spikes') { continue; }
        out.push({ t: 'spike', x: corners[i][0], y: corners[i][1], r: 30, cd: 0 });
      }
    }
    var cracks = 2 + Math.floor(Math.random() * 3);
    var crackList = [];
    for (i = 0; i < cracks; i++) {
      var cr = {
        t: 'crack',
        x: ROOM_W * (0.15 + Math.random() * 0.7),
        y: ROOM_H * (0.2 + Math.random() * 0.6),
        a: Math.random() * 3.14,
        len: 18 + Math.random() * 34
      };
      out.push(cr);
      crackList.push(cr);
    }
    /* 비밀(POI: Secret) — 문에 안 뜨고 숨어 있다. 겉보기엔 여느 균열과
       똑같다 — **닿아 봐야 안다**(그래서 room.decor 항목에 얹지, 문
       목록엔 아예 없다). 방마다 8% 확률로 균열 하나가 사실은 숨은 틈이다.
       보스방은 뺀다(정신없는 싸움 중에 발밑을 뒤질 계제가 아니다).
       **`Math.random()` 을 안 쓴다** — 여기서 하나 더 뽑으면 이 뒤로 도는
       모든 굴림(전리품 등급·원소 접사…)이 한 칸씩 밀린다. 자가진단이
       던전을 3000틱 자동으로 돌리는 항목이 있어(다른 방을 수백 번 만든다),
       그 밀림이 한참 뒤 엉뚱한 테스트(원소 접사 값)까지 흔드는 걸 실제로
       겪었다 — 대신 층·방 번호로만 결정되는 순수 해시(`core.hash2`)를
       쓴다(자리를 옮기지 않는 층 테마·바닥 무늬와 같은 요령). */
    if (kind !== 'boss' && crackList.length) {
      var secRoll = core.hash2((floor || 0) * 131 + (index || 0) * 7, crackList.length * 29 + 3);
      if (secRoll < 0.08) {
        var pickH = core.hash2((floor || 0) * 131 + (index || 0) * 7 + 1, crackList.length * 29 + 11);
        var sc = crackList[Math.min(crackList.length - 1, Math.floor(pickH * crackList.length))];
        sc.secret = true;
        sc.found = false;
      }
    }
    return out;
  }

  /* ── 명소 층(名所層, §5.15) — 테마 끝 층(5·10·15·20·25·30)은 손으로 짠 고정 층 ──────
   * 방 다섯이 늘 같은 순서(문 하나, 다음 방 이름이 붙는다), 방마다 기둥·항아리·적 명단·자리가
   * 늘 같다. 마지막 방은 층 주인. 방 종류 판정(상자·우물·사당·퍼즐·구출…)은 makeRoom 을 그대로
   * 쓰고, 적과 장식만 표대로 갈아 끼운다. 자리 계산에 Math.random 을 안 쓴다.
   * 손잡이 `dungeon.fixed`(기본 1) 를 끄면 예전처럼 모든 층이 갈림길이다. */
  function fixedOn() { return !core.tuned || core.tuned('dungeon.fixed', 1) ? true : false; }
  function fixedFor(floor) { return fixedOn() && DD.fixedOf ? DD.fixedOf(floor) : null; }
  function fixedState() {
    var d = dstate();
    if (!d.fixed || typeof d.fixed !== 'object') { d.fixed = {}; }
    return d.fixed;
  }
  /** 층 주인의 몸 — 표의 base 몬스터 몸을 빌려 이름·색만 갈아 끼운다(지역 우두머리와 같은 요령) */
  function fixedGuardRef(def) {
    var ED = global.DG.enemyData, base = ED && ED.byName ? ED.byName(def.guard.base) : null, r = {}, k;
    if (base) { for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) { r[k] = base[k]; } } }
    else { r = { kind: 'beast', form: 'ogre' }; }
    r.id = 'fx_' + def.key; r.name = def.guard.name; r.emoji = def.guard.emoji; r.color = def.guard.color;
    delete r.biome;
    return r;
  }
  /** 적 j 번째(모두 n)의 늘 같은 자리 — 방 오른쪽 절반, 가로는 황금비로 흩고 세로는 고르게 */
  function fixedSpot(j, n) {
    var fx0 = (j * 0.618034 + 0.13) % 1;
    return { x: ROOM_W * (0.5 + 0.38 * fx0), y: WALL + P_R + (ROOM_H - WALL * 2 - P_R * 2) * ((j + 0.5) / Math.max(1, n)) };
  }
  var FIXED_JARS = [[0.16, 0.20], [0.16, 0.80], [0.90, 0.18], [0.90, 0.82]];
  function makeFixedRoom(def, idx) {
    var rd = def.rooms[idx], total = def.rooms.length, floor = def.floor, ED = global.DG.enemyData, i, j = 0;
    var room = makeRoom(rd.kind, floor, idx, total);
    var list = [];
    rd.foes.forEach(function (f) { for (i = 0; i < f[1]; i++) { list.push({ name: f[0], elite: !!f[2] }); } });
    room.enemies = [];
    if (rd.kind === 'boss') {
      var g = spawnEnemy(floor, true, { x: ROOM_W * 0.76, y: ROOM_H * 0.5, ref: fixedGuardRef(def) });
      g.fixedGuard = def.key;
      room.enemies.push(g);
    }
    list.forEach(function (f) {
      var sp = fixedSpot(j++, list.length), ref = ED && ED.byName ? ED.byName(f.name) : null;
      /* spawned — 정예 확률 굴림을 건너뛴다(표에 정예라 적힌 것만 정예) */
      room.enemies.push(spawnEnemy(floor, false, { x: sp.x, y: sp.y, ref: ref || undefined, forceElite: f.elite, spawned: !f.elite }));
    });
    room.enemies.forEach(function (e) { e.spawned = false; });   // 처치 보상은 여느 적과 같게
    room.cleared = !room.enemies.length;
    room.title = rd.title; room.fixed = def.key;
    /* 장식 — 횃불·가시(3D 잡동사니와 같은 자리)는 두고, 기둥·항아리·균열은 표대로 */
    var dec = (room.decor || []).filter(function (o) { return o.t === 'torch' || o.t === 'spike'; });
    (DD.FIXED_PAT[rd.pat] || DD.FIXED_PAT.open).forEach(function (q) { dec.push({ t: 'pillar', x: ROOM_W * q[0], y: ROOM_H * q[1] }); });
    FIXED_JARS.forEach(function (q, k) { dec.push({ t: 'jar', broken: false, x: ROOM_W * q[0], y: ROOM_H * q[1], seed: k * 1.7 + 0.4 }); });
    dec.push({ t: 'crack', x: ROOM_W * 0.34, y: ROOM_H * 0.58, a: 0.7, len: 30 });
    dec.push({ t: 'crack', x: ROOM_W * 0.62, y: ROOM_H * 0.36, a: 2.1, len: 24 });
    room.decor = dec;
    return room;
  }
  /* ── 명소 층 주인 고유 수(§5.18) ─────────────────────────────
   * 주인은 `spawnEnemy(floor, true)` 라 보스 판정(bossPattern)을 받지만 빌린 몸에 무기가 없으면
   * 여섯 다 같은 강타 하나였다. `guard.sig` 표대로 제 수를 하나씩 더 쓴다 — 예고(원 테두리) 뒤 터진다.
   * 고유 수를 예고·시전하는 동안은 무기 패턴을 쉬어 둘이 겹쳐 읽기 어렵지 않게 한다.
   * 자리·박자는 전부 주인·나 자리와 시전 횟수(step)로만 정한다 — Math.random 없음. 손잡이 `dungeon.guardSig`. */
  var GUARD_SIG_FIRST = 3, GUARD_POOL_TICK = 0.5;
  function guardSigOn() { return !core.tuned || core.tuned('dungeon.guardSig', 1) ? true : false; }
  function fixedDefByKey(key) {
    var L = DD.FIXED || [], i;
    for (i = 0; i < L.length; i++) { if (L[i].key === key) { return L[i]; } }
    return null;
  }
  /** 고유 수가 칠 원들 — 순수. g 주인 자리, pl 나 자리, step 몇 번째 시전 */
  function guardZones(sig, g, pl, step) {
    var out = [], i, k, a;
    if (!sig) { return out; }
    if (sig.kind === 'rain') {
      a = step * 1.1;
      out.push({ x: pl.x, y: pl.y, r: sig.r });
      for (i = 1; i < (sig.n || 3); i++) {
        var sgn = i % 2 ? 1 : -1, m = Math.ceil(i / 2) * (sig.spread || 55);
        out.push({ x: pl.x + Math.cos(a) * m * sgn, y: pl.y + Math.sin(a) * m * sgn, r: sig.r });
      }
    } else if (sig.kind === 'hops' || sig.kind === 'pool') {
      out.push({ x: pl.x, y: pl.y, r: sig.r });
    } else if (sig.kind === 'vortex') {
      out.push({ x: g.x, y: g.y, r: sig.r });
    } else if (sig.kind === 'cross') {
      var base = step % 2 ? Math.PI / 4 : 0, arms = sig.arms || 4;
      for (i = 0; i < arms; i++) {
        a = base + i * Math.PI * 2 / arms;
        for (k = 1; k <= (sig.count || 6); k++) {
          out.push({ x: g.x + Math.cos(a) * sig.gap * k, y: g.y + Math.sin(a) * sig.gap * k, r: sig.r });
        }
      }
    }
    return out;
  }
  function inZones(zs, p) {
    for (var i = 0; i < zs.length; i++) { if (Math.hypot(p.x - zs[i].x, p.y - zs[i].y) <= zs[i].r + P_R) { return true; } }
    return false;
  }
  function guardSigState(en) {
    return en.gs || (en.gs = { cd: GUARD_SIG_FIRST, warn: 0, step: 0, zones: null, left: 0, pools: [], poolT: 0, phase: 0, said: false });
  }
  function beginGuardSig(en, sig, s, p) {
    s.zones = guardZones(sig, en, p, s.step);
    s.step += 1;
    s.warn = sig.warn;
    for (var i = 0; i < s.zones.length; i++) {
      fx.push({ t: 'zone', x: s.zones[i].x, y: s.zones[i].y, r: s.zones[i].r, life: sig.warn, max: sig.warn, color: sig.color });
    }
    if (!s.said) { s.said = true; core.emit('toast', (en.ref && en.ref.emoji || '') + ' ' + (en.ref && en.ref.name || '') + ' — ' + sig.name); }
  }
  function resolveGuardSig(en, sig, s, p) {
    var zs = s.zones || [], i;
    for (i = 0; i < zs.length; i++) { fx.push({ t: 'burst', x: zs[i].x, y: zs[i].y, life: 0.35, color: sig.color }); }
    if (sig.kind === 'hops' && zs.length) {
      en.x = core.clamp(zs[0].x, WALL + en.r, ROOM_W - WALL - en.r);
      en.y = core.clamp(zs[0].y, WALL + en.r, ROOM_H - WALL - en.r);
    }
    if (sig.kind === 'pool' && zs.length) {
      s.pools.push({ x: zs[0].x, y: zs[0].y, r: zs[0].r, t: sig.last });
      while (s.pools.length > (sig.maxPools || 4)) { s.pools.shift(); }
      fx.push({ t: 'zone', x: zs[0].x, y: zs[0].y, r: zs[0].r, life: sig.last, max: sig.last, color: sig.color, pool: true });
    }
    s.zones = null;
    if (inZones(zs, p)) { hurtPlayer(en.dmg * sig.mul, sig.el, en); if (!run) { return; } }
    if (sig.kind === 'hops' && --s.left > 0) { beginGuardSig(en, sig, s, p); return; }
    s.left = 0;
    s.cd = sig.cd;
  }
  /** 한 틱 — true 면 지금 고유 수를 예고·시전 중(무기 패턴을 쉰다) */
  function stepGuardSig(en, p, dt) {
    if (!guardSigOn()) { return false; }
    var def = fixedDefByKey(en.fixedGuard), sig = def && def.guard && def.guard.sig;
    if (!sig) { return false; }
    var s = guardSigState(en), i;
    /* 불바닥 — 남은 동안 0.5초마다, 안에 서 있으면 */
    if (s.pools.length) {
      for (i = s.pools.length - 1; i >= 0; i--) { s.pools[i].t -= dt; if (s.pools[i].t <= 0) { s.pools.splice(i, 1); } }
      s.poolT -= dt;
      if (s.poolT <= 0) {
        s.poolT = GUARD_POOL_TICK;
        if (inZones(s.pools, p)) { hurtPlayer(en.dmg * sig.poolMul, sig.el, en, '장판'); if (!run) { return true; } }
      }
    }
    if (sig.kind === 'summon') {
      var at = sig.at || [];
      if (s.phase < at.length && en.hp / (en.hpMax || en.hp || 1) <= at[s.phase]) {
        s.phase += 1;
        var ED = global.DG.enemyData, ref = ED && ED.byName ? ED.byName(sig.add) : null;
        for (i = 0; i < (sig.n || 2); i++) {
          var ay = core.clamp(en.y + (i % 2 ? 1 : -1) * (40 + 20 * Math.floor(i / 2)), WALL + P_R, ROOM_H - WALL - P_R);
          run.room.enemies.push(spawnEnemy(run.floor, false, { x: core.clamp(en.x - 30, WALL + P_R, ROOM_W - WALL - P_R), y: ay, ref: ref || undefined, spawned: true }));
        }
        run.room.cleared = false;
        fx.push({ t: 'ring', x: en.x, y: en.y, r: 60, life: 0.5, color: '#d9d0b0' });
        core.emit('toast', (en.ref && en.ref.emoji || '') + ' ' + sig.name + ' — ' + (sig.line || ''));
      }
      return false;
    }
    if (s.warn > 0) {
      s.warn -= dt;
      if (sig.kind === 'vortex' && !p.dodge) {
        var dd = dist(en, p) || 1, stop = en.r + P_R + 4;
        if (dd > stop) {
          var mv = Math.min(dd - stop, sig.pull * dt);
          p.x = core.clamp(p.x + (en.x - p.x) / dd * mv, WALL + P_R, ROOM_W - WALL - P_R);
          p.y = core.clamp(p.y + (en.y - p.y) / dd * mv, WALL + P_R, ROOM_H - WALL - P_R);
        }
      }
      if (s.warn <= 0) { resolveGuardSig(en, sig, s, p); }
      return true;
    }
    s.cd -= dt;
    if (s.cd <= 0) {
      if (sig.kind === 'hops') { s.left = sig.hops || 3; }
      beginGuardSig(en, sig, s, p);
      return true;
    }
    return false;
  }

  function fixedDoors(def, idx) {
    if (idx >= def.rooms.length - 1) { return [{ kind: 'stair', y: ROOM_H * 0.5 }]; }
    var nx = def.rooms[idx + 1];
    return [{ kind: nx.kind, y: ROOM_H * 0.5, title: nx.title }];
  }
  /** 층 주인을 쓰러뜨렸다 — kill() 이 부른다. 첫 답파면 전설 한 점 */
  function grantFixedReward(e, room) {
    var def = DD.FIXED ? DD.FIXED.filter(function (f) { return f.key === e.fixedGuard; })[0] : null;
    if (!def || !room) { return; }
    var all = fixedState(), st = all[def.floor] || (all[def.floor] = { clears: 0, firstAt: Date.now() });
    var first = !st.clears;
    st.clears += 1; st.lastAt = Date.now();
    var IT = global.DG.item;
    if (first && IT && IT.roll) {
      room.drops.push({ kind: 'item', item: IT.roll(def.floor + 1, { tier: 4 }), x: jitter(e.x), y: jitter(e.y) });
      core.gainFeat(10 + def.floor, '명소 첫 답파');
    }
    core.emit('dungeon:fixed', { key: def.key, floor: def.floor, first: first });
    core.log('🏛️ ' + def.name + ' — ' + def.guard.name + ' 토벌' + (first ? ' · 첫 답파! 전설 한 점' : ''), 'good');
    core.emit('toast', '🏛️ ' + def.guard.emoji + ' ' + def.guard.name + (first ? ' — 첫 답파!' : ' 토벌'));
  }

  /** 다음 방 후보 2~3개 (문에 표시된다) */
  function makeDoors(floor, index, total) {
    var out = [];
    if (index >= total - 1) {
      out.push({ kind: 'stair', y: ROOM_H * 0.5 });
      return out;
    }
    var count = 2 + (Math.random() < 0.35 ? 1 : 0);
    var kinds = {};
    var guard = 0;
    while (out.length < count && guard < 30) {
      guard++;
      var k = pickRoomKind();
      if (kinds[k] && out.length) { continue; }
      kinds[k] = true;
      out.push({ kind: k, y: 0 });
    }
    // 문을 오른쪽 벽에 세로로 고르게 배치
    for (var i = 0; i < out.length; i++) {
      out[i].y = ROOM_H * ((i + 1) / (out.length + 1));
    }
    return out;
  }

  /* ── 회차 ─────────────────────────────────────────────── */

  /* ── 난도(難度) — 원작의 노멀 · 나이트메어 · 헬 ───
   * 원작에서 한 바퀴를 돈 사람은 같은 땅을 **더 사나운 규칙**으로 다시 돈다.
   * 여기서는 최고 층으로 열린다 — 열 층을 밟으면 험(險), 스무 층이면 절(絕).
   */
  var MODES = [
    { key: 'normal', name: '평(平)', need: 0,  hp: 1,    dmg: 1,   bias: 0,  gold: 1,   exp: 1,
      desc: '처음 내려가는 길.' },
    { key: 'hard',   name: '험(險)', need: 10, hp: 1.8,  dmg: 1.5, bias: 12, gold: 1.6, exp: 1.5, resist: 10,
      desc: '적이 두 배 가까이 버티고 손도 맵다. 저항도 붙는다. 대신 나오는 것이 좋아진다.' },
    { key: 'hell',   name: '절(絕)', need: 20, hp: 3.2,  dmg: 2.2, bias: 26, gold: 2.4, exp: 2.2, resist: 20,
      desc: '한 대가 치명적이다. 저항이 두껍다. 부문(符文)도 여기서 잘 나온다.' }
  ];

  function modeOf(key) {
    for (var i = 0; i < MODES.length; i++) { if (MODES[i].key === key) { return MODES[i]; } }
    return MODES[0];
  }

  /** 지금 열려 있는 난도들 */
  function modesOpen() {
    var best = dstate().best || 0;
    return MODES.filter(function (m) { return best >= m.need; });
  }

  /** 이번 회차의 난도 (던전 밖이면 고른 값) */
  function mode() {
    if (run && run.mode) { return modeOf(run.mode); }
    return modeOf(dstate().mode);
  }

  function setMode(key) {
    var m = modeOf(key);
    if ((dstate().best || 0) < m.need) { return false; }
    dstate().mode = m.key;
    core.emit('changed');
    core.persist();
    return true;
  }

  function dstate() {
    var s = core.save;
    if (!s.dungeon) { s.dungeon = { best: 0, runs: 0, kills: 0, clears: 0, mode: 'normal' }; }
    if (!s.dungeon.mode) { s.dungeon.mode = 'normal'; }
    /* 월드 보스(§5.4) — 슬롯(15분 단위)마다 마을·자리가 결정적으로 갈린다.
       `bossDone`은 슬롯 번호를 키로 이중 보상을 막는다(끝없이 안 늘게
       stepWorldBoss가 지난 슬롯을 솎아 낸다). */
    if (!s.dungeon.world) { s.dungeon.world = { slot: null, townId: null, spawned: false, bossDone: {} }; }
    return s.dungeon;
  }

  function active() { return !!run; }

  /**
   * 던전에 들어간다.
   * @param opts {floor} 시작 층 (기본 1)
   */
  /** 결사로 스러진 판인가 — 그렇다면 더 못 내려간다 */
  function fallen() { return !!(core.save.dungeon && core.save.dungeon.fallen); }

  function enter(opts) {
    if (fallen()) {
      core.emit('toast', '☠️ 결사로 스러진 판입니다 — 새 이름으로 시작하세요');
      return false;
    }
    opts = opts || {};
    if (!core.save.party.length) {
      core.emit('toast', '⚠️ 부대가 없습니다 — 먼저 인물을 등용하세요');
      return false;
    }
    if (run) { return false; }
    var horde = !!opts.horde;
    /* 부적(§5.3) — 굴혈 앞에서 쓸 부적 하나를 미리 고른다. 여기서 없으면
       (남이 먼저 썼거나 id 오타) 아예 안 들어간다 — run을 만들기 전에
       실패해야 이도 저도 아닌 상태가 안 생긴다. */
    var IT0 = global.DG.item;
    var sig = opts.sigilId && IT0 && IT0.sigilById ? IT0.sigilById(opts.sigilId) : null;
    if (opts.sigilId && !sig) {
      core.emit('toast', '⚠️ 그 부적을 찾을 수 없습니다');
      return false;
    }
    /* 시련(§5.11) — 열린 단계까지만. 제10층을 밟아야 열린다(부적과 같은 문턱) */
    var trialLv = 0;
    if (opts.trial && !horde && !sig) {
      trialLv = Math.round(opts.trial);
      if (!trialReady() || trialLv < 1 || trialLv > trialState().open) {
        core.emit('toast', '⚠️ 아직 열리지 않은 시련입니다');
        return false;
      }
    }
    var nmMods = sig ? DD.rollMods(sig.seed) : null;
    /* 난입(§5.5)·부적(§5.3)은 층이 없다 — 지금까지 밟은 최고 층을 적 배율
       기준으로만 빌린다(spawnEnemy 가 floor 인자를 요구해서다, 화면엔 안
       보인다). 부적은 최소 10층부터(드랍 조건과 맞춘다). */
    var floor = horde ? Math.max(1, dstate().best || 1) :
      (sig || trialLv) ? Math.max(10, dstate().best || 10) : Math.max(1, Math.round(opts.floor || 1));
    /* 난도는 들어갈 때 정해지고 회차 내내 바뀌지 않는다 */
    var md = modeOf(opts.mode || dstate().mode);
    if ((dstate().best || 0) < md.need) { md = MODES[0]; }
    if (sig) { IT0.removeSigil(sig.id); }     // 여기서부터는 실패해도 되돌리지 않는다(원작도 소모품)
    run = {
      mode: horde ? 'horde' : md.key, horde: horde,
      /* 부적(§5.3) — 없으면 null. `run.nightmare.roomT` 는 'timer' 변형자일
         때만 뜻이 있다(없으면 그냥 안 줄어든 채로 논다). */
      nightmare: sig ? { sigilId: sig.id, tier: sig.tier, mods: nmMods.mods,
        resistElem: nmMods.resistElem, roomT: 75 } :
        /* 시련(§5.11)은 부적 던전의 틀(방·문·적 배율 1+0.35×단계)을 빌린다 — 변형자는 없다 */
        trialLv ? { sigilId: null, tier: trialLv, mods: [], resistElem: null, roomT: 75, trial: true } : null,
      trial: trialLv ? { lv: trialLv, t: TRIAL_SEC, prog: 0, guardian: false, won: false, deaths: 0 } : null,
      floor: floor, startFloor: floor,
      boons: {}, choice: null, boonPicks: 0,   // 축복(§5.1) — 회차 전체 상한 8은 boonPicks로 센다
      hpMax: 0, hp: 0,
      buffs: {}, minions: [],          // 잠깐짜리 무예 · 분신 (회차 안에서만 산다)
      mp: MP_MAX, mpMax: MP_MAX,
      shots: [],                          // 기공파 투사체
      foeShots: [],                       // 궁수·조총병이 쏘는 것 (몬스터 다양화)
      roomIdx: 0, rooms: [], room: null,
      loot: { gold: 0, items: [] },
      fieldSpawnCd: 4,                    // 들판 로머 보충 주기(초) — PLAN 10절 "필드 사냥"
      fieldTreasureCd: 90,                 // 필드 보물 조우 재확인 주기(초) — PLAN §60 후보 1
      fieldMerchantCd: 60,                 // 필드 방랑 상인 재확인 주기(초) — PLAN §60 후보 1 나머지 절반
      hitstopT: 0,                        // 타격 정지(hitstop) 남은 초 — 2026-09-10 "전투가 심심하다"
      slowT: 0,                           // §5.8② 저스트 회피 슬로우 남은 초(2026-09-18)
      combo: 0, comboT: 0,                // 연속 타격 수 · 끊기는 문턱(초)
      /* 난입(§5.5) 전용 — 일반 회차에서는 안 건드린다 */
      hordeT: 0, hordeWaveCd: HORDE_WAVE_INTERVAL, hordeWave: 0, hordeLevel: 1,
      kills: 0, startedAt: Date.now(), dead: false
    };
    run.hpMax = hpMaxOf();
    run.hp = run.hpMax;
    if (horde) {
      buildHordeRoom();
      dstate().horde = dstate().horde || { best: 0, runs: 0 };
      dstate().horde.runs += 1;
      core.log('⚔️ 난입(亂入) 시작', 'info');
    } else if (trialLv) {
      buildNightmareRoom();
      run.roomTotal = TRIAL_ROOMS;           // 방은 끝없이 — 끝은 진척 막대와 수호자가 정한다
      trialState().runs += 1;
      core.log('⏳ 시련(試鍊) · 제' + trialLv + '단계 — 15분 안에 수호자를 쓰러뜨려라', 'info');
    } else if (sig) {
      buildNightmareRoom();
      core.log('📜 부적 던전 · 티어 ' + sig.tier + ' 진입', 'info');
    } else {
      buildFloor();
      dstate().runs += 1;
      core.log('🕳️ 던전 진입 · 제' + floor + '층 (' + DD.themeOf(floor).name + ') · ' +
        md.name, 'info');
      registerRegion(floor);
    }
    /* 손이 비어 있으면 첫 무예 하나를 얹어 준다 — 배운 게 없으면 평타밖에 없다 */
    if (global.DG.skill) { global.DG.skill.ensureStarter(leadId()); }
    core.emit('dungeon:enter', run);
    core.emit('changed');
    return true;
  }

  /** 플레이어 전투 상태 하나 — 층 진입(`buildFloor`)·난입 진입
   *  (`buildHordeRoom`)이 똑같이 쓴다(§5.5, 2026-09-18 분리). */
  function makePlayer() {
    return {
      x: WALL + 40, y: ROOM_H * 0.5, atkCd: 0, phase: 0, walking: false, facing: 1, hurt: 0,
      atkAnim: 0,                         // 공격 자세 남은 시간(초) — 3D·2D 렌더가 읽는다
      cds: [0, 0, 0, 0],                  // 스킬 쿨다운 (남은 초)
      dash: null,                         // 돌진 중 { t, dx, dy, hit } (무예 "돌진" 모양)
      invuln: 0,                          // 무적 남은 초 (돌진·회피)
      rallyUntil: 0,                      // 사기 버프가 끝나는 시각 (ms)
      /* 2026-09-10 — "강공격이랑 전용 회피 버튼도"(사용자). 스킬(Z X C V,
         MP 소모·슬롯 필요)과 달리 **누구나 처음부터 쓰는 기본기**다 —
         쿨다운만 있고 MP·무예 습득이 필요 없다. */
      heavyCd: 0,                         // 강공격 재사용 대기(초)
      dodge: null,                        // 회피 중 { t, dx, dy } (dash와 달리 적을 안 벤다)
      dodgeCd: 0,                         // 회피 재사용 대기(초)
      /* 2026-09-10 — "방어구 세트마다 특색 스킬"(사용자). 투장 세 점을
         한 인물이 다 걸쳐야 손에 잡히는 세트 전용 무예 — 강공격·회피와
         같은 자리(쿨다운만, MP·슬롯 안 씀)에 셋째로 놓는다. */
      setSkCd: 0,                         // 투장 무예 재사용 대기(초)
      /* 2026-09-11 — "캐릭터마다 스킬이 달라야 해"(사용자). 인물별 서명
         무예 — 장비가 아니라 이 인물이 선두면 상시 켜지는 넷째 기본기. */
      sigSkCd: 0                          // 서명 무예 재사용 대기(초)
    };
  }

  function buildFloor() {
    var fdef = fixedFor(run.floor);
    run.fixed = fdef;
    var total = fdef ? fdef.rooms.length : DD.roomsFor(run.floor);
    run.rooms = [];
    run.roomIdx = 0;
    var firstKind = 'fight';
    run.room = fdef ? makeFixedRoom(fdef, 0) : makeRoom(firstKind, run.floor, 0, total);
    run.roomTotal = total;
    run.room.doors = fdef ? fixedDoors(fdef, 0) : makeDoors(run.floor, 0, total);
    if (fdef) {
      var fst = fixedState()[fdef.floor];
      core.log(fdef.emoji + ' 명소 — ' + fdef.name + '(' + fdef.hanja + ') · ' + fdef.intro, 'info');
      core.emit('toast', fdef.emoji + ' ' + fdef.name + (fst && fst.clears ? ' · 답파 ' + fst.clears + '번' : ' — ' + fdef.intro));
    }
    run.corridors = doorCorridors(run.room.doors);   // PLAN §28-4 Phase 2
    run.player = makePlayer();
    run.shots = [];
    run.foeShots = [];
    /* 동행(同行) — 부대 2번째 인물이 있으면 용병처럼 곁에서 같이 싸운다
       (PLAN §51, 2026-09-06 사용자 요청 "동료도 따라다니면서 같이
       싸우던지 용병처럼"). 층이 바뀔 때만 다시 잡는다 — `run.player`와
       같은 주기다. */
    run.companion = spawnCompanion();
    var heal = boonVal('healOnFloor');
    if (heal) { healBy(run.hpMax * heal / 100); }
    /* 역참(驛站) — 원작의 웨이포인트. **다섯 층마다** 밟으면 다음부터 거기서 시작한다.
       "최고의 절반" 하나로 갈음하던 자리를, 원작처럼 **밟은 곳**으로 바꿨다 */
    if (run.floor % WAYPOINT_EVERY === 0) { markWaypoint(run.floor); }
    /* 유품(§5.2) — 이 층에 지난 사망의 노획물이 있으면 첫 방에 표식을 세운다 */
    var gv = dstate().grave;
    if (gv && gv.floor === run.floor) {
      run.room.grave = { x: ROOM_W * 0.3, y: ROOM_H * 0.5, taken: false };
      core.emit('toast', '🪦 유품이 이 층에 있다');
    }
    run.fieldSpawnCd = 3;
    spawnFieldEncounters(8 + Math.min(4, Math.floor(run.floor / 4)));   // §5.19 두 무리쯤으로 시작
  }

  /* ── 난입(亂入, §5.5) ─────────────────────────────────────
   * 방 하나에 파도로 계속 밀어붙인다 — 문도 상자도 없다, 15분 생존 또는
   * 사망으로 끝난다. `dungeon.js` 의 방·전투·축복 시스템을 그대로 빌려
   * 쓴다(PLAN 원문 "기존 spawnEnemy·축복 3택 UI 를 전부 재사용"). 방
   * 크기를 원문대로 3배로 키우려면 `ROOM_W`/`ROOM_H` 를 쓰는 렌더·이동·
   * 필드 코드 전부를 방마다 다른 크기로 다시 짜야 해서(2D·3D·미니맵·
   * 코너 경계 전부) 범위를 넘는다고 보고 **표준 방 크기 그대로** 썼다 —
   * PLAN 원문에 없던 판단이라 여기 적는다. */
  var HORDE_WAVE_INTERVAL = 30;     // 파도 간격(초)
  var HORDE_ENEMY_CAP = 40;         // 동시 적 상한
  var HORDE_DURATION = 900;         // 생존 목표(초) = 15분

  function buildHordeRoom() {
    run.rooms = [];
    run.roomIdx = 0;
    run.roomTotal = 1;
    run.room = makeRoom('fight', run.floor, 0, 1);
    run.room.enemies = [];            // 파도가 직접 채운다
    run.room.doors = [];              // 문 없음 — 나가는 길은 "나간다" 뿐
    run.room.cleared = true;
    run.corridors = [];
    run.player = makePlayer();
    run.shots = [];
    run.foeShots = [];
    run.companion = spawnCompanion();
    spawnHordeWave();
  }

  /** 파도 하나 — 적 수 6+2×파도(상한 40), 티어는 파도/8 (PLAN §5.5 수치표) */
  function spawnHordeWave() {
    if (!run || !run.horde) { return; }
    run.hordeWave += 1;
    var room = run.room;
    var want = Math.min(HORDE_ENEMY_CAP - room.enemies.length, 6 + 2 * run.hordeWave);
    var tier = Math.floor(run.hordeWave / 8);
    for (var i = 0; i < want; i++) {
      room.enemies.push(spawnEnemy(run.floor + tier, false, { spawned: true }));
    }
    room.cleared = false;
    core.emit('toast', '⚔️ 파도 ' + run.hordeWave);
    core.emit('changed');
  }

  /** 레벨(처치 경험) — 파도와 별개로 누적 처치(`run.kills`)가 기준이다.
   *  레벨 L 을 찍으려면 처치가 L² × 10 이 되어야 한다(§5.5 "경험 곡선"). */
  function hordeLevelCheck() {
    if (!run || !run.horde || run.choice) { return; }
    var leveled = false, guard = 0;
    while (run.kills >= run.hordeLevel * run.hordeLevel * 10 && guard < 5) {
      run.hordeLevel += 1;
      leveled = true;
      guard++;
    }
    if (!leveled) { return; }
    var c = rollBoonChoice();
    if (c.length) {
      run.choice = c;
      sfx('shrine');
      core.emit('toast', '⭐ 레벨 ' + run.hordeLevel + ' · 하나를 고르세요');
    }
  }

  /** 15분 생존 — 시간 비례 보상을 주고 끝낸다(사망은 `die()` 의 별도 갈래) */
  function endHordeSurvive() {
    if (!run || !run.horde) { return null; }
    var secs = Math.round(run.hordeT);
    var gold = Math.round(secs * 0.8), feat = Math.max(1, Math.round(secs / 20));
    core.save.player.gold += gold;
    core.gainFeat(feat, '난입 완주');
    var hs = dstate().horde || (dstate().horde = { best: 0, runs: 0 });
    if (secs > (hs.best || 0)) { hs.best = secs; }
    /* 10분 이상이면 부적 1(PLAN 원문, §5.3 착수로 이제 줄 자리가 생겼다) */
    if (secs >= 600 && global.DG.item && global.DG.item.addSigil) {
      global.DG.item.addSigil(1);
    }
    var s = settleLoot('난입 완주');
    run = null;
    core.emit('dungeon:end', { reason: 'horde', floor: 0,
      horde: { secs: secs, gold: gold, feat: feat }, loot: s });
    core.log('🏆 난입 완주 · ' + secs + '초 생존 · 금 +' + core.fmt(gold), 'good');
    core.emit('toast', '🏆 난입 완주! ' + secs + '초 생존');
    core.emit('changed');
    core.persist();
    return { secs: secs, gold: gold, feat: feat };
  }

  /* ── 부적(符籍) 던전 — 나이트메어 티어(§5.3) ──────────────────
   * 5방 고정(문·복도 구조는 그대로, `goRoom`/`makeDoors`를 같이 쓴다),
   * 보스층 없이 마지막 방만 정예 무리. 적 배율·보상 배율은 티어(T)로,
   * 변형자는 부적 seed 로 결정적이다(§5.3 진단 문안).
   */
  var NM_ROOM_TOTAL = 5;
  var NM_ROOM_TIMER = 75;         // 'timer' 변형자일 때 방마다 이만큼(초)

  function nmHasMod(key) { return !!(run && run.nightmare && run.nightmare.mods.indexOf(key) >= 0); }
  /* 부적 '암흑' 변형자(§5.3) — 예전엔 아이콘만 뜨고 아무 일도 없었다(PLAN §7.2, 2026-09-23 닫음).
     시야 반경(방 논리 좌표, 방은 560×360) 밖의 적은 미니맵 점에서 빠지고(minimap.js),
     화면은 가장자리가 어두운 덧씌우기로 덮인다(dungeon-view.js #dg-dark). 3D 안개·판정은 안 건드린다 */
  var NM_DARK_R = 150;
  function darkSight() { return nmHasMod('dark') ? NM_DARK_R : 0; }
  /** 적 배율 — 1 + 0.35×T (§5.3 수치표, 진단이 이 형태를 그대로 잰다) */
  function nmMul() { return (run && run.nightmare) ? 1 + 0.35 * run.nightmare.tier : 1; }
  /** 보상 배율 — 티어분(1+0.25×T) × 변형자 '풍요'(있으면 1.5) */
  function nmLootMul() {
    if (!run || !run.nightmare) { return 1; }
    var m = 1 + 0.25 * run.nightmare.tier;
    if (nmHasMod('loot')) { m *= 1.5; }
    return m;
  }

  /** 방마다 문은 하나뿐이다 — 5방 고정이라 상자방·사당방 같은 갈림길이
   *  없다(makeDoors의 다양한 kind 는 이 회차엔 안 맞는다, PLAN "5방 고정"
   *  이 뜻하는 대로 "가 볼 곳"이 아니라 "다음"만 있다). 마지막 방은
   *  descend() 대신 endNightmareClear() 로 가게 kind 를 'stair' 로 둔다. */
  function nmDoors(isLast) { return [{ kind: isLast ? 'stair' : 'fight', y: ROOM_H * 0.5 }]; }

  function buildNightmareRoom() {
    run.rooms = [];
    run.roomIdx = 0;
    run.roomTotal = NM_ROOM_TOTAL;
    run.room = makeRoom('fight', run.floor, 0, NM_ROOM_TOTAL);
    run.room.doors = nmDoors(false);
    run.corridors = doorCorridors(run.room.doors);
    run.player = makePlayer();
    run.shots = [];
    run.foeShots = [];
    run.companion = spawnCompanion();
    if (nmHasMod('timer')) { run.nightmare.roomT = NM_ROOM_TIMER; }
  }

  /** 방이 다 찼는데(5방) 시간 안에 못 끝냈다 — 노획물만 잃고 마을로 */
  function endNightmareFail() {
    if (!run || !run.nightmare) { return null; }
    var tier = run.nightmare.tier;
    core.log('⏱️ 부적 던전 · 티어 ' + tier + '에서 시간이 다 되어 실패했다', 'bad');
    core.emit('toast', '⏱️ 시간 초과 — 부적 던전 실패');
    run = null;
    core.emit('dungeon:end', { reason: 'nightmare-fail', floor: 0, nightmare: { tier: tier } });
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 5방을 다 치웠다 — 노획물 확정 + 다음 티어 부적 60% */
  function endNightmareClear() {
    if (!run || !run.nightmare) { return null; }
    var tier = run.nightmare.tier;
    var s = settleLoot('부적 던전 완주');
    core.gainFeat(4 + tier, '부적 던전 완주');
    var nm = dstate();
    if (tier > (nm.nmBest || 0)) { nm.nmBest = tier; }
    var got = null;
    if (tier < 10 && Math.random() < 0.6) {
      var r = global.DG.item.addSigil(tier + 1);
      if (r.ok) { got = r.sigil; }
    }
    run = null;
    core.log('📜 부적 던전 완주 · 티어 ' + tier +
      (got ? (' · 다음 부적(티어 ' + got.tier + ') 획득') : ''), 'good');
    core.emit('toast', '📜 부적 던전 완주! 티어 ' + tier);
    core.emit('dungeon:end', { reason: 'nightmare', floor: 0,
      nightmare: { tier: tier, nextSigil: !!got }, loot: s });
    core.emit('changed');
    core.persist();
    return { tier: tier, gotNext: !!got };
  }

  /* ── 시련(試鍊, §5.11) — 대균열식 시간 도전 ─────────────────────
   * 원작 3편 대균열 자리. 단계를 골라 들어가 **15분 안에** 진척 막대(100)를
   * 채우면 시련 수호자가 나온다 — 쓰러뜨리면 완주, 기록이 순위표에 남고
   * 전설 한 점(비전이 붙는다, §5.10)을 받는다. 절반(7분 30초) 넘게 남기면 두 단계가 열린다.
   * 죽어도 끝나지 않는다 — 시계가 30초 깎이고 그 자리에서 일어선다(원작도 시간만 잃는다).
   * 시간이 다 되면 주운 것은 챙겨 나온다(기록·보상 없음). 적 배율은 부적과 같은 1+0.35×단계. */
  var TRIAL_SEC = 900, TRIAL_GOAL = 100, TRIAL_DEATH_SEC = 30, TRIAL_MAX = 100;
  var TRIAL_ROOMS = 999, TRIAL_BOARD = 10, TRIAL_NEED = 10;

  function trialState() {
    var d = dstate();
    if (!d.trial || typeof d.trial !== 'object') { d.trial = {}; }
    var ts = d.trial;
    if (typeof ts.best !== 'number') { ts.best = 0; }
    if (typeof ts.open !== 'number' || ts.open < 1) { ts.open = 1; }
    if (typeof ts.runs !== 'number') { ts.runs = 0; }
    if (!Array.isArray(ts.board)) { ts.board = []; }
    return ts;
  }
  function trialReady() { return (dstate().best || 0) >= TRIAL_NEED; }

  /** 처치 하나가 채우는 진척 — 정예 8 · 보스 10 · 갈라진 그림자 1 · 잡졸 3 */
  function trialPts(e) {
    if (e.trialGuardian) { return 0; }
    if (e.boss) { return 10; }
    if (e.elite) { return 8; }
    if (e.shade || e.spawned) { return 1; }
    return 3;
  }

  function trialOnKill(e) {
    var T = run.trial;
    if (e.trialGuardian) { T.won = true; return; }   // 끝내기는 다음 틱(stepTrial) — kill() 도중 run 을 비우지 않는다
    if (T.guardian) { return; }
    T.prog = Math.min(TRIAL_GOAL, T.prog + trialPts(e));
    if (T.prog >= TRIAL_GOAL) { summonTrialGuardian(); }
  }

  function summonTrialGuardian() {
    var T = run.trial, p = run.player;
    var g = spawnEnemy(run.floor, true, {
      x: core.clamp(p.x + 140, WALL + 30, ROOM_W - WALL - 30), y: ROOM_H * 0.5
    });
    g.trialGuardian = true;
    run.room.enemies.push(g);
    run.room.cleared = false;
    T.guardian = true;
    fx.push({ t: 'ring', x: g.x, y: g.y, life: 0.8 });
    core.log('⏳ 시련 수호자 — ' + enemyName(g) + ' 이(가) 나타났다', 'info');
    core.emit('toast', '⏳ 시련 수호자 등장!');
  }

  /** 순위표 — 높은 단계, 같은 단계면 빨리 끝낸 순. 들어간 자리(1~10)를 돌려준다, 밖이면 0 */
  function recordTrial(entry) {
    var ts = trialState();
    ts.board.push(entry);
    ts.board.sort(function (a, b) { return (b.lv - a.lv) || (a.sec - b.sec) || (a.at - b.at); });
    if (ts.board.length > TRIAL_BOARD) { ts.board.length = TRIAL_BOARD; }
    return ts.board.indexOf(entry) + 1;
  }

  /** @returns {boolean} 회차가 끝났으면 true */
  function stepTrial(dt) {
    var T = run.trial;
    if (T.won) { endTrialClear(); return true; }
    T.t -= dt;
    if (T.t <= 0) { endTrialFail(); return true; }
    return false;
  }

  /** 시련 중 쓰러짐 — 시계 30초를 내고 그 자리에서 일어선다 */
  function reviveTrial() {
    var T = run.trial;
    T.deaths += 1;
    T.t -= TRIAL_DEATH_SEC;
    dstate().deaths = (dstate().deaths || 0) + 1;
    if (T.t <= 0) { endTrialFail(); return; }
    run.hp = run.hpMax;
    run.player.invuln = 2;
    run.player.dots = [];
    fx.push({ t: 'ring', x: run.player.x, y: run.player.y, life: 0.7 });
    core.log('💀 시련 · 쓰러졌다 — 시계 ' + TRIAL_DEATH_SEC + '초를 내고 다시 일어선다', 'bad');
    core.emit('toast', '💀 −' + TRIAL_DEATH_SEC + '초 · 다시 일어선다');
  }

  function endTrialClear() {
    var T = run.trial, lv = T.lv;
    var left = Math.max(0, Math.round(T.t)), used = TRIAL_SEC - left;
    /* 완주 보상 — 전설 한 점(비전이 붙는다). 노획물에 얹어 같이 확정한다 */
    var IT = global.DG.item;
    if (IT && IT.roll) { run.loot.items.push(IT.roll(run.floor + lv, { tier: 4 })); }
    var s = settleLoot('시련 완주');
    core.gainFeat(6 + lv, '시련 완주');
    var ts = trialState(), jump = left >= TRIAL_SEC / 2 ? 2 : 1;
    if (lv > ts.best) { ts.best = lv; }
    ts.open = Math.min(TRIAL_MAX, Math.max(ts.open, lv + jump));
    var rank = recordTrial({ lv: lv, sec: used, hero: leadId(), deaths: T.deaths, at: Date.now() });
    run = null;
    core.log('🏆 시련 제' + lv + '단계 완주 · ' + core.fmtTime(used) + (rank ? ' · 순위 ' + rank + '위' : '') +
      ' · 제' + ts.open + '단계까지 열림', 'good');
    core.emit('toast', '🏆 시련 제' + lv + '단계 완주!');
    core.emit('dungeon:end', { reason: 'trial', floor: 0,
      trial: { lv: lv, sec: used, left: left, jump: jump, rank: rank, open: ts.open }, loot: s });
    core.emit('changed');
    core.persist();
    return { lv: lv, sec: used, rank: rank, jump: jump };
  }

  function endTrialFail() {
    var lv = run.trial.lv;
    var s = settleLoot('시련 시간 초과');
    run = null;
    core.log('⏱️ 시련 제' + lv + '단계 · 시간이 다 되었다 — 주운 것만 챙겨 나온다', 'bad');
    core.emit('toast', '⏱️ 시련 시간 초과');
    core.emit('dungeon:end', { reason: 'trial-fail', floor: 0, trial: { lv: lv }, loot: s });
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 다음 방으로 */
  function goRoom(kind) {
    if (!run || !run.room.cleared) { return false; }
    if (kind === 'stair') { return run.nightmare ? endNightmareClear() : descend(); }
    run.roomIdx += 1;
    var isLast = run.roomIdx >= run.roomTotal - 1;
    if (run.nightmare) {
      /* 마지막 방 — "정예 무리"(PLAN 원문). 일반 elite 방(하나만 정예)과
         달리 방 전체를 정예로 채운다 — `spawnEnemy`의 forceElite 를 그대로
         재사용해 스탯 계산(등급별 hp/dmg 배율)을 새로 안 만든다. */
      run.room = makeRoom('fight', run.floor, run.roomIdx, run.roomTotal);
      if (isLast) {
        var packN = 4 + Math.min(3, Math.floor(run.nightmare.tier / 3));
        run.room.enemies = [];
        for (var pi = 0; pi < packN; pi++) {
          run.room.enemies.push(spawnEnemy(run.floor, false, { forceElite: true }));
        }
        run.room.cleared = false;
      }
      run.room.doors = nmDoors(isLast);
      run.nightmare.roomT = NM_ROOM_TIMER;
    } else {
      if (run.fixed) {
        run.room = makeFixedRoom(run.fixed, run.roomIdx);
        run.room.doors = fixedDoors(run.fixed, run.roomIdx);
        core.emit('toast', run.fixed.emoji + ' ' + run.room.title + (isLast ? ' — ' + run.fixed.guard.desc : ''));
      } else {
        var isBoss = DD.isBossFloor(run.floor) && isLast;
        run.room = makeRoom(isBoss ? 'boss' : kind, run.floor, run.roomIdx, run.roomTotal);
        run.room.doors = makeDoors(run.floor, run.roomIdx, run.roomTotal);
      }
    }
    run.corridors = doorCorridors(run.room.doors);   // PLAN §28-4 Phase 2
    run.player.x = WALL + 40;
    run.player.y = ROOM_H * 0.5;
    if (run.companion) { run.companion.x = WALL + 70; run.companion.y = ROOM_H * 0.5 + 34; }
    target = null;
    if (!run.nightmare) {
      run.fieldSpawnCd = 4;
      spawnFieldEncounters(2 + Math.min(2, Math.floor(run.floor / 6)));
    }
    core.emit('dungeon:room', run.room);
    return true;
  }

  /* 결사 서약자(정본 side_vow) — 결사(하드코어)로 굴혈 깊이 10·20·30·36층을 처음 지나면 사관 묵향이 서약자 기록에 대사 한 줄을 적는다(판마다 한 번, 금·업적).
     안 해도 되는 곁가지 — 결사가 아니면 아무 일도 없다 */
  var VOW_LINES = {
    10: '사관 묵향: 결사를 걸고 열 층을 내려오셨군요. 서약자의 이름은 기록에 따로 적어 두겠습니다.',
    20: '사관 묵향: 스무 층… 되돌아갈 길을 지우고 내려온 분은 제 기록에 몇 안 됩니다. 이 줄만큼은 먹이 마르지 않게 적겠습니다.',
    30: '사관 묵향: 서른 층입니다. 결사의 서약이 이렇게 오래 이어진 적은 기록에 없습니다. 지워진 이름보다 오래 남을 줄이 될 것입니다.',
    36: '사관 묵향: 비석 너머까지 오셨군요. 이제 서약자가 아니라 이 굴혈의 증인이라 적겠습니다.'
  };
  var VOW_GOLD = 4000, VOW_FEAT = 25;
  function vowMilestone(floor) {
    if (!hardcore() || !VOW_LINES[floor]) { return false; }
    var ds = dstate();
    if (!ds.vow || typeof ds.vow !== 'object') { ds.vow = {}; }
    if (ds.vow[floor]) { return false; }
    ds.vow[floor] = true;
    core.save.player.gold = (core.save.player.gold || 0) + VOW_GOLD;
    core.gainFeat(VOW_FEAT, '결사 서약');
    core.log('☠️ ' + VOW_LINES[floor] + ' · 금 +' + core.fmt(VOW_GOLD), 'good');
    core.emit('toast', '☠️ ' + VOW_LINES[floor]);
    return true;
  }

  /** 층을 내려간다 — 노획물이 확정되고, 3층마다(보스층 주기와 같다)
   *  축복(§5.1)을 하나 고른다. 8스택 다 찼으면 더 안 뜬다. */
  function descend() {
    settleLoot('층 답파');
    dstate().clears += 1;
    if (run.floor > dstate().best) {
      dstate().best = run.floor;
      if (global.DG.prestige) { global.DG.prestige.gainSeal(1, '던전 최고 층 갱신'); }
    }
    core.gainFeat(2 + Math.floor(run.floor / 2), '던전 답파');
    run.floor += 1;
    vowMilestone(run.floor);                       // 결사 서약자 곁가지(정본 side_vow)
    run.hpMax = hpMaxOf();
    run.choice = (DD.isBossFloor(run.floor) && (run.boonPicks || 0) < BOON_MAX_STACK)
      ? rollBoonChoice() : null;
    buildFloor();
    core.log('🪜 제' + run.floor + '층으로 내려간다', 'good');
    /* 장비가 닳는다 — 원작처럼 쓰면 닳고 다 닳으면 부서진다.
       한 대 맞을 때마다 깎으면 판정 층 한복판을 건드려야 해서,
       **층을 내려가는 이 자리 하나**로 모았다 */
    if (global.DG.item.wearAll) { global.DG.item.wearAll(1); }
    registerRegion(run.floor);
    core.emit('dungeon:floor', run.floor);
    core.emit('changed');
    return true;
  }

  /** 축복(§5.1) 회차 전체 상한 — 3층마다 1 + 사당방 보너스, 합쳐서 8 */
  var BOON_MAX_STACK = 8;
  /** 희귀도 가중치 — 일반 60 · 희귀 30 · 전설 10 */
  function rollRarity(seedBase, salt) {
    var r = core.hash2(seedBase, salt);
    if (r < 0.10) { return 'legendary'; }
    if (r < 0.40) { return 'rare'; }
    return 'common';
  }
  function axisPool(axis, rarity, shapes) {
    return DD.BOONS.filter(function (b) {
      if (b.axis !== axis || b.rarity !== rarity) { return false; }
      if (axis === 'skill' && !shapes[b.shape]) { return false; }
      return true;
    });
  }
  /** 축 하나에서 카드 하나 — 등급을 굴리고, 그 등급에 후보가 없으면
   *  (예: 아직 장착한 무예가 그 모양이 아니다) 한 단계씩 물러선다. */
  function rollFromAxis(axis, shapes, seedBase, saltRarity, saltPick) {
    var order = ['legendary', 'rare', 'common'];
    var rarity = rollRarity(seedBase, saltRarity);
    var start = order.indexOf(rarity);
    var pool = [];
    for (var i = start; i < order.length && !pool.length; i++) {
      pool = axisPool(axis, order[i], shapes);
    }
    if (!pool.length) { return null; }
    var idx = Math.floor(core.hash2(seedBase, saltPick) * pool.length);
    return pool[idx].key;
  }

  /**
   * 축복 후보 셋 — 무예·인물·세계 세 축에서 하나씩(§5.1). 같은 축이 두
   * 번 나올 수 없다(축 하나당 후보 하나씩 뽑는 구조라 저절로 그렇다).
   * `Math.random()`을 안 쓴다 — `tryCatchPet()`과 같은 이유(이 파일 위쪽
   * 주석 참고)로, 진단이 100회를 돌려도 다른 자리의 Math 수열을 안 민다.
   */
  function rollBoonChoice() {
    /* 난입(§5.5)은 8스택 상한을 안 본다 — 15분 동안 레벨이 그 이상 오른다
       (원문 "회차 한정 아니라 난입 한정"). 일반 회차 상한은 그대로. */
    if (!run || (!run.horde && (run.boonPicks || 0) >= BOON_MAX_STACK)) { return []; }
    var equipped = slotSkills(), shapes = {}, i;
    for (i = 0; i < equipped.length; i++) {
      if (equipped[i]) { shapes[equipped[i].sk.shape] = true; }
    }
    var seedBase = run.floor * 131 + (run.boonPicks || 0) * 17 + run.kills;
    var out = [], skillKey = rollFromAxis('skill', shapes, seedBase, 1, 2),
      heroKey = rollFromAxis('hero', shapes, seedBase, 3, 4),
      worldKey = rollFromAxis('world', shapes, seedBase, 5, 6);
    if (skillKey) { out.push(skillKey); }
    if (heroKey) { out.push(heroKey); }
    if (worldKey) { out.push(worldKey); }
    return out;
  }

  /** 처음 본 축복은 "은사첩"에 남는다(메타 진행, §5.1) — 유적·펫 도감과
   *  같은 결(dex:new → ui.js checkDexComplete). 회차가 끝나도 안 지워진다. */
  function registerBoonDex(key) {
    var dex = core.save.dex.boons;
    if (!dex || dex[key]) { return; }
    dex[key] = true;
    core.emit('dex:new', { cat: 'boons', id: key });
  }

  /** 축복 하나를 실제로 얹는다 — 고르기(`pickBoon`)와 구출 보상(이벤트방)이
   *  같이 쓴다. 상한 확인·체력 재계산·즉시 회복까지 여기 한 곳에 모았다. */
  function applyBoon(key) {
    var b = DD.boonByKey(key);
    if (!b) { return null; }
    if ((run.boons[key] || 0) >= b.max) { return null; }
    run.boons[key] = (run.boons[key] || 0) + 1;
    run.boonPicks = (run.boonPicks || 0) + 1;
    run.hpMax = hpMaxOf();
    var heal = b.eff.healOnPick;
    if (heal) { healBy(run.hpMax * heal / 100); }
    registerBoonDex(key);
    core.emit('changed');
    return b;
  }

  function pickBoon(key) {
    if (!run || !run.choice || run.choice.indexOf(key) < 0) { return false; }
    var b = applyBoon(key);
    if (!b) { return false; }
    run.choice = null;
    core.log('🎴 축복 · ' + b.name + ' (' + b.rarity + ')', 'good');
    return true;
  }

  /** 축복을 거절한다 — 금 30×층을 내고 이번 기회를 넘긴다(§5.1). */
  function rejectBoon() {
    if (!run || !run.choice) { return false; }
    var cost = 30 * run.floor;
    core.save.player.gold = Math.max(0, core.save.player.gold - cost);
    run.choice = null;
    core.log('🎴 축복을 거절했다 · 금 -' + core.fmt(cost), 'warn');
    core.emit('toast', '🎴 축복 거절 · 금 -' + core.fmt(cost));
    core.emit('changed');
    return true;
  }

  /** 사당방에서 바로 하나 받는다 — 8스택 다 찼으면 조용히 빈 채로 온다. */
  function shrineBoon() {
    var c = rollBoonChoice();
    if (!c.length) { return null; }
    run.choice = c;
    return c;
  }

  /* ── 행상(行商) — POI: Merchant, PLAN 12절 "랜덤 상인" ──────
   * 본영 행상(vendor.js)과 값 매기는 규칙만 같이 쓰고(item.price), 재고는
   * 따로 굴린다 — 그쪽 "회차가 끝나야 재고가 새로 온다" 는 규칙을 안 건드린다.
   */
  var MERCHANT_STOCK_N = 3;
  var MERCHANT_MUL = 1.8;              // 본영 행상(3.2배)보다 싸다 — 대신 셋뿐이고 한 번뿐이다
  var MERCHANT_TIER_MAX = 2;           // 본영과 같은 상한(명품까지) — 던전에서 다 사면 내려갈 맛이 준다

  function rollMerchantStock(floor) {
    var IT = global.DG.item, D = global.DG.itemData, i, w = [];
    for (i = 0; i <= MERCHANT_TIER_MAX; i++) { w.push(D.TIERS[i].weight); }
    var total = 0; for (i = 0; i < w.length; i++) { total += w[i]; }
    var out = [];
    for (i = 0; i < MERCHANT_STOCK_N; i++) {
      var r = Math.random() * total, tier = 0, acc = 0;
      for (var j = 0; j < w.length; j++) { acc += w[j]; if (r <= acc) { tier = j; break; } }
      var g = IT.roll(floor + 1, { tier: tier, unid: false });
      out.push({ item: g, price: Math.round(IT.price(g) * MERCHANT_MUL) });
    }
    return out;
  }

  /** 행상 재고 하나를 산다. `idx` 는 `run.merchantChoice` 의 자리 */
  function buyMerchant(idx) {
    if (!run || !run.merchantChoice || !run.merchantChoice[idx]) { return { ok: false, reason: 'gone' }; }
    var row = run.merchantChoice[idx];
    var IT = global.DG.item;
    if (core.save.player.gold < row.price) { return { ok: false, reason: 'gold' }; }
    if (IT.bag().length >= IT.bagCap()) { return { ok: false, reason: 'bag' }; }
    core.save.player.gold -= row.price;
    IT.add(row.item);
    run.merchantChoice.splice(idx, 1);
    if (!run.merchantChoice.length) { run.merchantChoice = null; }
    sfx('coin');
    core.log('🧺 ' + IT.name(row.item) + ' 을(를) 샀다 · 금 -' + core.fmt(row.price), 'info');
    core.emit('changed');
    return { ok: true, item: row.item, cost: row.price };
  }

  /** 행상 자리를 떠난다 (사지 않고 닫는다) */
  function leaveMerchant() {
    run.merchantChoice = null;
    core.emit('changed');
  }

  /* ── 퍼즐(POI: Puzzle) ────────────────────────────────────
   * 제단 셋을 맞는 순서로 밟는다. 틀리면 처음부터 — 벌은 없다(머리로
   * 푸는 방이라 몸싸움을 안 섞었다, PLAN 13절 "환경 상호작용"과 같은 결).
   */
  function touchPuzzlePod(room, pz, pod) {
    if (pz.order[pz.progress] === pod.idx) {
      pod.lit = true;
      pz.progress++;
      sfx('door');
      if (pz.progress >= pz.order.length) {
        pz.solved = true;
        dropItem(room, ROOM_W * 0.62, ROOM_H * 0.5, 20);
        dropGold(room, ROOM_W * 0.62, ROOM_H * 0.5, 2.4);
        sfx('chest');
        core.emit('toast', '🧩 퍼즐을 풀었다!');
      } else {
        core.emit('toast', '🧩 ✓ · 다음 제단 (' + pz.progress + '/' + pz.order.length + ')');
      }
    } else {
      var wasProgress = pz.progress > 0;
      pz.progress = 0;
      for (var i = 0; i < pz.pods.length; i++) { pz.pods[i].lit = false; }
      if (wasProgress) { core.emit('toast', '🧩 ✗ · 처음부터'); }
    }
  }

  /* ── 노획물 ───────────────────────────────────────────── */

  /** 층을 내려가거나 탈출할 때 확정 */
  function settleLoot(why) {
    if (!run) { return null; }
    var g = Math.round(run.loot.gold);
    var kept = 0, i;
    core.save.player.gold += g;
    for (i = 0; i < run.loot.items.length; i++) {
      var r = global.DG.item.add(run.loot.items[i]);
      if (r.kept) { kept++; }
    }
    var n = run.loot.items.length;
    run.loot = { gold: 0, items: [] };
    if (g || n) {
      core.log('💼 노획물 확정 (' + why + ') · 금 ' + core.fmt(g) + ' · 장비 ' + n + '점', 'good');
    }
    return { gold: g, items: n, kept: kept };
  }

  /** 탈출 — 지금까지 얻은 것을 지키고 나온다 */
  function leave() {
    if (!run) { return null; }
    var s = settleLoot('탈출');
    var floor = run.floor;
    core.log('🚪 던전에서 나왔다 · 제' + floor + '층까지', 'info');
    run = null;
    core.emit('dungeon:end', { reason: 'leave', floor: floor, loot: s });
    core.emit('changed');
    core.persist();
    return s;
  }

  /**
   * 결사(決死) — 원작의 하드코어.
   * 켜면 **쓰러지는 순간 그 프로필이 끝난다.** 켜는 것은 되돌릴 수 없다 —
   * 되돌릴 수 있으면 그건 하드코어가 아니다.
   */
  var WAYPOINT_EVERY = 5;

  /** 밟은 역참 중 가장 깊은 곳 */
  function waypoint() { return dstate().waypoint || 0; }

  function markWaypoint(floor) {
    var d = dstate();
    if ((d.waypoint || 0) >= floor) { return false; }
    d.waypoint = floor;
    sfx('waypoint');
    core.log('🪜 역참 · 제' + floor + '층 — 다음부터 여기서 시작할 수 있다', 'good');
    core.emit('changed');
    return true;
  }

  function hardcore() { return !!(core.save.dungeon && core.save.dungeon.hardcore); }

  function setHardcore() {
    dstate().hardcore = true;
    core.log('☠️ 결사(決死) — 이제 쓰러지면 이 판이 끝난다', 'bad');
    core.emit('changed');
    return true;
  }

  function die() {
    /* 난입(§5.5) 사망은 결사·유품과 다른 결이다 — "층" 이 진짜가 아니라서
       (floor 는 적 배율용 대역값이다) 유품 층 번호가 엉뚱하게 겹칠 수
       있다. 최고 생존 기록만 남기고 간단히 끝낸다. */
    /* 시련(§5.11)은 죽어도 안 끝난다 — 시계만 깎인다 */
    if (run.trial) { reviveTrial(); return; }
    if (run.horde) { dieHorde(); return; }
    /* 부적 던전(§5.3) 사망도 같은 이유(floor 대역값)로 결사·유품과 안
       엮인다 — 실패로 끝내고 부적은 이미 굴혈에서 소모됐으니 그걸로 끝. */
    if (run.nightmare) { dieNightmare(); return; }
    var lostGold = Math.round(run.loot.gold), lostItems = run.loot.items.length;
    var lostItemsArr = run.loot.items.slice();
    var floor = run.floor, where = { floor: floor, room: run.roomIdx || 0, rooms: run.roomTotal || 0, lastHit: run.lastHit || null };   // W-0102 사망 카드
    dstate().deaths = (dstate().deaths || 0) + 1;
    core.log('💀 제' + floor + '층에서 쓰러졌다 — 노획물 소실 (금 ' +
      core.fmt(lostGold) + ' · 장비 ' + lostItems + '점)', 'bad');
    run = null;
    core.emit('dungeon:end', { reason: 'dead', floor: floor, lost: { gold: lostGold, items: lostItems }, where: where, hardcore: hardcore() });
    /* 결사(決死) — 원작의 하드코어. 쓰러지면 그 판이 끝난다. 유품도 없다 —
       하드코어는 되돌릴 길이 아예 없어야 한다(§5.2). */
    if (hardcore()) {
      dstate().fallen = { floor: floor, at: Date.now() };
      core.log('☠️ 결사 — 제' + floor + '층에서 스러졌다. 이 판은 여기까지다', 'bad');
      core.emit('toast', '☠️ 결사 — 이 판이 끝났습니다 (제' + floor + '층)');
      core.emit('dungeon:fallen', floor);
      core.persist();
      return;
    }
    /* 유품(§5.2) — 잃은 노획물이 그 층에 남는다. 회수 전에 다시 죽으면
       옛 유품은 사라지고 새 것만 남는다(덮어쓰기, 1개만 유지). */
    if (lostGold > 0 || lostItemsArr.length) {
      dstate().grave = { floor: floor, gold: lostGold, items: lostItemsArr, at: Date.now() };
    }
    core.emit('toast', '💀 제' + floor + '층에서 패퇴 — 노획물을 잃었습니다');
    core.emit('changed');
    core.persist();
  }

  /** 난입(§5.5) 전용 사망 — 결사·유품과 안 엮인다(die() 위 주석). 지금까지
   *  버틴 초가 기록에 남는다(생존 완주와 같은 `dstate().horde.best`). */
  function dieHorde() {
    var secs = Math.round(run.hordeT || 0);
    var lostGold = Math.round(run.loot.gold), lostItems = run.loot.items.length;
    dstate().deaths = (dstate().deaths || 0) + 1;
    var hs = dstate().horde || (dstate().horde = { best: 0, runs: 0 });
    if (secs > (hs.best || 0)) { hs.best = secs; }
    core.log('💀 난입 · ' + secs + '초 생존 후 쓰러졌다 (금 ' +
      core.fmt(lostGold) + ' · 장비 ' + lostItems + '점)', 'bad');
    run = null;
    core.emit('dungeon:end', { reason: 'dead', floor: 0,
      horde: { secs: secs }, lost: { gold: lostGold, items: lostItems } });
    core.emit('toast', '💀 난입 · ' + secs + '초 생존');
    core.emit('changed');
    core.persist();
  }

  /** 부적 던전(§5.3) 전용 사망 — 부적은 이미 굴혈에서 소모됐으니 되돌려
   *  주지 않는다(원작 소모품 규칙 그대로). `dstate().nmBest`는 완주만
   *  올린다(die는 실패지 기록이 아니다). */
  function dieNightmare() {
    var tier = run.nightmare.tier;
    var lostGold = Math.round(run.loot.gold), lostItems = run.loot.items.length;
    dstate().deaths = (dstate().deaths || 0) + 1;
    core.log('💀 부적 던전 · 티어 ' + tier + '에서 쓰러졌다 (금 ' +
      core.fmt(lostGold) + ' · 장비 ' + lostItems + '점)', 'bad');
    run = null;
    core.emit('dungeon:end', { reason: 'dead', floor: 0,
      nightmare: { tier: tier }, lost: { gold: lostGold, items: lostItems } });
    core.emit('toast', '💀 부적 던전 실패 · 티어 ' + tier);
    core.emit('changed');
    core.persist();
  }

  /* ── 유품(遺品, §5.2) ─────────────────────────────────────
   * 죽으면 노획물이 그 층 표식으로 남고 가방엔 안 들어온다. 다음에 그
   * 층에 닿으면 표식을 밟아 되찾는다 — 금은 100%, 장비는 3점까지 고른다.
   */
  var GRAVE_ITEM_MAX = 3;

  /** 지금 유품이 있는 층인가(층 안 조회용) */
  function graveOf() { return dstate().grave || null; }

  /** 표식을 밟았다 — 고를 카드를 연다 */
  function openGrave() {
    var g = dstate().grave;
    if (!run || !g || g.floor !== run.floor) { return null; }
    run.graveChoice = { gold: g.gold, items: g.items.slice(), picked: [] };
    return run.graveChoice;
  }

  /** 회수할 장비를 고르거나 뺀다 — 상한 3(GRAVE_ITEM_MAX) */
  function toggleGraveItem(idx) {
    if (!run || !run.graveChoice || !run.graveChoice.items[idx]) { return false; }
    var picked = run.graveChoice.picked, at = picked.indexOf(idx);
    if (at >= 0) { picked.splice(at, 1); return true; }
    if (picked.length >= GRAVE_ITEM_MAX) { return false; }
    picked.push(idx);
    return true;
  }

  /** 고른 대로 확정한다 — 금 100%, 장비는 고른 만큼만(나머지 소멸) */
  function claimGrave() {
    if (!run || !run.graveChoice) { return null; }
    var gc = run.graveChoice, IT = global.DG.item, kept = 0, i;
    core.save.player.gold += gc.gold;
    for (i = 0; i < gc.picked.length; i++) {
      var it = gc.items[gc.picked[i]];
      if (it && IT.add(it).kept) { kept++; }
    }
    run.graveChoice = null;
    dstate().grave = null;
    core.log('🪦 유품 회수 · 금 ' + core.fmt(gc.gold) + ' · 장비 ' + kept + '점', 'good');
    core.emit('toast', '🪦 유품을 되찾았다');
    core.emit('changed');
    core.persist();
    return { gold: gc.gold, items: kept };
  }

  /* ── 피해 · 회복 ─────────────────────────────────────── */

  function healBy(amount) {
    if (!run) { return; }
    run.hp = Math.min(run.hpMax, run.hp + Math.round(amount));
  }

  /**
   * 단약(丹藥)이 부르는 창구 — 체력·기력을 최대치의 몇 % 만큼 채운다.
   * 체력과 기력의 정본은 이 파일이라, 물약이 run 을 직접 만지지 않게 여기로 모은다.
   * **이미 가득이면 false** 를 돌려준다 — 그러면 potion.js 가 그 알을 안 쓴다.
   */
  function refill(hpPct, mpPct, text, color) {
    if (!run) { return false; }
    var did = false;
    if (hpPct && run.hp < run.hpMax) { healBy(run.hpMax * hpPct / 100); did = true; }
    if (mpPct && run.mp < run.mpMax) {
      run.mp = Math.min(run.mpMax, run.mp + run.mpMax * mpPct / 100);
      did = true;
    }
    if (did && text) {
      fx.push({ t: 'get', x: run.player.x, y: run.player.y,
                text: text, color: color || '#c0392b', life: 0.9 });
    }
    return did;
  }

  /**
   * @param el 이 공격의 결 (없으면 물리). 갑주에 박은 보석이 그 결을 막는다 —
   *           **원작에서 갑옷에 젬을 박는 이유가 바로 이것**이다.
   */
  function hurtPlayer(amount, el, src, how) {   // src·how — 마지막 피해(사망 카드 W-0102): 적 개체·이름, 무슨 공격
    if (!run) { return; }
    if (run.player.invuln > 0) { return; }        // 돌진 중에는 맞지 않는다
    amount = amount * (1 - boonVal('guardPct') / 100);
    if (el && el !== 'phys') { amount *= 1 - elemResOf(el) / 100; }
    if (nmHasMod('glass')) { amount *= 1.5; }   // 부적 '유리대포' 변형자(§5.3) — 받는 피해도 는다
    amount = Math.max(1, amount);
    run.hp -= amount; run.lastHit = { who: src ? (typeof src === 'string' ? src : enemyName(src)) : '', how: how || (global.DG.grace ? global.DG.grace.howOf(el) : '') };
    run.player.hurt = 0.28;
    if (global.DG.mount && global.DG.mount.onHurt) { global.DG.mount.onHurt(); }      // 탈것 — 맞으면 내린다
    fx.push({ t: 'hit', x: run.player.x, y: run.player.y, v: Math.round(amount),
              life: 0.7, foe: true, el: el && el !== 'phys' ? el : null });
    sfx('hurt');
    /* 맞으면 콤보가 끊긴다 — 안 맞고 계속 때려야 이어지는 긴장감(축2 손맛) */
    run.combo = 0; run.comboT = 0;
    if (run.hp <= 0) { die(); }
  }

  /**
   * 보스 패턴(PLAN 15절) — 2026-09-05까지는 보스 열 종 전부가 스탯만 다른
   * 같은 "강타" 하나였다(무기·색·이름만 다르고 공격은 하나). `data-enemy.js`
   * `BOSSES`가 이미 갖고 있던 `look.weapon`(club·axe·sword·spear·halberd)으로
   * 넷을 가른다 — 새 필드 없이 기존 표만 읽는다. 예고(telegraph) 뒤 터지는
   * 공통 리듬은 그대로 두고, 무기마다 판정 모양·박자만 바꿨다. `en.slamWarn`·
   * `en.slamCd`는 이제 "강타 전용"이 아니라 **이 보스가 쓰는 패턴 하나의
   * 공용 타이머**다(보스 하나는 평생 무기 하나만 쓰므로 겹칠 일이 없다).
   */
  function bossPattern(en, p, ed, dt) {
    /* 세계 보스(§5.4) 무기 부위가 부서지면 이 패턴 자체가 안 나온다
       ("부위 파괴 시 그 패턴 봉인", PLAN 원문) — `en.ref.look`은 data-enemy.js
       의 공용 정의라 여기서 지우면 그 보스종 전체가 오염된다, 그래서 이
       개체 하나만의 플래그(`wbWeaponBroken`)로 우회한다. */
    if (en.wbWeaponBroken) { return; }
    var lookW = en.ref && en.ref.look && en.ref.look.weapon;
    if (lookW === 'axe') { return bossCharge(en, p, dt); }
    if (lookW === 'spear' || lookW === 'halberd') { return bossThrust(en, p, dt); }
    if (lookW === 'sword') { return bossFlurry(en, p, dt); }
    return bossSlam(en, p, dt);   // club·그 외 — 기존 강타(원래 유일했던 패턴)
  }

  /** club — 강타: 제자리 원형 AOE, 큰 배율 한 방(기존 그대로, 이름만 함수로 뺐다) */
  function bossSlam(en, p, dt) {
    if (en.slamWarn > 0) {
      en.slamWarn -= dt;
      if (en.slamWarn <= 0) {
        if (dist(en, p) < SLAM_RANGE) {
          hurtPlayer(en.dmg * SLAM_MUL, en.ref && en.ref.atkEl, en, '강타');
          if (!run) { return; }
        }
        fx.push({ t: 'pop', x: en.x, y: en.y, life: 0.5, boss: true });
        en.slamCd = 6 + Math.random() * 2;
      }
    } else {
      en.slamCd = (en.slamCd === undefined ? 4 : en.slamCd) - dt;
      if (en.slamCd <= 0) {
        en.slamWarn = SLAM_WARN;
        fx.push({ t: 'whirl', x: en.x, y: en.y, r: SLAM_RANGE, life: SLAM_WARN,
          el: 'fire', color: '#ff6a3a' });
      }
    }
  }

  /** axe — 돌진: 예고가 끝나는 순간 플레이어 쪽으로 순간 다가선다(간격을
   *  확 좁힌다) — 제자리에서 터지는 강타와 달리 물러서도 한 번은 따라붙는다,
   *  대신 반경은 강타보다 훨씬 좁다(붙어야만 맞는다) */
  function bossCharge(en, p, dt) {
    if (en.slamWarn > 0) {
      en.slamWarn -= dt;
      if (en.slamWarn <= 0) {
        var cd = dist(en, p) || 1;
        var step = Math.min(CHARGE_STEP, Math.max(0, cd - en.r - P_R));
        en.x += (p.x - en.x) / cd * step;
        en.y += (p.y - en.y) / cd * step;
        if (dist(en, p) < en.r + P_R + 14) {
          hurtPlayer(en.dmg * CHARGE_MUL, en.ref && en.ref.atkEl, en, '돌진');
          if (!run) { return; }
        }
        fx.push({ t: 'burst', x: en.x, y: en.y, life: 0.4, color: '#ffb43a' });
        en.slamCd = 5 + Math.random() * 2;
      }
    } else {
      en.slamCd = (en.slamCd === undefined ? 3.5 : en.slamCd) - dt;
      if (en.slamCd <= 0) {
        en.slamWarn = CHARGE_WARN;
        fx.push({ t: 'ring', x: en.x, y: en.y, r: 26, life: CHARGE_WARN, color: '#ffb43a' });
      }
    }
  }

  /** spear·halberd — 관통: 예고가 뜨는 순간 방향을 고정해 두고(플레이어가
   *  그 사이 옆으로 피할 수 있게), 끝나면 그 방향 정면 부채꼴로 사거리가
   *  훨씬 긴 한 방을 찌른다 — 제자리 AOE가 아니라 **방향이 있는** 공격 */
  function bossThrust(en, p, dt) {
    if (en.slamWarn > 0) {
      en.slamWarn -= dt;
      if (en.slamWarn <= 0) {
        var fdx = en.faceX || 1, fdy = en.faceY || 0;
        var tdx = p.x - en.x, tdy = p.y - en.y;
        var td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        if (td <= THRUST_RANGE && (tdx * fdx + tdy * fdy) / td >= Math.cos(THRUST_HALF)) {
          hurtPlayer(en.dmg * THRUST_MUL, en.ref && en.ref.atkEl, en, '찌르기');
          if (!run) { return; }
        }
        fx.push({ t: 'slash', x: en.x + fdx * THRUST_RANGE * 0.5,
          y: en.y + fdy * THRUST_RANGE * 0.5, life: 0.35, color: '#8ad0ff' });
        en.slamCd = 5 + Math.random() * 2;
      }
    } else {
      en.slamCd = (en.slamCd === undefined ? 4 : en.slamCd) - dt;
      if (en.slamCd <= 0) {
        var fl0 = dist(en, p) || 1;
        en.faceX = (p.x - en.x) / fl0; en.faceY = (p.y - en.y) / fl0;
        en.slamWarn = THRUST_WARN;
        fx.push({ t: 'ring', x: en.x + en.faceX * THRUST_RANGE * 0.5,
          y: en.y + en.faceY * THRUST_RANGE * 0.5, r: 46, life: THRUST_WARN, color: '#8ad0ff' });
      }
    }
  }

  /** sword — 연환격: 예고 뒤 짧은 간격으로 세 번 벤다(누적 배율은 강타 급이지만
   *  박자가 다르다 — 회피 타이밍을 한 번이 아니라 여러 번 요구한다) */
  function bossFlurry(en, p, dt) {
    if (en.flurryLeft > 0) {
      en.flurryT -= dt;
      if (en.flurryT <= 0) {
        if (dist(en, p) < en.r + P_R + 10) {
          hurtPlayer(en.dmg * FLURRY_MUL, en.ref && en.ref.atkEl, en, '연격');
          if (!run) { return; }
        }
        fx.push({ t: 'slash', x: p.x, y: p.y, life: 0.3, color: '#ff7a7a' });
        en.flurryLeft--;
        en.flurryT = FLURRY_GAP;
      }
    } else if (en.slamWarn > 0) {
      en.slamWarn -= dt;
      if (en.slamWarn <= 0) {
        en.flurryLeft = FLURRY_HITS;
        en.flurryT = 0;
        en.slamCd = 6 + Math.random() * 2;
      }
    } else {
      en.slamCd = (en.slamCd === undefined ? 4 : en.slamCd) - dt;
      if (en.slamCd <= 0) {
        en.slamWarn = FLURRY_WARN;
        fx.push({ t: 'whirl', x: en.x, y: en.y, r: en.r + P_R + 20, life: FLURRY_WARN, color: '#ff7a7a' });
      }
    }
  }

  /* ── 진행 ─────────────────────────────────────────────── */

  function setInput(dx, dy) { input.dx = dx; input.dy = dy; if (dx || dy) { target = null; } }
  function moveTo(x, y) { target = { x: x, y: y }; }

  /* ── 방 밖 들판으로 나간다 (PLAN 4·5·6절의 나머지 절반) ─────
   * `field3d.js` 가 방 둘레에 세워 둔 세상은 여태 **눈에만 보였다** — 판정은
   * 여전히 방 사각형 안에만 사람을 가뒀다. 여기서 그 절반을 마저 잇는다.
   *
   * 방 안(옛 사각형)에서는 **한 줄도 안 바뀐다** — 문 판정(`p.x > ROOM_W - WALL
   * - P_R - 4`)이 그 경계에 그대로 물려 있으므로, 방 안 동작을 건드리면 그 판정도
   * 같이 흔들린다. 대신 **방 밖으로는 더 나갈 수 있게** 사각형을 넓히고, 들판에
   * 실제로 서 있는 소품(나무·바위·기둥·무너진 벽·절벽·굴 입구)과는 부딪힌다 —
   * `dungeon3d.js` 가 그리는 것과 **같은 값**(`field3d.chunkAt`)을 그대로 읽으므로
   * 눈에 보이는 나무를 그대로 통과하는 일은 없다.
   *
   * 렌더러가 없어도(자가진단) 그대로 돈다 — `field3d` 는 순수 함수다.
   */
  function fieldOn() {
    var D3 = global.DG.dungeon3d;
    return !D3 || !D3.tuned || D3.tuned('dg3d.field', 1) ? true : false;
  }
  function fieldRadiusUnits() {
    var D3 = global.DG.dungeon3d;
    var F = global.DG.field3d;
    /* 2026-09-04 — 예전엔 `D3.tuned('dg3d.fieldR', 6)`로 읽어 손잡이가
       비어 있으면(AUTO, 보통 이 경우다) **하드코딩된 6(HIGH 등급)**으로
       떨어졌다. 그런데 실제로 세워지는 들판 반경(`dungeon3d.fieldR()`)은
       AUTO 등급표(`QUALITY_PRESET`)를 따라 low=2·medium=4·high=6 로 오간다
       — 이 둘이 갈라지면, 여기(마을 출구 팻말 같은 결정 지점 배치)가 늘
       "반경 6"으로 셈하는 사이 실제 땅은 실기기 성능에 따라 그보다 훨씬
       좁게 깔린다. 그 결과가 실기기 제보 "들판에 각진 새까만 사각형" —
       팻말은 (하드코딩된) 6 기준 자리에 섰는데 땅은 AUTO가 낮춘 반경까지만
       깔려, 팻말 둘레만 등등 떠 보이고 나머지는 배경(검정)이 그대로
       비친 것이었다. `D3.fieldR()`(공개 함수, `QUALITY_PRESET`을 그대로
       따른다)를 직접 불러 **실제로 깔리는 반경과 항상 같은 값**을 쓰게
       고쳤다 — 방향광 그림자를 플레이어에 따라가게 한 앞선 시도는 원인이
       아니었다(고립 렌더로 직접 검증, 지우지 않고 남겨 둔다 — 해는 없다). */
    var r = (D3 && D3.fieldR) ? D3.fieldR() : 6;
    return r * (F ? F.CHUNK : 200);
  }
  /**
   * @param ctx 방 치수가 던전과 다른 곳(마을 등)이 빌려 쓸 때만 넘긴다 —
   *            {roomW, roomH, wall, pr}. 없으면 이 방(던전)의 치수 그대로다.
   */
  /**
   * @param ctx.anchor {x,y} — 이 방의 로컬 원점(0,0)이 실제로 서 있는 세계
   *        좌표(PLAN §28-8, 사가나락 오픈월드). 없으면(0,0) — 예전과 완전히
   *        같다(던전 방은 늘 이 필드가 없다, 회귀 없음).
   */
  function inRoomRect(x, y, ctx) {
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL, pr = (ctx && ctx.pr) || P_R;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var lo = wl + pr;
    return x >= ax + lo - 0.01 && x <= ax + rw - wl - pr + 0.01 &&
           y >= ay + lo - 0.01 && y <= ay + rh - wl - pr + 0.01;
  }
  /* 들판 소품 중 **막는 것만** 고른다 — 길·이정표·연못가 갈대 같은 장식은
     지나갈 수 있어야 걷는 맛이 안 답답하다. */
  var FIELD_BLOCK = { tree: 1, rock: 1, pillar: 1, wall: 1, cavemouth: 1 };
  function pieceRadius(pc) {
    var s = pc.s || 1;
    if (pc.t === 'tree') { return 5 * s + 6; }
    if (pc.t === 'rock') { return pc.h * 0.55 * s; }
    if (pc.t === 'pillar') { return 12; }
    if (pc.t === 'wall') { return 46; }             // 길쭉해 원으로 뭉뚱그린다(넉넉하게)
    if (pc.t === 'cavemouth') { return pc.h * 0.6; }
    return 0;
  }
  /**
   * (x,y) 언저리 아홉 조각의 소품과 부딪히는지 — three 없이도 돈다.
   * @param ctx 마을처럼 방 치수·층·씨앗이 던전과 다른 곳이 빌려 쓸 때만 넘긴다 —
   *            {roomW, roomH, pr, floor, roomIdx, theme}.
   */
  function fieldBlockedAt(x, y, ctx) {
    var MTb = global.DG.mount;
    if (MTb && MTb.flying && MTb.flying() && ctx && ctx.town) { return false; }      // 학·용을 타고 뜨면 마을·들판 소품(나무·바위·건물)을 넘는다(mount.js)
    var F = global.DG.field3d;
    var floor = ctx ? ctx.floor : (run && run.floor);
    if (!F || floor === undefined || floor === null) { return false; }
    /* 고정 세계 지도(§5.12, world-map.js) — 마을·들판은 세계 칸 좌표 하나로 정해진
       소품만 본다. 서 있는 마을이 바뀌어도 발밑이 안 바뀌고, 그림(dungeon3d)과 같은 배열이다 */
    var WM = global.DG.worldMap;
    if (ctx && ctx.town && WM) {
      var wW = ctx.roomW || ROOM_W, wH = ctx.roomH || ROOM_H, wpr = ctx.pr || P_R;
      var wcx = Math.floor(x / F.CHUNK), wcz = Math.floor(y / F.CHUNK), qx, qz, qi, ql, qp, qr;
      for (qz = wcz - 1; qz <= wcz + 1; qz++) {
        for (qx = wcx - 1; qx <= wcx + 1; qx++) {
          ql = WM.pieces(qx, qz, wW, wH);
          for (qi = 0; qi < ql.length; qi++) {
            qp = ql[qi];
            if (!FIELD_BLOCK[qp.t]) { continue; }
            qr = pieceRadius(qp);
            if (qr > 0 && Math.hypot(x - qp.x, y - qp.z) < qr + wpr) { return true; }
          }
        }
      }
      return false;
    }
    var roomIdx = ctx ? ctx.roomIdx : (run && run.roomIdx);
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var pr = (ctx && ctx.pr) || P_R;
    var DDf = global.DG.dataDungeon;
    var th = (ctx && ctx.theme) || (run && run.theme) || (DDf ? DDf.themeOf(floor) : null);
    var seed = F.seedOf(floor, roomIdx, th && th.name);
    var corridors = ctx && ctx.corridors;
    /* 앵커(PLAN §28-8) — 이 방의 로컬 원점이 서 있는 세계 좌표. ring(방으로부터
       몇 칸 떨어졌나)은 로컬 기준으로 재야 하므로 칸 좌표에서 빼 준다. 다만
       chunkAt() 자체엔 절대 좌표(cx,cz)를 그대로 넘긴다 — 그래야 마을이든 들판
       이든 같은 칸이 늘 같은 지형을 낸다(이어진 세계의 핵심 불변식). */
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var acx = Math.floor(ax / F.CHUNK), acz = Math.floor(ay / F.CHUNK);
    var ccx = Math.floor(x / F.CHUNK), ccz = Math.floor(y / F.CHUNK), cx, cz, i, pc, r;
    for (cz = ccz - 1; cz <= ccz + 1; cz++) {
      for (cx = ccx - 1; cx <= ccx + 1; cx++) {
        var ring = F.ringOf(cx - acx, cz - acz, rw, rh);
        if (ring === 0) { continue; }              // 방이 걸친 조각엔 소품이 없다
        /* th.name 을 그대로 넘긴다 — dungeon3d.js 가 그리는 것과 같은 편향
           표를 써야 한다(2026-09-05, PLAN 9절 Biome). 안 넘기면 seed 는
           같아도 `kindOf()`가 다른 문턱으로 풀어 **그림과 부딪힘이 어긋난다**
           (보이는 건 나무인데 그 자리는 벽처럼 막힌, 또는 그 반대인 자리가
           생긴다는 뜻 — 실제로 걸어 보지 않으면 안 드러나는 종류의 버그라
           여기 적어 둔다). **통로(PLAN §28-2 Phase 3)도 같은 이유로 같은
           결 판정을 쓴다** — `corridorNameAt()`가 재는 자리가 dungeon3d.js
           의 그림 쪽과 정확히 같아야, 통로 안에서 "보이는 건 나루터 물길인데
           자리는 산길 바위로 막힌" 어긋남이 안 생긴다. 던전 방-방 통로
           (PLAN §28-4 Phase 3)도 같은 이유로 같다 — 계단문 통로만
           `통로:계단`으로 갈리고, 그 밖의 문은 층 테마를 그대로 쓴다. */
        var cTheme = (corridors && F.corridorNameAt) ? F.corridorNameAt(cx, cz, rw, rh, corridors) : null;
        /* th.biome(PLAN §28-8 Phase 3, 절차 생성 마을) — THEME_BIAS 표를
           찾는 이름만 th.biome로 바꾼다(없으면 th.name, 예전과 100% 같다).
           seed(위)는 여전히 th.name(마을마다 고유)로 재 — 같은 biome을
           공유하는 마을 여럿이 똑같은 지형 패턴을 복붙한 듯 반복하지
           않는다, 성격(가중치)만 같고 실제 배치는 마을마다 다르다. */
        /* §5.19 — 그림(dungeon3d `FIELD_D()`, 등급별 0.16~0.375)과 **같은 밀도**로 잰다. 여태 1 로 재서
           안 보이는 나무·바위의 절반 넘게가 길을 막았다. chunkAt 은 밀도가 낮으면 앞쪽 부분집합이라 어긋나지 않는다 */
        var D3f = global.DG.dungeon3d, fDens = D3f && D3f.fieldDens ? D3f.fieldDens() : 1;
        var list = F.chunkAt(cx, cz, seed, ring, fDens, cTheme || (th && (th.biome || th.name)));
        for (i = 0; i < list.length; i++) {
          pc = list[i];
          if (!FIELD_BLOCK[pc.t]) { continue; }
          r = pieceRadius(pc);
          if (r > 0 && Math.hypot(x - pc.x, y - pc.z) < r + pr) { return true; }
        }
      }
    }
    return false;
  }
  /**
   * 사각형 벽(방 안)은 그대로 지키고, 방 밖은 들판 반경까지 넓힌다.
   * 축을 나눠 시도해 **한쪽이 막혀도 다른 쪽은 미끄러진다**(대각선으로 나무에
   * 부딪혀도 그대로 안 멎는다 — 사가만리 벽 충돌이 밟아 둔 요령과 같다).
   */
  /**
   * 통로(PLAN §28-2 Phase 2) — `ctx.corridors`의 `{dir,extra,lane,laneAt}` 항목
   * 중 방향이 맞는 것을 **전부** 돌려준다(배열). 마을은 방향(N/E/S/W)당 통로가
   * 하나뿐이라 옛날엔 첫 매치 하나면 됐지만, 던전 방은 **한 방향(E)에 문이
   * 여러 개**(PLAN §28-4 Phase 2) 있어 문마다 다른 결(lane)을 가진 통로가
   * 동시에 여러 개 존재한다 — 그래서 배열로 바꿨다. `ctx.corridors`가 없으면
   * (던전 층·마을이 corridors를 안 넘기면) `null` — 예전과 완전히 같다.
   */
  function corridorReach(ctx, dir) {
    if (!ctx || !ctx.corridors) { return null; }
    var out = null, i;
    for (i = 0; i < ctx.corridors.length; i++) {
      if (ctx.corridors[i].dir === dir) { (out = out || []).push(ctx.corridors[i]); }
    }
    return out;
  }
  /**
   * 방향 dir 로 뻗은 통로들 중 좌표(coord)가 그 결 안에 있는 것들의 `extra`
   * 최댓값(없으면 0) — `boundPlayer`가 그대로 클램프 확장분으로 쓴다.
   * `laneAt`이 없으면(마을 통로처럼 방향당 하나뿐이면) `dflt`(방 중심)와
   * 비교한다 — 옛 동작과 완전히 같다. `laneAt`이 있으면(던전 문마다 다른
   * y) 그 값과 비교해 **문별로 결을 가른다**.
   */
  function corridorExtra(ctx, dir, coord, dflt) {
    var list = corridorReach(ctx, dir), best = 0, i, co, laneAt;
    if (!list) { return 0; }
    for (i = 0; i < list.length; i++) {
      co = list[i];
      laneAt = (co.laneAt != null) ? co.laneAt : dflt;
      if (Math.abs(coord - laneAt) < (co.lane || 0)) { best = Math.max(best, co.extra || 0); }
    }
    return best;
  }
  /**
   * 문마다 통로 하나(PLAN §28-4 Phase 2) — 방향은 늘 'E'(문은 항상 동쪽
   * 벽에 있다), 결 중심(`laneAt`)은 그 문의 y. 마을 통로(4칸)보다 짧다
   * (방 하나 분량이면 충분하다). **방 치수(ROOM_W 등)는 그래픽 등급과
   * 무관한 상수라, 마을 통로가 겪은 AUTO 품질 클램프 함정(2026-09-06,
   * `town.js`의 `builtFieldR`)이 여기엔 없다** — `extra`는 처음부터
   * 고정값이고 매 프레임 다시 계산되는 값에 안 얹는다.
   */
  var DOOR_CORRIDOR_LEN = 1;              // CHUNK 칸 수
  var DOOR_LANE = 34;                     // 옛 문 터치 판정과 같은 반폭
  function doorCorridorUnits() {
    var F = global.DG.field3d;
    return DOOR_CORRIDOR_LEN * (F ? F.CHUNK : 200);
  }
  function doorCorridors(doors) {
    var len = doorCorridorUnits(), out = [], i;
    for (i = 0; i < doors.length; i++) {
      out.push({ dir: 'E', lane: DOOR_LANE, laneAt: doors[i].y, extra: len, kind: doors[i].kind });
    }
    return out;
  }
  /**
   * @param ctx 마을처럼 방 치수·씨앗이 던전과 다른 곳이 빌려 쓸 때만 넘긴다
   *            (inRoomRect·fieldBlockedAt 에 그대로 물려 준다).
   *            `ctx.corridors` — 마을의 들길 통로 예외(위 corridorReach 참고).
   */
  /** 세계 한계(PLAN §28-8) — noRoom(들판, 어느 마을 발판도 아닌 곳)에서
   *  좌표가 한없이 안 커지게만 잡아 두는 바깥 테두리. 지금 세워 둔 앵커
   *  (moru 원점, 위성 4800 안팎)보다 훨씬 넉넉해 실제로는 안 걸린다. */
  var WORLD_LIMIT = 60000;
  /**
   * @param ctx 방 치수·씨앗이 던전과 다른 곳(마을 등)이 빌려 쓸 때만 넘긴다 —
   *            {roomW, roomH, wall, pr}. 없으면 이 방(던전)의 치수 그대로다.
   *            `ctx.anchor` {x,y} — 이 방의 로컬 원점이 서 있는 세계 좌표
   *            (PLAN §28-8). 없으면(0,0) — 던전 방은 늘 없다, 회귀 없음.
   *            `ctx.noRoom` — 방 사각형 자체가 없는 열린 들판(마을 발판
   *            사이). 세계 한계만 두고 소품 충돌만 축분리로 본다.
   */
  function boundPlayer(p, px, py, ctx) {
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    /* 빠져나오기(§5.12) — 이미 소품 안에 서 있으면(무엇 때문이든) 소품 충돌은 안 본다.
       막힌 자리에서 막힌 자리로만 가려 해 영영 못 움직이던 "끼임"이 없어진다.
       벽(방 사각형)·세계 한계는 그대로 지킨다 */
    var stuck = fieldBlockedAt(px, py, ctx);
    if (ctx && ctx.noRoom) {
      var lim = WORLD_LIMIT;
      var wnx = core.clamp(p.x, -lim, lim);
      p.x = (stuck || !fieldBlockedAt(wnx, py, ctx)) ? wnx : px;
      var wny = core.clamp(p.y, -lim, lim);
      p.y = (stuck || !fieldBlockedAt(p.x, wny, ctx)) ? wny : py;
      return;
    }
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL, pr = (ctx && ctx.pr) || P_R;
    var lo = wl + pr, hiX = rw - wl - pr, hiY = rh - wl - pr;
    if (!fieldOn()) {
      p.x = core.clamp(p.x, ax + lo, ax + hiX);
      p.y = core.clamp(p.y, ay + lo, ay + hiY);
      return;
    }
    var R = fieldRadiusUnits(), cx = ax + rw / 2, cy = ay + rh / 2, ext;
    var loX = ax + lo - R, hiXe = ax + hiX + R;
    /* 2026-09-06 — 여기 아래 넷은 R(그때그때의 AUTO 등급 반경)에 더하지
       않고 **최댓값(최솟값)**으로 견준다. `corridorExtra()`가 주는 값은
       dungeon.js의 `doorCorridors()`(PLAN §28-4, 던전 방-방 문별 통로)에서
       애초에 등급과 무관한 고정 상수라, R이 나중에 줄어들어도 통로 결의
       도달 가능 거리는 안 줄어든다(R이 더 크면 그냥 그 값을 쓴다 — 정상적인
       AUTO 동작). `laneAt`이 있으면(던전 문마다 다른 y) 그 문의 결만
       넓힌다. **마을(town.js)은 §28-8(오픈월드 A안)부터 이 corridors
       메커니즘 자체를 안 쓴다** — 마을은 이제 늘 `ctx.corridors` 없이
       불리므로(마을 자체가 앵커+noRoom 으로 옮겨감) 여기선 늘 `laneAt`
       없는 옛 방식(방 중심 cx/cy)과 비교하는 자리가 없다, 오직 던전
       문 통로만 이 경로를 탄다. */
    ext = corridorExtra(ctx, 'E', py, cy);
    if (ext) { hiXe = Math.max(hiXe, ax + hiX + ext); }
    ext = corridorExtra(ctx, 'W', py, cy);
    if (ext) { loX = Math.min(loX, ax + lo - ext); }
    var nx = core.clamp(p.x, loX, hiXe);
    p.x = (stuck || inRoomRect(nx, py, ctx) || !fieldBlockedAt(nx, py, ctx)) ? nx : px;
    var loY = ay + lo - R, hiYe = ay + hiY + R;
    ext = corridorExtra(ctx, 'S', p.x, cx);
    if (ext) { hiYe = Math.max(hiYe, ay + hiY + ext); }
    ext = corridorExtra(ctx, 'N', p.x, cx);
    if (ext) { loY = Math.min(loY, ay + lo - ext); }
    var ny = core.clamp(p.y, loY, hiYe);
    p.y = (stuck || inRoomRect(p.x, ny, ctx) || !fieldBlockedAt(p.x, ny, ctx)) ? ny : py;
  }

  /* 2026-09-08 — "몬스터가 단조로워 원작처럼 몰이 사냥이 안 된다"(사용자
     제보). 무리(팩) 단위 스폰을 얹으며(아래 spawnFieldEncounters) 상한도
     같이 올린다 — 팩 하나(2~3마리)가 뜨자마자 예전 상한(4)에 거의 다 차면
     보충 트리클이 사실상 못 돌아 팩이 늘 하나뿐으로 보인다. */
  /* §5.19 — 6 → 18(손잡이 dg.fieldCap). 무리 2~3 → 4~6, 보충 4초 한 마리 → 3초 한 무리 */
  var FIELD_ENEMY_CAP = 6;                // 옛 값(손잡이를 0 으로 되돌릴 때의 기준 — 지금은 FIELD_CAP())

  /**
   * 필드 사냥(PLAN 10절) — 방을 다 안 치워도 방 밖 들판에서 바로 싸울 수 있게,
   * 로밍 몬스터를 들판에 흩어 둔다. **`room.enemies` 배열에 그대로 얹는다** —
   * 렌더링 · 기공파/돌진 충돌 · 미니맵 · 근접 자동 공격이 전부 이 배열을 이미
   * 순회하므로 여기 한 곳만 채우면 나머지는 공짜로 따라온다. `.field` 표시로
   * 방 몬스터와 가른다 — 방 정리(`alive`) 판정과 넉백 clamp가 이 표시를 본다.
   *
   * **자가진단(`DG_NO_DRAW`)에서는 켜지 않는다** — `_test.html`은 전체가 씨앗
   * 하나로 고정된 **하나로 이어진** Math.random() 수열을 쓴다(파일 앞머리 주석 —
   * "원소 피해 항목 하나가 그렇게 넘어갔다"). `spawnEnemy()`를 여기서 더 부르면
   * 그 수열이 밀려 뒤따르는 다른 항목의 기대값이 어긋난다 — three.js 때 밟았던
   * 것과 같은 함정이다. `game.js`가 이미 `minimap.tick()` 같은 비핵심 계는 이
   * 플래그로 끄고 있어(같은 자리), 새로 생긴 이 계도 같은 자리에 둔다. 실제 플레이
   * (`index.html`)에는 이 플래그가 없어 그대로 다 돈다.
   */
  /* 2026-09-07 — "마을은 원작 마을처럼, 몹은 마을 안이 아니라 다른
     마을 가는 길에"(사용자 요청). 마을 사각형(room rect) 안으로는 이미
     `inRoomRect` 판정이 로머를 못 들어오게 막아 왔지만, **스폰 자리**는
     그 담장 바로 밖까지도 허용돼 있어(§57 지형 창-추적으로 그 담장 밖
     원경까지 실제로 다니게 되면서) "작은 마을 바로 곁에 몹이 잔뜩"으로
     느껴졌다. 마을 anchor(중심)에서 이 반경 안쪽은 아예 스폰 후보에서
     뺀다 — 마을 자체(560×360 발판)보다 넉넉히 크고, 마을 사이 거리
     (ANCHOR_DIST=4800, town.js)의 절반보다는 한참 작아 "마을 바로 근처는
     안전, 그 밖 길은 위험"이 살아난다. */
  var TOWN_SAFE_R = 1300;

  /** 마을 anchor(발판 중심) 좌표 — spawnFieldEncounters·stepFieldCombat이 같이 쓴다. */
  function townSafeCenter(ctx) {
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    return { x: ax + rw * 0.5, y: ay + rh * 0.5 };
  }
  /* 2026-09-07 — "몹들이 마을로 침범한다"(사용자). 담장 안(`inRoomRect`)은
     이미 못 들어왔지만, 그건 "방 사각형" 판정이라 **담장 바로 밖**까지는
     플레이어를 쫓아 붙어 설 수 있었다 — 마을 코앞에 몹이 우글대는 것으로
     읽혔다. 스폰만 막던 안전지대(TOWN_SAFE_R)를 **로머의 추격 이동에도**
     그대로 적용한다 — 플레이어가 안전지대 안으로 들어가면 쫓던 로머는
     그 경계에서 멈춘다(원작 야영지가 안전한 것과 같은 규칙). */
  function inTownSafe(x, y, ctx) {
    if (!ctx || !ctx.town) { return false; }
    var c = townSafeCenter(ctx);
    return Math.hypot(x - c.x, y - c.y) < TOWN_SAFE_R;
  }

  /**
   * @param ctx 마을처럼 던전과 다른 방이 빌려 쓸 때만 넘긴다 —
   *            {roomW, roomH, wall, floor, room}. 없으면 이 방(던전)의 run 그대로다.
   */
  /* 2026-09-08 — "원작처럼 몰이 사냥이 안 된다"(사용자 제보) — 하나씩
     따로 흩뿌리면 자리도 종류도 매번 남남이라 "무리를 건드리면 떼로
     달려든다"는 손맛이 안 났다. 자리 하나·종류 하나를 무리(팩) 단위로
     고정하고 그 둘레(PACK_SPREAD)에 2~3마리를 심는다 — count가 1이면
     팩 크기도 1이 돼(아래 min) 기존 트리클 보충(spawnFieldEncounters(1))은
     그대로 단발이다, 회귀 없음. */
  var PACK_SPREAD = 70;
  function spawnFieldEncounters(count, ctx) {
    if (!fieldOn() || global.DG_NO_DRAW) { return; }
    if (!ctx && !run) { return; }
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var floor = ctx ? ctx.floor : run.floor;
    var enemies = ctx ? ctx.room.enemies : run.room.enemies;
    var isTown = !!(ctx && ctx.town);
    var cx0 = ax + rw * 0.5, cy0 = ay + rh * 0.5;
    /* 마을은 지금 플레이어가 있는 자리 둘레에 스폰한다(옛 코드는 늘
       anchor 둘레였다 — 플레이어가 anchor에서 멀리 나가 있으면 거기 있는
       몹이 아니라 엉뚱하게 마을 코앞에 계속 몹이 쌓였다). 던전 방은 옛
       그대로 anchor(=방 중심) 둘레를 쓴다. */
    var px0 = (isTown && ctx.player) ? ctx.player.x : cx0;
    var py0 = (isTown && ctx.player) ? ctx.player.y : cy0;
    var biome = biomeOf(ctx);
    var R = fieldRadiusUnits(), remain = count;
    while (remain > 0) {
      var packSize = Math.min(remain, 4 + Math.floor(Math.random() * 3));   // §5.19 4~6(남으면)
      /* 팩 중심 하나를 고른다 — 예전과 같은 각도·거리 뽑기 */
      var tries = 8, a0, d0, ax2 = 0, ay2 = 0, ok = false;
      while (tries-- && !ok) {
        a0 = Math.random() * Math.PI * 2;
        d0 = (wl + 60) + Math.random() * Math.max(40, R - wl - 60);
        ax2 = px0 + Math.cos(a0) * d0;
        ay2 = py0 + Math.sin(a0) * d0;
        if (isTown && Math.hypot(ax2 - cx0, ay2 - cy0) < TOWN_SAFE_R) { continue; }
        if (inRoomRect(ax2, ay2, ctx) || fieldBlockedAt(ax2, ay2, ctx)) { continue; }
        ok = true;
      }
      if (!ok) { remain -= packSize; continue; }   // 이번 팩은 자리를 못 찾았다 — 개수만 줄이고 다음 팩으로
      var ref = pickEnemyRef(floor, false, biome, regionOf(ctx)), k, tries2, x, y, en;
      for (k = 0; k < packSize; k++) {
        tries2 = 6;
        while (tries2--) {
          x = ax2 + (Math.random() - 0.5) * 2 * PACK_SPREAD;
          y = ay2 + (Math.random() - 0.5) * 2 * PACK_SPREAD;
          if (isTown && Math.hypot(x - cx0, y - cy0) < TOWN_SAFE_R) { continue; }
          if (inRoomRect(x, y, ctx) || fieldBlockedAt(x, y, ctx)) { continue; }
          en = spawnEnemy(floor, false, { x: x, y: y, ref: ref });
          en.field = true;
          enemies.push(en);
          break;
        }
      }
      remain -= packSize;
    }
  }

  /* 2026-09-09 — PLAN §60 "원작 4편식 자유도" 후보 1 "필드 위 특별 조우".
     그냥 지나가는 길이 "뭔가 나올 수도 있는 길"이 되도록, 아주 가끔 정예
     하나가 보물을 지키고 선 자리를 들판에 놓는다. `room.chest`처럼
     "다 치워야 연다" 게이트를 새로 만들지 않고 노획물(`dropItem`·`dropGold`·
     `dropMat`)을 그 자리에 바로 놓는다 — 정예를 무시하고 주우려 들면
     정예가 쫓아오니 그 자체가 위험 부담이다(우물・사당처럼 별도 상태
     플래그를 만들지 않고, "정예 표시가 붙은 살아 있는 필드 로머가
     있는가"만 보고 중복 스폰을 막는다). */
  var FIELD_TREASURE_CHANCE = 0.35;   // 쿨다운이 다 찼을 때 실제로 뜰 확률
  function hasActiveTreasureGuard(ctx) {
    var es = ctx ? ctx.room.enemies : (run && run.room.enemies), i;
    if (!es) { return false; }
    for (i = 0; i < es.length; i++) { if (es[i].treasureGuard && es[i].hp > 0) { return true; } }
    return false;
  }
  function spawnFieldTreasure(ctx) {
    if (!fieldOn() || global.DG_NO_DRAW) { return; }
    if (!ctx && !run) { return; }
    if (hasActiveTreasureGuard(ctx)) { return; }
    if (Math.random() >= FIELD_TREASURE_CHANCE) { return; }
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var floor = ctx ? ctx.floor : run.floor;
    var room = ctx ? ctx.room : run.room;
    var isTown = !!(ctx && ctx.town);
    var cx0 = ax + rw * 0.5, cy0 = ay + rh * 0.5;
    var px0 = (isTown && ctx.player) ? ctx.player.x : cx0;
    var py0 = (isTown && ctx.player) ? ctx.player.y : cy0;
    var R = fieldRadiusUnits(), tries = 8, x = 0, y = 0, ok = false, a0, d0;
    while (tries-- && !ok) {
      a0 = Math.random() * Math.PI * 2;
      d0 = (wl + 60) + Math.random() * Math.max(40, R - wl - 60);
      x = px0 + Math.cos(a0) * d0;
      y = py0 + Math.sin(a0) * d0;
      if (isTown && Math.hypot(x - cx0, y - cy0) < TOWN_SAFE_R) { continue; }
      if (inRoomRect(x, y, ctx) || fieldBlockedAt(x, y, ctx)) { continue; }
      ok = true;
    }
    if (!ok) { return; }
    var guardRef = pickEnemyRef(floor, false, biomeOf(ctx), regionOf(ctx));
    var guard = spawnEnemy(floor, false, { forceElite: true, x: x, y: y, ref: guardRef });
    guard.field = true;
    guard.treasureGuard = true;
    room.enemies.push(guard);
    /* dropItem·dropGold·dropMat 은 모듈의 `run`(클로저 변수)을 직접 읽는다 —
       마을(town.js)이 부를 때는 `run`이 비어 있을 수 있어 `withRun`으로
       잠깐 ctx를 끼운다(stepFieldCombat과 같은 요령). */
    withRun(ctx || run, null, function () {
      dropItem(room, x, y, 24);
      if (Math.random() < 0.4) { dropItem(room, x, y, 24); }
      dropGold(room, x, y, 4);
      if (Math.random() < 0.3) { dropMat(room, x, y, 20); }
    });
    core.log('💰 들판에 보물을 지키는 정예가 나타났다', 'good');
    core.emit('toast', '💰 보물을 지키는 정예!');
  }

  /* 2026-09-10 — PLAN §60 "원작 4편식 자유도" 후보 1 나머지 절반 "방랑 상인".
     던전 방 전용이던 행상 POI(위 rollMerchantStock·room.merchant)를 그대로
     빌려 쓴다 — 새 재고 규칙을 만들지 않고, "방 안에 박힌 좌판"이 아니라
     "들판을 걷다 마주치는 사람"으로만 자리를 바꾼다. `room.npcs`(town.js의
     그 배열, dungeon3d.js가 이미 'npc' 배우로 그려 준다)에 하나 얹으면
     그림도 공짜로 딸려 온다.
     2026-09-10(이어서) — 마을 들판까지 마저 넓힌다. `spawnFieldTreasure`와
     같은 결로 `ctx` 를 받게 고쳤다 — ctx 가 있으면 마을(town.js)이 빌려
     쓰는 것이고, 없으면 던전 자신의 `run` 그대로다. 재고 굴림(rollMerchantStock)·
     구매 처리(buyMerchant)는 `run.merchantChoice` 클로저에 그대로 묶여 있어
     마을 쪽까지는 못 쓴다 — town.js 는 이 NPC를 만나면 독자적인 재고 상태를
     들고 `js/ui.js`의 `#encounter` 창(마을 창과 같은 자리)으로 고르게 한다. */
  var FIELD_MERCHANT_CHANCE = 0.4;   // 쿨다운이 다 찼을 때 실제로 뜰 확률
  function hasActiveFieldMerchant(ctx) {
    var ns = ctx ? ctx.room.npcs : (run && run.room.npcs), i;
    if (!ns) { return false; }
    for (i = 0; i < ns.length; i++) { if (ns[i].fieldMerchant && !ns[i].used) { return true; } }
    return false;
  }
  function spawnFieldMerchant(ctx) {
    if (!fieldOn() || global.DG_NO_DRAW) { return; }
    if (!ctx && !run) { return; }
    if (hasActiveFieldMerchant(ctx)) { return; }
    if (Math.random() >= FIELD_MERCHANT_CHANCE) { return; }
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var room = ctx ? ctx.room : run.room;
    var isTown = !!(ctx && ctx.town);
    var cx0 = ax + rw * 0.5, cy0 = ay + rh * 0.5;
    var px0 = (isTown && ctx.player) ? ctx.player.x : cx0;
    var py0 = (isTown && ctx.player) ? ctx.player.y : cy0;
    var R = fieldRadiusUnits(), tries = 8, x = 0, y = 0, ok = false, a0, d0;
    while (tries-- && !ok) {
      a0 = Math.random() * Math.PI * 2;
      d0 = (wl + 60) + Math.random() * Math.max(40, R - wl - 60);
      x = px0 + Math.cos(a0) * d0;
      y = py0 + Math.sin(a0) * d0;
      if (isTown && Math.hypot(x - cx0, y - cy0) < TOWN_SAFE_R) { continue; }
      if (inRoomRect(x, y, ctx) || fieldBlockedAt(x, y, ctx)) { continue; }
      ok = true;
    }
    if (!ok) { return; }
    if (!room.npcs) { room.npcs = []; }
    room.npcs.push({
      key: 'fieldmerchant', name: '방물장수(方物匠手)', emoji: '🧺', color: '#6f5a8a',
      x: x, y: y, phase: 0, facing: 1,
      fieldMerchant: true, used: false
    });
    core.log('🧺 들판에서 방물장수를 만났다', 'good');
    core.emit('toast', '🧺 지나가던 방물장수!');
  }

  /**
   * 살아 있는 들판 로머 수
   * @param ctx spawnFieldEncounters 와 같은 뜻
   */
  function fieldEnemyCount(ctx) {
    var es = ctx ? ctx.room.enemies : (run && run.room.enemies);
    if (!es) { return 0; }
    var n = 0, i;
    for (i = 0; i < es.length; i++) { if (es[i].field && es[i].hp > 0) { n++; } }
    return n;
  }

  /* ── 월드 보스(§5.4) — 실시간 75초 전투 ──────────────────────────
   * 15분마다(실시간 슬롯, `Math.floor(now/900000)`) 마을 넷 중 하나의
   * 들판에 예고가 뜨고, 슬롯이 시작하면 보스가 나온다. 전투 자체는 새
   * 시스템이 아니다 — `room.enemies`에 `field:true`로 얹으면 위
   * `stepFieldCombat`(플레이어 자동공격·적 AI·`bossPattern`)이 이미
   * 처리한다. 이 절이 새로 다루는 건 (1) 슬롯 스케줄링 (2) 부위 3(무기·
   * 갑주·머리) HP 문턱 (3) 75초 제한 도주 (4) 참가 보상 넷뿐이다.
   *
   * `wbNow()` — Date.now() 를 직접 안 쓰고 이 함수를 거친다. 진단이
   * `_forceNow(v)`로 고정해 슬롯·창구를 결정적으로 재현한다(사가만리
   * `weather.force()`와 같은 결, PLAN §9).
   */
  var WB_SLOT_MS = 900000, WB_NOTICE_MS = 180000, WB_FIGHT_MS = 75000;
  var WB_TOWN_IDS = ['moru', 'jajak', 'galdae', 'sogeum'];   // town.js TOWNS 키와 그대로 맞춘다
  var WB_PART_ORDER = ['weapon', 'armor', 'helm'];
  var WB_PART_HP_PCT = [0.8, 0.6, 0.4];   // 부위 HP 각 20% — 이 문턱을 지나면 그 부위가 부서진다
  var forcedNow = null;
  function wbNow() { return forcedNow !== null ? forcedNow : Date.now(); }

  /** 슬롯 → 마을 id. 순수 함수(같은 slot 이면 늘 같은 마을). */
  function wbPickTown(slot) {
    return WB_TOWN_IDS[Math.floor(core.hash2(slot, 0) * WB_TOWN_IDS.length)];
  }
  /** 슬롯 → 보스 정의(BOSSES 풀 전체에서, 층 tier 게이팅 없이). */
  function wbPickBossRef(slot) {
    var ed = global.DG.enemyData;
    var pool = ed && ed.bosses;
    if (!pool || !pool.length) { return null; }
    return pool[Math.floor(core.hash2(slot, 3) * pool.length)];
  }
  /** 슬롯 → 그 마을 들판의 자리. `ctx`는 그 마을이 활성일 때의 raw() —
   *  방 치수·anchor 가 마을마다 달라 ctx 로 받는다(spawnFieldTreasure와 같은 요령).
   *  hash2 로만 고르므로 같은 (slot,ctx) 조합이면 늘 같은 좌표가 나온다. */
  function wbPickPos(ctx, slot) {
    var rw = (ctx && ctx.roomW) || ROOM_W, rh = (ctx && ctx.roomH) || ROOM_H;
    var wl = (ctx && ctx.wall) || WALL;
    var ax = (ctx && ctx.anchor) ? ctx.anchor.x : 0, ay = (ctx && ctx.anchor) ? ctx.anchor.y : 0;
    var cx0 = ax + rw * 0.5, cy0 = ay + rh * 0.5;
    var R = fieldRadiusUnits(), i, a0, d0, x, y;
    for (i = 0; i < 8; i++) {
      a0 = core.hash2(slot, 10 + i * 2) * Math.PI * 2;
      d0 = (wl + 120) + core.hash2(slot, 11 + i * 2) * Math.max(60, R - wl - 120);
      x = cx0 + Math.cos(a0) * d0;
      y = cy0 + Math.sin(a0) * d0;
      if (Math.hypot(x - cx0, y - cy0) < TOWN_SAFE_R) { continue; }
      if (inRoomRect(x, y, ctx) || fieldBlockedAt(x, y, ctx)) { continue; }
      return { x: x, y: y };
    }
    return { x: cx0 + wl + 140, y: cy0 };   // 8번 다 막혔으면 안전지대 바로 밖 고정점(드묾)
  }

  /** 지금 그 방에 살아 있는 월드 보스(있으면 하나뿐이다). */
  function wbFindBoss(room) {
    if (!room || !room.enemies) { return null; }
    for (var i = 0; i < room.enemies.length; i++) {
      if (room.enemies[i].worldBoss && room.enemies[i].hp > 0) { return room.enemies[i]; }
    }
    return null;
  }

  /** 예고 표식 하나를 켜고 끈다 — room.marks 에 얹으면 자동지도·3D 화면·
   *  touchCheck(town.js) 이 공짜로 그린다(road·relic 표식과 같은 요령). */
  function wbEnsureNoticeMark(ctx, on) {
    var room = ctx && ctx.room;
    if (!room || !room.marks) { return; }
    var idx = -1, i;
    for (i = 0; i < room.marks.length; i++) { if (room.marks[i].key === 'worldboss') { idx = i; break; } }
    if (on && idx < 0) {
      var pos = wbPickPos(ctx, dstate().world.slot);
      room.marks.push({ key: 'worldboss', name: '세계 보스 예고', emoji: '⚠️',
        x: pos.x, y: pos.y, worldBossNotice: true });
    } else if (!on && idx >= 0) {
      room.marks.splice(idx, 1);
    }
  }

  function wbSpawn(ctx, slot) {
    var ref = wbPickBossRef(slot);
    if (!ref) { return; }
    var pos = wbPickPos(ctx, slot);
    var best = dstate().best || 1;
    var hp = Math.round(enemyHp(best, false) * 8);      // PLAN 수치: 체력 8배
    var dmg = enemyDmg(best, true);
    var e = spawnEnemy(best, true, { x: pos.x, y: pos.y, ref: ref, hp: hp, dmg: dmg });
    e.field = true;
    e.worldBoss = true;
    e.wbSlot = slot;
    e.wbEndAt = slot * WB_SLOT_MS + WB_FIGHT_MS;
    e.wbPartsBroken = 0;
    ctx.room.enemies.push(e);
    core.log('⚔️ 세계 보스 — ' + ref.name + ' 출현! 75초', 'good');
    core.emit('toast', '⚔️ 세계 보스 출현! 75초 안에 처치하세요');
  }

  /** HP 문턱(80·60·40%)을 지날 때마다 부위 하나씩(무기→갑주→머리) 부순다.
   *  실제 효과는 bossPattern(무기)·resistOf(갑주)·strike 크리(머리) 세 곳에
   *  나뉘어 있다 — 이 함수는 플래그만 세운다. */
  function wbCheckParts(e, fxArr) {
    var pct = e.hp / e.hpMax;
    while (e.wbPartsBroken < WB_PART_HP_PCT.length && pct <= WB_PART_HP_PCT[e.wbPartsBroken]) {
      var part = WB_PART_ORDER[e.wbPartsBroken];
      e.wbPartsBroken++;
      if (part === 'weapon') { e.wbWeaponBroken = true; }
      else if (part === 'armor') { e.wbArmorBroken = true; }
      else { e.wbHelmBroken = true; }
      if (fxArr) { fxArr.push({ t: 'pop', x: e.x, y: e.y - e.r, life: 0.4, boss: true }); }
      core.log('💥 세계 보스 부위 파괴 — ' + (part === 'weapon' ? '무기' : part === 'armor' ? '갑주' : '머리'), 'good');
      core.emit('toast', '💥 부위 파괴!');
    }
  }

  /** 참가 보상 — 처치(fled=false)면 전액 + 부적 1 + 토벌첩, 도주(fled=true,
   *  75초 초과)면 30%만. `room`은 호출자가 명시로 준다(kill() 흐름은
   *  `run.room`이지만, 시간 초과 흐름은 run이 아예 없을 수 있어서다).
   *  `best`(현재 최고 층) 기준으로 굴린다 — 마을 필드는 floor 가 늘 0이라
   *  기존 dropItem/dropGold 그대로 부르면 보상이 하찮아진다. */
  function grantWorldBossReward(e, room, fled) {
    var W = dstate().world;
    if (W.bossDone[e.wbSlot]) { return; }
    W.bossDone[e.wbSlot] = true;
    var best = dstate().best || 1;
    var bossCtx = { floor: best, boons: {} };
    withRun(bossCtx, null, function () {
      dropGold(room, e.x, e.y, fled ? 1.8 : 6);
      if (!fled) {
        dropItem(room, e.x, e.y, 55);   // §9 dropItem 주석의 "1.5배≈+20" 어림으로 "전설 확률 ×3" 을 옮긴 값(이번 구현 판단)
        dropMat(room, e.x, e.y, 30);
      }
    });
    if (fled) {
      core.log('💨 세계 보스가 시간 안에 쓰러지지 않아 물러났다 · 보상 30%', 'bad');
      core.emit('toast', '💨 세계 보스가 물러났다 (보상 30%)');
      return;
    }
    var tier = core.clamp(Math.ceil(best / 3), 1, 10);
    var sig = global.DG.item && global.DG.item.addSigil ? global.DG.item.addSigil(tier) : null;
    if (!core.save.dex.worldBoss) { core.save.dex.worldBoss = {}; }
    var dex = core.save.dex.worldBoss;
    if (!dex[e.ref.id]) { dex[e.ref.id] = { count: 0, firstAt: Date.now() }; }
    dex[e.ref.id].count++;
    core.gainFeat(20 + best * 2, '세계 보스 토벌');
    core.emit('worldboss:kill', { id: e.ref.id });   // goals.js §5.6 주간 묶음이 듣는다
    core.log('🏆 세계 보스 처치 — ' + enemyName(e) + (sig && sig.ok ? ' · 부적(티어 ' + sig.sigil.tier + ') 획득' : ''), 'good');
    core.emit('toast', '🏆 세계 보스 격파!');
    core.emit('changed');
    core.persist();
  }

  /**
   * town.js update() 가 매 틱 부른다(다른 spawnField* 와 같은 자리).
   * @param ctx town.js raw() — `townId` 필드(2026-09-18 추가)로 지금 마을을 안다.
   * @param fxArr 부위 파괴 연출을 받을 배열(town.js 의 fx()).
   */
  function stepWorldBoss(ctx, fxArr) {
    if (!ctx || !ctx.town || ctx.wild) { return; }
    var now = wbNow();
    var slot = Math.floor(now / WB_SLOT_MS), slotStart = slot * WB_SLOT_MS;
    var W = dstate().world;
    if (W.slot !== slot) {
      W.slot = slot; W.townId = wbPickTown(slot); W.spawned = false;
      /* 지난 슬롯 done 기록은 굳이 안 지운다(하루 96개, 무한 누적 아님 —
         세이브를 좀먹을 만큼 크지 않다). */
    }
    var here = ctx.townId === W.townId;
    var notice = here && now >= slotStart - WB_NOTICE_MS && now < slotStart;
    var active = here && now >= slotStart && now < slotStart + WB_FIGHT_MS;
    wbEnsureNoticeMark(ctx, notice);
    if (!here) { return; }
    if (active) {
      if (W.bossDone[slot]) { return; }
      var b = wbFindBoss(ctx.room);
      if (b) {
        wbCheckParts(b, fxArr);
        if (now >= b.wbEndAt) { wbFlee(b, ctx); }
      } else if (!W.spawned) {
        W.spawned = true;
        wbSpawn(ctx, slot);
      }
      return;
    }
    if (!notice) {
      var stray = wbFindBoss(ctx.room);   // 창구가 끝났는데 아직 살아 있으면 정리
      if (stray) { wbFlee(stray, ctx); }
    }
  }

  /* ── 지역 우두머리(§5.13) — 원작의 고유 몬스터(Super Unique) 자리 ─────
   * 지역마다 하나, 고정 자리(world-map bossSpot)에 선다. 1500 안으로 다가가면 호위 정예
   * 셋과 함께 나오고, 쓰러뜨리면 전설 한 점·보물 둘·재료·금, 10분 뒤 다시 선다.
   * 세기는 그 자리 위험도 + 4 층의 보스(체력 ×3). 세이브 save.dungeon.regionBoss[지역]. */
  var RB_NEAR = 1500, RB_CD_MS = 10 * 60 * 1000, RB_HP_MUL = 3, RB_LV_ADD = 4, RB_GUARDS = 3;
  function rbState() {
    var d = dstate();
    if (!d.regionBoss || typeof d.regionBoss !== 'object') { d.regionBoss = {}; }
    return d.regionBoss;
  }
  function rbAlive(room, key) {
    var es = room && room.enemies, i;
    if (!es) { return null; }
    for (i = 0; i < es.length; i++) { if (es[i].regionBoss === key && es[i].hp > 0) { return es[i]; } }
    return null;
  }
  /** 지역 우두머리의 몸 — 명단 몬스터의 몸을 빌려 이름·색만 갈아 끼운다 */
  function rbRef(rg) {
    var ED = global.DG.enemyData, base = ED && ED.byName ? ED.byName(rg.boss.base) : null, r = {}, k;
    if (base) { for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) { r[k] = base[k]; } } }
    else { r = { kind: 'beast', form: 'ogre' }; }
    r.id = rg.boss.id; r.name = rg.boss.name; r.emoji = rg.boss.emoji; r.color = rg.boss.color;
    delete r.biome;
    return r;
  }
  /** @returns 새로 세운 우두머리(없으면 null) — town.update 가 매 틱 부른다 */
  function stepRegionBoss(ctx, now) {
    var WM = global.DG.worldMap;
    if (!WM || !ctx || !ctx.town || !ctx.player || !ctx.room) { return null; }
    var p = ctx.player, rg = WM.regionAt(p.x, p.y), spot = WM.bossSpot(rg.key);
    if (!spot || Math.hypot(p.x - spot.x, p.y - spot.y) > RB_NEAR) { return null; }
    if (rbAlive(ctx.room, rg.key)) { return null; }
    var st = rbState()[rg.key], t = now === undefined ? Date.now() : now;
    if (st && st.lastAt && t - st.lastAt < RB_CD_MS) { return null; }
    var lv = WM.levelAt(spot.x, spot.y) + RB_LV_ADD;
    var e = spawnEnemy(lv, true, { x: spot.x, y: spot.y, ref: rbRef(rg),
      hp: Math.round(enemyHp(lv, true) * RB_HP_MUL), dmg: enemyDmg(lv, true) });
    e.field = true; e.regionBoss = rg.key; e.rbLevel = lv;
    ctx.room.enemies.push(e);
    for (var gi = 0; gi < RB_GUARDS; gi++) {
      var ga = gi / RB_GUARDS * Math.PI * 2;
      var g = spawnEnemy(lv, false, { x: spot.x + Math.cos(ga) * 70, y: spot.y + Math.sin(ga) * 70,
        ref: pickEnemyRef(lv, false, null, rg.key), forceElite: true });
      g.field = true;
      ctx.room.enemies.push(g);
    }
    core.log('☠️ 지역 우두머리 — ' + rg.boss.name + ' (' + rg.name + ') · 위험 ' + lv, 'info');
    core.emit('toast', '☠️ ' + rg.boss.emoji + ' ' + rg.boss.name + ' — ' + rg.boss.desc);
    return e;
  }
  /** 쓰러뜨렸다 — kill() 이 부른다(그때 run 은 마을 ctx) */
  function grantRegionBossReward(e, room) {
    var WM = global.DG.worldMap, rg = WM ? WM.byKey(e.regionBoss) : null;
    if (!rg || !room) { return; }
    var lv = e.rbLevel || 1, all = rbState(), st = all[rg.key] || (all[rg.key] = { kills: 0, firstAt: Date.now() });
    var first = !st.kills;
    st.kills += 1; st.lastAt = Date.now();
    withRun({ floor: lv, boons: {}, room: room }, null, function () {
      dropGold(room, e.x, e.y, 6);
      dropItem(room, e.x, e.y, 45);
      dropItem(room, e.x, e.y, 45);
      dropMat(room, e.x, e.y, 30);
    });
    var IT = global.DG.item;
    if (IT && IT.roll) { room.drops.push({ kind: 'item', item: IT.roll(lv + 1, { tier: 4 }), x: jitter(e.x), y: jitter(e.y) }); }
    core.gainFeat(15 + lv, '지역 우두머리 토벌');
    core.emit('regionboss:kill', { key: rg.key, first: first });
    core.log('🏆 ' + rg.boss.name + ' 토벌' + (first ? ' — 첫 토벌!' : '') + ' · 전설 한 점', 'good');
    core.emit('toast', '🏆 ' + rg.boss.name + (first ? ' 첫 토벌!' : ' 토벌!'));
  }

  function wbFlee(e, ctx) {
    e.hp = 0;
    grantWorldBossReward(e, ctx.room, true);
  }

  /**
   * `run`·`fx`(둘 다 이 모듈의 클로저 변수)를 잠깐 다른 판(마을)의 것으로
   * 바꿔 끼우고 fn 을 부른 뒤 되돌린다. `strike`·`hurtPlayer`·`kill` 은
   * 자가진단(`_strike`·`_hurt`·`_spawnEnemy`)이 지금 시그니처 그대로 직접
   * 부르므로 인자를 늘릴 수 없다 — 대신 이 스왑으로 "잠깐 빌려 쓴다".
   * 마을·던전은 동시에 active 하지 않으니 재진입 걱정은 없다.
   */
  function withRun(ctxRun, ctxFx, fn) {
    var savedRun = run, savedFx = fx;
    run = ctxRun;
    if (ctxFx) { fx = ctxFx; }
    try { fn(); } finally { run = savedRun; fx = savedFx; }
  }

  /**
   * 들판 로머 전투 한 틱 — `update()` 안의 적 AI·자동공격·투사체
   * 블록(이동·문 전환·방 정리 판정은 뺐다)을 그대로 옮겨 온 것이다.
   * **로직은 한 글자도 안 바꿨다** — `update()` 자체는 이 함수를 안 부른다
   * (58KB 판정의 심장을 건드리지 않는다는 원칙). 마을(`town.js`)이 자기
   * 이동을 다 계산한 뒤 이것만 불러 "그 자리에서 싸우는" 부분만 빌린다.
   * @param ctx {roomW, roomH, wall, pr, floor, roomIdx, theme, room, player,
   *             shots, foeShots} — `withRun`으로 run 을 이걸로 바꿔 끼운다.
   * @param fxArr 이 틱에서 난 연출(hit·slash·pop·burst 등)을 받을 배열
   *              (마을 자신의 `fx()` 배열을 넘긴다).
   */
  function stepFieldCombat(dt, ctx, fxArr) {
    withRun(ctx, fxArr, function () {
      var p = run.player, room = run.room, i;
      var rally = rallyOn();
      var rw = ctx.roomW || ROOM_W, rh = ctx.roomH || ROOM_H, wl = ctx.wall || WALL;

      if (p.atkAnim > 0) { p.atkAnim -= dt; }
      if (p.hurt > 0) { p.hurt -= dt; }

      /* 기공파 투사체 */
      for (i = run.shots.length - 1; i >= 0; i--) {
        var sh = run.shots[i];
        sh.x += sh.dx * sh.spd * dt;
        sh.y += sh.dy * sh.spd * dt;
        sh.life -= dt;
        for (var si = 0; si < room.enemies.length; si++) {
          var se = room.enemies[si];
          if (se.hp <= 0 || sh.hit[si]) { continue; }
          if (dist(sh, se) < se.r + 10) {
            sh.hit[si] = true;
            strike(se, sh.mul || 2.2, 14, sh.el || 'chi');
            if (!run) { return; }
          }
        }
        if (sh.life <= 0 || sh.x < wl || sh.x > rw - wl ||
            sh.y < wl || sh.y > rh - wl) {
          run.shots.splice(i, 1);
        }
      }

      /* 궁수·조총병이 쏜 것 */
      for (i = run.foeShots.length - 1; i >= 0; i--) {
        var fsh = run.foeShots[i];
        fsh.x += fsh.dx * fsh.spd * dt;
        fsh.y += fsh.dy * fsh.spd * dt;
        fsh.life -= dt;
        if (dist(fsh, p) < P_R + 8) {
          hurtPlayer(fsh.dmg, fsh.el, fsh.from, '화살·탄환');
          if (!run) { return; }
          run.foeShots.splice(i, 1);
          continue;
        }
        if (fsh.life <= 0 || fsh.x < wl || fsh.x > rw - wl ||
            fsh.y < wl || fsh.y > rh - wl) {
          run.foeShots.splice(i, 1);
        }
      }

      /* 내 공격 — 사거리 안에서 가장 가까운 적 */
      p.atkCd -= dt;
      var reach = reachOf();
      var near = null, nd = 1e9;
      for (i = 0; i < room.enemies.length; i++) {
        var e = room.enemies[i];
        if (e.hp <= 0) { continue; }
        var d = dist(p, e) - e.r;
        if (d < nd) { nd = d; near = e; }
      }
      if (near && nd <= reach && p.atkCd <= 0) {
        if (global.DG.mount && global.DG.mount.onAttack) { global.DG.mount.onAttack(); }   // 탈것 위에선 못 싸운다 — 자동 공격이 나갈 때 내린다
        p.atkCd = atkCdOf() / (rally ? 1.4 : 1);
        p.atkAnim = 0.22;
        p.castAnim = false;
        strike(near);
        if (!run) { return; }
        if (Math.random() * 100 < boonVal('echoPct')) { strike(near); }
        if (!run) { return; }
        tryShadowSig();                     // §5.1 인물 축 — 그림자 서명
        if (!run) { return; }
      }

      /* 적 */
      for (i = 0; i < room.enemies.length; i++) {
        var en = room.enemies[i];
        if (en.hp <= 0) { continue; }
        en.phase += dt * 7;
        if (en.hurt > 0) { en.hurt -= dt; }
        if (en.pullT > 0) { pullStep(en, dt, ctx); }   // §5.19 2차 끌려오는 중
        var ed = dist(en, p);
        var el = en.elite ? eliteOf(en.elite) : null;
        if (el && el.regen && en.hp < en.hpMax) {
          en.hp = Math.min(en.hpMax, en.hp + en.hpMax * el.regen * dt);
        }
        if (en.dots && en.dots.length) {
          for (var di2 = en.dots.length - 1; di2 >= 0; di2--) {
            var dt2 = en.dots[di2];
            en.hp -= dt2.dps * dt;
            dt2.t -= dt;
            if (dt2.t <= 0) { en.dots.splice(di2, 1); }
          }
          if (en.hp <= 0) { kill(en); if (!run) { return; } continue; }
        }
        var chill = 1;
        if (en.slow > 0) {
          en.slow -= dt;
          chill = 1 - (en.slowMul || 0.45);
        }
        var espd = (62 + Math.min(40, (ctx.floor || 0) * 1.5)) *
                   (el && el.spd ? el.spd : 1) * chill;
        var lookW = en.ref && en.ref.look && en.ref.look.weapon;
        var ranged = lookW === 'bow' || lookW === 'staff';
        var stopAt = ranged ? RANGED_STOP : (en.r + P_R - 2);
        var wob = (!ranged && lookW === 'axe') ? Math.sin(en.phase * 0.6) * 0.5 : 0;
        var lunge = (!ranged && lookW === 'club') ? 1 + Math.max(0, Math.sin(en.phase * 0.9)) * 0.7 : 1;
        /* 어그로 — update()의 그 블록과 같은 자리, 같은 상수(AGGRO_RANGE 등)를
           그대로 쓴다. 들판 로머(en.field)도 이걸 탄다 — 오히려 여기가 더
           뜻이 있다(길을 걷다 옆을 지나쳐도 안 쫓아오는 채비가 열린다). */
        if (!en.aggro) {
          var aggroR = (ranged ? AGGRO_RANGE_RANGED : AGGRO_RANGE) * (en.elite ? 1.15 : 1);
          if (ed <= aggroR) { wakeEnemy(en); }
        }
        if (en.aggro) {
          if (ed > stopAt) {
            var mvx = (p.x - en.x) / ed, mvy = (p.y - en.y) / ed;
            if (wob) {
              var perpx = -mvy, perpy = mvx;
              mvx += perpx * wob; mvy += perpy * wob;
              var mvl = Math.sqrt(mvx * mvx + mvy * mvy) || 1;
              mvx /= mvl; mvy /= mvl;
            }
            var nex = en.x + mvx * espd * lunge * dt;
            var ney = en.y + mvy * espd * lunge * dt;
            if (en.field) {
              /* 들판 로머는 방(마을 벽) 안으로는 못 들어온다 — 플레이어를
                 쫓다가도 벽 자리에서 멈춘다. 축을 나눠 막아 대각선으로
                 다가와도 한쪽 축은 계속 미끄러진다(boundPlayer와 같은 요령).
                 마을에서는 안전지대(TOWN_SAFE_R) 경계도 같은 방식으로 막아 —
                 플레이어가 안전지대로 피하면 쫓던 로머가 담장 코앞까지
                 따라붙지 못한다. */
              if (!inRoomRect(nex, en.y, ctx) && !inTownSafe(nex, en.y, ctx)) { en.x = nex; }
              if (!inRoomRect(en.x, ney, ctx) && !inTownSafe(en.x, ney, ctx)) { en.y = ney; }
            } else {
              en.x = nex; en.y = ney;
            }
          }
          var reachBonus = (lookW === 'spear' || lookW === 'halberd') ? 14 : 0;
          en.cd -= dt;
          if (ed <= en.r + P_R + 6 + reachBonus && en.cd <= 0) {
            en.cd = ENEMY_CD * (el && el.cd ? el.cd : 1) / chill;
            hurtPlayer(en.dmg, en.ref && en.ref.atkEl, en);
            if (!run) { return; }
          } else if (ranged && ed > en.r + P_R + 6 && ed <= RANGED_MAX && en.cd <= 0) {
            en.cd = ENEMY_CD * 1.4 * (el && el.cd ? el.cd : 1) / chill;
            var frdx = p.x - en.x, frdy = p.y - en.y;
            var frd = Math.sqrt(frdx * frdx + frdy * frdy) || 1;
            var frEl = (en.ref && en.ref.atkEl) || 'phys';
            run.foeShots.push({
              x: en.x, y: en.y - 8, dx: frdx / frd, dy: frdy / frd, spd: 260, life: 1.8,
              dmg: en.dmg, el: frEl, color: elemColorOf(frEl), from: enemyName(en)
            });
          }
          /* 들판 로머는 늘 boss:false 로 태어나므로(spawnFieldEncounters) 보스
             패턴은 안 타지만, 나중에 예외가 생겨도 안전하도록 그대로 둔다 */
          if (en.boss) {
            bossPattern(en, p, ed, dt);
            if (!run) { return; }
          }
        }
      }
    });
  }

  /**
   * 들판에서 잡은 것 줍기 — `update()` 안의 "바닥에 떨어진 것 줍기"(1474행
   * 부근)와 판정은 완전히 같다(플레이어 반경 안이면 `take()`). **마을에는
   * 여태 이게 없어** 필드 로머를 잡아도 `room.drops`에 쌓이기만 하고
   * 회수가 안 됐다(2026-09-01 이전, 알려진 한계로 적어 뒀던 것).
   * `stepFieldCombat`과 분리해 둔 것은 그 함수의 문서화된 범위(전투만,
   * 이동·문 전환·방 정리는 뺐다)를 그대로 지키기 위해서다 — 마을은 자기
   * 이동을 다 계산한 뒤 이 함수를 따로 부른다.
   * @param ctx stepFieldCombat 과 같은 뜻(withRun으로 run 을 이걸로 바꿔 끼운다).
   * @param fxArr 이 틱의 연출을 받을 배열.
   */
  function pickupField(ctx, fxArr) {
    withRun(ctx, fxArr, function () {
      var p = run.player, room = run.room, i;
      for (i = room.drops.length - 1; i >= 0; i--) {
        var dp = room.drops[i];
        if (dist(p, dp) < P_R + 14) {
          if (take(dp) !== false) { room.drops.splice(i, 1); }
        }
      }
    });
  }

  /** 사기(士氣) 버프가 살아 있나 */
  function rallyOn() {
    return !!(run && run.player.rallyUntil > Date.now());
  }

  function update(dt) {
    if (!run || run.choice || run.merchantChoice) { return; }  // 고르는 동안에는 멈춘다
    dt = Math.min(dt, 0.05);
    var p = run.player, room = run.room, i;

    /* 타격 정지(hitstop) — 한 대 맞은 순간 몇 프레임 시간을 확 늦춘다(멈추지는
       않는다 — dt를 0으로 주면 몇몇 카운트다운이 얼어붙은 티가 난다). 2026-09-10
       "전투가 심심하다 — 모션이 없어서 그런가"(사용자) 대응 — 새 애니메이션을
       더는 대신, 있는 모션(넉백·번쩍임·칼궤적)이 훨씬 묵직하게 느껴지게 한다. */
    if (run.hitstopT > 0) { run.hitstopT -= dt; dt *= 0.08; }
    /* §5.8② 저스트 회피 슬로우(2026-09-18) — hitstop 처럼 "멎는" 게 아니라
       0.2초 동안 조금 느리게(×0.4) 가는 보너스 창이다. hitstop 과 동시에
       걸리면 hitstop 이 우선(더 짧고 강한 쪽이 이긴다 — else if). */
    else if (run.slowT > 0) { run.slowT -= dt; dt *= 0.4; }
    /* 연속 타격(콤보) — 일정 시간 안에 다시 안 때리면 끊긴다(strike()가 갱신) */
    if (run.comboT > 0) {
      run.comboT -= dt;
      if (run.comboT <= 0) { run.combo = 0; }
    }

    /* 스킬 쿨다운 · 기력 · 무적 시간 */
    for (i = 0; i < p.cds.length; i++) { if (p.cds[i] > 0) { p.cds[i] -= dt; } }
    /* 명민·정신 같은 상시 무예가 기력 회복을 올린다 */
    run.mp = Math.min(run.mpMax, run.mp + (MP_REGEN + boonVal('mpRegen')) * dt);
    if (p.invuln > 0) { p.invuln -= dt; }
    if (p.atkAnim > 0) { p.atkAnim -= dt; }
    if (p.heavyCd > 0) { p.heavyCd -= dt; }
    if (p.dodgeCd > 0) { p.dodgeCd -= dt; }
    if (p.setSkCd > 0) { p.setSkCd -= dt; }
    if (p.sigSkCd > 0) { p.sigSkCd -= dt; }
    /* 독(毒) dot — 함정(spike)에 물렸을 때. 적에게 쓰는 `e.dots`와 같은
       패턴(dps·t)을 그대로 사람에게도 돌린다 */
    if (p.dots && p.dots.length) {
      for (var pdi = p.dots.length - 1; pdi >= 0; pdi--) {
        var pdt = p.dots[pdi];
        run.hp -= pdt.dps * dt;
        pdt.t -= dt;
        if (pdt.t <= 0) { p.dots.splice(pdi, 1); }
      }
      if (run.hp <= 0) { die(); }
      if (!run) { return; }
    }
    var rally = rallyOn();

    if (run.horde) {
      /* 난입(§5.5) — 들판 로머·보물·상인은 안 돈다(문도 복도도 없다).
         대신 파도 타이머·생존 시계·레벨 판정이 그 자리를 대신한다. */
      run.hordeT += dt;
      run.hordeWaveCd -= dt;
      if (run.hordeWaveCd <= 0) {
        run.hordeWaveCd = HORDE_WAVE_INTERVAL;
        spawnHordeWave();
      }
      hordeLevelCheck();
      if (run.hordeT >= HORDE_DURATION) {
        endHordeSurvive();
        if (!run) { return; }
      }
    } else if (run.nightmare) {
      /* 시련(§5.11) — 15분 시계 하나. 수호자를 쓰러뜨린 다음 틱에 끝낸다 */
      if (run.trial && stepTrial(dt)) { return; }
      /* 부적 던전(§5.3) — 들판 로머도 안 돈다(방 단위 구조 유지). '촉박'
         변형자일 때만 방 시계가 뜻이 있다 — 아니면 roomT 는 그냥 안 줄어든다. */
      if (nmHasMod('timer')) {
        run.nightmare.roomT -= dt;
        if (run.nightmare.roomT <= 0 && !run.room.cleared) {
          endNightmareFail();
          if (!run) { return; }
        }
      }
    } else {
      /* 필드 사냥 보충 — 들판을 걸어다니는 동안 로머가 상한 밑으로 떨어지면
         주기적으로 하나씩 채운다(PLAN 10절 "랜덤 필드 구조") */
      run.fieldSpawnCd -= dt;
      if (run.fieldSpawnCd <= 0) {
        run.fieldSpawnCd = 3;
        if (fieldEnemyCount() < FIELD_CAP()) { spawnFieldEncounters(Math.min(5, FIELD_CAP() - fieldEnemyCount())); }
      }
      run.fieldTreasureCd -= dt;
      if (run.fieldTreasureCd <= 0) {
        run.fieldTreasureCd = 90;
        spawnFieldTreasure();
      }
      run.fieldMerchantCd -= dt;
      if (run.fieldMerchantCd <= 0) {
        run.fieldMerchantCd = 60;
        spawnFieldMerchant();
      }
    }

    /* 돌진 — 조작을 무시하고 정해진 방향으로 밀고 나간다 */
    var px0 = p.x, py0 = p.y;
    if (p.dash) {
      var dsh = p.dash;
      p.x += dsh.dx * 620 * dt;
      p.y += dsh.dy * 620 * dt;
      p.walking = true;
      p.phase += dt * 16;
      fx.push({ t: 'trail', x: p.x, y: p.y, life: 0.22,
        el: dsh.el && dsh.el !== 'phys' ? dsh.el : null,
        color: dsh.el && dsh.el !== 'phys' ? elemColorOf(dsh.el) : null });
      /* 지나는 적을 벤다 (한 번씩만) */
      for (i = 0; i < room.enemies.length; i++) {
        var de = room.enemies[i];
        if (de.hp <= 0 || dsh.hit[i]) { continue; }
        if (dist(p, de) < de.r + P_R + 6) {
          dsh.hit[i] = true;
          strike(de, dsh.mul || 1.2, 22, dsh.el || 'phys');
          if (!run) { return; }
        }
      }
      dsh.t -= dt;
      if (dsh.t <= 0) { p.dash = null; }
      /* fieldBlockedAt() 은 `ctx ? ctx.floor : run.floor` 처럼 **ctx가 있으면
         그 안의 값만** 본다(부분 ctx라고 run으로 안 떨어진다) — floor·
         roomIdx를 안 실어 보내면 항상 undefined가 되어 매 프레임 "막힌
         것 없음"으로 새 버렸을 뻔했다(자가진단이 이 층을 안 보는 값이라
         하마터면 조용히 회귀할 뻔한 자리, PLAN §28-4 Phase 2). */
      boundPlayer(p, px0, py0, { corridors: run.corridors, floor: run.floor, roomIdx: run.roomIdx });
    } else if (p.dodge) {
      /* 회피 — dash와 같은 모양이지만 적을 베지 않는다(위 doDodge() 참고) */
      var dg = p.dodge;
      p.x += dg.dx * DODGE_SPD * dt;
      p.y += dg.dy * DODGE_SPD * dt;
      p.walking = true;
      p.phase += dt * 16;
      fx.push({ t: 'trail', x: p.x, y: p.y, life: 0.18, color: '#cfe8ff' });
      dg.t -= dt;
      if (dg.t <= 0) { p.dodge = null; }
      boundPlayer(p, px0, py0, { corridors: run.corridors, floor: run.floor, roomIdx: run.roomIdx });
    } else {
      /* 이동 */
      var dx = input.dx, dy = input.dy;
      if (!dx && !dy && target) {
        var tdx = target.x - p.x, tdy = target.y - p.y;
        var td = Math.sqrt(tdx * tdx + tdy * tdy);
        if (td < 6) { target = null; }
        else { dx = tdx / td; dy = tdy / td; }
      }
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        dx /= len; dy /= len;
        var spd = spdOf() * (rally ? 1.25 : 1);
        p.x += dx * spd * dt;
        p.y += dy * spd * dt;
        p.walking = true;
        p.phase += dt * 9;
        if (dx) { p.facing = dx > 0 ? 1 : -1; }
        p.dirX = dx; p.dirY = dy;              // 스킬 방향용 — 마지막 이동 방향
      } else {
        p.walking = false;
      }
      /* fieldBlockedAt() 은 `ctx ? ctx.floor : run.floor` 처럼 **ctx가 있으면
         그 안의 값만** 본다(부분 ctx라고 run으로 안 떨어진다) — floor·
         roomIdx를 안 실어 보내면 항상 undefined가 되어 매 프레임 "막힌
         것 없음"으로 새 버렸을 뻔했다(자가진단이 이 층을 안 보는 값이라
         하마터면 조용히 회귀할 뻔한 자리, PLAN §28-4 Phase 2). */
      boundPlayer(p, px0, py0, { corridors: run.corridors, floor: run.floor, roomIdx: run.roomIdx });
    }
    if (p.hurt > 0) { p.hurt -= dt; }

    /* 기공파 투사체 */
    for (i = run.shots.length - 1; i >= 0; i--) {
      var sh = run.shots[i];
      sh.x += sh.dx * sh.spd * dt;
      sh.y += sh.dy * sh.spd * dt;
      sh.life -= dt;
      for (var si = 0; si < room.enemies.length; si++) {
        var se = room.enemies[si];
        if (se.hp <= 0 || sh.hit[si]) { continue; }
        if (dist(sh, se) < se.r + 10) {
          sh.hit[si] = true;
          /* 쏜 것이 제 배수와 결을 들고 간다 (무예마다 다르다) */
          strike(se, sh.mul || 2.2, 14, sh.el || 'chi');
          if (!run) { return; }
        }
      }
      if (sh.life <= 0 || sh.x < WALL || sh.x > ROOM_W - WALL ||
          sh.y < WALL || sh.y > ROOM_H - WALL) {
        run.shots.splice(i, 1);
      }
    }

    /* 궁수·조총병이 쏜 것 — 근접 대신 거리를 두고 쏘는 적의 화살·탄환
       (몬스터 다양화: `look.weapon` 이 bow·staff 인 적은 아래 "적" 루프에서
       가까이 안 붙고 이걸 쏜다) */
    for (i = run.foeShots.length - 1; i >= 0; i--) {
      var fsh = run.foeShots[i];
      fsh.x += fsh.dx * fsh.spd * dt;
      fsh.y += fsh.dy * fsh.spd * dt;
      fsh.life -= dt;
      if (dist(fsh, p) < P_R + 8) {
        hurtPlayer(fsh.dmg, fsh.el, fsh.from, '화살·탄환');
        if (!run) { return; }
        run.foeShots.splice(i, 1);
        continue;
      }
      if (fsh.life <= 0 || fsh.x < WALL || fsh.x > ROOM_W - WALL ||
          fsh.y < WALL || fsh.y > ROOM_H - WALL) {
        run.foeShots.splice(i, 1);
      }
    }

    /* 내 공격 — 사거리 안에서 가장 가까운 적 */
    p.atkCd -= dt;
    var reach = reachOf();
    var near = null, nd = 1e9;
    for (i = 0; i < room.enemies.length; i++) {
      var e = room.enemies[i];
      if (e.hp <= 0) { continue; }
      var d = dist(p, e) - e.r;
      if (d < nd) { nd = d; near = e; }
    }
    if (near && nd <= reach && p.atkCd <= 0) {
      if (global.DG.mount && global.DG.mount.onAttack) { global.DG.mount.onAttack(); }
      p.atkCd = atkCdOf() / (rally ? 1.4 : 1);
      p.atkAnim = 0.22;
      p.castAnim = false;
      strike(near);
      if (!run) { return; }
      if (CLEAVE_ON()) { cleave(near, reach * CLEAVE_R, CLEAVE_HALF, CLEAVE_MUL, 6); if (!run) { return; } }
      if (Math.random() * 100 < boonVal('echoPct')) { strike(near); }
      if (!run) { return; }
      tryShadowSig();                       // §5.1 인물 축 — 그림자 서명
      if (!run) { return; }
    }

    /* 적 */
    for (i = 0; i < room.enemies.length; i++) {
      var en = room.enemies[i];
      if (en.hp <= 0) { continue; }
      en.phase += dt * 7;
      if (en.hurt > 0) { en.hurt -= dt; }
      if (en.pullT > 0) { pullStep(en, dt); }        // §5.19 2차 끌려오는 중
      var ed = dist(en, p);
      var el = en.elite ? eliteOf(en.elite) : null;
      if (el && el.regen && en.hp < en.hpMax) {      // 되살아나는 — 피가 아문다
        en.hp = Math.min(en.hpMax, en.hp + en.hpMax * el.regen * dt);
      }
      /* 부적 '재생' 변형자(§5.3) — 정예 접두 '되살아나는' 위와 같은 결이지만
         전원(잡졸까지)에게 초당 1% */
      if (nmHasMod('regen') && en.hp < en.hpMax) {
        en.hp = Math.min(en.hpMax, en.hp + en.hpMax * 0.01 * dt);
      }
      /* 독(毒) — 몇 초에 걸쳐 들어간다 */
      if (en.dots && en.dots.length) {
        for (var di2 = en.dots.length - 1; di2 >= 0; di2--) {
          var dt2 = en.dots[di2];
          en.hp -= dt2.dps * dt;
          dt2.t -= dt;
          if (dt2.t <= 0) { en.dots.splice(di2, 1); }
        }
        if (en.hp <= 0) { kill(en); if (!run) { return; } continue; }
      }
      /* 빙(氷) — 굼떠진다 */
      var chill = 1;
      if (en.slow > 0) {
        en.slow -= dt;
        chill = 1 - (en.slowMul || 0.45);
      }
      var espd = (62 + Math.min(40, run.floor * 1.5)) *
                 (el && el.spd ? el.spd : 1) * chill *
                 (nmHasMod('speed') ? 1.3 : 1);   // 부적 '광란' 변형자(§5.3)
      /* 궁수·조총병은 붙지 않고 RANGED_STOP 거리에서 멈춘다 — 나머지는 그대로
         닿을 때까지 다가온다(옛 동작과 완전히 같다) */
      var lookW = en.ref && en.ref.look && en.ref.look.weapon;
      var ranged = lookW === 'bow' || lookW === 'staff';
      var stopAt = ranged ? RANGED_STOP : (en.r + P_R - 2);
      /* 잡졸 이동 패턴 — 여태 궁수·조총병 말고는 다 같은 속도로 똑바로 걸어왔다
         (몬스터 다양화의 남은 절반). 무기마다 접근하는 결을 갈랐다 — 판정 값
         (속도·피해)은 안 건드리고 **경로만** 흔든다. `en.phase` 는 이미 dt 로만
         도는 결정적인 값이라 새 Math.random() 을 안 쓴다(진단이 이 흐름의
         Math.random() 순서에 기대지 않게 하려는 뜻이다). */
      var wob = (!ranged && lookW === 'axe') ? Math.sin(en.phase * 0.6) * 0.5 : 0;
      var lunge = (!ranged && lookW === 'club') ? 1 + Math.max(0, Math.sin(en.phase * 0.9)) * 0.7 : 1;
      /* 어그로(2026-09-10, 사용자 요청) — 방에 들어서자마자 방 안 전부가
         한꺼번에 달려오던 것을 고친다. **사거리 안에 들어야 알아챈다**
         (궁수·조총병은 더 멀리서 본다, 정예는 좀 더 예민하다) — 그 전엔
         phase(숨쉬기)만 돌고 가만히 서 있는다. 맞으면 거리와 상관없이
         무조건 깬다(strike()의 wakeEnemy 훅). 보스·미니보스는 spawnEnemy가
         처음부터 aggro:true로 낸다 — 보스방은 원래 들어가는 순간이 곧
         교전이다(살금살금 지나가는 방이 아니다). */
      if (!en.aggro) {
        var aggroR = (ranged ? AGGRO_RANGE_RANGED : AGGRO_RANGE) * (en.elite ? 1.15 : 1);
        if (ed <= aggroR) { wakeEnemy(en); }
      }
      if (en.aggro) {
        if (ed > stopAt) {
          var mvx = (p.x - en.x) / ed, mvy = (p.y - en.y) / ed;
          if (wob) {
            var perpx = -mvy, perpy = mvx;
            mvx += perpx * wob; mvy += perpy * wob;
            var mvl = Math.sqrt(mvx * mvx + mvy * mvy) || 1;
            mvx /= mvl; mvy /= mvl;
          }
          en.x += mvx * espd * lunge * dt;
          en.y += mvy * espd * lunge * dt;
        }
        /* 창·극(戟) 은 자루가 길다 — 몸이 닿기 전에 먼저 닿는다(무기마다 다른
           사거리, 몬스터 다양화의 나머지 절반) */
        var reachBonus = (lookW === 'spear' || lookW === 'halberd') ? 14 : 0;
        en.cd -= dt;
        if (ed <= en.r + P_R + 6 + reachBonus && en.cd <= 0) {
          /* 붙었으면 궁수·조총병도 그냥 몸으로 밀친다(막다른 곳에 몰렸을 때) */
          en.cd = ENEMY_CD * (el && el.cd ? el.cd : 1) / chill;
          hurtPlayer(en.dmg, en.ref && en.ref.atkEl, en);
          if (!run) { return; }
        } else if (ranged && ed > en.r + P_R + 6 && ed <= RANGED_MAX && en.cd <= 0) {
          en.cd = ENEMY_CD * 1.4 * (el && el.cd ? el.cd : 1) / chill;
          var frdx = p.x - en.x, frdy = p.y - en.y;
          var frd = Math.sqrt(frdx * frdx + frdy * frdy) || 1;
          var frEl = (en.ref && en.ref.atkEl) || 'phys';
          run.foeShots.push({
            x: en.x, y: en.y - 8, dx: frdx / frd, dy: frdy / frd, spd: 260, life: 1.8,
            dmg: en.dmg, el: frEl, color: elemColorOf(frEl), from: enemyName(en)
          });
        }

        /* 보스 패턴 — 예고 뒤 터진다(PLAN 15절, `bossPattern()` 참고 —
           무기마다 다르다, 2026-09-05까지는 전부 같은 강타 하나였다) */
        if (en.boss) {
          /* §5.18 명소 층 주인 — 고유 수를 예고·시전하는 동안은 무기 패턴을 쉰다 */
          var gBusy = en.fixedGuard ? stepGuardSig(en, p, dt) : false;
          if (!run) { return; }
          if (!gBusy) { bossPattern(en, p, ed, dt); }
          if (!run) { return; }
        }
      }
    }

    /* 방 정리 판정 */
    if (!room.cleared) {
      var alive = 0;
      /* 들판 로머(`.field`)는 문 열림 판정에서 뺀다 — 방 안 몬스터만 다 잡으면
         된다. 안 그러면 계속 보충되는 필드 로머 때문에 방이 영영 안 열린다 */
      for (i = 0; i < room.enemies.length; i++) {
        if (room.enemies[i].hp > 0 && !room.enemies[i].field) { alive++; }
      }
      if (!alive) {
        room.cleared = true;
        core.emit('dungeon:clear', room);
      }
    }

    /* 바닥에 떨어진 것 줍기 */
    for (i = room.drops.length - 1; i >= 0; i--) {
      var dp = room.drops[i];
      if (dist(p, dp) < P_R + 14) {
        /* take 가 false 를 돌려주면 **바닥에 그대로 둔다** —
           벨트가 찼을 때 물약이 사라지면 원작의 감각이 깨진다 */
        if (take(dp) !== false) { room.drops.splice(i, 1); }
      }
    }

    /* 항아리 — 지나가기만 해도 깨진다. 원작처럼 뭔가 조금 나온다 */
    var dec2 = room.decor || [];
    for (i = 0; i < dec2.length; i++) {
      var jr = dec2[i];
      if (jr.t !== 'jar' || jr.broken) { continue; }
      if (dist(p, jr) > P_R + 16) { continue; }
      jr.broken = true;
      fx.push({ t: 'pop', x: jr.x, y: jr.y, life: 0.3 });
      sfx('jar');
      var roll = Math.random();
      if (roll < 0.42) { dropGold(room, jr.x, jr.y, 0.5); }
      else if (roll < 0.62) { dropPotion(room, jr.x, jr.y); }
      else if (roll < 0.70) { dropMat(room, jr.x, jr.y, -10); }
      else if (roll < 0.74) { dropItem(room, jr.x, jr.y, -8); }
      /* 부적 '매복' 변형자(§5.3) — 절반 확률로 항아리 자리에서 적이 튄다 */
      if (nmHasMod('jar') && Math.random() < 0.5) {
        room.enemies.push(spawnEnemy(run.floor, false, { spawned: true, x: jr.x, y: jr.y }));
        core.emit('toast', '🏺 항아리에서 적이 튀어나왔다!');
      }
    }

    /* 함정(spike) — 항아리처럼 한 번 깨지고 끝이 아니라, 벗어날 때까지
       주기적으로(1.2초 간격) 문다. 독(毒) 원소 공식을 그대로 빌려 쓴다 —
       `applyElem`이 적에게 `e.dots`를 얹는 것과 같은 자리(`update()` 위쪽의
       `p.dots` 틱)에 dps·t 를 얹기만 한다. 새 피해 공식은 안 만든다 —
       크기는 `enemyDmg`(이 층 몬스터 한 대 값)의 절반을 저항 뺀 뒤 3초에
       걸쳐 나눠 문다. */
    for (i = 0; i < dec2.length; i++) {
      var sp = dec2[i];
      if (sp.t !== 'spike') { continue; }
      if (sp.cd > 0) { sp.cd -= dt; continue; }
      if (dist(p, sp) > P_R + sp.r) { continue; }
      sp.cd = 1.2;
      var ED2 = global.DG.elemData;
      var poisDef = ED2 && ED2.elemByKey('pois');
      if (poisDef && run.player.invuln <= 0) {
        var spV = Math.max(1, Math.round(enemyDmg(run.floor, false) * 0.5 *
          (1 - elemResOf('pois') / 100)));
        if (!p.dots) { p.dots = []; }
        p.dots.push({ dps: spV / poisDef.dot, t: poisDef.dot });
        fx.push({ t: 'elem', x: p.x, y: p.y - P_R - 6, v: spV, el: 'pois',
                  color: poisDef.color, life: 0.6, dot: true });
        sfx('hurt');
      }
    }

    /* 상자 · 우물 · 사당 */
    if (room.chest && !room.chest.taken && room.cleared && dist(p, room.chest) < P_R + 20) {
      room.chest.taken = true;
      var bonus = 1 + Math.floor(Math.random() * 2);
      for (var c = 0; c < bonus; c++) {
        dropItem(room, room.chest.x, room.chest.y, 22);
      }
      dropGold(room, room.chest.x, room.chest.y, 3);
      sfx('chest');
      core.emit('toast', '🎁 보물상자!');
    }
    if (room.grave && !room.grave.taken && dist(p, room.grave) < P_R + 20) {
      room.grave.taken = true;
      openGrave();
      sfx('shrine');
      core.emit('toast', '🪦 유품 발견 · 되찾을 것을 고르세요');
    }
    if (room.well && !room.well.used && dist(p, room.well) < P_R + 20) {
      room.well.used = true;
      healBy(run.hpMax * 0.4);
      sfx('well');
      core.emit('toast', '💧 우물 · 체력 40% 회복');
    }
    if (room.shrine && !room.shrine.used && room.cleared && dist(p, room.shrine) < P_R + 20) {
      room.shrine.used = true;
      shrineBoon();
      sfx('shrine');
      core.emit('toast', '⛩️ 사당 · 은사를 고르세요');
    }
    if (room.vein && !room.vein.used && room.cleared && dist(p, room.vein) < P_R + 20) {
      /* 채광방(POI: Cave) — 광맥을 캔다. 상자·사당과 같은 손짓(지킴이가
         있을 수 있으니 방을 다 치운 뒤에만)이지만, 나오는 것은 재료 둘
         확정이다(우물의 회복량 40% 만큼 후하게 잡았다) */
      room.vein.used = true;
      dropMat(room, room.vein.x, room.vein.y, 26);
      dropMat(room, room.vein.x, room.vein.y, 26);
      sfx('chest');
      core.emit('toast', '⛏️ 광맥 · 세공 재료를 캤다');
    }
    if (room.merchant && !room.merchant.used && room.cleared && dist(p, room.merchant) < P_R + 20) {
      room.merchant.used = true;
      run.merchantChoice = rollMerchantStock(run.floor);
      sfx('shrine');
      core.emit('toast', '🧺 행상 · 살 것을 고르세요');
    }
    /* 방랑 상인(들판) — room.cleared 를 안 본다. 방을 치우고 말고와 상관없이
       들판에서 그냥 마주치는 사람이다(spawnFieldMerchant) */
    if (room.npcs) {
      for (var fmI = 0; fmI < room.npcs.length; fmI++) {
        var fm = room.npcs[fmI];
        if (fm.fieldMerchant && !fm.used && dist(p, fm) < P_R + 20) {
          fm.used = true;
          run.merchantChoice = rollMerchantStock(run.floor);
          sfx('shrine');
          core.emit('toast', '🧺 방물장수 · 살 것을 고르세요');
          room.npcs.splice(fmI, 1);
          break;
        }
      }
    }
    if (room.puzzle && !room.puzzle.solved) {
      var pz = room.puzzle;
      for (var pk = 0; pk < pz.pods.length; pk++) {
        var pod = pz.pods[pk];
        var podNear = dist(p, pod) < P_R + 20;
        if (podNear && !pod.near) { touchPuzzlePod(room, pz, pod); }
        pod.near = podNear;
      }
    }
    if (room.captive && !room.captive.freed && room.cleared && dist(p, room.captive) < P_R + 20) {
      /* 이벤트방(POI: Event) — 구출. 사당과 달리 고르지 않고 바로 하나
         얹는다("받은 은혜" 라는 뜻이다) */
      room.captive.freed = true;
      var freePool = [], fi;
      for (fi = 0; fi < DD.BOONS.length; fi++) {
        var fb = DD.BOONS[fi];
        if ((run.boons[fb.key] || 0) < fb.max) { freePool.push(fb.key); }
      }
      if (freePool.length) {
        var freeKey = freePool[Math.floor(Math.random() * freePool.length)];
        var gotBoon = applyBoon(freeKey);
        if (gotBoon) { core.log('🙏 구출 · 은사 ' + gotBoon.name + ' (' + run.boons[freeKey] + '중첩)', 'good'); }
      }
      dropItem(room, room.captive.x, room.captive.y, 16);
      dropGold(room, room.captive.x, room.captive.y, 2);
      sfx('shrine');
      core.emit('toast', '🙏 구출 · 은혜를 갚는다');
      core.emit('dungeon:rescue', { floor: run.floor });
    }
    if (room.forage) {
      /* 약초 — 항아리와 같은 손짓(닿기만 해도, 방을 안 치워도) */
      var fg = room.forage;
      for (var fhi = 0; fhi < fg.herbs.length; fhi++) {
        var herb = fg.herbs[fhi];
        if (herb.picked || dist(p, herb) > P_R + 16) { continue; }
        herb.picked = true;
        fx.push({ t: 'pop', x: herb.x, y: herb.y, life: 0.3 });
        sfx('jar');
        dropPotion(room, herb.x, herb.y);
      }
      /* 못 — 우물·사당과 같은 손짓(방을 다 치운 뒤 한 번) */
      if (fg.pond && !fg.pond.used && room.cleared && dist(p, fg.pond) < P_R + 20) {
        fg.pond.used = true;
        var catchRoll = Math.random();
        if (catchRoll < 0.5) { dropGold(room, fg.pond.x, fg.pond.y, 1.4); }
        else if (catchRoll < 0.85) { dropMat(room, fg.pond.x, fg.pond.y, 10); }
        else { dropItem(room, fg.pond.x, fg.pond.y, 6); }
        sfx('chest');
        core.emit('toast', '🎣 손맛 · 무언가 걸렸다');
      }
    }
    /* 비밀(POI: Secret) — 균열들 사이에 숨어 있다. 문 목록엔 아예 없으므로
       여기서 방마다 있는 균열을 훑어 찾는다(있으면 하나뿐이다) */
    for (i = 0; i < room.decor.length; i++) {
      var dc = room.decor[i];
      if (!dc.secret || dc.found) { continue; }
      var dcNear = dist(p, dc) < P_R + 22;
      if (dcNear && !dc.near) {
        dc.found = true;
        dropItem(room, dc.x, dc.y, 24);
        dropGold(room, dc.x, dc.y, 2.6);
        sfx('chest');
        core.emit('toast', '🔍 비밀 통로를 찾았다!');
      }
      dc.near = dcNear;
    }

    /* 문 — 통로 반대쪽 끝에 닿아야 실제로 넘어간다(PLAN §28-4 Phase 2).
       동쪽 벽을 스치자마자 즉시 goRoom() 하던 것을, boundPlayer()가 이제
       그 문의 결(lane)에서 열어 주는 짧은 통로(doorCorridorUnits())를
       끝까지 걸어야 걸리게 미뤘다 — travel()이 마을 통로 끝에서 걸리는
       것과 같은 요령이다. **중복 발동 걱정이 없다** — goRoom()이 방을
       통째로 새로 지어 `room.doors` 자체가(그리고 이 문의 `dr.y`도)
       사라지므로, 다음 프레임엔 이 조건이 다른(새) 문 목록을 본다. */
    if (room.cleared) {
      var doorFarX = ROOM_W - WALL - P_R + doorCorridorUnits();
      for (i = 0; i < room.doors.length; i++) {
        var dr = room.doors[i];
        if (p.x > doorFarX - 4 && Math.abs(p.y - dr.y) < 34) {
          sfx('door');
          goRoom(dr.kind);
          break;
        }
      }
    }

    /* 잠깐짜리 무예가 식는다 */
    if (run.buffs) {
      for (var bk in run.buffs) {
        if (!Object.prototype.hasOwnProperty.call(run.buffs, bk)) { continue; }
        run.buffs[bk].t -= dt;
        if (run.buffs[bk].t <= 0) { delete run.buffs[bk]; }
      }
    }
    /* 저주가 풀린다 */
    for (i = 0; i < room.enemies.length; i++) {
      var hx = room.enemies[i].hex;
      if (hx && hx.t > 0) {
        hx.t -= dt;
        if (hx.t <= 0) { room.enemies[i].hex = null; }
      }
    }
    /* 분신이 대신 싸운다 */
    updateMinions(dt);
    if (!run) { return; }
    /* 동행(2번째 인물)이 곁에서 같이 싸운다 (PLAN §51) */
    updateCompanion(dt);
    if (!run) { return; }

    /* 연출 수명 */
    for (i = fx.length - 1; i >= 0; i--) {
      fx[i].life -= dt;
      if (fx[i].life <= 0) { fx.splice(i, 1); }
    }
  }

  var COMBO_WINDOW = 1.6;   // 이 안에 다시 안 때리면 콤보가 끊긴다(초)

  /**
   * 어그로 — 이 적이 플레이어를 알아챈다. 이미 깨어 있으면 아무 일도 없다
   * (값싸게 여러 번 불러도 된다 — 매 틱 사거리 체크가 그렇게 부른다).
   * 그 자리서 "!"가 뜨고(기존 fx 'get' 텍스트 팝업을 그대로 쓴다, 새 렌더
   * 코드 없음), AGGRO_PACK_R 안의 아직 안 깬 동료도 **연쇄로** 같이 깬다 —
   * 원작에서 몹 하나가 터지면 무리가 통째로 달려오는 그 감각이다. `strike()`
   * 가 맞을 때마다 불러 "몰래 지나칠 수는 있어도 몰래 때릴 수는 없다"를
   * 지킨다. `run`/`fx`는 이 시점에 항상 유효하다(update()·stepFieldCombat
   * 안에서만 불린다, withRun이 이미 알맞은 것으로 바꿔 끼운 뒤다).
   */
  function wakeEnemy(en) {
    if (!en || en.aggro || en.hp <= 0) { return; }
    en.aggro = true;
    fx.push({ t: 'get', x: en.x, y: en.y - en.r - 14, text: '!', life: 0.5, color: '#ffcf4d' });
    sfx('alert');
    if (!run.room) { return; }
    var list = run.room.enemies, i;
    for (i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === en || o.hp <= 0 || o.aggro) { continue; }
      if (dist(o, en) <= AGGRO_PACK_R) { wakeEnemy(o); }
    }
  }

  /**
   * 한 대 때린다.
   * @param mul  스킬 배율 (기본 1)
   * @param kb   밀쳐내는 거리 (기본 8 — 타격감의 핵심)
   */
  /**
   * @param kind 'phys'(칼) | 'chi'(기) — 적의 저항이 이 결을 보고 깎는다.
   *             안 주면 물리다(평타·회전참·돌진).
   */
  /** §5.1 세계 축 — 이 결이 이번 타격에 실려 있나(무기 자체 결 kind, 또는
   *  보석으로 박은 결 edmg[el]>0). phys는 edmg에 없는 자리라 kind로만 본다. */
  function hasElemInHit(el, kind, edmg) {
    if (el === 'phys') { return kind === 'phys'; }
    return kind === el || (edmg[el] || 0) > 0;
  }
  /** 반경 안의 살아 있는 다른 적 (world 축 처치·크리 부가효과가 같이 쓴다) */
  function nearbyAlive(center, r) {
    var out = [];
    if (!run || !run.room) { return out; }
    for (var i = 0; i < run.room.enemies.length; i++) {
      var t = run.room.enemies[i];
      if (t === center || t.hp <= 0) { continue; }
      if (dist(t, center) <= r + (t.r || 0)) { out.push(t); }
    }
    return out;
  }
  function addDot(t, el, dps, sec) {
    if (!t.dots) { t.dots = []; }
    t.dots.push({ el: el, dps: dps, t: sec });
  }

  function strike(e, mul, kb, kind) {
    kind = kind || 'phys';
    wakeEnemy(e);
    var edmg = elemDmgOf();
    var hasWd = function (k) { return !!(run && run.boons[k]); };
    var hasEl = function (el) { return hasElemInHit(el, kind, edmg); };
    var dmg = atkOf() * (mul || 1) * (0.86 + Math.random() * 0.28);
    /* 세계 보스(§5.4) 머리 부위 파괴 — 급소가 열려 크리 확률 +15%p */
    var critChance = boonVal('critPct') + core.effect('critPct') + (e.wbHelmBroken ? 15 : 0);
    var crit = forcedCrit !== null ? forcedCrit : (Math.random() * 100 < critChance);
    /* §5.1 세계 축 — 뇌빙(빙+뇌): 슬로우된 적에게 뇌 결이 닿으면 반드시 크리 */
    if (!crit && e.slow > 0 && hasEl('lit') && hasWd('wd_cold_lit')) { crit = true; }
    if (crit) { dmg *= 1.85; }
    dmg *= 1 + boonVal('piercePct') / 100 * 0.5;
    /* §5.1 세계 축 — 결빙(빙+기): 슬로우된 적에게 주는 피해 +30% */
    if (e.slow > 0 && hasWd('wd_cold_chi')) { dmg *= 1.3; }
    /* §5.1 세계 축 — 빙염(화+빙): 화상과 슬로우가 겹친 적에게 +15% */
    if (e.slow > 0 && hasWd('wd_fire_cold') && e.dots &&
        e.dots.some(function (d) { return d.el === 'fire'; })) {
      dmg *= 1.15;
    }
    /* 주박·멸에 걸린 적은 더 아파한다 */
    if (e.hex && e.hex.t > 0) { dmg *= 1 + e.hex.v / 100; }
    /* 저항 — 관통(貫通) 은사가 저항도 절반만큼 뚫는다(방어를 무시하듯) */
    var res = resistOf(e, kind) * (1 - boonVal('piercePct') / 100 * 0.5);
    /* §5.1 세계 축 — 부식(독+전자): 저항 -20 */
    if (hasEl('pois') && hasEl('emp') && hasWd('wd_pois_emp')) { res = Math.max(0, res - 20); }
    if (res > 0) { dmg *= 1 - res / 100; }
    if (nmHasMod('glass')) { dmg *= 1.5; }   // 부적 '유리대포' 변형자(§5.3) — 주는 피해도 는다
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.hurt = 0.08;   /* §5.8① 피격 플래시 80ms(적 전용 — 플레이어 쪽 hurtTint 는 안 건드림) */
    /* §5.19 경직 — 맞으면 다음 공격이 조금 밀린다(보스는 안 밀린다). 떼를 몰아 치는 동안 숨 쉴 틈 */
    if (!e.boss && STAGGER() > 0) { e.cd = Math.max(e.cd || 0, STAGGER()); }
    /* §5.1 세계 축 — 크리티컬 부가효과 둘 */
    if (crit && hasWd('wd_phys_cold') && hasEl('phys')) {
      e.slow = Math.max(e.slow || 0, 2); e.slowMul = 0.6;   // 빙인
    }
    if (crit && hasWd('wd_fire_chi') && hasEl('fire')) {
      var burned = nearbyAlive(e, 80), bi;                   // 폭기
      for (bi = 0; bi < burned.length; bi++) { addDot(burned[bi], 'fire', Math.max(1, Math.round(dmg * 0.12)), 2); }
    }
    /* 넉백 — 보스는 거의 안 밀린다 */
    var push = (kb === undefined ? 8 : kb) * (e.boss ? 0.25 : 1);
    if (push && run) {
      var p = run.player;
      var dx = e.x - p.x, dy = e.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      /* 들판 로머(`.field`)는 `core.clamp(..., WALL+e.r, ROOM_W-WALL-e.r)`로
         **못 미는다** — 그 범위가 "방 안쪽"이라, 방 밖 로머에 그대로 쓰면
         맞을 때마다 방 안으로 순간이동해 버린다(예전에 밟은 함정, 아래
         주석이 그 기억이다).
         2026-09-06 — 그런데 그 대신 **아예 안 막았더니**, 플레이어가 로머보다
         마을 바깥쪽에 서서 때리면 넉백 방향(플레이어 반대쪽)이 마을 쪽을
         가리켜 로머가 벽을 그대로 뚫고 들어갔다("마을에 몹이 들어온다",
         사용자 제보). `stepFieldCombat`의 이동 clamp(위 "축을 나눠 막아…")와
         **같은 요령**으로 고쳤다 — 방 안쪽으로 넣는 축만 한쪽씩 막는다.
         `run`이 마을이면(`town.js`의 raw()) roomW 등이 실려 있어 그 치수로,
         던전이면(그 필드 없음) inRoomRect가 이 모듈의 ROOM_W 등으로
         저절로 넘어간다 — ctx를 새로 안 만들어도 된다. */
      if (e.field) {
        var kx = e.x + dx / d * push, ky = e.y + dy / d * push;
        if (!inRoomRect(kx, e.y, run)) { e.x = kx; }
        if (!inRoomRect(e.x, ky, run)) { e.y = ky; }
      } else {
        e.x = core.clamp(e.x + dx / d * push, WALL + e.r, ROOM_W - WALL - e.r);
        e.y = core.clamp(e.y + dy / d * push, WALL + e.r, ROOM_H - WALL - e.r);
      }
      fx.push({ t: 'slash', x: e.x, y: e.y - e.r * 0.6,
        a: Math.atan2(dy, dx), life: 0.16, crit: crit,
        el: kind !== 'phys' ? kind : null, color: kind !== 'phys' ? elemColorOf(kind) : null });
    }
    fx.push({ t: 'hit', x: e.x, y: e.y - e.r, v: dmg, crit: crit, life: 0.6,
              resist: res >= 20 });
    /* §5.8③ 성장 가시화 — 보물(3) 이상 무기는 때릴 때마다 잔광, 전설(4)은
       파티클(burst)도 하나 더 — 새 3D 지오메트리 없이 기존 fx 표만 재사용 */
    var wTier = weaponTierOf();
    if (wTier >= 3) {
      fx.push({ t: 'trail', x: e.x, y: e.y - e.r * 0.4, life: wTier >= 4 ? 0.3 : 0.22,
        color: wTier >= 4 ? '#c7a76c' : '#00c000' });
    }
    if (wTier >= 4) {
      fx.push({ t: 'burst', x: e.x, y: e.y - e.r * 0.4, life: 0.3, color: '#c7a76c',
        seed: Math.random() * 6.28 });
    }
    /* 연속 타격(콤보) — COMBO_WINDOW 안에 다시 때리면 쌓인다(update()가 끊는다).
       PLAN 15절 "필수: 콤보" — 3부터 화면에 띄운다(1·2는 콤보라 부르기 민망하다).
       §5.8① 타격음 라운드로빈이 이 값을 쓰므로 소리보다 먼저 올린다. */
    run.combo = (run.combo || 0) + 1;
    run.comboT = COMBO_WINDOW;
    if (crit) { sfx('crit'); } else { hitSfx(); }

    /* §5.8① 타격 정지(hitstop) — 잡졸 60ms·정예 90ms·크리 120ms(2026-09-18,
       기존엔 크리·평타 둘뿐이었다). update()가 dt를 확 줄여 몇 프레임
       묵직하게 만든다. `hitstop` 설정이 꺼져 있으면 아예 안 건다(멀미 배려). */
    if (hitstopEnabled()) {
      var hsMs = crit ? 120 : (e.elite ? 90 : 60);
      run.hitstopT = Math.max(run.hitstopT || 0, hsMs / 1000);
    }
    if (run.combo >= 3 && run.player) {
      fx.push({ t: 'get', x: run.player.x, y: run.player.y - P_R - 30,
        text: run.combo + ' 연속!', life: 0.5,
        color: run.combo >= 12 ? '#ff5a5a' : (run.combo >= 6 ? '#ffb454' : '#ffe066') });
    }
    /* §5.1 세계 축 — 작열(물리+화): 콤보 6 이상에서 물리 타격에 화상 */
    if (hasWd('wd_phys_fire') && hasEl('phys') && hasEl('fire') && run.combo >= 6) {
      addDot(e, 'fire', Math.max(1, Math.round(dmg * 0.15)), 2);
    }
    /* §5.1 세계 축 — 경혈(물리+기): 3연속마다 기력 회복 */
    if (hasWd('wd_phys_chi') && hasEl('phys') && hasEl('chi') && run.combo % 3 === 0) {
      run.mp = Math.min(run.mpMax, run.mp + 5);
    }

    /* 원소 — 무기에 박은 보석이 얹는다. **결마다 저항이 따로**다(원작과 같다).
       한 대에 여러 결이 같이 들어갈 수 있다 — 원작의 무기 피해가 그렇다. */
    applyElem(e, mul || 1);
    /* 가시 돋친 정예 — 때린 만큼 조금 되돌아온다 */
    var elS = e.elite ? eliteOf(e.elite) : null;
    if (elS && elS.thorn && e.hp > 0) {
      hurtPlayer(Math.max(1, Math.round(dmg * elS.thorn)), null, e, '가시 되받기');
      if (!run) { return; }
    }
    if (e.hp <= 0) { e.dieKb = push; e.dieOver = dmg / Math.max(1, e.hpMax); kill(e, kind, dmg); }
  }

  /**
   * 원소 피해 한 묶음. 결마다 성질이 다르다 (data-elem.js):
   *   빙 느리게 · 뇌 편차 크게 · 독 몇 초에 걸쳐 · 화·기 곧게.
   * 물리는 여기 안 온다 — 무기 자체가 물리다.
   */
  function applyElem(e, mul) {
    var ED = global.DG.elemData;
    if (!ED) { return; }
    var dmgs = elemDmgOf(), k;
    for (k in dmgs) {
      if (!Object.prototype.hasOwnProperty.call(dmgs, k) || !dmgs[k]) { continue; }
      var def = ED.elemByKey(k);
      if (!def) { continue; }
      var v = dmgs[k] * mul * (1 + run.floor * 0.06);
      if (def.spread) {                       // 뇌 — 편차가 크다
        v *= 1 - def.spread / 2 + Math.random() * def.spread;
      }
      var er = resistOf(e, k);
      v *= 1 - er / 100;
      v = Math.max(1, Math.round(v));

      if (def.dot) {                          // 독 — 몇 초에 걸쳐
        if (!e.dots) { e.dots = []; }
        e.dots.push({ el: k, dps: v / def.dot, t: def.dot });
      } else {
        e.hp -= v;
      }
      if (def.slow) {                         // 빙 — 굼떠진다
        e.slow = Math.max(e.slow || 0, def.slowSec);
        e.slowMul = def.slow;
      }
      fx.push({ t: 'elem', x: e.x + (Math.random() - 0.5) * 10, y: e.y - e.r - 6,
                v: v, el: k, color: def.color, life: 0.6, dot: !!def.dot });
    }
  }

  /** @param {string} [kind] 마지막 일격의 결 — §5.1 세계 축 처치 시너지가 본다
   *  @param {number} [dmg] 마지막 일격의 피해량 — 시너지 부가 피해의 기준값 */
  function kill(e, kind, dmg) {
    run.kills += 1;
    /* §5.19 쓰러짐 연출 — 화면 층(dungeon3d)이 이 방향으로 날려 눕힌다(판정은 안 쓴다) */
    if (run.player) {
      var kdx = e.x - run.player.x, kdy = e.y - run.player.y, kdl = Math.sqrt(kdx * kdx + kdy * kdy) || 1;
      e.dieDx = kdx / kdl; e.dieDy = kdy / kdl; e.dieBig = !!(e.boss || e.elite);
      dieScatter(e);
    }
    dstate().kills = (dstate().kills || 0) + 1;
    /* 처치는 한 대 맞은 것보다 더 묵직하게 — §5.8① 3단(잡졸/정예/크리)의
       대상이 아니라("처치"는 그 셋과 다른 결의 이벤트) 값은 그대로 두고
       설정 손잡이만 같이 탄다 */
    if (hitstopEnabled()) {
      run.hitstopT = Math.max(run.hitstopT || 0, e.boss ? 0.18 : 0.11);
    }
    core.emit('dungeon:kill', { e: e, floor: run.floor });
    /* §5.1 세계 축 — 처치 트리거 3종(폭발·부패·저지, 전부 반경 80) */
    if (run.boons && kind) {
      var kEdmg = elemDmgOf();
      var kHasEl = function (el) { return hasElemInHit(el, kind, kEdmg); };
      if (run.boons.wd_fire_lit && kHasEl('fire') && kHasEl('lit')) {
        var b1 = nearbyAlive(e, 80), i1;
        for (i1 = 0; i1 < b1.length; i1++) { addDot(b1[i1], 'fire', Math.max(1, Math.round((dmg || 1) * 0.15)), 3); }
      }
      if (run.boons.wd_phys_pois && kHasEl('phys') && kHasEl('pois')) {
        var b2 = nearbyAlive(e, 80), i2;
        for (i2 = 0; i2 < b2.length; i2++) { addDot(b2[i2], 'pois', Math.max(1, Math.round((dmg || 1) * 0.12)), 3); }
      }
      if (run.boons.wd_phys_emp && kHasEl('phys') && kHasEl('emp')) {
        var b3 = nearbyAlive(e, 80), i3;
        for (i3 = 0; i3 < b3.length; i3++) { b3[i3].slow = Math.max(b3[i3].slow || 0, 2.5); b3[i3].slowMul = 0.55; }
      }
      /* 감전(물리+뇌) — 재귀 strike() 없이 즉발 피해만(연쇄가 서로를 다시
         트리거하는 무한 루프를 피한다) */
      if (run.boons.wd_phys_lit && kHasEl('phys') && kHasEl('lit')) {
        var near4 = nearbyAlive(e, 80);
        if (near4.length) {
          var t4 = near4[0];
          t4.hp -= Math.max(1, Math.round((dmg || 1) * 0.5));
          fx.push({ t: 'elem', x: t4.x, y: t4.y - (t4.r || 0) - 6, v: Math.round((dmg || 1) * 0.5),
            el: 'lit', color: elemColorOf('lit'), life: 0.6, dot: false });
        }
      }
    }
    var drain = boonVal('drainPct');
    if (drain) { healBy(run.hpMax * drain / 100); }
    run.mp = Math.min(run.mpMax, run.mp + MP_ON_KILL);
    fx.push({ t: 'pop', x: e.x, y: e.y, life: 0.45, boss: e.boss });
    fx.push({ t: 'burst', x: e.x, y: e.y - e.r * 0.5, life: 0.5, boss: e.boss,
      color: (e.ref && e.ref.color) || '#c9a83a', seed: Math.random() * 6.28 });
    sfx(e.boss ? 'boss' : 'kill');
    var elK = e.elite ? eliteOf(e.elite) : null;
    if (elK && elK.split && !e.shade) {
      /* 그림자 — 쓰러진 자리에 분신이 선다 (원작의 분열 몬스터) */
      for (var sp = 0; sp < elK.split; sp++) {
        var kid = spawnEnemy(run.floor, false, {
          spawned: true, shade: true,
          x: core.clamp(e.x + (sp ? 22 : -22), WALL + 12, ROOM_W - WALL - 12),
          y: core.clamp(e.y + (sp ? 14 : -14), WALL + 12, ROOM_H - WALL - 12)
        });
        run.room.enemies.push(kid);
      }
      core.emit('toast', '👤 그림자가 갈라졌다');
    }
    dropGold(run.room, e.x, e.y, e.boss ? 5 : (elK ? 2.2 : (e.minion ? 0.4 : 1)));
    /* 정예는 원작처럼 **확정으로** 떨어뜨린다 · 무리 졸개(§5.19)는 잡졸의 절반 */
    var chance = e.boss ? 1 : (elK ? 1 : (0.2 + Math.min(0.15, run.floor * 0.004)) * (e.minion ? 0.5 : 1));
    if (Math.random() < chance) {
      dropItem(run.room, e.x, e.y, e.boss ? 30 : (elK ? 14 : 0));
    }
    /* 세공 재료 — 장비보다 자주 나온다(박을 자리는 늘 모자라다) */
    if (Math.random() < (e.boss ? 0.9 : 0.12)) {
      dropMat(run.room, e.x, e.y, e.boss ? 30 : 0);
    }
    /* 단약 — 원작에서 **가장 흔한 드랍**이다. 벨트가 비면 싸움을 이어 갈 수 없다 */
    if (Math.random() < (e.boss ? 1 : (elK ? 0.34 : 0.16))) {
      dropPotion(run.room, e.x, e.y);
    }
    /* 감정서 — 미확인 물건이 쌓이는 속도에 맞춰 나온다.
       모자라면 행상에서 싸게 산다(막는 관문이 아니라 거쳐 가는 자리다) */
    if (Math.random() < (e.boss ? 0.8 : 0.07)) {
      run.room.drops.push({ kind: 'scroll', x: jitter(e.x), y: jitter(e.y) });
    }
    core.gainExp(Math.round((1 + Math.floor(run.floor / 3)) * mode().exp * RG()));
    global.DG.hero.awardParty(1 + Math.floor(run.floor / 4));
    tryCatchPet(e);
    /* 세계 보스(§5.4) — 위 일반 처치 보상(run.floor=0 이라 미미하다)과
       별개로, best 층 기준의 참가 보상을 따로 준다(아래 grantWorldBossReward). */
    if (e.worldBoss) { grantWorldBossReward(e, run.room, false); }
    if (e.regionBoss) { grantRegionBossReward(e, run.room); }
    if (e.fixedGuard) { grantFixedReward(e, run.room); }
    if (run.trial) { trialOnKill(e); }
  }

  /* 2026-09-10 — "강공격이랑 전용 회피 버튼도"(사용자). 평타(위 update() "내
     공격")는 자동이고 무예(Z X C V)는 MP·슬롯이 든다 — 그 사이에 **아무나
     처음부터, 쿨다운만으로** 쓰는 기본기 둘을 놓는다. PLAN 15절 "필수" 목록의
     "강공격"·"회피"에 정확히 대응한다. */
  var HEAVY_CD = 1.3, HEAVY_MUL = 2.6, HEAVY_KB = 26, HEAVY_RECOVER = 0.16;
  var DODGE_CD = 0.9, DODGE_SEC = 0.16, DODGE_SPD = 520, DODGE_INVULN = 0.22;
  /* §5.8② 저스트 회피(2026-09-18) — 적 공격이 0.15초 안에 터질 때 회피하면
     보너스. **보스 패턴(`en.slamWarn`)만** 예고(telegraph)가 있다 — 잡몹은
     `en.cd<=0`이면 그 프레임에 바로 맞는 구조라 예고 자체가 없다. 잡몹까지
     다루려면 전투 AI 전체에 새 예고 타이머를 얹어야 해 범위 밖으로 뒀다
     (이번 구현이 스스로 내린 판단 — 사용자와 상의한 적 없다). */
  var JUST_DODGE_WINDOW = 0.15, JUST_DODGE_SLOW = 0.2;
  function justDodgeTarget() {
    if (!run || !run.room) { return null; }
    var list = run.room.enemies, i;
    for (i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.hp > 0 && e.slamWarn > 0 && e.slamWarn <= JUST_DODGE_WINDOW) { return e; }
    }
    return null;
  }

  /** 강공격 — 평타보다 훨씬 세고 크게 밀치지만, 감아 치는 동안(HEAVY_RECOVER)
   *  평타가 못 낀다(atkCd를 같이 밀어 둔다) 그리고 쿨다운이 있다.
   *  사거리 안에 적이 없으면 그냥 아무 일도 안 일어난다(헛손질 연출은 안 둔다
   *  — 평타도 표적이 없으면 아예 안 그린다, 같은 결). */
  function heavyAttack() {
    if (!run) { return false; }
    var p = run.player;
    if (p.heavyCd > 0 || p.dash || p.dodge) { return false; }
    var reach = reachOf() * 1.15, room = run.room;
    var near = null, nd = 1e9, i;
    for (i = 0; i < room.enemies.length; i++) {
      var e = room.enemies[i];
      if (e.hp <= 0) { continue; }
      var d = dist(run.player, e) - e.r;
      if (d < nd) { nd = d; near = e; }
    }
    if (!near || nd > reach) { return false; }
    p.heavyCd = HEAVY_CD;
    p.atkCd = Math.max(p.atkCd, HEAVY_RECOVER);
    p.atkAnim = 0.38;                    // 평타(0.22)보다 오래 자세가 남는다 — 묵직한 스윙
    p.castAnim = false;
    sfx('heavy');
    strike(near, HEAVY_MUL, HEAVY_KB);
    if (run && CLEAVE_ON()) { cleave(near, reach * HEAVY_R, HEAVY_HALF, HEAVY_MUL * HEAVY_SIDE, HEAVY_KB); }
    return true;
  }

  /**
   * §5.19 휩쓸기 — 가장 가까운 적(`main`)을 친 뒤, 나에서 그 적 쪽 부채꼴(반각 half) 안·반경 R 안의
   * **다른** 적을 mul 배로 함께 벤다. 한 대마다 `strike()` 를 거친다(모든 피해가 지나는 유일한 통로 — PLAN §2).
   * 목록은 미리 떠 둔다 — 그림자 분열(strike → kill)이 도중에 배열을 늘린다
   */
  function cleave(main, R, half, mul, kb) {
    if (!run || !run.room) { return; }
    var p = run.player, a0 = Math.atan2(main.y - p.y, main.x - p.x);
    var list = run.room.enemies.slice(), i;
    for (i = 0; i < list.length && run; i++) {
      var e = list[i];
      if (e === main || e.hp <= 0) { continue; }
      if (dist(p, e) - e.r > R) { continue; }
      var da = Math.atan2(e.y - p.y, e.x - p.x) - a0;
      while (da > Math.PI) { da -= Math.PI * 2; }
      while (da < -Math.PI) { da += Math.PI * 2; }
      if (Math.abs(da) > half) { continue; }
      strike(e, mul, kb);
    }
  }

  /**
   * §5.19 2차 쓰러짐 흩어짐 — 떼가 한꺼번에 쓰러질 때 모두 같은 결로 곧게 날지 않고 부채처럼 흩어진다.
   * 방향을 ±0.45 라디안 흔들고(쓰러진 자리의 해시 — 난수 0), 세게 맞을수록(밀침·넘친 피해) 멀리 날고 빙글 돈다.
   * 그림 층(dungeon3d)만 읽는다 — 판정은 이미 끝났다
   */
  function dieScatter(e) {
    var s = SCATTER();
    e.dieF = 1; e.dieSpin = 0;
    if (!s) { return; }
    var qx = Math.round(e.x * 3), qy = Math.round(e.y * 3);
    var h = core.hash2(qx, qy), h2 = core.hash2(qy + 7, qx + 11);
    var j = (h - 0.5) * 0.9 * s, cj = Math.cos(j), sj = Math.sin(j);
    var dx = e.dieDx * cj - e.dieDy * sj, dy = e.dieDx * sj + e.dieDy * cj;
    e.dieDx = dx; e.dieDy = dy;
    var kb = e.dieKb || 0, over = Math.min(2, e.dieOver || 0);
    var f = core.clamp(0.7 + kb / 40 + over * 0.35 + h2 * 0.3, 0.7, 2.4);
    e.dieF = 1 + (f - 1) * s;
    e.dieSpin = (h2 - 0.5) * 2 * Math.min(1.5, kb / 30) * s;
  }

  /** §5.19 2차 — 적 e 가 나(p)에서 a0 쪽 반각 half 부채꼴 안에 드나. 몸이 겹친 적은 늘 든다(발밑을 헛치지 않게) */
  function inArc(p, e, a0, half) {
    if (dist(p, e) <= (e.r || 12) + P_R) { return true; }
    var da = Math.atan2(e.y - p.y, e.x - p.x) - a0;
    while (da > Math.PI) { da -= Math.PI * 2; }
    while (da < -Math.PI) { da += Math.PI * 2; }
    return Math.abs(da) <= half;
  }

  /** 원뿔 무예의 방향 — 반경 1.2배 안의 가장 가까운 적, 없으면 마지막 걸음 방향 */
  function coneAim(R) {
    var p = run.player, best = null, bd = R * 1.2, i, es = run.room.enemies;
    for (i = 0; i < es.length; i++) {
      if (es[i].hp <= 0) { continue; }
      var d0 = dist(p, es[i]);
      if (d0 < bd) { bd = d0; best = es[i]; }
    }
    if (best) { return Math.atan2(best.y - p.y, best.x - p.x); }
    return Math.atan2(p.dirY || 0, p.dirX || p.facing || 1);
  }

  /** 원뿔 궤적 — 부채꼴을 세 획(fx 'fan')으로 긋는다. 판정은 안 쓴다 */
  function pushFanFx(p, a0, half, R, el) {
    for (var s = -1; s <= 1; s++) {
      var ang = a0 + s * half * 0.6;
      fx.push({ t: 'fan', x: p.x + Math.cos(ang) * R * 0.5, y: p.y + Math.sin(ang) * R * 0.5, a: ang,
        r: R * 0.55, life: 0.26, color: el ? elemColorOf(el) : null });
    }
  }

  /**
   * §5.19 2차 끌어당기기 — 반경 R 안의 적을 PULL_SEC 동안 내 발밑으로 끌어온다(`pullStep` 이 옮긴다).
   * 보스는 안 끌린다. 끌린 적은 깬다(어그로). 난수 0 — 떼를 모아 한 번에 쓸어버리는 몰이의 앞 절반
   */
  function pullIn(R, el) {
    if (!run || !run.room || !PULL_ON()) { return 0; }
    var p = run.player, es = run.room.enemies, n = 0, i;
    for (i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.hp <= 0 || e.boss) { continue; }
      var d0 = dist(p, e);
      if (d0 > R + e.r || d0 <= e.r + P_R + 6) { continue; }
      e.pullT = PULL_SEC;
      wakeEnemy(e);
      n++;
    }
    fx.push({ t: 'pull', x: p.x, y: p.y, r: R, life: 0.35, color: el ? elemColorOf(el) : null });
    return n;
  }

  /** 끌려오는 중인 적 한 걸음. 들판 로머는 넉백과 같은 요령(축을 나눠 방 안쪽만 막는다) */
  function pullStep(en, dt, ctx) {
    if (!(en.pullT > 0) || !run || !run.player) { return; }
    en.pullT -= dt;
    var p = run.player, dx = p.x - en.x, dy = p.y - en.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var stop = en.r + P_R + 4;
    if (d <= stop) { en.pullT = 0; return; }
    var mv = Math.min(d - stop, PULL_SPD * dt), nx = en.x + dx / d * mv, ny = en.y + dy / d * mv;
    if (en.field) {
      var c = ctx || run;
      if (!inRoomRect(nx, en.y, c)) { en.x = nx; }
      if (!inRoomRect(en.x, ny, c)) { en.y = ny; }
    } else {
      en.x = core.clamp(nx, WALL + en.r, ROOM_W - WALL - en.r);
      en.y = core.clamp(ny, WALL + en.r, ROOM_H - WALL - en.r);
    }
  }

  /** 회피 — 짧게 미끄러지며 그동안 무적이다. `p.dash`(무예 "돌진")와 달리
   *  적을 베지 않는다 — 순수 회피다. 쿨다운만 있고 MP·스킬 슬롯이 안 든다. */
  function doDodge() {
    if (!run) { return false; }
    var p = run.player;
    if (p.dodgeCd > 0 || p.dodge || p.dash) { return false; }
    var ddx = p.dirX || p.facing, ddy = p.dirY || 0;
    var dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    p.dodge = { t: DODGE_SEC, dx: ddx / dl, dy: ddy / dl };
    p.invuln = Math.max(p.invuln || 0, DODGE_INVULN);
    p.dodgeCd = DODGE_CD;
    /* §5.8② 저스트 회피 — 창 안이면 콤보+3·슬로우 0.2초·다른 소리 */
    var justE = justDodgeTarget();
    if (justE) {
      run.combo = (run.combo || 0) + 3;
      run.comboT = COMBO_WINDOW;
      run.slowT = Math.max(run.slowT || 0, JUST_DODGE_SLOW);
      sfx('dodgeJust');
    } else {
      sfx('dash');
    }
    return true;
  }

  /* ── 투장(套裝) 전용 무예 — 2026-09-10 ───────────────────────
   * "방어구 세트마다 특색 스킬"(사용자). 배우지 않는다 — 무기·갑주·부적
   * 세 점을 **선두가** 다 걸쳐야 손에 잡힌다(item.js의 setSkillFor).
   * 강공격·회피처럼 쿨다운만 있는 기본기 자리에 셋째로 놓는다 — MP도
   * 배움도 안 쓴다, 세트를 맞춘 것 자체가 값이다. 모양 실행은 슬롯형
   * 무예와 같은 applyShapeSkill 을 그대로 쓴다(위 castSkill 참고). */

  /** 지금 손에 잡히는 투장 무예 — 없으면 null. 화면(status())도 이걸 읽는다 */
  function activeSetSkill() {
    var it = global.DG.item, id = leadId();
    return (it && id) ? it.setSkillFor(id) : null;
  }

  function castSetSkill() {
    if (!run || run.choice) { return false; }
    var got = activeSetSkill();
    if (!got) { return false; }
    var sk = got.sk, p = run.player;
    if (p.setSkCd > 0 || p.dash) { return false; }
    p.setSkCd = sk.cd;
    p.atkAnim = castPoseSecOf(sk);
    p.castAnim = !MELEE_SHAPES[sk.shape];
    sfx('setsk');
    applyShapeSkill(sk, sk.v);
    core.emit('dungeon:skill', 'set:' + got.set.key);
    return true;
  }

  /* ── 인물별 서명 무예 — 2026-09-11 ────────────────────────────
   * "캐릭터마다 스킬이 달라야 해"(사용자). 투장 전용 무예와 계약이
   * 완전히 같다 — 배우지 않는다, MP·슬롯 안 씀, v 는 고정값. 다른 점은
   * 트리거 하나뿐: 장비 3점이 아니라 **이 인물이 선두**면 상시 켜진다.
   * 모양 실행은 같은 applyShapeSkill 을 그대로 쓴다. */

  /** 지금 선두의 서명 무예 — 파일럿 밖 인물이면 null */
  function activeSigSkill() {
    var HS = global.DG.heroSkillData, id = leadId();
    return (HS && id) ? HS.sigOf(id) : null;
  }

  /** §5.1 인물 축 — 그림자 서명(hr_shadow_l). 평타가 맞을 때마다 확률로
   *  부대 3~5번째(0-index 2~4) 인물의 서명 무예를 얹는다. 파일럿 무예처럼
   *  쿨다운·MP 를 안 쓴다 — "얹힌다"는 표현 그대로 평타에 곁들이는 보너스. */
  function tryShadowSig() {
    var pct = boonVal('shadowSigPct');
    if (!pct || Math.random() * 100 >= pct) { return; }
    var HS = global.DG.heroSkillData, party = core.save.party;
    if (!HS) { return; }
    for (var i = 2; i <= 4 && i < party.length; i++) {
      var sk = HS.sigOf(party[i]);
      if (sk) { applyShapeSkill(sk, sk.v); return; }
    }
  }

  function castSigSkill() {
    if (!run || run.choice) { return false; }
    var sk = activeSigSkill();
    if (!sk) { return false; }
    var p = run.player;
    if (p.sigSkCd > 0 || p.dash) { return false; }
    /* §5.1 인물 축 — 심법(쿨감 sigCdPct·위력 sigDmgPct). 위력 축복을 가졌으면
       "부대 전원 흔들림·플래시"를 기존 'ring' 연출로 대신한다(카메라 흔들림
       자체는 dungeon-view.js 안 로컬 변수라 여기서 못 건드린다 — 단순화). */
    p.sigSkCd = sk.cd * (1 - boonVal('sigCdPct') / 100);
    p.atkAnim = castPoseSecOf(sk);
    p.castAnim = !MELEE_SHAPES[sk.shape];
    sfx('setsk');                          // 새 효과음 자산 없이 투장 무예 것을 빌린다
    if (boonVal('sigDmgPct') > 0) { fx.push({ t: 'ring', x: p.x, y: p.y, life: 0.6 }); }
    applyShapeSkill(sk, sk.v * (1 + boonVal('sigDmgPct') / 100));
    if (!run) { return true; }
    run.comboT = ALLY_COMBO_WIN;           // §5.17 — 이 창 안에 동행 서명이 나가면 합격
    core.emit('dungeon:skill', 'sig:' + leadId());
    return true;
  }

  /**
   * 포획(捕獲) — PLAN 34절 "도감을 콘텐츠 수집 시스템으로". `data.js` 의
   * PETS 표에는 진작부터 `catchBase`(잡힐 확률) 가 붙어 있었는데, 이걸 읽어
   * `core.save.dex.pets` 에 채워 넣는 자리가 어디에도 없었다 — 그래서 펫
   * 도감은 늘 비어 있었고 `ui.js` `petOptions()` 의 펫 장착 드롭다운도
   * "펫 없음" 만 나오는, 있는데 닿을 수 없는 기능이었다. 짐승형 몬스터를
   * 잡으면 동물(beast) 펫이, **보스**를 잡으면 신수(divine) 펫이 잡힌다
   * (신수는 "3층마다" 인물이 합류하는 것과 같은 리듬 — `DD.isBossFloor`).
   *
   * **`Math.random()` 을 안 쓴다.** `kill()` 은 자가진단의 씨앗 기반 시나리오
   * 대부분이 지나는 아주 흔한 길목이라, 여기서 한 번이라도 더 뽑으면 그
   * 뒤에 오는 무관한 항목들의 수열이 통째로 밀린다 — `core.hash2` 자체가
   * 바로 이 함정(무기 원소 피해 항목이 넘어졌다)을 밟고 만들어진 함수다
   * (이 파일 위쪽 주석 참고). 그래서 여기도 `run.floor`·`run.kills`(이미
   * 세고 있는 누적치)로만 정해지는 순수 해시를 쓴다 — 실제 플레이에서는
   * 여전히 매 킬마다 다르게 보이지만, 진단의 Math.random 수열은 안 건드린다.
   */
  function tryCatchPet(e) {
    var PD = global.DG.data;
    if (!PD || !PD.pets || !e.ref) { return; }
    var wantKind = e.boss ? 'divine' : (e.ref.kind === 'beast' ? 'beast' : null);
    if (!wantKind) { return; }
    var pool = PD.pets.filter(function (p) { return p.kind === wantKind; });
    if (!pool.length) { return; }
    var seedBase = (run.floor || 0) * 9973 + run.kills;
    var p = pool[Math.floor(core.hash2(seedBase, 4001) * pool.length)];
    if (core.hash2(seedBase, 4002) >= (p.catchBase || 0.3)) { return; }
    var dex = core.save.dex.pets;
    if (dex[p.id]) {
      dex[p.id].count += 1;
    } else {
      dex[p.id] = { count: 1, firstAt: Date.now() };
      core.gainFeat(p.rarity * 6, '포획');
      core.log('🐾 ' + p.name + ' 을(를) 길들였다', 'good');
      core.emit('toast', '🐾 ' + p.name + ' 포획!');
      core.emit('dex:new', { cat: 'pets', id: p.id });
    }
    core.emit('changed');
  }

  /**
   * 지역(地域) 도감 — PLAN 34절 "수집: ... 지역". 층 테마 여섯 가지(고분·폐성·
   * 산채·수궁·지옥문·천계, `data-dungeon.js` THEMES)에 처음 닿으면 등록한다.
   * 펫 포획과 달리 **굴리는 값이 없다** — 그 층에 들어섰다는 사실 하나로
   * 정해지는 순수 부기(附記)라 `Math.random()`도 `core.hash2`도 필요 없다.
   * 자가진단 시드에 영향이 전혀 없다.
   */
  function registerRegion(floor) {
    var name = DD.themeOf(floor).name;
    if (core.save.dex.regions[name]) { return; }
    core.save.dex.regions[name] = true;
    core.log('🗺️ 지역 발견 · ' + name, 'good');
    core.emit('toast', '🗺️ 지역 발견 · ' + name);
    core.emit('dex:new', { cat: 'regions', id: name });
  }

  function dropGold(room, x, y, mul) {
    var g = Math.round(5 * Math.pow(1.19, run.floor - 1) * mul * mode().gold *
      (1 + boonVal('goldPct') / 100) * (1 + core.effect('goldPct') / 100) * nmLootMul() * RG());
    room.drops.push({ kind: 'gold', gold: g, x: jitter(x), y: jitter(y) });
  }

  function dropItem(room, x, y, bias) {
    /* 부적 보상 배율(§5.3 nmLootMul)은 "물건 값" 보다 "등급 운"으로 더
       느껴져서(수·비율이 아니라 하나짜리 드랍이라) bias 를 올리는 쪽으로
       옮겨 실었다 — 배율 1.5배 = bias +20 정도로 어림했다(티어 1당 대략
       그 정도 확률 차가 나는 값, rollTier 의 find 가중과 같은 형태). */
    var b = (bias || 0) + mode().bias + Math.round((nmLootMul() - 1) * 40);
    var it = global.DG.item.roll(run.floor + 1, { bias: b });
    room.drops.push({ kind: 'item', item: it, x: jitter(x), y: jitter(y) });
    /* 떨어지는 순간에 등급이 들린다(§5.9, 원작 3편의 전설 낙하음) — 보물·전설만 */
    if ((it.tier || 0) >= 3 || it.uniq) { sfx(it.tier >= 4 || it.uniq ? 'uniq' : 'drop3'); }
  }

  /**
   * 세공 재료 — 보석 · 부문(符文) · 주옥(珠玉).
   * 부문은 층이 깊어야 나온다(원작에서 높은 룬이 깊은 곳에서만 나오는 그 규칙).
   * 주옥은 셋 중 가장 드물고 **4층부터** 나온다 — 굴러 나오는 물건이라
   * 처음부터 쏟아지면 보석을 박을 까닭이 없어진다.
   */
  function dropMat(room, x, y, bias) {
    var GD = global.DG.gemData;
    if (!GD) { return; }
    var floor = run.floor;
    if (GD.rollJewel && floor >= 4) {
      var jewelChance = Math.min(0.10, 0.02 + floor * 0.004) +
        ((bias || 0) + mode().bias) / 600;
      if (Math.random() < jewelChance) {
        room.drops.push({ kind: 'mat', mat: { kind: 'jewel', j: GD.rollJewel(floor + 1) },
                          x: jitter(x), y: jitter(y) });
        return;
      }
    }
    var runeChance = 0.22 + ((bias || 0) + mode().bias) / 200;
    if (Math.random() < runeChance) {
      /* 부문 — 층이 감당하는 등급까지만 */
      var maxTier = core.clamp(1 + Math.floor(floor / 4), 1, 5);
      var pool = GD.RUNES.filter(function (r) { return r.tier <= maxTier; });
      if (pool.length) {
        var wsum = 0, i;
        for (i = 0; i < pool.length; i++) { wsum += 1 / pool[i].tier; }
        var pick = Math.random() * wsum, chosen = pool[0];
        for (i = 0; i < pool.length; i++) {
          pick -= 1 / pool[i].tier;
          if (pick <= 0) { chosen = pool[i]; break; }
        }
        room.drops.push({ kind: 'mat', mat: { kind: 'rune', key: chosen.key },
                          x: jitter(x), y: jitter(y) });
        return;
      }
    }
    /* 보석 — 등급도 층을 탄다 */
    var gem = core.pick(GD.GEMS);
    var g = 0, cap = core.clamp(Math.floor(floor / 3), 0, 4);
    while (g < cap && Math.random() < 0.45) { g++; }
    room.drops.push({ kind: 'mat', mat: { kind: 'gem', key: gem.key, g: g },
                      x: jitter(x), y: jitter(y) });
  }

  function dropPotion(room, x, y) {
    var P = global.DG.potion;
    if (!P) { return; }
    room.drops.push({ kind: 'potion', p: P.rollDrop(run.floor), x: jitter(x), y: jitter(y) });
  }

  function jitter(v) { return v + (Math.random() - 0.5) * 26; }

  function take(dp) {
    if (dp.kind === 'gold') {
      /* 마을(`run.town`)은 탈출해야 정산되는 노획물 개념이 없다 — 이미 안전지대에
         있으므로 주운 즉시 지갑으로 넣는다(재료·물약·감정서와 같은 대접) */
      if (run.town) { core.save.player.gold += dp.gold; }
      else { run.loot.gold += dp.gold; }
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: '+' + core.fmt(dp.gold), life: 0.8, k: 'gold' });
      sfx('gold');
    } else if (dp.kind === 'scroll') {
      /* 감정서도 재료처럼 **바로 주머니로** — 노획물 정산을 타지 않는다 */
      global.DG.item.addScroll(1);
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: '감정서', color: '#8ec7ff', life: 1.0 });
      sfx('scroll');
    } else if (dp.kind === 'potion') {
      var P = global.DG.potion;
      if (!P) { return false; }
      var pr = P.add(dp.p.kind, dp.p.g);
      if (!pr.ok) { return false; }               // 벨트가 찼다 — 바닥에 남는다
      var pl = P.label(dp.p.kind, dp.p.g);
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: pl,
                color: P.kindOf(dp.p.kind).color, life: 1.0 });
      sfx('coin');
    } else if (dp.kind === 'mat') {
      /* 재료는 즉시 주머니로 — 노획물 정산을 타지 않는다(죽어도 잃지 않는다).
         원작에서도 룬·젬은 인벤에 바로 들어간다 */
      var GD = global.DG.gemData;
      var m = dp.mat, label, color;
      if (m.kind === 'jewel') {
        /* 주옥은 낱개라 자리가 없으면 **바닥에 남는다**(요대와 같은 규칙) */
        var jr = global.DG.item.addJewel(m.j);
        if (!jr.ok) { return false; }
        m.j = jr.jewel;                       // id 가 붙은 것으로 갈아 둔다
        label = GD.jewelName(jr.jewel);
        color = '#f07ac0';
      } else {
        global.DG.item.addMat(m.kind, m.key, m.g || 0, 1);
        label = m.kind === 'gem'
          ? (GD.grade(m.g).name + ' ' + GD.gemByKey(m.key).name)
          : (GD.runeByKey(m.key).glyph + '(' + GD.runeByKey(m.key).name + ')');
        color = m.kind === 'rune' ? '#f0a53a' : GD.grade(m.g).color;
      }
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: label, color: color, life: 1.1 });
      sfx(m.kind === 'gem' ? 'mat' : (m.kind === 'rune' ? 'rune' : 'jewel'));
      if (m.kind === 'rune') { core.emit('toast', '📜 부문 ' + label); }
      if (m.kind === 'jewel') { core.emit('toast', '◈ 주옥 · ' + label); }
    } else {
      run.loot.items.push(dp.item);
      var t = global.DG.item.tierOf(dp.item);
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: global.DG.item.name(dp.item), color: t.color, life: 1.1, rar: global.DG.vfx2d ? global.DG.vfx2d.rarOfTier(t.key) : 0 });
      /* 고유가 떨어지면 따로 알린다 — 원작에서 유니크는 **소리부터** 다르다.
         2026-08-26 부터 여기도 실제로 소리가 다르다(sfx.js 의 'uniq' — 그 종소리) */
      var uq2 = global.DG.item.uniqOf(dp.item);
      var S2 = global.DG.sfx;
      if (S2) { S2.play(S2.dropCue(dp.item.tier, uq2)); }
      if (uq2) { core.emit('toast', '⭐ 고유 · ' + uq2.name); }
      else if (dp.item.tier >= 2) {
        core.emit('toast', '🎁 ' + t.name + ' · ' + global.DG.item.name(dp.item));
      }
    }
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) || 0.0001;
  }

  /* ── 스킬 ─────────────────────────────────────────────── */

  /**
   * 스킬을 쓴다.
   * @param i 0 회전참 · 1 돌진 · 2 기공파 · 3 사기
   * @return true = 시전됨
   */
  /* ── 무예(武藝) — 원작의 스킬 ───────────────────────────────
   * 직업마다 아홉씩, 다섯 직업이면 마흔다섯이다. 마흔다섯을 따로 구현하면
   * 손을 못 댄다 — 원작의 스킬도 실은 **몇 가지 모양**이 원소·수치만 바꿔 가며
   * 되풀이된다. 그래서 **모양 아홉**만 여기 두고, 표(data-skill.js)가 값을 끼운다.
   *
   * 어느 무예를 쓰느냐는 **선두**가 정한다. 동행을 바꾸면 손이 통째로 바뀐다 —
   * 그게 원작에서 직업을 고르는 감각이다.
   */

  /** 네 칸에 걸린 무예 (없으면 빈 칸) */
  function slotSkills() {
    var skl = global.DG.skill, id = leadId();
    if (!skl || !id) { return [null, null, null, null]; }
    return skl.equipped(id);
  }

  /** 선두가 이 무예에 걸어 둔 비결 — 없으면 그대로(배수 1) */
  function secretMod(sk) {
    var SC = global.DG.secret;
    if (!SC || !sk) { return { sk: sk, dmg: 1, cost: 1, cd: 1, drain: 0, key: null }; }
    var m = SC.modify(sk, SC.of(leadId(), sk.key));
    /* 비전(§5.10) — 선두가 입은 전설이 이 비결을 키우면 위력 ×1.6 · 부르기는 수 +1 */
    var b = m.key && SC.boostOf ? SC.boostOf(leadId(), m.key) : 1;
    if (b > 1) {
      m.dmg *= b; m.boost = b;
      if (sk.shape === 'summon') { m.summonAdd = (m.summonAdd || 0) + 1; }
    }
    return m;
  }

  /** 무예의 위력 배수 — '집중·주술' 같은 상시가 여기 얹힌다 */
  function skillMul() { return 1 + boonVal('skillPct') / 100; }

  /** 몸으로 베는 모양 — 그 밖은 다 '시전' 자세(p.castAnim)로 간다.
   *  3D·2D 렌더가 p.castAnim 을 보고 attack/interaction 애니메이션을 가른다. */
  var MELEE_SHAPES = { swing: 1, dash: 1 };

  /** 무예 모양마다 자세가 남는 길이 — 평타(0.22)·강공격(0.38)과 같은 결로,
   *  기력을 많이 먹는 무예일수록(대략 sec·cd로 짐작되는 "큰 기술")
   *  조금 더 오래 자세가 남는다. 상한을 둬 시전 중 다음 입력이 너무 안
   *  먹진 않게 한다. */
  function castPoseSecOf(sk) {
    if (sk.shape === 'passive') { return 0; }
    return Math.min(0.5, 0.24 + (sk.cost || 20) / 160);
  }

  function castSkill(i) {
    if (!run || run.choice) { return false; }
    var got = slotSkills()[i];
    if (!got) { return false; }
    var sk = got.sk, rank = got.rank;
    var SDx = global.DG.skillData;
    var p = run.player;
    /* 비결(§5.9, secret.js) — 무예 하나의 쓰임을 바꾼다(위력·기력·재냉각·결·범위·흡수) */
    var mod = secretMod(sk);
    var cost = Math.round(sk.cost * mod.cost);
    if (p.cds[i] > 0 || run.mp < cost || p.dash) { return false; }
    run.mp -= cost;
    p.cds[i] = sk.cd * mod.cd;
    p.atkAnim = castPoseSecOf(sk);
    p.castAnim = !MELEE_SHAPES[sk.shape];
    var sv = SDx.valueAt(sk, rank);
    sv = sk.shape === 'summon' ? sv + (mod.summonAdd || 0) : sv * mod.dmg;
    if (mod.drain) { addBuff('drainPct', mod.drain, mod.drainSec); }
    applyShapeSkill(mod.sk, sv);
    core.emit('dungeon:skill', sk.key);
    return true;
  }

  /**
   * 모양(shape)에 값을 끼워 실제 효과를 낸다 — **슬롯형 무예(castSkill)와
   * 투장 전용 무예(castSetSkill)가 이 한 함수를 같이 쓴다.** 코스트·쿨다운·
   * MP 차감은 부른 쪽이 먼저 끝내고 온다 — 여기는 sk.shape 만 본다
   * (data-skill.js 머리말의 "모양 아홉" 설계를 그대로 잇는다).
   */
  function applyShapeSkill(sk, v) {
    var p = run.player, room = run.room, j;

    if (sk.shape === 'swing') {
      /* §5.1 무예 축 — 검세 확장(swingRangePct) */
      var radius = reachOf() * (sk.r || 2.0) * (1 + boonVal('swingRangePct') / 100);
      /* §5.19 2차 원뿔 — `arc`(반각, 라디안)가 있으면 둘레가 아니라 **앞 부채꼴**을 멀리 쓴다.
         방향은 부채꼴 안에 드는 가장 가까운 적 쪽(없으면 마지막 걸음 방향) — 떼를 향해 긋는 한 획 */
      var arc = sk.arc && CONE_ON() ? sk.arc : 0, a0 = 0;
      if (arc) {
        a0 = coneAim(radius);
        pushFanFx(p, a0, arc, radius, sk.el);
      } else {
        fx.push({ t: 'whirl', x: p.x, y: p.y, r: radius, life: 0.3,
          el: sk.el || null, color: sk.el ? elemColorOf(sk.el) : null });
      }
      var wlist = room.enemies.slice();
      for (j = 0; j < wlist.length && run; j++) {
        var we = wlist[j];
        if (we.hp <= 0) { continue; }
        if (dist(p, we) > radius + we.r) { continue; }
        if (arc && !inArc(p, we, a0, arc)) { continue; }
        strike(we, v * skillMul(), sk.kb === undefined ? 20 : sk.kb, sk.el || 'phys');
      }

    } else if (sk.shape === 'nova') {
      /* §5.1 무예 축 — 이중/삼중 파동(novaExtraRing): 링이 한두 번 더 터진다 */
      var nr = (sk.r || 130), novaTimes = 1 + boonVal('novaExtraRing');
      if (sk.pull) { pullIn(sk.pull, sk.el); }   // §5.19 2차 — 먼저 발밑으로 끌어 모은다
      for (var nt = 0; nt < novaTimes; nt++) {
        fx.push({ t: 'ring', x: p.x, y: p.y, life: 0.55,
          el: sk.el || null, color: sk.el ? elemColorOf(sk.el) : null });
        for (j = 0; j < room.enemies.length; j++) {
          var ne = room.enemies[j];
          if (ne.hp <= 0) { continue; }
          if (dist(p, ne) <= nr + ne.r) {
            strike(ne, v * skillMul(), sk.kb || 0, sk.el || 'phys');
          }
        }
      }

    } else if (sk.shape === 'bolt') {
      /* §5.1 무예 축 — 연사(boltShotAdd): 발수가 는다 */
      var bdx = p.dirX || p.facing, bdy = p.dirY || 0;
      var bl = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
      var shots = (sk.shots || 1) + boonVal('boltShotAdd');
      for (j = 0; j < shots; j++) {
        /* 여럿이면 부챗살로 퍼진다 (연사) */
        var ang = Math.atan2(bdy / bl, bdx / bl) +
                  (shots > 1 ? (j - (shots - 1) / 2) * (sk.spread || 0.3) : 0);
        run.shots.push({
          x: p.x, y: p.y - 8, dx: Math.cos(ang), dy: Math.sin(ang),
          spd: 330, life: 1.5, hit: {},
          mul: v * skillMul(), el: sk.el || 'phys', color: elemColorOf(sk.el)
        });
      }

    } else if (sk.shape === 'dash') {
      /* §5.1 무예 축 — 신법 가속(dashInvulnAdd): 무적 시간이 는다 */
      var ddx = p.dirX || p.facing, ddy = p.dirY || 0;
      var dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      p.dash = { t: 0.2 * (sk.far || 1), dx: ddx / dl, dy: ddy / dl, hit: {},
                 mul: v * skillMul(), el: sk.el || 'phys' };
      p.invuln = 0.34 * (sk.far || 1) + boonVal('dashInvulnAdd');

    } else if (sk.shape === 'buff') {
      /* §5.1 무예 축 — 기세 지속(buffDurPct) */
      var buffSec = (sk.sec || 6) * (1 + boonVal('buffDurPct') / 100);
      addBuff(sk.eff, v, buffSec);
      if (sk.eff === 'atkSpdPct') { p.rallyUntil = Date.now() + buffSec * 1000; }
      fx.push({ t: 'ring', x: p.x, y: p.y, life: 0.55 });

    } else if (sk.shape === 'heal') {
      /* §5.1 무예 축 — 치유 증폭(healBonusPct) */
      var healAmt = run.hpMax * v / 100 * (1 + boonVal('healBonusPct') / 100);
      healBy(healAmt);
      fx.push({ t: 'get', x: p.x, y: p.y, text: '+' + Math.round(healAmt),
                color: '#6ea24a', life: 0.9 });

    } else if (sk.shape === 'curse') {
      /* §5.1 무예 축 — 저주 지속(curseDurPct) */
      var cr = sk.r || 130, curseSec = (sk.sec || 5) * (1 + boonVal('curseDurPct') / 100);
      if (sk.pull) { pullIn(sk.pull, null); }    // §5.19 2차 — 끌어 모아 묶는다(느려짐이 무리를 붙잡아 둔다)
      for (j = 0; j < room.enemies.length; j++) {
        var ce = room.enemies[j];
        if (ce.hp <= 0 || dist(p, ce) > cr + ce.r) { continue; }
        ce.slow = Math.max(ce.slow || 0, curseSec);
        ce.slowMul = 0.35;
        ce.hex = { v: v, t: curseSec };               // 받는 피해가 늘어난다
      }
      fx.push({ t: 'ring', x: p.x, y: p.y, life: 0.55 });

    } else if (sk.shape === 'summon') {
      /* §5.1 무예 축 — 분신 증원(summonCountAdd) */
      summon(Math.round(v) + boonVal('summonCountAdd'), sk.sec || 12, sk.str || 1, !!sk.big);

    } else if (sk.shape === 'chain') {
      /* 연환(連環) — 가장 가까운 적을 치고, 아직 안 맞은 적 중 가장 가까운
       * 쪽으로 튀어 또 친다(최대 sk.hops 번). bolt(똑바로 날아간다)·
       * nova(제자리서 터진다)와 달리 **적을 좇아 옮겨 다닌다** — 표적이
       * 흩어져 있을 때 값어치가 는다. 한 번 튈 때마다 12%씩 약해진다.
       * 새 fx 종류를 안 만든다 — nova 가 쓰는 'ring' 을 맞는 자리마다 찍는다. */
      /* §5.1 무예 축 — 연환 확장(chainHopsAdd) */
      var hops = (sk.hops || 3) + boonVal('chainHopsAdd'), chainR = sk.r || 260, hit = [], cur = null, bd = 1e9, ci;
      for (j = 0; j < room.enemies.length; j++) {
        ci = room.enemies[j];
        if (ci.hp <= 0) { continue; }
        var d0 = dist(p, ci);
        if (d0 < bd) { bd = d0; cur = ci; }
      }
      for (j = 0; cur && j < hops; j++) {
        strike(cur, v * skillMul() * (1 - j * 0.12), sk.kb || 0, sk.el || 'phys');
        fx.push({ t: 'ring', x: cur.x, y: cur.y, life: 0.35,
          el: sk.el || null, color: sk.el ? elemColorOf(sk.el) : null });
        hit.push(cur);
        var next = null, nd = chainR, ck;
        for (ck = 0; ck < room.enemies.length; ck++) {
          var cand = room.enemies[ck];
          if (cand.hp <= 0 || hit.indexOf(cand) >= 0) { continue; }
          var d1 = dist(cur, cand);
          if (d1 <= nd) { nd = d1; next = cand; }
        }
        cur = next;
      }
    }
  }

  function elemColorOf(el) {
    var ED = global.DG.elemData;
    return el && ED ? ED.elemColor(el) : 'rgba(120,220,255,0.9)';
  }

  /* ── 분신(分身) — 원작의 소환 ───────────────────────────────
   * 방사(方士)의 나무가 세운다. 적을 쫓아가 대신 때리고, 때가 되면 흩어진다.
   * **적이 분신을 때리지는 않는다** — 적의 표적을 나누는 규칙까지 넣으면
   * 이 판의 전투가 통째로 달라진다. 원작의 소환수 감각 중 "대신 때린다" 만 옮겼다.
   */
  function summon(n, sec, strMul, big) {
    if (!run) { return; }
    if (!run.minions) { run.minions = []; }
    for (var i = 0; i < n; i++) {
      run.minions.push({
        x: run.player.x + (Math.random() - 0.5) * 40,
        y: run.player.y + (Math.random() - 0.5) * 30,
        t: sec, cd: 0.5 + Math.random() * 0.4,
        mul: 0.5 * strMul, big: !!big, phase: Math.random() * 6.28
      });
    }
    fx.push({ t: 'ring', x: run.player.x, y: run.player.y, life: 0.5 });
  }

  /* ── 동행(同行) — 부대 2번째 인물이 곁에서 같이 싸운다 ──────────
   * PLAN §51(2026-09-06, 사용자 요청 "동료도 따라다니면서 같이 싸우던지
   * 용병처럼"). `atkOf()`(부대 전원의 합산 공격력, hero.js `partyPower()`)는
   * 이미 2번째 인물의 몫까지 안에 들어 있다 — 그래서 이 동행은 **그 값을
   * 다시 쓰지 않고** `hero.power(id)`(개인 전투력, 부대 합산과 별도 식)로
   * 자기 몫을 새로 매겨 **덤으로** 때린다. 위 `summon()`의 분신(나무)과
   * 같은 결이다 — 적이 동행을 때리지 않는다(체력·죽음·부활을 새로
   * 만들지 않는 선택, 분신과 같은 이유).
   */
  function companionHeroId() {
    var p = core.save.party;
    return (p && p.length > 1) ? p[1] : null;
  }

  function spawnCompanion() {
    var id = companionHeroId();
    if (!id) { return null; }
    return {
      id: id, x: WALL + 70, y: ROOM_H * 0.5 + 34,
      phase: 0, walking: false, facing: 1,
      atkCd: 0, atkAnim: 0, dirX: 0, dirY: 1
    };
  }

  /** 동행의 때림 배율 — 선두 개인 전투력 대비 제 몫(0.2~1.5배)에
   *  "덤"이라는 뜻으로 0.55를 곱한다. 선두보다 약해도 최소한의 몫은,
   *  세게 키워도 선두를 넘어서지는(1.5배 상한) 못하게 눌렀다. */
  /* ── 동행 서명(§5.17) ─────────────────────────────────────
   * 동행도 제 서명 무예(`heroSkillData.sigOf(동행 id)`)를 스스로 쓴다 — 곁에 적이 셋 이상
   * 몰렸거나 보스·정예가 닿으면. 모양은 동행 자리를 가운데 둔 파동 하나로 통일한다
   * (선두의 applyShapeSkill 은 선두 자리·선두 축복을 보므로 빌리지 않는다). 원소·이름·위력은 제 것.
   * 선두가 서명을 지른 뒤 1.5초 안이면 적 하나만 닿아도 곧장 나가고 **합격**(×1.5).
   * 판정에 Math.random 을 안 쓴다(맞히는 strike 는 동행 평타와 같은 길). 손잡이 `dungeon.allySig`. */
  var ALLY_SIG_FIRST = 4, ALLY_SIG_CD_MUL = 1.5, ALLY_SIG_CD_MIN = 8, ALLY_SIG_R = 120,
    ALLY_SIG_CROWD = 3, ALLY_COMBO_WIN = 1.5, ALLY_COMBO_MUL = 1.5;
  function allySigOn() { return !core.tuned || core.tuned('dungeon.allySig', 1) ? true : false; }

  /** 지금 쓸 까닭이 있나 — 순수. combo 면 적 하나만 닿아도 된다 */
  function allySigWants(c, enemies, combo) {
    if (!c || !allySigOn()) { return false; }
    var n = 0, strong = false, i, e;
    for (i = 0; i < (enemies || []).length; i++) {
      e = enemies[i];
      if (!e || e.hp <= 0) { continue; }
      if (Math.hypot(e.x - c.x, e.y - c.y) > ALLY_SIG_R + (e.r || 0)) { continue; }
      n++;
      if (e.boss || e.elite) { strong = true; }
    }
    return n > 0 && (combo || strong || n >= ALLY_SIG_CROWD);
  }

  function castAllySig(c, sk, combo) {
    var room = run.room, mul = (sk.v || 1) * companionMul() * (combo ? ALLY_COMBO_MUL : 1), hit = 0, i;
    var R = ALLY_SIG_R, kb = Math.min(30, sk.kb === undefined ? 20 : sk.kb);
    c.sigCd = Math.max(ALLY_SIG_CD_MIN, (sk.cd || 12) * ALLY_SIG_CD_MUL);
    c.atkAnim = 0.35;
    fx.push({ t: 'whirl', x: c.x, y: c.y, r: R, life: 0.35, el: sk.el || null, color: sk.el ? elemColorOf(sk.el) : null });
    for (i = 0; i < room.enemies.length; i++) {
      var e = room.enemies[i];
      if (e.hp <= 0 || dist(c, e) > R + e.r) { continue; }
      strike(e, mul, kb, sk.el || 'phys');
      hit++;
      if (!run) { return hit; }
    }
    run.allySigs = (run.allySigs || 0) + 1;
    if (combo) {
      run.comboT = 0;
      run.allyCombos = (run.allyCombos || 0) + 1;
      var ref = global.DG.data && global.DG.data.find(c.id);
      core.emit('toast', '⚡ 합격! ' + (ref ? ref.name + ' · ' : '') + (sk.emoji || '') + ' ' + sk.name);
    }
    core.emit('dungeon:skill', 'ally:' + c.id + (combo ? ':combo' : ''));
    return hit;
  }

  function stepAllySig(c, dt) {
    if (c.sigCd === undefined) { c.sigCd = ALLY_SIG_FIRST; }
    c.sigCd -= dt;
    if (run.comboT > 0) { run.comboT -= dt; }
    if (c.sigCd > 0 || run.choice) { return; }
    var HS = global.DG.heroSkillData, sk = HS && HS.sigOf(c.id);
    if (!sk) { return; }
    var combo = run.comboT > 0;
    if (!allySigWants(c, run.room.enemies, combo)) { return; }
    castAllySig(c, sk, combo);
  }

  function companionMul() {
    var HR = global.DG.hero;
    var id = run.companion && run.companion.id;
    if (!id || !HR) { return 0; }
    var cp = HR.power(id), lp = HR.power(leadId()) || 1;
    return core.clamp(cp / lp, 0.2, 1.5) * 0.55;
  }

  function updateCompanion(dt) {
    if (!run || !run.companion) { return; }
    var c = run.companion, room = run.room, p = run.player, i;
    c.phase += dt * 7;
    if (c.atkAnim > 0) { c.atkAnim -= dt; }
    c.atkCd -= dt;
    stepAllySig(c, dt);
    if (!run) { return; }

    var best = null, bd = 1e9;
    for (i = 0; i < room.enemies.length; i++) {
      var en = room.enemies[i];
      if (en.hp <= 0) { continue; }
      var dd = dist(c, en);
      if (dd < bd) { bd = dd; best = en; }
    }
    var reach = 34;
    if (best && bd - best.r <= reach) {
      var d0 = bd || 1;
      c.dirX = (best.x - c.x) / d0; c.dirY = (best.y - c.y) / d0;
      c.facing = c.dirX >= 0 ? 1 : -1;
      c.walking = false;
      if (c.atkCd <= 0) {
        c.atkCd = atkCdOf() * 1.25;             // 동행은 선두보다 살짝 느리다(덤이라)
        c.atkAnim = 0.22;
        strike(best, companionMul(), 5, 'phys');
        if (!run) { return; }
      }
      return;
    }

    /* 적이 없거나 사거리 밖 — 그 적에게(있으면), 없으면 선두 곁으로 붙는다 */
    var goal = best || p;
    var followR = best ? Math.max(20, best.r + reach - 6) : 46;
    var gd = dist(c, goal);
    if (gd > followR) {
      var d1 = gd || 1, spd = 150;
      c.dirX = (goal.x - c.x) / d1; c.dirY = (goal.y - c.y) / d1;
      c.facing = c.dirX >= 0 ? 1 : -1;
      c.walking = true;
      c.x = core.clamp(c.x + c.dirX * spd * dt, WALL + P_R, ROOM_W - WALL - P_R);
      c.y = core.clamp(c.y + c.dirY * spd * dt, WALL + P_R, ROOM_H - WALL - P_R);
    } else {
      c.walking = false;
    }
  }

  function updateMinions(dt) {
    if (!run || !run.minions || !run.minions.length) { return; }
    var room = run.room, i, j;
    for (i = run.minions.length - 1; i >= 0; i--) {
      var mn = run.minions[i];
      mn.t -= dt;
      if (mn.t <= 0) { run.minions.splice(i, 1); continue; }
      mn.phase += dt * 6;
      /* 가장 가까운 적을 쫓는다 */
      var best = null, bd = 1e9;
      for (j = 0; j < room.enemies.length; j++) {
        var en2 = room.enemies[j];
        if (en2.hp <= 0) { continue; }
        var dd = dist(mn, en2);
        if (dd < bd) { bd = dd; best = en2; }
      }
      if (!best) {
        /* 적이 없으면 주인 곁으로 */
        var pd = dist(mn, run.player) || 1;
        if (pd > 40) {
          mn.x += (run.player.x - mn.x) / pd * 90 * dt;
          mn.y += (run.player.y - mn.y) / pd * 90 * dt;
        }
        continue;
      }
      if (bd > best.r + 14) {
        mn.x += (best.x - mn.x) / bd * (mn.big ? 70 : 110) * dt;
        mn.y += (best.y - mn.y) / bd * (mn.big ? 70 : 110) * dt;
      } else {
        mn.cd -= dt;
        if (mn.cd <= 0) {
          mn.cd = mn.big ? 1.1 : 0.7;
          strike(best, mn.mul, 4, 'phys');
          if (!run) { return; }
        }
      }
    }
  }

  /* ── 화면이 읽어 가는 것 ──────────────────────────────── */

  function status() {
    if (!run) {
      var d = dstate();
      return { active: false, best: d.best || 0, runs: d.runs || 0, kills: d.kills || 0, deaths: d.deaths || 0,
                grave: d.grave || null, horde: d.horde || { best: 0, runs: 0 }, nmBest: d.nmBest || 0 };
    }
    /* 네 칸 — 선두가 걸어 둔 무예. 빈 칸도 그대로 넘긴다(화면이 흐리게 그린다) */
    var skills = [], got = slotSkills();
    for (var i = 0; i < got.length; i++) {
      var cd = Math.max(0, run.player.cds[i]);
      if (!got[i]) {
        skills.push({ key: null, name: '비었다', emoji: '·', desc: '무예를 걸어 두세요',
                      cost: 0, cd: 0, cdMax: 1, ready: false, empty: true });
        continue;
      }
      var sk = got[i].sk, smod = secretMod(sk), scost = Math.round(sk.cost * smod.cost);
      var sdef = smod.key && global.DG.secret ? global.DG.secret.byKey(smod.key) : null;
      skills.push({
        key: sk.key, name: sk.name, emoji: sk.emoji, desc: sk.desc,
        rank: got[i].rank, secret: smod.key, secretEmoji: sdef ? sdef.emoji : '', secretBoost: smod.boost || 1,
        cost: scost, cd: cd, cdMax: sk.cd * smod.cd,
        ready: cd <= 0 && run.mp >= scost
      });
    }
    return {
      active: true, floor: run.floor, theme: DD.themeOf(run.floor),
      hp: Math.max(0, Math.round(run.hp)), hpMax: run.hpMax,
      mp: Math.max(0, Math.round(run.mp)), mpMax: run.mpMax,
      skills: skills, rally: rallyOn(),
      room: run.room.index + 1, roomTotal: run.roomTotal,
      cleared: run.room.cleared, kind: run.room.kind,
      /* 명소 층(§5.15) — 있으면 HUD 가 테마 이름 대신 명소 이름·방 이름을 쓴다 */
      fixed: run.fixed ? { key: run.fixed.key, name: run.fixed.name, emoji: run.fixed.emoji, title: run.room.title || '' } : null,
      loot: { gold: Math.round(run.loot.gold), items: run.loot.items.length },
      boons: run.boons, choice: run.choice, merchantChoice: run.merchantChoice,
      graveChoice: run.graveChoice,
      /* 난입(§5.5) — 회차 중일 때만 채운다. 화면은 이 필드가 있으면 HUD를
         일반 층 표시 대신 타이머·파도로 바꿔 그린다. */
      horde: run.horde ? {
        t: Math.round(run.hordeT), remain: Math.max(0, HORDE_DURATION - run.hordeT),
        wave: run.hordeWave, level: run.hordeLevel, enemies: run.room.enemies.length
      } : null,
      /* 부적 던전(§5.3) — 회차 중일 때만 채운다. mods 는 키 배열 그대로
         내준다(화면이 DD.modByKey 로 이름·이모지를 붙인다). */
      nightmare: run.nightmare ? {
        tier: run.nightmare.tier, mods: run.nightmare.mods,
        resistElem: run.nightmare.resistElem,
        roomT: nmHasMod('timer') ? Math.max(0, run.nightmare.roomT) : null
      } : null,
      /* 시련(§5.11) — 있으면 화면이 HUD 를 단계·시계·진척 막대로 바꾼다 */
      trial: run.trial ? {
        lv: run.trial.lv, t: Math.max(0, run.trial.t), sec: TRIAL_SEC,
        prog: run.trial.prog, goal: TRIAL_GOAL, guardian: run.trial.guardian, deaths: run.trial.deaths
      } : null,
      boonPicks: run.boonPicks || 0, boonMax: BOON_MAX_STACK,
      kills: run.kills, best: dstate().best || 0,
      atk: Math.round(atkOf()), reach: Math.round(reachOf()),
      /* 강공격·회피(2026-09-10) — 스킬과 같은 자리(cd/cdMax)로 내준다.
         화면이 버튼 위에 쿨다운 링을 그릴 때 스킬바와 같은 계산을 쓸 수 있게. */
      heavy: { cd: Math.max(0, run.player.heavyCd), cdMax: HEAVY_CD },
      dodgeAct: { cd: Math.max(0, run.player.dodgeCd), cdMax: DODGE_CD },
      /* 투장 무예 — 없으면(세 점을 안 갖췄으면) avail:false 만 내려 화면이
         비활성으로 그리게 한다(위 heavy/dodgeAct와 같은 cd/cdMax 자리). */
      setSkill: (function () {
        var got = activeSetSkill();
        if (!got) { return { avail: false, cd: 0, cdMax: 1 }; }
        return { avail: true, name: got.sk.name, emoji: got.sk.emoji, desc: got.sk.desc,
                 setName: got.set.name,
                 cd: Math.max(0, run.player.setSkCd), cdMax: got.sk.cd };
      })(),
      /* 서명 무예(2026-09-11) — 위 setSkill과 같은 자리(avail/cd/cdMax) */
      sigSkill: (function () {
        var sk = activeSigSkill();
        if (!sk) { return { avail: false, cd: 0, cdMax: 1 }; }
        return { avail: true, name: sk.name, emoji: sk.emoji, desc: sk.desc,
                 cd: Math.max(0, run.player.sigSkCd), cdMax: sk.cd };
      })(),
      combo: run.combo || 0
    };
  }

  global.DG = global.DG || {};
  global.DG.dungeon = {
    NM_DARK_R: NM_DARK_R, darkSight: darkSight,
    ELITES: ELITES, eliteOf: eliteOf, eliteChance: eliteChance, enemyName: enemyName,
    MODES: MODES, modeOf: modeOf, modesOpen: modesOpen, mode: mode, setMode: setMode, enemyHp: enemyHp, enemyDmg: enemyDmg,
    resistOf: resistOf, RESIST_CAP: RESIST_CAP,
    slotSkills: slotSkills,
    WAYPOINT_EVERY: WAYPOINT_EVERY, waypoint: waypoint, markWaypoint: markWaypoint,
    hardcore: hardcore, setHardcore: setHardcore, fallen: fallen, vowMilestone: vowMilestone, VOW_GOLD: VOW_GOLD,
    elemDmgOf: elemDmgOf, elemResOf: elemResOf,
    /** 자가진단용 — 한 대만 때려 본다 (저항이 결마다 다르게 깎는지) */
    _strike: strike, _addPacks: addPacks, _cleave: cleave, _applyShape: applyShapeSkill, _pullStep: pullStep,
    /** 자가진단용 — 한 대 맞아 본다 (갑주의 원소 저항이 실제로 깎는지) */
    _hurt: hurtPlayer,
    /** 자가진단용 — 적 하나를 만들어만 본다 */
    _spawnEnemy: spawnEnemy,
    /** 자가진단용 — 재료를 한 번 굴려 본다 (주옥이 얼마나 드문지는 굴려 봐야 안다) */
    _dropMat: dropMat,
    /** 자가진단용 — 동행(부대 2번째 인물)의 때림 배율을 그대로 읽는다 */
    _companionMul: companionMul,
    _allySigWants: allySigWants,
    _guardZones: guardZones, _stepGuardSig: stepGuardSig,
    ROOM_W: ROOM_W, ROOM_H: ROOM_H, WALL: WALL, P_R: P_R,
    SKILL_SLOTS: SKILL_SLOTS,
    /** 던전 밖(마을 등)이 같은 필드 메커니즘을 빌려 쓸 때 쓰는 자리 —
     *  각 함수의 ctx 인자는 그 함수 정의 옆 주석을 볼 것 (사가나락 마을 필드전투). */
    FIELD_ENEMY_CAP: FIELD_ENEMY_CAP, FIELD_CAP: FIELD_CAP, PACK_N: PACK_N,
    fieldOn: fieldOn, fieldRadiusUnits: fieldRadiusUnits,
    fieldBoundPlayer: boundPlayer, _corridorReach: corridorReach,
    /** 자가진단 전용(§5.12) — town.js safePoint 가 이 이름을 찾으면 옛 로컬 좌표로 돌기 시작해서 이름을 갈랐다 */
    _fieldBlockedAt: fieldBlockedAt,
    _corridorExtra: corridorExtra, _doorCorridorUnits: doorCorridorUnits,
    spawnFieldRoamers: spawnFieldEncounters,
    spawnFieldTreasure: spawnFieldTreasure,
    spawnFieldMerchant: spawnFieldMerchant,
    fieldRoamerCount: fieldEnemyCount,
    stepFieldCombat: stepFieldCombat,
    /** 지역 우두머리(§5.13) — town.update 가 부른다. now 는 자가진단이 시각을 붙들 때만 */
    stepRegionBoss: stepRegionBoss, regionBossState: function () { return rbState(); },
    RB_NEAR: RB_NEAR, RB_CD_MS: RB_CD_MS,
    _grantRegionBossReward: grantRegionBossReward, _pickEnemyRef: pickEnemyRef, _eraAltPoolFor: eraAltPoolFor,
    /** 명소 층(§5.15) */
    fixedFor: fixedFor, fixedState: function () { return fixedState(); },
    _makeFixedRoom: makeFixedRoom, _fixedDoors: fixedDoors, _grantFixedReward: grantFixedReward,
    pickupField: pickupField,
    active: active, enter: enter, leave: leave, update: update,
    setInput: setInput, moveTo: moveTo,
    pickBoon: pickBoon, rejectBoon: rejectBoon, goRoom: goRoom,
    /** 자가진단용(§5.1) — 축복 3택을 직접 굴려 본다(층 게이팅과 무관하게) */
    _rollBoonChoice: rollBoonChoice,
    /** 자가진단 전용(§5.1) — 원소 배합을 강제한다(null이면 해제) */
    _forceElemDmg: function (v) { forcedElemDmg = v; },
    _forceCrit: function (v) { forcedCrit = v; },
    buyMerchant: buyMerchant, leaveMerchant: leaveMerchant,
    /** 유품(§5.2) — openGrave 는 자가진단용으로도 쓴다(표식을 안 밟고 바로 열어 봄) */
    graveOf: graveOf, openGrave: openGrave,
    toggleGraveItem: toggleGraveItem, claimGrave: claimGrave, GRAVE_ITEM_MAX: GRAVE_ITEM_MAX,
    /** 난입(§5.5) — `enter({horde:true})` 그대로도 되지만 화면 코드가 매번
     *  옵션 객체를 쓰지 않게 이름을 하나 내준다. */
    enterHorde: function () { return enter({ horde: true }); },
    HORDE_WAVE_INTERVAL: HORDE_WAVE_INTERVAL, HORDE_ENEMY_CAP: HORDE_ENEMY_CAP,
    HORDE_DURATION: HORDE_DURATION,
    /** 자가진단용 — 파도를 직접 굴려 본다(30초를 안 기다리고) */
    _spawnHordeWave: spawnHordeWave,
    /** 부적 던전(§5.3) — `enter({sigilId})` 그대로도 되지만 이름을 하나
     *  내준다(위 enterHorde와 같은 이유). */
    enterNightmare: function (sigilId) { return enter({ sigilId: sigilId }); },
    /** 시련(§5.11) — 단계 lv 로 들어간다(열린 단계까지만) */
    enterTrial: function (lv) { return enter({ trial: lv }); },
    /** 시련 기록 — 굴혈 선택 카드·순위표가 읽는다 */
    trialInfo: function () {
      var ts = trialState();
      return { ready: trialReady(), need: TRIAL_NEED, best: ts.best, open: ts.open, runs: ts.runs,
               board: ts.board.slice(), sec: TRIAL_SEC, goal: TRIAL_GOAL, max: TRIAL_MAX };
    },
    TRIAL_SEC: TRIAL_SEC, TRIAL_GOAL: TRIAL_GOAL, TRIAL_DEATH_SEC: TRIAL_DEATH_SEC,
    /** 자가진단 전용 — 처치 하나를 시련 진척에 흘린다(kill 의 드롭·경험은 안 탄다) */
    _trialOnKill: function (e) { if (run && run.trial) { trialOnKill(e); } },
    _trialPts: trialPts,
    NM_ROOM_TOTAL: NM_ROOM_TOTAL, NM_ROOM_TIMER: NM_ROOM_TIMER,
    /** 자가진단 전용 — 지금 회차의 변형자 판정을 직접 읽는다 */
    _nmHasMod: nmHasMod, _nmMul: nmMul, _nmLootMul: nmLootMul,
    /** 마을 들판 방랑 상인(PLAN §60 후보 1) — town.js/ui.js가 독자 재고
     *  상태를 굴릴 때 쓴다. `run.merchantChoice`와는 별개다. */
    rollMerchantStock: rollMerchantStock,
    castSkill: castSkill, _secretMod: secretMod, refill: refill,
    heavyAttack: heavyAttack, doDodge: doDodge, castSetSkill: castSetSkill,
    castSigSkill: castSigSkill,
    boonVal: boonVal, boonEffect: boonEffect,
    status: status, state: dstate,
    /** 화면 전용 — 상태를 직접 읽는다 (쓰지는 말 것) */
    raw: function () { return run; },
    fx: function () { return fx; },
    moveTarget: function () { return target; },
    /** 월드 보스(§5.4) — town.js update() 가 매 틱 부른다. */
    stepWorldBoss: stepWorldBoss, wbNow: wbNow,
    WB_SLOT_MS: WB_SLOT_MS, WB_NOTICE_MS: WB_NOTICE_MS, WB_FIGHT_MS: WB_FIGHT_MS,
    worldBossIn: function (room) { return wbFindBoss(room); },
    /** 진단 전용 — 스케줄링을 시간 없이 순수 함수로 재현한다 */
    _wbPickTown: wbPickTown, _wbPickBossRef: wbPickBossRef, _wbPickPos: wbPickPos,
    _wbSpawn: wbSpawn, _wbCheckParts: wbCheckParts, _wbFlee: wbFlee,
    _grantWorldBossReward: grantWorldBossReward,
    /** 진단 전용 — 보스 패턴 하나를 직접 굴려 본다(무기 부위 봉인 확인용) */
    _bossPattern: bossPattern,
    /** 진단 전용(§9, "Date.now 를 고정") — 사가만리 weather.force() 와 같은 결 */
    _forceNow: function (v) { forcedNow = v; }
  };
})(window);
