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
    rarity_acquire_1: [12, 12, 0], rarity_acquire_2: [12, 12, 0], rarity_acquire_3: [12, 12, 0], rarity_acquire_4: [12, 12, 0], rarity_acquire_5: [12, 12, 0],
    rarity_aura_1: [8, 12, 1], rarity_aura_2: [8, 12, 1], rarity_aura_3: [8, 12, 1], rarity_aura_4: [8, 12, 1], rarity_aura_5: [8, 12, 1],
    fire_proj: [8, 12, 1], water_proj: [8, 12, 1], lightning_proj: [8, 12, 1], ice_proj: [8, 12, 1], wind_proj: [8, 12, 1], earth_proj: [8, 12, 1], light_proj: [8, 12, 1],
    fire_hit: [10, 12, 0], water_hit: [10, 12, 0], lightning_hit: [10, 12, 0], ice_hit: [10, 12, 0], wind_hit: [10, 12, 0], earth_hit: [10, 12, 0], light_hit: [10, 12, 0]
  };
  /** 사가나락 원소(`elem` fx 의 el) → 원소 타격 시트 — 화=불 · 빙=얼음 · 뇌=번개 · 독=바람(초록 호) · 기=빛 · 전자=물(푸른 고리). 물리는 없다(불꽃이 이미 있다) */
  var ELEM_HIT = { fire: 'fire_hit', cold: 'ice_hit', lit: 'lightning_hit', pois: 'wind_hit', chi: 'light_hit', emp: 'water_hit' };
  /** 사가나락 원소 → 투사체 시트(날아가는 모양 — 오른쪽으로 난다고 보고 방향으로 돌려 그린다). 물리·기 = 지금의 하늘색 기공파 구슬(물), 독 = 바람, 전자 = 빛 */
  var PROJ = { phys: 'water_proj', chi: 'water_proj', fire: 'fire_proj', cold: 'ice_proj', lit: 'lightning_proj', pois: 'wind_proj', emp: 'light_proj' };
  var imgs = {};

  function base() { var c = global.DG.cfg && global.DG.cfg.vfx; return (c && c.base) || 'assets/vfx/'; }
  /** 등급 시트(K-0048 `rarity_*`)는 다른 폴더·이름꼴(`rarity_aura_3_k.webp`) */
  function urlOf(name) { return name.indexOf('rarity_') === 0 ? 'assets/rarity/' + name + '_k.webp' : base() + 'vfx_' + name + '_k.webp'; }

  /** 검은 바탕 → 알파(W-0078) — 가장 센 채널을 알파로, 색은 그만큼 키운다(RGBA 배열을 제자리에서, 순수). lighter 로 얹으면 불투명 바탕 위는 지금과 같고,
   *  투명 2D 층(3D 바탕 위)에선 검은 칸이 남지 않는다 — lighter 는 알파도 더해 검은 바탕이 불투명 검정으로 찍혔다 */
  function keyAlpha(d) {
    for (var i = 0, m; i < d.length; i += 4) {
      m = Math.max(d[i], d[i + 1], d[i + 2]);
      if (!m) { d[i + 3] = 0; continue; }
      d[i] = d[i] * 255 / m; d[i + 1] = d[i + 1] * 255 / m; d[i + 2] = d[i + 2] * 255 / m; d[i + 3] = m * d[i + 3] / 255;
    }
    return d;
  }
  /** 받은 시트를 캔버스로 옮겨 keyAlpha — 못 하면(캔버스 없음·오염) null → 원래 그림 그대로 */
  function keyed(im) {
    try {
      var c = global.document.createElement('canvas'), g, px;
      c.width = im.naturalWidth; c.height = im.naturalHeight; g = c.getContext('2d'); g.drawImage(im, 0, 0);
      px = g.getImageData(0, 0, c.width, c.height); keyAlpha(px.data); g.putImageData(px, 0, 0);
      return c;
    } catch (err) { return null; }
  }

  function sheet(name) {
    var e = imgs[name];
    if (!e) {
      e = imgs[name] = { img: null, ok: false };
      if (global.Image && SHEETS[name]) { var im = new global.Image(); im.onload = function () { e.img = keyed(im) || im; e.ok = true; }; im.src = urlOf(name); e.img = im; }
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

  /**
   * 화면 층이 쌓는 fx 하나를 이펙트로 얹는다 — 타격(t:'hit')은 불꽃(급소 f.crit 는 번쩍임 더), 처치(t:'pop')는 연기(보스 f.boss 또는 오래 사는 fx 는 크게).
   * f.life 는 남은 초, 처음 값을 f.l0 에 한 번 적어 나이를 센다. (x,y) = 화면 좌표(맞은 몸 가운데). 그린 게 없으면 false. 다른 fx 는 건드리지 않는다
   */
  function fxLayer(ctx, f, x, y) {
    if (!f || (f.t !== 'hit' && f.t !== 'pop' && f.t !== 'elem' && f.t !== 'lvl' && f.t !== 'get')) { return false; }
    if (f.t === 'get' && !f.rar && f.k !== 'gold') { return false; }   // 줍는 글자 fx 중 등급 장비·금만 연출을 단다
    if (f.l0 === undefined) { f.l0 = f.life; }
    var age = f.l0 - f.life, big = f.boss || f.l0 > 0.6;
    if (f.t === 'get') { return f.rar ? draw(ctx, 'rarity_acquire_' + Math.min(5, f.rar), x, y, 132, age, { speed: 1.3 }) : draw(ctx, 'coin_pop', x, y, 62, age, { speed: 1.4 }); }   // 장비 등급(rar 1~5) 획득 연출 · 금 동전
    if (f.t === 'lvl') { return draw(ctx, 'levelup_burst', x, y, 170, age, { speed: 1.1 }); }   // 레벨업 — 판이 cfg.vfx.levelup 으로 쌓는 fx
    if (f.t === 'elem') { return ELEM_HIT[f.el] && !f.dot ? draw(ctx, ELEM_HIT[f.el], x, y, 76, age, { speed: 1.5 }) : false; }   // 원소 피해 숫자 — 몇 초에 걸치는 독(dot)은 틱마다 안 터뜨린다
    if (f.t === 'hit') {
      var a = draw(ctx, 'spark_hit', x, y, f.crit ? 78 : 58, age, { speed: 1.9 });
      return (f.crit ? draw(ctx, 'crit_flash', x, y, 92, age, { speed: 1.6, alpha: 0.75 }) : false) || a;
    }
    return draw(ctx, 'death_smoke', x, y, big ? 190 : 104, age, { speed: big ? 1.1 : 1.6 });
  }

  /**
   * 투사체 하나 — el = 원소 키, (x,y) = 화면 위치, to = 진행 방향으로 조금 앞선 화면 점 {x,y}(회전각), size px, now ms. 그렸으면 true(아직 못 받았으면 false → 옛 구슬)
   */
  function proj(ctx, el, x, y, to, size, now) {
    var name = PROJ[el] || PROJ.phys, im = sheet(name), f = frameAt(name, now / 1000);
    if (!im || f < 0) { return false; }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y); ctx.rotate(Math.atan2(to.y - y, to.x - x));
    ctx.drawImage(im, f * FRAME, 0, FRAME, FRAME, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }

  /** 사가나락 장비 등급(0 상품~4 전설) → 등급 시트 번호 — 이름표 색과 색상이 가까운 것: 명품(노랑)·전설(금)=5 주황금, 보물(초록)=2 초록. 상품·양품은 연출 없음(0) */
  function rarOfTier(key) { return key === 3 ? 2 : (key >= 2 ? 5 : 0); }

  /** 바닥에 놓인 등급 물건의 후광 — rar = 등급 1~5, now ms. 못 받았으면 false */
  function aura(ctx, rar, x, y, size, now) { return draw(ctx, 'rarity_aura_' + Math.max(1, Math.min(5, rar)), x, y, size, now / 1000, { alpha: 0.85 }); }

  /** 미리 받아 둔다 — 첫 타격에 한 박자 늦지 않게 */
  function preload(names) { (names || Object.keys(SHEETS)).forEach(sheet); }

  /** 판이 cfg.vfx.levelup 을 주면 레벨업 때 그 함수가 자기 fx 목록에 {t:'lvl'} 을 쌓는다 — 게임 규칙 코드를 안 건드리고 이 모듈이 'levelup' 알림을 듣는다 */
  (function () {
    var cv = global.DG.cfg && global.DG.cfg.vfx, core = global.DG.core;
    if (cv && cv.levelup && core && core.on) { core.on('levelup', function () { try { cv.levelup(); } catch (e) { /* 그림일 뿐 */ } }); }
  })();

  preload(((global.DG.cfg && global.DG.cfg.vfx && global.DG.cfg.vfx.preload) || []).concat(['spark_hit', 'crit_flash', 'death_smoke']));   // 첫 타격에 한 박자 늦지 않게 — 판이 cfg.vfx.preload 로 더 주면 같이

  global.DG.vfx2d = { draw: draw, fxLayer: fxLayer, aura: aura, rarOfTier: rarOfTier, proj: proj, PROJ: PROJ, frameAt: frameAt, ELEM_HIT: ELEM_HIT, preload: preload, keyAlpha: keyAlpha, SHEETS: SHEETS, FRAME: FRAME };
})(typeof window !== 'undefined' ? window : this);
