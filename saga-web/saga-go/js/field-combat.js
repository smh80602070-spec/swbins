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
  function PLUNGE_R() { return 3.5; }     function PLUNGE_MUL() { return K('plungeMul', 1.2); }
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
      push(S, { t: 'break', uid: f.uid, x: f.x, y: f.y, next: f.shEl, left: L.length - f.layer });
      return;
    }
    f.stun = L.length > 1 ? CORE_STUN() : SHIELD_STUN();
    push(S, { t: 'break', uid: f.uid, x: f.x, y: f.y, next: null, left: 0 });
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

  /* ── ⑲-22 조준 사격 ─────────────────────────────────── */
  function canAim(S) { var m = active(S); return !!(m && !m.down && m.wtype === 'bow'); }
  /** 조준에 잠길 것 — 살아 있는 적 + 상자 과녁·석등(treasure) + 이야기 석등·제단(story) [{kind, x, y, uid?}] */
  function aimCands(S, px, py) {
    var out = living(S).map(function (f) { return { kind: 'foe', uid: f.uid, x: f.x, y: f.y }; });
    var TR = global.DG.treasure, ST = global.DG.story;
    if (TR && TR.aimPoints) { out = out.concat(TR.aimPoints(px, py, AIM_R())); }
    if (ST && ST.aimPoints) { out = out.concat(ST.aimPoints()); }
    return out;
  }
  /** 겨눈 쪽 AIM_CONE 안 AIM_R 안에서 각이 가장 작은 것에 잠근다 */
  function aimLock(S, px, py) {
    var a = S.aim, best = null, bs = Infinity, L = aimCands(S, px, py), cc = Math.cos(AIM_CONE());
    for (var i = 0; i < L.length; i++) {
      var c = L[i], dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy);
      if (d < 1 || d > AIM_R()) { continue; }
      var cs = (dx * a.dx + dy * a.dy) / d;
      if (cs < cc) { continue; }
      var sc = Math.acos(Math.min(1, cs)) * 20 + d * 0.01;
      if (sc < bs) { bs = sc; best = c; }
    }
    a.lock = best;
    return best;
  }
  /** 조준에 들어간다 — 가까운 적 쪽(없으면 마지막으로 움직인 쪽) */
  function aimStart(S, px, py) {
    if (!canAim(S) || S.aim) { return { ok: false }; }
    var n = nearestFoe(S, px, py, AIM_R()), dx = n ? n.x - px : (S.lastDx || 0), dy = n ? n.y - py : (S.lastDy || 1), dl = Math.hypot(dx, dy) || 1;
    S.aim = { dx: dx / dl, dy: dy / dl, t: 0, hold: false, auto: false, lock: null };
    aimLock(S, px, py);
    push(S, { t: 'aim', on: true });
    return { ok: true };
  }
  function aimEnd(S) { if (!S.aim) { return false; } S.aim = null; push(S, { t: 'aim', on: false }); return true; }
  /** 방향 키로 겨눈 쪽을 돌린다 — 누른 쪽으로 초당 AIM_TURN 라디안까지 */
  function aimSteer(S, ux, uy, dt) {
    var a = S.aim, l = Math.hypot(ux, uy);
    if (!a || l < 1e-6) { return false; }
    var cur = Math.atan2(a.dy, a.dx), want = Math.atan2(uy / l, ux / l), d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
    var k = Math.max(-AIM_TURN() * (dt || 0), Math.min(AIM_TURN() * (dt || 0), d)), ang = cur + k;
    a.dx = Math.cos(ang); a.dy = Math.sin(ang);
    return true;
  }
  /** 충전 시작 */
  function aimHold(S) { if (!S.aim) { return false; } S.aim.hold = true; S.aim.t = 0; return true; }
  /** 쏜다 — 잠긴 것 쪽으로(점 과녁이면 그 자리에서 멈춘다), 없으면 겨눈 쪽 ARROW_RANGE */
  function aimShoot(S, px, py) {
    var a = S.aim, m = active(S);
    if (!a || !m || m.down || S.atkCd > 0) { return { ok: false }; }
    var full = a.hold && a.t >= AIM_FULL() - 1e-9, lk = a.lock;
    var tx = lk ? lk.x : px + a.dx * ARROW_RANGE(), ty = lk ? lk.y : py + a.dy * ARROW_RANGE();
    var dx = tx - px, dy = ty - py, dl = Math.hypot(dx, dy) || 1;
    if (!S.arrows) { S.arrows = []; }
    S.arrows.push({ x: px, y: py, dx: dx / dl, dy: dy / dl, left: lk && lk.kind !== 'foe' ? dl : ARROW_RANGE(), full: full, m: m });
    a.t = 0; a.hold = false; S.atkCd = AIM_GAP();
    push(S, { t: 'shoot', x: px, y: py, tx: tx, ty: ty, full: full, el: full ? m.el : null });
    return { ok: true, full: full, lock: lk ? lk.kind : null };
  }
  function foeR(f) { return Math.max(0.6, ((FOES[f.kind] && FOES[f.kind].h) || 1) * 0.55); }
  /** 화살이 적에 박힌다 — 충전이면 원소 ×1.25, 모르는 적(쉬는 중)이면 급소, 덜 찼으면 물리 ×0.45 */
  function arrowHit(S, r, f) {
    var m = r.m, weak = r.full && f.st === 'idle';
    var out = hitFoe(S, f, m, m.atk * (r.full ? AIM_FULLMUL() : AIM_PART()) * infM(m), r.full ? m.el || null : infEl(m), 'heavy', weak);
    if (weak) { push(S, { t: 'weak', uid: f.uid, x: f.x, y: f.y }); }
    rainFollow(S, f.x, f.y);                                        // ⑲-17 뱃노래
    m.energy = Math.min(ENERGY_MAX(), m.energy + 2 * (m.er || 1));
    return out;
  }
  /** 화살 한 박자 — 길 위 첫 적에 박히거나, 과녁을 켜거나, 다 날면 멈춘다. 멈춘 자리 = 'arrow'(충전이면 원소 신호) */
  function stepArrows(S, dt) {
    var A = S.arrows || [], TR = global.DG.treasure;
    for (var i = A.length - 1; i >= 0; i--) {
      var r = A[i], go = Math.min(r.left, ARROW_V() * dt), x1 = r.x + r.dx * go, y1 = r.y + r.dy * go, hf = null, bt = Infinity;
      var L = living(S);
      for (var j = 0; j < L.length; j++) {
        var f = L[j];
        if (segDist(f.x, f.y, r.x, r.y, x1, y1) > foeR(f)) { continue; }
        var al = (f.x - r.x) * r.dx + (f.y - r.y) * r.dy;
        if (al < bt) { bt = al; hf = f; }
      }
      if (hf) {
        arrowHit(S, r, hf);
        push(S, { t: 'arrow', x: hf.x, y: hf.y, el: r.full ? r.m.el : null, r: ARROW_EL_R(), hit: hf.uid });
        A.splice(i, 1); continue;
      }
      var nT = TR && TR.shootSeg ? TR.shootSeg(r.x, r.y, x1, y1) : 0;
      r.x = x1; r.y = y1; r.left -= go;
      if (nT > 0 || r.left <= 1e-6) {
        push(S, { t: 'arrow', x: r.x, y: r.y, el: r.full ? r.m.el : null, r: ARROW_EL_R(), target: nT });
        A.splice(i, 1);
      }
    }
  }

  /**
   * ⑲-2 강공격 — 공격을 0.4초 넘게 누르고 있으면(런타임이 잰다). 전투 스태미나 20, 가장 가까운 적 쪽
   * 앞 넓게(3.2m, 앞뒤 내적 −0.2 이상) ×1.3 물리. 콤보는 처음부터. 모자라면 { ok:false, tired:true }
   */
  function heavy(S, px, py) {
    var m = active(S);
    if (!m || m.down) { return { ok: false }; }
    var cc = CHARGE_COST() * staSave();
    if (S.stamina < cc) { push(S, { t: 'tired' }); return { ok: false, tired: true }; }
    S.stamina -= cc; S.staT = 0;
    S.combo = 0; S.comboT = 9; S.atkCd = 0.5;
    var n = nearestFoe(S, px, py, LUNGE_R());
    var dx = n ? n.x - px : (S.lastDx || 0), dy = n ? n.y - py : (S.lastDy || 1), dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    var hits = living(S).filter(function (f) {
      var fx = f.x - px, fy = f.y - py, d = Math.hypot(fx, fy);
      return d - BODY(f) <= CHARGE_REACH() && (d < 0.5 || (fx * dx + fy * dy) / d >= CHARGE_ARC());
    });
    for (var i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * CHARGE_MUL() * infM(m), infEl(m), 'heavy'); }
    if (hits.length) { rainFollow(S, px, py); }                     // ⑲-17 뱃노래
    m.energy = Math.min(ENERGY_MAX(), m.energy + 1.5 * hits.length * (m.er || 1));
    push(S, { t: 'heavy', x: px + dx * 1.2, y: py + dy * 1.2, r: 1.8, n: hits.length });
    return { ok: true, n: hits.length };
  }

  /** ⑲-2 낙하 공격 — 내리꽂아 땅에 닿은 자리 둘레 3.5m, ×(1.2 + 0.1×떨어진 m, 15m 까지) 물리 */
  function plungeMul(fell) { return PLUNGE_MUL() + PLUNGE_PER_M() * Math.max(0, Math.min(PLUNGE_MAX_M(), fell || 0)); }
  function plunge(S, px, py, fell) {
    var m = active(S);
    if (!m || m.down) { return { ok: false }; }
    var mul = plungeMul(fell), hits = foesWithin(S, px, py, PLUNGE_R());
    for (var i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * mul * infM(m), infEl(m), 'heavy'); }
    if (hits.length) { rainFollow(S, px, py); }                     // ⑲-17 뱃노래
    m.energy = Math.min(ENERGY_MAX(), m.energy + 1.5 * hits.length * (m.er || 1));
    push(S, { t: 'plunge', x: px, y: py, r: PLUNGE_R(), n: hits.length, mul: mul });
    return { ok: true, n: hits.length, mul: mul };
  }

  /** 원소 스킬 — 겨눈 적 둘레 4.5m 에 원소를 붙인다. 기력 +6(+2/마리), 대기 동료 +3 */
  function skill(S, px, py) {
    var m = active(S);
    if (!m || m.down || m.skillCd > 0) { return { ok: false, cd: m ? m.skillCd : 0 }; }
    if (m.kitS) { return kitSkill(S, m, px, py); }                   // ⑲-11 고유·갈래
    var aim = nearestFoe(S, px, py, SKILL_AIM());
    var cx = aim ? aim.x : px, cy = aim ? aim.y : py;
    var sh = m.shape || 'circle', hits = [], i, ev;
    /* 겨눈 쪽 — 적이 없으면 마지막으로 움직인(회피한) 쪽, 그것도 없으면 +y */
    var dx = cx - px, dy = cy - py, dl = Math.hypot(dx, dy);
    if (dl < 1e-6) { dx = S.lastDx || 0; dy = S.lastDy || 1; dl = Math.hypot(dx, dy) || 1; }
    dx /= dl; dy /= dl;
    if (sh === 'thrust') {
      var ex = px + dx * THRUST_LEN(), ey = py + dy * THRUST_LEN();
      hits = living(S).filter(function (f) { return segDist(f.x, f.y, px, py, ex, ey) <= THRUST_W(); });
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * THRUST_MUL(), m.el, 'skill'); }
      ev = { x: ex, y: ey, x0: px, y0: py, r: THRUST_W() };
    } else if (sh === 'dash') {
      var go = aim ? Math.min(DASH_LEN(), Math.max(0, dl - 1.2)) : DASH_LEN();
      var bx = px + dx * go, by = py + dy * go;
      hits = living(S).filter(function (f) { return segDist(f.x, f.y, px, py, bx + dx * 1.2, by + dy * 1.2) <= DASH_W(); });
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * DASH_MUL(), m.el, 'skill'); }
      S.dash = { vx: dx * go / DASH_T(), vy: dy * go / DASH_T(), t: DASH_T() };
      S.iframe = Math.max(S.iframe, 0.3);
      ev = { x: bx, y: by, x0: px, y0: py, r: DASH_W() };
    } else if (sh === 'field') {
      S.zones.push({ kind: 'field', x: cx, y: cy, r: FIELD_R(), t: FIELD_T(), next: 0, el: m.el, atk: m.atk, em: m.em, uid: m.id, tm: m.tm, reactMul: m.reactMul, m: m });
      hits = foesWithin(S, cx, cy, FIELD_R());          // 기력 셈에만 — 피해는 zone 틱(바로 첫 틱)이 준다
      ev = { x: cx, y: cy, r: FIELD_R() };
    } else if (sh === 'summon') {
      S.zones.push({ kind: 'summon', x: px + dx * 1.5, y: py + dy * 1.5, r: SUMMON_R(), t: SUMMON_T(), next: 0, el: m.el, atk: m.atk, em: m.em, uid: m.id, tm: m.tm, reactMul: m.reactMul, m: m });
      hits = aim ? [aim] : [];
      ev = { x: px + dx * 1.5, y: py + dy * 1.5, r: SUMMON_R() };
    } else {
      hits = foesWithin(S, cx, cy, SKILL_R());
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * SKILL_MUL(), m.el, 'skill'); }
      ev = { x: cx, y: cy, r: SKILL_R() };
    }
    if (sh === 'field' || sh === 'summon') { stepZones(S, 0); }   // 놓자마자 첫 틱
    m.skillCd = m.skCdMax = SKILL_CD() * (m.cdMul || 1);        // ⑲-4 깨달음 1 — 대기 -15%
    m.energy = Math.min(ENERGY_MAX(), m.energy + (6 + Math.min(6, hits.length * 2)) * (m.er || 1));
    for (var j = 0; j < S.party.length; j++) {
      var o = S.party[j];
      if (j !== S.active && !o.down) { o.energy = Math.min(ENERGY_MAX(), o.energy + 3 * (o.er || 1)); }
    }
    push(S, { t: 'skill', el: m.el, shape: sh, x: ev.x, y: ev.y, x0: ev.x0, y0: ev.y0, r: ev.r, n: hits.length });
    return { ok: true, n: hits.length, shape: sh };
  }

  /** ⑲-11 명단 보호막 — 지금 인물 최대 체력 × pct, 있던 것보다 크면 바꾼다 */
  function giveGuard(S, m, pct, sec) {
    var gh = Math.round(m.hpMax * pct), G = S.guard;
    S.guard = { hp: Math.max(gh, G ? G.hp : 0), max: Math.max(gh, G ? G.max : 0), t: Math.max(sec, G ? G.t : 0) };
  }
  /** ⑲-17 밀어냄 — (ux,uy) 쪽으로 dist m 를 KB_T 초에 미끄러진다. 우두머리·보스·굴복한 인물은 안 밀린다 */
  var KB_T = 0.25;
  function knock(f, ux, uy, dist) {
    if (!f || f.dead || f.st === 'yield' || FOES[f.kind].boss || !dist) { return; }
    f.kb = { vx: ux * dist / KB_T, vy: uy * dist / KB_T, t: KB_T };
  }
  /**
   * ⑲-17 뱃노래 따라 치기 — 기본·강·낙하 공격이 맞은 뒤 부른다. 쉼(gap)이 끝났으면 reach 안 가까운 적 n 에
   * 놓은 인물(rainM)의 공격력으로 물 노 한 대씩(원소 부착·치명은 그 인물 것)
   */
  function rainFollow(S, px, py) {
    var k = S.rainK, rm = S.rainM;
    if (!(S.rainT > 0) || S.rainCd > 0 || !k || !rm) { return 0; }
    var tg = living(S).filter(function (f) { return Math.hypot(f.x - px, f.y - py) <= k.reach; })
      .sort(function (a, b) { return Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py); }).slice(0, k.n);
    if (!tg.length) { return 0; }
    S.rainCd = k.gap;
    for (var i = 0; i < tg.length; i++) {
      hitFoe(S, tg[i], rm, rm.atk * k.rmul, rm.el, 'burst');
      push(S, { t: 'zone', kind: 'rain', el: rm.el, x: tg[i].x, y: tg[i].y, r: 1.2, n: 1 });
    }
    return tg.length;
  }
  /** ⑲-11 원소 덧붙임 — 물결 회복(명단)·번개 기력(다른 인물) */
  function kitExtras(S, m, k) {
    for (var i = 0; i < S.party.length; i++) {
      var o = S.party[i];
      if (o.down) { continue; }
      if (k.heal) { o.hp = Math.min(o.hpMax, o.hp + Math.round(o.hpMax * k.heal)); }
      if (k.team && o !== m) { o.energy = Math.min(ENERGY_MAX(), o.energy + k.team * (o.er || 1)); }
    }
  }
  /**
   * ⑲-11 고유·갈래 스킬(kits.js 표의 type) — 대기·기력·대기 동료 몫은 옛 스킬과 같다.
   * 깨달음 1(대기 곱)·무예 배율(출처 skill/zone)·치명·군기는 hitFoe 가 그대로 태운다.
   */
  function kitSkill(S, m, px, py) {
    var k = m.kitS, aim = nearestFoe(S, px, py, Math.max(SKILL_AIM(), k.reach || 0)), hits = [], i, ev, shape = 'circle';
    var dx = aim ? aim.x - px : 0, dy = aim ? aim.y - py : 0, dl = Math.hypot(dx, dy), far = dl;
    if (dl < 1e-6) { dx = S.lastDx || 0; dy = S.lastDy || 1; dl = Math.hypot(dx, dy) || 1; }
    dx /= dl; dy /= dl;
    if (k.type === 'dash') {
      var go = aim ? Math.min(k.len, Math.max(0, far - BODY(aim) - 1.2)) : k.len, bx = px + dx * go, by = py + dy * go;
      hits = living(S).filter(function (f) { return segDist(f.x, f.y, px, py, bx + dx * 1.2, by + dy * 1.2) <= k.w + BODY(f); });
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill'); }
      S.dash = { vx: dx * go / DASH_T(), vy: dy * go / DASH_T(), t: DASH_T() };
      S.iframe = Math.max(S.iframe, 0.3);
      ev = { x: bx, y: by, x0: px, y0: py, r: k.w }; shape = 'dash';
    } else if (k.type === 'shells') {
      var tg = living(S).filter(function (f) { return Math.hypot(f.x - px, f.y - py) <= k.reach; })
        .sort(function (a, b) { return Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py); }).slice(0, k.n);
      var spots = tg.length ? tg.map(function (f) { return { x: f.x, y: f.y }; }) : [{ x: px + dx * 8, y: py + dy * 8 }];
      for (i = 0; i < spots.length; i++) {
        S.zones.push({ kind: 'shell', x: spots[i].x, y: spots[i].y, r: k.r, t: k.delay, el: m.el, m: m, mul: k.mul });
      }
      hits = tg;
      ev = { x: spots[0].x, y: spots[0].y, r: k.r };
    } else if (k.type === 'guard') {
      hits = foesWithin(S, px, py, k.r);
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill'); }
      giveGuard(S, m, k.shield + (k.shieldAdd || 0), k.sec);
      ev = { x: px, y: py, r: k.r };
    } else if (k.type === 'blink') {
      /* ⑲-15 그림자 걸음 — 가까운 적을 지나 그 뒤 back m 까지 돌진, 도착 둘레를 베고 그 적에 표식 */
      var bt = nearestFoe(S, px, py, k.reach), ex, ey;
      if (bt) { var bl = Math.hypot(bt.x - px, bt.y - py) || 1; ex = bt.x + (bt.x - px) / bl * k.back; ey = bt.y + (bt.y - py) / bl * k.back; }
      else { ex = px + dx * k.len; ey = py + dy * k.len; }
      var bgo = Math.hypot(ex - px, ey - py), bux = bgo > 1e-6 ? (ex - px) / bgo : dx, buy = bgo > 1e-6 ? (ey - py) / bgo : dy;
      S.dash = { vx: bux * bgo / DASH_T(), vy: buy * bgo / DASH_T(), t: DASH_T() };
      S.iframe = Math.max(S.iframe, 0.3);
      hits = foesWithin(S, ex, ey, k.r);
      if (bt && hits.indexOf(bt) < 0) { hits.push(bt); }
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill'); }
      if (bt && !bt.dead) { bt.markT = k.mark; bt.markMul = k.markMul; }
      ev = { x: ex, y: ey, x0: px, y0: py, r: k.r }; shape = 'dash';
    } else if (k.type === 'gust') {
      /* ⑲-17 부채 바람 — 앞 r 부채꼴(내적 arc 이상)을 치고 나에게서 먼 쪽으로 밀어낸다. 회복은 kitExtras(heal) */
      hits = living(S).filter(function (f) {
        var fx = f.x - px, fy = f.y - py, d = Math.hypot(fx, fy);
        return d <= k.r && (d < 0.5 || (fx * dx + fy * dy) / d >= k.arc);
      });
      for (i = 0; i < hits.length; i++) {
        hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill');
        var gl = Math.hypot(hits[i].x - px, hits[i].y - py);
        knock(hits[i], gl > 0.5 ? (hits[i].x - px) / gl : dx, gl > 0.5 ? (hits[i].y - py) / gl : dy, k.knock);
      }
      ev = { x: px + dx * k.r * 0.5, y: py + dy * k.r * 0.5, r: k.r * 0.5 };
    } else if (k.type === 'updraft') {
      /* ⑲-43 별배 견인줄 — 둘레 r 적을 나 쪽으로 끌어 치고, 나는 lift m 위로 솟구쳐 날개를 편다(키보드 판 땅 위만 — landform.launch) */
      hits = foesWithin(S, px, py, k.r);
      for (i = 0; i < hits.length; i++) {
        hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill');
        var ul = Math.hypot(hits[i].x - px, hits[i].y - py);
        if (ul > 1.2) { knock(hits[i], (px - hits[i].x) / ul, (py - hits[i].y) / ul, Math.min(k.pull, ul - 1.2)); }
      }
      var LFu = global.DG.landform;
      S.lifted = !!(LFu && LFu.launch && LFu.launch(k.lift));
      ev = { x: px, y: py, r: k.r };
    } else if (k.type === 'wave') {
      /* ⑲-17 노 물결 — 앞으로 len·폭 w 의 길을 치고 앞으로 밀어낸다(나는 제자리) */
      var wx = px + dx * k.len, wy = py + dy * k.len;
      hits = living(S).filter(function (f) { return segDist(f.x, f.y, px, py, wx, wy) <= k.w; });
      for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'skill'); knock(hits[i], dx, dy, k.knock); }
      ev = { x: wx, y: wy, x0: px, y0: py, r: k.w }; shape = 'thrust';
    } else {
      S.zones.push({ kind: 'kitzone', x: px, y: py, r: k.r, t: k.sec, next: 0, every: k.every, n: k.n, mul: k.mul, energy: k.energy || 0, el: m.el, atk: m.atk, m: m });
      hits = foesWithin(S, px, py, k.r);
      stepZones(S, 0);                                                // 놓자마자 첫 틱
      ev = { x: px, y: py, r: k.r }; shape = 'field';
    }
    if (k.shieldAdd && k.type !== 'guard') { giveGuard(S, m, k.shieldAdd, 12); }   // 바위 — 방패 틀이 아니면 새 보호막
    kitExtras(S, m, k);
    m.skillCd = m.skCdMax = Math.max(1, k.cd) * (m.cdMul || 1);
    m.energy = Math.min(ENERGY_MAX(), m.energy + (6 + Math.min(6, hits.length * 2)) * (m.er || 1));
    for (var j = 0; j < S.party.length; j++) {
      var o = S.party[j];
      if (j !== S.active && !o.down) { o.energy = Math.min(ENERGY_MAX(), o.energy + 3 * (o.er || 1)); }
    }
    push(S, { t: 'skill', el: m.el, shape: shape, kit: k.type, name: k.name, x: ev.x, y: ev.y, x0: ev.x0, y0: ev.y0, r: ev.r, n: hits.length });
    return { ok: true, n: hits.length, shape: shape, kit: k.type, name: k.name };
  }
  /** ⑲-11 고유·갈래 해방 — 둘레 r 에 mul 한 번 + type 효과. 기력·대기·무적·깨달음 5 는 burst 가 먼저 치렀다 */
  function kitBurst(S, m, px, py) {
    var k = m.kitB, hits = foesWithin(S, px, py, k.r), i;
    for (i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * k.mul, m.el, 'burst'); }
    if (k.type === 'infuse') { m.infT = k.sec; m.infMul = k.nmul; }
    else if (k.type === 'rally') { S.rallyT = k.sec; S.rallyMul = k.atk; }
    else if (k.type === 'ward') { S.wardT = k.sec; S.wardMul = k.taken; }
    else if (k.type === 'lore') { S.loreT = k.sec; S.loreMul = k.rmul; }          // ⑲-15 옛 글자 풀이
    else if (k.type === 'feast') {                                                // ⑲-17 잔칫날 순풍 — 첫 틱은 every 뒤
      S.zones.push({ kind: 'feast', x: px, y: py, r: k.r, t: k.sec, next: k.every, every: k.every, heal: k.fheal, mul: k.emul, el: m.el, atk: m.atk, m: m });
    }
    else if (k.type === 'rain') { S.rainT = k.sec; S.rainCd = 0; S.rainM = m; S.rainK = k; }   // ⑲-17 뱃노래
    else if (k.type === 'echo') {
      /* ⑲-15 가면 벗기 — reach 안 표식 난 적마다 every 초 간격 메아리 n(적을 따라감), 없으면 가까운 둘 */
      var near = living(S).filter(function (f) { return Math.hypot(f.x - px, f.y - py) <= k.reach; })
        .sort(function (a, b) { return Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py); });
      var marked = near.filter(function (f) { return f.markT > 0; }), tgs = marked.length ? marked : near.slice(0, 2), e2;
      for (i = 0; i < tgs.length; i++) {
        for (e2 = 1; e2 <= k.n; e2++) { S.zones.push({ kind: 'echo', uid: tgs[i].uid, x: tgs[i].x, y: tgs[i].y, r: 1.2, t: k.every * e2, el: m.el, m: m, mul: k.emul }); }
      }
    }
    else if (k.type === 'haste') {
      S.hasteT = k.sec;
      for (i = 0; i < S.party.length; i++) { var o = S.party[i]; if (o !== m && !o.down) { o.energy = Math.min(ENERGY_MAX(), o.energy + k.energy * (o.er || 1)); } }
    } else if (k.type === 'vortex') {
      var n = nearestFoe(S, px, py, 12), dx = n ? n.x - px : (S.lastDx || 0), dy = n ? n.y - py : (S.lastDy || 1), dl = Math.hypot(dx, dy) || 1;
      S.zones.push({ kind: 'vortex', x: px + dx / dl * k.ahead, y: py + dy / dl * k.ahead, r: k.r, t: k.sec, next: k.every, every: k.every,
        mul: k.tick, pull: k.pull, el: m.el, atk: m.atk, m: m });
    }
    kitExtras(S, m, k);
    push(S, { t: 'burst', el: m.el, x: px, y: py, r: k.r, n: hits.length, name: k.name, kit: k.type });
    return { ok: true, n: hits.length, name: k.name, kit: k.type };
  }

  /** 장판·소환 — 놓은 사람 공격력으로 틱마다 친다(그 사이 교체해도 남는다) */
  function stepZones(S, dt) {
    var Z = S.zones || [], i, k;
    for (i = Z.length - 1; i >= 0; i--) {
      var z = Z[i];
      z.t -= dt; z.next -= dt;
      if (z.kind === 'seed') {
        /* ⑲-1 꽃피움 씨앗 — 1.5초 뒤 둘레 3m 에서 터진다 */
        if (z.t <= 1e-9) {
          var sn = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < sn.length; k++) { wake(sn[k]); rawHit(S, sn[k], z.dmg); }
          push(S, { t: 'zone', kind: 'seed', el: 'grass', x: z.x, y: z.y, r: z.r, n: sn.length });
          Z.splice(i, 1);
        }
        continue;
      }
      if (z.kind === 'echo') {
        /* ⑲-15 가면 벗기 메아리 — 그 적을 따라가 t 뒤에 친다(이미 쓰러졌으면 헛친다) */
        var ef = S.foes[z.uid];
        if (ef && !ef.dead) { z.x = ef.x; z.y = ef.y; }
        if (z.t <= 1e-9) {
          if (ef && !ef.dead) { hitFoe(S, ef, z.m, z.m.atk * z.mul, z.el, 'burst'); }
          push(S, { t: 'zone', kind: 'echo', el: z.el, x: z.x, y: z.y, r: z.r, n: ef && !ef.dead ? 1 : 0 });
          Z.splice(i, 1);
        }
        continue;
      }
      if (z.kind === 'shell') {
        /* ⑲-11 늦게 떨어지는 탄 — delay 뒤 둘레 r 을 친다 */
        if (z.t <= 1e-9) {
          var sh = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < sh.length; k++) { hitFoe(S, sh[k], z.m, z.m.atk * z.mul, z.el, 'skill'); }
          push(S, { t: 'zone', kind: 'shell', el: z.el, x: z.x, y: z.y, r: z.r, n: sh.length });
          Z.splice(i, 1);
        }
        continue;
      }
      if (z.kind === 'vortex' && dt > 0) {
        /* ⑲-11 소용돌이 — 둘레 r+2 의 적을 늘 가운데로 끈다 */
        var vs = foesWithin(S, z.x, z.y, z.r + 2);
        for (k = 0; k < vs.length; k++) {
          var vd = Math.hypot(z.x - vs[k].x, z.y - vs[k].y);
          if (vd > 0.6) { var pl = Math.min(vd - 0.5, z.pull * dt); vs[k].x += (z.x - vs[k].x) / vd * pl; vs[k].y += (z.y - vs[k].y) / vd * pl; }
        }
      }
      if (z.next <= 1e-9 && z.t > 1e-9) {
        var who = z.m || { atk: z.atk, em: z.em, tm: z.tm, reactMul: z.reactMul };
        if (z.kind === 'field') {
          var in_ = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < in_.length; k++) { hitFoe(S, in_[k], who, z.atk * FIELD_MUL(), z.el, 'zone'); }
          push(S, { t: 'zone', kind: 'field', el: z.el, x: z.x, y: z.y, r: z.r, n: in_.length });
          z.next += 1;
        } else if (z.kind === 'kitzone') {
          /* ⑲-11 팔괘진 — 안의 가까운 적 n 을 치고, 맞힐 때마다 명단 기력 */
          var kz = foesWithin(S, z.x, z.y, z.r).sort(function (a, b) { return Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y); }).slice(0, z.n);
          for (k = 0; k < kz.length; k++) { hitFoe(S, kz[k], who, z.atk * z.mul, z.el, 'zone'); }
          for (k = 0; k < S.party.length && kz.length && z.energy; k++) {
            var pk = S.party[k];
            if (!pk.down) { pk.energy = Math.min(ENERGY_MAX(), pk.energy + z.energy * kz.length * (pk.er || 1)); }
          }
          push(S, { t: 'zone', kind: 'kitzone', el: z.el, x: z.x, y: z.y, r: z.r, n: kz.length });
          z.next += z.every;
        } else if (z.kind === 'feast') {
          /* ⑲-17 바람 자리 — 안에 선 지금 인물 회복(지난 걸음의 내 자리), 안의 적을 친다 */
          var fa = active(S), fin = Math.hypot(S.mx - z.x, S.my - z.y) <= z.r;
          if (fa && !fa.down && fin) { fa.hp = Math.min(fa.hpMax, fa.hp + Math.round(fa.hpMax * z.heal)); }
          var fz = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < fz.length; k++) { hitFoe(S, fz[k], who, z.atk * z.mul, z.el, 'zone'); }
          push(S, { t: 'zone', kind: 'feast', el: z.el, x: z.x, y: z.y, r: z.r, n: fz.length, heal: fin ? 1 : 0 });
          z.next += z.every;
        } else if (z.kind === 'vortex') {
          var vz = foesWithin(S, z.x, z.y, z.r);
          for (k = 0; k < vz.length; k++) { hitFoe(S, vz[k], who, z.atk * z.mul, z.el, 'zone'); }
          push(S, { t: 'zone', kind: 'vortex', el: z.el, x: z.x, y: z.y, r: z.r, n: vz.length });
          z.next += z.every;
        } else {
          var tg = nearestFoe(S, z.x, z.y, z.r);
          if (tg) {
            hitFoe(S, tg, who, z.atk * SUMMON_MUL(), z.el, 'zone');
            push(S, { t: 'zone', kind: 'summon', el: z.el, x: z.x, y: z.y, tx: tg.x, ty: tg.y, r: 1.2, n: 1 });
          }
          z.next += SUMMON_EVERY();
        }
      }
      if (z.t <= 1e-9) { Z.splice(i, 1); }
    }
  }

  /** 원소 해방 — 기력 60 을 다 쓴다. 내 둘레 7m, 1초 무적 */
  function burst(S, px, py) {
    var m = active(S);
    if (!m || m.down || m.energy < ENERGY_MAX() || m.burstCd > 0) { return { ok: false }; }
    m.energy = 0; m.burstCd = BURST_CD();
    S.iframe = Math.max(S.iframe, 1.0);
    if (m.c6 && global.DG.talent) { m.c6T = global.DG.talent.C6_SEC; }   // ⑲-4 깨달음 5 — 해방 뒤 공격 +20%
    if (m.kitB) { return kitBurst(S, m, px, py); }                    // ⑲-11 고유·갈래
    var hits = foesWithin(S, px, py, BURST_R());
    for (var i = 0; i < hits.length; i++) { hitFoe(S, hits[i], m, m.atk * BURST_MUL(), m.el, 'burst'); }
    push(S, { t: 'burst', el: m.el, x: px, y: py, r: BURST_R(), n: hits.length });
    return { ok: true, n: hits.length };
  }

  /** 회피 — 스태미나 20, 0.35초 무적, 3.6m 미끄러진다. 방향이 없으면 가장 가까운 적 반대로 */
  function dodge(S, dx, dy, px, py) {
    var dc = DODGE_COST() * staSave();
    if (S.stamina < dc || allDown(S)) { return { ok: false }; }
    if (dx || dy) { S.lastDx = dx; S.lastDy = dy; }
    if (!dx && !dy) {
      var n = nearestFoe(S, px || 0, py || 0, 30);
      if (n) { dx = (px || 0) - n.x; dy = (py || 0) - n.y; } else { dy = 1; }
    }
    var len = Math.hypot(dx, dy) || 1;
    S.stamina -= dc; S.staT = 0;
    S.iframe = Math.max(S.iframe, DODGE_IFRAME());
    S.dash = { vx: dx / len * DASH_M() / DASH_T(), vy: dy / len * DASH_M() / DASH_T(), t: DASH_T() };
    push(S, { t: 'dodge' });
    return { ok: true };
  }

  /** 교체 — 1초 쿨. 쓰러진 사람에게는 못 바꾼다 */
  function swap(S, idx) {
    var m = S.party[idx];
    if (!m || idx === S.active || m.down || S.swapCd > 0) { return { ok: false }; }
    S.active = idx; S.swapCd = SWAP_CD(); S.combo = 0;
    push(S, { t: 'swap', idx: idx, id: m.id, el: m.el });
    return { ok: true };
  }

  function hurt(S, f, mul) {
    var m = active(S);
    if (!m || m.down) { return; }
    var dmg = Math.max(1, Math.round(f.atk * (mul || 1) * (1 - m.def / (m.def + 300))));   // mul — ⑲-14 공격 차례의 한 수 배수
    if (S.wardT > 0) { dmg = Math.max(1, Math.round(dmg * S.wardMul)); }   // ⑲-11 맹세·오천의 맹세
    var rockX = f.el === 'rock' ? Math.round(dmg * 0.3) : 0;   // ⑲-1 짓눌림 — 이것만으로는 안 쓰러진다
    S.calmT = 0;
    /* ⑲-1 결정 보호막이 먼저 막는다 — 다 막으면 원소 효과도 없다 */
    var G = S.guard, absorbed = 0;
    if (G && G.hp > 0) {
      absorbed = Math.min(G.hp, dmg + rockX);
      G.hp -= absorbed;
      var fromBase = Math.min(dmg, absorbed);
      dmg -= fromBase; rockX -= absorbed - fromBase;
      if (G.hp <= 0) { S.guard = null; }
    }
    if (dmg <= 0 && rockX <= 0) {
      push(S, { t: 'hurt', uid: f.uid, dmg: 0, el: f.el, id: m.id, guarded: absorbed });
      return;
    }
    m.hp -= dmg;
    if (rockX > 0 && m.hp > 0) { m.hp = Math.max(1, m.hp - rockX); }
    var tot = dmg + rockX;
    if (f.el === 'fire') { m.burn = { n: 3, t: 1, dmg: Math.max(1, Math.round(tot * 0.2)) }; }
    else if (f.el === 'water') { S.stamina = Math.max(0, S.stamina - 25); S.staT = 0; }
    else if (f.el === 'elec') { m.energy = Math.max(0, m.energy - 10); }
    else if (f.el === 'wind') { m.skillCd += 2; }                                   // 휘말림
    else if (f.el === 'ice') { S.staT = Math.min(S.staT, -2.2); }                   // 한기 — 스태미나 회복 3초 멈춤
    else if (f.el === 'grass') { m.burn = { n: 4, t: 1, dmg: Math.max(1, Math.round(tot * 0.15)), poison: true }; }   // 중독(화상 자리)
    push(S, { t: 'hurt', uid: f.uid, dmg: tot, el: f.el, id: m.id, guarded: absorbed });
    if (m.hp <= 0) { downMember(S, S.active); }
  }

  function downMember(S, idx) {
    var m = S.party[idx];
    m.hp = 0; m.down = true; m.burn = null;
    push(S, { t: 'down', idx: idx, id: m.id });
    if (idx === S.active && nextAlive(S)) {
      push(S, { t: 'swap', idx: S.active, id: S.party[S.active].id, el: S.party[S.active].el, forced: true });
    }
    if (allDown(S)) {
      /* 전멸 — 모두 30% 로 일어나고 붙어 있던 무리는 제자리로 돌아가 다시 찬다 */
      for (var i = 0; i < S.party.length; i++) {
        var p = S.party[i];
        p.down = false; p.hp = Math.round(p.hpMax * 0.3); p.burn = null;
      }
      S.active = 0;
      var L = living(S);
      for (var j = 0; j < L.length; j++) {
        if (L[j].st !== 'idle') { L[j].st = 'return'; L[j].mark = null; L[j].calmReturn = 3; }
      }
      S.calmT = 0;
      if (S.duel) { S.duel.wiped = true; }
      S.guard = null;
      push(S, { t: 'wipe' });
    }
  }

  /**
   * 한 걸음. inp = { px, py, blocked }. blocked 면(조우 창·시트) 적이 제자리에 멎는다.
   * 쌓인 사건은 S.ev 로 남는다 — 부른 쪽이 비운다(`drain`).
   */
  function step(S, dt, inp) {
    var px = inp.px, py = inp.py;
    S.mx = px; S.my = py;
    S.t += dt;
    S.calmT += dt;
    S.iframe = Math.max(0, S.iframe - dt);
    S.swapCd = Math.max(0, S.swapCd - dt);
    S.atkCd = Math.max(0, S.atkCd - dt);
    if (S.aim) {                                                    // ⑲-22 조준 — 활 아닌 인물·쓰러짐·대화면 풀린다
      if (!canAim(S) || inp.blocked) { aimEnd(S); }
      else { if (S.aim.hold) { S.aim.t = Math.min(AIM_FULL() + 1, S.aim.t + dt); } aimLock(S, px, py); }
    }
    stepArrows(S, dt);
    S.comboT += dt;
    if (S.comboT > 1.0) { S.combo = 0; }
    S.staT += dt;
    if (S.staT > 0.8) { S.stamina = Math.min(STA_MAX(), S.stamina + 30 * dt); }
    if (S.dash) {
      var dd = Math.min(dt, S.dash.t);
      push(S, { t: 'move', dx: S.dash.vx * dd, dy: S.dash.vy * dd });
      S.dash.t -= dd;
      if (S.dash.t <= 1e-6) { S.dash = null; }
    }
    if (S.zones && S.zones.length) { stepZones(S, dt); }
    if (S.guard) { S.guard.t -= dt; if (S.guard.t <= 0 || S.guard.hp <= 0) { S.guard = null; } }
    if (S.rallyT > 0) { S.rallyT = Math.max(0, S.rallyT - dt); }
    if (S.loreT > 0) { S.loreT = Math.max(0, S.loreT - dt); }
    if (S.rainT > 0) { S.rainT = Math.max(0, S.rainT - dt); }       // ⑲-17 뱃노래
    if (S.rainCd > 0) { S.rainCd = Math.max(0, S.rainCd - dt); }
    if (S.wardT > 0) { S.wardT = Math.max(0, S.wardT - dt); }
    if (S.hasteT > 0) { S.hasteT = Math.max(0, S.hasteT - dt); }
    var i, m;
    for (i = 0; i < S.party.length; i++) {
      m = S.party[i];
      m.skillCd = Math.max(0, m.skillCd - dt * (S.hasteT > 0 ? 2 : 1));   // ⑲-11 천기 뇌우 — 두 배로 돈다
      m.burstCd = Math.max(0, m.burstCd - dt);
      if (m.c6T > 0) { m.c6T = Math.max(0, m.c6T - dt); }
      if (m.infT > 0) { m.infT = Math.max(0, m.infT - dt); }
      if (m.burn && !m.down) {
        m.burn.t -= dt;
        if (m.burn.t <= 0) {
          m.burn.t += 1; m.burn.n--;
          m.hp = Math.max(1, m.hp - m.burn.dmg);   // 화상만으로는 안 쓰러진다
          push(S, { t: 'burn', idx: i, dmg: m.burn.dmg });
          if (m.burn.n <= 0) { m.burn = null; }
        }
      }
      if (!m.down && S.calmT > CALM_REGEN()) { m.hp = Math.min(m.hpMax, m.hp + m.hpMax * 0.04 * dt); }
      if (m.down && S.calmT > REVIVE_CALM()) { m.down = false; m.hp = Math.round(m.hpMax * 0.3); push(S, { t: 'revive', idx: i }); }
    }

    var ids = Object.keys(S.foes);
    for (var n = 0; n < ids.length; n++) {
      var f = S.foes[ids[n]];
      if (!f) { continue; }
      if (f.dead) {
        f.deadT += dt;
        if (f.deadT > 1.2) { delete S.foes[ids[n]]; }
        continue;
      }
      f.moving = false;
      if (f.kb) {                                         // ⑲-17 밀려남 — 멎어 있어도 미끄러진다
        var kbt = Math.min(dt, f.kb.t);
        f.x += f.kb.vx * kbt; f.y += f.kb.vy * kbt; f.kb.t -= dt;
        if (f.kb.t <= 1e-9) { f.kb = null; }
      }
      if (f.sky) { var SKc = global.DG.skyIsle; if (SKc && SKc.clampIn) { SKc.clampIn(f); } }   // ⑲-20 섬 무리는 난간을 못 넘는다
      if (f.auraT > 0) { f.auraT -= dt; if (f.auraT <= 0) { f.aura = null; } }
      if (f.shockN > 0) {
        f.shockT -= dt;
        if (f.shockT <= 0) {
          f.shockT += 1; f.shockN--;
          var sd = rawHit(S, f, f.shockDmg);
          push(S, { t: 'dot', uid: f.uid, x: f.x, y: f.y, dmg: sd, el: 'elec' });
          if (f.dead) { continue; }
        }
      }
      if (f.physT > 0) { f.physT -= dt; }
      if (f.markT > 0) { f.markT -= dt; }                 // ⑲-15 표식
      if (f.quickT > 0) { f.quickT -= dt; }
      if (f.burnN > 0) {                                  // ⑲-1 들불 — 0.5초마다 여덟 번
        f.burnT -= dt;
        if (f.burnT <= 0) {
          f.burnT += BURN_EVERY(); f.burnN--;
          var bd = rawHit(S, f, f.burnDmg);
          push(S, { t: 'dot', uid: f.uid, x: f.x, y: f.y, dmg: bd, el: 'fire' });
          if (f.dead) { continue; }
        }
      }
      if (inp.blocked) { continue; }
      if (f.frozenT > 0) { f.frozenT -= dt; continue; }   // ⑲-1 얼어붙음 — 꼼짝 못 한다
      if (f.stun > 0) { f.stun -= dt; continue; }
      var F = FOES[f.kind];
      /* ⑲-20 층이 갈리면(내가 섬에서 뛰어내렸다) 쫓던 적은 제자리로 — 나를 못 본다 */
      var far = apart(f);
      if (far && (f.st === 'chase' || f.st === 'wind' || f.st === 'recover')) { f.st = 'return'; f.mark = null; }
      var d = far ? Infinity : Math.hypot(f.x - px, f.y - py);
      var home = Math.hypot(f.x - f.hx, f.y - f.hy);
      if (f.st !== 'return' && f.st !== 'idle' && home > LEASH_R()) { f.st = 'return'; f.mark = null; }
      if (f.st === 'idle') {
        f.wa += dt * 0.35;
        var tx = f.hx + Math.cos(f.wa) * 2.2, ty = f.hy + Math.sin(f.wa * 0.8) * 2.2;
        moveToward(f, tx, ty, 1.1 * dt);
        if ((d < AGGRO_R() || f.siege) && !allDown(S)) { f.st = 'chase'; push(S, { t: 'aggro', uid: f.uid, camp: f.camp }); }
      } else if (f.st === 'return') {
        f.calmReturn = Math.max(0, f.calmReturn - dt);
        moveToward(f, f.hx, f.hy, F.spd * 1.2 * dt);
        if (Math.hypot(f.x - f.hx, f.y - f.hy) < 0.6) {
          f.st = 'idle'; f.hp = f.hpMax; f.shield = f.shieldMax; f.aura = null; f.shockN = 0;
          f.frozenT = 0; f.physT = 0; f.quickT = 0; f.burnN = 0;
          f.layer = 0; f.shEl = (f.layers && f.layers[0]) || f.shEl;
        }
      } else if (f.st === 'chase') {
        S.calmT = Math.min(S.calmT, 0);
        /* ⑲-14 공격 차례(rot)가 있으면 이번 수의 reach·wind·r 을 쓴다 */
        var AT = F.rot ? F.rot[(f.rotI || 0) % F.rot.length] : F.type, RT = F.rot ? ROT[AT] : F;
        var want = AT === 'shadow' ? 0 : (AT === 'spit' ? RT.reach * 0.85 : RT.reach * 0.8);
        /* ⑲-16 지킬 것 — 내가 SIEGE_PULL 밖이면 제단이 과녁(제단 몸 둘레만큼 덜 다가간다) */
        var sg = f.siege && d > SIEGE_PULL ? f.siege : null;
        var gx = sg ? sg.x : px, gy = sg ? sg.y : py, gd = (sg ? Math.max(0, Math.hypot(f.x - gx, f.y - gy) - SIEGE_BODY) : d) - (AT === 'shadow' ? 0 : BODY(f));
        if (gd > want && AT !== 'shadow') { moveToward(f, gx, gy, F.spd * dt); }
        f.cd -= dt;
        if (gd <= RT.reach && f.cd <= 0 && !allDown(S)) {
          f.st = 'wind'; f.stT = RT.wind; f.atkT = AT; f.atkSiege = !!sg;
          if (AT === 'shadow') {
            /* 나를 지나 등 뒤로 — 오던 쪽의 반대편 SHADOW_BACK m 에 붙어 제 둘레를 친다 */
            var sdx = px - f.x, sdy = py - f.y, sdl = Math.hypot(sdx, sdy) || 1;
            f.x = px + sdx / sdl * SHADOW_BACK; f.y = py + sdy / sdl * SHADOW_BACK;
            push(S, { t: 'blink', uid: f.uid, x: f.x, y: f.y });
          }
          if (AT === 'tide' || AT === 'rift') {
            var tl = tideMarks(f.x, f.y, gx, gy, AT);
            f.mark = { x: tl[0].x, y: tl[0].y, r: RT.r, t: RT.wind, list: tl };
          } else {
            f.mark = AT === 'spit' ? { x: gx, y: gy, r: RT.r, t: RT.wind }
              : (AT === 'halo' ? { x: f.x, y: f.y, r: RT.r, inner: RT.inner, t: RT.wind }
                : (AT === 'slam' || AT === 'shadow' ? { x: f.x, y: f.y, r: RT.r, t: RT.wind } : null));
          }
          push(S, { t: 'tell', uid: f.uid, type: AT === 'shadow' || AT === 'tide' || AT === 'halo' || AT === 'rift' ? 'slam' : AT, x: f.x, y: f.y });
        }
      } else if (f.st === 'wind') {
        S.calmT = Math.min(S.calmT, 0);
        f.stT -= dt;
        if (f.stT <= 0) {
          var WT = f.atkT || F.type, WR = F.rot ? ROT[WT] : F;
          /* ⑲-16 제단을 노린 코앞 한 대는 나를 안 친다(원 예고는 누구든 맞는다) */
          var inHit = f.mark ? markHit(f.mark, px, py, 0) : (!f.atkSiege && d - BODY(f) <= WR.reach + 0.6);
          if (inHit && S.iframe <= 0) { hurt(S, f, WR.mul); }
          else if (inHit) { push(S, { t: 'evade', uid: f.uid }); }
          if (f.atkSiege && f.siege) {
            var sx = f.siege.x, sy = f.siege.y;
            if (f.mark ? markHit(f.mark, sx, sy, SIEGE_BODY) : Math.hypot(f.x - sx, f.y - sy) <= WR.reach + 0.6 + SIEGE_BODY) {
              push(S, { t: 'siege', uid: f.uid, camp: f.camp, x: sx, y: sy, dmg: Math.max(1, Math.round(f.atk * (WR.mul || 1))) });
            }
          }
          f.atkSiege = false;
          var SL = f.mark && f.mark.list ? f.mark.list : [f.mark || f];
          for (var si = 0; si < SL.length; si++) {
            push(S, { t: 'strike', uid: f.uid, type: WT === 'shadow' || WT === 'tide' || WT === 'halo' || WT === 'rift' ? 'slam' : WT, x: SL[si].x, y: SL[si].y, r: f.mark ? f.mark.r : 0 });
          }
          /* ⑲-30 틈새 질주 — 틈으로 사라져 줄 끝에 나타난다(땅 높이가 크게 다르면 제자리) */
          if (WT === 'rift' && f.mark && f.mark.list) {
            var rEnd = f.mark.list[f.mark.list.length - 1];
            if (riftOk(f.x, f.y, rEnd.x, rEnd.y)) { f.x = rEnd.x; f.y = rEnd.y; push(S, { t: 'blink', uid: f.uid, x: f.x, y: f.y }); }
          }
          if (F.rot) { f.rotI = ((f.rotI || 0) + 1) % F.rot.length; }
          f.mark = null; f.cd = F.cd * (f.cdMul || 1);          // ⑲-9 주간 보스 2단계는 cdMul 로 빨라진다
          /* 이 한 대로 전멸했으면 downMember 가 이미 'return' 으로 돌려놨다 — 덮지 않는다 */
          if (f.st === 'wind') { f.st = 'recover'; f.stT = 0.5; }
        }
      } else if (f.st === 'recover') {
        f.stT -= dt;
        if (f.stT <= 0) { f.st = 'chase'; }
      }
      if (f.moving) { f.phase += dt * 9; }
    }
    if (!inp.blocked) { separate(S, dt); }
    duelCheck(S, dt);
    return S;
  }

  /** 적끼리 밀어내기(2026-09-28 실기 Q6 "난리") — 모두 같은 자리(내 코앞)로 몰려 몸 5~8m 짜리가 한 덩이로 겹쳤다.
      두 몸 반지름 합 × SEP_K 보다 가까우면 반씩 비킨다(한 프레임에 다 안 밀고 dt × 8 만큼 — 튀지 않게) */
  function SEP_K() { return K('sepK', 1.0); }
  function separate(S, dt) {
    var L = living(S), n = L.length, i, j, k = SEP_K();
    if (!k || n < 2) { return; }
    var rate = Math.min(1, dt * 8);
    for (i = 0; i < n; i++) {
      var a = L[i], ba = BODY(a);
      for (j = i + 1; j < n; j++) {
        var b = L[j], want = (ba + BODY(b)) * k, dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > want || Math.abs(dy) > want) { continue; }
        var d = Math.hypot(dx, dy);
        if (d >= want) { continue; }
        if (d < 1e-3) { dx = (a.uid % 2 ? 1 : -1); dy = 0.3; d = Math.hypot(dx, dy); }   // 한 점이면 번호로 갈라 비킨다
        var push = (want - d) / 2 * rate, ux = dx / d, uy = dy / d;
        var fa = a.frozenT > 0 ? 0 : 1, fb = b.frozenT > 0 ? 0 : 1;                  // 얼어붙은 적은 제자리 — 상대가 다 비킨다
        if (!fa && !fb) { continue; }
        var sa = fa && fb ? 1 : (fa ? 2 : 0), sb = fa && fb ? 1 : (fb ? 2 : 0);
        a.x -= ux * push * sa; a.y -= uy * push * sa;
        b.x += ux * push * sb; b.y += uy * push * sb;
      }
    }
  }

  function moveToward(f, tx, ty, stepM) {
    var dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    if (d < 1e-3) { return; }
    var s = Math.min(d, stepM);
    f.x += dx / d * s; f.y += dy / d * s;
    f.moving = s > 0.004;
  }

  function drain(S) { var e = S.ev; S.ev = []; return e; }

  /** 지금 싸우는 중인가 — 쫓거나 예고 중인 적이 있거나, 방금 때리고 맞았다 */
  function engaged(S) {
    if (!S) { return false; }
    if (S.calmT < 3) { return true; }
    var L = living(S);
    for (var i = 0; i < L.length; i++) { if (L[i].st === 'chase' || L[i].st === 'wind' || L[i].st === 'recover') { return true; } }
    return false;
  }

  /**
   * ⑲-18 편성을 막는 "싸우는 중" — 방금(COMBAT_CALM 초 안) 때리거나 맞았거나, COMBAT_R m 안에 나를 쫓거나 치는 적.
   * 쉬는 적·제단만 치는 적(siege 로 나를 안 보는 적)은 뺀다. engaged 보다 좁다(멀리서 쫓는 적은 안 친다)
   */
  var COMBAT_R = 30, COMBAT_CALM = 3;
  function inCombat(S, px, py) {
    if (!S) { return false; }
    if (S.calmT < COMBAT_CALM) { return true; }
    var L = living(S);
    for (var i = 0; i < L.length; i++) {
      var f = L[i], d = Math.hypot(f.x - px, f.y - py);
      if (d > COMBAT_R || (f.st !== 'chase' && f.st !== 'wind' && f.st !== 'recover')) { continue; }
      if (f.siege && d > SIEGE_PULL) { continue; }
      return true;
    }
    return false;
  }

  /* ══ 런타임 — 세이브·화면·입력 ═══════════════════════════ */
  var S = null, partyKey = '', popAcc = 9, refAcc = 0, bound = false, hudEl = null;
  var numLayer = null, fx = { marks: {}, rings: [] };
  var lastAuto = 0;

  function RESPAWN_MS() { return K('respawnMin', 15) * 60000; }
  function fieldSave() {
    var s = core().save;
    if (!s.field || typeof s.field !== 'object') { s.field = { camps: {}, kills: 0, clears: 0 }; }
    if (!s.field.camps) { s.field.camps = {}; }
    if (!s.field.guards || typeof s.field.guards !== 'object') { s.field.guards = {}; }   // ⑪ 지역키 → 마지막 토벌 시각(사명 평정은 있기만 보면 된다)
    if (!s.field.guardPaid || typeof s.field.guardPaid !== 'object') { s.field.guardPaid = {}; }   // ⑲-10 지역키 → 꽃을 받은 시각(150초 뒤 다시 선다)
    return s.field;
  }
  /** ⑲-10 이 수호자가 다시 섰나 — 꽃을 받고 150초가 지났으면. **순수 함수**(fs 를 읽기만) */
  function guardBack(fs, rk, now) {
    var at = fs.guardPaid && fs.guardPaid[rk];
    return !!at && now - at >= K('guardBackSec', 150) * 1000;
  }
  function pkey() { return (core().save.party || []).slice(0, PARTY_MAX()).join(','); }

  function ensureState() {
    var k = pkey();
    if (!S) {
      S = create(core().save.party);
      partyKey = k;
      var fs = fieldSave(), now = Date.now();
      for (var c in fs.camps) {
        if (fs.camps.hasOwnProperty(c) && now - fs.camps[c] < RESPAWN_MS()) { S.cleared[c] = true; }
      }
      for (var g in fs.guards) { if (fs.guards.hasOwnProperty(g) && !guardBack(fs, g, now)) { S.cleared['g:' + g] = true; } }
    } else if (k !== partyKey) {
      reparty(S, core().save.party);
      partyKey = k;
    }
    return S;
  }

  /** 레벨·장비가 바뀌면 공격력·최대 체력을 다시 읽는다(체력 비율은 그대로) */
  function refreshStats() {
    for (var i = 0; i < S.party.length; i++) {
      var m = S.party[i], f = memberOf(m.id);
      var ratio = m.hpMax ? m.hp / m.hpMax : 1;
      m.atk = f.atk; m.em = f.em; m.def = f.def; m.hpMax = f.hpMax;
      m.tm = f.tm; m.con = f.con; m.cdMul = f.cdMul; m.reactMul = f.reactMul; m.c6 = f.c6;
      m.kitS = f.kitS; m.kitB = f.kitB; m.kitL = f.kitL;
      m.wtype = f.wtype; m.kit = f.kit; m.wid = f.wid; m.cr = f.cr; m.cdm = f.cdm; m.er = f.er;
      m.dmgB = f.dmgB; m.elemB = f.elemB; m.rxAll = f.rxAll; m.rx = f.rx;
      m.hp = Math.round(f.hpMax * ratio);
    }
  }

  function blocked() {
    var D = global.DG;
    return !!((D.encounter && D.encounter.active) || (D.rogue && D.rogue.active) ||
      (D.duel && D.duel.active) || (D.rogueAction && D.rogueAction.active) ||
      (D.story && D.story.talking && D.story.talking()) ||                     // ⑲-12 이야기 대화 창
      (D.fishing && D.fishing.active) ||                                       // ⑲-24 낚시 중(F·스페이스는 낚시가 쓴다)
      (document.body && document.body.classList.contains('sheet-open')));
  }

  function terrFn() {
    var W = global.DG.world;
    return W && W.terrainAt ? function (tx, ty) { try { return W.terrainAt(tx, ty); } catch (e) { return null; } } : null;
  }

  /** 자동 전투 — 🤖 자동 전투를 켰거나, 자동 순행 중이면(AI 가 걷는데 싸움만 사람에게 맡길 수는 없다) */
  function autoOn() {
    var sv = core().save, st = sv.settings;
    return !!((st && st.autoBattle) || (sv.auto && sv.auto.on));
  }

  /** 자동 회피(2026-09-28 실기 Q6) — 🤖 는 예고(붉은 원·코앞 휘두름)를 하나도 안 피해 혼자면 보통 무리에도 거의 쓰러졌다.
      나를 칠 공격이 막 떨어지려 할 때(무적 시간 안) 기력이 있으면 그 자리에서 비켜 난다. 매 프레임 본다 */
  function autoThreat(S, px, py) {
    var L = living(S), i;
    for (i = 0; i < L.length; i++) {
      var f = L[i];
      if (f.st !== 'wind' || f.stT > DODGE_IFRAME() * 0.7) { continue; }
      var F = FOES[f.kind], WT = f.atkT || F.type, WR = F.rot ? ROT[WT] : F;
      if (f.mark ? markHit(f.mark, px, py, 0) : (!f.atkSiege && Math.hypot(f.x - px, f.y - py) - BODY(f) <= WR.reach + 0.6)) { return f; }
    }
    return null;
  }
  function autoDodge(pos) {
    if (S.iframe > 0 || S.dash || !K('autoDodge', 1)) { return false; }
    var f = autoThreat(S, pos.x, pos.y);
    if (!f) { return false; }
    var c = f.mark ? (f.mark.list ? f.mark.list[0] : f.mark) : f;
    var dx = pos.x - c.x, dy = pos.y - c.y;
    if (Math.hypot(dx, dy) < 0.3) { dx = pos.x - f.x; dy = pos.y - f.y; }        // 내 발밑에 떨어지는 침 — 쏜 적 반대쪽으로
    /* 곧장 뒤로만 비키면 한 번에 3.6m 씩 밀려나 적의 추격 한계를 벗어나고, 적이 제자리로 돌아가 방패를 다시 채웠다(09-28 수호자 무한 반복).
       옆으로 돌며 비킨다(좌우는 번갈아) — 원 예고도 대시 3.6m 면 벗어난다 */
    var dl0 = Math.hypot(dx, dy) || 1, side = (S.dodgeSide = -(S.dodgeSide || 1));
    dx /= dl0; dy /= dl0;
    var sx = -dy * side, sy = dx * side;
    dx = sx * 0.85 + dx * 0.5; dy = sy * 0.85 + dy * 0.5;
    var r = dodge(S, dx, dy, pos.x, pos.y);
    if (r.ok) { handle(drain(S), pos); }
    return r.ok;
  }

  function autoFight(pos) {
    var m = active(S);
    if (!m || m.down) { return; }
    var n = nearestFoe(S, pos.x, pos.y, SKILL_AIM());
    if (!n) { return; }
    if (m.energy >= ENERGY_MAX() && foesWithin(S, pos.x, pos.y, BURST_R()).length >= 2) { act('burst'); return; }
    if (m.skillCd <= 0) { act('skill'); return; }
    /* ⑲-2 얼어 있는 적이 곁에 있으면 강공격으로 깬다 */
    if (n.frozenT > 0 && S.stamina >= CHARGE_COST() && Math.hypot(n.x - pos.x, n.y - pos.y) <= CHARGE_REACH()) { act('heavy'); return; }
    if (Math.hypot(n.x - pos.x, n.y - pos.y) <= LUNGE_R()) { act('attack'); }
  }

  function tick(dt) {
    if (!on() || !core() || !core().save) { hide(); return; }
    ensureState();
    var pos = core().save.player.pos;
    popAcc += dt; refAcc += dt;
    if (popAcc > 0.5) {
      popAcc = 0;
      respawnSweep();                          // 다시 설 무리를 먼저 풀고 세운다(⑲-10 수호자가 한 박자 늦던 것)
      var BM = global.DG.biome;
      populate(S, pos.x, pos.y, terrFn(), K('activeR', 200), BM && BM.on() ? BM.biomeAt : null,
        BM && BM.on() && BM.landmarks && K('guards', 1) ? BM.landmarks : null,
        BM && BM.on() && BM.zoneAt && K('eras', 1) ? BM.zoneAt : null,
        global.DG.treasure && global.DG.treasure.on() ? global.DG.treasure.campsNear : null);
    }
    if (refAcc > 2) { refAcc = 0; refreshStats(); }
    var bl = blocked();
    /* 걷는 쪽을 바라본다 — 적이 없을 때 스킬·돌진이 나가는 쪽. 전엔 마지막으로 회피한 쪽(없으면 남쪽)으로만 나갔다(2026-09-28) */
    var Wm = global.DG.world, mv = Wm && Wm.motion;
    if (mv && mv.speed > 1.5 && (mv.vx || mv.vy)) { S.lastDx = mv.vx; S.lastDy = mv.vy; }
    step(S, dt, { px: pos.x, py: pos.y, blocked: bl });
    if (!bl && autoOn() && engaged(S)) {
      lastAuto += dt;
      /* 2026-09-28 실기 Q6 "너무 오래 걸림" — 0.3초마다만 눌러 칼 3타(0.34초 박자)의 절반을 놓쳤다(초당 46 피해,
         손으로 연타하면 159). 공격 쿨이 풀리는 그 프레임에도 누른다 */
      if (!autoDodge(pos) && (lastAuto > 0.3 || S.atkCd <= 0)) { lastAuto = 0; autoFight(pos); }
    }
    handle(drain(S), pos);
    if (!global.DG_NO_DRAW) { paint(dt); }
  }

  function respawnSweep() {
    var fs = fieldSave(), now = Date.now();
    for (var c in S.cleared) {
      if (!S.cleared.hasOwnProperty(c)) { continue; }
      if (c.indexOf('g:') === 0) { if (guardBack(fs, c.slice(2), now)) { delete S.cleared[c]; } continue; }   // ⑲-10 꽃을 받고 150초면 다시 선다
      var at = fs.camps[c];
      if (!at || now - at >= RESPAWN_MS()) { delete S.cleared[c]; delete fs.camps[c]; }
    }
  }

  function toast(msg) { if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast(msg); } }
  function sfx(name) { if (global.DG.audio) { try { global.DG.audio.play(name); } catch (e) { /* 소리는 없어도 된다 */ } } }
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }

  function handle(ev, pos) {
    var c = core(), H = global.DG.hero, i;
    for (i = 0; i < ev.length; i++) {
      var e = ev[i];
      /* ⑲-3 원소 신호 — 스킬·폭발·장판 자리를 알린다(treasure.js 가 석등을 켠다) */
      if ((e.t === 'skill' || e.t === 'burst' || e.t === 'arrow' || (e.t === 'zone' && (e.kind === 'field' || e.kind === 'shell' || e.kind === 'kitzone' || e.kind === 'vortex' || e.kind === 'feast'))) && e.el) {
        /* 돌진·찌르기는 지나간 선(x0,y0 → x,y) 전체가 닿는다 — 끝점만 알리면 제단을 가로질러도 안 켜졌다(2026-09-28) */
        c.emit('field:element', { el: e.el, x: e.x, y: e.y, r: e.r || 3, t: e.t, x0: e.x0, y0: e.y0 });
      }
      if (e.t === 'move') {
        pos.x += e.dx; pos.y += e.dy;
        /* 떠 있는 섬 위면 회피·돌진도 난간 안에서 멈춘다 — 전엔 밀려 떨어져 섬 위 무리와 층이 갈려 싸움이 안 끝났다(2026-09-28, ⑲-49) */
        var LFm = global.DG.landform, SKm = global.DG.skyIsle;
        if (LFm && LFm.onSky && LFm.onSky() && SKm && SKm.clampIn) { SKm.clampIn(pos); }
      }
      else if (e.t === 'weak') { floatNum(e.x, e.y, '급소!', null, 1.35, true); c.emit('field:weak', {}); }   // ⑲-25 업적이 센다
      else if (e.t === 'shoot') { sfx('hit'); }
      else if (e.t === 'arrow') { ring(e.x, e.y, e.el ? 1.2 : 0.6, e.el && EL[e.el] ? EL[e.el].color : '#e8e2d0', 0.3); }
      else if (e.t === 'hit') {
        sfx('hit');
        floatNum(e.x, e.y, e.immune ? '면역' : String(e.dmg) + (e.crit ? '!' : ''), e.el, (e.react ? 1.3 : (e.src === 'burst' ? 1.25 : 1)) * (e.crit ? 1.25 : 1), !!e.crit);
        var w = W3();
        if (w) {
          w.playAnim('fc' + e.uid, 'hit', 260);
          if (e.src === 'burst') { w.shake(0.5); w.hold(90); } else if (e.react) { w.shake(0.3); w.hold(60); } else { w.shake(0.12); }
        }
      } else if (e.t === 'react') {
        var RI = REACT[e.kind] || { el: 'fire', r: 2 };
        floatNum(e.x, e.y, e.name + '!', RI.el, 1.5, true);
        ring(e.x, e.y, RI.r || 1.8, e.kind === 'overload' ? '#ffb347' : EL[RI.el].color, 0.45);
        if (global.DG.daily) { global.DG.daily.progress('react'); }   // ⑲-8 일일 의뢰(깨뜨림·번개싹 포함)
        c.emit('field:react', { kind: e.kind });                       // ⑲-25 업적(반응·가짓수)
        if (e.kind === 'crystallize') { toast('🪨 굳힘 보호막 — 명단이 ' + (S.guard ? S.guard.hp : 0) + ' 만큼 막는다(15초)'); }
      } else if (e.t === 'dot') { floatNum(e.x, e.y, String(e.dmg), e.el || 'elec', 0.8); }
      else if (e.t === 'break') {
        floatNum(e.x, e.y, e.next ? '겉 방패 깨짐! ' + EL[e.next].icon + ' 속 방패' : '방패 깨짐!', null, 1.4, true);
        if (e.next) { toast('🛡️ 속 방패 ' + EL[e.next].icon + ' — ' + EL[COUNTER[e.next]].icon + ' 원소 동행으로 바꿔라'); }
        ring(e.x, e.y, 2.4, '#ffffff', 0.4);
        if (W3()) { W3().shake(0.45); W3().hold(100); }
      } else if (e.t === 'swing') {
        if (W3()) { W3().playAnim('me', 'attack', 280); }
        if (e.ranged && e.tx != null) { ring(e.tx, e.ty, 0.8, e.el && EL[e.el] ? EL[e.el].color : '#e8e2d0', 0.25); }   // ⑲-5 서책·활
      } else if (e.t === 'skill') {
        if (e.shape === 'thrust' || e.shape === 'dash') {
          /* 선 모양 — 길을 따라 작은 원을 늘어놓는다 */
          for (var si = 1; si <= 4; si++) {
            var sf = si / 4;
            ring(e.x0 + (e.x - e.x0) * sf, e.y0 + (e.y - e.y0) * sf, e.r * 0.8, EL[e.el].color, 0.35 + sf * 0.2);
          }
        } else {
          ring(e.x, e.y, e.r, EL[e.el].color, e.shape === 'field' ? 0.9 : 0.5);
        }
        if (e.name) { floatNum(pos.x, pos.y, EL[e.el].icon + ' ' + e.name, e.el, 0.95, true, true); }       // ⑲-11 고유·갈래
        else if (e.shape && e.shape !== 'circle') { floatNum(pos.x, pos.y, SHAPES[e.shape].icon + ' ' + SHAPES[e.shape].name, e.el, 0.9, true, true); }
        if (W3()) { W3().playAnim('me', 'attack', 380); }
      } else if (e.t === 'heavy') {
        ring(e.x, e.y, e.r, '#f4f1e2', 0.5);
        floatNum(pos.x, pos.y, '강공격', null, 1, true, true);
        if (W3()) { W3().playAnim('me', 'attack', 500); W3().shake(0.2); }
      } else if (e.t === 'tired') { floatNum(pos.x, pos.y, '기력 부족', null, 0.9, true, true); }
      else if (e.t === 'plunge') {
        ring(e.x, e.y, e.r, '#f4ecd0', 0.6); ring(e.x, e.y, e.r * 0.45, '#ffffff', 0.4);
        floatNum(pos.x, pos.y, '낙하 공격 ×' + e.mul.toFixed(1), null, 1.2, true, true);
        if (W3()) { W3().playAnim('me', 'attack', 420); W3().shake(0.45); W3().hold(90); }
        sfx('hit');
      } else if (e.t === 'burst') {
        ring(e.x, e.y, e.r, EL[e.el].color, 0.8);
        ring(e.x, e.y, e.r * 0.55, '#ffffff', 0.5);
        if (e.name) { floatNum(pos.x, pos.y, '💥 ' + e.name, e.el, 1.1, true, true); }
        sfx('thunder');
      } else if (e.t === 'zone') {
        if (e.kind === 'field' || e.kind === 'seed' || e.kind === 'kitzone' || e.kind === 'vortex' || e.kind === 'feast' || e.kind === 'rain') { ring(e.x, e.y, e.r, EL[e.el].color, e.kind === 'seed' ? 0.7 : 0.4); }
        else if (e.kind === 'shell') { ring(e.x, e.y, e.r, EL[e.el].color, 0.55); if (W3()) { W3().shake(0.15); } }
        else { ring(e.x, e.y, 0.9, EL[e.el].color, 0.3); ring(e.tx, e.ty, e.r, EL[e.el].color, 0.3); }
      } else if (e.t === 'dodge') { if (W3()) { W3().playAnim('me', 'dodge', 300); } }
      else if (e.t === 'tell') { if (W3()) { W3().playAnim('fc' + e.uid, 'attack', 700); } }
      else if (e.t === 'strike') { if (e.r) { ring(e.x, e.y, e.r, '#ff4d4d', 0.3); } }
      else if (e.t === 'siege') { floatNum(e.x, e.y + 1.5, '-' + e.dmg, null, 0.9, false); c.emit('field:siege', e); }   // ⑲-16 제단이 맞았다(story.js)
      else if (e.t === 'hurt' && !e.dmg) { floatNum(pos.x, pos.y, '🪨 막음', 'rock', 1, true, true); }
      else if (e.t === 'hurt') {
        floatNum(pos.x, pos.y, '-' + e.dmg, e.el, 1, false, true);
        if (W3()) { W3().playAnim('me', 'hit', 260); W3().shake(0.25); }
      } else if (e.t === 'evade') { floatNum(pos.x, pos.y, '회피!', null, 1.1, true, true); }
      else if (e.t === 'swap') {
        var sm = S.party[e.idx];
        if (e.forced) { toast('💫 ' + sm.name + ' 교대 — 앞사람이 쓰러졌다'); }
        ring(pos.x, pos.y, 1.6, EL[sm.el].color, 0.35);
      } else if (e.t === 'down') {
        var dm = S.party[e.idx];
        c.log('💫 ' + dm.name + ' 쓰러짐 (들판 전투)', 'battle');
      } else if (e.t === 'wipe') {
        var inDm = !!(global.DG.domain && global.DG.domain.active());      // ⑲-9 숨은 터 실패는 흘림 없음
        var D = global.DG.drop, lost = !inDm && D && D.lose ? D.lose() : null;
        c.emit('field:wipe', {});
        toast('🏳️ 모두 쓰러져 물러났다' + (lost ? ' — 금 ' + lost.gold + ' 을 흘렸다(되찾을 수 있다)' : ''));
        c.log('🏳️ 들판 전투 전멸 — 30% 로 일어났다', 'battle');
      } else if (e.t === 'yield') {
        floatNum(e.x, e.y, '🏳️ 굴복!', null, 1.6, true);
        ring(e.x, e.y, 3, '#f5b445', 0.7);
        if (W3()) { W3().shake(0.4); W3().hold(160); }
        sfx('reward');
      } else if (e.t === 'duelEnd') {
        var ENC = global.DG.encounter;
        if (ENC && ENC.duelResult) { ENC.duelResult(e.result, e.spawnUid, e.heroId); }
      } else if (e.t === 'kill' && (String(e.camp).indexOf('dm:') === 0 || String(e.camp).indexOf('sq:') === 0)) {
        /* ⑲-9 숨은 터 적 — 전리품·경험·무리 기록 없음(domain.js 가 파도·터 기운을 본다) */
        if (global.DG.daily) { global.DG.daily.progress('hunt'); }
        c.emit('field:kill', e);
      } else if (e.t === 'kill') {
        var gold = killGold(e.tier), exp = Math.round(6 * e.tier * FOES[e.kind].exp);
        c.save.player.gold = (c.save.player.gold || 0) + gold;
        if (c.gainExp) { c.gainExp(Math.max(1, Math.round(exp / 2))); }
        for (var j = 0; j < S.party.length; j++) {
          if (S.party[j].id !== '_me' && !S.party[j].down && H && H.gainExp) { H.gainExp(S.party[j].id, exp); }
        }
        if (e.elite || e.boss) { c.save.dust = (c.save.dust || 0) + (e.boss ? 6 : 2); }
        if (e.shield && global.DG.talent) {                       // ⑲-4 방패 두른 원소 괴물 — 무예 쪽지
          var tmTxt = global.DG.talent.onElite();
          if (global.DG.weapon) { global.DG.weapon.onElite(); }                  // ⑲-5 강화석 1
          if (global.DG.artifact) { tmTxt += ' · ' + global.DG.artifact.onElite(); }   // ⑲-5 보패 ★4
          if (tmTxt) { floatNum(e.x, e.y + 1.2, tmTxt, null, 0.9, false); }
        }
        if (global.DG.cooking) { var mt6 = global.DG.cooking.onKill(e.kind); if (mt6) { floatNum(e.x, e.y + 2.2, mt6, null, 0.85, false); } }   // ⑲-6 짐승 고기
        fieldSave().kills = (fieldSave().kills || 0) + 1;
        if (global.DG.daily) { global.DG.daily.progress('hunt'); }    // ⑲-8 일일 의뢰
        c.emit('field:kill', e);                                       // ⑲-25 업적(원소 괴물·큰 적) — 숨은 터 onKill 은 제 캠프만 본다
        floatNum(e.x, e.y, '+' + gold + '금', null, 0.9, false);
      } else if (e.t === 'clear' && (e.kind === 'domain' || e.kind === 'story')) {
        c.emit('field:clear', e);                                      // ⑲-9 숨은 터 파도 — 보상은 보상 나무에서
      } else if (e.t === 'clear' && e.kind === 'guard') {
        var gs = fieldSave(), rk = e.camp.slice(2), again = !!gs.guards[rk];
        gs.guards[rk] = Date.now();
        delete gs.guardPaid[rk];                                        // ⑲-10 보상 꽃이 다시 핀다(fieldboss.js)
        gs.clears = (gs.clears || 0) + 1;
        /* ⑲-10 다시 선 수호자는 토벌 금·단사·경험이 없다 — 보상은 꽃에서(원기 30) */
        var gl = again ? { gold: 0, dust: 0 } : clearLoot('guard', e.tier), gg = gl.gold, gd = gl.dust;
        c.save.player.gold = (c.save.player.gold || 0) + gg;
        c.save.dust = (c.save.dust || 0) + gd;
        if (c.gainExp && !again) { c.gainExp(30 * e.tier); }
        var BMg = global.DG.biome, pr = rk.split('_'), rc = BMg && BMg.cellAt ? BMg.cellAt(+pr[0], +pr[1]) : null;
        toast('🛡️ ' + (rc ? rc.name + ' ' : '') + '수호자 토벌!' + (again ? '' : ' 금 +' + gg + ' · 단사 +' + gd) + ' — 🌸 보상 꽃이 피었다');
        c.log('🛡️ 지역 수호자 토벌' + (rc ? ' — ' + rc.name : '') + ' (등급 ' + e.tier + ') — 금 +' + gg, 'battle');
        sfx('reward');
        c.emit('field:guard', { region: rk, tier: e.tier });
        c.persist();
      } else if (e.t === 'clear') {
        var fs = fieldSave();
        fs.camps[e.camp] = Date.now();
        fs.clears = (fs.clears || 0) + 1;
        var cl = clearLoot(e.kind, e.tier), bonus = cl.gold, cd = cl.dust;
        c.save.player.gold = (c.save.player.gold || 0) + bonus;
        c.save.dust = (c.save.dust || 0) + cd;
        var label = e.kind === 'boss' ? '우두머리' : (e.kind === 'elite' ? '정예 무리' : '무리');
        toast('⚔️ ' + label + ' 토벌! 금 +' + bonus + ' · 단사 +' + cd);
        c.log('⚔️ 들판 ' + label + ' 토벌 (등급 ' + e.tier + ') — 금 +' + bonus, 'battle');
        sfx('reward');
        c.emit('field:clear', e);
        c.persist();
      }
    }
  }

  /** 입력 한 번 — 버튼·키·자동이 다 이 길로 온다 */
  function act(kind, arg) {
    if (!S || blocked()) { return { ok: false }; }
    var pos = core().save.player.pos, r;
    if (kind === 'attack') {
      /* ⑲-2 활공 중(발밑 2.5m 넘게)이면 기본 공격 대신 내리꽂는다 — 착지는 landform 이 plungeLand 로 알린다 */
      var LF = global.DG.landform;
      if (LF && LF.startPlunge && LF.startPlunge()) { return { ok: true, plunge: true }; }
      if (S.aim) { aimHold(S); handle(drain(S), pos); return { ok: true, aim: true }; }   // ⑲-22 조준 중엔 누르는 동안 충전
      r = attack(S, pos.x, pos.y);
    } else if (kind === 'heavy') {
      /* ⑲-22 활 인물은 강공격 대신 조준·충전(떼면 쏘고 나온다) */
      if (S.aim) { r = { ok: true, aim: true }; }                     // 조준 중 길게 누름 = 충전(강공격 아님)
      else if (aimOk() && aimStart(S, pos.x, pos.y).ok) { S.aim.auto = true; aimHold(S); r = { ok: true, aim: true }; }
      else { r = heavy(S, pos.x, pos.y); }
    } else if (kind === 'aim') {
      r = S.aim ? { ok: aimEnd(S), off: true } : (aimOk() ? aimStart(S, pos.x, pos.y) : { ok: false });
    }
    else if (kind === 'skill') { r = skill(S, pos.x, pos.y); }
    else if (kind === 'burst') { r = burst(S, pos.x, pos.y); }
    else if (kind === 'dodge') {
      aimEnd(S);                                                    // ⑲-22 대시하면 조준이 풀린다
      var W = global.DG.world, mv = W && W.motion ? W.motion : null;
      var moving = mv && mv.speed > 1.5;
      r = dodge(S, moving ? mv.vx : 0, moving ? mv.vy : 0, pos.x, pos.y);
    } else if (kind === 'swap') { r = swap(S, arg); }
    handle(drain(S), pos);
    return r || { ok: false };
  }

  /* ── 화면: HUD ────────────────────────────────────────── */
  function hide() {
    if (hudEl) { hudEl.classList.remove('show'); }
    if (document.body) { document.body.classList.remove('fc-on'); }
  }

  function buildHud() {
    hudEl = document.getElementById('field-hud');
    if (!hudEl) {
      hudEl = document.createElement('div');
      hudEl.id = 'field-hud';
      document.body.appendChild(hudEl);
    }
    hudEl.innerHTML =
      '<div class="fc-party"></div>' +
      '<div class="fc-acts">' +
        '<div class="fc-sta"><i></i></div>' +
        '<button class="fc-btn fc-burst" data-fc="burst"><span>폭발</span><em>Q</em><i class="fc-fill"></i></button>' +
        '<button class="fc-btn fc-skill" data-fc="skill"><span>스킬</span><em>E</em><i class="fc-cd"></i></button>' +
        '<button class="fc-btn fc-dodge" data-fc="dodge"><span>회피</span><em>␣</em></button>' +
        '<button class="fc-btn fc-atk" data-fc="attack"><span>⚔️</span><em>J</em></button>' +
        '<button class="fc-btn fc-aim" data-fc="aim" style="display:none"><span>🎯</span><em>R</em></button>' +
      '</div>';
    var btns = hudEl.querySelectorAll('[data-fc]');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('pointerdown', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var k = b.getAttribute('data-fc'), r = act(k);
          if (k === 'attack' && !(r && r.plunge)) { holdStart(); }                // ⑲-2 누르고 있으면 강공격
        });
        if (b.getAttribute('data-fc') === 'attack') {
          ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { b.addEventListener(t, holdEnd); });
        }
      })(btns[i]);
    }
    numLayer = document.createElement('div');
    numLayer.className = 'fc-nums';
    hudEl.appendChild(numLayer);
    partyKeyPainted = '';
  }

  var partyKeyPainted = '';
  function paintParty() {
    var box = hudEl.querySelector('.fc-party');
    var key = S.party.map(function (m) { return m.id; }).join(',');
    if (key !== partyKeyPainted) {
      partyKeyPainted = key;
      var P3 = global.DG.portrait3d, html = '<div class="fc-guard"><i></i><b></b></div>';   // ⑲-1 결정 보호막 띠
      for (var i = 0; i < S.party.length; i++) {
        var m = S.party[i], h = m.id === '_me' ? null : data().find(m.id);
        var face = h && P3 && P3.img ? P3.img('hero', h, 40) : '<b>' + EL[m.el].icon + '</b>';
        html += '<button class="fc-mem" data-idx="' + i + '" style="--el:' + EL[m.el].color + '">' +
          '<span class="fc-face">' + face + '</span>' +
          '<span class="fc-meta"><small>' + (i + 1) + ' · ' + EL[m.el].icon + ' ' + m.name + '</small>' +
          '<span class="fc-hp"><i></i></span><span class="fc-en"><i></i></span></span></button>';
      }
      box.innerHTML = html;
      var mb = box.querySelectorAll('.fc-mem');
      for (var j = 0; j < mb.length; j++) {
        (function (b) {
          b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); act('swap', +b.getAttribute('data-idx')); });
        })(mb[j]);
      }
    }
    var gd = box.querySelector('.fc-guard');
    if (gd) {
      gd.classList.toggle('on', !!S.guard);
      if (S.guard) {
        gd.querySelector('i').style.width = Math.round(100 * S.guard.hp / S.guard.max) + '%';
        gd.querySelector('b').textContent = '🪨 ' + S.guard.hp + ' · ' + Math.ceil(S.guard.t) + '초';
      }
    }
    var rows = box.querySelectorAll('.fc-mem');
    for (var k = 0; k < rows.length; k++) {
      var mm = S.party[k];
      if (!mm) { continue; }
      rows[k].classList.toggle('on', k === S.active);
      rows[k].classList.toggle('down', mm.down);
      rows[k].querySelector('.fc-hp i').style.width = Math.round(100 * mm.hp / mm.hpMax) + '%';
      rows[k].querySelector('.fc-en i').style.width = Math.round(100 * mm.energy / ENERGY_MAX()) + '%';
    }
  }

  function paint(dt) {
    var pp = core().save.player.pos, TR = global.DG.treasure;
    var show = engaged(S) || !!nearestFoe(S, pp.x, pp.y, 22) || !!(TR && TR.wantsHud && TR.wantsHud(pp.x, pp.y)) || !!S.aim;   // ⑲-3 석등 곁에서도 스킬을 쓰게
    if (!hudEl) { buildHud(); }
    hudEl.classList.toggle('show', show);
    document.body.classList.toggle('fc-on', show);
    paintMarks();
    tickRings(dt);
    paintAim();
    if (!show) { return; }
    var ab = hudEl.querySelector('.fc-aim');                          // ⑲-22 활 인물일 때만 🎯
    if (ab) { ab.style.display = canAim(S) && aimOk() ? '' : 'none'; ab.classList.toggle('ready', !!S.aim); }
    /* ⑲-1 원소가 일곱으로 늘며 동행 원소가 새로 정해졌다 — 처음 한 번만 알린다(save.field.el7) */
    var fsv = fieldSave();
    if (!fsv.el7) { fsv.el7 = 1; toast('✨ 원소가 일곱(화·수·뇌·풍·빙·암·초)으로 늘었다 — 동행 원소가 새로 정해졌다'); core().persist(); }
    paintParty();
    var m = active(S);
    var sk = hudEl.querySelector('.fc-skill'), bu = hudEl.querySelector('.fc-burst');
    sk.style.setProperty('--el', EL[m.el].color);
    bu.style.setProperty('--el', EL[m.el].color);
    sk.querySelector('.fc-cd').style.height = Math.round(100 * Math.min(1, m.skillCd / (m.skCdMax || SKILL_CD()))) + '%';
    sk.querySelector('span').textContent = m.skillCd > 0 ? m.skillCd.toFixed(1) : EL[m.el].icon + ' ' + (m.kitS ? m.kitS.name : (SHAPES[m.shape] && m.shape !== 'circle' ? SHAPES[m.shape].name : '스킬'));
    var ready = m.energy >= ENERGY_MAX() && m.burstCd <= 0;
    bu.classList.toggle('ready', ready);
    bu.querySelector('.fc-fill').style.height = Math.round(100 * m.energy / ENERGY_MAX()) + '%';
    hudEl.querySelector('.fc-sta i').style.width = Math.round(S.stamina) + '%';
    paintBars();
  }

  /* ⑲-22 조준 화면 — 가운데 조준점 + 충전 막대(DOM), 잠긴 것 발밑 금빛 고리 · 날아가는 화살(3D, 코드 그림) */
  var aimEl = null;
  function paintAim() {
    var a = S.aim, w = W3(), T3 = w && w.three();
    if (!aimEl && document.body) {
      aimEl = document.createElement('div');
      aimEl.id = 'fc-aim';
      aimEl.style.cssText = 'position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);pointer-events:none;z-index:40;display:none;text-align:center;' +
        'font:700 26px/1 sans-serif;color:#fff;text-shadow:0 0 4px #000';
      aimEl.innerHTML = '<div class="a-dot">◎</div><div style="width:84px;height:5px;margin:6px auto 0;background:rgba(0,0,0,.45);border-radius:3px;overflow:hidden">' +
        '<i style="display:block;height:100%;width:0;background:#e8e2d0"></i></div>';
      document.body.appendChild(aimEl);
    }
    if (aimEl) {
      aimEl.style.display = a ? '' : 'none';
      if (a) {
        var k = Math.min(1, a.t / AIM_FULL()), full = a.hold && k >= 1, bar = aimEl.querySelector('i');
        bar.style.width = Math.round((a.hold ? k : 0) * 100) + '%';
        bar.style.background = full ? (EL[active(S).el] ? EL[active(S).el].color : '#ffd24a') : '#e8e2d0';
        aimEl.querySelector('.a-dot').style.color = a.lock ? '#ffd24a' : '#ffffff';
      }
    }
    if (!w || !T3) { return; }
    if (a && a.lock) {
      if (!fx.aimRing) { fx.aimRing = ringMesh(1.1, '#ffd24a', 0.9); if (fx.aimRing) { w.addFx(fx.aimRing); } }
      if (fx.aimRing) { fx.aimRing.visible = true; fx.aimRing.position.set(a.lock.x, (w.standY ? w.standY(a.lock.x, a.lock.y) : 0) + 0.15, a.lock.y); }
    } else if (fx.aimRing) { fx.aimRing.visible = false; }
    var A = S.arrows || [];
    if (!fx.arrows) { fx.arrows = []; }
    while (fx.arrows.length < A.length) {
      var am = new T3.Mesh(new T3.CylinderGeometry(0.03, 0.03, 0.9, 5), new T3.MeshBasicMaterial({ color: 0xf2ead8 }));
      am.rotation.order = 'YXZ';
      fx.arrows.push(w.addFx(am));
    }
    for (var i = 0; i < fx.arrows.length; i++) {
      var mesh = fx.arrows[i], r = A[i];
      mesh.visible = !!r;
      if (!r) { continue; }
      mesh.position.set(r.x, (w.standY ? w.standY(r.x, r.y) : 0) + 1.35, r.y);
      mesh.rotation.set(Math.PI / 2, Math.atan2(r.dx, r.dy), 0);
      mesh.material.color.set(r.full && EL[r.m.el] ? EL[r.m.el].color : '#f2ead8');
    }
  }

  /* 3D 좌표 → 화면 좌표. 3D 가 없으면 null(2D 에선 숫자를 내 머리 위에 띄운다) */
  function toScreen(x, y, up) {
    var w = W3();
    if (!w) { return null; }
    var T3 = w.three(), cam = w.camNode();
    if (!T3 || !cam) { return null; }
    var gy = w.standY ? w.standY(x, y) : (w.groundY ? w.groundY(x, y) : 0);
    var v = new T3.Vector3(x, gy + (up || 2), y).project(cam);
    if (v.z > 1) { return null; }
    return { x: (v.x + 1) / 2 * global.innerWidth, y: (1 - v.y) / 2 * global.innerHeight };
  }

  function floatNum(x, y, text, el, scale, bold, mine) {
    if (!numLayer || global.DG_NO_DRAW) { return; }
    var p = toScreen(x, y, 2.4) || { x: global.innerWidth / 2 + (Math.random() - 0.5) * 60, y: global.innerHeight * 0.42 };
    var n = document.createElement('span');
    n.className = 'fc-num' + (bold ? ' big' : '') + (mine ? ' mine' : '');
    n.textContent = text;
    n.style.left = Math.round(p.x + (Math.random() - 0.5) * 24) + 'px';
    n.style.top = Math.round(p.y) + 'px';
    n.style.color = el ? EL[el].color : (mine ? '#ff8080' : '#ffe9a8');
    n.style.fontSize = Math.round(16 * (scale || 1)) + 'px';
    numLayer.appendChild(n);
    setTimeout(function () { if (n.parentNode) { n.parentNode.removeChild(n); } }, 900);
  }

  var barEls = {};
  function paintBars() {
    var seen = {}, L = living(S), pos = core().save.player.pos;
    for (var i = 0; i < L.length; i++) {
      var f = L[i];
      if (Math.hypot(f.x - pos.x, f.y - pos.y) > 30) { continue; }
      var F = FOES[f.kind];
      var p = toScreen(f.x, f.y, F.h * 1.9 + 0.4);
      if (!p) { continue; }
      var b = barEls[f.uid];
      if (!b) {
        b = barEls[f.uid] = document.createElement('div');
        b.className = 'fc-bar' + (F.boss || F.hero ? ' boss' : '');
        b.innerHTML = '<small></small><span class="fc-bhp"><i></i></span><span class="fc-bsh"><i></i></span>';
        numLayer.appendChild(b);
      }
      seen[f.uid] = true;
      b.style.left = Math.round(p.x) + 'px';
      b.style.top = Math.round(p.y) + 'px';
      var layerTxt = f.layers && f.layers.length > 1 && f.shield > 0 ? ' 🛡️' + f.layers.slice(f.layer).map(function (x) { return EL[x].icon; }).join('') : '';
      b.querySelector('small').textContent = (f.aura ? EL[f.aura].icon + ' ' : '') + f.name + ' Lv.' + (f.tier * 5 + lvAddOf(f.wl)) + layerTxt + (f.stun > 0 ? ' 💫' : '');
      b.querySelector('.fc-bhp i').style.width = Math.round(100 * f.hp / f.hpMax) + '%';
      var sh = b.querySelector('.fc-bsh');
      sh.style.display = f.shieldMax ? '' : 'none';
      if (f.shieldMax) {
        sh.querySelector('i').style.width = Math.round(100 * f.shield / f.shieldMax) + '%';
        sh.style.setProperty('--el', EL[f.shEl].color);
      }
    }
    for (var k in barEls) {
      if (barEls.hasOwnProperty(k) && !seen[k]) {
        if (barEls[k].parentNode) { barEls[k].parentNode.removeChild(barEls[k]); }
        delete barEls[k];
      }
    }
  }

  /* ── 화면: 3D 원(예고·광역) ─────────────────────────────── */
  function ringMesh(r, color, opacity) {
    var w = W3(), T3 = w && w.three();
    if (!T3) { return null; }
    var g = new T3.RingGeometry(Math.max(0.05, r - 0.18), r, 40);
    g.rotateX(-Math.PI / 2);
    var mat = new T3.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false, side: T3.DoubleSide });
    var mesh = new T3.Mesh(g, mat);
    mesh.renderOrder = 5;
    return mesh;
  }
  function ring(x, y, r, color, life) {
    var w = W3();
    if (!w || global.DG_NO_DRAW) { return; }
    var mesh = ringMesh(r, color, 0.9);
    if (!mesh) { return; }
    mesh.position.set(x, (w.standY ? w.standY(x, y) : (w.groundY ? w.groundY(x, y) : 0)) + 0.12, y);
    mesh.scale.setScalar(0.35);
    w.addFx(mesh);
    fx.rings.push({ mesh: mesh, t: 0, life: life || 0.4 });
  }
  function tickRings(dt) {
    var w = W3();
    for (var i = fx.rings.length - 1; i >= 0; i--) {
      var R = fx.rings[i];
      R.t += dt;
      var k = Math.min(1, R.t / R.life);
      R.mesh.scale.setScalar(0.35 + 0.65 * Math.sqrt(k));
      R.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        if (w) { w.removeFx(R.mesh); }
        R.mesh.geometry.dispose(); R.mesh.material.dispose();
        fx.rings.splice(i, 1);
      }
    }
  }
  /** 적 예고 — 떨어질 자리를 붉은 원으로. 예고가 차오를수록 짙어진다 */
  function paintMarks() {
    var w = W3(), seen = {}, k;
    if (!w) { return; }
    var L = living(S);
    for (var i = 0; i < L.length; i++) {
      var f = L[i];
      if (!f.mark) { continue; }
      /* ⑲-16 밀물처럼 원이 여럿이면 원마다 표식 하나(키 uid:j) */
      var ML = f.mark.list || [f.mark];
      for (var j = 0; j < ML.length; j++) { paintMark(w, f, ML[j], j ? f.uid + ':' + j : f.uid, seen); }
    }
    for (k in fx.marks) {
      if (fx.marks.hasOwnProperty(k) && !seen[k]) {
        var mm = fx.marks[k];
        if (mm) { w.removeFx(mm); mm.geometry.dispose(); mm.material.dispose(); }
        delete fx.marks[k];
      }
    }
  }
  function paintMark(w, f, q, key, seen) {
    seen[key] = true;
    var M = fx.marks[key];
    if (!M) {
      M = fx.marks[key] = ringMesh(f.mark.r, '#ff3b3b', 0.3);
      if (!M) { return; }
      var T3 = w.three();
      /* ⑲-20 고리는 안쪽이 빈 판 + 안쪽 테 — 빈 곳이 피할 자리다 */
      var disk = new T3.Mesh((f.mark.inner ? new T3.RingGeometry(f.mark.inner, f.mark.r, 48) : new T3.CircleGeometry(f.mark.r, 40)).rotateX(-Math.PI / 2),
        new T3.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.15, depthWrite: false, side: T3.DoubleSide }));
      M.add(disk);
      if (f.mark.inner) { var inn = ringMesh(f.mark.inner, '#ff3b3b', 0.8); if (inn) { M.add(inn); } }
      M.userData.disk = disk; M.userData.halo = !!f.mark.inner;
      w.addFx(M);
    }
    M.position.set(q.x, (w.standY ? w.standY(q.x, q.y, !!f.sky) : (w.groundY ? w.groundY(q.x, q.y) : 0)) + 0.1, q.y);
    var prog = 1 - Math.max(0, f.stT) / (f.mark.t || 1);
    M.material.opacity = 0.35 + 0.55 * prog;
    M.userData.disk.scale.setScalar(M.userData.halo ? 1 : Math.max(0.05, prog));
    M.userData.disk.material.opacity = 0.18 + 0.2 * prog;
  }

  /* ⑲-2 공격 누르고 있기 — 0.4초 넘으면 강공격 한 번(떼면 풀린다) */
  var holdTimer = null;
  function holdStart() {
    holdEnd();
    holdTimer = setTimeout(function () { holdTimer = null; act('heavy'); }, CHARGE_HOLD() * 1000);
  }
  function holdEnd() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    /* ⑲-22 조준 충전 중에 떼면 쏜다 — 길게 눌러 들어온 조준이면 쏘고 나온다 */
    if (S && S.aim && S.aim.hold && on() && core() && core().save) {
      var pos = core().save.player.pos, auto = S.aim.auto;
      aimShoot(S, pos.x, pos.y);
      if (auto) { aimEnd(S); }
      handle(drain(S), pos);
    }
  }
  /** ⑲-22 조준은 키보드 판만(GPS 판은 몸이 걷는다) */
  function aimOk() { var W = global.DG.world; return !!(W && W.mode === 'keyboard'); }
  /** landform 이 걸음 대신 부른다 — 조준 중이면 방향 키가 겨눈 쪽을 돌린다 */
  function aimSteerRt(ux, uy, dt) { return !!(S && S.aim && aimSteer(S, ux, uy, dt)); }
  function aimView() {
    if (!S || !S.aim) { return null; }
    var a = S.aim;
    return { dx: a.dx, dy: a.dy, t: a.t, hold: a.hold, full: a.hold && a.t >= AIM_FULL() - 1e-9, k: Math.min(1, a.t / AIM_FULL()), lock: a.lock };
  }
  /** ⑲-2 landform 이 내리꽂기 착지 때 부른다 — 떨어진 높이(m) */
  function plungeLand(fell) {
    if (!on() || !core() || !core().save) { return { ok: false }; }
    ensureState();
    var pos = core().save.player.pos, r = plunge(S, pos.x, pos.y, fell);
    handle(drain(S), pos);
    return r;
  }

  /* ── 입력: 키 ─────────────────────────────────────────── */
  function bindKeys() {
    if (bound) { return; }
    bound = true;
    global.addEventListener('keyup', function (e) { if (e.key && e.key.toLowerCase() === 'j') { holdEnd(); } });
    global.addEventListener('keydown', function (e) {
      if (!S || !on() || e.repeat) { return; }
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      if (blocked()) { return; }
      var k = e.key.toLowerCase();
      var nearby = engaged(S) || !!nearestFoe(S, core().save.player.pos.x, core().save.player.pos.y, 22);
      if (k === 'j') { var ra = act('attack'); if (!(ra && ra.plunge)) { holdStart(); } }
      else if (k === 'e') { act('skill'); }
      else if (k === 'r') { act('aim'); }                             // ⑲-22 활 조준
      else if (k === 'q') { act('burst'); }
      else if (k === ' ' && nearby) { e.preventDefault(); act('dodge'); }
      else if (k >= '1' && k <= '4' && nearby) { act('swap', +k - 1); }
    });
  }

  /** 3D 배우 목록 — `world3d.js` 가 매 프레임 읽는다 */
  function live() {
    if (!S || !on()) { return []; }
    var out = [], D = data();
    for (var k in S.foes) {
      if (!S.foes.hasOwnProperty(k)) { continue; }
      var f = S.foes[k], F = FOES[f.kind];
      var ref = F.body ? { id: F.body, name: F.name, rarity: 5, trait: 'might', color: '#26222e' }     // ⑲-14 이야기 보스 — 고정 사람 몸
        : ((D && D.find && D.find(f.heroId || F.ref)) || { id: 'fc_' + f.kind, name: F.name, kind: 'beast', rarity: 2, form: 'boar' });
      out.push({ uid: f.uid, x: f.x, y: f.y, h: F.h, ref: ref, moving: f.moving, phase: f.phase,
        dead: f.dead, deadT: f.deadT, stun: f.stun > 0 && f.st !== 'yield', el: f.el, aura: f.aura, boss: !!F.boss,
        hero: !!(F.hero || F.body), mask: F.mask || null, yielded: f.st === 'yield', sky: !!f.sky });
    }
    return out;
  }

  /**
   * ⑯ 싸워서 등용 — 들판 인물을 눌렀을 때(encounter.js startHero). 3D 들판 전투가 도는 자리에서만 true
   * (2D·진단(DG_NO_DRAW)은 옛 설득 카드). 판은 인물이 서 있던 자리에 선다 — 끝나면 'duelEnd'(win·lose·flee)
   */
  function canChallenge() { return !!(on() && core() && core().save && W3() && !(S && S.duel)); }
  function challenge(spawn) {
    if (!canChallenge() || !spawn || !spawn.ref) { return false; }
    ensureState();
    var c = duelCamp(spawn.ref, spawn.x, spawn.y, spawn.uid);
    if (S.camps[c.key]) { return false; }
    spawnCamp(S, c);
    var cp = S.camps[c.key];
    S.duel = { uid: cp.uids[0], camp: c.key, spawnUid: spawn.uid, heroId: spawn.ref.id, wiped: false };
    for (var i = 0; i < cp.uids.length; i++) { wake(S.foes[cp.uids[i]]); }
    return true;
  }
  function duelSpawn() { return S && S.duel ? S.duel.spawnUid : null; }

  /** 지도 위 아바타로 설 사람 — 교체하면 바뀐다(없으면 null → 동행 선두) */
  function leadId() {
    if (!S || !on()) { return null; }
    var m = active(S);
    return m && m.id !== '_me' ? m.id : null;
  }

  function init() { bindKeys(); }

  global.DG = global.DG || {};
  global.DG.fieldCombat = {
    EL: EL, FOES: FOES, ROT: ROT, SHADOW_BACK: SHADOW_BACK, RIFT_STEP: RIFT_STEP, RIFT_SLOPE: RIFT_SLOPE, riftOk: riftOk, SIEGE_PULL: SIEGE_PULL, tideMarks: tideMarks, markHit: markHit, foeAtk: foeAtk, KB_T: KB_T, knock: knock, rainFollow: rainFollow, THEMES: THEMES, ELITES: ELITES, ERA_THEMES: ERA_THEMES, ERA_ELITES: ERA_ELITES, eraOfCamp: eraOfCamp, CELL: CELL, ENERGY_MAX: ENERGY_MAX,
    SKILL_CD: SKILL_CD, SWAP_CD: SWAP_CD, BODY: BODY, separate: separate, DODGE_COST: DODGE_COST, VAPOR_MUL: VAPOR_MUL,
    /* 판정 층 — 화면 없이 굴린다(자가진단이 쓰는 문) */
    elementOf: elementOf, EL_KEYS: EL_KEYS, heavy: heavy, plunge: plunge, plungeMul: plungeMul, plungeLand: plungeLand, PLUNGE_R: PLUNGE_R(), CHARGE_COST: CHARGE_COST(), REACT: REACT, attaches: attaches, shapeOf: shapeOf, SHAPES: SHAPES, kitFor: kitFor, segDist: segDist, react: react, shieldMul: shieldMul, campAt: campAt, tierAt: tierAt, guardianAt: guardianAt, COUNTER: COUNTER,
    autoThreat: autoThreat, create: create, reparty: reparty, populate: populate, spawnCamp: spawnCamp, step: step, drain: drain,
    attack: attack, skill: skill, burst: burst, dodge: dodge, swap: swap, hitFoe: hitFoe,
    canAim: canAim, aimStart: aimStart, aimEnd: aimEnd, aimSteer: aimSteer, aimHold: aimHold, aimShoot: aimShoot, aimLock: aimLock, stepArrows: stepArrows,
    AIM_R: AIM_R(), AIM_FULL: AIM_FULL(), AIM_PART: AIM_PART(), AIM_FULLMUL: AIM_FULLMUL(), ARROW_V: ARROW_V(), ARROW_RANGE: ARROW_RANGE(),
    aiming: function () { return !!(S && S.aim); }, aimSteerRt: aimSteerRt, aimView: aimView, aimCancel: function () { return !!(S && aimEnd(S)); },
    engaged: engaged, inCombat: inCombat, COMBAT_R: COMBAT_R, living: living, memberOf: memberOf, applyWorld: applyWorld, rescaleWorld: rescaleWorld, killGold: killGold, clearLoot: clearLoot,
    guardBack: guardBack, duelCamp: duelCamp, canChallenge: canChallenge, challenge: challenge, duelSpawn: duelSpawn,
    /* 런타임 */
    init: init, tick: tick, act: act, live: live, leadId: leadId,
    state: function () { return S; },
    _setStateForTest: function (st) { S = st; },
    _resetForTest: function () { S = null; partyKey = ''; popAcc = 9; }
  };
})(window);
