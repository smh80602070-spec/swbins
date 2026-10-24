/**
 * 2D 컷아웃 뼈대 — 오딘스피어 문법(W-0336): 큰 손그림 인물을 부위로 잘라 뼈에 붙여 움직인다. 다섯 판 공용, 바깥 런타임 없음.
 *
 * ── 규격(자체툴이 그림을 만들 때 이것만 보면 된다) ──────────────────────────────
 *   폴더  `<cfg.mode2d.cutoutBase | assets/web2d/cutout/>`
 *         index.json            { "pools": { "<mode2d 풀 id>": "<rig id>" } }   — 풀(인물·괴물) ↔ 그림 묶음
 *         <rig>/rig.json        아래 꼴 · <rig>/<부위>.webp   알파 PNG/WebP, 부위 하나 = 한 장
 *   rig.json
 *     { "h": 100,                                  몸 높이(뼈 단위). 발바닥 = y 0, 위가 −
 *       "bones": { "<뼈>": { "x": 0, "y": -52, "rot": 0 } },   쉬는 자세 — 부모 축에서의 자리(뼈 단위)·각(도). 빠진 뼈는 아래 REST
 *       "parts": [ { "bone": "chest", "img": "chest.webp", "x": -11, "y": -30, "w": 22, "h": 32, "z": 5 } ],
 *                                                  부위 그림 = 그 뼈 축 기준 사각형(x·y 왼쪽 위, w·h), z 큰 것이 앞
 *       "sway": { "hair": 0.8, "cape": 0.6 },      관성 흔들림 세기(0~1) — 움직이면 뒤로 끌리고 서면 출렁이다 멈춘다
 *       "clips": { "<클립>": { "len": 0.9, "loop": true, "keys": { "<뼈>": [[t, 각, dx, dy], …] } } }   t 는 0~1, 빠진 클립은 CLIPS 기본
 *     }
 *   뼈 16 고정(이름 그대로): hip(뿌리) · chest · head · hair · armUL·armLL·handL · armUR·armLR·handR · legUL·legLL·footL · legUR·legLR·footR
 *     (L = 화면 안쪽 팔·다리 — 몸 뒤에 그린다, R = 바깥쪽). 옷자락·머리카락 덧뼈는 "extra": { "cape": { "parent": "chest", "x":…, "y":… } } 로 더한다.
 *   클립 일곱: idle(숨쉬기) · walk · run · attack · hit · death · jump — 오른쪽을 본다(왼쪽은 좌우 뒤집기).
 *
 * ── 쓰는 법 ─────────────────────────────────────────────────────────────────
 *   mode2d.draw 가 맨 앞에서 DG.cutout2d.drawFor(ctx, o, 몸높이px) 를 부른다 — 손잡이 `cutout2d.on`:
 *     0 끔(옛 시트만) · 1(기본, W-0402) index.json 에 있는 풀만 컷아웃(그림 오면 — 없는 풀·받는 중은 옛 시트) · 2 모든 사람을 대역(_stub, 코드로 그린 부위)으로 — 보기용
 *   섞여도 크기·발이 같다: 시트도 컷아웃도 발 = o.y · 몸 = 몸높이px(rig.h 100 = 머리 끝). bounds(rig) 로 잰다(무기 부위는 빼고)
 *   그렸으면 true, 아니면 false(그 자리는 옛 시트 그대로). 판정에는 한 줄도 안 닿는다.
 *   DG.cutout2d.sample(rig, clip, phase) 순수 — 뼈별 {rot, dx, dy}(진단) · stubRig(seed) · demo() `_demo.html#cutout`
 * 정본은 saga-web/shared/js/cutout2d.js — 판별 사본은 tools/sync-shared.mjs.
 */
