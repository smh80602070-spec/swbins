/**
 * 2나락 — 장비 숙련 (W-0396 ② 웹 역이식 — 정본 고돗 G-0317 · 크로니콘 구조만)
 * ---------------------------------------------------------------
 * 장비는 주운 그대로였다 → 선두 인물(party[0])이 든 무기는 처치(dungeon:kill)마다, 입은 갑주(slot 'armor')는 맞을 때(dungeon:hurt)마다 숙련 +1.
 * 문턱 10·30·60·100·150 에서 단계(최고 5). 무기 단계마다 공격 +3%(dungeon 한 타), 갑주 단계마다 받는 피해 −2%.
 * 교체 동기와 안 부딪히게 — 무기 말고 다른 부위를 새 것으로 갈면 옛 숙련의 절반을 물려받는다(item.equip 을 감싼다).
 *   저장: 장비 물건 안 it.mx(숙련 수) — 가방·장착 칸 어디에 있든 따라간다. 손잡이 mastery.on(1).
 *   걸린 자리: dungeon 한 타(atkPct 곱 뒤 × (1 + atkPct()/100)) · hurt(막기 곱 뒤 × (1 − defPct()/100)) · 부대 시트 카드(cardHtml).
 */
(function (global) {
  'use strict';

  var STEPS = [10, 30, 60, 100, 150], ATK = 3, DEF = 2;

  function core() { return global.DG.core; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('mastery.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }
  function IT() { return global.DG.item; }
  function lead() { var p = core().save.party; return p && p.length ? p[0] : null; }
  function slotItem(slot) { var l = lead(), it = IT(); if (!l || !it || !it.equipped) { return null; } return it.equipped(l)[slot] || null; }
  function stageOf(xp) { var s = 0, i; for (i = 0; i < STEPS.length; i++) { if ((xp || 0) >= STEPS[i]) { s = i + 1; } } return s; }
  function nextOf(xp) { var i; for (i = 0; i < STEPS.length; i++) { if ((xp || 0) < STEPS[i]) { return STEPS[i]; } } return null; }
  function gain(it, n) {
    if (!it) { return 0; }
    var s0 = stageOf(it.mx); it.mx = (it.mx || 0) + (n || 1);
    var s1 = stageOf(it.mx);
    if (s1 > s0 && core().log) { core().log('⚙️ ' + (it.name || '장비') + ' 숙련 ' + s1 + '단계', 'good'); }
    return s1 - s0;
  }
  function atkPct() { return on() ? stageOf((slotItem('weapon') || {}).mx) * ATK : 0; }
  function defPct() { return on() ? stageOf((slotItem('armor') || {}).mx) * DEF : 0; }

  var wrapped = false;
  /** item.equip 감싸기 — 무기 말고 다른 부위를 갈면 옛 숙련의 절반을 새 것이 물려받는다 */
  function wrap() {
    var it = IT(); if (wrapped || !it || !it.equip || !it.equipped) { return; }
    wrapped = true;
    var eq0 = it.equip;
    it.equip = function (heroId, uid) {
      var before = {}, k, cur = it.equipped(heroId);
      for (k in cur) { if (cur.hasOwnProperty(k) && cur[k]) { before[k] = cur[k]; } }
      var ok = eq0.apply(this, arguments);
      if (!ok || !on()) { return ok; }
      var now = it.equipped(heroId);
      for (k in now) {
        if (!now.hasOwnProperty(k) || k === 'weapon' || !now[k] || !before[k] || before[k] === now[k]) { continue; }
        var half = Math.floor((before[k].mx || 0) / 2);
        if (half > (now[k].mx || 0)) { now[k].mx = half; }
      }
      return ok;
    };
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '"': '&quot;', '>': '&gt;' }[ch]; }); }
  function line(slot, label, pct, per) {
    var it = slotItem(slot); if (!it) { return '<div class="stat-row muted"><span>' + label + '</span><span>없음</span></div>'; }
    var s = stageOf(it.mx), nx = nextOf(it.mx);
    return '<div class="stat-row"><span>' + label + ' ' + esc(it.name || '') + ' <small class="muted">' + s + '단계' + (nx ? ' · ' + (it.mx || 0) + '/' + nx : ' · 최고') + '</small></span><span>' + (s ? '+' + (s * per) + '%' : '—') + '</span></div>';
  }
  function cardHtml() {
    if (!on() || !lead()) { return ''; }
    return '<div class="sec"><h4>⚙️ 장비 숙련 <span class="muted">무기는 처치마다 · 갑주는 맞을 때마다 +1 · 문턱 10·30·60·100·150</span></h4><div class="card">' +
      line('weapon', '🗡️ 무기(공격)', atkPct(), ATK) + line('armor', '🛡️ 갑주(받는 피해 −)', defPct(), DEF) + '</div></div>';
  }
  function bind() {
    var c = core(); if (!c || !c.on) { return; }
    wrap();
    c.on('dungeon:kill', function () { if (on()) { gain(slotItem('weapon'), 1); } });
    c.on('dungeon:hurt', function () { if (on()) { gain(slotItem('armor'), 1); } });
  }
  if (global.DG && global.DG.core) { bind(); } else if (global.document) { global.document.addEventListener('DOMContentLoaded', bind); }

  global.DG = global.DG || {};
  global.DG.gearMastery = { STEPS: STEPS, ATK: ATK, DEF: DEF, on: on, stageOf: stageOf, nextOf: nextOf, gain: gain, atkPct: atkPct, defPct: defPct, slotItem: slotItem, cardHtml: cardHtml, wrap: wrap };
})(window);
