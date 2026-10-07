  /* ── 지역 우두머리(§5.13) — 원작의 고유 몬스터(Super Unique) 자리 ─────
   * 지역마다 하나, 고정 자리(world-map bossSpot)에 선다. 1500 안으로 다가가면 호위 정예
   * 셋과 함께 나오고, 쓰러뜨리면 전설 한 점·보물 둘·재료·금, 10분 뒤 다시 선다.
   * 세기는 그 자리 위험도 + 4 층의 보스(체력 ×3). 세이브 save.dungeon.regionBoss[지역]. */
  var RB_NEAR = 1500, RB_CD_MS = 10 * 60 * 1000, RB_HP_MUL = 3, RB_LV_ADD = 4, RB_GUARDS = 3;
  function rbState() {
    var d = dstate();
    if (!d.regionBoss || typeof d.regionBoss !== 'object') { d.regionBoss = {}; }
    return d.regionBoss;
  }
  function rbAlive(room, key) {
    var es = room && room.enemies, i;
    if (!es) { return null; }
    for (i = 0; i < es.length; i++) { if (es[i].regionBoss === key && es[i].hp > 0) { return es[i]; } }
    return null;
  }
  /** 지역 우두머리의 몸 — 명단 몬스터의 몸을 빌려 이름·색만 갈아 끼운다 */
  function rbRef(rg) {
    var ED = global.DG.enemyData, base = ED && ED.byName ? ED.byName(rg.boss.base) : null, r = {}, k;
    if (base) { for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) { r[k] = base[k]; } } }
    else { r = { kind: 'beast', form: 'ogre' }; }
    r.id = rg.boss.id; r.name = rg.boss.name; r.emoji = rg.boss.emoji; r.color = rg.boss.color;
    delete r.biome;
    return r;
  }
  /** @returns 새로 세운 우두머리(없으면 null) — town.update 가 매 틱 부른다 */
  function stepRegionBoss(ctx, now) {
    var WM = global.DG.worldMap;
    if (!WM || !ctx || !ctx.town || !ctx.player || !ctx.room) { return null; }
    var p = ctx.player, rg = WM.regionAt(p.x, p.y), spot = WM.bossSpot(rg.key);
    if (!spot || Math.hypot(p.x - spot.x, p.y - spot.y) > RB_NEAR) { return null; }
    if (rbAlive(ctx.room, rg.key)) { return null; }
    var st = rbState()[rg.key], t = now === undefined ? Date.now() : now;
    if (st && st.lastAt && t - st.lastAt < RB_CD_MS) { return null; }
    var lv = WM.levelAt(spot.x, spot.y) + RB_LV_ADD;
    var e = spawnEnemy(lv, true, { x: spot.x, y: spot.y, ref: rbRef(rg),
      hp: Math.round(enemyHp(lv, true) * RB_HP_MUL), dmg: enemyDmg(lv, true) });
    e.field = true; e.regionBoss = rg.key; e.rbLevel = lv;
    ctx.room.enemies.push(e);
    for (var gi = 0; gi < RB_GUARDS; gi++) {
      var ga = gi / RB_GUARDS * Math.PI * 2;
      var g = spawnEnemy(lv, false, { x: spot.x + Math.cos(ga) * 70, y: spot.y + Math.sin(ga) * 70,
        ref: pickEnemyRef(lv, false, null, rg.key), forceElite: true });
      g.field = true;
      ctx.room.enemies.push(g);
    }
    core.log('☠️ 지역 우두머리 — ' + rg.boss.name + ' (' + rg.name + ') · 위험 ' + lv, 'info');
    core.emit('toast', '☠️ ' + rg.boss.emoji + ' ' + rg.boss.name + ' — ' + rg.boss.desc);
    return e;
  }
  /** 쓰러뜨렸다 — kill() 이 부른다(그때 run 은 마을 ctx) */
  function grantRegionBossReward(e, room) {
    var WM = global.DG.worldMap, rg = WM ? WM.byKey(e.regionBoss) : null;
    if (!rg || !room) { return; }
    var lv = e.rbLevel || 1, all = rbState(), st = all[rg.key] || (all[rg.key] = { kills: 0, firstAt: Date.now() });
    var first = !st.kills;
    st.kills += 1; st.lastAt = Date.now();
    withRun({ floor: lv, boons: {}, room: room }, null, function () {
      dropGold(room, e.x, e.y, 6);
      dropItem(room, e.x, e.y, 45);
      dropItem(room, e.x, e.y, 45);
      dropMat(room, e.x, e.y, 30);
    });
    var IT = global.DG.item;
    if (IT && IT.roll) { room.drops.push({ kind: 'item', item: IT.roll(lv + 1, { tier: 4 }), x: jitter(e.x), y: jitter(e.y) }); }
    core.gainFeat(15 + lv, '지역 우두머리 토벌');
    core.emit('regionboss:kill', { key: rg.key, first: first });
    core.log('🏆 ' + rg.boss.name + ' 토벌' + (first ? ' — 첫 토벌!' : '') + ' · 전설 한 점', 'good');
    core.emit('toast', '🏆 ' + rg.boss.name + (first ? ' 첫 토벌!' : ' 토벌!'));
  }

  function wbFlee(e, ctx) {
    e.hp = 0;
    grantWorldBossReward(e, ctx.room, true);
  }

  /**
   * `run`·`fx`(둘 다 이 모듈의 클로저 변수)를 잠깐 다른 판(마을)의 것으로
   * 바꿔 끼우고 fn 을 부른 뒤 되돌린다. `strike`·`hurtPlayer`·`kill` 은
   * 자가진단(`_strike`·`_hurt`·`_spawnEnemy`)이 지금 시그니처 그대로 직접
   * 부르므로 인자를 늘릴 수 없다 — 대신 이 스왑으로 "잠깐 빌려 쓴다".
   * 마을·던전은 동시에 active 하지 않으니 재진입 걱정은 없다.
   */
  function withRun(ctxRun, ctxFx, fn) {
    var savedRun = run, savedFx = fx;
    run = ctxRun;
    if (ctxFx) { fx = ctxFx; }
    try { fn(); } finally { run = savedRun; fx = savedFx; }
  }

  /**
   * 들판 로머 전투 한 틱 — `update()` 안의 적 AI·자동공격·투사체
   * 블록(이동·문 전환·방 정리 판정은 뺐다)을 그대로 옮겨 온 것이다.
   * **로직은 한 글자도 안 바꿨다** — `update()` 자체는 이 함수를 안 부른다
   * (58KB 판정의 심장을 건드리지 않는다는 원칙). 마을(`town.js`)이 자기
   * 이동을 다 계산한 뒤 이것만 불러 "그 자리에서 싸우는" 부분만 빌린다.
   * @param ctx {roomW, roomH, wall, pr, floor, roomIdx, theme, room, player,
   *             shots, foeShots} — `withRun`으로 run 을 이걸로 바꿔 끼운다.
   * @param fxArr 이 틱에서 난 연출(hit·slash·pop·burst 등)을 받을 배열
   *              (마을 자신의 `fx()` 배열을 넘긴다).
   */
  function stepFieldCombat(dt, ctx, fxArr) {
    withRun(ctx, fxArr, function () {
      var p = run.player, room = run.room, i;
      var rally = rallyOn();
      var rw = ctx.roomW || ROOM_W, rh = ctx.roomH || ROOM_H, wl = ctx.wall || WALL;

      if (p.atkAnim > 0) { p.atkAnim -= dt; }
      if (p.hurt > 0) { p.hurt -= dt; }

      /* 기공파 투사체 */
      for (i = run.shots.length - 1; i >= 0; i--) {
        var sh = run.shots[i];
        sh.x += sh.dx * sh.spd * dt;
        sh.y += sh.dy * sh.spd * dt;
        sh.life -= dt;
        for (var si = 0; si < room.enemies.length; si++) {
          var se = room.enemies[si];
          if (se.hp <= 0 || sh.hit[si]) { continue; }
          if (dist(sh, se) < se.r + 10) {
            sh.hit[si] = true;
            strike(se, sh.mul || 2.2, 14, sh.el || 'chi');
            if (!run) { return; }
          }
        }
        if (sh.life <= 0 || sh.x < wl || sh.x > rw - wl ||
            sh.y < wl || sh.y > rh - wl) {
          run.shots.splice(i, 1);
        }
      }

      /* 궁수·조총병이 쏜 것 */
      for (i = run.foeShots.length - 1; i >= 0; i--) {
        var fsh = run.foeShots[i];
        fsh.x += fsh.dx * fsh.spd * dt;
        fsh.y += fsh.dy * fsh.spd * dt;
        fsh.life -= dt;
        if (dist(fsh, p) < P_R + 8) {
          hurtPlayer(fsh.dmg, fsh.el, fsh.from, '화살·탄환');
          if (!run) { return; }
          run.foeShots.splice(i, 1);
          continue;
        }
        if (fsh.life <= 0 || fsh.x < wl || fsh.x > rw - wl ||
            fsh.y < wl || fsh.y > rh - wl) {
          run.foeShots.splice(i, 1);
        }
      }

      /* 내 공격 — 사거리 안에서 가장 가까운 적 */
      p.atkCd -= dt;
      var reach = reachOf();
      var near = null, nd = 1e9;
      for (i = 0; i < room.enemies.length; i++) {
        var e = room.enemies[i];
        if (e.hp <= 0) { continue; }
        var d = dist(p, e) - e.r;
        if (d < nd) { nd = d; near = e; }
      }
      if (near && nd <= reach && p.atkCd <= 0) {
        if (global.DG.mount && global.DG.mount.onAttack) { global.DG.mount.onAttack(); }   // 탈것 위에선 못 싸운다 — 자동 공격이 나갈 때 내린다
        p.atkCd = atkCdOf() / (rally ? 1.4 : 1);
        p.atkAnim = 0.22;
        p.castAnim = false;
        strike(near);
        if (!run) { return; }
        if (Math.random() * 100 < boonVal('echoPct')) { strike(near); }
        if (!run) { return; }
        tryShadowSig();                     // §5.1 인물 축 — 그림자 서명
        if (!run) { return; }
      }

      /* 적 */
      for (i = 0; i < room.enemies.length; i++) {
        var en = room.enemies[i];
        if (en.hp <= 0) { continue; }
        en.phase += dt * 7;
        if (en.hurt > 0) { en.hurt -= dt; }
        if (en.pullT > 0) { pullStep(en, dt, ctx); }   // §5.19 2차 끌려오는 중
        var ed = dist(en, p);
        var el = en.elite ? eliteOf(en.elite) : null;
        if (el && el.regen && en.hp < en.hpMax) {
          en.hp = Math.min(en.hpMax, en.hp + en.hpMax * el.regen * dt);
        }
        if (en.dots && en.dots.length) {
          for (var di2 = en.dots.length - 1; di2 >= 0; di2--) {
            var dt2 = en.dots[di2];
            en.hp -= dt2.dps * dt;
            dt2.t -= dt;
            if (dt2.t <= 0) { en.dots.splice(di2, 1); }
          }
          if (en.hp <= 0) { kill(en); if (!run) { return; } continue; }
        }
        var chill = 1;
        if (en.slow > 0) {
          en.slow -= dt;
          chill = 1 - (en.slowMul || 0.45);
        }
        var espd = (62 + Math.min(40, (ctx.floor || 0) * 1.5)) *
                   (el && el.spd ? el.spd : 1) * chill;
        var lookW = en.ref && en.ref.look && en.ref.look.weapon;
        var ranged = lookW === 'bow' || lookW === 'staff';
        var stopAt = ranged ? RANGED_STOP : (en.r + P_R - 2);
        var wob = (!ranged && lookW === 'axe') ? Math.sin(en.phase * 0.6) * 0.5 : 0;
        var lunge = (!ranged && lookW === 'club') ? 1 + Math.max(0, Math.sin(en.phase * 0.9)) * 0.7 : 1;
        /* 어그로 — update()의 그 블록과 같은 자리, 같은 상수(AGGRO_RANGE 등)를
           그대로 쓴다. 들판 로머(en.field)도 이걸 탄다 — 오히려 여기가 더
           뜻이 있다(길을 걷다 옆을 지나쳐도 안 쫓아오는 채비가 열린다). */
        if (!en.aggro) {
          var aggroR = (ranged ? AGGRO_RANGE_RANGED : AGGRO_RANGE) * (en.elite ? 1.15 : 1);
          if (ed <= aggroR) { wakeEnemy(en); }
        }
        if (en.aggro) {
          if (ed > stopAt) {
            var mvx = (p.x - en.x) / ed, mvy = (p.y - en.y) / ed;
            if (wob) {
              var perpx = -mvy, perpy = mvx;
              mvx += perpx * wob; mvy += perpy * wob;
              var mvl = Math.sqrt(mvx * mvx + mvy * mvy) || 1;
              mvx /= mvl; mvy /= mvl;
            }
            var nex = en.x + mvx * espd * lunge * dt;
            var ney = en.y + mvy * espd * lunge * dt;
            if (en.field) {
              /* 들판 로머는 방(마을 벽) 안으로는 못 들어온다 — 플레이어를
                 쫓다가도 벽 자리에서 멈춘다. 축을 나눠 막아 대각선으로
                 다가와도 한쪽 축은 계속 미끄러진다(boundPlayer와 같은 요령).
                 마을에서는 안전지대(TOWN_SAFE_R) 경계도 같은 방식으로 막아 —
                 플레이어가 안전지대로 피하면 쫓던 로머가 담장 코앞까지
                 따라붙지 못한다. */
              if (!inRoomRect(nex, en.y, ctx) && !inTownSafe(nex, en.y, ctx)) { en.x = nex; }
              if (!inRoomRect(en.x, ney, ctx) && !inTownSafe(en.x, ney, ctx)) { en.y = ney; }
            } else {
              en.x = nex; en.y = ney;
            }
          }
          var reachBonus = (lookW === 'spear' || lookW === 'halberd') ? 14 : 0;
          en.cd -= dt;
          if (ed <= en.r + P_R + 6 + reachBonus && en.cd <= 0) {
            en.cd = ENEMY_CD * (el && el.cd ? el.cd : 1) / chill;
            hurtPlayer(en.dmg, en.ref && en.ref.atkEl, en);
            if (!run) { return; }
          } else if (ranged && ed > en.r + P_R + 6 && ed <= RANGED_MAX && en.cd <= 0) {
            en.cd = ENEMY_CD * 1.4 * (el && el.cd ? el.cd : 1) / chill;
            var frdx = p.x - en.x, frdy = p.y - en.y;
            var frd = Math.sqrt(frdx * frdx + frdy * frdy) || 1;
            var frEl = (en.ref && en.ref.atkEl) || 'phys';
            run.foeShots.push({
              x: en.x, y: en.y - 8, dx: frdx / frd, dy: frdy / frd, spd: 260, life: 1.8,
              dmg: en.dmg, el: frEl, color: elemColorOf(frEl), from: enemyName(en)
            });
          }
          /* 들판 로머는 늘 boss:false 로 태어나므로(spawnFieldEncounters) 보스
             패턴은 안 타지만, 나중에 예외가 생겨도 안전하도록 그대로 둔다 */
          if (en.boss) {
            bossPattern(en, p, ed, dt);
            if (!run) { return; }
          }
        }
      }
    });
  }

  /**
   * 들판에서 잡은 것 줍기 — `update()` 안의 "바닥에 떨어진 것 줍기"(1474행
   * 부근)와 판정은 완전히 같다(플레이어 반경 안이면 `take()`). **마을에는
   * 여태 이게 없어** 필드 로머를 잡아도 `room.drops`에 쌓이기만 하고
   * 회수가 안 됐다(2026-09-01 이전, 알려진 한계로 적어 뒀던 것).
   * `stepFieldCombat`과 분리해 둔 것은 그 함수의 문서화된 범위(전투만,
   * 이동·문 전환·방 정리는 뺐다)를 그대로 지키기 위해서다 — 마을은 자기
   * 이동을 다 계산한 뒤 이 함수를 따로 부른다.
   * @param ctx stepFieldCombat 과 같은 뜻(withRun으로 run 을 이걸로 바꿔 끼운다).
   * @param fxArr 이 틱의 연출을 받을 배열.
   */
  function pickupField(ctx, fxArr) {
    withRun(ctx, fxArr, function () {
      var p = run.player, room = run.room, i;
      for (i = room.drops.length - 1; i >= 0; i--) {
        var dp = room.drops[i];
        if (dist(p, dp) < P_R + 14) {
          if (take(dp) !== false) { room.drops.splice(i, 1); }
        }
      }
    });
  }

  /** 사기(士氣) 버프가 살아 있나 */
  function rallyOn() {
    return !!(run && run.player.rallyUntil > Date.now());
  }

  function update(dt) {
    if (!run || run.choice || run.merchantChoice) { return; }  // 고르는 동안에는 멈춘다
    dt = Math.min(dt, 0.05);
    var p = run.player, room = run.room, i;

    /* 타격 정지(hitstop) — 한 대 맞은 순간 몇 프레임 시간을 확 늦춘다(멈추지는
       않는다 — dt를 0으로 주면 몇몇 카운트다운이 얼어붙은 티가 난다). 2026-09-10
       "전투가 심심하다 — 모션이 없어서 그런가"(사용자) 대응 — 새 애니메이션을
       더는 대신, 있는 모션(넉백·번쩍임·칼궤적)이 훨씬 묵직하게 느껴지게 한다. */
    if (run.hitstopT > 0) { run.hitstopT -= dt; dt *= 0.08; }
    /* §5.8② 저스트 회피 슬로우(2026-09-18) — hitstop 처럼 "멎는" 게 아니라
       0.2초 동안 조금 느리게(×0.4) 가는 보너스 창이다. hitstop 과 동시에
       걸리면 hitstop 이 우선(더 짧고 강한 쪽이 이긴다 — else if). */
    else if (run.slowT > 0) { run.slowT -= dt; dt *= 0.4; }
    /* 연속 타격(콤보) — 일정 시간 안에 다시 안 때리면 끊긴다(strike()가 갱신) */
    if (run.comboT > 0) {
      run.comboT -= dt;
      if (run.comboT <= 0) { run.combo = 0; }
    }

    /* 스킬 쿨다운 · 기력 · 무적 시간 */
    for (i = 0; i < p.cds.length; i++) { if (p.cds[i] > 0) { p.cds[i] -= dt; } }
    /* 명민·정신 같은 상시 무예가 기력 회복을 올린다 */
    run.mp = Math.min(run.mpMax, run.mp + (MP_REGEN + boonVal('mpRegen')) * dt);
    if (p.invuln > 0) { p.invuln -= dt; }
    if (p.atkAnim > 0) { p.atkAnim -= dt; }
    if (p.heavyCd > 0) { p.heavyCd -= dt; }
    if (p.dodgeCd > 0) { p.dodgeCd -= dt; }
    if (p.setSkCd > 0) { p.setSkCd -= dt; }
    if (p.sigSkCd > 0) { p.sigSkCd -= dt; }
    /* 독(毒) dot — 함정(spike)에 물렸을 때. 적에게 쓰는 `e.dots`와 같은
       패턴(dps·t)을 그대로 사람에게도 돌린다 */
    if (p.dots && p.dots.length) {
      for (var pdi = p.dots.length - 1; pdi >= 0; pdi--) {
        var pdt = p.dots[pdi];
        run.hp -= pdt.dps * dt;
        pdt.t -= dt;
        if (pdt.t <= 0) { p.dots.splice(pdi, 1); }
      }
      if (run.hp <= 0) { die(); }
      if (!run) { return; }
    }
    var rally = rallyOn();

    if (run.horde) {
      /* 난입(§5.5) — 들판 로머·보물·상인은 안 돈다(문도 복도도 없다).
         대신 파도 타이머·생존 시계·레벨 판정이 그 자리를 대신한다. */
      run.hordeT += dt;
      run.hordeWaveCd -= dt;
      if (run.hordeWaveCd <= 0) {
        run.hordeWaveCd = HORDE_WAVE_INTERVAL;
        spawnHordeWave();
      }
      hordeLevelCheck();
      if (run.hordeT >= HORDE_DURATION) {
        endHordeSurvive();
        if (!run) { return; }
      }
    } else if (run.nightmare) {
      /* 시련(§5.11) — 15분 시계 하나. 수호자를 쓰러뜨린 다음 틱에 끝낸다 */
      if (run.trial && stepTrial(dt)) { return; }
      /* 부적 던전(§5.3) — 들판 로머도 안 돈다(방 단위 구조 유지). '촉박'
         변형자일 때만 방 시계가 뜻이 있다 — 아니면 roomT 는 그냥 안 줄어든다. */
      if (nmHasMod('timer')) {
        run.nightmare.roomT -= dt;
        if (run.nightmare.roomT <= 0 && !run.room.cleared) {
          endNightmareFail();
          if (!run) { return; }
        }
      }
    } else {
      /* 필드 사냥 보충 — 들판을 걸어다니는 동안 로머가 상한 밑으로 떨어지면
         주기적으로 하나씩 채운다(PLAN 10절 "랜덤 필드 구조") */
      run.fieldSpawnCd -= dt;
      if (run.fieldSpawnCd <= 0) {
        run.fieldSpawnCd = 3;
        if (fieldEnemyCount() < FIELD_CAP()) { spawnFieldEncounters(Math.min(5, FIELD_CAP() - fieldEnemyCount())); }
      }
      run.fieldTreasureCd -= dt;
      if (run.fieldTreasureCd <= 0) {
        run.fieldTreasureCd = 90;
        spawnFieldTreasure();
      }
      run.fieldMerchantCd -= dt;
      if (run.fieldMerchantCd <= 0) {
        run.fieldMerchantCd = 60;
        spawnFieldMerchant();
      }
    }

    /* 돌진 — 조작을 무시하고 정해진 방향으로 밀고 나간다 */
    var px0 = p.x, py0 = p.y;
    if (p.dash) {
      var dsh = p.dash;
      p.x += dsh.dx * 620 * dt;
      p.y += dsh.dy * 620 * dt;
      p.walking = true;
      p.phase += dt * 16;
      fx.push({ t: 'trail', x: p.x, y: p.y, life: 0.22,
        el: dsh.el && dsh.el !== 'phys' ? dsh.el : null,
        color: dsh.el && dsh.el !== 'phys' ? elemColorOf(dsh.el) : null });
      /* 지나는 적을 벤다 (한 번씩만) */
      for (i = 0; i < room.enemies.length; i++) {
        var de = room.enemies[i];
        if (de.hp <= 0 || dsh.hit[i]) { continue; }
        if (dist(p, de) < de.r + P_R + 6) {
          dsh.hit[i] = true;
          strike(de, dsh.mul || 1.2, 22, dsh.el || 'phys');
          if (!run) { return; }
        }
      }
      dsh.t -= dt;
      if (dsh.t <= 0) { p.dash = null; }
      /* fieldBlockedAt() 은 `ctx ? ctx.floor : run.floor` 처럼 **ctx가 있으면
         그 안의 값만** 본다(부분 ctx라고 run으로 안 떨어진다) — floor·
         roomIdx를 안 실어 보내면 항상 undefined가 되어 매 프레임 "막힌
         것 없음"으로 새 버렸을 뻔했다(자가진단이 이 층을 안 보는 값이라
         하마터면 조용히 회귀할 뻔한 자리, PLAN §28-4 Phase 2). */
      boundPlayer(p, px0, py0, { corridors: run.corridors, floor: run.floor, roomIdx: run.roomIdx });
    } else if (p.dodge) {
      /* 회피 — dash와 같은 모양이지만 적을 베지 않는다(위 doDodge() 참고) */
      var dg = p.dodge;
      p.x += dg.dx * DODGE_SPD * dt;
      p.y += dg.dy * DODGE_SPD * dt;
      p.walking = true;
      p.phase += dt * 16;
      fx.push({ t: 'trail', x: p.x, y: p.y, life: 0.18, color: '#cfe8ff' });
      dg.t -= dt;
      if (dg.t <= 0) { p.dodge = null; }
      boundPlayer(p, px0, py0, { corridors: run.corridors, floor: run.floor, roomIdx: run.roomIdx });
    } else {
      /* 이동 */
      var dx = input.dx, dy = input.dy;
      if (!dx && !dy && target) {
        var tdx = target.x - p.x, tdy = target.y - p.y;
        var td = Math.sqrt(tdx * tdx + tdy * tdy);
        if (td < 6) { target = null; }
        else { dx = tdx / td; dy = tdy / td; }
      }
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        dx /= len; dy /= len;
        var spd = spdOf() * (rally ? 1.25 : 1);
        p.x += dx * spd * dt;
        p.y += dy * spd * dt;
        p.walking = true;
        p.phase += dt * 9;
        if (dx) { p.facing = dx > 0 ? 1 : -1; }
        p.dirX = dx; p.dirY = dy;              // 스킬 방향용 — 마지막 이동 방향
      } else {
        p.walking = false;
      }
      /* fieldBlockedAt() 은 `ctx ? ctx.floor : run.floor` 처럼 **ctx가 있으면
         그 안의 값만** 본다(부분 ctx라고 run으로 안 떨어진다) — floor·
         roomIdx를 안 실어 보내면 항상 undefined가 되어 매 프레임 "막힌
         것 없음"으로 새 버렸을 뻔했다(자가진단이 이 층을 안 보는 값이라
         하마터면 조용히 회귀할 뻔한 자리, PLAN §28-4 Phase 2). */
      boundPlayer(p, px0, py0, { corridors: run.corridors, floor: run.floor, roomIdx: run.roomIdx });
    }
    if (p.hurt > 0) { p.hurt -= dt; }

    /* 기공파 투사체 */
    for (i = run.shots.length - 1; i >= 0; i--) {
      var sh = run.shots[i];
      sh.x += sh.dx * sh.spd * dt;
      sh.y += sh.dy * sh.spd * dt;
      sh.life -= dt;
      for (var si = 0; si < room.enemies.length; si++) {
        var se = room.enemies[si];
        if (se.hp <= 0 || sh.hit[si]) { continue; }
        if (dist(sh, se) < se.r + 10) {
          sh.hit[si] = true;
          /* 쏜 것이 제 배수와 결을 들고 간다 (무예마다 다르다) */
          strike(se, sh.mul || 2.2, 14, sh.el || 'chi');
          if (!run) { return; }
        }
      }
      if (sh.life <= 0 || sh.x < WALL || sh.x > ROOM_W - WALL ||
          sh.y < WALL || sh.y > ROOM_H - WALL) {
        run.shots.splice(i, 1);
      }
    }

    /* 궁수·조총병이 쏜 것 — 근접 대신 거리를 두고 쏘는 적의 화살·탄환
       (몬스터 다양화: `look.weapon` 이 bow·staff 인 적은 아래 "적" 루프에서
       가까이 안 붙고 이걸 쏜다) */
    for (i = run.foeShots.length - 1; i >= 0; i--) {
      var fsh = run.foeShots[i];
      fsh.x += fsh.dx * fsh.spd * dt;
      fsh.y += fsh.dy * fsh.spd * dt;
      fsh.life -= dt;
      if (dist(fsh, p) < P_R + 8) {
        hurtPlayer(fsh.dmg, fsh.el, fsh.from, '화살·탄환');
        if (!run) { return; }
        run.foeShots.splice(i, 1);
        continue;
      }
      if (fsh.life <= 0 || fsh.x < WALL || fsh.x > ROOM_W - WALL ||
          fsh.y < WALL || fsh.y > ROOM_H - WALL) {
        run.foeShots.splice(i, 1);
      }
    }

    /* 내 공격 — 사거리 안에서 가장 가까운 적 */
    p.atkCd -= dt;
    var reach = reachOf();
    var near = null, nd = 1e9;
    for (i = 0; i < room.enemies.length; i++) {
      var e = room.enemies[i];
      if (e.hp <= 0) { continue; }
      var d = dist(p, e) - e.r;
      if (d < nd) { nd = d; near = e; }
    }
    if (near && nd <= reach && p.atkCd <= 0) {
      if (global.DG.mount && global.DG.mount.onAttack) { global.DG.mount.onAttack(); }
      p.atkCd = atkCdOf() / (rally ? 1.4 : 1);
      p.atkAnim = 0.22;
      p.castAnim = false;
      strike(near);
      if (!run) { return; }
      if (CLEAVE_ON()) { cleave(near, reach * CLEAVE_R, CLEAVE_HALF, CLEAVE_MUL, 6); if (!run) { return; } }
      if (Math.random() * 100 < boonVal('echoPct')) { strike(near); }
      if (!run) { return; }
      tryShadowSig();                       // §5.1 인물 축 — 그림자 서명
      if (!run) { return; }
    }

    /* 적 */
    for (i = 0; i < room.enemies.length; i++) {
      var en = room.enemies[i];
      if (en.hp <= 0) { continue; }
      en.phase += dt * 7;
      if (en.hurt > 0) { en.hurt -= dt; }
      if (en.pullT > 0) { pullStep(en, dt); }        // §5.19 2차 끌려오는 중
      var ed = dist(en, p);
      var el = en.elite ? eliteOf(en.elite) : null;
      if (el && el.regen && en.hp < en.hpMax) {      // 되살아나는 — 피가 아문다
        en.hp = Math.min(en.hpMax, en.hp + en.hpMax * el.regen * dt);
      }
      /* 부적 '재생' 변형자(§5.3) — 정예 접두 '되살아나는' 위와 같은 결이지만
         전원(잡졸까지)에게 초당 1% */
      if (nmHasMod('regen') && en.hp < en.hpMax) {
        en.hp = Math.min(en.hpMax, en.hp + en.hpMax * 0.01 * dt);
      }
      /* 독(毒) — 몇 초에 걸쳐 들어간다 */
      if (en.dots && en.dots.length) {
        for (var di2 = en.dots.length - 1; di2 >= 0; di2--) {
          var dt2 = en.dots[di2];
          en.hp -= dt2.dps * dt;
          dt2.t -= dt;
          if (dt2.t <= 0) { en.dots.splice(di2, 1); }
        }
        if (en.hp <= 0) { kill(en); if (!run) { return; } continue; }
      }
      /* 빙(氷) — 굼떠진다 */
      var chill = 1;
      if (en.slow > 0) {
        en.slow -= dt;
        chill = 1 - (en.slowMul || 0.45);
      }
      var espd = (62 + Math.min(40, run.floor * 1.5)) *
                 (el && el.spd ? el.spd : 1) * chill *
                 (nmHasMod('speed') ? 1.3 : 1);   // 부적 '광란' 변형자(§5.3)
      /* 궁수·조총병은 붙지 않고 RANGED_STOP 거리에서 멈춘다 — 나머지는 그대로
         닿을 때까지 다가온다(옛 동작과 완전히 같다) */
      var lookW = en.ref && en.ref.look && en.ref.look.weapon;
      var ranged = lookW === 'bow' || lookW === 'staff';
      var stopAt = ranged ? RANGED_STOP : (en.r + P_R - 2);
      /* 잡졸 이동 패턴 — 여태 궁수·조총병 말고는 다 같은 속도로 똑바로 걸어왔다
         (몬스터 다양화의 남은 절반). 무기마다 접근하는 결을 갈랐다 — 판정 값
         (속도·피해)은 안 건드리고 **경로만** 흔든다. `en.phase` 는 이미 dt 로만
         도는 결정적인 값이라 새 Math.random() 을 안 쓴다(진단이 이 흐름의
         Math.random() 순서에 기대지 않게 하려는 뜻이다). */
      var wob = (!ranged && lookW === 'axe') ? Math.sin(en.phase * 0.6) * 0.5 : 0;
      var lunge = (!ranged && lookW === 'club') ? 1 + Math.max(0, Math.sin(en.phase * 0.9)) * 0.7 : 1;
      /* 어그로(2026-09-10, 사용자 요청) — 방에 들어서자마자 방 안 전부가
         한꺼번에 달려오던 것을 고친다. **사거리 안에 들어야 알아챈다**
         (궁수·조총병은 더 멀리서 본다, 정예는 좀 더 예민하다) — 그 전엔
         phase(숨쉬기)만 돌고 가만히 서 있는다. 맞으면 거리와 상관없이
         무조건 깬다(strike()의 wakeEnemy 훅). 보스·미니보스는 spawnEnemy가
         처음부터 aggro:true로 낸다 — 보스방은 원래 들어가는 순간이 곧
         교전이다(살금살금 지나가는 방이 아니다). */
      if (!en.aggro) {
        var aggroR = (ranged ? AGGRO_RANGE_RANGED : AGGRO_RANGE) * (en.elite ? 1.15 : 1);
        if (ed <= aggroR) { wakeEnemy(en); }
      }
      if (en.aggro) {
        if (ed > stopAt) {
          var mvx = (p.x - en.x) / ed, mvy = (p.y - en.y) / ed;
          if (wob) {
            var perpx = -mvy, perpy = mvx;
            mvx += perpx * wob; mvy += perpy * wob;
            var mvl = Math.sqrt(mvx * mvx + mvy * mvy) || 1;
            mvx /= mvl; mvy /= mvl;
          }
          en.x += mvx * espd * lunge * dt;
          en.y += mvy * espd * lunge * dt;
        }
        /* 창·극(戟) 은 자루가 길다 — 몸이 닿기 전에 먼저 닿는다(무기마다 다른
           사거리, 몬스터 다양화의 나머지 절반) */
        var reachBonus = (lookW === 'spear' || lookW === 'halberd') ? 14 : 0;
        en.cd -= dt;
        if (ed <= en.r + P_R + 6 + reachBonus && en.cd <= 0) {
          /* 붙었으면 궁수·조총병도 그냥 몸으로 밀친다(막다른 곳에 몰렸을 때) */
          en.cd = ENEMY_CD * (el && el.cd ? el.cd : 1) / chill;
          hurtPlayer(en.dmg, en.ref && en.ref.atkEl, en);
          if (!run) { return; }
        } else if (ranged && ed > en.r + P_R + 6 && ed <= RANGED_MAX && en.cd <= 0) {
          en.cd = ENEMY_CD * 1.4 * (el && el.cd ? el.cd : 1) / chill;
          var frdx = p.x - en.x, frdy = p.y - en.y;
          var frd = Math.sqrt(frdx * frdx + frdy * frdy) || 1;
          var frEl = (en.ref && en.ref.atkEl) || 'phys';
          run.foeShots.push({
            x: en.x, y: en.y - 8, dx: frdx / frd, dy: frdy / frd, spd: 260, life: 1.8,
            dmg: en.dmg, el: frEl, color: elemColorOf(frEl), from: enemyName(en)
          });
        }

        /* 보스 패턴 — 예고 뒤 터진다(PLAN 15절, `bossPattern()` 참고 —
           무기마다 다르다, 2026-09-05까지는 전부 같은 강타 하나였다) */
        if (en.boss) {
          /* §5.18 명소 층 주인 — 고유 수를 예고·시전하는 동안은 무기 패턴을 쉰다 */
          var gBusy = en.fixedGuard ? stepGuardSig(en, p, dt) : false;
          if (!run) { return; }
          if (!gBusy) { bossPattern(en, p, ed, dt); }
          if (!run) { return; }
        }
      }
    }

    /* 방 정리 판정 */
    if (!room.cleared) {
      var alive = 0;
      /* 들판 로머(`.field`)는 문 열림 판정에서 뺀다 — 방 안 몬스터만 다 잡으면
         된다. 안 그러면 계속 보충되는 필드 로머 때문에 방이 영영 안 열린다 */
      for (i = 0; i < room.enemies.length; i++) {
        if (room.enemies[i].hp > 0 && !room.enemies[i].field) { alive++; }
      }
      if (!alive) {
        room.cleared = true;
        core.emit('dungeon:clear', room);
      }
    }

    /* 바닥에 떨어진 것 줍기 */
    for (i = room.drops.length - 1; i >= 0; i--) {
      var dp = room.drops[i];
      if (dist(p, dp) < P_R + 14) {
        /* take 가 false 를 돌려주면 **바닥에 그대로 둔다** —
           벨트가 찼을 때 물약이 사라지면 원작의 감각이 깨진다 */
        if (take(dp) !== false) { room.drops.splice(i, 1); }
      }
    }

    /* 항아리 — 지나가기만 해도 깨진다. 원작처럼 뭔가 조금 나온다 */
    var dec2 = room.decor || [];
    for (i = 0; i < dec2.length; i++) {
      var jr = dec2[i];
      if (jr.t !== 'jar' || jr.broken) { continue; }
      if (dist(p, jr) > P_R + 16) { continue; }
      jr.broken = true;
      fx.push({ t: 'pop', x: jr.x, y: jr.y, life: 0.3 });
      sfx('jar');
      var roll = Math.random();
      if (roll < 0.42) { dropGold(room, jr.x, jr.y, 0.5); }
      else if (roll < 0.62) { dropPotion(room, jr.x, jr.y); }
      else if (roll < 0.70) { dropMat(room, jr.x, jr.y, -10); }
      else if (roll < 0.74) { dropItem(room, jr.x, jr.y, -8); }
      /* 부적 '매복' 변형자(§5.3) — 절반 확률로 항아리 자리에서 적이 튄다 */
      if (nmHasMod('jar') && Math.random() < 0.5) {
        room.enemies.push(spawnEnemy(run.floor, false, { spawned: true, x: jr.x, y: jr.y }));
        core.emit('toast', '🏺 항아리에서 적이 튀어나왔다!');
      }
    }

    /* 함정(spike) — 항아리처럼 한 번 깨지고 끝이 아니라, 벗어날 때까지
       주기적으로(1.2초 간격) 문다. 독(毒) 원소 공식을 그대로 빌려 쓴다 —
       `applyElem`이 적에게 `e.dots`를 얹는 것과 같은 자리(`update()` 위쪽의
       `p.dots` 틱)에 dps·t 를 얹기만 한다. 새 피해 공식은 안 만든다 —
       크기는 `enemyDmg`(이 층 몬스터 한 대 값)의 절반을 저항 뺀 뒤 3초에
       걸쳐 나눠 문다. */
    for (i = 0; i < dec2.length; i++) {
      var sp = dec2[i];
      if (sp.t !== 'spike') { continue; }
      if (sp.cd > 0) { sp.cd -= dt; continue; }
      if (dist(p, sp) > P_R + sp.r) { continue; }
      sp.cd = 1.2;
      var ED2 = global.DG.elemData;
      var poisDef = ED2 && ED2.elemByKey('pois');
      if (poisDef && run.player.invuln <= 0) {
        var spV = Math.max(1, Math.round(enemyDmg(run.floor, false) * 0.5 *
          (1 - elemResOf('pois') / 100)));
        if (!p.dots) { p.dots = []; }
        p.dots.push({ dps: spV / poisDef.dot, t: poisDef.dot });
        fx.push({ t: 'elem', x: p.x, y: p.y - P_R - 6, v: spV, el: 'pois',
                  color: poisDef.color, life: 0.6, dot: true });
        sfx('hurt');
      }
    }

    /* 상자 · 우물 · 사당 */
    if (room.chest && !room.chest.taken && room.cleared && dist(p, room.chest) < P_R + 20) {
      room.chest.taken = true;
      var bonus = 1 + Math.floor(Math.random() * 2);
      for (var c = 0; c < bonus; c++) {
        dropItem(room, room.chest.x, room.chest.y, 22);
      }
      dropGold(room, room.chest.x, room.chest.y, 3);
      sfx('chest');
      core.emit('toast', '🎁 보물상자!');
    }
    if (room.grave && !room.grave.taken && dist(p, room.grave) < P_R + 20) {
      room.grave.taken = true;
      openGrave();
      sfx('shrine');
      core.emit('toast', '🪦 유품 발견 · 되찾을 것을 고르세요');
    }
    if (room.well && !room.well.used && dist(p, room.well) < P_R + 20) {
      room.well.used = true;
      healBy(run.hpMax * 0.4);
      sfx('well');
      core.emit('toast', '💧 우물 · 체력 40% 회복');
    }
    if (room.shrine && !room.shrine.used && room.cleared && dist(p, room.shrine) < P_R + 20) {
      room.shrine.used = true;
      shrineBoon();
      sfx('shrine');
      core.emit('toast', '⛩️ 사당 · 은사를 고르세요');
    }
    if (room.vein && !room.vein.used && room.cleared && dist(p, room.vein) < P_R + 20) {
      /* 채광방(POI: Cave) — 광맥을 캔다. 상자·사당과 같은 손짓(지킴이가
         있을 수 있으니 방을 다 치운 뒤에만)이지만, 나오는 것은 재료 둘
         확정이다(우물의 회복량 40% 만큼 후하게 잡았다) */
      room.vein.used = true;
      dropMat(room, room.vein.x, room.vein.y, 26);
      dropMat(room, room.vein.x, room.vein.y, 26);
      sfx('chest');
      core.emit('toast', '⛏️ 광맥 · 세공 재료를 캤다');
    }
    if (room.merchant && !room.merchant.used && room.cleared && dist(p, room.merchant) < P_R + 20) {
      room.merchant.used = true;
      run.merchantChoice = rollMerchantStock(run.floor);
      sfx('shrine');
      core.emit('toast', '🧺 행상 · 살 것을 고르세요');
    }
    /* 방랑 상인(들판) — room.cleared 를 안 본다. 방을 치우고 말고와 상관없이
       들판에서 그냥 마주치는 사람이다(spawnFieldMerchant) */
    if (room.npcs) {
      for (var fmI = 0; fmI < room.npcs.length; fmI++) {
        var fm = room.npcs[fmI];
        if (fm.fieldMerchant && !fm.used && dist(p, fm) < P_R + 20) {
          fm.used = true;
          run.merchantChoice = rollMerchantStock(run.floor);
          sfx('shrine');
          core.emit('toast', '🧺 방물장수 · 살 것을 고르세요');
          room.npcs.splice(fmI, 1);
          break;
        }
      }
    }
    if (room.puzzle && !room.puzzle.solved) {
      var pz = room.puzzle;
      for (var pk = 0; pk < pz.pods.length; pk++) {
        var pod = pz.pods[pk];
        var podNear = dist(p, pod) < P_R + 20;
        if (podNear && !pod.near) { touchPuzzlePod(room, pz, pod); }
        pod.near = podNear;
      }
    }
    if (room.captive && !room.captive.freed && room.cleared && dist(p, room.captive) < P_R + 20) {
      /* 이벤트방(POI: Event) — 구출. 사당과 달리 고르지 않고 바로 하나
         얹는다("받은 은혜" 라는 뜻이다) */
      room.captive.freed = true;
      var freePool = [], fi;
      for (fi = 0; fi < DD.BOONS.length; fi++) {
        var fb = DD.BOONS[fi];
        if ((run.boons[fb.key] || 0) < fb.max) { freePool.push(fb.key); }
      }
      if (freePool.length) {
        var freeKey = freePool[Math.floor(Math.random() * freePool.length)];
        var gotBoon = applyBoon(freeKey);
        if (gotBoon) { core.log('🙏 구출 · 은사 ' + gotBoon.name + ' (' + run.boons[freeKey] + '중첩)', 'good'); }
      }
      dropItem(room, room.captive.x, room.captive.y, 16);
      dropGold(room, room.captive.x, room.captive.y, 2);
      sfx('shrine');
      core.emit('toast', '🙏 구출 · 은혜를 갚는다');
      core.emit('dungeon:rescue', { floor: run.floor });
    }
    if (room.forage) {
      /* 약초 — 항아리와 같은 손짓(닿기만 해도, 방을 안 치워도) */
      var fg = room.forage;
      for (var fhi = 0; fhi < fg.herbs.length; fhi++) {
        var herb = fg.herbs[fhi];
        if (herb.picked || dist(p, herb) > P_R + 16) { continue; }
        herb.picked = true;
        fx.push({ t: 'pop', x: herb.x, y: herb.y, life: 0.3 });
        sfx('jar');
        dropPotion(room, herb.x, herb.y);
      }
      /* 못 — 우물·사당과 같은 손짓(방을 다 치운 뒤 한 번) */
      if (fg.pond && !fg.pond.used && room.cleared && dist(p, fg.pond) < P_R + 20) {
        fg.pond.used = true;
        var catchRoll = Math.random();
        if (catchRoll < 0.5) { dropGold(room, fg.pond.x, fg.pond.y, 1.4); }
        else if (catchRoll < 0.85) { dropMat(room, fg.pond.x, fg.pond.y, 10); }
        else { dropItem(room, fg.pond.x, fg.pond.y, 6); }
        sfx('chest');
        core.emit('toast', '🎣 손맛 · 무언가 걸렸다');
      }
    }
    /* 비밀(POI: Secret) — 균열들 사이에 숨어 있다. 문 목록엔 아예 없으므로
       여기서 방마다 있는 균열을 훑어 찾는다(있으면 하나뿐이다) */
    for (i = 0; i < room.decor.length; i++) {
      var dc = room.decor[i];
      if (!dc.secret || dc.found) { continue; }
      var dcNear = dist(p, dc) < P_R + 22;
      if (dcNear && !dc.near) {
        dc.found = true;
        dropItem(room, dc.x, dc.y, 24);
        dropGold(room, dc.x, dc.y, 2.6);
        sfx('chest');
        core.emit('toast', '🔍 비밀 통로를 찾았다!');
      }
      dc.near = dcNear;
    }

    /* 문 — 통로 반대쪽 끝에 닿아야 실제로 넘어간다(PLAN §28-4 Phase 2).
       동쪽 벽을 스치자마자 즉시 goRoom() 하던 것을, boundPlayer()가 이제
       그 문의 결(lane)에서 열어 주는 짧은 통로(doorCorridorUnits())를
       끝까지 걸어야 걸리게 미뤘다 — travel()이 마을 통로 끝에서 걸리는
       것과 같은 요령이다. **중복 발동 걱정이 없다** — goRoom()이 방을
       통째로 새로 지어 `room.doors` 자체가(그리고 이 문의 `dr.y`도)
       사라지므로, 다음 프레임엔 이 조건이 다른(새) 문 목록을 본다. */
    if (room.cleared) {
      var doorFarX = ROOM_W - WALL - P_R + doorCorridorUnits();
      for (i = 0; i < room.doors.length; i++) {
        var dr = room.doors[i];
        if (p.x > doorFarX - 4 && Math.abs(p.y - dr.y) < 34) {
          sfx('door');
          goRoom(dr.kind);
          break;
        }
      }
    }

    /* 잠깐짜리 무예가 식는다 */
    if (run.buffs) {
      for (var bk in run.buffs) {
        if (!Object.prototype.hasOwnProperty.call(run.buffs, bk)) { continue; }
        run.buffs[bk].t -= dt;
        if (run.buffs[bk].t <= 0) { delete run.buffs[bk]; }
      }
    }
    /* 저주가 풀린다 */
    for (i = 0; i < room.enemies.length; i++) {
      var hx = room.enemies[i].hex;
      if (hx && hx.t > 0) {
        hx.t -= dt;
        if (hx.t <= 0) { room.enemies[i].hex = null; }
      }
    }
    /* 분신이 대신 싸운다 */
    updateMinions(dt);
    if (!run) { return; }
    /* 동행(2번째 인물)이 곁에서 같이 싸운다 (PLAN §51) */
    updateCompanion(dt);
    if (!run) { return; }

    /* 연출 수명 */
    for (i = fx.length - 1; i >= 0; i--) {
      fx[i].life -= dt;
      if (fx[i].life <= 0) { fx.splice(i, 1); }
    }
  }

  var COMBO_WINDOW = 1.6;   // 이 안에 다시 안 때리면 콤보가 끊긴다(초)

  /**
   * 어그로 — 이 적이 플레이어를 알아챈다. 이미 깨어 있으면 아무 일도 없다
   * (값싸게 여러 번 불러도 된다 — 매 틱 사거리 체크가 그렇게 부른다).
   * 그 자리서 "!"가 뜨고(기존 fx 'get' 텍스트 팝업을 그대로 쓴다, 새 렌더
   * 코드 없음), AGGRO_PACK_R 안의 아직 안 깬 동료도 **연쇄로** 같이 깬다 —
   * 원작에서 몹 하나가 터지면 무리가 통째로 달려오는 그 감각이다. `strike()`
   * 가 맞을 때마다 불러 "몰래 지나칠 수는 있어도 몰래 때릴 수는 없다"를
   * 지킨다. `run`/`fx`는 이 시점에 항상 유효하다(update()·stepFieldCombat
   * 안에서만 불린다, withRun이 이미 알맞은 것으로 바꿔 끼운 뒤다).
   */
  function wakeEnemy(en) {
    if (!en || en.aggro || en.hp <= 0) { return; }
    en.aggro = true;
    fx.push({ t: 'get', x: en.x, y: en.y - en.r - 14, text: '!', life: 0.5, color: '#ffcf4d' });
    sfx('alert');
    if (!run.room) { return; }
    var list = run.room.enemies, i;
    for (i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === en || o.hp <= 0 || o.aggro) { continue; }
      if (dist(o, en) <= AGGRO_PACK_R) { wakeEnemy(o); }
    }
  }

  /**
   * 한 대 때린다.
   * @param mul  스킬 배율 (기본 1)
   * @param kb   밀쳐내는 거리 (기본 8 — 타격감의 핵심)
   */
  /**
   * @param kind 'phys'(칼) | 'chi'(기) — 적의 저항이 이 결을 보고 깎는다.
   *             안 주면 물리다(평타·회전참·돌진).
   */
  /** §5.1 세계 축 — 이 결이 이번 타격에 실려 있나(무기 자체 결 kind, 또는
   *  보석으로 박은 결 edmg[el]>0). phys는 edmg에 없는 자리라 kind로만 본다. */
  function hasElemInHit(el, kind, edmg) {
    if (el === 'phys') { return kind === 'phys'; }
    return kind === el || (edmg[el] || 0) > 0;
  }
  /** 반경 안의 살아 있는 다른 적 (world 축 처치·크리 부가효과가 같이 쓴다) */
  function nearbyAlive(center, r) {
    var out = [];
    if (!run || !run.room) { return out; }
    for (var i = 0; i < run.room.enemies.length; i++) {
      var t = run.room.enemies[i];
      if (t === center || t.hp <= 0) { continue; }
      if (dist(t, center) <= r + (t.r || 0)) { out.push(t); }
    }
    return out;
  }
  function addDot(t, el, dps, sec) {
    if (!t.dots) { t.dots = []; }
    t.dots.push({ el: el, dps: dps, t: sec });
  }

  function strike(e, mul, kb, kind) {
    kind = kind || 'phys';
    wakeEnemy(e);
    var edmg = elemDmgOf();
    var hasWd = function (k) { return !!(run && run.boons[k]); };
    var hasEl = function (el) { return hasElemInHit(el, kind, edmg); };
    var dmg = atkOf() * (mul || 1) * (0.86 + Math.random() * 0.28);
    /* 세계 보스(§5.4) 머리 부위 파괴 — 급소가 열려 크리 확률 +15%p */
    var critChance = boonVal('critPct') + core.effect('critPct') + (e.wbHelmBroken ? 15 : 0);
    var crit = forcedCrit !== null ? forcedCrit : (Math.random() * 100 < critChance);
    /* §5.1 세계 축 — 뇌빙(빙+뇌): 슬로우된 적에게 뇌 결이 닿으면 반드시 크리 */
    if (!crit && e.slow > 0 && hasEl('lit') && hasWd('wd_cold_lit')) { crit = true; }
    if (crit) { dmg *= 1.85; }
    dmg *= 1 + boonVal('piercePct') / 100 * 0.5;
    /* §5.1 세계 축 — 결빙(빙+기): 슬로우된 적에게 주는 피해 +30% */
    if (e.slow > 0 && hasWd('wd_cold_chi')) { dmg *= 1.3; }
    /* §5.1 세계 축 — 빙염(화+빙): 화상과 슬로우가 겹친 적에게 +15% */
    if (e.slow > 0 && hasWd('wd_fire_cold') && e.dots &&
        e.dots.some(function (d) { return d.el === 'fire'; })) {
      dmg *= 1.15;
    }
    /* 주박·멸에 걸린 적은 더 아파한다 */
    if (e.hex && e.hex.t > 0) { dmg *= 1 + e.hex.v / 100; }
    /* 저항 — 관통(貫通) 은사가 저항도 절반만큼 뚫는다(방어를 무시하듯) */
    var res = resistOf(e, kind) * (1 - boonVal('piercePct') / 100 * 0.5);
    /* §5.1 세계 축 — 부식(독+전자): 저항 -20 */
    if (hasEl('pois') && hasEl('emp') && hasWd('wd_pois_emp')) { res = Math.max(0, res - 20); }
    if (res > 0) { dmg *= 1 - res / 100; }
    if (nmHasMod('glass')) { dmg *= 1.5; }   // 부적 '유리대포' 변형자(§5.3) — 주는 피해도 는다
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.hurt = 0.08;   /* §5.8① 피격 플래시 80ms(적 전용 — 플레이어 쪽 hurtTint 는 안 건드림) */
    /* §5.19 경직 — 맞으면 다음 공격이 조금 밀린다(보스는 안 밀린다). 떼를 몰아 치는 동안 숨 쉴 틈 */
    if (!e.boss && STAGGER() > 0) { e.cd = Math.max(e.cd || 0, STAGGER()); }
    /* §5.1 세계 축 — 크리티컬 부가효과 둘 */
    if (crit && hasWd('wd_phys_cold') && hasEl('phys')) {
      e.slow = Math.max(e.slow || 0, 2); e.slowMul = 0.6;   // 빙인
    }
    if (crit && hasWd('wd_fire_chi') && hasEl('fire')) {
      var burned = nearbyAlive(e, 80), bi;                   // 폭기
      for (bi = 0; bi < burned.length; bi++) { addDot(burned[bi], 'fire', Math.max(1, Math.round(dmg * 0.12)), 2); }
    }
    /* 넉백 — 보스는 거의 안 밀린다 */
    var push = (kb === undefined ? 8 : kb) * (e.boss ? 0.25 : 1);
    if (push && run) {
      var p = run.player;
      var dx = e.x - p.x, dy = e.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      /* 들판 로머(`.field`)는 `core.clamp(..., WALL+e.r, ROOM_W-WALL-e.r)`로
         **못 미는다** — 그 범위가 "방 안쪽"이라, 방 밖 로머에 그대로 쓰면
         맞을 때마다 방 안으로 순간이동해 버린다(예전에 밟은 함정, 아래
         주석이 그 기억이다).
         2026-09-06 — 그런데 그 대신 **아예 안 막았더니**, 플레이어가 로머보다
         마을 바깥쪽에 서서 때리면 넉백 방향(플레이어 반대쪽)이 마을 쪽을
         가리켜 로머가 벽을 그대로 뚫고 들어갔다("마을에 몹이 들어온다",
         사용자 제보). `stepFieldCombat`의 이동 clamp(위 "축을 나눠 막아…")와
         **같은 요령**으로 고쳤다 — 방 안쪽으로 넣는 축만 한쪽씩 막는다.
         `run`이 마을이면(`town.js`의 raw()) roomW 등이 실려 있어 그 치수로,
         던전이면(그 필드 없음) inRoomRect가 이 모듈의 ROOM_W 등으로
         저절로 넘어간다 — ctx를 새로 안 만들어도 된다. */
      if (e.field) {
        var kx = e.x + dx / d * push, ky = e.y + dy / d * push;
        if (!inRoomRect(kx, e.y, run)) { e.x = kx; }
        if (!inRoomRect(e.x, ky, run)) { e.y = ky; }
      } else {
        e.x = core.clamp(e.x + dx / d * push, WALL + e.r, ROOM_W - WALL - e.r);
        e.y = core.clamp(e.y + dy / d * push, WALL + e.r, ROOM_H - WALL - e.r);
      }
      fx.push({ t: 'slash', x: e.x, y: e.y - e.r * 0.6,
        a: Math.atan2(dy, dx), life: 0.16, crit: crit,
        el: kind !== 'phys' ? kind : null, color: kind !== 'phys' ? elemColorOf(kind) : null });
    }
    fx.push({ t: 'hit', x: e.x, y: e.y - e.r, v: dmg, crit: crit, life: 0.6,
              resist: res >= 20 });
    /* §5.8③ 성장 가시화 — 보물(3) 이상 무기는 때릴 때마다 잔광, 전설(4)은
       파티클(burst)도 하나 더 — 새 3D 지오메트리 없이 기존 fx 표만 재사용 */
    var wTier = weaponTierOf();
    if (wTier >= 3) {
      fx.push({ t: 'trail', x: e.x, y: e.y - e.r * 0.4, life: wTier >= 4 ? 0.3 : 0.22,
        color: wTier >= 4 ? '#c7a76c' : '#00c000' });
    }
    if (wTier >= 4) {
      fx.push({ t: 'burst', x: e.x, y: e.y - e.r * 0.4, life: 0.3, color: '#c7a76c',
        seed: Math.random() * 6.28 });
    }
    /* 연속 타격(콤보) — COMBO_WINDOW 안에 다시 때리면 쌓인다(update()가 끊는다).
       PLAN 15절 "필수: 콤보" — 3부터 화면에 띄운다(1·2는 콤보라 부르기 민망하다).
       §5.8① 타격음 라운드로빈이 이 값을 쓰므로 소리보다 먼저 올린다. */
    run.combo = (run.combo || 0) + 1;
    run.comboT = COMBO_WINDOW;
    if (crit) { sfx('crit'); } else { hitSfx(); }

    /* §5.8① 타격 정지(hitstop) — 잡졸 60ms·정예 90ms·크리 120ms(2026-09-18,
       기존엔 크리·평타 둘뿐이었다). update()가 dt를 확 줄여 몇 프레임
       묵직하게 만든다. `hitstop` 설정이 꺼져 있으면 아예 안 건다(멀미 배려). */
    if (hitstopEnabled()) {
      var hsMs = crit ? 120 : (e.elite ? 90 : 60);
      run.hitstopT = Math.max(run.hitstopT || 0, hsMs / 1000);
    }
    if (run.combo >= 3 && run.player) {
      fx.push({ t: 'get', x: run.player.x, y: run.player.y - P_R - 30,
        text: run.combo + ' 연속!', life: 0.5,
        color: run.combo >= 12 ? '#ff5a5a' : (run.combo >= 6 ? '#ffb454' : '#ffe066') });
    }
    /* §5.1 세계 축 — 작열(물리+화): 콤보 6 이상에서 물리 타격에 화상 */
    if (hasWd('wd_phys_fire') && hasEl('phys') && hasEl('fire') && run.combo >= 6) {
      addDot(e, 'fire', Math.max(1, Math.round(dmg * 0.15)), 2);
    }
    /* §5.1 세계 축 — 경혈(물리+기): 3연속마다 기력 회복 */
    if (hasWd('wd_phys_chi') && hasEl('phys') && hasEl('chi') && run.combo % 3 === 0) {
      run.mp = Math.min(run.mpMax, run.mp + 5);
    }

    /* 원소 — 무기에 박은 보석이 얹는다. **결마다 저항이 따로**다(원작과 같다).
       한 대에 여러 결이 같이 들어갈 수 있다 — 원작의 무기 피해가 그렇다. */
    applyElem(e, mul || 1);
    /* 가시 돋친 정예 — 때린 만큼 조금 되돌아온다 */
    var elS = e.elite ? eliteOf(e.elite) : null;
    if (elS && elS.thorn && e.hp > 0) {
      hurtPlayer(Math.max(1, Math.round(dmg * elS.thorn)), null, e, '가시 되받기');
      if (!run) { return; }
    }
    if (e.hp <= 0) { e.dieKb = push; e.dieOver = dmg / Math.max(1, e.hpMax); kill(e, kind, dmg); }
  }

  /**
   * 원소 피해 한 묶음. 결마다 성질이 다르다 (data-elem.js):
   *   빙 느리게 · 뇌 편차 크게 · 독 몇 초에 걸쳐 · 화·기 곧게.
   * 물리는 여기 안 온다 — 무기 자체가 물리다.
   */
  function applyElem(e, mul) {
    var ED = global.DG.elemData;
    if (!ED) { return; }
    var dmgs = elemDmgOf(), k;
    for (k in dmgs) {
      if (!Object.prototype.hasOwnProperty.call(dmgs, k) || !dmgs[k]) { continue; }
      var def = ED.elemByKey(k);
      if (!def) { continue; }
      var v = dmgs[k] * mul * (1 + run.floor * 0.06);
      if (def.spread) {                       // 뇌 — 편차가 크다
        v *= 1 - def.spread / 2 + Math.random() * def.spread;
      }
      var er = resistOf(e, k);
      v *= 1 - er / 100;
      v = Math.max(1, Math.round(v));

      if (def.dot) {                          // 독 — 몇 초에 걸쳐
        if (!e.dots) { e.dots = []; }
        e.dots.push({ el: k, dps: v / def.dot, t: def.dot });
      } else {
        e.hp -= v;
      }
      if (def.slow) {                         // 빙 — 굼떠진다
        e.slow = Math.max(e.slow || 0, def.slowSec);
        e.slowMul = def.slow;
      }
      fx.push({ t: 'elem', x: e.x + (Math.random() - 0.5) * 10, y: e.y - e.r - 6,
                v: v, el: k, color: def.color, life: 0.6, dot: !!def.dot });
    }
  }

  /** @param {string} [kind] 마지막 일격의 결 — §5.1 세계 축 처치 시너지가 본다
   *  @param {number} [dmg] 마지막 일격의 피해량 — 시너지 부가 피해의 기준값 */
  function kill(e, kind, dmg) {
    run.kills += 1;
    /* §5.19 쓰러짐 연출 — 화면 층(dungeon3d)이 이 방향으로 날려 눕힌다(판정은 안 쓴다) */
    if (run.player) {
      var kdx = e.x - run.player.x, kdy = e.y - run.player.y, kdl = Math.sqrt(kdx * kdx + kdy * kdy) || 1;
      e.dieDx = kdx / kdl; e.dieDy = kdy / kdl; e.dieBig = !!(e.boss || e.elite);
      dieScatter(e);
    }
    dstate().kills = (dstate().kills || 0) + 1;
    /* 처치는 한 대 맞은 것보다 더 묵직하게 — §5.8① 3단(잡졸/정예/크리)의
       대상이 아니라("처치"는 그 셋과 다른 결의 이벤트) 값은 그대로 두고
       설정 손잡이만 같이 탄다 */
    if (hitstopEnabled()) {
      run.hitstopT = Math.max(run.hitstopT || 0, e.boss ? 0.18 : 0.11);
    }
    core.emit('dungeon:kill', { e: e, floor: run.floor });
    /* §5.1 세계 축 — 처치 트리거 3종(폭발·부패·저지, 전부 반경 80) */
    if (run.boons && kind) {
      var kEdmg = elemDmgOf();
      var kHasEl = function (el) { return hasElemInHit(el, kind, kEdmg); };
      if (run.boons.wd_fire_lit && kHasEl('fire') && kHasEl('lit')) {
        var b1 = nearbyAlive(e, 80), i1;
        for (i1 = 0; i1 < b1.length; i1++) { addDot(b1[i1], 'fire', Math.max(1, Math.round((dmg || 1) * 0.15)), 3); }
      }
      if (run.boons.wd_phys_pois && kHasEl('phys') && kHasEl('pois')) {
        var b2 = nearbyAlive(e, 80), i2;
        for (i2 = 0; i2 < b2.length; i2++) { addDot(b2[i2], 'pois', Math.max(1, Math.round((dmg || 1) * 0.12)), 3); }
      }
      if (run.boons.wd_phys_emp && kHasEl('phys') && kHasEl('emp')) {
        var b3 = nearbyAlive(e, 80), i3;
        for (i3 = 0; i3 < b3.length; i3++) { b3[i3].slow = Math.max(b3[i3].slow || 0, 2.5); b3[i3].slowMul = 0.55; }
      }
      /* 감전(물리+뇌) — 재귀 strike() 없이 즉발 피해만(연쇄가 서로를 다시
         트리거하는 무한 루프를 피한다) */
      if (run.boons.wd_phys_lit && kHasEl('phys') && kHasEl('lit')) {
        var near4 = nearbyAlive(e, 80);
        if (near4.length) {
          var t4 = near4[0];
          t4.hp -= Math.max(1, Math.round((dmg || 1) * 0.5));
          fx.push({ t: 'elem', x: t4.x, y: t4.y - (t4.r || 0) - 6, v: Math.round((dmg || 1) * 0.5),
            el: 'lit', color: elemColorOf('lit'), life: 0.6, dot: false });
        }
      }
    }
    var drain = boonVal('drainPct');
    if (drain) { healBy(run.hpMax * drain / 100); }
    run.mp = Math.min(run.mpMax, run.mp + MP_ON_KILL);
    fx.push({ t: 'pop', x: e.x, y: e.y, life: 0.45, boss: e.boss });
    fx.push({ t: 'burst', x: e.x, y: e.y - e.r * 0.5, life: 0.5, boss: e.boss,
      color: (e.ref && e.ref.color) || '#c9a83a', seed: Math.random() * 6.28 });
    sfx(e.boss ? 'boss' : 'kill');
    var elK = e.elite ? eliteOf(e.elite) : null;
    if (elK && elK.split && !e.shade) {
      /* 그림자 — 쓰러진 자리에 분신이 선다 (원작의 분열 몬스터) */
      for (var sp = 0; sp < elK.split; sp++) {
        var kid = spawnEnemy(run.floor, false, {
          spawned: true, shade: true,
          x: core.clamp(e.x + (sp ? 22 : -22), WALL + 12, ROOM_W - WALL - 12),
          y: core.clamp(e.y + (sp ? 14 : -14), WALL + 12, ROOM_H - WALL - 12)
        });
        run.room.enemies.push(kid);
      }
      core.emit('toast', '👤 그림자가 갈라졌다');
    }
    dropGold(run.room, e.x, e.y, e.boss ? 5 : (elK ? 2.2 : (e.minion ? 0.4 : 1)));
    /* 정예는 원작처럼 **확정으로** 떨어뜨린다 · 무리 졸개(§5.19)는 잡졸의 절반 */
    var chance = e.boss ? 1 : (elK ? 1 : (0.2 + Math.min(0.15, run.floor * 0.004)) * (e.minion ? 0.5 : 1));
    if (Math.random() < chance) {
      dropItem(run.room, e.x, e.y, e.boss ? 30 : (elK ? 14 : 0));
    }
    /* 세공 재료 — 장비보다 자주 나온다(박을 자리는 늘 모자라다) */
    if (Math.random() < (e.boss ? 0.9 : 0.12)) {
      dropMat(run.room, e.x, e.y, e.boss ? 30 : 0);
    }
    /* 단약 — 원작에서 **가장 흔한 드랍**이다. 벨트가 비면 싸움을 이어 갈 수 없다 */
    if (Math.random() < (e.boss ? 1 : (elK ? 0.34 : 0.16))) {
      dropPotion(run.room, e.x, e.y);
    }
    /* 감정서 — 미확인 물건이 쌓이는 속도에 맞춰 나온다.
       모자라면 행상에서 싸게 산다(막는 관문이 아니라 거쳐 가는 자리다) */
    if (Math.random() < (e.boss ? 0.8 : 0.07)) {
      run.room.drops.push({ kind: 'scroll', x: jitter(e.x), y: jitter(e.y) });
    }
    core.gainExp(Math.round((1 + Math.floor(run.floor / 3)) * mode().exp * RG()));
    global.DG.hero.awardParty(1 + Math.floor(run.floor / 4));
    tryCatchPet(e);
    /* 세계 보스(§5.4) — 위 일반 처치 보상(run.floor=0 이라 미미하다)과
       별개로, best 층 기준의 참가 보상을 따로 준다(아래 grantWorldBossReward). */
    if (e.worldBoss) { grantWorldBossReward(e, run.room, false); }
    if (e.regionBoss) { grantRegionBossReward(e, run.room); }
    if (e.fixedGuard) { grantFixedReward(e, run.room); }
    if (run.trial) { trialOnKill(e); }
  }

  /* 2026-09-10 — "강공격이랑 전용 회피 버튼도"(사용자). 평타(위 update() "내
     공격")는 자동이고 무예(Z X C V)는 MP·슬롯이 든다 — 그 사이에 **아무나
     처음부터, 쿨다운만으로** 쓰는 기본기 둘을 놓는다. PLAN 15절 "필수" 목록의
     "강공격"·"회피"에 정확히 대응한다. */
  var HEAVY_CD = 1.3, HEAVY_MUL = 2.6, HEAVY_KB = 26, HEAVY_RECOVER = 0.16;
  var DODGE_CD = 0.9, DODGE_SEC = 0.16, DODGE_SPD = 520, DODGE_INVULN = 0.22;
  /* §5.8② 저스트 회피(2026-09-18) — 적 공격이 0.15초 안에 터질 때 회피하면
     보너스. **보스 패턴(`en.slamWarn`)만** 예고(telegraph)가 있다 — 잡몹은
     `en.cd<=0`이면 그 프레임에 바로 맞는 구조라 예고 자체가 없다. 잡몹까지
     다루려면 전투 AI 전체에 새 예고 타이머를 얹어야 해 범위 밖으로 뒀다
     (이번 구현이 스스로 내린 판단 — 사용자와 상의한 적 없다). */
  var JUST_DODGE_WINDOW = 0.15, JUST_DODGE_SLOW = 0.2;
  function justDodgeTarget() {
    if (!run || !run.room) { return null; }
    var list = run.room.enemies, i;
    for (i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.hp > 0 && e.slamWarn > 0 && e.slamWarn <= JUST_DODGE_WINDOW) { return e; }
    }
    return null;
  }

  /** 강공격 — 평타보다 훨씬 세고 크게 밀치지만, 감아 치는 동안(HEAVY_RECOVER)
   *  평타가 못 낀다(atkCd를 같이 밀어 둔다) 그리고 쿨다운이 있다.
   *  사거리 안에 적이 없으면 그냥 아무 일도 안 일어난다(헛손질 연출은 안 둔다
   *  — 평타도 표적이 없으면 아예 안 그린다, 같은 결). */
  function heavyAttack() {
    if (!run) { return false; }
    var p = run.player;
    if (p.heavyCd > 0 || p.dash || p.dodge) { return false; }
    var reach = reachOf() * 1.15, room = run.room;
    var near = null, nd = 1e9, i;
    for (i = 0; i < room.enemies.length; i++) {
      var e = room.enemies[i];
      if (e.hp <= 0) { continue; }
      var d = dist(run.player, e) - e.r;
      if (d < nd) { nd = d; near = e; }
    }
    if (!near || nd > reach) { return false; }
    p.heavyCd = HEAVY_CD;
    p.atkCd = Math.max(p.atkCd, HEAVY_RECOVER);
    p.atkAnim = 0.38;                    // 평타(0.22)보다 오래 자세가 남는다 — 묵직한 스윙
    p.castAnim = false;
    sfx('heavy');
    strike(near, HEAVY_MUL, HEAVY_KB);
    if (run && CLEAVE_ON()) { cleave(near, reach * HEAVY_R, HEAVY_HALF, HEAVY_MUL * HEAVY_SIDE, HEAVY_KB); }
    return true;
  }

  /**
   * §5.19 휩쓸기 — 가장 가까운 적(`main`)을 친 뒤, 나에서 그 적 쪽 부채꼴(반각 half) 안·반경 R 안의
   * **다른** 적을 mul 배로 함께 벤다. 한 대마다 `strike()` 를 거친다(모든 피해가 지나는 유일한 통로 — PLAN §2).
   * 목록은 미리 떠 둔다 — 그림자 분열(strike → kill)이 도중에 배열을 늘린다
   */
  function cleave(main, R, half, mul, kb) {
    if (!run || !run.room) { return; }
    var p = run.player, a0 = Math.atan2(main.y - p.y, main.x - p.x);
    var list = run.room.enemies.slice(), i;
    for (i = 0; i < list.length && run; i++) {
      var e = list[i];
      if (e === main || e.hp <= 0) { continue; }
      if (dist(p, e) - e.r > R) { continue; }
      var da = Math.atan2(e.y - p.y, e.x - p.x) - a0;
      while (da > Math.PI) { da -= Math.PI * 2; }
      while (da < -Math.PI) { da += Math.PI * 2; }
      if (Math.abs(da) > half) { continue; }
      strike(e, mul, kb);
    }
  }

  /**
   * §5.19 2차 쓰러짐 흩어짐 — 떼가 한꺼번에 쓰러질 때 모두 같은 결로 곧게 날지 않고 부채처럼 흩어진다.
   * 방향을 ±0.45 라디안 흔들고(쓰러진 자리의 해시 — 난수 0), 세게 맞을수록(밀침·넘친 피해) 멀리 날고 빙글 돈다.
   * 그림 층(dungeon3d)만 읽는다 — 판정은 이미 끝났다
   */
  function dieScatter(e) {
    var s = SCATTER();
    e.dieF = 1; e.dieSpin = 0;
    if (!s) { return; }
    var qx = Math.round(e.x * 3), qy = Math.round(e.y * 3);
    var h = core.hash2(qx, qy), h2 = core.hash2(qy + 7, qx + 11);
    var j = (h - 0.5) * 0.9 * s, cj = Math.cos(j), sj = Math.sin(j);
    var dx = e.dieDx * cj - e.dieDy * sj, dy = e.dieDx * sj + e.dieDy * cj;
    e.dieDx = dx; e.dieDy = dy;
    var kb = e.dieKb || 0, over = Math.min(2, e.dieOver || 0);
    var f = core.clamp(0.7 + kb / 40 + over * 0.35 + h2 * 0.3, 0.7, 2.4);
    e.dieF = 1 + (f - 1) * s;
    e.dieSpin = (h2 - 0.5) * 2 * Math.min(1.5, kb / 30) * s;
  }

  /** §5.19 2차 — 적 e 가 나(p)에서 a0 쪽 반각 half 부채꼴 안에 드나. 몸이 겹친 적은 늘 든다(발밑을 헛치지 않게) */
  function inArc(p, e, a0, half) {
    if (dist(p, e) <= (e.r || 12) + P_R) { return true; }
    var da = Math.atan2(e.y - p.y, e.x - p.x) - a0;
    while (da > Math.PI) { da -= Math.PI * 2; }
    while (da < -Math.PI) { da += Math.PI * 2; }
    return Math.abs(da) <= half;
  }

  /** 원뿔 무예의 방향 — 반경 1.2배 안의 가장 가까운 적, 없으면 마지막 걸음 방향 */
  function coneAim(R) {
    var p = run.player, best = null, bd = R * 1.2, i, es = run.room.enemies;
    for (i = 0; i < es.length; i++) {
      if (es[i].hp <= 0) { continue; }
      var d0 = dist(p, es[i]);
      if (d0 < bd) { bd = d0; best = es[i]; }
    }
    if (best) { return Math.atan2(best.y - p.y, best.x - p.x); }
    return Math.atan2(p.dirY || 0, p.dirX || p.facing || 1);
  }

  /** 원뿔 궤적 — 부채꼴을 세 획(fx 'fan')으로 긋는다. 판정은 안 쓴다 */
  function pushFanFx(p, a0, half, R, el) {
    for (var s = -1; s <= 1; s++) {
      var ang = a0 + s * half * 0.6;
      fx.push({ t: 'fan', x: p.x + Math.cos(ang) * R * 0.5, y: p.y + Math.sin(ang) * R * 0.5, a: ang,
        r: R * 0.55, life: 0.26, color: el ? elemColorOf(el) : null });
    }
  }

  /**
   * §5.19 2차 끌어당기기 — 반경 R 안의 적을 PULL_SEC 동안 내 발밑으로 끌어온다(`pullStep` 이 옮긴다).
   * 보스는 안 끌린다. 끌린 적은 깬다(어그로). 난수 0 — 떼를 모아 한 번에 쓸어버리는 몰이의 앞 절반
   */
  function pullIn(R, el) {
    if (!run || !run.room || !PULL_ON()) { return 0; }
    var p = run.player, es = run.room.enemies, n = 0, i;
    for (i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.hp <= 0 || e.boss) { continue; }
      var d0 = dist(p, e);
      if (d0 > R + e.r || d0 <= e.r + P_R + 6) { continue; }
      e.pullT = PULL_SEC;
      wakeEnemy(e);
      n++;
    }
    fx.push({ t: 'pull', x: p.x, y: p.y, r: R, life: 0.35, color: el ? elemColorOf(el) : null });
    return n;
  }

  /** 끌려오는 중인 적 한 걸음. 들판 로머는 넉백과 같은 요령(축을 나눠 방 안쪽만 막는다) */
  function pullStep(en, dt, ctx) {
    if (!(en.pullT > 0) || !run || !run.player) { return; }
    en.pullT -= dt;
    var p = run.player, dx = p.x - en.x, dy = p.y - en.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var stop = en.r + P_R + 4;
    if (d <= stop) { en.pullT = 0; return; }
    var mv = Math.min(d - stop, PULL_SPD * dt), nx = en.x + dx / d * mv, ny = en.y + dy / d * mv;
    if (en.field) {
      var c = ctx || run;
      if (!inRoomRect(nx, en.y, c)) { en.x = nx; }
      if (!inRoomRect(en.x, ny, c)) { en.y = ny; }
    } else {
      en.x = core.clamp(nx, WALL + en.r, ROOM_W - WALL - en.r);
      en.y = core.clamp(ny, WALL + en.r, ROOM_H - WALL - en.r);
    }
  }

  /** 회피 — 짧게 미끄러지며 그동안 무적이다. `p.dash`(무예 "돌진")와 달리
   *  적을 베지 않는다 — 순수 회피다. 쿨다운만 있고 MP·스킬 슬롯이 안 든다. */
  function doDodge() {
    if (!run) { return false; }
    var p = run.player;
    if (p.dodgeCd > 0 || p.dodge || p.dash) { return false; }
    var ddx = p.dirX || p.facing, ddy = p.dirY || 0;
    var dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    p.dodge = { t: DODGE_SEC, dx: ddx / dl, dy: ddy / dl };
    p.invuln = Math.max(p.invuln || 0, DODGE_INVULN);
    p.dodgeCd = DODGE_CD;
    /* §5.8② 저스트 회피 — 창 안이면 콤보+3·슬로우 0.2초·다른 소리 */
    var justE = justDodgeTarget();
    if (justE) {
      run.combo = (run.combo || 0) + 3;
      run.comboT = COMBO_WINDOW;
      run.slowT = Math.max(run.slowT || 0, JUST_DODGE_SLOW);
      sfx('dodgeJust');
    } else {
      sfx('dash');
    }
    return true;
  }

