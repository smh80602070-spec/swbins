/**
 * 2나락 전리품 거르기(W-0287) — 규칙 목록으로 바닥 물건을 보이기·숨기기·빛기둥 강조.
 * ---------------------------------------------------------------
 * 라스트 에포크·PoE 의 "루트 필터" 구조만 따랐다(이름·수치·그림은 안 가져옴).
 *   규칙 꼴  { when: { minTier, slot, elem, myClass }, do: 'show' | 'hide' | 'beam', off }
 *   판정     위에서부터 보고 **처음 맞는 규칙**의 do — 아무 규칙도 안 맞으면 'show'.
 *   대상     kind === 'item' 인 떨굼만. 금·단약·세공 재료·감정서는 **늘 보인다**.
 *   저장     save.settings.lootFilter = { rules: [], hinted: bool } (새 칸 — 옛 세이브는 비어 있으면 기본 셋)
 *   기본 셋  ① 전설·고유 빛기둥  ② 보물 빛기둥  ③ 내 직업 무기 빛기둥 — 숨기기는 기본에 없다(처음부터 숨기면 "안 떨어진다" 고 느낀다).
 *   추천     4층 밑으로 내려가면 "상품 숨기기" 를 한 번 권한다(hinted 로 한 번만).
 *
 * 연결 자리(한 줄씩): dungeon.js take/pickupField(숨긴 건 안 줍는다) · dungeon-view 2D 그리기(건너뜀) ·
 * dungeon3d 바닥 조각(건너뜀·beam 은 lootBeam 을 강제) · auto.js(숨긴 건 안 간다) · ui.js 설정 창(settingsHtml/act).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var TIER_NAMES = ['상품', '양품', '명품', '보물', '전설'];
  var SLOT_NAMES = { weapon: '무기', armor: '갑주', helm: '투구', glove: '장갑', boots: '신', belt: '요대', charm: '부적', ring: '반지', amulet: '목걸이' };
  var ELEM_NAMES = { fire: '화', ice: '빙', lightning: '뇌', poison: '독', holy: '성', dark: '암' };
  var DO_NAMES = { show: '보이기', hide: '숨기기', beam: '빛기둥' };
  var MAX_RULES = 12;
  var HINT_FLOOR = 4;

  function defaults() {
    return [
      { when: { minTier: 4 }, do: 'beam' },
      { when: { minTier: 3 }, do: 'beam' },
      { when: { slot: 'weapon', myClass: true }, do: 'beam' }
    ];
  }

  function store() {
    var s = core.save.settings;
    if (!s.lootFilter || !Array.isArray(s.lootFilter.rules)) { s.lootFilter = { rules: defaults(), hinted: false }; }
    return s.lootFilter;
  }

  function rules() { return store().rules; }

  /* ── 물건 성질 ─────────────────────────────────────────── */

  function elemsOf(it) {
    var IT = global.DG.item, out = {}, eff = [], i;
    if (!IT || !it) { return out; }
    try { eff = (IT.uniqEffects(it) || []); } catch (e) { eff = []; }
    for (i = 0; i < eff.length; i++) { if (eff[i].el) { out[eff[i].el] = true; } }
    return out;
  }

  /** 선두가 지금 든 무기의 직업 — 무기가 없으면 null(규칙 myClass 는 안 맞는다) */
  function myClassKey() {
    var SK = global.DG.skill, lead = core.save.party && core.save.party[0];
    if (!SK || !SK.classOf || !lead) { return null; }
    try { var c = SK.classOf(lead); return c ? c.key : null; } catch (e) { return null; }
  }

  function classOfItem(it) {
    var IT = global.DG.item, SD = global.DG.skillData;
    var b = IT && it ? IT.baseOf(it) : null;
    if (!b || b.slot !== 'weapon' || !SD || !SD.classOf || !SD.weaponsFor) { return null; }
    var c = SD.classOf(null, b.look);   // look → 직업(WEAPON_CLASS 는 안 나와 있어 공개 함수로)
    return c && SD.weaponsFor(c.key).indexOf(b.look) >= 0 ? c.key : null;
  }

  function matches(when, it, cls) {
    var IT = global.DG.item;
    if (!when) { return true; }
    if (typeof when.minTier === 'number' && !((it.tier || 0) >= when.minTier || (when.minTier >= 4 && it.uniq))) { return false; }
    if (when.slot) { var b = IT ? IT.baseOf(it) : null; if (!b || b.slot !== when.slot) { return false; } }
    if (when.elem && !elemsOf(it)[when.elem]) { return false; }
    if (when.myClass) { var ic = classOfItem(it); if (!ic || !cls || ic !== cls) { return false; } }
    return true;
  }

  /** 떨굼 하나의 판정 — 'show' | 'hide' | 'beam'. 물건이 아니면 늘 'show' */
  function judge(dp) {
    if (!dp || dp.kind !== 'item' || !dp.item) { return 'show'; }
    var rs = rules(), cls = myClassKey(), i;
    for (i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (!r || r.off) { continue; }
      if (matches(r.when, dp.item, cls)) { return DO_NAMES[r.do] ? r.do : 'show'; }
    }
    return 'show';
  }

  function hidden(dp) { return judge(dp) === 'hide'; }
  function beam(dp) { return judge(dp) === 'beam'; }

  /* ── 규칙 손질 ─────────────────────────────────────────── */

  function add(rule) {
    var rs = rules();
    if (rs.length >= MAX_RULES) { return false; }
    rs.unshift({ when: rule.when || {}, do: DO_NAMES[rule.do] ? rule.do : 'show' });
    core.persist();
    return true;
  }
  function remove(i) { var rs = rules(); if (i < 0 || i >= rs.length) { return false; } rs.splice(i, 1); core.persist(); return true; }
  function move(i, d) {
    var rs = rules(), j = i + d;
    if (i < 0 || i >= rs.length || j < 0 || j >= rs.length) { return false; }
    var t = rs[i]; rs[i] = rs[j]; rs[j] = t; core.persist(); return true;
  }
  function toggle(i) { var rs = rules(); if (!rs[i]) { return false; } rs[i].off = !rs[i].off; core.persist(); return true; }
  function cycleDo(i) {
    var rs = rules(); if (!rs[i]) { return false; }
    var order = ['show', 'hide', 'beam'];
    rs[i].do = order[(order.indexOf(rs[i].do) + 1) % order.length]; core.persist(); return true;
  }
  function reset() { store().rules = defaults(); core.persist(); }

  /* ── 추천(층이 오르면 한 번) ───────────────────────────── */

  function hintIfDeep(floor) {
    var st = store();
    if (st.hinted || floor < HINT_FLOOR) { return false; }
    st.hinted = true;
    core.persist();
    core.emit('toast', '🧹 바닥이 어지러우면 ⚙️ 설정 › 전리품 거르기에서 "상품 숨기기" 를 켜 보세요');
    return true;
  }

  if (core.on) { core.on('dungeon:floor', function (f) { hintIfDeep(typeof f === 'number' ? f : (f && f.floor) || 0); }); }

  /* ── 설정 창 조각(ui.js viewSettings 가 붙인다) ───────────── */

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function describe(r) {
    var w = r.when || {}, parts = [];
    if (typeof w.minTier === 'number') { parts.push((TIER_NAMES[w.minTier] || w.minTier) + ' 이상'); }
    if (w.slot) { parts.push(SLOT_NAMES[w.slot] || w.slot); }
    if (w.elem) { parts.push((ELEM_NAMES[w.elem] || w.elem) + ' 원소'); }
    if (w.myClass) { parts.push('내 직업 무기'); }
    return parts.length ? parts.join(' · ') : '모든 물건';
  }

  function settingsHtml() {
    var rs = rules(), h = '<div class="key-row" style="margin-top:8px"><b>전리품 거르기</b><span class="key-cur">' + rs.length + '/' + MAX_RULES + ' 규칙</span></div>', i;
    for (i = 0; i < rs.length; i++) {
      var r = rs[i];
      h += '<div class="key-row lf-rule" style="gap:4px;flex-wrap:wrap' + (r.off ? ';opacity:.5' : '') + '"><span style="flex:1;min-width:120px">' + (i + 1) + '. ' + esc(describe(r)) + '</span>' +
        '<button class="btn tiny' + (r.do === 'hide' ? ' danger' : r.do === 'beam' ? ' primary' : ' ghost') + '" data-act="lf-do" data-i="' + i + '">' + DO_NAMES[r.do] + '</button>' +
        '<button class="btn tiny ghost" data-act="lf-up" data-i="' + i + '" title="위로">▲</button>' +
        '<button class="btn tiny ghost" data-act="lf-down" data-i="' + i + '" title="아래로">▼</button>' +
        '<button class="btn tiny ghost" data-act="lf-off" data-i="' + i + '">' + (r.off ? '꺼짐' : '켜짐') + '</button>' +
        '<button class="btn tiny ghost" data-act="lf-del" data-i="' + i + '" title="지우기">✕</button></div>';
    }
    h += '<div class="key-row" style="gap:4px;flex-wrap:wrap">' +
      '<button class="btn tiny ghost" data-act="lf-add" data-rule="hide0">상품 숨기기</button>' +
      '<button class="btn tiny ghost" data-act="lf-add" data-rule="hide1">양품 이하 숨기기</button>' +
      '<button class="btn tiny ghost" data-act="lf-add" data-rule="beamw">내 직업 무기 빛기둥</button>' +
      '<button class="btn tiny ghost" data-act="lf-add" data-rule="beam2">명품 이상 빛기둥</button>' +
      '<button class="btn tiny ghost" data-act="lf-reset">기본으로</button></div>' +
      '<div class="hint">위에서부터 처음 맞는 규칙대로 보입니다. 금·단약·재료는 늘 보입니다. 숨긴 물건은 줍지 않습니다.</div>';
    return h;
  }

  var PRESET = {
    hide0: { when: { minTier: 0 }, do: 'hide' },
    hide1: { when: { minTier: 0 }, do: 'hide', _max: 1 },
    beamw: { when: { slot: 'weapon', myClass: true }, do: 'beam' },
    beam2: { when: { minTier: 2 }, do: 'beam' }
  };

  /** ui.js 의 단추 처리 — 맞는 act 면 true(그쪽이 renderSheet 한다) */
  function act(a, b) {
    if (!a || a.indexOf('lf-') !== 0) { return false; }
    var i = parseInt(b.getAttribute('data-i') || '-1', 10);
    if (a === 'lf-add') {
      var key = b.getAttribute('data-rule'), p = PRESET[key];
      if (!p) { return true; }
      if (key === 'hide1') {
        /* "양품 이하 숨기기" = 명품 이상 보이기 + 전부 숨기기, 두 줄로 — 첫 일치 규칙이라 순서가 뜻이다 */
        add({ when: {}, do: 'hide' }); add({ when: { minTier: 2 }, do: 'show' });
      } else { add({ when: p.when, do: p.do }); }
      return true;
    }
    if (a === 'lf-reset') { reset(); return true; }
    if (a === 'lf-do') { cycleDo(i); return true; }
    if (a === 'lf-up') { move(i, -1); return true; }
    if (a === 'lf-down') { move(i, 1); return true; }
    if (a === 'lf-off') { toggle(i); return true; }
    if (a === 'lf-del') { remove(i); return true; }
    return true;
  }

  global.DG.lootFilter = {
    judge: judge, hidden: hidden, beam: beam,
    rules: rules, add: add, remove: remove, move: move, toggle: toggle, cycleDo: cycleDo, reset: reset, defaults: defaults,
    hintIfDeep: hintIfDeep, settingsHtml: settingsHtml, act: act, describe: describe,
    myClassKey: myClassKey, classOfItem: classOfItem, MAX_RULES: MAX_RULES
  };
})(this);
