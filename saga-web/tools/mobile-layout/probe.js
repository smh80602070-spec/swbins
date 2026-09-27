#!/usr/bin/env node
/**
 * 폰 배치 점검 — 다섯 판을 헤드리스 크롬 모바일 에뮬레이션으로 띄워 UI 배치를 **숫자로** 잰다.
 * 스크린샷은 --shot 을 줄 때만(사용자가 요청할 때 — 루트 CLAUDE.md 검증 절). 재는 것은 measure.js 머리 주석.
 *
 *   node probe.js                     다섯 판 · 세로(390×844)·가로(844×390) · 판마다 장면 전부
 *   node probe.js saga-go saga-realm  고른 판만
 *   --scene=main,sheets               고른 장면만(main·intro·sheets=시트 전부·'시트:<id>')
 *   --only=portrait | landscape       방향 하나만
 *   --json=<파일>                     결과 전체를 JSON 으로
 *   --list                            장면마다 보이는 단추 목록도 찍는다(장면 짤 때)
 *   --wait=<초>                       첫 화면 기다림(기본 8)
 *   --eval=<식>                       장면마다 그 식 값을 찍는다(고칠 때)
 *   --rects=#a,.b                     장면마다 그 요소들의 사각형을 찍는다(고칠 때)
 *   --shot=<폴더>                     장면마다 스크린샷 PNG(사용자가 요청할 때만 — 루트 CLAUDE.md)
 *   --perf                            장면마다 한 화면 부하(GLB·배우·그리기 호출·삼각형·인스턴스, perf.js)
 *
 * - 판 폴더를 자기 포트(빈 포트)에서 `tools/lib/gameserve.js` 로 서빙한다 — 서비스워커는 스스로 풀리는 빈 것,
 *   출처가 달라 **실제 세이브(8791~)와 안 섞인다.** 새 연습용 프로필로 들어간다.
 * - 크롬은 전용 --user-data-dir 로 직접 띄우고 끝나면 **그 PID 만** `taskkill /T /F`(사용자 크롬 안 건드림).
 * - 헤드리스는 document.hasFocus() 가 false 라 판 루프가 멈춘다 → 새 문서마다 true 로 갈아 둔다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const gameserve = require('../lib/gameserve.js');
const measure = require('./measure.js');
const perf = require('./perf.js');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const VIEWS = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };

/* 판마다 — 세이브 뿌리(연습용 프로필 심기) · 준비 판정 · 장면(측정 전에 페이지에서 부를 식) */
const GAMES = require('./games.js');

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const pick = argv.filter(a => !a.startsWith('--'));
const games = pick.length ? pick : Object.keys(GAMES);
const sceneOnly = opt.scene ? String(opt.scene).split(',') : null;
const views = opt.only ? [opt.only] : Object.keys(VIEWS);
const WAIT = Number(opt.wait || 8) * 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 서버 ─────────────────────────────────────────────────────────── */
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (!gameserve.handle(req, res, u, ROOT, Object.keys(GAMES))) { res.writeHead(404); res.end(); }
});

/* ── 크롬 ─────────────────────────────────────────────────────────── */
let chrome = null, prof = null;
function killChrome() {
  if (chrome && chrome.pid) {
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) { /* 이미 끝남 */ }
  }
  chrome = null;
  if (prof) { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* 잠김 — 임시 폴더라 둔다 */ } prof = null; }
}
process.on('exit', killChrome);
process.on('SIGINT', () => { killChrome(); process.exit(1); });

