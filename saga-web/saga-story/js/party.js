/* party.js — 동료 교대 (PLAN §5-8)
 *
 * 편성은 save.party 의 앞 세 명(선두 + 둘). 전투 중 교대하면 즉시 그 인물의 몸으로 바뀐다(체력·공격은
 * 인물마다 따로 — 직업·무예·장비는 계정 단위라 그대로). 나오는 인물은 "서명 1발"을 공짜로 쏜다:
 * 사냥터 엔진이 이미 아는 무예 효과 9(melee·aoe·dash·bolt·arrow·volley·rain·heal·buff) 중 그 인물의
 * 능력치(가장 높은 축)와 소속(faction 해시)으로 정해진 하나 — 새 효과는 없다.
 *
 * 규칙: 교대 쿨 4초 · 교대 직후 0.2초 무적 · 쓰러진 인물은 마을로 돌아가기 전엔 교대 불가 ·
 * 지금 싸우는 인물이 쓰러지면 남은 동료로 저절로 교대(무적 1초, 쿨 없음) — 셋 다 쓰러져야 판이 끝난다.
 * 판정·그림은 side.js 가 그대로 한다(run.hp/run.hpMax 는 늘 "지금 나와 있는 인물"의 것이고,
 * 이 파일은 벤치에 앉은 인물의 체력만 run.pty 에 맡아 둔다). 저장은 없다(판이 끝나면 다 채워진다). */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var MAX = 3, SWAP_CD = 4, SWAP_INV = 0.2, FALL_INV = 1.0;

  /* 능력치 축 × 소속 묶음(3) = 효과 9. 힘=몸으로, 지략=술수로, 통솔=북돋고 쏘는 쪽으로 */
  var TABLE = {
    might:   ['melee', 'dash', 'aoe'],
    wisdom:  ['bolt', 'rain', 'heal'],
    command: ['buff', 'volley', 'arrow']
  };
  var NAME = {
    melee: '일섬', dash: '돌진', aoe: '회천', bolt: '관통 기탄', rain: '난무의 비',
    heal: '숨 고르기', buff: '고취', volley: '연사', arrow: '저격'
  };

  function S() { return global.DG.side; }
  function run() { return S().raw(); }

  var sigCache = {};
  function hashOf(str) {
    var h = 0, i;
    for (i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
    return h;
  }

  /** 인물의 서명 — { effect, name, mul }. 능력치·소속만으로 정해진다(같은 인물은 늘 같다) */
  function signatureOf(id) {
    if (sigCache[id]) { return sigCache[id]; }
    var h = global.DG.data.find(id) || {};
    var s = global.DG.hero.stats(id) || { might: 20, wisdom: 10, command: 15 };
    var dom = 'might';
    if (s.wisdom > s[dom]) { dom = 'wisdom'; }
    if (s.command > s[dom]) { dom = 'command'; }
    var effect = TABLE[dom][hashOf(String(h.faction || id)) % 3];
    var t = Math.max(0, Math.min(1, (s[dom] - 40) / 60));
    var mul = Math.round((1.6 + 0.6 * t) * 20) / 20;
    sigCache[id] = { effect: effect, name: NAME[effect], mul: mul, axis: dom };
    return sigCache[id];
  }

  /** 사냥터 엔진의 castBody 에 넘길 임시 무예 — 기력·쿨 없이 배율만 실린다 */
  function skillFor(sig) {
    var sk = { key: 'swap_' + sig.effect, name: sig.name, effect: sig.effect, cost: 1, cd: 0, swap: true };
    if (sig.effect === 'aoe') { sk.r = 170; }
    else if (sig.effect === 'dash') { sk.dist = 230; sk.invuln = 0.3; }
    else if (sig.effect === 'volley') { sk.shots = 3; }
    else if (sig.effect === 'heal') { sk.heal = [0.14 * sig.mul, 0]; }
    else if (sig.effect === 'buff') { sk.buff = { sec: 6, atk: 1 + (sig.mul - 1) * 0.5 }; }
    return sk;
  }

  /** 한 인물의 최대 체력 — 그 인물이 지금 나와 있다고 치고 side.power() 를 읽는다 */
  function hpMaxOf(i) {
    var rn = run(), keep = rn.pty.i;
    rn.pty.i = i;
    var v = Math.round(S().power().hp * (rn.rm ? 1 + rn.rm.hpUp : 1));
    rn.pty.i = keep;
    return v;
  }

  /** 판이 시작될 때(side.js enter) — 편성 앞 세 명으로 run.pty 를 만든다. 한 명뿐이면 만들지 않는다 */
  function attach() {
    var rn = run(), ids = core.save.party.slice(0, MAX), k;
    if (!rn) { return; }
    rn.pty = null;
    if (ids.length < 2 || (global.DG.constellation && global.DG.constellation.solo())) { return; }   // 홀로서기(성좌도)
    rn.pty = { ids: ids, hp: [], hpMax: [], dead: [], i: 0, cd: 0 };
    for (k = 0; k < ids.length; k++) {
      rn.pty.dead.push(false);
      rn.pty.hpMax.push(k === 0 ? rn.hpMax : hpMaxOf(k));
      rn.pty.hp.push(rn.pty.hpMax[k]);
    }
  }

  function nameOf(id) { var h = global.DG.data.find(id); return h ? h.name : id; }

  /** 교대 — forced 는 지금 인물이 쓰러져 저절로 넘어가는 경우(쿨·무적이 다르다) */
  function swap(i, forced) {
    var rn = run(), t = rn && rn.pty;
    if (!t || i === t.i || i < 0 || i >= t.ids.length) { return false; }
    if (t.dead[i]) { core.emit('toast', '💀 쓰러진 동료는 마을에 돌아가야 나옵니다'); return false; }
    if (!forced && t.cd > 0) { core.emit('toast', '🔄 교대 대기 ' + t.cd.toFixed(1) + '초'); return false; }
    var from = t.i;
    t.hp[from] = rn.hp; t.hpMax[from] = rn.hpMax;
    t.i = i;
    var mx = hpMaxOf(i), hp = t.hp[i];
    if (mx > t.hpMax[i]) { hp += mx - t.hpMax[i]; }      // 축복으로 최대 체력이 늘었으면 그만큼 채워 나온다
    rn.hpMax = mx;
    rn.hp = Math.max(1, Math.min(hp, mx));
    rn.player.invuln = Math.max(rn.player.invuln, forced ? FALL_INV : SWAP_INV);
    t.cd = forced ? 0 : SWAP_CD;
    rn.ptyShot = true;                                    // 서명 1발은 update() 머리에서(타격 반복문 밖)
    core.emit('toast', (forced ? '💀 ' + nameOf(t.ids[from]) + ' 쓰러짐 — ' : '🔄 ') + nameOf(t.ids[i]) + ' 교대');
    core.emit('changed');
    return true;
  }

  /** 다음 살아 있는 동료로(키 E) */
  function cycle() {
    var rn = run(), t = rn && rn.pty, k, j;
    if (!t) { return false; }
    for (k = 1; k < t.ids.length; k++) {
      j = (t.i + k) % t.ids.length;
      if (!t.dead[j]) { return swap(j, false); }
    }
    core.emit('toast', '💀 교대할 동료가 없습니다');
    return false;
  }

  /** 지금 인물이 쓰러졌다(side.js hurtMe) — 남은 동료가 있으면 넘어가고 true, 없으면 false(판 끝) */
  function onFall() {
    var rn = run(), t = rn && rn.pty, k, j;
    if (!t) { return false; }
    t.dead[t.i] = true; t.hp[t.i] = 0;
    for (k = 1; k < t.ids.length; k++) {
      j = (t.i + k) % t.ids.length;
      if (!t.dead[j]) { return swap(j, true); }
    }
    return false;
  }

  /** 자동 사냥: 체력이 낮으면 쉬는 동료로 바꾼다 — 바꿨으면 true */
  function autoSwap() {
    var rn = run(), t = rn && rn.pty, k, best = -1, bf = 0.5;
    if (!t || t.cd > 0) { return false; }
    for (k = 0; k < t.ids.length; k++) {
      if (k === t.i || t.dead[k]) { continue; }
      var f = t.hp[k] / t.hpMax[k];
      if (f > bf) { bf = f; best = k; }
    }
    return best >= 0 ? swap(best, false) : false;
  }

  /** 마을로 돌아왔다 — 쓰러진 동료가 일어서고 다 채워진다(지금 나온 인물은 손대지 않는다) */
  function restore() {
    var rn = run(), t = rn && rn.pty, k;
    if (!t) { return; }
    for (k = 0; k < t.ids.length; k++) {
      if (k === t.i) { continue; }
      t.dead[k] = false; t.hp[k] = t.hpMax[k];
    }
  }

  /** update() 머리 — 교대 쿨을 깎고, 나온 인물의 서명 1발을 쏜다 */
  function tick(dt) {
    var rn = run(), t = rn && rn.pty;
    if (!t) { return; }
    if (t.cd > 0) { t.cd = Math.max(0, t.cd - dt); }
    if (rn.ptyShot) {
      rn.ptyShot = false;
      var sig = signatureOf(t.ids[t.i]);
      S().castSwap(skillFor(sig), sig.mul);
      core.emit('toast', '✨ ' + nameOf(t.ids[t.i]) + ' — ' + sig.name + ' ×' + sig.mul.toFixed(2));
    }
  }

  /** 화면(HUD)이 읽는 요약 */
  function brief() {
    var rn = run(), t = rn && rn.pty;
    if (!t) { return null; }
    return {
      i: t.i, cd: t.cd, cdMax: SWAP_CD,
      list: t.ids.map(function (id, k) {
        var h = global.DG.data.find(id) || {};
        var act = k === t.i;
        var sig = signatureOf(id);
        return {
          id: id, name: h.name || id, emoji: h.emoji || '🧑',
          hp: Math.max(0, Math.round(act ? rn.hp : t.hp[k])), hpMax: act ? rn.hpMax : t.hpMax[k],
          dead: !!t.dead[k], active: act, sig: sig.name + ' ×' + sig.mul.toFixed(2)
        };
      })
    };
  }

  global.DG.party = {
    MAX: MAX, SWAP_CD: SWAP_CD, TABLE: TABLE, NAME: NAME,
    signatureOf: signatureOf, skillFor: skillFor,
    attach: attach, swap: swap, cycle: cycle, onFall: onFall, autoSwap: autoSwap,
    restore: restore, tick: tick, brief: brief
  };
})(window);