(function (global) {
  'use strict';
  var BONES = ['hip', 'chest', 'head', 'hair', 'armUL', 'armLL', 'handL', 'armUR', 'armLR', 'handR', 'legUL', 'legLL', 'footL', 'legUR', 'legLR', 'footR'];
  var PARENT = { hip: null, chest: 'hip', head: 'chest', hair: 'head', armUL: 'chest', armLL: 'armUL', handL: 'armLL', armUR: 'chest', armLR: 'armUR', handR: 'armLR',
    legUL: 'hip', legLL: 'legUL', footL: 'legLL', legUR: 'hip', legLR: 'legUR', footR: 'legLR' };
  /* 쉬는 자세(몸 높이 100) — 머리 큰 8등신 아닌 6.5등신 그림체 기준 */
  var REST = { hip: { x: 0, y: -50 }, chest: { x: 0, y: -4 }, head: { x: 1, y: -28 }, hair: { x: -3, y: -12 },
    armUL: { x: 0, y: -24 }, armLL: { x: 0, y: 14 }, handL: { x: 0, y: 13 }, armUR: { x: 0, y: -24 }, armLR: { x: 0, y: 14 }, handR: { x: 0, y: 13 },
    legUL: { x: -2, y: 2 }, legLL: { x: 0, y: 23 }, footL: { x: 0, y: 23 }, legUR: { x: 2, y: 2 }, legLR: { x: 0, y: 23 }, footR: { x: 0, y: 23 } };
  /* 기본 클립 — rig 에 없으면 이것. [t, 각(도), dx, dy] */
  var CLIPS = {
    idle: { len: 2.4, loop: true, keys: { chest: [[0, 0, 0, 0], [0.5, 1.5, 0, -0.8], [1, 0, 0, 0]], head: [[0, 0], [0.5, -2], [1, 0]], armUL: [[0, 6], [0.5, 9], [1, 6]], armUR: [[0, -6], [0.5, -9], [1, -6]], armLL: [[0, -8]], armLR: [[0, -10]] } },
    walk: { len: 1.0, loop: true, keys: {
      hip: [[0, 0, 0, 0], [0.25, 0, 0, -1.5], [0.5, 0, 0, 0], [0.75, 0, 0, -1.5], [1, 0, 0, 0]], chest: [[0, 3]],
      legUL: [[0, 26], [0.5, -24], [1, 26]], legLL: [[0, 2], [0.25, 30], [0.5, 4], [0.75, 6], [1, 2]], legUR: [[0, -24], [0.5, 26], [1, -24]], legLR: [[0, 4], [0.25, 6], [0.5, 2], [0.75, 30], [1, 4]],
      armUL: [[0, -22], [0.5, 22], [1, -22]], armUR: [[0, 22], [0.5, -22], [1, 22]], armLL: [[0, -16]], armLR: [[0, -16]] } },
    run: { len: 0.6, loop: true, keys: {
      hip: [[0, 0, 0, -1], [0.25, 0, 0, -4], [0.5, 0, 0, -1], [0.75, 0, 0, -4], [1, 0, 0, -1]], chest: [[0, 12]], head: [[0, -6]],
      legUL: [[0, 42], [0.5, -36], [1, 42]], legLL: [[0, 6], [0.25, 60], [0.5, 10], [0.75, 14], [1, 6]], legUR: [[0, -36], [0.5, 42], [1, -36]], legLR: [[0, 10], [0.25, 14], [0.5, 6], [0.75, 60], [1, 10]],
      armUL: [[0, -48], [0.5, 40], [1, -48]], armUR: [[0, 40], [0.5, -48], [1, 40]], armLL: [[0, -70]], armLR: [[0, -70]] } },
    attack: { len: 0.5, loop: false, keys: {
      chest: [[0, -8], [0.3, -14], [0.5, 16], [1, 4]], armUR: [[0, 150], [0.3, 170], [0.5, -40], [1, -20]], armLR: [[0, -20], [0.5, 0], [1, -10]],
      armUL: [[0, -30], [0.5, 30], [1, 10]], legUL: [[0, 14], [0.5, 22], [1, 14]], legUR: [[0, -10], [0.5, -20], [1, -10]], hip: [[0, 0, 0, 0], [0.5, 0, 3, 1], [1, 0, 1, 0]] } },
    hit: { len: 0.35, loop: false, keys: { chest: [[0, 0], [0.3, -18], [1, -4]], head: [[0, 0], [0.3, -14], [1, 0]], hip: [[0, 0, 0, 0], [0.3, 0, -4, 0], [1, 0, -1, 0]], armUL: [[0, 0], [0.3, -40], [1, -6]], armUR: [[0, 0], [0.3, 30], [1, 6]] } },
    death: { len: 0.9, loop: false, keys: { hip: [[0, 0, 0, 0], [0.6, -80, -6, 30], [1, -90, -8, 44]], chest: [[0, 0], [0.6, -20], [1, -6]], head: [[0, 0], [1, -16]],
      legUL: [[0, 0], [0.6, 40], [1, 10]], legLL: [[0, 0], [0.6, 30], [1, 6]], armUL: [[0, 0], [1, 60]], armUR: [[0, 0], [1, -70]] } },
    jump: { len: 0.8, loop: false, keys: { legUL: [[0, 40]], legLL: [[0, 70]], legUR: [[0, 10]], legLR: [[0, 50]], armUL: [[0, -120]], armUR: [[0, 140]], chest: [[0, 6]] } }
  };
  var CLIP_OF = { idle: 'idle', walk: 'walk', run: 'run', attack: 'attack', attack2: 'attack', heavy: 'attack', hit: 'hit', death: 'death', knockdown: 'death', jump: 'jump', fall: 'jump' };

  function tuned(k, d) { var C = global.DG && global.DG.core; return C && C.tuned ? C.tuned(k, d) : d; }
  function cfg() { return (global.DG && global.DG.cfg && global.DG.cfg.mode2d) || {}; }
  function base() { var A = global.DG && global.DG.assets3d, u = A && A.sharedUrl ? A.sharedUrl('web2d/cutout/') : null; return cfg().cutoutBase || u || 'assets/web2d/cutout/'; }   // W-0359 다섯 판 한 벌(shared)

  /* ── 순수: 클립 표본 ── */
  function ease(u) { return u * u * (3 - 2 * u); }
  function at(keys, phase) {
    if (!keys || !keys.length) { return null; }
    if (keys.length === 1 || phase <= keys[0][0]) { return keys[0]; }
    for (var i = 1; i < keys.length; i++) {
      if (phase <= keys[i][0]) {
        var a = keys[i - 1], b = keys[i], u = ease((phase - a[0]) / Math.max(1e-6, b[0] - a[0]));
        return [phase, (a[1] || 0) + ((b[1] || 0) - (a[1] || 0)) * u, (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * u, (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * u];
      }
    }
    return keys[keys.length - 1];
  }
  function clipOf(rig, name) { var n = CLIP_OF[name] || 'idle'; return (rig && rig.clips && rig.clips[n]) || CLIPS[n]; }
  /** → { 뼈: { rot(도), dx, dy } } — phase 0~1 */
  function sample(rig, name, phase) {
    var c = clipOf(rig, name), out = {}, i, b, k;
    for (i = 0; i < BONES.length; i++) { b = BONES[i]; k = at(c.keys[b], phase); out[b] = { rot: k ? (k[1] || 0) : 0, dx: k ? (k[2] || 0) : 0, dy: k ? (k[3] || 0) : 0 }; }
    return out;
  }
  /** 시간(ms) → 위상. 반복 클립은 감기, 한 번 클립은 끝에 머문다. t 가 0~1 사이 소수면(걷기 보폭 위상) 그대로 */
  function phaseOf(rig, name, t) {
    var c = clipOf(rig, name), s = (+t || 0);
    if (name === 'walk' && s >= 0 && s <= 1 && s % 1 !== 0) { return s; }
    var p = s / 1000 / (c.len || 1);
    return c.loop === false ? Math.min(1, p) : p - Math.floor(p);
  }

  /* ── 대역(_stub) — 그림 없이 부위를 도형으로. 옷 색은 seed 해시 ── */
  function hue(seed) { var h = 0, s = String(seed || ''); for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h) % 360; }
  function stubRig(seed) {
    var hu = hue(seed), cloth = 'hsl(' + hu + ',45%,42%)', dark = 'hsl(' + hu + ',40%,28%)', skin = '#f1c9a5', hair = 'hsl(' + ((hu + 180) % 360) + ',30%,22%)', pants = '#3b3f4a';
    var P = function (bone, x, y, w, h, z, fill, shape) { return { bone: bone, x: x, y: y, w: w, h: h, z: z, fill: fill, shape: shape || 'round' }; };
    return { id: '_stub', h: 100, sway: { hair: 0.8 }, parts: [
      P('armUL', -3.5, -1, 7, 16, 1, dark), P('armLL', -3, -1, 6, 15, 1, dark), P('handL', -3, -1, 6, 6, 1, skin, 'ellipse'),
      P('legUL', -4.5, -1, 9, 25, 2, pants), P('legLL', -4, -1, 8, 25, 2, pants), P('footL', -3, -2, 11, 5, 2, '#2a2420'),
      P('hip', -9, -6, 18, 12, 4, pants), P('chest', -10, -26, 20, 30, 5, cloth),
      P('legUR', -4.5, -1, 9, 25, 6, pants), P('legLR', -4, -1, 8, 25, 6, pants), P('footR', -3, -2, 11, 5, 6, '#2a2420'),
      P('hair', -9, -6, 16, 22, 3, hair), P('head', -8.5, -20, 17, 20, 7, skin, 'ellipse'), P('head', -9.5, -22, 19, 9, 8, hair),
      P('armUR', -3.5, -1, 7, 16, 9, cloth), P('armLR', -3, -1, 6, 15, 9, cloth), P('handR', -3, -1, 6, 6, 9, skin, 'ellipse')
    ] };
  }

  /* ── 받기 ── */
  var index = null, indexState = 'none', rigs = {};
  function loadJson(url, ok, fail) {
    if (!global.fetch) { fail(); return; }
    global.fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(ok, fail);
  }
  function rigIdFor(pool) {
    if (indexState === 'none') { indexState = 'loading'; loadJson(base() + 'index.json', function (j) { index = j || {}; indexState = 'ok'; }, function () { index = {}; indexState = 'fail'; }); }
    var b = String(pool).split('#')[0], k = b.replace(/^vroid:/, '').split('~')[0];   // W-0353 — 게임 안 풀은 'vroid:<인물>~<옷 색 칸>' 이라 표(인물 id)와 안 맞아 컷아웃이 한 번도 안 섰다
    var p = index && index.pools ? index.pools[pool] || index.pools[b] || index.pools[k] : null;
    return p || null;
  }
  function rigOf(id) {
    var r = rigs[id];
    if (r) { return r.ok ? r : null; }
    r = rigs[id] = { ok: false, rig: null, imgs: {} };
    loadJson(base() + id + '/rig.json', function (j) {
      r.rig = j; var n = (j.parts || []).length, done = 0;
      if (!n) { r.ok = true; return; }
      (j.parts || []).forEach(function (pt) {
        if (!pt.img || r.imgs[pt.img]) { if (++done >= n) { r.ok = true; } return; }
        var im = new global.Image(); r.imgs[pt.img] = im;
        im.onload = im.onerror = function () { if (++done >= n) { r.ok = true; } };
        im.src = base() + id + '/' + pt.img;
      });
    }, function () { r.fail = true; });
    return null;
  }
  function has(pool) { var id = rigIdFor(pool); return !!(id && rigOf(id)); }

  /* ── 그리기 ── */
  var swayS = {};   // 배우 → { x, ms, v, ang }
  function swayAng(key, x, ms, k) {
    var s = swayS[key], now = +ms || 0;
    if (!s) { s = swayS[key] = { x: x, ms: now, v: 0, ang: 0 }; }
    var dt = Math.max(0.001, Math.min(0.1, (now - s.ms) / 1000)), v = (x - s.x) / dt;
    s.v += (v - s.v) * Math.min(1, dt * 6); s.x = x; s.ms = now;
    var target = -Math.max(-1, Math.min(1, s.v / 240)) * 28 * k;
    s.ang += (target - s.ang) * Math.min(1, dt * 5);
    return s.ang + Math.sin(now / 420) * 2.5 * k;
  }
  function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
  function tr(x, y, deg) { var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, x, y]; }
  /** 뼈마다 세계 행렬(뼈 단위, 발 = 0) — 순수 */
  function pose(rig, name, phase, swayDeg) {
    var smp = sample(rig, name, phase), bones = (rig && rig.bones) || {}, M = {}, i, b, r, q;
    for (i = 0; i < BONES.length; i++) {
      b = BONES[i]; r = bones[b] || REST[b]; q = smp[b];
      var local = tr((r.x || 0) + q.dx, (r.y || 0) + q.dy, (r.rot || 0) + q.rot + (rig && rig.sway && rig.sway[b] ? swayDeg * rig.sway[b] : 0));
      M[b] = PARENT[b] ? mul(M[PARENT[b]], local) : local;
    }
    var ex = (rig && rig.extra) || {};
    for (b in ex) { if (Object.prototype.hasOwnProperty.call(ex, b)) { r = ex[b]; M[b] = mul(M[r.parent] || M.chest, tr(r.x || 0, r.y || 0, (r.rot || 0) + (rig.sway && rig.sway[b] ? swayDeg * rig.sway[b] : 0))); } }
    return M;
  }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  /** o = { x, y(발), h(몸 px), clip, t, facing(±1·'left'·'right'), key(배우 — 관성), alpha } */
  function drawRig(ctx, R, o) {
    var rig = R.rig, k = (o.h || 62) / (rig.h || 100), left = o.facing === 'left' || (typeof o.facing === 'number' && o.facing < 0);
    var clip = CLIP_OF[o.clip] ? o.clip : 'idle', ph = phaseOf(rig, CLIP_OF[clip], o.t), now = global.performance ? global.performance.now() : Date.now();
    var M = pose(rig, CLIP_OF[clip], ph, swayAng(o.key || 'x', o.x, now, 1));
    var parts = (rig.parts || []).slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); }), i, p, m;
    ctx.save();
    if (o.alpha !== undefined) { ctx.globalAlpha = o.alpha; }
    ctx.translate(o.x, o.y); ctx.scale(left ? -k : k, k);
    for (i = 0; i < parts.length; i++) {
      p = parts[i]; m = M[p.bone]; if (!m) { continue; }
      ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      var im = p.img && R.imgs ? R.imgs[p.img] : null;
      if (im && im.complete && im.naturalWidth) { ctx.drawImage(im, p.x, p.y, p.w, p.h); }
      else if (p.fill) {
        ctx.fillStyle = p.fill; ctx.strokeStyle = 'rgba(20,14,10,.55)'; ctx.lineWidth = 1.1;
        if (p.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); }
        else { rr(ctx, p.x, p.y, p.w, p.h, Math.min(p.w, p.h) * 0.45); }
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    return true;
  }
  var STUB = {};
  function stubOf(seed) { var k = String(seed || ''); return STUB[k] || (STUB[k] = { ok: true, rig: stubRig(seed), imgs: {} }); }
  /** W-0402 ③ 공격 끝 멈춤(손맛) — 공격류 클립 뒤 곧바로 서기·걷기·달리기로 바뀌어도 끝 자세를 hold ms(손잡이 cutout2d.hold, 기본 140) 붙든다.
   *  배우(key)마다 마지막 공격 그린 때만 기억한다. 순수에 가깝다(now 를 받는다) — 진단이 부른다. → { clip, t } */
  var HOLD_FROM = { attack: 1, attack2: 1, heavy: 1 }, HOLD_TO = { idle: 1, walk: 1, run: 1 }, lastAtk = {};
  function holdClip(key, clip, t, now) {
    var k = String(key || 'x'), ms = +tuned('cutout2d.hold', 140) || 0;
    if (HOLD_FROM[clip]) { lastAtk[k] = { at: now, clip: clip }; return { clip: clip, t: t }; }
    var a = lastAtk[k];
    if (a && HOLD_TO[clip] && now - a.at < ms) { return { clip: a.clip, t: 1e9 }; }   // 한 번 클립은 끝에 머문다(phaseOf)
    if (a && now - a.at >= ms) { delete lastAtk[k]; }
    return { clip: clip, t: t };
  }
  /** mode2d.draw 의 갈래 — 손잡이 cutout2d.on 이 0 이면 아무것도 안 한다 */
  function drawFor(ctx, o, bodyPx) {
    var mode = +tuned('cutout2d.on', 1);   // W-0402 기본 켬 — 그림 묶음이 있는 풀만
    if (!mode || !ctx || !o) { return false; }
    var R = null;
    if (mode >= 2) { R = stubOf(o.pool); }
    else { var id = rigIdFor(o.pool); R = id ? rigOf(id) : null; }
    if (!R) { return false; }
    var hc = holdClip(o.key || o.pool, o.clip, o.t, global.performance ? global.performance.now() : Date.now());   // W-0402 ③
    return drawRig(ctx, R, { x: o.x, y: o.y, h: bodyPx, clip: hc.clip, t: hc.t, facing: o.facing, key: o.key || o.pool, alpha: o.alpha });
  }

  /** 쉬는 자세(또는 clip·phase)의 몸 위끝·발 — 뼈 단위(발 = 0, 위 −). 무기 부위(img 이름에 weapon)는 뺀다. 순수(진단 「발 y·몸 높이」) */
  function bounds(rig, clip, phase) {
    var M = pose(rig, clip || 'idle', phase || 0, 0), top = Infinity, foot = -Infinity;
    (rig.parts || []).forEach(function (p) {
      var m = M[p.bone]; if (!m || /weapon/.test(p.img || '')) { return; }
      [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]].forEach(function (c) { var y = m[1] * c[0] + m[3] * c[1] + m[5]; if (y < top) { top = y; } if (y > foot) { foot = y; } });
    });
    return { top: top, foot: foot, h: rig.h || 100 };
  }

  /* ── 보기(_demo.html#cutout) — 겹 배경 대역 위에 대역 셋이 클립을 돈다 ── */
  function demo() {
    var d = global.document; if (!d) { return; }
    var cv = d.createElement('canvas'); cv.id = 'cutout-demo';
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;background:#000';
    d.body.appendChild(cv);
    var ctx = cv.getContext('2d'), t0 = global.performance.now(), cast = [['walk', 'a'], ['attack', 'b'], ['idle', 'c'], ['run', 'd'], ['hit', 'e'], ['jump', 'f'], ['death', 'g']];
    (function loop() {
      var W = cv.width = global.innerWidth, H = cv.height = global.innerHeight, now = global.performance.now() - t0, camX = now * 0.08;
      if (global.DG.parallax2d) { global.DG.parallax2d.draw(ctx, '_stub', { camX: camX, W: W, H: H }); } else { ctx.fillStyle = '#7aa0c8'; ctx.fillRect(0, 0, W, H); }
      var h = Math.min(H * 0.32, W / (cast.length + 1) * 1.6), gy = H * 0.82;
      cast.forEach(function (c, i) {
        var R = stubOf(c[1]), x = W * (i + 1) / (cast.length + 1);
        drawRig(ctx, R, { x: x, y: gy, h: h, clip: c[0], t: c[0] === 'walk' ? (now / 1000) % 1 + 1e-3 : now % (c[0] === 'idle' || c[0] === 'run' ? 1e9 : 1400), facing: 1, key: 'demo' + i });
        ctx.fillStyle = '#fff'; ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c[0], x, gy + 18);
      });
      if (global.DG.parallax2d) { global.DG.parallax2d.draw(ctx, '_stub', { camX: camX, W: W, H: H, front: true }); }
      if (d.getElementById('cutout-demo')) { global.requestAnimationFrame(loop); }
    })();
  }

  global.DG = global.DG || {};
  global.DG.cutout2d = { BONES: BONES, PARENT: PARENT, REST: REST, CLIPS: CLIPS, sample: sample, phaseOf: phaseOf, pose: pose, stubRig: stubRig, has: has, drawFor: drawFor, demo: demo, bounds: bounds, base: base, rigIdFor: rigIdFor, holdClip: holdClip };
})(window);
