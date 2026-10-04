/**
 * 전투 이펙트 시트 (W-0052) — K-0039 가 만든 이펙트 시트(`assets/vfx/vfx_<이름>_k.webp`)를 2D 캔버스에 그린다.
 * 시트 = 128px 프레임을 가로 한 줄로 이은 것, `_k` 는 검은 바탕이라 **가산 합성**('lighter')으로 얹는다.
 * 화면 층이 이미 쓰는 fx 의 나이(초)를 넘겨 프레임을 고른다 — 타이머를 따로 두지 않는다.
 * 못 받았거나 없는 이름이면 false → 부른 쪽은 지금 그림 그대로. 정본 shared/js/vfx2d.js (tools/sync-shared.mjs).
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  var FRAME = 128;
  /** 이름 → [프레임 수, 초당 프레임, 반복(1)] — 시트 옆 .license.json 과 같다 */
  var SHEETS = {
    spark_hit: [8, 12, 0], crit_flash: [8, 12, 0], slash_arc: [8, 12, 0], death_smoke: [10, 12, 0], dust_step: [8, 12, 0],
    heal_ring: [12, 12, 1], heal_cross: [12, 12, 1], buff_up: [10, 12, 1], debuff_down: [10, 12, 1], shield_bubble: [12, 12, 1],
    levelup_burst: [12, 12, 0], coin_pop: [10, 12, 0],
    fire_hit: [10, 12, 0], water_hit: [10, 12, 0], lightning_hit: [10, 12, 0], ice_hit: [10, 12, 0], wind_hit: [10, 12, 0], earth_hit: [10, 12, 0], light_hit: [10, 12, 0]
  };
  var imgs = {};

  function base() { var c = global.DG.cfg && global.DG.cfg.vfx; return (c && c.base) || 'assets/vfx/'; }

  function sheet(name) {
    var e = imgs[name];
    if (!e) {
      e = imgs[name] = { img: null, ok: false };
      if (global.Image && SHEETS[name]) { var im = new global.Image(); im.onload = function () { e.ok = true; }; im.src = base() + 'vfx_' + name + '_k.webp'; e.img = im; }
    }
    return e.ok ? e.img : null;
  }

  /** 지금 프레임 번호 — 나이(초)·속도 배수. 한 번 도는 이펙트는 끝나면 -1(안 그린다), 반복이면 계속 돈다. 순수 함수 */
  function frameAt(name, age, speed) {
    var d = SHEETS[name]; if (!d || age < 0) { return -1; }
    var i = Math.floor(age * d[1] * (speed || 1));
    return d[2] ? i % d[0] : (i >= d[0] ? -1 : i);
  }

  /**
   * ctx 에 (x,y)를 가운데로 size px 로 그린다. o = { speed(기본 1), alpha(기본 1) }. 그렸으면 true
   */
  function draw(ctx, name, x, y, size, age, o) {
    o = o || {};
    var im = sheet(name), f = frameAt(name, age, o.speed);
    if (!im || f < 0) { return false; }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.drawImage(im, f * FRAME, 0, FRAME, FRAME, x - size / 2, y - size / 2, size, size);
    ctx.restore();
    return true;
  }

  /** 미리 받아 둔다 — 첫 타격에 한 박자 늦지 않게 */
  function preload(names) { (names || Object.keys(SHEETS)).forEach(sheet); }

  global.DG.vfx2d = { draw: draw, frameAt: frameAt, preload: preload, SHEETS: SHEETS, FRAME: FRAME };
})(typeof window !== 'undefined' ? window : this);
