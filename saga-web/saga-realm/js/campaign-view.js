/**
 * 5천하 조조전식 장 흐름 화면 (W-0450) — 노선도 · 이야기 · 진영(편성·장비·상점·대화) · 격자 전투 · 결과
 * ---------------------------------------------------------------
 * 전체 화면 #campaign 이 옛 지역 지도 위를 덮는다(손잡이 realm.campaign 0 이면 안 연다). 셈은 campaign.js, 전투는 tacticsView 한 벌.
 *   DG.campaignView.on() · open() · close() · show(step) · _host()
 * 글자 클래스는 cpg-(strategy.css 의 cp- 와 안 겹치게). 색은 style.css 변수(--glass·--ink·--ink-dim·--gold).
 */
(function (global) {
  'use strict';
  var doc = global.document, host = null, tab = 'party', pick = null;
  function CP() { return global.DG.campaign; }
  function OFF() { return global.DG.off; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function on() { return !!(CP() && CP().on()); }
  function face(id, sz) { var h = OFF().find(id), P3 = global.DG.portrait3d; sz = sz || 64; try { return h ? (P3 && P3.of && P3.of('hero', h, sz, sz)) || global.DG.sprite.portrait('hero', h, sz) : ''; } catch (e) { return ''; } }   // 구워 둔 초상 파일 먼저
  function nm(id) { var h = OFF().find(id); return h ? h.name : id; }
  function toast(t) { var U = global.DG.ui; if (U && U.toast) { U.toast(t); } }
  var GOAL = { rout: '적 전멸', leader: '적 대장 격파', gate: '성문 점령', hold: '버티기' }, LAND = { plain: '평야', hill: '구릉', river: '강', mount: '산' };

  function css() {
    if (doc.getElementById('cpg-css')) { return; }
    var st = doc.createElement('style'); st.id = 'cpg-css';
    st.textContent = '#campaign{position:fixed;inset:0;z-index:30;overflow:auto;color:var(--ink,#eee);background:radial-gradient(ellipse at 50% 0%,#2a2218 0%,#14110d 60%,#0b0a08 100%);font-family:inherit;padding:calc(12px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))}' +
      '#campaign *{box-sizing:border-box}.cpg-top{display:flex;align-items:center;gap:10px;margin:0 auto 12px;max-width:980px}.cpg-top h2{margin:0;font-size:20px;flex:1;letter-spacing:.04em}' +
      '.cpg-gold{color:var(--gold,#f0c860);font-weight:700}.cpg-btn{background:linear-gradient(#5a4526,#3b2c17);color:#f3e2bd;border:1px solid #8a6a3a;border-radius:8px;padding:9px 14px;font:inherit;font-weight:700;cursor:pointer;min-height:40px}' +
      '.cpg-btn.ghost{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.18);color:var(--ink,#eee)}.cpg-btn:disabled{opacity:.45;cursor:default}' +
      '.cpg-wrap{max-width:980px;margin:0 auto}.cpg-act{margin:14px 0 6px;color:var(--ink-dim,#bba);font-size:13px;letter-spacing:.1em}' +
      '.cpg-route{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.cpg-node{position:relative;width:132px;min-height:86px;border-radius:12px;padding:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);text-align:left;color:inherit;font:inherit;cursor:default}' +
      '.cpg-node b{display:block;font-size:13px;margin-top:4px}.cpg-node small{color:var(--ink-dim,#bba);font-size:11px}.cpg-node .e{font-size:22px}.cpg-node.done{border-color:#5f8a4a}.cpg-node.done::after{content:"✓";position:absolute;right:8px;top:6px;color:#8fd06a;font-weight:800}' +
      '.cpg-node.now{border-color:var(--gold,#f0c860);box-shadow:0 0 0 2px rgba(240,200,96,.35),0 0 18px rgba(240,200,96,.25);cursor:pointer;background:rgba(240,200,96,.08)}.cpg-node.lock{opacity:.38}.cpg-node.done{cursor:pointer}' +
      '.cpg-story{position:relative;min-height:calc(100vh - 40px);display:flex;flex-direction:column;justify-content:flex-end;border-radius:14px;overflow:hidden;background:#000 center/cover no-repeat}' +
      '.cpg-story .ov{background:linear-gradient(transparent,rgba(8,6,4,.86) 38%,rgba(8,6,4,.96));padding:24px 20px 20px}.cpg-story h3{margin:0 0 4px;font-size:22px}.cpg-story p{line-height:1.7;margin:8px 0 14px;max-width:760px;white-space:pre-wrap}' +
      '.cpg-choices{display:grid;gap:8px;max-width:760px}.cpg-choice{text-align:left}.cpg-choice small{display:block;font-weight:400;color:#d9c9a4;font-size:12px;margin-top:2px}' +
      '.cpg-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.cpg-tabs .cpg-btn{padding:7px 12px;min-height:36px}.cpg-tabs .on{outline:2px solid var(--gold,#f0c860)}' +
      '.cpg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.cpg-card{display:flex;gap:8px;align-items:center;padding:8px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:inherit;font:inherit;text-align:left;cursor:pointer;position:relative}' +
      '.cpg-card img{width:52px;height:52px;border-radius:8px;flex:none;background:#222}.cpg-card b{display:block;font-size:13px}.cpg-card small{color:var(--ink-dim,#bba);font-size:11px;line-height:1.4}' +
      '.cpg-card.sel{border-color:var(--gold,#f0c860);background:rgba(240,200,96,.1)}.cpg-card .n{position:absolute;right:6px;top:4px;color:var(--gold,#f0c860);font-weight:800}' +
      '.cpg-brief{margin:12px 0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);font-size:13px;line-height:1.6}' +
      '.cpg-row{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}.cpg-battle{position:relative;min-height:calc(100vh - 40px)}.cpg-battle .tacview{position:absolute}' +
      '.cpg-result{max-width:520px;margin:10vh auto 0;text-align:center;padding:22px;border-radius:14px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.12)}.cpg-result h3{font-size:26px;margin:0 0 8px}';
    st.textContent += 'body.cpg-on #aq-go,body.cpg-on #rregion-hud,body.cpg-on #btn-3d,body.cpg-on #btn-gyeong,body.cpg-on #btn-rts,body.cpg-on #wallet,body.cpg-on #profile,body.cpg-on #dock{display:none!important}' +
      'body.cpg-on #top{z-index:35}body.cpg-on #sheet{z-index:36}body.cpg-on .cpg-top{padding-right:112px}';   // ④ 지도용 단추는 숨기고 ⋯ 메뉴(소리·설정·도움·리셋)·설정창은 장 흐름 위로   // 옛 지도 화면의 시정 위임 ▶·지역 고르기는 장 흐름 동안 숨김
    doc.head.appendChild(st);
  }
  function ensure() {
    css();
    if (!host) { host = doc.createElement('div'); host.id = 'campaign'; doc.body.appendChild(host); host.addEventListener('click', onClick); }
    host.style.display = ''; doc.body.classList.add('cpg-on');
    return host;
  }
  function open() { if (!on()) { return false; } ensure(); var cp = CP().state(); show(cp && cp.step === 'camp' ? 'camp' : 'route'); return true; }
  function close() { if (host) { host.style.display = 'none'; } doc.body.classList.remove('cpg-on'); }

  function top(title, extra) {
    var cp = CP().state(), lord = OFF().lordOf ? OFF().lordOf(global.DG.rtk.me()) : null;
    return '<div class="cpg-top"><h2>' + esc(title) + '</h2>' + (extra || '') + '<span>' + (lord ? esc(nm(lord)) + ' 군 · ' : '') + '<span class="cpg-gold">💰 ' + cp.gold + '</span></span></div>';
  }
  function show(step) {
    ensure();
    var cp = CP().state();
    if (!cp) { return; }
    if (step) { CP().setStep(step); }
    var s = cp.step, html = '';
    if (s === 'story') { html = story(); }
    else if (s === 'camp') { html = camp(); }
    else { html = route(); }
    host.innerHTML = html;
    host.scrollTop = 0;
  }

  /* ── 노선도 ── */
  function route() {
    var cp = CP().state(), list = CP().chapters(), html = top('천하 노선도' + (cp.round ? ' · ' + (cp.round + 1) + '회차' : '')), act = null;
    html += '<div class="cpg-wrap">';
    list.forEach(function (c) {
      if (c.act !== act) { if (act !== null) { html += '</div>'; } act = c.act; html += '<div class="cpg-act">' + esc(c.actName) + '</div><div class="cpg-route">'; }
      var done = !!cp.cleared[c.no], now = c.no === cp.ch, cls = done ? 'done' : now ? 'now' : 'lock';
      html += '<button class="cpg-node ' + cls + '" data-cp="ch" data-no="' + c.no + '"><span class="e">' + esc(c.emoji) + '</span><small>제 ' + c.no + ' 장</small><b>' + esc(c.title) + '</b><small>' + (c.epi ? '후일담' : esc(LAND[c.land] || c.land) + ' · ' + esc(GOAL[c.goal] || c.goal)) + '</small></button>';
    });
    if (act !== null) { html += '</div>'; }
    html += '<div class="cpg-row"><button class="cpg-btn ghost" data-cp="camp">🏕 진영</button>' + (CP().ended() ? '<button class="cpg-btn" data-cp="ending">👑 결말 · 회차</button>' : '<button class="cpg-btn" data-cp="ch" data-no="' + cp.ch + '">▶ 제 ' + cp.ch + ' 장으로</button>') + '</div></div>';
    return html;
  }
  /* ── 이야기 ── */
  function story() {
    var cp = CP().state(), c = CP().chapter(cp.viewCh || cp.ch), CS = global.DG.cutscene, bg = CS && CS.url ? CS.url('realm', c.id) : null;
    var html = '<div class="cpg-story" style="' + (bg ? 'background-image:url(' + bg + ')' : '') + '"><div class="ov">';
    html += '<small style="color:var(--ink-dim,#bba)">' + esc(c.actName) + ' · 제 ' + c.no + ' 장</small><h3>' + esc(c.emoji) + ' ' + esc(c.title) + '</h3><p>' + esc(CP().fillText(c.text)) + '</p><div class="cpg-choices">';
    if (c.epi && c.no === cp.ch && !cp.cleared[c.no]) { html += '<button class="cpg-btn cpg-choice" data-cp="choose" data-k="util">이어서 ▶<small>후일담 — 금 +300</small></button>'; }
    else if (c.no === cp.ch && !cp.cleared[c.no]) {
      (c.choices.length ? c.choices : [{ k: 'atk', label: '나아간다' }]).forEach(function (ch) {
        var how = ch.k === 'atk' ? '이번 장 내 병력 +15%' : ch.k === 'def' ? '이번 장 적 병력 −10%' : '금 +200';
        html += '<button class="cpg-btn cpg-choice" data-cp="choose" data-k="' + esc(ch.k) + '">' + esc(ch.label || ch.k) + '<small>' + how + '</small></button>';
      });
    } else { html += '<button class="cpg-btn ghost" data-cp="route">노선도로</button>'; }
    return html + '</div></div></div>';
  }
  /* ── 진영 ── */
  function skillTag(id) { var HS = global.DG.heroSkill, s = HS && HS.of ? HS.of(id) : null; return s ? '<span style="color:#f3d27a" title="' + esc(s.desc) + '">✦ ' + esc(s.name) + '</span>' : ''; }   // W-0453 고유 스킬
  function lvOf(id) { var g = OFF().grow ? OFF().grow(id) : null; return g ? 'Lv ' + g.lv + ' · ' : ''; }
  function statLine(id) { var s = OFF().stats(id) || {}, r = OFF().rec(id), it = r && r.item && global.DG.item ? global.DG.item.itemById(r.item) : null; return lvOf(id) + '무 ' + (s.might || 0) + ' · 지 ' + (s.wisdom || 0) + ' · 통 ' + (s.command || 0) + '<br>' + skillTag(id) + (it ? ' · ' + esc(it.emoji + ' ' + it.name) : ''); }
  function camp() {
    var cp = CP().state(), c = CP().chapter(cp.ch), html = top('진영 — 제 ' + c.no + ' 장 「' + c.title + '」', '<button class="cpg-btn ghost" data-cp="route">노선도</button>');
    html += '<div class="cpg-wrap"><div class="cpg-tabs">' + [['party', '⚔ 편성'], ['gear', '🛡 장비'], ['shop', '🏪 상점'], ['talk', '💬 대화']].map(function (t) { return '<button class="cpg-btn ghost' + (tab === t[0] ? ' on' : '') + '" data-cp="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'party') { html += partyTab(); } else if (tab === 'gear') { html += gearTab(); } else if (tab === 'shop') { html += shopTab(); } else { html += talkTab(); }
    var o = CP().battleOpts(cp.ch), bn = cp.bonus && cp.bonus.ch === cp.ch ? (cp.bonus.k === 'atk' ? ' · 사기 높음(병력 +15%)' : cp.bonus.k === 'def' ? ' · 적 흔들림(적 −10%)' : '') : '';
    html += '<div class="cpg-brief">📜 ' + esc(LAND[c.land] || c.land) + (c.siege ? ' 공성' : ' 들판') + ' · 승리 조건 <b>' + esc(GOAL[c.goal]) + '</b> · 내 병력 ' + o.myTroops[0] + ' / 적 ' + o.foeTroops[0] + bn + '<br>적장: ' + o.foes.map(nm).map(esc).join(' · ') + (function () { var s = CP().stageOf(cp.ch); if (!s) { return ''; } var p = cp.pre && cp.pre.ch === cp.ch ? cp.pre : null; return '<br>' + (s.kind === 'duel' ? '🤺 전투 앞 일기토' : '🗣 전투 앞 설전') + ' 「' + esc(s.title) + '」' + (p ? (p.won ? ' — 이김(적 병력 ' + (p.kind === 'duel' ? '−20%' : '−15%') + ')' : ' — 졌음') : ' — 출진 때 먼저'); })() + '</div>';
    html += '<div class="cpg-row"><button class="cpg-btn" data-cp="go"' + (o.mine.length ? '' : ' disabled') + '>출진 ▶</button></div></div>';
    return html;
  }
  function partyTab() {
    var sel = CP().party(), html = '<div class="cpg-grid">';
    CP().roster().forEach(function (h) { var i = sel.indexOf(h.id); html += '<button class="cpg-card' + (i >= 0 ? ' sel' : '') + '" data-cp="pick" data-id="' + esc(h.id) + '">' + (i >= 0 ? '<span class="n">' + (i + 1) + '</span>' : '') + '<img alt="" src="' + face(h.id, 52) + '"><span><b>' + esc(h.name) + '</b><small>' + statLine(h.id) + '</small></span></button>'; });
    return html + '</div><div class="cpg-brief" style="margin-top:8px">출진은 셋까지 — 눌러 넣고 뺍니다. 첫째가 대장입니다.</div>' + mercHtml();
  }
  /* W-0455 용병 — 장수마다 둘(눌러 창→기→궁) · 적 편성 미리 보기(상성 창>기>궁>창) */
  var ARM_IC = { spear: '🔱 창병', cav: '🐎 기병', bow: '🏹 궁병' };
  function mercHtml() {
    if (!global.DG.command || !global.DG.command.on()) { return ''; }
    var cp = CP().state(), btn = 'class="cpg-btn ghost" style="margin:2px;padding:4px 9px;min-height:30px"';
    var html = '<div class="cpg-brief" style="margin-top:8px"><b>⚑ 용병</b> <span class="muted">장수마다 둘 — 눌러 병종을 바꿉니다. 지휘관이 쓰러지면 휘하가 흩어집니다.</span>';
    var RC = global.DG.realmClass;
    CP().party().forEach(function (id) { var ck = CP().clsOf ? CP().clsOf(id) : '', cc = CP().classChoices ? CP().classChoices(id) : [];   // W-0457 직업·전직
      html += '<div style="margin-top:4px"><b>' + esc(nm(id)) + '</b> ' + (RC && ck ? '<span style="color:#cfe6ff" title="' + esc(RC.CLS[ck].desc) + '">' + RC.CLS[ck].emoji + ' ' + esc(RC.CLS[ck].name) + '</span> ' : '') + (cc.length ? '<span style="color:#ffe27a">⬆ 전직</span> ' + cc.map(function (k) { return '<button ' + btn + ' data-cp="cls" data-id="' + esc(id) + '" data-k="' + k + '" title="' + esc(RC.CLS[k].desc) + '">' + RC.CLS[k].emoji + ' ' + esc(RC.CLS[k].name) + ' <small class="muted">' + esc(RC.CLS[k].desc) + '</small></button>'; }).join('') + '<br>' : '') + CP().mercsOf(id).map(function (a, k) { return '<button ' + btn + ' data-cp="merc" data-id="' + esc(id) + '" data-k="' + k + '">' + ARM_IC[a] + '</button>'; }).join('') + '</div>'; });
    var fm = CP().foeMercs(cp.ch);
    if (fm.length) { html += '<div style="margin-top:6px;color:#ffb3a6">🔴 적 편성 — ' + fm.map(function (f) { return esc(nm(f.id)) + (f.cls && RC ? ' ' + RC.CLS[f.cls].emoji + esc(RC.CLS[f.cls].name) : '') + ' (' + f.arms.map(function (a) { return ARM_IC[a]; }).join(' · ') + ')'; }).join(' / ') + '</div><div class="muted">상성 창 > 기 > 궁 > 창 (±20%p)</div>'; }
    return html + '</div>';
  }
  /* W-0453 장비 탭 — 가방(장비 g:id · 보물 t:번호)에서 하나 고르고 → 그 칸이 맞는 장수의 「끼우기」. 장수마다 무기·방어구·장신구·보물 네 칸 */
  function GR() { return global.DG.realmGear; }
  function gname(it) { var G = GR().GRADE[it.grade]; return '<span style="color:' + G.col + '">' + esc(it.emoji + ' ' + it.name) + '</span>'; }
  function pickInfo() { if (pick == null) { return null; } var cp = CP().state(), s = String(pick); if (s.indexOf('g:') === 0) { var it = GR() && GR().byId(s.slice(2)); return it ? { g: it } : null; } var t = cp.bag[+s.slice(2)]; return t ? { t: t } : null; }
  function gearTab() {
    var cp = CP().state(), I = global.DG.item, pi = pickInfo(), btn = 'class="cpg-btn ghost" style="margin:2px;padding:5px 9px;min-height:32px"';
    var html = '<div class="cpg-brief">🎒 장비: ' + (cp.gbag.length ? cp.gbag.map(function (id) { var it = GR().byId(id); return it ? '<button ' + btn.replace('ghost', 'ghost' + (pick === 'g:' + id ? ' on' : '')) + ' data-cp="bag" data-k="g:' + esc(id) + '" title="' + esc(GR().lineOf(it)) + '">' + gname(it) + '</button>' : ''; }).join('') : '없음') +
      '<br>💎 보물: ' + (cp.bag.length ? cp.bag.map(function (id, k) { var it = I.itemById(id); return '<button ' + btn.replace('ghost', 'ghost' + (pick === 't:' + k ? ' on' : '')) + ' data-cp="bag" data-k="t:' + k + '">' + esc(it ? it.emoji + ' ' + it.name : id) + '</button>'; }).join('') : '없음') +
      (pi && pi.g ? '<br><span style="color:#f3d27a">' + esc(GR().SLOT_NAME[pi.g.slot]) + ' — ' + esc(GR().lineOf(pi.g)) + '</span>' : '') + '</div><div class="cpg-grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">';
    CP().party().forEach(function (id) {
      var r = OFF().rec(id), g = CP().gearOf(id), rows = ['w', 'a', 'c'].map(function (s) { var it = GR().byId(g[s]); return '<div>' + esc(GR().SLOT_NAME[s]) + ' ' + (it ? gname(it) + ' <a data-cp="ungear" data-id="' + esc(id) + '" data-s="' + s + '" style="cursor:pointer;color:#c9b48a">✕</a>' : '<span class="muted">—</span>') + '</div>'; }).join('');
      var tr = r && r.item ? I.itemById(r.item) : null;
      rows += '<div>보물 ' + (tr ? esc(tr.emoji + ' ' + tr.name) + ' <a data-cp="unequip" data-id="' + esc(id) + '" style="cursor:pointer;color:#c9b48a">✕</a>' : '<span class="muted">—</span>') + '</div>';
      html += '<div class="cpg-card" style="align-items:flex-start"><img alt="" src="' + face(id, 52) + '"><span style="flex:1"><b>' + esc(nm(id)) + '</b> <small>' + skillTag(id) + '</small><small style="display:block;line-height:1.7">' + rows + '</small>' + (pi ? '<button class="cpg-btn" style="padding:4px 10px;min-height:30px;margin-top:4px" data-cp="equip" data-id="' + esc(id) + '">끼우기</button>' : '') + '</span></div>';
    });
    return html + '</div>';
  }
  function shopTab() {
    var cp = CP().state(), html = '<div class="cpg-act" style="margin-top:0">준비물 — 이번 장 한정</div><div class="cpg-grid">';
    CP().PREP.forEach(function (p) { var have = CP().prepHave(p.id); html += '<div class="cpg-card"><span style="font-size:30px;width:52px;text-align:center">' + esc(p.emoji) + '</span><span><b>' + esc(p.name) + '</b><small>' + esc(p.desc) + '</small><br><button class="cpg-btn" style="padding:4px 8px;min-height:30px;margin-top:4px" data-cp="buyp" data-id="' + p.id + '"' + (have || cp.gold < p.price ? ' disabled' : '') + '>' + (have ? '갖춤 ✓' : '💰 ' + p.price) + '</button></span></div>'; });
    html += '</div><div class="cpg-act">장비 — 이번 장 진열 (장이 오를수록 높은 등급)</div><div class="cpg-grid">';
    CP().gearShop().forEach(function (it) { var p = GR().price(it), G = GR().GRADE[it.grade]; html += '<div class="cpg-card"><span style="font-size:30px;width:52px;text-align:center">' + esc(it.emoji) + '</span><span><b style="color:' + G.col + '">' + esc(it.name) + '</b><small>' + esc(G.name) + ' ' + esc(GR().SLOT_NAME[it.slot]) + '<br>' + esc(GR().lineOf(it)) + '</small><br><button class="cpg-btn" style="padding:4px 8px;min-height:30px;margin-top:4px" data-cp="buyg" data-id="' + esc(it.id) + '"' + (cp.gold < p ? ' disabled' : '') + '>💰 ' + p + '</button></span></div>'; });
    html += '</div><div class="cpg-act">보물</div><div class="cpg-grid">';
    CP().shop().forEach(function (it) { var p = CP().price(it); html += '<div class="cpg-card"><span style="font-size:30px;width:52px;text-align:center">' + esc(it.emoji) + '</span><span><b>' + esc(it.name) + '</b><small>' + esc((OFF().STAT_KOR || {})[it.stat] || it.stat) + ' +' + it.bonus + '<br>' + esc(it.desc || '') + '</small><br><button class="cpg-btn" style="padding:4px 8px;min-height:30px;margin-top:4px" data-cp="buy" data-id="' + esc(it.id) + '"' + (cp.gold < p ? ' disabled' : '') + '>💰 ' + p + '</button></span></div>'; });
    return html + '</div>';
  }
  /* W-0451 지원 대화 — 출진 셋의 짝 · 단계 C·B·A · 새 단계면 「지원 대화」(처음 보면 금) · 원수는 안 오름 */
  var talkShown = null;
  function talkBox() {
    var t = talkShown; if (!t) { return ''; }
    return '<div class="cpg-brief" style="border-color:#c9a35a;margin-bottom:10px"><div style="display:flex;gap:10px;align-items:center;margin-bottom:6px"><img alt="" src="' + face(t.a, 44) + '" style="width:44px;height:44px;border-radius:8px"><b>지원 ' + esc(t.name) + '</b><img alt="" src="' + face(t.b, 44) + '" style="width:44px;height:44px;border-radius:8px">' + (t.gold ? '<span class="cpg-gold">💰 +' + t.gold + '</span>' : '') + '<button class="cpg-btn ghost" style="margin-left:auto;min-height:32px;padding:4px 10px" data-cp="talkx">닫기</button></div>' + t.lines.map(function (l) { return '<div style="margin:3px 0">' + esc(l) + '</div>'; }).join('') + '</div>';
  }
  function pairsHtml() {
    var html = '<div class="cpg-act">지원 — 판에서 나란히 싸우면 오른다(C 3 · B 7 · A 12) · 이웃 지원이면 명중·회피 보정</div><div class="cpg-grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">';
    CP().pairs().forEach(function (p) {
      var tag = p.rel === 'foe' ? '<span style="color:#ff8a6a">원수 — 오르지 않음</span>' : (p.lv ? '<b style="color:#f3d27a">' + esc(p.name) + '</b>' : '<span class="muted">없음</span>') + (p.rel === 'sworn' ? ' · 의형제' : '') + (p.next ? ' <span class="muted">(' + p.pts + '/' + p.next + ')</span>' : '');
      html += '<div class="cpg-card"><img alt="" src="' + face(p.a, 40) + '" style="width:40px;height:40px"><img alt="" src="' + face(p.b, 40) + '" style="width:40px;height:40px"><span style="flex:1"><b>' + esc(nm(p.a)) + ' · ' + esc(nm(p.b)) + '</b><small style="display:block">' + tag + '</small>' + (p.lv && p.rel !== 'foe' ? '<button class="cpg-btn' + (p.fresh ? '' : ' ghost') + '" style="padding:4px 10px;min-height:30px;margin-top:4px" data-cp="talk" data-a="' + esc(p.a) + '" data-b="' + esc(p.b) + '">' + (p.fresh ? '💬 지원 대화 (새)' : '💬 다시 보기') + '</button>' : '') + '</span></div>';
    });
    return html + '</div>';
  }
  function talkTab() {
    var html = talkBox() + '<div class="cpg-grid">', B = global.DG.data && global.DG.data.BIOS, HS = global.DG.heroSkill;
    var after = pairsHtml();
    CP().party().forEach(function (id) { var h = OFF().find(id), bio = (B && B[id]) || (h && (h.bio || h.desc || h.quote)) || '', s = HS && HS.of ? HS.of(id) : null; html += '<div class="cpg-card" style="align-items:flex-start"><img alt="" src="' + face(id, 52) + '"><span><b>' + esc(nm(id)) + '</b><small>' + esc(String(bio).slice(0, 120) || '「이번 싸움, 맡겨 주십시오.」') + (s ? '<br><span style="color:#f3d27a">✦ ' + esc(s.name) + '</span> — ' + esc(s.desc) : '') + '</small></span></div>'; });
    return html + '</div>' + after;
  }
  /* ── ③ 전투 앞 설전·일기토 — 시나리오 단계 글 + 기존 설전·일기토 창(DG.ui, #encounter 가 장 흐름 위) ── */
  function pre() {
    var cp = CP().state(), s = CP().stageOf(cp.ch), A = CP().preActors(cp.ch);
    host.innerHTML = '<div class="cpg-result" style="max-width:640px"><h3>' + (s.kind === 'duel' ? '🤺 ' : '🗣 ') + esc(s.title) + '</h3><p style="text-align:left;line-height:1.7">' + esc(CP().fillText(s.intro || '')) + '</p><p>' + esc(nm(A.me)) + (s.kind === 'duel' ? ' 대 ' + esc(nm(A.foe)) : ' 이(가) 나선다') + '</p><div class="cpg-row" style="justify-content:center"><button class="cpg-btn" data-cp="pre-go">' + (s.kind === 'duel' ? '일기토에 나선다' : '설전에 나선다') + '</button></div></div>';
  }
  function runPre() {
    var cp = CP().state(), A = CP().preActors(cp.ch), U = global.DG.ui, after = function (won) { CP().preResult(cp.ch, won); toast(won ? '이겼다 — 적의 기세가 꺾였다' : '졌다 — 그래도 싸움은 연다'); show('camp'); };
    if (A.kind === 'duel' && U && U.duelHand && A.foe) { U.duelHand(A.me, A.foe, function (res) { after(!!res && res.winner === A.me); }); }
    else if (U && U.startDebate) { U.startDebate({ title: CP().stageOf(cp.ch).title, by: A.me, must: true, done: function (mul, ok) { if (U.closeEnc) { U.closeEnc(); } after((ok || 0) >= 2); } }); }
    else { after(false); }
  }
  /* ── ⑤ 결말 · 회차 ── */
  function ending() {
    var cp = CP().state();
    host.innerHTML = '<div class="cpg-result"><h3>👑 천하 평정</h3><p>' + (cp.round ? (cp.round + 1) + '회차 ' : '') + '열아홉 장을 모두 지났다.<br>같은 장수·보물로 처음부터 — 적은 더 강해진다(회차마다 +15%).</p><div class="cpg-row" style="justify-content:center"><button class="cpg-btn ghost" data-cp="route">노선도</button><button class="cpg-btn" data-cp="round">회차 ▶ ' + ((cp.round || 0) + 2) + '회차</button></div></div>';
  }
  /* ── 전투 ── */
  function battle() {
    var cp = CP().state(), o = CP().battleOpts(cp.ch);
    host.innerHTML = '<div class="cpg-battle"><div class="tacview" id="cpg-tac"></div></div>';
    o.name = nm; o.face = function (id) { return face(id, 64); };
    global.DG.tacticsView.open(doc.getElementById('cpg-tac'), o, function (out) { result(cp.ch, out); });
  }
  function result(no, out) {
    var res = CP().reward(no, out), c = CP().chapter(no);
    var html = '<div class="cpg-result"><h3>' + (res.win ? '🏆 승리' : '💥 패배') + '</h3><p>제 ' + no + ' 장 「' + esc(c.title) + '」' + (out ? ' — ' + esc(out.name || out.kind) : '') + '</p>';
    if (res.win) { html += '<p>💰 +' + res.gold + ' · 경험 +' + res.exp + (res.item ? ' · 얻음 ' + esc(res.item.emoji + ' ' + res.item.name) : '') + (res.gear && GR() ? '<br>🎁 장비 ' + gname(res.gear) : '') + (res.recruit ? '<br>🤝 ' + esc(res.recruit) + ' 합류' : '') + '</p>'; }
    if (res.side && (res.side.chests || res.side.total)) { html += '<p>' + (res.side.chests ? '📦 보물 ' + res.side.loot + '/' + res.side.chests : '') + (res.side.total ? (res.side.chests ? ' · ' : '') + '🏘️ 마을 ' + res.side.kept + '/' + res.side.total + (res.side.kept === res.side.total && res.win ? ' (모두 지킴!)' : '') : '') + (res.sideGold ? ' — 💰 +' + res.sideGold : '') + '</p>'; }   // W-0460
    html += '<div class="cpg-row" style="justify-content:center">' + (res.win ? '<button class="cpg-btn" data-cp="route">노선도 ▶</button>' : '<button class="cpg-btn" data-cp="camp">진영에서 다시 도전</button>') + '</div></div>';
    host.innerHTML = html;
  }

  function onClick(e) {
    var b = e.target.closest('[data-cp]');
    if (!b || b.disabled) { return; }
    var a = b.getAttribute('data-cp'), cp = CP().state();
    if (a === 'ch') {
      var no = +b.getAttribute('data-no');
      if (no > cp.ch) { return; }
      cp.viewCh = no; show(no === cp.ch && !cp.cleared[no] && cp.bonus && cp.bonus.ch === no ? 'camp' : 'story');
    } else if (a === 'choose') { var rc = CP().choose(cp.ch, b.getAttribute('data-k')); if (rc && rc.epi) { if (rc.end) { ending(); } else { show('route'); } } else { tab = 'party'; show('camp'); } }
    else if (a === 'ending') { ending(); }
    else if (a === 'round') { CP().newRound(); show('route'); }
    else if (a === 'route') { show('route'); }
    else if (a === 'camp') { show('camp'); }
    else if (a === 'tab') { tab = b.getAttribute('data-t'); pick = null; show('camp'); }
    else if (a === 'pick') {
      var id = b.getAttribute('data-id'), sel = CP().party(), i = sel.indexOf(id);
      if (i >= 0) { if (sel.length > 1) { sel.splice(i, 1); } } else { if (sel.length >= 3) { sel.pop(); } sel.push(id); }
      CP().setParty(sel); show('camp');
    }
    else if (a === 'cls') { var rcl = CP().promote(b.getAttribute('data-id'), b.getAttribute('data-k')); toast(rcl.ok ? nm(b.getAttribute('data-id')) + ' — ' + rcl.cls.name + '(으)로 전직!' : rcl.why); show('camp'); }   // W-0457
    else if (a === 'merc') { CP().cycleMerc(b.getAttribute('data-id'), +b.getAttribute('data-k')); show('camp'); }
    else if (a === 'bag') { var k = b.getAttribute('data-k'); pick = pick === k ? null : k; show('camp'); }
    else if (a === 'equip') { if (pick != null) { var ps = String(pick), r = ps.indexOf('g:') === 0 ? CP().equipGear(b.getAttribute('data-id'), ps.slice(2)) : CP().equip(b.getAttribute('data-id'), cp.bag[+ps.slice(2)]); if (!r.ok) { toast(r.why); } pick = null; show('camp'); } }
    else if (a === 'ungear') { CP().unequipGear(b.getAttribute('data-id'), b.getAttribute('data-s')); show('camp'); }
    else if (a === 'buyp') { var rp = CP().buyPrep(b.getAttribute('data-id')); toast(rp.ok ? rp.item.name + ' 갖췄습니다' : rp.why); show('camp'); }
    else if (a === 'talk') { var rt = CP().talk(b.getAttribute('data-a'), b.getAttribute('data-b')); if (rt.ok) { talkShown = rt; } else { toast(rt.why); } show('camp'); }
    else if (a === 'talkx') { talkShown = null; show('camp'); }
    else if (a === 'buyg') { var rg = CP().buyGear(b.getAttribute('data-id')); toast(rg.ok ? rg.item.name + ' 샀습니다' : rg.why); show('camp'); }
    else if (a === 'unequip') { CP().unequip(b.getAttribute('data-id')); show('camp'); }
    else if (a === 'buy') { var rb = CP().buy(b.getAttribute('data-id')); toast(rb.ok ? rb.item.name + ' 샀습니다' : rb.why); show('camp'); }
    else if (a === 'go') { if (!CP().preDone(cp.ch)) { pre(); } else { CP().setStep('battle'); battle(); } }
    else if (a === 'pre-go') { runPre(); }
  }

  global.DG = global.DG || {};
  global.DG.campaignView = { on: on, open: open, close: close, show: show, _host: function () { return host; } };
})(typeof window !== 'undefined' ? window : this);
