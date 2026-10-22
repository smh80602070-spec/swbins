/**
 * 4종횡 — 모닥불(W-0300, 장부 story.md 우선 2 · 마비노기 캠프파이어·다크 소울 화톳불 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 쉬는 판(#camp)이 단추 모음이었다 → 모닥불 칸에 동행이 둘러앉고, 하루 한 명에게 말을 건네면 그 인물의 한마디(도감 quote)와
 * "모닥불 온기"를 받는다 — 다음 사냥 한 판만:
 *   든든함(hp)  체력 +10%            — 덕(virtue)·지략(wisdom) 기질
 *   기세(first) 그 판 첫 타 ×1.1 → 셋째 타까지 ×1.1(첫 셋)  — 무용(might)·통솔(command) 기질
 * 요리 한 끼(W-0283 life.mealMul)가 살아 있을 때 받으면 온기 ×1.5(체력 +15%·×1.15).
 *
 *   세이브 save.camp = { warmth: { key, from, pow }|null, talked: { day, id } } — 옛 세이브엔 없다(빈 것)
 *   잇기: ui renderCamp 의 camp 카드 · side enter(side:enter 이벤트)에서 apply(run) 로 쓰고 비움 · side 피해 곱 hitMul(run)
 *   손잡이 story.campfire(1, 0 = 끔)
 */
(function (global) {
  'use strict';

  var WARM = {
    hp:    { name: '든든함', emoji: '🍲', desc: '다음 사냥 체력 +', base: 0.10 },
    first: { name: '기세',   emoji: '🔥', desc: '다음 사냥 첫 세 타 ×', base: 0.10 }
  };
  var FIRST_HITS = 3;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('story.campfire', 1)); }
  function st() {
    var s = core().save;
    if (!s.camp || typeof s.camp !== 'object') { s.camp = { warmth: null, talked: null }; }
    return s.camp;
  }
  function today(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hero(id) { var D = global.DG.data; return D && D.find ? D.find(id) : null; }
  /** 기질 → 온기 갈래(순수) */
  function kindOf(h) { return h && (h.trait === 'might' || h.trait === 'command') ? 'first' : 'hp'; }
  function talkedToday() { var t = st().talked; return !!(t && t.day === today()); }
  function cooked() { var L = global.DG.life; return !!(L && L.mealMul && L.mealMul() > 1); }

  /** 동행 id 에게 말 건네기 — { ok, line, key, pow } 또는 { ok:false, why } */
  function talk(id) {
    if (!on()) { return { ok: false, why: '모닥불이 꺼져 있다' }; }
    if ((core().save.party || []).indexOf(id) < 0) { return { ok: false, why: '동행이 아니다' }; }
    if (talkedToday()) { return { ok: false, why: '오늘은 이미 한 사람과 이야기했다 — 내일 다시' }; }
    var h = hero(id), key = kindOf(h), pow = cooked() ? 1.5 : 1;
    st().warmth = { key: key, from: id, pow: pow };
    st().talked = { day: today(), id: id };
    core().emit('campfire:talk', { id: id, key: key, pow: pow });
    if (core().persist) { core().persist(); }
    return { ok: true, line: (h && h.quote) || '…불이 따뜻하군.', key: key, pow: pow, name: h ? h.name : id };
  }
  function warmthText(w) { var W = w && WARM[w.key]; if (!W) { return ''; } var v = W.base * w.pow; return W.emoji + ' ' + W.name + ' — ' + W.desc + (w.key === 'hp' ? Math.round(v * 100) + '%' : (1 + v).toFixed(2)); }

  /** 사냥 들어갈 때 — 온기를 이 판에 걸고 비운다. 건 것 { key, pow } 또는 null */
  function apply(run) {
    if (!on() || !run) { return null; }
    var w = st().warmth;
    if (!w) { return null; }
    var v = WARM[w.key] ? WARM[w.key].base * w.pow : 0;
    if (w.key === 'hp') { run.hpMax = Math.round(run.hpMax * (1 + v)); run.hp = run.hpMax; }
    else { run.cfFirst = { mul: 1 + v, left: FIRST_HITS }; }
    st().warmth = null;
    core().emit('toast', '🔥 모닥불 온기 — ' + warmthText(w));
    return w;
  }
  /** 피해 곱 — 기세가 남았으면 그 배율(한 타 쓰면 하나 줄어든다) */
  function hitMul(run) {
    var f = run && run.cfFirst;
    if (!f || !(f.left > 0)) { return 1; }
    f.left -= 1;
    return f.mul;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function key() { var s = st(); return [s.warmth ? s.warmth.key + s.warmth.pow : '-', s.talked ? s.talked.day + s.talked.id : '-', (core().save.party || []).join(',')].join('|'); }
  function campHtml() {
    if (!on()) { return ''; }
    var party = core().save.party || [], s = st(), done = talkedToday(), html = '<div class="sec cf-sec"><h4>🔥 모닥불 <span class="muted">' + (done ? '오늘 이야기 끝' : '하루 한 사람') + '</span></h4>';
    html += '<div class="cf-ring" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;padding:6px 0">';
    party.forEach(function (id, i) {
      var h = hero(id); if (!h) { return; }
      if (i === Math.ceil(party.length / 2)) { html += '<span class="cf-fire" style="font-size:30px;filter:drop-shadow(0 0 6px #ffb347)">🔥</span>'; }
      var W = WARM[kindOf(h)];
      html += '<button class="btn tiny' + (done ? ' ghost' : '') + '" data-cf="talk" data-id="' + esc(id) + '"' + (done ? ' disabled' : '') + ' title="' + esc(W.name) + '">' + (h.emoji || '🙂') + ' ' + esc(h.name) + ' <small class="muted">' + W.emoji + '</small></button>';
    });
    if (party.length < 2) { html += '<span class="cf-fire" style="font-size:30px">🔥</span>'; }
    html += '</div>';
    html += s.warmth ? '<small>다음 사냥: <b>' + esc(warmthText(s.warmth)) + '</b>' + (s.warmth.pow > 1 ? ' (요리 덕에 ×1.5)' : '') + '</small>' : '<small class="muted">동행을 눌러 말을 건네면 다음 사냥 한 판에 온기가 붙습니다' + (cooked() ? ' — 지금 요리 한 끼가 살아 있어 ×1.5' : '') + '.</small>';
    return html + '</div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-cf]') : null, r;
      if (!b || b.disabled) { return; }
      r = talk(b.getAttribute('data-id'));
      core().emit('toast', r.ok ? '🔥 ' + r.name + ' — 「' + r.line + '」 · ' + warmthText({ key: r.key, pow: r.pow }) : r.why);
      core().emit('changed');
    });
  }
  function bind() { var C = core(); if (C && C.on && !bind.done) { bind.done = true; C.on('side:enter', function (run) { apply(run); }); } }
  if (global.DG && global.DG.core) { bind(); }

  global.DG = global.DG || {};
  global.DG.campfire = { WARM: WARM, FIRST_HITS: FIRST_HITS, kindOf: kindOf, talk: talk, talkedToday: talkedToday, apply: apply, hitMul: hitMul, warmthText: warmthText, campHtml: campHtml, key: key, bind: bind, _today: today };
})(window);
