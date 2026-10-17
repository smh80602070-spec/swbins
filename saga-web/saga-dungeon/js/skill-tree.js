/**
 * 2나락 — 무예별 작은 나무 (W-0280, 라스트 에포크식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 같은 무예는 누가 써도 같았다 → 무예가 **쓰일 때마다 경험**이 쌓여 무예 레벨 1~20, 레벨마다 점수 1 을
 * 그 무예만의 나무(마디 8, 마디마다 갈래 둘 중 하나)에 찍는다. 비결(§5.9, secret.js)은 "모양"을 바꾸고
 * 이 나무는 **수치·덧붙임만**(위력·기력·재냉각·범위·흡수·결·연타). 되돌리기는 금 200 — 경험은 남는다.
 *
 *   마디는 앞 마디에 점 1 이 있어야 열린다 · 한 마디 최대 3점(결 마디는 1점) · 고른 갈래는 되돌리기 전엔 못 바꾼다
 *   효과는 secretMod 가 돌려준 배수(m.dmg·cost·cd·drain)와 m.sk 복제본(r·el·shots·hops)에 얹는다 → castSkill·HUD 가 같이 본다
 *   세이브 save.skillTree = { [무예 key]: { xp, pts: [마디마다 +n(갈래 가) / -n(갈래 나)] } } — 옛 세이브엔 없다(빈 것)
 *   무예(인물 아님)마다 하나 — 같은 무예를 누가 쓰든 나무는 하나(목표 "무예 하나를 깊게")
 */
