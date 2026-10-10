/**
 * 2나락 3D 바닥 전리품 — 흰 상자 대신 아이템 아이콘 (W-0146)
 * ---------------------------------------------------------------
 * 떨어진 물건은 등급색 납작 상자(12×6×12, 보통 등급 #d9d9e0)라 화면에서 흰·분홍 네모로만 보였다.
 * 이미 있는 아이템 아이콘(64px, shared itemicon — 가방·장비창이 쓰는 그 그림)을 바닥 위에 세운다.
 *
 *   받침   등급색 납작 판(12×1.5×12, 지금 dropHex) — 돌기(rotation.y)는 dungeon3d 가 그대로 준다
 *   아이콘 받침 위 y 13 에 카메라를 마주 보는 Sprite(18×18). 텍스처·재질은 주소마다 하나(같은 아이템 여럿이어도 한 장)
 *   대상   장비 = equip:(uniq || base) · 보석 재료 = gem:key — 금·물약·두루마리·그 밖 재료는 아이콘이 없어 옛 상자,
 *          다만 다 보통 등급 흰색이라 흰 네모로 보이던 것을 종류 색(금빛·붉은·미색·흙색)으로(hexOf)
 *
 * 아이콘 주소가 없거나 `DG.itemicon.enabled = false` 면 add() 가 false — dungeon3d 가 옛 상자를 세운다.
 * iconOf()·iconUrl() 은 three 없이 돈다. add() 는 three 를 받아 쓴다(진단은 가짜 three 로 본다).
 */
(function (global) {
  'use strict';

  var GAME = 'saga-dungeon', ICON = 18, LIFT = 13;

  /** 떨어진 물건 → 아이콘 { kind, id } · 없으면 null */
  function iconOf(dp) {
    if (!dp) { return null; }
    if (dp.kind === 'item' && dp.item) { var id = dp.item.uniq || dp.item.base; return id ? { kind: 'equip', id: id } : null; }
    if (dp.kind === 'mat' && dp.mat && dp.mat.kind === 'gem' && dp.mat.key) { return { kind: 'gem', id: dp.mat.key }; }
    return null;
  }
  /** 아이콘 그림 주소(가방과 같은 itemicon.src) · 없으면 null */
  function iconUrl(dp) {
    var I = global.DG.itemicon, k = iconOf(dp);
    return I && I.src && k ? I.src(GAME, k.kind, k.id) : null;
  }

  /** 아이콘 없는 물건의 옛 상자 색 — 모두 보통 등급 흰색(#d9d9e0)이라 흰 네모로 보였다. 종류 색으로(등급색이 있으면 그것) */
  var KIND_HEX = { gold: 0xf0c34a, potion: 0xd84a4a, scroll: 0xe8d9a8, mat: 0xa08b6a };
  function hexOf(dp, gradeHex) { return dp && gradeHex === 0xd9d9e0 && KIND_HEX[dp.kind] ? KIND_HEX[dp.kind] : gradeHex; }

  var plateGeo = null, plateMats = {}, spriteMats = {};
  /**
   * 노드에 받침 + 아이콘을 단다. 아이콘이 없으면 아무것도 안 하고 false(→ 옛 상자).
   * @param node dungeon3d 의 전리품 배우 노드 · dp 떨어진 물건 · T three · hex 등급색
   */
  function add(node, dp, T, hex) {
    var url = iconUrl(dp);
    if (!url || !T || !node) { return false; }
    if (!plateGeo) { plateGeo = new T.BoxGeometry(12, 1.5, 12); }
    var pm = plateMats[hex] || (plateMats[hex] = new T.MeshBasicMaterial({ color: hex }));
    var plate = new T.Mesh(plateGeo, pm);
    plate.position.y = 0.75;
    node.add(plate);
    var sm = spriteMats[url];
    if (!sm) {
      var tx = new T.TextureLoader().load(url);
      if (T.SRGBColorSpace) { tx.colorSpace = T.SRGBColorSpace; }
      sm = spriteMats[url] = new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false });
    }
    var sp = new T.Sprite(sm);
    sp.scale.set(ICON, ICON, 1);
    sp.position.y = LIFT;
    sp.renderOrder = 5;
    node.add(sp);
    return true;
  }

  global.DG = global.DG || {};
  global.DG.loot3d = { iconOf: iconOf, iconUrl: iconUrl, add: add, hexOf: hexOf, ICON: ICON,
    stats: function () { return { icons: Object.keys(spriteMats).length, plates: Object.keys(plateMats).length }; } };
})(window);
