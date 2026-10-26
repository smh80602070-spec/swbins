/**
 * 5천하 장비 (W-0453, 사용자 10-26 「장수마다 특정 스킬이 있고 장비 아이템도 있고 해야해」)
 * ---------------------------------------------------------------
 * 장 흐름(campaign)의 내 장수 장비 칸 셋 — 무기(w)·방어구(a)·장신구(c). 보물(DG.item, rec.item)은 넷째 칸으로 그대로.
 * 칸마다 종류 넷 × 등급 다섯(일반·고급·희귀·영웅·전설) = 60. 이름·수치는 이 판 것. three·DOM 없이 돈다.
 *
 *   DG.realmGear.ITEMS · byId(id) · SLOT_NAME · GRADE
 *   DG.realmGear.apply(u)          heroSkill.unit 끝 — 내 장수(side me)에 낀 장비 수치를 얹는다(공·체력·받는 피해·명중·치명·이동)
 *   DG.realmGear.lineOf(it)        한 줄 설명
 *   DG.realmGear.stock(ch, round)  상점 진열(장 진행만큼 높은 등급이 풀림 · 장마다 바뀜)
 *   DG.realmGear.drop(ch, salt)    싸움 뒤 떨굼 하나
 *   DG.realmGear.price(it)
 * 세이브 = campaign 상태 cp.gear{장수id:{w,a,c}} · cp.gbag[] (campaign.js 가 읽고 씀).
 */
(function (global) {
  'use strict';
  var GRADE = [
    { key: 'n', name: '일반', pre: '낡은',   col: '#c9c2ad', mul: 1 },
    { key: 'u', name: '고급', pre: '단단한', col: '#7fd06a', mul: 1.7 },
    { key: 'r', name: '희귀', pre: '명장의', col: '#5fb0ff', mul: 2.5 },
    { key: 'e', name: '영웅', pre: '용장의', col: '#c07bff', mul: 3.5 },
    { key: 'l', name: '전설', pre: '천하의', col: '#ffb340', mul: 5 }
  ];
  var SLOT_NAME = { w: '무기', a: '방어구', c: '장신구' };
  /* 종류 — 수치는 일반 기준, 등급 배수(mul)를 곱한다 */
  var KINDS = [
    { k: 'sword', s: 'w', name: '검',     emoji: '🗡️', atk: 2.6 },
    { k: 'spear', s: 'w', name: '창',     emoji: '🔱', atk: 3 },
    { k: 'blade', s: 'w', name: '대도',   emoji: '⚔️', atk: 3.6, hit: -2 },
    { k: 'bow',   s: 'w', name: '활',     emoji: '🏹', atk: 2, hit: 3 },
    { k: 'hide',  s: 'a', name: '가죽 갑옷', emoji: '🦺', def: 4, hp: 4 },
    { k: 'scale', s: 'a', name: '비늘 갑옷', emoji: '🛡️', def: 5, hp: 6 },
    { k: 'plate', s: 'a', name: '판갑',   emoji: '🪖', def: 6.5, hp: 3 },
    { k: 'robe',  s: 'a', name: '비단 전포', emoji: '👘', def: 2.5, hp: 9 },
    { k: 'stirrup', s: 'c', name: '등자', emoji: '🐎', mov: 1, hp: 2 },
    { k: 'feather', s: 'c', name: '매 깃', emoji: '🪶', hit: 3 },
    { k: 'charm', s: 'c', name: '호부',   emoji: '🧧', crit: 4 },
    { k: 'belt',  s: 'c', name: '옥 띠',  emoji: '💠', hp: 7 }
  ];
  var ITEMS = [], BY = {};
  KINDS.forEach(function (K) {
    GRADE.forEach(function (G, gi) {
      var m = G.mul, it = { id: 'gr_' + K.k + '_' + G.key, slot: K.s, kind: K.k, grade: gi, name: G.pre + ' ' + K.name, emoji: K.emoji,
        atk: K.atk ? Math.round(K.atk * m) : 0, def: K.def ? Math.round(K.def * m) : 0, hp: K.hp ? Math.round(K.hp * m) : 0,
        hit: K.hit ? Math.round(K.hit * m) : 0, crit: K.crit ? Math.round(K.crit * m) : 0, mov: K.mov && gi >= 2 ? 1 : 0 };   // 등자 이동 +1 은 희귀부터
      ITEMS.push(it); BY[it.id] = it;
    });
  });
  function byId(id) { return BY[id] || null; }
  function price(it) { return it ? [80, 170, 340, 620, 1100][it.grade] : 0; }
  function lineOf(it) {
    if (!it) { return ''; }
    var a = [];
    if (it.atk) { a.push('공 +' + it.atk); } if (it.def) { a.push('받는 피해 −' + it.def + '%'); } if (it.hp) { a.push('체력 +' + it.hp); }
    if (it.hit) { a.push('명중 ' + (it.hit > 0 ? '+' : '') + it.hit + '%p'); } if (it.crit) { a.push('치명 ' + it.crit + '%'); } if (it.mov) { a.push('이동 +1'); }
    return a.join(' · ');
  }
  function worn(id) {
    var CP = global.DG.campaign, cp = CP && CP.on && CP.on() && CP.state ? CP.state() : null, g = cp && cp.gear ? cp.gear[id] : null, out = [];
    if (g) { ['w', 'a', 'c'].forEach(function (s) { var it = byId(g[s]); if (it) { out.push(it); } }); }
    return out;
  }
  function apply(u) {
    if (!u || u.kind !== 'officer' || u.side !== 'me') { return u; }
    worn(u.id).forEach(function (it) {
      u.atk += it.atk; u.max += it.hp; u.hp += it.hp; u.mov += it.mov;
      u.gearDef = (u.gearDef || 0) + it.def; u.gearHit = (u.gearHit || 0) + it.hit; u.gearCrit = (u.gearCrit || 0) + it.crit;
    });
    return u;
  }
  function hashS(s) { var h = 2166136261, i; s = String(s); for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  /** 장 진행만큼 풀리는 가장 높은 등급 — 1~3장 고급, 4~7 희귀, 8~12 영웅, 13~ 전설(회차면 한 단 더) */
  function topGrade(ch, round) { return Math.min(4, (ch >= 13 ? 4 : ch >= 8 ? 3 : ch >= 4 ? 2 : 1) + (round ? 1 : 0)); }
  function stock(ch, round) {
    var top = topGrade(ch, round), out = [], k;
    for (k = 0; k < 9; k++) { var K = KINDS[hashS('st' + ch + ':' + (round || 0) + ':' + k) % KINDS.length], g = Math.max(0, top - (hashS('sg' + ch + k) % 3)), id = 'gr_' + K.k + '_' + GRADE[g].key; if (out.indexOf(id) < 0) { out.push(id); } }
    return out.map(byId).sort(function (a, b) { return a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : b.grade - a.grade; });
  }
  function drop(ch, salt, round) {
    var top = topGrade(ch, round), h = hashS('dr' + ch + ':' + salt), K = KINDS[h % KINDS.length], r = (h >>> 8) % 100, g = r < 8 ? Math.min(4, top + 1) : r < 45 ? top : Math.max(0, top - 1);
    return byId('gr_' + K.k + '_' + GRADE[g].key);
  }

  global.DG = global.DG || {};
  global.DG.realmGear = { ITEMS: ITEMS, KINDS: KINDS, GRADE: GRADE, SLOT_NAME: SLOT_NAME, byId: byId, price: price, lineOf: lineOf, worn: worn, apply: apply, stock: stock, drop: drop, topGrade: topGrade };
})(typeof window !== 'undefined' ? window : this);
