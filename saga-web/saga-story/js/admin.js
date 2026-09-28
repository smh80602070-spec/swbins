/**
 * 어드민 — QA 운영판 (`_admin.html` 이 부른다)
 * ---------------------------------------------------------------
 * 게임을 켜지 않고 **세이브와 손잡이만** 다룬다. 그림도 루프도 없다.
 * 사가고·사가의숲의 어드민과 같은 결이고, 손잡이 층(`core.tuned`)도 같은 이름이다.
 *
 *   세이브   재화·성장·선두 인물·진행 비우기
 *   사냥터   열린 곳 · 보스 리젠 시계 · 적 세기 미리보기
 *   장비     한 벌 갖추기 · 주문서 · 가방 · 탕약
 *   직업     전직(되돌리기 포함) · 무예 · 조작 띠
 *   사명     받기 · 채우기 · 비우기
 *   손잡이   규칙 상수 (side.js·gear.js 의 core.tuned 가 읽는다)
 *   프리셋   확인하려는 상황을 한 번에 만든다 + 스냅샷 세 칸
 *
 * **이 판에서 가장 값진 탭은 '손잡이' 의 물리 셋이다** — 사이드스크롤은 손맛이 곧
 * 게임이라, 중력·점프·달리기를 눌러 두고 곧바로 뛰어 보는 것이 검증이다.
 *
 * 고친 뒤에는 `core.POKE_KEY` 를 두드린다. 게임 창이 열려 있으면 그것을 보고
 * 세이브를 다시 읽는다 — 게임이 틈틈이 저장하므로, 안 그러면 곧 덮인다.
 *
 * **되돌릴 수 없는 것을 되돌린다.** 게임에서 전직은 되돌릴 수 없지만 여기서는 바꾼다 —
 * 어드민의 몫은 "그 상황으로 곧장 가는 것" 이지 규칙을 지키는 것이 아니다.
 * 규칙은 게임 쪽에 그대로 남아 있다(`job.canJoin` 은 한 줄도 안 건드렸다).
 */
