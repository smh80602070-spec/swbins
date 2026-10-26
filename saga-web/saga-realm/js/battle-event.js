/**
 * 5천하 격자 전투 중 이벤트 — 증원 · 원군 · 대사 (W-0458, 창세기전식 — 사용자 10-26 「랑그릿사나 창세기전 같은 턴 방식이고 잼나야함」)
 * ---------------------------------------------------------------
 *   증원   opts.events.reinforce = {turn, id, arms[], hp} — 그 턴이 열릴 때 적장 하나가 용병을 끌고 오른쪽 끝에 선다
 *   원군   opts.events.ally = {id, arms[], hp} — 3턴부터 내 쪽 체력이 45% 밑이면 한 번, 출진 안 한 장수가 왼쪽 끝에 온다
 *   대사   시작(적 대장 도발) · 적 대장 체력 절반 · 장수가 쓰러질 때 · 증원·원군 — b.evLog[{t, kind, who, side, text}]
 *   대본   opts.events.script(W-0459, data-battle-script.js) — 있으면 시작·턴·위기·격파·증원 줄을 그 장 대본으로(없는 칸은 위 공통 줄)
 * 판 규칙 층(tactics.js)이 한 줄씩 부른다(setup · turnStart · scan). three·DOM 없이 돈다(진단이 본다). 손잡이 rtk.battleEvent(1, 0 = 없음).
 *
 *   DG.battleEvent.setup(b, opts) · turnStart(b) · scan(b) · html(v, art, rerender)
 */
