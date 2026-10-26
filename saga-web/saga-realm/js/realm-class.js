/**
 * 5천하 전직 — 랑그릿사식 클래스 체인지 (W-0457, 사용자 10-26 「랑그릿사나 창세기전 같은 턴 방식이고 잼나야함」)
 * ---------------------------------------------------------------
 * Lv5 에 1차(맹장·기장·군사 중 하나), Lv12 에 2차(1차마다 둘 중 하나). 이름·수치는 이 판 것.
 * 「덤 병종」 = 그 병종 휘하 용병 체력 +20% · 공 +1. 적장은 장 단계(tier)로 직업을 받는다(0.3 → 1차 · 0.6 → 2차, 씨앗으로 갈래).
 * 장 흐름(campaign)이 opts.cls = {장수 id: 직업 키} 를 넘기면 판 규칙 층(tactics.js)이 한 줄씩 부른다. three·DOM 없이 돈다(진단이 본다).
 *
 *   DG.realmClass.CLS · LV1 · LV2 · choices(lv, cur) · apply(b, opts) · mods(b, att, tgt, out) · turnStart(b) · foeClass(seed, id, tier) · line(key)
 * 손잡이 rtk.class(1, 0 = 직업 없음).
 */
(function (global) {
  'use strict';
  function C() { return global.DG.core; }
  function T() { return global.DG.tactics; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('rtk.class', 1)); }

  var LV1 = 5, LV2 = 12, FAVOR_HP = 0.2;
  /* t = 단계(1·2) · from = 앞 직업 · fav = 덤 병종 · fx = 판에서 얹는 것 */
  var CLS = {
    brave:    { t: 1, name: '맹장',   emoji: '🪓', fav: 'spear', desc: '공 +4 · 체력 +15 · 창병 덤', fx: { atk: 4, hp: 15 } },
    rider:    { t: 1, name: '기장',   emoji: '🐎', fav: 'cav',   desc: '이동 +1 · 뒤치기 명중 +10%p · 기병 덤', fx: { mov: 1, back: 10 } },
    tactic:   { t: 1, name: '군사',   emoji: '📜', fav: 'bow',   desc: '사거리 2 이상 · 책략 +1 · 궁병 덤', fx: { rng2: 1, plots: 1 } },
    overlord: { t: 2, from: 'brave',  name: '패왕',   emoji: '👹', fav: 'spear', desc: '공 +10 · 체력 +40 · 필살 피해 ×1.3', fx: { atk: 10, hp: 40, ultMul: 1.3 } },
    bulwark:  { t: 2, from: 'brave',  name: '철벽장', emoji: '🛡️', fav: 'spear', desc: '공 +4 · 체력 +15 · 방 +4 · 노리는 적 명중 −8%p · 휘하 체력 +25%', fx: { atk: 4, hp: 15, def: 4, guard: 8, mercHp: 0.25 } },
    raider:   { t: 2, from: 'rider',  name: '비장',   emoji: '🦅', fav: 'cav',   desc: '이동 +2 · 뒤치기 +20%p · 맞붙어 쳐도 반격 안 받음', fx: { mov: 2, back: 20, noCounter: 1 } },
    marshal:  { t: 2, from: 'rider',  name: '대장군', emoji: '🚩', fav: 'cav',   desc: '이동 +1 · 뒤치기 +10%p · 지휘 +1칸·덤 +5%p · 휘하 기병 이동 +1', fx: { mov: 1, back: 10, cmdR: 1, cmdA: 5, cavMov: 1 } },
    sage:     { t: 2, from: 'tactic', name: '귀모',   emoji: '🌀', fav: 'bow',   desc: '사거리 2 이상 · 책략 +2 · 천뢰 ×1.3·4칸', fx: { rng2: 1, plots: 2, boltMul: 1.3, boltR: 4 } },
    healer:   { t: 2, from: 'tactic', name: '현자',   emoji: '🌿', fav: 'bow',   desc: '사거리 2 이상 · 책략 +1 · 턴마다 곁 아군 +12 · 회복 ×1.5', fx: { rng2: 1, plots: 1, aura: 12, healMul: 1.5 } }
  };
  var T1 = ['brave', 'rider', 'tactic'];

  /** 지금 고를 수 있는 직업 키 — Lv5 이상·직업 없음 = 1차 셋 · Lv12 이상·1차 = 그 2차 둘 */
  function choices(lv, cur) {
    if (!on()) { return []; }
    if (!cur) { return lv >= LV1 ? T1.slice() : []; }
    if (CLS[cur] && CLS[cur].t === 1 && lv >= LV2) { return Object.keys(CLS).filter(function (k) { return CLS[k].from === cur; }); }
    return [];
  }
  function hashS(s) { var h = 2166136261, i; s = String(s); for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  /** 적장 직업 — 장 단계로 단계, 씨앗+id 로 갈래 */
  function foeClass(seed, id, tier) {
    if (!on() || tier < 0.3) { return ''; }
    var h = hashS(seed + '|' + id), a = T1[h % 3];
    if (tier < 0.6) { return a; }
    var two = Object.keys(CLS).filter(function (k) { return CLS[k].from === a; });
    return two[(h >> 3) % 2];
  }
  /** 판에 얹는다 — unitsOfSrpg 끝(용병이 선 뒤). opts.cls = {id: key} (양쪽 장수 다) */
  function apply(b, opts) {
    var map = (opts && opts.cls) || {};
    if (!on() || !b.srpg) { return; }
    var plots = 0;
    b.units.forEach(function (u) {
      if (u.kind !== 'officer' || !map[u.id] || !CLS[map[u.id]]) { return; }
      var key = map[u.id], d = CLS[key], fx = d.fx;
      u.cls = key;
      if (fx.atk) { u.atk += fx.atk; }
      if (fx.hp) { u.hp += fx.hp; u.max += fx.hp; }
      if (fx.def) { u.def += fx.def; }
      if (fx.mov) { u.mov += fx.mov; }
      if (fx.rng2) { u.rng = Math.max(u.rng, 2); }
      if (fx.cmdR && u.cmdR) { u.cmdR += fx.cmdR; u.cmdA += fx.cmdA || 0; }
      u.back = fx.back || 0; u.guard = fx.guard || 0; u.noCounter = !!fx.noCounter; u.ultMul = fx.ultMul || 1; u.boltMul = fx.boltMul || 1; u.boltR = fx.boltR || 0; u.aura = fx.aura || 0; u.healMul = fx.healMul || 1;
      if (u.side === 'me') { plots += fx.plots || 0; }
      b.units.forEach(function (m) {
        if (m.cmd !== u.uid) { return; }
        var mul = 1 + (m.arm === d.fav ? FAVOR_HP : 0) + (fx.mercHp || 0);
        if (mul !== 1) { m.max = Math.round(m.max * mul); m.hp = Math.round(m.hp * mul); }
        if (m.arm === d.fav) { m.atk += 1; }
        if (fx.cavMov && m.arm === 'cav') { m.mov += fx.cavMov; }
      });
    });
    if (plots && b.plots != null) { b.plots += plots; }
  }
  function mods(b, att, tgt, out) {
    if (att.back && T().isBack && T().isBack(att, tgt)) { out.push([CLS[att.cls] ? CLS[att.cls].name : '직업', att.back]); }
    if (tgt.guard) { out.push([CLS[tgt.cls].name, -tgt.guard]); }
  }
  function turnStart(b) {
    b.units.forEach(function (u) {
      if (!u.aura || u.hp <= 0) { return; }
      b.units.forEach(function (o) { if (o !== u && o.side === u.side && o.hp > 0 && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1) { o.hp = Math.min(o.max, o.hp + u.aura); } });
    });
  }
  function line(key) { var d = CLS[key]; return d ? d.emoji + ' ' + d.name + ' — ' + d.desc : ''; }
  function cardLine(u) { return u && u.cls && CLS[u.cls] ? '<br><span style="color:#cfe6ff">' + CLS[u.cls].emoji + ' ' + CLS[u.cls].name + '</span> <span class="muted">' + CLS[u.cls].desc + '</span>' : ''; }

  global.DG = global.DG || {};
  global.DG.realmClass = { on: on, CLS: CLS, LV1: LV1, LV2: LV2, choices: choices, foeClass: foeClass, apply: apply, mods: mods, turnStart: turnStart, line: line, cardLine: cardLine };
})(typeof window !== 'undefined' ? window : this);