(function (global) {
  'use strict';

  var DG = global.DG;
  var C = DG.core, A = DG.account, D = DG.data, H = DG.hero;
  var S = DG.side, SD = DG.sideData;
  var G = DG.gear, GD = DG.gearData;
  var J = DG.job, JD = DG.jobData;
  var Q = DG.quest, QD = DG.questData;

  /* ── 잔손 ─────────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html !== undefined) { n.innerHTML = html; }
    return n;
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var logT = null;
  function say(msg) {
    var b = $('log');
    b.textContent = msg;
    b.classList.add('show');
    if (logT) { clearTimeout(logT); }
    logT = setTimeout(function () { b.classList.remove('show'); }, 2600);
  }

  /** 숫자 칸 하나 — 읽고(get) 쓰는(set) 짝을 받는다 */
  function numField(host, label, get, set, step) {
    var f = el('div', 'fld');
    f.appendChild(el('label', null, label));
    var i = el('input');
    i.type = 'number';
    if (step) { i.step = step; }
    i.value = get();
    i.addEventListener('change', function () {
      var v = Number(i.value);
      set(isFinite(v) ? v : 0);
      renderAll();
    });
    f.appendChild(i);
    host.appendChild(f);
    return i;
  }

  function btn(host, label, cls, fn) {
    var b = el('button', cls, label);
    b.addEventListener('click', fn);
    host.appendChild(b);
    return b;
  }

  /* ── 프로필 ───────────────────────────────────────── */

  function profiles() {
    var l = A.list();
    if (!l.length) { l = [{ id: 'v1', name: '(가입 전 세이브)' }]; }
    return l;
  }
  function keyFor(id) { return id === 'v1' ? (C.SAVE_BASE + '/v1') : A.keyOf(id); }

  function fillProfiles() {
    var sel = $('prof');
    sel.innerHTML = '';
    profiles().forEach(function (p) {
      var o = el('option');
      o.value = p.id; o.textContent = p.name + ' (' + p.id + ')';
      sel.appendChild(o);
    });
    var cur = A.current();
    if (cur) { sel.value = cur.id; }
    openProfile(sel.value);
  }

  function openProfile(id) {
    C.setSaveKey(keyFor(id));
    var ok = C.load();
    /* 사명 표를 세운다 — 게임의 부트와 같은 차례다 */
    try { Q.init(); } catch (e) { /* 사명이 없어도 나머지는 본다 */ }
    say(ok ? '프로필을 읽었습니다 · ' + C.SAVE_KEY : '세이브가 비어 있어 새 판으로 엽니다');
    renderAll();
  }

  /** 저장 — 게임 창이 열려 있으면 그 창도 다시 읽게 두드린다 */
  function commit(msg) {
    C.persist();
    try { localStorage.setItem(C.POKE_KEY, String(Date.now())); } catch (e) { /* 무시 */ }
    renderAll();
    say(msg || '저장했습니다');
  }

  /* ── 요약 ─────────────────────────────────────────── */

  function renderSummary() {
    var p = C.save.player, s = S.state();
    var pw = S.power();
    var j = JD.job(C.save.job || 'none');
    $('sum').innerHTML =
      'Lv.' + p.level + ' · 경험치 ' + C.fmt(p.exp) + '/' + C.fmt(C.expNeed(p.level)) +
      ' · 🪙 ' + C.fmt(p.gold) + ' · 🏅 ' + C.fmt(p.feat) +
      ' · ' + j.emoji + ' ' + esc(j.name) + '<br>' +
      '🗡️ 잡은 수 ' + C.fmt(s.kills || 0) + ' · 👺 토벌 ' + (s.bosses || 0) +
      ' · 💀 쓰러짐 ' + (s.deaths || 0) + ' · 🧪 ' + (s.potions || 0) +
      ' · 사냥터 ' + esc(SD.stage(s.stage).name) + '<br>' +
      '내 몸 — 공격 ' + pw.atk + ' (맨몸 ' + pw.bare.atk + ')' +
      ' · 체력 ' + pw.hp + ' · 방어 ' + pw.def + ' · 기력 ' + pw.mp +
      ' · 🎓 무예 점수 ' + J.spLeft() + '/' + J.spTotal();
  }

  /* ── 세이브 탭 ────────────────────────────────────── */

  function renderBasics() {
    var host = $('basics');
    host.innerHTML = '';
    var p = C.save.player;
    numField(host, '레벨', function () { return p.level; }, function (v) {
      p.level = Math.max(1, Math.round(v)); p.exp = 0;
    });
    numField(host, '경험치', function () { return p.exp; }, function (v) { p.exp = Math.max(0, v); });
    numField(host, '금 🪙', function () { return p.gold; }, function (v) { p.gold = Math.max(0, v); });
    numField(host, '공적 🏅', function () { return p.feat; }, function (v) { p.feat = Math.max(0, v); });
    numField(host, '명성 🎖️', function () { return p.fame; }, function (v) { p.fame = Math.max(0, v); });
    var s = S.state();
    numField(host, '잡은 수', function () { return s.kills || 0; }, function (v) { s.kills = Math.max(0, Math.round(v)); });
    numField(host, '토벌 수', function () { return s.bosses || 0; }, function (v) { s.bosses = Math.max(0, Math.round(v)); });
    numField(host, '쓰러진 수', function () { return s.deaths || 0; }, function (v) { s.deaths = Math.max(0, Math.round(v)); });
  }

  /** 도감에 있는(= 쓸 수 있는) 인물 목록 */
  function ownedHeroes() {
    var out = [], dex = C.save.dex.heroes, id;
    for (id in dex) {
      if (!Object.prototype.hasOwnProperty.call(dex, id)) { continue; }
      var h = D.find(id);
      if (h) { out.push(h); }
    }
    return out;
  }

  function renderLead() {
    var sel = $('lead');
    sel.innerHTML = '';
    var list = ownedHeroes();
    if (!list.length) { list = D.heroes.slice(0, 12); }
    list.forEach(function (h) {
      var o = el('option');
      o.value = h.id; o.textContent = h.name;
      sel.appendChild(o);
    });
    var lead = C.save.party[0];
    if (lead) { sel.value = lead; }
    var ref = S.meRef();
    $('leadinfo').textContent = ref
      ? (ref.name + ' — 무력 ' + H.stats(ref.id).might + ' · 지략 ' + H.stats(ref.id).wisdom +
         ' · 통솔 ' + H.stats(ref.id).command + ' · ' + (H.info(ref.id).rank || 0) + '성')
      : '동행이 비어 있습니다 — 사냥에 들어갈 수 없습니다';
  }

  /** 도감에 없으면 넣어 준다 — 어드민은 "그 상황으로 곧장" 가는 자리다 */
  function giveHero(id) {
    var dex = C.save.dex.heroes;
    if (!dex[id]) { dex[id] = { count: 1, firstAt: Date.now() }; }
    H.ensure(id);
  }

  /* ── 사냥터 탭 ────────────────────────────────────── */

  function renderStages() {
    var host = $('stages');
    host.innerHTML = '';
    var s = S.state();
    SD.STAGES.forEach(function (stg) {
      var open = S.unlocked(stg.key);
      var left = S.bossLeft(stg.key);
      var card = el('div', 'one');
      var fm = el('div', 'fm');
      fm.innerHTML = '<b>' + esc(stg.name) + '</b>' +
        '<small>Lv.' + stg.need + ' 부터 · 적 Lv.' + stg.enemyLv + ' · ' + stg.spawn + '마리 · 폭 ' + stg.width + '</small>' +
        '<small>' + (open ? '<span class="chip on">열림</span>' : '<span class="chip">잠김</span>') +
        (s.stage === stg.key ? '<span class="chip on">지금 여기</span>' : '') +
        (stg.boss ? ('<span class="chip' + (left ? '' : ' on') + '">👺 ' + esc(stg.boss.name) +
                     (left ? (' — ' + C.fmtTime(left / 1000) + ' 뒤') : ' — 나와 있다') + '</span>') : '') +
        '</small>';
      card.appendChild(fm);
      var fb = el('div', 'fb');
      btn(fb, '여기로 옮긴다', null, function () {
        S.state().stage = stg.key;
        if (!S.unlocked(stg.key)) {
          C.save.player.level = Math.max(C.save.player.level, stg.need);
          say('레벨이 모자라 Lv.' + stg.need + ' 로 올렸습니다');
        }
        commit(stg.name + ' 으로 옮겼습니다');
      });
      btn(fb, '레벨을 맞춘다', null, function () {
        C.save.player.level = Math.max(C.save.player.level, stg.need);
        commit('Lv.' + C.save.player.level);
      });
      if (stg.boss) {
        btn(fb, '👺 지금 나오게', null, function () {
          S.state().bossAt[stg.key] = 0;
          commit(stg.boss.name + ' 이(가) 나옵니다');
        });
        btn(fb, '시계 되돌리기', null, function () {
          S.state().bossAt[stg.key] = Date.now();
          commit('방금 잡은 것으로 두었습니다');
        });
      }
      card.appendChild(fb);
      host.appendChild(card);
    });

    var run = S.raw();
    $('runinfo').innerHTML = run
      ? ('▶️ ' + esc(run.stage.name) + ' · 체력 ' + Math.round(run.hp) + '/' + run.hpMax +
         ' · 기력 ' + Math.round(run.mp) + ' · 적 ' + run.enemies.length +
         ' · 이 판에서 잡은 수 ' + run.kills)
      : '사냥 중이 아닙니다 (이 창에서는 늘 그렇습니다 — 게임 창을 보세요)';
  }

  /** 적 세기 — side.js 의 셈을 그대로 따라 한다 (손잡이를 곱한 뒤의 값) */
  function renderEnemyCalc() {
    var host = $('enemycalc');
    host.innerHTML = '';
    var hpMul = C.tuned('enemy.hpMul', 1), dmgMul = C.tuned('enemy.dmgMul', 1);
    SD.STAGES.forEach(function (stg) {
      var lv = stg.enemyLv;
      var bh = DG.side && DG.side.baseHpOf ? DG.side.baseHpOf(lv) : 18 * Math.pow(1.22, lv - 1);
      var hp = Math.max(1, Math.round(bh * hpMul));
      var dmg = Math.round((4 + lv * 1.6) * dmgMul);
      var f = el('div', 'fld');
      f.innerHTML = '<label>' + esc(stg.name) + '</label>' +
        '<span class="def" style="min-width:0">체 ' + C.fmt(hp) + ' · 공 ' + dmg + '</span>';
      host.appendChild(f);
      if (!stg.boss) { return; }
      var bhp = Math.max(1, Math.round(bh * stg.boss.hpMul * hpMul));
      var bdmg = Math.round((4 + lv * 1.6) * stg.boss.dmgMul * dmgMul);
      var g = el('div', 'fld');
      g.innerHTML = '<label>└ 👺 ' + esc(stg.boss.name) + '</label>' +
        '<span class="def" style="min-width:0">체 ' + C.fmt(bhp) + ' · 공 ' + bdmg + '</span>';
      host.appendChild(g);
    });
  }

  /* ── 장비 탭 ──────────────────────────────────────── */

  var TIERS = [
    { n: 1, name: '1단 (Lv.1)', need: 1 },
    { n: 2, name: '2단 (Lv.5)', need: 5 },
    { n: 3, name: '3단 (Lv.12)', need: 12 },
    { n: 4, name: '4단 (Lv.20)', need: 20 }
  ];

  /** 그 단의 물건 = 요구 레벨이 그 단과 같은 것들 */
  function gearOfTier(t) {
    return GD.GEAR.filter(function (g) { return g.need === t.need; });
  }

  function renderGearSets() {
    var host = $('gearsets');
    host.innerHTML = '';
    TIERS.forEach(function (t) {
      btn(host, t.name + ' 한 벌', null, function () {
        var lv = C.save.player.level;
        if (lv < t.need) {
          C.save.player.level = t.need;
          say('요구 레벨에 맞춰 Lv.' + t.need + ' 로 올렸습니다');
        }
        gearOfTier(t).forEach(function (d) {
          var it = G.make(d.key);
          if (!it) { return; }
          /* 가방을 거치지 않고 곧바로 낀다 — 가방이 찼어도 되게 */
          G.state().inv.push(it);
          G.equip(it.uid);
        });
        commit(t.name + ' 한 벌을 갖췄습니다');
      });
    });
  }

  function renderScrolls() {
    var host = $('scrolls');
    host.innerHTML = '';
    G.state();
    GD.SCROLLS.forEach(function (sc) {
      numField(host, sc.name + ' (' + Math.round(sc.rate * 100) + '%)',
        function () { return C.save.scrolls[sc.key] || 0; },
        function (v) { C.save.scrolls[sc.key] = Math.max(0, Math.round(v)); });
    });
  }

  function renderBag() {
    var g = G.state();
    $('potions').value = S.state().potions || 0;
    $('baginfo').textContent = '가방 ' + g.inv.length + '/' + G.BAG +
      ' · 낀 것 ' + Object.keys(g.equip).length + '/7';

    var host = $('bagitems');
    host.innerHTML = '';
    if (!g.inv.length) {
      host.appendChild(el('div', null, '<span style="font-size:11.5px;color:var(--dim)">가방이 비었습니다</span>'));
      return;
    }
    g.inv.slice(0, 48).forEach(function (it) {
      var d = G.defOf(it);
      if (!d) { return; }
      var card = el('div', 'one');
      var fm = el('div', 'fm');
      fm.innerHTML = '<b>' + esc(G.nameOf(it)) + '</b>' +
        '<small>' + esc(GD.slot(d.slot).name) + ' · Lv.' + d.need +
        ' · 업횟 ' + it.left + ' · 공 ' + (d.atk + (it.atk || 0)) +
        ' 방 ' + (d.def + (it.def || 0)) + ' 체 ' + (d.hp + (it.hp || 0)) + '</small>';
      card.appendChild(fm);
      var fb = el('div', 'fb');
      if (G.isEquipped(it.uid)) {
        btn(fb, '벗는다', null, function () { G.unequip(d.slot); commit('벗었습니다'); });
      } else {
        btn(fb, '낀다', null, function () {
          if (C.save.player.level < d.need) {
            C.save.player.level = d.need;
            say('요구 레벨에 맞춰 Lv.' + d.need + ' 로 올렸습니다');
          }
          G.equip(it.uid);
          commit('꼈습니다');
        });
      }
      btn(fb, '버린다', 'danger', function () {
        G.drop(it.uid);
        commit('버렸습니다');
      });
      card.appendChild(fb);
      host.appendChild(card);
    });
  }

  /* ── 직업 탭 ──────────────────────────────────────── */

  function renderJobs() {
    var host = $('jobs');
    host.innerHTML = '';
    var cur = C.save.job || 'none';
    JD.JOBS.forEach(function (j) {
      var b = btn(host, j.emoji + ' ' + j.name, cur === j.key ? 'on' : null, function () {
        /* 게임은 되돌릴 수 없지만 어드민은 바꾼다 — 무예는 그대로 두고 직업만 옮긴다.
           띠(job.bar)는 지금 직업의 무예만 고르므로, 옮기면 손이 통째로 바뀐다 */
        C.save.job = j.key;
        if (C.save.player.level < j.need) {
          C.save.player.level = Math.max(C.save.player.level, j.need);
        }
        commit(j.name + ' 이(가) 되었습니다');
      });
      b.title = j.desc || '';
    });
    var j = JD.job(cur);
    $('jobinfo').innerHTML = j.emoji + ' <b>' + esc(j.name) + '</b> — ' + esc(j.desc || '') +
      ' · 무예 점수 ' + J.spLeft() + '/' + J.spTotal() + ' (쓴 것 ' + J.spSpent() + ')';
  }

  function renderSkills() {
    var host = $('skills');
    host.innerHTML = '';
    var mine = JD.skillsOf(C.save.job || 'none');
    mine.forEach(function (sk) {
      if (sk.max === 0) { return; }              // 무명의 넷은 찍는 것이 아니다
      var lv = J.levelOf(sk.key);
      var card = el('div', 'one');
      var fm = el('div', 'fm');
      fm.innerHTML = '<b>' + sk.emoji + ' ' + esc(sk.name) + ' ' + lv + '/' + sk.max + '</b>' +
        '<small>' + esc(sk.desc || '') + '</small>' +
        '<small>기력 ' + sk.cost + ' · 재냉각 ' + sk.cd + '초' +
        (sk.need ? (' · 앞자리 ' + esc(JD.skill(sk.need.key).name) + ' ' + sk.need.lv) : '') + '</small>';
      card.appendChild(fm);
      var fb = el('div', 'fb');
      btn(fb, '＋1', null, function () {
        C.save.skills[sk.key] = Math.min(sk.max, (C.save.skills[sk.key] || 0) + 1);
        commit(sk.name + ' ' + C.save.skills[sk.key]);
      });
      btn(fb, '－1', null, function () {
        C.save.skills[sk.key] = Math.max(0, (C.save.skills[sk.key] || 0) - 1);
        commit(sk.name + ' ' + C.save.skills[sk.key]);
      });
      btn(fb, '끝까지', null, function () {
        C.save.skills[sk.key] = sk.max;
        commit(sk.name + ' ' + sk.max);
      });
      card.appendChild(fb);
      host.appendChild(card);
    });
    if (!host.children.length) {
      host.appendChild(el('div', null,
        '<span style="font-size:11.5px;color:var(--dim)">무명(無名)은 찍을 무예가 없습니다 — 넷이 처음부터 놓여 있습니다</span>'));
    }

    var bar = $('barrow');
    bar.innerHTML = '';
    J.bar().forEach(function (sk, i) {
      var c = el('span', 'chip on', (i + 1) + ' ' + sk.emoji + ' ' + esc(sk.name) +
        (sk.max ? (' ' + J.levelOf(sk.key)) : ''));
      bar.appendChild(c);
    });
    if (!bar.children.length) { bar.appendChild(el('span', 'chip', '띠가 비었습니다')); }
  }

  /* ── 사명 탭 ──────────────────────────────────────── */

  function renderQuests() {
    var host = $('quests');
    host.innerHTML = '';
    var st = Q.state();
    QD.QUESTS.forEach(function (q) {
      var r = st[q.key] || {};
      var pr = Q.progress(q.key);
      var card = el('div', 'one');
      var fm = el('div', 'fm');
      fm.innerHTML = '<b>' + esc(q.name) + '</b>' +
        '<small>Lv.' + q.need + ' 부터 · ' + esc(q.desc || '') + '</small>' +
        '<small>' + (Q.taken(q.key)
          ? ('<span class="chip on">받음</span> ' + pr + '/' + q.goal.n)
          : '<span class="chip">안 받음</span>') +
        (r.done ? ('<span class="chip on">바친 횟수 ' + r.done + '</span>') : '') +
        ' <span class="chip">' + esc(q.goal.type) + '</span></small>';
      card.appendChild(fm);
      var fb = el('div', 'fb');
      btn(fb, '받는다', null, function () {
        if (C.save.player.level < q.need) {
          C.save.player.level = q.need;
          say('Lv.' + q.need + ' 로 올렸습니다');
        }
        Q.take(q.key);
        commit(q.name + ' 을(를) 받았습니다');
      });
      btn(fb, '채운다', null, function () {
        fillQuest(q);
        commit(q.name + ' — ' + Q.progress(q.key) + '/' + q.goal.n);
      });
      btn(fb, '바친다', 'go', function () {
        fillQuest(q);
        if (Q.turnIn(q.key)) { commit(q.name + ' 을(를) 바쳤습니다'); }
        else { say('바치지 못했습니다 — 받은 것인지 확인하세요'); }
      });
      card.appendChild(fb);
      host.appendChild(card);
    });
  }

  /**
   * 사명 하나를 채운다 — **갈래마다 채우는 자리가 다르다.**
   * 쌓이는 것(적·보스)은 세이브의 수를 올리면 되지만, 보면 아는 것(장비·무예·금)은
   * 세어 두지 않고 그때그때 읽으므로 **실제로 그 상태를 만들어야** 한다.
   * (세어 두면 장비를 벗었다 껴도 수가 남아 어긋난다 — 그래서 이렇게 짜여 있다)
   */
  function fillQuest(q) {
    if (!Q.taken(q.key)) { Q.take(q.key); }
    var r = Q.state()[q.key];
    if (!r) { return; }
    var g = q.goal;
    if (g.type === 'kill' || g.type === 'boss') { r.n = g.n; return; }
    if (g.type === 'gold') {
      C.save.player.gold = Math.max(C.save.player.gold, g.n);
      return;
    }
    if (g.type === 'gear') {
      /* 낀 것의 수를 센다 — 낮은 단으로 부위를 채운다 */
      var have = Object.keys(G.state().equip).length, i = 0;
      var pool = GD.GEAR.filter(function (d) { return d.need === 1; });
      while (have < g.n && i < pool.length) {
        var it = G.make(pool[i].key);
        G.state().inv.push(it);
        G.equip(it.uid);
        have = Object.keys(G.state().equip).length;
        i++;
      }
      return;
    }
    if (g.type === 'skill') {
      var mine = JD.skillsOf(C.save.job || 'none').filter(function (s) { return s.max > 0; });
      if (!mine.length) {
        /* 무명은 찍을 무예가 없다 — 1차로 보내야 셈이 선다 */
        C.save.player.level = Math.max(C.save.player.level, 10);
        C.save.job = 'warrior';
        mine = JD.skillsOf('warrior').filter(function (s) { return s.max > 0; });
      }
      var n = 0;
      for (var k = 0; k < mine.length && n < g.n; k++) {
        C.save.skills[mine[k].key] = Math.max(1, C.save.skills[mine[k].key] || 0);
        n++;
      }
      return;
    }
    if (g.type === 'level') { C.save.player.level = Math.max(C.save.player.level, g.n); }
  }

  /* ── 손잡이 탭 ────────────────────────────────────── */

  /* [키, 이름, 기본값, 단계, 설명] — side.js·gear.js 의 core.tuned 와 **같은 키**여야 한다 */
  var KNOBS = [
    ['side.grav',      '중력',            1900, 10,  '클수록 빨리 떨어진다'],
    ['side.jump',      '점프 속도',        760, 10,  '클수록 높이 뛴다'],
    ['side.speed',     '달리기',           270, 10,  '좌우 속도'],
    ['side.climb',     '오르내리기',       168, 4,   '줄·사다리를 타는 속도'],
    ['side.mpRegen',   '기력 회복/초',       8, 1,   '무예를 얼마나 자주 쓰나'],
    ['enemy.hpMul',    '적 체력 ×',          1, 0.1, '보스도 같이 탄다'],
    ['enemy.dmgMul',   '적 공격 ×',          1, 0.1, ''],
    ['gain.expMul',    '경험치 ×',           1, 0.5, ''],
    ['gain.goldMul',   '금 ×',              1, 0.5, ''],
    ['drop.potion',    '탕약 확률',       0.14, 0.02, '적 하나를 잡을 때'],
    ['drop.gearMul',   '장비·주문서 ×',      1, 0.5, '떨어질 확률의 배수'],
    ['scroll.rateMul', '주문서 성공률 ×',    1, 0.5, '1 을 넘으면 상한 1'],
    ['crit.rate',      '급소 확률',       0.15, 0.05, '때릴 때마다 읽는다 — 곧바로 듣는다'],
    ['crit.mul',       '급소 배수',        1.6, 0.1, '급소가 터졌을 때 곱하는 값'],
    ['hit.knock',      '넉백',              62, 5,   '맞은 적이 밀리는 힘 (보스는 안 밀린다)'],
    ['boss.coolMul',   '보스 리젠 ×',        1, 0.25, '0 이면 늘 나와 있다'],
    ['gear.bag',       '가방 칸',           24, 1,   '']
  ];

  function renderTune() {
    var host = $('tunefields');
    host.innerHTML = '';
    var grid = el('div', 'grid');
    KNOBS.forEach(function (k) {
      var f = el('div', 'fld');
      var lab = el('label', null, esc(k[1]));
      lab.title = k[4] || '';
      f.appendChild(lab);
      var i = el('input');
      i.type = 'number';
      i.step = k[3];
      i.placeholder = String(k[2]);
      var cur = C.tune()[k[0]];
      i.value = (cur === undefined || cur === null) ? '' : cur;
      i.addEventListener('change', function () {
        C.setTune(k[0], i.value === '' ? null : Number(i.value));
        renderTunePill();
        renderEnemyCalc();
        say(i.value === '' ? (k[1] + ' 을(를) 놓았습니다') : (k[1] + ' = ' + i.value));
      });
      f.appendChild(i);
      f.appendChild(el('span', 'def', '기본 ' + k[2]));
      grid.appendChild(f);
    });
    host.appendChild(grid);

    /* 손맛 — 자주 쓰는 세 벌을 단추로 */
    var feel = $('feelrow');
    feel.innerHTML = '';
    var SETS = [
      ['기본', { 'side.grav': null, 'side.jump': null, 'side.speed': null }],
      ['가볍게 (달 위)', { 'side.grav': 900, 'side.jump': 640, 'side.speed': 300 }],
      ['묵직하게', { 'side.grav': 2600, 'side.jump': 880, 'side.speed': 240 }],
      ['빠르게 (QA용)', { 'side.grav': 1900, 'side.jump': 760, 'side.speed': 620 }]
    ];
    SETS.forEach(function (s) {
      var t = C.tune();
      var on = Object.keys(s[1]).every(function (k) {
        var want = s[1][k];
        return want === null ? (t[k] === undefined) : (t[k] === want);
      });
      btn(feel, s[0], on ? 'on' : null, function () {
        C.setTune(s[1]);
        renderTune();
        renderTunePill();
        say(s[0]);
      });
    });
  }

  function renderTunePill() {
    var t = C.tune(), n = 0, k;
    for (k in t) { if (Object.prototype.hasOwnProperty.call(t, k)) { n++; } }
    var pill = $('tunepill');
    pill.className = 'pill ' + (n ? 'tuned' : 'clean');
    pill.textContent = n ? ('손잡이 ' + n + '개') : '손잡이 없음';
    var sum = $('tunesum');
    if (sum) {
      sum.textContent = n ? (n + '개가 잡혀 있습니다 — 게임 창을 새로고침해야 듣습니다') : '전부 코드의 기본값입니다';
    }
  }

  /* ── 프리셋 ───────────────────────────────────────── */

  var PRESETS = [
    ['🐣 갓 시작한 판', '레벨 1 · 맨몸 · 들판 · 사명 없음',
      function () {
        var p = C.save.player;
        p.level = 1; p.exp = 0; p.gold = 120; p.feat = 0;
        C.save.job = 'none'; C.save.skills = {};
        C.save.gear = { uid: 1, inv: [], equip: {} };
        C.save.scrolls = {};
        C.save.quests = {};
        var s = S.state();
        s.stage = 'field'; s.best = 'field'; s.potions = 3;
        s.kills = 0; s.deaths = 0; s.bosses = 0; s.bossAt = {};
      }],
    ['⚔️ 1차 전직 직전', 'Lv.9 · 2단 한 벌 · 무예 점수가 쌓여 있다',
      function () {
        C.save.player.level = 9;
        C.save.job = 'none'; C.save.skills = {};
        equipTier(2);
        S.state().stage = 'forest';
      }],
    ['🛡️ 2차 전직 직전', 'Lv.24 무사 · 참격 5 · 3단 한 벌',
      function () {
        C.save.player.level = 24;
        C.save.job = 'warrior';
        C.save.skills = { w_cut: 5, w_whirl: 5, w_rush: 3, w_iron: 3 };
        equipTier(3);
        S.state().stage = 'cave';
      }],
    ['👺 보스 앞', '굴혈 · 보스가 나와 있다 · 탕약 20',
      function () {
        C.save.player.level = Math.max(C.save.player.level, 12);
        var s = S.state();
        s.stage = 'cave'; s.potions = 20;
        s.bossAt = {};
      }],
    ['🎒 가방이 가득', '24칸을 다 채운다 — 못 줍는 자리를 본다',
      function () {
        var g = G.state();
        var pool = GD.GEAR.filter(function (d) { return d.need === 1; });
        while (g.inv.length < G.BAG) {
          g.inv.push(G.make(pool[g.inv.length % pool.length].key));
        }
      }],
    ['📜 주문서 창고', '종류마다 20장 · 4단 한 벌 · 업횟이 남아 있다',
      function () {
        C.save.player.level = Math.max(C.save.player.level, 20);
        equipTier(4);
        GD.SCROLLS.forEach(function (sc) { C.save.scrolls[sc.key] = 20; });
      }],
    ['💀 빈사', '체력이 바닥나기 직전을 본다 — 탕약 1개',
      function () {
        S.state().potions = 1;
        C.setTune({ 'enemy.dmgMul': 6 });
      }],
    ['🎖️ 3차 전직 직전', 'Lv.44 장군 · 패왕격 8 — 한 레벨만 더 오르면 원수다',
      function () {
        C.save.player.level = 44;
        C.save.job = 'general';
        C.save.skills = { w_cut: 8, w_whirl: 5, w_rush: 5, w_iron: 5, g_smash: 8, g_roar: 5, g_wall: 5 };
        equipTier(4);
        S.state().stage = 'cave';
      }],
    ['🏆 다 갖춘 판', 'Lv.60 · 3차 원수 · 무예 끝까지 · 4단 한 벌 · 금 100만',
      function () {
        var p = C.save.player;
        p.level = 60; p.gold = 1000000; p.feat = 5000;
        C.save.job = 'marshal';
        /* 갈래를 거슬러 올라가며 다 찍는다 — skillsOf 가 아랫자리 것도 준다 */
        JD.skillsOf('marshal').forEach(function (sk) {
          if (sk.max) { C.save.skills[sk.key] = sk.max; }
        });
        equipTier(4);
        var s = S.state();
        s.stage = 'cave'; s.potions = 50; s.bossAt = {};
      }],
    ['📋 사명 열셋 다 받음', '받을 수 있는 것을 다 받고 셈을 채운다',
      function () {
        C.save.player.level = Math.max(C.save.player.level, 20);
        QD.QUESTS.forEach(function (q) { fillQuest(q); });
      }],
    ['🏹 궁수의 손', 'Lv.25 신궁 · 무예 · 4단 무기 — 원거리 판정을 본다',
      function () {
        C.save.player.level = 25;
        C.save.job = 'sniper';
        JD.skillsOf('archer').forEach(function (sk) { if (sk.max) { C.save.skills[sk.key] = 5; } });
        JD.skillsOf('sniper').forEach(function (sk) { if (sk.max) { C.save.skills[sk.key] = 3; } });
        equipTier(4);
      }],
    ['🦅 3차 넷을 한 번에', 'Lv.60 · 네 갈래의 끝을 차례로 눌러 본다 (지금은 비장)',
      function () {
        C.save.player.level = 60;
        C.save.job = 'flier';
        JD.skillsOf('flier').forEach(function (sk) { if (sk.max) { C.save.skills[sk.key] = sk.max; } });
        equipTier(4);
        S.state().stage = 'cave';
        S.state().potions = 50;
      }],
    ['🤖 자동 사냥 켬', '자동을 켜고 굴혈로 보낸다',
      function () {
        C.save.auto.on = true;
        C.save.auto.hunt = true; C.save.auto.potion = true;
        C.save.player.level = Math.max(C.save.player.level, 12);
        S.state().stage = 'cave';
        S.state().potions = 30;
      }]
  ];

  function equipTier(n) {
    var t = TIERS[n - 1];
    if (!t) { return; }
    C.save.player.level = Math.max(C.save.player.level, t.need);
    var g = G.state();
    gearOfTier(t).forEach(function (d) {
      var it = G.make(d.key);
      g.inv.push(it);
      G.equip(it.uid);
    });
  }

  function renderPresets() {
    var host = $('presets');
    host.innerHTML = '';
    PRESETS.forEach(function (p) {
      var b = el('button', 'preset', '<b>' + esc(p[0]) + '</b><small>' + esc(p[1]) + '</small>');
      b.addEventListener('click', function () {
        try { p[2](); } catch (e) { say('만들지 못했습니다: ' + e.message); return; }
        commit(p[0] + ' — 만들었습니다');
      });
      host.appendChild(b);
    });
  }

  /* ── 스냅샷 — 세이브와 별개 칸, 이 기기에만 ────────── */

  var SNAP = 'yeoksa-side/admin/snap/';

  function renderSnaps() {
    var host = $('snaps');
    host.innerHTML = '';
    for (var i = 1; i <= 3; i++) {
      (function (n) {
        var raw = null;
        try { raw = localStorage.getItem(SNAP + n); } catch (e) { /* 무시 */ }
        var wrap = el('span');
        btn(wrap, '📷 ' + n + '칸에 뜬다', null, function () {
          try {
            localStorage.setItem(SNAP + n, JSON.stringify(C.save));
            renderSnaps();
            say(n + '칸에 떴습니다');
          } catch (e) { say('뜨지 못했습니다: ' + e.message); }
        });
        btn(wrap, '↩️ ' + n + '칸으로', raw ? 'go' : null, function () {
          if (!raw) { say(n + '칸이 비었습니다'); return; }
          try {
            localStorage.setItem(C.SAVE_KEY, raw);
            C.load();
            commit(n + '칸으로 돌렸습니다');
          } catch (e) { say('돌리지 못했습니다: ' + e.message); }
        });
        wrap.appendChild(el('span', null,
          '<span style="font-size:11px;color:var(--dim)">' +
          (raw ? (Math.round(raw.length / 1024) + 'KB') : '비었음') + '</span>&nbsp;&nbsp;'));
        host.appendChild(wrap);
      })(i);
    }
  }

  /* ── 자가점검 ─────────────────────────────────────── */

  /**
   * 어드민이 세이브·손잡이를 제대로 읽고 쓰는지 스스로 본다.
   * **지금 프로필을 건드리지 않는다** — 따로 만든 칸에서 확인하고 지운다.
   */
  function selftest() {
    var out = [], keep = C.SAVE_KEY, tmp = C.SAVE_BASE + '/__admincheck';
    function ok(name, cond, extra) {
      out.push((cond ? '<span style="color:var(--good)">✔</span> ' : '<span style="color:var(--bad)">✘</span> ') +
        esc(name) + (extra ? (' <span style="color:var(--dim)">— ' + esc(extra) + '</span>') : ''));
      return !!cond;
    }
    try {
      C.setSaveKey(tmp);
      C.reset();

      ok('세이브 키가 폴더 이름이 아니라 yeoksa-side 다', C.SAVE_BASE === 'yeoksa-side/save', C.SAVE_BASE);
      C.save.player.gold = 4321;
      C.persist();
      C.save.player.gold = 0;
      C.load();
      ok('저장한 값이 다시 읽힌다', C.save.player.gold === 4321, '금 ' + C.save.player.gold);

      var lv = C.save.player.level;
      C.save.player.level = 10;
      /* 점수는 (레벨-1)×3 에서 찍은 합을 뺀 **파생값**이라 세이브에 담지 않는다.
         담았다면 옛 세이브에 그 칸이 없어 어긋났을 것이다 — 이 항목이 그 못이다 */
      ok('무예 점수는 레벨에서 나온다 (세이브에 없다)',
        J.spTotal() === 27 && J.spLeft() === 27 && !('sp' in C.save),
        'Lv.10 → ' + J.spTotal() + '점 · 남은 ' + J.spLeft());
      C.save.player.level = lv;

      var it = G.make('sword1');
      G.state().inv.push(it);
      var eq = G.equip(it.uid);
      ok('장비를 끼면 공격이 오른다', eq && G.bonus().atk >= 4, '+' + G.bonus().atk);

      C.save.job = 'warrior';
      C.save.player.level = 10;
      C.save.skills = { w_cut: 1 };
      ok('띠는 찍은 무예만 놓는다', J.bar().length === 1, J.bar().length + '자리');

      Q.init();
      Q.take('q_first');
      Q.state().q_first.n = 10;
      ok('사명은 받은 뒤부터 센다', Q.full('q_first'), Q.progress('q_first') + '/10');

      var before = C.tuned('side.jump', 760);
      C.setTune('side.jump', 999);
      ok('손잡이를 잡으면 그 값이 나온다', C.tuned('side.jump', 760) === 999, String(C.tuned('side.jump', 760)));
      C.setTune('side.jump', before === 760 ? null : before);
      ok('손잡이를 놓으면 기본값으로 돌아온다', C.tuned('side.jump', 760) === 760);

      ok('보스 리젠 시계는 세이브에 남는다', typeof S.state().bossAt === 'object');

      ok('어드민은 게임 창을 두드릴 자리를 안다', typeof C.POKE_KEY === 'string' && C.POKE_KEY.indexOf('yeoksa-side') === 0, C.POKE_KEY);
    } catch (e) {
      out.push('<span style="color:var(--bad)">✘</span> 점검 중에 멈췄습니다 — ' + esc(e.message));
    }
    try { localStorage.removeItem(tmp); } catch (e) { /* 무시 */ }
    C.setSaveKey(keep);
    C.load();
    try { Q.init(); } catch (e) { /* 무시 */ }
    renderAll();

    var bad = out.filter(function (s) { return s.indexOf('✘') >= 0; }).length;
    out.push('<b>' + (out.length - bad) + '/' + out.length + '</b>');
    $('selfout').innerHTML = out.join('<br>');
  }

  /* ── 오류 (SAGA-DESIGN §8-2) ──────────────────────── */

  function renderErr() {
    var E = global.DG && global.DG.errlog;
    var list = E ? E.list() : [];
    $('err-max').textContent = E ? E.MAX : 50;
    if (!list.length) { $('err-out').value = ''; return; }
    $('err-out').value = list.slice().reverse().map(function (e) {
      var when = e.t ? new Date(e.t).toLocaleString() : '?';
      var head = '[' + when + '] ' + (e.kind || 'error') + ' — ' + (e.msg || '');
      var where = e.src ? ('\n  ' + e.src + ':' + (e.line || 0) + ':' + (e.col || 0)) : '';
      var stack = e.stack ? ('\n' + e.stack) : '';
      return head + where + stack;
    }).join('\n\n');
  }

  /* ── 그리기 ───────────────────────────────────────── */

  function renderAll() {
    renderSummary();
    renderBasics();
    renderLead();
    renderStages();
    renderEnemyCalc();
    renderGearSets();
    renderScrolls();
    renderBag();
    renderJobs();
    renderSkills();
    renderQuests();
    renderTunePill();
    renderSnaps();
    renderErr();
  }

  /* ── 붙이기 ───────────────────────────────────────── */

  function bind() {
    var nav = document.querySelector('nav');
    nav.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-tab]') : null;
      if (!b) { return; }
      Array.prototype.forEach.call(nav.querySelectorAll('button'), function (x) { x.classList.remove('sel'); });
      b.classList.add('sel');
      Array.prototype.forEach.call(document.querySelectorAll('main section'), function (s) { s.classList.remove('show'); });
      var sec = $('tab-' + b.getAttribute('data-tab'));
      if (sec) { sec.classList.add('show'); }
    });

    $('prof').addEventListener('change', function () { openProfile($('prof').value); });
    $('save').addEventListener('click', function () { commit('저장했습니다'); });
    $('reload').addEventListener('click', function () { openProfile($('prof').value); });

    $('lead-apply').addEventListener('click', function () {
      var id = $('lead').value;
      giveHero(id);
      var p = C.save.party;
      var i = p.indexOf(id);
      if (i >= 0) { p.splice(i, 1); }
      p.unshift(id);
      C.save.party = p.slice(0, 5);
      commit('앞에 세웠습니다');
    });
    $('party-fill').addEventListener('click', function () {
      var list = ownedHeroes();
      if (list.length < 3) { list = D.heroes.slice(0, 3); }
      C.save.party = list.slice(0, 3).map(function (h) { giveHero(h.id); return h.id; });
      commit('셋을 채웠습니다');
    });
    $('party-rank').addEventListener('click', function () {
      var id = C.save.party[0];
      if (!id) { say('선두가 없습니다'); return; }
      var h = H.ensure(id);
      h.rank = Math.min(H.MAX_RANK, (h.rank || 0) + 1);
      commit((D.find(id).name) + ' — ' + h.rank + '성');
    });

    Array.prototype.forEach.call(document.querySelectorAll('button[data-clear]'), function (b) {
      b.addEventListener('click', function () {
        var what = b.getAttribute('data-clear'), s = S.state();
        if (what === 'kills') { s.kills = 0; s.deaths = 0; s.bosses = 0; }
        if (what === 'boss') { s.bossAt = {}; }
        if (what === 'quests') { C.save.quests = {}; Q.init(); }
        if (what === 'skills') { C.save.skills = {}; }
        if (what === 'bag') { G.state().inv = []; G.state().equip = {}; }
        if (what === 'log') { C.save.log = []; }
        if (what === 'side') {
          delete C.save.side;
          S.state();
        }
        commit('비웠습니다 — ' + what);
      });
    });

    $('gear-strip').addEventListener('click', function () {
      G.state().equip = {};
      commit('다 벗었습니다');
    });
    $('gear-max').addEventListener('click', function () {
      var g = G.state(), slot;
      for (slot in g.equip) {
        if (!Object.prototype.hasOwnProperty.call(g.equip, slot)) { continue; }
        var it = G.byUid(g.equip[slot]), d = G.defOf(it);
        if (!it || !d) { continue; }
        /* 주문서 하나(100%)를 그 자리에 다 쓴 셈으로 친다 — 판정은 게임 쪽에 그대로 있다 */
        var sc = GD.SCROLLS.filter(function (x) { return x.rate >= 1 && x['for'] === (d.slot === 'weapon' ? 'weapon' : 'armor'); })[0];
        while (it.left > 0 && sc) {
          it.left -= 1; it.up += 1;
          if (sc.atk) { it.atk = (it.atk || 0) + sc.atk; }
          if (sc.def) { it.def = (it.def || 0) + sc.def; }
          if (sc.hp) { it.hp = (it.hp || 0) + sc.hp; }
        }
      }
      commit('업횟을 다 썼습니다');
    });

    $('scroll-10').addEventListener('click', function () {
      G.state();
      GD.SCROLLS.forEach(function (sc) { C.save.scrolls[sc.key] = 10; });
      commit('주문서를 10장씩 두었습니다');
    });
    $('scroll-0').addEventListener('click', function () {
      C.save.scrolls = {};
      commit('주문서를 비웠습니다');
    });

    $('potion-apply').addEventListener('click', function () {
      S.state().potions = Math.max(0, Math.round(Number($('potions').value) || 0));
      commit('🧪 ' + S.state().potions);
    });
    $('bag-fill').addEventListener('click', function () {
      var g = G.state();
      var pool = GD.GEAR.filter(function (d) { return d.need === 1; });
      while (g.inv.length < G.BAG) { g.inv.push(G.make(pool[g.inv.length % pool.length].key)); }
      commit('가방을 채웠습니다');
    });

    $('skill-max').addEventListener('click', function () {
      JD.skillsOf(C.save.job || 'none').forEach(function (sk) {
        if (sk.max) { C.save.skills[sk.key] = sk.max; }
      });
      commit('무예를 다 찍었습니다');
    });
    $('skill-bar').addEventListener('click', function () {
      JD.skillsOf(C.save.job || 'none').forEach(function (sk) {
        if (sk.max) { C.save.skills[sk.key] = Math.max(1, C.save.skills[sk.key] || 0); }
      });
      commit('띠에 놓았습니다');
    });
    $('skill-clear').addEventListener('click', function () {
      C.save.skills = {};
      commit('무예를 되돌렸습니다');
    });

    $('quest-take').addEventListener('click', function () {
      QD.QUESTS.forEach(function (q) { if (C.save.player.level >= q.need) { Q.take(q.key); } });
      commit('받을 수 있는 것을 다 받았습니다');
    });
    $('quest-fill').addEventListener('click', function () {
      QD.QUESTS.forEach(function (q) {
        if (!Q.taken(q.key)) { return; }
        var r = Q.state()[q.key];
        if (q.goal.type === 'kill' || q.goal.type === 'boss' ||
            q.goal.type === 'gather' || q.goal.type === 'visit' || q.goal.type === 'talk') { r.n = q.goal.n; }
      });
      commit('셈을 채웠습니다');
    });
    $('quest-clear').addEventListener('click', function () {
      C.save.quests = {};
      Q.init();
      commit('사명을 비웠습니다');
    });

    $('tune-clear').addEventListener('click', function () {
      C.clearTune();
      renderTune();
      renderTunePill();
      renderEnemyCalc();
      say('손잡이를 다 놓았습니다 — 게임 창을 새로고침하세요');
    });

    $('dump').addEventListener('click', function () {
      $('json').value = JSON.stringify(C.save, null, 2);
      var n = 0;
      try { n = (localStorage.getItem(C.SAVE_KEY) || '').length; } catch (e) { /* 무시 */ }
      $('usage').textContent = Math.round(n / 1024) + 'KB · ' + C.SAVE_KEY;
    });
    $('load').addEventListener('click', function () {
      var raw = $('json').value.trim();
      if (!raw) { say('붙여 넣은 것이 없습니다'); return; }
      try {
        var o = JSON.parse(raw);
        localStorage.setItem(C.SAVE_KEY, JSON.stringify(o));
        C.load();
        try { Q.init(); } catch (e) { /* 무시 */ }
        commit('덮었습니다');
      } catch (e) { say('읽지 못했습니다: ' + e.message); }
    });

    $('selftest').addEventListener('click', selftest);

    $('err-refresh').addEventListener('click', renderErr);
    $('err-copy').addEventListener('click', function () {
      $('err-out').select();
      try { document.execCommand('copy'); say('복사했습니다'); } catch (e) { say('직접 복사해 주세요'); }
    });
    $('err-clear').addEventListener('click', function () {
      var E = global.DG && global.DG.errlog;
      if (E) { E.clear(); }
      renderErr();
      say('비웠습니다');
    });
  }

  /* ── 부트 ─────────────────────────────────────────── */

  bind();
  fillProfiles();
  renderTune();
  renderPresets();

  /* `_admin.html?selftest` 로 열면 스스로 점검하고 **제목에 결과를 적는다.**
     어드민은 눌러야 도는 화면이라 진단(`_test.html`)이 붙지 못한다 — 헤드리스로
     확인할 수 있는 유일한 자리다(사가블로의 `_sfxcheck.html` 과 같은 결):
       chrome --headless=new --dump-dom "…/_admin.html?selftest"  →  ADMIN n/n */
  if (global.location && global.location.search.indexOf('selftest') >= 0) {
    setTimeout(function () {
      selftest();
      var txt = $('selfout').textContent || '';
      var bad = (txt.match(/✘/g) || []).length;
      var all = (txt.match(/[✔✘]/g) || []).length;
      document.title = 'ADMIN ' + (all - bad) + '/' + all;
    }, 60);
  }

  /** 자가진단이 부를 수 있게 열어 둔다 (화면 없이 확인하는 자리) */
  global.DG.admin = {
    KNOBS: KNOBS, PRESETS: PRESETS, TIERS: TIERS,
    fillQuest: fillQuest, equipTier: equipTier, selftest: selftest
  };

})(window);
