/**
 * 택배 사슬 — 다른 마을을 잇는 이유 (PLAN §5.7)
 * ---------------------------------------------------------------
 * 택배 접수대에서 소포를 **셋 중 하나** 고른다(표준 D 의 첫 적용). 셋은 서로 다른 축이다:
 *   📦 보통      조심할 게 없다
 *   🥚 깨지기    살금살금 걸어야 한다(그냥 걸은 지 2초가 넘으면 깨져 보상이 절반이 된다). 안 깨지면 ×1.6
 *   ⏱️ 시간제한  시한(거리에 비례) 안에 가져다 줘야 한다. 늦으면 ×0.7, 제때면 ×1.5
 * 카드마다 목적지가 다르다(갈 수 있는 곳이 셋 이상이면 겹치지 않는다): 우주기지·폐허의 옛 우체통·작은 마을·외딴집.
 * 기본 🪙220 에 거리 +🪙2/타일, 연속 3배달부터 ×1.5(깨지거나 늦으면 사슬이 끊긴다).
 * 누적 10건 수레 · 30건 우주복 · 60건 로버 — 세이브는 늘리지 않고 누적 건수(s.delivery.n)에서 읽는다.
 *
 * 세이브 s.delivery = { carrying, n, kind, dest, since, chain, broken } — 옛 두 칸(carrying·n)은 그대로다.
 * 옛 세이브의 소포(kind·dest 없음)는 보통 소포·우주기지행으로 읽는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }

  var ORDER = ['space', 'ruin', 'hamlet', 'hamlet2'];
  var KINDS = ['plain', 'fragile', 'timed'];
  var NPC_DEST = { courier: 'space', merchant: 'hamlet', wanderer: 'hamlet2' };
  var BASE = core.tuned('delivery.reward', 220);
  var PER_TILE = core.tuned('delivery.perTile', 2);
  var CHAIN_AT = 3, CHAIN_MUL = 1.5;
  var TIMED_BASE = core.tuned('delivery.timedBase', 30), TIMED_PER_TILE = core.tuned('delivery.timedPerTile', 0.5);

  var rough = 0;                    // 깨지기 소포를 들고 그냥 걸은 초(저장하지 않는다 — 다시 받으면 0)

  /* ── 자리 ─────────────────────────────────────────────── */

  function spotOf(key) {
    var v = V();
    return key === 'space' ? v.spaceBaseSpot() : key === 'ruin' ? v.ruinSpot()
         : key === 'hamlet' ? v.hamletSpot() : key === 'hamlet2' ? v.hamlet2Spot() : null;
  }
  /** 접수대 자리(타일) — village.js buildProps 가 (cx+3, cy+1) 에 세운다 */
  function origin() { var v = V(); return { tx: Math.floor(v.W * 0.5) + 3, ty: Math.floor(v.H * 0.5) + 1 }; }

  /** 지금 갈 수 있는 목적지 — 링이 좁아 없는 곳은 빠진다 */
  function dests() {
    var o = origin(), out = [];
    ORDER.forEach(function (k) {
      var sp = spotOf(k);
      if (sp) { out.push({ key: k, name: VD().DELIVERY_DESTS[k].name, tx: sp.tx, ty: sp.ty, dist: Math.round(Math.hypot(sp.tx - o.tx, sp.ty - o.ty)) }); }
    });
    return out;
  }
  function destInfo(key) {
    var list = dests(), i;
    for (i = 0; i < list.length; i++) { if (list[i].key === key) { return list[i]; } }
    return null;
  }

  /* ── 값 ───────────────────────────────────────────────── */

  function limitSec(dist) { return Math.round(TIMED_BASE + TIMED_PER_TILE * dist); }

  /** 보상 — opt: { broken, late, chain(이번 배달을 셈에 넣은 연속 수) } */
  function quote(kind, destKey, opt) {
    opt = opt || {};
    var d = destInfo(destKey), k = VD().PARCEL_KINDS[kind];
    if (!d || !k) { return 0; }
    var mul = k.mul;
    if (kind === 'fragile' && opt.broken) { mul = k.brokenMul; }
    if (kind === 'timed' && opt.late) { mul = k.lateMul; }
    return Math.round((BASE + PER_TILE * d.dist) * mul * ((opt.chain || 0) >= CHAIN_AT ? CHAIN_MUL : 1));
  }

  /* ── 세이브 ───────────────────────────────────────────── */

  function rec() {
    var s = V().state();
    if (!s.delivery) { s.delivery = { carrying: false, n: 0 }; }
    return s.delivery;
  }

  /** 접수대가 내놓는 카드 셋 — 날짜와 누적 건수로 정해져 새로고침해도 같다 */
  function offers() {
    var D = dests(), s = V().state(), d = rec();
    if (!D.length) { return []; }
    var rot = Math.floor(core.hash2(s.day * 7 + (d.n || 0), s.seed % 97 + 3) * D.length) % D.length;
    return KINDS.map(function (k, i) {
      var dest = D[(rot + i) % D.length];
      return { kind: k, dest: dest.key, destName: dest.name, dist: dest.dist,
               reward: quote(k, dest.key, { chain: (d.chain || 0) + 1 }),
               limit: k === 'timed' ? limitSec(dest.dist) : null };
    });
  }

  /** 접수대에서 소포를 받는다. 인자가 없으면 보통 소포·우주기지행(옛 흐름) */
  function take(kind, destKey) {
    var d = rec();
    if (d.carrying) { return { kind: 'no', text: '이미 소포를 갖고 있습니다 — 먼저 가져다 주세요' }; }
    kind = kind || 'plain'; destKey = destKey || 'space';
    if (!VD().PARCEL_KINDS[kind] || !destInfo(destKey)) { return { kind: 'no', text: '그 소포는 받을 수 없습니다' }; }
    d.carrying = true; d.kind = kind; d.dest = destKey; d.since = Date.now(); d.broken = false;
    rough = 0;
    var dn = VD().DELIVERY_DESTS[destKey].name, pk = VD().PARCEL_KINDS[kind];
    core.emit('changed');
    core.persist();
    return { kind: 'talk', name: '택배 접수대',
      text: pk.emoji + ' ' + pk.name + ' — ' + dn + ' 로 가져다 주자' + (kind === 'timed' ? ' (시한 ' + limitSec(destInfo(destKey).dist) + '초)' : '') };
  }

  /* ── 거동 ─────────────────────────────────────────────── */

  /** 매 프레임(village.update, 집 밖) — 깨지기 소포를 들고 그냥 걷는 시간을 잰다 */
  function tick(dt) {
    var d = V().state().delivery;
    if (!d || !d.carrying || d.kind !== 'fragile' || d.broken) { return; }
    var v = V();
    if (!v.raw().player.walking || v.sneaking()) { return; }
    rough += dt;
    if (rough >= VD().PARCEL_KINDS.fragile.grace) {
      d.broken = true;
      core.log('🥚 소포가 덜컹거려 깨져 버렸다 — 보상이 줄어든다', 'bad');
      core.emit('toast', '🥚 소포가 깨졌다! 살금살금 걸어야 했다');
      core.emit('changed');
      core.persist();
    }
  }

  /* ── 배달 ─────────────────────────────────────────────── */

  function grade() {
    var n = rec().n || 0, g = 0;
    VD().DELIVERY_GRADES.forEach(function (x) { if (n >= x.at) { g++; } });
    return g;
  }

  function isLate(d) {
    return d.kind === 'timed' && (Date.now() - (d.since || 0)) / 1000 > limitSec((destInfo(d.dest) || { dist: 0 }).dist);
  }

  /** 받는 사람에게 소포를 건넨다 — destKey 는 이 자리의 목적지, who 는 받는 이 이름 */
  function deliver(destKey, who) {
    var d = rec();
    if (!d.carrying) { return null; }
    var kind = d.kind || 'plain', dest = d.dest || 'space';
    if (dest !== destKey) {
      return { kind: 'no', name: who, text: '이 소포는 ' + VD().DELIVERY_DESTS[dest].name + ' 행이라네' };
    }
    var broken = kind === 'fragile' && !!d.broken, late = isLate(d), ok = !broken && !late;
    var chain = ok ? (d.chain || 0) + 1 : 0;
    var reward = quote(kind, dest, { broken: broken, late: late, chain: chain });
    var g0 = grade();
    d.carrying = false; d.n = (d.n || 0) + 1; d.chain = chain; d.broken = false;
    rough = 0;
    core.save.player.gold += reward;
    core.gainFeat(1, '배달');
    core.gainExp(10);
    var tag = broken ? ' (깨져서 절반)' : late ? ' (늦었다)' : chain >= CHAIN_AT ? ' (연속 ' + chain + '건 ×' + CHAIN_MUL + ')' : '';
    core.log('📦 ' + who + '에게 소포를 전했다 — 🪙 ' + core.fmt(reward) + tag + ' (누적 ' + d.n + '건)', 'good');
    var text = '소포 잘 받았네! 🪙 ' + core.fmt(reward) + tag + ' (누적 ' + d.n + '건)';
    var g1 = grade();
    if (g1 > g0) {
      var gr = VD().DELIVERY_GRADES[g1 - 1];
      text += ' · 🎖️ 배달 ' + gr.name + ' 등급 — ' + gr.note + (gr.line ? ' · ' + gr.line : '');       // 정본 side_parcel_* — 등급마다 달음 한 줄
      core.log('🎖️ 배달 ' + gr.name + ' 등급 — ' + gr.note, 'good');
      if (gr.line) { core.log('📦 ' + gr.line, 'good'); }
      V().buildProps();          // 수레·로버가 서거나 손이 닿게 된다
    }
    core.emit('village:delivered', { dest: dest, kind: kind, reward: reward, chain: chain, broken: broken, late: late });
    V().checkTasks();
    core.emit('changed');
    core.persist();
    return { kind: 'quest', name: who, text: text, reward: reward };
  }

  /** NPC(배달원·상인·나그네)가 소포를 받을 차례인가 — 맞으면 건네고 결과를, 아니면 null */
  function deliverToNpc(npc, who) {
    var dest = NPC_DEST[npc.kind], d = rec();
    if (!dest || !d.carrying) { return null; }
    if ((d.dest || 'space') !== dest) { return null; }
    return deliver(dest, who);
  }

  /* ── 화면이 읽는 것 ───────────────────────────────────── */

  function status() {
    var d = rec(), n = d.n || 0, next = null, i, G = VD().DELIVERY_GRADES;
    for (i = 0; i < G.length; i++) { if (n < G[i].at) { next = G[i]; break; } }
    var kind = d.kind || 'plain', dest = d.dest || 'space', di = destInfo(dest);
    return {
      carrying: !!d.carrying, n: n, chain: d.chain || 0, grade: grade(), next: next,
      kind: d.carrying ? kind : null, dest: d.carrying ? dest : null,
      destName: d.carrying && VD().DELIVERY_DESTS[dest] ? VD().DELIVERY_DESTS[dest].name : '',
      broken: !!d.broken,
      deadline: d.carrying && kind === 'timed' && di ? (d.since || 0) + limitSec(di.dist) * 1000 : null
    };
  }

  global.DG = global.DG || {};
  global.DG.parcel = {
    ORDER: ORDER, KINDS: KINDS, NPC_DEST: NPC_DEST, CHAIN_AT: CHAIN_AT, CHAIN_MUL: CHAIN_MUL, BASE: BASE, PER_TILE: PER_TILE,
    dests: dests, offers: offers, quote: quote, limitSec: limitSec, grade: grade, status: status,
    /* 세이브가 바뀌는 곳은 여기 셋 */
    take: take, deliver: deliver, deliverToNpc: deliverToNpc, tick: tick,
    _resetForTest: function () { rough = 0; }
  };
})(window);
