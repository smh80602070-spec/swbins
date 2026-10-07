/**
 * 제작대(製作臺) — 채집물로 도구를 승급하고 가구·공사 자재를 짓는다 (PLAN §5.15, W-0103 리뉴얼 ③ · 재미표준 D)
 * ---------------------------------------------------------------
 * 도구·옷·가구가 "사면 끝" 이던 판에 성장 선택을 둔다. 마인크래프트의 "재료 → 제작대 → 도구 단계" 만 가져왔다
 * (블록 세계·채굴 지형 변형은 안 가져온다 — 이 판의 "짓기" 는 공사 `terrain.js` 규칙이다).
 *
 *   제작대   집 앞 고정 소품 하나(`village.js buildProps` 의 bench, 그림은 기존 Bench_1.glb). 곁에서 손을 쓰면 이 창
 *   레시피   `villageData.RECIPES` 12 — 도구 승급 6(잠자리채·삽 Lv2·3·4) · 가구 4 · 공사 자재 2(삯 면제 칸)
 *   3택      도구를 승급할 때마다 축 셋 — **속도**(손이 빨라진다: ×0.8) · **수확**(+1개 30%) · **희귀**(드문 것 무게 ×1.5).
 *            셋이 서로 다른 축이라 한 화면에 같은 축이 둘 나오지 않는다. 거절하면 벨 100(다음 승급 때 다시)
 *
 * 속도 축의 뜻 — 이 판 채집엔 "1회 시간" 칸이 없다(손을 쓰면 바로 든다). 그래서 손이 빨라지는 쪽으로 옮겼다:
 *   잠자리채 = 휘두르는 거리 ÷0.8(더 멀리서 잡는다) · 삽 = 리듬 보너스가 이어지는 틈 ÷0.8
 *
 * 세이브: `save.village.tools[key] = {lv, perks:[축…]}`(옛 `true` 는 처음 읽을 때 `{lv:1, perks:[]}` 로 — `hasTool` 은
 * 참 그대로) · `save.village.craft = {pending:{tool, opts}|null, pave:{stone:n, path:n}, made:n}`. 키는 새로 안 만든다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function on() { return core.tuned('craft.on', 1) ? true : false; }

  var AXES = {
    speed: { key: 'speed', name: '속도', emoji: '⚡', mul: 0.8, desc: { net: '휘두르는 거리 +25%', spade: '리듬 보너스 틈 +25%' } },
    yield: { key: 'yield', name: '수확', emoji: '🧺', p: 0.3, desc: { net: '잡을 때 30% 로 하나 더', spade: '팔 때 30% 로 하나 더' } },
    rare:  { key: 'rare',  name: '희귀', emoji: '💎', mul: 1.5, desc: { net: '드문 벌레가 1.5배 잘 나온다', spade: '드문 화석이 1.5배 잘 나온다' } }
  };
  var AXIS_KEYS = ['speed', 'yield', 'rare'];
  var RARE_W = 20;            // 무게 20 이하 = 드문 것(산삼 4·은괴 15·공룡 이빨 9 …)
  var DECLINE_GOLD = 100;

  /* ── 세이브 ───────────────────────────────────────────── */

  function st() { return V().state(); }
  function cs() {
    var s = st();
    if (!s.craft || typeof s.craft !== 'object') { s.craft = {}; }
    if (!s.craft.pave) { s.craft.pave = {}; }
    if (s.craft.pending === undefined) { s.craft.pending = null; }
    return s.craft;
  }
  /** 도구 기록 — 없으면 null. 옛 `true` 는 여기서 `{lv:1, perks:[]}` 로 바뀐다 */
  function rec(key) {
    var s = st();
    if (!s.tools) { s.tools = {}; }
    var t = s.tools[key];
    if (!t) { return null; }
    if (typeof t !== 'object') { t = s.tools[key] = { lv: 1, perks: [] }; }
    if (!t.lv) { t.lv = 1; }
    if (!t.perks) { t.perks = []; }
    return t;
  }

  /** 도구의 보정 — 축마다 몇 번 골랐나에 따라 겹친다. **순수에 가깝다**(세이브만 읽는다) */
  function perk(key) {
    var t = on() ? rec(key) : null, n = { speed: 0, yield: 0, rare: 0 };
    (t ? t.perks : []).forEach(function (a) { if (n.hasOwnProperty(a)) { n[a]++; } });
    return { lv: t ? t.lv : 0, n: n, timeMul: Math.pow(AXES.speed.mul, n.speed), extraP: Math.min(0.9, AXES.yield.p * n.yield),
             rareMul: Math.pow(AXES.rare.mul, n.rare) };
  }
  /** 수확 축 — 하나 더 얹을지(0 또는 1) */
  function bonusN(key) { var p = perk(key).extraP; return p > 0 && Math.random() < p ? 1 : 0; }
  /** 고르는 무게 — 희귀 축이면 드문 것(무게 1~20)이 무거워진다 */
  function weight(it, key) {
    var w = it.w || 0;
    return w > 0 && w <= RARE_W ? w * perk(key).rareMul : w;
  }

  /* ── 레시피 ───────────────────────────────────────────── */

  function recipe(key) { return VD().RECIPES.filter(function (r) { return r.key === key; })[0] || null; }
  function nameOf(r) {
    if (r.kind === 'tool') { var T = VD().TOOLS[r.tool]; return T.emoji + ' ' + T.name + ' Lv' + r.lv; }
    if (r.kind === 'furn') { var F = VD().furn(r.furn); return '🪑 ' + (F ? F.name : r.furn); }
    return r.emoji + ' ' + r.name + ' ×' + r.n;
  }
  function needText(r) {
    return Object.keys(r.need).map(function (k) {
      var it = VD().item(k);
      return (it ? it.emoji + it.name : k) + ' ' + V().bagCount(k) + '/' + r.need[k];
    }).join(' · ');
  }
  /** 지을 수 있나 — { ok, why } */
  function can(r) {
    if (typeof r === 'string') { r = recipe(r); }
    if (!r) { return { ok: false, why: '없는 레시피' }; }
    if (!on()) { return { ok: false, why: '제작대가 꺼져 있다' }; }
    if (r.kind === 'tool') {
      var t = rec(r.tool);
      if (!t) { return { ok: false, why: VD().TOOLS[r.tool].name + ' 이(가) 없다 — 전방에서 산다' }; }
      if (t.lv >= r.lv) { return { ok: false, why: '이미 Lv' + t.lv }; }
      if (t.lv !== r.lv - 1) { return { ok: false, why: 'Lv' + (r.lv - 1) + ' 부터' }; }
      if (cs().pending) { return { ok: false, why: '앞 승급의 3택을 먼저 고른다' }; }
    }
    for (var k in r.need) {
      if (r.need.hasOwnProperty(k) && V().bagCount(k) < r.need[k]) { return { ok: false, why: '재료가 모자란다' }; }
    }
    return { ok: true };
  }
  /** 짓는다 — 재료를 쓰고 결과를 낸다. 도구 승급이면 3택이 선다(pending) */
  function make(r) {
    if (typeof r === 'string') { r = recipe(r); }
    var c = can(r);
    if (!c.ok) { return { ok: false, why: c.why }; }
    var bag = st().bag, k;
    for (k in r.need) { if (r.need.hasOwnProperty(k)) { bag[k] -= r.need[k]; } }
    var C = cs(), text;
    C.made = (C.made || 0) + 1;
    if (r.kind === 'tool') {
      rec(r.tool).lv = r.lv;
      C.pending = { tool: r.tool, opts: offer3(r.tool) };
      text = nameOf(r) + ' 로 승급 — 길을 하나 고른다';
    } else if (r.kind === 'furn') {
      global.DG.home.stockAdd(r.furn, 1);
      text = nameOf(r) + ' 을(를) 지었다 — 집에 놓을 수 있다';
    } else {
      C.pave[r.pave] = (C.pave[r.pave] || 0) + r.n;
      text = nameOf(r) + ' — 공사 삯이 ' + r.n + '칸 면제된다';
    }
    core.gainFeat(2, '제작');
    core.log('🔨 제작대 — ' + text, 'good');
    core.emit('craft:make', { key: r.key, kind: r.kind });
    core.emit('changed');
    core.persist();
    return { ok: true, text: text, pending: C.pending };
  }

  /** 3택 — 축 셋을 섞어 낸다(축이 셋뿐이라 늘 셋 다, 같은 축 둘은 없다) */
  function offer3(tool) {
    var a = AXIS_KEYS.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.map(function (k) { return { axis: k, name: AXES[k].name, emoji: AXES[k].emoji, desc: AXES[k].desc[tool] || '' }; });
  }
  function pending() { return cs().pending || null; }
  /** 3택 하나를 고른다 */
  function pick(idx) {
    var p = pending();
    if (!p || !p.opts[idx]) { return null; }
    var o = p.opts[idx], t = rec(p.tool);
    t.perks.push(o.axis);
    cs().pending = null;
    core.log(VD().TOOLS[p.tool].emoji + ' ' + VD().TOOLS[p.tool].name + ' — ' + o.emoji + ' ' + o.name + ' (' + o.desc + ')', 'good');
    core.emit('changed');
    core.persist();
    return o;
  }
  /** 거절 — 벨 100, 다음 승급 때 다시 고른다 */
  function decline() {
    if (!pending()) { return 0; }
    cs().pending = null;
    core.save.player.gold += DECLINE_GOLD;
    core.log('🔨 승급 길을 고르지 않았다 — 🪙 +' + DECLINE_GOLD + ' (다음 승급 때 다시)', 'info');
    core.emit('changed');
    core.persist();
    return DECLINE_GOLD;
  }

  /* ── 공사 자재(terrain.js 가 읽는다) ─────────────────── */
  function paveLeft(kind) { return on() ? (cs().pave[kind] || 0) : 0; }
  function usePave(kind) { var C = cs(); if ((C.pave[kind] || 0) > 0) { C.pave[kind]--; return true; } return false; }

  /* ── 화면 ─────────────────────────────────────────────── */

  var ov = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function close() { if (ov) { ov.style.display = 'none'; } }
  function html() {
    var p = pending();
    if (p) {
      var T = VD().TOOLS[p.tool], rc = rec(p.tool);
      return '<h3 style="margin:0 0 4px;font-size:18px">' + T.emoji + ' ' + T.name + ' Lv' + rc.lv + ' — 길을 하나</h3>' +
        '<small class="muted">고른 길은 그 도구에 남는다(같은 길을 또 고르면 겹친다)</small>' +
        p.opts.map(function (o, i) {
          return '<button class="btn wide" data-craft-pick="' + i + '" style="display:block;width:100%;margin-top:8px;text-align:left">' +
            o.emoji + ' <b>' + esc(o.name) + '</b> — ' + esc(o.desc) + '</button>';
        }).join('') +
        '<button class="btn wide" data-craft-decline="1" style="display:block;width:100%;margin-top:12px">고르지 않기 · 🪙 +' + DECLINE_GOLD + '</button>';
    }
    var rows = VD().RECIPES.map(function (r) {
      var c = can(r);
      return '<div class="card" style="margin-top:6px;padding:8px 10px;display:flex;gap:8px;align-items:center">' +
        '<div style="flex:1"><b>' + esc(nameOf(r)) + '</b><br><small class="muted">' + esc(needText(r)) + (c.ok ? '' : ' — ' + esc(c.why)) + '</small></div>' +
        '<button class="btn' + (c.ok ? ' primary' : '') + '" data-craft-make="' + r.key + '"' + (c.ok ? '' : ' disabled') + '>짓기</button></div>';
    }).join('');
    var pv = cs().pave, pvt = (pv.stone || pv.path) ? ' · 공사 자재 ⬜' + (pv.stone || 0) + ' 🟫' + (pv.path || 0) : '';
    return '<h3 style="margin:0 0 4px;font-size:18px">🔨 제작대</h3>' +
      '<small class="muted">채집물로 도구를 승급하고 가구·공사 자재를 짓는다' + pvt + '</small>' +
      '<div style="max-height:56vh;overflow:auto;margin-top:6px">' + rows + '</div>' +
      '<button class="btn primary wide" data-craft-close="1" style="display:block;width:100%;margin-top:12px">닫기</button>';
  }
  function render() { if (ov) { ov.firstChild.innerHTML = html(); } }
  function toast(m) { var U = global.DG.ui; if (U && U.toast && m) { U.toast(m); } }
  /** 제작대를 연다(village.interact 가 bench 에서 부른다) */
  function openBench() {
    if (!on()) { return { kind: 'no', text: '제작대를 쓸 수 없다' }; }
    if (typeof document === 'undefined' || global.DG_NO_DRAW) { return { kind: 'craft', text: '🔨 제작대' }; }
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'craft-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:41;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(6,8,12,.66)';
      ov.innerHTML = '<div class="enc-card"></div>';
      ov.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('button') : null;
        if (e.target === ov) { close(); return; }
        if (!b) { return; }
        if (b.hasAttribute('data-craft-close')) { close(); return; }
        if (b.hasAttribute('data-craft-make')) { var r = make(b.getAttribute('data-craft-make')); toast(r.ok ? '🔨 ' + r.text : r.why); }
        else if (b.hasAttribute('data-craft-pick')) { var o = pick(+b.getAttribute('data-craft-pick')); if (o) { toast(o.emoji + ' ' + o.name + ' — ' + o.desc); } }
        else if (b.hasAttribute('data-craft-decline')) { toast('🪙 +' + decline() + ' — 다음 승급 때 다시 고른다'); }
        render();
      });
      document.body.appendChild(ov);
    }
    render();
    ov.style.display = 'flex';
    return { kind: 'craft', text: '🔨 제작대' };
  }
  function isOpen() { return !!(ov && ov.style.display === 'flex'); }

  global.DG = global.DG || {};
  global.DG.craft = {
    AXES: AXES, AXIS_KEYS: AXIS_KEYS, RARE_W: RARE_W, DECLINE_GOLD: DECLINE_GOLD,
    on: on, rec: rec, perk: perk, bonusN: bonusN, weight: weight, recipe: recipe, nameOf: nameOf,
    can: can, make: make, offer3: offer3, pending: pending, pick: pick, decline: decline,
    paveLeft: paveLeft, usePave: usePave, openBench: openBench, close: close, isOpen: isOpen
  };
})(window);
