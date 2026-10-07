/**
 * 은총 자리 · 사망 카드 · 은총에서 다시 (PLAN §5.2 보강, W-0102 리뉴얼 ② · 재미표준 F)
 * ---------------------------------------------------------------
 * 죽음이 "끝" 이 아니라 루프가 되게 한다.
 *
 *   은총     층마다 하나 — 그 층 첫 방 들머리(첫 방은 늘 싸움 방이라 사당이 없다, 플레이어가 서는 자리).
 *            층에 닿으면(들어가기·내려가기) `run.grace = {floor, roomIdx:0}` + 체력 100%(물약은 그대로).
 *            사당(`room.shrine`) 기능은 그대로 — 은총은 그 위에 얹는 표식일 뿐이다.
 *   사망 카드 보통 사망(결사·난입·부적·시련 아님)만 — 어디서(층·방)·누구에게·무슨 피해 세 줄 +
 *            "남는 것: 도감·인물·공적" + 「🕯️ 은총에서 다시」 단추.
 *   다시     단추 한 번 = 같은 층 은총에서 새로 선다(`dungeon.enter({floor})` — 층을 새로 짓는다: 적은 다시 서고,
 *            유품은 그 층에 그대로 남아 있어 밟으면 되찾는다). 결사는 판이 끝났으니 단추가 없다.
 *
 * 마지막 피해는 dungeon.js `hurtPlayer(amount, el, src, how)` 가 `run.lastHit = {who, how}` 로 남기고,
 * `die()` 가 `dungeon:end` 에 `where = {floor, room, rooms, lastHit}`·`hardcore` 를 얹는다.
 * 세이브는 안 쓴다(은총은 회차 안에서만 뜻이 있다 — 옛 세이브 그대로 열린다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function DN() { return global.DG.dungeon || null; }
  function on() { return core.tuned ? (core.tuned('grace.on', 1) ? true : false) : true; }

  var last = null;      // 마지막으로 닿은 은총 { floor } — 죽은 뒤 단추가 쓴다(run 은 이미 없다)

  /** 보통 회차인가 — 난입·부적·시련은 은총이 없다 */
  function normal(run) { return !!run && !run.horde && !run.nightmare && !run.trial; }

  /** 은총에 닿았다 — 표식을 얹고 체력을 채운다 */
  function touch(run) {
    if (!on() || !normal(run)) { return null; }
    run.grace = { floor: run.floor, roomIdx: 0 };
    run.hp = run.hpMax;
    last = { floor: run.floor };
    return run.grace;
  }
  function onEnter(run) { touch(run); }
  function onFloor() { var D = DN(); if (D && D.raw) { touch(D.raw()); } }

  var EL_HOW = { fire: '불 피해', cold: '냉기 피해', lit: '번개 피해', pois: '독 피해', chi: '기 피해', emp: '허 피해' };
  /** 피해 결 → 글 — 결 없음·물리는 "물리 피해" */
  function howOf(el, kind) {
    if (kind) { return kind; }
    return EL_HOW[el] || '물리 피해';
  }

  /** 세션 카드(goals.js buildCard)에 세 칸 + 남는 것 + 다시 단추 표식을 얹는다. 보통 사망만 */
  function decorate(card, payload) {
    if (!on() || !payload || payload.horde || payload.nightmare || payload.trial || !payload.where) { return card; }
    var w = payload.where, lh = w.lastHit || {};
    card.where = '제' + w.floor + '층 · ' + ((w.room || 0) + 1) + '번째 방' + (w.rooms ? '(' + w.rooms + '칸 중)' : '');
    card.who = lh.who || '알 수 없는 적';
    card.how = lh.how || '물리 피해';
    card.keep = '도감·인물·공적은 그대로';
    card.restart = !payload.hardcore;
    card.graceFloor = w.floor;
    if (card.restart) { card.next = '제' + w.floor + '층 은총에서 다시' + (card.lostGold || card.lostItems ? '(유품 회수)' : ''); }
    return card;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** 카드 본문 세 줄 + 남는 것(ui.js showGoalsCard 가 끼운다) */
  function cardHtml(card) {
    if (!card || !card.where) { return ''; }
    return '<div>📍 ' + esc(card.where) + '</div>' +
      '<div>⚔️ ' + esc(card.who) + '에게 · ' + esc(card.how) + '</div>' +
      '<div>🕯️ 남는 것: ' + esc(card.keep) + '</div>';
  }
  function btnHtml(card) {
    if (!card || !card.restart) { return ''; }
    return '<button class="btn primary wide" data-grace-restart="' + (card.graceFloor | 0) + '" style="margin-bottom:6px">🕯️ 은총에서 다시 · 제' + (card.graceFloor | 0) + '층</button>';
  }

  /** 은총에서 다시 — 같은 층을 새로 짓고 은총(들머리)에 선다. 반환 = enter 결과 */
  function restartAtGrace(floor) {
    var D = DN();
    var f = floor || (last && last.floor);
    if (!on() || !D || !f || D.active() || (D.fallen && D.fallen())) { return false; }
    return D.enter({ floor: f });
  }

  var bound = false;
  function bind() {
    if (bound || typeof document === 'undefined') { return; }
    bound = true;
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-grace-restart]') : null;
      if (!b) { return; }
      e.preventDefault();
      var f = parseInt(b.getAttribute('data-grace-restart'), 10) || 0;
      var card = b.parentNode, close = card && card.querySelector('[data-act="goals-card-close"]');
      if (close) { close.click(); }                      // 카드 닫기는 ui.js 의 같은 길(encClose)
      restartAtGrace(f);
    });
  }

  function init() {
    if (init.done) { return; }
    init.done = true;
    core.on('dungeon:enter', onEnter);
    core.on('dungeon:floor', onFloor);
    bind();
  }
  init();

  global.DG = global.DG || {};
  global.DG.grace = {
    on: on, normal: normal, touch: touch, howOf: howOf, decorate: decorate, cardHtml: cardHtml, btnHtml: btnHtml,
    restartAtGrace: restartAtGrace, last: function () { return last; },
    /** 재미표준 F 측정 — 복귀 조작 수(카드 단추 → 시작)와 복귀 시간(즉시) */
    RESTART_TAPS: 2, RESTART_SEC: 0
  };
})(window);
