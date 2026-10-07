/**
 * 오버월드 전체 지도 — 핵앤슬래시 M키식 토글 (PLAN 25-1절, 2026-09-02)
 * ---------------------------------------------------------------
 * 이 판은 실제 GPS 좌표가 곧 오버월드라 사가나락처럼 "다른 마을로 걸어나간다"는
 * 구조는 없다. 대신 **지금까지 밟아 본 실제 위치**(`core.save.player.trail`,
 * `world.js`의 `trackTrail`이 40m 마다 한 점씩 남긴다)를 한눈에 펼쳐 보는
 * 화면이다 — 좌하단 미니맵(`minimap.js`, 코앞만 보여줌)과는 다른, 별개의
 * 전체 화면 오버레이다.
 *
 * 여는 문 둘 — 데스크톱은 M 키, 모바일은 도구줄의 🧭 단추(`#btn-owmap`).
 *
 * `project`(값을 내는 함수)는 판정에 한 줄도 닿지 않는다 — 위경도 배열을
 * 읽기만 하고 **캔버스 없이도 돈다**(자가진단이 그것만 따로 본다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var node = null, canvas = null, ctx = null, btn = null;
  var opened = false;
  var lastDrawn = 0;   // 지난번에 찍은 점 수 (진단·데모가 들여다본다)

  function W() { return global.DG.world; }
  function MM() { return global.DG.minimap; }

  /**
   * 위경도 점들을 화면 정사각형(-1~1, 가운데가 (0,0))에 얹을 자리로 낸다.
   * `points` 는 발자취({lat,lng,kind}), `cur` 는 지금 위치({lat,lng})다.
   * 위도(lat) 스팬이 아주 좁아도(제자리걸음) 나눗셈이 터지지 않게 최소
   * 스팬(약 90m 어치)을 둔다.
   *
   * `extra`(선택, PLAN §5① 봉수대) — 봉수대·역참·성채 같은 점 표시용.
   * **범위(bounds)엔 안 넣는다** — 27개 봉수대는 나라를 가로질러 흩어져
   * 있어서, 넣으면 발자취(코앞 수백 m)가 그 거대한 스팬에 묻혀 점 하나로
   * 뭉개진다. 그래서 `extra`는 발자취·지금 위치로만 정한 같은 축척 위에
   * 얹힐 뿐이고, 화면 밖으로 나가면(±1 밖) 그린 쪽에서 지운다(진짜 지도가
   * 화면 밖 표식을 안 그리는 것과 같다).
   *
   * `fit`(선택, PLAN §5 ⑲-23) — 범위에 **넣을** 점({lat,lng}). 따라가는 임무 표식 — 지도를 열면 늘 보인다.
   * 그리지는 않는다(그것은 extra 로 따로 넘긴다).
   */
  function project(points, cur, extra, fit) {
    extra = extra || [];
    var all = points.concat([cur], fit || []);
    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    var i, p;
    for (i = 0; i < all.length; i++) {
      p = all[i];
      if (p.lat < minLat) { minLat = p.lat; }
      if (p.lat > maxLat) { maxLat = p.lat; }
      if (p.lng < minLng) { minLng = p.lng; }
      if (p.lng > maxLng) { maxLng = p.lng; }
    }
    /* 가운데(중점) 기준으로 잰다 — 점이 하나뿐이면(min===max) 화면 한가운데
       (0,0)에 놓인다. min을 기준으로 재면 그 경우 한쪽 구석(-1,-1)으로 쏠린다 */
    var midLat = (minLat + maxLat) / 2, midLng = (minLng + maxLng) / 2;
    var spanLat = Math.max(maxLat - minLat, 0.0008);
    var spanLng = Math.max(maxLng - minLng, 0.0008);

    function put(pt) {
      var nx = (pt.lng - midLng) / spanLng;      // -0.5~0.5, 동쪽일수록 큼
      var ny = (midLat - pt.lat) / spanLat;      // -0.5~0.5, 북쪽일수록 작음(위)
      return { x: nx * 2, y: ny * 2, kind: pt.kind };
    }

    return {
      trail: points.map(put),
      cur: put(cur),
      pois: extra.map(function (pt) {
        var pp = put(pt);
        pp.t = pt.t; pp.name = pt.name;
        return pp;
      }),
      span: { lat: spanLat, lng: spanLng }
    };
  }

  /* ── 화면 ─────────────────────────────────────────────── */

  function mount() {
    if (node || !global.document) { return null; }
    node = global.document.createElement('div');
    node.id = 'overworld-map';
    node.innerHTML =
      '<div class="ow-scrim"></div>' +
      '<div class="ow-panel glass">' +
      '<div class="ow-head"><h3>🧭 전체 지도</h3>' +
      '<small class="muted">지금까지 밟아 본 곳</small>' +
      '<button class="icon-btn ow-close" title="닫기 (M / Esc)">✕</button></div>' +
      '<canvas></canvas>' +
      '<div class="ow-pick"></div>' +
      '<div class="ow-way"></div>' +
      '</div>';
    global.document.body.appendChild(node);
    canvas = node.querySelector('canvas');
    node.querySelector('.ow-scrim').addEventListener('click', close);
    node.querySelector('.ow-close').addEventListener('click', close);
    canvas.addEventListener('click', tapCanvas);
    return node;
  }

  function resize() {
    if (!canvas) { return; }
    var box = canvas.getBoundingClientRect();
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(box.width * dpr));
    var h = Math.max(1, Math.round(box.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; ctx = null;
    }
    if (!ctx) { ctx = canvas.getContext('2d'); }
    return dpr;
  }

  function draw() {
    if (!opened || !canvas || !core.save) { return 0; }
    var dpr = resize();
    if (!ctx) { return 0; }
    var w = canvas.width, h = canvas.height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, cw, ch);

    var pos = core.save.player.pos;
    var wl = W();
    var cur = wl ? wl.worldToLatLng(pos.x, pos.y) : { lat: 0, lng: 0 };
    var trail = core.save.player.trail || [];

    /* 봉수대(PLAN §5①) — 27개 자리 전부(불 안 올린 건 흐리게) + 불 올린
       권역 반경의 역참·성채(48절 규칙의 예외). extra 라 범위(bounds)엔
       안 낀다 — project() 머리 참고 */
    var BC = global.DG.beacon, pois = [];
    if (BC && wl) {
      var bl = BC.list(), i2;
      for (i2 = 0; i2 < bl.length; i2++) {
        pois.push({ lat: bl[i2].lat, lng: bl[i2].lng,
          t: BC.lit(bl[i2].key) ? 'beacon-lit' : 'beacon', name: bl[i2].name });
      }
      /* 발견한 비석은 어디 있든 진하게(48절: 발견한 것만) — 봉수대 반경의 미발견은 아래 revealedAll 이 흐릿하게 */
      var STL = global.DG.stela;
      if (STL) {
        var fa = STL.foundAll();
        for (i2 = 0; i2 < fa.length; i2++) { pois.push({ lat: fa[i2].lat, lng: fa[i2].lng, t: 'stele', name: '비석' }); }
      }
      var rev = BC.revealedAll();
      for (i2 = 0; i2 < rev.length; i2++) {
        var rp = wl.worldToLatLng(rev[i2].x, rev[i2].y);
        pois.push({ lat: rp.lat, lng: rp.lng, t: rev[i2].type, name: rev[i2].name });
      }
    }

    /* 지역 랜드마크(biome.js, §5 ⑩) — 찾은 곳은 순간이동 지점(푸른 마름모), 3km 안의 못 찾은 곳은 금빛 */
    var BMo = global.DG.biome;
    if (BMo && BMo.on() && wl) {
      var lmk = BMo.landmarks(pos.x, pos.y, 3000), i3;
      for (i3 = 0; i3 < lmk.length; i3++) {
        var lp = wl.worldToLatLng(lmk[i3].x, lmk[i3].y);
        pois.push({ lat: lp.lat, lng: lp.lng, t: BMo.found(lmk[i3].key) ? 'waypoint' : 'landmark', name: lmk[i3].name });
      }
      /* 고정 특색 지역(§5 ⑮) — 땅 열여섯의 이름을 제 방위·고리 가운데쯤에(범위엔 안 낀다) */
      if (BMo.ZONES) {
        BMo.ZONES.forEach(function (z) {
          var za = z.sector * Math.PI / 4, zr = z.ring ? BMo.RING_R * 1.5 : BMo.RING_R * 0.55;
          var zp = wl.worldToLatLng(Math.cos(za) * zr, Math.sin(za) * zr);
          pois.push({ lat: zp.lat, lng: zp.lng, t: 'zone', name: z.emoji + ' ' + z.name });
        });
      }
    }

    /* 지형 설계(landform.js, §5 ⑰) — 강·산맥은 굽이점을 점선처럼, 이름은 가운데에. 정상은 점(오른 곳은 진하게) */
    var LFo = global.DG.landform;
    if (LFo && LFo.on() && wl) {
      var feat = function (list, t) {
        list.forEach(function (f) {
          var pts = f.pts, n = pts.length, q, k2;
          for (q = 0; q < n - 1; q++) {
            for (k2 = 0; k2 < 4; k2++) {
              var u = k2 / 4, fp = wl.worldToLatLng(pts[q][0] + (pts[q + 1][0] - pts[q][0]) * u, pts[q][1] + (pts[q + 1][1] - pts[q][1]) * u);
              pois.push({ lat: fp.lat, lng: fp.lng, t: t });
            }
          }
          var mid = pts[Math.floor(n / 2)], mp = wl.worldToLatLng(mid[0], mid[1]);
          pois.push({ lat: mp.lat, lng: mp.lng, t: 'feat-name', name: f.emoji + ' ' + f.name });
        });
      };
      feat(LFo.RIVERS, 'river');
      feat(LFo.RANGES, 'ridge');
      LFo.peaks(pos.x, pos.y).forEach(function (pk) {
        var pp = wl.worldToLatLng(pk.x, pk.y);
        pois.push({ lat: pp.lat, lng: pp.lng, t: LFo.peakFound(pk.key) ? 'peak-found' : 'peak', name: '⛰️ ' + pk.name });
      });
    }

    /* 서리봉 고원 명소(§5 ⑲-27) — 찾은 것만 이름 */
    var FRo = global.DG.frost;
    if (FRo && FRo.on() && FRo.marks && wl) {
      FRo.marks().forEach(function (fm) { if (!fm.found) { return; } var fp2 = wl.worldToLatLng(fm.x, fm.y); pois.push({ lat: fp2.lat, lng: fp2.lng, t: 'frost', name: (fm.big ? '🏔️ ' : '❄️ ') + fm.name }); });
    }

    /* 은하 나루 명소(§5 ⑲-37) — 찾은 것만 이름 */
    var SPo = global.DG.skyport;
    if (SPo && SPo.on() && SPo.marks && wl) {
      SPo.marks().forEach(function (sm) { if (!sm.found) { return; } var sp2 = wl.worldToLatLng(sm.x, sm.y); pois.push({ lat: sp2.lat, lng: sp2.lng, t: 'frost', name: (sm.big ? '🌌 ' : '✨ ') + sm.name }); });
    }
    /* 굳은 거리 명소(§5 ⑲-57) — 찾은 것만 이름 */
    var AMo = global.DG.amber;
    if (AMo && AMo.on() && AMo.marks && wl) {
      AMo.marks().forEach(function (am) { if (!am.found) { return; } var ap2 = wl.worldToLatLng(am.x, am.y); pois.push({ lat: ap2.lat, lng: ap2.lng, t: 'frost', name: (am.big ? '🟠 ' : '✨ ') + am.name }); });
    }
    /* 갈무리 벌 명소(§5 ⑲-61) — 찾은 것만 이름 */
    var VTo = global.DG.vault;
    if (VTo && VTo.on() && VTo.marks && wl) {
      VTo.marks().forEach(function (vm) { if (!vm.found) { return; } var vp2 = wl.worldToLatLng(vm.x, vm.y); pois.push({ lat: vp2.lat, lng: vp2.lng, t: 'frost', name: (vm.big ? '🟦 ' : '✨ ') + vm.name }); });
    }
    /* 세갈래 고을 명소(§5 ⑲-65) — 찾은 것만 이름 */
    var FKo = global.DG.fork;
    if (FKo && FKo.on() && FKo.marks && wl) {
      FKo.marks().forEach(function (fm2) { if (!fm2.found) { return; } var fp3 = wl.worldToLatLng(fm2.x, fm2.y); pois.push({ lat: fp3.lat, lng: fp3.lng, t: 'frost', name: (fm2.big ? '🟪 ' : '✨ ') + fm2.name }); });
    }
    /* 틈새 갈림길 명소(§5 ⑲-41) — 찾은 것만 이름 */
    var CRo = global.DG.crossing;
    if (CRo && CRo.on() && CRo.marks && wl) {
      CRo.marks().forEach(function (cm) { if (!cm.found) { return; } var cp2 = wl.worldToLatLng(cm.x, cm.y); pois.push({ lat: cp2.lat, lng: cp2.lng, t: 'frost', name: (cm.big ? '🌀 ' : '✨ ') + cm.name }); });
    }
    /* 잠긴 도읍 명소(§5 ⑲-44) — 찾은 것만 이름 */
    var SKo = global.DG.sunken;
    if (SKo && SKo.on() && SKo.marks && wl) {
      SKo.marks().forEach(function (km) { if (!km.found) { return; } var kp2 = wl.worldToLatLng(km.x, km.y); pois.push({ lat: kp2.lat, lng: kp2.lng, t: 'frost', name: (km.big ? '🏯 ' : '✨ ') + km.name }); });
    }

    /* 구름 위 항로 섬(§5 ⑲-48) — 찾은 것만 이름 */
    var SRo = global.DG.skyRoute;
    if (SRo && SRo.on() && wl) {
      SRo.marks().forEach(function (rm) { if (!rm.found) { return; } var rp2 = wl.worldToLatLng(rm.x, rm.y); pois.push({ lat: rp2.lat, lng: rp2.lng, t: 'frost', name: '☁️ ' + rm.name }); });
    }

    /* 낚시터(§5 ⑲-24) — 탑을 찾은 지역만 */
    var FSo = global.DG.fishing;
    if (FSo && FSo.mapSpots && wl) {
      FSo.mapSpots().forEach(function (fs) { var fp = wl.worldToLatLng(fs.x, fs.y); pois.push({ lat: fp.lat, lng: fp.lng, t: 'fish', name: '🎣 ' + fs.name }); });
    }

    var ql = questLayout();
    var pr = project(trail, cur, pois, ql.fit);
    var pad = 26;
    var side = Math.min(cw, ch) - pad * 2;
    var ox = (cw - side) / 2, oy = (ch - side) / 2;
    var mm = MM();
    var TINT = mm ? mm.TINT : {};
    var POI_STYLE = {
      beacon: { c: 'rgba(255,157,61,.45)', r: 4 },
      'beacon-lit': { c: '#ff5a1e', r: 5 },
      station: { c: '#7fd0ff', r: 2.6 },
      fort: { c: '#c9a7ff', r: 2.6 },
      shrine: { c: '#f0d878', r: 2.8 },
      stele: { c: '#d9d2c0', r: 2.4 },
      'stele-faint': { c: 'rgba(217,210,192,.28)', r: 2.2 },
      waypoint: { c: '#6fd3ff', r: 4.5 },
      fish: { c: '#6ec8ff', r: 3.2 },
      frost: { c: '#e8f4ff', r: 3.4 },
      landmark: { c: 'rgba(255,211,107,.7)', r: 4 },
      river: { c: 'rgba(90,170,235,.75)', r: 2.2 },
      ridge: { c: 'rgba(170,150,120,.7)', r: 2.6 },
      peak: { c: 'rgba(240,240,240,.45)', r: 3.2 },
      'peak-found': { c: '#ffffff', r: 3.6 }
    };

    function px(pt) { return { x: ox + (pt.x + 1) / 2 * side, y: oy + (pt.y + 1) / 2 * side }; }
    /* 화면(정사각형) 밖으로 난 점은 안 그린다 — 진짜 지도가 화면 밖 표식을 접는 것과 같다 */
    function onscreen(pt) { return pt.x >= -1 && pt.x <= 1 && pt.y >= -1 && pt.y <= 1; }

    /* 발자취 — 지형 빛깔로 점 하나씩 */
    var i, p, sp;
    ctx.globalAlpha = 0.85;
    for (i = 0; i < pr.trail.length; i++) {
      p = pr.trail[i]; sp = px(p);
      ctx.fillStyle = (TINT && TINT[p.kind]) || '#8d8674';
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* 봉수대·역참·성채 — 발자취 위, 지금 위치 아래 */
    for (i = 0; i < pr.pois.length; i++) {
      p = pr.pois[i];
      if (!onscreen(p)) { continue; }
      if (p.t === 'zone') {
        sp = px(p);
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(240,217,160,.55)';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, sp.x, sp.y);
        ctx.textAlign = 'left';
        continue;
      }
      if (p.t === 'feat-name') {
        sp = px(p);
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(200,225,255,.7)';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, sp.x, sp.y - 6);
        ctx.textAlign = 'left';
        continue;
      }
      var st = POI_STYLE[p.t];
      if (!st) { continue; }
      sp = px(p);
      ctx.fillStyle = st.c;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, st.r, 0, Math.PI * 2); ctx.fill();
      if (p.t === 'beacon-lit' || p.t === 'beacon' || p.t === 'waypoint' || p.t === 'landmark' || p.t === 'peak' || p.t === 'peak-found' || p.t === 'fish' || p.t === 'frost') {
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, sp.x, sp.y - st.r - 3);
        ctx.textAlign = 'left';
      }
    }

    /* 임무 표식(§5 ⑲-23) — 봉수대·지명 위, 지금 위치 아래. 화면 밖이면 가장자리에 흐리게 */
    var MMq = MM(), sel = selMark(ql.marks);
    lastMarks = [];
    for (i = 0; i < ql.marks.length; i++) {
      var qm = ql.marks[i], qp = px(qm);
      lastMarks.push({ sx: qp.x, sy: qp.y, m: qm });
      if (!MMq || !MMq.questIcon) { continue; }
      ctx.globalAlpha = qm.edge ? 0.6 : 1;
      if (sel === qm) {
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(qp.x, qp.y, MARK_R + 5, 0, Math.PI * 2); ctx.stroke();
      }
      MMq.questIcon(ctx, qp.x, qp.y, qm.edge ? MARK_R * 0.75 : MARK_R, qm.kind, qm.tone);
    }
    ctx.globalAlpha = 1;

    /* 지금 위치 — 금빛으로 크게 강조 */
    var cp = px(pr.cur);
    ctx.fillStyle = '#f5b445';
    ctx.beginPath(); ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, side - 1, side - 1);
    /* 지금 선 땅(§5 ⑮) — 왼쪽 위 */
    var zNow = BMo && BMo.zoneAt ? BMo.zoneAt(pos.x, pos.y) : null;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = '#f0d9a0';
    ctx.fillText(zNow ? zNow.emoji + ' ' + zNow.name + '(' + zNow.hanja + ')' : '🏡 고향 들녘', ox + 8, oy + 18);

    lastDrawn = pr.trail.length;
    return lastDrawn;
  }

  function apply() {
    if (!node) { return; }
    node.classList.toggle('show', opened);
    if (btn) { btn.classList.toggle('on', opened); }
  }

  /* ── 임무 표식 고르기 (PLAN §5 ⑲-23) ─────────────────────── */

  var MARK_R = 7, PICK_PX = 18;
  var lastMarks = [];      // 지난번에 그린 표식의 화면 자리 [{sx, sy, m}]
  var picked = null;       // 고른 표식 — { tone, id }(이야기는 id null). 표식 꼴은 따라가기로 바뀔 수 있어 이것만 쥔다

  /**
   * 임무 표식을 지도 축척(-1~1)에 얹는다 — 캔버스 없이도 돈다(진단이 이것만 본다).
   * 따라가는 것은 범위(fit)에 넣는다. 화면 밖이면 가장자리로 끌어 edge
   */
  function questLayout() {
    var STY = global.DG.story, wl = W();
    var list = STY && STY.mapMarks && wl && core.save ? STY.mapMarks() : [];
    if (!list.length) { return { marks: [], fit: [] }; }
    var pos = core.save.player.pos, cur = wl.worldToLatLng(pos.x, pos.y);
    var ext = [], fit = [], i;
    for (i = 0; i < list.length; i++) {
      var ll = wl.worldToLatLng(list[i].x, list[i].y);
      ext.push({ lat: ll.lat, lng: ll.lng });
      if (list[i].kind === 'track') { fit.push({ lat: ll.lat, lng: ll.lng }); }
    }
    var pr = project(core.save.player.trail || [], cur, ext, fit), marks = [];
    for (i = 0; i < list.length; i++) {
      var q = pr.pois[i], m = Math.max(Math.abs(q.x), Math.abs(q.y)), k = m > 1 ? 0.97 / m : 1;
      marks.push({ kind: list[i].kind, tone: list[i].tone, id: list[i].id, name: list[i].name, text: list[i].text,
        wx: list[i].x, wy: list[i].y, x: q.x * k, y: q.y * k, edge: m > 1 });
    }
    return { marks: marks, fit: fit };
  }
  function selMark(marks) {
    if (!picked) { return null; }
    for (var i = 0; i < marks.length; i++) { if (marks[i].tone === picked.tone && marks[i].id === picked.id) { return marks[i]; } }
    return null;
  }
  /** 고르기 — 표식(questLayout 의 하나) 또는 null */
  function select(m) {
    picked = m ? { tone: m.tone, id: m.id } : null;
    renderPick();
    draw();
    return !!m;
  }
  /** 캔버스를 누른 자리 — PICK_PX 안 가장 가까운 표식을 고른다(없으면 고르기를 푼다) */
  function tapCanvas(e) {
    if (!canvas) { return; }
    var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = PICK_PX;
    for (var i = 0; i < lastMarks.length; i++) {
      var d = Math.hypot(lastMarks[i].sx - x, lastMarks[i].sy - y);
      if (d <= bd) { bd = d; best = lastMarks[i].m; }
    }
    select(best);
  }

  /** 순간이동 지점 — 고향·찾은 탑(⑩)·오른 정상(⑰). [{key, x, y, name}] */
  function wayList() {
    var BMo = global.DG.biome;
    if (!BMo || !BMo.on()) { return []; }
    var list = BMo.waypoints();
    /* 오른 정상(landform.js, §5 ⑰)도 지점이다 — 정상으로 건너가 활공으로 내려온다 */
    var LFw = global.DG.landform;
    if (LFw && LFw.on() && LFw.waypoints) { list = list.concat(LFw.waypoints()); }
    /* 서리봉 고원(frost.js, §5 ⑲-27) — 찾은 경계비·관측소 */
    var FRw = global.DG.frost;
    if (FRw && FRw.on() && FRw.waypoints) { list = list.concat(FRw.waypoints()); }
    /* 은하 나루(skyport.js, §5 ⑲-37) — 찾은 나루·은하역·틈 고개 */
    var SPw = global.DG.skyport;
    if (SPw && SPw.on() && SPw.waypoints) { list = list.concat(SPw.waypoints()); }
    /* 굳은 거리(amber.js, §5 ⑲-57) — 찾은 고개 어귀·부양탑·신상 */
    var AMw = global.DG.amber;
    if (AMw && AMw.on() && AMw.waypoints) { list = list.concat(AMw.waypoints()); }
    /* 갈무리 벌(vault.js, §5 ⑲-61) — 찾은 벌 어귀·금고 앞·벌 신상 */
    var VTw = global.DG.vault;
    if (VTw && VTw.on() && VTw.waypoints) { list = list.concat(VTw.waypoints()); }
    /* 세갈래 고을(fork.js, §5 ⑲-65) — 찾은 고을 어귀·세갈래 길목·고을 신상 */
    var FKw = global.DG.fork;
    if (FKw && FKw.on() && FKw.waypoints) { list = list.concat(FKw.waypoints()); }
    /* 틈새 갈림길(crossing.js, §5 ⑲-41) — 찾은 첫 정거장·시계탑·틈 고개 */
    var CRw = global.DG.crossing;
    if (CRw && CRw.on() && CRw.waypoints) { list = list.concat(CRw.waypoints()); }
    /* 잠긴 도읍(sunken.js, §5 ⑲-44) — 찾은 연구 기지·등대 섬·해무 어귀 */
    var SKw = global.DG.sunken;
    if (SKw && SKw.on() && SKw.waypoints) { list = list.concat(SKw.waypoints()); }
    return list;
  }
  /** (x, y)에서 가장 가까운 순간이동 지점 — { key, x, y, name, d } 또는 null */
  function nearestWay(x, y) {
    var best = null, L = wayList();
    for (var i = 0; i < L.length; i++) {
      var d = Math.hypot(L[i].x - x, L[i].y - y);
      if (!best || d < best.d) { best = { key: L[i].key, x: L[i].x, y: L[i].y, name: L[i].name, d: d }; }
    }
    return best;
  }
  function geoMode() { var wl = W(); return !!wl && wl.mode !== 'keyboard'; }
  /** 순간이동 — 키보드 판만(biome·landform 이 스스로 막는다). 되면 지도를 닫고 true */
  function jump(wk) {
    var BMo = global.DG.biome, LFw = global.DG.landform;
    if (!wk || !BMo) { return false; }
    var FRj = global.DG.frost;
    var SPj = global.DG.skyport, CRj = global.DG.crossing, SKj = global.DG.sunken, AMj = global.DG.amber, VTj = global.DG.vault, FKj = global.DG.fork;
    var ok = wk.indexOf('pk:') === 0 ? !!(LFw && LFw.teleport(wk.slice(3))) : wk.indexOf('fr:') === 0 ? !!(FRj && FRj.teleport(wk.slice(3))) :
      wk.indexOf('sp:') === 0 ? !!(SPj && SPj.teleport(wk.slice(3))) : wk.indexOf('cr:') === 0 ? !!(CRj && CRj.teleport(wk.slice(3))) :
      wk.indexOf('sk:') === 0 ? !!(SKj && SKj.teleport(wk.slice(3))) : wk.indexOf('am:') === 0 ? !!(AMj && AMj.teleport(wk.slice(3))) : wk.indexOf('vt:') === 0 ? !!(VTj && VTj.teleport(wk.slice(3))) : wk.indexOf('fk:') === 0 ? !!(FKj && FKj.teleport(wk.slice(3))) : BMo.teleport(wk);
    if (ok) { close(); }
    return ok;
  }
  function fmtD(d) { return d < 1000 ? Math.round(d) + 'm' : (d / 1000).toFixed(1) + 'km'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ICON = { track: '◆', idle: '◇', avail: '!' };

  /** 고른 표식 — 거리·가장 가까운 지점·따라가기·순간이동 되나. 화면 없이도 돈다 */
  function pickInfo() {
    var m = selMark(questLayout().marks);
    if (!m) { return null; }
    var pos = core.save.player.pos, way = nearestWay(m.wx, m.wy);
    return { m: m, d: Math.hypot(m.wx - pos.x, m.wy - pos.y), way: way,
      canTrack: m.kind === 'idle', canJump: !!way && !geoMode() };
  }
  /** 고른 표식을 따라간다 — 안 따라가는 임무·이야기만(맡기 전 ! 는 막힘) */
  function trackPicked() {
    var inf = pickInfo(), STY = global.DG.story;
    if (!inf || !inf.canTrack || !STY) { return false; }
    STY.setTrack(inf.m.id);
    renderPick();
    draw();
    return true;
  }
  function jumpPicked() { var inf = pickInfo(); return !!inf && inf.canJump && jump(inf.way.key); }

  function renderPick() {
    var box = node && node.querySelector('.ow-pick');
    if (!box) { return; }
    var inf = pickInfo();
    if (!inf) {
      box.innerHTML = questLayout().marks.length ? '<small class="muted"><b class="q-story">◆</b> 따라가는 임무 · <b class="q-story">◇</b> 맡은 임무 · ' +
        '<b class="q-wq">!</b> 맡을 수 있는 임무 — 금빛 이야기 · 푸른빛 세계 임무. 표식을 누르면 고른다</small>' : '';
      return;
    }
    var m = inf.m, tb = m.kind === 'track' ? '따라가는 중' : (m.kind === 'avail' ? '맡길 사람에게 말을 걸어 맡는다' : '따라가기');
    box.innerHTML = '<div class="ow-pick-card"><b class="q-' + m.tone + '">' + ICON[m.kind] + '</b> <b>' + esc(m.name) + '</b> ' +
      '<small class="muted">' + fmtD(inf.d) + '</small><br><small>' + esc(m.text) + '</small><br>' +
      '<small class="muted">🌀 가까운 지점 — ' + (inf.way ? esc(inf.way.name) + ' (표식에서 ' + fmtD(inf.way.d) + ')' : '없음') + '</small>' +
      '<div class="ow-pick-btns"><button class="btn sm" data-pick="track"' + (inf.canTrack ? '' : ' disabled') + '>' + tb + '</button>' +
      '<button class="btn sm" data-pick="jump"' + (inf.canJump ? '' : ' disabled') + '>' + (geoMode() ? '실제 위치로 걷는 중엔 순간이동 없음' : '가까운 지점으로 순간이동') + '</button></div></div>';
    var bt = box.querySelector('[data-pick="track"]'), bj = box.querySelector('[data-pick="jump"]');
    if (bt) { bt.addEventListener('click', trackPicked); }
    if (bj) { bj.addEventListener('click', jumpPicked); }
  }

  /** 순간이동 지점 단추 — 열 때마다 다시 그린다(발견이 늘었을 수 있다) */
  function renderWay() {
    var box = node && node.querySelector('.ow-way');
    var BMo = global.DG.biome;
    if (!box) { return; }
    if (!BMo || !BMo.on()) { box.innerHTML = ''; return; }
    var pos = core.save.player.pos, list = wayList(), html = '', i;
    var geo = geoMode();
    list.forEach(function (p) { p.d = Math.hypot(p.x - pos.x, p.y - pos.y); });
    list.sort(function (a, b) { return a.d - b.d; });
    html += '<small class="muted">🌀 순간이동 지점' + (geo ? ' — 실제 위치로 걷는 중엔 쓸 수 없다' : '') + '</small><div class="ow-way-list">';
    for (i = 0; i < list.length; i++) {
      html += '<button class="btn sm" data-way="' + list[i].key + '"' + (geo ? ' disabled' : '') + '>' +
        list[i].name + ' <em>' + (list[i].d < 1000 ? Math.round(list[i].d) + 'm' : (list[i].d / 1000).toFixed(1) + 'km') + '</em></button>';
    }
    box.innerHTML = html + '</div>';
    var bs = box.querySelectorAll('[data-way]');
    for (i = 0; i < bs.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { jump(b.getAttribute('data-way')); });
      })(bs[i]);
    }
  }

  function open() {
    if (!node) { mount(); }
    opened = true;
    apply();
    renderPick();
    renderWay();
    draw();
  }
  function close() {
    opened = false;
    apply();
  }
  function toggle() {
    if (opened) { close(); } else { open(); }
  }

  function bindKeyAndButton() {
    global.addEventListener('keydown', function (e) {
      if (e.key === 'm' || e.key === 'M') {
        var tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
        toggle();
        return;
      }
      if (e.key === 'Escape' && opened) { close(); }
    });
    btn = global.document.getElementById('btn-owmap');
    if (btn) { btn.addEventListener('click', toggle); }
  }

  function init() {
    mount();
    bindKeyAndButton();
    apply();
  }

  /** 열려 있는 동안만 다시 그린다 — 미니맵처럼 매 프레임 다시 그리지 않는다 */
  function tick() {
    if (!opened) { return false; }
    draw();
    return true;
  }

  /** 진단·데모가 값으로 들여다보는 창 */
  function stats() {
    return { opened: opened, drawn: lastDrawn, trailLen: (core.save && core.save.player.trail || []).length };
  }

  global.DG = global.DG || {};
  global.DG.overworld = {
    /* 값을 내는 함수 — 순수하다 (자가진단이 이것만 따로 본다) */
    project: project, questLayout: questLayout, nearestWay: nearestWay, jump: jump, pickInfo: pickInfo,
    select: select, trackPicked: trackPicked, jumpPicked: jumpPicked,
    get picked() { return picked; },
    /* 화면 */
    init: init, tick: tick, draw: draw, open: open, close: close, toggle: toggle,
    get opened() { return opened; },
    stats: stats,
    /** 진단이 제 뒤를 치울 때 */
    reset: function () { opened = false; lastDrawn = 0; picked = null; lastMarks = []; }
  };
})(window);
