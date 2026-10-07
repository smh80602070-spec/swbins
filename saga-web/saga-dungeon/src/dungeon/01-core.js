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

