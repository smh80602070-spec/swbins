/**
 * 4종횡 룬 (W-0423 ③ · 정본 고돗 G-0382 — 메이플 룬은 구조만, 수치는 우리 것)
 * ---------------------------------------------------------------
 * 사냥터에 머무를 이유 하나 더:
 *   나타남  사냥터(비경·관문 대장 무대 빼고)에 SPAWN_MIN~MAX(90~180)초마다 룬(빛나는 돌 — 코드 도형)이
 *           주인공 앞 AHEAD(7m ≈ 224px) 바닥에 선다(한 번에 하나)
 *   풀기    닿으면 화살표 넷(←→↑↓)을 TIME(6)초 안에 차례로 — 키(방향키·WASD) 또는 화면 단추
 *   보상    다 맞히면 BUFF(600)초 경험치 ×2(메모리 — 세이브 안 함, 껐다 켜면 사라짐) · 틀리거나 시간이 다하면 흩어짐
 * 간격·화살표는 제 난수(굴린 횟수 해시)라 Math.random 흐름을 안 건드린다.
 * side.js update 맨 앞 tick(run, dt) · 처치 경험치 곱 expMul() · side-view drawPortals 줄 draw(ctx, camX, run). 손잡이 story.rune(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var SPAWN_MIN = 90, SPAWN_MAX = 180, AHEAD = 224, TIME = 6, LEN = 4, BUFF = 600, MUL = 2, TOUCH = 30;
  var DIRS = ['left', 'right', 'up', 'down'], ARROW = { left: '←', right: '→', up: '↑', down: '↓' };
  var KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
  var rolls = 0, buffLeft = 0, active = null, box = null;

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('story.rune', 1)); }
  function rnd() { rolls++; var h = Math.imul(rolls ^ 0x85ebca6b, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  function interval() { return SPAWN_MIN + rnd() * (SPAWN_MAX - SPAWN_MIN); }
  function allowed(run) { return !!(run && run.stage && !run.rift && !run.stage.gateArena && !run.stage.rift); }
  function toast(t) { var C = core(); if (C && C.emit) { C.emit('toast', t); } }

  /** 앞 7m 바닥에 세운다 */
  function spawn(run) {
    var p = run.player, w = (run.stage && run.stage.width) || 2000, f = p.facing < 0 ? -1 : 1;
    var x = Math.max(40, Math.min(w - 60, p.x + 13 + f * AHEAD));
    run.rune = { x: x, y: (run.stage && run.stage.floor) || p.y + 54, state: 'idle', seq: null, i: 0, t: 0, glow: 0 };
    return run.rune;
  }
  function start(run) {
    var r = run.rune; r.state = 'input'; r.i = 0; r.t = TIME;
    r.seq = []; for (var k = 0; k < LEN; k++) { r.seq.push(DIRS[Math.floor(rnd() * 4)]); }
    active = run; showBox(r); return r;
  }
  function end(run, ok) {
    var r = run.rune; run.rune = null; run.runeT = interval(); active = null; hideBox();
    if (ok) { buffLeft = BUFF; toast('🔷 룬 해방! ' + Math.round(BUFF / 60) + '분 동안 경험치 ×' + MUL); }
    else { toast('💨 룬이 흩어졌다'); }
    return ok;
  }
  /** 화살표 하나 — 맞으면 다음, 틀리면 흩어짐. 다 맞으면 true */
  function press(dir, run) {
    run = run || active; var r = run && run.rune; if (!r || r.state !== 'input') { return null; }
    if (r.seq[r.i] !== dir) { return end(run, false); }
    r.i++; if (r.i >= LEN) { return end(run, true); }
    showBox(r); return 'next';
  }

  /** 매 틱 — 버프 시간·나타남 시계·닿음·제한 시간 */
  function tick(run, dt) {
    if (buffLeft > 0) { buffLeft = Math.max(0, buffLeft - dt); }
    if (!run || !on() || !allowed(run)) { return; }
    if (!run.rune) {
      if (run.runeT == null) { run.runeT = interval(); }
      run.runeT -= dt; if (run.runeT <= 0) { spawn(run); }
      return;
    }
    var r = run.rune, p = run.player; r.glow += dt;
    if (r.state === 'idle' && Math.abs((p.x + 13) - r.x) < TOUCH && Math.abs((p.y + 54) - r.y) < 70) { start(run); }
    else if (r.state === 'input') { r.t -= dt; if (r.t <= 0) { end(run, false); } else { updTime(r); } }
  }
  function expMul() { return on() && buffLeft > 0 ? MUL : 1; }
  function left() { return buffLeft; }

  /** 캔버스 — 빛나는 마름모 돌 */
  function draw(ctx, camX, run) {
    var r = run && run.rune; if (!r || !ctx) { return; }
    var x = r.x - camX, y = r.y - 30 - Math.sin(r.glow * 3) * 4, s = 14;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(r.glow * 5);
    ctx.fillStyle = '#7fd4ff'; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = r.state === 'input' ? '#ffe680' : '#bfeaff'; ctx.strokeStyle = '#1a4a6a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.4); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* 화살표 창 — 방향키·WASD 는 잡아 두고(이동으로 안 새게), 폰은 단추 넷 */
  function showBox(r) {
    if (typeof document === 'undefined') { return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'rune-box';
      box.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:70;padding:12px 16px;border-radius:14px;background:rgba(12,24,40,.88);border:2px solid #7fd4ff;color:#fff;text-align:center;font:700 15px "Malgun Gothic",system-ui;';
      box.innerHTML = '<div>🔷 룬 — 화살표를 차례로 <span id="rune-t"></span></div><div id="rune-seq" style="font-size:34px;letter-spacing:10px;margin:6px 0"></div>' +
        '<div>' + DIRS.map(function (d) { return '<button type="button" data-rune="' + d + '" style="width:54px;height:54px;margin:3px;font-size:26px;border-radius:10px;border:1px solid #7fd4ff;background:#1d3a56;color:#fff">' + ARROW[d] + '</button>'; }).join('') + '</div>';
      box.addEventListener('pointerdown', function (e) { var b = e.target.closest && e.target.closest('[data-rune]'); if (b) { e.preventDefault(); e.stopPropagation(); press(b.getAttribute('data-rune')); } });
      document.body.appendChild(box);
    }
    box.style.display = '';
    box.querySelector('#rune-seq').innerHTML = r.seq.map(function (d, k) { return '<span style="color:' + (k < r.i ? '#7fffa0' : (k === r.i ? '#ffe680' : '#8aa')) + '">' + ARROW[d] + '</span>'; }).join('');
    updTime(r);
  }
  function updTime(r) { var t = box && box.querySelector('#rune-t'); if (t) { t.textContent = Math.ceil(r.t) + '초'; } }
  function hideBox() { if (box) { box.style.display = 'none'; } }
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (e) {
      if (!active || !active.rune || active.rune.state !== 'input') { return; }
      var d = KEYMAP[e.key]; if (!d) { return; }
      e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) { press(d); }
    }, true);
  }

  global.DG = global.DG || {};
  global.DG.rune = { SPAWN_MIN: SPAWN_MIN, SPAWN_MAX: SPAWN_MAX, AHEAD: AHEAD, TIME: TIME, BUFF: BUFF, MUL: MUL, spawn: spawn, start: start, press: press, tick: tick, expMul: expMul, left: left, draw: draw,
    _reset: function () { buffLeft = 0; active = null; hideBox(); } };
})(window);
