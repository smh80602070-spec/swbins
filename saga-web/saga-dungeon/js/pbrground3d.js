/**
 * PBR 땅 — 판 그림(바탕색)은 그대로, 자체 PBR 법선·거칠기 맵을 얹은 표준 재질로 · 공용 (W-0295 그래픽 기준선)
 * ---------------------------------------------------------------
 * 땅 바탕색은 판마다 결이 다르다(4종횡 자체 타일 · 5천하 지역 색 지도 · 2나락 실사 세 장 섞기). 그 그림은 손대지 않고,
 * 자체툴 K-0093 세트(`shared/assets/ground/<세트>_<512|hi>_<n|r>.webp` — tools/ai-art/pbr_from_albedo.py 로 뽑은 법선·거칠기)를
 * 촘촘히 반복해 얹는다 → 빛 방향에 따라 땅 결이 서고(법선) 젖은 듯 반들한 곳과 거친 곳이 갈린다(거칠기).
 *
 *   품질  LOW 끔(옛 재질 그대로 — 폰을 지킨다) · MEDIUM 법선·거칠기 512 · HIGH 법선 hi(1024)·거칠기 512
 *   세트  grass · dirt · rock · stonewall · gravel (다른 세트가 필요하면 자체툴에서 복사 배치 — 웹은 그림을 만들지 않는다)
 *         + W-0415 섞음 결 mud_gravel · path_grass · field_mix(K-0193) — 바탕색 그림(<세트>_512.webp)도 있어 o.albedo 면 판 그림 대신 그것을 깐다,
 *           o.detail(0~1) 이면 판 그림(지역 색 지도 등)은 그대로 두고 그 바탕색을 평균으로 나눈 결만 곱한다(디테일 맵 — 색 정보 보존)
 *   반복  tile = 맵 한 장이 덮는 세계 길이. 맵마다 따로 반복한다(three r151+ 맵별 변환) — 바탕색 그림의 반복은 안 건드린다
 *
 *   var PG = DG.pbrground3d;
 *   var m = PG.standardFrom(T, oldMat, { tier: 'high', set: 'dirt', tile: 120, w: 2000, h: 900, gain: 1 });   // LOW 면 oldMat 그대로 · gain = 바탕색 곱(툰→표준 밝기 맞춤)
 *
 * 맵은 그림이 실린 뒤에 붙인다(못 받으면 법선·거칠기 없이 표준 재질 — 밝기는 그대로). 손잡이 `<tune>.pbr`(기본 1, 0 = 옛 재질).
 * **판정에는 한 줄도 안 닿는다.** plan()·repeatOf() 는 three 없이 돈다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG && global.DG.core; }
  function tuned(k, d) { var C = core(); return C && C.tuned ? C.tuned(k, d) : d; }

  var SETS = { grass: 1, dirt: 1, rock: 1, stonewall: 1, gravel: 1, mud_gravel: 2, path_grass: 2, field_mix: 2 };   // 2 = 바탕색 그림도 있음(W-0415)

  /** 품질 → 계획(순수). tier 는 low/medium/high(대소문자 무관) */
  function plan(tier, tune) {
    var k = String(tier || 'high').toLowerCase();
    if (tune && !+tuned(tune + '.pbr', 1)) { return { on: false, tier: k, why: '손잡이 0' }; }
    if (k === 'low') { return { on: false, tier: k, why: 'LOW' }; }
    return { on: true, tier: k, normal: k === 'high' ? 'hi_n' : '512_n', rough: '512_r', normalScale: k === 'high' ? 0.9 : 0.7 };
  }
  /** 넓이 w×h 를 tile 길이 맵으로 덮을 반복 수(순수) */
  function repeatOf(w, h, tile) {
    var t = Math.max(1e-3, tile || 1);
    return { x: Math.max(1, (w || t) / t), y: Math.max(1, (h || t) / t) };
  }

  /* ══ 그림 층 ══ */

  var base = {};      // 파일 → { tex, ok, fail, wait: [] }
  var stat = { made: 0, maps: 0, fail: 0 };
  function root() { var A = global.DG && global.DG.assets3d; return A && A.root ? A.root() : null; }

  /** 원본 텍스처 한 장을 한 번만 받는다 — 다 실리면 cb(tex) */
  function load(T, file, cb, srgb) {
    var e = base[file];
    if (!e) {
      var r = root();
      e = base[file] = { tex: null, ok: false, fail: !r, wait: [] };
      if (r && T.TextureLoader) {
        e.tex = new T.TextureLoader().load(r + 'ground/' + file, function () {
          e.ok = true; var w = e.wait; e.wait = []; for (var i = 0; i < w.length; i++) { w[i](e.tex); }
        }, undefined, function () { e.fail = true; e.wait = []; stat.fail++; });
        e.tex.wrapS = e.tex.wrapT = T.RepeatWrapping;
        if (srgb && T.SRGBColorSpace) { e.tex.colorSpace = T.SRGBColorSpace; } else if (T.NoColorSpace) { e.tex.colorSpace = T.NoColorSpace; }   // 법선·거칠기는 데이터 — 감마 변환 없이(바탕색만 sRGB)
      }
    }
    if (e.fail) { return; }
    if (e.ok) { cb(e.tex); } else { e.wait.push(cb); }
  }

  var black = null;
  function blackCube(T) {
    if (black || !T.CubeTexture || !global.document) { return black; }
    var c = global.document.createElement('canvas'); c.width = c.height = 1; var g = c.getContext('2d'); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, 1, 1); }
    black = new T.CubeTexture([c, c, c, c, c, c]); black.needsUpdate = true;
    return black;
  }

  /** 표준 재질에 법선·거칠기 맵을 붙인다(실리면). o = { tier, set, tile, w, h, tune } */
  function apply(T, mat, o) {
    o = o || {};
    var p = plan(o.tier, o.tune);
    if (!p.on || !mat || !mat.isMeshStandardMaterial) { return false; }
    var set = SETS[o.set] ? o.set : 'grass', rep = repeatOf(o.w, o.h, o.tile);
    /* 환경광 맵(scene.environment)은 표준 재질만 받는다 — 옛 툰·램버트 땅은 안 받았으므로 기본은 막는다(2나락 마을 바닥이 3배 밝게 하얗게 떴다, W-0295 A/B: 툰 52·램버트 46·표준 148 → 막으면 54).
       three r163+ 는 재질 envMap 이 없으면 scene.environmentIntensity 를 써서 재질 envMapIntensity 0 이 안 먹는다 → 검은 1×1 큐브를 재질 envMap 으로 물린다. o.env > 0 이면 장면 환경광 그대로 */
    if (!(o.env > 0)) { mat.envMap = blackCube(T); mat.envMapIntensity = 0; }
    function put(slot, kind) {
      load(T, set + '_' + kind + '.webp', function (src) {
        var t = src.clone(); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep.x, rep.y); t.needsUpdate = true;
        mat[slot] = t;
        if (slot === 'normalMap' && mat.normalScale) { mat.normalScale.set(p.normalScale, p.normalScale); }
        mat.needsUpdate = true; stat.maps++;
      });
    }
    put('normalMap', p.normal);
    put('roughnessMap', p.rough);
    /* W-0415 — 바탕색까지 바꾸는 세트(o.albedo): 판 그림 대신 <세트>_512.webp 를 tile 반복으로. 실리기 전엔 판 그림·색 그대로, 실리면 색은 o.albedo(16진, 기본 흰)로 */
    if (o.albedo && SETS[set] === 2) {
      load(T, set + '_512.webp', function (src) {
        var t = src.clone(); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep.x, rep.y); t.needsUpdate = true;
        mat.map = t; mat.color.set(typeof o.albedo === 'number' ? o.albedo : 0xffffff); if (o.gain) { mat.color.multiplyScalar(o.gain); }
        mat.needsUpdate = true; stat.maps++;
      }, true);
    }
    mat.userData.pbrGround = set;
    return true;
  }

  /** W-0415 디테일 — 판 바탕 그림(mat.map)에 <세트>_512 바탕색/평균 을 tile 반복으로 곱한다. 판 그림 uv(0~1 한 장)를 rep 배로 */
  function avgOf(img) {
    try {
      var c = global.document.createElement('canvas'); c.width = c.height = 8; var g = c.getContext('2d'); g.drawImage(img, 0, 0, 8, 8);
      var d = g.getImageData(0, 0, 8, 8).data, s = [0, 0, 0], i;
      for (i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; }
      return s.map(function (v) { return Math.max(0.05, Math.pow(v / 64 / 255, 2.2)); });   // sRGB → 선형(셰이더 표본과 같은 공간)
    } catch (e) { return [0.2, 0.2, 0.2]; }
  }
  function detail(T, mat, o) {
    var set = o.set, rep = repeatOf(o.w, o.h, o.tile), k = Math.max(0, Math.min(1, +o.detail || 0));
    if (!k || SETS[set] !== 2 || !mat.map || !global.document || !+tuned((o.tune || 'pbr') + '.detail', 1)) { return false; }
    var uv = parseInt(T.REVISION, 10) >= 151 ? 'vMapUv' : 'vUv';
    load(T, set + '_512.webp', function (src) {
      var a = avgOf(src.image), prev = mat.onBeforeCompile, U = { uDet: { value: src }, uDetRep: { value: new T.Vector2(rep.x, rep.y) }, uDetAvg: { value: new T.Vector3(a[0], a[1], a[2]) }, uDetMix: { value: k } };
      mat.onBeforeCompile = function (sh, r) {
        if (prev) { prev.call(this, sh, r); }
        for (var n in U) { sh.uniforms[n] = U[n]; }
        sh.fragmentShader = 'uniform sampler2D uDet; uniform vec2 uDetRep; uniform vec3 uDetAvg; uniform float uDetMix;\n' + sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n  diffuseColor.rgb *= mix(vec3(1.0), clamp(texture2D(uDet, ' + uv + ' * uDetRep).rgb / uDetAvg, 0.0, 2.0), uDetMix);');
      };
      var pk = mat.customProgramCacheKey; mat.customProgramCacheKey = function () { return (pk ? pk.call(mat) : '') + '+det'; };
      mat.userData.pbrDetail = set; mat.needsUpdate = true; stat.maps++;
    }, true);
    return true;
  }

  /** 옛 땅 재질(램버트·툰) → 같은 색·그림의 표준 재질 + 법선·거칠기. LOW·손잡이 0·three 없음이면 src 그대로 */
  function standardFrom(T, src, o) {
    o = o || {};
    if (!T || !T.MeshStandardMaterial || !src || !plan(o.tier, o.tune).on) { return src; }
    var m = new T.MeshStandardMaterial({
      color: src.color ? src.color.clone() : new T.Color(0xffffff), map: src.map || null,
      transparent: !!src.transparent, opacity: src.opacity === undefined ? 1 : src.opacity, side: src.side === undefined ? T.FrontSide : src.side,
      roughness: o.roughness === undefined ? 1 : o.roughness, metalness: 0, flatShading: !!src.flatShading
    });
    if (src.onBeforeCompile && o.keepShader) { m.onBeforeCompile = src.onBeforeCompile; if (src.customProgramCacheKey) { m.customProgramCacheKey = function () { return src.customProgramCacheKey() + '+std'; }; } }
    if (o.gain) { m.color.multiplyScalar(o.gain); }   // 툰 램프(중간 밝기를 끌어올린다)에서 표준으로 오면 어두워지는 만큼 — 판이 재서 준다
    apply(T, m, o);
    if (o.detail) { detail(T, m, o); }
    stat.made++;
    return m;
  }

  function stats() {
    var files = Object.keys(base);
    return { made: stat.made, maps: stat.maps, fail: stat.fail, loaded: files.filter(function (f) { return base[f].ok; }).length, files: files.length };
  }

  global.DG = global.DG || {};
  global.DG.pbrground3d = { plan: plan, repeatOf: repeatOf, apply: apply, detail: detail, standardFrom: standardFrom, stats: stats, SETS: SETS };
})(window);
