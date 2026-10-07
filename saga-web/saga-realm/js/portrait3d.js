/**
 * 초상 — 도감 카드의 그림을 **실제 모델로 굽는다**
 * ---------------------------------------------------------------
 * 다섯 판 공통 방침("스크립트로 그리는 것은 다 에셋으로", 2026-08-28) 을
 * saga-go 에 이어 이 판에도 옮긴다. 여태 인물(장수) 초상은 `sprite.js` 가
 * 캔버스에 도형으로 그렸다.
 *
 * 이 판은 인물이 걸어 다니지 않아(턴제 지도) 여태 사람 GLB 창고가 없었다 —
 * 이번에 `js/asset3d.js` 에 `HERO_RECIPES`·`buildHero()` 를 처음 들였다
 * (`assets/ASSET_LICENSES.md` 참고). `buildHero(ref, tintHex, cb)` 는
 * **콜백 방식**이라 saga-go 처럼 "굽는 대상이 아직 도형이면 몇 번 다시
 * 본다" 는 폴링이 필요 없다 — 콜백이 오는 순간 바로 굽는다.
 *
 * 이 판의 `buildHero` 는 몸짓 이름 맞추기(`mapClips`)를 옮기지 않았다 —
 * 걷는 화면이 없어 슬롯(걷기·공격 등)이 필요 없고, 초상은 **그냥 그럴듯한
 * 자세 하나**만 있으면 된다. 그래서 여기서 클립 이름에 "idle" 이 있으면
 * 그것을, 없으면 첫 클립을 그냥 쓴다.
 *
 *   of(kind, ref, w, h)    다 구웠으면 dataURL, 아니면 null (동기)
 *   warm(kind, ref, w, h)  굽기 시작한다. 되면 `sweep()` 이 화면을 갈아 끼운다
 *   sweep()                `[data-p3]` 가 붙은 <img> 를 훑어 src 를 바꾼다
 *
 * **되돌아가는 길이 그대로다.** three 가 없거나 GLB 를 못 받거나(`file://`
 * 단독판) 손잡이(`portrait3d.on`)를 내리면 `null` 을 주고, 부르는 쪽은
 * 여태 쓰던 `sprite.portraitCard` 그림을 그대로 쓴다. 화면은 안 빈다.
 *
 * **한 줄도 판정에 닿지 않는다.** 여기서 만드는 것은 그림뿐이다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  /** 초상을 모델로 구울까 — 0 이면 여태 쓰던 캔버스 그림 그대로 (되돌림용) */
  function ON() { return core().tuned('portrait3d.on', 1) ? true : false; }

  /* ── 값을 내는 함수 — three 없이도 돈다 (자가진단이 이것만 본다) ────── */

  function keyOf(kind, ref, w, h) {
    var id = (ref && (ref.id || ref.key || ref.name)) || 'x';
    return kind + ':' + id + ':' + Math.round(w) + 'x' + Math.round(h);
  }

  function parseKey(s) {
    var m = /^([a-z]+):([^:]+):(\d+)x(\d+)$/.exec(String(s || ''));
    if (!m) { return null; }
    return { kind: m[1], id: m[2], w: +m[3], h: +m[4] };
  }

  function hexOf(css, def) {
    if (!css) { return def; }
    var n = parseInt(String(css).replace('#', ''), 16);
    return isNaN(n) ? def : n;
  }

  /** 카메라를 어디에 두나 — **키 1 로 눕힌 모델** 기준의 순수 계산이다 */
  /** 2026-09-23 "고품질 셀 셰이딩급" — 사람 초상은 **흉상**(가슴 위). 예전 구도(머리~허벅지)는 카드에서 얼굴이 작았다.
   *  손잡이 `portrait3d.bust`(0 이면 예전 구도). 키 1 모델에서 0.65~1.07 쯤이 카드 세로에 들어온다 */
  function BUST() {
    var c = global.DG && global.DG.core;
    return c && c.tuned ? (c.tuned('portrait3d.bust', 1) ? true : false) : true;
  }
  /** 몬스터 몸 장수(`ref.monster`)는 사람 비례가 아니라(머리가 몸 절반) 흉상·예전 구도 모두 뿔·몸통만 크게 잡혔다 — 전신 */
  function camPlan(w, h, ref) {
    var aspect = w / Math.max(1, h);
    var beast = !!(ref && ref.monster);
    var span = beast ? 1.1 : (BUST() ? 0.37 : 0.62);
    var fov = 26;
    var dist = (span / 2) / Math.tan(fov * Math.PI / 360);
    if (aspect < 1) { dist = dist / Math.max(0.55, aspect); }
    var look = beast ? 0.5 : (BUST() ? 0.86 : 0.78);
    return { fov: fov, dist: dist, look: look, aspect: aspect, yaw: beast ? 0.55 : 0.42, pitch: 0.06 };
  }

  /* ── 여기서부터 three 가 필요하다 ─────────────────────── */

  var renderer = null, scene = null, camera = null, rig = null, failed = false;
  var cache = {};           // { key: dataURL }
  var pending = {};         // { key: true }  굽는 중
  var made = 0, gaveUp = 0;

  /* ── 디스크 초상 (SAGA-DESIGN §11 Phase 1) ───────────────────
   * `tools/bake-portraits` 가 미리 구워 둔 `assets/portraits/<종류>/<id>_s|c.webp` — `manifest.js` 에 적힌 것만 있다.
   * 굽기(three·GLB 대기)를 거치지 않고 `of()` 가 곧바로 파일 주소를 준다. 정사각(≤110px)은 _s, 150×172 꼴은 _c.
   * 목록에 없거나 손잡이(`portrait3d.on`)가 내려가면 null — 예전처럼 굽는다. */
  var diskSet = null, diskFrom = null;
  function diskClass(w, h) {
    if (w === h && w <= 110) { return 's'; }
    if (h > 0 && Math.abs(w / h - 150 / 172) < 0.03) { return 'c'; }
    return '';
  }
  function diskById(kind, id, w, h) {
    var M = global.DG.portraitDisk, t = diskClass(w, h), k, tt;
    if (!M || !M.ids || !t || !ON()) { return null; }
    if (diskFrom !== M) {
      diskSet = {}; diskFrom = M;
      for (k in M.ids) { for (tt in M.ids[k]) { String(M.ids[k][tt]).split(',').forEach(function (x) { if (x) { diskSet[k + ':' + tt + ':' + x] = 1; } }); } }
    }
    return diskSet[kind + ':' + t + ':' + id] ? M.base + kind + '/' + id + '_' + t + '.webp' : null;
  }
  function diskOf(kind, ref, w, h) {
    var id = ref && (ref.id || ref.key || ref.name);
    return id ? diskById(kind, id, Math.round(w), Math.round(h)) : null;
  }
  function diskOfKey(k) {
    var p = parseKey(k);
    return p ? diskById(p.kind, p.id, p.w, p.h) : null;
  }

  function ready() { return !!(three() && ON() && !failed); }

  function boot() {
    if (renderer || failed) { return !!renderer; }
    var t = three();
    if (!t) { failed = true; return false; }
    try {
      var cv = document.createElement('canvas');
      renderer = new t.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(1);
      if (t.NeutralToneMapping) { renderer.toneMapping = t.NeutralToneMapping; }   // 2026-09-23 ACES→Neutral: ACES 는 VRoid 살색을 회백색으로 탈색시켰다(스크린샷)
      renderer.toneMappingExposure = 0.8;   // 조명(반구 2.3·주광 1.9·보조 둘)이 세서 Neutral 1.0 이면 피부가 하얗게 날아간다
      if (t.SRGBColorSpace) { renderer.outputColorSpace = t.SRGBColorSpace; }
      scene = new t.Scene();
      camera = new t.PerspectiveCamera(26, 1, 0.01, 40);
      /* delam() 이 Quaternius PBR 을 Lambert 로 물들여(위 주석) 환경맵 반사가
         안 먹는다 — 대신 **얼굴이 어느 쪽을 보든 카메라 쪽에서 늘 빛을 받게**
         key·fill 을 카메라와 같은 +Z 쪽에 둔다(고전 인물사진 조명). 예전엔
         fill 이 반대쪽(-Z, 인물 뒤)에 있어 사실상 역광이었다 — 얼굴이 통째로
         까맣게 뜨던 원인이었다(2026-09-03). 후드·투구를 쓴 무장은 그래도
         턱 밑이 그늘져 어둡게 나와 **아래에서 받쳐 주는 바운스광**을 하나 더 둔다 */
      scene.add(new t.HemisphereLight(0xdCE8FF, 0x746a5c, 2.3));
      var sun = new t.DirectionalLight(0xFFF3DC, 1.9);
      sun.position.set(0.9, 1.7, 2.0);
      scene.add(sun);
      var fill = new t.DirectionalLight(0xbdd2ee, 1.1);
      fill.position.set(-1.1, 1.1, 1.6);
      scene.add(fill);
      var bounce = new t.DirectionalLight(0xffe9c8, 0.55);
      bounce.position.set(0, -1.0, 1.3);
      scene.add(bounce);
      rig = new t.Group();
      scene.add(rig);
    } catch (e) { failed = true; renderer = null; }
    return !!renderer;
  }

  function colorsOf(kind, ref) {
    var D = global.DG.data;
    var isHero = kind === 'hero';
    var fac = isHero ? D.faction(ref.faction)
      : { color: ref.kind === 'divine' ? '#8a5cc0' : '#5f7a4a',
          mark: ref.kind === 'divine' ? '神' : '獸' };
    var rar = D.rarity[ref.rarity] || D.rarity[3];
    return { fac: fac, rar: rar };
  }

  function paintBack(c, w, h, kind, ref) {
    var col = colorsOf(kind, ref);
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(col.fac.color, 0.16));
    g.addColorStop(1, shade(col.fac.color, -0.52));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.save();
    c.globalAlpha = 0.16;
    c.fillStyle = '#ffffff';
    c.font = '700 ' + Math.round(h * 0.52) + 'px "Malgun Gothic", serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(col.fac.mark, w * 0.5, h * 0.5);
    c.restore();
    c.save();
    c.globalAlpha = 0.3;
    c.fillStyle = '#000000';
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.93, w * 0.28, h * 0.035, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    return col;
  }

  function paintFrame(c, w, h, col) {
    c.strokeStyle = col.rar && col.rar.color ? col.rar.color : '#8a94a6';
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);
  }

  function shade(hex, amt) {
    var S = global.DG.sprite;
    if (S && S.shade) { return S.shade(hex, amt); }
    return hex;
  }

  /** 쉬는 자세로 한 번 굴린다 — `mapClips` 가 없으니 이름에 idle 이 있는
   *  클립을 직접 찾고, 없으면 첫 클립을 그냥 쓴다 */
  function settle(node) {
    if (!node || !node.userData || !node.userData.mixer) { return; }
    /* 2026-09-23 — VRoid 자체 몸짓(`anim-own`) 길은 `clips` 없이 `actions`·`clipMap` 만 싣는다. 여기가 `clips` 만 봐서
       초상이 전부 **T자세**로 구워졌다(스크린샷). 사가종횡·사가마을 settle 과 같은 길을 먼저 탄다 */
    var U = node.userData;
    if (U.actions) {
      var cm = U.clipMap || {}, nm = cm.idle || cm.walk || Object.keys(U.actions)[0], act = nm && U.actions[nm];
      if (act) {
        try { act.reset().play(); U.mixer.update(0.45); } catch (e) { /* 자세를 못 잡아도 그림은 나온다 */ }
        return;
      }
    }
    if (!node.userData.clips) { return; }
    var clips = node.userData.clips;
    var pick = null, i;
    for (i = 0; i < clips.length; i++) {
      if (/idle|stand|breathe|rest|wait/i.test(clips[i].name)) { pick = clips[i]; break; }
    }
    if (!pick) { pick = clips[0]; }
    if (!pick) { return; }
    try {
      node.userData.mixer.clipAction(pick).reset().play();
      node.userData.mixer.update(0.45);
    } catch (e) { /* 자세를 못 잡아도 그림은 나온다 */ }
  }

  function bake(kind, ref, w, h, node) {
    if (!boot() || !node) { return null; }

    var plan = camPlan(w, h, ref);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var pw = Math.max(16, Math.round(w * dpr)), ph = Math.max(16, Math.round(h * dpr));

    while (rig.children.length) { rig.remove(rig.children[0]); }
    rig.add(node);
    node.position.set(0, 0, 0);
    node.scale.setScalar(1);
    node.rotation.set(0, plan.yaw, 0);

    settle(node);

    camera.fov = plan.fov;
    camera.aspect = plan.aspect;
    camera.position.set(0, plan.look + plan.dist * Math.sin(plan.pitch), plan.dist);
    camera.lookAt(0, plan.look, 0);
    camera.updateProjectionMatrix();

    renderer.setSize(pw, ph, false);
    renderer.render(scene, camera);

    var cv = document.createElement('canvas');
    cv.width = pw; cv.height = ph;
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var col = paintBack(c, w, h, kind, ref);
    c.drawImage(renderer.domElement, 0, 0, w, h);
    paintFrame(c, w, h, col);

    rig.remove(node);
    made++;
    try { return cv.toDataURL('image/png'); } catch (e) { return null; }
  }

  function of(kind, ref, w, h) {
    var d = diskOf(kind, ref, w, h);
    if (d) { return d; }
    if (!ready()) { return null; }
    return cache[keyOf(kind, ref, w, h)] || null;
  }

  /**
   * 굽는 줄 — **한 번에 하나씩만** 굽는다. 여러 인물을 한꺼번에 부르면
   * WebGL 렌더 여러 개가 겹친다 — 2026-09-02, 다른 판(사가나락·사가마을)에서
   * 필드를 걷거나 전투할 때 끊긴다는 신고를 받고 줄을 세웠다. 실패도
   * `cache[key] = false` 로 **한 번만** 적어 두고 다시 시도하지 않는다 —
   * 안 그러면 실패하는 인물 하나가 화면이 떠 있는 내내 계속 다시 구우려
   * 든다(같은 신고의 진짜 원인이었다).
   */
  var queue = [];
  var busy = false;

  function has(key) { return Object.prototype.hasOwnProperty.call(cache, key); }

  function pump() {
    if (busy || !queue.length) { return; }
    var job = queue.shift();
    busy = true;
    var A3 = global.DG.asset3d;
    if (!A3 || !A3.buildHero) { delete pending[job.key]; cache[job.key] = false; busy = false; pump(); return; }

    var fac = global.DG.data.faction(job.ref.faction);
    try {
      A3.buildHero(job.ref, hexOf(fac.color, null), function (model) {
        delete pending[job.key];
        busy = false;
        if (!model) { cache[job.key] = false; gaveUp++; pump(); return; }
        var url = null;
        try { url = bake(job.kind, job.ref, job.w, job.h, model); } catch (e) { url = null; }
        if (url) { cache[job.key] = url; sweep(); } else { cache[job.key] = false; gaveUp++; }
        pump();
      });
    } catch (e) { delete pending[job.key]; cache[job.key] = false; gaveUp++; busy = false; pump(); }
  }

  /** 줄에 올린다 — `asset3d.buildHero` 콜백이 한 번 오면 그 자리에서 곧바로 굽는다 */
  function warm(kind, ref, w, h) {
    if (diskOf(kind, ref, w, h)) { return false; }      // 구워 둔 파일이 있으면 다시 안 굽는다
    if (!ready() || !ref || kind !== 'hero') { return false; }
    var key = keyOf(kind, ref, w, h);
    if (has(key) || pending[key]) { return false; }
    var A3 = global.DG.asset3d;
    if (!A3 || !A3.buildHero) { return false; }
    pending[key] = true;
    queue.push({ kind: kind, ref: ref, w: w, h: h, key: key });
    pump();
    return true;
  }

  /* ── 자리표시 (SAGA-DESIGN §11 Phase 0) ─────────────────────
   * 3D 초상이 구워지기 전에 코드로 그린 스프라이트(`sprite.portrait`)가 먼저 비치던 것을 끊는다. 3D 로 **꼭** 갈아 끼워질
   * 자리(willSwap)는 중립 자리표시로 시작하고(`data-p3-holder`), 3D 를 못 쓰게 되면(굽기 포기·three 실패·손잡이 내림) 옛 그림으로 되돌린다.
   * 갈아 끼워지지 않을 자리(건물·되읽을 이름표가 없는 참조)는 예전처럼 코드 그림으로 시작한다 — 그런 자리를 비워 두면 영영 빈다. */
  var holderCache = {};
  function holder(w, h) {
    w = Math.max(8, Math.round(w || 48)); h = Math.max(8, Math.round(h || w));
    var key = w + 'x' + h;
    if (holderCache[key]) { return holderCache[key]; }
    var cx = w / 2, hr = Math.min(w, h) * 0.17, hy = h * 0.38, sy = h * 0.62, sw = hr * 2.1;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<rect width="' + w + '" height="' + h + '" rx="' + (Math.min(w, h) * 0.08).toFixed(1) + '" fill="#8a8578" fill-opacity=".16"/>' +
      '<circle cx="' + cx + '" cy="' + hy.toFixed(1) + '" r="' + hr.toFixed(1) + '" fill="#8a8578" fill-opacity=".28"/>' +
      '<path d="M' + (cx - sw).toFixed(1) + ' ' + h + 'Q' + (cx - sw).toFixed(1) + ' ' + sy.toFixed(1) + ' ' + cx + ' ' + sy.toFixed(1) +
      'Q' + (cx + sw).toFixed(1) + ' ' + sy.toFixed(1) + ' ' + (cx + sw).toFixed(1) + ' ' + h + 'Z" fill="#8a8578" fill-opacity=".28"/></svg>';
    holderCache[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return holderCache[key];
  }

  /** 이 자리가 3D 로 꼭 갈아 끼워지는가 — 되읽을 이름표가 있고 `data.find` 가 찾으며 아직 굽기를 포기하지 않았을 때만 */
  function willSwap(kind, ref, w, h) {
    if (!ready() || !ref || (kind !== 'hero' && kind !== 'pet')) { return false; }
    if (typeof supports === 'function' && !supports(kind, ref)) { return false; }
    var key = keyOf(kind, ref, w, h), p = parseKey(key), D = global.DG.data;
    if (cache[key] === false) { return false; }
    return !!(p && D && D.find && D.find(p.id));
  }

  /** 자리표시로 시작한 그림을 옛 그림(코드 스프라이트)으로 되돌린다 */
  function revert(el, k) {
    var p = parseKey(k), D = global.DG.data, S = global.DG.sprite;
    var ref = p && D && D.find ? D.find(p.id) : null, src = '';
    if (ref && S) {
      try { src = Math.round(p.w) === Math.round(p.h) ? S.portrait(p.kind, ref, p.w) : S.portraitCard(p.kind, ref, p.w, p.h); } catch (e) { src = ''; }
    }
    if (src) { el.src = src; }
    el.removeAttribute('data-p3-holder');
    el.setAttribute('data-p3-done', '1');
  }

  var holderTimer = null;
  function sweep() {
    if (!global.document) { return 0; }
    var live = ready();
    var list = document.querySelectorAll('img[data-p3]');
    var n = 0, i, waiting = false;
    for (i = 0; i < list.length; i++) {
      var el = list[i];
      var k = el.getAttribute('data-p3');
      var got = diskOfKey(k) || (live ? cache[k] : null);
      if (got) {
        if (el.getAttribute('data-p3-done') !== '1') {
          el.src = got;
          el.removeAttribute('data-p3-holder');
          el.setAttribute('data-p3-done', '1');
          n++;
        }
        continue;
      }
      if (el.hasAttribute('data-p3-holder')) {
        /* 굽기를 포기했거나 3D 를 못 쓰게 됐다 — 자리표시를 그대로 두면 영영 비니 옛 그림으로 */
        if (!live || cache[k] === false) { revert(el, k); n++; continue; }
        waiting = true;
      }
      if (!live) { continue; }
      var p = parseKey(k);
      if (!p) { continue; }
      var D = global.DG.data;
      var ref = D && D.find ? D.find(p.id) : null;
      if (ref) { warm(p.kind, ref, p.w, p.h); }
    }
    /* 굽는 쪽은 실패해도 sweep 을 부르지 않는다 — 자리표시가 남아 있는 동안은 스스로 다시 본다 */
    if (waiting && !holderTimer) {
      holderTimer = global.setTimeout(function () { holderTimer = null; sweep(); }, 400);
    }
    return n;
  }

  function stats() {
    return { on: ON(), ready: ready(), failed: failed, made: made, gaveUp: gaveUp,
      cached: Object.keys(cache).length, pending: Object.keys(pending).length };
  }

  global.DG = global.DG || {};
  global.DG.portrait3d = {
    ON: ON, ready: ready, keyOf: keyOf, of: of, warm: warm, sweep: sweep, stats: stats,
    /* 자리표시(Phase 0) */
    holder: holder, willSwap: willSwap, _fail: function (k, undo) { if (undo) { delete cache[k]; } else { cache[k] = false; } }
  };
})(window);
