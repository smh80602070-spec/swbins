/**
 * 5천하 격자 전투 보조 목표 — 보물 상자 · 마을 지키기 (W-0460, 랑그릿사 숨은 보물·창세기전 마을 — 사용자 10-26 「잼나야함」)
 * ---------------------------------------------------------------
 *   보물   opts.side.chests = n — 적 쪽 절반 빈 칸에 상자 n 개. 내 유닛이 그 칸에 서면 연다(b.sg.loot++) — 진 판이어도 챙긴다
 *   마을   opts.side.villages = n — 두 진영 사이 가운데 열에 마을 n 개. 적 턴이 끝날 때 적이 곁(맞닿음)에 있고 내 유닛이 곁에 없으면 약탈(burnt)
 *   보상   장 흐름(campaign.reward)이 out.side = {loot, kept, total} 로 — 상자마다 금 SIDE_GOLD.chest · 마을 지킴마다 · 다 지키면 덤
 * 판 규칙 층(tactics.js)이 한 줄씩 부른다(setup · check 앞 scan · 적 턴 끝 foeTurnEnd · outcome 의 result). three·DOM 없이 돈다(진단이 본다).
 * 손잡이 rtk.sideGoal(1, 0 = 없음).
 *
 *   DG.sideGoal.setup(b, opts) · scan(b) · foeTurnEnd(b) · result(b) · cells(b) · chip(b) · GOLD
 */
(function (global) {
  'use strict';
  function C() { return global.DG.core; }
  function T() { return global.DG.tactics; }
  function on() { var c = C(); return !(c && c.tuned && !+c.tuned('rtk.sideGoal', 1)); }
  var GOLD = { chest: 70, village: 40, allVillages: 120 };

  function free(b, x, y) { var c = T().cellAt(b, x, y); return c && (c === 'plain' || c === 'forest' || c === 'hill') && !b.units.some(function (u) { return u.hp > 0 && u.x === x && u.y === y; }); }
  function place(b, n, x0, x1, salt, taken) {
    var out = [], tries = 0;
    while (out.length < n && tries++ < 200) {
      var x = x0 + Math.floor(T().hash(b.seed, salt + 'x' + tries) * (x1 - x0 + 1)), y = Math.floor(T().hash(b.seed, salt + 'y' + tries) * b.rows), k = x + ',' + y;
      if (taken[k] || !free(b, x, y)) { continue; }
      if (out.some(function (p) { return Math.abs(p.x - x) + Math.abs(p.y - y) < 3; })) { continue; }   // 서로 떨어지게
      taken[k] = 1; out.push({ x: x, y: y });
    }
    return out;
  }
  function setup(b, opts) {
    b.sg = null;
    var s = (opts && opts.side) || null;
    if (!on() || !b.srpg || !s || !(s.chests || s.villages)) { return; }
    var mid = Math.floor(b.cols / 2), taken = {};
    b.sg = {
      chests: place(b, s.chests || 0, mid, b.cols - 3, 'sgc', taken).map(function (p) { return { x: p.x, y: p.y, got: false }; }),
      villages: place(b, s.villages || 0, mid - 1, mid, 'sgv', taken).map(function (p) { return { x: p.x, y: p.y, burnt: false }; }),
      loot: 0
    };
  }
  function near(b, p, side) { return b.units.some(function (u) { return u.hp > 0 && u.side === side && Math.abs(u.x - p.x) + Math.abs(u.y - p.y) <= 1; }); }
  function note(b, kind, text) { (b.evLog = b.evLog || []).push({ t: b.turn, kind: kind, who: '', side: '', text: text }); }
  /** check 앞 — 내 유닛이 상자 칸에 서면 연다 */
  function scan(b) {
    var S = b.sg;
    if (!S) { return; }
    S.chests.forEach(function (c) {
      if (c.got) { return; }
      if (b.units.some(function (u) { return u.hp > 0 && u.side === 'me' && u.x === c.x && u.y === c.y; })) { c.got = true; S.loot++; note(b, 'loot', '보물 상자: 「금 ' + GOLD.chest + ' 을(를) 챙겼다!」'); }
    });
  }
  /** 적 턴 끝 — 지키는 이 없는 마을 곁에 적이 있으면 약탈 */
  function foeTurnEnd(b) {
    var S = b.sg;
    if (!S) { return; }
    S.villages.forEach(function (v) {
      if (!v.burnt && near(b, v, 'foe') && !near(b, v, 'me')) { v.burnt = true; note(b, 'burn', '마을 사람들: 「마을이… 마을이 불탄다!」'); }
    });
  }
  function result(b) {
    var S = b.sg;
    if (!S) { return null; }
    return { loot: S.loot, chests: S.chests.length, kept: S.villages.filter(function (v) { return !v.burnt; }).length, total: S.villages.length };
  }
  /** 칸 표시 {'x,y': 'chest'|'open'|'village'|'burnt'} */
  function cells(b) {
    var o = {};
    if (!b.sg) { return o; }
    b.sg.chests.forEach(function (c) { o[c.x + ',' + c.y] = c.got ? 'open' : 'chest'; });
    b.sg.villages.forEach(function (v) { o[v.x + ',' + v.y] = v.burnt ? 'burnt' : 'village'; });
    return o;
  }
  var ICON = { chest: '📦', open: '✨', village: '🏘️', burnt: '🔥' };
  function chip(b) {
    var r = result(b);
    if (!r) { return ''; }
    return '<span class="tvs-chip">' + (r.chests ? '📦 보물 ' + r.loot + '/' + r.chests : '') + (r.chests && r.total ? ' · ' : '') + (r.total ? '🏘️ 마을 ' + r.kept + '/' + r.total : '') + '</span>';
  }

  global.DG = global.DG || {};
  global.DG.sideGoal = { on: on, GOLD: GOLD, ICON: ICON, setup: setup, scan: scan, foeTurnEnd: foeTurnEnd, result: result, cells: cells, chip: chip };
})(typeof window !== 'undefined' ? window : this);
