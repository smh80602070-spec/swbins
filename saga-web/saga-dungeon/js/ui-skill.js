/**
 * 2나락 무예(武藝) 시트 — 직업·네 칸·갈래 나무·비결 줄. ui.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc, ico, S })` 로 손잡이를 넘기고 같은 이름(viewSkill)으로 부른다.
 * 고른 인물·고른 칸(skillHero·skillSlotPick)은 ui.js 클릭 처리가 바꾸므로 거기 두고 S 게터로만 읽는다(인물이 동행에서 빠지면 S.setHero).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;
  var esc, ico, S;
  var api = null;
  function setup(h) {
    esc = h.esc; ico = h.ico; S = h.S;
    return api;
  }
  /** 이 직업을 여는 무기 이름들 — "무엇을 쥐면 되는지" 를 화면이 알려 준다 */
  function weaponNames(clsKey) {
    var looks = global.DG.skillData.weaponsFor(clsKey);
    var out = [];
    global.DG.itemData.BASES.forEach(function (b) {
      if (b.slot === 'weapon' && looks.indexOf(b.look) >= 0) { out.push(b.name); }
    });
    return out.join('·');
  }

  function viewSkill() {
    var SK = global.DG.skill, SD = global.DG.skillData, skillHero = S.hero(), skillSlotPick = S.slotPick();
    if (!SK) { return '<div class="hint">무예 모듈이 없습니다</div>'; }
    var party = core.save.party;
    if (!party.length) { return '<div class="hint">동행이 없습니다.</div>'; }
    if (party.indexOf(skillHero) < 0) { skillHero = party[0]; S.setHero(skillHero); }

    var h = data.find(skillHero);
    var cls = SK.classOf(skillHero);
    var left = SK.pointsLeft(skillHero);

    /* 인물 고르기 — 선두가 던전에서 몸으로 뛴다 */
    var tabs = '', i;
    for (i = 0; i < party.length; i++) {
      var ph = data.find(party[i]);
      if (!ph) { continue; }
      tabs += '<button class="btn tiny' + (party[i] === skillHero ? ' primary' : ' ghost') +
        '" data-act="skill-hero" data-hero="' + party[i] + '">' +
        (i === 0 ? '\u25B6 ' : '') + esc(ph.name) + '</button>';
    }

    var html = '<div class="bagtools">' + tabs + '</div>' +
      '<div class="sec"><h4>' + ico('job', cls.key, 24, cls.emoji) + ' ' + esc(cls.name) + '(' + cls.hanja + ')</h4>' +   // W-0330 직업·무예 그림(K-0118), 없으면 이모지
      '<div class="card">' +
        '<div class="stat-row"><span>' + esc(h ? h.name : '') + '</span>' +
          '<b>Lv.' + SK.pointsTotal(skillHero) + ' · 남은 점수 ' + left + '</b></div>' +
        '<small class="muted">' + esc(cls.desc) + '<br>' +
        '직업은 <b>장착한 무기</b>가 정합니다 — ' + esc(weaponNames(cls.key)) +
        ' 를 쥐면 이 나무를 탑니다. <b>무기를 바꾸면 손이 통째로 바뀝니다.</b><br>' +
        '점수와 칸은 직업마다 따로 남으니, 도로 쥐면 예전 손이 살아납니다.<br>' +
        '<b>던전에서 몸으로 뛰는 것은 선두(▶)</b>입니다.' +
        '</small>' +
        (SK.pointsSpent(skillHero)
          ? '<button class="btn tiny ghost wide" data-act="skill-respec">↺ 환원(還元) — ' +
            core.fmt(global.DG.vendor.respecCost(skillHero)) + '금에 점수를 돌려받는다</button>'
          : '') +
        '</div></div>' + (global.DG.meridian ? global.DG.meridian.sheetHtml(skillHero) : '');   // 경락도(W-0180) 칸

    /* 네 칸 */
    var eq = SK.equipped(skillHero);
    var KEYS = ['Z', 'X', 'C', 'V'];
    html += '<div class="sec"><h4>손에 든 넷</h4>' +
      '<div class="hint">배운 것을 <b>네 칸에 걸어야</b> 던전에서 씁니다 — ' +
      '원작에서도 배운 걸 다 손에 들진 못합니다.</div><div class="bagtools">';
    for (i = 0; i < eq.length; i++) {
      html += '<button class="btn tiny' + (skillSlotPick === i ? ' primary' : ' ghost') +
        '" data-act="skill-slot" data-idx="' + i + '">' + KEYS[i] + ' ' +
        (eq[i] ? ico('skill', eq[i].sk.key, 20, eq[i].sk.emoji) + ' ' + esc(eq[i].sk.name) : '<span class="muted">비었다</span>') +
        '</button>';
    }
    html += '</div>';
    if (skillSlotPick !== null) {
      html += '<div class="hint">' + KEYS[skillSlotPick] +
        ' 칸에 걸 무예를 아래에서 고르세요 (상시 무예는 못 겁니다). ' +
        '<button class="btn tiny ghost" data-act="skill-slot" data-idx="-1">그만두기</button></div>';
    }
    html += '</div>';

    /* 나무 — 갈래 셋 × 단계 셋 */
    var tree = SK.treeOf(skillHero);
    var br;
    for (br = 0; br < 8; br++) {
      var row = tree.filter(function (x) { return x.br === br; })
                    .sort(function (a, b) { return a.row - b.row; });
      if (!row.length) { continue; }
      html += '<div class="sec"><h4>갈래 ' + (br + 1) + '</h4>';
      for (i = 0; i < row.length; i++) {
        var sk = row[i];
        var rank = SK.rankOf(skillHero, sk.key);
        var can = SK.canLearn(skillHero, sk.key);
        var pre = SD.prereqOf(sk);
        var locked = !!(pre && SK.rankOf(skillHero, pre.key) < 1);
        var slotted = eq.filter(function (x) { return x && x.sk.key === sk.key; }).length > 0;
        html += '<div class="grow" style="border-left-color:' +
          (rank ? 'var(--gold)' : (locked ? 'var(--ink-faint)' : 'var(--d2-brass)')) + '">' +
          '<div class="gr-top"><b>' + ico('skill', sk.key, 28, sk.emoji) + ' ' + esc(sk.name) + '</b>' +
          '<span class="gr-lv">' + rank + ' / ' + SD.MAX_RANK + '단' +
            (slotted ? ' · 손에 듦' : '') + '</span></div>' +
          '<div class="gr-opts">' + esc(sk.desc) +
            (sk.shape === 'passive' ? ' <span class="muted">(상시)</span>'
                                    : ' <span class="muted">기력 ' + sk.cost + ' · ' + sk.cd + '초</span>') +
            (rank ? ' <b>지금 ' + fmtSkillValue(sk, SD.valueAt(sk, rank)) + '</b>' : '') +
          '</div>' +
          '<div class="gr-btns">' +
            (locked
              ? '<span class="muted" style="font-size:11px">\uD83D\uDD12 ' + esc(pre.name) + ' 을(를) 먼저</span>'
              : '<button class="btn tiny' + (can.ok ? ' primary' : '') + '" data-act="skill-learn"' +
                ' data-key="' + sk.key + '"' + (can.ok ? '' : ' disabled') + '>+1단</button>') +
            (skillSlotPick !== null && rank > 0 && sk.shape !== 'passive'
              ? '<button class="btn tiny" data-act="skill-set" data-key="' + sk.key +
                '">' + KEYS[skillSlotPick] + ' 에 걸기</button>' : '') +
          '</div>' + secretRow(skillHero, sk, rank) + (rank && sk.shape !== 'passive' && global.DG.skillTree ? global.DG.skillTree.rowHtml(sk.key) : '') + '</div>';   // W-0280 무예별 작은 나무
      }
      html += '</div>';
    }
    return html;
  }

  /**
   * 비결(§5.9, secret.js) 다섯 — 배운 무예 아래에 늘어놓는다. 단수가 모자란 것은 자물쇠.
   * 원작 3편의 룬 자리 — 이 판엔 소켓 룬이 따로 있어 이름을 '비결'로 했다.
   */
  function secretRow(hid, sk, rank) {
    var SC = global.DG.secret;
    if (!SC || !rank || sk.shape === 'passive') { return ''; }
    var cur = SC.of(hid, sk.key), html = '<div class="gr-secret"><small class="muted">비결</small> ';
    var lores = SC.activeLores ? SC.activeLores(hid) : {};
    SC.SECRETS.forEach(function (s) {
      var lock = rank < s.rank;
      /* 비전(§5.10) — 입은 전설이 키우는 비결엔 📜 가 붙는다 */
      html += '<button class="btn tiny' + (cur === s.key ? ' primary' : '') + '" data-act="skill-secret"' +
        ' data-key="' + sk.key + '" data-sec="' + s.key + '" title="' + esc(s.desc + (lores[s.key] ? ' · 📜 비전 위력 ×' + SC.LORE_MUL : '')) + '"' + (lock ? ' disabled' : '') + '>' +
        s.emoji + ' ' + s.name + (lores[s.key] ? '📜' : '') + (lock ? ' 🔒' + s.rank : '') + '</button>';
    });
    if (cur) { html += '<div class="muted" style="font-size:11px">' + esc(SC.byKey(cur).desc) + '</div>'; }
    return html + '</div>';
  }

  /** 상시 무예는 % 로, 나머지는 배수로 읽힌다 */
  function fmtSkillValue(sk, v) {
    if (sk.shape === 'passive') { return '+' + Math.round(v * 10) / 10 + '%'; }
    if (sk.shape === 'buff') { return '+' + Math.round(v) + '% · ' + (sk.sec || 6) + '초'; }
    if (sk.shape === 'heal') { return '체력 ' + Math.round(v) + '%'; }
    if (sk.shape === 'curse') { return '받는 피해 +' + Math.round(v) + '%' + (sk.pull ? ' · 끌어당김' : ''); }
    if (sk.shape === 'summon') { return Math.round(v) + '기 · ' + (sk.sec || 12) + '초'; }
    /* §5.19 2차 — 원뿔(arc)·끌어당김(pull)은 같은 모양 안의 변주라 수치 줄에 꼬리표로 */
    return '위력 ' + Math.round(v * 100) + '%' + (sk.arc ? ' · 앞 부채꼴' : '') + (sk.pull ? ' · 끌어당김' : '');
  }

  api = { setup: setup, viewSkill: viewSkill, fmtSkillValue: fmtSkillValue };
  global.DG = global.DG || {};
  global.DG.uiSkill = api;
})(window);
