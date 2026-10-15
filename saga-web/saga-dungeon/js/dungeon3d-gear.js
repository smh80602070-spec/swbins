/**
 * 2나락 3D 무기·투구·갑주 얹기(도형 몸·GLB 몸 손에) — WPN_MUL·attachWeapon·foeGear. dungeon3d.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * dungeon3d.js 가 `use({ box, geo, mat, mix, AS }, T)` 로 손잡이와 three 를 넘기고 GEAR().foeGear 로 부른다(T 는 init 뒤에야 서므로 부를 때마다 넘긴다).
 */
(function (global) {
  'use strict';

  var G = null, box, geo, mat, mix, AS, T = null;
  var api = null;
  function use(g, t) { if (G !== g) { G = g; box = g.box; geo = g.geo; mat = g.mat; mix = g.mix; AS = g.AS; } T = t; return api; }
  /* 2026-09-05 — SAGA WEB.md "F. 소품" 목록의 "무기". 몸은 실사 GLB(QRPG
     창고)인데 무기만 도형(각목)이던 자리를 poly.pizza Quaternius CC0 무기로
     갈아 끼운다. 옛 도형은 fallback 으로 그대로 남긴다(`AS3.build`가 GLB
     실패 시 이 함수를 그대로 부른다) — 위치·자리는 옛 값과 같다.
     mul 은 옛 도형의 길이(r 배수)를 그대로 옮긴 값이다.
     2026-09-05(이어서) — `data-item.js`의 무기 `look` 열 가지를 다 받도록
     `guandao`(월도, spear 재사용)·`scroll`(병서)·`fan`·`brush`(선채·필묵,
     둘 다 붓 모델 하나 공유)를 더했다. 몬스터(`foeGear`)·플레이어 본인
     (`buildActor`의 `kind==='me'`) 둘 다 이 표 하나를 같이 쓴다 —
     `attachWeapon()`으로 뽑아냈다(전엔 `foeGear()` 안에만 있었다) */
  var WPN_MUL = {
    club: 1.3, axe: 1.7, sword: 1.8, spear: 2.6, halberd: 2.8, guandao: 2.8,
    staff: 2.3, bow: 1.7, scroll: 1.0, fan: 1.5, brush: 1.5,
    /* §5.7 시대 퓨전(2026-09-18) — 전자창은 halberd 급 길이, 동력장갑은
       자루 없이 손을 감싸는 상자라 club 보다도 짧다. */
    lance_e: 2.7, gauntlet: 1.2
  };
  function attachWeapon(g, weapon, handX, handZ, shoulderY, r) {
    var wcol = 0xb9c2cf, woodcol = 0x5a4a34;
    var AS3 = AS();
    if (weapon === 'club') {
      var clubShape = function () {
        var sg = new T.Group();
        box(sg, 0, r * 0.55, 0, r * 0.5, r * 1.1, r * 0.5, woodcol, 'flat', true);
        return sg;
      };
      var wnode = AS3 ? AS3.build('wpn:club', 'foe', r * WPN_MUL.club, null, clubShape) : clubShape();
      wnode.position.set(handX, shoulderY, handZ);
      g.add(wnode);
    } else if (weapon === 'axe') {
      var axeShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.2, r * 1.6, r * 0.2, woodcol, 'flat', true);
        box(sg, 0, r * 0.7, 0, r * 0.85, r * 0.5, r * 0.14, wcol, 'flat', true);
        return sg;
      };
      var anode = AS3 ? AS3.build('wpn:axe', 'foe', r * WPN_MUL.axe, null, axeShape) : axeShape();
      anode.position.set(handX, shoulderY, handZ);
      g.add(anode);
    } else if (weapon === 'sword') {
      var swordShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.15, r * 1.7, r * 0.15, wcol, 'flat', true);
        return sg;
      };
      var snode = AS3 ? AS3.build('wpn:sword', 'foe', r * WPN_MUL.sword, null, swordShape) : swordShape();
      snode.position.set(handX, shoulderY, handZ);
      g.add(snode);
    } else if (weapon === 'spear' || weapon === 'halberd' || weapon === 'guandao') {
      var isHalberd = weapon === 'halberd' || weapon === 'guandao';
      var poleShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * (isHalberd ? 2.8 : 2.6), r * 0.12, woodcol, 'flat', true);
        if (isHalberd) { box(sg, 0, r * 1.3, 0, r * 0.85, r * 0.6, r * 0.15, wcol, 'flat', true); }
        else { box(sg, 0, r * 1.2, 0, r * 0.13, r * 0.5, r * 0.13, wcol, 'flat', true); }
        return sg;
      };
      var pnode2 = AS3 ? AS3.build('wpn:' + weapon, 'foe', r * WPN_MUL[weapon], null, poleShape) : poleShape();
      pnode2.position.set(handX, shoulderY, handZ);
      g.add(pnode2);
    } else if (weapon === 'staff') {
      var staffShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * 2.2, r * 0.12, woodcol, 'flat', true);
        box(sg, 0, r * 1.1, 0, r * 0.4, r * 0.4, r * 0.4, 0x9fe8ff, 'glow', false);
        return sg;
      };
      var stnode = AS3 ? AS3.build('wpn:staff', 'foe', r * WPN_MUL.staff, null, staffShape) : staffShape();
      stnode.position.set(handX, shoulderY, handZ);
      g.add(stnode);
    } else if (weapon === 'bow') {
      /* 활은 칼·창과 달리 손 높이를 **가운데** 두고 위아래로 뻗는다. GLB 는
         `normalize()`가 바닥을 y=0 에 놓으므로(다른 무기와 같은 규약),
         도형(fallback)도 활을 그 규약에 맞춰 `bmul/2` 만큼 들어 그려 둔다 —
         그래야 GLB 든 도형이든 바깥 위치는 늘 같은 한 줄(`shoulderY - bmul/2`)로
         가운데를 맞춘다(비동기로 GLB 가 늦게 와도 위치가 안 흔들린다) */
      var bmul = r * WPN_MUL.bow;
      var bowShape = function () {
        var sg = new T.Group();
        var bow = new T.Mesh(geo('bowArc', function () { return new T.TorusGeometry(1, 0.09, 5, 10, Math.PI * 1.4); }),
          mat(woodcol, 'flat'));
        bow.scale.setScalar(r * 0.85);
        bow.position.y = bmul * 0.5;
        bow.rotation.z = Math.PI / 2;
        bow.castShadow = true;
        sg.add(bow);
        return sg;
      };
      var bnode = AS3 ? AS3.build('wpn:bow', 'foe', bmul, null, bowShape) : bowShape();
      bnode.position.set(handX, shoulderY - bmul * 0.5, handZ);
      g.add(bnode);
    } else if (weapon === 'scroll' || weapon === 'fan' || weapon === 'brush') {
      /* 병서(scroll)·선채(fan)·필묵(brush) — 다 가는 막대를 쥔 실루엣이라
         하나의 얇은 막대 fallback 을 같이 쓴다(fan·brush 는 실제 GLB 도
         하나를 공유한다, `asset3d.js` 참고) */
      var thinShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.1, r * WPN_MUL[weapon], r * 0.1, woodcol, 'flat', true);
        return sg;
      };
      var tnode = AS3 ? AS3.build('wpn:' + weapon, 'foe', r * WPN_MUL[weapon], null, thinShape) : thinShape();
      tnode.position.set(handX, shoulderY, handZ);
      g.add(tnode);
    } else if (weapon === 'lance_e') {
      /* §5.7 시대 퓨전(2026-09-18) — 전자창(電子槍). 자루 비례는 halberd와
         같지만 날 대신 발광 촉(staff의 파란 정육면체 결)을 얹어 "미래
         무기"임을 실루엣으로 알린다. 실제 GLB 는 없다 — 이 fallback 이 늘 쓰인다
         (AS3.build 는 'wpn:lance_e' 자산이 없으면 그대로 fallback 만 돌려준다). */
      var laceShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * 2.6, r * 0.12, wcol, 'flat', true);
        box(sg, 0, r * 1.25, 0, r * 0.22, r * 0.7, r * 0.22, 0x6fe0ff, 'glow', false);
        return sg;
      };
      var lnode = AS3 ? AS3.build('wpn:lance_e', 'foe', r * WPN_MUL.lance_e, null, laceShape) : laceShape();
      lnode.position.set(handX, shoulderY, handZ);
      g.add(lnode);
    } else if (weapon === 'gauntlet') {
      /* §5.7 시대 퓨전(2026-09-18) — 동력장갑(動力裝甲). 자루가 없는 첫
         무기라 다른 branches처럼 긴 막대를 안 세우고, 손 둘레를 감싸는
         짧고 두꺼운 상자 + 발광 너클로 그린다. */
      var gauShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.55, r * 0.55, r * 0.55, wcol, 'flat', true);
        box(sg, 0, r * 0.32, r * 0.3, r * 0.5, r * 0.16, r * 0.16, 0xff8c3c, 'glow', false);
        return sg;
      };
      var gnode = AS3 ? AS3.build('wpn:gauntlet', 'foe', r * WPN_MUL.gauntlet, null, gauShape) : gauShape();
      gnode.position.set(handX, shoulderY, handZ);
      g.add(gnode);
    }
  }
  function foeGear(g, look, hh, r, tint, humanGlb) {   // humanGlb: GLB 로 설 사람 몸(레시피 있고 GLB 켜짐)엔 갑주·투구를 안 씌운다(VRM 을 화분처럼 덮었다, W-0100) — 도형 몸은 상자 신호 그대로
    var handX = r * 1.05, handZ = r * 0.25, shoulderY = hh * 0.68;
    var woodcol = 0x5a4a34;
    var AS3 = AS();
    attachWeapon(g, look.weapon, handX, handZ, shoulderY, r);
    /* 2026-09-06 — 갑주(tier). data-item.js/data-enemy.js에 `look.armor`
       필드는 있었지만 여태 아무도 안 그렸다(적도 플레이어도) — 실제 갑주
       GLB가 없으니 몸통을 감싸는 색 다른 상자로 "가죽/판금" 실루엣 신호만
       준다. 나중에 진짜 갑주 GLB를 구하면 이 키(`gear:armor:*`)로 등록만
       하면 AS3.build가 자동으로 갈아 끼운다. */
    if (!humanGlb && (look.armor === 'leather' || look.armor === 'plate')) {
      var armMul = hh * 0.62;
      var armFallback = function () {
        var sg = new T.Group();
        var acol = look.armor === 'plate' ? 0x8a8f9a : 0x5a4632;
        box(sg, 0, armMul * 0.5, 0, r * 1.3, armMul, r * 1.15, acol, 'flat', true);
        return sg;
      };
      wornGear('gear:armor:' + look.armor, armMul, hh * 0.12, armFallback);
    }
    /* 2026-09-05 — 투구(`helmet`)·왕관(`crown`)을 실사화(poly.pizza). 모자·
       망토류는 칼·창과 달리 몸을 **가운데(또는 제자리)** 두고 걸치는
       물건이라(활과 같은 사정), `normalize()`가 바닥을 y=0 에 두는 규약과
       어긋난다 — fallback 도형도 그 규약(바닥이 0)에 맞춰 다시 그려서,
       도형이든 GLB든 이 한 줄(`bottomY, mul` 또는 `centerY - mul/2`)로
       늘 같은 자리를 잡는다. */
    function wornGear(kind, mul, bottomY, fallbackFn, tintHex) {
      var node = AS3 ? AS3.build(kind, 'foe', mul, tintHex || null, fallbackFn) : fallbackFn();
      node.position.y += bottomY;
      g.add(node);
    }
    function wornGearCentered(kind, mul, centerY, fallbackFn, tintHex) {
      wornGear(kind, mul, centerY - mul * 0.5, fallbackFn, tintHex);
    }
    if (look.cape) {
      /* 2026-09-05(이어서) — 사용자 지시로 CC-BY 완성 망토 모델로 갈아 끼웠다.
         이미 붉·금으로 칠해진 모델이라 tint 를 주면(곱연산) 세력색에 따라
         탁해진다 — 그래서 **GLB 는 tint 없이 제 색 그대로**, fallback 만
         옛 방식대로 세력색을 쓴다(둘의 표현이 달라도 "망토가 있다/없다"
         라는 실루엣 신호는 같다) */
      var capeMul = hh * 0.7, capeBottomY = hh * 0.07;
      var capeFallback = function () {
        var sg = new T.Group();
        box(sg, 0, capeMul * 0.5, 0, r * 1.25, capeMul, r * 0.13,
          mix(tint, 0x000000, 0.25), 'flat', true);
        return sg;
      };
      var capeNode = AS3 ? AS3.build('gear:cape', 'foe', capeMul, null, capeFallback) : capeFallback();
      capeNode.position.set(0, capeBottomY, -r * 0.85);
      capeNode.rotation.x = -0.1;
      g.add(capeNode);
    }
    var headY = hh + r * 0.5, helm = humanGlb ? 'none' : look.helm;
    if (helm === 'helmet' || helm === 'plume') {
      var helmMul = r * 0.7;
      var helmFallback = function () {
        var sg = new T.Group();
        box(sg, 0, helmMul * 0.5, 0, r * 1.0, helmMul, r * 1.0, 0x5a5a62, 'flat', true);
        return sg;
      };
      wornGearCentered('gear:helmet', helmMul, headY + r * 0.35, helmFallback);
      if (helm === 'plume') {
        box(g, 0, headY + r * 0.85, 0, r * 0.2, r * 0.85, r * 0.2, mix(tint, 0xff5a3a, 0.5), 'glow', false);
      }
    } else if (helm === 'gapju') {
      /* 2026-09-05(이어서) — "gapju"(원뿔형 동아시아 투구)란 이름의 CC0/CC-BY는
         끝까지 못 찾았다 — 대신 바이킹 투구(뿔 달림, CC-BY 3.0)를 쓴다.
         대장간=집 모델과 같은 판단: 모양이 정확히 안 맞아도 "이 적은 다른
         투구를 썼다"는 다양성 신호는 충분히 준다 */
      var gapjuMul = r * 0.8;
      var gapjuFallback = function () {
        var sg = new T.Group();
        var cone = new T.Mesh(geo('helmCone', function () { return new T.ConeGeometry(1, 1.3, 8); }),
          mat(woodcol, 'flat'));
        cone.scale.setScalar(r * 0.65);
        cone.position.y = gapjuMul * 0.5;
        cone.castShadow = true;
        sg.add(cone);
        return sg;
      };
      wornGearCentered('gear:gapju', gapjuMul, headY + r * 0.55, gapjuFallback);
    } else if (helm === 'crown') {
      var crownMul = r * 0.86;
      var crownFallback = function () {
        var sg = new T.Group();
        var ring = new T.Mesh(geo('crownRing', function () { return new T.TorusGeometry(1, 0.18, 6, 12); }),
          mat(0xe8c15a, 'glow'));
        ring.scale.setScalar(r * 0.55);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = crownMul * 0.5;
        sg.add(ring);
        return sg;
      };
      wornGearCentered('gear:crown', crownMul, headY + r * 0.5, crownFallback);
    }
    /* look.beard — 2026-09-05, 끝까지 찾아도 진짜 CC0 턱수염 낱개 모델이
       없었다(마스카·콧수염뿐). 실사화 원칙(사용자 지시: 개조·대체가 안
       되면 도형 대신 없는 채로 둔다)에 따라 이 분기를 지웠다 — 수염 있는
       적도 이제 수염 없이 나온다 */
  }

  api = { use: use, WPN_MUL: WPN_MUL, attachWeapon: attachWeapon, foeGear: foeGear };
  global.DG = global.DG || {};
  global.DG.dungeon3dGear = api;
})(typeof window !== 'undefined' ? window : this);
