/**
 * 짐승 — 이 땅에 사는 다섯 종 (3D 전환 PHASE 7)
 * ---------------------------------------------------------------
 * 이 판에는 이미 짐승이 있다. 다만 **잡는 대상**이다(`world.js` 의 스폰) —
 * 눈에 띄면 다가가 포획을 겨루고, 잡으면 도감에 오른다. 여기 들이는 다섯 종은
 * 그것과 **아주 다른 것**이다.
 *
 *   잡히지 않는다 · 도감에 안 오른다 · 세이브에 한 칸도 안 남는다
 *   대신 **먹고 · 돌고 · 도망가고 · 쫓고 · 날아오른다**
 *
 * `PLAN.md` 39절이 바라는 것이 이것이다 — "동물은 플레이어가 발견하는 재미를
 * 제공한다". 잡을 것이 아니라 **거기 살고 있는 것**이라야 땅이 살아 있어 보인다.
 *
 * 뼈대는 주민(`npc.js`)과 같다 — **자리는 시각의 순수 함수**다. 다만 한 겹이 더 있다.
 *
 *   바탕 자리   posAt()   시각만 본다. 무리가 하루 동안 도는 길
 *   반응        react()   **바탕 자리와 내 자리**에서 나온다. 도망·추적·날아오름
 *
 * 반응도 순수 함수로 두었다 — "쫓기는 중" 같은 상태를 안 들고 있다. 그래서
 * 자가진단이 "사슴 30m 앞에 서면 어디로 물러나나" 를 값으로 물어볼 수 있고,
 * LOD 로 계산을 걸러도 답이 안 바뀐다(주민에서 지킨 그 규칙이다).
 *
 * **한 줄도 판정에 닿지 않는다.** 손잡이 `animal.on` 을 0 으로 두면 통째로 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function land() { return global.DG.land; }

  /** 짐승을 들일까 — 0 이면 빈 들로 돌아간다 */
  function on() { return core().tuned('animal.on', 1) ? true : false; }
  /** 무리 크기 배수 — 기기가 버거우면 여기를 내린다 */
  function DENS() {
    var P = global.DG.perf;
    return core().tuned('animal.density', 1) * (P ? P.mul('animal') : 1);
  }

  /* ── 다섯 종 ──────────────────────────────────────────
   * `PLAN.md` 46절이 바라는 "동물 5종" 이고, 39절이 적어 둔 세 가지 몸짓
   * (사슴은 도망 · 늑대는 추적 · 새는 날아오름)을 그대로 넣었다. 거기에 대비로
   * **도망가지 않는 짐승**(소)을 하나 둔다 — 다 도망가면 도망이 눈에 안 띈다.
   *
   *   form·color  도감에 없는 짐승이라 **제 것을 들고 간다**(`sprite.beastFormOf`)
   *   sense       나를 알아채는 거리(m)     move  알아챈 뒤 움직이는 거리(m)
   *   act         'flee' 도망 · 'chase' 추적 · 'fly' 날아오름 · null 그대로
   *   only        'day' 면 낮에만 보인다
   */
  var KINDS = {
    deer: {
      id: 'deer', name: '사슴', form: 'quad', color: '#c39a6a', h: 0.88,
      act: 'flee', sense: 30, move: 22, only: 'day',
      note: '풀을 뜯다가 사람을 보면 물러난다'
    },
    wolf: {
      id: 'wolf', name: '늑대', form: 'quad', color: '#6b6b75', h: 0.84,
      act: 'chase', sense: 46, move: 20, senseNight: 70,
      note: '무리로 돈다. 알아채면 다가온다'
    },
    magpie: {
      id: 'magpie', name: '까치', form: 'bird', color: '#2f3340', h: 0.42,
      /* move 는 sense 보다 커지면 안 된다 — react()의 밀림 공식이 "알아챈 거리
         밖으로는 안 나간다"는 불변식을 move<sense 에서만 지킨다(2026-09-09,
         move:26>sense:18 이던 것을 고쳤다 — 코앞에서 놀라면 감지거리 밖까지
         날아가고 있었다) */
      act: 'fly', sense: 18, move: 13, lift: 7, only: 'day',
      note: '나무에 앉았다가 인기척에 날아오른다'
    },
    carp: {
      id: 'carp', name: '잉어', form: 'fish', color: '#d98a5a', h: 0.5,
      act: 'flee', sense: 12, move: 9, sink: -0.25, leap: 0.6,
      note: '물속을 돈다. 놀라면 흩어지며 수면을 튄다'
    },
    ox: {
      id: 'ox', name: '소', form: 'quad', color: '#8a7a68', h: 1.05,
      act: null, sense: 0, move: 0, only: 'day',
      note: '매인 짐승이라 사람을 봐도 그대로다'
    }
  };

  /* ── 무리 ─────────────────────────────────────────────
   * 무리는 이 땅의 이름난 자리 **둘 사이를 하루에 한 번 오간다**(39절 "무리 이동").
   * 왕복을 사인으로 그리면 끝에서 느려지고 가운데서 빨라진다 — 짐승이 목적지에
   * 다다라 머무는 것처럼 보인다. 왕복도 시각만 보므로 순수하다.
   */
  var HERDS = [
    { kind: 'deer', from: 'farm', to: 'wood', n: 4, seed: 11 },
    { kind: 'deer', from: 'wood', to: 'ridge', n: 3, seed: 23 },
    { kind: 'wolf', from: 'ridge', to: 'cave', n: 3, seed: 37 },
    { kind: 'magpie', from: 'wood', to: 'shrine', n: 5, seed: 41 },
    { kind: 'magpie', from: 'village', to: 'gate_n', n: 4, seed: 53 },
    { kind: 'carp', from: 'bridge', to: 'river', n: 6, seed: 67 },
    { kind: 'ox', from: 'farm', to: 'farm', n: 2, seed: 79 }
  ];

  /* ── 시각 ─────────────────────────────────────────── */

  var forcedT = null;
  function forceTime(ms) { forcedT = (ms === undefined || ms === null) ? null : ms; return forcedT; }
  function nowMs() { return forcedT !== null ? forcedT : Date.now(); }
  function hourOf(t) {
    var d = new Date(t);
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }
  function isNight(t) { var h = hourOf(t); return h >= 21 || h < 4; }

  /**
   * 두 수를 섞어 0~1 을 낸다 — `npc.js` 의 것과 같은 이유로 여기 따로 둔다.
   * **`core.hash2` 를 쓰면 안 된다**: 격자 좌표(작은 정수)용이라 큰 수를 넣으면
   * 이웃한 입력이 이웃한 답을 준다(주민 둘이 겹쳐 섰던 그 함정이다).
   */
  function mix(a, b) {
    var h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519);
    h ^= h >>> 13; h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** 이 무리의 개체 목록 — 무리 하나가 몇 마리인지는 손잡이로 줄일 수 있다 */
  function membersOf(herd) {
    var n = Math.max(1, Math.round(herd.n * DENS())), out = [], i;
    for (i = 0; i < n; i++) {
      out.push({ herd: herd, i: i, id: herd.kind + ':' + herd.seed + ':' + i, kind: KINDS[herd.kind] });
    }
    return out;
  }

  function all() {
    var out = [], i;
    for (i = 0; i < HERDS.length; i++) { out = out.concat(membersOf(HERDS[i])); }
    return out;
  }

  /**
   * 무리 한가운데는 지금 어디 있나 — 하루에 한 번 두 자리를 오간다.
   * 무리마다 출발 시각을 어긋나게 두어(씨앗) 전부가 같이 움직이지 않는다.
   */
  function herdCenter(herd, t) {
    var L = land();
    var a = L ? L.place(herd.from) : null;
    var b = L ? L.place(herd.to) : null;
    if (!a) { return null; }
    if (!b) { b = a; }
    var off = mix(herd.seed, 3) * 24;
    var k = (1 - Math.cos((hourOf(t) + off) / 24 * Math.PI * 2)) / 2;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, k: k };
  }

  /**
   * 이 짐승은 **그 시각에** 어디 있나 — 나를 보기 전의 자리다. 순수 함수.
   * 무리 한가운데에서 제 몫만큼 비켜서고, 천천히 제자리를 돈다(풀을 뜯거나 물을 돈다).
   */
  function posAt(m, t) {
    if (!m) { return null; }
    var K = m.kind;
    if (K.only === 'day' && isNight(t)) { return null; }
    var c = herdCenter(m.herd, t);
    if (!c) { return null; }
    var seed = m.herd.seed * 100 + m.i;
    /* 무리 안에서 제 자리 — 새는 넓게 흩어지고 소는 바짝 붙는다 */
    var spread = K.id === 'magpie' ? 16 : (K.id === 'carp' ? 13 : (K.id === 'ox' ? 7 : 11));
    var a0 = mix(seed, 1) * Math.PI * 2;
    var r0 = 3 + mix(seed, 2) * spread;
    /* 제자리 돌기 — 저마다 다른 속도로 아주 느리게 돈다 */
    var spin = t / 1000 * (0.06 + mix(seed, 4) * 0.10) + mix(seed, 5) * 6.28;
    var wob = 2.2 + mix(seed, 6) * 2.4;
    var x = c.x + Math.cos(a0) * r0 + Math.cos(spin) * wob;
    var y = c.y + Math.sin(a0) * r0 + Math.sin(spin) * wob;
    return { x: x, y: y, spin: spin, wob: wob, base: true };
  }

  /**
   * 나를 보면 어떻게 하나 — **바탕 자리와 내 자리**만 보고 정한다(순수 함수).
   * 돌려주는 것 `{x, y, lift, alarm, moving, ang}`
   *
   *   flee   가까울수록 세게 밀린다. 알아챈 거리 밖으로는 안 나간다
   *   chase  가까울수록 세게 당겨진다. 다만 **코앞까지는 안 온다**(6m 를 남긴다)
   *   fly    옆으로 밀리면서 **뜬다**. 3D 에서는 높이가, 2D 에서는 그림자가 준다
   */
  function react(m, base, ppos, t) {
    var K = m.kind;
    var out = { x: base.x, y: base.y, lift: K.sink || 0, alarm: 0, moving: false, ang: 0 };
    if (!K.act || !ppos) { return out; }
    var dx = base.x - ppos.x, dy = base.y - ppos.y;
    var d = Math.hypot(dx, dy);
    var sense = (K.act === 'chase' && isNight(t) && K.senseNight) ? K.senseNight : K.sense;
    if (d >= sense || d < 0.001) { return out; }

    var k = 1 - d / sense;                 // 0(가장자리) ~ 1(코앞)
    out.alarm = k;
    out.moving = true;
    var ux = dx / d, uy = dy / d;          // 나에게서 짐승 쪽

    if (K.act === 'chase') {
      /* 다가온다. 6m 는 남긴다 — 겹쳐 서면 무섭기는커녕 우스워진다 */
      var pull = Math.min(K.move * k, Math.max(0, d - 6));
      out.x = base.x - ux * pull;
      out.y = base.y - uy * pull;
      out.ang = Math.atan2(-ux, -uy);
    } else {
      var push = K.move * k;
      out.x = base.x + ux * push;
      out.y = base.y + uy * push;
      out.ang = Math.atan2(ux, uy);
      if (K.act === 'fly') { out.lift = (K.lift || 0) * k; }
      /* 물속 짐승은 놀라면 **수면을 튄다** — 잠긴 채 흩어지기만 하면 물 위에서는
         아무 일도 안 일어난 것으로 보인다(눈으로 보고 알았다) */
      if (K.leap) { out.lift = K.sink + k * K.leap; }
    }
    return out;
  }

  /* ── LOD ──────────────────────────────────────────────
   * 주민(`npc.js`)이 쓰는 그 표를 그대로 쓴다 — 선이 둘이면 하나는 반드시 낡는다.
   */
  function lod(dist) {
    var N = global.DG.npc;
    if (N && N.lod) { return N.lod(dist); }
    return { max: Infinity, ms: 0, tag: 'high' };
  }

  var cache = {};

  /**
   * 지금 화면에 세울 짐승들. LOD 로 다시 재는 주기를 거른다.
   * 돌아오는 것 `{m, kind, x, y, lift, alarm, moving, ang, phase, dist, lod}` 배열
   */
  function live(pos, t) {
    if (!on() || !land() || !land().on()) { return []; }
    t = t === undefined ? nowMs() : t;
    var ms = all(), out = [], i;
    for (i = 0; i < ms.length; i++) {
      var m = ms[i];
      var c = cache[m.id];
      var d0 = c ? Math.hypot(c.r.x - pos.x, c.r.y - pos.y) : 0;
      var band = c ? lod(d0) : { ms: 0 };
      if (band.ms < 0) { continue; }
      if (!c || band.ms === 0 || t - c.t >= band.ms) {
        var base = posAt(m, t);
        if (!base) { delete cache[m.id]; continue; }
        c = cache[m.id] = { t: t, base: base, r: react(m, base, pos, t) };
      }
      var dist = Math.hypot(c.r.x - pos.x, c.r.y - pos.y), Wd = global.DG.world;
      if (lod(dist).ms < 0) { continue; }
      if (m.kind.form === 'fish' && Wd && Wd.terrainAt && Wd.terrainAt(Math.floor(c.r.x / 48), Math.floor(c.r.y / 48)) !== 'water') { continue; }   // W-0152 — 물 칸 아니면 잉어를 안 세운다(3D 공중 물고기)
      out.push({
        m: m, kind: m.kind, x: c.r.x, y: c.r.y, lift: c.r.lift,
        alarm: c.r.alarm, moving: c.r.moving, ang: c.r.ang,
        /* 걸음(날갯짓·지느러미) 위상 — 놀랐을 때 빨라진다 */
        phase: t / 1000 * (2 + c.r.alarm * 6) + m.i,
        dist: dist, lod: lod(dist).tag
      });
    }
    return out;
  }

  /** 그리는 쪽에 넘길 겉모습 — 도감에 없는 짐승이라 제 형태·색을 들고 간다 */
  function refOf(K) {
    return {
      id: 'an_' + K.id, name: K.name, kind: 'beast', rarity: 1,
      form: K.form, color: K.color
    };
  }

  /* ── 한 프레임 ───────────────────────────────────────
   * 짐승은 말을 하지 않는다. 다만 **늑대가 붙으면** 한 번 알린다 —
   * 알림이 없으면 뒤에서 따라붙는 것이 화면 밖에서 벌어져 눈치채지 못한다.
   */
  var lastWarn = 0;

  function tick() {
    if (!on() || global.DG_NO_DRAW) { return; }
    var t = nowMs();
    var pos = core().save.player.pos;
    var gap = core().tuned('animal.warnGapSec', 60) * 1000;
    if (t - lastWarn < gap) { return; }
    var ls = live(pos, t), i, near = 0;
    for (i = 0; i < ls.length; i++) {
      if (ls[i].kind.act === 'chase' && ls[i].dist <= 26) { near++; }
    }
    if (!near) { return; }
    lastWarn = t;
    core().emit('toast', '🐺 늑대 ' + near + '마리가 따라붙었습니다');
  }

  function stats(t) {
    t = t === undefined ? nowMs() : t;
    var pos = core().save.player.pos;
    var ls = live(pos, t), by = {}, i;
    for (i = 0; i < ls.length; i++) { by[ls[i].kind.id] = (by[ls[i].kind.id] || 0) + 1; }
    return { on: on(), herds: HERDS.length, all: all().length, live: ls.length, by: by,
             hour: Math.round(hourOf(t) * 10) / 10, night: isNight(t) };
  }

  global.DG = global.DG || {};
  global.DG.animal = {
    KINDS: KINDS, HERDS: HERDS,
    on: on, all: all, membersOf: membersOf, refOf: refOf,
    /* 값을 내는 함수 — 순수하다(자가진단이 이것만 따로 본다) */
    posAt: posAt, react: react, herdCenter: herdCenter, lod: lod,
    hourOf: hourOf, isNight: isNight, mix: mix,
    /* 화면이 쓰는 것 */
    live: live, tick: tick, stats: stats, forceTime: forceTime,
    reset: function () { cache = {}; lastWarn = 0; }
  };
})(window);
