/**
 * 발견 — 무엇을 보았는지가 남는다 (3D 전환 PHASE 11)
 * ---------------------------------------------------------------
 * PHASE 5~10 을 지나며 이 땅에는 볼 것이 늘었다 — 이름난 자리 열하나, 주민 열,
 * 짐승 다섯 종, 사건 열하나, 그리고 사건이 남기는 기록. 그런데 **본 것이 아무 데도
 * 안 남았다.** 사건은 `core.log` 에 한 줄을 흘렸고 그 줄은 곧 밀려 사라졌다.
 *
 * `PLAN.md` 12절("플레이어가 직접 발견해야 한다") · 13절("도감 완성률을 표시한다") ·
 * 36절("발견한 사건을 사관에 기록한다")이 가리키는 자리가 여기다.
 *
 * **목록을 새로 만들지 않는다.** 무엇이 있는지는 이미 다른 파일이 들고 있다 —
 *
 *   지역   `land.places()`     주민   `npc.PEOPLE`     짐승   `animal.KINDS`
 *   사건   `event.EVENTS`      기록   사건의 `record` 칸
 *
 * 여기는 **본 것에 도장을 찍고 세는 일**만 한다. 목록이 늘면 완성률의 분모가
 * 저절로 늘어난다(13절의 "적극 활용한다" 를 그렇게 읽었다).
 *
 * **세이브에 남는다** — `save.codex`. 없던 칸이라 옛 세이브도 열리면 그 자리에서
 * 채워진다(44절 "기존 save format 을 깨지 않는다").
 *
 * **2026-08-31 갱신** — PLAN 49절("탐험 자체가 보상이 되도록 한다")에 맞춰
 * 소액 경험치·재화를 더한다(사용자가 직접 골랐다 — 이 절은 원래 "발견은 기록이지
 * 보상이 아니다"였다). **처음 볼 때 한 번뿐**이므로 보상도 소액으로 잡았다 —
 * 큰 보상은 여전히 사냥·성채·퀘스트 같은 다른 판정의 몫이다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 발견을 남길까 — 0 이면 도장을 안 찍는다(옛 화면) */
  function on() { return core.tuned('codex.on', 1) ? true : false; }

  /* ── 여섯 갈래 (PLAN 13절) ────────────────────────────
   * 13절은 인물·지역·사건·아이템·생물·역사 여섯을 적었다. 이 판에서는
   * **인물(장수)과 아이템은 이미 제 도감이 있다** — 도감 시트와 행낭이 그것이다.
   * 그래서 여기서 새로 맡는 것은 넷이고, 나머지 둘은 **있는 것을 읽어 와 같이 센다**.
   */
  var KINDS = [
    { key: 'place', name: '지역', emoji: '🗺️',
      list: function () {
        var L = global.DG.land;
        if (!L || !L.on()) { return []; }
        return L.places().map(function (p) {
          return { id: p.id, name: p.name, hint: p.hidden ? '숨은 곳' : null };
        });
      } },
    { key: 'people', name: '사람', emoji: '🧑',
      list: function () {
        var N = global.DG.npc;
        if (!N || !N.on()) { return []; }
        return N.PEOPLE.map(function (p) { return { id: p.id, name: p.name, hint: p.personality }; });
      } },
    { key: 'beast', name: '생물', emoji: '🦌',
      list: function () {
        var A = global.DG.animal;
        if (!A || !A.on()) { return []; }
        return Object.keys(A.KINDS).map(function (k) {
          return { id: k, name: A.KINDS[k].name, hint: A.KINDS[k].note };
        });
      } },
    { key: 'event', name: '사건', emoji: '📋',
      list: function () {
        var E = global.DG.event;
        if (!E) { return []; }
        return E.EVENTS.map(function (e) { return { id: e.id, name: e.name, hint: null }; });
      } },
    { key: 'record', name: '역사', emoji: '📖',
      list: function () {
        var E = global.DG.event;
        if (!E) { return []; }
        return E.EVENTS.filter(function (e) { return e.record; })
          .map(function (e) { return { id: e.id, name: e.record, hint: e.name }; });
      } },
    /* 명소(PLAN §5 ①) — 봉수대. beacon.js 가 유일한 소유자다(다른 갈래처럼
       "있는 것을 읽어 와 같이 센다"). 36개뿐이라 다른 갈래보다 훨씬 작다 */
    { key: 'landmark', name: '명소', emoji: '🗼',
      list: function () {
        var B = global.DG.beacon;
        if (!B) { return []; }
        return B.list().map(function (b) {
          return { id: b.key, name: b.name + ' 봉수대', hint: b.region.name + ' 권역' };
        });
      } },
    /* 비문(PLAN §5 ⑤) — 비석 순례. 권역 36 줄, 그 권역의 첫 비석을 찾으면 도장이 찍히고
       힌트는 n/10(열 개 = 초대장). stela.js 가 유일한 소유자다 */
    { key: 'stele', name: '비문', emoji: '🪦',
      list: function () {
        var S = global.DG.stela;
        return S ? S.regionList() : [];
      } }
  ];

  function kindOf(key) {
    for (var i = 0; i < KINDS.length; i++) { if (KINDS[i].key === key) { return KINDS[i]; } }
    return null;
  }

  /** 갈래별 발견 보상(PLAN 49절) — 소액이다. 지역은 "숨은 곳"이면 세 배 준다
   * (PLAN 예시의 "희귀 장소 발견 → 특별 보상") */
  var REWARD = {
    place: { exp: 12, gold: 0 },
    people: { exp: 8, gold: 6 },
    beast: { exp: 6, gold: 4 },
    event: { exp: 10, gold: 0 },
    record: { exp: 14, gold: 0 },
    /* landmark(봉수대)는 beacon.js 의 light() 가 이미 금·공적·丹을 크게 주므로
       여기는 발견 도장에 붙는 소액만(다른 갈래와 같은 결) */
    landmark: { exp: 20, gold: 0 },
    /* stele(비문)는 stela.js 의 discover() 가 丹·공적을 주므로 도장엔 소액만 */
    stele: { exp: 4, gold: 0 }
  };

  /** 이 발견이 "숨은 곳" 같은 특별한 것인가 — 있으면 hint 문자열, 없으면 null */
  function hintOf(kind, id) {
    var K = kindOf(kind);
    if (!K) { return null; }
    var l = K.list(), i;
    for (i = 0; i < l.length; i++) { if (l[i].id === id) { return l[i].hint; } }
    return null;
  }

  /** 이 발견에 걸린 보상 — **순수 함수다**(gainExp 의 장비·날씨 배수를 안 탄다).
   * 진단이 배수(숨은 곳 ×3)만 따로 보고 싶을 때 쓴다. 실제 지급은 `discover` 가 한다 */
  function rewardOf(kind, id) {
    var rw = REWARD[kind];
    if (!rw) { return { exp: 0, gold: 0 }; }
    var mul = (hintOf(kind, id) === '숨은 곳') ? 3 : 1;
    return { exp: (rw.exp || 0) * mul, gold: (rw.gold || 0) * mul };
  }

  /** 세이브 칸 — 없던 칸이라 옛 세이브도 여기서 채워진다 */
  function book() {
    if (!core.save.codex) { core.save.codex = {}; }
    return core.save.codex;
  }

  function keyOf(kind, id) { return kind + ':' + id; }

  function has(kind, id) { return !!book()[keyOf(kind, id)]; }

  /**
   * 처음 본 것에 도장을 찍는다. **처음일 때만 true** 를 준다.
   * 두 번째부터는 아무 일도 안 일어난다 — 그래서 지나갈 때마다 부르면 된다.
   */
  function discover(kind, id, opt) {
    if (!on() || !kind || !id) { return false; }
    var K = kindOf(kind);
    if (!K) { return false; }
    var k = keyOf(kind, id);
    var b = book();
    if (b[k]) { return false; }
    b[k] = Date.now();
    var name = (opt && opt.name) || nameOf(kind, id) || id;
    core.log(K.emoji + ' [발견] ' + K.name + ' — ' + name, 'feat');
    /* 발견 보상(PLAN 49절) — 숨은 곳이면 세 배 */
    var rw = rewardOf(kind, id);
    var got = { exp: 0, gold: 0 };
    if (rw.exp) { got.exp = core.gainExp(rw.exp); }
    if (rw.gold) { got.gold = rw.gold; core.save.player.gold += got.gold; }
    var rwTxt = (got.exp ? ' · 경험치 +' + got.exp : '') + (got.gold ? ' · 🪙 +' + got.gold : '');
    core.emit('toast', K.emoji + ' 새로 알게 되었습니다 — ' + name + rwTxt);
    core.emit('codex', { kind: kind, id: id, name: name, reward: got });
    core.emit('changed');
    return true;
  }

  function nameOf(kind, id) {
    var K = kindOf(kind);
    if (!K) { return null; }
    var l = K.list(), i;
    for (i = 0; i < l.length; i++) { if (l[i].id === id) { return l[i].name; } }
    return null;
  }

  /* ── 세기 (PLAN 13절 "완성률을 표시한다") ───────────── */

  /** 한 갈래의 현황 `{key, name, emoji, rows, seen, total}` */
  function tally(key) {
    var K = kindOf(key);
    if (!K) { return null; }
    var l = K.list(), seen = 0, rows = [], i;
    for (i = 0; i < l.length; i++) {
      var got = has(key, l[i].id);
      if (got) { seen++; }
      rows.push({ id: l[i].id, name: l[i].name, hint: l[i].hint, seen: got,
                  at: book()[keyOf(key, l[i].id)] || 0 });
    }
    return { key: key, name: K.name, emoji: K.emoji, rows: rows, seen: seen, total: l.length };
  }

  function all() { return KINDS.map(function (K) { return tally(K.key); }); }

  /**
   * 전체 완성률. **기존 도감(인물)도 같이 센다** — 13절이 "현재 도감을 적극
   * 활용한다" 고 했으니 따로 노는 두 숫자를 만들지 않는다.
   */
  function rate() {
    var seen = 0, total = 0, ts = all(), i;
    for (i = 0; i < ts.length; i++) { seen += ts[i].seen; total += ts[i].total; }
    var d = dex();
    seen += d.seen; total += d.total;
    var ms = mounts(), mt = { seen: ms.filter(function (x) { return x.have; }).length, total: ms.length };   // W-0117 탈것
    seen += mt.seen; total += mt.total;
    return { seen: seen, total: total, pct: total ? Math.round(seen / total * 100) : 0, dex: d, mount: mt };
  }

  /** 기존 도감(인물·짐승) — 여기서 만들지 않고 세기만 한다 */
  function dex() {
    var D = global.DG.data;
    var save = core.save.dex || {};
    var n = 0;
    if (save.heroes) { n += Object.keys(save.heroes).length; }
    if (save.pets) { n += Object.keys(save.pets).length; }
    var total = D ? (D.heroes.length + D.pets.length) : 0;
    return { seen: Math.min(n, total), total: total };
  }

  /* ── 탈것 칸(W-0117) ─────────────────────────────────
   * 표는 `mount.js` 의 `MOUNTS` 가 유일한 소유자 — 여기는 읽기만 한다. 얻음 = `mount.isUnlocked`
   * (레벨 문턱이나 그 말을 도감에 등록). 초상은 연결 펫(`pet`)의 초상을 그대로 쓴다(새 그림 없음). */
  function mounts() {
    var M = global.DG.mount, D = global.DG.data;
    if (!M || !M.MOUNTS || !M.on()) { return []; }
    return M.MOUNTS.map(function (m) { return { m: m, pet: D ? D.find(m.pet) : null, have: M.isUnlocked(m) }; });
  }

  /** 도감 시트의 탈것 칸 — ui 의 `esc`·`pt`(초상)·`dexBar` 를 받아 쓴다. 칸은 인물·펫과 같은 `dexgrid`/`dcell`(누를 것이 없어 손가락 모양을 끈다) */
  function mountView(esc, pt, dexBar) {
    var rows = mounts(), have = rows.filter(function (r) { return r.have; }).length, out = '';
    if (!rows.length) { return ''; }
    rows.forEach(function (r) {
      var m = r.m, sp = m.kind === 'fly' ? '걸음 ×' + m.mul + ' · 날면 ×' + m.fly : '걸음 ×' + m.mul;
      var face = r.have ? (r.pet && pt ? pt('pet', r.pet, 52) : (m.kind === 'fly' ? '🦅' : '🐎')) : '❔';
      out += '<div class="dcell' + (r.have ? '' : ' locked') + '" style="cursor:default;transform:none" title="' +
        esc(m.name + ' · ' + (m.kind === 'fly' ? '나는 탈것' : '땅 탈것') + ' · ' + sp + ' — ' + m.desc +
          (r.have ? '' : ' (모험 레벨 ' + m.lv + ' 또는 그 짐승을 도감에 등록하면 열림)')) + '">' +
        '<span class="de' + (r.have ? '' : ' locked-mark') + '">' + face + '</span>' +
        '<small>' + (r.have ? esc(m.name) : 'Lv.' + m.lv) + '</small>' +
        (m.kind === 'fly' ? '<i class="cnt">🦅</i>' : '') + '</div>';
    });
    return '<div class="sec"><h4>🐎 탈것</h4>' + (dexBar ? dexBar(have, rows.length) : '') +
      '<div class="dexgrid">' + out + '</div></div>';
  }

  /* ── 지나가며 도장을 찍는다 ──────────────────────────
   * 각 모듈이 저를 알릴 필요가 없게, **여기서 물어본다**. 그래야 `npc.js`·
   * `animal.js` 가 발견을 몰라도 되고, 발견을 끄면 그쪽은 한 줄도 안 바뀐다.
   */
  /** 이름난 자리에 이만큼 다가서면 "가 봤다" 로 친다(m) */
  function NEAR_PLACE() { return core.tuned('codex.placeR', 34); }
  /** 짐승을 이만큼 안에서 보면 "봤다" 로 친다(m) */
  function NEAR_BEAST() { return core.tuned('codex.beastR', 45); }
  /** 사람은 말이 걸리는 거리에서 친다 — `npc.talkRadius` 를 그대로 쓴다 */

  function tick() {
    if (!on() || global.DG_NO_DRAW) { return 0; }
    var pos = core.save.player.pos, n = 0, i;

    var L = global.DG.land;
    if (L && L.on()) {
      var ps = L.places();
      for (i = 0; i < ps.length; i++) {
        if (Math.hypot(ps[i].x - pos.x, ps[i].y - pos.y) <= NEAR_PLACE()) {
          if (discover('place', ps[i].id, { name: ps[i].name })) { n++; }
        }
      }
    }

    var N = global.DG.npc;
    if (N && N.on()) {
      var ns = N.live(pos), r = core.tuned('npc.talkRadius', 14);
      for (i = 0; i < ns.length; i++) {
        if (ns[i].dist <= r && discover('people', ns[i].p.id, { name: ns[i].p.name })) { n++; }
      }
    }

    var A = global.DG.animal;
    if (A && A.on()) {
      var bs = A.live(pos), br = NEAR_BEAST();
      for (i = 0; i < bs.length; i++) {
        if (bs[i].dist <= br && discover('beast', bs[i].kind.id, { name: bs[i].kind.name })) { n++; }
      }
    }
    return n;
  }

  function stats() {
    var r = rate();
    var by = {};
    all().forEach(function (t) { by[t.key] = t.seen + '/' + t.total; });
    by.dex = r.dex.seen + '/' + r.dex.total;
    by.mount = r.mount.seen + '/' + r.mount.total;
    return { on: on(), pct: r.pct, seen: r.seen, total: r.total, by: by };
  }

  global.DG = global.DG || {};
  global.DG.codex = {
    KINDS: KINDS,
    on: on, kindOf: kindOf, has: has, discover: discover, nameOf: nameOf, rewardOf: rewardOf,
    tally: tally, all: all, rate: rate, dex: dex, mounts: mounts, mountView: mountView,
    tick: tick, stats: stats,
    /** 도장을 다 지운다 (진단이 제 뒤를 치울 때) */
    clear: function () { core.save.codex = {}; return true; }
  };
})(window);
