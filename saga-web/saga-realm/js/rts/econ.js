/**
 * RTS 경제 (W-0029·P2) — 하루 한 번 도는 순수 함수. 난수 없음(같은 상태 = 같은 결과).
 *
 *   수용 = 거점 + 이어진 주거의 cap 합 · 일자리 = 이어진 일터의 jobs 합
 *   일꾼 = min(인구의 60%, 일자리) · 채움 = 일꾼/일자리
 *   행복(0~100) = 주거별(기본 50 + 우물·망루가 닿으면 +) 평균 + 식량 여유·세율·과밀·실업 보정
 *   생산 배율 = 0.8 + 0.4 × 행복/100 (행복 50 = ×1.0) — 식량·시장·공방 생산에 곱한다
 *   식량: 농지 food×채움×배율 − 인구×0.35 · 금: 인구×세율 + 시장·공방 gold×채움×배율 − 유지비
 *   인구: 식량이 바닥이면 10% 줄고, 행복 25 미만이면 5%가 떠나며, 아니면 수용 여유의 15%×(행복/50)(최소 1)가 모인다
 *   세율: 낮음(0.2·행복 +12) · 보통(0.4) · 높음(0.7·행복 −20) — `s.tax` 0·1·2
 */
(function (global) {
  'use strict';

  var EAT = 0.35, WORKING = 0.6;
  var TAXES = [{ n: '낮음', r: 0.2, h: 12 }, { n: '보통', r: 0.4, h: 0 }, { n: '높음', r: 0.7, h: -20 }];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function taxOf(s) { return TAXES[s.tax === 0 || s.tax === 2 ? s.tax : 1]; }

  /** 이 주거에 닿는 시설 효과(+) 합 — 시설 중심까지 거리가 radius 이내 */
  function coverage(s, house) {
    var D = global.DG.rts.rules.DEFS, id, b, d, sum = 0, hx = house.x + D.house.w / 2, hy = house.y + D.house.h / 2;
    for (id in s.buildings) {
      b = s.buildings[id]; d = D[b.t];
      if (!d.radius || !d.happy) { continue; }
      if (Math.hypot(b.x + d.w / 2 - hx, b.y + d.h / 2 - hy) <= d.radius) { sum += d.happy; }
    }
    return sum;
  }

  /** 주거 한 채의 지금 행복(전체 보정 포함) — 화면 겹침이 쓴다 */
  function houseHappy(s, house, global_) {
    return clamp(50 + coverage(s, house) + (global_ === undefined ? 0 : global_), 0, 100);
  }

  /** 지금 숫자들 — 화면과 하루 틱이 같이 쓴다 */
  function stats(s) {
    var D = global.DG.rts.rules.DEFS, id, b, d, cap = 0, jobs = 0, upkeep = 0, houses = [], defense = 0;
    for (id in s.buildings) {
      b = s.buildings[id]; d = D[b.t];
      if (d.defense) { defense += d.defense; }
      if (d.upkeep && (b.conn || d.free)) { upkeep += d.upkeep; }
      if (!b.conn || d.free) { continue; }
      if (d.cap) { cap += d.cap; }
      if (d.jobs) { jobs += d.jobs; }
      if (b.t === 'house') { houses.push(b); }
    }
    var able = Math.floor(s.pop * WORKING), workers = Math.min(able, jobs), fill = jobs ? workers / jobs : 0, tax = taxOf(s), i;
    var local = 0; for (i = 0; i < houses.length; i++) { local += coverage(s, houses[i]); }
    local = houses.length ? local / houses.length : 0;
    var starving = s.res.food < s.pop * 2, comfy = s.res.food > s.pop * 4, mods = 0;
    mods += comfy ? 8 : (starving ? -15 : 0);
    mods += tax.h;
    if (cap > 0 && s.pop >= cap * 0.95) { mods -= 5; }
    if (able > 0 && (able - workers) / able > 0.5) { mods -= 8; }
    var happy = clamp(50 + local + mods, 0, 100), mul = 0.8 + 0.4 * happy / 100;
    var food = 0, gold = s.pop * tax.r - upkeep;
    for (id in s.buildings) {
      b = s.buildings[id]; d = D[b.t];
      if (!b.conn || d.free) { continue; }
      if (d.food) { food += d.food * fill * mul; }
      if (d.gold) { gold += d.gold * fill * mul; }
    }
    food -= s.pop * EAT;
    /* 수요(심시티의 R·I·F) — 0~1. 클수록 그 건물을 더 지어야 한다 */
    var demand = {
      housing: clamp((s.pop >= cap ? 0.5 : 0) + (jobs > able ? (jobs - able) / Math.max(jobs, 1) : 0), 0, 1),
      work: clamp(able > jobs ? (able - jobs) / Math.max(able, 1) : 0, 0, 1),
      food: clamp(food < 0 ? -food / Math.max(s.pop * EAT, 1) + 0.2 : (comfy ? 0 : 0.1), 0, 1)
    };
    return { cap: cap, jobs: jobs, workers: workers, fill: fill, foodNet: food, goldNet: gold, upkeep: upkeep, happy: happy, mul: mul, tax: tax, defense: defense, demand: demand, localHappy: local, globalHappy: mods };
  }

  /** 하루가 지났다 — s 를 고친다 */
  function dayTick(s) {
    var st = stats(s);
    s.res.food += st.foodNet;
    s.res.gold += st.goldNet;
    if (s.res.food < 0) {
      s.res.food = 0;
      s.pop = Math.max(0, s.pop - Math.ceil(s.pop * 0.1));
    } else if (st.happy < 25) {
      s.pop = Math.max(0, s.pop - Math.ceil(s.pop * 0.05));
    } else if (s.pop < st.cap) {
      s.pop = Math.min(st.cap, s.pop + Math.max(1, Math.floor((st.cap - s.pop) * 0.15 * st.happy / 50)));
    } else if (s.pop > st.cap) {
      s.pop = st.cap;
    }
    s.day += 1;
    return st;
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.econ = { stats: stats, dayTick: dayTick, houseHappy: houseHappy, coverage: coverage, TAXES: TAXES, TICKS_PER_DAY: 50 };
})(typeof window !== 'undefined' ? window : this);
