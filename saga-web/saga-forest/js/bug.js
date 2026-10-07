/**
 * 곤충 채집 — 원작의 큰 축
 * ---------------------------------------------------------------
 * 채집물(나무·바위·꽃)과 **성질이 다르다**. 사물은 제자리에 붙박여 하루 한 번을 내주지만,
 * 벌레는 **살아 움직이고 달아난다**. 그래서 사물 목록이 아니라 여기서 따로 관리한다.
 *
 * 원작의 규칙을 그대로 옮겼다.
 *
 *   1. **잠자리채가 없으면 못 잡는다** (전방에서 한 번 산다)
 *   2. **계절과 시간대를 탄다** — 반딧불이는 여름 밤에만 날고, 겨울엔 거의 없다
 *   3. **다가가는 것이 놀이다** — 경계 반경 안에서 성큼성큼 걸으면 달아난다.
 *      **살금살금(Shift · 🐾)** 걸으면 달아나지 않는다
 *   4. 나무에 붙는 것(매미·풍뎅이)은 움직이지 않는다. 대신 나무 곁에만 나온다
 *
 * 규칙만 맡는다 — 그리는 것은 village-view.js 다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var MAX = core.tuned('bug.max', 7);          // 한 번에 마을에 나와 있는 수
  var SPAWN_MIN = 190;         // 사람에게서 이만큼 떨어진 데서 나온다 (눈앞에 뿅 나오면 어색하다)
  var SPAWN_MAX = 430;
  var GONE = 760;              // 이만큼 멀어지면 조용히 사라진다
  var WARY = core.tuned('bug.wary', 58);       // 경계 반경 — 이 안에서 성큼 걸으면 달아난다
  var REACH = 34;              // 채를 휘두를 수 있는 거리
  var FLEE_MS = 1500;

  /* ── 말벌 ─────────────────────────────────────────────────
   * 나무를 흔들다 벌집을 건드리면 벌떼가 쏟아진다. 원작 그대로 **쫓아온다**.
   *   달아나면  일정 거리를 벌리거나 버티면 흩어진다
   *   맞서면    잠자리채로 받아칠 수 있다 (값이 좋다)
   *   쏘이면    그날 하루 걸음이 무거워진다
   */
  var CHASE_SPEED = 74;
  var CHASE_MS = core.tuned('bug.chaseMs', 6000);   // 이만큼 지나면 흩어진다
  var CHASE_GONE = 320;        // 이만큼 벌리면 흩어진다
  var STING_AT = 22;

  var bugs = [];
  var seq = 0;
  var acc = 0;
  var seeded = false;

  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }

  /* ── 이 파일만의 난수 ─────────────────────────────────────
   * **공용 Math.random 을 쓰지 않는다.** 여기는 프레임마다 도는 자리이고,
   * 헤드리스에서 프레임 수는 실행마다 다르다. 공용 흐름을 여기서 먹으면
   * 씨앗을 고정해 둔 자가진단이 실행마다 다른 수를 뽑는다.
   * (folk.js 도 같은 규칙이다 — 한 번 깨져 보고 정한 것이다.)
   */
  var rs = 20260826 >>> 0;

  function rnd() {
    rs = (rs + 0x6D2B79F5) >>> 0;
    var t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function reseed() {
    var st = V().state();
    rs = (((st.seed || 1) * 7919) ^ ((st.day || 0) * 40503)) >>> 0;
    seeded = true;
  }

  /* ── 지금 나오는 것 ───────────────────────────────────────
   * 계절과 시간대를 함께 본다. 겨울 밤이면 거미 하나만 남는다 — 원작 그대로 휑하다.
   */
  function poolNow() {
    var vd = VD();
    var se = vd.season().key;
    var ph = vd.phaseOf(new Date().getHours()).key;
    var wk = vd.weather().key;
    return vd.ITEMS.bug.filter(function (it) {
      /* 말벌은 저절로 나오지 않는다 — 나무를 흔들어야 만난다 */
      if (it.swarm) { return false; }
      return vd.inSeason(it, se) && vd.inPhase(it, ph) && vd.inWeather(it, wk);
    });
  }

  function pickKind() {
    var list = poolNow();
    if (!list.length) { return null; }
    var total = 0, i, CR = global.DG.craft, wt = function (it) { return CR ? CR.weight(it, 'net') : it.w; };   // 잠자리채 '희귀' 축(W-0103)
    for (i = 0; i < list.length; i++) { total += wt(list[i]); }
    var r = rnd() * total;
    for (i = 0; i < list.length; i++) {
      r -= wt(list[i]);
      if (r <= 0) { return list[i]; }
    }
    return list[0];
  }

  /* ── 나오기 ───────────────────────────────────────────── */

  /** 나무에 붙는 것은 나무 곁에만 나온다 */
  function treeNear(px, py) {
    var raw = V().raw(), out = [];
    for (var i = 0; i < raw.props.length; i++) {
      var pr = raw.props[i];
      if (pr.kind !== 'tree' && pr.kind !== 'pine') { continue; }
      var d = Math.hypot(pr.x - px, pr.y - py);
      if (d > SPAWN_MIN * 0.55 && d < SPAWN_MAX) { out.push(pr); }
    }
    return out.length ? out[Math.floor(rnd() * out.length)] : null;
  }

  function spawn() {
    var kind = pickKind();
    if (!kind) { return false; }
    var raw = V().raw(), p = raw.player;

    if (kind.perch === 'tree') {
      var tr = treeNear(p.x, p.y);
      if (!tr) { return false; }
      bugs.push({ id: 'b' + (seq++), key: kind.key, ref: kind,
                  x: tr.x + (rnd() - 0.5) * 14, y: tr.y - 26,
                  vx: 0, vy: 0, perch: true, state: 'idle', t: 0, wob: rnd() * 6 });
      return true;
    }

    for (var tries = 0; tries < 14; tries++) {
      var a = rnd() * Math.PI * 2;
      var r = SPAWN_MIN + rnd() * (SPAWN_MAX - SPAWN_MIN);
      var x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (!V().walkable(x, y)) { continue; }
      bugs.push({ id: 'b' + (seq++), key: kind.key, ref: kind,
                  x: x, y: y, vx: 0, vy: 0, perch: false, state: 'idle',
                  t: 0, wob: rnd() * 6, aim: null });
      return true;
    }
    return false;
  }

  /* ── 매 프레임 ────────────────────────────────────────── */

  function update(dt) {
    if (!seeded) { reseed(); }
    var raw = V().raw(), p = raw.player;
    var sneak = V().sneaking();
    var i, b, d;

    /* 사라질 것 먼저 걷어낸다 */
    for (i = bugs.length - 1; i >= 0; i--) {
      b = bugs[i];
      b.t += dt * 1000;
      if (b.state === 'flee' && b.t > FLEE_MS) { bugs.splice(i, 1); continue; }
      if (Math.hypot(b.x - p.x, b.y - p.y) > GONE) { bugs.splice(i, 1); }
    }

    /* 모자라면 채운다 — 한꺼번에 우르르 나오지 않게 조금씩 */
    acc += dt;
    if (acc > 1.6) {
      acc = 0;
      if (bugs.length < MAX) { spawn(); }
    }

    for (i = bugs.length - 1; i >= 0; i--) {
      b = bugs[i];
      if (!b.chase) { continue; }
      d = Math.hypot(b.x - p.x, b.y - p.y);
      if (b.t > CHASE_MS || d > CHASE_GONE) {       // 흩어진다
        bugs.splice(i, 1);
        core.emit('toast', '🐝 벌떼가 흩어졌다');
        continue;
      }
      if (d < STING_AT) {                            // 쏘인다
        bugs.splice(i, 1);
        sting();
        continue;
      }
      var ca = Math.atan2(p.y - b.y, p.x - b.x);
      b.x += Math.cos(ca) * CHASE_SPEED * dt;
      b.y += Math.sin(ca) * CHASE_SPEED * dt;
    }

    for (i = 0; i < bugs.length; i++) {
      b = bugs[i];
      if (b.chase) { continue; }
      d = Math.hypot(b.x - p.x, b.y - p.y);

      /* 달아남 — 경계 안에서 **성큼성큼 걸을 때만**. 살금이거나 멈춰 있으면 괜찮다 */
      if (b.state === 'idle' && d < WARY && p.walking && !sneak) {
        b.state = 'flee';
        b.t = 0;
        var aw = Math.atan2(b.y - p.y, b.x - p.x);
        b.vx = Math.cos(aw) * 190;
        b.vy = Math.sin(aw) * 190;
        core.emit('village:bug', { state: 'flee', ref: b.ref });
      }

      if (b.state === 'flee') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        continue;
      }
      if (b.perch) { continue; }              // 나무에 붙은 것은 움직이지 않는다

      /* 어슬렁 — 몇 초마다 갈 곳을 새로 고른다 */
      if (!b.aim || Math.hypot(b.aim.x - b.x, b.aim.y - b.y) < 8) {
        var a2 = rnd() * Math.PI * 2;
        var rr = 20 + rnd() * 70;
        b.aim = { x: b.x + Math.cos(a2) * rr, y: b.y + Math.sin(a2) * rr };
      }
      var dx = b.aim.x - b.x, dy = b.aim.y - b.y;
      var dl = Math.hypot(dx, dy) || 1;
      var sp = b.ref.form === 'dragonfly' ? 46 : b.ref.form === 'butterfly' ? 30 : 18;
      var nx = b.x + (dx / dl) * sp * dt;
      var ny = b.y + (dy / dl) * sp * dt;
      /* 나는 것은 물 위도 지난다. 기는 것은 땅만 */
      var flies = b.ref.form === 'butterfly' || b.ref.form === 'dragonfly' || b.ref.form === 'firefly';
      if (flies || V().walkable(nx, ny)) { b.x = nx; b.y = ny; }
      else { b.aim = null; }
    }
  }

  /** 벌집을 건드렸다 — 그 자리에서 벌떼가 쏟아진다 */
  function swarm(x, y) {
    var it = VD().item('wasp');
    var b = { id: 'w' + (seq++), key: 'wasp', ref: it, x: x, y: y - 10,
              vx: 0, vy: 0, perch: false, state: 'idle', chase: true,
              t: 0, wob: rnd() * 6, aim: null };
    bugs.push(b);
    core.emit('village:bug', { state: 'swarm', ref: it });
    return b;
  }

  /** 쏘였다 — 그날 하루 걸음이 무거워진다 (원작에선 얼굴이 붓는다) */
  function sting() {
    var s = V().state();
    if (s.stung === s.day) { return; }
    s.stung = s.day;
    core.log('🐝 벌에 쏘였다 — 오늘은 걸음이 무겁다', 'warn');
    core.emit('toast', '🐝 벌에 쏘였다!');
    core.emit('changed');
    core.persist();
  }

  function stung() {
    var s = V().state();
    return s.stung === s.day;
  }

  /* ── 잡기 ─────────────────────────────────────────────── */

  function hasNet() { return !!(V().state().tools && V().state().tools.net); }

  /** 채가 닿는 가장 가까운 벌레 (달아나는 중인 것은 못 잡는다) */
  function nearest(x, y) {
    var best = null, bd = REACH / (global.DG.craft ? global.DG.craft.perk('net').timeMul : 1);   // 잠자리채 '속도' 축 — 더 멀리서
    for (var i = 0; i < bugs.length; i++) {
      var b = bugs[i];
      if (b.state === 'flee') { continue; }
      var d = Math.hypot(b.x - x, b.y - y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  /** 휘두른다 */
  function swing(b) {
    if (!b) { return null; }
    if (!hasNet()) {
      return { kind: 'no', text: '🥅 잠자리채가 없습니다 — 전방에서 살 수 있습니다' };
    }
    var idx = bugs.indexOf(b);
    if (idx < 0) { return null; }
    bugs.splice(idx, 1);
    var it = VD().item(b.key);
    var nb = 1 + (global.DG.craft ? global.DG.craft.bonusN('net') : 0);   // 잠자리채 '수확' 축
    V().bagAdd(it, nb);
    core.gainFeat(2, '곤충');
    core.gainExp(10);
    core.log(it.emoji + ' ' + it.name + ' 을(를) 잡았다', 'good');
    core.emit('village:bug', { state: 'catch', ref: it });
    core.emit('changed');
    core.persist();
    return { kind: 'gather', text: it.emoji + ' ' + it.name + ' ×' + nb, item: it, n: nb };
  }

  /* ── 바깥에서 보는 것 ─────────────────────────────────── */

  function list() { return bugs; }
  function reset() { bugs = []; acc = 0; reseed(); }

  /** 지금 나오는 것 이름들 (도움말·진단용) */
  function nowNames() {
    return poolNow().map(function (it) { return it.name; });
  }

  global.DG = global.DG || {};
  global.DG.bug = {
    MAX: MAX, WARY: WARY, REACH: REACH,
    update: update, list: list, reset: reset,
    nearest: nearest, swing: swing, hasNet: hasNet,
    swarm: swarm, stung: stung,
    CHASE_MS: CHASE_MS, CHASE_GONE: CHASE_GONE,
    poolNow: poolNow, nowNames: nowNames,
    /** 자가진단용 — 한 마리를 그 자리에 세운다 */
    _spawnAt: function (key, x, y) {
      var it = VD().item(key);
      if (!it) { return null; }
      var b = { id: 'b' + (seq++), key: key, ref: it, x: x, y: y, vx: 0, vy: 0,
                perch: !!it.perch, state: 'idle', t: 0, wob: 0, aim: null };
      bugs.push(b);
      return b;
    }
  };
})(window);
