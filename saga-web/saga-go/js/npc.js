/**
 * 주민 — 이 땅에 사는 열 사람 (3D 전환 PHASE 6)
 * ---------------------------------------------------------------
 * 여태 지도 위에 서 있는 사람은 **잡거나 설득할 대상**뿐이었다(`world.js` 의 스폰).
 * 그래서 마을을 그려 놓아도 빈 마을이었다 — 집은 있는데 사는 사람이 없다.
 * 여기 열 사람을 들인다(`PLAN.md` 47절의 그 열이다).
 *
 * **자리는 시각의 순수 함수다.** 이것이 이 파일의 뼈대다 —
 * 한 걸음씩 쌓아 올리는 시늉(`x += v*dt`)을 하지 않는다. "아침 아홉 시에 촌장은
 * 어디 있나" 를 물으면 **언제 물어도 같은 답**이 나온다. 그래서
 *   · 자가진단이 값으로 붙들 수 있고 (세 번 돌려 한 줄도 안 달라진다)
 *   · 창을 덮어 두었다 열어도 사람이 제자리에 있고
 *   · LOD 로 계산을 걸러도 **그림만 성글어질 뿐 답은 안 바뀐다**
 *
 * LOD (47절이 아니라 15절) — 거리로 가른다. 거르는 것은 **얼마나 자주 다시 재나**
 * 이지 답 자체가 아니다.
 *   0~20m  매 프레임    20~50m  0.25초    50~100m  1.5초    100m~  아예 안 센다
 *
 * **한 줄도 판정에 닿지 않는다.** 주민은 스폰이 아니라서 잡히지도 설득되지도 않고,
 * 세이브에 한 칸도 안 남는다(만난 기록은 PHASE 11 몫이다). 눌러서 여는 창도 아직
 * 없다 — 가까이 가면 **한 마디 건넬 뿐**이다. `world.js` 의 조우 판정에 손대지 않으려는
 * 것이다. 손잡이 `npc.on` 을 0 으로 두면 열 사람이 통째로 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function land() { return global.DG.land; }

  /** 주민을 들일까 — 0 이면 빈 마을로 돌아간다 */
  function on() { return core().tuned('npc.on', 1) ? true : false; }
  /** 말 걸리는 거리(m) — 조우 사거리(46m)보다 훨씬 가깝다. 지나가다 듣는 말이다 */
  function TALK_R() { return core().tuned('npc.talkRadius', 14); }
  /** 같은 사람이 다시 말 걸기까지(초) */
  function TALK_GAP() { return core().tuned('npc.talkGapSec', 45); }
  /** 걷는 빠르기(m/s) — 사람이 걷는 속도다. 이 값으로 구간 시간이 정해진다 */
  /* W-0232 — 2D(평면·2.5D)는 화면 몸 높이/초로(field2d.npcMps, 손잡이 world.npc2dBps 0.6). 1.15m/초는 2D 에서 2.4px/초라 서 있는 것 같았다.
     일과 구간 시간(need)이 짧아져 일찍 닿아 서 있을 뿐 — 같은 시점이면 같은 t 에 같은 답(순수)은 그대로 */
  function WALK() {
    var base = core().tuned('npc.walkMps', 1.15), W = global.DG.world, F2 = global.DG.field2d, b = W && W.body2dM ? W.body2dM() : null;
    return b && F2 && F2.npcMps ? Math.max(base, F2.npcMps(b)) : base;
  }

  /* ── 열 사람 ──────────────────────────────────────────
   * `PLAN.md` 47절이 적어 둔 그대로다. 실제 역사 인물이 아니라 **이 마을 사람**이라,
   * 도감(`data.js`)에 넣지 않았다 — 도감은 잡고 모으는 것이고 이 사람들은 이웃이다.
   *
   *   spots  하루 일과. `from` 시(時)부터 그 자리에 있겠다는 뜻이다.
   *          구간이 바뀌면 앞자리에서 뒷자리로 **걸어간다**(순간이동하지 않는다)
   *   trait  `sprite.lookOf` 가 이것을 보고 갓·도포·무기를 정한다 —
   *          그래서 2D 그림과 3D 입체가 같은 사람으로 보인다
   *   only   'night' 면 밤에만 나타난다
   */
  var PEOPLE = [
    {
      id: 'npc_elder', name: '마을 촌장', role: 'elder', trait: 'virtue', rarity: 3,
      faction: '하북', personality: '느리고 다정하다', color: '#8a7f6a',
      home: 'village',
      spots: [{ from: 6, at: 'village' }, { from: 9, at: 'gate_n' },
              { from: 16, at: 'village' }, { from: 21, at: 'village' }]
    },
    {
      id: 'npc_merchant', name: '떠돌이 상인', role: 'merchant', trait: 'wisdom', rarity: 2,
      faction: '하북', personality: '말이 빠르고 셈이 밝다', color: '#7a6b3f',
      home: 'village',
      spots: [{ from: 7, at: 'gate_s' }, { from: 11, at: 'village' },
              { from: 15, at: 'gate_s' }, { from: 19, at: 'village' }]
    },
    {
      id: 'npc_old', name: '강가의 노인', role: 'old', trait: 'virtue', rarity: 2,
      faction: '하북', personality: '묻는 말에만 답한다', color: '#6e6f74',
      home: 'village',
      spots: [{ from: 5, at: 'bridge' }, { from: 12, at: 'river' },
              { from: 18, at: 'village' }, { from: 22, at: 'village' }]
    },
    {
      id: 'npc_soldier', name: '젊은 병사', role: 'soldier', trait: 'might', rarity: 2,
      faction: '하북', personality: '곧고 뻣뻣하다', color: '#4c5f7a',
      home: 'gate_n',
      spots: [{ from: 6, at: 'gate_n' }, { from: 10, at: 'ridge' },
              { from: 15, at: 'gate_n' }, { from: 20, at: 'gate_s' }]
    },
    {
      id: 'npc_scholar', name: '낙향한 책사', role: 'scholar', trait: 'wisdom', rarity: 4,
      faction: '하북', personality: '에둘러 말한다', color: '#5b5a7a',
      home: 'village',
      spots: [{ from: 8, at: 'shrine' }, { from: 14, at: 'wood' },
              { from: 18, at: 'village' }, { from: 22, at: 'village' }]
    },
    {
      id: 'npc_herb', name: '약초꾼', role: 'herb', trait: 'wisdom', rarity: 2,
      faction: '하북', personality: '땅만 보고 걷는다', color: '#4f6b4a',
      home: 'wood',
      spots: [{ from: 5, at: 'wood' }, { from: 9, at: 'ridge' },
              { from: 14, at: 'wood' }, { from: 19, at: 'village' }]
    },
    {
      id: 'npc_smith', name: '대장장이', role: 'smith', trait: 'might', rarity: 3,
      faction: '하북', personality: '무뚝뚝하고 손이 크다', color: '#6b4a3a',
      home: 'village',
      spots: [{ from: 6, at: 'village' }, { from: 20, at: 'village' }]
    },
    {
      id: 'npc_ronin', name: '떠돌이 무사', role: 'ronin', trait: 'might', rarity: 4,
      faction: '없음', personality: '먼저 말을 걸지 않는다', color: '#5a4a55',
      home: 'river',
      spots: [{ from: 7, at: 'bridge' }, { from: 12, at: 'gate_s' },
              { from: 17, at: 'river' }, { from: 22, at: 'river' }]
    },
    {
      id: 'npc_bandit', name: '도적 두목', role: 'bandit', trait: 'might', rarity: 4,
      faction: '적', personality: '눈을 안 피한다', color: '#6b3a3a',
      home: 'ruin',
      spots: [{ from: 5, at: 'ruin' }, { from: 13, at: 'ruin' },
              { from: 20, at: 'gate_s' }, { from: 23, at: 'ruin' }]
    },
    {
      id: 'npc_stranger', name: '수수께끼의 여행자', role: 'stranger', trait: 'wisdom', rarity: 5,
      faction: '없음', personality: '어디서 왔는지 말하지 않는다', color: '#3f4a5f',
      home: 'cave', only: 'night',
      /* segAt()은 spots가 from 오름차순이라고 가정한다(자정을 넘겨도 마지막
         칸이 "어제부터 이어지는 구간"으로 대접받는다) — 21시부터 시작하는
         구간을 배열 맨 뒤에 둬야 한다. 순서를 21→1→3으로 뒀다가 새벽 시간대
         구간이 뒤집혀 골라지던 것을 고쳤다(2026-09-09) */
      spots: [{ from: 1, at: 'shrine' }, { from: 3, at: 'cave' }, { from: 21, at: 'cave' }]
    }
  ];

  /* ── 시각 ─────────────────────────────────────────────
   * 진단은 **시각에 기대는 축을 붙들어야** 한다(이 저장소의 오랜 규칙이다) —
   * 저녁에 돌렸다고 답이 달라지면 값으로 못 본다.
   */
  var forcedT = null;
  function forceTime(ms) { forcedT = (ms === undefined || ms === null) ? null : ms; return forcedT; }
  function nowMs() { return forcedT !== null ? forcedT : Date.now(); }
  /** 그날 몇 시냐 — 분까지 소수로 (9시 30분 → 9.5) */
  function hourOf(t) {
    var d = new Date(t);
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }
  /** 밤인가 — 여행자가 나타나고 사라지는 선 */
  function isNight(t) { var h = hourOf(t); return h >= 21 || h < 4; }

  /* ── 자리 ─────────────────────────────────────────────
   * 사람마다 늘 서는 자리에서 조금씩 비켜 선다 — 열 사람이 한 점에 겹치면
   * 마을이 아니라 인형 무더기가 된다. 비켜서는 방향은 **이름에서 뽑으므로**
   * 늘 같은 자리다(무작위가 아니다).
   */
  function jitter(id, place) {
    var g = ring(id, place);
    if (g) { return g; }
    var a = mix(hashStr(id), hashStr(place || '')) * Math.PI * 2;
    var r = 6 + mix(hashStr(place || ''), hashStr(id) + 7) * 9;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
  }
  /* W-0377 — 같은 자리를 쓰는 사람(일과·집 어느 쪽이든)이 둘 이상이면 고리 자리를 나눠 갖는다.
     옛 흩음(6~15m 아무 방향)은 비 오는 날 집 자리 village 에 다섯이 모이면 2D 에서 한 덩어리·이름표 겹침이었다.
     자리 순서 = PEOPLE 순서(누가 지금 와 있든 같은 자리) · 이웃 간격 손잡이 npc.ringGap(기본 13m) · 반지름은 자리에서 7~17m(2D 는 몸 높이×1.4 까지) */
  var ringUsers = null;
  function ring(id, place) {
    var gap = +core().tuned('npc.ringGap', 13), W = global.DG.world, b2 = W && W.body2dM ? W.body2dM() : null;   // 2D 면 몸 높이만큼(이름표 폭) — 3D 는 13m
    if (!place || !(gap > 0)) { return null; }
    if (!ringUsers) {
      ringUsers = {};
      PEOPLE.forEach(function (p) {
        var at = [p.home].concat(p.spots.map(function (q) { return q.at; }));
        at.forEach(function (k) { var L = ringUsers[k] || (ringUsers[k] = []); if (L.indexOf(p.id) < 0) { L.push(p.id); } });
      });
    }
    var L = ringUsers[place], i = L ? L.indexOf(id) : -1, n = L ? L.length : 0;
    if (i < 0 || n < 2) { return null; }
    if (b2 > 0) { gap = Math.max(gap, b2 * +core().tuned('npc.ringGap2d', 1)); }
    var r = Math.max(7, Math.min(b2 > 0 ? Math.max(17, b2 * 1.4) : 17, gap / (2 * Math.sin(Math.PI / n))));
    var a = mix(hashStr(place), 3) * Math.PI * 2 + Math.PI * 2 * i / n;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
  }
  function hashStr(s) {
    var n = 0, i;
    for (i = 0; i < s.length; i++) { n = (n * 31 + s.charCodeAt(i)) % 100000; }
    return n;
  }
  /**
   * 두 수를 섞어 0~1 을 낸다.
   *
   * **`core.hash2` 를 쓰면 안 된다.** 그것은 격자 좌표(작은 정수)용이라, 이름에서 뽑은
   * 다섯 자리 수를 넣으면 **이웃한 입력이 이웃한 답을 준다** — 실제로 노인(38665)과
   * 떠돌이 무사(29976)가 0.0823 · 0.0899 를 받아 다리 위 **같은 자리에 겹쳐 섰다**.
   * 여기서는 곱셈 뒤에 자리를 흩는 단계를 넣어 그 일이 안 생기게 한다.
   */
  function mix(a, b) {
    var h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519);
    h ^= h >>> 13; h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** 이 사람의 일과에서 **지금 구간**과 **앞 구간**을 찾는다 */
  function segAt(p, t) {
    var h = hourOf(t), i, cur = -1;
    for (i = 0; i < p.spots.length; i++) {
      if (p.spots[i].from <= h) { cur = i; }
    }
    /* 자정을 넘겨 첫 구간보다 이른 시각이면 **어제 마지막 구간**이 이어진다 */
    if (cur < 0) { cur = p.spots.length - 1; }
    var prev = (cur - 1 + p.spots.length) % p.spots.length;
    /* 구간이 시작한 지 몇 초 됐나 (자정을 넘긴 경우까지) */
    var from = p.spots[cur].from;
    var since = (h - from + 24) % 24 * 3600;
    return { cur: p.spots[cur], prev: p.spots[prev], since: since };
  }

  /** 이름난 자리의 좌표 — 그 땅이 없으면(손잡이를 껐으면) 주민도 설 자리가 없다 */
  function spotXY(id, who) {
    var L = land();
    var sp = L ? L.place(id) : null;
    if (!sp) { return null; }
    var j = jitter(who, id);
    return { x: sp.x + j.dx, y: sp.y + j.dy };
  }

  /**
   * 이 사람은 **그 시각에** 어디 있나 — 순수 함수다. 같은 t 면 늘 같은 답이 나온다.
   * 돌아오는 것 `{x, y, walking, phase, at, from}` (없으면 null)
   *
   * 비가 오면 일과를 접고 집으로 간다(`PLAN.md` 14절 "비가 오면 이동한다").
   * 그 판단도 순수하게 두려고 천후를 인자로 받는다 — 안 주면 지금 천후를 본다.
   */
  function posAt(p, t, wx) {
    if (typeof p === 'string') { p = find(p); }
    if (!p) { return null; }
    if (p.only === 'night' && !isNight(t)) { return null; }

    var seg = segAt(p, t);
    var toId = seg.cur.at, fromId = seg.prev.at;
    var W = global.DG.weather;
    var wkey = wx || (W ? W.current().key : 'clear');
    /* 비·눈이면 집으로. 앞자리는 그대로 두어 **가던 길에서 돌아서는** 그림이 된다 */
    if (wkey === 'rain' || wkey === 'snow') { toId = p.home; }

    var to = spotXY(toId, p.id), from = spotXY(fromId, p.id);
    if (!to) { return null; }
    if (!from) { from = to; }

    var dist = Math.hypot(to.x - from.x, to.y - from.y);
    var need = dist / WALK();                        // 걸어가는 데 드는 초
    var k = need <= 0.001 ? 1 : Math.min(1, seg.since / need);
    var walking = k < 1;
    var x = from.x + (to.x - from.x) * k;
    var y = from.y + (to.y - from.y) * k;
    /* 서 있을 때도 아주 조금 흔들린다 — 굳어 있으면 인형으로 보인다.
       흔들림도 시각의 함수라 다시 물어도 같은 답이다 */
    if (!walking) {
      var sway = Math.sin(t / 2600 + hashStr(p.id)) * 0.5;
      x += sway; y += Math.cos(t / 3100 + hashStr(p.id)) * 0.4;
    }
    return {
      x: x, y: y, walking: walking,
      /* 걸음 위상 — 걸은 거리로 정한다(다리가 속도에 맞게 엇갈린다) */
      phase: (dist * k) / 0.85,
      at: toId, from: fromId, k: k,
      /* 어느 쪽을 보고 있나 — 걸을 때는 가는 쪽, 서 있으면 마지막으로 가던 쪽 */
      ang: Math.atan2(to.x - from.x, to.y - from.y)
    };
  }

  function find(id) {
    for (var i = 0; i < PEOPLE.length; i++) { if (PEOPLE[i].id === id) { return PEOPLE[i]; } }
    return null;
  }
  function list() { return PEOPLE; }

  /* ── LOD (PLAN 15절) ─────────────────────────────────
   * 거르는 것은 **다시 재는 주기**다. 답 자체는 위의 순수 함수가 정하므로,
   * 걸러도 사람이 엉뚱한 데로 가지 않는다 — 그림이 조금 성글어질 뿐이다.
   */
  var BANDS = [
    { max: 20, ms: 0, tag: 'high' },        // 눈앞 — 매 프레임
    { max: 50, ms: 250, tag: 'simple' },
    { max: 100, ms: 1500, tag: 'cheap' },
    { max: Infinity, ms: -1, tag: 'off' }   // 멀다 — 아예 안 센다
  ];
  function lod(dist) {
    for (var i = 0; i < BANDS.length; i++) { if (dist <= BANDS[i].max) { return BANDS[i]; } }
    return BANDS[BANDS.length - 1];
  }

  var cache = {};      // { id: {t, pos, dist, tag} }

  /**
   * 지금 화면에 세울 사람들. LOD 로 다시 재는 주기를 거른다.
   * 돌아오는 것은 `{p, x, y, walking, phase, ang, dist, lod}` 의 배열.
   */
  function live(pos, t) {
    if (!on() || !land() || !land().on()) { return []; }
    t = t === undefined ? nowMs() : t;
    var out = [], i;
    for (i = 0; i < PEOPLE.length; i++) {
      var p = PEOPLE[i];
      var c = cache[p.id];
      /* 거리는 **지난번 자리**로 어림한다 — 자리를 알려고 자리를 재면 LOD 가 무의미하다 */
      var d = c ? Math.hypot(c.pos.x - pos.x, c.pos.y - pos.y) : 0;
      var band = c ? lod(d) : BANDS[0];
      if (band.ms < 0) { continue; }                      // 100m 밖 — 시뮬레이션 정지
      if (!c || band.ms === 0 || t - c.t >= band.ms) {
        var np = posAt(p, t);
        if (!np) { delete cache[p.id]; continue; }
        c = cache[p.id] = { t: t, pos: np, tag: band.tag };
      }
      var dist = Math.hypot(c.pos.x - pos.x, c.pos.y - pos.y);
      if (lod(dist).ms < 0) { continue; }
      out.push({
        p: p, x: c.pos.x, y: c.pos.y, walking: c.pos.walking,
        phase: c.pos.phase, ang: c.pos.ang, at: c.pos.at,
        dist: dist, lod: lod(dist).tag
      });
    }
    return out;
  }

  /* ── 말 ───────────────────────────────────────────────
   * 지나가다 듣는 한 마디다. 역할·시각·천후를 보고 갈린다 — 여기가 나중에
   * **소문**(`PLAN.md` 33절)이 붙을 자리다. 지금은 소문을 만들지 않고,
   * 소문이 붙을 **모양**만 잡아 둔다.
   */
  var LINES = {
    elder: { day: '이 마을에 무슨 일로 오셨소.', night: '밤길은 조심하시오. 강 건너는 특히.',
             rain: '비가 오면 다리가 미끄럽소. 돌아가시오.' },
    merchant: { day: '북쪽 산길은 요즘 값이 오르오. 짐꾼을 못 구해서.',
                night: '오늘 장은 파했소. 내일 남문에서 봅시다.',
                rain: '비 오는 날은 소금이 안 팔리오.' },
    old: { day: '이 강은 예전에 더 넓었소.', night: '늙으면 잠이 없어지오.',
           rain: '물이 불면 고기가 잘 문다오.' },
    soldier: { day: '산등성이까지 돌고 오는 길입니다.', night: '북문은 제가 지킵니다. 지나가십시오.',
               rain: '이런 날에 넘어오는 자가 있습디다.' },
    scholar: { day: '사당의 글자가 반쯤 지워졌더군요. 읽을 수 있겠소?',
               night: '별자리가 작년과 다릅니다.', rain: '비는 글씨를 지웁니다.' },
    herb: { day: '산에 쓸 만한 것이 줄었소.', night: '밤이슬 맞은 것이 약이 되오.',
            rain: '비 온 뒤에 나는 것이 있소.' },
    smith: { day: '쇠가 좋으면 손이 덜 가지.', night: '불은 껐소. 내일 오시오.',
             rain: '습하면 쇠가 상하오.' },
    ronin: { day: '…', night: '가는 길이 같으면 앞서 가시오.', rain: '비를 피할 데를 찾고 있소.' },
    bandit: { day: '여기는 볼 것 없다. 돌아가라.', night: '밤에 남문 근처를 어슬렁대지 마라.',
              rain: '비가 발자국을 지워 주지.' },
    stranger: { day: '…', night: '이 굴은 생각보다 깊소.', rain: '비는 어디서나 같은 소리를 내오.' }
  };

  /** 이 사람이 **지금** 할 말. 순수 함수다 */
  function say(p, t, wx) {
    if (typeof p === 'string') { p = find(p); }
    if (!p) { return null; }
    t = t === undefined ? nowMs() : t;
    var W = global.DG.weather;
    var wkey = wx || (W ? W.current().key : 'clear');
    var set = LINES[p.role] || {};
    if (wkey === 'rain' || wkey === 'snow') { return set.rain || set.day || null; }
    return (isNight(t) ? set.night : set.day) || set.day || null;
  }

  /* ── 한 프레임 ───────────────────────────────────────
   * 가까이 지나가면 한 마디 건넨다. 누르는 창은 아직 없다 — 조우 판정에
   * 손대지 않으려는 것이다(누르는 것은 PHASE 8 이 사건과 함께 들고 온다).
   */
  var lastSaid = {};

  function tick() {
    if (!on() || global.DG_NO_DRAW) { return; }
    var t = nowMs();
    var pos = core().save.player.pos;
    var ns = live(pos, t), i;
    var r = TALK_R(), gap = TALK_GAP() * 1000;
    for (i = 0; i < ns.length; i++) {
      var n = ns[i];
      if (n.dist > r) { continue; }
      if (lastSaid[n.p.id] && t - lastSaid[n.p.id] < gap) { continue; }
      var line = say(n.p, t);
      if (!line) { continue; }
      lastSaid[n.p.id] = t;
      core().emit('toast', '💬 ' + n.p.name + ' — ' + line);
    }
  }

  /** 눈으로 확인할 때 */
  function stats(t) {
    t = t === undefined ? nowMs() : t;
    var pos = core().save.player.pos;
    var ns = live(pos, t);
    var byLod = {};
    for (var i = 0; i < ns.length; i++) { byLod[ns[i].lod] = (byLod[ns[i].lod] || 0) + 1; }
    return {
      on: on(), all: PEOPLE.length, live: ns.length, lod: byLod,
      hour: Math.round(hourOf(t) * 10) / 10, night: isNight(t)
    };
  }

  global.DG = global.DG || {};
  global.DG.npc = {
    PEOPLE: PEOPLE, LINES: LINES, BANDS: BANDS,
    on: on, list: list, find: find,
    /* 값을 내는 함수 — 순수하다(자가진단이 이것만 따로 본다) */
    posAt: posAt, say: say, lod: lod, segAt: segAt, hourOf: hourOf, isNight: isNight,
    mix: mix, jitter: jitter,
    /* 화면이 쓰는 것 */
    live: live, tick: tick, stats: stats,
    forceTime: forceTime,
    /** 말한 기억을 지운다 (진단이 제 뒤를 치울 때) */
    reset: function () { cache = {}; lastSaid = {}; }
  };
})(window);
