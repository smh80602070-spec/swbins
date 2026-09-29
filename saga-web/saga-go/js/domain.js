/**
 * 숨은 터 · 원기 · 주간 보스 — 오픈월드 RPG식 (PLAN §5 ⑲-9, 이름·수치는 §5 ⑳)
 * ---------------------------------------------------------------
 *   자리     ⑮ 땅 열여섯마다 입구 하나(그 땅 방위로 안쪽 1.7km·바깥 7.6km, 물·마을·길 비킴) —
 *            종류 셋을 땅 순서로 돌린다: 잠든 무덤(보패)·옛 서당(무예 책)·쇠부리 터(강화석).
 *            주간 보스 "먹구름 제단" 하나 = 갈대 나루. 칸 해시가 아니라 땅 방위라 세이브가 없다.
 *   도전     입구 카드에서 단계 I·II·III(여정 등급 1·6·12) → 입구 둘레가 원판(벗어나면 실패).
 *            3초 뒤 **들판 전투 무리**로 파도 둘(보통 → 정예), 120초. 다 쓰러뜨리면 가운데 보상 나무 —
 *            원기 15 를 써서 받는다. 전멸·시간·원판 밖·나가기면 실패(원기 안 씀, 흘림 없음).
 *            숨은 터 적(무리 키 `dm:`)은 등급 2 고정 × 단계 배율 — 천하 등급·전리품·경험·무리 기록이 없다
 *            (field-combat.js 가 `dm:` 무리를 비킨다). 터 기운은 종류마다 하나.
 *   주간     먹구름 이무기(`w_imugi`) 하나, 180초, 체력 50% 에서 뇌 방패·공격 간격 ×0.69.
 *            원기 45, 이번 주(월요일 새벽 4시 갈림) 처음 둘은 25. 보상에 뇌룡 비늘(무예 7→10).
 *   메아리   ⑲-56 1차 결말(29장) 뒤에만 입구가 보이고 열린다 — 이야기 보스 넷(매듭 등불의 참몸·얼음굴 구미호·갈림길 별까마귀·빛 돔 파수 거신)을
 *            다시 만난다. 보스 하나·240초·원기 60(이번 주 처음 둘은 반값 — 주간 보스와 같은 횟수를 함께 센다). 체력 절반에서 보스 원소 방패.
 *   원기     상한 120 · 실제 시각 10분에 1. 처음·옛 세이브는 가득.
 *
 * 자리·배율·보상·원기 계산(`entranceOf`·`rewardOf`·`resinAt`·`weekKey`)은 순수 함수다.
 * 세이브는 `save.resin = { v, t }` · `save.domain = { claims, weekly: { week, n } }` 뿐 —
 * 진행 중 도전은 저장하지 않는다(새로고침하면 없던 일). 손잡이 `domain.on` 0 이면 다 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('domain.' + key, def); }
  function on() { return K('on', 1) ? true : false; }
  function BM() { var b = global.DG.biome; return b && b.on && b.on() ? b : null; }
  function FC() { return global.DG.fieldCombat || null; }

  var KINDS = {
    tomb:   { key: 'tomb',   name: '잠든 무덤', icon: '⚱️', loot: '보패',  color: '#7fd3ff', ley: '적이 4초마다 물을 띤다',
              waves: [['toad', 'toad', 'imp'], ['tortoise', 'toad', 'toad']] },
    school: { key: 'school', name: '옛 서당',   icon: '📜', loot: '무예 책', color: '#ffd27a', ley: '적을 쓰러뜨리면 명단 기력 +8',
              waves: [['hawk', 'hawk', 'vine'], ['bolt', 'raptor', 'raptor']] },
    forge:  { key: 'forge',  name: '쇠부리 터', icon: '⚒️', loot: '강화석',  color: '#ff9a5a', ley: '적 공격 ×1.3',
              waves: [['imp', 'imp', 'boar'], ['ember', 'imp', 'imp']] },
    weekly: { key: 'weekly', name: '먹구름 제단', icon: '⛈️', loot: '뇌룡 비늘·★5 보패', color: '#b58cff',
              ley: '체력 절반에서 뇌 방패를 두르고 빨라진다', waves: [['w_imugi']] },
    echo:   { key: 'echo',   name: '메아리', icon: '🔮', loot: '뇌룡 비늘·비전·★5 보패', color: '#c9a0ff',
              ley: '이야기에서 이긴 보스가 메아리로 다시 선다 — 체력 절반에서 원소 방패를 두른다', waves: null }
  };
  /* ⑲-56 결말 뒤 재대결 — 이야기 보스 넷. 입구 자리는 그 보스와 싸운 곳(story 이름 붙은 자리 + off, 땅 위) */
  var ECHO_AFTER = 29, ECHO_COST = 60, ECHO_LIMIT = 240;
  var ECHOES = [
    { key: 'knot',  name: '매듭 등불의 메아리', boss: 'storm_king_true', spot: 'home_bandi', off: [20, 0] },
    { key: 'ice',   name: '얼음굴의 메아리',   boss: 'rift_fox',        spot: 'fr_cave', off: [0, 8] },
    { key: 'cross', name: '갈림길의 메아리',   boss: 'rift_crow',       spot: 'cr_st_duel', off: [0, 8] },
    { key: 'dome',  name: '빛 돔의 메아리',    boss: 'dome_colossus',   spot: 'sk_sand', off: [0, 12] },
    /* ⑲-69 2차 결말(38장) 뒤 — 11부 보스 둘. 입구는 세갈래 고을(Godot 칸 (3.0,3.4)·(5.0,2.2) → 길목 기준 m). 보상 금 +20(모라 +500) */
    { key: 'firstcrow', name: '처음 순간의 메아리',  boss: 'first_crow',   spot: 'fk_junction', off: [-48, -5],  after: 38, plus: 20 },
    { key: 'garmuri',   name: '갈무리 격자의 메아리', boss: 'garmuri_true', spot: 'fk_junction', off: [48, -62],  after: 38, plus: 20 }
  ];
  var KIND_ORDER = ['tomb', 'school', 'forge'];
  var STAGES = [
    { n: 'I',   ar: 1,  hp: 1,   atk: 1 },
    { n: 'II',  ar: 6,  hp: 2,   atk: 1.5 },
    { n: 'III', ar: 12, hp: 3.5, atk: 2.2 }
  ];
  var TIER = 2;
  var RESIN_MAX = 120, RESIN_MS = 10 * 60 * 1000;
  var COST = 15, WEEKLY_COST = 45, WEEKLY_HALF = 25, WEEKLY_HALF_N = 2;
  var LIMIT = 120, WEEKLY_LIMIT = 180, START_DELAY = 3;
  var INNER_R = 1700, OUTER_R = 7600, ALTAR_ZONE = 'galdae', ALTAR_R = 2300, ALTAR_DA = 0.25;
  var FOE_RING = 6, LEY_WATER_SEC = 4, LEY_ENERGY = 8, LEY_ATK = 1.3;
  var P2_AT = 0.5, P2_SHIELD = 0.1, P2_CD = 0.69;
  var TILE = 48;
  function ARENA_R(gps) { return gps ? 60 : 30; }
  function ENTER_R(gps) { return gps ? 15 : 6; }
  function TREE_R(gps) { return gps ? 12 : 4; }

  /* ── 자리(순수) ───────────────────────────────────────── */

  /** 땅 z 의 방위로 baseR 떨어진 자리 — 제 땅 밖이거나 물·마을·길이면 각·거리를 조금씩 바꿔 다시 */
  function placeIn(z, baseR, da, terr, zoneAt) {
    var a0 = z.sector * Math.PI / 4 + (da || 0), x = 0, y = 0, k;
    for (k = 0; k < 12; k++) {
      var a = a0 + [0, -0.1, 0.1][k % 3], r = baseR + Math.floor(k / 3) * 180;
      x = Math.round(Math.cos(a) * r); y = Math.round(Math.sin(a) * r);
      var zok = !zoneAt || ((zoneAt(x, y) || {}).key === z.key);
      var t = terr ? terr(Math.floor(x / TILE), Math.floor(y / TILE)) : null;
      if (zok && t !== 'water' && t !== 'town' && t !== 'road') { break; }
    }
    return { x: x, y: y };
  }

  /** i 번째 땅(ZONES 순서)의 숨은 터 입구 — 순수 함수 */
  function entranceOf(i, terr, zoneAt) {
    var B = BM();
    if (!B) { return null; }
    var z = B.ZONES[i], kind = KIND_ORDER[i % KIND_ORDER.length], p = placeIn(z, z.ring ? OUTER_R : INNER_R, 0, terr, zoneAt);
    return { id: 'd:' + z.key, zone: z.key, zoneName: z.name, kind: kind, name: z.name + ' ' + KINDS[kind].name, x: p.x, y: p.y };
  }
  function altarOf(terr, zoneAt) {
    var B = BM(), z = B ? B.zoneByKey(ALTAR_ZONE) : null;
    if (!z) { return null; }
    var p = placeIn(z, ALTAR_R, ALTAR_DA, terr, zoneAt);
    return { id: 'w:' + z.key, zone: z.key, zoneName: z.name, kind: 'weekly', name: KINDS.weekly.name, x: p.x, y: p.y };
  }

  var _list = null;
  function list() {
    if (_list) { return _list; }
    var B = BM(), W = global.DG.world;
    if (!B) { return []; }
    var terr = W && W.terrainAt ? function (tx, ty) { try { return W.terrainAt(tx, ty); } catch (e) { return null; } } : null;
    _list = [];
    for (var i = 0; i < B.ZONES.length; i++) { _list.push(entranceOf(i, terr, B.zoneAt)); }
    var al = altarOf(terr, B.zoneAt);
    if (al) { _list.push(al); }
    return _list;
  }
  /** 1차 결말(29장)을 마쳤나 — 메아리 입구가 보이고 열린다(손잡이 domain.echo 0 이면 없음) */
  function echoOpen() {
    var S = global.DG.story, v = S && S.on && S.on() && S.state ? S.state() : null;
    return !!(K('echo', 1) && v && v.ch >= ECHO_AFTER);
  }
  var _echo = null;
  /** 메아리 입구 넷 — 이야기 보스와 싸운 자리(그 자리를 모르면 그 입구만 빠진다). 열리기 전엔 [] */
  function echoList() {
    if (!echoOpen()) { return []; }
    var v0 = global.DG.story.state(), n0 = 0;
    ECHOES.forEach(function (e) { if (v0.ch >= (e.after || ECHO_AFTER)) { n0++; } });
    if (_echo && _echo.length === n0) { return _echo; }
    var S = global.DG.story, out = [], v = S && S.state ? S.state() : null, want = 0;
    ECHOES.forEach(function (e) {
      if (v.ch < (e.after || ECHO_AFTER)) { return; }                  // ⑲-69 메아리마다 열리는 장이 다르다
      want++;
      var p = S && S.spotPos ? S.spotPos(e.spot, e.off) : null;
      if (p) { out.push({ id: 'e:' + e.key, zone: null, zoneName: '', kind: 'echo', boss: e.boss, name: e.name, plus: e.plus || 0, x: Math.round(p.x), y: Math.round(p.y) }); }
    });
    if (out.length === want) { _echo = out; }
    return out;
  }
  /** 보이는 입구 전부 — 숨은 터·먹구름 제단 + 열렸으면 메아리 */
  function gates() { var L = list(); return echoOpen() ? L.concat(echoList()) : L; }
  function byId(id) { var L = gates(); for (var i = 0; i < L.length; i++) { if (L[i].id === id) { return L[i]; } } return null; }
  /** 이 입구의 파도 표 — 메아리는 그 보스 하나 */
  function wavesOf(d) { return d.kind === 'echo' ? [[d.boss]] : KINDS[d.kind].waves; }
  function isBossKind(kind) { return kind === 'weekly' || kind === 'echo'; }

  function gps() { var W = global.DG.world; return !!(W && W.mode === 'geo'); }
  function pos() { return core().save.player.pos; }

  /** 보이는(maxD 안) 가장 가까운 입구 — { d, dist, inRange } 또는 null */
  function nearest(maxD) {
    if (!on()) { return null; }
    var L = gates(), p = pos(), best = null, bd = maxD === undefined ? Infinity : maxD;
    for (var i = 0; i < L.length; i++) {
      var dd = Math.hypot(L[i].x - p.x, L[i].y - p.y);
      if (dd <= bd) { bd = dd; best = L[i]; }
    }
    return best ? { d: best, dist: bd, inRange: bd <= ENTER_R(gps()) } : null;
  }

  /* ── 원기·주(순수 + 세이브) ───────────────────────────── */

  var nowFn = function () { return Date.now(); };

  /** 원기 계산 — { v, t } 를 now 까지 채운 새 값. **순수 함수** */
  function resinAt(r, now) {
    var v = r && typeof r.v === 'number' ? r.v : RESIN_MAX, t = r && typeof r.t === 'number' ? r.t : now;
    if (v >= RESIN_MAX) { return { v: v, t: now }; }
    var gain = Math.floor(Math.max(0, now - t) / RESIN_MS);
    if (gain <= 0) { return { v: v, t: t }; }
    v = Math.min(RESIN_MAX, v + gain);
    return { v: v, t: v >= RESIN_MAX ? now : t + gain * RESIN_MS };
  }
  /** 이 주의 키 — 월요일 새벽 4시에 갈린다. **순수 함수** */
  function weekKey(at) {
    var d = new Date(at - 4 * 3600000), back = (d.getDay() + 6) % 7;
    var m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
    return m.getFullYear() + '-' + (m.getMonth() + 1) + '-' + m.getDate();
  }

  function sv() {
    var s = core().save;
    if (!s.resin || typeof s.resin.v !== 'number') { s.resin = { v: RESIN_MAX, t: nowFn() }; }
    if (!s.domain || typeof s.domain !== 'object') { s.domain = {}; }
    if (typeof s.domain.claims !== 'number') { s.domain.claims = 0; }
    if (!s.domain.weekly || typeof s.domain.weekly !== 'object') { s.domain.weekly = { week: '', n: 0 }; }
    var wk = weekKey(nowFn());
    if (s.domain.weekly.week !== wk) { s.domain.weekly = { week: wk, n: 0 }; }
    return s;
  }
  function resin() { var s = sv(); s.resin = resinAt(s.resin, nowFn()); return s.resin.v; }
  function spend(n) {
    if (resin() < n) { return false; }
    core().save.resin.v -= n;
    return true;
  }
  /** 다음 원기 1 까지 남은 밀리초(가득이면 0) */
  function resinNextMs() {
    var r = core().save.resin;
    if (resin() >= RESIN_MAX) { return 0; }
    return Math.max(0, r.t + RESIN_MS - nowFn());
  }
  function weeklyUsed() { return sv().domain.weekly.n; }
  function costOf(kind) {
    if (kind === 'echo') { return weeklyUsed() < WEEKLY_HALF_N ? Math.round(ECHO_COST / 2) : ECHO_COST; }    // ⑲-56 주간 보스와 같은 횟수를 센다
    return kind === 'weekly' ? (weeklyUsed() < WEEKLY_HALF_N ? WEEKLY_HALF : WEEKLY_COST) : COST;
  }

  function rank() { return (core().save.player && core().save.player.level) || 1; }
  function stageOpen(i) { return !!STAGES[i] && rank() >= STAGES[i].ar; }

  /* ── 보상(순수) ───────────────────────────────────────── */

  /** 종류·단계·몇 번째 받는지(세트 번갈이) → 보상 묶음. **순수 함수** */
  function rewardOf(kind, stage, seq, d) {
    var s = Math.max(0, Math.min(2, stage | 0)), odd = (seq | 0) % 2 === 1;
    var r = { gold: [60, 90, 130][s], party: [40, 60, 90][s], arts: [], polish: 0, ore: 0, mats: {} };
    if (kind === 'tomb') {
      var set = odd ? 'depth' : 'crimson';
      r.arts = [[4, 4], [4, 4, 5], [4, 5, 5]][s].map(function (q) { return { r: q, set: set }; });
      r.polish = [1, 2, 3][s];
    } else if (kind === 'school') {
      r.mats = [{ note: 3, guide: 1 }, { guide: 3 }, { guide: 3, secret: 1 }][s];
    } else if (kind === 'forge') {
      r.ore = [3, 5, 8][s];
    } else if (kind === 'weekly') {
      var ws = odd ? 'gladiator' : 'emblem';
      r.gold = [150, 200, 260][s]; r.party = [60, 90, 120][s];
      r.mats = [{ guide: 2, scale: 1 }, { guide: 3, scale: 2 }, { secret: 2, scale: 3, knot: 1 }][s];
      r.arts = [[5], [5], [5, 5]][s].map(function (q) { return { r: q, set: ws }; });
    } else if (kind === 'echo') {                                  // ⑲-56 메아리 — 주간보다 한 단 위(비전·매듭·★5)
      var es = odd ? 'emblem' : 'gladiator';
      r.gold = [200, 260, 340][s] + (d && d.plus ? d.plus : 0); r.party = [80, 110, 150][s];
      r.mats = [{ guide: 3, scale: 1 }, { guide: 4, scale: 2, secret: 1 }, { secret: 3, scale: 3, knot: 2 }][s];
      r.arts = [[5], [5], [5, 5]][s].map(function (q) { return { r: q, set: es }; });
    }
    return r;
  }
  function rewardText(r) {
    var TL = global.DG.talent, out = ['🪙 ' + r.gold, '부대 경험 ' + r.party], n4 = 0, n5 = 0, k;
    r.arts.forEach(function (a) { if (a.r === 5) { n5++; } else { n4++; } });
    if (n4) { out.push('★4 보패 ' + n4); }
    if (n5) { out.push('★5 보패 ' + n5); }
    if (r.polish) { out.push('연마석 ' + r.polish); }
    if (r.ore) { out.push('🪨 강화석 ' + r.ore); }
    for (k in r.mats) {
      if (Object.prototype.hasOwnProperty.call(r.mats, k) && r.mats[k]) {
        var M = TL && TL.MATS[k];
        out.push((M ? M.icon + ' ' + M.name : k) + ' ' + r.mats[k]);
      }
    }
    return out.join(' · ');
  }
  function grant(r) {
    var c = core(), H = global.DG.hero, AR = global.DG.artifact, WP = global.DG.weapon, TL = global.DG.talent, got = [];
    c.save.player.gold = (c.save.player.gold || 0) + r.gold;
    if (H && H.awardParty) { H.awardParty(r.party); }
    if (AR && AR.add) { r.arts.forEach(function (a) { got.push(AR.label(AR.add(a.r, a.set))); }); }
    if (r.polish && WP && WP.mat) { var gm = WP.mat(); gm.polish = (gm.polish || 0) + r.polish; }
    if (r.ore && WP && WP.addOre) { WP.addOre(r.ore); }
    if (TL && TL.addMats) { TL.addMats(r.mats); }
    return got;
  }

  /* ── 도전(런타임) ─────────────────────────────────────── */

  var run = null;
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }

  function enterCheck(d, stage) {
    if (!on()) { return { ok: false, why: '숨은 터가 꺼져 있다' }; }
    if (run) { return { ok: false, why: '이미 도전 중' }; }
    var F = FC();
    if (!F || !F.state || !F.state()) { return { ok: false, why: '들판 전투가 없다' }; }
    if (!d || !STAGES[stage]) { return { ok: false, why: '없는 단계' }; }
    if (!stageOpen(stage)) { return { ok: false, why: '여정 등급 ' + STAGES[stage].ar + ' 에 열림' }; }
    var S = F.state(), L = F.living(S);
    for (var i = 0; i < L.length; i++) { if (L[i].st === 'chase' || L[i].st === 'wind') { return { ok: false, why: '싸우는 중엔 못 들어간다' }; } }
    return { ok: true };
  }

  /** 들어간다 — 3초 뒤 첫 파도 */
  function enter(d, stage) {
    var chk = enterCheck(d, stage);
    if (!chk.ok) { return chk; }
    run = { d: d, stage: stage | 0, phase: 'wait', t: 0, fightT: 0, wave: -1, key: null, left: limitOf(d.kind),
            leyT: 0, p2: false, asked: false, x: d.x, y: d.y };
    closeCard();
    toast(KINDS[d.kind].icon + ' ' + d.name + ' ' + STAGES[run.stage].n + ' — 곧 적이 나타난다');
    core().emit('domain:enter', { id: d.id, stage: run.stage });
    return { ok: true };
  }
  function limitOf(kind) { return kind === 'echo' ? ECHO_LIMIT : (kind === 'weekly' ? WEEKLY_LIMIT : LIMIT); }

  function spawnWave(w) {
    var F = FC(), S = F && F.state();
    if (!S) { fail('들판 전투가 없다'); return; }
    var kd = KINDS[run.d.kind], kinds = wavesOf(run.d)[w], st = STAGES[run.stage], foes = [], i;
    for (i = 0; i < kinds.length; i++) {
      var a = (i / kinds.length) * Math.PI * 2 + 0.6, rr = kinds.length === 1 ? 0 : FOE_RING;
      foes.push({ kind: kinds[i], dx: Math.cos(a) * rr, dy: Math.sin(a) * rr });
    }
    var key = 'dm:' + run.d.id + ':' + w;
    F.spawnCamp(S, { key: key, x: run.x, y: run.y + (kinds.length === 1 ? 8 : 0), tier: TIER, kind: 'domain', foes: foes });
    var uids = S.camps[key].uids;
    for (i = 0; i < uids.length; i++) {
      var f = S.foes[uids[i]];
      F.applyWorld(f, 0);                                  // 천하 등급은 안 받는다 — 단계 배율만
      f.hpMax = f.hp = Math.round(f.hpMax * st.hp);
      f.shieldMax = f.shield = Math.round(f.shieldMax * st.hp);
      f.atk = Math.round(f.atk * st.atk * (run.d.kind === 'forge' ? K('leyAtk', LEY_ATK) : 1));
      f.st = 'chase'; f.stT = 0;
    }
    run.wave = w; run.key = key; run.phase = 'fight';
    toast('⚔️ 파도 ' + (w + 1) + '/' + wavesOf(run.d).length + (run.d.kind === 'weekly' ? ' — 먹구름 이무기' : (run.d.kind === 'echo' ? ' — ' + (F.FOES[kinds[0]] ? F.FOES[kinds[0]].name : '보스') + '의 메아리' : '')));
  }

  function campFoes() {
    var F = FC(), S = F && F.state(), out = [];
    if (!S || !run || !run.key || !S.camps[run.key]) { return out; }
    var u = S.camps[run.key].uids;
    for (var i = 0; i < u.length; i++) { var f = S.foes[u[i]]; if (f && !f.dead) { out.push(f); } }
    return out;
  }

  /** 숨은 터 무리를 다 치운다 — 끝날 때 */
  function despawn() {
    var F = FC(), S = F && F.state(), k, j;
    if (!S) { return; }
    for (k in S.camps) {
      if (!S.camps.hasOwnProperty(k) || k.indexOf('dm:') !== 0) { continue; }
      for (j = 0; j < S.camps[k].uids.length; j++) { delete S.foes[S.camps[k].uids[j]]; }
      delete S.camps[k];
    }
    for (k in S.cleared) { if (S.cleared.hasOwnProperty(k) && k.indexOf('dm:') === 0) { delete S.cleared[k]; } }
  }

  function end(msg) {
    despawn();
    var d = run ? run.d : null;
    run = null;
    hideHud();
    if (msg) { toast(msg); }
    core().emit('domain:end', { id: d ? d.id : null });
    core().emit('changed');
  }
  /** 실패 — 원기는 안 쓴다 */
  function fail(why) {
    if (!run) { return false; }
    core().log('🌀 ' + run.d.name + ' 도전 실패 — ' + why, 'bad');
    end('🌀 도전 실패 — ' + why);
    return true;
  }
  function leave() {
    if (!run) { return false; }
    if (run.phase === 'tree') { end('🌳 보상을 두고 숨은 터를 나왔다'); return true; }
    return fail('물러났다');
  }

  function onClear(e) {
    if (!run || !e || e.camp !== run.key) { return; }
    var waves = wavesOf(run.d);
    if (run.wave + 1 < waves.length) { spawnWave(run.wave + 1); return; }
    run.phase = 'tree';
    despawn();
    core().emit('domain:clear', { id: run.d.id, kind: run.d.kind, stage: run.stage });   // ⑲-12 이야기 임무가 본다
    sfx('reward');
    toast('🌳 보상 나무가 자랐다 — 가운데로 가서 원기 ' + costOf(run.d.kind) + ' 쓰면 받는다');
    core().log('🌀 ' + run.d.name + ' ' + STAGES[run.stage].n + ' 돌파 — ' + Math.round(run.fightT) + '초', 'good');
    core().emit('changed');
  }
  function onKill(e) {
    if (!run || !e || e.camp !== run.key || run.d.kind !== 'school') { return; }
    var F = FC(), S = F && F.state(), mx = F && (typeof F.ENERGY_MAX === 'function' ? F.ENERGY_MAX() : F.ENERGY_MAX) || 60;
    if (!S) { return; }
    for (var i = 0; i < S.party.length; i++) { if (!S.party[i].down) { S.party[i].energy = Math.min(mx, S.party[i].energy + LEY_ENERGY); } }
  }
  function onWipe() { if (run && run.phase !== 'tree') { fail('모두 쓰러졌다'); } }

  /** 보상 나무 — 원기를 써서 받는다 */
  function claim() {
    if (!run || run.phase !== 'tree') { return { ok: false, why: '보상 나무가 없다' }; }
    var cost = costOf(run.d.kind);
    if (resin() < cost) { return { ok: false, why: '원기가 모자라다(' + resin() + '/' + cost + ')', cost: cost }; }
    spend(cost);
    var s = sv(), r = rewardOf(run.d.kind, run.stage, s.domain.claims, run.d);
    s.domain.claims += 1;
    if (isBossKind(run.d.kind)) { s.domain.weekly.n += 1; }
    var arts = grant(r), txt = rewardText(r), name = run.d.name + ' ' + STAGES[run.stage].n;
    core().log('🌳 ' + name + ' 보상 — 원기 ' + cost + ' · ' + txt, 'good');
    core().emit('domain:claim', { id: run.d.id, stage: run.stage, cost: cost });
    core().persist();
    end('🌳 ' + txt);
    return { ok: true, cost: cost, reward: r, text: txt, arts: arts };
  }

  /* 주간 보스 2단계 — 체력 절반에서 뇌 방패·빨라짐 */
  function stepBoss() {
    if (!isBossKind(run.d.kind) || run.p2) { return; }
    var L = campFoes();
    if (run.d.kind === 'echo') {                                  // ⑲-56 메아리 — 체력 절반에서 그 보스의 원소 방패
      for (var j = 0; j < L.length; j++) {
        var b = L[j];
        if (b.hp > b.hpMax * P2_AT || !b.el) { continue; }
        run.p2 = true;
        b.layers = [b.el]; b.layer = 0; b.shEl = b.el;
        b.shieldMax = b.shield = Math.round(b.hpMax * P2_SHIELD);
        toast('🔮 ' + b.name + '이(가) 원소 방패를 둘렀다 — 상성 원소로 깨라');
      }
      return;
    }
    for (var i = 0; i < L.length; i++) {
      var f = L[i];
      if (f.kind !== 'w_imugi' || f.hp > f.hpMax * P2_AT) { continue; }
      run.p2 = true;
      f.layers = ['elec']; f.layer = 0; f.shEl = 'elec';
      f.shieldMax = f.shield = Math.round(f.hpMax * P2_SHIELD);
      f.cdMul = P2_CD;
      toast('⛈️ 먹구름 이무기가 뇌 방패를 둘렀다 — 불·물로 깨라');
    }
  }
  function stepLey(dt) {
    if (run.d.kind !== 'tomb') { return; }
    run.leyT += dt;
    if (run.leyT < LEY_WATER_SEC) { return; }
    run.leyT = 0;
    campFoes().forEach(function (f) { if (!f.frozenT) { f.aura = 'water'; f.auraT = 5; } });
  }

  function step(dt) {
    if (!run) { return; }
    run.t += dt;
    var p = pos(), dd = Math.hypot(p.x - run.x, p.y - run.y), g = gps();
    if (run.phase === 'tree') {
      if (dd > ARENA_R(g) * 1.5) { end('🌳 보상을 두고 숨은 터를 나왔다'); return; }
      if (dd <= TREE_R(g) && !run.asked) { run.asked = true; openTree(); }
      return;
    }
    if (dd > ARENA_R(g)) { fail('원판을 벗어났다'); return; }
    if (run.phase === 'wait') {
      if (run.t >= START_DELAY) { spawnWave(0); }
      return;
    }
    run.fightT += dt;
    run.left = limitOf(run.d.kind) - run.fightT;
    if (run.left <= 0) { fail('시간이 다 됐다'); return; }
    stepLey(dt);
    stepBoss();
  }

  var subbed = false;
  function subscribe() {
    if (subbed || !core() || !core().on) { return; }
    subbed = true;
    core().on('field:clear', onClear);
    core().on('field:kill', onKill);
    core().on('field:wipe', onWipe);
    core().on('domain:request', function (d) { openGate(d); });
  }

  function tick(dt) {
    if (!core() || !core().save) { return; }
    subscribe();
    if (!on()) { if (run) { end(null); } clearFx(); return; }
    step(dt);
    if (!global.DG_NO_DRAW) { paintHud(); paint(dt); }
  }

  /* ── 화면: 카드 ───────────────────────────────────────── */

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function host() { return global.document && global.document.getElementById('encounter'); }
  var cardOpen = false;
  function closeCard() {
    if (!cardOpen) { return; }
    cardOpen = false;
    var el = host();
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    core().emit('changed');
  }
  function mmss(ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + '분 ' + (s % 60) + '초'; }
  function resinLine() {
    var n = resinNextMs();
    return '🌙 원기 ' + resin() + '/' + RESIN_MAX + (n ? ' <small>(다음 1 까지 ' + mmss(n) + ')</small>' : '');
  }

  /** 입구 카드 — 단계 셋 */
  function openGate(d) {
    if (!d || run || (global.DG.encounter && global.DG.encounter.active)) { return; }
    var el = host();
    if (!el) { return; }
    var kd = KINDS[d.kind], cost = costOf(d.kind), sd = sv(), i, btns = '';
    for (i = 0; i < STAGES.length; i++) {
      var ok = stageOpen(i);
      btns += '<button class="btn ' + (ok ? 'primary' : 'ghost') + ' wide" data-stage="' + i + '"' + (ok ? '' : ' disabled') + '>' +
        '단계 ' + STAGES[i].n + (ok ? ' <small>' + esc(rewardText(rewardOf(d.kind, i, sd.domain.claims, d))) + '</small>'
          : ' <small>여정 등급 ' + STAGES[i].ar + ' 에 열림</small>') + '</button>';
    }
    el.innerHTML =
      '<div class="enc-card">' +
        '<div class="enc-big"><span style="font-size:56px">' + kd.icon + '</span></div>' +
        '<h3>' + esc(d.name) + '</h3>' +
        '<p class="quote">터 기운 — ' + esc(kd.ley) + '</p>' +
        '<div class="enc-reward">' + resinLine() + ' · 보상 나무에 ' + cost +
          (isBossKind(d.kind) ? ' <small>(이번 주 주간·메아리 ' + weeklyUsed() + '번 — 처음 ' + WEEKLY_HALF_N + '번은 반값)</small>' : '') + '</div>' +
        '<div class="enc-reward">' + (isBossKind(d.kind) ? '보스 하나' : '파도 둘') + ' · 제한 ' + limitOf(d.kind) + '초 · 원판을 벗어나면 실패(원기는 안 쓴다)</div>' +
        btns +
        '<button class="btn ghost wide" data-act="ok">물러난다</button>' +
      '</div>';
    el.classList.add('show');
    cardOpen = true;
    el.querySelector('[data-act="ok"]').addEventListener('click', closeCard);
    Array.prototype.forEach.call(el.querySelectorAll('[data-stage]'), function (b) {
      b.addEventListener('click', function () {
        var r = enter(d, +b.getAttribute('data-stage'));
        if (!r.ok) { toast('🌀 ' + r.why); }
      });
    });
  }

  /** 보상 나무 카드 */
  function openTree() {
    var el = host();
    if (!el || !run) { return; }
    var cost = costOf(run.d.kind), have = resin(), r = rewardOf(run.d.kind, run.stage, sv().domain.claims, run.d);
    el.innerHTML =
      '<div class="enc-card">' +
        '<div class="enc-big"><span style="font-size:56px">🌳</span></div>' +
        '<h3>보상 나무</h3>' +
        '<p class="quote">' + esc(run.d.name) + ' ' + STAGES[run.stage].n + ' — 터의 열매가 맺혔다.</p>' +
        '<div class="enc-reward">' + esc(rewardText(r)) + '</div>' +
        '<div class="enc-reward">' + resinLine() + '</div>' +
        (have >= cost
          ? '<button class="btn primary wide" data-act="claim">🌙 원기 ' + cost + ' 쓰고 받는다</button>'
          : '<div class="enc-reward">원기가 모자라다 — ' + cost + ' 만큼 있어야 한다</div>') +
        '<button class="btn ghost wide" data-act="ok">받지 않고 나간다</button>' +
      '</div>';
    el.classList.add('show');
    cardOpen = true;
    var cl = el.querySelector('[data-act="claim"]');
    if (cl) { cl.addEventListener('click', function () { closeCard(); claim(); }); }
    el.querySelector('[data-act="ok"]').addEventListener('click', function () { closeCard(); leave(); });
  }

  /* ── 화면: 도전 띠 ────────────────────────────────────── */

  var hudEl = null, hudKey = '';
  function hideHud() { if (hudEl) { hudEl.style.display = 'none'; hudKey = ''; } }
  function paintHud() {
    if (!run) { hideHud(); return; }
    if (!hudEl && global.document) {
      hudEl = global.document.createElement('div');
      hudEl.id = 'dm-hud';
      hudEl.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:40;display:none;' +
        'background:rgba(18,22,34,.86);color:#fff;border-radius:14px;padding:6px 12px;font-size:13px;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.35);white-space:nowrap;align-items:center;gap:10px';
      hudEl.addEventListener('click', function (e) { if (e.target.closest('[data-act="dm-leave"]')) { leave(); } });
      global.document.body.appendChild(hudEl);
    }
    if (!hudEl) { return; }
    var kd = KINDS[run.d.kind], txt;
    if (run.phase === 'wait') { txt = '곧 적이 나타난다…'; }
    else if (run.phase === 'tree') { txt = '🌳 보상 나무로'; }
    else {
      txt = (isBossKind(run.d.kind) ? '' : '파도 ' + (run.wave + 1) + '/' + wavesOf(run.d).length + ' · ') + Math.max(0, Math.ceil(run.left)) + '초';
      if (isBossKind(run.d.kind)) {
        var b = campFoes()[0];
        if (b) { txt = (run.d.kind === 'echo' ? '메아리' : '이무기') + ' ' + Math.ceil(100 * b.hp / b.hpMax) + '%' + (b.shield > 0 ? ' · 🛡️방패 ' + b.shield : '') + ' · ' + txt; }
      }
    }
    var key = run.phase + '|' + txt;
    if (key === hudKey) { return; }
    hudKey = key;
    hudEl.innerHTML = '<span style="color:' + kd.color + '">' + kd.icon + ' ' + esc(run.d.name) + ' ' + STAGES[run.stage].n + '</span>' +
      '<b>' + esc(txt) + '</b><button class="btn ghost" data-act="dm-leave" style="padding:2px 10px;font-size:12px">나가기</button>';
    hudEl.style.display = 'flex';
  }

  /* ── 화면: 3D 입구·보상 나무 ──────────────────────────── */

  var nodes = {}, glowTex = {}, clock = 0;
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function glow(T3, color) {
    if (glowTex[color]) { return glowTex[color]; }
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex[color] = new T3.CanvasTexture(cv);
    return glowTex[color];
  }
  function sprite(T3, color, size, op) {
    var m = new T3.SpriteMaterial({ map: glow(T3, color), transparent: true, depthWrite: false, opacity: op, blending: T3.AdditiveBlending, fog: false });
    var s = new T3.Sprite(m); s.scale.set(size, size, size);
    return s;
  }
  function model(key, h) {
    var A = global.DG.asset3d, n = A && A.build ? A.build(key, { id: key }) : null;
    if (n) { n.scale.set(h, h, h); }
    return n;
  }
  function dropNode(k) { var w = W3(), n = nodes[k]; if (w && n) { w.removeFx(n.root); } delete nodes[k]; }
  function clearFx() { for (var k in nodes) { if (nodes.hasOwnProperty(k)) { dropNode(k); } } }
  function gy(w, x, y) { return w.groundY ? w.groundY(x, y) : 0; }

  function paint(dt) {
    clock += dt || 0;
    var w = W3();
    if (!w) { clearFx(); return; }
    var T3 = w.three();
    if (!T3) { return; }
    var p = pos(), L = gates(), seen = {}, i;
    for (i = 0; i < L.length; i++) {
      var d = L[i];
      if (Math.hypot(d.x - p.x, d.y - p.y) > 180) { continue; }
      seen[d.id] = true;
      var nd = nodes[d.id];
      if (!nd) {
        nd = nodes[d.id] = { root: new T3.Group() };
        var m = model(isBossKind(d.kind) ? 'domain:altar' : 'domain:gate', isBossKind(d.kind) ? 6 : 5);
        if (m) { nd.root.add(m); }
        nd.halo = sprite(T3, KINDS[d.kind].color, 5, 0.5); nd.halo.position.y = 2.4; nd.root.add(nd.halo);
        w.addFx(nd.root);
      }
      nd.root.position.set(d.x, gy(w, d.x, d.y), d.y);
      nd.halo.material.opacity = 0.4 + Math.sin(clock * 2) * 0.12;
    }
    if (run && run.phase === 'tree') {
      seen.tree = true;
      var tn = nodes.tree;
      if (!tn) {
        tn = nodes.tree = { root: new T3.Group() };
        var tm = model('domain:tree', 4);
        if (tm) { tn.root.add(tm); }
        tn.halo = sprite(T3, '#ffe28a', 4, 0.6); tn.halo.position.y = 2.2; tn.root.add(tn.halo);
        w.addFx(tn.root);
      }
      tn.root.position.set(run.x, gy(w, run.x, run.y), run.y);
      tn.halo.material.rotation = clock;
    }
    for (var k in nodes) { if (nodes.hasOwnProperty(k) && !seen[k]) { dropNode(k); } }
  }

  global.DG = global.DG || {};
  global.DG.domain = {
    KINDS: KINDS, KIND_ORDER: KIND_ORDER, STAGES: STAGES, TIER: TIER, RESIN_MAX: RESIN_MAX, RESIN_MS: RESIN_MS,
    COST: COST, WEEKLY_COST: WEEKLY_COST, WEEKLY_HALF: WEEKLY_HALF, WEEKLY_HALF_N: WEEKLY_HALF_N,
    LIMIT: LIMIT, WEEKLY_LIMIT: WEEKLY_LIMIT, START_DELAY: START_DELAY, ALTAR_ZONE: ALTAR_ZONE,
    P2_AT: P2_AT, P2_SHIELD: P2_SHIELD, P2_CD: P2_CD, LEY_ATK: LEY_ATK, LEY_ENERGY: LEY_ENERGY,
    ARENA_R: ARENA_R, ENTER_R: ENTER_R, TREE_R: TREE_R,
    /* 판정(순수) */
    ECHOES: ECHOES, ECHO_AFTER: ECHO_AFTER, ECHO_COST: ECHO_COST, ECHO_LIMIT: ECHO_LIMIT, echoOpen: echoOpen, echoList: echoList, gates: gates, wavesOf: wavesOf,
    entranceOf: entranceOf, altarOf: altarOf, resinAt: resinAt, weekKey: weekKey, rewardOf: rewardOf, rewardText: rewardText,
    /* 세이브를 읽는 값 */
    list: list, byId: byId, nearest: nearest, resin: resin, resinNextMs: resinNextMs, spendResin: spend, costOf: costOf, weeklyUsed: weeklyUsed,
    stageOpen: stageOpen, enterCheck: enterCheck,
    /* 도전 */
    enter: enter, leave: leave, claim: claim, step: step, tick: tick, openGate: openGate,
    active: function () { return !!run; },
    run: function () { return run; },
    _setNowForTest: function (fn) { nowFn = fn || function () { return Date.now(); }; },
    _resetForTest: function () { _list = null; _echo = null; if (run) { despawn(); } run = null; hideHud(); subscribe(); }
  };
})(window);
