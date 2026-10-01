  /* ── 가방 · 저자 ──────────────────────────────────────── */

  function optLine(s) {
    var bits = [];
    if (s.atk) { bits.push('공격 +' + s.atk); }
    if (s.def) { bits.push('방어 +' + s.def); }
    if (s.hp) { bits.push('체력 +' + s.hp); }
    return bits.join(' · ') || '—';
  }

  /** 그 물건에 쓸 수 있는, 지금 가진 주문서 버튼들 */
  function scrollButtons(G, it) {
    var d = G.defOf(it);
    var kind = d.slot === 'weapon' ? 'weapon' : 'armor';
    var list = global.DG.gearData.SCROLLS, html = '';
    for (var i = 0; i < list.length; i++) {
      var sc = list[i];
      if (sc['for'] !== kind) { continue; }
      var n = G.scrollCount(sc.key);
      if (n <= 0) { continue; }
      html += '<button class="btn tiny" data-act="g-scroll" data-uid="' + it.uid +
        '" data-scroll="' + sc.key + '" title="' + esc(sc.name + ' — ' + sc.desc) + '">📜 ' +
        Math.round(sc.rate * 100) + '% ×' + n + '</button> ';
    }
    return html;
  }

  function viewBag() {
    var G = global.DG.gear, GD = global.DG.gearData;
    var S = global.DG.side;
    var eq = G.equipped(), bo = G.bonus(), pw = S.power();
    var i, html = '';

    html += '<div class="sec"><h4>낀 것</h4><div class="card">';
    for (i = 0; i < GD.SLOTS.length; i++) {
      var sl = GD.SLOTS[i], it = eq[sl.key];
      html += '<div class="stat-row"><span>' + sl.emoji + ' ' + esc(sl.name) + '</span>';
      if (it) {
        html += '<span><b>' + esc(G.nameOf(it)) + '</b>' + gradeTag(GD, G.defOf(it)) + ' <small class="muted">' +
          esc(optLine(G.statsOf(it))) + '</small> ' +
          '<button class="btn tiny ghost" data-act="g-unequip" data-slot="' + sl.key +
          '">벗기</button></span>';
      } else {
        html += '<span class="muted">비어 있음</span>';
      }
      html += '</div>';
    }
    html += '<div class="stat-row" style="border-top:1px solid rgba(255,255,255,.12);padding-top:6px">' +
      '<span>합</span><b>공격 +' + bo.atk + ' · 방어 +' + bo.def + ' · 체력 +' + bo.hp + '</b></div>' +
      '<div class="stat-row"><span>지금 몸</span><b>체력 ' + core.fmt(pw.hp) +
        ' · 공격 ' + core.fmt(pw.atk) + '</b></div>' +
      '<small class="muted">방어는 맞는 값을 깎습니다 — 아무리 높아도 <b>6할까지</b>. ' +
      '지금 ' + Math.round(G.cut(bo.def) * 100) + '% 덜 맞습니다.</small>' +
      '</div></div>';

    var inv = G.inv();
    html += '<div class="sec"><h4>가방 <small class="muted">' + inv.length + ' / ' + G.BAG +
      '</small></h4>';
    if (!inv.length) {
      html += '<div class="hint">아직 아무것도 없습니다. 적이 가끔 떨구고, 🏪 저자에서도 삽니다.</div>';
    }
    for (i = 0; i < inv.length; i++) {
      var g = inv[i], d = G.defOf(g), on = G.isEquipped(g.uid);
      var canWear = core.save.player.level >= d.need;
      html += '<div class="card' + (on ? ' on' : '') + '">' +
        '<div class="stat-row"><span><b>' + esc(G.nameOf(g)) + '</b>' + gradeTag(GD, d) +
          (on ? ' <small class="muted">— 끼고 있음</small>' : '') + '</span>' +
          '<span class="muted">' + esc(GD.slot(d.slot).name) + ' · Lv.' + d.need + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(optLine(G.statsOf(g))) + '</span>' +
          '<span class="muted">업횟 ' + g.left + '</span></div>' +
        (G.isUnique(g) && d.desc ? '<div class="hint">' + esc(d.desc) + '</div>' : '') +
        '<div class="btn-row">' +
          (on ? '' : (canWear
            ? '<button class="btn tiny primary" data-act="g-equip" data-uid="' + g.uid + '">낀다</button> '
            : '<button class="btn tiny ghost" disabled>🔒 Lv.' + d.need + '</button> ')) +
          (g.left > 0 ? scrollButtons(G, g) : '<small class="muted">업횟 없음 </small>') +
          (on ? '' : '<button class="btn tiny ghost" data-act="g-sell" data-uid="' + g.uid +
            '">팔기 🪙' + core.fmt(Math.round(d.price * G.SELL_RATE)) + '</button>') +
        '</div></div>';
    }
    html += '</div>';

    /* 가진 주문서 */
    var sc = GD.SCROLLS.filter(function (s) { return G.scrollCount(s.key) > 0; });
    html += '<div class="sec"><h4>주문서</h4>';
    if (!sc.length) {
      html += '<div class="hint">주문서는 적이 떨구거나 🏪 저자에서 삽니다. ' +
        '<b>실패해도 물건은 남습니다</b> — 닳는 것은 업횟뿐입니다.</div>';
    } else {
      html += '<div class="card">';
      for (i = 0; i < sc.length; i++) {
        html += '<div class="stat-row"><span>📜 ' + esc(sc[i].name) + '</span>' +
          '<b>×' + G.scrollCount(sc[i].key) + '</b></div>';
      }
      html += '<small class="muted">물건 아래의 📜 단추로 씁니다. 실패해도 물건은 남고 ' +
        '업횟만 닳습니다.</small></div>';
    }
    html += '</div>';

    /* 캔 것(PLAN 10절) — 필드에 서 있는 것을 지나가면 줍는다. 칸을 차지하지
       않는 카운터라 가방과는 딴 줄에 둔다 */
    var SD = global.DG.sideData, mats = S.state().mats || {}, gk = Object.keys(SD.GATHERS);
    var got = gk.filter(function (k) { return mats[k] > 0; });
    html += '<div class="sec"><h4>캔 것</h4>';
    if (!got.length) {
      html += '<div class="hint">사냥터를 걷다 보면 꽃·열매·광물이 서 있습니다. 지나가면 줍습니다.</div>';
    } else {
      html += '<div class="card">';
      for (i = 0; i < got.length; i++) {
        var gi = SD.GATHERS[got[i]];
        html += '<div class="stat-row"><span>' + gi.emoji + ' ' + esc(gi.name) + '</span>' +
          '<b>×' + mats[got[i]] + '</b></div>';
      }
      html += '<small class="muted">🏪 저자 아래 "캔 것으로 만들기"에서 탕약·주문서로 바꿉니다.</small></div>';
    }
    html += '</div>';
    return html;
  }

  /** 🥋 무예 — 전직과 스킬 트리. 원작의 스킬창 자리다 */
  function viewJob() {
    var J = global.DG.job, JD = global.DG.jobData;
    var me = J.cur(), left = J.spLeft();
    var i, html = '';

    html += '<div class="sec"><h4>지금 자리</h4><div class="card">' +
      '<div class="stat-row"><span>' + me.emoji + ' <b>' + esc(me.name) + '</b></span>' +
        '<span class="muted">Lv.' + core.save.player.level + '</span></div>' +
      '<div class="stat-row"><span class="muted">' + esc(me.desc) + '</span>' +
        '<b>무예 점수 ' + left + '</b></div>' +
      '<small class="muted">점수는 레벨마다 ' + JD.SP_PER_LEVEL + '점씩 늘어납니다 ' +
        '(쓴 것 ' + J.spSpent() + ' / 모두 ' + J.spTotal() + '). ' +
        '<b>찍은 무예만 조작 띠에 놓입니다.</b></small>' +
      (me.key !== 'none'
        ? '<div class="btn-row"><button class="btn ghost" data-act="j-reset">🔄 전직을 되돌린다</button></div>'
        : '') +
      '</div></div>';

    /* 고유 조작 + 스승(§5-1) — 회피를 길게 눌러 쓰는 조작 하나와, 1~4차 전직마다
       하나씩 만난 스승 넷. 스승 중 하나라도 도감(등용)에 있으면 수치가 오른다. */
    var sig = J.signature();
    if (sig) {
      var mlist = J.mentors(), dex = core.save.dex.heroes;
      html += '<div class="sec"><h4>고유 조작 <small class="muted">— 회피를 길게 누르면</small></h4>' +
        '<div class="card">' +
        '<div class="stat-row"><span>' + sig.emoji + ' <b>' + esc(sig.name) + '</b></span>' +
          '<span class="muted">기력 ' + sig.cost + ' · 쿨 ' + sig.cd + 's</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(sig.desc) + '</span>' +
          '<b>' + (sig.boost ? '🎓 스승 보정 ON' : '스승 보정 OFF') + '</b></div>' +
        '<div class="mentor-row">' +
        mlist.map(function (id, mi) {
          var h = data.find(id);
          if (!h) { return ''; }
          var got = !!dex[id];
          return '<div class="mentor-chip' + (got ? ' on' : '') + '">' + pt('hero', h, 40) +
            '<small>' + (mi + 1) + '차 · ' + esc(h.name) + (got ? ' ✅' : '') + '</small></div>';
        }).join('') +
        '</div></div></div>';
    }

    /* 전직 */
    var nexts = JD.nextJobs(me.key);
    if (nexts.length) {
      html += '<div class="sec"><h4>전직 <small class="muted">— 오르는 것 자체는 그대로지만, ' +
        '위 "전직을 되돌린다"로 무명에 돌아가 다른 길을 다시 고를 수 있습니다</small></h4>';
      for (i = 0; i < nexts.length; i++) {
        var nj = nexts[i], why = J.canJoin(nj.key);
        html += '<div class="card"><div class="stat-row">' +
          '<span>' + nj.emoji + ' <b>' + esc(nj.name) + '</b></span>' +
          '<span class="muted">Lv.' + nj.need + ' 부터</span></div>' +
          '<div class="stat-row"><span class="muted">' + esc(nj.desc) + '</span>' +
            '<span class="muted">체력 +' + (nj.grow ? nj.grow.hp : 0) +
            ' · 공격 +' + (nj.grow ? nj.grow.atk : 0) +
            (nj.grow && nj.grow.mp ? ' · 기력 +' + nj.grow.mp : '') + '</span></div>' +
          (why
            ? '<button class="btn ghost wide" disabled>🔒 ' + esc(why) + '</button>'
            : '<button class="btn primary wide" data-act="j-join" data-job="' + nj.key +
              '">이 길로 간다</button>') +
          '</div>';
      }
      html += '</div>';
    }

    /* 무예 목록 — 유파(§5-2)별로 묶는다. 띠(bar)에 같은 유파가 2/4개 있으면
       그 유파 전체(무예 카드 + 아래 조작 띠 슬롯)가 색을 받는다(.set2/.set4) */
    var mine = JD.skillsOf(me.key).filter(function (s) { return s.max > 0; });
    var active = J.activeSchools();
    html += '<div class="sec"><h4>무예</h4>';
    if (!mine.length) {
      html += '<div class="hint">아직 익힐 무예가 없습니다. <b>Lv.10</b> 에 전직하면 열립니다 — ' +
        '그때까지는 연참·횡소·기탄·기합 넷을 씁니다.</div>';
    }
    var groups = JD.SCHOOLS.filter(function (s) {
      return mine.some(function (m) { return m.school === s.id; });
    });
    for (var gi = 0; gi < groups.length; gi++) {
      var def = groups[gi], tier = active[def.id] || 0;
      html += '<div class="school-head' + (tier ? ' set' + tier : '') + '">' +
        '<b>' + esc(def.name) + ' 유파</b> <span class="muted">— ' +
        (tier ? tier + '세트 발동 중' : '띠에 2개면 소효과, 4개면 대효과') + '</span></div>';
      var list = mine.filter(function (s) { return s.school === def.id; });
      for (i = 0; i < list.length; i++) {
        var sk = list[i], lv = J.levelOf(sk.key), why2 = J.canRaise(sk.key);
        var mul = J.mulOf(sk);
        html += '<div class="card' + (lv > 0 ? ' on' : '') + (tier ? ' set' + tier : '') + '">' +
          '<div class="stat-row"><span>' + sk.emoji + ' <b>' + esc(sk.name) + '</b></span>' +
            '<b>' + lv + ' / ' + sk.max + '</b></div>' +
          '<div class="stat-row"><span class="muted">' + esc(sk.desc) + '</span>' +
            '<span class="muted">기력 ' + sk.cost + ' · 쿨 ' + sk.cd + 's</span></div>' +
          (lv > 0 && sk.mul[0]
            ? '<div class="stat-row"><span class="muted">지금 힘</span><b>공격력 ×' +
              mul.toFixed(2) + '</b></div>'
            : '') +
          '<div class="btn-row">' +
            (why2
              ? '<button class="btn tiny ghost" disabled>' + esc(why2) + '</button>'
              : '<button class="btn tiny primary" data-act="j-raise" data-skill="' + sk.key +
                '">＋ 한 점 붓는다</button>') +
          '</div></div>';
      }
    }
    html += '</div>';

    /* 지금 조작 띠 */
    var bar = J.bar();
    html += '<div class="sec"><h4>조작 띠</h4><div class="card">';
    for (i = 0; i < bar.length; i++) {
      var bDef = bar[i].school ? JD.schoolDef(bar[i].school) : null;
      var bTier = bDef ? (active[bDef.id] || 0) : 0;
      html += '<div class="stat-row' + (bTier ? ' set' + bTier : '') + '"><span>' + (i + 1) + ' · ' +
        bar[i].emoji + ' ' + esc(bar[i].name) +
        (bDef ? ' <small class="muted">[' + esc(bDef.name) + ']</small>' : '') +
        '</span><span class="muted">' +
        (bar[i].max ? '레벨 ' + J.levelOf(bar[i].key) : '고정') + '</span></div>';
    }
    var onNames = Object.keys(active).map(function (id) {
      var d = JD.schoolDef(id);
      return (d ? d.name : id) + ' ' + active[id] + '세트';
    });
    if (onNames.length) {
      html += '<div class="stat-row"><span class="muted">지금 켜진 세트</span><b>' +
        onNames.join(' · ') + '</b></div>';
    }
    html += '<small class="muted">키 1~8 · 화면 아래 단추. 자리가 여덟을 넘으면 ' +
      '<b>윗자리 무예부터</b> 놓입니다 — 4차까지 열리면 한 갈래가 열다섯, 5차엔 각성기 둘이 더해집니다.</small></div></div>';
    return html;
  }

  function viewShop() {
    var G = global.DG.gear, GD = global.DG.gearData;
    var list = G.shopList();
    var gold = core.save.player.gold;
    var i, html = '<div class="sec"><h4>가진 것</h4><div class="card">' +
      '<div class="stat-row"><span>금</span><b>🪙 ' + core.fmt(gold) + '</b></div>' +
      '<div class="stat-row"><span>탕약</span><b>🧪 ' +
        global.DG.side.status().potions + '</b></div>' +
      '<div class="stat-row"><span>가방</span><b>' + (G.BAG - G.bagLeft()) + ' / ' + G.BAG +
        '</b></div></div></div>';

    html += '<div class="sec"><h4>탕약</h4><div class="card">' +
      '<div class="stat-row"><span>🧪 탕약</span><span class="muted">🪙 ' +
        list.potion.price + ' / 개</span></div>' +
      '<div class="btn-row">' +
        '<button class="btn tiny primary" data-act="sh-potion" data-n="1">1개</button> ' +
        '<button class="btn tiny" data-act="sh-potion" data-n="10">10개 🪙' +
          core.fmt(list.potion.price * 10) + '</button>' +
      '</div></div></div>';

    html += '<div class="sec"><h4>물건 <small class="muted">— 수준이 오르면 목록이 늡니다</small></h4>';
    for (i = 0; i < list.gears.length; i++) {
      var g = list.gears[i];
      html += '<div class="card"><div class="stat-row">' +
        '<span><b>' + esc(g.name) + '</b>' + gradeTag(GD, g) + ' <small class="muted">' +
          esc(GD.slot(g.slot).name) + ' · Lv.' + g.need + '</small></span>' +
        '<span class="muted">' + esc(optLine(g)) + '</span></div>' +
        '<button class="btn tiny ' + (gold >= g.price ? 'primary' : 'ghost') + '"' +
          ' data-act="sh-gear" data-key="' + g.key + '">🪙 ' + core.fmt(g.price) + ' 에 산다</button>' +
        '</div>';
    }
    html += '</div>';

    html += '<div class="sec"><h4>주문서</h4>';
    for (i = 0; i < list.scrolls.length; i++) {
      var s = list.scrolls[i];
      html += '<div class="card"><div class="stat-row">' +
        '<span><b>📜 ' + esc(s.name) + '</b></span>' +
        '<span class="muted">' + esc(optLine(s)) + ' · 가진 것 ' +
          G.scrollCount(s.key) + '</span></div>' +
        '<div class="stat-row"><span class="muted">' + esc(s.desc) + '</span>' +
          '<button class="btn tiny ' + (gold >= s.price ? 'primary' : 'ghost') + '"' +
          ' data-act="sh-scroll" data-key="' + s.key + '">🪙 ' + core.fmt(s.price) + '</button>' +
        '</div></div>';
    }
    html += '</div>';
    /* 캔 것으로 만들기(data-side.js RECIPES) — 금 대신 사냥터에서 주운 것으로 */
    var SD = global.DG.sideData, mats = global.DG.side.state().mats || {};
    html += '<div class="sec"><h4>🧺 캔 것으로 만들기 <small class="muted">— 사냥터에서 주운 꽃·열매·광물</small></h4>';
    for (i = 0; i < SD.RECIPES.length; i++) {
      var r = SD.RECIPES[i], can = !Object.keys(G.craftLack(r.key)).length, parts = [], k;
      for (k in r.need) {
        if (r.need.hasOwnProperty(k)) {
          parts.push(SD.GATHERS[k].emoji + ' ' + (mats[k] || 0) + '/' + r.need[k]);
        }
      }
      var out = r.give.potion ? '🧪 탕약 ×' + r.give.potion : '📜 ' + GD.scroll(r.give.scroll).name;
      html += '<div class="card"><div class="stat-row">' +
        '<span><b>' + esc(r.name) + '</b> <small class="muted">→ ' + esc(out) + '</small></span>' +
        '<span class="muted">' + parts.join(' · ') + '</span></div>' +
        '<button class="btn tiny ' + (can ? 'primary' : 'ghost') + '"' +
          ' data-act="sh-craft" data-key="' + r.key + '">만든다</button></div>';
    }
    html += '</div>';
    html += '<small class="muted">파는 값은 산 값의 3할입니다. 끼고 있는 것은 못 팝니다.</small>';
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
           '<div class="hint">카드를 누르면 열전·승급·펫 장착 화면이 열립니다. ' +
           '같은 인물을 또 등용하면 <b>중복(+n)</b>이 쌓여 승급 재료가 됩니다.</div>';
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
      '<small class="muted">사냥 규칙은 <b>손으로 할 때와 같습니다</b> — ' +
      '자동은 어느 적을 칠지·언제 탕약을 마실지만 고릅니다.<br>' +
      '<b>새 문답은 대신 풀지 않습니다</b> (익힌 문제 복습만).<br>' +
      '창을 보고 있는 동안에만 돕니다 — 덮어 두면 멈춥니다.</small>' +
      '</div></div>';
    return html;
  }


  /* ── 인물 · 펫 상세 ───────────────────────────────────────
   * 도감 카드에서 열린다. 능력치는 hero.breakdown() 이 계산해 준 값만 보여준다.
   */

  function detailHost() {
    var el = $('detail');
    if (!el) {                       // 자가진단 페이지처럼 뼈대가 없는 곳에서도 동작하게
      el = document.createElement('div');
      el.id = 'detail';
      document.body.appendChild(el);
      els.detail = el;
    }
    return el;
  }

  function openDetail(kind, id) {
    if (!id) { return; }
    openDetailRef = { kind: kind, id: id };
    renderDetail();
    detailHost().classList.add('show');
  }

  function closeDetail() {
    openDetailRef = null;
    var el = detailHost();
    el.classList.remove('show');
    el.innerHTML = '';
  }

  /* ── 오버월드 전체 지도 (2026-09-02, M키식 토글) ─────────────
   * 지금 어디 있는지 + 마을(🏘️)·사냥터(⚔️)가 어떤 순서로 이어지는지 한눈에.
   * 걸어서 문을 통해 실제로 오가는 것과는 별개로, 상태만 보여 주는 읽기 전용 판이다. */
  var OW_CHAIN = ['sinya', 'heodo', 'field', 'gangneungjin', 'forest',
                  'namjeongseong', 'cave', 'gisanchae', 'gorge', 'ruin', 'deepcave',
                  'beyond_past', 'beyond_now', 'beyond_future'];

  function owmapHost() {
    var el = $('owmap');
    if (!el) {                       // 자가진단 페이지처럼 뼈대가 없는 곳에서도 동작하게
      el = document.createElement('div');
      el.id = 'owmap';
      document.body.appendChild(el);
      els.owmap = el;
    }
    return el;
  }

  function renderOverworldMap() {
    var SD = global.DG.sideData, S = global.DG.side;
    var here = S.status().stage.key;
    var html = '<div class="ow-card">' +
      '<button class="icon-btn sm ow-x" data-act="ow-close">✕</button>' +
      '<h3>🗺️ 오버월드</h3><div class="ow-chain">';
    for (var i = 0; i < OW_CHAIN.length; i++) {
      var stg = SD.stage(OW_CHAIN[i]);
      var open = S.unlocked(stg.key);
      var cls = (stg.key === here ? ' cur' : '') + (open ? ' open' : ' locked') +
        (stg.town ? ' town' : ' field');
      html += '<div class="ow-node' + cls + '">' +
        '<i>' + (stg.town ? '🏘️' : '⚔️') + '</i><b>' + esc(stg.name) + '</b>' +
        (open ? (stg.town ? '<small>안전지대</small>' : '<small>적 Lv.' + stg.enemyLv + '</small>')
              : '<small>🔒 Lv.' + stg.need + '</small>') +
        '</div>';
      if (i < OW_CHAIN.length - 1) { html += '<div class="ow-link' + (open ? ' open' : '') + '"></div>'; }
    }
    html += '</div><small class="muted">지금 있는 곳이 금빛으로 빛납니다. ' +
      '마을(🏘️)은 안전지대, 사냥터(⚔️)는 몬스터가 있는 곳입니다.</small></div>';
    owmapHost().innerHTML = html;
  }

  function openOverworldMap() {
    renderOverworldMap();
    owmapHost().classList.add('show');
  }

  function closeOverworldMap() {
    owmapHost().classList.remove('show');
  }

  function toggleOverworldMap() {
    if (owmapHost().classList.contains('show')) { closeOverworldMap(); }
    else { openOverworldMap(); }
  }

  function rankStars(rank) {
    if (!rank) { return ''; }
    var out = ' ';
    for (var i = 0; i < rank; i++) { out += '✦'; }
    return out;
  }

  function statRow(label, base, grown, fin, cap) {
    var pct = core.clamp(fin / cap, 0, 1) * 100;
    var extra = fin - base;
    return '<div class="st">' +
      '<span class="st-l">' + label + '</span>' +
      '<span class="stbar"><i style="width:' + pct + '%"></i>' +
        (grown > base ? '<u style="width:' + (core.clamp(base / cap, 0, 1) * 100) + '%"></u>' : '') +
      '</span>' +
      '<b class="st-v">' + fin + (extra > 0 ? '<em>+' + extra + '</em>' : '') + '</b>' +
    '</div>';
  }

  function renderDetail() {
    if (!openDetailRef) { return; }
    var host = detailHost();
    var ref = data.find(openDetailRef.id);
    if (!ref) { closeDetail(); return; }
    host.innerHTML = openDetailRef.kind === 'pet' ? detailPet(ref) : detailHero(ref);
  }

  function detailHero(h) {
    var owned = !!core.save.dex.heroes[h.id];
    var rar = data.rarity[h.rarity];
    var fac = data.faction(h.faction);
    var g = hero().info(h.id);
    var bk = hero().breakdown(h.id);
    var need = hero().expNeed(g.lv);
    var maxLv = g.lv >= hero().MAX_LV;
    var inParty = core.save.party.indexOf(h.id) >= 0;
    var chk = hero().rankUpCheck(h.id);
    var cost = chk.cost || hero().rankUpCost(g.rank);

    var p3h = p3src('hero', h, 150, 172, function () { return global.DG.sprite.portraitCard('hero', h, 150, 172); });
    var out = '<div class="dt-card">' +
      '<button class="icon-btn sm dt-x" data-act="dt-close">✕</button>' +
      '<div class="dt-top">' +
        '<img class="dt-portrait" alt=""' + p3tag('hero', h, 150, 172) + p3h.done + ' src="' +
          p3h.src + '">' +
        '<div class="dt-head">' +
          '<div class="dt-name"><b>' + esc(h.name) + '</b>' +
            (h.hanja ? '<span class="hanja">' + esc(h.hanja) + '</span>' : '') + '</div>' +
          '<div class="dt-tags">' +
            '<span class="tag fac" style="background:' + fac.color + '">' + fac.mark + ' ' + esc(h.faction) + '</span>' +
            '<span class="tag">' + esc(h.era) + '</span>' +
            '<span class="tag" style="color:' + rar.color + '">' + rar.name + ' ' + rar.label + '</span>' +
            '<span class="tag">' + data.traitMark[h.trait] + '</span>' +
          '</div>';

    if (owned) {
      out += '<div class="dt-lv">Lv.<b>' + g.lv + '</b>' +
        (maxLv ? ' <span class="tag">최대</span>' : '') +
        (g.rank ? ' <span class="rankmark">승급 ' + rankStars(g.rank).trim() + '</span>' : '') +
        '</div>' +
        '<div class="bar sm"><i style="width:' + (maxLv ? 100 : g.exp / need * 100) + '%"></i></div>' +
        '<small class="muted">' + (maxLv ? '더 오를 곳이 없습니다' : '경험치 ' + g.exp + ' / ' + need) +
          ' · 성장 배율 ×' + bk.mul.toFixed(2) + '</small>' +
        '<div class="dt-where">' + (inParty ? '🧭 동행 중' : '🏠 집에서 대기 중') + '</div>';
    } else {
      out += '<div class="dt-lv muted">아직 등용하지 않은 인물입니다</div>';
    }
    out += '</div></div>';

    if (owned) {
      var cap = 200;      // 능력치 바의 만점 기준 (Lv.30 ★5 까지 자랄 자리를 남긴다)
      out += '<div class="dt-stats">' +
        statRow('무력', bk.base.might, bk.grown.might, bk.final.might, cap) +
        statRow('지력', bk.base.wisdom, bk.grown.wisdom, bk.final.wisdom, cap) +
        statRow('통솔', bk.base.command, bk.grown.command, bk.final.command, cap) +
        '</div>' +
        '<div class="dt-line"><span>인물 됨됨이</span><b>' + core.fmt(hero().power(h.id)) + '</b></div>';

      out += '<div class="dt-pet"><span>🐾 펫</span>' +
        '<select data-equip="' + h.id + '">' + petOptions(h.id) + '</select>' +
        (bk.pet ? '<small class="muted">' + esc(bk.pet.name) + ' · ' +
          statKor(bk.pet.bonus.stat) + ' +' + bk.pet.bonus.value + '</small>'
                : '<small class="muted">장착하면 능력치가 더해집니다</small>') +
        '</div>';
    }

    var bio = data.bio(h.id);
    if (owned) {
      if (bio) { out += '<p class="dt-bio">' + esc(bio) + '</p>'; }
      out += '<p class="quote">"' + esc(h.quote) + '"</p>';
    } else {
      out += '<p class="dt-bio muted">등용하면 열전이 열립니다.</p>';
    }

    if (owned) {
      out += '<div class="dt-acts">';
      if (g.rank >= hero().MAX_RANK) {
        out += '<button class="btn ghost wide" disabled>✨ 최대 승급 (★' + g.rank + ')</button>';
      } else {
        out += '<button class="btn ' + (chk.ok ? 'primary' : 'ghost') + ' wide"' +
          (chk.ok ? '' : ' disabled') + ' data-act="rankup" data-id="' + h.id + '">' +
          '✨ 승급 ★' + (g.rank + 1) + ' · 중복 ' + hero().dupOf(h.id) + '/' + cost.dup +
          ' · 🪙 ' + core.fmt(cost.gold) + '</button>';
      }
      if (net().online()) {
        out += '<button class="btn wide" data-act="dt-talk" data-id="' + h.id + '">💬 말을 건다 (사관)</button>';
      }
      out += (inParty
        ? '<button class="btn ghost wide" data-act="drop" data-id="' + h.id + '">동행에서 뺀다</button>'
        : '<button class="btn wide"' + (core.save.party.length >= 5 ? ' disabled' : '') +
          ' data-act="join" data-id="' + h.id + '">동행에 넣는다' +
          (core.save.party.length >= 5 ? ' (가득 찼음)' : '') + '</button>');
      out += '</div>' +
        '<small class="muted dt-tip">맨 앞에 세운 인물이 <b>내 몸</b>이 됩니다 — 그 능력치로 싸웁니다. ' +
        '승급은 중복분과 금을 씁니다.</small>';
    }

    return out + '</div>';
  }

  function petOptions(heroId) {
    var owned = Object.keys(core.save.dex.pets);
    var equipped = core.save.petEquip[heroId] || '';
    var used = {}, k;
    for (k in core.save.petEquip) {
      if (Object.prototype.hasOwnProperty.call(core.save.petEquip, k) && k !== heroId) {
        used[core.save.petEquip[k]] = true;
      }
    }
    var out = '<option value="">— 펫 없음 —</option>';
    for (var i = 0; i < owned.length; i++) {
      var p = data.find(owned[i]);
      if (!p || used[p.id]) { continue; }
      out += '<option value="' + p.id + '"' + (equipped === p.id ? ' selected' : '') + '>' +
        p.emoji + ' ' + p.name + ' (' + statKor(p.bonus.stat) + ' +' + p.bonus.value + ')</option>';
    }
    return out;
  }

  function statKor(s) { return ({ might: '무력', wisdom: '지력', command: '통솔', virtue: '덕망' })[s] || s; }

  function detailPet(p) {
    var d = core.save.dex.pets[p.id];
    var owned = !!d;
    var rar = data.rarity[p.rarity];
    var wearer = null, k;
    for (k in core.save.petEquip) {
      if (Object.prototype.hasOwnProperty.call(core.save.petEquip, k) &&
          core.save.petEquip[k] === p.id) { wearer = data.find(k); }
    }
    var p3p = p3src('pet', p, 150, 172, function () { return global.DG.sprite.portraitCard('pet', p, 150, 172); });
    return '<div class="dt-card">' +
      '<button class="icon-btn sm dt-x" data-act="dt-close">✕</button>' +
      '<div class="dt-top">' +
        '<img class="dt-portrait" alt=""' + p3tag('pet', p, 150, 172) + p3p.done + ' src="' +
          p3p.src + '">' +
        '<div class="dt-head">' +
          '<div class="dt-name"><b>' + esc(p.name) + '</b></div>' +
          '<div class="dt-tags">' +
            '<span class="tag fac" style="background:' + (p.kind === 'divine' ? '#8a5cc0' : '#5f7a4a') + '">' +
              (p.kind === 'divine' ? '神 신수' : '獸 동물') + '</span>' +
            '<span class="tag" style="color:' + rar.color + '">' + rar.name + ' ' + rar.label + '</span>' +
          '</div>' +
          '<div class="dt-lv">' + (owned
            ? '보유 ' + d.count + '마리' + (wearer ? ' · ' + esc(wearer.name) + ' 장착 중' : ' · 장착 안 됨')
            : '<span class="muted">아직 포획하지 않았습니다</span>') + '</div>' +
          '<small class="muted">기본 포획률 ' + Math.round(p.catchBase * 100) + '%</small>' +
        '</div>' +
      '</div>' +
      '<div class="dt-line"><span>장착 보정</span><b>' + statKor(p.bonus.stat) + ' +' + p.bonus.value + '</b></div>' +
      '<p class="dt-bio">' + esc(p.desc || '') + '</p>' +
      '<small class="muted dt-tip">펫은 인물에게 하나씩 장착합니다. 인물 상세 화면에서 고르세요.</small>' +
      '</div>';
  }

  /* ── 토스트 ───────────────────────────────────────────── */

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2600);
  }

  /** 매 프레임이 아니라 주기적으로만 갱신한다 */
  function tickRefresh() {
    renderTop();
    renderCamp();
    renderHudBar();
    renderTalkBox();
    renderAutoBar();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    if (openTab === 'field') { renderSheet(); }
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
    renderPanel: renderSheet, renderHud: renderTop,
    renderCamp: renderCamp, renderHudBar: renderHudBar, renderTalkBox: renderTalkBox,
    openOverworldMap: openOverworldMap, closeOverworldMap: closeOverworldMap,
    toggleOverworldMap: toggleOverworldMap
  };
})(window);
