/**
 * 경락도(經絡圖) — PoE식 패시브 그물을 인물마다 (W-0180)
 * ===============================================================
 * 무예 나무(skill.js·data-skill.js)는 그대로 두고 **그 위의 패시브 층**이다.
 * 그물 정의는 js/data-passive.js(생성물 — tools/passive-web/gen.mjs saga-dungeon),
 * 찍기 규칙은 공용 엔진 passive-web.js, 화면은 passive-web-ui.js(둘 다 shared 정본, sync-shared).
 *
 *   save.passive[인물id] = { start, taken:[마디 id…] }      인물마다 한 장
 *
 * 이 판에서 정한 것
 *   · 시작점 여섯 — 직업 다섯(궁장·무장·책사·도독·방사) + 가운데 무명. 첫 점은 **그때 직업의 시작점**이나
 *     무명에만 붙는다. 무기를 바꿔 직업이 바뀌어도 그물은 인물에 남는다. 시작점 옮기기 = 전부 되돌리기
 *   · 점수 = 인물 레벨 + 보스층(3층마다) 첫 답파 수(상한 dg.pw.bossCap 30) — 무예 점수와 별개.
 *     끝까지 모으면 30 + 30 = 60 점 = 마디 409 의 약 15%(12~18% 안)
 *   · 효과 — 작은·이름난 마디의 stats 키는 dungeon.js boonVal 이 읽는 키 그대로. boonVal 이 val() 을 더한다(선두 인물)
 *   · 규칙 마디 열 — has(규칙)으로 dungeon.js 몇 곳이 묻는다. 숫자는 손잡이 dg.pw.* (core.tuned)
 *   · 되돌리기 — 던전 회차 밖에서만, 한 마디 금 레벨×dg.pw.dropGold(20). 전부 되돌리기는 찍은 수만큼
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var cache = {};

  function PW() { return global.DG.passiveWeb; }
  function def() { return global.DG.passiveDef; }
  function T(k, d) { return core.tuned ? core.tuned('dg.pw.' + k, d) : d; }

  function store(heroId) {
    var s = core.save;
    if (!s.passive) { s.passive = {}; }
    if (!s.passive[heroId]) { s.passive[heroId] = { start: null, taken: [] }; }
    return s.passive[heroId];
  }

  /** 보스층(3층마다 — data-dungeon isBossFloor) 첫 답파 수 = 최고 층 / 3 */
  function bossPoints() {
    var d = core.save.dungeon, best = (d && d.best) || 0;
    return Math.min(T('bossCap', 30), Math.floor(best / 3));
  }
  function pointsTotal(heroId) {
    var info = global.DG.hero && global.DG.hero.info(heroId);
    return Math.max(0, (info && info.lv) || 1) + bossPoints();
  }

  /** 인물의 그물 api(엔진) — 세이브 칸이 바뀌면(불러오기) 새로 만든다 */
  function api(heroId) {
    if (!heroId || !def() || !PW()) { return null; }
    var st = store(heroId), c = cache[heroId];
    if (!c || c.store !== st || c.def !== def()) {
      c = cache[heroId] = { store: st, def: def(), api: PW().make(def(), st, { points: function () { return pointsTotal(heroId); } }) };
    }
    return c.api;
  }

  function lead() { return core.save.party && core.save.party[0]; }
  /** boonVal 이 더하는 값 — 선두 인물의 그물 합 */
  function val(heroId, key) { var a = api(heroId || lead()); return a ? a.sum(key) : 0; }
  function has(rule, heroId) { var a = api(heroId || lead()); return a ? a.has(rule) : false; }

  /* ── 규칙 마디 열의 셈 — dungeon.js 는 MR().이름(…) 으로 묻기만 한다(큰 파일 줄을 안 늘리게) ── */
  /** 오행귀일 — 원소 피해 { fire: n, … } 를 가장 센 원소 하나로 모은다 */
  function elem(ed) {
    if (!has('fiveone')) { return ed; }
    var top = null, tot = 0, k;
    for (k in ed) { if (ed[k] > 0) { tot += ed[k]; if (!top || ed[k] > ed[top]) { top = k; } } }
    if (!top) { return ed; }
    var one = {}; one[top] = tot; return one;
  }
  /** 주는 피해 배율 — 일격 +30% · 독행 +25% · 역린(체력 35% 아래) +50% · 천리안(붙어서) −30% */
  function dmg(e, run, reach) {
    var m = 1;
    if (has('onecut')) { m *= 1 + T('onecut', 30) / 100; }
    if (has('lone')) { m *= 1 + T('lone', 25) / 100; }
    if (has('scale') && run && run.hp < run.hpMax * T('scaleHp', 0.35)) { m *= 1 + T('scale', 50) / 100; }
    if (has('farsight') && run && e && Math.hypot(e.x - run.player.x, e.y - run.player.y) <= reach * 1.6 + (e.r || 0)) { m *= 1 - T('farsightNear', 30) / 100; }
    return m;
  }
  /** 무심 — 기력 상한 반 · 회복 세 배 */
  function mpMax(base) { return has('mindless') ? Math.round(base * T('mindlessCap', 0.5)) : base; }
  function regen() { return has('mindless') ? T('mindlessRegen', 3) : 1; }
  /** 혈공 — 기력 1 대신 체력 몇 */
  function bloodMul() { return T('bloodMul', 0.5); }

  function classKey(heroId) { var SK = global.DG.skill; return SK ? SK.classOf(heroId).key : null; }
  /** 이 인물이 지금 고를 수 있는 시작점 — 직업 시작점과 무명 */
  function startOk(heroId, key) { return key === 'none' || key === classKey(heroId); }
  function safe() { var D = global.DG.dungeon; return !(D && D.active && D.active()); }
  function lvOf(heroId) { var info = global.DG.hero && global.DG.hero.info(heroId); return (info && info.lv) || 1; }
  function dropCost(heroId, n) { return Math.round(lvOf(heroId) * T('dropGold', 20) * (n || 1)); }

  /** 화면이 부르는 문지기 — '' 면 해도 된다 */
  function guard(heroId, action, id) {
    var a = api(heroId), nd = id ? a.node(id) : null;
    if (action === 'start' && nd && !startOk(heroId, nd.s)) {
      var SD = global.DG.skillData, cls = SD && SD.classByKey ? SD.classByKey(classKey(heroId)) : null;
      return '지금 직업' + (cls ? '(' + cls.name + ')' : '') + '의 시작점이나 무명에서만 시작한다';
    }
    if (action === 'drop' || action === 'reset') {
      if (!safe()) { return '되돌리기는 던전 밖에서만 된다'; }
      var cost = dropCost(heroId, action === 'reset' ? a.used() : 1);
      if ((core.save.player.gold || 0) < cost) { return '금이 모자란다 (' + core.fmt(cost) + '금)'; }
    }
    return '';
  }
  /** 해낸 뒤 — 되돌리기 값을 치른다(전부 되돌리기는 미리 센 값) */
  var pendingReset = 0;
  function before(heroId, action) { if (action === 'reset') { pendingReset = dropCost(heroId, api(heroId).used()); } }
  function after(heroId, action) {
    if (action === 'drop') { core.save.player.gold -= dropCost(heroId, 1); }
    if (action === 'reset') { core.save.player.gold -= pendingReset; pendingReset = 0; }
    core.emit('changed');
  }

  /** 효과 키 → [이름, 단위] — 카드·검색 글 */
  var FMT = {
    atkPct: ['공격', '%'], hpPct: ['체력', '%'], critPct: ['치명', '%p'], atkSpdPct: ['손 속도', '%'], moveSpdPct: ['이동', '%'],
    reachPct: ['사거리', '%'], guardPct: ['받는 피해 줄임', '%'], allResPct: ['모든 저항', '%'], mpRegen: ['기력 회복', '/초'],
    skillPct: ['무예 위력', '%'], drainPct: ['흡혈', '%'], goldPct: ['금', '%'], worldFindPct: ['물건 찾기', '%'], boltShotAdd: ['화살', '발'],
    swingRangePct: ['휘두르기 범위', '%'], chainHopsAdd: ['번개 튐', '번'], novaExtraRing: ['물결 고리', '겹'], echoPct: ['되풀이', '%'],
    piercePct: ['관통', '%'], dashInvulnAdd: ['돌진 무적', '초'], buffDurPct: ['버프 길이', '%'], healBonusPct: ['회복량', '%'],
    healOnFloor: ['층마다 회복', '%'], sigCdPct: ['필살 대기 줄임', '%'], sigDmgPct: ['필살 피해', '%'], summonCountAdd: ['분신', '기'],
    curseDurPct: ['저주 길이', '%'], shadowSigPct: ['그림자 필살', '%'],
  };
  function fmt(stats) {
    return Object.keys(stats || {}).map(function (k) {
      var f = FMT[k] || [k, ''], v = stats[k];
      return f[0] + ' ' + (v > 0 ? '+' : '') + v + f[1];
    }).join(' · ');
  }

  /** 무예 창의 경락 칸(ui.js 가 붙인다) — 남은 점수와 여는 단추 */
  function sheetHtml(heroId) {
    var a = api(heroId);
    if (!a) { return ''; }
    return '<div class="sec"><h4>☯ 경락(經絡)</h4><div class="card">' +
      '<div class="stat-row"><span>' + (a.start() ? '찍은 마디 ' + a.used() : '시작점 고르기 전') + '</span>' +
        '<b>남은 경락 점수 ' + a.left() + ' / ' + a.points() + '</b></div>' +
      '<small class="muted">마디 ' + def().nodes.length + '개 그물 — 찍은 마디에 이웃한 곳만 찍힙니다. ' +
        '첫 점은 지금 직업의 시작점이나 가운데 무명에. 되돌리기는 던전 밖에서 금을 냅니다.</small>' +
      '<button class="btn tiny primary wide" data-act="skill-meridian">☯ 경락도 열기</button>' +
      '</div></div>';
  }

  /** 경락도 겹창을 연다 */
  function open(heroId) {
    var UI = global.DG.passiveWebUI, a = api(heroId);
    if (!UI || !a) { return null; }
    var h = global.DG.data && global.DG.data.find(heroId);
    return UI.open(a, def(), {
      title: '☯ 경락도 — ' + (h ? h.name : ''),
      fmt: fmt,
      guard: function (action, id) { var w = guard(heroId, action, id); if (!w) { before(heroId, action); } return w; },
      after: function (action, id) { after(heroId, action, id); },
      onClose: function () { core.emit('changed'); },
    });
  }

  global.DG = global.DG || {};
  global.DG.meridian = {
    store: store, api: api, val: val, has: has, pointsTotal: pointsTotal, bossPoints: bossPoints,
    startOk: startOk, safe: safe, dropCost: dropCost, guard: guard, fmt: fmt, open: open,
    elem: elem, dmg: dmg, mpMax: mpMax, regen: regen, bloodMul: bloodMul, sheetHtml: sheetHtml,
    T: T, _reset: function () { cache = {}; },
  };
})(window);
