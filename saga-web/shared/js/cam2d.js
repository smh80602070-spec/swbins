/**
 * 2D 카메라 배율 — 다섯 판 공용(W-0365, 사용자 10-21 "화면이 너무 가까운 경우도 있어서 화면 고정하면 안 될 듯")
 *
 * 판마다 코드에 박혀 있던 2D 배율 대신, 판이 이 배율을 **곱해** 그린다. 판정 거리(만남·사거리·대화)는 화면 배율과 무관 — 그리기만.
 *   var cam = DG.cam2d.register('field', { store: '<세이브 base>/cam2d', min: 0.5, max: 2, def: 1, defPhone: 0.8 });
 *   cam.get()              지금 배율(폰·PC 따로 기억한 값, 없으면 def/defPhone)
 *   cam.set(v) · cam.step(+1|-1)   범위 [min,max] 로 묶고 0.1 단위로 맞춰 저장 · 바뀌면 onChange(v)
 *   cam.attach(el, { onPinchStart })  el 위 휠(×1.1)·두 손가락 핀치(거리비) — 두 번째 손가락이 닿는 순간 onPinchStart() 로
 *                                     판이 첫 손가락 입력(조이스틱·끌기·탭 이동)을 취소하게 한다
 *   cam.pinching()         핀치 중인가(attach 뒤) — 판 끌기·탭 이동이 그동안 쉬게
 *   cam.buttons(parent)    ＋/－ 작은 단추 둘(.cam2d-btns, ui-kit 폰 단추 규칙) — parent 에 붙이고 그 상자를 돌려준다
 *   DG.cam2d.pinchRatio(a0, b0, a1, b1) · clampSnap(v, min, max) — 순수 함수(진단용)
 * 저장: localStorage['<store>'] = { "<key>/phone": 0.8, "<key>/pc": 1.2 } — 세이브 키 이름은 안 바꾼다(그 아래 /cam2d 한 칸).
 * 정본은 saga-web/shared/js/cam2d.js — 판별 사본은 tools/sync-shared.mjs.
 */
(function (global) {
  'use strict';
  var all = {};

  function clampSnap(v, min, max) {
    v = Math.round((+v || 0) * 10) / 10;
    return Math.max(min, Math.min(max, v));
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  /** 두 손가락 처음 자리(a0,b0) → 지금 자리(a1,b1) 거리비. 처음 거리가 0 이면 1 */
  function pinchRatio(a0, b0, a1, b1) { var d0 = dist(a0, b0); return d0 > 1 ? dist(a1, b1) / d0 : 1; }
  function phone() { var M = global.DG && global.DG.deviceMode; return M && M.phone ? !!M.phone() : (global.innerWidth || 1000) <= 520; }
  function ls() { try { return global.localStorage; } catch (e) { return null; } }
  function readStore(k) { var s = ls(); if (!s) { return {}; } try { return JSON.parse(s.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function writeStore(k, o) { var s = ls(); if (!s) { return; } try { s.setItem(k, JSON.stringify(o)); } catch (e) { /* 가득·막힘 — 이 탭 동안만 */ } }

  function register(key, o) {
    o = o || {};
    var min = o.min != null ? o.min : 0.5, max = o.max != null ? o.max : 2;
    var store = o.store || 'saga-cam2d', slot = key + (phone() ? '/phone' : '/pc');
    var def = clampSnap(phone() && o.defPhone != null ? o.defPhone : (o.def != null ? o.def : 1), min, max);
    var saved = readStore(store)[slot];
    var cur = clampSnap(saved != null ? saved : def, min, max), live = cur;   // live = 핀치 중 맞추기 전 값(부드럽게)
    var subs = o.onChange ? [o.onChange] : [];
    function emit() { for (var i = 0; i < subs.length; i++) { try { subs[i](live); } catch (e) { /* 판 쪽 */ } } }
    function save() { var st = readStore(store); st[slot] = cur; writeStore(store, st); }
    var cam = {
      key: key, min: min, max: max, def: def,
      get: function () { return live; },
      set: function (v, noSave) { cur = clampSnap(v, min, max); live = cur; if (!noSave) { save(); } emit(); return cur; },
      step: function (d) { return cam.set(cur + (d > 0 ? 0.1 : -0.1) * Math.max(1, Math.round(Math.abs(d)))); },
      reset: function () { return cam.set(def); },
      onChange: function (fn) { subs.push(fn); },
      pinching: function () { return false; },
      attach: function (el, ao) {
        if (!el || el._cam2d) { return; }
        el._cam2d = cam; ao = ao || {};
        var pts = {}, start = null;
        cam.pinching = function () { return !!start; };
        el.addEventListener('wheel', function (e) {
          if (ao.wheel === false) { return; }
          e.preventDefault();
          cam.set(cur * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        }, { passive: false });
        function list() { var a = []; for (var k in pts) { if (pts.hasOwnProperty(k)) { a.push(pts[k]); } } return a; }
        el.addEventListener('pointerdown', function (e) {
          if (e.pointerType !== 'touch') { return; }
          pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          var a = list();
          if (a.length === 2) {
            start = { a: { x: a[0].x, y: a[0].y }, b: { x: a[1].x, y: a[1].y }, v: cur };
            if (ao.onPinchStart) { try { ao.onPinchStart(); } catch (er) { /* 판 쪽 */ } }
          }
        }, true);
        el.addEventListener('pointermove', function (e) {
          if (!pts[e.pointerId]) { return; }
          pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          var a = list();
          if (start && a.length === 2) {
            live = Math.max(min, Math.min(max, start.v * pinchRatio(start.a, start.b, a[0], a[1])));
            emit(); e.preventDefault();
          }
        }, true);
        function up(e) {
          if (!pts[e.pointerId]) { return; }
          delete pts[e.pointerId];
          if (start && list().length < 2) { start = null; cam.set(live); }
        }
        el.addEventListener('pointerup', up, true);
        el.addEventListener('pointercancel', up, true);
      },
      buttons: function (parent) {
        if (!parent || !global.document) { return null; }
        var box = document.createElement('div');
        box.className = 'cam2d-btns';
        box.innerHTML = '<button type="button" class="icon-btn sm" data-cam2d="+" title="가까이(확대)">＋</button>' +
          '<button type="button" class="icon-btn sm" data-cam2d="-" title="멀리(축소)">－</button>';
        box.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('[data-cam2d]');
          if (b) { e.stopPropagation(); cam.step(b.getAttribute('data-cam2d') === '+' ? 1 : -1); }
        });
        parent.appendChild(box);
        return box;
      }
    };
    all[key] = cam;
    return cam;
  }

  global.DG = global.DG || {};
  global.DG.cam2d = { register: register, get: function (k) { return all[k] || null; }, pinchRatio: pinchRatio, clampSnap: clampSnap, STD: { def: 0.65, defPhone: 0.5 } };   // W-0487 ③ 다섯 판 기본 멀게 한 벌(사용자 10-27 "카메라 멀게는 다섯 판이 다 같아")
})(typeof window !== 'undefined' ? window : this);
