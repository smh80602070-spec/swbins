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
            '<span class="tag">' + eraIcon(h.era) + ' ' + esc(h.era) + '</span>' +
            '<span class="tag" style="color:' + rar.color + '">' + rar.label + '</span>' +
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

      /* 인물별 서명 무예(2026-09-11) — 파일럿 8명만 있다. 없으면 아무것도
         안 그린다("곧 옵니다" 문구로 97명을 도배하지 않는다). */
      var HS = global.DG.heroSkillData && global.DG.heroSkillData.sigOf(h.id);
      if (HS) {
        out += '<div class="dt-sig" style="color:#c7a76c">⭐ 서명 무예 ' + HS.emoji + ' ' +
          '<b>' + esc(HS.name) + '</b>' +
          '<div class="muted" style="font-size:11px">' + esc(HS.desc) + '</div></div>';
      }
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
        '<small class="muted dt-tip">승급은 <b>중복분</b>과 금을 씁니다. 중복은 보스를 잡을 때 ' +
        '이미 있는 인물이 또 합류하면 쌓입니다. 던전에서 층을 깨면 동행 전원이 경험치를 받습니다.</small>';
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
            '<span class="tag" style="color:' + rar.color + '">' + rar.label + '</span>' +
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
    renderAutoBar();
    syncHeaderStack();
    renderLoadbar();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    if (openTab === 'party' || openTab === 'gear') { renderSheet(); }
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
    openTab: function () { return openTab; },   // §5.16 몸짓 — 닿아 연 시트가 아직 열려 있나
    openDetail: openDetail, closeDetail: closeDetail,
    renderPanel: renderSheet, renderHud: renderTop, renderCamp: renderCamp, renderGoals: renderGoals
  };
})(window);
