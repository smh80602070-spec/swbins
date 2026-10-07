// 사가나락 확인 닫기 ③(W-0098) — 오픈월드 마을·유적/도감 완성·자동 순회·자동지도·목표판을 실제 판에서 한 번씩 해 본다.
//   node pw-dg-close3.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 화면: 출사표 `.stc-cell`·`.stc-btn` · 🤖 `[data-act="auto-on"]` · 실제 M 키(큰 지도). 유적은 그 자리로 몸을 옮겨 밟는다(town update → town:mark).
// Math.random 은 진단과 같은 씨앗 mulberry32(20260824). **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-dg-close3.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-dungeon');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
const domClick = (sel) => ev((q) => { var b = document.querySelector(q); if (!b) { return false; } b.click(); return true; }, sel);

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  const cells = page.locator('#starter-host .stc-cell');
  for (let i = 0; i < 3; i++) { await cells.nth(i).click(); await sleep(150); }
  await page.locator('#starter-host .stc-btn').first().click(); await sleep(1500);
  /* 출사표 뒤 첫 이야기 장면 — 장면이 떠 있는 동안은 장면이 키를 먹는다(scenario.js, 일부러) */
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }

  /* dg.town — 마을 104 · 첫 마을 활성 · 안 가 본 마을은 역참 거부, 가 본 것으로 하면 이동 · 안개 */
  const tw = await ev(() => {
    var T = DG.town, ids = T.townIds(), cur0 = T.raw().townId, other = ids.find((id) => id !== cur0 && !/^gen/.test(id));
    var hand = ids.filter((id) => !/^gen/.test(id)).length, gen = ids.filter((id) => /^gen/.test(id)).length;
    var refuse = T.travelToTown(other);
    var sv = DG.core.save.town; sv.visited = sv.visited || {}; sv.visited[other] = 1;
    var ok = T.travelToTown(other), cur1 = T.raw().townId;
    var seenNear = Object.keys((sv.seen) || {}).length, far = T.isSeen(99999, 99999);
    return { n: ids.length, hand: hand, gen: gen, cur0: cur0, other: other, refuse: refuse, ok: ok, cur1: cur1, seen: seenNear, far: far, active: T.active() };
  });
  check('dg.town 오픈월드 — 마을 104(손 4 + 절차 100), 첫 마을이 활성, 안 가 본 마을로는 역참 이동이 거부되고 가 본 마을로는 옮겨 가며, 안개는 가 본 칸만 걷힌다',
    tw.n === 104 && tw.hand === 4 && tw.gen === 100 && !!tw.cur0 && tw.refuse === false && tw.ok !== false && tw.cur1 === tw.other && tw.seen > 0 && tw.far === false && tw.active, JSON.stringify(tw));
  await ev((id) => { DG.town.travelToTown(id); }, tw.cur0);
  await sleep(800);

  /* dg.town-2 + dg.ui — 길 조각 · 들판 유적을 밟으면 도감·금 +20·공적 +4, 두 번은 안 준다 · 마지막 유적이면 도감 완성 보상 한 번 */
  /* 공개 목록(fieldRelics)엔 좌표가 없어 걸어서는 못 간다 — 밟았을 때 ui.js(town:mark)가 부르는 같은 함수로 밟는다 */
  const step = async (rel) => { await ev((p) => { var r = DG.town.fieldRelics().find((x) => x.id === p.id); DG.town.rewardFieldRelic({ key: r.id, name: r.name, emoji: r.emoji, fieldRelic: true }); }, rel); await sleep(300); };
  const rl0 = await ev(() => { var T = DG.town, rs = T.fieldRelics(); DG.core.save.dex.relics = DG.core.save.dex.relics || {}; return { segs: T.roadSegments().length, n: rs.length, first: { id: rs[0].id }, last: { id: rs[rs.length - 1].id }, gold: DG.core.save.player.gold, feat: DG.core.save.player.featTotal || DG.core.save.player.feat || 0 }; });
  await step(rl0.first);
  const rl1 = await ev((k) => ({ got: !!DG.core.save.dex.relics[k], gold: DG.core.save.player.gold, feat: DG.core.save.player.featTotal || DG.core.save.player.feat || 0 }), rl0.first.id);
  const twice = await ev((k) => { var g = DG.core.save.player.gold; DG.town.rewardFieldRelic({ key: k, name: '확인', emoji: '🏺' }); return DG.core.save.player.gold - g; }, rl0.first.id);
  check('dg.town-2 길·유적 — 길 조각 100 이상, 들판 유적을 밟으면(town:mark 가 부르는 rewardFieldRelic) 도감에 들고 금 +20·공적 +4, 같은 유적은 두 번 안 준다',
    rl0.segs >= 100 && rl0.n >= 10 && rl1.got && rl1.gold - rl0.gold === 20 && rl1.feat - rl0.feat === 4 && twice === 0, JSON.stringify({ rl0: { segs: rl0.segs, n: rl0.n }, d: [rl1.gold - rl0.gold, rl1.feat - rl0.feat], twice }));
  /* 도감 완성 — 마지막 하나만 남기고 채운 뒤 그 하나를 밟는다 */
  const dx0 = await ev((last) => { var rs = DG.town.fieldRelics(), d = DG.core.save.dex; rs.forEach((x) => { if (x.id !== last) { d.relics[x.id] = true; } }); delete d.relicsFull; return { gold: DG.core.save.player.gold, full0: !!d.relicsFull }; }, rl0.last.id);
  await step(rl0.last);
  const dx1 = await ev(() => ({ gold: DG.core.save.player.gold, full: !!DG.core.save.dex.relicsFull, n: Object.keys(DG.core.save.dex.relics).length, total: DG.town.fieldRelics().length }));
  check('dg.ui 도감 완성 — 들판 유적 마지막 하나를 밟으면 「유적」 도감이 차고 완성 보상(금 1200)이 한 번 든다',
    !dx0.full0 && dx1.full && dx1.n === dx1.total && dx1.gold - dx0.gold === 20 + 1200, JSON.stringify({ dx0, dx1 }));

  /* dg.minimap — 코너 미니맵 · M 키로 큰 지도 열고 닫기 */
  const mm0 = await ev(() => DG.minimap.stats());
  const bigOpen = () => ev(() => { var b = document.getElementById('dg-automap'); return !!(b && b.style.display === 'block'); });
  await page.keyboard.press('m'); await sleep(600);
  const b1 = await bigOpen();
  await page.keyboard.press('m'); await sleep(500);
  const b2 = await bigOpen();
  check('dg.minimap 자동지도 — 코너 미니맵이 서서 그리고, 실제 M 키로 큰 지도가 열렸다 다시 M 으로 닫힌다', mm0.mounted && mm0.drawn > 0 && b1 && !b2, JSON.stringify({ mm0, b1, b2 }));

  /* dg.auto — 🤖 단추로 켜면 스스로 움직이고, 깃발을 뒤집을 수 있고, 다시 누르면 꺼진다 */
  const au0 = await ev(() => ({ on: DG.auto.status().on, retry: DG.auto.status().flags.retry }));
  const autoBtn = await domClick('#btn-auto');   // 상단 🤖(좁은 화면에선 ⋯ 서랍 안 — DOM click 으로 같은 처리)
  await sleep(2500);
  const au1 = await ev(() => { var s = DG.auto.status(); DG.auto.toggleFlag('retry'); return { on: s.on, doing: s.doing, retry: DG.auto.status().flags.retry }; });
  await domClick('#btn-auto');
  await sleep(300);
  const au2 = await ev(() => { DG.auto.toggleFlag('retry'); return { on: DG.auto.status().on }; });
  await ev(() => { if (DG.ui.closeSheet) { DG.ui.closeSheet(); } });
  check('dg.auto 자동 순회 — 🤖 단추로 켜면 스스로 할 일을 잡고(doing), 깃발을 뒤집을 수 있고, 다시 누르면 꺼진다',
    !au0.on && autoBtn && au1.on && au1.doing.length > 0 && au1.retry === !au0.retry && !au2.on, JSON.stringify({ au0, autoBtn, au1, au2 }));

  /* dg.x — 목표판 세 줄(지금·세션·주간), 도감 % */
  const gx = await ev(() => { var L = DG.goals.lines(); return { keys: Object.keys(L), ok: ['now', 'session', 'weekly'].every((k) => L[k] && L[k].label && L[k].target > 0), dex: DG.goals.dexPct(), L: L }; });
  check('dg.x 목표판 — 지금·세션·주간 세 줄이 이름과 목표를 갖고, 도감 % 가 숫자', gx.ok && typeof gx.dex === 'number', JSON.stringify(gx).slice(0, 300));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-dg-close3.json', JSON.stringify({ script: 'pw-dg-close3.mjs', game: 'saga-dungeon', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
