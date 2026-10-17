/**
 * 4종횡 — 생활 기술 등급 (W-0283, 마비노기식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 채집은 해도 나아지는 게 없었다 → 채집·요리·연주 셋. 할 때마다 경험, 랭크 F→E→D→C→B→A→3→2→1(9단).
 *   채집 🌿  필드에서 캐면 경험 1(🍀 구간 2) · 랭크마다 "두 개" 확률 +1/8(랭크 1 은 늘 둘)
 *   요리 🍲  쉬는 판(#camp)에서 캔 것 2개를 먹어 요리 — 한 끼 10분 · 한 타 ×(1 + 0.05 × 단) · 경험 6
 *   연주 🎵  쉬는 판에서 — 10분 동안 사냥 중 초마다 체력 0.4% × 단 회복("주변 회복") · 쿨 60초 · 경험 4
 *   랭크 1 까지 누적 940 — 채집은 8초에 하나 꼴이면 약 2시간.
 *
 *   세이브 save.life = { gather: { xp }, cook: { xp }, play: { xp }, meal: { mul, until }, tune: { regen, until }, playAt } — 옛 세이브엔 없다(빈 것)
 *   잇기(side.js 줄 상한 — 줄 끝만): 채집 gain 줄 gatherExtra()+gain('gather') · strike 의 다음 한 타 줄 mealMul() · update 머리 tick(run, dt) · 쉬는 판 campHtml() · 가방 "캔 것" ranksHtml()
 */
