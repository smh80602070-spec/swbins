/**
 * 2나락 2D 조명 레이어(어둠·횃불 빛·구멍)와 연출(맞음·튀김·글자 아래/위) — dungeon-view.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * dungeon-view.js 가 `bind({ d, proj, isoEllipse, IX, IY, D2_FONT, view })` 로 손잡이를 넘긴다. 캔버스 ctx·어둠 레이어 lightCtx 는
 * 켤 때 정해지므로 그리기 함수를 부를 때마다 view() 로 지금 값을 당겨 온다(pull).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, d, proj, isoEllipse, IX, IY, D2_FONT;
  var ctx = null, lightCtx = null;
  var api = null;
  function bind(g) { if (G !== g) { G = g; d = g.d; proj = g.proj; isoEllipse = g.isoEllipse; IX = g.IX; IY = g.IY; D2_FONT = g.D2_FONT; } return api; }
  function pull() { var v = G.view(); ctx = v.ctx; lightCtx = v.lightCtx; }
  /* ── 조명 레이어 ─────────────────────────────────────── */

  function drawLights(m, run, theme, now) {
    var c = lightCtx;
    c.clearRect(0, 0, m.cw, m.ch);
    /* 원작의 던전은 등불 반경 밖이 거의 검다 — 그 어둠이 "내려간다" 는 감각을 만든다.
       **마을은 그 반대다.** 불을 피워 두고 사람이 사는 자리라 훤하다 —
       던전과 같은 어둠을 씌우면 여섯 사람이 죄다 그림자에 잠겨 누가 누군지 안 보인다. */
    c.fillStyle = run.town ? 'rgba(3,3,6,0.30)' : 'rgba(2,2,4,0.74)';
    c.fillRect(0, 0, m.cw, m.ch);
    c.globalCompositeOperation = 'destination-out';

    /* 플레이어 빛 */
    hole(c, m, run.player.x, run.player.y, run.town ? 300 : 178, 1);

    /* 마을 표식 빛 — 밟을 자리는 멀리서도 보여야 간다 */
    var mks = run.room.marks || [];
    for (var mi = 0; mi < mks.length; mi++) {
      hole(c, m, mks[mi].x, mks[mi].y, 76, 0.8);
    }

    /* 횃불 빛 (일렁인다) */
    var dec = run.room.decor || [];
    for (var i = 0; i < dec.length; i++) {
      if (dec[i].t !== 'torch') { continue; }
      var fl = 0.72 + Math.sin(now / 140 + dec[i].seed) * 0.12;
      hole(c, m, dec[i].x, dec[i].y + 8, 118, fl);
    }
    /* 기공파 빛 */
    for (i = 0; i < run.shots.length; i++) {
      hole(c, m, run.shots[i].x, run.shots[i].y, 62, 0.9);
    }
    /* 열린 문 빛 */
    if (run.room.cleared) {
      for (i = 0; i < run.room.doors.length; i++) {
        hole(c, m, d().ROOM_W - 10, run.room.doors[i].y, 55, 0.7);
      }
    }

    /* 어둠을 뚫는 것으로 끝내지 않고 **불빛 색**을 덧댄다.
       원작의 횃불은 주황이고 그 언저리만 따뜻하다 — 이 한 겹이 없으면
       구멍만 뚫린 회색 무대가 된다. */
    c.globalCompositeOperation = 'lighter';
    glow(c, m, run.player.x, run.player.y, 170, 'rgba(255,186,112,0.085)');
    for (mi = 0; mi < mks.length; mi++) {
      glow(c, m, mks[mi].x, mks[mi].y, 80, 'rgba(255,196,96,0.10)');
    }
    for (i = 0; i < dec.length; i++) {
      if (dec[i].t !== 'torch') { continue; }
      var fw = 0.16 + Math.sin(now / 140 + dec[i].seed) * 0.05;
      glow(c, m, dec[i].x, dec[i].y + 8, 128, 'rgba(255,138,44,' + fw.toFixed(3) + ')');
    }
    for (i = 0; i < run.shots.length; i++) {
      glow(c, m, run.shots[i].x, run.shots[i].y, 60, 'rgba(120,200,255,0.12)');
    }
    if (run.room.cleared) {
      for (i = 0; i < run.room.doors.length; i++) {
        glow(c, m, d().ROOM_W - 10, run.room.doors[i].y, 58, 'rgba(255,196,96,0.11)');
      }
    }
    c.globalCompositeOperation = 'source-over';
  }

  /** 불빛 한 겹 — hole 과 같은 자리에 색을 얹는다 (composite 는 부르는 쪽이 정한다) */
  function glow(c, m, x, y, r, color) {
    var p = proj(m, x, y);
    var rx = m.belt ? r * m.s : r * 1.414 * IX * m.s, ry = m.belt ? r * m.k : r * 1.414 * IY * m.s;
    c.save();
    c.translate(p.x, p.y - 8 * m.s);
    c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, rx * 0.05, 0, 0, rx);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /** 어둠에 빛 구멍 하나 — 납작한 타원 그라디언트 */
  function hole(c, m, x, y, r, strength) {
    var p = proj(m, x, y);
    var rx = m.belt ? r * m.s : r * 1.414 * IX * m.s, ry = m.belt ? r * m.k : r * 1.414 * IY * m.s;
    c.save();
    c.translate(p.x, p.y - 8 * m.s);
    c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, rx * 0.12, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,' + Math.min(1, strength) + ')');
    g.addColorStop(0.62, 'rgba(0,0,0,' + Math.min(1, strength * 0.55) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /* ── 연출 ─────────────────────────────────────────────── */

  /** 조명보다 아래 — 장면에 섞이는 것 (칼궤적·격파·돌진 잔상·회전참) */
  function drawFxUnder(m, f) {
    var p;
    if (f.t === 'slash') {
      p = proj(m, f.x, f.y);
      var a = (f.a || 0) * 0.5;              // 투영이 눕어 있어 각도를 죽인다
      ctx.save();
      ctx.translate(p.x, p.y - 10);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.arc(0, 0, 16 * Math.max(0.8, m.s), -0.7, 0.7);
      ctx.strokeStyle = f.crit ? 'rgba(255,220,120,' + (f.life / 0.16) + ')'
                               : 'rgba(240,245,255,' + (f.life / 0.16 * 0.85) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    } else if (f.t === 'fan') {
      /* §5.19 2차 원뿔 무예 — slash 와 같은 호를 크게 */
      p = proj(m, f.x, f.y);
      ctx.save();
      ctx.translate(p.x, p.y - 10);
      ctx.rotate((f.a || 0) * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, (f.r || 50) * 0.5 * Math.max(0.8, m.s), -0.8, 0.8);
      ctx.strokeStyle = 'rgba(200,236,255,' + (f.life / 0.26 * 0.9) + ')';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    } else if (f.t === 'pop') {
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, (0.45 - f.life) * (f.boss ? 88 : 44));
      ctx.strokeStyle = 'rgba(255,220,150,' + (f.life / 0.45) + ')';
      ctx.lineWidth = 2; ctx.stroke();
    } else if (f.t === 'burst') {
      p = proj(m, f.x, f.y);
      var k = 1 - f.life / 0.5;
      ctx.save();
      ctx.globalAlpha = f.life / 0.5;
      ctx.fillStyle = f.color || '#c9a83a';
      for (var j = 0; j < (f.boss ? 10 : 6); j++) {
        var ang = f.seed + j * (6.283 / (f.boss ? 10 : 6));
        var rr = (10 + k * (f.boss ? 46 : 26)) * Math.max(0.8, m.s);
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(ang) * rr, p.y - 8 + Math.sin(ang) * rr * 0.5 - k * 14,
          (f.boss ? 3.4 : 2.4) * (1 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (f.t === 'whirl') {
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, f.r * (1.15 - f.life / 0.3 * 0.4));
      ctx.strokeStyle = 'rgba(150,220,255,' + (f.life / 0.3 * 0.8) + ')';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (f.t === 'pull') {
      /* §5.19 2차 끌어당기기 — 바깥에서 발밑으로 오그라드는 원 */
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, Math.max(8, (f.r || 150) * (f.life / 0.35)));
      ctx.strokeStyle = 'rgba(180,140,255,' + (0.35 + 0.65 * f.life / 0.35) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (f.t === 'zone') {
      /* 예고 원(§5.18) — 제 크기에 서서 터질 때가 다가올수록 진해진다(불바닥은 고르게) */
      var zk = 1 - f.life / (f.max || 1);
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, f.r || 40);
      ctx.globalAlpha = f.pool ? Math.min(1, f.life) * 0.35 : 0.12 + 0.3 * zk;
      ctx.fillStyle = f.color || '#ff6a3a';
      ctx.fill();
      ctx.globalAlpha = f.pool ? Math.min(1, f.life) * 0.8 : 0.4 + 0.6 * zk;
      ctx.strokeStyle = f.color || '#ff6a3a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.t === 'ring') {
      ctx.beginPath();
      isoEllipse(ctx, m, f.x, f.y, (0.55 - f.life) * 130);
      ctx.strokeStyle = 'rgba(240,180,90,' + (f.life / 0.55) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (f.t === 'trail') {
      p = proj(m, f.x, f.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 8 * (f.life / 0.22), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,220,255,' + (f.life / 0.22 * 0.3) + ')';
      ctx.fill();
    }
  }

  /** 조명 위 — 숫자·획득 문구 (어두워도 읽혀야 한다) */
  function drawFxOver(m, f) {
    var p; if (global.DG.vfx2d && (f.t === 'hit' || f.t === 'pop' || f.t === 'elem' || f.t === 'lvl' || f.t === 'get')) { p = proj(m, f.x, f.y); global.DG.vfx2d.fxLayer(ctx, f, p.x, p.y - 14); }   // W-0053 전투 이펙트 시트(K-0039) — 숫자 아래에 얹는다
    if (f.t === 'hit') {
      p = proj(m, f.x, f.y);
      var FXS = global.DG.fx3d, nsz = f.crit ? 18 : 13, up = (0.6 - f.life) * 26 + (FXS && FXS.slotUp ? FXS.slotUp(f.nslot, nsz) : 0), sx = FXS && FXS.slotDx ? FXS.slotDx(f.nslot, nsz) : 0;   // W-0077 칸 비킴
      /* §5.8① 크리 숫자는 1.4배(13×1.4=18)·주황(2026-09-18, 3D fx3d.js 와 같은 색) */
      ctx.font = (f.crit ? '700 18px ' : '600 13px ') + D2_FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      /* 저항에 깎인 타격은 **흐린 잿빛**이다 — 숫자만 보고도 "안 통한다" 를 안다 */
      ctx.fillStyle = f.foe ? 'rgba(255,120,120,' + (f.life / 0.7) + ')'
                            : (f.crit ? 'rgba(255,140,60,' + (f.life / 0.6) + ')'
                                      : (f.resist ? 'rgba(150,150,160,' + (f.life / 0.6) + ')'
                                                  : 'rgba(255,255,255,' + (f.life / 0.6) + ')'));
      ctx.fillText((f.crit ? '★' : '') + f.v, p.x + sx, p.y - 24 - up);
    } else if (f.t === 'elem') {
      /* 원소 피해 — 그 결의 색으로 뜬다. 독은 몇 초에 걸쳐 들어가므로 괄호를 씌운다 */
      p = proj(m, f.x, f.y);
      var FXE = global.DG.fx3d, eu = (0.6 - f.life) * 22 + (FXE && FXE.slotUp ? FXE.slotUp(f.nslot, 12) : 0), ex = FXE && FXE.slotDx ? FXE.slotDx(f.nslot, 12) : 0;   // W-0077 칸 비킴
      ctx.font = '700 12px ' + D2_FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = core.clamp(f.life / 0.6, 0, 1);
      ctx.fillStyle = f.color || '#fff';
      ctx.fillText((f.dot ? '(' + f.v + ')' : '' + f.v), p.x + ex, p.y - 30 - eu);
      ctx.globalAlpha = 1;
    } else if (f.t === 'get') {
      p = proj(m, f.x, f.y);
      var uy = (1.1 - f.life) * 22;
      ctx.font = '600 11px ' + D2_FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = f.color || '#f0c45a';
      ctx.globalAlpha = core.clamp(f.life, 0, 1);
      ctx.fillText(f.text, p.x, p.y - 22 - uy);
      ctx.globalAlpha = 1;
    }
  }

  function roundedRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }


  api = {
    bind: bind,
    drawLights: function (m, run, theme, now) { pull(); return drawLights(m, run, theme, now); },
    drawFxUnder: function (m, f) { pull(); return drawFxUnder(m, f); },
    drawFxOver: function (m, f) { pull(); return drawFxOver(m, f); }
  };
  global.DG = global.DG || {};
  global.DG.dungeonViewFx = api;
})(typeof window !== 'undefined' ? window : this);
