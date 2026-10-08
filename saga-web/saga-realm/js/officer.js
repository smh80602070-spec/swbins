/**
 * 삼국지 — 무장(武將)
 * ---------------------------------------------------------------
 * 무장 명부는 두 곳에서 온다.
 *
 *   data.js       인물 105 (삼국지 22 · 한국사 26 · 일본사 20 · 세계사 37) — **다섯 판이 나눠 가진 복사본**
 *                 (2026-09-10 — 일본사·세계사는 HEROES 가명화 후속으로 늘었다. 이 숫자는
 *                 앞으로도 또 늘 수 있어 코드에서는 절대 이 수를 못 박지 않는다 — 아래
 *                 mergeRoster()·_test.html 은 전부 DG.data.heroes.length 를 그때그때 잰다)
 *   data-force.js 무장 54 (삼국지 군주와 부하)               — 이 판만의 것
 *
 * `data.js` 는 다섯 벌이 바이트까지 같다. 그래서 **파일을 고치지 않고**,
 * 부팅 때 이 파일이 54인을 `DG.data.heroes` 에 얹는다.
 * 그러면 `data.find` · `hero.stats` · `sprite.portrait` · 도감이 손대지 않고 그대로 돈다.
 * (data.find 는 배열을 그때그때 훑는다 — 미리 만든 색인이 아니라서 얹기만 하면 된다)
 *
 * 삼국지 사람이 아닌 인물(한국사·일본사·세계사, data.js 쪽 83)은 **재야(在野)** 다. 어느 세력에도 없고
 * 도시에 흩어져 있다 — 수색으로 찾아 등용한다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;
  var FD = global.DG.forceData;

  /* ── 명부 합치기 (부팅 때 한 번) ────────────────────────── */

  var merged = false;

  function mergeRoster() {
    if (merged) { return data.heroes.length; }
    /* W-0115 — data.js HEROES 끝에 이 판 장수 194 의 사본 절(`realm: true`)이 붙었다(다섯 판 도감용 — 기질·세력·열전을 도감 꼴로 옮김).
       이 판은 원본 객체를 써야 하므로(FD.find 가 원본을 주고, 기질 command·세력 배치도 원본 기준) 사본을 걷어 내고 아래에서 원본을 얹는다 —
       합친 뒤 명부는 예전과 같다. 배열은 참조가 같아야 하니 제자리에서 지운다. */
    for (var j = data.heroes.length - 1; j >= 0; j--) { if (data.heroes[j].realm) { data.heroes.splice(j, 1); } }
    for (var i = 0; i < FD.OFFICERS.length; i++) {
      var o = FD.OFFICERS[i];
      if (!data.find(o.id)) { data.heroes.push(o); }
    }
    /* 한국 지역 수비 무장(2026-09-03) — 같은 방식으로 얹는다.
       FD.roster()는 안 훑으므로 어느 세력에도 자동 배분되지 않는다 */
    var kr = FD.KOREA_OFFICERS || [];
    for (var k = 0; k < kr.length; k++) {
      if (!data.find(kr[k].id)) { data.heroes.push(kr[k]); }
    }
    /* ④ 백지의 양평 수령 일행(2026-09-20) — 그 시나리오 표에서만 세력에 든다 */
    var bl = FD.BLANK_OFFICERS || [];
    for (var b2 = 0; b2 < bl.length; b2++) {
      if (!data.find(bl[b2].id)) { data.heroes.push(bl[b2]); }
    }
    /* 일본 지역 수비 무장(2026-09-09) — 같은 방식으로 얹는다 */
    var jp = FD.JAPAN_OFFICERS || [];
    for (var jj = 0; jj < jp.length; jj++) {
      if (!data.find(jp[jj].id)) { data.heroes.push(jp[jj]); }
    }
    /* 교주 지역 수비 무장(2026-09-09, 셋째 확장) — 같은 방식으로 얹는다 */
    var jz = FD.JIAOZHOU_OFFICERS || [];
    for (var zz = 0; zz < jz.length; zz++) {
      if (!data.find(jz[zz].id)) { data.heroes.push(jz[zz]); }
    }
    /* 서역 지역 수비 무장(2026-09-09, 넷째 확장) — 같은 방식으로 얹는다 */
    var xy = FD.XIYU_OFFICERS || [];
    for (var xx = 0; xx < xy.length; xx++) {
      if (!data.find(xy[xx].id)) { data.heroes.push(xy[xx]); }
    }
    /* 남중 지역 수비 무장(2026-09-09, 다섯째 확장) — 같은 방식으로 얹는다 */
    var nz = FD.NANZHONG_OFFICERS || [];
    for (var nn = 0; nn < nz.length; nn++) {
      if (!data.find(nz[nn].id)) { data.heroes.push(nz[nn]); }
    }
    /* 천축 지역 수비 무장(2026-09-10, 여섯째 확장) — 같은 방식으로 얹는다 */
    var tz = FD.TIANZHU_OFFICERS || [];
    for (var tt = 0; tt < tz.length; tt++) {
      if (!data.find(tz[tt].id)) { data.heroes.push(tz[tt]); }
    }
    /* 막북 지역 수비 무장(2026-09-10, 일곱째 확장) — 같은 방식으로 얹는다 */
    var mb = FD.MOBEI_OFFICERS || [];
    for (var mm = 0; mm < mb.length; mm++) {
      if (!data.find(mb[mm].id)) { data.heroes.push(mb[mm]); }
    }
    /* 임읍 지역 수비 무장(2026-09-10, 여덟째 확장) — 같은 방식으로 얹는다 */
    var ly = FD.LINYI_OFFICERS || [];
    for (var ll = 0; ll < ly.length; ll++) {
      if (!data.find(ly[ll].id)) { data.heroes.push(ly[ll]); }
    }
    /* 균열 지역 수비 무장(2026-09-10, 아홉째 확장 — 사람이 아니라 괴물) —
       같은 방식으로 얹는다 */
    var fu = FD.FUTURE_OFFICERS || [];
    for (var ff = 0; ff < fu.length; ff++) {
      if (!data.find(fu[ff].id)) { data.heroes.push(fu[ff]); }
    }
    /* 폐허 지역 수비 무장(2026-09-11, 열째 확장 — 균열과 다른 팩의 괴물) —
       같은 방식으로 얹는다 */
    var ru = FD.RUIN_OFFICERS || [];
    for (var rr = 0; rr < ru.length; rr++) {
      if (!data.find(ru[rr].id)) { data.heroes.push(ru[rr]); }
    }
    /* 묘역 지역 수비 무장(2026-09-11, 열한째 확장 — 되살아난 해골 병사) —
       같은 방식으로 얹는다 */
    var tb = FD.TOMB_OFFICERS || [];
    for (var tt2 = 0; tt2 < tb.length; tt2++) {
      if (!data.find(tb[tt2].id)) { data.heroes.push(tb[tt2]); }
    }
    /* 대진 지역 수비 무장(2026-09-22, 열두째 확장) — 같은 방식으로 얹는다 */
    var dj = FD.DAQIN_OFFICERS || [];
    for (var dd = 0; dd < dj.length; dd++) {
      if (!data.find(dj[dd].id)) { data.heroes.push(dj[dd]); }
    }
    /* 선비 지역 수비 무장(2026-09-22, 열셋째 확장) — 같은 방식으로 얹는다 */
    var xb = FD.XIANBEI_OFFICERS || [];
    for (var xxb = 0; xxb < xb.length; xxb++) {
      if (!data.find(xb[xxb].id)) { data.heroes.push(xb[xxb]); }
    }
    /* 남해 지역 수비 무장(2026-09-22, 열넷째 확장) — 같은 방식으로 얹는다 */
    var nh = FD.NANHAI_OFFICERS || [];
    for (var nnh = 0; nnh < nh.length; nnh++) {
      if (!data.find(nh[nnh].id)) { data.heroes.push(nh[nnh]); }
    }
    /* 실크로드 지역 수비 무장(2026-09-23, 열다섯째 확장) — 같은 방식으로 얹는다 */
    var sl = FD.SILK_OFFICERS || [];
    for (var ssl = 0; ssl < sl.length; ssl++) {
      if (!data.find(sl[ssl].id)) { data.heroes.push(sl[ssl]); }
    }
    /* 시간 틈 사람 아홉(§5-12) — 어느 표에도 안 실려 늘 재야로 흩어진다 */
    var tm = FD.TIME_OFFICERS || [];
    for (var ttm = 0; ttm < tm.length; ttm++) {
      if (!data.find(tm[ttm].id)) { data.heroes.push(tm[ttm]); }
    }
    merged = true;
    return data.heroes.length;
  }
  mergeRoster();

  /** 무장 전체 (펫은 빠진다 — data.heroes 는 인물만 담는다) */
  function all() { return data.heroes; }

  function find(id) {
    var h = data.find(id);
    return h && h.stats ? h : null;
  }

  /** 삼국지 사람인가 — 아니면 재야로 흩어 놓는다 */
  function isThree(id) {
    var h = find(id);
    return !!h && h.era === '삼국지';
  }

  /* ── 세이브의 무장 기록 ──────────────────────────────── */

  /**
   * save.rtk.officers[id] = { force, city, loyal, done, hurt, feats }
   *   force  소속 세력 id (null 이면 재야)
   *   city   지금 있는 도시
   *   loyal  충성 0~100 (재야는 뜻이 없다)
   *   done   이 달에 명령을 이미 썼는가
   *   hurt   부상 — 남은 달 수 (0 이면 성하다)
   *   feats  세운 공 (승진·상 판단에 쓴다)
   *   camp   **진(陣)을 치고 있는가** — 포위가 안 떨어져 성 밖에 머무는 진영 id
   *          (null 이면 성에 있다. UI 문구는 "진 치는 중")
   *   journey  **원정 가는 중인가** — 여러 달에 걸쳐 먼 성으로 실시간 이동하는
   *          중인 원정 id (null 이면 성에 있다. 2026-09-04, UI 문구는 "원정 중"
   *          — camp 와 이름이 헷갈리지 않게 필드부터 갈랐다)
   *   item   **지니고 있는 보물 id**(2026-09-09, data-item.js) — 한 번에 하나만
   *          지닌다(장비창 없음, v1). null 이면 맨몸.
   *   dead   **노환으로 별세했는가**(2026-09-10, 아래 "나이" 절). true 면
   *          `atCity`/`freeAt`/`ofForce` 어디에도 안 잡힌다.
   */
  function rec(id) {
    var m = global.DG.rtk.state().officers;
    if (!m[id]) {
      m[id] = { force: null, city: null, loyal: 50, done: false, hurt: 0, feats: 0,
        camp: null, journey: null, item: null, dead: false };
    }
    return m[id];
  }

  /** 보물을 씌운다(이미 있으면 갈아 낀다) — 장비창이 없어 하나만 지닌다 */
  function equip(id, itemId) { rec(id).item = itemId; return rec(id); }

  /** 보물을 벗긴다 */
  function unequip(id) { rec(id).item = null; }

  function has(id) {
    var m = global.DG.rtk.state().officers;
    return Object.prototype.hasOwnProperty.call(m, id);
  }

  /** 이 사람이 어느 세력의 군주인가 — `rec()`(없으면 만든다)이 아니라
   *  기록을 있는 그대로만 본다. 도감 등 아직 세이브에 안 얹힌 인물을
   *  `stats()`로 물어도 새 기록을 만들지 않게 하려는 것이다. */
  function isLordId(id) {
    var m = global.DG.rtk.state().officers, r = m[id];
    if (!r || !r.force) { return false; }
    return lordOf(r.force) === id;
  }

  /** 무장을 도시에 놓는다 (force=null 이면 재야로) */
  function placeAt(id, cityId, forceId) {
    var r = rec(id);
    r.city = cityId;
    r.force = forceId || null;
    if (forceId && !r.loyal) { r.loyal = 50; }
    return r;
  }

  /**
   * 그 도시에 있는, 그 세력 소속 무장.
   * **진을 치고 있거나(`camp`) 원정 가는 중인(`journey`) 사람은 빠진다** —
   * 성에 없는 사람이 내정을 하거나 수비에 서면, 군대를 내보내고도 아무것도
   * 잃지 않은 셈이 된다. (봉급은 그대로 나간다 — `ofForce` 는 진중·원정 중인
   * 사람도 센다)
   */
  function atCity(cityId, forceId) {
    var m = global.DG.rtk.state().officers, out = [], k;
    for (k in m) {
      if (!Object.prototype.hasOwnProperty.call(m, k)) { continue; }
      if (m[k].dead) { continue; }
      if (m[k].camp) { continue; }
      if (m[k].journey) { continue; }
      if (m[k].city !== cityId) { continue; }
      if (forceId === undefined ? false : (m[k].force !== forceId)) { continue; }
      /* forceId 로 null 을 준다는 건 "주인 없는 성의 수비대"를 찾는 것이다
         (한국 지역, 2026-09-03). 그 성에 우연히 흩어져 있을 뿐인 숨은 재야
         (`found:false`)까지 수비군으로 끌려 들어오면 안 된다 — 숨은 사람은
         나서지 않는다. 기존 30성은 force:null 인 적이 없어 이 줄이 지금까지의
         어떤 호출도 안 바꾼다 */
      if (forceId === null && !m[k].found) { continue; }
      var h = find(k);
      if (h) { out.push(h); }
    }
    return sortByPower(out);
  }

  /** 그 도시의 재야 — **찾아낸 사람만** 보인다(수색 전에는 있는 줄도 모른다) */
  function freeAt(cityId, foundOnly) {
    var m = global.DG.rtk.state().officers, out = [], k;
    for (k in m) {
      if (!Object.prototype.hasOwnProperty.call(m, k)) { continue; }
      if (m[k].dead) { continue; }
      if (m[k].force || m[k].city !== cityId) { continue; }
      if (foundOnly && !m[k].found) { continue; }
      var h = find(k);
      if (h) { out.push(h); }
    }
    return sortByPower(out);
  }

  function ofForce(forceId) {
    var m = global.DG.rtk.state().officers, out = [], k;
    for (k in m) {
      if (!Object.prototype.hasOwnProperty.call(m, k)) { continue; }
      if (m[k].dead) { continue; }
      if (m[k].force !== forceId) { continue; }
      var h = find(k);
      if (h) { out.push(h); }
    }
    return sortByPower(out);
  }

  function sortByPower(list) {
    return list.sort(function (a, b) {
      return power(b.id) - power(a.id) || a.name.localeCompare(b.name, 'ko');
    });
  }

  /* ── 능력치 ───────────────────────────────────────────── */

  /**
   * 최종 능력치 — hero.js 한 곳만 쓴다(화면과 판정이 갈라지지 않게).
   * **보물 보정은 여기서 얹지 않는다** — hero.js(다섯 판 공유 파일)가 이미
   * `global.DG.item.statBonus(id)` 라는 전용 자리를 갖고 있다(장비 % · flat
   * 층, `gearOf()`). `data-item.js`가 그 자리에 이 판의 "보물"을 꽂았다 —
   * 계산이 두 곳으로 갈라지면 화면과 판정이 어긋난다는 hero.js 머리말 경고를
   * 그대로 따른 것.
   */
  function stats(id) {
    var s = global.DG.hero.stats(id);
    if (isLordId(id) && !lordAgingOn()) { return s; }   // 군주는 나이 축 전체에서 빠진다(늙지도 죽지도 않는다) — 손잡이 rtk.lordAging 을 켜면 든다(§5-8)
    var mul = agingMul(age(id));
    var bonus = ambBonusOf(id);       // 야망을 이룬 사람은 능력이 영구히 +2(PLAN §5-1) — 이 함수 한 곳에서만 얹는다
    if (mul >= 1 && !bonus) { return s; }
    return {
      might: Math.max(1, Math.round(s.might * mul) + bonus),
      wisdom: Math.max(1, Math.round(s.wisdom * mul) + bonus),
      command: Math.max(1, Math.round(s.command * mul) + bonus)
    };
  }

  function power(id) {
    var s = stats(id);
    return s.might + s.wisdom + s.command;
  }

  /** 이 무장이 그 일을 얼마나 잘하는가 (0~1 남짓) — 내정·전투가 같이 쓴다 */
  function skill(id, statKey) {
    var s = stats(id);
    return (s[statKey] || 0) / 100;
  }

  /* ── 나이 · 노쇠 · 죽음 (2026-09-10, README "다음에 채울 것" 마지막 항목) ──
   * 원작에서는 무장이 늙고 죽는다. 실제 생년을 조사해 넣는 대신(명부
   * 231인 다수가 이 판이 새로 지어낸 가명 인물이라 애초에 "실제 생년"이
   * 없다) id 문자열을 해시해 **결정적** 생년을 만든다 — `realm3d.js`의
   * `hashOf`(재야 결정적 산포에 쓰는 것)와 같은 결이다. 세이브에 생년을
   * 따로 적지 않아도 늘 같은 값이 나오고, 시나리오(194/200/208)를 바꿔도
   * 그 사람의 생년 자체는 안 바뀐다 — 다만 시작 연도가 늦을수록 다들
   * 그만큼 나이 들어 시작한다(자연스럽다).
   *
   * `hero.js`(다섯 판 공유 파일)의 능력치 계산은 한 줄도 안 건드렸다 —
   * 노쇠 배율은 **`stats()` 한 곳**(위)에서 그 결과 위에 곱해진다. 무장
   * 성장(레벨·관직)이 같은 자리를 거치는 것과 같은 이유다.
   */
  function birthHash(id) {
    var s = String(id || ''), h = 0, i;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return h;
  }
  /** 130~178년 사이로 흩는다 — 가장 이른 시나리오(194년)에도 누구나
   *  최소 16세는 되도록 잡은 바닥이다. */
  function birthYear(id) { return 130 + (birthHash(id) % 49); }
  function age(id) {
    return Math.max(0, global.DG.rtk.state().year - birthYear(id));
  }
  /** 60세부터 능력치가 서서히 준다 — 90세(30년 초과)에서 0.55배로 바닥진다 */
  function agingMul(a) {
    if (a <= 60) { return 1; }
    return 1 - Math.min(a - 60, 30) * 0.015;
  }
  /** 65세부터 자연사할 확률이 생긴다 — 연간 위험률을 12개월로 나눠
   *  달마다 굴린다(`rollAging` 이 부른다). */
  function deathChanceMonthly(a) {
    if (a < 65) { return 0; }
    var annual = core.clamp((a - 65) * 0.018, 0, 0.6);
    return 1 - Math.pow(1 - annual, 1 / 12);
  }
  function isDead(id) { return !!rec(id).dead; }

  /* ── 군주 계승 (PLAN §5-8) ───────────────────────────────
   * 군주는 시나리오 표(`FD.force(f).lord`)에 적혀 있다. 표는 시나리오 정의라 바꾸지 않고, 이어받은 군주는
   * `save.rtk.forces[f].lord` 에 얹는다 — 군주를 읽는 곳은 전부 `lordOf()` 한 곳을 거친다(표를 직접 읽으면
   * 계승 뒤에도 옛 군주가 군주로 보인다). 후계 지정은 `forces[f].heir`. 옛 세이브는 두 칸이 없으면 표·자동 후계.
   * 손잡이 `rtk.lordAging`(기본 0)이 꺼져 있으면 아무것도 안 바뀐다(군주는 늙지도 죽지도 않는다). */
  function lordAgingOn() { return core.tuned('rtk.lordAging', 0) ? true : false; }

  /** 이 세력의 지금 군주 — 계승했으면 세이브 쪽, 아니면 시나리오 표 */
  function lordOf(forceId) {
    if (!forceId) { return null; }
    var fs = global.DG.rtk.state().forces[forceId];
    if (fs && fs.lord) { return fs.lord; }
    var f = FD.force(forceId);
    return f ? f.lord : null;
  }

  /** 군주 자리를 이을 수 있는 사람들 — 이 세력 소속의 산 사람(포로·재야는 force 가 비어 절로 빠진다) */
  function heirPool(forceId, exceptId) {
    var st = global.DG.rtk.state(), out = [], k;
    for (k in st.officers) {
      if (!Object.prototype.hasOwnProperty.call(st.officers, k) || k === exceptId) { continue; }
      var r = st.officers[k];
      if (r.force === forceId && !r.dead && find(k)) { out.push(k); }
    }
    return out;
  }

  function govCount(id) {
    var cs = global.DG.rtk.state().cities, n = 0, k;
    for (k in cs) { if (Object.prototype.hasOwnProperty.call(cs, k) && cs[k].gov === id) { n++; } }
    return n;
  }

  /** 자동 후계 — 충성 최고, 같으면 태수 자리 많은 사람, 그다음 공. 괴물(균열 수비대)은 사람이 없을 때만 */
  function autoHeir(pool) {
    return pool.slice().sort(function (a, b) {
      var ma = find(a).monster ? 1 : 0, mb = find(b).monster ? 1 : 0;
      return ma - mb || rec(b).loyal - rec(a).loyal || govCount(b) - govCount(a) ||
        (rec(b).feats || 0) - (rec(a).feats || 0) || (a < b ? -1 : a > b ? 1 : 0);
    })[0] || null;
  }

  /** 지금 후계가 될 사람(지정했고 아직 유효하면 그 사람, 아니면 자동) — 이을 사람이 없으면 null */
  function heirOf(forceId) {
    var fs = global.DG.rtk.state().forces[forceId], pool = heirPool(forceId, lordOf(forceId));
    if (!pool.length) { return null; }
    if (fs && fs.heir && pool.indexOf(fs.heir) >= 0) { return fs.heir; }
    return autoHeir(pool);
  }

  /** 후계 지정 — 같은 사람을 또 고르거나 id 가 비면 지정을 푼다(그러면 자동) */
  function setHeir(forceId, id) {
    var st = global.DG.rtk.state(), fs = st.forces[forceId], r = id ? st.officers[id] : null;
    if (!fs) { return { ok: false, why: '그런 세력이 없습니다' }; }
    if (!id || id === fs.heir) { fs.heir = null; return { ok: true, heir: null }; }
    if (!r || r.force !== forceId || r.dead) { return { ok: false, why: '우리 세력 무장이 아닙니다' }; }
    if (lordOf(forceId) === id) { return { ok: false, why: '군주 본인입니다' }; }
    fs.heir = id;
    return { ok: true, heir: id };
  }

  /**
   * 군주가 죽었다 — 후계가 군주가 되고 나머지는 흔들린다(충성 -10~-20, 특성 충직은 0·야심은 -25 에
   * 3달간 이탈 판정 두 배 — `diplo.checkDefection` 이 `unrest` 를 읽는다). AI 도 같은 함수(자동 후계).
   * 죽은 군주의 `dead` 표시·태수 정리는 부른 쪽(`rollAging`)이 한다.
   */
  function succeed(forceId, oldId, oldAge) {
    var R = global.DG.rtk, st = R.state(), fs = st.forces[forceId], heir = heirOf(forceId);
    if (!fs || !heir) { return null; }
    var pool = heirPool(forceId, oldId);
    fs.lord = heir; fs.heir = null;
    rec(heir).loyal = 100;
    pool.forEach(function (id) {
      if (id === heir) { return; }
      var ks = traitsOf(id).map(function (t) { return t.k; }), d = 10 + Math.floor(Math.random() * 11);
      if (ks.indexOf('loyal') >= 0) { d = 0; }
      else if (ks.indexOf('ambitious') >= 0) { d = 25; rec(id).unrest = 3; }
      if (d) { addLoyal(id, -d); }
    });
    core.log('⚰️ ' + find(oldId).name + ' 별세(향년 ' + oldAge + '세) — ' + find(heir).name + ' 이(가) ' +
      R.forceName(forceId) + ' 군주로 즉위했다', 'warn');
    if (forceId === R.me()) { core.emit('toast', '⚰️ ' + find(oldId).name + ' 별세, ' + find(heir).name + ' 즉위'); }
    core.emit('rtk:succession', { force: forceId, from: oldId, to: heir });
    return heir;
  }

  /**
   * 달마다 한 번 — 노환으로 별세하는 사람이 있는지 본다. `rtk.js`
   * `settleMonth()` 가 재해·이간과 같은 자리에서 부른다.
   * **군주는 기본으로 빠진다**(손잡이 `rtk.lordAging` 이 0 일 때 — 승계 체계를 손잡이 뒤에 둔 것이다).
   * 손잡이를 켜면 군주도 부하의 절반 확률로 굴리고, 죽으면 `succeed()` 가 후계를 세운다(PLAN §5-8).
   * 태수 자리(city.gov)를 비우는 것까지가 이 함수의 몫이다(`diplo.js`
   * `checkDefection` 이 이간으로 사람을 잃을 때 하는 정리와 같다).
   */
  function rollAging() {
    var R = global.DG.rtk, st = R.state(), k, gone = [], lordForce = {}, fk;
    for (fk in st.forces) {
      if (Object.prototype.hasOwnProperty.call(st.forces, fk)) { lordForce[lordOf(fk)] = fk; }   // 군주 id → 그 군주가 이끄는 세력
    }
    for (k in st.officers) {
      if (!Object.prototype.hasOwnProperty.call(st.officers, k)) { continue; }
      var r = st.officers[k];
      if (r.dead) { continue; }
      var a = age(k);
      if (a < 65) { continue; }
      var lordOfF = lordForce[k] || null, isLordNow = !!lordOfF, lordMul = 1;
      if (isLordNow) {
        /* 손잡이(rtk.lordAging)가 꺼져 있으면 옛 그대로 — 제 세력에 있는 군주만 빠진다(사로잡힌 군주는 예전에도 보통 사람처럼 굴렸다).
           켜면 부하의 절반 확률로 굴리되, 이을 사람이 하나도 없으면 안 죽는다(세력이 그 자리에서 끝나지 않게 — PLAN §5-8) */
        if (!lordAgingOn()) {
          if (r.force === lordOfF) { continue; }
          isLordNow = false;
        } else {
          if (!heirPool(lordOfF, k).length) { continue; }
          lordMul = 0.5;
        }
      }
      if (Math.random() >= deathChanceMonthly(a) * core.tuned('rtk.agingDeathMul', 1) * lordMul) { continue; }
      r.dead = true;
      if (isLordNow) {
        var cs = st.cities, ck;
        for (ck in cs) { if (Object.prototype.hasOwnProperty.call(cs, ck) && cs[ck].gov === k) { cs[ck].gov = null; } }
        succeed(lordOfF, k, a);
        gone.push(k);
        continue;
      }
      var c = r.city ? R.city(r.city) : null;
      if (c && c.gov === k) { c.gov = null; }
      core.log('⚰️ ' + find(k).name + ' 이(가) 노환으로 별세했다(향년 ' + a + '세)', 'warn');
      if (r.force && r.force === R.me()) {
        core.emit('toast', '⚰️ ' + find(k).name + ' 이(가) 별세했다');
      }
      gone.push(k);
    }
    return gone;
  }

  /* ── 성장 (經驗과 昇進) ────────────────────────────────
   * 능력치는 `hero.stats(id)` **한 곳**에서 나온다. 여기서 하는 일은
   * 그 함수가 읽는 `save.heroes[id]` 의 lv·rank 를 올려 주는 것뿐이다 —
   * 성장한 무장이 실제로 더 세게 싸우는 것은 `war.armyPower` 가 같은
   * `off.stats()` 를 읽기 때문이지, 전투에 따로 붙인 보정이 아니다.
   *
   * **`hero.gainExp` 를 쓰지 않는다.** 그쪽은 `save.dex.heroes[id]`(도감에서
   * 뽑은 인물)만 올려 주는데, 이 판에는 뽑기도 도감 획득도 없어 언제나 0 을 준다.
   * 같은 까닭으로 승진도 `hero.rankUp`(중복 인물 소모)이 아니라 **공(feats)** 으로 한다.
   */

  /* 무엇을 하면 얼마나 느는가. 120개월을 굴리면 무장이 Lv.8~12 언저리에 선다 —
     ×1.15~1.24 다. 이보다 후하게 주면 늦게 시작한 세력이 영영 못 따라잡는다 */
  var EXP = {
    order: 4,     // 내정 명령 하나
    march: 12,    // 출진에 따라나섰다
    siege: 8,     // 진을 치고 한 달을 더 버텼다
    win: 20,      // 성을 떨어뜨렸다
    duel: 15,     // 일기토에서 이겼다
    gov: 2        // 태수로 한 달을 앉아 있었다
  };

  function grow(id) {
    var m = core.save.heroes;
    if (!m[id]) { m[id] = { lv: 1, exp: 0, rank: 0 }; }
    return m[id];
  }

  /** 경험을 준다 — 레벨이 오르면 hero.stats 가 그만큼 곱해진다 */
  function gainExp(id, amount) {
    var H = global.DG.hero;
    amount = Math.max(0, Math.round(amount || 0));
    if (!amount || !find(id)) { return { gained: 0, levels: 0 }; }
    var g = grow(id);
    if (g.lv >= H.MAX_LV) { g.exp = 0; return { gained: 0, levels: 0 }; }
    g.exp += amount;
    var levels = 0, need = H.expNeed(g.lv);
    while (g.exp >= need && g.lv < H.MAX_LV) {
      g.exp -= need; g.lv += 1; levels++;
      need = H.expNeed(g.lv);
    }
    if (g.lv >= H.MAX_LV) { g.exp = 0; }
    if (levels) {
      var r = rec(id);
      /* 남의 무장이 크는 것까지 알릴 것은 없다 — 기록이 그것으로 덮인다 */
      if (r.force && r.force === global.DG.rtk.me()) {
        core.log('📈 ' + find(id).name + ' 이(가) Lv.' + g.lv + ' 이 되었다', 'level');
      }
      core.emit('rtk:grew', { id: id, lv: g.lv, levels: levels });
    }
    return { gained: amount, levels: levels };
  }

  /** 여럿에게 한꺼번에 */
  function gainExpAll(ids, amount) {
    var n = 0;
    for (var i = 0; i < (ids || []).length; i++) { n += gainExp(ids[i], amount).levels; }
    return n;
  }

  /** 승진에 드는 공과 금 — 올라갈수록 가파르다 */
  function promoteCost(rank) {
    return { feats: 20 + rank * 20, gold: 300 + rank * 300 };
  }

  var RANK_KOR = ['무관(無官)', '교위(校尉)', '중랑장(中郞將)', '장군(將軍)',
                  '대장군(大將軍)', '도독(都督)'];

  function rankName(id) { return RANK_KOR[grow(id).rank] || RANK_KOR[0]; }

  function promoteCheck(id) {
    var H = global.DG.hero, R = global.DG.rtk;
    var h = find(id);
    if (!h) { return { ok: false, why: '없는 무장입니다' }; }
    var r = rec(id);
    if (!r.force) { return { ok: false, why: '재야입니다' }; }
    var g = grow(id);
    if (g.rank >= H.MAX_RANK) { return { ok: false, why: '더 올릴 자리가 없습니다' }; }
    var c = promoteCost(g.rank);
    var f = R.force(r.force);
    if (r.feats < c.feats) { return { ok: false, why: '공이 모자랍니다 (' + r.feats + '/' + c.feats + ')', cost: c }; }
    if (!f || f.gold < c.gold) { return { ok: false, why: '금이 모자랍니다 (' + c.gold + ')', cost: c }; }
    return { ok: true, cost: c };
  }

  /**
   * 승진 — 쌓인 공과 금으로 관직을 올린다.
   * 능력치가 오르고(hero.growMul 의 rank 축), **충성이 크게 오른다** —
   * 원작에서 관직이 사람을 붙들어 두는 힘이 그것이다.
   */
  function promote(id) {
    var chk = promoteCheck(id);
    if (!chk.ok) { return chk; }
    var r = rec(id), g = grow(id);
    var f = global.DG.rtk.force(r.force);
    r.feats -= chk.cost.feats;
    f.gold -= chk.cost.gold;
    g.rank += 1;
    addLoyal(id, 12);
    core.log('✨ ' + find(id).name + ' 을(를) ' + rankName(id) + ' 로 올렸다 — 충성 ' +
      rec(id).loyal, 'good');
    core.emit('rtk:promote', { id: id, rank: g.rank });
    core.emit('changed');
    core.persist();
    return { ok: true, rank: g.rank, name: rankName(id), loyal: rec(id).loyal };
  }

  /* ── 충성 ─────────────────────────────────────────────── */

  var STAT_KOR = { might: '무력', wisdom: '지력', command: '통솔' };

  function loyalOf(id) { return rec(id).loyal; }

  function addLoyal(id, n) {
    var r = rec(id);
    r.loyal = core.clamp(Math.round(r.loyal + n), 0, 100);
    return r.loyal;
  }

  /**
   * 군주와의 인연 — 충성의 바닥값이다.
   * 같은 세력의 군주와 **성향(trait)** 이 같으면 잘 붙어 있고, 등급이 높을수록 콧대가 세다.
   * 이 값이 없으면 강한 무장일수록 잘 붙어 있게 되어 이탈이 영영 안 난다.
   */
  function baseLoyal(id, forceId) {
    var h = find(id);
    var f = FD.force(forceId);
    if (!h || !f) { return 50; }
    var lord = find(lordOf(forceId));
    var v = 52;
    if (lord && lord.trait === h.trait) { v += Math.round(12 * traitMul(id, 'bond')); }   // 충성은 정수 — 충직 18 · 야심 8
    v -= (h.rarity - 3) * 6;                       // 귀한 사람일수록 붙들기 어렵다
    if (h.era !== '삼국지') { v -= 4; }             // 재야에서 온 이방인
    /* ⑤ 균열의 왕(PLAN §5-4) — 그 세력의 era 가 아닌 사람은 "이질" 이라 마음이 덜 붙는다.
       등용 때와 매달 끌려가는 목표(`driftLoyalty`)가 둘 다 이 함수라 한 곳에서 걸린다 */
    if (f.alien && h.era !== f.alien) { v -= 10; }
    return core.clamp(v, 25, 85);
  }

  /* ── 특성 · 야망 (PLAN §5-1) ────────────────────────────
   * **특성 둘**은 id 해시로 정해지는 결정값이라 세이브가 필요 없다(`birthHash` 와 같은 요령, 소금만 다르다). 능력치가 아니라
   * **기존 판정의 계수**만 바꾼다 — 축(axis)마다 곱한다: bribed(매수당함)·discorded(이간 낙폭)·plot(계략을 거는 쪽)·rewardUp(상 받은 충성 상승)·
   * bond(군주와 같은 결의 인연 끌림)·duelRate(일기토 발생)·duelMight(일기토 무력)·prize(학당 상금). 한 인물의 곱은 0.7~1.5 로 자른다.
   * 반대 특성(용맹↔신중·탐욕↔청렴·호전↔온화·충직↔야심·탐욕↔의리)은 한 사람에게 같이 안 붙는다.
   * ※ PLAN 초안의 "충직 인연 2배"·"호전 35%→55%" 는 같은 절의 "계수 0.7~1.5" 와 어긋나서 상한 1.5 로 맞췄다.
   * **야망 하나**는 `save.rtk.officers[id].amb = {k, prog, done, failMonths, age}` — 처음 볼 때 해시로 정하고 세이브에 남긴다.
   * 군주는 야망이 없다. 달성하면 충성 +20·능력 +2(영구), 서른여섯 달이 지나도 못 이룬 채 열두 달이 더 가면(좌절) 충성이 달마다 -3, 이간에 ×1.5. */
  var TRAITS = [
    { k: 'brave',     name: '용맹', emoji: '🦁', desc: '일기토에서 무력이 조금 더 세게 먹힌다',            mul: { duelMight: 1.08 } },
    { k: 'careful',   name: '신중', emoji: '🛡️', desc: '일기토를 잘 걸지 않는다',                          mul: { duelRate: 0.7 } },
    { k: 'greedy',    name: '탐욕', emoji: '💰', desc: '매수에 잘 넘어가고, 상을 받으면 충성이 더 오른다',  mul: { bribed: 1.4, rewardUp: 1.5 } },
    { k: 'clean',     name: '청렴', emoji: '🧼', desc: '매수에 잘 안 넘어간다',                            mul: { bribed: 0.7, rewardUp: 0.85 } },
    { k: 'ambitious', name: '야심', emoji: '🔥', desc: '군주와의 인연에 덜 끌리고 이간에 약하다',          mul: { bond: 0.7, discorded: 1.2 } },
    { k: 'loyal',     name: '충직', emoji: '🎗️', desc: '군주와의 인연에 크게 끌린다',                      mul: { bond: 1.5 } },
    { k: 'studious',  name: '학구', emoji: '📚', desc: '우리 편에 있으면 학당 상금이 늘어난다',            mul: { prize: 1.3 } },
    { k: 'warlike',   name: '호전', emoji: '⚔️', desc: '일기토를 잘 건다',                                mul: { duelRate: 1.5 } },
    { k: 'gentle',    name: '온화', emoji: '🕊️', desc: '일기토를 덜 걸고 이간에 덜 흔들린다',              mul: { duelRate: 0.8, discorded: 0.85 } },
    { k: 'sly',       name: '교활', emoji: '🦊', desc: '계략을 걸면 더 잘 통한다',                        mul: { plot: 1.15 } },
    { k: 'righteous', name: '의리', emoji: '🤝', desc: '돈으로 마음을 사기 어렵고 이간에 덜 흔들린다',    mul: { rewardUp: 0.7, discorded: 0.8 } },
    { k: 'cold',      name: '냉혈', emoji: '🧊', desc: '계략에 능하고 이간에 잘 안 흔들린다',              mul: { plot: 1.1, discorded: 0.7 } }
  ];
  var TRAIT_OPPOSE = {
    brave: ['careful'], careful: ['brave'], greedy: ['clean', 'righteous'], clean: ['greedy'], righteous: ['greedy'],
    warlike: ['gentle'], gentle: ['warlike'], loyal: ['ambitious'], ambitious: ['loyal']
  };

  /** 이 사람의 특성 둘 (결정적 — 같은 id 는 늘 같다) */
  function traitsOf(id) {
    var n = TRAITS.length, first = TRAITS[birthHash('t1:' + id) % n], j = birthHash('t2:' + id) % n, i;
    for (i = 0; i < n; i++) {
      var c = TRAITS[(j + i) % n];
      if (c.k !== first.k && (TRAIT_OPPOSE[first.k] || []).indexOf(c.k) < 0) { return [first, c]; }
    }
    return [first];
  }

  /** 판정 축 하나에 대한 이 사람의 계수(0.7~1.5). 특성이 그 축을 안 건드리면 1 */
  function traitMul(id, axis) {
    var ts = traitsOf(id), m = 1, i;
    for (i = 0; i < ts.length; i++) { if (ts[i].mul[axis]) { m *= ts[i].mul[axis]; } }
    return core.clamp(m, 0.7, 1.5);
  }

  var AMBITIONS = [
    { k: 'governor', name: '태수', emoji: '🏯', need: 1,  text: '성 하나를 다스린다' },
    { k: 'hometown', name: '고향', emoji: '🏠', need: 1,  text: '고향 성을 우리 깃발 아래 둔다' },
    { k: 'rival',    name: '숙적', emoji: '🗡️', need: 1,  text: '자기보다 센 적을 일기토로 꺾는다' },
    { k: 'wealth',   name: '부귀', emoji: '💎', need: 1,  text: '보물 하나를 손에 넣는다' },
    { k: 'fame',     name: '명성', emoji: '🏆', need: 3,  text: '일기토에서 세 번 이긴다' },
    { k: 'learning', name: '학문', emoji: '📖', need: 5,  text: '경험을 쌓아 Lv.5 에 오른다' }
  ];
  var AMB_GRACE = 36, AMB_FRUSTRATED = 12;

  function ambDef(k) {
    for (var i = 0; i < AMBITIONS.length; i++) { if (AMBITIONS[i].k === k) { return AMBITIONS[i]; } }
    return null;
  }

  /** 이 사람의 야망 — 없으면 처음 볼 때 해시로 정해 세이브에 남긴다. 군주는 null */
  function ambOf(id) {
    if (isLordId(id)) { return null; }
    var r = rec(id);
    if (!r.amb) {
      var def = AMBITIONS[birthHash('a:' + id) % AMBITIONS.length];
      var a = { k: def.k, prog: 0, done: false, failMonths: 0, age: 0 };
      if (def.k === 'hometown') {
        var CD = global.DG.cityData, cs = CD.CITIES.filter(function (c) { return !c.garrison; });
        a.target = cs[birthHash('h:' + id) % cs.length].id;
      }
      r.amb = a;
    }
    return r.amb;
  }

  function ambBonusOf(id) {
    var r = global.DG.rtk.state().officers[id];
    return r && r.amb && r.amb.done ? 2 : 0;
  }

  /** 좌절 중인가 — 못 이룬 채 서른여섯 달 + 열두 달이 지났다 */
  function frustrated(id) {
    var r = global.DG.rtk.state().officers[id], a = r && r.amb;
    return !!a && !a.done && a.failMonths >= AMB_FRUSTRATED;
  }

  /** 화면용 — { k, name, emoji, text, prog, need, done, frustrated, target? } (군주·기록 없음이면 null) */
  function ambView(id) {
    var a = ambOf(id);
    if (!a) { return null; }
    var d = ambDef(a.k), text = d.text;
    if (a.k === 'hometown' && a.target) {
      var cd = global.DG.cityData.find(a.target);
      text = '고향 ' + (cd ? cd.name : '') + ' 을(를) 우리 깃발 아래 둔다';
    }
    return { k: a.k, name: d.name, emoji: d.emoji, text: text, prog: Math.min(d.need, a.prog), need: d.need,
             done: a.done, frustrated: frustrated(id) };
  }

  /** 일기토가 끝났다 — 이긴 쪽의 명성·숙적 야망이 한 걸음 나아간다 */
  function noteDuel(winnerId, loserId) {
    var r = global.DG.rtk.state().officers[winnerId];
    if (!r || !r.force) { return; }
    var a = ambOf(winnerId);
    if (!a || a.done) { return; }
    if (a.k === 'fame') { a.prog += 1; }
    else if (a.k === 'rival' && stats(loserId).might >= stats(winnerId).might) { a.prog = 1; }
  }

  function awardAmbition(id, a) {
    var st = global.DG.rtk.state(), d = ambDef(a.k);
    a.done = true;
    addLoyal(id, 20);
    if (st.officers[id] && st.officers[id].force === st.me) {
      core.log('🎯 ' + find(id).name + ' 이(가) 야망을 이루었다 — ' + d.emoji + ' ' + d.name + ' (충성 +20 · 능력 +2)', 'good');
      core.emit('toast', '🎯 ' + find(id).name + ' 의 야망 「' + d.name + '」 달성');
    }
    core.emit('rtk:ambition', { id: id, kind: a.k, mine: st.officers[id].force === st.me });
  }

  /** 달마다 부른다 — 진행을 세고, 이룬 야망을 지급하고, 좌절이면 충성을 깎는다 */
  function tickAmbitions() {
    var st = global.DG.rtk.state(), k, out = [];
    for (k in st.officers) {
      if (!Object.prototype.hasOwnProperty.call(st.officers, k)) { continue; }
      var r = st.officers[k];
      if (!r.force || r.dead) { continue; }
      var a = ambOf(k);
      if (!a) { continue; }
      var d = ambDef(a.k);
      a.age += 1;
      if (!a.done) {
        if (a.k === 'governor') {
          a.prog = 0;
          for (var ck in st.cities) {
            if (Object.prototype.hasOwnProperty.call(st.cities, ck) && st.cities[ck].gov === k) { a.prog = 1; break; }
          }
        } else if (a.k === 'hometown') {
          a.prog = st.cities[a.target] && st.cities[a.target].force === r.force ? 1 : 0;
        } else if (a.k === 'wealth') {
          a.prog = r.item ? 1 : 0;
        } else if (a.k === 'learning') {
          a.prog = Math.min(d.need, grow(k).lv);
        }
        if (a.prog >= d.need) { awardAmbition(k, a); out.push(k); continue; }
        if (a.age > AMB_GRACE) {
          a.failMonths += 1;
          if (a.failMonths >= AMB_FRUSTRATED) { addLoyal(k, -3); }
        }
      }
    }
    return out;
  }

  global.DG = global.DG || {};
  global.DG.off = {
    STAT_KOR: STAT_KOR, EXP: EXP, RANK_KOR: RANK_KOR,
    grow: grow, gainExp: gainExp, gainExpAll: gainExpAll,
    promoteCost: promoteCost, promoteCheck: promoteCheck, promote: promote,
    rankName: rankName,
    mergeRoster: mergeRoster, all: all, find: find, isThree: isThree,
    rec: rec, has: has, placeAt: placeAt,
    atCity: atCity, freeAt: freeAt, ofForce: ofForce, sortByPower: sortByPower,
    stats: stats, power: power, skill: skill, equip: equip, unequip: unequip,
    loyalOf: loyalOf, addLoyal: addLoyal, baseLoyal: baseLoyal,
    birthYear: birthYear, age: age, agingMul: agingMul,
    deathChanceMonthly: deathChanceMonthly, isDead: isDead, rollAging: rollAging,
    isLordId: isLordId, lordOf: lordOf, lordAgingOn: lordAgingOn, heirOf: heirOf, heirPool: heirPool, setHeir: setHeir, succeed: succeed,
    TRAITS: TRAITS, AMBITIONS: AMBITIONS, traitsOf: traitsOf, traitMul: traitMul,
    ambOf: ambOf, ambView: ambView, frustrated: frustrated, noteDuel: noteDuel, tickAmbitions: tickAmbitions
  };
})(window);
