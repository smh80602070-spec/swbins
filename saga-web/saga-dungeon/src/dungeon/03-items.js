  /* ── 행상(行商) — POI: Merchant, PLAN 12절 "랜덤 상인" ──────
   * 본영 행상(vendor.js)과 값 매기는 규칙만 같이 쓰고(item.price), 재고는
   * 따로 굴린다 — 그쪽 "회차가 끝나야 재고가 새로 온다" 는 규칙을 안 건드린다.
   */
  var MERCHANT_STOCK_N = 3;
  var MERCHANT_MUL = 1.8;              // 본영 행상(3.2배)보다 싸다 — 대신 셋뿐이고 한 번뿐이다
  var MERCHANT_TIER_MAX = 2;           // 본영과 같은 상한(명품까지) — 던전에서 다 사면 내려갈 맛이 준다

  function rollMerchantStock(floor) {
    var IT = global.DG.item, D = global.DG.itemData, i, w = [];
    for (i = 0; i <= MERCHANT_TIER_MAX; i++) { w.push(D.TIERS[i].weight); }
    var total = 0; for (i = 0; i < w.length; i++) { total += w[i]; }
    var out = [];
    for (i = 0; i < MERCHANT_STOCK_N; i++) {
      var r = Math.random() * total, tier = 0, acc = 0;
      for (var j = 0; j < w.length; j++) { acc += w[j]; if (r <= acc) { tier = j; break; } }
      var g = IT.roll(floor + 1, { tier: tier, unid: false });
      out.push({ item: g, price: Math.round(IT.price(g) * MERCHANT_MUL) });
    }
    return out;
  }

  /** 행상 재고 하나를 산다. `idx` 는 `run.merchantChoice` 의 자리 */
  function buyMerchant(idx) {
    if (!run || !run.merchantChoice || !run.merchantChoice[idx]) { return { ok: false, reason: 'gone' }; }
    var row = run.merchantChoice[idx];
    var IT = global.DG.item;
    if (core.save.player.gold < row.price) { return { ok: false, reason: 'gold' }; }
    if (IT.bag().length >= IT.bagCap()) { return { ok: false, reason: 'bag' }; }
    core.save.player.gold -= row.price;
    IT.add(row.item);
    run.merchantChoice.splice(idx, 1);
    if (!run.merchantChoice.length) { run.merchantChoice = null; }
    sfx('coin');
    core.log('🧺 ' + IT.name(row.item) + ' 을(를) 샀다 · 금 -' + core.fmt(row.price), 'info');
    core.emit('changed');
    return { ok: true, item: row.item, cost: row.price };
  }

  /** 행상 자리를 떠난다 (사지 않고 닫는다) */
  function leaveMerchant() {
    run.merchantChoice = null;
    core.emit('changed');
  }

  /* ── 퍼즐(POI: Puzzle) ────────────────────────────────────
   * 제단 셋을 맞는 순서로 밟는다. 틀리면 처음부터 — 벌은 없다(머리로
   * 푸는 방이라 몸싸움을 안 섞었다, PLAN 13절 "환경 상호작용"과 같은 결).
   */
  function touchPuzzlePod(room, pz, pod) {
    if (pz.order[pz.progress] === pod.idx) {
      pod.lit = true;
      pz.progress++;
      sfx('door');
      if (pz.progress >= pz.order.length) {
        pz.solved = true;
        dropItem(room, ROOM_W * 0.62, ROOM_H * 0.5, 20);
        dropGold(room, ROOM_W * 0.62, ROOM_H * 0.5, 2.4);
        sfx('chest');
        core.emit('toast', '🧩 퍼즐을 풀었다!');
      } else {
        core.emit('toast', '🧩 ✓ · 다음 제단 (' + pz.progress + '/' + pz.order.length + ')');
      }
    } else {
      var wasProgress = pz.progress > 0;
      pz.progress = 0;
      for (var i = 0; i < pz.pods.length; i++) { pz.pods[i].lit = false; }
      if (wasProgress) { core.emit('toast', '🧩 ✗ · 처음부터'); }
    }
  }

  /* ── 노획물 ───────────────────────────────────────────── */

  /** 층을 내려가거나 탈출할 때 확정 */
  function settleLoot(why) {
    if (!run) { return null; }
    var g = Math.round(run.loot.gold);
    var kept = 0, i;
    core.save.player.gold += g;
    for (i = 0; i < run.loot.items.length; i++) {
      var r = global.DG.item.add(run.loot.items[i]);
      if (r.kept) { kept++; }
    }
    var n = run.loot.items.length;
    run.loot = { gold: 0, items: [] };
    if (g || n) {
      core.log('💼 노획물 확정 (' + why + ') · 금 ' + core.fmt(g) + ' · 장비 ' + n + '점', 'good');
    }
    return { gold: g, items: n, kept: kept };
  }

  /** 탈출 — 지금까지 얻은 것을 지키고 나온다 */
  function leave() {
    if (!run) { return null; }
    var s = settleLoot('탈출');
    var floor = run.floor;
    core.log('🚪 던전에서 나왔다 · 제' + floor + '층까지', 'info');
    run = null;
    core.emit('dungeon:end', { reason: 'leave', floor: floor, loot: s });
    core.emit('changed');
    core.persist();
    return s;
  }

  /**
   * 결사(決死) — 원작의 하드코어.
   * 켜면 **쓰러지는 순간 그 프로필이 끝난다.** 켜는 것은 되돌릴 수 없다 —
   * 되돌릴 수 있으면 그건 하드코어가 아니다.
   */
  var WAYPOINT_EVERY = 5;

  /** 밟은 역참 중 가장 깊은 곳 */
  function waypoint() { return dstate().waypoint || 0; }

  function markWaypoint(floor) {
    var d = dstate();
    if ((d.waypoint || 0) >= floor) { return false; }
    d.waypoint = floor;
    sfx('waypoint');
    core.log('🪜 역참 · 제' + floor + '층 — 다음부터 여기서 시작할 수 있다', 'good');
    core.emit('changed');
    return true;
  }

  function hardcore() { return !!(core.save.dungeon && core.save.dungeon.hardcore); }

  function setHardcore() {
    dstate().hardcore = true;
    core.log('☠️ 결사(決死) — 이제 쓰러지면 이 판이 끝난다', 'bad');
    core.emit('changed');
    return true;
  }

  function die() {
    /* 난입(§5.5) 사망은 결사·유품과 다른 결이다 — "층" 이 진짜가 아니라서
       (floor 는 적 배율용 대역값이다) 유품 층 번호가 엉뚱하게 겹칠 수
       있다. 최고 생존 기록만 남기고 간단히 끝낸다. */
    /* 시련(§5.11)은 죽어도 안 끝난다 — 시계만 깎인다 */
    if (run.trial) { reviveTrial(); return; }
    if (run.horde) { dieHorde(); return; }
    /* 부적 던전(§5.3) 사망도 같은 이유(floor 대역값)로 결사·유품과 안
       엮인다 — 실패로 끝내고 부적은 이미 굴혈에서 소모됐으니 그걸로 끝. */
    if (run.nightmare) { dieNightmare(); return; }
    var lostGold = Math.round(run.loot.gold), lostItems = run.loot.items.length;
    var lostItemsArr = run.loot.items.slice();
    var floor = run.floor, where = { floor: floor, room: run.roomIdx || 0, rooms: run.roomTotal || 0, lastHit: run.lastHit || null };   // W-0102 사망 카드
    dstate().deaths = (dstate().deaths || 0) + 1;
    core.log('💀 제' + floor + '층에서 쓰러졌다 — 노획물 소실 (금 ' +
      core.fmt(lostGold) + ' · 장비 ' + lostItems + '점)', 'bad');
    run = null;
    core.emit('dungeon:end', { reason: 'dead', floor: floor, lost: { gold: lostGold, items: lostItems }, where: where, hardcore: hardcore() });
    /* 결사(決死) — 원작의 하드코어. 쓰러지면 그 판이 끝난다. 유품도 없다 —
       하드코어는 되돌릴 길이 아예 없어야 한다(§5.2). */
    if (hardcore()) {
      dstate().fallen = { floor: floor, at: Date.now() };
      core.log('☠️ 결사 — 제' + floor + '층에서 스러졌다. 이 판은 여기까지다', 'bad');
      core.emit('toast', '☠️ 결사 — 이 판이 끝났습니다 (제' + floor + '층)');
      core.emit('dungeon:fallen', floor);
      core.persist();
      return;
    }
    /* 유품(§5.2) — 잃은 노획물이 그 층에 남는다. 회수 전에 다시 죽으면
       옛 유품은 사라지고 새 것만 남는다(덮어쓰기, 1개만 유지). */
    if (lostGold > 0 || lostItemsArr.length) {
      dstate().grave = { floor: floor, gold: lostGold, items: lostItemsArr, at: Date.now() };
    }
    core.emit('toast', '💀 제' + floor + '층에서 패퇴 — 노획물을 잃었습니다');
    core.emit('changed');
    core.persist();
  }

  /** 난입(§5.5) 전용 사망 — 결사·유품과 안 엮인다(die() 위 주석). 지금까지
   *  버틴 초가 기록에 남는다(생존 완주와 같은 `dstate().horde.best`). */
  function dieHorde() {
    var secs = Math.round(run.hordeT || 0);
    var lostGold = Math.round(run.loot.gold), lostItems = run.loot.items.length;
    dstate().deaths = (dstate().deaths || 0) + 1;
    var hs = dstate().horde || (dstate().horde = { best: 0, runs: 0 });
    if (secs > (hs.best || 0)) { hs.best = secs; }
    core.log('💀 난입 · ' + secs + '초 생존 후 쓰러졌다 (금 ' +
      core.fmt(lostGold) + ' · 장비 ' + lostItems + '점)', 'bad');
    run = null;
    core.emit('dungeon:end', { reason: 'dead', floor: 0,
      horde: { secs: secs }, lost: { gold: lostGold, items: lostItems } });
    core.emit('toast', '💀 난입 · ' + secs + '초 생존');
    core.emit('changed');
    core.persist();
  }

  /** 부적 던전(§5.3) 전용 사망 — 부적은 이미 굴혈에서 소모됐으니 되돌려
   *  주지 않는다(원작 소모품 규칙 그대로). `dstate().nmBest`는 완주만
   *  올린다(die는 실패지 기록이 아니다). */
  function dieNightmare() {
    var tier = run.nightmare.tier;
    var lostGold = Math.round(run.loot.gold), lostItems = run.loot.items.length;
    dstate().deaths = (dstate().deaths || 0) + 1;
    core.log('💀 부적 던전 · 티어 ' + tier + '에서 쓰러졌다 (금 ' +
      core.fmt(lostGold) + ' · 장비 ' + lostItems + '점)', 'bad');
    run = null;
    core.emit('dungeon:end', { reason: 'dead', floor: 0,
      nightmare: { tier: tier }, lost: { gold: lostGold, items: lostItems } });
    core.emit('toast', '💀 부적 던전 실패 · 티어 ' + tier);
    core.emit('changed');
    core.persist();
  }

  /* ── 유품(遺品, §5.2) ─────────────────────────────────────
   * 죽으면 노획물이 그 층 표식으로 남고 가방엔 안 들어온다. 다음에 그
   * 층에 닿으면 표식을 밟아 되찾는다 — 금은 100%, 장비는 3점까지 고른다.
   */
  var GRAVE_ITEM_MAX = 3;

  /** 지금 유품이 있는 층인가(층 안 조회용) */
  function graveOf() { return dstate().grave || null; }

  /** 표식을 밟았다 — 고를 카드를 연다 */
  function openGrave() {
    var g = dstate().grave;
    if (!run || !g || g.floor !== run.floor) { return null; }
    run.graveChoice = { gold: g.gold, items: g.items.slice(), picked: [] };
    return run.graveChoice;
  }

  /** 회수할 장비를 고르거나 뺀다 — 상한 3(GRAVE_ITEM_MAX) */
  function toggleGraveItem(idx) {
    if (!run || !run.graveChoice || !run.graveChoice.items[idx]) { return false; }
    var picked = run.graveChoice.picked, at = picked.indexOf(idx);
    if (at >= 0) { picked.splice(at, 1); return true; }
    if (picked.length >= GRAVE_ITEM_MAX) { return false; }
    picked.push(idx);
    return true;
  }

  /** 고른 대로 확정한다 — 금 100%, 장비는 고른 만큼만(나머지 소멸) */
  function claimGrave() {
    if (!run || !run.graveChoice) { return null; }
    var gc = run.graveChoice, IT = global.DG.item, kept = 0, i;
    core.save.player.gold += gc.gold;
    for (i = 0; i < gc.picked.length; i++) {
      var it = gc.items[gc.picked[i]];
      if (it && IT.add(it).kept) { kept++; }
    }
    run.graveChoice = null;
    dstate().grave = null;
    core.log('🪦 유품 회수 · 금 ' + core.fmt(gc.gold) + ' · 장비 ' + kept + '점', 'good');
    core.emit('toast', '🪦 유품을 되찾았다');
    core.emit('changed');
    core.persist();
    return { gold: gc.gold, items: kept };
  }

  /* ── 피해 · 회복 ─────────────────────────────────────── */

  function healBy(amount) {
    if (!run) { return; }
    run.hp = Math.min(run.hpMax, run.hp + Math.round(amount));
  }

  /**
   * 단약(丹藥)이 부르는 창구 — 체력·기력을 최대치의 몇 % 만큼 채운다.
   * 체력과 기력의 정본은 이 파일이라, 물약이 run 을 직접 만지지 않게 여기로 모은다.
   * **이미 가득이면 false** 를 돌려준다 — 그러면 potion.js 가 그 알을 안 쓴다.
   */
  function refill(hpPct, mpPct, text, color) {
    if (!run) { return false; }
    var did = false;
    if (hpPct && run.hp < run.hpMax) { healBy(run.hpMax * hpPct / 100); did = true; }
    if (mpPct && run.mp < run.mpMax) {
      run.mp = Math.min(run.mpMax, run.mp + run.mpMax * mpPct / 100);
      did = true;
    }
    if (did && text) {
      fx.push({ t: 'get', x: run.player.x, y: run.player.y,
                text: text, color: color || '#c0392b', life: 0.9 });
    }
    return did;
  }

  /**
   * @param el 이 공격의 결 (없으면 물리). 갑주에 박은 보석이 그 결을 막는다 —
   *           **원작에서 갑옷에 젬을 박는 이유가 바로 이것**이다.
   */
  function hurtPlayer(amount, el, src, how) {   // src·how — 마지막 피해(사망 카드 W-0102): 적 개체·이름, 무슨 공격
    if (!run) { return; }
    if (run.player.invuln > 0) { return; }        // 돌진 중에는 맞지 않는다
    amount = amount * (1 - boonVal('guardPct') / 100);
    if (el && el !== 'phys') { amount *= 1 - elemResOf(el) / 100; }
    if (nmHasMod('glass')) { amount *= 1.5; }   // 부적 '유리대포' 변형자(§5.3) — 받는 피해도 는다
    amount = Math.max(1, amount);
    run.hp -= amount; run.lastHit = { who: src ? (typeof src === 'string' ? src : enemyName(src)) : '', how: how || (global.DG.grace ? global.DG.grace.howOf(el) : '') };
    run.player.hurt = 0.28;
    if (global.DG.mount && global.DG.mount.onHurt) { global.DG.mount.onHurt(); }      // 탈것 — 맞으면 내린다
    fx.push({ t: 'hit', x: run.player.x, y: run.player.y, v: Math.round(amount),
              life: 0.7, foe: true, el: el && el !== 'phys' ? el : null });
    sfx('hurt');
    /* 맞으면 콤보가 끊긴다 — 안 맞고 계속 때려야 이어지는 긴장감(축2 손맛) */
    run.combo = 0; run.comboT = 0;
    if (run.hp <= 0) { die(); }
  }

  /**
   * 보스 패턴(PLAN 15절) — 2026-09-05까지는 보스 열 종 전부가 스탯만 다른
   * 같은 "강타" 하나였다(무기·색·이름만 다르고 공격은 하나). `data-enemy.js`
   * `BOSSES`가 이미 갖고 있던 `look.weapon`(club·axe·sword·spear·halberd)으로
   * 넷을 가른다 — 새 필드 없이 기존 표만 읽는다. 예고(telegraph) 뒤 터지는
   * 공통 리듬은 그대로 두고, 무기마다 판정 모양·박자만 바꿨다. `en.slamWarn`·
   * `en.slamCd`는 이제 "강타 전용"이 아니라 **이 보스가 쓰는 패턴 하나의
   * 공용 타이머**다(보스 하나는 평생 무기 하나만 쓰므로 겹칠 일이 없다).
   */
  function bossPattern(en, p, ed, dt) {
    /* 세계 보스(§5.4) 무기 부위가 부서지면 이 패턴 자체가 안 나온다
       ("부위 파괴 시 그 패턴 봉인", PLAN 원문) — `en.ref.look`은 data-enemy.js
       의 공용 정의라 여기서 지우면 그 보스종 전체가 오염된다, 그래서 이
       개체 하나만의 플래그(`wbWeaponBroken`)로 우회한다. */
    if (en.wbWeaponBroken) { return; }
    var lookW = en.ref && en.ref.look && en.ref.look.weapon;
    if (lookW === 'axe') { return bossCharge(en, p, dt); }
    if (lookW === 'spear' || lookW === 'halberd') { return bossThrust(en, p, dt); }
    if (lookW === 'sword') { return bossFlurry(en, p, dt); }
    return bossSlam(en, p, dt);   // club·그 외 — 기존 강타(원래 유일했던 패턴)
  }

  /** club — 강타: 제자리 원형 AOE, 큰 배율 한 방(기존 그대로, 이름만 함수로 뺐다) */
  function bossSlam(en, p, dt) {
    if (en.slamWarn > 0) {
      en.slamWarn -= dt;
      if (en.slamWarn <= 0) {
        if (dist(en, p) < SLAM_RANGE) {
          hurtPlayer(en.dmg * SLAM_MUL, en.ref && en.ref.atkEl, en, '강타');
          if (!run) { return; }
        }
        fx.push({ t: 'pop', x: en.x, y: en.y, life: 0.5, boss: true });
        en.slamCd = 6 + Math.random() * 2;
      }
    } else {
      en.slamCd = (en.slamCd === undefined ? 4 : en.slamCd) - dt;
      if (en.slamCd <= 0) {
        en.slamWarn = SLAM_WARN;
        fx.push({ t: 'whirl', x: en.x, y: en.y, r: SLAM_RANGE, life: SLAM_WARN,
          el: 'fire', color: '#ff6a3a' });
      }
    }
  }

  /** axe — 돌진: 예고가 끝나는 순간 플레이어 쪽으로 순간 다가선다(간격을
   *  확 좁힌다) — 제자리에서 터지는 강타와 달리 물러서도 한 번은 따라붙는다,
   *  대신 반경은 강타보다 훨씬 좁다(붙어야만 맞는다) */
  function bossCharge(en, p, dt) {
    if (en.slamWarn > 0) {
      en.slamWarn -= dt;
      if (en.slamWarn <= 0) {
        var cd = dist(en, p) || 1;
        var step = Math.min(CHARGE_STEP, Math.max(0, cd - en.r - P_R));
        en.x += (p.x - en.x) / cd * step;
        en.y += (p.y - en.y) / cd * step;
        if (dist(en, p) < en.r + P_R + 14) {
          hurtPlayer(en.dmg * CHARGE_MUL, en.ref && en.ref.atkEl, en, '돌진');
          if (!run) { return; }
        }
        fx.push({ t: 'burst', x: en.x, y: en.y, life: 0.4, color: '#ffb43a' });
        en.slamCd = 5 + Math.random() * 2;
      }
    } else {
      en.slamCd = (en.slamCd === undefined ? 3.5 : en.slamCd) - dt;
      if (en.slamCd <= 0) {
        en.slamWarn = CHARGE_WARN;
        fx.push({ t: 'ring', x: en.x, y: en.y, r: 26, life: CHARGE_WARN, color: '#ffb43a' });
      }
    }
  }

  /** spear·halberd — 관통: 예고가 뜨는 순간 방향을 고정해 두고(플레이어가
   *  그 사이 옆으로 피할 수 있게), 끝나면 그 방향 정면 부채꼴로 사거리가
   *  훨씬 긴 한 방을 찌른다 — 제자리 AOE가 아니라 **방향이 있는** 공격 */
  function bossThrust(en, p, dt) {
    if (en.slamWarn > 0) {
      en.slamWarn -= dt;
      if (en.slamWarn <= 0) {
        var fdx = en.faceX || 1, fdy = en.faceY || 0;
        var tdx = p.x - en.x, tdy = p.y - en.y;
        var td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        if (td <= THRUST_RANGE && (tdx * fdx + tdy * fdy) / td >= Math.cos(THRUST_HALF)) {
          hurtPlayer(en.dmg * THRUST_MUL, en.ref && en.ref.atkEl, en, '찌르기');
          if (!run) { return; }
        }
        fx.push({ t: 'slash', x: en.x + fdx * THRUST_RANGE * 0.5,
          y: en.y + fdy * THRUST_RANGE * 0.5, life: 0.35, color: '#8ad0ff' });
        en.slamCd = 5 + Math.random() * 2;
      }
    } else {
      en.slamCd = (en.slamCd === undefined ? 4 : en.slamCd) - dt;
      if (en.slamCd <= 0) {
        var fl0 = dist(en, p) || 1;
        en.faceX = (p.x - en.x) / fl0; en.faceY = (p.y - en.y) / fl0;
        en.slamWarn = THRUST_WARN;
        fx.push({ t: 'ring', x: en.x + en.faceX * THRUST_RANGE * 0.5,
          y: en.y + en.faceY * THRUST_RANGE * 0.5, r: 46, life: THRUST_WARN, color: '#8ad0ff' });
      }
    }
  }

  /** sword — 연환격: 예고 뒤 짧은 간격으로 세 번 벤다(누적 배율은 강타 급이지만
   *  박자가 다르다 — 회피 타이밍을 한 번이 아니라 여러 번 요구한다) */
  function bossFlurry(en, p, dt) {
    if (en.flurryLeft > 0) {
      en.flurryT -= dt;
      if (en.flurryT <= 0) {
        if (dist(en, p) < en.r + P_R + 10) {
          hurtPlayer(en.dmg * FLURRY_MUL, en.ref && en.ref.atkEl, en, '연격');
          if (!run) { return; }
        }
        fx.push({ t: 'slash', x: p.x, y: p.y, life: 0.3, color: '#ff7a7a' });
        en.flurryLeft--;
        en.flurryT = FLURRY_GAP;
      }
    } else if (en.slamWarn > 0) {
      en.slamWarn -= dt;
      if (en.slamWarn <= 0) {
        en.flurryLeft = FLURRY_HITS;
        en.flurryT = 0;
        en.slamCd = 6 + Math.random() * 2;
      }
    } else {
      en.slamCd = (en.slamCd === undefined ? 4 : en.slamCd) - dt;
      if (en.slamCd <= 0) {
        en.slamWarn = FLURRY_WARN;
        fx.push({ t: 'whirl', x: en.x, y: en.y, r: en.r + P_R + 20, life: FLURRY_WARN, color: '#ff7a7a' });
      }
    }
  }

  /* ── 진행 ─────────────────────────────────────────────── */

  function setInput(dx, dy) { input.dx = dx; input.dy = dy; if (dx || dy) { target = null; } }
  function moveTo(x, y) { target = { x: x, y: y }; }

