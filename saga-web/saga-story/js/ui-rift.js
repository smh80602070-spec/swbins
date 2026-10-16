/**
 * 4종횡 비경(§5-3) 시트 그리기 — 문 앞·축복 3택·노드 지도·이벤트. ui.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc, quitAsk })` 로 손잡이를 넘기고 같은 이름(viewRiftEntry·riftBoonLine·viewRift)으로 부른다. 상태는 rift.js(save.rift),
 * "그만둘까?" 물음 표시(riftQuitAsk)는 ui.js 클릭 처리기가 바꾸므로 ui.js 에 두고 quitAsk() 로 읽고 quitReset() 으로 지운다(R-4 함정: 갈아 끼우는 상태는 안 옮김).
 */
(function (global) {
  'use strict';

  var data = global.DG.data;
  var esc, quitAskOf = function () { return false; }, quitResetOf = function () {};
  var api = null;
  function setup(h) { esc = h.esc; quitAskOf = h.quitAsk; quitResetOf = h.quitReset; return api; }

  var RIFT_AXIS = { atk: '⚔️ 공격', def: '🛡️ 방어', util: '🧭 유틸' };

  function viewRiftEntry() {
    var R = global.DG.rift;
    if (!R) { return ''; }
    var f = R.info();
    return '<div class="sec"><h4>🌀 비경</h4><div class="card">' +
      '<div class="stat-row"><span>5층 노드 지도 · 층마다 축복</span>' +
        '<span class="muted">' + (f.pending ? (f.floor + 1) + '층 진행 중' : '정복 ' + f.clears + '회') + '</span></div>' +
      (f.available.ok
        ? '<button class="btn ' + (f.pending ? 'primary ' : '') + 'wide" data-act="rift-open">' +
          (f.pending ? '🌀 갈림길 열기' : '🌀 비경 문으로') + '</button>'
        : '<button class="btn ghost wide" disabled>🔒 ' + esc(f.available.reason) + '</button>') +
      '</div></div>';
  }

  function riftBoonLine(key) {
    var RD = global.DG.riftData, R = global.DG.rift, b = RD.boon(key);
    return b ? esc(R.boonLabel(b)) : esc(key);
  }

  function viewRift() {
    var R = global.DG.rift, RD = global.DG.riftData;
    if (!R || !RD) { return '<div class="hint">비경 모듈을 찾을 수 없습니다</div>'; }
    var f = R.info(), i, k, html = '';
    if (!f.pending) { quitResetOf(); }   // 문 앞으로 돌아오면 "그만둘까?" 물음을 지운다(값은 ui.js 에)

    html += '<div class="card"><div class="stat-row"><span>🧩 기억 조각</span><b>' + f.shards + '</b></div>' +
      '<div class="stat-row"><span class="muted">' + f.variant.emoji + ' 이번 주 · ' + esc(f.variant.name) + '</span>' +
        '<span class="muted">' + esc(f.variant.desc) + '</span></div></div>';

    if (!f.pending) {
      html += '<div class="hint">갈림길을 골라 5층을 내려갑니다. 층마다 <b>전투·정예·보물·휴식·이벤트</b> 중 하나를 고르고, ' +
        '진입 직후와 정예를 쓰러뜨린 뒤 <b>축복</b> 3택이 나옵니다. 5층은 관문 수호장입니다. ' +
        '쓰러지면 나가고 축복은 사라지지만, 받은 <b>기억 조각</b>은 남습니다.</div>';
      html += '<div class="stat-row"><span>도전 / 정복 / 가장 깊이</span><b>' +
        f.runs + ' / ' + f.clears + ' / ' + f.best + '층</b></div>';
      html += f.available.ok
        ? '<button class="btn primary wide" data-act="rift-begin">🌀 비경에 들어간다</button>'
        : '<button class="btn ghost wide" disabled>🔒 ' + esc(f.available.reason) + '</button>';

      html += '<div class="sec"><h4>기억 조각 강화</h4><div class="card">' +
        '<div class="stat-row"><span>최대 체력 +' + Math.round(RD.MEM_HP_STEP * 100) + '% / 단 (' + f.memHp + '/' + RD.MEM_HP_MAX + '단)</span>' +
        (f.memHp >= RD.MEM_HP_MAX
          ? '<b>최고</b>'
          : '<button class="btn tiny" data-act="rift-up-hp">🧩 ' + f.hpCost + ' 로 올린다</button>') +
        '</div></div>';
      var lockedAny = false;
      for (i = 0; i < RD.BOONS.length; i++) {
        var b = RD.BOONS[i];
        if (!b.locked) { continue; }
        lockedAny = true;
        html += '<div class="card"><div class="stat-row"><span>' + RIFT_AXIS[b.axis] + ' · ' + riftBoonLine(b.key) + '</span>' +
          (f.open[b.key]
            ? '<span class="muted">열림</span>'
            : '<button class="btn tiny ghost" data-act="rift-unlock" data-key="' + b.key + '">🧩 ' + RD.UNLOCK_COST + ' 로 연다</button>') +
          '</div><small class="muted">' + esc(b.desc) + '</small></div>';
      }
      if (lockedAny) { html = html.replace('<div class="sec"><h4>기억 조각 강화</h4>', '<div class="sec"><h4>기억 조각 강화 · 축복 풀</h4>'); }
      html += '</div>';
      return html;
    }

    /* 진행 중 */
    html += '<div class="stat-row"><span>지금</span><b>' + Math.min(f.floor + 1, RD.FLOORS) + '층 / ' + RD.FLOORS +
      ' · 이번 판 🧩 +' + f.gained + '</b></div>';
    if (f.boons.length) {
      html += '<div class="card">';
      for (i = 0; i < f.boons.length; i++) {
        var bb = RD.boon(f.boons[i]);
        html += '<div class="stat-row"><span>✨ ' + riftBoonLine(f.boons[i]) + '</span><small class="muted">' +
          esc(bb ? bb.desc : '') + '</small></div>';
      }
      html += '</div>';
    }

    if (f.phase === 'boon' && f.offer) {
      html += '<div class="sec"><h4>✨ 축복을 고르세요</h4>';
      for (i = 0; i < f.offer.length; i++) {
        var ob = RD.boon(f.offer[i]);
        html += '<button class="btn wide" data-act="rift-boon" data-key="' + ob.key + '" style="text-align:left">' +
          '<b>' + RIFT_AXIS[ob.axis] + ' · ' + riftBoonLine(ob.key) + '</b><br><small>' + esc(ob.desc) + '</small></button>';
      }
      html += '</div>';
    } else if (f.phase === 'event' && f.ev) {
      var ed = R.eventDef(f.ev.key);
      html += '<div class="sec"><h4>' + ed.emoji + ' ' + esc(ed.name) + '</h4><div class="hint">' + esc(ed.text) + '</div>';
      for (i = 0; i < ed.opts.length; i++) {
        html += '<button class="btn wide" data-act="rift-ev" data-key="' + ed.opts[i].key + '" style="text-align:left">' +
          '<b>' + esc(ed.opts[i].label) + '</b><br><small>' + esc(ed.opts[i].hint) + '</small></button>';
      }
      html += '</div>';
    } else if (f.phase === 'fight') {
      var c = f.cur || {};
      html += '<div class="hint">⚔️ 싸우는 중 — ' + esc((RD.KINDS[c.kind] || {}).name || '') +
        (c.kind === 'battle' ? ' (' + c.kills + '/' + c.goal + ')' : '') + '. 시트를 닫고 싸우세요.</div>';
    }

    /* 노드 지도 — 위가 5층 */
    html += '<div class="sec"><h4>지도</h4>';
    for (k = RD.FLOORS - 1; k >= 0; k--) {
      var row = f.map[k], chosen = f.path[k];
      html += '<div class="stat-row"><span class="muted">' + (k + 1) + '층</span><span>';
      for (i = 0; i < row.length; i++) {
        var kd = RD.KINDS[row[i].kind];
        var here = (k === f.floor && f.phase === 'map');
        var was = k < f.floor && chosen === i;
        html += '<button class="btn tiny ' + (was ? 'primary' : 'ghost') + '"' +
          (here ? ' data-act="rift-node" data-i="' + i + '" title="' + esc(kd.desc) + '"' : ' disabled') +
          ' style="margin-left:4px' + (k < f.floor && !was ? ';opacity:.4' : '') + '">' +
          kd.emoji + ' ' + esc(kd.name) + '</button>';
      }
      html += '</span></div>';
    }
    html += '</div>';

    html += quitAskOf()
      ? '<div class="card"><div class="hint">정말 포기할까요? 축복과 층은 사라지고, 받은 기억 조각만 남습니다.</div>' +
        '<button class="btn wide" data-act="rift-quit-yes">포기한다</button>' +
        '<button class="btn ghost wide" data-act="rift-quit-no">계속한다</button></div>'
      : '<button class="btn tiny ghost wide" data-act="rift-quit">🚪 비경을 포기하고 나간다</button>';
    return html;
  }

  api = { setup: setup, viewRiftEntry: viewRiftEntry, riftBoonLine: riftBoonLine, viewRift: viewRift, RIFT_AXIS: RIFT_AXIS };
  global.DG = global.DG || {};
  global.DG.uiRift = api;
})(typeof window !== 'undefined' ? window : this);
