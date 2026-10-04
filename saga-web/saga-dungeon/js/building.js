/**
 * 건물 입구 (W-0045) — 위성 마을의 여관·마방·방앗간 앞에 표식을 세우고, 밟으면 안쪽 창을 띄운다.
 * ---------------------------------------------------------------
 *   addMarks   town.js buildInner 가 부른다 — 장식 inn·stable·mill 앞 문간 자리에 room.marks 한 칸
 *   open       ui.js 의 town:mark 라우팅이 부른다 — 2D 모드면 K-0025 실내 그림(방 + 앞가림 층), 3D 이거나
 *              그림을 못 받으면 글만. 창 안에 행동(쉼·저장·상점)은 없다 — 그림과 한 줄뿐
 *
 * town.js·ui.js 는 이미 큰 파일이라(tools/big-files.txt) 새 코드는 여기에 둔다.
 */
(function (global) {
  'use strict';

  global.DG = global.DG || {};

  /** 안에 들어가 볼 수 있는 건물 → 안쪽 창 내용. room = shared/assets/web2d/interior/<room>.webp */
  var ROOMS = {
    inn:    { name: '나그네 쉼터', emoji: '🏮', room: 'inn_hall',       line: '긴 탁자마다 나그네들이 둘러앉아 있습니다. 화덕 불빛이 따뜻합니다.' },
    stable: { name: '마방',        emoji: '🐴', room: 'barn_hayloft',   line: '말 냄새와 마른 풀 냄새가 납니다. 짐꾼들이 짐을 부리고 있습니다.' },
    mill:   { name: '방앗간',      emoji: '🌾', room: 'jp_minka_irori', line: '맷돌 소리가 낮게 돕니다. 화로 곁에서 일꾼이 차를 마십니다.' }
  };

  /** 장식 좌표에서의 문간 후보 (dx, dy) — 방 기준 좌표. 앞에서부터 보고 이웃과 비는 첫 자리를 쓴다 */
  var DOOR_SPOTS = [[0, 100], [0, 70], [0, 60], [-45, 100], [-90, 85], [-60, 130], [0, 130]];

  /**
   * @param room   town.js 가 짓는 방({ npcs, marks })
   * @param cfg    마을 설정(cfg.id, cfg.decor — 방 기준 좌표)
   * @param anchor 마을의 세계 앵커 {x, y}
   * @param scalePt 방 기준 좌표 → 실제 방 크기 좌표
   * @param talkR  말 걸리는 거리 — 이웃과 이 두 배 이상 떨어진 자리만 쓴다("한 자리에서 둘이 동시에 걸리지 않는다")
   */
  function addMarks(room, cfg, anchor, scalePt, talkR) {
    var i, n, q, d, cand, w, clear, found;
    for (i = 0; i < cfg.decor.length; i++) {
      d = cfg.decor[i];
      if (!ROOMS[d.t]) { continue; }
      found = null;
      for (n = 0; n < DOOR_SPOTS.length && !found; n++) {
        cand = scalePt(d.x + DOOR_SPOTS[n][0], d.y + DOOR_SPOTS[n][1]);
        w = { x: anchor.x + cand.x, y: anchor.y + cand.y };
        clear = true;
        for (q = 0; q < room.npcs.length && clear; q++) { clear = Math.hypot(w.x - room.npcs[q].x, w.y - room.npcs[q].y) >= talkR * 2; }
        for (q = 0; q < room.marks.length && clear; q++) { clear = Math.hypot(w.x - room.marks[q].x, w.y - room.marks[q].y) >= talkR * 2; }
        if (clear) { found = w; }
      }
      if (!found) { continue; }   // 어디도 비지 않으면 세우지 않는다(NPC 가 먼저다)
      room.marks.push({ key: 'building:' + d.t, building: d.t, townId: cfg.id, name: '건물 입구', emoji: '🚪', x: found.x, y: found.y });
    }
  }

  /** 안쪽 창을 연다. 창 틀은 ui.js 의 #encounter 카드 자리를 그대로 쓴다 */
  function open(mark) {
    var b = mark && ROOMS[mark.building], el = global.document && global.document.getElementById('encounter');
    if (!b || !el) { return; }
    var M2 = global.DG.mode2d, urls = M2 && M2.interiorUrls ? M2.interiorUrls(b.room) : null;
    var html = '<div class="enc-card"><h3 style="margin:0 0 4px;font-size:18px">' + b.emoji + ' ' + b.name + '</h3>';
    if (urls) {
      var fit = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;';
      html += '<div class="interior" style="position:relative;width:100%;aspect-ratio:2/1;border-radius:8px;overflow:hidden;background:#241c16;margin:6px 0">' +
        '<img alt="" src="' + urls.back + '" style="' + fit + '" onerror="this.hidden=true">' +
        '<img alt="" src="' + urls.front + '" style="' + fit + '" onerror="this.hidden=true"></div>';
    }
    html += '<small class="muted">' + b.line + '</small>' +
      '<button class="btn primary wide" style="margin-top:10px" data-act="enc-close">나온다</button></div>';
    el.innerHTML = html;
    el.classList.add('show');
  }

  global.DG.building = { addMarks: addMarks, open: open, ROOMS: ROOMS };
})(typeof window !== 'undefined' ? window : this);
