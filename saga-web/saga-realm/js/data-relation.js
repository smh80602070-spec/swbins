/**
 * 사가천하 — 인물 관계 표 (PLAN §5-2)
 * ---------------------------------------------------------------
 * 두 사람 사이의 **결**을 선언형으로 적어 둔다. 사건(`event.js`)이 이 표를 읽고,
 * 표 자체는 판정을 갖지 않는다(`data-item.js`·`DISASTERS` 와 같은 결).
 *
 *   sworn   의형제 — 한 무리로 움직이길 바란다
 *   foe     원수 — 같은 성에 두면 삐걱댄다
 *   master  사제 — a 가 스승, b 가 제자 (순서가 뜻을 가진다)
 *   rival   호적수 — 서로를 겨눈다
 *
 * **이름 정책**: 여기 적힌 것은 `id` 뿐이다. 화면에는 `off.find(id).name`(가명)만 나가고,
 * 관계 문구에는 실명도 실제 사건 이름도 안 쓴다 — 오마주는 관계의 결로만 드러난다.
 * 지역 수비 무장(가상 인물)은 같은 지역 안에서 해시로 한 쌍씩 자동으로 잇는다(`autoPairs`).
 */
(function (global) {
  'use strict';

  var FD = global.DG.forceData;

  var KINDS = {
    sworn:  { name: '의형제', emoji: '🤝' },
    foe:    { name: '원수',   emoji: '🗡️' },
    master: { name: '사제',   emoji: '📖' },
    rival:  { name: '호적수', emoji: '⚔️' }
  };

  /* [a, b, kind] — master 는 a 가 스승 */
  var PAIRS = [
    /* 의형제 */
    ['sg_liubei', 'sg_guanyu', 'sworn'], ['sg_liubei', 'sg_zhangfei', 'sworn'], ['sg_guanyu', 'sg_zhangfei', 'sworn'],
    ['rf_sunce', 'sg_zhouyu', 'sworn'], ['rf_wenchou', 'rf_yanliang', 'sworn'], ['rf_xiahouyuan', 'sg_xiahoudun', 'sworn'],
    ['rf_caohong', 'sg_caocao', 'sworn'], ['rf_mizhu', 'rf_jianyong', 'sworn'], ['jp_nobunaga', 'jp_ieyasu', 'sworn'],
    /* 원수 */
    ['sg_guanyu', 'rf_yanliang', 'foe'], ['sg_lubu', 'sg_zhangfei', 'foe'], ['sg_machao', 'sg_caocao', 'foe'],
    ['sg_machao', 'rf_hansui', 'foe'], ['rf_yuanshao', 'rf_yuanshu', 'foe'], ['rf_lijue', 'rf_guosi', 'foe'],
    ['sg_menghuo', 'sg_zhugeliang', 'foe'], ['kr_yisunsin', 'jp_hideyoshi', 'foe'], ['eu_scipio', 'eu_hannibal', 'foe'],
    ['eu_napoleon', 'eu_nelson', 'foe'], ['jp_yoritomo', 'jp_yoshitsune', 'foe'], ['kr_kimyusin', 'kr_gyebaek', 'foe'],
    /* 사제 (스승 → 제자) */
    ['sg_xunyu', 'rf_guojia', 'master'], ['sg_zhouyu', 'sg_luxun', 'master'], ['kr_sejong', 'kr_jangyeongsil', 'master'],
    ['kr_yihwang', 'kr_yii', 'master'], ['wd_genghis', 'wd_khubilai', 'master'], ['jp_nobunaga', 'jp_hideyoshi', 'master'],
    /* 호적수 */
    ['sg_zhugeliang', 'sg_simayi', 'rival'], ['sg_zhouyu', 'sg_zhugeliang', 'rival'], ['rf_yuanshao', 'sg_caocao', 'rival'],
    ['rf_tianfeng', 'rf_shenpei', 'rival'], ['jp_shingen', 'jp_kenshin', 'rival'], ['wd_saladin', 'eu_richard', 'rival']
  ];

  /** 지역 수비 무장 묶음 — 이 목록 안에서만 짝을 짓는다(다른 지역 사람끼리는 안 잇는다) */
  var REGION_LISTS = ['KOREA_OFFICERS', 'JAPAN_OFFICERS', 'JIAOZHOU_OFFICERS', 'XIYU_OFFICERS', 'NANZHONG_OFFICERS',
    'TIANZHU_OFFICERS', 'MOBEI_OFFICERS', 'LINYI_OFFICERS', 'FUTURE_OFFICERS', 'RUIN_OFFICERS', 'TOMB_OFFICERS', 'TIME_OFFICERS'];
  var AUTO_KINDS = ['sworn', 'foe', 'master', 'rival'];

  function hashOf(s) {
    var h = 0, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return h;
  }

  var cache = null;

  /** 표 전체 — 손으로 적은 짝 + 지역마다 해시로 고른 한 쌍. 결정적이라 세이브가 필요 없다 */
  function all() {
    if (cache) { return cache; }
    var out = [], i, j, list, a, b, n;
    for (i = 0; i < PAIRS.length; i++) { out.push({ a: PAIRS[i][0], b: PAIRS[i][1], kind: PAIRS[i][2], auto: false }); }
    for (i = 0; i < REGION_LISTS.length; i++) {
      list = FD[REGION_LISTS[i]];
      n = list ? list.length : 0;
      if (n < 2) { continue; }
      j = hashOf('rel:' + REGION_LISTS[i]);
      a = j % n;
      b = (a + 1 + ((j >>> 7) % (n - 1))) % n;
      out.push({ a: list[a].id, b: list[b].id, kind: AUTO_KINDS[(j >>> 13) % AUTO_KINDS.length], auto: true });
    }
    cache = out;
    return out;
  }

  global.DG = global.DG || {};
  global.DG.relData = { KINDS: KINDS, PAIRS: PAIRS, REGION_LISTS: REGION_LISTS, all: all };
})(window);
