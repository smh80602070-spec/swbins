  /* ── 마을 기(깃대·깃발 무늬) — js/village-flag.js(R-4). 같은 이름 한 줄 넘김 ───────── */
  var villageFlagBind = null;
  function FLAG() { return global.DG.villageFlag.bind(villageFlagBind || (villageFlagBind = { shadow: shadow }), ctx); }
  function drawPole(x, y, k, now) { return FLAG().drawPole(x, y, k, now); } function drawFlagSym(key, cx, cy, r, c) { return FLAG().drawFlagSym(key, cx, cy, r, c); }

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
    autotile: function () { return AT(); }, autotileOn: autotileOn,   // W-0390
    flagIcon: flagIcon, flagIconOf: flagIconOf,
    init: init, draw: draw, resize: resize,
    /** 3D 가 켜져 2D 를 안 그릴 때도 카메라(좌표 변환 기준)는 사람을 따라간다 — 발열 대책(2026-09-24) */
    syncCam: function () { var p = V.raw().player; cam.x = p.x; cam.y = p.y; },
    /** 자가진단용 */
    _cam: function () { return cam; },
    _animalSprite: function (kind) { return ANIMAL_SPRITE[kind] || null; },
    _project: project, _bubbleSlot: bubbleSlot,   // W-0144 진단
    _unproject: unproject,
    _projectIn: projIn,
    _unprojectIn: unprojIn
  };
})(window);
