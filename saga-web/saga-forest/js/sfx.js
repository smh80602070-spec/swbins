/**
 * 소리(音) — WebAudio 로 그 자리에서 만든다 (2026-09-10)
 * ===============================================================
 * 다섯 판 중 이 판(사가마을)만 여태 완전히 무음이었다. `saga-dungeon/js/sfx.js`
 * (33종 절차 음)를 그대로 본으로 삼는다 — 겹(tone·noise·chime) 셋, 지킨 선 넷
 * (첫 입력 전 잠금 · 요청은 꺼져 있어도 `_tail()`에 남긴다 · 같은 소리는 최소
 * 간격 · AudioContext 한 번만) 은 그 파일 머리말과 같다. 자세한 설계 이유는
 * `saga-dungeon/js/sfx.js`를 참고할 것 — 여기서는 되풀이하지 않는다.
 *
 * **판정 코드(village.js·animal.js·weather.js·town.js)는 거의 안 건드렸다.**
 * 대신 두 갈래로 듣는다:
 *   ① 이미 있는 이벤트를 구독한다(village:fish·village:bug·village:home·
 *      village:cave·hero:levelup·levelup) — 코드 추가 0줄
 *   ② 판정 파일엔 없지만 화면 밖에서 값으로 드러나는 것(발소리 지형·계절
 *      전환·유성)은 이 파일이 **폴링**한다(`village.raw()`·`village.tileAt()`·
 *      `villageData.season()`·`town.starNow()`는 전부 읽기 전용 공개 함수라
 *      폴링해도 판정을 안 건드린다).
 * 딱 네 곳(`mail.js`·`museum.js`를 통한 `ui.js`, 그리고 2026-09-17 §5.8①로
 * `village.js`의 `gather()` 결과 자리)에만 한 줄씩 보탰다 — 전부 "판정"이
 * 아니라 이미 결과가 난 다음의 반응 지점이라 sfx 훅을 넣기에 안전하다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var CUES = {
    /* 발소리 — 지형 다섯 (CLAUDE.md 공사 다섯 갈래와 같은 이름) */
    step_path:  { gap: 0.24, l: [{ v: 'noise', dur: 0.05, lp: 1400, lp2: 500, gain: 0.05 }] },
    step_stone: { gap: 0.24, l: [{ v: 'noise', dur: 0.04, lp: 3200, lp2: 1200, gain: 0.06 },
                                  { v: 'tone', f: 1200, f2: 900, dur: 0.03, wave: 'square', gain: 0.03 }] },
    step_grass: { gap: 0.24, l: [{ v: 'noise', dur: 0.07, lp: 2600, lp2: 900, gain: 0.045 }] },
    step_sand:  { gap: 0.24, l: [{ v: 'noise', dur: 0.09, lp: 1800, lp2: 400, gain: 0.05 }] },
    step_water: { gap: 0.26, l: [{ v: 'noise', dur: 0.1, lp: 900, lp2: 250, gain: 0.07 },
                                  { v: 'tone', f: 300, f2: 180, dur: 0.09, wave: 'sine', gain: 0.04 }] },

    /* 낚시 (village:fish) */
    fish_cast: { gap: 0.3, l: [{ v: 'noise', dur: 0.18, lp: 2200, lp2: 700, gain: 0.09 }] },
    fish_miss: { gap: 0.3, l: [{ v: 'tone', f: 360, f2: 220, dur: 0.14, wave: 'triangle', gain: 0.12 }] },
    fish_catch:{ gap: 0.3, l: [{ v: 'chime', notes: [660, 880, 1175], step: 0.06,
                                 dur: 0.35, wave: 'triangle', gain: 0.15 }] },

    /* 곤충 채집 (village:bug) */
    bug_swarm: { gap: 0.4, l: [{ v: 'tone', f: 500, f2: 460, dur: 0.5, wave: 'sawtooth', gain: 0.09 }] },
    bug_flee:  { gap: 0.2, l: [{ v: 'noise', dur: 0.12, lp: 3000, lp2: 1200, gain: 0.08 }] },
    bug_catch: { gap: 0.2, l: [{ v: 'chime', notes: [784, 1046], step: 0.05,
                                 dur: 0.2, wave: 'sine', gain: 0.13 }] },

    /* 자리(문) */
    door_home: { gap: 0.25, l: [{ v: 'noise', dur: 0.22, lp: 500, lp2: 150, gain: 0.11 },
                                 { v: 'tone', f: 180, f2: 130, dur: 0.2, wave: 'triangle', gain: 0.07 }] },
    door_cave: { gap: 0.25, l: [{ v: 'noise', dur: 0.3, lp: 320, lp2: 90, gain: 0.13 },
                                 { v: 'tone', f: 90, f2: 60, dur: 0.28, wave: 'sawtooth', gain: 0.08 }] },

    /* 자람 */
    levelup: { gap: 0.4, l: [{ v: 'chime', notes: [523, 659, 784, 1047], step: 0.08,
                               dur: 0.8, wave: 'triangle', gain: 0.16 }] },

    /* 계절·하늘 */
    season: { gap: 1.0, l: [{ v: 'chime', notes: [440, 554, 659, 880], step: 0.11,
                              dur: 1.0, wave: 'sine', gain: 0.13 }] },
    meteor: { gap: 2.0, l: [{ v: 'tone', f: 1800, f2: 500, dur: 0.6, wave: 'sine', gain: 0.10 }] },

    /* 마을살이 */
    mail:   { gap: 0.3, l: [{ v: 'chime', notes: [784, 1046], step: 0.06,
                              dur: 0.22, wave: 'sine', gain: 0.11 }] },
    donate: { gap: 0.3, l: [{ v: 'chime', notes: [659, 880, 1175, 1568], step: 0.06,
                              dur: 0.4, wave: 'triangle', gain: 0.14 }] },
    gift_ok:   { gap: 0.2, l: [{ v: 'tone', f: 440, f2: 660, dur: 0.16, wave: 'sine', gain: 0.11 }] },
    gift_love: { gap: 0.2, l: [{ v: 'chime', notes: [880, 1175, 1568], step: 0.05,
                                 dur: 0.3, wave: 'triangle', gain: 0.15 }] },
    ui:     { gap: 0.04, l: [{ v: 'tone', f: 660, f2: 620, dur: 0.05, wave: 'sine', gain: 0.06 }] },

    /* 채집(§5.8① 표준 C "효과음 3종 라운드로빈") — 나무·꽃·광물 등 일반 채집
       한 벌. 서로 다른 파형·음높이 셋을 돌려 써 같은 손짓이 매번 다르게 들린다 */
    gather_a: { gap: 0.12, l: [{ v: 'tone', f: 520, f2: 700, dur: 0.09, wave: 'triangle', gain: 0.10 }] },
    gather_b: { gap: 0.12, l: [{ v: 'tone', f: 440, f2: 580, dur: 0.10, wave: 'sine', gain: 0.10 }] },
    gather_c: { gap: 0.12, l: [{ v: 'tone', f: 600, f2: 820, dur: 0.08, wave: 'square', gain: 0.07 }] },
    gather_bonus: { gap: 0.2, l: [{ v: 'chime', notes: [659, 880, 1175], step: 0.05,
                                    dur: 0.28, wave: 'triangle', gain: 0.14 }] },
    /* 숲의 정령(PLAN §5.5) — 맑고 긴 네 음. 정령을 만난 순간 한 번 */
    spirit: { gap: 0.6, l: [{ v: 'chime', notes: [784, 988, 1319, 1568], step: 0.09,
                              dur: 0.42, wave: 'sine', gain: 0.13 }] }
  };

  /* ── 상태 ─────────────────────────────────────────────── */

  var ctx = null, master = null, unlocked = false;
  var lastAt = {};
  var recent = [];
  var RECENT_MAX = 40;
  var VOICE_MAX = 8;
  var voices = 0;

  function settings() {
    var s = core.save.settings || (core.save.settings = {});
    if (typeof s.sound !== 'boolean') { s.sound = true; }
    if (typeof s.soundVol !== 'number') { s.soundVol = 0.5; }
    return s;
  }

  function enabled() { return settings().sound !== false; }

  function setEnabled(v) {
    settings().sound = !!v;
    core.persist();
    if (v) { unlock(); play('ui'); }
    return settings().sound;
  }

  function volume() { return settings().soundVol; }
  function setVolume(v) {
    settings().soundVol = Math.max(0, Math.min(1, v));
    if (master) { master.gain.value = settings().soundVol; }
    core.persist();
    return settings().soundVol;
  }

  function unlock() {
    if (unlocked) { return true; }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { return false; }
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = settings().soundVol;
      master.connect(ctx.destination);
      if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
      unlocked = true;
      return true;
    } catch (e) {
      ctx = null; master = null;
      return false;
    }
  }

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

  function envelope(g, t0, dur, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function playTone(L, t0, mul) {
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = L.wave || 'sine';
    osc.frequency.setValueAtTime(L.f, t0);
    if (L.f2 && L.f2 !== L.f) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, L.f2), t0 + L.dur);
    }
    envelope(g, t0, L.dur, (L.gain || 0.1) * mul);
    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + L.dur + 0.02);
    return osc;
  }

  function playNoise(L, t0, mul) {
    var n = Math.max(1, Math.floor(ctx.sampleRate * L.dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0), i;
    for (i = 0; i < n; i++) { d[i] = Math.random() * 2 - 1; }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(L.lp || 1000, t0);
    if (L.lp2) { f.frequency.exponentialRampToValueAtTime(Math.max(40, L.lp2), t0 + L.dur); }
    var g = ctx.createGain();
    envelope(g, t0, L.dur, (L.gain || 0.1) * mul);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + L.dur + 0.02);
    return src;
  }

  function playChime(L, t0, mul) {
    var notes = L.notes || [], each = L.dur / Math.max(1, notes.length), i;
    for (i = 0; i < notes.length; i++) {
      playTone({ f: notes[i], f2: notes[i], dur: Math.max(each, L.dur - i * (L.step || 0.05)),
                 wave: L.wave || 'sine', gain: L.gain },
               t0 + i * (L.step || 0.05), mul);
    }
  }

  /**
   * @param key CUES 의 키. 없으면 조용히 흘린다
   * @returns {boolean} 실제로 소리가 났는가
   */
  function play(key, opts) {
    recent.push(key);
    if (recent.length > RECENT_MAX) { recent.shift(); }

    var cue = CUES[key];
    if (!cue) { return false; }
    if (!enabled() || !unlocked || !ctx || !master) { return false; }

    var now = ctx.currentTime;
    if (lastAt[key] !== undefined && now - lastAt[key] < (cue.gap || 0.05)) { return false; }
    lastAt[key] = now;
    if (voices >= VOICE_MAX) { return false; }

    var mul = (opts && typeof opts.vol === 'number') ? opts.vol : 1;
    var i, L;
    try {
      voices++;
      for (i = 0; i < cue.l.length; i++) {
        L = cue.l[i];
        var at = now + (L.at || 0);
        if (L.v === 'noise') { playNoise(L, at, mul); }
        else if (L.v === 'chime') { playChime(L, at, mul); }
        else { playTone(L, at, mul); }
      }
    } catch (e) {
      voices = Math.max(0, voices - 1);
      return false;
    }
    global.setTimeout(function () { voices = Math.max(0, voices - 1); }, 700);
    return true;
  }

  /* ── ① 이미 있는 이벤트를 그대로 받는다 ─────────────────── */

  core.on('levelup', function () { play('levelup'); });
  core.on('hero:levelup', function () { play('levelup'); });
  core.on('village:fish', function (e) {
    if (!e) { return; }
    if (e.state === 'cast') { play('fish_cast'); }
    else if (e.state === 'miss') { play('fish_miss'); }
    else if (e.state === 'catch') { play('fish_catch'); }
  });
  core.on('village:bug', function (e) {
    if (!e) { return; }
    if (e.state === 'swarm') { play('bug_swarm'); }
    else if (e.state === 'flee') { play('bug_flee'); }
    else if (e.state === 'catch') { play('bug_catch'); }
  });
  core.on('village:home', function (e) { play('door_home'); });
  core.on('village:cave', function (e) { play('door_cave'); });
  core.on('village:mail', function () { play('mail'); });

  /* 채집(§5.8①) — village.js가 판정 뒤에 한 줄 emit 한다(gather() 함수 참고).
     gather_a→b→c 를 순서대로 돌려 쓴다(라운드로빈) — 3연속 리듬 보너스는
     한 옥타브 위 쨍한 종소리로 따로 알린다 */
  var gatherRR = 0;
  var GATHER_CUES = ['gather_a', 'gather_b', 'gather_c'];
  core.on('village:gather', function (e) {
    if (e && e.bonus) { play('gather_bonus'); return; }
    play(GATHER_CUES[gatherRR % GATHER_CUES.length]);
    gatherRR++;
  });
  core.on('village:spirit', function () { play('spirit'); });

  /* ── ② 판정 파일을 안 건드리고 폴링으로만 듣는 것 ─────────
   * `village`·`villageData`·`town`은 전부 읽기 전용 공개 함수라, 여기서
   * 주기적으로 값만 비교한다 — 판정에는 손이 안 간다.
   */
  var lastSeason = null, lastStarSlot = null;
  var lastStepAt = 0, lastPX = null, lastPY = null;
  var POLL_MS = 220;

  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }
  function TW() { return global.DG.town; }

  function pollSeason() {
    var vd = VD();
    if (!vd) { return; }
    var cur = vd.season();
    if (lastSeason !== null && cur !== lastSeason) { play('season'); }
    lastSeason = cur;
  }

  function pollMeteor() {
    var tw = TW();
    if (!tw || typeof tw.starNow !== 'function') { return; }
    var s = tw.starNow();
    var slot = s ? s.slot : null;
    if (slot !== null && slot !== lastStarSlot) { play('meteor'); }
    lastStarSlot = slot;
  }

  /** 발소리 — 걸은 거리만큼만 낸다(가만히 서 있으면 안 울린다) */
  function pollSteps() {
    var v = V();
    if (!v || typeof v.raw !== 'function') { return; }
    if (v.indoors && v.indoors()) { return; }             // 집 안은 문소리만으로 충분
    var raw = v.raw();
    var p = raw && raw.player;
    if (!p) { return; }
    if (lastPX === null) { lastPX = p.x; lastPY = p.y; return; }
    var d = Math.hypot(p.x - lastPX, p.y - lastPY);
    lastPX = p.x; lastPY = p.y;
    if (d < 6) { return; }                                  // 거의 안 움직였다
    var now = (ctx && unlocked) ? ctx.currentTime : (Date.now() / 1000);
    if (now - lastStepAt < 0.22) { return; }
    lastStepAt = now;
    var TILE = v.TILE || 32;
    var kind = v.tileAt ? v.tileAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) : null;
    var key = { path: 'step_path', stone: 'step_stone', grass: 'step_grass',
                sand: 'step_sand', water: 'step_water' }[kind] || 'step_path';
    play(key);
  }

  global.setInterval(function () {
    try { pollSeason(); pollMeteor(); pollSteps(); } catch (e) { /* 화면이 아직 안 섰을 수 있다 */ }
  }, POLL_MS);

  bindUnlock();

  global.DG = global.DG || {};
  global.DG.sfx = {
    CUES: CUES,
    play: play,
    unlock: unlock, ready: function () { return unlocked; },
    enabled: enabled, setEnabled: setEnabled,
    volume: volume, setVolume: setVolume,
    _tail: function (n) { return recent.slice(-(n || 8)); },
    _clear: function () { recent.length = 0; lastAt = {}; },
    /** 진단 전용 — 폴링 함수를 직접 불러 즉시 반영시킨다(setInterval 을 안 기다린다) */
    _pollNow: function () { pollSeason(); pollMeteor(); pollSteps(); }
  };
})(window);