async function openChrome() {
  const dbg = 9500 + Math.floor(Math.random() * 400);
  prof = fs.mkdtempSync(path.join(os.tmpdir(), 'saga-mlayout-'));
  chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${dbg}`, `--user-data-dir=${prof}`,
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
    '--no-first-run', '--mute-audio', '--window-size=900,900',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json();
      const t = list.find(x => x.type === 'page');
      if (t) { return t.webSocketDebuggerUrl; }
    } catch (e) { /* 아직 */ }
    await sleep(500);
  }
  throw new Error('크롬 디버그 포트가 안 열림');
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nid = 0; const waits = new Map(); const errs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waits.has(m.id)) { const w = waits.get(m.id); waits.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push((d.exception && d.exception.description || d.text || '').split('\n')[0]);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++nid; waits.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  async function ev(expr, timeout = 30000) {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate 시간 초과')), timeout)),
    ]);
    if (r.exceptionDetails) { throw new Error(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text); }
    return r.result.value;
  }
  return new Promise((res, rej) => { ws.onopen = () => res({ ws, send, ev, errs }); ws.onerror = rej; });
}

async function setView(c, v) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: 3, mobile: true,
    screenOrientation: v.width > v.height ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } });
}

/* 보이는 단추 목록(장면 짤 때) */
const LIST_JS = `(function(){var o=[];document.querySelectorAll('button,[role=button],[onclick],a[href],[data-sheet]').forEach(function(b){
  if(!b.checkVisibility||!b.checkVisibility({opacityProperty:true,visibilityProperty:true}))return;var r=b.getBoundingClientRect();if(r.width<1)return;
  o.push((b.id?'#'+b.id:b.tagName.toLowerCase()+(b.className&&typeof b.className==='string'?'.'+b.className.trim().split(/\\s+/)[0]:''))+' '+(b.innerText||b.title||'').replace(/\\s+/g,' ').trim().slice(0,14)+' @'+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height))});return o})()`;

function fmt(res) {
  const L = [];
  Object.keys(res.modal || {}).forEach(k => L.push(`  (창 ${k} 열림 — 밑 단추 ${res.modal[k]}개 가림, 안 셈)`));
  if (res.hscroll) { L.push(`  가로 스크롤 ${res.hscroll}px`); }
  res.off.forEach(x => L.push(`  화면밖 ${x.out}px  ${x.el} "${x.text}" [${x.rect.join(',')}]`));
  (res.unreach || []).forEach(x => L.push(`  닿지않음 ${x.out}px  ${x.el} "${x.text}" ← ${x.by}`));
  res.clip.forEach(x => L.push(`  잘림 ${x.lost}%  ${x.el} "${x.text}" ← ${x.by}`));
  res.covered.forEach(x => L.push(`  가림  ${x.el} "${x.text}" ← ${x.by} "${x.byText}" @${x.at}`));
  res.overlap.forEach(x => L.push(`  겹침 ${x.size}  ${x.a} "${x.aText}" × ${x.b} "${x.bText}"`));
  res.tap.forEach(x => L.push(`  터치 ${x.w}x${x.h}  ${x.el} "${x.text}"`));
  res.font.forEach(x => L.push(`  글자 ${x.px}px  ${x.el} "${x.text}"`));
  return L;
}
function count(res) {
  return (res.hscroll ? 1 : 0) + res.off.length + (res.unreach || []).length + res.clip.length + res.covered.length + res.overlap.length + res.tap.length + res.font.length;
}

async function runGame(game) {
  const G = GAMES[game];
  const out = [];
  const c = await cdp(await openChrome());
  try {
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await c.send('Emulation.setUserAgentOverride', { userAgent: UA, platform: 'Android' });
    await setView(c, VIEWS[views[0]]);
    /* 새 문서마다 — 포커스 속임 + 연습용 프로필(가입 화면 건너뛰기) */
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      document.hasFocus = function () { return true; };
      try {
        var K = ${JSON.stringify(G.base + '/accounts')};
        if (!localStorage.getItem(K)) { localStorage.setItem(K, JSON.stringify({ list: [{ id: 'pmlayout', name: '배치점검', at: 1, lastSeen: 1 }], cur: 'pmlayout' })); }
        ${G.preload || ''}
      } catch (e) {}` });
    const port = server.address().port;
    await c.send('Page.navigate', { url: `http://127.0.0.1:${port}/play/${game}/index.html` });
    await sleep(WAIT);
    await c.ev(`(${G.pass.toString()})()`).catch(e => out.push('  (넘기기 실패 ' + e.message + ')'));
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      ready = await c.ev(`(function(){try{return !!(${G.ready})}catch(e){return false}})()`).catch(() => false);
      if (!ready) { await c.ev(`(${G.pass.toString()})()`).catch(() => {}); await sleep(1000); }
    }
    if (!ready) { out.push('  ⚠ 가입 화면이 안 걷힘'); }
    await sleep(1500);
    await c.ev(`window.__sagaMeasure = ${measure.toString()}; true`);
    const all = {};
    const shot = async (vName, s, scope) => {
      const res = await c.ev(`__sagaMeasure(${JSON.stringify({ ignore: G.ignore || null, modal: G.modal || null, scope: scope || null })})`);
      all[vName + '/' + s] = res;
      out.push(`  ── ${vName} ${res.vw}×${res.vh} · ${s} : ${count(res)}건`);
      fmt(res).forEach(l => out.push('  ' + l));
      if (opt.list) { (await c.ev(LIST_JS)).forEach(l => out.push('      · ' + l)); }
      if (opt.eval) { out.push('      = ' + JSON.stringify(await c.ev(String(opt.eval)).catch(e => e.message))); }
      if (opt.shot) {
        fs.mkdirSync(String(opt.shot), { recursive: true });
        const p = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: res.vw, height: res.vh, scale: 1 / 3 } });
        fs.writeFileSync(path.join(String(opt.shot), (game + '_' + vName + '_' + s).replace(/[:\/]/g, '-') + '.png'), Buffer.from(p.data, 'base64'));
      }
      if (opt.perf) { out.push('      ⚙ ' + await c.ev(`(${perf.toString()})()`).catch(e => e.message)); }
      if (opt.rects) {
        const R = await c.ev(`(function(){return ${JSON.stringify(String(opt.rects).split(','))}.map(function(q){var e=document.querySelector(q);if(!e)return q+' 없음';var r=e.getBoundingClientRect();return q+' '+Math.round(r.left)+','+Math.round(r.top)+' ~ '+Math.round(r.right)+','+Math.round(r.bottom)})})()`);
        R.forEach(l => out.push('      □ ' + l));
      }
    };
    /* 첫 고르기 창(출사표·시나리오·첫 장면) — 그 창 자체를 잰 뒤 넘긴다 */
    if (G.onboard) {
      if (!sceneOnly || sceneOnly.indexOf('intro') >= 0) {
        for (const vName of views) { await setView(c, VIEWS[vName]); await sleep(1000); await shot(vName, 'intro'); }
      }
      let done = false;
      for (let i = 0; i < 20 && !done; i++) {
        await c.ev(`(${G.onboard.toString()})()`).catch(e => out.push('  (첫 창 넘기기 ' + e.message + ')'));
        await sleep(1200);
        done = await c.ev(`(function(){try{return !!(${G.started || 'true'})}catch(e){return false}})()`).catch(() => false);
      }
      if (!done) { out.push('  ⚠ 첫 창을 못 넘김'); }
      await sleep(1500);
    }

    /* 시트 장면 — 독의 [data-sheet] 단추마다 하나씩(열고 창 안쪽만 재고 닫는다) */
    if (G.sheets !== false) {
      const ids = await c.ev(`Array.from(document.querySelectorAll(${JSON.stringify(G.sheets || '#dock [data-sheet]')})).map(b => b.dataset.sheet)`).catch(() => []);
      ids.filter(id => (G.skipSheets || []).indexOf(id) < 0).forEach(id => {
        G.scenes['시트:' + id] = {
          open: `var b = document.querySelector('[data-sheet="${id}"]'); if (b) { b.click(); }`,
          close: "var x = document.getElementById('sheet-close'); if (x && x.offsetParent) { x.click(); }" + (G.closeExtra || ''),
          scope: G.sheetScope || '#sheet', wait: 1200,
        };
      });
    }
    const scenes = Object.keys(G.scenes).filter(s => !sceneOnly || sceneOnly.indexOf(s) >= 0 || (sceneOnly.indexOf('sheets') >= 0 && s.indexOf('시트:') === 0));
    for (const vName of views) {
      await setView(c, VIEWS[vName]);
      await sleep(1200);
      for (const s of scenes) {
        const sc = G.scenes[s];
        if (G.closeExtra) { await c.ev(`(function(){${G.closeExtra}})()`).catch(() => {}); }
        if (sc.open) {
          for (let k = 0; k < (sc.repeat || 1); k++) {
            await c.ev(`(function(){${sc.open}})()`).catch(e => out.push(`  [${s}] 열기 실패 ${e.message}`));
            await sleep(sc.wait || 900);
          }
        }
        await shot(vName, s, sc.scope);
        if (sc.close) { await c.ev(`(function(){${sc.close}})()`).catch(() => {}); await sleep(500); }
      }
    }
    if (c.errs.length) { out.push('  (페이지 오류 ' + c.errs.length + ': ' + c.errs.slice(0, 2).join(' | ') + ')'); }
    return { lines: out, results: all };
  } finally {
    try { c.ws.close(); } catch (e) { /* */ }
    killChrome();
  }
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const json = {};
  let total = 0;
  for (const g of games) {
    if (!GAMES[g]) { console.log(`모르는 판 ${g}`); continue; }
    console.log(`== ${g}`);
    try {
      const r = await runGame(g);
      r.lines.forEach(l => console.log(l));
      json[g] = r.results;
      Object.values(r.results).forEach(x => { total += count(x); });
    } catch (e) { console.log('  실패 ' + e.message); killChrome(); }
  }
  console.log(`MLAYOUT 합계 ${total}건`);
  if (opt.json) { fs.writeFileSync(opt.json, JSON.stringify(json, null, 1)); }
  server.close();
  killChrome();
  process.exit(0);
})();
