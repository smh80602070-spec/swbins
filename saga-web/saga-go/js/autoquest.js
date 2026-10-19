/**
 * autoquest.js — 자동 퀘스트 공용 틀(W-0337). 순수 상태 기계 — 그림·three 없음, DOM 은 button()·watchInput() 두 도우미만(없으면 안 쓴다).
 *
 * 모바일 MMO 문법: 목표 줄 ▶ 를 누르면 판이 주는 "지금 목표 목록"의 첫 것을 끝까지 대신한다(걷기·만남·대화·전투) → 끝나면 다음 목표.
 * 규칙은 여기 없다 — 어댑터(판)가 **공개 함수만** 불러 실행하고(1만리는 DG.auto 이야기 깃발), 이 틀은 "어느 목표를 · 언제 멈추나" 만 안다.
 *
 *   var q = DG.autoquest.make(adapter);   매 프레임 q.tick(dt)   ·   q.start() / q.stop(why) / q.toggle()   ·   q.status() → { on, goal, doing, why, stuck, done, since }
 *   adapter = {
 *     goals()        → [{ id, type('go'|'talk'|'kill'|'collect'|'enter'|'meet'), label, x, y, left }]  첫 것이 지금 목표(빈 배열이면 멈춤 '목표 없음')
 *     run(goal, dt)  → 한 줄(화면 글) — 판의 자동을 굴린다. 목표가 끝났는지는 goals() 첫 id 가 바뀌는 것으로 안다
 *     pos()          → { x, y }        busy() → true 면 막힘을 안 센다(대화·전투·창)
 *     pause()        → 멈출 이유 글 또는 null(체력 낮음·가방 참·…)  begin(goal) / end(why)  unstick(n, goal) → n 번째 막힘에 비켜 가기
 *   }
 * 막힘: busy 아닌데 stillM(1m) 안에 stuckSec(30초) 머물면 막힘 1 — unstick(n), stuckMax(3) 넘으면 멈춤 '막힘 — <목표>'. 손잡이 autoquest.stillM·stuckSec·stuckMax.
 * 멈춤 조건은 pause() 와 watchInput()(아무 조작 = 멈춤)이 준다. 이야기 장면은 건너뛰지 않는다 — 넘기는 건 판 자동(설정으로 끔).
 */
(function (global) {
  'use strict';
  function tn(k, d) { var C = global.DG && global.DG.core, v = C && C.tuned ? +C.tuned(k, d) : d; return isFinite(v) ? v : d; }
  function make(ad) {
    var st = { on: false, goal: null, doing: '', why: '', since: 0, still: 0, last: null, stuck: 0, done: 0 }, log = [];
    function first() { var gs = ad.goals ? ad.goals() : null; return gs && gs.length ? gs[0] : null; }
    function start() {
      if (st.on) { return false; }
      var g = first();
      if (!g) { st.why = '목표 없음'; return false; }
      st.on = true; st.why = ''; st.goal = g; st.since = 0; st.still = 0; st.stuck = 0; st.last = null; st.doing = '';
      if (ad.begin) { ad.begin(g); }
      return true;
    }
    function stop(why) {
      if (!st.on) { return false; }
      st.on = false; st.why = why || ''; st.goal = null; st.doing = '';
      if (ad.end) { ad.end(st.why); }
      return true;
    }
    function toggle() { return st.on ? !stop('손으로 끔') : start(); }
    function tick(dt) {
      if (!st.on) { return; }
      dt = dt > 0 ? dt : 0;
      var pz = ad.pause ? ad.pause() : null;
      if (pz) { stop(pz); return; }
      var g = first();
      if (!g) { stop('목표 없음'); return; }
      if (!st.goal || g.id !== st.goal.id) { st.done++; st.goal = g; st.since = 0; st.still = 0; st.stuck = 0; st.last = null; }
      st.since += dt;
      st.doing = (ad.run ? ad.run(g, dt) : '') || '';
      var p = ad.pos ? ad.pos() : null, busy = !!(ad.busy && ad.busy());
      if (!p || busy) { st.still = 0; st.last = p ? { x: p.x, y: p.y } : null; return; }   // 대화·전투·창 안에서는 서 있어도 막힘이 아니다
      if (st.last && Math.hypot(p.x - st.last.x, p.y - st.last.y) < tn('autoquest.stillM', 1)) { st.still += dt; }
      else { st.still = 0; st.last = { x: p.x, y: p.y }; }
      if (st.still < tn('autoquest.stuckSec', 30)) { return; }
      st.still = 0; st.stuck++;
      log.push({ t: Math.round(st.since), goal: g.id, n: st.stuck, x: Math.round(p.x), y: Math.round(p.y) });
      if (log.length > 40) { log.shift(); }
      if (st.stuck > tn('autoquest.stuckMax', 3)) { stop('막힘 — ' + (g.label || g.id)); return; }
      if (ad.unstick) { ad.unstick(st.stuck, g); }
    }
    function status() { return { on: st.on, goal: st.goal, doing: st.doing, why: st.why, stuck: st.stuck, done: st.done, since: st.since }; }
    return { start: start, stop: stop, toggle: toggle, tick: tick, status: status, first: first, log: function () { return log.slice(); } };
  }
  /** 아무 조작 = 멈춤. keys 는 소문자 키 목록(이동 키), stopOn(target) 이 true 인 곳의 pointerdown 만(지도 캔버스·조이스틱). 떼는 함수를 돌려준다 */
  function watchInput(q, o) {
    if (typeof document === 'undefined') { return function () {}; }
    o = o || {};
    function keys() { var k = typeof o.keys === 'function' ? o.keys() : o.keys; return k || ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']; }
    function onKey(e) { if (!q.status().on || e.repeat) { return; } var tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; } if (keys().indexOf(String(e.key || '').toLowerCase()) >= 0) { q.stop('손 조작(키)'); } }
    function onPtr(e) { if (!q.status().on) { return; } var t = e.target; if (!t || (o.stopOn ? !o.stopOn(t) : false)) { return; } q.stop('손 조작(탭)'); }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPtr, true);
    return function () { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onPtr, true); };
  }
  /** HUD ▶/⏸ 단추 — id 로 하나 만들고(없으면 body 에) 누르면 toggle. paint(visible) 로 글·표시를 맞춘다 */
  function button(q, id, titles) {
    if (typeof document === 'undefined' || !document.body) { return null; }
    var b = document.getElementById(id), last = '';
    if (!b) { b = document.createElement('button'); b.id = id; b.type = 'button'; b.style.display = 'none'; document.body.appendChild(b); b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); q.toggle(); }); }
    titles = titles || {};
    return { el: b, paint: function (visible) {
      var on = q.status().on, txt = visible ? (on ? '⏸' : '▶') : '';
      if (txt === last) { return; }
      last = txt; b.textContent = txt; b.style.display = txt ? '' : 'none'; b.classList.toggle('on', on);
      b.title = on ? (titles.on || '자동 퀘스트 멈춤') : (titles.off || '자동 퀘스트 — 목표를 끝까지 대신');
    } };
  }
  global.DG = global.DG || {};
  global.DG.autoquest = { make: make, watchInput: watchInput, button: button, TYPES: ['go', 'talk', 'kill', 'collect', 'enter', 'meet'] };
})(typeof window !== 'undefined' ? window : this);
