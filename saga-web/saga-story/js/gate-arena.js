/**
 * 관문 자리 — 4종횡 관문 대장(§5-4)이 서는 곳 (W-0188)
 * ---------------------------------------------------------------
 * 관문 대장은 원래 **마을 안**(사람·상점이 있는 안전지대)에 세웠다 — 폰에서 보면
 * "마을에서 보스사냥". 그래서 그 마을 이름의 **문 밖 임시 판**을 만들어 거기서만 싸운다.
 *
 *   make(key)   그 마을의 관문 앞 — 폭 900·발판·줄 없음·사람 없음, 왼쪽 끝 문이 그 마을로.
 *               `town:false`·`spawn:0`·`gateArena:true`·`gateOf:<마을>`, 하늘·땅·mood 는 마을 것을 빌림
 *   home(run)   이긴 뒤(side.js tick 이 gateBackT 를 다 세면) — 떨군 것을 발밑으로 모아 한 번 줍게 하고,
 *               다음 번에 그 마을로 걸어 들어간다(side.travel — 세이브 stage 도 마을)
 *
 * 지거나(die → resume) 나가면(leave → resume) 세이브 stage 가 마을이라 그 마을에서 다시 선다 —
 * side.challengeGate 가 관문 자리로 넘어가며 `st().stage = <마을>` 로 적어 둔다.
 * 판정(수치·주간·일간 규칙·보상)은 전부 side.js 그대로 — 여기는 자리만 만든다(비경 rift.js 임시 판과 같은 식).
 */
(function (global) {
  'use strict';

  var WIDTH = 900;
  var BACK = 3;          // 이긴 뒤 마을로 돌아가기까지(초) — 쓰러지는 몸·보상 알림을 볼 틈
  var SWEEP = 0.4;       // 떨군 것을 발밑으로 모은 뒤 줍기까지

  function make(key) {
    var town = global.DG.sideData.stage(key);
    return {
      key: 'gate-' + town.key, name: '⚔️ ' + town.name + ' 관문 앞', need: town.need,
      sky: ['#5a4038', '#a87a58'], mood: town.mood, ground: town.ground,
      width: WIDTH, floor: town.floor, town: false, gateArena: true, gateOf: town.key,
      plats: [], ropes: [], portals: [[60, town.key]], npcs: [], gathers: [],
      enemyLv: town.enemyLv, spawn: 0, boss: null, gateBoss: town.gateBoss
    };
  }

  function home(run) {
    var S = global.DG.side, p = run.player;
    if (run.drops.length && !run.gateSwept) {
      run.gateSwept = true;
      for (var i = 0; i < run.drops.length; i++) {
        run.drops[i].x = p.x + S.P_W / 2;
        run.drops[i].y = run.stage.floor - 12;
        run.drops[i].vy = 0;
      }
      run.gateBackT = SWEEP;
      return false;
    }
    run.gateSwept = false;
    return S.travel(run.stage.gateOf);
  }

  global.DG = global.DG || {};
  global.DG.gateArena = { make: make, home: home, WIDTH: WIDTH, BACK: BACK };
})(window);
