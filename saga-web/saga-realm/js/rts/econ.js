/**
 * RTS 경제 (W-0029, P1) — 하루 한 번 도는 순수 함수. 난수 없음(같은 상태 = 같은 결과).
 *
 *   수용 = 거점 + 이어진 주거의 cap 합 · 일자리 = 이어진 일터의 jobs 합
 *   일꾼 = min(인구의 60%, 일자리) · 채움 = 일꾼/일자리 — 이어진 일터마다 생산에 곱한다
 *   식량: 농지 food×채움 − 인구×0.35 · 금: 인구×0.4(세금) + 시장·공방 gold×채움 − 유지비
 *   인구: 식량이 바닥이면 10% 줄고, 아니면 수용 여유의 15%(최소 1)가 모인다
 */
(function (global) {
  'use strict';

  var EAT = 0.35, TAX = 0.4, WORKING = 0.6;

  /** 지금 숫자들 — 화면과 하루 틱이 같이 쓴다 */
  function stats(s) {
    var D = global.DG.rts.rules.DEFS, id, b, d, cap = 0, jobs = 0, upkeep = 0;
    for (id in s.buildings) {
      b = s.buildings[id]; d = D[b.t];
      if (!b.conn) { continue; }
      if (d.cap) { cap += d.cap; }
      if (d.jobs) { jobs += d.jobs; }
      if (d.upkeep) { upkeep += d.upkeep; }
    }
    var workers = Math.min(Math.floor(s.pop * WORKING), jobs), fill = jobs ? workers / jobs : 0;
    var food = 0, gold = s.pop * TAX - upkeep;
    for (id in s.buildings) {
      b = s.buildings[id]; d = D[b.t];
      if (!b.conn) { continue; }
      if (d.food) { food += d.food * fill; }
      if (d.gold) { gold += d.gold * fill; }
    }
    food -= s.pop * EAT;
    return { cap: cap, jobs: jobs, workers: workers, fill: fill, foodNet: food, goldNet: gold, upkeep: upkeep };
  }

  /** 하루가 지났다 — s 를 고친다 */
  function dayTick(s) {
    var st = stats(s);
    s.res.food += st.foodNet;
    s.res.gold += st.goldNet;
    if (s.res.food < 0) {
      s.res.food = 0;
      s.pop = Math.max(0, s.pop - Math.ceil(s.pop * 0.1));
    } else if (s.pop < st.cap) {
      s.pop = Math.min(st.cap, s.pop + Math.max(1, Math.floor((st.cap - s.pop) * 0.15)));
    } else if (s.pop > st.cap) {
      s.pop = st.cap;
    }
    s.day += 1;
    return st;
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.econ = { stats: stats, dayTick: dayTick, TICKS_PER_DAY: 50 };
})(typeof window !== 'undefined' ? window : this);
