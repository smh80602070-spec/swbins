  /* ── 마을 기 ──────────────────────────────────────────────
   * 원작에서 마을 어귀에 서 있던 그 깃발이다. 바탕·무늬·무늬색 셋으로 그린다.
   * 바람에 흔들리는 것은 오른쪽으로 갈수록 크게 흔들리는 사인 하나면 충분하다.
   */
  function drawPole(x, y, k, now) {
    var T = global.DG.town;
    if (!T) { return; }
    var bg = T.flagBg(), fg = T.flagFg(), sym = T.flagSym();
    var h = 74 * k;

    shadow(x, y + 2 * k, 9 * k, 3.4 * k);
    ctx.fillStyle = '#8a6440';                       // 깃대
    ctx.fillRect(x - 2 * k, y - h, 4 * k, h);
    ctx.beginPath();                                 // 꼭대기 구슬
    ctx.arc(x, y - h - 3 * k, 3.4 * k, 0, Math.PI * 2);
    ctx.fillStyle = '#d8a63c';
    ctx.fill();

    /* 깃발 — 위아래 가장자리를 흔들어 천처럼 만든다 */
    var fw = 46 * k, fh = 30 * k, top = y - h + 6 * k;
    var wav = function (t) { return Math.sin(now / 260 + t * 3.4) * 3.2 * k * t; };
    ctx.beginPath();
    ctx.moveTo(x + 2 * k, top);
    for (var i = 0; i <= 8; i++) {
      var t = i / 8;
      ctx.lineTo(x + 2 * k + fw * t, top + wav(t));
    }
    for (var j = 8; j >= 0; j--) {
      var t2 = j / 8;
      ctx.lineTo(x + 2 * k + fw * t2, top + fh + wav(t2));
    }
    ctx.closePath();
    ctx.fillStyle = bg.c;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1 * k;
    ctx.stroke();

    ctx.save();
    ctx.clip();
    drawFlagSym(sym.key, x + 2 * k + fw * 0.5, top + fh * 0.5 + wav(0.5), fh * 0.34, fg.c);
    ctx.restore();
  }

  /** 깃발 무늬 한 점 — (cx, cy) 를 가운데로 반지름 r */
  function drawFlagSym(key, cx, cy, r, c) {
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var i, a;
    switch (key) {
      case 'taegeuk':
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
        ctx.arc(cx, cy + r * 0.5, r * 0.5, Math.PI / 2, -Math.PI / 2, true);
        ctx.arc(cx, cy - r * 0.5, r * 0.5, Math.PI / 2, -Math.PI / 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'pine':
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.10, cy + r);
        ctx.lineTo(cx + r * 0.10, cy + r);
        ctx.lineTo(cx + r * 0.10, cy);
        ctx.lineTo(cx - r * 0.10, cy);
        ctx.closePath();
        ctx.fill();
        for (i = 0; i < 3; i++) {
          var yy = cy + r * 0.1 - i * r * 0.46;
          var wd = r * (0.9 - i * 0.22);
          ctx.beginPath();
          ctx.moveTo(cx - wd, yy);
          ctx.lineTo(cx + wd, yy);
          ctx.lineTo(cx, yy - r * 0.62);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'crane':
        ctx.beginPath();                             // 나는 학 — 몸통과 두 날개
        ctx.ellipse(cx, cy + r * 0.1, r * 0.30, r * 0.60, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.1, cy);
        ctx.quadraticCurveTo(cx - r * 1.0, cy - r * 0.8, cx - r * 0.95, cy - r * 0.1);
        ctx.quadraticCurveTo(cx - r * 0.5, cy - r * 0.2, cx - r * 0.1, cy + r * 0.15);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.1, cy);
        ctx.quadraticCurveTo(cx + r * 1.0, cy - r * 0.8, cx + r * 0.95, cy - r * 0.1);
        ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.2, cx + r * 0.1, cy + r * 0.15);
        ctx.fill();
        ctx.beginPath();                             // 목
        ctx.moveTo(cx, cy - r * 0.35);
        ctx.quadraticCurveTo(cx + r * 0.35, cy - r * 0.9, cx + r * 0.6, cy - r * 0.75);
        ctx.stroke();
        break;
      case 'mount':
        ctx.beginPath();
        ctx.moveTo(cx - r, cy + r * 0.7);
        ctx.lineTo(cx - r * 0.32, cy - r * 0.55);
        ctx.lineTo(cx + r * 0.05, cy + r * 0.05);
        ctx.lineTo(cx + r * 0.42, cy - r * 0.85);
        ctx.lineTo(cx + r, cy + r * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      case 'wave':
        for (i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - r, cy - r * 0.5 + i * r * 0.55);
          ctx.quadraticCurveTo(cx - r * 0.5, cy - r * 0.95 + i * r * 0.55,
                               cx, cy - r * 0.5 + i * r * 0.55);
          ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.05 + i * r * 0.55,
                               cx + r, cy - r * 0.5 + i * r * 0.55);
          ctx.stroke();
        }
        break;
      case 'star':
        ctx.beginPath();
        for (i = 0; i < 10; i++) {
          a = -Math.PI / 2 + i * Math.PI / 5;
          var rr = i % 2 ? r * 0.42 : r;
          if (i === 0) { ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
          else { ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'tiger':
        ctx.beginPath();                             // 범 발자국 — 발바닥과 발가락 넷
        ctx.ellipse(cx, cy + r * 0.35, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        for (i = 0; i < 4; i++) {
          a = -Math.PI * 0.82 + i * Math.PI * 0.21;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72 + r * 0.1,
            r * 0.20, r * 0.26, a + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'stele':
        ctx.beginPath();                             // 사고비 — 윗머리가 둥근 비석과 새긴 글줄 셋
        ctx.moveTo(cx - r * 0.62, cy + r);
        ctx.lineTo(cx - r * 0.62, cy - r * 0.35);
        ctx.arc(cx, cy - r * 0.35, r * 0.62, Math.PI, 0);
        ctx.lineTo(cx + r * 0.62, cy + r);
        ctx.closePath();
        ctx.stroke();
        for (i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.3, cy - r * 0.3 + i * r * 0.4);
          ctx.lineTo(cx + r * 0.3, cy - r * 0.3 + i * r * 0.4);
          ctx.stroke();
        }
        break;
      default:
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }
  }

  /* ── 행사 ─────────────────────────────────────────────────
   * 백중 밤의 불꽃. 씨앗 대신 **시각을 잘라** 터지는 자리를 정한다 —
   * 매 프레임 새로 뽑으면 깜박이고, 아주 고정하면 죽은 그림이 된다.
   */
  function drawFireworks(now) {
    var n = 3, i, j;
    for (i = 0; i < n; i++) {
      var cycle = 2600 + i * 700;
      var t = ((now + i * 900) % cycle) / cycle;      // 0 → 1 로 한 번 터진다
      var seed = Math.floor((now + i * 900) / cycle);
      var cx = (0.18 + core.hash2(seed, i * 7 + 1) * 0.64) * W;
      var cy = (0.10 + core.hash2(i * 13 + 3, seed) * 0.34) * Math.max(80, horizonY + 60);
      var hue = ['#ffd36a', '#ff8a7a', '#8fd0ff', '#c6a8ff', '#9ce8a0'][seed % 5];

      if (t < 0.22) {                                 // 올라가는 불씨
        var up = 1 - t / 0.22;
        ctx.fillStyle = 'rgba(255,220,150,0.9)';
        ctx.beginPath();
        ctx.arc(cx, cy + up * 180, 2.4, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      var k = (t - 0.22) / 0.78;
      var rad = 12 + k * 92;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.95;
      ctx.strokeStyle = hue;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (j = 0; j < 14; j++) {
        var a = (j / 14) * Math.PI * 2 + seed;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * rad * 0.72, cy + Math.sin(a) * rad * 0.72);
        ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * 깃발 한 장을 그림 파일로 뽑아 준다 — 시트에서 고를 때 미리 보여 주려는 것이다.
   * 모듈의 ctx 를 잠깐 빌려 쓴다(한 가닥으로 도는 코드라 겹칠 일이 없다).
   */
  function flagIconOf(bgKey, fgKey, symKey, size) {
    var VDx = global.DG.villageData;
    var pick = function (list, key) {
      var f = list.filter(function (x) { return x.key === key; });
      return f[0] || list[0];
    };
    var bg = pick(VDx.FLAG_BGS, bgKey), fg = pick(VDx.FLAG_FGS, fgKey);
    var w = size || 42, h = Math.round(w * 0.66);
    var cv2 = document.createElement('canvas');
    cv2.width = w; cv2.height = h;
    var keep = ctx;
    ctx = cv2.getContext('2d');
    ctx.fillStyle = bg.c;
    ctx.fillRect(0, 0, w, h);
    drawFlagSym(symKey, w / 2, h / 2, h * 0.34, fg.c);
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx = keep;
    return cv2.toDataURL();
  }

  function flagIcon(size) {
    var T = global.DG.town;
    return flagIconOf(T.flag().bg, T.flag().fg, T.flag().sym, size);
  }

  global.DG = global.DG || {};
  global.DG.villageView = {
    flagIcon: flagIcon, flagIconOf: flagIconOf,
    init: init, draw: draw, resize: resize,
    /** 3D 가 켜져 2D 를 안 그릴 때도 카메라(좌표 변환 기준)는 사람을 따라간다 — 발열 대책(2026-09-24) */
    syncCam: function () { var p = V.raw().player; cam.x = p.x; cam.y = p.y; },
    /** 자가진단용 */
    _cam: function () { return cam; },
    _animalSprite: function (kind) { return ANIMAL_SPRITE[kind] || null; },
    _project: project,
    _unproject: unproject,
    _projectIn: projIn,
    _unprojectIn: unprojIn
  };
})(window);
