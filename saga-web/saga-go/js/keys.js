/**
 * 1만리 조작 한 벌 (W-0174) — 흩어진 손맛 조작을 한 곳에 모은다
 * ---------------------------------------------------------------
 * 수신함 10-11 "조작이 답답함" — 들 대상·역참·성채는 만나는 키가 없어 누르고(46m 밖이면 걸어가서) 또 눌러야 했고,
 * 터치는 못 달리고 3D 카메라는 끌어야만 돌았다. 큰 파일(world·ui·story)의 줄 수를 안 늘리려고 여기 둔다.
 *
 *   F 만나기          말 걸 사람(story)·흔적(track)·낚시 자리(fishing)가 가까이 없을 때만 — 46m 안 가장 가까운
 *                     들 대상·역참·성채를 연다. 그쪽 F 를 빼앗지 않게 **capture** 로 먼저 보고 물러난다
 *   걸어가서 만나기   지도에서 46m 밖 대상을 누르면 `world.onClick` 이 'walk:meet' 를 쏜다 — 그 걸음이 이어지는 동안
 *                     46m 안에 들면 다시 안 눌러도 연다. 다른 데를 누르거나(새 walkTo) 키로 움직이면 풀린다
 *   D-패드 두 번 톡   달리기(×2.2, Shift 와 같다). 조이스틱은 ui 가 85% 넘게 밀면 스스로 run 을 넣는다
 *   카메라 따라 돌기  3D 에서 움직이는 중 + 1.5초 동안 안 끌었으면 진행 방향 뒤로 초당 90° 까지(손잡이 world.camFollow,
 *                     ⚙️ 설정에서 끈다). 카메라 쪽으로 걸어오는 중(135° 넘게)엔 안 돈다 — 뱅뱅 도는 것을 막는다
 *
 * 판정(만남·싸움)은 한 자도 안 바꾼다 — 버튼이 쏘던 'encounter:request'·'station:request'·'fort:request' 를 그대로 쏜다.
 */
