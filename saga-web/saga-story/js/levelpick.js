/**
 * 레벨업 3택 창 — 「📜 무예 3택」 단추와 고르는 창 (PLAN §5-2 보강, W-0104 · 재미표준 D)
 * ---------------------------------------------------------------
 * 규칙은 job.js(`offer`·`pick`·`decline`)가 정한다 — 여기는 그리기만. 싸우는 도중에 창을 들이밀지 않으려고
 * 레벨이 오르면 토스트와 함께 단추만 선다(쌓인 장 수 표시). 누르면 맨 앞 한 장을 연다:
 * 사슬(유파)이 서로 다른 무예 셋 — 이름·사슬·지금 레벨 → 다음 레벨·한 줄 효과 — 과 「거절 · 강화 점수 +1」.
 * ui.js 는 큰 파일 상한이라 손대지 않고 제 DOM 을 따로 둔다(saga-forest craft.js 와 같은 꼴).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function J() { return global.DG.job; }
  function JD() { return global.DG.jobData; }

  var btn = null, ov = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function count() { var s = core.save; return (s && s.offers) ? s.offers.length : 0; }

  function html() {
    var o = J().offer();
    if (!o) { return '<h3 style="margin:0 0 8px">📜 무예 3택</h3><div class="hint">고를 장이 없습니다</div>' +
      '<button class="btn primary" data-lp-close="1" style="width:100%;margin-top:10px">닫기</button>'; }
    var rows = o.keys.map(function (k, i) {
      var sk = JD().skill(k), sc = sk && JD().schoolDef(sk.school), lv = J().levelOf(k);
      return '<button class="btn" data-lp-pick="' + i + '" style="display:block;width:100%;margin-top:8px;text-align:left;line-height:1.5">' +
        sk.emoji + ' <b>' + esc(sk.name) + '</b> <small class="muted">' + (sc ? esc(sc.name) + ' 사슬 · ' : '') + 'Lv ' + lv + ' → ' + (lv + 1) + '</small><br>' +
        '<small>' + esc(sk.desc || '') + '</small></button>';
    }).join('');
    return '<h3 style="margin:0 0 4px">📜 Lv.' + o.lv + ' 무예 3택' + (count() > 1 ? ' <small class="muted">(남은 장 ' + count() + ')</small>' : '') + '</h3>' +
      '<small class="muted">사슬이 서로 다른 셋 중 하나를 익힌다</small>' + rows +
      '<button class="btn" data-lp-decline="1" style="display:block;width:100%;margin-top:12px">거절 · 강화 점수 +1</button>';
  }
  function render() { if (ov) { ov.firstChild.innerHTML = html(); } }
  function close() { if (ov) { ov.style.display = 'none'; } paint(); }
  function open() {
    if (typeof document === 'undefined' || global.DG_NO_DRAW) { return false; }
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'levelpick-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(6,8,12,.66)';
      ov.innerHTML = '<div class="enc-card" style="max-width:420px;width:100%"></div>';
      ov.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('button') : null;
        if (e.target === ov || (b && b.hasAttribute('data-lp-close'))) { close(); return; }
        if (!b) { return; }
        if (b.hasAttribute('data-lp-pick')) {
          var k = J().pick(+b.getAttribute('data-lp-pick')), sk = k && JD().skill(k);
          if (sk) { core.emit('toast', '📜 ' + sk.emoji + ' ' + sk.name + ' ' + J().levelOf(k)); }
        } else if (b.hasAttribute('data-lp-decline')) {
          if (J().decline()) { core.emit('toast', '📜 강화 점수 +1 — 무예 화면에서 쓴다'); }
        }
        if (!count()) { close(); } else { render(); }
      });
      document.body.appendChild(ov);
    }
    render();
    ov.style.display = 'flex';
    paint();
    return true;
  }
  function isOpen() { return !!(ov && ov.style.display === 'flex'); }

  /** 단추 — 쌓인 장이 있을 때만, 시트가 열려 있으면 숨긴다 */
  function paint() {
    if (typeof document === 'undefined' || global.DG_NO_DRAW || !document.body) { return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'levelpick-btn'; btn.type = 'button'; btn.className = 'btn primary';
      btn.style.cssText = 'position:fixed;right:12px;bottom:168px;z-index:30;display:none;padding:8px 12px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.4)';
      btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(); });
      document.body.appendChild(btn);
    }
    var n = count(), show = n > 0 && !isOpen() && !document.body.classList.contains('sheet-open');
    btn.style.display = show ? 'block' : 'none';
    var t = '📜 무예 3택' + (n > 1 ? ' ×' + n : '');
    if (btn.textContent !== t) { btn.textContent = t; }
  }

  core.on('job:offer', function (o) { core.emit('toast', '📜 Lv.' + o.lv + ' — 무예 3택이 생겼습니다(오른쪽 아래 단추)'); paint(); });
  core.on('changed', paint);

  global.DG = global.DG || {};
  global.DG.levelPick = { open: open, close: close, isOpen: isOpen, paint: paint, html: html };
})(window);
