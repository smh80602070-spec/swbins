// 사가의숲 확인 닫기 ①(W-0090) — 곤충·땅 공사·택배·마을(이름·깃발·평가)·행사·날씨·주민을 실제 판에서 한 번씩 해 본다.
//   node pw-fs-close1.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 준비는 pw-fs-sheet 와 같다(새 계정 → title-continue → 마을). 계절·때·날씨·행사는 손잡이 time.season·time.phase·time.weather·time.event 로 붙든다.
// 화면 단추(data-act — saga-forest/js/ui.js 에서 찾음): 가방 시트의 전방 `v-buytool`(잠자리채·개토패) · 택배 시트 `v-parcel`
//   · 가방 시트 `v-gift`(곁에 주민이 있을 때) · 마을 시트 `v-flag` · 상호작용은 실제 ␣ 키(벌레 → 주민 → 사물 순, village.interact).
//   마을 이름 단추(v-townname)는 prompt 를 띄워서 setName 을 바로 부른다.
// Math.random 은 진단과 같은 씨앗 mulberry32(20260824). **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-fs-close1.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-forest');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });

async function boot(fresh) {
  await page.goto(r.url('index.html')); await sleep(1500);
  if (fresh) { await ev(() => { DG.account.create('확인'); }); }
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3500);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }
  await ev(() => { var h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });
}
const tune = (k, v) => ev((a) => { DG.core.setTune(a.k, a.v); }, { k, v });
const sheet = async (name) => { await ev((n) => { DG.ui.openSheet(n); }, name); await sleep(500); };
const closeSheet = async () => { await ev(() => { if (DG.ui.closeSheet) { DG.ui.closeSheet(); } }); await sleep(250); };
const domClick = (sel) => ev((q) => { var b = document.querySelector(q); if (!b) { return false; } b.click(); return true; }, sel);
const space = async () => { await page.keyboard.press('Space'); await sleep(500); };

