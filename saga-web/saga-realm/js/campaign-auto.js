/**
 * 5천하 장 흐름 자동 진행 (W-0463, 사용자 10-26 「다섯판 2d 모두 자동퀘스트 확인」 → 「자동 퀘스트가 진행되도록」)
 * ---------------------------------------------------------------
 * 다른 네 판의 ▶ 자동 퀘스트(#aq-go)처럼, 장 흐름(조조전식)에서 ▶ 하나로 노선도 → 이야기 → 진영 → 설전·일기토 → 격자 전투 → 결과 → 다음 장을 이어 간다.
 * 사람이 누르는 단추([data-cp]·tacticsView.auto/go)를 그대로 눌러 진행한다 — 규칙을 새로 만들지 않는다.
 *   이야기   첫째 고름(atk — 내 병력 +15%) · 후일담은 「이어서」
 *   진영     prep(no): 전직할 수 있으면 능력 갈래대로(지력 → 군사·귀모 · 통솔 > 무력 → 기장·대장군 · 그 밖 → 맹장·패왕) · 용병은 적 편성을 보고 상성 맞춤
 *   설전·일기토  미니게임 대신 능력 비교(일기토 무력·설전 지력 — 내가 같거나 높으면 이김)
 *   전투     턴마다 tacticsView.autoTurn()(W-0465, 손잡이 realm.campaignAutoTurn 0 = auto() 로 한 번에) → 결과 → 노선도. 지면 멈춤(진영에서 다시 고르라고) · 결말에서 멈춤
 * 손잡이 realm.campaignAuto(1, 0 = 단추 없음). 켬 상태는 저장하지 않는다(다시 열면 꺼짐).
 *
 *   DG.campaignAuto.on() · running() · toggle() · prep(no) · preWin(no) · btnHtml() · tick()
 */
