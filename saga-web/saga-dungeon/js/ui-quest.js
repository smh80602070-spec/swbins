/**
 * 2나락 퀘스트 시트(메인·지역·이벤트·무작위, PLAN 36절) — ui.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc })` 로 손잡이를 넘기고 같은 이름(viewQuest)으로 부른다. 진행은 quest.js(DG.quest).
 */
(function (global) {
  'use strict';

  var esc;
  var api = null;
  function setup(h) { esc = h.esc; return api; }

  /* ── 퀘스트 (PLAN 36절) ───────────────────────────────────
   * 넷 — 메인(순서대로 하나씩) · 지역(월드맵 여섯 지역, 닿아야 열린다) ·
   * 이벤트(구출 누적) · 무작위(늘 하나, 끝내면 곧바로 새것). 진행은
   * quest.js 가 dungeon.js 의 사건을 듣고 센다 — 여기는 그 결과만 그린다.
   */
  function qstRow(icon, name, desc, have, need, cls) {
    var pct = need ? Math.round(Math.min(1, have / need) * 100) : 0;
    return '<div class="qst-row' + (cls ? ' ' + cls : '') + '">' +
      '<span class="qst-ic">' + icon + '</span>' +
      '<div class="qst-info"><b>' + esc(name) + '</b><small>' + esc(desc) + '</small>' +
        (need ? '<div class="qst-bar"><i style="width:' + pct + '%"></i></div>' : '') +
      '</div>' +
      (need ? '<span class="qst-n">' + have + '/' + need + '</span>' : '') +
      '</div>';
  }

  function viewQuest() {
    var Q = global.DG.quest;
    if (!Q) { return '<div class="hint">퀘스트 모듈이 없습니다.</div>'; }
    var st = Q.status();
    var html = global.DG.scenario ? global.DG.scenario.cardHtml() + global.DG.scenario.roundHtml() : '';

    html += '<div class="sec"><h4>🚩 메인</h4>';
    if (st.mainDone) {
      html += '<div class="hint">메인 퀘스트를 모두 마쳤습니다 (' + st.mainTotal + '/' + st.mainTotal + ').</div>';
    } else {
      html += qstRow('🚩', st.main.name, st.main.desc, st.main.have, st.main.need) +
        '<div class="hint">' + (st.mainIdx + 1) + ' / ' + st.mainTotal + '번째</div>';
    }
    html += '</div>';

    html += '<div class="sec"><h4>🗺️ 지역</h4>';
    for (var i = 0; i < st.regions.length; i++) {
      var r = st.regions[i];
      if (r.locked) {
        html += qstRow('❔', '???', '이 지역에 아직 닿지 않았습니다', 0, 0, 'locked');
      } else {
        html += qstRow(r.done ? '✅' : '⚔️', r.name, r.desc, r.have, r.need, r.done ? 'done' : '');
      }
    }
    html += '</div>';

    /* 지역 사연 사슬(§5.14) — 고정 세계 지도의 지역 아홉, 발 들인 곳만 열린다 */
    if (st.chains && st.chains.length) {
      html += '<div class="sec"><h4>📜 지역 사연 <small>' + st.chainDone + '/' + st.chains.length + ' 평정' +
        (st.chainAll ? ' · 🏳️ 구주 평정' : '') + '</small></h4>';
      st.chains.forEach(function (c) {
        if (c.locked) {
          html += qstRow('❔', c.emoji + ' ' + c.name, '아직 발 들이지 않은 땅', 0, 0, 'locked');
        } else if (c.done) {
          html += qstRow('🏳️', c.emoji + ' ' + c.name + ' · ' + c.title, '평정 — ' + c.desc, 0, 0, 'done');
        } else {
          html += qstRow('📜', c.emoji + ' ' + c.name + ' · ' + c.title + ' (' + (c.step + 1) + '/' + c.steps + ' ' + c.stepName + ')',
            c.desc + ' — ' + c.giver, c.have, c.need);
        }
      });
      html += '</div>';
    }

    html += '<div class="sec"><h4>🙏 이벤트</h4>';
    if (st.eventDone) {
      html += '<div class="hint">이벤트 퀘스트를 모두 마쳤습니다.</div>';
    } else {
      html += qstRow('🙏', st.event.name, st.event.desc, st.event.have, st.event.need);
    }
    html += '</div>';

    html += '<div class="sec"><h4>📋 현상</h4>' +
      qstRow('📋', st.random.name, st.random.desc, st.random.have, st.random.need) +
      '<button class="btn tiny ghost" data-act="quest-reroll">🔄 다시 뽑기</button></div>';

    return html;
  }

  api = { setup: setup, viewQuest: viewQuest, qstRow: qstRow };
  global.DG = global.DG || {};
  global.DG.uiQuest = api;
})(typeof window !== 'undefined' ? window : this);
