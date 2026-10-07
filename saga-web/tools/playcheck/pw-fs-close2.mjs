// 사가마을 확인 닫기 ②(W-0096) — 마을 생성·고정 자리·짐승·숲 NPC·전체지도·설정·소리·계정·세이브를 실제 판에서 한 번씩 해 본다.
//   node pw-fs-close2.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 화면: 실제 M 키(전체지도) · ⚙️ 설정 시트 `snd-toggle`·`music-toggle`·`fog-toggle`·`gq-set` · NPC 곁 ␣ 말 걸기(village.interact).
// Math.random 은 진단과 같은 씨앗 mulberry32(20260824). **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-fs-close2.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-forest');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
const domClick = (sel) => ev((q) => { var b = document.querySelector(q); if (!b) { return false; } b.click(); return true; }, sel);
const sheetOpen = () => ev(() => ({ show: document.getElementById('sheet').classList.contains('show'), title: (document.getElementById('sheet-title') || {}).textContent || '' }));

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3500);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }
  await ev(() => { var h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });

  /* fs.village — 같은 씨앗이면 사물을 다시 짜도 같다 · 바이옴 5 · 숲 고리 */
  const vg = await ev(() => {
    var V = DG.village, count = () => { var k = {}; V.raw().props.forEach((p) => { k[p.kind] = (k[p.kind] || 0) + 1; }); return JSON.stringify(Object.keys(k).sort().map((x) => x + ':' + k[x])); };
    var a = count(); V.buildProps(); var b = count();
    var bi = {}; for (var x = 0; x < V.W; x += 2) { for (var y = 0; y < V.H; y += 2) { bi[V.biomeAt(x, y)] = 1; } }
    return { seed: V.state().seed, same: a === b, n: V.raw().props.length, biomes: Object.keys(V.BIOMES).length || V.BIOMES.length, seen: Object.keys(bi), margin: V.forestMargin() };
  });
  check('fs.village 마을 생성 — 같은 씨앗이면 사물을 다시 짜도 갈래·수가 같고, 바이옴 5, 숲 고리가 둘렀다',
    !!vg.seed && vg.same && vg.n > 100 && vg.biomes === 5 && vg.seen.length >= 2 && vg.margin > 0, JSON.stringify(vg));

  /* fs.village-2 — 고정 자리 사물과 물 칸 */
  const fx = await ev(() => {
    var V = DG.village, k = {}; V.raw().props.forEach((p) => { k[p.kind] = (k[p.kind] || 0) + 1; });
    var want = ['bridge', 'waterfall', 'campfire', 'ruinArch', 'cave', 'mountain', 'spaceBase'], miss = want.filter((w) => !k[w]);
    var water = 0, x, y; for (x = 0; x < V.W; x++) { for (y = 0; y < V.H; y++) { if (/water|lake|river|sea/.test(String(V.tileAt(x, y)))) { water++; } } }
    return { miss: miss, camp: k.campfire || 0, tent: k.tent || 0, water: water };
  });
  check('fs.village-2 고정 자리 — 다리·폭포·캠프 둘·폐허·동굴·바위산·우주기지 사물과 물 칸(호수·강)이 있다',
    fx.miss.length === 0 && fx.camp >= 2 && fx.water > 0, JSON.stringify(fx));

  /* fs.animal — 짐승 갈래 11 · 마을에 돌고 · 곁에 다가가면 달아난다 */
  const an0 = await ev(() => { var R = DG.village.raw(), VD = DG.villageData, a = R.animals.find((x) => x.state !== 'flee'); var pl = R.player; window.__an = a; pl.x = a.x + 6; pl.y = a.y; return { defs: VD.ANIMALS.length || Object.keys(VD.ANIMALS).length, n: R.animals.length, states: Array.from(new Set(R.animals.map((x) => x.state))), kind: a.kind }; });
  await sleep(700);
  const an1 = await ev(() => window.__an.state);
  check('fs.animal 짐승 — 갈래 11, 마을에 짐승이 쉬고 거닐며, 곁에 다가가면 달아난다', an0.defs === 11 && an0.n > 5 && an0.states.length >= 2 && an1 === 'flee', JSON.stringify(Object.assign({}, an0, { after: an1 })));

  /* fs.data-village — 숲 NPC 7·부탁 6 · NPC 곁에서 ␣ 로 말을 걸면 답이 온다 */
  const np0 = await ev(() => { var R = DG.village.raw(), VD = DG.villageData, n = R.npcs[0]; DG.bug && DG.bug.reset && DG.bug.reset(); R.animals.forEach((a) => { a.x += 4000; }); var pl = R.player; pl.x = n.x; pl.y = n.y + 10; return { kinds: R.npcs.map((x) => x.kind), defs: Object.keys(VD.NPCS).length, quests: VD.QUESTS.length || Object.keys(VD.QUESTS).length, kind: n.kind, met0: !!((DG.village.state().metNpcs || {})[n.kind]) }; });
  await sleep(400);
  const foc = await ev(() => { var f = DG.village.focus(); return f && f.type; });
  await page.keyboard.press('Space'); await sleep(600);
  const np1 = await ev((k) => ({ met: !!((DG.village.state().metNpcs || {})[k]), enc: (document.getElementById('encounter') || {}).innerText || '', toast: (document.getElementById('toast') || {}).textContent || '' }), np0.kind);
  await ev(() => { if (DG.ui.closeDetail) { DG.ui.closeDetail(); } var e = document.getElementById('encounter'); if (e) { var b = e.querySelector('button'); if (b) { b.click(); } } });
  const want7 = ['keeper', 'angler', 'merchant', 'explorer', 'herbalist', 'wanderer', 'courier'];
  check('fs.data-village 숲 NPC — 일곱(숲지기·낚시꾼·상인·탐험가·약초꾼·나그네·배달원)·부탁 6, NPC 곁에서 ␣ 로 말을 걸면 만난 것으로 남고 답이 뜬다',
    want7.every((k) => np0.kinds.indexOf(k) >= 0) && np0.defs === 7 && np0.quests === 6 && foc === 'npc' && !np0.met0 && np1.met, JSON.stringify({ np0, foc, met: np1.met, enc: np1.enc.slice(0, 60), toast: np1.toast.slice(0, 60) }));

  /* fs.ui — M 키로 전체지도가 열리고 다시 M 으로 닫힌다 */
  await page.keyboard.press('m'); await sleep(600);
  const m1 = await sheetOpen();
  await page.keyboard.press('m'); await sleep(500);
  const m2 = await sheetOpen();
  check('fs.ui 전체지도 — M 키로 전체지도 시트가 열리고 다시 M 으로 닫힌다', m1.show && /지도/.test(m1.title) && !m2.show, JSON.stringify({ m1, m2 }));

  /* fs.ui-2 — ⚙️ 설정 시트의 효과음·음악·안개·품질 단추를 누르면 바뀐다(되돌림) */
  await ev(() => { DG.ui.openSheet('settings'); }); await sleep(500);
  const s0 = await ev(() => ({ snd: DG.sfx.enabled(), bgm: DG.bgm.enabled(), fog: DG.villageView3d.fogOn(), q: DG.villageView3d.qualityRaw() }));
  const c1 = await domClick('#sheet-body [data-act="snd-toggle"]'); await sleep(200);
  const c2 = await domClick('#sheet-body [data-act="music-toggle"]'); await sleep(200);
  const c3 = await domClick('#sheet-body [data-act="fog-toggle"]'); await sleep(200);
  const lvl = await ev((q) => { var b = Array.from(document.querySelectorAll('#sheet-body [data-act="gq-set"]')).find((x) => x.getAttribute('data-level') !== q); return b ? b.getAttribute('data-level') : null; }, s0.q);
  const c4 = lvl ? await domClick('#sheet-body [data-act="gq-set"][data-level="' + lvl + '"]') : false; await sleep(300);
  const s1 = await ev(() => ({ snd: DG.sfx.enabled(), bgm: DG.bgm.enabled(), fog: DG.villageView3d.fogOn(), q: DG.villageView3d.qualityRaw() }));
  await ev((s) => { DG.sfx.setEnabled(s.snd); DG.bgm.setEnabled(s.bgm); DG.villageView3d.setFogOn(s.fog); DG.villageView3d.setQuality(s.q); DG.ui.closeSheet(); }, s0);
  check('fs.ui-2 설정 — 효과음·음악·안개 단추로 켜짐이 뒤집히고, 품질 단추로 등급이 바뀐다',
    c1 && c2 && c3 && c4 && s1.snd === !s0.snd && s1.bgm === !s0.bgm && s1.fog === !s0.fog && s1.q === lvl, JSON.stringify({ s0, s1, lvl }));

  /* fs.sfx·fs.account·fs.core */
  const ms = await ev(() => { var A = DG.account, cur = A.current(); DG.core.persist(); var raw = JSON.parse(localStorage.getItem(A.keyOf(cur.id)) || '{}'); DG.core.setTune('zz.w0096', 3); var t = [DG.core.tuned('zz.none', 7), DG.core.tuned('zz.w0096', 9)]; DG.core.setTune('zz.w0096', null); return { cues: Object.keys(DG.sfx.CUES).length, track: DG.bgm.desiredTrack(), key: A.keyOf(cur.id), id: cur.id, v: raw.v, saveV: DG.core.save.v, tuned: t }; });
  check('fs.sfx 소리 — 효과음 단서 20 이상, 마을 BGM 트랙은 forest', ms.cues >= 20 && ms.track === 'forest', JSON.stringify({ cues: ms.cues, track: ms.track }));
  check('fs.account 계정 — 세이브 키 yeoksa-village/save/<프로필>', ms.key === 'yeoksa-village/save/' + ms.id, ms.key);
  check('fs.core 세이브·손잡이 — 저장본 v:1, core.tuned 는 없으면 기본값·잡으면 그 값', ms.v === 1 && ms.saveV === 1 && ms.tuned[0] === 7 && ms.tuned[1] === 3, JSON.stringify({ v: ms.v, tuned: ms.tuned }));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-fs-close2.json', JSON.stringify({ script: 'pw-fs-close2.mjs', game: 'saga-forest', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
