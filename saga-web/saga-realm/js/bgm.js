/**
 * 배경음악(BGM) — PLAN 34절. 마을·필드·전투 셋.
 * ---------------------------------------------------------------
 * `sfx.js`(절차적 효과음)와는 다른 결이다 — 짧은 블립·타격음은 WebAudio로
 * 그 자리에서 만드는 게 낫지만(파일을 안 늘려도 서른 몇 가지가 나온다),
 * 몇 분짜리 루프 음악을 절차로 낼 방법은 없다. `sfx.js` 머리말이 "파일을
 * 안 쓰는 이유"로 든 "단독 실행판이 데이터 URI로 몇 배 부푼다"는 걱정은
 * **애초에 GLB(`asset3d.js`)에는 해당된 적이 없었다** — `build-single.mjs`는
 * css·js만 한 파일에 녹이고, GLB·이미지는 그때도 지금도 상대경로 fetch로
 * 그대로 남는다. mp3도 같은 결이라 그 걱정을 벗는다(PLAN 부록 "코드로
 * 그리지 말고 에셋으로" — 이 판이 처음 CC0 음원을 들인다, 출처는
 * `assets/ASSET_LICENSES.md`).
 *
 * `<audio loop>` 셋을 만들어 두고 필요한 하나만 재생한다(나머지는 pause).
 * 크로스페이드는 안 한다 — 즉시 전환, 과하면 다음에 손질(PLAN 35절 "과도하게
 * 사용하지 않는다"와 같은 결로 일단 단순하게 시작한다).
 *
 * **정본은 saga-web/shared/js/bgm.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 판마다 다른 것(트랙 표·기본 음량·장면 → 트랙 고르기)은 각 판 core.js 끝의 `DG.cfg.bgm` 가 준다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /* 판별 설정 — `DG.cfg.bgm = { base, tracks:{키:파일}, vol, first, desired() }`. 없으면 소리 없는 모듈이다 */
  var CFG = (global.DG.cfg && global.DG.cfg.bgm) || {};
  var BASE = CFG.base || 'assets/audio/bgm/';
  var TRACKS = CFG.tracks || {};
  var FIRST = CFG.first || Object.keys(TRACKS)[0] || null;   // 재생 전·장면을 모를 때 틀 트랙

  var els = {};        // key → <audio>
  var current = null;  // 지금 골라 놓은 트랙 키 (재생 안 됐어도 남는다)
  var unlocked = false;
  var made = false;    // <audio> 를 만들었나(처음 켤 때 한 번)

  function settings() {
    var s = core.save.settings || (core.save.settings = {});
    if (typeof s.music !== 'boolean') { s.music = true; }
    if (typeof s.musicVol !== 'number') { s.musicVol = typeof CFG.vol === 'number' ? CFG.vol : 0.4; }
    return s;
  }

  function enabled() { return settings().music !== false; }
  function volume() { return settings().musicVol; }

  /** W-0124 — 트랙 값이 [ogg, mp3] 같은 배열이면 이 브라우저가 틀 수 있는 첫 것(canPlayType). 옛 Safari·iOS 는 Ogg 를 못 틀어 조용히 무음이었다.
   *  순수에 가깝게 — audio 가 없거나 canPlayType 이 없으면 첫 것 */
  function srcOf(v, a) {
    var list = [].concat(v || []), i, t;
    for (i = 0; i < list.length; i++) {
      t = /\.ogg$/i.test(list[i]) ? 'audio/ogg; codecs=vorbis' : (/\.mp3$/i.test(list[i]) ? 'audio/mpeg' : '');
      if (!a || !a.canPlayType || !t || a.canPlayType(t)) { return list[i]; }
    }
    return list[0] || '';
  }

  /** 처음 부를 때만 <audio> 를 만든다 — `_test.html`(document 없음일 수 있는
   *  환경은 아니지만, 그래도 재생 전엔 굳이 만들지 않는다) 배려 */
  function ensureEls() {
    if (!global.document || made) { return; }
    made = true;
    var k;
    for (k in TRACKS) {
      if (!Object.prototype.hasOwnProperty.call(TRACKS, k)) { continue; }
      var a = document.createElement('audio');
      a.src = BASE + srcOf(TRACKS[k], a);
      a.loop = true;
      a.preload = 'none';   // 느린 회선 배려 — 실제로 켜기 전엔 안 받는다
      a.volume = volume();
      els[k] = a;
    }
  }

  function setEnabled(v) {
    settings().music = !!v;
    core.persist();
    if (!v) { stopAll(); } else if (unlocked) { play(current || FIRST); }
    return settings().music;
  }

  function setVolume(v) {
    var vol = Math.max(0, Math.min(1, v));
    settings().musicVol = vol;
    var k;
    for (k in els) { if (Object.prototype.hasOwnProperty.call(els, k)) { els[k].volume = vol; } }
    core.persist();
    return vol;
  }

  function stopAll() {
    var k;
    for (k in els) {
      if (!Object.prototype.hasOwnProperty.call(els, k)) { continue; }
      try { els[k].pause(); } catch (e) { /* 무시 */ }
    }
  }

  function play(key) {
    current = key;
    if (!enabled() || !unlocked || !TRACKS[key]) { return; }
    ensureEls();
    var el = els[key], k;
    if (!el) { return; }
    for (k in els) {
      if (Object.prototype.hasOwnProperty.call(els, k) && k !== key) {
        try { els[k].pause(); } catch (e) { /* 무시 */ }
      }
    }
    if (el.paused) {
      try {
        var p = el.play();
        if (p && p.catch) { p.catch(function () { /* 자동재생 막힘 — 다음 unlock에 재시도 */ }); }
      } catch (e) { /* 무시 */ }
    }
  }

  /** 지금 상태로 어느 트랙이 맞는지 — **순수 함수**(DOM 없이도 돈다, 자가진단이 부른다).
   *  마을(또는 사냥 중이 아닐 때) → town, 보스 등장 중 → battle, 그 밖의 사냥터 → forest */
  function desiredTrack() {
    return CFG.desired ? CFG.desired() : FIRST;
  }

  function tick() {
    var want = desiredTrack();
    if (want !== current) { play(want); }
  }

  function unlock() {
    if (unlocked) { return; }
    unlocked = true;
    ensureEls();
    play(desiredTrack());   // W-0124 — tick() 은 want === current 면 안 튼다. 잠금 전 'changed' 가 current 를 먼저 적으면 그 세션 내내 무음이었다
  }

  /** 브라우저는 사람이 한 번 누르기 전엔 소리를 못 낸다 — `sfx.js` 와 같은 요령이되
   *  이 파일이 스스로 건다(다른 파일은 몰라도 된다) */
  function bindUnlock() {
    if (!global.document || !document.addEventListener) { return; }
    var once = function () {
      unlock();
      document.removeEventListener('pointerdown', once, true);
      document.removeEventListener('keydown', once, true);
      document.removeEventListener('touchstart', once, true);
    };
    document.addEventListener('pointerdown', once, true);
    document.addEventListener('keydown', once, true);
    document.addEventListener('touchstart', once, true);
  }

  /** ⚙️ 설정 시트에 끼우는 두 줄(켜기/끄기·음량) — 판의 ui.js 는 이 문자열을 시트에 이어 붙이기만 한다.
   *  단추는 data-act 가 아니라 data-bgm 을 쓴다(판 ui.js 의 클릭 처리와 안 겹치게) — 이벤트는 아래에서 문서에 건다 */
  function rowsHtml() {
    var on = enabled(), vol = Math.round(volume() * 100);
    return '<div class="key-row"><b>배경음악</b>' +
      '<button data-bgm="toggle">' + (on ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row"><b>BGM 음량</b>' +
      '<input type="range" min="0" max="100" value="' + vol + '" data-bgm="vol"' + (on ? '' : ' disabled') + '>' +
      '<span class="key-cur">' + vol + '%</span></div>';
  }
  function settingsHtml() { return '<div data-bgm-box>' + rowsHtml() + '</div>'; }

  function bindSettings() {
    if (!global.document || !document.addEventListener) { return; }
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-bgm="toggle"]');
      if (!b) { return; }
      setEnabled(!enabled());
      var box = b.closest('[data-bgm-box]');
      if (box) { box.innerHTML = rowsHtml(); }
    }, true);
    document.addEventListener('input', function (e) {
      var r = e.target && e.target.matches && e.target.matches('[data-bgm="vol"]') ? e.target : null;
      if (!r) { return; }
      var v = setVolume((parseInt(r.value, 10) || 0) / 100);
      var lbl = r.nextElementSibling;
      if (lbl) { lbl.textContent = Math.round(v * 100) + '%'; }
    }, true);
  }

  bindUnlock();
  bindSettings();
  if (core && core.on) { core.on('changed', tick); }
  /* 장면이 'changed' 를 안 쏘고 바뀌는 판(전투·성 시트가 DOM 으로만 열리는 곳)은 판 설정의 poll(ms)로 가끔 본다 */
  if (CFG.poll && global.setInterval) { global.setInterval(tick, CFG.poll); }

  global.DG = global.DG || {};
  global.DG.bgm = {
    enabled: enabled, setEnabled: setEnabled,
    volume: volume, setVolume: setVolume,
    desiredTrack: desiredTrack, settingsHtml: settingsHtml, srcOf: srcOf,
    current: function () { return current; },
    unlocked: function () { return unlocked; },
    hasEl: function () { return made; }
  };
})(typeof window !== 'undefined' ? window : this);
