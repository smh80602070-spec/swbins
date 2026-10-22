/**
 * 이야기 대화창 표정 초상(W-0192, K-0047) — 스승 16명이 말할 때 그 줄의 감정(`[누가, 감정, 말]`)에 맞는 표정 카드로 얼굴을 바꾼다.
 * 그림 `assets/portraits/expr/<id>__<joy|anger|sorrow|surprise>_c.webp`(평온 카드 `_c` 와 같은 자르기, 300×344).
 * 감정 짝(K-0047 메모): joy·anger 그대로 · fire→anger · worry→sorrow · shock→surprise · calm 은 지금 초상(null).
 * ui.js 는 큰 파일 상한이라 이 파일에 두고 renderStoryBox 는 얼굴 줄 두 줄만 이걸 부른다.
 */
(function (global) {
  'use strict';

  var IDS = ['eu_davinci', 'eu_leonidas', 'jp_hanzo', 'jp_himiko', 'jp_musashi', 'jp_tomoegozen', 'jp_yoshitsune', 'kr_gyebaek',
    'sg_ganning', 'sg_huangzhong', 'sg_lubu', 'sg_taishici', 'sg_zhugeliang', 'wd_genghis', 'wd_ibnsina', 'wd_shaka'];
  var MAP = { joy: 'joy', anger: 'anger', fire: 'anger', worry: 'sorrow', shock: 'surprise' };
  var EXPR = ['joy', 'anger', 'sorrow', 'surprise'];
  var BASE = 'assets/portraits/expr/';
  var warm = {};

  function has(id) { return IDS.indexOf(id) >= 0; }

  /** 순수 — 인물 id·감정 → 표정 그림 주소. 16명 밖이거나 평온(calm·모르는 감정)이면 null */
  function exprSrc(id, emote) {
    var e = MAP[emote];
    return has(id) && e ? BASE + id + '__' + e + '_c.webp' : null;
  }

  /** 같은 사람 표정 넷을 한 번 받아 둔다 — 줄을 넘길 때 그림이 늦게 떠 깜빡이지 않게 */
  function preload(id) {
    if (warm[id] || !has(id) || !global.Image) { return; }
    warm[id] = 1;
    EXPR.forEach(function (e) { var im = new global.Image(); im.src = BASE + id + '__' + e + '_c.webp'; });
  }

  /** 얼굴 칸 HTML — 표정이 있으면 그 그림(못 받으면 숨겨 둔 지금 초상으로 바꿔 끼움), 평온 줄은 움직이는 초상(W-0193, live-portrait.js — 대사 text 동안 입), 없으면 fallback 그대로 */
  function face(id, emote, fallback, text) {
    preload(id);
    var src = (global.DG.illust && global.DG.illust.url(id, emote || 'calm')) || exprSrc(id, emote), LP = global.DG.livePortrait, lv;   // W-0371 일러스트(평온 줄도 반신 — 움직이는 초상보다 먼저)
    if (!src) { lv = LP && LP.on() && LP.has(id) ? LP.html(id, text, fallback) : null; return lv || fallback; }
    return '<img class="pt story-expr" alt="" src="' + src + '" onerror="var f=this.nextElementSibling;if(f){f.hidden=false;}this.remove();">' +
      '<span class="story-fb" hidden>' + fallback + '</span>';
  }

  global.DG = global.DG || {};
  global.DG.storyFace = { exprSrc: exprSrc, face: face, preload: preload, IDS: IDS, MAP: MAP };
})(window);
