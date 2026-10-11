/**
 * 성채(城砦) — 원작의 체육관
 * ---------------------------------------------------------------
 * 지도 위 드문 거점이다. 다른 세력의 수비대가 지키고 있고, 동행 부대로 밀어내면
 * 내 것이 된다. 원작의 것을 같은 자리에 같은 역할로 옮겼다:
 *
 *   체육관     → 성채              방어 몬스터 → 수비대(장수 셋)
 *   팀 색깔    → 지키는 세력의 색   배틀       → 동행이 차례로 겨룬다
 *   사기(모티베이션) 감소 → 점령한 성채도 열두 시간이면 손을 뗀다
 *   포켓코인   → 공물(貢物, 금) · 하루 상한이 있는 것까지 같다
 *
 * 지키는 세력과 수비대는 **성채 키의 해시**로 뽑는다 — 같은 성채는 늘 같은 수비대다.
 * 그래서 "저 성채는 위(魏)가 지킨다"가 기억에 남고, 다시 찾아갈 이유가 된다.
 *
 * 인물의 힘은 hero.js 하나만 읽는다(그 규칙은 여기서도 지킨다).
 * 수비대는 도감 밖의 인물이라 성장이 없고, 대신 성채 등급으로 배수를 준다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;

  /** 점령이 유지되는 시간 — 원작에서 방어 몬스터의 사기가 다 떨어지는 그 자리 */
  var HOLD_MS = 12 * 60 * 60 * 1000;
  /** 공물 — 시간당 금. 하루 상한도 원작(코인 50)처럼 둔다 */
  var GOLD_PER_HOUR = 40;
  var GOLD_PER_DAY_CAP = 480;
  /** 패퇴하면 수비가 경계한다 — 그동안은 다시 도전할 수 없다 */
  var COOL_MS = 10 * 60 * 1000;

  /** 성채 등급 — 높을수록 수비대가 세다 */
  var TIERS = [
    { tier: 1, name: '보(堡)',   mul: 0.80, rarity: [1, 2, 3], feat: 30 },
    { tier: 2, name: '진(鎭)',   mul: 1.00, rarity: [2, 3, 4], feat: 55 },
    { tier: 3, name: '웅진(雄鎭)', mul: 1.25, rarity: [3, 4, 5], feat: 90 }
  ];

  /* saga-go 의 core.hash2 는 0~0.5 만 돌려준다(world.js 의 주석 참고) — 두 배로 편다 */
  function h01(a, b) { return Math.min(0.999999, core.hash2(a, b) * 2); }

  /** 세이브 칸이 없던 옛 세이브도 여기서 채운다 */
  function book() {
    if (!core.save.forts) { core.save.forts = {}; }
    return core.save.forts;
  }

  /* ── 성채의 얼굴 (해시로 정해지므로 늘 같다) ─────────────── */

  function tierOf(fort) {
    var h = h01(fort.rx * 311 + 5, fort.ry * 419 + 11);
    return TIERS[h < 0.5 ? 0 : (h < 0.85 ? 1 : 2)];
  }

  /**
   * 지키는 세력 — **그 등급의 인물을 셋 이상 가진 세력** 중에서 고른다.
   * 세력을 먼저 고르고 등급을 맞추면, 보(堡) 를 조조가 지키는 일이 생긴다
   * (세력에 낮은 등급이 없어 조건이 버려지기 때문이다). 등급이 먼저다.
   */
  function factionNameOf(fort, t) {
    t = t || tierOf(fort);
    var counts = {}, names = [], i;
    for (i = 0; i < data.heroes.length; i++) {
      var h = data.heroes[i];
      if (t.rarity.indexOf(h.rarity) < 0) { continue; }
      if (!counts[h.faction]) { counts[h.faction] = 0; names.push(h.faction); }
      counts[h.faction]++;
    }
    var usable = names.filter(function (n) { return counts[n] >= 3; });
    if (!usable.length) { usable = names; }
    if (!usable.length) { return data.heroes[0].faction; }
    usable.sort();                       // 배열 순서에 기대지 않게 — 데이터가 늘어도 같은 성채는 같은 세력
    var hv = h01(fort.rx * 733 + 19, fort.ry * 907 + 3);
    return usable[Math.min(usable.length - 1, Math.floor(hv * usable.length))];
  }

  /** 수비대 셋 — 세력 안에서 등급에 맞는 인물을 해시로 고른다 */
  function garrisonOf(fort) {
    var t = tierOf(fort);
    var fname = factionNameOf(fort, t);
    var pool = data.heroes.filter(function (h) {
      return h.faction === fname && t.rarity.indexOf(h.rarity) >= 0;
    });
    if (pool.length < 3) {
      /* 등급은 지키고 세력만 넓힌다 — 성채 등급이 먼저다 */
      pool = data.heroes.filter(function (h) { return t.rarity.indexOf(h.rarity) >= 0; });
    }
    if (!pool.length) { pool = data.heroes.slice(); }

    var out = [], used = {};
    for (var i = 0; i < 3 && out.length < pool.length; i++) {
      var idx = Math.floor(h01(fort.rx * (37 + i * 13) + i * 7 + 1,
                               fort.ry * (53 + i * 17) + i * 11 + 2) * pool.length);
      var guard = 0;
      while (used[idx] && guard < pool.length) { idx = (idx + 1) % pool.length; guard++; }
      used[idx] = true;
      out.push(pool[idx]);
    }
    return out;
  }

  /** 수비 장수 한 명의 힘 — 도감 밖이라 성장이 없고, 성채 등급이 배수를 준다 */
  function guardPower(h, t) {
    if (!h || !h.stats) { return 60; }
    var atk = h.stats.might * 0.7 + h.stats.wisdom * 0.3;
    var def = h.stats.command * 0.6 + h.stats.wisdom * 0.2;
    return Math.round((atk + def) * t.mul);
  }

  /* ── 지금 상태 ────────────────────────────────────────── */

  /**
   * 성채의 지금 상태. 지키는 세력·수비대는 늘 같고, 점령 여부만 세이브를 탄다.
   * @returns {{fort, tier, faction, factionName, guards, mine, leftMs, moralePct, coolLeft, pending}}
   */
  function infoOf(fort) {
    var t = tierOf(fort);
    var fname = factionNameOf(fort, t);
    var rec = book()[fort.key];
    var now = Date.now();
    var mine = !!(rec && rec.at && now - rec.at < HOLD_MS);
    var leftMs = mine ? (rec.at + HOLD_MS - now) : 0;
    return {
      fort: fort,
      tier: t,
      factionName: fname,
      faction: data.faction(fname),
      guards: garrisonOf(fort),
      mine: mine,
      leftMs: leftMs,
      moralePct: mine ? Math.round(leftMs / HOLD_MS * 100) : 0,
      coolLeft: rec && rec.cool ? Math.max(0, rec.cool - now) : 0,
      pending: mine ? tributeOf(fort) : 0
    };
  }

  /** 아직 안 걷은 공물 (금) */
  function tributeOf(fort) {
    var rec = book()[fort.key];
    if (!rec || !rec.at) { return 0; }
    var now = Date.now();
    var end = Math.min(now, rec.at + HOLD_MS);
    var from = rec.coll || rec.at;
    if (end <= from) { return 0; }
    var gold = Math.floor((end - from) / 3600000 * GOLD_PER_HOUR);
    var today = rec.day === dayKey() ? (rec.dayGold || 0) : 0;
    return Math.max(0, Math.min(gold, GOLD_PER_DAY_CAP - today));
  }

  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /** 쌓인 공물을 걷는다 */
  function collect(fort) {
    var rec = book()[fort.key];
    if (!rec || !rec.at) { return 0; }
    var gold = tributeOf(fort);
    if (gold <= 0) { return 0; }
    core.save.player.gold += gold;
    rec.coll = Date.now();
    if (rec.day !== dayKey()) { rec.day = dayKey(); rec.dayGold = 0; }
    rec.dayGold = (rec.dayGold || 0) + gold;
    core.log('🏯 ' + fort.name + ' 공물 — 🪙 +' + gold, 'good');
    core.emit('changed');
    return gold;
  }

  /* ── 도전 ─────────────────────────────────────────────── */

  /**
   * 한 판 겨룬다. 강한 쪽이 확실히 유리하되 뒤집힐 여지는 남긴다.
   * (등용의 어필, 포획의 타이밍처럼 이 판의 미니게임도 확률이 규칙이다)
   */
  function duel(myId, guard, t, mul) {
    var mine = global.DG.hero.power(myId);
    var theirs = guardPower(guard, t);
    var a = Math.pow(Math.max(1, mine), 1.25) * (mul || 1);
    var b = Math.pow(Math.max(1, theirs), 1.25);
    return { win: Math.random() < a / (a + b), mine: mine, theirs: theirs };
  }

  /**
   * 성채에 도전한다. 동행이 차례로 나가 수비 셋을 밀어내면 점령이다.
   *
   * `opts` 를 **주지 않으면 예전과 똑같이** 돈다(자동 순행·자가진단이 그 길이다).
   * 손으로 교전(`js/duel.js`)을 치르고 왔으면 그 성과가 배율로 얹힌다 — 잘 때리고
   * 잘 피했으면 동행이 그만큼 유리하게 붙는다. 원작에서 체육관 전투를 잘 하면
   * 수비를 더 빨리 밀어내는 것과 같은 뜻이다.
   *
   * @param {{live:boolean, score:number}} [opts] 교전 성과
   * @returns {{ok:boolean, reason?:string, win?:boolean, rounds?:Array, reward?:object}}
   */
  function challenge(fort, opts) {
    var info = infoOf(fort);
    if (info.mine) { return { ok: false, reason: 'mine' }; }
    if (info.coolLeft > 0) { return { ok: false, reason: 'cool', left: info.coolLeft }; }
    var party = core.save.party.slice();
    if (!party.length) { return { ok: false, reason: 'noparty' }; }

    /* 교전을 치르고 왔으면 그 성과가 배율이 된다 (0.65 ~ 1.45) */
    var mul = 1;
    if (opts && opts.live) { mul = 0.65 + core.clamp(opts.score, 0, 1.6) * 0.5; }

    var rounds = [], mi = 0, gi = 0;
    while (mi < party.length && gi < info.guards.length) {
      var me = data.find(party[mi]);
      var foe = info.guards[gi];
      var r = duel(party[mi], foe, info.tier, mul);
      rounds.push({
        me: me ? me.name : party[mi], foe: foe.name,
        win: r.win, minePow: r.mine, foePow: r.theirs
      });
      if (r.win) { gi++; } else { mi++; }
    }

    var win = gi >= info.guards.length;
    var rec = book()[fort.key] || (book()[fort.key] = {});
    if (win) {
      rec.at = Date.now();
      rec.coll = Date.now();
      delete rec.cool;
      var feat = info.tier.feat;
      core.gainFeat(feat, '점령');
      var exp = core.gainExp(feat);
      var fame = info.tier.tier * 25;
      core.save.player.fame += fame;
      global.DG.hero.awardParty(info.tier.tier * 6);
      var p = core.save.player;
      p.fortTaken = (p.fortTaken || 0) + 1;
      if (global.DG.quest) { global.DG.quest.progress('fort', 1); }
      core.log('🏯 ' + fort.name + ' 점령! (' + info.factionName + ' 수비대를 물렸다)', 'good');
      var back = global.DG.drop ? global.DG.drop.win() : null;   // 떨어진 짐 회수(⑧)
      core.emit('changed');
      return { ok: true, win: true, rounds: rounds, info: info,
        reward: { feat: feat, exp: exp, fame: fame }, recovered: back };
    }
    rec.cool = Date.now() + COOL_MS;
    var exp2 = core.gainExp(Math.round(info.tier.feat / 4));
    core.log('🏯 ' + fort.name + ' 공략 실패 — ' + info.factionName + ' 수비대가 버텼다', 'bad');
    var lost = (opts && opts.live && global.DG.drop) ? global.DG.drop.lose() : null;   // 패배 비용(⑧) — 손으로 진 판만
    core.emit('changed');
    return { ok: true, win: false, rounds: rounds, info: info, reward: { exp: exp2 }, drop: lost };
  }

  /* ── 매 프레임 ────────────────────────────────────────── */

  /**
   * 사기가 다 떨어진 성채에서 손을 뗀다. 남은 공물은 그때 알아서 걷어 준다
   * (원작에서 몬스터가 돌아오며 모은 코인을 주는 자리).
   */
  function tick() {
    var b = book(), now = Date.now(), lost = 0, k;
    for (k in b) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) { continue; }
      var rec = b[k];
      if (rec.at && now - rec.at >= HOLD_MS) {
        var gold = tributeOf({ key: k });
        if (gold > 0) { core.save.player.gold += gold; }
        core.log('🏯 성채에서 손을 뗐다 (사기 소진)' + (gold ? ' — 남은 공물 🪙 +' + gold : ''), 'info');
        delete b[k];
        lost++;
      } else if (!rec.at && rec.cool && rec.cool < now) {
        delete b[k];                       // 다 식은 재도전 기록은 지운다
      }
    }
    if (lost) { core.emit('changed'); core.persist(); }
    return lost;
  }

  /* ── 화면 ─────────────────────────────────────────────── */

  var showing = false;
  var cur = null;

  function host() { return document.getElementById('encounter'); }

  function close() {
    showing = false; cur = null;
    var el = host();
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    core.emit('changed');
  }

  function leftLabel(ms) {
    var m = Math.ceil(ms / 60000);
    if (m >= 60) { return Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; }
    return m + '분';
  }

  function guardRow(g, t) {
    return '<div class="pcard"><div class="stat-row">' +
      '<span>' + g.emoji + ' ' + g.name + '</span>' +
      '<b>' + guardPower(g, t) + '</b></div></div>';
  }

  function render() {
    var el = host();
    if (!el || !cur) { return; }
    var info = infoOf(cur);
    var pw = global.DG.hero.partyPower();
    var body;

    /* 적장이 들어 있으면 그것이 먼저다 — 원작에서 레이드가 체육관을 덮는 자리 */
    var R = global.DG.raid;
    var raid = R ? R.current(cur) : null;
    if (raid) {
      var tried = R.triedOf(raid);
      var pass = R.passCount();
      el.innerHTML = '<div class="enc-card">' +
        '<div class="enc-big">' + global.DG.portrait3d.img('hero', raid.hero, 96) + '</div>' +
        '<h3>⚔️ ' + raid.tier.name + ' — ' + raid.hero.name + '</h3>' +
        '<p class="quote">"' + raid.hero.quote + '"</p>' +
        '<div class="enc-reward">기세 ' + core.fmt(raid.hp) + ' · 내 부대 ' + pw.atk +
          ' · ' + R.leftLabel(raid.leftMs) + ' 뒤 물러간다</div>' +
        '<div class="enc-reward">📜 격문 ' + pass + '장 · 이기면 등용 기회 ' +
          Math.round(raid.tier.catch * 100) + '%</div>' +
        (tried
          ? '<small class="muted">이 판에는 이미 도전했습니다 — 다음 판을 기다리세요.</small>'
          : (pass > 0
              ? '<div class="enc-hint">속공을 연타하고, 기(氣)가 차면 <b>필살</b> — <b>강타 예고</b>엔 회피.</div>' +
              '<button class="btn primary wide" data-act="raid">⚔️ 격문을 쓰고 붙는다</button>'
              : '<small class="muted">격문이 없습니다 — 하루 한 장은 그냥 들어옵니다.</small>')) +
        '<button class="btn ghost wide" data-act="ok">물러난다</button>' +
      '</div>';
      bind();
      return;
    }

    if (info.mine) {
      body =
        '<h3>🏯 ' + cur.name + ' · 내 것</h3>' +
        '<p class="quote">"성문은 우리 손에 있습니다."</p>' +
        '<div class="bar blue"><i style="width:' + info.moralePct + '%"></i></div>' +
        '<div class="enc-reward">사기 ' + info.moralePct + '% · ' +
          leftLabel(info.leftMs) + ' 뒤 손을 뗍니다</div>' +
        '<div class="enc-reward">쌓인 공물 🪙 ' + info.pending + '</div>' +
        (info.pending > 0
          ? '<button class="btn primary wide" data-act="collect">공물을 걷는다</button>'
          : '<small class="muted">시간이 지나면 공물이 쌓입니다 (시간당 ' + GOLD_PER_HOUR + '금)</small>') +
        '<button class="btn ghost wide" data-act="ok">닫는다</button>';
    } else {
      var guards = '', gsum = 0;
      for (var i = 0; i < info.guards.length; i++) {
        guards += guardRow(info.guards[i], info.tier);
        gsum += guardPower(info.guards[i], info.tier);
      }
      body =
        '<h3>🏯 ' + cur.name + '</h3>' +
        '<p class="quote" style="color:' + info.faction.color + '">' +
          info.faction.mark + ' ' + info.factionName + ' 수비대 · ' + info.tier.name + '</p>' +
        '<div class="plist">' + guards + '</div>' +
        '<div class="enc-reward">수비대 합 ' + gsum + ' · 내 부대 ' + pw.total + '</div>' +
        (info.coolLeft > 0
          ? '<small class="muted">수비가 경계하고 있습니다 — ' + leftLabel(info.coolLeft) + ' 뒤에 다시 올 수 있습니다</small>'
          : '<div class="enc-hint">속공을 연타하고, 기(氣)가 차면 <b>필살</b> — <b>강타 예고</b>엔 회피.</div>' +
            '<button class="btn primary wide" data-act="fight">🏯 성문을 두드린다</button>') +
        '<button class="btn ghost wide" data-act="ok">돌아간다</button>';
    }
    el.innerHTML = '<div class="enc-card">' + body + '</div>';
    bind();
  }

  /** 패배 비용(⑧) — 졌으면 떨어뜨린 짐, 이겼으면 되찾은 짐 한 줄 */
  function dropLine(res) {
    var D = global.DG.drop;
    return D ? (res.win ? D.backLine(res.recovered) : D.cardLine(res.drop)) : '';
  }

  function renderResult(res, p) {
    var el = host();
    if (!el) { return; }
    el.classList.add('show');
    var lines = '';
    for (var i = 0; i < res.rounds.length; i++) {
      var r = res.rounds[i];
      lines += '<div class="stat-row"><span>' + r.me + ' ↔ ' + r.foe + '</span>' +
        '<b style="color:' + (r.win ? '#5ec26a' : '#e06565') + '">' +
        (r.win ? '이겼다' : '밀렸다') + '</b></div>';
    }
    el.innerHTML = '<div class="enc-card result ' + (res.win ? 'good' : 'bad') + '">' +
      '<h3>' + (res.win ? '🏯 ' + cur.name + ' 점령!' : '🏯 성문을 열지 못했다') + '</h3>' +
      '<div class="bstate">' + lines + '</div>' +
      '<div class="enc-reward">' +
        (res.win
          ? '공적 +' + res.reward.feat + ' · 경험치 +' + res.reward.exp + ' · 명성 +' + res.reward.fame
          : '경험치 +' + res.reward.exp + ' · 수비가 ' + leftLabel(COOL_MS) + ' 경계합니다') +
      '</div>' + dropLine(res) + perfLine(p) +
      '<button class="btn primary wide" data-act="ok">확인</button>';
    bind();
  }

  /** 토벌 결과 — 몇 합에 꺾었는지, 등용까지 됐는지 */
  function renderRaidResult(res, p) {
    var el = host();
    if (!el) { return; }
    el.classList.add('show');
    var r = res.raid;
    var lines = '';
    for (var i = 0; i < res.rounds.length; i++) {
      lines += '<div class="stat-row"><span>' + res.rounds[i].n + '합</span>' +
        '<b>-' + core.fmt(res.rounds[i].dmg) + '</b>' +
        '<span class="muted">남은 기세 ' + core.fmt(res.rounds[i].left) + '</span></div>';
    }
    el.innerHTML = '<div class="enc-card result ' + (res.win ? 'good' : 'bad') + '">' +
      '<h3>' + (res.win
        ? '⚔️ ' + r.hero.name + ' 격파!' + (res.caught ? ' 그리고 등용!' : '')
        : '⚔️ ' + r.hero.name + ' 을(를) 꺾지 못했다') + '</h3>' +
      '<div class="bstate">' + lines + '</div>' +
      '<div class="enc-reward">' +
        (res.win
          ? '공적 +' + res.reward.feat + ' · 금 +' + res.reward.gold +
            ' · 경험치 +' + res.reward.exp +
            (res.caught ? '' : ' · 등용 실패(' + Math.round(res.chance * 100) + '%)')
          : '남은 기세 ' + core.fmt(res.left) + ' · 격문 한 장을 썼다') +
      '</div>' + dropLine(res) + perfLine(p) +
      '<button class="btn primary wide" data-act="ok">확인</button>';
    bind();
  }

  /* ── 교전을 거쳐 붙는다 (원작의 탭 전투) ─────────────────
   * 여태 이 자리는 버튼 한 번에 수치가 다 계산되고 결과만 떴다. 이제 손으로
   * 치른다 — 속공을 연타하고, 기가 차면 필살을 지르고, 강타 예고에 피한다.
   * 교전이 끝나면 그 성과를 판정(`fight`·`challenge`)에 넘긴다.
   *
   * `js/duel.js` 가 없으면 예전처럼 즉시 판정한다. 스크립트 하나가 빠졌다고
   * 성채와 토벌이 통째로 멈추면 안 된다.
   */

  function startRaidDuel() {
    var R = global.DG.raid;
    var raid = R ? R.current(cur) : null;
    if (!raid) { render(); return; }
    var D = global.DG.rogueAction || global.DG.duel;
    if (!D) { finishRaid(R.fight(raid)); return; }
    var pw = global.DG.hero.partyPower();
    /* rogueAction(도적전과 같은 실시간 위치 사냥식 실시간 전투)은 duel.js와
       달리 별도 화면(#rogue-hud)을 쓴다 — 이 카드(#encounter)는 스스로
       숨지 않으므로 직접 숨기고, 결과 화면(renderRaidResult)이 다시 켠다
       (`rogue.js`의 `startDuel()`과 같은 손). */
    var el = host();
    if (el) { el.classList.remove('show'); }
    D.open({
      title: '⚔️ 토벌 — ' + raid.tier.name,
      foeName: raid.hero.name,
      stage3d: { kind: 'hero', ref: raid.hero },
      foeHp: raid.hp, myAtk: pw.atk * (global.DG.starchart ? global.DG.starchart.raidAtk() : 1), myDef: pw.def * (global.DG.starchart ? global.DG.starchart.raidDef() : 1),   // × 성도(W-0181)
      /* PLAN §5 ③ — 75초 고정, 부위 3(갑주·병장·기마)·저스트 회피는
         `rogueAction`가 `raid:true` 일 때만 켠다(§10-Q2 "토벌만 적용",
         성채 수비대 쪽 `startFortDuel()`은 그대로 둔다) */
      timeSec: (global.DG.starchart ? global.DG.starchart.raidSec(75) : 75), raid: true,   // 속전(성도 규칙)이면 45
      onDone: function (p) {
        /* 한 대도 못 때리고 물러났으면 격문을 쓰지 않는다 */
        if (p.fled && p.dealt <= 0) {
          var el2 = host();
          if (el2) { el2.classList.add('show'); }
          render();
          return;
        }
        finishRaid(R.fight(raid, { live: true, dealt: p.dealt, folded: p.folded, parts: p.parts }), p);
      }
    });
  }

  function finishRaid(rr, p) {
    if (!rr || !rr.ok) { render(); return; }
    renderRaidResult(rr, p);
  }

  function startFortDuel() {
    var info = infoOf(cur);
    var D = global.DG.rogueAction || global.DG.duel;
    if (!D) { finishFort(challenge(cur)); return; }
    var pw = global.DG.hero.partyPower();
    var gsum = 0, i;
    for (i = 0; i < info.guards.length; i++) { gsum += guardPower(info.guards[i], info.tier); }
    /* rogueAction은 duel.js와 달리 별도 화면(#rogue-hud)을 쓴다 — 이 카드는
       스스로 숨지 않으므로 직접 숨기고, 결과 화면(renderResult)이 다시 켠다. */
    var el0 = host();
    if (el0) { el0.classList.remove('show'); }
    D.open({
      title: '🏯 성채 공략 — ' + cur.name,
      foeName: info.factionName + ' 수비대 ' + info.guards.length + '명',
      emoji: info.faction.mark || '🛡️',
      /* 세워 둘 몸은 수비대 중 하나(대표 격)를 쓴다 — 진짜로 셋 다 세우려면
         `duelStage` 가 여럿을 받게 고쳐야 하는데, 그건 이 문제와 상관없는
         더 큰 손질이라 미룬다 */
      stage3d: info.guards[0] ? { kind: 'hero', ref: info.guards[0] } : null,
      foeHp: Math.max(1, gsum * 8), myAtk: pw.atk, myDef: pw.def,
      onDone: function (p) {
        if (p.fled && p.dealt <= 0) {
          var el1 = host();
          if (el1) { el1.classList.add('show'); }
          render();
          return;
        }
        finishFort(challenge(cur, { live: true, score: p.score }), p);
      }
    });
  }

  function finishFort(res, p) {
    if (!res || !res.ok) { render(); return; }
    renderResult(res, p);
    core.persist();
  }

  /** 교전 실적 한 줄 — 결과 화면 아래에 붙는다 */
  function perfLine(p) {
    if (!p) { return ''; }
    return '<div class="enc-reward">교전 · 속공 ' + p.hits + '회 · 필살 ' + p.ults +
      '회 · 회피 ' + p.dodgeOk + '/' + p.dodgeTry +
      ' · 받은 피해 ' + core.fmt(p.taken) +
      (p.fled ? ' · <b class="warn">물러났다</b>' : '') + '</div>';
  }

  function bind() {
    var el = host();
    if (!el) { return; }
    var b = el.querySelectorAll('[data-act]');
    for (var i = 0; i < b.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
          if (act === 'ok') { close(); return; }
          if (act === 'collect') { collect(cur); render(); return; }
          if (act === 'raid') { startRaidDuel(); return; }
          if (act === 'fight') { startFortDuel(); return; }
        });
      })(b[i]);
    }
  }

  function open(fort) {
    if (global.DG.encounter && global.DG.encounter.active) { return; }
    cur = fort;
    showing = true;
    var el = host();
    if (!el) { return; }
    el.classList.add('show');
    render();
  }

  /**
   * 자동 순행이 부르는 문 — 화면 없이 도전하거나 공물만 걷는다.
   * @returns {{did:string, win?:boolean, gold?:number}|null}
   */
  function autoAct(fort) {
    var info = infoOf(fort);
    if (info.mine) {
      var g = collect(fort);
      return g > 0 ? { did: 'collect', gold: g } : null;
    }
    if (info.coolLeft > 0) { return null; }
    /* 이길 가망이 없으면 굳이 부딪히지 않는다 — 패퇴는 열 분을 잃는다 */
    var need = 0;
    for (var i = 0; i < info.guards.length; i++) { need += guardPower(info.guards[i], info.tier); }
    if (global.DG.hero.partyPower().total < need * 0.75) { return null; }
    var res = challenge(fort);
    if (!res.ok) { return null; }
    return { did: 'fight', win: res.win };
  }

  core.on('fort:request', function (f) { open(f); });

  global.DG = global.DG || {};
  global.DG.fort = {
    HOLD_MS: HOLD_MS, COOL_MS: COOL_MS, GOLD_PER_HOUR: GOLD_PER_HOUR,
    TIERS: TIERS,
    tierOf: tierOf, factionNameOf: factionNameOf, garrisonOf: garrisonOf,
    guardPower: guardPower,
    infoOf: infoOf, tributeOf: tributeOf, collect: collect,
    challenge: challenge, autoAct: autoAct, tick: tick,
    open: open, close: close,
    get showing() { return showing; }
  };
})(window);