(function (global) {
  'use strict';

  var RANKS = ['F', 'E', 'D', 'C', 'B', 'A', '3', '2', '1'];
  var NEED = [20, 40, 60, 90, 120, 160, 200, 250];                 // 랭크 i → i+1 에 드는 경험(누적 940)
  var SKILLS = {
    gather: { name: '채집', emoji: '🌿', desc: '캐면 경험. 랭크마다 두 개 나올 확률 +1/8' },
    cook:   { name: '요리', emoji: '🍲', desc: '캔 것 2개 → 한 끼(10분) · 한 타 ×(1 + 0.05 × 단)' },
    play:   { name: '연주', emoji: '🎵', desc: '10분 동안 사냥 중 초마다 체력 0.4% × 단 회복 · 쿨 60초' }
  };
  var MEAL_SEC = 600, TUNE_SEC = 600, PLAY_CD = 60, COOK_MATS = 2, COOK_XP = 6, PLAY_XP = 4;

  function core() { return global.DG.core; }
  function st() {
    var s = core().save;
    if (!s.life || typeof s.life !== 'object') { s.life = {}; }
    ['gather', 'cook', 'play'].forEach(function (k) { if (!s.life[k]) { s.life[k] = { xp: 0 }; } });
    return s.life;
  }
  /** 랭크 번호 0(F)~8(1) */
  function rankIdx(k) {
    var xp = st()[k].xp, i = 0;
    while (i < NEED.length && xp >= NEED[i]) { xp -= NEED[i]; i += 1; }
    return i;
  }
  function rankOf(k) { return RANKS[rankIdx(k)]; }
  /** 다음 랭크까지 { idx, rank, xp, need }(끝이면 need 0) */
  function progress(k) {
    var xp = st()[k].xp, i = 0;
    while (i < NEED.length && xp >= NEED[i]) { xp -= NEED[i]; i += 1; }
    return { idx: i, rank: RANKS[i], xp: xp, need: i < NEED.length ? NEED[i] : 0 };
  }
  function gain(k, n) {
    if (!SKILLS[k]) { return 0; }
    var before = rankIdx(k);
    st()[k].xp += (n || 1);
    var after = rankIdx(k);
    if (after > before) {
      core().emit('toast', SKILLS[k].emoji + ' ' + SKILLS[k].name + ' 랭크 ' + RANKS[after] + ' — ' + SKILLS[k].desc);
      core().emit('changed');
    }
    return after;
  }

  /* ── 효과 ── */
  /** 채집 — 이번에 더 나오는 개수(0/1). 랭크 1 은 늘 1 */
  function gatherExtra() {
    var i = rankIdx('gather');
    if (i <= 0) { return 0; }
    return Math.random() < i / 8 ? 1 : 0;
  }
  function mealMul() { var m = st().meal; return m && m.until > Date.now() ? m.mul : 1; }
  function tuneRegen() { var t = st().tune; return t && t.until > Date.now() ? t.regen : 0; }
  /** 사냥 중 매 틱 — 연주 회복 */
  function tick(run, dt) {
    var r = tuneRegen();
    if (!r || !run || !run.hpMax || run.hp <= 0 || run.hp >= run.hpMax) { return; }
    run.hp = Math.min(run.hpMax, run.hp + run.hpMax * r * dt);
  }

  /* ── 쉬는 판 행동 ── */
  function mats() { var S = global.DG.side; return S && S.state ? (S.state().mats || {}) : {}; }
  function bestMat() {
    var m = mats(), best = null, k;
    for (k in m) { if (Object.prototype.hasOwnProperty.call(m, k) && m[k] >= COOK_MATS && (!best || m[k] > m[best])) { best = k; } }
    return best;
  }
  function cook() {
    var k = bestMat();
    if (!k) { return { ok: false, reason: 'mats', need: COOK_MATS }; }
    mats()[k] -= COOK_MATS;
    var i = rankIdx('cook'), mul = 1 + 0.05 * (i + 1);
    st().meal = { mul: mul, until: Date.now() + MEAL_SEC * 1000, mat: k };
    gain('cook', COOK_XP);
    core().emit('changed');
    return { ok: true, mul: mul, mat: k };
  }
  function play() {
    var L = st(), now = Date.now();
    if (L.playAt && now - L.playAt < PLAY_CD * 1000) { return { ok: false, reason: 'cd', left: Math.ceil((PLAY_CD * 1000 - (now - L.playAt)) / 1000) }; }
    var i = rankIdx('play'), regen = 0.004 * (i + 1);
    L.tune = { regen: regen, until: now + TUNE_SEC * 1000 };
    L.playAt = now;
    gain('play', PLAY_XP);
    core().emit('changed');
    return { ok: true, regen: regen };
  }

  /* ── 화면 ── */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function bar(k) {
    var p = progress(k), S = SKILLS[k], pct = p.need ? Math.round(p.xp / p.need * 100) : 100;
    return '<div class="stat-row"><span>' + S.emoji + ' ' + S.name + ' <b>' + p.rank + '</b></span>' +
      '<span class="muted">' + (p.need ? p.xp + '/' + p.need : '끝') + '</span></div>' +
      '<div class="life-bar"><i style="width:' + pct + '%"></i></div>';
  }
  function ranksHtml() {
    return '<div class="life-ranks"><small class="muted">생활 기술(랭크 F→1)</small>' + bar('gather') + bar('cook') + bar('play') + '</div>';
  }
  function key() { var L = st(); return [L.gather.xp, L.cook.xp, L.play.xp, mealMul() > 1 ? 1 : 0, tuneRegen() > 0 ? 1 : 0].join(','); }
  function campHtml() {
    var m = st().meal, t = st().tune, now = Date.now(), k = bestMat(), SD = global.DG.sideData, left = st().playAt ? Math.max(0, PLAY_CD - Math.floor((now - st().playAt) / 1000)) : 0;
    var html = '<div class="camp-life"><div class="stat-row"><span>🍲🎵 생활</span><span class="muted">' +
      '채집 ' + rankOf('gather') + ' · 요리 ' + rankOf('cook') + ' · 연주 ' + rankOf('play') + '</span></div>';
    html += (m && m.until > now ? '<small class="muted">🍲 한 끼 — 한 타 ×' + m.mul.toFixed(2) + ' (' + Math.ceil((m.until - now) / 60000) + '분)</small> ' : '') +
      (t && t.until > now ? '<small class="muted">🎵 가락 — 초마다 체력 ' + (t.regen * 100).toFixed(1) + '% (' + Math.ceil((t.until - now) / 60000) + '분)</small>' : '');
    html += '<div class="life-btns">' +
      '<button class="btn tiny' + (k ? ' primary' : '') + '" data-life="cook"' + (k ? '' : ' disabled') + ' title="' + esc(SKILLS.cook.desc) + '">🍲 요리' + (k && SD ? ' (' + SD.GATHERS[k].emoji + '×' + COOK_MATS + ')' : ' (캔 것 ' + COOK_MATS + '개)') + '</button>' +
      '<button class="btn tiny' + (left ? '' : ' primary') + '" data-life="play"' + (left ? ' disabled' : '') + ' title="' + esc(SKILLS.play.desc) + '">🎵 연주' + (left ? ' (' + left + '초)' : '') + '</button>' +
      '</div></div>';
    return html;
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-life]') : null, r;
      if (!b || b.disabled) { return; }
      if (b.getAttribute('data-life') === 'cook') {
        r = cook();
        core().emit('toast', r.ok ? '🍲 요리했다 — 10분 동안 한 타 ×' + r.mul.toFixed(2) : '캔 것이 ' + r.need + '개는 있어야 합니다');
      } else {
        r = play();
        core().emit('toast', r.ok ? '🎵 한 가락 — 10분 동안 사냥 중 초마다 체력 ' + (r.regen * 100).toFixed(1) + '% 회복' : '🎵 ' + r.left + '초 뒤에');
      }
      core().persist();
    });
  }

  global.DG = global.DG || {};
  global.DG.life = {
    RANKS: RANKS, NEED: NEED, SKILLS: SKILLS, COOK_MATS: COOK_MATS, PLAY_CD: PLAY_CD,
    rankIdx: rankIdx, rankOf: rankOf, progress: progress, gain: gain,
    gatherExtra: gatherExtra, mealMul: mealMul, tuneRegen: tuneRegen, tick: tick, cook: cook, play: play, bestMat: bestMat,
    ranksHtml: ranksHtml, campHtml: campHtml, key: key
  };
})(window);
