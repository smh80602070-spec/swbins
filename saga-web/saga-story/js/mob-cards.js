/**
 * 4종횡 괴물 카드 도감 (W-0423 ① · 정본 고돗 G-0374 — 메이플 몬스터 컬렉션은 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 사냥 반복 동기 — 잡몹을 쓰러뜨리면 가끔 그 종의 카드 한 장:
 *   종     data-enemy 잡졸 32 + 세 시대 적 8 = 40종(이름이 열쇠). 보스·숨은 우두머리·비경은 카드 없음
 *   확률   보통 5% · 미니보스 50% · 희귀형 확정 — 제 난수(굴린 횟수 해시)라 Math.random 흐름을 안 건드린다
 *   모음   종마다 다섯 장 = 다 모음, 다 모은 종마다 공격 ×(1 + 0.2%) — 40종 다 = +8%
 *   알림   새 장마다 토스트 「🃏 ○○ 카드 n/5」, 다 모으면 「도감 완성」
 * side.js side:kill 알림을 듣고, 한 타(strike dmg) 곱에 atkMul(), 「내 정보」 위에 cardHtml().
 * 세이브 save.mobCards = { n: 굴린 횟수, c: { 종 이름: 장 수 } } — 순수 추가. 손잡이 story.mobCards(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var NEED = 5, P_NORMAL = 0.05, P_MINI = 0.5, ATK_PER = 0.002;

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('story.mobCards', 1)); }
  function book() { var s = core().save; if (!s.mobCards) { s.mobCards = { n: 0, c: {} }; } if (!s.mobCards.c) { s.mobCards.c = {}; } return s.mobCards; }
  /** 40종 — 잡졸 + 세 시대 적(이름·이모지) */
  function species() {
    var ed = global.DG.enemyData, sd = global.DG.sideData, out = [], seen = {};
    ((ed && ed.enemies) || []).concat((sd && sd.ERA_ENEMIES) || []).forEach(function (e) { if (!seen[e.name]) { seen[e.name] = 1; out.push({ name: e.name, emoji: e.emoji || '👾' }); } });
    return out;
  }
  function isSpecies(name) { return species().some(function (s) { return s.name === name; }); }
  function h01(n) { var h = Math.imul(n ^ 0x9e3779b9, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  function chance(e) { return e.rare ? 1 : (e.mini ? P_MINI : P_NORMAL); }
  function count(name) { return book().c[name] || 0; }
  function done() { var c = book().c; return species().filter(function (s) { return (c[s.name] || 0) >= NEED; }).length; }

  /** 처치 하나 — 카드가 나오면 {name, n, full} */
  function onKill(e) {
    if (!on() || !e || e.boss || e.hidden || e.rift || !e.ref || !isSpecies(e.ref.name)) { return null; }
    var b = book(), name = e.ref.name; b.n = (b.n || 0) + 1;
    if (count(name) >= NEED || h01(b.n) >= chance(e)) { return null; }
    b.c[name] = count(name) + 1;
    var full = b.c[name] >= NEED, C = core();
    if (C.emit) { C.emit('toast', '🃏 ' + name + ' 카드 ' + b.c[name] + '/' + NEED + (full ? ' — 도감 완성! 공격 +' + (ATK_PER * 100).toFixed(1) + '%' : '')); }
    return { name: name, n: b.c[name], full: full };
  }
  /** 한 타 곱 — 다 모은 종마다 +0.2% */
  function atkMul() { return on() ? 1 + done() * ATK_PER : 1; }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** 「내 정보」 카드 — 종마다 n/5 */
  function cardHtml() {
    if (!on()) { return ''; }
    var L = species(), d = done(), got = L.filter(function (s) { return count(s.name) > 0; }).length;
    var h = '<div class="sec"><h4>🃏 괴물 카드 <span class="muted">' + got + '/' + L.length + '종 · 다 모음 ' + d + ' · 공격 +' + (d * ATK_PER * 100).toFixed(1) + '%</span></h4><div class="card mob-cards">';
    h += L.map(function (s) { var n = count(s.name); return '<span class="mob-card' + (n >= NEED ? ' full' : '') + '" title="' + esc(s.name) + '"' + (n ? '' : ' style="opacity:.35"') + '>' + s.emoji + ' <small>' + (n ? esc(s.name) + ' ' + n + '/' + NEED : '?') + '</small></span>'; }).join(' ');
    return h + '<br><small class="muted">보통 5% · 미니보스 50% · 희귀형 확정 · 종마다 다섯 장</small></div></div>';
  }

  function init() { var C = core(); if (C && C.on) { C.on('side:kill', function (e) { onKill(e); }); } }
  if (global.DG && global.DG.core) { init(); }

  global.DG = global.DG || {};
  global.DG.mobCards = { NEED: NEED, P_NORMAL: P_NORMAL, P_MINI: P_MINI, ATK_PER: ATK_PER, species: species, book: book, count: count, done: done, onKill: onKill, atkMul: atkMul, cardHtml: cardHtml };
})(window);
