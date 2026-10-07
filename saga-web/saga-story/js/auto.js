/**
 * 자동 사냥 — 대신 뛰고 베어 준다
 * ---------------------------------------------------------------
 * 다른 게임들과 같은 원칙: **규칙을 새로 만들지 않는다.**
 * side.js 의 공개 함수(setInput · jump · castSkill · drink · enter · leave)만 부른다.
 *
 * 고르는 순서
 *   1) 체력이 낮으면 탕약 (없으면 나온다)
 *   2) 가장 가까운 적으로 달리고, 사거리에 들면 평타·스킬
 *   3) 적이 높이 있으면 점프

 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var FLAGS = [
    { key: 'hunt', name: '사냥', emoji: '⚔️', desc: '가까운 적을 쫓아가 벤다' },
    { key: 'potion', name: '탕약', emoji: '🧪', desc: '체력이 35% 밑이면 마신다' },
    { key: 'retry', name: '다시 들어가기', emoji: '🔁', desc: '나오거나 쓰러지면 다시 들어간다' },
  ];

  var DEFAULTS = { on: false, hunt: true, potion: true, retry: true };

  var acc = { retry: 0, jump: 0, climb: 0 };
  var doing = '';
  var climbTarget = null;       // 줄을 타는 동안 붙들어 두는 목표 (아래 설명)

  function st() {
    var s = core.save, k;
    if (!s.auto) { s.auto = {}; }
    for (k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) && s.auto[k] === undefined) {
        s.auto[k] = DEFAULTS[k];
      }
    }
    return s.auto;
  }

  function on(flag) { return !!st()[flag]; }
  function active() { return !!st().on; }

  function flagByKey(k) {
    for (var i = 0; i < FLAGS.length; i++) { if (FLAGS[i].key === k) { return FLAGS[i]; } }
    return null;
  }

  function setOn(v) {
    var s = st();
    v = !!v;
    if (s.on === v) { return v; }
    s.on = v;
    doing = v ? '사냥터로 갈 준비' : '';
    if (!v) { stopMoving(); }
    core.log(v ? '🤖 자동 사냥을 켰다' : '🤖 자동 사냥을 껐다', 'info');
    core.emit('toast', v ? '🤖 자동 사냥 시작' : '⏸️ 자동 사냥 정지');
    core.emit('changed');
    core.persist();
    return v;
  }

  function toggle() { return setOn(!st().on); }

  function toggleFlag(key) {
    if (!flagByKey(key)) { return false; }
    var s = st();
    s[key] = !s[key];
    core.emit('changed');
    core.persist();
    return !!s[key];
  }

  function stopMoving() {
    var S = global.DG.side;
    S.setInput('left', false);
    S.setInput('right', false);
    /* ↑ 를 켠 채로 두면 떨어지다 아무 줄에나 매달린다 */
    S.setInput('up', false);
    S.setInput('down', false);
  }

  /* ── 사냥 ─────────────────────────────────────────────── */

  /** 가장 가까운 적 (같은 높이에 있는 쪽을 먼저 본다 — 발판이 다르면 못 때린다) */
  function nearestEnemy(run) {
    var p = run.player, best = null, bs = 1e9;
    for (var i = 0; i < run.enemies.length; i++) {
      var e = run.enemies[i];
      var dx = Math.abs((e.x + e.w / 2) - (p.x + global.DG.side.P_W / 2));
      var dy = Math.abs((e.y + e.h) - (p.y + global.DG.side.P_H));
      var score = dx + dy * 2.2;                 // 높이 차이를 더 싫어한다
      if (score < bs) { bs = score; best = e; }
    }
    return best;
  }

  /**
   * 줄을 써서 적의 높이로 간다 — 점프로만 오르던 시절에는 한 층 위의 적을
   * 못 따라가 아래에서 오락가락했다(사가마을에서 도구 없는 사물을 목표로 잡던 것과 같은 결).
   * 붙을 줄이 없으면 false 를 돌려주고, 부르는 쪽이 점프로 되돌아간다.
   */
  function tickClimb(S, run, e) {
    var p = run.player;
    var foot = p.y + S.P_H, cx = p.x + S.P_W / 2;
    var eFoot = e.y + e.h;
    var dy = eFoot - foot;                      // 음수면 적이 위에 있다

    if (p.climb) {
      /* 여유를 크게 잡으면 발판 코앞에서 손을 떼 버린다 — 줄은 **끝까지** 탄다.
         꼭대기·아래 끝에 닿으면 side.js 가 알아서 발판(또는 바닥)에 세워 준다. */
      if (dy < -1) { S.setInput('down', false); S.setInput('up', true); }
      else if (dy > 1) { S.setInput('up', false); S.setInput('down', true); }
      else {
        /* 높이가 맞았다 — 손을 떼고 적 쪽으로 뛴다 */
        S.setInput('up', false); S.setInput('down', false);
        S.letGo((e.x + e.w / 2) > cx ? 1 : -1);
      }
      return true;
    }

    /* 쓸모 있는 줄은 **적이 선 자리로 이어지는 줄**뿐이다.
       적의 높이를 '지나가기만' 하는 줄을 고르면 중간에 내릴 데가 없어,
       꼭대기 발판까지 올라갔다가 도로 내려오기를 되풀이한다. 그래서
       올라갈 때는 줄의 **꼭대기**가, 내려갈 때는 줄의 **아래 끝**이
       적의 발치여야 한다. (적은 발판에 12쯤 파묻혀 서므로 여유를 18로 둔다) */
    var ropes = run.stage.ropes || [], best = null, bd = 1e9;
    var END = 18;
    for (var i = 0; i < ropes.length; i++) {
      var r = ropes[i];
      var lands = dy < 0 ? Math.abs(r[1] - eFoot) <= END : Math.abs(r[2] - eFoot) <= END;
      if (!lands) { continue; }
      if (foot < r[1] - END || foot > r[2] + END) { continue; }   // 내 발도 그 줄에 걸쳐야
      var d = Math.abs(cx - r[0]);
      if (d < bd) { bd = d; best = r; }
    }
    if (!best || bd > 420) { return false; }

    if (bd > 12) {
      S.setInput('right', best[0] > cx);
      S.setInput('left', best[0] < cx);
      S.setInput('up', false);
      /* 한 틱에 달리는 거리가 줄에 붙는 여유보다 넓다 — 걷는 동안 매 틱 잡아 본다.
         그러지 않으면 줄 앞을 오갈 뿐 영영 못 붙는다. */
      if (bd < 40) { S.grabRope(); }
      return true;
    }
    S.setInput('left', false); S.setInput('right', false);
    S.grabRope();                               // 줄 앞에 섰다 — 잡는다 (문은 안 건드린다)
    return true;
  }

  function tickHunt(dt) {
    var S = global.DG.side;
    var run = S.raw();
    if (!run) { return; }
    var st2 = S.status();
    var p = run.player;

    /* 탕약 · 후퇴 */
    if (on('potion') && st2.hp / st2.hpMax < 0.35) {
      if (st2.party && global.DG.party.autoSwap()) { doing = '🔄 동료로 교대'; return; }
      if (S.drink()) { doing = '🧪 탕약을 마셨다'; return; }
      if (st2.hp / st2.hpMax < 0.18) {
        doing = '🚪 체력이 낮아 나온다';
        stopMoving();
        S.leave();
        return;
      }
    }

    if (!on('hunt')) { stopMoving(); doing = '⏸️ 사냥 꺼짐'; return; }

    /* **줄을 타는 동안에는 목표를 바꾸지 않는다.** 가장 가까운 적은 높이 차를 싫어하는
       점수라, 오르내리는 사이에 다른 적이 1등이 된다. 목표가 흔들리면 위아래 부호도
       흔들려 자동이 줄에서 오르락내리락만 하다 한 마리도 못 잡는다. */
    var e;
    if (p.climb && climbTarget && run.enemies.indexOf(climbTarget) >= 0) {
      e = climbTarget;
      acc.climb += dt;
      if (acc.climb > 6) { S.letGo(0); climbTarget = null; acc.climb = 0; }  // 오래 붙어 있지 않는다
    } else {
      e = nearestEnemy(run);
      if (!p.climb) { climbTarget = null; acc.climb = 0; }
    }
    if (!e) { stopMoving(); doing = '👀 적을 찾는 중'; return; }

    var ex = e.x + e.w / 2, px = p.x + S.P_W / 2;
    var dx = ex - px;
    var dy = (e.y + e.h) - (p.y + S.P_H);

    /* 한 층 넘게 차이가 나면 줄을 먼저 본다 (없으면 아래 점프로 되돌아간다).
       **이미 매달렸으면 높이 차와 무관하게 줄 쪽을 계속 본다** — 안 그러면
       올라가다 말고 손을 떼 바닥에서 오르내리기를 되풀이한다. */
    if (p.climb || Math.abs(dy) > 70) {
      if (tickClimb(S, run, e)) {
        if (p.climb) { climbTarget = e; }
        doing = '🪜 줄을 타고 ' + (dy < 0 ? '올라간다' : '내려간다');
        return;
      }
    }
    S.setInput('up', false); S.setInput('down', false);

    /* 붙는다 — 사거리 안이면 멈춰서 벤다 */
    if (Math.abs(dx) > S.REACH * 0.6) {
      S.setInput('right', dx > 0);
      S.setInput('left', dx < 0);
    } else {
      stopMoving();
    }
    if (dx > 0 && p.facing < 0) { S.setInput('right', true); }
    if (dx < 0 && p.facing > 0) { S.setInput('left', true); }

    /* 적이 위에 있으면 뛴다 */
    acc.jump += dt;
    if (dy < -30 && p.onGround && acc.jump > 0.5) { acc.jump = 0; S.jump(); }

    /* 회피=대시(§5-5) 자동 사용 — 적이 때리려는 순간(atkAnim) 붙어 있으면 무적 창을 쓴다 */
    if (e.atkAnim > 0 && Math.abs(dx) < S.REACH * 1.4 && st2.dodge.ready) { S.dodge(); }

    /* 때린다 — **띠에 놓인 것을 종류대로** 쓴다. skipIdx 는 안 건드린다
       (완전 자동일 땐 -1 이라 다 쓰고, 수동 조작 중엔 "공격" 자리라 사람이 쥔다) */
    var near = Math.abs(dx) < S.REACH && Math.abs(dy) < 50;
    var mid = Math.abs(dx) < 420 && Math.abs(dy) < 40;
    castSkillsByRule(st2, near, mid, dx, -1);
    doing = '⚔️ ' + st2.stage.name + ' · ' + st2.kills + '마리 · 남은 적 ' + run.enemies.length;
  }

  /**
   * 스킬만 자동으로 — 이동·공격은 사람 손(터치패드·"공격" 단추)이 그대로 쥐고,
   * 쿨 찬 나머지 무예(횡소·기탄·기합 같은)만 알아서 나간다.
   * "스킬은 자동으로 써주면 공격 버튼만 보여도 되지 않나?"(사용자, 2026-09-02) —
   * tickHunt 와 같은 조건식을 쓰되, **"공격" 자리(status().attackIdx)는 건너뛴다.**
   * 전체 자동 사냥(🤖)이 켜져 있으면 tickHunt 가 이미 다 쓰므로 이쪽은 부르지 않는다.
   */
  function tickSkillsOnly(dt) {
    var S = global.DG.side;
    var run = S.raw();
    if (!run) { return; }
    var st2 = S.status();
    var p = run.player, e = nearestEnemy(run);
    if (!e) { return; }
    var dx = (e.x + e.w / 2) - (p.x + S.P_W / 2);
    var dy = (e.y + e.h) - (p.y + S.P_H);
    var near = Math.abs(dx) < S.REACH && Math.abs(dy) < 50;
    var mid = Math.abs(dx) < 420 && Math.abs(dy) < 40;
    castSkillsByRule(st2, near, mid, dx, st2.attackIdx);
  }

  /** 띠의 무예를 종류대로 조건 맞춰 쓴다. skipIdx 번째는 건너뛴다(-1 이면 다 쓴다) */
  function castSkillsByRule(st2, near, mid, dx, skipIdx) {
    var S = global.DG.side;
    var bar = S.barSkills ? S.barSkills() : [];
    for (var k = 0; k < bar.length; k++) {
      if (k === skipIdx) { continue; }
      var eff = bar[k].effect;
      if (eff === 'buff') { S.castSkill(k); }
      else if (eff === 'heal') {
        if (st2.hp / st2.hpMax < 0.6) { S.castSkill(k); }
      } else if (eff === 'bolt' || eff === 'arrow' || eff === 'volley' || eff === 'rain') {
        if (mid) { S.castSkill(k); }
      } else if (eff === 'dash') {
        if (!near && mid && Math.abs(dx) > S.REACH) { S.castSkill(k); }
      } else if (near) {
        S.castSkill(k);
      }
    }
  }

  /** 쉬는 중 — 갈 수 있는 가장 깊은 사냥터로 들어간다 */
  function tickRest(dt) {
    if (!on('retry')) { doing = '🏕️ 쉬는 중 (다시 들어가기 꺼짐)'; return; }
    acc.retry += dt;
    if (acc.retry < 3) { doing = '🏕️ 다시 들어갈 준비'; return; }
    acc.retry = 0;
    var S = global.DG.side;
    if (!core.save.party.length) { doing = '⚠️ 앞에 세운 인물이 없습니다'; return; }
    var list = S.stages(), pick = null;
    for (var i = 0; i < list.length; i++) { if (list[i].open) { pick = list[i]; } }
    if (pick) { S.enter(pick.ref.key); }
  }

  function update(dt) {
    if (!active()) {
      /* 완전 자동(🤖)은 꺼져 있어도 — 사냥 중이면 스킬만은 계속 알아서 나간다 */
      if (global.DG.side.active()) { tickSkillsOnly(dt); }
      return;
    }
    if (global.DG.side.active()) { tickHunt(dt); }
    else { tickRest(dt); }
  }

  function status() {
    return { on: active(), doing: doing, flags: st() };
  }

  global.DG = global.DG || {};
  global.DG.auto = {
    FLAGS: FLAGS, flagByKey: flagByKey,
    state: st, active: active, on: on,
    setOn: setOn, toggle: toggle, toggleFlag: toggleFlag,
    update: update, status: status,
    /** 자가진단용 */
    _tickHunt: tickHunt, _tickRest: tickRest, _tickSkillsOnly: tickSkillsOnly,
    _nearestEnemy: nearestEnemy, _tickClimb: tickClimb
  };
})(window);
