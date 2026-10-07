  /* ── ⑲-22 조준 사격 ─────────────────────────────────── */
  function canAim(S) { var m = active(S); return !!(m && !m.down && m.wtype === 'bow'); }
  /** 조준에 잠길 것 — 살아 있는 적 + 상자 과녁·석등(treasure) + 이야기 석등·제단(story) [{kind, x, y, uid?}] */
  function aimCands(S, px, py) {
    var out = living(S).map(function (f) { return { kind: 'foe', uid: f.uid, x: f.x, y: f.y }; });
    var TR = global.DG.treasure, ST = global.DG.story;
    if (TR && TR.aimPoints) { out = out.concat(TR.aimPoints(px, py, AIM_R())); }
    if (ST && ST.aimPoints) { out = out.concat(ST.aimPoints()); }
    return out;
  }
  /** 겨눈 쪽 AIM_CONE 안 AIM_R 안에서 각이 가장 작은 것에 잠근다 */
  function aimLock(S, px, py) {
    var a = S.aim, best = null, bs = Infinity, L = aimCands(S, px, py), cc = Math.cos(AIM_CONE());
    for (var i = 0; i < L.length; i++) {
      var c = L[i], dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy);
      if (d < 1 || d > AIM_R()) { continue; }
      var cs = (dx * a.dx + dy * a.dy) / d;
      if (cs < cc) { continue; }
      var sc = Math.acos(Math.min(1, cs)) * 20 + d * 0.01;
      if (sc < bs) { bs = sc; best = c; }
    }
    a.lock = best;
    return best;
  }
  /** 조준에 들어간다 — 가까운 적 쪽(없으면 마지막으로 움직인 쪽) */
  function aimStart(S, px, py) {
    if (!canAim(S) || S.aim) { return { ok: false }; }
    var n = nearestFoe(S, px, py, AIM_R()), dx = n ? n.x - px : (S.lastDx || 0), dy = n ? n.y - py : (S.lastDy || 1), dl = Math.hypot(dx, dy) || 1;
    S.aim = { dx: dx / dl, dy: dy / dl, t: 0, hold: false, auto: false, lock: null };
    aimLock(S, px, py);
    push(S, { t: 'aim', on: true });
    return { ok: true };
  }
  function aimEnd(S) { if (!S.aim) { return false; } S.aim = null; push(S, { t: 'aim', on: false }); return true; }
  /** 방향 키로 겨눈 쪽을 돌린다 — 누른 쪽으로 초당 AIM_TURN 라디안까지 */
  function aimSteer(S, ux, uy, dt) {
    var a = S.aim, l = Math.hypot(ux, uy);
    if (!a || l < 1e-6) { return false; }
    var cur = Math.atan2(a.dy, a.dx), want = Math.atan2(uy / l, ux / l), d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
    var k = Math.max(-AIM_TURN() * (dt || 0), Math.min(AIM_TURN() * (dt || 0), d)), ang = cur + k;
    a.dx = Math.cos(ang); a.dy = Math.sin(ang);
    return true;
  }
  /** 충전 시작 */
  function aimHold(S) { if (!S.aim) { return false; } S.aim.hold = true; S.aim.t = 0; return true; }
  /** 쏜다 — 잠긴 것 쪽으로(점 과녁이면 그 자리에서 멈춘다), 없으면 겨눈 쪽 ARROW_RANGE */
  function aimShoot(S, px, py) {
    var a = S.aim, m = active(S);
    if (!a || !m || m.down || S.atkCd > 0) { return { ok: false }; }
    var full = a.hold && a.t >= AIM_FULL() - 1e-9, lk = a.lock;
    var tx = lk ? lk.x : px + a.dx * ARROW_RANGE(), ty = lk ? lk.y : py + a.dy * ARROW_RANGE();
    var dx = tx - px, dy = ty - py, dl = Math.hypot(dx, dy) || 1;
    if (!S.arrows) { S.arrows = []; }
    S.arrows.push({ x: px, y: py, dx: dx / dl, dy: dy / dl, left: lk && lk.kind !== 'foe' ? dl : ARROW_RANGE(), full: full, m: m });
    a.t = 0; a.hold = false; S.atkCd = AIM_GAP();
    push(S, { t: 'shoot', x: px, y: py, tx: tx, ty: ty, full: full, el: full ? m.el : null });
    return { ok: true, full: full, lock: lk ? lk.kind : null };
  }
  function foeR(f) { return Math.max(0.6, ((FOES[f.kind] && FOES[f.kind].h) || 1) * 0.55); }
  /** 화살이 적에 박힌다 — 충전이면 원소 ×1.25, 모르는 적(쉬는 중)이면 급소, 덜 찼으면 물리 ×0.45 */
  function arrowHit(S, r, f) {
    var m = r.m, weak = r.full && f.st === 'idle';
    var out = hitFoe(S, f, m, m.atk * (r.full ? AIM_FULLMUL() : AIM_PART()) * infM(m), r.full ? m.el || null : infEl(m), 'heavy', weak);
    if (weak) { push(S, { t: 'weak', uid: f.uid, x: f.x, y: f.y }); }
    rainFollow(S, f.x, f.y);                                        // ⑲-17 뱃노래
    m.energy = Math.min(ENERGY_MAX(), m.energy + 2 * (m.er || 1));
    return out;
  }
  /** 화살 한 박자 — 길 위 첫 적에 박히거나, 과녁을 켜거나, 다 날면 멈춘다. 멈춘 자리 = 'arrow'(충전이면 원소 신호) */
  function stepArrows(S, dt) {
    var A = S.arrows || [], TR = global.DG.treasure;
    for (var i = A.length - 1; i >= 0; i--) {
      var r = A[i], go = Math.min(r.left, ARROW_V() * dt), x1 = r.x + r.dx * go, y1 = r.y + r.dy * go, hf = null, bt = Infinity;
      var L = living(S);
      for (var j = 0; j < L.length; j++) {
        var f = L[j];
        if (segDist(f.x, f.y, r.x, r.y, x1, y1) > foeR(f)) { continue; }
        var al = (f.x - r.x) * r.dx + (f.y - r.y) * r.dy;
        if (al < bt) { bt = al; hf = f; }
      }
      if (hf) {
        arrowHit(S, r, hf);
        push(S, { t: 'arrow', x: hf.x, y: hf.y, el: r.full ? r.m.el : null, r: ARROW_EL_R(), hit: hf.uid });
        A.splice(i, 1); continue;
      }
      var nT = TR && TR.shootSeg ? TR.shootSeg(r.x, r.y, x1, y1) : 0;
      r.x = x1; r.y = y1; r.left -= go;
      if (nT > 0 || r.left <= 1e-6) {
        push(S, { t: 'arrow', x: r.x, y: r.y, el: r.full ? r.m.el : null, r: ARROW_EL_R(), target: nT });
        A.splice(i, 1);
      }
    }
  }

  /**
   * ⑲-2 강공격 — 공격을 0.4초 넘게 누르고 있으면(런타임이 잰다). 전투 스태미나 20, 가장 가까운 적 쪽
   * 앞 넓게(3.2m, 앞뒤 내적 −0.2 이상) ×1.3 물리. 콤보는 처음부터. 모자라면 { ok:false, tired:true }
   */
  function heavy(S, px, py) {
    var m = active(S);
    if (!m || m.down) { return { ok: false }; }
    var cc = CHARGE_COST() * staSave();
    if (S.stamina < cc) { push(S, { t: 'tired' }); return { ok: false, tired: true }; }
    S.stamina -= cc; S.staT = 0;
    S.combo = 0; S.comboT = 9; S.atkCd = 0.5;
    var n = nearestFoe(S, px, py, LUNGE_R());
    var dx = n ? n.x - px : (S.lastDx || 0), dy = n ? n.y - py : (S.lastDy || 1), dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    var hits = living(S).filter(function (f) {
      var fx = f.x - px, fy = f.y - py, d = Math.hypot(fx, fy);
      return d - BODY(f) <= CHARGE_REACH() && (d < 0.5 || (fx * dx + fy * dy) / d >= CHARGE_ARC());
    });
    for (var i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * CHARGE_MUL() * infM(m), infEl(m), 'heavy'); }
    if (hits.length) { rainFollow(S, px, py); }                     // ⑲-17 뱃노래
    m.energy = Math.min(ENERGY_MAX(), m.energy + 1.5 * hits.length * (m.er || 1));
    push(S, { t: 'heavy', x: px + dx * 1.2, y: py + dy * 1.2, r: 1.8, n: hits.length });
    return { ok: true, n: hits.length };
  }

  /** ⑲-2 낙하 공격 — 내리꽂아 땅에 닿은 자리 둘레 3.5m, ×(1.2 + 0.1×떨어진 m, 15m 까지) 물리 */
  function plungeMul(fell) { return PLUNGE_MUL() + PLUNGE_PER_M() * Math.max(0, Math.min(PLUNGE_MAX_M(), fell || 0)); }
  function plunge(S, px, py, fell) {
    var m = active(S);
    if (!m || m.down) { return { ok: false }; }
    var mul = plungeMul(fell), hits = foesWithin(S, px, py, PLUNGE_R());
    for (var i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * mul * infM(m), infEl(m), 'heavy'); }
    if (hits.length) { rainFollow(S, px, py); }                     // ⑲-17 뱃노래
    m.energy = Math.min(ENERGY_MAX(), m.energy + 1.5 * hits.length * (m.er || 1));
    push(S, { t: 'plunge', x: px, y: py, r: PLUNGE_R(), n: hits.length, mul: mul });
    return { ok: true, n: hits.length, mul: mul };
  }

  /** 원소 스킬 — 겨눈 적 둘레 4.5m 에 원소를 붙인다. 기력 +6(+2/마리), 대기 동료 +3 */
  function skill(S, px, py) {
    var m = active(S);
    if (!m || m.down || m.skillCd > 0) { return { ok: false, cd: m ? m.skillCd : 0 }; }
    if (m.kitS) { return kitSkill(S, m, px, py); }                   // ⑲-11 고유·갈래
    var aim = nearestFoe(S, px, py, SKILL_AIM());
    var cx = aim ? aim.x : px, cy = aim ? aim.y : py;
    var sh = m.shape || 'circle', hits = [], i, ev;
    /* 겨눈 쪽 — 적이 없으면 마지막으로 움직인(회피한) 쪽, 그것도 없으면 +y */
    var dx = cx - px, dy = cy - py, dl = Math.hypot(dx, dy);
    if (dl < 1e-6) { dx = S.lastDx || 0; dy = S.lastDy || 1; dl = Math.hypot(dx, dy) || 1; }
    dx /= dl; dy /= dl;
    if (sh === 'thrust') {
      var ex = px + dx * THRUST_LEN(), ey = py + dy * THRUST_LEN();
      hits = living(S).filter(function (f) { return segDist(f.x, f.y, px, py, ex, ey) <= THRUST_W(); });
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * THRUST_MUL(), m.el, 'skill'); }
      ev = { x: ex, y: ey, x0: px, y0: py, r: THRUST_W() };
    } else if (sh === 'dash') {
      var go = aim ? Math.min(DASH_LEN(), Math.max(0, dl - 1.2)) : DASH_LEN();
      var bx = px + dx * go, by = py + dy * go;
      hits = living(S).filter(function (f) { return segDist(f.x, f.y, px, py, bx + dx * 1.2, by + dy * 1.2) <= DASH_W(); });
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * DASH_MUL(), m.el, 'skill'); }
      S.dash = { vx: dx * go / DASH_T(), vy: dy * go / DASH_T(), t: DASH_T() };
      S.iframe = Math.max(S.iframe, 0.3);
      ev = { x: bx, y: by, x0: px, y0: py, r: DASH_W() };
    } else if (sh === 'field') {
      S.zones.push({ kind: 'field', x: cx, y: cy, r: FIELD_R(), t: FIELD_T(), next: 0, el: m.el, atk: m.atk, em: m.em, uid: m.id, tm: m.tm, reactMul: m.reactMul, m: m });
      hits = foesWithin(S, cx, cy, FIELD_R());          // 기력 셈에만 — 피해는 zone 틱(바로 첫 틱)이 준다
      ev = { x: cx, y: cy, r: FIELD_R() };
    } else if (sh === 'summon') {
      S.zones.push({ kind: 'summon', x: px + dx * 1.5, y: py + dy * 1.5, r: SUMMON_R(), t: SUMMON_T(), next: 0, el: m.el, atk: m.atk, em: m.em, uid: m.id, tm: m.tm, reactMul: m.reactMul, m: m });
      hits = aim ? [aim] : [];
      ev = { x: px + dx * 1.5, y: py + dy * 1.5, r: SUMMON_R() };
    } else {
      hits = foesWithin(S, cx, cy, SKILL_R());
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * SKILL_MUL(), m.el, 'skill'); }
      ev = { x: cx, y: cy, r: SKILL_R() };
    }
    if (sh === 'field' || sh === 'summon') { stepZones(S, 0); }   // 놓자마자 첫 틱
    m.skillCd = m.skCdMax = SKILL_CD() * (m.cdMul || 1);        // ⑲-4 깨달음 1 — 대기 -15%
    m.energy = Math.min(ENERGY_MAX(), m.energy + (6 + Math.min(6, hits.length * 2)) * (m.er || 1));
    for (var j = 0; j < S.party.length; j++) {
      var o = S.party[j];
      if (j !== S.active && !o.down) { o.energy = Math.min(ENERGY_MAX(), o.energy + 3 * (o.er || 1)); }
    }
    push(S, { t: 'skill', el: m.el, shape: sh, x: ev.x, y: ev.y, x0: ev.x0, y0: ev.y0, r: ev.r, n: hits.length });
    return { ok: true, n: hits.length, shape: sh };
  }

  /** ⑲-11 명단 보호막 — 지금 인물 최대 체력 × pct, 있던 것보다 크면 바꾼다 */
  function giveGuard(S, m, pct, sec) {
    var gh = Math.round(m.hpMax * pct), G = S.guard;
    S.guard = { hp: Math.max(gh, G ? G.hp : 0), max: Math.max(gh, G ? G.max : 0), t: Math.max(sec, G ? G.t : 0) };
  }
  /** ⑲-17 밀어냄 — (ux,uy) 쪽으로 dist m 를 KB_T 초에 미끄러진다. 우두머리·보스·굴복한 인물은 안 밀린다 */
  var KB_T = 0.25;
  function knock(f, ux, uy, dist) {
    if (!f || f.dead || f.st === 'yield' || FOES[f.kind].boss || !dist) { return; }
    f.kb = { vx: ux * dist / KB_T, vy: uy * dist / KB_T, t: KB_T };
  }
  /**
   * ⑲-17 뱃노래 따라 치기 — 기본·강·낙하 공격이 맞은 뒤 부른다. 쉼(gap)이 끝났으면 reach 안 가까운 적 n 에
   * 놓은 인물(rainM)의 공격력으로 물 노 한 대씩(원소 부착·치명은 그 인물 것)
   */
  function rainFollow(S, px, py) {
    var k = S.rainK, rm = S.rainM;
    if (!(S.rainT > 0) || S.rainCd > 0 || !k || !rm) { return 0; }
    var tg = living(S).filter(function (f) { return Math.hypot(f.x - px, f.y - py) <= k.reach; })
      .sort(function (a, b) { return Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py); }).slice(0, k.n);
    if (!tg.length) { return 0; }
    S.rainCd = k.gap;
    for (var i = 0; i < tg.length; i++) {
      hitFoe(S, tg[i], rm, rm.atk * k.rmul, rm.el, 'burst');
      push(S, { t: 'zone', kind: 'rain', el: rm.el, x: tg[i].x, y: tg[i].y, r: 1.2, n: 1 });
    }
    return tg.length;
  }
  /** ⑲-11 원소 덧붙임 — 물결 회복(명단)·번개 기력(다른 인물) */
  function kitExtras(S, m, k) {
    for (var i = 0; i < S.party.length; i++) {
      var o = S.party[i];
      if (o.down) { continue; }
      if (k.heal) { o.hp = Math.min(o.hpMax, o.hp + Math.round(o.hpMax * k.heal)); }
      if (k.team && o !== m) { o.energy = Math.min(ENERGY_MAX(), o.energy + k.team * (o.er || 1)); }
    }
  }
  /**
   * ⑲-11 고유·갈래 스킬(kits.js 표의 type) — 대기·기력·대기 동료 몫은 옛 스킬과 같다.
   * 깨달음 1(대기 곱)·무예 배율(출처 skill/zone)·치명·군기는 hitFoe 가 그대로 태운다.
   */
  function kitSkill(S, m, px, py) {
    var k = m.kitS, aim = nearestFoe(S, px, py, Math.max(SKILL_AIM(), k.reach || 0)), hits = [], i, ev, shape = 'circle';
    var dx = aim ? aim.x - px : 0, dy = aim ? aim.y - py : 0, dl = Math.hypot(dx, dy), far = dl;
    if (dl < 1e-6) { dx = S.lastDx || 0; dy = S.lastDy || 1; dl = Math.hypot(dx, dy) || 1; }
    dx /= dl; dy /= dl;
    if (k.type === 'dash') {
      var go = aim ? Math.min(k.len, Math.max(0, far - BODY(aim) - 1.2)) : k.len, bx = px + dx * go, by = py + dy * go;
      hits = living(S).filter(function (f) { return segDist(f.x, f.y, px, py, bx + dx * 1.2, by + dy * 1.2) <= k.w + BODY(f); });
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill'); }
      S.dash = { vx: dx * go / DASH_T(), vy: dy * go / DASH_T(), t: DASH_T() };
      S.iframe = Math.max(S.iframe, 0.3);
      ev = { x: bx, y: by, x0: px, y0: py, r: k.w }; shape = 'dash';
    } else if (k.type === 'shells') {
      var tg = living(S).filter(function (f) { return Math.hypot(f.x - px, f.y - py) <= k.reach; })
        .sort(function (a, b) { return Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py); }).slice(0, k.n);
      var spots = tg.length ? tg.map(function (f) { return { x: f.x, y: f.y }; }) : [{ x: px + dx * 8, y: py + dy * 8 }];
      for (i = 0; i < spots.length; i++) {
        S.zones.push({ kind: 'shell', x: spots[i].x, y: spots[i].y, r: k.r, t: k.delay, el: m.el, m: m, mul: k.mul });
      }
      hits = tg;
      ev = { x: spots[0].x, y: spots[0].y, r: k.r };
    } else if (k.type === 'guard') {
      hits = foesWithin(S, px, py, k.r);
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill'); }
      giveGuard(S, m, k.shield + (k.shieldAdd || 0), k.sec);
      ev = { x: px, y: py, r: k.r };
    } else if (k.type === 'blink') {
      /* ⑲-15 그림자 걸음 — 가까운 적을 지나 그 뒤 back m 까지 돌진, 도착 둘레를 베고 그 적에 표식 */
      var bt = nearestFoe(S, px, py, k.reach), ex, ey;
      if (bt) { var bl = Math.hypot(bt.x - px, bt.y - py) || 1; ex = bt.x + (bt.x - px) / bl * k.back; ey = bt.y + (bt.y - py) / bl * k.back; }
      else { ex = px + dx * k.len; ey = py + dy * k.len; }
      var bgo = Math.hypot(ex - px, ey - py), bux = bgo > 1e-6 ? (ex - px) / bgo : dx, buy = bgo > 1e-6 ? (ey - py) / bgo : dy;
      S.dash = { vx: bux * bgo / DASH_T(), vy: buy * bgo / DASH_T(), t: DASH_T() };
      S.iframe = Math.max(S.iframe, 0.3);
      hits = foesWithin(S, ex, ey, k.r);
      if (bt && hits.indexOf(bt) < 0) { hits.push(bt); }
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill'); }
      if (bt && !bt.dead) { bt.markT = k.mark; bt.markMul = k.markMul; }
      ev = { x: ex, y: ey, x0: px, y0: py, r: k.r }; shape = 'dash';
    } else if (k.type === 'gust') {
      /* ⑲-17 부채 바람 — 앞 r 부채꼴(내적 arc 이상)을 치고 나에게서 먼 쪽으로 밀어낸다. 회복은 kitExtras(heal) */
      hits = living(S).filter(function (f) {
        var fx = f.x - px, fy = f.y - py, d = Math.hypot(fx, fy);
        return d <= k.r && (d < 0.5 || (fx * dx + fy * dy) / d >= k.arc);
      });
      for (i = 0; i < hits.length; i++) {
        hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill');
        var gl = Math.hypot(hits[i].x - px, hits[i].y - py);
        knock(hits[i], gl > 0.5 ? (hits[i].x - px) / gl : dx, gl > 0.5 ? (hits[i].y - py) / gl : dy, k.knock);
      }
      ev = { x: px + dx * k.r * 0.5, y: py + dy * k.r * 0.5, r: k.r * 0.5 };
    } else if (k.type === 'updraft') {
      /* ⑲-43 별배 견인줄 — 둘레 r 적을 나 쪽으로 끌어 치고, 나는 lift m 위로 솟구쳐 날개를 편다(키보드 판 땅 위만 — landform.launch) */
      hits = foesWithin(S, px, py, k.r);
      for (i = 0; i < hits.length; i++) {
        hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill');
        var ul = Math.hypot(hits[i].x - px, hits[i].y - py);
        if (ul > 1.2) { knock(hits[i], (px - hits[i].x) / ul, (py - hits[i].y) / ul, Math.min(k.pull, ul - 1.2)); }
      }
      var LFu = global.DG.landform;
      S.lifted = !!(LFu && LFu.launch && LFu.launch(k.lift));
      ev = { x: px, y: py, r: k.r };
    } else if (k.type === 'wave') {
      /* ⑲-17 노 물결 — 앞으로 len·폭 w 의 길을 치고 앞으로 밀어낸다(나는 제자리) */
      var wx = px + dx * k.len, wy = py + dy * k.len;
      hits = living(S).filter(function (f) { return segDist(f.x, f.y, px, py, wx, wy) <= k.w; });
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill'); knock(hits[i], dx, dy, k.knock); }
      ev = { x: wx, y: wy, x0: px, y0: py, r: k.w }; shape = 'thrust';
    } else {
      S.zones.push({ kind: 'kitzone', x: px, y: py, r: k.r, t: k.sec, next: 0, every: k.every, n: k.n, mul: k.mul, energy: k.energy || 0, el: m.el, atk: m.atk, m: m });
      hits = foesWithin(S, px, py, k.r);
      stepZones(S, 0);                                                // 놓자마자 첫 틱
      ev = { x: px, y: py, r: k.r }; shape = 'field';
    }
    if (k.shieldAdd && k.type !== 'guard') { giveGuard(S, m, k.shieldAdd, 12); }   // 바위 — 방패 틀이 아니면 새 보호막
    kitExtras(S, m, k);
    m.skillCd = m.skCdMax = Math.max(1, k.cd) * (m.cdMul || 1);
    m.energy = Math.min(ENERGY_MAX(), m.energy + (6 + Math.min(6, hits.length * 2)) * (m.er || 1));
    for (var j = 0; j < S.party.length; j++) {
      var o = S.party[j];
      if (j !== S.active && !o.down) { o.energy = Math.min(ENERGY_MAX(), o.energy + 3 * (o.er || 1)); }
    }
    push(S, { t: 'skill', el: m.el, shape: shape, kit: k.type, name: k.name, x: ev.x, y: ev.y, x0: ev.x0, y0: ev.y0, r: ev.r, n: hits.length });
    return { ok: true, n: hits.length, shape: shape, kit: k.type, name: k.name };
  }
  /** ⑲-11 고유·갈래 해방 — 둘레 r 에 mul 한 번 + type 효과. 기력·대기·무적·깨달음 5 는 burst 가 먼저 치렀다 */
  function kitBurst(S, m, px, py) {
    var k = m.kitB, hits = foesWithin(S, px, py, k.r), i;
    for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'burst'); }
    if (k.type === 'infuse') { m.infT = k.sec; m.infMul = k.nmul; }
    else if (k.type === 'rally') { S.rallyT = k.sec; S.rallyMul = k.atk; }
    else if (k.type === 'ward') { S.wardT = k.sec; S.wardMul = k.taken; }
    else if (k.type === 'lore') { S.loreT = k.sec; S.loreMul = k.rmul; }          // ⑲-15 옛 글자 풀이
    else if (k.type === 'feast') {                                                // ⑲-17 잔칫날 순풍 — 첫 틱은 every 뒤
      S.zones.push({ kind: 'feast', x: px, y: py, r: k.r, t: k.sec, next: k.every, every: k.every, heal: k.fheal, mul: k.emul, el: m.el, atk: m.atk, m: m });
    }
    else if (k.type === 'rain') { S.rainT = k.sec; S.rainCd = 0; S.rainM = m; S.rainK = k; }   // ⑲-17 뱃노래
    else if (k.type === 'echo') {
      /* ⑲-15 가면 벗기 — reach 안 표식 난 적마다 every 초 간격 메아리 n(적을 따라감), 없으면 가까운 둘 */
      var near = living(S).filter(function (f) { return Math.hypot(f.x - px, f.y - py) <= k.reach; })
        .sort(function (a, b) { return Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py); });
      var marked = near.filter(function (f) { return f.markT > 0; }), tgs = marked.length ? marked : near.slice(0, 2), e2;
      for (i = 0; i < tgs.length; i++) {
        for (e2 = 1; e2 <= k.n; e2++) { S.zones.push({ kind: 'echo', uid: tgs[i].uid, x: tgs[i].x, y: tgs[i].y, r: 1.2, t: k.every * e2, el: m.el, m: m, mul: k.emul }); }
      }
    }
    else if (k.type === 'haste') {
      S.hasteT = k.sec;
      for (i = 0; i < S.party.length; i++) { var o = S.party[i]; if (o !== m && !o.down) { o.energy = Math.min(ENERGY_MAX(), o.energy + k.energy * (o.er || 1)); } }
    } else if (k.type === 'vortex') {
      var n = nearestFoe(S, px, py, 12), dx = n ? n.x - px : (S.lastDx || 0), dy = n ? n.y - py : (S.lastDy || 1), dl = Math.hypot(dx, dy) || 1;
      S.zones.push({ kind: 'vortex', x: px + dx / dl * k.ahead, y: py + dy / dl * k.ahead, r: k.r, t: k.sec, next: k.every, every: k.every,
        mul: k.tick, pull: k.pull, el: m.el, atk: m.atk, m: m });
    }
    kitExtras(S, m, k);
    push(S, { t: 'burst', el: m.el, x: px, y: py, r: k.r, n: hits.length, name: k.name, kit: k.type });
    return { ok: true, n: hits.length, name: k.name, kit: k.type };
  }

  /** 장판·소환 — 놓은 사람 공격력으로 틱마다 친다(그 사이 교체해도 남는다) */
  function stepZones(S, dt) {
    var Z = S.zones || [], i, k;
    for (i = Z.length - 1; i >= 0; i--) {
      var z = Z[i];
      z.t -= dt; z.next -= dt;
      if (z.kind === 'seed') {
        /* ⑲-1 꽃피움 씨앗 — 1.5초 뒤 둘레 3m 에서 터진다 */
        if (z.t <= 1e-9) {
          var sn = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < sn.length; k++) { wake(sn[k]); rawHit(S, sn[k], z.dmg); }
          push(S, { t: 'zone', kind: 'seed', el: 'grass', x: z.x, y: z.y, r: z.r, n: sn.length });
          Z.splice(i, 1);
        }
        continue;
      }
      if (z.kind === 'echo') {
        /* ⑲-15 가면 벗기 메아리 — 그 적을 따라가 t 뒤에 친다(이미 쓰러졌으면 헛친다) */
        var ef = S.foes[z.uid];
        if (ef && !ef.dead) { z.x = ef.x; z.y = ef.y; }
        if (z.t <= 1e-9) {
          if (ef && !ef.dead) { hitFoe(S, ef, z.m, z.m.atk * z.mul, z.el, 'burst'); }
          push(S, { t: 'zone', kind: 'echo', el: z.el, x: z.x, y: z.y, r: z.r, n: ef && !ef.dead ? 1 : 0 });
          Z.splice(i, 1);
        }
        continue;
      }
      if (z.kind === 'shell') {
        /* ⑲-11 늦게 떨어지는 탄 — delay 뒤 둘레 r 을 친다 */
        if (z.t <= 1e-9) {
          var sh = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < sh.length; k++) { hitFoe(S, sh[k], z.m, z.m.atk * z.mul, z.el, 'skill'); }
          push(S, { t: 'zone', kind: 'shell', el: z.el, x: z.x, y: z.y, r: z.r, n: sh.length });
          Z.splice(i, 1);
        }
        continue;
      }
      if (z.kind === 'vortex' && dt > 0) {
        /* ⑲-11 소용돌이 — 둘레 r+2 의 적을 늘 가운데로 끈다 */
        var vs = foesWithin(S, z.x, z.y, z.r + 2);
        for (k = 0; k < vs.length; k++) {
          var vd = Math.hypot(z.x - vs[k].x, z.y - vs[k].y);
          if (vd > 0.6) { var pl = Math.min(vd - 0.5, z.pull * dt); vs[k].x += (z.x - vs[k].x) / vd * pl; vs[k].y += (z.y - vs[k].y) / vd * pl; }
        }
      }
      if (z.next <= 1e-9 && z.t > 1e-9) {
        var who = z.m || { atk: z.atk, em: z.em, tm: z.tm, reactMul: z.reactMul };
        if (z.kind === 'field') {
          var in_ = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < in_.length; k++) { hitFoe(S, in_[k], who, z.atk * FIELD_MUL(), z.el, 'zone'); }
          push(S, { t: 'zone', kind: 'field', el: z.el, x: z.x, y: z.y, r: z.r, n: in_.length });
          z.next += 1;
        } else if (z.kind === 'kitzone') {
          /* ⑲-11 팔괘진 — 안의 가까운 적 n 을 치고, 맞힐 때마다 명단 기력 */
          var kz = foesWithin(S, z.x, z.y, z.r).sort(function (a, b) { return Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y); }).slice(0, z.n);
          for (k = 0; k < kz.length; k++) { hitFoe(S, kz[k], who, z.atk * z.mul, z.el, 'zone'); }
          for (k = 0; k < S.party.length && kz.length && z.energy; k++) {
            var pk = S.party[k];
            if (!pk.down) { pk.energy = Math.min(ENERGY_MAX(), pk.energy + z.energy * kz.length * (pk.er || 1)); }
          }
          push(S, { t: 'zone', kind: 'kitzone', el: z.el, x: z.x, y: z.y, r: z.r, n: kz.length });
          z.next += z.every;
        } else if (z.kind === 'feast') {
          /* ⑲-17 바람 자리 — 안에 선 지금 인물 회복(지난 걸음의 내 자리), 안의 적을 친다 */
          var fa = active(S), fin = Math.hypot(S.mx - z.x, S.my - z.y) <= z.r;
          if (fa && !fa.down && fin) { fa.hp = Math.min(fa.hpMax, fa.hp + Math.round(fa.hpMax * z.heal)); }
          var fz = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < fz.length; k++) { hitFoe(S, fz[k], who, z.atk * z.mul, z.el, 'zone'); }
          push(S, { t: 'zone', kind: 'feast', el: z.el, x: z.x, y: z.y, r: z.r, n: fz.length, heal: fin ? 1 : 0 });
          z.next += z.every;
        } else if (z.kind === 'vortex') {
          var vz = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < vz.length; k++) { hitFoe(S, vz[k], who, z.atk * z.mul, z.el, 'zone'); }
          push(S, { t: 'zone', kind: 'vortex', el: z.el, x: z.x, y: z.y, r: z.r, n: vz.length });
          z.next += z.every;
        } else {
          var tg = nearestFoe(S, z.x, z.y, z.r);
          if (tg) {
            hitFoe(S, tg, who, z.atk * SUMMON_MUL(), z.el, 'zone');
            push(S, { t: 'zone', kind: 'summon', el: z.el, x: z.x, y: z.y, tx: tg.x, ty: tg.y, r: 1.2, n: 1 });
          }
          z.next += SUMMON_EVERY();
        }
      }
      if (z.t <= 1e-9) { Z.splice(i, 1); }
    }
  }

  /** 원소 해방 — 기력 60 을 다 쓴다. 내 둘레 7m, 1초 무적 */
  function burst(S, px, py) {
    var m = active(S);
    if (!m || m.down || m.energy < ENERGY_MAX() || m.burstCd > 0) { return { ok: false }; }
    m.energy = 0; m.burstCd = BURST_CD();
    S.iframe = Math.max(S.iframe, 1.0);
    if (m.c6 && global.DG.talent) { m.c6T = global.DG.talent.C6_SEC; }   // ⑲-4 깨달음 5 — 해방 뒤 공격 +20%
    if (m.kitB) { return kitBurst(S, m, px, py); }                    // ⑲-11 고유·갈래
    var hits = foesWithin(S, px, py, BURST_R());
    for (var i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * BURST_MUL(), m.el, 'burst'); }
    push(S, { t: 'burst', el: m.el, x: px, y: py, r: BURST_R(), n: hits.length });
    return { ok: true, n: hits.length };
  }

  /** 회피 — 스태미나 20, 0.35초 무적, 3.6m 미끄러진다. 방향이 없으면 가장 가까운 적 반대로 */
  function dodge(S, dx, dy, px, py) {
    var dc = DODGE_COST() * staSave();
    if (S.stamina < dc || allDown(S)) { return { ok: false }; }
    if (dx || dy) { S.lastDx = dx; S.lastDy = dy; }
    if (!dx && !dy) {
      var n = nearestFoe(S, px || 0, py || 0, 30);
      if (n) { dx = (px || 0) - n.x; dy = (py || 0) - n.y; } else { dy = 1; }
    }
    var len = Math.hypot(dx, dy) || 1;
    S.stamina -= dc; S.staT = 0;
    S.iframe = Math.max(S.iframe, DODGE_IFRAME());
    S.dash = { vx: dx / len * DASH_M() / DASH_T(), vy: dy / len * DASH_M() / DASH_T(), t: DASH_T() };
    push(S, { t: 'dodge' });
    return { ok: true };
  }

  /** 교체 — 1초 쿨. 쓰러진 사람에게는 못 바꾼다 */
  function swap(S, idx) {
    var m = S.party[idx];
    if (!m || idx === S.active || m.down || S.swapCd > 0) { return { ok: false }; }
    S.active = idx; S.swapCd = SWAP_CD(); S.combo = 0;
    push(S, { t: 'swap', idx: idx, id: m.id, el: m.el });
    return { ok: true };
  }

  function hurt(S, f, mul) {
    var m = active(S);
    if (!m || m.down) { return; }
    var dmg = Math.max(1, Math.round(f.atk * (mul || 1) * (1 - m.def / (m.def + 300))));   // mul — ⑲-14 공격 차례의 한 수 배수
    if (S.wardT > 0) { dmg = Math.max(1, Math.round(dmg * S.wardMul)); }   // ⑲-11 맹세·오천의 맹세
    var rockX = f.el === 'rock' ? Math.round(dmg * 0.3) : 0;   // ⑲-1 짓눌림 — 이것만으로는 안 쓰러진다
    S.calmT = 0;
    /* ⑲-1 결정 보호막이 먼저 막는다 — 다 막으면 원소 효과도 없다 */
    var G = S.guard, absorbed = 0;
    if (G && G.hp > 0) {
      absorbed = Math.min(G.hp, dmg + rockX);
      G.hp -= absorbed;
      var fromBase = Math.min(dmg, absorbed);
      dmg -= fromBase; rockX -= absorbed - fromBase;
      if (G.hp <= 0) { S.guard = null; }
    }
    if (dmg <= 0 && rockX <= 0) {
      push(S, { t: 'hurt', uid: f.uid, dmg: 0, el: f.el, id: m.id, guarded: absorbed });
      return;
    }
    m.hp -= dmg;
    if (rockX > 0 && m.hp > 0) { m.hp = Math.max(1, m.hp - rockX); }
    var tot = dmg + rockX;
    if (f.el === 'fire') { m.burn = { n: 3, t: 1, dmg: Math.max(1, Math.round(tot * 0.2)) }; }
    else if (f.el === 'water') { S.stamina = Math.max(0, S.stamina - 25); S.staT = 0; }
    else if (f.el === 'elec') { m.energy = Math.max(0, m.energy - 10); }
    else if (f.el === 'wind') { m.skillCd += 2; }                                   // 휘말림
    else if (f.el === 'ice') { S.staT = Math.min(S.staT, -2.2); }                   // 한기 — 스태미나 회복 3초 멈춤
    else if (f.el === 'grass') { m.burn = { n: 4, t: 1, dmg: Math.max(1, Math.round(tot * 0.15)), poison: true }; }   // 중독(화상 자리)
    push(S, { t: 'hurt', uid: f.uid, dmg: tot, el: f.el, id: m.id, guarded: absorbed });
    if (m.hp <= 0) { downMember(S, S.active); }
  }

  function downMember(S, idx) {
    var m = S.party[idx];
    m.hp = 0; m.down = true; m.burn = null;
    push(S, { t: 'down', idx: idx, id: m.id });
    if (idx === S.active && nextAlive(S)) {
      push(S, { t: 'swap', idx: S.active, id: S.party[S.active].id, el: S.party[S.active].el, forced: true });
    }
    if (allDown(S)) {
      /* 전멸 — 모두 30% 로 일어나고 붙어 있던 무리는 제자리로 돌아가 다시 찬다 */
      for (var i = 0; i < S.party.length; i++) {
        var p = S.party[i];
        p.down = false; p.hp = Math.round(p.hpMax * 0.3); p.burn = null;
      }
      S.active = 0;
      var L = living(S);
      for (var j = 0; j < L.length; j++) {
        if (L[j].st !== 'idle') { L[j].st = 'return'; L[j].mark = null; L[j].calmReturn = 3; }
      }
      S.calmT = 0;
      if (S.duel) { S.duel.wiped = true; }
      S.guard = null;
      push(S, { t: 'wipe' });
    }
  }

  /**
   * 한 걸음. inp = { px, py, blocked }. blocked 면(조우 창·시트) 적이 제자리에 멎는다.
   * 쌓인 사건은 S.ev 로 남는다 — 부른 쪽이 비운다(`drain`).
   */
  function step(S, dt, inp) {
    var px = inp.px, py = inp.py;
    S.mx = px; S.my = py;
    S.t += dt;
    S.calmT += dt;
    S.iframe = Math.max(0, S.iframe - dt);
    S.swapCd = Math.max(0, S.swapCd - dt);
    S.atkCd = Math.max(0, S.atkCd - dt);
    if (S.aim) {                                                    // ⑲-22 조준 — 활 아닌 인물·쓰러짐·대화면 풀린다
      if (!canAim(S) || inp.blocked) { aimEnd(S); }
      else { if (S.aim.hold) { S.aim.t = Math.min(AIM_FULL() + 1, S.aim.t + dt); } aimLock(S, px, py); }
    }
    stepArrows(S, dt);
    S.comboT += dt;
    if (S.comboT > 1.0) { S.combo = 0; }
    S.staT += dt;
    if (S.staT > 0.8) { S.stamina = Math.min(STA_MAX(), S.stamina + 30 * dt); }
    if (S.dash) {
      var dd = Math.min(dt, S.dash.t);
      push(S, { t: 'move', dx: S.dash.vx * dd, dy: S.dash.vy * dd });
      S.dash.t -= dd;
      if (S.dash.t <= 1e-6) { S.dash = null; }
    }
    if (S.zones && S.zones.length) { stepZones(S, dt); }
    if (S.guard) { S.guard.t -= dt; if (S.guard.t <= 0 || S.guard.hp <= 0) { S.guard = null; } }
    if (S.rallyT > 0) { S.rallyT = Math.max(0, S.rallyT - dt); }
    if (S.loreT > 0) { S.loreT = Math.max(0, S.loreT - dt); }
    if (S.rainT > 0) { S.rainT = Math.max(0, S.rainT - dt); }       // ⑲-17 뱃노래
    if (S.rainCd > 0) { S.rainCd = Math.max(0, S.rainCd - dt); }
    if (S.wardT > 0) { S.wardT = Math.max(0, S.wardT - dt); }
    if (S.hasteT > 0) { S.hasteT = Math.max(0, S.hasteT - dt); }
    var i, m;
    for (i = 0; i < S.party.length; i++) {
      m = S.party[i];
      m.skillCd = Math.max(0, m.skillCd - dt * (S.hasteT > 0 ? 2 : 1));   // ⑲-11 천기 뇌우 — 두 배로 돈다
      m.burstCd = Math.max(0, m.burstCd - dt);
      if (m.c6T > 0) { m.c6T = Math.max(0, m.c6T - dt); }
      if (m.infT > 0) { m.infT = Math.max(0, m.infT - dt); }
      if (m.burn && !m.down) {
        m.burn.t -= dt;
        if (m.burn.t <= 0) {
          m.burn.t += 1; m.burn.n--;
          m.hp = Math.max(1, m.hp - m.burn.dmg);   // 화상만으로는 안 쓰러진다
          push(S, { t: 'burn', idx: i, dmg: m.burn.dmg });
          if (m.burn.n <= 0) { m.burn = null; }
        }
      }
      if (!m.down && S.calmT > CALM_REGEN()) { m.hp = Math.min(m.hpMax, m.hp + m.hpMax * 0.04 * dt); }
      if (m.down && S.calmT > REVIVE_CALM()) { m.down = false; m.hp = Math.round(m.hpMax * 0.3); push(S, { t: 'revive', idx: i }); }
    }

    var ids = Object.keys(S.foes);
    for (var n = 0; n < ids.length; n++) {
      var f = S.foes[ids[n]];
      if (!f) { continue; }
      if (f.dead) {
        f.deadT += dt;
        if (f.deadT > 1.2) { delete S.foes[ids[n]]; }
        continue;
      }
      f.moving = false;
      if (f.kb) {                                         // ⑲-17 밀려남 — 멎어 있어도 미끄러진다
        var kbt = Math.min(dt, f.kb.t);
        f.x += f.kb.vx * kbt; f.y += f.kb.vy * kbt; f.kb.t -= dt;
        if (f.kb.t <= 1e-9) { f.kb = null; }
      }
      if (f.sky) { var SKc = global.DG.skyIsle; if (SKc && SKc.clampIn) { SKc.clampIn(f); } }   // ⑲-20 섬 무리는 난간을 못 넘는다
      if (f.auraT > 0) { f.auraT -= dt; if (f.auraT <= 0) { f.aura = null; } }
      if (f.shockN > 0) {
        f.shockT -= dt;
        if (f.shockT <= 0) {
          f.shockT += 1; f.shockN--;
          var sd = rawHit(S, f, f.shockDmg);
          push(S, { t: 'dot', uid: f.uid, x: f.x, y: f.y, dmg: sd, el: 'elec' });
          if (f.dead) { continue; }
        }
      }
      if (f.physT > 0) { f.physT -= dt; }
      if (f.markT > 0) { f.markT -= dt; }                 // ⑲-15 표식
      if (f.quickT > 0) { f.quickT -= dt; }
      if (f.burnN > 0) {                                  // ⑲-1 들불 — 0.5초마다 여덟 번
        f.burnT -= dt;
        if (f.burnT <= 0) {
          f.burnT += BURN_EVERY(); f.burnN--;
          var bd = rawHit(S, f, f.burnDmg);
          push(S, { t: 'dot', uid: f.uid, x: f.x, y: f.y, dmg: bd, el: 'fire' });
          if (f.dead) { continue; }
        }
      }
      if (inp.blocked) { continue; }
      if (f.frozenT > 0) { f.frozenT -= dt; continue; }   // ⑲-1 얼어붙음 — 꼼짝 못 한다
      if (f.stun > 0) { f.stun -= dt; continue; }
      var F = FOES[f.kind];
      /* ⑲-20 층이 갈리면(내가 섬에서 뛰어내렸다) 쫓던 적은 제자리로 — 나를 못 본다 */
      var far = apart(f);
      if (far && (f.st === 'chase' || f.st === 'wind' || f.st === 'recover')) { f.st = 'return'; f.mark = null; }
      var d = far ? Infinity : Math.hypot(f.x - px, f.y - py);
      var home = Math.hypot(f.x - f.hx, f.y - f.hy);
      if (f.st !== 'return' && f.st !== 'idle' && home > LEASH_R()) { f.st = 'return'; f.mark = null; }
      if (f.st === 'idle') {
        f.wa += dt * 0.35;
        var tx = f.hx + Math.cos(f.wa) * 2.2, ty = f.hy + Math.sin(f.wa * 0.8) * 2.2;
        moveToward(f, tx, ty, 1.1 * dt);
        if ((d < AGGRO_R() || f.siege) && !allDown(S)) { f.st = 'chase'; push(S, { t: 'aggro', uid: f.uid, camp: f.camp }); }
      } else if (f.st === 'return') {
        f.calmReturn = Math.max(0, f.calmReturn - dt);
        moveToward(f, f.hx, f.hy, F.spd * 1.2 * dt);
        if (Math.hypot(f.x - f.hx, f.y - f.hy) < 0.6) {
          f.st = 'idle'; f.hp = f.hpMax; f.shield = f.shieldMax; f.aura = null; f.shockN = 0;
          f.frozenT = 0; f.physT = 0; f.quickT = 0; f.burnN = 0;
          f.layer = 0; f.shEl = (f.layers && f.layers[0]) || f.shEl;
        }
      } else if (f.st === 'chase') {
        S.calmT = Math.min(S.calmT, 0);
        /* ⑲-14 공격 차례(rot)가 있으면 이번 수의 reach·wind·r 을 쓴다 */
        var AT = F.rot ? F.rot[(f.rotI || 0) % F.rot.length] : F.type, RT = F.rot ? ROT[AT] : F;
        var want = AT === 'shadow' ? 0 : (AT === 'spit' ? RT.reach * 0.85 : RT.reach * 0.8);
        /* ⑲-16 지킬 것 — 내가 SIEGE_PULL 밖이면 제단이 과녁(제단 몸 둘레만큼 덜 다가간다) */
        var sg = f.siege && d > SIEGE_PULL ? f.siege : null;
        var gx = sg ? sg.x : px, gy = sg ? sg.y : py, gd = (sg ? Math.max(0, Math.hypot(f.x - gx, f.y - gy) - SIEGE_BODY) : d) - (AT === 'shadow' ? 0 : BODY(f));
        if (gd > want && AT !== 'shadow') { moveToward(f, gx, gy, F.spd * dt); }
        f.cd -= dt;
        if (gd <= RT.reach && f.cd <= 0 && !allDown(S)) {
          f.st = 'wind'; f.stT = RT.wind; f.atkT = AT; f.atkSiege = !!sg;
          if (AT === 'shadow') {
            /* 나를 지나 등 뒤로 — 오던 쪽의 반대편 SHADOW_BACK m 에 붙어 제 둘레를 친다 */
            var sdx = px - f.x, sdy = py - f.y, sdl = Math.hypot(sdx, sdy) || 1;
            f.x = px + sdx / sdl * SHADOW_BACK; f.y = py + sdy / sdl * SHADOW_BACK;
            push(S, { t: 'blink', uid: f.uid, x: f.x, y: f.y });
          }
          if (AT === 'tide' || AT === 'rift') {
            var tl = tideMarks(f.x, f.y, gx, gy, AT);
            f.mark = { x: tl[0].x, y: tl[0].y, r: RT.r, t: RT.wind, list: tl };
          } else {
            f.mark = AT === 'spit' ? { x: gx, y: gy, r: RT.r, t: RT.wind }
              : (AT === 'halo' ? { x: f.x, y: f.y, r: RT.r, inner: RT.inner, t: RT.wind }
                : (AT === 'slam' || AT === 'shadow' ? { x: f.x, y: f.y, r: RT.r, t: RT.wind } : null));
          }
          push(S, { t: 'tell', uid: f.uid, type: AT === 'shadow' || AT === 'tide' || AT === 'halo' || AT === 'rift' ? 'slam' : AT, x: f.x, y: f.y });
        }
      } else if (f.st === 'wind') {
        S.calmT = Math.min(S.calmT, 0);
        f.stT -= dt;
        if (f.stT <= 0) {
          var WT = f.atkT || F.type, WR = F.rot ? ROT[WT] : F;
          /* ⑲-16 제단을 노린 코앞 한 대는 나를 안 친다(원 예고는 누구든 맞는다) */
          var inHit = f.mark ? markHit(f.mark, px, py, 0) : (!f.atkSiege && d - BODY(f) <= WR.reach + 0.6);
          if (inHit && S.iframe <= 0) { hurt(S, f, WR.mul); }
          else if (inHit) { push(S, { t: 'evade', uid: f.uid }); }
          if (f.atkSiege && f.siege) {
            var sx = f.siege.x, sy = f.siege.y;
            if (f.mark ? markHit(f.mark, sx, sy, SIEGE_BODY) : Math.hypot(f.x - sx, f.y - sy) <= WR.reach + 0.6 + SIEGE_BODY) {
              push(S, { t: 'siege', uid: f.uid, camp: f.camp, x: sx, y: sy, dmg: Math.max(1, Math.round(f.atk * (WR.mul || 1))) });
            }
          }
          f.atkSiege = false;
          var SL = f.mark && f.mark.list ? f.mark.list : [f.mark || f];
          for (var si = 0; si < SL.length; si++) {
            push(S, { t: 'strike', uid: f.uid, type: WT === 'shadow' || WT === 'tide' || WT === 'halo' || WT === 'rift' ? 'slam' : WT, x: SL[si].x, y: SL[si].y, r: f.mark ? f.mark.r : 0 });
          }
          /* ⑲-30 틈새 질주 — 틈으로 사라져 줄 끝에 나타난다(땅 높이가 크게 다르면 제자리) */
          if (WT === 'rift' && f.mark && f.mark.list) {
            var rEnd = f.mark.list[f.mark.list.length - 1];
            if (riftOk(f.x, f.y, rEnd.x, rEnd.y)) { f.x = rEnd.x; f.y = rEnd.y; push(S, { t: 'blink', uid: f.uid, x: f.x, y: f.y }); }
          }
          if (F.rot) { f.rotI = ((f.rotI || 0) + 1) % F.rot.length; }
          f.mark = null; f.cd = F.cd * (f.cdMul || 1);          // ⑲-9 주간 보스 2단계는 cdMul 로 빨라진다
          /* 이 한 대로 전멸했으면 downMember 가 이미 'return' 으로 돌려놨다 — 덮지 않는다 */
          if (f.st === 'wind') { f.st = 'recover'; f.stT = 0.5; }
        }
      } else if (f.st === 'recover') {
        f.stT -= dt;
        if (f.stT <= 0) { f.st = 'chase'; }
      }
      if (f.moving) { f.phase += dt * 9; }
    }
    if (!inp.blocked) { separate(S, dt); }
    duelCheck(S, dt);
    return S;
  }

  /** 적끼리 밀어내기(2026-09-28 실기 Q6 "난리") — 모두 같은 자리(내 코앞)로 몰려 몸 5~8m 짜리가 한 덩이로 겹쳤다.
      두 몸 반지름 합 × SEP_K 보다 가까우면 반씩 비킨다(한 프레임에 다 안 밀고 dt × 8 만큼 — 튀지 않게) */
  function SEP_K() { return K('sepK', 1.0); }
  function separate(S, dt) {
    var L = living(S), n = L.length, i, j, k = SEP_K();
    if (!k || n < 2) { return; }
    var rate = Math.min(1, dt * 8);
    for (i = 0; i < n; i++) {
      var a = L[i], ba = BODY(a);
      for (j = i + 1; j < n; j++) {
        var b = L[j], want = (ba + BODY(b)) * k, dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > want || Math.abs(dy) > want) { continue; }
        var d = Math.hypot(dx, dy);
        if (d >= want) { continue; }
        if (d < 1e-3) { dx = (a.uid % 2 ? 1 : -1); dy = 0.3; d = Math.hypot(dx, dy); }   // 한 점이면 번호로 갈라 비킨다
        var push = (want - d) / 2 * rate, ux = dx / d, uy = dy / d;
        var fa = a.frozenT > 0 ? 0 : 1, fb = b.frozenT > 0 ? 0 : 1;                  // 얼어붙은 적은 제자리 — 상대가 다 비킨다
        if (!fa && !fb) { continue; }
        var sa = fa && fb ? 1 : (fa ? 2 : 0), sb = fa && fb ? 1 : (fb ? 2 : 0);
        a.x -= ux * push * sa; a.y -= uy * push * sa;
        b.x += ux * push * sb; b.y += uy * push * sb;
      }
    }
  }

  function moveToward(f, tx, ty, stepM) {
    var dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    if (d < 1e-3) { return; }
    var s = Math.min(d, stepM);
    f.x += dx / d * s; f.y += dy / d * s;
    f.moving = s > 0.004;
  }

  function drain(S) { var e = S.ev; S.ev = []; return e; }

  /** 지금 싸우는 중인가 — 쫓거나 예고 중인 적이 있거나, 방금 때리고 맞았다 */
  function engaged(S) {
    if (!S) { return false; }
    if (S.calmT < 3) { return true; }
    var L = living(S);
    for (var i = 0; i < L.length; i++) { if (L[i].st === 'chase' || L[i].st === 'wind' || L[i].st === 'recover') { return true; } }
    return false;
  }

  /**
   * ⑲-18 편성을 막는 "싸우는 중" — 방금(COMBAT_CALM 초 안) 때리거나 맞았거나, COMBAT_R m 안에 나를 쫓거나 치는 적.
   * 쉬는 적·제단만 치는 적(siege 로 나를 안 보는 적)은 뺀다. engaged 보다 좁다(멀리서 쫓는 적은 안 친다)
   */
  var COMBAT_R = 30, COMBAT_CALM = 3;
  function inCombat(S, px, py) {
    if (!S) { return false; }
    if (S.calmT < COMBAT_CALM) { return true; }
    var L = living(S);
    for (var i = 0; i < L.length; i++) {
      var f = L[i], d = Math.hypot(f.x - px, f.y - py);
      if (d > COMBAT_R || (f.st !== 'chase' && f.st !== 'wind' && f.st !== 'recover')) { continue; }
      if (f.siege && d > SIEGE_PULL) { continue; }
      return true;
    }
    return false;
  }

  /* ══ 런타임 — 세이브·화면·입력 ═══════════════════════════ */
  var S = null, partyKey = '', popAcc = 9, refAcc = 0, bound = false, hudEl = null;
  var numLayer = null, fx = { marks: {}, rings: [] };
  var lastAuto = 0;

  function RESPAWN_MS() { return K('respawnMin', 15) * 60000; }
  function fieldSave() {
    var s = core().save;
    if (!s.field || typeof s.field !== 'object') { s.field = { camps: {}, kills: 0, clears: 0 }; }
    if (!s.field.camps) { s.field.camps = {}; }
    if (!s.field.guards || typeof s.field.guards !== 'object') { s.field.guards = {}; }   // ⑪ 지역키 → 마지막 토벌 시각(사명 평정은 있기만 보면 된다)
    if (!s.field.guardPaid || typeof s.field.guardPaid !== 'object') { s.field.guardPaid = {}; }   // ⑲-10 지역키 → 꽃을 받은 시각(150초 뒤 다시 선다)
    return s.field;
  }
  /** ⑲-10 이 수호자가 다시 섰나 — 꽃을 받고 150초가 지났으면. **순수 함수**(fs 를 읽기만) */
  function guardBack(fs, rk, now) {
    var at = fs.guardPaid && fs.guardPaid[rk];
    return !!at && now - at >= K('guardBackSec', 150) * 1000;
  }
  function pkey() { return (core().save.party || []).slice(0, PARTY_MAX()).join(','); }

  function ensureState() {
    var k = pkey();
    if (!S) {
      S = create(core().save.party);
      partyKey = k;
      var fs = fieldSave(), now = Date.now();
      for (var c in fs.camps) {
        if (fs.camps.hasOwnProperty(c) && now - fs.camps[c] < RESPAWN_MS()) { S.cleared[c] = true; }
      }
      for (var g in fs.guards) { if (fs.guards.hasOwnProperty(g) && !guardBack(fs, g, now)) { S.cleared['g:' + g] = true; } }
    } else if (k !== partyKey) {
      reparty(S, core().save.party);
      partyKey = k;
    }
    return S;
  }

  /** 레벨·장비가 바뀌면 공격력·최대 체력을 다시 읽는다(체력 비율은 그대로) */
  function refreshStats() {
    for (var i = 0; i < S.party.length; i++) {
      var m = S.party[i], f = memberOf(m.id);
      var ratio = m.hpMax ? m.hp / m.hpMax : 1;
      m.atk = f.atk; m.em = f.em; m.def = f.def; m.hpMax = f.hpMax;
      m.tm = f.tm; m.con = f.con; m.cdMul = f.cdMul; m.reactMul = f.reactMul; m.c6 = f.c6;
      m.kitS = f.kitS; m.kitB = f.kitB; m.kitL = f.kitL;
      m.wtype = f.wtype; m.kit = f.kit; m.wid = f.wid; m.cr = f.cr; m.cdm = f.cdm; m.er = f.er;
      m.dmgB = f.dmgB; m.elemB = f.elemB; m.rxAll = f.rxAll; m.rx = f.rx;
      m.hp = Math.round(f.hpMax * ratio);
    }
  }

  function blocked() {
    var D = global.DG;
    return !!((D.encounter && D.encounter.active) || (D.rogue && D.rogue.active) ||
      (D.duel && D.duel.active) || (D.rogueAction && D.rogueAction.active) ||
      (D.story && D.story.talking && D.story.talking()) ||                     // ⑲-12 이야기 대화 창
      (D.fishing && D.fishing.active) ||                                       // ⑲-24 낚시 중(F·스페이스는 낚시가 쓴다)
      (document.body && document.body.classList.contains('sheet-open')));
  }

  function terrFn() {
    var W = global.DG.world;
    return W && W.terrainAt ? function (tx, ty) { try { return W.terrainAt(tx, ty); } catch (e) { return null; } } : null;
  }

  /** 자동 전투 — 🤖 자동 전투를 켰거나, 자동 순행 중이면(AI 가 걷는데 싸움만 사람에게 맡길 수는 없다) */
  function autoOn() {
    var sv = core().save, st = sv.settings;
    return !!((st && st.autoBattle) || (sv.auto && sv.auto.on));
  }

  /** 자동 회피(2026-09-28 실기 Q6) — 🤖 는 예고(붉은 원·코앞 휘두름)를 하나도 안 피해 혼자면 보통 무리에도 거의 쓰러졌다.
      나를 칠 공격이 막 떨어지려 할 때(무적 시간 안) 기력이 있으면 그 자리에서 비켜 난다. 매 프레임 본다 */
  function autoThreat(S, px, py) {
    var L = living(S), i;
    for (i = 0; i < L.length; i++) {
      var f = L[i];
      if (f.st !== 'wind' || f.stT > DODGE_IFRAME() * 0.7) { continue; }
      var F = FOES[f.kind], WT = f.atkT || F.type, WR = F.rot ? ROT[WT] : F;
      if (f.mark ? markHit(f.mark, px, py, 0) : (!f.atkSiege && Math.hypot(f.x - px, f.y - py) - BODY(f) <= WR.reach + 0.6)) { return f; }
    }
    return null;
  }
  function autoDodge(pos) {
    if (S.iframe > 0 || S.dash || !K('autoDodge', 1)) { return false; }
    var f = autoThreat(S, pos.x, pos.y);
    if (!f) { return false; }
    var c = f.mark ? (f.mark.list ? f.mark.list[0] : f.mark) : f;
    var dx = pos.x - c.x, dy = pos.y - c.y;
    if (Math.hypot(dx, dy) < 0.3) { dx = pos.x - f.x; dy = pos.y - f.y; }        // 내 발밑에 떨어지는 침 — 쏜 적 반대쪽으로
    /* 곧장 뒤로만 비키면 한 번에 3.6m 씩 밀려나 적의 추격 한계를 벗어나고, 적이 제자리로 돌아가 방패를 다시 채웠다(09-28 수호자 무한 반복).
       옆으로 돌며 비킨다(좌우는 번갈아) — 원 예고도 대시 3.6m 면 벗어난다 */
    var dl0 = Math.hypot(dx, dy) || 1, side = (S.dodgeSide = -(S.dodgeSide || 1));
    dx /= dl0; dy /= dl0;
    var sx = -dy * side, sy = dx * side;
    dx = sx * 0.85 + dx * 0.5; dy = sy * 0.85 + dy * 0.5;
    var r = dodge(S, dx, dy, pos.x, pos.y);
    if (r.ok) { handle(drain(S), pos); }
    return r.ok;
  }

  function autoFight(pos) {
    var m = active(S);
    if (!m || m.down) { return; }
    var n = nearestFoe(S, pos.x, pos.y, SKILL_AIM());
    if (!n) { return; }
    if (m.energy >= ENERGY_MAX() && foesWithin(S, pos.x, pos.y, BURST_R()).length >= 2) { act('burst'); return; }
    if (m.skillCd <= 0) { act('skill'); return; }
    /* ⑲-2 얼어 있는 적이 곁에 있으면 강공격으로 깬다 */
    if (n.frozenT > 0 && S.stamina >= CHARGE_COST() && Math.hypot(n.x - pos.x, n.y - pos.y) <= CHARGE_REACH()) { act('heavy'); return; }
    if (Math.hypot(n.x - pos.x, n.y - pos.y) <= LUNGE_R()) { act('attack'); }
  }

  function tick(dt) {
    if (!on() || !core() || !core().save) { hide(); return; }
    ensureState();
    var pos = core().save.player.pos;
    popAcc += dt; refAcc += dt;
    if (popAcc > 0.5) {
      popAcc = 0;
      respawnSweep();                          // 다시 설 무리를 먼저 풀고 세운다(⑲-10 수호자가 한 박자 늦던 것)
      var BM = global.DG.biome;
      populate(S, pos.x, pos.y, terrFn(), K('activeR', 200), BM && BM.on() ? BM.biomeAt : null,
        BM && BM.on() && BM.landmarks && K('guards', 1) ? BM.landmarks : null,
        BM && BM.on() && BM.zoneAt && K('eras', 1) ? BM.zoneAt : null,
        global.DG.treasure && global.DG.treasure.on() ? global.DG.treasure.campsNear : null);
    }
    if (refAcc > 2) { refAcc = 0; refreshStats(); }
    var bl = blocked();
    /* 걷는 쪽을 바라본다 — 적이 없을 때 스킬·돌진이 나가는 쪽. 전엔 마지막으로 회피한 쪽(없으면 남쪽)으로만 나갔다(2026-09-28) */
    var Wm = global.DG.world, mv = Wm && Wm.motion;
    if (mv && mv.speed > 1.5 && (mv.vx || mv.vy)) { S.lastDx = mv.vx; S.lastDy = mv.vy; }
    step(S, dt, { px: pos.x, py: pos.y, blocked: bl });
    if (!bl && autoOn() && engaged(S)) {
      lastAuto += dt;
      /* 2026-09-28 실기 Q6 "너무 오래 걸림" — 0.3초마다만 눌러 칼 3타(0.34초 박자)의 절반을 놓쳤다(초당 46 피해,
         손으로 연타하면 159). 공격 쿨이 풀리는 그 프레임에도 누른다 */
      if (!autoDodge(pos) && (lastAuto > 0.3 || S.atkCd <= 0)) { lastAuto = 0; autoFight(pos); }
    }
    handle(drain(S), pos);
    if (!global.DG_NO_DRAW) { paint(dt); }
  }

  function respawnSweep() {
    var fs = fieldSave(), now = Date.now();
    for (var c in S.cleared) {
      if (!S.cleared.hasOwnProperty(c)) { continue; }
      if (c.indexOf('g:') === 0) { if (guardBack(fs, c.slice(2), now)) { delete S.cleared[c]; } continue; }   // ⑲-10 꽃을 받고 150초면 다시 선다
      var at = fs.camps[c];
      if (!at || now - at >= RESPAWN_MS()) { delete S.cleared[c]; delete fs.camps[c]; }
    }
  }

  function toast(msg) { if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }

  function handle(ev, pos) {
    var c = core(), H = global.DG.hero, i;
    for (i = 0; i < ev.length; i++) {
      var e = ev[i];
      /* ⑲-3 원소 신호 — 스킬·폭발·장판 자리를 알린다(treasure.js 가 석등을 켠다) */
      if ((e.t === 'skill' || e.t === 'burst' || e.t === 'arrow' || (e.t === 'zone' && (e.kind === 'field' || e.kind === 'shell' || e.kind === 'kitzone' || e.kind === 'vortex' || e.kind === 'feast'))) && e.el) {
        /* 돌진·찌르기는 지나간 선(x0,y0 → x,y) 전체가 닿는다 — 끝점만 알리면 제단을 가로질러도 안 켜졌다(2026-09-28) */
        c.emit('field:element', { el: e.el, x: e.x, y: e.y, r: e.r || 3, t: e.t, x0: e.x0, y0: e.y0 });
      }
      if (e.t === 'move') {
        pos.x += e.dx; pos.y += e.dy;
        /* 떠 있는 섬 위면 회피·돌진도 난간 안에서 멈춘다 — 전엔 밀려 떨어져 섬 위 무리와 층이 갈려 싸움이 안 끝났다(2026-09-28, ⑲-49) */
        var LFm = global.DG.landform, SKm = global.DG.skyIsle;
        if (LFm && LFm.onSky && LFm.onSky() && SKm && SKm.clampIn) { SKm.clampIn(pos); }
      }
      else if (e.t === 'weak') { floatNum(e.x, e.y, '급소!', null, 1.35, true); c.emit('field:weak', {}); }   // ⑲-25 업적이 센다
      else if (e.t === 'shoot') { sfx('hit'); }
      else if (e.t === 'arrow') { ring(e.x, e.y, e.el ? 1.2 : 0.6, e.el && EL[e.el] ? EL[e.el].color : '#e8e2d0', 0.3); }
      else if (e.t === 'hit') {
        sfx('hit');
        floatNum(e.x, e.y, e.immune ? '면역' : String(e.dmg) + (e.crit ? '!' : ''), e.el, (e.react ? 1.3 : (e.src === 'burst' ? 1.25 : 1)) * (e.crit ? 1.25 : 1), !!e.crit);
        var w = W3();
        if (w) {
          w.playAnim('fc' + e.uid, 'hit', 260);
          if (e.src === 'burst') { w.shake(0.5); w.hold(90); } else if (e.react) { w.shake(0.3); w.hold(60); } else { w.shake(0.12); }
        }
      } else if (e.t === 'react') {
        var RI = REACT[e.kind] || { el: 'fire', r: 2 };
        floatNum(e.x, e.y, e.name + '!', RI.el, 1.5, true);
        ring(e.x, e.y, RI.r || 1.8, e.kind === 'overload' ? '#ffb347' : EL[RI.el].color, 0.45);
        if (global.DG.daily) { global.DG.daily.progress('react'); }   // ⑲-8 일일 의뢰(깨뜨림·번개싹 포함)
        c.emit('field:react', { kind: e.kind });                       // ⑲-25 업적(반응·가짓수)
        if (e.kind === 'crystallize') { toast('🪨 굳힘 보호막 — 명단이 ' + (S.guard ? S.guard.hp : 0) + ' 만큼 막는다(15초)'); }
      } else if (e.t === 'dot') { floatNum(e.x, e.y, String(e.dmg), e.el || 'elec', 0.8); }
      else if (e.t === 'break') {
        floatNum(e.x, e.y, e.next ? '겉 방패 깨짐! ' + EL[e.next].icon + ' 속 방패' : '방패 깨짐!', null, 1.4, true);
        if (e.next) { toast('🛡️ 속 방패 ' + EL[e.next].icon + ' — ' + EL[COUNTER[e.next]].icon + ' 원소 동행으로 바꿔라'); }
        ring(e.x, e.y, 2.4, '#ffffff', 0.4);
        if (W3()) { W3().shake(0.45); W3().hold(100); } c.emit('field:break', { camp: e.camp, left: e.left });   // ㉑ 방패 한 겹 = 부위 하나(track.js)
      } else if (e.t === 'swing') {
        if (W3()) { W3().playAnim('me', 'attack', 280); }
        if (e.ranged && e.tx != null) { ring(e.tx, e.ty, 0.8, e.el && EL[e.el] ? EL[e.el].color : '#e8e2d0', 0.25); }   // ⑲-5 서책·활
      } else if (e.t === 'skill') {
        if (e.shape === 'thrust' || e.shape === 'dash') {
          /* 선 모양 — 길을 따라 작은 원을 늘어놓는다 */
          for (var si = 1; si <= 4; si++) {
            var sf = si / 4;
            ring(e.x0 + (e.x - e.x0) * sf, e.y0 + (e.y - e.y0) * sf, e.r * 0.8, EL[e.el].color, 0.35 + sf * 0.2);
          }
        } else {
          ring(e.x, e.y, e.r, EL[e.el].color, e.shape === 'field' ? 0.9 : 0.5);
        }
        if (e.name) { floatNum(pos.x, pos.y, EL[e.el].icon + ' ' + e.name, e.el, 0.95, true, true); }       // ⑲-11 고유·갈래
        else if (e.shape && e.shape !== 'circle') { floatNum(pos.x, pos.y, SHAPES[e.shape].icon + ' ' + SHAPES[e.shape].name, e.el, 0.9, true, true); }
        if (W3()) { W3().playAnim('me', 'attack', 380); }
      } else if (e.t === 'heavy') {
        ring(e.x, e.y, e.r, '#f4f1e2', 0.5);
        floatNum(pos.x, pos.y, '강공격', null, 1, true, true);
        if (W3()) { W3().playAnim('me', 'attack', 500); W3().shake(0.2); }
      } else if (e.t === 'tired') { floatNum(pos.x, pos.y, '기력 부족', null, 0.9, true, true); }
      else if (e.t === 'plunge') {
        ring(e.x, e.y, e.r, '#f4ecd0', 0.6); ring(e.x, e.y, e.r * 0.45, '#ffffff', 0.4);
        floatNum(pos.x, pos.y, '낙하 공격 ×' + e.mul.toFixed(1), null, 1.2, true, true);
        if (W3()) { W3().playAnim('me', 'attack', 420); W3().shake(0.45); W3().hold(90); }
        sfx('hit');
      } else if (e.t === 'burst') {
        ring(e.x, e.y, e.r, EL[e.el].color, 0.8);
        ring(e.x, e.y, e.r * 0.55, '#ffffff', 0.5);
        if (e.name) { floatNum(pos.x, pos.y, '💥 ' + e.name, e.el, 1.1, true, true); }
        sfx('thunder');
      } else if (e.t === 'zone') {
        if (e.kind === 'field' || e.kind === 'seed' || e.kind === 'kitzone' || e.kind === 'vortex' || e.kind === 'feast' || e.kind === 'rain') { ring(e.x, e.y, e.r, EL[e.el].color, e.kind === 'seed' ? 0.7 : 0.4); }
        else if (e.kind === 'shell') { ring(e.x, e.y, e.r, EL[e.el].color, 0.55); if (W3()) { W3().shake(0.15); } }
        else { ring(e.x, e.y, 0.9, EL[e.el].color, 0.3); if (e.tx !== undefined) { ring(e.tx, e.ty, e.r, EL[e.el].color, 0.3); } }   // echo 등 tx 없는 구역은 발밑 고리만(안 그러면 undefined 좌표로 예외)
      } else if (e.t === 'dodge') { if (W3()) { W3().playAnim('me', 'dodge', 300); } }
      else if (e.t === 'tell') { if (W3()) { W3().playAnim('fc' + e.uid, 'attack', 700); } }
      else if (e.t === 'strike') { if (e.r) { ring(e.x, e.y, e.r, '#ff4d4d', 0.3); } }
      else if (e.t === 'siege') { floatNum(e.x, e.y + 1.5, '-' + e.dmg, null, 0.9, false); c.emit('field:siege', e); }   // ⑲-16 제단이 맞았다(story.js)
      else if (e.t === 'hurt' && !e.dmg) { floatNum(pos.x, pos.y, '🪨 막음', 'rock', 1, true, true); }
      else if (e.t === 'hurt') {
        floatNum(pos.x, pos.y, '-' + e.dmg, e.el, 1, false, true);
        if (W3()) { W3().playAnim('me', 'hit', 260); W3().shake(0.25); }
      } else if (e.t === 'evade') { floatNum(pos.x, pos.y, '회피!', null, 1.1, true, true); }
      else if (e.t === 'swap') {
        var sm = S.party[e.idx];
        if (e.forced) { toast('💫 ' + sm.name + ' 교대 — 앞사람이 쓰러졌다'); }
        ring(pos.x, pos.y, 1.6, EL[sm.el].color, 0.35);
      } else if (e.t === 'down') {
        var dm = S.party[e.idx];
        c.log('💫 ' + dm.name + ' 쓰러짐 (들판 전투)', 'battle');
      } else if (e.t === 'wipe') {
        var inDm = !!(global.DG.domain && global.DG.domain.active());      // ⑲-9 숨은 터 실패는 흘림 없음
        var D = global.DG.drop, lost = !inDm && D && D.lose ? D.lose() : null;
        c.emit('field:wipe', {});
        toast('🏳️ 모두 쓰러져 물러났다' + (lost ? ' — 금 ' + lost.gold + ' 을 흘렸다(되찾을 수 있다)' : ''));
        c.log('🏳️ 들판 전투 전멸 — 30% 로 일어났다', 'battle');
      } else if (e.t === 'yield') {
        floatNum(e.x, e.y, '🏳️ 굴복!', null, 1.6, true);
        ring(e.x, e.y, 3, '#f5b445', 0.7);
        if (W3()) { W3().shake(0.4); W3().hold(160); }
        sfx('reward');
      } else if (e.t === 'duelEnd') {
        var ENC = global.DG.encounter;
        if (ENC && ENC.duelResult) { ENC.duelResult(e.result, e.spawnUid, e.heroId); }
      } else if (e.t === 'kill' && (String(e.camp).indexOf('dm:') === 0 || String(e.camp).indexOf('sq:') === 0)) {
        /* ⑲-9 숨은 터 적 — 전리품·경험·무리 기록 없음(domain.js 가 파도·터 기운을 본다) */
        if (global.DG.daily) { global.DG.daily.progress('hunt'); }
        c.emit('field:kill', e);
      } else if (e.t === 'kill') {
        var gold = killGold(e.tier), exp = Math.round(6 * e.tier * FOES[e.kind].exp);
        c.save.player.gold = (c.save.player.gold || 0) + gold;
        if (c.gainExp) { c.gainExp(Math.max(1, Math.round(exp / 2))); }
        for (var j = 0; j < S.party.length; j++) {
          if (S.party[j].id !== '_me' && !S.party[j].down && H && H.gainExp) { H.gainExp(S.party[j].id, exp); }
        }
        if (e.elite || e.boss) { c.save.dust = (c.save.dust || 0) + (e.boss ? 6 : 2); }
        if (e.shield && global.DG.talent) {                       // ⑲-4 방패 두른 원소 괴물 — 무예 쪽지
          var tmTxt = global.DG.talent.onElite();
          if (global.DG.weapon) { global.DG.weapon.onElite(); }                  // ⑲-5 강화석 1
          if (global.DG.artifact) { tmTxt += ' · ' + global.DG.artifact.onElite(); }   // ⑲-5 보패 ★4
          if (tmTxt) { floatNum(e.x, e.y + 1.2, tmTxt, null, 0.9, false); }
        }
        if (global.DG.cooking) { var mt6 = global.DG.cooking.onKill(e.kind); if (mt6) { floatNum(e.x, e.y + 2.2, mt6, null, 0.85, false); } }   // ⑲-6 짐승 고기
        fieldSave().kills = (fieldSave().kills || 0) + 1;
        if (global.DG.daily) { global.DG.daily.progress('hunt'); }    // ⑲-8 일일 의뢰
        c.emit('field:kill', e);                                       // ⑲-25 업적(원소 괴물·큰 적) — 숨은 터 onKill 은 제 캠프만 본다
        floatNum(e.x, e.y, '+' + gold + '금', null, 0.9, false);
      } else if (e.t === 'clear' && (e.kind === 'domain' || e.kind === 'story')) {
        c.emit('field:clear', e);                                      // ⑲-9 숨은 터 파도 — 보상은 보상 나무에서
      } else if (e.t === 'clear' && e.kind === 'guard') {
        var gs = fieldSave(), rk = e.camp.slice(2), again = !!gs.guards[rk];
        gs.guards[rk] = Date.now();
        delete gs.guardPaid[rk];                                        // ⑲-10 보상 꽃이 다시 핀다(fieldboss.js)
        gs.clears = (gs.clears || 0) + 1;
        /* ⑲-10 다시 선 수호자는 토벌 금·단사·경험이 없다 — 보상은 꽃에서(원기 30) */
        var gl = again ? { gold: 0, dust: 0 } : clearLoot('guard', e.tier), gg = gl.gold, gd = gl.dust;
        c.save.player.gold = (c.save.player.gold || 0) + gg;
        c.save.dust = (c.save.dust || 0) + gd;
        if (c.gainExp && !again) { c.gainExp(30 * e.tier); }
        var BMg = global.DG.biome, pr = rk.split('_'), rc = BMg && BMg.cellAt ? BMg.cellAt(+pr[0], +pr[1]) : null;
        toast('🛡️ ' + (rc ? rc.name + ' ' : '') + '수호자 토벌!' + (again ? '' : ' 금 +' + gg + ' · 단사 +' + gd) + ' — 🌸 보상 꽃이 피었다');
        c.log('🛡️ 지역 수호자 토벌' + (rc ? ' — ' + rc.name : '') + ' (등급 ' + e.tier + ') — 금 +' + gg, 'battle');
        sfx('reward');
        c.emit('field:guard', { region: rk, tier: e.tier });
        c.persist();
      } else if (e.t === 'clear') {
        var fs = fieldSave();
        fs.camps[e.camp] = Date.now();
        fs.clears = (fs.clears || 0) + 1;
        var cl = clearLoot(e.kind, e.tier), bonus = cl.gold, cd = cl.dust;
        c.save.player.gold = (c.save.player.gold || 0) + bonus;
        c.save.dust = (c.save.dust || 0) + cd;
        var label = e.kind === 'boss' ? '우두머리' : (e.kind === 'elite' ? '정예 무리' : '무리');
        toast('⚔️ ' + label + ' 토벌! 금 +' + bonus + ' · 단사 +' + cd);
        c.log('⚔️ 들판 ' + label + ' 토벌 (등급 ' + e.tier + ') — 금 +' + bonus, 'battle');
        sfx('reward');
        c.emit('field:clear', e);
        c.persist();
      }
    }
  }

  /** 입력 한 번 — 버튼·키·자동이 다 이 길로 온다 */
  function act(kind, arg) {
    if (!S || blocked()) { return { ok: false }; }
    var pos = core().save.player.pos, r;
    if (kind === 'attack') {
      /* ⑲-2 활공 중(발밑 2.5m 넘게)이면 기본 공격 대신 내리꽂는다 — 착지는 landform 이 plungeLand 로 알린다 */
      var LF = global.DG.landform;
      if (LF && LF.startPlunge && LF.startPlunge()) { return { ok: true, plunge: true }; }
      if (S.aim) { aimHold(S); handle(drain(S), pos); return { ok: true, aim: true }; }   // ⑲-22 조준 중엔 누르는 동안 충전
      r = attack(S, pos.x, pos.y);
    } else if (kind === 'heavy') {
      /* ⑲-22 활 인물은 강공격 대신 조준·충전(떼면 쏘고 나온다) */
      if (S.aim) { r = { ok: true, aim: true }; }                     // 조준 중 길게 누름 = 충전(강공격 아님)
      else if (aimOk() && aimStart(S, pos.x, pos.y).ok) { S.aim.auto = true; aimHold(S); r = { ok: true, aim: true }; }
      else { r = heavy(S, pos.x, pos.y); }
    } else if (kind === 'aim') {
      r = S.aim ? { ok: aimEnd(S), off: true } : (aimOk() ? aimStart(S, pos.x, pos.y) : { ok: false });
    }
    else if (kind === 'skill') { r = skill(S, pos.x, pos.y); }
    else if (kind === 'burst') { r = burst(S, pos.x, pos.y); }
    else if (kind === 'dodge') {
      aimEnd(S);                                                    // ⑲-22 대시하면 조준이 풀린다
      var W = global.DG.world, mv = W && W.motion ? W.motion : null;
      var moving = mv && mv.speed > 1.5;
      r = dodge(S, moving ? mv.vx : 0, moving ? mv.vy : 0, pos.x, pos.y);
    } else if (kind === 'swap') { r = swap(S, arg); }
    handle(drain(S), pos);
    return r || { ok: false };
  }

