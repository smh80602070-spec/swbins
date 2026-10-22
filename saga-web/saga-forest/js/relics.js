/**
 * 3마을 — 유적 발굴·복원 (W-0309 · 코랄 아일랜드 유물 복원·동물의숲 화석 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 유물 기증(museum.js)은 한 점 한 번이었다 → 갈라진 자리(🕳️ dig)를 팔 때 가끔(CHANCE, 날·자리 해시) 유적 조각이 함께 나온다.
 * 옛 그릇·옛 비석·옛 망와 셋, 각 PIECES 조각. 사고(🏛️) 창에서 넷이 모인 것을 복원하면 사고에 전시되고 명성 +FAME,
 * 셋을 다 복원하면 그날 "옛터 잔치"(명성 +FEAST 한 번·마을 기록).
 *   세이브 save.village.relics = { got: { set: n }, restored: [set…], feast: day|null } — 옛 세이브엔 없다(빈 것)
 *   잇기: village:gather 신호(파기 결과)만 듣는다 — village.js 판정은 안 건드림 · 사고 창(ui-shops viewMuseum) 위 칸 sheetHtml · data-relic 클릭
 *   손잡이 village.relics(1, 0 = 끔)
 * 방문객 확률 + 는 안 함 — 3마을 손님은 날마다 한 명 꼭 온다(visitor.js whoOn). 2D 사고 안 전시대 그림은 없음(창 칸으로).
 */
(function (global) {
  'use strict';

  var SETS = [
    { key: 'bowl',  name: '옛 그릇', emoji: '🏺' },
    { key: 'stele', name: '옛 비석', emoji: '🪦' },
    { key: 'tile',  name: '옛 망와', emoji: '🏯' }
  ];
  var PIECES = 4, CHANCE = 0.3, FAME = 150, FEAST = 300;

  function core() { return global.DG.core; }
  function V() { return global.DG.village; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('village.relics', 1)); }
  function st() {
    var s = V().state();
    if (!s.relics || typeof s.relics !== 'object') { s.relics = { got: {}, restored: [], feast: null }; }
    if (!s.relics.got) { s.relics.got = {}; } if (!Array.isArray(s.relics.restored)) { s.relics.restored = []; }
    return s.relics;
  }
  function byKey(k) { for (var i = 0; i < SETS.length; i++) { if (SETS[i].key === k) { return SETS[i]; } } return null; }
  function h01(a, b) { var C = core(); return C && C.hash2 ? Math.min(0.999999, C.hash2(a, b) * 2 % 1) : Math.random(); }
  function hashStr(s) { var h = 0, i; s = String(s); for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }

  /** 이 파기에서 조각이 나오나 — 나오면 그 갈래 key(아직 다 안 모은 것 중), 아니면 null. 날·자리로 결정적 */
  function rollPiece(day, propId) {
    var R = st(), open = SETS.filter(function (s) { return R.restored.indexOf(s.key) < 0 && (R.got[s.key] || 0) < PIECES; }), seed = hashStr(day + '|' + propId);
    if (!open.length || h01(seed, 77) >= CHANCE) { return null; }
    return open[Math.floor(h01(seed, 78) * open.length)].key;
  }
  function addPiece(key) { var R = st(); R.got[key] = Math.min(PIECES, (R.got[key] || 0) + 1); return R.got[key]; }

  function onGather(e) {
    if (!on() || !e || !e.propId) { return null; }
    var raw = V().raw ? V().raw() : null, p = raw && raw.props ? raw.props.filter(function (q) { return q.id === e.propId; })[0] : null;
    if (!p || p.kind !== 'dig') { return null; }
    var k = rollPiece(V().state().day, e.propId);
    if (!k) { return null; }
    var n = addPiece(k), S = byKey(k);
    core().log(S.emoji + ' ' + S.name + ' 조각을 찾았다 (' + n + '/' + PIECES + ')' + (n >= PIECES ? ' — 사고에서 복원할 수 있다' : ''), 'good');
    core().emit('toast', S.emoji + ' 유적 조각 — ' + S.name + ' ' + n + '/' + PIECES);
    return k;
  }

  /** 복원 — { ok, why, feast } */
  function restore(key) {
    var R = st(), S = byKey(key);
    if (!on()) { return { ok: false, why: '꺼져 있다' }; }
    if (!S) { return { ok: false, why: '없는 유적' }; }
    if (R.restored.indexOf(key) >= 0) { return { ok: false, why: '이미 복원했다' }; }
    if ((R.got[key] || 0) < PIECES) { return { ok: false, why: '조각이 모자란다 (' + (R.got[key] || 0) + '/' + PIECES + ')' }; }
    R.got[key] = 0; R.restored.push(key);
    core().save.player.fame = (core().save.player.fame || 0) + FAME;
    var feast = false;
    if (R.restored.length >= SETS.length && !R.feast) { R.feast = V().state().day; core().save.player.fame += FEAST; feast = true; core().log('🎊 옛터 잔치 — 유적 셋을 다 되살렸다! 마을이 들썩인다 · 🎖️ +' + FEAST, 'good'); }
    core().log('🏛️ ' + S.emoji + ' ' + S.name + ' 을(를) 복원해 사고에 세웠다 — 🎖️ +' + FAME, 'good');
    core().emit('changed'); if (core().persist) { core().persist(); }
    return { ok: true, feast: feast };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sheetHtml() {
    if (!on()) { return ''; }
    var R = st(), html = '<div class="sec"><h4>🏺 유적 복원 <span class="muted">' + R.restored.length + '/' + SETS.length + '</span></h4><div class="card">';
    SETS.forEach(function (S) {
      var done = R.restored.indexOf(S.key) >= 0, n = R.got[S.key] || 0;
      html += '<div class="stat-row"><span>' + S.emoji + ' ' + esc(S.name) + '</span><b>' + (done ? '✓ 전시 중' : '🧩 ' + n + '/' + PIECES) + '</b></div>';
      if (!done && n >= PIECES) { html += '<button class="btn tiny" data-relic="' + S.key + '">🏛️ 복원해 전시 (🎖️ +' + FAME + ')</button>'; }
    });
    html += '<small class="muted">갈라진 자리(🕳️)를 파면 가끔 조각이 나옵니다. ' + (R.feast ? '🎊 옛터 잔치를 열었습니다.' : '셋을 다 되살리면 옛터 잔치(🎖️ +' + FEAST + ').') + '</small>';
    return html + '</div></div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-relic]') : null, r;
      if (!b || b.disabled) { return; }
      r = restore(b.getAttribute('data-relic'));
      core().emit('toast', r.ok ? (r.feast ? '🎊 옛터 잔치! 유적 셋을 다 되살렸다' : '🏛️ 복원해 사고에 세웠다') : r.why);
    });
  }
  function bind() { var C = core(); if (C && C.on && !bind.done) { bind.done = true; C.on('village:gather', onGather); } }
  if (global.DG && global.DG.core) { bind(); }

  global.DG = global.DG || {};
  global.DG.relics = { SETS: SETS, PIECES: PIECES, CHANCE: CHANCE, FAME: FAME, FEAST: FEAST, rollPiece: rollPiece, addPiece: addPiece, onGather: onGather, restore: restore, sheetHtml: sheetHtml, state: st };
})(window);
