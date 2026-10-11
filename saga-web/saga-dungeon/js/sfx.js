/**
 * 소리(音) — WebAudio 로 그 자리에서 만든다
 * ===============================================================
 * 원작에서 감각의 절반은 소리다. 바닥에 뭐가 떨어졌는지 **보기 전에**
 * 소리로 안다 — 특히 유니크가 떨어질 때 나는 그 **종소리**. 화면을 안 봐도
 * 손이 먼저 멈춘다. 이 판에는 여태 소리가 하나도 없었다.
 *
 * 왜 파일(mp3·wav)을 안 쓰나
 *   · 이 저장소는 남의 에셋을 안 들인다(그림도 코드가 그린다 — sprite.js 와 같은 규칙)
 *   · 단독 실행판(build-single.mjs)은 **파일 하나**다. 소리를 data URI 로 우겨넣으면
 *     그 한 파일이 몇 배로 부푼다
 *   그래서 **절차적으로** 낸다. 톤·노이즈·아르페지오 셋이면 스무 가지가 나온다.
 *
 * 지킨 선 넷
 *   · **첫 입력 전에는 소리를 못 낸다**(브라우저 규칙). 그래서 첫 눌림에서 깨운다 —
 *     `unlock()` 은 이 파일이 스스로 문서에 걸어 둔다. 다른 파일은 몰라도 된다
 *   · **요청은 다 적고, 실제로 낼지는 그 다음이 정한다.** play() 는 꺼져 있어도
 *     `_tail()` 에 남긴다 — 판정 층과 소리 층을 가른 것이다(dungeon.js 의 fx 와 같다).
 *     그래야 헤드리스 자가진단이 "이때 이 소리를 냈어야 한다" 를 검사할 수 있다
 *   · **같은 소리가 겹쳐 뭉개지지 않게** 최소 간격을 둔다. 방에 적이 여덟이면
 *     타격음이 여덟 번 겹쳐 소음이 된다
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
   *   noise  걸러 낸 잡음 (타격·삐걱·깨짐)     { v:'noise', dur, lp, lp2, gain, at }
   *   chime  음을 차례로 놓는다 (알림·종)      { v:'chime', notes, step, dur, wave, gain, at }
   * at 은 시작을 늦추는 초. gap 은 이 소리의 최소 간격(초).
   */
  var CUES = {
    /* 전투 */
    hit:   { gap: 0.05, l: [{ v: 'noise', dur: 0.07, lp: 900, lp2: 300, gain: 0.16 }] },
    crit:  { gap: 0.06, l: [{ v: 'noise', dur: 0.11, lp: 2400, lp2: 500, gain: 0.24 },
                            { v: 'tone', f: 880, f2: 190, dur: 0.12, wave: 'square', gain: 0.12 }] },
    kill:  { gap: 0.06, l: [{ v: 'noise', dur: 0.22, lp: 520, lp2: 140, gain: 0.20 },
                            { v: 'tone', f: 190, f2: 62, dur: 0.20, wave: 'triangle', gain: 0.13 }] },
    boss:  { gap: 0.4,  l: [{ v: 'noise', dur: 0.5, lp: 400, lp2: 90, gain: 0.26 },
                            { v: 'tone', f: 110, f2: 41, dur: 0.6, wave: 'sawtooth', gain: 0.16 }] },
    skill: { gap: 0.05, l: [{ v: 'tone', f: 300, f2: 1180, dur: 0.17, wave: 'sine', gain: 0.15 }] },
    hurt:  { gap: 0.15, l: [{ v: 'tone', f: 180, f2: 72, dur: 0.18, wave: 'sawtooth', gain: 0.17 }] },
    /* 회피(전용 회피 버튼) — 스치는 바람 소리 하나만. 2026-09-10 */
    dash:  { gap: 0.1,  l: [{ v: 'noise', dur: 0.12, lp: 1800, lp2: 600, gain: 0.14 }] },
    /* 저스트 회피(§5.8②, 2026-09-18) — 보통 회피보다 한 톤 위로 스치고 짧은
       "됐다" 종소리를 얹는다. 판정(0.15s 창)은 dungeon.js 가 한다 */
    dodgeJust: { gap: 0.1, l: [{ v: 'noise', dur: 0.1, lp: 2400, lp2: 900, gain: 0.15 },
                                { v: 'tone', f: 700, f2: 1400, dur: 0.12, wave: 'sine', gain: 0.08 }] },
    /* 타격음 3종 라운드로빈(§5.8①, 2026-09-18) — dungeon.js 가 콤보 수로
       순서를 돌리고, 무기 look 결은 play() 의 opts.lpMul 로 얹는다(밝을수록
       도검·활, 둔할수록 둔기 — WEAPON_LP_MUL 표 참고) */
    hit1:  { gap: 0.05, l: [{ v: 'noise', dur: 0.06,  lp: 1100, lp2: 380, gain: 0.15 }] },
    hit2:  { gap: 0.05, l: [{ v: 'noise', dur: 0.08,  lp: 800,  lp2: 260, gain: 0.17 }] },
    hit3:  { gap: 0.05, l: [{ v: 'noise', dur: 0.055, lp: 1400, lp2: 480, gain: 0.14 }] },
    /* 강공격 — 평타보다 굵고 낮게 짓누르는 소리. 2026-09-10 */
    heavy: { gap: 0.1,  l: [{ v: 'noise', dur: 0.16, lp: 700, lp2: 220, gain: 0.22 },
                            { v: 'tone', f: 140, f2: 60, dur: 0.15, wave: 'sawtooth', gain: 0.1 }] },
    /* 투장 전용 무예 — 세트를 맞춘 보상이라 'skill'보다 한 겹 더 화려하게. 2026-09-10 */
    setsk: { gap: 0.15, l: [{ v: 'noise', dur: 0.2, lp: 2600, lp2: 600, gain: 0.18 },
                            { v: 'chime', notes: [392, 659, 988], step: 0.05,
                              dur: 0.5, wave: 'sine', gain: 0.15 }] },
    /* 어그로 — 적이 막 알아챘을 때의 짧고 낮은 "엇" 소리. 2026-09-10 */
    alert: { gap: 0.12, l: [{ v: 'tone', f: 260, f2: 520, dur: 0.09, wave: 'square', gain: 0.09 }] },
    /* 죽음 — 내려가던 것이 멎는 소리. 결사(하드코어)면 이게 마지막이다 */
    die:   { gap: 1.0,  l: [{ v: 'chime', notes: [330, 247, 165, 110], step: 0.13,
                              dur: 0.9, wave: 'triangle', gain: 0.20 }] },

    /* 줍기 — **등급마다 다르게 들려야** 보기 전에 안다 (원작의 그 반사신경) */
    gold:  { gap: 0.09, l: [{ v: 'chime', notes: [1568, 2093], step: 0.035,
                              dur: 0.13, wave: 'triangle', gain: 0.10 }] },
    drop0: { gap: 0.07, l: [{ v: 'tone', f: 520, f2: 420, dur: 0.07, wave: 'triangle', gain: 0.10 }] },
    drop1: { gap: 0.07, l: [{ v: 'chime', notes: [523, 784], step: 0.05,
                              dur: 0.22, wave: 'triangle', gain: 0.13 }] },
    drop2: { gap: 0.07, l: [{ v: 'chime', notes: [659, 988, 1319], step: 0.05,
                              dur: 0.30, wave: 'triangle', gain: 0.14 }] },
    drop3: { gap: 0.07, l: [{ v: 'chime', notes: [784, 1047, 1319, 1568], step: 0.055,
                              dur: 0.40, wave: 'sine', gain: 0.15 }] },
    drop4: { gap: 0.07, l: [{ v: 'chime', notes: [1047, 1319, 1568, 2093], step: 0.06,
                              dur: 0.55, wave: 'sine', gain: 0.16 }] },
    /* 고유(固有) — **원작의 그 종소리**. 이 파일이 있는 까닭의 절반이다.
       길게 남는 사인 음 셋을 겹쳐 종처럼 울린다 */
    uniq:  { gap: 0.5,  l: [{ v: 'tone', f: 1318, f2: 1318, dur: 1.6, wave: 'sine', gain: 0.17 },
                            { v: 'tone', f: 1976, f2: 1976, dur: 1.2, wave: 'sine', gain: 0.09, at: 0.02 },
                            { v: 'tone', f: 2637, f2: 2630, dur: 0.9, wave: 'sine', gain: 0.06, at: 0.04 },
                            { v: 'tone', f: 659, f2: 659, dur: 1.8, wave: 'sine', gain: 0.08 }] },
    mat:   { gap: 0.07, l: [{ v: 'chime', notes: [880, 1320], step: 0.04,
                              dur: 0.18, wave: 'sine', gain: 0.11 }] },
    rune:  { gap: 0.10, l: [{ v: 'chime', notes: [523, 784, 1046], step: 0.07,
                              dur: 0.5, wave: 'sine', gain: 0.13 }] },
    jewel: { gap: 0.10, l: [{ v: 'chime', notes: [1046, 1318, 1568, 1318], step: 0.05,
                              dur: 0.45, wave: 'sine', gain: 0.13 }] },
    potion:{ gap: 0.10, l: [{ v: 'tone', f: 260, f2: 700, dur: 0.24, wave: 'sine', gain: 0.13 }] },
    scroll:{ gap: 0.10, l: [{ v: 'noise', dur: 0.16, lp: 3600, lp2: 1400, gain: 0.09 }] },

    /* 자리 */
    door:  { gap: 0.25, l: [{ v: 'noise', dur: 0.34, lp: 340, lp2: 140, gain: 0.15 },
                            { v: 'tone', f: 96, f2: 78, dur: 0.3, wave: 'sawtooth', gain: 0.07 }] },
    floor: { gap: 0.3,  l: [{ v: 'tone', f: 220, f2: 96, dur: 0.45, wave: 'triangle', gain: 0.14 },
                            { v: 'noise', dur: 0.4, lp: 500, lp2: 120, gain: 0.10 }] },
    enter: { gap: 0.5,  l: [{ v: 'tone', f: 130, f2: 98, dur: 0.9, wave: 'sawtooth', gain: 0.12 }] },
    jar:   { gap: 0.05, l: [{ v: 'noise', dur: 0.12, lp: 5200, lp2: 900, gain: 0.14 }] },
    chest: { gap: 0.2,  l: [{ v: 'noise', dur: 0.2, lp: 1200, lp2: 300, gain: 0.10 },
                            { v: 'chime', notes: [659, 880, 1175], step: 0.06,
                              dur: 0.4, wave: 'triangle', gain: 0.13, at: 0.08 }] },
    well:  { gap: 0.2,  l: [{ v: 'tone', f: 620, f2: 260, dur: 0.35, wave: 'sine', gain: 0.11 }] },
    shrine:{ gap: 0.3,  l: [{ v: 'chime', notes: [440, 659, 880, 1319], step: 0.09,
                              dur: 0.8, wave: 'sine', gain: 0.14 }] },
    waypoint: { gap: 0.3, l: [{ v: 'chime', notes: [392, 587, 784], step: 0.08,
                               dur: 0.7, wave: 'sine', gain: 0.13 }] },

    /* 자람 · 세공 */
    levelup: { gap: 0.4, l: [{ v: 'chime', notes: [523, 659, 784, 1047], step: 0.08,
                               dur: 0.8, wave: 'triangle', gain: 0.16 }] },
    socket:{ gap: 0.1,  l: [{ v: 'noise', dur: 0.08, lp: 1600, lp2: 400, gain: 0.16 },
                            { v: 'tone', f: 700, f2: 260, dur: 0.12, wave: 'square', gain: 0.10 }] },
    /* 부문어가 이루어질 때 — 화음 하나를 통째로 울린다 */
    word:  { gap: 0.4,  l: [{ v: 'tone', f: 392, f2: 392, dur: 1.1, wave: 'sine', gain: 0.12 },
                            { v: 'tone', f: 523, f2: 523, dur: 1.0, wave: 'sine', gain: 0.10, at: 0.05 },
                            { v: 'tone', f: 659, f2: 659, dur: 0.9, wave: 'sine', gain: 0.09, at: 0.10 },
                            { v: 'tone', f: 784, f2: 784, dur: 0.8, wave: 'sine', gain: 0.08, at: 0.15 }] },
    forge: { gap: 0.2,  l: [{ v: 'noise', dur: 0.26, lp: 2000, lp2: 300, gain: 0.13 },
                            { v: 'chime', notes: [587, 880], step: 0.07,
                              dur: 0.3, wave: 'triangle', gain: 0.11, at: 0.1 }] },
    coin:  { gap: 0.1,  l: [{ v: 'chime', notes: [1175, 1568], step: 0.04,
                              dur: 0.16, wave: 'triangle', gain: 0.10 }] },
    ui:    { gap: 0.04, l: [{ v: 'tone', f: 660, f2: 620, dur: 0.05, wave: 'sine', gain: 0.07 }] },

    /* 환경음(PLAN 37절) — 층 결(THEME_AMB)이 이 조각들을 드문드문 섞어 튼다.
       늘 나는 결(드론·바람)은 CUES 가 아니라 startAmbience() 가 따로 잇는다 —
       ADSR 한 방으로 끝나는 이 표의 소리와 달리 **눌러도 안 끊긴다.** */
    amb_drip:  { gap: 1.4, l: [{ v: 'tone', f: 1200, f2: 700, dur: 0.12, wave: 'sine', gain: 0.06 }] },
    amb_metal: { gap: 1.8, l: [{ v: 'noise', dur: 0.35, lp: 2200, lp2: 600, gain: 0.05 },
                               { v: 'tone', f: 2400, f2: 1800, dur: 0.3, wave: 'triangle', gain: 0.03 }] },
    amb_crow:  { gap: 2.6, l: [{ v: 'tone', f: 520, f2: 340, dur: 0.28, wave: 'sawtooth', gain: 0.05 }] },
    amb_bird:  { gap: 1.6, l: [{ v: 'chime', notes: [2200, 2600, 2000], step: 0.045,
                                dur: 0.18, wave: 'sine', gain: 0.045 }] },
    amb_leaf:  { gap: 0.9, l: [{ v: 'noise', dur: 0.25, lp: 3800, lp2: 1600, gain: 0.035 }] },
    amb_water: { gap: 0.7, l: [{ v: 'noise', dur: 0.18, lp: 2600, lp2: 900, gain: 0.04 }] },
    amb_bug:   { gap: 1.2, l: [{ v: 'tone', f: 3200, f2: 2900, dur: 0.09, wave: 'sine', gain: 0.03 }] },
    amb_ember: { gap: 0.9, l: [{ v: 'noise', dur: 0.14, lp: 1400, lp2: 400, gain: 0.05 }] },
    amb_growl: { gap: 3.6, l: [{ v: 'tone', f: 90, f2: 55, dur: 0.6, wave: 'sawtooth', gain: 0.06 }] },
    amb_chime: { gap: 2.2, l: [{ v: 'chime', notes: [1568, 2093, 1760], step: 0.09,
                                dur: 0.6, wave: 'sine', gain: 0.05 }] },
    amb_wind:  { gap: 1.8, l: [{ v: 'noise', dur: 0.9, lp: 900, lp2: 300, gain: 0.045 }] }
  };

  /**
   * 층 테마(THEME_AMB) — PLAN 37절 "환경별 사운드". PLAN 원문은 Forest·Ruins·
   * Swamp 셋인데 이 판은 층 테마가 여섯(data-dungeon.js THEMES)이라 그 결로
   * 옮긴다 — 산채(山寨)가 숲의 자리(새·바람·나뭇잎), 폐성(廢城)이 폐허의
   * 자리(바람·금속음), 수궁(水宮)이 늪의 자리(물·벌레)를 그대로 받고,
   * 고분·지옥문·천계 셋을 이 판만의 결로 더했다(28절 월드맵·30절 장비와
   * 같은 판단 — PLAN 은 자리표시자다).
   *
   *   drone  늘 우는 낮은 음 하나(없으면 안 켠다)
   *   noise  늘 이는 걸러 낸 잡음(바람·물, 없으면 안 켠다)
   *   ticks  드문드문 섞이는 CUES 키 (scheduleTick 이 무작위로 하나씩 고른다)
   */
  var THEME_AMB = {
    '고분(古墳)':   { drone: { f: 55, wave: 'sine', gain: 0.05 }, noise: { lp: 500, gain: 0.02 },
                     ticks: ['amb_drip', 'amb_metal'] },
    '폐성(廢城)':   { drone: { f: 70, wave: 'sawtooth', gain: 0.035 }, noise: { lp: 900, gain: 0.035 },
                     ticks: ['amb_wind', 'amb_metal', 'amb_crow'] },
    '산채(山寨)':   { drone: null, noise: { lp: 1600, gain: 0.025 },
                     ticks: ['amb_bird', 'amb_leaf', 'amb_wind'] },
    '수궁(水宮)':   { drone: { f: 120, wave: 'sine', gain: 0.03 }, noise: { lp: 1200, gain: 0.03 },
                     ticks: ['amb_water', 'amb_bug'] },
    '지옥문(地獄門)': { drone: { f: 45, wave: 'sawtooth', gain: 0.06 }, noise: { lp: 600, gain: 0.03 },
                     ticks: ['amb_ember', 'amb_growl'] },
    '천계(天界)':   { drone: { f: 660, wave: 'sine', gain: 0.02 }, noise: null,
                     ticks: ['amb_chime', 'amb_wind'] }
  };

  /* ── 상태 ─────────────────────────────────────────────── */

  var ctx = null;                 // AudioContext — **한 번만** 만든다
  var master = null;
  var unlocked = false;
  var lastAt = {};                // 소리마다 마지막으로 낸 시각(초)
  var recent = [];                // 최근 요청 (진단이 읽는다)
  var ambRecent = [];              // 환경음 조각의 최근 요청 — **따로** 쌓는다.
                                    // 같이 쌓으면 배경에서 무작위로 섞이는 조각이
                                    // "이 사건 다음엔 이 소리" 를 보는 진단을 흔든다
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

  /* ── 진동(vibration) — 2026-09-14, ⚙️ 설정 시트가 남겨 둔 숙제.
   * 소리와 **다른 채널**이다 — 소리를 꺼도 진동은 따로 켤 수 있고, 그 반대도
   * 된다. 그래서 `play()`의 `enabled()`(소리 on/off) 관문보다 **앞에서** 잰다.
   * 지원 안 하는 기기(데스크톱·iOS Safari 다수)는 `vibrateSupported()`가
   * false라 시트에 손잡이 자체를 안 보여준다 — 눌러도 안 되는 죽은 버튼을
   * 두지 않는다(그래픽 품질 손잡이가 3D 없을 때 숨는 것과 같은 결). */
  function vibrateEnabled() { return settings().vibrate !== false; }

  function vibrateSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  function setVibrateEnabled(v) {
    settings().vibrate = !!v;
    core.persist();
    if (v && vibrateSupported()) { try { navigator.vibrate(20); } catch (e) { /* 무시 */ } }
    return settings().vibrate;
  }

  /* 때린 맛이 있는 자리만 울린다 — 줍기·UI·환경음까지 다 울리면 손이 피곤하다.
   * 값은 ms 하나 또는 on/off 패턴 배열(navigator.vibrate 그대로). */
  var VIBE = {
    hit: 10, crit: [10, 15, 10], kill: 20, boss: [50, 30, 50, 30, 80],
    hurt: 25, heavy: 15, die: [40, 30, 40, 30, 120]
  };
  var lastVibeAt = {};

  function doVibrate(key) {
    var pat = VIBE[key];
    if (pat === undefined || !vibrateEnabled() || !vibrateSupported()) { return false; }
    var now = Date.now();
    var gapMs = ((CUES[key] && CUES[key].gap) || 0.05) * 1000;
    if (lastVibeAt[key] !== undefined && now - lastVibeAt[key] < gapMs) { return false; }
    lastVibeAt[key] = now;
    try { return !!navigator.vibrate(pat); } catch (e) { return false; }
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
  function playNoise(L, t0, mul, lpMul) {
    lpMul = lpMul || 1;
    var n = Math.max(1, Math.floor(ctx.sampleRate * L.dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0), i;
    for (i = 0; i < n; i++) { d[i] = Math.random() * 2 - 1; }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime((L.lp || 1000) * lpMul, t0);
    if (L.lp2) { f.frequency.exponentialRampToValueAtTime(Math.max(40, L.lp2 * lpMul), t0 + L.dur); }
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
   * @param opts {vol, amb} 이번 한 번만 크기를 곱한다. amb 면 환경음 조각이라
   *             foreground 요청 목록(recent/_tail) 대신 ambRecent 에 쌓인다
   * @returns {boolean} 실제로 소리가 났는가 (꺼져 있거나 안 깨웠으면 false)
   */
  function play(key, opts) {
    /* **요청은 무조건 적는다** — 소리가 안 나도 남는다. 진단이 이걸 읽는다 */
    var amb = !!(opts && opts.amb);
    var list = amb ? ambRecent : recent;
    list.push(key);
    if (list.length > RECENT_MAX) { list.shift(); }

    var cue = CUES[key];
    if (!cue) { return false; }
    if (!amb) { doVibrate(key); }   // 소리 on/off와 무관한 별도 채널
    if (!enabled() || !unlocked || !ctx || !master) { return false; }

    var now = ctx.currentTime;
    if (lastAt[key] !== undefined && now - lastAt[key] < (cue.gap || 0.05)) { return false; }
    lastAt[key] = now;
    if (voices >= VOICE_MAX) { return false; }

    var mul = (opts && typeof opts.vol === 'number') ? opts.vol : 1;
    /* §5.8① 무기 look 결 — 노이즈 켜의 저역통과 주파수만 배로 밀어 밝고
       어두운 인상을 가른다(도검·활은 위로, 둔기는 아래로). 다른 30여 개
       기존 큐는 opts.lpMul 을 안 주니 1(무변화) 그대로다 */
    var lpMul = (opts && typeof opts.lpMul === 'number') ? opts.lpMul : 1;
    var i, L;
    try {
      voices++;
      for (i = 0; i < cue.l.length; i++) {
        L = cue.l[i];
        var at = now + (L.at || 0);
        if (L.v === 'noise') { playNoise(L, at, mul, lpMul); }
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

  /** 등급을 소리로 — 바닥에 뭐가 떨어졌는지 **보기 전에** 알게 하는 자리 */
  function dropCue(tier, uniq) {
    if (uniq) { return 'uniq'; }
    return 'drop' + Math.max(0, Math.min(4, tier || 0));
  }

  /* ── 환경음(ambience) — PLAN 37절 ─────────────────────────────
   * CUES 의 소리는 다 **한 방(ADSR)** 이다. 환경음은 그 결로 못 낸다 —
   * 층에 있는 내내 **눌러도 안 끊기는** 결(드론·바람)이 있어야 한다.
   * 그래서 여기만 지속 노드(오실레이터·루프 버퍼)를 따로 쥔다.
   *
   * **판정 층은 여기서도 갈린다** — `ambTheme` 은 실제로 소리가 났든 안
   * 났든(꺼져 있든, 안 깨웠든) 늘 "지금 몇째 결이어야 하는가"를 들고 있다.
   * 헤드리스 진단은 이 값만 읽으면 되고, 진짜 노드는 `ambNodes` 에 있다.
   */
  var ambTheme = null;
  var ambNodes = null;
  var ambTimer = null;

  function stopAmbience() {
    ambTheme = null;
    if (ambTimer) { global.clearTimeout(ambTimer); ambTimer = null; }
    if (!ambNodes) { return; }
    var nodes = ambNodes;
    ambNodes = null;
    if (ctx && nodes.bedGain) {
      var now = ctx.currentTime;
      try {
        nodes.bedGain.gain.cancelScheduledValues(now);
        nodes.bedGain.gain.setValueAtTime(nodes.bedGain.gain.value, now);
        nodes.bedGain.gain.linearRampToValueAtTime(0.0001, now + 1.0);
      } catch (e) { /* 무시 — 늦게 죽어도 그만이다 */ }
    }
    global.setTimeout(function () {
      try { if (nodes.osc) { nodes.osc.stop(); } } catch (e) { /* 이미 죽었을 수 있다 */ }
      try { if (nodes.noiseSrc) { nodes.noiseSrc.stop(); } } catch (e) { /* 이미 죽었을 수 있다 */ }
    }, 1100);
  }

  /** 그 결의 조각(amb_*)을 드문드문 하나씩 튼다 — 화면이 바뀌면 스스로 멎는다 */
  function scheduleTick(theme) {
    if (ambTheme !== theme) { return; }
    var def = THEME_AMB[theme];
    if (!def || !def.ticks || !def.ticks.length) { return; }
    play(def.ticks[Math.floor(Math.random() * def.ticks.length)], { amb: true });
    ambTimer = global.setTimeout(function () { scheduleTick(theme); }, 1800 + Math.random() * 3200);
  }

  /** 층 테마가 바뀔 때마다 부른다. 같은 결이면 다시 안 켠다(끊기지 않는다) */
  function startAmbience(theme) {
    if (ambTheme === theme) { return; }
    stopAmbience();
    ambTheme = theme;
    if (!THEME_AMB[theme]) { return; }
    /* 첫 조각도 한 박 쉬고 튼다 — 문 넘자마자 바로 우는 것보다 자연스럽다 */
    ambTimer = global.setTimeout(function () { scheduleTick(theme); }, 600 + Math.random() * 1400);
    if (!enabled() || !unlocked || !ctx || !master) { return; }   // 이 밑은 진짜 노드 — 못 켜면 여기서 멎는다

    var def = THEME_AMB[theme], now = ctx.currentTime;
    var bedGain = ctx.createGain();
    bedGain.gain.setValueAtTime(0.0001, now);
    bedGain.gain.linearRampToValueAtTime(1, now + 1.5);
    bedGain.connect(master);

    var osc = null, noiseSrc = null;
    if (def.drone) {
      osc = ctx.createOscillator();
      osc.type = def.drone.wave || 'sine';
      osc.frequency.value = def.drone.f;
      var oscGain = ctx.createGain();
      oscGain.gain.value = def.drone.gain;
      osc.connect(oscGain); oscGain.connect(bedGain);
      osc.start(now);
    }
    if (def.noise) {
      var len = Math.max(1, Math.round(ctx.sampleRate * 2));
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0), i;
      for (i = 0; i < len; i++) { d[i] = Math.random() * 2 - 1; }
      noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = buf;
      noiseSrc.loop = true;
      var filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = def.noise.lp;
      var noiseGain = ctx.createGain();
      noiseGain.gain.value = def.noise.gain;
      noiseSrc.connect(filt); filt.connect(noiseGain); noiseGain.connect(bedGain);
      noiseSrc.start(now);
    }
    ambNodes = { osc: osc, noiseSrc: noiseSrc, bedGain: bedGain };
  }

  function DD() { return global.DG.dungeonData; }

  /* ── 이벤트에 물린다 ──────────────────────────────────────
   * 이미 있는 이벤트로 되는 것은 여기서 받는다 — 그 파일들을 안 건드린다.
   * 프레임마다 나는 소리(타격·줍기·문)는 dungeon.js 가 직접 부른다.
   */
  core.on('levelup', function () { play('levelup'); });
  core.on('dungeon:enter', function (run) {
    play('enter');
    if (run && DD()) { startAmbience(DD().themeOf(run.floor).name); }
  });
  core.on('dungeon:floor', function (floor) {
    play('floor');
    if (DD()) { startAmbience(DD().themeOf(floor).name); }
  });
  core.on('dungeon:skill', function () { play('skill'); });
  core.on('dungeon:end', function (e) {
    stopAmbience();
    if (e && e.reason === 'dead') { play('die'); }
  });

  bindUnlock();

  global.DG = global.DG || {};
  /* ── W-0171 자체 효과음 샘플(K-0045, saga-web/shared/audio/sfx/<id>.ogg) ──────────
   * 합성음과 같은 WebAudio(master)로 낸다 — 소리 끔·볼륨·잠금 해제를 그대로 따른다. 처음 부를 때 받아 두고
   * 받기 전·못 받으면 false → 부르는 쪽이 옛 합성음. 손잡이 `audio.own` 0 이면 늘 false. */
  var sxBuf = {};
  var SX_OF = { sword: 'sword', dagger: 'dagger', guandao: 'sword', axe: 'axe', club: 'axe', halberd: 'spear', spear: 'spear', bow: 'bow', gun: 'gun', fan: 'staff', staff: 'staff', brush: 'staff', scroll: 'staff' };
  function sxUrl(id) {
    var A = global.DG.assets3d, r = A && A.root ? A.root() : null;
    return r ? r.slice(0, r.length - 'assets/'.length) + 'audio/sfx/' + id + '.ogg' : null;   // root = '…/shared/assets/'
  }
  function sxLoad(id) {
    if (sxBuf[id] !== undefined || !ctx || !global.fetch) { return; }
    var u = sxUrl(id);
    if (!u) { return; }
    sxBuf[id] = null;
    global.fetch(u).then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(r.status); })
      .then(function (ab) { return ctx.decodeAudioData(ab); })
      .then(function (b) { sxBuf[id] = b; }, function () { sxBuf[id] = false; });
  }
  function sx(id, vol) {
    if (!core.tuned('audio.own', 1) || !enabled() || !unlocked || !ctx || !master) { return false; }
    var b = sxBuf[id];
    if (!b) { sxLoad(id); return false; }
    try {
      var src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = b; g.gain.value = typeof vol === 'number' ? vol : 0.9;
      src.connect(g); g.connect(master); src.start();
      return true;
    } catch (e) { return false; }
  }
  /** 무기 생김새(look)로 맞는 소리 — i 로 _1·_2 번갈아. 두 변형을 같이 받아 둔다 */
  function hitOf(look, i) {
    var k = SX_OF[look] || 'sword';
    sxLoad('sfx_' + k + '_hit_1'); sxLoad('sfx_' + k + '_hit_2');
    return sx('sfx_' + k + '_hit_' + (1 + ((i | 0) & 1)));
  }

  global.DG.sfx = {
    CUES: CUES, THEME_AMB: THEME_AMB,
    play: play, dropCue: dropCue, sx: sx, hitOf: hitOf, sxUrl: sxUrl, SX_OF: SX_OF,
    unlock: unlock, ready: function () { return unlocked; },
    enabled: enabled, setEnabled: setEnabled,
    volume: volume, setVolume: setVolume,
    vibrateEnabled: vibrateEnabled, setVibrateEnabled: setVibrateEnabled,
    vibrateSupported: vibrateSupported,
    /** 최근 요청 n 개 (진단용 — 소리가 꺼져 있어도 남는다) */
    _tail: function (n) { return recent.slice(-(n || 8)); },
    _ambTail: function (n) { return ambRecent.slice(-(n || 8)); },
    _clear: function () { recent.length = 0; ambRecent.length = 0; lastAt = {}; lastVibeAt = {}; },
    /** 환경음 — 지금 켜져 있어야 할 결(테마 이름), 실제 노드 유무와 별개다 */
    ambience: function () { return ambTheme; },
    _startAmbience: startAmbience, _stopAmbience: stopAmbience
  };
})(window);
