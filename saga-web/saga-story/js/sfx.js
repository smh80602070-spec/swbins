/**
 * 소리(音) — WebAudio 로 그 자리에서 만든다
 * ===============================================================
 * 원작에서 감각의 절반은 소리다. **레벨업 팡파레**와
 * **주문서가 붙는 소리**는 화면을 안 봐도 성패를 안다 — 손이 먼저 안다.
 * 사이드스크롤이라 소리가 몸에 더 붙는다: 점프·착지·줄·문이 다 소리를 낸다.
 * 이 판에는 여태 소리가 하나도 없었다.
 *
 * 왜 이 짧은 소리들만은 파일(mp3·wav)을 안 쓰나
 *   · 타격음·팡파레처럼 0.1~1초짜리는 톤·잡음·아르페지오 셋만으로 서른 몇 가지가
 *     나온다 — 파일을 몇십 개 늘리는 것보다 이 편이 가볍고 빠르다
 *   (사가나락의 `js/sfx.js` 와 같은 엔진이다 — 소리표만 이 판의 것이다)
 *
 *   **2026-09-09 정정** — 예전엔 여기 "이 저장소는 남의 에셋을 안 들인다·
 *   단독 실행판이 데이터 URI 로 부푼다"고 적혀 있었는데, 둘 다 틀렸다.
 *   `asset3d.js`의 GLB 는 처음부터 실제 파일을 fetch 로 받아 왔고(코드가
 *   그린 적 없다), `build-single.mjs` 는 css·js 만 한 파일에 녹이지 GLB·
 *   이미지는 그때도 상대경로 그대로다 — **부풀 일이 애초에 없었다.**
 *   그래서 몇 분짜리 배경음악(BGM)은 절차로 못 내니 `js/bgm.js`가 실제
 *   CC0 mp3 파일을 그 방식 그대로 쓴다(PLAN 34절, PLAN 부록 "코드로 그리지
 *   말고 에셋으로") — 짧은 효과음만 이 파일이 절차로 계속 낸다.
 *
 * 지킨 선 넷
 *   · **첫 입력 전에는 소리를 못 낸다**(브라우저 규칙). 그래서 첫 눌림에서 깨운다 —
 *     `unlock()` 은 이 파일이 스스로 문서에 걸어 둔다. 다른 파일은 몰라도 된다
 *   · **요청은 다 적고, 실제로 낼지는 그 다음이 정한다.** play() 는 꺼져 있어도
 *     `_tail()` 에 남긴다 — 판정 층과 소리 층을 가른 것이다(side.js 의 fx 와 같다).
 *     그래야 헤드리스 자가진단이 "이때 이 소리를 냈어야 한다" 를 검사할 수 있다
 *   · **같은 소리가 겹쳐 뭉개지지 않게** 최소 간격을 둔다. 사냥터에 적이 열이면
 *     타격음이 열 번 겹쳐 소음이 된다
 *   · **AudioContext 는 한 번만** 만든다. 프레임마다 만들면 몇 초 만에 죽는다
 *
 * 소리를 늘릴 때는 CUES 에 한 줄. 부르는 쪽은 `DG.sfx.play('<키>')` 뿐이다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /* ── 소리표 ───────────────────────────────────────────────
   * 한 소리는 겹(layer) 여럿이다. 겹은 셋 중 하나다:
   *   tone   f 에서 f2 로 미끄러지는 한 음     { v:'tone', f, f2, dur, wave, gain, at }
   *   noise  걸러 낸 잡음 (베기·착지·깨짐)     { v:'noise', dur, lp, lp2, gain, at }
   *   chime  음을 차례로 놓는다 (알림·팡파레)  { v:'chime', notes, step, dur, wave, gain, at }
   * at 은 시작을 늦추는 초. gap 은 이 소리의 최소 간격(초).
   *
   * 원작의 결을 따라 **밝은 쪽**으로 잡았다 — 사가나락가 낮고 탁한 데 견주면
   * 이 판은 높고 맑다. 같은 엔진으로 값만 달리 쓴 것이고, 그림 양식(maple 대 diablo)을
   * 가른 것과 같은 방식이다.
   */
  var CUES = {
    /* ── 싸움 ── */
    swing:  { gap: 0.05, l: [{ v: 'noise', dur: 0.06, lp: 3200, lp2: 900, gain: 0.10 }] },
    hit:    { gap: 0.04, l: [{ v: 'noise', dur: 0.06, lp: 1800, lp2: 500, gain: 0.15 },
                             { v: 'tone', f: 640, f2: 300, dur: 0.06, wave: 'square', gain: 0.07 }] },
    /* 손맛 표준(§5-7) — 'hit' 라운드로빈 짝 둘. 필터·박자는 그대로, 톤 층
       주파수만 ±6% 밀어 연타가 다 같은 소리로 안 들리게 한다(사가나락
       hit1/2/3 이 필터로 가른 것과 달리, 이 판은 PLAN 원문의 "피치 변주"
       그대로 갔다). */
    hit2:   { gap: 0.04, l: [{ v: 'noise', dur: 0.06, lp: 1800, lp2: 500, gain: 0.15 },
                             { v: 'tone', f: 602, f2: 282, dur: 0.06, wave: 'square', gain: 0.07 }] },
    hit3:   { gap: 0.04, l: [{ v: 'noise', dur: 0.06, lp: 1800, lp2: 500, gain: 0.15 },
                             { v: 'tone', f: 678, f2: 318, dur: 0.06, wave: 'square', gain: 0.07 }] },
    /* 적이 사라질 때 — 원작의 그 짧은 '펑' */
    kill:   { gap: 0.05, l: [{ v: 'noise', dur: 0.14, lp: 2600, lp2: 300, gain: 0.14 },
                             { v: 'tone', f: 520, f2: 160, dur: 0.14, wave: 'triangle', gain: 0.10 }] },
    /* 급소(急所) — 원작의 크리티컬. 타격음 위에 **맑은 한 음**을 얹어 가른다.
       귀가 먼저 안다 — 숫자를 읽기 전에 손이 반응한다 */
    crit:   { gap: 0.05, l: [{ v: 'noise', dur: 0.08, lp: 3200, lp2: 600, gain: 0.16 },
                             { v: 'tone', f: 1568, f2: 2093, dur: 0.10, wave: 'sine', gain: 0.10 },
                             { v: 'tone', f: 780, f2: 340, dur: 0.09, wave: 'square', gain: 0.07 }] },

    /* 보스 — 등장할 때 한 번, 달려들기 직전에 한 번 */
    boss:   { gap: 0.5,  l: [{ v: 'tone', f: 160, f2: 96, dur: 0.7, wave: 'sawtooth', gain: 0.16 },
                             { v: 'noise', dur: 0.5, lp: 700, lp2: 130, gain: 0.16 }] },
    charge: { gap: 0.4,  l: [{ v: 'tone', f: 220, f2: 660, dur: 0.35, wave: 'square', gain: 0.12 }] },
    bosskill:{ gap: 0.8, l: [{ v: 'chime', notes: [392, 523, 659, 784, 1047], step: 0.09,
                               dur: 1.0, wave: 'triangle', gain: 0.17 },
                             { v: 'noise', dur: 0.5, lp: 1400, lp2: 200, gain: 0.14 }] },
    hurt:   { gap: 0.2,  l: [{ v: 'tone', f: 420, f2: 150, dur: 0.16, wave: 'sawtooth', gain: 0.15 }] },
    /* 쓰러짐 — 내려가는 넷. 이 판은 금 절반만 잃으므로 무겁게 두지 않았다 */
    die:    { gap: 1.0,  l: [{ v: 'chime', notes: [523, 415, 330, 262], step: 0.12,
                               dur: 0.8, wave: 'triangle', gain: 0.18 }] },

    /* ── 무예 ──
     * 효과 아홉을 소리 넷으로 묶었다. 소리마다 하나씩 두면 서로 안 구별된다 —
     * 귀가 가리는 것은 "가까이 벤다 / 멀리 쏜다 / 몸을 두른다 / 낫는다" 넷이다.
     */
    skill:  { gap: 0.05, l: [{ v: 'tone', f: 520, f2: 1400, dur: 0.14, wave: 'sine', gain: 0.13 }] },
    shot:   { gap: 0.04, l: [{ v: 'noise', dur: 0.07, lp: 5200, lp2: 1600, gain: 0.09 },
                             { v: 'tone', f: 1200, f2: 2400, dur: 0.08, wave: 'sine', gain: 0.06 }] },
    buff:   { gap: 0.3,  l: [{ v: 'chime', notes: [659, 880, 1175], step: 0.07,
                               dur: 0.5, wave: 'sine', gain: 0.13 }] },
    heal:   { gap: 0.2,  l: [{ v: 'chime', notes: [784, 1047, 1319], step: 0.06,
                               dur: 0.45, wave: 'sine', gain: 0.12 }] },
    /* 적이 쏘기 직전 ❗ — 화면의 그 표시와 짝이다 */
    aim:    { gap: 0.25, l: [{ v: 'tone', f: 1568, f2: 1568, dur: 0.07, wave: 'square', gain: 0.06 }] },

    /* ── 몸 ──
     * 사이드스크롤이라 이 넷이 가장 자주 난다. 그래서 **가장 작고 짧게** 잡았다 —
     * 크게 잡으면 5분 자동 사냥에 귀가 먼저 지친다.
     */
    jump:   { gap: 0.08, l: [{ v: 'tone', f: 300, f2: 720, dur: 0.09, wave: 'sine', gain: 0.08 }] },
    /* 회피(PLAN 12절) — 미끄러지는 '슈웃', 급소·타격보다 낮고 짧게 잡아 연타에 안 묻힌다 */
    dodge:  { gap: 0.3,  l: [{ v: 'noise', dur: 0.12, lp: 2600, lp2: 400, gain: 0.09 }] },
    land:   { gap: 0.10, l: [{ v: 'noise', dur: 0.07, lp: 700, lp2: 180, gain: 0.09 }] },
    grab:   { gap: 0.15, l: [{ v: 'noise', dur: 0.06, lp: 1400, lp2: 500, gain: 0.07 }] },
    /* 줄을 타는 동안 한 칸씩 — 원작의 그 사각사각 */
    climb:  { gap: 0.22, l: [{ v: 'noise', dur: 0.05, lp: 2200, lp2: 800, gain: 0.05 }] },
    sit:    { gap: 0.4,  l: [{ v: 'tone', f: 420, f2: 300, dur: 0.14, wave: 'sine', gain: 0.06 }] },
    /* 문 — 원작에서 옆 사냥터로 넘어갈 때 나던 그 '슈웅' */
    portal: { gap: 0.35, l: [{ v: 'tone', f: 260, f2: 1500, dur: 0.32, wave: 'sine', gain: 0.13 },
                             { v: 'noise', dur: 0.3, lp: 900, lp2: 4000, gain: 0.07 }] },
    enter:  { gap: 0.5,  l: [{ v: 'chime', notes: [523, 659, 784], step: 0.07,
                               dur: 0.5, wave: 'triangle', gain: 0.12 }] },
    /* 마을 사람에게 말을 건다 — quest 보다 짧고 낮게, 자주 눌러도 안 거슬리게 */
    talk:   { gap: 0.2,  l: [{ v: 'chime', notes: [523, 659], step: 0.06,
                               dur: 0.18, wave: 'sine', gain: 0.08 }] },

    /* ── 물건 ── */
    gold:   { gap: 0.06, l: [{ v: 'chime', notes: [1568, 2093], step: 0.03,
                               dur: 0.12, wave: 'triangle', gain: 0.09 }] },
    gear:   { gap: 0.08, l: [{ v: 'chime', notes: [880, 1175, 1568], step: 0.05,
                               dur: 0.3, wave: 'triangle', gain: 0.13 }] },
    /* 고유(固有) — 이름 있는 물건이 나올 때만. gear 보다 한 음 더 얹고 높이 올라간다 */
    uniq:   { gap: 0.6,  l: [{ v: 'chime', notes: [659, 880, 1109, 1397, 1760], step: 0.06,
                               dur: 0.55, wave: 'triangle', gain: 0.18 },
                             { v: 'tone', f: 2093, f2: 2093, dur: 0.4, wave: 'sine', gain: 0.08, at: 0.05 }] },
    scroll: { gap: 0.08, l: [{ v: 'noise', dur: 0.14, lp: 4200, lp2: 1600, gain: 0.08 }] },
    potion: { gap: 0.15, l: [{ v: 'tone', f: 300, f2: 820, dur: 0.22, wave: 'sine', gain: 0.12 }] },
    /* 가방이 차서 못 줍는다 — 답답함도 규칙이라 소리로도 알린다 */
    bagfull:{ gap: 0.6,  l: [{ v: 'tone', f: 320, f2: 200, dur: 0.16, wave: 'square', gain: 0.09 }] },

    /* ── 주문서 ──
     * **이 파일이 있는 까닭의 절반이다.** 원작에서 주문서를 긁는 순간, 화면을 보기 전에
     * 소리로 성패를 안다. 그래서 둘을 아주 다르게 잡았다 — 오르는 화음 대 떨어지는 잡음.
     */
    scrollok:  { gap: 0.3, l: [{ v: 'chime', notes: [784, 1047, 1319, 1760], step: 0.06,
                                 dur: 0.6, wave: 'sine', gain: 0.16 },
                               { v: 'tone', f: 2093, f2: 2093, dur: 0.7, wave: 'sine', gain: 0.06, at: 0.06 }] },
    scrollno:  { gap: 0.3, l: [{ v: 'noise', dur: 0.3, lp: 1600, lp2: 160, gain: 0.15 },
                               { v: 'tone', f: 330, f2: 110, dur: 0.3, wave: 'sawtooth', gain: 0.10 }] },

    /* ── 자람 ──
     * 레벨업은 원작에서 가장 널리 알려진 소리다. 오르는 다섯 음 + 위에 얹는 한 음.
     */
    levelup: { gap: 0.6, l: [{ v: 'chime', notes: [523, 659, 784, 1047, 1319], step: 0.075,
                               dur: 0.9, wave: 'triangle', gain: 0.17 },
                             { v: 'tone', f: 1568, f2: 1568, dur: 0.5, wave: 'sine', gain: 0.07, at: 0.32 }] },
    /* 전직 — 되돌릴 수 없는 자리라 레벨업보다 길고 낮게 시작한다 */
    jobup:   { gap: 0.8, l: [{ v: 'chime', notes: [392, 523, 659, 784, 1047, 1319], step: 0.10,
                               dur: 1.3, wave: 'sine', gain: 0.16 }] },
    skillup: { gap: 0.1, l: [{ v: 'chime', notes: [1047, 1568], step: 0.045,
                               dur: 0.2, wave: 'sine', gain: 0.11 }] },
    quest:   { gap: 0.2, l: [{ v: 'chime', notes: [659, 880], step: 0.07,
                               dur: 0.3, wave: 'triangle', gain: 0.11 }] },
    questdone:{ gap: 0.4, l: [{ v: 'chime', notes: [880, 1175, 1568, 2093], step: 0.07,
                                dur: 0.7, wave: 'triangle', gain: 0.15 }] },

    /* ── 저자 · 손짓 ── */
    coin:   { gap: 0.1,  l: [{ v: 'chime', notes: [1175, 1568], step: 0.04,
                               dur: 0.16, wave: 'triangle', gain: 0.10 }] },
    sheet:  { gap: 0.05, l: [{ v: 'noise', dur: 0.08, lp: 2600, lp2: 900, gain: 0.06 }] },
    ui:     { gap: 0.04, l: [{ v: 'tone', f: 780, f2: 740, dur: 0.045, wave: 'sine', gain: 0.06 }] },
    nope:   { gap: 0.2,  l: [{ v: 'tone', f: 260, f2: 190, dur: 0.12, wave: 'square', gain: 0.08 }] }
  };

  /* ── 상태 ─────────────────────────────────────────────── */

  var ctx = null;                 // AudioContext — **한 번만** 만든다
  var master = null;
  var unlocked = false;
  var lastAt = {};                // 소리마다 마지막으로 낸 시각(초)
  var recent = [];                // 최근 요청 (진단이 읽는다)
  var RECENT_MAX = 40;
  var VOICE_MAX = 8;              // 동시에 우는 겹의 상한 (넘으면 새 것을 버린다)
  var voices = 0;

  function settings() {
    var s = core.save.settings || (core.save.settings = {});
    if (typeof s.sound !== 'boolean') { s.sound = true; }
    if (typeof s.soundVol !== 'number') { s.soundVol = 0.5; }
    if (typeof s.vibrate !== 'boolean') { s.vibrate = true; }
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

  /* 진동(PLAN 30절) — 늘 켜는 것이 아니라 **꼽힐 만한 순간에만** 짧게 운다.
     기본 공격까지 울리면 성가시기만 해서(연타마다 부르르 떨림) 급소·보스·
     레벨업·사명완료·피격처럼 화면 연출이 따로 붙는 순간만 골랐다 — PLAN 35절
     배너와 짝이 맞는 목록이다. */
  var VIBE_PATTERNS = {
    crit: [12, 30, 14], boss: [20, 40, 20], bosskill: [16, 30, 16, 30, 26],
    levelup: [10, 20, 10, 20, 30], questdone: [10, 20, 10, 20, 30], hurt: 16
  };

  function vibrateEnabled() { return settings().vibrate !== false; }

  function setVibrateEnabled(v) {
    settings().vibrate = !!v;
    core.persist();
    if (v) { vibrateFor('crit'); }
    return settings().vibrate;
  }

  function vibrateFor(key) {
    var pat = VIBE_PATTERNS[key];
    if (!pat || !vibrateEnabled() || !global.navigator || !navigator.vibrate) { return; }
    try { navigator.vibrate(pat); } catch (e) { /* 일부 브라우저는 권한 없이 부르면 던진다 */ }
  }

  /* ── 깨우기 ───────────────────────────────────────────────
   * 브라우저는 **사람이 한 번 누르기 전에는** 소리를 못 내게 한다.
   * 그래서 첫 눌림·첫 키에서 만든다. 여기서 한 번만 걸어 두면
   * 게임 쪽 코드는 이 규칙을 아예 몰라도 된다.
   */
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

  /* ── 겹 하나씩 ────────────────────────────────────────── */

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

  /** 잡음 한 줌 — 짧은 버퍼를 만들어 저역 통과로 깎는다 */
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

  /* ── 낸다 ─────────────────────────────────────────────── */

  /**
   * @param key  CUES 의 키. 없는 키는 조용히 흘린다(부르는 쪽이 안 죽는다)
   * @param opts {vol} 이번 한 번만 크기를 곱한다
   * @returns {boolean} 실제로 소리가 났는가 (꺼져 있거나 안 깨웠으면 false)
   */
  function play(key, opts) {
    /* **요청은 무조건 적는다** — 소리가 안 나도 남는다. 진단이 이걸 읽는다 */
    recent.push(key);
    if (recent.length > RECENT_MAX) { recent.shift(); }

    var cue = CUES[key];
    if (!cue) { return false; }
    vibrateFor(key);                    // 소리를 꺼 두었어도 진동은 따로 돈다
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
    /* 겹이 다 울고 나면 자리를 돌려준다 — setTimeout 하나면 충분하다 */
    global.setTimeout(function () { voices = Math.max(0, voices - 1); }, 700);
    return true;
  }

  /**
   * 무예 하나가 낼 소리 — **효과(effect)로 고른다.**
   * 스물여덟에 하나씩 두면 서로 구별되지 않는다. 귀가 가리는 것은 넷뿐이다:
   * 가까이 벤다 · 멀리 쏜다 · 몸을 두른다 · 낫는다.
   */
  function skillCue(effect) {
    if (effect === 'heal') { return 'heal'; }
    if (effect === 'buff') { return 'buff'; }
    if (effect === 'arrow' || effect === 'volley' || effect === 'bolt' || effect === 'rain') { return 'shot'; }
    return 'skill';
  }

  /** 떨어진 것 하나가 낼 소리 — 무엇이 떨어졌는지 **보기 전에** 알게 하는 자리 */
  function dropCue(kind) {
    if (kind === 'gold') { return 'gold'; }
    if (kind === 'potion') { return 'potion'; }
    if (kind === 'scroll') { return 'scroll'; }
    return 'gear';
  }

  /* ── 이벤트에 물린다 ──────────────────────────────────────
   * 이미 있는 이벤트로 되는 것은 여기서 받는다 — 그 파일들을 안 건드린다.
   * 프레임마다 나는 소리(타격·줍기·점프·줄)는 side.js 가 fx.push 옆에서 부른다.
   */
  core.on('levelup', function () { play('levelup'); });
  core.on('side:enter', function () { play('enter'); });
  core.on('side:travel', function () { play('portal'); });
  core.on('side:end', function (e) {
    if (e && e.dead) { play('die'); }
  });

  bindUnlock();

  global.DG = global.DG || {};
  global.DG.sfx = {
    CUES: CUES,
    play: play, skillCue: skillCue, dropCue: dropCue,
    unlock: unlock, ready: function () { return unlocked; },
    enabled: enabled, setEnabled: setEnabled,
    volume: volume, setVolume: setVolume,
    vibrateEnabled: vibrateEnabled, setVibrateEnabled: setVibrateEnabled,
    /** 최근 요청 n 개 (진단용 — 소리가 꺼져 있어도 남는다) */
    _tail: function (n) { return recent.slice(-(n || 8)); },
    _clear: function () { recent.length = 0; lastAt = {}; }
  };
})(window);