(function (global) {
  'use strict';
  function C() { return global.DG.core; }
  function CP() { return global.DG.campaign; }
  function CV() { return global.DG.campaignView; }
  function TV() { return global.DG.tacticsView; }
  function OFF() { return global.DG.off; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('realm.campaignAuto', 1)); }
  var run = false, timer = null, phase = '', at = 0, STEP_MS = 900;
  function TURN_MODE() { var c = C(); return !(c && c.tuned && !+c.tuned('realm.campaignAutoTurn', 1)); }   // W-0465 1 = 전투를 턴마다 보여 줌(BATTLE_WAIT 간격) · 0 = 한 번에
  function BATTLE_WAIT() { var c = C(); return c && c.tuned ? +c.tuned('realm.campaignAutoWait', 1800) : 1800; }   // 전투를 펼쳐 보이는 시간(ms) — 진단은 0
  var BEAT = { cav: 'spear', bow: 'cav', spear: 'bow' };   // 이 병종을 이기는 병종(창>기>궁>창)

  function toast(t) { var U = global.DG.ui; if (U && U.toast) { U.toast(t); } }
  function q(sel) { var d = global.document; return d ? d.querySelector('#campaign ' + sel) || d.querySelector(sel) : null; }
  function click(sel) { var b = q(sel); if (b && !b.disabled) { b.click(); return true; } return false; }

  /** 진영 준비 — 전직·용병 상성. 한 것 목록 */
  function prep(no) {
    var cp = CP().state(), RC = global.DG.realmClass, did = [];
    CP().party().forEach(function (id) {
      var ch = CP().classChoices ? CP().classChoices(id) : [];
      if (ch.length && RC) {
        var s = OFF().stats(id) || {}, want = s.wisdom >= s.might ? ['tactic', 'sage'] : (s.command > s.might ? ['rider', 'marshal'] : ['brave', 'overlord']);
        var k = ch.filter(function (x) { return want.indexOf(x) >= 0; })[0] || ch[0];
        if (CP().promote(id, k).ok) { did.push(id + '→' + k); }
      }
    });
    var fm = CP().foeMercs ? CP().foeMercs(no) : [];
    if (fm.length) {
      cp.mercs = cp.mercs || {};
      CP().party().forEach(function (id, i) {
        var f = fm[i % fm.length].arms, full = [BEAT[f[0]], BEAT[f[1] || f[0]], BEAT[f[0]]];
        cp.mercs[id] = full; did.push(id + ':' + full.join('/'));
      });
    }
    return did;
  }
  /** 설전·일기토 — 능력 비교 */
  function preWin(no) {
    var A = CP().preActors(no), key = A.kind === 'duel' ? 'might' : 'wisdom', me = (OFF().stats(A.me) || {})[key] || 0, fo = A.foe ? ((OFF().stats(A.foe) || {})[key] || 0) : 0;
    return me >= fo;
  }

  function stop(why) {
    run = false; phase = '';
    if (timer) { global.clearTimeout(timer); timer = null; }
    if (why) { toast('⏸ 자동 진행 멈춤 — ' + why); }
    paint();
  }
  /** 전투 화면엔 위 띠가 없다 — 켜져 있는 동안 떠 있는 ⏸ 단추(#aq-cp-float) */
  function floatBtn(show) {
    var d = global.document; if (!d || !d.body) { return; }
    var b = d.getElementById('aq-cp-float');
    if (!show) { if (b) { b.style.display = 'none'; } return; }
    if (!b) { b = d.createElement('button'); b.id = 'aq-cp-float'; b.className = 'cpg-btn on'; b.textContent = '⏸ 자동 진행'; b.title = '자동 진행 멈춤'; b.style.cssText = 'position:fixed;top:64px;right:16px;z-index:90;padding:6px 14px;min-height:34px'; b.addEventListener('click', function () { stop('멈췄습니다'); }); d.body.appendChild(b); }
    b.style.display = '';
  }
  function paint() { floatBtn(run && !!(TV() && TV().cur && TV().cur() && global.document.getElementById('cpg-tac'))); var b = global.document && global.document.getElementById('aq-cp'); if (b) { b.textContent = run ? '⏸' : '▶'; b.title = run ? '자동 진행 멈춤' : TITLE; b.classList.toggle('on', run); } }
  var TITLE = '자동 진행 — 장 고르기·이야기·진영 준비·설전·전투·결과를 이어서 대신(지면 멈춤)';
  function btnHtml() { return on() ? '<button id="aq-cp" class="cpg-btn' + (run ? ' on' : ' ghost') + '" data-cp="auto" title="' + (run ? '자동 진행 멈춤' : TITLE) + '" style="min-width:44px;padding:6px 12px">' + (run ? '⏸' : '▶') + '</button>' : ''; }
  function toggle() { if (run) { stop(); } else { run = true; paint(); toast('▶ 자동 진행 — 장 흐름을 이어서 대신합니다'); schedule(300); } return run; }
  function schedule(ms) { if (timer) { global.clearTimeout(timer); } timer = global.setTimeout(tick, ms == null ? STEP_MS : ms); }

  /** 한 박자 — 지금 화면을 보고 사람이 누를 단추 하나 */
  function tick() {
    timer = null;
    if (!run) { return; }
    var cp = CP().state(), tv = TV() && TV().cur ? TV().cur() : null, host = global.document && global.document.getElementById('campaign');
    if (!cp || !host || host.style.display === 'none') { stop('장 흐름 화면이 닫혔습니다'); return; }
    paint();
    if (tv && global.document.getElementById('cpg-tac')) {   // 격자 전투
      if (!tv.b.done && !tv.out) {
        if (phase !== 'battle') { phase = 'battle'; at = Date.now(); }
        if (Date.now() - at >= BATTLE_WAIT()) { if (TURN_MODE() && TV().autoTurn) { TV().autoTurn(); at = Date.now(); } else { TV().auto(); } }
      } else if (TV().go) { phase = ''; TV().go(); }
      schedule(); return;
    }
    if (q('.cpg-result')) {
      if (click('[data-cp="route"]')) { schedule(); return; }
      if (q('[data-cp="pre-go"]')) { var w = preWin(cp.ch); CP().preResult(cp.ch, w); toast(w ? '이겼다 — 적의 기세가 꺾였다' : '졌다 — 그래도 싸움은 연다'); CV().show('camp'); schedule(); return; }
      if (q('[data-cp="round"]') || q('[data-cp="ending"]')) { stop('천하 평정 — 결말입니다'); return; }
      if (q('[data-cp="camp"]')) { stop('졌습니다 — 진영에서 편성을 바꿔 다시 도전하세요'); return; }
    }
    if (cp.step === 'route') { if (CP().ended && CP().ended()) { stop('천하 평정 — 결말입니다'); return; } if (!click('.cpg-node.now') && !click('[data-cp="ch"][data-no="' + cp.ch + '"]')) { stop('갈 장이 없습니다'); return; } schedule(); return; }
    if (cp.step === 'story') { if (!click('[data-cp="choose"]')) { click('[data-cp="route"]'); } schedule(); return; }
    if (cp.step === 'camp') { prep(cp.ch); if (!click('[data-cp="go"]')) { stop('출진할 수 없습니다'); return; } schedule(); return; }
    schedule();
  }

  global.DG = global.DG || {};
  global.DG.campaignAuto = { on: on, running: function () { return run; }, toggle: toggle, stop: stop, prep: prep, preWin: preWin, btnHtml: btnHtml, tick: tick, BEAT: BEAT };
})(typeof window !== 'undefined' ? window : this);
