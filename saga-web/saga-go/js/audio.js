/**
 * 오디오 — 짧은 효과음으로 발견·등용·타격·화면 전환에 소리를 얹는다
 * ------------------------------------------------------------
 * 이 판은 여태 소리가 하나도 없었다(`SAGA WEB.md` 15절 감사에서 드러난 격차 —
 * `assets/audio/`도 오디오 시스템도 전무했다). OpenGameArt "RPG Sound Pack"
 * (artisticdude, **CC0**)에서 짧은 조각 다섯을 골라 mp3(모노 96kbps)로
 * 옮겼다 — 출처는 `assets/ASSET_LICENSES.md`.
 *
 * **2026-09-14 — 천둥(`thunder`)을 더했다.** `js/sky3d.js`가 비 오는 날
 * 번개가 칠 때마다 `sky:thunder`를 던지고 있었는데(2026-09-10) 그때는
 * CC0 천둥 음원이 없어 듣는 쪽이 없었다. OpenGameArt "100 CC0 SFX #2"
 * (rubberduck, **CC0**)에서 `sfx100v2_thunder_01.ogg` 하나를 받아 같은
 * 규격(모노 44.1kHz 96kbps mp3)으로 옮겨 넣었다 — 출처는
 * `assets/ASSET_LICENSES.md`.
 *
 * **2026-09-14 (이어서) — 레벨업(`levelup`)도 더했다.** `core.js`의
 * `gainExp()`가 레벨이 오르면 `levelup` 이벤트를 던지고 `ui.js`가 화면
 * 배너("LEVEL UP")까지 띄우는데 소리만 없었다 — 등용·타격·공적·화면 전환은
 * 다 소리가 붙어 있는데 이 자리만 비어 있었다. **`hero:levelup`(부대원
 * 개별 레벨업, `hero.js`)은 일부러 안 걸었다** — `awardParty()`가 부대
 * 전원에게 한 번에 경험치를 먹이는 자리가 많아(등용·성채·토벌 보상 등),
 * 걸면 같은 프레임에 소리가 서넛 겹쳐 운다. 화면 배너가 있는 **플레이어
 * 레벨업 하나만** 소리를 낸다.
 *
 * **2026-09-14 (더 이어서) — 펫 연성(`growth:refine`)도 소리를 얻었다.**
 * `growth.js`의 `refine()`(영초·단사를 써서 펫 보정을 한 단 올리는 것)은
 * 토스트만 띄우고 소리가 하나도 없었다 — 같은 파일의 `ascend()`(승화)는
 * `gainFeat()`를 거쳐 `reward` 소리가 붙는데, 자원을 그대로 소비하는
 * `refine()`은 공적(功績)이 아니라서 그 길을 안 탄다. **새 mp3 를 받지
 * 않고 이미 있는 `reward` 소리를 재사용했다** — `panel_open` 이 이미 네
 * 이벤트(`duel:open`·`*:request`)에서 재사용되는 것과 같은 결이다. 신호만
 * 새로 열었을 뿐 `growth.js` 의 값 계산은 한 줄도 안 건드렸다.
 *
 * **새 판정을 만들지 않는다.** 이미 도는 이벤트버스(`core.on`/`emit`)를
 * 엿듣기만 한다 — 어느 게임 로직 파일도 고치지 않았다:
 *
 *   codex          새 지역·사람·짐승·사건·역사를 처음 봤다  → discover
 *   dex:new        등용·포획 성공(도감에 오름)              → catch
 *   duel:fx        교전 중 타격(내 것·상대 것 가리지 않는다) → hit
 *   feat           공적 획득(사냥·답파·완수 전부 이 한 곳)   → reward
 *   duel:open      교전 무대가 열린다                        → open
 *   station:request / encounter:request / fort:request
 *                  역참·조우·성채 카드가 열린다               → open
 *   sky:thunder    비 오는 날 번개가 친다                    → thunder
 *   levelup        플레이어 레벨이 오른다(화면 배너와 같이) → levelup
 *   growth:refine  펫 연성(강화) 한 단이 성공한다             → reward(재사용)
 *
 * **손잡이** `audio.on`(0이면 전부 무음, 기본 1) · `audio.vol`(0~1, 기본 0.6).
 * **자동재생 정책** — 모바일은 첫 사용자 제스처 전엔 재생을 막는다.
 * 실패는 조용히 삼킨다(게임 진행에 안 걸린다) — 첫 탭 이후로는 정상 재생된다.
 * **로딩** — `preload="none"`, 처음 그 소리를 낼 때 받는다(SAGA WEB.md 7절,
 * 부팅 때 한꺼번에 안 받는다). 한 번 받은 클립은 풀(pool)로 돌려 쓴다 —
 * 같은 타격이 짧게 겹쳐도(연속 필살 등) 서로 안 끊는다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }

  /** 소리를 낼까 — 0 이면 전부 무음 (되돌림용 손잡이) */
  function ON() { return core().tuned('audio.on', 1) ? true : false; }

  /** 마스터 볼륨 0~1 */
  function VOL() {
    var v = core().tuned('audio.vol', 0.6);
    return Math.max(0, Math.min(1, Number(v)));
  }

  var BASE = 'assets/audio/sfx/';
  var CLIPS = {
    discover: 'discover.mp3',
    catch: 'encounter_win.mp3',
    hit: 'hit.mp3',
    reward: 'reward.mp3',
    open: 'panel_open.mp3',
    thunder: 'thunder.mp3',
    levelup: 'levelup.mp3'
  };
  var POOL_N = 3;   // 동시에 겹쳐도 서로 안 끊기게

  /* 타격음 3종 라운드로빈(SAGA-DESIGN §3 표준 C) — 새 mp3 파일 없이(원작사
     에셋 금지, 루트 CLAUDE.md) 같은 클립의 재생 속도(음높이)만 code 로 세 갈래
     내 매번 다르게 들리게 한다. `play()`가 이미 POOL_N개를 순번대로 돌려 쓰므로
     그 자리마다 고정 배속을 박아 두면 저절로 라운드로빈이 된다. */
  var HIT_RATES = [0.92, 1.0, 1.12];

  var pool = {};    // name -> HTMLAudioElement[POOL_N]
  var rr = {};       // name -> 다음에 쓸 자리(순번)

  /** W-0170 — 자체 효과음 92(K-0045, saga-web/shared/audio/sfx/<id>.ogg). 'sx:<id>' 로 부른다 — 공용 주소(assets3d)가 안 잡혔으면 null */
  function sharedUrl(name) {
    if (String(name).indexOf('sx:') !== 0 || !core().tuned('audio.own', 1)) { return null; }
    var A = global.DG.assets3d, r = A && A.root ? A.root() : null;
    return r ? r.slice(0, r.length - 'assets/'.length) + 'audio/sfx/' + name.slice(3) + '.ogg' : null;   // root = '…/shared/assets/'
  }

  function bank(name) {
    if (pool[name]) { return pool[name]; }
    var su = sharedUrl(name);
    if (!global.Audio || (!CLIPS[name] && !su)) { return null; }
    var arr = [];
    for (var i = 0; i < POOL_N; i++) {
      var a = new Audio(su || BASE + CLIPS[name]);
      a.preload = 'none';
      if (name === 'hit') { a.playbackRate = HIT_RATES[i % HIT_RATES.length]; }
      arr.push(a);
    }
    pool[name] = arr;
    return arr;
  }

  /** 이름난 효과음 하나를 낸다. 모르는 이름·오디오 미지원 기기는 조용히 넘어간다 */
  function play(name) {
    if (!ON()) { return false; }
    var arr = bank(name);
    if (!arr) { return false; }
    var i = (rr[name] = ((rr[name] || 0) + 1) % arr.length);
    var a = arr[i];
    try {
      a.pause();
      a.currentTime = 0;
      a.volume = VOL();
      var p = a.play();
      if (p && p.catch) { p.catch(function () { /* 자동재생 정책 — 다음 탭부터 들린다 */ }); }
    } catch (e) { /* 무음 기기 등 */ }
    return true;
  }

  function wire() {
    var c = core();
    c.on('codex', function () { play('discover'); });
    c.on('dex:new', function () { play('catch'); });
    c.on('duel:fx', function () { play('hit'); });
    c.on('feat', function () { play('reward'); });
    c.on('duel:open', function () { play('open'); });
    c.on('station:request', function () { play('open'); });
    c.on('encounter:request', function () { play('open'); });
    c.on('fort:request', function () { play('open'); });
    c.on('sky:thunder', function () { play('thunder'); });
    c.on('levelup', function () { play('levelup'); });
    c.on('growth:refine', function () { play('reward'); });  // 새 mp3 없이 재사용
  }

  function stats() { return { on: ON(), vol: VOL(), clips: Object.keys(CLIPS).length }; }

  /** 설정 화면(⚙️, 2026-09-10) — 다른 네 판의 `sfx.js` 가 쓰는 이름
   *  (`enabled`·`volume`·`setEnabled`·`setVolume`)과 맞춰, 같은 UI 코드를
   *  그대로 옮겨 쓸 수 있게 한다. 이 판은 손잡이(`core.tuned`)가 이미
   *  저장소를 쥐고 있어(다른 네 판의 `save.settings` 대신) 값은 그리로 간다 */
  function setEnabled(v) { core().setTune('audio.on', v ? 1 : 0); return ON(); }
  function setVolume(v) { core().setTune('audio.vol', Math.max(0, Math.min(1, v))); return VOL(); }

  global.DG = global.DG || {};
  /* W-0170 — 들판 전투 소리: 마지막으로 휘두른 무기로 맞는 소리를 고른다(자체 효과음 _1·_2 번갈아). 못 내면 false → 부르는 쪽이 옛 'hit' */
  var HIT_OF = { sword: 'sword', claymore: 'axe', polearm: 'spear', catalyst: 'staff', bow: 'bow' }, lastW = 'sword', alt = 0;
  function weapon(w) { if (HIT_OF[w]) { lastW = w; } return lastW; }
  function hitFor(crit) {
    alt = 1 - alt;
    var ok = play('sx:sfx_' + HIT_OF[lastW] + '_hit_' + (alt + 1));
    if (ok && crit) { play('sx:sfx_crit'); }
    return ok;
  }

  global.DG.audio = {
    play: play, stats: stats, CLIPS: CLIPS, HIT_RATES: HIT_RATES, weapon: weapon, hitFor: hitFor, sharedUrl: sharedUrl,
    /** 자가진단이 라운드로빈 배속이 실제로 풀에 박혔는지 볼 수 있게 */
    bank: bank,
    enabled: ON, volume: VOL, setEnabled: setEnabled, setVolume: setVolume
  };

  if (global.DG.core) { wire(); }
})(window);
