/**
 * 서비스 워커 — 오프라인 모드의 뼈대
 * ---------------------------------------------------------------
 * 게임 파일은 통째로 캐시해 두고, 지도 타일은 본 것만 모아 둔다.
 * 그래서 비행기 안에서도(=오프라인) 게임이 돌고, 걸었던 동네 지도는 그대로 보인다.
 *
 *   앱 캐시   HTML·CSS·JS·아이콘 — 설치 때 다 받아 둔다 (cache first)
 *   타일 캐시 CARTO 지도 타일 — 받아 본 것만 남기고 상한을 넘으면 오래된 것부터 버린다
 *
 * 주의: 서비스 워커는 https 나 localhost 에서만 등록된다.
 *       사내 http 주소로 폰에서 열면 홈 화면 추가는 되지만 이 캐시는 동작하지 않는다.
 */

var VERSION = 'realm-v1.94.8';
var APP_CACHE = 'sr-app-' + VERSION;
var TILE_CACHE = 'sr-tiles-v1';
var TILE_MAX = 500;

/* index.html 이 부르는 스크립트가 여기 다 있어야 오프라인에서 게임이 돈다.
   파일을 늘렸으면 **VERSION 도 같이 올릴 것** — 안 올리면 옛 캐시가 계속 나온다.

   **`assets/models/*.glb` 는 일부러 안 넣는다.** 못 받아도 지도는 도형(원뿔·상자)
   으로 그대로 선다(`asset3d.js` 의 되돌림 길) — 판정은 한 칸도 안 달라진다. */
var SHELL = [
  './',
  './index.html',
  './assets/portraits/manifest.js',
  './manifest.json',
  './css/style.css',
  './css/strategy.css',
  './css/rts.css',
  './rts.html',
  './js/rts/grid.js',
  './js/rts/rules.js',
  './js/rts/econ.js',
  './js/rts/units.js',
  './js/rts/combat.js',
  './js/rts/heroes.js',
  './js/rts/state.js',
  './js/rts/view.js',
  './js/errlog.js',
  './js/data.js',
  './js/data-city.js',
  './js/data-force.js',
  './js/data-item.js',
  './js/data-relation.js',
  './js/data-quiz.js',
  './js/sprite.js',
  './js/core.js',
  './js/assets3d-ids.js',
  './js/itemicon-ids.js',
  './js/itemicon.js',
  './js/assets3d.js',
  './js/mode2d.js',
  './js/map2d.js',
  './js/sfx.js',
  './js/bgm.js',
  './js/vendor/three.iife.js',
  './js/toon3d-core.js',
  './js/toon3d.js',
  './js/anim-own.js',
  './js/vroid-variant.js',
  './js/asset3d.js',
  './js/account.js',
  './js/hero.js',
  './js/officer.js',
  './js/mount.js',
  './js/rtk.js',
  './js/war.js',
  './js/diplo.js',
  './js/rtk-ai.js',
  './js/event.js',
  './js/data-scenario.js',
  './js/scenario.js',
  './js/quiz.js',
  './js/net.js',
  './js/ai.js',
  './js/realm3d.js',
  './js/city3d.js',
  './js/battle3d.js',
  './js/ui-rtk.js',
  './js/cpanel.js',
  './js/hud.js',
  './js/perf.js',
  './js/game.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(APP_CACHE).then(function (c) {
      // 하나가 실패해도 나머지는 받아 둔다 (파일 하나 때문에 설치가 깨지면 안 된다)
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' }))['catch'](function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== APP_CACHE && k !== TILE_CACHE) { return caches['delete'](k); }
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/** 타일 캐시가 무한히 늘지 않게 오래된 것부터 버린다 */
function trimTiles() {
  caches.open(TILE_CACHE).then(function (c) {
    c.keys().then(function (ks) {
      if (ks.length <= TILE_MAX) { return; }
      for (var i = 0; i < ks.length - TILE_MAX; i++) { c['delete'](ks[i]); }
    });
  });
}

var tileHits = 0;

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') { return; }
  var url = new URL(req.url);

  // 지도 타일 — 있으면 캐시, 없으면 받아서 넣어 둔다
  if (/basemaps\.cartocdn\.com|tile\.openstreetmap|tiles\./.test(url.host)) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function (c) {
        return c.match(req).then(function (hit) {
          if (hit) { return hit; }
          return fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) {
              c.put(req, res.clone());
              if (++tileHits % 40 === 0) { trimTiles(); }
            }
            return res;
          })['catch'](function () {
            return new Response('', { status: 504, statusText: '타일을 받지 못했습니다' });
          });
        });
      })
    );
    return;
  }

  // AI 프록시는 절대 캐시하지 않는다 (온라인 모드 전용)
  if (url.pathname.indexOf('/dg-ai/') === 0) { return; }

  /* 같은 출처 — **네트워크 먼저**, 실패하면 캐시.
   *
   * 전에는 캐시를 먼저 주고 뒤에서 갱신했다(stale-while-revalidate). 그게 실제로
   * 사고를 냈다: 캐시에 있던 옛 core.js 와, 캐시에 없어 새로 받은 auto.js 가 섞여
   * "C.save.auto 가 undefined" 로 죽었다. VERSION 을 안 올린 게 원인이었지만,
   * 코드가 한 판에서 서로 다른 세대로 섞이는 건 애초에 막는 게 맞다.
   * 오프라인에서는 fetch 가 즉시 실패하므로 캐시로 떨어져 그대로 돌아간다. */
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(APP_CACHE).then(function (c) {
        return fetch(req).then(function (res) {
          if (res && res.ok) { c.put(req, res.clone()); }
          return res;
        })['catch'](function () {
          return c.match(req).then(function (hit) {
            return hit || new Response('', { status: 504, statusText: '오프라인' });
          });
        });
      })
    );
  }
});

/** 페이지에서 캐시를 비우거나 버전을 물어볼 수 있게 */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'version' && e.source) {
    e.source.postMessage({ type: 'version', version: VERSION });
  } else if (d.type === 'clear-tiles') {
    caches['delete'](TILE_CACHE);
  }
});
