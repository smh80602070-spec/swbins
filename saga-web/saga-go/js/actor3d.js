/**
 * 3D 배우 — 사람·짐승·건물을 **도형으로 세운다**
 * ---------------------------------------------------------------
 * 3D 1단계에서는 `sprite.js` 가 그린 2D 그림을 빌보드로 세웠다. 멀리서는 그럴듯하지만
 * 카메라가 낮게 깔리는 원작의 각도에서는 종잇장이 서 있는 게 곧바로 드러난다 —
 * 옆으로 돌아도 늘 정면이고, 발밑에 깊이가 없다. 그래서 이 파일이 **부품을 조립해**
 * 진짜 입체를 만든다.
 *
 * 원작 에셋은 복제하지 않는다. `sprite.js` 가 쓰는 **같은 외형 정보**(`lookOf` 의
 * 갓·도포·망토·무기, `beastFormOf` 의 형태, `beastColorOf` 의 색)를 읽어 도형으로
 * 옮긴다 — 그래서 지도 위의 인물과 도감 초상이 같은 사람으로 보인다.
 *
 *   plan(kind, ref)   무엇이 붙는지 **이름만** 돌려준다 — three 없이도 돈다(자가진단이 이걸 본다)
 *   spec(kind, ref)   색·형태·비례
 *   build(kind, ref)  THREE.Group. **키 1** 로 만들어 두고 쓰는 쪽에서 배율을 준다
 *   step(node, o)     걷기·숨쉬기. 뼈대(`rig`)의 회전만 건드린다
 *
 * **판정에는 닿지 않는다.** 여기서 만든 값은 화면에만 쓴다. three 가 없으면
 * `build` 는 null 을 주고 `world3d` 가 빌보드로 되돌아간다(손잡이 `world3d.mesh`).
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  function ready() { return !!three(); }

  function sprite() { return global.DG.sprite; }
  function shade(c, a) { return sprite().shade(c, a); }

  /* ── 부품 창고 ────────────────────────────────────────────
   * 같은 도형·같은 색은 한 번만 만든다. 배우가 스물이면 부품은 수백 개가 되는데
   * 그때마다 새로 만들면 GPU 로 같은 것을 몇 번씩 올리게 된다.
   */
  var geoCache = {}, matCache = {};

  function geo(key, make) {
    if (!geoCache[key]) { geoCache[key] = make(); }
    return geoCache[key];
  }
  /** SAGA-DESIGN §6.1 — 툰 재질 손잡이. 꺼지면 예전 Lambert 로 되돌아간다 */
  function TOON_ON() {
    var TN = global.DG.toon3d;
    return !!(TN && TN.TOON_ON());
  }
  function mat(color, kind) {
    var toon = TOON_ON();
    var key = color + '|' + (kind || '') + '|' + (toon ? 't' : 'l');
    if (matCache[key]) { return matCache[key]; }
    var TN = global.DG.toon3d;
    var m = toon
      ? new T.MeshToonMaterial({ color: new T.Color(color), gradientMap: TN.ramp() })
      : new T.MeshLambertMaterial({ color: new T.Color(color) });
    if (kind === 'glow') {
      m.emissive = new T.Color(color);
      m.emissiveIntensity = 0.5;
    } else if (kind === 'flat') {
      m.flatShading = true;
    }
    matCache[key] = m;
    return m;
  }
  function part(g, m, x, y, z) {
    var mesh = new T.Mesh(g, m);
    mesh.position.set(x || 0, y || 0, z || 0);
    return mesh;
  }
  /** 그림자를 지는 것은 큰 덩이만 — 부품마다 켜면 그림자 맵이 감당하지 못한다.
   *  같은 덩이만 뒤집힌 헐 외곽선도 받는다(`applyOutlines`, 부모에 매달린 뒤 한 번에) */
  function solid(mesh) {
    mesh.castShadow = true;
    mesh.userData = mesh.userData || {};
    mesh.userData.wantOutline = true;
    return mesh;
  }

  var BOX = function (w, h, d) { return geo('b' + w + '/' + h + '/' + d, function () { return new T.BoxGeometry(w, h, d); }); };
  var CYL = function (rt, rb, h, s) { return geo('c' + rt + '/' + rb + '/' + h + '/' + s, function () { return new T.CylinderGeometry(rt, rb, h, s || 10); }); };
  var SPH = function (r, s) { return geo('s' + r + '/' + s, function () { return new T.SphereGeometry(r, s || 12, (s || 12) - 4); }); };
  var CONE = function (r, h, s) { return geo('k' + r + '/' + h + '/' + s, function () { return new T.ConeGeometry(r, h, s || 10); }); };
  var TOR = function (r, t, s) { return geo('t' + r + '/' + t + '/' + s, function () { return new T.TorusGeometry(r, t, 6, s || 14); }); };

  /* ── 사람 ─────────────────────────────────────────────────
   * 비례는 고정(4등신, 여기선 3.5등신에 가깝다) — 지도 위에서 머리가
   * 점이 되지 않도록 원래부터 키워 둔 값이다. `P` 는 `helmNode`·`weaponNode` 가
   * 같은 값을 봐야 해서 지역 변수로 두지 않고 모듈 전역에 둔다.
   */
  var P = { leg: 0.38, hip: 0.38, torso: 0.30, sho: 0.68, neck: 0.72, headR: 0.145, headY: 0.865, arm: 0.27, limb: 0.048 };

  function heroSpec(hero) {
    var look = sprite().lookOf(hero);
    var fac = global.DG.data.faction(hero && hero.faction);
    var armor = look.armor || 'leather';
    /* 세력 색은 그대로 두되(성채를 "저 세력이 지킨다"로 알아보는 실마리라
       완전히 흩어 버리면 안 된다) 인물마다 명도만 살짝 흔든다 — 같은 세력
       수십 명이 완전히 같은 색으로 겹쳐 보이던 것을 덜어낸다(2026-09-06,
       "색깔별로라도 넣어주고"). ±9% 안에서 인물 id로 고정된다 */
    var seed = hero ? sprite().idSeed(hero.id) : 0;
    var tone = ((seed % 19) - 9) / 100;
    return {
      helm: look.helm || 'none',
      armor: armor,
      weapon: look.weapon || 'none',
      cape: !!look.cape,
      skirt: !!look.skirt,
      beard: !!look.beard,
      glasses: !!look.glasses,
      color: sprite().shade(fac.color, tone),
      rarity: (hero && hero.rarity) || 3,
      skin: '#e8c9a4',
      /* 갑주는 어깨가 넓고 치마·도포는 아래가 퍼진다 */
      build: armor === 'plate' ? 'broad' : (armor === 'dress' ? 'slim' : 'plain')
    };
  }

  function heroPlan(hero) {
    var s = heroSpec(hero);
    var p = ['legs', 'torso', 'arms', 'head', 'face'];
    if (s.armor === 'robe' || s.armor === 'dress') { p.push('robe'); }
    if (s.armor === 'plate') { p.push('pauldron'); }
    if (s.armor === 'coat') { p.push('coat'); }
    if (s.cape) { p.push('cape'); }
    if (s.beard) { p.push('beard'); }
    if (s.helm !== 'none') { p.push('helm:' + s.helm); }
    if (s.weapon !== 'none') { p.push('weapon:' + s.weapon); }
    if (s.rarity >= 5) { p.push('aura'); }
    return p;
  }

  /** 손에 드는 것 — 오른팔에 매단다(팔이 흔들리면 같이 흔들린다) */
  function weaponNode(kind, col) {
    var g = new T.Group();
    var wood = mat('#8a6a44'), steel = mat('#c8ccd6'), dark = mat('#3a3f4a');
    if (kind === 'spear' || kind === 'halberd' || kind === 'guandao') {
      g.add(part(CYL(0.012, 0.014, 0.86, 6), wood, 0, 0.16, 0));
      if (kind === 'spear') {
        g.add(part(CONE(0.032, 0.13, 6), steel, 0, 0.65, 0));
      } else if (kind === 'guandao') {
        var blade = part(BOX(0.015, 0.20, 0.10), steel, 0, 0.62, 0.05);
        blade.rotation.x = -0.22;
        g.add(blade);
      } else {
        g.add(part(CONE(0.028, 0.11, 6), steel, 0, 0.64, 0));
        g.add(part(BOX(0.012, 0.10, 0.07), steel, 0, 0.56, 0.05));
      }
    } else if (kind === 'sword') {
      g.add(part(BOX(0.022, 0.34, 0.05), steel, 0, 0.02, 0));
      g.add(part(BOX(0.06, 0.02, 0.03), mat('#6b5533'), 0, -0.16, 0));
      g.add(part(CYL(0.014, 0.014, 0.08, 6), wood, 0, -0.21, 0));
    } else if (kind === 'axe') {
      g.add(part(CYL(0.013, 0.013, 0.44, 6), wood, 0, 0, 0));
      g.add(part(BOX(0.02, 0.13, 0.10), steel, 0, 0.18, 0.05));
    } else if (kind === 'club') {
      g.add(part(CYL(0.020, 0.034, 0.40, 7), mat('#6b5030'), 0, 0.02, 0));
      g.add(part(SPH(0.05, 8), mat('#5a4326'), 0, 0.22, 0));
    } else if (kind === 'bow') {
      var bow = part(TOR(0.16, 0.012, 12), wood, 0, 0.06, 0);
      bow.rotation.y = Math.PI / 2;
      g.add(bow);
    } else if (kind === 'fan') {
      var fan = part(CONE(0.13, 0.16, 3), mat('#f0ead8'), 0, 0.10, 0);
      fan.rotation.z = Math.PI;
      fan.rotation.y = 0.4;
      g.add(fan);
    } else if (kind === 'scroll') {
      var sc = part(CYL(0.028, 0.028, 0.17, 8), mat('#efe4c8'), 0, 0.02, 0);
      sc.rotation.z = Math.PI / 2;
      g.add(sc);
    } else if (kind === 'staff') {
      g.add(part(CYL(0.013, 0.015, 0.70, 6), wood, 0, 0.10, 0));
      g.add(part(SPH(0.038, 8), mat('#7fd8c8', 'glow'), 0, 0.47, 0));
    } else if (kind === 'brush') {
      g.add(part(CYL(0.010, 0.010, 0.20, 6), mat('#3a2f26'), 0, 0.02, 0));
      g.add(part(CONE(0.018, 0.06, 6), dark, 0, -0.11, 0));
    } else {
      g.add(part(SPH(0.03, 8), mat(col), 0, 0, 0));
    }
    return g;
  }

  function helmNode(kind, col) {
    var g = new T.Group();
    var R = P.headR;
    var dark = mat(shade(col, -0.45)), gold = mat('#e8c15a'), ink = mat('#241f1a');
    if (kind === 'gat') {
      /* 갓 — 넓은 챙 + 낮은 통. 이 판에서 가장 자주 나오는 머리다 */
      g.add(part(CYL(R * 2.5, R * 2.6, 0.012, 16), ink, 0, R * 0.62, 0));
      g.add(part(CYL(R * 0.86, R * 0.95, R * 0.85, 12), ink, 0, R * 1.05, 0));
    } else if (kind === 'helmet' || kind === 'gapju') {
      g.add(part(SPH(R * 1.06, 12), dark, 0, R * 0.16, 0));
      g.add(part(CYL(R * 1.5, R * 1.6, 0.02, 14), dark, 0, R * 0.42, 0));
      if (kind === 'gapju') {                    // 갑주 투구 — 정수리에 삼지창 장식
        g.add(part(CONE(R * 0.22, R * 1.1, 6), gold, 0, R * 1.6, 0));
      } else {
        g.add(part(CONE(R * 0.26, R * 0.7, 5), gold, 0, R * 1.45, 0));
      }
    } else if (kind === 'crown') {
      g.add(part(CYL(R * 1.02, R * 1.05, R * 0.7, 12), gold, 0, R * 0.85, 0));
      var i;
      for (i = 0; i < 5; i++) {
        var a = i / 5 * Math.PI * 2;
        g.add(part(CONE(R * 0.14, R * 0.5, 4), gold,
          Math.cos(a) * R * 0.95, R * 1.4, Math.sin(a) * R * 0.95));
      }
    } else if (kind === 'scholar') {
      g.add(part(BOX(R * 1.9, R * 0.9, R * 1.9), ink, 0, R * 0.9, 0));
      g.add(part(BOX(R * 2.3, R * 0.08, R * 2.3), ink, 0, R * 1.36, 0));
    } else if (kind === 'plume') {
      g.add(part(CYL(R * 0.92, R * 1.0, R * 1.0, 12), mat(shade(col, -0.30)), 0, R * 0.95, 0));
      g.add(part(CYL(R * 1.45, R * 1.5, 0.014, 14), mat(shade(col, -0.30)), 0, R * 0.5, 0));
      var pl = part(CONE(R * 0.2, R * 1.2, 5), mat('#d9534f'), 0, R * 1.9, -R * 0.2);
      pl.rotation.x = -0.35;
      g.add(pl);
    } else if (kind === 'hairpin' || kind === 'braid') {
      g.add(part(SPH(R * 0.62, 10), ink, 0, R * 0.5, -R * 0.85));
      var pin = part(CYL(0.008, 0.008, R * 1.9, 5), gold, 0, R * 0.55, -R * 0.85);
      pin.rotation.z = Math.PI / 2;
      g.add(pin);
    } else if (kind === 'monk') {
      g.add(part(SPH(R * 1.005, 12), mat(shade('#e8c9a4', -0.05)), 0, R * 0.06, 0));
    }
    return g;
  }

  function buildHero(hero) {
    if (!three()) { return null; }
    var s = heroSpec(hero);
    var plan = heroPlan(hero);
    var g = new T.Group();
    var col = s.color;
    var cloth = mat(col), deep = mat(shade(col, -0.34)), lite = mat(shade(col, 0.20));
    var skin = mat(s.skin), hair = mat('#241f1a');
    var broad = s.build === 'broad' ? 1.16 : (s.build === 'slim' ? 0.9 : 1);
    var rig = {};

    /* 다리 — 무릎을 접지 않는다. 지도 위 크기에서는 관절이 보이지 않고,
       접으면 부품이 두 배가 되어 배우 스물이면 그대로 두 배가 된다. */
    function leg(sx) {
      var pivot = new T.Group();
      pivot.position.set(sx * 0.055, P.hip, 0);
      pivot.add(part(CYL(P.limb, P.limb * 0.86, P.leg, 7), deep, 0, -P.leg / 2, 0));
      pivot.add(part(BOX(0.075, 0.03, 0.11), mat('#3a3129'), 0, -P.leg + 0.015, 0.02));
      g.add(pivot);
      return pivot;
    }
    rig.legL = leg(-1); rig.legR = leg(1);

    /* 몸통 — 위로 갈수록 넓다(어깨). 이 하나만 그림자를 진다 */
    var body = new T.Group();
    body.position.y = P.hip;
    body.add(solid(part(CYL(0.115 * broad, 0.10, P.torso, 10), cloth, 0, P.torso / 2, 0)));
    g.add(body);
    rig.body = body;
    rig.baseY = body.position.y;

    function arm(sx) {
      var pivot = new T.Group();
      pivot.position.set(sx * 0.125 * broad, P.sho - P.hip, 0);
      pivot.add(part(CYL(P.limb * 0.86, P.limb * 0.74, P.arm, 7), cloth, 0, -P.arm / 2, 0));
      pivot.add(part(SPH(P.limb * 0.9, 8), skin, 0, -P.arm - 0.01, 0));
      body.add(pivot);
      return pivot;
    }
    rig.armL = arm(-1); rig.armR = arm(1);

    /* 머리 — 목 위에 얹고, 머리는 따로 돈다(둘러본다) */
    var head = new T.Group();
    head.position.y = P.headY;
    head.add(solid(part(SPH(P.headR, 14), skin, 0, 0, 0)));
    head.add(part(SPH(P.headR * 0.98, 12), hair, 0, P.headR * 0.30, -P.headR * 0.12));
    /* 얼굴 — 눈 둘만 찍는다. 이 크기에서 입·코는 한 픽셀도 안 된다 */
    head.add(part(SPH(0.018, 6), mat('#2a2622'), -0.052, 0.012, P.headR * 0.93));
    head.add(part(SPH(0.018, 6), mat('#2a2622'), 0.052, 0.012, P.headR * 0.93));
    g.add(head);
    rig.head = head;
    g.add(part(CYL(0.042, 0.05, 0.07, 7), skin, 0, P.neck, 0));

    var i;
    for (i = 0; i < plan.length; i++) {
      var p = plan[i];
      if (p === 'robe') {
        /* 도포·치마 — 아래로 퍼지는 원뿔대가 다리를 덮는다 */
        var robe = part(CYL(0.13 * broad, 0.26, 0.52, 12), lite, 0, 0.26, 0);
        solid(robe);
        g.add(robe);
      } else if (p === 'pauldron') {
        g.add(part(SPH(0.072, 10), mat('#9aa3b0'), -0.135, P.sho, 0));
        g.add(part(SPH(0.072, 10), mat('#9aa3b0'), 0.135, P.sho, 0));
        g.add(part(BOX(0.20, 0.16, 0.11), mat(shade(col, -0.10)), 0, P.sho - 0.11, 0));
      } else if (p === 'coat') {
        var coat = part(BOX(0.24 * broad, 0.44, 0.16), deep, 0, 0.34, 0);
        solid(coat);
        g.add(coat);
      } else if (p === 'cape') {
        /* 망토 — 뒤쪽 반원만. 통짜 원뿔대를 쓰면 앞가슴까지 덮는다 */
        var cape = new T.Mesh(
          geo('cape', function () { return new T.CylinderGeometry(0.14, 0.30, 0.56, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9); }),
          new T.MeshLambertMaterial({ color: new T.Color(shade(col, -0.20)), side: T.DoubleSide })
        );
        cape.position.set(0, 0.42, 0);
        cape.castShadow = true;
        g.add(cape);
        rig.cape = cape;
      } else if (p === 'beard') {
        var bd = part(CONE(P.headR * 0.6, P.headR * 1.5, 7), mat('#e8e4dc'), 0, -P.headR * 1.1, P.headR * 0.45);
        bd.rotation.x = Math.PI;
        head.add(bd);
      } else if (p.indexOf('helm:') === 0) {
        head.add(helmNode(p.slice(5), col));
      } else if (p.indexOf('weapon:') === 0) {
        var w = weaponNode(p.slice(7), col);
        w.position.set(0, -P.arm, 0.02);
        w.rotation.x = -0.12;
        rig.armR.add(w);
      } else if (p === 'aura') {
        /* ★5 — 발밑에 도는 금테. 원작의 희귀 표시와 같은 자리다 */
        var ring = part(TOR(0.20, 0.012, 18), mat('#f0a53a', 'glow'), 0, 0.012, 0);
        ring.rotation.x = -Math.PI / 2;
        g.add(ring);
        rig.ring = ring;
      }
    }

    g.userData = { rig: rig, plan: plan, spec: s, kind: 'hero' };
    return g;
  }

  /* ── 짐승 ─────────────────────────────────────────────────
   * 형태 여덟(quad·bird·dragon·turtle·ogre·horse·toad·fish)은 `sprite.js` 의 것을
   * 그대로 쓴다. 무늬(stripe·mane·ninetail…)도 이름을 같이 쓴다 — 도감에서 줄무늬였던
   * 짐승이 지도에서 민무늬면 다른 짐승으로 보인다.
   */
  function petSpec(pet) {
    var S = sprite();
    return {
      form: S.beastFormOf(pet),
      color: S.beastColorOf(pet),
      pattern: S.beastPatternOf(pet),
      divine: !!(pet && pet.kind === 'divine'),
      rarity: (pet && pet.rarity) || 1
    };
  }

  function petPlan(pet) {
    var s = petSpec(pet);
    var p = ['body', 'head'];
    if (s.form === 'bird') { p.push('wings', 'legs2', 'beak', 'tailfan'); }
    else if (s.form === 'fish') { p.push('fins', 'tailfin'); }
    else if (s.form === 'dragon') { p.push('coils', 'horns', 'legs4', 'whisker'); }
    else if (s.form === 'turtle') { p.push('shell', 'legs4', 'tail'); }
    else if (s.form === 'ogre') { p.push('arms', 'legs2', 'horns'); }
    else if (s.form === 'toad') { p.push('legs4', 'eyes'); }
    else if (s.form === 'horse') { p.push('legs4', 'neck', 'mane', 'tail'); }
    else { p.push('legs4', 'ears', 'tail'); }
    if (s.pattern) { p.push('mark:' + s.pattern); }
    if (s.divine) { p.push('halo'); }
    return p;
  }

  function buildPet(pet) {
    if (!three()) { return null; }
    var s = petSpec(pet), plan = petPlan(pet);
    var col = s.color;
    var skinM = mat(col), darkM = mat(shade(col, -0.30)), liteM = mat(shade(col, 0.24));
    var eyeM = mat('#241f1a');
    var g = new T.Group();
    var rig = {};
    var F = s.form;
    var i;

    /* 몸통·머리 — 형태마다 자리와 크기가 다르다 */
    var bodyY = 0.46, headY = 0.66, headZ = 0.30, headR = 0.20, bodyMesh;
    if (F === 'bird') {
      bodyY = 0.50; headY = 0.78; headZ = 0.12; headR = 0.16;
      bodyMesh = part(SPH(0.24, 12), skinM, 0, bodyY, 0);
      bodyMesh.scale.set(1, 1.05, 1.25);
    } else if (F === 'fish') {
      bodyY = 0.40; headY = 0.42; headZ = 0.30; headR = 0.17;
      bodyMesh = part(SPH(0.24, 12), skinM, 0, bodyY, 0);
      bodyMesh.scale.set(0.6, 1, 1.7);
    } else if (F === 'dragon') {
      bodyY = 0.52; headY = 0.72; headZ = 0.46; headR = 0.17;
      bodyMesh = part(SPH(0.20, 12), skinM, 0, bodyY, 0);
      bodyMesh.scale.set(1, 1, 1.5);
    } else if (F === 'turtle') {
      bodyY = 0.30; headY = 0.34; headZ = 0.36; headR = 0.14;
      bodyMesh = part(SPH(0.28, 12), darkM, 0, bodyY, 0);
      bodyMesh.scale.set(1, 0.62, 1.15);
    } else if (F === 'ogre') {
      bodyY = 0.52; headY = 0.84; headZ = 0; headR = 0.19;
      bodyMesh = part(CYL(0.18, 0.22, 0.42, 10), skinM, 0, bodyY, 0);
    } else if (F === 'toad') {
      bodyY = 0.26; headY = 0.34; headZ = 0.22; headR = 0.16;
      bodyMesh = part(SPH(0.28, 12), skinM, 0, bodyY, 0);
      bodyMesh.scale.set(1.15, 0.78, 1);
    } else if (F === 'horse') {
      bodyY = 0.58; headY = 0.86; headZ = 0.34; headR = 0.14;
      bodyMesh = part(SPH(0.24, 12), skinM, 0, bodyY, 0);
      bodyMesh.scale.set(0.92, 1, 1.55);
    } else {                                    // quad
      bodyMesh = part(SPH(0.24, 12), skinM, 0, bodyY, 0);
      bodyMesh.scale.set(0.95, 0.95, 1.4);
    }
    solid(bodyMesh);
    g.add(bodyMesh);
    rig.body = bodyMesh;
    rig.baseY = bodyMesh.position.y;

    var head = new T.Group();
    head.position.set(0, headY, headZ);
    head.add(solid(part(SPH(headR, 12), skinM, 0, 0, 0)));
    head.add(part(SPH(headR * 0.16, 6), eyeM, -headR * 0.48, headR * 0.22, headR * 0.82));
    head.add(part(SPH(headR * 0.16, 6), eyeM, headR * 0.48, headR * 0.22, headR * 0.82));
    g.add(head);
    rig.head = head;

    function legs4(y, len, r) {
      var out = [], sx, sz, n = 0;
      for (sz = -1; sz <= 1; sz += 2) {
        for (sx = -1; sx <= 1; sx += 2) {
          var pv = new T.Group();
          pv.position.set(sx * 0.14, y, sz * 0.16);
          pv.add(part(CYL(r, r * 0.86, len, 6), darkM, 0, -len / 2, 0));
          g.add(pv);
          out[n++] = pv;
        }
      }
      return out;
    }

    for (i = 0; i < plan.length; i++) {
      var p = plan[i];
      if (p === 'legs4') {
        rig.legs = legs4(F === 'horse' ? 0.42 : (F === 'turtle' ? 0.20 : 0.32),
          F === 'horse' ? 0.42 : (F === 'turtle' ? 0.16 : 0.30), 0.042);
      } else if (p === 'legs2') {
        rig.legs = [];
        var sx2;
        for (sx2 = -1; sx2 <= 1; sx2 += 2) {
          var pv2 = new T.Group();
          pv2.position.set(sx2 * 0.09, F === 'ogre' ? 0.32 : 0.30, 0);
          pv2.add(part(CYL(0.035, 0.03, F === 'ogre' ? 0.32 : 0.28, 6), mat('#c9a24a'), 0, -0.15, 0));
          g.add(pv2);
          rig.legs.push(pv2);
        }
      } else if (p === 'arms') {
        rig.arms = [];
        var sx3;
        for (sx3 = -1; sx3 <= 1; sx3 += 2) {
          var av = new T.Group();
          av.position.set(sx3 * 0.19, 0.66, 0);
          av.add(part(CYL(0.045, 0.038, 0.30, 6), skinM, 0, -0.15, 0));
          g.add(av);
          rig.arms.push(av);
        }
      } else if (p === 'wings') {
        rig.wings = [];
        var sx4;
        for (sx4 = -1; sx4 <= 1; sx4 += 2) {
          var wv = new T.Group();
          wv.position.set(sx4 * 0.16, 0.56, 0);
          var wing = part(BOX(0.30, 0.02, 0.22), liteM, sx4 * 0.15, 0, 0);
          wv.add(wing);
          g.add(wv);
          rig.wings.push(wv);
        }
      } else if (p === 'beak') {
        var beak = part(CONE(headR * 0.34, headR * 0.9, 6), mat('#e0b040'), 0, -headR * 0.05, headR * 1.05);
        beak.rotation.x = Math.PI / 2;
        head.add(beak);
      } else if (p === 'tailfan') {
        var tf = part(CONE(0.16, 0.26, 5), liteM, 0, 0.46, -0.28);
        tf.rotation.x = -1.9;
        g.add(tf);
      } else if (p === 'fins') {
        var dors = part(CONE(0.09, 0.20, 4), liteM, 0, 0.58, -0.02);
        g.add(dors);
        g.add(part(BOX(0.20, 0.015, 0.10), liteM, 0, 0.36, 0.06));
      } else if (p === 'tailfin') {
        var tfin = part(CONE(0.15, 0.26, 4), liteM, 0, 0.44, -0.40);
        tfin.rotation.x = -Math.PI / 2;
        tfin.rotation.z = Math.PI / 2;
        g.add(tfin);
        rig.tail = tfin;
      } else if (p === 'coils') {
        /* 용 — 몸을 굽이치게 한다. 구슬 넷이 뒤로 물결친다 */
        rig.coils = [];
        var c;
        for (c = 0; c < 4; c++) {
          var seg = part(SPH(0.17 - c * 0.022, 10), skinM, 0, 0.52, -0.26 - c * 0.24);
          g.add(seg);
          rig.coils.push(seg);
        }
      } else if (p === 'horns') {
        head.add(part(CONE(0.035, 0.16, 5), mat('#e8dcc0'), -headR * 0.5, headR * 0.9, -headR * 0.1));
        head.add(part(CONE(0.035, 0.16, 5), mat('#e8dcc0'), headR * 0.5, headR * 0.9, -headR * 0.1));
      } else if (p === 'whisker') {
        var wk1 = part(CYL(0.006, 0.006, 0.26, 4), mat('#e8e4dc'), -headR * 0.6, 0, headR * 0.5);
        var wk2 = part(CYL(0.006, 0.006, 0.26, 4), mat('#e8e4dc'), headR * 0.6, 0, headR * 0.5);
        wk1.rotation.set(1.1, 0, 0.5); wk2.rotation.set(1.1, 0, -0.5);
        head.add(wk1); head.add(wk2);
      } else if (p === 'shell') {
        var sh = part(SPH(0.30, 12), mat(shade(col, -0.42), 'flat'), 0, 0.34, 0);
        sh.scale.set(1, 0.55, 1.1);
        solid(sh);
        g.add(sh);
      } else if (p === 'tail') {
        var tail = part(CONE(0.06, 0.28, 6), darkM, 0, bodyY + 0.04, -0.34);
        tail.rotation.x = 1.05;
        g.add(tail);
        rig.tail = tail;
      } else if (p === 'ears') {
        head.add(part(CONE(headR * 0.34, headR * 0.7, 5), darkM, -headR * 0.55, headR * 0.85, 0));
        head.add(part(CONE(headR * 0.34, headR * 0.7, 5), darkM, headR * 0.55, headR * 0.85, 0));
      } else if (p === 'eyes') {
        head.add(part(SPH(headR * 0.42, 8), skinM, -headR * 0.6, headR * 0.6, headR * 0.2));
        head.add(part(SPH(headR * 0.42, 8), skinM, headR * 0.6, headR * 0.6, headR * 0.2));
      } else if (p === 'neck') {
        var nk = part(CYL(0.08, 0.10, 0.28, 8), skinM, 0, 0.72, 0.24);
        nk.rotation.x = -0.5;
        g.add(nk);
      } else if (p === 'mane' || p === 'mark:mane') {
        var mn = part(TOR(headR * 1.15, headR * 0.42, 12), mat(shade(col, -0.18)), 0, 0, -headR * 0.1);
        head.add(mn);
      } else if (p === 'mark:stripe') {
        var st;
        for (st = 0; st < 3; st++) {
          var band = part(TOR(0.21, 0.016, 12), darkM, 0, bodyY, -0.14 + st * 0.16);
          band.rotation.y = Math.PI / 2;
          band.rotation.x = Math.PI / 2;
          g.add(band);
        }
      } else if (p === 'mark:spot') {
        var sp;
        for (sp = 0; sp < 4; sp++) {
          var a = sp * 1.7;
          g.add(part(SPH(0.045, 6), darkM,
            Math.cos(a) * 0.19, bodyY + Math.sin(a) * 0.10, Math.sin(a * 1.3) * 0.2));
        }
      } else if (p === 'mark:patch') {
        var pt = part(SPH(0.22, 10), mat('#2f3138'), 0, bodyY, -0.06);
        pt.scale.set(0.86, 0.72, 1.0);
        g.add(pt);
      } else if (p === 'mark:ninetail') {
        rig.tails = [];
        var nt;
        for (nt = 0; nt < 9; nt++) {
          var ang = (nt - 4) * 0.22;
          var t9 = part(CONE(0.035, 0.30, 5), liteM,
            Math.sin(ang) * 0.24, bodyY + 0.14 + Math.abs(ang) * 0.06, -0.30 - Math.cos(ang) * 0.06);
          t9.rotation.set(1.25, ang, 0);
          g.add(t9);
          rig.tails.push(t9);
        }
      } else if (p === 'mark:tusk') {
        head.add(part(CONE(0.022, 0.12, 5), mat('#f0ead8'), -headR * 0.45, -headR * 0.1, headR * 0.7));
        head.add(part(CONE(0.022, 0.12, 5), mat('#f0ead8'), headR * 0.45, -headR * 0.1, headR * 0.7));
      } else if (p === 'mark:crescent') {
        var cr = part(TOR(0.10, 0.022, 10), mat('#f0ead8'), 0, bodyY + 0.10, 0.22);
        g.add(cr);
      } else if (p === 'mark:shaggy') {
        var sg;
        for (sg = 0; sg < 6; sg++) {
          var sa = sg / 6 * Math.PI * 2;
          g.add(part(SPH(0.075, 6), liteM,
            Math.cos(sa) * 0.20, bodyY + 0.08, Math.sin(sa) * 0.24));
        }
      } else if (p === 'mark:bareface') {
        head.add(part(SPH(headR * 0.72, 8), mat('#e8c0a0'), 0, -headR * 0.05, headR * 0.6));
      } else if (p === 'halo') {
        var halo = part(TOR(0.26, 0.014, 18), mat('#f0d488', 'glow'), 0, headY + 0.30, headZ * 0.4);
        halo.rotation.x = -Math.PI / 2;
        g.add(halo);
        rig.halo = halo;
      }
    }

    g.userData = { rig: rig, plan: plan, spec: s, kind: 'pet' };
    return g;
  }

  /* ── 건물 ─────────────────────────────────────────────────
   * 역참·성채는 여태 빌보드였다. 지도 위의 큰 것이 종잇장이면 3D 가 그 자리에서
   * 무너지므로 여기서도 도형으로 세운다. 기와지붕(사각뿔)이 이 판의 표식이다.
   */
  function hanokRoof(w, d, h, color) {
    var g = new T.Group();
    var roof = new T.Mesh(new T.ConeGeometry(Math.max(w, d) * 0.80, h, 4), mat(color, 'flat'));
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    /* 처마 — 얇은 판 하나로 밑을 넓혀 준다. 기와지붕이 '뜬' 느낌을 만든다 */
    var eave = new T.Mesh(new T.ConeGeometry(Math.max(w, d) * 0.95, h * 0.28, 4), mat(shade(color, -0.22), 'flat'));
    eave.rotation.y = Math.PI / 4;
    eave.position.y = -h * 0.42;
    g.add(eave);
    return g;
  }

  function buildStation(color) {
    if (!three()) { return null; }
    var g = new T.Group();
    var post = mat('#7a5a3a'), stone = mat('#9a958c');
    g.add(part(BOX(1.5, 0.12, 1.5), stone, 0, 0.06, 0));
    var sx, sz;
    for (sz = -1; sz <= 1; sz += 2) {
      for (sx = -1; sx <= 1; sx += 2) {
        g.add(solid(part(CYL(0.07, 0.08, 1.0, 7), post, sx * 0.58, 0.62, sz * 0.58)));
      }
    }
    var roof = hanokRoof(1.9, 1.9, 0.62, '#4a5360');
    roof.position.y = 1.42;
    g.add(roof);
    /* 깃발 — 멀리서도 역참인 줄 알아보게 하는 유일한 표식이다 */
    g.add(part(CYL(0.03, 0.03, 1.5, 5), post, 0.86, 0.75, -0.7));
    var flag = part(BOX(0.5, 0.30, 0.02), mat(color || '#e8c15a'), 1.12, 1.34, -0.7);
    g.add(flag);
    g.userData = { rig: { flag: flag }, kind: 'station' };
    return g;
  }

  function buildFort(color) {
    if (!three()) { return null; }
    var g = new T.Group();
    var wallM = mat('#8d8880', 'flat'), gate = mat('#5a4636');
    /* 성벽 — 앞면은 문 때문에 둘로 갈린다 */
    g.add(solid(part(BOX(0.9, 1.1, 0.34), wallM, -1.05, 0.55, 1.1)));
    g.add(solid(part(BOX(0.9, 1.1, 0.34), wallM, 1.05, 0.55, 1.1)));
    g.add(part(BOX(1.2, 0.34, 0.34), wallM, 0, 1.28, 1.1));
    g.add(part(BOX(1.05, 0.95, 0.12), gate, 0, 0.48, 1.16));
    g.add(solid(part(BOX(0.34, 1.1, 2.2), wallM, -1.4, 0.55, 0)));
    g.add(solid(part(BOX(0.34, 1.1, 2.2), wallM, 1.4, 0.55, 0)));
    g.add(solid(part(BOX(2.9, 1.1, 0.34), wallM, 0, 0.55, -1.1)));
    /* 문루 — 성채를 성채로 보이게 하는 것은 이 지붕이다 */
    var tower = new T.Group();
    tower.position.y = 1.45;
    tower.add(solid(part(BOX(1.7, 0.5, 0.7), mat('#b0a89a'), 0, 0.25, 1.05)));
    var roof = hanokRoof(2.3, 1.2, 0.66, '#3f4652');
    roof.position.set(0, 0.86, 1.05);
    tower.add(roof);
    g.add(tower);
    var pole = part(CYL(0.035, 0.035, 1.4, 5), mat('#6b5533'), -1.4, 1.7, -1.1);
    g.add(pole);
    var banner = part(BOX(0.05, 0.62, 0.5), mat(color || '#8a5cc0'), -1.4, 2.05, -0.85);
    g.add(banner);
    g.userData = { rig: { banner: banner }, kind: 'fort' };
    return g;
  }

  /* ── 소품 (비전투 사건 무대, 2026-09-06) ────────────────────
   * "자리·물건을 발견하는 사건"(비문·지도 조각·약초·여울)은 사람을 세우면
   * 뜻이 안 맞는다(`event.js` 참고) — 그렇다고 아무것도 안 세우는 것보다는
   * 발견한 그것 자체를 세우는 게 더 "무대"답다. 사람·짐승·건물과 달리
   * **뼈대(rig)가 없다** — `step()`이 `node.userData.rig`가 없으면 조용히
   * 넘어가므로 저절로 가만히 서 있는다(그게 맞다, 비석이 걷지 않는다).
   */
  var PROP_COLOR = { stone: '#9a958c', dark: '#6f6a62', ruin: '#8d8880', moss: '#6d7a5a',
    soil: '#5a4a36', leaf1: '#4f9a4c', leaf2: '#6bbf5e', water: '#6fa8c8', spray: '#bfe6f5',
    cave: '#847e73', maw: '#221f1c', pebble: '#6f6a62' };

  function propPlan(ref) {
    var t = ref && ref.propType;
    if (t === 'shrine') { return ['base', 'stele', 'carving']; }
    if (t === 'ruin') { return ['drum1', 'drum2', 'fallen', 'moss']; }
    if (t === 'herb') { return ['mound', 'leaf1', 'leaf2', 'leaf3', 'leaf4', 'leaf5']; }
    if (t === 'flood') { return ['pool', 'splash1', 'splash2', 'splash3', 'splash4']; }
    if (t === 'cave') { return ['rock1', 'rock2', 'maw', 'pebble1', 'pebble2']; }
    if (t === 'falls') { return ['ledge', 'sheet1', 'sheet2', 'sheet3', 'pool', 'mist1', 'mist2', 'mist3']; }
    return [];
  }

  /** 비석 — `stone_text`(고대 비문). 밑돌 위에 세운 판돌, 앞면에 새김 자국 */
  function buildShrineProp() {
    var g = new T.Group();
    var stone = mat(PROP_COLOR.stone), dark = mat(PROP_COLOR.dark);
    g.add(part(BOX(0.5, 0.08, 0.5), stone, 0, 0.04, 0));
    g.add(solid(part(BOX(0.34, 0.72, 0.12), stone, 0, 0.44, 0)));
    g.add(part(BOX(0.24, 0.32, 0.01), dark, 0, 0.56, 0.063));
    return g;
  }

  /** 폐허 — `map_scrap`(지도 조각). 무너진 기둥 밑동 둘 + 옆으로 쓰러진 조각 */
  function buildRuinProp() {
    var g = new T.Group();
    var wall = mat(PROP_COLOR.ruin, 'flat'), moss = mat(PROP_COLOR.moss);
    g.add(solid(part(CYL(0.22, 0.24, 0.18, 10), wall, -0.08, 0.09, 0)));
    g.add(solid(part(CYL(0.19, 0.21, 0.15, 10), wall, 0.10, 0.075, -0.08)));
    var fallen = part(CYL(0.16, 0.16, 0.46, 10), wall, 0.32, 0.16, 0.14);
    fallen.rotation.z = Math.PI / 2.1;
    g.add(solid(fallen));
    g.add(part(SPH(0.05, 6), moss, -0.14, 0.19, 0.06));
    return g;
  }

  /** 약초 — `rare_herb`. 흙무더기 위에 잎 다섯이 부채꼴로 돋는다 */
  function buildHerbProp() {
    var g = new T.Group();
    var soil = mat(PROP_COLOR.soil), leaf1 = mat(PROP_COLOR.leaf1), leaf2 = mat(PROP_COLOR.leaf2);
    g.add(solid(part(CYL(0.24, 0.28, 0.09, 10), soil, 0, 0.045, 0)));
    var n = 5, i;
    for (i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var lf = part(CONE(0.045, 0.24, 6), i % 2 ? leaf1 : leaf2,
        Math.cos(a) * 0.09, 0.09 + 0.12, Math.sin(a) * 0.09);
      lf.rotation.z = Math.cos(a) * 0.5;
      lf.rotation.x = -Math.sin(a) * 0.5;
      g.add(lf);
    }
    return g;
  }

  /** 여울 — `flood_ford`. 낮은 물웅덩이 + 튀는 물보라 넷 */
  function buildFloodProp() {
    var g = new T.Group();
    var water = mat(PROP_COLOR.water, 'glow'), spray = mat(PROP_COLOR.spray);
    g.add(part(CYL(0.55, 0.55, 0.03, 16), water, 0, 0.015, 0));
    var n = 4, j;
    for (j = 0; j < n; j++) {
      var a = (j / n) * Math.PI * 2 + 0.4;
      g.add(part(CONE(0.035, 0.22, 5), spray, Math.cos(a) * 0.30, 0.11, Math.sin(a) * 0.30));
    }
    return g;
  }

  /** 굴 — `cave_secret`(이름 없는 굴). 바위 둘이 기대선 사이로 어두운 아가리 */
  function buildCaveProp() {
    var g = new T.Group();
    var rock = mat(PROP_COLOR.cave, 'flat'), maw = mat(PROP_COLOR.maw), pebble = mat(PROP_COLOR.pebble);
    var r1 = part(SPH(0.34, 8), rock, -0.26, 0.28, 0);
    r1.scale.set(1, 1.15, 0.9);
    g.add(solid(r1));
    var r2 = part(SPH(0.30, 8), rock, 0.27, 0.24, -0.05);
    r2.scale.set(1, 1.05, 0.85);
    g.add(solid(r2));
    g.add(part(CYL(0.15, 0.19, 0.4, 8), maw, 0, 0.2, 0.08));
    g.add(part(SPH(0.05, 6), pebble, 0.38, 0.05, 0.22));
    g.add(part(SPH(0.04, 6), pebble, -0.4, 0.04, 0.2));
    return g;
  }

  /** 폭포 — `waterfall_falls`(산속 폭포). 위 바위턱에서 물줄기 셋이 떨어져
   *  아래 물웅덩이로, 물보라는 여울(`flood`)보다 더 높게 튄다 */
  function buildFallsProp() {
    var g = new T.Group();
    var stone = mat(PROP_COLOR.stone, 'flat'), water = mat(PROP_COLOR.water, 'glow'), spray = mat(PROP_COLOR.spray);
    g.add(solid(part(BOX(0.7, 0.16, 0.3), stone, 0, 0.78, -0.16)));
    var i;
    for (i = 0; i < 3; i++) {
      g.add(part(BOX(0.14, 0.7, 0.03), water, -0.2 + i * 0.2, 0.42, -0.08));
    }
    g.add(part(CYL(0.42, 0.46, 0.03, 16), water, 0, 0.03, 0.1));
    for (i = 0; i < 3; i++) {
      var a = (i / 3) * Math.PI * 2 + 0.6;
      g.add(part(CONE(0.05, 0.3, 5), spray, Math.cos(a) * 0.32, 0.16, 0.1 + Math.sin(a) * 0.32));
    }
    return g;
  }

  function buildProp(ref) {
    if (!three()) { return null; }
    var t = ref && ref.propType;
    var g;
    if (t === 'shrine') { g = buildShrineProp(); }
    else if (t === 'ruin') { g = buildRuinProp(); }
    else if (t === 'herb') { g = buildHerbProp(); }
    else if (t === 'flood') { g = buildFloodProp(); }
    else if (t === 'cave') { g = buildCaveProp(); }
    else if (t === 'falls') { g = buildFallsProp(); }
    else { return null; }
    g.userData = { kind: 'prop' };
    return g;
  }

  /* ── 움직임 ───────────────────────────────────────────────
   * 뼈대의 **회전만** 건드린다. 위치·크기는 부르는 쪽(world3d)이 정한다 —
   * 걸음 배속이나 카메라가 바뀌어도 이 함수는 그대로다.
   */
  function step(node, o) {
    /* GLB 로 선 배우는 뼈대 애니메이션이 돈다 — 그쪽이 처리했으면 여기서 손 뗀다 */
    var A = global.DG.asset3d;
    if (A && A.step && A.step(node, o)) { return; }
    if (!node || !node.userData || !node.userData.rig) { return; }
    var rig = node.userData.rig;
    var t = o.t || 0;
    var walking = !!o.walking;
    var ph = o.phase || 0;
    var sw = walking ? Math.sin(ph) * 0.62 : Math.sin(t * 1.7) * 0.05;
    var i;

    /* 교전 몸짓(`playAnim` → o.anim) — 도형 배우(GLB 못 받았거나 GLB_ON 꺼짐)는
       뼈대 애니메이션이 없어 여태 팔은 걷기 흔들림뿐이었다. 공격·피격·회피만
       팔·몸통에 확실히 다른 자세를 준다 — 다리(걸음)는 그대로 둔다(서서 싸운다) */
    var anim = o.anim;
    var armSw = sw * 0.72;
    var lean = 0;
    if (anim === 'attack' || (anim && anim.indexOf('Wpn_') === 0)) { armSw = Math.sin(t * 24) * 1.05; }   // W-0169 무기 몸짓 자리도 공격
    else if (anim === 'hit') { armSw = -0.42; lean = -0.16; }
    else if (anim === 'dodge') { armSw = (Math.floor(t * 8) % 2 ? 1 : -1) * 0.55; lean = 0.14; }
    /* 비전투 사건의 서 있는 몸짓(2026-09-06) — 걷지 않을 때만 뜻이 있어서
       `sw`(걸음 흔들림)는 그대로 두고 팔·기울기만 얹는다. `attack`류처럼
       짧고 강한 동작이 아니라 **카드가 떠 있는 동안 반복**되게 느린 파형을 쓴다 */
    else if (anim === 'greet') { armSw = Math.sin(t * 3) * 0.55; }              // 손짓 — 느리게 반긴다
    else if (anim === 'hurt') { armSw = -0.30 + Math.sin(t * 1.6) * 0.08; lean = 0.22; }  // 웅크림

    if (rig.legL) { rig.legL.rotation.x = sw; }
    if (rig.legR) { rig.legR.rotation.x = -sw; }
    if (rig.armL) { rig.armL.rotation.x = -armSw; }
    if (rig.armR) { rig.armR.rotation.x = armSw; }
    if (rig.body) {
      rig.body.rotation.y = walking ? Math.sin(ph) * 0.08 : 0;
      rig.body.rotation.x = lean;
      /* 몸통은 걸을 때 위아래로 튄다. 기준 높이는 세울 때 적어 둔 것을 쓴다 —
         프레임마다 지금 위치에서 더하면 조금씩 떠올라 결국 공중에 뜬다 */
      rig.body.position.y = rig.baseY +
        (walking ? Math.abs(Math.sin(ph)) * 0.018 : Math.sin(t * 1.7) * 0.006);
    }
    if (rig.head) { rig.head.rotation.y = Math.sin(t * 0.7) * 0.22; }
    if (rig.legs) {
      for (i = 0; i < rig.legs.length; i++) {
        rig.legs[i].rotation.x = (i % 2 ? sw : -sw) * (walking ? 1 : 0.4);
      }
    }
    if (rig.arms) {
      for (i = 0; i < rig.arms.length; i++) { rig.arms[i].rotation.x = (i ? armSw : -armSw) * 0.6; }
    }
    if (rig.wings) {
      /* 새는 걸을 때가 아니라 **늘** 날갯짓한다 — 지도 위에서 새가 굳어 있으면 죽어 보인다 */
      for (i = 0; i < rig.wings.length; i++) {
        rig.wings[i].rotation.z = (i ? -1 : 1) * (0.25 + Math.sin(t * 6) * 0.45);
      }
    }
    if (rig.coils) {
      for (i = 0; i < rig.coils.length; i++) {
        rig.coils[i].position.y = 0.52 + Math.sin(t * 2.4 - i * 0.8) * 0.09;
        rig.coils[i].position.x = Math.sin(t * 1.6 - i * 0.7) * 0.07;
      }
    }
    if (rig.tail) { rig.tail.rotation.y = Math.sin(t * 3.2) * 0.35; }
    if (rig.tails) {
      for (i = 0; i < rig.tails.length; i++) {
        rig.tails[i].rotation.z = Math.sin(t * 2.2 + i * 0.5) * 0.16;
      }
    }
    if (rig.cape) { rig.cape.rotation.x = walking ? -0.12 - Math.abs(Math.sin(ph)) * 0.10 : -0.04; }
    if (rig.ring) { rig.ring.rotation.z = t * 0.9; }
    if (rig.halo) { rig.halo.rotation.z = t * 1.4; }
    if (rig.flag || rig.banner) {
      var f = rig.flag || rig.banner;
      f.rotation.y = Math.sin(t * 1.9) * 0.28;
    }
  }

  /** 도형으로 조립한다 — 이 파일이 원래 하던 일 */
  /** 다 세운 뒤 한 번에 — `solid()`가 표시해 둔 덩이마다 외곽선을 얹는다.
   *  부모에 매달리기 전에는 형제를 못 붙이므로 조립이 끝난 뒤에만 부른다 */
  function applyOutlines(g) {
    var TN = global.DG.toon3d;
    if (!g || !TN || !TN.OUTLINE_ON()) { return g; }
    var todo = [];
    g.traverse(function (o) {
      if (o.isMesh && o.userData && o.userData.wantOutline) { todo.push(o); }
    });
    for (var i = 0; i < todo.length; i++) { TN.outline(todo[i]); }
    return g;
  }

  function shape(kind, ref) {
    var g = null;
    if (kind === 'hero') { g = buildHero(ref); }
    else if (kind === 'pet') { g = buildPet(ref); }
    else if (kind === 'station') { g = buildStation(ref && ref.color); }
    else if (kind === 'fort') { g = buildFort(ref && ref.color); }
    else if (kind === 'prop') { g = buildProp(ref); }
    return g ? applyOutlines(g) : null;
  }

  /**
   * 배우 하나. **표(`asset3d`)에 GLB 가 적혀 있으면 그쪽에 양보한다** —
   * 적힌 것이 없으면(지금이 그렇다) 예전 그대로 도형을 조립한다.
   * 부르는 쪽(`world3d`)은 이 갈림길을 몰라도 된다.
   */
  function build(kind, ref) {
    var A = global.DG.asset3d;
    if (A && A.wants && A.wants(kind, ref)) {
      var n = A.build(kind, ref, function () { return shape(kind, ref); });
      if (n) { return n; }
    }
    var s = shape(kind, ref);
    /* 모르는 종류가 들어와도 화면에 무언가는 선다 (PLAN 49절의 마지막 자리) */
    if (!s && A && A.primitive) { return A.primitive(kind, ref); }
    return s;
  }

  function plan(kind, ref) {
    if (kind === 'hero') { return heroPlan(ref); }
    if (kind === 'pet') { return petPlan(ref); }
    if (kind === 'station') { return ['base', 'posts', 'roof', 'flag']; }
    if (kind === 'fort') { return ['walls', 'gate', 'tower', 'roof', 'banner']; }
    if (kind === 'prop') { return propPlan(ref); }
    return [];
  }

  function spec(kind, ref) {
    if (kind === 'hero') { return heroSpec(ref); }
    if (kind === 'pet') { return petSpec(ref); }
    if (kind === 'prop') { return { propType: ref && ref.propType }; }
    return null;
  }

  /** 부품 수 — 세워 보지 않고도 무거운 배우를 가려낼 수 있다 */
  function partCount(node) {
    var n = 0;
    node.traverse(function (o) { if (o.isMesh) { n++; } });
    return n;
  }

  global.DG = global.DG || {};
  global.DG.actor3d = {
    ready: ready,
    plan: plan, spec: spec,
    build: build, step: step, partCount: partCount,
    /** 비례 — world3d 가 발밑 그림자 크기를 여기서 가져간다 */
    P: P
  };
})(window);
