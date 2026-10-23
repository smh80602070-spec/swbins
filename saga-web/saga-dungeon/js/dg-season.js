/**
 * 2나락 — 로컬 시즌·래더 (W-0396 ① 웹 역이식 — 정본 고돗 G-0334 · 디아블로·PoE 구조만, 서버 없음)
 * ---------------------------------------------------------------
 * 한 주(월요일 0시, 기기 시계) = 한 시즌. 살아 나온 한 판 등급(dg-rank, dungeon:end e.rank)마다 (D1·C2·B3·A4·S5) × 급(tier 1~5) 점,
 * 좋은 판 다섯 합 = 시즌 점수 → 🥉 청동 10 · 🥈 백은 25 · 🥇 황금 45 · 💎 백금 70 · 👑 왕좌 100.
 * 시즌이 넘어가면(입장·판 기록·창 열 때) 닿은 단계의 금 100·300·700·1500·3000 을 지갑에, 지난 기록 넷 남기고 래더를 비운다.
 * 처음 켠 기기(옛 세이브)는 번호만 잡는다(덤 없음). 시계를 뒤로 돌려 번호가 줄면 아무것도 안 한다(G-0334 R-5).
 *   세이브 save.dgSeason = { n, runs: [{ p, rank, tier }…≤5], hist: [{ n, score, stage }…≤4] } — 순수 추가. 손잡이 season.on(1).
 *   걸린 자리: dungeon:enter·dungeon:end(dg-rank 뒤에 실려 e.rank 를 읽는다) · ui 부대 시트 카드(cardHtml) · 끝 카드 셋째 줄(lineHtml).
 */
