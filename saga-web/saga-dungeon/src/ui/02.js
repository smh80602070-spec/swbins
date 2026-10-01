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

  /* ── 퀘스트 (PLAN 36절) ───────────────────────────────────
   * 넷 — 메인(순서대로 하나씩) · 지역(월드맵 여섯 지역, 닿아야 열린다) ·
   * 이벤트(구출 누적) · 무작위(늘 하나, 끝내면 곧바로 새것). 진행은
   * quest.js 가 dungeon.js 의 사건을 듣고 센다 — 여기는 그 결과만 그린다.
   */
  function qstRow(icon, name, desc, have, need, cls) {
    var pct = need ? Math.round(Math.min(1, have / need) * 100) : 0;
    return '<div class="qst-row' + (cls ? ' ' + cls : '') + '">' +
      '<span class="qst-ic">' + icon + '</span>' +
      '<div class="qst-info"><b>' + esc(name) + '</b><small>' + esc(desc) + '</small>' +
        (need ? '<div class="qst-bar"><i style="width:' + pct + '%"></i></div>' : '') +
      '</div>' +
      (need ? '<span class="qst-n">' + have + '/' + need + '</span>' : '') +
      '</div>';
  }

  function viewQuest() {
    var Q = global.DG.quest;
    if (!Q) { return '<div class="hint">퀘스트 모듈이 없습니다.</div>'; }
    var st = Q.status();
    var html = global.DG.scenario ? global.DG.scenario.cardHtml() + global.DG.scenario.roundHtml() : '';

    html += '<div class="sec"><h4>🚩 메인</h4>';
    if (st.mainDone) {
      html += '<div class="hint">메인 퀘스트를 모두 마쳤습니다 (' + st.mainTotal + '/' + st.mainTotal + ').</div>';
    } else {
      html += qstRow('🚩', st.main.name, st.main.desc, st.main.have, st.main.need) +
        '<div class="hint">' + (st.mainIdx + 1) + ' / ' + st.mainTotal + '번째</div>';
    }
    html += '</div>';

    html += '<div class="sec"><h4>🗺️ 지역</h4>';
    for (var i = 0; i < st.regions.length; i++) {
      var r = st.regions[i];
      if (r.locked) {
        html += qstRow('❔', '???', '이 지역에 아직 닿지 않았습니다', 0, 0, 'locked');
      } else {
        html += qstRow(r.done ? '✅' : '⚔️', r.name, r.desc, r.have, r.need, r.done ? 'done' : '');
      }
    }
    html += '</div>';

    /* 지역 사연 사슬(§5.14) — 고정 세계 지도의 지역 아홉, 발 들인 곳만 열린다 */
    if (st.chains && st.chains.length) {
      html += '<div class="sec"><h4>📜 지역 사연 <small>' + st.chainDone + '/' + st.chains.length + ' 평정' +
        (st.chainAll ? ' · 🏳️ 구주 평정' : '') + '</small></h4>';
      st.chains.forEach(function (c) {
        if (c.locked) {
          html += qstRow('❔', c.emoji + ' ' + c.name, '아직 발 들이지 않은 땅', 0, 0, 'locked');
        } else if (c.done) {
          html += qstRow('🏳️', c.emoji + ' ' + c.name + ' · ' + c.title, '평정 — ' + c.desc, 0, 0, 'done');
        } else {
          html += qstRow('📜', c.emoji + ' ' + c.name + ' · ' + c.title + ' (' + (c.step + 1) + '/' + c.steps + ' ' + c.stepName + ')',
            c.desc + ' — ' + c.giver, c.have, c.need);
        }
      });
      html += '</div>';
    }

    html += '<div class="sec"><h4>🙏 이벤트</h4>';
    if (st.eventDone) {
      html += '<div class="hint">이벤트 퀘스트를 모두 마쳤습니다.</div>';
    } else {
      html += qstRow('🙏', st.event.name, st.event.desc, st.event.have, st.event.need);
    }
    html += '</div>';

    html += '<div class="sec"><h4>📋 현상</h4>' +
      qstRow('📋', st.random.name, st.random.desc, st.random.have, st.random.need) +
      '<button class="btn tiny ghost" data-act="quest-reroll">🔄 다시 뽑기</button></div>';

    return html;
  }

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

  /* ── 노획 장비 ────────────────────────────────────────────
   * 던전에서 주운 것을 여기서 갈아입힌다. 옛 '가방' 시트를 되살리는 대신
   * 던전 시트 안에 붙였다 — 장비가 나오는 곳이 던전 하나뿐이므로.
   */
  /* ── 장비 — 원작(2편)의 격자 가방과 종이인형 ───────
   *
   * 원작에서 가방은 목록이 아니라 **격자**다. 물건마다 차지하는 칸이 다르고,
   * 이름은 안 보이고 그림과 **등급 테두리**만 보인다. 무엇을 버릴지는 색으로
   * 정하고, 자세한 것은 하나를 짚었을 때 뜨는 검은 쪽지가 말한다.
   * 그 셋(격자 · 등급색 · 쪽지)을 그대로 옮겼다.
   *
   * 칸 수는 원작처럼 종류마다 다르다 — 무기·갑주는 두 칸을 먹고 부적은 한 칸이다.
   * 자리를 세이브에 적지는 않는다(격자 좌표를 저장하면 가방 구조가 통째로 바뀐다).
   * CSS grid 의 dense 배치에 맡기되, 순서를 값어치 순으로 고정해 자리가 안 흔들리게 한다.
   */

  /** 지금 짚어 둔 물건·인물 — 화면에만 사는 값이라 세이브에 넣지 않는다 */
  var gearSel = null, gearHero = null, gearTab = 'bag';

  /** 종류별 그림 — 원작의 물건 그림 자리다 (여기서는 글자 하나로 대신한다) */
  var LOOK_ICON = {
    sword: '\u2694\uFE0F', club: '\uD83D\uDD28', spear: '\uD83D\uDD31',
    guandao: '\uD83D\uDDE1\uFE0F', bow: '\uD83C\uDFF9', axe: '\uD83E\uDE93',
    fan: '\uD83E\uDEAD', staff: '\uD83E\uDD62', brush: '\uD83D\uDD8C\uFE0F',
    scroll: '\uD83D\uDCDC'
  };
  var SLOT_ICON = {
    weapon: '\u2694\uFE0F', armor: '\uD83E\uDD4B', charm: '\uD83D\uDCFF',
    helm: '\uD83E\uDE96', glove: '\uD83E\uDDE4', boot: '\uD83E\uDD7E',
    ring: '\uD83D\uDC8D', neck: '\uD83D\uDCFF'
  };
  var SLOT_SPAN = {
    weapon: 2, armor: 2, charm: 1,
    helm: 1, glove: 1, boot: 1, ring: 1, neck: 1
  };   // 세로로 먹는 칸 수

  function gearIcon(g) {
    var it = global.DG.item, b = it.baseOf(g);
    if (!b) { return '?'; }
    return (b.look && LOOK_ICON[b.look]) || SLOT_ICON[b.slot] || '?';
  }

  /** 효과 목록을 사람 말로 (투장·부문어가 같은 모양을 쓴다) */
  function effLines(list) {
    var it = global.DG.item, out = [], i;
    for (i = 0; i < list.length; i++) {
      var e = list[i];
      var who = e.stat === 'all' ? '전 능력치' : it.statKor(e.stat);
      if (e.kind === 'flat') { out.push(who + ' +' + e.v); }
      else if (e.kind === 'pct') { out.push(who + ' +' + e.v + '%'); }
      else { out.push(it.effKor(e.eff) + ' +' + e.v + '%'); }
    }
    return out;
  }

  /** 검은 쪽지 — 원작에서 물건 위에 뜨는 그것 */
  /** 창고 ↔ 가방 단추 — 쪽지 아래에 늘 붙는다 */
  function stashBtn(g, where) {
    return where === 'stash'
      ? '<button class="btn tiny ghost" data-act="gear-unstash" data-id="' + g.uid +
        '">\uD83C\uDF92 가방으로</button>'
      : '<button class="btn tiny ghost" data-act="gear-stash" data-id="' + g.uid +
        '">\uD83D\uDDC3\uFE0F 창고로</button>';
  }

  function gearTip(g, where) {
    var it = global.DG.item, t = it.tierOf(g), b = it.baseOf(g);
    var sn = it.socketsOf(g).length, se = it.emptySockets(g);
    var own = it.bestOwner(g);

    /* 미확인 — 원작에서 등급색은 보이고 옵션은 안 보인다.
       그 색만 보고 감정서를 태울지 정하는 것이 이 화면의 전부다. */
    if (it.isUnid(g)) {
      var have = it.scrolls();
      return '<div class="d2-tip">' +
        '<b class="d2-nm" style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
        '<span class="d2-base">' + esc(b ? b.name : '') + ' \u00b7 ' + t.name +
          '(' + t.hanja + ') \u00b7 <b style="color:#8ec7ff">미확인</b></span>' +
        '<div class="muted">감정해야 옵션이 보입니다. <b>미확인은 입을 수 없습니다.</b></div>' +
        '<div class="d2-act">' +
          (have ? '<button class="btn tiny primary" data-act="gear-ident" data-id="' + g.uid +
                  '">\uD83D\uDD0E 감정 (감정서 ' + have + '장)</button>'
                : '<span class="muted" style="font-size:11px">감정서가 없습니다 — 행상에서 삽니다</span>') +
          '<button class="btn tiny ghost" data-act="gear-lock" data-id="' + g.uid + '">' +
            (g.lock ? '\uD83D\uDD12 잠김' : '\uD83D\uDD13 잠그기') + '</button>' +
          stashBtn(g, where) +
        '</div></div>';
    }

    var html = '<div class="d2-tip">' +
      '<b class="d2-nm" style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
      '<span class="d2-base">' + esc(b ? b.name : '') + ' \u00b7 ' + t.name +
        '(' + t.hanja + ') \u00b7 값 ' + it.power(g) + '</span>';
    var ls = it.lines(g), i;
    for (i = 0; i < ls.length; i++) { html += '<div>' + esc(ls[i]) + '</div>'; }
    /* 비전(§5.10) — 전설 한 점에 하나, 그 비결을 건 무예를 키운다 */
    var lore1 = global.DG.secret && global.DG.secret.loreLine ? global.DG.secret.loreLine(g) : '';
    if (lore1) { html += '<div style="color:#f0a53a">' + esc(lore1) + '</div>'; }
    /* 내구 — 부적은 안 닳으므로 줄 자체가 없다 */
    var dmax = it.durMaxOf(g);
    if (dmax) {
      var dn = it.durOf(g), rc = it.repairCost(g);
      html += '<div style="color:' + (it.isBroken(g) ? 'var(--bad)' : 'var(--ink-dim)') + '">' +
        '내구 ' + dn + ' / ' + dmax +
        (it.isBroken(g) ? ' \u00b7 <b>부서짐 — 값을 못 냅니다</b>' : '') +
        (rc ? ' \u00b7 수리 ' + core.fmt(rc) + '금' : '') + '</div>';
    }
    /* 고유 — 이름 아래에 그 물건의 내력을 한 줄 (원작의 유니크가 그렇다) */
    var uq1 = it.uniqOf(g);
    if (uq1) {
      html += '<div style="color:#c7a76c;font-size:11px;margin-top:2px">⭐ ' +
        esc(uq1.desc) + '</div>';
    }

    /* 투장 — 몇 점 걸쳤는지, 지금 붙는 것과 아직 안 붙는 것 */
    var st1 = it.setOf(g);
    if (st1) {
      var worn = 0, hid;
      for (hid in core.save.gear.equip) {
        if (!Object.prototype.hasOwnProperty.call(core.save.gear.equip, hid)) { continue; }
        var c0 = it.setCounts(hid)[st1.key] || 0;
        if (c0 > worn) { worn = c0; }
      }
      html += '<div style="color:#00c000;margin-top:4px">〈' + esc(st1.name) + '〉 ' +
        worn + ' / ' + st1.pieces.length + ' 점</div>' +
        '<div class="muted" style="font-size:11px">' + esc(st1.desc) + '</div>';
      var kk;
      for (kk in st1.bonus) {
        if (!Object.prototype.hasOwnProperty.call(st1.bonus, kk)) { continue; }
        var on = worn >= parseInt(kk, 10);
        html += '<div style="font-size:11px;color:' + (on ? '#00c000' : 'var(--ink-faint)') + '">' +
          kk + '점 — ' + esc(effLines(st1.bonus[kk]).join(' · ')) + '</div>';
      }
      /* 투장 전용 무예(2026-09-10) — 세 점째의 진짜 보상. 아직 못 갖췄어도
         무엇을 노리고 모으는지 미리 보여 준다(원작에서 세트 물건의 다음
         줄이 다 그렇게 흐리게 미리 보인다). */
      if (st1.skill) {
        var skOn = worn >= 3;
        html += '<div style="font-size:11px;color:' + (skOn ? '#00c000' : 'var(--ink-faint)') + '">' +
          '3점 — 무예 ' + st1.skill.emoji + ' ' + esc(st1.skill.name) +
          ' · ' + esc(st1.skill.desc) + '</div>';
      }
    }
    if (sn) {
      html += '<div class="d2-sock">세공 구멍 ' + (sn - se) + ' / ' + sn +
        (se ? ' <span class="muted">(빈 구멍 ' + se + ')</span>' : '') + '</div>';
    }
    html += '<div class="d2-act">' +
      (own ? '<button class="btn tiny primary" data-act="gear-equip" data-id="' + g.uid +
             '" data-hero="' + own.id + '">' + esc((data.find(own.id) || {}).name || '') +
             ' 에게 (\u25b2' + own.gain + ')</button>'
           : '<span class="muted" style="font-size:11px">지금 동행에겐 보탬이 안 됩니다</span>') +
      '<button class="btn tiny ghost" data-act="gear-lock" data-id="' + g.uid + '">' +
        (g.lock ? '\uD83D\uDD12 잠김' : '\uD83D\uDD13 잠그기') + '</button>' +
      (it.repairCost(g) ? '<button class="btn tiny" data-act="gear-repair" data-id="' + g.uid +
        '">\uD83D\uDD27 수리 ' + priceTag(it.repairCost(g)) + '</button>' : '') +
      '<button class="btn tiny ghost" data-act="gear-sell" data-id="' + g.uid + '">' +
        '\uD83E\uDE99 ' + core.fmt(it.price(g)) + '</button>' +
      stashBtn(g, where) +
      '</div></div>';
    return html;
  }

  /** 종이인형 — 고른 인물이 걸치고 있는 것 */
  function gearDoll() {
    var it = global.DG.item;
    var party = core.save.party;
    if (!party.length) { return '<div class="hint">동행이 없습니다.</div>'; }
    if (party.indexOf(gearHero) < 0) { gearHero = party[0]; }
    var h = data.find(gearHero);
    var eq = it.equipped(gearHero);

    function slot(k, kor) {
      var g = eq[k];
      if (!g) {
        return '<div class="d2-dslot"><span class="muted">' + kor +
          '<small>비었다</small></span></div>';
      }
      var t = it.tierOf(g);
      if (it.isBroken(g)) {
        return '<div class="d2-dslot" data-act="gear-off" data-hero="' + gearHero +
          '" data-slot="' + k + '" title="벗는다">' +
          '<span style="color:var(--bad)">\uD83D\uDD27 ' + esc(it.name(g)) +
          '<small>' + kor + ' \u00b7 부서짐 \u2014 수리해야 값을 냅니다</small></span></div>';
      }
      return '<div class="d2-dslot" data-act="gear-off" data-hero="' + gearHero +
        '" data-slot="' + k + '" title="벗는다">' +
        '<span style="color:' + t.color + '">' + esc(it.name(g)) +
        '<small>' + kor + ' \u00b7 눌러 벗기</small></span></div>';
    }

    /* 인물 고르기 — 원작엔 없는 줄이지만 이 판은 동행이 여럿이라 있어야 한다 */
    var tabs = '', i;
    for (i = 0; i < party.length; i++) {
      var ph = data.find(party[i]);
      if (!ph) { continue; }
      tabs += '<button class="btn tiny' + (party[i] === gearHero ? ' primary' : ' ghost') +
        '" data-act="gear-hero" data-hero="' + party[i] + '">' + esc(ph.name) + '</button>';
    }

    return '<div class="bagtools">' + tabs + '</div>' +
      '<div class="d2-doll">' +
        slot('weapon', '무기') +
        '<div class="d2-who">' + pt('hero', h, 46) +
          '<b>' + esc(h ? h.name : '') + '</b>' +
          '<small>Lv.' + (hero().info(gearHero).lv || 1) + '</small></div>' +
        slot('armor', '갑주') +
      '</div>' +
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('helm', '투구') + slot('glove', '장갑') +
      '</div>' +
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('boot', '신발') + slot('ring', '반지') +
      '</div>' +
      '<div class="d2-doll" style="grid-template-columns:1fr 1fr">' +
        slot('neck', '목걸이') + slot('charm', '부적') +
      '</div>';
  }

  /** 격자 한 판 — 가방이든 창고든 같은 모양으로 그린다 */
  function gearGrid(list, where) {
    var it = global.DG.item;
    var sorted = list.slice().sort(function (a, b) { return it.power(b) - it.power(a); });
    var html = '<div class="d2-inv">', i, sel = null, used = 0;
    for (i = 0; i < sorted.length; i++) {
      var g = sorted[i], t = it.tierOf(g), b = it.baseOf(g);
      var span = SLOT_SPAN[b ? b.slot : 'charm'] || 1;
      var ns = it.socketsOf(g).length;
      used += span;
      if (g.uid === gearSel) { sel = g; }
      html += '<div class="d2-it' + (g.uid === gearSel ? ' on' : '') + (g.lock ? ' lock' : '') +
        '" style="grid-row:span ' + span + ';box-shadow:inset 0 0 0 1px ' + t.color +
        ', inset 0 0 14px rgba(0,0,0,.8)" data-act="gear-sel" data-id="' + g.uid +
        '" data-where="' + where + '" title="' + esc(it.name(g)) + '">' +
        (it.isUnid(g) ? '?' : gearIcon(g)) +
        (it.isBroken(g) ? '<b class="d2-broke">\uD83D\uDD27</b>' : '') +
        (ns ? '<i style="color:' + t.color + '">' + ns + '홈</i>' : '') +
        '</div>';
    }
    var rows = Math.max(4, Math.ceil(used / 10) + 1);
    for (i = used; i < rows * 10; i++) { html += '<div class="d2-slot"></div>'; }
    return { html: html + '</div>', sel: sel };
  }

  /* ── 창고(倉庫) — 원작의 stash ────────────────────────────
   * 자리가 모자라서 두는 게 아니다(가방이 예순 칸이다).
   * 뜻은 하나 — **자동이 손대지 않는 자리**. 그 넷은 전부 bag() 만 훑으므로
   * 창고에 넣는 것만으로 저절로 지켜진다.
   */
  function viewStash() {
    var it = global.DG.item;
    var list = it.stash();
    var html = '<div class="sec"><h4>창고 <span class="muted">' +
      list.length + ' / ' + it.stashCap() + '</span></h4>' +
      '<div class="hint">창고에 넣어 둔 것은 <b>자동이 손대지 않습니다</b> \u2014 ' +
      '자동 정리에 팔리지 않고, 자동 장착·연단·되는 데까지 감정에도 안 씁니다.<br>' +
      '<span class="muted">원작 그대로 <b>던전 안에서는 열리지 않습니다</b>.</span></div>';
    if (!it.stashOpen()) {
      return html + '<div class="card"><small class="muted">던전에 들어가 있습니다 \u2014 ' +
        '나와서 여세요.</small></div></div>';
    }
    if (!list.length) {
      return html + '<div class="hint">비었습니다 \u2014 가방 탭에서 넣습니다.</div></div>';
    }
    var g = gearGrid(list, 'stash');
    html += g.html;
    html += g.sel ? gearTip(g.sel, 'stash')
                  : '<div class="hint">칸을 하나 누르면 그 물건의 쪽지가 뜹니다.</div>';
    return html + '</div>';
  }

  function gearSection() {
    var it = global.DG.item;
    if (!it) { return ''; }
    var head = tabBar('gear-tab', gearTab,
      [['bag', '\uD83C\uDF92 \uAC00\uBC29'], ['stash', '\uD83D\uDDC3\uFE0F \uCC3D\uACE0']]);
    if (gearTab === 'stash') { return head + viewStash(); }

    var bag = it.bag();
    var html = head + '<div class="sec"><h4>장비</h4>' + gearDoll() + '</div>';

    html += '<div class="sec"><h4>가방 <span class="muted">' +
      bag.length + ' / ' + it.bagCap() + '</span></h4>';

    if (!bag.length) {
      return html + '<div class="hint">가방이 비었습니다 \u2014 던전에서 주워 오세요.</div></div>';
    }

    /* 감정 — 미확인이 있으면 가장 먼저 할 일이다 */
    var unid = it.unidList().length, scroll = it.scrolls();
    if (unid) {
      html += '<div class="hint">미확인 <b style="color:#8ec7ff">' + unid + '점</b> · ' +
        '감정서 <b>' + scroll + '장</b><br>' +
        '<span class="muted">미확인은 입을 수 없고, 자동 정리에도 팔리지 않습니다.</span></div>' +
        '<div class="bagtools"><button class="btn tiny primary" data-act="gear-identall"' +
        (scroll ? '' : ' disabled') + '>\uD83D\uDD0E 되는 데까지 감정</button></div>';
    }

    html += '<div class="bagtools">' +
      '<button class="btn tiny" data-act="gear-auto">\u2728 자동 장착</button>' +
      '<button class="btn tiny ghost" data-act="gear-clean">\uD83E\uDDF9 쓸모없는 것 정리</button></div>';

    /* 격자는 gearGrid 하나가 그린다 — 가방과 창고가 같은 모양이어야 한다 */
    if (gearSel && !it.findAnywhere(gearSel)) { gearSel = null; }
    var gr = gearGrid(bag, 'bag');
    html += gr.html;
    html += gr.sel ? gearTip(gr.sel, 'bag')
                   : '<div class="hint">칸을 하나 누르면 그 물건의 쪽지가 뜹니다.</div>';

    return html + '</div>';
  }

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
      '<div class="sec"><h4>' + cls.emoji + ' ' + esc(cls.name) + '(' + cls.hanja + ')</h4>' +
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
        '</div></div>';

    /* 네 칸 */
    var eq = SK.equipped(skillHero);
    var KEYS = ['Z', 'X', 'C', 'V'];
    html += '<div class="sec"><h4>손에 든 넷</h4>' +
      '<div class="hint">배운 것을 <b>네 칸에 걸어야</b> 던전에서 씁니다 — ' +
      '원작에서도 배운 걸 다 손에 들진 못합니다.</div><div class="bagtools">';
    for (i = 0; i < eq.length; i++) {
      html += '<button class="btn tiny' + (skillSlotPick === i ? ' primary' : ' ghost') +
        '" data-act="skill-slot" data-idx="' + i + '">' + KEYS[i] + ' ' +
        (eq[i] ? eq[i].sk.emoji + ' ' + esc(eq[i].sk.name) : '<span class="muted">비었다</span>') +
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
          '<div class="gr-top"><b>' + sk.emoji + ' ' + esc(sk.name) + '</b>' +
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
          '</div>' + secretRow(skillHero, sk, rank) + '</div>';
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

  function viewVendor() {
    if (!global.DG.vendor) { return '<div class="hint">행상 모듈이 없습니다</div>'; }
    var head = tabBar('vendor-tab', vendorTab, [
      ['buy', '\uD83E\uDDFA \uC0AC\uB2E4'], ['sell', '\uD83E\uDE99 \uD314\uB2E4'],
      ['back', '\u21A9\uFE0F \uB418\uC0AC\uAE30'], ['gamble', '\uD83C\uDFB2 \uD22C\uC804']
    ]);
    return head + (vendorTab === 'sell' ? vendorSell()
                 : vendorTab === 'back' ? vendorBack()
                 : vendorTab === 'gamble' ? vendorGamble()
                 : vendorBuy());
  }

  /** 물건 한 줄 — 이름(등급색) · 옵션 · 오른쪽에 단추 */
  function gearRow(g, btn) {
    var it = global.DG.item, t = it.tierOf(g);
    var ns = it.socketsOf(g).length;
    return '<div class="grow" style="border-left-color:' + t.color + '">' +
      '<div class="gr-top"><b style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
      '<span class="gr-lv">' + t.name + (ns ? ' \u00B7 ' + ns + '\uD640' : '') + '</span></div>' +
      '<div class="gr-opts">' + esc(it.lines(g).join(' \u00B7 ')) + '</div>' +
      (global.DG.secret && global.DG.secret.loreLine && global.DG.secret.loreLine(g)
        ? '<div class="gr-opts" style="color:#f0a53a">' + esc(global.DG.secret.loreLine(g)) + '</div>' : '') +
      '<div class="gr-btns">' + btn + '</div></div>';
  }

  /** 단약 — 원작의 상인은 물약이 떨어지지 않는다. 재고 목록을 안 탄다 */
  function vendorPotions() {
    var V = global.DG.vendor, P = global.DG.potion;
    if (!P) { return ''; }
    var list = V.potionsForSale(), i;
    var html = '<div class="sec"><h4>단약(丹藥) <span class="muted">요대 ' +
      P.total() + ' / ' + (P.SLOTS * P.STACK) + '</span></h4>' +
      '<div class="hint">물약은 <b>떨어지지 않습니다</b> — 늘 살 수 있습니다. ' +
      '던전에서 <b>1 2 3 4</b> 로 마십니다.<br>' +
      '<span class="muted">파는 등급은 내려가 본 깊이를 탑니다.</span></div>' +
      '<div class="bagtools" style="flex-wrap:wrap">';
    /* 감정서 — 원작의 감정 주문서. 막는 관문이 아니라 거쳐 가는 자리라 싸다 */
    html += '<button class="btn tiny" data-act="vendor-scroll" data-n="1">' +
      '\uD83D\uDD0E 감정서 ' + priceTag(V.scrollPrice()) + '</button>' +
      '<button class="btn tiny" data-act="vendor-scroll" data-n="10">' +
      '\uD83D\uDD0E ×10 ' + priceTag(V.scrollPrice() * 10) + '</button>';
    for (i = 0; i < list.length; i++) {
      var row = list[i], kd = P.kindOf(row.kind);
      html += '<button class="btn tiny" data-act="vendor-potion" data-kind="' + row.kind +
        '" data-g="' + row.g + '" style="color:' + kd.color + '">' +
        kd.emoji + ' ' + esc(P.label(row.kind, row.g)) + ' ' + priceTag(row.price) +
        '</button>';
    }
    return html + '</div></div>';
  }

  /** 수리 — 원작에서 마을에 들르는 이유의 절반이 이것이다 */
  function vendorRepair() {
    var it = global.DG.item;
    var need = it.repairList(), cost = it.repairAllCost();
    var html = '<div class="sec"><h4>수리(修理)</h4>' +
      '<div class="hint">장비는 <b>층을 내려갈 때마다</b> 닳습니다. ' +
      '다 닳으면 <b>부서져 아무 값도 못 냅니다</b> \u2014 없어지지는 않습니다.<br>' +
      '<span class="muted">부적은 닳지 않습니다.</span></div>';
    if (!need.length) {
      return html + '<div class="card"><small class="muted">닳은 것이 없습니다.</small></div></div>';
    }
    html += '<div class="bagtools"><button class="btn tiny primary" data-act="gear-repairall">' +
      '\uD83D\uDD27 모두 수리 ' + priceTag(cost) + '</button></div>';
    var i;
    for (i = 0; i < need.length; i++) {
      var g = need[i].item, t = it.tierOf(g);
      html += '<div class="grow" style="border-left-color:' +
        (it.isBroken(g) ? 'var(--bad)' : t.color) + '">' +
        '<div class="gr-top"><b style="color:' + t.color + '">' + esc(it.name(g)) + '</b>' +
        '<span class="gr-lv">' + esc((data.find(need[i].hero) || {}).name || '') + '</span></div>' +
        '<div class="gr-opts' + (it.isBroken(g) ? ' warn' : '') + '">내구 ' +
          it.durOf(g) + ' / ' + it.durMaxOf(g) +
          (it.isBroken(g) ? ' · 부서짐' : '') + '</div>' +
        '<div class="gr-btns"><button class="btn tiny" data-act="gear-repair" data-id="' +
          g.uid + '">\uD83D\uDD27 ' + priceTag(it.repairCost(g)) + '</button></div></div>';
    }
    return html + '</div>';
  }

  function vendorBuy() {
    var V = global.DG.vendor, list = V.stock(), i;
    var html = vendorRepair() + vendorPotions() +
      '<div class="sec"><h4>사다 <span class="muted">수준 ' + V.ilvl() + '</span></h4>' +
      '<div class="hint">재고는 <b>회차가 끝날 때마다</b> 새로 옵니다 \u2014 ' +
      '마음에 안 들면 한 판 더 돌고 오세요. 새로 고치는 단추는 없습니다.<br>' +
      '<span class="muted">보물·전설은 팔지 않습니다. 그건 던전과 투전에서만 나옵니다.</span></div>';
    if (!list.length) {
      html += '<div class="card"><small class="muted">물건을 다 샀습니다 \u2014 ' +
        '다음 회차에 새로 옵니다.</small></div>';
    }
    for (i = 0; i < list.length; i++) {
      html += gearRow(list[i],
        '<button class="btn tiny primary" data-act="vendor-buy" data-id="' + list[i].uid + '">' +
        priceTag(V.buyPrice(list[i])) + ' 사기</button>');
    }
    return html + '</div>';
  }

  function vendorSell() {
    var it = global.DG.item, bag = it.bag(), i;
    var html = '<div class="sec"><h4>팔다 <span class="muted">' + bag.length + '점</span></h4>' +
      '<div class="hint">판 것은 <b>되사기</b>에 남습니다 \u2014 판 값 그대로 되살 수 있습니다. ' +
      '다만 <b>회차가 끝나면 사라집니다</b>.</div>';
    var sorted = bag.slice().sort(function (a, b) { return it.power(a) - it.power(b); });
    if (!sorted.length) {
      html += '<div class="card"><small class="muted">가방이 비었습니다.</small></div>';
    }
    for (i = 0; i < sorted.length; i++) {
      var g = sorted[i];
      html += gearRow(g, g.lock
        ? '<span class="muted" style="font-size:11px">\uD83D\uDD12 잠겨 있습니다</span>'
        : '<button class="btn tiny" data-act="vendor-sell" data-id="' + g.uid + '">' +
          '\uD83E\uDE99 ' + core.fmt(it.price(g)) + ' 에 팔기</button>');
    }
    return html + '</div>';
  }

  function vendorBack() {
    var V = global.DG.vendor, list = V.backlog(), i;
    var html = '<div class="sec"><h4>되사기</h4>' +
      '<div class="hint">방금 판 것들입니다. <b>판 값 그대로</b> 되살 수 있습니다.</div>';
    if (!list.length) {
      html += '<div class="card"><small class="muted">아직 판 것이 없습니다.</small></div>';
    }
    for (i = 0; i < list.length; i++) {
      html += gearRow(list[i].item,
        '<button class="btn tiny primary" data-act="vendor-back" data-id="' +
        list[i].item.uid + '">' + priceTag(list[i].price) + ' 되사기</button>');
    }
    return html + '</div>';
  }

  function vendorGamble() {
    var V = global.DG.vendor, D = global.DG.itemData, list = V.gambleList(), i;
    var html = '<div class="sec"><h4>투전(投錢)</h4>' +
      '<div class="hint"><b>무엇이 나올지는 사고 나서 압니다.</b> 부위와 종류만 알려 줍니다.<br>' +
      '값은 비싸지만 <b>좋은 등급이 훨씬 잘 나옵니다</b> \u2014 던전 드랍보다 위쪽이 두껍습니다.<br>' +
      '<span class="muted">한 칸을 사면 그 자리에 새 물건이 놓입니다.</span></div>';
    for (i = 0; i < list.length; i++) {
      var row = list[i];
      var b = D.baseByKey(row.base);
      if (!b) { continue; }
      html += '<div class="grow" style="border-left-color:#6b5836">' +
        '<div class="gr-top"><b>' + esc(b.name) + '</b>' +
        '<span class="gr-lv">' + D.slotKor(b.slot) + ' \u00B7 수준 ' + row.lv + '</span></div>' +
        '<div class="gr-opts muted">등급도 옵션도 알 수 없습니다.</div>' +
        '<div class="gr-btns"><button class="btn tiny primary" data-act="vendor-gamble" ' +
          'data-idx="' + i + '">' + priceTag(row.price) + ' 걸기</button></div></div>';
    }
    return html + '</div>';
  }

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

  function viewCraft() {
    return tabBar('craft-tab', craftTab,
             [['socket', '\uD83D\uDD28 \uC138\uACF5'], ['forge', '\u2697\uFE0F \uC5F0\uB2E8']]) +
           (craftTab === 'forge' ? viewForge() : viewSocket());
  }

  /* ── 연단(鍊丹) — 원작의 조합 상자 ────────────────────
   * 규칙은 forge.js 가 다 안다. 여기는 그 표를 읽어 늘어놓기만 한다.
   */
  function viewForge() {
    var F = global.DG.forge;
    if (!F) { return '<div class="hint">연단 모듈이 없습니다</div>'; }
    var html = '<div class="sec"><h4>연단(鍊丹)</h4><div class="card">' +
      '<small class="muted">여럿을 넣으면 <b>더 나은 하나</b>가 나옵니다. ' +
      '재료는 <b>그 자리에서 사라집니다</b> \u2014 잠근 것은 재료로 쓰지 않습니다.<br>' +
      '<b>구멍은 뚫을 수 없습니다</b> \u2014 구멍은 장비가 나올 때 정해집니다.</small>' +
      '</div></div>';

    var groups = F.all(), i, j, any = false;
    for (i = 0; i < groups.length; i++) {
      var r = groups[i].recipe, rows = groups[i].rows;
      html += '<div class="sec"><h4>' + r.emoji + ' ' + esc(r.name) + '</h4>' +
        '<div class="hint">' + esc(r.need) + '<br><span class="muted">' +
        esc(r.desc) + '</span></div>';
      if (!rows.length) {
        html += '<div class="card"><small class="muted">지금은 넣을 것이 없습니다.</small></div>';
      } else {
        any = true;
        for (j = 0; j < rows.length; j++) {
          var row = rows[j];
          html += '<div class="grow" style="border-left-color:' + row.color + '">' +
            '<div class="gr-top"><b>' + esc(row.label) + '</b>' +
            '<span class="gr-lv">\u2192 <span style="color:' + row.color + '">' +
              esc(row.into) + '</span></span></div>' +
            '<div class="gr-btns"><button class="btn tiny primary" data-act="forge-make" ' +
              'data-id="' + esc(row.id) + '">\u2697\uFE0F 넣는다</button>' +
            (row.have > 1 ? '<span class="muted" style="font-size:11px">가진 것 ' +
              row.have + '</span>' : '') +
            '</div></div>';
        }
      }
      html += '</div>';
    }
    if (!any) {
      html += '<div class="hint">재료가 더 모이면 여기에 뜹니다 \u2014 ' +
        '같은 보석 셋, 같은 부문 셋, 같은 부위·등급의 장비 셋.</div>';
    }
    return html;
  }

  function viewSocket() {
    var it = global.DG.item, GD = global.DG.gemData;
    var mats = it.matList();
    var html = '<div class="sec"><h4>세공</h4><div class="card">' +
      '<small class="muted">박을 것을 고르고, 아래에서 <b>박을 장비</b>를 고릅니다. ' +
      '<b>한 번 박은 것은 뺄 수 없습니다.</b><br>' +
      '부문(符文)은 <b>박은 순서</b>가 맞아야 부문어(符文語)가 이루어집니다.<br>' +
      '<b>주옥(珠玉)</b>은 접사가 굴러 나옵니다 — 보석과 달리 <b>부위를 안 가립니다</b>.</small>';
    if (craftMat) {
      var d;
      if (craftMat.kind === 'jewel') {
        var jsel = it.jewelById(craftMat.key);
        d = jsel ? GD.jewelName(jsel) : '주옥';
      } else if (craftMat.kind === 'gem') {
        d = GD.grade(craftMat.g).name + ' ' + GD.gemByKey(craftMat.key).name;
      } else {
        d = GD.runeByKey(craftMat.key).glyph + '(' + GD.runeByKey(craftMat.key).name + ')';
      }
      html += '<div class="stat-row"><span>고른 것</span><b>' + esc(d) + '</b></div>' +
        '<button class="btn tiny ghost wide" data-act="craft-cancel">고른 것을 놓는다</button>';
    }
    html += '</div></div>';

    /* 가진 재료 */
    html += '<div class="sec"><h4>가진 것</h4>';
    if (!mats.length) {
      html += '<div class="card"><small class="muted">아직 없습니다 — 던전에서 나옵니다. ' +
        '부문은 층이 깊어야 나옵니다.</small></div>';
    } else {
      html += '<div class="bagtools">';
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i];
        if (m.kind === 'jewel') { continue; }        // 주옥은 아래에 낱개로 늘어놓는다
        var lab = m.kind === 'gem'
          ? (m.grade.name + ' ' + m.def.name)
          : (m.def.glyph + '(' + m.def.name + ')');
        var col = m.kind === 'gem' ? m.grade.color : '#f0a53a';
        var on = craftMat && craftMat.kind === m.kind && craftMat.key === m.key &&
                 (m.kind === 'rune' || craftMat.g === m.g);
        html += '<button class="btn tiny ' + (on ? 'primary' : '') + '" data-act="craft-pick"' +
          ' data-kind="' + m.kind + '" data-key="' + m.key + '" data-g="' + (m.g || 0) + '"' +
          ' style="color:' + (on ? '' : col) + '">' + esc(lab) + ' ×' + m.n + '</button>';
      }
      html += '</div>';
    }

    /* 주옥(珠玉) — 낱개라 개수로 못 묶는다. 하나하나가 딴 물건이므로
       무엇이 붙었는지 **줄로 보여 준다** — 그걸 보고 어디에 박을지 정한다 */
    var jl = it.jewels();
    html += '<div><h4 style="margin:10px 0 4px;font-size:13px">' +
      '◈ 주옥(珠玉) <small class="muted">' + jl.length + ' / ' + it.jewelCap() +
      '</small></h4>';
    if (!jl.length) {
      html += '<div class="card"><small class="muted">아직 없습니다 — ' +
        '<b>제4층부터</b> 드물게 나옵니다. 보석과 달리 <b>부위를 안 가립니다</b>.</small></div>';
    }
    for (var jx = 0; jx < jl.length; jx++) {
      var jw = jl[jx];
      var jon = craftMat && craftMat.kind === 'jewel' && craftMat.key === jw.id;
      var jlines = [], je = GD.jewelEff(jw), jy;
      for (jy = 0; jy < je.length; jy++) { jlines.push(it.effLine(je[jy])); }
      html += '<div class="card gearcard">' +
        '<div class="gearname" style="color:#f07ac0">◈ ' + esc(GD.jewelName(jw)) + '</div>' +
        '<div class="muted" style="font-size:11.5px">' + esc(jlines.join(' · ')) + '</div>' +
        '<button class="btn tiny ' + (jon ? 'primary' : 'ghost') + '" data-act="craft-pick"' +
          ' data-kind="jewel" data-key="' + esc(jw.id) + '" data-g="0">' +
          (jon ? '고른 것' : '고른다') + '</button>' +
      '</div>';
    }
    html += '</div>';
    html += '</div>';

    /* 구멍이 있는 장비 — 장착한 것과 가방을 함께 */
    var targets = [];
    var party = core.save.party, k, j;
    for (j = 0; j < party.length; j++) {
      var eq = it.equipped(party[j]);
      for (k in eq) {
        if (Object.prototype.hasOwnProperty.call(eq, k) && eq[k] && it.socketsOf(eq[k]).length) {
          targets.push({ g: eq[k], who: (data.find(party[j]) || {}).name || '' });
        }
      }
    }
    var bagList = it.bag();
    for (j = 0; j < bagList.length; j++) {
      if (it.socketsOf(bagList[j]).length) { targets.push({ g: bagList[j], who: null }); }
    }

    html += '<div class="sec"><h4>구멍 있는 장비 <small class="muted">' +
      targets.length + '점</small></h4>';
    if (!targets.length) {
      html += '<div class="card"><small class="muted">구멍은 장비가 나올 때 정해집니다 — ' +
        '좋은 등급일수록 뚫려 나오기 쉽습니다.</small></div>';
    }
    for (j = 0; j < Math.min(14, targets.length); j++) {
      var tg = targets[j], gitem = tg.g, tier = it.tierOf(gitem);
      var sock = it.socketsOf(gitem), cells = '';
      for (var c = 0; c < sock.length; c++) {
        var s0 = sock[c];
        if (!s0) { cells += '<span class="sockcell empty">·</span>'; continue; }
        if (s0.t === 'jewel') {
          cells += '<span class="sockcell" style="color:#f07ac0">◈</span>';
        } else if (s0.t === 'rune') {
          var rd = GD.runeByKey(s0.key);
          cells += '<span class="sockcell rune">' + (rd ? rd.glyph : '符') + '</span>';
        } else {
          var gd2 = GD.gemByKey(s0.key);
          cells += '<span class="sockcell" style="color:' + GD.grade(s0.g).color + '">' +
            (gd2 ? gd2.emoji : '●') + '</span>';
        }
      }
      var word = it.wordOf(gitem);
      html += '<div class="card gearcard">' +
        '<div class="gearname" style="color:' + (word ? '#f0a53a' : tier.color) + '">' +
          esc(it.name(gitem)) +
          (tg.who ? ' <small class="muted">— ' + esc(tg.who) + '</small>' : '') + '</div>' +
        '<div class="socks">' + cells + '</div>' +
        '<div class="muted" style="font-size:11.5px">' + esc(it.lines(gitem).join(' · ')) + '</div>' +
        (word
          ? '<small style="color:#f0a53a">《' + esc(word.name) + '》 ' + esc(word.desc) + '</small>'
          : (it.emptySockets(gitem)
              ? '<button class="btn tiny ' + (craftMat ? 'primary' : 'ghost') + '"' +
                  (craftMat ? '' : ' disabled') +
                  ' data-act="craft-into" data-id="' + gitem.uid + '">여기에 박는다 (빈 구멍 ' +
                  it.emptySockets(gitem) + ')</button>'
              : '<small class="muted">구멍이 다 찼습니다</small>')) +
      '</div>';
    }
    html += '</div>';

    /* 부문어 표 — 무엇을 노릴지 보이게 */
    html += '<div class="sec"><h4>부문어(符文語)</h4>';
    for (var w = 0; w < GD.WORDS.length; w++) {
      var wd = GD.WORDS[w];
      var glyphs = wd.runes.map(function (rk) {
        var r = GD.runeByKey(rk);
        return r ? r.glyph : '?';
      }).join(' ');
      html += '<div class="card"><div class="stat-row">' +
        '<span><b>' + esc(wd.name) + '</b></span>' +
        '<b style="font-size:15px">' + glyphs + '</b></div>' +
        '<small class="muted">' + esc(wd.desc) +
        (wd.slot ? ' · <b>' + (wd.slot === 'weapon' ? '무기' : wd.slot) + '</b> 에만' : '') +
        '</small></div>';
    }
    return html + '</div>';
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