(function (global) {
  'use strict';

  function C() { return global.DG.core; }
  function W() { return global.DG.world; }
  function tuned(k, d) { var c = C(); return c && c.tuned ? c.tuned(k, d) : d; }
  function pos() { return C().save.player.pos; }
  var emit = function (ev, it) { C().emit(ev, it); };

  /* ── F 만나기 ─────────────────────────────────────────── */

  /** F 를 다른 쪽(이야기·흔적·낚시·창)이 쓰는 중인가 — 그럼 물러난다 */
  function fTaken() {
    var D = global.DG, p = pos(), b = global.document && document.body;
    if (b && b.classList.contains('sheet-open')) { return true; }
    if (W().inputBlocked && W().inputBlocked()) { return true; }
    if (D.rogueAction && D.rogueAction.active) { return true; }
    var ST = D.story;
    if (ST && ((ST.talking && ST.talking()) || (ST.nearTalk && ST.nearTalk()))) { return true; }
    var FI = D.fishing;
    if (FI && (FI.active || (FI.nearBoard && FI.nearBoard(p.x, p.y)) || (FI.nearSpot && FI.nearSpot(p.x, p.y)))) { return true; }
    var TK = D.track;
    if (TK && TK.on && TK.on() && TK.nearestUnread && TK.nearestUnread(p, TK.READ_R)) { return true; }
    return false;
  }

  /** 46m 안 가장 가까운 들 대상·역참·성채 — { ev, it, dist } 또는 null */
  function meetTarget() {
    var w = W(), best = null;
    function take(ev, it, d, inRange) { if (it && inRange && (!best || d < best.dist)) { best = { ev: ev, it: it, dist: d }; } }
    var n = w.nearest && w.nearest(), ns = w.nearestStation && w.nearestStation(), nf = w.nearestFort && w.nearestFort();
    if (n) { take('encounter:request', n.spawn, n.dist, n.inRange); }
    if (ns) { take('station:request', ns.station, ns.dist, ns.inRange); }
    if (nf) { take('fort:request', nf.fort, nf.dist, nf.inRange); }
    return best;
  }

  /** F 한 번 — 연 것의 이벤트 이름, 아무 일 없으면 null */
  function pressF() {
    if (fTaken()) { return null; }
    var t = meetTarget();
    if (!t) { return null; }
    pend = null;
    emit(t.ev, t.it);
    return t.ev;
  }

  /* ── 걸어가서 만나기 ──────────────────────────────────── */

  var pend = null;   // { ev, it, ref } — ref 는 그때의 walkTarget 객체(바뀌면 풀린다)

  function walkMeet(ev, it) {
    pend = it ? { ev: ev, it: it, ref: W().walkingTo ? W().walkingTo() : null } : null;
    return pend;
  }
  /** 매 틱 — 닿았으면 연 이벤트 이름, 아니면 null */
  function poll() {
    if (!pend) { return null; }
    var w = W();
    if (!w.walkingTo || w.walkingTo() !== pend.ref) { pend = null; return null; }        // 다른 데를 눌렀거나 직접 움직였다
    if (pend.ev === 'encounter:request' && w.spawns && w.spawns.indexOf(pend.it) < 0) { pend = null; return null; }   // 사라졌다
    if (w.inputBlocked && w.inputBlocked()) { return null; }
    var p = pos();
    if (Math.hypot(pend.it.x - p.x, pend.it.y - p.y) > w.ENCOUNTER_RANGE) { return null; }
    var hit = pend;
    pend = null;
    w.walkTo(p.x, p.y);                                                                   // 그 자리에 선다(창이 닫힌 뒤 마저 걷지 않게)
    emit(hit.ev, hit.it);
    return hit.ev;
  }

  /* ── D-패드 두 번 톡 = 달리기 ─────────────────────────── */

  var DOUBLE_MS = 320, JOY_RUN = 0.85, pad = { run: false, last: {}, down: 0, bound: false };
  /** 조이스틱 — 반지름 R 의 85% 넘게 밀었으면 달린다(ui 조이스틱이 부른다) */
  function joyRun(len, R) { return len > R * JOY_RUN; }
  function padTap(dir, now) {
    var t = now === undefined ? Date.now() : now;
    if (t - (pad.last[dir] || -1e9) <= DOUBLE_MS) { pad.run = true; }
    else if (!pad.down) { pad.run = false; }          // 다른 단추를 쥔 채 새로 누르면 달리기를 이어 간다
    pad.last[dir] = t;
    pad.down++;
    return pad.run;
  }
  function padUp() { pad.down = Math.max(0, pad.down - 1); if (!pad.down) { pad.run = false; } }
  function bindPad() {
    if (pad.bound || !global.document) { return; }
    var el = document.getElementById('gpad');
    if (!el) { return; }
    pad.bound = true;
    /* capture — ui 의 단추 손잡이(apply → setStick)보다 먼저 run 을 정한다 */
    el.addEventListener('pointerdown', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-dir]');
      if (b) { padTap(b.getAttribute('data-dir')); }
    }, true);
    ['pointerup', 'pointercancel'].forEach(function (k) {
      el.addEventListener(k, function (e) { if (e.target && e.target.closest && e.target.closest('[data-dir]')) { padUp(); } }, true);
    });
  }

  /* ── 카메라 따라 돌기 ─────────────────────────────────── */

  var FOLLOW_IDLE = 1.5, FOLLOW_RATE = Math.PI / 2, FOLLOW_BACK = Math.PI * 0.75;
  var cam = { dragAt: -1e9, yaw: null, last: null, t: 0 };
  function followOn() {
    var st = C().save && C().save.settings;
    return !!tuned('world.camFollow', 1) && !(st && st.camFollow === false);
  }
  function wrap(a) { while (a > Math.PI) { a -= Math.PI * 2; } while (a < -Math.PI) { a += Math.PI * 2; } return a; }
  /**
   * 순수 — 지금 yaw·이동(mx,my)·dt 에서 이번 틱에 돌릴 각. 진행 방향 = 화면 앞(W 키가 가는 쪽)이 되는 yaw 는
   * atan2(mx, −my) 다(world.camRot 과 같은 회전). 멀수록 빨리, 그래도 초당 90° 까지
   */
  function followStep(yaw, mx, my, dt) {
    var l = Math.hypot(mx, my);
    if (!l || dt <= 0) { return 0; }
    var d = wrap(Math.atan2(mx, -my) - yaw);
    if (Math.abs(d) > FOLLOW_BACK) { return 0; }
    var max = FOLLOW_RATE * dt;
    return Math.max(-max, Math.min(max, d));
  }
  function camTick(dt) {
    var W3 = global.DG.world3d, p = pos();
    cam.t += dt;
    if (!W3 || !W3.active || !W3.active() || !W3.yaw || !W3.turn) { cam.last = null; cam.yaw = null; return 0; }
    var y = W3.yaw();
    if (cam.yaw !== null && Math.abs(wrap(y - cam.yaw)) > 1e-4) { cam.dragAt = cam.t; }   // 우리 말고 누가(끌기) 돌렸다
    cam.yaw = y;
    var last = cam.last;
    cam.last = { x: p.x, y: p.y };
    if (!last || !followOn() || cam.t - cam.dragAt < FOLLOW_IDLE) { return 0; }
    var D = global.DG;
    if ((W().inputBlocked && W().inputBlocked()) || (D.rogueAction && D.rogueAction.active) || (W3.inBattle && W3.inBattle())) { return 0; }
    var mx = p.x - last.x, my = p.y - last.y, l = Math.hypot(mx, my);
    if (l < 0.4 * dt || l > 30) { return 0; }                      // 거의 섰거나 순간이동
    var step = followStep(y, mx, my, dt);
    if (step) { cam.yaw = W3.turn(step); }
    return step;
  }

  /* ── ⚙️ 설정 한 줄 — bgm.settingsHtml 뒤에 덧붙인다(voice.js 와 같은 길) ── */
  function rowHtml() {
    return '<div class="key-row" data-camf-box><b>카메라 따라 돌기</b><button data-camf="toggle">' + (followOn() ? '켜짐' : '꺼짐') + '</button></div>';
  }
  function wrapSettings() {
    var B = global.DG.bgm;
    if (!B || !B.settingsHtml || B.settingsHtml.__camf) { return; }
    var orig = B.settingsHtml, w = function () { return orig() + rowHtml(); };
    for (var k in orig) { if (Object.prototype.hasOwnProperty.call(orig, k)) { w[k] = orig[k]; } }   // voice 표식(__voice) 등을 잃지 않게
    w.__camf = true; B.settingsHtml = w;
    if (global.document && document.addEventListener) {
      document.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest && ev.target.closest('[data-camf="toggle"]');
        if (!b) { return; }
        var s = C().save;
        s.settings = s.settings || {};
        s.settings.camFollow = !followOn();
        C().persist();
        b.textContent = followOn() ? '켜짐' : '꺼짐';
      }, true);
    }
  }

  /* ── 묶기 ─────────────────────────────────────────────── */

  var bound = false;
  function bind() {
    if (bound || !global.addEventListener) { return; }
    bound = true;
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (e.repeat || e.ctrlKey || e.metaKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      if ((e.key || '').toLowerCase() !== 'f') { return; }
      if (pressF()) { e.preventDefault(); }
    }, true);
    C().on('walk:meet', function (p) { if (p) { walkMeet(p.ev, p.it); } });
    wrapSettings();
  }

  function tick(dt) {
    if (!C() || !C().save || !W()) { return; }
    bind();
    bindPad();
    poll();
    camTick(dt || 0);
  }

  global.DG = global.DG || {};
  global.DG.keys = {
    DOUBLE_MS: DOUBLE_MS, FOLLOW_IDLE: FOLLOW_IDLE, FOLLOW_RATE: FOLLOW_RATE, FOLLOW_BACK: FOLLOW_BACK,
    fTaken: fTaken, meetTarget: meetTarget, pressF: pressF, walkMeet: walkMeet, poll: poll,
    JOY_RUN: JOY_RUN, joyRun: joyRun, padTap: padTap, padUp: padUp, padRun: function () { return pad.run; },
    followOn: followOn, followStep: followStep, camTick: camTick, rowHtml: rowHtml, tick: tick,
    pending: function () { return pend; },
    /** 진단 전용 — 쏘는 길을 바꿔 끼운다(창을 실제로 안 열고 무엇을 열려 했는지만 본다). 인자 없으면 되돌린다 */
    _setEmit: function (fn) { emit = fn || function (ev, it) { C().emit(ev, it); }; },
    _resetForTest: function () { pend = null; pad.run = false; pad.last = {}; pad.down = 0; cam.dragAt = -1e9; cam.yaw = null; cam.last = null; cam.t = 0; }
  };
})(window);
