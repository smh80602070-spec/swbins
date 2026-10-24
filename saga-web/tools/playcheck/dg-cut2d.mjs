// 2나락 2D 화면 넘김 탐침(W-0405 사용자 「2d 는 마을로 가면 화면이 기존처럼 변경되는거 확인」) — 마을 → 1층 → 마을, 넘긴 뒤 0.05·0.2·0.6·1.5초 사진 + 막(#zone-cut) 불투명도·어디 있나
//   node dg-cut2d.mjs [저장 폴더]   (서버 :8871 — 돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const out = process.argv[2] || '.';
const r = await open('saga-dungeon', { w: 1280, h: 720 });
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
const state = () => ev(() => { const c = document.getElementById('zone-cut'); return { cut: c ? +getComputedStyle(c).opacity : -1, inTown: !!(DG.town && DG.town.active && DG.town.active()), inRun: !!(DG.dungeon && DG.dungeon.raw && DG.dungeon.raw()), d3: !!(DG.dungeon3d && DG.dungeon3d.active && DG.dungeon3d.active()) }; });
const log = [];
async function seq(tag, fn) {
  await ev(fn);
  for (const ms of [50, 200, 600, 1500]) { await sleep(ms - (log.length && log[log.length - 1].tag === tag ? log[log.length - 1].ms : 0)); const s = await state(); log.push({ tag, ms, ...s }); await page.screenshot({ path: `${out}/dg_cut_${tag}_${ms}.png` }); }
}
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(2500); await clearOverlays(page, 'saga-dungeon', { keep: [] });
  await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });
  await sleep(3000);
  if (await ev(() => DG.dungeon3d && DG.dungeon3d.active && DG.dungeon3d.active())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(2000); }
  for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent)) { b.click(); } }); const c = document.getElementById('sheet-close'); if (c && c.offsetParent) { c.click(); } }); await sleep(300); }
  log.push({ tag: 'start', ms: 0, ...(await state()) }); await page.screenshot({ path: `${out}/dg_cut_start.png` });
  await seq('enter', () => { if (DG.town && DG.town.leave) { DG.town.leave(); } DG.dungeon.enter({ floor: 1 }); });
  await sleep(1500);
  await seq('leave', () => { DG.dungeon.leave(); });
  console.log(JSON.stringify(log));
} finally { await r.close(); }
