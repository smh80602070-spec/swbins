/**
 * 땅 사람 — 세 시대가 한 탑 둘레에 (PLAN §5 ⑱ · SAGA-DESIGN §13 "전체 퓨전")
 * ---------------------------------------------------------------
 * 땅 열여섯(`biome.js` ZONES)은 이름·소품은 세 시대가 섞였는데 **사람**은 고향 주민 열(`npc.js`)과
 * 도감 인물뿐이었다 — 폐도시에도 설산에도 갓 쓴 사람만 걸었다. 여기서 칸(1.2km)마다 탑 둘레에
 * 셋을 세운다: **제 시대 하나 + 나머지 두 시대 하나씩.** 그래서 어느 탑에 닿아도 과거·현대·미래
 * 사람이 한 자리에 선다(신화 땅은 과거 몫 — 무녀·나무꾼이 선다).
 *
 * 뼈대는 `npc.js` 그대로 — **자리는 칸 좌표와 시각의 순수 함수**다. 세이브 0, 잡히지도
 * 설득되지도 않고, 가까이 가면 한 마디 건넬 뿐이다. 몸은 `asset3d` 의 `hero:era:folk_*`
 * (Quaternius CC0 — 정장·작업복·특공대·우주복 등). 이름은 전부 역할 이름(실명 없음).
 * 손잡이 `folk.on` 을 0 으로 두면 통째로 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function BM() { return global.DG.biome; }
  function K(key, def) { return core().tuned('folk.' + key, def); }
  function on() { return !!(K('on', 1) && BM() && BM().on()); }
  function VIEW_R() { return K('viewR', 110); }     // 이 안의 탑만 사람을 세운다
  function TALK_R() { return K('talkR', 12); }
  function TALK_GAP() { return K('talkGapSec', 45); }
  var RING = 24;                                   // 탑에서 떨어진 거리(m) — biome LM_CLEAR 34 안, 수호자(16,10≈19m)와 비킨다
  var GUARD_ANG = Math.atan2(10, 16);              // field-combat GUARD_OFF 쪽
  var PACE = 4.5, CYCLE = 36;                      // 두 자리 사이 4.5m 를 36초 한 바퀴로 오간다

  var ERAS3 = ['past', 'modern', 'future'];
  /* 시대마다 역할 넷 — 말에 {zone}(땅 이름)·{place}(칸 이름)가 들어간다 */
  var ROLES = {
    past: [
      { role: 'woodcutter', name: '나무꾼', trait: 'might', color: '#7a5a3a',
        lines: ['{place}엔 도끼 소리보다 쇳소리가 커졌소.', '저 탑은 내 할아비 적부터 {zone:을} 지켰다오.'] },
      { role: 'shaman', name: '떠돌이 무녀', trait: 'wisdom', color: '#8a3f4f',
        lines: ['시간이 겹친 땅이오. 하늘에 쇠새가 나는 걸 보시오.', '{zone}의 넋이 오늘은 조용하구려.'] },
      { role: 'watchman', name: '늙은 파수꾼', trait: 'virtue', color: '#5a5f6a',
        lines: ['{place} 너머에 무리가 섰소. 조심해 가시오.', '봉화를 올릴 일은 없어야 할 텐데.'] },
      { role: 'herbalist', name: '약초꾼', trait: 'virtue', color: '#5d7a3f',
        lines: ['{zone} 풀은 약이 되오. 요즘 것들 약보다 낫소.', '저 번쩍이는 기둥 곁엔 풀이 안 나더이다.'] }
    ],
    modern: [
      { role: 'tourist', name: '사진 찍는 여행자', trait: 'wisdom', color: '#3f6f9a',
        lines: ['{zone} 탑 사진 한 장만요! 빛이 좋네요.', '여기 {place:는} 신호가 한 칸도 안 잡혀요.'] },
      { role: 'lineman', name: '전기 수리공', trait: 'might', color: '#c48a2a',
        lines: ['전봇대 전선이 또 끊겼어요. 옛 병사가 창으로 건드렸대요.', '{place}까지 선을 끌어야 하는데 짐승이 많네요.'] },
      { role: 'courier', name: '택배 기사', trait: 'virtue', color: '#9a4a2f',
        lines: ['{zone} 주소가 지도에 없어서 세 바퀴째예요.', '받는 분이 갑옷 입은 분이던데… 서명은 붓으로 하시더라고요.'] },
      { role: 'patrol', name: '순찰 대원', trait: 'might', color: '#3f4f6a',
        lines: ['{place} 쪽은 오늘 통제 구역입니다.', '떠도는 망자가 나오면 뛰지 말고 비켜 서세요.'] }
    ],
    future: [
      { role: 'surveyor', name: '궤도 측량사', trait: 'wisdom', color: '#4fa3b8',
        lines: ['{place} 좌표 기록 완료. 옛 탑 재질은 분석 불가.', '이 시대 햇빛은 약하군요. 충전이 더뎌요.'] },
      { role: 'explorer', name: '탐사 대원', trait: 'might', color: '#d8d8e0',
        lines: ['{zone}에 과거 신호가 겹쳐 잡힙니다. 흥미롭네요.', '정찰 드론이 길을 잃었어요. 보면 알려 주세요.'] },
      { role: 'traveler', name: '시간 여행자', trait: 'virtue', color: '#8a6fc8',
        lines: ['제가 온 해에는 {zone:이} 바다였어요.', '저 갓 쓴 분께 내일 날씨를 알려 드렸더니 놀라시더군요.'] },
      { role: 'mechanic', name: '수리 기사', trait: 'virtue', color: '#b8b04f',
        lines: ['강철 거신이 또 멋대로 돌아다녀요. 제 탓 아니에요.', '{place} 충전탑은 제가 고쳤습니다.'] }
    ]
  };

  function h3(a, b, s) {
    var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function eraOrder(zone) {
    var main = !zone || zone.era === 'myth' ? 'past' : zone.era;
    return [main].concat(ERAS3.filter(function (e) { return e !== main; }));
  }

  var cellMemo = {}, memoN = 0;
  /** 칸 하나의 세 사람 — 순수 함수(같은 칸은 늘 같은 셋). 고향 칸이면 [] */
  function folkOf(cell) {
    if (!cell || cell.biome === 'home') { return []; }
    if (cellMemo[cell.key]) { return cellMemo[cell.key]; }
    var zone = BM().zoneByKey(cell.zone), eras = eraOrder(zone), out = [], s;
    var a0 = h3(cell.i, cell.j, 51) * Math.PI * 2;
    for (s = 0; s < 3; s++) {
      var pool = ROLES[eras[s]], R = pool[Math.floor(h3(cell.i, cell.j, 53 + s) * pool.length) % pool.length];
      var a = a0 + s * 2.094;
      /* 수호자 자리(탑에서 +16,+10)와 겹치면 반 바퀴쯤 비킨다 */
      var da = Math.atan2(Math.sin(a - GUARD_ANG), Math.cos(a - GUARD_ANG));
      if (Math.abs(da) < 0.55) { a += da >= 0 ? 0.9 : -0.9; }
      out.push({
        id: 'folk_' + cell.key + '_' + s, name: R.name, role: R.role, trait: R.trait, color: R.color,
        rarity: 2, era: 'folk_' + eras[s], age: eras[s], lines: R.lines,
        cell: cell.key, zone: zone ? zone.name : '', place: cell.name,
        x: cell.x + Math.cos(a) * RING, y: cell.y + Math.sin(a) * RING, ang: a,
        off: h3(cell.i, cell.j, 61 + s) * CYCLE
      });
    }
    if (memoN > 400) { cellMemo = {}; memoN = 0; }
    cellMemo[cell.key] = out; memoN++;
    return out;
  }

  /**
   * 이 사람이 t(ms)에 어디 있나 — 두 자리(제자리·탑 둘레로 4.5m 옆) 사이를 오간다.
   * 서 있기 14초 → 걸어가기 4초 → 서 있기 14초 → 돌아오기 4초. 순수 함수
   */
  function posAt(p, t) {
    var u = ((t / 1000 + p.off) % CYCLE + CYCLE) % CYCLE;
    var tx = -Math.sin(p.ang), ty = Math.cos(p.ang);       // 탑 둘레를 도는 방향
    var k, walking = false;
    if (u < 14) { k = 0; }
    else if (u < 18) { k = (u - 14) / 4; walking = true; }
    else if (u < 32) { k = 1; }
    else { k = 1 - (u - 32) / 4; walking = true; }
    var e = k * k * (3 - 2 * k);
    var dir = u < 18 ? 1 : -1;
    return {
      x: p.x + tx * PACE * e, y: p.y + ty * PACE * e, walking: walking,
      phase: walking ? u * 7.5 : 0,
      ang: walking ? Math.atan2(ty * dir, tx * dir) : p.ang + Math.PI     // 서 있을 땐 탑을 본다
    };
  }

  /** 지금 화면에 세울 땅 사람 — `{p, x, y, walking, phase, ang, dist}` (npc.live 와 같은 모양) */
  function live(pos, t) {
    if (!on() || !pos) { return []; }
    t = t === undefined ? Date.now() : t;
    var R = VIEW_R(), lms = BM().landmarks(pos.x, pos.y, R + RING + PACE), out = [], i, j;
    for (i = 0; i < lms.length; i++) {
      var c = BM().cellAt.apply(null, lms[i].key.split('_').map(Number)), ps = folkOf(c);
      for (j = 0; j < ps.length; j++) {
        var q = posAt(ps[j], t), d = Math.hypot(q.x - pos.x, q.y - pos.y);
        if (d > R) { continue; }
        out.push({ p: ps[j], x: q.x, y: q.y, walking: q.walking, phase: q.phase, ang: q.ang, dist: d });
      }
    }
    var F2 = global.DG.field2d, n = +K('max2d', 3);   // W-0500 2D 는 가까운 순 상한(손잡이 folk.max2d, 음수 = 옛)
    if (n >= 0 && F2 && F2.on && F2.on() && !(global.DG.world3d && global.DG.world3d.active && global.DG.world3d.active()) && out.length > n) { out = out.sort(function (a, b) { return a.dist - b.dist; }).slice(0, n); }
    return out;
  }

  /** 받침 보고 조사 고르기 — '을'·'이'·'은'·'는'·'를'·'가' 어느 쪽을 적어도 맞게 바꾼다 */
  var JOSA = { '을': ['을', '를'], '를': ['을', '를'], '이': ['이', '가'], '가': ['이', '가'], '은': ['은', '는'], '는': ['은', '는'] };
  function josa(word, j) {
    var pair = JOSA[j];
    if (!pair) { return word + (j || ''); }
    var c = word.charCodeAt(word.length - 1), jong = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
    return word + (jong ? pair[0] : pair[1]);
  }
  function fill(line, p) {
    return line.replace(/\{(zone|place)(?::([^}]+))?\}/g, function (m, k, j) { return josa(k === 'zone' ? p.zone : p.place, j); });
  }

  /** 할 말 — 시각(두 시간마다)으로 둘 중 하나. 순수 함수 */
  function say(p, t) {
    t = t === undefined ? Date.now() : t;
    var k = Math.floor(t / 7200000) % p.lines.length;
    return fill(p.lines[(k + Math.floor(p.off)) % p.lines.length], p);
  }

  var lastSaid = {};
  function tick() {
    if (!on() || global.DG_NO_DRAW) { return; }
    var t = Date.now(), ns = live(core().save.player.pos, t), r = TALK_R(), gap = TALK_GAP() * 1000, i;
    for (i = 0; i < ns.length; i++) {
      var n = ns[i];
      if (n.dist > r || (lastSaid[n.p.id] && t - lastSaid[n.p.id] < gap)) { continue; }
      lastSaid[n.p.id] = t;
      core().emit('toast', '💬 ' + n.p.name + ' — ' + say(n.p, t));
    }
  }

  global.DG = global.DG || {};
  global.DG.folk = {
    ROLES: ROLES, ERAS3: ERAS3, RING: RING,
    on: on, folkOf: folkOf, posAt: posAt, say: say, eraOrder: eraOrder, josa: josa,
    live: live, tick: tick,
    reset: function () { cellMemo = {}; memoN = 0; lastSaid = {}; }
  };
})(window);
