/**
 * 초상 — 도감 카드의 그림을 **실제 모델로 굽는다**
 * ---------------------------------------------------------------
 * 다섯 판 공통 방침("스크립트로 그리는 것은 다 에셋으로", 2026-08-28) 을
 * saga-go 에 이어 이 판에도 옮긴다. 여태 인물·몬스터 초상은 `sprite.js` 가
 * 캔버스에 도형으로 그렸다.
 *
 * 이 판의 `asset3d.buildHero(seed, heightPx, tintHex, cb)` 는 **콜백 방식**
 * 이다 — GLB 가 오면 한 번 `cb(model|null)` 을 부르고 끝이라 폴링이
 * 필요 없다. `heightPx` 에 1 을 줘 **키 1 로 눕힌 모델**을 받는다(지도 위
 * 배우는 픽셀 키를 쓰지만, 초상은 saga-go·사가나락·사가마을과 같은 카메라
 * 계산을 쓰려고 여기서만 단위를 맞춘다).
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

  /** 3D 모델이 있는 펫만 여기 올린다 — 나머지는 2D 도감 그림 그대로
   *  (사슴·구미호만 실제 GLB(Deer.glb·Fox.glb)와 정확히 맞는다는 2026-09-11
   *  결정을 그대로 잇는다. **2026-09-14** — 같은 집안(사슴·여우·소)의 펫을
   *  더 찾아 넓혔다: 큰사슴(pt_stag)은 사슴과 같은 몸(뿔 크기 차이는
   *  그림으로만 남는다), 여우(pt_fox)는 구미호보다 오히려 더 정확한
   *  실제 여우 매칭, 들소·젖소·황소(pt_cow·pt_cow_farm·pt_bull)는 셋 다
   *  소과라 Cow.glb 하나로 같이 묶었다(PLAN §4 "하나의 에셋을 여러 자리에
   *  재사용"과 같은 결). 새 GLB는 하나도 안 늘렸다 — 이미 있는 넷
   *  (Deer·Fox·Cow·Wolf 중 Wolf는 짝이 되는 펫이 없어 그대로 둔다)만 더
   *  넓게 물렸다.
   *  **2026-09-14, 이어서 — 개과 셋(진돗개·삽살개·발바리)도 훑었다.**
   *  saga-dungeon 이 이미 poly.pizza 에서 받아 정한 짝(ShibaInu=진돗개,
   *  Husky="북슬북슬한 털이 가장 가까웠다"=삽살개)을 그대로 복사해 물렸다.
   *  발바리(pt_pug)는 뺐다 — 작은 애완견 체형이라 이 저장소 어디에도 맞는
   *  CC0 모델이 없다(다섯 판 통틀어 있는 개는 셰퍼드형 셋(늑대·시바·허스키)
   *  뿐, 소형견 없음) — 억지로 셋 중 하나를 물리면 오히려 "발바리인데
   *  중형견 몸"으로 더 어긋나 보이므로, 2D 그림 그대로 둔다. */
  /* 2026-09-23 — 실제 동물 펫 전부로 넓힘(asset3d `critter:*`, 사가나락 모델 복사). 신수·창작 짐승(옛 오마주)는 여전히 없다 */
  var PET_MAP = {
    pt_alpaca: 'critter:alpaca', pt_anglerfish: 'critter:anglerfish', pt_apatosaurus: 'critter:apatosaurus',
    pt_armored_catfish: 'critter:armored_catfish', pt_bear: 'critter:bear', pt_betta: 'critter:betta',
    pt_black_lion_fish: 'critter:black_lion_fish', pt_blobfish: 'critter:blobfish',
    pt_blue_goldfish: 'critter:blue_goldfish', pt_blue_tang: 'critter:blue_tang', pt_boar: 'critter:boar',
    pt_bull: 'critter:bull', pt_butterfly_fish: 'critter:butterfly_fish', pt_cardinal_fish: 'critter:cardinal_fish',
    pt_carp: 'critter:carp', pt_cat: 'critter:cat', pt_clownfish: 'critter:clownfish',
    pt_coral_grouper: 'critter:coral_grouper', pt_cow: 'critter:cow', pt_cow_farm: 'critter:cow_farm',
    pt_cowfish: 'critter:cowfish', pt_crane: 'critter:crane', pt_deer: 'critter:deer',
    pt_dolphin: 'critter:dolphin', pt_donkey: 'critter:donkey', pt_fish_1: 'critter:fish_1',
    pt_fish_2: 'critter:fish_2', pt_fish_3: 'critter:fish_3', pt_flatfish: 'critter:flatfish',
    pt_flower_horn: 'critter:flower_horn', pt_fox: 'critter:fox', pt_goblin_shark: 'critter:goblin_shark',
    pt_goldfish: 'critter:goldfish', pt_gumiho: 'critter:fox', pt_horse: 'critter:horse',
    pt_horse_farm: 'critter:horse_farm', pt_humphead: 'critter:humphead', pt_jindo: 'critter:shiba',
    pt_koi_2: 'critter:koi_2', pt_lionfish: 'critter:lionfish', pt_llama: 'critter:llama',
    pt_magpie: 'critter:magpie', pt_mandarin_fish: 'critter:mandarin_fish', pt_manta_ray: 'critter:manta_ray',
    pt_monkey: 'critter:monkey', pt_moorish_idol: 'critter:moorish_idol', pt_owl: 'critter:owl',
    pt_panda: 'critter:panda', pt_parasaurolophus: 'critter:parasaurolophus', pt_parrot_fish: 'critter:parrot_fish',
    pt_pig: 'critter:pig', pt_piranha: 'critter:piranha', pt_puffer: 'critter:puffer', pt_pug: 'critter:pug',
    pt_red_snapper: 'critter:red_snapper', pt_royal_gramma: 'critter:royal_gramma', pt_sapsal: 'critter:husky',
    pt_shark: 'critter:shark', pt_shark_2: 'critter:shark_2', pt_sheep: 'critter:sheep', pt_stag: 'critter:stag',
    pt_stegosaurus: 'critter:stegosaurus', pt_sunfish: 'critter:sunfish', pt_swordfish: 'critter:swordfish',
    pt_t_rex: 'critter:t_rex', pt_tang: 'critter:tang', pt_tetra: 'critter:tetra', pt_tiger: 'critter:tiger',
    pt_toad: 'critter:toad', pt_triceratops: 'critter:triceratops', pt_tuna: 'critter:tuna',
    pt_turbot: 'critter:turbot', pt_velociraptor: 'critter:velociraptor', pt_whale: 'critter:whale',
    pt_white_horse: 'critter:white_horse', pt_worm: 'critter:worm', pt_yellow_tang: 'critter:yellow_tang',
    pt_zebra: 'critter:zebra', pt_zebra_clown_fish: 'critter:zebra_clown_fish',
    /* 신수·오마주 대역(asset3d 참고) */
    pt_samjogo: 'critter:samjogo', pt_haetae: 'critter:haetae', pt_cheongryong: 'critter:cheongryong',
    pt_baekho: 'critter:baekho', pt_jujak: 'critter:jujak', pt_hyeonmu: 'critter:hyeonmu',
    pt_dokkaebi: 'critter:dokkaebi', pt_bulgasari: 'critter:bulgasari', pt_jeoktoma: 'critter:jeoktoma',
    pt_jeolyeong: 'critter:jeolyeong', pk_bulbasaur: 'critter:pk_bulbasaur', pk_charmander: 'critter:pk_charmander',
    pk_squirtle: 'critter:pk_squirtle', pk_magikarp: 'critter:pk_magikarp', pk_pikachu: 'critter:pk_pikachu',
    pk_eevee: 'critter:pk_eevee', pk_slowbro: 'critter:pk_slowbro', pk_gengar: 'critter:pk_gengar',
    pk_snorlax: 'critter:pk_snorlax', pk_lapras: 'critter:pk_lapras', pk_alakazam: 'critter:pk_alakazam',
    pk_dragonite: 'critter:pk_dragonite', pk_charizard: 'critter:pk_charizard', pk_gyarados: 'critter:pk_gyarados',
    pk_mewtwo: 'critter:pk_mewtwo', pk_mew: 'critter:pk_mew'
  };
  function petKeyOf(id) { return PET_MAP[id] || null; }

  /** 이 kind·ref 조합을 3D 로 구울 수 있나 — hero 는 다 되고, pet 은 PET_MAP 에
   *  있는 것만 된다 (ui.js `p3tag` 가 이 문을 그대로 쓴다) */
  function supports(kind, ref) {
    if (!ref) { return false; }
    if (kind === 'hero') { return true; }
    if (kind === 'pet') { return !!petKeyOf(ref.id); }
    return false;
  }

  /** 카메라를 어디에 두나 — **키 1 로 눕힌 모델** 기준의 순수 계산이다 */
  /** 2026-09-23 "고품질 셀 셰이딩급" — 사람 초상은 **흉상**(가슴 위). 예전 구도(머리~허벅지)는 카드에서 얼굴이 작았다.
   *  손잡이 `portrait3d.bust`(0 이면 예전 구도). 키 1 모델에서 0.65~1.07 쯤이 카드 세로에 들어온다 */
  function BUST() {
    var c = global.DG && global.DG.core;
    return c && c.tuned ? (c.tuned('portrait3d.bust', 1) ? true : false) : true;
  }
  /* 펫(네발짐승)은 몸통이 옆으로 길어 더 물러나 낮은 곳을 옆모습에 가깝게 본다 — 사가만리·사가나락·사가마을 camPlan 과 같은 값(폭만 조금 넓게).
     2026-09-23 전엔 이 판만 펫 구도가 없어 사람 구도로 구워 소 초상 여섯 장이 몸통 한가운데만 크게 찍혀 있었다(스크린샷) */
  function camPlan(w, h, kind) {
    var isPet = kind === 'pet';
    var aspect = w / Math.max(1, h);
    var span = isPet ? 1.7 : (BUST() ? 0.37 : 0.62);   // 펫 1.7 — 1.5 면 이 판 여우 머리가 잘렸다
    var fov = 26;
    var dist = (span / 2) / Math.tan(fov * Math.PI / 360);
    if (aspect < 1) { dist = dist / Math.max(0.55, aspect); }
    var look = isPet ? 0.28 : (BUST() ? 0.86 : 0.78);
    return { fov: fov, dist: dist, look: look, aspect: aspect, yaw: isPet ? 0.95 : 0.42, pitch: 0.06 };
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
      /* delam() 이 PBR 을 Lambert 로 물들여 환경맵 반사가 안 먹는다 — 대신
         **얼굴이 어느 쪽을 보든 카메라 쪽에서 늘 빛을 받게** key·fill·bounce
         를 카메라와 같은 +Z 쪽에 둔다(고전 인물사진 조명). 예전엔 fill 이
         반대쪽(-Z, 인물 뒤)에 있어 사실상 역광이었다 — saga-realm 에서 먼저
         잡은 원인을 그대로 옮긴다(2026-09-03) */
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

  /** 쉬는 자세로 한 번 굴린다 — `mixer.update()` 를 안 부르면 T 자로 굳는다 */
  function settle(node) {
    if (!node || !node.userData || !node.userData.mixer || !node.userData.actions) { return; }
    var clipMap = node.userData.clipMap || {};
    var name = clipMap.idle || clipMap.walk || Object.keys(node.userData.actions)[0];
    var act = name && node.userData.actions[name];
    if (!act) { return; }
    try {
      act.reset().play();
      node.userData.mixer.update(0.45);
    } catch (e) { /* 자세를 못 잡아도 그림은 나온다 */ }
  }

  function bake(kind, ref, w, h, node) {
    if (!boot() || !node) { return null; }

    var plan = camPlan(w, h, kind);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var pw = Math.max(16, Math.round(w * dpr)), ph = Math.max(16, Math.round(h * dpr));

    while (rig.children.length) { rig.remove(rig.children[0]); }
    rig.add(node);
    node.position.set(0, 0, 0);
    node.scale.setScalar(1);
    node.rotation.set(0, kind === 'pet' ? petYaw(node, ref, plan.yaw) : plan.yaw, 0);

    settle(node);
    if (kind === 'pet') { plan = petFrame(plan, node); }

    camera.fov = plan.fov;
    camera.aspect = plan.aspect;
    camera.far = Math.max(40, plan.dist * 3);   // 긴 몸(공룡·고래)은 petFrame 이 멀리 물러나 고정 far 를 넘어 빈 카드가 된다(사가나락에서 겪음)
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

  function of(kind, ref, w, h) {
    var d = diskOf(kind, ref, w, h);
    if (d) { return d; }
    if (!ready()) { return null; }
    return cache[keyOf(kind, ref, w, h)] || null;
  }

  /**
   * 굽는 줄 — **한 번에 하나씩만** 굽는다. 여러 인물을 한꺼번에 부르면
   * (도감·부대 목록) WebGL 렌더 여러 개가 겹쳐 **지도 3D 화면과 GPU 를
   * 다툰다** — 2026-09-02, 필드를 걷거나 전투할 때 끊긴다는 신고를 받고
   * 줄을 세웠다. 실패도 `cache[key] = false` 로 **한 번만** 적어 두고
   * 다시 시도하지 않는다 — 안 그러면 실패하는 인물 하나가 화면이 떠 있는
   * 내내 계속 다시 구우려 든다(같은 신고의 진짜 원인이었다).
   */
  var queue = [];
  var busy = false;

  function has(key) { return Object.prototype.hasOwnProperty.call(cache, key); }

  function pump() {
    if (busy || !queue.length) { return; }
    var job = queue.shift();
    busy = true;
    var A3 = global.DG.asset3d;
    if (!A3) { delete pending[job.key]; cache[job.key] = false; busy = false; pump(); return; }

    function onModel(model) {
      delete pending[job.key];
      busy = false;
      if (!model) { cache[job.key] = false; gaveUp++; pump(); return; }
      var url = null;
      try { url = bake(job.kind, job.ref, job.w, job.h, model); } catch (e) { url = null; }
      if (url) { cache[job.key] = url; sweep(); } else { cache[job.key] = false; gaveUp++; }
      pump();
    }

    try {
      if (job.kind === 'hero') {
        if (!A3.buildHero) { throw new Error('buildHero 없음'); }
        var fac = global.DG.data.faction(job.ref.faction);
        A3.buildHero(job.ref.id, 1, hexOf(fac.color, null), onModel);
      } else {
        var pkey = petKeyOf(job.ref.id);
        if (!A3.build || !pkey) { throw new Error('pet 3D 짝 없음'); }
        /* 짐승은 안 물들인다(제 털빛이 맞다) — build() 는 tint 인자가 없다 */
        A3.build(pkey, job.ref.id, 1, onModel);
      }
    } catch (e) { delete pending[job.key]; cache[job.key] = false; gaveUp++; busy = false; pump(); }
  }

  /** 줄에 올린다 — `asset3d.buildHero`/`build` 콜백이 한 번 오면 그 자리에서 곧바로 굽는다 */
  function warm(kind, ref, w, h) {
    if (diskOf(kind, ref, w, h)) { return false; }      // 구워 둔 파일이 있으면 다시 안 굽는다
    if (!ready() || !ref || !supports(kind, ref)) { return false; }
    var key = keyOf(kind, ref, w, h);
    if (has(key) || pending[key]) { return false; }
    var A3 = global.DG.asset3d;
    if (!A3 || (kind === 'hero' ? !A3.buildHero : !A3.build)) { return false; }
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
    supports: supports,
    /* 자리표시(Phase 0) */
    holder: holder, willSwap: willSwap, _fail: function (k, undo) { if (undo) { delete cache[k]; } else { cache[k] = false; } }
  };
})(window);
