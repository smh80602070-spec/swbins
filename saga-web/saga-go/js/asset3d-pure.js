/**
 * 1만리 3D 배우 — 순수 표(R-4, 2026-10-11 `asset3d.js` 1640줄에서 떼어 냄)
 * ---------------------------------------------------------------
 * three 도 캐시도 안 쓰는 셈만 모았다 — 클립 이름 맞추기(mapClips)·키 1 맞추기(fit)·건물 배율(heightMul)·표식 깃발(markOf).
 * `asset3d.js` 는 같은 이름으로 그대로 부르고(`DG.asset3dPure` 에서 받아 둠), 바깥에 내보내는 이름(`DG.asset3d.mapClips` 등)도 그대로다.
 * `asset3d.js` 보다 **먼저** 실린다(manifest).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  /* ── 애니메이션 이름 맞추기 (PLAN 8절) ─────────────────
   * 모델마다 클립 이름이 제각각이다. mixamo 는 `Armature|mixamo.com|Layer0`,
   * blender 는 `Walk.001`, 어떤 것은 `Anim_Run_F`. 그래서 이름을 씻어 놓고
   * **점수를 매겨** 가장 잘 맞는 것부터 자리를 채운다 — 한 클립이 두 자리를
   * 차지하지는 않는다.
   *
   * `hit`(맞는다)과 `attack`(친다)이 서로 먹히기 쉬운데, 점수제라 `hit` 라는
   * 클립은 hit 자리에서 정확히 맞아(100점) attack 의 부분일치(40점)를 이긴다.
   */
  var SLOTS = ['idle', 'walk', 'run', 'sprint', 'attack', 'hit', 'dodge', 'death', 'interaction', 'jump', 'land'];

  var WORDS = {
    idle: ['idle', 'stand', 'standing', 'breathe', 'rest', 'wait', 'loop'],
    walk: ['walk', 'walking', 'locomotion', 'move', 'swim', 'flying'],  // 'swim' — 물고기 클립(`Swim`) · 'flying' — 말벌(`Wasp_Flying`, 걷기 클립 없음)
    run: ['run', 'running', 'jog'],
    sprint: ['sprint', 'runfast', 'fastrun', 'dash'],
    attack: ['attack', 'atk', 'slash', 'swing', 'strike', 'punch', 'shoot', 'cast'],
    hit: ['hit', 'hurt', 'damage', 'gethit', 'takedamage', 'impact', 'flinch'],
    dodge: ['dodge', 'roll', 'evade', 'sidestep'],
    death: ['death', 'die', 'dead', 'dying', 'defeat'],
    interaction: ['interact', 'interaction', 'use', 'pick', 'gather', 'talk', 'open', 'action'],
    jump: ['jump', 'leap', 'hop'],
    land: ['land', 'landing']
  };

  /** 이름을 씻는다 — `Armature|mixamo.com|Walk.001` → `walk` */
  function normName(s) {
    var n = String(s || '');
    if (n.indexOf('|') >= 0) { n = n.split('|').pop(); }   // 마지막 칸이 진짜 이름이다
    n = n.replace(/\.\d+$/, '');                            // blender 의 .001
    return n.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /** 한 자리와 한 이름이 얼마나 맞나 — 0 이면 안 맞는다 */
  function score(slot, name) {
    var ws = WORDS[slot] || [], i, w, best = 0, s;
    for (i = 0; i < ws.length; i++) {
      w = ws[i];
      if (name === w) { s = 100; }
      else if (name.indexOf(w) === 0) { s = 70; }
      else if (name.indexOf(w) >= 0) { s = 40; }
      else { continue; }
      s -= i;                       // 앞에 적은 후보가 조금 더 세다
      if (s > best) { best = s; }
    }
    return best;
  }

  /**
   * 클립 이름들 → 자리표. 순수 함수라 three 없이도 돈다.
   * 못 채운 자리는 대타로 메운다(`FALLBACK`) — 뛰는 그림이 없으면 걷는 그림이라도 쓴다.
   */
  var FALLBACK = {
    run: ['walk', 'idle'], sprint: ['run', 'walk'], walk: ['run', 'idle'],
    hit: ['idle'], dodge: ['run', 'walk'], attack: ['interaction', 'idle'],
    death: ['hit', 'idle'], interaction: ['idle'], idle: ['walk'], jump: ['idle'], land: ['idle']
  };

  function mapClips(names) {
    var list = (names || []).map(function (n) { return { raw: n, n: normName(n) }; });
    var pairs = [], si, ci, sc;
    for (si = 0; si < SLOTS.length; si++) {
      for (ci = 0; ci < list.length; ci++) {
        sc = score(SLOTS[si], list[ci].n);
        if (sc > 0) { pairs.push({ slot: SLOTS[si], raw: list[ci].raw, s: sc, si: si, ci: ci }); }
      }
    }
    /* 점수가 같으면 자리 순서 → 클립 순서. 돌릴 때마다 답이 달라지면 안 된다 */
    pairs.sort(function (a, b) { return (b.s - a.s) || (a.si - b.si) || (a.ci - b.ci); });
    var out = {}, taken = {}, i, p;
    for (i = 0; i < pairs.length; i++) {
      p = pairs[i];
      if (out[p.slot] || taken[p.raw]) { continue; }
      out[p.slot] = p.raw; taken[p.raw] = true;
    }
    /* 대타 — 원본으로 채운 자리와 구별되게 `alias` 에 적어 둔다 */
    var alias = {}, j, alt;
    for (i = 0; i < SLOTS.length; i++) {
      if (out[SLOTS[i]]) { continue; }
      alt = FALLBACK[SLOTS[i]] || [];
      for (j = 0; j < alt.length; j++) {
        if (out[alt[j]]) { out[SLOTS[i]] = out[alt[j]]; alias[SLOTS[i]] = alt[j]; break; }
      }
    }
    out.alias = alias;
    return out;
  }

  /* ── 크기 맞추기 ──────────────────────────────────────
   * 이 판의 배우는 전부 **키 1** 로 만들어 두고 세우는 쪽에서 배율을 준다
   * (`actor3d.js` 의 규약). GLB 는 만든 사람마다 단위가 다르니 재서 맞춘다 —
   * 키를 1 로, 발을 y=0 으로.
   */
  function fit(box) {
    var h = (box.maxY - box.minY) || 1;
    var s = 1 / h;
    return {
      scale: s,
      dy: -box.minY * s,
      dx: -((box.minX + box.maxX) / 2) * s,
      dz: -((box.minZ + box.maxZ) / 2) * s
    };
  }

  /**
   * 키 1 위에 **얼마를 더 곱하나** — 순수 함수다.
   *
   * 배우는 전부 키 1 로 눕는데(`fit`), 도형으로 세우던 역참·성채는 그 규약을
   * 안 지키고 제 키로 서 있었다 — 역참 **1.73** · 성채 **2.64**(직접 재 봤다).
   * `world3d` 가 주는 배율은 그 키를 곱할 셈으로 잡힌 값이라, GLB 를 키 1 로
   * 그대로 세우면 **역참이 절반, 성채가 셋에 하나로 쪼그라든다.** 그만큼 보탠다.
   * (`prop3d.houseScale` 이 집에서 같은 함정을 밟고 남긴 자리와 같은 뜻이다)
   *
   * 성채는 여기에 **등급을 한 번 더 태운다.** 보(堡)는 작고 웅진(雄鎭)은 크다 —
   * 걸어가기 전에 멀리서 세기를 가늠하는 것이 이 판의 성채가 하는 일이다.
   */
  function heightMul(kind, ref) {
    var C = core();
    if (kind === 'station') { return C.tuned('asset3d.stationScale', 1.73); }
    if (kind === 'landmark') { return C.tuned('asset3d.landmarkScale', 5); }
    if (kind === 'fort') {
      var base = C.tuned('asset3d.fortScale', 2.64);
      var t = ref && ref.tier;
      return base * (t === 1 ? 0.78 : (t === 3 ? 1.24 : 1));
    }
    return 1;
  }

  /**
   * 이 건물에 **표식 깃발**을 세우나 — 세우면 규격, 아니면 null. 순수 함수다.
   *
   * 왜 필요한가. 도형 역참에는 노란 깃발이, 도형 성채에는 세력 빛깔 배너가
   * 달려 있었고 **그것이 멀리서 알아보는 유일한 표식**이었다. 받아 온 탑과
   * 여관에는 깃발이 없다 — 그대로 갈아 끼우면 성채가 어느 세력인지 화면에서
   * 사라진다. 모양을 얻고 뜻을 잃는 맞바꿈이 되므로, 깃발만 다시 얹는다.
   *
   * 값은 **키 1 기준의 비율**이다(`heightMul` 을 곱한 뒤의 단위계).
   */
  function markOf(kind, ref) {
    if (kind !== 'station' && kind !== 'fort') { return null; }
    if (!core().tuned('asset3d.mark', 1)) { return null; }
    var col = (ref && ref.color) || (kind === 'fort' ? '#8a5cc0' : '#e8c15a');
    /* 성채는 **세로로 긴 배너**, 역참은 **가로로 넓은 작은 깃발** — 도형이 그랬다 */
    if (kind === 'fort') { return { color: col, pole: 1.02, w: 0.22, flag: 0.34 }; }
    return { color: col, pole: 0.95, w: 0.30, flag: 0.18 };
  }

  global.DG = global.DG || {};
  global.DG.asset3dPure = {
    SLOTS: SLOTS, WORDS: WORDS, FALLBACK: FALLBACK,
    normName: normName, score: score, mapClips: mapClips, fit: fit, heightMul: heightMul, markOf: markOf
  };
})(window);
