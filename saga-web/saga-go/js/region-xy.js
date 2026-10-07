/**
 * 서역 권역 — 위경도를 한대(漢代) 서역 나라 아홉의 대표점에 대응시킨다.
 * ---------------------------------------------------------------
 * `js/region-kr.js`(한국)·`js/region-jp.js`(일본)·`js/region-cn.js`(중국 구주)의
 * 넷째 확장이다(2026-09-23, 사용자가 고른 방향 "중국 서역·실크로드" — 사막·
 * 오아시스·서역 상인·유목 세력). 구조를 그대로 베꼈다(대표점 최근접 방식,
 * 경계 다각형 없음). saga-go 만의 실제 GPS 보행 메커니즘용이라 이 판에만 둔다.
 *
 * 아홉 이름은 한서·후한서 서역전에 실제로 나오는 나라 이름이고(지명이라
 * 이름 정책과 무관), 대표 좌표는 그 나라 자리에 해당하는 오늘날 도시다
 * (돈황→둔황, 차사→투르판, 구자→쿠처, 우전→호탄, 소륵→카슈가르, 누란→
 * 롭노르 곁, 오손→이닝, 대완→페르가나, 강거→사마르칸트). 사가천하(saga-realm)
 * 지도의 서역·실크로드 성과 이름이 같지만 코드는 공유하지 않는다(다섯 판 별개).
 *
 * 대륙 판정은 여기서 하지 않는다 — `world.js` `genRegionAt()` 등이 네 파일의
 * `REGIONS` 를 하나로 합쳐 통째로 최근접 탐색한다(36개 대표점). 하서주랑의
 * 둔황은 옹주(시안)보다 돈황 대표점이 훨씬 가까워 자연스럽게 서역으로 잡힌다.
 *
 * `tags` 는 이 나라 생성기(`genchar-xy.js`)의 이름자 성향표에만 쓰인다.
 */
(function (global) {
  'use strict';

  var REGIONS = [
    { code: 'dunhuang', name: '돈황', hanja: '敦煌', country: 'xy', center: { lat: 40.14, lng: 94.66 },
      tags: ['frontier', 'desert'], statBias: { might: 2, wisdom: 2, command: 4 }, color: '#c9a45a' },
    { code: 'loulan',   name: '누란', hanja: '樓蘭', country: 'xy', center: { lat: 40.30, lng: 90.30 },
      tags: ['desert', 'trade'],    statBias: { might: 1, wisdom: 4, command: 1 }, color: '#d8c08a' },
    { code: 'cheshi',   name: '차사', hanja: '車師', country: 'xy', center: { lat: 42.95, lng: 89.19 },
      tags: ['oasis', 'frontier'],  statBias: { might: 4, wisdom: 1, command: 3 }, color: '#b0703f' },
    { code: 'qiuci',    name: '구자', hanja: '龜茲', country: 'xy', center: { lat: 41.72, lng: 82.96 },
      tags: ['art', 'trade'],       statBias: { might: 1, wisdom: 4, command: 3 }, color: '#a0558a' },
    { code: 'yutian',   name: '우전', hanja: '于闐', country: 'xy', center: { lat: 37.11, lng: 79.93 },
      tags: ['oasis', 'art'],       statBias: { might: 0, wisdom: 6, command: 2 }, color: '#5fae9a' },
    { code: 'shule',    name: '소륵', hanja: '疏勒', country: 'xy', center: { lat: 39.47, lng: 75.99 },
      tags: ['trade', 'martial'],   statBias: { might: 3, wisdom: 2, command: 4 }, color: '#8a6a4a' },
    { code: 'wusun',    name: '오손', hanja: '烏孫', country: 'xy', center: { lat: 43.92, lng: 81.32 },
      tags: ['nomad', 'martial'],   statBias: { might: 6, wisdom: 0, command: 3 }, color: '#4a7f5a' },
    { code: 'dayuan',   name: '대완', hanja: '大宛', country: 'xy', center: { lat: 40.39, lng: 71.78 },
      tags: ['nomad', 'oasis'],     statBias: { might: 5, wisdom: 1, command: 2 }, color: '#9f5a3f' },
    { code: 'kangju',   name: '강거', hanja: '康居', country: 'xy', center: { lat: 39.65, lng: 66.96 },
      tags: ['trade', 'nomad'],     statBias: { might: 2, wisdom: 3, command: 4 }, color: '#4a6fa5' }
  ];

  var byCode = {};
  REGIONS.forEach(function (r) { byCode[r.code] = r; });

  /** region-kr.js·region-jp.js·region-cn.js와 같은 계산(최근접 대표점) */
  function regionOf(lat, lng) {
    var best = null, bestD = Infinity, cosLat = Math.cos(lat * Math.PI / 180);
    for (var i = 0; i < REGIONS.length; i++) {
      var r = REGIONS[i];
      var dLat = lat - r.center.lat;
      var dLng = (lng - r.center.lng) * cosLat;
      var d = dLat * dLat + dLng * dLng;
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  global.DG = global.DG || {};
  global.DG.regionXy = {
    REGIONS: REGIONS,
    byCode: function (code) { return byCode[code] || null; },
    regionOf: regionOf
  };
})(window);
