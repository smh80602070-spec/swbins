/**
 * 5천하 격자 전투 필살기 (W-0456, 창세기전식 — 사용자 10-26 「랑그릿사나 창세기전 같은 턴 방식이고 잼나야함」)
 * ---------------------------------------------------------------
 * 장수(양쪽)마다 게이지 0~100 — 칠 때 +30 · 맞을 때 +20 · 휘하 용병이 쓰러지면 +20. 100 이면 필살기 한 번(쓰면 0).
 * 내 장수는 30 에서 시작(사기) · 적은 0.75배로 찬다(장수가 센 후반 적이 필살로 몰아치지 않게 — realm-balance).
 *   무력 무쌍   사거리 안 적 하나 — 반드시 맞는 2배 피해 + 그 곁(상하좌우) 적에게 절반
 *   지력 천뢰   3칸 안 칸 하나 — 그 칸과 상하좌우 적 모두에 (14 + 지력/4) × 피해 배수
 *   통솔 총공격 지휘 범위(없으면 3칸) 안 휘하·곁 아군 용병 체력 +40% · 이번 턴 명중 +25%p
 * 갈래 = 고유 스킬 갈래(hero-skill) · 없으면 지력 ≥ 무력이면 지력. 기록 b.ultLog[{t, a, kind, name, hits}] · 피해는 b.log 에도(띄움 숫자).
 * 판 규칙 층(tactics.js)이 한 줄씩 부른다. three·DOM 없이 돈다(진단이 본다). 손잡이 rtk.ultimate(1, 0 = 없음).
 *
 *   DG.ultimate.kindOf(u) / ready(b, uid) / cells(b, uid) / use(b, uid, x, y) / ai(b, u)
 *   DG.ultimate.onAttack(b, a, t, hit) · mods(b, att, tgt, out) · cutFor(v, art, name, rerender)
 */
