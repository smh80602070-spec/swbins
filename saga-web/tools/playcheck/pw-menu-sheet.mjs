// 메뉴 UI 모음 그림(W-0252~0256) — 판마다 새 계정으로 들어가 독 단추(숨긴 것까지)를 차례로 눌러 시트마다 한 장 + 안내 모달 한 장 + 메뉴 화면(있으면),
// PC(1280×720)·폰(390×844) 두 벌을 각각 한 장 모음 PNG 로. Claude 가 Read 로 틀 깨짐·글자 넘침·대비를 본다.
//   node pw-menu-sheet.mjs <판 폴더> [pc|phone]   → shots/menu/<판>-pc.png · <판>-phone.png (없으면 둘 다)
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 전용 새 프로필, 끝나면 스스로 닫는다.
import { open, sleep } from './pw.mjs';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(import.meta.url)(path.resolve(HERE, '../../../tools/glb-compress/node_modules/sharp'));
const game = process.argv[2] || 'saga-go', only = process.argv[3];
const OUT = path.join(HERE, 'shots', 'menu');
fs.mkdirSync(OUT, { recursive: true });

async function enter(r) {
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  r.titleShot = await page.screenshot();   // W-0256 첫 화면(이어하기·다른 이름으로·설정)
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(2500);
  for (let i = 0; i < 14; i++) { const o = await ev(() => !!((DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) || (DG.story && DG.story.isOpen && DG.story.isOpen()))); if (!o) { break; } await page.keyboard.press('Escape'); await sleep(250); }
  await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });
  if (game === 'saga-realm') {
    await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);
    await page.locator('[data-act="pick-force"]').first().click(); await sleep(2500);
  } else if (game === 'saga-dungeon') {
    await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3000);
  }
  for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
}

/** 열린 창을 다 닫는다(시트·모달·상세·메뉴 화면) */
async function closeAll(page) {
  await page.evaluate(() => {
    const c = document.getElementById('sheet-close'); if (c && c.offsetParent) { c.click(); }
    document.querySelectorAll('#encounter .enc-card [data-act="close-enc"], #help-ok, .dt-x').forEach((b) => { if (b.offsetParent) { b.click(); } });
    const e = document.getElementById('encounter'); if (e) { e.classList.remove('show'); }
    const m = document.getElementById('menu-grid'); if (m && m.classList.contains('show')) { m.classList.remove('show'); }
    if (DG.passiveWebUI && DG.passiveWebUI.isOpen()) { DG.passiveWebUI.close(); }
    if (DG.goalsPanel && DG.goalsPanel.isOpen()) { DG.goalsPanel.close(); }
    document.querySelectorAll('.mg-x').forEach((b) => { if (b.offsetParent) { b.click(); } });   // 「내 정보」 등 같은 틀 창의 ✕   // 「오늘」 창 — 안 닫으면 뒤 메뉴·안내·☰ 사진이 다 오늘 창으로 찍혔다
    if (DG.minimap && DG.minimap.closeBig) { DG.minimap.closeBig(); }   // 2나락 오버월드 단추 = 큰 지도   // 성도·경락도 같은 패시브 그물 창(독 단추가 시트 대신 연다)
  });
  await sleep(350);
}

async function run(kind) {
  const W = kind === 'phone' ? 390 : 1280, H = kind === 'phone' ? 844 : 720;
  const r = await open(game, { w: W, h: H, mobile: kind === 'phone' });
  const { page } = r, shots = [];
  try {
    await enter(r);
    if (r.titleShot) { shots.push({ label: '첫 화면', buf: r.titleShot }); }
    await closeAll(page); await sleep(500); shots.push({ label: 'HUD', buf: await page.screenshot() });   // W-0257 창 없이 늘 떠 있는 것
    const n = process.env.TITLE_ONLY ? 0 : await page.evaluate(() => document.querySelectorAll('#dock button').length);   // TITLE_ONLY=1 — 첫 화면만(W-0256)
    for (let i = 0; i < n; i++) {
      await closeAll(page);
      const label = await page.evaluate((k) => { const b = document.querySelectorAll('#dock button')[k]; const s = b.querySelector('small'); const t = (s ? s.textContent : b.title || b.id || '?').trim(); b.click(); return t; }, i);
      await sleep(900);
      shots.push({ label, buf: await page.screenshot() });
    }
    await closeAll(page);
    const help = await page.evaluate(() => { const b = document.getElementById('btn-help'); if (b) { b.click(); return true; } if (DG.ui && DG.ui.showHelp) { DG.ui.showHelp(); return true; } return false; });
    if (help) { await sleep(700); shots.push({ label: '안내 모달', buf: await page.screenshot() }); await closeAll(page); }
    if (await page.evaluate(() => { const b = document.getElementById('btn-menu'); if (b) { b.click(); return true; } return false; })) { await sleep(700); shots.push({ label: '☰ 메뉴 화면', buf: await page.screenshot() }); }
  } finally { await r.close(); }
  const tw = kind === 'phone' ? 234 : 512, th = Math.round(tw * H / W), cols = kind === 'phone' ? 6 : 3, lh = 26;
  const rows = Math.ceil(shots.length / cols), comp = [];
  for (let i = 0; i < shots.length; i++) {
    const x = (i % cols) * (tw + 8) + 8, y = Math.floor(i / cols) * (th + lh + 8) + 8;
    comp.push({ input: await sharp(shots[i].buf).resize(tw, th).png().toBuffer(), left: x, top: y + lh });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${lh}"><text x="2" y="19" font-size="17" font-family="Malgun Gothic, sans-serif" fill="#fff">${i + 1}. ${shots[i].label.replace(/[<&]/g, '')}</text></svg>`;
    comp.push({ input: Buffer.from(svg), left: x, top: y });
  }
  const dest = path.join(OUT, `${game}-${kind}.png`), one = path.join(OUT, `${game}-${kind}`);
  fs.mkdirSync(one, { recursive: true });
  shots.forEach((s, i) => fs.writeFileSync(path.join(one, String(i + 1).padStart(2, '0') + '.png'), s.buf));   // 한 장씩 원본 크기(자세히 볼 때)
  await sharp({ create: { width: cols * (tw + 8) + 8, height: rows * (th + lh + 8) + 8, channels: 3, background: '#30343c' } }).composite(comp).png().toFile(dest);
  console.log('저장', dest, shots.length + '장', r.errors.length ? 'errors ' + JSON.stringify(r.errors.slice(0, 3)) : '', r.notFound.length ? '404 ' + JSON.stringify(r.notFound.slice(0, 5)) : '');
}

for (const k of only ? [only] : ['pc', 'phone']) { await run(k); }
