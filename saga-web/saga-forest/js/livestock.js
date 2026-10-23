/**
 * 3마을 — 가축 기르기 (W-0299, 장부 forest.md 우선 2 · 스타듀 밸리·마인크래프트 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 들짐승은 구경만 했다 → 🔨 제작대 "작은 우리"(kind 'pen', 하나)를 지으면 내 집 곁에 울타리가 서고,
 * 꾸미기 창에서 금을 내고 꼬꼬(닭)·매매(염소) 새끼를 들인다(최대 MAX). 날마다 열매·견과 하나를 먹이면
 * 다음 아침(rollDay) 달걀·산양젖을 가방에 넣어 준다 — 안 먹인 날은 없음, 사흘 내리 굶으면 떠난다.
 * 하루 한 번 쓰다듬으면 하트 +1(최대 5) · 하트 3 이상이면 산물 둘.
 *
 *   세이브 save.village.livestock = { pen: bool, list: [{ kind, name, fed, petted, heart, hungry, day }] } — 옛 세이브엔 없다(빈 것)
 *   잇기: craft.js kind 'pen' · ui/02 꾸미기 창 sheetHtml() · village rollDay 끝 rollDay() · village-view 집 곁 draw2d()
 *   손잡이 village.livestock(1, 0 = 끔)
 */
