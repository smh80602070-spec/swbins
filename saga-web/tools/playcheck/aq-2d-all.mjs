// node saga-web/tools/playcheck/aq-2d-all.mjs [판…] → shots/aq2d-<판>-{0,1}.png + 콘솔
// 다섯 판 2D(?mode=2d) 자동 퀘스트 확인(사용자 10-26 「다섯판 2d 모두 자동퀘스트 확인」) — ▶(#aq-go) 가 보이나 · 누르면 ⏸ 로 바뀌고
// 12초 동안 멈추지 않나 · 위치(있으면)가 움직이나 · 콘솔 오류.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAMES = process.argv.slice(2).length ? process.argv.slice(2) : ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const ST = `JSON.stringify((function(){ var b = document.getElementById('aq-go'), r = b ? b.getBoundingClientRect() : null, cs = b ? getComputedStyle(b) : null, S = DG.core && DG.core.save, p = null;
  var src = [DG.town, DG.village, DG.side, DG.sidescroll].filter(function (o) { return o && o.raw && o.raw() && o.raw().player; })[0]; if (src) { var m = src.raw().player; p = [Math.round(m.x), Math.round(m.y)]; } else if (S && S.player && S.player.pos) { p = [Math.round(S.player.pos.x), Math.round(S.player.pos.y)]; }   // 판 어댑터 pos() 와 같은 곳(1만리만 save.player.pos)
  return { btn: !!b, shown: !!(r && r.width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0), txt: b ? b.textContent.trim().slice(0, 12) : '', title: b ? (b.title || '').slice(0, 40) : '', pos: p,
    cpg: document.body.classList.contains('cpg-on') }; })())`;
let port = 8920;
for (const g of GAMES) {
  const PORT = port++, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', g)], { stdio: 'ignore' });
  await sleep(800);
  const c = await launch(1280, 720);
  const errs = [];
  const hard = setTimeout(() => { console.log(g, 'TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 240000);
  try {
    await c.send('Network.setBypassServiceWorker', { bypass: true });
    await c.send('Runtime.enable');
    if (c.on) { c.on('Runtime.exceptionThrown', (e) => errs.push((e.exceptionDetails && e.exceptionDetails.exception && e.exceptionDetails.exception.description || '').split('\n')[0].slice(0, 120))); }
    const B = `http://127.0.0.1:${PORT}/index.html?mode=2d`;
    await c.go(B, 6000);
    await c.ev(`(function(){ try { localStorage.clear(); } catch (e) {} if (DG.account && DG.account.create) { DG.account.create('자동퀘'); } })()`);
    await c.go(B, 8000);
    await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
    await sleep(4000);
    await c.ev(`(function(){ var s = document.querySelector('[data-act="pick-scen"]'); if (s) { s.click(); } })()`); await sleep(600);
    await c.ev(`(function(){ var s = document.querySelector('[data-act="pick-force"]'); if (s) { s.click(); } })()`); await sleep(3000);
    /* 첫 시작 화면 넘기기 — 2나락 출사표(셋 고르고 올림) · 4종횡 서막(건너뛰기) · 대사 상자 */
    for (let k = 0; k < 8; k++) {
      await c.ev(`(function(){ var c = document.querySelectorAll('.stc-cell'); if (c.length) { for (var i = 0; i < 3 && i < c.length; i++) { c[i].click(); } var b = document.querySelector('.stc-btn'); if (b) { b.click(); } }
        [].slice.call(document.querySelectorAll('button')).forEach(function (b) { if (b.textContent.trim() === '건너뛰기' && b.offsetParent) { b.click(); } }); })()`);
      await sleep(1500);
    }
    await sleep(2000);
    const s0 = JSON.parse(await c.ev(ST));
    const sh0 = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, 'aq2d-' + g + '-0.png'), Buffer.from(sh0.result.data, 'base64'));
    await c.ev(`(function(){ var b = document.getElementById('aq-go'); if (b) { b.click(); } })()`);
    const seq = [];
    for (let i = 0; i < 4; i++) { await sleep(3000); const s = JSON.parse(await c.ev(ST)); seq.push(s.txt + (s.pos ? '@' + s.pos.join(',') : '')); }
    const sh1 = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, 'aq2d-' + g + '-1.png'), Buffer.from(sh1.result.data, 'base64'));
    console.log(g, '처음', JSON.stringify(s0), '| 누른 뒤 3초마다', seq.join(' → '), errs.length ? '| 오류 ' + errs.slice(0, 2).join(' / ') : '');
  } catch (e) { console.log(g, 'ERR', e.message.slice(0, 200)); }
  clearTimeout(hard); c.close(); srv.kill();
}
