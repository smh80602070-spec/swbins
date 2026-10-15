  /* ── 집 ───────────────────────────────────────────────────
   * 창고에서 고르고, **선 자리에 놓는다**(심기와 같은 규칙).
   * 넓히려면 증축을 신청하고 빚을 갚는다 — 원작의 융자다.
   */
  function viewHome() {
    var Hm = global.DG.home, V = global.DG.village, VD = global.DG.villageData;
    var stt = Hm.status(), html = '', i;
    var can = Hm.canPlaceHere();

    html += '<div class="sec"><h4>' + esc(stt.room.name) + '</h4><div class="card">' +
      '<div class="stat-row"><span>집 평가</span><b>' + esc(stt.grade) + ' · ' + stt.score + '점</b></div>' +
      '<div class="stat-row"><span>놓은 것</span><b>🪑 ' + stt.n + '점 · 어울림 ' + stt.bonus + '</b></div>' +
      '<div class="stat-row"><span>방 크기</span><b>' + stt.room.tw + ' × ' + stt.room.th + '</b></div>' +
      (stt.debt
        ? '<div class="stat-row"><span>남은 빚</span><b>🪙 ' + core.fmt(stt.debt) + '</b></div>'
        : '') +
      '<small class="muted">같은 계열을 셋 이상 놓으면 어울림 점수가 붙습니다. ' +
      '날이 바뀌면 평가서가 편지로 옵니다.</small></div></div>';

    /* 증축(융자) */
    html += '<div class="sec"><h4>증축</h4><div class="card">';
    if (stt.debt) {
      html += '<div class="stat-row"><span>갚아야 할 빚</span><b>🪙 ' + core.fmt(stt.debt) + '</b></div>' +
        '<button class="btn primary wide" data-act="v-repay" data-n="0">🪙 갚을 수 있는 만큼 갚는다</button>' +
        '<small class="muted">빚을 다 갚아야 다음 증축을 신청할 수 있습니다.</small>';
    } else if (stt.next) {
      html += '<div class="stat-row"><span>다음</span><b>' + esc(stt.next.name) +
          ' (' + stt.next.w + ' × ' + stt.next.h + ')</b></div>' +
        '<div class="stat-row"><span>빚</span><b>🪙 ' + core.fmt(stt.next.cost) + '</b></div>' +
        '<button class="btn primary wide" data-act="v-expand">🏠 증축을 신청한다</button>' +
        '<small class="muted">신청하면 그 자리에서 넓어지고 빚이 생깁니다.</small>';
    } else {
      html += '<small class="muted">이미 가장 큰 집입니다.</small>';
    }
    html += '</div></div>';

    /* 벽지와 장판 — 가진 것 중에서 고른다 */
    html += '<div class="sec"><h4>벽지와 장판</h4><div class="card">' +
      '<div class="stat-row"><span>지금</span><b>🎨 ' + esc(stt.wall.name) +
        ' · ' + esc(stt.floor.name) + '</b></div>' +
      '<div class="stat-row"><span>평가에 보탠 것</span><b>+' + stt.finish + '점</b></div>' +
      '</div>';
    [['wall', stt.walls, stt.wall, '벽'], ['floor', stt.floors, stt.floor, '바닥']]
      .forEach(function (e) {
        html += '<div class="card gearcard"><div class="gearname">' + e[3] + '</div>' +
          '<div class="bagtools">';
        for (var i = 0; i < e[1].length; i++) {
          var f = e[1][i], on = f.key === e[2].key;
          html += '<button class="btn tiny ' + (on ? 'primary' : 'ghost') + '"' +
            (on ? ' disabled' : '') + ' data-act="v-setfin" data-kind="' + e[0] +
            '" data-id="' + f.key + '">' + esc(f.name) + (on ? ' ✔' : '') + '</button>';
        }
        html += '</div></div>';
      });
    html += '<small class="muted">전방(🎒 가방 시트)에 날마다 벽지 한 벌 · 장판 한 벌이 ' +
      '들어옵니다. 기본이 아닌 것을 바르면 집 평가가 각각 +12 오릅니다.</small></div>';

    /* 창고 → 놓기 */
    html += '<div class="sec"><h4>창고</h4>';
    if (!stt.stock.length) {
      html += '<div class="hint">창고가 비었습니다 — 전방(🎒 가방 시트)에 날마다 가구 넉 점이 들어옵니다.</div>';
    } else {
      for (i = 0; i < stt.stock.length; i++) {
        var e = stt.stock[i];
        var set = VD.FURN_SETS[e.furn.set];
        html += '<div class="card gearcard">' +
          '<div class="gearname">' + ico('furniture', e.furn.key, 24, '🪑') + ' ' + esc(e.furn.name) + gradeTag('goods', e.furn.price) +
            ' <small class="muted">×' + e.n + ' · ' + esc(set ? set.name : '') +
            ' · 🪙 ' + core.fmt(e.furn.price) + '</small></div>' +
          '<div class="bagtools">' +
            '<button class="btn tiny ' + (can.ok ? 'primary' : 'ghost') + '"' +
              (can.ok ? '' : ' disabled') +
              ' data-act="v-place" data-id="' + e.furn.key + '">여기 놓는다</button>' +
            '<button class="btn tiny ghost" data-act="v-sellfurn" data-id="' + e.furn.key +
              '">되판다 (🪙 ' + core.fmt(Math.floor(e.furn.price / 2)) + ')</button>' +
          '</div></div>';
      }
      html += '<div class="hint">' +
        (stt.inside
          ? (can.ok ? '지금 선 자리에 놓을 수 있습니다.' : '지금 자리에는 못 놓습니다 — ' + esc(can.why) + '.')
          : '집 안에 들어가야 놓을 수 있습니다 (🏠 앞에서 ' + core.actHint() + ').') +
        ' 놓인 것 곁에서 <b>' + core.actHint() + '</b> 를 누르면 다시 거둡니다.</div>';
    }
    html += '</div>';
    return html;
  }



  /* ── 마을 (게시판 · 깃대) · 전체지도 — js/ui-town.js(R-4). 같은 이름 한 줄 넘김 ───────────── */
  var utH = null; function UT() { return global.DG.uiTown.setup(utH || (utH = { esc: esc })); }
  function viewTown() { return UT().viewTown(); }
  function viewMap() { return UT().viewMap(); }

  /* ── 침선방 (옷) ──────────────────────────────────────────
   * 원작의 재봉실이다. 사면 옷장에 남고, 옷장에 있는 것만 입는다.
   * 날마다 바뀌는 진열은 두지 않았다 — 옷은 취향이라 "오늘 것" 으로 막으면 답답하다.
   */
  /** 택배 접수대(PLAN §5.7) — 소포 셋 중 하나를 고른다. 셋은 종류(안전·깨지기·시간제한)와 목적지가 다 다르다 */
  function viewParcel() {
    var PC = global.DG.parcel, VDd = global.DG.villageData, stt = PC.status(), html = '', i;
    html += '<div class="sec"><h4>배달 기록</h4><div class="card">' +
      '<div class="stat-row"><span>누적 배달</span><b>📦 ' + stt.n + '건</b></div>' +
      '<div class="stat-row"><span>연속 (깨지거나 늦으면 끊김)</span><b>🔗 ' + stt.chain + '건' +
        (stt.chain + 1 >= PC.CHAIN_AT ? ' — 다음 배달 ×' + PC.CHAIN_MUL : ' (' + PC.CHAIN_AT + '건째부터 ×' + PC.CHAIN_MUL + ')') + '</b></div>' +
      '<div class="stat-row"><span>등급</span><b>🎖️ ' + (stt.grade ? esc(VDd.DELIVERY_GRADES[stt.grade - 1].name) : '견습') + '</b></div>' +
      (stt.next ? '<small class="muted">다음 등급 「' + esc(stt.next.name) + '」까지 ' + (stt.next.at - stt.n) + '건 — ' + esc(stt.next.note) + '</small>'
                : '<small class="muted">배달 등급을 모두 채웠습니다.</small>') +
      '</div></div>';
    if (stt.carrying) {
      var pk = VDd.PARCEL_KINDS[stt.kind];
      html += '<div class="sec"><h4>지금 들고 있는 소포</h4><div class="card">' +
        '<div class="gearname">' + pk.emoji + ' ' + esc(pk.name) + ' → ' + esc(stt.destName) + '</div>' +
        '<small class="muted">' + (stt.broken ? '🥚 깨졌습니다 — 보상이 절반이 됩니다. ' : '') + esc(pk.note) + '</small></div></div>';
      return html;
    }
    var offers = PC.offers();
    html += '<div class="sec"><h4>소포 고르기</h4>';
    for (i = 0; i < offers.length; i++) {
      var o = offers[i], k = VDd.PARCEL_KINDS[o.kind], dd = VDd.DELIVERY_DESTS[o.dest];
      html += '<div class="card gearcard"><div class="gearname">' + k.emoji + ' ' + esc(k.name) + ' → ' + dd.emoji + ' ' + esc(o.destName) + '</div>' +
        '<small class="muted">' + esc(k.note) + (o.limit ? ' · 시한 ' + o.limit + '초' : '') + ' · 거리 ' + o.dist + '칸</small>' +
        '<div class="bagtools"><button class="btn tiny primary" data-act="v-parcel" data-kind="' + o.kind + '" data-dest="' + o.dest +
        '">받는다 (🪙 ' + core.fmt(o.reward) + ')</button></div></div>';
    }
    return html + '</div>';
  }

  /** 상단에 "소포 → 어디" 한 줄 — 들고 있을 때만 */
  function parcelChip() {
    var PC = global.DG.parcel;
    if (!PC) { return ''; }
    var p = PC.status();
    if (!p.carrying) { return ''; }
    var t = '';
    if (p.deadline) { var d = new Date(p.deadline); t = ' ⏱️' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '까지'; }
    return (p.broken ? '🥚 깨짐' : '📦 소포') + ' → ' + esc(p.destName) + t + ' · ';
  }

  function viewWear() {
    var W2 = global.DG.wear, stt = W2.status();
    var html = '', i, j;

    html += '<div class="sec"><h4>지금 차림</h4><div class="card">' +
      '<div class="stat-row"><span>입은 것</span><b>🧵 ' + esc(stt.name) + '</b></div>' +
      '<small class="muted">고른 것은 마을을 걷는 <b>내 모습</b>에 그대로 나타납니다. ' +
      '도감의 인물 그림은 그대로입니다 — 옷은 내 것이지 그 사람의 것이 아니니까요.' +
      '</small></div></div>';

    for (i = 0; i < stt.parts.length; i++) {
      var p = stt.parts[i];
      html += '<div class="sec"><h4>' + esc(p.part.name) + '</h4>';
      for (j = 0; j < p.list.length; j++) {
        var e = p.list[j];
        html += '<div class="card gearcard' + (e.on ? ' hi' : '') + '">' +
          '<div class="gearname">' +
            (e.it.c ? '<span class="swatch" style="background:' + e.it.c + '"></span>' : ico('wear', e.it.key, 24, '🧵') + ' ') +
            esc(e.it.name) + gradeTag('goods', e.it.price) +
            (e.on ? ' <small class="muted">— 입고 있음</small>' : '') + '</div>' +
          '<div class="bagtools">' +
            (e.own
              ? (e.on
                  ? '<button class="btn tiny ghost" disabled>입고 있음</button>'
                  : '<button class="btn tiny primary" data-act="v-wset" data-kind="' +
                    p.part.key + '" data-id="' + e.it.key + '">입는다</button>')
              : (e.it.unlock
                  ? '<button class="btn tiny ghost" disabled>🔒 배달 ' + e.it.at + '건</button>'
                  : '<button class="btn tiny" data-act="v-wbuy" data-kind="' + p.part.key +
                    '" data-id="' + e.it.key + '">짓는다 (🪙 ' + core.fmt(global.DG.workshop ? global.DG.workshop.cost(e.it.price) : e.it.price) + ')</button>')) +
          '</div></div>';
      }
      html += '</div>';
    }
    return html;
  }

  /* ── 사고(史庫) ───────────────────────────────────────────
   * 원작의 박물관. **도감과 다른 것**이라는 게 눈에 보여야 한다 —
   * 도감은 잡아 본 것이고, 사고는 가방에서 한 점을 실제로 내어 놓은 것이다.
   * 그래서 기증은 사고 **앞에서만** 받는다.
   */
  function viewMuseum() {
    var M = global.DG.museum, VD = global.DG.villageData, V = global.DG.village;
    var stt = M.status(), html = '', i, j;

    html += '<div class="sec"><h4>사고</h4><div class="card">' +
      '<div class="stat-row"><span>등급</span><b>' + esc(stt.grade) + '</b></div>' +
      '<div class="stat-row"><span>들인 것</span><b>🏛️ ' + stt.done + ' / ' + stt.total + '종</b></div>' +
      '<small class="muted">' +
        (stt.near ? '지금 사고 앞입니다 — 아래에서 들일 수 있습니다.'
                  : '기증은 <b>사고(🏛️) 앞에서만</b> 받습니다. 마을 가운데 왼쪽에 있습니다.') +
      ' 들인 것은 가방에서 한 점이 빠집니다. 대신 <b>명성</b>이 오릅니다.</small></div></div>';

    /* 지금 들일 수 있는 것 */
    html += '<div class="sec"><h4>들일 수 있는 것</h4>';
    if (!stt.offer.length) {
      html += '<div class="hint">가방에 아직 사고에 없는 것이 없습니다 — ' +
        '곤충🦋 · 물고기🐟 · 화석🦴 · 조개🐚 를 모아 오세요.</div>';
    } else {
      for (i = 0; i < stt.offer.length; i++) {
        var e = stt.offer[i];
        html += '<div class="card gearcard">' +
          '<div class="gearname">' + ico('material', e.item.key, 24, e.item.emoji) + ' ' + esc(e.item.name) +
            ' <small class="muted">×' + e.n + ' · 🎖️ +' +
            (20 + Math.floor(e.item.price / 10)) + '</small></div>' +
          '<div class="bagtools">' +
            '<button class="btn tiny ' + (stt.near ? 'primary' : 'ghost') + '"' +
              (stt.near ? '' : ' disabled') +
              ' data-act="v-donate" data-id="' + e.item.key + '">🏛️ 들인다</button>' +
          '</div></div>';
      }
    }
    html += '</div>';

    /* 전시실 — 갈래를 다 채우면 마을에 시설이 서는 번들(PLAN §5.3, 2026-09-17) */
    var bundles = VD.BUNDLES || {};
    for (i = 0; i < stt.cats.length; i++) {
      var c = stt.cats[i], rows = '', bd = bundles[c.cat.key];
      var bundleDone = bd && c.total > 0 && c.done >= c.total;
      for (j = 0; j < c.all.length; j++) {
        var it = c.all[j];
        var has = M.donated(it.key);
        rows += '<span class="biocell' + (has ? '' : ' off') + '" title="' +
          esc(it.name) + (has ? ' — 사고에 있음' : ' — 아직') + '">' +
          (has ? ico('material', it.key, 26, it.emoji) : '❔') + '</span>';
      }
      html += '<div class="sec"><h4>' + c.cat.icon + ' ' + c.cat.name + '</h4>' +
        dexBar(c.done, c.total) + '<div class="biogrid">' + rows + '</div>' +
        (bd ? '<small class="muted">' + (bundleDone ? '✓ 다 채웠습니다 — 마을에 시설이 섰습니다'
                                                     : '다 채우면 마을에 시설이 하나 섭니다') + '</small>' : '') +
        '</div>';
    }
    return html;
  }

  /* ── 도감 ─────────────────────────────────────────────── */


  function viewDex() {
    var hC = Object.keys(core.save.dex.heroes).length;
    var pC = Object.keys(core.save.dex.pets).length;
    return '<div class="sec"><h4>인물</h4>' + dexBar(hC, data.heroes.length) +
             dexGrid(data.heroes, core.save.dex.heroes) + '</div>' +
           '<div class="sec"><h4>펫</h4>' + dexBar(pC, data.pets.length) +
             dexGrid(data.pets, core.save.dex.pets) + '</div>' +
           bioDex() +
           '<div class="hint">카드를 누르면 열전·승급·펫 장착 화면이 열립니다. ' +
           '같은 인물을 또 등용하면 <b>중복(+n)</b>이 쌓여 승급 재료가 됩니다.</div>';
  }

  /* ── 채집 도감 ────────────────────────────────────────────
   * 한 번이라도 손에 넣은 것은 여기 남는다 — **팔아도 지워지지 않는다**.
   * 곤충과 물고기는 계절·시간대를 타므로, 다 채우려면 일 년을 돌아야 한다.
   * 원작의 박물관이 하던 일을 이 한 절이 대신한다.
   */
  function bioDex() {
    var V = global.DG.village, VD = global.DG.villageData;
    var cats = [{ key: 'bug', name: '곤충', icon: '🦋' },
                { key: 'fish', name: '물고기', icon: '🐟' }];
    var html = '', c, i;
    for (c = 0; c < cats.length; c++) {
      var all = VD.ITEMS[cats[c].key], got = 0, rows = '';
      for (i = 0; i < all.length; i++) {
        var n = V.caughtCount(all[i].key);
        if (n) { got++; }
        rows += '<span class="biocell' + (n ? '' : ' off') + '" title="' +
          esc(all[i].name) + (n ? ' ×' + n : ' — 아직') + '">' +
          (n ? all[i].emoji : '❔') + '</span>';
      }
      html += '<div class="sec"><h4>' + cats[c].icon + ' ' + cats[c].name + '</h4>' +
        dexBar(got, all.length) + '<div class="biogrid">' + rows + '</div></div>';
    }
    var mu = global.DG.museum.count();
    html += '<div class="sec"><div class="card">' +
      '<div class="stat-row"><span>사고에 들인 것</span><b>🏛️ ' + mu.done + ' / ' + mu.total + '종</b></div>' +
      '<button class="btn wide" data-act="v-museum">🏛️ 사고를 열어 본다</button>' +
      '<small class="muted">도감은 <b>잡아 본 것</b>이고 사고는 <b>들여 놓은 것</b>입니다 — ' +
      '다른 자리입니다.</small></div></div>';
    return html;
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
        esc(e.name + ' · ' + rar.name + (have ? (dup ? ' · 중복 ' + dup : '') : ' (미획득)')) + '"' +
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
      '<small class="muted">마을 규칙은 <b>손으로 할 때와 같습니다</b> — ' +
      '자동은 어디로 갈지(아직 여문 사물·부탁을 채운 주민)만 고릅니다.<br>' +
      '<b>새 문답은 대신 풀지 않습니다</b> (익힌 문제 복습만).<br>' +
      '창을 보고 있는 동안에만 돕니다 — 덮어 두면 멈춥니다.</small>' +
      '</div></div>';
    return html;
  }


  /* ── 인물 · 펫 상세 — 몸은 ui-detail.js(R-4). 안에서 부르던 이름 그대로 넘긴다 ── */
  function UD() { return global.DG.uiDetail.setup({ $: $, esc: esc, p3tag: p3tag, p3src: p3src, els: els, hero: hero, net: net }); }
  function detailHost() { return UD().host(); }
  function openDetail(kind, id) { UD().open(kind, id); }
  function closeDetail() { UD().close(); }
  function renderDetail() { UD().render(); }

  /* ── 토스트 ───────────────────────────────────────────── */

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2600);
  }

  /**
   * 하루 마무리 카드(§5.2, 표준 B) — 자정 넘겨 첫 부팅(=`rollDay()`가 실제로 돈
   * 뒤) 딱 한 번 뜬다. `#encounter`(이 판에선 안 쓰던 자리)를 빌려 쓴다.
   * 8초 뒤 저절로 닫히거나 눌러서 닫는다 — 닫히면 `dayLogSeen()`으로 다시 안 뜨게 한다.
   */
  var dayCardTimer = null;
  function showDayCard(info) {
    var el = $('encounter');
    if (!el) { return; }
    var ratingUp = info.ratingAfter - info.ratingBefore;
    var metLine = info.metId && global.DG.data ? global.DG.data.find(info.metId) : null;
    var warn = global.DG.town && global.DG.town.beautyWarning ? global.DG.town.beautyWarning() : null;
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 6px;font-size:17px">🌙 어제 하루</h3>' +
        '<div class="stat-row"><span>채집</span><b>' + core.fmt(info.gathered) + '</b></div>' +
        '<div class="stat-row"><span>금</span><b>🪙 ' + (info.gold >= 0 ? '+' : '') + core.fmt(info.gold) + '</b></div>' +
        (info.donated ? '<div class="stat-row"><span>기증</span><b>' + info.donated + '</b></div>' : '') +
        '<div class="stat-row"><span>마을 평가</span><b>' + (ratingUp >= 0 ? '+' : '') + ratingUp + '</b></div>' +
        (metLine ? '<div class="stat-row"><span>가장 가까워진 사람</span><b>' + esc(metLine.name) + '</b></div>' : '') +
        (warn ? '<div class="p-goal" style="margin-top:8px;color:var(--bad,#c0392b)">⚠ ' + esc(warn.text) + '</div>' : '') +
        (info.next ? '<div class="p-goal" style="margin-top:8px">오늘 · 🎯 ' + esc(info.next) + '</div>' : '') +
        '<button class="btn primary wide" id="daylog-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    var close = function () {
      el.classList.remove('show'); el.innerHTML = '';
      if (dayCardTimer) { clearTimeout(dayCardTimer); dayCardTimer = null; }
    };
    var btn = $('daylog-ok');
    if (btn) { btn.addEventListener('click', close); }
    if (dayCardTimer) { clearTimeout(dayCardTimer); }
    dayCardTimer = setTimeout(close, 8000);
    global.DG.village.dayLogSeen();
  }

  function checkDayCard() {
    var V = global.DG.village;
    if (!V || !V.dayLogPending || !V.dayLogPending()) { return; }
    showDayCard(V.dayLogInfo());
  }

  /** 매 프레임이 아니라 주기적으로만 갱신한다 */
  function tickRefresh() {
    renderTop();
    renderFocus();
    renderAutoBar();
    checkDayCard();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    /* 공사 시트는 **선 칸을 가운데로 한 3×3** 을 보여 준다 — 걸어가면 따라와야 한다.
       안 그러면 화면에 그린 칸과 실제로 고쳐지는 칸이 어긋난다 */
    if (openTab === 'bag' || openTab === 'folks' || openTab === 'build') { renderSheet(); }
  }

  /* ── 자동 순행 상태줄 ─────────────────────────────────── */

  var autoKey = null;
  function renderAutoBar() {
    var bar = els.autobar;
    if (!bar) { return; }
    var A = global.DG.auto;
    if (!A || !A.active()) {
      if (autoKey !== null) { bar.classList.remove('show'); bar.innerHTML = ''; autoKey = null; }
      return;
    }
    var stt = A.status();
    var key = stt.doing;
    if (key !== autoKey) {
      autoKey = key;
      bar.innerHTML = '<div class="auto-card"><b>🤖 자동 순행</b>' +
        '<span>' + esc(stt.doing || '…') + '</span>' +
        '<button class="btn tiny ghost" data-act="auto-stop">멈춤</button></div>';
    }
    bar.classList.add('show');
  }

  global.DG = global.DG || {};
  global.DG.ui = {
    init: init, toast: toast, tickRefresh: tickRefresh,
    openSheet: openSheet, closeSheet: closeSheet,
    openDetail: openDetail, closeDetail: closeDetail,
    renderPanel: renderSheet, renderHud: renderTop, renderFocus: renderFocus,
    doInteract: doInteract
  };
})(window);
