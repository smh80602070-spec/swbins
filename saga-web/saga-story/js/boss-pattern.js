/**
 * 보스 패턴전(大將戰) — 원작식 (PLAN §5-9, 2026-09-24 사용자 선택)
 * ---------------------------------------------------------------
 * 사냥터 보스는 여태 "뜸 들이다 달려들기" 하나뿐이었다(주간 관문 대장만 장판·소환).
 * 원작 보스전의 재미는 **읽고 피하는 것**이다 — 바닥에 떨어질 자리가 먼저 그려지고,
 * 체력 구간마다 패턴이 늘고, 마지막엔 안전지대로 뛰어들어야 사는 큰 기술이 온다.
 *
 *   1단계(체력 100~66%)  내려찍기(내 자리 원) · 낙석(세 줄기)
 *   2단계(66~33%)        + 지진(바닥 전체 — 점프하거나 발판 위면 산다) · 부하 둘 부르기
 *   3단계(33% 아래)      + 휩쓸기(화면 전체 — 초록 안전지대만 산다, 최대 체력의 55%)
 *                         광폭: 피해 ×1.25 · 패턴 간격 ×0.7
 *
 * 단계가 넘어가면 포효(흔들림·이름 띠·토스트)하고 걸려 있던 패턴을 거둔다.
 * 관문 대장(e.gate)은 제 패턴(§5-4)이 있어 여기 안 탄다.
 *
 * §5-10(2026-09-24) — 사냥터 보스 여섯마다 **고유 기술 하나**(SIG, 이름으로 찾는다)가
 * 모든 단계 후보에 끼고, 등장 뒤 첫 기술은 늘 그것이다:
 *   ring   도넛    — 보스 곁 r100 만 산다(붙어라)
 *   volley 화살비  — 다섯 점이 110 간격, 사이 틈으로
 *   beam   공중 쇠뇌 — 뛰었거나 발판 위면 맞는다(땅에 붙어라 — 지진의 거꾸로)
 *   pillar 불기둥 두 박자 — 120 칸 홀수 줄 → 짝수 줄, 한 칸 옮겨 딛는다
 *   pull   끌어당김 — 1.4초 끌려가다(150px/s) 보스 둘레 r130 폭발, 거슬러 달려라
 *   chase  추적 장판 — 1초 따라오다 0.5초 멈춘 뒤 터진다
 * **그로기** — 피해를 주는 패턴을 셋 잇달아 다 피하면 5초 멈춘다(받는 피해 ×1.5,
 * 몸통 박치기·돌진 없음). 한 번이라도 맞으면 셈이 0 으로.
 *
 * §5-11 — 관문 대장(e.gate) 다섯 + 관문 수호장도 고유 기술 하나씩. 관문 대장은 제 패턴(§5-4
 * 달려들기·내려찍기·소환·방패)이 따로 있어 `step` 대신 `stepSig` 를 탄다 — 단계·광폭 없이
 * 고유 기술만 8초마다(제 패턴이 걸려 있으면 미룬다). 그로기는 같이 탄다.
 *
 * **판정은 `step(e, dt, api)` 하나다 — 순수하게 e 만 바꾸고 바깥 일은 api 로 한다**
 * (api.p·api.stg·api.fx·api.hurt·api.spawn·api.sfx·api.toast·api.rand·api.hpMax).
 * 그래서 자가진단이 가짜 api 로 단계·예고·판정을 값으로 굴린다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('bossPattern.' + key, def); }
  function on() { return K('on', 1) ? true : false; }

  var P_W = 26, P_H = 54;
  var PHASE_AT = [0.66, 0.33];
  var CD = [6.5, 5.0, 3.8];                  // 단계별 패턴 간격(초)
  var SLAM = { t: 1.0, r: 80, mul: 1.3 };
  var ROCK = { t: 1.1, r: 40, mul: 0.9, n: 3 };
  var QUAKE = { t: 1.2, mul: 1.2 };
  var SWEEP = { t: 1.8, w: 170, pct: 0.55 };
  function ENRAGE() { return K('enrage', 1.25); }
  var RING = { t: 1.3, r: 100, mul: 1.1 };
  var VOLLEY = { t: 1.2, r: 34, mul: 0.8, n: 5, gap: 110 };
  var BEAM = { t: 1.1, mul: 1.1, y: 95 };
  var PILLAR = { t: 1.0, t2: 0.8, w: 60, gap: 120, n: 3, mul: 1.0 };
  var PULL = { t: 1.4, v: 150, r: 130, mul: 1.4 };
  var CHASE = { t: 1.5, lock: 0.5, r: 70, mul: 1.4 };
  var GROGGY = { n: 3, t: 5, mul: 1.5 };
  /** 사냥터 보스 고유 기술 — data-side.js STAGES 의 boss.name 으로 찾는다 */
  var SIG = {
    '황건 두목': { kind: 'ring', name: '황천 부적진' },
    '오랑캐 족장': { kind: 'volley', name: '초원 화살비' },
    '위군 도독': { kind: 'beam', name: '쇠뇌 일제사' },
    '적국 대장군': { kind: 'pillar', name: '화계 불기둥' },
    '폐도 흉장': { kind: 'pull', name: '쇠사슬 끌어당김' },
    '암굴 귀장': { kind: 'chase', name: '귀화 추적' },
    '전장 원혼 장수': { kind: 'ring', name: '원혼 포위진' },      // 5부 문 너머
    '폐허 도심 통제관': { kind: 'beam', name: '신호등 일제사' },
    '궤도 기지 감시관': { kind: 'pull', name: '중력 그물' },
    /* 관문 대장(§5-11) */
    '산채 두령': { kind: 'volley', name: '돌팔매 소나기' },
    '왜구 선장': { kind: 'pull', name: '갈고리 끌어당김' },
    '거란 도통': { kind: 'beam', name: '기마 화살 일제사' },
    '몽골 만호장': { kind: 'ring', name: '만호 포위진' },
    '왜장': { kind: 'pillar', name: '화승총 두 줄 사격' },
    '관문 수호장': { kind: 'chase', name: '수호 인장 추적' }
  };
  var GATE_SIG_CD = 8, GATE_SIG_FIRST = 4;
  function sigOf(e) { return (e && e.ref && SIG[e.ref.name]) || null; }

  /** 체력 비율 → 단계(0·1·2) */
  function phaseOf(hp, hpMax) {
    var r = hpMax > 0 ? hp / hpMax : 1;
    return r > PHASE_AT[0] ? 0 : (r > PHASE_AT[1] ? 1 : 2);
  }

  /** 이 단계에서 고를 수 있는 패턴 */
  function poolOf(ph, sig) {
    var out = ph === 0 ? ['slam', 'rock'] : ph === 1 ? ['slam', 'rock', 'quake', 'summon'] : ['slam', 'rock', 'quake', 'sweep'];
    if (sig) { out.push(sig); }
    return out;
  }

  function init(e) {
    if (e.bp) { return e.bp; }
    var sg = sigOf(e);
    e.bp = { phase: 0, cd: 3.2, kind: '', t: 0, marks: null, safe: null, summoned: 0, baseDmg: e.dmg, last: '',
             sig: sg ? sg.kind : '', first: sg ? sg.kind : '', dodge: 0, groggy: 0, wave: 0, hitAcc: 0, warn: null };
    return e.bp;
  }

  function feet(api) { return { x: api.p.x + P_W / 2, y: api.p.y + P_H }; }
  function mid(e) { return e.x + e.w / 2; }
  /** 불기둥 한 박자 — 내 발 둘레 120 칸, wave 1 은 홀수 칸(내 칸은 비었다), 2 는 짝수 칸 */
  function pillarMarks(b, api, cx, wave) {
    var out = [], k;
    for (k = -PILLAR.n; k <= PILLAR.n; k++) {
      if (Math.abs(k) % 2 !== (wave === 1 ? 1 : 0)) { continue; }
      var mx = cx + k * PILLAR.gap;
      if (mx < 0 || mx > api.stg.width) { continue; }
      out.push({ x: mx, y: api.stg.floor, r: PILLAR.w, col: true });
      api.fx.push({ t: 'zonewarn', x: mx, y: api.stg.floor, r: PILLAR.w, life: wave === 1 ? PILLAR.t : PILLAR.t2, rock: true, fire: true });
    }
    return out;
  }

  /** 패턴을 건다 — 예고(fx)를 먼저 내고, t 초 뒤 resolve 가 판정한다 */
  function begin(e, kind, api) {
    var b = e.bp, f = feet(api), stg = api.stg, i;
    b.kind = kind; b.last = kind;
    if (kind === 'slam') {
      b.t = SLAM.t; b.marks = [{ x: f.x, y: f.y, r: SLAM.r }];
      api.fx.push({ t: 'zonewarn', x: f.x, y: f.y, r: SLAM.r, life: SLAM.t });
    } else if (kind === 'rock') {
      b.t = ROCK.t; b.marks = [];
      var off = [0, -(130 + api.rand() * 50), 130 + api.rand() * 50];
      for (i = 0; i < ROCK.n; i++) {
        var mx = Math.max(30, Math.min(stg.width - 30, f.x + off[i]));
        b.marks.push({ x: mx, y: f.y, r: ROCK.r });
        api.fx.push({ t: 'zonewarn', x: mx, y: f.y, r: ROCK.r, life: ROCK.t, rock: true });
      }
    } else if (kind === 'quake') {
      b.t = QUAKE.t; b.marks = null;
      api.fx.push({ t: 'quakewarn', x: f.x, y: stg.floor, life: QUAKE.t });
    } else if (kind === 'sweep') {
      b.t = SWEEP.t;
      var side = api.rand() < 0.5 ? -1 : 1, dist = 150 + api.rand() * 170;
      var sx = f.x + side * dist;
      if (sx < SWEEP.w / 2 + 10 || sx > stg.width - SWEEP.w / 2 - 10) { sx = f.x - side * dist; }
      sx = Math.max(SWEEP.w / 2 + 10, Math.min(stg.width - SWEEP.w / 2 - 10, sx));
      b.safe = { x: sx, w: SWEEP.w };
      api.fx.push({ t: 'sweepwarn', x: sx, w: SWEEP.w, y: stg.floor, life: SWEEP.t });
      api.toast('⚠️ ' + e.ref.name + '의 휩쓸기 — 초록 안전지대로!');
    } else if (kind === 'summon') {
      b.t = 0.4; b.summoned++;
      api.spawn(Math.max(40, e.x - 90));
      api.spawn(Math.min(stg.width - 40, e.x + 90));
      api.toast('👥 ' + e.ref.name + '이(가) 부하를 불렀다!');
    } else if (kind === 'ring') {
      b.t = RING.t; b.cx = mid(e);
      api.fx.push({ t: 'ringwarn', x: b.cx, y: stg.floor, r: RING.r, life: RING.t });
    } else if (kind === 'volley') {
      b.t = VOLLEY.t; b.marks = [];
      var j0 = (api.rand() - 0.5) * 40;
      for (i = 0; i < VOLLEY.n; i++) {
        var vx = Math.max(20, Math.min(stg.width - 20, f.x + (i - 2) * VOLLEY.gap + j0));
        b.marks.push({ x: vx, y: f.y, r: VOLLEY.r });
        api.fx.push({ t: 'zonewarn', x: vx, y: f.y, r: VOLLEY.r, life: VOLLEY.t, rock: true });
      }
    } else if (kind === 'beam') {
      b.t = BEAM.t;
      api.fx.push({ t: 'beamwarn', x: 0, y: stg.floor - BEAM.y, life: BEAM.t });
    } else if (kind === 'pillar') {
      b.t = PILLAR.t; b.wave = 1; b.hitAcc = 0; b.px = f.x;
      b.marks = pillarMarks(b, api, f.x, 1);
    } else if (kind === 'pull') {
      b.t = PULL.t; b.cx = mid(e);
      api.fx.push({ t: 'zonewarn', x: b.cx, y: stg.floor, r: PULL.r, life: PULL.t });
      api.toast('⛓️ ' + e.ref.name + '의 쇠사슬 — 거슬러 달려라!');
    } else if (kind === 'chase') {
      b.t = CHASE.t; b.marks = [{ x: f.x, y: f.y, r: CHASE.r }];
      b.warn = { t: 'zonewarn', x: f.x, y: f.y, r: CHASE.r, life: CHASE.t, chase: true };
      api.fx.push(b.warn);
    }
    if (b.sig && kind === b.sig) {
      var sg = sigOf(e);
      api.fx.push({ t: 'bossintro', name: e.ref.name + ' — ' + sg.name, life: 1.0 });
    }
    api.sfx(kind === 'summon' ? 'boss' : 'charge');
    /* 돌진과 겹치지 않게 — 패턴이 풀릴 때까지 돌진을 미룬다 */
    e.chargeCd = Math.max(e.chargeCd || 0, b.t + 1.2);
  }

  /** 판정 — 맞았으면 api.hurt(피해). 돌려주는 것은 맞은 수 */
  function resolve(e, api) {
    var b = e.bp, f = feet(api), stg = api.stg, hit = 0, i;
    if (b.kind === 'slam' || b.kind === 'rock') {
      var mul = b.kind === 'slam' ? SLAM.mul : ROCK.mul;
      for (i = 0; i < b.marks.length; i++) {
        var m = b.marks[i];
        if (Math.abs(f.x - m.x) < m.r && Math.abs(f.y - m.y) < m.r * 0.9) { hit++; }
      }
      if (hit) { api.hurt(Math.round(e.dmg * mul)); }
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.3, span: 0.3, amt: b.kind === 'slam' ? 6 : 4, big: true });
    } else if (b.kind === 'quake') {
      /* 바닥에 발을 붙인 채면 맞는다 — 뛰었거나 발판 위면 산다 */
      if (api.p.onGround && Math.abs(f.y - stg.floor) < 8) { hit = 1; api.hurt(Math.round(e.dmg * QUAKE.mul)); }
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.5, span: 0.5, amt: 9, big: true });
    } else if (b.kind === 'sweep') {
      if (Math.abs(f.x - b.safe.x) > b.safe.w / 2) { hit = 1; api.hurt(Math.round(api.hpMax() * SWEEP.pct), true); }
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.6, span: 0.6, amt: 12, big: true });
    } else if (b.kind === 'ring') {
      if (Math.abs(f.x - b.cx) > RING.r) { hit = 1; api.hurt(Math.round(e.dmg * RING.mul)); }
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.4, span: 0.4, amt: 8, big: true });
    } else if (b.kind === 'volley' || b.kind === 'chase') {
      for (i = 0; i < b.marks.length; i++) {
        var vm = b.marks[i];
        if (Math.abs(f.x - vm.x) < vm.r && Math.abs(f.y - vm.y) < vm.r * 1.6) { hit++; }
      }
      if (hit) { api.hurt(Math.round(e.dmg * (b.kind === 'chase' ? CHASE.mul : VOLLEY.mul))); }
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.3, span: 0.3, amt: 5, big: true });
    } else if (b.kind === 'beam') {
      if (!api.p.onGround || f.y < stg.floor - 8) { hit = 1; api.hurt(Math.round(e.dmg * BEAM.mul)); }
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.3, span: 0.3, amt: 5, big: true });
    } else if (b.kind === 'pillar') {
      for (i = 0; i < b.marks.length; i++) { if (Math.abs(f.x - b.marks[i].x) < PILLAR.w) { hit = 1; } }
      if (hit) { api.hurt(Math.round(e.dmg * PILLAR.mul)); }
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.3, span: 0.3, amt: 6, big: true });
      if (b.wave === 1) {
        /* 둘째 박자 — 같은 칸 격자에서 짝수 줄. 한 칸(120) 옮겨 딛어야 산다 */
        b.hitAcc = hit; b.wave = 2; b.t = PILLAR.t2;
        b.marks = pillarMarks(b, api, b.px, 2);
        return -1;
      }
      hit = hit || b.hitAcc; b.wave = 0;
    } else if (b.kind === 'pull') {
      if (Math.abs(f.x - b.cx) < PULL.r) { hit = 1; api.hurt(Math.round(e.dmg * PULL.mul)); }
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.5, span: 0.5, amt: 10, big: true });
    }
    /* 그로기 셈 — 피해를 주는 패턴만(부르기 제외). 셋 잇달아 다 피하면 5초 멈춘다 */
    if (hit) { b.dodge = 0; } else {
      b.dodge += 1;
      if (b.dodge >= GROGGY.n) {
        b.dodge = 0; b.groggy = GROGGY.t; e.charge = 0;
        api.fx.push({ t: 'groggy', x: mid(e), y: e.y, life: GROGGY.t });
        api.toast('💫 ' + e.ref.name + ' 그로기 — ' + GROGGY.t + '초 동안 받는 피해 ×' + GROGGY.mul + '!');
        api.sfx('boss');
      }
    }
    b.warn = null;
    b.kind = ''; b.marks = null; b.safe = null;
    return hit;
  }

  /**
   * 한 걸음. near = 보스가 나를 보고 있나(side.js 의 near 와 같다).
   * @returns {{phase:number, changed:boolean, hit:number}}
   */
  function step(e, dt, api, near) {
    var b = init(e), out = { phase: b.phase, changed: false, hit: 0 };
    var ph = phaseOf(e.hp, e.hpMax);
    if (ph > b.phase) {
      b.phase = ph; out.phase = ph; out.changed = true;
      b.kind = ''; b.marks = null; b.safe = null; b.t = 0; b.wave = 0; b.warn = null;
      b.cd = 1.4;                                  // 포효 뒤 곧 새 패턴
      if (ph === 2) { e.dmg = Math.round(b.baseDmg * ENRAGE()); }
      api.fx.push({ t: 'bossintro', name: e.ref.name + (ph === 1 ? ' — 2단계' : ' — 광폭'), life: 1.6 });
      api.fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.6, span: 0.6, amt: 10, big: true });
      api.toast(ph === 1 ? '⚠️ ' + e.ref.name + ' 2단계 — 땅이 흔들린다(점프로 피하라)!' : '🔥 ' + e.ref.name + ' 광폭 — 휩쓸기가 온다!');
      api.sfx('boss');
      return out;
    }
    if (tickBusy(e, dt, api, out)) { return out; }
    b.cd -= dt * (b.phase === 2 ? 1 / 0.7 : 1);
    if (b.cd <= 0 && near && !(e.charge > 0)) {
      var pool = poolOf(b.phase, b.sig);
      /* 같은 것을 두 번 잇지 않는다 · 부르기는 단계마다 한 번 */
      var cand = pool.filter(function (k) { return k !== b.last && !(k === 'summon' && b.summoned >= b.phase); });
      if (!cand.length) { cand = pool; }
      var kind = cand[Math.floor(api.rand() * cand.length) % cand.length];
      if (b.first) { kind = b.first; b.first = ''; }     // 등장 뒤 첫 기술은 고유 기술
      begin(e, kind, api);
      b.cd = CD[b.phase];
    }
    return out;
  }

  /** 그로기·걸린 패턴을 한 걸음 굴린다 — @returns 이번 걸음을 여기서 끝냈으면 true */
  function tickBusy(e, dt, api, out) {
    var b = e.bp;
    if (b.groggy > 0) {
      b.groggy -= dt; out.groggy = true;
      e.charge = 0; e.chargeCd = Math.max(e.chargeCd || 0, 1);
      if (b.groggy <= 0) { b.groggy = 0; b.cd = Math.min(b.cd, 1.0); }
      return true;
    }
    if (b.kind) {
      b.t -= dt;
      if (b.kind === 'pull' && b.t > 0) {
        /* 끌어당김 — 보스 쪽으로 끌린다(보스를 넘어가진 않는다) */
        var pf = feet(api), pd = b.cx - pf.x, pv = (pd > 0 ? 1 : -1) * Math.min(Math.abs(pd), PULL.v * dt);
        api.p.x += pv;
      } else if (b.kind === 'chase' && b.t > CHASE.lock) {
        var cf = feet(api);
        b.marks[0].x = cf.x; b.marks[0].y = cf.y;
        if (b.warn) { b.warn.x = cf.x; b.warn.y = cf.y; }
      }
      if (b.t <= 0) {
        if (b.kind === 'summon') { b.kind = ''; } else {
          var rh = resolve(e, api);
          if (rh >= 0) { out.hit = rh; b.kind = ''; }
        }
      }
      return true;
    }
    return false;
  }

  /**
   * 관문 대장(§5-11) — 고유 기술만. 단계·광폭·공용 패턴은 없다(관문 대장 제 패턴이 따로 돈다).
   * 제 패턴(e.patternT)이나 돌진이 걸려 있으면 미룬다.
   */
  function stepSig(e, dt, api, near) {
    var b = init(e), out = { phase: 0, changed: false, hit: 0 };
    if (!b.sig) { return out; }
    if (b.sigCd === undefined) { b.sigCd = GATE_SIG_FIRST; b.first = ''; }
    if (tickBusy(e, dt, api, out)) { return out; }
    b.sigCd -= dt;
    if (b.sigCd <= 0 && near && !(e.charge > 0) && !(e.patternT > 0)) {
      begin(e, b.sig, api);
      b.sigCd = GATE_SIG_CD;
    }
    return out;
  }

  global.DG = global.DG || {};
  global.DG.bossPattern = {
    on: on, phaseOf: phaseOf, poolOf: poolOf, step: step, stepSig: stepSig, init: init, sigOf: sigOf,
    GATE_SIG_CD: GATE_SIG_CD, GATE_SIG_FIRST: GATE_SIG_FIRST,
    SLAM: SLAM, ROCK: ROCK, QUAKE: QUAKE, SWEEP: SWEEP, CD: CD, PHASE_AT: PHASE_AT,
    RING: RING, VOLLEY: VOLLEY, BEAM: BEAM, PILLAR: PILLAR, PULL: PULL, CHASE: CHASE, GROGGY: GROGGY, SIG: SIG,
    /** 받는 피해 배수 — side.js strike 가 부른다(그로기 동안 ×1.5) */
    dmgTakenMul: function (e) { return e && e.bp && e.bp.groggy > 0 ? GROGGY.mul : 1; }
  };
})(window);
