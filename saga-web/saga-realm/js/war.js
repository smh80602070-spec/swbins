/**
 * 삼국지 — 전투(戰): 출진 · 일기토 · 야전 · 공성
 * ---------------------------------------------------------------
 * 판정 층과 화면 층을 **가른다**. 이 파일은 수(數)만 굴리고 그림은 한 점도 그리지 않는다.
 * 그래야 헤드리스 자가진단이 화면 없이 그대로 붙는다(사가만리 `duel.js` 에서 배운 것이다).
 *
 * 한 달 안에 못 떨어뜨리면 군을 물리지 않고 **성 밖에 진(陣)을 친다**.
 * 그 진영은 다음 달에도 그 자리에 있고, `resolveAll()` 이 달마다 한 번씩 더 친다 —
 * 이것이 **여러 달에 걸치는 원정**이다.
 *
 *   야전   성 밖에서 붙는다. 수비가 병력에 자신이 있을 때만 나온다
 *   공성   성벽이 수비 쪽 힘에 곱해진다. 깎을수록 그 곱이 준다
 *   수전   **물길로 가면 배끼리 붙는다** — 성벽이 소용없는 대신 배가 든다.
 *          지력이 높으면 화공(火攻)이 터진다. 적벽이 이 줄이다
 *   일기토 붙기 전에 딱 한 번. 이긴 쪽은 그 싸움 내내 기세를 탄다
 *   진영   치중(輜重)이 바닥나거나 사기가 꺾이면 **스스로 물러난다**.
 *          그래서 긴 원정은 보급(`supply`)이 있어야 이어진다
 *
 * 병력을 잃는 쪽은 **상대의 힘**에 비례해 잃는다. 제 병력에 비례하게 두면
 * 큰 군대가 알아서 녹아 수가 커질수록 불리해진다(한 번 그렇게 짜서 겪었다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CD = global.DG.cityData;
  var FD = global.DG.forceData;
  var ID = global.DG.item;

  var SHIP_CREW = 100;          // 배 한 척에 타는 병사

  var ROUNDS = 10;              // 한 달에 붙는 횟수
  var ROUT = 0.35;              // 처음 병력의 이만큼까지 줄면 물러난다
  var DUEL_GAP = 25;            // 무력 차가 이보다 작아야 일기토가 성립한다

  /* 진영(陣) — 달을 넘겨 이어지는 원정.
     진이 길어질수록 사기가 깎이고, 바닥나면 스스로 물러난다.
     이 두 수가 없으면 포위가 영영 안 끝나 판이 그 자리에서 언다. */
  var CAMP_DECAY = 0.94;        // 한 달 더 진을 치면 사기가 이만큼 남는다
  var CAMP_QUIT = 0.60;         // 사기가 이보다 낮으면 군이 지쳐 물러난다
  var CAMP_MIN = 500;           // 이보다 적게 남으면 군대라 할 수 없다

  /* ── 진영 목록 ────────────────────────────────────────── */

  /** save.rtk.camps — 옛 세이브에는 없다(삼국지 판을 갈아엎기 전 것) */
  function camps() {
    var st = global.DG.rtk.state();
    if (!st.camps) { st.camps = []; }
    return st.camps;
  }

  function campsOf(forceId) {
    var list = camps(), out = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i].force === forceId) { out.push(list[i]); }
    }
    return out;
  }

  function campById(id) {
    var list = camps(), i;
    for (i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }

  /** 그 성을 에워싼 진영 (세력을 주면 그 세력의 것만) */
  function campAt(cityId, forceId) {
    var list = camps(), i;
    for (i = 0; i < list.length; i++) {
      if (list[i].to !== cityId) { continue; }
      if (forceId && list[i].force !== forceId) { continue; }
      return list[i];
    }
    return null;
  }

  /** 이 성이 지금 에워싸여 있는가 — 살림(settleMonth)이 이것을 본다 */
  function besieged(cityId) { return !!campAt(cityId); }

  /** 치중이 몇 달을 버티는가 */
  function monthsLeft(cp) {
    var eat = Math.round(cp.troops / 1000 * global.DG.rtk.FOOD_PER_1000);
    return eat > 0 ? Math.floor(cp.food / eat) : 99;
  }

  /* ── 부대의 힘 ────────────────────────────────────────── */

  /**
   * 진형(陣形, PLAN §16 "붙일 여덟 축" 중 하나, 2026-09-09) — 원작
   * 삼국지의 진형을 가볍게 옮겼다. **고르는 화면을 안 만든다** — 데려가는
   * 장수의 능력치가 문턱을 넘으면 **자동으로** 그 진형이 붙는다(가장 센
   * 진형 하나만, 요건 못 넘으면 무진형). 새 상태·새 UI 없이 `army.officers`
   * (모든 army 객체가 이미 갖고 있다 — march·journey·camp·forecast 전부)만
   * 보고 판정하므로, `armyPower()` **한 곳**만 고치면 화면(로그)과 판정이
   * 저절로 같이 움직인다("계산이 두 곳으로 갈라지면 안 된다" — hero.js
   * 머리말과 같은 원칙, `officer.js` `stats()` 참고).
   */
  var FORMATIONS = [
    { key: 'chukyi',  name: '추행진', emoji: '🔺', reqStat: 'might',   req: 75, mul: 1.15,
      desc: '앞을 송곳처럼 세워 정면을 뚫는다 — 데려가는 장수 중 무력 75 이상이 있어야 선다.' },
    { key: 'hakik',   name: '학익진', emoji: '🦅', reqStat: 'wisdom',  req: 75, mul: 1.10,
      desc: '학이 날개를 펴듯 둘러싸 허를 찌른다 — 데려가는 장수 중 지력 75 이상이 있어야 선다.' },
    { key: 'bangwon', name: '방원진', emoji: '⭕', reqStat: 'command', req: 75, mul: 1.08,
      desc: '둥글게 다져 무너지지 않고 민다 — 데려가는 장수 중 통솔 75 이상이 있어야 선다.' }
  ];

  /**
   * "역사 분기"(README 여덟 축, 2026-09-10) — 실제 삼국지의 이름난 갈림길에서
   * **원래 역사와 다른 결과**가 나올 수 있게 첫 충돌에 flavor 를 얹는다.
   * 새 전투 판정은 없다 — `finishMarch()`가 이미 굴린 `report.won`/`report.routed`
   * 를 그대로 읽어 로그만 가르고, 승자에게 작은 금전 보상 하나만 준다(진형·
   * 장비와 같은 결 — "판정은 한 곳"). 같은 두 세력의 첫 충돌에만 한 번 붙는다
   * (그 뒤로 이 둘이 몇 번을 더 싸워도 다시 안 뜬다 — `save.rtk.history` 로 표시).
   *
   * v1 은 하나뿐이었다 — **관도대전**. 2026-09-20(§5-2) 여섯으로 늘렸다: 적벽·이릉·한중·합비는 같은 표에
   * `at`(싸움이 난 성 목록)만 얹어 같은 두 세력의 다른 갈림길과 안 겹치게 했고, 여섯째는 **관문(landmark)의 첫 충돌**
   * (`gate:true` — 세력 지정 없이 그 관문 성에서 처음 벌어진 싸움, 성마다 한 번)이다.
   */
  var HISTORY_BRANCHES = [
    { id: 'guandu', name: '관도대전', hanja: '官渡大戰', a: 'cao', b: 'shao', gold: 800,
      textA: '역사와 같이 패헌이 고문을 꺾었다 — 관도의 승부가 갈렸다.',
      textB: '역사와 다르게 고문이 패헌을 밀어냈다 — 관도의 승부가 뒤집혔다.' },
    { id: 'chibi', name: '적벽대전', hanja: '赤壁大戰', a: 'quan', b: 'cao', gold: 800,
      at: ['chaisang', 'jiangxia', 'jiangling', 'xiangyang', 'wan', 'xinye', 'changsha'],
      textA: '역사와 같이 벽해가 강 위에서 패헌을 막았다 — 적벽의 불길이 하늘을 물들였다.',
      textB: '역사와 다르게 패헌이 강을 건너 밀어붙였다 — 적벽의 승부가 뒤집혔다.' },
    { id: 'yiling', name: '이릉의 싸움', hanja: '夷陵', a: 'quan', b: 'bei', gold: 600,
      at: ['jiangling', 'yongan', 'jiangzhou', 'jiangxia', 'changsha'],
      textA: '역사와 같이 벽해가 인형의 동진을 불로 꺾었다 — 이릉의 숲이 탔다.',
      textB: '역사와 다르게 인형이 강동의 벽을 뚫었다 — 이릉의 승부가 뒤집혔다.' },
    { id: 'hanzhong', name: '한중 공방', hanja: '漢中', a: 'bei', b: 'cao', gold: 700,
      at: ['hanzhong', 'tianshui', 'wuwei', 'changan'],
      textA: '역사와 같이 인형이 산길을 틀어쥐고 패헌을 물렸다 — 한중이 그의 손에 남았다.',
      textB: '역사와 다르게 패헌이 산길을 뚫고 한중을 눌렀다 — 촉의 문이 열렸다.' },
    { id: 'hefei', name: '합비 수성', hanja: '合肥', a: 'cao', b: 'quan', gold: 600,
      at: ['shouchun', 'xiapi', 'xiaopei', 'jianye', 'kuaiji'],
      textA: '역사와 같이 패헌의 소수 정병이 벽해의 대군을 되받아 쳤다 — 합비는 끝내 열리지 않았다.',
      textB: '역사와 다르게 벽해의 대군이 성을 짓눌렀다 — 합비의 문이 흔들렸다.' },
    /* 여섯째 — 관문의 첫 충돌. 누가 싸우든, 그 관문 성에서 **처음** 벌어진 싸움을 갈라 준다(성마다 한 번). 글줄만 — 금은 탐험·보스 보상이 이미 있어 겹쳐 주지 않는다 */
    { id: 'gate', name: '관문의 첫 충돌', hanja: '關門', gate: true, gold: 0 }
  ];

  /** report 를 보고 역사 분기 표를 훑는다 — finishMarch() 가 부른다 */
  function checkHistoryBranch(report) {
    var R = global.DG.rtk;
    if (!report.won && !report.routed) { return; }   // 진 채로 승부가 안 갈렸으면(포위 지속) 아직이다
    var st = R.state();
    st.history = st.history || {};
    var a = report.force, b = report.defForce;
    for (var i = 0; i < HISTORY_BRANCHES.length; i++) {
      var h = HISTORY_BRANCHES[i];
      if (h.gate) { checkGateBranch(h, report, st); continue; }
      if (st.history[h.id]) { continue; }
      var match = (a === h.a && b === h.b) || (a === h.b && b === h.a);
      if (!match) { continue; }
      if (h.at && h.at.indexOf(report.to) < 0) { continue; }   // 싸움이 난 성이 그 갈림길의 땅이 아니면 다음 표로
      st.history[h.id] = true;
      /* 공격자가 이겼으면(report.won) 공격자 쪽이 이 충돌의 승자다.
         물러났으면(report.routed) 수비자가 막아 낸 것이다. */
      var winnerIsA = report.won ? (a === h.a) : (b === h.a);
      var text = winnerIsA ? h.textA : h.textB;
      var winnerForce = report.won ? a : b;
      var f = R.force(winnerForce);
      if (f) { f.gold += h.gold; }
      report.log.push('📜 ' + h.name + '(' + h.hanja + ') — ' + text + ' (금 ' + core.fmt(h.gold) + ')');
      core.log('📜 ' + h.name + ' — ' + text, 'good');
      core.emit('rtk:history', { id: h.id, winner: winnerForce });
    }
  }

  /** 관문(landmark) 성에서 처음 벌어진 싸움 — 이기면 공격자가 열었고, 못 이겼으면 수비가 버텼다. 글줄만이고 금은 없다(탐험 보상 1000·보스 600 이 이미 그 자리에 붙어 있다) */
  function checkGateBranch(h, report, st) {
    var R = global.DG.rtk, d = report.to ? global.DG.cityData.find(report.to) : null;
    if (!d || !d.landmark) { return; }
    if (!report.won && !report.routed) { return; }
    var key = h.id + ':' + report.to;
    if (st.history[key]) { return; }
    st.history[key] = true;
    var winnerForce = report.won ? report.force : report.defForce;
    var f = winnerForce ? R.force(winnerForce) : null;
    if (f && h.gold) { f.gold += h.gold; }
    var text = report.won ? d.name + ' 의 관문이 처음으로 열렸다.' : d.name + ' 의 관문이 첫 공세를 버텨 냈다.';
    report.log.push('📜 ' + h.name + '(' + h.hanja + ') — ' + text + (f && h.gold ? ' (금 ' + core.fmt(h.gold) + ')' : ''));
    core.log('📜 ' + h.name + ' — ' + text, 'good');
    core.emit('rtk:history', { id: key, winner: winnerForce });
  }

  /**
   * 지형 전술(PLAN §5-6) — 개입형 전투에서 합마다 명령과 함께 **전투당 한 번** 쓴다.
   * 지형(성이 선 땅 `land.key`)마다 하나씩이고, 데려간 장수 중 그 능력치가 문턱 이상인 사람이 있어야 한다.
   *   mount 매복     지력 70+  이번 합 받는 피해 ×0.85
   *   hill  화공     지력 60+  적 병력의 12.6%(수전 화공 18% 의 ×0.7)를 태우고 적 사기 ×0.95
   *   plain 기병 돌격 무력 80+  이번 합 주는 피해 ×1.25, 뒤에 우리 사기 -0.03
   *   river 도하 강행 통솔 65+  이번 합 주는 피해 ×1.15·받는 피해 ×0.9, 다음 합 주는 피해 ×0.85(두 합을 쓴다)
   * 이 판 지형에 '숲'이 없어(평야·구릉·강·산) 원안의 "숲 화공" 은 구릉에 붙였다.
   */
  var TACTICS = {
    mount: { key: 'ambush', name: '매복',     emoji: '🌲', stat: 'wisdom',  req: 70, desc: '산에 군사를 숨겼다 친다 — 이번 합 받는 피해 ×0.85' },
    hill:  { key: 'fire',   name: '화공',     emoji: '🔥', stat: 'wisdom',  req: 60, desc: '숲과 골에 불을 놓는다 — 적 병력의 12.6% 를 태운다' },
    plain: { key: 'charge', name: '기병 돌격', emoji: '🐎', stat: 'might',   req: 80, desc: '기병으로 한 번에 친다 — 이번 합 주는 피해 ×1.25, 뒤에 사기 -0.03' },
    river: { key: 'ford',   name: '도하 강행', emoji: '🌊', stat: 'command', req: 65, desc: '강을 밀고 건넌다 — 이번 합 주는 피해 ×1.15·받는 피해 ×0.9, 다음 합 주는 피해 ×0.85' }
  };

  /** 이 싸움터에서 쓸 수 있는 전술 — { tactic, ok, why }. used 는 이미 쓴 전술 key(전투당 한 번) */
  function tacticFor(landKey, officerIds, used) {
    var t = TACTICS[landKey] || null;
    if (!t) { return { tactic: null, ok: false, why: '이 땅에서는 쓸 전술이 없다' }; }
    if (used) { return { tactic: t, ok: false, why: '이번 싸움에서는 이미 전술을 썼다' }; }
    var off = global.DG.off, top = 0, i;
    for (i = 0; i < officerIds.length; i++) { top = Math.max(top, off.stats(officerIds[i])[t.stat]); }
    if (top < t.req) {
      return { tactic: t, ok: false, why: t.name + ' 은(는) ' + ({ wisdom: '지력', might: '무력', command: '통솔' })[t.stat] + ' ' + t.req + ' 이상의 장수가 있어야 한다' };
    }
    return { tactic: t, ok: true, why: '' };
  }

  /**
   * 이 무장들로 지금 설 수 있는 진형 중 가장 센 것(없으면 null).
   * manual(진형 key)을 주면 그 진형을 **직접 고른 것**이다 — 문턱을 넘으면 그대로 서고,
   * 못 넘어도 서되 위력의 덧붙는 몫(mul-1)이 절반이 된다(PLAN §5-6 (b)). 자동(manual 없음)은 예전과 똑같다.
   */
  function formationOf(officerIds, manual) {
    var off = global.DG.off, best = null, i, j, top;
    if (manual) {
      var mf = null;
      for (i = 0; i < FORMATIONS.length; i++) { if (FORMATIONS[i].key === manual) { mf = FORMATIONS[i]; } }
      if (mf) {
        top = 0;
        for (j = 0; j < officerIds.length; j++) { top = Math.max(top, off.stats(officerIds[j])[mf.reqStat]); }
        if (top >= mf.req) { return mf; }
        return { key: mf.key, name: mf.name, emoji: mf.emoji, reqStat: mf.reqStat, req: mf.req, desc: mf.desc,
                 mul: 1 + (mf.mul - 1) * 0.5, weak: true };
      }
    }
    for (i = 0; i < FORMATIONS.length; i++) {
      var f = FORMATIONS[i];
      top = 0;
      for (j = 0; j < officerIds.length; j++) {
        var v = off.stats(officerIds[j])[f.reqStat];
        if (v > top) { top = v; }
      }
      if (top >= f.req && (!best || f.mul > best.mul)) { best = f; }
    }
    return best;
  }

  /**
   * 부대 전투력.
   *   병력 × 훈련 × 기술 × 장수 보정 × 진형 배율
   * 장수 보정은 **가장 나은 한 사람**이 끌고, 나머지는 조금씩 보탠다.
   * 전원 평균으로 하면 약한 장수를 딸려 보낼수록 약해져서 "다 데려간다" 가 손해가 된다.
   */
  function armyPower(army) {
    var off = global.DG.off;
    var trainF = 0.5 + core.clamp(army.train, 0, 100) / 200;
    var techF = 0.7 + core.clamp(army.tech, 0, 900) / 900 * 0.6;
    var bestCmd = 0, bestMight = 0, extra = 0, navy = 1, i, s;
    for (i = 0; i < army.officers.length; i++) {
      s = off.stats(army.officers[i]);
      if (s.command > bestCmd) { bestCmd = s.command; }
      if (s.might > bestMight) { bestMight = s.might; }
      extra += (s.command + s.might) / 2;
      /* 물에서는 수전에 능한 **한 사람**이 부대를 끈다 (장수 보정과 같은 결이다) */
      if (army.water) { navy = Math.max(navy, FD.navyOf(army.officers[i])); }
    }
    var lead = 1 + bestCmd / 100 * 0.5 + bestMight / 100 * 0.25 +
      Math.max(0, army.officers.length - 1) * 0.03;
    if (extra === 0) { lead = 0.6; }         // 장수 없는 군대는 오합지졸이다
    var form = formationOf(army.officers, army.formation);
    var mtM = global.DG.mount && global.DG.mount.powerMul ? global.DG.mount.powerMul(army.officers, army.water) : 1;   // 명마(mount.js) — 땅 싸움에서만, 안 탔으면 1
    return army.troops * trainF * techF * lead * navy * (army.morale || 1) * (form ? form.mul : 1) * mtM;
  }

  /**
   * 병종 3분류(보병/기병/수군) 비율 — PLAN §6 "무리 병종 기둥"의 나머지 조각.
   * 이 판은 병종 비율을 데이터로 갖고 있지 않아(2026-09-22 세션이 보류해 둔 그대로),
   * **실재하는 값**(수전 여부·장수 무력 평균)에서 규칙으로 짓는다(2026-09-23 사용자 확인,
   * "임의 규칙으로 진행"). 판정(armyPower 등)에는 전혀 안 쓴다 — battle3d.js 가 무리
   * 깃발을 보·기·수로 섞어 그리는 데만 쓰는 화면용 값이다.
   */
  function troopMixOf(army) {
    if (army.water) { return { inf: 0.15, cav: 0, navy: 0.85 }; }
    var off = global.DG.off, i, sum = 0, n = army.officers.length;
    for (i = 0; i < n; i++) { sum += off.stats(army.officers[i]).might; }
    var avgMight = n ? sum / n : 50;
    var cav = core.clamp((avgMight - 45) / 130, 0.1, 0.4);
    return { inf: 1 - cav, cav: cav, navy: 0 };
  }

  /**
   * 화공(火攻) — 물 위에서는 불이 곧 승부다.
   * 부대에서 지력이 가장 높은 사람이 건다. 성공하면 상대 배가 타고 병사가 물에 빠진다.
   * **가늠(dry)에서도 굴린다** — 여기서 빼면 AI 가 보는 승산과 실제가 어긋난다
   * (일기토만 뺀 것은 장수가 진짜로 다치기 때문이다).
   */
  function fireRoll(from, to) {
    var off = global.DG.off, best = null, bw = -1, i, w;
    for (i = 0; i < from.officers.length; i++) {
      w = off.stats(from.officers[i]).wisdom;
      if (w > bw) { bw = w; best = from.officers[i]; }
    }
    if (!best || bw < 60) { return null; }
    if (Math.random() > core.clamp(bw / 1400, 0, 0.075)) { return null; }
    var burn = Math.round(to.troops * 0.18);
    to.troops = Math.max(0, to.troops - burn);
    to.ships = Math.max(0, Math.round((to.ships || 0) * 0.75));
    to.morale = (to.morale || 1) * 0.9;
    return off.find(best).name + ' 의 화공(火攻) — 배가 타고 병사 ' +
      core.fmt(burn) + ' 이 물에 빠졌다';
  }

  /** 배도 병사와 함께 가라앉는다 */
  function sinkShips(ships, lost, left) {
    if (!ships) { return 0; }
    var before = lost + left;
    if (before <= 0) { return 0; }
    return Math.max(0, Math.round(ships * (1 - lost / before)));
  }

  function topBy(officerIds, key) {
    var off = global.DG.off, best = null, bv = -1;
    for (var i = 0; i < officerIds.length; i++) {
      var v = off.stats(officerIds[i])[key];
      if (v > bv) { bv = v; best = officerIds[i]; }
    }
    return best;
  }

  /* ── 일기토 ───────────────────────────────────────────── */

  /**
   * 서로 으뜸 무장이 창을 겨눈다.
   * 무력 차가 크면 아무도 안 나온다 — 뻔한 싸움은 일기토가 아니다.
   */
  function duel(aId, dId) {
    var st = duelBegin(aId, dId);
    if (!st) { return null; }
    while (duelAlive(st)) { duelRound(st, null); }
    return duelEnd(st);
  }

  /* 일기토를 세 토막으로 쪼갠 것 — duel() 은 이 셋을 선택 없이 이어 부를 뿐이라
     난수를 쓰는 순서까지 예전과 같다. 플레이어가 직접 칠 때(PLAN §5-3)는 합 사이에
     duelBout() 이 끼어들어 **판정 식은 그대로 두고 칠 확률에 배율만** 곱한다. */
  var DUEL_ROUNDS = 12;

  /** 일기토가 성립하는가 — 성립하면 진행 상태를, 아니면 null */
  function duelBegin(aId, dId) {
    var off = global.DG.off;
    /* 특성(PLAN §5-1) — 용맹은 무력이 조금 더 먹히고, 호전·신중·온화는 일기토가 벌어질 확률을 바꾼다 */
    var am = off.stats(aId).might * off.traitMul(aId, 'duelMight'), dm = off.stats(dId).might * off.traitMul(dId, 'duelMight');
    if (Math.abs(am - dm) > DUEL_GAP) { return null; }
    if (Math.random() > Math.min(0.9, 0.35 * off.traitMul(aId, 'duelRate') * off.traitMul(dId, 'duelRate'))) { return null; }
    return duelSet(aId, dId);
  }

  /** 문턱 없이 판을 세운다 — 시나리오가 정한 일기토(무력 차·확률을 안 본다). duelBegin 의 뒷부분과 같다 */
  function duelSet(aId, dId) {
    var off = global.DG.off;
    var am = off.stats(aId).might * off.traitMul(aId, 'duelMight'), dm = off.stats(dId).might * off.traitMul(dId, 'duelMight');
    return { a: aId, d: dId, am: am, dm: dm, ah: 100, dh: 100, n: 0, rounds: [], hits: [], bouts: [], foeHabit: null };
  }

  function duelAlive(st) { return st.ah > 0 && st.dh > 0 && st.n < DUEL_ROUNDS; }

  /** 한 합. hitA 를 주면 그 확률로 a 가 친다(없으면 무력비 그대로 — 예전 식) */
  function duelRound(st, hitA) {
    st.n++;
    var hit = hitA == null ? st.am / (st.am + st.dm) : hitA;
    if (Math.random() < hit) { st.dh -= 8 + Math.round(st.am / 12); st.rounds.push('a'); }
    else { st.ah -= 8 + Math.round(st.dm / 12); st.rounds.push('d'); }
    /* 실시간 재생용 — 판정과 무관한 기록일 뿐이다(battle3d.js 참고).
       매 합 끝의 체력을 남겨 두면 화면이 순간이동 없이 깎이는 걸 보여줄 수 있다 */
    var who = st.rounds[st.rounds.length - 1];
    st.hits.push({ who: who, ah: Math.max(0, st.ah), dh: Math.max(0, st.dh) });
    return who;
  }

  /** 끝맺음 — 승자·부상·요약 글을 낸다 */
  function duelEnd(st) {
    var off = global.DG.off, aId = st.a, dId = st.d, ah = st.ah, dh = st.dh, n = st.n;
    var winner = dh <= 0 ? aId : (ah <= 0 ? dId : (ah >= dh ? aId : dId));
    var loser = winner === aId ? dId : aId;
    /* 크게 진 쪽만 다친다. 비긴 판에서 다치면 일기토를 걸 까닭이 없어진다 */
    var decisive = (winner === aId ? dh : ah) <= 0;
    var hurt = decisive && Math.random() < 0.5;
    if (hurt) { off.rec(loser).hurt = 1 + Math.floor(Math.random() * 2); }
    var out = {
      winner: winner, loser: loser, rounds: n, decisive: decisive, hurt: hurt, hits: st.hits,
      text: off.find(winner).name + ' 이(가) ' + off.find(loser).name + ' 을(를) ' +
        n + '합 만에 ' + (decisive ? '꺾었다' : '밀어냈다')
    };
    if (st.bouts.length) { out.bouts = st.bouts; }         // 손으로 친 판만 — 화면이 되짚어 보여 준다
    return out;
  }

  /* 베기 > 찌르기 > 막기 > 베기 — 손으로 칠 때의 세 수 */
  var STANCES = {
    slash:  { key: 'slash',  name: '베기',   emoji: '⚔️', beats: 'thrust', desc: '찌르기를 흘리며 벤다' },
    thrust: { key: 'thrust', name: '찌르기', emoji: '🗡️', beats: 'guard',  desc: '막기를 뚫는다' },
    guard:  { key: 'guard',  name: '막기',   emoji: '🛡️', beats: 'slash',  desc: '베기를 받아넘긴다' }
  };
  var STANCE_KEYS = ['slash', 'thrust', 'guard'];
  var BOUT_ROUNDS = 4;                                      // 한 수가 다스리는 합 수(4×3 = 열두 합)
  var BOUT_MUL = { win: 1.3, tie: 1.0, lose: 0.8 };         // 이기면 내가 칠 확률 ×1.3, 지면 ×0.8

  /** 적의 수 — 지난 교전에서 이긴 수를 되풀이하는 버릇(6할)이 있다. 그 밖엔 고르게 */
  function foeStance(st) {
    if (st.foeHabit && Math.random() < 0.6) { return st.foeHabit; }
    return STANCE_KEYS[Math.floor(Math.random() * STANCE_KEYS.length)];
  }

  /**
   * 플레이어(늘 a 쪽 — 치는 쪽)가 수 하나를 골라 네 합을 친다.
   * 상대 수와 견줘 이기면 ×1.3·비기면 ×1.0·지면 ×0.8 이 a 가 칠 확률에 곱해진다.
   * @returns { pick, foe, res:'win'|'tie'|'lose', mul, rounds:['a'|'d',…], ah, dh } · 못 치면 null
   */
  function duelBout(st, pick) {
    if (!STANCES[pick] || !duelAlive(st)) { return null; }
    var foe = foeStance(st);
    var res = pick === foe ? 'tie' : (STANCES[pick].beats === foe ? 'win' : 'lose');
    var mul = BOUT_MUL[res];
    var hitA = core.clamp(st.am / (st.am + st.dm) * mul, 0.05, 0.95);
    var got = [], k;
    for (k = 0; k < BOUT_ROUNDS && duelAlive(st); k++) { got.push(duelRound(st, hitA)); }
    st.foeHabit = res === 'lose' ? foe : null;              // 적이 이긴 수만 버릇으로 남는다
    var b = { pick: pick, foe: foe, res: res, mul: mul, rounds: got, ah: Math.max(0, st.ah), dh: Math.max(0, st.dh) };
    st.bouts.push(b);
    return b;
  }

  /** 남은 합을 맡긴다(배율 없이) — 손으로 치다 그만둘 때 */
  function duelAuto(st) {
    while (duelAlive(st)) { duelRound(st, null); }
  }

  /** 손 싸움 한 판을 끝까지 돌린다 — 수마다 onDuel(view, 답) 을 부르고, 끝 카드가 닫히면 after(결과).
   *  출진 일기토와 시나리오 일기토(scenario.js)가 같이 쓴다. cont = 끝 카드 단추 글(없으면 화면 기본) */
  function duelDrive(st, onDuel, after, cont) {
    function view(done, result) {
      return { a: st.a, d: st.d, ah: Math.max(0, st.ah), dh: Math.max(0, st.dh), n: st.n,
        bouts: st.bouts.slice(), habit: st.foeHabit, stances: STANCES, done: !!done, result: result || null, cont: cont || '' };
    }
    function prompt() {
      onDuel(view(false), function (pick) {
        if (pick === 'auto') { duelAuto(st); }
        else if (!duelBout(st, pick)) { prompt(); return; }
        if (duelAlive(st)) { prompt(); return; }
        var res = duelEnd(st);
        onDuel(view(true, res), function () { after(res); });
      });
    }
    prompt();
  }

  /** 시나리오 일기토 — aId(치는 쪽)가 손으로 dId 와 겨룬다. 승부가 나면 after(결과) */
  function duelHand(aId, dId, onDuel, after, cont) {
    duelDrive(duelSet(aId, dId), onDuel, after, cont);
  }

  /* ── 출진 ─────────────────────────────────────────────── */

  /** 출진할 수 있는가 — 인접·소속·병력·군량을 본다 */
  function canMarch(fromId, toId, troops) {
    var R = global.DG.rtk;
    var from = R.city(fromId), to = R.city(toId);
    if (!from || !to) { return { ok: false, why: '없는 성' }; }
    var d = CD.find(fromId);
    if (d.adj.indexOf(toId) < 0) { return { ok: false, why: '맞닿아 있지 않습니다' }; }
    if (from.force === to.force) { return { ok: false, why: '우리 성입니다' }; }
    if (troops > from.troops) { return { ok: false, why: '병력이 모자랍니다' }; }
    if (troops < 500) { return { ok: false, why: '오백은 넘겨야 군대라 하지요' }; }
    /* 원정 군량 — 병력의 한 달치는 들고 가야 한다 */
    var need = Math.round(troops / 1000 * global.DG.rtk.FOOD_PER_1000 * 2);
    if (from.food < need) { return { ok: false, why: '군량이 모자랍니다 (' + core.fmt(need) + ' 필요)' }; }
    if (global.DG.diplo && global.DG.diplo.blocked(from.force, to.force)) {
      return { ok: false, why: '맹약이 있어 칠 수 없습니다' };
    }
    /* 이미 에워싸고 있으면 새 군대를 또 내보내지 않는다 — 늘리려면 **보급**이다.
       이 줄이 없으면 AI 가 달마다 새 진영을 세워 같은 성 앞에 군대가 쌓인다 */
    if (campAt(toId, from.force)) {
      return { ok: false, why: '이미 진을 치고 있습니다 (보급으로 늘리십시오)' };
    }
    /* 물길은 배로만 건넌다 */
    var water = CD.isWater(fromId, toId);
    if (water) {
      var have = from.ships || 0;
      if (have <= 0) { return { ok: false, why: '물길입니다 — 배가 없습니다 (조선으로 지으십시오)' }; }
      if (troops > have * SHIP_CREW) {
        return { ok: false, why: '배가 모자랍니다 (' + have + '척으로 ' +
          core.fmt(have * SHIP_CREW) + '명)' };
      }
    }
    return { ok: true, food: need, water: water,
             ships: water ? Math.ceil(troops / SHIP_CREW) : 0 };
  }

  /**
   * 출진 사전 준비 — 확인·차출·구원군·부대 구성까지, `fight()`/`marchInteractive()`
   * 어느 쪽으로 붙든 **똑같이** 거쳐야 하는 부분이다.
   * @returns {ok:false,why} 이거나 {ok:true, atk, def, land, chk, valid, ...}
   */
  function setupMarch(fromId, toId, officerIds, troops) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var chk = canMarch(fromId, toId, troops);
    if (!chk.ok) { return { ok: false, why: chk.why }; }

    var from = R.city(fromId), to = R.city(toId);
    var i, valid = [];
    for (i = 0; i < officerIds.length; i++) {
      var r = off.rec(officerIds[i]);
      if (r.city === fromId && r.force === from.force && !r.hurt) { valid.push(officerIds[i]); }
    }
    if (!valid.length) { return { ok: false, why: '데려갈 장수가 없습니다' }; }

    from.troops -= troops;
    from.food -= chk.food;
    if (chk.water) { from.ships -= chk.ships; }

    /* 구원군 — 수비 쪽도 이웃한 제 성에서 병력을 끌어온다.
       이게 없으면 공격 쪽만 모을 수 있어 **큰 세력이 무조건 이긴다**
       (없이 120개월을 굴렸더니 263전 259함락 — 사실상 수비가 없는 판이었다) */
    var relief = reinforce(toId);
    var defOff = off.atCity(toId, to.force).map(function (h) { return h.id; });
    var land = CD.landOf(toId);

    var atk = {
      side: 'atk', force: from.force, troops: troops, start: troops,
      train: from.train, tech: from.tech, officers: valid, morale: 1,
      water: chk.water, ships: chk.ships
    };
    var def = {
      side: 'def', force: to.force, troops: to.troops, start: to.troops,
      train: to.train, tech: to.tech, officers: defOff, morale: 1,
      water: chk.water, ships: chk.water ? (to.ships || 0) : 0
    };

    /* 따라나선 것만으로도 는다 — 이기고 지고는 그다음이다 */
    off.gainExpAll(valid, off.EXP.march);

    return {
      ok: true, fromId: fromId, toId: toId, from: from, to: to,
      atk: atk, def: def, land: land, chk: chk, valid: valid, troops: troops, relief: relief
    };
  }

  /**
   * 싸움이 끝난 뒤 — 성을 뺏거나 물러나거나 진을 친다. `fight()` 로 한 번에
   * 붙었든 `marchInteractive()` 로 합마다 끊어 붙었든 결과 모양(report)만
   * 같으면 이 뒤처리는 똑같다.
   */
  function finishMarch(setup, report) {
    var R = global.DG.rtk, off = global.DG.off;
    var fromId = setup.fromId, toId = setup.toId, from = setup.from, to = setup.to;
    var atk = setup.atk, def = setup.def, chk = setup.chk, valid = setup.valid;
    var troops = setup.troops, relief = setup.relief, i;

    report.from = fromId; report.to = toId; report.relief = relief;
    report.force = from.force; report.defForce = def.force;
    if (relief > 0) { report.log.splice(1, 0, '🚩 이웃 성에서 구원군 ' + core.fmt(relief) + ' 이 들어왔다'); }

    /* 들고 나간 군량에서 이 달 먹은 것을 뺀 나머지가 **치중(輜重)** 이다 */
    var eaten = Math.round(troops / 1000 * R.FOOD_PER_1000);
    var baggage = Math.max(0, chk.food - eaten);

    if (report.won) {
      capture(toId, from.force, atk, def, report);
      to.food += baggage;                       // 치중은 뺏은 성으로 들어간다
    } else if (report.routed) {
      /* 물러났다 — 살아 돌아온 병력·치중·배는 출진한 성으로 되돌린다 */
      from.troops += atk.troops;
      from.food += baggage;
      from.ships += atk.ships || 0;
      to.troops = def.troops;
      if (chk.water) { to.ships = def.ships; }
      for (i = 0; i < valid.length; i++) { off.addLoyal(valid[i], -2); }
    } else {
      /* 날이 저물었을 뿐이다 — 여기서 군을 되돌리면 공성이 영영 한 달짜리가 된다.
         물러나지 않고 **성 밖에 진을 친다**. 다음 달은 resolveAll() 이 잇는다 */
      to.troops = def.troops;
      if (chk.water) { to.ships = def.ships; }
      report.campId = encamp(fromId, toId, atk, baggage, report).id;
    }

    checkHistoryBranch(report);
    core.emit('rtk:battle', report);
    core.emit('changed');
    core.persist();
    return report;
  }

  /**
   * 친다.
   * @param officerIds 데려갈 무장 (이 성에 있고, 성한 사람만)
   * @returns 전황 보고 { won, log[], lossA, lossD, taken, duel }
   */
  function march(fromId, toId, officerIds, troops) {
    var setup = setupMarch(fromId, toId, officerIds, troops);
    if (!setup.ok) { return setup; }
    var report = fight(setup.atk, setup.def, setup.to, setup.toId, setup.land, false);
    return finishMarch(setup, report);
  }

  /**
   * 친다 — **개입형**. `march()` 와 사전 준비는 완전히 같지만, 판정을 합마다
   * 끊어 그 사이에 플레이어의 명령(돌격·수비·퇴각)을 받는다.
   *
   * 개입이 없으면(매번 `step(null)`) `stepRound()` 를 그대로 같이 쓰므로
   * `fight()` 를 한 번에 돌린 것과 자릿수까지 같은 값이 나온다 — **판정 수식은
   * 한 줄도 안 바뀌었다**, 명령이 곱하는 배율(`stepRound` 참고)만 새로 얹은
   * 자리다. AI 가 치는 싸움·가늠(forecast)·진영의 달마다 재개(`resolveCamp`)는
   * 여전히 `fight()` 를 그대로 쓴다 — 여기 손 안 댄다("AI 전용 판정 안 만든다"
   * 원칙, `CLAUDE.md` 참고). 실제 개입은 **플레이어가 손수 출진을 누른 그
   * 싸움에서만** 일어난다.
   *
   * @param hooks {
   *   onIntro(lines, repStub) — 붙기 전 형세(머리글+일기토)가 다 나온 뒤 한 번.
   *     repStub 은 battle3d 를 그 자리에서 세우는 데 필요한 최소한(atkStart 등)
   *   onLog(line) — 그 뒤로 새로 찍히는 로그 한 줄씩(화공 등)
   *   onRound(frame, r) — 매 합 끝
   *   onPrompt(state, step) — 다음 합 전에 명령을 물을 차례.
   *     step(cmd) 를 불러 잇는다 — cmd: null|'press'|'hold'|'retreat'
   *   onDone(report) — march() 가 돌려주던 것과 같은 모양의 최종 보고
   *   onTactics(ctx, done) — step('grid') 때 격자 전술판을 연다(W-0108, 보정·전사 적용은 tactics.marchGrid). 한 출진에 한 번
   * }
   * @returns setup 이 실패했으면 {ok:false,why} 를 그 자리에서, 아니면
   *   {ok:true, pending:true}(끝은 hooks.onDone 으로 온다)
   */
  function marchInteractive(fromId, toId, officerIds, troops, hooks) {
    hooks = hooks || {};
    var setup = setupMarch(fromId, toId, officerIds, troops);
    if (!setup.ok) { return setup; }

    var atk = setup.atk, def = setup.def, wallRef = setup.to, land = setup.land;
    var toId2 = setup.toId;
    if (hooks.formation) { atk.formation = hooks.formation; }     // 진형을 직접 골랐다(PLAN §5-6 (b))
    var log = [];
    var lines = function (s) {
      log.push(s);
      if (hooks.onLog) { hooks.onLog(s); }
    };
    /* 일기토 — 화면이 손으로 치겠다고(hooks.onDuel) 했고 판이 서면 먼저 그 카드부터 띄운다(PLAN §5-3).
       끝나면 그 결과(preDuel)를 들고 전황으로 들어간다. 안 서거나 훅이 없으면 예전 그대로 fightIntro 가 굴린다 */
    var aTop0 = topBy(atk.officers, 'might'), dTop0 = topBy(def.officers, 'might');
    var duelSt = (hooks.onDuel && aTop0 && dTop0) ? duelBegin(aTop0, dTop0) : null;
    if (!duelSt) { begin(hooks.onDuel && aTop0 && dTop0 ? null : undefined); }
    else { duelPrompt(); }
    return { ok: true, pending: true };

    function duelPrompt() { duelDrive(duelSt, hooks.onDuel, begin); }

    /* 몸통은 들여쓰기를 그대로 둔 채 감쌌다(diff 를 작게) */
    function begin(preDuel) {
    var intro = fightIntro(atk, def, wallRef, toId2, land, false, lines, preDuel);
    var water = intro.water, sortie = intro.sortie, du = intro.du;
    var leadA = intro.leadA, leadD = intro.leadD;
    var formA = intro.formA, formD = intro.formD;
    var mixA = intro.mixA, mixD = intro.mixD, mountA = intro.mountA, mountD = intro.mountD;
    var startWall = wallRef.wall;
    var frames = [], r = 0;

    if (hooks.onIntro) {
      hooks.onIntro(log.slice(), {
        to: toId2, water: water, force: atk.force, defForce: def.force,
        atkStart: atk.start, defStart: def.start, duel: du, wallFrom: startWall,
        leadA: leadA, leadD: leadD, formA: formA, formD: formD,
        mixA: mixA, mixD: mixD, mountA: mountA, mountD: mountD, land: land.key, sortie: sortie
      });
    }

    function finish(kind) {
      /* fight() 의 꼬리(잃은 병력·성벽 변화·남은 배)와 같은 줄을 남긴다 —
         퇴각(retreat) 명령이면 이번 합은 안 치렀으니 건너뛴다 */
      if (kind !== 'routed' || r > 0) {
        lines('📉 잃은 병력 — 공 ' + core.fmt(atk.start - atk.troops) +
          ' · 수 ' + core.fmt(def.start - def.troops));
        if (startWall !== wallRef.wall) {
          lines('🧱 성벽 ' + core.fmt(startWall) + ' → ' + core.fmt(wallRef.wall));
        }
        if (water) {
          lines('🛶 남은 배 — 공 ' + (atk.ships || 0) + '척 · 수 ' + (def.ships || 0) + '척');
        }
      }
      var report = {
        ok: true, won: kind === 'won', routed: kind === 'routed', duel: du, log: log,
        lossA: atk.start - atk.troops, lossD: def.start - def.troops,
        atkStart: atk.start, defStart: def.start,
        wallFrom: startWall, wallTo: wallRef.wall, sortie: sortie, water: water,
        leadA: leadA, leadD: leadD, formA: formA, formD: formD,
        mixA: mixA, mixD: mixD, mountA: mountA, mountD: mountD,
        frames: frames
      };
      var full = finishMarch(setup, report);
      if (hooks.onDone) { hooks.onDone(full); }
      return full;
    }

    function step(cmd) {
      if (cmd === 'grid') { if (!(global.DG.tactics && global.DG.tactics.marchGrid({ hooks: hooks, atk: atk, def: def, toId: toId2, fromId: setup.fromId, land: land, water: water, sortie: sortie, r: r, lines: lines }, prompt))) { prompt(); } return; }
      if (cmd === 'retreat') {
        lines('↩️ 명령대로 즉시 군을 물렸다');
        finish('routed');
        return;
      }
      r++;
      var res = stepRound(atk, def, wallRef, toId2, land, sortie, water, lines, cmd);
      frames.push(res.frame);
      if (hooks.onRound) { hooks.onRound(res.frame, r); }
      if (res.outcome === 'won') { finish('won'); return; }
      if (res.outcome === 'routed') { finish('routed'); return; }
      if (r >= ROUNDS) {
        lines('🌒 날이 저물었다 — 이 달 안에는 못 떨어뜨렸다');
        finish('dusk');
        return;
      }
      prompt();
    }
    function prompt() {   // 다음 합 전 명령 묻기 — 전술판 뒤에는 같은 합으로 돌아와 다시 묻는다
      if (!hooks.onPrompt) { step(null); return; }
      hooks.onPrompt({ r: r, atk: atk.troops, def: def.troops, wall: wallRef.wall, tactic: tacticFor(land.key, atk.officers, atk.tacticUsed), grid: !!(hooks.onTactics && !atk.grid && !water && global.DG.tactics) }, step);
    }
    prompt();
    }
  }

  /**
   * 구원군 — 공격을 받은 성으로 이웃한 제 성의 병력이 달려온다.
   * 한 성에서 **사할까지**. 공격 쪽이 끌어모으는 오할보다 적게 둔 것은,
   * 치는 쪽이 때를 고르기 때문이다(그 이점까지 없애면 아무도 못 친다).
   */
  function reinforce(toId) {
    var R = global.DG.rtk;
    var to = R.city(toId);
    if (!to || !to.force) { return 0; }
    var adj = CD.find(toId).adj, sum = 0, i;
    for (i = 0; i < adj.length; i++) {
      var c = R.city(adj[i]);
      if (!c || c.force !== to.force) { continue; }
      var t = Math.floor(c.troops * 0.4);
      if (t < 200) { continue; }
      c.troops -= t; to.troops += t; sum += t;
    }
    return sum;
  }

  /** 그 성이 부를 수 있는 구원군의 크기 (AI 가 칠지 말지 가늠할 때 본다) */
  function reliefOf(toId) {
    var R = global.DG.rtk;
    var to = R.city(toId);
    if (!to || !to.force) { return 0; }
    var adj = CD.find(toId).adj, sum = 0, i;
    for (i = 0; i < adj.length; i++) {
      var c = R.city(adj[i]);
      if (c && c.force === to.force) { sum += Math.floor(c.troops * 0.4); }
    }
    return sum;
  }

  /**
   * 붙기 전 형세 — 머리글 로그 + 일기토 + 야전/공성/수전 갈림을 정한다.
   * `fight()` 와 `marchInteractive()` 가 **같이 쓴다** — 개입형 전투도 붙기
   * 전 형세는 정공법과 똑같아야 하기 때문이다.
   * @param dry 가늠(forecast)이면 true — 일기토를 굴리지 않는다(장수가 진짜로 다친다)
   */
  function fightIntro(atk, def, wallRef, toId, land, dry, lines, preDuel) {
    var off = global.DG.off;
    var water = !!atk.water;
    if (water) { def.water = true; }

    lines((water ? '🌊 ' : '⚔️ ') + CD.find(toId).name + ' — ' +
      global.DG.rtk.forceName(atk.force) + ' ' + core.fmt(atk.troops) +
      ' vs ' + global.DG.rtk.forceName(def.force) + ' ' + core.fmt(def.troops));

    /* 진형 — 판정(armyPower)이 이미 반영했으니 여기선 알리기만 한다 */
    var af = formationOf(atk.officers, atk.formation), df = formationOf(def.officers);
    if (af) {
      lines(af.emoji + ' 공격군이 ' + af.name + ' 을 편다 (위력 ×' + af.mul.toFixed(2) + ')' +
        (af.weak ? ' — 직접 골랐으나 문턱에 못 미쳐 위력이 반으로 준다' : ''));
    }
    if (df) { lines(df.emoji + ' 수비군이 ' + df.name + ' 을 편다 (위력 ×' + df.mul.toFixed(2) + ')'); }

    if (water) {
      lines('🛶 물길로 건넜다 — 배 ' + (atk.ships || 0) + '척 대 ' + (def.ships || 0) +
        '척. 성벽은 소용이 없다');
    }

    /* 일기토 */
    var du = null;
    var aTop = topBy(atk.officers, 'might'), dTop = topBy(def.officers, 'might');
    if (aTop && dTop && !dry) {
      /* preDuel 이 있으면 marchInteractive 가 플레이어와 손으로 친 판이다 — 여기선 굴리지 않고 그대로 쓴다.
         undefined 면 예전처럼 굴린다(null 은 "이미 굴렸는데 안 걸렸다") */
      du = preDuel !== undefined ? preDuel : duel(aTop, dTop);
      if (du) {
        /* 2026-09-10 — battle3d.js 가 실제 장수 모델 둘을 세우려면 이 싸움의
           '공격 쪽 장수'·'수비 쪽 장수'가 누구인지 알아야 한다. hits[].who
           ('a'|'d')와 짝이 맞는 이름으로 판정에는 없던 것을 그대로 붙인다 —
           새 판정이 아니라 이미 정해진 aTop/dTop 을 기록해 둘 뿐이다 */
        du.a = aTop; du.d = dTop;
        lines('🤺 ' + du.text + (du.hurt ? ' — ' + off.find(du.loser).name + ' 이(가) 다쳤다' : ''));
        var winSide = atk.officers.indexOf(du.winner) >= 0 ? atk : def;
        var loseSide = winSide === atk ? def : atk;
        winSide.morale *= 1.15;
        loseSide.morale *= 0.92;
        off.gainExp(du.winner, off.EXP.duel);
        off.noteDuel(du.winner, du.loser);
        if (off.rec(du.winner).force === global.DG.rtk.state().me) { global.DG.rtk.bumpStat('duelWins'); }
        if (du.hurt) {
          /* 다친 장수는 그 싸움에서 빠진다 */
          var li = loseSide.officers.indexOf(du.loser);
          if (li >= 0) { loseSide.officers.splice(li, 1); }
        }
      }
    }

    /* 야전 — 수비가 병력에 자신이 있으면 성 밖으로 나온다.
       수전이면 성문이 뜻이 없다 — 둘 다 배 위에 있다 */
    var sortie = !water && def.troops > atk.troops * 0.85;
    if (water) { lines('⛵ 배와 배가 맞붙는다 (수전)'); }
    else if (sortie) { lines('🏇 성문이 열리고 수비군이 마주 나왔다 (야전)'); }
    else { lines('🧱 수비군은 성을 닫고 지킨다 (공성)'); }

    /* leadA/leadD — 2026-09-10, "인물 추가". `du`(실제 합을 주고받는 일기토)는
       능력치 차가 크면(DUEL_GAP) 아예 안 뽑히고, 뽑혀도 65%는 그냥 안 붙는다
       (`duel()` 참고) — 그 나머지 싸움은 지금까지 깃발 다발만 보였다.
       aTop/dTop 은 이미 정해져 있던 값이라(위), 합을 주고받지 않아도 그
       이름표만 그대로 넘긴다 — `battle3d.js`가 이걸로 "지휘관 둘이 서 있는"
       실제 캐릭터를 세운다(공격·피격 동작 없이 idle로만, 새 판정 아님) */
    /* formA/formD — 2026-09-22, PLAN §6 "무리 병종 기둥"의 첫 조각. af/df 는
       바로 위에서 이미 구했다(로그 문구용) — 새로 굴리지 않고 그 key 만
       battle3d.js 로 넘겨 무리 배치 모양(쐐기·활·원)을 고르게 한다 */
    /* 명마(mount.js) — 그 군이 탄 가장 좋은 말. 기록 한 줄 + 3D 전장이 돌격 달리기 배율로 읽는다(판정은 armyPower 가 이미 했다) */
    var MTw = global.DG.mount, mtA = MTw && MTw.bestId ? MTw.bestId(atk.officers, water) : null, mtD = MTw && MTw.bestId ? MTw.bestId(def.officers, water) : null;
    if (mtA) { lines(MTw.note(atk.officers, water)); }
    if (mtD) { lines(MTw.note(def.officers, water)); }
    return { water: water, sortie: sortie, du: du, leadA: aTop, leadD: dTop,
      formA: af && af.key, formD: df && df.key,
      mixA: troopMixOf(atk), mixD: troopMixOf(def), mountA: mtA, mountD: mtD };
  }

  /**
   * 합(合) 하나 — `fight()` 의 라운드 루프 몸통을 그대로 뽑아낸 것이다.
   * `cmd` 가 없으면(undefined) 수식이 곱하는 배율이 전부 1이라 예전 `fight()`
   * 한 벌과 자릿수까지 같은 값이 나온다 — **판정 자체는 그대로**, `cmd` 는
   * `marchInteractive()` 가 라운드 사이에 개입할 때만 쓰는 자리다.
   *   cmd: null|undefined(정공법) · 'press'(돌격 — 더 베고 더 맞는다) ·
   *        'hold'(수비 — 덜 베고 덜 맞는다)
   * @returns { frame, outcome: null|'won'|'routed' }
   */
  function stepRound(atk, def, wallRef, toId, land, sortie, water, lines, cmd) {
    /* 지형 전술(PLAN §5-6) — cmd 가 { cmd, tactic } 이면 전술이 얹힌다. 문자열·없음이면 예전 그대로다 */
    var tacticKey = null;
    if (cmd && typeof cmd === 'object') { tacticKey = cmd.tactic || null; cmd = cmd.cmd || null; }
    var tac = null;
    if (tacticKey) {
      var tf = tacticFor(land.key, atk.officers, atk.tacticUsed);
      if (!tf.ok) { lines('🚫 ' + tf.why); }
      else if (tf.tactic.key !== tacticKey) { lines('🚫 ' + (TACTICS[land.key] ? TACTICS[land.key].name : '전술') + ' 밖에는 이 땅에서 쓸 전술이 없다'); }
      else { tac = tf.tactic; atk.tacticUsed = tac.key; lines(tac.emoji + ' ' + tac.name + ' — ' + tac.desc); }
    }
    if (tac && tac.key === 'fire') {
      var burn = Math.round(def.troops * 0.18 * 0.7);
      def.troops = Math.max(0, def.troops - burn);
      def.morale = (def.morale || 1) * 0.95;
      lines('🔥 불길이 번져 병사 ' + core.fmt(burn) + ' 이 타 죽거나 흩어졌다');
    }

    /* 성벽이 온전할수록 수비가 세다. 야전·수전이면 성벽을 못 쓴다 */
    var wallF = (sortie || water) ? land.def
      : land.def * (1 + (wallRef.wall / Math.max(1, wallRef.maxWall)) * 0.9);

    var ap = armyPower(atk);
    var dp = armyPower(def) * wallF;

    /* 명령 개입 — 공격 쪽이 내는 피해·받는 피해에 배율을 얹는다.
       'press'(돌격)는 더 베고 더 맞고, 'hold'(수비)는 둘 다 줄인다.
       cmd 가 없으면 둘 다 1 — 원래 fight() 계산과 완전히 같다 */
    var giveMul = 1, takeMul = 1;
    if (cmd === 'press') { giveMul = 1.2; takeMul = 1.1; }
    else if (cmd === 'hold') { giveMul = 0.85; takeMul = 0.75; }
    if (atk.grid && atk.grid.kind) { giveMul *= atk.grid.give; takeMul *= atk.grid.take; }   // 격자 전술판 보정(W-0108) — 판을 둔 뒤 남은 합에만, 안 두었으면 예전 그대로
    if (atk.fordNext) { giveMul *= 0.85; atk.fordNext = false; lines('🌊 강을 건넌 여파로 이번 합은 기세가 무디다'); }
    if (tac) {
      if (tac.key === 'ambush') { takeMul *= 0.85; }
      else if (tac.key === 'charge') { giveMul *= 1.25; atk.morale = Math.max(0.5, (atk.morale || 1) - 0.03); }
      else if (tac.key === 'ford') { giveMul *= 1.15; takeMul *= 0.9; atk.fordNext = true; }
    }

    /* 병력 손실은 **상대의 힘**에 비례한다.
       계수는 "힘이 엇비슷하면 열 합에 절반쯤 녹는다" 를 맞춘 값이다.
       (부대의 힘은 병력 × 0.85 남짓이므로 0.055 면 한 합에 6% 안팎이 된다) */
    var lossA = Math.round(dp * 0.055 * (0.85 + Math.random() * 0.3) * takeMul);
    var lossD = Math.round(ap * giveMul * 0.055 * (0.85 + Math.random() * 0.3));
    atk.troops = Math.max(0, atk.troops - lossA);
    def.troops = Math.max(0, def.troops - lossD);

    /* 공성추 — 성벽을 깎는다 (배로는 성벽을 못 깎는다) */
    if (!sortie && !water) {
      wallRef.wall = Math.max(0, Math.round(wallRef.wall - atk.troops * 0.045 * land.siege));
    }

    var frame = { atk: atk.troops, def: def.troops, wall: wallRef.wall,
      atkShips: atk.ships, defShips: def.ships };

    if (water) {
      /* 배도 함께 가라앉는다 — 잃은 병력 비율만큼 */
      atk.ships = sinkShips(atk.ships, lossA, atk.troops);
      def.ships = sinkShips(def.ships, lossD, def.troops);
      var fa = fireRoll(atk, def);
      if (fa) { lines('🔥 ' + fa); }
      var fd = fireRoll(def, atk);
      if (fd) { lines('🔥 ' + fd); }
      if (def.troops <= 0) { lines('🏳️ 수비 수군이 흩어졌다'); return { frame: frame, outcome: 'won' }; }
      if (atk.troops <= atk.start * ROUT) {
        lines('↩️ 공격군이 뱃머리를 돌렸다'); return { frame: frame, outcome: 'routed' };
      }
    }

    if (def.troops <= 0) { lines('🏳️ 수비군이 무너졌다'); return { frame: frame, outcome: 'won' }; }
    if (atk.troops <= atk.start * ROUT) {
      lines('↩️ 공격군이 물러났다'); return { frame: frame, outcome: 'routed' };
    }
    if (!sortie && wallRef.wall <= 0 && def.troops < atk.troops * 0.5) {
      lines('🧨 성문이 부서졌다 — 성이 떨어졌다'); return { frame: frame, outcome: 'won' };
    }
    /* 성벽이 남아도 지킬 사람이 없으면 성문은 열린다.
       이 줄이 없으면 수백 명이 남은 성이 온전한 성벽 뒤에서 몇 달을 버틴다 */
    if (!sortie && def.troops <= atk.troops * 0.08) {
      lines('🚪 지킬 군사가 남지 않아 성문이 열렸다'); return { frame: frame, outcome: 'won' };
    }
    if (sortie && def.troops < atk.troops * 0.25) {
      lines('🏳️ 수비군이 흩어졌다'); return { frame: frame, outcome: 'won' };
    }
    return { frame: frame, outcome: null };
  }

  /**
   * 한 달치 싸움.
   * @param wallRef {wall,maxWall} 를 가진 것 — 진짜 도시이거나, 가늠할 때는 그 사본
   * @param dry     가늠(forecast)이면 true — 일기토를 굴리지 않는다(장수가 진짜로 다친다)
   */
  function fight(atk, def, wallRef, toId, land, dry) {
    var log = [];
    var lines = function (s) { log.push(s); };
    var intro = fightIntro(atk, def, wallRef, toId, land, dry, lines);
    var water = intro.water, sortie = intro.sortie, du = intro.du;
    var leadA = intro.leadA, leadD = intro.leadD;
    var formA = intro.formA, formD = intro.formD;
    var mixA = intro.mixA, mixD = intro.mixD, mountA = intro.mountA, mountD = intro.mountD;

    var startWall = wallRef.wall;
    var r, won = false, routed = false;
    /* 실시간 재생용 — 매 합 끝의 병력·성벽을 남긴다. 판정에는 안 쓴다
       (battle3d.js 가 이 배열을 순서대로 재생할 뿐이다, 아래 return 참고) */
    var frames = [];
    for (r = 0; r < ROUNDS; r++) {
      var res = stepRound(atk, def, wallRef, toId, land, sortie, water, lines);
      frames.push(res.frame);
      if (res.outcome === 'won') { won = true; break; }
      if (res.outcome === 'routed') { routed = true; break; }
    }
    if (!won && !routed) { lines('🌒 날이 저물었다 — 이 달 안에는 못 떨어뜨렸다'); }

    lines('📉 잃은 병력 — 공 ' + core.fmt(atk.start - atk.troops) +
      ' · 수 ' + core.fmt(def.start - def.troops));
    if (startWall !== wallRef.wall) {
      lines('🧱 성벽 ' + core.fmt(startWall) + ' → ' + core.fmt(wallRef.wall));
    }
    if (water) {
      lines('🛶 남은 배 — 공 ' + (atk.ships || 0) + '척 · 수 ' + (def.ships || 0) + '척');
    }

    return {
      ok: true, won: won, routed: routed, duel: du, log: log,
      lossA: atk.start - atk.troops, lossD: def.start - def.troops,
      atkStart: atk.start, defStart: def.start,
      wallFrom: startWall, wallTo: wallRef.wall, sortie: sortie, water: water,
      leadA: leadA, leadD: leadD, formA: formA, formD: formD,
      mixA: mixA, mixD: mixD, mountA: mountA, mountD: mountD,
      /* 실시간 재생용(battle3d.js) — 판정과 무관, dry(가늠)면 안 쓰이니 그대로 둬도 된다 */
      frames: frames
    };
  }

  /**
   * 성을 뺏는다.
   * 수비 무장은 **달아나거나 · 잡히거나 · 재야로 흩어진다** — 그냥 사라지면
   * 그 세력의 사람이 판에서 조용히 지워져 등용할 거리가 줄어든다.
   */
  function capture(toId, newForce, atk, def, report) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var st = R.state();
    var to = R.city(toId);
    var oldForce = to.force;
    var i;

    /* "보스전"(README 여덟 축) — 성을 잃기 전, 그 성이 데리고 있던 수비 무장
       중 `boss:true` 가 있었는지 먼저 본다(아래서 이 사람들 자리가 옮겨지기
       전에 확인해야 한다). 새 전투 판정은 없다 — fight()/capture() 가 이미
       끝낸 결과에 보상만 얹는다. */
    var bossBeaten = null;
    for (i = 0; i < def.officers.length; i++) {
      var bh = off.find(def.officers[i]);
      if (bh && bh.boss) { bossBeaten = bh; break; }
    }

    var fled = [], caught = [];
    var refuge = null;
    var adj = CD.find(toId).adj;
    for (i = 0; i < adj.length; i++) {
      var a = R.city(adj[i]);
      if (a && a.force === oldForce) { refuge = adj[i]; break; }
    }

    for (i = 0; i < def.officers.length; i++) {
      var id = def.officers[i];
      var isLord = off.lordOf(oldForce) === id;
      if (refuge && (isLord || Math.random() < 0.6)) {
        off.placeAt(id, refuge, oldForce);
        fled.push(id);
      } else {
        /* 사로잡힌다 — 세력에서 떨어져 나와 이 성에 갇힌다 */
        off.placeAt(id, toId, null);
        off.rec(id).found = true;
        off.rec(id).loyal = 0;
        st.captives[id] = toId;
        caught.push(id);
      }
    }

    to.force = newForce;
    to.troops = atk.troops;
    /* 배 — 수전으로 들어갔으면 남은 배끼리 합친다(수비 배를 통째로 뺏는다).
       뭍으로 들어갔으면 성에 매인 배가 그대로 새 주인에게 간다 */
    to.ships = (atk.water ? (def.ships || 0) : (to.ships || 0)) + (atk.ships || 0);
    to.gov = atk.officers.length ? atk.officers[0] : null;
    to.sec = Math.max(10, Math.round(to.sec * 0.5));      // 갓 뺏은 성은 어수선하다
    to.train = atk.train;
    /* 데려간 장수는 그 성에 남는다 (진영에서 들어왔으면 그 표시를 뗀다) */
    for (i = 0; i < atk.officers.length; i++) {
      off.rec(atk.officers[i]).camp = null;
      off.placeAt(atk.officers[i], toId, newForce);
      off.rec(atk.officers[i]).feats += 3;
      off.addLoyal(atk.officers[i], 3);
      off.gainExp(atk.officers[i], off.EXP.win);
    }

    report.taken = toId;
    report.fled = fled;
    report.caught = caught;
    report.log.push('🚩 ' + CD.find(toId).name + ' 함락! ' + R.forceName(newForce) + ' 의 깃발이 올랐다');
    if (caught.length) {
      report.log.push('⛓️ 사로잡음 — ' + caught.map(function (x) { return off.find(x).name; }).join(', '));
    }
    if (fled.length) {
      report.log.push('🏃 달아남 — ' + fled.map(function (x) { return off.find(x).name; }).join(', '));
    }
    core.log('🚩 ' + CD.find(toId).name + ' 함락 — ' + R.forceName(newForce), 'good');

    if (bossBeaten) {
      var bf = R.force(newForce);
      var bonusGold = 600;
      if (bf) { bf.gold += bonusGold; }
      if (ID && atk.officers.length) {
        var boid = atk.officers[Math.floor(Math.random() * atk.officers.length)];
        var bit = ID.randomItem();
        off.equip(boid, bit.id);
        var bh2 = off.find(boid);
        report.log.push('👑 ' + bossBeaten.name + '(' + bossBeaten.faction + ') 을(를) 꺾었다! 금 ' +
          core.fmt(bonusGold) + ' · ' + bit.emoji + bit.name + ' → ' + (bh2 ? bh2.name : boid));
      } else {
        report.log.push('👑 ' + bossBeaten.name + '(' + bossBeaten.faction + ') 을(를) 꺾었다! 금 ' + core.fmt(bonusGold));
      }
      core.log('👑 보스급 수비 무장 ' + bossBeaten.name + ' 을(를) 꺾었다 — ' + R.forceName(newForce), 'good');
    }

    /* "탐험"(README 여덟 축, 2026-09-10) — 표시해 둔 랜드마크 성을 **처음**
       함락하면 한 번뿐인 발견 보상을 준다(재정복은 해당 없다 — 이미
       발견된 곳이다). 새 판정이 아니라 capture() 가 이미 끝낸 결과에
       보상만 더한다(보스전과 같은 결).
       2026-09-11 — "유물 시스템을 깊게 판다"는 방향으로, 금뿐이던 발견
       보상에 보스전과 같은 결로 유물 하나를 더했다(위 `bossBeaten` 블록을
       그대로 본떴다 — 새 판정 없이 이미 있는 `ID.randomItem()`/`off.equip()`
       를 한 번 더 부를 뿐). 균열·폐허·묘역처럼 landmark 이자 boss 이기도
       한 성(jongmal·pyedo·myomun)은 두 유물을 다 받는다 — 원래도 두
       보상 블록이 독립적으로 실행되던 것과 같은 결이라 새 겹침이 아니다. */
    var cityDef = CD.find(toId);
    if (cityDef && cityDef.landmark) {
      st.discovered = st.discovered || {};
      if (!st.discovered[toId]) {
        st.discovered[toId] = true;
        var lf = R.force(newForce);
        var landGold = 1000;
        if (lf) { lf.gold += landGold; }
        var landLine = '🗺️ 처음 밟는 땅 — ' + cityDef.name + '(' + cityDef.hanja + ') 발견! 금 ' + core.fmt(landGold);
        if (ID && atk.officers.length) {
          var loid = atk.officers[Math.floor(Math.random() * atk.officers.length)];
          var lit = ID.randomItem();
          off.equip(loid, lit.id);
          var lh = off.find(loid);
          landLine += ' · ' + lit.emoji + lit.name + ' → ' + (lh ? lh.name : loid);
        }
        report.log.push(landLine);
        core.log('🗺️ ' + cityDef.name + ' 을(를) 처음으로 밟았다 — ' + R.forceName(newForce), 'good');
        core.emit('rtk:discover', { city: toId, force: newForce });
      }
    }

    /* 세력이 통째로 지워졌는가 — 주인 없던 성(한국 지역 등, oldForce===null)을
       처음 뺏는 것은 "멸망"이 아니다. 그 성은 애초에 세력이 아니었다 */
    if (oldForce && !R.citiesOf(oldForce).length) {
      core.log('🏳️ ' + R.forceName(oldForce) + ' 이(가) 멸망했다', 'warn');
      core.emit('rtk:fallen', oldForce);
    }
    R.checkResult();
  }

  /**
   * 쳐 보면 어찌 될까 — **진짜 전투식을 그대로** 굴려 본다.
   *
   * AI 가 "성벽 × 지형 × 병력" 같은 어림식으로 승산을 재게 두면 판정이 두 벌이 되고,
   * 그 두 벌이 어긋나는 만큼 판이 얼거나 터진다. 실제로 겪었다 —
   * 어림식이 **성벽 초깃값**으로만 재는 바람에 공성 중 성벽이 깎이는 것을 못 보고
   * 120개월에 다섯 번밖에 안 싸웠다. 여기서는 사본을 놓고 같은 함수를 돌린다.
   *
   * 판이 흔들리지 않게 일기토는 굴리지 않고(dry), 도시도 손대지 않는다.
   */
  function forecast(fromId, toId, officerIds, troops) {
    var R = global.DG.rtk;
    var from = R.city(fromId), to = R.city(toId);
    if (!from || !to) { return null; }
    var land = CD.landOf(toId);
    var wallRef = { wall: to.wall, maxWall: to.maxWall };
    var defTroops = to.troops + reliefOf(toId);
    var water = CD.isWater(fromId, toId);
    var atk = {
      troops: troops, start: troops, train: from.train, tech: from.tech,
      officers: officerIds, morale: 1,
      water: water, ships: water ? Math.ceil(troops / SHIP_CREW) : 0
    };
    var def = {
      troops: defTroops, start: defTroops, train: to.train, tech: to.tech,
      officers: global.DG.off.atCity(toId, to.force).map(function (h) { return h.id; }),
      morale: 1, water: water, ships: water ? (to.ships || 0) : 0
    };
    var rep = fight(atk, def, wallRef, toId, land, true);
    return { won: rep.won, routed: rep.routed, lossA: rep.lossA, lossD: rep.lossD,
             wallTo: wallRef.wall, defTroops: defTroops, water: water };
  }

  /* ── 우리 성끼리 ──────────────────────────────────────── */

  /** 병력·군량을 이웃한 우리 성으로 보낸다 */
  function transfer(fromId, toId, troops, food) {
    var R = global.DG.rtk;
    var from = R.city(fromId), to = R.city(toId);
    if (!from || !to) { return { ok: false, why: '없는 성' }; }
    if (from.force !== to.force) { return { ok: false, why: '우리 성이 아닙니다' }; }
    if (CD.find(fromId).adj.indexOf(toId) < 0) { return { ok: false, why: '맞닿아 있지 않습니다' }; }
    troops = Math.max(0, Math.round(troops || 0));
    food = Math.max(0, Math.round(food || 0));
    if (troops > from.troops || food > from.food) { return { ok: false, why: '보낼 것이 모자랍니다' }; }
    from.troops -= troops; to.troops += troops;
    from.food -= food; to.food += food;
    core.emit('changed');
    return { ok: true, troops: troops, food: food };
  }

  /** 무장을 이웃한 우리 성으로 옮긴다 (그 달의 명령을 쓴다) */
  function moveOfficer(officerId, toId) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var r = off.rec(officerId);
    var from = R.city(r.city), to = R.city(toId);
    if (!from || !to) { return { ok: false, why: '없는 성' }; }
    if (to.force !== r.force) { return { ok: false, why: '우리 성이 아닙니다' }; }
    if (CD.find(r.city).adj.indexOf(toId) < 0) { return { ok: false, why: '맞닿아 있지 않습니다' }; }
    if (r.done) { return { ok: false, why: '이 달에 이미 명령을 썼습니다' }; }
    if (from.gov === officerId) { from.gov = null; }
    r.city = toId; r.done = true;
    core.emit('changed');
    return { ok: true };
  }

  /* ── 여러 달에 걸치는 원정 ───────────────────────────── */

  /**
   * 진(陣)을 친다 — 원정이 다음 달로 이어진다.
   * 병력도 장수도 성으로 돌아가지 않는다. `off.rec(id).camp` 가 붙는 동안
   * 그 사람은 **성에 없는 사람**이라 내정도 못 하고 수비에도 안 선다.
   */
  function encamp(fromId, toId, atk, baggage, report) {
    var R = global.DG.rtk, off = global.DG.off;
    var st = R.state();
    st.campSeq = (st.campSeq || 0) + 1;
    var cp = {
      id: 'camp' + st.campSeq,
      force: atk.force, from: fromId, to: toId,
      troops: atk.troops, officers: atk.officers.slice(),
      train: atk.train, tech: atk.tech, morale: atk.morale,
      water: !!atk.water, ships: atk.ships || 0,
      food: baggage, months: 1
    };
    camps().push(cp);
    for (var i = 0; i < cp.officers.length; i++) { off.rec(cp.officers[i]).camp = cp.id; }
    report.log.push('🏕️ 물러나지 않고 성 밖에 진을 쳤다 — 치중 ' + core.fmt(cp.food) +
      ' (' + monthsLeft(cp) + '달치)');
    core.log('🏕️ ' + R.forceName(cp.force) + ' 이(가) ' + CD.find(toId).name +
      ' 을(를) 에워쌌다', 'info');
    core.emit('rtk:camp', { kind: 'set', camp: cp.id, to: toId, force: cp.force });
    return cp;
  }

  /** 진영을 목록에서 뺀다 — 장수에 붙은 표시도 함께 뗀다 */
  function drop(cp) {
    var off = global.DG.off, list = camps(), i = list.indexOf(cp);
    if (i >= 0) { list.splice(i, 1); }
    for (i = 0; i < cp.officers.length; i++) { off.rec(cp.officers[i]).camp = null; }
  }

  /** 물러날 곳 — 출진한 성이 아직 우리 것이면 그리로, 아니면 가장 가까운 우리 성 */
  function homeFor(cp) {
    var R = global.DG.rtk;
    var from = R.city(cp.from);
    if (from && from.force === cp.force) { return cp.from; }
    var mine = R.citiesOf(cp.force), best = null, bd = 1e9, i, d;
    for (i = 0; i < mine.length; i++) {
      d = CD.hops(cp.to, mine[i]);
      if (d >= 0 && d < bd) { bd = d; best = mine[i]; }
    }
    return best;
  }

  /** 포위를 푼다 */
  function retreat(cp, why) {
    var R = global.DG.rtk, off = global.DG.off;
    var home = homeFor(cp);
    if (!home) { return disband(cp); }
    var h = R.city(home), i;
    h.troops += cp.troops; h.food += cp.food; h.ships = (h.ships || 0) + (cp.ships || 0);
    for (i = 0; i < cp.officers.length; i++) {
      off.placeAt(cp.officers[i], home, cp.force);
      off.addLoyal(cp.officers[i], -2);
    }
    drop(cp);
    core.log('↩️ ' + R.forceName(cp.force) + ' 이(가) ' + CD.find(cp.to).name +
      ' 의 포위를 풀었다 — ' + why + ' ' + CD.find(home).name + ' 으로 물러났다', 'warn');
    core.emit('rtk:camp', { kind: 'retreat', camp: cp.id, to: cp.to, home: home, why: why });
    return { ok: true, kind: 'retreat', campId: cp.id, to: cp.to, home: home, why: why };
  }

  /** 그 사이 우리 깃발이 올랐다 (동맹이 뺏었거나 계략이 통했거나) — 그대로 들어간다 */
  function enterCity(cp) {
    var R = global.DG.rtk, off = global.DG.off;
    var to = R.city(cp.to), i;
    to.troops += cp.troops; to.food += cp.food; to.ships = (to.ships || 0) + (cp.ships || 0);
    for (i = 0; i < cp.officers.length; i++) {
      off.placeAt(cp.officers[i], cp.to, cp.force);
    }
    drop(cp);
    core.log('🚩 ' + CD.find(cp.to).name + ' 에 이미 우리 깃발이 올라 그대로 입성했다', 'good');
    core.emit('rtk:camp', { kind: 'enter', camp: cp.id, to: cp.to });
    return { ok: true, kind: 'enter', campId: cp.id, to: cp.to };
  }

  /**
   * 돌아갈 나라가 사라졌다 — 원정군이 그 자리에서 흩어진다.
   * 장수는 **사로잡힌 것으로 둔다**. 그냥 지우면 판에서 사람이 조용히 사라진다
   * (성이 떨어질 때 수비 무장을 흩는 것과 같은 까닭이다).
   */
  function disband(cp) {
    var R = global.DG.rtk, off = global.DG.off, st = R.state(), i, id;
    for (i = 0; i < cp.officers.length; i++) {
      id = cp.officers[i];
      off.placeAt(id, cp.to, null);
      off.rec(id).found = true;
      off.rec(id).loyal = 0;
      st.captives[id] = cp.to;
    }
    drop(cp);
    core.log('🏳️ 돌아갈 곳을 잃은 원정군이 ' + CD.find(cp.to).name + ' 앞에서 흩어졌다', 'warn');
    core.emit('rtk:camp', { kind: 'disband', camp: cp.id, to: cp.to });
    return { ok: true, kind: 'disband', campId: cp.id, to: cp.to };
  }

  /** 일기토에서 다친 장수는 진을 떠나 돌아간다 */
  function sendHomeHurt(cp, was) {
    var off = global.DG.off, home = homeFor(cp), i;
    for (i = 0; i < was.length; i++) {
      if (cp.officers.indexOf(was[i]) >= 0) { continue; }
      off.rec(was[i]).camp = null;
      if (home) { off.placeAt(was[i], home, cp.force); }
    }
  }

  /**
   * 보급 — 진영에 병력과 치중을 보낸다.
   * 보내는 곳은 **그 진영과 맞닿은 우리 성**이다. 이것이 있어야 원정이 두 달을 넘긴다
   * (출진할 때 들고 나가는 군량이 두 달치라 보급이 없으면 거기서 끝난다).
   */
  function supply(campId, troops, food, fromId) {
    var R = global.DG.rtk;
    var cp = campById(campId);
    if (!cp) { return { ok: false, why: '없는 진영입니다' }; }
    fromId = fromId || cp.from;
    var from = R.city(fromId);
    if (!from || from.force !== cp.force) { return { ok: false, why: '우리 성이 아닙니다' }; }
    if (CD.find(fromId).adj.indexOf(cp.to) < 0) {
      return { ok: false, why: '진영과 맞닿아 있지 않습니다' };
    }
    troops = Math.max(0, Math.round(troops || 0));
    food = Math.max(0, Math.round(food || 0));
    if (troops > from.troops || food > from.food) { return { ok: false, why: '보낼 것이 모자랍니다' }; }
    if (!troops && !food) { return { ok: false, why: '보낼 것이 없습니다' }; }
    /* 물 위의 진영은 **배에 타는 만큼만** 늘어난다 */
    if (cp.water && troops > 0) {
      var room = Math.max(0, (cp.ships || 0) * SHIP_CREW - cp.troops);
      if (troops > room) {
        return { ok: false, why: '배가 모자랍니다 (' + (cp.ships || 0) + '척에 ' +
          core.fmt(room) + '명 더 탑니다)' };
      }
    }
    from.troops -= troops; from.food -= food;
    /* 갓 온 병사가 섞이면 훈련도가 내려간다 — 성에서 징병할 때와 같다 */
    if (troops > 0 && cp.troops + troops > 0) {
      cp.train = Math.round((cp.train * cp.troops + from.train * troops) / (cp.troops + troops));
    }
    cp.troops += troops; cp.food += food;
    core.emit('changed');
    core.persist();
    return { ok: true, troops: troops, food: food, left: monthsLeft(cp) };
  }

  /** 사람이 스스로 포위를 푼다 */
  function withdraw(campId) {
    var cp = campById(campId);
    if (!cp) { return { ok: false, why: '없는 진영입니다' }; }
    var res = retreat(cp, '스스로 군을 거두어');
    core.emit('changed');
    core.persist();
    return res;
  }

  /**
   * 진영 하나의 한 달.
   * **march 와 같은 `fight()` 를 쓴다** — 여기에만 있는 판정을 만들면 판정이 두 벌이 된다.
   */
  function resolveCamp(cp) {
    var R = global.DG.rtk, off = global.DG.off;
    var to = R.city(cp.to);
    if (!to) { drop(cp); return null; }

    if (!R.citiesOf(cp.force).length) { return disband(cp); }
    if (to.force === cp.force) { return enterCity(cp); }
    if (global.DG.diplo && global.DG.diplo.blocked(cp.force, to.force)) {
      return retreat(cp, '맹약이 맺어져');
    }

    /* 치중 — 한 달치를 먹는다.
       한 달치를 못 채우면 **굶어 흩어지기 전에 군을 돌린다.** 성처럼
       모자란 만큼을 그대로 병사에서 깎으면(settleMonth 의 식) 치중이 떨어지는
       그 달에 원정군이 통째로 사라진다 — 성은 물러날 데가 없지만 진영은 있다. */
    var eat = Math.round(cp.troops / 1000 * R.FOOD_PER_1000);
    if (cp.food < eat) {
      var lost = Math.round(cp.troops * 0.2);
      cp.troops = Math.max(0, cp.troops - lost);
      cp.food = 0;
      if (lost > 0) {
        core.log('🍚 ' + CD.find(cp.to).name + ' 진중 — 군량이 떨어져 병사 ' +
          core.fmt(lost) + ' 이 흩어졌다', 'warn');
      }
      return retreat(cp, '군량이 떨어져');
    }
    cp.food -= eat;

    /* 진이 길어질수록 사기가 깎인다 */
    cp.morale *= CAMP_DECAY;
    if (cp.morale < CAMP_QUIT || cp.troops < CAMP_MIN) { return retreat(cp, '군이 지쳐'); }

    var relief = reinforce(cp.to);
    var was = cp.officers.slice();
    var land = CD.landOf(cp.to);
    var atk = {
      side: 'atk', force: cp.force, troops: cp.troops, start: cp.troops,
      train: cp.train, tech: cp.tech, officers: cp.officers, morale: cp.morale,
      water: !!cp.water, ships: cp.ships || 0
    };
    var def = {
      side: 'def', force: to.force, troops: to.troops, start: to.troops,
      train: to.train, tech: to.tech,
      officers: off.atCity(cp.to, to.force).map(function (h) { return h.id; }), morale: 1,
      water: !!cp.water, ships: cp.water ? (to.ships || 0) : 0
    };

    off.gainExpAll(cp.officers, off.EXP.siege);

    var report = fight(atk, def, to, cp.to, land, false);
    report.from = cp.from; report.to = cp.to; report.relief = relief;
    report.force = cp.force; report.defForce = def.force;
    report.campId = cp.id; report.siege = true; report.months = cp.months;
    report.log.splice(1, 0, '🏕️ ' + cp.months + '달째 에워싸고 있다 — 사기 ' +
      Math.round(cp.morale * 100) + ' · 치중 ' + core.fmt(cp.food) +
      ' (' + monthsLeft(cp) + '달치)');
    if (relief > 0) {
      report.log.splice(2, 0, '🚩 이웃 성에서 구원군 ' + core.fmt(relief) + ' 이 들어왔다');
    }

    cp.troops = atk.troops; cp.morale = atk.morale; cp.ships = atk.ships || 0;
    sendHomeHurt(cp, was);

    if (report.won) {
      to.food += cp.food;
      capture(cp.to, cp.force, atk, def, report);
      drop(cp);
    } else if (report.routed) {
      to.troops = def.troops;
      if (cp.water) { to.ships = def.ships; }
      retreat(cp, '공격군이 무너져');
    } else {
      to.troops = def.troops;
      if (cp.water) { to.ships = def.ships; }
      cp.months += 1;
    }
    core.emit('rtk:battle', report);
    return report;
  }

  /**
   * endMonth 가 부른다 — 서 있는 진영이 저마다 한 달을 더 산다.
   * 목록을 **베껴 두고** 돈다 — 도중에 함락·철군으로 목록이 줄기 때문이다.
   */
  function resolveAll() {
    var list = camps().slice(), out = [], i, r;
    for (i = 0; i < list.length; i++) {
      r = resolveCamp(list[i]);
      if (r) { out.push(r); }
    }
    if (out.length) { core.emit('changed'); core.persist(); }
    return out.length ? out : null;
  }

  /* ── 원정 (여러 달에 걸친 실시간 이동, 2026-09-04) ───────────────────
   * 위 "진영(camp, 陣)"은 **친 뒤 못 떨어뜨려 눌러앉은 상태**다. 여기 원정은
   * **치기 전, 국경까지 오가는 중인 상태** — 서로 다른 것이다(화면 문구도
   * 갈랐다, `ui-rtk.js` 참고. 내부 변수·주석에 남은 옛 "원정"(camp 쪽)은
   * 그대로 둔다 — 뜻은 늘 문맥으로 갈렸었고, 굳이 다 갈아엎지 않는다).
   *
   * 출진(march)은 "인접한 성 하나로 그 자리에서" 만 붙는 구조를 그대로 둔다
   * (개입형 전투가 설 자리를 지키려고). 원정은 그 앞에 얹는 상위 명령이다 —
   * **내 땅·주인 없는 빈 땅만 거쳐**(`CD.path`, 물길은 뺀다) 먼 성 앞까지
   * 병력을 여러 달에 걸쳐 옮기고, 국경(경로의 마지막 통과 칸)에 닿으면 그
   * 마지막 한 걸음은 지금의 `march()` 를 그대로 쓴다 — **새 판정을 만들지
   * 않는다.**
   */

  /**
   * 원정 도중 사건(PLAN §16 "랜덤 이벤트", README 로드맵 Phase 9) — `rtk.js`의
   * `DISASTERS`(성마다 달마다 굴리는 재해)와 같은 결의 표를 원정군에 얹는다.
   * **새 판정을 만들지 않는다** — 국경 도착(`arriveJourney`)의 전투는 여전히
   * `fight()` 한 곳뿐이고, 이 표는 그 전 "가는 길"에서만 원정 상태(`troops`·
   * `morale`·`monthsTotal`)와 진영 금고(`gold`)를 살짝 흔든다.
   */
  var JOURNEY_EVENTS = [
    { key: 'ambush',   name: '매복',      emoji: '⚔️', troopsMul: 0.92,
      text: '숲 그늘에서 매복을 만나 병사를 잃었다.' },
    { key: 'bandit',   name: '도적떼',    emoji: '🏴', goldDelta: -300,
      text: '지나던 도적떼에게 노잣돈을 뜯겼다.' },
    { key: 'treasure', name: '보물 발견', emoji: '💰', goldDelta: 400, good: true,
      text: '길가 옛 무덤에서 부장품을 찾아냈다.' },
    { key: 'village',  name: '마을의 환대', emoji: '🏘️', moraleDelta: 0.05, good: true,
      text: '마을 사람들이 술과 밥을 내어 사기가 올랐다.' },
    { key: 'lost',     name: '길 잃음',   emoji: '🌫️', delayMonths: 1,
      text: '안개 속에서 길을 잃어 하루를 더 걷는다.' },
    /* 2026-09-09 — 원작의 "보물" 을 원정 사건에 얹었다
       (data-item.js). 장비창은 없다 — 원정 간 장수 중 하나가 곧바로 씌운다 */
    { key: 'relic',    name: '유물 발견', emoji: '🏺', grantItem: true, good: true,
      text: '옛 무덤에서 나온 물건을 장수 하나가 챙겼다.' },
    /* 2026-09-11 — 균열·폐허(균열/폐허 두 확장 지역, PLAN 26-4절 "완전
       퓨전" 방향)를 만들고 나서 "지역 콘텐츠"뿐 아니라 판 전체에 걸치는
       축 하나를 더했다. 시간이 뒤섞인다는 그 지역의 설정이 원정 중
       아무 데서나(균열 근처가 아니어도) 새어 나온다는 발상 — `lost`
       (길 잃음, +1달)의 정반대다. `delayMonths` 가 처음으로 음수를
       받는 경우라 아래 clamp(elapsed+1 미만으로는 안 줄어든다)를 같이 뒀다 */
    { key: 'timeRift', name: '시간 뒤틀림', emoji: '⏳', delayMonths: -1, good: true,
      text: '길이 갑자기 접혔다 — 균열의 여파인지, 여정이 하루 앞당겨졌다.' }
  ];

  /** 원정 하나가 이번 달 사건을 만나는가 — `rollDisasters()` 와 같은 확률 손잡이 결 */
  function rollJourneyEvent(j) {
    if (Math.random() > core.tuned('war.journeyEventChance', 0.16)) { return null; }
    var e = JOURNEY_EVENTS[Math.floor(Math.random() * JOURNEY_EVENTS.length)];
    var R = global.DG.rtk, off = global.DG.off, f = R.force(j.force);
    var text = e.text;
    if (e.troopsMul) { j.troops = Math.max(1, Math.round(j.troops * e.troopsMul)); }
    if (e.goldDelta && f) { f.gold = Math.max(0, f.gold + e.goldDelta); }
    if (e.moraleDelta) { j.morale = Math.max(0.5, Math.min(1.5, (j.morale || 1) + e.moraleDelta)); }
    if (e.delayMonths) { j.monthsTotal = Math.max((j.monthsElapsed || 0) + 1, j.monthsTotal + e.delayMonths); }
    if (e.grantItem && ID && off && j.officers.length) {
      var oid = j.officers[Math.floor(Math.random() * j.officers.length)];
      var it = ID.randomItem();
      off.equip(oid, it.id);
      var h = off.find(oid);
      text += ' (' + it.emoji + it.name + ' → ' + (h ? h.name : oid) + ')';
    }
    j.lastEvent = { key: e.key, emoji: e.emoji, text: text, good: !!e.good };
    core.log(e.emoji + ' ' + R.forceName(j.force) + ' 원정군 — ' + text, e.good ? 'good' : 'warn');
    core.emit('rtk:journeyEvent', { id: j.id, force: j.force, key: e.key });
    return e;
  }

  function journeys() {
    var st = global.DG.rtk.state();
    if (!st.journeys) { st.journeys = []; }
    return st.journeys;
  }

  function journeysOf(forceId) {
    var list = journeys(), out = [], i;
    for (i = 0; i < list.length; i++) { if (list[i].force === forceId) { out.push(list[i]); } }
    return out;
  }

  function journeyById(id) {
    var list = journeys(), i;
    for (i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }

  /** 그 성이 지금 원정의 통행로로 쓸 수 있는가 — 내 성이거나 주인 없음 */
  function journeyPassable(cityId, forceId) {
    var c = global.DG.rtk.city(cityId);
    return !!c && (c.force === forceId || c.force === null);
  }

  /** 원정을 시작할 수 있는가 — `canMarch` 와 달리 **인접일 필요가 없다**,
   *  대신 통과할 수 있는 땅만으로 이어지는 `CD.path` 가 있어야 한다. */
  function canJourney(fromId, toId, troops) {
    var R = global.DG.rtk;
    var from = R.city(fromId), to = R.city(toId);
    if (!from || !to) { return { ok: false, why: '없는 성' }; }
    if (from.force === to.force) { return { ok: false, why: '우리 성입니다' }; }
    if (troops > from.troops) { return { ok: false, why: '병력이 모자랍니다' }; }
    if (troops < 500) { return { ok: false, why: '오백은 넘겨야 군대라 하지요' }; }
    /* 원정 군량 — march 와 같은 공식(두 달치)을 그대로 쓴다. 남은 여러 달은
       실려 가는 도중 소모하지 않고 국경에 닿아서야 성에 그대로 부린다(v1
       단순화 — 도중 보급·아사는 범위 밖, camp 쪽만 그 사정을 진다) */
    var need = Math.round(troops / 1000 * R.FOOD_PER_1000 * 2);
    if (from.food < need) { return { ok: false, why: '군량이 모자랍니다 (' + core.fmt(need) + ' 필요)' }; }
    if (global.DG.diplo && global.DG.diplo.blocked(from.force, to.force)) {
      return { ok: false, why: '맹약이 있어 칠 수 없습니다' };
    }
    var myForce = from.force;
    var p = CD.path(fromId, toId, function (cid) { return journeyPassable(cid, myForce); });
    if (!p) { return { ok: false, why: '갈 수 있는 길이 없습니다 (남의 땅에 막혔습니다)' }; }
    return { ok: true, food: need, path: p, months: CD.pathMonths(p) };
  }

  /**
   * 원정을 보낸다. `march()` 처럼 그 자리에서 붙지 않는다 — `chk.months` 달
   * 뒤에야 국경에 닿고, 그때 가서 `resolveJourneys()` 가 `march()` 를 부른다.
   */
  function startJourney(fromId, toId, officerIds, troops) {
    var R = global.DG.rtk, off = global.DG.off;
    var chk = canJourney(fromId, toId, troops);
    if (!chk.ok) { return chk; }

    var from = R.city(fromId), i, valid = [];
    for (i = 0; i < officerIds.length; i++) {
      var r = off.rec(officerIds[i]);
      if (r.city === fromId && r.force === from.force && !r.hurt && !r.camp && !r.journey) {
        valid.push(officerIds[i]);
      }
    }
    if (!valid.length) { return { ok: false, why: '데려갈 장수가 없습니다' }; }

    from.troops -= troops;
    from.food -= chk.food;

    var st = R.state();
    st.journeySeq = (st.journeySeq || 0) + 1;
    var j = {
      id: 'journey' + st.journeySeq, force: from.force, from: fromId, to: toId,
      path: chk.path, troops: troops, officers: valid.slice(),
      train: from.train, tech: from.tech, morale: 1, food: chk.food,
      monthsTotal: chk.months, monthsElapsed: 0
    };
    journeys().push(j);
    for (i = 0; i < valid.length; i++) { off.rec(valid[i]).journey = j.id; }
    off.gainExpAll(valid, off.EXP.march);

    core.log('🚩 ' + R.forceName(j.force) + ' 이(가) ' + CD.find(toId).name +
      ' 을(를) 향해 원정을 떠났다 (' + j.monthsTotal + '달 예상)', 'info');
    core.emit('rtk:journey', { kind: 'start', id: j.id, force: j.force, from: fromId, to: toId, months: j.monthsTotal });
    core.emit('changed');
    core.persist();
    return { ok: true, id: j.id, months: j.monthsTotal };
  }

  /** 원정을 목록에서 뺀다 — 장수에 붙은 표시도 함께 뗀다 */
  function dropJourney(j) {
    var off = global.DG.off, list = journeys(), i = list.indexOf(j);
    if (i >= 0) { list.splice(i, 1); }
    for (i = 0; i < j.officers.length; i++) { off.rec(j.officers[i]).journey = null; }
  }

  /** 물러날 곳 — 떠난 성이 아직 우리 것이면 그리로, 아니면 가장 가까운 우리 성
   *  (camp 의 `homeFor()` 와 같은 요령) */
  function homeForJourney(j) {
    var R = global.DG.rtk;
    var from = R.city(j.from);
    if (from && from.force === j.force) { return j.from; }
    var mine = R.citiesOf(j.force), best = null, bd = 1e9, i, d;
    for (i = 0; i < mine.length; i++) {
      d = CD.hops(j.from, mine[i]);
      if (d >= 0 && d < bd) { bd = d; best = mine[i]; }
    }
    return best;
  }

  /** 경로가 도중에 끊겼다(중간 성이 남의 손에 넘어갔다) — 되돌아간다.
   *  돌아갈 나라마저 없으면 camp 의 `disband()` 와 같은 꼴로 그 자리에서
   *  흩어진다(장수는 사로잡힌 것으로 둔다 — 조용히 지우지 않는다). */
  function retreatJourney(j, why) {
    var R = global.DG.rtk, off = global.DG.off;
    var home = homeForJourney(j);
    var i;
    if (!home) {
      for (i = 0; i < j.officers.length; i++) {
        off.placeAt(j.officers[i], j.from, null);
        off.rec(j.officers[i]).found = true;
        off.rec(j.officers[i]).loyal = 0;
        R.state().captives[j.officers[i]] = j.from;
      }
      dropJourney(j);
      core.log('🏳️ 돌아갈 곳을 잃은 원정군이 ' + CD.find(j.from).name + ' 앞에서 흩어졌다', 'warn');
      core.emit('rtk:journey', { kind: 'disband', id: j.id, force: j.force, to: j.from });
      return;
    }
    var h = R.city(home);
    h.troops += j.troops; h.food += j.food;
    for (i = 0; i < j.officers.length; i++) {
      off.placeAt(j.officers[i], home, j.force);
      off.addLoyal(j.officers[i], -2);
    }
    dropJourney(j);
    core.log('🔙 ' + R.forceName(j.force) + ' 의 원정이 ' + why + ' — ' +
      CD.find(home).name + ' 으로 물러났다', 'warn');
    core.emit('rtk:journey', { kind: 'retreat', id: j.id, force: j.force, home: home });
  }

  /**
   * 국경에 닿았다 — 목적지를 곧바로 친다.
   *
   * **`march()` 를 부르지 않는다.** `march()`는 "내가 가진 성에서" 병력을
   * 차출하는 구조라 국경 마지막 칸(경로의 두 번째 끝, "거점")이 있어야
   * 하는데, 원정의 흔한 그림 — 주인 없는 빈 땅만 거쳐 목적지까지 가는 것
   * — 에서는 그 거점이 애초에 내 성이 아니다(주인 없는 땅). 대신 `camp`
   * (진영)의 `resolveCamp()` 와 **같은 요령**을 쓴다 — 원정군 스스로의
   * 병력·장수(어느 성에도 안 속한다)로 `fight()` 에 직접 붙고, 결과에 따라
   * `capture()`(함락) · 물러남(`retreatJourney`) · `encamp()`(못 떨어뜨려
   * 그 자리에 진을 침 — 이러면 다음 달부터는 평범한 진영으로 이어진다)
   * 셋 중 하나로 갈린다. **판정은 fight() 한 곳뿐이다.**
   */
  function arriveJourney(j) {
    var R = global.DG.rtk, off = global.DG.off, i;
    var to = R.city(j.to);
    if (!to) { dropJourney(j); return; }

    if (to.force === j.force) {
      /* 이미 우리 성이 됐다(동맹이 먼저 먹었거나 자기 성이 됐거나) — 싸움
         없이 그대로 합류한다 */
      to.troops += j.troops;
      to.food += j.food;
      for (i = 0; i < j.officers.length; i++) { off.placeAt(j.officers[i], j.to, j.force); }
      core.log('🚩 ' + CD.find(j.to).name + ' 에 이미 우리 깃발이 있어 원정군이 그대로 합류했다', 'good');
      dropJourney(j);
      core.emit('rtk:journey', { kind: 'join', id: j.id, force: j.force, to: j.to });
      return;
    }

    if (global.DG.diplo && global.DG.diplo.blocked(j.force, to.force)) {
      retreatJourney(j, '맹약이 맺어져 칠 수 없어');
      return;
    }

    var relief = reinforce(j.to);
    var land = CD.landOf(j.to);
    var atk = {
      side: 'atk', force: j.force, troops: j.troops, start: j.troops,
      train: j.train, tech: j.tech, officers: j.officers.slice(), morale: j.morale,
      water: false, ships: 0
    };
    var def = {
      side: 'def', force: to.force, troops: to.troops, start: to.troops,
      train: to.train, tech: to.tech,
      officers: off.atCity(j.to, to.force).map(function (h) { return h.id; }), morale: 1,
      water: false, ships: 0
    };
    off.gainExpAll(j.officers, off.EXP.march);

    var report = fight(atk, def, to, j.to, land, false);
    report.from = j.from; report.to = j.to; report.relief = relief;
    report.force = j.force; report.defForce = def.force; report.journeyId = j.id;
    if (relief > 0) { report.log.splice(1, 0, '🚩 이웃 성에서 구원군 ' + core.fmt(relief) + ' 이 들어왔다'); }

    if (report.won) {
      dropJourney(j);
      to.food += j.food;
      capture(j.to, j.force, atk, def, report);
    } else if (report.routed) {
      to.troops = def.troops;
      j.troops = atk.troops;
      retreatJourney(j, '공격이 무너져');
    } else {
      to.troops = def.troops;
      j.troops = atk.troops;
      dropJourney(j);
      var cp = encamp(j.from, j.to, atk, j.food, report);
      report.campId = cp.id;
    }

    core.emit('rtk:battle', report);
    core.emit('rtk:journey', { kind: 'arrive', id: j.id, force: j.force, to: j.to, won: !!report.won });
  }

  /**
   * endMonth 가 부른다(`resolveAll()` 다음) — 가고 있는 원정이 저마다 한 달을
   * 더 간다. 목록을 **베껴 두고** 돈다 — 도착·철군으로 목록이 줄기 때문이다.
   */
  function resolveJourneys() {
    var list = journeys().slice(), out = [], i, j, k, broke;
    for (i = 0; i < list.length; i++) {
      j = list[i];
      broke = false;
      /* 경로 무결성 — 마지막 칸(목적지)은 애초에 통과 검사 대상이 아니었으니
         뺀다. 시작 칸(j.from)도 여기선 안 본다 — 거긴 arriveJourney() 가
         도착 순간에 다시 본다(짧은 원정은 중간 칸이 아예 없어서다) */
      for (k = 1; k < j.path.length - 1; k++) {
        if (!journeyPassable(j.path[k], j.force)) { broke = true; break; }
      }
      if (broke) {
        retreatJourney(j, '길이 끊겨');
        out.push(j);
        continue;
      }
      j.monthsElapsed += 1;
      if (j.monthsElapsed < j.monthsTotal) { rollJourneyEvent(j); continue; }
      arriveJourney(j);
      out.push(j);
    }
    if (out.length) { core.emit('changed'); core.persist(); }
    return out.length ? out : null;
  }

  global.DG = global.DG || {};
  global.DG.war = {
    ROUNDS: ROUNDS, ROUT: ROUT, DUEL_GAP: DUEL_GAP, SHIP_CREW: SHIP_CREW,
    CAMP_DECAY: CAMP_DECAY, CAMP_QUIT: CAMP_QUIT, CAMP_MIN: CAMP_MIN,
    armyPower: armyPower, troopMixOf: troopMixOf, topBy: topBy, duel: duel, fireRoll: fireRoll,
    duelBegin: duelBegin, duelSet: duelSet, duelHand: duelHand, duelAlive: duelAlive, duelRound: duelRound, duelEnd: duelEnd, duelBout: duelBout, duelAuto: duelAuto,
    STANCES: STANCES, BOUT_ROUNDS: BOUT_ROUNDS, BOUT_MUL: BOUT_MUL,
    FORMATIONS: FORMATIONS, formationOf: formationOf, TACTICS: TACTICS, tacticFor: tacticFor, stepRound: stepRound,
    HISTORY_BRANCHES: HISTORY_BRANCHES, checkHistoryBranch: checkHistoryBranch,
    reinforce: reinforce, reliefOf: reliefOf, forecast: forecast,
    canMarch: canMarch, march: march, marchInteractive: marchInteractive, capture: capture,
    transfer: transfer, moveOfficer: moveOfficer,
    camps: camps, campsOf: campsOf, campById: campById, campAt: campAt,
    besieged: besieged, monthsLeft: monthsLeft,
    supply: supply, withdraw: withdraw,
    resolveCamp: resolveCamp, resolveAll: resolveAll,
    journeys: journeys, journeysOf: journeysOf, journeyById: journeyById,
    canJourney: canJourney, startJourney: startJourney,
    homeForJourney: homeForJourney, resolveJourneys: resolveJourneys,
    JOURNEY_EVENTS: JOURNEY_EVENTS, rollJourneyEvent: rollJourneyEvent
  };
})(window);
