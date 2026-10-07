/**
 * 초상 — 도감 카드의 그림을 **실제 모델로 굽는다**
 * ---------------------------------------------------------------
 * 2026-09-02 한 번 이 자리를 EverFace(CC0 그림 조각) 합성으로 바꿨었다 —
 * 그때의 3D 굽기가 "그림 자체 품질이 낮다"는 지적을 받아서였다. 이번에
 * saga-realm 에서 그 저품질의 진짜 원인 셋을 찾아 고쳤다(2026-09-03):
 *   1. 카메라가 얼굴이 아니라 **뒤통수**를 보고 있었다(회전에 `+Math.PI`가
 *      더 붙어 있었다)
 *   2. 표시 크기(150×172)보다 훨씬 작게(52px 등) 구워서 CSS 가 늘려 썼다 —
 *      3D 인데도 흐릿하고 각져 보인 진짜 이유
 *   3. 조명이 인물 **뒤**(-Z)에서 비춰 사실상 역광이었다
 * saga-go 는 `.dt-portrait`(`ui.js`)가 이미 150×172 로 알맞게 구워 달라고
 * 하고 있어 2번은 원래 없던 문제다. 1·3 번만 고쳐 다시 3D 로 돌아간다.
 * EverFace/nonemo 그림 조각(`assets/sprites2d/portrait/`)은 지우지 않았다 —
 * `icon.js` 등 다른 자리가 쓸 수도 있고, three 가 없는 자리의 되돌아가는
 * 길은 여전히 `sprite.portrait`/`sprite.portraitCard`(캔버스 도형)다.
 *
 *   of(kind, ref, w, h)    다 구웠으면 dataURL, 아니면 null (동기)
 *   warm(kind, ref, w, h)  굽기 시작한다. 되면 `sweep()` 이 화면을 갈아 끼운다
 *   sweep()                `[data-p3]` 가 붙은 <img> 를 훑어 src 를 바꾼다
 *
 * **되돌아가는 길이 그대로다.** three 가 없거나 GLB 를 못 받거나(`file://`
 * 단독판) 손잡이(`portrait3d.on`)를 내리면 `null` 을 주고, 부르는 쪽은
 * 여태 쓰던 `sprite.portrait`/`sprite.portraitCard` 그림을 그대로 쓴다.
 * 화면은 안 빈다. **한 줄도 판정에 닿지 않는다.** 여기서 만드는 것은 그림뿐이다.
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

  /**
   * 카메라를 어디에 두나 — **키 1 로 눕힌 모델** 기준의 순수 계산이다.
   *
   * **펫은 결이 다르다** — 사람(hero)은 두 발로 서 있어 "가슴 위"가 자연스럽지만,
   * 짐승은 대개 네 발 달린 몸이 옆으로 길다. 몸통 전체가 잘려 나가지 않게
   * **더 물러나서(span 키움) 낮은 곳을 보고(look 낮춤) 옆모습에 가깝게(yaw 키움)**
   * 잡는다(사가나락 `portrait3d.js` camPlan 과 같은 판단, 2026-09-05 이식).
   */
  /** 2026-09-23 "고품질 셀 셰이딩급" — 사람 초상은 **흉상**(가슴 위). 예전 구도(머리~허벅지)는 카드에서 얼굴이 작았다.
   *  손잡이 `portrait3d.bust`(0 이면 예전 구도). 키 1 모델에서 0.65~1.07 쯤이 카드 세로에 들어온다 */
  function BUST() {
    var c = global.DG && global.DG.core;
    return c && c.tuned ? (c.tuned('portrait3d.bust', 1) ? true : false) : true;
  }
  function camPlan(w, h, kind) {
    var isPet = kind === 'pet';
    var aspect = w / Math.max(1, h);
    var span = isPet ? 1.5 : (BUST() ? 0.37 : 0.62);
    var fov = 26;
    var dist = (span / 2) / Math.tan(fov * Math.PI / 360);
    if (aspect < 1) { dist = dist / Math.max(0.55, aspect); }
    var look = isPet ? 0.28 : (BUST() ? 0.86 : 0.78);
    var yaw = isPet ? 0.95 : 0.42;
    return { fov: fov, dist: dist, look: look, aspect: aspect, yaw: yaw, pitch: 0.06 };
  }

  /**
   * 펫은 **실제 몸 상자**로 맞춘다(2026-09-23) — 배우는 키 1 로 눕는데(`asset3d.fit`) 납작하고 긴 물고기·황새치·공룡은
   * 네발 고정 구도(span 1.5·look 0.28)를 한참 넘어 얼굴·눈만 크게 찍혔다(펫 초상 모음). 자세를 굴린 뒤 스킨이 반영된
   * 상자를 재서, 바라보는 높이는 네발과 같은 비율(바닥 + 키의 28%)로 두고 위 끝·가로가 다 들어오게 물러난다.
   * 네발은 이 계산으로도 예전과 거의 같은 거리다. 손잡이 `portrait3d.petFit`(0 이면 예전 고정 구도)
   */
  function PET_FIT() {
    var c = global.DG && global.DG.core;
    return c && c.tuned ? (c.tuned('portrait3d.petFit', 1) ? true : false) : true;
  }
  /** 자세가 반영된 몸 상자(월드) — 외곽선 사본은 뺀다 */
  function bodyBox(t, node) {
    node.updateMatrixWorld(true);
    var box = new t.Box3(), one = new t.Box3();
    node.traverseVisible(function (o) {
      if (!o.isMesh || !o.geometry || /_outline$/.test(o.name || '')) { return; }
      if (o.isSkinnedMesh && o.computeBoundingBox) {
        if (o.skeleton) { o.skeleton.update(); }
        o.computeBoundingBox();   // 뼈 자세가 반영된 메시 지역 상자
        one.copy(o.boundingBox);
      } else {
        if (!o.geometry.boundingBox) { o.geometry.computeBoundingBox(); }
        one.copy(o.geometry.boundingBox);
      }
      box.union(one.applyMatrix4(o.matrixWorld));
    });
    return box;
  }
  /** 물고기는 긴 축이 옆으로 오게 — 네발과 같은 yaw(0.95)면 3/4 정면이라 얼굴·눈만 보였다. 모델마다 앞 방향 축이 달라 상자로 가른다 */
  function petYaw(node, ref, yaw) {
    var t = three(), S = global.DG && global.DG.sprite;
    if (!t || !PET_FIT() || !S || !S.beastFormOf || S.beastFormOf(ref) !== 'fish') { return yaw; }
    node.rotation.set(0, 0, 0);
    var box = bodyBox(t, node);
    if (box.isEmpty()) { return yaw; }
    var sz = box.getSize(new t.Vector3());
    return sz.z >= sz.x ? 1.3 : 1.3 - Math.PI / 2;
  }
  function petFrame(plan, node) {
    var t = three();
    if (!t || !node || !PET_FIT()) { return plan; }
    var box = bodyBox(t, node);
    if (box.isEmpty()) { return plan; }
    var sz = box.getSize(new t.Vector3()), mid = box.getCenter(new t.Vector3());
    if (!(sz.y > 0)) { return plan; }
    var look = box.min.y + sz.y * 0.28;
    var needV = Math.max((box.max.y - look) * 2, sz.x / plan.aspect) * 1.12;
    var dist = (needV / 2) / Math.tan(plan.fov * Math.PI / 360) + sz.z / 2;
    return { fov: plan.fov, dist: dist, look: look, aspect: plan.aspect, yaw: plan.yaw, pitch: plan.pitch, cx: mid.x, cz: mid.z };
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

  /** 오프스크린 렌더러 — **한 번만** 만든다. 초상마다 만들면 컨텍스트가 넘친다 */
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
      /* asset3d.delam() 이 PBR 을 Lambert 로 물들여 환경맵 반사가 안 먹는다 —
         대신 **얼굴이 어느 쪽을 보든 카메라 쪽에서 늘 빛을 받게** key·fill·
         bounce 를 전부 카메라와 같은 +Z 쪽에 둔다(고전 인물사진 조명) */
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

  /** 세력·등급 빛깔 — 카드 배경을 여기서 곧바로 정한다(`sprite` 와 같은 규칙) */
  function colorsOf(kind, ref) {
    var D = global.DG.data;
    var isHero = kind === 'hero';
    var fac = isHero ? D.faction(ref.faction)
      : { color: ref.kind === 'divine' ? '#8a5cc0' : '#5f7a4a',
          mark: ref.kind === 'divine' ? '神' : '獸' };
    var rar = D.rarity[ref.rarity] || D.rarity[3];
    return { fac: fac, rar: rar };
  }

  function shade(hex, amt) {
    var S = global.DG.sprite;
    if (S && S.shade) { return S.shade(hex, amt); }
    return hex;
  }

  /**
   * 카드 배경 — 세력색 그라디언트에 큼직한 문양, 테두리는 등급색.
   * 캔버스 되돌림 그림(`sprite.portraitCard`)과 같은 결을 잇는다.
   */
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
    return col;
  }

  /** 테두리는 **인물 위에** 얹는다 — 밑에 깔면 어깨가 테두리를 덮는다 */
  function paintFrame(c, w, h, col) {
    c.strokeStyle = col.rar && col.rar.color ? col.rar.color : '#8a94a6';
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);
  }

  /**
   * 한 사람을 굽는다. 모델이 아직 도형(placeholder)이면 **아무것도 안 하고
   * null** — GLB 가 다 오면(`assetState==='glb'`) `warm` 이 다시 부른다.
   */
  function bake(kind, ref, w, h, node) {
    if (!boot()) { return null; }
    if (!node || !node.userData || node.userData.assetState !== 'glb') { return null; }

    var plan = camPlan(w, h, kind);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var pw = Math.max(16, Math.round(w * dpr)), ph = Math.max(16, Math.round(h * dpr));

    while (rig.children.length) { rig.remove(rig.children[0]); }
    rig.add(node);
    node.position.set(0, 0, 0);
    node.scale.setScalar(1);
    node.rotation.set(0, kind === 'pet' ? petYaw(node, ref, plan.yaw) : plan.yaw, 0);

    /* 쉬는 자세를 한 번 굴려 준다 — 안 그러면 T 자로 굳은 채 찍힌다 */
    var A = global.DG.asset3d;
    try {
      if (A && A.step) { A.step(node, { t: 0, walking: false }); A.step(node, { t: 0.45, walking: false }); }
    } catch (e) { /* 자세를 못 잡아도 그림은 나온다 */ }
    if (kind === 'pet') { plan = petFrame(plan, node); }

    camera.fov = plan.fov;
    camera.aspect = plan.aspect;
    camera.far = Math.max(40, plan.dist * 3);   // 긴 몸(공룡·고래)은 petFrame 이 멀리 물러나 고정 far 를 넘어 빈 카드가 됐다
    var cx = plan.cx || 0, cz = plan.cz || 0;
    camera.position.set(cx, plan.look + plan.dist * Math.sin(plan.pitch), cz + plan.dist);
    camera.lookAt(cx, plan.look, cz);
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

  /** 다 구워 뒀으면 그림, 아니면 null */
  function of(kind, ref, w, h) {
    var d = diskOf(kind, ref, w, h);
    if (d) { return d; }
    if (!ready()) { return null; }
    return cache[keyOf(kind, ref, w, h)] || null;
  }

  /**
   * 굽는 줄 — **한 번에 하나씩만** 굽는다. 여러 인물을 한꺼번에 부르면
   * 지도 위 실제 3D 화면과 GPU 를 다툰다 — 다른 판(사가나락 등)에서 필드를
   * 걷거나 전투할 때 끊긴다는 신고를 받고 줄을 세운 적이 있다. 실패도
   * `cache[key] = false` 로 **한 번만** 적어 두고 다시 시도하지 않는다.
   */
  var queue = [];
  var busy = false;

  function has(key) { return Object.prototype.hasOwnProperty.call(cache, key); }

  function pump() {
    if (busy || !queue.length) { return; }
    var job = queue.shift();
    busy = true;

    var A3 = global.DG.asset3d;
    var node = null;
    /* 2026-09-05 — 펫(동물)도 굽는다. `A3.build()`는 kind 로 hero·pet 을 이미
       가른다(pet 은 keysFor()가 'pet:'+id → 'pet:form:'+form → 'pet' 순으로
       찾는다) — CC0 모델이 없는 종은 urlOf()가 null 을 줘 도형인 채로 남고
       bake()의 assetState==='glb' 문턱에 걸려 조용히 그 자리에서 멈춘다 */
    try { node = A3.build(job.kind, job.ref, null); } catch (e) { node = null; }
    if (!node) {
      cache[job.key] = false; gaveUp++; delete pending[job.key]; busy = false; pump();
      return;
    }

    var tries = 0;
    function tick() {
      var url = null;
      try { url = bake(job.kind, job.ref, job.w, job.h, node); } catch (e) { url = null; }
      if (url) {
        cache[job.key] = url;
        delete pending[job.key];
        busy = false;
        sweep();
        pump();
        return;
      }
      if (++tries > 24) {                       // 여남은 번 뒤엔 포기 — 캔버스 그림으로 남는다, 다시 안 본다
        cache[job.key] = false;
        delete pending[job.key];
        gaveUp++;
        busy = false;
        pump();
        return;
      }
      global.setTimeout(tick, 220);
    }
    tick();
  }

  /** 줄에 올린다. `asset3d.build` 가 준 껍데기는 GLB 가 오는 순간 안이
   *  갈리는데, 그 순간을 알려 주지 않으므로 잠깐씩 다시 본다(최대 여남은 번) */
  function warm(kind, ref, w, h) {
    if (diskOf(kind, ref, w, h)) { return false; }      // 구워 둔 파일이 있으면 다시 안 굽는다
    if (!ready() || !ref || (kind !== 'hero' && kind !== 'pet')) { return false; }
    var key = keyOf(kind, ref, w, h);
    if (has(key) || pending[key]) { return false; }
    var A3 = global.DG.asset3d;
    if (!A3 || !A3.build) { return false; }
    pending[key] = true;
    queue.push({ kind: kind, ref: ref, w: w, h: h, key: key });
    pump();
    return true;
  }

  /**
   * 화면에 이미 붙은 그림을 갈아 끼운다.
   * 부르는 쪽(`ui.js`)은 여태처럼 `sprite` 그림으로 `<img>` 를 만들고,
   * 거기에 이름표(`data-p3`)만 붙여 둔다. 다 구워지면 여기서 `src` 만 바꾼다.
   */
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
    return {
      on: ON(), ready: ready(), failed: failed,
      made: made, gaveUp: gaveUp,
      cached: Object.keys(cache).length,
      baking: Object.keys(pending).length
    };
  }

  /* ── 부르는 쪽이 다 같이 쓰는 <img> 빌더 ────────────────────
   * 카드 화면마다(등용·포획·성채·천거장·도적·대화…) 저마다 `sprite.portrait`로
   * 초상을 그려 붙이고 있었다 — `ui.js`의 `pt()`만 이 자리(`data-p3`)를 붙여
   * 실제 3D 모델로 갈아 끼웠고, 나머지는 여태 캔버스 그림에 갇혀 있었다
   * (2026-09-06, 실제 세이브를 이어 플레이하다 발견). 이제 이 함수 하나로
   * 모으면 그 화면들도 같은 자리에서 자동으로 3D 초상을 받는다.
   */
  var sweepTimer = null;
  function scheduleSweep() {
    if (sweepTimer) { return; }
    sweepTimer = global.setTimeout(function () { sweepTimer = null; sweep(); }, 40);
  }

  /** 이름표(`data-p3="..."`)만 낸다 — 정사각이 아닌 자리(도감 상세의 150×172 등)가
   *  제 마크업을 직접 짜면서 이 조각만 끼워 넣을 때 쓴다. 못 쓸 자리(three 없음 ·
   *  손잡이 내림 · hero/pet 이외)에서는 빈 문자열이라 여태 그림이 그대로 남는다. */
  function tag(kind, ref, w, h) {
    if (!ready() || !ref || (kind !== 'hero' && kind !== 'pet')) { return ''; }
    scheduleSweep();
    return ' data-p3="' + keyOf(kind, ref, w, h) + '"';
  }

  /** 초상 `<img>` 태그를 통째로 만든다(정사각形 자리용). **이미 구워 둔 그림이
   *  있으면 그걸로 바로 시작한다** — 매번 캔버스 그림으로 시작했다가 40ms 뒤
   *  갈아 끼우면, 이미 구운 인물도 다시 볼 때마다(대화·교전 등 반복해서 여는
   *  화면) 2D 그림이 잠깐 비쳤다 3D 로 바뀌어 깜빡이는 것처럼 보였다
   *  (2026-09-19, "초상이 2D 스프라이트랑 겹쳐서 깜빡인다" 제보로 발견).
   *  아직 안 구웠으면 여태처럼 `sprite` 그림으로 시작하고 `sweep()`이 갈아
   *  끼운다(화면은 한 번도 비지 않는다). `cls`는 `pt` 뒤에 덧붙는 꾸밈
   *  클래스(예: 실패 카드의 `dark`) */
  function img(kind, ref, size, cls) {
    var S = global.DG.sprite;
    var baked = of(kind, ref, size, size), hold = !baked && willSwap(kind, ref, size, size);
    var src = baked || (hold ? holder(size, size) : (S ? S.portrait(kind, ref, size) : ''));   // 갈아 끼울 자리는 코드 그림 대신 자리표시(§11 Phase 0)
    return '<img class="pt' + (cls ? ' ' + cls : '') + '" alt=""' +
      tag(kind, ref, size, size) + (baked ? ' data-p3-done="1"' : (hold ? ' data-p3-holder="1"' : '')) +
      ' src="' + src + '">';
  }

  global.DG = global.DG || {};
  global.DG.portrait3d = {
    /* 값을 내는 함수 */
    keyOf: keyOf, parseKey: parseKey,
    /* 만들기 */
    ready: ready, of: of, warm: warm, sweep: sweep, tag: tag, img: img, stats: stats,
    /* 자리표시(Phase 0) */
    holder: holder, willSwap: willSwap, _fail: function (k, undo) { if (undo) { delete cache[k]; } else { cache[k] = false; } },
    /** 진단이 제 뒤를 치울 때 */
    reset: function () { cache = {}; pending = {}; made = 0; gaveUp = 0; }
  };
})(window);
