/**
 * 직업 — 전직하고, 무예 점수를 붓는다
 * ---------------------------------------------------------------
 * 규칙만 안다. 무예가 실제로 무엇을 하는지는 side.js 가, 화면은 ui.js 가 맡는다.
 *
 * 세이브
 *   save.job    = 'none' | 'warrior' | …          지금 직업
 *   save.skills = { 무예key: 레벨 }               찍은 것
 *
 * **무예 점수(SP)는 담지 않는다.** 총점 (레벨-1)×`SP_PER_LEVEL`(§5-2 이후 2)
 * 에서 찍은 레벨의 합을 뺀 것이 남은 점수다 — 파생값이라 옛 세이브에도 그냥
 * 맞고, 레벨이 오르면 저절로 는다.
 *
 * **유파(§5-2)** — 띠(bar())에 놓인 것들 중 같은 `school`(SKILLS 의 태그)이
 * 2개면 소효과, 4개면 대효과가 붙는다. 세이브 칸은 안 늘린다 — 지금 찍은
 * 무예·직업만으로 매번 다시 계산한다(schoolBonus 참고).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var JD = global.DG.jobData;

  /* 조작 띠 여덟 칸(2026-08-26, 3차 전직과 함께 여섯에서 늘렸다).
     3차까지 열리면 한 갈래의 무예가 열둘이라 여섯 칸에는 새로 얻은 것이 못 든다.
     **4차(2026-09-10)를 더했지만 여덟은 그대로 둔다** — bar() 가 윗자리부터 채우므로
     4차 넷 + 3차 넷이 이미 여덟을 정확히 채운다(2·1차는 자동으로 내려간다). **5차(2026-09-30)도 같다** —
     각성기 둘이 맨 윗자리를 차지하고 3차 무예 둘이 밀려난다. 더 늘리면
     조작 띠가 세로로 길어져 사냥 화면을 가린다(사가만리 UI에 맞추며 잡아 둔 자리) */
  var BAR = 8;                  // 조작 띠에 놓이는 무예 칸

  function st() {
    var s = core.save;
    if (!s.job) { s.job = 'none'; }
    if (!s.skills) { s.skills = {}; }
    return s;
  }

  function cur() { st(); return JD.job(core.save.job); }

  function levelOf(key) {
    st();
    var sk = JD.skill(key);
    if (sk && sk.max === 0) { return 1; }      // 무명의 넷은 늘 1레벨로 친다
    return core.save.skills[key] || 0;
  }

  function spTotal() { return Math.max(0, (core.save.player.level - 1) * JD.SP_PER_LEVEL); }

  function spSpent() {
    st();
    var sum = 0, k;
    for (k in core.save.skills) {
      if (Object.prototype.hasOwnProperty.call(core.save.skills, k)) {
        sum += core.save.skills[k] || 0;
      }
    }
    return sum;
  }

  function spLeft() { return Math.max(0, spTotal() - spSpent()); }

  /* ── 전직 ─────────────────────────────────────────────── */

  function canJoin(key) {
    var j = JD.job(key);
    if (!j || j.from !== core.save.job) { return '지금 자리에서 갈 수 없는 길입니다'; }
    if (core.save.player.level < j.need) { return 'Lv.' + j.need + ' 부터입니다'; }
    if (j.tier >= 2) {
      /* 윗자리는 **아랫자리 무예를 어느 정도 익혀야** 오른다 (원작의 그 조건이다).
         자리가 높을수록 무거워진다 — 2차는 5, 3차는 8, 4·5차는 10(만렙 — 하나를 끝까지). */
      var need = j.tier >= 4 ? 10 : (j.tier >= 3 ? 8 : 5);
      var low = JD.SKILLS.filter(function (s) { return s.job === j.from; });
      var best = 0;
      for (var i = 0; i < low.length; i++) { best = Math.max(best, levelOf(low[i].key)); }
      if (best < need) { return '아랫자리 무예 하나를 ' + need + ' 이상 익혀야 합니다'; }
    }
    return null;
  }

  /** 전직 — 원작은 되돌릴 수 없지만, 이 판은 "퓨전"이 방향이라 규칙을 하나
   *  더 얹는다(2026-09-11, 사용자 요청 — 다섯 판 전체 퓨전 순서와는 별개로
   *  사가종횡만 먼저 넣는 예외). resetJob() 이 무명으로 돌아가고 무예
   *  점수를 전부 돌려준다 — 그 뒤에 join() 으로 처음부터 **다른 길**을
   *  고를 수 있다. **하루 1회, 무료**(§10-Q3, 2026-09-18 확정) — 금 비용은
   *  안 두고, 대신 실제 달력 날짜(`todayKey()`)로 하루 한 번만 잠근다. */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }
  /** 소리 한 번 — sfx.js 가 없어도 규칙은 그대로 돈다(진단·데모가 그렇다) */
  function sfx(key) {
    var S = global.DG.sfx;
    if (S) { S.play(key); }
  }

  function join(key) {
    var why = canJoin(key);
    if (why) { core.emit('toast', '⚠️ ' + why); return false; }
    var j = JD.job(key);
    st();
    core.save.job = key;
    sfx('jobup');
    core.log('🎓 ' + j.name + ' 이(가) 되었다 — ' + j.desc, 'good');
    core.emit('toast', j.emoji + ' ' + j.name);
    /* 스승(§5-1) — 그 갈래의 차수(tier)에 맞는 스승 한 명의 초상·대사를 띄운다.
       ui.js 가 'mentor' 를 들어 인물 이름·대사로 토스트를 띄운다(도감에 없어도
       그냥 소개만 한다 — 등용 여부는 mentorBoost() 가 따로 본다). */
    var root = rootOf(key);
    if (root) {
      var list = JD.mentorsOf(root);
      var m = list[Math.min(j.tier - 1, list.length - 1)];
      if (m) {
        if (!core.save.player.mentorSeen) { core.save.player.mentorSeen = {}; }
        core.save.player.mentorSeen[key] = true;
        core.emit('mentor', { jobKey: key, heroId: m });
      }
    }
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 전직 갈래의 뿌리(1차 키) — 'warrior'|'archer'|'rogue'|'mage'. 무명이거나
   *  자리 사슬이 무명까지 안 닿으면(있을 수 없지만) null. §5-1 고유 조작·
   *  스승은 2~4차에도 안 바뀌고 이 뿌리 하나로만 정해진다. */
  function rootOf(key) {
    var j = JD.job(key);
    if (!j || j.key === 'none') { return null; }
    while (j.from && j.from !== 'none') { j = JD.job(j.from); }
    return j.from === 'none' ? j.key : null;
  }

  /** 지금 직업의 스승 넷 (무명이면 빈 배열) */
  function mentors() {
    st();
    var r = rootOf(core.save.job);
    return r ? JD.mentorsOf(r) : [];
  }

  /** 스승 중 하나라도 도감(등용)에 있으면 참 — 고유 조작이 한 단 오른다 */
  function mentorBoost() {
    var list = mentors(), dex = core.save.dex && core.save.dex.heroes;
    if (!dex) { return false; }
    for (var i = 0; i < list.length; i++) { if (dex[list[i]]) { return true; } }
    return false;
  }

  /** 지금 직업의 고유 조작(§5-1) — 스승 보정까지 적용해 돌려준다(무명이면 null).
   *  side.js 는 이 값만 받아 쓴다(입력 임계·수치가 뭔지는 몰라도 된다). */
  function signature() {
    st();
    var r = rootOf(core.save.job);
    if (!r) { return null; }
    var s = JD.signatureOf(r);
    if (!s) { return null; }
    var boost = mentorBoost();
    var out = {
      job: r, key: s.key, name: s.name, emoji: s.emoji, desc: s.desc, boost: boost,
      cost: JD.SIGNATURE_COST, cd: JD.SIGNATURE_COOL, hold: JD.SIGNATURE_HOLD
    };
    if (r === 'warrior') {
      out.window = boost ? s.windowBoost : s.window; out.nextMul = s.nextMul;
    } else if (r === 'archer') {
      out.minHold = s.minHold; out.maxHold = s.maxHold; out.mulMin = s.mulMin;
      out.mulMax = boost ? s.mulMaxBoost : s.mulMax;
      out.pierceAdd = s.pierceAdd; out.moveMul = s.moveMul;
    } else if (r === 'rogue') {
      out.dur = s.dur; out.firstHitMul = boost ? s.firstHitMulBoost : s.firstHitMul;
    } else if (r === 'mage') {
      out.shots = boost ? s.shotsBoost : s.shots;
    }
    return out;
  }

  /** 전직을 되돌린다 — 무명으로 돌아가고 찍은 무예 점수를 전부 되찾는다.
   *  이미 무명이면 되돌릴 게 없다. 부르는 쪽(ui.js)이 되돌릴지 먼저 되묻는다 */
  function resetJob() {
    st();
    if (core.save.job === 'none') { return false; }
    var today = todayKey();
    if (core.save.jobResetDay === today) {
      core.emit('toast', '⚠️ 전직 되돌리기는 하루에 한 번만 됩니다');
      return false;
    }
    core.save.job = 'none';
    core.save.skills = {};
    core.save.jobResetDay = today;
    sfx('jobup');
    core.log('🔄 전직을 되돌렸다 — 처음부터 다른 길을 고를 수 있다', 'info');
    core.emit('toast', '🔄 전직을 되돌렸습니다');
    core.emit('changed');
    core.persist();
    return true;
  }

  /* ── 무예 점수 ────────────────────────────────────────── */

  function canRaise(key) {
    var sk = JD.skill(key);
    if (!sk) { return '없는 무예입니다'; }
    if (sk.max === 0) { return '더 올릴 수 없습니다'; }
    var mine = JD.skillsOf(core.save.job);
    if (mine.indexOf(sk) < 0) { return '이 직업의 무예가 아닙니다'; }
    if (levelOf(key) >= sk.max) { return '이미 다 익혔습니다'; }
    if (spLeft() <= 0) { return '무예 점수가 없습니다'; }
    if (sk.need && levelOf(sk.need.key) < sk.need.lv) {
      return JD.skill(sk.need.key).name + ' ' + sk.need.lv + ' 이 먼저입니다';
    }
    return null;
  }

  function raise(key) {
    var why = canRaise(key);
    if (why) { core.emit('toast', '⚠️ ' + why); return false; }
    st();
    core.save.skills[key] = (core.save.skills[key] || 0) + 1;
    sfx('skillup');
    core.emit('changed');
    core.persist();
    return true;
  }

  /* ── 조작 띠에 놓이는 것 ──────────────────────────────── */

  /**
   * 지금 쓸 수 있는 무예 — **찍은 것만** 놓인다(무명의 넷은 늘 놓인다).
   * 순서는 데이터 순서 그대로다. 칸은 여섯.
   */
  /**
   * 조작 띠 — **윗자리 무예부터** 놓는다.
   * 3차까지 열리면 한 갈래의 무예가 열둘이라 여덟 칸에도 다 못 든다. 표 순서대로
   * 아래에서부터 채우면 **새로 얻은 무예가 영영 자리를 못 잡는다**(1차 넷이 앞을 다 먹는다).
   * 원작에서는 사람이 골라 놓지만 이 판은 자동으로 놓으므로, 윗자리를 먼저 놓는 것이 옳다.
   * 같은 자리 안에서는 표 순서 그대로다.
   */
  function bar() {
    var mine = JD.skillsOf(core.save.job).slice().sort(function (a, b) {
      return (JD.job(b.job).tier || 0) - (JD.job(a.job).tier || 0);
    });
    var out = [];
    for (var i = 0; i < mine.length && out.length < BAR; i++) {
      var sk = mine[i];
      if (sk.max === 0) {
        /* 전직했으면 무명의 넷은 물려받지 않는다 — 자리를 제 무예에 내준다 */
        if (core.save.job !== 'none') { continue; }
        out.push(sk);
      } else if (levelOf(sk.key) > 0) {
        out.push(sk);
      }
    }
    return out;
  }

  /* ── 유파(§5-2) ───────────────────────────────────────── */

  /** 띠에 놓인 것들 중 유파별로 몇 개씩인지 — school 없는 것(무명 넷)은 안 센다 */
  function schoolCounts() {
    var list = bar(), out = {};
    for (var i = 0; i < list.length; i++) {
      var sc = list[i].school;
      if (!sc) { continue; }
      out[sc] = (out[sc] || 0) + 1;
    }
    return out;
  }

  /** 지금 세트가 켜진 유파들 — {유파id: 2|4} */
  function activeSchools() {
    var counts = schoolCounts(), out = {};
    for (var id in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, id)) { continue; }
      if (counts[id] >= 4) { out[id] = 4; } else if (counts[id] >= 2) { out[id] = 2; }
    }
    return out;
  }

  /**
   * 그 무예 하나가 지금 세트로 받는 보정 — **판정은 여기 한 곳에서만 정한다**
   * (side.js 는 이 결과를 받아 자기 자리(mul·r·buff.sec·heal·shots)에 곱하거나
   * 더할 뿐, 유파가 뭔지는 몰라도 된다). 세트가 없으면 전부 중립값을 돌려준다.
   */
  function schoolBonus(sk) {
    var out = { dmgMul: 1, aoeMul: 1, buffMul: 1, healMul: 1, shotsAdd: 0, dodgeCdMul: 1, critForce: false };
    if (!sk || !sk.school) { return out; }
    var tier = activeSchools()[sk.school];
    if (!tier) { return out; }
    var def = JD.schoolDef(sk.school);
    if (!def) { return out; }
    var v = tier === 4 ? def.v4 : def.v2;
    if (def.kind === 'dmg') { out.dmgMul = v; }
    else if (def.kind === 'aoe') { out.aoeMul = v; }
    else if (def.kind === 'buff') { out.buffMul = v; }
    else if (def.kind === 'heal') { out.healMul = v; }
    else if (def.kind === 'volley') { out.shotsAdd = v; }   // 배율표 v 값 자체가 더할 발수다(v2=1발·v4=2발)
    else if (def.kind === 'dash') { out.dodgeCdMul = def.v2; out.critForce = tier >= 4; }
    return out;
  }

  /** 회피(§5-5 대시)의 재사용 대기 배율 — 지금 띠에 dash 유파 세트(2 이상)가
   *  있으면 낮아진다. side.js 의 dodge() 하나에서만 쓴다. */
  function dodgeCdMul() {
    var list = bar(), mul = 1;
    for (var i = 0; i < list.length; i++) {
      var b = schoolBonus(list[i]);
      if (b.dodgeCdMul < mul) { mul = b.dodgeCdMul; }
    }
    return mul;
  }

  /** 그 무예의 지금 힘 (레벨이 실린 배율) */
  function mulOf(sk) {
    if (!sk || !sk.mul) { return 0; }
    var lv = levelOf(sk.key);
    return sk.mul[0] + sk.mul[1] * Math.max(0, lv - 1);
  }

  /** 직업이 몸에 보태는 것 — side.power() 가 얹는다 */
  function grow() {
    var j = cur(), out = { hp: 0, atk: 0, mp: 0 };
    while (j) {
      if (j.grow) {
        out.hp += j.grow.hp || 0;
        out.atk += j.grow.atk || 0;
        out.mp += j.grow.mp || 0;
      }
      j = j.from ? JD.job(j.from) : null;
    }
    return out;
  }

  /* ── 사제 유대(정본 곁가지 side_mentor_*) ────────────────────────────
     이 판에는 스승과 나누는 별도 유대 게이지가 없어, **그 갈래로 사냥터에서 벤 적 수**를 유대로 삼는다(열 마리에 유대 1).
     유대 20·50·100(= 200·500·1000 마리)에 이르면 그 갈래 스승이 사연 한 줄을 들려준다(갈래 넷 × 문턱 셋, 판마다 한 번). 전직을 되돌려
     다른 갈래로 가면 그 갈래의 유대가 따로 쌓인다. 스승 이름은 지금 차수의 도감 가명(mentors()). */
  var BOND_PER = 10, BOND_AT = [20, 50, 100], BOND_GOLD = [3000, 8000, 20000];
  var BOND_LINES = {
    warrior: ['칼은 벨 때보다 거둘 때가 어렵다. 너는 벌써 거두는 법을 알아 가는구나.', '내 첫 상처가 아직 아프다. 그 아픔이 나를 여기까지 데려왔지. 너도 그러하리라.', '이제 내가 가르칠 것은 없다. 다만 네 등 뒤가 든든하다는 것만 기억하거라.'],
    archer: ['활은 시위를 놓는 순간보다 놓기 직전의 숨이 전부다. 네 숨이 고요해졌구나.', '멀리 쏘는 이는 멀리 본다. 네 눈에 이제 이 땅 끝이 보이느냐.', '화살 하나가 천 리를 간다는 말은 거짓이 아니다. 네가 그 증거다.'],
    rogue: ['그림자는 발소리를 남기지 않는다. 너도 이제 소리 없이 이기는구나.', '빠른 칼보다 빠른 판단이 살린다. 네 판단이 벌써 칼보다 앞선다.', '이름을 지우고 다니던 시절이 있었지. 너는 이름을 얻으며 이겼구나. 부럽다.'],
    mage: ['도술은 힘이 아니라 이치다. 네가 이치를 보기 시작했구나.', '기력이 깊어지면 말수가 줄어든다. 네가 요즘 말이 적은 까닭이다.', '하늘과 땅의 이치를 다 읽은 이는 없다. 그래서 너와 나는 아직 배우는 중이다.']
  };
  function bondOf(root) { var b = core.save.player.mentorBond; return (b && b[root]) || 0; }
  function bondGain(kills) {
    st();
    var root = rootOf(core.save.job);
    if (!root) { return null; }
    var p = core.save.player;
    if (!p.mentorBond) { p.mentorBond = {}; }
    if (!p.mentorSaid) { p.mentorSaid = {}; }
    p.mentorBond[root] = (p.mentorBond[root] || 0) + (kills || 1);
    var bond = Math.floor(p.mentorBond[root] / BOND_PER), i, out = null;
    for (i = 0; i < BOND_AT.length; i++) {
      var key = root + ':' + BOND_AT[i];
      if (bond >= BOND_AT[i] && !p.mentorSaid[key]) {
        p.mentorSaid[key] = true;
        var list = JD.mentorsOf(root), m = list[Math.min(list.length - 1, i)], h = m && global.DG.data ? global.DG.data.find(m) : null;
        p.gold = (p.gold || 0) + BOND_GOLD[i];
        core.log('🎓 사제 유대 ' + BOND_AT[i] + ' — ' + (h ? h.name + ': ' : '') + BOND_LINES[root][i] + ' · 금 +' + core.fmt(BOND_GOLD[i]), 'good');
        core.emit('toast', '🎓 ' + (h ? h.name + ' — ' : '스승 — ') + '"' + BOND_LINES[root][i] + '" (🪙 +' + core.fmt(BOND_GOLD[i]) + ')');
        core.persist();
        out = { root: root, at: BOND_AT[i] };
      }
    }
    return out;
  }
  core.on('side:kill', function (e) { if (e && !e.boss) { bondGain(1); } else if (e) { bondGain(5); } });

  global.DG = global.DG || {};
  global.DG.job = {
    BOND_AT: BOND_AT, BOND_PER: BOND_PER, BOND_LINES: BOND_LINES, bondOf: bondOf, bondGain: bondGain,
    BAR: BAR,
    state: st, cur: cur, levelOf: levelOf,
    spTotal: spTotal, spSpent: spSpent, spLeft: spLeft,
    canJoin: canJoin, join: join, resetJob: resetJob, canRaise: canRaise, raise: raise,
    bar: bar, mulOf: mulOf, grow: grow,
    schoolCounts: schoolCounts, activeSchools: activeSchools, schoolBonus: schoolBonus,
    dodgeCdMul: dodgeCdMul,
    rootOf: rootOf, mentors: mentors, mentorBoost: mentorBoost, signature: signature
  };
})(window);
