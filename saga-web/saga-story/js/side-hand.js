/**
 * 4종횡 조작 다듬기 + 사냥터 숨은 자리·옛 조각 (W-0176)
 * ---------------------------------------------------------------
 * 수신함 10-11 "조작이 답답함"·"할 게 없음" — 공격 키가 무예를 배울수록 바뀌고(1~8 중 쿨이 가장 짧은 자리),
 * 회피는 Shift 를 떼야 나가고, 점프는 늘 끝까지 뛰었다. 사냥터 아홉은 왼→오 한 줄에 적·채집뿐이었다.
 * `side.js`·`ui.js` 는 상한을 넘은 큰 파일이라 판단은 여기 두고 그쪽은 한 줄씩만 부른다.
 *
 *   공격 Z·J        늘 "공격" 자리(쿨 가장 짧은 무예)를 친다 — 누르고 있으면 쿨이 끝날 때마다 다시(OS 자동반복에 안 기댐)
 *   회피 Shift      누르는 순간 회피. 길게 누르는 고유 조작은 C 로(game.js)
 *   짧은 점프       Space 를 오르는 중에 떼면 위 속도 × side.jumpCut(0.45)
 *   무예 자동       🌀 단추 — 끄면 auto.js 가 1~8 무예를 안 쏜다(손으로). 새 세이브 PC=끔·터치=켬, 옛 세이브는 켬 그대로
 *   숨은 자리       사냥터마다 밧줄 꼭대기 발판 위 끝 발판(data-side `secret`)에 상자 — 금 · 한 번만
 *   옛 조각         사냥터마다 셋(`relics`) — 닿으면 줍는다. 아홉×셋 = 27 을 다 모으면 칭호 「옛 조각을 맞춘 이」
 *
 * 세이브 — `save.relics[stage] = 비트`(0~2 조각, 3 숨은 자리) · `save.settings.autoSkill`. 없으면 기본값.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function S() { return global.DG.side; }
  function JUMP_CUT() { return core().tuned('side.jumpCut', 0.45); }
  var RELIC_R = 24, SECRET_R = 34, SECRET_BIT = 8, TITLE = '옛 조각을 맞춘 이';

  /* ── 공격 고정 키 ─────────────────────────────────────── */

  /** "공격" 자리 — side.js attackIndexOf 를 그대로(HUD 공격 단추와 같은 자리, 셈을 두 벌 두지 않는다 — R-5) */
  function attackIdx() { var s = S(); return s && s.attackIndexOf && s.barSkills ? s.attackIndexOf(s.barSkills()) : -1; }
  var held = { attack: false };
  function attackDown() { held.attack = true; return attack(); }
  function attackUp() { held.attack = false; }
  function attack() { var i = attackIdx(); return i >= 0 && S().active() ? S().castSkill(i) : false; }

  /* ── 짧은 점프 ────────────────────────────────────────── */

  /** 점프 키를 뗐다 — 오르는 중이면 위 속도를 깎는다. 깎았으면 true */
  function jumpRelease() {
    var run = S() && S().raw();
    if (!run || !run.player) { return false; }
    var p = run.player;
    if (p.onGround || !(p.vy < 0)) { return false; }
    p.vy *= JUMP_CUT();
    return true;
  }

  /* ── 무예 자동 손잡이 ─────────────────────────────────── */

  function settings() { var s = core().save; return s.settings || (s.settings = {}); }
  /** 처음 한 번 정한다 — 옛 세이브(사냥 기록이 있으면)는 켬 그대로, 새 세이브는 PC 끔·터치 켬 */
  function autoSkillOn() {
    var st = settings();
    if (typeof st.autoSkill !== 'boolean') {
      var sv = core().save, old = !!(sv.player && (sv.player.level > 1 || sv.player.exp > 0));
      st.autoSkill = old || !!(core().touchOnly && core().touchOnly());
    }
    return st.autoSkill;
  }
  function setAutoSkill(v) { settings().autoSkill = !!v; core().persist(); paintBtn(); return !!v; }
  function paintBtn() {
    var b = global.document && document.getElementById('btn-autoskill');
    if (!b) { return; }
    var on = autoSkillOn();
    b.classList.toggle('on', on);
    b.title = '무예 자동 — ' + (on ? '켜짐: 1~8 무예를 알아서 씁니다' : '꺼짐: 1~8 은 손으로') + ' (공격은 늘 Z)';
  }

  /* ── 숨은 자리·옛 조각 ────────────────────────────────── */

  function bits(key) { var r = core().save.relics; return (r && r[key]) || 0; }
  function setBit(key, b) { var s = core().save; s.relics = s.relics || {}; s.relics[key] = (s.relics[key] || 0) | b; }
  function relicCount() {
    var r = core().save.relics || {}, n = 0, k, i;
    for (k in r) { if (Object.prototype.hasOwnProperty.call(r, k)) { for (i = 0; i < 3; i++) { if (r[k] & (1 << i)) { n++; } } } }
    return n;
  }
  function relicTotal() {
    var SD = global.DG.sideData, n = 0;
    (SD && SD.STAGES || []).forEach(function (s) { if (s.relics) { n += s.relics.length; } });
    return n;
  }
  /** 이 사냥터 — { relics: 주운 수, of: 셋, secret: 찾았나 } 또는 null(숨은 것 없는 곳) */
  function stageInfo(stg) {
    if (!stg || !stg.relics) { return null; }
    var b = bits(stg.key), n = 0;
    for (var i = 0; i < stg.relics.length; i++) { if (b & (1 << i)) { n++; } }
    return { relics: n, of: stg.relics.length, secret: !!(b & SECRET_BIT) };
  }
  /** 전체 지도(M) 사냥터 칸에 붙일 글 */
  function mapTag(stg) {
    var f = stageInfo(stg);
    return f ? ' · 🧩 ' + f.relics + '/' + f.of + ' · 숨은 자리 ' + (f.secret ? '○' : '–') : '';
  }

  /** 매 틱(게임 루프) — 닿은 조각·숨은 상자를 줍는다. 주운 것 목록(진단) */
  function check() {
    var run = S() && S().raw(), got = [];
    if (!run || !run.player || !run.stage || !run.stage.relics) { return got; }
    var stg = run.stage, p = run.player, cx = p.x + S().P_W / 2, foot = p.y + S().P_H, i;
    for (i = 0; i < stg.relics.length; i++) {
      if (bits(stg.key) & (1 << i)) { continue; }
      if (Math.abs(stg.relics[i] - cx) < RELIC_R && foot > stg.floor - 70) {
        setBit(stg.key, 1 << i);
        got.push('relic' + i);
        var n = relicCount(), all = relicTotal();
        core().emit('toast', '🧩 옛 조각을 주웠다 · ' + n + '/' + all);
        core().log('🧩 ' + stg.name + ' — 옛 조각 (' + n + '/' + all + ')', 'good');
        if (n >= all) { grantTitle(); }
      }
    }
    var sc = stg.secret;
    if (sc && !(bits(stg.key) & SECRET_BIT) && Math.abs(sc.x - cx) < SECRET_R && Math.abs(foot - sc.y) < 8 && p.onGround) {
      setBit(stg.key, SECRET_BIT);
      got.push('secret');
      var g = (sc.reward && sc.reward.gold) || 0;
      core().save.player.gold += g;          // 한 번뿐인 보상이라 바로 지갑에(run.gold 는 쓰러지면 반이 깎인다 — R-5)
      core().emit('changed');
      core().emit('toast', '🎁 숨은 자리를 찾았다! 🪙+' + g);
      core().log('🎁 ' + stg.name + ' — 숨은 자리 · 금 +' + g, 'good');
    }
    if (got.length) { core().persist(); }
    return got;
  }
  function grantTitle() {
    var s = core().save;
    s.scenario = s.scenario || {};
    if (!Array.isArray(s.scenario.titles)) { s.scenario.titles = []; }
    if (s.scenario.titles.indexOf(TITLE) >= 0) { return false; }
    s.scenario.titles.push(TITLE);
    core().log('🏷️ 칭호 「' + TITLE + '」 — 옛 조각 ' + relicTotal() + '개를 다 모았다', 'good');
    core().emit('toast', '🏷️ 칭호 「' + TITLE + '」');
    return true;
  }

  /** 화면(side-view 세계 층, 2D·3D 공통 겹쳐 그리기) — 안 주운 조각·안 연 숨은 상자 */
  function draw(ctx, camX) {
    var run = S() && S().raw();
    if (!ctx || !run || !run.stage || !run.stage.relics) { return; }
    var stg = run.stage, b = bits(stg.key), t = Date.now() / 400, i;
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '22px "Segoe UI Emoji", system-ui';
    for (i = 0; i < stg.relics.length; i++) {
      if (b & (1 << i)) { continue; }
      var x = stg.relics[i] - camX, y = stg.floor - 18 + Math.sin(t + i) * 3;
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(x, y - 7, 15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillText('🧩', x, y);
    }
    if (stg.secret && !(b & SECRET_BIT)) {
      ctx.font = '26px "Segoe UI Emoji", system-ui';
      ctx.fillText('🎁', stg.secret.x - camX, stg.secret.y - 4);
    }
    ctx.restore();
  }

  /** 재미표준 E 측정 — 사냥터 폭을 800 구간으로 나눠 적 아닌 상호작용(채집·조각·숨은 자리·문)이 없는 구간 */
  function coverage(stg) {
    var xs = [], cells = 0, empty = 0, a;
    (stg.gathers || []).forEach(function (g) { xs.push(g[0]); });
    (stg.portals || []).forEach(function (p) { xs.push(p[0]); });
    (stg.relics || []).forEach(function (x) { xs.push(x); });
    if (stg.secret) { xs.push(stg.secret.x); }
    for (a = 0; a < stg.width; a += 800) {
      var b2 = Math.min(stg.width, a + 800);
      cells++;
      if (!xs.some(function (x) { return x >= a && x < b2; })) { empty++; }
    }
    return { cells: cells, empty: empty };
  }

  /* ── 묶기·틱 ──────────────────────────────────────────── */

  var bound = false;
  function bind() {
    if (bound || !global.document) { return; }
    bound = true;
    var b = document.getElementById('btn-autoskill');
    if (b) { b.addEventListener('click', function () { setAutoSkill(!autoSkillOn()); core().emit('toast', autoSkillOn() ? '🌀 무예 자동 — 켜짐' : '🌀 무예 자동 — 꺼짐 (1~8 은 손으로)'); }); }
    paintBtn();
  }
  function tick() {
    if (!core() || !core().save || !S()) { return; }
    bind();
    if (!S().active()) { held.attack = false; return; }
    if (held.attack) { attack(); }        // 쿨 중이면 castSkill 이 그냥 false
    check();
  }

  global.DG = global.DG || {};
  global.DG.sideHand = {
    TITLE: TITLE, SECRET_BIT: SECRET_BIT, JUMP_CUT: JUMP_CUT,
    attackIdx: attackIdx, attackDown: attackDown, attackUp: attackUp, held: function () { return held.attack; },
    jumpRelease: jumpRelease, autoSkillOn: autoSkillOn, setAutoSkill: setAutoSkill,
    stageInfo: stageInfo, mapTag: mapTag, check: check, relicCount: relicCount, relicTotal: relicTotal, grantTitle: grantTitle,
    draw: draw, coverage: coverage, tick: tick
  };
})(window);
