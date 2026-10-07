/**
 * 도적전(賊徒戰) — 사가나락식 실시간 위치 전투
 * ---------------------------------------------------------------
 * 원래는 `rogue.js`(적도) 전용으로 짰지만 도적 특정 로직이 없는 범용 엔진이라
 * `duel.js`(속공·필살·회피 세 버튼 카드)와 완전히 같은 `open(o)`/`onDone` 모양을
 * 그대로 받는다 — `event.js`(야생 조우)·`fort.js`(성채·토벌)도 이제
 * `global.DG.rogueAction || global.DG.duel` 드롭인으로 이 엔진을 먼저 쓴다
 * (2026-09-06, 스태거·패턴3종·연타·차지를 그 세 곳에도 옮김). 스크립트 하나가
 * 빠지면 옛 `duel.js` 카드로 조용히 되돌아간다. 화면을 안 막고, 지도 위를
 * 실제로 움직이며 사거리 안에 들어가면 자동으로 때린다(사가나락 `dungeon.js`의 결).
 *
 *   자동 공격   사거리 안 + 쿨 끝나면 저절로 나간다(`duel.js`의 속공 수치 그대로)
 *   필살        기(氣)가 차면 버튼 하나로(사거리 안 봄 — 원작 필살과 같다)
 *   강타 회피   버튼이 아니라 **원 밖으로 실제로 벗어나야** 안 맞는다
 *               (사가나락 보스 강타 `dungeon.js SLAM_RANGE`와 같은 결)
 *
 * **판정 층(`create`·`tick`·`ult`·`flee`·`perf`·`fold`)은 순수 함수다.**
 * `duel.js`의 같은 이름 함수와 값 계산을 그대로 맞췄다 — 자가진단이 이것만
 * 직접 굴린다(화면 없이). 균형 상수(`QUICK_MUL`·`FOE_GAP`·`HEAVY_MUL`…)는
 * 새로 만들지 않고 `global.DG.duel`이 이미 뽑아 둔 것을 그대로 읽는다 —
 * 그래서 도적전 난도는 지금과 완전히 같다.
 *
 * `rogue.js`의 `fight(rg, {live:true, dealt, folded})`는 **어떻게 때렸는지 모른다**
 * — 최종 dealt 값만 본다. 그래서 이 파일은 `rogue.js`·`world3d.js`·`battle3d.js`
 * 어느 것도 고치지 않는다. `battle3d.js`가 듣는 `duel:open`·`duel:fx`·`duel:close`
 * 이벤트를 **같은 모양으로** 쏘기만 하면 카메라·알갱이·공격 애니메이션이 그대로
 * 따라온다. `world3d.duelStage()`가 세운 상대는 그 자리에 고정돼 있다(안 쫓아온다) —
 * 카메라(`camAim`)가 매 프레임 내 위치를 다시 읽어 둘을 옆에서 잡아 주므로
 * 움직여도 구도는 따라간다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  function D() { return global.DG.duel; }

  /** 내 사거리(m) — 이 안이면 자동으로 때린다 */
  function MY_REACH() { return core.tuned('rogueAction.reach', 3.0); }
  /** 적의 평타 사거리 — 이보다 멀면 적 평타가 그냥 빗나간다(안 맞는다) */
  function FOE_REACH() { return core.tuned('rogueAction.foeReach', 3.2); }
  /** 강타 반경 — 예고가 풀리는 순간 이 안에 있으면 맞는다, 밖이면 완전히 안 맞는다 */
  function HEAVY_RANGE() { return core.tuned('rogueAction.heavyRange', 5.5); }

  /* ── 실시간 위치 사냥식 손맛 셋 (2026-09-06, "전투를 더 잼나게") ──────
   *   스태거   맞을수록 차는 게이지. 다 차면 적이 잠깐 기절한다 —
   *            공격을 못 하고, 그동안 내 피해가 늘어난다(MH의 "부위 파괴" 손맛)
   *   패턴     강타 하나뿐이던 적 큰 공격을 셋으로 늘린다 — 반경·예고 시간·
   *            피해가 저마다 달라 "이번엔 얼마나 물러서야 하나"가 매번 갈린다
   *   차지     시간이 지나면 저절로 차는 자원. 버튼으로 큰 한 방을 낸다
   *            (필살과 별개 — 필살은 때려야 차고, 차지는 가만있어도 찬다)
   */
  function STAGGER_SEC() { return core.tuned('rogueAction.staggerSec', 2.5); }
  function STAGGER_GAIN() { return core.tuned('rogueAction.staggerGain', 0.6); }   // 게이지 = 낸 피해 × 이 값
  function STAGGER_BONUS() { return core.tuned('rogueAction.staggerBonus', 1.5); } // 기절 중 피해 배수
  function POISE_DECAY() { return core.tuned('rogueAction.poiseDecay', 6); }       // 손 놓으면 초당 이만큼 식는다
  function COMBO_N() { return core.tuned('rogueAction.comboN', 5); }               // 몇 번째 연타마다 회심
  function COMBO_MUL() { return core.tuned('rogueAction.comboMul', 1.8); }
  function COMBO_GAP() { return core.tuned('rogueAction.comboGap', 1.4); }         // 이보다 오래 안 때리면 연타가 끊긴다
  function CHARGE_MAX() { return core.tuned('rogueAction.chargeSec', 5); }         // 이만큼 있으면 다 찬다
  function CHARGE_MUL() { return core.tuned('rogueAction.chargeAtkMul', 0.35); }   // 차지 피해 = 공격력 × 이 값

  /* ── 원거리 견제기 (2026-09-06, "실시간 전투는 조금 멀리서 스킬도 쓰고
   * 해야 멋지지") ────────────────────────────────────────────
   * 속공·차지는 사거리 안이어야 닿는다 — 다가가기 전에는 그냥 서서 예고만
   * 기다리는 시간이 있었다. 이건 **거리를 안 본다**(필살과 같은 결이지만
   * 쿨다운으로 반복 쓴다) — 멀리서 견제하다 다가가는 그림을 만든다.
   * 2026-09-07: 0.16 → 0.42로 올렸다 — 옛 값은 쿨다운(3.5초)까지 곱하면
   * 제한시간(60초) 안에 원거리만으로 낼 수 있는 총 피해가 myAtk×2.74에
   * 불과했는데, `rogue.js`가 애초에 받아 주는 교전의 상한(`pw.atk*7 <
   * rg.hp`면 거부 — 두목(2등급) 기세가 이 상한에 자주 걸린다)이
   * myAtk×7이라 흔한 상대조차 시간 안에 못 끝냈다(지난 세션이 실전에서
   * 직접 겪음 — 절반도 못 깎고 물러남). 0.42면 60초 안에 최대치
   * myAtk×7.14를 내 상한 상대까지 겨우 커버한다. 속공(쿨다운 0.35초,
   * 연타 보정 포함 60초에 myAtk×20 안팎)에 비하면 여전히 훨씬 느려
   * "다가가서 때리라"는 의도는 그대로 남는다 — 순수 배수 계산일 뿐이니
   * 사람이 직접 원거리만으로 걸어 보고 `_admin.html`의
   * `rogueAction.rangedAtkMul`로 더 조정할 것. */
  function RANGED_CD() { return core.tuned('rogueAction.rangedCd', 3.5); }
  function RANGED_MUL() { return core.tuned('rogueAction.rangedAtkMul', 0.42); }

  /* ── 토벌 전용(§10-Q2 "토벌만 적용") ─────────────────────
   * PLAN §5 ③. `o.raid` 를 준 `create()` 호출(=`fort.js`의 `startRaidDuel()`)
   * 에서만 켜진다 — 야생 조우·성채 수비대·적도는 옛 그대로(걸어서 완전히 피함) */
  /** 자동 전투가 예고를 보고 물러서기 시작하기까지의 반응 시간(초) — 사람보다 살짝 느리다 */
  function AUTO_REACT() { return core.tuned('rogueAction.autoReact', 0.3); }
  function JUST_WINDOW() { return core.tuned('rogueAction.justWindow', 0.25); }     // 저스트 회피 창(초)
  function WALK_DODGE_MUL() { return core.tuned('rogueAction.walkDodgeMul', 0.5); } // 걷기만으로 피하면 남는 피해 비율
  function JUST_KI_PCT() { return core.tuned('rogueAction.justKiPct', 30); }        // 저스트 성공 시 기 +30%
  var PART_N = 3;              // 부위(갑주·병장·기마) 수
  var PART_STEP = 0.25;        // 부위 하나 = 기세의 25% (3부위 = 누적 75%, 나머지 25%는 맨몸)

  /** 적의 큰 공격 사다리 — 예고가 풀리는 순간의 반경·배수가 저마다 다르다.
   *  **순서가 뜻이다**: `foeN`이 `FOE_HEAVY`의 배수가 될 때마다 다음 것으로
   *  넘어간다(무작위가 아니다 — 자가진단이 값으로 재현할 수 있어야 한다).
   *
   *  **회피 난이도 수식** (2026-09-06 세션이 처음 굴리고 2026-09-07이 값으로
   *  확정): 예고가 풀리는 순간 맞는지는 `d > range`(거리)뿐으로 갈린다.
   *  가장 어려운 경우(예고가 시작될 때 내 사거리 `MY_REACH()`=3.0m 안에
   *  붙어 있던 경우)를 기준으로, 걷기 속도(world.js `speed`=8m/s)로
   *  `tellSec` 동안 벌 수 있는 거리를 필요 거리(`range - 3.0`)로 나눈 값을
   *  "회피 난이도 비율"로 쓴다 — 1.0이면 예고가 풀리는 찰나까지 한 순간도
   *  안 쉬고 정확한 방향으로 뛰어야 겨우 벗어나는 값(반응 지연을 조금도
   *  못 버틴다), 클수록 여유가 늘어난다.
   *  2026-09-06: charge(1.6배 → 비율 1.14)만 이 수식대로 이미 타이트하게
   *  맞춰져 있었고 heavy·sweep(당시 1배·1.15배)은 비율 ≈3.5 — 가만히 서
   *  있다가 아무 방향으로나 한 걸음만 떼도 항상 피해지는 값이었다.
   *  2026-09-07 1차: heavy·sweep을 1.35·1.55(비율 ≈2.0·2.15)로 올려 "완전히
   *  공짜"인 상태만 없앴다(charge보다는 일부러 쉽게 남겨 둠).
   *  2026-09-07 2차(이번): charge와 같은 비율(≈1.14)까지 맞추려 했더니
   *  `_test.html`의 "적 큰 공격은 두 번째부터 다른 패턴으로 바뀐다"가
   *  걸렸다 — **"돌진(charge) 반경이 강타(heavy) 반경보다 커야 한다"**
   *  (`m1.range > m0.range`)는 자가진단이 직접 확인하는 의도된 순서였다
   *  (`tellSec`가 charge(0.825초)보다 훨씬 긴 heavy(1.1초)를 charge와
   *  똑같이 타이트하게 만들려면 range를 charge보다 더 올려야 하는데,
   *  그러면 이 순서가 뒤집힌다 — 반경만으로는 둘을 동시에 만족 못 한다).
   *  그래서 heavy는 **charge 반경(8.8m) 밑에서 갈 수 있는 만큼만**
   *  올렸다 — 1.35→**1.55**(비율 2.0→1.59, charge 8.8m보다 여전히 좁은
   *  8.525m). sweep은 이 제약이 없어(다른 자가진단이 순서를 안 본다)
   *  1.55→**2.45**(비율 2.15→1.13)까지 그대로 밀었다. 세 값 다 여전히
   *  사람이 걸으며 판단할 몫이다 — 너무 타이트하면 `_admin.html`의
   *  `rogueAction.heavyRange`(공통 배율)로 전체를 한 번에 낮출 수 있다. */
  function foeMoves() {
    var Dl = D();
    return [
      { key: 'heavy', label: '⚠️ 강타! 원 밖으로 물러서라', tellSec: Dl.TELL_SEC, range: HEAVY_RANGE() * 1.55, dmgMul: Dl.HEAVY_MUL },
      { key: 'charge', label: '⚠️ 돌진! 훨씬 멀리 물러서라', tellSec: Dl.TELL_SEC * 0.75, range: HEAVY_RANGE() * 1.6, dmgMul: Dl.HEAVY_MUL * 1.25 },
      { key: 'sweep', label: '⚠️ 휩쓸기! 넉넉히 물러서라', tellSec: Dl.TELL_SEC * 1.35, range: HEAVY_RANGE() * 2.45, dmgMul: Dl.HEAVY_MUL * 0.7 }
    ];
  }
  function moveByKey(key) {
    var ms = foeMoves();
    for (var i = 0; i < ms.length; i++) { if (ms[i].key === key) { return ms[i]; } }
    return ms[0];
  }

  /* ── 판정 층 ──────────────────────────────────────────── */

  /**
   * @param {{foeHp:number, myAtk:number, myDef:number, timeSec?:number}} o
   */
  function create(o) {
    var Dl = D();
    var hp = Math.max(1, Math.round(o.foeHp || 1));
    return {
      foeHp: hp, hp: hp,
      foeAtk: Math.max(1, Math.round(hp * 0.010)),
      myAtk: Math.max(1, Math.round(o.myAtk || 1)),
      morale: Math.max(200, Math.round((o.myDef || 0) * Dl.MORALE_MUL)),
      moraleMax: Math.max(200, Math.round((o.myDef || 0) * Dl.MORALE_MUL)),
      left: o.timeSec || Dl.TIME_SEC,
      timeSec: o.timeSec || Dl.TIME_SEC,
      ki: 0,
      kiMul: 1 + core.effect('kiPct') / 100,   // 인연 결(bond.js) — 만들 때 한 번 읽어 tick 을 순수하게 둔다
      cd: 0,
      foeT: Dl.FOE_GAP,
      foeN: 0,
      tell: 0,             // 0보다 크면 강타를 예고하는 중
      tellMove: 'heavy',   // 지금 예고 중인(또는 마지막) 큰 공격이 무엇인지
      poise: 0,             // 스태거 게이지 — 다 차면 기절
      poiseMax: Math.max(30, Math.round(hp * 0.35)),
      staggered: 0,         // 0보다 크면 기절 중(공격을 못 한다, 내 피해 ↑)
      staggerCount: 0,
      combo: 0,
      comboMax: 0,
      comboT: 0,            // 마지막 명중 이후 지난 시간
      charge: 0,            // 0..CHARGE_MAX, 다 차면 차지 일격을 쓸 수 있다
      chargeUsed: 0,
      rangedCd: 0,          // 0이면 원거리 견제기를 쓸 수 있다(사거리 안 봄)
      rangedUsed: 0,
      dealt: 0,
      hits: 0,
      ults: 0,
      dodgeTry: 0,          // duel.js와 성과 모양을 맞추려고 남겨 둔다(늘 0)
      dodgeOk: 0,
      taken: 0,
      acts: [],
      over: false,
      cleared: false,
      fled: false,
      /* 토벌 전용(§10-Q2) */
      raidMode: !!o.raid,
      justDodge: false,    // 저스트 창 안에서 회피 버튼을 눌렀으면 다음 강타 판정에서 한 번 쓰인다
      parts: 0,
      partsMax: PART_N
    };
  }

  function note(s, kind, dmg) {
    /* duel.js와 같은 이유로 60개 자르기(shift)를 없앴다 — fold()가 결과
     * 화면의 "합" 목록을 이 배열 하나로 접는데, 자르면 초반 타격이 사라져
     * 목록이 실제 전투와 어긋났다. */
    s.acts.push({ kind: kind, dmg: dmg, left: Math.max(0, s.hp) });
  }

  function finishIfDone(s) {
    if (s.hp <= 0) { s.over = true; s.cleared = true; }
  }

  /** 스태거 게이지를 채운다 — 다 차면 기절시키고 `ev`에 알린다(호출한 쪽이 담당) */
  function addPoise(s, dmg, ev) {
    if (s.staggered > 0) { return; }       // 이미 기절 중이면 또 채우지 않는다
    s.poise = Math.min(s.poiseMax, s.poise + dmg * STAGGER_GAIN());
    if (s.poise >= s.poiseMax) {
      s.poise = 0;
      s.staggered = STAGGER_SEC();
      s.staggerCount++;
      if (ev) { ev.push({ t: 'stagger' }); }
    }
  }

  /**
   * 부위 파괴(토벌 전용) — 자리를 따로 나누지 않고 **같은 기세 풀을 25%씩 읽는다**
   * (갑주→병장→기마 순, PLAN §5 ③). 새로 문턱을 넘을 때마다 `ev`에 `partbreak`를
   * 쌓고 그 자리에서 스태거를 강제로 채운다 — 부위가 깨지는 순간 자체가 빈틈이다.
   */
  function checkParts(s, ev) {
    if (!s.raidMode) { return; }
    var lost = 1 - Math.max(0, s.hp) / s.foeHp;
    var target = Math.min(s.partsMax, Math.floor(lost / PART_STEP + 1e-9));
    while (s.parts < target) {
      s.parts++;
      if (ev) { ev.push({ t: 'partbreak', part: s.parts }); }
      if (s.staggered <= 0) {
        s.poise = 0;
        s.staggered = STAGGER_SEC();
        s.staggerCount++;
        if (ev) { ev.push({ t: 'stagger' }); }
      }
    }
  }

  /**
   * 저스트 회피 버튼(토벌 전용) — 예고가 풀리기 `JUST_WINDOW()`초 전부터 눌러야
   * 통한다. 창 밖에서 누르면 그냥 무시된다(연타해도 손해가 없다).
   */
  function dodge(s) {
    if (!s || s.over) { return { ok: false, reason: 'over' }; }
    if (!s.raidMode) { return { ok: false, reason: 'notraid' }; }
    var just = s.tell > 0 && s.tell <= JUST_WINDOW();
    if (just) { s.justDodge = true; }
    return { ok: true, just: just };
  }

  /**
   * 한 틱 — 위치(dist)를 받는다는 것만 `duel.js`의 `step(s, dt)`와 다르다.
   * @param dist 나와 적 사이 거리(m). null/undefined 면 "닿을 수 없다"로 본다
   * @returns {Array} 이 사이에 벌어진 일 — 화면 층이 `duel:fx`로 옮겨 쏜다
   */
  function tick(s, dt, dist) {
    var ev = [];
    if (s.over) { return ev; }
    var Dl = D();
    var d = (dist === undefined || dist === null) ? 1e9 : dist;

    if (s.cd > 0) { s.cd = Math.max(0, s.cd - dt); }
    if (s.rangedCd > 0) { s.rangedCd = Math.max(0, s.rangedCd - dt); }
    s.left -= dt;
    s.comboT = (s.comboT || 0) + dt;
    s.charge = Math.min(CHARGE_MAX(), (s.charge || 0) + dt);   // 가만있어도 찬다(필살과 다르다)
    if (s.staggered > 0) { s.staggered = Math.max(0, s.staggered - dt); }
    else if (s.poise > 0 && s.comboT > COMBO_GAP()) { s.poise = Math.max(0, s.poise - POISE_DECAY() * dt); }

    /* 내 자동 공격 — 사거리 안 + 쿨 끝. 연타가 안 끊겼으면 다섯 번째마다 회심 */
    if (d <= MY_REACH() && s.cd <= 0) {
      s.combo = (s.comboT <= COMBO_GAP()) ? s.combo + 1 : 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      s.comboT = 0;
      var finisher = s.combo % COMBO_N() === 0;
      var mul = (finisher ? COMBO_MUL() : 1) * (s.staggered > 0 ? STAGGER_BONUS() : 1);
      var dmg = Math.round(s.myAtk * Dl.QUICK_MUL * (0.9 + Math.random() * 0.2) * mul);
      s.cd = Dl.QUICK_CD;
      s.ki = Math.min(Dl.KI_MAX, s.ki + Dl.QUICK_KI * (s.kiMul || 1));
      s.hp -= dmg;
      s.dealt += dmg;
      s.hits++;
      note(s, finisher ? 'combo' : 'quick', dmg);
      ev.push({ t: finisher ? 'combo' : 'quick', dmg: dmg, combo: s.combo });
      addPoise(s, dmg, ev);
      checkParts(s, ev);
      finishIfDone(s);
      if (s.over) { return ev; }
    }

    /* 강타류 예고가 끝나면 실제로 맞는지 — 버튼이 아니라 **거리로만** 가른다.
       어느 몸짓이었는지는 예고를 걸 때 `tellMove`에 적어 뒀다(패턴마다 반경·배수가 다르다) */
    if (s.tell > 0) {
      s.tell -= dt;
      if (s.tell <= 0) {
        s.tell = 0;
        var mv = moveByKey(s.tellMove);
        var walkedOut = d > mv.range;
        var full = Math.round(s.foeAtk * mv.dmgMul);
        var justOk = s.raidMode && s.justDodge;
        var heavy, dodged;
        if (justOk) {
          /* 저스트 회피(토벌 전용, §5 ③) — 완전히 피하고 기가 붙는다 */
          heavy = 0; dodged = true;
          s.ki = Math.min(Dl.KI_MAX, s.ki + Dl.KI_MAX * (JUST_KI_PCT() / 100) * (s.kiMul || 1));
        } else if (walkedOut) {
          /* §10-Q2: 토벌은 걷기만으론 절반만 샌다, 야생·성채는 옛 그대로 완전히 샌다 */
          heavy = s.raidMode ? Math.round(full * WALK_DODGE_MUL()) : 0;
          dodged = true;
        } else {
          heavy = full; dodged = false;
        }
        if (heavy > 0) { s.morale -= heavy; s.taken += heavy; }
        ev.push({ t: 'heavy', dmg: heavy, dodged: dodged, just: justOk, move: mv.key });
        s.foeT = Dl.FOE_GAP;
        s.justDodge = false;
      }
    } else if (s.staggered <= 0) {          // 기절 중엔 새 공격을 걸지 않는다 — 몰아칠 틈
      s.foeT -= dt;
      if (s.foeT <= 0) {
        s.foeN++;
        if (s.foeN % Dl.FOE_HEAVY === 0) {
          var fm = foeMoves();
          var move = fm[Math.floor(s.foeN / Dl.FOE_HEAVY - 1) % fm.length];
          s.tell = move.tellSec;
          s.tellMove = move.key;
          ev.push({ t: 'tell', move: move.key, label: move.label });
        } else if (d <= FOE_REACH()) {
          var hit = Math.round(s.foeAtk * (0.85 + Math.random() * 0.3));
          s.morale -= hit;
          s.taken += hit;
          ev.push({ t: 'hit', dmg: hit });
          s.foeT = Dl.FOE_GAP;
        } else {
          /* 너무 멀어 헛손질 — 다음 차례를 기다린다 */
          ev.push({ t: 'miss' });
          s.foeT = Dl.FOE_GAP;
        }
      }
    }

    if (s.morale <= 0) { s.morale = 0; s.over = true; s.cleared = false; ev.push({ t: 'rout' }); }
    else if (s.left <= 0) { s.left = 0; s.over = true; s.cleared = s.hp <= 0; ev.push({ t: 'time' }); }
    return ev;
  }

  /** 필살 — 기(氣)가 차야 나가고, 사거리는 안 본다(원작·`duel.js`와 같다) */
  function ult(s) {
    if (!s || s.over) { return { ok: false, reason: 'over' }; }
    var Dl = D();
    if (s.ki < Dl.KI_MAX) { return { ok: false, kind: 'ult', reason: 'noki' }; }
    var big = Math.round(s.myAtk * Dl.ULT_MUL);
    s.ki = 0;
    s.hp -= big;
    s.dealt += big;
    s.ults++;
    note(s, 'ult', big);
    var ev = [];
    checkParts(s, ev);
    finishIfDone(s);
    return { ok: true, kind: 'ult', dmg: big, partsEv: ev };
  }

  /** 차지 일격 — 시간이 지나면 저절로 차고(필살과 다르다), 사거리 안이어야 맞는다.
   *  살짝 여유(× 1.4)를 주지만 그 밖이면 **헛친다**(차지는 그래도 소모된다 — 무를 수 없다) */
  function chargeAttack(s, dist) {
    if (!s || s.over) { return { ok: false, reason: 'over' }; }
    if ((s.charge || 0) < CHARGE_MAX()) { return { ok: false, kind: 'charge', reason: 'notready' }; }
    s.charge = 0;
    s.chargeUsed = (s.chargeUsed || 0) + 1;
    var d = (dist === undefined || dist === null) ? 1e9 : dist;
    if (d > MY_REACH() * 1.4) {
      note(s, 'chargeMiss', 0);
      return { ok: true, kind: 'charge', dmg: 0, whiffed: true };
    }
    var mul = s.staggered > 0 ? STAGGER_BONUS() : 1;
    var dmg = Math.round(s.myAtk * CHARGE_MUL() * mul);
    s.hp -= dmg;
    s.dealt += dmg;
    s.hits++;
    note(s, 'charge', dmg);
    var ev = [];
    addPoise(s, dmg * 1.4, ev);           // 차지는 스태거 게이지도 더 크게 채운다
    checkParts(s, ev);
    finishIfDone(s);
    return { ok: true, kind: 'charge', dmg: dmg, staggerEv: ev };
  }

  /** 원거리 견제기 — 쿨다운만 보고 **거리는 안 본다**(필살과 같은 결).
   *  속공보다 한 방은 약하지만 사거리 밖에서도, 예고를 기다리며 미리 쓸 수 있다 */
  function ranged(s) {
    if (!s || s.over) { return { ok: false, reason: 'over' }; }
    if (s.rangedCd > 0) { return { ok: false, kind: 'ranged', reason: 'cd' }; }
    s.rangedCd = RANGED_CD();
    s.rangedUsed = (s.rangedUsed || 0) + 1;
    var dmg = Math.round(s.myAtk * RANGED_MUL() * (0.9 + Math.random() * 0.2) *
      (s.staggered > 0 ? STAGGER_BONUS() : 1));
    s.hp -= dmg;
    s.dealt += dmg;
    s.hits++;
    note(s, 'ranged', dmg);
    var ev = [];
    addPoise(s, dmg, ev);
    checkParts(s, ev);
    finishIfDone(s);
    return { ok: true, kind: 'ranged', dmg: dmg, staggerEv: ev };
  }

  /**
   * 자동 전투의 판단 — **입력만 대신 낸다.** 이동(다가가기·물러나기)과 필살·차지·원거리, 이 넷은 사람이
   * 화면에서 하는 것과 똑같은 함수를 부르고(`ult`·`chargeAttack`·`ranged`·`tick` 안의 거리 판정), 판정은 한 줄도 새로 안 만든다.
   * 사람보다 살짝 느리다 — 예고가 뜬 뒤 `react` 초가 지나야 물러서기 시작해서, 돌진·휩쓸기(예고가 짧거나 반경이 넓은 것)는
   * 자주 맞는다. 저스트 회피(토벌)는 안 한다. 그래서 손으로 잘 하는 쪽이 늘 낫다.
   * @returns {{move:'in'|'out'|'hold', ult:boolean, charge:boolean, ranged:boolean}}
   */
  function autoPlan(s, dist, react) {
    var plan = { move: 'hold', ult: false, charge: false, ranged: false };
    if (!s || s.over) { return plan; }
    var Dl = D(), d = (dist === undefined || dist === null) ? 1e9 : dist;
    var wait = (react === undefined || react === null) ? AUTO_REACT() : react;
    if (s.tell > 0) {
      var mv = moveByKey(s.tellMove);
      if (mv.tellSec - s.tell >= wait && d <= mv.range + 0.8) { plan.move = 'out'; }   // 반응 시간 전엔 서서 하던 대로 때린다
    } else if (d > MY_REACH() * 0.85) {
      plan.move = 'in';
    }
    if (s.ki >= Dl.KI_MAX) { plan.ult = true; }
    if ((s.charge || 0) >= CHARGE_MAX() && d <= MY_REACH() * 1.4) { plan.charge = true; }   // 헛치지 않을 거리에서만
    if (!(s.rangedCd > 0)) { plan.ranged = true; }
    return plan;
  }

  /** 물러난다 — 성과는 그때까지 낸 만큼만 인정된다 */
  function flee(s) { s.over = true; s.fled = true; s.cleared = false; }

  /** 성과 — `duel.js`의 `perf()`와 완전히 같은 모양(`rogue.js`가 이 모양만 본다).
   *  스태거·연타·차지 정보는 뒤에 얹기만 했다 — 없어도 `rogue.js`는 그대로 돈다 */
  function perf(s) {
    var ratio = s.dealt / Math.max(1, s.foeHp);
    return {
      live: true,
      ratio: ratio,
      score: core.clamp(ratio, 0, 1.6),
      dealt: s.dealt,
      cleared: !!s.cleared,
      fled: !!s.fled,
      hits: s.hits, ults: s.ults,
      dodgeOk: s.dodgeOk, dodgeTry: s.dodgeTry,
      taken: s.taken,
      timeUsed: Math.round((s.timeSec - s.left) * 10) / 10,
      acts: s.acts,
      staggerCount: s.staggerCount || 0,
      comboMax: s.comboMax || 0,
      chargeUsed: s.chargeUsed || 0,
      rangedUsed: s.rangedUsed || 0,
      raidMode: !!s.raidMode,
      parts: s.parts || 0,
      partsMax: s.partsMax || 0
    };
  }

  /** `duel.js`의 `fold()`와 완전히 같다 — 백 번의 자동 공격을 열 덩이로 접는다 */
  function fold(s, cap) {
    var n = cap || 10;
    var acts = s.acts;
    if (!acts.length) { return []; }
    var per = Math.ceil(acts.length / n), out = [], i, k = 0;
    for (i = 0; i < acts.length; i += per) {
      var sum = 0, ult2 = 0, last = 0;
      for (var j = i; j < Math.min(acts.length, i + per); j++) {
        sum += acts[j].dmg;
        if (acts[j].kind === 'ult') { ult2++; }
        last = acts[j].left;
      }
      k++;
      out.push({ n: k, dmg: sum, left: last, ult: ult2 });
    }
    return out;
  }

  /* ── 화면 층 ──────────────────────────────────────────── */

  var el = null, cur = null, rafId = null, doneCb = null, meta = null, lastT = null;

  function host() { return document.getElementById('rogue-hud'); }
  function $(sel) { return el ? el.querySelector(sel) : null; }

  /** 지금 적이 실제로 선 자리 — `world3d.duelStage()`가 세운 자리를 우선 쓰고,
   *  3D가 꺼져 있으면(WebGL 없음 등) `battle3d.spot()`과 같은 계산으로 대신한다 */
  function foePos() {
    var W3 = global.DG.world3d;
    if (W3 && W3.duelFoe) {
      var df = W3.duelFoe();
      if (df) { return { x: df.x, y: df.y }; }
    }
    var pos = core.save.player.pos;
    return { x: pos.x, y: pos.y - 6 };
  }

  function myFighter() {
    var id = core.save.party && core.save.party[0];
    var h = id ? global.DG.data.find(id) : null;
    if (!h) { return { name: '나' }; }
    return { name: h.name };
  }

  function paint() {
    if (!el) { return; }
    el.innerHTML = '' +
      '<div class="ra-hud">' +
        '<div class="ra-row ra-foe"><small>' + meta.foeName + '</small>' +
          '<div class="bar red"><i id="ra-hp" style="width:100%"></i></div></div>' +
        '<div class="ra-row"><small>사기</small>' +
          '<div class="bar blue"><i id="ra-mor" style="width:100%"></i></div></div>' +
        '<div class="ra-row"><small>기(氣)</small>' +
          '<div class="bar ki"><i id="ra-ki" style="width:0%"></i></div></div>' +
        '<div class="ra-row"><small>빈틈</small>' +
          '<div class="bar" id="ra-poise-bar"><i id="ra-poise" style="width:0%"></i></div></div>' +
        '<div class="ra-row"><small>차지</small>' +
          '<div class="bar" id="ra-chg-bar"><i id="ra-chg" style="width:0%"></i></div></div>' +
        (cur.raidMode
          ? '<div class="ra-row"><small>부위</small><span id="ra-parts" class="ra-parts"></span></div>'
          : '') +
        '<div class="ra-tell" id="ra-tell">⚠️ 강타! 원 밖으로 물러서라</div>' +
        '<div class="ra-combo" id="ra-combo"></div>' +
        '<div class="ra-pad">' +
          (cur.raidMode ? '<button class="btn primary" id="ra-dodge" data-ra="dodge">회피</button>' : '') +
          '<button class="btn primary" id="ra-ult" data-ra="ult" disabled>필살</button>' +
          '<button class="btn primary" id="ra-charge" data-ra="charge" disabled>차지 일격</button>' +
          '<button class="btn primary" id="ra-ranged" data-ra="ranged">원거리</button>' +
          '<button class="btn ghost' + (autoOn() ? ' on' : '') + '" id="ra-auto" data-ra="auto">🤖 자동' + (autoOn() ? ' 켜짐' : '') + '</button>' +
          '<button class="btn ghost" id="ra-flee" data-ra="flee">물러나기</button>' +
        '</div>' +
      '</div>';
  }

  function refresh() {
    if (!el || !cur) { return; }
    var hp = $('#ra-hp'), mor = $('#ra-mor'), ki = $('#ra-ki'), poise = $('#ra-poise'), chg = $('#ra-chg'),
      tell = $('#ra-tell'), combo = $('#ra-combo'), ub = $('#ra-ult'), cb = $('#ra-charge'), rb = $('#ra-ranged');
    if (hp) { hp.style.width = Math.max(0, cur.hp / cur.foeHp * 100) + '%'; }
    if (mor) { mor.style.width = Math.max(0, cur.morale / cur.moraleMax * 100) + '%'; }
    if (ki) { ki.style.width = Math.min(100, cur.ki / D().KI_MAX * 100) + '%'; }
    if (poise) { poise.style.width = (cur.staggered > 0 ? 100 : Math.min(100, cur.poise / cur.poiseMax * 100)) + '%'; }
    if (chg) { chg.style.width = Math.min(100, cur.charge / CHARGE_MAX() * 100) + '%'; }
    if (combo) { combo.textContent = cur.combo > 1 ? '🔥 연타 ×' + cur.combo : ''; }
    if (cur.raidMode) {
      var pt = $('#ra-parts');
      if (pt) {
        var labels = ['🛡️', '🗡️', '🐎'];
        pt.innerHTML = labels.map(function (e, i) {
          return '<i' + (i < cur.parts ? ' class="gone"' : '') + '>' + e + '</i>';
        }).join(' ');
      }
      var dg = $('#ra-dodge');
      if (dg) { dg.classList.toggle('ready', cur.tell > 0 && cur.tell <= JUST_WINDOW()); }
    }
    if (tell) {
      /* 예고가 없을 땐 같은 자리를 "다가가라" 안내로 쓴다 — 무대가 세우는
         거리(약 8m)가 내 사거리(3m)보다 멀어, 걸어 들어가지 않으면 자동
         공격도 상대 공격도 영영 안 난다(2026-09-06, 실전 포획 첫 시험에서
         3초를 가만 서 있어도 아무 일이 안 일어나 발견). 기절 중엔 "몰아쳐라"가
         그 자리를 대신한다 — 셋이 겹칠 일이 없어(예고 중엔 기절 안 걸린다) 한 줄로 족하다. */
      if (cur.staggered > 0) {
        tell.textContent = '🌟 빈틈이다! 지금 몰아쳐라';
        tell.classList.add('show', 'stagger');
      } else if (cur.tell > 0) {
        tell.textContent = moveByKey(cur.tellMove).label;
        tell.classList.remove('stagger'); tell.classList.add('show');
      } else if (cur.lastDist > MY_REACH() && autoOn()) {
        var gw = global.DG.world;
        tell.textContent = gw && gw.mode !== 'keyboard' ? '🚶 GPS 모드 — 자동은 몸을 못 움직입니다, 직접 걸어 다가가세요' : '🤖 자동 — 다가가는 중';
        tell.classList.remove('stagger'); tell.classList.add('show');
      } else if (cur.lastDist > MY_REACH()) {
        tell.textContent = '🚶 다가가세요 — 사거리 안이면 저절로 공격합니다 (원거리는 지금도 씁니다)';
        tell.classList.remove('stagger'); tell.classList.add('show');
      } else {
        tell.classList.remove('show', 'stagger');
      }
    }
    if (ub) { ub.disabled = cur.ki < D().KI_MAX; }
    if (cb) { cb.disabled = cur.charge < CHARGE_MAX(); }
    if (rb) {
      /* 사거리를 안 보는 스킬이라 다가가기 전에도 눌러도 된다 — 쿨다운만 막는다 */
      rb.disabled = cur.rangedCd > 0;
      rb.textContent = cur.rangedCd > 0 ? '원거리 (' + cur.rangedCd.toFixed(1) + ')' : '원거리';
    }
  }

  /* 버튼과 자동 전투가 **같은 함수**를 부른다 */
  function doUlt() {
    if (!cur) { return; }
    var r = ult(cur);
    if (r.ok) {
      core.emit('duel:fx', { kind: 'ult', dmg: r.dmg, mine: true });
      if (r.partsEv && r.partsEv.length) { emitEvents(r.partsEv); }
      refresh();
      if (cur.over) { finish(); }
    }
  }
  function doCharge() {
    if (!cur) { return; }
    var r = chargeAttack(cur, cur.lastDist);
    if (r.ok) {
      core.emit('duel:fx', { kind: 'charge', dmg: r.dmg, mine: true, whiffed: !!r.whiffed });
      if (r.staggerEv && r.staggerEv.length) { emitEvents(r.staggerEv); }
      refresh();
      if (cur.over) { finish(); }
    }
  }
  function doRanged() {
    if (!cur) { return; }
    var r = ranged(cur);
    if (r.ok) {
      core.emit('duel:fx', { kind: 'ranged', dmg: r.dmg, mine: true });
      if (r.staggerEv && r.staggerEv.length) { emitEvents(r.staggerEv); }
      refresh();
      if (cur.over) { finish(); }
    }
  }

  /* ── 자동 전투(2026-09-20, 사용자 요청) — 켜 두면 이 판정 위에서 입력을 대신 낸다 ─────────
   * 켜짐은 세이브(save.settings.autoBattle)에 남아 다음 전투에도 이어진다. GPS 모드에서는 몸을 코드로 못 움직이므로
   * (실제로 걸어야 한다) 필살·차지·원거리만 대신 낸다. */
  function autoOn() { var st = core.save && core.save.settings; return !!(st && st.autoBattle); }
  function setAuto(v) {
    core.save.settings = core.save.settings || {};
    core.save.settings.autoBattle = !!v;
    if (!v) { releaseStick(); }
    core.persist();
  }
  function releaseStick() {
    var W = global.DG.world;
    if (W && W.setStick) { W.setStick(0, 0, false); }
  }
  /** 자동 이동 — 화면 스틱과 같은 통로(`world.setStick`)로만 움직인다. 물러날 때도 걷는 속도다(달리기 안 함) */
  function driveMove(kind, pos, fp) {
    var W = global.DG.world;
    if (!W || !W.setStick || W.mode !== 'keyboard') { return; }
    if (kind === 'hold') { W.setStick(0, 0, false); return; }
    var dx = fp.x - pos.x, dy = fp.y - pos.y, l = Math.hypot(dx, dy) || 1, sg = kind === 'in' ? 1 : -1;
    W.setStick(sg * dx / l, sg * dy / l, false);
  }

  function bind() {
    var u = $('[data-ra="ult"]');
    if (u) { u.addEventListener('click', doUlt); }
    var c = $('[data-ra="charge"]');
    if (c) { c.addEventListener('click', doCharge); }
    var r2 = $('[data-ra="ranged"]');
    if (r2) { r2.addEventListener('click', doRanged); }
    var au = $('[data-ra="auto"]');
    if (au) {
      au.addEventListener('click', function () {
        setAuto(!autoOn());
        au.classList.toggle('on', autoOn());
        au.textContent = autoOn() ? '🤖 자동 켜짐' : '🤖 자동';
      });
    }
    var dg = $('[data-ra="dodge"]');
    if (dg) {
      dg.addEventListener('click', function () {
        if (!cur) { return; }
        var r = dodge(cur);
        if (r.ok && r.just) {
          core.emit('duel:fx', { kind: 'justdodge', mine: true });
          if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast('🌟 간발! 완전히 피했다'); }
        }
        refresh();
      });
    }
    var f = $('[data-ra="flee"]');
    if (f) {
      f.addEventListener('click', function () {
        if (!cur) { return; }
        flee(cur);
        finish();
      });
    }
  }

  function emitEvents(ev) {
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.t === 'quick') { core.emit('duel:fx', { kind: 'quick', dmg: e.dmg, mine: true }); }
      else if (e.t === 'combo') { core.emit('duel:fx', { kind: 'combo', dmg: e.dmg, combo: e.combo, mine: true }); }
      else if (e.t === 'stagger') { core.emit('duel:fx', { kind: 'stagger', mine: true }); }
      else if (e.t === 'hit') { core.emit('duel:fx', { kind: 'hit', dmg: e.dmg, mine: false }); }
      else if (e.t === 'heavy') {
        core.emit('duel:fx', { kind: 'heavy', dmg: e.dmg, dodged: !!e.dodged, just: !!e.just, move: e.move, mine: false });
      } else if (e.t === 'tell') {
        /* 강타류 예고 — 화면 아래 HUD 문구만으로는 3D 화면을 보던 눈에 안 들어온다.
           상대 위에 뜨는 경고 알갱이로 같이 알린다(2026-09-05, "실시간 교전 손맛" 점검) */
        core.emit('duel:fx', { kind: 'tell', move: e.move, mine: false });
      } else if (e.t === 'partbreak') {
        /* 부위 파괴(토벌 전용, §5 ③) — 내가 낸 피해로 벌어지는 일이라 mine:true */
        core.emit('duel:fx', { kind: 'partbreak', part: e.part, mine: true });
      }
      /* 'miss'·'rout'·'time' 은 카메라·알갱이로 옮길 것이 없다 — HUD 표시뿐 */
    }
  }

  function frame(ts) {
    if (!cur) { return; }
    var now = ts || (global.performance ? performance.now() : Date.now());
    var dt = Math.min(0.25, lastT === null ? 0 : (now - lastT) / 1000);
    lastT = now;
    var pos = core.save.player.pos, fp = foePos();
    var dist = Math.hypot(pos.x - fp.x, pos.y - fp.y);
    cur.lastDist = dist;
    if (autoOn()) {
      var plan = autoPlan(cur, dist);
      driveMove(plan.move, pos, fp);
      if (plan.ult) { doUlt(); }
      if (cur && plan.charge) { doCharge(); }
      if (cur && plan.ranged) { doRanged(); }
      if (!cur) { return; }             // 위 필살·차지·원거리로 전투가 끝났으면 finish() 가 이미 정리했다
    }
    var ev = tick(cur, dt, dist);
    emitEvents(ev);
    refresh();
    if (cur.over) { finish(); return; }
    rafId = requestAnimationFrame(frame);
  }

  /**
   * 화면을 연다 — `duel.js.open(o)`와 **같은 매개변수·같은 onDone 모양**을 받는다.
   * @param {{title, foeName, portrait?, stage3d?, foeHp, myAtk, myDef, timeSec?, onDone}} o
   */
  function open(o) {
    el = host();
    if (!el) { return null; }
    cur = create(o);
    meta = o;
    doneCb = o.onDone || null;
    lastT = null;
    el.classList.add('show');
    paint();
    bind();
    refresh();
    /* `battle3d.js`가 이 신호를 듣고 `world3d.duelStage()`를 부른다 — `duel.js`가
       쏘는 것과 완전히 같은 모양이라 그쪽 코드는 한 줄도 안 건드린다 */
    core.emit('duel:open', { title: o.title, foeName: o.foeName, stage3d: o.stage3d || null });
    rafId = requestAnimationFrame(frame);
    return cur;
  }

  function finish() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (autoOn()) { releaseStick(); }       // 자동이 밀고 있던 스틱을 놓는다
    var p = perf(cur);
    p.folded = fold(cur);
    var cb = doneCb;
    cur = null; doneCb = null; meta = null;
    if (el) { el.innerHTML = ''; el.classList.remove('show'); }
    core.emit('duel:close', p);
    if (cb) { cb(p); }
  }

  global.DG = global.DG || {};
  global.DG.rogueAction = {
    MY_REACH: MY_REACH, FOE_REACH: FOE_REACH, HEAVY_RANGE: HEAVY_RANGE,
    CHARGE_MAX: CHARGE_MAX, COMBO_N: COMBO_N, RANGED_CD: RANGED_CD,
    JUST_WINDOW: JUST_WINDOW, WALK_DODGE_MUL: WALK_DODGE_MUL, PART_N: PART_N, PART_STEP: PART_STEP,
    foeMoves: foeMoves, moveByKey: moveByKey,
    /* 판정 층 — 화면 없이 굴린다 (자가진단이 쓰는 문) */
    create: create, tick: tick, ult: ult, flee: flee, perf: perf, fold: fold, autoPlan: autoPlan,
    autoOn: autoOn, setAuto: setAuto, AUTO_REACT: AUTO_REACT,
    chargeAttack: chargeAttack, ranged: ranged, dodge: dodge,
    /* 화면 층 */
    open: open,
    get active() { return !!cur; }
  };
})(window);
