// 2D 모드 확인 그림 — 판마다 새 계정으로 들어가 2D 로 돌리고 한 장 찍는다(W-0019~0024). 사용자가 "보여줘" 했을 때만 쓴다.
//   node pw-look2d.mjs <판 폴더> <저장 경로.png> [장면]
//   saga-story [field|cave|gorge] · saga-go [map] · saga-forest [village] · saga-dungeon [town] · saga-realm [map]
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 전용 새 프로필, 끝나면 스스로 닫는다.
import { open, sleep } from './pw.mjs';

const [game, dest, scene] = [process.argv[2] || 'saga-story', process.argv[3] || 'look2d.png', process.argv[4]];
const r = await open(game, { w: 1280, h: 720 });
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
const skip = async () => { for (let i = 0; i < 14; i++) { const open1 = await ev(() => !!((DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) || (DG.story && DG.story.isOpen && DG.story.isOpen()))); if (!open1) { break; } await page.keyboard.press('Escape'); await sleep(250); } };
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(2500); await skip();
  await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });

  if (game === 'saga-realm') {
    await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);
    await page.locator('[data-act="pick-force"]').first().click(); await sleep(2500);
    if (await ev(() => DG.realm3d && DG.realm3d.active())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(1500); }
    for (let z = 0; z < 3; z++) { await ev(() => document.getElementById('btn-map-zoomout').click()); await sleep(300); }
    if (scene === 'base') { await ev(() => { DG.cfg.mode2d.on = () => false; }); }
    await ev(() => { DG.core.emit('changed'); }); await sleep(2500);
  } else if (game === 'saga-story') {
    const stage = scene || 'field';
    await ev((s) => DG.side.enter(s), stage); await sleep(1500);
    if (await ev(() => DG.sideView3d && DG.sideView3d.ready && DG.sideView3d.ready())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(1500); }
    await ev(() => { const R = DG.side.raw(); R.hp = R.hpMax = 99999; });
    await sleep(1500);
  } else if (game === 'saga-forest') {
    if (await ev(() => DG.villageView3d && DG.villageView3d.active && DG.villageView3d.active())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(1500); }
    await sleep(2500);
  } else if (game === 'saga-dungeon') {
    await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });   // 출사표
    await sleep(3000);
    if (await ev(() => DG.dungeon3d && DG.dungeon3d.wanted())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(2500); }
    for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent)) { b.click(); } }); const c = document.getElementById('sheet-close'); if (c && c.offsetParent) { c.click(); } }); await sleep(400); }
    await sleep(1200);
  } else if (game === 'saga-go') {
    for (let i = 0; i < 3 && await ev(() => DG.core.save.settings.tilt !== 0); i++) { await ev(() => document.getElementById('btn-tilt').click()); await sleep(1500); }   // 시점 2D = 2D 캔버스 판
    await sleep(2000);
  }
  const info = await ev(() => ({ w: innerWidth, h: innerHeight }));
  await page.screenshot(dest.endsWith('.jpg') ? { path: dest, type: 'jpeg', quality: 72 } : { path: dest });
  console.log('저장', dest, JSON.stringify(info), r.errors.length ? 'errors ' + JSON.stringify(r.errors.slice(0, 3)) : '');
} finally { await r.close(); }
