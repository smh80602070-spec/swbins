/**
 * 사가국지 — 관계·사건 체인 (PLAN §5-2)
 * ---------------------------------------------------------------
 * 달마다 인물 사이의 관계(`data-relation.js` — 의형제·원수·사제·호적수)나 자리(태수·노장·포로·재야)가
 * 사연을 만든다. 사연은 카드 하나에 **세 갈래(공세·신중·수단)** 선택지를 내고, 고른 결과가 다음 사연을
 * 3~6달 뒤로 예약한다(체인 2~3단).
 *
 * 규칙(PLAN §2 와 §5 공통):
 *  - **판정을 두 벌 두지 않는다.** 사건은 새 전투·계략 판정을 만들지 않고, 충성·금·경험·등용(`placeAt`)·
 *    승진(`off.promote`)·우호(`diplo.addRelation`) 같은 **이미 있는 손잡이만** 만진다.
 *  - **AI 도 같은 함수**(`resolve`)를 부른다. 다른 것은 고르는 사람뿐 — AI 는 군주의 특성으로 갈래를 고른다(`autoPick`).
 *  - **결정적이다.** 굴림은 `Math.random` 이 아니라 (씨앗·세력·달·소금) 해시라서 진단 씨앗 순번을 안 미룬다.
 *  - 세이브는 `save.rtk.events = { active:[{id,step,due,force,a,b,city}], done:{id:n}, pending, cool, seen }`,
 *    관계 변화는 `save.rtk.rel[key] = -3..3`(표가 정한 결 위의 **화해도**). 없으면 빈 객체 — 옛 세이브가 그대로 열린다.
 *    (`save.rtk.relations` 는 세력 사이의 우호(diplo)라 다른 칸이다.)
 *  - 카드는 고를 때까지 안 닫힌다 — 고르지 않고 창을 닫아도 `pending` 이 세이브에 남아 다시 뜬다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var FD = global.DG.forceData;
  var REL = global.DG.relData;

  var CHANCE = 0.18;       // 손잡이 rtk.eventChance — 달마다 세력마다
  var MAX_ACTIVE = 2;      // 세력당 동시 체인
  var COOL = 8;            // 같은 사연이 같은 세력에 또 뜨기까지(달)
  var MAX_STEP = 3;

  function R() { return global.DG.rtk; }
  function OFF() { return global.DG.off; }
  function nm(id) { var h = OFF().find(id); return h ? h.name : id; }
  function fname(F) { return R().forceName(F); }

  function hashOf(s) {
    var h = 0, i;
    s = String(s);
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return h;
  }

  /* ── 세이브 칸 ────────────────────────────────────────── */

  function S() {
    var st = R().state();
    if (!st.events) { st.events = { active: [], done: {}, pending: null, cool: {}, seen: {} }; }
    var e = st.events;
    if (!e.active) { e.active = []; }
    if (!e.done) { e.done = {}; }
    if (!e.cool) { e.cool = {}; }
    if (!e.seen) { e.seen = {}; }
    if (e.pending === undefined) { e.pending = null; }
    if (!st.rel) { st.rel = {}; }
    return st;
  }

  /** 결정적 굴림 0~1 — 씨앗·세력·달·소금 */
  function roll(F, salt) {
    var st = S();
    return (hashOf((st.seed || 0) + '|' + F + '|' + st.turn + '|' + salt) % 10000) / 10000;
  }

  function chance() { return core.tuned('rtk.eventChance', CHANCE); }

  /* ── 관계 ─────────────────────────────────────────────── */

  function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  /** 이 두 사람의 화해도(-3~3) */
  function relLv(a, b) { var v = S().rel[key(a, b)]; return v === undefined ? 0 : v; }

  /** 이 두 사람의 결(표에 없으면 null) */
  function kindOf(a, b) {
    var list = REL.all(), i;
    for (i = 0; i < list.length; i++) {
      if ((list[i].a === a && list[i].b === b) || (list[i].a === b && list[i].b === a)) { return list[i].kind; }
    }
    return null;
  }

  /** 이 사람과 얽힌 짝들 — [{other, kind, role}] (role: master 표에서 스승이면 'master', 제자면 'pupil') */
  function pairsOf(id) {
    var list = REL.all(), out = [], i;
    for (i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.a === id) { out.push({ other: p.b, kind: p.kind, role: p.kind === 'master' ? 'master' : null }); }
      else if (p.b === id) { out.push({ other: p.a, kind: p.kind, role: p.kind === 'master' ? 'pupil' : null }); }
    }
    return out;
  }

  /** 화해도를 움직인다. 원수가 2 에 닿으면 앙금이 풀려 둘 다 충성이 오른다 */
  function relAdd(a, b, n) {
    var st = S(), k = key(a, b), was = relLv(a, b);
    var v = core.clamp(was + n, -3, 3);
    st.rel[k] = v;
    if (kindOf(a, b) === 'foe' && was < 2 && v >= 2) {
      OFF().addLoyal(a, 5); OFF().addLoyal(b, 5);
      var me = st.me, ra = OFF().rec(a);
      if (ra.force === me) { core.log('🕊️ ' + nm(a) + ' 과(와) ' + nm(b) + ' 이(가) 오랜 앙금을 풀었다', 'good'); }
    }
    return v;
  }

  /* ── 손잡이 ───────────────────────────────────────────── */

  function isLive(id) {
    if (!OFF().has(id)) { return false; }
    var r = OFF().rec(id);
    return !r.dead && !r.camp && !r.journey;
  }
  function mineOf(id, F) { return isLive(id) && OFF().rec(id).force === F; }
  function isFree(id) {
    if (!isLive(id)) { return false; }
    var r = OFF().rec(id);
    return !r.force && !R().state().captives[id];
  }
  function cityOfId(id) { return OFF().rec(id).city; }
  function loyal(id, n) { OFF().addLoyal(id, n); }
  function exp(id, n) { OFF().gainExp(id, n); }
  function gold(F, n) { var f = R().force(F); if (f) { f.gold = Math.max(0, f.gold + n); } }
  function goldOf(F) { var f = R().force(F); return f ? f.gold : 0; }
  function cityRec(id) { return id ? R().city(id) : null; }
  function adjust(id, field, n, lo, hi) {
    var c = cityRec(id);
    if (c) { c[field] = core.clamp(Math.round(c[field] + n), lo, hi); }
  }
  function isLord(id, F) { return !!FD.force(F) && OFF().lordOf(F) === id; }

  /** 재야·포로를 F 의 성에 들인다 — `tryHire` 의 성공 쪽과 같은 자리(`placeAt`·`baseLoyal`) */
  function hire(id, cityId, F, bonus) {
    var st = R().state();
    delete st.captives[id];
    var r = OFF().placeAt(id, cityId, F);
    r.camp = null; r.journey = null;
    r.loyal = core.clamp(OFF().baseLoyal(id, F) + (bonus || 0), 0, 100);
    r.found = true;
    r.done = true;                                  // 들어온 달에는 일하지 않는다
    if (F === st.me) {
      core.log('🤝 ' + nm(id) + ' 이(가) ' + fname(F) + ' 에 합류했다!', 'good');
      core.emit('toast', '🤝 ' + nm(id) + ' 합류!');
    }
    return r;
  }

  /** 그 성에서 지력이 가장 높은 우리 사람 */
  function wisest(cityId, F) {
    var list = OFF().atCity(cityId, F), best = null, i;
    for (i = 0; i < list.length; i++) {
      if (!best || OFF().stats(list[i].id).wisdom > OFF().stats(best.id).wisdom) { best = list[i]; }
    }
    return best;
  }

  /** 짝을 찾는다 — fn(x, y, pair) 가 참인 (x,y) 를 ctx 로 모은다 (짝의 양쪽 방향 다 본다) */
  function scanPairs(kind, fn) {
    var list = REL.all(), out = [], i, ctx;
    for (i = 0; i < list.length; i++) {
      if (list[i].kind !== kind) { continue; }
      ctx = fn(list[i].a, list[i].b, list[i]);
      if (ctx) { out.push(ctx); }
      if (kind !== 'master') {
        ctx = fn(list[i].b, list[i].a, list[i]);
        if (ctx) { out.push(ctx); }
      }
    }
    return out;
  }

  function pickOf(list, F, salt) {
    if (!list.length) { return null; }
    return list[hashOf((R().state().seed || 0) + '|' + F + '|' + R().state().turn + '|' + salt) % list.length];
  }

  /** 우리 사람 중에서 fn 이 ctx 를 돌려주는 이들 */
  function scanMine(F, fn) {
    var st = R().state(), out = [], k, ctx;
    for (k in st.officers) {
      if (!Object.prototype.hasOwnProperty.call(st.officers, k)) { continue; }
      if (!mineOf(k, F)) { continue; }
      ctx = fn(k);
      if (ctx) { out.push(ctx); }
    }
    return out;
  }

  /* ── 사연 표 ──────────────────────────────────────────
   * 한 사연 = { id, name, emoji, chain?, once?, find(F)→ctx|null, valid(ctx,F)→ctx|null(체인 재개),
   *            text(ctx,step), choices:[{k:'atk'|'def'|'util', label, hint, cost?, ok?(ctx,F), go(ctx,F,step)→{text,next?}}] }
   * ctx = { a, b, city }(문자열 id 만 — 세이브에 그대로 남는다). 갈래마다 하나씩, 그 사연을 **다르게 푸는** 셋이다.
   * `def` 갈래는 값이 안 드는 안전한 수여야 한다(AI·금 없는 판에서도 늘 하나는 고를 수 있게).
   */
  var DEFS = {};
  var ORDER = [];
  function add(d) { DEFS[d.id] = d; if (!d.chain) { ORDER.push(d.id); } }
  /* 시나리오(scenario.js) — 밖에서 사연 정의를 더하고, 사람 세력에게 정해진 때에 카드를 내는 "원천"을 단다 */
  var SOURCES = [];
  function addSource(fn) { SOURCES.push(fn); }
  function fromSources(F) {
    for (var i = 0; i < SOURCES.length; i++) { var f = SOURCES[i](F); if (f) { return f; } }
    return null;
  }

  /* 1. 의형제 합류 청원 */
  add({
    id: 'sworn_join', name: '의형제 합류 청원', emoji: '🤝',
    find: function (F) {
      return pickOf(scanPairs('sworn', function (x, y) {
        return mineOf(x, F) && isFree(y) ? { a: x, b: y, city: cityOfId(x) } : null;
      }), F, 'sj');
    },
    valid: function (c, F) { return mineOf(c.a, F) && isFree(c.b) ? { a: c.a, b: c.b, city: cityOfId(c.a) } : null; },
    text: function (c, step) {
      return nm(c.b) + ' 이(가) 의형제 ' + nm(c.a) + ' 의 곁으로 오겠다며 ' + (step > 1 ? '다시 ' : '') + '연통을 보냈다. 어떻게 맞이할까.';
    },
    choices: [
      { k: 'atk', label: '직접 나가 모신다', hint: '금 300 · 합류 확실 · 충성 두둑', cost: 300,
        go: function (c, F) { hire(c.b, c.city, F, 15); loyal(c.a, 5); return { text: nm(c.b) + ' 이(가) 감격해 합류했다' }; } },
      { k: 'def', label: '예를 갖춰 기다린다', hint: '값은 없다 · 55% 로 합류 · 안 되면 다시 청한다',
        go: function (c, F, step) {
          if (roll(F, 'sj:' + step) < 0.55) { hire(c.b, c.city, F, 0); return { text: nm(c.b) + ' 이(가) 제 발로 찾아와 합류했다' }; }
          return { text: nm(c.b) + ' 은(는) 뜻을 굳히지 못하고 물러갔다', next: ['sworn_join', 3] };
        } },
      { k: 'util', label: '형제에게 설득을 맡긴다', hint: '이 달 그 사람의 명령을 쓴 것으로 · 85% 합류',
        go: function (c, F, step) {
          OFF().rec(c.a).done = true;
          if (roll(F, 'sju:' + step) < 0.85) { hire(c.b, c.city, F, 5); return { text: nm(c.a) + ' 의 설득이 통해 ' + nm(c.b) + ' 이(가) 합류했다' }; }
          return { text: nm(c.b) + ' 은(는) 끝내 고개를 젓고 돌아갔다' };
        } }
    ]
  });

  /* 2. 원수와 같은 성 배치 갈등 → 4. 화해 자리 */
  add({
    id: 'foe_clash', name: '원수와 한 성', emoji: '🗡️',
    find: function (F) {
      return pickOf(scanPairs('foe', function (x, y) {
        if (x > y) { return null; }
        if (!mineOf(x, F) || !mineOf(y, F)) { return null; }
        if (cityOfId(x) !== cityOfId(y) || relLv(x, y) >= 2) { return null; }
        return { a: x, b: y, city: cityOfId(x) };
      }), F, 'fc');
    },
    text: function (c) { return nm(c.a) + ' 과(와) ' + nm(c.b) + ' 은(는) 오래된 원수다. 같은 성에 앉히니 말끝마다 날이 선다.'; },
    choices: [
      { k: 'atk', label: '엄히 다스린다', hint: '충성이 낮은 쪽 -12 · 다른 쪽 +4 · 앙금은 깊어진다',
        go: function (c) {
          var lo = OFF().loyalOf(c.a) <= OFF().loyalOf(c.b) ? c.a : c.b, hi = lo === c.a ? c.b : c.a;
          loyal(lo, -12); loyal(hi, 4); relAdd(c.a, c.b, -1);
          return { text: nm(lo) + ' 이(가) 크게 꾸짖음을 당했다' };
        } },
      { k: 'def', label: '한 사람을 딴 성으로 보낸다', hint: '값은 없다 · 둘 다 충성 -2',
        go: function (c, F) {
          var mine = R().citiesOf(F).filter(function (x) { return x !== c.city; }), lo = OFF().power(c.a) <= OFF().power(c.b) ? c.a : c.b;
          if (mine.length) { OFF().placeAt(lo, mine[hashOf(c.a + c.b) % mine.length], F); }
          loyal(c.a, -2); loyal(c.b, -2);
          return { text: mine.length ? nm(lo) + ' 을(를) 다른 성으로 옮겨 갈라놓았다' : '보낼 성이 없어 그저 갈라 앉혔다' };
        } },
      { k: 'util', label: '술자리를 마련한다', hint: '금 400 · 둘 다 충성 +6 · 화해도 +1 · 뒤에 화해 자리', cost: 400,
        go: function (c) { loyal(c.a, 6); loyal(c.b, 6); relAdd(c.a, c.b, 1); return { text: '술잔이 오가자 두 사람의 어깨가 조금 풀렸다', next: ['foe_truce', 4] }; } }
    ]
  });
  add({
    id: 'foe_truce', name: '화해의 자리', emoji: '🕊️', chain: true,
    valid: function (c, F) { return mineOf(c.a, F) && mineOf(c.b, F) && relLv(c.a, c.b) < 2 ? c : null; },
    text: function (c) { return '술자리 뒤로 ' + nm(c.a) + ' 과(와) ' + nm(c.b) + ' 의 사이가 조금 달라졌다. 이 틈에 매듭을 지을까.'; },
    choices: [
      { k: 'atk', label: '맹세를 시킨다', hint: '절반은 통하고 절반은 틀어진다',
        go: function (c, F, step) {
          if (roll(F, 'ft:' + step) < 0.5) { loyal(c.a, 4); loyal(c.b, 4); relAdd(c.a, c.b, 1); return { text: '두 사람이 손을 맞잡고 맹세했다' }; }
          loyal(c.a, -8); loyal(c.b, -8); relAdd(c.a, c.b, -1); return { text: '억지 맹세가 되레 감정을 건드렸다' };
        } },
      { k: 'def', label: '그냥 둔다', hint: '값은 없다 · 달라지는 것 없다',
        go: function () { return { text: '더 손대지 않기로 했다' }; } },
      { k: 'util', label: '함께 출진하게 한다', hint: '둘 다 경험 +30 · 이 달 명령을 쓴 것으로 · 화해도 +1',
        go: function (c) {
          exp(c.a, 30); exp(c.b, 30);
          OFF().rec(c.a).done = true; OFF().rec(c.b).done = true; relAdd(c.a, c.b, 1);
          return { text: '등을 맞대고 싸우며 두 사람이 서로를 알아 갔다' };
        } }
    ]
  });

  /* 3. 사제 승진 추천 */
  add({
    id: 'master_promote', name: '스승의 추천', emoji: '📖',
    find: function (F) {
      return pickOf(scanPairs('master', function (x, y) {
        if (!mineOf(x, F) || !mineOf(y, F)) { return null; }
        var g = OFF().grow(y);
        return g.rank < 3 && g.rank <= OFF().grow(x).rank ? { a: x, b: y, city: cityOfId(y) } : null;
      }), F, 'mp');
    },
    valid: function (c, F) { return mineOf(c.a, F) && mineOf(c.b, F) ? c : null; },
    text: function (c) { return '스승 ' + nm(c.a) + ' 이(가) 제자 ' + nm(c.b) + ' 의 승진을 청한다. 공을 세울 만큼 세웠다고 한다.'; },
    choices: [
      { k: 'atk', label: '바로 승진시킨다', hint: '공·금을 쓴다 · 스승 충성 +6',
        ok: function (c) { return OFF().promoteCheck(c.b).ok; },
        go: function (c) { var r = OFF().promote(c.b); loyal(c.a, 6); return { text: nm(c.b) + ' 이(가) ' + (r.name || '') + ' 에 올랐다' }; } },
      { k: 'def', label: '때를 기다리라 이른다', hint: '값은 없다 · 스승 충성 -3 · 제자 공 +10 · 훗날 다시 청한다',
        go: function (c, F, step) {
          loyal(c.a, -3); OFF().rec(c.b).feats += 10;
          return { text: '스승은 고개를 끄덕이면서도 서운한 기색이었다', next: step < MAX_STEP ? ['master_promote', 5] : null };
        } },
      { k: 'util', label: '스승이 직접 가르치게 한다', hint: '제자 경험 +60 · 스승 +20',
        go: function (c) { exp(c.b, 60); exp(c.a, 20); return { text: nm(c.a) + ' 이(가) 밤새 ' + nm(c.b) + ' 을(를) 가르쳤다' }; } }
    ]
  });

  /* 4. 연적 결투 요청 */
  function spar(c, hurtLoser) {
    var wa = OFF().stats(c.a).might + (hashOf(c.a + c.b + R().state().turn) % 21) - 10;
    var wb = OFF().stats(c.b).might + (hashOf(c.b + c.a + R().state().turn) % 21) - 10;
    var w = wa >= wb ? c.a : c.b, l = w === c.a ? c.b : c.a;
    OFF().noteDuel(w, l);
    exp(w, hurtLoser ? 40 : 30);
    if (hurtLoser) { OFF().rec(l).hurt = 1; loyal(l, -3); }
    return { w: w, l: l };
  }
  add({
    id: 'rival_duel', name: '호적수의 겨룸', emoji: '⚔️',
    find: function (F) {
      return pickOf(scanPairs('rival', function (x, y) {
        if (x > y) { return null; }
        return mineOf(x, F) && mineOf(y, F) && !OFF().rec(x).hurt && !OFF().rec(y).hurt ? { a: x, b: y, city: cityOfId(x) } : null;
      }), F, 'rd');
    },
    text: function (c) { return nm(c.a) + ' 이(가) ' + nm(c.b) + ' 에게 한판 겨루자고 청한다. 누가 위인지 가려야 속이 풀리겠단다.'; },
    choices: [
      { k: 'atk', label: '허락한다', hint: '이긴 쪽 경험 +40 · 진 쪽은 다치고 충성 -3',
        go: function (c) { var r = spar(c, true); return { text: nm(r.w) + ' 이(가) ' + nm(r.l) + ' 을(를) 눌렀다' }; } },
      { k: 'def', label: '말린다', hint: '값은 없다 · 둘 다 충성 -3',
        go: function (c) { loyal(c.a, -3); loyal(c.b, -3); return { text: '두 사람이 마지못해 칼을 거두었다' }; } },
      { k: 'util', label: '상금을 걸고 시합으로 연다', hint: '금 300 · 둘 다 경험 +30 · 충성 +4 · 다치지 않는다', cost: 300,
        go: function (c) {
          var r = spar(c, false); exp(r.l, 30); loyal(c.a, 4); loyal(c.b, 4);
          return { text: '구경꾼이 몰린 시합에서 ' + nm(r.w) + ' 이(가) 이겼다' };
        } }
    ]
  });

  /* 5. 노장 은퇴 청원 */
  add({
    id: 'elder_retire', name: '노장의 청원', emoji: '🍂',
    find: function (F) {
      if (OFF().ofForce(F).length < 4) { return null; }
      return pickOf(scanMine(F, function (id) {
        return !isLord(id, F) && OFF().age(id) >= 60 ? { a: id, b: '', city: cityOfId(id) } : null;
      }), F, 'er');
    },
    text: function (c) { return nm(c.a) + ' (' + OFF().age(c.a) + '세) 이(가) 이제 그만 물러나 쉬고 싶다고 아뢴다.'; },
    choices: [
      { k: 'atk', label: '만류하고 계속 부린다', hint: '충성 -10',
        go: function (c) { loyal(c.a, -10); return { text: nm(c.a) + ' 이(가) 무거운 얼굴로 자리에 돌아갔다' }; } },
      { k: 'def', label: '은퇴를 허락한다', hint: '값은 없다 · 재야로 물러난다(다시 부를 수 있다) · 같은 성 사람 충성 +2',
        go: function (c, F) {
          var r = OFF().rec(c.a), cy = cityRec(r.city);
          if (cy && cy.gov === c.a) { cy.gov = null; }
          OFF().atCity(r.city, F).forEach(function (h) { if (h.id !== c.a) { loyal(h.id, 2); } });
          r.force = null; r.found = true; r.done = false;
          return { text: nm(c.a) + ' 이(가) 인사를 올리고 물러났다. 성 안이 조용히 숙연해졌다' };
        } },
      { k: 'util', label: '명예직을 내려 붙든다', hint: '금 300 · 충성 +8 · 공 +10', cost: 300,
        go: function (c) { loyal(c.a, 8); OFF().rec(c.a).feats += 10; return { text: nm(c.a) + ' 이(가) 예우에 감복해 다시 붓을 잡았다' }; } }
    ]
  });

  /* 6. 포로의 옛 주인 편지 → 은혜를 갚으러 온 사람 */
  add({
    id: 'captive_letter', name: '포로의 편지', emoji: '⛓️', once: true,
    find: function (F) {
      var st = R().state(), out = [], k;
      for (k in st.captives) {
        if (!Object.prototype.hasOwnProperty.call(st.captives, k)) { continue; }
        var cy = cityRec(st.captives[k]);
        if (cy && cy.force === F && OFF().has(k) && !OFF().rec(k).dead) { out.push({ a: k, b: '', city: st.captives[k] }); }
      }
      return pickOf(out, F, 'cl');
    },
    text: function (c) { return '갇힌 ' + nm(c.a) + ' 에게 옛 주인의 편지가 닿았다. 읽는 그의 낯빛이 흔들린다.'; },
    choices: [
      { k: 'atk', label: '편지를 태우고 설득한다', hint: '성에서 지력이 가장 높은 이가 나선다',
        ok: function (c, F) { return !!wisest(c.city, F); },
        go: function (c, F) {
          var by = wisest(c.city, F), res = R().tryHire(c.city, by.id, c.a);
          return { text: res && res.hired ? nm(c.a) + ' 이(가) 마음을 돌려 합류했다' : nm(c.a) + ' 은(는) 끝내 편지를 놓지 않았다' };
        } },
      { k: 'def', label: '편지를 읽게 하고 풀어 준다', hint: '값은 없다 · 재야로 풀려난다 · 치안 +3 · 훗날 은혜를 갚으러 온다',
        go: function (c) {
          var st = R().state(), r = OFF().rec(c.a);
          delete st.captives[c.a]; r.force = null; r.found = true; r.city = c.city; adjust(c.city, 'sec', 3, 0, 100);
          return { text: nm(c.a) + ' 이(가) 깊이 절하고 성문을 나섰다', next: ['captive_return', 6] };
        } },
      { k: 'util', label: '몸값을 받고 돌려보낸다', hint: '금 +500 · 재야로 풀려난다',
        go: function (c, F) {
          var st = R().state(), r = OFF().rec(c.a);
          delete st.captives[c.a]; r.force = null; r.found = true; r.city = c.city; gold(F, 500);
          return { text: '몸값 500 이 들어오고 ' + nm(c.a) + ' 은(는) 떠났다' };
        } }
    ]
  });
  function homeCity(c, F) {
    var cy = cityRec(c.city);
    if (cy && cy.force === F) { return c.city; }
    return R().citiesOf(F)[0] || null;
  }
  add({
    id: 'captive_return', name: '은혜를 갚으러 온 사람', emoji: '🙇', chain: true,
    valid: function (c, F) { return isFree(c.a) && homeCity(c, F) ? c : null; },
    text: function (c) { return '풀려났던 ' + nm(c.a) + ' 이(가) 은혜를 잊지 못해 돌아왔다.'; },
    choices: [
      { k: 'atk', label: '자리를 내려 맞는다', hint: '금 200 · 충성 두둑하게 합류', cost: 200,
        go: function (c, F) { hire(c.a, homeCity(c, F), F, 20); return { text: nm(c.a) + ' 이(가) 무릎을 꿇고 충성을 맹세했다' }; } },
      { k: 'def', label: '조용히 받는다', hint: '값은 없다 · 합류',
        go: function (c, F) { hire(c.a, homeCity(c, F), F, 8); return { text: nm(c.a) + ' 이(가) 말없이 합류했다' }; } },
      { k: 'util', label: '옛 인연을 불러 모은다', hint: '합류 + 이름 모르는 재야 한 사람이 드러난다',
        go: function (c, F) {
          hire(c.a, homeCity(c, F), F, 8);
          var f = F === R().me() ? R().revealFree('옛 인연을 따라') : null;
          return { text: nm(c.a) + ' 이(가) 합류했다' + (f ? ' · ' + f.name + ' 의 이름이 들려왔다' : '') };
        } }
    ]
  });

  /* 7. 재야의 조건부 출사 → 약속의 날 */
  add({
    id: 'free_terms', name: '재야의 조건', emoji: '🍃',
    find: function (F) {
      var st = R().state(), out = [], k;
      for (k in st.officers) {
        if (!Object.prototype.hasOwnProperty.call(st.officers, k)) { continue; }
        if (!isFree(k) || !st.officers[k].found) { continue; }
        var cy = cityRec(st.officers[k].city);
        if (cy && cy.force === F) { out.push({ a: k, b: '', city: st.officers[k].city }); }
      }
      return pickOf(out, F, 'ft');
    },
    text: function (c) { return '재야의 ' + nm(c.a) + ' 이(가) 조건을 걸고 출사할 뜻을 비쳤다. 대접을 보고 정하겠단다.'; },
    choices: [
      { k: 'atk', label: '요구를 다 들어준다', hint: '금 500 · 합류 확실 · 충성 두둑', cost: 500,
        go: function (c, F) { hire(c.a, c.city, F, 15); return { text: nm(c.a) + ' 이(가) 흡족해 합류했다' }; } },
      { k: 'def', label: '예로 청해 본다', hint: '값은 없다 · 45% 로 합류',
        go: function (c, F) {
          if (roll(F, 'fts') < 0.45) { hire(c.a, c.city, F, 0); return { text: nm(c.a) + ' 이(가) 정성에 응해 합류했다' }; }
          return { text: nm(c.a) + ' 은(는) 조건이 맞지 않는다며 물러갔다' };
        } },
      { k: 'util', label: '한 자리를 약속한다', hint: '값은 없다 · 75% 로 합류 · 약속은 지켜야 한다',
        go: function (c, F) {
          if (roll(F, 'ftu') < 0.75) { hire(c.a, c.city, F, 5); return { text: nm(c.a) + ' 이(가) 약속을 믿고 합류했다', next: ['promise_due', 6] }; }
          return { text: nm(c.a) + ' 은(는) 말만으로는 믿지 못하겠다며 돌아섰다' };
        } }
    ]
  });
  add({
    id: 'promise_due', name: '약속의 날', emoji: '📜', chain: true,
    valid: function (c, F) { return mineOf(c.a, F) ? c : null; },
    text: function (c) { return nm(c.a) + ' 이(가) 합류할 때 받은 약속을 조용히 상기시킨다.'; },
    choices: [
      { k: 'atk', label: '성 하나를 맡긴다', hint: '그 성 태수로 앉힌다 · 충성 +10',
        ok: function (c, F) { return R().citiesOf(F).length > 0; },
        go: function (c, F) {
          var mine = R().citiesOf(F), r = OFF().rec(c.a), cy = cityRec(r.city);
          if (!cy || cy.force !== F) { OFF().placeAt(c.a, mine[0], F); cy = cityRec(mine[0]); }
          cy.gov = c.a; loyal(c.a, 10);
          return { text: nm(c.a) + ' 이(가) 태수로 앉았다' };
        } },
      { k: 'def', label: '더 두고 보자 한다', hint: '값은 없다 · 충성 -12',
        go: function (c) { loyal(c.a, -12); return { text: nm(c.a) + ' 의 얼굴이 굳었다' }; } },
      { k: 'util', label: '금으로 갈음한다', hint: '금 300 · 충성 +6', cost: 300,
        go: function (c) { loyal(c.a, 6); return { text: nm(c.a) + ' 이(가) 못마땅한 채로 받았다' }; } }
    ]
  });

  /* 8. 태수 부정 고발 → 덮어 둔 일의 뒤끝 */
  add({
    id: 'gov_graft', name: '태수 고발', emoji: '📮',
    find: function (F) {
      var out = [];
      R().citiesOf(F).forEach(function (cid) {
        var g = cityRec(cid).gov;
        if (!g || !mineOf(g, F) || isLord(g, F)) { return; }
        var greedy = OFF().traitsOf(g).some(function (t) { return t.k === 'greedy'; });
        if (greedy || OFF().loyalOf(g) < 45) { out.push({ a: g, b: '', city: cid }); }
      });
      return pickOf(out, F, 'gg');
    },
    valid: function (c, F) { var cy = cityRec(c.city); return cy && cy.force === F && cy.gov === c.a && mineOf(c.a, F) ? c : null; },
    text: function (c) { return CD_NAME(c.city) + ' 태수 ' + nm(c.a) + ' 의 부정을 고발하는 익명 서신이 들어왔다.'; },
    choices: [
      { k: 'atk', label: '잡아들여 벌한다', hint: '태수 해임 · 충성 -15 · 몰수 금 +300 · 치안 +5',
        go: function (c, F) { cityRec(c.city).gov = null; loyal(c.a, -15); gold(F, 300); adjust(c.city, 'sec', 5, 0, 100); return { text: nm(c.a) + ' 을(를) 태수에서 물리고 재물을 거뒀다' }; } },
      { k: 'def', label: '덮어 둔다', hint: '값은 없다 · 당장은 조용하다 · 뒤끝이 남는다',
        go: function () { return { text: '서신을 불에 넣었다. 하지만 소문은 불에 안 탄다', next: ['graft_grudge', 5] }; } },
      { k: 'util', label: '감찰관을 보낸다', hint: '금 300 · 실제로 거둔 금 +500 · 충성 -5 · 치안 +3', cost: 300,
        go: function (c, F) { gold(F, 500); loyal(c.a, -5); adjust(c.city, 'sec', 3, 0, 100); return { text: '감찰로 ' + nm(c.a) + ' 이(가) 빼돌린 재물 500 을 거뒀다' }; } }
    ]
  });
  function CD_NAME(cid) { var d = global.DG.cityData.find(cid); return d ? d.name : cid; }
  add({
    id: 'graft_grudge', name: '덮어 둔 뒤끝', emoji: '🗞️', chain: true,
    valid: function (c, F) { var cy = cityRec(c.city); return cy && cy.force === F && cy.gov === c.a && mineOf(c.a, F) ? c : null; },
    text: function (c) { return CD_NAME(c.city) + ' 태수 ' + nm(c.a) + ' 의 일이 결국 저잣거리에 퍼졌다. 백성이 술렁인다.'; },
    choices: [
      { k: 'atk', label: '이제라도 벌한다', hint: '태수 해임 · 충성 -15 · 치안 -3',
        go: function (c) { cityRec(c.city).gov = null; loyal(c.a, -15); adjust(c.city, 'sec', -3, 0, 100); return { text: '늦었지만 ' + nm(c.a) + ' 을(를) 물렸다' }; } },
      { k: 'def', label: '끝내 덮는다', hint: '값은 없다 · 치안 -6 · 그 성 사람 충성 -4',
        go: function (c, F) {
          adjust(c.city, 'sec', -6, 0, 100);
          OFF().atCity(c.city, F).forEach(function (h) { loyal(h.id, -4); });
          return { text: '덮은 채로 두니 성 안 인심이 식었다' };
        } },
      { k: 'util', label: '스스로 토해 내게 한다', hint: '금 +200 · 충성 -6',
        go: function (c, F) { gold(F, 200); loyal(c.a, -6); return { text: nm(c.a) + ' 이(가) 재물을 내놓고 고개를 숙였다' }; } }
    ]
  });

  /* 9. 괴물 지역 인물의 이질감 */
  var ALIEN = /^(균열|폐허|묘역)/;
  add({
    id: 'alien_friction', name: '이질감', emoji: '👁️',
    find: function (F) {
      return pickOf(scanMine(F, function (id) {
        var h = OFF().find(id);
        if (!h || !ALIEN.test(h.era || '') || isLord(id, F)) { return null; }
        var mates = OFF().atCity(cityOfId(id), F).filter(function (m) { return !ALIEN.test(m.era || '') && !isLord(m.id, F); });
        return mates.length ? { a: id, b: mates[hashOf(id) % mates.length].id, city: cityOfId(id) } : null;
      }), F, 'af');
    },
    text: function (c) { return nm(c.b) + ' 이(가) 이질스러운 ' + nm(c.a) + ' 과(와) 같은 성에 있는 걸 꺼린다. 서로 눈을 마주치지 않는다.'; },
    choices: [
      { k: 'atk', label: '규율로 누른다', hint: '이질 쪽 충성 -8 · 다른 쪽 +4',
        go: function (c) { loyal(c.a, -8); loyal(c.b, 4); return { text: '군율이 서자 ' + nm(c.b) + ' 의 표정이 풀렸다' }; } },
      { k: 'def', label: '거리를 두게 한다', hint: '값은 없다 · 둘 다 충성 -2',
        go: function (c) { loyal(c.a, -2); loyal(c.b, -2); return { text: '서로 마주칠 일을 줄였다. 응어리는 그대로다' }; } },
      { k: 'util', label: '함께 훈련시킨다', hint: '금 200 · 둘 다 경험 +20 · 충성 +3', cost: 200,
        go: function (c) { exp(c.a, 20); exp(c.b, 20); loyal(c.a, 3); loyal(c.b, 3); return { text: '땀을 나누니 낯섦이 조금 가셨다' }; } }
    ]
  });

  /* 10. 의형제의 잔치 */
  add({
    id: 'brothers_feast', name: '의형제의 잔치', emoji: '🍶',
    find: function (F) {
      return pickOf(scanPairs('sworn', function (x, y) {
        if (x > y) { return null; }
        return mineOf(x, F) && mineOf(y, F) && cityOfId(x) === cityOfId(y) ? { a: x, b: y, city: cityOfId(x) } : null;
      }), F, 'bf');
    },
    text: function (c) { return nm(c.a) + ' 과(와) ' + nm(c.b) + ' 이(가) 형제의 정을 나눌 자리를 청한다.'; },
    choices: [
      { k: 'atk', label: '군사를 불러 조련한다', hint: '금 200 · 그 성 훈련 +8', cost: 200,
        go: function (c) { adjust(c.city, 'train', 8, 0, 100); return { text: '형제가 앞장서 조련하니 군사의 기세가 올랐다' }; } },
      { k: 'def', label: '조용히 넘긴다', hint: '값은 없다 · 둘 다 충성 +2',
        go: function (c) { loyal(c.a, 2); loyal(c.b, 2); return { text: '두 사람이 말없이 잔을 부딪쳤다' }; } },
      { k: 'util', label: '잔치를 열어 민심을 얻는다', hint: '금 400 · 그 성 치안 +8 · 둘 다 충성 +6', cost: 400,
        go: function (c) { adjust(c.city, 'sec', 8, 0, 100); loyal(c.a, 6); loyal(c.b, 6); return { text: '성 안이 잔치로 들썩였다' }; } }
    ]
  });

  /* 11. 원수가 이웃 세력에 — 복수 청원 */
  add({
    id: 'foe_neighbor', name: '복수 청원', emoji: '🔥',
    find: function (F) {
      var D = global.DG.diplo, nb = D ? D.neighbours(F) : [];
      return pickOf(scanPairs('foe', function (x, y) {
        var ry = OFF().has(y) ? OFF().rec(y) : null;
        return mineOf(x, F) && ry && !ry.dead && ry.force && ry.force !== F && nb.indexOf(ry.force) >= 0 && relLv(x, y) < 2
          ? { a: x, b: y, city: cityOfId(x) } : null;
      }), F, 'fn');
    },
    text: function (c) { return nm(c.a) + ' 이(가) 이웃 ' + fname(OFF().rec(c.b).force) + ' 의 ' + nm(c.b) + ' 에게 묵은 원한을 갚게 해 달라고 청한다.'; },
    choices: [
      { k: 'atk', label: '선봉을 맡긴다', hint: '공 +20 · 충성 +6 · 그 이웃과 우호 -8',
        go: function (c, F) {
          OFF().rec(c.a).feats += 20; loyal(c.a, 6);
          var G = OFF().rec(c.b).force;
          if (G && global.DG.diplo) { global.DG.diplo.addRelation(F, G, -8); }
          return { text: nm(c.a) + ' 이(가) 이를 갈며 칼을 갈았다' };
        } },
      { k: 'def', label: '달래어 참게 한다', hint: '값은 없다 · 충성 -4',
        go: function (c) { loyal(c.a, -4); return { text: nm(c.a) + ' 이(가) 주먹을 쥐고 물러났다' }; } },
      { k: 'util', label: '밀서를 보내 이간한다', hint: '금 300 · 저쪽 ' + '충성 -10 · 이쪽 충성 +3', cost: 300,
        go: function (c) { loyal(c.b, -10); loyal(c.a, 3); return { text: nm(c.b) + ' 의 진영에 의심의 씨를 심었다' }; } }
    ]
  });

  /* 12. 의형제를 잃은 사람 */
  add({
    id: 'sworn_sorrow', name: '형제를 잃은 슬픔', emoji: '🕯️', once: true,
    find: function (F) {
      return pickOf(scanPairs('sworn', function (x, y) {
        return mineOf(x, F) && OFF().has(y) && OFF().rec(y).dead ? { a: x, b: y, city: cityOfId(x) } : null;
      }), F, 'ss');
    },
    text: function (c) { return nm(c.b) + ' 의 부음 뒤로 의형제 ' + nm(c.a) + ' 이(가) 통 말이 없다.'; },
    choices: [
      { k: 'atk', label: '복수를 다짐하게 한다', hint: '경험 +30 · 공 +15',
        go: function (c) { exp(c.a, 30); OFF().rec(c.a).feats += 15; return { text: nm(c.a) + ' 의 눈에 불꽃이 돌아왔다' }; } },
      { k: 'def', label: '조용히 곁을 지킨다', hint: '값은 없다 · 충성 +3',
        go: function (c) { loyal(c.a, 3); return { text: nm(c.a) + ' 이(가) 오래 말없이 앉아 있었다' }; } },
      { k: 'util', label: '제사를 성대히 올린다', hint: '금 300 · 충성 +10 · 같은 성 사람 충성 +2', cost: 300,
        go: function (c, F) {
          loyal(c.a, 10);
          OFF().atCity(c.city, F).forEach(function (h) { if (h.id !== c.a) { loyal(h.id, 2); } });
          return { text: '성대한 제사에 ' + nm(c.a) + ' 이(가) 눈물을 쏟았다' };
        } }
    ]
  });

  /* ── 진행 ─────────────────────────────────────────────── */

  function labelOf(ch, ctx) { return typeof ch.label === 'function' ? ch.label(ctx) : ch.label; }

  function choiceOk(ch, ctx, F) {
    if (ch.cost && goldOf(F) < ch.cost) { return false; }
    if (ch.ok && !ch.ok(ctx, F)) { return false; }
    return true;
  }

  function activeCount(F) {
    var a = S().events.active, n = 0, i;
    for (i = 0; i < a.length; i++) { if (a[i].force === F) { n++; } }
    return n;
  }

  /** 새 사연 하나를 고른다 — 정의 순서를 (세력·달) 해시로 돌려 매달 같은 것만 안 뜨게 한다 */
  function pickNew(F) {
    var ev = S().events, st = R().state(), n = ORDER.length, off = hashOf(F + '|' + st.turn + '|o') % n, i;
    for (i = 0; i < n; i++) {
      var id = ORDER[(off + i) % n], d = DEFS[id];
      if (ev.cool[F + '|' + id] !== undefined && st.turn - ev.cool[F + '|' + id] < COOL) { continue; }
      var ctx = d.find(F);
      if (!ctx) { continue; }
      if (d.once && ev.seen[id + '|' + ctx.a + '|' + ctx.b]) { continue; }
      return { id: id, step: 1, ctx: { a: ctx.a, b: ctx.b || '', city: ctx.city || '', force: F } };
    }
    return null;
  }

  /** 예약된 체인 하나가 때가 되었고 아직 성립하는가 */
  function dueChain(F) {
    var ev = S().events, st = R().state(), i;
    for (i = 0; i < ev.active.length; i++) {
      var a = ev.active[i];
      if (a.force !== F || a.due > st.turn) { continue; }
      ev.active.splice(i, 1);
      var d = DEFS[a.id];
      var ctx = d && d.valid ? d.valid({ a: a.a, b: a.b, city: a.city }, F) : null;
      if (ctx) { return { id: a.id, step: a.step, ctx: { a: ctx.a, b: ctx.b || '', city: ctx.city || '', force: F } }; }
      return dueChain(F);    // 성립하지 않으면 그냥 지나가고 다음 것을 본다
    }
    return null;
  }

  /** 군주의 특성으로 갈래를 고른다 — AI 의 자동 선택 */
  function pref(F) {
    var f = FD.force(F), ts = f ? OFF().traitsOf(OFF().lordOf(F)) : [], i;
    var ATK = { brave: 1, ambitious: 1, warlike: 1, cold: 1 }, UTIL = { sly: 1, greedy: 1, studious: 1, righteous: 1 };
    for (i = 0; i < ts.length; i++) {
      if (ATK[ts[i].k]) { return 'atk'; }
      if (UTIL[ts[i].k]) { return 'util'; }
    }
    return 'def';
  }

  function autoPick(fire) {
    var d = DEFS[fire.id], F = fire.ctx.force, want = pref(F), order = [want, 'def', 'atk', 'util'], i, j;
    for (i = 0; i < order.length; i++) {
      for (j = 0; j < d.choices.length; j++) {
        if (d.choices[j].k === order[i] && choiceOk(d.choices[j], fire.ctx, F)) { return d.choices[j].k; }
      }
    }
    return 'def';
  }

  /** 고른 갈래를 적용한다 — 사람도 AI 도 이 함수 하나 */
  function resolve(fire, k) {
    var st = S(), ev = st.events, d = DEFS[fire.id], ctx = fire.ctx, F = ctx.force, ch = null, i;
    for (i = 0; i < d.choices.length; i++) { if (d.choices[i].k === k) { ch = d.choices[i]; } }
    if (!ch) { return { ok: false, why: '없는 갈래' }; }
    if (!choiceOk(ch, ctx, F)) { return { ok: false, why: ch.cost && goldOf(F) < ch.cost ? '금이 모자랍니다' : '지금은 고를 수 없습니다' }; }
    if (ch.cost) { gold(F, -ch.cost); }
    var res = ch.go(ctx, F, fire.step) || {};
    ev.done[fire.id] = (ev.done[fire.id] || 0) + 1;
    ev.cool[F + '|' + fire.id] = st.turn;
    if (d.once) { ev.seen[fire.id + '|' + ctx.a + '|' + ctx.b] = st.turn; }
    if (res.next && fire.step < MAX_STEP && activeCount(F) < MAX_ACTIVE) {
      ev.active.push({ id: res.next[0], step: fire.step + 1, due: st.turn + res.next[1], force: F, a: ctx.a, b: ctx.b, city: ctx.city });
    }
    if (F === st.me) { core.log('📜 ' + d.name + ' — ' + (res.text || ''), 'info'); }
    core.emit('rtk:eventDone', { id: fire.id, force: F, k: k });
    core.emit('changed');
    return { ok: true, text: res.text || '', k: k };
  }

  /** 다음 달로 넘어갈 때 한 번 — 세력마다 예약된 체인 → 새 사연 순으로 하나까지 */
  function tick() {
    var st = R().state();
    if (!st.started || st.result) { return []; }
    var ev = S().events, ids = R().liveForces(), out = [], i;
    for (i = 0; i < ids.length; i++) {
      var F = ids[i], isMe = F === st.me;
      if (isMe && ev.pending) { continue; }
      var fire = dueChain(F);
      if (!fire && isMe) { fire = fromSources(F); }        // 시나리오 카드 — 정해진 때, 사람 세력만
      if (!fire && activeCount(F) < MAX_ACTIVE && roll(F, 'r') < chance()) { fire = pickNew(F); }
      if (!fire) { continue; }
      if (isMe) {
        ev.pending = fire;
        out.push(fire);
      } else {
        resolve(fire, autoPick(fire));
      }
    }
    return out;
  }

  /** 지금 떠 있는 사연(화면용) — 없으면 null */
  function view() {
    var ev = S().events, p = ev.pending;
    if (!p) { return null; }
    var d = DEFS[p.id];
    if (!d) { ev.pending = null; return null; }
    return {
      id: p.id, step: p.step, tag: d.tag || '', name: d.name, emoji: d.emoji, text: d.text(p.ctx, p.step),
      a: p.ctx.a, b: p.ctx.b, kind: p.ctx.b ? kindOf(p.ctx.a, p.ctx.b) : null,
      choices: d.choices.map(function (ch) {
        return { k: ch.k, label: labelOf(ch, p.ctx), hint: ch.hint || '', cost: ch.cost || 0, ok: choiceOk(ch, p.ctx, p.ctx.force) };
      })
    };
  }

  /** 사람이 갈래를 골랐다 */
  function choose(k) {
    var ev = S().events, p = ev.pending;
    if (!p) { return { ok: false, why: '고를 사연이 없습니다' }; }
    var res = resolve(p, k);
    if (res.ok) { ev.pending = null; core.persist(); }
    return res;
  }

  /** 기록 시트용 — 진행 중인 사연 줄들 */
  function activeView() {
    var ev = S().events, st = R().state(), out = [], i;
    for (i = 0; i < ev.active.length; i++) {
      var a = ev.active[i], d = DEFS[a.id];
      if (!d || a.force !== st.me) { continue; }
      out.push({ id: a.id, name: d.name, emoji: d.emoji, step: a.step, in: Math.max(0, a.due - st.turn), who: [a.a, a.b].filter(Boolean).map(nm) });
    }
    return out;
  }

  global.DG = global.DG || {};
  /* ── 퓨전 사연(§5-9, 2026-09-24) — 균열·폐허·묘역이 이웃한 성에서 생기는 일 ─────
   * 이계(異界) 세 지역(`data-city.js` prov fu·pf·my)과 **맞닿은 우리 성**(또는 그 안의 성)에서만 뜬다.
   * 사람 짝(관계 표)이 아니라 **땅**이 부르는 사연이라 ctx.a 는 그 성에서 가장 지혜로운 우리 사람이다.
   * 둘째 단은 한 번 더 골라 매듭짓는다 — 이계 수비 무장을 거둘 수도 있다(hire, 이질이라 충성이 낮다).
   */
  function CD() { return global.DG.cityData; }
  var FUSION_PROV = { fu: '균열', pf: '폐허', my: '묘역' };
  /** F 의 성 중 이계 prov 에 있거나 그 곁에 붙은 성 — 없으면 null. 결정적으로 하나를 고른다 */
  function fusionCity(F, prov) {
    var mine = R().citiesOf(F), hits = [], i, j;
    for (i = 0; i < mine.length; i++) {
      var d = CD().find(mine[i]);
      if (!d) { continue; }
      var near = d.prov === prov;
      for (j = 0; !near && d.adj && j < d.adj.length; j++) {
        var nd = CD().find(d.adj[j]);
        if (nd && nd.prov === prov) { near = true; }
      }
      if (near) { hits.push(mine[i]); }
    }
    if (!hits.length) { return null; }
    return hits[hashOf(F + '|' + prov + '|' + R().state().turn) % hits.length];
  }
  function fusionCtx(F, prov) {
    var c = fusionCity(F, prov);
    if (!c) { return null; }
    var w = wisest(c, F);
    return w ? { a: w.id, city: c } : null;
  }
  function cname(id) { var d = CD().find(id); return d ? d.name : id; }
  /** 거둘 수 있는 이계 무장 하나(두목은 빼고) — 없으면 null */
  function freeAlien(list) {
    for (var i = 0; list && i < list.length; i++) {
      if (!list[i].boss && isFree(list[i].id)) { return list[i].id; }
    }
    return null;
  }

  /* 1. 균열의 울림 → 균열의 문 */
  add({
    id: 'rift_echo', name: '균열의 울림', emoji: '🌌',
    find: function (F) { return fusionCtx(F, 'fu'); },
    text: function (c) { return cname(c.city) + ' 하늘에 가는 금이 갔다. 밤마다 쇳소리가 울리고, 별이 거꾸로 흐른다.'; },
    choices: [
      { k: 'atk', label: '정찰대를 보낸다', hint: '금 300 · 60% 로 이계의 쇠붙이(금 +700) · 뒤에 균열의 문', cost: 300,
        go: function (c, F, step) {
          if (roll(F, 're:' + step) < 0.6) { gold(F, 700); return { text: '정찰대가 이계의 쇠붙이를 한 짐 지고 돌아왔다', next: ['rift_gate', 4] }; }
          adjust(c.city, 'troops', -400, 0, 999999); return { text: '정찰대 몇이 금 너머로 사라졌다' };
        } },
      { k: 'def', label: '성벽을 돋운다', hint: '값은 없다 · 치안 +6',
        go: function (c) { adjust(c.city, 'sec', 6, 0, 100); return { text: '성벽에 부적을 붙이고 망루를 늘렸다' }; } },
      { k: 'util', label: '학자에게 살피게 한다', hint: '그 사람 경험 +50 · 기술 +10 · 뒤에 균열의 문',
        go: function (c) { exp(c.a, 50); adjust(c.city, 'tech', 10, 0, 999); return { text: nm(c.a) + ' 이(가) 균열의 결을 받아 적었다', next: ['rift_gate', 5] }; } }
    ]
  });
  add({
    id: 'rift_gate', name: '균열의 문', emoji: '🌀', chain: true,
    valid: function (c, F) { return R().city(c.city) && R().city(c.city).force === F ? c : null; },
    text: function (c) { return cname(c.city) + ' 곁의 금이 문만큼 벌어졌다. 그 너머에서 누군가 이쪽을 본다.'; },
    choices: [
      { k: 'atk', label: '문 너머의 장수를 부른다', hint: '이계 무장 하나가 합류(충성 낮다) · 없으면 금 +400',
        go: function (c, F) {
          var id = freeAlien(FD.FUTURE_OFFICERS);
          if (id) { hire(id, c.city, F, -5); return { text: nm(id) + ' 이(가) 문을 넘어와 무릎을 꿇었다' }; }
          gold(F, 400); return { text: '문 너머엔 빈 갑옷뿐이었다 — 녹여 팔았다' };
        } },
      { k: 'def', label: '문을 봉한다', hint: '값은 없다 · 치안 +10',
        go: function (c) { adjust(c.city, 'sec', 10, 0, 100); return { text: '금을 흙과 부적으로 메웠다' }; } },
      { k: 'util', label: '이계와 셈을 튼다', hint: '금 +800 · 치안 -5',
        go: function (c, F) { gold(F, 800); adjust(c.city, 'sec', -5, 0, 100); return { text: '문 너머 상인과 기묘한 흥정이 오갔다' }; } }
    ]
  });

  /* 2. 폐허의 역병 → 역병의 근원 */
  add({
    id: 'plague_mist', name: '폐허의 역병', emoji: '🌫️',
    find: function (F) { return fusionCtx(F, 'pf'); },
    text: function (c) { return '폐허 쪽에서 잿빛 안개가 ' + cname(c.city) + ' 로 흘러든다. 사람들이 기침을 하고 우물이 탁해졌다.'; },
    choices: [
      { k: 'atk', label: '안개를 불살라 걷는다', hint: '금 400 · 치안 +5 · 상업 -5', cost: 400,
        go: function (c) { adjust(c.city, 'sec', 5, 0, 100); adjust(c.city, 'comm', -5, 0, 9999); return { text: '성 밖에 불을 놓아 안개를 태웠다' }; } },
      { k: 'def', label: '성문을 닫는다', hint: '값은 없다 · 상업 -8 · 뒤에 역병의 근원',
        go: function (c) { adjust(c.city, 'comm', -8, 0, 9999); return { text: '성문을 닫고 안개가 걷히길 기다린다', next: ['plague_cure', 3] }; } },
      { k: 'util', label: '약초꾼을 모은다', hint: '그 사람 경험 +40 · 뒤에 역병의 근원',
        go: function (c) { exp(c.a, 40); return { text: nm(c.a) + ' 이(가) 약초꾼을 모아 탕약을 끓였다', next: ['plague_cure', 4] }; } }
    ]
  });
  add({
    id: 'plague_cure', name: '역병의 근원', emoji: '🧪', chain: true,
    valid: function (c, F) { return R().city(c.city) && R().city(c.city).force === F ? c : null; },
    text: function (c) { return '역병의 근원이 폐허 깊은 곳의 썩은 샘이라는 말이 돈다. ' + cname(c.city) + ' 사람들이 답을 기다린다.'; },
    choices: [
      { k: 'atk', label: '토벌대를 보낸다', hint: '병 -800 · 폐허 무장 하나를 거둔다(없으면 금 +600)',
        go: function (c, F) {
          adjust(c.city, 'troops', -800, 0, 999999);
          var id = freeAlien(FD.RUIN_OFFICERS);
          if (id) { hire(id, c.city, F, -5); return { text: '샘을 메우자 ' + nm(id) + ' 이(가) 정신이 들어 우리 편에 섰다' }; }
          gold(F, 600); return { text: '샘을 메우고 폐허의 보화를 거둬 왔다' };
        } },
      { k: 'def', label: '안개가 걷히길 기다린다', hint: '값은 없다 · 인구가 조금 준다',
        go: function (c) { var r = R().city(c.city); if (r) { r.pop = Math.max(1000, Math.round(r.pop * 0.95)); } return { text: '역병이 한 철을 휩쓸고 지나갔다' }; } },
      { k: 'util', label: '치료법을 널리 알린다', hint: '그 성 무장 전원 충성 +5 · 치안 +6',
        go: function (c, F) {
          OFF().atCity(c.city, F).forEach(function (o) { loyal(o.id, 5); });
          adjust(c.city, 'sec', 6, 0, 100);
          return { text: '치료법을 새긴 비석이 성문 앞에 섰다' };
        } }
    ]
  });

  /* 3. 묘역의 종소리 → 망자의 맹세 */
  add({
    id: 'tomb_bell', name: '묘역의 종소리', emoji: '🔔',
    find: function (F) { return fusionCtx(F, 'my'); },
    text: function (c) { return '밤마다 ' + cname(c.city) + ' 땅 밑에서 종이 울린다. 백골 병사가 성 밖을 서성인다는 소문이다.'; },
    choices: [
      { k: 'atk', label: '진혼제를 올린다', hint: '금 300 · 치안 +8 · 뒤에 망자의 맹세', cost: 300,
        go: function (c) { adjust(c.city, 'sec', 8, 0, 100); return { text: '향이 사흘 밤낮으로 타올랐다', next: ['tomb_oath', 4] }; } },
      { k: 'def', label: '성문을 걸어 잠근다', hint: '값은 없다 · 훈련 +5 · 치안 -3',
        go: function (c) { adjust(c.city, 'train', 5, 0, 100); adjust(c.city, 'sec', -3, 0, 100); return { text: '병사들이 밤새 창을 쥐고 성벽을 지켰다' }; } },
      { k: 'util', label: '무당에게 묻는다', hint: '그 사람 경험 +30 · 50% 로 무덤의 재물(금 +400)',
        go: function (c, F, step) {
          exp(c.a, 30);
          if (roll(F, 'tb:' + step) < 0.5) { gold(F, 400); return { text: '무당이 가리킨 곳에서 옛 무덤의 재물이 나왔다' }; }
          return { text: '무당은 "아직 때가 아니다" 라고만 했다' };
        } }
    ]
  });
  add({
    id: 'tomb_oath', name: '망자의 맹세', emoji: '💀', chain: true,
    valid: function (c, F) { return R().city(c.city) && R().city(c.city).force === F ? c : null; },
    text: function (c) { return '진혼제 뒤, ' + cname(c.city) + ' 성문 앞에 백골 장수 하나가 서서 맹세를 청한다.'; },
    choices: [
      { k: 'atk', label: '망자 장수를 거둔다', hint: '묘역 무장 하나가 합류(충성 낮다) · 없으면 훈련 +10',
        go: function (c, F) {
          var id = freeAlien(FD.TOMB_OFFICERS);
          if (id) { hire(id, c.city, F, -5); return { text: nm(id) + ' 이(가) 뼈마디를 울리며 맹세했다' }; }
          adjust(c.city, 'train', 10, 0, 100); return { text: '장수는 사라지고 그 기세만 병사들에게 남았다' };
        } },
      { k: 'def', label: '편히 잠들게 한다', hint: '값은 없다 · 치안 +10 · 그 성 무장 충성 +3',
        go: function (c, F) {
          adjust(c.city, 'sec', 10, 0, 100);
          OFF().atCity(c.city, F).forEach(function (o) { loyal(o.id, 3); });
          return { text: '장수가 고개를 숙이고 땅으로 돌아갔다' };
        } },
      { k: 'util', label: '무덤의 보물을 청한다', hint: '금 +900 · 치안 -6',
        go: function (c, F) { gold(F, 900); adjust(c.city, 'sec', -6, 0, 100); return { text: '장수가 옛 왕의 보물을 내주고 어둠으로 걸어갔다' }; } }
    ]
  });

  global.DG.event = {
    DEFS: DEFS, ORDER: ORDER, CHANCE: CHANCE, MAX_ACTIVE: MAX_ACTIVE, COOL: COOL, MAX_STEP: MAX_STEP,
    relLv: relLv, relAdd: relAdd, kindOf: kindOf, pairsOf: pairsOf,
    tick: tick, view: view, choose: choose, resolve: resolve, autoPick: autoPick, pref: pref,
    pickNew: pickNew, activeView: activeView, roll: roll,
    addDef: add, addSource: addSource,
    /** 시나리오가 쓰는 손잡이 — 새 판정을 안 만들고 있는 것만 만진다 */
    h: { nm: nm, wisest: wisest, gold: gold, goldOf: goldOf, adjust: adjust, loyal: loyal, cityRec: cityRec, hire: hire, isFree: isFree, mineOf: mineOf }
  };
})(window);
