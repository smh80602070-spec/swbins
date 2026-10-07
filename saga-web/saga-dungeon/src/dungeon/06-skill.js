  /* ── 투장(套裝) 전용 무예 — 2026-09-10 ───────────────────────
   * "방어구 세트마다 특색 스킬"(사용자). 배우지 않는다 — 무기·갑주·부적
   * 세 점을 **선두가** 다 걸쳐야 손에 잡힌다(item.js의 setSkillFor).
   * 강공격·회피처럼 쿨다운만 있는 기본기 자리에 셋째로 놓는다 — MP도
   * 배움도 안 쓴다, 세트를 맞춘 것 자체가 값이다. 모양 실행은 슬롯형
   * 무예와 같은 applyShapeSkill 을 그대로 쓴다(위 castSkill 참고). */

  /** 지금 손에 잡히는 투장 무예 — 없으면 null. 화면(status())도 이걸 읽는다 */
  function activeSetSkill() {
    var it = global.DG.item, id = leadId();
    return (it && id) ? it.setSkillFor(id) : null;
  }

  function castSetSkill() {
    if (!run || run.choice) { return false; }
    var got = activeSetSkill();
    if (!got) { return false; }
    var sk = got.sk, p = run.player;
    if (p.setSkCd > 0 || p.dash) { return false; }
    p.setSkCd = sk.cd;
    p.atkAnim = castPoseSecOf(sk);
    p.castAnim = !MELEE_SHAPES[sk.shape];
    sfx('setsk');
    applyShapeSkill(sk, sk.v);
    core.emit('dungeon:skill', 'set:' + got.set.key);
    return true;
  }

  /* ── 인물별 서명 무예 — 2026-09-11 ────────────────────────────
   * "캐릭터마다 스킬이 달라야 해"(사용자). 투장 전용 무예와 계약이
   * 완전히 같다 — 배우지 않는다, MP·슬롯 안 씀, v 는 고정값. 다른 점은
   * 트리거 하나뿐: 장비 3점이 아니라 **이 인물이 선두**면 상시 켜진다.
   * 모양 실행은 같은 applyShapeSkill 을 그대로 쓴다. */

  /** 지금 선두의 서명 무예 — 파일럿 밖 인물이면 null */
  function activeSigSkill() {
    var HS = global.DG.heroSkillData, id = leadId();
    return (HS && id) ? HS.sigOf(id) : null;
  }

  /** §5.1 인물 축 — 그림자 서명(hr_shadow_l). 평타가 맞을 때마다 확률로
   *  부대 3~5번째(0-index 2~4) 인물의 서명 무예를 얹는다. 파일럿 무예처럼
   *  쿨다운·MP 를 안 쓴다 — "얹힌다"는 표현 그대로 평타에 곁들이는 보너스. */
  function tryShadowSig() {
    var pct = boonVal('shadowSigPct');
    if (!pct || Math.random() * 100 >= pct) { return; }
    var HS = global.DG.heroSkillData, party = core.save.party;
    if (!HS) { return; }
    for (var i = 2; i <= 4 && i < party.length; i++) {
      var sk = HS.sigOf(party[i]);
      if (sk) { applyShapeSkill(sk, sk.v); return; }
    }
  }

  function castSigSkill() {
    if (!run || run.choice) { return false; }
    var sk = activeSigSkill();
    if (!sk) { return false; }
    var p = run.player;
    if (p.sigSkCd > 0 || p.dash) { return false; }
    /* §5.1 인물 축 — 심법(쿨감 sigCdPct·위력 sigDmgPct). 위력 축복을 가졌으면
       "부대 전원 흔들림·플래시"를 기존 'ring' 연출로 대신한다(카메라 흔들림
       자체는 dungeon-view.js 안 로컬 변수라 여기서 못 건드린다 — 단순화). */
    p.sigSkCd = sk.cd * (1 - boonVal('sigCdPct') / 100);
    p.atkAnim = castPoseSecOf(sk);
    p.castAnim = !MELEE_SHAPES[sk.shape];
    sfx('setsk');                          // 새 효과음 자산 없이 투장 무예 것을 빌린다
    if (boonVal('sigDmgPct') > 0) { fx.push({ t: 'ring', x: p.x, y: p.y, life: 0.6 }); }
    applyShapeSkill(sk, sk.v * (1 + boonVal('sigDmgPct') / 100));
    if (!run) { return true; }
    run.comboT = ALLY_COMBO_WIN;           // §5.17 — 이 창 안에 동행 서명이 나가면 합격
    core.emit('dungeon:skill', 'sig:' + leadId());
    return true;
  }

  /**
   * 포획(捕獲) — PLAN 34절 "도감을 콘텐츠 수집 시스템으로". `data.js` 의
   * PETS 표에는 진작부터 `catchBase`(잡힐 확률) 가 붙어 있었는데, 이걸 읽어
   * `core.save.dex.pets` 에 채워 넣는 자리가 어디에도 없었다 — 그래서 펫
   * 도감은 늘 비어 있었고 `ui.js` `petOptions()` 의 펫 장착 드롭다운도
   * "펫 없음" 만 나오는, 있는데 닿을 수 없는 기능이었다. 짐승형 몬스터를
   * 잡으면 동물(beast) 펫이, **보스**를 잡으면 신수(divine) 펫이 잡힌다
   * (신수는 "3층마다" 인물이 합류하는 것과 같은 리듬 — `DD.isBossFloor`).
   *
   * **`Math.random()` 을 안 쓴다.** `kill()` 은 자가진단의 씨앗 기반 시나리오
   * 대부분이 지나는 아주 흔한 길목이라, 여기서 한 번이라도 더 뽑으면 그
   * 뒤에 오는 무관한 항목들의 수열이 통째로 밀린다 — `core.hash2` 자체가
   * 바로 이 함정(무기 원소 피해 항목이 넘어졌다)을 밟고 만들어진 함수다
   * (이 파일 위쪽 주석 참고). 그래서 여기도 `run.floor`·`run.kills`(이미
   * 세고 있는 누적치)로만 정해지는 순수 해시를 쓴다 — 실제 플레이에서는
   * 여전히 매 킬마다 다르게 보이지만, 진단의 Math.random 수열은 안 건드린다.
   */
  function tryCatchPet(e) {
    var PD = global.DG.data;
    if (!PD || !PD.pets || !e.ref) { return; }
    var wantKind = e.boss ? 'divine' : (e.ref.kind === 'beast' ? 'beast' : null);
    if (!wantKind) { return; }
    var pool = PD.pets.filter(function (p) { return p.kind === wantKind; });
    if (!pool.length) { return; }
    var seedBase = (run.floor || 0) * 9973 + run.kills;
    var p = pool[Math.floor(core.hash2(seedBase, 4001) * pool.length)];
    if (core.hash2(seedBase, 4002) >= (p.catchBase || 0.3)) { return; }
    var dex = core.save.dex.pets;
    if (dex[p.id]) {
      dex[p.id].count += 1;
    } else {
      dex[p.id] = { count: 1, firstAt: Date.now() };
      core.gainFeat(p.rarity * 6, '포획');
      core.log('🐾 ' + p.name + ' 을(를) 길들였다', 'good');
      core.emit('toast', '🐾 ' + p.name + ' 포획!');
      core.emit('dex:new', { cat: 'pets', id: p.id });
    }
    core.emit('changed');
  }

  /**
   * 지역(地域) 도감 — PLAN 34절 "수집: ... 지역". 층 테마 여섯 가지(고분·폐성·
   * 산채·수궁·지옥문·천계, `data-dungeon.js` THEMES)에 처음 닿으면 등록한다.
   * 펫 포획과 달리 **굴리는 값이 없다** — 그 층에 들어섰다는 사실 하나로
   * 정해지는 순수 부기(附記)라 `Math.random()`도 `core.hash2`도 필요 없다.
   * 자가진단 시드에 영향이 전혀 없다.
   */
  function registerRegion(floor) {
    var name = DD.themeOf(floor).name;
    if (core.save.dex.regions[name]) { return; }
    core.save.dex.regions[name] = true;
    core.log('🗺️ 지역 발견 · ' + name, 'good');
    core.emit('toast', '🗺️ 지역 발견 · ' + name);
    core.emit('dex:new', { cat: 'regions', id: name });
  }

  function dropGold(room, x, y, mul) {
    var g = Math.round(5 * Math.pow(1.19, run.floor - 1) * mul * mode().gold *
      (1 + boonVal('goldPct') / 100) * (1 + core.effect('goldPct') / 100) * nmLootMul() * RG());
    room.drops.push({ kind: 'gold', gold: g, x: jitter(x), y: jitter(y) });
  }

  function dropItem(room, x, y, bias) {
    /* 부적 보상 배율(§5.3 nmLootMul)은 "물건 값" 보다 "등급 운"으로 더
       느껴져서(수·비율이 아니라 하나짜리 드랍이라) bias 를 올리는 쪽으로
       옮겨 실었다 — 배율 1.5배 = bias +20 정도로 어림했다(티어 1당 대략
       그 정도 확률 차가 나는 값, rollTier 의 find 가중과 같은 형태). */
    var b = (bias || 0) + mode().bias + Math.round((nmLootMul() - 1) * 40);
    var it = global.DG.item.roll(run.floor + 1, { bias: b });
    room.drops.push({ kind: 'item', item: it, x: jitter(x), y: jitter(y) });
    /* 떨어지는 순간에 등급이 들린다(§5.9, 원작 3편의 전설 낙하음) — 보물·전설만 */
    if ((it.tier || 0) >= 3 || it.uniq) { sfx(it.tier >= 4 || it.uniq ? 'uniq' : 'drop3'); }
  }

  /**
   * 세공 재료 — 보석 · 부문(符文) · 주옥(珠玉).
   * 부문은 층이 깊어야 나온다(원작에서 높은 룬이 깊은 곳에서만 나오는 그 규칙).
   * 주옥은 셋 중 가장 드물고 **4층부터** 나온다 — 굴러 나오는 물건이라
   * 처음부터 쏟아지면 보석을 박을 까닭이 없어진다.
   */
  function dropMat(room, x, y, bias) {
    var GD = global.DG.gemData;
    if (!GD) { return; }
    var floor = run.floor;
    if (GD.rollJewel && floor >= 4) {
      var jewelChance = Math.min(0.10, 0.02 + floor * 0.004) +
        ((bias || 0) + mode().bias) / 600;
      if (Math.random() < jewelChance) {
        room.drops.push({ kind: 'mat', mat: { kind: 'jewel', j: GD.rollJewel(floor + 1) },
                          x: jitter(x), y: jitter(y) });
        return;
      }
    }
    var runeChance = 0.22 + ((bias || 0) + mode().bias) / 200;
    if (Math.random() < runeChance) {
      /* 부문 — 층이 감당하는 등급까지만 */
      var maxTier = core.clamp(1 + Math.floor(floor / 4), 1, 5);
      var pool = GD.RUNES.filter(function (r) { return r.tier <= maxTier; });
      if (pool.length) {
        var wsum = 0, i;
        for (i = 0; i < pool.length; i++) { wsum += 1 / pool[i].tier; }
        var pick = Math.random() * wsum, chosen = pool[0];
        for (i = 0; i < pool.length; i++) {
          pick -= 1 / pool[i].tier;
          if (pick <= 0) { chosen = pool[i]; break; }
        }
        room.drops.push({ kind: 'mat', mat: { kind: 'rune', key: chosen.key },
                          x: jitter(x), y: jitter(y) });
        return;
      }
    }
    /* 보석 — 등급도 층을 탄다 */
    var gem = core.pick(GD.GEMS);
    var g = 0, cap = core.clamp(Math.floor(floor / 3), 0, 4);
    while (g < cap && Math.random() < 0.45) { g++; }
    room.drops.push({ kind: 'mat', mat: { kind: 'gem', key: gem.key, g: g },
                      x: jitter(x), y: jitter(y) });
  }

  function dropPotion(room, x, y) {
    var P = global.DG.potion;
    if (!P) { return; }
    room.drops.push({ kind: 'potion', p: P.rollDrop(run.floor), x: jitter(x), y: jitter(y) });
  }

  function jitter(v) { return v + (Math.random() - 0.5) * 26; }

  function take(dp) {
    if (dp.kind === 'gold') {
      /* 마을(`run.town`)은 탈출해야 정산되는 노획물 개념이 없다 — 이미 안전지대에
         있으므로 주운 즉시 지갑으로 넣는다(재료·물약·감정서와 같은 대접) */
      if (run.town) { core.save.player.gold += dp.gold; }
      else { run.loot.gold += dp.gold; }
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: '+' + core.fmt(dp.gold), life: 0.8, k: 'gold' });
      sfx('gold');
    } else if (dp.kind === 'scroll') {
      /* 감정서도 재료처럼 **바로 주머니로** — 노획물 정산을 타지 않는다 */
      global.DG.item.addScroll(1);
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: '감정서', color: '#8ec7ff', life: 1.0 });
      sfx('scroll');
    } else if (dp.kind === 'potion') {
      var P = global.DG.potion;
      if (!P) { return false; }
      var pr = P.add(dp.p.kind, dp.p.g);
      if (!pr.ok) { return false; }               // 벨트가 찼다 — 바닥에 남는다
      var pl = P.label(dp.p.kind, dp.p.g);
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: pl,
                color: P.kindOf(dp.p.kind).color, life: 1.0 });
      sfx('coin');
    } else if (dp.kind === 'mat') {
      /* 재료는 즉시 주머니로 — 노획물 정산을 타지 않는다(죽어도 잃지 않는다).
         원작에서도 룬·젬은 인벤에 바로 들어간다 */
      var GD = global.DG.gemData;
      var m = dp.mat, label, color;
      if (m.kind === 'jewel') {
        /* 주옥은 낱개라 자리가 없으면 **바닥에 남는다**(요대와 같은 규칙) */
        var jr = global.DG.item.addJewel(m.j);
        if (!jr.ok) { return false; }
        m.j = jr.jewel;                       // id 가 붙은 것으로 갈아 둔다
        label = GD.jewelName(jr.jewel);
        color = '#f07ac0';
      } else {
        global.DG.item.addMat(m.kind, m.key, m.g || 0, 1);
        label = m.kind === 'gem'
          ? (GD.grade(m.g).name + ' ' + GD.gemByKey(m.key).name)
          : (GD.runeByKey(m.key).glyph + '(' + GD.runeByKey(m.key).name + ')');
        color = m.kind === 'rune' ? '#f0a53a' : GD.grade(m.g).color;
      }
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: label, color: color, life: 1.1 });
      sfx(m.kind === 'gem' ? 'mat' : (m.kind === 'rune' ? 'rune' : 'jewel'));
      if (m.kind === 'rune') { core.emit('toast', '📜 부문 ' + label); }
      if (m.kind === 'jewel') { core.emit('toast', '◈ 주옥 · ' + label); }
    } else {
      run.loot.items.push(dp.item);
      var t = global.DG.item.tierOf(dp.item);
      fx.push({ t: 'get', x: dp.x, y: dp.y, text: global.DG.item.name(dp.item), color: t.color, life: 1.1, rar: global.DG.vfx2d ? global.DG.vfx2d.rarOfTier(t.key) : 0 });
      /* 고유가 떨어지면 따로 알린다 — 원작에서 유니크는 **소리부터** 다르다.
         2026-08-26 부터 여기도 실제로 소리가 다르다(sfx.js 의 'uniq' — 그 종소리) */
      var uq2 = global.DG.item.uniqOf(dp.item);
      var S2 = global.DG.sfx;
      if (S2) { S2.play(S2.dropCue(dp.item.tier, uq2)); }
      if (uq2) { core.emit('toast', '⭐ 고유 · ' + uq2.name); }
      else if (dp.item.tier >= 2) {
        core.emit('toast', '🎁 ' + t.name + ' · ' + global.DG.item.name(dp.item));
      }
    }
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) || 0.0001;
  }

  /* ── 스킬 ─────────────────────────────────────────────── */

  /**
   * 스킬을 쓴다.
   * @param i 0 회전참 · 1 돌진 · 2 기공파 · 3 사기
   * @return true = 시전됨
   */
  /* ── 무예(武藝) — 원작의 스킬 ───────────────────────────────
   * 직업마다 아홉씩, 다섯 직업이면 마흔다섯이다. 마흔다섯을 따로 구현하면
   * 손을 못 댄다 — 원작의 스킬도 실은 **몇 가지 모양**이 원소·수치만 바꿔 가며
   * 되풀이된다. 그래서 **모양 아홉**만 여기 두고, 표(data-skill.js)가 값을 끼운다.
   *
   * 어느 무예를 쓰느냐는 **선두**가 정한다. 동행을 바꾸면 손이 통째로 바뀐다 —
   * 그게 원작에서 직업을 고르는 감각이다.
   */

  /** 네 칸에 걸린 무예 (없으면 빈 칸) */
  function slotSkills() {
    var skl = global.DG.skill, id = leadId();
    if (!skl || !id) { return [null, null, null, null]; }
    return skl.equipped(id);
  }

  /** 선두가 이 무예에 걸어 둔 비결 — 없으면 그대로(배수 1) */
  function secretMod(sk) {
    var SC = global.DG.secret;
    if (!SC || !sk) { return { sk: sk, dmg: 1, cost: 1, cd: 1, drain: 0, key: null }; }
    var m = SC.modify(sk, SC.of(leadId(), sk.key));
    /* 비전(§5.10) — 선두가 입은 전설이 이 비결을 키우면 위력 ×1.6 · 부르기는 수 +1 */
    var b = m.key && SC.boostOf ? SC.boostOf(leadId(), m.key) : 1;
    if (b > 1) {
      m.dmg *= b; m.boost = b;
      if (sk.shape === 'summon') { m.summonAdd = (m.summonAdd || 0) + 1; }
    }
    return m;
  }

  /** 무예의 위력 배수 — '집중·주술' 같은 상시가 여기 얹힌다 */
  function skillMul() { return 1 + boonVal('skillPct') / 100; }

  /** 몸으로 베는 모양 — 그 밖은 다 '시전' 자세(p.castAnim)로 간다.
   *  3D·2D 렌더가 p.castAnim 을 보고 attack/interaction 애니메이션을 가른다. */
  var MELEE_SHAPES = { swing: 1, dash: 1 };

  /** 무예 모양마다 자세가 남는 길이 — 평타(0.22)·강공격(0.38)과 같은 결로,
   *  기력을 많이 먹는 무예일수록(대략 sec·cd로 짐작되는 "큰 기술")
   *  조금 더 오래 자세가 남는다. 상한을 둬 시전 중 다음 입력이 너무 안
   *  먹진 않게 한다. */
  function castPoseSecOf(sk) {
    if (sk.shape === 'passive') { return 0; }
    return Math.min(0.5, 0.24 + (sk.cost || 20) / 160);
  }

  function castSkill(i) {
    if (!run || run.choice) { return false; }
    var got = slotSkills()[i];
    if (!got) { return false; }
    var sk = got.sk, rank = got.rank;
    var SDx = global.DG.skillData;
    var p = run.player;
    /* 비결(§5.9, secret.js) — 무예 하나의 쓰임을 바꾼다(위력·기력·재냉각·결·범위·흡수) */
    var mod = secretMod(sk);
    var cost = Math.round(sk.cost * mod.cost);
    if (p.cds[i] > 0 || run.mp < cost || p.dash) { return false; }
    run.mp -= cost;
    p.cds[i] = sk.cd * mod.cd;
    p.atkAnim = castPoseSecOf(sk);
    p.castAnim = !MELEE_SHAPES[sk.shape];
    var sv = SDx.valueAt(sk, rank);
    sv = sk.shape === 'summon' ? sv + (mod.summonAdd || 0) : sv * mod.dmg;
    if (mod.drain) { addBuff('drainPct', mod.drain, mod.drainSec); }
    applyShapeSkill(mod.sk, sv);
    core.emit('dungeon:skill', sk.key);
    return true;
  }

  /**
   * 모양(shape)에 값을 끼워 실제 효과를 낸다 — **슬롯형 무예(castSkill)와
   * 투장 전용 무예(castSetSkill)가 이 한 함수를 같이 쓴다.** 코스트·쿨다운·
   * MP 차감은 부른 쪽이 먼저 끝내고 온다 — 여기는 sk.shape 만 본다
   * (data-skill.js 머리말의 "모양 아홉" 설계를 그대로 잇는다).
   */
  function applyShapeSkill(sk, v) {
    var p = run.player, room = run.room, j;

    if (sk.shape === 'swing') {
      /* §5.1 무예 축 — 검세 확장(swingRangePct) */
      var radius = reachOf() * (sk.r || 2.0) * (1 + boonVal('swingRangePct') / 100);
      /* §5.19 2차 원뿔 — `arc`(반각, 라디안)가 있으면 둘레가 아니라 **앞 부채꼴**을 멀리 쓴다.
         방향은 부채꼴 안에 드는 가장 가까운 적 쪽(없으면 마지막 걸음 방향) — 떼를 향해 긋는 한 획 */
      var arc = sk.arc && CONE_ON() ? sk.arc : 0, a0 = 0;
      if (arc) {
        a0 = coneAim(radius);
        pushFanFx(p, a0, arc, radius, sk.el);
      } else {
        fx.push({ t: 'whirl', x: p.x, y: p.y, r: radius, life: 0.3,
          el: sk.el || null, color: sk.el ? elemColorOf(sk.el) : null });
      }
      var wlist = room.enemies.slice();
      for (j = 0; j < wlist.length && run; j++) {
        var we = wlist[j];
        if (we.hp <= 0) { continue; }
        if (dist(p, we) > radius + we.r) { continue; }
        if (arc && !inArc(p, we, a0, arc)) { continue; }
        strike(we, v * skillMul(), sk.kb === undefined ? 20 : sk.kb, sk.el || 'phys');
      }

    } else if (sk.shape === 'nova') {
      /* §5.1 무예 축 — 이중/삼중 파동(novaExtraRing): 링이 한두 번 더 터진다 */
      var nr = (sk.r || 130), novaTimes = 1 + boonVal('novaExtraRing');
      if (sk.pull) { pullIn(sk.pull, sk.el); }   // §5.19 2차 — 먼저 발밑으로 끌어 모은다
      for (var nt = 0; nt < novaTimes; nt++) {
        fx.push({ t: 'ring', x: p.x, y: p.y, life: 0.55,
          el: sk.el || null, color: sk.el ? elemColorOf(sk.el) : null });
        for (j = 0; j < room.enemies.length; j++) {
          var ne = room.enemies[j];
          if (ne.hp <= 0) { continue; }
          if (dist(p, ne) <= nr + ne.r) {
            strike(ne, v * skillMul(), sk.kb || 0, sk.el || 'phys');
          }
        }
      }

    } else if (sk.shape === 'bolt') {
      /* §5.1 무예 축 — 연사(boltShotAdd): 발수가 는다 */
      var bdx = p.dirX || p.facing, bdy = p.dirY || 0;
      var bl = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
      var shots = (sk.shots || 1) + boonVal('boltShotAdd');
      for (j = 0; j < shots; j++) {
        /* 여럿이면 부챗살로 퍼진다 (연사) */
        var ang = Math.atan2(bdy / bl, bdx / bl) +
                  (shots > 1 ? (j - (shots - 1) / 2) * (sk.spread || 0.3) : 0);
        run.shots.push({
          x: p.x, y: p.y - 8, dx: Math.cos(ang), dy: Math.sin(ang),
          spd: 330, life: 1.5, hit: {},
          mul: v * skillMul(), el: sk.el || 'phys', color: elemColorOf(sk.el)
        });
      }

    } else if (sk.shape === 'dash') {
      /* §5.1 무예 축 — 신법 가속(dashInvulnAdd): 무적 시간이 는다 */
      var ddx = p.dirX || p.facing, ddy = p.dirY || 0;
      var dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      p.dash = { t: 0.2 * (sk.far || 1), dx: ddx / dl, dy: ddy / dl, hit: {},
                 mul: v * skillMul(), el: sk.el || 'phys' };
      p.invuln = 0.34 * (sk.far || 1) + boonVal('dashInvulnAdd');

    } else if (sk.shape === 'buff') {
      /* §5.1 무예 축 — 기세 지속(buffDurPct) */
      var buffSec = (sk.sec || 6) * (1 + boonVal('buffDurPct') / 100);
      addBuff(sk.eff, v, buffSec);
      if (sk.eff === 'atkSpdPct') { p.rallyUntil = Date.now() + buffSec * 1000; }
      fx.push({ t: 'ring', x: p.x, y: p.y, life: 0.55 });

    } else if (sk.shape === 'heal') {
      /* §5.1 무예 축 — 치유 증폭(healBonusPct) */
      var healAmt = run.hpMax * v / 100 * (1 + boonVal('healBonusPct') / 100);
      healBy(healAmt);
      fx.push({ t: 'get', x: p.x, y: p.y, text: '+' + Math.round(healAmt),
                color: '#6ea24a', life: 0.9 });

    } else if (sk.shape === 'curse') {
      /* §5.1 무예 축 — 저주 지속(curseDurPct) */
      var cr = sk.r || 130, curseSec = (sk.sec || 5) * (1 + boonVal('curseDurPct') / 100);
      if (sk.pull) { pullIn(sk.pull, null); }    // §5.19 2차 — 끌어 모아 묶는다(느려짐이 무리를 붙잡아 둔다)
      for (j = 0; j < room.enemies.length; j++) {
        var ce = room.enemies[j];
        if (ce.hp <= 0 || dist(p, ce) > cr + ce.r) { continue; }
        ce.slow = Math.max(ce.slow || 0, curseSec);
        ce.slowMul = 0.35;
        ce.hex = { v: v, t: curseSec };               // 받는 피해가 늘어난다
      }
      fx.push({ t: 'ring', x: p.x, y: p.y, life: 0.55 });

    } else if (sk.shape === 'summon') {
      /* §5.1 무예 축 — 분신 증원(summonCountAdd) */
      summon(Math.round(v) + boonVal('summonCountAdd'), sk.sec || 12, sk.str || 1, !!sk.big);

    } else if (sk.shape === 'chain') {
      /* 연환(連環) — 가장 가까운 적을 치고, 아직 안 맞은 적 중 가장 가까운
       * 쪽으로 튀어 또 친다(최대 sk.hops 번). bolt(똑바로 날아간다)·
       * nova(제자리서 터진다)와 달리 **적을 좇아 옮겨 다닌다** — 표적이
       * 흩어져 있을 때 값어치가 는다. 한 번 튈 때마다 12%씩 약해진다.
       * 새 fx 종류를 안 만든다 — nova 가 쓰는 'ring' 을 맞는 자리마다 찍는다. */
      /* §5.1 무예 축 — 연환 확장(chainHopsAdd) */
      var hops = (sk.hops || 3) + boonVal('chainHopsAdd'), chainR = sk.r || 260, hit = [], cur = null, bd = 1e9, ci;
      for (j = 0; j < room.enemies.length; j++) {
        ci = room.enemies[j];
        if (ci.hp <= 0) { continue; }
        var d0 = dist(p, ci);
        if (d0 < bd) { bd = d0; cur = ci; }
      }
      for (j = 0; cur && j < hops; j++) {
        strike(cur, v * skillMul() * (1 - j * 0.12), sk.kb || 0, sk.el || 'phys');
        fx.push({ t: 'ring', x: cur.x, y: cur.y, life: 0.35,
          el: sk.el || null, color: sk.el ? elemColorOf(sk.el) : null });
        hit.push(cur);
        var next = null, nd = chainR, ck;
        for (ck = 0; ck < room.enemies.length; ck++) {
          var cand = room.enemies[ck];
          if (cand.hp <= 0 || hit.indexOf(cand) >= 0) { continue; }
          var d1 = dist(cur, cand);
          if (d1 <= nd) { nd = d1; next = cand; }
        }
        cur = next;
      }
    }
  }

  function elemColorOf(el) {
    var ED = global.DG.elemData;
    return el && ED ? ED.elemColor(el) : 'rgba(120,220,255,0.9)';
  }

  /* ── 분신(分身) — 원작의 소환 ───────────────────────────────
   * 방사(方士)의 나무가 세운다. 적을 쫓아가 대신 때리고, 때가 되면 흩어진다.
   * **적이 분신을 때리지는 않는다** — 적의 표적을 나누는 규칙까지 넣으면
   * 이 판의 전투가 통째로 달라진다. 원작의 소환수 감각 중 "대신 때린다" 만 옮겼다.
   */
  function summon(n, sec, strMul, big) {
    if (!run) { return; }
    if (!run.minions) { run.minions = []; }
    for (var i = 0; i < n; i++) {
      run.minions.push({
        x: run.player.x + (Math.random() - 0.5) * 40,
        y: run.player.y + (Math.random() - 0.5) * 30,
        t: sec, cd: 0.5 + Math.random() * 0.4,
        mul: 0.5 * strMul, big: !!big, phase: Math.random() * 6.28
      });
    }
    fx.push({ t: 'ring', x: run.player.x, y: run.player.y, life: 0.5 });
  }

  /* ── 동행(同行) — 부대 2번째 인물이 곁에서 같이 싸운다 ──────────
   * PLAN §51(2026-09-06, 사용자 요청 "동료도 따라다니면서 같이 싸우던지
   * 용병처럼"). `atkOf()`(부대 전원의 합산 공격력, hero.js `partyPower()`)는
   * 이미 2번째 인물의 몫까지 안에 들어 있다 — 그래서 이 동행은 **그 값을
   * 다시 쓰지 않고** `hero.power(id)`(개인 전투력, 부대 합산과 별도 식)로
   * 자기 몫을 새로 매겨 **덤으로** 때린다. 위 `summon()`의 분신(나무)과
   * 같은 결이다 — 적이 동행을 때리지 않는다(체력·죽음·부활을 새로
   * 만들지 않는 선택, 분신과 같은 이유).
   */
  function companionHeroId() {
    var p = core.save.party;
    return (p && p.length > 1) ? p[1] : null;
  }

  function spawnCompanion() {
    var id = companionHeroId();
    if (!id) { return null; }
    return {
      id: id, x: WALL + 70, y: ROOM_H * 0.5 + 34,
      phase: 0, walking: false, facing: 1,
      atkCd: 0, atkAnim: 0, dirX: 0, dirY: 1
    };
  }

  /** 동행의 때림 배율 — 선두 개인 전투력 대비 제 몫(0.2~1.5배)에
   *  "덤"이라는 뜻으로 0.55를 곱한다. 선두보다 약해도 최소한의 몫은,
   *  세게 키워도 선두를 넘어서지는(1.5배 상한) 못하게 눌렀다. */
  /* ── 동행 서명(§5.17) ─────────────────────────────────────
   * 동행도 제 서명 무예(`heroSkillData.sigOf(동행 id)`)를 스스로 쓴다 — 곁에 적이 셋 이상
   * 몰렸거나 보스·정예가 닿으면. 모양은 동행 자리를 가운데 둔 파동 하나로 통일한다
   * (선두의 applyShapeSkill 은 선두 자리·선두 축복을 보므로 빌리지 않는다). 원소·이름·위력은 제 것.
   * 선두가 서명을 지른 뒤 1.5초 안이면 적 하나만 닿아도 곧장 나가고 **합격**(×1.5).
   * 판정에 Math.random 을 안 쓴다(맞히는 strike 는 동행 평타와 같은 길). 손잡이 `dungeon.allySig`. */
  var ALLY_SIG_FIRST = 4, ALLY_SIG_CD_MUL = 1.5, ALLY_SIG_CD_MIN = 8, ALLY_SIG_R = 120,
    ALLY_SIG_CROWD = 3, ALLY_COMBO_WIN = 1.5, ALLY_COMBO_MUL = 1.5;
  function allySigOn() { return !core.tuned || core.tuned('dungeon.allySig', 1) ? true : false; }

  /** 지금 쓸 까닭이 있나 — 순수. combo 면 적 하나만 닿아도 된다 */
  function allySigWants(c, enemies, combo) {
    if (!c || !allySigOn()) { return false; }
    var n = 0, strong = false, i, e;
    for (i = 0; i < (enemies || []).length; i++) {
      e = enemies[i];
      if (!e || e.hp <= 0) { continue; }
      if (Math.hypot(e.x - c.x, e.y - c.y) > ALLY_SIG_R + (e.r || 0)) { continue; }
      n++;
      if (e.boss || e.elite) { strong = true; }
    }
    return n > 0 && (combo || strong || n >= ALLY_SIG_CROWD);
  }

  function castAllySig(c, sk, combo) {
    var room = run.room, mul = (sk.v || 1) * companionMul() * (combo ? ALLY_COMBO_MUL : 1), hit = 0, i;
    var R = ALLY_SIG_R, kb = Math.min(30, sk.kb === undefined ? 20 : sk.kb);
    c.sigCd = Math.max(ALLY_SIG_CD_MIN, (sk.cd || 12) * ALLY_SIG_CD_MUL);
    c.atkAnim = 0.35;
    fx.push({ t: 'whirl', x: c.x, y: c.y, r: R, life: 0.35, el: sk.el || null, color: sk.el ? elemColorOf(sk.el) : null });
    for (i = 0; i < room.enemies.length; i++) {
      var e = room.enemies[i];
      if (e.hp <= 0 || dist(c, e) > R + e.r) { continue; }
      strike(e, mul, kb, sk.el || 'phys');
      hit++;
      if (!run) { return hit; }
    }
    run.allySigs = (run.allySigs || 0) + 1;
    if (combo) {
      run.comboT = 0;
      run.allyCombos = (run.allyCombos || 0) + 1;
      var ref = global.DG.data && global.DG.data.find(c.id);
      core.emit('toast', '⚡ 합격! ' + (ref ? ref.name + ' · ' : '') + (sk.emoji || '') + ' ' + sk.name);
    }
    core.emit('dungeon:skill', 'ally:' + c.id + (combo ? ':combo' : ''));
    return hit;
  }

  function stepAllySig(c, dt) {
    if (c.sigCd === undefined) { c.sigCd = ALLY_SIG_FIRST; }
    c.sigCd -= dt;
    if (run.comboT > 0) { run.comboT -= dt; }
    if (c.sigCd > 0 || run.choice) { return; }
    var HS = global.DG.heroSkillData, sk = HS && HS.sigOf(c.id);
    if (!sk) { return; }
    var combo = run.comboT > 0;
    if (!allySigWants(c, run.room.enemies, combo)) { return; }
    castAllySig(c, sk, combo);
  }

  function companionMul() {
    var HR = global.DG.hero;
    var id = run.companion && run.companion.id;
    if (!id || !HR) { return 0; }
    var cp = HR.power(id), lp = HR.power(leadId()) || 1;
    return core.clamp(cp / lp, 0.2, 1.5) * 0.55;
  }

  function updateCompanion(dt) {
    if (!run || !run.companion) { return; }
    var c = run.companion, room = run.room, p = run.player, i;
    c.phase += dt * 7;
    if (c.atkAnim > 0) { c.atkAnim -= dt; }
    c.atkCd -= dt;
    stepAllySig(c, dt);
    if (!run) { return; }

    var best = null, bd = 1e9;
    for (i = 0; i < room.enemies.length; i++) {
      var en = room.enemies[i];
      if (en.hp <= 0) { continue; }
      var dd = dist(c, en);
      if (dd < bd) { bd = dd; best = en; }
    }
    var reach = 34;
    if (best && bd - best.r <= reach) {
      var d0 = bd || 1;
      c.dirX = (best.x - c.x) / d0; c.dirY = (best.y - c.y) / d0;
      c.facing = c.dirX >= 0 ? 1 : -1;
      c.walking = false;
      if (c.atkCd <= 0) {
        c.atkCd = atkCdOf() * 1.25;             // 동행은 선두보다 살짝 느리다(덤이라)
        c.atkAnim = 0.22;
        strike(best, companionMul(), 5, 'phys');
        if (!run) { return; }
      }
      return;
    }

    /* 적이 없거나 사거리 밖 — 그 적에게(있으면), 없으면 선두 곁으로 붙는다 */
    var goal = best || p;
    var followR = best ? Math.max(20, best.r + reach - 6) : 46;
    var gd = dist(c, goal);
    if (gd > followR) {
      var d1 = gd || 1, spd = 150;
      c.dirX = (goal.x - c.x) / d1; c.dirY = (goal.y - c.y) / d1;
      c.facing = c.dirX >= 0 ? 1 : -1;
      c.walking = true;
      c.x = core.clamp(c.x + c.dirX * spd * dt, WALL + P_R, ROOM_W - WALL - P_R);
      c.y = core.clamp(c.y + c.dirY * spd * dt, WALL + P_R, ROOM_H - WALL - P_R);
    } else {
      c.walking = false;
    }
  }

  function updateMinions(dt) {
    if (!run || !run.minions || !run.minions.length) { return; }
    var room = run.room, i, j;
    for (i = run.minions.length - 1; i >= 0; i--) {
      var mn = run.minions[i];
      mn.t -= dt;
      if (mn.t <= 0) { run.minions.splice(i, 1); continue; }
      mn.phase += dt * 6;
      /* 가장 가까운 적을 쫓는다 */
      var best = null, bd = 1e9;
      for (j = 0; j < room.enemies.length; j++) {
        var en2 = room.enemies[j];
        if (en2.hp <= 0) { continue; }
        var dd = dist(mn, en2);
        if (dd < bd) { bd = dd; best = en2; }
      }
      if (!best) {
        /* 적이 없으면 주인 곁으로 */
        var pd = dist(mn, run.player) || 1;
        if (pd > 40) {
          mn.x += (run.player.x - mn.x) / pd * 90 * dt;
          mn.y += (run.player.y - mn.y) / pd * 90 * dt;
        }
        continue;
      }
      if (bd > best.r + 14) {
        mn.x += (best.x - mn.x) / bd * (mn.big ? 70 : 110) * dt;
        mn.y += (best.y - mn.y) / bd * (mn.big ? 70 : 110) * dt;
      } else {
        mn.cd -= dt;
        if (mn.cd <= 0) {
          mn.cd = mn.big ? 1.1 : 0.7;
          strike(best, mn.mul, 4, 'phys');
          if (!run) { return; }
        }
      }
    }
  }

  /* ── 화면이 읽어 가는 것 ──────────────────────────────── */

  function status() {
    if (!run) {
      var d = dstate();
      return { active: false, best: d.best || 0, runs: d.runs || 0, kills: d.kills || 0, deaths: d.deaths || 0,
                grave: d.grave || null, horde: d.horde || { best: 0, runs: 0 }, nmBest: d.nmBest || 0 };
    }
    /* 네 칸 — 선두가 걸어 둔 무예. 빈 칸도 그대로 넘긴다(화면이 흐리게 그린다) */
    var skills = [], got = slotSkills();
    for (var i = 0; i < got.length; i++) {
      var cd = Math.max(0, run.player.cds[i]);
      if (!got[i]) {
        skills.push({ key: null, name: '비었다', emoji: '·', desc: '무예를 걸어 두세요',
                      cost: 0, cd: 0, cdMax: 1, ready: false, empty: true });
        continue;
      }
      var sk = got[i].sk, smod = secretMod(sk), scost = Math.round(sk.cost * smod.cost);
      var sdef = smod.key && global.DG.secret ? global.DG.secret.byKey(smod.key) : null;
      skills.push({
        key: sk.key, name: sk.name, emoji: sk.emoji, desc: sk.desc,
        rank: got[i].rank, secret: smod.key, secretEmoji: sdef ? sdef.emoji : '', secretBoost: smod.boost || 1,
        cost: scost, cd: cd, cdMax: sk.cd * smod.cd,
        ready: cd <= 0 && run.mp >= scost
      });
    }
    return {
      active: true, floor: run.floor, theme: DD.themeOf(run.floor),
      hp: Math.max(0, Math.round(run.hp)), hpMax: run.hpMax,
      mp: Math.max(0, Math.round(run.mp)), mpMax: run.mpMax,
      skills: skills, rally: rallyOn(),
      room: run.room.index + 1, roomTotal: run.roomTotal,
      cleared: run.room.cleared, kind: run.room.kind,
      /* 명소 층(§5.15) — 있으면 HUD 가 테마 이름 대신 명소 이름·방 이름을 쓴다 */
      fixed: run.fixed ? { key: run.fixed.key, name: run.fixed.name, emoji: run.fixed.emoji, title: run.room.title || '' } : null,
      loot: { gold: Math.round(run.loot.gold), items: run.loot.items.length },
      boons: run.boons, choice: run.choice, merchantChoice: run.merchantChoice,
      graveChoice: run.graveChoice,
      /* 난입(§5.5) — 회차 중일 때만 채운다. 화면은 이 필드가 있으면 HUD를
         일반 층 표시 대신 타이머·파도로 바꿔 그린다. */
      horde: run.horde ? {
        t: Math.round(run.hordeT), remain: Math.max(0, HORDE_DURATION - run.hordeT),
        wave: run.hordeWave, level: run.hordeLevel, enemies: run.room.enemies.length
      } : null,
      /* 부적 던전(§5.3) — 회차 중일 때만 채운다. mods 는 키 배열 그대로
         내준다(화면이 DD.modByKey 로 이름·이모지를 붙인다). */
      nightmare: run.nightmare ? {
        tier: run.nightmare.tier, mods: run.nightmare.mods,
        resistElem: run.nightmare.resistElem,
        roomT: nmHasMod('timer') ? Math.max(0, run.nightmare.roomT) : null
      } : null,
      /* 시련(§5.11) — 있으면 화면이 HUD 를 단계·시계·진척 막대로 바꾼다 */
      trial: run.trial ? {
        lv: run.trial.lv, t: Math.max(0, run.trial.t), sec: TRIAL_SEC,
        prog: run.trial.prog, goal: TRIAL_GOAL, guardian: run.trial.guardian, deaths: run.trial.deaths
      } : null,
      boonPicks: run.boonPicks || 0, boonMax: BOON_MAX_STACK,
      kills: run.kills, best: dstate().best || 0,
      atk: Math.round(atkOf()), reach: Math.round(reachOf()),
      /* 강공격·회피(2026-09-10) — 스킬과 같은 자리(cd/cdMax)로 내준다.
         화면이 버튼 위에 쿨다운 링을 그릴 때 스킬바와 같은 계산을 쓸 수 있게. */
      heavy: { cd: Math.max(0, run.player.heavyCd), cdMax: HEAVY_CD },
      dodgeAct: { cd: Math.max(0, run.player.dodgeCd), cdMax: DODGE_CD },
      /* 투장 무예 — 없으면(세 점을 안 갖췄으면) avail:false 만 내려 화면이
         비활성으로 그리게 한다(위 heavy/dodgeAct와 같은 cd/cdMax 자리). */
      setSkill: (function () {
        var got = activeSetSkill();
        if (!got) { return { avail: false, cd: 0, cdMax: 1 }; }
        return { avail: true, name: got.sk.name, emoji: got.sk.emoji, desc: got.sk.desc,
                 setName: got.set.name,
                 cd: Math.max(0, run.player.setSkCd), cdMax: got.sk.cd };
      })(),
      /* 서명 무예(2026-09-11) — 위 setSkill과 같은 자리(avail/cd/cdMax) */
      sigSkill: (function () {
        var sk = activeSigSkill();
        if (!sk) { return { avail: false, cd: 0, cdMax: 1 }; }
        return { avail: true, name: sk.name, emoji: sk.emoji, desc: sk.desc,
                 cd: Math.max(0, run.player.sigSkCd), cdMax: sk.cd };
      })(),
      combo: run.combo || 0
    };
  }

  global.DG = global.DG || {};
  global.DG.dungeon = {
    NM_DARK_R: NM_DARK_R, darkSight: darkSight,
    ELITES: ELITES, eliteOf: eliteOf, eliteChance: eliteChance, enemyName: enemyName,
    MODES: MODES, modeOf: modeOf, modesOpen: modesOpen, mode: mode, setMode: setMode, enemyHp: enemyHp, enemyDmg: enemyDmg,
    resistOf: resistOf, RESIST_CAP: RESIST_CAP,
    slotSkills: slotSkills,
    WAYPOINT_EVERY: WAYPOINT_EVERY, waypoint: waypoint, markWaypoint: markWaypoint,
    hardcore: hardcore, setHardcore: setHardcore, fallen: fallen, vowMilestone: vowMilestone, VOW_GOLD: VOW_GOLD,
    elemDmgOf: elemDmgOf, elemResOf: elemResOf,
    /** 자가진단용 — 한 대만 때려 본다 (저항이 결마다 다르게 깎는지) */
    _strike: strike, _addPacks: addPacks, _cleave: cleave, _applyShape: applyShapeSkill, _pullStep: pullStep,
    /** 자가진단용 — 한 대 맞아 본다 (갑주의 원소 저항이 실제로 깎는지) */
    _hurt: hurtPlayer,
    /** 자가진단용 — 적 하나를 만들어만 본다 */
    _spawnEnemy: spawnEnemy,
    /** 자가진단용 — 재료를 한 번 굴려 본다 (주옥이 얼마나 드문지는 굴려 봐야 안다) */
    _dropMat: dropMat,
    /** 자가진단용 — 동행(부대 2번째 인물)의 때림 배율을 그대로 읽는다 */
    _companionMul: companionMul,
    _allySigWants: allySigWants,
    _guardZones: guardZones, _stepGuardSig: stepGuardSig,
    ROOM_W: ROOM_W, ROOM_H: ROOM_H, WALL: WALL, P_R: P_R,
    SKILL_SLOTS: SKILL_SLOTS,
    /** 던전 밖(마을 등)이 같은 필드 메커니즘을 빌려 쓸 때 쓰는 자리 —
     *  각 함수의 ctx 인자는 그 함수 정의 옆 주석을 볼 것 (사가나락 마을 필드전투). */
    FIELD_ENEMY_CAP: FIELD_ENEMY_CAP, FIELD_CAP: FIELD_CAP, PACK_N: PACK_N,
    fieldOn: fieldOn, fieldRadiusUnits: fieldRadiusUnits,
    fieldBoundPlayer: boundPlayer, _corridorReach: corridorReach,
    /** 자가진단 전용(§5.12) — town.js safePoint 가 이 이름을 찾으면 옛 로컬 좌표로 돌기 시작해서 이름을 갈랐다 */
    _fieldBlockedAt: fieldBlockedAt,
    _corridorExtra: corridorExtra, _doorCorridorUnits: doorCorridorUnits,
    spawnFieldRoamers: spawnFieldEncounters,
    spawnFieldTreasure: spawnFieldTreasure,
    spawnFieldMerchant: spawnFieldMerchant,
    fieldRoamerCount: fieldEnemyCount,
    stepFieldCombat: stepFieldCombat,
    /** 지역 우두머리(§5.13) — town.update 가 부른다. now 는 자가진단이 시각을 붙들 때만 */
    stepRegionBoss: stepRegionBoss, regionBossState: function () { return rbState(); },
    RB_NEAR: RB_NEAR, RB_CD_MS: RB_CD_MS,
    _grantRegionBossReward: grantRegionBossReward, _pickEnemyRef: pickEnemyRef, _eraAltPoolFor: eraAltPoolFor,
    /** 명소 층(§5.15) */
    fixedFor: fixedFor, fixedState: function () { return fixedState(); },
    _makeFixedRoom: makeFixedRoom, _fixedDoors: fixedDoors, _grantFixedReward: grantFixedReward,
    pickupField: pickupField,
    active: active, enter: enter, leave: leave, update: update,
    setInput: setInput, moveTo: moveTo,
    pickBoon: pickBoon, rejectBoon: rejectBoon, goRoom: goRoom,
    /** 자가진단용(§5.1) — 축복 3택을 직접 굴려 본다(층 게이팅과 무관하게) */
    _rollBoonChoice: rollBoonChoice,
    /** 자가진단 전용(§5.1) — 원소 배합을 강제한다(null이면 해제) */
    _forceElemDmg: function (v) { forcedElemDmg = v; },
    _forceCrit: function (v) { forcedCrit = v; },
    buyMerchant: buyMerchant, leaveMerchant: leaveMerchant,
    /** 유품(§5.2) — openGrave 는 자가진단용으로도 쓴다(표식을 안 밟고 바로 열어 봄) */
    graveOf: graveOf, openGrave: openGrave,
    toggleGraveItem: toggleGraveItem, claimGrave: claimGrave, GRAVE_ITEM_MAX: GRAVE_ITEM_MAX,
    /** 난입(§5.5) — `enter({horde:true})` 그대로도 되지만 화면 코드가 매번
     *  옵션 객체를 쓰지 않게 이름을 하나 내준다. */
    enterHorde: function () { return enter({ horde: true }); },
    HORDE_WAVE_INTERVAL: HORDE_WAVE_INTERVAL, HORDE_ENEMY_CAP: HORDE_ENEMY_CAP,
    HORDE_DURATION: HORDE_DURATION,
    /** 자가진단용 — 파도를 직접 굴려 본다(30초를 안 기다리고) */
    _spawnHordeWave: spawnHordeWave,
    /** 부적 던전(§5.3) — `enter({sigilId})` 그대로도 되지만 이름을 하나
     *  내준다(위 enterHorde와 같은 이유). */
    enterNightmare: function (sigilId) { return enter({ sigilId: sigilId }); },
    /** 시련(§5.11) — 단계 lv 로 들어간다(열린 단계까지만) */
    enterTrial: function (lv) { return enter({ trial: lv }); },
    /** 시련 기록 — 굴혈 선택 카드·순위표가 읽는다 */
    trialInfo: function () {
      var ts = trialState();
      return { ready: trialReady(), need: TRIAL_NEED, best: ts.best, open: ts.open, runs: ts.runs,
               board: ts.board.slice(), sec: TRIAL_SEC, goal: TRIAL_GOAL, max: TRIAL_MAX };
    },
    TRIAL_SEC: TRIAL_SEC, TRIAL_GOAL: TRIAL_GOAL, TRIAL_DEATH_SEC: TRIAL_DEATH_SEC,
    /** 자가진단 전용 — 처치 하나를 시련 진척에 흘린다(kill 의 드롭·경험은 안 탄다) */
    _trialOnKill: function (e) { if (run && run.trial) { trialOnKill(e); } },
    _trialPts: trialPts,
    NM_ROOM_TOTAL: NM_ROOM_TOTAL, NM_ROOM_TIMER: NM_ROOM_TIMER,
    /** 자가진단 전용 — 지금 회차의 변형자 판정을 직접 읽는다 */
    _nmHasMod: nmHasMod, _nmMul: nmMul, _nmLootMul: nmLootMul,
    /** 마을 들판 방랑 상인(PLAN §60 후보 1) — town.js/ui.js가 독자 재고
     *  상태를 굴릴 때 쓴다. `run.merchantChoice`와는 별개다. */
    rollMerchantStock: rollMerchantStock,
    castSkill: castSkill, _secretMod: secretMod, refill: refill,
    heavyAttack: heavyAttack, doDodge: doDodge, castSetSkill: castSetSkill,
    castSigSkill: castSigSkill,
    boonVal: boonVal, boonEffect: boonEffect,
    status: status, state: dstate,
    /** 화면 전용 — 상태를 직접 읽는다 (쓰지는 말 것) */
    raw: function () { return run; },
    fx: function () { return fx; },
    moveTarget: function () { return target; },
    /** 월드 보스(§5.4) — town.js update() 가 매 틱 부른다. */
    stepWorldBoss: stepWorldBoss, wbNow: wbNow,
    WB_SLOT_MS: WB_SLOT_MS, WB_NOTICE_MS: WB_NOTICE_MS, WB_FIGHT_MS: WB_FIGHT_MS,
    worldBossIn: function (room) { return wbFindBoss(room); },
    /** 진단 전용 — 스케줄링을 시간 없이 순수 함수로 재현한다 */
    _wbPickTown: wbPickTown, _wbPickBossRef: wbPickBossRef, _wbPickPos: wbPickPos,
    _wbSpawn: wbSpawn, _wbCheckParts: wbCheckParts, _wbFlee: wbFlee,
    _grantWorldBossReward: grantWorldBossReward,
    /** 진단 전용 — 보스 패턴 하나를 직접 굴려 본다(무기 부위 봉인 확인용) */
    _bossPattern: bossPattern,
    /** 진단 전용(§9, "Date.now 를 고정") — 사가만리 weather.force() 와 같은 결 */
    _forceNow: function (v) { forcedNow = v; }
  };
})(window);
