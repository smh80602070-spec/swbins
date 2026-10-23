/**
 * 사가천하 — 겨루기 카드 그림(일기토 예고·손 싸움 카드·설전 문답·전황 막대) · ui-rtk.js 에서 떼어 냄(R-4 10-23)
 * ---------------------------------------------------------------
 * 몸통은 ui-rtk.js 에 있던 글자 그대로이고 HTML 만 돌려준다(띄우기·상태는 ui-rtk 몫 — duelStep·debCur 는 거기 둔다).
 * 바깥 것은 make(U) 로 받는다 — U.esc·pt·bar·DEBATE_TIP(ui-rtk 것 그대로). ui-rtk.js 가 처음 부를 때 make 한다.
 */
(function (global) {
  'use strict';

  global.DG = global.DG || {};
  global.DG.rtkCards = { make: function (U) {
  var core = global.DG.core, FD = global.DG.forceData;
  var esc = U.esc, pt = U.pt, bar = U.bar, DEBATE_TIP = U.DEBATE_TIP;
  function off() { return global.DG.off; }
  /** 일기토 예고장 — "OOO ⚔️ OOO"(초상 곁들여). 삼국지 게임들이 결투 전에
   *  두 장수를 마주 세워 보여주는 그 카드와 같은 결이다(2026-09-10). 이름·
   *  초상 다 안 바뀌는 값이라(합마다 그림이 바뀌는 건 3D 쪽 몫) 여기 한 번만
   *  적어 두고 갱신은 안 한다 — battle3d.js 의 실제 캐릭터 대결과 짝을 이룬다 */
  function duelCaptionHtml(rep) {
    if (!rep.duel || !rep.duel.a || !rep.duel.d) { return ''; }
    var oa = off().find(rep.duel.a), od = off().find(rep.duel.d);
    if (!oa || !od) { return ''; }
    return '<div class="bduel">' + pt(oa, 30) + '<b>' + esc(oa.name) + '</b>' +
      '<span>⚔️</span><b>' + esc(od.name) + '</b>' + pt(od, 30) + '</div>';
  }
  /** 일기토 손 싸움 카드(PLAN §5-3) — 한 수씩 고르고, 승부가 나면 결과를 보여 준 뒤 전황으로 넘어간다.
   *  판정은 war.js duelBout() 이 한다. 여기는 그 결과를 그릴 뿐이다 */
  function duelCardHtml(view) {
    var oa = off().find(view.a), od = off().find(view.d), S = view.stances, i, k, key;
    var html = '<h3 style="margin:0 0 6px;font-size:18px">🤺 일기토' +
      (view.done ? ' — 승부가 났다' : ' — ' + (view.bouts.length + 1) + '번째 수') + '</h3>' +
      '<div class="bduel">' + pt(oa, 30) + '<b>' + esc(oa.name) + '</b><span>⚔️</span><b>' + esc(od.name) + '</b>' + pt(od, 30) + '</div>' +
      '<div class="bhud">' + bar(esc(oa.name), view.ah, 100) + bar(esc(od.name), view.dh, 100) + '</div>';
    if (view.bouts.length) {
      html += '<div class="enc-hist">';
      for (i = 0; i < view.bouts.length; i++) {
        var b = view.bouts[i], mine = 0;
        for (k = 0; k < b.rounds.length; k++) { if (b.rounds[k] === 'a') { mine++; } }
        html += (i ? '<br>' : '') + (i + 1) + '수 — ' + S[b.pick].emoji + ' ' + S[b.pick].name + ' 대 ' + S[b.foe].emoji + ' ' + S[b.foe].name +
          ' · ' + (b.res === 'win' ? '✅ 이겼다' : (b.res === 'tie' ? '➖ 비겼다' : '❌ 졌다')) + ' ×' + b.mul.toFixed(1) +
          ' <span class="muted">(' + mine + ' : ' + (b.rounds.length - mine) + ')</span>';
      }
      html += '</div>';
    }
    if (view.done) {
      var res = view.result, won = res.winner === view.a;
      html += '<div class="qresult ' + (won ? 'good' : 'bad') + '">' + (won ? '🏆 ' : '💢 ') + esc(res.text) +
        (res.hurt ? ' — ' + esc(off().find(res.loser).name) + ' 이(가) 다쳤다' : '') + '</div>' +
        '<button class="btn primary wide" data-act="duel-go">' + esc(view.cont || '▶ 전황으로') + '</button>';
    } else {
      if (view.habit) {
        html += '<div class="enc-hist">' + S[view.habit].emoji + ' 적은 방금 이긴 <b>' + esc(S[view.habit].name) + '</b> 을(를) 되풀이할 낌새다.</div>';
      }
      html += '<div class="qchoices">';
      for (key in S) {
        if (!Object.prototype.hasOwnProperty.call(S, key)) { continue; }
        html += '<button class="qchoice" data-act="duel-pick" data-pick="' + key + '"><b>' + S[key].emoji + '</b> ' +
          esc(S[key].name) + ' <small class="muted">— ' + esc(S[key].desc) + '</small></button>';
      }
      html += '</div><small class="muted">베기 &gt; 찌르기 &gt; 막기 &gt; 베기. 이기면 내가 칠 확률 ×1.3, 지면 ×0.8 — 한 수가 네 합을 다스린다.</small>' +
        '<div class="camp-acts" style="margin-top:6px"><button class="btn tiny ghost" data-act="duel-pick" data-pick="auto">🎲 남은 합은 맡긴다</button></div>';
    }
    return html;
  }

  function debateHtml(d) {
    var Q = global.DG.quiz, QD = global.DG.quizData;
    var html = '<h3 style="margin:0 0 4px;font-size:17px">🗣️ ' + esc(d.title) + '</h3>';
    if (d.i >= d.qs.length) {
      var mul = Q.debateMul(d.ok);
      html += '<div class="qresult ' + (mul >= 1 ? 'good' : 'bad') + '">정답 ' + d.ok + ' / ' + d.qs.length + ' — 성공률 ×' + mul + '</div>' +
        '<div class="camp-acts"><button class="btn primary" data-act="deb-go">📜 청한다</button>' +
        (d.must ? '' : '<button class="btn ghost" data-act="deb-quit">그만</button>') + '</div>';
    } else {
      var p = d.qs[d.i], cat = QD.catOf(p.cat), j;
      html += '<small class="muted">제 ' + (d.i + 1) + ' / ' + d.qs.length + ' 문 · 맞힌 ' + d.ok + ' · ' + esc(DEBATE_TIP) + '</small>' +
        '<div class="qbox"><div class="qb-head"><b style="color:' + cat.color + '">' + cat.emoji + ' ' + esc(cat.name) + '</b>' +
        '<span class="muted">' + p.lvName + '</span></div><p class="qq">' + esc(p.q) + '</p>';
      if (!d.last) {
        html += '<div class="qchoices">';
        for (j = 0; j < p.choices.length; j++) {
          html += '<button class="qchoice" data-act="deb-answer" data-i="' + j + '"><b>' + (j + 1) + '</b> ' + esc(p.choices[j]) + '</button>';
        }
        html += '</div>';
        if (d.i === 0 && !d.must) { html += '<button class="btn tiny ghost" data-act="deb-skip">설전 없이 청한다 (×1)</button> '; }
        if (!d.must) { html += '<button class="btn tiny ghost" data-act="deb-quit">그만</button>'; }
      } else {
        html += '<div class="qresult ' + (d.last.ok ? 'good' : 'bad') + '">' + (d.last.ok ? '✅ 정답 ' : '❌ 오답 ') +
          '<b>' + esc(d.last.answerText) + '</b></div><p class="qwhy">' + esc(d.last.why) + '</p>' +
          '<button class="btn primary wide" data-act="deb-next">' + (d.i + 1 >= d.qs.length ? '결과 ▶' : '다음 문 ▶') + '</button>';
      }
      html += '</div>';
    }
    return html;
  }

  function battleHudHtml(rep) {
    var af = FD.force(rep.force), df = FD.force(rep.defForce);
    return '<div class="bhud" id="bhud">' +
      duelCaptionHtml(rep) +
      bar((af ? esc(af.name) : '아군') + ' ⚔️', rep.atkStart, rep.atkStart) +
      bar((df ? esc(df.name) : '적군') + ' 🛡️', rep.defStart, rep.defStart) +
      (rep.water ? '' : bar('성벽', rep.wallFrom || 1, rep.wallFrom || 1)) +
      '<div class="bhud-round" id="bhud-round">전투 시작</div>' +
      '</div>';
  }
  function setBarRow(row, val, max) {
    if (!row) { return; }
    var pct = Math.round(core.clamp(val / Math.max(1, max), 0, 1) * 100);
    var i = row.querySelector('.bar > i');
    if (i) { i.style.width = pct + '%'; }
    var b = row.querySelector('b');
    if (b) { b.textContent = core.fmt(Math.max(0, Math.round(val))); }
  }
  return { duelCaptionHtml: duelCaptionHtml, duelCardHtml: duelCardHtml, debateHtml: debateHtml, battleHudHtml: battleHudHtml, setBarRow: setBarRow };
  } };
})(window);
