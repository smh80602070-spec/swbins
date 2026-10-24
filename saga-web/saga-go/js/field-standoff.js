/**
 * 1만리 — 대치 (W-0420 ② · 정본 고돗 G-0343 · 고스트 오브 쓰시마 대치 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 들판 무리는 다가가면 우르르 달려든다 → 쉬는 무리(전원 idle·체력 가득) 곁으로 **웅크리지 않고**(웅크림은 W-0286 몰래 다가가기 길)
 * 어그로 거리 + 2m 안에 들면 「⚔ 대치」: 무리가 멈춰 노려보고, 1.0~2.2초 뒤 가장 가까운 한 마리가 달려든다(0.45초 창).
 *   창 안에 평타      → 그 적 한 칼(「일격!」 — 방패 0·hitFoe 로, 전리품·등급·연구 고리 그대로), 다음 놈이 이어 달려듦(창 ×0.85)
 *   달려들기 전 평타  → 「성급했다!」 대치 깨짐(평타는 그대로 나간다)
 *   창을 놓침        → 그 적 한 방(hurt) 맞고 깨짐 · 25% 는 헛몸짓(움찔만 — 그때 누르면 성급)
 *   맞선 자리에서 6m 벗어남 · 웅크림·말 위·자동 사냥·결투 → 깨짐. 깨지면 남은 무리 전원 쫓아오고, 그 무리는 60초 동안 다시 대치 안 함
 * 무리 = 들판 plain·elite 만(우두머리·수호자·숨은 터·이야기·인물 결투 빼고). 세이브 없음(판 안 상태).
 * field-combat.js 는 큰 파일 상한이라 여기 두고 거기는 기존 줄 끝에서 부른다(step 첫 줄 step · 쉬는 적 줄 f.so · attack 첫 줄 tryStrike · bind).
 * 손잡이 go.standoff(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var BAND = 2, WAIT_MIN = 1.0, WAIT_MAX = 2.2, NEXT_MIN = 0.6, NEXT_MAX = 1.2, WIN = 0.45, WIN_MUL = 0.85, FEINT = 0.25, FEINT_T = 0.35,
    LEAVE = 6, COOL = 60, SCAN = 0.25, STOP = 1.3;
  var I = null, so = null, scanT = 0, cool = {}, rng = Math.random;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('go.standoff', 1)); }
  function KDV() { return I ? I.KDV() : 1; }
  function aggroR() { var C = core(); return (C && C.tuned ? +C.tuned('field.aggroR', 12) : 12) * KDV(); }
  function now() { return Date.now(); }
  function rnd(a, b) { return a + (b - a) * rng(); }
  function bind(inner) { I = inner; }

  /** 대치를 시작할 수 없는 때 */
  function barred(S) {
    var D = global.DG, FC = D.fieldCombat;
    if (D.stealth && D.stealth.crouched && D.stealth.crouched()) { return true; }
    if (D.mountCombat && D.mountCombat.riding && D.mountCombat.riding()) { return true; }
    if (FC && FC.autoOn && FC.autoOn()) { return true; }
    return !!S.duel;
  }
  function campOk(S, cp) {
    if (!cp || (cp.kind !== 'plain' && cp.kind !== 'elite')) { return false; }
    var k = String(cp.key); if (k.indexOf('dm:') === 0 || k.indexOf('sq:') === 0) { return false; }
    if ((cool[k] || 0) > now()) { return false; }
    var n = 0;
    for (var i = 0; i < cp.uids.length; i++) {
      var f = S.foes[cp.uids[i]]; if (!f || f.dead) { continue; }
      var F = I.FOES[f.kind] || {};
      if (F.boss || F.hero || F.guard || f.st !== 'idle' || f.hp < f.hpMax) { return false; }
      n++;
    }
    return n > 0;
  }
  function liveOf(S, cp) { return cp.uids.map(function (u) { return S.foes[u]; }).filter(function (f) { return f && !f.dead; }); }
  function nearest(S, list, px, py) { var b = null, bd = Infinity; list.forEach(function (f) { var d = Math.hypot(f.x - px, f.y - py); if (d < bd) { bd = d; b = f; } }); return b; }

  function begin(S, cp, px, py) {
    so = { key: cp.key, ax: px, ay: py, ph: 'wait', t: rnd(WAIT_MIN, WAIT_MAX), win: WIN, uid: 0, n: 0 };
    liveOf(S, cp).forEach(function (f) { f.so = true; });
    I.push(S, { t: 'standoff', x: px, y: py, camp: cp.key });
  }
  /** 대치 끝 — why: rash 성급 · miss 놓침 · leave 멀어짐 · bar 막힘 · done 다 벰 */
  function end(S, why) {
    if (!so) { return; }
    var cp = S.camps[so.key];
    if (cp) { liveOf(S, cp).forEach(function (f) { f.so = false; if (why !== 'done' && I.wake) { I.wake(f); } }); }
    cool[so.key] = now() + COOL * 1000;
    I.push(S, { t: 'soEnd', why: why, x: S.mx, y: S.my, n: so.n });
    so = null;
  }

  function step(S, dt, px, py) {
    if (!I || !on()) { if (so) { end(S, 'bar'); } return; }
    if (!so) {
      scanT -= dt; if (scanT > 0) { return; } scanT = SCAN;
      if (barred(S)) { return; }
      var r = aggroR() + BAND * KDV(), keys = Object.keys(S.camps);
      for (var i = 0; i < keys.length; i++) {
        var cp = S.camps[keys[i]];
        if (!campOk(S, cp)) { continue; }
        var f0 = nearest(S, liveOf(S, cp), px, py);
        if (f0 && Math.hypot(f0.x - px, f0.y - py) < r) { begin(S, cp, px, py); return; }
      }
      return;
    }
    var cp2 = S.camps[so.key], live = cp2 ? liveOf(S, cp2) : [];
    if (!live.length) { so = null; return; }
    if (barred(S)) { end(S, 'bar'); return; }
    if (Math.hypot(px - so.ax, py - so.ay) > LEAVE * KDV()) { end(S, 'leave'); return; }
    so.t -= dt;
    if (so.ph === 'lunge') {
      var lf = S.foes[so.uid];
      if (!lf || lf.dead) { so.ph = 'wait'; so.t = rnd(NEXT_MIN, NEXT_MAX); return; }
      var dx = px - lf.x, dy = py - lf.y, dl = Math.hypot(dx, dy) || 1, stop = STOP * KDV();
      if (dl > stop) { var mv = Math.min(dl - stop, (so.dist / so.win) * dt); lf.x += dx / dl * mv; lf.y += dy / dl * mv; lf.moving = true; }
      if (so.t <= 0) { if (I.hurt) { I.hurt(S, lf, 1); } end(S, 'miss'); }
    } else if (so.t <= 0) {
      if (so.ph === 'feint') { so.ph = 'wait'; so.t = rnd(NEXT_MIN, NEXT_MAX); return; }   // 움찔 끝 — 다시 노려봄
      var tg = nearest(S, live, px, py);
      if (rng() < FEINT) {
        so.ph = 'feint'; so.t = FEINT_T; I.push(S, { t: 'soFeint', uid: tg.uid, x: tg.x, y: tg.y });
      } else {
        so.ph = 'lunge'; so.t = so.win; so.uid = tg.uid; so.dist = Math.max(0, Math.hypot(tg.x - px, tg.y - py) - STOP * KDV());
        I.push(S, { t: 'soCue', uid: tg.uid, x: tg.x, y: tg.y });
      }
    }
  }

  /** 평타 첫머리 — 대치 중이면 여기서 결정. 한 칼이면 결과를 돌려주고(attack 은 거기서 끝), 아니면 null(평타 그대로) */
  function tryStrike(S, px, py) {
    if (!so || !I) { return null; }
    if (so.ph !== 'lunge') { I.push(S, { t: 'soRash', x: px, y: py }); end(S, 'rash'); return null; }
    var f = S.foes[so.uid], m = I.active(S);
    if (!f || f.dead || !m || m.down) { return null; }
    f.shield = 0; f.layers = []; f.so = false;
    I.hitFoe(S, f, m, f.hp * 10 + 1, null, 'standoff');
    so.n++;
    I.push(S, { t: 'soKill', uid: f.uid, x: f.x, y: f.y, n: so.n });
    var cp = S.camps[so.key], left = cp ? liveOf(S, cp).length : 0;
    if (!left) { end(S, 'done'); }
    else { so.ph = 'wait'; so.t = rnd(NEXT_MIN, NEXT_MAX); so.win *= WIN_MUL; so.uid = 0; }
    S.atkCd = 0.3;
    return { ok: true, standoff: true, n: so ? so.n : 0 };
  }

  /** handle 사건 — 글자·멈춤만(판정은 위에서 끝났다) */
  function onEv(e) {
    var FC = global.DG.fieldCombat, fl = FC && FC.floatNum, W = global.DG.world3d, w3 = W && W.active && W.active() ? W : null;
    if (!fl || !e) { return; }
    if (e.t === 'standoff') { fl(e.x, e.y + 1.4, '⚔ 대치', null, 1.4, true); }
    else if (e.t === 'soCue') { fl(e.x, e.y + 1.2, '!', null, 1.8, true); }
    else if (e.t === 'soFeint') { fl(e.x, e.y + 1.2, '…', null, 1.1, false); }
    else if (e.t === 'soKill') { fl(e.x, e.y + 1.4, e.n > 1 ? '일격! ×' + e.n : '일격!', null, 1.7, true); if (w3) { w3.hold(160); w3.shake(0.35); } }
    else if (e.t === 'soRash') { fl(e.x, e.y + 1.4, '성급했다!', null, 1.2, true); }
    else if (e.t === 'soEnd' && e.why === 'miss') { fl(e.x, e.y + 1.4, '놓쳤다', null, 1.0, false); }
  }

  global.DG = global.DG || {};
  global.DG.fieldStandoff = {
    BAND: BAND, WIN: WIN, WIN_MUL: WIN_MUL, FEINT: FEINT, LEAVE: LEAVE, COOL: COOL,
    bind: bind, step: step, tryStrike: tryStrike, onEv: onEv, state: function () { return so; },
    _rng: function (f) { rng = f || Math.random; }, _reset: function () { so = null; scanT = 0; cool = {}; rng = Math.random; }
  };
})(window);
