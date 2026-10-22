  /* ── 전체 지도(자동지도, M키식 토글) ────────────────────────
   * 2026-09-06 — 사용자가 "M키 지도가 점만 보인다"고 지적하고 "원작
   * 처럼·투명으로 보여 줄 수도 있고"라고 요청했다. 예전엔 마을 넷의 고정
   * 배치(상자 그림, 이름만)를 #encounter 카드로 띄웠는데, 그 대신
   * minimap.js 의 큰 판(blips·norm 을 그대로 재사용해 화면 전체를 반투명
   * 하게 덮는다)으로 갈아 끼웠다 — 그쪽이 실제 방·들길 배치를 그대로
   * 보여 줘서 "점만 보인다"는 지적을 정면으로 푼다. #encounter 도, 마을
   * 전용 T.overworld 도 이제 이 화면에서는 안 쓴다(town.js 는 안 건드림 —
   * 다른 자가진단이 그 표를 직접 본다). 마을뿐 아니라 던전 방에서도
   * 켜진다 — 원작의 자동지도도 마을 전용이 아니다. */
  function openOverworldMap() {
    var MM = global.DG.minimap;
    return !!(MM && MM.openBig());
  }
  function closeOverworldMap() {
    var MM = global.DG.minimap;
    if (MM) { MM.closeBig(); }
  }
  function toggleOverworldMap() {
    var MM = global.DG.minimap;
    return !!(MM && MM.toggleBig());
  }

  /* ── 퀘스트 (PLAN 36절) — js/ui-quest.js(R-4). 같은 이름 한 줄 넘김 ── */
  var uqH = null; function viewQuest() { return global.DG.uiQuest.setup(uqH || (uqH = { esc: esc })).viewQuest(); }

  /* ── 도감 ─────────────────────────────────────────────── */

  /** era → 필터 갈래 셋(§5.7). 기존 넷(삼국지·한국사·일본사·세계사)은
   *  전부 '과거' 하나로 묶는다 — 갈래를 다섯 세 개(과거·현대·미래)로만
   *  늘렸다(era 자체를 갈래로 쓰면 4+2=6개라 시트 폭이 좁은 폰에서 버겁다). */
  function eraGroupOf(era) {
    if (era === '현대') { return 'modern'; }
    if (era === '미래') { return 'future'; }
    return 'past';
  }
  /** 인물 카드의 "시대 아이콘"(§5.7 수치 절) — era 문자열 그대로 하나씩. */
  function eraIcon(era) { return era === '현대' ? '🏙️' : (era === '미래' ? '🚀' : '📜'); }
  var DEX_ERA_TABS = [
    { key: 'all', label: '전체' }, { key: 'past', label: '과거' },
    { key: 'modern', label: '현대' }, { key: 'future', label: '미래' }
  ];
  function dexEraBar() {
    var out = '<div class="dexera">', i, t;
    for (i = 0; i < DEX_ERA_TABS.length; i++) {
      t = DEX_ERA_TABS[i];
      out += '<button class="btn tiny' + (dexEra === t.key ? ' on' : ' ghost') +
        '" data-act="dex-era" data-era="' + t.key + '">' + esc(t.label) + '</button>';
    }
    return out + '</div>';
  }

  function viewDex() {
    var heroesShown = dexEra === 'all' ? data.heroes :
      data.heroes.filter(function (h) { return eraGroupOf(h.era) === dexEra; });
    var hC = Object.keys(core.save.dex.heroes).length;
    var pC = Object.keys(core.save.dex.pets).length;
    var themes = (global.DG.dungeonData && global.DG.dungeonData.THEMES) || [];
    var rC = Object.keys(core.save.dex.regions || {}).length;
    var relics = (global.DG.town && global.DG.town.fieldRelics) ? global.DG.town.fieldRelics() : [];
    var lC = Object.keys(core.save.dex.relics || {}).length;
    return '<div class="sec"><h4>인물</h4>' + dexEraBar() + dexBar(hC, data.heroes.length) +
             dexGrid(heroesShown, core.save.dex.heroes) + '</div>' +
           '<div class="sec"><h4>펫</h4>' + dexBar(pC, data.pets.length) +
             dexGrid(data.pets, core.save.dex.pets) + '</div>' +
           '<div class="sec"><h4>지역</h4>' + dexBar(rC, themes.length || 1) +
             regionGrid(themes, core.save.dex.regions || {}) + '</div>' +
           '<div class="sec"><h4>유적</h4>' + dexBar(lC, relics.length || 1) +
             relicGrid(relics, core.save.dex.relics || {}) + '</div>' +
           '<div class="hint">카드를 누르면 열전·승급·펫 장착 화면이 열립니다. ' +
           '같은 인물을 또 등용하면 <b>중복(+n)</b>이 쌓여 승급 재료가 됩니다. ' +
           '지역은 그 층 테마에 처음 들어서면 밝혀집니다. 유적은 길에서 벗어나 ' +
           '들판을 뒤져야 닿습니다.</div>';
  }

  /** 지역 도감 — 인물·펫과 달리 등급색·중복 개념이 없는 단순 목록이다.
   *  같은 `dcell`/`locked`/`de`/`small` 스타일을 그대로 빌려 쓴다(새 CSS 없음). */
  function regionGrid(themes, owned) {
    var out = '<div class="dexgrid">';
    for (var i = 0; i < themes.length; i++) {
      var t = themes[i], have = !!owned[t.name];
      out += '<div class="dcell' + (have ? '' : ' locked') + '" title="' + esc(have ? t.name : '미발견') + '">' +
        (have ? '<span class="de">🗺️</span>' : '<span class="de locked-mark">❔</span>') +
        '<small>' + (have ? esc(t.name) : '???') + '</small></div>';
    }
    return out + '</div>';
  }

  /** 유적 도감(PLAN §60 후보4) — 지역과 같은 단순 목록. 이미 찾은 것만
   *  실제 이름·그림을 보여준다(못 찾은 것은 자리만 있고 정체는 감춘다 —
   *  릴리스 제단처럼 "몇 개 남았는지"만 보이고 어디인지는 안 가르쳐 준다). */
  function relicGrid(relics, owned) {
    var out = '<div class="dexgrid">';
    for (var i = 0; i < relics.length; i++) {
      var r = relics[i], have = !!owned[r.id];
      out += '<div class="dcell' + (have ? '' : ' locked') + '" title="' + esc(have ? r.name : '미발견') + '">' +
        (have ? '<span class="de">' + r.emoji + '</span>' : '<span class="de locked-mark">❔</span>') +
        '<small>' + (have ? esc(r.name) : '???') + '</small></div>';
    }
    return out + '</div>';
  }

  function dexBar(n, total) {
    return '<div class="dexbar"><div class="bar"><i style="width:' + (n / total * 100) + '%"></i></div>' +
      '<small>' + n + ' / ' + total + '</small></div>';
  }

  function dexGrid(list, owned) {
    var out = '<div class="dexgrid">';
    var sorted = list.slice().sort(function (a, b) {
      return b.rarity - a.rarity || a.name.localeCompare(b.name, 'ko');
    });
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i], have = !!owned[e.id], rar = data.rarity[e.rarity];
      var kind = e.stats ? 'hero' : 'pet';
      var dup = have ? owned[e.id].count - 1 : 0;
      out += '<button class="dcell' + (have ? '' : ' locked') + '" style="border-color:' +
        (have ? rar.color : 'transparent') + '" title="' +
        esc(e.name + (have ? (dup ? ' · 중복 ' + dup : '') : ' (미획득)')) + '"' +
        ' data-act="detail" data-kind="' + kind + '" data-id="' + e.id + '">' +
        (have ? '<span class="de">' + pt(kind, e, 52) + '</span>'
              : '<span class="de locked-mark">❔</span>') +
        '<small>' + (have ? esc(e.name) : '???') + '</small>' +
        (dup > 0 ? '<i class="cnt">+' + dup + '</i>' : '') + '</button>';
    }
    return out + '</div>';
  }

  /* ── 기록 ─────────────────────────────────────────────── */

  function viewLog() {
    var log = core.save.log;
    if (!log.length) { return '<div class="hint">아직 기록이 없습니다.</div>'; }
    var out = '<div class="loglist">';
    for (var i = 0; i < log.length; i++) {
      var t = new Date(log[i].t);
      var hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      out += '<div class="lrow ' + log[i].kind + '"><span>' + hh + '</span>' + esc(log[i].text) + '</div>';
    }
    return out + '</div>';
  }

  /* ── 장비(격자 가방·종이인형·창고) — js/ui-gear.js(R-4). 같은 이름 한 줄 넘김 ──
   * 짚어 둔 물건·인물·탭은 handleAct 가 갈아 끼우므로 상태는 여기 GS 에 두고 객체째 넘긴다(화면에만 사는 값 — 세이브 아님) */
  var GS = { sel: null, hero: null, tab: 'bag' };
  var ugH = null; function gearSection() { return global.DG.uiGear.setup(ugH || (ugH = { esc: esc, ico: ico, pt: pt, tabBar: tabBar, priceTag: priceTag, GS: GS })).gearSection(); }

  /* ── 외모(2026-09-06) — 플레이어 본인 3D 아바타 커스텀 ─────
   * `core.save.appearance = {styleSeed, tint}` 를 고르면
   * `dungeon3d.js`의 `'me'` 배우가 그 시드/색으로 다시 지어진다.
   * styleSeed 0(기본)은 지금까지의 고정 모습 그대로다.
   * 1~6 은 `dungeon3d.js`의 `QRPG_SEEDS` 여섯 자리(전사·순찰자·도적·
   * 사제·마법사·수도승 몸)만 내준다 — 실사풍(MPFB) 쪽은 색도 안 먹고
   * (dungeon3d.js 주석 참고) 실기기 확인 중 렌더러가 죽는 조합이 있어
   * 뺐다. 그래서 "색이 안 먹을 수 있다"는 캐벗도 필요 없어졌다. */
  var LOOK_STYLE_NAMES = ['기본', '전사', '순찰자', '도적', '사제', '마법사', '수도승'];
  var LOOK_TINTS = ['#c94f4f', '#4f8fc9', '#4fc98f', '#c9a04f', '#8f4fc9', '#5a5a62'];

  function viewLook() {
    var ap = core.save.appearance || { styleSeed: 0, tint: null };
    var i, html = '<div class="sec"><h4>🧑 외모</h4>' +
      '<div class="hint">내 3D 모습(몸·옷 조합)을 고른다. 장비 겉모습과는 별개다.</div>';

    html += '<div class="bagtools">';
    for (i = 0; i < LOOK_STYLE_NAMES.length; i++) {
      html += '<button class="btn tiny' + ((ap.styleSeed || 0) === i ? ' primary' : ' ghost') +
        '" data-act="look-style" data-n="' + i + '">' + LOOK_STYLE_NAMES[i] + '</button>';
    }
    html += '</div>';

    html += '<div class="bagtools">';
    for (i = 0; i < LOOK_TINTS.length; i++) {
      var hex = LOOK_TINTS[i];
      html += '<button class="btn tiny' + (ap.tint === hex ? ' primary' : ' ghost') +
        '" style="background:' + hex + '" data-act="look-tint" data-hex="' + hex + '">&nbsp;</button>';
    }
    html += '<button class="btn tiny ghost" data-act="look-reset">↺ 초기화</button>' +
      '</div></div>';
    return html;
  }

  /* ── 무예(武藝) — 원작의 직업과 스킬 트리 ─────────────────
   * 규칙은 skill.js 가 다 안다. 여기는 나무를 늘어놓고 누른 것을 넘긴다.
   * 인물마다 나무가 다르므로 **누구의 나무인지**를 늘 위에 적어 둔다.
   */

  var skillHero = null;

  /** 이 직업을 여는 무기 이름들 — "무엇을 쥐면 되는지" 를 화면이 알려 준다 */
  function weaponNames(clsKey) {
    var looks = global.DG.skillData.weaponsFor(clsKey);
    var out = [];
    global.DG.itemData.BASES.forEach(function (b) {
      if (b.slot === 'weapon' && looks.indexOf(b.look) >= 0) { out.push(b.name); }
    });
    return out.join('·');
  }

  function viewSkill() {
    var SK = global.DG.skill, SD = global.DG.skillData;
    if (!SK) { return '<div class="hint">무예 모듈이 없습니다</div>'; }
    var party = core.save.party;
    if (!party.length) { return '<div class="hint">동행이 없습니다.</div>'; }
    if (party.indexOf(skillHero) < 0) { skillHero = party[0]; }

    var h = data.find(skillHero);
    var cls = SK.classOf(skillHero);
    var left = SK.pointsLeft(skillHero);

    /* 인물 고르기 — 선두가 던전에서 몸으로 뛴다 */
    var tabs = '', i;
    for (i = 0; i < party.length; i++) {
      var ph = data.find(party[i]);
      if (!ph) { continue; }
      tabs += '<button class="btn tiny' + (party[i] === skillHero ? ' primary' : ' ghost') +
        '" data-act="skill-hero" data-hero="' + party[i] + '">' +
        (i === 0 ? '\u25B6 ' : '') + esc(ph.name) + '</button>';
    }

    var html = '<div class="bagtools">' + tabs + '</div>' +
      '<div class="sec"><h4>' + ico('job', cls.key, 24, cls.emoji) + ' ' + esc(cls.name) + '(' + cls.hanja + ')</h4>' +   // W-0330 직업·무예 그림(K-0118), 없으면 이모지
      '<div class="card">' +
        '<div class="stat-row"><span>' + esc(h ? h.name : '') + '</span>' +
          '<b>Lv.' + SK.pointsTotal(skillHero) + ' · 남은 점수 ' + left + '</b></div>' +
        '<small class="muted">' + esc(cls.desc) + '<br>' +
        '직업은 <b>장착한 무기</b>가 정합니다 — ' + esc(weaponNames(cls.key)) +
        ' 를 쥐면 이 나무를 탑니다. <b>무기를 바꾸면 손이 통째로 바뀝니다.</b><br>' +
        '점수와 칸은 직업마다 따로 남으니, 도로 쥐면 예전 손이 살아납니다.<br>' +
        '<b>던전에서 몸으로 뛰는 것은 선두(▶)</b>입니다.' +
        '</small>' +
        (SK.pointsSpent(skillHero)
          ? '<button class="btn tiny ghost wide" data-act="skill-respec">↺ 환원(還元) — ' +
            core.fmt(global.DG.vendor.respecCost(skillHero)) + '금에 점수를 돌려받는다</button>'
          : '') +
        '</div></div>' + (global.DG.meridian ? global.DG.meridian.sheetHtml(skillHero) : '');   // 경락도(W-0180) 칸

    /* 네 칸 */
    var eq = SK.equipped(skillHero);
    var KEYS = ['Z', 'X', 'C', 'V'];
    html += '<div class="sec"><h4>손에 든 넷</h4>' +
      '<div class="hint">배운 것을 <b>네 칸에 걸어야</b> 던전에서 씁니다 — ' +
      '원작에서도 배운 걸 다 손에 들진 못합니다.</div><div class="bagtools">';
    for (i = 0; i < eq.length; i++) {
      html += '<button class="btn tiny' + (skillSlotPick === i ? ' primary' : ' ghost') +
        '" data-act="skill-slot" data-idx="' + i + '">' + KEYS[i] + ' ' +
        (eq[i] ? ico('skill', eq[i].sk.key, 20, eq[i].sk.emoji) + ' ' + esc(eq[i].sk.name) : '<span class="muted">비었다</span>') +
        '</button>';
    }
    html += '</div>';
    if (skillSlotPick !== null) {
      html += '<div class="hint">' + KEYS[skillSlotPick] +
        ' 칸에 걸 무예를 아래에서 고르세요 (상시 무예는 못 겁니다). ' +
        '<button class="btn tiny ghost" data-act="skill-slot" data-idx="-1">그만두기</button></div>';
    }
    html += '</div>';

    /* 나무 — 갈래 셋 × 단계 셋 */
    var tree = SK.treeOf(skillHero);
    var br;
    for (br = 0; br < 8; br++) {
      var row = tree.filter(function (x) { return x.br === br; })
                    .sort(function (a, b) { return a.row - b.row; });
      if (!row.length) { continue; }
      html += '<div class="sec"><h4>갈래 ' + (br + 1) + '</h4>';
      for (i = 0; i < row.length; i++) {
        var sk = row[i];
        var rank = SK.rankOf(skillHero, sk.key);
        var can = SK.canLearn(skillHero, sk.key);
        var pre = SD.prereqOf(sk);
        var locked = !!(pre && SK.rankOf(skillHero, pre.key) < 1);
        var slotted = eq.filter(function (x) { return x && x.sk.key === sk.key; }).length > 0;
        html += '<div class="grow" style="border-left-color:' +
          (rank ? 'var(--gold)' : (locked ? 'var(--ink-faint)' : 'var(--d2-brass)')) + '">' +
          '<div class="gr-top"><b>' + ico('skill', sk.key, 28, sk.emoji) + ' ' + esc(sk.name) + '</b>' +
          '<span class="gr-lv">' + rank + ' / ' + SD.MAX_RANK + '단' +
            (slotted ? ' · 손에 듦' : '') + '</span></div>' +
          '<div class="gr-opts">' + esc(sk.desc) +
            (sk.shape === 'passive' ? ' <span class="muted">(상시)</span>'
                                    : ' <span class="muted">기력 ' + sk.cost + ' · ' + sk.cd + '초</span>') +
            (rank ? ' <b>지금 ' + fmtSkillValue(sk, SD.valueAt(sk, rank)) + '</b>' : '') +
          '</div>' +
          '<div class="gr-btns">' +
            (locked
              ? '<span class="muted" style="font-size:11px">\uD83D\uDD12 ' + esc(pre.name) + ' 을(를) 먼저</span>'
              : '<button class="btn tiny' + (can.ok ? ' primary' : '') + '" data-act="skill-learn"' +
                ' data-key="' + sk.key + '"' + (can.ok ? '' : ' disabled') + '>+1단</button>') +
            (skillSlotPick !== null && rank > 0 && sk.shape !== 'passive'
              ? '<button class="btn tiny" data-act="skill-set" data-key="' + sk.key +
                '">' + KEYS[skillSlotPick] + ' 에 걸기</button>' : '') +
          '</div>' + secretRow(skillHero, sk, rank) + (rank && sk.shape !== 'passive' && global.DG.skillTree ? global.DG.skillTree.rowHtml(sk.key) : '') + '</div>';   // W-0280 무예별 작은 나무
      }
      html += '</div>';
    }
    return html;
  }

  /**
   * 비결(§5.9, secret.js) 다섯 — 배운 무예 아래에 늘어놓는다. 단수가 모자란 것은 자물쇠.
   * 원작 3편의 룬 자리 — 이 판엔 소켓 룬이 따로 있어 이름을 '비결'로 했다.
   */
  function secretRow(hid, sk, rank) {
    var SC = global.DG.secret;
    if (!SC || !rank || sk.shape === 'passive') { return ''; }
    var cur = SC.of(hid, sk.key), html = '<div class="gr-secret"><small class="muted">비결</small> ';
    var lores = SC.activeLores ? SC.activeLores(hid) : {};
    SC.SECRETS.forEach(function (s) {
      var lock = rank < s.rank;
      /* 비전(§5.10) — 입은 전설이 키우는 비결엔 📜 가 붙는다 */
      html += '<button class="btn tiny' + (cur === s.key ? ' primary' : '') + '" data-act="skill-secret"' +
        ' data-key="' + sk.key + '" data-sec="' + s.key + '" title="' + esc(s.desc + (lores[s.key] ? ' · 📜 비전 위력 ×' + SC.LORE_MUL : '')) + '"' + (lock ? ' disabled' : '') + '>' +
        s.emoji + ' ' + s.name + (lores[s.key] ? '📜' : '') + (lock ? ' 🔒' + s.rank : '') + '</button>';
    });
    if (cur) { html += '<div class="muted" style="font-size:11px">' + esc(SC.byKey(cur).desc) + '</div>'; }
    return html + '</div>';
  }

  /** 상시 무예는 % 로, 나머지는 배수로 읽힌다 */
  function fmtSkillValue(sk, v) {
    if (sk.shape === 'passive') { return '+' + Math.round(v * 10) / 10 + '%'; }
    if (sk.shape === 'buff') { return '+' + Math.round(v) + '% · ' + (sk.sec || 6) + '초'; }
    if (sk.shape === 'heal') { return '체력 ' + Math.round(v) + '%'; }
    if (sk.shape === 'curse') { return '받는 피해 +' + Math.round(v) + '%' + (sk.pull ? ' · 끌어당김' : ''); }
    if (sk.shape === 'summon') { return Math.round(v) + '기 · ' + (sk.sec || 12) + '초'; }
    /* §5.19 2차 — 원뿔(arc)·끌어당김(pull)은 같은 모양 안의 변주라 수치 줄에 꼬리표로 */
    return '위력 ' + Math.round(v * 100) + '%' + (sk.arc ? ' · 앞 부채꼴' : '') + (sk.pull ? ' · 끌어당김' : '');
  }

  /* ── 행상(行商) — 원작의 상인과 도박 ─────────────────────
   * 규칙은 vendor.js 가 다 안다. 여기는 늘어놓고 누른 것을 넘기기만 한다.
   */

  function priceTag(n) {
    var poor = core.save.player.gold < n;
    return '<span style="color:' + (poor ? 'var(--bad)' : 'var(--gold)') +
      '">\uD83E\uDE99 ' + core.fmt(n) + '</span>';
  }
  /* 행상 화면(viewVendor·사기·팔기·되사기·도박)·세공·연단은 js/ui-shop.js(R-4) — 같은 이름으로 넘긴다 */
  function US() { return global.DG.uiShop.setup({ esc: esc, ico: ico, priceTag: priceTag, tabBar: tabBar, S: { craftTab: function () { return craftTab; }, vendorTab: function () { return vendorTab; }, craftMat: function () { return craftMat; } } }); }
  function viewVendor() { return US().viewVendor(); }
  function viewCraft() { return US().viewCraft(); }

  /* ── 세공(細工) ───────────────────────────────────────── */

  /* 세공 시트·행상 시트에서 고른 탭 — 둘 다 화면 상태라 세이브에 안 남긴다 */
  var craftTab = 'socket', vendorTab = 'buy';
  var skillSlotPick = null;

  function tabBar(act, cur, list) {
    var h = '<div class="bagtools">', i;
    for (i = 0; i < list.length; i++) {
      h += '<button class="btn tiny ' + (list[i][0] === cur ? 'primary' : 'ghost') +
        '" data-act="' + act + '" data-tab="' + list[i][0] + '">' + list[i][1] + '</button>';
    }
    return h + '</div>';
  }

  /* ── 사관 (온라인 모드) ───────────────────────────────── */


  /* ── 자동 순행 ────────────────────────────────────────────
   * 사관 시트에 뒀지만 **오프라인에서도 그대로 돈다** — 판단은 규칙이고,
   * AI(사관)를 쓰는 건 '길조 유지' 하나뿐이다. 그 점을 화면에 적어 둔다.
   */
  function sectionAuto() {
    var A = global.DG.auto;
    var stt = A.status();
    var html = '<div class="sec"><h4>자동 순행</h4><div class="card">' +
      '<button class="btn wide ' + (stt.on ? 'primary' : '') + '" data-act="auto-on">' +
        (stt.on ? '⏸️ 자동 순행 멈춤' : '🤖 자동 순행 시작') + '</button>';
    if (stt.on) {
      html += '<div class="stat-row"><span>지금</span><b>' + esc(stt.doing || '…') + '</b></div>';
    }
    html += '<div class="autoflags">';
    for (var i = 0; i < A.FLAGS.length; i++) {
      var f = A.FLAGS[i];
      var onf = A.on(f.key);
      html += '<button class="btn tiny ' + (onf ? 'primary' : 'ghost') + '" ' +
        'data-act="auto-flag" data-flag="' + f.key + '" title="' + esc(f.desc) + '">' +
        f.emoji + ' ' + f.name + '</button>';
    }
    html += '</div>' +
      '<small class="muted">던전 규칙은 <b>손으로 할 때와 같습니다</b> — ' +
      '자동은 무엇을 목표로 삼을지(적·우물·문·은사)만 고릅니다.<br>' +
      '<b>체력이 22% 밑으로 떨어지면 스스로 탈출합니다</b> — 노획물을 잃지 않게.<br>' +
      '창을 보고 있는 동안에만 돕니다 — 덮어 두면 멈춥니다.</small>' +
      '</div></div>';
    return html;
  }


