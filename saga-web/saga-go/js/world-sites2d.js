/**
 * 1만리 2D 지도 — 성채·역참 한 채 그리기. world.js 에서 떼어 냄(R-4 10-24). 몸통은 글자 그대로.
 * ---------------------------------------------------------------
 * 바깥 것은 make(U) 로 받는다 — U.ctx()·geom()(캔버스가 바뀔 수 있어 부를 때마다 받는다)·project·label·bodyK·ENCOUNTER_RANGE.
 * world.js 가 처음 그릴 때 make 한다(싣는 순서 무관).
 */
(function (global) {
  'use strict';

  global.DG = global.DG || {};
  global.DG.worldSites2d = { make: function (U) {
  var core = global.DG.core, project = U.project, label = U.label, bodyK = U.bodyK, ENCOUNTER_RANGE = U.ENCOUNTER_RANGE;
  /**
   * 성채 한 채. 지키는 세력의 색으로 깃발이 선다 —
   * 내 것이 되면 그 색이 금빛으로 바뀐다(원작에서 체육관이 우리 팀 색으로 도는 그 신호).
   */
  function drawFort(ft, u, v, now, pos) {
    var ctx = U.ctx(), geom = U.geom();
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -110 || p.y > geom.H + 110) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var near = Math.hypot(ft.x - pos.x, ft.y - pos.y) <= ENCOUNTER_RANGE;
    var F = global.DG.fort;
    var info = F ? F.infoOf(ft) : null;
    var mine = info && info.mine;
    var color = mine ? '#e8c15a' : (info ? info.faction.color : '#8a8f9a');

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 22 * z, 9 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = (near ? 3.2 : 2) * z;
    ctx.stroke();
    if (near) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 30 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.24 + Math.abs(Math.sin(now / 460)) * 0.3;
      ctx.lineWidth = 1.6 * z;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* 등급(tier)마다 다른 실제 탑 그림 — 2026-09-11 배치 굽기에서 처음엔
       t3(웅진)만 못 구웠다가, 같은 날 이어서 재시도 끝에 마저 구웠다 */
    var sp = global.DG.sprite;
    var fortTier = info && info.tier && info.tier.tier;
    var fortImg = fortTier === 1 ? sp.buildingImg('Watchtower')
      : fortTier === 2 ? sp.buildingImg('Tower')
      : fortTier === 3 ? sp.buildingImg('tower_round')
      : null;
    var bh = sp.building(ctx, {
      x: p.x, y: p.y, s: z * 1.15, k2d: z * bodyK(), form: 'wall', color: mine ? '#7a6234' : undefined,
      t: now / 1000, img: fortImg, kind2d: fortTier ? 'fort:t' + fortTier : 'fort'
    });

    /* 깃발 — 지키는 세력의 표식 */
    var fx = p.x, fy = p.y - (bh > 0 ? bh * 0.66 : 44 * z);   // W-0349 그린 키의 2/3(옛 44/67)
    ctx.strokeStyle = 'rgba(230,230,236,0.7)';
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 16 * z); ctx.lineTo(fx, fy - 8 * z);
    ctx.stroke();
    var wav = Math.sin(now / 380) * 1.8 * z;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 8 * z);
    ctx.lineTo(fx + 15 * z + wav, fy - 4 * z);
    ctx.lineTo(fx, fy + 1 * z);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (info) {
      ctx.font = 'bold ' + (7.5 * z) + 'px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(mine ? '我' : info.faction.mark, fx + 7 * z, fy - 1.5 * z);
      ctx.textAlign = 'left';
    }

    /* 적장이 들었으면 그것이 먼저 보여야 한다 (원작 레이드 알·보스 표시) */
    var raid = global.DG.raid ? global.DG.raid.current(ft) : null;
    if (raid) {
      ctx.font = 'bold ' + (15 * z) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9a5a';
      (global.DG.mode2d || { mark: function (c, s, x, y) { c.fillText(s, x, y); } }).mark(ctx, '⚔️', p.x, p.y - (bh > 0 ? bh * 0.93 : 62 * z) + Math.sin(now / 380) * 2 * z);   // W-0350 자체 아이콘
      ctx.textAlign = 'left';
      label(ctx, raid.tier.name + ' · ' + raid.hero.name, p.x, p.y + 15 * z,
        'rgba(255,154,90,0.95)', 'center', z);
      return;
    }

    label(ctx, ft.name + (mine ? ' · 내 것' : ''), p.x, p.y + 15 * z,
      mine ? 'rgba(232,193,90,0.8)' : 'rgba(255,255,255,0.42)', 'center', z);
  }

  /**
   * 역참 한 채. 쉬는 중이면 낮처럼 흐리고, 채워지면 불이 들어온다
   * (원작에서 보급 거점이 보라색으로 가라앉았다가 파랗게 돌아오는 그 신호다).
   */
  function drawStation(st, u, v, now, pos) {
    var ctx = U.ctx(), geom = U.geom();
    var p = project(u, v);
    if (p.s < 0.25 || p.y < -80 || p.y > geom.H + 80) { return; }
    var z = core.clamp(p.s, 0.5, 1.6);
    var dist = Math.hypot(st.x - pos.x, st.y - pos.y);
    var near = dist <= ENCOUNTER_RANGE;
    var stn = global.DG.station;
    /* 적도에게 점거된 역참 — 등롱이 꺼지고 검은 깃발이 선다(rogue.js).
       `rankAt` 은 해시만 보는 값싼 문이다. 프레임마다 도감을 훑지 않는다 */
    var R = global.DG.rogue;
    var held = R ? R.rankAt(st) : null;
    var ready = !held && (stn ? stn.stateOf(st.key).ready : true);

    // 발밑 고리 — 채워졌으면 금빛, 점거되었으면 핏빛, 쉬는 중이면 재빛
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 17 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fill();
    ctx.strokeStyle = held ? '#c0463c' : (ready ? '#e8c15a' : 'rgba(150,155,165,0.55)');
    ctx.lineWidth = (near ? 2.8 : 1.6) * z;
    ctx.stroke();
    if (near && (ready || held)) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 24 * z, 10 * z, 0, 0, Math.PI * 2);
      var puls = 0.20 + Math.abs(Math.sin(now / (held ? 300 : 420))) * 0.26;
      ctx.strokeStyle = held
        ? 'rgba(192,70,60,' + puls + ')'
        : 'rgba(232,193,90,' + puls + ')';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
    }

    ctx.globalAlpha = held ? 0.72 : (ready ? 1 : 0.55);
    var bh = global.DG.sprite.building(ctx, {
      x: p.x, y: p.y, s: z * 0.88, k2d: z * bodyK(), form: 'stable', t: now / 1000,
      kind2d: 'station', img: global.DG.sprite.buildingImg('tower_ruin')     // 3D 역참과 같은 실사 폐허 탑을 구운 그림(tools/bake-icons, 2026-09-23 — 전엔 굽기가 멎어 옛 여관 그림)
    });

    // 채워진 역참에는 등롱 하나, 점거된 역참에는 검은 깃발 — 멀리서도 눈에 든다
    if (ready || held) {
      var bob = Math.sin(now / (held ? 380 : 520)) * 1.6 * z;
      ctx.font = (14 * z) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      (global.DG.mode2d || { mark: function (c, s, x, y) { c.fillText(s, x, y); } }).mark(ctx, held ? '🏴' : '🏮', p.x, p.y - (bh > 0 ? bh * 0.77 : 46 * z) + bob);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;

    label(ctx, held ? (st.name + ' · ' + held.name) : st.name, p.x, p.y + 13 * z,
      held ? 'rgba(240,160,150,0.86)' : (ready ? 'rgba(240,225,180,0.72)' : 'rgba(255,255,255,0.30)'),
      'center', z);
  }

  return { drawFort: drawFort, drawStation: drawStation };
  } };
})(window);