(function (global) {
  'use strict';
  function C() { return global.DG.core; }
  function T() { return global.DG.tactics; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('rtk.ultimate', 1)); }
  function DMG() { var c = C(); return c && c.tuned ? +c.tuned('rtk.tacticsDmg', 2) : 2; }

  var FULL = 100, GAIN_ATK = 30, GAIN_HIT = 20, GAIN_LOSS = 20, BOLT_R = 3, RALLY_HIT = 25, RALLY_HEAL = 0.4, CUT_MS = 1600;
  var KIND = {
    musang:    { name: '무쌍',   emoji: '⚔️', desc: '사거리 안 적 하나 — 반드시 맞는 2배 피해 + 곁 적 절반' },
    cheonroe:  { name: '천뢰',   emoji: '⚡', desc: '3칸 안 칸 하나 — 그 칸과 상하좌우 적 모두에 벼락' },
    chonggong: { name: '총공격', emoji: '🚩', desc: '범위 안 용병 체력 +40% · 이번 턴 명중 +25%p' }
  };

  function kindOf(u) {
    if (!u || u.kind !== 'officer') { return null; }
    var g = u.skill && u.skill.g;
    if (!g) { var might = (u.atk - 10) * 5; g = (u.wis || 0) >= might ? 'wisdom' : 'might'; }
    return g === 'wisdom' ? 'cheonroe' : (g === 'command' ? 'chonggong' : 'musang');
  }
  function knob(k, d) { var c = C(); return c && c.tuned ? +c.tuned(k, d) : d; }   // 손잡이 rtk.ultStart(내 장수 처음 게이지, 30)·rtk.ultFoe(적이 차는 %, 75)
  function sp(u) { if (u.sp == null) { u.sp = u.side === 'me' ? knob('rtk.ultStart', 30) : 0; } return u.sp; }
  function gain(u, n) { if (u && u.kind === 'officer' && u.hp > 0) { u.sp = Math.min(FULL, sp(u) + Math.round(n * (u.side === 'me' ? 1 : knob('rtk.ultFoe', 75) / 100))); } }
  function ready(b, uid) {
    var u = T().unit(b, uid);
    return on() && b.srpg && !!u && u.kind === 'officer' && u.hp > 0 && !u.acted && !b.done && u.side === b.side && sp(u) >= FULL;
  }
  function d1(a, x, y) { return Math.abs(a.x - x) + Math.abs(a.y - y); }
  function foesOf(b, u) { return T().alive(b, u.side === 'me' ? 'foe' : 'me'); }
  /** 고를 칸 [{x,y}] — 무쌍 = 닿는 적 자리 · 천뢰 = 3칸 안 모든 칸 · 총공격 = 제자리 */
  function cells(b, uid) {
    if (!ready(b, uid)) { return []; }
    var u = T().unit(b, uid), k = kindOf(u), out = [], x, y;
    if (k === 'musang') { foesOf(b, u).forEach(function (t) { if (d1(u, t.x, t.y) <= u.rng) { out.push({ x: t.x, y: t.y }); } }); }
    else if (k === 'cheonroe') { for (y = 0; y < b.rows; y++) { for (x = 0; x < b.cols; x++) { if (d1(u, x, y) <= BOLT_R) { out.push({ x: x, y: y }); } } } }
    else { out.push({ x: u.x, y: u.y }); }
    return out;
  }
  function hurt(b, a, t, dmg, name, hits) {
    t.hp = Math.max(0, t.hp - dmg);
    b.log.push({ t: b.turn, a: a.uid, to: t.uid, hit: true, dmg: dmg, ch: 100, ult: name });
    hits.push({ uid: t.uid, dmg: dmg, killed: t.hp <= 0 });
  }
  /** 쓴다 — {ok, kind, name, hits} */
  function use(b, uid, x, y) {
    if (!cells(b, uid).some(function (c) { return c.x === x && c.y === y; })) { return { ok: false }; }
    var u = T().unit(b, uid), k = kindOf(u), K = KIND[k], hits = [], heal = 0;
    if (k === 'musang') {
      var tg = foesOf(b, u).filter(function (t) { return t.x === x && t.y === y; })[0], base = Math.round(u.atk * DMG());
      if (x !== u.x || y !== u.y) { if (Math.abs(x - u.x) >= Math.abs(y - u.y)) { u.fx = Math.sign(x - u.x); u.fy = 0; } else { u.fx = 0; u.fy = Math.sign(y - u.y); } }
      hurt(b, u, tg, base * 2, K.name, hits);
      foesOf(b, u).forEach(function (o) { if (o !== tg && d1(o, x, y) === 1) { hurt(b, u, o, Math.round(base), K.name, hits); } });
    } else if (k === 'cheonroe') {
      var bolt = Math.round((14 + (u.wis || 0) / 4) * DMG());
      foesOf(b, u).forEach(function (o) { if (d1(o, x, y) <= 1) { hurt(b, u, o, bolt, K.name, hits); } });
    } else {
      var R = u.cmdR || 3;
      b.units.forEach(function (m) {
        if (m.side !== u.side || m.hp <= 0 || m === u || m.kind !== 'troop' || d1(m, u.x, u.y) > R) { return; }
        var h0 = m.hp; m.hp = Math.min(m.max, m.hp + Math.round(m.max * RALLY_HEAL)); heal += m.hp - h0; m.rallyT = b.turn; hits.push({ uid: m.uid, dmg: -(m.hp - h0), killed: false });
      });
    }
    u.sp = 0; u.acted = true; u.moved = true;
    (b.ultLog = b.ultLog || []).push({ t: b.turn, a: uid, kind: k, name: K.name, x: x, y: y, hits: hits, heal: heal });
    if (T().check) { T().check(b); }
    return { ok: true, kind: k, name: K.name, hits: hits };
  }
  /** AI — 쓸 만하면 쓴다(true) */
  function ai(b, u) {
    if (!ready(b, u.uid)) { return false; }
    var k = kindOf(u), cs = cells(b, u.uid), best = null, bs = 0;
    cs.forEach(function (c) {
      var s = 0;
      if (k === 'musang') { foesOf(b, u).forEach(function (o) { if (o.x === c.x && o.y === c.y) { s += o.kind === 'officer' ? 3 : 2; } else if (d1(o, c.x, c.y) === 1) { s += 1; } }); }
      else if (k === 'cheonroe') { foesOf(b, u).forEach(function (o) { if (d1(o, c.x, c.y) <= 1) { s += o.kind === 'officer' ? 1.5 : 1; } }); if (s < 2) { s = 0; } }
      else { s = b.units.filter(function (m) { return m.side === u.side && m.hp > 0 && m.kind === 'troop' && d1(m, u.x, u.y) <= (u.cmdR || 3); }).length; if (s < 2) { s = 0; } }
      if (s > bs) { bs = s; best = c; }
    });
    return best ? use(b, u.uid, best.x, best.y).ok : false;
  }
  /** attack 뒤 — 게이지 */
  function onAttack(b, a, t, hit) {
    if (!on() || !b.srpg) { return; }
    gain(a, GAIN_ATK);
    if (hit) { gain(t, GAIN_HIT); }
    if (t.hp <= 0 && t.cmd) { gain(T().unit(b, t.cmd), GAIN_LOSS); }
  }
  function mods(b, att, tgt, out) { if (att.rallyT != null && att.rallyT === b.turn) { out.push(['총공격', RALLY_HIT]); } }

  /* ── 화면(DOM 문자열만) ── */
  var css = false;
  function cssOnce() {
    if (css || !global.document) { return; }
    css = true;
    var st = global.document.createElement('style');
    st.textContent = '.ult-cut{position:absolute;inset:0;z-index:30;pointer-events:none;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
      '.ult-cut:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,#0000 30%,#000c 100%);animation:ultFade 1.6s ease-out forwards}' +
      '.ult-band{position:relative;width:120%;height:42%;min-height:150px;display:flex;align-items:center;gap:22px;padding-left:12%;transform:skewY(-6deg);background:linear-gradient(90deg,#3a0d06f2,#8a2a10f2 45%,#3a0d06f2);border-top:3px solid #f3d27a;border-bottom:3px solid #f3d27a;animation:ultIn 1.6s cubic-bezier(.2,.8,.2,1) forwards;box-shadow:0 0 40px #ff8a3a88}' +
      '.ult-band.foe{background:linear-gradient(90deg,#0b1430f2,#1d3a8af2 45%,#0b1430f2)}' +
      '.ult-band img{height:150%;max-height:260px;transform:skewY(6deg);filter:drop-shadow(0 0 12px #000);animation:ultImg 1.6s ease-out forwards}' +
      '.ult-band .tx{transform:skewY(6deg);color:#fff;font:900 clamp(30px,6vw,64px)/1 serif;letter-spacing:4px;text-shadow:0 0 18px #ffb34a,0 3px 0 #000}' +
      '.ult-band .tx small{display:block;font:700 clamp(14px,2vw,20px)/1.6 sans-serif;letter-spacing:1px;color:#ffe9a0}' +
      '@keyframes ultIn{0%{transform:translateX(-100%) skewY(-6deg)}18%{transform:translateX(0) skewY(-6deg)}82%{transform:translateX(0) skewY(-6deg);opacity:1}100%{transform:translateX(30%) skewY(-6deg);opacity:0}}' +
      '@keyframes ultImg{0%{transform:translateX(-40px) skewY(6deg) scale(1.1)}30%{transform:translateX(0) skewY(6deg) scale(1)}}@keyframes ultFade{0%{opacity:0}15%{opacity:1}85%{opacity:1}100%{opacity:0}}' +
      '.ult-gauge{height:6px;border-radius:3px;background:#0008;margin-top:4px;overflow:hidden}.ult-gauge i{display:block;height:100%;background:linear-gradient(90deg,#ff8a3a,#ffe27a)}.ult-gauge.full i{animation:ultPulse .8s infinite alternate}@keyframes ultPulse{to{filter:brightness(1.6)}}';
    global.document.head.appendChild(st);
  }
  /** 새 필살기 기록이 있으면 컷인(CUT_MS) — 다시 그리기를 한 번 예약 */
  function cutFor(v, art, name, rerender) {
    var L = v.b.ultLog || [];
    if (v.ultN == null) { v.ultN = L.length; }
    if (L.length > v.ultN) { v.ultN = L.length; v.ultCut = { e: L[L.length - 1], at: Date.now() }; [300, 800, CUT_MS + 30].forEach(function (ms) { global.setTimeout(function () { rerender(); }, ms); }); }   // 중간에도 다시 그린다 — 애니메이션이 멈춘 곳(헤드리스·느린 폰)에서도 지난 시간만큼 당겨 보이게
    var c = v.ultCut, el = !c ? 0 : v.ultHold != null ? v.ultHold : Date.now() - c.at;   // ultHold(ms) = 촬영용 멈춤(헤드리스는 촬영이 1초 넘게 걸려 컷이 지나간다)
    if (!c || el > CUT_MS) { return ''; }
    cssOnce();
    var u = T().unit(v.b, c.e.a), src = u ? art(u) : '', K = KIND[c.e.kind] || {}, hit = c.e.hits.filter(function (h) { return h.dmg > 0; }), kills = hit.filter(function (h) { return h.killed; }).length;
    var sub = c.e.kind === 'chonggong' ? '용병 ' + c.e.hits.length + ' · 체력 +' + c.e.heal + ' · 명중 +' + RALLY_HIT + '%p' : '맞음 ' + hit.length + (kills ? ' · 격파 ' + kills : '');
    var e = (el / 1000).toFixed(2);
    return '<div class="ult-cut" style="animation-delay:-' + e + 's"><div class="ult-band' + (u && u.side === 'foe' ? ' foe' : '') + '" style="animation-delay:-' + e + 's">' + (src ? '<img src="' + String(src).replace(/"/g, '&quot;') + '" alt="">' : '') +
      '<div class="tx">' + (K.emoji || '') + ' ' + (K.name || '') + '!<small>' + (u ? name(u) : '') + ' · ' + sub + '</small></div></div></div>';
  }
  /** 장수 카드 — 게이지 막대 + 단추 */
  function cardHtml(b, u, armed) {
    if (!on() || !b.srpg || !u || u.kind !== 'officer') { return ''; }
    cssOnce();
    var k = KIND[kindOf(u)], g = sp(u), full = g >= FULL;
    return '<div class="ult-gauge' + (full ? ' full' : '') + '"><i style="width:' + g + '%"></i></div><span class="muted">' + k.emoji + ' 필살 「' + k.name + '」 ' + g + '% — ' + k.desc + '</span>' +
      (u.side === 'me' && ready(b, u.uid) ? ' <button class="btn tiny' + (armed ? ' primary' : '') + '" data-tv="ult">💥 ' + k.name + (armed ? ' — 대상 칸을 누르십시오' : '') + '</button>' : '');
  }

  global.DG = global.DG || {};
  global.DG.ultimate = { on: on, KIND: KIND, FULL: FULL, GAIN_ATK: GAIN_ATK, GAIN_HIT: GAIN_HIT, GAIN_LOSS: GAIN_LOSS, kindOf: kindOf, ready: ready, cells: cells, use: use, ai: ai,
    onAttack: onAttack, mods: mods, cutFor: cutFor, cardHtml: cardHtml };
})(typeof window !== 'undefined' ? window : this);
