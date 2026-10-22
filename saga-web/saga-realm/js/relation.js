/**
 * 5천하 — 장수 관계망 효과 (W-0308 · 토탈워 삼국 관계망·크루세이더 킹즈 3 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 짝 표(data-relation.js — 의형제·원수·사제·호적수)와 사연 체인(event.js §5-2)은 이미 있다. 여기는 그 짝이 **판정에 닿는 층**:
 *   의형제 🤝  같은 군대(war armyPower 의 officers)에 함께 있으면 그 군대 힘 ×(1 + SWORN_ATK)
 *   원수 🗡️    같은 세력에 있고 아직 앙금이 안 풀렸으면(event 화해도 < 2) 달마다 둘 다 충성 FOE_LOYAL
 *   사제 📖    스승이 죽으면(rec.dead) 제자 능력 +MASTER_BONUS 영구(officer stats 의 ambBonusOf 자리에 더함) — 한 번
 *   인물 카드  무장 한 장에 관계 줄(짝 이름·결·효과)
 * 손잡이 rtk.relation(1, 0 = 끔). 판정을 새로 두지 않는다 — 충성은 off.addLoyal, 능력은 stats 한 곳.
 */
(function (global) {
  'use strict';

  var SWORN_ATK = 0.05, FOE_LOYAL = -2, MASTER_BONUS = 3;

  function core() { return global.DG.core; }
  function R() { return global.DG.rtk; }
  function OFF() { return global.DG.off; }
  function REL() { return global.DG.relData; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('rtk.relation', 1)); }
  function rec(id) { var st = R() && R().state(); return st && st.officers ? st.officers[id] : null; }
  function alive(id) { var r = rec(id); return !!(r && !r.dead); }
  function pairs() { return REL() && REL().all ? REL().all() : []; }
  function nm(id) { var D = global.DG.data, h = D && D.find ? D.find(id) : null; return h ? h.name : id; }

  /** 군대 힘 곱 — 함께 선 의형제 짝이 하나라도 있으면 1 + SWORN_ATK */
  function armyMul(officers) {
    if (!on() || !officers || officers.length < 2) { return 1; }
    var set = {}, i, P = pairs();
    for (i = 0; i < officers.length; i++) { set[officers[i]] = true; }
    for (i = 0; i < P.length; i++) { if (P[i].kind === 'sworn' && set[P[i].a] && set[P[i].b]) { return 1 + SWORN_ATK; } }
    return 1;
  }
  /** 능력 덧셈 — 스승을 잃은 제자 */
  function bonusOf(id) { var r = rec(id); return on() && r && r.relMaster ? MASTER_BONUS : 0; }

  /** 달 끝 — 원수 충성 깎기 · 스승 잃은 제자 능력. { foe, master } 건수 */
  function monthly() {
    var st = R() && R().state(), P = pairs(), out = { foe: 0, master: 0 }, i, p, ra, rb, EV = global.DG.events || global.DG.event;
    if (!on() || !st || !st.started) { return out; }
    for (i = 0; i < P.length; i++) {
      p = P[i]; ra = rec(p.a); rb = rec(p.b);
      if (!ra || !rb) { continue; }
      if (p.kind === 'foe' && !ra.dead && !rb.dead && ra.force && ra.force === rb.force) {
        var lv = EV && EV.relLv ? EV.relLv(p.a, p.b) : 0;
        if (lv < 2) { OFF().addLoyal(p.a, FOE_LOYAL); OFF().addLoyal(p.b, FOE_LOYAL); out.foe++; }
      } else if (p.kind === 'master' && ra.dead && !rb.dead && !rb.relMaster) {
        rb.relMaster = 1; out.master++;
        core().log('📖 ' + nm(p.b) + ' 이(가) 스승 ' + nm(p.a) + ' 을(를) 잃고 뜻을 이었다 — 능력 +' + MASTER_BONUS, rb.force === st.me ? 'good' : 'info');
      }
    }
    return out;
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  var FX = { sworn: '같은 군대면 힘 +' + Math.round(SWORN_ATK * 100) + '%', foe: '같은 세력이면 달마다 충성 ' + FOE_LOYAL, master: '스승을 잃으면 제자 능력 +' + MASTER_BONUS, rival: '' };
  /** 무장 카드 관계 줄 */
  function rowHtml(id) {
    if (!on()) { return ''; }
    var K = REL() && REL().KINDS || {}, P = pairs(), out = [], i, p, other, role;
    for (i = 0; i < P.length; i++) {
      p = P[i];
      if (p.a !== id && p.b !== id) { continue; }
      other = p.a === id ? p.b : p.a; role = p.kind === 'master' ? (p.a === id ? ' (제자)' : ' (스승)') : '';
      out.push((K[p.kind] ? K[p.kind].emoji + ' ' + K[p.kind].name : p.kind) + ' ' + esc(nm(other)) + role + (alive(other) ? '' : ' †'));
    }
    if (!out.length && !bonusOf(id)) { return ''; }
    var kinds = P.filter(function (q) { return q.a === id || q.b === id; }).map(function (q) { return FX[q.kind]; }).filter(function (x, j, arr) { return x && arr.indexOf(x) === j; });
    return '<div class="rstat rel"><span>🔗 관계</span><b>' + out.join(' · ') + (bonusOf(id) ? ' · 📖 능력 +' + MASTER_BONUS : '') + '</b></div>' + (kinds.length ? '<small class="muted">' + esc(kinds.join(' · ')) + '</small>' : '');
  }

  global.DG = global.DG || {};
  global.DG.relation = { SWORN_ATK: SWORN_ATK, FOE_LOYAL: FOE_LOYAL, MASTER_BONUS: MASTER_BONUS, armyMul: armyMul, bonusOf: bonusOf, monthly: monthly, rowHtml: rowHtml };
})(window);
