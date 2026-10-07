/**
 * 소리(音) — WebAudio 로 그 자리에서 만든다 (2026-09-10)
 * ===============================================================
 * 다섯 판 중 이 판(사가천하)만 여태 완전히 무음이었다. `saga-dungeon/js/sfx.js`
 * (33종 절차 음)를 그대로 본으로 삼는다 — 겹(tone·noise·chime) 셋, 지킨 선 넷
 * (첫 입력 전 잠금 · 요청은 꺼져 있어도 `_tail()`에 남긴다 · 같은 소리는 최소
 * 간격 · AudioContext 한 번만)은 그 파일 머리말과 같다. 합성 함수(playTone·
 * playNoise·playChime·envelope)도 그대로 옮겼다 — 자세한 설계 이유는
 * `saga-dungeon/js/sfx.js`를 참고할 것, 여기서는 되풀이하지 않는다.
 *
 * **이 판만의 차이 — 폴링이 아예 없다.** 사가마을(폴링 셋: 계절·유성·발소리)과
 * 달리 이 판은 **턴제**라 "화면 밖에서 값으로만 드러나는 것"이 없다 — 시간이
 * 흐르는 유일한 계기가 "다음 달" 버튼이고, 일어나는 일은 전부 `core.emit(...)`
 * 으로 이미 이름 붙어 나온다. 그래서 이 파일은 **이벤트 구독만으로 끝난다** —
 * `war.js`·`rtk.js`·`officer.js`·`diplo.js`·`ai.js` 어느 판정 파일도 단 한
 * 줄도 안 건드렸다(신규 `core.emit` 호출을 하나도 안 보탰다는 뜻).
 *
 * **"내 세력" 문턱을 넣었다.** `rtk:grew`(무장 경험치)·`rtk:promote`(승진)는
 * AI 세력의 무장에도 매달 똑같이 일어난다 — `officer.js`의 로그 문구가 이미
 * "남의 무장이 크는 것까지 알릴 것은 없다"며 화면 알림을 내 세력으로만 거르고
 * 있다(그 판단을 그대로 베꼈다). 안 거르면 세력이 열 개 안팎인 판에서 다음 달
 * 버튼 한 번에 종소리가 수십 번 겹친다. `rtk:battle`도 내 세력이 치거나
 * 맞은 싸움만 듣는다 — AI끼리의 전투까지 다 울리면 지도 반대편 소식에도
 * 계속 소리가 난다.
 *
 * ── 두 갈래로 듣는다 ──
 *   ① 이름 붙은 이벤트(`rtk:battle`·`rtk:grew`·`rtk:promote`·`rtk:end`·
 *      `rtk:discover`·`rtk:fallen`·`rtk:history`·`rtk:month`·`rtk:journey`·
 *      `rtk:journeyEvent`·`rtk:camp`·`quiz:answered`) — 판정 코드가 이미
 *      구조화해 내보내는 값을 그대로 읽는다.
 *   ② `toast` 는 이미 "결과가 난 다음 사람에게 보여줄 한 줄"이라 판정이
 *      아니다 — 그 안의 머리 이모지(🔮 천기 · 🤝 동맹/합류 · 💰 배신/귀순 ·
 *      🔍 재야 발견 · 🌻 풍년 · 🌵🌊🦠🦗 재해)로만 갈래를 가른다. 같은 이유로
 *      이미 이름 붙은 사건(승진의 '✨', 사관 오류의 '⚠️')은 여기서 다시
 *      건드리지 않는다 — 중복으로 두 번 울릴 뿐이다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var CUES = {
    /* 전투 */
    battle_win:    { gap: 0.5, l: [{ v: 'chime', notes: [523, 659, 784, 1047], step: 0.08,
                                      dur: 0.8, wave: 'triangle', gain: 0.16 }] },
    battle_routed: { gap: 0.5, l: [{ v: 'tone', f: 320, f2: 130, dur: 0.4, wave: 'sawtooth', gain: 0.13 },
                                    { v: 'noise', dur: 0.3, lp: 900, lp2: 200, gain: 0.08 }] },
    battle_dusk:   { gap: 0.5, l: [{ v: 'noise', dur: 0.3, lp: 500, lp2: 150, gain: 0.09 }] },
    duel:          { gap: 0.4, l: [{ v: 'tone', f: 1100, f2: 700, dur: 0.08, wave: 'square', gain: 0.14 },
                                    { v: 'tone', f: 1100, f2: 700, dur: 0.08, wave: 'square', gain: 0.12, at: 0.12 }] },
    /* 2026-09-10 — 라운드(무리 대 무리)가 부딪힐 때마다. `battle3d.js`가 합마다
       (실시간 재생·개입형 둘 다) 부른다 — 'duel'(일기토, 날카로운 병장기 소리)과
       달리 둔탁하게 부딪히는 느낌으로 갈랐다 */
    round_clash:   { gap: 0.35, l: [{ v: 'noise', dur: 0.14, lp: 650, lp2: 180, gain: 0.09 },
                                    { v: 'tone', f: 170, f2: 85, dur: 0.16, wave: 'sawtooth', gain: 0.07 }] },
    /* 2026-09-10 — 성벽이 실제로 한 칸 무너지는 순간(합마다는 아니고, 그 중
       성벽이 실제로 깎인 합만). 'round_clash'보다 낮고 오래 끄는 소리로 갈랐다 */
    wall_break:    { gap: 0.6, l: [{ v: 'noise', dur: 0.22, lp: 350, lp2: 90, gain: 0.13 },
                                    { v: 'tone', f: 120, f2: 50, dur: 0.3, wave: 'sawtooth', gain: 0.1 }] },

    /* 무장 */
    grow:    { gap: 0.4, l: [{ v: 'chime', notes: [523, 659], step: 0.06,
                               dur: 0.24, wave: 'sine', gain: 0.12 }] },
    promote: { gap: 0.5, l: [{ v: 'chime', notes: [392, 523, 659, 784, 1047], step: 0.08,
                               dur: 0.9, wave: 'triangle', gain: 0.17 }] },

    /* 세계 */
    history:  { gap: 1.0, l: [{ v: 'tone', f: 220, dur: 0.9, wave: 'sine', gain: 0.13 },
                               { v: 'chime', notes: [660, 880, 1320], step: 0.1,
                                 dur: 0.7, wave: 'triangle', gain: 0.13, at: 0.05 }] },
    discover: { gap: 0.5, l: [{ v: 'chime', notes: [784, 988, 1319, 1568], step: 0.06,
                               dur: 0.45, wave: 'sine', gain: 0.15 }] },
    fallen:   { gap: 1.0, l: [{ v: 'tone', f: 160, f2: 60, dur: 1.0, wave: 'sawtooth', gain: 0.14 }] },
    victory:  { gap: 2.0, l: [{ v: 'chime', notes: [523, 659, 784, 1047, 1319], step: 0.1,
                               dur: 1.3, wave: 'triangle', gain: 0.19 }] },
    defeat:   { gap: 2.0, l: [{ v: 'tone', f: 300, f2: 80, dur: 1.2, wave: 'sawtooth', gain: 0.15 },
                               { v: 'tone', f: 200, f2: 50, dur: 1.2, wave: 'sine', gain: 0.1, at: 0.15 }] },

    /* 시간 */
    month:   { gap: 0.3, l: [{ v: 'tone', f: 500, f2: 460, dur: 0.06, wave: 'sine', gain: 0.05 }] },
    newyear: { gap: 0.3, l: [{ v: 'chime', notes: [659, 880], step: 0.08,
                               dur: 0.4, wave: 'sine', gain: 0.13 }] },

    /* 원정 */
    march:        { gap: 0.4, l: [{ v: 'noise', dur: 0.12, lp: 400, lp2: 150, gain: 0.1 },
                                    { v: 'noise', dur: 0.12, lp: 400, lp2: 150, gain: 0.08, at: 0.16 }] },
    journey_good: { gap: 0.4, l: [{ v: 'chime', notes: [660, 880, 1046], step: 0.06,
                                    dur: 0.3, wave: 'triangle', gain: 0.13 }] },
    journey_bad:  { gap: 0.4, l: [{ v: 'tone', f: 260, f2: 160, dur: 0.22, wave: 'sawtooth', gain: 0.11 }] },
    camp_retreat: { gap: 0.5, l: [{ v: 'tone', f: 500, f2: 220, dur: 0.4, wave: 'triangle', gain: 0.11 }] },

    /* 학당 */
    quiz_ok:   { gap: 0.2, l: [{ v: 'chime', notes: [784, 1046], step: 0.05,
                                dur: 0.2, wave: 'sine', gain: 0.13 }] },
    quiz_miss: { gap: 0.2, l: [{ v: 'tone', f: 300, f2: 180, dur: 0.16, wave: 'triangle', gain: 0.11 }] },

    /* 사관·외교·재해 (toast 이모지로만 가른다) */
    omen:          { gap: 0.6, l: [{ v: 'chime', notes: [440, 587, 880], step: 0.09,
                                     dur: 0.6, wave: 'sine', gain: 0.14 }] },
    friendly:      { gap: 0.4, l: [{ v: 'chime', notes: [523, 659, 784], step: 0.06,
                                     dur: 0.3, wave: 'sine', gain: 0.13 }] },
    defect:        { gap: 0.4, l: [{ v: 'chime', notes: [880, 1109, 1397], step: 0.05,
                                     dur: 0.28, wave: 'square', gain: 0.11 }] },
    disaster_good: { gap: 0.6, l: [{ v: 'chime', notes: [523, 659, 880], step: 0.09,
                                     dur: 0.5, wave: 'sine', gain: 0.13 }] },
    disaster_bad:  { gap: 0.6, l: [{ v: 'tone', f: 200, f2: 120, dur: 0.5, wave: 'sawtooth', gain: 0.12 }] },

    ui: { gap: 0.04, l: [{ v: 'tone', f: 660, f2: 620, dur: 0.05, wave: 'sine', gain: 0.06 }] }
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

  /* ── 이미 있는 이벤트를 그대로 받는다(판정 파일은 한 줄도 안 건드렸다) ── */

  function me() {
    var R = global.DG.rtk;
    return (R && R.me) ? R.me() : null;
  }

  function forceOfOfficer(id) {
    var off = global.DG.off;
    var r = off && off.rec ? off.rec(id) : null;
    return r ? r.force : undefined;
  }

  var JOURNEY_BAD = { ambush: 1, bandit: 1, lost: 1 };

  core.on('rtk:battle', function (rep) {
    if (!rep) { return; }
    var mine = me();
    if (rep.force !== mine && rep.defForce !== mine) { return; }
    if (rep.duel) { play('duel'); }
    if (rep.won) { play('battle_win'); }
    else if (rep.routed) { play('battle_routed'); }
    else { play('battle_dusk'); }
  });

  core.on('rtk:grew', function (e) {
    if (!e || forceOfOfficer(e.id) !== me()) { return; }
    play('grow');
  });

  core.on('rtk:promote', function (e) {
    if (!e || forceOfOfficer(e.id) !== me()) { return; }
    play('promote');
  });

  core.on('rtk:history', function () { play('history'); });

  core.on('rtk:discover', function (e) {
    if (e && e.force === me()) { play('discover'); }
  });

  core.on('rtk:fallen', function () { play('fallen'); });

  core.on('rtk:end', function (kind) { play(kind === 'win' ? 'victory' : 'defeat'); });

  core.on('rtk:month', function (e) { play((e && e.month === 1) ? 'newyear' : 'month'); });

  core.on('rtk:journey', function (e) {
    if (e && e.kind === 'start' && e.force === me()) { play('march'); }
  });

  core.on('rtk:journeyEvent', function (e) {
    if (!e || e.force !== me()) { return; }
    play(JOURNEY_BAD[e.key] ? 'journey_bad' : 'journey_good');
  });

  core.on('rtk:camp', function (e) {
    if (e && e.kind === 'retreat' && e.force === me()) { play('camp_retreat'); }
  });

  core.on('quiz:answered', function (e) {
    if (!e) { return; }
    play(e.ok ? 'quiz_ok' : 'quiz_miss');
  });

  /* toast 는 이미 "결과가 난 다음 사람에게 보여줄 한 줄" 이라 머리 이모지로만 가른다.
     승진('✨')·사관 오류('⚠️')는 각각 rtk:promote 로 이미 울렸거나 굳이 안 울려도
     되는 것이라 여기서 또 받지 않는다 — 두 번 울리면 그게 더 어색하다 */
  var TOAST_PREFIX = [
    ['🔮', 'omen'], ['🤝', 'friendly'], ['💰', 'defect'], ['🔍', 'discover'],
    ['🌻', 'disaster_good'],
    ['🌵', 'disaster_bad'], ['🌊', 'disaster_bad'], ['🦠', 'disaster_bad'], ['🦗', 'disaster_bad']
  ];
  core.on('toast', function (msg) {
    if (typeof msg !== 'string') { return; }
    for (var i = 0; i < TOAST_PREFIX.length; i++) {
      if (msg.indexOf(TOAST_PREFIX[i][0]) === 0) { play(TOAST_PREFIX[i][1]); return; }
    }
  });

  bindUnlock();

  global.DG = global.DG || {};
  global.DG.sfx = {
    CUES: CUES,
    play: play,
    unlock: unlock, ready: function () { return unlocked; },
    enabled: enabled, setEnabled: setEnabled,
    volume: volume, setVolume: setVolume,
    _tail: function (n) { return recent.slice(-(n || 8)); },
    _clear: function () { recent.length = 0; lastAt = {}; }
  };
})(window);