(function (global) {
  'use strict';

  var MAX_LV = 20, NODES = 8, NODE_MAX = 3, RESET_GOLD = 200;
  /** 레벨 L → L+1 에 드는 경험(시전 1 = 1) · 20 까지 누적 1520 */
  function need(lv) { return lv * 8; }

  /* 마디 여덟 — 갈래 가/나. per = 점 하나당. 모양에 없는 축(범위 없는 무예의 '범위' 등)은 위력으로 대신 */
  var TREE = [
    { a: { k: 'dmg',   n: '위력',   per: 4 }, b: { k: 'cost',  n: '기력',   per: 6 } },
    { a: { k: 'cd',    n: '재냉각', per: 4 }, b: { k: 'range', n: '범위',   per: 6 } },
    { a: { k: 'dmg',   n: '위력',   per: 5 }, b: { k: 'drain', n: '흡수',   per: 3 } },
    { a: { k: 'fire',  n: '불 결',  per: 1, max: 1 }, b: { k: 'cold', n: '한기 결', per: 1, max: 1 } },
    { a: { k: 'cost',  n: '기력',   per: 5 }, b: { k: 'cd',    n: '재냉각', per: 3 } },
    { a: { k: 'dmg',   n: '위력',   per: 6 }, b: { k: 'range', n: '범위',   per: 8 } },
    { a: { k: 'multi', n: '연타',   per: 1, max: 1 }, b: { k: 'cd',    n: '재냉각', per: 5 } },
    { a: { k: 'dmg',   n: '위력',   per: 8 }, b: { k: 'cost',  n: '기력',   per: 8 } }
  ];
  function maxOf(opt) { return opt.max || NODE_MAX; }
  function label(opt) {
    if (opt.k === 'fire' || opt.k === 'cold') { return opt.n + ' 덧붙임'; }
    if (opt.k === 'multi') { return '연타 +1(화살·연환·부르기)'; }
    return opt.n + (opt.k === 'cost' || opt.k === 'cd' ? ' -' : ' +') + opt.per + '%' + (opt.k === 'drain' ? 'p' : '');
  }

  function core() { return global.DG.core; }
  function all() {
    var s = core().save;
    if (!s.skillTree || typeof s.skillTree !== 'object') { s.skillTree = {}; }
    return s.skillTree;
  }
  function of(key) {
    var t = all()[key];
    if (!t) { t = all()[key] = { xp: 0, pts: [] }; }
    if (!t.pts) { t.pts = []; }
    return t;
  }
  function peek(key) { var s = core().save; return s.skillTree && s.skillTree[key] || null; }
  /** 레벨 1~20 (누적 경험으로) */
  function lvOf(key) {
    var t = peek(key), xp = t ? t.xp : 0, lv = 1;
    while (lv < MAX_LV && xp >= need(lv)) { xp -= need(lv); lv += 1; }
    return lv;
  }
  /** 다음 레벨까지 — { xp, need } (최고 레벨이면 need 0) */
  function progress(key) {
    var t = peek(key), xp = t ? t.xp : 0, lv = 1;
    while (lv < MAX_LV && xp >= need(lv)) { xp -= need(lv); lv += 1; }
    return { lv: lv, xp: xp, need: lv < MAX_LV ? need(lv) : 0 };
  }
  function spent(key) { var t = peek(key), n = 0, i; if (!t) { return 0; } for (i = 0; i < t.pts.length; i++) { n += Math.abs(t.pts[i] || 0); } return n; }
  function pointsLeft(key) { return Math.max(0, lvOf(key) - 1 - spent(key)); }

  /** 무예가 쓰였다 — castSkill 이 부른다. 레벨이 오르면 토스트 */
  function gain(key, n) {
    if (!key) { return 0; }
    var t = of(key), before = lvOf(key);
    t.xp += (n || 1);
    var after = lvOf(key);
    if (after > before) {
      var SD = global.DG.skillData, sk = SD && SD.skillByKey ? SD.skillByKey(key) : null;
      core().emit('toast', '🌱 ' + (sk ? sk.emoji + ' ' + sk.name : key) + ' 무예 레벨 ' + after + ' — 나무에 점 하나');
      core().emit('changed');
    }
    return after;
  }

  /** 이 마디에 이 갈래로 점을 찍을 수 있나 — 못 하면 이유 */
  function why(key, i, side) {
    var t = of(key), cur = t.pts[i] || 0, opt;
    if (i < 0 || i >= NODES || (side !== 'a' && side !== 'b')) { return 'arg'; }
    if (i > 0 && !(t.pts[i - 1])) { return 'prereq'; }
    if ((side === 'a' && cur < 0) || (side === 'b' && cur > 0)) { return 'side'; }
    opt = TREE[i][side];
    if (Math.abs(cur) >= maxOf(opt)) { return 'max'; }
    if (pointsLeft(key) < 1) { return 'point'; }
    return null;
  }
  function put(key, i, side) {
    var w = why(key, i, side);
    if (w) { return { ok: false, reason: w }; }
    var t = of(key);
    t.pts[i] = (t.pts[i] || 0) + (side === 'a' ? 1 : -1);
    core().emit('changed');
    return { ok: true, pts: t.pts.slice() };
  }
  /** 되돌리기 — 금 200, 경험은 그대로 */
  function reset(key) {
    var t = of(key), p = core().save.player;
    if (!spent(key)) { return { ok: false, reason: 'empty' }; }
    if (!p || (p.gold || 0) < RESET_GOLD) { return { ok: false, reason: 'gold', need: RESET_GOLD }; }
    p.gold -= RESET_GOLD;
    t.pts = [];
    core().emit('changed');
    return { ok: true };
  }

  /** 찍은 점 → 축마다 합 { dmg, cost, cd, range, drain, fire, cold, multi } */
  function sums(key) {
    var t = peek(key), out = { dmg: 0, cost: 0, cd: 0, range: 0, drain: 0, fire: 0, cold: 0, multi: 0 }, i, v, opt;
    if (!t) { return out; }
    for (i = 0; i < NODES; i++) {
      v = t.pts[i] || 0;
      if (!v) { continue; }
      opt = TREE[i][v > 0 ? 'a' : 'b'];
      out[opt.k] += opt.per * Math.abs(v);
    }
    return out;
  }
  /** secretMod 가 돌려준 m(dmg·cost·cd·drain·sk) 에 나무를 얹는다 — 원본 무예는 안 건드린다(복제) */
  function apply(m) {
    var sk = m && m.sk, s, c, k;
    if (!sk || !sk.key || !peek(sk.key)) { return m; }
    s = sums(sk.key);
    if (s.dmg) { m.dmg *= 1 + s.dmg / 100; }
    if (s.cost) { m.cost *= Math.max(0.3, 1 - s.cost / 100); }
    if (s.cd) { m.cd *= Math.max(0.3, 1 - s.cd / 100); }
    if (s.drain) { m.drain = (m.drain || 0) + s.drain; m.drainSec = m.drainSec || 6; }
    if (s.range || s.fire || s.cold || s.multi) {
      c = {}; for (k in sk) { if (Object.prototype.hasOwnProperty.call(sk, k)) { c[k] = sk[k]; } }
      if (s.range) { if (typeof c.r === 'number') { c.r *= 1 + s.range / 100; } else { m.dmg *= 1 + s.range / 200; } }
      if (s.fire || s.cold) { if (!c.el) { c.el = s.fire ? 'fire' : 'cold'; } else { m.dmg *= 1.05; } }
      if (s.multi) {
        if (c.shape === 'bolt') { c.shots = (c.shots || 1) + 1; }
        else if (c.shape === 'chain') { c.hops = (c.hops || 1) + 1; }
        else if (c.shape === 'summon') { m.summonAdd = (m.summonAdd || 0) + 1; }
        else { m.dmg *= 1.06; }
      }
      m.sk = c;
    }
    m.tree = s;
    return m;
  }

  /* ── 무예 창 칸(ui.js 무예 줄 끝) ── */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function rowHtml(key) {
    var pr = progress(key), t = peek(key), left = pointsLeft(key), i, cur, html;
    html = '<div class="gr-tree"><small class="muted">나무 Lv ' + pr.lv + (pr.need ? ' · ' + pr.xp + '/' + pr.need : ' · 끝') +
      ' · 점 ' + left + '</small>' + (left ? '' : (t && spent(key) ? '' : ' <span class="muted">무예를 쓰면 경험이 쌓인다</span>'));
    for (i = 0; i < NODES; i++) {
      cur = t ? (t.pts[i] || 0) : 0;
      html += '<div class="gr-node' + (cur ? ' on' : '') + '">' +
        ['a', 'b'].map(function (side) {
          var opt = TREE[i][side], mine = (side === 'a' && cur > 0) || (side === 'b' && cur < 0), w = why(key, i, side);
          return '<button class="btn tiny' + (mine ? ' primary' : '') + '"' + (w ? ' disabled' : '') +
            ' data-tree="' + esc(key) + '" data-node="' + i + '" data-side="' + side + '" title="' + esc(label(opt)) + '">' +
            esc(label(opt)) + (mine ? ' ×' + Math.abs(cur) : '') + '</button>';
        }).join('<span class="muted"> | </span>') + '</div>';
    }
    if (spent(key)) { html += '<button class="btn tiny" data-tree="' + esc(key) + '" data-reset="1">↩ 되돌리기 🪙' + RESET_GOLD + '</button>'; }
    return html + '</div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-tree]') : null, r;
      if (!b || b.disabled) { return; }
      if (b.getAttribute('data-reset')) {
        r = reset(b.getAttribute('data-tree'));
        core().emit('toast', r.ok ? '↩ 나무를 되돌렸다 — 경험은 그대로' : r.reason === 'gold' ? '🪙 금이 모자랍니다(' + RESET_GOLD + ')' : '되돌릴 점이 없습니다');
      } else {
        r = put(b.getAttribute('data-tree'), parseInt(b.getAttribute('data-node'), 10), b.getAttribute('data-side'));
        core().emit('toast', r.ok ? '🌱 ' + label(TREE[parseInt(b.getAttribute('data-node'), 10)][b.getAttribute('data-side')]) : r.reason === 'point' ? '점이 없습니다 — 무예를 더 쓰면 쌓인다' : r.reason === 'prereq' ? '앞 마디를 먼저' : r.reason === 'side' ? '다른 갈래를 골랐습니다 — 되돌리기로' : '더 못 찍습니다');
      }
      core().persist();
    });
  }

  global.DG = global.DG || {};
  global.DG.skillTree = {
    TREE: TREE, MAX_LV: MAX_LV, NODES: NODES, NODE_MAX: NODE_MAX, RESET_GOLD: RESET_GOLD, need: need,
    lvOf: lvOf, progress: progress, spent: spent, pointsLeft: pointsLeft, gain: gain, why: why, put: put, reset: reset,
    sums: sums, apply: apply, rowHtml: rowHtml, label: label
  };
})(window);
