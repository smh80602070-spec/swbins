// 2D 모드 확인 그림 — 판마다 새 계정으로 들어가 2D 로 돌리고 한 장 찍는다(W-0019~0024). 사용자가 "보여줘" 했을 때만 쓴다.
//   node pw-look2d.mjs <판 폴더> <저장 경로.png> [장면]
//   saga-story [field|cave|gorge] · saga-go [map|near|enc|walk] · saga-forest [village|home|night|walk] · saga-dungeon [town|room|deep] · saga-realm [map|near]
//   (W-0106 — 판마다 장면 2~3: 가까이·조우 카드·집 안·밤·던전 방·깊은 층·지도 확대)
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 전용 새 프로필, 끝나면 스스로 닫는다.
import { open, sleep } from './pw.mjs';
import { clearOverlays, beforeShot } from './overlay.mjs';   // W-0317 ⑦ 가리는 창 공용

const [game, dest, scene] = [process.argv[2] || 'saga-story', process.argv[3] || 'look2d.png', process.argv[4]];
const r = await open(game, { w: +(process.env.GW || 1280), h: +(process.env.GH || 720) });   // W-0204 폰 세로는 GW=390 GH=844
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
const skip = () => clearOverlays(page, game, { keep: ['sheet', 'detail', 'encounter'] });   // W-0317 ⑦ 공용 — 4종횡은 Esc 가 메뉴를 열어 API 로만 닫는다
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
    if (scene === 'near') { for (let z = 0; z < 2; z++) { await ev(() => document.getElementById('btn-map-zoomin').click()); await sleep(300); } }
    else { for (let z = 0; z < 3; z++) { await ev(() => document.getElementById('btn-map-zoomout').click()); await sleep(300); } }
    if (scene === 'base') { await ev(() => { DG.cfg.mode2d.on = () => false; }); }
    await ev(() => { DG.core.emit('changed'); }); await sleep(2500);
  } else if (game === 'saga-story') {
    const stage = scene || 'field';
    await ev((s) => { if (!DG.side.enter(s)) { DG.side.enter(s, DG.sideData.stage(s)); } }, stage); await sleep(1500);   // 레벨 문턱이 있는 사냥터(동굴·협곡)는 stgOverride 로(W-0106 — 문턱에 막혀 신야성이 찍혔다)
    if (await ev(() => DG.sideView3d && DG.sideView3d.ready && DG.sideView3d.ready())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(1500); }
    await ev(() => { const R = DG.side.raw(); R.hp = R.hpMax = 99999; });
    for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(400); }   // 사냥터 첫 대사(동굴·협곡) — 연출 암전이 걷히게
    await sleep(2500);
  } else if (game === 'saga-forest') {
    if (await ev(() => DG.villageView3d && DG.villageView3d.active && DG.villageView3d.active())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(1500); }
    if (scene === 'home') { await ev(() => { DG.village.enterHome(); DG.core.emit('changed'); }); }
    if (scene === 'rain' || scene === 'clear') { await ev((k) => { if (DG.weather && DG.weather.force) { DG.weather.force(k); } DG.core.emit('changed'); }, scene); await sleep(1500); }   // W-0377 날씨 고정(비 = 주민 집으로)
    if (scene === 'night') { await ev(() => { DG.core.setTune('time.phase', 'night'); DG.core.emit('changed'); }); }
    await sleep(2500);
  } else if (game === 'saga-dungeon') {
    await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });   // 출사표
    await sleep(3000);
    if (await ev(() => DG.dungeon3d && DG.dungeon3d.wanted())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(2500); }
    for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent)) { b.click(); } }); const c = document.getElementById('sheet-close'); if (c && c.offsetParent) { c.click(); } }); await sleep(400); }
    if (scene === 'room' || scene === 'deep') {
      await ev((f) => { if (DG.town && DG.town.leave) { DG.town.leave(); } DG.dungeon.enter({ floor: f }); }, scene === 'deep' ? 12 : 1); await sleep(2500);
      for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent)) { b.click(); } }); const c = document.getElementById('sheet-close'); if (c && c.offsetParent) { c.click(); } }); await sleep(300); }
      await ev(() => { const R = DG.dungeon.raw(); if (R) { R.hp = R.hpMax = 999999; } });
      for (let i = 0; i < 24 && await ev(() => !!(DG.loadVeil && DG.loadVeil.shown())); i++) { await sleep(500); }   // W-0347 가림막(GLB 받기 — 2D 판도 같은 막)이 걷힐 때까지 · 12초 넘으면 걷고 찍는다
      await ev(() => { if (DG.loadVeil && DG.loadVeil.shown()) { console.warn('W-0347 loadVeil 12초 — 걷고 찍음'); DG.loadVeil._hide(); } });
    }
    await sleep(1200);
  } else if (game === 'saga-go') {
    for (let i = 0; i < 3 && await ev(() => DG.core.save.settings.tilt !== 0); i++) { await ev(() => document.getElementById('btn-tilt').click()); await sleep(1500); }   // 시점 2D = 2D 캔버스 판
    if (scene === 'near') { await page.mouse.move(640, 360); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -400); await sleep(250); } }   // 휠로 당겨 인물·집 크기 비율을 본다
    if (scene === 'enc') { await ev(() => { const s = DG.world.spawns[0]; if (s && DG.encounter && DG.encounter.open) { DG.encounter.open(s); } }); }
    await sleep(2000);
  }
  if (scene === 'walk') {   // W-0203 걷는 중 0.1초 간격 4장(나 둘레) — <저장>_1~4 · 디딘 발이 땅에 머무는 동안 몸이 나아가나
    await ev(() => { const M = DG.mode2d, o0 = M.draw; window.__w203 = []; M.draw = function (c, o) { if (o && o.stride != null && /walk/.test(o.clip || '')) { window.__w203.push({ t: performance.now(), s: o.stride, sc: o.scale }); } return o0.apply(this, arguments); }; });   // 걷기 위상 기록(재기)
    if (game === 'saga-forest') { await ev(() => DG.village.setJoy(1, 0)); } else { await page.keyboard.down('w'); }
    await sleep(1200);
    for (let i = 1; i <= 4; i++) { await page.screenshot({ path: dest.replace(/(\.\w+)$/, '_' + i + '$1'), clip: { x: 520, y: 240, width: 240, height: 220 } }); await sleep(100); }
    if (game === 'saga-forest') { await ev(() => DG.village.setJoy(0, 0)); } else { await page.keyboard.up('w'); }
    console.log('걷기 위상', JSON.stringify(await ev(() => { const a = window.__w203 || [], n = a.length; if (n < 2) { return { n }; } let cyc = 0; for (let i = 1; i < n; i++) { const d = a[i].s - a[i - 1].s; cyc += d < -0.5 ? d + 1 : Math.max(0, d); } const sec = (a[n - 1].t - a[0].t) / 1000; return { n, sec: +sec.toFixed(2), hz: +(cyc / sec).toFixed(2), frames: [...new Set(a.slice(-12).map((x) => Math.floor(x.s * 8)))] }; })));
  }
  const body = await ev(() => new Promise((res) => { const M = DG.mode2d, p0 = M.pace, seen = {}; M.pace = function (k, x, y, u, bp) { seen[k] = Math.round(bp); return p0.apply(this, arguments); }; setTimeout(() => { M.pace = p0; const ks = Object.keys(seen); res({ me: seen.player || seen.me || seen['me:in'] || null, others: ks.filter((k) => !/^(player|me|me:in)$/.test(k)).slice(0, 4).map((k) => seen[k]) }); }, 1200); }));   // W-0204 몸 px(pace 가 받는 bodyPx — 보폭 쓰는 배우만)
  const info = await ev(() => ({ w: innerWidth, h: innerHeight }));
  if (process.env.LOOK_EVAL) { await ev((src) => { (0, eval)(src); }, process.env.LOOK_EVAL); await sleep(1500); }   // W-0372 찍기 전 장면 손질(예: 나를 숲 칸으로)
  if (process.env.LOOK_TUNE) { await ev((kv) => { kv.split(',').forEach((x) => { const i = x.indexOf('='); DG.core.setTune(x.slice(0, i), +x.slice(i + 1)); }); }, process.env.LOOK_TUNE); await sleep(700); }   // W-0347 비교판 — 찍기 직전 손잡이(예: mode2d.mip=0)
  { const cov = await beforeShot(page, game, { keep: ['sheet', 'detail', 'encounter'] }); if (cov.length) { console.log('covered', cov.join(',')); } }
  await page.screenshot(dest.endsWith('.jpg') ? { path: dest, type: 'jpeg', quality: 72 } : { path: dest });
  console.log('저장', dest, JSON.stringify(info), '몸px', JSON.stringify(body), r.errors.length ? 'errors ' + JSON.stringify(r.errors.slice(0, 3)) : '');
} finally { await r.close(); }
