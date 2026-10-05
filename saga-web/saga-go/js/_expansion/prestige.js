/**
 * 환생 — 재봉(再封) · 도장(印)
 * ---------------------------------------------------------------
 * 방치형의 뼈대. 진행을 자리 밀고 **영구 강화**를 사 모은다.
 *
 *   재봉(再封)  관문 · 건물 · 영지 · 자원 · 인물 레벨을 되돌리고 도장을 받는다
 *   도장(印)    영구 화폐. 써도 되돌아오지 않지만 재봉해도 사라지지 않는다
 *
 *   되돌아가는 것   관문 · 건물 · 영지(구역·태수) · 금/명성/공적 · 인물 레벨·승급
 *   그대로 남는 것   도감(수집·중복) · 펫 · 장비(가방·장착) · 던전 기록 · 도장과 그 구매
 *
 * 도장 구매 효과는 core.effect() 키를 그대로 쓴다 — 건물·특산과 같은 통로다.
 * 자동화 해금도 여기서 판다(idle.js 가 해금 여부만 물어본다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /**
   * 도장 상점.
   *   eff(lv)  core.effect() 에 합산될 효과
   *   flag     효과 대신 무언가를 열어 주는 것 (자동화 해금)
   *   cost(lv) 다음 단계 값 (도장)
   */
  var BUYS = [
    {
      key: 'lineage', name: '세습(世襲)', emoji: '🏯', max: 20,
      desc: '금·명성 생산이 늘어난다',
      cost: function (lv) { return 1 + lv; },
      eff: function (lv) { return { 'gold/min': lv * 6, 'fame/min': lv * 1.2 }; }
    },
    {
      key: 'command', name: '병권(兵權)', emoji: '⚔️', max: 20,
      desc: '부대 공격력이 오른다',
      cost: function (lv) { return 1 + lv; },
      eff: function (lv) { return { atkPct: lv * 5 }; }
    },
    {
      key: 'rampart', name: '성세(城勢)', emoji: '🧱', max: 20,
      desc: '부대 체력이 오른다',
      cost: function (lv) { return 1 + lv; },
      eff: function (lv) { return { hpPct: lv * 6 }; }
    },
    {
      key: 'learning', name: '학문(學問)', emoji: '📚', max: 15,
      desc: '경험치 획득이 늘어난다',
      cost: function (lv) { return 2 + lv; },
      eff: function (lv) { return { expPct: lv * 8 }; }
    },
    {
      key: 'eye', name: '안목(眼目)', emoji: '🔎', max: 15,
      desc: '좋은 장비가 나올 확률이 오른다',
      cost: function (lv) { return 2 + lv; },
      eff: function (lv) { return { findPct: lv * 9 }; }
    },
    {
      key: 'merchant', name: '상재(商才)', emoji: '🪙', max: 15,
      desc: '전투·던전에서 얻는 금이 늘어난다',
      cost: function (lv) { return 2 + lv; },
      eff: function (lv) { return { goldPct: lv * 10, lootPct: lv * 4 }; }
    },
    {
      key: 'store', name: '창고(倉庫)', emoji: '📦', max: 10,
      desc: '가방 칸이 늘어난다 (단계당 12칸)',
      cost: function (lv) { return 2 + lv * 2; },
      eff: function (lv) { return { bagSlots: lv * 12 }; }
    },
    {
      key: 'vanguard', name: '선봉(先鋒)', emoji: '🚩', max: 10,
      desc: '재봉 후 시작 관문이 올라간다 (단계당 2관문)',
      cost: function (lv) { return 3 + lv * 2; },
      eff: function () { return {}; }
    },
    {
      key: 'auto_recruit', name: '천거(薦擧)', emoji: '📜', max: 1,
      desc: '자동 등용 — 걷다가 만난 인물을 알아서 등용한다',
      cost: function () { return 5; }, flag: 'recruit',
      eff: function () { return {}; }
    },
    {
      key: 'auto_catch', name: '포수(捕手)', emoji: '🍖', max: 1,
      desc: '자동 포획 — 만난 펫을 알아서 포획한다',
      cost: function () { return 5; }, flag: 'catch',
      eff: function () { return {}; }
    },
    {
      key: 'auto_rank', name: '승차(陞差)', emoji: '✨', max: 1,
      desc: '자동 승급 — 중복 인물이 쌓이면 알아서 승급한다',
      cost: function () { return 8; }, flag: 'rankup',
      eff: function () { return {}; }
    },
    {
      key: 'auto_gear', name: '군기시(軍器寺)', emoji: '🧹', max: 1,
      desc: '자동 장비 — 좋은 것은 입히고 쓸모없는 것은 판다',
      cost: function () { return 8; }, flag: 'gear',
      eff: function () { return {}; }
    }
  ];

  function byKey(k) {
    for (var i = 0; i < BUYS.length; i++) { if (BUYS[i].key === k) { return BUYS[i]; } }
    return null;
  }

  function st() {
    var s = core.save;
    if (!s.prestige) { s.prestige = { seals: 0, count: 0, buys: {}, earned: 0 }; }
    if (!s.prestige.buys) { s.prestige.buys = {}; }
    return s.prestige;
  }

  function level(key) { return st().buys[key] || 0; }

  /** 도장을 준다 — 던전 최고 층 갱신 같은 곳에서도 부른다 */
  function gainSeal(n, why) {
    n = Math.max(0, Math.round(n));
    if (!n) { return; }
    st().seals += n;
    st().earned += n;
    core.log('🔖 도장 +' + n + ' (' + why + ')', 'feat');
    core.emit('toast', '🔖 도장 +' + n);
    core.emit('changed');
  }

  /**
   * 지금 재봉하면 받을 도장.
   * 누적 공적 · 최고 관문 · 던전 최고 층을 함께 본다.
   */
  function sealGain() {
    var p = core.save.player;
    var b = core.save.battle;
    var d = core.save.dungeon || {};
    var fromFeat = Math.floor(Math.sqrt(Math.max(0, p.featTotal) / 55));
    var fromStage = Math.floor((b.best || 1) / 3);
    var fromFloor = Math.floor((d.best || 0) / 2);
    return { total: fromFeat + fromStage + fromFloor, feat: fromFeat, stage: fromStage, floor: fromFloor };
  }

  /** 재봉 가능 조건 — 너무 이르면 의미가 없다 */
  function canReborn() {
    var g = sealGain();
    if (g.total < 1) { return { ok: false, why: '아직 받을 도장이 없습니다', gain: g }; }
    if ((core.save.battle.best || 1) < 5) { return { ok: false, why: '제5관문까지는 가 봐야 합니다', gain: g }; }
    return { ok: true, gain: g };
  }

  /** 재봉 후 시작 관문 */
  function startStage() {
    return 1 + level('vanguard') * 2;
  }

  /**
   * 재봉 — 진행을 되돌리고 도장을 받는다.
   * 무엇이 남고 무엇이 사라지는지는 파일 머리 주석에 적어 두었다.
   */
  function reborn() {
    var chk = canReborn();
    if (!chk.ok) { return false; }
    var got = chk.gain.total;
    var s = core.save;

    // ── 되돌린다
    s.player.level = 1;
    s.player.exp = 0;
    s.player.gold = 200;
    s.player.fame = 60;
    s.player.feat = 0;
    s.player.featTotal = 0;
    // 경영(건설·영지)은 삭제됐다 — 옛 세이브에 남은 경우만 되돌린다(없으면 TypeError 였다)
    if (s.build) { s.build.done = {}; s.build.site = null; }
    if (s.territory) {
      s.territory.regions = {}; s.territory.pending = {};
      s.territory.governors = {}; s.territory.capital = null;
    }
    s.battle = {
      stage: startStage(), wave: 1, auto: true,
      lastTick: Date.now(), best: startStage()
    };
    var h;
    for (h in s.heroes) {
      if (Object.prototype.hasOwnProperty.call(s.heroes, h)) {
        s.heroes[h] = { lv: 1, exp: 0, rank: 0 };
      }
    }
    if (s.idle) { s.idle.up = {}; }               // 금으로 산 방치 업그레이드도 초기화

    // ── 받는다
    st().seals += got;
    st().earned += got;
    st().count += 1;

    core.log('♻️ 재봉(再封) ' + st().count + '회 · 도장 +' + got +
      ' (제' + startStage() + '관문부터 다시)', 'good');
    core.emit('toast', '♻️ 재봉 완료 · 도장 +' + got);
    core.emit('changed');
    core.persist();
    return true;
  }

  /* ── 구매 ─────────────────────────────────────────────── */

  function buyInfo(key) {
    var def = byKey(key);
    if (!def) { return null; }
    var lv = level(key);
    var max = lv >= def.max;
    var cost = max ? null : def.cost(lv);
    return {
      def: def, lv: lv, max: max, cost: cost,
      afford: !max && st().seals >= cost,
      next: max ? null : def.eff(lv + 1),
      cur: def.eff(lv)
    };
  }

  function buy(key) {
    var info = buyInfo(key);
    if (!info || info.max || !info.afford) { return false; }
    st().seals -= info.cost;
    st().buys[key] = info.lv + 1;
    core.log('🔖 ' + info.def.name + ' ' + (info.lv + 1) + '단계 (도장 -' + info.cost + ')', 'good');
    core.emit('toast', info.def.emoji + ' ' + info.def.name + ' ' + (info.lv + 1) + '단계');
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 자동화가 열려 있는가 (idle.js 가 물어본다) */
  function unlocked(flag) {
    for (var i = 0; i < BUYS.length; i++) {
      if (BUYS[i].flag === flag) { return level(BUYS[i].key) > 0; }
    }
    return false;
  }

  /** core.effect() 훅 */
  function bonus() {
    var out = {}, i;
    for (i = 0; i < BUYS.length; i++) {
      var lv = level(BUYS[i].key);
      if (!lv) { continue; }
      var eff = BUYS[i].eff(lv), k;
      for (k in eff) {
        if (Object.prototype.hasOwnProperty.call(eff, k)) {
          out[k] = (out[k] || 0) + eff[k];
        }
      }
    }
    return out;
  }

  global.DG = global.DG || {};
  global.DG.prestige = {
    BUYS: BUYS, byKey: byKey, state: st, level: level,
    sealGain: sealGain, canReborn: canReborn, reborn: reborn, startStage: startStage,
    buyInfo: buyInfo, buy: buy, unlocked: unlocked, gainSeal: gainSeal, bonus: bonus
  };
})(window);