try {
  await boot(true);
  await ev(() => { DG.core.save.player.gold = 100000; });

  /* fs.data-village-3 — 같은 날 같은 하늘, 겨울엔 비 대신 눈, 하늘 있는 행사날은 그 하늘, 비 오는 날만 나오는 벌레(달팽이) */
  const w = await ev(() => {
    var VD = DG.villageData, d = new Date(2026, 6, 20), out = { same: VD.weatherOf(d).key === VD.weatherOf(new Date(2026, 6, 20)).key };
    var wint = [], i; for (i = 1; i <= 60; i++) { wint.push(VD.weatherOf(new Date(2026, 11, 1 + (i % 28)), 'winter').key); }
    out.winterRain = wint.filter((k) => k === 'rain').length; out.winterSnow = wint.filter((k) => k === 'snow').length;
    var skyEv = VD.EVENTS.filter((e) => e.sky); out.sky = skyEv.map((e) => e.key + ':' + VD.weatherOf(new Date(2026, e.m - 1, e.d)).key + '=' + e.sky);
    out.skyOk = skyEv.length > 0 && skyEv.every((e) => VD.weatherOf(new Date(2026, e.m - 1, e.d)).key === e.sky);
    return out;
  });
  await tune('time.season', 'summer'); await tune('time.phase', 'day'); await tune('time.weather', 'rain');
  const rainPool = await ev(() => DG.bug.poolNow().map((x) => x.key));
  await tune('time.weather', 'clear');
  const dryPool = await ev(() => DG.bug.poolNow().map((x) => x.key));
  check('fs.data-village-3 날씨 — 같은 날은 같은 하늘, 겨울은 비 대신 눈, 하늘 있는 행사날은 그 하늘, 달팽이는 비 오는 날만',
    w.same && w.winterRain === 0 && w.winterSnow > 0 && w.skyOk && rainPool.indexOf('snail') >= 0 && dryPool.indexOf('snail') < 0, JSON.stringify(Object.assign({}, w, { rainSnail: rainPool.indexOf('snail') >= 0, drySnail: dryPool.indexOf('snail') >= 0 })));

  /* fs.bug — 채 없이 ␣ 는 못 잡고, 전방 「산다」 단추로 잠자리채를 산 뒤 ␣ 로 잡으면 가방·도감에 든다 · 여름밤엔 반딧불이, 겨울밤엔 없다 */
  const spawn = () => ev(() => { var pl = DG.village.raw().player; DG.bug.reset && DG.bug.reset(); return !!DG.bug._spawnAt('dragon', pl.x + 6, pl.y); });
  const b0 = await ev(() => ({ net: DG.bug.hasNet(), bag: DG.village.bagCount('dragon') }));
  await spawn(); await space();
  const b1 = await ev(() => ({ bag: DG.village.bagCount('dragon') }));
  await sheet('bag');
  const netBtn = await domClick('#sheet-body [data-act="v-buytool"][data-id="net"]'); await sleep(300);
  await closeSheet();
  await spawn(); await space();
  const b2 = await ev(() => ({ net: DG.bug.hasNet(), bag: DG.village.bagCount('dragon'), dex: !!(DG.core.save.dex && DG.core.save.dex.items && DG.core.save.dex.items.dragon) || !!(DG.village.state().dex && DG.village.state().dex.dragon) || !!(DG.village.state().caught && DG.village.state().caught.dragon) }));
  await tune('time.phase', 'night');
  const summerNight = await ev(() => DG.bug.poolNow().map((x) => x.key));
  await tune('time.season', 'winter');
  const winterNight = await ev(() => DG.bug.poolNow().map((x) => x.key));
  await tune('time.season', ''); await tune('time.phase', ''); await tune('time.weather', '');
  check('fs.bug 곤충 — 잠자리채 없이 ␣ 는 못 잡고, 전방 「산다」 단추로 채를 산 뒤 ␣ 로 잡으면 가방에 든다 · 여름밤엔 반딧불이, 겨울밤엔 없다',
    !b0.net && b1.bag === b0.bag && netBtn && b2.net && b2.bag === b0.bag + 1 && summerNight.indexOf('firefly') >= 0 && winterNight.indexOf('firefly') < 0,
    JSON.stringify({ b0, b1, netBtn, b2, summerNight, winterNight }));

  /* fs.terrain — 개토패 없이는 공사 못 함, 전방 단추로 개토패를 산 뒤 흙길 → 그 칸 땅이 바뀌고 삯이 빠짐, 되돌리면 원래 땅·세이브에서 빠짐 · 사물 선 칸은 못 함 */
  const t0 = await ev(() => {
    var T = DG.terrain, V = DG.village, raw = V.raw(), TL = V.TILE, c = T.cell(), spot = null, dx, dy;
    for (dy = -6; dy <= 6 && !spot; dy++) { for (dx = -6; dx <= 6 && !spot; dx++) { var tx = c.tx + dx, ty = c.ty + dy; if (T.can(tx, ty, 'path').why && /개토패/.test(T.can(tx, ty, 'path').why)) { spot = { tx: tx, ty: ty }; } } }
    var prop = raw.props.find((p) => p.kind === 'tree' || p.kind === 'rock');
    return { has: T.has(), spot: spot, noDeed: spot ? T.can(spot.tx, spot.ty, 'path').ok : null, prop: prop ? { tx: Math.floor(prop.x / TL), ty: Math.floor(prop.y / TL) } : null };
  });
  await sheet('bag');
  const deedBtn = await domClick('#sheet-body [data-act="v-buytool"][data-id="deed"]'); await sleep(300);
  await closeSheet();
  const t1 = await ev((a) => {
    var T = DG.terrain, V = DG.village, sp = null, dx, dy, c = T.cell();
    for (dy = -6; dy <= 6 && !sp; dy++) { for (dx = -6; dx <= 6 && !sp; dx++) { if (T.can(c.tx + dx, c.ty + dy, 'path').ok) { sp = { tx: c.tx + dx, ty: c.ty + dy }; } } }
    if (!sp) { return { none: true }; }
    var g0 = DG.core.save.player.gold, tile0 = V.tileAt(sp.tx, sp.ty), cost = T.costOf('path'), w1 = T.work(sp.tx, sp.ty, 'path');
    var mid = { worked: T.worked(sp.tx, sp.ty), tile: V.tileAt(sp.tx, sp.ty), raw: T.rawTile(sp.tx, sp.ty), paid: g0 - DG.core.save.player.gold, cost: cost };
    T.work(sp.tx, sp.ty, 'revert');
    var key = sp.tx + ',' + sp.ty, saved = !!(V.state().terrain && Object.prototype.hasOwnProperty.call(V.state().terrain, key));
    var propCan = a.prop ? T.can(a.prop.tx, a.prop.ty, 'path') : null;
    return { sp: sp, tile0: tile0, w1: w1 && w1.kind, mid: mid, after: V.tileAt(sp.tx, sp.ty), worked: T.worked(sp.tx, sp.ty), saved: saved, propCan: propCan && { ok: propCan.ok, why: propCan.why } };
  }, t0);
  check('fs.terrain 땅 공사 — 개토패 없이는 거부, 전방 단추로 개토패를 산 뒤 흙길이면 그 칸 땅이 바뀌고 삯이 빠지며, 되돌리면 원래 땅·세이브에서 빠진다 · 사물 칸은 거부',
    !t0.has && t0.noDeed === false && deedBtn && !t1.none && t1.mid.worked && t1.mid.tile !== t1.tile0 && t1.mid.raw === t1.tile0 && t1.mid.paid === t1.mid.cost && t1.after === t1.tile0 && !t1.worked && !t1.saved && t1.propCan && !t1.propCan.ok,
    JSON.stringify({ t0, deedBtn, t1 }));

  /* fs.village-4 — 택배 시트의 소포 셋(종류 다 다름) 중 하나를 단추로 받고, 들고 있는 동안 둘째는 못 받으며, 가져다주면 금 */
  await sheet('parcel');
  const offers = await ev(() => Array.from(document.querySelectorAll('#sheet-body [data-act="v-parcel"]')).map((b) => ({ kind: b.getAttribute('data-kind'), dest: b.getAttribute('data-dest') })));
  const firstOk = offers.length ? await domClick('#sheet-body [data-act="v-parcel"]') : false; await sleep(300);
  const p1 = await ev(() => DG.parcel.status());
  const second = await ev((o) => DG.village.pickupParcel(o.kind, o.dest), offers[1] || offers[0] || { kind: 'plain', dest: 'space' });
  const p2 = await ev(() => { var s = DG.parcel.status(), g0 = DG.core.save.player.gold, res = DG.parcel.deliver(s.dest, '확인'); return { kept: s.kind, gold: DG.core.save.player.gold - g0, res: res && res.kind, after: DG.parcel.status().carrying }; });
  await closeSheet();
  check('fs.village-4 택배 — 소포 셋은 종류가 다 다르고, 단추로 하나를 받으면 들고 다니며 둘째는 거부, 가져다주면 금이 든다',
    offers.length === 3 && new Set(offers.map((o) => o.kind)).size === 3 && firstOk && p1.carrying && second && second.kind === 'no' && p2.kept === p1.kind && p2.gold > 0 && !p2.after,
    JSON.stringify({ offers, p1: { carrying: p1.carrying, kind: p1.kind, dest: p1.dest }, second: second && second.kind, p2 }));

  /* fs.town — 이름 바꾸기 · 마을 시트 깃발 단추 · 잠긴 무늬는 거부 · 잡초를 ␣ 로 뽑으면 평가가 오른다 */
  const tw0 = await ev(() => {
    var T = DG.town, VD = DG.villageData, nm = T.setName('확인마을'), locked = VD.FLAG_SYMS.find((x) => T.symLocked(x.key));
    var lr = locked ? T.setFlag('sym', locked.key) : null;
    return { name: T.name(), nm: nm && nm.kind, locked: locked && locked.key, lockRes: lr && lr.kind, flag0: JSON.stringify(T.flag()) };
  });
  await sheet('town');
  const flagBtn = await ev(() => { var bs = Array.from(document.querySelectorAll('#sheet-body [data-act="v-flag"]')), cur = JSON.stringify(DG.town.flag()); var b = bs.find((x) => x.getAttribute('data-kind') === 'bg' && cur.indexOf('"' + x.getAttribute('data-id') + '"') < 0) || bs[0]; if (!b) { return null; } b.click(); return { kind: b.getAttribute('data-kind'), id: b.getAttribute('data-id') }; });
  await sleep(300);
  const flag1 = await ev(() => JSON.stringify(DG.town.flag()));
  await closeSheet();
  /* 새 세이브엔 잡초가 없다 — 하루치 잡초를 돋게 하고(growWeeds, 날이 바뀔 때 부르는 것) 사물을 다시 짠 뒤 하나를 ␣ 로 뽑는다 */
  await ev(() => { var V = DG.village; for (var k = 0; k < 4 && V.weedCount() < 2; k++) { V.state().day += 1; V.growWeeds(); } V.buildProps(); DG.core.emit('changed'); });
  const weed = await ev(() => { var p = DG.village.raw().props.find((x) => x.kind === 'weed'); return p ? { x: p.x, y: p.y, n: DG.village.weedCount(), beauty: DG.town.beauty().score !== undefined ? DG.town.beauty().score : DG.town.beauty() } : null; });
  if (weed) { await ev((a) => { var pl = DG.village.raw().player; pl.x = a.x; pl.y = a.y + 10; }, weed); await sleep(250); await space(); }
  const weed2 = await ev(() => ({ n: DG.village.weedCount(), beauty: DG.town.beauty().score !== undefined ? DG.town.beauty().score : DG.town.beauty() }));
  check('fs.town 마을 — 이름이 바뀌고, 마을 시트 깃발 단추로 깃발이 바뀌며, 잠긴 무늬는 거부 · 잡초를 ␣ 로 뽑으면 평가 점수가 오른다',
    tw0.name === '확인마을' && !!flagBtn && flag1 !== tw0.flag0 && (!tw0.locked || tw0.lockRes === 'no') && !!weed && weed2.n === weed.n - 1 && weed2.beauty > weed.beauty,
    JSON.stringify({ tw0, flagBtn, changed: flag1 !== tw0.flag0, weed, weed2 }));

  /* fs.data-village-2 — 설날은 행사, 다음 행사까지 남은 날, 대보름엔 견과 값 ×2, 설날 세배(␣)는 사람마다 한 번만 세뱃돈 */
  const e0 = await ev(() => {
    var VD = DG.villageData, ny = VD.eventOf(new Date(2026, 0, 1)), nx = VD.nextEventOf(new Date(2026, 0, 2));
    return { ny: ny && ny.key, next: nx && nx.event && nx.event.key, days: nx && nx.left, plain: DG.town.priceMul('nut') };
  });
  await tune('time.event', 'daeborum');
  const nutMul = await ev(() => DG.town.priceMul('nut'));
  await tune('time.event', 'seollal');
  const res = await ev(() => { var R = DG.village.raw().residents[0]; return R ? { id: R.id, x: R.x, y: R.y } : null; });
  let bow = null;
  if (res) {
    await ev((a) => { var pl = DG.village.raw().player; pl.x = a.x; pl.y = a.y + 10; DG.bug.reset && DG.bug.reset(); }, res); await sleep(250);
    const g0 = await ev(() => DG.core.save.player.gold);
    await space(); await ev(() => { DG.ui.closeEnc && DG.ui.closeEnc(); }); await sleep(200);
    const g1 = await ev(() => DG.core.save.player.gold);
    await ev((a) => { var R = DG.village.raw().residents.find((x) => x.id === a.id), pl = DG.village.raw().player; pl.x = R.x; pl.y = R.y + 10; }, res); await sleep(200);
    await space(); await ev(() => { DG.ui.closeEnc && DG.ui.closeEnc(); }); await sleep(200);
    const g2 = await ev(() => DG.core.save.player.gold);
    bow = { first: g1 - g0, second: g2 - g1, newYear: await ev(() => DG.town.isNewYear()) };
  }
  await tune('time.event', '');
  check('fs.data-village-2 행사 — 설날은 행사, 다음 행사까지 남은 날이 나오고, 대보름엔 견과 값 ×2, 설날 세배(␣)는 한 번만 세뱃돈',
    e0.ny === 'seollal' && !!e0.next && e0.days > 0 && e0.plain === 1 && nutMul === 2 && !!bow && bow.newYear && bow.first > 0 && bow.second <= 0, JSON.stringify({ e0, nutMul, bow }));

  /* fs.folk — 주민 갈래는 늘 같고, 둘이 말을 붙이면 대화 중·끝내면 풀림 · 곁에서 가방 🎁 단추로 반기는 것을 건네면 정이 크게 오른다 · 정이 깊으면 함께 걷기 */
  const fk = await ev(() => {
    var F = DG.folk, V = DG.village, rs = V.raw().residents;
    if (rs.length < 2) { return { none: true }; }
    var a = rs[0], b = rs[1], same = F.typeOf(a.id) === F.typeOf(a.id) && F.typeOf(a.id).key === F.typeOf(a.id).key;
    F._start(a, b); var on = F.inChat(a.id); F._end(); var off = F.inChat(a.id);
    var like = V.giftLike(b.id), ALL = DG.villageData.all(), it = Object.keys(ALL).map((k) => ALL[k]).find((x) => x && x.cat === like && x.price > 0) || null;
    if (it) { V.bagAdd(it, 1); }
    var pl = V.raw().player; pl.x = b.x; pl.y = b.y + 8;
    return { a: a.id, b: b.id, same: same, on: on, off: off, like: like, item: it && it.key, h0: V.heartOf(b.id), f0: V.friendOf(b.id) };
  });
  let fk2 = null;
  if (!fk.none && fk.item) {
    await sleep(300);
    await sheet('bag');
    const gave = await domClick('#sheet-body [data-act="v-gift"][data-who="' + fk.b + '"][data-id="' + fk.item + '"]'); await sleep(300);
    await closeSheet();
    fk2 = await ev((a) => {
      var V = DG.village, F = DG.folk, need = V.heartUnlockAt('동행');
      var h1 = V.heartOf(a.b), f1 = V.friendOf(a.b);
      for (var k = 0; k < 20 && V.heartOf(a.b) < need; k++) { V.state().day += 1; V.bumpHeart(a.b, 4); }   // 하트는 하루 +4 상한 — 날을 넘기며 올린다
      var can = V.canFollow(a.b), rf = can ? V.requestFollow(a.b) : null, fs1 = F.followStatus(); F.stopFollow(); var fs2 = F.followStatus();
      return { h1: h1, f1: f1, can: can, rf: rf && rf.kind, follow: fs1 && fs1.id, stop: fs2 };
    }, fk);
    fk2.gave = gave;
  }
  check('fs.folk 주민 — 갈래는 늘 같고, 둘이 말을 붙이면 대화 중·끝내면 풀림 · 곁에서 가방 🎁 단추로 반기는 것을 건네면 정이 +3 · 정이 깊으면 함께 걷고 그만둘 수 있다',
    !fk.none && fk.same && fk.on && !fk.off && !!fk2 && fk2.gave && fk2.f1 >= fk.f0 + 3 && fk2.h1 > fk.h0 && fk2.rf === 'follow' && fk2.follow === fk.b && fk2.stop === null,
    JSON.stringify({ fk, fk2 }));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-fs-close1.json', JSON.stringify({ script: 'pw-fs-close1.mjs', game: 'saga-forest', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
