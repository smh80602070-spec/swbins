// 다섯 판 「로딩되어서 생기는 것」 탐침(W-0449, 사용자 10-26 「맵 분할해도 되니 로딩되어서 생기게 하지는 마」)
//   판마다 2D·3D 로 새 계정 → 이어하기 → 가만히 서서 secs 초. 막(2나락 #load-veil·#zone-cut · 공용 #zone-cut2)이 걷힌 뒤에 받기가 끝난
//   그림·모델(glb·webp·png·jpg)을 「늦게 옴」으로 센다 — 0 이어야 한다(막 아래서 다 받고 걷기). 막이 전혀 안 떴는데 받은 것도 센다.
//   node popin5.mjs [판,…|all] [2d,3d] [secs=14]   (서버 :8871 — 돌리는 쪽이 띄우고 끈다)   → results/popin5.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = !process.argv[2] || process.argv[2] === 'all' ? ALL : process.argv[2].split(',');
const modes = (process.argv[3] || '2d,3d').split(',');
const secs = +(process.argv[4] || 14);
const out = { at: new Date().toISOString(), secs, rows: [] };

/* 페이지 안 기록기 — 0.1초마다 막 상태, 자원은 PerformanceObserver */
const REC = () => {
  window.__pi = { t0: performance.now(), veil: [], res: [] };
  const shown = () => {
    const lv = document.getElementById('load-veil'); if (lv && !lv.classList.contains('out')) { return 'veil'; }
    for (const id of ['zone-cut', 'zone-cut2']) { const z = document.getElementById(id); if (z && z.style.opacity === '1') { return id; } }
    return '';
  };
  let prev = null;
  setInterval(() => { const s = shown(); if (s !== prev) { window.__pi.veil.push([Math.round(performance.now() - window.__pi.t0), s]); prev = s; } }, 50);
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (/\.(glb|gltf|webp|png|jpe?g|ktx2)(\?|$)/i.test(e.name)) { window.__pi.res.push([Math.round(e.responseEnd - window.__pi.t0), e.name.replace(/^.*?\/(saga-web\/)?/, '').split('?')[0]]); } } });
  po.observe({ type: 'resource', buffered: false });
};

async function enter(r, game) {
  const ev = (f, a) => r.page.evaluate(f, a);
  if (game === 'saga-realm') {
    await sleep(1500);
    try { await r.page.locator('[data-act="pick-scen"]').first().click({ timeout: 4000 }); await sleep(600); await r.page.locator('[data-act="pick-force"]').first().click({ timeout: 4000 }); } catch (e) { /* 이미 고름 */ }
  } else if (game === 'saga-dungeon') {
    await sleep(1500);
    await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });
  }
}

for (const game of games) {
  for (const mode of modes) {
    const r = await open(game, { w: 1280, h: 720, gpu: true });
    const ev = (f, a) => r.page.evaluate(f, a);
    const row = { game, mode };
    try {
      await r.page.goto(r.url('index.html?mode=' + mode), { waitUntil: 'domcontentloaded' }); await sleep(1500);
      await ev(() => { try { localStorage.clear(); } catch (e) { /* noop */ } DG.account.create('팝인'); });
      await r.page.goto(r.url('index.html?mode=' + mode), { waitUntil: 'domcontentloaded' }); await sleep(2500);
      await ev(REC);
      await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
      await enter(r, game);
      const tEnd = Date.now() + secs * 1000;
      while (Date.now() < tEnd) { await sleep(700); await clearOverlays(r.page, game).catch(() => {}); }
      const pi = await ev(() => window.__pi);
      /* 막이 마지막으로 걷힌 때(+페이드 0.35초) — 그 뒤 끝난 받기 = 늦게 옴. 막이 한 번도 안 떴으면 들어간 뒤 받은 것 전부 */
      let lastOff = 0, anyVeil = false;
      for (const [t, s] of pi.veil) { if (s) { anyVeil = true; } else if (anyVeil) { lastOff = t; } }
      const thr = anyVeil ? lastOff + 350 : 0;
      const late = pi.res.filter(([t]) => t > thr);
      row.veil = pi.veil; row.lastOff = lastOff; row.anyVeil = anyVeil; row.total = pi.res.length; row.late = late.length;
      row.lateList = late.slice(0, 12).map(([t, n]) => t + 'ms ' + n);
      row.where = await ev(() => { const D = DG; return { town: !!(D.town && D.town.active && D.town.active()), dungeon: !!(D.dungeon && D.dungeon.active && D.dungeon.active()), floor: D.dungeon && D.dungeon.raw && D.dungeon.raw() ? D.dungeon.raw().floor : null }; });
      row.is3d = await ev(() => { const D = DG; return !!((D.world3d && D.world3d.active && D.world3d.active()) || (D.dungeon3d && D.dungeon3d.active && D.dungeon3d.active()) || (D.villageView3d && D.villageView3d.active && D.villageView3d.active()) || (D.sideView3d && D.sideView3d.active && D.sideView3d.active()) || (D.realm3d && D.realm3d.active && D.realm3d.active())); });
    } catch (e) { row.err = e.message.slice(0, 200); }
    row.errors = r.errors.filter((e) => !/404/.test(e)).slice(0, 3);
    console.log('ROW', game, mode, 'is3d', row.is3d, JSON.stringify(row.where), 'veil', JSON.stringify(row.veil), 'late', row.late, '/', row.total, row.err || '');
    for (const l of row.lateList || []) { console.log('   ', l); }
    out.rows.push(row);
    await r.close();
  }
}
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'popin5.json'), JSON.stringify(out, null, 1));
console.log('SUMMARY', out.rows.map((x) => x.game.replace('saga-', '') + ':' + x.mode + '=' + (x.err ? 'ERR' : x.late)).join(' '));
