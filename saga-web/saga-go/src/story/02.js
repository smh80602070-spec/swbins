
  /* ── 자리(순수) ───────────────────────────────────────── */

  var anchorMemo = {};
  /** ⑮ 땅 zk 의 "고향에서 가장 가까운 탑" — { key, x, y }. 고향은 마을 가운데(0,0). 같은 세계면 늘 같다 */
  function anchorOf(zk) {
    if (anchorMemo[zk]) { return anchorMemo[zk]; }
    var B = BM();
    if (!B) { return null; }
    if (zk === 'home') { anchorMemo[zk] = { key: '0_0', x: 0, y: 0 }; return anchorMemo[zk]; }
    var best = null, bd = Infinity, i, j;
    for (j = -4; j <= 4; j++) {
      for (i = -4; i <= 4; i++) {
        var c = B.cellAt(i, j);
        if (!c || c.zone !== zk) { continue; }
        var d = Math.hypot(c.x, c.y);
        if (d < bd - 1e-6) { bd = d; best = c; }
      }
    }
    if (best) { anchorMemo[zk] = { key: best.key, x: best.x, y: best.y }; }
    return anchorMemo[zk] || null;
  }
  function at(zk, off) {
    var a = anchorOf(zk);
    return a ? { x: a.x + (off ? off[0] : 0), y: a.y + (off ? off[1] : 0) } : null;
  }
  function followIdx() { var L = CHAPTERS[3].steps; for (var i = 0; i < L.length; i++) { if (L[i].type === 'follow') { return i; } } return -1; }
  /** 나그네 자리 — 4장 단계 si 기준: 따라가기 앞이면 다리목, 따라가는 중이면 걷는 자리, 지나면 길 끝 */
  function wandererAt(si) {
    var fi = followIdx();
    if (si === fi && fol) { return { x: fol.x, y: fol.y }; }
    return at('home', si > fi ? WANDER_PATH[WANDER_PATH.length - 1] : WANDER_PATH[0]);
  }
  var peakMemo = null;
  /** ⑲-14 봉우리 — ⑰ 정상 가운데 고향 북쪽(y<0)에서 가장 가까운 것(없으면 가장 가까운 것). 같은 세계면 늘 같다 */
  function peakSpot() {
    if (peakMemo) { return peakMemo; }
    var LF = global.DG.landform, L = LF && LF.on && LF.on() && LF.peaks ? LF.peaks(0, 0) : [], i;
    for (i = 0; i < L.length && !peakMemo; i++) { if (L[i].y < 0) { peakMemo = L[i]; } }
    if (!peakMemo && L.length) { peakMemo = L[0]; }
    return peakMemo;
  }
  /** ⑲-16 뭍인가 — 지형 칸이 물이 아니고 강(여울 빼고) 위가 아니다. 지형을 모르면 뭍 */
  function landAt(x, y) {
    var W = global.DG.world, LF = global.DG.landform, k = null;
    if (W && W.terrainAt) { try { k = W.terrainAt(Math.floor(x / TERR_TILE), Math.floor(y / TERR_TILE)); } catch (e) { k = null; } }
    if (k === 'water') { return false; }
    var rv = LF && LF.on && LF.on() && LF.riverAt ? LF.riverAt(x, y) : null;
    return !(rv && !rv.ford);
  }
  /** (x,y) 둘레 r m 에 n 자리(북쪽부터 시계 방향, +y 가 남쪽) */
  function ringAt(x, y, r, n) {
    var out = [];
    for (var i = 0; i < n; i++) { var a = i * Math.PI * 2 / n; out.push({ x: x + Math.sin(a) * r, y: y - Math.cos(a) * r }); }
    return out;
  }
  function allLand(L) { for (var i = 0; i < L.length; i++) { if (!landAt(L[i].x, L[i].y)) { return false; } } return true; }
  var capeMemo = null;
  /** ⑲-16 곶 — 넷째 제단 자리. 같은 세계면 늘 같다 */
  function capeSpot() {
    if (capeMemo) { return capeMemo; }
    var a = anchorOf(CAPE_ZONE), fm = at(NPCS.ferryman.zone, NPCS.ferryman.off), first = null, best = null, i, k;
    if (!a) { return null; }
    for (i = 0; i < CAPE_RADII.length && !best; i++) {
      for (k = 0; k < 8 && !best; k++) {
        var q = ringAt(a.x, a.y, CAPE_RADII[i], 8)[k];
        if (fm && Math.hypot(q.x - fm.x, q.y - fm.y) <= CAPE_CLEAR) { continue; }
        if (!landAt(q.x, q.y) || !allLand(ringAt(q.x, q.y, DEFEND_RING, DEFEND_SLOTS))) { continue; }
        if (!first) { first = q; }
        if (!allLand(ringAt(q.x, q.y, CAPE_SHORE, 8))) { best = q; }       // 둘레에 물 — 곶답다
      }
    }
    capeMemo = best || first || { x: a.x, y: a.y - CAPE_RADII[0] };
    return capeMemo;
  }
  var isleMemo = null;
  function terrAt(tx, ty) { var W = global.DG.world; try { return W && W.terrainAt ? W.terrainAt(tx, ty) : null; } catch (e) { return null; } }
  /** ⑲-19 칸 (tx,ty) 이웃 여덟 중 물 칸 수 */
  function wetNeighbors(tx, ty) {
    var n = 0;
    for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { if ((dx || dy) && terrAt(tx + dx, ty + dy) === 'water') { n++; } } }
    return n;
  }
  /** ⑲-19 바위섬 — 곶 둘레 ISLE_R 칸 안 뭍 칸 가운데 이웃 물이 가장 많은 것(같으면 곶에 가까운 것)의 가운데. 같은 세계면 늘 같다 */
  function isleSpot() {
    if (isleMemo) { return isleMemo; }
    var c = capeSpot();
    if (!c) { return null; }
    var cx = Math.floor(c.x / TERR_TILE), cy = Math.floor(c.y / TERR_TILE), best = null, tx, ty;
    for (ty = cy - ISLE_R; ty <= cy + ISLE_R; ty++) {
      for (tx = cx - ISLE_R; tx <= cx + ISLE_R; tx++) {
        var k = terrAt(tx, ty);
        if (k === 'water' || k === null) { continue; }
        var q = { x: (tx + 0.5) * TERR_TILE, y: (ty + 0.5) * TERR_TILE, wet: wetNeighbors(tx, ty) };
        q.d = Math.hypot(q.x - c.x, q.y - c.y);
        if (!landAt(q.x, q.y)) { continue; }
        if (!best || q.wet > best.wet || (q.wet === best.wet && q.d < best.d - 1e-6)) { best = q; }
      }
    }
    isleMemo = best ? { x: best.x, y: best.y, wet: best.wet } : { x: c.x, y: c.y, wet: 0 };
    return isleMemo;
  }
  /** 이름 붙은 자리 + off */
  function spotPos(name, off) {
    var SPam = SPOTS[name];
    if (SPam && SPam.am) {                                      // ⑲-58 굳은 거리 명소·굳은 자리
      var AMq = global.DG.amber, ap = AMq && AMq.on() ? AMq.spot(SPam.am) : null;
      return ap ? { x: ap.x + (off ? off[0] : 0), y: ap.y + (off ? off[1] : 0) } : null;
    }
    if (SPam && SPam.fk) {                                      // ⑲-65 세갈래 고을 명소·이야기 자리
      var FKq = global.DG.fork, fp = FKq && FKq.on() ? FKq.spot(SPam.fk) : null;
      return fp ? { x: fp.x + (off ? off[0] : 0), y: fp.y + (off ? off[1] : 0) } : null;
    }
    if (SPam && SPam.vt) {                                      // ⑲-61 갈무리 벌 명소·금고 안 자리
      var VTq = global.DG.vault, vp = VTq && VTq.on() ? VTq.spot(SPam.vt) : null;
      return vp ? { x: vp.x + (off ? off[0] : 0), y: vp.y + (off ? off[1] : 0) } : null;
    }
    if (name === 'eye') {                                       // ⑲-55 먹구름 눈 가운데
      var SEq = global.DG.stormEye, ee = SEq ? SEq.spot('eye') : null;
      return ee ? { x: ee.x + (off ? off[0] : 0), y: ee.y + (off ? off[1] : 0) } : null;
    }
    var SKI = global.DG.skyIsle;
    var ES = global.DG.eraSites;
    var sp = SPOTS[name], b = !sp ? null : sp.era ? (ES ? ES.spot(sp.era) : null) : (sp.frost ? frostSpot(sp.frost) : (sp.peak ? peakSpot() : (sp.cape ? capeSpot() : (sp.isle ? isleSpot() :
      (sp.sky ? (SKI ? SKI.spot() : null) : (sp.skyport || sp.port ? portPos(sp) : (sp.crossing || sp.cr ? crossPos(sp) : (sp.sunken || sp.sk ? sunkPos(sp) : (sp.sr ? srPos(sp) : at(sp.zone, sp.off))))))))));
    return b ? { x: b.x + (off ? off[0] : 0), y: b.y + (off ? off[1] : 0) } : null;
  }
  /** ⑲-38 은하 나루 자리 — 명소(skyport: id) 또는 나루 틀 자리(port: 'ara' 등). 나루가 꺼져 있으면 null */
  /** ⑲-42 틈새 갈림길 자리 — 명소(crossing: id) 또는 이야기 자리(cr: 'arrive' 등). 갈림길이 꺼져 있으면 null */
  /** ⑲-45 잠긴 도읍 자리 — 명소(sunken: id) 또는 이야기 자리(sk: 'sand' 등). 도읍이 꺼져 있으면 null */
  /** ⑲-49 구름 위 항로 자리 — 섬 자리는 순수(등대만 있으면 늘). 보이고 밟히는 것만 23장 등롱 뒤(skyRoute.on) */
  function srPos(sp) {
    var SRm = global.DG.skyRoute;
    return SRm && SRm.spot ? SRm.spot(sp.sr) : null;
  }
  function sunkPos(sp) {
    var SKm = global.DG.sunken;
    if (!SKm || !SKm.on()) { return null; }
    return sp.sk ? SKm.spot(sp.sk) : SKm.siteById(sp.sunken);
  }
  function crossPos(sp) {
    var CRm = global.DG.crossing;
    if (!CRm || !CRm.on()) { return null; }
    return sp.cr ? CRm.spot(sp.cr) : CRm.siteById(sp.crossing);
  }
  function portPos(sp) {
    var SPm = global.DG.skyport;
    if (!SPm || !SPm.on()) { return null; }
    return sp.port ? SPm.portSpot(sp.port) : SPm.siteById(sp.skyport);
  }
  /** ⑲-28 서리봉 고원 자리 — 'center'(가운데 탑) 또는 frost 명소 id. 고원이 꺼져 있으면 null */
  function frostSpot(id) {
    var FR = global.DG.frost;
    if (!FR || !FR.on()) { return null; }
    return id === 'center' ? FR.center() : FR.siteById(id);
  }
  /** 인물의 제자리 — 이름 붙은 자리(spot, ⑲-28) 또는 ⑮ 땅 탑 + off */
  function homeOf(n) { return n.spot ? spotPos(n.spot, n.off) : at(n.zone, n.off); }
  /** 단계의 자리 — 이름 붙은 자리(spot) 또는 ⑮ 땅 탑 + off */
  function posOf(st) { return st.spot ? spotPos(st.spot, st.off) : at(st.zone, st.off); }
  /** 인물 k 의 (ch, si) 칸 — appear·at 에서 그 장 그 단계를 덮는 것. ⑲-21 wq 칸은 그 세계 임무 단계(wq 를 주면 si, 아니면 지금) */
  function placeOf(k, ch, si, wq) {
    var n = NPCS[k], L = n ? (n.appear || n.at || []) : [];
    for (var i = 0; i < L.length; i++) {
      var e = L[i];
      if (e.wq) {
        var ws = wq === e.wq ? si : wqStepOf(e.wq);
        if (ws !== null && ws >= e.from && ws <= e.to) { return e; }
      } else if ((e.chTo ? ch >= e.ch && ch <= e.chTo : e.ch === ch) && si >= e.from && si <= e.to) { return e; }   // ⑲-42 chTo
    }
    return null;
  }
  /** 인물 k 의 지금(또는 그 장 그 단계) 이름·혼잣말·가면·층 — 칸이 덮으면 그것(⑲-20 가면 벗은 해솔) */
  function npcInfo(k, ch, si, wq) {
    var n = NPCS[k];
    if (typeof ch !== 'number') { ch = sv().ch; si = sv().step; }
    var pl = n ? placeOf(k, ch, si, wq) : null;
    return n ? { name: (pl && pl.name) || n.name, idle: (pl && pl.idle) || n.idle, mask: pl && pl.mask !== undefined ? pl.mask : (n.mask || false),
      sky: !!(pl && pl.sky) } : null;
  }
  /** 단계가 구름섬 층인가 — 단계 칸 sky 또는 대화 상대가 섬 위(⑲-20) */
  function skyOf(st) {
    if (!st) { return false; }
    if (st.sky) { return true; }
    if (!isTalk(st)) { return false; }
    var sa = stepAt(st), inf = npcInfo(st.npc, sa.c, sa.i, sa.wq);
    return !!(inf && inf.sky);
  }
  /** 인물 k 가 지금 서 있나 — appear 가 없으면 늘 */
  function visible(k) {
    var n = NPCS[k], s = sv();
    if (!n) { return false; }
    if (!n.appear) { return true; }
    var pl = placeOf(k, s.ch, s.step);
    return !!pl && (!!pl.wq || !!pl.chTo || !locked());          // ⑲-43 chTo(끝난 뒤 계속 설 자리)는 다음 장이 잠겨도 선다
  }
  /** 인물 자리 — (ch, si)를 주면 그 장 그 단계 기준(목표 계산용), 안 주면 지금 기준 */
  function npcPos(k, ch, si, wq) {
    var n = NPCS[k];
    if (!n) { return null; }
    if (typeof ch !== 'number') { ch = sv().ch; si = sv().step; }
    if (k === 'wanderer' && ch === 3) { return wandererAt(si); }
    if (n.runPath) { return thiefAt(k); }                           // ⑲-19·21 달리는 자리
    var fst = !wq && CHAPTERS[ch] ? CHAPTERS[ch].steps[si] : null;  // ⑲-28 길(path) 따라가기 — 걷는 자리, 아니면 길 첫 점
    if (fst && fst.type === 'follow' && fst.npc === k && fst.path) {
      if (fol && fol.key === 'sq:' + ch + '_' + si) { return { x: fol.x, y: fol.y }; }
      var fp = followPts(fst);
      return fp ? fp[0] : null;
    }
    var pl = placeOf(k, ch, si, wq);
    return pl && pl.spot ? spotPos(pl.spot, pl.off) : homeOf(n);
  }
  function altarPos() {
    var DM = global.DG.domain, L = DM && DM.list ? DM.list() : [];
    for (var i = 0; i < L.length; i++) { if (L[i].kind === 'weekly') { return { x: L[i].x, y: L[i].y, id: L[i].id }; } }
    return null;
  }
  function cellOf(zk) {
    var a = anchorOf(zk), B = BM();
    return a && B ? B.cellAt.apply(null, a.key.split('_').map(Number)) : null;
  }
  /** 단계가 몇째 장 몇째 단계인가 — { c, i } · ⑲-21 세계 임무 단계면 { c: -1, i, wq } */
  function stepAt(st) {
    for (var c = 0; c < CHAPTERS.length; c++) { var i = CHAPTERS[c].steps.indexOf(st); if (i >= 0) { return { c: c, i: i }; } }
    if (WQD) { for (var q in WQD.QUESTS) { var j = WQD.QUESTS[q].steps.indexOf(st); if (j >= 0) { return { c: -1, i: j, wq: q }; } } }
    return { c: -1, i: -1 };
  }
  /* gather·cook 목표는 둘레를 훑어야 해 칸(10m)·센 수가 같으면 다시 쓴다 */
  var aimMemo = { k: '', v: null };
  function gatherAim(st) {
    var p = pos(), C = CK(), mk = 'g' + st.item + ':' + Math.round(p.x / 10) + ',' + Math.round(p.y / 10) + ':' + (prog.n || 0);
    if (aimMemo.k === mk) { return aimMemo.v; }
    var best = null, bd = Infinity, L = C && C.near ? C.near(p.x, p.y, GATHER_R) : [], i;
    for (i = 0; i < L.length; i++) {
      if (L[i].item !== st.item || !C.available(L[i])) { continue; }
      var d = Math.hypot(L[i].x - p.x, L[i].y - p.y);
      if (d < bd) { bd = d; best = L[i]; }
    }
    aimMemo = { k: mk, v: best ? { x: best.x, y: best.y } : at('home', [0, 0]) };
    return aimMemo.v;
  }
  function potAim() {
    var p = pos(), C = CK(), mk = 'p:' + Math.round(p.x / 10) + ',' + Math.round(p.y / 10);
    if (aimMemo.k === mk) { return aimMemo.v; }
    var L = C && C.potsNear ? C.potsNear(p.x, p.y, POT_R) : [];
    aimMemo = { k: mk, v: L.length ? { x: L[0].x, y: L[0].y } : at('home', [0, 0]) };
    return aimMemo.v;
  }
  /** 대화로 끝나는 단계 — talk · sail(⑲-19, 대화 뒤 배) */
  function isTalk(st) { return !!st && (st.type === 'talk' || st.type === 'sail'); }
  /** 단계의 목표 자리 — { x, y, r?, label }. 세계 표·세이브만 읽는다 */
  function targetOf(st) {
    if (!st) { return null; }
    if (isTalk(st) || st.type === 'follow' || st.type === 'chase') {
      var sa = stepAt(st), p = npcPos(st.npc, sa.c, sa.i, sa.wq);
      return p ? { x: p.x, y: p.y, r: isTalk(st) ? TALK_R() : 0, label: isTalk(st) ? npcInfo(st.npc, sa.c, sa.i, sa.wq).name : st.text } : null;
    }
    if (st.type === 'sky' && st.draft) {                     // ⑲-50 구름 위 항로 — 키보드 판은 열린 바람 기둥(draft id), GPS 판·닫혔으면 건널 섬(spot)
      var SKd = global.DG.skyIsle, dq = SKd && SKd.layerOn() ? SKd.drafts().filter(function (x) { return x.id === st.draft; })[0] : null;
      if (dq) { return { x: dq.x, y: dq.y, r: dq.r, label: st.text }; }
      var sq = posOf(st);
      return sq ? { x: sq.x, y: sq.y, r: CLIMB_R(), label: st.text } : null;
    }
    if (st.type === 'sky' && st.pad) {                       // ⑲-35 시간 기둥(era-sites)
      var ESt = global.DG.eraSites, dg = ESt ? ESt.spot('draft') : null;
      return dg ? { x: dg.x, y: dg.y, r: ESt.DRAFT_R, label: st.text } : null;
    }
    if (st.type === 'sky') {                                 // ⑲-20 바람 기둥 = 봉우리 정상
      var SKt = global.DG.skyIsle, pk = SKt ? SKt.peak() : null;
      return pk ? { x: pk.x, y: pk.y, r: SKt.DRAFT_R, label: st.text } : null;
    }
    if (st.type === 'party') {                               // ⑲-55 편성 시험 — 표식은 촌장 앞(어디서든 되는 단계)
      var pe = npcPos('elder');
      return pe ? { x: pe.x, y: pe.y, r: 0, label: st.text } : null;
    }
    if (st.type === 'go' || st.type === 'climb') {
      var g = st.altar ? altarPos() : posOf(st);
      return g ? { x: g.x, y: g.y, r: st.type === 'climb' ? CLIMB_R() : (st.r && !gps() ? st.r : GO_R()), label: st.text } : null;   // ⑲-64 go 에 r(키보드 판)
    }
    if (st.type === 'boss') {
      var F = FC(), gd = F ? F.guardianAt(cellOf(st.zone)) : null;
      return gd ? { x: gd.x, y: gd.y, r: 0, label: st.text, rk: gd.region } : null;
    }
    if (st.type === 'domain') {
      var DM = global.DG.domain, al = st.did ? (DM && DM.byId ? DM.byId(st.did) : null) : altarPos();
      return al ? { x: al.x, y: al.y, r: 0, label: st.text } : null;
    }
    if (st.type === 'gather') { var ga = gatherAim(st); return ga ? { x: ga.x, y: ga.y, r: 0, label: st.text } : null; }
    if (st.type === 'cook') { var pa = potAim(); return pa ? { x: pa.x, y: pa.y, r: 0, label: st.text } : null; }
    var q = posOf(st);                                       // kill · light · seal · duel · defend
    return q ? { x: q.x, y: q.y, r: st.type === 'light' ? LIGHT_R() : (st.type === 'seal' ? SEAL_R : (st.type === 'defend' ? DEFEND_START() : 0)), label: st.text } : null;
  }
  /** ⑲-14 석등 셋의 자리 — [{k, x, y}], 북쪽부터 시계 방향 SEAL_LAYOUT(+y 가 남쪽) */
  function sealLamps(st) {
    var c = posOf(st);
    if (!c) { return []; }
    return SEAL_LAYOUT.map(function (k, i) { var a = i * Math.PI * 2 / 3; return { k: k, x: c.x + Math.sin(a) * SEAL_R, y: c.y - Math.cos(a) * SEAL_R }; });
  }
  /**
   * 석등 차례 판정(순수) — 켠 수 n, 이번에 닿은 석등 키들, 차례 → 새 n.
   * 다음 차례가 닿으면 그것 하나만 켜진다(해방이 셋에 다 닿아도). 다음 차례가 아닌 꺼진 것만 닿으면 다 꺼진다(0). 켜진 것만 닿으면 그대로
   */
  function sealHit(n, hits, order) {
    order = order || SEAL_ORDER;
    if (n >= order.length || !hits || !hits.length) { return n; }
    if (hits.indexOf(order[n]) >= 0) { return n + 1; }
    var lit = order.slice(0, n);
    for (var i = 0; i < hits.length; i++) { if (lit.indexOf(hits[i]) < 0) { return 0; } }
    return n;
  }

  /* ── 세이브 ───────────────────────────────────────────── */

  function sv() {
    var s = core().save;
    if (!s.story || typeof s.story !== 'object') { s.story = { ch: 0, step: 0 }; }
    if (typeof s.story.ch !== 'number') { s.story.ch = 0; }
    if (typeof s.story.step !== 'number') { s.story.step = 0; }
    return s.story;
  }
  function chapter() { var c = sv().ch; return c < CHAPTERS.length ? CHAPTERS[c] : null; }
  function locked() { var ch = chapter(); return !!ch && (core().save.player.level || 1) < ch.ar; }
  /** 이야기의 지금 단계 — 다 끝났거나 장이 잠겼으면 null */
  function storyStep() { var ch = chapter(); return ch && !locked() ? ch.steps[sv().step] || null : null; }
  /** 지금 단계 — **따라가는 줄**의 것(⑲-21 세계 임무를 따라가면 그 임무, 아니면 이야기) */
  function step() { var tq = tracking(); return tq ? wqDef(tq).steps[wqs().steps[tq]] || null : storyStep(); }
  function done() { return sv().ch >= CHAPTERS.length; }
  function pos() { return core().save.player.pos; }
  function keyOf() { var tq = tracking(); return tq ? 'wq:' + tq + '_' + wqs().steps[tq] : 'sq:' + sv().ch + '_' + sv().step; }

  /* ── 세계 임무(⑲-21) — 표는 worldquest.js ──────────────── */

  function wqs() {
    var s = core().save;
    if (!s.wq || typeof s.wq !== 'object') { s.wq = { steps: {}, done: [], track: null }; }
    if (!s.wq.steps || typeof s.wq.steps !== 'object') { s.wq.steps = {}; }
    if (!Array.isArray(s.wq.done)) { s.wq.done = []; }
    if (s.wq.track === undefined) { s.wq.track = null; }
    return s.wq;
  }
  function wqDef(id) { return (WQD && WQD.QUESTS[id]) || null; }
  function wqStepOf(id) { var w = wqs(); return typeof w.steps[id] === 'number' ? w.steps[id] : null; }
  /** 따라가는 세계 임무 id — 없으면(이야기를 따라간다) null */
  function tracking() { var w = wqs(), id = w.track; return id && wqDef(id) && typeof w.steps[id] === 'number' ? id : null; }
  /** 맡을 수 있나 — 안 맡았고·안 끝났고·여정 등급이 닿는다 */
  function wqAvail(id) {
    var q = wqDef(id), w = wqs();
    return !!q && w.done.indexOf(id) < 0 && typeof w.steps[id] !== 'number' && (core().save.player.level || 1) >= q.ar;
  }
  /** 따라가는 줄의 임무 적·제단 물결을 치운다(바꾸면 그 단계 처음부터) */
  function dropLine() { var k = keyOf(); dropCamp(k); dropCamp(k + ':add'); for (var n = 0; n < 3; n++) { dropCamp(k + ':w' + n); } }
  /** 따라갈 줄 — 맡은 세계 임무 id 또는 null(이야기). 바뀌면 true */
  function setTrack(id) {
    var w = wqs();
    id = id && wqDef(id) && typeof w.steps[id] === 'number' ? id : null;
    if ((w.track || null) === id) { return false; }
    dropLine();
    w.track = id;
    resetStep();
    toast(id ? '🔷 따라가는 임무 — ' + wqDef(id).name : '📖 이야기 임무를 따라간다');
    core().emit('story:step', { track: id });
    core().emit('changed');
    core().persist();
    return true;
  }
  /** 맡기 — 첫 단계부터, 곧 따라가는 임무가 된다 */
  function wqStart(id) {
    if (!wqAvail(id)) { return false; }
    wqs().steps[id] = 0;
    toast('🔷 세계 임무 — ' + wqDef(id).name + ' 을 맡았다');
    core().log('🔷 세계 임무 — ' + wqDef(id).name, 'good');
    if (!setTrack(id)) { core().persist(); }
    return true;
  }
  /** 세계 임무 한 단계 — 단계마다 부대 경험 STEP_EXP, 끝나면 보상·이야기로 돌아간다 */
  function wqAdvance(id) {
    var w = wqs(), q = wqDef(id), H = global.DG.hero;
    if (H && H.awardParty) { H.awardParty(WQD.STEP_EXP); }
    w.steps[id] += 1;
    resetStep();
    if (w.steps[id] >= q.steps.length) {
      var txt = award(q.reward);
      delete w.steps[id];
      if (w.done.indexOf(id) < 0) { w.done.push(id); }
      w.track = null;
      toast('🔷 ' + q.name + ' 끝 — ' + txt);
      core().log('🔷 ' + q.name + ' 끝 — ' + txt, 'good');
      sfx('reward');
    } else {
      toast('🔷 ' + q.steps[w.steps[id]].text);
    }
    core().emit('story:step', { wq: id, step: w.steps[id] === undefined ? -1 : w.steps[id] });
    core().emit('changed');
    core().persist();
    return true;
  }
  /** 머리 위 푸른 ! — 맡을 수 있는 임무의 맡길 사람 · 맡았지만 안 따라가는 임무의 다음 대화 상대. [{k, x, y, id, fresh}] */
  function wqMarks() {
    var out = [], w = wqs(), tq = tracking();
    if (!WQD) { return out; }
    WQD.ORDER.forEach(function (id) {
      var q = wqDef(id), st = null, fresh = wqAvail(id);
      if (fresh) { st = q.steps[0]; } else if (typeof w.steps[id] === 'number' && id !== tq) { st = q.steps[w.steps[id]]; }
      if (!isTalk(st) || !visible(st.npc)) { return; }
      var sa = stepAt(st), np = npcPos(st.npc, sa.c, sa.i, sa.wq);
      if (np) { out.push({ k: st.npc, x: np.x, y: np.y, id: id, fresh: fresh }); }
    });
    return out;
  }
  /** ⑲-23 탑을 찾은 지역인가 — 빈 마름모·! 는 찾은 지역에만(고향은 늘 찾음) */
  function revealed(x, y) { var B = BM(); return !B || B.found(B.regionAt(x, y).cell.key); }
  /**
   * ⑲-23 지도 임무 표식 — [{ kind, tone, id, x, y, name, text }]. 세이브·표만 읽는다.
   * kind 'track' 따라가는 임무(찬 마름모) · 'idle' 맡았지만 안 따라가는 임무(빈 마름모, 그 단계 자리) · 'avail' 맡을 수 있는 세계 임무(!)
   * tone 'story'(금빛) · 'wq'(푸른빛). id = 세계 임무 id, 이야기는 null. 따라가는 것 말고는 못 찾은 지역에 안 낸다
   */
  function mapMarks() {
    var out = [];
    if (!on()) { return out; }
    var tq = tracking(), w = wqs();
    function put(kind, tone, id, st, name) {
      var t = st ? targetOf(st) : null;
      if (!t || (kind !== 'track' && !revealed(t.x, t.y))) { return; }
      out.push({ kind: kind, tone: tone, id: id, x: t.x, y: t.y, name: name, text: st.text });
    }
    var ss = storyStep();
    if (ss) { put(tq ? 'idle' : 'track', 'story', null, ss, chapter().name); }
    if (WQD) {
      WQD.ORDER.forEach(function (id) {
        var q = wqDef(id);
        if (typeof w.steps[id] === 'number') { put(id === tq ? 'track' : 'idle', 'wq', id, q.steps[w.steps[id]], q.name); }
        else if (wqAvail(id)) { put('avail', 'wq', id, q.steps[0], q.name); }
      });
    }
    return out;
  }

  /* ── 나아가기 ─────────────────────────────────────────── */

  function toast(msg) { core().emit('toast', msg); }
  function sfx(n) { if (global.DG.audio) { try { global.DG.audio.play(n); } catch (e) { /* 소리는 없어도 된다 */ } } }
  function award(r) {
    var c = core(), TL = global.DG.talent, H = global.DG.hero, out = [];
    if (r.gold) { c.save.player.gold = (c.save.player.gold || 0) + r.gold; out.push('🪙 ' + r.gold); }
    if (TL && TL.mats) {
      var m = TL.mats();
      ['knot', 'guide', 'secret'].forEach(function (k) { if (r[k]) { m[k] = (m[k] || 0) + r[k]; out.push(TL.MATS[k].icon + ' ' + TL.MATS[k].name + ' ' + r[k]); } });
    }
    if (r.party && H && H.awardParty) { H.awardParty(r.party); out.push('부대 경험 ' + r.party); }
    return out.join(' · ');
  }
  /** 단계마다 저장 안 하는 것(센 수·따라가기·석등·보스·제단·쫓기)을 비운다 */
  function resetStep() { prog = { key: '', n: 0 }; fol = null; seal = { key: '', n: 0 }; duel = null; def = null; chase = null; }
  /** 지금 단계를 끝낸다 — 장 끝이면 보상과 함께 다음 장으로. ⑲-21 세계 임무를 따라가면 그 임무가 나아간다 */
  function advance() {
    var tq = tracking();
    if (tq) { return wqAdvance(tq); }
    var s = sv(), ch = chapter(), H = global.DG.hero;
    if (!ch) { return false; }
    if (H && H.awardParty) { H.awardParty(STEP_EXP); }
    s.step += 1;
    resetStep();
    if (s.step >= ch.steps.length) {
      var txt = award(ch.reward);
      s.ch += 1; s.step = 0;
      toast('📖 ' + ch.name + ' 끝 — ' + txt);
      core().log('📖 ' + ch.name + ' 끝 — ' + txt, 'good');
      sfx('reward');
      if (ch.join) { join(ch.join, false); }                          // ⑲-15 이야기 동료
    } else {
      var nx = ch.steps[s.step];
      toast('📖 ' + nx.text);
    }
    core().emit('story:step', { ch: s.ch, step: s.step });
    core().emit('changed');
    core().persist();
    return true;
  }

  /* ── 이야기 동료(⑲-15) ────────────────────────────────── */

  function hasMember(id) { var d = core().save.dex; return !!(d && d.heroes && d.heroes[id]); }
  /**
   * 동료가 된다 — 도감 기록·성장 기록, 동행에 빈자리가 있으면 채운다. 이미 있으면 아무것도 안 한다.
   * quiet 면 알림 없이(이 기능 전에 그 장을 끝낸 세이브) — 기록 한 줄만
   */
  function join(id, quiet) {
    var c = core(), m = MEMBERS[id];
    if (!m || hasMember(id)) { return false; }
    if (!c.save.dex) { c.save.dex = { heroes: {}, pets: {} }; }
    if (!c.save.dex.heroes) { c.save.dex.heroes = {}; }
    c.save.dex.heroes[id] = { count: 1, firstAt: Date.now() };
    if (global.DG.hero && global.DG.hero.ensure) { global.DG.hero.ensure(id); }
    if (!Array.isArray(c.save.party)) { c.save.party = []; }
    var FM = global.DG.formation, room = c.save.party.length < (FM ? FM.MAX : 5);
    if (room) { c.save.party.push(id); }
    var msg = '🤝 ' + m.name + ' — 이야기 동료가 됐다' + (room ? ' · 동행에 들어왔다' : ' · 동행이 꽉 찼다 — 도감 탭에서 편성');
    c.log(msg, 'good');
    if (!quiet) { toast(msg); }                                     // dex:new 는 안 쏜다 — '도감 신규 등록' 알림이 뜨면 도감 인물로 읽힌다
    c.emit('changed');
    return true;
  }
  /** 지난 장의 동료가 빠졌으면 조용히 들인다(두 번 불러도 한 명) */
  function catchUp() {
    var s = sv(), n = 0;
    for (var c = 0; c < Math.min(s.ch, CHAPTERS.length); c++) {
      if (CHAPTERS[c].join && join(CHAPTERS[c].join, true)) { n++; }
    }
    if (n) { core().persist(); }
    return n;
  }

