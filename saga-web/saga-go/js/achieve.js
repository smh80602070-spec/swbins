/**
 * 업적 — 오픈월드 RPG의 업적 스물둘·단계 예순셋·화면에서 받기 (PLAN §5 ⑲-25, saga-godot PLAN 106 ㊸)
 * ---------------------------------------------------------------
 *   갈래 다섯  세상 곳곳 · 싸움의 길 · 원소의 이치 · 살림살이 · 이야기
 *   셈        이미 있는 상태에서 읽는 것(상자·구슬·탑·탑 등급·사명·들판 처치·물고기 기록·장·세계 임무·여정 등급)과
 *             신호로 세는 것(`field:kill` 원소 괴물·큰 적 · `field:react` · `field:weak` · `domain:clear` · `cook:gather`·`cook:done`)
 *   알림      0.5초마다 새로 닿은 단계를 "🏆 업적" — 불러온 직후 첫 확인은 알림 없이(옛 진행이 한꺼번에 울리지 않게)
 *   받기      Y 키 · 사명 화면 카드 → 창. 단계마다 한 번 — 금 / 금·무예 쪽지 / 무예 교본·강화석, 어려운 셋은 인연 매듭 더
 *
 * 표·단계 수는 saga-godot `data/achievements.gd`, 이름·보상은 이 판 것(§5 ⑳). "탐험도 100% 지역" 은 이 판에 탐험도가 없어
 * ⑬ 지역 사명을 끝낸 지역으로 바꿨다. 판정 층(`valueOf`·`tierOf`·`rewardOf`)은 순수 함수.
 * 세이브 `save.ach = { stats, got }`(읽는 쪽 기본값) — stats 는 신호 셈, got 은 업적마다 받은 단계 수.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('achieve.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  /* ── 표 ─────────────────────────────────────────────── */
  var CATS = [
    { key: 'world',   name: '세상 곳곳', icon: '🗺️' },
    { key: 'fight',   name: '싸움의 길', icon: '⚔️' },
    { key: 'element', name: '원소의 이치', icon: '✨' },
    { key: 'life',    name: '살림살이', icon: '🍲' },
    { key: 'story',   name: '이야기',   icon: '📖' }
  ];
  /* src — 값을 내는 곳(valueOf). hard = 그 단계 번호(0부터)에 인연 매듭을 더 준다 */
  var LIST = [
    { id: 'chest',     cat: 'world',   name: '보물 사냥꾼',   unit: '상자를 열었다',        tiers: [5, 10, 18],    src: 'chests' },
    { id: 'orb',       cat: 'world',   name: '구슬 줍는 이',   unit: '수집 구슬을 주웠다',    tiers: [5, 12, 20],    src: 'orbs' },
    { id: 'tower',     cat: 'world',   name: '탑 찾는 길',     unit: '지역 탑을 찾았다',      tiers: [3, 6, 8],      src: 'towers' },
    { id: 'offer',     cat: 'world',   name: '탑의 벗',        unit: '탑 등급',             tiers: [2, 5, 10],     src: 'towerLv' },
    { id: 'mission',   cat: 'world',   name: '지역 평정',      unit: '사명을 끝낸 지역',      tiers: [1, 3],         src: 'missions', hard: 1 },
    { id: 'kill',      cat: 'fight',   name: '들판의 칼',      unit: '들판 적을 물리쳤다',    tiers: [20, 100, 300], src: 'kills' },
    { id: 'elite',     cat: 'fight',   name: '원소 괴물 사냥', unit: '방패 두른 원소 괴물',   tiers: [5, 20, 60],    src: 'stat:elite' },
    { id: 'boss',      cat: 'fight',   name: '큰 적 쓰러뜨림', unit: '보스·수호자',          tiers: [1, 5, 15],     src: 'stat:boss' },
    { id: 'domain',    cat: 'fight',   name: '숨은 터 돌파',   unit: '숨은 터를 끝냈다',      tiers: [1, 5, 15],     src: 'stat:domain' },
    { id: 'weak',      cat: 'fight',   name: '급소 한 발',     unit: '급소 화살',            tiers: [1, 10, 30],    src: 'stat:weak' },
    { id: 'react',     cat: 'element', name: '원소 부림',      unit: '원소 반응',            tiers: [10, 50, 200],  src: 'stat:react' },
    { id: 'kinds',     cat: 'element', name: '반응 도감',      unit: '반응 가짓수',          tiers: [4, 8, 14],     src: 'kinds', hard: 2 },
    { id: 'shatter',   cat: 'element', name: '얼음 깨기',      unit: '깨뜨림',              tiers: [1, 10],        src: 'kind:shatter' },
    { id: 'swirl',     cat: 'element', name: '회오리 부름',    unit: '회오리',              tiers: [1, 20],        src: 'kind:swirl' },
    { id: 'gather',    cat: 'life',    name: '들풀 모으기',    unit: '채집',                tiers: [20, 60, 150],  src: 'stat:gather' },
    { id: 'cook',      cat: 'life',    name: '솥 앞에서',      unit: '요리',                tiers: [1, 10, 30],    src: 'stat:cook' },
    { id: 'tasty',     cat: 'life',    name: '맛있는 한 상',   unit: '맛있는 요리',          tiers: [1, 5, 15],     src: 'stat:tasty' },
    { id: 'fish',      cat: 'life',    name: '낚싯대 드리우기', unit: '물고기를 낚았다',      tiers: [1, 10, 30],    src: 'fish' },
    { id: 'fishkinds', cat: 'life',    name: '물고기 도감',    unit: '물고기 가짓수',        tiers: [3, 5, 8],      src: 'fishKinds' },
    { id: 'chapter',   cat: 'story',   name: '이야기 따라',    unit: '이야기 장을 마쳤다',    tiers: [1, 5, 9],      src: 'chapters', hard: 2 },
    { id: 'wq',        cat: 'story',   name: '세계의 부탁',    unit: '세계 임무를 마쳤다',    tiers: [1, 2, 3],      src: 'wq' },
    { id: 'rank',      cat: 'story',   name: '여정의 걸음',    unit: '여정 등급',            tiers: [5, 10, 20],    src: 'rank' }
  ];
  var BY = {};
  LIST.forEach(function (a) { BY[a.id] = a; });
  /* 단계 번호(0부터) → 보상. 두 단 업적은 앞 둘만 쓴다 */
  var REWARD = [
    { gold: 300 },
    { gold: 600, mats: { note: 2 } },
    { mats: { guide: 2 }, ore: 3 }
  ];
  var HARD_KNOT = 1, CHECK_SEC = 0.5;

  /* ── 판정(순수) ───────────────────────────────────────── */
  function count(o) { return o && typeof o === 'object' ? Object.keys(o).length : 0; }
  /** 업적 a 의 지금 값 — s = 세이브(읽기만), ext = { towerLv, missions, rank } 모듈이 답하는 값 */
  function valueOf(a, s, ext) {
    var ac = s.ach || {}, st = ac.stats || {}, kd = st.kinds || {}, fl = (s.fish && s.fish.log) || {};
    var src = a.src;
    if (src.indexOf('stat:') === 0) { return st[src.slice(5)] || 0; }
    if (src.indexOf('kind:') === 0) { return kd[src.slice(5)] || 0; }
    switch (src) {
      case 'chests': return count(s.chests);
      case 'orbs': return s.orbs ? count(s.orbs.got) : 0;
      case 'towers': return count(s.regions);
      case 'towerLv': return ext.towerLv || 0;
      case 'missions': return ext.missions || 0;
      case 'kills': return (s.field && s.field.kills) || 0;
      case 'kinds': return count(kd);
      case 'fish': var n = 0, k; for (k in fl) { if (fl.hasOwnProperty(k)) { n += fl[k] || 0; } } return n;
      case 'fishKinds': return count(fl);
      case 'chapters': return Math.min(9, (s.story && s.story.ch) || 0);
      case 'wq': return (s.wq && s.wq.done && s.wq.done.length) || 0;
      case 'rank': return ext.rank || 0;
    }
    return 0;
  }
  /** 닿은 단계 수(0 ~ tiers.length) */
  function tierOf(a, v) { var n = 0; while (n < a.tiers.length && v >= a.tiers[n]) { n++; } return n; }
  /** 단계 i(0부터)의 보상 — { gold, mats, ore } */
  function rewardOf(a, i) {
    var r = REWARD[i] || REWARD[REWARD.length - 1], out = {}, k;
    for (k in r) { if (r.hasOwnProperty(k)) { out[k] = k === 'mats' ? JSON.parse(JSON.stringify(r[k])) : r[k]; } }
    if (a.hard === i) { out.mats = out.mats || {}; out.mats.knot = (out.mats.knot || 0) + HARD_KNOT; }
    return out;
  }
  function rewardText(r) {
    var TL = global.DG.talent, out = [];
    if (r.gold) { out.push('🪙 ' + r.gold); }
    if (r.mats) { for (var k in r.mats) { if (r.mats.hasOwnProperty(k)) { var m = TL && TL.MATS[k]; out.push((m ? m.icon + ' ' + m.name : k) + ' ' + r.mats[k]); } } }
    if (r.ore) { out.push('🪨 강화석 ' + r.ore); }
    return out.join(' · ');
  }

  /* ── 세이브·셈 ───────────────────────────────────────── */
  function sv() {
    var s = core().save;
    if (!s.ach || typeof s.ach !== 'object') { s.ach = {}; }
    if (!s.ach.stats || typeof s.ach.stats !== 'object') { s.ach.stats = {}; }
    if (!s.ach.stats.kinds || typeof s.ach.stats.kinds !== 'object') { s.ach.stats.kinds = {}; }
    if (!s.ach.got || typeof s.ach.got !== 'object') { s.ach.got = {}; }
    return s.ach;
  }
  function bump(k, n) { var st = sv().stats; st[k] = (st[k] || 0) + (n || 1); }
  function ext() {
    var TR = global.DG.treasure, B = global.DG.biome, AD = global.DG.adventure, s = core().save, m = 0, k;
    if (B && B.missionView && B.missionState && s.missions) {
      for (k in s.missions) { if (s.missions.hasOwnProperty(k) && B.missionView(B.missionState(k)).done) { m++; } }
    }
    return { towerLv: TR && TR.level ? TR.level() : 0, missions: m, rank: AD ? AD.rank() : (s.player.level || 1) };
  }
  /** 업적마다 { a, v, tier, got, claim(받을 단계 수) } */
  function status() {
    var s = core().save, e = ext(), got = (s.ach && s.ach.got) || {};
    return LIST.map(function (a) {
      var v = valueOf(a, s, e), t = tierOf(a, v), g = Math.min(t, got[a.id] || 0);
      return { a: a, v: v, tier: t, got: g, claim: t - g };
    });
  }
  function claimable() { var n = 0; status().forEach(function (x) { n += x.claim; }); return n; }
  function give(r) {
    var P = core().save.player;
    if (r.gold) { P.gold = (P.gold || 0) + r.gold; }
    if (r.mats && global.DG.talent) { global.DG.talent.addMats(r.mats); }
    if (r.ore && global.DG.weapon) { global.DG.weapon.addOre(r.ore); }
  }
  /** 받기 — 다음 한 단계. 받은 보상 글(없으면 '') */
  function claim(id) {
    var a = BY[id];
    if (!a || !on()) { return ''; }
    var x = status().filter(function (y) { return y.a.id === id; })[0];
    if (!x || x.claim <= 0) { return ''; }
    var r = rewardOf(a, x.got);
    give(r);
    sv().got[id] = x.got + 1;
    core().emit('changed');
    core().persist();
    return rewardText(r);
  }
  /** 모두 받기 — 받은 단계 수 */
  function claimAll() {
    var n = 0;
    LIST.forEach(function (a) { while (claim(a.id)) { n++; } });
    return n;
  }

  /* ── 신호 ─────────────────────────────────────────────── */
  function onKill(e) { if (!e) { return; } if (e.elite) { bump('elite'); } if (e.boss) { bump('boss'); } }
  function onReact(e) { if (!e || !e.kind) { return; } bump('react'); var kd = sv().stats.kinds; kd[e.kind] = (kd[e.kind] || 0) + 1; }
  function onWeak() { bump('weak'); }
  function onDomain() { bump('domain'); }
  function onGather() { bump('gather'); }
  function onCook(e) { bump('cook'); if (e && e.q === 2) { bump('tasty'); } }
  var hooked = false;
  function hook() {
    if (hooked || !core() || !core().on) { return; }
    hooked = true;
    var c = core();
    c.on('field:kill', onKill);
    c.on('field:react', onReact);
    c.on('field:weak', onWeak);
    c.on('domain:clear', onDomain);
    c.on('cook:gather', onGather);
    c.on('cook:done', onCook);
  }

  /* ── 알림 ─────────────────────────────────────────────── */
  var seen = null, acc = 0;
  /** 새로 닿은 단계 — [{ a, tier }]. 첫 확인은 기준만 잡고 빈 목록(불러온 직후 알림 없음) */
  function check() {
    var L = status(), out = [];
    if (!seen) { seen = {}; L.forEach(function (x) { seen[x.a.id] = x.tier; }); return out; }
    L.forEach(function (x) {
      if (x.tier > (seen[x.a.id] || 0)) { out.push({ a: x.a, tier: x.tier }); seen[x.a.id] = x.tier; }
    });
    out.forEach(function (n) { toast('🏆 업적 — ' + n.a.name + ' ' + n.tier + '/' + n.a.tiers.length + ' (Y 에서 받기)'); });
    if (out.length) { sfx('reward'); if (ui.open) { render(); } }
    return out;
  }

  /* ── 화면 ─────────────────────────────────────────────── */
  var ui = { sheet: null, open: false, tab: 'world', bound: false };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tierText(x) {
    var a = x.a;
    if (x.tier >= a.tiers.length) { return a.unit + ' ' + x.v + ' — 모두 이룸'; }
    return a.unit + ' ' + Math.min(x.v, a.tiers[x.tier]) + '/' + a.tiers[x.tier];
  }
  function render() {
    if (!ui.sheet) { return; }
    var L = status(), tot = 0, done = 0, n = claimable();
    L.forEach(function (x) { tot += x.a.tiers.length; done += x.tier; });
    var out = '<div class="ck-head"><b>🏆 업적</b><span>' + done + '/' + tot + ' 단계</span>' +
      '<button class="btn sm ' + (n ? 'primary' : 'ghost') + '" data-ac="all"' + (n ? '' : ' disabled') + '>모두 받기' + (n ? ' ●' + n : '') + '</button>' +
      '<button class="ck-x" data-ac="close" aria-label="닫기">✕</button></div>';
    out += '<div class="ac-tabs">' + CATS.map(function (c) {
      var cn = 0; L.forEach(function (x) { if (x.a.cat === c.key) { cn += x.claim; } });
      return '<button class="btn sm ' + (ui.tab === c.key ? 'primary' : 'ghost') + '" data-ac-tab="' + c.key + '">' + c.icon + ' ' + c.name + (cn ? ' ●' + cn : '') + '</button>';
    }).join('') + '</div>';
    L.forEach(function (x) {
      if (x.a.cat !== ui.tab) { return; }
      var a = x.a, full = x.tier >= a.tiers.length, goal = full ? a.tiers[a.tiers.length - 1] : a.tiers[x.tier];
      var pct = Math.round(Math.min(1, x.v / goal) * 100), stars = '';
      for (var i = 0; i < a.tiers.length; i++) { stars += i < x.tier ? '★' : '☆'; }
      var nextR = x.claim > 0 ? rewardText(rewardOf(a, x.got)) : (full ? '' : rewardText(rewardOf(a, x.tier)));
      out += '<div class="ck-row"><div class="ck-name"><b>' + esc(a.name) + '</b> <span class="ac-stars">' + stars + '</span>' +
        '<small>' + esc(tierText(x)) + '</small><div class="ac-bar"><i style="width:' + pct + '%"></i></div>' +
        (nextR ? '<small class="muted">' + esc(nextR) + '</small>' : '') + '</div>' +
        '<div class="ck-acts"><button class="btn ' + (x.claim ? 'primary' : 'ghost') + '"' + (x.claim ? '' : ' disabled') + ' data-ac="claim" data-id="' + a.id + '">' +
        (x.claim ? '받기' + (x.claim > 1 ? ' ×' + x.claim : '') : (full ? '끝' : '받기')) + '</button></div></div>';
    });
    ui.sheet.innerHTML = '<div class="ck-card">' + out + '</div>';
  }
  function openSheet() {
    if (!document.body || !on()) { return false; }
    if (!ui.sheet) {
      ui.sheet = document.createElement('div');
      ui.sheet.id = 'ac-sheet';
      ui.sheet.addEventListener('click', onClick);
      document.body.appendChild(ui.sheet);
    }
    ui.open = true;
    ui.sheet.classList.add('show');
    render();
    return true;
  }
  function closeSheet() { ui.open = false; if (ui.sheet) { ui.sheet.classList.remove('show'); } }
  function onClick(e) {
    var b = e.target.closest ? e.target.closest('[data-ac],[data-ac-tab]') : null;
    if (!b) { if (e.target === ui.sheet) { closeSheet(); } return; }
    if (b.hasAttribute('data-ac-tab')) { ui.tab = b.getAttribute('data-ac-tab'); render(); return; }
    var act = b.getAttribute('data-ac');
    if (act === 'close') { closeSheet(); return; }
    if (act === 'claim') { var t = claim(b.getAttribute('data-id')); if (t) { toast('🏆 받았다 — ' + t); sfx('reward'); } }
    else if (act === 'all') { var n = claimAll(); if (n) { toast('🏆 ' + n + ' 단계를 받았다'); sfx('reward'); } }
    render();
  }
  function bind() {
    if (ui.bound || !global.addEventListener) { return; }
    ui.bound = true;
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.repeat || e.ctrlKey || e.metaKey) { return; }
      var k = (e.key || '').toLowerCase();
      if (k === 'y') { if (ui.open) { closeSheet(); } else { openSheet(); } }
      else if (k === 'escape' && ui.open) { closeSheet(); }
    });
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-ac-open]') : null;
      if (b) { e.preventDefault(); openSheet(); }
    });
  }
  /** 사명 화면 카드(ui.js viewQuest) */
  function cardHtml() {
    if (!on()) { return ''; }
    var L = status(), tot = 0, done = 0, n = 0;
    L.forEach(function (x) { tot += x.a.tiers.length; done += x.tier; n += x.claim; });
    return '<div class="sec"><h4>🏆 업적 <small class="muted">' + done + '/' + tot + ' 단계</small></h4><div class="card">' +
      '<div class="bar blue"><i style="width:' + Math.round(done / tot * 100) + '%"></i></div>' +
      '<button class="btn ' + (n ? 'primary' : 'ghost') + ' wide" data-ac-open="1">🏆 업적 보기' + (n ? ' — 받을 것 ●' + n : '') + ' (Y)</button></div></div>';
  }

  function tick(dt) {
    if (!core() || !core().save || !on()) { return; }
    hook();
    acc += dt || 0;
    if (acc >= CHECK_SEC || !seen) { acc = 0; check(); }
    if (!global.DG_NO_DRAW) { bind(); }
  }

  global.DG = global.DG || {};
  global.DG.achieve = {
    CATS: CATS, LIST: LIST, REWARD: REWARD, HARD_KNOT: HARD_KNOT,
    /* 판정 층(순수) */
    valueOf: valueOf, tierOf: tierOf, rewardOf: rewardOf, rewardText: rewardText,
    /* 세이브·셈 */
    status: status, claimable: claimable, claim: claim, claimAll: claimAll, check: check, hook: hook,
    /* 화면 */
    tick: tick, openSheet: openSheet, closeSheet: closeSheet, cardHtml: cardHtml,
    _resetForTest: function () { seen = null; acc = 0; }
  };
})(window);
