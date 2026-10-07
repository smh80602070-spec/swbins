  /* ── 전방 ─────────────────────────────────────────────── */

  function hasTool(key) { return !!(st().tools && st().tools[key]); }

  /**
   * 도구를 산다 — 한 번 사면 계속 쓴다.
   * 원작이 잠자리채 없이는 벌레를 못 잡게 해 둔 그 자리다.
   */
  function buyTool(key) {
    var t = VD.TOOLS[key];
    if (!t) { return { kind: 'no', text: '없는 물건입니다' }; }
    if (hasTool(key)) { return { kind: 'no', text: '이미 가지고 있습니다' }; }
    if (core.save.player.gold < t.price) {
      return { kind: 'no', text: '금이 모자랍니다 (🪙 ' + core.fmt(t.price) + ')' };
    }
    core.save.player.gold -= t.price;
    st().tools[key] = true;
    core.log(t.emoji + ' ' + t.name + ' 을(를) 샀다 — ' + t.desc, 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'buy', text: t.emoji + ' ' + t.name + ' 을(를) 샀다' };
  }

  /** 하나 판다 — **행사날에는 그 갈래가 비싸게 팔린다** */
  function sell(key, n) {
    var s = st(), it = VD.item(key);
    if (!it) { return 0; }
    n = Math.min(n || 1, bagCount(key));
    if (!n) { return 0; }
    s.bag[key] -= n;
    var mul = global.DG.town ? global.DG.town.priceMul(it.cat) : 1;
    var lv = shopLevel();
    var gold = Math.round(it.price * n * mul * lv.bonus);
    core.save.player.gold += gold;
    s.sold += n;
    s.soldGold = (s.soldGold || 0) + gold;         // 전방이 자라는 기준
    core.log('🪙 ' + it.name + ' ×' + n + ' 을 팔았다 (+' + core.fmt(gold) + ')' +
      (mul > 1 ? ' — 오늘은 값이 좋다' : ''), 'info');
    core.emit('changed');
    core.persist();
    return gold;
  }

  /** 부탁에 필요한 것만 남기고 전부 판다 */
  function sellAll() {
    var s = st(), keep = {}, k, id, total = 0;
    for (id in s.requests) {
      if (!Object.prototype.hasOwnProperty.call(s.requests, id)) { continue; }
      var r = s.requests[id];
      if (!r.done) { keep[r.want] = (keep[r.want] || 0) + r.n; }
    }
    var list = bagList();
    for (var i = 0; i < list.length; i++) {
      k = list[i].item.key;
      var n = list[i].n - (keep[k] || 0);
      if (n > 0) { total += sell(k, n); }
    }
    return total;
  }

  function status() {
    var s = st();
    var ph = VD.phaseOf(new Date().getHours());
    return {
      phase: ph, day: s.day,
      bag: bagList(), gathered: s.gathered, sold: s.sold, helped: s.helped,
      residents: residents.length, focus: focus(),
      fishing: fishState(),
      season: VD.season(),
      weather: VD.weather(),
      planted: (s.planted || []).length,
      plantable: plantable(),
      canPlant: canPlantHere(),
      indoors: indoors,
      sneak: sneaking(),
      net: !!(s.tools && s.tools.net),
      spade: !!(s.tools && s.tools.spade),
      stung: global.DG.bug ? global.DG.bug.stung() : false,
      bugs: global.DG.bug ? global.DG.bug.list().length : 0,
      bugNow: global.DG.bug ? global.DG.bug.nowNames() : [],
      mail: global.DG.mail ? global.DG.mail.status() : null,
      town: global.DG.town ? global.DG.town.status() : null,
      turnip: global.DG.turnip ? global.DG.turnip.status() : null,
      weeds: weedCount(), shop: shopLevel(),
      wear: global.DG.wear ? global.DG.wear.status() : null,
      chat: global.DG.folk ? global.DG.folk.status() : null
    };
  }

  global.DG = global.DG || {};
  global.DG.village = {
    W: W, H: H, TILE: TILE, REACH: REACH,
    init: init, update: update, bindKeys: bindKeys, walkTo: walkTo, setJoy: setJoy,
    keymap: keymap, beginRemap: beginRemap, remapping: function () { return remapping; },
    tileAt: tileAt, walkable: walkable, snapToLand: snapToLand, ringSpotOk: ringSpotOk,
    _shellPath: function () { return shellPath; },
    focus: focus, interact: interact, spent: spent,
    talk: talk, requestOf: requestOf, friendOf: friendOf, talkNpc: talkNpc,
    heartOf: heartOf, bumpHeart: bumpHeart, heartNext: heartNext,
    heartUnlockAt: heartUnlockAt, mementoStory: mementoStory, canFollow: canFollow, requestFollow: requestFollow,
    bagList: bagList, bagCount: bagCount, bagCatCount: bagCatCount, bagAdd: bagAdd,
    sell: sell, sellAll: sellAll, questProgress: questProgress,
    caughtCount: caughtCount, shake: shake, speedMul: speedMul,
    weedCount: weedCount, pullWeed: pullWeed, growWeeds: growWeeds, WEED_MAX: WEED_MAX,
    WEED_PER_DAY: WEED_PER_DAY,
    shopLevel: shopLevel, SHOP_TIERS: SHOP_TIERS,
    giveGift: giveGift, giftLike: giftLike, giftDislike: giftDislike, giftedToday: giftedToday,
    buildProps: buildProps, forestMargin: forestMargin, biomeAt: biomeAt, BIOMES: BIOMES,
    FORESTS: FORESTS, forestAt: forestAt, forestByKey: function (k) { return FOREST_BY[k] || null; },
    forestOfPlayer: forestOfPlayer, _stepForest: stepForest, _resetForest: function () { forestNow = null; forestPend = null; forestT = 0; },
    lakeCenter: lakeCenter, inLake: inLake, inRiver: inRiver, riverCenterX: riverCenterX,
    waterfallSpot: waterfallSpot, hamletSpot: hamletSpot, inHamlet: inHamlet,
    hamlet2Spot: hamlet2Spot, inHamlet2: inHamlet2,
    ruinSpot: ruinSpot, inRuin: inRuin,
    spaceBaseSpot: spaceBaseSpot, inSpaceBase: inSpaceBase,
    pickupParcel: pickupParcel, deliveryState: deliveryState,
    inBridge: inBridge, BRIDGE_TY: BRIDGE_TY,
    caveSpot: caveSpot, inCave: inCave, buildAnimals: buildAnimals,
    buildNpcs: buildNpcs, firstBiomeSpot: firstBiomeSpot,
    indoors: inside, enterHome: enterHome, leaveHome: leaveHome,
    caveInside: caveInside, enterCave: enterCave, leaveCave: leaveCave,
    caveRoom: caveRoom, caveDoor: caveDoor, caveChests: caveChests, chestOpened: chestOpened,
    caveBossChest: caveBossChest, bossUnlocked: bossUnlocked,
    sneaking: sneaking, toggleSneak: toggleSneak, setAutoSneak: setAutoSneak,
    buyTool: buyTool, hasTool: hasTool,
    rollDay: rollDay, today: today, status: status, state: st,
    /** 오늘의 일과판(§5.1) */
    taskList: taskList, weeklyTaskInfo: weeklyTaskInfo, checkTasks: checkTasks, counterOf: counterOf,
    /** 하루 마무리 카드(§5.2) */
    dayLogPending: dayLogPending, dayLogInfo: dayLogInfo, dayLogSeen: dayLogSeen, sleepNow: sleepNow,
    snapshotDayMark: snapshotDayMark,
    castLine: castLine, hookLine: hookLine, fishState: fishState,
    BITE_WINDOW: BITE_WINDOW,
    plant: plant, plantable: plantable, canPlantHere: canPlantHere,
    syncPlanted: syncPlanted, PLANT_DAYS: PLANT_DAYS, HYBRID_NEAR: HYBRID_NEAR,
    /** 화면 전용 — 상태를 직접 읽는다 (쓰지는 말 것) */
    raw: function () {
      return { player: player, props: props, residents: residents,
               animals: animals, npcs: npcs, fishing: fishing,
               visitors: global.DG.visitor ? global.DG.visitor.list() : [] };
    },
    /** 2026-09-09 — "클릭한 곳이 안 보인다"(사가나락와 같은 재신고). 화면이
     *  target 을 그릴 수 있게 읽기 전용으로 내준다. */
    moveTarget: function () { return target; }
  };
})(window);
