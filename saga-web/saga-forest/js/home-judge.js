/**
 * 3마을 — 집 꾸미기 계절 심사 (W-0397 ② 웹 역이식 — 정본 고돗 G-0330 · 동물의숲 HHA 구조만)
 * ---------------------------------------------------------------
 * 집 평가는 점수·등급 이름만 보여 줬다 → 「🏠 계절 심사」: 점수 = 집 평가(home.score().total) + 계절 주제 가구 덤
 * (🌸 봄 뜰(ddeul) · ☀️ 여름 부엌(buok) · 🍂 가을 사랑방(sarang) · ❄️ 겨울 안방(anbang) — 하나 +25 · 둘 이상 +40),
 * 문턱 30·80·160·280·450 → ★1~5, 금 = 별 × 300 — 계절마다 가장 높은 별만큼(다시 심사해 오르면 차이만).
 *   세이브 home 상태 안 judge = { key: '계절:해', star } — 순수 추가. 손잡이 judge.on(1).
 *   걸린 자리: ui 집 시트 「집 평가」 줄 뒤 rowHtml()(심사 단추 data-judge) — 계산은 home.score() 를 읽기만 한다.
 */
(function (global) {
  'use strict';

  var THEME = {
    spring: { set: 'ddeul', emoji: '🌸', name: '봄 뜰' },
    summer: { set: 'buok', emoji: '☀️', name: '여름 부엌' },
    autumn: { set: 'sarang', emoji: '🍂', name: '가을 사랑방' },
    winter: { set: 'anbang', emoji: '❄️', name: '겨울 안방' },
  };
  var STEPS = [30, 80, 160, 280, 450], GOLD_PER_STAR = 300, BONUS1 = 25, BONUS2 = 40;

  function core() { return global.DG.core; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('judge.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }
  function Hm() { return global.DG.home; }
  function VD() { return global.DG.villageData; }
  function themeOf(seasonKey) { return THEME[seasonKey] || THEME.spring; }
  function seasonKey() { var s = VD() && VD().season ? VD().season() : null; return s ? s.key : 'spring'; }
  function judgeKey() { return seasonKey() + ':' + new Date().getFullYear(); }
  /** 주제 가구 덤 — 놓은 가구 키 목록·계절 키로(순수) */
  function bonusOf(keys, sKey) {
    var th = themeOf(sKey), n = 0, i, f;
    for (i = 0; i < (keys || []).length; i++) { f = VD().furn(keys[i]); if (f && f.set === th.set) { n++; } }
    return n >= 2 ? BONUS2 : n === 1 ? BONUS1 : 0;
  }
  function starOf(pt) { var s = 0, i; for (i = 0; i < STEPS.length; i++) { if (pt >= STEPS[i]) { s = i + 1; } } return s; }
  function nextOf(pt) { for (var i = 0; i < STEPS.length; i++) { if (pt < STEPS[i]) { return STEPS[i]; } } return null; }
  function placedKeys() { var s = Hm() && Hm().state ? Hm().state() : null; return s && s.items ? s.items.map(function (x) { return x.key; }) : []; }
  function preview() {
    var base = Hm() && Hm().score ? Hm().score().total : 0, sKey = seasonKey(), bonus = bonusOf(placedKeys(), sKey), total = base + bonus;
    return { base: base, bonus: bonus, total: total, star: starOf(total), next: nextOf(total), theme: themeOf(sKey), key: judgeKey() };
  }
  /** 심사 — 돌아온 값 { star, gold, diff } · 같은 계절에 오른 별 차이만 금 */
  function judge() {
    if (!on()) { return { ok: false, why: '꺼짐' }; }
    var s = Hm().state(), p = preview(), j = s.judge && s.judge.key === p.key ? s.judge : { key: p.key, star: 0 };
    var diff = Math.max(0, p.star - j.star), gold = diff * GOLD_PER_STAR;
    if (gold) { core().save.player.gold += gold; }
    s.judge = { key: p.key, star: Math.max(j.star, p.star) };
    if (core().log) { core().log('🏠 ' + p.theme.emoji + ' ' + p.theme.name + ' 심사 — ' + p.total + '점 ' + stars(p.star) + (gold ? ' · 금 +' + gold : ' · 이번 계절 이미 받은 별'), gold ? 'good' : 'info'); }
    if (core().persist) { core().persist(); }
    return { ok: true, star: p.star, gold: gold, diff: diff, total: p.total };
  }
  function stars(n) { var out = '', i; for (i = 0; i < 5; i++) { out += i < n ? '★' : '☆'; } return out; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function rowHtml() {
    if (!on() || !Hm()) { return ''; }
    var p = preview(), s = Hm().state(), j = s.judge && s.judge.key === p.key ? s.judge.star : 0;
    return '<div class="stat-row"><span>' + p.theme.emoji + ' 계절 심사 <small class="muted">' + esc(p.theme.name) + ' 가구 덤 +' + p.bonus + (p.next ? ' · 다음 별까지 ' + (p.next - p.total) : '') + '</small></span><b>' + stars(p.star) + '</b></div>' +
      '<button class="btn tiny wide' + (p.star > j ? ' primary' : '') + '" data-judge="1">🏠 심사 받기' + (p.star > j ? ' · 금 +' + ((p.star - j) * GOLD_PER_STAR) : ' · 이번 계절 ★' + j + ' 받음') + '</button>';
  }
  function bind() {
    if (!global.document) { return; }
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-judge]') : null;
      if (!b) { return; }
      judge(); core().emit('changed');
    });
  }
  bind();

  global.DG = global.DG || {};
  global.DG.homeJudge = { THEME: THEME, STEPS: STEPS, GOLD_PER_STAR: GOLD_PER_STAR, on: on, themeOf: themeOf, seasonKey: seasonKey, judgeKey: judgeKey, bonusOf: bonusOf, starOf: starOf, nextOf: nextOf, preview: preview, judge: judge, rowHtml: rowHtml };
})(window);
