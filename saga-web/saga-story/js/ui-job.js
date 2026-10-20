/**
 * 4종횡 🥋 무예 시트 그리기 — 전직·스킬 트리·각성기·문파. ui.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc, pt })` 로 손잡이를 넘기고 같은 이름(viewJob)으로 부른다. 상태는 job.js 등 DG.* 에서 바로 읽고 여기는 그리기만 한다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;
  var esc, pt;
  var api = null;
  function setup(h) { esc = h.esc; pt = h.pt; return api; }
  /* W-0330 — 직업·무예 그림(K-0118 job_st_*·sk_st_*) 먼저, 없으면 이모지(아이템 아이콘 W-0025 와 같은 길) */
  function ic(kind, key, size, fb) { var I = global.DG.itemicon; return I ? I.or('saga-story', kind, key, size, fb) : fb; }

  /** 🥋 무예 — 전직과 스킬 트리. 원작의 스킬창 자리다 */
  function viewJob() {
    var J = global.DG.job, JD = global.DG.jobData;
    var me = J.cur(), left = J.spLeft();
    var i, html = '';

    html += '<div class="sec"><h4>지금 자리</h4><div class="card">' +
      '<div class="stat-row"><span>' + ic('job', me.key, 28, me.emoji) + ' <b>' + esc(me.name) + '</b></span>' +
        '<span class="muted">Lv.' + core.save.player.level + '</span></div>' +
      '<div class="stat-row"><span class="muted">' + esc(me.desc) + '</span>' +
        '<b>강화 점수 ' + left + '</b></div>' +   // W-0104 — 레벨업은 3택(📜), 점수는 거절·옛 레벨 몫
      '<small class="muted">' + ((core.save.spCutLv || 1) > 1 ? 'Lv.' + core.save.spCutLv + ' 까지는 레벨마다 ' + JD.SP_PER_LEVEL + '점, 그 뒤로는 ' : '') + '레벨마다 📜 무예 3택(거절하면 강화 점수 1) ' +
        '(쓴 것 ' + J.spSpent() + ' / 모두 ' + J.spTotal() + '). ' +
        '<b>찍은 무예만 조작 띠에 놓입니다.</b></small>' +
      (me.key !== 'none'
        ? '<div class="btn-row"><button class="btn ghost" data-act="j-reset">🔄 전직을 되돌린다</button></div>'
        : '') +
      '</div></div>' + (global.DG.constellation ? global.DG.constellation.sheetHtml() : '');   // 사방 성좌(W-0183)

    /* 고유 조작 + 스승(§5-1) — 회피를 길게 눌러 쓰는 조작 하나와, 1~4차 전직마다
       하나씩 만난 스승 넷. 스승 중 하나라도 도감(등용)에 있으면 수치가 오른다. */
    var sig = J.signature();
    if (sig) {
      var mlist = J.mentors(), dex = core.save.dex.heroes;
      html += '<div class="sec"><h4>고유 조작 <small class="muted">— 회피를 길게 누르면</small></h4>' +
        '<div class="card">' +
        '<div class="stat-row"><span>' + sig.emoji + ' <b>' + esc(sig.name) + '</b></span>' +
          '<span class="muted">기력 ' + sig.cost + ' · 쿨 ' + sig.cd + 's</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(sig.desc) + '</span>' +
          '<b>' + (sig.boost ? '🎓 스승 보정 ON' : '스승 보정 OFF') + '</b></div>' +
        '<div class="mentor-row">' +
        mlist.map(function (id, mi) {
          var h = data.find(id);
          if (!h) { return ''; }
          var got = !!dex[id];
          return '<div class="mentor-chip' + (got ? ' on' : '') + '">' + pt('hero', h, 40) +
            '<small>' + (mi + 1) + '차 · ' + esc(h.name) + (got ? ' ✅' : '') + '</small></div>';
        }).join('') +
        '</div></div></div>';
    }

    /* 전직 */
    var nexts = JD.nextJobs(me.key);
    if (nexts.length) {
      html += '<div class="sec"><h4>전직 <small class="muted">— 오르는 것 자체는 그대로지만, ' +
        '위 "전직을 되돌린다"로 무명에 돌아가 다른 길을 다시 고를 수 있습니다</small></h4>';
      for (i = 0; i < nexts.length; i++) {
        var nj = nexts[i], why = J.canJoin(nj.key);
        html += '<div class="card"><div class="stat-row">' +
          '<span>' + ic('job', nj.key, 28, nj.emoji) + ' <b>' + esc(nj.name) + '</b></span>' +
          '<span class="muted">Lv.' + nj.need + ' 부터</span></div>' +
          '<div class="stat-row"><span class="muted">' + esc(nj.desc) + '</span>' +
            '<span class="muted">체력 +' + (nj.grow ? nj.grow.hp : 0) +
            ' · 공격 +' + (nj.grow ? nj.grow.atk : 0) +
            (nj.grow && nj.grow.mp ? ' · 기력 +' + nj.grow.mp : '') + '</span></div>' +
          (why
            ? '<button class="btn ghost wide" disabled>🔒 ' + esc(why) + '</button>'
            : '<button class="btn primary wide" data-act="j-join" data-job="' + nj.key +
              '">이 길로 간다</button>') +
          '</div>';
      }
      html += '</div>';
    }

    /* 무예 목록 — 유파(§5-2)별로 묶는다. 띠(bar)에 같은 유파가 2/4개 있으면
       그 유파 전체(무예 카드 + 아래 조작 띠 슬롯)가 색을 받는다(.set2/.set4) */
    var mine = JD.skillsOf(me.key).filter(function (s) { return s.max > 0; });
    var active = J.activeSchools();
    html += '<div class="sec"><h4>무예</h4>';
    if (!mine.length) {
      html += '<div class="hint">아직 익힐 무예가 없습니다. <b>Lv.10</b> 에 전직하면 열립니다 — ' +
        '그때까지는 연참·횡소·기탄·기합 넷을 씁니다.</div>';
    }
    var groups = JD.SCHOOLS.filter(function (s) {
      return mine.some(function (m) { return m.school === s.id; });
    });
    for (var gi = 0; gi < groups.length; gi++) {
      var def = groups[gi], tier = active[def.id] || 0;
      html += '<div class="school-head' + (tier ? ' set' + tier : '') + '">' +
        '<b>' + esc(def.name) + ' 유파</b> <span class="muted">— ' +
        (tier ? tier + '세트 발동 중' : '띠에 2개면 소효과, 4개면 대효과') + '</span></div>';
      var list = mine.filter(function (s) { return s.school === def.id; });
      for (i = 0; i < list.length; i++) {
        var sk = list[i], lv = J.levelOf(sk.key), why2 = J.canRaise(sk.key);
        var mul = J.mulOf(sk);
        html += '<div class="card' + (lv > 0 ? ' on' : '') + (tier ? ' set' + tier : '') + '">' +
          '<div class="stat-row"><span>' + ic('skill', sk.key, 28, sk.emoji) + ' <b>' + esc(sk.name) + '</b></span>' +
            '<b>' + lv + ' / ' + sk.max + '</b></div>' +
          '<div class="stat-row"><span class="muted">' + esc(sk.desc) + '</span>' +
            '<span class="muted">기력 ' + sk.cost + ' · 쿨 ' + sk.cd + 's</span></div>' +
          (lv > 0 && sk.mul[0]
            ? '<div class="stat-row"><span class="muted">지금 힘</span><b>공격력 ×' +
              mul.toFixed(2) + '</b></div>'
            : '') +
          '<div class="btn-row">' +
            (why2
              ? '<button class="btn tiny ghost" disabled>' + esc(why2) + '</button>'
              : '<button class="btn tiny primary" data-act="j-raise" data-skill="' + sk.key +
                '">＋ 한 점 붓는다</button>') +
          '</div></div>';
      }
    }
    html += '</div>';

    /* 지금 조작 띠 */
    var bar = J.bar();
    html += '<div class="sec"><h4>조작 띠</h4><div class="card">';
    for (i = 0; i < bar.length; i++) {
      var bDef = bar[i].school ? JD.schoolDef(bar[i].school) : null;
      var bTier = bDef ? (active[bDef.id] || 0) : 0;
      html += '<div class="stat-row' + (bTier ? ' set' + bTier : '') + '"><span>' + (i + 1) + ' · ' +
        ic('skill', bar[i].key, 22, bar[i].emoji) + ' ' + esc(bar[i].name) +
        (bDef ? ' <small class="muted">[' + esc(bDef.name) + ']</small>' : '') +
        '</span><span class="muted">' +
        (bar[i].max ? '레벨 ' + J.levelOf(bar[i].key) : '고정') + '</span></div>';
    }
    var onNames = Object.keys(active).map(function (id) {
      var d = JD.schoolDef(id);
      return (d ? d.name : id) + ' ' + active[id] + '세트';
    });
    if (onNames.length) {
      html += '<div class="stat-row"><span class="muted">지금 켜진 세트</span><b>' +
        onNames.join(' · ') + '</b></div>';
    }
    html += '<small class="muted">키 1~8 · 화면 아래 단추. 자리가 여덟을 넘으면 ' +
      '<b>윗자리 무예부터</b> 놓입니다 — 4차까지 열리면 한 갈래가 열다섯, 5차엔 각성기 둘이 더해집니다.</small></div></div>';
    return html;
  }

  api = { setup: setup, viewJob: viewJob };
  global.DG = global.DG || {};
  global.DG.uiJob = api;
})(typeof window !== 'undefined' ? window : this);