(function (global) {
  'use strict';
  function C() { return global.DG.core; }
  function T() { return global.DG.tactics; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('rtk.battleEvent', 1)); }

  var ALLY_TURN = 3, ALLY_HP = 0.45, SHOW_MS = 2000;
  var LINES = {
    start:   ['{f}: 「{m}, 여기가 너의 무덤이다!」', '{f}: 「겨우 그 병력으로 나를 막겠다고?」', '{f}: 「전군, 한 놈도 놓치지 마라!」', '{f}: 「길을 비켜라. 비키지 않으면 베고 지나간다!」'],
    reinforce: ['{r}: 「늦지 않았군 — {f} 님, 돕겠습니다!」', '{r}: 「뒤는 내가 맡는다. 몰아쳐라!」'],
    ally:    ['{a}: 「{m}! 원군이 왔다, 버텨라!」', '{a}: 「이 몸이 왔으니 이제 걱정 마시오!」'],
    low:     ['{f}: 「크윽… 이대로 물러설 순 없다!」', '{f}: 「제법이로군… 하지만 아직이다!」'],
    leaderDown: ['{f}: 「분하다… 여기까지인가…」'],
    foeDown: ['{x}: 「으윽… 물러나라…!」'],
    myDown:  ['{x}: 「주공… 먼저 가겠습니다…」', '{x}: 「뒤를… 부탁합니다…」']
  };
  function nameOf(id) { var O = global.DG.off, h = O && O.find ? O.find(id) : null; return h ? h.name : (id || '부대'); }
  function hashS(s) { var h = 2166136261, i; s = String(s); for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function pick(b, key, salt) { var L = LINES[key]; return L[hashS(b.seed + '|' + key + '|' + (salt || '')) % L.length]; }
  function fill(s, m) { return s.replace(/\{(\w)\}/g, function (_, k) { return m[k] || ''; }); }
  function lead(b, side) { var o = b.units.filter(function (u) { return u.side === side && u.kind === 'officer'; }); return side === 'foe' ? (o.filter(function (u) { return u.leader; })[0] || o[0]) : o[0]; }
  function say(b, kind, u, line, extra) {
    var m = { m: nameOf((lead(b, 'me') || {}).id), f: nameOf((lead(b, 'foe') || {}).id), x: u ? nameOf(u.id) : '' }, k;
    for (k in extra || {}) { if (Object.prototype.hasOwnProperty.call(extra, k)) { m[k] = extra[k]; } }
    (b.evLog = b.evLog || []).push({ t: b.turn, kind: kind, who: u ? u.uid : '', side: u ? u.side : '', text: fill(line, m) });
  }

  function setup(b, opts) {
    b.ev = null;
    if (!on() || !b.srpg) { return; }
    var e = (opts && opts.events) || {};
    b.ev = { reinforce: e.reinforce || null, ally: e.ally || null, script: e.script || null, seen: {} };
    var f = lead(b, 'foe');
    if (e.script && e.script.open) { lines(b, e.script.open, 'start'); }
    else if (f && f.id) { say(b, 'start', f, pick(b, 'start')); }
  }
  /** 대본 줄들 — [['f'|'m'|'n', 줄]…] · 'n' 은 줄 앞 「이름: 」 그대로(판 밖 사람, 초상 없음) */
  function lines(b, list, kind) {
    (list || []).forEach(function (l) {
      if (l[0] === 'n') { say(b, 'story', null, l[1]); return; }
      var u = lead(b, l[0] === 'm' ? 'me' : 'foe');
      if (u) { say(b, kind, u, (l[0] === 'm' ? '{m}' : '{f}') + ': ' + l[1]); }
    });
  }
  /** 끝 열에서 빈 칸 — 가운데 줄부터 */
  function edge(b, side) {
    var x0 = side === 'foe' ? b.cols - 1 : 0, dx = side === 'foe' ? -1 : 1, mid = Math.floor(b.rows / 2), i, k;
    for (i = 0; i < 3; i++) {
      for (k = 0; k < b.rows; k++) {
        var y = (mid + (k % 2 ? -1 : 1) * Math.ceil(k / 2) + b.rows) % b.rows, x = x0 + dx * i, c = T().cellAt(b, x, y);
        if (c && c !== 'river' && c !== 'wall' && c !== 'gate' && !b.units.some(function (u) { return u.hp > 0 && u.x === x && u.y === y; })) { return [x, y]; }
      }
    }
    return null;
  }
  function arrive(b, side, spec) {
    var p = edge(b, side);
    if (!p || !spec.id || b.units.some(function (u) { return u.id === spec.id && u.side === side; })) { return null; }
    var o = T().officerUnit(spec.id, side);
    o.x = p[0]; o.y = p[1]; o.fx = side === 'me' ? 1 : -1; o.fy = 0; o.arm = ''; o.moved = side === 'me'; o.acted = side === 'me'; o.arrived = b.turn;
    if (spec.cls && global.DG.realmClass) { var cm = {}; cm[spec.id] = spec.cls; b.units.push(o); global.DG.realmClass.apply(b, { cls: cm }); b.units.pop(); }
    b.units.push(o);
    var CM = global.DG.command;
    if (CM && CM.squad && b.command) { CM.squad(b, o, spec.arms || ['spear', 'bow'], spec.hp || 30).forEach(function (m) { m.moved = side === 'me'; m.acted = side === 'me'; }); }
    return o;
  }
  function frac(b, side) { var n = 0, m = 0; b.units.forEach(function (u) { if (u.side === side) { n += Math.max(0, u.hp); m += u.max; } }); return m ? n / m : 0; }
  /** 턴이 열릴 때(aiTurn 끝) — 증원·원군 */
  function turnStart(b) {
    var E = b.ev;
    if (!E || b.done) { return; }
    if (E.reinforce && !E.seen.reinforce && b.turn >= E.reinforce.turn) {
      E.seen.reinforce = 1;
      var r = arrive(b, 'foe', E.reinforce);
      if (r) { say(b, 'reinforce', r, E.script && E.script.reinf ? '{r}: ' + E.script.reinf : pick(b, 'reinforce'), { r: nameOf(r.id) }); }
    }
    if (E.ally && !E.seen.ally && b.turn >= ALLY_TURN && frac(b, 'me') < ALLY_HP) {
      E.seen.ally = 1;
      var a = arrive(b, 'me', E.ally);
      if (a) { a.moved = false; a.acted = false; b.units.forEach(function (m) { if (m.cmd === a.uid) { m.moved = false; m.acted = false; } }); say(b, 'ally', a, pick(b, 'ally'), { a: nameOf(a.id) }); }
    }
    if (E.script && E.script.turns && E.script.turns[b.turn] && !E.seen['t' + b.turn]) { E.seen['t' + b.turn] = 1; lines(b, E.script.turns[b.turn], 'talk'); }   // 그 턴 대본
  }
  /** check 앞 — 대장 절반·장수 쓰러짐 대사(한 번씩) */
  function scan(b) {
    var E = b.ev;
    if (!E) { return; }
    b.units.forEach(function (u) {
      if (u.kind !== 'officer' || !u.id) { return; }
      var k = u.uid;
      var sc = E.script || {};
      if (u.hp <= 0 && !E.seen['d' + k]) { E.seen['d' + k] = 1; say(b, u.side === 'me' ? 'myDown' : (u.leader ? 'leaderDown' : 'foeDown'), u, u.leader && sc.down ? '{x}: ' + sc.down : pick(b, u.side === 'me' ? 'myDown' : (u.leader ? 'leaderDown' : 'foeDown'), k)); }
      else if (u.leader && u.hp > 0 && u.hp < u.max / 2 && !E.seen['l' + k]) { E.seen['l' + k] = 1; say(b, 'low', u, sc.low ? '{x}: ' + sc.low : pick(b, 'low')); }
    });
  }

  /* ── 화면 — 대사 상자(초상·이름·줄), 쌓인 줄을 차례로 SHOW_MS 씩. v.evHold(ms) = 촬영용 멈춤 ── */
  var css = false;
  function cssOnce() {
    if (css || !global.document) { return; }
    css = true;
    var st = global.document.createElement('style');
    st.textContent = '.bev{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:25;pointer-events:none;display:flex;align-items:center;gap:12px;max-width:min(92%,640px);padding:10px 18px 10px 10px;border-radius:14px;background:linear-gradient(180deg,#1b1209f2,#0d0905f2);border:2px solid #c9a35a;box-shadow:0 6px 24px #000a;animation:bevIn .25s ease-out both}' +
      '.bev.foe{border-color:#d8664f}.bev.me{border-color:#5fa8ff}.bev.alert{border-color:#ffd54a;background:linear-gradient(180deg,#3a2306f2,#1a0f03f2)}' +
      '.bev img{width:64px;height:64px;border-radius:10px;object-fit:cover;background:#222}.bev b{display:block;font:800 13px/1.3 sans-serif;color:#ffe27a;margin-bottom:2px}.bev span{font:600 16px/1.45 serif;color:#fff}' +
      '@keyframes bevIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}';
    global.document.head.appendChild(st);
  }
  var TAG = { reinforce: '⚠ 적 증원!', ally: '🚩 원군 도착!', leaderDown: '👑 적 대장 격파', start: '⚔ 전투 개시' };
  function html(v, art, rerender) {
    var L = v.b.evLog || [];
    if (v.evN == null) { v.evN = 0; }
    var c = v.evCur, now = Date.now();
    if ((!c || now - c.at > SHOW_MS) && v.evN < L.length) { c = v.evCur = { e: L[v.evN++], at: now }; [400, SHOW_MS + 30].forEach(function (ms) { global.setTimeout(rerender, ms); }); }
    var el = !c ? 0 : v.evHold != null ? v.evHold : now - c.at;
    if (!c || el > SHOW_MS) { return ''; }
    cssOnce();
    var u = c.e.who ? T().unit(v.b, c.e.who) : null, src = u ? art(u) : '', i = c.e.text.indexOf(': '), who = i > 0 ? c.e.text.slice(0, i) : '', line = i > 0 ? c.e.text.slice(i + 2) : c.e.text;
    var alert = c.e.kind === 'reinforce' || c.e.kind === 'ally';
    return '<div class="bev ' + (alert ? 'alert' : (c.e.side || '')) + '">' + (src ? '<img src="' + String(src).replace(/"/g, '&quot;') + '" alt="">' : '') + '<div><b>' + (TAG[c.e.kind] ? TAG[c.e.kind] + ' · ' : '') + who + '</b><span>' + line + '</span></div></div>';
  }

  global.DG = global.DG || {};
  global.DG.battleEvent = { on: on, LINES: LINES, ALLY_TURN: ALLY_TURN, ALLY_HP: ALLY_HP, setup: setup, turnStart: turnStart, scan: scan, html: html };
})(typeof window !== 'undefined' ? window : this);
