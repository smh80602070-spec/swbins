/**
 * 적도(賊徒) — 원작의 악당 조직
 * ---------------------------------------------------------------
 * 역참은 여태 **늘 착한 자리**였다. 들르면 주고, 5분 쉬고, 또 준다. 원작에서
 * 보급 거점은 그렇지 않다 — 이따금 검게 물들고, 거기 선 자를 물리쳐야 원래대로
 * 돌아오며, 이긴 자리에는 **검게 물든 짐승**이 남는다. 그 축이 통째로 없었다.
 *
 *   악당 조직이 스탑을 점거 → 적도(賊徒)가 역참을 점거   깃발이 검어진다
 *   그런트 / 리더        → 졸개(卒) / 두목(頭目) / 수괴(首魁)
 *   3연전 배틀           → 교전 한 판 (`duel.js` 를 그대로 쓴다)
 *   섀도 몬스터          → 암영(暗影) — 이겨도 도감에 바로 들지 않는다
 *   퍼리파이(정화)       → 정화(淨化) — 단사를 써서 풀어 준다
 *
 * **어느 역참이 언제 점거되는지는 시각과 역참 키의 해시로 정한다** — 토벌(raid.js)과
 * 같은 방식이다. 서버가 없어도 어느 기기에서나 같고, 이 판이 지나면 저 역참이
 * 어떻게 되는지 미리 알 수 있다.
 *
 * **두 층으로 갈라 두었다.** 판정은 `at`·`fight`·`purify` 가 다 하고, 화면은
 * `open` 뿐이다. 교전을 거치지 않고 `fight(rg)` 를 인자 없이 부르면 예전 성채·토벌과
 * 같은 결로 즉시 판정한다(자동 순행과 자가진단이 그 길).
 *
 * **암영은 종(種)에 붙는다.** 이 판의 펫은 개체가 아니라 종이므로(도감이
 * `dex.pets[종id]`, 장착이 `petEquip[인물id] = 종id`), 암영도 종 단위로 센다.
 * 개체를 만들면 도감·장착·연성이 한꺼번에 뒤집힌다 — 인계 메모의 "권하지 않는 것".
 *
 * 수급은 늘 그렇듯 `growth.js` 한 곳으로만 넣는다(`addHerb`), 도감 등록은
 * `encounter.gainPet` 한 곳으로만 한다. 세이브 칸을 아는 자리를 늘리지 않는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;

  /* ── 규칙 상수 ────────────────────────────────────────── */
  /* 전부 어드민이 잡는 손잡이다(`core.tuned`) — 켤 때 한 번 읽는다 */

  /** 뜨고 지는 주기 — 역참은 성채보다 흔하니 토벌(한 시간)보다 짧게 잡는다 */
  var SLOT_MS = core.tuned('rogue.slotMin', 30) * 60 * 1000;
  /** 한 번 들면 이만큼 머문다. 지나면 스스로 물러간다 */
  var STAY_MS = core.tuned('rogue.stayMin', 20) * 60 * 1000;
  /** 한 칸에 점거되는 역참의 비율 */
  var RATE = core.tuned('rogue.rate', 0.22);
  /** 물리치지 못한 뒤 다시 붙기까지 */
  var COOL_MS = core.tuned('rogue.coolMin', 10) * 60 * 1000;
  /** 정화에 드는 단사 = 등급 × 이 값 */
  var PURIFY_DUST = core.tuned('rogue.purifyDust', 60);
  /** 정화하면 그 종의 영초를 이만큼 더 준다 (원작에서 정화가 사탕을 얹어 주는 자리) */
  var PURIFY_HERB = core.tuned('rogue.purifyHerb', 6);

  /**
   * 급(級) 셋. 원작의 그런트—리더—보스를 옮겼다.
   * `darkRarity` 는 이긴 자리에 남는 암영의 등급 범위다.
   *
   * **등급은 도감에 실제로 있는 것만 쓴다** — 이 판의 인물은 ★3·★4·★5 뿐이고
   * 짐승은 ★2~★5 다. 없는 등급을 적으면 뽑기가 조용히 폴백해 급과 두목이
   * 어긋난다(자가진단의 '짝맞는다' 항목이 그걸 못박는다).
   *
   * 기세(hpMul)는 **토벌의 절반쯤**으로 잡았다. 성채는 성기게 서 있어 하나가
   * 사건이지만, 역참은 구역마다 둘이라 자주 마주친다 — 같은 무게로 두면 걷는 일이
   * 통째로 싸움이 된다.
   */
  var RANKS = [
    { rank: 1, name: '졸개(卒)',   rarity: 3, hpMul: 3,  feat: 30,  gold: 90,
      darkRarity: [2, 3], quote: '"이 길은 우리가 맡았소. 돌아가시오."' },
    { rank: 2, name: '두목(頭目)', rarity: 4, hpMul: 7,  feat: 70,  gold: 220,
      darkRarity: [3, 4], quote: '"역참을 뺏은 지 오래요. 원한다면 힘으로 가져가시오."' },
    { rank: 3, name: '수괴(首魁)', rarity: 5, hpMul: 12, feat: 130, gold: 480,
      darkRarity: [4, 5], quote: '"내가 여기 선 이상, 이 길에 관(官)은 없소."' }
  ];

  /* 이 판의 core.hash2 는 0~0.5 만 돌려준다 — 두 배로 편다(world.js 주석) */
  function h01(a, b) { return Math.min(0.999999, core.hash2(a, b) * 2); }

  /** 역참 키('3,-2#1')를 해시에 쓸 두 수로 편다 */
  function keyNums(key) {
    var a = 0, b = 0, i;
    for (i = 0; i < key.length; i++) {
      a = (a * 31 + key.charCodeAt(i)) % 100003;
      b = (b * 17 + key.charCodeAt(key.length - 1 - i)) % 99991;
    }
    return [a, b];
  }

  /* ── 세이브 칸 ────────────────────────────────────────── */

  /** 세이브 칸이 없던 옛 세이브도 여기서 채운다 */
  function st() {
    var s = core.save;
    if (!s.rogue) {
      s.rogue = { beat: 0, purified: 0, cleared: {}, cool: {}, dark: {} };
    }
    var r = s.rogue;
    if (!r.cleared) { r.cleared = {}; }
    if (!r.cool) { r.cool = {}; }
    if (!r.dark) { r.dark = {}; }
    return r;
  }

  /**
   * 지나간 칸의 기록을 지운다 — 안 지우면 걸을수록 세이브가 늘기만 한다.
   * 역참의 쉬는 시간(station.stateOf)이 다 쉰 항목을 물어볼 때마다 지우는 것과 같은 손이다.
   */
  function sweep(ms) {
    var r = st(), now = ms === undefined ? Date.now() : ms;
    var slot = slotOf(now), k;
    for (k in r.cleared) {
      if (!Object.prototype.hasOwnProperty.call(r.cleared, k)) { continue; }
      if (Number(k.split('@')[1]) < slot) { delete r.cleared[k]; }
    }
    for (k in r.cool) {
      if (!Object.prototype.hasOwnProperty.call(r.cool, k)) { continue; }
      if (r.cool[k] <= now) { delete r.cool[k]; }
    }
  }

  /* ── 어느 역참에 언제 드는가 ──────────────────────────── */

  function slotOf(ms) { return Math.floor((ms === undefined ? Date.now() : ms) / SLOT_MS); }

  /**
   * 진단·데모가 붙들어 두는 손잡이 — `weather.force` 와 같은 뜻이다.
   *   force(false) 어느 역참도 점거되지 않는다
   *   force(null)  규칙대로 (기본)
   *
   * **이게 없으면 역참을 쓰는 옛 진단이 돌린 시각에 걸려 넘어진다.** 칸마다 역참의
   * 두 할이 점거되므로, 하필 그 칸에 진단을 돌리면 보급 항목이 통째로 깨진다.
   * 토벌에서 이미 한 번 밟은 함정이라 처음부터 문을 내 둔다.
   */
  var forced = null;
  function force(v) { forced = (v === false) ? false : null; }

  /**
   * 값싼 쪽 — 해시와 세이브만 본다(두목·암영을 고르지 않는다).
   * **지도가 프레임마다 역참마다 묻는다.** 여기서 도감 70인·41종을 훑으면
   * 그림이 그 자리에서 무거워진다. 그래서 두 층으로 갈랐다.
   *
   * **머무는 시간은 칸의 첫머리부터 잰다.** 진단이 "돌린 시각"에 끌려다니지 않게
   * 하려면 이 규칙을 지켜야 한다(토벌에서 한 번 밟은 함정이다 — 매시 45분 뒤에
   * 진단을 돌리면 다섯 항목이 한꺼번에 깨졌다).
   */
  function slotAt(station, ms) {
    if (forced === false) { return null; }
    if (!station || !station.key) { return null; }
    var now = ms === undefined ? Date.now() : ms;
    var slot = slotOf(now);
    var kn = keyNums(station.key);

    if (h01(kn[0] * 401 + slot * 53 + 7, kn[1] * 307 + slot * 29 + 11) > RATE) { return null; }

    var start = slot * SLOT_MS;
    if (now - start >= STAY_MS) { return null; }        // 머물 시간이 지났다

    var key = station.key + '@' + slot;
    if (st().cleared[key]) { return null; }             // 이미 물리친 판

    var rh = h01(kn[0] * 89 + slot * 71 + 3, kn[1] * 137 + slot * 13 + 5);
    return {
      kn: kn, slot: slot, key: key, now: now,
      rank: RANKS[rh < 0.58 ? 0 : (rh < 0.89 ? 1 : 2)],
      leftMs: start + STAY_MS - now
    };
  }

  /**
   * 이 역참에 지금 적도가 들어 있나 — 두목·암영까지 다 갖춘 한 판.
   *
   * @param {{key:string, name:string}} station 역참 (world.stationsIn 이 준 것)
   * @param {number} [ms] 시각 — 주지 않으면 지금
   * @returns {?object} 점거 중이면 그 판, 아니면 null
   */
  function at(station, ms) {
    var s = slotAt(station, ms);
    if (!s) { return null; }
    var boss = pickHero(s.kn, s.slot, s.rank);
    var dark = pickPet(s.kn, s.slot, s.rank);
    return {
      station: station,
      key: s.key,
      slot: s.slot,
      rank: s.rank,
      boss: boss,
      dark: dark,
      hp: Math.round(boss.stats.might * s.rank.hpMul + 40 * s.rank.hpMul),
      leftMs: s.leftMs,
      coolLeft: Math.max(0, (st().cool[s.key] || 0) - s.now)
    };
  }

  /** 두목 — 그 급의 등급을 가진 인물 중에서 (늘 같은 역참·같은 칸이면 같은 사람) */
  function pickHero(kn, slot, r) {
    var pool = data.heroes.filter(function (x) { return x.rarity === r.rarity; });
    if (!pool.length) { pool = data.heroes.filter(function (x) { return x.rarity >= 2; }); }
    if (!pool.length) { pool = data.heroes.slice(); }
    var i = Math.floor(h01(kn[0] * 211 + slot * 17 + 1, kn[1] * 43 + slot * 97 + 2) * pool.length);
    return pool[Math.min(pool.length - 1, i)];
  }

  /** 암영 — 그 급의 등급 범위에서 */
  function pickPet(kn, slot, r) {
    var lo = r.darkRarity[0], hi = r.darkRarity[1];
    var pool = data.pets.filter(function (x) { return x.rarity >= lo && x.rarity <= hi; });
    if (!pool.length) { pool = data.pets.slice(); }
    var i = Math.floor(h01(kn[0] * 349 + slot * 23 + 9, kn[1] * 79 + slot * 59 + 4) * pool.length);
    return pool[Math.min(pool.length - 1, i)];
  }

  /**
   * 지금 둘레의 역참 중 점거된 것 — 가까운 것부터.
   * (지도와 자동 순행이 읽는다)
   */
  function nearby(ms) {
    var W = global.DG.world;
    if (!W || !W.stationsNear) { return []; }
    var list = W.stationsNear(), out = [], i;
    for (i = 0; i < list.length; i++) {
      var rg = at(list[i], ms);
      if (rg) { rg.dist = list[i].dist; out.push(rg); }
    }
    return out;
  }

  /** 점거되었나 — 역참 하나만 빠르게 (지도가 프레임마다 묻는다) */
  function occupied(station, ms) { return !!slotAt(station, ms); }

  /** 점거된 급만 — 지도가 깃발 빛깔을 정할 때 (역시 값싼 쪽) */
  function rankAt(station, ms) {
    var s = slotAt(station, ms);
    return s ? s.rank : null;
  }

  /* ── 싸움 ─────────────────────────────────────────────── */

  /**
   * 물리친다.
   *
   * `opts` 를 **주지 않으면** 열 합을 즉시 굴려 승패를 낸다(토벌·성채와 같은 결).
   * 손으로 교전(`duel.js`)을 치르고 왔을 때만 `opts.live` 가 온다 — 그때는
   * **화면에서 실제로 낸 피해가 곧 판정이다.**
   *
   * @param {object} rg at() 이 준 판
   * @param {{live:boolean, dealt:number, folded?:Array}} [opts]
   */
  function fight(rg, opts) {
    if (!rg) { return { ok: false, reason: 'none' }; }
    var r = st(), now = Date.now();
    if (r.cleared[rg.key]) { return { ok: false, reason: 'cleared' }; }
    if ((r.cool[rg.key] || 0) > now) {
      return { ok: false, reason: 'cool', left: r.cool[rg.key] - now };
    }
    if (!core.save.party.length) { return { ok: false, reason: 'noparty' }; }

    var pw = global.DG.hero.partyPower();
    var hp = rg.hp, rounds = [], i;
    if (opts && opts.live) {
      hp = Math.max(0, rg.hp - Math.max(0, opts.dealt || 0));
      rounds = opts.folded || [];
    } else {
      for (i = 1; i <= 10 && hp > 0; i++) {
        var swing = Math.round(pw.atk * (0.75 + Math.random() * 0.5));
        hp -= swing;
        rounds.push({ n: i, dmg: swing, left: Math.max(0, hp) });
      }
    }
    var win = hp <= 0;

    if (!win) {
      r.cool[rg.key] = now + COOL_MS;
      var exp0 = core.gainExp(Math.round(rg.rank.feat / 4));
      core.log('🏴 ' + rg.station.name + ' — ' + rg.boss.name +
        ' 을(를) 물리치지 못했다 (남은 기세 ' + Math.max(0, hp) + ')', 'bad');
      var lost = (opts && opts.live && global.DG.drop) ? global.DG.drop.lose() : null;   // 패배 비용(⑧) — 손으로 진 판만
      core.emit('changed');
      core.persist();
      return { ok: true, win: false, rounds: rounds, left: Math.max(0, hp),
        rogue: rg, reward: { exp: exp0 }, drop: lost };
    }

    /* 이겼다 — 역참이 풀리고, 두고 간 암영 하나가 남는다 */
    r.cleared[rg.key] = true;
    delete r.cool[rg.key];
    r.beat = (r.beat || 0) + 1;

    var feat = rg.rank.feat, gold = rg.rank.gold;
    core.gainFeat(feat, '적도');
    var exp = core.gainExp(feat * 2);
    core.save.player.gold += gold;
    core.save.player.fame += rg.rank.rank * 20;
    global.DG.hero.awardParty(rg.rank.rank * 5);
    var left = takeDark(rg.dark, rg.rank.rank);
    if (global.DG.quest) { global.DG.quest.progress('rogue', 1); }

    core.log('🏴 ' + rg.station.name + ' 탈환! ' + rg.rank.name + ' ' + rg.boss.name +
      ' 을(를) 물렸다 · 🪙 +' + gold + ' · 🌑 ' + rg.dark.name + ' 이(가) 남았다', 'good');
    var back = global.DG.drop ? global.DG.drop.win() : null;   // 떨어진 짐 회수(⑧)
    core.emit('changed');
    core.persist();
    return {
      ok: true, win: true, rounds: rounds, rogue: rg,
      dark: rg.dark, darkCount: left,
      reward: { feat: feat, gold: gold, exp: exp }, recovered: back
    };
  }

  /**
   * 자동 순행이 부르는 문 — **이길 만할 때만** 붙는다.
   * (열 합 안에 꺾어야 하니 부대 공격력이 기세의 1/7 은 되어야 한다 — 토벌과 같은 잣대)
   */
  function autoFight(rg) {
    if (!rg) { return null; }
    var r = st();
    if (r.cleared[rg.key] || (r.cool[rg.key] || 0) > Date.now()) { return null; }
    var pw = global.DG.hero.partyPower();
    if (pw.atk * 7 < rg.hp) { return null; }
    var res = fight(rg);
    return res.ok ? res : null;
  }

  /* ── 암영(暗影)과 정화(淨化) ──────────────────────────── */

  /** 암영 하나를 안는다 (종별로 센다) */
  function takeDark(pet, rank) {
    var d = st().dark;
    if (!d[pet.id]) { d[pet.id] = { n: 0, rank: rank || 1, at: Date.now() }; }
    d[pet.id].n += 1;
    if ((rank || 1) > d[pet.id].rank) { d[pet.id].rank = rank; }
    return d[pet.id].n;
  }

  /** 지금 안고 있는 암영 — 화면이 읽는 꼴로 */
  function darkList() {
    var d = st().dark, out = [], k;
    for (k in d) {
      if (!Object.prototype.hasOwnProperty.call(d, k)) { continue; }
      if (!(d[k].n > 0)) { continue; }
      var pet = data.find(k);
      if (!pet) { continue; }
      out.push({ pet: pet, n: d[k].n, rank: d[k].rank, cost: purifyCost(pet) });
    }
    out.sort(function (a, b) { return b.pet.rarity - a.pet.rarity; });
    return out;
  }

  function darkCount() {
    var d = st().dark, n = 0, k;
    for (k in d) {
      if (Object.prototype.hasOwnProperty.call(d, k)) { n += d[k].n || 0; }
    }
    return n;
  }

  /** 정화 값 — 등급을 탄다. 단사는 연성에도 쓰이므로 이 값이 곧 선택이 된다 */
  function purifyCost(pet) {
    return { dust: (pet.rarity || 1) * PURIFY_DUST };
  }

  function purifyCheck(petId) {
    var d = st().dark[petId];
    if (!d || !(d.n > 0)) { return { ok: false, why: '안고 있지 않다' }; }
    var pet = data.find(petId);
    if (!pet) { return { ok: false, why: '없는 종' }; }
    var c = purifyCost(pet);
    var have = global.DG.growth ? global.DG.growth.dust() : (core.save.dust || 0);
    if (have < c.dust) { return { ok: false, why: '단사 부족', cost: c, pet: pet }; }
    return { ok: true, cost: c, pet: pet };
  }

  /**
   * 정화한다 — 암영이 풀리며 **그때 비로소 도감에 든다.**
   * 도감 등록·공적·금은 `encounter.gainPet` 한 문으로만 지난다(포획과 같은 길).
   * 원작에서 정화가 사탕을 얹어 주듯 그 종의 영초를 조금 더 준다.
   */
  function purify(petId) {
    var chk = purifyCheck(petId);
    if (!chk.ok) { return { ok: false, reason: chk.why, cost: chk.cost }; }
    var pet = chk.pet, r = st();

    core.save.dust = (global.DG.growth ? global.DG.growth.dust() : (core.save.dust || 0)) - chk.cost.dust;
    r.dark[petId].n -= 1;
    if (r.dark[petId].n <= 0) { delete r.dark[petId]; }
    r.purified = (r.purified || 0) + 1;

    var got = global.DG.encounter.gainPet(pet);
    var herb = global.DG.growth ? global.DG.growth.addHerb(pet.id, PURIFY_HERB) : 0;

    core.log('🌕 ' + pet.name + ' 정화 — ✨ 단사 −' + chk.cost.dust +
      ' · 🌿 영초 +' + (got.herb + herb), 'good');
    core.emit('toast', '🌕 ' + pet.name + ' 을(를) 정화했습니다 — 도감에 들었습니다');
    core.emit('changed');
    core.persist();
    return { ok: true, pet: pet, cost: chk.cost, gained: got, bonusHerb: herb };
  }

  /* ── 화면 ─────────────────────────────────────────────── */

  var active = false, cur = null;

  function host() { return document.getElementById('encounter'); }

  function close() {
    active = false; cur = null;
    var el = host();
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    core.emit('changed');
  }

  function leftLabel(ms) {
    var m = Math.ceil(ms / 60000);
    return m + '분';
  }

  /**
   * 점거된 역참을 눌렀을 때 (station.js 가 넘겨 준다).
   *
   * `rg` 를 받으면 그 판을 그대로 연다 — **데모가 쓰는 문이다.** 적도는 칸이
   * 열리고 20분만 머물러서, 스크린샷을 찍는 그 순간에 점거된 역참이 곁에
   * 있으리라는 보장이 없다. 데모는 미리 찾아 둔 판을 여기로 넘긴다.
   * 게임 코드는 늘 인자 없이 부른다(그때는 규칙대로 지금 시각을 본다).
   */
  function open(station, rg) {
    if (global.DG.encounter && global.DG.encounter.active) { return; }
    rg = rg || at(station);
    if (!rg) { return; }
    var el = host();
    if (!el) { return; }
    cur = rg;
    active = true;
    render();
    el.classList.add('show');
  }

  function render() {
    var el = host();
    if (!el || !cur) { return; }
    var rg = cur;
    var pw = global.DG.hero.partyPower();
    var hopeless = pw.atk * 7 < rg.hp;
    el.innerHTML =
      '<div class="enc-card rogue">' +
        '<div class="enc-big">' + global.DG.portrait3d.img('hero', rg.boss, 96) + '</div>' +
        '<h3>🏴 ' + rg.station.name + ' — ' + rg.rank.name + ' ' + rg.boss.name + '</h3>' +
        '<p class="quote">' + rg.rank.quote + '</p>' +
        '<div class="enc-reward">기세 ' + core.fmt(rg.hp) +
          ' · 물러가기까지 ' + leftLabel(rg.leftMs) + '</div>' +
        '<div class="enc-reward">🌑 물리치면 <b>' + rg.dark.name +
          '</b> 이(가) 암영으로 남습니다 — 정화해야 도감에 듭니다</div>' +
        (rg.coolLeft > 0
          ? '<div class="enc-reward warn">숨을 고르는 중 — ' + leftLabel(rg.coolLeft) +
              ' 뒤에 다시 붙을 수 있습니다</div>'
          : (hopeless
              ? '<div class="enc-reward warn">부대가 아직 모자랍니다 (공격 ' +
                  core.fmt(pw.atk) + ' · 기세 ' + core.fmt(rg.hp) + ')</div>'
              : '<div class="enc-hint">속공을 연타하고, 기(氣)가 차면 <b>필살</b> — <b>강타 예고</b>엔 회피.</div>')) +
        (rg.coolLeft > 0 ? ''
          : '<button class="btn primary wide" data-act="fight">🏴 길을 연다</button>') +
        '<button class="btn ghost wide" data-act="back">물러선다</button>' +
        '<small class="muted">이 역참은 물리쳐야 보급을 줍니다.</small>' +
      '</div>';
    bind();
  }

  function bind() {
    var el = host();
    if (!el) { return; }
    var f = el.querySelector('[data-act="fight"]');
    if (f) { f.addEventListener('click', startDuel); }
    var b = el.querySelector('[data-act="back"]');
    if (b) { b.addEventListener('click', close); }
    var ok = el.querySelector('[data-act="ok"]');
    if (ok) { ok.addEventListener('click', close); }
    var p = el.querySelector('[data-act="purify"]');
    if (p) {
      p.addEventListener('click', function () {
        var res = purify(p.getAttribute('data-pet'));
        if (!res.ok) {
          core.emit('toast', '✨ 단사가 모자랍니다 (' +
            (res.cost ? res.cost.dust : '?') + ' 필요)');
          return;
        }
        renderPurified(res);
      });
    }
  }

  /**
   * 교전으로 넘긴다. **도적전만** 사가나락식 실시간 위치 전투(`rogue-action.js`)로
   * 연다 — 야생 조우·성채·토벌은 그대로 `duel.js` 카드를 쓴다. `rogue-action.js`가
   * 없으면 `duel.js`로, 그마저 없으면 예전처럼 즉시 판정한다(스크립트 하나가
   * 빠졌다고 역참이 통째로 막히면 안 된다 — 성채와 같은 손).
   */
  function startDuel() {
    var rg = cur;
    if (!rg) { return; }
    var D = global.DG.rogueAction || global.DG.duel;
    if (!D) { finish(fight(rg)); return; }
    var pw = global.DG.hero.partyPower();
    /* "길을 연다"를 눌러도 이 카드(기세·물러가기까지 남은 시간)는 스스로
       숨지 않는다 — `D.open()`은 제 화면(`#rogue-hud`)만 관리할 뿐 이 카드는
       모른다. 실제로 붙여 보고서야 드러났다(2026-09-06, "적도 실전에서 강타
       회피가 되는지" 확인하다 발견) — 카드가 실시간 HUD·3D 교전을 통째로
       덮어 사실상 아무것도 안 보였다. 여기서 직접 숨기고, `finish()`가
       결과창을 다시 켤 때 · 아래 "없던 일" 갈래가 카드를 되살릴 때 다시 켠다. */
    var el = host();
    if (el) { el.classList.remove('show'); }
    D.open({
      title: '🏴 적도 — ' + rg.station.name,
      foeName: rg.rank.name + ' ' + rg.boss.name,
      /* 3D 무대(`world3d.duelStage`) — `event.js` 만 이 값을 건네고 있었다.
         적도의 두목은 `data.heroes` 의 진짜 인물이라 그대로 넘기면 된다 */
      stage3d: { kind: 'hero', ref: rg.boss },
      foeHp: rg.hp, myAtk: pw.atk, myDef: pw.def,
      onDone: function (p) {
        /* 한 대도 못 때리고 물러났으면 없던 일로 한다 (쿨다운도 안 붙는다) */
        if (p.fled && p.dealt <= 0) {
          var el2 = host();
          if (el2) { el2.classList.add('show'); }
          render();
          return;
        }
        finish(fight(rg, { live: true, dealt: p.dealt, folded: p.folded }), p);
      }
    });
  }

  function finish(res, p) {
    if (!res || !res.ok) { render(); return; }
    var el = host();
    if (!el) { return; }
    active = true;
    el.classList.add('show');
    if (!res.win) {
      el.innerHTML =
        '<div class="enc-card result bad">' +
          '<h3>🏴 ' + res.rogue.station.name + ' — 물리치지 못했다</h3>' +
          '<p class="quote">"다음에 오시오. 그때는 길을 비켜 드릴지도."</p>' +
          '<div class="enc-reward">남은 기세 ' + core.fmt(res.left) +
            ' · 경험치 +' + res.reward.exp + '</div>' +
          (global.DG.drop ? global.DG.drop.cardLine(res.drop) : '') +
          perfLine(p) +
          '<button class="btn ghost wide" data-act="ok">확인</button>' +
        '</div>';
      bind();
      return;
    }
    var pet = res.dark, c = purifyCost(pet);
    var have = global.DG.growth ? global.DG.growth.dust() : (core.save.dust || 0);
    el.innerHTML =
      '<div class="enc-card result good">' +
        '<div class="enc-big">' + global.DG.portrait3d.img('pet', pet, 96, 'dark') + '</div>' +
        '<h3>🏴 ' + res.rogue.station.name + ' 탈환!</h3>' +
        '<p class="quote">적도가 물러가며 <b>' + pet.name + '</b> 을(를) 두고 갔다 — 검게 물들어 있다.</p>' +
        '<div class="enc-reward">공적 +' + res.reward.feat + ' · 금 +' + res.reward.gold +
          ' · 경험치 +' + res.reward.exp + '</div>' +
        (global.DG.drop ? global.DG.drop.backLine(res.recovered) : '') +
        perfLine(p) +
        '<div class="enc-reward">🌑 암영 ' + res.darkCount + '마리 안고 있습니다 · ✨ 단사 ' +
          core.fmt(have) + ' / ' + c.dust + ' 필요</div>' +
        (have >= c.dust
          ? '<button class="btn primary wide" data-act="purify" data-pet="' + pet.id +
              '">🌕 정화한다 (✨ ' + c.dust + ')</button>'
          : '') +
        '<button class="btn ghost wide" data-act="ok">나중에</button>' +
        '<small class="muted">정화하지 않으면 도감에 들지 않습니다 — ' +
          '<b>도감 맨 위 암영 칸</b>에서 언제든 풀 수 있습니다.</small>' +
      '</div>';
    bind();
  }

  function renderPurified(res) {
    var el = host();
    if (!el) { return; }
    el.innerHTML =
      '<div class="enc-card result good">' +
        '<div class="enc-big">' + global.DG.portrait3d.img('pet', res.pet, 96) + '</div>' +
        '<h3>🌕 ' + res.pet.name + ' 정화</h3>' +
        '<p class="quote">검은 기운이 걷히고, 도감에 이름이 올랐다.</p>' +
        '<div class="enc-reward">✨ 단사 −' + res.cost.dust +
          ' · 공적 +' + res.gained.feat + ' · 금 +' + res.gained.gold +
          ' · 경험치 +' + res.gained.exp + '</div>' +
        '<div class="enc-reward">🌿 ' + res.pet.name + ' 영초 +' +
          (res.gained.herb + res.bonusHerb) + '</div>' +
        '<button class="btn primary wide" data-act="ok">확인</button>' +
      '</div>';
    bind();
  }

  /** 교전 실적 한 줄 — 성채·토벌의 결과 화면과 같은 꼴 */
  function perfLine(p) {
    if (!p) { return ''; }
    return '<div class="enc-reward">교전 · 속공 ' + p.hits + '회 · 필살 ' + p.ults +
      '회 · 회피 ' + p.dodgeOk + '/' + p.dodgeTry +
      ' · 받은 피해 ' + core.fmt(p.taken) +
      (p.fled ? ' · <b class="warn">물러났다</b>' : '') + '</div>';
  }

  global.DG = global.DG || {};
  global.DG.rogue = {
    SLOT_MS: SLOT_MS, STAY_MS: STAY_MS, RATE: RATE, COOL_MS: COOL_MS,
    RANKS: RANKS, PURIFY_DUST: PURIFY_DUST, PURIFY_HERB: PURIFY_HERB,
    /* 판정 층 — 화면 없이 굴린다 (자가진단과 자동 순행이 쓰는 문) */
    state: st, sweep: sweep, slotOf: slotOf, force: force,
    at: at, occupied: occupied, rankAt: rankAt, nearby: nearby,
    fight: fight, autoFight: autoFight,
    darkList: darkList, darkCount: darkCount,
    purifyCost: purifyCost, purifyCheck: purifyCheck, purify: purify,
    leftLabel: leftLabel,
    /* 화면 층 */
    open: open, close: close,
    /** 데모가 결과 화면을 정지 화면으로 붙잡을 때만 쓰는 문 (게임 코드는 부르지 않는다) */
    _finish: function (res, p) { finish(res, p); },
    get active() { return active; }
  };
})(window);
