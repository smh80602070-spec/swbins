  /* ── 인물 · 펫 상세 ───────────────────────────────────────
   * 도감 카드에서 열린다. 능력치는 hero.breakdown() 이 계산해 준 값만 보여준다.
   */

  /** 연성·승화 모듈 (이 판에만 있는 축이라 없을 수도 있다고 보고 쓴다) */
  function growth() { return global.DG.growth || null; }

  /** 반려 모듈 — 위와 같은 이유로 있으면 쓴다 */
  function buddy() { return global.DG.buddy || null; }

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

  /** 승급 특성(PLAN §5 ⑦) — 고르지 않은 카드 셋이 있으면 그것을, 아니면 가진 특성을 보인다 */
  function perkBlock(id) {
    var PK = global.DG.perk;
    if (!PK) { return ''; }
    var own = PK.perksOf(id), pend = PK.pending(id), out = '<div class="dt-perks">';
    function axisMark(d) {
      for (var i = 0; i < PK.AXES.length; i++) { if (PK.AXES[i].key === d.axis) { return PK.AXES[i].mark; } }
      return '';
    }
    if (pend) {
      out += '<div class="dt-line"><span>🎴 특성 카드 — 하나를 고른다</span><b>' + own.length + '/' + PK.MAX_PERKS + '</b></div>';
      for (var i = 0; i < pend.length; i++) {
        var d = PK.def(pend[i]);
        out += '<button class="btn wide" data-act="perk-pick" data-id="' + id + '" data-perk="' + d.id + '">' +
          d.emoji + ' <b>' + esc(d.name) + '</b> <small>' + axisMark(d) + ' · ' + esc(d.desc) + '</small></button>';
      }
      out += '<button class="btn ghost wide" data-act="perk-skip" data-id="' + id + '">카드를 물린다 (丹 +' + PK.DECLINE_DAN + ')</button>';
    } else {
      out += '<div class="dt-line"><span>🎴 특성</span><b>' + own.length + '/' + PK.MAX_PERKS + '</b></div>';
      if (own.length) {
        out += '<div class="dt-tags">';
        for (var j = 0; j < own.length; j++) {
          var od = PK.def(own[j]);
          out += '<span class="tag" title="' + esc(od.desc) + '">' + od.emoji + ' ' + esc(od.name) + ' · ' + esc(od.desc) + '</span>';
        }
        out += '</div>';
      } else {
        out += '<small class="muted">승급할 때마다 특성 카드 셋(攻·守·補) 중 하나를 고릅니다.</small>';
      }
    }
    return out + '</div>';
  }

  /** 무기(PLAN §5 ⑲-5) — 종류는 인물마다 정해져 있다, 들판 전투에만 탄다 */
  function weaponBlock(id) {
    var WP = global.DG.weapon;
    if (!WP) { return ''; }
    var wid = WP.equipped(id), w = WP.info(wid), r = WP.rec(wid) || { lv: 1, asc: 0, ref: 1 }, t = WP.typeOf(id), i;
    var out = '<div class="dt-weapon"><div class="dt-line"><span>' + WP.TYPE_ICON[t] + ' 무기 · ' + WP.TYPE_NAMES[t] +
      '</span><b>🪨 ' + WP.ore() + '</b></div>';
    var ch = WP.choicesFor(id), opts = '';
    for (i = 0; i < ch.length; i++) {
      var ci = WP.info(ch[i]), cr = WP.rec(ch[i]), who = WP.holderOf(ch[i]);
      var whoName = who && who !== id ? ' (' + ((data.find(who) || {}).name || who) + ' 사용 중)' : '';
      opts += '<option value="' + ch[i] + '"' + (ch[i] === wid ? ' selected' : '') + '>★' + ci.rarity + ' ' + esc(ci.name) +
        (WP.isShared(ch[i]) ? '' : ' Lv.' + cr.lv) + whoName + '</option>';
    }
    out += '<select data-wp-equip="' + id + '">' + opts + '</select>';
    var line = '공격 ' + Math.round(WP.atkAt(wid, r.lv, r.asc));
    if (w.sub) { line += ' · ' + WP.STAT_NAMES[w.sub] + ' +' + (WP.subAt(wid, r.lv) * 100).toFixed(1) + '%'; }
    if (w.pas) { line += ' · ' + WP.PASSIVE_NAMES[w.pas] + ' +' + Math.round(WP.passiveAt(wid, r.ref) * 100) + '%'; }
    if (!WP.isShared(wid)) { line += ' · Lv.' + r.lv + '/' + WP.cap(r.asc) + ' · 벼림 ' + r.asc + ' · 울림 ' + r.ref; }
    out += '<small class="muted" style="display:block">' + line + '</small>';
    if (!WP.isShared(wid)) {
      var uc = WP.upCheck(wid), ac = WP.ascCheck(wid), c = WP.upCost(r.lv), a = WP.ascCost(r.asc);
      if (r.lv < WP.MAX_LV && r.lv < WP.cap(r.asc)) {
        out += '<button class="btn ' + (uc.ok ? 'primary' : 'ghost') + ' wide"' + (uc.ok ? '' : ' disabled') + ' data-act="wp-up" data-id="' + id + '" data-wid="' + wid + '">' +
          '🔨 강화 Lv.' + (r.lv + 1) + ' · 🪨 ' + WP.ore() + '/' + c.ore + ' · 🪙 ' + core.fmt(c.gold) + '</button>';
      } else if (a) {
        out += '<button class="btn ' + (ac.ok ? 'primary' : 'ghost') + ' wide"' + (ac.ok ? '' : ' disabled') + ' data-act="wp-asc" data-id="' + id + '" data-wid="' + wid + '">' +
          '✨ 무기 벼림 ' + (r.asc + 1) + ' · 🪙 ' + core.fmt(a.gold) + ' · 丹 ' + a.dust + '</button>';
      }
    } else {
      out += '<small class="muted" style="display:block">옻칠·금박 보물 상자에서 ' + WP.TYPE_NAMES[t] + ' ★3·★4 가 나옵니다.</small>';
    }
    return out + '</div>';
  }

  /** 보패(PLAN §5 ⑲-5) — 부위 다섯·켜진 세트 */
  function artifactBlock(id) {
    var AR = global.DG.artifact;
    if (!AR) { return ''; }
    var eq = AR.equippedOf(id), L = AR.list(), all = Object.keys(L), i, j, k;
    var out = '<div class="dt-artifact"><div class="dt-line"><span>🏺 보패 (' + all.length + '/' + AR.CAP + ')</span><b>💎 ' + AR.polish() + '</b></div>';
    for (i = 0; i < AR.SLOTS.length; i++) {
      var slot = AR.SLOTS[i], cur = eq[slot], opts = '<option value="">' + AR.SLOT_ICON[slot] + ' ' + AR.SLOT_NAMES[slot] + ' — 비움</option>';
      var mine = all.filter(function (u) { return L[u].slot === slot; })
        .sort(function (x, y) { return (L[y].rarity - L[x].rarity) || (L[y].lv - L[x].lv); }).slice(0, 40);
      if (cur && mine.indexOf(cur) < 0) { mine.unshift(cur); }
      for (j = 0; j < mine.length; j++) {
        var a = L[mine[j]], own = a.owner && a.owner !== id ? ' (' + ((data.find(a.owner) || {}).name || a.owner) + ')' : '';
        opts += '<option value="' + mine[j] + '"' + (mine[j] === cur ? ' selected' : '') + '>★' + a.rarity + ' +' + a.lv + ' ' +
          esc(AR.SETS[a.set].name) + ' · ' + esc(AR.statText(a.main, AR.mainValue(a))) + own + '</option>';
      }
      out += '<select data-art-equip="' + id + '" data-slot="' + slot + '">' + opts + '</select>';
      if (cur) {
        var ca = L[cur], subs = ca.subs.map(function (s) { return AR.statText(s[0], s[1]); }).join(' · ');
        var uc = AR.upCheck(cur), c = AR.upCost(ca.lv);
        out += '<small class="muted" style="display:block">' + esc(subs) + '</small>';
        if (ca.lv < AR.MAX_LV[ca.rarity]) {
          out += '<button class="btn ' + (uc.ok ? 'primary' : 'ghost') + ' wide"' + (uc.ok ? '' : ' disabled') + ' data-act="art-up" data-id="' + id + '" data-uid="' + cur + '">' +
            '💎 ' + AR.SLOT_NAMES[slot] + ' +' + (ca.lv + 1) + ' · 💎 ' + AR.polish() + '/' + c.polish + ' · 🪙 ' + c.gold + '</button>';
        }
      }
    }
    var st = AR.statsOf(id);
    for (k = 0; k < st.sets.length; k++) {
      var S = AR.SETS[st.sets[k].id];
      out += '<small style="display:block">' + ico('artifact', AR.SET_IDS.indexOf(st.sets[k].id), 18, '') + '◆ ' + esc(S.name) + ' ' + st.sets[k].n + '세트 — ' + esc(S.text2) + (st.sets[k].n >= 4 ? ' · ' + esc(S.text4) : '') + '</small>';
    }
    if (all.some(function (u) { return L[u].rarity === 4 && !L[u].owner; })) {
      out += '<button class="btn ghost wide" data-act="art-salvage4" data-id="' + id + '">🏺 안 낀 ★4 모두 분해 → 연마석</button>';
    }
    return out + '</div>';
  }

  /** ⑲-11 고유·갈래 스킬 — [갈래] 스킬 이름·설명 두 줄(지략은 원소 기본이라 갈래 이름만) */
  function kitLines(id) {
    var FC = global.DG.fieldCombat, KT = global.DG.kits;
    if (!FC || !KT || !FC.kitFor) { return ''; }
    var el = FC.elementOf(id), k = FC.kitFor(id), E = FC.EL[el], lb = KT.labelOf(id, el);
    if (!k) { return lb ? '<small class="muted" style="display:block">[' + lb + '] ' + E.icon + ' 원소 스킬·해방 — 원소 기본(모양은 인물마다)</small>' : ''; }
    return '<small style="display:block">[' + k.label + '] 🌀 <b>' + esc(k.skill.name) + '</b> — ' + esc(k.skill.text) + '</small>' +
      '<small style="display:block">[' + k.label + '] 💥 <b>' + esc(k.burst.name) + '</b> — ' + esc(k.burst.text) + '</small>';
  }
  /** 무예 단계·깨달음(PLAN §5 ⑲-4) — 들판 전투 피해에만 탄다 */
  function talentBlock(id) {
    var TL = global.DG.talent;
    if (!TL) { return ''; }
    var rank = hero().info(id).rank || 0, cap = TL.cap(rank), i, k, out = '<div class="dt-talent">';
    var mt = [];
    for (k in TL.MATS) {
      if (Object.prototype.hasOwnProperty.call(TL.MATS, k)) { mt.push(TL.MATS[k].icon + ' ' + TL.count(k)); }
    }
    out += '<div class="dt-line"><span>⚔️ 무예 (상한 ' + cap + ' · 승급 ★' + rank + ')</span><b>' + mt.join(' ') + '</b></div>';
    out += kitLines(id);                                               // ⑲-11 고유·갈래 스킬 이름·설명
    for (i = 0; i < TL.KINDS.length; i++) {
      var K = TL.KINDS[i], lv = TL.baseLevel(id, K.key), eff = TL.level(id, K.key);
      var chk = TL.upCheck(id, K.key), c = TL.cost(lv), label;
      var head = K.icon + ' ' + K.name + ' <b>' + eff + '</b>' + (eff > lv ? '<small>(+' + (eff - lv) + ')</small>' : '') +
        ' <small>×' + TL.mulAt(eff) + '</small>';
      if (lv >= TL.MAX) { label = head + ' <small>· 최대</small>'; }
      else if (lv >= cap) { label = head + ' <small>· 승급 ★' + TL.nextRankFor(lv + 1) + ' 에 열림</small>'; }
      else {
        label = head + ' <small>· 🪙 ' + core.fmt(c.gold) + ' · ' + TL.MATS[c.book].icon + ' ' + TL.count(c.book) + '/' + c.books +
          ' · 丹 ' + c.dust + (c.scale ? ' · ' + TL.MATS.scale.icon + ' ' + TL.count('scale') + '/' + c.scale : '') + '</small>';
      }
      out += '<button class="btn ' + (chk.ok ? 'primary' : 'ghost') + ' wide"' + (chk.ok ? '' : ' disabled') +
        ' data-act="talent-up" data-id="' + id + '" data-key="' + K.key + '">' + label + '</button>';
    }
    var con = TL.con(id), dots = '';
    for (i = 0; i < TL.CON_MAX; i++) { dots += i < con ? '●' : '○'; }
    out += '<div class="dt-line"><span>🌟 깨달음 ' + dots + '</span><b>' + con + '/' + TL.CON_MAX + '</b></div>';
    for (i = 0; i < TL.CON_MAX; i++) {
      out += '<small class="' + (i < con ? '' : 'muted') + '" style="display:block">' + (i < con ? '◆' : '◇') + ' ' + (i + 1) + '. ' + esc(TL.CON_TEXT[i]) + '</small>';
    }
    if (con < TL.CON_MAX) {
      var ok = TL.conCheck(id).ok;
      out += '<button class="btn ' + (ok ? 'primary' : 'ghost') + ' wide"' + (ok ? '' : ' disabled') + ' data-act="talent-con" data-id="' + id + '">' +
        '🌟 ' + (con + 1) + '번째 깨달음 열기 · ' + TL.MATS.knot.icon + ' ' + TL.count('knot') + '/1</button>';
    }
    return out + '</div>';
  }

  /** 인연(PLAN §5 ⑥) — 등급·다음까지·결이 맞는 동료 */
  function bondBlock(id) {
    var BD = global.DG.bond;
    if (!BD) { return ''; }
    var pg = BD.progressOf(id), hearts = '', i;
    for (i = 0; i < BD.MAX_LV; i++) { hearts += i < pg.lv ? '❤️' : '🤍'; }
    var out = '<div class="dt-bond"><div class="dt-line"><span>🤝 인연 ' + hearts + '</span><b>+' +
      Math.round(pg.lv * BD.STEP * 100) + '%</b></div>';
    if (pg.max) {
      out += '<small class="muted">더할 것이 없는 사이입니다.</small>';
    } else {
      out += '<small class="muted">함께 걸은 ' + distLabel(pg.walk) + ' / ' + distLabel(pg.needWalk) +
        ' · 토벌 승 ' + pg.wins + ' / ' + pg.needWins + ' (먼저 닿는 쪽) — 동행 중일 때만 쌓입니다.</small>';
    }
    var ps = BD.partnersOf(id);
    if (ps.length) {
      out += '<small class="muted"> · 🔗 결 — ' + esc(ps.join(', ')) + ' 와(과) 같은 세력 (필살 기 +' + BD.KI_PCT + '%)</small>';
    }
    return out + '</div>';
  }

  function renderDetail() {
    if (!openDetailRef) { return; }
    var host = detailHost();
    var ref = data.find(openDetailRef.id);
    if (!ref) { closeDetail(); return; }
    host.innerHTML = openDetailRef.kind === 'pet' ? detailPet(ref) : detailHero(ref);
  }

  /**
   * ⑲-15 편성 단추 — 동행이면 자리(⚔ 들판 1~4 · 대기 5)·◀ 앞 자리로·⚔ 들판 명단에 넣기·빼기,
   * 아니면 넣기(꽉 찼으면 다섯째와 바뀜). formation.js 가 없으면 옛 두 단추
   */
  function partyButtons(h) {
    var FM = global.DG.formation, P = core.save.party, i = P.indexOf(h.id);
    if (!FM) {
      return i >= 0 ? '<button class="btn ghost wide" data-act="drop" data-id="' + h.id + '">동행에서 뺀다</button>'
        : '<button class="btn wide"' + (P.length >= 5 ? ' disabled' : '') + ' data-act="join" data-id="' + h.id + '">동행에 넣는다</button>';
    }
    if (i < 0) {
      var sw = FM.putSwap(h.id), sh = sw ? data.find(sw) : null;
      return '<button class="btn wide" data-act="join" data-id="' + h.id + '">동행에 넣는다' +
        (sw ? ' (다섯째 ' + esc(sh ? sh.name : sw) + '와 바꿈)' : '') + '</button>';
    }
    var out = '<div class="stat-row"><span>자리</span><b>' + (i < FM.FIELD ? '⚔ 들판 명단 ' + (i + 1) : '대기 ' + (i + 1)) + '</b></div>';
    if (i > 0) { out += '<button class="btn wide" data-act="party-up" data-id="' + h.id + '">◀ 앞 자리로</button>'; }
    if (i >= FM.FIELD) { out += '<button class="btn wide" data-act="party-field" data-id="' + h.id + '">⚔ 들판 명단에 넣기</button>'; }
    return out + '<button class="btn ghost wide" data-act="drop" data-id="' + h.id + '">동행에서 뺀다</button>';
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
        '<img class="dt-portrait' + (owned && global.DG.bond && global.DG.bond.lvOf(h.id) >= 3 ? ' bond3' : '') + '" alt=""' + p3tag('hero', h, 150, 172) + p3h.done + ' src="' +
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
        '<div class="dt-line"><span>인물 됨됨이</span><b>' + core.fmt(hero().power(h.id)) + '</b></div>' +
        perkBlock(h.id) + weaponBlock(h.id) + artifactBlock(h.id) + talentBlock(h.id) + bondBlock(h.id);

      out += '<div class="dt-pet"><span>🐾 펫</span>' +
        '<select data-equip="' + h.id + '">' + petOptions(h.id) + '</select>' +
        (bk.pet ? '<small class="muted">' + esc(bk.pet.name) + ' · ' +
          statKor(bk.pet.bonus.stat) + ' +' +
          (growth() ? growth().bonusOf(bk.pet) : bk.pet.bonus.value) +
          (growth() && growth().lvOf(bk.pet.id) ? ' (연성 ' + growth().lvOf(bk.pet.id) + '단)' : '') +
          '</small>'
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
          ' · 🪙 ' + core.fmt(cost.gold) +
          (cost.sp ? ' · ' + ico('material', cost.sp.item, 18, cost.sp.icon) + ' ' + cost.sp.have + '/' + cost.sp.n : '') +
          (cost.boss ? ' · ' + cost.boss.icon + ' ' + cost.boss.have + '/' + cost.boss.n : '') + '</button>';   // ⑲-10 보스 재료
      }
      if (net().online()) {
        out += '<button class="btn wide" data-act="dt-talk" data-id="' + h.id + '">💬 말을 건다 (사관)</button>';
      }
      out += partyButtons(h);                                            // ⑲-15 편성 — 넣기·빼기·앞으로·들판으로
      out += '</div>' +
        '<small class="muted dt-tip">승급은 <b>같은 인물을 또 등용해 생긴 중복분</b>과 금을 씁니다. ' +
        '동행 선두가 지도 위 내 모습이 되고, 조우 성공 때 동행 전원이 경험치를 받습니다.</small>';
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

  /**
   * 반려(伴侶) — 원작의 버디 화면.
   * 곁에 세운 짐승 하나만 진행이 돌고, 우애는 **종별로 남는다**(갈아타도 지워지지 않는다).
   */
  function buddyBlock(p, owned) {
    var B = buddy();
    if (!B || !owned) { return ''; }
    var cur = B.current();
    var mine = !!(cur && cur.pet.id === p.id);
    var bd = B.bondOf(p.id);
    var lg = B.info(p.id);

    /* 보정은 **곁에 세워 둔 동안에만** 붙는다 — 세우지 않은 종에 그냥 "+2%" 라고
       적으면 이미 붙어 있는 것처럼 읽힌다 */
    var out = '<div class="dt-line"><span>반려(伴侶)</span><b>' + bd.def.mark + ' ' + bd.def.name +
      (bd.def.mul ? ' <small class="muted">· ' + (mine ? '장착 보정' : '세우면') + ' +' +
        Math.round(bd.def.mul * 100) + '%</small>' : '') +
      '</b></div>' +
      '<div class="dt-line"><span>함께 걸은 거리</span><b>' + core.fmt(lg.walked) + 'm' +
        (lg.fed ? ' <small class="muted">· 사료 ' + lg.fed + '줌</small>' : '') + '</b></div>';
    if (bd.next) {
      out += '<div class="bar sm"><i style="width:' + (bd.pct * 100) + '%"></i></div>' +
        '<small class="muted">' + bd.next.mark + ' ' + bd.next.name + ' 까지 ' + core.fmt(bd.left) + 'm</small>';
    }
    if (mine) {
      out += '<div class="dt-line"><span>다음 영초</span><b>🌿 ' + cur.herbNext + ' · ' +
          core.fmt(cur.left) + 'm 남음</b></div>' +
        '<div class="bar sm"><i style="width:' + (cur.pct * 100) + '%"></i></div>' +
        '<button class="btn wide" data-act="buddy-feed"' +
          (global.DG.bag.count('feed') < 1 ? ' disabled' : '') + '>🍖 사료를 먹인다 · 우애 +' +
          core.fmt(B.FEED_M) + ' (남은 사료 ' + global.DG.bag.count('feed') + ')</button>' +
        '<button class="btn ghost wide" data-act="buddy-clear">🐾 곁에서 물린다</button>';
    } else {
      out += '<button class="btn primary wide" data-act="buddy-set" data-id="' + p.id + '">' +
        '🐾 반려로 세운다 — ' + core.fmt(B.legOf(p)) + 'm 마다 🌿</button>';
    }
    return out;
  }

  /**
   * 연성(강화) · 승화(진화) — 원작의 사탕 화면.
   * 잡지 않은 종에는 아무것도 뜨지 않는다(무엇이 되는지만 흘려 보여 준다).
   */
  function petGrowBlock(p, owned) {
    var G = growth();
    if (!G) { return ''; }
    var gi = G.info(p.id);
    var ch = G.chainOf(p.id);
    var out = '';

    if (!owned) {
      return ch
        ? '<div class="dt-line"><span>승화</span><b class="muted">' +
            esc((data.find(ch.to) || {}).name || '') + ' 이 된다는 이야기가 있다</b></div>'
        : '';
    }

    /* 연성 */
    var rc = G.refineCheck(p.id);
    var cost = rc.cost || G.refineCost(gi.lv);
    out += '<div class="dt-line"><span>연성(鍊成)</span><b>' + gi.lv + ' / ' + G.MAX_LV + '단</b></div>' +
      '<div class="dt-line"><span>모은 영초</span><b>🌿 ' + core.fmt(gi.herb) +
        ' <small class="muted">· 잡을 때마다 +' + G.HERB_PER_CATCH + '</small></b></div>';
    if (gi.lv >= G.MAX_LV) {
      out += '<small class="muted">더 올릴 수 없습니다 — 연성이 끝났습니다.</small>';
    } else {
      out += '<button class="btn primary wide" data-act="refine" data-id="' + p.id + '"' +
        (rc.ok ? '' : ' disabled') + '>🌿 연성 — 영초 ' + cost.herb + ' · ✨ 단사 ' +
        core.fmt(cost.dust) + (rc.ok ? '' : ' (' + rc.why + ')') + '</button>';
    }

    /* 승화 */
    if (ch) {
      var ac = G.ascendCheck(p.id);
      var to = data.find(ch.to);
      out += '<div class="dt-line"><span>승화(昇華)</span><b>' + esc(to ? to.name : '') +
        ' <small class="muted">· ' + esc(ch.why) + '</small></b></div>' +
        '<button class="btn wide" data-act="ascend" data-id="' + p.id + '"' +
        (ac.ok ? '' : ' disabled') + '>✨ 승화 — 영초 ' + ch.herb +
        (ac.ok ? '' : ' (' + ac.why + ')') + '</button>';
    }
    return out;
  }

  function detailPet(p) {
    var d = core.save.dex.pets[p.id];
    var owned = !!d;
    var G = growth();
    var gi = G ? G.info(p.id) : { lv: 0, herb: 0 };
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
      '<div class="dt-line"><span>장착 보정</span><b>' + statKor(p.bonus.stat) + ' +' +
        (G ? G.bonusOf(p) : p.bonus.value) +
        (G && gi.lv ? ' <small class="muted">(기본 ' + p.bonus.value + ' · 연성 ' + gi.lv + '단)</small>' : '') +
        '</b></div>' +
      buddyBlock(p, owned) +
      petGrowBlock(p, owned) +
      '<p class="dt-bio">' + esc(p.desc || '') + '</p>' +
      '<small class="muted dt-tip">펫은 인물에게 하나씩 장착합니다. 인물 상세 화면에서 고르세요. ' +
        '<b>반려</b>는 따로입니다 — 곁을 걷는 한 마리이고, 장착과 함께 걸 수 있습니다.</small>' +
      '</div>';
  }

  /* ── 토스트 ───────────────────────────────────────────── */

  /**
   * 갈래 있는 토스트 + 짧은 큐(축1, 2026-09-06 "알림이 약하다").
   * 여태는 문자열 하나뿐이라 늘 같은 금테로 떴다 — `type`('good'|'bad'|'find')을
   * 얹으면 색이 갈리고, `find`(걷다가 무언가 찾은 것)는 더 밝고 오래 뜬다.
   * 옛 호출(`toast(문자열)`, `core.emit('toast', 문자열)`)은 그대로 `info`로 온다.
   * 짧은 사이에 여럿이 몰리면(걷기 흥 토스트가 실제로 그렇다) 그냥 덮어쓰던 것을
   * 큐에 쌓아 하나씩 보여준다 — 안 그러면 스치는 알림이 서로를 지운다.
   */
  var toastTimer = null;
  var toastQueue = [];
  var toastBusy = false;

  function pumpToast() {
    if (toastBusy || !toastQueue.length) { return; }
    var t = toastQueue.shift();
    toastBusy = true;
    els.toast.textContent = t.msg;
    els.toast.className = 'show' + (t.type !== 'info' ? ' t-' + t.type : '');
    if (toastTimer) { clearTimeout(toastTimer); }
    var dur = t.type === 'find' ? 3400 : 2600;
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
      toastBusy = false;
      setTimeout(pumpToast, 140);
    }, dur);
  }

  function toast(msg, type) {
    if (msg && typeof msg === 'object') { type = msg.type; msg = msg.msg; }
    if (!msg) { return; }
    toastQueue.push({ msg: msg, type: type || 'info' });
    while (toastQueue.length > 4) { toastQueue.shift(); }   // 너무 밀리면 오래된 것부터 버린다
    pumpToast();
  }

  /**
   * 레벨 업 — 여태 `core.log`(기록 시트에나 남는 글자 한 줄)뿐이었다(축3,
   * "레벨업도 숫자 말고는 연출이 약하다"). `core.emit('levelup', lv)`는
   * 이미 있었는데 듣는 곳이 없었다 — 화면 가운데 잠깐 뜨는 띠 하나만 붙인다.
   * 조작을 막지 않는다(pointer-events:none) — 걷거나 싸우는 중에도 그냥 지나간다.
   */
  var levelupTimer = null;
  function showLevelUp(lv) {
    if (!els.levelup) { return; }
    els.levelup.innerHTML = '<div class="lv-banner"><b>LEVEL UP</b><span>' + (global.DG.adventure ? '여정 등급 ' : 'Lv.') + lv + '</span></div>';
    els.levelup.classList.remove('show');
    void els.levelup.offsetWidth;               // 리플로우를 강제해 연타 레벨업도 매번 다시 재생한다
    els.levelup.classList.add('show');
    if (levelupTimer) { clearTimeout(levelupTimer); }
    levelupTimer = setTimeout(function () { els.levelup.classList.remove('show'); }, 1800);
  }

  /**
   * 마무리 카드 — PLAN §5 ④, 표준 B(세션 마무리 카드). `visibilitychange hidden`
   * ·5분 무입력·자동 순행 끔에서 game.js 가 diff(걸음·만남·금)를 재서 부른다.
   * `#encounter`(조우 모달)를 그대로 빌려 쓴다 — game.js 가 부르기 전에
   * `event.live`(다른 조우가 열려 있는지)를 먼저 살핀다.
   */
  var sessionCardTimer = null;
  function showSessionCard(diff) {
    var el = $('encounter');
    if (!el) { return; }
    var rate = global.DG.codex ? global.DG.codex.rate() : null;
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 6px;font-size:17px">🌙 이번 나들이</h3>' +
        '<div class="stat-row"><span>걸음</span><b>' + core.fmt(diff.steps) + 'm</b></div>' +
        '<div class="stat-row"><span>만남</span><b>' + core.fmt(diff.meet) + '</b></div>' +
        '<div class="stat-row"><span>금</span><b>🪙 ' + core.fmt(diff.gold) + '</b></div>' +
        (rate ? '<div class="stat-row"><span>도감</span><b>' + rate.pct + '%</b></div>' : '') +
        '<div class="p-goal now" style="margin-top:8px">다음 · 🧭 ' + goalNowText() + '</div>' +
        '<button class="btn primary wide" id="daily-card-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    var close = function () {
      el.classList.remove('show'); el.innerHTML = '';
      if (sessionCardTimer) { clearTimeout(sessionCardTimer); sessionCardTimer = null; }
    };
    var btn = $('daily-card-ok');
    if (btn) { btn.addEventListener('click', close); }
    if (sessionCardTimer) { clearTimeout(sessionCardTimer); }
    sessionCardTimer = setTimeout(close, 5000);
  }

  /** 매 프레임이 아니라 주기적으로만 갱신한다 */
  function tickRefresh() {
    renderTop();
    renderNear();
    renderAutoBar();
    syncHeaderStack();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    if (openTab === 'oracle' || openTab === 'dungeon') { renderSheet(); }
  }

  /**
   * 상단 띠(#top)의 실제 높이는 고정이 아니다 — 손잡이 줄(🎛️)이 붙거나 지갑이
   * 두 줄로 접히면 늘어난다. `#autobar`·`#minimap` 이 그걸 모른 채 `top:106px`
   * 같은 값으로 박혀 있으면 그 밑에 겹쳐 버린다(자동 순행 문구가 지갑을 덮은
   * 실기기 신고로 잡았다) — 매 갱신마다 실제로 재서 CSS 변수로 넘긴다.
   */
  function syncHeaderStack() {
    if (!els.wallet) { return; }
    var topBottom = Math.ceil(els.wallet.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--top-bottom', topBottom + 'px');
    var belowHeader = topBottom;
    var root = document.documentElement.style, autoH = 0;
    if (els.autobar && els.autobar.classList.contains('show')) {
      var ab = els.autobar.getBoundingClientRect();
      belowHeader = Math.max(belowHeader, Math.ceil(ab.bottom));
      autoH = Math.ceil(ab.height) + 6;
    }
    /* 폰 세로 — 지역 사명·이야기 추적 줄이 `top:58px`·`86px` 고정이라 두 줄로 불어난 윗 카드
       위에 겹쳤다. 자동 순행 띠 밑으로 차례로 쌓고(CSS 600px 규칙), 미니맵은 그 밑으로 */
    if (isPhonePortrait()) {
      root.setProperty('--autobar-h', autoH + 'px');
      var rm = document.getElementById('region-mission'), mh = 0;
      if (rm && rm.style.display !== 'none' && rm.textContent) { mh = Math.ceil(rm.getBoundingClientRect().height) + 4; }
      root.setProperty('--mission-h', mh + 'px');
      ['region-mission', 'story-track'].forEach(function (id) {
        var e = document.getElementById(id);
        if (e && e.style.display !== 'none' && e.textContent) { belowHeader = Math.max(belowHeader, Math.ceil(e.getBoundingClientRect().bottom)); }
      });
    }
    root.setProperty('--below-header', belowHeader + 'px'); var stk = document.getElementById('story-track'), sb = stk && stk.style.display !== 'none' && stk.textContent ? Math.ceil(stk.getBoundingClientRect().bottom) : 0; root.setProperty('--toast-top', Math.max(84, sb + 6) + 'px');   // W-0127 — 알림이 이야기 띠(#story-track)를 덮지 않게 그 밑으로
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
  /* 2026-09-09 — "움직이는 게 너무 힘들다"(사가나락 등과 같은 재신고).
     이 판은 실제 GPS 로 걷는 게 원작 컨셉이라 오버월드 이동에 조이스틱은
     안 맞지만, PC 프로토타입용 "키보드(모의 이동)" 모드(world.js
     mode==='keyboard')에는 그대로 맞는다 — world.js 에 이미 있던
     setStick(dx,dy) 채널(그때까지 아무 화면도 안 부르고 있었다)에 연결한다.
     GPS 로 전환하면(#btn-geo) 숨긴다 — 실제로 걷는 동안 손가락 조작이
     끼어들면 안 된다. */
  function stickSync() {
    var joyEl = $('gjoy'), padEl = $('gpad');
    if (!joyEl || !padEl) { return; }
    var W = global.DG.world;
    var on = !!(W && W.mode === 'keyboard');
    var isTouch = !!(('ontouchstart' in global) || (navigator.maxTouchPoints > 0));
    joyEl.classList.toggle('show', on && isTouch);
    padEl.classList.toggle('show', on && !isTouch);
  }
  function initStick() {
    var joyEl = $('gjoy'), joyKnob = $('gjoy-knob'), padEl = $('gpad');
    if (!joyEl || !joyKnob || !padEl) { return; }
    stickSync();
    var W = global.DG.world;
    var joyId = null, joyCX = 0, joyCY = 0;
    var JOY_R = 46, JOY_DEAD = 8;
    function knobAt(dx, dy) { joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    function reset() { joyId = null; knobAt(0, 0); W.setStick(0, 0, false); }
    joyEl.addEventListener('pointerdown', function (e) {
      if (joyId !== null) { return; }
      var r = joyEl.getBoundingClientRect();
      joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
      joyId = e.pointerId;
      joyEl.setPointerCapture && joyEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    joyEl.addEventListener('pointermove', function (e) {
      if (e.pointerId !== joyId) { return; }
      var dx = e.clientX - joyCX, dy = e.clientY - joyCY;
      var len = Math.hypot(dx, dy);
      var kx = len > JOY_R ? dx / len * JOY_R : dx, ky = len > JOY_R ? dy / len * JOY_R : dy;
      knobAt(kx, ky);
      if (len < JOY_DEAD) { W.setStick(0, 0, false); return; }
      W.setStick(dx / len, dy / len, false);
      e.preventDefault();
    });
    function release(e) { if (e.pointerId === joyId) { reset(); } }
    joyEl.addEventListener('pointerup', release);
    joyEl.addEventListener('pointercancel', release);
    joyEl.addEventListener('pointerleave', release);

    var held = { up: false, down: false, left: false, right: false };
    function apply() {
      var dx = (held.left ? -1 : 0) + (held.right ? 1 : 0);
      var dy = (held.up ? -1 : 0) + (held.down ? 1 : 0);
      var len = Math.hypot(dx, dy);
      W.setStick(len ? dx / len : 0, len ? dy / len : 0, false);
    }
    var btns = padEl.querySelectorAll('button[data-dir]');
    for (var pi = 0; pi < btns.length; pi++) {
      (function (btn) {
        var dir = btn.getAttribute('data-dir');
        btn.addEventListener('pointerdown', function (e) {
          held[dir] = true; apply();
          btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        function rel() { held[dir] = false; apply(); }
        btn.addEventListener('pointerup', rel);
        btn.addEventListener('pointercancel', rel);
        btn.addEventListener('pointerleave', rel);
      })(btns[pi]);
    }
  }

  global.DG.ui = {
    init: init, toast: toast, tickRefresh: tickRefresh,
    openSheet: openSheet, closeSheet: closeSheet,
    openDetail: openDetail, closeDetail: closeDetail,
    renderPanel: renderSheet, renderHud: renderTop,
    syncStick: stickSync,
    goalNowText: goalNowText, showSessionCard: showSessionCard
  };
})(window);