(function (global) {
  'use strict';

  var MAX = 4, HEART_MAX = 5, LEAVE_DAYS = 3;
  var KINDS = {
    chick: { name: '꼬꼬', emoji: '🐔', price: 400, product: 'egg' },
    goat:  { name: '매매', emoji: '🐐', price: 900, product: 'milk' }
  };
  var FEED_CATS = ['fruit', 'nut'];
  /* W-0393 — 2D 그림(K-0181): 종 → 공장 시트 풀(assets/sprites2d_sheets/<풀>/ idle·walk·run·hit, index.json factory) · 울타리 shared/assets/world2d */
  var POOL = { chick: 'farm_hen', goat: 'farm_goat' }, POOL_SCALE = { chick: 0.42, goat: 0.6 }, FENCE = { fence: 'pen_fence_01', gate: 'pen_gate_01' };
  var penImgs = {};
  function penImg(key) {
    var e = penImgs[key];
    if (e) { return e.ok ? e.img : null; }
    if (typeof Image === 'undefined') { penImgs[key] = { ok: false }; return null; }
    var A = global.DG.assets3d, base = A && A.sharedUrl ? A.sharedUrl('world2d/') : null;
    e = penImgs[key] = { ok: false, img: new Image() };
    e.img.onload = function () { e.ok = true; };
    e.img.src = (base || '../shared/assets/world2d/') + FENCE[key] + '.webp';
    return null;
  }
  /** 울타리 — 위·아래 가로 이음 + 아래 가운데 문. 그림이 아직이면 false(옛 선 그림) */
  function drawPen(ctx, x, y, w, h, k) {
    var f = penImg('fence'), g = penImg('gate');
    if (!f) { return false; }
    var fh = 11 * k, fw = fh * (f.naturalWidth / f.naturalHeight), i, n = Math.ceil(w / fw);
    ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y - h - fh, w, h + fh); ctx.clip();
    for (i = 0; i < n; i++) { ctx.drawImage(f, x - w / 2 + i * fw, y - h - fh * 0.8, fw, fh); }
    for (i = 0; i < n; i++) { ctx.drawImage(f, x - w / 2 + i * fw, y - fh, fw, fh); }
    if (g) { var gw = fh * (g.naturalWidth / g.naturalHeight); ctx.drawImage(g, x - gw / 2, y - fh, gw, fh); }
    ctx.restore();
    return true;
  }
  /** 짐승 한 마리 — 공장 시트(mode2d.draw)가 되면 true */
  function drawBeast(ctx, a, ax, ay, dir, moving, now, k) {
    var M2 = global.DG.mode2d, pool = POOL[a.kind];
    if (!M2 || !M2.draw || !pool) { return false; }
    return M2.draw(ctx, { pool: pool, x: ax, y: ay, dirX: dir, dirY: 0.35, clip: moving ? 'walk' : 'idle', ms: now || 0, scale: (POOL_SCALE[a.kind] || 0.5) * k });
  }

  function core() { return global.DG.core; }
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('village.livestock', 1)); }
  function st() {
    var s = V().state();
    if (!s.livestock || typeof s.livestock !== 'object') { s.livestock = { pen: false, list: [] }; }
    if (!Array.isArray(s.livestock.list)) { s.livestock.list = []; }
    return s.livestock;
  }
  function gold() { return core().save.player.gold || 0; }

  function hasPen() { return !!st().pen; }
  function buildPen() { if (hasPen()) { return { ok: false, why: '우리는 하나만' }; } st().pen = true; core().emit('changed'); return { ok: true }; }

  /** 새끼 들이기 — { ok, why } */
  function buy(kind) {
    var K = KINDS[kind], L = st();
    if (!on()) { return { ok: false, why: '가축 기르기가 꺼져 있다' }; }
    if (!K) { return { ok: false, why: '없는 짐승' }; }
    if (!L.pen) { return { ok: false, why: '🔨 제작대에서 작은 우리를 먼저 짓는다' }; }
    if (L.list.length >= MAX) { return { ok: false, why: '우리엔 ' + MAX + '마리까지' }; }
    if (gold() < K.price) { return { ok: false, why: '금이 모자란다 (' + K.price + '벨)' }; }
    core().save.player.gold -= K.price;
    var n = L.list.filter(function (a) { return a.kind === kind; }).length;
    L.list.push({ kind: kind, name: K.name + (n ? ' ' + (n + 1) : ''), fed: false, petted: false, heart: 0, hungry: 0, day: V().state().day });
    core().emit('changed');
    return { ok: true };
  }
  /** 먹일 것 — 가방의 열매·견과 중 가장 싼 것 key (없으면 null) */
  function feedKey() {
    var bag = V().state().bag || {}, best = null, bp = Infinity, k, it;
    for (k in bag) {
      if (!bag.hasOwnProperty(k) || !(bag[k] > 0)) { continue; }
      it = VD().item(k);
      if (it && FEED_CATS.indexOf(it.cat) >= 0 && it.price < bp) { best = k; bp = it.price; }
    }
    return best;
  }
  function feed(i) {
    var a = st().list[i], k;
    if (!a) { return { ok: false, why: '없다' }; }
    if (a.fed) { return { ok: false, why: '오늘은 이미 먹였다' }; }
    k = feedKey();
    if (!k) { return { ok: false, why: '먹일 열매·견과가 없다' }; }
    V().state().bag[k] -= 1; a.fed = true;
    return { ok: true, key: k };
  }
  function pet(i) {
    var a = st().list[i];
    if (!a) { return { ok: false, why: '없다' }; }
    if (a.petted) { return { ok: false, why: '오늘은 이미 쓰다듬었다' }; }
    a.petted = true; a.heart = Math.min(HEART_MAX, (a.heart || 0) + 1);
    return { ok: true, heart: a.heart };
  }

  /** 아침 — 어제 먹은 짐승은 산물(하트 3+ 이면 둘), 굶은 짐승은 굶은 날 +1(사흘이면 떠남). 결과 { got: {key:n}, left: [이름] } */
  function rollDay() {
    var out = { got: {}, left: [] };
    if (!on()) { return out; }
    var L = st(), keep = [], i, a, K, n, it;
    for (i = 0; i < L.list.length; i++) {
      a = L.list[i]; K = KINDS[a.kind];
      if (a.fed && K) {
        n = (a.heart || 0) >= 3 ? 2 : 1; it = VD().item(K.product);
        if (it) { V().bagAdd(it, n); out.got[K.product] = (out.got[K.product] || 0) + n; }
        a.hungry = 0;
      } else { a.hungry = (a.hungry || 0) + 1; }
      a.fed = false; a.petted = false;
      if (a.hungry >= LEAVE_DAYS) { out.left.push(a.name); } else { keep.push(a); }
    }
    L.list = keep;
    var msg = Object.keys(out.got).map(function (k) { var t = VD().item(k); return (t ? t.emoji + ' ' + t.name : k) + ' ' + out.got[k]; }).join(' · ');
    if (msg) { core().log('🐔 우리 — 아침에 거뒀다: ' + msg, 'good'); }
    if (out.left.length) { core().log('🐐 사흘 굶은 ' + out.left.join('·') + ' 이(가) 우리를 떠났다', 'warn'); }
    return out;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sheetHtml() {
    if (!on()) { return ''; }
    var L = st(), html = '<div class="sec"><h4>작은 우리 <span class="muted">' + L.list.length + '/' + MAX + '</span></h4>';
    if (!L.pen) { return html + '<div class="hint">🔨 제작대에서 "작은 우리"를 지으면 집 곁에 닭·염소를 들여 아침마다 달걀·젖을 거둘 수 있습니다.</div></div>'; }
    L.list.forEach(function (a, i) {
      var K = KINDS[a.kind] || { emoji: '?' };
      html += '<div class="card"><div class="stat-row"><span>' + K.emoji + ' ' + esc(a.name) + ' <small class="muted">' + '♥'.repeat(a.heart || 0) + '♡'.repeat(HEART_MAX - (a.heart || 0)) + '</small></span><b>' +
        (a.fed ? '배부름' : (a.hungry ? '굶은 날 ' + a.hungry : '배고픔')) + '</b></div><div class="life-chips">' +
        '<button class="btn tiny" data-ls="feed" data-i="' + i + '"' + (a.fed ? ' disabled' : '') + '>🍎 먹이 주기</button>' +
        '<button class="btn tiny ghost" data-ls="pet" data-i="' + i + '"' + (a.petted ? ' disabled' : '') + '>🤚 쓰다듬기</button></div></div>';
    });
    if (L.list.length < MAX) {
      html += '<div class="life-chips"><small class="muted">들이기:</small>';
      Object.keys(KINDS).forEach(function (k) { var K = KINDS[k]; html += '<button class="btn tiny" data-ls="buy" data-key="' + k + '">' + K.emoji + ' ' + K.name + ' 새끼 ' + K.price + '벨</button>'; });
      html += '</div>';
    }
    return html + '</div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-ls]') : null, r, act;
      if (!b || b.disabled) { return; }
      act = b.getAttribute('data-ls');
      if (act === 'buy') { r = buy(b.getAttribute('data-key')); core().emit('toast', r.ok ? '🐣 우리에 들였다 — 날마다 열매·견과를 먹이면 아침에 거둔다' : r.why); }
      else if (act === 'feed') { r = feed(+b.getAttribute('data-i')); core().emit('toast', r.ok ? '🍎 먹였다 — 내일 아침에 거둔다' : r.why); }
      else { r = pet(+b.getAttribute('data-i')); core().emit('toast', r.ok ? '🤚 좋아한다 ♥' + r.heart : r.why); }
      core().persist(); core().emit('changed');
    });
  }

  /** 2D — 집 곁 울타리(발 밑 가운데 x, y · 배율 k)와 그 안을 돌아다니는 짐승 — W-0393 공장 시트·울타리 그림, 못 받으면 옛 코드 그림 */
  function draw2d(ctx, x, y, k, now) {
    if (!on() || !hasPen() || !ctx) { return false; }
    var L = st(), w = 64 * k, h = 26 * k, i, a, t, ax, ay;
    ctx.save();
    ctx.fillStyle = 'rgba(120,150,70,0.35)'; ctx.fillRect(x - w / 2, y - h, w, h);
    if (!drawPen(ctx, x, y, w, h, k)) {   // W-0393 울타리 그림 — 아직이면 옛 선
    ctx.strokeStyle = '#8a6440'; ctx.lineWidth = Math.max(1.5, 2.2 * k);
    ctx.strokeRect(x - w / 2, y - h, w, h);
    for (i = 0; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + i * w / 6, y); ctx.lineTo(x - w / 2 + i * w / 6, y - 9 * k); ctx.stroke(); }
    }
    for (i = 0; i < L.list.length; i++) {
      a = L.list[i]; t = (now || 0) / 1000 + i * 1.7;
      ax = x - w / 2 + (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.37 + i))) * w; ay = y - h + (0.35 + 0.5 * (0.5 + 0.5 * Math.cos(t * 0.29 + i * 2))) * h;
      var hop = Math.abs(Math.sin(t * 3)) * 1.5 * k, dir = Math.cos(t * 0.37 + i) >= 0 ? 1 : -1;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(ax, ay, 6 * k, 2 * k, 0, 0, Math.PI * 2); ctx.fill();
      if (drawBeast(ctx, a, ax, ay, dir, Math.abs(Math.cos(t * 0.37 + i)) > 0.35, now, k)) { continue; }   // W-0393 공장 시트
      if (a.kind === 'goat') {
        ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.ellipse(ax, ay - 7 * k - hop, 8 * k, 5 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ax + dir * 8 * k, ay - 11 * k - hop, 3.6 * k, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#6d6252'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(ax + dir * 8 * k, ay - 14 * k - hop); ctx.lineTo(ax + dir * 5 * k, ay - 18 * k - hop); ctx.stroke();
        ctx.strokeStyle = '#7a6c5c'; for (var lg = -1; lg <= 1; lg += 2) { ctx.beginPath(); ctx.moveTo(ax + lg * 5 * k, ay - 3 * k - hop); ctx.lineTo(ax + lg * 5 * k, ay); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#fbf7ee'; ctx.beginPath(); ctx.ellipse(ax, ay - 5 * k - hop, 5 * k, 4.2 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ax + dir * 4 * k, ay - 9 * k - hop, 2.6 * k, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8423a'; ctx.beginPath(); ctx.arc(ax + dir * 4 * k, ay - 12 * k - hop, 1.3 * k, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9a63a'; ctx.beginPath(); ctx.moveTo(ax + dir * 6.4 * k, ay - 9 * k - hop); ctx.lineTo(ax + dir * 8.4 * k, ay - 8.4 * k - hop); ctx.lineTo(ax + dir * 6.4 * k, ay - 7.8 * k - hop); ctx.fill();
      }
    }
    ctx.restore();
    return true;
  }

  global.DG = global.DG || {};
  global.DG.livestock = { MAX: MAX, KINDS: KINDS, LEAVE_DAYS: LEAVE_DAYS, hasPen: hasPen, buildPen: buildPen, buy: buy, feed: feed, pet: pet, feedKey: feedKey, rollDay: rollDay, list: function () { return st().list; }, POOL: POOL, POOL_SCALE: POOL_SCALE, FENCE: FENCE, drawPen: drawPen, drawBeast: drawBeast, sheetHtml: sheetHtml, draw2d: draw2d };
})(window);
