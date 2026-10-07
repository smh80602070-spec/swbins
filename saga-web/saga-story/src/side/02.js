  /* ── 판정 ─────────────────────────────────────────────── */

  /** 지금 걸려 있는 북돋움 (없으면 null) */
  function buffOn() {
    if (!run) { return null; }
    var b = run.player.buff;
    return (b && b.until > Date.now()) ? b : null;
  }

  function braceOn() { return !!buffOn(); }

  function atkOf() {
    var b = buffOn();
    return power().atk * (b ? b.atk : 1);
  }

  function hitBox() {
    var p = run.player;
    var w = REACH, h = 56;
    return {
      x: p.facing > 0 ? p.x + P_W : p.x - w,
      y: p.y - 4, w: w, h: h
    };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /**
   * 한 대 친다.
   * **급소(急所)** — 원작의 크리티컬이다. 같은 무예를 같은 적에게 써도 수치가 갈려야
   * 손이 계속 간다. 확률과 배수는 손잡이로 열려 있다(어드민 '균형 손잡이').
   * **넉백** — 맞은 적이 뒤로 밀린다. 위치만 바뀌고 피해는 그대로다 —
   * 판정을 흔들지 않으면서 "때렸다" 는 감각을 주는 가장 싼 값이다.
   * 다만 **보스는 밀리지 않는다**(밀리면 달려드는 패턴이 뜻을 잃는다).
   */
  function strike(e, mul, forceCrit, elem) {
    var p = run.player, m = mul || 1;
    /* 고유 조작(§5-1) — 받아치기·그림자 걷기가 예약해 둔 "다음 한 타" 보너스를
       여기 한 곳에서 꺼내 쓰고 곧바로 지운다(둘이 겹칠 일은 없다 — 갈래가
       다르면 둘 다 0/1이다). elem 은 castSkill() 이 쏠 때 실어 보낸 원소뿐이라
       melee·aoe·dash 등 나머지 효과에는 안 걸린다(§5-1 "다음 3발" 범위 그대로) */
    if (p.parryBonus !== 1) { m *= p.parryBonus; p.parryBonus = 1; }
    if (p.shadowHitT > 0) { m *= p.shadowHitMul; p.shadowHitT = 0; }
    var rm = run.rm;   // 비경 축복(§5-3) — 비경 밖에서는 null
    var crit = forceCrit || Math.random() < critRate() + (rm ? rm.crit : 0);
    var dmg = atkOf() * m * (0.88 + Math.random() * 0.24) * (crit ? critMul() + (rm ? rm.critMul : 0) : 1);
    if (rm) {
      dmg *= 1 + rm.dmg;
      if (e.boss || e.mini) { dmg *= 1 + rm.bossDmg; }
      if (rm.exec && e.hp <= e.hpMax * 0.3) { dmg *= 1 + rm.exec; }
    }
    /* 관문 대장(§5-4) 취약 — 방패가 깨진 10초 동안 받는 피해 ×1.5 */
    if (e.gate && e.gateVulnT > 0) { dmg *= GATE_VULN_MUL; }
    /* 사냥터 보스 그로기(§5-10) — 패턴 셋을 잇달아 피하면 5초 동안 ×1.5 */
    if (e.bp && e.bp.groggy > 0 && global.DG.bossPattern) { dmg *= global.DG.bossPattern.dmgTakenMul(e); }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    if (rm && rm.leech) { run.hp = Math.min(run.hpMax, run.hp + dmg * rm.leech); }
    e.hurt = HURT_FLASH;
    /* 관문 대장(§5-4) 방패 — **등 뒤**(e.dir 이 가리키는 반대쪽)에서 낸 피해만 쌓는다.
       e.dir 은 패턴 실행 중(update() 의 근접 판정, patternT>0)엔 얼어붙어 있어
       그 틈에 돌아가 때려야 뒤를 잡을 수 있다. 깨지면 10초 취약, 그 창이 끝나면
       다시 쌓을 수 있다(3분 싸움 동안 여러 번 깨질 수 있다). */
    if (e.gate && !e.gateShieldBroken) {
      var backSide = ((p.x + P_W / 2) - (e.x + e.w / 2) >= 0 ? 1 : -1);
      if (backSide !== e.dir) {
        e.gateShieldHp = (e.gateShieldHp || 0) + dmg;
        if (e.gateShieldHp >= e.hpMax * GATE_SHIELD_FRAC) {
          e.gateShieldBroken = true;
          e.gateVulnT = GATE_VULN_DUR;
          fx.push({ t: 'ring', x: e.x + e.w / 2, y: e.y + e.h / 2, r: 60, life: 0.5 });
          core.emit('toast', '🛡️💥 방패 파괴! 10초간 취약');
          sfx('crit');
        }
      }
    }
    /* 탱커형(PLAN 13절)은 보스처럼 밀리지 않는다 — 맷집이 그 컨셉이다 */
    if (!e.boss && e.role !== 'tank') {
      var away = (e.x + e.w / 2) - (run.player.x + P_W / 2) >= 0 ? 1 : -1;
      e.kx = (e.kx || 0) + away * knockPow() * (crit ? 1.5 : 1) * (m >= 2 ? 1.4 : 1);
    }
    fx.push({ t: 'hit', x: e.x + e.w / 2, y: e.y, v: dmg, life: 0.6, crit: crit });
    /* 손맛 표준(§5-7) — hitstop 은 한 대 맞을 때마다 걸린다(dt 를 낮춰 이
       프레임의 물리·쿨다운이 같이 늦춰진다, update() 머리 참고). 흔들림은
       이제 **모든 타격**에 걸린다(2px/80ms) — 급소·거함타(100 이상)는 그
       위에 더 크게(8px/220ms·3.6px/180ms, 예전 그대로). */
    run.hitstopT = Math.max(run.hitstopT || 0, e.boss ? HITSTOP_BOSS : (crit ? HITSTOP_CRIT : HITSTOP_NORMAL)); if (global.DG.runRank) { global.DG.runRank.onHit(); }   // W-0104 콤보
    var shAmt = crit ? 8 : (dmg >= 100 ? 3.6 : 2);
    var shSpan = crit ? 0.22 : (dmg >= 100 ? 0.18 : 0.08);
    fx.push({ t: 'shake', x: e.x, y: e.y, life: shSpan, span: shSpan, amt: shAmt, big: crit });
    if (crit) {
      sfx('crit');
    } else {
      run.hitSeq = ((run.hitSeq || 0) + 1) % HIT_CUES.length;
      sfx(HIT_CUES[run.hitSeq]);
    }
    if (elem) { applyElem(e, elem, m); }
    if (e.hp <= 0) { kill(e); }
  }

  function kill(e) {
    if (!run) { return; }
    run.kills += 1;
    st().kills = (st().kills || 0) + 1;
    var lv = run.stage.enemyLv;
    var mul = e.boss ? 12 : (e.rare ? RARE_GAIN_MUL : (e.mini ? MINI_GAIN_MUL : 1));
    var rmk = run.rm;   // 비경(§5-3) — 재물 축복·주간 변형자 보상 배수
    var gold = Math.round((6 + lv * 3) * (0.8 + Math.random() * 0.6) * mul * GAIN_GOLD * RG() *
      (rmk ? (1 + rmk.gold) * rmk.reward : 1));
    run.gold += gold;
    run.drops.push({ kind: 'gold', x: e.x + e.w / 2, y: e.y, vy: -180, n: gold });
    if (e.boss) {
      /* 보스는 탕약을 확정으로 떨군다 — 다음 판을 이어 갈 밑천이다 */
      run.drops.push({ kind: 'potion', x: e.x + e.w / 2 + 14, y: e.y, vy: -220, n: 3 });
    } else if (e.mini || Math.random() < DROP_POTION) {
      /* 미니보스도 확정으로 하나 떨군다 — 보스만큼은 아니어도 값진 싸움이다 */
      run.drops.push({ kind: 'potion', x: e.x + e.w / 2 + 10, y: e.y, vy: -200, n: e.mini ? 2 : 1 });
    }
    /* 장비·주문서 — 무엇이 나올지는 gear.js 가 정한다 (여기는 떨구기만 한다).
       미니보스는 보스와 같은 표를 쓴다(약한 싸움이 아니라는 보상 신호) */
    var G = global.DG.gear;
    if (G) {
      var got = G.rollDrop(lv, !!e.boss || !!e.mini);
      if (got) {
        run.drops.push({ kind: got.kind, key: got.key, uniq: !!got.uniq,
                         x: e.x + e.w / 2 - 12, y: e.y, vy: -240, n: 1 });
      }
    }
    var expAmt = Math.round((6 + lv * 4) * (e.boss ? 15 : (e.rare ? RARE_GAIN_MUL : (e.mini ? MINI_GAIN_MUL : 1))) * GAIN_EXP * RG() *
      (rmk ? rmk.reward : 1));
    core.gainExp(expAmt);
    run.expGained += expAmt;   // 세션 카드(§5-6) — 이 판에서 잡아 얻은 경험치만 잰다(사명 보상 등은 안 잡는다)
    /* 사명(quest.js)이 이 소식을 듣는다 — 규칙이 서로를 부르지 않게 알림으로만 잇는다 */
    core.emit('side:kill', { ref: e.ref, boss: !!e.boss, lv: lv, stage: run.stage.key });
    if (global.DG.hero.awardParty) { global.DG.hero.awardParty((2 + lv) * (e.boss ? 8 : 1)); }
    fx.push({ t: 'pop', x: e.x + e.w / 2, y: e.y, life: e.boss ? 0.9 : 0.5 });
    /* 뒤로 넘어가며 사라진다 — 원작에서 몹이 죽던 그 모습이다(화면 층이 그린다) */
    var deathDur = e.boss ? 1.1 : (e.mini ? 0.7 : 0.55);
    fx.push({ t: 'fall', x: e.x + e.w / 2, y: e.y, w: e.w, h: e.h,
              dir: (e.x + e.w / 2) - (run.player.x + P_W / 2) >= 0 ? 1 : -1,
              ref: e.ref, boss: !!e.boss, life: deathDur });
    if (e.boss) { fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.6, big: true }); }
    sfx((e.boss || e.mini) ? 'bosskill' : 'kill');

    /* 죽는 몸짓(2026-09-11) — `run.enemies`(판정)에서는 바로 빼지만, 화면(3D)이
       `run.dying`으로 잠깐 더 붙들어 death 몸짓이 다 돌 때까지 세워 둔다. uid를
       따로 매겨 배열 인덱스로 안 묶는다 — run.enemies 는 이 자리에서 바로
       splice 되어 뒤 원소가 인덱스 하나씩 당겨지는데, 화면 쪽 배우 풀이 인덱스로
       재활용하는 예전 방식이었다면 죽는 도중 다른 적의 모습으로 바뀌어 버렸을 것 */
    run.dying.push({
      uid: ++deathUid, ref: e.ref, x: e.x, y: e.y, w: e.w, h: e.h,
      dir: (e.x + e.w / 2) - (run.player.x + P_W / 2) >= 0 ? 1 : -1,
      boss: !!e.boss, mini: !!e.mini, rare: !!e.rare, role: e.role,
      t: 0, dur: deathDur
    });

    var idx = run.enemies.indexOf(e);
    if (idx >= 0) { run.enemies.splice(idx, 1); }

    /* 비경(§5-3) — 층이 끝났는지·잡졸을 채울지는 rift.js 가 정한다. 사냥터 보스·잡졸 리젠 분기를 건너뛴다 */
    if (run.rift && global.DG.rift) { global.DG.rift.onKill(e); return; }

    if (e.gate) {
      /* 관문 대장(§5-4) — 사냥터 보스와 리젠 규칙이 다르다(주간 잠금).
         run.stage 에는 `.boss` 가 없는 마을이라 위 분기와 반드시 갈라야 한다. */
      var sg = st();
      sg.bosses = (sg.bosses || 0) + 1;
      sg.gateWeek[e.gateKey] = gateWeekKey();     // 이겼다 — 이번 주는 다시 안 나온다
      run.boss = null;
      run.gateT = 0;
      core.gainFeat(30 + lv * 4, '관문 대장');
      grantGateReward(e);
      core.emit('changed');
      return;
    }
    if (e.boss) {
      var s = st();
      s.bosses = (s.bosses || 0) + 1;
      s.bossAt[run.stage.key] = Date.now();       // 여기서부터 다시 나오기까지를 센다
      run.boss = null;
      core.gainFeat(20 + lv * 3, '토벌');
      core.log('👺 ' + e.ref.name + ' 을(를) 잡았다! · 🪙 ' + core.fmt(gold) +
        ' · 🧪 +3 (' + run.stage.boss.cool + '분 뒤 다시 나온다)', 'good');
      core.emit('toast', '👺 ' + e.ref.name + ' 토벌!');
      core.emit('changed');
      return;                                     // 보스 자리는 다시 채우지 않는다
    }
    /* 잡은 자리 대신 다른 곳에서 하나가 더 나온다 (사냥터가 비지 않게) */
    spawnEnemy();
  }

  /** 맞을 때 — 낀 방어가 덜 맞게 해 준다 (아무리 높아도 6할까지) */
  function hurtMe(amount) {
    if (!run) { return; }
    var p = run.player;
    if (p.invuln > 0) { return; }
    /* 받아치기(§5-1, 무사 고유 조작) — 창 안에 맞으면 무효화하고, 그제서야
       "다음 한 타" 보너스가 켜진다(눌렀다고 바로 켜지지 않는다 — 실제로
       받아쳐야 한다). strike() 가 p.parryBonus 를 꺼내 쓰고 지운다. */
    if (p.parryT > 0) {
      p.parryT = 0;
      p.parryBonus = p.parryNextMul;
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 50, life: 0.3 });
      sfx('crit');
      core.emit('toast', '🛡️ 받아쳤다!');
      return;
    }
    /* 방패(§5-3) — 층마다 첫 피격 하나를 통째로 막는다 */
    if (run.rm && run.rm.shield && global.DG.rift.tryShield()) {
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 50, life: 0.3 });
      core.emit('toast', '🛡️ 방패가 막았다');
      p.invuln = HIT_COOL;
      return;
    }
    var G = global.DG.gear;
    var cut = G ? G.cut(power().def) : 0;
    var b = buffOn();
    if (b && b.guard) { cut = Math.min(0.85, cut + b.guard); }   // 철갑 같은 것
    if (run.rm && run.rm.guard) { cut = Math.min(0.85, cut + run.rm.guard); }   // 철벽(§5-3)
    run.hp -= Math.max(1, Math.round(amount * (1 - cut))); if (global.DG.runRank) { global.DG.runRank.onHurt(); }   // W-0104 피격 수
    sfx('hurt');
    fx.push({ t: 'ouch', x: p.x, y: p.y, life: 0.45 });
    fx.push({ t: 'shake', x: p.x, y: p.y, life: 0.18, big: false });
    p.hurt = 0.3;
    if (global.DG.mount && global.DG.mount.onHurt) { global.DG.mount.onHurt(); }      // 맞으면 내린다
    p.invuln = HIT_COOL + (run.rm ? run.rm.invuln : 0);
    if (run.hp <= 0) {
      /* 불굴(§5-3) — 비경에서 한 번은 일어선다 */
      if (run.rm && run.rm.revive && global.DG.rift.tryRevive()) {
        p.invuln = 1.5;
        fx.push({ t: 'heal', x: p.x, y: p.y, life: 0.6 });
        core.emit('toast', '🔥 불굴 — 다시 일어선다!');
      } else if (!(run.pty && global.DG.party.onFall())) {
        die();   // 동료 교대(§5-8) — 남은 동료가 없을 때만 판이 끝난다
      }
    }
  }

  function die() {
    var stg = run.stage, Q = global.DG.quest;
    var riftSum = global.DG.rift ? global.DG.rift.onEnd('dead') : null;   // 비경(§5-3) — 진행은 지워지고 조각만 남는다
    st().deaths = (st().deaths || 0) + 1;
    var goldKept = Math.round(run.gold * 0.5);
    core.log('💀 ' + stg.name + ' 에서 쓰러졌다 — 주운 금은 절반만 남는다', 'bad');
    core.save.player.gold += goldKept;
    var got = {
      dead: true, stage: stg.name, gold: goldKept, kills: run.kills,
      exp: run.expGained, gear: run.gearFound,
      feat: achieveDoneCount() - run.feat0,
      next: Q ? Q.nextTodo() : null,
      rift: riftSum, rank: global.DG.runRank ? global.DG.runRank.finish() : null   // W-0104 결과 등급
    };
    run = null;
    core.emit('side:end', got);
    core.emit('toast', '💀 쓰러졌습니다');
    core.emit('changed');
    core.persist();
  }

  function drink() {
    var s = st();
    if (!run || s.potions <= 0) { return false; }
    if (run.hp >= run.hpMax) { return false; }
    if (run.rm && run.rm.noPotion) { core.emit('toast', '🏜️ 이번 주 비경에서는 탕약을 못 마십니다'); return false; }
    s.potions -= 1;
    run.hp = Math.min(run.hpMax, run.hp + Math.round(run.hpMax * (0.45 + (run.rm ? run.rm.potion : 0))));
    fx.push({ t: 'heal', x: run.player.x, y: run.player.y, life: 0.5 });
    run.player.drinkAnim = DRINK_ANIM_DUR;
    sfx('potion');
    core.emit('changed');
    return true;
  }

  /* ── 스킬 ─────────────────────────────────────────────── */

  /** 조작 띠에 놓인 무예들 (job.js 가 없으면 옛 네 가지로 돌아간다) */
  function barSkills() {
    var J = global.DG.job;
    return J ? J.bar() : SD.SKILLS;
  }

  /** "공격" 자리 — 쿨이 가장 짧은(=가장 자주 휘두르는) 무예를 손이 쥔다.
      나머지는 auto.js 가 조건대로 알아서 쓴다("스킬은 자동, 공격만 손으로") */
  function attackIndexOf(list) {
    var idx = 0, best = 1e9;
    for (var i = 0; i < list.length; i++) {
      if (list[i].cd < best) { best = list[i].cd; idx = i; }
    }
    return list.length ? idx : -1;
  }

  /** 그 무예의 지금 힘 — 찍은 레벨이 실려 있다 */
  function mulOf(sk) {
    var J = global.DG.job;
    if (J && J.mulOf) { return J.mulOf(sk); }
    return sk.mul ? sk.mul[0] : 1;
  }

  /**
   * 무예를 쓴다. `effect` 하나하나가 이 판이 아는 손잡이다 —
   * 데이터(`data-job.js`)는 무엇을 할지만 적고, **어떻게 하는지는 여기에만** 있다.
   */
  function castSkill(i) {
    if (!run) { return false; }
    var list = barSkills();
    var sk = list[i], p = run.player;
    if (!sk) { return false; }
    if (p.cds[i] > 0 || run.mp < sk.cost) { return false; }
    run.mp -= sk.cost;
    p.cds[i] = sk.cd;
    return castBody(sk, 0);
  }

  /** 무예 한 번의 효과. swapMul 이 있으면 교대 서명(§5-8) — 배율을 그 값으로 고정하고 유파 보정·무예 레벨은 안 탄다 */
  function castBody(sk, swapMul) {
    var p = run.player;
    if (global.DG.mount && global.DG.mount.onAttack) { global.DG.mount.onAttack(); }   // 탈것 위에선 못 싸운다 — 무예를 쓰면 내린다
    p.atkCd = ATK_ANIM_DUR;
    var S0 = global.DG.sfx;
    sfx(sk.cost === 0 ? 'swing' : (S0 ? S0.skillCue(sk.effect) : 'skill'));

    var j, e, dx, dy, mul = swapMul || mulOf(sk);
    var eff = sk.effect;
    /* 유파(§5-2) — 띠 조합에 따른 보정을 여기 한 곳에서 구해, 아래 갈래마다
       제 자리(mul·r·buff.sec·heal·shots)에 곱하거나 더하기만 한다. side.js 는
       유파가 뭔지 몰라도 된다(job.js schoolBonus() 가 다 정한다). */
    var JB = global.DG.job;
    var sb = (JB && !swapMul) ? JB.schoolBonus(sk) : null;
    mul *= sb ? sb.dmgMul : 1;

    /* 궁수 당기기(§5-1) — 화살·연사 한 번에만 실린다(다음 화살 하나뿐, 평타처럼
       계속 나가는 자리에 얹으면 힘이 안 보이게 흩어진다). 관통은 shots 의
       pierceLeft(§5-1) 로 남는다 — 원래 화살(pierce:false)은 첫 하나에서
       멈추던 것을, 이만큼 더 뚫고 지나가게 한다. */
    var pierceAdd = 0;
    if (p.archerBuff && (eff === 'arrow' || eff === 'volley')) {
      mul *= p.archerBuff.mul;
      pierceAdd = p.archerBuff.pierce;
      p.archerBuff = null;
    }

    if (eff === 'melee') {
      var hits = sk.hits || 1;
      var box = hitBox();
      fx.push({ t: 'slash', x: box.x, y: box.y, w: box.w, h: box.h, dir: p.facing, life: 0.16 });
      for (j = 0; j < run.enemies.length; j++) {
        if (overlap(box, run.enemies[j])) {
          for (var h = 0; h < hits; h++) { strike(run.enemies[j], mul); }
        }
      }
    } else if (eff === 'aoe') {
      var r = (sk.r || REACH * 1.5) * (sb ? sb.aoeMul : 1);
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: r, life: 0.28 });
      for (j = 0; j < run.enemies.length; j++) {
        e = run.enemies[j];
        dx = (e.x + e.w / 2) - (p.x + P_W / 2);
        dy = (e.y + e.h / 2) - (p.y + P_H / 2);
        if (Math.sqrt(dx * dx + dy * dy) < r) { strike(e, mul); }
      }
    } else if (eff === 'bolt' || eff === 'arrow') {
      /* 관통 표시선(§5-7 남은 조각) — ox 는 쏜 자리에 고정, 화면 층이 여기부터
         지금까지를 선으로 그어 "뚫고 지나간다"를 보여 준다(bolt 만, 화살은 점 하나로 족하다) */
      run.shots.push({ x: p.x + P_W / 2, y: p.y + P_H * 0.4, dir: p.facing,
                       spd: eff === 'arrow' ? 640 : 520, life: 1.2,
                       mul: mul, pierce: eff === 'bolt', pierceLeft: pierceAdd,
                       elem: takeElem(p), kind: sk.key, hit: {},
                       ox: p.x + P_W / 2 });
    } else if (eff === 'volley') {
      /* 여러 발 — 높이를 조금씩 달리해 한 줄로 겹치지 않게 한다.
         유파(§5-2) 연·화·탄 세트가 발수를 늘린다(2=+1·4=+2). 원소 전환(§5-1)은
         "발"이 곧 이 낱개 화살이라 — 여러 발 중 남는 만큼만 물든다. */
      var n = (sk.shots || 2) + (sb ? sb.shotsAdd : 0);
      for (j = 0; j < n; j++) {
        run.shots.push({ x: p.x + P_W / 2, y: p.y + P_H * (0.3 + 0.16 * j), dir: p.facing,
                         spd: 600 + j * 34, life: 1.1,
                         mul: mul, pierce: false, pierceLeft: pierceAdd,
                         elem: takeElem(p), kind: sk.key, hit: {} });
      }
    } else if (eff === 'dash') {
      /* 밀고 나간다 — 지나간 자리의 적을 벤다. 은신보는 잠깐 맞지 않는다 */
      var from = p.x, dist = (sk.dist || 200) * p.facing;
      p.x = core.clamp(p.x + dist, 0, run.stage.width - P_W);
      p.climb = null;
      if (sk.invuln) { p.invuln = Math.max(p.invuln, sk.invuln); }
      var lo = Math.min(from, p.x) - 10, hi = Math.max(from, p.x) + P_W + 10;
      fx.push({ t: 'dash', x: lo, y: p.y, w: hi - lo, h: P_H, life: 0.22 });
      /* 돌진 잔상(§5-7 남은 조각) — 밀고 나간 순간은 한 프레임뿐이라(순간이동에
         가깝다) 지나간 자리에 몸 그림자 여럿을 심어 "몸이 지나갔다"는 궤적을 남긴다.
         빛줄기 하나(위 'dash')만으로는 몸의 형체가 안 남아 허전했다 */
      var ghostN = 4;
      for (var gk = 1; gk <= ghostN; gk++) {
        fx.push({ t: 'ghost', x: from + P_W / 2 + (p.x - from) * (gk / (ghostN + 1)),
                  y: p.y + P_H, life: 0.16 - gk * 0.01 });
      }
      for (j = 0; j < run.enemies.length; j++) {
        e = run.enemies[j];
        if (e.x + e.w > lo && e.x < hi && Math.abs((e.y + e.h) - (p.y + P_H)) < 60) {
          /* 유파(§5-2) 질·퇴·보·축 4세트 — dash 무예로 때리면 급소가 확정된다 */
          strike(e, mul, sb && sb.critForce);
        }
      }
    } else if (eff === 'rain') {
      /* 앞쪽 넓은 자리에 쏟는다 — 서 있는 높이와 상관없이 위아래로 넓다 */
      var rx = p.facing > 0 ? p.x : p.x - 340;
      var band = { x: rx, y: p.y - 220, w: 340 + P_W, h: 300 };
      fx.push({ t: 'rain', x: band.x, y: band.y, w: band.w, h: band.h, life: 0.5 });
      for (j = 0; j < run.enemies.length; j++) {
        e = run.enemies[j];
        if (overlap(band, e)) {
          strike(e, mul, false, takeElem(p));
          /* 착탄 다발(§5-7 남은 조각) — 화살비는 한 몸에도 여러 점이 동시에
             꽂힌다. 겉을 씌우는 'rain' 하나만으로는 몸에 닿는 느낌이 없었다 */
          for (var rk = 0; rk < 3; rk++) {
            fx.push({ t: 'impact', x: e.x + Math.random() * e.w,
                      y: e.y + Math.random() * e.h * 0.6, life: 0.22 + Math.random() * 0.1 });
          }
        }
      }
    } else if (eff === 'heal') {
      var pct = (sk.heal ? (sk.heal[0] + sk.heal[1] * Math.max(0, (swapMul ? 1 : lvOf(sk)) - 1)) : 0.2) *
        (sb ? sb.healMul : 1);
      run.hp = Math.min(run.hpMax, run.hp + Math.round(run.hpMax * pct));
      fx.push({ t: 'heal', x: p.x, y: p.y, life: 0.5 });
    } else if (eff === 'buff') {
      var b = sk.buff || { sec: BRACE_SEC, atk: 1.35 };
      p.buff = {
        until: Date.now() + (b.sec || BRACE_SEC) * 1000 * (sb ? sb.buffMul : 1),
        atk: b.atk || 1, speed: b.speed || 1, guard: b.guard || 0, regen: b.regen || 1,
        name: sk.name
      };
      fx.push({ t: 'ring', x: p.x + P_W / 2, y: p.y + P_H / 2, r: 60, life: 0.4 });
    }
    if (!swapMul) { core.emit('side:skill', sk.key); }
    return true;
  }

  /** 교대 서명 1발(§5-8) — party.js 가 부른다. 기력·쿨을 안 쓴다 */
  function castSwap(sk, mul) {
    return run ? castBody(sk, mul) : false;
  }

  function lvOf(sk) {
    var J = global.DG.job;
    return J ? J.levelOf(sk.key) : 1;
  }

  /* ── 매 프레임 ────────────────────────────────────────── */

  /** 보스 패턴(§5-9)이 바깥에 부탁하는 일 — 판정 모듈은 이것만 안다 */
  var bpA = null;
  function bpApi() {
    if (!bpA) {
      bpA = {
        fx: fx,
        hurt: function (n) { hurtMe(n); },
        spawn: function (x) { spawnEnemy(x); },
        sfx: sfx,
        toast: function (m) { core.emit('toast', m); },
        rand: Math.random,
        hpMax: function () { return run ? run.hpMax : 100; }
      };
    }
    bpA.p = run.player; bpA.stg = run.stage;
    return bpA;
  }

  function update(dt) {
    if (!run) { return; }
    dt = Math.min(dt, 0.05);
    var MTs = global.DG.mount; if (MTs && MTs.step) { MTs.step(dt); }         // 탈것 — 날갯짓 쉼·내림 판정(mount.js)
    /* 손맛 표준(§5-7) — 타격 정지(hitstop). 한 대 맞은 순간 몇 프레임만 확
       늦춘다(멈추지는 않는다 — dt=0 이면 몇몇 카운트다운이 얼어붙은 티가
       난다). 실제 경과 시간(줄지 않은 dt)으로 hitstopT 를 줄이고, 이
       프레임에 쓸 dt 만 낮춰 이동·물리·쿨다운이 같이 늦춰진다("화면
       전체"가 아니라 판정 dt 만 — 사가나락 dungeon.js `update()`와 같은
       요령). */
    if (run.hitstopT > 0) { run.hitstopT -= dt; dt *= 0.15; }
    /* 비경(§5-3) — 층이 끝났으면 타격 반복문 밖인 여기서 정리한다(무대를 갈아 끼우거나 나가기도 한다) */
    if (run.riftTick && global.DG.rift) {
      run.riftTick = false;
      global.DG.rift.tick();
      if (!run) { return; }
    }
    /* 동료 교대(§5-8) — 교대 쿨을 깎고, 막 나온 인물의 서명 1발을 여기서(타격 반복문 밖) 쏜다 */
    if (run.pty && global.DG.party) { global.DG.party.tick(dt); }
    var p = run.player, stg = run.stage, i;

    /* 관문 대장(§5-4) 제한 시간 — 넘기면 그 자리에서 광폭화(공격 ×1.5), 실패로 끝나진 않는다 */
    if (run.gateT > 0) {
      run.gateT -= dt;
      if (run.gateT <= 0 && run.boss && run.boss.gate && !run.boss.enraged) {
        run.boss.enraged = true;
        run.boss.dmg = Math.round(run.boss.dmg * GATE_ENRAGE_MUL);
        fx.push({ t: 'shake', x: run.boss.x, y: run.boss.y, life: 0.5, span: 0.5, amt: 8, big: true });
        core.emit('toast', '🔥 관문 대장이 광폭화했다! 공격 +50%');
      }
    }

    /* 대화창을 연 채 자리를 뜨면 저절로 닫는다 — 닫는 것을 잊고 걸어가도 막혀 있지 않게 */
    if (run.talk && Math.abs((p.x + P_W / 2) - run.talk.x) > TALK_LEAVE_R) { closeTalk(); }

    for (i = 0; i < p.cds.length; i++) { if (p.cds[i] > 0) { p.cds[i] -= dt; } }
    if (p.dodgeCd > 0) { p.dodgeCd -= dt; }
    if (p.atkCd > 0) { p.atkCd -= dt; }   // 공격 몸짓 타이머(판정과 무관, 화면 층만 본다)
    if (p.dodgeAnim > 0) { p.dodgeAnim -= dt; }
    if (p.drinkAnim > 0) { p.drinkAnim -= dt; }
    if (p.coyoteT > 0) { p.coyoteT -= dt; }
    if (p.jumpBufferT > 0) { p.jumpBufferT -= dt; }
    if (p.rollT > 0) { p.rollT -= dt; }
    if (p.wallKickT > 0) { p.wallKickT -= dt; }
    /* 고유 조작(§5-1) — 회피를 누르고 있는 동안만 holdT 가 쌓이고, 임계
       (job.js JD.SIGNATURE_HOLD)를 넘는 순간 딱 한 번 armSignature() 가 돈다.
       그 뒤(홀드 도중)에는 다시 안 불린다 — holdArmed 가 막는다. */
    if (p.holding) {
      p.holdT += dt;
      var J0 = global.DG.job, sig0 = J0 && J0.signature ? J0.signature() : null;
      if (!p.holdArmed && sig0 && p.holdT >= sig0.hold) { armSignature(); }
    }
    if (p.sigCd > 0) { p.sigCd -= dt; }
    if (p.parryT > 0) { p.parryT -= dt; }
    if (p.shadowHitT > 0) { p.shadowHitT -= dt; }
    if (p.shadowT > 0) {
      p.shadowT -= dt;
      p.invuln = Math.max(p.invuln, p.shadowT);   // 이동이 끝나는 순간과 무적이 함께 끝난다
    }
    var bf = buffOn();
    run.mp = Math.min(run.mpMax, run.mp + MP_REGEN * (bf ? bf.regen : 1) * (run.rm ? 1 + run.rm.mp : 1) * dt);
    if (run.rm && run.rm.regen) { run.hp = Math.min(run.hpMax, run.hp + run.hpMax * run.rm.regen * dt); }   // 회복 축복(§5-3)
    if (p.invuln > 0) { p.invuln -= dt; }
    if (p.hurt > 0) { p.hurt -= dt; }

    if (p.dropThru > 0) { p.dropThru -= dt; }

    /* 궁수 당기기(§5-1) — 힘을 모으는 동안 이동이 느려진다(누른 시간이 곧
       위력이니 "가만히 서서 당긴다"는 선택을 만든다) */
    var mul = (bf ? bf.speed : 1) * (p.archerCharging ? p.archerMoveMul : 1) * (MTs ? MTs.speedMul() : 1);   // 탈것 이동 배율(mount.js)

    if (p.climb) {
      /* 줄에 매달린 동안은 **중력도 좌우 이동도 없다** — ↑↓ 로만 오르내린다.
         원작의 밧줄·사다리가 그렇다. 뛰면(점프) 손을 떼고 그 방향으로 튄다. */
      p.vy = 0;
      var mv = input.up ? -CLIMB * dt : (input.down ? CLIMB * dt : 0);
      p.y += mv;
      if (mv) { p.phase += dt * 7; sfx('climb'); }
      p.x = p.climb.x - P_W / 2;
      var foot = p.y + P_H;
      /* **움직인 방향으로만** 끝을 판정한다 — 아래 끝(바닥)에서 막 잡은 줄이
         그 프레임에 곧바로 풀려 버리던 결함이 여기 있었다 */
      if (mv < 0 && foot <= p.climb.top) {    // 꼭대기를 넘어섰다 — 발판 위에 올라선다
        p.y = p.climb.top - P_H; p.climb = null; p.onGround = true;
      } else if (mv > 0 && foot >= p.climb.bottom) {   // 끝까지 내려왔다
        p.y = p.climb.bottom - P_H; p.climb = null; p.onGround = true;
      }
    } else {
      /* 좌우 — 착지 롤·벽 차기 동안은 입력과 무관하게 그 방향으로 밀린다
         (§5-5, 둘 다 "손 놓아도 몸이 이어서 움직인다"는 짧은 창) */
      var wasGround = p.onGround;
      if (p.rollT > 0) {
        p.vx = p.facing;
      } else if (p.wallKickT > 0) {
        p.vx = p.wallKickDir;
      } else if (p.shadowT > 0) {
        /* 그림자 걷기(협객, §5-1) — dash 처럼 한 프레임에 튀는 게 아니라
           밀고 가는 "이동"이라, 벽 차기·착지 롤과 같은 요령으로 입력을
           덮어쓴다(입력을 놓아도 이어진다). */
        p.vx = p.facing;
      } else {
        p.vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (p.vx) { p.facing = p.vx > 0 ? 1 : -1; }
      }
      var moveMul = p.rollT > 0 ? ROLL_MUL :
        (p.wallKickT > 0 ? (WALL_KICK_VX / SPEED) : (p.shadowT > 0 ? SIG_SHADOW_MUL : 1));
      p.x = core.clamp(p.x + p.vx * SPEED * mul * moveMul * (run.rm ? 1 + run.rm.speed : 1) * dt, 0, stg.width - P_W);
      if (p.vx) { p.phase += dt * 9; }

      /* 중력 · 발판 */
      var prevBottom = p.y + P_H;
      p.vyPrev = p.vy;                        // 착지 먼지가 읽는다 (닿는 순간엔 0 이 된다)
      p.vy += GRAV * (MTs ? MTs.gravMul() : 1) * dt;
      if (MTs && p.vy > MTs.fallCap()) { p.vy = MTs.fallCap(); }               // 날개 탈것 — 가볍게 가라앉는다
      p.y += p.vy * dt;
      if (MTs) { MTs.ceil(p); }
      var bottom = p.y + P_H;
      var wasFalling = p.vy > 0;
      p.onGround = false;

      if (bottom >= stg.floor) {
        p.y = stg.floor - P_H; p.vy = 0; p.onGround = true;
      } else if (p.vy > 0 && p.dropThru <= 0) {
        /* 위에서 내려올 때만 발판에 선다 (↓+점프로 빠져나가는 동안은 통과) */
        for (i = 0; i < stg.plats.length; i++) {
          var pl = stg.plats[i];
          if (p.x + P_W > pl[0] && p.x < pl[0] + pl[2] &&
              prevBottom <= pl[1] + 2 && bottom >= pl[1]) {
            p.y = pl[1] - P_H; p.vy = 0; p.onGround = true;
            break;
          }
        }
      }
      if (p.onGround && wasFalling) {
        sfx('land');
        if (p.vyPrev > ROLL_SPEED) {
          /* 착지 롤(§5-5) — 세게 떨어져도 굳어 서지 않고 보던 방향으로 구르며
             속도를 살린다. 이 판엔 원래 착지 경직이 없었으니 "경직 대신"이
             아니라 그 자리에 새로 얹는 보상 동작이다. */
          p.rollT = ROLL_DUR;
          fx.push({ t: 'dust', x: p.x + P_W / 2, y: p.y + P_H, life: 0.4 });
        } else if (p.vyPrev > 620) {
          /* 세게 떨어졌을 때만 먼지가 인다 — 계단을 걸어 내려갈 때마다 일면 어지럽다 */
          fx.push({ t: 'dust', x: p.x + P_W / 2, y: p.y + P_H, life: 0.32 });
        }
        if (p.jumpBufferT > 0) {
          /* 점프 버퍼(§5-5) — 착지 직전 눌러 둔 입력을 여기서 그대로 이어 쓴다 */
          p.jumpBufferT = 0; p.rollT = 0;
          p.vy = -JUMP * (MTs ? MTs.jumpMul() : 1); p.onGround = false;
          sfx('jump');
        }
      }
      if (wasGround && !p.onGround && p.vy >= 0) {
        /* 코요테 타임(§5-5) — 발판을 걸어서 막 떠난 직후에도 잠깐은 점프를 받아 준다.
           `jump()`가 직접 onGround 를 끈 경우(진짜 점프)는 vy 가 이미 음수라 안 걸린다 */
        p.coyoteT = COYOTE_TIME;
      }

      /* 떨어지다가 줄에 닿았을 때 ↑ 를 누르고 있으면 그대로 매달린다 */
      if (!p.onGround && input.up) {
        var rr = ropeAt(p.x + P_W / 2, p.y + P_H);
        if (rr) { grab(rr); }
      }
    }

    /* 앉아 쉰다 — 원작에서 의자에 앉아 체력·기력을 채우던 그 자리다.
       ↓ 를 누른 채 가만히 있으면 앉고, 곁에 적이 오거나 움직이면 곧 일어선다.
       (줄에 매달렸을 때는 ↓ 가 내려가기이므로 앉지 않는다) */
    var foeNear = false;
    for (i = 0; i < run.enemies.length; i++) {
      var fe = run.enemies[i];
      if (Math.abs((fe.x + fe.w / 2) - (p.x + P_W / 2)) < 190 &&
          Math.abs((fe.y + fe.h) - (p.y + P_H)) < 80) { foeNear = true; break; }
    }
    var canRest = input.down && p.onGround && !p.climb && !input.left && !input.right && !foeNear;
    if (canRest) {
      var wasUp = p.resting <= 0.4;
      p.resting += dt;
      if (p.resting > 0.4) {                    // 앉는 데 한 박자
        if (wasUp) { sfx('sit'); }
        run.hp = Math.min(run.hpMax, run.hp + run.hpMax * 0.020 * dt);
        run.mp = Math.min(run.mpMax, run.mp + run.mpMax * 0.055 * dt);
      }
    } else {
      p.resting = 0;
    }

    /* 내가 날린 것 — 꿰뚫는 것(pierce)은 계속 가고, 화살은 첫 하나에 걸린다 */
    for (i = run.shots.length - 1; i >= 0; i--) {
      var sh = run.shots[i];
      sh.x += sh.dir * sh.spd * dt;
      sh.life -= dt;
      var spent = false;
      for (var si = 0; si < run.enemies.length; si++) {
        var se = run.enemies[si];
        if (sh.hit[si]) { continue; }
        if (overlap({ x: sh.x - 10, y: sh.y - 10, w: 20, h: 20 }, se)) {
          sh.hit[si] = true;
          strike(se, sh.mul === undefined ? 2.1 : sh.mul, false, sh.elem);
          /* 관통 +1(§5-1, 궁수 당기기) — 원래 첫 하나에서 멈추던 화살·연사가
             pierceLeft 만큼 더 뚫고 지나간다(무제한 관통인 bolt 는 그대로). */
          if (sh.pierce === false) {
            if (sh.pierceLeft > 0) { sh.pierceLeft--; } else { spent = true; break; }
          }
        }
      }
      if (spent || sh.life <= 0 || sh.x < -20 || sh.x > stg.width + 20) { run.shots.splice(i, 1); }
    }

    /* 날아오는 것 — 화살·탄환. 맞으면 접촉과 같은 무적 시간이 걸린다 */
    for (i = run.eshots.length - 1; i >= 0; i--) {
      var es = run.eshots[i];
      es.x += es.dir * es.spd * dt;
      /* 마법형 구슬만 높이를 따라온다(homing) — 활·조총은 쏜 그대로 직선이다 */
      if (es.homing) {
        var targetY = p.y + P_H * 0.5, stepY = MAGIC_HOME * dt;
        es.y = es.y < targetY ? Math.min(targetY, es.y + stepY) : Math.max(targetY, es.y - stepY);
      }
      es.life -= dt;
      var gone = es.life <= 0 || es.x < -20 || es.x > stg.width + 20;
      if (!gone && overlap({ x: es.x - 7, y: es.y - 5, w: 14, h: 10 },
                           { x: p.x, y: p.y, w: P_W, h: P_H })) {
        gone = true;
        if (p.invuln <= 0) {
          hurtMe(es.dmg);
          if (!run) { return; }
        }
      }
      if (gone) { run.eshots.splice(i, 1); }
    }

    /* 적 — 순찰하다가 가까이 오면 쫓아온다 */
    for (i = 0; i < run.enemies.length; i++) {
      var e = run.enemies[i];
      if (e.hurt > 0) { e.hurt -= dt; }
      if (e.atkAnim > 0) { e.atkAnim -= dt; }
      /* 원소 전환(§5-1, 방사 고유 조작)의 화(火)·빙(氷) — 살아 있는 동안만의
         런타임 상태다(data-enemy.js 는 안 늘렸다, §2-2). 이 프레임에 죽으면
         이 루프 자리(i)가 바로 kill() 로 지워지므로 i-- 로 다음 원소를 안
         건너뛴다. */
      if (e.burnT > 0) {
        e.hp -= e.hpMax * 0.05 * dt;
        e.burnT -= dt;
        if (e.hp <= 0) { kill(e); i--; continue; }
      }
      if (e.slowT > 0) { e.slowT -= dt; }
      /* 관문 대장(§5-4) 취약 — 10초가 다 지나면 방패를 다시 채운다(재도전 가능) */
      if (e.gate && e.gateVulnT > 0) {
        e.gateVulnT -= dt;
        if (e.gateVulnT <= 0) { e.gateShieldBroken = false; e.gateShieldHp = 0; }
      }
      e.phase += dt * 6;
      var dx = (p.x + P_W / 2) - (e.x + e.w / 2);
      var near = Math.abs(dx) < (e.boss ? 420 : 260) && Math.abs((p.y + P_H) - (e.y + e.h)) < 70;
      /* 패턴(§5-4) 실행 중엔 등을 돌린 채 얼어붙는다 — 그 틈이 방패를 깨는 창이다 */
      if (near && !(e.gate && e.patternT > 0)) { e.dir = dx > 0 ? 1 : -1; }
      /* 보스의 한 가지 패턴 — 뜸을 들이다 달려든다. 서서 때리기만 하면 안 되게.
         돌진형 잡몹(PLAN 13절)도 같은 패턴을 쓴다 — `chargeCd` 가 있는지로 본다.
         관문 대장(§5-4)의 "달려들기"(패턴 1)는 이 자리를 그대로 쓴다 — e.boss 라
         따로 안 늘린다 */
      var chargeMul = 1;
      if (e.boss || e.role === 'dash') {
        if (e.charge > 0) {
          e.charge -= dt;
          chargeMul = 2.6;
        } else {
          e.chargeCd -= dt;
          if (e.chargeCd <= 0 && near) {
            e.charge = 1.1;
            e.chargeCd = 5 + Math.random() * 3;
            sfx('charge');
            fx.push({ t: 'ring', x: e.x + e.w / 2, y: e.y + e.h / 2, r: 46, life: 0.3 });
            /* 소리만으로는 못 듣는 사람이 있다 — 화면에도 한 박자 띄운다 */
            fx.push({ t: 'warn', x: e.x + e.w / 2, y: e.y, life: 0.9 });
          }
        }
      }
      /* 사냥터 보스 패턴전(§5-9, boss-pattern.js) — 체력 구간마다 늘어나는 장판·지진·휩쓸기.
         관문 대장은 아래 제 패턴이 있어 안 탄다 */
      var BPm = global.DG.bossPattern;
      if (e.boss && !e.gate && BPm && BPm.on()) {
        BPm.step(e, dt, bpApi(), near);
        if (!run) { return; }
        /* 그로기(§5-10) — 멈춰 선다: 걷기·박치기·돌진 없음 */
        if (e.bp && e.bp.groggy > 0) { continue; }
      } else if (e.gate && BPm && BPm.on() && BPm.sigOf(e)) {
        /* 관문 대장 고유 기술(§5-11) — 제 패턴 사이사이에 */
        BPm.stepSig(e, dt, bpApi(), near);
        if (!run) { return; }
        if (e.bp && e.bp.groggy > 0) { continue; }
      }
      /* 관문 대장(§5-4) 패턴 2·3 — 범위 표시 후 내려찍기 · 소환 2. 달려들기와
         겹치지 않게 e.charge<=0 일 때만 새로 문다(둘이 같이 터지면 정신없다) */
      if (e.gate) {
        if (e.patternT > 0) {
          e.patternT -= dt;
          if (e.patternT <= 0 && e.patternKind === 'slam') {
            var slamDx = Math.abs(e.slamX - (p.x + P_W / 2));
            var slamDy = Math.abs(e.slamY - (p.y + P_H));
            if (slamDx < GATE_SLAM_R && slamDy < GATE_SLAM_R && p.invuln <= 0) {
              hurtMe(Math.round(e.dmg * 1.3));
              if (!run) { return; }
            }
            fx.push({ t: 'shake', x: e.x, y: e.y, life: 0.4, span: 0.4, amt: 6, big: true });
            sfx('charge');
            e.patternKind = '';
          }
        } else {
          e.patternCd -= dt;
          if (e.patternCd <= 0 && near && e.charge <= 0 && !(e.bp && e.bp.kind)) {
            e.patternCd = 7 + Math.random() * 4;
            if (Math.random() < 0.5) {
              e.patternKind = 'slam';
              e.slamX = p.x + P_W / 2; e.slamY = p.y + P_H;
              e.patternT = 1.0;
              fx.push({ t: 'zonewarn', x: e.slamX, y: e.slamY, r: GATE_SLAM_R, life: 1.0 });
              sfx('charge');
            } else {
              e.patternKind = 'summon';
              e.patternT = 0.4;
              spawnEnemy(Math.max(40, e.x - 90));
              spawnEnemy(Math.min(stg.width - 40, e.x + 90));
              core.emit('toast', '👥 관문 대장이 병력을 불렀다!');
              sfx('boss');
            }
          }
        }
      }
      /* 쏘는 적 — **사거리에 들면 멈춰서 쏜다.** 붙어서 때리는 적과 달리
         거리를 두고 버티므로, 이쪽이 다가가거나 기탄으로 받아쳐야 한다. */
      var holding = false;
      if (e.ranged && !e.boss) {
        e.shotCd -= dt;
        var flat = Math.abs((p.y + P_H) - (e.y + e.h)) < 64;
        var far = Math.abs(dx);
        if (flat && far < e.ranged.range) {
          e.dir = dx > 0 ? 1 : -1;
          if (far > REACH * 1.2) { holding = true; }     // 사거리 안이면 다가오지 않는다
          if (e.shotCd <= 0) {
            e.shotCd = e.ranged.cd * (0.8 + Math.random() * 0.4);
            e.atkAnim = ATK_ANIM_DUR;
            run.eshots.push({
              x: e.x + e.w / 2 + e.dir * 16, y: e.y + e.h * 0.42,
              dir: e.dir, spd: e.ranged.spd, dmg: Math.round(e.dmg * e.ranged.mul),
              kind: e.ref.look.weapon, life: 2.4
            });
            fx.push({ t: 'aim', x: e.x + e.w / 2, y: e.y, life: 0.22 });
            sfx('aim');
          }
        }
      } else if (e.role === 'magic' && !e.boss) {
        /* 마법형(PLAN 13절) — 원거리형과 달리 **높이(flat)를 안 가린다**.
           대신 구슬이 느리게 날며 쫓아온다(update() 아래 eshots 루프의
           homing) — 다가오지 못하게 막는 게 아니라 자리를 옮겨야 피한다 */
        e.shotCd -= dt;
        var farM = Math.abs(dx);
        if (farM < MAGIC_RANGE) {
          e.dir = dx > 0 ? 1 : -1;
          if (farM > REACH * 1.2) { holding = true; }
          if (e.shotCd <= 0) {
            e.shotCd = MAGIC_CD * (0.8 + Math.random() * 0.4);
            e.atkAnim = ATK_ANIM_DUR;
            run.eshots.push({
              x: e.x + e.w / 2 + e.dir * 16, y: e.y + e.h * 0.42,
              dir: e.dir, spd: MAGIC_SPD, dmg: Math.round(e.dmg * MAGIC_DMG_MUL),
              kind: 'magic', homing: true, life: 2.6
            });
            fx.push({ t: 'aim', x: e.x + e.w / 2, y: e.y, life: 0.22 });
            sfx('aim');
          }
        }
      }
      e.x += (holding ? 0 : e.dir * e.spd * (near ? 1.25 : 0.7) * chargeMul * (e.slowT > 0 ? 0.6 : 1)) * dt;
      /* 밀린 만큼 미끄러지고 곧 잦아든다 — 맞는 동안은 못 붙는다는 뜻이기도 하다 */
      if (e.kx) {
        e.x += e.kx * dt;
        e.kx *= Math.max(0, 1 - dt * 9);
        if (Math.abs(e.kx) < 4) { e.kx = 0; }
      }
      if (e.x < 20) { e.x = 20; e.dir = 1; e.kx = 0; }
      if (e.x > stg.width - 40) { e.x = stg.width - 40; e.dir = -1; e.kx = 0; }
      e.cd -= dt;
      if (overlap({ x: p.x, y: p.y, w: P_W, h: P_H }, e) && e.cd <= 0) {
        e.cd = 1.0;
        e.atkAnim = ATK_ANIM_DUR;
        hurtMe(e.dmg);
        if (!run) { return; }
      }
    }

    /* 떨어진 것 — 잠깐 튀었다가 내려앉고, 밟으면 줍는다 */
    for (i = run.drops.length - 1; i >= 0; i--) {
      var d = run.drops[i];
      d.vy += GRAV * 0.6 * dt;
      d.y += d.vy * dt;
      if (d.y > stg.floor - 12) { d.y = stg.floor - 12; d.vy = 0; }
      if (Math.abs((d.x) - (p.x + P_W / 2)) < 40 && Math.abs(d.y - (p.y + P_H)) < 60) {
        if (d.kind === 'potion') {
          st().potions += d.n;
          sfx('potion');
          core.emit('toast', '🧪 탕약 +' + d.n);
        } else if (d.kind === 'gear' || d.kind === 'scroll') {
          var GG = global.DG.gear;
          if (GG) {
            if (d.kind === 'gear') {
              var made = GG.make(d.key);
              /* 가방이 가득 차면 **줍지 못하고 그대로 남는다** — 원작의 그 답답함이다 */
              if (!GG.put(made)) { sfx('bagfull'); continue; }
              run.gearFound += 1;   // 세션 카드(§5-6) — 실제로 주운 것만(가방 가득 차 못 주우면 안 잰다)
              /* 고유(固有)는 소리부터 다르다 — 원작에서 유니크가 그렇다 */
              sfx(d.uniq ? 'uniq' : 'gear');
              core.emit('toast', (d.uniq ? '⭐ 고유 · ' : '📦 ') + GG.nameOf(made));
              if (d.uniq) { core.log('⭐ 고유 장비를 주웠다 — ' + GG.nameOf(made), 'good'); }
              fx.push({ t: 'itempop', x: p.x + P_W / 2, y: p.y, emoji: d.uniq ? '⭐' : '📦',
                        text: GG.nameOf(made), life: ITEMPOP_DUR });
            } else {
              GG.addScroll(d.key, 1);
              sfx('scroll');
              var scrollName = global.DG.gearData.scroll(d.key).name;
              core.emit('toast', '📜 ' + scrollName);
              fx.push({ t: 'itempop', x: p.x + P_W / 2, y: p.y, emoji: '📜', text: scrollName, life: ITEMPOP_DUR });
            }
          }
        }
        if (d.kind === 'gold') { sfx('gold'); }
        run.drops.splice(i, 1);
      }
    }

    /* 채집 보너스 지역(PLAN 11절) — 이 구간 안에서만 아래 채집이 FORAGE_MUL배
       나온다. 처음 들어선 순간에만 한 번 알린다(보물상자의 "opened"와 같은
       한 번뿐 패턴) */
    var px = p.x + P_W / 2;
    var inForage = !!(run.forage && px >= run.forage.x1 && px <= run.forage.x2);
    if (inForage && !run.forage.notified) {
      run.forage.notified = true;
      core.emit('toast', '🍀 채집이 넘치는 곳이다!');
    }

    /* 필드 채집(PLAN 10절) — 정지 오브젝트라 밟는 판정만 있으면 된다.
       가방과 달리 칸이 안 차므로(카운터라서) 늘 다 줍는다 */
    for (i = 0; i < run.gathers.length; i++) {
      var g = run.gathers[i];
      if (!g.alive) {
        if (Date.now() >= g.respawnAt) { g.alive = true; }
        continue;
      }
      if (Math.abs(g.x - px) < GATHER_R) {
        g.alive = false;
        g.respawnAt = Date.now() + GATHER_RESPAWN * 1000;
        var s = st();
        var gain = inForage ? FORAGE_MUL : 1;
        s.mats[g.kind] = (s.mats[g.kind] || 0) + gain;
        var GD = SD.GATHERS[g.kind];
        sfx('coin');
        core.emit('toast', GD.emoji + ' ' + GD.name + ' +' + gain + (inForage ? ' 🍀' : ''));
        core.emit('side:gather', { kind: g.kind, stage: run.stage.key, bonus: inForage });
      }
    }

    /* 보물상자(PLAN 11절) — 한 판에 하나뿐이라 열면 그걸로 끝, 다음 판에
       다시 뽑는다(buildChest). 드랍처럼 튀지 않고 제자리에 서 있다 */
    if (run.chest && !run.chest.opened && Math.abs(run.chest.x - (p.x + P_W / 2)) < CHEST_R) {
      run.chest.opened = true;
      var cgold = Math.round((40 + stg.enemyLv * 12) * (0.8 + Math.random() * 0.6) * GAIN_GOLD);
      run.gold += cgold;
      var GG2 = global.DG.gear, GD2 = global.DG.gearData, gotItem = null;
      if (GG2 && GD2) {
        var made = GG2.make(core.pick(GD2.poolFor(stg.enemyLv)).key);
        if (GG2.put(made)) { gotItem = made; } else { sfx('bagfull'); }
      }
      sfx('gear');
      core.emit('toast', '💰 보물상자! 🪙+' + cgold + (gotItem ? ' · 📦 ' + GG2.nameOf(gotItem) : ''));
      if (gotItem) {
        fx.push({ t: 'itempop', x: p.x + P_W / 2, y: p.y, emoji: '📦', text: GG2.nameOf(gotItem), life: ITEMPOP_DUR });
      }
    }

    /* 몬스터 습격(PLAN 11절) — 매복 지점을 지나면 그 자리 근처에 잡졸이
       한꺼번에 여럿 나타난다. 상자처럼 한 판에 한 번뿐이다(triggered) */
    if (run.ambush && !run.ambush.triggered && Math.abs(run.ambush.x - px) < AMBUSH_R) {
      run.ambush.triggered = true;
      for (var ai = 0; ai < AMBUSH_COUNT; ai++) {
        var aOff = (ai - (AMBUSH_COUNT - 1) / 2) * AMBUSH_SPREAD;
        var aX = Math.max(60, Math.min(stg.width - 60, run.ambush.x + aOff));
        spawnEnemy(aX);
      }
      sfx('boss');
      core.emit('toast', '🚨 몬스터 무리가 덮쳤다!');
    }

    /* 미니보스(PLAN 11절) — 그 자리를 지나면 잡졸 하나가 크게 불려 나온다.
       한 판에 한 번뿐이다(triggered) */
    if (run.miniboss && !run.miniboss.triggered && Math.abs(run.miniboss.x - px) < MINI_R) {
      run.miniboss.triggered = true;
      var mb = spawnEnemy(run.miniboss.x, { hp: MINI_HP_MUL, dmg: MINI_DMG_MUL });
      if (mb) {
        sfx('boss');
        core.emit('toast', '👹 미니보스 ' + mb.ref.name + ' 등장!');
      }
    }

    /* 이동 상인(PLAN 11절) — 마주치면 상점이 잠깐 싸진다. 자리를 옮기는 게
       아니라 core.save.player.merchantUntil 만 밀어 둔다(gear.js 가 읽는다) */
    if (run.merchant && !run.merchant.triggered && Math.abs(run.merchant.x - px) < MERCHANT_R) {
      run.merchant.triggered = true;
      core.save.player.merchantUntil = Date.now() + MERCHANT_DUR * 1000;
      sfx('gold');
      core.emit('toast', '🛒 지나가던 상인 — ' + MERCHANT_DUR + '초 동안 상점이 30% 싸집니다!');
    }

    /* NPC 구조(PLAN 11절) — 가까이 가면 지키던 잡졸이 나타나고, 다 잡으면
       사례금을 받는다. 잡는 것 자체는 보통 전투와 같아 별도 판정이 없다 —
       여기서는 "다 잡혔나"만 본다 */
    if (run.rescue && !run.rescue.spawned && Math.abs(run.rescue.x - px) < RESCUE_R) {
      run.rescue.spawned = true;
      for (var ri = 0; ri < RESCUE_COUNT; ri++) {
        var rOff = (ri - (RESCUE_COUNT - 1) / 2) * AMBUSH_SPREAD;
        var rX = Math.max(60, Math.min(stg.width - 60, run.rescue.x + rOff));
        var rg = spawnEnemy(rX);
        if (rg) { rg.guard = true; }
      }
      sfx('hurt');
      core.emit('toast', '😱 도적에게 붙잡힌 사람이 있다!');
    }
    if (run.rescue && run.rescue.spawned && !run.rescue.done) {
      var guardsLeft = run.enemies.filter(function (e) { return e.guard; }).length;
      if (guardsLeft === 0) {
        run.rescue.done = true;
        var rGold = Math.round((30 + stg.enemyLv * 10) * (0.8 + Math.random() * 0.4) * GAIN_GOLD);
        run.gold += rGold;
        sfx('gold');
        core.emit('toast', '🙏 구해줘서 고맙다며 사례금을 줬다 · 🪙+' + rGold);
      }
    }

    /* 마을 사람끼리의 잡담 — 사냥터엔 없고, 마을(town:true)에서만, 그것도
       대화창을 열어 놓은 동안엔 겹치지 않게 쉰다 */
    if (stg.town && run.npcs.length >= 2 && !run.talk) {
      run.chatCd -= dt;
      if (run.chatCd <= 0) {
        run.chatCd = CHAT_EVERY * (0.7 + Math.random() * 0.6);
        if (Math.random() < CHAT_CHANCE) {
          var a = core.pick(run.npcs), b;
          do { b = core.pick(run.npcs); } while (b === a);
          var topic = core.pick(SD.NPC_CHAT);
          var lineA = topic[0].replace('{town}', stg.name);
          var lineB = topic[1].replace('{town}', stg.name);
          sfx('talk');
          core.emit('toast', '💬 ' + a.name + ': "' + lineA + '"');
          core.log('💬 ' + a.name + ': "' + lineA + '" / ' + b.name + ': "' + lineB + '"', 'info');
        }
      }
    }

    /* 전직 4차 상시 잔상(§6 "성장 가시화") — §5-7 dash 잔상과 **같은 fx('ghost')
       를 그대로 재사용한다**(새 그림 없음, 화면 층 `side-view.js`가 2D·3D
       양쪽에 이미 그리는 오버레이라 여기선 fx만 심으면 된다). 걷거나 뛰는
       동안만(p.vx·p.onGround) 터울을 두고 심어 "따라오는 잔상"으로 보이게
       하고, 가만히 서 있을 땐 안 심는다(정지 중 겹쳐 보이면 잔상이 아니라 얼룩이다). */
    var J2 = global.DG.job, jobCur = J2 && J2.cur ? J2.cur() : null;
    if (jobCur && jobCur.tier >= 4 && p.vx && p.onGround) {
      p.tier4GhostT = (p.tier4GhostT || 0) - dt;
      if (p.tier4GhostT <= 0) {
        p.tier4GhostT = TIER4_GHOST_INT;
        fx.push({ t: 'ghost', x: p.x + P_W / 2, y: p.y + P_H, life: 0.22 });
      }
    }

    /* 연출 수명 */
    for (i = fx.length - 1; i >= 0; i--) {
      fx[i].life -= dt;
      if (fx[i].life <= 0) { fx.splice(i, 1); }
    }
    /* 죽는 몸짓 수명(위 kill() 참고) — death 몸짓이 다 돈 뒤에야 치운다 */
    for (i = run.dying.length - 1; i >= 0; i--) {
      run.dying[i].t += dt;
      if (run.dying[i].t >= run.dying[i].dur) { run.dying.splice(i, 1); }
    }
  }

  /* 화면이 읽는 요약.
     **사냥 중이든 쉬는 중이든 같은 칸을 준다** — 한쪽에만 있는 칸(stages 같은)을
     두면 시트를 사냥 중에 열었을 때 undefined 로 죽는다(실제로 그랬다). */
  function status() {
    var s = st();
    var base = {
      potions: s.potions, kills: s.kills || 0, deaths: s.deaths || 0,
      bosses: s.bosses || 0,
      stages: stages(), skills: [],
      /* 사냥 중이 아니어도 같은 칸을 준다 — 한쪽에만 있는 칸을 두면 시트가 죽는다 */
      boss: null, climbing: false, rope: false, gate: null, npc: null, talk: null,
      def: 0, resting: false
    };
    if (!run) {
      base.active = false;
      base.stage = SD.stage(s.stage);
      /* 쉬는 중은 실제로 다음 판을 pw.hp/pw.mp(가득 참)로 시작한다(enter() 참조) —
         그러니 여기서도 0/0 이 아니라 가득 찬 값을 준다. 캐릭 정보 카드가 이 값을
         상시 띠로 보여 준다(예전에는 사냥 중에만 뜨는 #hud 안에만 있어 쉬는 동안
         에너지(기력)를 볼 수가 없었다) */
      var pw = power();
      base.hp = pw.hp; base.hpMax = pw.hp; base.mp = pw.mp; base.mpMax = pw.mp;
      base.gold = 0; base.enemies = 0; base.brace = false;
      base.atk = pw.atk; base.def = pw.def;
      return base;
    }
    var skills = [], i, list = barSkills();
    for (i = 0; i < list.length; i++) {
      var sk = list[i];
      skills.push({
        key: sk.key, name: sk.name, emoji: sk.emoji, desc: sk.desc, cost: sk.cost,
        lv: lvOf(sk), max: sk.max || 0,
        cd: Math.max(0, run.player.cds[i] || 0), cdMax: sk.cd,
        ready: (run.player.cds[i] || 0) <= 0 && run.mp >= sk.cost
      });
    }
    base.attackIdx = attackIndexOf(list);
    base.active = true;
    base.stage = run.stage;
    base.hp = Math.max(0, Math.round(run.hp));
    base.hpMax = run.hpMax;
    base.mp = Math.round(run.mp);
    base.mpMax = run.mpMax;
    base.gold = Math.round(run.gold);
    base.kills = run.kills;                 // 이 판에서 잡은 수 (누적은 state().kills)
    base.skills = skills;
    base.brace = braceOn();
    base.enemies = run.enemies.length;
    base.atk = Math.round(atkOf());
    base.def = power().def;
    base.party = global.DG.party ? global.DG.party.brief() : null;   // 동료 교대(§5-8) HUD
    base.dodge = { cd: Math.max(0, run.player.dodgeCd), cdMax: DODGE_COOL,
      ready: run.player.dodgeCd <= 0 };
    /* 고유 조작(§5-1) — 회피 단추의 "길게 누름" 게이지가 이 값을 본다.
       job.js signature() 가 없으면(무명) hasSig 가 거짓이라 게이지가 안 뜬다. */
    var J1 = global.DG.job, sig1 = J1 && J1.signature ? J1.signature() : null;
    base.hold = {
      hasSig: !!sig1, holding: !!run.player.holding, t: run.player.holdT || 0,
      thresh: sig1 ? sig1.hold : 0.18, armed: !!run.player.holdArmed,
      sigCd: Math.max(0, run.player.sigCd || 0), sigCdMax: sig1 ? sig1.cd : 0,
      sigReady: (run.player.sigCd || 0) <= 0 && run.mp >= (sig1 ? sig1.cost : 1e9)
    };
    /* 줄·문·마을 사람 — 조작 띠가 '↑' 를 언제 띄울지 이 넷으로 정한다 */
    base.climbing = !!run.player.climb;
    base.resting = run.player.resting > 0.4;
    base.rope = !!ropeAt(run.player.x + P_W / 2, run.player.y + P_H);
    var g = portalAt(run.player.x + P_W / 2);
    base.gate = g ? { to: g.to, name: g.ref.name, open: unlocked(g.to), need: g.ref.need } : null;
    var n = npcAt(run.player.x + P_W / 2);
    base.npc = n ? { key: n.key, name: n.name } : null;
    base.talk = run.talk ?
      { name: run.talk.name, emoji: run.talk.emoji, text: run.talk.text, shop: !!run.talk.shop } : null;
    if (run.boss) {
      base.boss = {
        name: run.boss.ref.name,
        hp: Math.max(0, Math.round(run.boss.hp)), hpMax: run.boss.hpMax,
        charging: run.boss.charge > 0
      };
      if (run.boss.gate) {
        base.boss.gate = true;
        base.boss.timeLeft = Math.max(0, run.gateT || 0);
        base.boss.enraged = !!run.boss.enraged;
        base.boss.shieldBroken = !!run.boss.gateShieldBroken;
        base.boss.shieldPct = run.boss.gateShieldBroken ? 1 :
          Math.min(1, (run.boss.gateShieldHp || 0) / (run.boss.hpMax * GATE_SHIELD_FRAC));
        base.boss.vulnT = Math.max(0, run.boss.gateVulnT || 0);
      }
    }
    return base;
  }

  /* 레벨업·사명 완료 배너(PLAN 35절) — 둘 다 core 쪽(core.gainExp·quest.turnIn)에서
     쏘는 이벤트라 여기서 core.on 으로 받는다. 화면이 안 떠 있을 때(run 없음) 밀어
     넣으면 다음에 사냥터에 들어가서야 뒤늦게 뜨니, **지금 사냥 중일 때만** 받는다. */
  core.on('levelup', function (lv) {
    if (!run) { return; }
    fx.push({ t: 'levelup', lv: lv, life: LEVELUP_DUR });
  });
  core.on('questdone', function (name) {
    if (!run) { return; }
    fx.push({ t: 'questdone', name: name, life: QUESTDONE_DUR });
  });

  global.DG = global.DG || {};
  global.DG.side = {
    GRAV: GRAV, SPEED: SPEED, P_W: P_W, P_H: P_H, REACH: REACH, CLIMB: CLIMB,
    enter: enter, leave: leave, resume: resume, active: active, update: update,
    setInput: setInput, jump: jump, dodge: dodge, castSkill: castSkill, drink: drink,
    holdStart: holdStart, holdEnd: holdEnd, cancelHold: cancelHold,
    travel: travel, useUp: useUp, useDown: useDown, dropThrough: dropThrough,
    grabRope: grabRope,
    ropeAt: ropeAt, portalAt: portalAt, npcAt: npcAt, talk: talk, closeTalk: closeTalk, letGo: letGo,
    power: power, unlocked: unlocked, stages: stages, barSkills: barSkills,
    bossReady: bossReady, bossLeft: bossLeft,
    gateInfo: gateInfo, challengeGate: challengeGate,
    /* 비경(§5-3)이 쓰는 곳 — 임시 방 갈아 끼우기·잡졸 소환·주 키 */
    placeIn: placeIn, spawnEnemy: spawnEnemy, weekKey: gateWeekKey, castSwap: castSwap,
    status: status, state: st, meRef: meRef,
    /** 화면 전용 — 상태를 직접 읽는다 (쓰지는 말 것) */
    raw: function () { return run; },
    baseHpOf: baseHpOf,
    fx: function () { return fx; }
  };
})(window);
