/**
 * 공사(工事) — 땅을 고친다
 * ---------------------------------------------------------------
 * 원작에서 길을 깔고 물길을 내던 그 자리다. 원작에서 옮길 것 가운데
 * 마지막까지 남아 있던 축이고, 남아 있던 까닭은 **이 마을이 좌표 해시로 생기기**
 * 때문이다(`village.js` 의 `tileAt`). 타일을 세이브에 적어 두지 않으니 고칠 자리가
 * 없었다.
 *
 * 그래서 타일 표를 만들지 않고 **덮개층**을 얹었다:
 *
 *   save.village.terrain = { "tx,ty": 'path' }      ← 고친 칸만
 *
 * `tileAt` 이 해시를 풀기 **전에** 이 표를 본다. 그래서
 *   - 안 고친 마을은 세이브가 한 자도 늘지 않는다 (지금까지의 마을이 그대로다)
 *   - 되돌리면 칸을 **지운다**. 원래 해시로 돌아가고 세이브도 도로 줄어든다
 *   - 마을 크기·해시·투영은 한 줄도 안 건드렸다
 *
 * ## 절벽은 넣지 않았다
 *
 * 원작의 공사는 셋이다 — 길 · 물길 · **절벽**. 앞의 둘만 옮겼다.
 * 절벽은 땅에 **높이**가 있어야 하는데, 이 판의 투영(`village-view.js` 의
 * `project`)은 마을 좌표를 구면에 감아 화면에 놓는 함수라 높이 축이 아예 없다.
 * 높이를 넣으려면 투영·그림자·통행·주민 걸음이 한꺼번에 뒤집힌다. 그림이 곧
 * 이 게임인 판이라, 얻는 것보다 잃는 것이 크다고 보고 뺐다.
 *
 * ## 규칙
 *
 *   여는 것   전방의 **개토패(開土牌)**. 사기 전에는 독에 공사 단추가 없다
 *   자리      **선 칸을 가운데로 한 3×3**. 멀리서 마을을 주무르지 못한다
 *   삯        칸마다 금이 든다. 모래펄이 가장 비싸다 —
 *             모래에는 조개와 낚시터가 생기므로(`buildProps`), 값이 문턱이 된다
 *   못 하는 곳 마을 밖 · 사물이 선 칸 · 주민이 선 칸 · (물길만) 내가 선 칸
 *
 * 고친 뒤에는 `buildProps()` 를 다시 부른다 — 사물은 타일에서 나오므로,
 * 모래를 깔면 조개가 날 수 있고 풀을 물로 바꾸면 그 칸의 하루 몫이 사라진다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  function V() { return global.DG.village; }
  function st() { return V().state(); }

  /** 삯 배수 — 어드민의 손잡이. 매번 읽는다(잡으면 곧바로 듣는다) */
  function costMul() { return core.tuned('build.costMul', 1); }

  /**
   * 깔 수 있는 것.
   *   kind   바꿔 놓을 타일 (`villageData.TILES` 의 키). 'revert' 만 다르다
   *   cost   삯 (금)
   */
  var PAVE = [
    { kind: 'path',  name: '흙길',   emoji: '🟫', cost: 300,
      desc: '가장 싼 길. 마을이 정돈돼 보인다' },
    { kind: 'stone', name: '돌길',   emoji: '⬜', cost: 600,
      desc: '전방 앞이나 사고 앞에 어울린다' },
    { kind: 'sand',  name: '모래펄', emoji: '🟨', cost: 1400,
      desc: '조개가 나고 낚시터가 설 수 있다 — 그래서 비싸다' },
    { kind: 'water', name: '물길',   emoji: '🟦', cost: 900,
      desc: '못이 된다. 지나갈 수 없게 되니 자리를 보고 판다' },
    { kind: 'grass', name: '풀밭',   emoji: '🟩', cost: 500,
      desc: '물을 메우고 풀을 입힌다. 나무를 심을 수 있다' },
    { kind: 'revert', name: '되돌리기', emoji: '↺', cost: 150,
      desc: '고치기 전의 땅으로 돌린다 (세이브에서도 지워진다)' }
  ];

  function paveOf(kind) {
    for (var i = 0; i < PAVE.length; i++) {
      if (PAVE[i].kind === kind) { return PAVE[i]; }
    }
    return null;
  }

  function costOf(kind) {
    var p = paveOf(kind);
    if (!p) { return 0; }
    return Math.max(0, Math.round(p.cost * costMul()));
  }

  /* ── 덮개층 ──────────────────────────────────────────── */

  function map() {
    var s = st();
    if (!s.terrain) { s.terrain = {}; }
    return s.terrain;
  }

  function keyOf(tx, ty) { return tx + ',' + ty; }

  /** 이 칸을 사람이 고쳤나 */
  function worked(tx, ty) {
    return Object.prototype.hasOwnProperty.call(map(), keyOf(tx, ty));
  }

  /** 고친 칸 수 — 마을 시트에 보인다 */
  function count() { return Object.keys(map()).length; }

  /* ── 개토패 ──────────────────────────────────────────── */

  function has() { return V().hasTool('deed'); }

  /* ── 어느 칸을 고칠 수 있나 ───────────────────────────── */

  /** 지금 선 칸 */
  function cell() {
    var raw = V().raw(), T = V().TILE;
    return { tx: Math.floor(raw.player.x / T), ty: Math.floor(raw.player.y / T) };
  }

  /** 그 칸에 놓인 사물 (없으면 null) — 나무·바위·건물·잡초·묘목 다 걸린다 */
  function propOn(tx, ty) {
    var raw = V().raw(), T = V().TILE, i;
    for (i = 0; i < raw.props.length; i++) {
      var p = raw.props[i];
      if (Math.floor(p.x / T) === tx && Math.floor(p.y / T) === ty) { return p; }
    }
    return null;
  }

  /** 그 칸에 서 있는 주민 (없으면 null) */
  function folkOn(tx, ty) {
    var raw = V().raw(), T = V().TILE, i;
    for (i = 0; i < raw.residents.length; i++) {
      var r = raw.residents[i];
      if (Math.floor(r.x / T) === tx && Math.floor(r.y / T) === ty) { return r; }
    }
    return null;
  }

  /**
   * 이 칸을 이렇게 고칠 수 있나.
   * **막는 까닭을 말로 돌려준다** — 화면이 그대로 보여 주면 왜 안 되는지가 손에 잡힌다.
   */
  function can(tx, ty, kind) {
    var p = paveOf(kind);
    if (!p) { return { ok: false, why: '없는 공사입니다' }; }
    var cost = (global.DG.craft && global.DG.craft.paveLeft(kind) > 0) ? 0 : costOf(kind);   // 제작대 공사 자재(W-0103) — 삯 면제
    if (!has()) {
      return { ok: false, cost: cost, why: '🪧 개토패가 없습니다 — 전방에서 삽니다' };
    }
    if (V().indoors() || V().caveInside()) { return { ok: false, cost: cost, why: '집 안에서는 못 합니다' }; }
    if (tx < 0 || ty < 0 || tx >= V().W || ty >= V().H) {
      return { ok: false, cost: cost, why: '마을 밖은 바다입니다' };
    }
    var here = cell();
    if (Math.abs(tx - here.tx) > 1 || Math.abs(ty - here.ty) > 1) {
      return { ok: false, cost: cost, why: '손이 닿지 않습니다 (선 자리 둘레만)' };
    }
    var now = V().tileAt(tx, ty);
    if (kind === 'revert') {
      if (!worked(tx, ty)) { return { ok: false, cost: cost, why: '고친 적 없는 땅입니다' }; }
    } else if (now === kind) {
      return { ok: false, cost: cost, why: '이미 ' + p.name + ' 입니다' };
    }
    var pr = propOn(tx, ty);
    if (pr) {
      var def = global.DG.villageData.PROPS[pr.kind];
      return { ok: false, cost: cost,
               why: (def ? def.name : '무언가') + ' 이(가) 서 있습니다 — 먼저 치우세요' };
    }
    var fk = folkOn(tx, ty);
    if (fk) {
      return { ok: false, cost: cost, why: fk.ref.name + ' 이(가) 서 있습니다' };
    }
    /* 물이 될 칸 — 내가 선 자리는 안 된다. 파는 순간 물에 빠진다 */
    var after = kind === 'revert' ? rawTile(tx, ty) : kind;
    if (after === 'water' && tx === here.tx && ty === here.ty) {
      return { ok: false, cost: cost, why: '선 자리에는 물을 낼 수 없습니다' };
    }
    if (core.save.player.gold < cost) {
      return { ok: false, cost: cost, why: '삯이 모자랍니다 (🪙 ' + core.fmt(cost) + ')' };
    }
    return { ok: true, cost: cost, from: now, to: after };
  }

  /**
   * 덮개를 걷었을 때 나올 땅 — 되돌리기가 무엇이 될지 미리 보려면 이게 있어야 한다.
   * 덮개를 잠깐 치웠다 도로 놓는다(`tileAt` 이 덮개를 먼저 보므로 이 길뿐이다).
   */
  function rawTile(tx, ty) {
    var m = map(), k = keyOf(tx, ty);
    if (!Object.prototype.hasOwnProperty.call(m, k)) { return V().tileAt(tx, ty); }
    var keep = m[k];
    delete m[k];
    var t = V().tileAt(tx, ty);
    m[k] = keep;
    return t;
  }

  /* ── 고친다 ──────────────────────────────────────────── */

  function work(tx, ty, kind) {
    var chk = can(tx, ty, kind);
    if (!chk.ok) { return { kind: 'no', text: chk.why }; }
    var p = paveOf(kind), m = map(), k = keyOf(tx, ty);

    core.save.player.gold -= chk.cost;
    if (chk.cost === 0 && global.DG.craft) { global.DG.craft.usePave(kind); }
    if (kind === 'revert') { delete m[k]; }
    else { m[k] = kind; }

    /* 사물은 타일에서 나온다 — 고쳤으면 다시 짠다.
       심어 둔 것은 buildProps 가 지우므로 syncPlanted 로 도로 얹는다 */
    V().buildProps();
    V().syncPlanted();

    core.gainFeat(3, '공사');
    core.gainExp(8);
    var to = global.DG.villageData.TILES[chk.to];
    core.log('🪧 (' + tx + ',' + ty + ') 를 ' + (to ? to.name : chk.to) +
      ' 으로 고쳤다 — 삯 🪙 ' + core.fmt(chk.cost), 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'build', text: p.emoji + ' ' + p.name + ' — 🪙 ' + core.fmt(chk.cost),
             tx: tx, ty: ty, to: chk.to };
  }

  /* ── 화면이 읽는 것 ──────────────────────────────────── */

  /**
   * 선 칸을 가운데로 한 3×3.
   * 화면은 이것만 받아 격자를 그린다 — 좌표 계산이 화면으로 새지 않게 한다.
   */
  function around() {
    var here = cell(), out = [], dx, dy;
    for (dy = -1; dy <= 1; dy++) {
      for (dx = -1; dx <= 1; dx++) {
        var tx = here.tx + dx, ty = here.ty + dy;
        var out_ = tx < 0 || ty < 0 || tx >= V().W || ty >= V().H;
        var t = V().tileAt(tx, ty);
        var def = global.DG.villageData.TILES[t];
        out.push({
          tx: tx, ty: ty, kind: t,
          name: out_ ? '바다' : (def ? def.name : t),
          color: def ? def.color : '#4fbcda',
          here: dx === 0 && dy === 0,
          outside: out_,
          worked: !out_ && worked(tx, ty),
          prop: out_ ? null : propOn(tx, ty),
          folk: out_ ? null : folkOn(tx, ty)
        });
      }
    }
    return out;
  }

  function status() {
    var here = cell();
    return { has: has(), cell: here, tile: V().tileAt(here.tx, here.ty),
             worked: count(), gold: core.save.player.gold };
  }

  global.DG = global.DG || {};
  global.DG.terrain = {
    PAVE: PAVE, paveOf: paveOf, costOf: costOf,
    has: has, cell: cell, around: around, can: can, work: work,
    worked: worked, count: count, rawTile: rawTile, status: status
  };
})(window);
