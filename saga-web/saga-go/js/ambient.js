/**
 * 걷기 흥 — 사건 사이를 메운다 (축1, 2026-09-06 "이동·조작이 단조롭다")
 * ---------------------------------------------------------------
 * `event.js`(420→300m·55→62%)가 걷다가 만나는 **큰 사건**을 잰다. 그런데
 * 사용자가 실제로 겪은 불만은 "그 사이가 빈다"였다 — 큰 사건은 자주 만들면
 * 판정이 시끄러워진다(고를 뜻이 흐려진다). 대신 **판정에 안 닿는 가벼운
 * 신호**를 훨씬 잦게 흘려 그 사이를 메운다. 세 갈래:
 *
 *   flavor  풍경 한 줄 — 땅·시각·날씨에 따라 갈리는 토스트. 대개 아무것도
 *           안 주지만, 가끔(기본 15%) 길가에서 몇 닢·몇 경험치를 줍는다
 *   radar   원작의 발자국·오픈월드 모험 게임의 "저기 뭔가 있다" — `land.js` 의 숨은
 *           자리(동굴·사당·폐허)가 **발견 판정 반경(34m) 밖에서부터** 미리
 *           신호를 준다. 방향(8방위)까지 알려 준다 — 정확한 좌표는 여전히
 *           스스로 찾아야 걷는 뜻이 있다
 *   (사건 트리거 자체의 진동·테두리 섬광은 `event.js`·`style.css` 쪽에 얹었다)
 *
 * `event.js` 와 같은 결로 짠다 — 값을 내는 함수(`pickFlavor`·`radarCandidates`·
 * `microReward`)는 **순수**하고, 세이브가 바뀌는 곳(`tick`)은 한 군데다.
 * 손잡이 `ambient.on` 을 0 으로 두면 통째로 잠든다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  function on() { return core.tuned('ambient.on', 1) ? true : false; }
  /** 풍경 토스트를 몇 m 마다 굴리나 — `event.js` 보다 훨씬 잦다(비어 보이던 그 사이) */
  function STEP() { return core.tuned('ambient.stepM', 110); }
  /** 그 주사위에서 실제로 뜰 확률 — 매번 뜨면 소음이니 조금 거른다 */
  function CHANCE() { return core.tuned('ambient.chance', 0.8); }
  /** 그중 몇 할이 소액 보상(금·경험치)까지 얹나 */
  function REWARD_CHANCE() { return core.tuned('ambient.rewardChance', 0.15); }
  /** 숨은 자리를 이만큼 안에서부터 눈치채나(m) — `codex.js` 의 실제 발견 반경(34m)보다
   *  훨씬 넓게 잡아야 "저기 뭔가 있다"가 먼저 오고 실제로 찾아가는 여정이 생긴다 */
  function RADAR_M() { return core.tuned('ambient.radarM', 220); }

  /* ── 풍경 한 줄 ────────────────────────────────────────
   * 땅 갈래(land.js·geo.js 가 공유하는 일곱)마다 낮/밤 한 벌씩. 판정에 안 닿는
   * 순수 분위기라 다섯 판이 나눠 가질 필요가 없다 — 사가만리만의 것이다.
   */
  var FLAVOR = {
    grass: {
      day: ['풀벌레가 발치에서 튀어 오른다.', '들바람에 풀잎이 눕는다.', '멀리 새 떼가 줄지어 난다.'],
      night: ['풀숲에서 낮은 울음이 들렸다 그친다.', '별빛 아래 들판이 은빛으로 눕는다.']
    },
    forest: {
      day: ['나뭇잎 사이로 빛이 잘게 부서진다.', '딱따구리 소리가 울린다.', '이끼 냄새가 짙다.'],
      night: ['가지 부러지는 소리에 걸음이 잠깐 멎는다.', '올빼미 울음이 숲 안쪽에서 온다.']
    },
    mount: {
      day: ['능선 너머로 구름이 넘어간다.', '돌부리가 미끄러워 발끝에 힘을 준다.', '멀리 골짜기가 한눈에 든다.'],
      night: ['찬 바람이 등을 타고 내려온다.', '달이 능선 끝에 걸려 있다.']
    },
    water: {
      day: ['물살 소리가 점점 커진다.', '물수제비 뜨기 좋은 돌이 발에 채인다.', '물비린내가 훅 끼친다.'],
      night: ['검은 물 위로 달빛이 길게 눕는다.', '어디선가 개구리 울음이 시작된다.']
    },
    road: {
      day: ['바큇자국이 길게 패어 있다.', '지나던 발자국이 여럿 겹쳐 있다.', '길가 이정표가 반쯤 기울었다.'],
      night: ['등불 하나 없는 길이 멀리까지 이어진다.', '저벅이는 제 발소리만 크게 들린다.']
    },
    town: {
      day: ['어디선가 밥 짓는 냄새가 난다.', '아이들 웃음소리가 담장을 넘는다.', '장터 쪽에서 흥정 소리가 들린다.'],
      night: ['몇 집만 등불이 남아 있다.', '개 짖는 소리가 골목을 돈다.']
    },
    farm: {
      day: ['벼 이삭이 바람에 물결친다.', '허수아비가 삐딱하게 서 있다.', '농부의 노랫가락이 멀리서 온다.'],
      night: ['논물에 별이 비친다.', '멀리 원두막에 등 하나가 켜져 있다.']
    },
    _default: {
      day: ['발밑에서 흙먼지가 인다.', '해가 벌써 이만큼 기울었다.'],
      night: ['어둠 속에서도 길은 그럭저럭 보인다.', '밤공기가 서늘하다.']
    }
  };

  /** 날씨가 갤 때가 아니면(비·눈·안개) 이 중 하나가 땅 갈래 대신 나올 수 있다 */
  var WEATHER_FLAVOR = {
    rain: ['빗방울이 옷깃을 파고든다.', '진창이 신발에 들러붙는다.', '빗소리에 다른 소리가 다 묻힌다.'],
    snow: ['눈이 발자국을 곧 지운다.', '숨을 뱉을 때마다 하얗게 퍼진다.'],
    fog: ['안개가 짙어 열 걸음 앞도 흐리다.', '소리만 또렷하고 형체는 흐릿하다.']
  };

  /**
   * 이 자리·이 시각·이 날씨에 뜰 한 줄을 고른다 — **순수 함수**(roll 을 주면 결정된다).
   * @param {string} kind 땅 갈래(없으면 _default)
   * @param {boolean} night
   * @param {string} weather 'clear'|'rain'|'snow'|'fog'|...
   * @param {number} roll1 날씨 줄로 갈릴지(0~1) · roll2 그 안에서 어느 줄일지(0~1)
   */
  function pickFlavor(kind, night, weather, roll1, roll2) {
    roll1 = roll1 === undefined ? Math.random() : roll1;
    roll2 = roll2 === undefined ? Math.random() : roll2;
    var wf = WEATHER_FLAVOR[weather];
    if (wf && wf.length && roll1 < 0.4) {
      return wf[Math.min(wf.length - 1, Math.floor(roll2 * wf.length))];
    }
    var pool = FLAVOR[kind] || FLAVOR._default;
    var lines = (night ? pool.night : pool.day) || pool.day;
    return lines[Math.min(lines.length - 1, Math.floor(roll2 * lines.length))];
  }

  /**
   * 풍경 줄에 얹는 소액 보상 — 대개 없다(null). **순수 함수**.
   * @param {number} roll 0~1 · @param {number} roll2 금·경험치 중 무엇이 얼마나
   */
  function microReward(roll, roll2) {
    if (roll >= REWARD_CHANCE()) { return null; }
    roll2 = roll2 === undefined ? Math.random() : roll2;
    if (roll2 < 0.5) {
      var gold = 2 + Math.floor(roll2 * 2 * 5);           // 2~6
      return { gold: gold, exp: 0, text: '길가에서 엽전 몇 닢을 주웠다.' };
    }
    var exp = 3 + Math.floor((roll2 - 0.5) * 2 * 6);       // 3~8
    return { gold: 0, exp: exp, text: '걸으며 눈에 익힌 것이 도움이 됐다.' };
  }

  /* ── 발자국(레이더) ───────────────────────────────────
   * `land.js` 의 숨은 자리(동굴·사당·폐허)를 codex 가 아직 못 찍었으면,
   * 실제 발견 반경(34m)보다 훨씬 넓은 반경 안에서 방향만 미리 알려 준다.
   */
  var DIRS = ['동', '북동', '북', '북서', '서', '남서', '남', '남동'];
  /** dx(+동) · dy(+남) 에서 8방위 — 순수 함수 */
  function compass(dx, dy) {
    var deg = Math.atan2(-dy, dx) * 180 / Math.PI;
    if (deg < 0) { deg += 360; }
    return DIRS[Math.round(deg / 45) % 8];
  }

  /**
   * 지금 반경 안에 있는(아직 안 찾은) 숨은 자리들 — 가까운 순. **순수 함수**
   * (codex 에 이미 찍힌 것은 스스로 뺀다 — 찾은 자리를 또 알릴 이유가 없다).
   */
  function radarCandidates(pos) {
    var L = global.DG.land, CX = global.DG.codex;
    if (!L || !L.on()) { return []; }
    var ps = L.places(), r = RADAR_M(), out = [], i, p, d;
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      if (!p.hidden) { continue; }
      if (CX && CX.has('place', p.id)) { continue; }
      d = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (d <= r) {
        out.push({ id: p.id, name: p.name, dist: d, dir: compass(p.x - pos.x, p.y - pos.y) });
      }
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }

  /* ── 때 ───────────────────────────────────────────────
   * `event.js` 의 `mark()`·`tick()` 과 같은 결 — 걸은 거리로 잰다.
   */
  function markOf(p) {
    if (p.ambientMark === undefined || p.ambientMark > p.distance) { p.ambientMark = p.distance; }
    return p.ambientMark;
  }

  function flavorTick(p) {
    var step = STEP();
    markOf(p);
    var gap = p.distance - p.ambientMark;
    if (gap < step) { return; }
    if (gap > step * 3) { p.ambientMark = p.distance; return; }  // 배속 순행 등 큰 도약은 한 번에 삼킨다
    p.ambientMark += step;
    if (Math.random() >= CHANCE()) { return; }

    var L = global.DG.land, W = global.DG.weather, WD = global.DG.world;
    var tx = Math.floor(p.pos.x / 48), ty = Math.floor(p.pos.y / 48);
    var a = L ? L.at(tx, ty) : null;
    var h = new Date().getHours();
    var night = h >= 21 || h < 4;
    var weather = W ? W.current().key : 'clear';
    /* event.js 의 contextAt() 과 같은 함정을 안 밟는다(2026-09-06, 축1 재확인 중
       발견) — 하북 마을 밖에서 그냥 null 로 떨어지면 늘 _default 줄만 나와
       실제 땅(숲·산·물)과 안 맞는 밋밋한 문구가 반복된다. world.terrainAt() 으로
       떨어져 실제 땅 갈래를 쓴다 */
    var kind = a ? a.kind : (WD && WD.terrainAt ? WD.terrainAt(tx, ty) : null);
    var line = pickFlavor(kind, night, weather);
    var rw = microReward(Math.random(), Math.random());

    if (rw) {
      if (rw.gold) { p.gold += rw.gold; }
      if (rw.exp) { core.gainExp(rw.exp); }
      var bits = (rw.gold ? ' · 🪙 +' + rw.gold : '') + (rw.exp ? ' · 경험치 +' + rw.exp : '');
      core.emit('toast', { msg: line + bits, type: 'good' });
    } else {
      core.emit('toast', { msg: line, type: 'info' });
    }
  }

  function radarTick(p) {
    if (!p.radarPing) { p.radarPing = {}; }
    var cs = radarCandidates(p.pos), i, c;
    for (i = 0; i < cs.length; i++) {
      c = cs[i];
      if (p.radarPing[c.id]) { continue; }              // 이미 알렸다 — 실제로 찾을 때까지 조용히
      p.radarPing[c.id] = true;
      core.emit('toast', { msg: '🧭 ' + c.dir + '쪽에서 심상치 않은 기운이 느껴진다', type: 'find' });
    }
    /* 멀어지면 다시 알릴 수 있게 놓아준다 — 되돌아올 때 또 다른 신호를 준다 */
    var keys = Object.keys(p.radarPing), r2 = RADAR_M() * 1.6;
    for (i = 0; i < keys.length; i++) {
      var pl = global.DG.land && global.DG.land.place(keys[i]);
      if (pl && Math.hypot(pl.x - p.pos.x, pl.y - p.pos.y) > r2) { delete p.radarPing[keys[i]]; }
    }
  }

  function busy() {
    var W = global.DG.world, E = global.DG.event;
    return !!((W && W.inputBlocked && W.inputBlocked()) || (E && E.busy && E.busy()));
  }

  function tick() {
    if (!on() || global.DG_NO_DRAW) { return; }
    if (busy()) { return; }
    var p = core.save.player;
    flavorTick(p);
    radarTick(p);
  }

  function stats(pos) {
    pos = pos || core.save.player.pos;
    return { on: on(), radar: radarCandidates(pos), radarM: RADAR_M(), stepM: STEP(), chance: CHANCE() };
  }

  global.DG = global.DG || {};
  global.DG.ambient = {
    FLAVOR: FLAVOR, WEATHER_FLAVOR: WEATHER_FLAVOR,
    on: on, pickFlavor: pickFlavor, microReward: microReward,
    compass: compass, radarCandidates: radarCandidates,
    tick: tick, stats: stats
  };
})(window);
