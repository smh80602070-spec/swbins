/**
 * 탐사 파견 — 오픈월드 RPG의 탐사(명단 밖 동료를 몇 시간 보내 재료를 받는다) (PLAN §5 ⑲-26, saga-godot PLAN 106 ㊹)
 * ---------------------------------------------------------------
 *   게시판    역참마다 솥(cooking.js) 반대편 서쪽 3.5m — 4m(GPS 46m) 안 F · 🧭 단추
 *   탐사지    여섯 = ⑮ 땅 셋(고향·갈대 나루·옛 성터 언덕) × 둘, 세 시대 — 그 땅 탑을 찾아야 열린다
 *   시간      4·8·12·20시간(이 기기 실제 시각 — 꺼 둔 동안도 흐른다) × 배율 1·1.8·2.5·3.8(반올림·최소 1)
 *   자리      여정 등급 1·1·5·10·15 이상인 칸 수(2~5), 탐사지 하나에 한 명
 *   동료      가진 인물 중 동행 명단(save.party)에 없고 탐사 안 나간 이(나는 못 간다) — 잘 맞는 원소면 보상 +25%(올림)
 *   부르기    도중에 부르면 보상 없이 돌아온다 · 다 되면 받기 · 모두 받기 · 다 된 탐사는 한 번 알림
 *
 * 규칙·시간·배율은 saga-godot `data/dispatch.gd`, 탐사지 이름·보상은 이 판 것(§5 ⑳). 판정 층(`slotsFor`·`rewardOf`·`fits`)은
 * 순수 함수. 세이브 `save.dispatch = { out: { 탐사지: { id, hours, start } }, done }`(읽는 쪽 기본값). 탐사 중 동료는
 * formation.js 가 편성에 못 넣는다(`away`).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('dispatch.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  /* zone = ⑮ 땅(그 땅 탑을 찾아야 열림, home 은 늘) · el = 잘 맞는 원소 · base = 4시간 보상 { gold, ore, dust, items(요리 재료) } */
  var SITES = {
    old_road:    { name: '옛 역참 길',       zone: 'home',    era: '과거', el: 'wind',  base: { gold: 400 },                 desc: '옛 파발꾼이 달리던 길을 살핀다' },
    forest_edge: { name: '북쪽 숲 가장자리', zone: 'home',    era: '과거', el: 'grass', base: { items: { mint: 2, mushroom: 1 } }, desc: '숲 가장자리에서 들풀을 캔다' },
    mudflat:     { name: '갯벌 선창',        zone: 'galdae',  era: '현대', el: 'water', base: { items: { clam: 3 } },       desc: '물 빠진 선창에서 조개를 줍는다' },
    shipyard:    { name: '녹슨 조선소',      zone: 'galdae',  era: '현대', el: 'fire',  base: { ore: 2 },                   desc: '버려진 조선소에서 쓸 만한 쇠를 고른다' },
    quarry:      { name: '잿빛 채석장',      zone: 'gojeong', era: '과거', el: 'rock',  base: { ore: 1, items: { meat: 1 } }, desc: '옛 채석장 돌무더기를 뒤진다' },
    observatory: { name: '시간 틈 관측소',   zone: 'gojeong', era: '미래', el: 'elec',  base: { dust: 3, ore: 1 },          desc: '틈 곁 관측소의 기록을 거둔다' }
  };
  var ORDER = ['old_road', 'forest_edge', 'mudflat', 'shipyard', 'quarry', 'observatory'];
  var ZONE_NAMES = { home: '고향', galdae: '갈대 나루', gojeong: '옛 성터 언덕' };
  var HOURS = [4, 8, 12, 20], MUL = [1, 1.8, 2.5, 3.8];
  var SLOT_AR = [1, 1, 5, 10, 15];
  var FIT_BONUS = 0.25;
  var BOARD_OFF = -3.5;                                   // 역참에서 x(서쪽) — 솥은 +3.5
  var BOARD_R = function (g) { return g ? 46 : 4; };
  var nowFn = function () { return Date.now(); };

  /* ── 판정(순수) ───────────────────────────────────────── */
  /** 여정 등급 ar 의 자리 수 */
  function slotsFor(ar) { var n = 0; for (var i = 0; i < SLOT_AR.length; i++) { if ((ar || 1) >= SLOT_AR[i]) { n++; } } return n; }
  function mulOf(hours) { var i = HOURS.indexOf(hours); return i >= 0 ? MUL[i] : 0; }
  function scale(v, m, fit) { var n = Math.max(1, Math.round(v * m)); return fit ? Math.ceil(n * (1 + FIT_BONUS)) : n; }
  /** 탐사지 id · 시간 · 잘 맞나 → { gold, ore, dust, items } */
  function rewardOf(id, hours, fit) {
    var b = SITES[id] && SITES[id].base, m = mulOf(hours), out = {}, k;
    if (!b || !m) { return out; }
    if (b.gold) { out.gold = scale(b.gold, m, fit); }
    if (b.ore) { out.ore = scale(b.ore, m, fit); }
    if (b.dust) { out.dust = scale(b.dust, m, fit); }
    if (b.items) { out.items = {}; for (k in b.items) { if (b.items.hasOwnProperty(k)) { out.items[k] = scale(b.items[k], m, fit); } } }
    return out;
  }
  function elOf(heroId) { var F = global.DG.fieldCombat; return F && F.elementOf ? F.elementOf(heroId) : null; }
  function fits(id, heroId) { return !!SITES[id] && elOf(heroId) === SITES[id].el; }
  function rewardText(r) {
    var C = global.DG.cooking, out = [], k;
    if (r.gold) { out.push('🪙 ' + r.gold); }
    if (r.items) { for (k in r.items) { if (r.items.hasOwnProperty(k)) { var it = C && C.ITEMS[k]; out.push((it ? it.icon + ' ' + it.name : k) + ' ' + r.items[k]); } } }
    if (r.ore) { out.push('🪨 강화석 ' + r.ore); }
    if (r.dust) { out.push('✨ 단사 ' + r.dust); }
    return out.join(' · ');
  }

  /* ── 세이브·상태 ─────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.dispatch || typeof s.dispatch !== 'object') { s.dispatch = {}; }
    if (!s.dispatch.out || typeof s.dispatch.out !== 'object') { s.dispatch.out = {}; }
    if (typeof s.dispatch.done !== 'number') { s.dispatch.done = 0; }
    return s.dispatch;
  }
  function outOf() { var d = core().save.dispatch; return (d && d.out) || {}; }
  function rank() { var AD = global.DG.adventure; return AD ? AD.rank() : (core().save.player.level || 1); }
  function slots() { return slotsFor(rank()); }
  function used() { return Object.keys(outOf()).length; }
  /** 탐사 중인가(편성이 묻는다) */
  function away(heroId) { var o = outOf(), k; for (k in o) { if (o.hasOwnProperty(k) && o[k].id === heroId) { return k; } } return null; }
  function open(id) {
    var s = SITES[id];
    if (!s) { return false; }
    if (s.zone === 'home') { return true; }
    var ST = global.DG.story, B = global.DG.biome, a = ST && ST.anchorOf ? ST.anchorOf(s.zone) : null;
    return !!(a && B && B.found && B.found(a.key));
  }
  /** 남은 ms(0 이면 다 됨), 안 나간 곳은 null */
  function left(id) { var o = outOf()[id]; return o ? Math.max(0, o.start + o.hours * 3600000 - nowFn()) : null; }
  function doneList() { return ORDER.filter(function (id) { return left(id) === 0; }); }
  function owned(id) {
    var s = core().save, D = global.DG.data;
    return !!(s.dex && s.dex.heroes && s.dex.heroes[id] && (!D || !D.find || D.find(id)));
  }
  /** 보낼 수 있는 동료 — 가진 인물 · 명단 밖 · 안 나감 · 나 아님 */
  function candidates() {
    var s = core().save, P = Array.isArray(s.party) ? s.party : [], out = [];
    for (var id in (s.dex && s.dex.heroes) || {}) {
      if (!s.dex.heroes.hasOwnProperty(id) || id === '_me' || P.indexOf(id) >= 0 || away(id) || !owned(id)) { continue; }
      out.push(id);
    }
    return out;
  }
  function nameOf(id) {
    var SM = global.DG.story && global.DG.story.MEMBERS, D = global.DG.data, h = SM && SM[id] ? SM[id] : (D && D.find ? D.find(id) : null);
    return (h && h.name) || id;
  }

  /* ── 게시판 ───────────────────────────────────────────── */
  function boardsNear(px, py, R) {
    var W = global.DG.world, out = [];
    if (!W || !W.stationsIn || !W.REGION_SIZE) { return out; }
    var RS = W.REGION_SIZE, rx = Math.floor(px / RS), ry = Math.floor(py / RS), dx, dy, i;
    for (dy = -1; dy <= 1; dy++) {
      for (dx = -1; dx <= 1; dx++) {
        var L = W.stationsIn(rx + dx, ry + dy);
        for (i = 0; i < L.length; i++) {
          var p = { key: L[i].key, x: L[i].x + BOARD_OFF, y: L[i].y, name: L[i].name };
          p.dist = Math.hypot(p.x - px, p.y - py);
          if (p.dist <= R) { out.push(p); }
        }
      }
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }
  function atBoard() { var p = core().save.player.pos; return on() && boardsNear(p.x, p.y, BOARD_R(gps())).length > 0; }

  /* ── 보내기·부르기·받기 ───────────────────────────────── */
  function sendCheck(id, heroId, hours, anywhere) {
    if (!on()) { return { ok: false, why: '탐사를 쓸 수 없다' }; }
    if (!SITES[id]) { return { ok: false, why: '없는 탐사지' }; }
    if (!anywhere && !atBoard()) { return { ok: false, why: '역참 곁 게시판에서만' }; }
    if (!open(id)) { return { ok: false, why: ZONE_NAMES[SITES[id].zone] + ' 탑을 찾아야 열린다' }; }
    if (outOf()[id]) { return { ok: false, why: '이미 누가 가 있다' }; }
    if (used() >= slots()) { return { ok: false, why: '자리가 꽉 찼다(여정 등급을 올리면 는다)' }; }
    if (HOURS.indexOf(hours) < 0) { return { ok: false, why: '시간을 고르자' }; }
    if (!heroId || heroId === '_me') { return { ok: false, why: '동료를 고르자' }; }
    if (!owned(heroId)) { return { ok: false, why: '없는 동료' }; }
    var P = core().save.party || [];
    if (P.indexOf(heroId) >= 0) { return { ok: false, why: '동행 명단에 있는 동료는 못 보낸다' }; }
    if (away(heroId)) { return { ok: false, why: '이미 탐사 중' }; }
    return { ok: true };
  }
  function send(id, heroId, hours, anywhere) {
    var c = sendCheck(id, heroId, hours, anywhere);
    if (!c.ok) { return c; }
    sv().out[id] = { id: heroId, hours: hours, start: nowFn() };
    notified[id] = false;
    core().emit('dispatch:send', { site: id, hero: heroId, hours: hours });
    core().emit('changed');
    core().persist();
    return { ok: true };
  }
  /** 부르기 — 보상 없이 돌아온다 */
  function recall(id, anywhere) {
    if (!outOf()[id]) { return { ok: false, why: '나간 이가 없다' }; }
    if (!anywhere && !atBoard()) { return { ok: false, why: '역참 곁 게시판에서만' }; }
    delete sv().out[id];
    core().emit('changed');
    core().persist();
    return { ok: true };
  }
  function give(r) {
    var s = core().save, C = global.DG.cooking, W = global.DG.weapon, k;
    if (r.gold) { s.player.gold = (s.player.gold || 0) + r.gold; }
    if (r.dust) { s.dust = (s.dust || 0) + r.dust; }
    if (r.ore && W) { W.addOre(r.ore); }
    if (r.items && C) { for (k in r.items) { if (r.items.hasOwnProperty(k)) { C.add(k, r.items[k]); } } }
  }
  /** 받기 — 다 된 탐사 하나. { ok, text } */
  function claim(id, anywhere) {
    var o = outOf()[id];
    if (!o) { return { ok: false, why: '나간 이가 없다' }; }
    if (!anywhere && !atBoard()) { return { ok: false, why: '역참 곁 게시판에서만' }; }
    if (left(id) > 0) { return { ok: false, why: '아직 탐사 중' }; }
    var r = rewardOf(id, o.hours, fits(id, o.id));
    give(r);
    var d = sv();
    delete d.out[id];
    d.done += 1;
    core().emit('dispatch:done', { site: id, hero: o.id });
    core().emit('changed');
    core().persist();
    return { ok: true, text: rewardText(r), hero: o.id };
  }
  function claimAll(anywhere) {
    var n = 0;
    doneList().forEach(function (id) { if (claim(id, anywhere).ok) { n++; } });
    return n;
  }

  /* ── 알림 ─────────────────────────────────────────────── */
  var notified = {}, first = true, acc = 0;
  /** 새로 다 된 탐사 — 알림 글 목록. 불러온 직후 첫 확인은 모아 한 줄 */
  function check() {
    var fresh = doneList().filter(function (id) { return !notified[id]; }), out = [];
    fresh.forEach(function (id) { notified[id] = true; });
    if (!fresh.length) { first = false; return out; }
    if (first) { out.push('🧭 탐사 ' + fresh.length + '곳이 끝났다 — 역참 게시판에서 받기'); }
    else { fresh.forEach(function (id) { out.push('🧭 ' + nameOf(outOf()[id].id) + ' — ' + SITES[id].name + ' 탐사 끝 (역참 게시판에서 받기)'); }); }
    first = false;
    out.forEach(toast);
    if (out.length) { sfx('discover'); }
    return out;
  }

  /* ── 3D 게시판 ────────────────────────────────────────── */
  var boards = {};
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function buildBoard(w, T3, b) {
    var wood = new T3.MeshLambertMaterial({ color: 0x6b4a2e }), paper = new T3.MeshLambertMaterial({ color: 0xdfe8f0 });
    var g = new T3.Group();
    [-0.6, 0.6].forEach(function (ox) { var post = new T3.Mesh(new T3.BoxGeometry(0.12, 1.7, 0.12), wood); post.position.set(ox, 0.85, 0); g.add(post); });
    var plank = new T3.Mesh(new T3.BoxGeometry(1.5, 0.85, 0.08), wood); plank.position.set(0, 1.3, 0); g.add(plank);
    var map = new T3.Mesh(new T3.BoxGeometry(1.1, 0.55, 0.02), paper); map.position.set(0, 1.3, 0.05); g.add(map);
    g.position.set(b.x, w.groundY ? w.groundY(b.x, b.y) : 0, b.y);
    g.rotation.y = Math.PI / 2;
    w.addFx(g);
    return g;
  }
  function paint() {
    var w = W3();
    if (!w) { boards = {}; return; }
    var T3 = w.three();
    if (!T3) { return; }
    var p = core().save.player.pos, L = boardsNear(p.x, p.y, 110), seen = {}, i;
    for (i = 0; i < L.length; i++) { seen[L[i].key] = true; if (!boards[L[i].key]) { boards[L[i].key] = buildBoard(w, T3, L[i]); } }
    for (var k in boards) { if (boards.hasOwnProperty(k) && !seen[k]) { w.removeFx(boards[k]); delete boards[k]; } }
  }

  /* ── 화면 ─────────────────────────────────────────────── */
  var ui = { btn: null, sheet: null, open: false, bound: false, pick: {} };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtLeft(ms) { var m = Math.ceil(ms / 60000), h = Math.floor(m / 60); return h ? h + '시간 ' + (m % 60) + '분' : m + '분'; }
  function elIcon(el) { var F = global.DG.fieldCombat, E = F && F.EL && F.EL[el]; return E ? E.icon : ''; }
  function render() {
    if (!ui.sheet) { return; }
    var cand = candidates(), dn = doneList().length;
    var out = '<div class="ck-head"><b>🧭 탐사 파견</b><span>자리 ' + used() + '/' + slots() + ' · 여정 등급으로 는다</span>' +
      '<button class="btn sm ' + (dn ? 'primary' : 'ghost') + '" data-dp="all"' + (dn ? '' : ' disabled') + '>모두 받기' + (dn ? ' ●' + dn : '') + '</button>' +
      '<button class="ck-x" data-dp="close" aria-label="닫기">✕</button></div>';
    ORDER.forEach(function (id) {
      var s = SITES[id], o = outOf()[id], head = '<b>' + esc(s.name) + '</b> <small class="muted">' + ZONE_NAMES[s.zone] + ' · ' + s.era + ' · 잘 맞는 원소 ' + elIcon(s.el) + '</small>';
      out += '<div class="ck-row"><div class="ck-name">' + head;
      if (!open(id)) {
        out += '<small class="muted">🔒 ' + ZONE_NAMES[s.zone] + ' 탑을 찾으면 열린다</small></div><div class="ck-acts"></div></div>';
        return;
      }
      if (o) {
        var lm = left(id), fit = fits(id, o.id);
        out += '<small>' + elIcon(elOf(o.id)) + ' ' + esc(nameOf(o.id)) + ' · ' + o.hours + '시간 · ' + (lm ? '남은 ' + fmtLeft(lm) : '다 됨') + (fit ? ' · ★ 원소 +25%' : '') + '</small>' +
          '<small class="muted">' + esc(rewardText(rewardOf(id, o.hours, fit))) + '</small></div><div class="ck-acts">' +
          (lm ? '<button class="btn ghost" data-dp="recall" data-s="' + id + '">부르기</button>' : '<button class="btn primary" data-dp="claim" data-s="' + id + '">받기</button>') + '</div></div>';
        return;
      }
      var pk = ui.pick[id] || {}, hero = cand.indexOf(pk.hero) >= 0 ? pk.hero : (cand.filter(function (h) { return fits(id, h); })[0] || cand[0] || ''), hours = pk.hours || HOURS[0];
      ui.pick[id] = { hero: hero, hours: hours };
      out += '<small class="muted">' + esc(s.desc) + '</small><div class="dp-pick">' +
        '<select data-dp-hero="' + id + '">' + (cand.length ? cand.map(function (h) {
          return '<option value="' + esc(h) + '"' + (h === hero ? ' selected' : '') + '>' + elIcon(elOf(h)) + ' ' + esc(nameOf(h)) + (fits(id, h) ? ' ★' : '') + '</option>';
        }).join('') : '<option value="">보낼 동료 없음(명단 밖 동료)</option>') + '</select>' +
        '<select data-dp-hours="' + id + '">' + HOURS.map(function (h) { return '<option value="' + h + '"' + (h === hours ? ' selected' : '') + '>' + h + '시간</option>'; }).join('') + '</select></div>' +
        '<small class="muted">' + (hero ? esc(rewardText(rewardOf(id, hours, fits(id, hero)))) : '') + '</small></div><div class="ck-acts">' +
        '<button class="btn ' + (sendCheck(id, hero, hours).ok ? 'primary' : 'ghost') + '"' + (hero && used() < slots() ? '' : ' disabled') + ' data-dp="send" data-s="' + id + '">보내기</button></div></div>';
    });
    ui.sheet.innerHTML = '<div class="ck-card">' + out + '</div>';
  }
  function openSheet() {
    if (!document.body || !on()) { return false; }
    if (!ui.sheet) {
      ui.sheet = document.createElement('div');
      ui.sheet.id = 'dp-sheet';
      ui.sheet.addEventListener('click', onClick);
      ui.sheet.addEventListener('change', function (e) {
        var t = e.target, h = t.getAttribute('data-dp-hero'), hr = t.getAttribute('data-dp-hours');
        if (h) { ui.pick[h] = ui.pick[h] || {}; ui.pick[h].hero = t.value; }
        if (hr) { ui.pick[hr] = ui.pick[hr] || {}; ui.pick[hr].hours = +t.value; }
        render();
      });
      document.body.appendChild(ui.sheet);
    }
    ui.open = true;
    ui.sheet.classList.add('show');
    render();
    return true;
  }
  function closeSheet() { ui.open = false; if (ui.sheet) { ui.sheet.classList.remove('show'); } }
  function onClick(e) {
    var b = e.target.closest ? e.target.closest('[data-dp]') : null;
    if (!b) { if (e.target === ui.sheet) { closeSheet(); } return; }
    var act = b.getAttribute('data-dp'), id = b.getAttribute('data-s'), r;
    if (act === 'close') { closeSheet(); return; }
    if (act === 'send') {
      var pk = ui.pick[id] || {};
      r = send(id, pk.hero, pk.hours || HOURS[0]);
      toast(r.ok ? '🧭 ' + nameOf(pk.hero) + ' — ' + SITES[id].name + ' 로 ' + (pk.hours || HOURS[0]) + '시간 탐사' : '🧭 ' + r.why);
    } else if (act === 'recall') {
      r = recall(id);
      toast(r.ok ? '🧭 불러들였다 — 보상 없음' : '🧭 ' + r.why);
    } else if (act === 'claim') {
      r = claim(id);
      toast(r.ok ? '🧭 ' + nameOf(r.hero) + ' 돌아옴 — ' + r.text : '🧭 ' + r.why);
      if (r.ok) { sfx('reward'); }
    } else if (act === 'all') {
      var n = claimAll();
      if (n) { toast('🧭 탐사 ' + n + '곳 보상을 받았다'); sfx('reward'); }
    }
    render();
  }
  function paintBtn() {
    if (!document.body) { return; }
    if (!ui.btn) {
      ui.btn = document.createElement('button');
      ui.btn.id = 'dp-btn'; ui.btn.type = 'button';
      ui.btn.setAttribute('aria-label', '탐사 파견');
      ui.btn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); if (ui.open) { closeSheet(); } else { openSheet(); } });
      document.body.appendChild(ui.btn);
    }
    var busy = document.body.classList.contains('sheet-open'), dn = doneList().length;
    ui.btn.classList.toggle('show', !busy && atBoard());
    var html = '<span>🧭</span><em>탐사' + (dn ? ' ●' + dn : '') + '</em>';
    if (ui.btn.innerHTML !== html) { ui.btn.innerHTML = html; }
  }
  function bind() {
    if (ui.bound || !global.addEventListener) { return; }
    ui.bound = true;
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.repeat) { return; }
      var k = (e.key || '').toLowerCase(), ST = global.DG.story, FS = global.DG.fishing;
      if (k === 'escape' && ui.open) { closeSheet(); return; }
      if (k !== 'f' || !atBoard() || (ST && ST.nearTalk && ST.nearTalk()) || (FS && FS.active)) { return; }
      var p = core().save.player.pos;
      if (FS && FS.nearSpot && (FS.nearSpot(p.x, p.y) || FS.nearBoard(p.x, p.y))) { return; }
      e.preventDefault();
      if (ui.open) { closeSheet(); } else { openSheet(); }
    });
  }
  /** 사명 화면 한 줄(ui.js viewQuest) */
  function lineHtml() {
    if (!on()) { return ''; }
    var dn = doneList().length;
    return '<div class="sec"><h4>🧭 탐사 파견 <small class="muted">자리 ' + used() + '/' + slots() + (dn ? ' · 다 됨 ' + dn : '') + '</small></h4>' +
      '<div class="card"><small class="muted">명단 밖 동료를 역참 곁 게시판에서 탐사에 보낸다(4~20시간, 꺼 둔 동안도 흐른다).' + (dn ? ' <b>끝난 탐사 ' + dn + '곳 — 역참 게시판에서 받기</b>' : '') + '</small></div></div>';
  }

  function tick(dt) {
    if (!core() || !core().save || !on()) { return; }
    acc += dt || 0;
    if (acc >= 1) { acc = 0; check(); }
    if (global.DG_NO_DRAW) { return; }
    bind();
    paintBtn();
    paint();
    /* 남은 시간 글 — 창을 연 동안 30초마다(고르는 중인 목록은 안 건드린다) */
    if (ui.open) { ui.t = (ui.t || 0) + (dt || 0); var fe = document.activeElement; if (ui.t >= 30 && !(fe && fe.tagName === 'SELECT')) { ui.t = 0; render(); } }
  }

  global.DG = global.DG || {};
  global.DG.dispatch = {
    SITES: SITES, ORDER: ORDER, HOURS: HOURS, MUL: MUL, SLOT_AR: SLOT_AR, FIT_BONUS: FIT_BONUS, BOARD_OFF: BOARD_OFF, BOARD_R: BOARD_R,
    /* 판정 층(순수) */
    slotsFor: slotsFor, rewardOf: rewardOf, fits: fits, rewardText: rewardText,
    /* 세이브·상태 */
    slots: slots, used: used, away: away, open: open, left: left, doneList: doneList, candidates: candidates, boardsNear: boardsNear, atBoard: atBoard,
    sendCheck: sendCheck, send: send, recall: recall, claim: claim, claimAll: claimAll, check: check,
    /* 화면 */
    tick: tick, openSheet: openSheet, closeSheet: closeSheet, lineHtml: lineHtml,
    _setNowForTest: function (fn) { nowFn = fn || function () { return Date.now(); }; },
    _resetForTest: function () { notified = {}; first = true; acc = 0; ui.pick = {}; }
  };
})(window);
