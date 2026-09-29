/**
 * 시나리오 엔진 — 사가의숲 "하늘 금 우체통" 장 진행
 * ---------------------------------------------------------------
 * 표는 `data-scenario.js`(CHAPTERS·SCENES). 여기는 **지금 어느 장 몇째 단계인지**를 세이브에 적고, 채워졌는지 물어보며
 * 하나씩 넘긴다. 새 시스템을 만들지 않는다 — 단계는 이미 있는 것을 시킨다:
 *   talk    글 상자(#scnbox) — 마을 어디서나. 싸움도 시간제한도 없어 마을을 멈추지 않는다
 *   place   집 가구 `home.state().items`
 *   deliver 'village:delivered' 이 단계가 시작된 뒤 n 번
 *   forest  'forest:enter' 그 이름 있는 숲에 든다
 *   go      그 고정 자리에 선다(ruin = `village.inRuin`)
 *   gather  'village:gather' 이 단계가 시작된 뒤 그 갈래를 n 번
 *   fest    `festival.isDone(key)` — 그날이 아니면 **기념 놀이**: 손잡이 \`time.event\` 로 그 행사를 열어 주고 끝나면 놓는다
 *   heart   누구든 하트 n 이상(\`state().hearts\`)
 *   donate  `museum.byCat()` 갈래 done ≥ n
 *
 * 세이브: \`village.state().scenario = { init, done:{장id:1}, ch, step, said:{장면id:1}, choices:{id:key}, cnt:{deliver,gather}, base, forced }\`.
 * 끄는 법: \`window.DG_NO_SCENARIO = true\`(진단이 기본으로 켠다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var busy = false;          // check() 재진입 막기 — 보상·저장이 'changed' 를 다시 부른다
  var cur = null;            // { id, title, lines, i, done, choice, pick } — 떠 있는 장면
  var listening = false;

  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function CD() { return global.DG.scenarioData; }
  function on() { return !global.DG_NO_SCENARIO; }

  function raw() {
    var s = V().state();
    if (!s.scenario || typeof s.scenario !== 'object') { s.scenario = {}; }
    var sc = s.scenario;
    if (!sc.done || typeof sc.done !== 'object') { sc.done = {}; }
    if (!sc.said || typeof sc.said !== 'object') { sc.said = {}; }
    if (!sc.choices || typeof sc.choices !== 'object') { sc.choices = {}; }
    if (!sc.cnt || typeof sc.cnt !== 'object') { sc.cnt = { deliver: 0, gather: {} }; }
    if (!sc.cnt.gather) { sc.cnt.gather = {}; }
    if (typeof sc.step !== 'number') { sc.step = 0; }
    sc.init = 1;
    return sc;
  }

  function current() {
    var s = raw(), L = CD().CHAPTERS;
    for (var i = 0; i < L.length; i++) { if (!s.done[L[i].id]) { return L[i]; } }
    return null;
  }
  function opened(ch) { return !ch.after || !!raw().done[ch.after]; }

  function sceneOf(step) { return step.scene; }

  function gatherCount(cat) { return raw().cnt.gather[cat] || 0; }

  function inSpot(spot) {
    var Vv = V(), p = Vv.raw && Vv.raw().player, T = Vv.TILE || 40;
    if (!p) { return false; }
    var tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    if (spot === 'ruin') { return !!(Vv.inRuin && Vv.inRuin(tx, ty)); }
    return false;
  }

  function maxHeart() {
    var h = V().state().hearts || {}, best = 0, k;
    for (k in h) { if (Object.prototype.hasOwnProperty.call(h, k) && h[k] && h[k].h > best) { best = h[k].h; } }
    return best;
  }

  function stepDone(step) {
    var s = raw(), M = global.DG.museum, F = global.DG.festival, H = global.DG.home;
    if (step.t === 'talk') { return !!s.said[sceneOf(step)]; }
    if (step.t === 'place') { return !!H && H.state().items.length >= step.n; }
    if (step.t === 'deliver') { return typeof s.base === 'number' && s.cnt.deliver - s.base >= step.n; }
    if (step.t === 'gather') { return typeof s.base === 'number' && gatherCount(step.cat) - s.base >= step.n; }
    if (step.t === 'forest') { return !!s.seenForest && s.seenForest[step.key] === s.ch + ':' + s.step; }
    if (step.t === 'go') { return inSpot(step.spot); }
    if (step.t === 'fest') { return !!F && F.isDone(step.key); }
    if (step.t === 'heart') { return maxHeart() >= step.n; }
    if (step.t === 'donate') {
      var list = M ? M.byCat() : [], i;
      for (i = 0; i < list.length; i++) { if (list[i].cat.key === step.cat) { return list[i].done >= step.n; } }
      return false;
    }
    return true;
  }

  function leaderName() {
    var id = core.save.party && core.save.party[0], h = id && global.DG.data && global.DG.data.find ? global.DG.data.find(id) : null;
    return h ? h.name : '나';
  }

  /** 행사 기념 놀이 — 그날이 아니면 손잡이로 그 행사를 열어 준다(끝나면 놓는다) */
  function openFest(step) {
    var s = raw(), ev = VD().eventOf && VD().eventOf();
    if (ev && ev.key === step.key) { return; }
    if (global.DG_NO_TUNE || !core.setTune) { return; }
    core.setTune('time.event', step.key);
    s.forced = step.key;
    if (V().buildProps) { V().buildProps(); }
    core.log('🎊 기념 놀이 — ' + (VD().eventOf() ? VD().eventOf().name : step.key) + ' 을(를) 열었다. 안내판에서 시작', 'info');
  }
  function closeFest() {
    var s = raw();
    if (!s.forced) { return; }
    s.forced = null;
    if (!global.DG_NO_TUNE && core.setTune) { core.setTune('time.event', null); }
    if (V().buildProps) { V().buildProps(); }
  }

  function begin(step) {
    var s = raw();
    if (step.t === 'deliver' && typeof s.base !== 'number') { s.base = s.cnt.deliver; core.persist(); }
    if (step.t === 'gather' && typeof s.base !== 'number') { s.base = gatherCount(step.cat); core.persist(); }
    if (step.t === 'fest') { openFest(step); }
    if (step.t === 'talk' && !cur) {
      var sid = sceneOf(step), sc = CD().SCENES[sid];
      if (sc) {
        play(sid, sc.title, sc.lines, function (picked) {
          var s2 = raw();
          s2.said[sid] = 1;
          if (sc.choice && picked) { s2.choices[sc.choice.id] = picked; core.log('📖 ' + sc.choice.options.filter(function (o) { return o.key === picked; })[0].label + ' — 골랐다', 'info'); }
          core.persist(); check();
        }, sc.choice);
      }
    }
  }

  function grant(rw) {
    var bits = [];
    if (rw.exp) { core.gainExp(rw.exp); bits.push('경험치 ' + core.fmt(rw.exp)); }
    if (rw.gold) { core.save.player.gold += rw.gold; bits.push('🪙 ' + core.fmt(rw.gold)); }
    if (rw.feat) { core.gainFeat(rw.feat, '이야기'); bits.push('공적 ' + rw.feat); }
    return bits;
  }

  function finish(ch) {
    var s = raw(), bits = grant(ch.reward || {});
    s.done[ch.id] = 1; s.ch = null; s.step = 0; s.base = undefined;
    core.log('📖 ' + ch.no + '장 · ' + ch.title + ' — ' + (bits.join(' · ') || '끝'), 'good');
    core.emit('toast', '📖 ' + ch.no + '장 · ' + ch.title + ' 끝');
    core.emit('scenario:chapter', ch.id);
    core.persist();
    core.emit('changed');
  }

  function check() {
    if (!on() || busy || !V()) { return; }
    busy = true;
    try {
      for (var guard = 0; guard < 40; guard++) {
        var ch = current();
        if (!ch || !opened(ch)) { break; }
        var s = raw();
        if (s.ch !== ch.id) { s.ch = ch.id; s.step = 0; s.base = undefined; core.persist(); }
        var step = ch.steps[s.step];
        if (!step) { finish(ch); continue; }
        if (stepDone(step)) { if (step.t === 'fest') { closeFest(); } s.step += 1; s.base = undefined; core.persist(); continue; }
        begin(step);
        if (stepDone(step)) { continue; }
        break;
      }
    } finally { busy = false; }
  }

  /** 화면·일과판용 — 지금 할 일 한 줄. 이야기가 안 열렸거나 끝났으면 null */
  function hint() {
    if (!on()) { return null; }
    var ch = current();
    if (!ch || !opened(ch)) { return null; }
    var s = raw(), step = ch.steps[s.ch === ch.id ? s.step : 0];
    var pre = ch.no + '장 · ' + ch.title;
    if (!step) { return { ch: ch, title: pre, text: '마무리' }; }
    var text = '';
    if (step.t === 'talk') { text = '💬 이야기를 듣는다'; }
    else if (step.t === 'place') { text = '🪑 집에 가구를 놓는다 (집 🏠 → 놓기)'; }
    else if (step.t === 'deliver') { text = '📦 택배를 배달한다 (접수대 → 배달원)'; }
    else if (step.t === 'forest') { var f = V().forestByKey && V().forestByKey(step.key); text = '🌲 「' + (f ? f.name : step.key) + '」 에 든다'; }
    else if (step.t === 'go') { text = '🏚️ 탑성 폐허(옛 우체통)에 선다'; }
    else if (step.t === 'gather') { text = '🌸 꽃을 모은다 ' + Math.min(step.n, Math.max(0, gatherCount(step.cat) - (typeof s.base === 'number' ? s.base : gatherCount(step.cat)))) + '/' + step.n; }
    else if (step.t === 'fest') { var ev = VD().eventOf && VD().eventOf(); text = '🎊 ' + (ev && ev.key === step.key ? ev.name + ' 놀이를 마친다 (안내판)' : '기념 놀이를 연다'); }
    else if (step.t === 'heart') { text = '💗 주민과 마음을 나눈다 (말 걸기·선물) — 하트 ' + maxHeart() + '/' + step.n; }
    else if (step.t === 'donate') { text = '🦴 사고에 화석을 기증한다 ' + step.n + '점'; }
    return { ch: ch, title: pre, text: text, step: step };
  }

  function list() {
    var s = raw(), c0 = current(), out = [];
    CD().CHAPTERS.forEach(function (c) { out.push({ ch: c, state: s.done[c.id] ? 'done' : (c0 && c0.id === c.id && opened(c) ? 'now' : 'wait') }); });
    return out;
  }

  function esc2(t) { return String(t).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  /** 일과판 맨 위에 붙는 카드 */
  function cardHtml() {
    if (!on()) { return ''; }
    var h = hint(), L = list();
    var html = '<div class="sec"><h4>📖 이야기 · 봄 옛 우체통</h4>';
    L.forEach(function (x) {
      html += '<div class="card' + (x.state === 'done' ? ' on' : '') + '"><div class="stat-row"><span><b>' + x.ch.no + '장 · ' + esc2(x.ch.title) + '</b></span>' +
        '<span class="muted">' + (x.state === 'done' ? '✅ 끝' : x.state === 'now' ? '▶ 지금' : '') + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc2(x.ch.blurb) + '</span></div>' +
        (x.state === 'now' && h && h.ch === x.ch ? '<div class="stat-row"><b>' + esc2(h.text) + '</b></div>' : '') + '</div>';
    });
    if (!current()) { html += '<div class="hint">지금 있는 이야기는 여기까지입니다. 여름은 곧 이어집니다.</div>'; }
    return html + '</div>';
  }

  /** 화면 위쪽 한 줄 */
  function lineHtml() {
    var h = hint();
    return h ? '<div class="p-goal scn-goal">📖 ' + esc2(h.title) + ' — <b>' + esc2(h.text) + '</b></div>' : '';
  }

  /* ── 글 상자 ─────────────────────────────────────────── */

  function boxEl() {
    var e = document.getElementById('scnbox');
    if (!e && document.body) {
      e = document.createElement('div'); e.id = 'scnbox';
      document.body.appendChild(e);
      e.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-scn]') : null;
        var act = b && b.getAttribute('data-scn');
        if (act === 'pick') { pick(b.getAttribute('data-k')); } else if (act === 'skip') { skip(); } else { next(); }
      });
    }
    return e;
  }

  function paint() {
    var e = boxEl();
    if (!e) { return; }
    if (!cur) { e.classList.remove('show'); e.innerHTML = ''; return; }
    var ln = cur.lines[cur.i], who = ln[0], npc = who === 'me' ? { name: leaderName(), emoji: '🧑' } : (CD().CAST[who] || { name: '?', emoji: '💬' });
    e.innerHTML = '<div class="scn-title">' + esc2(cur.title) + '</div>' +
      '<div class="scn-card' + (who === 'me' ? ' me' : '') + '"><div class="scn-face">' + npc.emoji + '</div>' +
      '<div class="scn-say"><b>' + esc2(npc.name) + '</b><p>' + esc2(ln[1]) + '</p>' +
      (cur.pick
        ? '<div class="scn-pick"><small class="muted">' + esc2(cur.choice.prompt || '고른다') + '</small>' +
          cur.choice.options.map(function (o) { return '<button class="btn primary wide" data-scn="pick" data-k="' + esc2(o.key) + '">' + esc2(o.label) + '</button>'; }).join('') + '</div>'
        : '<small class="muted">' + (cur.i + 1) + ' / ' + cur.lines.length + ' · 누르면 다음</small>') + '</div>' +
      (cur.pick ? '' : '<button class="btn tiny ghost" data-scn="skip">건너뛰기</button>') + '</div>';
    e.classList.add('show');
  }

  function play(id, title, lines, done, choice) {
    if (cur || !lines || !lines.length || global.DG_NO_DRAW && global.DG_NO_SCENE) { return false; }
    cur = { id: id, title: title, lines: lines, i: 0, done: done, choice: choice || null, pick: false };
    paint();
    return true;
  }
  function close(picked) {
    if (!cur) { return; }
    if (cur.choice && typeof picked !== 'string') { toChoice(); return; }
    var d = cur.done;
    cur = null; paint();
    if (d) { d(picked); }
  }
  function toChoice() { if (!cur || cur.pick) { return; } cur.i = cur.lines.length - 1; cur.pick = true; paint(); }
  function pick(key) {
    if (!cur || !cur.pick || !cur.choice || !cur.choice.options.some(function (o) { return o.key === key; })) { return false; }
    close(key);
    return true;
  }
  function next() {
    if (!cur || cur.pick) { return; }
    if (cur.i < cur.lines.length - 1) { cur.i += 1; paint(); } else if (cur.choice) { toChoice(); } else { close(); }
  }
  function skip() { close(); }

  function init() {
    if (!listening) {
      listening = true;
      core.on('village:delivered', function () { raw().cnt.deliver += 1; check(); });
      core.on('village:gather', function (e) {
        var cat = e && e.item && e.item.cat;
        if (cat) { var g = raw().cnt.gather; g[cat] = (g[cat] || 0) + (e.n || 1); }
        check();
      });
      core.on('forest:enter', function (e) {
        var s = raw(), ch = current();
        if (ch && e && e.key && s.ch === ch.id) {
          if (!s.seenForest) { s.seenForest = {}; }
          s.seenForest[e.key] = s.ch + ':' + s.step;    // 지금 단계가 그 숲이면 그 단계에 든 것으로 적는다
        }
        check();
      });
      ['changed', 'village:fest', 'village:home', 'village:settle', 'village:mail'].forEach(function (e) { core.on(e, function () { if (!cur) { check(); } }); });
      if (global.addEventListener) {
        global.addEventListener('keydown', function (e) {       // 장면 동안 키는 장면이 먹는다(마을 조작으로 새지 않게)
          if (!cur) { return; }
          if (e.key === ' ' || e.key === 'Enter') { next(); } else if (e.key === 'Escape') { skip(); }
          else if ((e.key === '1' || e.key === '2' || e.key === '3') && cur.pick && cur.choice.options[Number(e.key) - 1]) { pick(cur.choice.options[Number(e.key) - 1].key); }
          e.preventDefault(); e.stopPropagation();
        }, true);
      }
      if (global.setInterval && !global.DG_NO_DRAW && !global.DG_NO_LOOP) { global.setInterval(function () { if (!cur) { check(); } }, 1000); }   // 걸어서 닿는 자리·가구·하트를 잡는다
    }
    check();
  }

  global.DG = global.DG || {};
  global.DG.scenario = {
    init: init, check: check, current: current, hint: hint, list: list, cardHtml: cardHtml, lineHtml: lineHtml, on: on,
    state: raw, isOpen: function () { return !!cur; }, currentScene: function () { return cur; },
    next: next, skip: skip, pick: pick, choice: function (id) { return raw().choices[id] || null; },
    abort: function () { cur = null; paint(); },
    reset: function () { closeFest(); V().state().scenario = undefined; cur = null; paint(); }
  };
})(window);
