// 사가의숲 확인 시트(tasks/sheets/saga-forest-*.md) 여섯 항목을 Playwright 로 직접 해 본다.
//   node pw-fs-sheet.mjs [shot]        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 어드민 프리셋은 시트와 같이 _admin.html 에서 단추를 눌러 적용하고 index.html 을 다시 연다. 새 컨텍스트 = 새 프로필.
// 이건 **기계가 한 확인**(D2 기록)이다 — 사람 눈으로 보는 D3(○/×)를 대신하지 않는다. 결과는 콘솔에만.
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const SHOT = process.argv.includes('shot');
const results = [], rows = [];
const check = (name, ok, detail) => { results.push(ok); rows.push({ name, ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

const r = await open('saga-forest');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);

/** 새 계정으로 시작해 마을까지 */
async function boot(fresh) {
  await page.goto(r.url('index.html')); await sleep(1500);
  if (fresh) { await ev(() => { DG.account.create('확인'); }); }
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3500);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }
  await ev(() => { var h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });
}
/** 어드민에서 프리셋을 누르고 게임으로 돌아온다 */
async function preset(title) {
  await page.goto(r.url('_admin.html')); await sleep(2000);
  await page.locator('[data-tab="preset"]').click(); await sleep(300);
  const btn = page.locator('#presets .preset', { hasText: title });
  if (await btn.count() !== 1) { throw new Error('프리셋 없음 ' + title); }
  await btn.click(); await sleep(600);
  await boot(false);
}
const sheet = async (name) => {
  const inMore = await ev((n) => { var b = document.querySelector('[data-sheet="' + n + '"]'); return !!(b && b.closest('#dock-more')); }, name);
  if (inMore) { await page.locator('#dock-more-btn').click(); await sleep(300); }
  await page.locator('[data-sheet="' + name + '"]').first().click(); await sleep(500);
};
const sheetText = () => ev(() => (document.getElementById('sheet-body') || {}).innerText || '');
const shot = async (n) => { if (SHOT) { await page.screenshot({ path: 'shots/pw_fs_' + n + '.png' }); } };

