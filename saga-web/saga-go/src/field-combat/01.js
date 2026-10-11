/**
 * 들판 전투(野戰) — 오픈월드 RPG식 (PLAN §5 ⑨, 2026-09-24 사용자 선택)
 * ---------------------------------------------------------------
 * 옛 전투(`rogue-action.js`)는 사건이 열어 주는 1:1 결투다. 이것은 **지도 위에
 * 원래 사는 적 무리**와 무대 전환 없이 싸운다 — 걷다가 보이면 붙고, 떨어지면 끝난다.
 *
 *   무리      160m 격자마다 해시로 자리·종류가 정해진다(세이브 없이도 늘 같은 자리).
 *             멀리(900m 마다) 갈수록 등급이 오른다 — 오픈월드 RPG의 "세계 레벨" 자리
 *   편성      동행 앞 4명. 숫자 1~4(또는 초상)로 즉시 교체, 교체 1초 쿨
 *   조준      §5 ⑲-22 활 인물만 R(터치 🎯) — 제자리에서 방향 키로 겨누고(가까운 적·과녁·석등에 저절로 잠김) 공격을 누르는
 *             동안 충전, 떼면 쏜다. 조준 밖에서 활 인물이 공격을 길게 누르면 강공격 대신 조준·충전 → 떼면 쏘고 나온다.
 *             1.4초 다 차면 인물 원소 ×1.25(모르는 적이면 급소 = 반드시 치명), 덜 차면 물리 ×0.45. 화살 60m/초·45m.
 *             충전 화살이 멈춘 자리는 원소 신호(석등·제단을 멀리서 켠다). 화살은 상자 과녁(treasure.js)도 켠다
 *   조작      기본 공격 3타 · 길게 누르면 강공격(0.4초·스태미나 20) · 활공 중엔 낙하 공격(§5 ⑲-2) ·
 *             원소 스킬(7초) · 원소 해방(기력 60) · 회피(스태미나 20)
 *   원소      일곱 — 화·수·뇌·풍·빙·암·초(§5 ⑲-1, saga-godot PLAN 106 ⑭). 인물마다 id 해시로 고정, 주인공은 화.
 *             풍·암은 적에게 안 붙고 반응만 일으킨다
 *   반응      물안개·녹임 ×1.5 · 터짐(4m 광역·밀침) · 물벼락(3초 지속) · 얼어붙음(2.5초 멈춤 → 깨뜨림 ×1.5) ·
 *             서리번개(3m + 8초 물리 ×1.4) · 회오리(4m 원소 옮기기) · 굳힘(명단 보호막) · 꽃피움(씨앗) ·
 *             들불(0.5초 × 8) · 싹틈(8초 뇌·초 ×1.25)
 *   원소 방패 방패 동안 체력 대신 방패만 깎인다. 같은 원소 면역·물리 ×0.4(바위는 ×1)·
 *             상성(수>화·뇌>수·화>뇌·암>풍·화>빙·초>암·풍>초) ×2.5 → 깨지면 2초 비틀거림
 *
 * **판정 층(`create`·`step`·`attack`·`skill`·`burst`·`dodge`·`swap`·`react`·
 * `shieldMul`·`campAt`)은 순수 함수다** — 화면·세이브를 안 만진다. 자가진단이 이것만
 * 굴린다. 세이브는 런타임(`tick`)이 보상·치운 무리 시각(`save.field`)만 쓴다.
 * 화면은 `world3d.js` 가 `live()` 를 읽어 배우를 세우고, 원(예고·광역)·숫자는 여기서 얹는다.
 * 손잡이 `field.on` 을 0 으로 두면 무리째 사라진다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function data() { return global.DG.data; }
  function K(key, def) { return core().tuned('field.' + key, def); }

  /* ── 원소 ─────────────────────────────────────────────── */
  var EL = {
    fire:  { key: 'fire',  name: '화', icon: '🔥', color: '#ff6a3d' },
    water: { key: 'water', name: '수', icon: '💧', color: '#3fa9f5' },
    elec:  { key: 'elec',  name: '뇌', icon: '⚡', color: '#b57bff' },
    wind:  { key: 'wind',  name: '풍', icon: '🌪️', color: '#5fe0bd' },
    ice:   { key: 'ice',   name: '빙', icon: '❄️', color: '#aeeaff' },
    rock:  { key: 'rock',  name: '암', icon: '🪨', color: '#eeb84c' },
    grass: { key: 'grass', name: '초', icon: '🌿', color: '#8cd938' }
  };
  /* ⑲-1 — 옛 셋을 앞에 그대로 둔다. 동행 원소는 id 해시 % 7 이라 옛 동행 원소가 바뀐다(세이브엔 원소가 없다) */
  var EL_KEYS = ['fire', 'water', 'elec', 'wind', 'ice', 'rock', 'grass'];
  var NO_AURA = { wind: 1, rock: 1 };                          // 붙지 않고 반응만
  var SWIRLABLE = { fire: 1, water: 1, elec: 1, ice: 1 };      // 회오리·굳힘이 받는 원소
  /** 방패 원소 → 그것을 크게 깎는 원소 (수>화 · 뇌>수 · 화>뇌 · 암>풍 · 화>빙 · 초>암 · 풍>초) */
  var COUNTER = { fire: 'water', water: 'elec', elec: 'fire', wind: 'rock', ice: 'fire', rock: 'grass', grass: 'wind' };
  /** 반응 — 이름·빛깔 원소·고리 반지름(화면용). 번개싹·덩굴뻗음은 싹틈 상태에서, 깨뜨림은 얼어붙음 상태에서 난다 */
  var REACT = {
    vaporize: { name: '물안개', el: 'fire', r: 0 }, melt: { name: '녹임', el: 'fire', r: 0 },
    overload: { name: '터짐', el: 'fire', r: 4 }, charged: { name: '물벼락', el: 'elec', r: 3 },
    frozen: { name: '얼어붙음', el: 'ice', r: 0 }, superconduct: { name: '서리번개', el: 'ice', r: 3 },
    swirl: { name: '회오리', el: 'wind', r: 4 }, crystallize: { name: '굳힘', el: 'rock', r: 0 },
    bloom: { name: '꽃피움', el: 'grass', r: 0 }, burning: { name: '들불', el: 'fire', r: 0 },
    quicken: { name: '싹틈', el: 'grass', r: 0 }, aggravate: { name: '번개싹', el: 'elec', r: 0 },
    spread: { name: '덩굴뻗음', el: 'grass', r: 0 }, shatter: { name: '깨뜨림', el: 'ice', r: 0 }
  };
  var REACT_NAME = {};
  (function () { for (var k in REACT) { if (REACT.hasOwnProperty(k)) { REACT_NAME[k] = REACT[k].name; } } })();
  function attaches(el) { return !!el && !NO_AURA[el]; }

  function on() { return K('on', 1) ? true : false; }
  function PARTY_MAX() { return 4; }
  function REACH() { return K('reach', 3.2); }           // 기본 공격 사거리(m)
  function LUNGE_R() { return K('lungeR', 6); }          // 이 안이면 한 걸음 파고들며 친다
  /* 2026-09-28 실기 Q6 "캐릭터가 너무 가까움·모션이 안 보임" — 거리를 몸 한가운데끼리 재서 적이 코앞 1.6m 까지
     파고들었는데, 화면의 적 몸은 키 3.4m×h 로 서 길이가 5~8m(멧돼지 5.7·곰 7.8)라 캐릭터가 적 몸속에 묻혔다.
     적마다 몸 반지름을 두고 멈춤·사거리·맞힘을 **몸 가장자리**에서 잰다. 0 이면 옛 한가운데 거리 */
  function BODY(f) { var F = f && FOES[f.kind]; return F ? (F.h || 1) * K('bodyMul', 1.6) : 0; }
  function SKILL_R() { return K('skillR', 4.5); }
  function SKILL_AIM() { return K('skillAim', 8); }      // 스킬이 적을 겨누는 거리
  function SKILL_CD() { return K('skillCd', 7); }
  function SKILL_MUL() { return K('skillMul', 2.2); }
  function BURST_R() { return K('burstR', 7); }
  function BURST_CD() { return K('burstCd', 12); }
  function BURST_MUL() { return K('burstMul', 4.5); }
  function ENERGY_MAX() { return 60; }
  function STA_MAX() { return 100; }
  function DODGE_COST() { return K('dodgeCost', 20); }
  function DODGE_IFRAME() { return K('dodgeIframe', 0.35); }
  function DASH_M() { return K('dashM', 3.6); }
  function DASH_T() { return 0.18; }
  function SWAP_CD() { return K('swapCd', 1); }
  /* ⑲-2 강공격·낙하 공격 — saga-godot PLAN 106 ⑧ 칸(둘 다 물리, 깨뜨림을 낸다) */
  function CHARGE_HOLD() { return 0.4; }
  /* ⑲-22 조준 사격 */
  function AIM_R() { return 40; }  function AIM_CONE() { return 0.16; }  function AIM_TURN() { return 2.4; }
  function AIM_FULL() { return 1.4; }  function AIM_PART() { return 0.45; }  function AIM_FULLMUL() { return 1.25; }  function AIM_GAP() { return 0.3; }
  function ARROW_V() { return 60; }  function ARROW_RANGE() { return 45; }  function ARROW_EL_R() { return 1.2; }  function CHARGE_COST() { return K('chargeCost', 20); }
  function CHARGE_MUL() { return K('chargeMul', 1.3); }  function CHARGE_REACH() { return 3.2; }  function CHARGE_ARC() { return -0.2; }
  function wpnSlot(w, step) { return K('wpnAnim', 1) ? 'Wpn_' + ({ sword: 1, claymore: 1, polearm: 1, catalyst: 1, bow: 1 }[w] ? w : 'sword') + '_' + Math.max(0, Math.min(2, step | 0)) : 'attack'; }   function wpnMs(w, step, dflt) { var OA = global.DG.ownAnim, d = OA && OA.combatDur ? OA.combatDur(wpnSlot(w, step)) : 0; return d ? Math.round(d * 1000) : dflt; }   function WPN_HOLD() { return K('finishHold', 70); }   function PLUNGE_R() { return 3.5; }     function PLUNGE_MUL() { return K('plungeMul', 1.2); }   // W-0169 3D 무기 몸짓 이름·길이·3타 마무리 멈춤(ms)
  function PLUNGE_PER_M() { return 0.1; } function PLUNGE_MAX_M() { return 15; }
  function VAPOR_MUL() { return K('vaporMul', 1.5); }
  function OVERLOAD_R() { return 4; }
  function OVERLOAD_MUL() { return K('overloadMul', 1.2); }
  function CHARGED_R() { return 3; }
  function CHARGED_MUL() { return K('chargedMul', 0.45); }
  function AURA_T() { return 7; }
  /* ⑲-1 새 반응 수치 — saga-godot PLAN 106 ⑭ 칸 그대로 */
  function MELT_MUL() { return K('meltMul', 1.5); }
  function FROZEN_T() { return 2.5; }
  function SHATTER_MUL() { return 1.5; }
  function SUPER_R() { return 3; }       function SUPER_MUL() { return 0.5; }   function SUPER_T() { return 8; }   function SUPER_PHYS() { return 1.4; }
  function SWIRL_R() { return 4; }       function SWIRL_MUL() { return 0.6; }
  function CRYSTAL_HP() { return 0.2; }  function CRYSTAL_T() { return 15; }
  function BLOOM_R() { return 3; }       function BLOOM_T() { return 1.5; }     function BLOOM_MUL() { return 1.5; }
  function BURN_N() { return 8; }        function BURN_EVERY() { return 0.5; }  function BURN_MUL() { return 0.2; }
  function QUICK_T() { return 8; }       function QUICK_MUL() { return 1.25; }
  function SHIELD_STUN() { return 2; }
  function STUN_MUL() { return 1.3; }
  function PHYS_SHIELD() { return 0.4; }
  var PHYS_SHIELD_BY = { rock: 1.0 };      // 바위 방패는 물리로도 제대로 깎인다
  function COUNTER_MUL() { return 2.5; }
  function AGGRO_R() { return K('aggroR', 12); }
  function LEASH_R() { return K('leashR', 34); }
  function CALM_REGEN() { return 4; }       // 이만큼 조용하면 체력이 돈다
  function REVIVE_CALM() { return K('reviveCalm', 15); }
  function HP_BASE() { return K('hpBase', 520); }
  function ATK_BASE() { return K('atkBase', 80); }
  function SHIELD_BASE() { return K('shieldBase', 300); }

  /* ── 해시(씨앗 없이 자리만으로) ───────────────────────── */
  function h3(a, b, s) {
    var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function hs(str) {
    var h = 2166136261;
    str = String(str || '');
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /** 인물의 원소 — id 해시로 고정(바뀌지 않는다). 주인공 '_me' 는 화(saga-godot 와 같게) */
  function elementOf(id) {
    var SM = global.DG.story && global.DG.story.MEMBERS;                 // ⑲-15 이야기 동료는 표
    if (SM && SM[id]) { return SM[id].el; }
    return id === '_me' ? 'fire' : EL_KEYS[Math.floor(hs(id) * EL_KEYS.length) % EL_KEYS.length];
  }

  /* ⑫ 스킬 모양 — 인물마다 다르다(원소와 다른 해시). 주인공 '나'는 옛 원형 광역 그대로.
     찌르기: 앞으로 좁고 길게 세게 · 돌진: 파고들며 길 위를 친다(짧은 무적) ·
     장판: 그 자리가 몇 초 동안 원소를 묻힌다(반응 굴리기) · 소환: 곁의 정령이 가까운 적을 친다 */
  var SHAPES = {
    circle: { key: 'circle', name: '원형',   icon: '⭕' },
    thrust: { key: 'thrust', name: '찌르기', icon: '🗡️' },
    dash:   { key: 'dash',   name: '돌진',   icon: '💨' },
    field:  { key: 'field',  name: '장판',   icon: '🌀' },
    summon: { key: 'summon', name: '소환',   icon: '👻' }
  };
  var SHAPE_KEYS = ['thrust', 'dash', 'field', 'summon'];
  function shapeOf(id) { return id === '_me' ? 'circle' : SHAPE_KEYS[Math.floor(hs(id + '#shape') * 4) % 4]; }
  function THRUST_LEN() { return 8; }  function THRUST_W() { return 1.6; }  function THRUST_MUL() { return K('thrustMul', 2.8); }
  function DASH_LEN() { return 6; }    function DASH_W() { return 1.8; }    function DASH_MUL() { return K('dashMul', 2.4); }
  function FIELD_R() { return 4; }     function FIELD_T() { return 5; }     function FIELD_MUL() { return K('fieldMul', 0.6); }
  function SUMMON_T() { return 8; }    function SUMMON_EVERY() { return 1.5; }  function SUMMON_R() { return 7; }  function SUMMON_MUL() { return K('summonMul', 0.9); }
  /** 점 (x,y) 에서 선분 (ax,ay)-(bx,by) 까지 거리 */
  function segDist(x, y, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
    var u = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)) : 0;
    return Math.hypot(x - (ax + vx * u), y - (ay + vy * u));
  }

  /**
   * 원소 반응 — 이미 붙어 있는 원소(aura)에 새 원소(hit)가 닿으면.
   * 같은 원소·물리·반응 없는 쌍은 null. 풍·암은 받는 원소(화·수·뇌·빙)에만 반응한다.
   * from = 반응 전에 붙어 있던 원소(회오리가 옮겨 붙인다)
   */
  function react(aura, hit) {
    if (!aura || !hit || aura === hit) { return null; }
    var kind = null;
    if (hit === 'wind') { kind = SWIRLABLE[aura] ? 'swirl' : null; }
    else if (hit === 'rock') { kind = SWIRLABLE[aura] ? 'crystallize' : null; }
    else {
      kind = {
        'fire+water': 'vaporize', 'elec+fire': 'overload', 'elec+water': 'charged',
        'fire+ice': 'melt', 'ice+water': 'frozen', 'elec+ice': 'superconduct',
        'grass+water': 'bloom', 'fire+grass': 'burning', 'elec+grass': 'quicken'
      }[[aura, hit].sort().join('+')] || null;
    }
    return kind ? { kind: kind, name: REACT_NAME[kind], from: aura } : null;
  }

  /** 원소 방패가 받는 배수 — 같은 원소 0 · 물리 0.4(바위 1) · 상성 2.5 · 그 밖 1 */
  function shieldMul(shEl, hitEl) {
    if (!hitEl) { return PHYS_SHIELD_BY[shEl] || PHYS_SHIELD(); }
    if (hitEl === shEl) { return 0; }
    if (COUNTER[shEl] === hitEl) { return COUNTER_MUL(); }
    return 1;
  }

  /* ── 적 ───────────────────────────────────────────────
   * ref 는 도감 펫 id — 이미 구워 둔 3D 몸·2D 그림을 그대로 빌린다(새 에셋 없음).
   * type: melee(코앞) · spit(내가 서 있던 자리에 떨어진다) · slam(제 둘레 원)
   */
  var FOES = {
    boar:   { name: '멧돼지',     ref: 'pt_boar',         el: null,    hp: 1.0, atk: 1.0, spd: 5.5, reach: 2.0, type: 'melee', wind: 0.6,  cd: 1.8, h: 0.95, exp: 1 },
    imp:    { name: '불도깨비',   ref: 'pt_dokkaebi',     el: 'fire',  hp: 0.9, atk: 1.1, spd: 4.5, reach: 2.2, type: 'melee', wind: 0.7,  cd: 1.9, h: 1.25, exp: 1 },
    toad:   { name: '물두꺼비',   ref: 'pt_toad',         el: 'water', hp: 1.1, atk: 0.9, spd: 3.2, reach: 6.5, type: 'spit',  wind: 0.9,  cd: 2.4, h: 0.9,  exp: 1, r: 1.8 },
    raptor: { name: '번개날쌘용', ref: 'pt_velociraptor', el: 'elec',  hp: 0.8, atk: 1.0, spd: 7.0, reach: 2.0, type: 'melee', wind: 0.45, cd: 1.5, h: 1.15, exp: 1 },
    bear:   { name: '반달곰',     ref: 'pt_bear',         el: null,    hp: 2.2, atk: 1.5, spd: 4.0, reach: 3.2, type: 'slam',  wind: 1.0,  cd: 2.6, h: 1.35, exp: 2, r: 3.4 },
    /* 정예 — 원소 방패 */
    ember:  { name: '홍염마',     ref: 'pt_jeoktoma',     el: 'fire',  hp: 1.8, atk: 1.3, spd: 5.0, reach: 2.4, type: 'melee', wind: 0.7,  cd: 1.8, h: 1.5,  exp: 3, shield: 'fire',  sh: 1.2 },
    tortoise: { name: '물거북 장수', ref: 'pt_hyeonmu',   el: 'water', hp: 2.2, atk: 1.2, spd: 3.0, reach: 7.0, type: 'spit',  wind: 1.0,  cd: 2.4, h: 1.4,  exp: 3, shield: 'water', sh: 1.5, r: 2.2 },
    bolt:   { name: '섬영마',     ref: 'pt_jeolyeong',    el: 'elec',  hp: 1.6, atk: 1.2, spd: 7.5, reach: 2.2, type: 'melee', wind: 0.5,  cd: 1.5, h: 1.5,  exp: 3, shield: 'elec',  sh: 1.0 },
    /* ⑲-1 새 원소 괴물 넷(saga-godot PLAN 106 ⑮) — 보통 무리지만 제 원소 방패를 얇게 두른다(light: 정예 보상 없음).
       몸은 들판 적이 안 쓰던 도감 펫(부엉이·여우·판다·성난 뱀) */
    hawk:   { name: '회오리매',   ref: 'pt_owl',          el: 'wind',  hp: 0.8, atk: 1.0, spd: 7.2, reach: 2.2, type: 'melee', wind: 0.5,  cd: 1.6, h: 1.1,  exp: 2, shield: 'wind',  sh: 0.5,  light: true },
    snowfox:{ name: '눈여우',     ref: 'pt_fox',          el: 'ice',   hp: 1.0, atk: 1.0, spd: 6.4, reach: 2.0, type: 'melee', wind: 0.6,  cd: 1.7, h: 1.0,  exp: 2, shield: 'ice',   sh: 0.6,  light: true },
    rockbear:{ name: '바위곰',    ref: 'pt_panda',        el: 'rock',  hp: 1.9, atk: 1.3, spd: 3.8, reach: 3.0, type: 'slam',  wind: 1.0,  cd: 2.5, h: 1.35, exp: 2, shield: 'rock',  sh: 0.8,  light: true, r: 3.2 },
    vine:   { name: '덩굴뱀',     ref: 'pk_gyarados',     el: 'grass', hp: 1.0, atk: 0.9, spd: 3.6, reach: 6.0, type: 'spit',  wind: 0.9,  cd: 2.3, h: 1.0,  exp: 2, shield: 'grass', sh: 0.55, light: true, r: 1.8 },
    /* ⑱ 세 시대 적(SAGA-DESIGN §13) — 위 짐승·도깨비가 "과거", 아래가 현대·미래. 도감에 없는 종이라 ref 가 비고
       몸은 `asset3d` 의 `pet:fc_<종류>` 다(Quaternius CC0). 힘은 과거 보통 무리와 같은 결 */
    rat:    { name: '잿빛 떼쥐',   ref: null, era: 'modern', el: null,    hp: 0.7, atk: 0.8, spd: 6.2, reach: 1.8, type: 'melee', wind: 0.45, cd: 1.4, h: 0.7,  exp: 1 },
    wasp:   { name: '벼락 말벌',   ref: null, era: 'modern', el: 'elec',  hp: 0.6, atk: 0.9, spd: 6.8, reach: 2.0, type: 'melee', wind: 0.5,  cd: 1.6, h: 0.9,  exp: 1 },
    zombie: { name: '떠도는 망자', ref: null, era: 'modern', el: null,    hp: 1.5, atk: 1.1, spd: 3.0, reach: 2.2, type: 'melee', wind: 0.9,  cd: 2.2, h: 1.15, exp: 1 },
    drone:  { name: '정찰 드론',   ref: null, era: 'future', el: 'elec',  hp: 0.7, atk: 0.9, spd: 5.5, reach: 7.0, type: 'spit',  wind: 0.8,  cd: 2.2, h: 1.0,  exp: 1, r: 1.6 },
    walker: { name: '경비 보행기', ref: null, era: 'future', el: 'fire',  hp: 1.3, atk: 1.1, spd: 4.2, reach: 2.4, type: 'melee', wind: 0.7,  cd: 1.9, h: 1.2,  exp: 1 },
    alien:  { name: '별바다 손님', ref: null, era: 'future', el: 'water', hp: 1.0, atk: 1.0, spd: 5.0, reach: 2.0, type: 'melee', wind: 0.55, cd: 1.6, h: 1.0,  exp: 1 },
    hulk:   { name: '강철 거신',   ref: null, era: 'future', el: 'fire',  hp: 2.4, atk: 1.4, spd: 3.6, reach: 3.4, type: 'slam',  wind: 1.0,  cd: 2.6, h: 1.9,  exp: 3, r: 3.4, shield: 'elec', sh: 1.4 },
    /* 우두머리 — 멀리서만 */
    rex:    { name: '폭군용',     ref: 'pt_t_rex',        el: null,    hp: 6.0, atk: 2.0, spd: 4.5, reach: 4.5, type: 'slam',  wind: 1.2,  cd: 2.8, h: 2.4,  exp: 8, r: 4.8, boss: true },
    /* 싸워서 등용(PLAN §5 ⑯) — 들판 인물이 **제 기질대로** 싸운다. 몸은 도감 인물 그대로(world3d 가 hero 로 그린다),
       원소는 동행이 됐을 때와 같은 elementOf(id). 체력·공격·방패는 희귀도로 정한다(duelCamp). 쓰러지지 않고 **굴복**한다 */
    h_might:  { name: '무인', ref: null, hero: true, el: null, hp: 1, atk: 1, spd: 5.0, reach: 3.4, type: 'slam',  wind: 0.9,  cd: 2.1, h: 1.0, exp: 4, r: 3.6 },
    h_wisdom: { name: '책사', ref: null, hero: true, el: null, hp: 1, atk: 1, spd: 4.2, reach: 7.5, type: 'spit',  wind: 0.9,  cd: 2.0, h: 1.0, exp: 4, r: 2.4 },
    h_virtue: { name: '덕장', ref: null, hero: true, el: null, hp: 1, atk: 1, spd: 6.0, reach: 2.4, type: 'melee', wind: 0.55, cd: 1.4, h: 1.0, exp: 4 },
    /* ⑪ 지역 수호자 — 랜드마크 탑 곁에 하나씩, 바이옴마다 몸·원소가 다르다. 방패가 **두 겹**
       (`shields`, 겉 → 속)이라 한 원소로는 둘째 겹이 안 깨진다 — 겉을 깬 뒤 속 방패의 상성
       원소를 가진 동행으로 바꿔 들어가야 하는 퍼즐. 겹마다 방패량은 같다(sh) */
    g_plain:  { name: '벌판 수호 뿔룡',   ref: 'pt_triceratops', el: 'elec',  hp: 7.0, atk: 1.7, spd: 4.2, reach: 4.2, type: 'slam',  wind: 1.1, cd: 2.6, h: 2.3, exp: 12, r: 4.6, boss: true, guard: true, shields: ['elec', 'water'], sh: 1.3 },
    g_bamboo: { name: '대숲 수호 백호',   ref: 'pt_baekho',      el: 'water', hp: 6.5, atk: 1.9, spd: 6.0, reach: 2.8, type: 'melee', wind: 0.8, cd: 1.9, h: 2.1, exp: 12, boss: true, guard: true, shields: ['water', 'fire'], sh: 1.3 },
    g_canyon: { name: '협곡 수호 주작',   ref: 'pt_jujak',       el: 'fire',  hp: 6.0, atk: 1.8, spd: 4.8, reach: 8.0, type: 'spit',  wind: 1.0, cd: 2.3, h: 2.2, exp: 12, r: 2.8, boss: true, guard: true, shields: ['fire', 'elec'], sh: 1.3 },
    g_marsh:  { name: '늪 수호 청룡',     ref: 'pt_cheongryong', el: 'water', hp: 6.5, atk: 1.8, spd: 4.5, reach: 7.5, type: 'spit',  wind: 1.0, cd: 2.4, h: 2.4, exp: 12, r: 3.0, boss: true, guard: true, shields: ['water', 'elec'], sh: 1.3 },
    g_ruins:  { name: '성터 수호 불가사리', ref: 'pt_bulgasari', el: 'elec',  hp: 7.5, atk: 1.9, spd: 3.8, reach: 4.4, type: 'slam',  wind: 1.2, cd: 2.7, h: 2.3, exp: 12, r: 4.8, boss: true, guard: true, shields: ['elec', 'fire'], sh: 1.3 },
    /* ⑲-31 서리봉 고원(frost.js) 가운데 칸만 — 바이옴 수호자 대신 선다(saga-godot 106 ㊻-1). 반달곰 몸을 크게, 암.
       겉은 만년설 딱지(빙 → 화로 깬다), 속은 바위(암 → 초로 깬다, 물리로도 제대로 깎인다). 공격은 차례(rot):
       내려찍기·물기·눈사태(tide 줄 넷)·고리(halo) — 가장 센 수호자라 체력·공격을 한 칸 올렸다 */
    g_frost:  { name: '만년설 바위곰왕', ref: 'pt_bear', el: 'rock', hp: 8.5, atk: 2.0, spd: 4.0, reach: 4.4, type: 'slam', wind: 1.2, cd: 2.6, h: 2.6, exp: 14, r: 5.0, boss: true, guard: true,
                shields: ['ice', 'rock'], sh: 1.4, rot: ['slam', 'melee', 'tide', 'slam', 'halo', 'melee'] },
    /* §5 ⑲-9 주간 보스(domain.js 먹구름 제단) — 청룡 몸을 빌린 뇌 이무기. 2단계 뇌 방패는 domain.js 가 두른다 */
    w_imugi:  { name: '먹구름 이무기',   ref: 'pt_cheongryong', el: 'elec',  hp: 20,  atk: 2.2, spd: 4.5, reach: 4.4, type: 'slam',  wind: 1.2, cd: 3.5, h: 2.6, exp: 0,  r: 5.0, boss: true, weekly: true },
    /* §5 ⑲-14 이야기 보스(story.js 6장) — 사람 몸(body = asset3d 고정 몸 id)·검은 가면. 공격이 `rot` 차례로 바뀐다(ROT).
       2단계 뇌 방패·졸개는 story.js 가 두른다 */
    b_mask:   { name: '검은 가면',       ref: null, body: 'story_blackmask', mask: 'black', el: 'elec', hp: 10, atk: 1.9, spd: 5.6, reach: 2.4, type: 'melee', wind: 0.6, cd: 1.6, h: 1.0, exp: 0,
                boss: true, rot: ['shadow', 'spit', 'melee', 'slam', 'shadow', 'melee'] },
    /* ⑲-16 7장 금 간 검은 가면 — 같은 몸, 가면 왼쪽에 흰 금. 물 · 밀물(원 넷). 2단계 물 방패·졸개는 story.js 가 두른다 */
    b_mask2:  { name: '금 간 검은 가면', ref: null, body: 'story_blackmask', mask: 'crack', el: 'water', hp: 11.5, atk: 2.0, spd: 5.6, reach: 2.4, type: 'melee', wind: 0.6, cd: 1.6, h: 1.0, exp: 0,
                boss: true, rot: ['tide', 'shadow', 'melee', 'tide', 'slam', 'shadow'] },
    /* ⑲-20 9장 구름섬 — 먹구름 가면을 쓴 해솔(해솔 몸·금 간 가면, 뇌) · 먹구름 임금(사람 몸 1.9배·왕관·어두운 가면, 뇌 — 고리 halo).
       2단계 방패·졸개는 story.js 가 두른다 */
    haesol_mask: { name: '먹구름 가면 해솔', ref: null, body: 'story_haesol', mask: 'crack', el: 'elec', hp: 13, atk: 2.1, spd: 5.8, reach: 2.4, type: 'melee', wind: 0.6, cd: 1.5, h: 1.0, exp: 0,
                boss: true, rot: ['shadow', 'spit', 'tide', 'melee', 'slam', 'shadow'] },
    storm_king:  { name: '먹구름 임금', ref: null, body: 'story_blackmask', mask: 'storm', el: 'elec', hp: 17, atk: 2.3, spd: 4.8, reach: 3.4, type: 'melee', wind: 0.7, cd: 1.7, h: 1.9, exp: 0,
                boss: true, rot: ['slam', 'halo', 'spit', 'melee', 'shadow', 'tide', 'halo'] },
    /* ⑲-51 26장 궤도 정거장 조각 — 가면 그림자가 불러낸 먹구름 임금의 그림자(같은 몸·먹빛 왕관, 뇌, 더 단단하다). 2단계 뇌 방패(불로 깬다)·졸개는 story.js */
    storm_shadow: { name: '먹구름 임금의 그림자', ref: null, body: 'story_blackmask', mask: 'shadow', el: 'elec', hp: 21, atk: 2.5, spd: 4.4, reach: 3.4, type: 'melee', wind: 0.8, cd: 1.6, h: 2.0, exp: 0,
                boss: true, rot: ['slam', 'halo', 'spit', 'shadow', 'melee', 'tide', 'halo', 'spit'] },
    /* ⑲-60 32장 부양탑 밑 광장 — 거리 시간을 등딱지에 굳혀 온 호박 등딱지 거북(현무 펫 몸을 크게, 암). 2단계 암 방패(초로 깬다)·졸개는 story.js */
    amber_turtle: { name: '호박 등딱지 거북', ref: 'pt_hyeonmu', el: 'rock', hp: 24, atk: 2.6, spd: 3.2, reach: 4.4, type: 'slam', wind: 1.1, cd: 1.7, h: 3.2, exp: 0, r: 4.6,
                boss: true, rot: ['slam', 'tide', 'melee', 'halo', 'slam', 'spit'] },
    /* ⑲-68 38장 세갈래 길목 — 틈이 처음 찢어지던 순간 하늘을 찢고 멈췄던 처음의 별까마귀(삼족오 몸, 뇌 — 20장 틈 삼킨 별까마귀의 온전한 몸). 있는 패턴만 — 틈새 질주·고리·침·내려찍기·밀물 줄.
       2단계 뇌 방패(불로 깬다)·졸개는 story.js 가 두른다 */
    first_crow:  { name: '처음의 별까마귀', ref: 'pt_samjogo', el: 'elec', hp: 30, atk: 3.0, spd: 5.6, reach: 3.6, type: 'slam', wind: 0.9, cd: 1.6, h: 3.4, exp: 0, r: 4.6,
                boss: true, rot: ['rift', 'halo', 'spit', 'slam', 'tide', 'rift', 'halo'] },
    /* ⑲-68 38장 세갈래 길목 — 격자를 몸에 두른 갈무리 참몸(도깨비 몸을 크게, 암 — 합금·호박빛). 있는 패턴만 — 내려찍기·고리·휘두름·밀물 줄·침.
       2단계 암 방패(초로 깬다)·졸개는 story.js 가 두른다 */
    garmuri_true: { name: '갈무리 참몸', ref: 'pt_dokkaebi', el: 'rock', hp: 34, atk: 3.2, spd: 4.8, reach: 4.0, type: 'slam', wind: 1.0, cd: 1.7, h: 4.2, exp: 0, r: 4.8,
                boss: true, rot: ['slam', 'halo', 'melee', 'tide', 'slam', 'spit', 'halo'] },
    /* ⑲-70 41장 세갈래 고을 마당 — 갈무리의 마지막 마음이 자란 싹(도깨비 몸을 크게, 초). 있는 패턴만 — 내려찍기·침·고리·휘두름·밀물 줄.
       2단계 초 방패(풍으로 깬다)·졸개는 story.js 가 두른다 */
    seed_giant: { name: '갈무리의 싹', ref: 'pt_dokkaebi', el: 'grass', hp: 38, atk: 3.3, spd: 4.6, reach: 4.2, type: 'slam', wind: 1.0, cd: 1.7, h: 4.4, exp: 0, r: 5.0,
                boss: true, rot: ['slam', 'spit', 'halo', 'melee', 'tide', 'slam', 'halo'] },
    /* ⑲-64 35장 금고 앞 — 금고 관리 인공지능이 문 밖으로 내보낸 금고 파수 드론 여왕(정찰 드론 몸을 크게, 풍). 있는 패턴만 — 틈새 질주·고리·침·내려찍기·밀물 줄.
       2단계 풍 방패(암으로 깬다)·졸개는 story.js 가 두른다 */
    vault_queen: { name: '금고 파수 드론 여왕', ref: null, el: 'wind', hp: 28, atk: 2.8, spd: 5.4, reach: 3.8, type: 'slam', wind: 0.9, cd: 1.6, h: 3.6, exp: 0, r: 4.2,
                boss: true, rot: ['rift', 'halo', 'spit', 'slam', 'tide', 'rift'] },
    /* ⑲-55 29장 먹구름 눈 — 먹구름 임금의 참몸(사람 몸 2.4배·먹빛 왕관·흰 처음 가면, 뇌, 8부 끝 보스). 2단계 뇌 방패(불로 깬다)·졸개는 story.js */
    storm_king_true: { name: '먹구름 임금', ref: null, body: 'story_blackmask', mask: 'first', el: 'elec', hp: 26, atk: 2.7, spd: 4.2, reach: 3.8, type: 'melee', wind: 0.8, cd: 1.5, h: 2.4, exp: 0, r: 3.0,
                boss: true, rot: ['slam', 'halo', 'spit', 'shadow', 'melee', 'tide', 'halo', 'slam', 'spit'] },
    /* ⑲-30 12장 서리봉 고원 얼음굴 앞 — 시간 틈에서 나온 아홉 꼬리 여우(구미호 펫 몸, 빙). 틈새 질주 rift.
       2단계 빙 방패·졸개는 story.js 가 두른다 */
    rift_fox:    { name: '틈새 서리 구미호', ref: 'pt_gumiho', el: 'ice', hp: 15, atk: 2.2, spd: 6.0, reach: 3.0, type: 'melee', wind: 0.6, cd: 1.5, h: 2.2, exp: 0,
                boss: true, rot: ['rift', 'melee', 'spit', 'rift', 'slam', 'halo'] },
    /* ⑲-36 15장 옛 역참 길 — 12장에 달아난 구미호가 옛 시대 여우불을 먹었다(화). 같은 몸·틀, 2단계 화 방패·졸개는 story.js */
    rift_fox_ember: { name: '여우불 구미호', ref: 'pt_gumiho', el: 'fire', hp: 16, atk: 2.3, spd: 6.0, reach: 3.0, type: 'melee', wind: 0.6, cd: 1.4, h: 2.3, exp: 0,
                boss: true, rot: ['rift', 'shadow', 'melee', 'rift', 'tide', 'halo'] },
    /* ⑲-39 17장 옛 절터 — 틈에서 기어 나와 떨어진 종에 똬리를 틀고 수백 년 이끼를 먹은 이무기(먹구름 이무기와 같은 청룡 몸, 초 — 덩굴뱀 몸은 새 원소 괴물 몫).
       있는 패턴만 — 이끼 침·밀물 원·내려치기·고리. 2단계 초 방패(풍으로 깬다)·졸개는 story.js 가 두른다 */
    moss_serpent: { name: '이끼 이무기', ref: 'pt_cheongryong', el: 'grass', hp: 17, atk: 2.3, spd: 4.2, reach: 4.0, type: 'slam', wind: 1.0, cd: 1.8, h: 2.6, exp: 0, r: 4.4,
                boss: true, rot: ['spit', 'tide', 'slam', 'melee', 'halo', 'spit'] },
    /* ⑲-42 19장 틈새 갈림길 — 선장이 멈춰 둔 시간 속에서 깨어난 파수꾼(사람 몸 2배·금빛 가면, 풍). 있는 패턴만.
       2단계 풍 방패(암으로 깬다)·졸개는 story.js 가 두른다 */
    time_warden: { name: '멈춘 시간의 파수꾼', ref: null, body: 'story_blackmask', mask: 'gold', el: 'wind', hp: 18, atk: 2.4, spd: 4.8, reach: 3.4, type: 'melee', wind: 0.7, cd: 1.6, h: 2.0, exp: 0,
                boss: true, rot: ['halo', 'tide', 'slam', 'shadow', 'melee', 'halo', 'spit'] },
    /* ⑲-43 20장 갈림길 끝 — 세 갈래 선로를 삼키려다 틈을 찢고 갇혔던 별까마귀(삼족오 몸 크게, 빙). 그림자 뺀 있는 패턴 —
       틈새 질주·고리·침·내려찍기·밀물 줄. 2단계 빙 방패(화로 깬다)·졸개는 story.js 가 두른다 */
    rift_crow:   { name: '틈 삼킨 별까마귀', ref: 'pt_samjogo', el: 'ice', hp: 20, atk: 2.5, spd: 5.2, reach: 3.4, type: 'slam', wind: 1.0, cd: 1.7, h: 3.0, exp: 0, r: 4.4,
                boss: true, rot: ['rift', 'halo', 'spit', 'slam', 'tide', 'rift'] },
    /* ⑲-46 22장 빛 돔 안 — 돔에 숨어 빛을 먹던 심해 등불아귀(아귀 몸 크게, 수). 있는 패턴만 — 침·밀물 줄·고리·내려찍기·그림자.
       2단계 수 방패(뇌로 깬다)·졸개는 story.js 가 두른다 */
    abyss_angler: { name: '심해 등불아귀', ref: 'pt_anglerfish', el: 'water', hp: 21, atk: 2.5, spd: 4.6, reach: 3.6, type: 'spit', wind: 0.9, cd: 1.7, h: 3.2, exp: 0, r: 3.0,
                boss: true, rot: ['spit', 'tide', 'halo', 'slam', 'shadow', 'spit'] },
    /* ⑲-47 23장 빛 돔 안 — 기록을 지운 자의 명령으로 깨어난 바위 거인(도깨비 몸 크게, 암). 있는 패턴만 — 내려찍기·고리·휘두름·밀물 줄·침.
       2단계 암 방패(초로 깬다)·졸개는 story.js 가 두른다 */
    dome_colossus: { name: '돔 파수 거신', ref: 'pt_dokkaebi', el: 'rock', hp: 22, atk: 2.6, spd: 4.4, reach: 3.6, type: 'slam', wind: 1.0, cd: 1.8, h: 3.6, exp: 0, r: 4.2,
                boss: true, rot: ['slam', 'halo', 'melee', 'tide', 'slam', 'spit'] }
  };
  /* ⑲-14 공격 차례(`rot`)의 한 수씩 — reach 안이면 휘두른다. shadow 는 내 등 뒤 SHADOW_BACK m 로 옮겨 붙어 제 둘레 원 */
  var ROT = {
    shadow: { reach: 14,  wind: 0.8,  r: 3.2, mul: 1.4 },
    spit:   { reach: 9,   wind: 1.0,  r: 2.4, mul: 1.0 },
    melee:  { reach: 2.4, wind: 0.55, r: 0,   mul: 1.0 },
    slam:   { reach: 3.8, wind: 1.1,  r: 4.2, mul: 1.2 },
    tide:   { reach: 11,  wind: 1.1,  r: 2.0, mul: 1.3, n: 4, from: 2.5, gap: 3 },   // ⑲-16 밀물 — 나를 향해 원 넷 줄지어
    halo:   { reach: 8,   wind: 1.3,  r: 9,   mul: 1.5, inner: 3 },                    // ⑲-20 고리 — 제 둘레 3~9m. 곁(3m 안)으로 파고들거나 9m 밖으로
    rift:   { reach: 12,  wind: 1.0,  r: 2.0, mul: 1.5, n: 5, from: 2, gap: 2.4 }      // ⑲-30 틈새 질주 — 원 다섯 줄 예고, 칠 때 줄 끝으로 옮긴다
  };
  var SHADOW_BACK = 2.2, RIFT_STEP = 1.5, RIFT_SLOPE = 0.3;   // ⑲-30 줄 끝 땅 높이 차가 RIFT_STEP + 거리 × RIFT_SLOPE 를 넘으면(벼랑) 제자리에서 친다
  /** ⑲-16 밀물 원 넷(⑲-30 틈새 질주는 kind 'rift' — 다섯) — 가면(fx,fy)에서 나(px,py) 쪽으로 from m 부터 gap 간격 */
  function tideMarks(fx, fy, px, py, kind) {
    var T = ROT[kind || 'tide'], dx = px - fx, dy = py - fy, dl = Math.hypot(dx, dy) || 1, out = [];
    for (var i = 0; i < T.n; i++) { var s = T.from + T.gap * i; out.push({ x: fx + dx / dl * s, y: fy + dy / dl * s }); }
    return out;
  }
  /** ⑲-30 틈새 질주 끝 — 줄 끝(x,y)으로 옮겨도 되나(비탈은 되고 벼랑은 안 된다). 높이를 모르면 된다 */
  function riftOk(fx, fy, x, y) {
    var RL = global.DG.relief3d;
    if (!RL || !RL.heightAt) { return true; }
    return Math.abs(RL.heightAt(x, y) - RL.heightAt(fx, fy)) <= RIFT_STEP + Math.hypot(x - fx, y - fy) * RIFT_SLOPE;
  }
  /** 예고 표식에 (x,y) 가 드나 — 원 여럿(list)이면 하나라도. pad 는 맞는 쪽 몸 둘레 */
  function markHit(m, x, y, pad) {
    var L = m.list || [m];
    for (var i = 0; i < L.length; i++) {
      var d = Math.hypot(x - L[i].x, y - L[i].y);
      if (d <= m.r + (pad || 0) && (!m.inner || d >= m.inner - (pad || 0))) { return true; }   // ⑲-20 고리는 안쪽이 빈다
    }
    return false;
  }
  /* ⑲-16 지킬 것(siege) — 이야기 제단 지키기 무리는 제단으로 곧장 가서 치고, 내가 이 안이면 나를 친다 */
  var SIEGE_PULL = 5, SIEGE_BODY = 1.5;
  function LAYER_STUN() { return 0.8; }     // 겉 방패가 깨질 때 — 짧게 휘청(속 방패가 곧 선다)
  function CORE_STUN() { return 3; }        // 마지막 겹이 깨지면 — 길게 드러눕는다(약점)
  var GUARD_OFF = { x: 16, y: 10 };         // 탑 한가운데가 아니라 둘레 빈터(biome LM_CLEAR 34m 안)

  /**
   * ⑯ 순수 함수 — 들판 인물 h 와 겨루는 판. 인물 하나(가운데) + ★3 이상이면 제 원소 졸개(★3 하나·★4~5 둘).
   * 인물 체력 = HP_BASE × (1.6 + 0.7×★) × 등급배수, 공격 = ATK_BASE × (0.9 + 0.12×★) × 등급배수.
   * ★4 는 제 원소 방패 한 겹, ★5 는 두 겹(제 원소 → 그 상성) — 오픈월드 RPG 정예처럼 교체해서 깨야 한다
   */
  var RETINUE = { fire: 'imp', water: 'toad', elec: 'raptor', wind: 'hawk', ice: 'snowfox', rock: 'rockbear', grass: 'vine' };
  function heroKind(h) { return h.trait === 'might' ? 'h_might' : (h.trait === 'wisdom' ? 'h_wisdom' : 'h_virtue'); }
  function duelCamp(h, x, y, spawnUid) {
    var r = h.rarity || 1, el = elementOf(h.id), tier = tierAt(x, y), m = tierMul(tier);
    var foes = [{ kind: heroKind(h), dx: 0, dy: 0 }];
    var nRet = r >= 4 ? 2 : (r >= 3 ? 1 : 0);
    for (var i = 0; i < nRet; i++) { foes.push({ kind: RETINUE[el], dx: (i ? -3.2 : 3.2), dy: 2.4 }); }
    var layers = r >= 5 ? [el, COUNTER[el]] : (r >= 4 ? [el] : []);
    return {
      key: 'h:' + spawnUid, x: x, y: y, tier: tier, kind: 'hero', foes: foes,
      hero: { id: h.id, name: h.name, el: el, layers: layers,
        hp: Math.round(HP_BASE() * (1.6 + 0.7 * r) * m), atk: Math.round(ATK_BASE() * (0.9 + 0.12 * r) * m),
        shield: layers.length ? Math.round(SHIELD_BASE() * 1.1 * m) : 0 }
    };
  }

  /**
   * ⑪ 순수 함수 — 지역 가운데(biome `cellAt`·`landmarks` 원소) 곁의 수호자 무리. 고향은 없다.
   * 등급은 그 자리 등급 + 1(최대 6). key 는 'g:<지역키>' — 토벌하면 다시 서지 않는다(save.field.guards)
   */
  function guardianAt(cell) {
    if (!cell || !cell.biome || cell.biome === 'home' || !FOES['g_' + cell.biome]) { return null; }
    var x = cell.x + GUARD_OFF.x, y = cell.y + GUARD_OFF.y;
    return { key: 'g:' + cell.key, region: cell.key, x: x, y: y, tier: Math.min(6, tierAt(x, y) + 1), kind: 'guard',
             foes: [{ kind: guardKind(cell), dx: 0, dy: 0 }] };
  }
  /** ⑲-31 이 칸 수호자 종류 — 서리봉 고원 가운데 칸이면 만년설 바위곰왕, 아니면 바이옴 수호자.
      고원 가운데는 해시·지형만으로 정해져 늘 같다(frost.center) — 한 번 찾으면 기억한다 */
  var frostKey = null;
  function guardKind(cell) {
    var FR = global.DG.frost;
    if (FR && FR.on && FR.on() && FR.center) {
      if (frostKey === null) { var fc = FR.center(); frostKey = fc ? fc.key : ''; }
      if (frostKey && cell.key === frostKey) { return 'g_frost'; }
    }
    return 'g_' + cell.biome;
  }
  /** 무리 꼴 — 격자 해시로 고른다(앞의 다섯은 보통, 정예·우두머리는 따로 굴린다) */
  var THEMES = [
    ['boar', 'boar', 'boar'],
    ['imp', 'imp', 'boar'],
    ['toad', 'toad', 'toad'],
    ['raptor', 'raptor'],
    ['bear', 'boar', 'boar'],
    ['imp', 'toad', 'raptor'],
    /* ⑲-1 새 원소 무리(6~8) — 바이옴 themes 가 번호로 고른다(biome.js) */
    ['hawk', 'hawk', 'vine'],
    ['snowfox', 'snowfox', 'vine'],
    ['rockbear', 'rockbear']
  ];
  var ELITES = [['ember', 'imp', 'imp'], ['tortoise', 'toad', 'toad'], ['bolt', 'raptor', 'raptor']];
  /* ⑱ 시대 무리 — 땅(biome.js ZONES)의 시대가 제 몫(60%)을, 나머지 두 시대가 40%를 나눠 갖는다.
     과거 몫은 위 바이옴 무리 그대로(신화 땅도 과거 몫 — 도깨비·용이 신화다). 미래만 정예(강철 거신)가 따로 있다 */
  var ERA_THEMES = {
    modern: [['rat', 'rat', 'rat'], ['wasp', 'wasp'], ['zombie', 'zombie', 'rat'], ['zombie', 'wasp']],
    future: [['drone', 'drone'], ['walker', 'walker', 'drone'], ['alien', 'alien', 'walker'], ['alien', 'drone']]
  };
  var ERA_ELITES = { future: ['hulk', 'drone', 'drone'] };
  var ERAS3 = ['past', 'modern', 'future'];
  function MAIN_SHARE() { return K('eraMain', 0.6); }
  function ERA_FROM() { return K('eraFrom', 300); }      // 시작점 둘레는 과거 짐승만(첫걸음이 로봇이면 뜬금없다)
  /** 이 칸 무리의 시대 — 순수 함수. zone 이 없으면(고향·진단) 'past' */
  function eraOfCamp(cx, cy, zone, dist) {
    if (!zone || !zone.era || dist < ERA_FROM()) { return 'past'; }
    var main = zone.era === 'myth' ? 'past' : zone.era;
    if (h3(cx, cy, 37) < MAIN_SHARE()) { return main; }
    var rest = ERAS3.filter(function (e) { return e !== main; });
    return rest[Math.floor(h3(cx, cy, 41) * rest.length) % rest.length];
  }

  var CELL = 160;          // 무리 격자(m)
  var TILE = 48;           // world3d GRID — 지형 칸
  function CAMP_CHANCE() { return K('campChance', 0.45); }
  function SAFE_R() { return 60; }                 // 시작점 둘레에는 안 선다
  function TIER_STEP() { return K('tierStep', 900); }
  function tierAt(x, y) { return 1 + Math.min(5, Math.floor(Math.hypot(x, y) / TIER_STEP())); }
  function tierMul(t) { return 1 + 0.3 * (t - 1); }
  /* §5 ⑲-7 천하 등급(adventure.js) — 거리 등급 배율에 곱한다. 모듈이 없으면 세계 0 */
  function ADV() { return global.DG.adventure || null; }
  function wlNow() { var A = ADV(); return A ? A.worldLevel() : 0; }
  function lootMul() { var A = ADV(); return A ? A.lootMul(wlNow()) : 1; }
  function dustAdd() { var A = ADV(); return A ? A.dustAdd(wlNow()) : 0; }
  function lvAddOf(w) { var A = ADV(); return A && w ? A.lvAdd(w) : 0; }
  /** 전리품 — 쓰러뜨린 적 하나의 금 · 무리/수호자 토벌의 금·단사(천하 등급 배율을 탄다) */
  function killGold(tier) { return Math.round((3 + 2 * tier) * lootMul()); }
  function clearLoot(kind, tier) {
    if (kind === 'guard') { return { gold: Math.round(150 * tier * lootMul()), dust: 8 + dustAdd() }; }
    var g = 15 * tier + (kind === 'boss' ? 60 * tier : (kind === 'elite' ? 20 * tier : 0));
    return { gold: Math.round(g * lootMul()), dust: (kind === 'boss' ? 3 : 1) + dustAdd() };
  }
  /** 적 하나를 천하 등급 w 로 앉힌다 — 지금 배율에서 깎인 비율 그대로(체력·방패 / 공격) */
  function applyWorld(f, w) {
    var A = ADV(), from = f.wl || 0;
    if (!A || from === w) { return; }
    var kh = A.hpMul(w) / A.hpMul(from), ka = A.atkMul(w) / A.atkMul(from);
    f.hpMax = Math.round(f.hpMax * kh);
    f.hp = f.dead ? f.hp : Math.max(1, Math.round(f.hp * kh));
    f.atk = Math.round(f.atk * ka);
    f.shieldMax = Math.round(f.shieldMax * kh);
    f.shield = Math.round(f.shield * kh);
    f.wl = w;
  }
  /** 천하 등급이 바뀌면 살아 있는 적을 다시 앉힌다(adventure.js 가 부른다 — 판 St 를 안 주면 런타임 판) */
  function rescaleWorld(St) {
    St = St || S;
    if (!St) { return 0; }
    var w = wlNow(), n = 0, k;
    for (k in St.foes) {
      if (Object.prototype.hasOwnProperty.call(St.foes, k) && !St.foes[k].dead && (St.foes[k].wl || 0) !== w) { applyWorld(St.foes[k], w); n++; }
    }
    return n;
  }

  /**
   * 격자 한 칸의 무리 — 없으면 null. 순수 함수(같은 칸은 늘 같은 답).
   * terr(tx,ty) 를 주면 물·마을·길 위에는 안 세운다(진단은 안 줘도 된다).
   * zfn(x,y) → 땅(biome.zoneAt)을 주면 ⑱ 시대가 섞인다 — 안 주면 옛 바이옴 무리 그대로.
   */
  function campAt(cx, cy, terr, bfn, zfn) {
    if (h3(cx, cy, 7) > CAMP_CHANCE()) { return null; }
    var x = (cx + 0.2 + 0.6 * h3(cx, cy, 11)) * CELL;
    var y = (cy + 0.2 + 0.6 * h3(cx, cy, 13)) * CELL;
    var dist = Math.hypot(x, y);
    if (dist < SAFE_R()) { return null; }
    if (terr) {
      var k = terr(Math.floor(x / TILE), Math.floor(y / TILE));
      if (k === 'water' || k === 'town' || k === 'road') { return null; }
    }
    /* 지역 바이옴(§5 ⑩)이 무리 꼴을 고른다 — 협곡엔 불, 늪엔 물 */
    var B = bfn ? bfn(x, y) : null;
    var th = B && B.themes ? B.themes : null, el = B && B.elites ? B.elites : null;
    var bossP = B && B.boss !== undefined ? B.boss : 0.05;
    var r = h3(cx, cy, 17), list, kind = 'plain';
    var era = eraOfCamp(cx, cy, zfn ? zfn(x, y) : null, dist);
    if (dist > 400 && r < bossP) { list = ['rex', 'boar', 'boar']; kind = 'boss'; era = 'past'; }
    else if (r < bossP + 0.15 && ERA_ELITES[era]) { list = ERA_ELITES[era]; kind = 'elite'; }
    else if (r < bossP + 0.15) {
      list = el ? ELITES[el[Math.floor(h3(cx, cy, 19) * el.length) % el.length]]
        : ELITES[Math.floor(h3(cx, cy, 19) * ELITES.length) % ELITES.length];
      kind = 'elite';
    } else if (ERA_THEMES[era]) {
      var et = ERA_THEMES[era];
      list = et[Math.floor(h3(cx, cy, 23) * et.length) % et.length];
    } else {
      list = th ? THEMES[th[Math.floor(h3(cx, cy, 23) * th.length) % th.length]]
        : THEMES[Math.floor(h3(cx, cy, 23) * THEMES.length) % THEMES.length];
    }
    var foes = [];
    for (var i = 0; i < list.length; i++) {
      var a = (i / list.length) * Math.PI * 2 + h3(cx, cy, 29) * 6.283;
      var rr = i === 0 && kind !== 'plain' ? 0 : 3.2;
      foes.push({ kind: list[i], dx: Math.cos(a) * rr, dy: Math.sin(a) * rr });
    }
    return { key: cx + '_' + cy, x: x, y: y, tier: tierAt(x, y), kind: kind, era: era, foes: foes };
  }

  /* ── 편성 ─────────────────────────────────────────────── */
  function statsOf(id) {
    var H = global.DG.hero;
    if (H && H.stats && id !== '_me') {
      var s = H.stats(id);
      if (s && (s.might || s.wisdom || s.command)) { return s; }
    }
    return { might: 60, wisdom: 60, command: 60 };
  }
  /** ⑲-4 무예 단계·깨달음(talent.js) — 없거나 '_me' 면 모두 1 */
  function talentMods(id) {
    var T = global.DG.talent;
    if (T && id !== '_me') { return T.combatMods(id); }
    return { tm: { n: 1, s: 1, b: 1 }, con: 0, cdMul: 1, reactMul: 1, hpMul: 1, c6: false };
  }
  /** 피해 출처별 무예 배율 × 깨달음 5 해방 뒤 공격 */
  function talentMul(m, src) {
    var T = global.DG.talent, k = T ? T.keyOfSrc(src) : null, v = 1;
    if (k && m.tm) { v *= m.tm[k] || 1; }
    if (m.c6T > 0 && T) { v *= T.C6_ATK; }
    return v;
  }
  /**
   * ⑲-5 무기·보패(weapon.js·artifact.js) — 도감에 든 인물만. '_me'·도감 밖 id 는 칼 모양에 보탬 0
   * (진단의 'fc_a' 가 옛 수치 그대로 돌게).
   */
  var SWORD_KIT = { mul: [0.9, 1.0, 1.5], sec: [0.34, 0.34, 0.55], reach: 3.2 };
  function gearMods(id) {
    var WP = global.DG.weapon, AR = global.DG.artifact, c = core();
    var own = id !== '_me' && c && c.save && c.save.dex && c.save.dex.heroes && c.save.dex.heroes[id];
    var out = { type: 'sword', kit: SWORD_KIT, watk: 0, st: {}, four: {}, pas: null, pasV: 0, wid: '' };
    if (!own) { return out; }
    if (WP) {
      var w = WP.mods(id);
      out.type = w.type; out.kit = w.kit; out.watk = w.atk; out.pas = w.pas; out.pasV = w.pasV; out.wid = w.wid;
      for (var k in w.sub) { if (Object.prototype.hasOwnProperty.call(w.sub, k)) { out.st[k] = (out.st[k] || 0) + w.sub[k]; } }
    }
    if (AR) {
      var a = AR.statsOf(id), q;
      for (q in a.stats) { if (Object.prototype.hasOwnProperty.call(a.stats, q)) { out.st[q] = (out.st[q] || 0) + a.stats[q]; } }
      out.four = a.four;
    }
    var CK = global.DG.cooking;                              // ⑲-6 요리 버프(명단 전체, 300초)
    if (CK && CK.buffStats) {
      var bf = CK.buffStats(), z;
      for (z in bf) { if (Object.prototype.hasOwnProperty.call(bf, z) && bf[z]) { out.st[z] = (out.st[z] || 0) + bf[z]; } }
    }
    return out;
  }
  /* ⑲-11 고유·갈래 스킬(kits.js) — 지략·도감 밖은 null(⑫ 모양 그대로). 손잡이 field.kits 0 이면 모두 옛 ⑫ */
  function kitFor(id) { var KT = global.DG.kits; return KT && K('kits', 1) ? KT.kitOf(id, elementOf(id)) : null; }
  function memberOf(id) {
    var h = id === '_me' ? null : (data() && data().find ? data().find(id) : null);
    var kt = kitFor(id);
    var s = statsOf(id);
    var tl = talentMods(id);
    var g = gearMods(id), st = g.st, f4 = g.four;
    function v(k) { return st[k] || 0; }
    var base = Math.max(20, Math.round(s.might * 0.7 + s.wisdom * 0.3));
    var hpMax = Math.round(((300 + s.command * 6) * (1 + v('hp_pct')) + v('hp')) * tl.hpMul);
    var melee = g.type === 'sword' || g.type === 'claymore' || g.type === 'polearm';
    var rf = f4.react_fire || 0;
    return {
      id: id, name: h ? h.name : '나', el: elementOf(id), shape: shapeOf(id),
      kitS: kt ? kt.skill : null, kitB: kt ? kt.burst : null, kitL: kt ? kt.label : '', infT: 0, infMul: 1,
      atk: Math.round((base + g.watk) * (1 + v('atk_pct')) + v('atk')),
      hpMax: hpMax, hp: hpMax, em: s.wisdom, def: Math.round(s.command * (1 + v('def_pct')) + v('def')),
      tm: tl.tm, con: tl.con, cdMul: tl.cdMul, reactMul: tl.reactMul, c6: tl.c6, c6T: 0,
      /* ⑲-5 — 무기 종류·모양, 치명, 기력, 피해 보너스(더하기), 반응 보너스 */
      wtype: g.type, kit: g.kit, wid: g.wid,
      cr: g.wid ? 0.05 + v('crit_rate') : 0, cdm: 0.5 + v('crit_dmg'), er: 1 + v('energy'),
      dmgB: {
        n: (g.pas === 'n' ? g.pasV : 0) + (melee ? (f4.normal_melee || 0) : 0),
        s: (g.pas === 's' ? g.pasV : 0) + (f4.skill_dmg || 0),
        b: (g.pas === 'b' ? g.pasV : 0) + (f4.burst_dmg || 0)
      },
      elemB: { fire: v('elem_fire'), water: v('elem_water'), elec: v('elem_elec'), wind: v('elem_wind'), ice: v('elem_ice'), rock: v('elem_rock'), grass: v('elem_grass'), phys: v('elem_phys') },
      rxAll: g.pas === 'react' ? g.pasV : 0,
      rx: { vaporize: rf, melt: rf, overload: rf, burning: rf, swirl: f4.react_swirl || 0 },
      skillCd: 0, burstCd: 0, energy: 0, down: false, burn: null
    };
  }
  /** mulberry32 — 치명타 굴림(판마다 씨앗 고정, SAGA 진단 씨앗과 같은 식) */
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) | 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** ⑲-6 요리 모험 계열 — 회피·강공격 스태미나 배율 */
  function staSave() { var C = global.DG.cooking; return C && C.staminaMul ? C.staminaMul() : 1; }
  function rxB(m, kind) { return 1 + ((m.rx && m.rx[kind]) || 0); }

  function create(partyIds) {
    var ids = (partyIds || []).slice(0, PARTY_MAX());
    if (!ids.length) { ids = ['_me']; }
    return {
      t: 0, party: ids.map(memberOf), active: 0, swapCd: 0,
      stamina: STA_MAX(), staT: 9, iframe: 0, dash: null,
      combo: 0, comboT: 9, atkCd: 0, calmT: 99,
      foes: {}, camps: {}, cleared: {}, uid: 0, ev: [], kills: 0, zones: [],
      guard: null,                         // ⑲-1 굳힘 보호막 { hp, max, t } — 명단 전체가 나눠 쓴다(⑲-11 방패 틀도 여기)
      rallyT: 0, rallyMul: 1, wardT: 0, wardMul: 1, hasteT: 0,   // ⑲-11 명단 효과 — 군기(공격 곱)·맹세(받는 피해 곱)·뇌우(스킬 대기 두 배)
      loreT: 0, loreMul: 1,                // ⑲-15 옛 글자 풀이 — 명단 원소 반응 피해 곱
      rainT: 0, rainCd: 0, rainM: null, rainK: null,   // ⑲-17 뱃노래 — 남은 초·따라 치기 쉼·놓은 인물·표
      mx: 0, my: 0,                        // ⑲-17 지난 걸음의 내 자리(바람 자리 회복이 읽는다)
      crng: mulberry32(20260824)           // ⑲-5 치명타 굴림
    };
  }

  /** 편성이 바뀌었을 때 — 같은 사람은 체력 비율·쿨·기력을 그대로 들고 온다 */
  function reparty(S, partyIds) {
    var old = {}, i;
    for (i = 0; i < S.party.length; i++) { old[S.party[i].id] = S.party[i]; }
    var activeId = S.party[S.active] && S.party[S.active].id;
    var fresh = create(partyIds).party;
    for (i = 0; i < fresh.length; i++) {
      var o = old[fresh[i].id], m = fresh[i];
      if (!o) { continue; }
      m.hp = Math.round(m.hpMax * (o.hp / o.hpMax)); m.down = o.down;
      m.skillCd = o.skillCd; m.burstCd = o.burstCd; m.energy = o.energy; m.skCdMax = o.skCdMax; m.c6T = o.c6T || 0; m.infT = o.infT || 0; m.infMul = o.infMul || 1;
    }
    S.party = fresh;
    S.active = 0;
    for (i = 0; i < fresh.length; i++) { if (fresh[i].id === activeId) { S.active = i; } }
    if (S.party[S.active].down) { nextAlive(S); }
    return S;
  }

  function aliveIdx(S) {
    var out = [];
    for (var i = 0; i < S.party.length; i++) { if (!S.party[i].down) { out.push(i); } }
    return out;
  }
  function nextAlive(S) {
    for (var k = 1; k <= S.party.length; k++) {
      var j = (S.active + k) % S.party.length;
      if (!S.party[j].down) { S.active = j; return true; }
    }
    return false;
  }
  function allDown(S) { return aliveIdx(S).length === 0; }

  /* ── 무리 들이기·치우기 ───────────────────────────────── */
  /** ⑲-16 그 등급에서 kind 의 공격(천하 등급 배율 포함) — 이야기 제단 체력을 이것으로 잰다 */
  function foeAtk(kind, tier) {
    var A = ADV(), w = wlNow(), a = ATK_BASE() * FOES[kind].atk * tierMul(tier);
    return Math.round(A && w ? a * A.atkMul(w) / A.atkMul(0) : a);
  }
  function spawnCamp(S, c) {
    S.camps[c.key] = { key: c.key, x: c.x, y: c.y, tier: c.tier, kind: c.kind, uids: [], sky: !!c.sky };
    for (var i = 0; i < c.foes.length; i++) {
      var F = FOES[c.foes[i].kind], m = tierMul(c.tier);
      var uid = ++S.uid;
      var hx = c.x + c.foes[i].dx, hy = c.y + c.foes[i].dy;
      var layers = F.shields ? F.shields.slice() : (F.shield ? [F.shield] : []);
      var shieldMax = layers.length ? Math.round(SHIELD_BASE() * F.sh * m) : 0;
      S.foes[uid] = {
        uid: uid, camp: c.key, kind: c.foes[i].kind, name: F.name, el: F.el, tier: c.tier,
        x: hx, y: hy, hx: hx, hy: hy,
        hpMax: Math.round(HP_BASE() * F.hp * m), hp: Math.round(HP_BASE() * F.hp * m),
        atk: Math.round(ATK_BASE() * F.atk * m),
        shield: shieldMax, shieldMax: shieldMax, shEl: layers[0] || null, layers: layers, layer: 0,
        aura: null, auraT: 0, st: 'idle', stT: 0, cd: 0.4 + (uid % 5) * 0.2,
        wa: (uid * 2.39996) % 6.283, stun: 0, shockN: 0, shockT: 0, shockDmg: 0,
        frozenT: 0, physT: 0, quickT: 0, burnN: 0, burnT: 0, burnDmg: 0,
        mark: null, dead: false, deadT: 0, hitT: -99, moving: false, phase: 0, calmReturn: 0, sky: !!c.sky
      };
      S.camps[c.key].uids.push(uid);
      if (F.hero && c.hero) {
        var fh = S.foes[uid], hh = c.hero;
        fh.heroId = hh.id; fh.name = hh.name; fh.el = hh.el;
        fh.hpMax = fh.hp = hh.hp; fh.atk = hh.atk;
        fh.layers = hh.layers.slice(); fh.shEl = hh.layers[0] || null; fh.shield = fh.shieldMax = hh.shield;
        fh.st = 'chase';                      // 겨루자 한 쪽이라 처음부터 깨어 있다
      }
      applyWorld(S.foes[uid], wlNow());       // ⑲-7 천하 등급
    }
  }

  /**
   * 내 둘레 격자를 훑어 무리를 들이고, 멀어진(그리고 싸우지 않는) 무리는 치운다.
   * 치운 무리는 다시 오면 온전한 모습으로 선다(체력은 기억하지 않는다).
   */
  function populate(S, px, py, terr, radius, bfn, lfn, zfn, tfn) {
    var R = radius || 200, far = R * 1.6;
    /* §5 ⑲-3 보물 상자를 지키는 무리(treasure.campsNear) — 키 'tc:<상자>', 연 상자 것은 안 온다 */
    if (tfn) {
      var tcs = tfn(px, py, R) || [], ti;
      for (ti = 0; ti < tcs.length; ti++) {
        if (!S.camps[tcs[ti].key] && !S.cleared[tcs[ti].key]) { spawnCamp(S, tcs[ti]); }
      }
    }
    /* ⑪ 수호자 — 둘레 랜드마크(`biome.landmarks`)마다 하나 */
    if (lfn) {
      var lms = lfn(px, py, R) || [], li;
      for (li = 0; li < lms.length; li++) {
        var gc = guardianAt(lms[li]);
        if (!gc || S.camps[gc.key] || S.cleared[gc.key]) { continue; }
        if (Math.hypot(gc.x - px, gc.y - py) <= R) { spawnCamp(S, gc); }
      }
    }
    var c0x = Math.floor((px - R) / CELL), c1x = Math.floor((px + R) / CELL);
    var c0y = Math.floor((py - R) / CELL), c1y = Math.floor((py + R) / CELL);
    for (var cy = c0y; cy <= c1y; cy++) {
      for (var cx = c0x; cx <= c1x; cx++) {
        var key = cx + '_' + cy;
        if (S.camps[key] || S.cleared[key]) { continue; }
        var c = campAt(cx, cy, terr, bfn, zfn);
        if (c && Math.hypot(c.x - px, c.y - py) <= R) { spawnCamp(S, c); }
      }
    }
    for (var k in S.camps) {
      if (!S.camps.hasOwnProperty(k)) { continue; }
      var cp = S.camps[k];
      if (cp.kind === 'hero' || cp.kind === 'domain' || cp.kind === 'story') { continue; }   // ⑯ 겨루는 판은 판이 끝날 때(duelCheck)·⑲-9 숨은 터 파도는 domain.js 가 치운다
      if (Math.hypot(cp.x - px, cp.y - py) <= far) { continue; }
      var busy = false, j;
      for (j = 0; j < cp.uids.length; j++) {
        var f = S.foes[cp.uids[j]];
        if (f && !f.dead && (f.st === 'chase' || f.st === 'wind')) { busy = true; }
      }
      if (busy) { continue; }
      for (j = 0; j < cp.uids.length; j++) { delete S.foes[cp.uids[j]]; }
      delete S.camps[k];
    }
  }

  /* ── 판정 ─────────────────────────────────────────────── */
  function push(S, e) { S.ev.push(e); return e; }
  /** ⑲-20 구름섬 — 나와 다른 층(섬 위·밑)의 적은 서로 못 본다(skyisle.apart). 층이 없으면 늘 false */
  function apart(f) { var SK = global.DG.skyIsle; return !!(SK && SK.apart && SK.apart(f)); }
  function living(S) {
    var out = [];
    for (var k in S.foes) { if (S.foes.hasOwnProperty(k) && !S.foes[k].dead && S.foes[k].st !== 'yield' && !apart(S.foes[k])) { out.push(S.foes[k]); } }
    return out;
  }
  function nearestFoe(S, px, py, r) {
    var best = null, bd = r;
    var L = living(S);
    for (var i = 0; i < L.length; i++) {
      var d = Math.max(0, Math.hypot(L[i].x - px, L[i].y - py) - BODY(L[i]));
      if (d <= bd) { bd = d; best = L[i]; }
    }
    return best;
  }
  function foesWithin(S, x, y, r) {
    var out = [], L = living(S);
    for (var i = 0; i < L.length; i++) { if (Math.hypot(L[i].x - x, L[i].y - y) - BODY(L[i]) <= r) { out.push(L[i]); } }
    return out;
  }
  function wake(f) { if (f.st === 'idle' || f.st === 'return') { f.st = 'chase'; f.stT = 0; } }

  function killCheck(S, f) {
    if (f.hp > 0 || f.dead || f.st === 'yield') { return; }
    if (FOES[f.kind].hero) { yieldHero(S, f); return; }
    f.hp = 0; f.dead = true; f.deadT = 0; f.mark = null;
    S.kills++;
    push(S, { t: 'kill', uid: f.uid, kind: f.kind, tier: f.tier, x: f.x, y: f.y, camp: f.camp, boss: !!FOES[f.kind].boss, elite: !!FOES[f.kind].shield && !FOES[f.kind].light, shield: !!FOES[f.kind].shield, guard: !!FOES[f.kind].guard });
    var cp = S.camps[f.camp];
    if (!cp) { return; }
    for (var i = 0; i < cp.uids.length; i++) {
      var g = S.foes[cp.uids[i]];
      if (g && !g.dead) { return; }
    }
    S.cleared[cp.key] = true;
    push(S, { t: 'clear', camp: cp.key, tier: cp.tier, kind: cp.kind, x: cp.x, y: cp.y });
  }

  /** ⑯ 인물이 굴복 — 쓰러뜨리지 않고 무릎 꿇린다(몸은 그 자리에 남아 등용 카드로 넘어간다). 졸개는 흩어진다 */
  function yieldHero(S, f) {
    f.hp = 0; f.mark = null; f.st = 'yield'; f.stun = 99;
    var cp = S.camps[f.camp];
    if (cp) {
      for (var i = 0; i < cp.uids.length; i++) { if (cp.uids[i] !== f.uid) { delete S.foes[cp.uids[i]]; } }
    }
    push(S, { t: 'yield', uid: f.uid, heroId: f.heroId, camp: f.camp, x: f.x, y: f.y });
  }

  /** ⑯ 겨루는 판 끝 — 굴복(win)·전멸(lose)·끌고 멀어져 인물이 돌아감(flee). 판을 치우고 사건 하나 */
  function endDuel(S, result) {
    var D = S.duel;
    if (!D) { return; }
    var cp = S.camps[D.camp];
    if (cp) { for (var i = 0; i < cp.uids.length; i++) { delete S.foes[cp.uids[i]]; } delete S.camps[D.camp]; }
    S.duel = null;
    push(S, { t: 'duelEnd', result: result, spawnUid: D.spawnUid, heroId: D.heroId });
  }
  /** 굴복하면 1초 무릎 꿇은 채 두었다가(보이게) 끝낸다 */
  function duelCheck(S, dt) {
    var D = S.duel;
    if (!D) { return; }
    var f = S.foes[D.uid];
    if (!f) { endDuel(S, 'flee'); return; }
    if (f.st === 'yield') { D.yieldT = (D.yieldT || 0) + dt; if (D.yieldT > 1) { endDuel(S, 'win'); } return; }
    if (f.st === 'return' || f.st === 'idle') { endDuel(S, D.wiped ? 'lose' : 'flee'); }
  }

  /** 방패 한 겹이 깨졌다 — 남은 겹이 있으면 곧바로 다음 원소 방패가 서고(짧게 휘청),
   *  마지막 겹이면 길게 드러눕는다. 한 겹짜리 정예는 예전 그대로(2초) */
  function breakShield(S, f) {
    var L = f.layers || [], more = f.layer + 1 < L.length;
    f.mark = null; f.st = 'chase';
    if (more) {
      f.layer++;
      f.shEl = L[f.layer];
      f.shield = f.shieldMax;
      f.stun = LAYER_STUN();
      push(S, { t: 'break', uid: f.uid, camp: f.camp, x: f.x, y: f.y, next: f.shEl, left: L.length - f.layer });
      return;
    }
    f.stun = L.length > 1 ? CORE_STUN() : SHIELD_STUN();
    push(S, { t: 'break', uid: f.uid, camp: f.camp, x: f.x, y: f.y, next: null, left: 0 });
  }

  /** 방패부터 깎는 날것의 피해(광역 반응 조각·물벼락 틱이 쓴다) */
  function rawHit(S, f, dmg) {
    if (f.dead || dmg <= 0) { return 0; }
    if (f.shield > 0) {
      f.shield = Math.max(0, f.shield - dmg);
      if (f.shield <= 0) { breakShield(S, f); }
      return dmg;
    }
    f.hp -= dmg;
    killCheck(S, f);
    return dmg;
  }

  /**
   * 한 대 — 방패·원소 부착·반응을 다 여기서 가른다.
   * @returns {{uid, dmg, react, shield, immune}}
   */
  function hitFoe(S, f, m, raw, el, src, force) {
    var out = { uid: f.uid, dmg: 0, react: null, shield: false, immune: false };
    if (f.dead) { return out; }
    var emB = (1 + (m.em || 0) / 300) * (m.reactMul || 1) * (1 + (m.rxAll || 0));   // ⑲-4 깨달음 2 · ⑲-5 무기 반응 효과
    if (S.loreT > 0) { emB *= S.loreMul; }                            // ⑲-15 옛 글자 풀이 — 명단 반응 피해
    var mul = f.stun > 0 ? STUN_MUL() : 1;
    raw *= talentMul(m, src);
    if (S.rallyT > 0 && src !== 'test') { raw *= S.rallyMul; }        // ⑲-11 군기·학날개 진
    if (f.markT > 0 && src !== 'test') { raw *= f.markMul || 1; }     // ⑲-15 그림자 걸음 표식 — 누구에게든
    /* ⑲-5 — 피해 보너스(원소/물리 + 무기 효과 + 세트 4, 더하기)·치명타. 출처가 인물의 한 방일 때만 */
    var TLk = global.DG.talent, gk = TLk ? TLk.keyOfSrc(src) : null;
    if (gk && m.dmgB) {
      raw *= 1 + (m.dmgB[gk] || 0) + ((m.elemB && m.elemB[el || 'phys']) || 0);
      if (m.cr > 0 && S.crng && S.crng() < m.cr) { raw *= 1 + (m.cdm || 0); out.crit = true; }
    }
    if (force && !out.crit) { raw *= 1 + (m.cdm || 0.5); out.crit = true; }   // ⑲-22 급소 — 반드시 치명
    S.calmT = 0; f.hitT = S.t; wake(f);
    if (f.shield > 0) {
      var sm = shieldMul(f.shEl, el);
      out.shield = true; out.immune = sm === 0;
      out.dmg = Math.round(raw * mul * sm);
      rawHit(S, f, out.dmg);
    } else {
      var rc = null, extra = 1;
      if (!el && f.physT > 0) { extra *= SUPER_PHYS(); }                       // 서리번개 뒤 물리
      if (f.frozenT > 0 && (el === 'rock' || src === 'heavy')) {
        /* 깨뜨림 — 얼어 멈춘 적을 암이나 3타째 기본 공격으로 깨면 크게 들어가고 풀린다 */
        rc = { kind: 'shatter', name: REACT_NAME.shatter }; extra *= SHATTER_MUL(); f.frozenT = 0;
      } else if (f.quickT > 0 && (el === 'elec' || el === 'grass')) {
        /* 싹틈 상태 — 뇌는 번개싹, 초는 덩굴뻗음 ×1.25(붙은 원소는 안 건드린다) */
        rc = { kind: el === 'elec' ? 'aggravate' : 'spread', name: REACT_NAME[el === 'elec' ? 'aggravate' : 'spread'] };
        extra *= QUICK_MUL() * emB;
      } else {
        rc = react(f.aura, el);
        if (!rc && attaches(el)) { f.aura = el; f.auraT = AURA_T(); }
        if (rc) { f.aura = null; f.auraT = 0; }
        if (rc && rc.kind === 'vaporize') { extra *= VAPOR_MUL() * emB * rxB(m, 'vaporize'); }
        if (rc && rc.kind === 'melt') { extra *= MELT_MUL() * emB * rxB(m, 'melt'); }
      }
      out.dmg = Math.round(raw * mul * extra);
      f.hp -= out.dmg;
      if (rc) {
        out.react = rc.kind;
        var near, i;
        if (rc.kind === 'frozen') {
          f.frozenT = FROZEN_T(); f.mark = null;
          if (f.st === 'wind') { f.st = 'chase'; f.cd = FOES[f.kind].cd * (f.cdMul || 1); }       // 휘두르던 것도 멎는다
        } else if (rc.kind === 'superconduct') {
          near = foesWithin(S, f.x, f.y, SUPER_R());
          for (i = 0; i < near.length; i++) { near[i].physT = SUPER_T(); wake(near[i]); rawHit(S, near[i], Math.round(m.atk * SUPER_MUL() * emB)); }
        } else if (rc.kind === 'swirl') {
          near = foesWithin(S, f.x, f.y, SWIRL_R());
          for (i = 0; i < near.length; i++) {
            var sg = near[i];
            if (sg === f) { continue; }
            wake(sg);
            if (!sg.aura || sg.aura === rc.from) { sg.aura = rc.from; sg.auraT = AURA_T(); }
            rawHit(S, sg, Math.round(m.atk * SWIRL_MUL() * emB * rxB(m, 'swirl')));
          }
        } else if (rc.kind === 'crystallize') {
          var am = active(S), gh = Math.round((am ? am.hpMax : 600) * CRYSTAL_HP());
          S.guard = { hp: Math.max(gh, S.guard ? S.guard.hp : 0), max: gh, t: CRYSTAL_T() };
        } else if (rc.kind === 'bloom') {
          S.zones.push({ kind: 'seed', x: f.x, y: f.y, r: BLOOM_R(), t: BLOOM_T(), el: 'grass', dmg: Math.round(m.atk * BLOOM_MUL() * emB) });
        } else if (rc.kind === 'burning') {
          f.burnN = BURN_N(); f.burnT = BURN_EVERY(); f.burnDmg = Math.max(1, Math.round(m.atk * BURN_MUL() * emB * rxB(m, 'burning')));
        } else if (rc.kind === 'quicken') {
          f.quickT = QUICK_T();
        } else if (rc.kind === 'overload') {
          near = foesWithin(S, f.x, f.y, OVERLOAD_R());
          var od = Math.round(m.atk * OVERLOAD_MUL() * emB * rxB(m, 'overload'));
          for (i = 0; i < near.length; i++) {
            var g = near[i];
            var ang = Math.atan2(g.y - f.y, g.x - f.x);
            if (g !== f) { g.x += Math.cos(ang) * 2.5; g.y += Math.sin(ang) * 2.5; }
            wake(g);
            rawHit(S, g, od);
          }
        } else if (rc.kind === 'charged') {
          near = foesWithin(S, f.x, f.y, CHARGED_R());
          for (i = 0; i < near.length; i++) {
            near[i].shockN = 3; near[i].shockT = 1;
            near[i].shockDmg = Math.round(m.atk * CHARGED_MUL() * emB);
            wake(near[i]);
          }
        }
        push(S, { t: 'react', kind: rc.kind, name: rc.name, x: f.x, y: f.y });
      }
      killCheck(S, f);
    }
    push(S, { t: 'hit', uid: f.uid, x: f.x, y: f.y, dmg: out.dmg, el: el, react: out.react, src: src, shield: out.shield, immune: out.immune, crit: !!out.crit });
    return out;
  }

  function active(S) { return S.party[S.active]; }
  /* ⑲-11 검기·불새 깃 — 부여 중이면 기본·강·낙하 공격이 인물 원소로, 피해 곱 */
  function infEl(m) { return m.infT > 0 ? m.el : null; }
  function infM(m) { return m.infT > 0 ? m.infMul || 1 : 1; }

  /** 기본 공격 — 3타 사슬(0.9·1.0·1.5). 사거리 밖이면 6m 안의 적에게 파고든다 */
  function attack(S, px, py) {
    var m = active(S);
    if (!m || m.down || S.atkCd > 0) { return { ok: false }; }
    /* ⑲-5 무기 종류마다 모양 — 칼은 옛 3타(사거리 손잡이 그대로), 서책·활은 멀리 하나(파고들지 않는다) */
    var kit = m.kit || SWORD_KIT, reach = kit === SWORD_KIT || m.wtype === 'sword' ? REACH() : kit.reach, tgt;
    if (kit.range) {
      tgt = nearestFoe(S, px, py, kit.range);
      /* ⑲-22 둘레에 적이 없으면 사거리 안 상자 과녁을 친다(활잡이가 없어도 서책으로 풀린다) */
      var TRs = global.DG.treasure, tp = !tgt && TRs && TRs.shootNear ? TRs.shootNear(px, py, kit.range) : null;
      if (tp) {
        TRs.shootSeg(tp.x, tp.y, tp.x, tp.y);
        var st0 = S.combo % 3;
        S.combo++; S.comboT = 0; S.atkCd = kit.sec[st0];
        push(S, { t: 'swing', step: st0, w: m.wtype, ranged: true, tx: tp.x, ty: tp.y, el: kit.el ? m.el : null });
        return { ok: true, step: st0, target: true };
      }
    } else {
      tgt = nearestFoe(S, px, py, reach);
      if (!tgt) {
        var n = nearestFoe(S, px, py, LUNGE_R());
        if (n) {
          var d = Math.hypot(n.x - px, n.y - py) || 1, go = Math.max(0, d - BODY(n) - reach * 0.7);
          S.dash = { vx: (n.x - px) / d * go / 0.14, vy: (n.y - py) / d * go / 0.14, t: 0.14 };
          tgt = n;
        }
      }
    }
    var step = S.combo % 3;
    S.combo++; S.comboT = 0;
    S.atkCd = kit.sec[step];
    if (!tgt) { push(S, { t: 'swing', step: step, w: m.wtype }); return { ok: true, miss: true, step: step }; }
    var r = hitFoe(S, tgt, m, m.atk * kit.mul[step] * infM(m), kit.el ? m.el : infEl(m), kit.heavy ? 'heavy' : 'basic');
    rainFollow(S, px, py);                                          // ⑲-17 뱃노래
    m.energy = Math.min(ENERGY_MAX(), m.energy + 1.5 * (m.er || 1));
    push(S, { t: 'swing', step: step, uid: tgt.uid, w: m.wtype, ranged: !!kit.range, tx: tgt.x, ty: tgt.y, el: kit.el ? m.el : null });
    return { ok: true, step: step, hit: r };
  }

