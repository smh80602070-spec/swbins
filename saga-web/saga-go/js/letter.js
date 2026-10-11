/**
 * 천거장(薦擧狀) — 원작의 알
 * ---------------------------------------------------------------
 * 봉해진 추천서다. 행낭에 넣고 **그만큼 걸으면** 봉을 뗄 수 있고,
 * 적힌 사람이 찾아온다. 원작의 것을 같은 자리에 같은 역할로 옮겼다:
 *
 *   알        → 천거장          부화기(3칸) → 행낭(3칸)
 *   2·5·10km  → 그대로 2·5·10km  부화        → 봉을 뗀다
 *   먼 알일수록 귀한 종 → 먼 천거장일수록 높은 등급의 인물
 *
 * 원작처럼 **거리는 행낭에 넣은 뒤부터** 센다. 넣지 않은 천거장은 걸어도 줄지 않는다.
 * 나오는 것은 사람뿐이다 — 짐승은 포획으로 얻는 것이라 여기서는 나오지 않는다.
 *
 * 보상 계산은 하지 않는다. 등용의 처리(도감·공적·경험치·금·동행)는
 * `encounter.gainHero()` 하나가 맡는다 — 손·자동·천거장이 같은 절차를 쓴다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;

  /** 원작과 같은 세 종류. 멀수록 귀한 사람이 온다 */
  var GRADES = [
    { key: 'g2',  km: 2,  name: '2km 천거장',  emoji: '✉️', color: '#8ab4d9',
      rarity: [1, 2, 3], weight: [45, 40, 15], desc: '고을에서 이름이 오르내리는 이' },
    { key: 'g5',  km: 5,  name: '5km 천거장',  emoji: '📩', color: '#d9b45a',
      rarity: [2, 3, 4], weight: [30, 45, 25], desc: '이름이 도(道)를 넘은 이' },
    { key: 'g10', km: 10, name: '10km 천거장', emoji: '🎗️', color: '#d98a8a',
      rarity: [4, 5],    weight: [62, 38],     desc: '한 시대에 몇 없는 이' }
  ];

  /** 역참이 천거장을 줄 때의 등급 뽑기 — 먼 것일수록 드물다 */
  var GIVE_WEIGHT = { g2: 62, g5: 30, g10: 8 };

  var BAG_MAX = 9;        // 원작 알 가방과 같다
  var SLOTS = 3;          // 행낭 칸

  /** 비문 초대장(PLAN §5 ⑤) — 키 'st:<권역코드>'. 3km 를 걸으면 그 권역의 ★4 인물이 온다 */
  function stelaGrade(key) {
    var S = global.DG.stela, r = S ? S.regionByCode(String(key).slice(3)) : null;
    if (!r) { return null; }
    return { key: key, km: 3, name: r.name + ' 비문 초대장', emoji: '📜', color: '#b8a6ff',
      rarity: [4], weight: [100], region: r, desc: '비석 열 개를 찾아 낸 이에게 온 초대' };
  }

  function gradeOf(key) {
    if (typeof key === 'string' && key.indexOf('st:') === 0) {
      var sg = stelaGrade(key);
      if (sg) { return sg; }
    }
    for (var i = 0; i < GRADES.length; i++) { if (GRADES[i].key === key) { return GRADES[i]; } }
    return GRADES[0];
  }

  /** 세이브 칸이 없던 옛 세이브도 여기서 채운다 (auto.js st() 와 같은 버릇) */
  function state() {
    var s = core.save;
    if (!s.letters) { s.letters = {}; }
    if (!Array.isArray(s.letters.bag)) { s.letters.bag = []; }
    if (!Array.isArray(s.letters.slots)) { s.letters.slots = []; }
    while (s.letters.slots.length < SLOTS) { s.letters.slots.push(null); }
    if (s.letters.slots.length > SLOTS) { s.letters.slots.length = SLOTS; }
    if (typeof s.letters.opened !== 'number') { s.letters.opened = 0; }
    return s.letters;
  }

  function bag() { return state().bag; }
  function slots() { return state().slots; }

  /* ── 받기 ─────────────────────────────────────────────── */

  function pickWeighted(keys, weights) {
    var total = 0, i;
    for (i = 0; i < weights.length; i++) { total += weights[i]; }
    var r = Math.random() * total;
    for (i = 0; i < keys.length; i++) {
      r -= weights[i];
      if (r <= 0) { return keys[i]; }
    }
    return keys[keys.length - 1];
  }

  /** 등급 하나 뽑기 (역참이 줄 때) */
  function rollGrade() {
    var keys = [], w = [];
    for (var i = 0; i < GRADES.length; i++) {
      keys.push(GRADES[i].key);
      w.push(GIVE_WEIGHT[GRADES[i].key] || 1);
    }
    return pickWeighted(keys, w);
  }

  /**
   * 천거장을 받는다. 가방이 꽉 차 있으면 받지 않는다(원작과 같다).
   * @returns {object|null} 받은 등급 정의
   */
  function give(gradeKey) {
    var b = bag();
    if (b.length >= BAG_MAX) { return null; }
    var g = gradeOf(gradeKey || rollGrade());
    b.push(g.key);
    return g;
  }

  /* ── 행낭 ─────────────────────────────────────────────── */

  /** 가방의 천거장을 빈 칸에 넣는다. 넣는 순간부터 거리를 센다 */
  function put(bagIndex, slotIndex) {
    var st = state();
    if (bagIndex < 0 || bagIndex >= st.bag.length) { return false; }
    if (slotIndex === undefined || slotIndex === null) {
      slotIndex = st.slots.indexOf(null);
    }
    if (slotIndex < 0 || slotIndex >= SLOTS || st.slots[slotIndex]) { return false; }
    var key = st.bag.splice(bagIndex, 1)[0];
    st.slots[slotIndex] = { g: key, startM: core.save.player.distance };
    core.log('📮 ' + gradeOf(key).name + ' 을 행낭에 넣었다 — 걸으면 열립니다', 'info');
    core.emit('changed');
    return true;
  }

  /** 빈 칸이 있고 가방에 천거장이 있으면 알아서 채운다 (자동 순행이 쓴다) */
  function autoFill() {
    var st = state(), put0 = 0;
    while (st.bag.length && st.slots.indexOf(null) >= 0) {
      /* 먼 것부터 넣는다 — 어차피 같은 거리를 걷는다면 귀한 쪽이 이득이다 */
      var bestI = 0, bestKm = -1;
      for (var i = 0; i < st.bag.length; i++) {
        var km = gradeOf(st.bag[i]).km;
        if (km > bestKm) { bestKm = km; bestI = i; }
      }
      if (!put(bestI, null)) { break; }
      put0++;
    }
    return put0;
  }

  /** 한 칸의 진행 상태 */
  function progress(slot) {
    if (!slot) { return null; }
    var g = gradeOf(slot.g);
    var need = Math.round(g.km * 1000 * (global.DG.starchart ? global.DG.starchart.egg() : 1));   // 성도(W-0181) — 발품·맨발
    var walked = core.clamp(core.save.player.distance - slot.startM, 0, need);
    return {
      grade: g, need: need, walked: walked,
      left: Math.max(0, need - walked),
      pct: Math.round(walked / need * 100),
      done: walked >= need
    };
  }

  /* ── 봉을 뗀다 ────────────────────────────────────────── */

  /** 이 등급에서 나올 사람 하나 */
  function pickHero(g) {
    if (g.region) {
      /* 비문 초대장 — 그 권역 인물(genchar ★4). 열 때마다 다른 사람이 오도록 연 횟수를 섞는다 */
      var GC = g.region.country === 'jp' ? global.DG.gencharJp
        : (g.region.country === 'cn' ? global.DG.gencharCn
        : (g.region.country === 'xy' ? global.DG.gencharXy : global.DG.genchar));
      var idx = (state().opened + 1) * 131 + g.region.code.charCodeAt(0);
      var gh = GC ? GC.hero(g.region.code, 4, idx) : null;
      if (gh) { return gh; }
    }
    var want = parseInt(pickWeighted(g.rarity, g.weight), 10);
    var pool = data.heroes.filter(function (h) { return h.rarity === want; });
    if (!pool.length) {
      pool = data.heroes.filter(function (h) { return h.rarity <= want; });
    }
    return pool.length ? core.pick(pool) : core.pick(data.heroes);
  }

  /**
   * 한 칸을 연다 (다 걸었을 때만).
   * @returns {{hero:object, grade:object, reward:object}|null}
   */
  function open(slotIndex) {
    var st = state();
    var slot = st.slots[slotIndex];
    var pr = progress(slot);
    if (!pr || !pr.done) { return null; }
    var h = pickHero(pr.grade);
    st.slots[slotIndex] = null;
    st.opened += 1;
    var reward = global.DG.encounter.gainHero(h);
    if (global.DG.quest) { global.DG.quest.progress('letter', 1); }
    core.log('✉️ ' + pr.grade.name + ' — ' + h.name + ' 이(가) 찾아왔다!', 'good');
    return { hero: h, grade: pr.grade, reward: reward };
  }

  /* ── 결과 화면 ────────────────────────────────────────── */

  var showing = false;

  function host() { return document.getElementById('encounter'); }

  function close() {
    showing = false;
    var el = host();
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    core.emit('changed');
  }

  function show(res) {
    var el = host();
    if (!el) { return; }
    showing = true;
    var h = res.hero, g = res.grade;
    el.innerHTML =
      '<div class="enc-card result good">' +
        '<div class="enc-big">' + global.DG.portrait3d.img('hero', h, 96) + '</div>' +
        '<h3>' + g.emoji + ' ' + h.name + ' 이(가) 찾아왔다!</h3>' +
        '<p class="quote">"' + h.quote + '"</p>' +
        '<div class="enc-reward">' + g.name + ' · 공적 +' + res.reward.feat +
          ' · 경험치 +' + res.reward.exp + ' · 금 +' + res.reward.gold + '</div>' +
        '<button class="btn primary wide" data-act="ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    var ok = el.querySelector('[data-act="ok"]');
    if (ok) { ok.addEventListener('click', close); }
  }

  /* ── 매 프레임 ────────────────────────────────────────── */

  /**
   * 다 걸은 칸을 연다. game.js 루프가 부른다.
   *
   * 손으로 놀 때는 원작처럼 결과 화면이 뜨고, 자동 순행 중에는 뜨지 않는다
   * (모달이 뜨면 자동이 조우를 못 하고 그 자리에 선다).
   * @returns {number} 연 칸 수
   */
  function tick() {
    var st = state(), n = 0;
    for (var i = 0; i < SLOTS; i++) {
      var pr = progress(st.slots[i]);
      if (!pr || !pr.done) { continue; }
      var res = open(i);
      if (!res) { continue; }
      n++;
      var auto = global.DG.auto && global.DG.auto.active();
      if (auto || showing || (global.DG.encounter && global.DG.encounter.active)) {
        core.emit('toast', '✉️ ' + res.grade.name + ' — ' + res.hero.name + ' 이(가) 찾아왔다!');
      } else {
        show(res);
      }
    }
    if (n) {
      if (global.DG.auto && global.DG.auto.active()) { autoFill(); }
      core.emit('changed');
      core.persist();
    }
    return n;
  }

  global.DG = global.DG || {};
  global.DG.letter = {
    GRADES: GRADES, BAG_MAX: BAG_MAX, SLOTS: SLOTS,
    gradeOf: gradeOf, state: state,
    get bag() { return bag(); },
    get slots() { return slots(); },
    rollGrade: rollGrade, give: give,
    put: put, autoFill: autoFill,
    progress: progress, open: open, tick: tick,
    close: close,
    get showing() { return showing; }
  };
})(window);