try {
  /* 1) 채집·낚시 */
  await boot(true);
  const total = () => ev(() => DG.village.bagList().reduce((n, b) => n + b.n, 0));
  const tele = (p, dy) => ev((a) => { var pl = DG.village.raw().player; pl.x = a.p.x; pl.y = a.p.y + a.dy; }, { p, dy });
  const props = await ev(() => DG.village.raw().props.filter((p) => p.kind === 'flower' || p.kind === 'mushroom' || p.kind === 'bush').slice(0, 12).map((p) => ({ id: p.id, kind: p.kind, x: p.x, y: p.y })));
  let gathered = null;
  for (const p of props) {
    const before = await total();
    await tele(p, 10); await sleep(250);
    await page.keyboard.press('Space'); await sleep(900);
    const after = await total();
    if (after > before) { gathered = { kind: p.kind, before, after }; break; }
  }
  check('채집 — 풀·열매 앞에서 ␣ 를 누르면 가방에 쌓인다', !!gathered, gathered ? gathered.kind + ' ' + gathered.before + '→' + gathered.after : '시도 ' + props.length + '곳 모두 안 쌓임');

  const spot = await ev(() => { var p = DG.village.raw().props.find((p) => p.kind === 'spot'); return p ? { id: p.id, x: p.x, y: p.y } : null; });
  if (!spot) { check('낚시 — 낚시터가 있다', false, 'spot 없음'); }
  else {
    await tele(spot, 10); await sleep(300);
    const f0 = await ev(() => { var f = DG.village.focus(); return f ? f.type + ':' + (f.obj && f.obj.kind) : null; });
    await page.keyboard.press('Space'); await sleep(500);
    const cast = await ev(() => { var f = DG.village.raw().fishing; return f ? { wait: f.biteAt - Date.now(), win: f.ends - f.biteAt } : null; });
    check('낚시 — 낚시터에서 ␣ 로 줄을 던진다', !!cast && f0 === 'prop:spot', 'focus ' + f0 + ' · ' + JSON.stringify(cast));
    if (cast) {
      check('낚시 — 입질 창은 0.7초(1.2~3.5초 기다린 뒤)', cast.win === 700, '창 ' + cast.win + 'ms · 남은 대기 ' + Math.round(cast.wait) + 'ms');
      /* 입질 창은 0.7초 — 소프트웨어 렌더링 부하로 Playwright 왕복이 수백 ms 걸려 바깥에서 타이밍을 맞출 수 없다.
         페이지 안에서 biteAt+150ms 에 ␣ keydown 을 직접 보낸다(게임의 키 처리 그대로 탄다) */
      const t0 = await total();
      const bt = await ev(() => new Promise((res) => {
        var f = DG.village.raw().fishing;
        if (!f) { res(false); return; }
        setTimeout(() => {
          var n = Date.now(), inWin = n >= f.biteAt && n <= f.ends;
          window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
          res(inWin);
        }, Math.max(0, f.biteAt + 150 - Date.now()));
      }));
      await sleep(900);
      const t1 = await total();
      check('낚시 — 입질 창 안에 ␣ 를 다시 누르면 물고기가 가방에 든다', bt && t1 > t0, '창 안 ' + bt + ' · ' + t0 + '→' + t1);
    }
  }
  await shot('01_gather');

  /* 2) 순무 장 */
  await preset('🥬 순무 장 아침');
  const tn = await ev(() => { DG.turnip._setOpen(true); var g0 = DG.core.save.player.gold, r = DG.turnip.buy(10); return { r: r, g0: g0, g1: DG.core.save.player.gold, have: DG.turnip.have() && DG.turnip.have().n, price: DG.turnip.buyPrice() }; });
  check('순무 장 — 프리셋 뒤 금 20만, 장이 열리면 열 개를 살 수 있다', tn.g0 >= 200000 && tn.have === 10 && tn.g1 < tn.g0, 'ok:' + JSON.stringify(tn.r).slice(0, 80) + ' 금 ' + tn.g0 + '→' + tn.g1 + ' 순무 ' + tn.have + ' 값 ' + tn.price);
  const sun = await ev(() => { DG.turnip._setOpen(false); var g0 = DG.core.save.player.gold; var r = DG.turnip.sellAll(); return { r: r, g0: g0, g1: DG.core.save.player.gold }; });
  check('순무 장 — 일요일엔 전방이 순무를 받지 않는다(규칙)', sun.r.kind === 'no' && sun.g1 === sun.g0, JSON.stringify(sun.r).slice(0, 80));
  const mon = await ev(() => { DG.village.state().day += 1; var g0 = DG.core.save.player.gold; var r = DG.turnip.sellAll(); return { r: r, g0: g0, g1: DG.core.save.player.gold, left: !!DG.turnip.have(), dow: DG.turnip.dow() }; });
  check('순무 장 — 월요일에 팔면 금이 오르고 순무가 사라진다', mon.g1 > mon.g0 && !mon.left, '요일 ' + mon.dow + ' · ' + JSON.stringify(mon.r).slice(0, 80) + ' 금 ' + mon.g0 + '→' + mon.g1);

  /* 3) 편지 */
  await preset('📮 편지 가득');
  await sheet('mail');
  const mt = await sheetText();
  const ml = await ev(() => ({ n: DG.mail.list().length, unread: DG.mail.unread(), gifts: DG.mail.list().filter((l) => l.gift).length }));
  check('편지 — 📮 시트가 열리고 여섯 통이 보인다', ml.n >= 6 && mt.length > 40, '편지 ' + ml.n + ' 안 읽음 ' + ml.unread + ' 선물 ' + ml.gifts + ' 시트 글자 ' + mt.length);
  const giftId = await ev(() => { var l = DG.mail.list().find((l) => l.gift); return l ? l.id : null; });
  if (giftId) {
    const t = await ev((id) => { var g0 = JSON.stringify(DG.village.bagCount()), x = DG.mail.take(id); return { x: x, g0: g0, g1: JSON.stringify(DG.village.bagCount()), gold: DG.core.save.player.gold }; }, giftId);
    check('편지 — 선물이 든 편지를 받으면 선물이 비워진다', t.x && t.x.kind !== 'no', JSON.stringify(t.x).slice(0, 100));
  }
  const repId = await ev(() => { var l = DG.mail.list().find((l) => l.from && l.from !== 'town'); return l ? l.id : null; });
  if (repId) {
    const rr = await ev((id) => DG.mail.reply(id), repId);
    check('편지 — 답장을 쓸 수 있다', !!rr && rr.kind !== 'no', JSON.stringify(rr).slice(0, 100));
  }
  await shot('03_mail');

  /* 4) 집 */
  await preset('🪑 가구 · 벽지 전부');
  await sheet('home');
  const ht = await sheetText();
  check('집 — 🏠 시트가 열리고 벽지·장판이 보인다', ht.length > 40 && /벽지|장판/.test(ht), '시트 글자 ' + ht.length);
  await page.keyboard.press('Escape'); await sleep(300);
  const hs = await ev(() => ({ n: DG.home.stockList().length, first: DG.home.stockList()[0] && DG.home.stockList()[0].furn.key, items0: DG.home.state().items.length }));
  const homeProp = await ev(() => { var p = DG.village.raw().props.find((p) => p.kind === 'home'); return p ? { id: p.id, x: p.x, y: p.y } : null; });
  let inside = false;
  for (let t = 0; t < 3 && !inside; t++) {
    await ev((a) => { var pl = DG.village.raw().player; pl.x = a.x; pl.y = a.y + 12; }, homeProp);
    await sleep(500);
    const f = await ev(() => { var f = DG.village.focus(); return f && f.obj && f.obj.kind; });
    if (f !== 'home') { continue; }
    await page.keyboard.press('Space'); await sleep(1200);
    inside = await ev(() => DG.village.indoors());
  }
  check('집 — 집 문 앞에서 ␣ 를 누르면 집 안으로 들어간다', inside, 'indoors ' + inside);
  if (inside) {
    await ev(() => { var T = DG.village.TILE, r = DG.home.room(), pl = DG.village.raw().player; pl.x = Math.floor(r.tw / 2) * T + T * 0.5; pl.y = Math.floor(r.th / 2) * T + T * 0.5; });
    await sleep(300);
    const pl = await ev((k) => { var r = DG.home.place(k); return { r: r, items: DG.home.state().items.length, stock: DG.home.stockCount(k) }; }, hs.first);
    check('집 — 창고의 가구를 방에 놓으면 방에 늘고 창고에서 준다', pl.items === hs.items0 + 1, '창고 ' + hs.n + '종 · ' + JSON.stringify(pl.r).slice(0, 70) + ' · 방 ' + hs.items0 + '→' + pl.items);
  }
  const wall = await ev(() => { var a = DG.home.wallNow(); return a ? a.name : null; });
  check('집 — 지금 벽지를 읽는다', !!wall, wall || '없음');
  await shot('04_home');

  /* 5) 사고 */
  await preset('🏛️ 사고 코앞');
  const mkey = await ev(() => { var st = DG.museum.status(), k = null; st.cats.forEach((c) => c.all.forEach((x) => { if (!k && !x.done && !DG.museum.donated(x.key)) { k = x.key; } })); return k; });
  const mprop = await ev(() => { var p = DG.village.raw().props.find((p) => p.kind === 'museum'); return p ? { x: p.x, y: p.y } : null; });
  if (!mkey || !mprop) { check('사고 — 기증할 것·사고 건물이 있다', false, 'key ' + mkey + ' prop ' + JSON.stringify(mprop)); }
  else {
    await ev((a) => { DG.village.bagAdd(DG.villageData.item(a.k), 1); var pl = DG.village.raw().player; pl.x = a.p.x; pl.y = a.p.y + 14; }, { k: mkey, p: mprop });
    await sleep(300);
    const dn = await ev((k) => { var b = DG.museum.count().done, near = DG.museum.near(), r = DG.museum.donate(k); return { b: b, near: near, r: r, a: DG.museum.count().done }; }, mkey);
    check('사고 — 사고 앞에서 가방의 것을 기증하면 기증 수가 오른다', dn.a === dn.b + 1, '앞 ' + dn.near + ' · ' + dn.b + '→' + dn.a + ' · ' + JSON.stringify(dn.r).slice(0, 90));
  }

  /* 6) 침선방 */
  await preset('🧵 옷장 전부');
  const wr = await ev(() => { var st = DG.wear.status(), tot = 0, own = 0; st.parts.forEach((p) => p.list.forEach((x) => { tot++; if (x.own) own++; })); return { tot: tot, own: own }; });
  check('침선방 — 프리셋 뒤 옷장의 옷이 전부 내 것이다', wr.own === wr.tot && wr.tot > 3, wr.own + '/' + wr.tot);
  const sw = await ev(() => { var st = DG.wear.status(), part = st.parts[0], cur = DG.wear.wearing(part.part.key), other = part.list.find((x) => x.own && x.it.key !== cur); if (!other) { return null; } var r = DG.wear.set(part.part.key, other.it.key); return { part: part.part.key, from: cur, to: DG.wear.wearing(part.part.key), r: r }; });
  check('침선방 — 다른 옷을 입으면 입은 옷이 바뀐다', !!sw && sw.to !== sw.from, JSON.stringify(sw).slice(0, 110));
} catch (e) { console.log('ERR', e.message); results.push(false); }

const real = r.errors.filter((e) => !/status of 404/.test(e));
console.log('페이지 예외·console.error(404 제외):', real.length ? real.slice(0, 5).join(' | ') : '없음');
console.log('404 주소:', r.notFound.length ? r.notFound.join(', ') : '없음');
console.log('요약', results.filter(Boolean).length + '/' + results.length);
/* 결과 파일 — D2("스크립트가 있고 결과 파일이 남음", SAGA-ARCH §3.1). 시각·시스템 정보는 안 넣는다(커밋마다 바뀌지 않게) */
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-fs-sheet.json', JSON.stringify({ script: 'pw-fs-sheet.mjs', game: 'saga-forest', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, notFound: r.notFound, checks: rows }, null, 1) + '\n');
await r.close();
process.exit(0);