(function (global) {
  'use strict';

  var GR = { D: 1, C: 2, B: 3, A: 4, S: 5 };
  var STAGES = [
    { key: 'none', emoji: '—', name: '없음', pt: 0, gold: 0 },
    { key: 'bronze', emoji: '🥉', name: '청동', pt: 10, gold: 100 },
    { key: 'silver', emoji: '🥈', name: '백은', pt: 25, gold: 300 },
    { key: 'gold', emoji: '🥇', name: '황금', pt: 45, gold: 700 },
    { key: 'plat', emoji: '💎', name: '백금', pt: 70, gold: 1500 },
    { key: 'crown', emoji: '👑', name: '왕좌', pt: 100, gold: 3000 },
  ];
  var KEEP = 5, HIST = 4, DAY = 86400000;

  function core() { return global.DG.core; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('season.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }
  function num(now) { return Math.floor((Math.floor((now === undefined ? Date.now() : now) / DAY) + 3) / 7); }   // 월요일 경계
  function daysLeft(now) { var t = now === undefined ? Date.now() : now; return 7 - (Math.floor(t / DAY) + 3) % 7; }
  function book() { var s = core().save; if (!s.dgSeason) { s.dgSeason = { n: 0, runs: [], hist: [] }; } return s.dgSeason; }
  function score(b) { var t = 0; (b || book()).runs.forEach(function (r) { t += r.p; }); return t; }
  function stageOf(pt) { var i, s = STAGES[0]; for (i = 1; i < STAGES.length; i++) { if (pt >= STAGES[i].pt) { s = STAGES[i]; } } return s; }
  function nextOf(pt) { var i; for (i = 1; i < STAGES.length; i++) { if (pt < STAGES[i].pt) { return STAGES[i]; } } return null; }

  /** 시즌 넘김 — 번호가 늘었을 때만. 돌아온 값 = 받은 금(0 이면 안 넘김/덤 없음) */
  function roll(now) {
    if (!on()) { return 0; }
    var b = book(), n = num(now), got = 0;
    if (!b.n) { b.n = n; return 0; }
    if (n <= b.n) { return 0; }
    var sc = score(b), st = stageOf(sc);
    if (st.gold) { core().save.player.gold += st.gold; got = st.gold; }
    b.hist.unshift({ n: b.n, score: sc, stage: st.key }); b.hist = b.hist.slice(0, HIST);
    b.runs = []; b.n = n;
    if (core().log) { core().log('🏆 시즌 ' + (n - 1) + ' 마감 — ' + sc + '점 ' + st.emoji + st.name + (got ? ' · 금 +' + got : ''), got ? 'good' : 'info'); }
    return got;
  }

  /** 살아 나온 판 하나 — 점수 넣고 좋은 다섯만 남긴다. 돌아온 값 = 이 판 점수(0 이면 안 셈) */
  function record(rank, tier, now) {
    if (!on() || !GR[rank]) { return 0; }
    roll(now);
    var b = book(), p = GR[rank] * Math.max(1, Math.min(5, tier || 1));
    b.runs.push({ p: p, rank: rank, tier: tier || 1 });
    b.runs.sort(function (x, y) { return y.p - x.p; }); b.runs = b.runs.slice(0, KEEP);
    return p;
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  /** 끝 카드 셋째 줄 — "🏅 시즌 +n점 → 29점 🥈 백은" */
  function lineHtml(r) {
    if (!on() || !r || r.dead || !r.seasonPt) { return ''; }
    var sc = score(), st = stageOf(sc), nx = nextOf(sc);
    return '<div class="dg-rank-2 muted">🏅 시즌 +' + r.seasonPt + '점 → ' + sc + '점 ' + st.emoji + esc(st.name) + (nx ? ' · ' + esc(nx.name) + '까지 ' + (nx.pt - sc) : '') + '</div>';
  }
  /** 부대 시트 카드 — 읽기만 */
  function cardHtml(now) {
    if (!on()) { return ''; }
    roll(now);
    var b = book(), sc = score(b), st = stageOf(sc), nx = nextOf(sc);
    var h = '<div class="sec"><h4>🏆 시즌 ' + b.n + ' <span class="muted">남은 ' + daysLeft(now) + '일 · ' + sc + '점 ' + st.emoji + esc(st.name) + (nx ? ' · ' + esc(nx.name) + '까지 ' + (nx.pt - sc) : ' · 왕좌') + '</span></h4><div class="card">';
    h += b.runs.length ? b.runs.map(function (r) { return '<div class="stat-row"><span>' + r.rank + ' 등급 · ' + r.tier + '급</span><span>+' + r.p + '</span></div>'; }).join('') : '<small class="muted">살아 나온 판이 아직 없다 — 좋은 판 다섯이 점수가 된다</small>';
    h += '<small class="muted">' + STAGES.slice(1).map(function (s) { return s.emoji + s.name + ' ' + s.pt; }).join(' · ') + ' · 주가 바뀌면 단계 금을 받는다</small>';
    if (b.hist.length) { h += '<div class="stat-row muted"><span>지난 시즌</span><span>' + b.hist.map(function (x) { return x.n + ' ' + stageOf(x.score).emoji + x.score; }).join(' · ') + '</span></div>'; }
    return h + '</div></div>';
  }

  function bind() {
    var c = core(); if (!c || !c.on) { return; }
    c.on('dungeon:enter', function () { roll(); });
    c.on('dungeon:end', function (e) {
      if (!e) { roll(); return; }
      if (e.rank && !e.rank.dead && e.floor > 0) { e.rank.seasonPt = record(e.rank.rank, e.rank.tier); } else { roll(); }
    });
  }
  if (global.DG && global.DG.core) { bind(); } else if (global.document) { global.document.addEventListener('DOMContentLoaded', bind); }

  global.DG = global.DG || {};
  global.DG.dgSeason = { GR: GR, STAGES: STAGES, KEEP: KEEP, on: on, num: num, daysLeft: daysLeft, book: book, score: score, stageOf: stageOf, nextOf: nextOf, roll: roll, record: record, lineHtml: lineHtml, cardHtml: cardHtml };
})(window);
