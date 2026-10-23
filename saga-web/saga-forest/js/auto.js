/**
 * 자동 마을살이 — 대신 돌아다니며 모으고 나눠 준다
 * ---------------------------------------------------------------
 * 다른 게임의 auto.js 와 같은 원칙이다: **규칙을 새로 만들지 않는다.**
 * village.js 의 공개 함수(walkTo · interact · sellAll)만 부른다.
 * 그래서 손으로 할 때와 얻는 것이 어긋나지 않는다.
 *
 * 고르는 순서
 *   1) 부탁을 채운 주민   — 건네주면 금·친밀도가 가장 크다
 *   2) 아직 여문 사물     — 가까운 것부터 (낚시터는 몇 번이든 되니 조금 낮춰 본다)
 *   3) 아무것도 없으면    — 전방에 팔고 다음 날을 기다린다

 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var FLAGS = [
    { key: 'gather', name: '채집', emoji: '🌳', desc: '아직 여문 나무·바위·꽃·물가를 돈다' },
    { key: 'errand', name: '심부름', emoji: '🤝', desc: '부탁을 채운 주민에게 건네준다' },
    { key: 'bug', name: '곤충', emoji: '🦋', desc: '잠자리채가 있으면 살금살금 다가가 잡는다' },
    { key: 'sell', name: '전방에 팔기', emoji: '🪙', desc: '부탁 몫만 남기고 판다' },
  ];

  var DEFAULTS = { on: false, gather: true, errand: true, bug: true, sell: true };

  var acc = { aim: 0, act: 0, sell: 0 };
  var aim = null;                 // 지금 향하는 것
  /* 못 닿는 것 건너뛰기(W-0383) — 4초 동안 20 도 못 다가서면(손 닿는 거리 밖에서) 그것을 2분 안 노린다.
     물가 조개처럼 걸을 수 없는 자리에 선 것을 10분 내내 노렸다. 저장 안 함 */
  var skip = [], watch = { o: null, best: 0, t: 0 };
  function skipped(o) { var now = Date.now(); for (var i = skip.length - 1; i >= 0; i--) { if (skip[i].until < now) { skip.splice(i, 1); } else if (skip[i].o === o) { return true; } } return false; }
  var doing = '';
  var lastLog = 0;

  function st() {
    var s = core.save, k;
    if (!s.auto) { s.auto = {}; }
    for (k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) && s.auto[k] === undefined) {
        s.auto[k] = DEFAULTS[k];
      }
    }
    return s.auto;
  }

  function on(flag) { return !!st()[flag]; }
  function active() { return !!st().on; }

  function flagByKey(k) {
    for (var i = 0; i < FLAGS.length; i++) { if (FLAGS[i].key === k) { return FLAGS[i]; } }
    return null;
  }

  function setOn(v) {
    var s = st();
    v = !!v;
    if (s.on === v) { return v; }
    s.on = v;
    aim = null;
    global.DG.village.setAutoSneak(false);
    doing = v ? '갈 곳을 고르는 중…' : '';
    core.log(v ? '🤖 자동 마을살이를 켰다' : '🤖 자동 마을살이를 껐다', 'info');
    core.emit('toast', v ? '🤖 자동 마을살이 시작' : '⏸️ 자동 마을살이 정지');
    core.emit('changed');
    core.persist();
    return v;
  }

  function toggle() { return setOn(!st().on); }

  function toggleFlag(key) {
    if (!flagByKey(key)) { return false; }
    var s = st();
    s[key] = !s[key];
    core.emit('changed');
    core.persist();
    return !!s[key];
  }

  /* ── 목표 고르기 ──────────────────────────────────────── */

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  /** 곧게 갈 수 있나 — 20 단위마다 walkable */
  function clearLine(V, a, b) {
    var d = dist(a, b), n = Math.ceil(d / 20);
    for (var i = 1; i < n; i++) { if (!V.walkable(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) { return false; } }
    return true;
  }
  /** 타일 너비 우선 길찾기(W-0383) — 걷기는 직선뿐이라 물·건물 너머 주민에게 가던 길이 500 앞에서 4분 섰다.
      p→g 를 감싼 상자(+pad 타일)에서 walkable 타일만 8방(모서리 깎기 금지), 다음에 곧게 갈 수 있는 가장 먼 경유점 · 못 찾으면 null */
  function nextStep(V, p, g, T, pad) {
    T = T || 40; pad = pad == null ? 12 : pad;
    var x0 = Math.floor(Math.min(p.x, g.x) / T) - pad, y0 = Math.floor(Math.min(p.y, g.y) / T) - pad;
    var W = Math.floor(Math.max(p.x, g.x) / T) + pad - x0 + 1, H = Math.floor(Math.max(p.y, g.y) / T) + pad - y0 + 1;
    if (W * H > 12000) { return null; }
    var idx = function (x, y) { return (Math.floor(y / T) - y0) * W + (Math.floor(x / T) - x0); };
    var s = idx(p.x, p.y), t = idx(g.x, g.y), from = new Int32Array(W * H).fill(-2), ok = new Int8Array(W * H), q = [s], qi = 0;
    var cen = function (i) { return { x: (i % W + x0 + 0.5) * T, y: (Math.floor(i / W) + y0 + 0.5) * T }; };
    var walk = function (i) { if (!ok[i]) { var c = cen(i); ok[i] = V.walkable(c.x, c.y) ? 1 : 2; } return ok[i] === 1; };
    from[s] = -1;
    while (qi < q.length) {
      var c = q[qi++];
      if (c === t) { break; }
      var ix = c % W, iy = (c - ix) / W;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var nx = ix + dx, ny = iy + dy, n = ny * W + nx;
          if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H || from[n] !== -2) { continue; }
          if (n !== t && !walk(n)) { continue; }
          if (dx && dy && (!walk(iy * W + nx) || !walk(ny * W + ix))) { continue; }
          from[n] = c; q.push(n);
        }
      }
    }
    if (from[t] === -2) { return null; }
    var cells = [];
    for (var k = t; k !== s && k >= 0; k = from[k]) { cells.unshift(k); }
    var pick = cells.length ? cen(cells[0]) : { x: g.x, y: g.y };
    for (var j = cells.length - 1; j >= 0; j--) { var w = j === cells.length - 1 ? g : cen(cells[j]); if (clearLine(V, p, w)) { pick = w; break; } }
    return pick;
  }
  /** 그리로 걷는다 — 곧게 못 가면 길찾기 경유점으로 */
  function goTo(V, raw, x, y) {
    var g = { x: x, y: y }, p = raw.player;
    if (!V.walkable || clearLine(V, p, g)) { V.walkTo(x, y); return; }
    var w = nextStep(V, p, g, V.TILE);
    V.walkTo(w ? w.x : x, w ? w.y : y);
  }

  /** 부탁을 채운 주민 (건네줄 수 있는 사람) */
  function readyResident(raw) {
    var V = global.DG.village;
    var best = null, bd = 1e9;
    for (var i = 0; i < raw.residents.length; i++) {
      var res = raw.residents[i];
      var req = V.requestOf(res.id);
      if (req.done || skipped(res)) { continue; }
      if (V.bagCount(req.want) < req.n) { continue; }
      var d = dist(res, raw.player);
      if (d < bd) { bd = d; best = res; }
    }
    return best ? { type: 'resident', obj: best, dist: bd } : null;
  }

  /** 아직 여문 사물 중 가까운 것 */
  function freshProp(raw) {
    var V = global.DG.village, VD = global.DG.villageData;
    var best = null, bs = -1e9;
    for (var i = 0; i < raw.props.length; i++) {
      var pr = raw.props[i];
      var def = VD.PROPS[pr.kind];
      if (!def || !def.gather) { continue; }
      if (pr.deco || skipped(pr)) { continue; }    // 숲 고리 장식(PLAN 40절 PHASE 3) — 자동도 안 노린다
      if (V.spent(pr)) { continue; }
      /* 도구가 없어 손을 못 대는 것은 목표로 삼지 않는다.
         삽 없이 갈라진 자리로 걸어가 아무것도 못 하고 다시 그리로 가는
         무한 되돌이에 빠진 적이 있다 */
      if (def.tool && !V.hasTool(def.tool)) { continue; }
      var d = dist(pr, raw.player);
      /* 가까운 것 우선. 낚시터는 계속 되니 조금 뒤로 미룬다(다른 걸 놓치지 않게) */
      var score = -d - (def.reset ? 0 : 240);
      if (score > bs) { bs = score; best = pr; }
    }
    return best ? { type: 'prop', obj: best, dist: dist(best, raw.player) } : null;
  }

  /**
   * 가까운 벌레 — 잠자리채가 있을 때만 본다.
   * 벌레는 **사라진다.** 그러니 사물보다 앞에 두되, 건네줄 부탁보다는 뒤다.
   */
  function nearBug(raw) {
    var B = global.DG.bug;
    if (!B || !B.hasNet()) { return null; }
    var list = B.list(), best = null, bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      if (list[i].state === 'flee' || skipped(list[i])) { continue; }
      var d = dist(list[i], raw.player);
      if (d < bd) { bd = d; best = list[i]; }
    }
    return best ? { type: 'bug', obj: best, dist: bd } : null;
  }

  /* ── 매 프레임 ────────────────────────────────────────── */

  function update(dt) {
    if (!active()) { return; }
    var V = global.DG.village;
    /* 집 안에서는 아무것도 하지 않는다 — 꾸미기는 손으로 하는 놀이다 */
    if (V.indoors() || V.caveInside()) { doing = '🏠 집(동굴) 안에서는 쉽니다'; V.setAutoSneak(false); return; }
    var raw = V.raw();

    /* 낚시 중이면 그것부터 — 입질을 기다렸다 당긴다.
       규칙을 새로 만들지 않는다: 손으로 할 때와 같은 interact() 를 같은 타이밍에 부른다.
       (매 프레임 본다 — 입질 창이 0.7초라 0.5초 간격으로 보면 놓칠 수 있다) */
    var fs = V.fishState();
    if (fs) {
      if (fs.state === 'bite') {
        V.interact();
      } else if (fs.state === 'late') {
        V.interact();                     // 이미 늦었다 — 줄을 거둔다
      }
      doing = fs.state === 'bite' ? '🎣 입질! 당긴다' : '🎣 입질을 기다린다';
      return;
    }

    /* 0.4초마다 목표를 다시 고른다 (날이 바뀌면 여문 것이 늘어난다) */
    acc.aim += dt;
    if (acc.aim >= 0.4) {
      acc.aim = 0;
      var pick = (on('errand') ? readyResident(raw) : null) ||
                 (on('bug') ? nearBug(raw) : null) ||
                 (on('gather') ? freshProp(raw) : null);
      aim = pick;
      if (aim) {
        if (watch.o !== aim.obj || aim.dist < watch.best - 20) { watch.o = aim.obj; watch.best = aim.dist; watch.t = 0; }
        else if (aim.dist > (V.REACH || 60) * 1.5 && (watch.t += 0.4) >= 4) { skip.push({ o: aim.obj, until: Date.now() + 120000 }); watch.o = null; aim = null; doing = '🤖 닿을 수 없어 2분 미룸'; return; }
        else if (aim.dist <= (V.REACH || 60) * 1.5) { watch.t = 0; }
        goTo(V, raw, aim.obj.x, aim.obj.y + 6);
        var VD = global.DG.villageData;
        doing = aim.type === 'resident'
          ? '🤝 ' + aim.obj.ref.name + ' 에게 (' + Math.round(aim.dist) + ')'
          : aim.type === 'bug'
          ? '🐾 ' + aim.obj.ref.name + ' 에게 살금살금 (' + Math.round(aim.dist) + ')'
          : '🌳 ' + VD.PROPS[aim.obj.kind].name + ' 으로 (' + Math.round(aim.dist) + ')';
      } else {
        doing = '🛏️ 오늘 할 일을 마쳤습니다 — 날이 바뀌면 다시 여뭅니다';
      }
    }

    /* 벌레를 노릴 때는 **살금살금** 걷는다. 안 그러면 다가가는 족족 달아난다 —
       손으로 할 때와 같은 규칙을 자동도 그대로 탄다 */
    V.setAutoSneak(!!(aim && aim.type === 'bug' &&
                      dist(aim.obj, raw.player) < global.DG.bug.WARY * 1.5));

    /* 손이 닿으면 쓴다 — 규칙은 village.interact() 그대로 */
    acc.act += dt;
    if (acc.act >= 0.5) {
      acc.act = 0;
      var f = V.focus();
      if (f && aim && f.obj === aim.obj) {
        var r = V.interact();
        if (r && r.kind === 'open') { /* 건물은 자동으로 열지 않는다 */ }
      }
    }

    if (on('sell')) {
      acc.sell += dt;
      if (acc.sell >= 20) {
        acc.sell = 0;
        var got = V.sellAll();
        if (got && Date.now() - lastLog > 30000) {
          lastLog = Date.now();
          core.log('🪙 모은 것을 전방에 팔았다 (+' + core.fmt(got) + ')', 'info');
        }
      }
    }

  }

  function status() {
    return { on: active(), doing: doing, flags: st(), aim: aim };
  }

  global.DG = global.DG || {};
  global.DG.auto = {
    FLAGS: FLAGS, flagByKey: flagByKey,
    state: st, active: active, on: on,
    setOn: setOn, toggle: toggle, toggleFlag: toggleFlag,
    update: update, status: status,
    /** 자가진단용 */
    _readyResident: readyResident, _freshProp: freshProp, _nextStep: nextStep, _skip: skip
  };
})(window);
