/**
 * 시나리오 엔진 — 사가블로 "이름이 지워지는 나라" 막·장 진행
 * ---------------------------------------------------------------
 * 표는 `data-scenario.js`(CHAPTERS·SCENES). 여기는 **지금 어느 장 몇째 단계인지**를 세이브에 적고,
 * 그 단계가 채워졌는지 물어보며 하나씩 넘긴다. 새 판정을 만들지 않는다 — 단계는 이미 나가는 사건만 듣는다:
 *   talk     대사 장면(아래 #scnbox) — **마을에 있을 때만**(굴혈 안에선 실시간이라 안 띄운다)
 *   kill     'dungeon:kill'   이 단계가 시작된 뒤 n 마리
 *   floor    save.dungeon.best  최고 층이 n 이상
 *   chain    save.quest.chain[key].done  지역 사연 사슬 평정(quest.js)
 *   landmark dungeon.fixedState()[명소 층].clears  명소 층 답파(dungeon.js)
 *   rescue   'dungeon:rescue' 이 단계가 시작된 뒤 n 번
 *   region   save.quest.chain[key] 가 열림 — 큰 지도에서 그 지역에 처음 발을 들임
 *   (장면의 `choice` 는 마지막 줄 뒤 고르기 단추 — 답은 save.scenario.choices)
 *
 * 세이브: `core.save.scenario = { init, done:{장id:1}, ch, step, said:{장면id:1}, cnt:{kill,rescue}, base }`
 *   없으면 빈 것으로 본다(마이그레이션 불필요). 옛 세이브는 장의 \`legacy.floor\` 이상 내려가 봤으면 그 장을 보상 없이 지나온 길로 본다.
 * 끄는 법: \`window.DG_NO_SCENARIO = true\`(진단이 기본으로 켠다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var busy = false;          // check() 재진입 막기 — 보상·저장이 'changed' 를 다시 부른다
  var cur = null;            // { id, title, lines, i, done } — 떠 있는 장면
  var listening = false;

  function CD() { return global.DG.scenarioData; }
  function on() { return !global.DG_NO_SCENARIO; }

  function raw() {
    var s = core.save;
    if (!s.scenario || typeof s.scenario !== 'object') { s.scenario = {}; }
    var sc = s.scenario;
    if (!sc.done || typeof sc.done !== 'object') { sc.done = {}; }
    if (!sc.said || typeof sc.said !== 'object') { sc.said = {}; }
    if (!sc.cnt || typeof sc.cnt !== 'object') { sc.cnt = { kill: 0, rescue: 0 }; }
    if (!sc.choices || typeof sc.choices !== 'object') { sc.choices = {}; }
    if (!Array.isArray(sc.titles)) { sc.titles = []; }
    if (typeof sc.step !== 'number') { sc.step = 0; }
    if (!sc.init) {
      sc.init = 1;
      var best = bestFloor();
      CD().CHAPTERS.forEach(function (c) { if (c.legacy && best >= c.legacy.floor) { sc.done[c.id] = 1; } });
      sc.ch = null; sc.step = 0;
    }
    return sc;
  }

  function bestFloor() { var d = core.save.dungeon; return (d && d.best) || 0; }

  function current() {
    var s = raw(), L = CD().CHAPTERS;
    for (var i = 0; i < L.length; i++) { if (!s.done[L[i].id]) { return L[i]; } }
    return null;
  }

  function opened(ch) { return !ch.after || !!raw().done[ch.after]; }

  function inTown() {
    var T = global.DG.town, D = global.DG.dungeon;
    return !!(T && T.active && T.active()) && !(D && D.active && D.active());
  }

  function fixedFloor(key) {
    var F = global.DG.dungeonData.FIXED;
    for (var i = 0; i < F.length; i++) { if (F[i].key === key) { return F[i]; } }
    return null;
  }

  /** 장면 id — `by` 가 있으면 앞에서 고른 답에 따라 `scene_답key`(안 골랐으면 첫 갈래) */
  function sceneOf(step) {
    if (!step.by) { return step.scene; }
    var pick = raw().choices[step.by];
    if (!pick) { var c = CD().choiceOf(step.by); pick = c ? c.options[0].key : ''; }
    return step.scene + '_' + pick;
  }

  function stepDone(step) {
    var s = raw();
    if (step.t === 'talk') { return !!s.said[sceneOf(step)]; }
    if (step.t === 'region') { var qq = core.save.quest; return !!(qq && qq.chain && qq.chain[step.key]); }
    if (step.t === 'kill') { return typeof s.base === 'number' && s.cnt.kill - s.base >= step.n; }
    if (step.t === 'rescue') { return typeof s.base === 'number' && s.cnt.rescue - s.base >= step.n; }
    if (step.t === 'floor') { return bestFloor() >= step.n; }
    if (step.t === 'chain') { var q = core.save.quest; return !!(q && q.chain && q.chain[step.key] && q.chain[step.key].done); }
    if (step.t === 'landmark') {
      var f = fixedFloor(step.key), st = f && global.DG.dungeon.fixedState()[f.floor];
      return !!(st && st.clears > 0);
    }
    return true;
  }

  function leaderName() {
    var id = core.save.party && core.save.party[0], h = id && global.DG.data && global.DG.data.find ? global.DG.data.find(id) : null;
    return h ? h.name : '나';
  }

  /** 이 단계를 시작한다 — 세는 단계는 기준값을 적고, 장면은 마을이면 띄운다 */
  function begin(step) {
    var s = raw();
    if ((step.t === 'kill' || step.t === 'rescue') && typeof s.base !== 'number') { s.base = s.cnt[step.t]; core.persist(); }
    if (step.t === 'talk' && !cur && inTown()) {
      var sid = sceneOf(step), sc = CD().SCENES[sid];
      if (sc) {
        play(sid, sc.title, sc.lines, function (picked) {
          var s2 = raw();
          s2.said[sid] = 1;
          if (sc.choice && picked) {
            s2.choices[sc.choice.id] = picked;
            var opt = sc.choice.options.filter(function (o) { return o.key === picked; })[0];
            if (opt && opt.reward) { grant(opt.reward); core.log('📖 ' + opt.label + ' — 골랐다', 'good'); }
          }
          core.persist(); check();
        }, sc.choice);
      }
    }
  }

  function grant(rw) {   // 아래 finish·고르기 보상이 함께 쓴다
    var bits = [];
    if (rw.exp) { core.gainExp(rw.exp); bits.push('경험치 ' + core.fmt(rw.exp)); }
    if (rw.gold) { core.save.player.gold += rw.gold; bits.push('금 ' + core.fmt(rw.gold)); }
    if (rw.feat) { core.gainFeat(rw.feat, '이야기'); bits.push('공적 ' + rw.feat); }
    if (rw.title) { var ts = raw().titles; if (ts.indexOf(rw.title) < 0) { ts.push(rw.title); } bits.push('🏷️ 칭호 「' + rw.title + '」'); }
    return bits;
  }

  function finish(ch) {
    var s = raw(), bits = grant(ch.reward || {});
    s.done[ch.id] = 1; s.ch = null; s.step = 0; s.base = undefined;
    core.log('📖 제' + ch.no + '장 · ' + ch.title + ' — ' + (bits.join(' · ') || '끝'), 'good');
    core.emit('toast', '📖 제' + ch.no + '장 · ' + ch.title + ' 끝');
    core.emit('scenario:chapter', ch.id);
    core.persist();
    core.emit('changed');
  }

  /** 지금 단계가 채워졌으면 넘기고, 못 채웠으면 시작만 시켜 둔다 — 걸림돌이 나올 때까지 돈다 */
  function check() {
    if (!on() || busy) { return; }
    busy = true;
    try {
      for (var guard = 0; guard < 40; guard++) {
        var ch = current();
        if (!ch || !opened(ch)) { break; }
        var s = raw();
        if (s.ch !== ch.id) { s.ch = ch.id; s.step = 0; s.base = undefined; core.persist(); }
        var step = ch.steps[s.step];
        if (!step) { finish(ch); continue; }
        if (stepDone(step)) { s.step += 1; s.base = undefined; core.persist(); continue; }
        begin(step);
        if (stepDone(step)) { continue; }
        break;
      }
    } finally { busy = false; }
  }

  /** 화면·목표판용 — 지금 할 일 한 줄. 이야기가 안 열렸거나 다 봤으면 null */
  function hint() {
    if (!on()) { return null; }
    var ch = current();
    if (!ch || !opened(ch)) { return null; }
    var s = raw(), step = ch.steps[s.ch === ch.id ? s.step : 0];
    var pre = '제' + ch.no + '장 · ' + ch.title;
    if (!step) { return { ch: ch, title: pre, text: '마무리' }; }
    var text = '';
    if (step.t === 'talk') { text = inTown() ? '💬 이야기를 듣는다' : '💬 마을로 돌아가면 이야기가 이어진다'; }
    else if (step.t === 'region') {
      var W = global.DG.worldMap, rg = W && W.byKey ? W.byKey(step.key) : null;
      text = '🗺️ 큰 지도에서 「' + (rg ? rg.name : step.key) + '」 에 발을 들인다';
    }
    else if (step.t === 'kill') { text = '⚔️ 몬스터 ' + Math.min(step.n, Math.max(0, s.cnt.kill - (typeof s.base === 'number' ? s.base : s.cnt.kill))) + '/' + step.n; }
    else if (step.t === 'rescue') { text = '🙏 갇힌 인물을 구한다'; }
    else if (step.t === 'floor') { text = '🕳️ 굴혈 ' + step.n + '층에 닿는다 (최고 ' + bestFloor() + ')'; }
    else if (step.t === 'chain') {
      var c = global.DG.questData.CHAINS[step.key];
      text = '🗺️ 큰 지도의 사연 「' + (c ? c.title : step.key) + '」 를 평정한다';
    } else if (step.t === 'landmark') { var f = fixedFloor(step.key); text = '🏛️ 명소 「' + (f ? f.name : step.key) + '」 (' + (f ? f.floor : '?') + '층)을 답파한다'; }
    return { ch: ch, title: pre, text: text, step: step };
  }

  /** 이야기 목록용 — 장마다 { ch, state: 'done'|'now'|'wait' } */
  function list() {
    var s = raw(), c0 = current(), out = [];
    CD().CHAPTERS.forEach(function (c) { out.push({ ch: c, state: s.done[c.id] ? 'done' : (c0 && c0.id === c.id && opened(c) ? 'now' : 'wait') }); });
    return out;
  }

  /** 퀘스트 시트 맨 위에 붙는 카드 */
  function cardHtml() {
    if (!on()) { return ''; }
    var h = hint(), L = list(), esc = core.esc || function (t) { return String(t).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); };
    var html = '', act = null;
    L.forEach(function (x) {
      var a = CD().actOf(x.ch);
      if (a !== act) {
        if (act) { html += '</div>'; }
        act = a;
        html += '<div class="sec"><h4>📖 이야기 · ' + esc(CD().ACTS[a] || (a + '막')) + '</h4>';
      }
      html += '<div class="card' + (x.state === 'done' ? ' on' : '') + '"><div class="stat-row"><span><b>제' + x.ch.no + '장 · ' + esc(x.ch.title) + '</b></span>' +
        '<span class="muted">' + (x.state === 'done' ? '✅ 끝' : x.state === 'now' ? '▶ 지금' : '') + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(x.ch.blurb) + '</span></div>' +
        (x.state === 'now' && h && h.ch === x.ch ? '<div class="stat-row"><b>' + esc(h.text) + '</b></div>' : '') + '</div>';
    });
    if (!current()) { html += '<div class="hint">' + (raw().titles.length ? '🏷️ 「' + esc(raw().titles.join('」 「')) + '」 — ' : '') + '지금 있는 이야기는 여기까지입니다. 6막은 곧 이어집니다.</div>'; }
    return html + '</div>';
  }

  /* ── 장면 상자 — 마을에서만 뜬다. 누르면 다음 줄, 마지막에서 누르면 닫힌다 ─────────── */

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

  function esc2(t) { return String(t).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  function paint() {
    var e = boxEl();
    if (!e) { return; }
    if (!cur) { e.classList.remove('show'); e.innerHTML = ''; document.body.classList.remove('scn-open'); return; }
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
    document.body.classList.add('scn-open');
  }

  function play(id, title, lines, done, choice) {
    if (cur || !lines || !lines.length || global.DG_NO_SCENE) { return false; }
    cur = { id: id, title: title, lines: lines, i: 0, done: done, choice: choice || null, pick: false };
    paint();
    return true;
  }

  function close(picked) {
    if (!cur) { return; }
    if (cur.choice && typeof picked !== 'string') { toChoice(); return; }   // 고르기 장면은 건너뛰어도 고르기 앞까지만
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
      core.on('dungeon:kill', function () { raw().cnt.kill += 1; check(); });
      core.on('dungeon:rescue', function () { raw().cnt.rescue += 1; check(); });
      ['changed', 'dungeon:floor', 'dungeon:fixed', 'dungeon:end', 'dungeon:enter'].forEach(function (e) { core.on(e, function () { if (!cur) { check(); } }); });
      if (global.addEventListener) {
        global.addEventListener('keydown', function (e) {       // 장면 동안 키는 장면이 먹는다(마을 조작으로 새지 않게)
          if (!cur) { return; }
          if (e.key === ' ' || e.key === 'Enter') { next(); } else if (e.key === 'Escape') { skip(); }
          else if ((e.key === '1' || e.key === '2' || e.key === '3') && cur.pick && cur.choice.options[Number(e.key) - 1]) { pick(cur.choice.options[Number(e.key) - 1].key); }
          e.preventDefault(); e.stopPropagation();
        }, true);
      }
      if (global.setInterval && !global.DG_NO_DRAW) { global.setInterval(function () { if (!cur) { check(); } }, 1000); }   // 마을로 돌아온 순간을 잡는다
    }
    check();
  }

  global.DG = global.DG || {};
  global.DG.scenario = {
    init: init, check: check, current: current, hint: hint, list: list, cardHtml: cardHtml, on: on,
    state: raw, titles: function () { return raw().titles.slice(); }, isOpen: function () { return !!cur; }, currentScene: function () { return cur; },
    next: next, skip: skip, pick: pick, choice: function (id) { return raw().choices[id] || null; }, abort: function () { cur = null; paint(); },
    reset: function () { core.save.scenario = undefined; cur = null; paint(); }
  };
})(window);
